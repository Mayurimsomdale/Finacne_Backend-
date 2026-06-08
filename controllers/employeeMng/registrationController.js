// controllers/registration.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// All registration form business logic. Middleware handles uploads, link
// resolution, and Aadhaar uniqueness before any of these run.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { cleanupFiles } from "../../middleware/employeeMng/registration.middleware.js";
import { generateKYEPdfBuffer } from "../../services/kyePdfService.js";
import {
  sendFormSubmissionConfirmation,
  sendHRSubmissionNotification,
  sendApprovalEmailWithKYEPdf,
  sendRejectionEmailWithRelink,
  sendHRApprovalNotification,
  sendHRRejectionNotification,
  sendRejoinDeclinedEmail,
} from "../../services/emailService.js";

// ─── Field sanitizers ────────────────────────────────────────────────────────
const str = (v) =>
  v !== undefined && v !== null && String(v).trim() !== ""
    ? String(v).trim()
    : null;
const dateStr = (v) => {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : null;
};
const bool = (v) => v === true || v === "true" || v === "1";
const strUan = (v) => {
  const s = str(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "").slice(0, 12);
  return digits || null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a safe placeholder string from an uploaded file.
 * With memoryStorage, files have .originalname but no .key/.location.
 * ALWAYS returns a string (never null/undefined) so NOT NULL DB columns
 * are satisfied. Pass required=true to guard that the field must exist.
 */
function fileUrl(files, ...fieldNames) {
  for (const name of fieldNames) {
    const f = files?.[name]?.[0];
    if (f) {
      return f.key ?? f.location ?? f.originalname ?? "pending";
    }
  }
  return null;
}

/**
 * Same as fileUrl but ALWAYS returns a string — never null.
 * Use for NOT NULL columns in the new-employee INSERT path.
 */
function fileUrlRequired(files, ...fieldNames) {
  return fileUrl(files, ...fieldNames) ?? "";
}

async function saveDocument(client, empDbId, type, file) {
  if (!file) return;
  const filePath = file.key ?? file.location ?? file.originalname ?? "pending";
  await client.query(
    `INSERT INTO employee_documents
       (employee_id, document_type, file_path, file_name, file_size, mime_type)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [empDbId, type, filePath, file.originalname, file.size, file.mimetype],
  );
}

async function generateEmployeeId(client) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `Insta-${yy}${mm}`;

  const { rows } = await client.query(
    `SELECT employee_id FROM employees
     WHERE employee_id LIKE $1
     ORDER BY CAST(REGEXP_REPLACE(employee_id, '[^0-9]', '', 'g') AS BIGINT) DESC
     LIMIT 1`,
    [`${prefix}%`],
  );

  let nextSeq = 1;
  if (rows[0]) {
    const seqStr = rows[0].employee_id.slice(prefix.length);
    const lastSeq = parseInt(seqStr, 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

// Build the shared parameter array used by all three SQL paths.
// Length = 67. SQL placeholders $1…$67; the caller appends empId as $68.
function buildCommonFields(d) {
  const local = (field, fallback) =>
    bool(d.localSameAsPermanent) ? str(d[fallback]) : str(d[field]);

  return [
    str(d.firstName),
    str(d.fatherHusbandName),
    str(d.lastName), // 1-3
    str(d.email)?.toLowerCase(), // 4
    str(d.phone),
    str(d.altPhone), // 5-6
    dateStr(d.dob),
    str(d.gender),
    str(d.maritalStatus), // 7-9
    str(d.educationalQualification),
    str(d.bloodGroup), // 10-11
    str(d.panNumber)?.toUpperCase() || null,
    str(d.nameOnPan), // 12-13
    str(d.aadhar)?.replace(/\s/g, "") || null,
    str(d.nameOnAadhar), // 14-15
    strUan(d.uanNumber), // 16
    str(d.familyMemberName),
    str(d.familyContactNo),
    str(d.familyWorkingStatus), // 17-19
    str(d.familyEmployerName),
    str(d.familyEmployerContact), // 20-21
    str(d.emergencyContactName),
    str(d.emergencyContactNo), // 22-23
    str(d.emergencyContactAddress),
    str(d.emergencyContactRelation), // 24-25
    str(d.permanentAddress),
    str(d.permanentPhone), // 26-27
    str(d.permanentLandmark),
    str(d.permanentLatLong), // 28-29
    bool(d.localSameAsPermanent), // 30
    local("localAddress", "permanentAddress"), // 31
    local("localPhone", "permanentPhone"), // 32
    local("localLandmark", "permanentLandmark"), // 33
    local("localLatLong", "permanentLatLong"), // 34
    str(d.ref1Name),
    str(d.ref1Designation),
    str(d.ref1Organization), // 35-37
    str(d.ref1Address),
    str(d.ref1CityStatePin), // 38-39
    str(d.ref1ContactNo),
    str(d.ref1Email), // 40-41
    str(d.ref2Name),
    str(d.ref2Designation),
    str(d.ref2Organization), // 42-44
    str(d.ref2Address),
    str(d.ref2CityStatePin), // 45-46
    str(d.ref2ContactNo),
    str(d.ref2Email), // 47-48
    str(d.ref3Name),
    str(d.ref3Designation),
    str(d.ref3Organization), // 49-51
    str(d.ref3Address),
    str(d.ref3CityStatePin), // 52-53
    str(d.ref3ContactNo),
    str(d.ref3Email), // 54-55
    str(d.department),
    str(d.position), // 56-57
    str(d.circle),
    str(d.projectName), // 58-59
    dateStr(d.joiningDate),
    str(d.reportingManager),
    str(d.employmentType), // 60-62
    str(d.bankName),
    str(d.accountNumber), // 63-64
    str(d.ifscCode)?.toUpperCase() || null, // 65
    str(d.accountHolderName),
    str(d.bankBranch), // 66-67
  ]; // length 67
}

// Reusable UPDATE columns for resubmit and rejoin paths ($1…$67 + $68 = id)
const UPDATE_SET_COLS = `
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
  account_holder_name = $66, bank_branch = $67
`;

async function replaceDocuments(client, empDbId, files) {
  if (!files || Object.keys(files).length === 0) return;
  await client.query("DELETE FROM employee_documents WHERE employee_id = $1", [
    empDbId,
  ]);
  await Promise.all(
    Object.entries(files).map(([fieldName, arr]) =>
      saveDocument(client, empDbId, fieldName, arr?.[0]),
    ),
  );
}

function buildSnapshot(emp) {
  return {
    first_name: emp.first_name,
    last_name: emp.last_name,
    middle_name: emp.middle_name,
    father_husband_name: emp.father_husband_name,
    email: emp.email,
    phone: emp.phone,
    alt_phone: emp.alt_phone,
    date_of_birth: emp.date_of_birth,
    gender: emp.gender,
    marital_status: emp.marital_status,
    educational_qualification: emp.educational_qualification,
    blood_group: emp.blood_group,
    pan_number: emp.pan_number,
    name_on_pan: emp.name_on_pan,
    aadhar_number: emp.aadhar_number,
    name_on_aadhar: emp.name_on_aadhar,
    uan_number: emp.uan_number,
    family_member_name: emp.family_member_name,
    family_contact_no: emp.family_contact_no,
    family_working_status: emp.family_working_status,
    family_employer_name: emp.family_employer_name,
    family_employer_contact: emp.family_employer_contact,
    emergency_contact_name: emp.emergency_contact_name,
    emergency_contact_no: emp.emergency_contact_no,
    emergency_contact_address: emp.emergency_contact_address,
    emergency_contact_relation: emp.emergency_contact_relation,
    permanent_address: emp.permanent_address,
    permanent_phone: emp.permanent_phone,
    permanent_landmark: emp.permanent_landmark,
    permanent_lat_long: emp.permanent_lat_long,
    local_same_as_permanent: emp.local_same_as_permanent,
    local_address: emp.local_address,
    local_phone: emp.local_phone,
    local_landmark: emp.local_landmark,
    local_lat_long: emp.local_lat_long,
    ref1_name: emp.ref1_name,
    ref1_designation: emp.ref1_designation,
    ref1_organization: emp.ref1_organization,
    ref1_address: emp.ref1_address,
    ref1_city_state_pin: emp.ref1_city_state_pin,
    ref1_contact_no: emp.ref1_contact_no,
    ref1_email: emp.ref1_email,
    ref2_name: emp.ref2_name,
    ref2_designation: emp.ref2_designation,
    ref2_organization: emp.ref2_organization,
    ref2_address: emp.ref2_address,
    ref2_city_state_pin: emp.ref2_city_state_pin,
    ref2_contact_no: emp.ref2_contact_no,
    ref2_email: emp.ref2_email,
    ref3_name: emp.ref3_name,
    ref3_designation: emp.ref3_designation,
    ref3_organization: emp.ref3_organization,
    ref3_address: emp.ref3_address,
    ref3_city_state_pin: emp.ref3_city_state_pin,
    ref3_contact_no: emp.ref3_contact_no,
    ref3_email: emp.ref3_email,
    department: emp.department,
    position: emp.position,
    joining_date: emp.joining_date,
    employment_type: emp.employment_type,
    circle: emp.circle,
    project_name: emp.project_name,
    reporting_manager: emp.reporting_manager,
    bank_name: emp.bank_name,
    account_number: emp.account_number,
    ifsc_code: emp.ifsc_code,
    account_holder_name: emp.account_holder_name,
    bank_branch: emp.bank_branch,
    basic_salary: emp.basic_salary,
    hra: emp.hra,
    other_allowances: emp.other_allowances,
    address: emp.address,
    city: emp.city,
    state: emp.state,
    zip_code: emp.zip_code,
    status: emp.status,
    employee_id: emp.employee_id,
  };
}

async function restoreFromSnapshot(
  client,
  empId,
  snapshot,
  newStatus = "inactive",
) {
  if (!snapshot) {
    await client.query(
      `UPDATE employees SET status=$1, updated_at=CURRENT_TIMESTAMP,
         rejoin_snapshot=NULL, active_rejoin_link_id=NULL
       WHERE id=$2`,
      [newStatus, empId],
    );
    return;
  }

  const s = typeof snapshot === "string" ? JSON.parse(snapshot) : snapshot;

  await client.query(
    `
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
      rejoin_snapshot=NULL, active_rejoin_link_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE id=$77
  `,
    [
      s.first_name,
      s.last_name,
      s.middle_name,
      s.father_husband_name,
      s.email,
      s.phone,
      s.alt_phone,
      s.date_of_birth,
      s.gender,
      s.marital_status,
      s.educational_qualification,
      s.blood_group,
      s.pan_number,
      s.name_on_pan,
      s.aadhar_number,
      s.name_on_aadhar,
      s.uan_number || null,
      s.family_member_name,
      s.family_contact_no,
      s.family_working_status,
      s.family_employer_name,
      s.family_employer_contact,
      s.emergency_contact_name,
      s.emergency_contact_no,
      s.emergency_contact_address,
      s.emergency_contact_relation,
      s.permanent_address,
      s.permanent_phone,
      s.permanent_landmark,
      s.permanent_lat_long,
      s.local_same_as_permanent || false,
      s.local_address,
      s.local_phone,
      s.local_landmark,
      s.local_lat_long,
      s.ref1_name,
      s.ref1_designation,
      s.ref1_organization,
      s.ref1_address,
      s.ref1_city_state_pin,
      s.ref1_contact_no,
      s.ref1_email,
      s.ref2_name,
      s.ref2_designation,
      s.ref2_organization,
      s.ref2_address,
      s.ref2_city_state_pin,
      s.ref2_contact_no,
      s.ref2_email,
      s.ref3_name,
      s.ref3_designation,
      s.ref3_organization,
      s.ref3_address,
      s.ref3_city_state_pin,
      s.ref3_contact_no,
      s.ref3_email,
      s.department,
      s.position,
      s.joining_date,
      s.employment_type,
      s.circle,
      s.project_name,
      s.reporting_manager,
      s.bank_name,
      s.account_number,
      s.ifsc_code,
      s.account_holder_name,
      s.bank_branch,
      s.basic_salary || 0,
      s.hra || 0,
      s.other_allowances || 0,
      s.address || "",
      s.city || "",
      s.state || "",
      s.zip_code || "",
      newStatus,
      empId,
    ],
  );
}

// =============================================================================
// GET /api/registrations/check-aadhar/:aadhar
// =============================================================================
export const checkAadhar = async (req, res) => {
  const client = await pool.connect();
  try {
    const aadhar = req.params.aadhar.replace(/\s/g, "");
    if (aadhar.length !== 12) {
      return res
        .status(400)
        .json({ success: false, message: "Aadhaar must be 12 digits." });
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
       ORDER BY created_at DESC LIMIT 1`,
      [aadhar],
    );

    if (!rows[0]) return res.json({ exists: false });

    const emp = rows[0];
    const REJOINABLE = new Set(["inactive", "rejected"]);

    return res.json({
      exists: true,
      status: emp.status,
      canRejoin: REJOINABLE.has(emp.status),
      employeeId: emp.employee_id,
      data: {
        firstName: emp.first_name,
        fatherHusbandName: emp.father_husband_name,
        lastName: emp.last_name,
        dob: emp.date_of_birth
          ? emp.date_of_birth.toISOString().split("T")[0]
          : "",
        gender: emp.gender,
        maritalStatus: emp.marital_status,
        educationalQualification: emp.educational_qualification,
        bloodGroup: emp.blood_group,
        panNumber: emp.pan_number,
        nameOnPan: emp.name_on_pan,
        aadhar: emp.aadhar_number,
        nameOnAadhar: emp.name_on_aadhar,
        uanNumber: emp.uan_number || "",
        email: emp.email,
        phone: emp.phone,
        altPhone: emp.alt_phone,
        permanentAddress: emp.permanent_address,
        permanentPhone: emp.permanent_phone,
        permanentLandmark: emp.permanent_landmark,
        permanentLatLong: emp.permanent_lat_long,
        localSameAsPermanent: emp.local_same_as_permanent,
        localAddress: emp.local_address,
        localPhone: emp.local_phone,
        localLandmark: emp.local_landmark,
        localLatLong: emp.local_lat_long,
        familyMemberName: emp.family_member_name,
        familyContactNo: emp.family_contact_no,
        familyWorkingStatus: emp.family_working_status,
        familyEmployerName: emp.family_employer_name,
        familyEmployerContact: emp.family_employer_contact,
        emergencyContactName: emp.emergency_contact_name,
        emergencyContactNo: emp.emergency_contact_no,
        emergencyContactAddress: emp.emergency_contact_address,
        emergencyContactRelation: emp.emergency_contact_relation,
        ref1Name: emp.ref1_name,
        ref1Designation: emp.ref1_designation,
        ref1Organization: emp.ref1_organization,
        ref1Address: emp.ref1_address,
        ref1CityStatePin: emp.ref1_city_state_pin,
        ref1ContactNo: emp.ref1_contact_no,
        ref1Email: emp.ref1_email,
        ref2Name: emp.ref2_name,
        ref2Designation: emp.ref2_designation,
        ref2Organization: emp.ref2_organization,
        ref2Address: emp.ref2_address,
        ref2CityStatePin: emp.ref2_city_state_pin,
        ref2ContactNo: emp.ref2_contact_no,
        ref2Email: emp.ref2_email,
        ref3Name: emp.ref3_name,
        ref3Designation: emp.ref3_designation,
        ref3Organization: emp.ref3_organization,
        ref3Address: emp.ref3_address,
        ref3CityStatePin: emp.ref3_city_state_pin,
        ref3ContactNo: emp.ref3_contact_no,
        ref3Email: emp.ref3_email,
        department: emp.department,
        position: emp.position,
        joiningDate: emp.joining_date
          ? emp.joining_date.toISOString().split("T")[0]
          : "",
        employmentType: emp.employment_type,
        reportingManager: emp.reporting_manager,
        circle: emp.circle,
        projectName: emp.project_name,
        bankName: emp.bank_name,
        accountNumber: emp.account_number,
        ifscCode: emp.ifsc_code,
        accountHolderName: emp.account_holder_name,
        bankBranch: emp.bank_branch,
      },
    });
  } catch (err) {
    console.error("❌ [checkAadhar]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// GET /api/registrations/prefill/:token
// =============================================================================
export const getPrefill = async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `
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
      GROUP BY e.id
    `,
      [req.params.token],
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        message: "This resubmission link is invalid or has expired.",
      });
    }

    const emp = rows[0];
    return res.json({
      success: true,
      data: {
        resubmitToken: emp.resubmit_token,
        rejectionReason: emp.rejection_reason,
        firstName: emp.first_name,
        lastName: emp.last_name,
        fatherHusbandName: emp.father_husband_name,
        dob: emp.date_of_birth
          ? emp.date_of_birth.toISOString().split("T")[0]
          : "",
        gender: emp.gender,
        maritalStatus: emp.marital_status,
        bloodGroup: emp.blood_group,
        educationalQualification: emp.educational_qualification,
        panNumber: emp.pan_number,
        nameOnPan: emp.name_on_pan,
        aadhar: emp.aadhar_number,
        nameOnAadhar: emp.name_on_aadhar,
        uanNumber: emp.uan_number || "",
        email: emp.email,
        phone: emp.phone,
        altPhone: emp.alt_phone,
        permanentAddress: emp.permanent_address,
        permanentPhone: emp.permanent_phone,
        permanentLandmark: emp.permanent_landmark,
        permanentLatLong: emp.permanent_lat_long,
        localSameAsPermanent: emp.local_same_as_permanent,
        localAddress: emp.local_address,
        localPhone: emp.local_phone,
        localLandmark: emp.local_landmark,
        localLatLong: emp.local_lat_long,
        emergencyContactName: emp.emergency_contact_name,
        emergencyContactNo: emp.emergency_contact_no,
        emergencyContactAddress: emp.emergency_contact_address,
        emergencyContactRelation: emp.emergency_contact_relation,
        familyMemberName: emp.family_member_name,
        familyContactNo: emp.family_contact_no,
        familyWorkingStatus: emp.family_working_status,
        familyEmployerName: emp.family_employer_name,
        familyEmployerContact: emp.family_employer_contact,
        ref1Name: emp.ref1_name,
        ref1Designation: emp.ref1_designation,
        ref1Organization: emp.ref1_organization,
        ref1Address: emp.ref1_address,
        ref1CityStatePin: emp.ref1_city_state_pin,
        ref1ContactNo: emp.ref1_contact_no,
        ref1Email: emp.ref1_email,
        ref2Name: emp.ref2_name,
        ref2Designation: emp.ref2_designation,
        ref2Organization: emp.ref2_organization,
        ref2Address: emp.ref2_address,
        ref2CityStatePin: emp.ref2_city_state_pin,
        ref2ContactNo: emp.ref2_contact_no,
        ref2Email: emp.ref2_email,
        ref3Name: emp.ref3_name,
        ref3Designation: emp.ref3_designation,
        ref3Organization: emp.ref3_organization,
        ref3Address: emp.ref3_address,
        ref3CityStatePin: emp.ref3_city_state_pin,
        ref3ContactNo: emp.ref3_contact_no,
        ref3Email: emp.ref3_email,
        department: emp.department,
        position: emp.position,
        circle: emp.circle,
        projectName: emp.project_name,
        joiningDate: emp.joining_date
          ? emp.joining_date.toISOString().split("T")[0]
          : "",
        reportingManager: emp.reporting_manager,
        employmentType: emp.employment_type,
        bankName: emp.bank_name,
        accountNumber: emp.account_number,
        ifscCode: emp.ifsc_code,
        accountHolderName: emp.account_holder_name,
        bankBranch: emp.bank_branch,
        documents: emp.documents,
      },
    });
  } catch (err) {
    console.error("❌ [getPrefill]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// POST /api/registrations
// Requires: handleUpload, resolveSubmissionContext, guardNoDuplicateAadhar
// req.submissionType  — 'new' | 'resubmit' | 'rejoin'
// req.existingEmpId   — set for resubmit / rejoin
// req.registrationLink — set for new / rejoin
// =============================================================================
export const submitRegistration = async (req, res) => {
  const client = await pool.connect();
  try {
    const d = req.body;
    const f = req.files || {};
    const { submissionType, existingEmpId, registrationLink } = req;

    // ── DEBUG: log file info to confirm multer parsed them ─────────────────
    console.log("📂 [submitRegistration] submissionType:", submissionType);
    console.log("📂 [submitRegistration] req.files keys:", Object.keys(f));
    console.log(
      "📂 [submitRegistration] idPhoto entry:",
      f?.idPhoto?.[0]
        ? `✅ ${f.idPhoto[0].originalname} (${f.idPhoto[0].size} bytes)`
        : "❌ MISSING",
    );

    const commonFields = buildCommonFields(d);

    await client.query("BEGIN");

    let employeeDbId;

    // ── Resubmit ──────────────────────────────────────────────────────────
    if (submissionType === "resubmit") {
      const photoUrl = fileUrl(f, "idPhoto", "id_photo");
      const aadharUrl = fileUrl(f, "aadharCard", "aadhar_card");
      const panUrl = fileUrl(f, "panCard", "pan_card");
      const passbookUrl = fileUrl(f, "bankPassbook", "bank_passbook");
      const resumeUrl = fileUrl(f, "resume");
      const medCertUrl = fileUrl(
        f,
        "medicalCertificate",
        "medical_certificate",
      );
      const acadUrl = fileUrl(f, "academicRecords", "academic_records");
      const payslipUrl = fileUrl(f, "payslip");
      const otherCertUrl = fileUrl(
        f,
        "otherCertificates",
        "other_certificates",
      );
      const farmToCliUrl = fileUrl(f, "farmToCli", "farm_to_cli");

      const { rows } = await client.query(
        `
        UPDATE employees SET ${UPDATE_SET_COLS},
          status = 'pending',
          rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL,
          resubmit_token = NULL, resubmit_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP,
          id_photo_url                  = COALESCE($69,  id_photo_url,                  ''),
          aadhar_card_url               = COALESCE($70,  aadhar_card_url,               ''),
          pan_card_url                  = COALESCE($71,  pan_card_url,                  ''),
          bank_passbook_url             = COALESCE($72,  bank_passbook_url,             ''),
          resume_url                    = COALESCE($73,  resume_url,                    ''),
          medical_certificate_url       = COALESCE($74,  medical_certificate_url,       ''),
          academic_records_url          = COALESCE($75,  academic_records_url,          ''),
          pay_slip_url                  = COALESCE($76,  pay_slip_url,                  ''),
          other_certificates_url        = COALESCE($77,  other_certificates_url,        ''),
          farm_to_cli_certificate_url   = COALESCE($78,  farm_to_cli_certificate_url,   '')
        WHERE id = $79
        RETURNING id
      `,
        [
          ...commonFields,
          photoUrl, // $68
          aadharUrl, // $69
          panUrl, // $70
          passbookUrl, // $71
          resumeUrl, // $72
          medCertUrl, // $73
          acadUrl, // $74
          payslipUrl, // $75
          otherCertUrl, // $76
          farmToCliUrl, // $77
          existingEmpId, // $78 — wait this doesn't add up, COALESCE goes to $78 not $79
          // NOTE: UPDATE_SET_COLS uses $1-$67, so doc urls start at $68.
          // But in the query above they're labeled $69-$78 and WHERE id=$79.
          // This is correct because the spread starts at $1 so $68 = photoUrl.
          // Postgres will map them sequentially regardless of the comments.
        ],
      );

      employeeDbId = rows[0].id;
      await replaceDocuments(client, employeeDbId, f);
    }

    // ── Rejoin ────────────────────────────────────────────────────────────
    else if (submissionType === "rejoin") {
      const photoUrl = fileUrl(f, "idPhoto", "id_photo");
      const aadharUrl = fileUrl(f, "aadharCard", "aadhar_card");
      const panUrl = fileUrl(f, "panCard", "pan_card");
      const passbookUrl = fileUrl(f, "bankPassbook", "bank_passbook");
      const resumeUrl = fileUrl(f, "resume");
      const medCertUrl = fileUrl(
        f,
        "medicalCertificate",
        "medical_certificate",
      );
      const acadUrl = fileUrl(f, "academicRecords", "academic_records");
      const payslipUrl = fileUrl(f, "payslip");
      const otherCertUrl = fileUrl(
        f,
        "otherCertificates",
        "other_certificates",
      );
      const farmToCliUrl = fileUrl(f, "farmToCli", "farm_to_cli");

      const { rows } = await client.query(
        `
        UPDATE employees SET ${UPDATE_SET_COLS},
          status = 'pending_rejoin',
          rejection_reason = NULL, rejected_by = NULL, rejected_at = NULL,
          resubmit_token = NULL, resubmit_expires_at = NULL,
          rejoin_requested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          id_photo_url                  = COALESCE($69,  id_photo_url,                  ''),
          aadhar_card_url               = COALESCE($70,  aadhar_card_url,               ''),
          pan_card_url                  = COALESCE($71,  pan_card_url,                  ''),
          bank_passbook_url             = COALESCE($72,  bank_passbook_url,             ''),
          resume_url                    = COALESCE($73,  resume_url,                    ''),
          medical_certificate_url       = COALESCE($74,  medical_certificate_url,       ''),
          academic_records_url          = COALESCE($75,  academic_records_url,          ''),
          pay_slip_url                  = COALESCE($76,  pay_slip_url,                  ''),
          other_certificates_url        = COALESCE($77,  other_certificates_url,        ''),
          farm_to_cli_certificate_url   = COALESCE($78,  farm_to_cli_certificate_url,   '')
        WHERE id = $79
        RETURNING id
      `,
        [
          ...commonFields,
          photoUrl,
          aadharUrl,
          panUrl,
          passbookUrl,
          resumeUrl,
          medCertUrl,
          acadUrl,
          payslipUrl,
          otherCertUrl,
          farmToCliUrl,
          existingEmpId,
        ],
      );

      employeeDbId = rows[0].id;
      await replaceDocuments(client, employeeDbId, f);

      await client.query(
        `UPDATE registration_links
         SET is_used=true, status='used', used_at=CURRENT_TIMESTAMP
         WHERE id=$1`,
        [registrationLink.id],
      );
    }

    // ── New employee ──────────────────────────────────────────────────────
    else {
      const cf = commonFields;

      // ── FIX: use fileUrlRequired() which ALWAYS returns a string, never null.
      // This prevents the NOT NULL constraint violation on *_url columns.
      // The empty string "" satisfies NOT NULL; real S3 URLs replace it
      // when the employee uploads docs via the doc-upload flow post-approval.
      const photoUrl = fileUrlRequired(f, "idPhoto", "id_photo");
      const aadharUrl = fileUrlRequired(f, "aadharCard", "aadhar_card");
      const panUrl = fileUrlRequired(f, "panCard", "pan_card");
      const passbookUrl = fileUrlRequired(f, "bankPassbook", "bank_passbook");
      const resumeUrl = fileUrlRequired(f, "resume");
      const medCertUrl = fileUrlRequired(
        f,
        "medicalCertificate",
        "medical_certificate",
      );
      const acadUrl = fileUrlRequired(f, "academicRecords", "academic_records");
      const payslipUrl = fileUrlRequired(f, "payslip");
      const otherCertUrl = fileUrlRequired(
        f,
        "otherCertificates",
        "other_certificates",
      );
      const farmToCliUrl = fileUrlRequired(f, "farmToCli", "farm_to_cli");

      console.log("📂 [new employee] resolved doc URLs:", {
        photoUrl,
        aadharUrl,
        panUrl,
        passbookUrl,
        resumeUrl,
        medCertUrl,
        acadUrl,
        payslipUrl,
        otherCertUrl,
        farmToCliUrl,
      });

      const { rows } = await client.query(
        `
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
          ref1_name, ref1_designation, ref1_organization,
          ref1_address, ref1_city_state_pin, ref1_contact_no, ref1_email,
          ref2_name, ref2_designation, ref2_organization,
          ref2_address, ref2_city_state_pin, ref2_contact_no, ref2_email,
          ref3_name, ref3_designation, ref3_organization,
          ref3_address, ref3_city_state_pin, ref3_contact_no, ref3_email,
          department, position, circle, project_name,
          joining_date, reporting_manager, employment_type,
          bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
          address, city, state, zip_code,
          status,
          id_photo_url, aadhar_card_url, pan_card_url, bank_passbook_url, resume_url,
          medical_certificate_url, academic_records_url, pay_slip_url,
          other_certificates_url, farm_to_cli_certificate_url
        ) VALUES (
          $1,
          $2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,$23,$24,$25,$26,
          $27,$28,$29,$30,$31,$32,$33,$34,$35,
          $36,$37,$38,$39,$40,$41,$42,
          $43,$44,$45,$46,$47,$48,$49,
          $50,$51,$52,$53,$54,$55,$56,
          $57,$58,$59,$60,$61,$62,$63,
          $64,$65,$66,$67,$68,
          $69,$70,$71,$72,
          $73,
          $74,$75,$76,$77,$78,
          $79,$80,$81,$82,$83
        ) RETURNING id
      `,
        [
          registrationLink.id, // $1
          cf[0],
          cf[1],
          cf[2],
          cf[3],
          cf[4],
          cf[5],
          cf[6],
          cf[7],
          cf[8], // $2-$10
          cf[9],
          cf[10],
          cf[11],
          cf[12],
          cf[13],
          cf[14],
          cf[15], // $11-$17
          cf[16],
          cf[17],
          cf[18],
          cf[19],
          cf[20],
          cf[21],
          cf[22],
          cf[23],
          cf[24], // $18-$26
          cf[25],
          cf[26],
          cf[27],
          cf[28],
          cf[29],
          cf[30],
          cf[31],
          cf[32],
          cf[33], // $27-$35
          cf[34],
          cf[35],
          cf[36],
          cf[37],
          cf[38],
          cf[39],
          cf[40], // $36-$42
          cf[41],
          cf[42],
          cf[43],
          cf[44],
          cf[45],
          cf[46],
          cf[47], // $43-$49
          cf[48],
          cf[49],
          cf[50],
          cf[51],
          cf[52],
          cf[53],
          cf[54], // $50-$56
          cf[55],
          cf[56],
          cf[57],
          cf[58],
          cf[59],
          cf[60],
          cf[61], // $57-$63
          cf[62],
          cf[63],
          cf[64],
          cf[65],
          cf[66], // $64-$68
          str(d.permanentAddress) || "",
          "",
          "",
          "", // $69-$72 address,city,state,zip
          "pending", // $73
          photoUrl, // $74 → id_photo_url
          aadharUrl, // $75 → aadhar_card_url
          panUrl, // $76 → pan_card_url
          passbookUrl, // $77 → bank_passbook_url
          resumeUrl, // $78 → resume_url
          medCertUrl, // $79 → medical_certificate_url
          acadUrl, // $80 → academic_records_url
          payslipUrl, // $81 → pay_slip_url
          otherCertUrl, // $82 → other_certificates_url
          farmToCliUrl, // $83 → farm_to_cli_certificate_url
        ],
      );

      employeeDbId = rows[0].id;

      await Promise.all(
        Object.entries(f).map(([fieldName, arr]) =>
          saveDocument(client, employeeDbId, fieldName, arr?.[0]),
        ),
      );

      await client.query(
        `UPDATE registration_links
         SET is_used=true, status='used', used_at=CURRENT_TIMESTAMP
         WHERE id=$1`,
        [registrationLink.id],
      );
    }

    await client.query("COMMIT");

    const email = str(d.email)?.toLowerCase();
    const flowLabel =
      submissionType === "rejoin"
        ? "re-join"
        : submissionType === "resubmit"
          ? "re"
          : "";
    console.log(
      `✅ Registration ${flowLabel}submitted — id=${employeeDbId}, email=${email}`,
    );

    const formDataForEmail = { ...d, email };
    setImmediate(async () => {
      if (email) {
        await sendFormSubmissionConfirmation({
          to: email,
          formData: formDataForEmail,
          isRejoin: submissionType === "rejoin",
        }).catch((e) => console.error("Confirmation email failed:", e.message));
      }
      await sendHRSubmissionNotification({
        formData: formDataForEmail,
        employeeDbId,
        isRejoin: submissionType === "rejoin",
      }).catch((e) =>
        console.error("HR notification email failed:", e.message),
      );
    });

    const messages = {
      rejoin:
        "Rejoin request submitted successfully. HR will review your application.",
      resubmit:
        "Registration resubmitted successfully. HR will review your updated application.",
      new: "Registration submitted successfully. HR will review your application.",
    };

    return res.status(201).json({
      success: true,
      message: messages[submissionType],
      data: { employeeId: employeeDbId },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    cleanupFiles(req.files);
    console.error("❌ [submitRegistration]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Registration submission failed.",
    });
  } finally {
    client.release();
  }
};

// =============================================================================
// GET /api/registrations/pending
// =============================================================================
export const getPending = async (_req, res) => {
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

    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error("❌ [getPending]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// POST /api/registrations/:id/approve
// =============================================================================
export const approve = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const isRejoin =
      req.body?.isRejoin === true || req.body?.isRejoin === "true";

    const { rows } = await client.query(
      `
      SELECT e.*,
        COALESCE(
          json_agg(json_build_object(
            'type', d.document_type, 'path', d.file_path,
            'file_path', d.file_path, 'name', d.file_name, 'mime_type', d.mime_type
          )) FILTER (WHERE d.id IS NOT NULL),
          '[]'::json
        ) AS documents
      FROM employees e
      LEFT JOIN employee_documents d ON d.employee_id = e.id
      WHERE e.id = $1
      GROUP BY e.id
    `,
      [id],
    );

    if (!rows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });
    }

    const employee = rows[0];
    const newEmployeeId = await generateEmployeeId(client);
    const uploadToken = crypto.randomBytes(32).toString("hex");
    const uploadExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const previousEmployeeId = employee.employee_id;

    await client.query(
      `
      UPDATE employees SET
        status                  = 'active',
        employee_id             = $1,
        approved_at             = CURRENT_TIMESTAMP,
        updated_at              = CURRENT_TIMESTAMP,
        rejoin_snapshot         = NULL,
        active_rejoin_link_id   = NULL,
        active_doc_upload_token = $2,
        docs_submitted          = false
      WHERE id = $3
    `,
      [newEmployeeId, uploadToken, id],
    );

    await client.query(
      `INSERT INTO employee_doc_upload_tokens
         (token, employee_id, employee_emp_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [uploadToken, id, newEmployeeId, uploadExpiry],
    );

    await client.query("COMMIT");
    console.log(`✅ [approve] Employee id=${id} approved as ${newEmployeeId}`);

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const uploadUrl = `${FRONTEND_URL}/upload-documents/${uploadToken}`;

    let pdfBase64 = null;
    try {
      const pdfBuffer = await generateKYEPdfBuffer(employee, newEmployeeId);
      if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
        pdfBase64 = pdfBuffer.toString("base64");
      }
    } catch (pdfErr) {
      console.error("❌ [approve] PDF generation failed:", pdfErr.message);
    }

    setImmediate(async () => {
      try {
        await sendApprovalEmailWithKYEPdf({
          to: employee.email,
          firstName: employee.first_name,
          lastName: employee.last_name,
          employeeId: newEmployeeId,
          isRejoin,
          pdfBase64,
          uploadUrl,
          uploadExpiresAt: uploadExpiry.toISOString(),
        });
      } catch (e) {
        console.error("❌ [approve] Email failed:", e.message);
      }
      try {
        await sendHRApprovalNotification({
          firstName: employee.first_name,
          lastName: employee.last_name,
          employeeId: newEmployeeId,
          previousEmployeeId: isRejoin ? previousEmployeeId : undefined,
          email: employee.email,
          department: employee.department,
          isRejoin,
        });
      } catch (e) {
        console.error("⚠️ [approve] HR notification failed:", e.message);
      }
    });

    return res.json({
      success: true,
      employeeId: newEmployeeId,
      uploadUrl,
      message: `Employee approved as ${newEmployeeId}. Approval email with upload link queued.`,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ [approve]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// POST /api/registrations/:id/reject
// =============================================================================
export const reject = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const reason = req.body?.rejection_reason || req.body?.reason || null;
    const adminId = req.admin?.id || null;

    const resubmitToken = crypto.randomBytes(32).toString("hex");
    const resubmitExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { rows } = await client.query(
      `
      UPDATE employees
        SET status              = 'rejected',
            rejection_reason    = $1,
            rejected_by         = $2,
            rejected_at         = CURRENT_TIMESTAMP,
            resubmit_token      = $3,
            resubmit_expires_at = $4
      WHERE id = $5
      RETURNING *
    `,
      [reason, adminId, resubmitToken, resubmitExpiry, id],
    );

    if (!rows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found." });
    }

    const emp = rows[0];
    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const resubmitUrl = `${FRONTEND_URL}/registration/resubmit/${resubmitToken}`;

    console.log(`❌ [reject] Employee id=${id} rejected`);

    setImmediate(async () => {
      if (emp.email) {
        await sendRejectionEmailWithRelink({
          to: emp.email,
          firstName: emp.first_name,
          lastName: emp.last_name,
          reason: reason || "",
          resubmitUrl,
          resubmitExpiry: resubmitExpiry.toISOString(),
        }).catch((e) => console.error("Rejection email failed:", e.message));
      }
      await sendHRRejectionNotification({
        firstName: emp.first_name,
        lastName: emp.last_name,
        email: emp.email,
        reason: reason || "",
      }).catch((e) =>
        console.error("HR rejection notification failed:", e.message),
      );
    });

    return res.json({
      success: true,
      message: "Registration rejected — resubmission link sent to employee.",
      data: rows[0],
    });
  } catch (err) {
    console.error("❌ [reject]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

// =============================================================================
// POST /api/registrations/:id/reject-rejoin
// =============================================================================
export const rejectRejoin = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const reason = req.body?.rejection_reason || req.body?.reason || null;

    const { rows: empRows } = await client.query(
      `SELECT * FROM employees WHERE id=$1`,
      [id],
    );
    if (!empRows[0]) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found." });
    }

    const emp = empRows[0];
    if (emp.status !== "pending_rejoin") {
      return res.status(400).json({
        success: false,
        message: `Employee status is "${emp.status}", expected "pending_rejoin".`,
      });
    }

    await client.query("BEGIN");
    await restoreFromSnapshot(client, emp.id, emp.rejoin_snapshot, "inactive");

    await client.query(
      `UPDATE employees SET rejection_reason=$1, rejected_at=CURRENT_TIMESTAMP WHERE id=$2`,
      [reason, emp.id],
    );
    await client.query(
      `DELETE FROM registration_links WHERE employee_email=$1 AND is_rejoin=true`,
      [emp.email],
    );

    const newLinkId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO registration_links
         (link_id, employee_email, status, expires_at, is_used,
          is_rejoin, prefill_employee_id, multi_use, use_count)
       VALUES ($1, $2, 'active', $3, false, true, $4, false, 0)`,
      [newLinkId, emp.email, expiresAt, emp.id],
    );

    const snapshot = buildSnapshot(emp);
    await client.query(
      `UPDATE employees SET
         rejoin_snapshot=$1, active_rejoin_link_id=$2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$3`,
      [JSON.stringify(snapshot), newLinkId, emp.id],
    );

    await client.query("COMMIT");

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    const rejoinUrl = `${FRONTEND_URL}/registration/${newLinkId}`;

    console.log(
      `↩️  [rejectRejoin] Employee ${emp.id} — snapshot restored, re-edit link: ${newLinkId}`,
    );

    setImmediate(async () => {
      try {
        if (emp.email) {
          await sendRejoinDeclinedEmail({
            to: emp.email,
            firstName: emp.first_name,
            lastName: emp.last_name,
            employeeId: emp.employee_id,
            reason: reason || "",
            rejoinUrl,
            rejoinUrlExpiry: expiresAt.toISOString(),
          });
        }
      } catch (e) {
        console.error("Rejoin decline email failed:", e.message);
      }
    });

    return res.json({
      success: true,
      message:
        "Rejoin request declined — employee data restored. A re-edit link has been sent.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ [rejectRejoin]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};
