const router = require('express').Router();
const db     = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/medicines
router.get('/', authenticate, async (req, res) => {
  const { q, source, hospital_id } = req.query;
  let sql = `SELECT m.*, h.name AS hospital_name, h.block
             FROM medicines m JOIN hospitals h ON m.hospital_id=h.id WHERE 1=1`;
  const params = [];
  if (q)          { sql += ' AND (m.name ILIKE ? OR m.generic_name ILIKE ?)'; params.push(`%${q}%`,`%${q}%`); }
  if (source)     { sql += ' AND m.source=?'; params.push(source); }
  if (hospital_id){ sql += ' AND m.hospital_id=?'; params.push(hospital_id); }
  sql += ' ORDER BY m.quantity_available DESC, m.name';
  res.json({ medicines: await db.all(sql, params) });
});

// GET /api/medicines/price-comparison
router.get('/price-comparison', authenticate, async (req, res) => {
  const rows = (await db.all(`
    SELECT name, MAX(unit_price_govt) AS govt, MAX(unit_price_private) AS private
    FROM medicines WHERE unit_price_govt > 0 AND unit_price_private > 0
    GROUP BY name ORDER BY name
  `)).map(r => ({ ...r, save_pct: Math.round((1 - r.govt/r.private)*100) }));
  res.json({ comparison: rows });
});

// GET /api/medicines/reservations  (hospital only)
router.get('/reservations', authenticate, requireRole('hospital'), async (req, res) => {
  const hid = req.user.hospital_id;
  if (!hid) return res.status(400).json({ error: 'No hospital linked to your account' });

  const reservations = await db.all(`
    SELECT mr.*, m.name AS medicine_name, m.strength, m.hospital_id,
           p.name AS patient_name, p.mobile AS patient_mobile,
           p.patient_ref, p.village
    FROM medicine_reservations mr
    JOIN medicines m ON mr.medicine_id = m.id
    JOIN patients  p ON mr.patient_id  = p.id
    WHERE m.hospital_id = ?
    ORDER BY mr.reserved_at DESC
  `, [hid]);

  res.json({ reservations });
});

// PATCH /api/medicines/reservations/:id/status
router.patch('/reservations/:id/status', authenticate, requireRole('hospital'), async (req, res) => {
  const { status } = req.body;
  if (!['pending','ready','collected','expired'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  const rid = parseInt(req.params.id);
  const hid = req.user.hospital_id;

  const existing = await db.get(`
    SELECT mr.* FROM medicine_reservations mr
    JOIN medicines m ON mr.medicine_id = m.id
    WHERE mr.id = ? AND m.hospital_id = ?
  `, [rid, hid]);
  if (!existing) return res.status(404).json({ error: 'Reservation not found' });

  const extra = status === 'collected' ? `, collected_at=NOW()` : '';
  await db.run(`UPDATE medicine_reservations SET status=?${extra} WHERE id=?`, [status, rid]);

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'medicine_reservations',?)`,
    [req.user.id, req.user.name, `Medicine reservation #${rid} marked as ${status}`, rid]
  );

  res.json({ message: `Reservation marked as ${status}` });
});

// GET /api/medicines/:id
router.get('/:id', authenticate, async (req, res) => {
  const m = await db.get(`SELECT m.*, h.name AS hospital_name FROM medicines m
                           JOIN hospitals h ON m.hospital_id=h.id WHERE m.id=?`, [req.params.id]);
  if (!m) return res.status(404).json({ error: 'Medicine not found' });
  res.json({ medicine: m });
});

// POST /api/medicines/:id/reserve
router.post('/:id/reserve', authenticate, requireRole('patient'), async (req, res) => {
  const med = await db.get('SELECT * FROM medicines WHERE id=?', [req.params.id]);
  if (!med) return res.status(404).json({ error: 'Medicine not found' });
  if (med.quantity_available <= 0) return res.status(409).json({ error: 'Out of stock' });

  const patient = await db.get('SELECT id FROM patients WHERE linked_user_id=?', [req.user.id]);
  if (!patient) return res.status(400).json({ error: 'No patient record linked. Contact hospital admin.' });

  const { quantity = 1 } = req.body;
  if (quantity > med.quantity_available)
    return res.status(409).json({ error: `Only ${med.quantity_available} units available` });

  await db.run('INSERT INTO medicine_reservations (medicine_id,patient_id,quantity) VALUES (?,?,?)', [med.id, patient.id, quantity]);
  await db.run('UPDATE medicines SET quantity_available=quantity_available-? WHERE id=?', [quantity, med.id]);

  const hosp = await db.get('SELECT name FROM hospitals WHERE id=?', [med.hospital_id]);
  res.json({ message: `${med.name} reserved. Collect within 4 hours from ${hosp?.name||'dispensary'}.` });
});

// PUT /api/medicines/:id
router.put('/:id', authenticate, requireRole('hospital'), async (req, res) => {
  const { quantity_available, unit_price_govt } = req.body;
  const med = await db.get('SELECT * FROM medicines WHERE id=?', [req.params.id]);
  if (!med) return res.status(404).json({ error: 'Medicine not found' });

  await db.run(
    `UPDATE medicines SET quantity_available=?,unit_price_govt=?,updated_at=NOW() WHERE id=?`,
    [quantity_available??med.quantity_available, unit_price_govt??med.unit_price_govt, med.id]
  );
  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'update',?,'medicines',?)`,
    [req.user.id,req.user.name,`Stock updated: ${med.name} → qty ${quantity_available}`,med.id]
  );
  res.json({ message: 'Updated' });
});

// POST /api/medicines
router.post('/', authenticate, requireRole('hospital'), async (req, res) => {
  const { name, generic_name, strength, quantity_available, unit_price_govt, unit_price_private, source='govt' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const info = await db.run(
    `INSERT INTO medicines (hospital_id,name,generic_name,strength,quantity_available,unit_price_govt,unit_price_private,source)
     VALUES (?,?,?,?,?,?,?,?)`,
    [req.user.hospital_id,name,generic_name,strength,quantity_available||0,unit_price_govt||0,unit_price_private||0,source]
  );
  res.status(201).json({ message: 'Medicine added', id: info.lastInsertRowid });
});

module.exports = router;
