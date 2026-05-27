import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
  try {
    const { fullName, username, email, password, role } = req.body;

    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const existing = await pool.query(
      'SELECT id FROM admins WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO admins (full_name, username, email, password, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, full_name, username, email, role`,
      [fullName, username, email, hashed, role]
    );

    const admin = result.rows[0];
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          id:       admin.id,
          fullName: admin.full_name,
          username: admin.username,
          email:    admin.email,
          role:     admin.role,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const admin = result.rows[0];
    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id:       admin.id,
          fullName: admin.full_name,
          username: admin.username,
          email:    admin.email,
          role:     admin.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

export const logout = (_req, res) => {
  res.json({ success: true, message: 'Logout successful' });
};

// Called on GET /api/auth/me — req.admin already set by authenticateAdmin middleware
export const getMe = (req, res) => {
  const a = req.admin;
  return res.json({
    success: true,
    data: {
      user: {
        id:       a.id,
        fullName: a.name || a.username,
        username: a.username,
        email:    a.email,
        role:     a.role,
      },
    },
  });
};

export const getProfile    = getMe;   // alias used by adminRoutes.js

export const updateProfile = async (req, res) => {
  try {
    const { fullName, email } = req.body;
    const result = await pool.query(
      `UPDATE admins
       SET full_name = COALESCE($1, full_name),
           email     = COALESCE($2, email)
       WHERE id = $3
       RETURNING id, full_name, username, email, role`,
      [fullName, email, req.admin.id]
    );
    return res.json({ success: true, message: 'Profile updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};