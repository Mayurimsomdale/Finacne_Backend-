  // controllers/linkController.js
  import pool from '../../config/database.js';
  import { v4 as uuidv4 } from 'uuid';

  // Generate registration link
  export const generateRegistrationLink = async (req, res) => {
    try {
      const { employeeEmail, expiresInDays } = req.body;
      const adminId = req.admin.id;

      if (!employeeEmail) {
        return res.status(400).json({
          success: false,
          message: 'Employee email is required'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(employeeEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check if email already has an active link
      const existingLink = await pool.query(
        `SELECT * FROM registration_links 
        WHERE employee_email = $1 
        AND is_used = false 
        AND expires_at > CURRENT_TIMESTAMP`,
        [employeeEmail]
      );

      if (existingLink.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'An active registration link already exists for this email'
        });
      }

      // Generate unique link ID
      const linkId = uuidv4();

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

      // Insert registration link
      const result = await pool.query(
        `INSERT INTO registration_links (link_id, employee_email, expires_at, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [linkId, employeeEmail, expiresAt, adminId]
      );

      const link = result.rows[0];

      // Generate full registration URL
      const registrationUrl = `${process.env.FRONTEND_URL}/employees/registration/${linkId}`;

      res.status(201).json({
        success: true,
        message: 'Registration link generated successfully',
        data: {
          linkId: link.link_id,
          email: link.employee_email,
          expiresAt: link.expires_at,
          registrationUrl
        }
      });

    } catch (error) {
      console.error('Error generating registration link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate registration link'
      });
    }
  };

  // Get all registration links
  export const getAllLinks = async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT 
          rl.*,
          au.full_name as created_by_name
        FROM registration_links rl
        LEFT JOIN admin_users au ON rl.created_by = au.id
        ORDER BY rl.created_at DESC`
      );

      res.json({
        success: true,
        data: result.rows
      });

    } catch (error) {
      console.error('Error fetching registration links:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch registration links'
      });
    }
  };

  // Delete registration link
  export const deleteLink = async (req, res) => {
    try {
      const { linkId } = req.params;

      const result = await pool.query(
        'DELETE FROM registration_links WHERE link_id = $1 OR id = $1 RETURNING *',
        [linkId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Registration link not found'
        });
      }

      res.json({
        success: true,
        message: 'Registration link deleted successfully',
        data: result.rows[0]
      });

      
    } catch (error) {
      console.error('Error deleting registration link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete registration link'
      });
    }
  };