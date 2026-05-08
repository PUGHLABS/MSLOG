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
            role: 'member',
            status: 'pending', // Admin must approve
            notifications: { topics: { calendar: true, videos: true, forum: true } },
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
    if (!isAuth()) { window.location.href = 'login.html'; return; }
    if (!userProfile || userProfile.status !== 'approved') {
        window.location.href = 'pending.html'; return;
    }
}

async function requireAdmin() {
    await authReadyPromise;
    if (!isAdmin()) window.location.href = 'dashboard.html';
}

// ─── Dark Mode ───────────────────────────────────────────────────
function initDarkMode() {
    if (localStorage.getItem('darkMode') !== '0') {
        document.documentElement.classList.add('dark');
    }
}

function toggleDarkMode() {
    var isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    document.querySelectorAll('.dark-toggle').forEach(function(btn) {
        btn.innerHTML = isDark ? _sunSVG() : _moonSVG();
        btn.title = isDark ? 'Light mode' : 'Dark mode';
    });
}

function _moonSVG() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}

function _sunSVG() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
}

// Apply dark mode immediately when script loads (avoids flash)
initDarkMode();

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
    // ── Desktop hamburger: collapse inline links into dropdown (once per load) ──
    if (!document.getElementById('desktop-hamburger')) {
        var pubEl = document.getElementById('nav-desktop-public');
        if (pubEl) {
            var linksRow = pubEl.parentElement;
            var outerWrap = document.createElement('div');
            outerWrap.style.position = 'relative';
            linksRow.parentNode.insertBefore(outerWrap, linksRow);
            var hbtn = document.createElement('button');
            hbtn.id = 'desktop-hamburger';
            hbtn.setAttribute('aria-expanded', 'false');
            hbtn.className = 'flex items-center gap-1.5 text-[#F9812A] hover:text-white px-2.5 py-1.5 rounded-lg border border-[#F9812A] border-opacity-50 hover:border-white text-sm font-medium transition-colors';
            hbtn.innerHTML = '<svg class="w-[26px] h-[26px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg><span>Menu</span>';
            var panel = document.createElement('div');
            panel.id = 'desktop-nav-panel';
            panel.className = 'hidden absolute left-0 bg-[#052d4a] rounded-b-lg shadow-xl z-50 py-1';
            outerWrap.appendChild(hbtn);
            outerWrap.appendChild(panel);
            panel.appendChild(linksRow);
            hbtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var nowHidden = panel.classList.toggle('hidden');
                hbtn.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
            });
            document.addEventListener('click', function() {
                panel.classList.add('hidden');
                hbtn.setAttribute('aria-expanded', 'false');
            });
        }
    }

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

    var isDark = document.documentElement.classList.contains('dark');
    var dToggle = '<button onclick="toggleDarkMode()" class="dark-toggle text-[#94A1B0] hover:text-white p-1.5 rounded transition-colors mr-2" title="' + (isDark ? 'Light mode' : 'Dark mode') + '" aria-label="Toggle dark mode">' + (isDark ? _sunSVG() : _moonSVG()) + '</button>';
    var mToggle = '<div class="border-t border-white border-opacity-20 mt-2 pt-2 flex items-center px-3 py-2"><button onclick="toggleDarkMode()" class="dark-toggle flex items-center gap-2 text-[#94A1B0] hover:text-white text-sm rounded transition-colors">' + (isDark ? _sunSVG() : _moonSVG()) + '<span class="ml-2">' + (isDark ? 'Light mode' : 'Dark mode') + '</span></button></div>';

    if (auth) {
        if (dAuth) dAuth.innerHTML = dToggle +
            '<span class="text-[#94A1B0] text-sm mr-2">' + auth.name + '</span>' +
            '<button onclick="doLogout()" class="text-xs bg-[#7E8994] hover:bg-[#6b7a85] text-white px-3 py-1 rounded">Logout</button>';
        if (mAuth) mAuth.innerHTML =
            '<div class="border-t border-white border-opacity-20 pt-3 mt-2">' +
            '<p class="text-[#94A1B0] text-xs mb-2">Signed in as ' + auth.name + '</p>' +
            '<button onclick="doLogout()" class="w-full text-xs bg-[#7E8994] hover:bg-[#6b7a85] text-white px-3 py-2 rounded">Logout</button></div>' + mToggle;
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
        if (dAuth) dAuth.innerHTML = dToggle +
            '<a href="login.html" class="nav-link text-xs bg-[#F9812A] hover:bg-[#e07020] text-white px-4 py-1.5 rounded font-semibold">Login</a>';
        if (mAuth) mAuth.innerHTML =
            '<div class="border-t border-white border-opacity-20 pt-3 mt-2">' +
            '<a href="login.html" class="block text-xs text-center bg-[#F9812A] hover:bg-[#e07020] text-white px-3 py-2 rounded">Login</a></div>' + mToggle;
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
            try {
                const user = auth.currentUser;
                const doc = user ? await db.collection('members').doc(user.uid).get() : null;
                const profile = doc && doc.exists ? doc.data() : null;
                window.location.href = (profile && profile.status === 'pending')
                    ? 'pending.html'
                    : 'dashboard.html';
            } catch (e) {
                window.location.href = 'dashboard.html';
            }
        } else {
            err.textContent = result.message || 'Invalid email or password.';
            err.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Login';
            setTimeout(function() { err.classList.add('hidden'); }, 4000);
        }
    });
}

// ─── Weather Widget (Live data from Open-Meteo API) ─────────────────────
function initWeather() {
    var el = document.getElementById('weather-widget');
    if (!el) return;

    // Mount Spokane coordinates
    var lat = 47.9244;
    var lon = -117.1139;

    // Show loading state
    el.innerHTML = '<div class="weather-card weather-desktop rounded-xl p-4 md:p-5 text-white shadow-lg"><p class="text-center text-sm">Loading weather...</p></div>';

    // Fetch weather from Open-Meteo (free, no API key needed)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
          '&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,snowfall_sum' +
          '&temperature_unit=fahrenheit&timezone=America/Los_Angeles&forecast_days=7')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            renderWeather(el, data);
        })
        .catch(function(err) {
            console.error('Weather fetch error:', err);
            renderWeatherFallback(el);
        });
}

function getWeatherIcon(code) {
    // WMO Weather codes: https://open-meteo.com/en/docs
    if (code === 0) return { icon: '☀️', desc: 'Clear' };
    if (code <= 3) return { icon: '⛅', desc: 'Partly Cloudy' };
    if (code <= 48) return { icon: '☁️', desc: 'Cloudy' };
    if (code <= 55) return { icon: '🌧️', desc: 'Drizzle' };
    if (code <= 65) return { icon: '🌧️', desc: 'Rain' };
    if (code <= 67) return { icon: '🌨️', desc: 'Freezing Rain' };
    if (code <= 77) return { icon: '❄️', desc: 'Snow' };
    if (code <= 82) return { icon: '🌧️', desc: 'Rain Showers' };
    if (code <= 86) return { icon: '🌨️', desc: 'Snow Showers' };
    if (code <= 99) return { icon: '⛈️', desc: 'Thunderstorm' };
    return { icon: '🌡️', desc: 'Weather' };
}

function renderWeather(el, data) {
    var current = data.current;
    var daily = data.daily;
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    var currentWeather = getWeatherIcon(current.weather_code);
    var currentTemp = Math.round(current.temperature_2m);

    // Calculate total snow in forecast
    var totalSnow = daily.snowfall_sum.reduce(function(a, b) { return a + b; }, 0);
    var snowText = totalSnow > 0 ? Math.round(totalSnow) + '" snow expected' : 'No snow expected';

    // Build 7-day forecast
    var forecast = daily.time.map(function(dateStr, i) {
        var date = new Date(dateStr + 'T12:00:00');
        var dayName = i === 0 ? 'Today' : dayNames[date.getDay()];
        var weather = getWeatherIcon(daily.weather_code[i]);
        var hi = Math.round(daily.temperature_2m_max[i]);
        var lo = Math.round(daily.temperature_2m_min[i]);

        return '<div class="text-center">' +
            '<p class="text-[#94A1B0] text-xs md:text-sm">' + dayName + '</p>' +
            '<p class="text-base md:text-lg">' + weather.icon + '</p>' +
            '<p class="text-xs md:text-sm font-semibold">' + hi + '°</p>' +
            '<p class="text-[#94A1B0] text-xs md:text-sm">' + lo + '°</p></div>';
    }).join('');

    el.innerHTML =
        '<div class="weather-card weather-desktop rounded-xl p-4 md:p-5 text-white shadow-lg">' +
        '<div class="flex justify-between items-start mb-3">' +
        '<div><h3 class="font-bold text-base md:text-lg">Mount Spokane, WA</h3>' +
        '<p class="text-[#94A1B0] text-xs md:text-sm">5,281 ft · ' + snowText + '</p></div>' +
        '<div class="text-right"><p class="text-3xl md:text-4xl font-bold">' + currentTemp + '°F</p>' +
        '<p class="text-[#94A1B0] text-xs md:text-sm">' + currentWeather.desc + '</p></div></div>' +
        '<div class="border-t border-white border-opacity-20 pt-3">' +
        '<div class="grid grid-cols-7 gap-0.5 md:gap-1">' + forecast + '</div></div>' +
        '<p class="text-[#94A1B0] text-xs md:text-sm mt-2 text-center">Source: Open-Meteo · Updated hourly</p></div>';
}

function renderWeatherFallback(el) {
    el.innerHTML =
        '<div class="weather-card weather-desktop rounded-xl p-4 md:p-5 text-white shadow-lg">' +
        '<div class="flex justify-between items-start">' +
        '<div><h3 class="font-bold text-base md:text-lg">Mount Spokane, WA</h3>' +
        '<p class="text-[#94A1B0] text-xs md:text-sm">5,281 ft elevation</p></div>' +
        '<div class="text-right"><p class="text-[#94A1B0] text-sm md:text-base">Weather unavailable</p></div></div></div>';
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

    // Helper to format date as YYYY-MM-DD
    function dateKey(day) {
        var mm = String(m + 1).padStart(2, '0');
        var dd = String(day).padStart(2, '0');
        return y + '-' + mm + '-' + dd;
    }

    var html = '<div class="flex justify-between items-center mb-4">' +
        '<h3 class="text-lg font-bold text-[#063559]">' + months[m] + ' ' + y + '</h3></div>';
    html += '<div class="grid grid-cols-7 gap-1 mb-2">' +
        dNames.map(function(d) { return '<div class="text-center text-xs font-semibold text-[#7E8994] py-1">' + d + '</div>'; }).join('') + '</div>';
    html += '<div class="grid grid-cols-7 gap-1">';

    for (var i = 0; i < firstDay; i++) { html += '<div class="cal-day empty"></div>'; }
    for (var d = 1; d <= daysIn; d++) {
        var key = dateKey(d);
        var dayEvents = calendarEvents[key] || [];
        var cls   = (d === today ? ' today' : '') + (dayEvents.length ? ' has-event' : '');
        var title = dayEvents.length ? ' title="' + dayEvents.join('; ') + '"' : '';
        html += '<div class="cal-day' + cls + '"' + title + '><span class="text-sm">' + d + '</span></div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

// ─── Member Directory (Firestore) ────────────────────────────────
function renderMemberRow(doc) {
    var data = doc.data();
    var role = data.role || 'member';
    var badgeClass = role === 'admin' ? 'badge-admin' : 'badge-member';
    var badgeText = role.charAt(0).toUpperCase() + role.slice(1);

    return '<tr data-id="' + doc.id + '">' +
        '<td>' + escapeHtml(data.name || 'Unknown') + '</td>' +
        '<td>' + escapeHtml(data.lot || '—') + '</td>' +
        '<td>' + escapeHtml(data.email || '—') + '</td>' +
        '<td>' + escapeHtml(data.phone || '—') + '</td>' +
        '<td><span class="badge ' + badgeClass + '">' + badgeText + '</span></td>' +
        '</tr>';
}

async function loadMembers() {
    var tbody = document.getElementById('dir-tbody');
    var countEl = document.getElementById('dir-count');
    if (!tbody) return;

    try {
        // Get all approved members
        var snapshot = await db.collection('members')
            .where('status', '==', 'approved')
            .get();

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-[#94A1B0]">No members found.</td></tr>';
            if (countEl) countEl.textContent = '';
            return;
        }

        // Sort client-side by name (avoids needing composite index)
        var members = [];
        snapshot.forEach(function(doc) {
            members.push(doc);
        });
        members.sort(function(a, b) {
            var nameA = (a.data().name || '').toLowerCase();
            var nameB = (b.data().name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        var html = '';
        members.forEach(function(doc) {
            html += renderMemberRow(doc);
        });
        tbody.innerHTML = html;

        if (countEl) countEl.textContent = 'Showing ' + members.length + ' member' + (members.length !== 1 ? 's' : '') + '.';
    } catch (e) {
        console.error('Error loading members:', e);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-500">Error loading members. Please refresh the page.</td></tr>';
    }
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
    minutes: '#7E8994',
    resources: '#F9812A',
    maps: '#94A1B0'
};

var docCategoryBadges = {
    minutes: 'badge-member',
    resources: 'badge-new',
    maps: 'badge-pending'
};

var docCategoryIcons = {
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

async function addDocument(title, category, description, file) {
    try {
        if (!storage) throw new Error('Firebase Storage not available');
        if (file.size > 10 * 1024 * 1024) throw new Error('File too large. Max 10MB.');

        // Upload file to Firebase Storage
        var safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var storageRef = storage.ref('documents/' + safeName);
        var uploadTask = storageRef.put(file, { contentType: 'application/pdf' });

        // Show progress
        var progressEl = document.getElementById('upload-progress');
        var barEl = document.getElementById('upload-bar');
        var pctEl = document.getElementById('upload-pct');
        if (progressEl) progressEl.classList.remove('hidden');

        await new Promise(function(resolve, reject) {
            uploadTask.on('state_changed',
                function(snapshot) {
                    var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    if (barEl) barEl.style.width = pct + '%';
                    if (pctEl) pctEl.textContent = 'Uploading... ' + pct + '%';
                },
                function(error) { reject(error); },
                function() { resolve(); }
            );
        });

        var downloadUrl = await storageRef.getDownloadURL();
        if (progressEl) progressEl.classList.add('hidden');

        // Save metadata to Firestore
        await db.collection('documents').add({
            title: title,
            category: category,
            description: description,
            url: downloadUrl,
            storagePath: 'documents/' + safeName,
            fileName: file.name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : null
        });
        return { success: true };
    } catch (e) {
        console.error('Error adding document:', e);
        var progressEl = document.getElementById('upload-progress');
        if (progressEl) progressEl.classList.add('hidden');
        return { success: false, message: e.message };
    }
}

async function addDocumentUrl(title, category, description, url) {
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
        // Get the document to find storage path
        var docRef = db.collection('documents').doc(docId);
        var docSnap = await docRef.get();
        if (docSnap.exists) {
            var data = docSnap.data();
            // Delete file from Storage if it has a storagePath
            if (data.storagePath && storage) {
                try {
                    await storage.ref(data.storagePath).delete();
                } catch (storageErr) {
                    console.warn('Could not delete storage file:', storageErr);
                }
            }
        }
        await docRef.delete();
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
        var btn = form.querySelector('button[type="submit"]');
        var success = document.getElementById('doc-success');
        var error = document.getElementById('doc-error');

        // Determine source mode
        var sourceRadio = document.querySelector('input[name="doc-source"]:checked');
        var mode = sourceRadio ? sourceRadio.value : 'upload';
        var fileInput = document.getElementById('doc-file');
        var urlInput = document.getElementById('doc-url');

        if (mode === 'upload') {
            var file = fileInput ? fileInput.files[0] : null;
            if (!file) {
                error.textContent = 'Please select a PDF file.';
                error.classList.remove('hidden');
                return;
            }
        } else {
            var url = urlInput ? urlInput.value.trim() : '';
            if (!url) {
                error.textContent = 'Please enter a URL.';
                error.classList.remove('hidden');
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = mode === 'upload' ? 'Uploading...' : 'Adding...';
        success.classList.add('hidden');
        error.classList.add('hidden');

        var result = mode === 'upload'
            ? await addDocument(title, category, desc, file)
            : await addDocumentUrl(title, category, desc, url);

        if (result.success) {
            success.classList.remove('hidden');
            form.reset();
            // Reset to upload mode after form reset
            var uploadSection = document.getElementById('doc-upload-section');
            var urlSection = document.getElementById('doc-url-section');
            if (uploadSection) uploadSection.classList.remove('hidden');
            if (urlSection) urlSection.classList.add('hidden');
            loadDocuments();
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

// ─── Calendar Events (Firestore CRUD) ────────────────────────────
var calendarEvents = {}; // Cache events by date key (YYYY-MM-DD)

function formatTime12(time24) {
    if (!time24) return '';
    var parts = time24.split(':');
    var h = parseInt(parts[0], 10);
    var m = parts[1];
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + ampm;
}

function renderEventItem(doc, isAdmin) {
    var data = doc.data();
    var eventDate = data.date ? new Date(data.date + 'T00:00:00') : new Date();
    var month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    var day = eventDate.getDate();
    var isUpcoming = eventDate >= new Date(new Date().setHours(0, 0, 0, 0));

    var deleteBtn = isAdmin ?
        '<button onclick="deleteEvent(\'' + doc.id + '\')" class="text-red-500 hover:text-red-700 text-xs font-semibold mt-1">Delete</button>' : '';

    var bgColor = isUpcoming ? '#F9812A' : '#063559';

    return '<div class="event-item bg-white rounded-xl shadow-sm border border-[#e2e8f0] p-4" data-id="' + doc.id + '">' +
        '<div class="flex items-start gap-3">' +
        '<div class="text-white rounded-lg p-2 text-center min-w-[44px]" style="background-color: ' + bgColor + '">' +
        '<p class="text-xs font-semibold leading-none">' + month + '</p>' +
        '<p class="text-lg font-bold leading-none">' + day + '</p>' +
        '</div>' +
        '<div class="flex-1">' +
        '<h3 class="text-sm font-semibold text-[#063559]">' + escapeHtml(data.title) + '</h3>' +
        '<p class="text-[#7E8994] text-xs">' + formatTime12(data.time) + ' &middot; ' + escapeHtml(data.location || 'TBD') + '</p>' +
        (data.description ? '<p class="text-[#94A1B0] text-xs mt-1">' + escapeHtml(data.description) + '</p>' : '') +
        deleteBtn +
        '</div></div></div>';
}

async function loadEvents() {
    var list = document.getElementById('event-list');
    if (!list) return;

    try {
        // Get all events for the current year, ordered by date
        var now = new Date();
        var yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        var yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
        var snapshot = await db.collection('events').where('date', '>=', yearStart).where('date', '<=', yearEnd).orderBy('date', 'asc').get();
        var admin = isAdmin();

        // Also load all events for the current month for calendar display
        var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        var monthSnapshot = await db.collection('events').where('date', '>=', monthStart).where('date', '<=', monthEnd).get();

        // Cache events by date for calendar
        calendarEvents = {};
        monthSnapshot.forEach(function(doc) {
            var data = doc.data();
            if (data.date) {
                if (!calendarEvents[data.date]) calendarEvents[data.date] = [];
                calendarEvents[data.date].push(data.title);
            }
        });

        // Re-render calendar with events
        initCalendar();

        if (snapshot.empty) {
            list.innerHTML = '<div class="text-center py-4 text-[#94A1B0] text-sm">No events this year. Admins can add events above.</div>';
            return;
        }

        var html = '';
        snapshot.forEach(function(doc) {
            html += renderEventItem(doc, admin);
        });
        list.innerHTML = '<div class="space-y-3">' + html + '</div>';
    } catch (e) {
        console.error('Error loading events:', e);
        list.innerHTML = '<div class="text-center py-4 text-red-500 text-sm">Error loading events.</div>';
    }
}

async function addEvent(title, date, time, location, description) {
    try {
        await db.collection('events').add({
            title: title,
            date: date,
            time: time,
            location: location,
            description: description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: currentUser ? currentUser.uid : null
        });
        return { success: true };
    } catch (e) {
        console.error('Error adding event:', e);
        return { success: false, message: e.message };
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
        await db.collection('events').doc(eventId).delete();
        var item = document.querySelector('.event-item[data-id="' + eventId + '"]');
        if (item) item.remove();
        loadEvents(); // Reload to refresh calendar
    } catch (e) {
        console.error('Error deleting event:', e);
        alert('Failed to delete event. Please try again.');
    }
}

function initEvents() {
    // Load events from Firestore
    loadEvents();

    // Handle add event form
    var form = document.getElementById('add-event-form');
    if (!form) return;

    // Set default date to today
    var dateInput = document.getElementById('event-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var title = document.getElementById('event-title').value.trim();
        var date = document.getElementById('event-date').value;
        var time = document.getElementById('event-time').value;
        var location = document.getElementById('event-location').value.trim();
        var desc = document.getElementById('event-desc').value.trim();
        var btn = form.querySelector('button[type="submit"]');
        var success = document.getElementById('event-success');
        var error = document.getElementById('event-error');

        btn.disabled = true;
        btn.textContent = 'Adding...';
        success.classList.add('hidden');
        error.classList.add('hidden');

        var result = await addEvent(title, date, time, location, desc);

        if (result.success) {
            success.classList.remove('hidden');
            form.reset();
            // Reset date to today
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            loadEvents(); // Refresh the list and calendar
            setTimeout(function() { success.classList.add('hidden'); }, 3000);
        } else {
            error.textContent = result.message || 'Failed to add event.';
            error.classList.remove('hidden');
        }

        btn.disabled = false;
        btn.textContent = 'Add Event';
    });
}

// ─── Forum (Firestore CRUD) ──────────────────────────────────────
function sanitizeHtml(html) {
    if (typeof DOMPurify !== 'undefined') return DOMPurify.sanitize(html);
    var div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script,iframe,object,embed,form').forEach(function(el) { el.remove(); });
    div.querySelectorAll('*').forEach(function(el) {
        Array.from(el.attributes).forEach(function(attr) {
            if (/^on/i.test(attr.name) || attr.name === 'href' && /^javascript:/i.test(attr.value)) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return div.innerHTML;
}
function isNewThread(createdAt) {
    if (!createdAt) return false;
    var threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return createdAt.toDate() > threeDaysAgo;
}

function renderThreadItem(doc, isAdmin, currentUserId) {
    var data = doc.data();
    var dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unknown';
    var canEdit   = isAdmin || (currentUserId && data.authorId === currentUserId);
    var canDelete = isAdmin || (currentUserId && data.authorId === currentUserId);
    var isNew = isNewThread(data.createdAt);

    // Reactions
    var votes = data.votes || {};
    var upCount   = Object.values(votes).filter(function(v) { return v === 'up'; }).length;
    var downCount = Object.values(votes).filter(function(v) { return v === 'down'; }).length;
    var myVote    = currentUserId ? (votes[currentUserId] || '') : '';
    var upCls     = myVote === 'up'   ? 'text-green-600 font-bold' : 'text-[#94A1B0] hover:text-green-600';
    var downCls   = myVote === 'down' ? 'text-red-500 font-bold'   : 'text-[#94A1B0] hover:text-red-500';

    var editBtn   = canEdit   ? '<button onclick="startEditThread(\'' + doc.id + '\')" class="text-[#94A1B0] hover:text-[#063559] text-xs transition-colors">Edit</button>' : '';
    var deleteBtn = canDelete ? '<button onclick="deleteThread(\'' + doc.id + '\')" class="text-red-400 hover:text-red-600 text-xs transition-colors">Delete</button>' : '';
    var newBadge  = isNew ? '<span class="badge badge-new">New</span>' : '';

    var actionBar =
        '<div class="flex items-center gap-3 mt-3 pt-2 border-t border-[#f1f5f9]">' +
        '<button onclick="toggleVote(\'' + doc.id + '\',\'up\')" class="flex items-center gap-1 text-xs ' + upCls + ' transition-colors">👍 <span id="up-' + doc.id + '">' + upCount + '</span></button>' +
        '<button onclick="toggleVote(\'' + doc.id + '\',\'down\')" class="flex items-center gap-1 text-xs ' + downCls + ' transition-colors">👎 <span id="dn-' + doc.id + '">' + downCount + '</span></button>' +
        '<span class="flex-1"></span>' +
        '<button onclick="toggleReplyPanel(\'' + doc.id + '\')" class="text-xs text-[#94A1B0] hover:text-[#063559] transition-colors">💬 Reply (<span id="rc-' + doc.id + '">' + (data.replyCount || 0) + '</span>)</button>' +
        (editBtn   ? '<span class="text-[#e2e8f0]">|</span>' + editBtn   : '') +
        (deleteBtn ? '<span class="text-[#e2e8f0]">|</span>' + deleteBtn : '') +
        '</div>';

    return '<div class="thread-card bg-white rounded-lg p-4 shadow-sm" data-id="' + doc.id + '">' +
        '<div class="flex justify-between items-start">' +
        '<h4 class="font-semibold text-[#063559]" id="ttl-' + doc.id + '">' + escapeHtml(data.title) + '</h4>' +
        newBadge +
        '</div>' +
        '<p class="text-[#7E8994] text-xs mt-1">Posted by ' + escapeHtml(data.authorName || 'Unknown') + ' &mdash; ' + dateStr + '</p>' +
        '<div class="forum-body mt-2 text-sm text-[#64748b]" id="bdy-' + doc.id + '">' + (data.body ? sanitizeHtml(data.body) : '') + '</div>' +
        actionBar +
        '<div id="edit-panel-' + doc.id + '" class="hidden mt-3"></div>' +
        '<div id="reply-panel-' + doc.id + '" class="hidden mt-3 border-t border-[#f1f5f9] pt-3"></div>' +
        '</div>';
}

async function loadThreads() {
    var list = document.getElementById('thread-list');
    if (!list) return;

    try {
        var snapshot = await db.collection('threads').orderBy('createdAt', 'desc').limit(50).get();
        var admin = isAdmin();
        var userId = currentUser ? currentUser.uid : null;

        if (snapshot.empty) {
            list.innerHTML = '<div class="text-center py-8 text-[#94A1B0]">No discussions yet. Start the first thread!</div>';
            return;
        }

        var html = '';
        snapshot.forEach(function(doc) {
            html += renderThreadItem(doc, admin, userId);
        });
        list.innerHTML = html;
    } catch (e) {
        console.error('Error loading threads:', e);
        list.innerHTML = '<div class="text-center py-8 text-red-500">Error loading discussions. Please refresh the page.</div>';
    }
}

async function addThread(title, body) {
    try {
        var auth = getAuth();
        await db.collection('threads').add({
            title: title,
            body: body,
            authorId: currentUser ? currentUser.uid : null,
            authorName: auth ? auth.name : 'Anonymous',
            replyCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e) {
        console.error('Error adding thread:', e);
        return { success: false, message: e.message };
    }
}

async function deleteThread(threadId) {
    if (!confirm('Are you sure you want to delete this thread?')) return;

    try {
        await db.collection('threads').doc(threadId).delete();
        var item = document.querySelector('.thread-card[data-id="' + threadId + '"]');
        if (item) item.remove();
    } catch (e) {
        console.error('Error deleting thread:', e);
        alert('Failed to delete thread. Please try again.');
    }
}

// ─── Reactions (thumbs up / down) ───────────────────────────────
async function toggleVote(threadId, type) {
    if (!currentUser) return;
    var uid = currentUser.uid;
    try {
        var ref = db.collection('threads').doc(threadId);
        var snap = await ref.get();
        var votes = snap.data().votes || {};
        if (votes[uid] === type) { delete votes[uid]; } else { votes[uid] = type; }
        await ref.update({ votes: votes });
        var upCount   = Object.values(votes).filter(function(v) { return v === 'up'; }).length;
        var downCount = Object.values(votes).filter(function(v) { return v === 'down'; }).length;
        var upEl = document.getElementById('up-' + threadId);
        var dnEl = document.getElementById('dn-' + threadId);
        if (upEl) upEl.textContent = upCount;
        if (dnEl) dnEl.textContent = downCount;
    } catch(e) { console.error('Vote error:', e); }
}

// ─── Replies ────────────────────────────────────────────────────
async function toggleReplyPanel(threadId) {
    var panel = document.getElementById('reply-panel-' + threadId);
    if (!panel) return;
    if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        delete window['replyQuill_' + threadId];
        return;
    }
    panel.classList.remove('hidden');
    panel.innerHTML = '<p class="text-xs text-[#94A1B0]">Loading…</p>';
    await loadReplies(threadId);
}

async function loadReplies(threadId) {
    var panel = document.getElementById('reply-panel-' + threadId);
    if (!panel) return;
    try {
        var snap = await db.collection('threads').doc(threadId).collection('replies').orderBy('createdAt', 'asc').get();
        var html = '<div class="space-y-2 mb-3">';
        if (snap.empty) {
            html += '<p class="text-xs text-[#94A1B0]">No replies yet — be the first!</p>';
        } else {
            snap.forEach(function(d) {
                var rd = d.data();
                var ds = rd.createdAt ? rd.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                html += '<div class="bg-[#f8fafc] rounded-lg p-3 border-l-2 border-[#F9812A]">' +
                    '<p class="text-xs text-[#94A1B0] mb-1 font-medium">' + escapeHtml(rd.authorName || 'Unknown') + ' &mdash; ' + ds + '</p>' +
                    '<div class="forum-body text-sm text-[#334155]">' + sanitizeHtml(rd.body || '') + '</div>' +
                    '</div>';
            });
        }
        html += '</div>' +
            '<div id="rqe-' + threadId + '" class="forum-editor"></div>' +
            '<div class="flex gap-2 mt-2">' +
            '<button onclick="submitReply(\'' + threadId + '\')" class="btn-primary px-3 py-1 rounded-lg text-xs font-semibold">Post Reply</button>' +
            '<button onclick="toggleReplyPanel(\'' + threadId + '\')" class="btn-secondary px-3 py-1 rounded-lg text-xs">Cancel</button>' +
            '</div>';
        panel.innerHTML = html;
        if (typeof Quill !== 'undefined') {
            window['replyQuill_' + threadId] = new Quill('#rqe-' + threadId, {
                theme: 'snow',
                modules: { toolbar: [['bold', 'italic'], ['clean']] },
                placeholder: 'Write a reply…'
            });
        }
    } catch(e) {
        panel.innerHTML = '<p class="text-xs text-red-500">Error loading replies.</p>';
    }
}

async function submitReply(threadId) {
    var quill = window['replyQuill_' + threadId];
    if (!quill || quill.getLength() <= 1) return;
    var body = quill.root.innerHTML;
    var auth = getAuth();
    try {
        await db.collection('threads').doc(threadId).collection('replies').add({
            body: body,
            authorId: currentUser ? currentUser.uid : null,
            authorName: auth ? auth.name : 'Anonymous',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('threads').doc(threadId).update({
            replyCount: firebase.firestore.FieldValue.increment(1)
        });
        var rcEl = document.getElementById('rc-' + threadId);
        if (rcEl) rcEl.textContent = parseInt(rcEl.textContent || '0') + 1;
        delete window['replyQuill_' + threadId];
        await loadReplies(threadId);
    } catch(e) {
        console.error('Reply error:', e);
        alert('Failed to post reply.');
    }
}

// ─── Edit thread ────────────────────────────────────────────────
function startEditThread(threadId) {
    var panel = document.getElementById('edit-panel-' + threadId);
    if (!panel) return;
    var titleEl = document.getElementById('ttl-' + threadId);
    var bodyEl  = document.getElementById('bdy-' + threadId);
    panel.innerHTML =
        '<input type="text" id="etl-' + threadId + '" class="form-input w-full border border-[#94A1B0] rounded-lg px-3 py-1.5 text-sm mb-2" placeholder="Title">' +
        '<div id="ebe-' + threadId + '" class="forum-editor mb-2"></div>' +
        '<div class="flex gap-2">' +
        '<button onclick="saveThreadEdit(\'' + threadId + '\')" class="btn-primary px-3 py-1 rounded-lg text-xs font-semibold">Save</button>' +
        '<button onclick="cancelEditThread(\'' + threadId + '\')" class="btn-secondary px-3 py-1 rounded-lg text-xs">Cancel</button>' +
        '</div>';
    panel.classList.remove('hidden');
    var inp = document.getElementById('etl-' + threadId);
    if (inp && titleEl) inp.value = titleEl.textContent;
    if (typeof Quill !== 'undefined') {
        var q = new Quill('#ebe-' + threadId, {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']] },
            placeholder: 'Edit your message…'
        });
        if (bodyEl) q.root.innerHTML = bodyEl.innerHTML;
        window['editQuill_' + threadId] = q;
    }
}

function cancelEditThread(threadId) {
    var panel = document.getElementById('edit-panel-' + threadId);
    if (panel) { panel.classList.add('hidden'); panel.innerHTML = ''; }
    delete window['editQuill_' + threadId];
}

async function saveThreadEdit(threadId) {
    var inp   = document.getElementById('etl-' + threadId);
    var quill = window['editQuill_' + threadId];
    if (!inp) return;
    var newTitle = inp.value.trim();
    if (!newTitle) return;
    var newBody = quill ? (quill.getLength() > 1 ? quill.root.innerHTML : '') : '';
    try {
        await db.collection('threads').doc(threadId).update({
            title: newTitle,
            body: newBody,
            editedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        var titleEl = document.getElementById('ttl-' + threadId);
        var bodyEl  = document.getElementById('bdy-' + threadId);
        if (titleEl) titleEl.textContent = newTitle;
        if (bodyEl)  bodyEl.innerHTML = sanitizeHtml(newBody);
        cancelEditThread(threadId);
    } catch(e) {
        console.error('Edit error:', e);
        alert('Failed to save changes.');
    }
}

function initForum() {
    // Load threads from Firestore
    loadThreads();

    // Handle new thread form
    var form = document.getElementById('new-thread-form');
    if (!form) return;

    // Initialize Quill rich text editor
    var quill = null;
    if (typeof Quill !== 'undefined' && document.getElementById('thread-body-editor')) {
        quill = new Quill('#thread-body-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['clean']
                ]
            },
            placeholder: 'Share your thoughts…'
        });
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var title = document.getElementById('thread-title').value.trim();
        var body = quill ? (quill.getLength() > 1 ? quill.root.innerHTML : '') : '';
        var btn = form.querySelector('button[type="submit"]');
        var success = document.getElementById('thread-success');
        var error = document.getElementById('thread-error');

        if (!title) return;

        btn.disabled = true;
        btn.textContent = 'Posting...';
        if (success) success.classList.add('hidden');
        if (error) error.classList.add('hidden');

        var result = await addThread(title, body);

        if (result.success) {
            if (success) success.classList.remove('hidden');
            form.reset();
            if (quill) quill.setContents([]);
            document.getElementById('new-thread-panel').classList.add('hidden');
            loadThreads(); // Refresh the list
            if (success) setTimeout(function() { success.classList.add('hidden'); }, 3000);
        } else {
            if (error) {
                error.textContent = result.message || 'Failed to post thread.';
                error.classList.remove('hidden');
            }
        }

        btn.disabled = false;
        btn.textContent = 'Post';
    });
}

// ─── Polls ───────────────────────────────────────────────────────
function renderPollItem(doc, isAdmin, currentUserId) {
    var data  = doc.data();
    var votes = data.votes || {};
    var myVote = currentUserId ? votes[currentUserId] : null;
    var hasVoted = myVote !== undefined && myVote !== null;
    var options = data.options || [];
    var totalVotes = Object.keys(votes).length;
    var dateStr = data.createdAt ? data.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var closed = data.closed || false;
    var showResults = hasVoted || closed;

    var optionsHtml = '';
    options.forEach(function(opt, i) {
        var count = Object.values(votes).filter(function(v) { return v === i; }).length;
        var pct   = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
        var isMyChoice = hasVoted && myVote === i;
        if (showResults) {
            optionsHtml +=
                '<div class="mb-2">' +
                '<div class="flex justify-between text-xs mb-0.5">' +
                '<span class="font-medium text-[#063559]' + (isMyChoice ? ' text-[#F9812A]' : '') + '">' +
                (isMyChoice ? '✓ ' : '') + escapeHtml(opt) + '</span>' +
                '<span class="text-[#7E8994]">' + count + ' vote' + (count !== 1 ? 's' : '') + ' · ' + pct + '%</span>' +
                '</div>' +
                '<div class="h-2 rounded-full bg-[#e2e8f0] overflow-hidden">' +
                '<div class="h-2 rounded-full transition-all duration-500' + (isMyChoice ? ' bg-[#F9812A]' : ' bg-[#063559]') + '" style="width:' + pct + '%"></div>' +
                '</div></div>';
        } else {
            optionsHtml +=
                '<button onclick="castVote(\'' + doc.id + '\',' + i + ')" ' +
                'class="w-full text-left px-4 py-2.5 rounded-lg border border-[#063559] bg-[#063559] hover:bg-[#0a4a7a] hover:border-[#F9812A] text-sm text-white transition-colors mb-2 font-medium">' +
                escapeHtml(opt) + '</button>';
        }
    });

    var statusBadge = closed
        ? '<span class="badge badge-pending ml-2">Closed</span>'
        : '<span class="badge badge-new ml-2">Open</span>';

    var adminBtns = isAdmin
        ? '<span class="text-[#e2e8f0]">|</span>' +
          (!closed ? '<button onclick="closePoll(\'' + doc.id + '\')" class="text-xs text-[#94A1B0] hover:text-[#063559] transition-colors">Close</button><span class="text-[#e2e8f0]">|</span>' : '') +
          '<button onclick="deletePoll(\'' + doc.id + '\')" class="text-xs text-red-400 hover:text-red-600 transition-colors">Delete</button>'
        : '';

    return '<div class="bg-white rounded-lg p-5 shadow-sm border-l-4 border-[#F9812A]" data-poll-id="' + doc.id + '">' +
        '<div class="flex items-start justify-between mb-1">' +
        '<h4 class="font-semibold text-[#063559] text-base">' + escapeHtml(data.question) + '</h4>' +
        statusBadge +
        '</div>' +
        '<p class="text-[#94A1B0] text-xs mb-4">By ' + escapeHtml(data.authorName || 'Admin') + ' &mdash; ' + dateStr +
        ' &middot; ' + totalVotes + ' vote' + (totalVotes !== 1 ? 's' : '') + '</p>' +
        '<div id="poll-opts-' + doc.id + '">' + optionsHtml + '</div>' +
        (showResults && !closed ? '<p class="text-xs text-[#94A1B0] mt-2">You voted. Results are live.</p>' : '') +
        '<div class="flex items-center gap-3 mt-3 pt-2 border-t border-[#f1f5f9]">' +
        '<span class="flex-1"></span>' + adminBtns +
        '</div>' +
        '</div>';
}

async function loadPolls() {
    var list = document.getElementById('poll-list');
    if (!list) return;
    try {
        var snap = await db.collection('polls').orderBy('createdAt', 'desc').limit(30).get();
        var admin  = isAdmin();
        var userId = currentUser ? currentUser.uid : null;
        if (snap.empty) {
            list.innerHTML = '<div class="text-center py-8 text-[#94A1B0]">No polls yet.</div>';
            return;
        }
        var html = '';
        snap.forEach(function(doc) { html += renderPollItem(doc, admin, userId); });
        list.innerHTML = html;
    } catch(e) {
        console.error('Load polls error:', e);
        list.innerHTML = '<div class="text-center py-8 text-red-500">Error loading polls. Please refresh.</div>';
    }
}

async function castVote(pollId, optionIndex) {
    if (!currentUser) return;
    try {
        var ref = db.collection('polls').doc(pollId);
        var snap = await ref.get();
        var votes = snap.data().votes || {};
        votes[currentUser.uid] = optionIndex;
        await ref.update({ votes: votes });
        var newSnap = await ref.get();
        var admin  = isAdmin();
        var card   = document.querySelector('[data-poll-id="' + pollId + '"]');
        if (card) card.outerHTML = renderPollItem(newSnap, admin, currentUser.uid);
    } catch(e) {
        console.error('Vote error:', e);
        alert('Failed to cast vote.');
    }
}

async function closePoll(pollId) {
    if (!confirm('Close this poll? Members will no longer be able to vote.')) return;
    try {
        await db.collection('polls').doc(pollId).update({ closed: true });
        loadPolls();
    } catch(e) { alert('Failed to close poll.'); }
}

async function deletePoll(pollId) {
    if (!confirm('Delete this poll permanently?')) return;
    try {
        await db.collection('polls').doc(pollId).delete();
        var card = document.querySelector('[data-poll-id="' + pollId + '"]');
        if (card) card.remove();
    } catch(e) { alert('Failed to delete poll.'); }
}

function addPollOption() {
    var list = document.getElementById('poll-options-list');
    var count = list.querySelectorAll('.poll-option').length + 1;
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'poll-option form-input w-full border border-[#94A1B0] rounded-lg px-3 py-2 text-sm';
    inp.placeholder = 'Option ' + count;
    list.appendChild(inp);
}

function initPolls() {
    loadPolls();
    var form = document.getElementById('new-poll-form');
    if (!form) return;
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var question = document.getElementById('poll-question').value.trim();
        var optEls   = document.querySelectorAll('.poll-option');
        var options  = Array.from(optEls).map(function(el) { return el.value.trim(); }).filter(Boolean);
        var errEl    = document.getElementById('poll-error');
        if (!question || options.length < 2) {
            if (errEl) { errEl.textContent = 'Enter a question and at least 2 options.'; errEl.classList.remove('hidden'); }
            return;
        }
        if (errEl) errEl.classList.add('hidden');
        var auth = getAuth();
        try {
            await db.collection('polls').add({
                question:   question,
                options:    options,
                votes:      {},
                closed:     false,
                authorId:   currentUser ? currentUser.uid : null,
                authorName: auth ? auth.name : 'Admin',
                createdAt:  firebase.firestore.FieldValue.serverTimestamp()
            });
            form.reset();
            document.querySelectorAll('.poll-option').forEach(function(el, i) { if (i >= 2) el.remove(); });
            document.getElementById('new-poll-panel').classList.add('hidden');
            loadPolls();
        } catch(e) {
            console.error('Create poll error:', e);
            if (errEl) { errEl.textContent = 'Failed to create poll.'; errEl.classList.remove('hidden'); }
        }
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
            display.classList.remove('text-[#94A1B0]');
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

// ─── QR Code (hover scale on desktop only; mobile unchanged) ───────
function initQRCode() {
    // QR scale on hover is handled by CSS (md:hover:scale-[1.3]). No JS needed.
}

// ─── Page View Tracking ──────────────────────────────────────────
function trackPageView() {
    if (typeof db === 'undefined') return;
    var page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    var update = { total: firebase.firestore.FieldValue.increment(1) };
    update['pages.' + page] = firebase.firestore.FieldValue.increment(1);
    db.collection('settings').doc('analytics').set(update, { merge: true })
        .catch(function(e) { console.warn('Analytics write failed:', e); });
}

// ─── Notification Preferences ────────────────────────────────────
var NOTIF_TOPICS = [
    { key: 'calendar', label: 'Calendar',  icon: '📅' },
    { key: 'videos',   label: 'Videos',    icon: '🎥' },
    { key: 'forum',    label: 'Forum',     icon: '💬' }
];

async function initNotificationSettings() {
    var container = document.getElementById('notif-settings');
    if (!container || !currentUser) return;

    try {
        var doc = await db.collection('members').doc(currentUser.uid).get();
        var prefs = (doc.exists && doc.data().notifications) || {};

        function isOn(key) {
            // Opt-out model: missing prefs or missing topic = subscribed
            if (!prefs.topics) return true;
            return prefs.topics[key] !== false;
        }

        container.innerHTML = NOTIF_TOPICS.map(function(t) {
            return '<label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg hover:bg-[#f0f4f8] transition-colors">' +
                '<input type="checkbox" class="notif-cb w-4 h-4 accent-[#F9812A]" data-topic="' + t.key + '"' + (isOn(t.key) ? ' checked' : '') + '>' +
                '<span class="text-sm text-[#334155]">' + t.icon + ' ' + t.label + '</span>' +
                '</label>';
        }).join('');

        container.querySelectorAll('.notif-cb').forEach(function(cb) {
            cb.addEventListener('change', saveNotificationSettings);
        });
    } catch (e) {
        console.error('Error loading notification settings:', e);
        container.innerHTML = '<p class="text-red-500 text-sm col-span-4">Could not load preferences.</p>';
    }
}

async function saveNotificationSettings() {
    if (!currentUser) return;
    var topics = {};
    document.querySelectorAll('.notif-cb').forEach(function(cb) {
        topics[cb.dataset.topic] = cb.checked;
    });
    try {
        await db.collection('members').doc(currentUser.uid).update({ 'notifications.topics': topics });
        var status = document.getElementById('notif-save-status');
        if (status) {
            status.classList.remove('hidden');
            setTimeout(function() { status.classList.add('hidden'); }, 2000);
        }
    } catch (e) {
        console.error('Error saving notification settings:', e);
    }
}

// ─── Init everything on DOMContentLoaded ─────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    initHamburger();
    initNav();
    if (authReadyPromise) authReadyPromise.then(function() { if (isAuth()) trackPageView(); });
    initRegForm();
    initLoginForm();
    initWeather();
    initCalendar();
    initSearch();
    initDocuments();
    initDocFilter();
    initVideos();
    initVideoFilter();
    initEvents();
    initForum();
    initGateCode();
    initQRCode();
});
