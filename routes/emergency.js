const router = require('express').Router();
const db     = require('../db/database');
const { authenticate } = require('../middleware/auth');

// POST /api/emergency/sos
router.post('/sos', authenticate, async (req, res) => {
  const { location_text, lat, lng, emergency_type } = req.body;

  const bestHosp = await db.get(`
    SELECT h.*, r.beds_free, r.icu_free, r.o2_cylinders, r.doctors_on_duty
    FROM hospitals h
    JOIN hospital_resources r ON h.id=r.hospital_id
    WHERE r.beds_free > 0
    ORDER BY r.beds_free DESC
    LIMIT 1
  `);

  const patient = await db.get('SELECT id FROM patients WHERE linked_user_id=?', [req.user.id]);

  const info = await db.run(
    `INSERT INTO emergency_calls (patient_id,location_text,lat,lng,emergency_type,assigned_hospital_id,status)
     VALUES (?,?,?,?,?,?,'dispatched')`,
    [patient?.id||null, location_text, lat||null, lng||null, emergency_type||'General', bestHosp?.id||1]
  );

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'submit',?,'emergency_calls',?)`,
    [req.user.id, req.user.name,
     `SOS triggered by ${req.user.name} at "${location_text||'GPS location'}". Assigned to ${bestHosp?.name||'Kolar District Hospital'}`,
     info.lastInsertRowid]
  );

  res.json({
    message: 'SOS dispatched',
    assigned_hospital: bestHosp || { name:'Kolar District Hospital', phone:'08152-222310' },
    call_id: info.lastInsertRowid,
    eta_minutes: 12
  });
});

// POST /api/emergency/find-hospital
router.post('/find-hospital', authenticate, async (req, res) => {
  const { emergency_type } = req.body;

  const hospitals = await db.all(`
    SELECT h.*, r.beds_free, r.icu_free, r.o2_cylinders, r.doctors_on_duty, r.ventilators_free
    FROM hospitals h
    JOIN hospital_resources r ON h.id=r.hospital_id
    ORDER BY r.beds_free DESC
  `);

  const scored = hospitals.map(h => {
    let score = h.beds_free * 2 + h.icu_free * 5 + h.doctors_on_duty * 3;
    if (/breath|oxygen/i.test(emergency_type||''))       score += h.o2_cylinders * 2;
    if (/cardiac|chest|stroke/i.test(emergency_type||'')) score += h.icu_free * 8;
    if (/matern|labour/i.test(emergency_type||''))        score += h.beds_free * 3;
    return { ...h, score };
  }).sort((a,b) => b.score - a.score);

  res.json({ best_hospital: scored[0], alternatives: scored.slice(1,3), emergency_type });
});

// GET /api/emergency/history
router.get('/history', authenticate, async (req, res) => {
  const calls = await db.all(`
    SELECT ec.*, h.name AS hospital_name, p.name AS patient_name
    FROM emergency_calls ec
    LEFT JOIN hospitals h ON ec.assigned_hospital_id=h.id
    LEFT JOIN patients  p ON ec.patient_id=p.id
    ORDER BY ec.triggered_at DESC LIMIT 50
  `);
  res.json({ calls });
});

module.exports = router;
