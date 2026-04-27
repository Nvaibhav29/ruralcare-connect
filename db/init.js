const db   = require('./database');
const fs   = require('fs');
const path = require('path');

async function initializeSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await db.exec(sql);
  console.log('✅ Schema ready');
}

async function isSeeded() {
  try {
    const row = await db.get('SELECT COUNT(*) AS c FROM hospitals');
    return row && parseInt(row.c) > 0;
  } catch {
    return false;
  }
}

module.exports = { initializeSchema, isSeeded };
