import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun } from '../db.js';

const router = express.Router();
const JWT_SECRET = 'ai_app_generator_secret_key_13579';

// Middleware to verify auth tokens (supporting normal user tokens and static API tokens)
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // 1. Check if it's an API token directly in DB
  try {
    const userWithToken = await dbGet('SELECT * FROM users WHERE api_token = ?', [token]);
    if (userWithToken) {
      req.user = {
        id: userWithToken.id,
        username: userWithToken.username,
        role: userWithToken.role,
        authType: 'api_token'
      };
      return next();
    }
  } catch (dbErr) {
    console.error('API token check error:', dbErr);
  }

  // 2. Otherwise verify as JWT
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// REGISTER Email/Password
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    // Check if user exists
    const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    // Generate a unique static API Token too
    const apiToken = 'tok_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    const result = await dbRun(
      'INSERT INTO users (username, password_hash, role, api_token) VALUES (?, ?, ?, ?)',
      [username, hash, 'user', apiToken]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN: Password
router.post('/login/password', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, authType: 'password' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, apiToken: user.api_token }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN: API Token
router.post('/login/token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'API Token is required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE api_token = ?', [token]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid API Token' });
    }

    // Generate session JWT from API Token
    const sessionToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, authType: 'api_token' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: sessionToken,
      user: { id: user.id, username: user.username, role: user.role, apiToken: user.api_token }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LOGIN: Anonymous Guest
router.post('/login/anonymous', async (req, res) => {
  try {
    const guestId = Math.floor(100000 + Math.random() * 900000);
    const guestUsername = `guest_${guestId}`;
    
    // We sign JWT directly without creating a DB entry, or we can create a temporary DB entry
    const token = jwt.sign(
      { id: -guestId, username: guestUsername, role: 'guest', authType: 'anonymous' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: { id: -guestId, username: guestUsername, role: 'guest', apiToken: 'N/A (Anonymous)' }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET Current User Profile
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
