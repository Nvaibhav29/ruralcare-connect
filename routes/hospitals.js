const router = require('express').Router();
const db     = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/hospitals
router.get('/', authenticate, async (req, res) => {
  const hospitals = await db.all(`
    SELECT h.*, r.beds_free, r.icu_free, r.o2_cylinders, r.doctors_on_duty,
           r.ventilators_free, r.blood_bank_units, r.public_alert_msg,
           r.updated_at AS res_updated_at
    FROM hospitals h
    LEFT JOIN hospital_resources r ON h.id = r.hospital_id
    ORDER BY h.id
  `);
  res.json({ hospitals });
});

// GET /api/hospitals/:id
router.get('/:id', authenticate, async (req, res) => {
  const h = await db.get(`
    SELECT h.*, r.beds_free, r.icu_free, r.o2_cylinders, r.doctors_on_duty,
           r.ventilators_free, r.blood_bank_units, r.public_alert_msg,
           r.updated_at AS res_updated_at
    FROM hospitals h
    LEFT JOIN hospital_resources r ON h.id = r.hospital_id
    WHERE h.id = ?
  `, [req.params.id]);
  if (!h) return res.status(404).json({ error: 'Hospital not found' });
  res.json({ hospital: h });
});

// GET /api/hospitals/:id/resources
router.get('/:id/resources', authenticate, async (req, res) => {
  const r = await db.get('SELECT * FROM hospital_resources WHERE hospital_id = ?', [req.params.id]);
  res.json({ resources: r || null });
});

// PUT /api/hospitals/:id/resources  — hospital admin only
router.put('/:id/resources', authenticate, requireRole('hospital'), async (req, res) => {
  const hid = parseInt(req.params.id);
  if (req.user.hospital_id && req.user.hospital_id !== hid)
    return res.status(403).json({ error: 'Can only update your own hospital' });

  const { beds_free, icu_free, o2_cylinders, doctors_on_duty,
          ventilators_free, blood_bank_units, public_alert_msg } = req.body;

  const existing = await db.get('SELECT id FROM hospital_resources WHERE hospital_id=?', [hid]);
  if (existing) {
    await db.run(
      `UPDATE hospital_resources SET beds_free=?,icu_free=?,o2_cylinders=?,doctors_on_duty=?,
       ventilators_free=?,blood_bank_units=?,public_alert_msg=?,updated_by=?,updated_at=NOW()
       WHERE hospital_id=?`,
      [beds_free,icu_free,o2_cylinders,doctors_on_duty,ventilators_free,blood_bank_units,public_alert_msg,req.user.id,hid]
    );
  } else {
    await db.run(
      `INSERT INTO hospital_resources (hospital_id,beds_free,icu_free,o2_cylinders,doctors_on_duty,
       ventilators_free,blood_bank_units,public_alert_msg,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [hid,beds_free,icu_free,o2_cylinders,doctors_on_duty,ventilators_free,blood_bank_units,public_alert_msg,req.user.id]
    );
  }

  // Check thresholds
  const thresholds = await db.all('SELECT * FROM resource_thresholds WHERE hospital_id=?', [hid]);
  const hosp = await db.get('SELECT name FROM hospitals WHERE id=?', [hid]);
  const vals = { beds_free, icu_free, o2_cylinders, blood_bank_units };
  for (const t of thresholds) {
    if (vals[t.resource_key] !== undefined && vals[t.resource_key] <= t.threshold_value) {
      await db.run(
        `INSERT INTO audit_log (user_name,action_type,description,entity_type,entity_id) VALUES ('System','update',?,'hospital_resources',?)`,
        [`⚠️ ALERT: ${hosp.name} — ${t.resource_key} (${vals[t.resource_key]}) at/below threshold (${t.threshold_value})`, hid]
      );
    }
  }

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'hospital_resources',?)`,
    [req.user.id, req.user.name, `Resources updated: beds=${beds_free}, ICU=${icu_free}, O2=${o2_cylinders}, doctors=${doctors_on_duty}`, hid]
  );

  res.json({ message: 'Resources updated and published' });
});

// GET /api/hospitals/:id/wards
router.get('/:id/wards', authenticate, async (req, res) => {
  const wards = await db.all('SELECT * FROM ward_status WHERE hospital_id=? ORDER BY id', [req.params.id]);
  res.json({ wards });
});

// PUT /api/hospitals/:id/wards
router.put('/:id/wards', authenticate, requireRole('hospital'), async (req, res) => {
  const hid = parseInt(req.params.id);
  const { ward_name, beds_total, beds_occupied } = req.body;
  await db.run(
    `INSERT INTO ward_status (hospital_id,ward_name,beds_total,beds_occupied)
     VALUES (?,?,?,?)
     ON CONFLICT(hospital_id,ward_name)
     DO UPDATE SET beds_total=EXCLUDED.beds_total, beds_occupied=EXCLUDED.beds_occupied, updated_at=NOW()`,
    [hid, ward_name, beds_total, beds_occupied]
  );
  res.json({ message: 'Ward updated' });
});

// GET /api/hospitals/:id/thresholds
router.get('/:id/thresholds', authenticate, requireRole('hospital','govt'), async (req, res) => {
  const t = await db.all('SELECT * FROM resource_thresholds WHERE hospital_id=?', [req.params.id]);
  res.json({ thresholds: t });
});

// PUT /api/hospitals/:id/thresholds
router.put('/:id/thresholds', authenticate, requireRole('hospital'), async (req, res) => {
  const hid = parseInt(req.params.id);
  const { thresholds } = req.body;

  await db.transaction(async (client) => {
    for (const t of thresholds) {
      await client.run(
        `INSERT INTO resource_thresholds (hospital_id,resource_key,threshold_value)
         VALUES (?,?,?)
         ON CONFLICT(hospital_id,resource_key) DO UPDATE SET threshold_value=EXCLUDED.threshold_value`,
        [hid, t.resource_key, t.threshold_value]
      );
    }
  });

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'resource_thresholds',?)`,
    [req.user.id, req.user.name, `Alert thresholds updated for hospital ${hid}`, hid]
  );

  res.json({ message: 'Thresholds saved' });
});

// POST /api/hospitals/:id/reserve-bed  (patient only)
router.post('/:id/reserve-bed', authenticate, requireRole('patient'), async (req, res) => {
  const hid = parseInt(req.params.id);
  const { ward_preference, reason } = req.body;

  const hosp = await db.get('SELECT * FROM hospital_resources WHERE hospital_id=?', [hid]);
  if (!hosp || hosp.beds_free <= 0)
    return res.status(409).json({ error: 'No beds available at this hospital right now' });

  const patient = await db.get('SELECT id, name FROM patients WHERE linked_user_id=?', [req.user.id]);
  if (!patient)
    return res.status(400).json({ error: 'No patient record linked to your account' });

  await db.run(
    `INSERT INTO bed_reservations (patient_id, hospital_id, ward_preference, reason) VALUES (?, ?, ?, ?)`,
    [patient.id, hid, ward_preference||null, reason||null]
  );

  const hospName = await db.get('SELECT name FROM hospitals WHERE id=?', [hid]);
  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'submit',?,'bed_reservations',?)`,
    [req.user.id, req.user.name, `Bed reserved at ${hospName?.name} by ${patient.name}`, hid]
  );

  res.status(201).json({ message: `Bed reservation submitted to ${hospName?.name}. They will confirm shortly.` });
});

// GET /api/hospitals/:id/bed-reservations  (hospital only)
router.get('/:id/bed-reservations', authenticate, requireRole('hospital'), async (req, res) => {
  const hid = parseInt(req.params.id);
  if (req.user.hospital_id && req.user.hospital_id !== hid)
    return res.status(403).json({ error: 'Access denied' });

  const reservations = await db.all(`
    SELECT br.*, p.name AS patient_name, p.mobile AS patient_mobile,
           p.age, p.gender, p.blood_group, p.patient_ref
    FROM bed_reservations br
    JOIN patients p ON br.patient_id = p.id
    WHERE br.hospital_id = ?
    ORDER BY br.reserved_at DESC
  `, [hid]);

  res.json({ reservations });
});

// PATCH /api/hospitals/:id/bed-reservations/:rid/status  (hospital only)
router.patch('/:id/bed-reservations/:rid/status', authenticate, requireRole('hospital'), async (req, res) => {
  const hid = parseInt(req.params.id);
  const rid = parseInt(req.params.rid);
  const { status } = req.body;

  if (!['confirmed', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'status must be confirmed or cancelled' });
  if (req.user.hospital_id && req.user.hospital_id !== hid)
    return res.status(403).json({ error: 'Access denied' });

  const reservation = await db.get('SELECT * FROM bed_reservations WHERE id=? AND hospital_id=?', [rid, hid]);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  await db.transaction(async (client) => {
    const confirmedAt = status === 'confirmed' ? 'NOW()' : 'NULL';
    await client.run(`UPDATE bed_reservations SET status=?, confirmed_at=${confirmedAt} WHERE id=?`, [status, rid]);

    const isICU = (reservation.ward_preference || '').toLowerCase() === 'icu';
    const prev  = reservation.status;

    if (status === 'confirmed' && prev === 'pending') {
      if (isICU) {
        await client.run(`UPDATE hospital_resources SET icu_free  = GREATEST(0, icu_free  - 1) WHERE hospital_id=?`, [hid]);
      } else {
        await client.run(`UPDATE hospital_resources SET beds_free = GREATEST(0, beds_free - 1) WHERE hospital_id=?`, [hid]);
      }
    }
    if (status === 'cancelled' && prev === 'confirmed') {
      if (isICU) {
        await client.run(`UPDATE hospital_resources SET icu_free  = icu_free  + 1 WHERE hospital_id=?`, [hid]);
      } else {
        await client.run(`UPDATE hospital_resources SET beds_free = beds_free + 1 WHERE hospital_id=?`, [hid]);
      }
    }

    await client.run(
      `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'bed_reservations',?)`,
      [req.user.id, req.user.name, `Bed reservation #${rid} ${status} — ${isICU?'ICU':'bed'} count updated`, rid]
    );
  });

  res.json({ message: `Reservation ${status}` });
});

module.exports = router;
