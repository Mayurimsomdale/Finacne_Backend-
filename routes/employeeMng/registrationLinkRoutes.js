// routes/employeeMng/registrationLinkRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// KEY FIX: GET /:linkId/validate now JOINs employees via prefill_employee_id
//          and returns full prefillData for rejoin links.
//          GET /validate/:linkId (duplicate) removed — use /:linkId/validate.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database.js';
import { sendRegistrationLinkEmail } from '../../services/emailService.js';

const router = express.Router();
console.log('✅ registrationLinkRoutes loaded');

// =============================================================================
// POST /api/registration-links
// =============================================================================
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { employeeEmail, expiresInDays = 7 } = req.body;

    const linkId    = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(expiresInDays || 7));

    const baseUrl         = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationUrl = `${baseUrl}/registration/${linkId}`;

    await client.query(
      `INSERT INTO registration_links
         (link_id, employee_email, expires_at, status, is_used)
       VALUES ($1, $2, $3, 'active', false)`,
      [linkId, employeeEmail || '', expiresAt]
    );

    console.log(`🔗 Link generated: ${linkId} for "${employeeEmail || 'generic'}"`);

    let emailResult = null;
    if (employeeEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) {
      emailResult = await sendRegistrationLinkEmail({
        to:              employeeEmail,
        toName:          employeeEmail,
        registrationUrl,
        expiresAt:       expiresAt.toISOString(),
      }).catch(err => {
        console.error('Registration link email failed:', err.message);
        return { success: false, error: err.message };
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Registration link generated successfully',
      data: {
        linkId,
        employeeEmail:   employeeEmail || null,
        registrationUrl,
        expiresAt:       expiresAt.toISOString(),
        emailSent:       emailResult?.success || false,
      },
    });
  } catch (err) {
    console.error('❌ [POST /api/registration-links]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registration-links
// =============================================================================
router.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM registration_links ORDER BY created_at DESC LIMIT 50`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registration-links/:linkId/validate
// ✅ KEY FIX: JOINs employees table when is_rejoin=true to return prefill data.
//    This is the ONLY validate endpoint — the /validate/:linkId route is removed.
// =============================================================================
router.get('/:linkId/validate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { linkId } = req.params;

    // Join employees table for prefill data when this is a rejoin link
    const { rows } = await client.query(
      `SELECT
         rl.*,
         -- Employee prefill fields (only populated when is_rejoin=true and prefill_employee_id is set)
         e.id                          AS emp_db_id,
         e.first_name,
         e.last_name,
         e.father_husband_name,
         e.email                       AS emp_email,
         e.phone,
         e.alt_phone,
         e.date_of_birth,
         e.gender,
         e.marital_status,
         e.educational_qualification,
         e.blood_group,
         e.pan_number,
         e.name_on_pan,
         e.aadhar_number,
         e.name_on_aadhar,
         e.family_member_name,
         e.family_contact_no,
         e.family_working_status,
         e.family_employer_name,
         e.family_employer_contact,
         e.emergency_contact_name,
         e.emergency_contact_no,
         e.emergency_contact_address,
         e.emergency_contact_relation,
         e.permanent_address,
         e.permanent_phone,
         e.permanent_landmark,
         e.permanent_lat_long,
         e.local_same_as_permanent,
         e.local_address,
         e.local_phone,
         e.local_landmark,
         e.local_lat_long,
         e.ref1_name, e.ref1_designation, e.ref1_organization,
         e.ref1_address, e.ref1_city_state_pin, e.ref1_contact_no, e.ref1_email,
         e.ref2_name, e.ref2_designation, e.ref2_organization,
         e.ref2_address, e.ref2_city_state_pin, e.ref2_contact_no, e.ref2_email,
         e.ref3_name, e.ref3_designation, e.ref3_organization,
         e.ref3_address, e.ref3_city_state_pin, e.ref3_contact_no, e.ref3_email,
         e.department,
         e.position,
         e.joining_date,
         e.employment_type,
         e.reporting_manager,
         e.circle,
         e.project_name,
         e.bank_name,
         e.account_number,
         e.ifsc_code,
         e.account_holder_name,
         e.bank_branch,
         e.employee_id                 AS old_employee_id,
         e.status                      AS emp_status
       FROM registration_links rl
       LEFT JOIN employees e ON e.id = rl.prefill_employee_id
       WHERE rl.link_id = $1`,
      [linkId]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, valid: false, message: 'Invalid registration link' });
    }

    const link = rows[0];

    if (link.is_used) {
      return res.status(410).json({ success: false, valid: false, used: true, message: 'This registration link has already been used' });
    }
    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ success: false, valid: false, expired: true, message: 'This registration link has expired' });
    }

    // Build prefill data for rejoin links
    let prefillData = null;
    if (link.is_rejoin && link.emp_db_id) {
      prefillData = {
        // Personal
        firstName:                link.first_name,
        lastName:                 link.last_name,
        fatherHusbandName:        link.father_husband_name,
        dob:                      link.date_of_birth
                                    ? new Date(link.date_of_birth).toISOString().split('T')[0]
                                    : '',
        gender:                   link.gender,
        maritalStatus:            link.marital_status,
        educationalQualification: link.educational_qualification,
        bloodGroup:               link.blood_group,
        panNumber:                link.pan_number,
        nameOnPan:                link.name_on_pan,
        aadhar:                   link.aadhar_number,
        nameOnAadhar:             link.name_on_aadhar,
        // Contact
        email:                    link.emp_email,
        phone:                    link.phone,
        altPhone:                 link.alt_phone,
        // Permanent Address
        permanentAddress:         link.permanent_address,
        permanentPhone:           link.permanent_phone,
        permanentLandmark:        link.permanent_landmark,
        permanentLatLong:         link.permanent_lat_long,
        // Local Address
        localSameAsPermanent:     link.local_same_as_permanent,
        localAddress:             link.local_address,
        localPhone:               link.local_phone,
        localLandmark:            link.local_landmark,
        localLatLong:             link.local_lat_long,
        // Family
        familyMemberName:         link.family_member_name,
        familyContactNo:          link.family_contact_no,
        familyWorkingStatus:      link.family_working_status,
        familyEmployerName:       link.family_employer_name,
        familyEmployerContact:    link.family_employer_contact,
        // Emergency
        emergencyContactName:     link.emergency_contact_name,
        emergencyContactNo:       link.emergency_contact_no,
        emergencyContactAddress:  link.emergency_contact_address,
        emergencyContactRelation: link.emergency_contact_relation,
        // References
        ref1Name: link.ref1_name, ref1Designation: link.ref1_designation,
        ref1Organization: link.ref1_organization, ref1Address: link.ref1_address,
        ref1CityStatePin: link.ref1_city_state_pin, ref1ContactNo: link.ref1_contact_no,
        ref1Email: link.ref1_email,
        ref2Name: link.ref2_name, ref2Designation: link.ref2_designation,
        ref2Organization: link.ref2_organization, ref2Address: link.ref2_address,
        ref2CityStatePin: link.ref2_city_state_pin, ref2ContactNo: link.ref2_contact_no,
        ref2Email: link.ref2_email,
        ref3Name: link.ref3_name, ref3Designation: link.ref3_designation,
        ref3Organization: link.ref3_organization, ref3Address: link.ref3_address,
        ref3CityStatePin: link.ref3_city_state_pin, ref3ContactNo: link.ref3_contact_no,
        ref3Email: link.ref3_email,
        // Employment
        department:        link.department,
        position:          link.position,
        joiningDate:       link.joining_date
                             ? new Date(link.joining_date).toISOString().split('T')[0]
                             : '',
        employmentType:    link.employment_type,
        reportingManager:  link.reporting_manager,
        circle:            link.circle,
        projectName:       link.project_name,
        // Bank
        bankName:          link.bank_name,
        accountNumber:     link.account_number,
        ifscCode:          link.ifsc_code,
        accountHolderName: link.account_holder_name,
        bankBranch:        link.bank_branch,
        // Meta
        oldEmployeeId:     link.old_employee_id,
      };
    }

    return res.json({
      success:     true,
      valid:       true,
      isRejoin:    link.is_rejoin || false,
      prefillData,
      linkEmail:   link.employee_email || null,
      data: {
        linkId:        link.link_id,
        employeeEmail: link.employee_email || null,
        expiresAt:     link.expires_at,
      },
    });
  } catch (err) {
    console.error('❌ [GET /api/registration-links/:linkId/validate]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// DELETE /api/registration-links/:linkId
// =============================================================================
router.delete('/:linkId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `DELETE FROM registration_links WHERE link_id = $1 OR id::text = $1 RETURNING *`,
      [req.params.linkId]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Link not found' });
    return res.json({ success: true, message: 'Link deleted', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;