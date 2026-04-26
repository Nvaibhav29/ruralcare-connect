// ── API helpers ───────────────────────────────────────────────────────────────
const API = '/api';
const getToken = () => localStorage.getItem('rc_token');
const setToken = t => localStorage.setItem('rc_token', t);
const getUser  = () => JSON.parse(localStorage.getItem('rc_user') || 'null');
const setUser  = u => localStorage.setItem('rc_user', JSON.stringify(u));

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json();
  // Use _clearSession (not doLogout) to avoid recursive loop if the
  // logout API itself returns 401.
  if (res.status === 401) { _clearSession(); throw new Error('Session expired — please sign in again'); }
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

// ── Synchronous session clear (no async, no API call) ─────────────────────────
function _clearSession() {
  localStorage.removeItem('rc_token');
  localStorage.removeItem('rc_user');
  currentRole = null;
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
  showLoginForm();
}

// ── Auth — Login ──────────────────────────────────────────────────────────────
async function doLogin() {
  const login_id = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-pw').value;
  if (!currentRole) { toast('Please select a role first'); return; }
  if (!login_id || !password) { toast('Enter your ID and password'); return; }
  try {
    const data = await apiFetch('/auth/login', { method:'POST', body:{ login_id, password } });
    _afterAuth(data);
  } catch(e) { toast('❌ ' + e.message); }
}

// ── Auth — Register (patients only) ──────────────────────────────────────────
async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const mobile   = document.getElementById('reg-mobile').value.trim();
  const password = document.getElementById('reg-pw').value;
  const age      = document.getElementById('reg-age').value;
  const gender   = document.getElementById('reg-gender').value;
  const blood_group = document.getElementById('reg-blood').value;
  const village  = document.getElementById('reg-village').value.trim();

  if (!name)     { toast('Full name is required'); return; }
  if (!mobile || mobile.replace(/\D/g,'').length !== 10) { toast('Enter a valid 10-digit mobile number'); return; }
  if (!password || password.length < 6) { toast('Password must be at least 6 characters'); return; }

  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: { name, mobile: mobile.replace(/\D/g,''), password, age: age ? +age : null, gender: gender||null, blood_group: blood_group||null, village: village||null }
    });
    toast(`✅ Account created! Welcome, ${data.user.name}. Your ID: ${data.patient_ref}`);
    _afterAuth(data);
  } catch(e) { toast('❌ ' + e.message); }
}

// ── Shared post-auth handler ──────────────────────────────────────────────────
function _afterAuth(data) {
  setToken(data.token);
  setUser(data.user);
  currentRole = data.user.role;
  document.getElementById('login-screen').style.display = 'none';
  const app = document.getElementById('app-screen');
  app.style.display = 'block';
  document.getElementById('role-badge').textContent = roleNames[currentRole];
  document.getElementById('user-display').textContent = data.user.name;
  renderNav(); renderTab(0);
}

async function doLogout() {
  // 1. Capture token before clearing (needed for the API call header)
  const token = getToken();
  // 2. Clear UI + state IMMEDIATELY — no await, no race condition
  _clearSession();
  // 3. Fire-and-forget the server-side logout (audit log only, non-blocking)
  if (token) {
    fetch(API + '/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
}

// ── Tab rendering ─────────────────────────────────────────────────────────────
async function renderTab(i) {
  document.querySelectorAll('.nav-tab').forEach((t,j) => t.classList.toggle('active', j===i));
  const content = document.getElementById('main-content');
  content.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">⏳ Loading...</div>';
  const tab = tabsForRole[currentRole][i];
  try {
    const html = await getPage(tab.id);
    content.innerHTML = html;
    if (typeof postRender === 'function') postRender(tab.id);
  } catch(e) {
    content.innerHTML = `<div class="card"><div class="alert al-red">❌ Failed to load: ${e.message}</div></div>`;
  }
}

// ── Page: Home ────────────────────────────────────────────────────────────────
async function pageHome() {
  const { hospitals } = await apiFetch('/hospitals');
  const totalBeds = hospitals.reduce((s,h) => s + (h.beds_free||0), 0);
  const criticals = hospitals.filter(h => (h.o2_cylinders||0) < 3 || (h.beds_free||0) === 0);
  return `
<div class="alert al-amber">⚠️ <strong>Shortage alert:</strong> PHC Malur — Oxygen cylinders critically low. Notified to district.</div>
<div class="card">
  <div class="card-header">
    <div><div class="card-title">👋 Welcome, ${getUser()?.name||'Patient'}</div><div class="card-subtitle">📍 Kolar Block, Karnataka</div></div>
    <div class="last-updated"><span class="live-dot"></span> Live data</div>
  </div>
  <div class="stat-grid">
    <div class="stat-card sc-green"><div class="stat-val">${hospitals.length}</div><div class="stat-label">Hospitals nearby</div></div>
    <div class="stat-card sc-amber"><div class="stat-val">${totalBeds}</div><div class="stat-label">Free beds total</div></div>
    <div class="stat-card sc-green"><div class="stat-val">${hospitals.filter(h=>(h.beds_free||0)>0).length}</div><div class="stat-label">Hospitals with beds</div></div>
    <div class="stat-card sc-red"><div class="stat-val">${criticals.length}</div><div class="stat-label">Shortage alerts</div></div>
  </div>
</div>
<div class="two-col">
  <div class="card" style="cursor:pointer" onclick="renderTab(1)">
    <div class="card-title" style="margin-bottom:8px">🏥 Hospital Beds &amp; Resources</div>
    <div style="font-size:11.5px;color:var(--text3);line-height:1.6">Real-time bed, ICU &amp; oxygen availability at nearby government hospitals.</div>
    <div style="margin-top:10px"><span class="badge b-green">${hospitals.length} hospitals →</span></div>
  </div>
  <div class="card" style="cursor:pointer" onclick="renderTab(2)">
    <div class="card-title" style="margin-bottom:8px">💊 Medicine Search</div>
    <div style="font-size:11.5px;color:var(--text3);line-height:1.6">Find medicines at nearby pharmacies and government dispensaries.</div>
    <div style="margin-top:10px"><span class="badge b-blue">Search &amp; reserve →</span></div>
  </div>
  <div class="card" style="cursor:pointer" onclick="renderTab(3)">
    <div class="card-title" style="margin-bottom:8px">🚑 Emergency Referral</div>
    <div style="font-size:11.5px;color:var(--text3);line-height:1.6">Find nearest hospital for your emergency. One-tap ambulance call.</div>
    <div style="margin-top:10px"><span class="badge b-red">SOS / Referral →</span></div>
  </div>
  <div class="card" style="cursor:pointer" onclick="renderTab(4)">
    <div class="card-title" style="margin-bottom:8px">📄 My Health Records</div>
    <div style="font-size:11.5px;color:var(--text3);line-height:1.6">Your prescriptions, visit history and conditions.</div>
    <div style="margin-top:10px"><span class="badge b-gray">View records →</span></div>
  </div>
</div>`;
}

// ── Page: Hospitals (Beds) ────────────────────────────────────────────────────
async function pageBeds() {
  const { hospitals } = await apiFetch('/hospitals');
  const statusBadge = h => {
    if ((h.beds_free||0) === 0) return ['b-red','Full/Critical'];
    if ((h.beds_free||0) < 5)  return ['b-amber','Limited'];
    return ['b-green','Open'];
  };
  return `<div class="card">
  <div class="card-header"><div class="card-title">🏥 Hospital Resource Availability</div><div class="last-updated"><span class="live-dot"></span> Live</div></div>
  ${hospitals.map((h,i) => {
    const [cls,label] = statusBadge(h);
    const upd = h.res_updated_at ? new Date(h.res_updated_at).toLocaleTimeString() : 'N/A';
    return `<div class="hosp-card${i===0?' recommended':''}">
    ${i===0?'<div style="font-size:10.5px;font-weight:600;color:var(--primary);margin-bottom:6px">★ NEAREST &amp; RECOMMENDED</div>':''}
    <div class="hosp-hdr">
      <div><div class="hosp-name">${h.name}</div><div class="hosp-dist">📍 ${h.block} · Updated ${upd}</div></div>
      <span class="badge ${cls}">${label}</span>
    </div>
    <div class="res-row">
      <span class="res-tag">🛏 Beds: <strong>${h.beds_free??'—'}</strong></span>
      <span class="res-tag">🫀 ICU: <strong>${h.icu_free??'—'}</strong></span>
      <span class="res-tag">🫁 O₂: <strong>${h.o2_cylinders??'—'} cyl</strong></span>
      <span class="res-tag">👨‍⚕️ Doctors: <strong>${h.doctors_on_duty??'—'}</strong></span>
    </div>
    ${h.public_alert_msg?`<div class="alert al-amber" style="margin-top:8px;padding:7px 10px;font-size:11px">⚠️ ${h.public_alert_msg}</div>`:''}
    <div style="margin-top:10px;display:flex;gap:7px;flex-wrap:wrap">
      <button class="btn btn-teal btn-sm" onclick="toast('📞 Calling ${h.name}...')">📞 Call ${h.phone||''}</button>
      ${(h.beds_free||0)>0
        ?`<button class="btn btn-outline btn-sm" onclick="openBedModal(${h.id},'${h.name.replace(/'/g,"\\'")}')">🛏️ Reserve a bed</button>`
        :'<span style="font-size:11px;color:var(--danger);padding:4px 0">No beds available</span>'}
    </div>
  </div>`;}).join('')}
</div>`;
}

// ── Bed reservation submit (calls API) ───────────────────────────────────────
async function submitBedReserve() {
  const hid    = document.getElementById('modal-hid').value;
  const hname  = document.getElementById('modal-hname').value;
  const ward   = document.getElementById('modal-ward').value;
  const reason = document.getElementById('modal-reason').value.trim();
  try {
    const data = await apiFetch(`/hospitals/${hid}/reserve-bed`, {
      method: 'POST',
      body: { ward_preference: ward || null, reason: reason || null }
    });
    closeBedModal();
    toast('✅ ' + data.message, 4000);
  } catch(e) {
    toast('❌ ' + e.message);
  }
}

// ── Page: Medicines ───────────────────────────────────────────────────────────
async function pageMeds() {
  const [{ medicines }, { comparison }] = await Promise.all([
    apiFetch('/medicines'),
    apiFetch('/medicines/price-comparison')
  ]);
  const stockBadge = m => m.quantity_available > 50 ? ['b-green','In stock'] : m.quantity_available > 0 ? ['b-amber','Low stock'] : ['b-red','Out of stock'];
  return `<div class="card">
  <div class="card-header"><div class="card-title">💊 Medicine Availability</div><span class="badge b-blue">Live stock</span></div>
  <div class="search-bar">
    <input class="search-input" id="med-q" placeholder="Search medicine name..." onkeyup="searchMeds()" />
    <button class="btn btn-teal" onclick="searchMeds()">Search</button>
  </div>
  <div id="med-list">
  ${medicines.map(m => {
    const [cls,label] = stockBadge(m);
    return `<div class="med-card">
    <div>
      <div style="font-size:13px;font-weight:600">${m.name}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px">📍 ${m.hospital_name} · ₹${m.unit_price_govt}/tab</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
      <span class="badge ${cls}">${label}</span>
      ${m.quantity_available>0
        ?`<button class="btn btn-teal btn-sm" onclick="reserveMed(${m.id},'${m.name.replace(/'/g,"\\'")}')">Reserve</button>`
        :`<button class="btn btn-outline btn-sm" onclick="toast('🔔 Alert set for ${m.name}')">Notify me</button>`}
    </div>
  </div>`;}).join('')}
  </div>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">💰 Govt. vs Private Price Comparison</div>
  <table class="tbl"><thead><tr><th>Medicine</th><th>Govt. price</th><th>Private</th><th>You save</th></tr></thead>
  <tbody>${comparison.map(r=>`<tr>
    <td>${r.name}</td>
    <td style="color:var(--primary);font-weight:600">₹${r.govt}/tab</td>
    <td>₹${r.private}</td>
    <td><span class="badge b-green">Save ${r.save_pct}%</span></td>
  </tr>`).join('')}</tbody></table>
</div>`;
}

async function searchMeds() {
  const q = document.getElementById('med-q')?.value || '';
  try {
    const { medicines } = await apiFetch(`/medicines?q=${encodeURIComponent(q)}`);
    const stockBadge = m => m.quantity_available > 50 ? ['b-green','In stock'] : m.quantity_available > 0 ? ['b-amber','Low stock'] : ['b-red','Out of stock'];
    document.getElementById('med-list').innerHTML = medicines.map(m => {
      const [cls,label] = stockBadge(m);
      return `<div class="med-card"><div><div style="font-size:13px;font-weight:600">${m.name}</div><div style="font-size:11px;color:var(--text3)">📍 ${m.hospital_name} · ₹${m.unit_price_govt}/tab</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="badge ${cls}">${label}</span>
        ${m.quantity_available>0?`<button class="btn btn-teal btn-sm" onclick="reserveMed(${m.id},'${m.name.replace(/'/g,"\\'")}')">Reserve</button>`:`<button class="btn btn-outline btn-sm" onclick="toast('Alert set')">Notify me</button>`}
      </div></div>`;
    }).join('') || '<div style="padding:20px;text-align:center;color:var(--text3)">No medicines found</div>';
  } catch(e) { toast('Search failed: '+e.message); }
}

async function reserveMed(id, name) {
  try {
    const data = await apiFetch(`/medicines/${id}/reserve`, { method:'POST', body:{ quantity:1 } });
    toast('✅ ' + data.message, 4000);
  } catch(e) { toast('❌ ' + e.message); }
}
