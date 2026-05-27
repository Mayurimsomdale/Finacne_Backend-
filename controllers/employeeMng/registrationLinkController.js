// controllers/registrationLink.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure business logic for registration link management.
// All middleware (auth, validation, link loading) runs before these handlers.
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 }              from 'uuid';
import pool                           from '../../config/database.js';
import { sendRegistrationLinkEmail }  from '../../services/emailService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildPrefillData = (row) => ({
  // Personal
  firstName:                row.first_name,
  lastName:                 row.last_name,
  fatherHusbandName:        row.father_husband_name,
  dob:                      row.date_of_birth
                              ? new Date(row.date_of_birth).toISOString().split('T')[0]
                              : '',
  gender:                   row.gender,
  maritalStatus:            row.marital_status,
  educationalQualification: row.educational_qualification,
  bloodGroup:               row.blood_group,
  panNumber:                row.pan_number,
  nameOnPan:                row.name_on_pan,
  aadhar:                   row.aadhar_number,
  nameOnAadhar:             row.name_on_aadhar,
  uanNumber:                row.uan_number || '',
  // Contact
  email:                    row.emp_email   ?? row.email,
  phone:                    row.phone,
  altPhone:                 row.alt_phone,
  // Permanent address
  permanentAddress:         row.permanent_address,
  permanentPhone:           row.permanent_phone,
  permanentLandmark:        row.permanent_landmark,
  permanentLatLong:         row.permanent_lat_long,
  // Local address
  localSameAsPermanent:     row.local_same_as_permanent,
  localAddress:             row.local_address,
  localPhone:               row.local_phone,
  localLandmark:            row.local_landmark,
  localLatLong:             row.local_lat_long,
  // Family
  familyMemberName:         row.family_member_name,
  familyContactNo:          row.family_contact_no,
  familyWorkingStatus:      row.family_working_status,
  familyEmployerName:       row.family_employer_name,
  familyEmployerContact:    row.family_employer_contact,
  // Emergency
  emergencyContactName:     row.emergency_contact_name,
  emergencyContactNo:       row.emergency_contact_no,
  emergencyContactAddress:  row.emergency_contact_address,
  emergencyContactRelation: row.emergency_contact_relation,
  // References
  ref1Name:         row.ref1_name,    ref1Designation:  row.ref1_designation,
  ref1Organization: row.ref1_organization, ref1Address:  row.ref1_address,
  ref1CityStatePin: row.ref1_city_state_pin, ref1ContactNo: row.ref1_contact_no,
  ref1Email:        row.ref1_email,
  ref2Name:         row.ref2_name,    ref2Designation:  row.ref2_designation,
  ref2Organization: row.ref2_organization, ref2Address:  row.ref2_address,
  ref2CityStatePin: row.ref2_city_state_pin, ref2ContactNo: row.ref2_contact_no,
  ref2Email:        row.ref2_email,
  ref3Name:         row.ref3_name,    ref3Designation:  row.ref3_designation,
  ref3Organization: row.ref3_organization, ref3Address:  row.ref3_address,
  ref3CityStatePin: row.ref3_city_state_pin, ref3ContactNo: row.ref3_contact_no,
  ref3Email:        row.ref3_email,
  // Employment
  department:       row.department,
  position:         row.position,
  joiningDate:      row.joining_date
                      ? new Date(row.joining_date).toISOString().split('T')[0]
                      : '',
  employmentType:   row.employment_type,
  reportingManager: row.reporting_manager,
  circle:           row.circle,
  projectName:      row.project_name,
  // Bank
  bankName:          row.bank_name,
  accountNumber:     row.account_number,
  ifscCode:          row.ifsc_code,
  accountHolderName: row.account_holder_name,
  bankBranch:        row.bank_branch,
  // Meta
  oldEmployeeId:     row.old_employee_id ?? row.employee_id,
});

// =============================================================================
// POST /api/registration-links
// Requires: requireAdmin, validateEmailBody, validateExpiryDays,
//           guardNoDuplicateActiveLink
// =============================================================================
export const generateLink = async (req, res) => {
  const { employeeEmail, expiresInDays } = req.body;
  const adminId = req.admin.id;

  const linkId    = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const FRONTEND_URL    = process.env.FRONTEND_URL || 'http://localhost:3000';
  const registrationUrl = `${FRONTEND_URL}/registration/${linkId}`;

  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO registration_links
         (link_id, employee_email, expires_at, status, is_used, created_by)
       VALUES ($1, $2, $3, 'active', false, $4)`,
      [linkId, employeeEmail, expiresAt, adminId]
    );

    console.log(`🔗 [generateLink] ${linkId} → "${employeeEmail}" by admin ${adminId}`);

    // Fire-and-forget email
    sendRegistrationLinkEmail({
      to:              employeeEmail,
      toName:          employeeEmail,
      registrationUrl,
      expiresAt:       expiresAt.toISOString(),
    }).catch((err) => console.error('Registration link email failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Registration link generated and emailed successfully.',
      data: {
        linkId,
        employeeEmail,
        registrationUrl,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('❌ [generateLink]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// GET /api/registration-links
// Requires: requireAdmin
// =============================================================================
export const listLinks = async (_req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        rl.*,
        au.full_name AS created_by_name
      FROM registration_links rl
      LEFT JOIN admin_users au ON rl.created_by = au.id
      ORDER BY rl.created_at DESC
      LIMIT 200
    `);

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('❌ [listLinks]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// GET /api/registration-links/:linkId/validate
// Requires: loadLinkByParam, guardLinkValid
// req.link is already loaded and confirmed valid by middleware.
// =============================================================================
export const validateLink = async (req, res) => {
  const link = req.link;

  let prefillData = null;

  // For rejoin links: fetch the employee row and build prefill object
  if (link.is_rejoin && link.prefill_employee_id) {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT * FROM employees WHERE id = $1`,
        [link.prefill_employee_id]
      );

      if (rows[0]) {
        prefillData = buildPrefillData(rows[0]);
      }
    } catch (err) {
      console.error('❌ [validateLink] prefill fetch failed:', err.message);
      // non-fatal — return valid link without prefill
    } finally {
      client.release();
    }
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
};

// =============================================================================
// DELETE /api/registration-links/:linkId
// Requires: requireAdmin, loadLinkByParam
// =============================================================================
export const deleteLink = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `DELETE FROM registration_links
       WHERE link_id = $1 OR id::text = $1
       RETURNING *`,
      [req.params.linkId]
    );

    // loadLinkByParam already confirmed it exists, but guard anyway
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Registration link not found.' });
    }

    console.log(`🗑️  [deleteLink] ${req.params.linkId} deleted by admin ${req.admin.id}`);

    return res.json({
      success: true,
      message: 'Registration link deleted successfully.',
      data:    rows[0],
    });
  } catch (err) {
    console.error('❌ [deleteLink]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};