const db = require('./database');
const fs = require('fs');
const path = require('path');

function initializeSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(sql);
  console.log('✅ Schema ready');
}

function isSeeded() {
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM hospitals').get();
    return row && row.c > 0;
  } catch {
    return false;
  }
}

module.exports = { initializeSchema, isSeeded };
