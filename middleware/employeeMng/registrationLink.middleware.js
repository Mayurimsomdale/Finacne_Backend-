// middleware/employeeMng/registrationLink.middleware.js

import pool from '../../config/database.js';
import jwt  from 'jsonwebtoken';

// ── requireAdmin: verifies JWT and loads admin from 'admins' table ────────────
export const requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token) {
      return res.status(401).json({ success: false, message: 'Empty token.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
      return res.status(401).json({ success: false, message });
    }

    const { rows } = await pool.query(
      'SELECT id, username, email, full_name, role, is_active FROM admins WHERE id = $1',
      [decoded.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    if (rows[0].is_active === false) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    req.admin = rows[0];
    req.user  = { id: rows[0].id, username: rows[0].username, role: rows[0].role };
    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    return res.status(500).json({ success: false, message: 'Server error during authentication.' });
  }
};

// ── validateEmailBody ─────────────────────────────────────────────────────────
export const validateEmailBody = (req, res, next) => {
  const { employeeEmail } = req.body;
  if (!employeeEmail || typeof employeeEmail !== 'string' || !employeeEmail.trim()) {
    return res.status(400).json({ success: false, message: 'Employee email is required.' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(employeeEmail.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }
  req.body.employeeEmail = employeeEmail.trim().toLowerCase();
  next();
};

// ── validateExpiryDays ────────────────────────────────────────────────────────
export const validateExpiryDays = (req, res, next) => {
  const { expiresInDays } = req.body;
  if (expiresInDays !== undefined) {
    const days = Number(expiresInDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return res.status(400).json({
        success: false,
        message: 'expiresInDays must be an integer between 1 and 90.',
      });
    }
    req.body.expiresInDays = days;
  } else {
    req.body.expiresInDays = 7;
  }
  next();
};

// ── guardNoDuplicateActiveLink ────────────────────────────────────────────────
export const guardNoDuplicateActiveLink = async (req, res, next) => {
  const { employeeEmail } = req.body;
  try {
    const { rows } = await pool.query(
      `SELECT link_id, expires_at FROM registration_links
       WHERE employee_email = $1
         AND is_used = false
         AND is_rejoin = false
         AND expires_at > CURRENT_TIMESTAMP`,
      [employeeEmail]
    );
    if (rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An active registration link already exists for this email.',
        data: { existingLinkId: rows[0].link_id, expiresAt: rows[0].expires_at },
      });
    }
    next();
  } catch (err) {
    console.error('guardNoDuplicateActiveLink error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── loadLinkByParam ───────────────────────────────────────────────────────────
export const loadLinkByParam = async (req, res, next) => {
  const { linkId } = req.params;
  if (!linkId) {
    return res.status(400).json({ success: false, message: 'linkId param is required.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM registration_links WHERE link_id = $1 OR id::text = $1`,
      [linkId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Registration link not found.' });
    }
    req.link = rows[0];
    next();
  } catch (err) {
    console.error('loadLinkByParam error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── guardLinkValid ────────────────────────────────────────────────────────────
export const guardLinkValid = (req, res, next) => {
  const link = req.link;
  if (link.is_used) {
    return res.status(410).json({
      success: false, valid: false, used: true,
      message: 'This registration link has already been used.',
    });
  }
  if (new Date(link.expires_at) < new Date()) {
    return res.status(410).json({
      success: false, valid: false, expired: true,
      message: 'This registration link has expired.',
    });
  }
  next();
};