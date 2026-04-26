const router = require('express').Router();
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// Helper — build full patient object
function buildPatient(p) {
  const conditions = db.prepare('SELECT condition_name FROM patient_conditions WHERE patient_id=?').all(p.id).map(r=>r.condition_name);
  const meds = db.prepare('SELECT * FROM patient_medications WHERE patient_id=? AND active=1').all(p.id);
  const visits = db.prepare('SELECT * FROM patient_visits WHERE patient_id=? ORDER BY visit_date DESC').all(p.id);
  return { ...p, conditions, medications: meds, visits };
}

// GET /api/patients  — hospital admin: all patients at their hospital; govt: all
router.get('/', authenticate, requireRole('hospital','govt'), (req, res) => {
  const { q, status, page=1, limit=50 } = req.query;
  let sql = 'SELECT * FROM patients WHERE 1=1';
  const params = [];

  if (req.user.role === 'hospital' && req.user.hospital_id) {
    sql += ' AND registered_hospital_id=?'; params.push(req.user.hospital_id);
  }
  if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
  if (q) {
    sql += ' AND (name LIKE ? OR patient_ref LIKE ? OR mobile LIKE ? OR village LIKE ?)';
    const lq = `%${q}%`;
    params.push(lq, lq, lq, lq);
  }
  sql += ` ORDER BY id DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;

  const patients = db.prepare(sql).all(...params).map(p => {
    const conditions = db.prepare('SELECT condition_name FROM patient_conditions WHERE patient_id=?').all(p.id).map(r=>r.condition_name);
    return { ...p, conditions };
  });

  const totalSql = sql.replace(/SELECT \*/, 'SELECT COUNT(*) as c').replace(/ORDER BY.*$/, '');
  const total = db.prepare(totalSql).get(...params)?.c || patients.length;

  res.json({ patients, total });
});

// GET /api/patients/me  — patient sees their own record
router.get('/me', authenticate, requireRole('patient'), (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE linked_user_id=?').get(req.user.id);
  if (!p) return res.status(404).json({ error: 'No patient record linked to this account' });
  res.json({ patient: buildPatient(p) });
});

// GET /api/patients/:id
router.get('/:id', authenticate, (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found' });
  // Patient can only view own record
  if (req.user.role === 'patient' && p.linked_user_id !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });
  res.json({ patient: buildPatient(p) });
});

// POST /api/patients  — register new patient (hospital admin)
router.post('/', authenticate, requireRole('hospital'), (req, res) => {
  const { name, mobile, age, gender, blood_group, village, aadhaar_masked, conditions=[], medications=[], notes } = req.body;
  if (!name || !mobile) return res.status(400).json({ error: 'name and mobile are required' });

  // Generate patient ref
  const lastPat = db.prepare("SELECT patient_ref FROM patients ORDER BY id DESC LIMIT 1").get();
  const nextNum = lastPat ? parseInt(lastPat.patient_ref.split('-')[1]) + 1 : 1;
  const patient_ref = `PAT-${String(nextNum).padStart(4,'0')}`;

  const info = db.prepare(`INSERT INTO patients
    (patient_ref,name,mobile,age,gender,blood_group,village,aadhaar_masked,registered_hospital_id,status)
    VALUES (?,?,?,?,?,?,?,?,?,'active')`)
    .run(patient_ref,name,mobile,age,gender,blood_group,village,aadhaar_masked,req.user.hospital_id);
  const patId = info.lastInsertRowid;

  if (conditions.length) {
    const ic = db.prepare('INSERT INTO patient_conditions (patient_id,condition_name) VALUES (?,?)');
    db.transaction(cs => cs.forEach(c => ic.run(patId,c)))(conditions);
  }
  if (medications.length) {
    const im = db.prepare('INSERT INTO patient_medications (patient_id,medicine_name,dose,prescribed_by,since_date) VALUES (?,?,?,?,?)');
    db.transaction(ms => ms.forEach(m => im.run(patId,m.name,m.dose,m.prescribed_by,m.since_date)))(medications);
  }
  if (notes) {
    db.prepare('INSERT INTO patient_visits (patient_id,visit_date,location,doctor,notes,created_by) VALUES (?,date("now"),?,?,?,?)')
      .run(patId, `Hospital ID ${req.user.hospital_id}`, req.user.name, notes, req.user.id);
  }

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'admin',?,'patients',?)`)
    .run(req.user.id,req.user.name,`New patient registered: ${name} (${patient_ref})`,patId);

  res.status(201).json({ message: 'Patient registered', patient_ref, id: patId });
});

// POST /api/patients/:id/visits  — add a visit record
router.post('/:id/visits', authenticate, requireRole('hospital'), (req, res) => {
  const { visit_date, location, doctor, notes, prescription_change } = req.body;
  const p = db.prepare('SELECT id,name FROM patients WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  db.prepare(`INSERT INTO patient_visits (patient_id,visit_date,location,doctor,notes,prescription_change,created_by)
              VALUES (?,?,?,?,?,?,?)`)
    .run(p.id, visit_date||new Date().toISOString().split('T')[0], location, doctor, notes, prescription_change, req.user.id);

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'update',?,'patients',?)`)
    .run(req.user.id,req.user.name,`Visit recorded for ${p.name}: ${notes}`,p.id);

  res.status(201).json({ message: 'Visit saved' });
});

// PATCH /api/patients/:id/status  — discharge / re-admit
router.patch('/:id/status', authenticate, requireRole('hospital'), (req, res) => {
  const { status } = req.body;
  if (!['active','discharged'].includes(status))
    return res.status(400).json({ error: 'status must be active or discharged' });

  const p = db.prepare('SELECT id,name FROM patients WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Patient not found' });

  db.prepare('UPDATE patients SET status=? WHERE id=?').run(status, p.id);
  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'update',?,'patients',?)`)
    .run(req.user.id,req.user.name,`Patient ${p.name} status changed to ${status}`,p.id);

  res.json({ message: `Patient ${status}` });
});

module.exports = router;
