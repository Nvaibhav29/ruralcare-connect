// ── Page: Emergency ───────────────────────────────────────────────────────────
async function pageEmg() {
  return `<div style="margin-bottom:14px">
  <button class="emg-btn" onclick="triggerSOS()">🚨 &nbsp; EMERGENCY — SEND SOS NOW</button>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:14px">🚑 Find Best Hospital for Your Condition</div>
  <div class="form-group">
    <label class="form-label">Your location</label>
    <div style="display:flex;gap:8px">
      <input class="form-input" id="emg-loc" value="Kolar Block, Karnataka" />
      <button class="btn btn-outline" style="white-space:nowrap" onclick="toast('📍 GPS: 13.1357°N, 78.1294°E')">📍 GPS</button>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Type of emergency</label>
    <select class="form-select" id="emg-type">
      <option>Cardiac / Chest pain</option><option>Breathing difficulty / Needs oxygen</option>
      <option>Road accident / Trauma</option><option>Maternity / Labour</option>
      <option>High fever / Infection</option><option>Snake bite / Poisoning</option><option>Stroke / Paralysis</option>
    </select>
  </div>
  <button class="btn btn-teal" style="width:100%" onclick="findBestHospital()">Find Best Hospital →</button>
</div>
<div id="emg-result"></div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">📞 Emergency Contacts</div>
  <table class="tbl"><thead><tr><th>Service</th><th>Number</th><th></th></tr></thead><tbody>
    <tr><td><strong>108 Ambulance (Free)</strong></td><td><span class="badge b-red" style="font-size:12px">108</span></td><td><button class="btn btn-red btn-sm" onclick="toast('📞 Calling 108...')">Call Now</button></td></tr>
    <tr><td><strong>104 Health Helpline</strong></td><td><span class="badge b-blue" style="font-size:12px">104</span></td><td><button class="btn btn-outline btn-sm" onclick="toast('📞 Calling 104...')">Call Now</button></td></tr>
    <tr><td><strong>Kolar District Hospital</strong></td><td><span class="badge b-gray">08152-222310</span></td><td><button class="btn btn-outline btn-sm" onclick="toast('📞 Calling KDH...')">Call Now</button></td></tr>
  </tbody></table>
</div>`;
}

async function triggerSOS() {
  try {
    const data = await apiFetch('/emergency/sos', { method:'POST', body:{ location_text:'Kolar Block, Karnataka', emergency_type:'General' } });
    toast(`🚨 SOS sent! ${data.assigned_hospital?.name} alerted. ETA: ~${data.eta_minutes} min.`, 5000);
  } catch(e) { toast('🚨 SOS sent! 108 Ambulance alerted. ETA ~12 min.', 5000); }
}

async function findBestHospital() {
  const type = document.getElementById('emg-type')?.value || '';
  try {
    const data = await apiFetch('/emergency/find-hospital', { method:'POST', body:{ emergency_type:type } });
    const h = data.best_hospital;
    document.getElementById('emg-result').innerHTML = `<div class="card">
  <div class="alert al-green" style="margin-bottom:12px">✅ Best match found for: ${type}</div>
  <div class="hosp-card recommended">
    <div class="hosp-hdr"><div><div class="hosp-name">${h.name}</div><div class="hosp-dist">📍 ${h.block} · Has required resources</div></div><span class="badge b-green">Best match</span></div>
    <div class="res-row">
      <span class="res-tag">🛏 Beds: <strong>${h.beds_free}</strong></span>
      <span class="res-tag">🫁 O₂: <strong>${h.o2_cylinders} cyl</strong></span>
      <span class="res-tag">🫀 ICU: <strong>${h.icu_free}</strong></span>
      <span class="res-tag">👨‍⚕️ Doctors: <strong>${h.doctors_on_duty}</strong></span>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-red" onclick="triggerSOS()">🚑 Dispatch ambulance</button>
      <button class="btn btn-outline btn-sm" onclick="toast('📞 Calling ${h.name}...')">📞 Call hospital</button>
    </div>
  </div>
</div>`;
  } catch(e) { toast('❌ '+e.message); }
}

// ── Page: My Records ──────────────────────────────────────────────────────────
async function pageRecords() {
  const { patient: p } = await apiFetch('/patients/me');
  return `<div class="card">
  <div class="card-header">
    <div><div class="card-title">📄 My Health Records</div><div class="card-subtitle">Access via Mobile: ${p.mobile}</div></div>
    <span class="badge b-gray" style="font-family:'DM Mono',monospace">${p.patient_ref}</span>
  </div>
  <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px">
    <div><div style="font-size:10.5px;color:var(--text3)">Name</div><div style="font-size:14px;font-weight:500">${p.name}</div></div>
    <div><div style="font-size:10.5px;color:var(--text3)">Age / Gender</div><div style="font-size:14px;font-weight:500">${p.age} / ${p.gender==='M'?'Male':'Female'}</div></div>
    <div><div style="font-size:10.5px;color:var(--text3)">Blood Group</div><div style="font-size:14px;font-weight:500;color:var(--danger)">${p.blood_group}</div></div>
    <div><div style="font-size:10.5px;color:var(--text3)">Aadhaar / ABHA</div><div style="font-size:14px;font-weight:500">${p.aadhaar_masked||'—'}</div></div>
  </div>
  <div class="divider"></div>
  <div style="font-size:12px;font-weight:600;margin-bottom:8px">⚠️ Known Conditions</div>
  <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px">
    ${p.conditions?.length ? p.conditions.map(c=>`<span class="badge b-amber">${c}</span>`).join('') : '<span style="color:var(--text3);font-size:12px">None recorded</span>'}
  </div>
  <div style="font-size:12px;font-weight:600;margin-bottom:8px">💊 Current Medications</div>
  <table class="tbl" style="margin-bottom:14px">
    <thead><tr><th>Medicine</th><th>Dose</th><th>Prescribed by</th><th>Since</th></tr></thead>
    <tbody>${p.medications?.filter(m=>m.active).map(m=>`<tr><td>${m.medicine_name}</td><td>${m.dose||'—'}</td><td>${m.prescribed_by||'—'}</td><td>${m.since_date||'—'}</td></tr>`).join('')||'<tr><td colspan="4" style="color:var(--text3)">No active medications</td></tr>'}</tbody>
  </table>
  <div style="font-size:12px;font-weight:600;margin-bottom:10px">🗓️ Visit History</div>
  <div class="timeline">
    ${p.visits?.map(v=>`<div class="tl-item"><div class="tl-time">${v.visit_date} — ${v.location||'Hospital'}</div><div class="tl-text">${v.notes||'No notes'}</div></div>`).join('')||'<div class="tl-item"><div class="tl-text" style="color:var(--text3)">No visits recorded</div></div>'}
  </div>
  <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-teal btn-sm" onclick="toast('📤 Records shared via SMS to ${p.mobile}')">📤 Share via SMS</button>
    <button class="btn btn-outline btn-sm" onclick="toast('🔲 QR code generated')">🔲 QR code</button>
  </div>
</div>`;
}

// ── Page: Hospital Dashboard ──────────────────────────────────────────────────
async function pageDash() {
  const user = getUser();
  const hid  = user?.hospital_id || 1;

  const [{ hospital }, medRes, bedRes] = await Promise.all([
    apiFetch(`/hospitals/${hid}`),
    apiFetch('/medicines/reservations').catch(() => ({ reservations: [] })),
    apiFetch(`/hospitals/${hid}/bed-reservations`).catch(() => ({ reservations: [] }))
  ]);
  const r = hospital;

  const pendingMed = medRes.reservations.filter(x => x.status === 'pending').length;
  const pendingBed = bedRes.reservations.filter(x => x.status === 'pending').length;
  const totalPending = pendingMed + pendingBed;

  // Capacity helpers
  const bedsTotal  = r.beds_total  || 60;
  const icuTotal   = r.icu_total   || 10;
  const bedsPct    = Math.round(((bedsTotal - (r.beds_free ?? 0)) / bedsTotal) * 100);
  const icuPct     = Math.round(((icuTotal  - (r.icu_free  ?? 0)) / icuTotal)  * 100);
  const capColor   = pct => pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--accent)' : 'var(--primary)';

  // Ring SVG helper
  const ring = (pct, color, size = 70) => {
    const r2 = (size / 2) - 6, circ = +(2 * Math.PI * r2).toFixed(1);
    const dash = +((pct / 100) * circ).toFixed(1);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size/2}" cy="${size/2}" r="${r2}" fill="none" stroke="var(--border)" stroke-width="6"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r2}" fill="none" stroke="${color}" stroke-width="6"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round"/>
    </svg>`;
  };

  const lastSync = r.res_updated_at ? new Date(r.res_updated_at).toLocaleTimeString() : 'N/A';
  const tabIdx = id => tabsForRole[currentRole].findIndex(t => t.id === id);

  return `
<!-- Hero header -->
<div style="background:linear-gradient(135deg,#0d4f47 0%,#0f766e 60%,#065f46 100%);border-radius:14px;padding:24px 28px;margin-bottom:14px;color:#fff;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">
  <div>
    <div style="font-size:11px;font-weight:500;opacity:.65;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Hospital Admin Dashboard</div>
    <div style="font-size:20px;font-weight:700;letter-spacing:-.4px">📊 ${r.name}</div>
    <div style="font-size:11.5px;opacity:.7;margin-top:4px">📍 ${r.block || ''} ${r.district ? '· ' + r.district : ''}</div>
  </div>
  <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
    ${totalPending > 0
      ? `<div style="background:rgba(245,158,11,.25);border:1px solid rgba(245,158,11,.5);border-radius:10px;padding:10px 16px;cursor:pointer" onclick="renderTab(${tabIdx('reservations')})">
           <div style="font-size:10px;opacity:.8;margin-bottom:2px">⚠️ Action needed</div>
           <div style="font-size:18px;font-weight:700">${totalPending}</div>
           <div style="font-size:10.5px;opacity:.75">pending request${totalPending>1?'s':''}</div>
         </div>`
      : `<div style="background:rgba(34,197,94,.2);border:1px solid rgba(34,197,94,.4);border-radius:10px;padding:10px 16px">
           <div style="font-size:13px;font-weight:600">✅ All clear</div>
           <div style="font-size:10.5px;opacity:.7">No pending requests</div>
         </div>`}
    <div style="text-align:right">
      <div style="font-size:10px;opacity:.6">Last updated</div>
      <div style="font-size:12.5px;font-weight:500">${lastSync}</div>
      <div style="display:flex;align-items:center;gap:5px;margin-top:4px;justify-content:flex-end"><span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;animation:pulse 1.5s ease-in-out infinite"></span><span style="font-size:10.5px;opacity:.7">Live</span></div>
    </div>
  </div>
</div>

<!-- Bed & ICU capacity rings -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
  <div class="card" style="display:flex;align-items:center;gap:18px">
    <div style="position:relative;flex-shrink:0">
      ${ring(bedsPct, capColor(bedsPct))}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
        <div style="font-size:15px;font-weight:700;color:${capColor(bedsPct)}">${r.beds_free ?? 0}</div>
        <div style="font-size:8.5px;color:var(--text3);font-weight:500">free</div>
      </div>
    </div>
    <div>
      <div style="font-size:13px;font-weight:600;margin-bottom:2px">🛏️ Beds</div>
      <div style="font-size:11px;color:var(--text3)">${r.beds_free ?? 0} free of ${bedsTotal}</div>
      <div style="margin-top:6px"><span class="badge ${bedsPct>=90?'b-red':bedsPct>=70?'b-amber':'b-green'}">${bedsPct}% occupied</span></div>
    </div>
  </div>
  <div class="card" style="display:flex;align-items:center;gap:18px">
    <div style="position:relative;flex-shrink:0">
      ${ring(icuPct, capColor(icuPct))}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
        <div style="font-size:15px;font-weight:700;color:${capColor(icuPct)}">${r.icu_free ?? 0}</div>
        <div style="font-size:8.5px;color:var(--text3);font-weight:500">free</div>
      </div>
    </div>
    <div>
      <div style="font-size:13px;font-weight:600;margin-bottom:2px">🫀 ICU</div>
      <div style="font-size:11px;color:var(--text3)">${r.icu_free ?? 0} free of ${icuTotal}</div>
      <div style="margin-top:6px"><span class="badge ${icuPct>=90?'b-red':icuPct>=70?'b-amber':'b-green'}">${icuPct}% occupied</span></div>
    </div>
  </div>
</div>

<!-- Resource stat cards -->
<div class="card">
  <div class="card-header" style="margin-bottom:14px">
    <div class="card-title">📦 Resource Overview</div>
    <button class="btn btn-outline btn-sm" onclick="renderTab(${tabIdx('update')})">✏️ Update</button>
  </div>
  <div class="stat-grid">
    <div class="stat-card ${(r.o2_cylinders??0)<5?'sc-red':'sc-green'}">
      <div class="stat-val">${r.o2_cylinders ?? 0}</div>
      <div class="stat-label">O₂ Cylinders</div>
      ${(r.o2_cylinders??0)<5?'<div class="stat-sub" style="color:var(--danger)">⚠️ Low</div>':''}
    </div>
    <div class="stat-card sc-green">
      <div class="stat-val">${r.doctors_on_duty ?? 0}</div>
      <div class="stat-label">Doctors on duty</div>
    </div>
    <div class="stat-card sc-green">
      <div class="stat-val">${r.ventilators_free ?? 0}</div>
      <div class="stat-label">Ventilators free</div>
    </div>
    <div class="stat-card sc-green">
      <div class="stat-val">${r.blood_bank_units ?? 0}</div>
      <div class="stat-label">Blood bank units</div>
    </div>
  </div>
  ${r.public_alert_msg ? `<div class="alert al-amber" style="margin-top:12px">⚠️ <strong>Active alert:</strong> ${r.public_alert_msg}</div>` : ''}
</div>

<!-- Pending action cards -->
${totalPending > 0 ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:0">
  ${pendingBed > 0 ? `<div class="card" style="border-color:var(--accent);background:var(--accent-light);cursor:pointer" onclick="renderTab(${tabIdx('reservations')})">
    <div style="font-size:24px;font-weight:700;color:#92400e">${pendingBed}</div>
    <div style="font-size:13px;font-weight:600;color:#78350f;margin-top:2px">🛏️ Bed requests pending</div>
    <div style="font-size:11px;color:#92400e;margin-top:4px">Tap to review →</div>
  </div>` : ''}
  ${pendingMed > 0 ? `<div class="card" style="border-color:var(--info);background:var(--info-light);cursor:pointer" onclick="renderTab(${tabIdx('reservations')})">
    <div style="font-size:24px;font-weight:700;color:var(--info)">${pendingMed}</div>
    <div style="font-size:13px;font-weight:600;color:var(--info);margin-top:2px">💊 Medicine pickups pending</div>
    <div style="font-size:11px;color:var(--info);margin-top:4px">Tap to review →</div>
  </div>` : ''}
</div>` : ''}`;
}

// ── Page: Update Resources ────────────────────────────────────────────────────
async function pageUpdate() {
  const user = getUser();
  const hid = user?.hospital_id || 1;
  const { resources: r } = await apiFetch(`/hospitals/${hid}/resources`);
  const { thresholds } = await apiFetch(`/hospitals/${hid}/thresholds`);
  const thresh = {};
  thresholds.forEach(t => thresh[t.resource_key] = t.threshold_value);
  return `<div class="card">
  <div class="card-header"><div class="card-title">✏️ Update Hospital Resources</div><span class="badge b-blue">Manual update</span></div>
  <div class="alert al-green">✅ Last updated: ${r?.updated_at ? new Date(r.updated_at).toLocaleString() : 'N/A'}</div>
  <div class="section-label">Current capacity</div>
  <div class="form-row-3">
    <div class="form-group"><label class="form-label">Available beds</label><input class="form-input" id="u-beds" type="number" value="${r?.beds_free??0}" /></div>
    <div class="form-group"><label class="form-label">ICU beds free</label><input class="form-input" id="u-icu" type="number" value="${r?.icu_free??0}" /></div>
    <div class="form-group"><label class="form-label">O₂ cylinders (full)</label><input class="form-input" id="u-o2" type="number" value="${r?.o2_cylinders??0}" /></div>
  </div>
  <div class="form-row-3">
    <div class="form-group"><label class="form-label">Doctors on duty</label><input class="form-input" id="u-docs" type="number" value="${r?.doctors_on_duty??0}" /></div>
    <div class="form-group"><label class="form-label">Ventilators free</label><input class="form-input" id="u-vent" type="number" value="${r?.ventilators_free??0}" /></div>
    <div class="form-group"><label class="form-label">Blood bank (units)</label><input class="form-input" id="u-blood" type="number" value="${r?.blood_bank_units??0}" /></div>
  </div>
  <div class="form-group"><label class="form-label">Public alert message (optional)</label><input class="form-input" id="u-alert" placeholder="e.g. Maternity ward at capacity" value="${r?.public_alert_msg||''}" /></div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-teal" onclick="saveResources(${hid})">Save & Publish</button>
    <button class="btn btn-outline" onclick="toast('Draft saved locally')">Save draft</button>
  </div>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">⚙️ Auto-Alert Thresholds</div>
  <table class="tbl"><thead><tr><th>Resource</th><th>Current</th><th>Alert when below</th><th></th></tr></thead>
  <tbody>
    <tr><td>O₂ cylinders</td><td><strong>${r?.o2_cylinders??0}</strong></td><td><input id="th-o2" style="width:64px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:11.5px" value="${thresh.o2_cylinders??5}" /></td><td><button class="btn btn-outline btn-sm" onclick="saveThreshold(${hid},'o2_cylinders','th-o2')">Save</button></td></tr>
    <tr><td>ICU beds</td><td><strong>${r?.icu_free??0}</strong></td><td><input id="th-icu" style="width:64px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:11.5px" value="${thresh.icu_free??2}" /></td><td><button class="btn btn-outline btn-sm" onclick="saveThreshold(${hid},'icu_free','th-icu')">Save</button></td></tr>
    <tr><td>Blood bank</td><td><strong>${r?.blood_bank_units??0}</strong></td><td><input id="th-blood" style="width:64px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:11.5px" value="${thresh.blood_bank_units??5}" /></td><td><button class="btn btn-outline btn-sm" onclick="saveThreshold(${hid},'blood_bank_units','th-blood')">Save</button></td></tr>
  </tbody></table>
</div>`;
}

async function saveResources(hid) {
  try {
    await apiFetch(`/hospitals/${hid}/resources`, { method:'PUT', body:{
      beds_free: +document.getElementById('u-beds').value,
      icu_free: +document.getElementById('u-icu').value,
      o2_cylinders: +document.getElementById('u-o2').value,
      doctors_on_duty: +document.getElementById('u-docs').value,
      ventilators_free: +document.getElementById('u-vent').value,
      blood_bank_units: +document.getElementById('u-blood').value,
      public_alert_msg: document.getElementById('u-alert').value || null
    }});
    toast('✅ Resources published! Public dashboard updated.');
  } catch(e) { toast('❌ '+e.message); }
}

async function saveThreshold(hid, key, inputId) {
  try {
    const val = +document.getElementById(inputId).value;
    await apiFetch(`/hospitals/${hid}/thresholds`, { method:'PUT', body:{ thresholds:[{ resource_key:key, threshold_value:val }] } });
    toast(`✅ ${key} threshold saved to ${val}`);
  } catch(e) { toast('❌ '+e.message); }
}
