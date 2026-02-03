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

// ─── Documents (Firestore CRUD) ──────────────────────────────────
var docCategoryColors = {
    bylaws: '#063559',
    minutes: '#7E8994',
    resources: '#F9812A',
    maps: '#94A1B0'
};

var docCategoryBadges = {
    bylaws: 'badge-admin',
    minutes: 'badge-member',
    resources: 'badge-new',
    maps: 'badge-pending'
};

var docCategoryIcons = {
    bylaws: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h12m-6-8h.01M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z"></path></svg>',
    minutes: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>',
    resources: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg>',
    maps: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>'
};

function renderDocItem(doc, isAdmin) {
    var data = doc.data();
    var cat = data.category || 'resources';
    var dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';

    var deleteBtn = isAdmin ?
        '<button onclick="deleteDocument(\'' + doc.id + '\')" class="text-red-500 hover:text-red-700 text-xs font-semibold ml-auto">Delete</button>' : '';

    return '<div class="doc-item flex items-start gap-4 bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-4" data-cat="' + cat + '" data-id="' + doc.id + '">' +
        '<div class="text-white rounded-lg p-3 flex-shrink-0" style="background-color: ' + (docCategoryColors[cat] || '#7E8994') + '">' +
        (docCategoryIcons[cat] || docCategoryIcons.resources) +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex flex-wrap items-center gap-2 mb-1">' +
        '<h3 class="font-semibold text-[#063559]">' + escapeHtml(data.title) + '</h3>' +
        '<span class="badge ' + (docCategoryBadges[cat] || 'badge-member') + '">' + cat.charAt(0).toUpperCase() + cat.slice(1) + '</span>' +
        '</div>' +
        '<p class="text-[#7E8994] text-xs">' + escapeHtml(data.description || '') + '</p>' +
        '<div class="flex items-center gap-4 mt-2">' +
        '<span class="text-[#94A1B0] text-xs">Posted ' + dateStr + '</span>' +
        '<a href="' + escapeHtml(data.url || '#') + '" target="_blank" class="text-[#F9812A] text-xs font-semibold hover:underline">Download PDF →</a>' +
        deleteBtn +
        '</div></div></div>';
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadDocuments() {
    var list = document.getElementById('doc-list');
    if (!list) return;

    try {
        var snapshot = await db.collection('documents').orderBy('createdAt', 'desc').get();
        var admin = isAdmin();

        if (snapshot.empty) {
            list.innerHTML = '<div class="text-center py-8 text-[#94A1B0]">No documents yet. Admins can add documents using the form above.</div>';
            return;
        }

        var html = '';
        snapshot.forEach(function(doc) {
            html += renderDocItem(doc, admin);
        });
        list.innerHTML = html;

        // Re-apply current filter
        var activeFilter = document.querySelector('.cat-pill.active');
        if (activeFilter) {
            var cat = activeFilter.getAttribute('data-cat');
            if (cat !== 'all') {
                document.querySelectorAll('.doc-item').forEach(function(item) {
                    item.style.display = item.getAttribute('data-cat') === cat ? 'flex' : 'none';
                });
            }
        }
    } catch (e) {
        console.error('Error loading documents:', e);
        list.innerHTML = '<div class="text-center py-8 text-red-500">Error loading documents. Please refresh the page.</div>';
    }
}

async function addDocument(title, category, description, url) {
    try {
        await db.collection('documents').add({
            title: title,
            category: category,
            description: description,
            url: url,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : null
        });
        return { success: true };
    } catch (e) {
        console.error('Error adding document:', e);
        return { success: false, message: e.message };
    }
}

async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
        await db.collection('documents').doc(docId).delete();
        var item = document.querySelector('.doc-item[data-id="' + docId + '"]');
        if (item) item.remove();
    } catch (e) {
        console.error('Error deleting document:', e);
        alert('Failed to delete document. Please try again.');
    }
}

function initDocuments() {
    // Load documents from Firestore
    loadDocuments();

    // Handle add document form
    var form = document.getElementById('add-doc-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var title = document.getElementById('doc-title').value.trim();
        var category = document.getElementById('doc-category').value;
        var desc = document.getElementById('doc-desc').value.trim();
        var url = document.getElementById('doc-url').value.trim();
        var btn = form.querySelector('button[type="submit"]');
        var success = document.getElementById('doc-success');
        var error = document.getElementById('doc-error');

        btn.disabled = true;
        btn.textContent = 'Adding...';
        success.classList.add('hidden');
        error.classList.add('hidden');

        var result = await addDocument(title, category, desc, url);

        if (result.success) {
            success.classList.remove('hidden');
            form.reset();
            loadDocuments(); // Refresh the list
            setTimeout(function() { success.classList.add('hidden'); }, 3000);
        } else {
            error.textContent = result.message || 'Failed to add document.';
            error.classList.remove('hidden');
        }

        btn.disabled = false;
        btn.textContent = 'Add Document';
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

// ─── Videos (Firestore CRUD) ─────────────────────────────────────
var videoCategoryColors = {
    tutorial: '#063559',
    event: '#7E8994',
    community: '#F9812A',
    safety: '#dc2626'
};

var videoCategoryBadges = {
    tutorial: 'badge-admin',
    event: 'badge-member',
    community: 'badge-new',
    safety: 'badge-pending'
};

function extractYouTubeId(url) {
    if (!url) return null;
    var match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

function renderVideoItem(doc, isAdmin) {
    var data = doc.data();
    var cat = data.category || 'community';
    var dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown date';
    var videoId = extractYouTubeId(data.url);

    var deleteBtn = isAdmin ?
        '<button onclick="deleteVideo(\'' + doc.id + '\')" class="text-red-500 hover:text-red-700 text-xs font-semibold">Delete</button>' : '';

    var videoEmbed = videoId ?
        '<iframe class="w-full h-full" src="https://www.youtube.com/embed/' + videoId + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' :
        '<div class="text-center"><svg class="w-12 h-12 text-white opacity-60 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg><p class="text-white text-xs opacity-60">Invalid URL</p></div>';

    return '<div class="video-item card-hover bg-white rounded-xl shadow-sm border border-[#e2e8f0] overflow-hidden" data-cat="' + cat + '" data-id="' + doc.id + '">' +
        '<div class="video-aspect bg-[#1a1a2e] flex items-center justify-center">' + videoEmbed + '</div>' +
        '<div class="p-4">' +
        '<div class="flex flex-wrap items-center gap-2 mb-1">' +
        '<h3 class="font-semibold text-[#063559] text-sm">' + escapeHtml(data.title) + '</h3>' +
        '<span class="badge ' + (videoCategoryBadges[cat] || 'badge-member') + '">' + cat.charAt(0).toUpperCase() + cat.slice(1) + '</span>' +
        '</div>' +
        '<p class="text-[#7E8994] text-xs mt-1">' + escapeHtml(data.description || '') + '</p>' +
        '<div class="flex items-center justify-between mt-2">' +
        '<span class="text-[#94A1B0] text-xs">Posted ' + dateStr + '</span>' +
        deleteBtn +
        '</div></div></div>';
}

async function loadVideos() {
    var list = document.getElementById('video-list');
    if (!list) return;

    try {
        var snapshot = await db.collection('videos').orderBy('createdAt', 'desc').get();
        var admin = isAdmin();

        if (snapshot.empty) {
            list.innerHTML = '<div class="col-span-full text-center py-8 text-[#94A1B0]">No videos yet. Admins can add videos using the form above.</div>';
            return;
        }

        var html = '';
        snapshot.forEach(function(doc) {
            html += renderVideoItem(doc, admin);
        });
        list.innerHTML = html;

        // Re-apply current filter
        var activeFilter = document.querySelector('.vid-pill.active');
        if (activeFilter) {
            var cat = activeFilter.getAttribute('data-cat');
            if (cat !== 'all') {
                document.querySelectorAll('.video-item').forEach(function(item) {
                    item.style.display = item.getAttribute('data-cat') === cat ? 'block' : 'none';
                });
            }
        }
    } catch (e) {
        console.error('Error loading videos:', e);
        list.innerHTML = '<div class="col-span-full text-center py-8 text-red-500">Error loading videos. Please refresh the page.</div>';
    }
}

async function addVideo(title, category, description, url) {
    try {
        await db.collection('videos').add({
            title: title,
            category: category,
            description: description,
            url: url,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : null
        });
        return { success: true };
    } catch (e) {
        console.error('Error adding video:', e);
        return { success: false, message: e.message };
    }
}

async function deleteVideo(videoId) {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
        await db.collection('videos').doc(videoId).delete();
        var item = document.querySelector('.video-item[data-id="' + videoId + '"]');
        if (item) item.remove();
    } catch (e) {
        console.error('Error deleting video:', e);
        alert('Failed to delete video. Please try again.');
    }
}

function initVideos() {
    // Load videos from Firestore
    loadVideos();

    // Handle add video form
    var form = document.getElementById('add-video-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var title = document.getElementById('video-title').value.trim();
        var category = document.getElementById('video-category').value;
        var desc = document.getElementById('video-desc').value.trim();
        var url = document.getElementById('video-url').value.trim();
        var btn = form.querySelector('button[type="submit"]');
        var success = document.getElementById('video-success');
        var error = document.getElementById('video-error');

        // Validate YouTube URL
        if (!extractYouTubeId(url)) {
            error.textContent = 'Please enter a valid YouTube URL.';
            error.classList.remove('hidden');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Adding...';
        success.classList.add('hidden');
        error.classList.add('hidden');

        var result = await addVideo(title, category, desc, url);

        if (result.success) {
            success.classList.remove('hidden');
            form.reset();
            loadVideos(); // Refresh the list
            setTimeout(function() { success.classList.add('hidden'); }, 3000);
        } else {
            error.textContent = result.message || 'Failed to add video.';
            error.classList.remove('hidden');
        }

        btn.disabled = false;
        btn.textContent = 'Add Video';
    });
}

// ─── Videos category filter ──────────────────────────────────────
function initVideoFilter() {
    var pills = document.querySelectorAll('.vid-pill');
    if (!pills.length) return;

    pills.forEach(function(pill) {
        pill.addEventListener('click', function() {
            pills.forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');

            var cat = this.getAttribute('data-cat');
            document.querySelectorAll('.video-item').forEach(function(item) {
                if (cat === 'all' || item.getAttribute('data-cat') === cat) {
                    item.style.display = 'block';
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
            qr.classList.remove('w-[4.125rem]', 'h-[4.125rem]');
            qr.classList.add('w-[2.75rem]', 'h-[2.75rem]');
        } else {
            // Expand by 50%
            qr.classList.remove('w-[2.75rem]', 'h-[2.75rem]');
            qr.classList.add('w-[4.125rem]', 'h-[4.125rem]');
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
    initDocuments();
    initDocFilter();
    initVideos();
    initVideoFilter();
    initForum();
    initGateCode();
    initQRCode();
});
