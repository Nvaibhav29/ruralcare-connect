const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname,'..','uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

// GET /api/shortages
router.get('/', authenticate, requireRole('hospital','govt'), (req, res) => {
  const { status, priority, hospital_id } = req.query;
  let sql = `SELECT sr.*, h.name AS hospital_name, h.block,
               u.name AS raised_by_name
             FROM shortage_requests sr
             JOIN hospitals h ON sr.hospital_id=h.id
             LEFT JOIN users u ON sr.raised_by=u.id
             WHERE 1=1`;
  const params = [];

  if (req.user.role === 'hospital' && req.user.hospital_id) {
    sql += ' AND sr.hospital_id=?'; params.push(req.user.hospital_id);
  }
  if (status)     { sql += ' AND sr.status=?';   params.push(status); }
  if (priority)   { sql += ' AND sr.priority=?'; params.push(priority); }
  if (hospital_id){ sql += ' AND sr.hospital_id=?'; params.push(hospital_id); }
  sql += ' ORDER BY CASE sr.priority WHEN "critical" THEN 1 WHEN "high" THEN 2 ELSE 3 END, sr.raised_at DESC';

  res.json({ shortages: db.prepare(sql).all(...params) });
});

// POST /api/shortages
router.post('/', authenticate, requireRole('hospital'), upload.single('bill'), (req, res) => {
  const { item_name, quantity_needed, current_stock, priority, justification, vendor_id } = req.body;
  if (!item_name || !quantity_needed) return res.status(400).json({ error: 'item_name and quantity_needed required' });

  const last = db.prepare("SELECT ref_number FROM shortage_requests ORDER BY id DESC LIMIT 1").get();
  const nextNum = last ? parseInt(last.ref_number.split('-')[2]) + 1 : 1;
  const ref_number = `SR-${new Date().getFullYear()}-${String(nextNum).padStart(4,'0')}`;

  const info = db.prepare(`INSERT INTO shortage_requests
    (ref_number,hospital_id,item_name,quantity_needed,current_stock,priority,justification,bill_file_path,vendor_id,status,raised_by)
    VALUES (?,?,?,?,?,?,?,?,?,'pending',?)`)
    .run(ref_number, req.user.hospital_id, item_name, quantity_needed, current_stock||0,
         priority||'normal', justification, req.file?.filename||null, vendor_id||null, req.user.id);

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'shortage',?,'shortage_requests',?)`)
    .run(req.user.id,req.user.name,`Shortage request ${ref_number} raised: ${item_name} (qty: ${quantity_needed}, priority: ${priority||'normal'})`,info.lastInsertRowid);

  res.status(201).json({ message: 'Shortage request submitted', ref_number, id: info.lastInsertRowid });
});

// PATCH /api/shortages/:id/status  — govt approves / dispatches
router.patch('/:id/status', authenticate, requireRole('govt','hospital'), (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','approved','dispatched','delivered'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

  const sr = db.prepare('SELECT * FROM shortage_requests WHERE id=?').get(req.params.id);
  if (!sr) return res.status(404).json({ error: 'Request not found' });

  db.prepare(`UPDATE shortage_requests SET status=?, approved_by=?, updated_at=datetime('now') WHERE id=?`)
    .run(status, req.user.id, sr.id);

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
              VALUES (?,?,'submit',?,'shortage_requests',?)`)
    .run(req.user.id,req.user.name,`Shortage ${sr.ref_number} status changed to "${status}"`,sr.id);

  res.json({ message: `Request ${sr.ref_number} marked as ${status}` });
});

// GET /api/shortages/vendors
router.get('/vendors', authenticate, requireRole('hospital','govt'), (req, res) => {
  res.json({ vendors: db.prepare('SELECT * FROM vendors WHERE verified=1 ORDER BY rating DESC').all() });
});

module.exports = router;
