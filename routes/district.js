const router = require('express').Router();
const db     = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/district/overview
router.get('/overview', authenticate, requireRole('govt'), async (req, res) => {
  const blocks = (await db.all(`
    SELECT h.block,
           SUM(r.beds_free)        AS total_beds_free,
           SUM(r.o2_cylinders)     AS total_o2,
           SUM(r.blood_bank_units) AS total_blood,
           COUNT(h.id)             AS facility_count,
           MIN(r.o2_cylinders)     AS min_o2,
           MIN(r.beds_free)        AS min_beds
    FROM hospitals h
    JOIN hospital_resources r ON h.id=r.hospital_id
    GROUP BY h.block
    ORDER BY h.block
  `)).map(b => ({
    ...b,
    o2_status:  parseInt(b.min_o2)  === 0 ? 'Critical' : parseInt(b.min_o2)  < 5 ? 'Low' : 'OK',
    bed_status: parseInt(b.min_beds) === 0 ? 'Critical' : parseInt(b.min_beds) < 4 ? 'Low' : 'OK',
    overall:    (parseInt(b.min_o2) === 0 || parseInt(b.min_beds) === 0) ? 'red'
              : (parseInt(b.min_o2) < 5  || parseInt(b.min_beds) < 4)   ? 'amber' : 'green'
  }));

  const totals = {
    blocks:          blocks.length,
    critical_alerts: blocks.filter(b => b.overall === 'red').length,
    caution_alerts:  blocks.filter(b => b.overall === 'amber').length,
    total_beds_free: blocks.reduce((s,b) => s + parseInt(b.total_beds_free||0), 0)
  };

  const pending_shortages = await db.all(`
    SELECT sr.*, h.name AS hospital_name, h.block
    FROM shortage_requests sr JOIN hospitals h ON sr.hospital_id=h.id
    WHERE sr.status='pending'
    ORDER BY CASE sr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END
  `);

  res.json({ blocks, totals, pending_shortages });
});

// GET /api/district/shortages
router.get('/shortages', authenticate, requireRole('govt'), async (req, res) => {
  const shortages = await db.all(`
    SELECT sr.*, h.name AS hospital_name, h.block,
           u.name AS raised_by_name, a.name AS approved_by_name
    FROM shortage_requests sr
    JOIN hospitals h ON sr.hospital_id=h.id
    LEFT JOIN users u ON sr.raised_by=u.id
    LEFT JOIN users a ON sr.approved_by=a.id
    ORDER BY CASE sr.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, sr.raised_at DESC
  `);
  res.json({ shortages });
});

// POST /api/district/dispatch  — bulk approve all pending critical
router.post('/dispatch', authenticate, requireRole('govt'), async (req, res) => {
  const pending = await db.all("SELECT id,ref_number FROM shortage_requests WHERE status='pending' AND priority='critical'");

  await db.transaction(async (client) => {
    for (const sr of pending) {
      await client.run(
        `UPDATE shortage_requests SET status='approved', approved_by=?, updated_at=NOW() WHERE id=?`,
        [req.user.id, sr.id]
      );
      await client.run(
        `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type,entity_id) VALUES (?,?,'submit',?,'shortage_requests',?)`,
        [req.user.id, req.user.name, `Bulk approved critical shortage: ${sr.ref_number}`, sr.id]
      );
    }
  });

  res.json({ message: `${pending.length} critical requests approved`, approved: pending.map(s => s.ref_number) });
});

// GET /api/district/reports
router.get('/reports', authenticate, requireRole('govt'), async (req, res) => {
  const [th, tp, ta, sp, sc, ss, ra] = await Promise.all([
    db.get('SELECT COUNT(*) AS c FROM hospitals'),
    db.get('SELECT COUNT(*) AS c FROM patients'),
    db.get("SELECT COUNT(*) AS c FROM patients WHERE status='active'"),
    db.get("SELECT COUNT(*) AS c FROM shortage_requests WHERE status='pending'"),
    db.get("SELECT COUNT(*) AS c FROM shortage_requests WHERE status='pending' AND priority='critical'"),
    db.get(`SELECT COUNT(*) AS c FROM emergency_calls WHERE triggered_at >= DATE_TRUNC('month', NOW())`),
    db.all('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 10')
  ]);

  res.json({ stats: {
    total_hospitals:    parseInt(th?.c||0),
    total_patients:     parseInt(tp?.c||0),
    active_patients:    parseInt(ta?.c||0),
    shortages_pending:  parseInt(sp?.c||0),
    shortages_critical: parseInt(sc?.c||0),
    sos_this_month:     parseInt(ss?.c||0),
    recent_audit:       ra
  }});
});

module.exports = router;
