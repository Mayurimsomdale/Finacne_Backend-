// controllers/adminController.js
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// ✅ REPLACE with this
import {
  sendPasswordResetOTPEmail,
  sendAdminRegistrationEmail,
  sendHRAdminRegistrationNotification,
} from '../services/adminEmailService.js';

// ════════════════════════════════════════════════════════════
// HELPER
// ════════════════════════════════════════════════════════════

const hashToken = (raw) =>
  crypto.createHash('sha256').update(String(raw)).digest('hex');

// ════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════

export const register = async (req, res) => {
  const TAG = '[register]';
  try {
    const { fullName, username, email, password, role } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!fullName || !username || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // ── Duplicate check ───────────────────────────────────────────────────
    const existing = await pool.query(
      'SELECT id FROM admins WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username or email already exists',
      });
    }

    // ── Insert into DB ────────────────────────────────────────────────────
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO admins (full_name, username, email, password, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, full_name, username, email, role`,
      [fullName, username, email, hashed, role]
    );

    const admin = result.rows[0];
    console.log(`${TAG} ✅ Admin saved to DB — id=${admin.id}, email="${admin.email}"`);

    // ── JWT ───────────────────────────────────────────────────────────────
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // ── Send emails (non-blocking) ────────────────────────────────────────
    // Welcome email → new admin's own email
    // Security alert → HR email
    // Using Promise.allSettled so email failure never breaks registration
    Promise.allSettled([
      sendAdminRegistrationEmail({
        to:       admin.email,       // ← goes to the person who just registered
        toName:   admin.full_name,
        username: admin.username,
        role:     admin.role,
      }),
      sendHRAdminRegistrationNotification({
        fullName: admin.full_name,
        username: admin.username,
        email:    admin.email,
        role:     admin.role,
      }),
    ]).then((results) => {
      const labels = [
        `welcome → ${admin.email}`,
        `security alert → ${process.env.HR_EMAIL || 'humanresources@instagrp.com'}`,
      ];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value?.success) {
          console.log(`${TAG} ✅ Email sent: ${labels[i]}`);
        } else {
          console.error(`${TAG} ❌ Email FAILED: ${labels[i]}`, r.reason || r.value?.error);
        }
      });
    });

    // ── Return 201 immediately — don't wait for emails ────────────────────
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
    console.error(`${TAG} Unexpected error:`, error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};
// ════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════

export const logout = (_req, res) => {
  res.json({ success: true, message: 'Logout successful' });
};

// ════════════════════════════════════════════════════════════
// GET ME
// ════════════════════════════════════════════════════════════

export const getMe = (req, res) => {
  const a = req.admin;
  return res.json({
    success: true,
    data: {
      user: {
        id:       a.id,
        fullName: a.full_name || a.name || a.username,
        username: a.username,
        email:    a.email,
        role:     a.role,
      },
    },
  });
};

export const getProfile = getMe;

// ════════════════════════════════════════════════════════════
// UPDATE PROFILE
// ════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════
// FORGOT PASSWORD  →  POST /api/auth/forgot-password
// ════════════════════════════════════════════════════════════

export const forgotPassword = async (req, res) => {
  const TAG = '[forgotPassword]';
  try {
    const { email } = req.body;
    console.log(`${TAG} Request received. Body email: "${email}"`);

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log(`${TAG} Normalised email: "${normalizedEmail}"`);

    // Check env vars are loaded
    console.log(`${TAG} MJ_JOB_PUBLIC set: ${!!process.env.MJ_JOB_PUBLIC}`);
    console.log(`${TAG} MJ_JOB_PRIVATE set: ${!!process.env.MJ_JOB_PRIVATE}`);
    console.log(`${TAG} HR_EMAIL: ${process.env.HR_EMAIL || '(not set, using default)'}`);

    const { rows } = await pool.query(
      'SELECT id, full_name, email FROM admins WHERE email = $1 AND is_active = true',
      [normalizedEmail]
    );

    console.log(`${TAG} DB lookup result: ${rows.length} row(s) found`);

    // Always return the same response — never reveal whether email exists
    const genericOk = {
      success: true,
      message: 'If that email is registered, a reset code has been sent.',
    };

    if (rows.length === 0) {
      console.log(`${TAG} Email not found or inactive — returning generic OK`);
      return res.json(genericOk);
    }

    const admin = rows[0];
    console.log(`${TAG} Found admin: id=${admin.id}, name="${admin.full_name}", email="${admin.email}"`);

    // Invalidate any previous unused tokens for this admin
    const invalidated = await pool.query(
      `UPDATE password_reset_tokens
       SET is_used = true
       WHERE admin_id = $1 AND is_used = false
       RETURNING id`,
      [admin.id]
    );
    console.log(`${TAG} Invalidated ${invalidated.rowCount} old token(s)`);

    // Generate 6-digit OTP — store only its hash
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const hash = hashToken(otp);
    console.log(`${TAG} Generated OTP (DO NOT LOG IN PRODUCTION): ${otp}`);
    console.log(`${TAG} OTP hash: ${hash}`);

    const insertResult = await pool.query(
      `INSERT INTO password_reset_tokens (admin_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
       RETURNING id, expires_at`,
      [admin.id, hash]
    );
    console.log(`${TAG} Token inserted: id=${insertResult.rows[0]?.id}, expires=${insertResult.rows[0]?.expires_at}`);

    // Send via Mailjet
    console.log(`${TAG} Calling sendPasswordResetOTPEmail to="${normalizedEmail}"...`);
    const emailResult = await sendPasswordResetOTPEmail({
      to:     normalizedEmail,
      toName: admin.full_name,
      otp,
    });

    if (emailResult.success) {
      console.log(`${TAG} ✅ Email sent successfully to ${normalizedEmail}`);
    } else {
      console.error(`${TAG} ❌ Email FAILED:`, emailResult.error);
      console.error(`${TAG}    This is a Mailjet issue — OTP token IS saved in DB, user can retry`);
      // Still return generic ok — the token is in the DB
    }

    return res.json(genericOk);
  } catch (error) {
    console.error(`${TAG} Unexpected error:`, error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ════════════════════════════════════════════════════════════
// RESET PASSWORD  →  POST /api/auth/reset-password
// ════════════════════════════════════════════════════════════

export const resetPassword = async (req, res) => {
  const TAG = '[resetPassword]';
  try {
    const { email, otp, newPassword } = req.body;
    console.log(`${TAG} Request received. email="${email}", otp="${otp}", newPassword length=${newPassword?.length}`);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'email, otp, and newPassword are all required',
      });
    }

    if (String(otp).length !== 6 || !/^\d{6}$/.test(String(otp))) {
      return res.status(400).json({ success: false, message: 'OTP must be a 6-digit number' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { rows: adminRows } = await pool.query(
      'SELECT id FROM admins WHERE email = $1 AND is_active = true',
      [normalizedEmail]
    );

    const badCodeErr = { success: false, message: 'Invalid or expired reset code' };
    if (adminRows.length === 0) {
      console.log(`${TAG} Admin not found for email "${normalizedEmail}"`);
      return res.status(400).json(badCodeErr);
    }

    const adminId = adminRows[0].id;
    const otpHash = hashToken(otp);
    console.log(`${TAG} Checking token for adminId=${adminId}, hash=${otpHash}`);

    const { rows: tokenRows } = await pool.query(
      `SELECT id, expires_at, is_used FROM password_reset_tokens
       WHERE admin_id   = $1
         AND token_hash = $2
         AND is_used    = false
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [adminId, otpHash]
    );

    if (tokenRows.length === 0) {
      // Debug: check if the token exists at all (wrong OTP vs expired)
      const { rows: anyToken } = await pool.query(
        `SELECT id, expires_at, is_used FROM password_reset_tokens
         WHERE admin_id = $1
         ORDER BY created_at DESC
         LIMIT 3`,
        [adminId]
      );
      console.log(`${TAG} Token not found. Latest tokens for this admin:`, anyToken);
      return res.status(400).json(badCodeErr);
    }

    const tokenId = tokenRows[0].id;
    console.log(`${TAG} ✅ Valid token found: id=${tokenId}`);

    const hashedPw = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE admins SET password = $1 WHERE id = $2', [hashedPw, adminId]);
    console.log(`${TAG} Password updated for adminId=${adminId}`);

    await pool.query(
      'UPDATE password_reset_tokens SET is_used = true, used_at = NOW() WHERE id = $1',
      [tokenId]
    );
    await pool.query(
      `UPDATE password_reset_tokens SET is_used = true WHERE admin_id = $1 AND is_used = false`,
      [adminId]
    );

    console.log(`${TAG} ✅ Password reset complete for adminId=${adminId}`);
    return res.json({
      success: true,
      message: 'Password updated successfully. You can now sign in.',
    });
  } catch (error) {
    console.error(`${TAG} Unexpected error:`, error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};