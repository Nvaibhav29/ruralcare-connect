const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db/database');
const { authenticate } = require('../middleware/auth');

// ── POST /api/auth/register  (patients only) ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, mobile, password, age, gender, blood_group, village } = req.body;

  if (!name || !mobile || !password)
    return res.status(400).json({ error: 'name, mobile and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^\d{10}$/.test(mobile.replace(/\D/g, '')))
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });

  const existing = await db.get('SELECT id FROM users WHERE login_id = ?', [mobile.trim()]);
  if (existing)
    return res.status(409).json({ error: 'An account with this mobile number already exists' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const count = await db.get('SELECT COUNT(*) AS c FROM patients');
    const refNum = String(1000 + (parseInt(count?.c) || 0) + 1).padStart(4, '0');
    const patient_ref = `PAT-${refNum}`;

    const uid = await db.transaction(async (client) => {
      const userInfo = await client.run(
        `INSERT INTO users (login_id, password_hash, role, name) VALUES (?, ?, 'patient', ?)`,
        [mobile.trim(), hash, name.trim()]
      );
      const newUid = userInfo.lastInsertRowid;

      await client.run(
        `INSERT INTO patients (patient_ref, name, mobile, age, gender, blood_group, village, linked_user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [patient_ref, name.trim(), mobile.trim(), age||null, gender||null, blood_group||null, village||null, newUid]
      );

      await client.run(
        `INSERT INTO audit_log (user_id, user_name, action_type, description, entity_type)
         VALUES (?, ?, 'submit', ?, 'users')`,
        [newUid, name.trim(), `New patient registered: ${name} (${mobile})`]
      );

      return newUid;
    });

    const user = await db.get('SELECT id, login_id, role, name, hospital_id FROM users WHERE id=?', [uid]);
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, hospital_id: null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, role: user.role, hospital_id: null },
      patient_ref
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { login_id, password } = req.body;
  if (!login_id || !password)
    return res.status(400).json({ error: 'login_id and password are required' });

  const user = await db.get('SELECT * FROM users WHERE login_id = ?', [login_id.trim()]);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, hospital_id: user.hospital_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type) VALUES (?,?,'submit',?,'auth')`,
    [user.id, user.name, `Login: ${user.name} (${user.role})`]
  );

  res.json({ token, user: { id: user.id, name: user.name, role: user.role, hospital_id: user.hospital_id } });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  await db.run(
    `INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type) VALUES (?,?,'submit',?,'auth')`,
    [req.user.id, req.user.name, `Logout: ${req.user.name}`]
  );
  res.json({ message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const user = await db.get('SELECT id,login_id,role,name,hospital_id,created_at FROM users WHERE id=?', [req.user.id]);
  res.json({ user });
});

module.exports = router;
