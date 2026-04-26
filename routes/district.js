const router = require('express').Router();
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/district/overview  — aggregated view per block
router.get('/overview', authenticate, requireRole('govt'), (req, res) => {
  const blocks = db.prepare(`
    SELECT h.block,
           SUM(r.beds_free)       AS total_beds_free,
           SUM(r.o2_cylinders)    AS total_o2,
           SUM(r.blood_bank_units)AS total_blood,
           COUNT(h.id)            AS facility_count,
           MIN(r.o2_cylinders)    AS min_o2,
           MIN(r.beds_free)       AS min_beds
    FROM hospitals h
    JOIN hospital_resources r ON h.id=r.hospital_id
    GROUP BY h.block
    ORDER BY h.block
  `).all().map(b => ({
    ...b,
    o2_status:  b.min_o2  === 0 ? 'Critical' : b.min_o2  < 5  ? 'Low' : 'OK',
    bed_status: b.min_beds === 0 ? 'Critical' : b.min_beds < 4 ? 'Low' : 'OK',
    overall:    (b.min_o2 === 0 || b.min_beds === 0) ? 'red' : (b.min_o2 < 5 || b.min_beds < 4) ? 'amber' : 'green'
  }));

  const totals = {
    blocks: blocks.length,
    critical_alerts: blocks.filter(b=>b.overall==='red').length,
    caution_alerts:  blocks.filter(b=>b.overall==='amber').length,
    total_beds_free: blocks.reduce((s,b)=>s+b.total_beds_free,0)
  };

  // Pending action items
  const pending_shortages = db.prepare(`
    SELECT sr.*, h.name AS hospital_name, h.block
    FROM shortage_requests sr JOIN hospitals h ON sr.hospital_id=h.id
    WHERE sr.status='pending'
    ORDER BY CASE sr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END
  `).all();

  res.json({ blocks, totals, pending_shortages });
});

// GET /api/district/shortages  — all pending shortages for govt
router.get('/shortages', authenticate, requireRole('govt'), (req, res) => {
  const shortages = db.prepare(`
    SELECT sr.*, h.name AS hospital_name, h.block,
           u.name AS raised_by_name, a.name AS approved_by_name
    FROM shortage_requests sr
    JOIN hospitals h ON sr.hospital_id=h.id
    LEFT JOIN users u ON sr.raised_by=u.id
    LEFT JOIN users a ON sr.approved_by=a.id
    ORDER BY CASE sr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, sr.raised_at DESC
  `).all();
  res.json({ shortages });
});

// POST /api/district/dispatch  — bulk approve all pending critical
router.post('/dispatch', authenticate, requireRole('govt'), (req, res) => {
  const pending = db.prepare("SELECT id,ref_number FROM shortage_requests WHERE status='pending' AND priority='critical'").all();
  const update = db.prepare("UPDATE shortage_requests SET status='approved', approved_by=?, updated_at=datetime('now') WHERE id=?");
  const log = db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id)
                          VALUES (?,?,'submit',?,'shortage_requests',?)`);

  db.transaction(items => {
    for (const sr of items) {
      update.run(req.user.id, sr.id);
      log.run(req.user.id, req.user.name, `Bulk approved critical shortage: ${sr.ref_number}`, sr.id);
    }
  })(pending);

  res.json({ message: `${pending.length} critical requests approved`, approved: pending.map(s=>s.ref_number) });
});

// GET /api/district/reports  — summary stats for reports tab
router.get('/reports', authenticate, requireRole('govt'), (req, res) => {
  const stats = {
    total_hospitals:   db.prepare('SELECT COUNT(*) AS c FROM hospitals').get().c,
    total_patients:    db.prepare('SELECT COUNT(*) AS c FROM patients').get().c,
    active_patients:   db.prepare("SELECT COUNT(*) AS c FROM patients WHERE status='active'").get().c,
    shortages_pending: db.prepare("SELECT COUNT(*) AS c FROM shortage_requests WHERE status='pending'").get().c,
    shortages_critical:db.prepare("SELECT COUNT(*) AS c FROM shortage_requests WHERE status='pending' AND priority='critical'").get().c,
    sos_this_month:    db.prepare("SELECT COUNT(*) AS c FROM emergency_calls WHERE triggered_at >= date('now','start of month')").get().c,
    recent_audit:      db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 10').all()
  };
  res.json({ stats });
});

module.exports = router;
