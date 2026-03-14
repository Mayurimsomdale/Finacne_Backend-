// routes/registrationLinkRoutes.js
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database.js';

const router = express.Router();

// =============================================================================
// POST /api/registration-links
// Admin generates a one-time registration link
// =============================================================================
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { employeeEmail, expiresInDays = 7 } = req.body;

    const linkId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationUrl = `${baseUrl}/registration/${linkId}`;

    // ✅ FIX: Use empty string '' instead of null for employee_email
    await client.query(
      `INSERT INTO registration_links (link_id, employee_email, expires_at, status, is_used)
       VALUES ($1, $2, $3, 'active', false)`,
      [linkId, employeeEmail || '', expiresAt]  // ← Changed from null to ''
    );

    console.log(`🔗 Generated link: ${linkId} for ${employeeEmail || 'generic (no email)'}`);

    res.status(201).json({
      success: true,
      message: 'Registration link generated successfully',
      data: {
        linkId,
        employeeEmail: employeeEmail || null,  // Return null to frontend for clarity
        registrationUrl,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (err) {
    console.error('❌ [POST /registration-links]', err.message);
    console.error(err.stack);  // Add full stack trace for debugging
    res.status(500).json({ 
      success: false, 
      message: err.message,
      detail: err.detail || undefined  // PostgreSQL-specific error details
    });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registration-links
// Admin gets all recent registration links
// =============================================================================
router.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM registration_links ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('❌ [GET /registration-links]', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registration-links/:linkId/validate
// Validates if a link is usable
// =============================================================================
router.get('/:linkId/validate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { linkId } = req.params;

    const { rows } = await client.query(
      'SELECT * FROM registration_links WHERE link_id = $1',
      [linkId]
    );

    if (!rows[0]) {
      return res.status(404).json({ 
        success: false, 
        valid: false, 
        message: 'Invalid registration link' 
      });
    }

    const link = rows[0];

    if (link.is_used) {
      return res.status(410).json({
        success: false, 
        valid: false, 
        used: true,
        message: 'This registration link has already been used'
      });
    }

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({
        success: false, 
        valid: false, 
        expired: true,
        message: 'This registration link has expired'
      });
    }

    res.json({
      success: true,
      valid: true,
      data: {
        linkId: link.link_id,
        employeeEmail: link.employee_email || null,
        expiresAt: link.expires_at
      }
    });
  } catch (err) {
    console.error('❌ [GET /registration-links/:linkId/validate]', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;