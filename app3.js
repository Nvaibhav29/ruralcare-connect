// ── Page: Procurement / Shortage ──────────────────────────────────────────────
async function pageShortage() {
  const [{ shortages }, { vendors }] = await Promise.all([
    apiFetch('/shortages'),
    apiFetch('/shortages/vendors')
  ]);
  const pCls = p => p==='critical'?'b-red':p==='high'?'b-amber':'b-blue';
  const sCls = s => s==='delivered'||s==='approved'?'b-green':s==='pending'?'b-amber':'b-blue';
  return `<div class="card">
  <div class="card-header"><div class="card-title">📦 Raise Shortage / Procurement Request</div><span class="badge b-amber">Hospital side</span></div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Item / Medicine name</label><input class="form-input" id="sr-item" placeholder="e.g. Oxygen cylinders" /></div>
    <div class="form-group"><label class="form-label">Quantity needed</label><input class="form-input" id="sr-qty" type="number" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Current stock</label><input class="form-input" id="sr-stock" type="number" value="0" /></div>
    <div class="form-group"><label class="form-label">Priority</label>
      <select class="form-select" id="sr-priority">
        <option value="critical">🔴 Critical — within 24 hours</option>
        <option value="high">🟡 High — within 3 days</option>
        <option value="normal">🟢 Normal — within 7 days</option>
      </select>
    </div>
  </div>
  <div class="form-group"><label class="form-label">Clinical justification</label><input class="form-input" id="sr-reason" placeholder="Reason for shortage" /></div>
  <button class="btn btn-teal" onclick="submitShortage()">Submit Request</button>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">✅ Verified Vendors</div>
  <table class="tbl"><thead><tr><th>Vendor</th><th>Category</th><th>Rating</th><th>Avg. delivery</th><th></th></tr></thead>
  <tbody>${vendors.map(v=>`<tr>
    <td><strong>${v.name}</strong></td><td>${v.type}</td><td>⭐ ${v.rating}</td><td>${v.avg_delivery_days}–${v.avg_delivery_days+1} days</td>
    <td><button class="btn btn-teal btn-sm" onclick="toast('✅ ${v.name} selected')">Select</button></td>
  </tr>`).join('')}</tbody></table>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">📋 My Shortage Requests</div>
  <table class="tbl"><thead><tr><th>Request #</th><th>Item</th><th>Qty</th><th>Priority</th><th>Status</th><th>Date</th></tr></thead>
  <tbody>${shortages.map(s=>`<tr>
    <td style="font-family:'DM Mono',monospace;font-size:11px">${s.ref_number}</td>
    <td>${s.item_name}</td><td>${s.quantity_needed}</td>
    <td><span class="badge ${pCls(s.priority)}">${s.priority}</span></td>
    <td><span class="badge ${sCls(s.status)}">${s.status}</span></td>
    <td style="font-size:11px">${s.raised_at?.split(' ')[0]||'—'}</td>
  </tr>`).join('')}</tbody></table>
</div>`;
}

async function submitShortage() {
  const body = {
    item_name: document.getElementById('sr-item').value,
    quantity_needed: +document.getElementById('sr-qty').value,
    current_stock: +document.getElementById('sr-stock').value,
    priority: document.getElementById('sr-priority').value,
    justification: document.getElementById('sr-reason').value
  };
  if (!body.item_name || !body.quantity_needed) { toast('Item name and quantity are required'); return; }
  try {
    const data = await apiFetch('/shortages', { method:'POST', body });
    toast(`✅ ${data.ref_number} submitted to District NHM`);
    renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='shortage'));
  } catch(e) { toast('❌ '+e.message); }
}

// ── Page: Audit Log ───────────────────────────────────────────────────────────
async function pageAudit() {
  const { logs } = await apiFetch('/audit?limit=30');
  const tCls = t => t==='update'?'b-blue':t==='shortage'?'b-amber':t==='admin'?'b-red':'b-green';
  return `<div class="card">
  <div class="card-header">
    <div class="card-title">🔍 Audit Log</div>
    <a href="/api/audit/export" class="btn btn-outline btn-sm" target="_blank">Export CSV</a>
  </div>
  <div class="search-bar">
    <input class="search-input" id="audit-q" placeholder="Search by user or action..." />
    <select id="audit-type" style="padding:9px;border:1.5px solid var(--border);border-radius:7px;font-family:inherit;font-size:12px;background:white">
      <option value="">All types</option><option value="update">update</option><option value="shortage">shortage</option><option value="admin">admin</option><option value="submit">submit</option>
    </select>
    <button class="btn btn-outline" onclick="filterAudit()">Filter</button>
  </div>
  <div id="audit-table">
  <table class="tbl"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Type</th></tr></thead>
  <tbody>${logs.map(l=>`<tr>
    <td style="font-family:'DM Mono',monospace;font-size:10.5px;color:var(--text3);white-space:nowrap">${l.timestamp}</td>
    <td style="font-weight:500;white-space:nowrap">${l.user_name}</td>
    <td>${l.description}</td>
    <td><span class="badge ${tCls(l.action_type)}">${l.action_type}</span></td>
  </tr>`).join('')}</tbody></table>
  </div>
</div>`;
}

async function filterAudit() {
  const q = document.getElementById('audit-q').value;
  const type = document.getElementById('audit-type').value;
  const { logs } = await apiFetch(`/audit?q=${encodeURIComponent(q)}&type=${type}&limit=30`);
  const tCls = t => t==='update'?'b-blue':t==='shortage'?'b-amber':t==='admin'?'b-red':'b-green';
  document.getElementById('audit-table').innerHTML = `<table class="tbl"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Type</th></tr></thead><tbody>${logs.map(l=>`<tr><td style="font-family:'DM Mono',monospace;font-size:10.5px;color:var(--text3)">${l.timestamp}</td><td style="font-weight:500">${l.user_name}</td><td>${l.description}</td><td><span class="badge ${tCls(l.action_type)}">${l.action_type}</span></td></tr>`).join('')}</tbody></table>`;
}

// ── Page: Patient Records (Hospital Admin) ────────────────────────────────────
async function pagePatRecords() {
  const { patients } = await apiFetch('/patients?limit=50');
  return `<div class="card">
  <div class="card-header">
    <div><div class="card-title">🗂️ All Patient Records</div><div class="card-subtitle">${patients.length} patients</div></div>
    <button class="btn btn-teal btn-sm" onclick="showAddPatient()">＋ Add New Patient</button>
  </div>
  <div class="stat-grid">
    <div class="stat-card sc-green"><div class="stat-val">${patients.length}</div><div class="stat-label">Total patients</div></div>
    <div class="stat-card sc-green"><div class="stat-val">${patients.filter(p=>p.status==='active').length}</div><div class="stat-label">Active</div></div>
    <div class="stat-card sc-amber"><div class="stat-val">${patients.filter(p=>p.status==='discharged').length}</div><div class="stat-label">Discharged</div></div>
    <div class="stat-card sc-amber"><div class="stat-val">${patients.filter(p=>p.conditions?.length).length}</div><div class="stat-label">With conditions</div></div>
  </div>
  <div class="search-bar">
    <input class="search-input" id="pat-q" placeholder="Search by name, ID, village or condition..." onkeyup="searchPatients()" />
    <select id="pat-filter" style="padding:9px;border:1.5px solid var(--border);border-radius:7px;font-family:inherit;font-size:12px;background:white" onchange="searchPatients()">
      <option value="all">All patients</option><option value="active">Active only</option><option value="discharged">Discharged</option>
    </select>
  </div>
  <div id="pat-table">${renderPatientTable(patients)}</div>
</div>
<div id="pat-detail"></div>`;
}

function renderPatientTable(patients) {
  if (!patients.length) return '<div style="text-align:center;padding:24px;color:var(--text3)">No patients found</div>';
  return `<table class="tbl"><thead><tr><th>Patient ID</th><th>Name</th><th>Age/Gender</th><th>Village</th><th>Conditions</th><th>Status</th><th></th></tr></thead>
  <tbody>${patients.map(p=>`<tr>
    <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text3)">${p.patient_ref}</td>
    <td><div style="font-weight:600">${p.name}</div><div style="font-size:10.5px;color:var(--text3)">${p.mobile}</div></td>
    <td>${p.age}/${p.gender}</td><td style="font-size:11.5px">${p.village}</td>
    <td>${p.conditions?.length?p.conditions.map(c=>`<span class="badge b-amber" style="margin:1px">${c}</span>`).join(''):'<span style="font-size:11px;color:var(--text3)">—</span>'}</td>
    <td><span class="badge ${p.status==='active'?'b-green':'b-gray'}">${p.status}</span></td>
    <td><button class="btn btn-teal btn-sm" onclick="openPatDetail(${p.id})">View →</button></td>
  </tr>`).join('')}</tbody></table>`;
}

async function searchPatients() {
  const q = document.getElementById('pat-q')?.value || '';
  const status = document.getElementById('pat-filter')?.value || 'all';
  const params = new URLSearchParams({ q, ...(status!=='all'?{status}:{}) });
  try {
    const { patients } = await apiFetch(`/patients?${params}`);
    document.getElementById('pat-table').innerHTML = renderPatientTable(patients);
  } catch(e) { toast('Search failed: '+e.message); }
}

async function openPatDetail(id) {
  try {
    const { patient: p } = await apiFetch(`/patients/${id}`);
    document.getElementById('pat-detail').innerHTML = `<div class="card" style="border:2px solid var(--primary)">
  <div class="card-header" style="margin-bottom:14px">
    <div><div class="card-title">📋 ${p.name}</div><div class="card-subtitle">${p.patient_ref} · ${p.age}y / ${p.gender==='M'?'Male':'Female'} · Blood: <strong style="color:var(--danger)">${p.blood_group}</strong></div></div>
    <div style="display:flex;gap:7px;align-items:center">
      <span class="badge ${p.status==='active'?'b-green':'b-gray'}">${p.status}</span>
      <button class="btn btn-outline btn-sm" onclick="document.getElementById('pat-detail').innerHTML=''">✕ Close</button>
    </div>
  </div>
  <div class="section-label">Known Conditions</div>
  <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">${p.conditions?.length?p.conditions.map(c=>`<span class="badge b-amber">${c}</span>`).join(''):'<span style="color:var(--text3);font-size:12px">None</span>'}</div>
  <div class="section-label">Medications</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${p.medications?.filter(m=>m.active).map(m=>`<span class="badge b-blue">${m.medicine_name}</span>`).join('')||'<span style="color:var(--text3);font-size:12px">None</span>'}</div>
  <div class="section-label">Visit History</div>
  <div class="timeline" style="margin-bottom:14px">${p.visits?.map(v=>`<div class="tl-item"><div class="tl-time">${v.visit_date} — ${v.location||'Hospital'}</div><div class="tl-text">${v.notes||'No notes'}</div></div>`).join('')||'<div class="tl-item"><div class="tl-text" style="color:var(--text3)">No visits</div></div>'}</div>
  <div class="section-label">Add Visit</div>
  <div class="form-row" style="margin-bottom:8px">
    <div class="form-group"><label class="form-label">Visit date</label><input class="form-input" type="date" id="nv-date" /></div>
    <div class="form-group"><label class="form-label">Doctor</label><input class="form-input" id="nv-doc" value="${getUser()?.name||'Dr.'}" /></div>
  </div>
  <div class="form-group"><label class="form-label">Notes</label><input class="form-input" id="nv-notes" placeholder="e.g. BP: 128/82 · Sugar: 136 mg/dL" /></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-teal" onclick="addVisit(${p.id},'${p.name}')">Save visit</button>
    <button class="btn btn-outline btn-sm" onclick="changeStatus(${p.id},'${p.status==='active'?'discharged':'active'}','${p.name}')">${p.status==='active'?'Mark discharged':'Re-admit'}</button>
    <button class="btn btn-outline btn-sm" onclick="toast('📤 Record sent to ${p.mobile}')">📤 Send to patient</button>
  </div>
</div>`;
    document.getElementById('pat-detail').scrollIntoView({ behavior:'smooth', block:'start' });
  } catch(e) { toast('❌ '+e.message); }
}

async function addVisit(id, name) {
  try {
    await apiFetch(`/patients/${id}/visits`, { method:'POST', body:{
      visit_date: document.getElementById('nv-date').value || new Date().toISOString().split('T')[0],
      doctor: document.getElementById('nv-doc').value,
      notes: document.getElementById('nv-notes').value,
      location: 'Kolar District Hospital'
    }});
    toast(`✅ Visit recorded for ${name}`);
    openPatDetail(id);
  } catch(e) { toast('❌ '+e.message); }
}

async function changeStatus(id, newStatus, name) {
  try {
    await apiFetch(`/patients/${id}/status`, { method:'PATCH', body:{ status:newStatus } });
    toast(`✅ ${name} marked as ${newStatus}`);
    openPatDetail(id);
  } catch(e) { toast('❌ '+e.message); }
}

function showAddPatient() {
  document.getElementById('pat-detail').innerHTML = `<div class="card" style="border:2px solid var(--primary)">
  <div class="card-header"><div class="card-title">➕ Register New Patient</div><button class="btn btn-outline btn-sm" onclick="document.getElementById('pat-detail').innerHTML=''">✕ Cancel</button></div>
  <div class="form-row"><div class="form-group"><label class="form-label">Full name</label><input class="form-input" id="np-name" /></div><div class="form-group"><label class="form-label">Mobile</label><input class="form-input" id="np-mobile" placeholder="+91-XXXXX-XXXXX" /></div></div>
  <div class="form-row-3">
    <div class="form-group"><label class="form-label">Age</label><input class="form-input" id="np-age" type="number" /></div>
    <div class="form-group"><label class="form-label">Gender</label><select class="form-select" id="np-gender"><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option></select></div>
    <div class="form-group"><label class="form-label">Blood group</label><select class="form-select" id="np-blood"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></div>
  </div>
  <div class="form-row"><div class="form-group"><label class="form-label">Village</label><input class="form-input" id="np-village" /></div><div class="form-group"><label class="form-label">Conditions</label><input class="form-input" id="np-cond" placeholder="e.g. Diabetes, Hypertension" /></div></div>
  <div class="form-group"><label class="form-label">Initial visit notes</label><input class="form-input" id="np-notes" placeholder="Reason for visit today" /></div>
  <button class="btn btn-teal" onclick="registerPatient()">Register Patient</button>
</div>`;
  document.getElementById('pat-detail').scrollIntoView({ behavior:'smooth' });
}

async function registerPatient() {
  const conditions = document.getElementById('np-cond').value.split(',').map(s=>s.trim()).filter(Boolean);
  try {
    const data = await apiFetch('/patients', { method:'POST', body:{
      name: document.getElementById('np-name').value,
      mobile: document.getElementById('np-mobile').value,
      age: +document.getElementById('np-age').value,
      gender: document.getElementById('np-gender').value,
      blood_group: document.getElementById('np-blood').value,
      village: document.getElementById('np-village').value,
      conditions,
      notes: document.getElementById('np-notes').value
    }});
    toast(`✅ Patient registered! ID: ${data.patient_ref}`);
    renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='patrecords'));
  } catch(e) { toast('❌ '+e.message); }
}

// ── Page: District View ───────────────────────────────────────────────────────
async function pageDistrict() {
  const { blocks, totals, pending_shortages } = await apiFetch('/district/overview');
  const oCls = o => o==='red'?'b-red':o==='amber'?'b-amber':'b-green';
  const oLabel = o => o==='red'?'Critical':o==='amber'?'Caution':'Normal';
  return `<div class="card">
  <div class="card-header"><div><div class="card-title">🗺️ Kolar District — Resource Overview</div><div class="card-subtitle">NHM Officer view · All blocks</div></div><div class="last-updated"><span class="live-dot"></span> Live</div></div>
  <div class="stat-grid">
    <div class="stat-card sc-green"><div class="stat-val">${totals.blocks}</div><div class="stat-label">Blocks tracked</div></div>
    <div class="stat-card sc-red"><div class="stat-val">${totals.critical_alerts}</div><div class="stat-label">Critical alerts</div></div>
    <div class="stat-card sc-amber"><div class="stat-val">${totals.caution_alerts}</div><div class="stat-label">Caution alerts</div></div>
    <div class="stat-card sc-green"><div class="stat-val">${totals.total_beds_free}</div><div class="stat-label">Total free beds</div></div>
  </div>
  <table class="tbl"><thead><tr><th>Block</th><th>Free beds</th><th>O₂ status</th><th>Overall</th><th>Action</th></tr></thead>
  <tbody>${blocks.map(b=>`<tr>
    <td style="font-weight:600">${b.block}</td>
    <td style="font-family:'DM Mono',monospace">${b.total_beds_free}</td>
    <td><span class="badge ${b.o2_status==='OK'?'b-green':b.o2_status==='Low'?'b-amber':'b-red'}">${b.o2_status}</span></td>
    <td><span class="badge ${oCls(b.overall)}">${oLabel(b.overall)}</span></td>
    <td><button class="btn btn-outline btn-sm" onclick="toast('Opening ${b.block} block report...')">Details</button></td>
  </tr>`).join('')}</tbody></table>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">🚨 Pending Actions</div>
  ${pending_shortages.filter(s=>s.priority==='critical').map(s=>`<div class="alert al-red">🚨 <strong>${s.hospital_name}:</strong> Critical shortage — ${s.item_name} (need ${s.quantity_needed}). <button class="btn btn-red btn-sm" style="margin-left:8px" onclick="dispatch(${s.id},'${s.ref_number}')">Approve & Dispatch</button></div>`).join('')}
  ${pending_shortages.filter(s=>s.priority==='high').map(s=>`<div class="alert al-amber">⚠️ <strong>${s.hospital_name}:</strong> High priority — ${s.item_name}. <button class="btn btn-outline btn-sm" style="margin-left:8px" onclick="dispatch(${s.id},'${s.ref_number}')">Approve</button></div>`).join('')}
  <button class="btn btn-teal" style="margin-top:8px" onclick="bulkDispatch()">Approve all pending critical requests</button>
</div>`;
}

async function dispatch(id, ref) {
  try {
    await apiFetch(`/shortages/${id}/status`, { method:'PATCH', body:{ status:'approved' } });
    toast(`✅ ${ref} approved & dispatched`);
    renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='district'));
  } catch(e) { toast('❌ '+e.message); }
}

async function bulkDispatch() {
  try {
    const data = await apiFetch('/district/dispatch', { method:'POST' });
    toast(`✅ ${data.approved?.length||0} critical requests approved`);
    renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='district'));
  } catch(e) { toast('❌ '+e.message); }
}

// ── Page: Govt Shortages ──────────────────────────────────────────────────────
async function pageGovtShortage() {
  const { shortages } = await apiFetch('/district/shortages');
  const pCls = p => p==='critical'?'b-red':p==='high'?'b-amber':'b-blue';
  const sCls = s => s==='delivered'||s==='approved'?'b-green':s==='pending'?'b-amber':'b-gray';
  return `<div class="card">
  <div class="card-header"><div class="card-title">⚠️ Active Shortage Requests — Kolar District</div><span class="badge b-amber">${shortages.filter(s=>s.status==='pending').length} pending</span></div>
  <table class="tbl"><thead><tr><th>Hospital</th><th>Item</th><th>Qty</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
  <tbody>${shortages.map(s=>`<tr>
    <td><strong>${s.hospital_name}</strong><div style="font-size:10.5px;color:var(--text3)">${s.block}</div></td>
    <td>${s.item_name}</td><td>${s.quantity_needed}</td>
    <td><span class="badge ${pCls(s.priority)}">${s.priority}</span></td>
    <td><span class="badge ${sCls(s.status)}">${s.status}</span></td>
    <td>${s.status==='pending'
      ?`<button class="btn btn-teal btn-sm" onclick="dispatch(${s.id},'${s.ref_number}')">Approve</button>`
      :`<button class="btn btn-outline btn-sm" onclick="toast('Tracking: ${s.ref_number}')">Track</button>`}
    </td>
  </tr>`).join('')}</tbody></table>
</div>`;
}

// ── Page: Medicine Stock (Hospital Admin) ─────────────────────────────────────
async function pageMedicineStock() {
  const user = getUser();
  const hid = user?.hospital_id || 1;
  const { medicines } = await apiFetch(`/medicines?hospital_id=${hid}`);
  const stockBadge = m => m.quantity_available > 50 ? ['b-green','In stock'] : m.quantity_available > 0 ? ['b-amber','Low stock'] : ['b-red','Out of stock'];
  return `<div class="card">
  <div class="card-header">
    <div class="card-title">💊 Medicine Inventory</div>
    <span class="badge b-blue">${medicines.length} items</span>
  </div>
  <table class="tbl">
    <thead><tr><th>Medicine</th><th>Generic</th><th>Strength</th><th>Qty</th><th>Govt ₹</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody id="med-stock-rows">
    ${medicines.map(m => {
      const [cls,label] = stockBadge(m);
      return `<tr id="mrow-${m.id}">
        <td><strong>${m.name}</strong></td>
        <td style="color:var(--text3)">${m.generic_name||'—'}</td>
        <td>${m.strength||'—'}</td>
        <td><input id="qty-${m.id}" type="number" value="${m.quantity_available}" style="width:70px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:12px" /></td>
        <td><input id="price-${m.id}" type="number" step="0.01" value="${m.unit_price_govt||0}" style="width:70px;padding:4px 7px;border:1px solid var(--border);border-radius:5px;font-size:12px" /></td>
        <td><span class="badge ${cls}">${label}</span></td>
        <td><button class="btn btn-teal btn-sm" onclick="updateMedStock(${m.id})">Save</button></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
</div>
<div class="card">
  <div class="card-header"><div class="card-title">➕ Add New Medicine</div></div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Medicine name *</label><input class="form-input" id="nm-name" placeholder="e.g. Paracetamol 500mg" /></div>
    <div class="form-group"><label class="form-label">Generic name</label><input class="form-input" id="nm-generic" placeholder="e.g. Paracetamol" /></div>
  </div>
  <div class="form-row-3">
    <div class="form-group"><label class="form-label">Strength</label><input class="form-input" id="nm-strength" placeholder="e.g. 500mg" /></div>
    <div class="form-group"><label class="form-label">Qty available</label><input class="form-input" id="nm-qty" type="number" value="0" /></div>
    <div class="form-group"><label class="form-label">Source</label>
      <select class="form-select" id="nm-source"><option value="govt">Government</option><option value="private">Private</option></select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Govt price ₹/unit</label><input class="form-input" id="nm-gprice" type="number" step="0.01" value="0" /></div>
    <div class="form-group"><label class="form-label">Private price ₹/unit</label><input class="form-input" id="nm-pprice" type="number" step="0.01" value="0" /></div>
  </div>
  <button class="btn btn-teal" onclick="addNewMedicine(${hid})">Add Medicine to Inventory</button>
</div>`;
}

async function updateMedStock(id) {
  const qty   = +document.getElementById(`qty-${id}`).value;
  const price = +document.getElementById(`price-${id}`).value;
  try {
    await apiFetch(`/medicines/${id}`, { method:'PUT', body:{ quantity_available:qty, unit_price_govt:price } });
    toast('✅ Stock updated');
    renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='medstock'));
  } catch(e) { toast('❌ '+e.message); }
}

async function addNewMedicine(hid) {
  const name = document.getElementById('nm-name').value.trim();
  if (!name) { toast('Medicine name is required'); return; }
  try {
    await apiFetch('/medicines', { method:'POST', body:{
      name,
      generic_name: document.getElementById('nm-generic').value.trim(),
      strength:     document.getElementById('nm-strength').value.trim(),
      quantity_available: +document.getElementById('nm-qty').value,
      unit_price_govt:    +document.getElementById('nm-gprice').value,
      unit_price_private: +document.getElementById('nm-pprice').value,
      source:             document.getElementById('nm-source').value
    }});
    toast('✅ Medicine added to inventory');
    renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='medstock'));
  } catch(e) { toast('❌ '+e.message); }
}

// ── Render lock — prevents concurrent re-renders causing blank page ────────────
let _resRendering = false;

// ── Page: Reservations Inbox (Hospital Admin) ─────────────────────────────────
async function pageReservations() {
  const user = getUser();
  const hid = user?.hospital_id || 1;
  const [{ reservations: medRes }, { reservations: bedRes }] = await Promise.all([
    apiFetch('/medicines/reservations'),
    apiFetch(`/hospitals/${hid}/bed-reservations`)
  ]);

  const medStatusCls = s => s==='collected'?'b-green':s==='ready'?'b-blue':s==='expired'?'b-gray':'b-amber';
  const bedStatusCls = s => s==='confirmed'?'b-green':s==='cancelled'?'b-gray':'b-amber';

  const pendingMed = medRes.filter(r=>r.status==='pending').length;
  const pendingBed = bedRes.filter(r=>r.status==='pending').length;

  // Med actions — wrapped in <div> inside <td> to avoid display:flex on td
  const medActions = r => {
    const btns = [];
    if (r.status==='pending') btns.push(`<button class="btn btn-teal btn-sm" onclick="updateMedRes(this,${r.id},'ready')">Mark Ready</button>`);
    if (r.status==='ready')   btns.push(`<button class="btn btn-outline btn-sm" onclick="updateMedRes(this,${r.id},'collected')">Collected ✓</button>`);
    if (r.status==='pending'||r.status==='ready') btns.push(`<button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="updateMedRes(this,${r.id},'expired')">Cancel</button>`);
    return btns.length ? `<div style="display:flex;gap:5px;flex-wrap:wrap">${btns.join('')}</div>` : '<span style="color:var(--text3);font-size:11px">—</span>';
  };

  const bedActions = (r) => {
    if (r.status !== 'pending') return '<span style="color:var(--text3);font-size:11px">—</span>';
    return `<div style="display:flex;gap:5px">
      <button class="btn btn-teal btn-sm" onclick="updateBedRes(this,${hid},${r.id},'confirmed')">Confirm</button>
      <button class="btn btn-outline btn-sm" style="color:var(--danger)" onclick="updateBedRes(this,${hid},${r.id},'cancelled')">Cancel</button>
    </div>`;
  };

  return `<div class="card">
  <div class="card-header">
    <div><div class="card-title">💊 Medicine Reservations</div><div class="card-subtitle">Patients waiting to collect medicines</div></div>
    ${pendingMed>0?`<span class="badge b-amber">${pendingMed} pending</span>`:'<span class="badge b-green">All clear</span>'}
  </div>
  ${!medRes.length
    ? '<div style="text-align:center;padding:20px;color:var(--text3)">No medicine reservations yet</div>'
    : `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Patient</th><th>Medicine</th><th>Qty</th><th>Reserved</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>${medRes.map(r=>`<tr>
    <td><div style="font-weight:600">${r.patient_name}</div><div style="font-size:10.5px;color:var(--text3)">${r.patient_mobile} · ${r.patient_ref}</div></td>
    <td>${r.medicine_name}${r.strength?' ('+r.strength+')':''}</td>
    <td>${r.quantity}</td>
    <td style="font-size:11px;color:var(--text3);white-space:nowrap">${r.reserved_at?.split(' ')[0]||'—'}</td>
    <td><span class="badge ${medStatusCls(r.status)}">${r.status}</span></td>
    <td>${medActions(r)}</td>
  </tr>`).join('')}</tbody></table></div>`}
</div>
<div class="card">
  <div class="card-header">
    <div><div class="card-title">🛏️ Bed Reservations</div><div class="card-subtitle">Patients requesting a bed</div></div>
    ${pendingBed>0?`<span class="badge b-amber">${pendingBed} pending</span>`:'<span class="badge b-green">All clear</span>'}
  </div>
  ${!bedRes.length
    ? '<div style="text-align:center;padding:20px;color:var(--text3)">No bed reservations yet</div>'
    : `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Patient</th><th>Ward</th><th>Reason</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
  <tbody>${bedRes.map(r=>`<tr>
    <td><div style="font-weight:600">${r.patient_name}</div><div style="font-size:10.5px;color:var(--text3)">${r.patient_mobile} · ${r.patient_ref}</div><div style="font-size:10.5px;color:var(--text3)">${r.age}y / ${r.gender==='M'?'Male':r.gender==='F'?'Female':'Other'} · 🩸 ${r.blood_group||'—'}</div></td>
    <td style="white-space:nowrap">${r.ward_preference||'<span style="color:var(--text3)">Any</span>'}</td>
    <td style="font-size:11.5px">${r.reason||'—'}</td>
    <td style="font-size:11px;color:var(--text3);white-space:nowrap">${r.reserved_at?.split(' ')[0]||'—'}</td>
    <td><span class="badge ${bedStatusCls(r.status)}">${r.status}</span></td>
    <td>${bedActions(r)}</td>
  </tr>`).join('')}</tbody></table></div>`}
</div>`;
}

// Shared helper — disables the clicked button, runs the update,
// then re-renders. Lock prevents a second click causing a blank page.
async function _doResUpdate(btn, apiFn) {
  if (_resRendering) return;       // block concurrent renders
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  _resRendering = true;
  try {
    await apiFn();
    await renderTab(tabsForRole[currentRole].findIndex(t=>t.id==='reservations'));
  } finally {
    _resRendering = false;
    // btn is now inside stale DOM — no need to re-enable
  }
}

async function updateMedRes(btn, id, status) {
  await _doResUpdate(btn, async () => {
    await apiFetch(`/medicines/reservations/${id}/status`, { method:'PATCH', body:{ status } });
    toast(`✅ Reservation marked as ${status}`);
  });
}

async function updateBedRes(btn, hid, rid, status) {
  await _doResUpdate(btn, async () => {
    await apiFetch(`/hospitals/${hid}/bed-reservations/${rid}/status`, { method:'PATCH', body:{ status } });
    toast(`✅ Bed reservation ${status}`);
  });
}

// ── Route getPage to async functions ──────────────────────────────────────────
async function getPage(id) {
  const map = {
    home: pageHome, beds: pageBeds, meds: pageMeds, emg: pageEmg, records: pageRecords,
    dash: pageDash, update: pageUpdate, shortage: pageShortage, audit: pageAudit,
    patrecords: pagePatRecords, medstock: pageMedicineStock, reservations: pageReservations,
    district: pageDistrict, govtshortage: pageGovtShortage
  };
  return (map[id] ? await map[id]() : '<div class="card">Coming soon.</div>');
}
