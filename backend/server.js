const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { initDb, run, get, all } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_leave_mgmt_key_2026';

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
const uploadsDir = isVercel ? path.join('/tmp', 'uploads') : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

let dbInitPromise = null;
function ensureDbInit() {
  if (!dbInitPromise) {
    dbInitPromise = initDb();
  }
  return dbInitPromise;
}

// Middleware to ensure DB is initialized before handling requests
app.use(async (req, res, next) => {
  try {
    await ensureDbInit();
    next();
  } catch (err) {
    console.error('Database initialization error:', err);
    res.status(500).json({ message: 'Database initialization error' });
  }
});

// Multer Storage Configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Auth Middlewares
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: 'Access denied: unauthorized role' });
    }
    next();
  };
}

// --- API ROUTES ---

// 1. Auth: Register (Employees only)
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // Sanity check: prevent registering the manager account or reserve it
  if (username.toLowerCase() === 'manager@gcu.in') {
    return res.status(400).json({ message: 'Username is reserved for the system manager' });
  }

  try {
    const existingUser = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, passwordHash, 'employee']
    );

    res.status(201).json({ message: 'User registered successfully', userId: result.id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration' });
  }
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login' });
  }
});

// 3. Leaves: Apply (Employees only)
app.post('/api/leaves/apply', authenticateToken, requireRole('employee'), upload.single('document'), async (req, res) => {
  const { reason, start_date, end_date } = req.body;

  if (!reason || !start_date || !end_date) {
    return res.status(400).json({ message: 'Reason, start date, and end date are required' });
  }

  if (new Date(start_date) > new Date(end_date)) {
    return res.status(400).json({ message: 'Start date cannot be after end date' });
  }

  const documentPath = req.file ? `/uploads/${req.file.filename}` : null;
  const documentName = req.file ? req.file.originalname : null;

  try {
    const result = await run(
      `INSERT INTO leave_requests (user_id, reason, start_date, end_date, document_path, document_name, status, notified) 
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', 0)`,
      [req.user.id, reason, start_date, end_date, documentPath, documentName]
    );

    res.status(201).json({ 
      message: 'Leave request submitted successfully', 
      leaveId: result.id,
      documentPath,
      documentName
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Internal server error during leave application' });
  }
});

// 4. Leaves: Get History (Employees only)
app.get('/api/leaves/employee', authenticateToken, requireRole('employee'), async (req, res) => {
  try {
    const leaves = await all(
      'SELECT id, reason, start_date, end_date, document_path, document_name, status, manager_remarks, created_at FROM leave_requests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(leaves);
  } catch (error) {
    console.error('Fetch employee history error:', error);
    res.status(500).json({ message: 'Internal server error fetching leave history' });
  }
});

// 5. Leaves: Get Notifications (Employees only)
// Fetches leave requests that were updated (Approved/Rejected) and haven't been shown as notifications yet.
app.get('/api/leaves/notifications', authenticateToken, requireRole('employee'), async (req, res) => {
  try {
    const notifications = await all(
      `SELECT id, status, manager_remarks, reason, start_date, end_date 
       FROM leave_requests 
       WHERE user_id = ? AND notified = 0 AND status != 'Pending'`,
      [req.user.id]
    );

    if (notifications.length > 0) {
      // Mark them as notified
      for (const item of notifications) {
        await run('UPDATE leave_requests SET notified = 1 WHERE id = ?', [item.id]);
      }
    }

    res.json(notifications);
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ message: 'Internal server error fetching notifications' });
  }
});

// 6. Manager: Get All Employees (Manager only)
app.get('/api/manager/employees', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const employees = await all(`
      SELECT 
        u.id, 
        u.username, 
        u.created_at,
        COUNT(l.id) as total_leaves,
        SUM(CASE WHEN l.status = 'Approved' THEN 1 ELSE 0 END) as approved_leaves,
        SUM(CASE WHEN l.status = 'Pending' THEN 1 ELSE 0 END) as pending_leaves,
        SUM(CASE WHEN l.status = 'Rejected' THEN 1 ELSE 0 END) as rejected_leaves
      FROM users u
      LEFT JOIN leave_requests l ON u.id = l.user_id
      WHERE u.role = 'employee'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    // Convert counts from SQL nulls to 0
    const processedEmployees = employees.map(emp => ({
      ...emp,
      total_leaves: emp.total_leaves || 0,
      approved_leaves: emp.approved_leaves || 0,
      pending_leaves: emp.pending_leaves || 0,
      rejected_leaves: emp.rejected_leaves || 0
    }));

    res.json(processedEmployees);
  } catch (error) {
    console.error('Fetch employees list error:', error);
    res.status(500).json({ message: 'Internal server error fetching employee list' });
  }
});

// 7. Manager: Get All Leave Requests (Manager only)
app.get('/api/manager/leaves', authenticateToken, requireRole('manager'), async (req, res) => {
  try {
    const leaves = await all(`
      SELECT 
        l.id, 
        l.user_id, 
        l.reason, 
        l.start_date, 
        l.end_date, 
        l.document_path, 
        l.document_name, 
        l.status, 
        l.manager_remarks, 
        l.created_at,
        u.username
      FROM leave_requests l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
    `);
    res.json(leaves);
  } catch (error) {
    console.error('Fetch all leaves error:', error);
    res.status(500).json({ message: 'Internal server error fetching leave requests' });
  }
});

// 8. Manager: Approve/Reject Leave Request (Manager only)
app.put('/api/manager/leaves/:id', authenticateToken, requireRole('manager'), async (req, res) => {
  const { status, manager_remarks } = req.body;
  const leaveId = req.params.id;

  if (!status || !['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Valid status ("Approved" or "Rejected") is required' });
  }

  try {
    const leave = await get('SELECT * FROM leave_requests WHERE id = ?', [leaveId]);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    await run(
      'UPDATE leave_requests SET status = ?, manager_remarks = ?, notified = 0 WHERE id = ?',
      [status, manager_remarks || null, leaveId]
    );

    res.json({ message: `Leave request has been ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Review leave request error:', error);
    res.status(500).json({ message: 'Internal server error processing leave request' });
  }
});

// Serve static frontend files if available (for fullstack platforms like Render, Railway, etc.)
const rootDist = path.join(__dirname, '../dist');
const frontendDist = path.join(__dirname, '../frontend/dist');
const distPath = fs.existsSync(rootDist) ? rootDist : (fs.existsSync(frontendDist) ? frontendDist : null);

if (distPath) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Initialize database and start server if executed directly
if (require.main === module) {
  ensureDbInit()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Database initialization failed:', err);
      process.exit(1);
    });
}

module.exports = app;
