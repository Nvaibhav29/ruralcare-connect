require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db/database');

async function start() {
  // ── 1. Init DB (sql.js loads WASM async once) ────────────────
  await db.init();

  // ── 2. Init schema ────────────────────────────────────────────
  const { initializeSchema, isSeeded } = require('./db/init');
  initializeSchema();

  // ── 3. Auto-seed on fresh DB ──────────────────────────────────
  if (!isSeeded()) {
    console.log('📦 Fresh database — seeding...');
    const { seedDatabase } = require('./db/seed');
    await seedDatabase();
  }

  // ── 4. Uploads dir ────────────────────────────────────────────
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

  // ── 5. Express ────────────────────────────────────────────────
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(uploadsDir));

  // ── 6. API routes ─────────────────────────────────────────────
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/hospitals', require('./routes/hospitals'));
  app.use('/api/patients',  require('./routes/patients'));
  app.use('/api/medicines', require('./routes/medicines'));
  app.use('/api/shortages', require('./routes/shortages'));
  app.use('/api/emergency', require('./routes/emergency'));
  app.use('/api/audit',     require('./routes/audit'));
  app.use('/api/district',  require('./routes/district'));
  app.get('/api/health', (req, res) => res.json({ status:'ok', time: new Date().toISOString() }));

  // ── 7. Serve frontend ─────────────────────────────────────────
  app.use(express.static(__dirname));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api'))
      res.sendFile(path.join(__dirname, 'index.html'));
  });

  // ── 8. Error handler ──────────────────────────────────────────
  app.use((err, req, res, next) => {
    console.error('❌', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🏥 RuralCare Connect → http://localhost:${PORT}`);
    console.log('─────────────────────────────────────────');
    console.log('  Patient  → 9876543210 / patient123');
    console.log('  Hospital → HOSP001    / hospital123');
    console.log('  Govt     → GOVT001    / govt123');
    console.log('─────────────────────────────────────────\n');
  });
}

start().catch(err => { console.error('💥 Startup failed:', err); process.exit(1); });
