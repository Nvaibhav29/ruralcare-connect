const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// ── POST /api/auth/register  (patients only) ──────────────────────────────────
router.post('/register', (req, res) => {
  const { name, mobile, password, age, gender, blood_group, village } = req.body;

  // Basic validation
  if (!name || !mobile || !password)
    return res.status(400).json({ error: 'name, mobile and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^\d{10}$/.test(mobile.replace(/\D/g, '')))
    return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });

  // Check duplicate
  const existing = db.prepare('SELECT id FROM users WHERE login_id = ?').get(mobile.trim());
  if (existing)
    return res.status(409).json({ error: 'An account with this mobile number already exists' });

  try {
    const hash = bcrypt.hashSync(password, 10);

    // Generate a unique patient_ref
    const count = db.prepare('SELECT COUNT(*) AS c FROM patients').get();
    const refNum = String(1000 + (count?.c || 0) + 1).padStart(4, '0');
    const patient_ref = `PAT-${refNum}`;

    // Create user + patient in one transaction
    const createAccount = db.transaction(() => {
      const userInfo = db.prepare(
        `INSERT INTO users (login_id, password_hash, role, name) VALUES (?, ?, 'patient', ?)`
      ).run(mobile.trim(), hash, name.trim());

      const uid = userInfo.lastInsertRowid;

      db.prepare(`
        INSERT INTO patients
          (patient_ref, name, mobile, age, gender, blood_group, village, linked_user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(patient_ref, name.trim(), mobile.trim(), age || null, gender || null, blood_group || null, village || null, uid);

      db.prepare(`
        INSERT INTO audit_log (user_id, user_name, action_type, description, entity_type)
        VALUES (?, ?, 'submit', ?, 'users')
      `).run(uid, name.trim(), `New patient registered: ${name} (${mobile})`);

      return uid;
    });

    const uid = createAccount();
    const user = db.prepare('SELECT id, login_id, role, name, hospital_id FROM users WHERE id=?').get(uid);

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
router.post('/login', (req, res) => {
  const { login_id, password } = req.body;
  if (!login_id || !password)
    return res.status(400).json({ error: 'login_id and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE login_id = ?').get(login_id.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, hospital_id: user.hospital_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type)
              VALUES (?,?,'submit',?,'auth')`)
    .run(user.id, user.name, `Login: ${user.name} (${user.role})`);

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, hospital_id: user.hospital_id }
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
  db.prepare(`INSERT INTO audit_log (user_id,user_name,action_type,description,entity_type)
              VALUES (?,?,'submit',?,'auth')`)
    .run(req.user.id, req.user.name, `Logout: ${req.user.name}`);
  res.json({ message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id,login_id,role,name,hospital_id,created_at FROM users WHERE id=?').get(req.user.id);
  res.json({ user });
});

module.exports = router;
