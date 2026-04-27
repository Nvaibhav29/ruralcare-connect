const router = require('express').Router();
const db     = require('../db/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET /api/audit
router.get('/', authenticate, requireRole('hospital','govt'), async (req, res) => {
  const { q, type, page=1, limit=50 } = req.query;
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];

  if (type) { sql += ' AND action_type=?'; params.push(type); }
  if (q) {
    sql += ' AND (user_name ILIKE ? OR description ILIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ` ORDER BY timestamp DESC LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page)-1)*parseInt(limit)}`;

  const logs = await db.all(sql, params);
  res.json({ logs, page: parseInt(page) });
});

// GET /api/audit/export  — CSV
router.get('/export', authenticate, requireRole('hospital','govt'), async (req, res) => {
  const logs = await db.all('SELECT * FROM audit_log ORDER BY timestamp DESC');
  const header = 'ID,Timestamp,User,Action Type,Description,Entity Type,Entity ID\n';
  const rows = logs.map(l =>
    `${l.id},"${l.timestamp}","${l.user_name}","${l.action_type}","${(l.description||'').replace(/"/g,'""')}","${l.entity_type||''}","${l.entity_id||''}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="ruralcare_audit.csv"');
  res.send(header + rows);
});

module.exports = router;
