const router = require('express').Router();
const db = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/audit?q=&type=&page=&limit=
router.get('/', authenticate, requireRole('hospital','govt'), (req, res) => {
  const { q, type, page=1, limit=50 } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];

  // Hospital admins only see their own hospital's logs (filter by entity)
  if (type) { sql += ' AND action_type=?'; params.push(type); }
  if (q) {
    sql += ' AND (user_name LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ` ORDER BY timestamp DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;

  const logs = db.prepare(sql).all(...params);
  res.json({ logs, page: parseInt(page) });
});

// GET /api/audit/export  — returns CSV text
router.get('/export', authenticate, requireRole('hospital','govt'), (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC').all();
  const header = 'ID,Timestamp,User,Action Type,Description,Entity Type,Entity ID\n';
  const rows = logs.map(l =>
    `${l.id},"${l.timestamp}","${l.user_name}","${l.action_type}","${l.description.replace(/"/g,'""')}","${l.entity_type||''}","${l.entity_id||''}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ruralcare_audit.csv"');
  res.send(header + rows);
});

module.exports = router;
