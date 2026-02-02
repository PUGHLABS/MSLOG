// MSLOG — Mount Spokane Land Owners Group
// Main Application Script

// ─── Auth (Firebase) ─────────────────────────────────────────────
let currentUser = null;
let userProfile = null;
let authReady = false;
let authReadyPromise = null;
let authReadyResolve = null;

// Create a promise that resolves when auth state is known
if (typeof auth !== 'undefined') {
    authReadyPromise = new Promise(function(resolve) {
        authReadyResolve = resolve;
    });

    auth.onAuthStateChanged(async function(user) {
        currentUser = user;
        if (user) {
            // Fetch user profile from Firestore
            try {
                const doc = await db.collection('members').doc(user.uid).get();
                userProfile = doc.exists ? doc.data() : null;
            } catch (e) {
                console.error('Error fetching profile:', e);
                userProfile = null;
            }
        } else {
            userProfile = null;
        }

        // Mark auth as ready and resolve the promise
        if (!authReady) {
            authReady = true;
            if (authReadyResolve) authReadyResolve();
        }

        initNav(); // Re-render nav on auth change
    });
} else {
    authReadyPromise = Promise.resolve();
    authReady = true;
}

function getAuth() {
    if (!currentUser || !userProfile) return null;
    return {
        uid: currentUser.uid,
        email: currentUser.email,
        name: userProfile.name || currentUser.email,
        role: userProfile.role || 'member',
        lot: userProfile.lot || '',
        phone: userProfile.phone || ''
    };
}

function isAuth() { return !!currentUser; }
function isAdmin() { return userProfile && userProfile.role === 'admin'; }

async function loginWithEmail(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

async function registerWithEmail(email, password, profileData) {
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        // Store additional profile data in Firestore
        await db.collection('members').doc(cred.user.uid).set({
            email: email,
            name: profileData.name,
            lot: profileData.lot,
            phone: profileData.phone || '',
            role: 'pending', // Admin must approve
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

function logout() {
    if (typeof auth !== 'undefined') {
        auth.signOut();
    }
}

// Wait for auth to be ready before checking
async function requireAuth() {
    await authReadyPromise;
    if (!isAuth()) window.location.href = 'login.html';
}

async function requireAdmin() {
    await authReadyPromise;
    if (!isAdmin()) window.location.href = 'dashboard.html';
}

// ─── Hamburger Menu (runs once) ─────────────────────────────────
function initHamburger() {
    var btn  = document.getElementById('hamburger');
    var menu = document.getElementById('mobile-menu');
    if (btn && menu) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.classList.toggle('open');
        });
    }
}

// ─── Navigation ──────────────────────────────────────────────────
function initNav() {
    // Highlight current page link
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link[href]').forEach(function(a) {
        if (a.getAttribute('href') === page) a.classList.add('active');
    });

    // Populate auth / member sections based on login state
    var auth = getAuth();
    var dAuth  = document.getElementById('nav-desktop-auth');
    var mAuth  = document.getElementById('nav-mobile-auth');
    var dMem   = document.getElementById('nav-desktop-member');
    var mMem   = document.getElementById('nav-mobile-member');

    if (auth) {
        if (dAuth) dAuth.innerHTML =
            '<span class="text-[#94A1B0] text-sm mr-2">' + auth.name + '</span>' +
            '<button onclick="doLogout()" class="text-xs bg-[#7E8994] hover:bg-[#6b7a85] text-white px-3 py-1 rounded">Logout</button>';
        if (mAuth) mAuth.innerHTML =
            '<div class="border-t border-white border-opacity-20 pt-3 mt-2">' +
            '<p class="text-[#94A1B0] text-xs mb-2">Signed in as ' + auth.name + '</p>' +
            '<button onclick="doLogout()" class="w-full text-xs bg-[#7E8994] hover:bg-[#6b7a85] text-white px-3 py-2 rounded">Logout</button></div>';
        if (dMem) dMem.classList.remove('hidden');
        if (mMem) mMem.classList.remove('hidden');

        // Reveal admin-only links
        if (auth.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(function(el) { el.classList.remove('admin-only'); });
        }

        // Update hero section for logged-in users (index.html)
        var heroRegBtn = document.getElementById('hero-register-btn');
        var heroLoginPrompt = document.getElementById('hero-login-prompt');
        var heroDashBtn = document.getElementById('hero-dashboard-btn');
        if (heroRegBtn) heroRegBtn.classList.add('hidden');
        if (heroLoginPrompt) heroLoginPrompt.classList.add('hidden');
        if (heroDashBtn) heroDashBtn.classList.remove('hidden');
    } else {
        // Show register/login for logged-out users (index.html)
        var heroRegBtn = document.getElementById('hero-register-btn');
        var heroLoginPrompt = document.getElementById('hero-login-prompt');
        var heroDashBtn = document.getElementById('hero-dashboard-btn');
        if (heroRegBtn) heroRegBtn.classList.remove('hidden');
        if (heroLoginPrompt) heroLoginPrompt.classList.remove('hidden');
        if (heroDashBtn) heroDashBtn.classList.add('hidden');
        if (dAuth) dAuth.innerHTML =
            '<a href="login.html" class="nav-link text-xs bg-[#F9812A] hover:bg-[#e07020] text-white px-4 py-1.5 rounded font-semibold">Login</a>';
        if (mAuth) mAuth.innerHTML =
            '<div class="border-t border-white border-opacity-20 pt-3 mt-2">' +
            '<a href="login.html" class="block text-xs text-center bg-[#F9812A] hover:bg-[#e07020] text-white px-3 py-2 rounded">Login</a></div>';
        if (dMem) dMem.classList.add('hidden');
        if (mMem) mMem.classList.add('hidden');
    }
}

function doLogout() { logout(); window.location.href = 'index.html'; }

// ─── Registration Form ───────────────────────────────────────────
function initRegForm() {
    var form = document.getElementById('reg-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var name  = document.getElementById('reg-name').value;
        var email = document.getElementById('reg-email').value;
        var phone = document.getElementById('reg-phone').value;
        var lot   = document.getElementById('reg-lot').value;
        var pass  = document.getElementById('reg-pass').value;
        var passC = document.getElementById('reg-pass-confirm').value;
        var err   = document.getElementById('reg-error');
        var btn   = form.querySelector('button[type="submit"]');

        if (!/^\d{5}\.\d{4}$/.test(lot)) {
            err.textContent = 'Lot number must be in format: 58221.0137 (5 digits . 4 digits)';
            err.classList.remove('hidden'); return;
        }
        if (pass.length < 8 || !/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) {
            err.textContent = 'Password must be 8+ characters with both letters and numbers.';
            err.classList.remove('hidden'); return;
        }
        if (pass !== passC) {
            err.textContent = 'Passwords do not match.';
            err.classList.remove('hidden'); return;
        }

        btn.disabled = true;
        btn.textContent = 'Creating account...';

        var result = await registerWithEmail(email, pass, { name: name, lot: lot, phone: phone });
        if (result.success) {
            err.classList.add('hidden');
            form.classList.add('hidden');
            document.getElementById('reg-confirm').classList.remove('hidden');
        } else {
            err.textContent = result.message || 'Registration failed. Please try again.';
            err.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Register';
        }
    });
}

// ─── Login Form ──────────────────────────────────────────────────
function initLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value;
        var pass  = document.getElementById('login-pass').value;
        var err   = document.getElementById('login-error');
        var btn   = form.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Signing in...';

        var result = await loginWithEmail(email, pass);
        if (result.success) {
            window.location.href = 'dashboard.html';
        } else {
            err.textContent = result.message || 'Invalid email or password.';
            err.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Login';
            setTimeout(function() { err.classList.add('hidden'); }, 4000);
        }
    });
}

// ─── Weather Widget (mock Mount Spokane data) ─────────────────────
function initWeather() {
    var el = document.getElementById('weather-widget');
    if (!el) return;

    var days = [
        { d:'Today', hi:30, lo:22, ic:'&#9201;', c:'Partly Cloudy' },
        { d:'Fri',   hi:28, lo:20, ic:'&#127912;', c:'Light Snow' },
        { d:'Sat',   hi:25, lo:18, ic:'&#10052;',  c:'Snow' },
        { d:'Sun',   hi:27, lo:19, ic:'&#9601;',   c:'Cloudy' },
        { d:'Mon',   hi:32, lo:24, ic:'&#9728;',   c:'Clear' },
        { d:'Tue',   hi:30, lo:22, ic:'&#9201;',   c:'Partly Cloudy' },
        { d:'Wed',   hi:26, lo:20, ic:'&#127912;', c:'Light Snow' }
    ];

    var forecast = days.map(function(d) {
        return '<div class="text-center">' +
            '<p class="text-[#94A1B0] text-xs">' + d.d + '</p>' +
            '<p class="text-base">' + d.ic + '</p>' +
            '<p class="text-xs font-semibold">' + d.hi + '&deg;</p>' +
            '<p class="text-[#94A1B0] text-xs">' + d.lo + '&deg;</p></div>';
    }).join('');

    el.innerHTML =
        '<div class="weather-card rounded-xl p-4 text-white shadow-lg">' +
        '<div class="flex justify-between items-start mb-3">' +
        '<div><h3 class="font-bold text-base">Mount Spokane, WA</h3>' +
        '<p class="text-[#94A1B0] text-xs">5,281 ft &middot; Snow Depth: 42&quot;</p></div>' +
        '<div class="text-right"><p class="text-3xl font-bold">30&deg;F</p>' +
        '<p class="text-[#94A1B0] text-xs">Partly Cloudy</p></div></div>' +
        '<div class="border-t border-white border-opacity-20 pt-3">' +
        '<div class="grid grid-cols-7 gap-0.5">' + forecast + '</div></div>' +
        '<p class="text-[#94A1B0] text-xs mt-2 text-center">Source: mountain-forecast.com &middot; Updated daily</p></div>';
}

// ─── Calendar ────────────────────────────────────────────────────
function initCalendar() {
    var el = document.getElementById('calendar-grid');
    if (!el) return;

    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var dNames  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    var firstDay = new Date(y, m, 1).getDay();
    var daysIn   = new Date(y, m + 1, 0).getDate();

    // Mock recurring events by day-of-month
    var events = {
        5:  ['Monthly Meeting — 7:00 PM'],
        12: ['Work Party — 9:00 AM'],
        19: ['Board Meeting — 6:00 PM'],
        26: ['Community Potluck — 5:00 PM']
    };

    var html = '<div class="flex justify-between items-center mb-4">' +
        '<h3 class="text-lg font-bold text-[#063559]">' + months[m] + ' ' + y + '</h3></div>';
    html += '<div class="grid grid-cols-7 gap-1 mb-2">' +
        dNames.map(function(d) { return '<div class="text-center text-xs font-semibold text-[#7E8994] py-1">' + d + '</div>'; }).join('') + '</div>';
    html += '<div class="grid grid-cols-7 gap-1">';

    for (var i = 0; i < firstDay; i++) { html += '<div class="cal-day empty"></div>'; }
    for (var d = 1; d <= daysIn; d++) {
        var cls   = (d === today ? ' today' : '') + (events[d] ? ' has-event' : '');
        var title = events[d] ? ' title="' + events[d].join('; ') + '"' : '';
        html += '<div class="cal-day' + cls + '"' + title + '><span class="text-sm">' + d + '</span></div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

// ─── Directory search / filter ───────────────────────────────────
function initSearch() {
    var input = document.getElementById('dir-search');
    if (!input) return;

    input.addEventListener('input', function() {
        var q    = this.value.toLowerCase();
        var rows = document.querySelectorAll('#dir-table tbody tr');
        var count = 0;
        rows.forEach(function(row) {
            var match = row.textContent.toLowerCase().indexOf(q) !== -1;
            row.style.display = match ? '' : 'none';
            if (match) count++;
        });
        var noRes = document.getElementById('dir-no-results');
        if (noRes) noRes.style.display = count === 0 ? 'block' : 'none';
    });
}

// ─── Documents category filter ───────────────────────────────────
function initDocFilter() {
    var pills = document.querySelectorAll('.cat-pill');
    if (!pills.length) return;

    pills.forEach(function(pill) {
        pill.addEventListener('click', function() {
            pills.forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');

            var cat = this.getAttribute('data-cat');
            document.querySelectorAll('.doc-item').forEach(function(item) {
                if (cat === 'all' || item.getAttribute('data-cat') === cat) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
}

// ─── Forum — new thread (mock) ───────────────────────────────────
function initForum() {
    var form = document.getElementById('new-thread-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        var title = document.getElementById('thread-title').value.trim();
        var body  = document.getElementById('thread-body').value.trim();
        if (!title) return;

        var auth = getAuth();
        var list = document.getElementById('thread-list');
        var div  = document.createElement('div');
        div.className = 'thread-card bg-white rounded-lg p-4 shadow-sm';
        div.innerHTML =
            '<div class="flex justify-between items-start">' +
            '<h4 class="font-semibold text-[#063559]">' + title + '</h4>' +
            '<span class="badge badge-new">New</span></div>' +
            '<p class="text-[#7E8994] text-xs mt-1">Posted by ' + (auth ? auth.name : 'You') + ' &mdash; just now &middot; 0 replies</p>' +
            (body ? '<p class="mt-2 text-sm text-[#64748b]">' + body + '</p>' : '');
        list.insertBefore(div, list.firstChild);
        form.reset();
    });
}

// ─── Gate code (Firestore) ───────────────────────────────────────
async function loadGateCode() {
    var display = document.getElementById('gate-code-display');
    var timeEl = document.getElementById('gate-updated-time');
    if (!display) return;

    try {
        var doc = await db.collection('settings').doc('gatecode').get();
        if (doc.exists) {
            var data = doc.data();
            display.textContent = data.code || '----';
            if (data.updatedAt) {
                var date = data.updatedAt.toDate();
                timeEl.textContent = 'Updated ' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
        }
    } catch (e) {
        console.error('Error loading gate code:', e);
    }
}

function initGateCode() {
    // Load current gate code
    loadGateCode();

    var form = document.getElementById('gate-edit-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var val = document.getElementById('gate-new-code').value.trim();
        var btn = form.querySelector('button[type="submit"]');

        if (/^\d{4}$/.test(val)) {
            btn.disabled = true;
            btn.textContent = 'Saving...';

            try {
                await db.collection('settings').doc('gatecode').set({
                    code: val,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentUser ? currentUser.uid : null
                });

                document.getElementById('gate-code-display').textContent = val;
                document.getElementById('gate-updated-time').textContent = 'Updated just now';
                document.getElementById('gate-success').classList.remove('hidden');
                setTimeout(function() { document.getElementById('gate-success').classList.add('hidden'); }, 3000);
                form.reset();
            } catch (e) {
                console.error('Error saving gate code:', e);
                alert('Failed to save gate code. Please try again.');
            }

            btn.disabled = false;
            btn.textContent = 'Update';
        }
    });
}

// ─── QR Code expand on click ─────────────────────────────────────
function initQRCode() {
    var qr = document.getElementById('qr-code');
    if (!qr) return;

    var expanded = false;
    qr.addEventListener('click', function() {
        if (expanded) {
            // Shrink back to original size
            qr.classList.remove('w-[4.5rem]', 'h-[4.5rem]', 'md:w-24', 'md:h-24');
            qr.classList.add('w-12', 'h-12', 'md:w-16', 'md:h-16');
        } else {
            // Expand by 50%
            qr.classList.remove('w-12', 'h-12', 'md:w-16', 'md:h-16');
            qr.classList.add('w-[4.5rem]', 'h-[4.5rem]', 'md:w-24', 'md:h-24');
        }
        expanded = !expanded;
    });
}

// ─── Init everything on DOMContentLoaded ─────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    initHamburger();
    initNav();
    initRegForm();
    initLoginForm();
    initWeather();
    initCalendar();
    initSearch();
    initDocFilter();
    initForum();
    initGateCode();
    initQRCode();
});
