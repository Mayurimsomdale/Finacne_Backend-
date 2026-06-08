// middleware/auth.js
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token) {
      return res.status(401).json({ success: false, message: 'Empty token' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      const message = jwtErr.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      return res.status(401).json({ success: false, message });
    }

    // ✅ 'admins' table — matches authRoutes.js login
    const { rows } = await pool.query(
      'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (rows[0].is_active === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Set both so every controller works regardless of which it reads
    req.admin = {
      id:       rows[0].id,
      name:     rows[0].full_name || rows[0].username,
      username: rows[0].username,
      email:    rows[0].email,
      role:     rows[0].role,
    };
    req.user = {
      id:       rows[0].id,
      username: rows[0].username,
      role:     rows[0].role,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, message: 'Server error during authentication' });
  }
};

// Aliases — every import across the codebase works
export const authenticate  = authenticateAdmin;
export const verifyToken   = authenticateAdmin;

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' not authorized. Required: ${roles.join(', ')}`,
    });
  }
  next();
};