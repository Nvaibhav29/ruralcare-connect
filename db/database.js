require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'ruralcare.db');

let _db = null;
let _inTransaction = false;

function _save() {
  if (_inTransaction) return;
  const data = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function _toArray(args) {
  // Normalise: .get(1,2) → [1,2]  |  .get([1,2]) → [1,2]
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args.filter(a => a !== undefined);
}

function _lastInsertRowid() {
  try {
    return _db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] || 0;
  } catch { return 0; }
}

function prepare(sql) {
  return {
    get(...args) {
      const p = _toArray(args);
      const stmt = _db.prepare(sql);
      if (p.length) stmt.bind(p);
      const result = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return result;
    },
    all(...args) {
      const p = _toArray(args);
      const stmt = _db.prepare(sql);
      if (p.length) stmt.bind(p);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    },
    run(...args) {
      const p = _toArray(args);
      const stmt = _db.prepare(sql);
      if (p.length) stmt.bind(p);
      stmt.step();
      stmt.free();
      const info = { lastInsertRowid: _lastInsertRowid(), changes: _db.getRowsModified() };
      _save();
      return info;
    }
  };
}

const db = {
  prepare,
  pragma(stmt) {
    try { if (_db) _db.exec(`PRAGMA ${stmt}`); } catch {}
  },
  exec(sql) {
    _db.exec(sql);
    _save();
    return this;
  },
  transaction(fn) {
    return (...outerArgs) => {
      _db.exec('BEGIN');
      _inTransaction = true;
      try {
        const r = fn(...outerArgs);
        _db.exec('COMMIT');
        _inTransaction = false;
        _save();
        return r;
      } catch (e) {
        _db.exec('ROLLBACK');
        _inTransaction = false;
        throw e;
      }
    };
  },
  async init() {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      _db = new SQL.Database(fs.readFileSync(dbPath));
      console.log('✅ Database loaded:', dbPath);
    } else {
      _db = new SQL.Database();
      console.log('✅ New database created:', dbPath);
    }
    return this;
  }
};

module.exports = db;
