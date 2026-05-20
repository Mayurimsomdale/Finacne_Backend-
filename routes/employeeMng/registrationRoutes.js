// routes/employeeMng/registrationRoutes.js
// ✅ FIXED: uan_number added to:
//   1. commonFields array (reads d.uanNumber from form body)
//   2. resubmit UPDATE query  ($16 = uan_number, all subsequent params shifted +1)
//   3. rejoin UPDATE query    (same shift)
//   4. new employee INSERT    (uan_number column + value added)
//   5. GET /check-aadhar      (SELECT + returned data object)
//   6. GET /prefill/:token    (returned data object)

import express     from 'express';
import multer      from 'multer';
import path        from 'path';
import fs          from 'fs';
import crypto      from 'crypto';
import { fileURLToPath } from 'url';
import pool        from '../../config/database.js';

import { generateKYEPdfBuffer } from '../../services/kyePdfService.js';
import {
  sendFormSubmissionConfirmation,
  sendHRSubmissionNotification,
  sendApprovalEmail,
  sendApprovalEmailWithKYEPdf,
  sendRejectionEmailWithRelink,
  sendHRApprovalNotification,
  sendHRRejectionNotification,
} from '../../services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const router     = express.Router();

// ─── Multer ───────────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const UPLOAD_DIR   = path.join(PROJECT_ROOT, 'uploads', 'employee_docs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'), false);
  },
}).fields([
  { name: 'idPhoto',            maxCount: 1 },
  { name: 'aadharCard',         maxCount: 1 },
  { name: 'panCard',            maxCount: 1 },
  { name: 'resume',             maxCount: 1 },
  { name: 'medicalCertificate', maxCount: 1 },
  { name: 'academicRecords',    maxCount: 1 },
  { name: 'bankPassbook',       maxCount: 1 },
  { name: 'payslip',            maxCount: 1 },
  { name: 'farmToCli',          maxCount: 1 },
  { name: 'otherCertificates',  maxCount: 1 },
]);

function applyMulter(req, res) {
  return new Promise((resolve, reject) =>
    upload(req, res, (err) => (err ? reject(err) : resolve()))
  );
}

function cleanupFiles(files = {}) {
  Object.values(files).flat().forEach((f) => {
    try { fs.unlinkSync(f.path); } catch (_) {}
  });
}

const str     = (v) => (v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : null);
const dateStr = (v) => {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
};
const bool = (v) => v === true || v === 'true' || v === '1';

// ✅ UAN validator — numeric only, max 12 digits, null if blank/invalid
const strUan = (v) => {
  const s = str(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, '').slice(0, 12);
  return digits || null;
};

async function saveDocument(client, empDbId, type, file) {
  if (!file) return;
  await client.query(
    `INSERT INTO employee_documents
      (employee_id, document_type, file_path, file_name, file_size, mime_type)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [empDbId, type, `/uploads/employee_docs/${file.filename}`,
    file.originalname, file.size, file.mimetype]
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// generateEmployeeId — Format: Insta-YYMMNNN+
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// generateEmployeeId — Format: Insta-YYMMxxxx  (e.g. Insta-26050001)
// 4-digit zero-padded sequence, resets per month, starts at 0001
// ══════════════════════════════════════════════════════════════════════════════
async function generateEmployeeId(client) {
  const now    = new Date();
  const yy     = String(now.getFullYear()).slice(-2);
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `Insta-${yy}${mm}`;

  const { rows } = await client.query(`
    SELECT employee_id
    FROM employees
    WHERE employee_id LIKE $1
    ORDER BY
      CAST(REGEXP_REPLACE(employee_id, '[^0-9]', '', 'g') AS BIGINT) DESC
    LIMIT 1
  `, [`${prefix}%`]);

  let nextSeq = 1;
  if (rows[0]) {
    const lastId  = rows[0].employee_id;
    const seqStr  = lastId.slice(prefix.length); // digits after "Insta-YYMM"
    const lastSeq = parseInt(seqStr, 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ── Helper: restore employee from snapshot ────────────────────────────────────
async function restoreFromSnapshot(client, empId, snapshot, newStatus = 'inactive') {
  if (!snapshot) {
    await client.query(
      `UPDATE employees SET status=$1, updated_at=CURRENT_TIMESTAMP,
        rejoin_snapshot=NULL, active_rejoin_link_id=NULL
       WHERE id=$2`,
      [newStatus, empId]
    );
    return;
  }

  const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;

  await client.query(`
    UPDATE employees SET
      first_name=$1, last_name=$2, middle_name=$3, father_husband_name=$4,
      email=$5, phone=$6, alt_phone=$7,
      date_of_birth=$8, gender=$9, marital_status=$10,
      educational_qualification=$11, blood_group=$12,
      pan_number=$13, name_on_pan=$14,
      aadhar_number=$15, name_on_aadhar=$16,
      uan_number=$17,
      family_member_name=$18, family_contact_no=$19, family_working_status=$20,
      family_employer_name=$21, family_employer_contact=$22,
      emergency_contact_name=$23, emergency_contact_no=$24,
      emergency_contact_address=$25, emergency_contact_relation=$26,
      permanent_address=$27, permanent_phone=$28, permanent_landmark=$29, permanent_lat_long=$30,
      local_same_as_permanent=$31, local_address=$32, local_phone=$33,
      local_landmark=$34, local_lat_long=$35,
      ref1_name=$36, ref1_designation=$37, ref1_organization=$38, ref1_address=$39,
      ref1_city_state_pin=$40, ref1_contact_no=$41, ref1_email=$42,
      ref2_name=$43, ref2_designation=$44, ref2_organization=$45, ref2_address=$46,
      ref2_city_state_pin=$47, ref2_contact_no=$48, ref2_email=$49,
      ref3_name=$50, ref3_designation=$51, ref3_organization=$52, ref3_address=$53,
      ref3_city_state_pin=$54, ref3_contact_no=$55, ref3_email=$56,
      department=$57, position=$58, joining_date=$59, employment_type=$60,
      circle=$61, project_name=$62, reporting_manager=$63,
      bank_name=$64, account_number=$65, ifsc_code=$66,
      account_holder_name=$67, bank_branch=$68,
      basic_salary=$69, hra=$70, other_allowances=$71,
      address=$72, city=$73, state=$74, zip_code=$75,
      status=$76,
      rejoin_snapshot=NULL, active_rejoin_link_id=NULL,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=$77
  `, [
    s.first_name, s.last_name, s.middle_name, s.father_husband_name,
    s.email, s.phone, s.alt_phone,
    s.date_of_birth, s.gender, s.marital_status,
    s.educational_qualification, s.blood_group,
    s.pan_number, s.name_on_pan,
    s.aadhar_number, s.name_on_aadhar,
    s.uan_number || null,                           // ✅ $17 — was missing
    s.family_member_name, s.family_contact_no, s.family_working_status,
    s.family_employer_name, s.family_employer_contact,
    s.emergency_contact_name, s.emergency_contact_no,
    s.emergency_contact_address, s.emergency_contact_relation,
    s.permanent_address, s.permanent_phone, s.permanent_landmark, s.permanent_lat_long,
    s.local_same_as_permanent || false,
    s.local_address, s.local_phone, s.local_landmark, s.local_lat_long,
    s.ref1_name, s.ref1_designation, s.ref1_organization, s.ref1_address,
    s.ref1_city_state_pin, s.ref1_contact_no, s.ref1_email,
    s.ref2_name, s.ref2_designation, s.ref2_organization, s.ref2_address,
    s.ref2_city_state_pin, s.ref2_contact_no, s.ref2_email,
    s.ref3_name, s.ref3_designation, s.ref3_organization, s.ref3_address,
    s.ref3_city_state_pin, s.ref3_contact_no, s.ref3_email,
    s.department, s.position, s.joining_date, s.employment_type,
    s.circle, s.project_name, s.reporting_manager,
    s.bank_name, s.account_number, s.ifsc_code,
    s.account_holder_name, s.bank_branch,
    s.basic_salary || 0, s.hra || 0, s.other_allowances || 0,
    s.address || '', s.city || '', s.state || '', s.zip_code || '',
    newStatus,
    empId,
  ]);
}

// =============================================================================
// GET /api/registrations/check-aadhar/:aadhar
// ✅ FIXED: uan_number added to SELECT and returned data object
// =============================================================================
router.get('/check-aadhar/:aadhar', async (req, res) => {
  const client = await pool.connect();
  try {
    const aadhar = req.params.aadhar.replace(/\s/g, '');
    if (aadhar.length !== 12) {
      return res.status(400).json({ success: false, message: 'Aadhaar must be 12 digits' });
    }

    const { rows } = await client.query(
      `SELECT id, first_name, last_name, email, phone, status, employee_id,
              department, position, date_of_birth, gender, blood_group,
              aadhar_number, name_on_aadhar, pan_number, name_on_pan,
              father_husband_name, marital_status, educational_qualification,
              alt_phone, permanent_address, permanent_phone, permanent_landmark,
              permanent_lat_long, local_same_as_permanent, local_address,
              local_phone, local_landmark, local_lat_long,
              family_member_name, family_contact_no, family_working_status,
              family_employer_name, family_employer_contact,
              emergency_contact_name, emergency_contact_no,
              emergency_contact_address, emergency_contact_relation,
              ref1_name, ref1_designation, ref1_organization, ref1_address,
              ref1_city_state_pin, ref1_contact_no, ref1_email,
              ref2_name, ref2_designation, ref2_organization, ref2_address,
              ref2_city_state_pin, ref2_contact_no, ref2_email,
              ref3_name, ref3_designation, ref3_organization, ref3_address,
              ref3_city_state_pin, ref3_contact_no, ref3_email,
              bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
              joining_date, reporting_manager, employment_type, circle, project_name,
              uan_number
      FROM employees
      WHERE aadhar_number = $1
      ORDER BY created_at DESC
      LIMIT 1`,
      [aadhar]
    );

    if (!rows[0]) return res.json({ exists: false });

   const emp = rows[0];
    const REJOINABLE = new Set(['inactive', 'rejected']);
    return res.json({
      exists:     true,
      status:     emp.status,
      canRejoin:  REJOINABLE.has(emp.status),   // ← ADD THIS
      employeeId: emp.employee_id,
      data: {

        firstName:                emp.first_name,
        fatherHusbandName:        emp.father_husband_name,
        lastName:                 emp.last_name,
        dob:                      emp.date_of_birth ? emp.date_of_birth.toISOString().split('T')[0] : '',
        gender:                   emp.gender,
        maritalStatus:            emp.marital_status,
        educationalQualification: emp.educational_qualification,
        bloodGroup:               emp.blood_group,
        panNumber:                emp.pan_number,
        nameOnPan:                emp.name_on_pan,
        aadhar:                   emp.aadhar_number,
        nameOnAadhar:             emp.name_on_aadhar,
        uanNumber:                emp.uan_number || '',   
        email:                    emp.email,
        phone:                    emp.phone,
        altPhone:                 emp.alt_phone,
        permanentAddress:         emp.permanent_address,
        permanentPhone:           emp.permanent_phone,
        permanentLandmark:        emp.permanent_landmark,
        permanentLatLong:         emp.permanent_lat_long,
        localSameAsPermanent:     emp.local_same_as_permanent,
        localAddress:             emp.local_address,
        localPhone:               emp.local_phone,
        localLandmark:            emp.local_landmark,
        localLatLong:             emp.local_lat_long,
        familyMemberName:         emp.family_member_name,
        familyContactNo:          emp.family_contact_no,
        familyWorkingStatus:      emp.family_working_status,
        familyEmployerName:       emp.family_employer_name,
        familyEmployerContact:    emp.family_employer_contact,
        emergencyContactName:     emp.emergency_contact_name,
        emergencyContactNo:       emp.emergency_contact_no,
        emergencyContactAddress:  emp.emergency_contact_address,
        emergencyContactRelation: emp.emergency_contact_relation,
        ref1Name: emp.ref1_name, ref1Designation: emp.ref1_designation,
        ref1Organization: emp.ref1_organization, ref1Address: emp.ref1_address,
        ref1CityStatePin: emp.ref1_city_state_pin, ref1ContactNo: emp.ref1_contact_no,
        ref1Email: emp.ref1_email,
        ref2Name: emp.ref2_name, ref2Designation: emp.ref2_designation,
        ref2Organization: emp.ref2_organization, ref2Address: emp.ref2_address,
        ref2CityStatePin: emp.ref2_city_state_pin, ref2ContactNo: emp.ref2_contact_no,
        ref2Email: emp.ref2_email,
        ref3Name: emp.ref3_name, ref3Designation: emp.ref3_designation,
        ref3Organization: emp.ref3_organization, ref3Address: emp.ref3_address,
        ref3CityStatePin: emp.ref3_city_state_pin, ref3ContactNo: emp.ref3_contact_no,
        ref3Email: emp.ref3_email,
        department:       emp.department,
        position:         emp.position,
        joiningDate:      emp.joining_date ? emp.joining_date.toISOString().split('T')[0] : '',
        employmentType:   emp.employment_type,
        reportingManager: emp.reporting_manager,
        circle:           emp.circle,
        projectName:      emp.project_name,
        bankName:          emp.bank_name,
        accountNumber:     emp.account_number,
        ifscCode:          emp.ifsc_code,
        accountHolderName: emp.account_holder_name,
        bankBranch:        emp.bank_branch,
      },
    });
  } catch (err) {
    console.error('❌ [GET /registrations/check-aadhar]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// POST /api/registrations
// ✅ FIXED: uan_number added to commonFields and all three SQL statements
// =============================================================================
router.post('/', async (req, res) => {
  try { await applyMulter(req, res); } catch (uploadErr) {
    return res.status(400).json({
      success: false,
      message: uploadErr.code === 'LIMIT_FILE_SIZE' ? 'File size must be less than 5MB' : uploadErr.message,
    });
  }

  const client = await pool.connect();
  try {
    const d = req.body;
    const f = req.files || {};

    const linkId        = str(d.linkId);
    const resubmitToken = str(d.resubmitToken);
    const isRejoin      = bool(d.isRejoin);

    let link          = null;
    let isResubmit    = false;
    let existingEmpId = null;
    let existingEmp   = null;

    if (resubmitToken) {
      const { rows: empRows } = await client.query(
        `SELECT * FROM employees
        WHERE resubmit_token = $1
          AND resubmit_expires_at > CURRENT_TIMESTAMP
          AND status = 'rejected'`,
        [resubmitToken]
      );
      if (!empRows[0]) {
        return res.status(410).json({ success: false, message: 'Resubmission link is invalid or has expired.' });
      }
      isResubmit    = true;
      existingEmpId = empRows[0].id;

    } else if (isRejoin) {
      const aadhar = str(d.aadhar)?.replace(/\s/g, '') || null;
      if (!aadhar) {
        return res.status(400).json({ success: false, message: 'Aadhaar is required for rejoin.' });
      }
      const { rows: empRows } = await client.query(
        `SELECT * FROM employees WHERE aadhar_number = $1 ORDER BY created_at DESC LIMIT 1`,
        [aadhar]
      );
      if (!empRows[0]) {
        return res.status(404).json({ success: false, message: 'No existing record found for this Aadhaar number.' });
      }
      existingEmp   = empRows[0];
      existingEmpId = existingEmp.id;

      if (existingEmp.status === 'blacklisted') {
        return res.status(403).json({ success: false, message: 'This employee is blacklisted and cannot rejoin.' });
      }
      if (existingEmp.status === 'active') {
        return res.status(409).json({ success: false, message: 'This employee is currently active.' });
      }

      if (!linkId) {
        return res.status(400).json({ success: false, message: 'Missing registration link for rejoin request.' });
      }
      const { rows: linkRows } = await client.query(
        'SELECT * FROM registration_links WHERE link_id = $1', [linkId]
      );
      if (!linkRows[0]) return res.status(404).json({ success: false, message: 'Invalid registration link' });
      link = linkRows[0];
      if (link.is_used)                           return res.status(410).json({ success: false, used: true,    message: 'Link already used' });
      if (new Date(link.expires_at) < new Date()) return res.status(410).json({ success: false, expired: true, message: 'Link expired' });

    } else if (linkId) {
      const { rows: linkRows } = await client.query(
        'SELECT * FROM registration_links WHERE link_id = $1', [linkId]
      );
      if (!linkRows[0]) return res.status(404).json({ success: false, message: 'Invalid registration link' });
      link = linkRows[0];
      if (link.is_used)                           return res.status(410).json({ success: false, used: true,    message: 'Link already used' });
      if (new Date(link.expires_at) < new Date()) return res.status(410).json({ success: false, expired: true, message: 'Link expired' });

    } else {
      return res.status(400).json({ success: false, message: 'Missing linkId or resubmitToken' });
    }

    if (!isResubmit && !isRejoin) {
      const aadhar = str(d.aadhar)?.replace(/\s/g, '') || null;
      if (aadhar) {
        const { rows: dupRows } = await client.query(
          'SELECT id, status FROM employees WHERE aadhar_number = $1', [aadhar]
        );
        if (dupRows.length > 0) {
          return res.status(409).json({
            success: false, aadharExists: true, status: dupRows[0].status,
            message: 'An employee with this Aadhaar number already exists.',
          });
        }
      }
    }

    const email = str(d.email)?.toLowerCase();

    await client.query('BEGIN');

    let employeeDbId;

    // ✅ FIXED: commonFields now includes uan_number at position [16] (0-indexed 15)
   
    const commonFields = [
      str(d.firstName), str(d.fatherHusbandName), str(d.lastName),
      email, str(d.phone), str(d.altPhone),
      dateStr(d.dob), str(d.gender), str(d.maritalStatus),
      str(d.educationalQualification), str(d.bloodGroup),
      str(d.panNumber)?.toUpperCase() || null, str(d.nameOnPan),
      str(d.aadhar)?.replace(/\s/g,'') || null, str(d.nameOnAadhar),
      strUan(d.uanNumber),                                              // ✅ position [15] → SQL $16
      str(d.familyMemberName), str(d.familyContactNo), str(d.familyWorkingStatus),
      str(d.familyEmployerName), str(d.familyEmployerContact),
      str(d.emergencyContactName), str(d.emergencyContactNo),
      str(d.emergencyContactAddress), str(d.emergencyContactRelation),
      str(d.permanentAddress), str(d.permanentPhone),
      str(d.permanentLandmark), str(d.permanentLatLong),
      bool(d.localSameAsPermanent),
      bool(d.localSameAsPermanent) ? str(d.permanentAddress) : str(d.localAddress),
      bool(d.localSameAsPermanent) ? str(d.permanentPhone)   : str(d.localPhone),
      bool(d.localSameAsPermanent) ? str(d.permanentLandmark): str(d.localLandmark),
      bool(d.localSameAsPermanent) ? str(d.permanentLatLong) : str(d.localLatLong),
      str(d.ref1Name), str(d.ref1Designation), str(d.ref1Organization),
      str(d.ref1Address), str(d.ref1CityStatePin), str(d.ref1ContactNo), str(d.ref1Email),
      str(d.ref2Name), str(d.ref2Designation), str(d.ref2Organization),
      str(d.ref2Address), str(d.ref2CityStatePin), str(d.ref2ContactNo), str(d.ref2Email),
      str(d.ref3Name), str(d.ref3Designation), str(d.ref3Organization),
      str(d.ref3Address), str(d.ref3CityStatePin), str(d.ref3ContactNo), str(d.ref3Email),
      str(d.department), str(d.position),
      str(d.circle), str(d.projectName),
      dateStr(d.joiningDate), str(d.reportingManager), str(d.employmentType),
      str(d.bankName), str(d.accountNumber),
      str(d.ifscCode)?.toUpperCase() || null,
      str(d.accountHolderName), str(d.bankBranch),
    ];
    // commonFields.length = 67  → SQL params $1..$67, then empId = $68

    if (isResubmit) {
      // ✅ FIXED: uan_number = $16, all subsequent params shifted by +1
      // Previous last param was $66 (existingEmpId), now it is $68
      const { rows: updRows } = await client.query(`
        UPDATE employees SET
          first_name = $1, father_husband_name = $2, last_name = $3,
          email = $4, phone = $5, alt_phone = $6,
          date_of_birth = $7, gender = $8, marital_status = $9,
          educational_qualification = $10, blood_group = $11,
          pan_number = $12, name_on_pan = $13,
          aadhar_number = $14, name_on_aadhar = $15,
          uan_number = $16,
          family_member_name = $17, family_contact_no = $18, family_working_status = $19,
          family_employer_name = $20, family_employer_contact = $21,
          emergency_contact_name = $22, emergency_contact_no = $23,
          emergency_contact_address = $24, emergency_contact_relation = $25,
          permanent_address = $26, permanent_phone = $27,
          permanent_landmark = $28, permanent_lat_long = $29,
          local_same_as_permanent = $30,
          local_address = $31, local_phone = $32, local_landmark = $33, local_lat_long = $34,
          ref1_name = $35, ref1_designation = $36, ref1_organization = $37,
          ref1_address = $38, ref1_city_state_pin = $39, ref1_contact_no = $40, ref1_email = $41,
          ref2_name = $42, ref2_designation = $43, ref2_organization = $44,
          ref2_address = $45, ref2_city_state_pin = $46, ref2_contact_no = $47, ref2_email = $48,
          ref3_name = $49, ref3_designation = $50, ref3_organization = $51,
          ref3_address = $52, ref3_city_state_pin = $53, ref3_contact_no = $54, ref3_email = $55,
          department = $56, position = $57,
          circle = $58, project_name = $59,
          joining_date = $60, reporting_manager = $61, employment_type = $62,
          bank_name = $63, account_number = $64, ifsc_code = $65,
          account_holder_name = $66, bank_branch = $67,
          status = 'pending',
          rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL,
          resubmit_token = NULL, resubmit_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $68
        RETURNING id
      `, [...commonFields, existingEmpId]);

      employeeDbId = updRows[0].id;

      if (Object.keys(f).length > 0) {
        await client.query('DELETE FROM employee_documents WHERE employee_id = $1', [employeeDbId]);
        await Promise.all(
          Object.entries(f).map(([fieldName, fileArr]) =>
            saveDocument(client, employeeDbId, fieldName, fileArr?.[0])
          )
        );
      }

    } else if (isRejoin) {
      // ✅ FIXED: uan_number = $16, all subsequent params shifted by +1
      const { rows: updRows } = await client.query(`
        UPDATE employees SET
          first_name = $1, father_husband_name = $2, last_name = $3,
          email = $4, phone = $5, alt_phone = $6,
          date_of_birth = $7, gender = $8, marital_status = $9,
          educational_qualification = $10, blood_group = $11,
          pan_number = $12, name_on_pan = $13,
          aadhar_number = $14, name_on_aadhar = $15,
          uan_number = $16,
          family_member_name = $17, family_contact_no = $18, family_working_status = $19,
          family_employer_name = $20, family_employer_contact = $21,
          emergency_contact_name = $22, emergency_contact_no = $23,
          emergency_contact_address = $24, emergency_contact_relation = $25,
          permanent_address = $26, permanent_phone = $27,
          permanent_landmark = $28, permanent_lat_long = $29,
          local_same_as_permanent = $30,
          local_address = $31, local_phone = $32, local_landmark = $33, local_lat_long = $34,
          ref1_name = $35, ref1_designation = $36, ref1_organization = $37,
          ref1_address = $38, ref1_city_state_pin = $39, ref1_contact_no = $40, ref1_email = $41,
          ref2_name = $42, ref2_designation = $43, ref2_organization = $44,
          ref2_address = $45, ref2_city_state_pin = $46, ref2_contact_no = $47, ref2_email = $48,
          ref3_name = $49, ref3_designation = $50, ref3_organization = $51,
          ref3_address = $52, ref3_city_state_pin = $53, ref3_contact_no = $54, ref3_email = $55,
          department = $56, position = $57,
          circle = $58, project_name = $59,
          joining_date = $60, reporting_manager = $61, employment_type = $62,
          bank_name = $63, account_number = $64, ifsc_code = $65,
          account_holder_name = $66, bank_branch = $67,
          status = 'pending_rejoin',
          rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL,
          resubmit_token = NULL, resubmit_expires_at = NULL,
          rejoin_requested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $68
        RETURNING id
      `, [...commonFields, existingEmpId]);

      employeeDbId = updRows[0].id;

      if (Object.keys(f).length > 0) {
        await client.query('DELETE FROM employee_documents WHERE employee_id = $1', [employeeDbId]);
        await Promise.all(
          Object.entries(f).map(([fieldName, fileArr]) =>
            saveDocument(client, employeeDbId, fieldName, fileArr?.[0])
          )
        );
      }

      await client.query(
        `UPDATE registration_links SET is_used=true, status='used', used_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [link.id]
      );

    } else {
      // ✅ FIXED: uan_number column + $17 value added to INSERT
      // link.id = $1, then commonFields $2..$68, then address fields $69..$72, status $73
      const { rows: empRows } = await client.query(`
        INSERT INTO employees (
          registration_link_id,
          first_name, father_husband_name, last_name,
          email, phone, alt_phone,
          date_of_birth, gender, marital_status,
          educational_qualification, blood_group,
          pan_number, name_on_pan, aadhar_number, name_on_aadhar,
          uan_number,
          family_member_name, family_contact_no, family_working_status,
          family_employer_name, family_employer_contact,
          emergency_contact_name, emergency_contact_no,
          emergency_contact_address, emergency_contact_relation,
          permanent_address, permanent_phone, permanent_landmark, permanent_lat_long,
          local_same_as_permanent, local_address, local_phone, local_landmark, local_lat_long,
          ref1_name, ref1_designation, ref1_organization, ref1_address, ref1_city_state_pin, ref1_contact_no, ref1_email,
          ref2_name, ref2_designation, ref2_organization, ref2_address, ref2_city_state_pin, ref2_contact_no, ref2_email,
          ref3_name, ref3_designation, ref3_organization, ref3_address, ref3_city_state_pin, ref3_contact_no, ref3_email,
          department, position, circle, project_name,
          joining_date, reporting_manager, employment_type,
          bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
          address, city, state, zip_code,
          status
        ) VALUES (
          $1,
          $2,$3,$4,
          $5,$6,$7,
          $8,$9,$10,
          $11,$12,
          $13,$14,$15,$16,
          $17,
          $18,$19,$20,
          $21,$22,
          $23,$24,
          $25,$26,
          $27,$28,$29,$30,
          $31,$32,$33,$34,$35,
          $36,$37,$38,$39,$40,$41,$42,
          $43,$44,$45,$46,$47,$48,$49,
          $50,$51,$52,$53,$54,$55,$56,
          $57,$58,$59,$60,
          $61,$62,$63,
          $64,$65,$66,$67,$68,
          $69,$70,$71,$72,
          $73
        ) RETURNING id
      `, [
        link.id,
        // $2–$16: personal fields (firstName…nameOnAadhar) from commonFields[0..14]
        commonFields[0],  // first_name
        commonFields[1],  // father_husband_name
        commonFields[2],  // last_name
        commonFields[3],  // email
        commonFields[4],  // phone
        commonFields[5],  // alt_phone
        commonFields[6],  // date_of_birth
        commonFields[7],  // gender
        commonFields[8],  // marital_status
        commonFields[9],  // educational_qualification
        commonFields[10], // blood_group
        commonFields[11], // pan_number
        commonFields[12], // name_on_pan
        commonFields[13], // aadhar_number
        commonFields[14], // name_on_aadhar
        // $17: uan_number ✅
        commonFields[15], // uan_number
        // $18–$35: family, emergency
        commonFields[16], // family_member_name
        commonFields[17], // family_contact_no
        commonFields[18], // family_working_status
        commonFields[19], // family_employer_name
        commonFields[20], // family_employer_contact
        commonFields[21], // emergency_contact_name
        commonFields[22], // emergency_contact_no
        commonFields[23], // emergency_contact_address
        commonFields[24], // emergency_contact_relation
        // $27–$35: permanent address
        commonFields[25], // permanent_address
        commonFields[26], // permanent_phone
        commonFields[27], // permanent_landmark
        commonFields[28], // permanent_lat_long
        // $31–$35: local address
        commonFields[29], // local_same_as_permanent
        commonFields[30], // local_address
        commonFields[31], // local_phone
        commonFields[32], // local_landmark
        commonFields[33], // local_lat_long
        // $36–$56: references
        commonFields[34], // ref1_name
        commonFields[35], // ref1_designation
        commonFields[36], // ref1_organization
        commonFields[37], // ref1_address
        commonFields[38], // ref1_city_state_pin
        commonFields[39], // ref1_contact_no
        commonFields[40], // ref1_email
        commonFields[41], // ref2_name
        commonFields[42], // ref2_designation
        commonFields[43], // ref2_organization
        commonFields[44], // ref2_address
        commonFields[45], // ref2_city_state_pin
        commonFields[46], // ref2_contact_no
        commonFields[47], // ref2_email
        commonFields[48], // ref3_name
        commonFields[49], // ref3_designation
        commonFields[50], // ref3_organization
        commonFields[51], // ref3_address
        commonFields[52], // ref3_city_state_pin
        commonFields[53], // ref3_contact_no
        commonFields[54], // ref3_email
        // $57–$68: employment + bank
        commonFields[55], // department
        commonFields[56], // position
        commonFields[57], // circle
        commonFields[58], // project_name
        commonFields[59], // joining_date
        commonFields[60], // reporting_manager
        commonFields[61], // employment_type
        commonFields[62], // bank_name
        commonFields[63], // account_number
        commonFields[64], // ifsc_code
        commonFields[65], // account_holder_name
        commonFields[66], // bank_branch
        // $69–$72: legacy address fields
        str(d.permanentAddress) || '', '', '', '',
        // $73: status
        'pending',
      ]);

      employeeDbId = empRows[0].id;

      await Promise.all(
        Object.entries(f).map(([fieldName, fileArr]) =>
          saveDocument(client, employeeDbId, fieldName, fileArr?.[0])
        )
      );

      await client.query(
        `UPDATE registration_links SET is_used=true, status='used', used_at=CURRENT_TIMESTAMP WHERE id=$1`,
        [link.id]
      );
    }

    await client.query('COMMIT');

    const flowLabel = isRejoin ? 're-join' : isResubmit ? 're' : '';
    console.log(`✅ Registration ${flowLabel}submitted — id=${employeeDbId}, email=${email}`);

    const formDataForEmail = { ...d, email };
    setImmediate(async () => {
      if (email) {
        await sendFormSubmissionConfirmation({ to: email, formData: formDataForEmail, isRejoin })
          .catch(e => console.error('Confirmation email failed:', e.message));
      }
      await sendHRSubmissionNotification({ formData: formDataForEmail, employeeDbId, isRejoin })
        .catch(e => console.error('HR notification email failed:', e.message));
    });

    return res.status(201).json({
      success: true,
      message: isRejoin
        ? 'Rejoin request submitted successfully. HR will review your application.'
        : isResubmit
          ? 'Registration resubmitted successfully. HR will review your updated application.'
          : 'Registration submitted successfully. HR will review your application.',
      data: { employeeId: employeeDbId },
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    cleanupFiles(req.files);
    console.error('❌ submitRegistration:', err.message);
    return res.status(500).json({ success: false, message: err.message || 'Registration submission failed.' });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registrations/prefill/:token
// ✅ FIXED: uan_number added to returned data object
// =============================================================================
router.get('/prefill/:token', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT e.*,
        COALESCE(
          json_agg(json_build_object(
            'type', d.document_type, 'path', d.file_path,
            'name', d.file_name, 'mime_type', d.mime_type
          )) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM employees e
      LEFT JOIN employee_documents d ON d.employee_id = e.id
      WHERE e.resubmit_token = $1
        AND e.resubmit_expires_at > CURRENT_TIMESTAMP
        AND e.status = 'rejected'
      GROUP BY e.id`,
      [req.params.token]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'This resubmission link is invalid or has expired.',
      });
    }

    const emp = rows[0];
    return res.json({
      success: true,
      data: {
        resubmitToken:             emp.resubmit_token,
        rejectionReason:           emp.rejection_reason,
        firstName:                 emp.first_name,
        lastName:                  emp.last_name,
        fatherHusbandName:         emp.father_husband_name,
        dob:                       emp.date_of_birth ? emp.date_of_birth.toISOString().split('T')[0] : '',
        gender:                    emp.gender,
        maritalStatus:             emp.marital_status,
        bloodGroup:                emp.blood_group,
        educationalQualification:  emp.educational_qualification,
        panNumber:                 emp.pan_number,
        nameOnPan:                 emp.name_on_pan,
        aadhar:                    emp.aadhar_number,
        nameOnAadhar:              emp.name_on_aadhar,
        uanNumber:                 emp.uan_number || '',   // ✅ FIXED
        email:                     emp.email,
        phone:                     emp.phone,
        altPhone:                  emp.alt_phone,
        permanentAddress:          emp.permanent_address,
        permanentPhone:            emp.permanent_phone,
        permanentLandmark:         emp.permanent_landmark,
        permanentLatLong:          emp.permanent_lat_long,
        localSameAsPermanent:      emp.local_same_as_permanent,
        localAddress:              emp.local_address,
        localPhone:                emp.local_phone,
        localLandmark:             emp.local_landmark,
        localLatLong:              emp.local_lat_long,
        emergencyContactName:      emp.emergency_contact_name,
        emergencyContactNo:        emp.emergency_contact_no,
        emergencyContactAddress:   emp.emergency_contact_address,
        emergencyContactRelation:  emp.emergency_contact_relation,
        familyMemberName:          emp.family_member_name,
        familyContactNo:           emp.family_contact_no,
        familyWorkingStatus:       emp.family_working_status,
        familyEmployerName:        emp.family_employer_name,
        familyEmployerContact:     emp.family_employer_contact,
        ref1Name: emp.ref1_name, ref1Designation: emp.ref1_designation,
        ref1Organization: emp.ref1_organization, ref1Address: emp.ref1_address,
        ref1CityStatePin: emp.ref1_city_state_pin, ref1ContactNo: emp.ref1_contact_no,
        ref1Email: emp.ref1_email,
        ref2Name: emp.ref2_name, ref2Designation: emp.ref2_designation,
        ref2Organization: emp.ref2_organization, ref2Address: emp.ref2_address,
        ref2CityStatePin: emp.ref2_city_state_pin, ref2ContactNo: emp.ref2_contact_no,
        ref2Email: emp.ref2_email,
        ref3Name: emp.ref3_name, ref3Designation: emp.ref3_designation,
        ref3Organization: emp.ref3_organization, ref3Address: emp.ref3_address,
        ref3CityStatePin: emp.ref3_city_state_pin, ref3ContactNo: emp.ref3_contact_no,
        ref3Email: emp.ref3_email,
        department:       emp.department,
        position:         emp.position,
        circle:           emp.circle,
        projectName:      emp.project_name,
        joiningDate:      emp.joining_date ? emp.joining_date.toISOString().split('T')[0] : '',
        reportingManager: emp.reporting_manager,
        employmentType:   emp.employment_type,
        bankName:         emp.bank_name,
        accountNumber:    emp.account_number,
        ifscCode:         emp.ifsc_code,
        accountHolderName: emp.account_holder_name,
        bankBranch:       emp.bank_branch,
        documents:        emp.documents,
      },
    });
  } catch (err) {
    console.error('❌ [GET /registrations/prefill/:token]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registrations/pending
// =============================================================================
router.get('/pending', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT e.*,
        rl.link_id, rl.employee_email AS link_email,
        COALESCE(
          json_agg(json_build_object(
            'type', d.document_type, 'path', d.file_path,
            'name', d.file_name, 'size', d.file_size, 'mime_type', d.mime_type
          )) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM employees e
      LEFT JOIN registration_links rl ON e.registration_link_id = rl.id
      LEFT JOIN employee_documents d  ON d.employee_id = e.id
      WHERE e.status IN ('pending', 'pending_rejoin')
      GROUP BY e.id, rl.link_id, rl.employee_email
      ORDER BY e.created_at DESC
    `);
    // uan_number is included via e.* — no change needed here
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('❌ [GET /registrations/pending]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// POST /api/registrations/:id/approve
// =============================================================================
router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id }   = req.params;
    const isRejoin = req.body?.isRejoin === true || req.body?.isRejoin === 'true';

    const { rows } = await client.query(`
      SELECT e.*,
        COALESCE(
          json_agg(json_build_object(
            'type',      d.document_type,
            'path',      d.file_path,
            'file_path', d.file_path,
            'name',      d.file_name,
            'mime_type', d.mime_type
          )) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM employees e
      LEFT JOIN employee_documents d ON d.employee_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `, [id]);

    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = rows[0];
    const newEmployeeId = await generateEmployeeId(client);

    const uploadToken  = crypto.randomBytes(32).toString('hex');
    const uploadExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const previousEmployeeId = employee.employee_id;
    await client.query(`
      UPDATE employees SET
        status                   = 'active',
        employee_id              = $1,
        approved_at              = CURRENT_TIMESTAMP,
        updated_at               = CURRENT_TIMESTAMP,
        rejoin_snapshot          = NULL,
        active_rejoin_link_id    = NULL,
        active_doc_upload_token  = $2,
        docs_submitted           = false
      WHERE id = $3
    `, [newEmployeeId, uploadToken, id]);

    const { rows: tokenRows } = await client.query(
      `INSERT INTO employee_doc_upload_tokens
         (token, employee_id, employee_emp_id, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [uploadToken, id, newEmployeeId, uploadExpiry]
    );

    await client.query('COMMIT');
    console.log(`✅ [APPROVE] Employee id=${id} approved as ${newEmployeeId}`);

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const uploadUrl    = `${FRONTEND_URL}/upload-documents/${uploadToken}`;

    let pdfBase64 = null;
    try {
      console.log(`📄 [APPROVE] Generating KYE PDF for ${newEmployeeId}...`);
      const pdfBuffer = await generateKYEPdfBuffer(employee, newEmployeeId);
      if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
        pdfBase64 = pdfBuffer.toString('base64');
        console.log(`✅ [APPROVE] PDF ready — ${Math.round(pdfBuffer.length / 1024)} KB`);
      }
    } catch (pdfErr) {
      console.error('❌ [APPROVE] PDF generation failed:', pdfErr.message);
    }

    setImmediate(async () => {
      try {
        console.log(`📧 [APPROVE] Sending approval email to: ${employee.email}`);
        await sendApprovalEmailWithKYEPdf({
          to:         employee.email,
          firstName:  employee.first_name,
          lastName:   employee.last_name,
          employeeId: newEmployeeId,
          isRejoin,
          pdfBase64,
          uploadUrl,
          uploadExpiresAt: uploadExpiry.toISOString(),
        });
        console.log(`✅ [APPROVE] Email sent`);
      } catch (e) {
        console.error('❌ [APPROVE] Email failed:', e.message);
      }

      try {
        await sendHRApprovalNotification({
          firstName:          employee.first_name,
          lastName:           employee.last_name,
          employeeId:         newEmployeeId,
          previousEmployeeId: isRejoin ? previousEmployeeId : undefined,
          email:              employee.email,
          department:         employee.department,
          isRejoin,
        });
      } catch (e) {
        console.error('⚠️ [APPROVE] HR notification failed:', e.message);
      }
    });

    return res.json({
      success:    true,
      employeeId: newEmployeeId,
      uploadUrl,
      pdfQueued:  true,
      message:    `Employee approved as ${newEmployeeId}. Approval email with upload link queued.`,
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [POST /registrations/:id/approve]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// POST /api/registrations/:id/reject
// =============================================================================
router.post('/:id/reject', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id }  = req.params;
    const reason  = req.body?.rejection_reason || req.body?.reason || null;
    const adminId = req.admin?.id || null;

    const resubmitToken  = crypto.randomBytes(32).toString('hex');
    const resubmitExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { rows } = await client.query(`
      UPDATE employees
        SET status            = 'rejected',
            rejection_reason  = $1,
            rejected_by       = $2,
            rejected_at       = CURRENT_TIMESTAMP,
            resubmit_token    = $3,
            resubmit_expires_at = $4
      WHERE id = $5
      RETURNING *
    `, [reason, adminId, resubmitToken, resubmitExpiry, id]);

    if (!rows[0]) return res.status(404).json({ success: false, message: 'Submission not found' });

    const emp = rows[0];
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resubmitUrl  = `${FRONTEND_URL}/registration/resubmit/${resubmitToken}`;

    console.log(`❌ Rejected employee id=${id} | resubmit token generated`);

    setImmediate(async () => {
      if (emp.email) {
        await sendRejectionEmailWithRelink({
          to: emp.email, firstName: emp.first_name, lastName: emp.last_name,
          reason: reason || '', resubmitUrl,
          resubmitExpiry: resubmitExpiry.toISOString(),
        }).catch(e => console.error('Rejection email failed:', e.message));
      }
      await sendHRRejectionNotification({
        firstName: emp.first_name, lastName: emp.last_name,
        email: emp.email, reason: reason || '',
      }).catch(e => console.error('HR rejection notification failed:', e.message));
    });

    return res.json({
      success: true,
      message: 'Registration rejected — resubmission link sent to employee',
      data: rows[0],
    });
  } catch (err) {
    console.error('❌ [POST /registrations/:id/reject]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// POST /api/registrations/:id/reject-rejoin
// =============================================================================
router.post('/:id/reject-rejoin', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id }  = req.params;
    const reason  = req.body?.rejection_reason || req.body?.reason || null;

    const { rows: empRows } = await client.query(
      `SELECT * FROM employees WHERE id=$1`, [id]
    );
    if (!empRows[0]) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = empRows[0];

    if (emp.status !== 'pending_rejoin') {
      return res.status(400).json({
        success: false,
        message: `Employee status is "${emp.status}", expected "pending_rejoin".`
      });
    }

    await client.query('BEGIN');
    await restoreFromSnapshot(client, emp.id, emp.rejoin_snapshot, 'inactive');
    await client.query(
      `UPDATE employees SET rejection_reason=$1, rejected_at=CURRENT_TIMESTAMP WHERE id=$2`,
      [reason, emp.id]
    );
    await client.query(
      `DELETE FROM registration_links WHERE employee_email=$1 AND is_rejoin=true`,
      [emp.email]
    );

    // ── Generate a fresh rejoin re-edit link ──────────────────────────────
    const { v4: uuidv4 } = await import('uuid');
    const crypto = (await import('crypto')).default;
    const linkId    = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { default: poolImported } = await import('../../config/database.js').catch(() => ({ default: client }));

    await client.query(
      `INSERT INTO registration_links
         (link_id, employee_email, status, expires_at, is_used,
          is_rejoin, prefill_employee_id, multi_use, use_count)
       VALUES ($1, $2, 'active', $3, false, true, $4, false, 0)`,
      [linkId, emp.email, expiresAt, emp.id]
    );

    // Save snapshot + link on employee so re-edit link works
    const { buildSnapshot } = { buildSnapshot: (e) => ({
      first_name: e.first_name, last_name: e.last_name, middle_name: e.middle_name,
      father_husband_name: e.father_husband_name, email: e.email, phone: e.phone,
      alt_phone: e.alt_phone, date_of_birth: e.date_of_birth, gender: e.gender,
      marital_status: e.marital_status, educational_qualification: e.educational_qualification,
      blood_group: e.blood_group, pan_number: e.pan_number, name_on_pan: e.name_on_pan,
      aadhar_number: e.aadhar_number, name_on_aadhar: e.name_on_aadhar,
      uan_number: e.uan_number,
      family_member_name: e.family_member_name, family_contact_no: e.family_contact_no,
      family_working_status: e.family_working_status, family_employer_name: e.family_employer_name,
      family_employer_contact: e.family_employer_contact,
      emergency_contact_name: e.emergency_contact_name, emergency_contact_no: e.emergency_contact_no,
      emergency_contact_address: e.emergency_contact_address,
      emergency_contact_relation: e.emergency_contact_relation,
      permanent_address: e.permanent_address, permanent_phone: e.permanent_phone,
      permanent_landmark: e.permanent_landmark, permanent_lat_long: e.permanent_lat_long,
      local_same_as_permanent: e.local_same_as_permanent, local_address: e.local_address,
      local_phone: e.local_phone, local_landmark: e.local_landmark, local_lat_long: e.local_lat_long,
      ref1_name: e.ref1_name, ref1_designation: e.ref1_designation, ref1_organization: e.ref1_organization,
      ref1_address: e.ref1_address, ref1_city_state_pin: e.ref1_city_state_pin,
      ref1_contact_no: e.ref1_contact_no, ref1_email: e.ref1_email,
      ref2_name: e.ref2_name, ref2_designation: e.ref2_designation, ref2_organization: e.ref2_organization,
      ref2_address: e.ref2_address, ref2_city_state_pin: e.ref2_city_state_pin,
      ref2_contact_no: e.ref2_contact_no, ref2_email: e.ref2_email,
      ref3_name: e.ref3_name, ref3_designation: e.ref3_designation, ref3_organization: e.ref3_organization,
      ref3_address: e.ref3_address, ref3_city_state_pin: e.ref3_city_state_pin,
      ref3_contact_no: e.ref3_contact_no, ref3_email: e.ref3_email,
      department: e.department, position: e.position, joining_date: e.joining_date,
      employment_type: e.employment_type, circle: e.circle, project_name: e.project_name,
      reporting_manager: e.reporting_manager, bank_name: e.bank_name, account_number: e.account_number,
      ifsc_code: e.ifsc_code, account_holder_name: e.account_holder_name, bank_branch: e.bank_branch,
      basic_salary: e.basic_salary, hra: e.hra, other_allowances: e.other_allowances,
      address: e.address, city: e.city, state: e.state, zip_code: e.zip_code,
      status: e.status, employee_id: e.employee_id,
    })};

    const snapshot = buildSnapshot(emp);
    await client.query(
      `UPDATE employees SET
         rejoin_snapshot=$1, active_rejoin_link_id=$2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$3`,
      [JSON.stringify(snapshot), linkId, emp.id]
    );

    await client.query('COMMIT');

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const rejoinUrl    = `${FRONTEND_URL}/registration/${linkId}`;

    console.log(`↩️  Rejoin declined for employee ${emp.id} — snapshot restored, new re-edit link: ${linkId}`);

    setImmediate(async () => {
      try {
        const { sendRejoinDeclinedEmail } = await import('../../services/emailService.js');
        if (emp.email) {
          await sendRejoinDeclinedEmail({
            to:         emp.email,
            firstName:  emp.first_name,
            lastName:   emp.last_name,
            employeeId: emp.employee_id,
            reason:     reason || '',
            rejoinUrl,                          // ← NEW
            rejoinUrlExpiry: expiresAt.toISOString(), // ← NEW
          });
        }
      } catch (e) {
        console.error('Rejoin decline email failed:', e.message);
      }
    });

    return res.json({
      success: true,
      message: 'Rejoin request declined — employee data restored. A re-edit link has been sent to the employee.',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [POST /registrations/:id/reject-rejoin]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});


// Replace the entire GET /validate/:linkId handler in
// routes/employeeMng/registrationRoutes.js with this:

router.get('/validate/:linkId', async (req, res) => {
  const client = await pool.connect();
  try {
    // Step 1: fetch the link itself (no JOIN to employees — avoids column miss)
    const { rows: linkRows } = await client.query(
      `SELECT * FROM registration_links WHERE link_id = $1`,
      [req.params.linkId]
    );

    if (!linkRows[0]) {
      return res.status(404).json({ success: false, message: 'Invalid registration link' });
    }

    const link = linkRows[0];

    if (link.is_used) {
      return res.status(410).json({ success: false, used: true, message: 'Link already used.' });
    }
    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ success: false, expired: true, message: 'Link expired.' });
    }

    // Step 2: for rejoin links, fetch the FULL employee row separately
    let prefillData = null;

    if (link.is_rejoin && link.prefill_employee_id) {
      const { rows: empRows } = await client.query(
        `SELECT * FROM employees WHERE id = $1`,
        [link.prefill_employee_id]
      );

      const emp = empRows[0];

      if (emp) {
        // ✅ All fields mapped from the full SELECT * row
        // ✅ uan_number comes from emp.uan_number (snake_case DB column)
        // ✅ mapped to uanNumber (camelCase) for the frontend form
        prefillData = {
          // ── Personal ────────────────────────────────────────
          firstName:                emp.first_name,
          lastName:                 emp.last_name,
          fatherHusbandName:        emp.father_husband_name,
          dob:                      emp.date_of_birth
            ? new Date(emp.date_of_birth).toISOString().split('T')[0]
            : '',
          gender:                   emp.gender,
          maritalStatus:            emp.marital_status,
          educationalQualification: emp.educational_qualification,
          bloodGroup:               emp.blood_group,
          panNumber:                emp.pan_number,
          nameOnPan:                emp.name_on_pan,
          aadhar:                   emp.aadhar_number,
          nameOnAadhar:             emp.name_on_aadhar,
          uanNumber:                emp.uan_number || '',   // ✅ THE FIX

          // ── Contact ─────────────────────────────────────────
          email:                    emp.email,
          phone:                    emp.phone,
          altPhone:                 emp.alt_phone,

          // ── Family ──────────────────────────────────────────
          familyMemberName:         emp.family_member_name,
          familyContactNo:          emp.family_contact_no,
          familyWorkingStatus:      emp.family_working_status,
          familyEmployerName:       emp.family_employer_name,
          familyEmployerContact:    emp.family_employer_contact,

          // ── Emergency contact ────────────────────────────────
          emergencyContactName:     emp.emergency_contact_name,
          emergencyContactNo:       emp.emergency_contact_no,
          emergencyContactAddress:  emp.emergency_contact_address,
          emergencyContactRelation: emp.emergency_contact_relation,

          // ── Permanent address ────────────────────────────────
          permanentAddress:         emp.permanent_address,
          permanentPhone:           emp.permanent_phone,
          permanentLandmark:        emp.permanent_landmark,
          permanentLatLong:         emp.permanent_lat_long,

          // ── Local address ────────────────────────────────────
          localSameAsPermanent:     emp.local_same_as_permanent,
          localAddress:             emp.local_address,
          localPhone:               emp.local_phone,
          localLandmark:            emp.local_landmark,
          localLatLong:             emp.local_lat_long,

          // ── References ──────────────────────────────────────
          ref1Name:         emp.ref1_name,
          ref1Designation:  emp.ref1_designation,
          ref1Organization: emp.ref1_organization,
          ref1Address:      emp.ref1_address,
          ref1CityStatePin: emp.ref1_city_state_pin,
          ref1ContactNo:    emp.ref1_contact_no,
          ref1Email:        emp.ref1_email,

          ref2Name:         emp.ref2_name,
          ref2Designation:  emp.ref2_designation,
          ref2Organization: emp.ref2_organization,
          ref2Address:      emp.ref2_address,
          ref2CityStatePin: emp.ref2_city_state_pin,
          ref2ContactNo:    emp.ref2_contact_no,
          ref2Email:        emp.ref2_email,

          ref3Name:         emp.ref3_name,
          ref3Designation:  emp.ref3_designation,
          ref3Organization: emp.ref3_organization,
          ref3Address:      emp.ref3_address,
          ref3CityStatePin: emp.ref3_city_state_pin,
          ref3ContactNo:    emp.ref3_contact_no,
          ref3Email:        emp.ref3_email,

          // ── Employment ──────────────────────────────────────
          department:       emp.department,
          position:         emp.position,
          joiningDate:      emp.joining_date
            ? new Date(emp.joining_date).toISOString().split('T')[0]
            : '',
          employmentType:   emp.employment_type,
          reportingManager: emp.reporting_manager,
          circle:           emp.circle,
          projectName:      emp.project_name,

          // ── Bank ────────────────────────────────────────────
          bankName:          emp.bank_name,
          accountNumber:     emp.account_number,
          ifscCode:          emp.ifsc_code,
          accountHolderName: emp.account_holder_name,
          bankBranch:        emp.bank_branch,

          // ── Meta ────────────────────────────────────────────
          oldEmployeeId: emp.employee_id,
        };
      }
    }
    const sanitizeUan = (raw) => {
  if (!raw) return null;
  const clean = String(raw).replace(/\D/g, '').slice(0, 12);
  return clean.length > 0 ? clean : null;
};

 return res.json({
      success:     true,
      valid:       true,          // ← ADD THIS
      isRejoin:    link.is_rejoin || false,
      prefillData,
      linkEmail:   link.employee_email,
    });

  } catch (err) {
    console.error('❌ [GET /registrations/validate/:linkId]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;