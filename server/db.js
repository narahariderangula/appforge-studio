import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect database engine from environment
const isPostgres = !!process.env.DATABASE_URL;

// PostgreSQL Connection Pool (Only if isPostgres is true)
let pgPool = null;
if (isPostgres) {
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Neon secure connection
  });
  console.log('Database Engine: PostgreSQL (Neon/External)');
} else {
  console.log('Database Engine: SQLite3 (Local)');
}

// SQLite connection
const dbPath = process.env.DATABASE_PATH || (process.env.VERCEL
  ? path.join('/tmp', 'app_generator.db')
  : path.join(__dirname, 'app_generator.db'));
const sqliteDb = isPostgres ? null : new sqlite3.Database(dbPath);

// SQL syntax translation helpers for SQLite -> PostgreSQL compatibility
function translateSql(sql) {
  if (!isPostgres) return sql;
  // Convert standard sqlite placeholder (?) to postgres placeholder ($1, $2, ...)
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

function translateSchema(sql) {
  if (!isPostgres) return sql;
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    .replace(/INTEGER DEFAULT 0/gi, 'INTEGER DEFAULT 0');
}

// Promise-based query drivers
export const dbRun = (sql, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        let pgSql = translateSql(sql);
        // If it is an INSERT statement, append RETURNING id to match SQLite's this.lastID
        if (pgSql.trim().toUpperCase().startsWith('INSERT ')) {
          pgSql += ' RETURNING id';
        }
        const res = await pgPool.query(pgSql, params);
        const lastID = res.rows[0]?.id || null;
        resolve({ id: lastID, changes: res.rowCount });
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

export const dbGet = (sql, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await pgPool.query(translateSql(sql), params);
        resolve(res.rows[0] || null);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const dbAll = (sql, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await pgPool.query(translateSql(sql), params);
        resolve(res.rows || []);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
};

// Initialize database schemas
export async function initDb() {
  // Users table
  await dbRun(translateSchema(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      api_token TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `));

  // Apps table (stores metadata and JSON configurations)
  await dbRun(translateSchema(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `));

  // Documents table (stores dynamic application data schema-lessly as JSON)
  await dbRun(translateSchema(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(app_id) REFERENCES apps(id) ON DELETE CASCADE
    )
  `));

  // Notifications table
  await dbRun(translateSchema(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `));

  // Workflows log table
  await dbRun(translateSchema(`
    CREATE TABLE IF NOT EXISTS workflows_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      workflow_name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL,
      log_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `));

  // Create default admin user if not exists (password: admin123)
  const adminExists = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const defaultHash = '$2a$10$NXQzDuxgD.BZUrB1ijWmROdFhF4aQFRBPr11dIQQ.2fJF5yt51iPu'; // admin123
    const apiToken = 'tok_admin_api_developer_key_xyz123';
    await dbRun(
      'INSERT INTO users (username, password_hash, role, api_token) VALUES (?, ?, ?, ?)',
      ['admin', defaultHash, 'admin', apiToken]
    );
    console.log('Default admin account registered (admin / admin123)');
  }

  if (isPostgres) {
    console.log('PostgreSQL database schemas verified/initialized.');
  } else {
    console.log('SQLite3 database initialized successfully at:', dbPath);
  }
}
