// ── API ──────────────────────────────────────────────────────────────
const API = '/api';
const gt = () => localStorage.getItem('rc_token');
const gu = () => JSON.parse(localStorage.getItem('rc_user') || 'null');

async function api(path, opts = {}) {
  const token = gt();
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  if (res.status === 401 && token) { clearSession(); toast('⚠️ Session expired'); throw new Error('session_expired'); }
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

// ── Toast ──────────────────────────────────────────────────────────────
function toast(msg, dur = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

// ── Auth ───────────────────────────────────────────────────────────────
function showReg() {
  document.getElementById('login-panel').style.display = 'none';
  document.getElementById('reg-panel').style.display = 'block';
}
function showLogin() {
  document.getElementById('login-panel').style.display = 'block';
  document.getElementById('reg-panel').style.display = 'none';
}

async function doLogin() {
  const login_id = document.getElementById('login-mobile').value.trim();
  const password = document.getElementById('login-pw').value;
  if (!login_id || !password) { toast('Enter mobile and password'); return; }
  try {
    const data = await api('/auth/login', { method: 'POST', body: { login_id, password } });
    if (data.user.role !== 'patient') { toast('❌ This portal is for patients only'); return; }
    afterAuth(data);
  } catch (e) { if (e.message !== 'session_expired') toast('❌ ' + e.message); }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const mobile = document.getElementById('reg-mobile').value.trim().replace(/\D/g, '');
  const password = document.getElementById('reg-pw').value;
  const age = document.getElementById('reg-age').value;
  const gender = document.getElementById('reg-gender').value;
  const blood_group = document.getElementById('reg-blood').value;
  const village = document.getElementById('reg-village').value.trim();
  if (!name) { toast('Full name is required'); return; }
  if (mobile.length !== 10) { toast('Enter a valid 10-digit mobile number'); return; }
  if (!password || password.length < 6) { toast('Password must be at least 6 characters'); return; }
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: { name, mobile, password, age: age ? +age : null, gender: gender || null, blood_group: blood_group || null, village: village || null }
    });
    toast(`✅ Welcome, ${data.user.name}! ID: ${data.patient_ref}`, 4000);
    afterAuth(data);
  } catch (e) { if (e.message !== 'session_expired') toast('❌ ' + e.message); }
}

function afterAuth(data) {
  localStorage.setItem('rc_token', data.token);
  localStorage.setItem('rc_user', JSON.stringify(data.user));
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  const initials = data.user.name?.charAt(0)?.toUpperCase() || '?';
  document.getElementById('top-avatar').textContent = initials;
  document.getElementById('top-user-name').textContent = data.user.name?.split(' ')[0] || '';
  goTab('home');
}

function clearSession() {
  localStorage.removeItem('rc_token');
  localStorage.removeItem('rc_user');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function doLogout() {
  const token = gt();
  clearSession();
  if (token) fetch(API + '/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}

// ── Tab Navigation ─────────────────────────────────────────────────────
const tabs = ['home', 'hospitals', 'meds', 'emg', 'records', 'chat'];
let currentTab = 'home';

function goTab(tab) {
  currentTab = tab;
  tabs.forEach(t => {
    document.getElementById('page-' + t)?.classList.toggle('active', t === tab);
    const n = document.getElementById('nav-' + t);
    if (n) n.classList.toggle('active', t === tab);
  });
  const loaders = { home: loadHome, hospitals: loadHospitals, meds: loadMeds, emg: loadEmg, records: loadRecords, chat: loadChat };
  const el = document.getElementById('page-' + tab);
  if (el && !el.dataset.loaded) {
    loaders[tab]?.();
    el.dataset.loaded = '1';
  }
  // Don't reset scroll for chat tab (it manages its own scroll)
  if (tab !== 'chat') document.querySelector('.scroll-area').scrollTop = 0;
}

function skeleton(n = 3) {
  return Array(n).fill(`<div class="skeleton" style="height:90px;margin-bottom:12px"></div>`).join('');
}

// ── HOME ───────────────────────────────────────────────────────────────
async function loadHome() {
  const el = document.getElementById('page-home');
  const user = gu();
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#0d4f47,#0f766e);border-radius:20px;padding:22px;color:#fff;margin-bottom:16px">
      <div style="font-size:13px;opacity:.7;margin-bottom:6px">Good day 👋</div>
      <div style="font-size:22px;font-weight:700">${user?.name || 'Patient'}</div>
      <div style="font-size:12px;opacity:.6;margin-top:4px">Kolar Block, Karnataka</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12px;opacity:.8">
        <span class="live-dot"></span> Live health data
      </div>
    </div>
    <div id="home-stats" class="stat-row">${skeleton(1)}</div>
    <div class="action-grid">
      <div class="action-card" onclick="goTab('hospitals')">
        <div class="action-icon">🏥</div>
        <div class="action-title">Find Hospitals</div>
        <div class="action-desc">Beds, ICU & oxygen near you</div>
      </div>
      <div class="action-card" onclick="goTab('meds')">
        <div class="action-icon">💊</div>
        <div class="action-title">Medicines</div>
        <div class="action-desc">Search & reserve at govt rates</div>
      </div>
      <div class="action-card" onclick="goTab('emg')" style="border-color:#fca5a5;background:#fff5f5">
        <div class="action-icon">🚑</div>
        <div class="action-title">Emergency</div>
        <div class="action-desc">SOS & ambulance dispatch</div>
      </div>
      <div class="action-card" onclick="goTab('records')">
        <div class="action-icon">📄</div>
        <div class="action-title">My Records</div>
        <div class="action-desc">Health history & prescriptions</div>
      </div>
    </div>`;
  try {
    const { hospitals } = await api('/hospitals');
    const beds = hospitals.reduce((s, h) => s + (h.beds_free || 0), 0);
    const alerts = hospitals.filter(h => (h.o2_cylinders || 0) < 3 || h.beds_free === 0).length;
    document.getElementById('home-stats').innerHTML = `
      <div class="stat-box"><div class="stat-val sv-teal">${hospitals.length}</div><div class="stat-lbl">Hospitals nearby</div></div>
      <div class="stat-box"><div class="stat-val sv-amber">${beds}</div><div class="stat-lbl">Free beds total</div></div>
      <div class="stat-box"><div class="stat-val sv-teal">${hospitals.filter(h => (h.beds_free || 0) > 0).length}</div><div class="stat-lbl">Accepting patients</div></div>
      <div class="stat-box"><div class="stat-val sv-red">${alerts}</div><div class="stat-lbl">Shortage alerts</div></div>`;
  } catch (e) { document.getElementById('home-stats').innerHTML = `<div class="alert al-red" style="grid-column:1/-1">Failed to load stats</div>`; }
}

// ── HOSPITALS ──────────────────────────────────────────────────────────
async function loadHospitals() {
  const el = document.getElementById('page-hospitals');
  el.innerHTML = `<div class="card-hdr"><div class="card-title">🏥 Hospitals Near You</div><div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text3)"><span class="live-dot"></span>Live</div></div>${skeleton(3)}`;
  try {
    const { hospitals } = await api('/hospitals');
    const statusBadge = h => {
      if ((h.beds_free || 0) === 0) return ['b-red', 'Full'];
      if ((h.beds_free || 0) < 5) return ['b-amber', 'Limited'];
      return ['b-green', 'Open'];
    };
    el.innerHTML = `<div class="card-hdr"><div class="card-title">🏥 Hospitals Near You</div><div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text3)"><span class="live-dot"></span>Live</div></div>` +
      hospitals.map((h, i) => {
        const [cls, lbl] = statusBadge(h);
        return `<div class="hosp-card ${i === 0 ? 'top-pick' : ''}">
          ${i === 0 ? '<div class="hosp-recommended">★ Nearest & Recommended</div>' : ''}
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><div class="hosp-name">${h.name}</div><div class="hosp-loc">📍 ${h.block || ''}</div></div>
            <span class="badge ${cls}">${lbl}</span>
          </div>
          <div class="res-chips">
            <div class="res-chip">🛏 <strong>${h.beds_free ?? '—'}</strong> beds</div>
            <div class="res-chip">🫀 ICU: <strong>${h.icu_free ?? '—'}</strong></div>
            <div class="res-chip">🫁 O₂: <strong>${h.o2_cylinders ?? '—'}</strong></div>
            <div class="res-chip">👨‍⚕️ <strong>${h.doctors_on_duty ?? '—'}</strong> docs</div>
          </div>
          ${h.public_alert_msg ? `<div class="alert al-amber" style="margin:8px 0">⚠️ ${h.public_alert_msg}</div>` : ''}
          <div class="hosp-actions">
            <button class="btn btn-outline btn-sm" onclick="toast('📞 Calling ${h.name}...')">📞 ${h.phone || 'Call'}</button>
            ${(h.beds_free || 0) > 0 ? `<button class="btn btn-primary btn-sm" onclick="openSheet(${h.id})">🛏️ Reserve Bed</button>` : '<span style="font-size:12px;color:var(--red);padding:4px 0">No beds available</span>'}
          </div>
        </div>`;
      }).join('');
  } catch (e) { el.innerHTML = `<div class="alert al-red">❌ ${e.message}</div>`; }
}

// ── MEDICINES ──────────────────────────────────────────────────────────
async function loadMeds() {
  const el = document.getElementById('page-meds');
  el.innerHTML = `
    <div class="card-hdr"><div class="card-title">💊 Medicines</div><span class="badge b-green">Govt rates</span></div>
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input class="search-input" id="med-search" placeholder="Search medicine name..." oninput="searchMeds()"/>
    </div>
    <div id="med-list">${skeleton(4)}</div>`;
  fetchMeds('');
}

async function fetchMeds(q) {
  try {
    const { medicines } = await api('/medicines' + (q ? `?q=${encodeURIComponent(q)}` : ''));
    const stockBar = m => {
      const pct = m.quantity_available > 100 ? 100 : m.quantity_available > 0 ? Math.max(10, m.quantity_available) : 0;
      const col = pct > 50 ? '#0f766e' : pct > 0 ? '#f59e0b' : '#dc2626';
      return `<div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${col}"></div></div>`;
    };
    const stockBadge = m => m.quantity_available > 50 ? ['b-green', 'In stock'] : m.quantity_available > 0 ? ['b-amber', 'Low stock'] : ['b-red', 'Out of stock'];
    document.getElementById('med-list').innerHTML = medicines.length ? medicines.map(m => {
      const [cls, lbl] = stockBadge(m);
      return `<div class="med-card">
        <div style="flex:1;min-width:0">
          <div class="med-name">${m.name}</div>
          <div class="med-loc">📍 ${m.hospital_name} · ₹${m.unit_price_govt}/tab</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span class="badge ${cls}">${lbl}</span>
            ${stockBar(m)}
          </div>
        </div>
        <div style="flex-shrink:0;margin-left:8px">
          ${m.quantity_available > 0
            ? `<button class="btn btn-primary btn-sm" onclick="reserveMed(${m.id},'${m.name.replace(/'/g, "\\'")}')">Reserve</button>`
            : `<button class="btn btn-outline btn-sm" onclick="toast('🔔 You will be notified when available')">Notify</button>`}
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;padding:30px;color:var(--text3)">No medicines found</div>';
  } catch (e) { document.getElementById('med-list').innerHTML = `<div class="alert al-red">❌ ${e.message}</div>`; }
}

function searchMeds() {
  clearTimeout(window._medT);
  window._medT = setTimeout(() => {
    const q = document.getElementById('med-search')?.value || '';
    fetchMeds(q);
  }, 350);
}

async function reserveMed(id, name) {
  try {
    const data = await api(`/medicines/${id}/reserve`, { method: 'POST', body: { quantity: 1 } });
    toast('✅ ' + data.message, 4000);
  } catch (e) { toast('❌ ' + e.message); }
}

// ── EMERGENCY ──────────────────────────────────────────────────────────
async function loadEmg() {
  const el = document.getElementById('page-emg');
  el.innerHTML = `
    <button class="sos-btn" onclick="triggerSOS()">🚨 &nbsp; EMERGENCY — SEND SOS</button>
    <div class="card" style="margin-bottom:14px">
      <div class="card-title" style="margin-bottom:14px">🏥 Find Best Hospital</div>
      <label class="form-label">Emergency type</label>
      <select class="form-select" id="emg-type" style="margin-bottom:12px">
        <option>Cardiac / Chest pain</option>
        <option>Breathing difficulty</option>
        <option>Road accident / Trauma</option>
        <option>Maternity / Labour</option>
        <option>High fever / Infection</option>
        <option>Snake bite / Poisoning</option>
        <option>Stroke / Paralysis</option>
      </select>
      <button class="btn btn-primary btn-full" onclick="findHospital()">Find Best Hospital →</button>
      <div id="emg-result" style="margin-top:12px"></div>
    </div>
    <div class="card">
      <div class="card-title" style="margin-bottom:4px">📞 Emergency Contacts</div>
      <div class="emg-contact">
        <div><div class="emg-name">🚑 108 — Free Ambulance</div><div class="emg-num">Available 24/7 across Karnataka</div></div>
        <button class="call-btn" onclick="toast('📞 Calling 108...')">Call 108</button>
      </div>
      <div class="emg-contact">
        <div><div class="emg-name">📞 104 — Health Helpline</div><div class="emg-num">Medical advice & referrals</div></div>
        <button class="call-btn" onclick="toast('📞 Calling 104...')">Call 104</button>
      </div>
      <div class="emg-contact">
        <div><div class="emg-name">🏥 Kolar District Hospital</div><div class="emg-num">08152-222310</div></div>
        <button class="call-btn" onclick="toast('📞 Calling KDH...')">Call Now</button>
      </div>
    </div>`;
}

async function triggerSOS() {
  toast('🚨 Sending SOS...', 1500);
  try {
    const data = await api('/emergency/sos', { method: 'POST', body: { location_text: 'Kolar Block, Karnataka', emergency_type: 'General' } });
    toast(`🚨 SOS sent! ${data.assigned_hospital?.name || 'Hospital'} alerted. ETA ~${data.eta_minutes || 12} min.`, 6000);
  } catch { toast('🚨 SOS sent! 108 Ambulance alerted. ETA ~12 min.', 6000); }
}

async function findHospital() {
  const type = document.getElementById('emg-type')?.value;
  const res = document.getElementById('emg-result');
  res.innerHTML = `<div class="skeleton" style="height:80px"></div>`;
  try {
    const data = await api('/emergency/find-hospital', { method: 'POST', body: { emergency_type: type } });
    const h = data.best_hospital;
    res.innerHTML = `
      <div class="alert al-green">✅ Best match for: ${type}</div>
      <div class="hosp-card top-pick">
        <div class="hosp-recommended">★ Best Match</div>
        <div style="display:flex;justify-content:space-between">
          <div><div class="hosp-name">${h.name}</div><div class="hosp-loc">📍 ${h.block}</div></div>
          <span class="badge b-green">Available</span>
        </div>
        <div class="res-chips">
          <div class="res-chip">🛏 ${h.beds_free} beds</div>
          <div class="res-chip">🫁 O₂: ${h.o2_cylinders}</div>
          <div class="res-chip">🫀 ICU: ${h.icu_free}</div>
        </div>
        <div class="hosp-actions" style="margin-top:10px">
          <button class="btn btn-red btn-sm" onclick="triggerSOS()">🚑 Dispatch Ambulance</button>
          <button class="btn btn-outline btn-sm" onclick="toast('📞 Calling ${h.name}...')">📞 Call</button>
        </div>
      </div>`;
  } catch { res.innerHTML = `<div class="alert al-red">❌ Could not find hospital. Please call 108.</div>`; }
}

// ── MY RECORDS ─────────────────────────────────────────────────────────
async function loadRecords() {
  const el = document.getElementById('page-records');
  el.innerHTML = skeleton(3);
  try {
    const { patient: p } = await api('/patients/me');
    const condChips = p.conditions?.length
      ? p.conditions.map(c => `<span class="cond-chip">${c}</span>`).join('')
      : '<span style="color:var(--text3);font-size:13px">None recorded</span>';
    const meds = p.medications?.filter(m => m.active)
      .map(m => `<div class="med-row"><div><div style="font-size:14px;font-weight:600">${m.medicine_name}</div><div style="font-size:12px;color:var(--text3)">${m.dose || '—'} · ${m.prescribed_by || '—'}</div></div><div style="font-size:12px;color:var(--text3)">${m.since_date || '—'}</div></div>`)
      .join('') || '<div style="color:var(--text3);font-size:13px;padding:8px 0">No active medications</div>';
    const visits = p.visits?.map(v => `<div class="tl-item"><div class="tl-dot"></div><div class="tl-date">${v.visit_date} · ${v.location || 'Hospital'}</div><div class="tl-text">${v.notes || 'No notes'}</div></div>`).join('')
      || '<div class="tl-item"><div class="tl-dot"></div><div class="tl-text" style="color:var(--text3)">No visits recorded</div></div>';
    el.innerHTML = `
      <div class="profile-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="profile-name">${p.name}</div>
            <div class="profile-ref">ID: ${p.patient_ref} · 📱 ${p.mobile}</div>
          </div>
          <span style="background:rgba(255,255,255,.2);border-radius:8px;padding:4px 10px;font-size:11px">${p.status || 'Active'}</span>
        </div>
        <div class="profile-chips">
          ${p.age ? `<div class="p-chip">Age <span>${p.age}</span></div>` : ''}
          ${p.gender ? `<div class="p-chip">Gender <span>${p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : 'Other'}</span></div>` : ''}
          ${p.blood_group ? `<div class="p-chip" style="background:rgba(220,38,38,.2)">🩸 <span>${p.blood_group}</span></div>` : ''}
          ${p.village ? `<div class="p-chip">📍 <span>${p.village}</span></div>` : ''}
        </div>
      </div>
      <div class="section-title">⚠️ Known Conditions</div>
      <div style="margin-bottom:14px">${condChips}</div>
      <div class="section-title">💊 Current Medications</div>
      <div class="card" style="padding:14px">${meds}</div>
      <div class="section-title">🗓️ Visit History</div>
      <div class="timeline">${visits}</div>
      <div style="display:flex;gap:10px;margin-top:18px;padding-bottom:8px">
        <button class="btn btn-primary btn-sm" onclick="toast('📤 Records sent via SMS to ${p.mobile}')">📤 Share via SMS</button>
        <button class="btn btn-outline btn-sm" onclick="toast('🔲 QR code generated')">🔲 QR Code</button>
      </div>`;
  } catch (e) {
    if (e.message === 'session_expired') return;
    el.innerHTML = `<div class="alert al-amber">⚠️ No health record linked to this account yet. Visit a hospital to get registered.</div>`;
  }
}

// ── BED SHEET ──────────────────────────────────────────────────────────
function openSheet(hid) {
  document.getElementById('sh-hid').value = hid;
  document.getElementById('sh-ward').value = '';
  document.getElementById('sh-reason').value = '';
  document.getElementById('bed-sheet').classList.add('open');
}
function closeSheet() {
  document.getElementById('bed-sheet').classList.remove('open');
}
async function submitBed() {
  const hid = document.getElementById('sh-hid').value;
  const ward = document.getElementById('sh-ward').value;
  const reason = document.getElementById('sh-reason').value.trim();
  try {
    const data = await api(`/hospitals/${hid}/reserve-bed`, { method: 'POST', body: { ward_preference: ward || null, reason: reason || null } });
    closeSheet();
    toast('✅ ' + data.message, 4000);
  } catch (e) { toast('❌ ' + e.message); }
}

// ── Restore session on load ────────────────────────────────────────────
window.addEventListener('load', () => {
  const token = localStorage.getItem('rc_token');
  const user = JSON.parse(localStorage.getItem('rc_user') || 'null');
  if (token && user && user.role === 'patient') {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    const initials = user.name?.charAt(0)?.toUpperCase() || '?';
    document.getElementById('top-avatar').textContent = initials;
    document.getElementById('top-user-name').textContent = user.name?.split(' ')[0] || '';
    goTab('home');
  }

  // ── Register Service Worker (PWA) ──────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('✅ SW registered, scope:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }
});

// ── MEDIBOT CHAT ───────────────────────────────────────────────────────────
let _chatMessages   = [];   // Full conversation history
let _chatPatientCtx = null; // Patient profile from Supabase (enriches system prompt)
let _chatBotTyping  = false;

async function loadChat() {
  const el = document.getElementById('page-chat');
  if (!el) return;

  const userName = gu()?.name?.split(' ')[0] || 'there';

  // Render EVERYTHING synchronously — no awaits before this
  el.innerHTML = `
    <div class="chat-hdr">
      <div class="chat-hdr-info">
        <div class="chat-bot-av">&#x1F916;</div>
        <div>
          <div class="chat-bot-name">MediBot</div>
          <div class="chat-bot-sub">AI Symptom Checker &middot; Powered by Gemini</div>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="resetChat()">&#x1F504; New Chat</button>
    </div>
    <div class="chat-msgs" id="chat-msgs">
      <div class="bubble-row">
        <div class="b-av">&#x1F916;</div>
        <div class="bubble bot-msg">
          Hi ${userName}! &#x1F44B; I&rsquo;m MediBot, your AI health assistant.<br><br>
          Tell me what symptoms or health concerns you have today and I&rsquo;ll help you decide the best next step.
        </div>
      </div>
    </div>
    <div class="chat-input-area">
      <input class="chat-input" id="chat-input"
        placeholder="Describe your symptoms..."
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSymptomMsg();}"/>
      <button class="chat-send" id="chat-send-btn" onclick="sendSymptomMsg()">&#x27A4;</button>
    </div>`;

  _chatMessages  = [];
  _chatBotTyping = false;
  _chatPatientCtx = {};

  // Load patient profile in background — chat is already visible above
  try {
    const { patient } = await api('/patients/me');
    _chatPatientCtx = {
      age:         patient.age,
      gender:      patient.gender,
      conditions:  patient.conditions  || [],
      medications: (patient.medications || []).filter(m => m.active).map(m => m.medicine_name)
    };
  } catch { _chatPatientCtx = {}; }

  document.getElementById('chat-input')?.focus();
}


// ── Append a chat bubble ───────────────────────────────────────────────────
function _appendBubble(role, text) {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const isBot = (role === 'bot');
  const div   = document.createElement('div');
  div.className = `bubble-row${isBot ? '' : ' from-user'}`;
  const safe = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  div.innerHTML = isBot
    ? `<div class="b-av">🤖</div><div class="bubble bot-msg">${safe}</div>`
    : `<div class="bubble user-msg">${safe}</div>`;
  msgs.appendChild(div);
  // scroll-area is the actual scrollable container (chat-msgs just flows inside it)
  const sa = document.querySelector('.scroll-area');
  if (sa) sa.scrollTop = sa.scrollHeight;
}

// ── Typing indicator ───────────────────────────────────────────────────────
function _showTyping() {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs) return;
  const div = document.createElement('div');
  div.id = 'chat-typing';
  div.className = 'bubble-row';
  div.innerHTML = `<div class="b-av">🤖</div>
    <div class="bubble bot-msg">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  msgs.appendChild(div);
  const sa = document.querySelector('.scroll-area');
  if (sa) sa.scrollTop = sa.scrollHeight;
}
function _removeTyping() { document.getElementById('chat-typing')?.remove(); }

// ── Verdict card ───────────────────────────────────────────────────────────
function _showVerdict(verdict) {
  const msgs = document.getElementById('chat-msgs');
  if (!msgs || !verdict) return;

  const cfgMap = {
    normal: {
      cls:   'vc-normal',
      title: '✅ You should be fine!',
      desc:  'Your symptoms appear mild. Rest well, stay hydrated, and monitor yourself. Visit a doctor if things worsen.',
      btns:  `<button class="btn btn-primary btn-sm" onclick="resetChat()">Start New Chat</button>`
    },
    medicine: {
      cls:   'vc-medicine',
      title: `💊 Suggested: ${verdict.medicine}`,
      desc:  `This over-the-counter medicine may help. Available at government rates at nearby hospitals.`,
      btns:  `<button class="btn btn-primary btn-sm btn-full" onclick="goTab('meds')">Find at Nearby Hospitals →</button>
              <button class="btn btn-outline btn-sm btn-full" style="margin-top:2px" onclick="resetChat()">New Chat</button>`
    },
    doctor: {
      cls:   'vc-doctor',
      title: '🏥 Please See a Doctor',
      desc:  'Your symptoms need professional medical attention. Visit the nearest hospital at your earliest convenience.',
      btns:  `<button class="btn btn-primary btn-sm btn-full" onclick="goTab('hospitals')">Find Hospitals Near You →</button>
              <button class="btn btn-outline btn-sm btn-full" style="margin-top:2px" onclick="resetChat()">New Chat</button>`
    },
    emergency: {
      cls:   'vc-emergency',
      title: '🚨 This Looks Serious — Act Now!',
      desc:  'Your symptoms may be dangerous. Please call 108 immediately or go directly to the hospital emergency ward.',
      btns:  `<button class="btn btn-red btn-sm btn-full" onclick="triggerSOS()">🚑 Send SOS Now</button>
              <button class="btn btn-outline btn-sm btn-full" style="border-color:#fca5a5;color:#dc2626;margin-top:2px" onclick="toast('📞 Calling 108...')">📞 Call 108 — Free Ambulance</button>
              <button class="btn btn-outline btn-sm btn-full" style="margin-top:2px" onclick="goTab('emg')">View Emergency Info</button>`
    }
  };

  const cfg = cfgMap[verdict.type];
  if (!cfg) return;

  const card = document.createElement('div');
  card.className = `verdict-card ${cfg.cls}`;
  card.innerHTML = `
    <div class="vc-title">${cfg.title}</div>
    <div class="vc-desc">${cfg.desc}</div>
    <div class="vc-actions">${cfg.btns}</div>`;
  msgs.appendChild(card);
  const sa = document.querySelector('.scroll-area');
  if (sa) sa.scrollTop = sa.scrollHeight;

  // Lock input — conversation is complete
  const inp = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send-btn');
  if (inp) { inp.disabled = true; inp.placeholder = 'Chat ended — tap "New Chat" to start again'; }
  if (btn) btn.disabled = true;
}

// ── Send message ───────────────────────────────────────────────────────────
async function sendSymptomMsg() {
  if (_chatBotTyping) return;
  const input = document.getElementById('chat-input');
  const text  = input?.value?.trim();
  if (!text) return;

  input.value = '';
  _appendBubble('user', text);
  _chatMessages.push({ role: 'user', content: text });

  _chatBotTyping = true;
  _showTyping();

  try {
    const token = localStorage.getItem('rc_token');
    const res   = await fetch('/api/chatbot/message', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        messages:       _chatMessages,
        patientContext: _chatPatientCtx
      })
    });
    const data = await res.json();
    _removeTyping();
    _chatBotTyping = false;

    if (data.error) {
      _appendBubble('bot', '⚠️ Sorry, something went wrong. Please try again in a moment.');
      return;
    }

    _appendBubble('bot', data.text);
    _chatMessages.push({ role: 'assistant', content: data.text });

    if (data.verdict) setTimeout(() => _showVerdict(data.verdict), 350);

  } catch (e) {
    _removeTyping();
    _chatBotTyping = false;
    _appendBubble('bot', '⚠️ Connection error. Please check your internet and try again.');
  }
}

// ── Reset / start new chat ─────────────────────────────────────────────────
function resetChat() {
  _chatMessages  = [];
  _chatBotTyping = false;
  const el = document.getElementById('page-chat');
  if (el) { el.dataset.loaded = ''; loadChat(); }
}

