import express from 'express';
import sql, { ISqlTypeFactoryWithNoParams } from 'mssql';
import { poolPromise } from '../db';
import hashPassword from '../middleware/hashPassword';

const router = express.Router();

// POST /api/auth/register
router.post('/register', hashPassword, async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const pool = await poolPromise;

    // Check if email already exists
    const check = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Users WHERE email = @email');

    if (check.recordset && check.recordset.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Insert user (password already hashed by middleware)
    await pool.request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('password_hash', sql.NVarChar, password)
      .query('INSERT INTO Users (username, email, password_hash, created_at) VALUES (@username, @email, @password_hash, GETUTCDATE())');

    return res.status(201).json({ message: 'User registered' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;