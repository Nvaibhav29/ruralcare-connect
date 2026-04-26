const router = require('express').Router();
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/hospitals  — patient & govt see all; hospital admin sees own
router.get('/', authenticate, (req, res) => {
  const hospitals = db.prepare(`
    SELECT h.*, r.beds_free, r.icu_free, r.o2_cylinders, r.doctors_on_duty,
           r.ventilators_free, r.blood_bank_units, r.public_alert_msg,
           r.updated_at AS res_updated_at
    FROM hospitals h
    LEFT JOIN hospital_resources r ON h.id = r.hospital_id
    ORDER BY h.id
  `).all();
  res.json({ hospitals });
});

// GET /api/hospitals/:id
router.get('/:id', authenticate, (req, res) => {
  const h = db.prepare(`
    SELECT h.*, r.beds_free, r.icu_free, r.o2_cylinders, r.doctors_on_duty,
           r.ventilators_free, r.blood_bank_units, r.public_alert_msg,
           r.updated_at AS res_updated_at
    FROM hospitals h
    LEFT JOIN hospital_resources r ON h.id = r.hospital_id
    WHERE h.id = ?
  `).get(req.params.id);
  if (!h) return res.status(404).json({ error: 'Hospital not found' });
  res.json({ hospital: h });
});

// GET /api/hospitals/:id/resources
router.get('/:id/resources', authenticate, (req, res) => {
  const r = db.prepare('SELECT * FROM hospital_resources WHERE hospital_id = ?').get(req.params.id);
  res.json({ resources: r || null });
});

// PUT /api/hospitals/:id/resources  — hospital admin only
router.put('/:id/resources', authenticate, requireRole('hospital'), (req, res) => {
  const hid = parseInt(req.params.id);
  if (req.user.hospital_id && req.user.hospital_id !== hid)
    return res.status(403).json({ error: 'Can only update your own hospital' });

  const { beds_free, icu_free, o2_cylinders, doctors_on_duty,
          ventilators_free, blood_bank_units, public_alert_msg } = req.body;

  const existing = db.prepare('SELECT id FROM hospital_resources WHERE hospital_id=?').get(hid);
  if (existing) {
    db.prepare(`UPDATE hospital_resources SET
      beds_free=?,icu_free=?,o2_cylinders=?,doctors_on_duty=?,
      ventilators_free=?,blood_bank_units=?,public_alert_msg=?,
      updated_by=?,updated_at=datetime('now')
      WHERE hospital_id=?`)
      .run(beds_free,icu_free,o2_cylinders,doctors_on_duty,
           ventilators_free,blood_bank_units,public_alert_msg,req.user.id,hid);
  } else {
    db.prepare(`INSERT INTO hospital_resources
      (hospital_id,beds_free,icu_free,o2_cylinders,doctors_on_duty,
       ventilators_free,blood_bank_units,public_alert_msg,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(hid,beds_free,icu_free,o2_cylinders,doctors_on_duty,
           ventilators_free,blood_bank_units,public_alert_msg,req.user.id);
  }

  // check thresholds
  const thresholds = db.prepare('SELECT * FROM resource_thresholds WHERE hospital_id=?').all(hid);
  const hosp = db.prepare('SELECT name FROM hospitals WHERE id=?').get(hid);
  const vals = { beds_free, icu_free, o2_cylinders, blood_bank_units };
  for (const t of thresholds) {
    if (vals[t.resource_key] !== undefined && vals[t.resource_key] <= t.threshold_value) {
      db.prepare(`INSERT INTO audit_log (user_name,action_type,description,entity_type,entity_id)
                  VALUES ('System','update',?,'hospital_resources',?)`)
        .run(`⚠️ ALERT: ${hosp.name} — ${t.resource_key} (${vals[t.resource_key]}) at/below threshold (${t.threshold_value})`, hid);
    }
  }

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'update',?,'hospital_resources',?)`)
    .run(req.user.id, req.user.name,
         `Resources updated: beds=${beds_free}, ICU=${icu_free}, O₂=${o2_cylinders}, doctors=${doctors_on_duty}`, hid);

  res.json({ message: 'Resources updated and published' });
});

// GET /api/hospitals/:id/wards
router.get('/:id/wards', authenticate, (req, res) => {
  const wards = db.prepare('SELECT * FROM ward_status WHERE hospital_id=? ORDER BY id').all(req.params.id);
  res.json({ wards });
});

// PUT /api/hospitals/:id/wards  — update a single ward
router.put('/:id/wards', authenticate, requireRole('hospital'), (req, res) => {
  const hid = parseInt(req.params.id);
  const { ward_name, beds_total, beds_occupied } = req.body;
  db.prepare(`INSERT INTO ward_status (hospital_id,ward_name,beds_total,beds_occupied)
              VALUES (?,?,?,?)
              ON CONFLICT(hospital_id,ward_name)
              DO UPDATE SET beds_total=excluded.beds_total,
                            beds_occupied=excluded.beds_occupied,
                            updated_at=datetime('now')`)
    .run(hid, ward_name, beds_total, beds_occupied);
  res.json({ message: 'Ward updated' });
});

// GET /api/hospitals/:id/thresholds
router.get('/:id/thresholds', authenticate, requireRole('hospital','govt'), (req, res) => {
  const t = db.prepare('SELECT * FROM resource_thresholds WHERE hospital_id=?').all(req.params.id);
  res.json({ thresholds: t });
});

// PUT /api/hospitals/:id/thresholds
router.put('/:id/thresholds', authenticate, requireRole('hospital'), (req, res) => {
  const hid = parseInt(req.params.id);
  const { thresholds } = req.body; // [{resource_key, threshold_value}]

  const upsert = db.prepare(`INSERT INTO resource_thresholds (hospital_id,resource_key,threshold_value)
    VALUES (?,?,?)
    ON CONFLICT(hospital_id,resource_key) DO UPDATE SET threshold_value=excluded.threshold_value`);
  const run = db.transaction(items => { for (const t of items) upsert.run(hid, t.resource_key, t.threshold_value); });
  run(thresholds);

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'update',?,'resource_thresholds',?)`)
    .run(req.user.id, req.user.name, `Alert thresholds updated for hospital ${hid}`, hid);

  res.json({ message: 'Thresholds saved' });
});

// ── POST /api/hospitals/:id/reserve-bed  (patient only) ──────────────────────
router.post('/:id/reserve-bed', authenticate, requireRole('patient'), (req, res) => {
  const hid = parseInt(req.params.id);
  const { ward_preference, reason } = req.body;

  const hosp = db.prepare('SELECT * FROM hospital_resources WHERE hospital_id=?').get(hid);
  if (!hosp || hosp.beds_free <= 0)
    return res.status(409).json({ error: 'No beds available at this hospital right now' });

  const patient = db.prepare('SELECT id, name FROM patients WHERE linked_user_id=?').get(req.user.id);
  if (!patient)
    return res.status(400).json({ error: 'No patient record linked to your account' });

  db.prepare(`
    INSERT INTO bed_reservations (patient_id, hospital_id, ward_preference, reason)
    VALUES (?, ?, ?, ?)
  `).run(patient.id, hid, ward_preference || null, reason || null);

  const hospName = db.prepare('SELECT name FROM hospitals WHERE id=?').get(hid);

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'submit',?,'bed_reservations',?)`)
    .run(req.user.id, req.user.name,
         `Bed reserved at ${hospName?.name || 'hospital'} by ${patient.name}`, hid);

  res.status(201).json({ message: `Bed reservation submitted to ${hospName?.name || 'hospital'}. They will confirm shortly.` });
});

// ── GET /api/hospitals/:id/bed-reservations  (hospital only) ──────────────────
router.get('/:id/bed-reservations', authenticate, requireRole('hospital'), (req, res) => {
  const hid = parseInt(req.params.id);
  if (req.user.hospital_id && req.user.hospital_id !== hid)
    return res.status(403).json({ error: 'Access denied' });

  const reservations = db.prepare(`
    SELECT br.*, p.name AS patient_name, p.mobile AS patient_mobile,
           p.age, p.gender, p.blood_group, p.patient_ref
    FROM bed_reservations br
    JOIN patients p ON br.patient_id = p.id
    WHERE br.hospital_id = ?
    ORDER BY br.reserved_at DESC
  `).all(hid);

  res.json({ reservations });
});

// ── PATCH /api/hospitals/:id/bed-reservations/:rid/status  (hospital only) ────
router.patch('/:id/bed-reservations/:rid/status', authenticate, requireRole('hospital'), (req, res) => {
  const hid = parseInt(req.params.id);
  const rid = parseInt(req.params.rid);
  const { status } = req.body;

  if (!['confirmed', 'cancelled'].includes(status))
    return res.status(400).json({ error: 'status must be confirmed or cancelled' });

  if (req.user.hospital_id && req.user.hospital_id !== hid)
    return res.status(403).json({ error: 'Access denied' });

  const reservation = db.prepare('SELECT * FROM bed_reservations WHERE id=? AND hospital_id=?').get(rid, hid);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  const applyChange = db.transaction(() => {
    // Update status
    const confirmedAt = status === 'confirmed' ? `datetime('now')` : 'NULL';
    db.prepare(`UPDATE bed_reservations SET status=?, confirmed_at=${confirmedAt} WHERE id=?`)
      .run(status, rid);

    const isICU = (reservation.ward_preference || '').toLowerCase() === 'icu';
    const prev  = reservation.status;

    // Confirming a pending reservation → decrement the appropriate free count
    if (status === 'confirmed' && prev === 'pending') {
      if (isICU) {
        db.prepare(`UPDATE hospital_resources SET icu_free  = MAX(0, icu_free  - 1) WHERE hospital_id=?`).run(hid);
      } else {
        db.prepare(`UPDATE hospital_resources SET beds_free = MAX(0, beds_free - 1) WHERE hospital_id=?`).run(hid);
      }
    }

    // Cancelling a previously confirmed reservation → restore the count
    if (status === 'cancelled' && prev === 'confirmed') {
      if (isICU) {
        db.prepare(`UPDATE hospital_resources SET icu_free  = icu_free  + 1 WHERE hospital_id=?`).run(hid);
      } else {
        db.prepare(`UPDATE hospital_resources SET beds_free = beds_free + 1 WHERE hospital_id=?`).run(hid);
      }
    }

    db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
                VALUES (?,?,'update',?,'bed_reservations',?)`)
      .run(req.user.id, req.user.name,
           `Bed reservation #${rid} ${status} — ${isICU?'ICU':'bed'} count updated`, rid);
  });

  applyChange();
  res.json({ message: `Reservation ${status}` });
});

module.exports = router;

