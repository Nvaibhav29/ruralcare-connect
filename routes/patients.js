const router = require('express').Router();
const db     = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// Helper — build full patient object
async function buildPatient(p) {
  const conditions = (await db.all('SELECT condition_name FROM patient_conditions WHERE patient_id=?', [p.id])).map(r => r.condition_name);
  const meds       = await db.all('SELECT * FROM patient_medications WHERE patient_id=? AND active=1', [p.id]);
  const visits     = await db.all('SELECT * FROM patient_visits WHERE patient_id=? ORDER BY visit_date DESC', [p.id]);
  return { ...p, conditions, medications: meds, visits };
}

// GET /api/patients
router.get('/', authenticate, requireRole('hospital','govt'), async (req, res) => {
  const { q, status, page=1, limit=50 } = req.query;
  let sql = 'SELECT * FROM patients WHERE 1=1';
  const params = [];

  if (req.user.role === 'hospital' && req.user.hospital_id) {
    sql += ' AND registered_hospital_id=?'; params.push(req.user.hospital_id);
  }
  if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
  if (q) {
    sql += ' AND (name ILIKE ? OR patient_ref ILIKE ? OR mobile ILIKE ? OR village ILIKE ?)';
    const lq = `%${q}%`;
    params.push(lq, lq, lq, lq);
  }
  sql += ` ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;

  const patients = await Promise.all(
    (await db.all(sql, params)).map(async p => {
      const conditions = (await db.all('SELECT condition_name FROM patient_conditions WHERE patient_id=?', [p.id])).map(r => r.condition_name);
      return { ...p, conditions };
    })
  );

  // Count total
  const countSql = `SELECT COUNT(*) AS c FROM patients WHERE 1=1`
    + (req.user.role === 'hospital' && req.user.hospital_id ? ` AND registered_hospital_id=${req.user.hospital_id}` : '')
    + (status && status !== 'all' ? ` AND status='${status}'` : '');
  const countRow = await db.get(countSql);
  const total = parseInt(countRow?.c) || patients.length;

  res.json({ patients, total });
});

// GET /api/patients/me
router.get('/me', authenticate, requireRole('patient'), async (req, res) => {
  const p = await db.get('SELECT * FROM patients WHERE linked_user_id=?', [req.user.id]);
  if (!p) return res.status(404).json({ error: 'No patient record linked to this account' });
  res.json({ patient: await buildPatient(p) });
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  const p = await db.get('SELECT * FROM patients WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  if (req.user.role === 'patient' && p.linked_user_id !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });
  res.json({ patient: await buildPatient(p) });
});

// POST /api/patients  — register new patient (hospital admin)
router.post('/', authenticate, requireRole('hospital'), async (req, res) => {
  const { name, mobile, age, gender, blood_group, village, aadhaar_masked, conditions=[], medications=[], notes } = req.body;
  if (!name || !mobile) return res.status(400).json({ error: 'name and mobile are required' });

  const lastPat = await db.get('SELECT patient_ref FROM patients ORDER BY id DESC LIMIT 1');
  const nextNum = lastPat ? parseInt(lastPat.patient_ref.split('-')[1]) + 1 : 1;
  const patient_ref = `PAT-${String(nextNum).padStart(4,'0')}`;

  const info = await db.run(
    `INSERT INTO patients (patient_ref,name,mobile,age,gender,blood_group,village,aadhaar_masked,registered_hospital_id,status)
     VALUES (?,?,?,?,?,?,?,?,?,'active')`,
    [patient_ref,name,mobile,age,gender,blood_group,village,aadhaar_masked,req.user.hospital_id]
  );
  const patId = info.lastInsertRowid;

  for (const c of conditions) {
    await db.run('INSERT INTO patient_conditions (patient_id,condition_name) VALUES (?,?)', [patId,c]);
  }
  for (const m of medications) {
    await db.run(
      'INSERT INTO patient_medications (patient_id,medicine_name,dose,prescribed_by,since_date) VALUES (?,?,?,?,?)',
      [patId,m.name,m.dose,m.prescribed_by,m.since_date]
    );
  }
  if (notes) {
    await db.run(
      `INSERT INTO patient_visits (patient_id,visit_date,location,doctor,notes,created_by) VALUES (?,CURRENT_DATE,?,?,?,?)`,
      [patId, `Hospital ID ${req.user.hospital_id}`, req.user.name, notes, req.user.id]
    );
  }

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'admin',?,'patients',?)`,
    [req.user.id,req.user.name,`New patient registered: ${name} (${patient_ref})`,patId]
  );

  res.status(201).json({ message: 'Patient registered', patient_ref, id: patId });
});

// POST /api/patients/:id/visits
router.post('/:id/visits', authenticate, requireRole('hospital'), async (req, res) => {
  const { visit_date, location, doctor, notes, prescription_change } = req.body;
  const p = await db.get('SELECT id,name FROM patients WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  await db.run(
    `INSERT INTO patient_visits (patient_id,visit_date,location,doctor,notes,prescription_change,created_by) VALUES (?,?,?,?,?,?,?)`,
    [p.id, visit_date||new Date().toISOString().split('T')[0], location, doctor, notes, prescription_change, req.user.id]
  );

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'patients',?)`,
    [req.user.id,req.user.name,`Visit recorded for ${p.name}: ${notes}`,p.id]
  );

  res.status(201).json({ message: 'Visit saved' });
});

// PATCH /api/patients/:id/status
router.patch('/:id/status', authenticate, requireRole('hospital'), async (req, res) => {
  const { status } = req.body;
  if (!['active','discharged'].includes(status))
    return res.status(400).json({ error: 'status must be active or discharged' });

  const p = await db.get('SELECT id,name FROM patients WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  await db.run('UPDATE patients SET status=? WHERE id=?', [status, p.id]);
  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'patients',?)`,
    [req.user.id,req.user.name,`Patient ${p.name} status changed to ${status}`,p.id]
  );

  res.json({ message: `Patient ${status}` });
});

module.exports = router;
