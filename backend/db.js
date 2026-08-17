const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Promise-based wrappers
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

async function initDb() {
  //  Create Users Table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'employee',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  //  Create Leave Requests Table
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

  // Main  Users
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

  // 4. Seed Leave Requests
  const totalLeaves = await get('SELECT COUNT(*) as count FROM leave_requests');
  if (totalLeaves.count === 0) {
    // Approved leave for emp1
    await run(
      `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp1.id, 'Summer Vacation to visit family in Kerala', '2026-08-10', '2026-08-15', null, null, 'Approved', 'Approved. Enjoy your vacation!', 0]
    );

    // Pending leave for emp1
    await run(
      `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp1.id, 'Routine dental cleaning and checkup', '2026-08-20', '2026-08-20', null, null, 'Pending', null, 0]
    );

    // Rejected leave for emp2
    await run(
      `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, notified) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp2.id, 'Urgent car repairs and servicing', '2026-08-01', '2026-08-03', null, null, 'Rejected', 'Short notice. Please coordinate with colleagues to cover your shifts.', 0]
    );
    console.log('Mock leave requests seeded successfully.');
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};
