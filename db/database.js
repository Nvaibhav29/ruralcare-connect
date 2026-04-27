require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('✅ PostgreSQL connected (Supabase)'));
pool.on('error',   (err) => console.error('❌ PostgreSQL pool error:', err.message));

// Convert SQLite-style ? placeholders → PostgreSQL $1, $2, ...
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {

  // Returns single row or undefined
  async get(sql, params = [], client = null) {
    const pgSql = convertPlaceholders(sql);
    const executor = client || pool;
    const result = await executor.query(pgSql, params);
    return result.rows[0] || undefined;
  },

  // Returns all rows as array
  async all(sql, params = [], client = null) {
    const pgSql = convertPlaceholders(sql);
    const executor = client || pool;
    const result = await executor.query(pgSql, params);
    return result.rows;
  },

  // Executes INSERT/UPDATE/DELETE — returns { lastInsertRowid, changes }
  async run(sql, params = [], client = null) {
    const isInsert = /^\s*INSERT/i.test(sql.trim());
    let pgSql = convertPlaceholders(sql.trim().replace(/;$/, ''));
    if (isInsert && !/RETURNING\s+id/i.test(pgSql)) {
      pgSql = pgSql + ' RETURNING id';
    }
    const executor = client || pool;
    const result = await executor.query(pgSql, params);
    return {
      lastInsertRowid: isInsert ? (result.rows[0]?.id || 0) : 0,
      changes: result.rowCount
    };
  },

  // Execute raw SQL (used for schema creation)
  async exec(sql, client = null) {
    const executor = client || pool;
    await executor.query(sql);
    return this;
  },

  // no-op — no PRAGMA in PostgreSQL
  pragma() {},

  // Wraps fn in a BEGIN/COMMIT/ROLLBACK transaction.
  // fn receives a clientApi object with .get/.all/.run/.exec methods
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const clientApi = {
        get:  (sql, params = []) => db.get(sql, params, client),
        all:  (sql, params = []) => db.all(sql, params, client),
        run:  (sql, params = []) => db.run(sql, params, client),
        exec: (sql)              => db.exec(sql, client),
      };
      const result = await fn(clientApi);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};

module.exports = db;
