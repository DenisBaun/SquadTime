const express = require('express');
const sql = require('mssql');
const { poolPromise } = require('../db');
const hashPassword = require('../middleware/hashPassword');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const authMiddleware = require('../middleware/auth');
const router = express.Router();

// DEBUG: echo body for troubleshooting login payloads
router.post('/login-debug', async (req, res) => {
  console.log('[DEBUG] /api/auth/login-debug body:', req.body);
  return res.json({ body: req.body });
});

// POST /api/auth/register
router.post(
  '/register',
  // validation
  [
    body('username').isLength({ min: 3 }).withMessage('username must be at least 3 chars'),
    body('email').isEmail().withMessage('invalid email'),
    body('password').isLength({ min: 6 }).withMessage('password must be at least 6 chars')
  ],
  hashPassword,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      const pool = await poolPromise;

      const check = await pool.request()
        .input('email', sql.NVarChar, email)
        .query('SELECT id FROM dbo.Users WHERE email = @email');

      if (check.recordset && check.recordset.length > 0) {
        return res.status(409).json({ message: 'Email already in use' });
      }

      await pool.request()
        .input('username', sql.NVarChar, username)
        .input('email', sql.NVarChar, email)
        .input('password_hash', sql.NVarChar, password)
        .input('display_name', sql.NVarChar, username)
        .query('INSERT INTO dbo.Users (username, email, password_hash, display_name, created_at) VALUES (@username, @email, @password_hash, @display_name, GETUTCDATE())');

      return res.status(201).json({ message: 'User registered' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('identifier').isLength({ min: 1 }).withMessage('identifier required'),
    body('password').isLength({ min: 1 }).withMessage('password required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier, password } = req.body;

    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('identifier', sql.NVarChar, identifier)
        .query('SELECT id, username, email, password_hash FROM dbo.Users WHERE email = @identifier OR username = @identifier');

      if (!result.recordset || result.recordset.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = result.recordset[0];

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const payload = { id: user.id, username: user.username, email: user.email };
      const secret = process.env.JWT_SECRET || 'dev-secret';
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      return res.json({ token, user: payload });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/auth/me - returns authenticated user
router.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'No user' });
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, req.user.id)
      .query('SELECT id, username, email, display_name, avatar_url, avatar_path, bio, library_private, library_visibility FROM dbo.Users WHERE id=@id');
    if (!result.recordset || result.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = result.recordset[0];
    const visibility = user.library_visibility || (user.library_private ? 'friends' : 'everyone');
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name || null,
        avatar_url: user.avatar_url || null,
        avatar_path: user.avatar_path || null,
        bio: user.bio || null,
        library_private: visibility !== 'everyone',
        library_visibility: visibility
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
