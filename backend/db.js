const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const usePostgres = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

let run, get, all, initDb, dbInstance;

if (usePostgres) {
  const { Pool } = require('pg');
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  dbInstance = pool;
  console.log('Connected to PostgreSQL / Supabase Database');

  const convertSql = (sql) => {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
  };

  run = async (sql, params = []) => {
    let pgSql = convertSql(sql);
    const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING');
    if (isInsert) {
      pgSql += ' RETURNING id';
    }
    const res = await pool.query(pgSql, params);
    return {
      id: res.rows[0]?.id,
      changes: res.rowCount
    };
  };

  get = async (sql, params = []) => {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  };

  all = async (sql, params = []) => {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows;
  };

  initDb = async () => {
    // 1. Create Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create Leave Requests Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        start_date VARCHAR(50) NOT NULL,
        end_date VARCHAR(50) NOT NULL,
        document_path TEXT,
        document_name TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        manager_remarks TEXT,
        notified INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Seed Manager
    const managerUsername = 'manager@gcu.in';
    const existingManager = await get('SELECT * FROM users WHERE username = ?', [managerUsername]);
    if (!existingManager) {
      const managerHash = await bcrypt.hash('ManagerPass123!', 10);
      await run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [managerUsername, managerHash, 'manager']
      );
      console.log('Predefined manager user seeded successfully in Supabase/PostgreSQL.');
    }

    // 4. Seed Demo Employees
    const emp1Username = 'employee1@gcu.in';
    let emp1 = await get('SELECT * FROM users WHERE username = ?', [emp1Username]);
    if (!emp1) {
      const empHash = await bcrypt.hash('EmployeePass123!', 10);
      const result = await run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [emp1Username, empHash, 'employee']
      );
      emp1 = { id: result.id, username: emp1Username };
      console.log('Demo employee 1 seeded successfully in Supabase/PostgreSQL.');
    }

    const emp2Username = 'employee2@gcu.in';
    let emp2 = await get('SELECT * FROM users WHERE username = ?', [emp2Username]);
    if (!emp2) {
      const empHash = await bcrypt.hash('EmployeePass123!', 10);
      const result = await run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [emp2Username, empHash, 'employee']
      );
      emp2 = { id: result.id, username: emp2Username };
      console.log('Demo employee 2 seeded successfully in Supabase/PostgreSQL.');
    }

    // 5. Seed Mock Leaves
    const totalLeaves = await get('SELECT COUNT(*) as count FROM leave_requests');
    if (parseInt(totalLeaves.count, 10) === 0) {
      await run(
        `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [emp1.id, 'Summer Vacation to visit family in Kerala', '2026-08-10', '2026-08-15', null, null, 'Approved', 'Approved. Enjoy your vacation!', 0]
      );

      await run(
        `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [emp1.id, 'Routine dental cleaning and checkup', '2026-08-20', '2026-08-20', null, null, 'Pending', null, 0]
      );

      await run(
        `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [emp2.id, 'Urgent car repairs and servicing', '2026-08-01', '2026-08-03', null, null, 'Rejected', 'Short notice. Please coordinate with colleagues to cover your shifts.', 0]
      );
      console.log('Mock leave requests seeded successfully in Supabase/PostgreSQL.');
    }
  };
} else {
  // SQLite Implementation
  const sqlite3 = require('sqlite3').verbose();
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
  const dbPath = isVercel ? path.join('/tmp', 'database.sqlite') : path.join(__dirname, 'database.sqlite');

  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  } catch (e) {
    // directory already exists or handled
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to SQLite database at:', dbPath);
    }
  });

  dbInstance = db;

  run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

  get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  initDb = async () => {
    // Create Users Table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Leave Requests Table
    await run(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        document_path TEXT,
        document_name TEXT,
        status TEXT DEFAULT 'Pending',
        manager_remarks TEXT,
        notified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Manager
    const managerUsername = 'manager@gcu.in';
    const existingManager = await get('SELECT * FROM users WHERE username = ?', [managerUsername]);
    if (!existingManager) {
      const managerHash = await bcrypt.hash('ManagerPass123!', 10);
      await run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [managerUsername, managerHash, 'manager']
      );
      console.log('Predefined manager user seeded successfully.');
    }

    // Employees for Demo
    const emp1Username = 'employee1@gcu.in';
    let emp1 = await get('SELECT * FROM users WHERE username = ?', [emp1Username]);
    if (!emp1) {
      const empHash = await bcrypt.hash('EmployeePass123!', 10);
      const result = await run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [emp1Username, empHash, 'employee']
      );
      emp1 = { id: result.id, username: emp1Username };
      console.log('Demo employee 1 seeded successfully.');
    }

    const emp2Username = 'employee2@gcu.in';
    let emp2 = await get('SELECT * FROM users WHERE username = ?', [emp2Username]);
    if (!emp2) {
      const empHash = await bcrypt.hash('EmployeePass123!', 10);
      const result = await run(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [emp2Username, empHash, 'employee']
      );
      emp2 = { id: result.id, username: emp2Username };
      console.log('Demo employee 2 seeded successfully.');
    }

    // Seed Leave Requests
    const totalLeaves = await get('SELECT COUNT(*) as count FROM leave_requests');
    if (parseInt(totalLeaves.count, 10) === 0) {
      await run(
        `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [emp1.id, 'Summer Vacation to visit family in Kerala', '2026-08-10', '2026-08-15', null, null, 'Approved', 'Approved. Enjoy your vacation!', 0]
      );

      await run(
        `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [emp1.id, 'Routine dental cleaning and checkup', '2026-08-20', '2026-08-20', null, null, 'Pending', null, 0]
      );

      await run(
        `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [emp2.id, 'Urgent car repairs and servicing', '2026-08-01', '2026-08-03', null, null, 'Rejected', 'Short notice. Please coordinate with colleagues to cover your shifts.', 0]
      );
      console.log('Mock leave requests seeded successfully.');
    }
  };
}

module.exports = {
  db: dbInstance,
  run,
  get,
  all,
  initDb
};
