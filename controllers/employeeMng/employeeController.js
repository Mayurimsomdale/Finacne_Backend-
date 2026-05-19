  // controllers/employeeController.js
  import pool from '../../config/database.js';
  import { v4 as uuidv4 } from 'uuid';

  // Add employee manually (admin only)
  export const addEmployee = async (req, res) => {
    const client = await pool.connect();
    
    try {
      console.log('📥 Add Employee Request Body:', req.body);
      console.log('📎 Files:', req.files);

      await client.query('BEGIN');

      const {
        employeeId,
        firstName,
        middleName,
        lastName,
        email,
        phone,
        altPhone,
        dob,
        gender,
        aadhar,
        joiningDate,
        department,
        designation,
        employmentType,
        basicSalary,
        hra,
        otherAllowances,
        bankName,
        accountNumber,
        ifscCode,
        branch,
        status
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !phone || !employeeId) {
        throw new Error('Missing required fields');
      }

      // Check if employee ID already exists
      const existingEmp = await client.query(
        'SELECT id FROM employees WHERE employee_id = $1',
        [employeeId]
      );

      if (existingEmp.rows.length > 0) {
        throw new Error('Employee ID already exists');
      }

      // Check if email already exists
      const existingEmail = await client.query(
        'SELECT id FROM employees WHERE email = $1',
        [email]
      );

      if (existingEmail.rows.length > 0) {
        throw new Error('Email already exists');
      }

      // Insert employee
      const employeeResult = await client.query(
        `INSERT INTO employees (
          employee_id, first_name, middle_name, last_name, email, phone, 
          date_of_birth, gender, aadhar_number, joining_date, department, 
          designation, employment_type, basic_salary, hra, other_allowances,
          bank_name, account_number, ifsc_code, branch, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *`,
        [
          employeeId, firstName, middleName, lastName, email, phone,
          dob, gender, aadhar, joiningDate, department,
          designation, employmentType, basicSalary, hra, otherAllowances,
          bankName, accountNumber, ifscCode, branch, status || 'active'
        ]
      );

      const employee = employeeResult.rows[0];

      // Handle file uploads
      if (req.files) {
        const documentTypes = ['photo', 'aadharCard', 'panCard', 'bankPassbook'];
        
        for (const docType of documentTypes) {
          if (req.files[docType] && req.files[docType][0]) {
            const file = req.files[docType][0];
            
            await client.query(
              `INSERT INTO employee_documents (employee_id, document_type, filename, file_path, file_size, mime_type)
              VALUES ($1, $2, $3, $4, $5, $6)`,
              [employee.id, docType, file.filename, file.path, file.size, file.mimetype]
            );
          }
        }
      }

      await client.query('COMMIT');

      console.log('✅ Employee added successfully:', employee);

      res.status(201).json({
        success: true,
        message: 'Employee added successfully',
        data: employee
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error adding employee:', error);
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to add employee'
      });
    } finally {
      client.release();
    }
  };

  // Get all employees
  export const getAllEmployees = async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT 
          e.*,
          json_agg(
            json_build_object(
              'type', ed.document_type,
              'filename', ed.filename,
              'path', ed.file_path
            )
          ) FILTER (WHERE ed.id IS NOT NULL) as documents
        FROM employees e
        LEFT JOIN employee_documents ed ON e.id = ed.employee_id
        GROUP BY e.id
        ORDER BY e.created_at DESC`
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employees'
      });
    }
  };

  // Get employee by ID
  export const getEmployeeById = async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT 
          e.*,
          json_agg(
            json_build_object(
              'type', ed.document_type,
              'filename', ed.filename,
              'path', ed.file_path
            )
          ) FILTER (WHERE ed.id IS NOT NULL) as documents
        FROM employees e
        LEFT JOIN employee_documents ed ON e.id = ed.employee_id
        WHERE e.id = $1 OR e.employee_id = $1
        GROUP BY e.id`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee'
      });
    }
  };

  // Update employee status
  export const updateEmployeeStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['active', 'inactive', 'pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      const result = await pool.query(
        'UPDATE employees SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 OR employee_id = $2 RETURNING *',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        message: 'Employee status updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating employee status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update employee status'
      });
    }
  };

  // Delete/Deactivate employee
  export const deleteEmployee = async (req, res) => {
    try {
      const { id } = req.params;

      // Soft delete - just update status to inactive
      const result = await pool.query(
        'UPDATE employees SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 OR employee_id = $2 RETURNING *',
        ['inactive', id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        message: 'Employee deactivated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete employee'
      });
    }
  };

  // Approve employee
  export const approveEmployee = async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.admin.id;

      const result = await pool.query(
        `UPDATE employees 
        SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 OR employee_id = $2 
        RETURNING *`,
        [adminId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        message: 'Employee approved successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error approving employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve employee'
      });
    }
  };

  // Reject employee
  export const rejectEmployee = async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await pool.query(
        'UPDATE employees SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 OR employee_id = $3 RETURNING *',
        ['rejected', reason, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        message: 'Employee rejected',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error rejecting employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject employee'
      });
    }
  };

  // Validate registration link
  export const validateLink = async (req, res) => {
    try {
      const { linkId } = req.params;

      const result = await pool.query(
        'SELECT * FROM registration_links WHERE link_id = $1',
        [linkId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          invalid: true,
          message: 'Invalid registration link'
        });
      }

      const link = result.rows[0];

      if (link.is_used) {
        return res.status(400).json({
          success: false,
          used: true,
          message: 'This registration link has already been used'
        });
      }

      if (new Date() > new Date(link.expires_at)) {
        return res.status(400).json({
          success: false,
          expired: true,
          message: 'This registration link has expired'
        });
      }

      res.json({
        success: true,
        data: {
          email: link.employee_email,
          expiresAt: link.expires_at
        }
      });
    } catch (error) {
      console.error('Error validating link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate link'
      });
    }
  };

  // Submit registration (public)
  export const submitRegistration = async (req, res) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Implementation similar to addEmployee
      // ... (implement based on your registration form requirements)

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Registration submitted successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error submitting registration:', error);
      
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit registration'
      });
    } finally {
      client.release();
    }
  };