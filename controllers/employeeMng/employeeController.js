import path from "path";
import { fileURLToPath } from "url";

import pool from "../../config/database.js";
import { cleanupFiles } from "../../middleware/employeeMng/employeeMiddleware.js";
import { uploadFileToS3, deleteFileFromS3, getS3Url } from "../../utills/s3.js";

const __filename = fileURLToPath(import.meta.url);

const EMPLOYEE_DOCS_FOLDER = "uploads/employee_docs";

// ══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

async function generateEmployeeId(client) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `Insta-${yy}${mm}`;

  const { rows } = await client.query(
    `SELECT employee_id
     FROM employees
     WHERE employee_id LIKE $1
     ORDER BY CAST(REGEXP_REPLACE(employee_id, '[^0-9]', '', 'g') AS BIGINT) DESC
     LIMIT 1`,
    [`${prefix}%`],
  );

  let nextSeq = 1;
  if (rows[0]) {
    const lastSeq = parseInt(rows[0].employee_id.slice(prefix.length), 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

async function saveDocument(client, empDbId, type, file) {
  if (!file) return null;
  const { key } = await uploadFileToS3(file, EMPLOYEE_DOCS_FOLDER);
  await client.query(
    `INSERT INTO employee_documents
       (employee_id, document_type, file_path, file_name, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [empDbId, type, key, file.originalname, file.size, file.mimetype],
  );
  return key;
}

function extractErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;

  const parts = [];
  if (err.message) parts.push(err.message);
  if (err.detail) parts.push(`Detail: ${err.detail}`);
  if (err.code) parts.push(`Code: ${err.code}`);
  if (err.constraint) parts.push(`Constraint: ${err.constraint}`);
  if (err.column) parts.push(`Column: ${err.column}`);
  if (err.table) parts.push(`Table: ${err.table}`);

  if (parts.length > 0) return parts.join(" | ");

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().split("T")[0];
};

async function recordStatusHistory(
  client,
  {
    employeeId,
    fromStatus,
    toStatus,
    changedByName,
    reason,
    employeePublicId = null,
    department = null,
  },
) {
  const metadata = {
    employee_id: employeePublicId || null,
    department: department || null,
  };
  await client.query(
    `INSERT INTO employee_status_history
       (employee_id, from_status, to_status, changed_by_name, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      employeeId,
      fromStatus || null,
      toStatus,
      changedByName || "HR Admin",
      reason || null,
      JSON.stringify(metadata),
    ],
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
      `UPDATE employees SET status=$1, updated_at=CURRENT_TIMESTAMP, rejoin_snapshot=NULL, active_rejoin_link_id=NULL WHERE id=$2`,
      [newStatus, empId],
    );
    return;
  }
  const s = snapshot;
  await client.query(
    `UPDATE employees SET
       first_name=$1, last_name=$2, middle_name=$3, father_husband_name=$4,
       email=$5, phone=$6, alt_phone=$7, date_of_birth=$8, gender=$9, marital_status=$10,
       educational_qualification=$11, blood_group=$12, pan_number=$13, name_on_pan=$14,
       aadhar_number=$15, name_on_aadhar=$16, uan_number=$17,
       family_member_name=$18, family_contact_no=$19, family_working_status=$20,
       family_employer_name=$21, family_employer_contact=$22,
       emergency_contact_name=$23, emergency_contact_no=$24,
       emergency_contact_address=$25, emergency_contact_relation=$26,
       permanent_address=$27, permanent_phone=$28, permanent_landmark=$29, permanent_lat_long=$30,
       local_same_as_permanent=$31, local_address=$32, local_phone=$33,
       local_landmark=$34, local_lat_long=$35,
       ref1_name=$36, ref1_designation=$37, ref1_organization=$38,
       ref1_address=$39, ref1_city_state_pin=$40, ref1_contact_no=$41, ref1_email=$42,
       ref2_name=$43, ref2_designation=$44, ref2_organization=$45,
       ref2_address=$46, ref2_city_state_pin=$47, ref2_contact_no=$48, ref2_email=$49,
       ref3_name=$50, ref3_designation=$51, ref3_organization=$52,
       ref3_address=$53, ref3_city_state_pin=$54, ref3_contact_no=$55, ref3_email=$56,
       department=$57, position=$58, joining_date=$59, employment_type=$60,
       circle=$61, project_name=$62, reporting_manager=$63,
       bank_name=$64, account_number=$65, ifsc_code=$66, account_holder_name=$67, bank_branch=$68,
       basic_salary=$69, hra=$70, other_allowances=$71,
       address=$72, city=$73, state=$74, zip_code=$75,
       status=$76, rejoin_snapshot=NULL, active_rejoin_link_id=NULL, updated_at=CURRENT_TIMESTAMP
     WHERE id=$77`,
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
      s.local_same_as_permanent,
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

const EMP_SELECT = `
  SELECT
    e.id, e.employee_id,
    e.first_name, e.last_name, e.middle_name, e.father_husband_name,
    e.email, e.phone, e.alt_phone,
    e.date_of_birth, e.gender,
    e.marital_status, e.educational_qualification, e.blood_group,
    e.pan_number, e.name_on_pan, e.aadhar_number, e.name_on_aadhar, e.uan_number,
    e.family_member_name, e.family_contact_no, e.family_working_status,
    e.family_employer_name, e.family_employer_contact,
    e.emergency_contact_name, e.emergency_contact_no,
    e.emergency_contact_address, e.emergency_contact_relation,
    e.permanent_address, e.permanent_phone, e.permanent_landmark, e.permanent_lat_long,
    e.local_same_as_permanent, e.local_address, e.local_phone, e.local_landmark, e.local_lat_long,
    e.ref1_name, e.ref1_designation, e.ref1_organization,
    e.ref1_address, e.ref1_city_state_pin, e.ref1_contact_no, e.ref1_email,
    e.ref2_name, e.ref2_designation, e.ref2_organization,
    e.ref2_address, e.ref2_city_state_pin, e.ref2_contact_no, e.ref2_email,
    e.ref3_name, e.ref3_designation, e.ref3_organization,
    e.ref3_address, e.ref3_city_state_pin, e.ref3_contact_no, e.ref3_email,
    e.address, e.city, e.state, e.zip_code,
    e.bank_name, e.account_number, e.ifsc_code, e.account_holder_name, e.bank_branch,
    e.position AS designation, e.department, e.joining_date, e.employment_type,
    e.circle, e.project_name, e.reporting_manager, e.status,
    COALESCE(e.basic_salary, 0) AS basic_salary,
    COALESCE(e.hra, 0) AS hra,
    COALESCE(e.other_allowances, 0) AS other_allowances,
    COALESCE(e.basic_salary, 0) + COALESCE(e.hra, 0) + COALESCE(e.other_allowances, 0) AS total_salary,
    e.docs_submitted, e.docs_submitted_at, e.created_at, e.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', d.id, 'document_type', d.document_type,
          'file_path', d.file_path, 'file_name', d.file_name, 'mime_type', d.mime_type
        )
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'::json
    ) AS documents
  FROM employees e
  LEFT JOIN employee_documents d ON d.employee_id = e.id
`;

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

export async function getNextId(req, res) {
  const client = await pool.connect();
  try {
    const nextId = await generateEmployeeId(client);
    return res.json({ success: true, nextId });
  } catch (err) {
    console.error("[getNextId]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to generate next employee ID" });
  } finally {
    client.release();
  }
}

export async function getPendingCount(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM employees WHERE LOWER(status) IN ('pending','pending_rejoin')`,
    );
    return res.json({ success: true, count: parseInt(rows[0].count, 10) });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending count" });
  }
}

export async function getPendingRejoinCount(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM employees WHERE LOWER(status) = 'pending_rejoin'`,
    );
    return res.json({ success: true, count: parseInt(rows[0].count, 10) });
  } catch (err) {
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch pending rejoin count",
      });
  }
}

export async function getAll(req, res) {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.status NOT IN ('pending','pending_rejoin') GROUP BY e.id ORDER BY e.created_at DESC`,
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error("[getAll]", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch employees",
        detail: err.message,
      });
  }
}

export async function getPendingRejoin(req, res) {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.status = 'pending_rejoin' GROUP BY e.id ORDER BY e.updated_at DESC`,
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error("[getPendingRejoin]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getActivityLog(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT h.id, h.employee_id AS emp_db_id, h.from_status, h.to_status,
        h.changed_by_name, h.reason, h.metadata, h.created_at,
        e.employee_id, e.first_name AS emp_first_name, e.father_husband_name AS emp_father_name,
        e.last_name AS emp_last_name, e.department AS emp_department, e.email AS emp_email
      FROM employee_status_history h
      JOIN employees e ON e.id = h.employee_id
      ORDER BY h.created_at DESC LIMIT 500
    `);
    return res.json({
      success: true,
      count: rows.length,
      data: rows.map((row) => ({
        ...row,
        metadata: row.metadata
          ? typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : row.metadata
          : null,
      })),
    });
  } catch (err) {
    console.error("[getActivityLog]", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch activity log",
        detail: err.message,
      });
  }
}

export async function cleanupExpiredRejoinInvites(req, res) {
  const client = await pool.connect();
  try {
    const { rows: expiredLinks } = await client.query(`
      SELECT rl.id, rl.link_id, rl.employee_email, rl.prefill_employee_id, rl.expires_at
      FROM registration_links rl
      WHERE rl.is_rejoin = true AND rl.is_used = false AND rl.expires_at < CURRENT_TIMESTAMP
    `);
    if (expiredLinks.length === 0)
      return res.json({
        success: true,
        message: "No expired rejoin invites found.",
        cleaned: 0,
      });

    const { sendRejoinInviteExpiredEmail } =
      await import("../services/emailService.js").catch(() => ({
        sendRejoinInviteExpiredEmail: null,
      }));

    let cleaned = 0;
    for (const link of expiredLinks) {
      await client.query("BEGIN");
      try {
        let emp = null;
        if (link.prefill_employee_id) {
          const { rows } = await client.query(
            `SELECT * FROM employees WHERE id=$1`,
            [link.prefill_employee_id],
          );
          emp = rows[0] || null;
        }
        if (emp) {
          if (emp.status === "pending_rejoin" && emp.rejoin_snapshot) {
            await restoreFromSnapshot(
              client,
              emp.id,
              emp.rejoin_snapshot,
              "inactive",
            );
          } else if (emp.status === "inactive") {
            await client.query(
              `UPDATE employees SET active_rejoin_link_id=NULL WHERE id=$1`,
              [emp.id],
            );
          }
          if (sendRejoinInviteExpiredEmail && emp.email) {
            sendRejoinInviteExpiredEmail({
              to: emp.email,
              firstName: emp.first_name,
              lastName: emp.last_name,
              employeeId: emp.employee_id,
            }).catch((e) => console.error("Expiry email failed:", e.message));
          }
        }
        await client.query(`DELETE FROM registration_links WHERE id=$1`, [
          link.id,
        ]);
        await client.query("COMMIT");
        cleaned++;
      } catch (innerErr) {
        await client.query("ROLLBACK");
        console.error(
          `Failed to clean link ${link.link_id}:`,
          innerErr.message,
        );
      }
    }
    return res.json({
      success: true,
      message: `Cleaned ${cleaned} expired rejoin invite(s).`,
      cleaned,
    });
  } catch (err) {
    console.error("[cleanupExpiredRejoinInvites]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

export async function exportTemplate(req, res) {
  try {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Employee Import");
    worksheet.views = [{ state: "frozen", ySplit: 2 }];
    const sections = [
      { label: "Personal Information", start: 1, end: 13, color: "FF1D4ED8" },
      { label: "Employment Details", start: 14, end: 20, color: "FF7C3AED" },
      { label: "Salary & Bank", start: 21, end: 28, color: "FF047857" },
    ];
    sections.forEach(({ label, start, end, color }) => {
      worksheet.mergeCells(1, start, 1, end);
      const cell = worksheet.getCell(1, start);
      cell.value = label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    worksheet.getRow(1).height = 22;
    const columns = [
      { header: "First Name *", key: "first_name", width: 16, req: true },
      { header: "Last Name *", key: "last_name", width: 16, req: true },
      { header: "Email *", key: "email", width: 28, req: true },
      { header: "Phone *", key: "phone", width: 14, req: true },
      { header: "Alternate Phone", key: "alt_phone", width: 14, req: false },
      { header: "Date of Birth *", key: "dob", width: 14, req: true },
      { header: "Gender *", key: "gender", width: 10, req: true },
      { header: "Aadhar Number *", key: "aadhar_number", width: 16, req: true },
      { header: "UAN Number", key: "uan_number", width: 14, req: false },
      { header: "Address", key: "address", width: 24, req: false },
      { header: "City", key: "city", width: 14, req: false },
      { header: "State", key: "state", width: 14, req: false },
      { header: "Zip Code", key: "zip_code", width: 12, req: false },
      { header: "Department *", key: "department", width: 18, req: true },
      { header: "Designation *", key: "designation", width: 20, req: true },
      { header: "Joining Date *", key: "joining_date", width: 14, req: true },
      {
        header: "Employment Type *",
        key: "employment_type",
        width: 16,
        req: true,
      },
      { header: "Circle", key: "circle", width: 12, req: false },
      { header: "Project Name", key: "project_name", width: 18, req: false },
      {
        header: "Reporting Manager",
        key: "reporting_manager",
        width: 20,
        req: false,
      },
      { header: "Basic Salary", key: "basic_salary", width: 14, req: false },
      { header: "HRA", key: "hra", width: 12, req: false },
      {
        header: "Other Allowances",
        key: "other_allowances",
        width: 18,
        req: false,
      },
      { header: "Bank Name *", key: "bank_name", width: 22, req: true },
      { header: "Bank Branch", key: "bank_branch", width: 18, req: false },
      {
        header: "Account Number *",
        key: "account_number",
        width: 18,
        req: true,
      },
      { header: "IFSC Code *", key: "ifsc_code", width: 14, req: true },
      {
        header: "Account Holder Name",
        key: "account_holder_name",
        width: 22,
        req: false,
      },
    ];
    columns.forEach((col, idx) => {
      const cell = worksheet.getCell(2, idx + 1);
      cell.value = col.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: col.req ? "FF16A34A" : "FF0F766E" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      worksheet.getColumn(idx + 1).width = col.width;
    });
    worksheet.getRow(2).height = 22;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="employee_import_template.xlsx"',
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[exportTemplate]", err.message);
    if (!res.headersSent)
      res
        .status(500)
        .json({ success: false, message: "Failed to generate template" });
  }
}

export async function exportData(req, res) {
  try {
    const { default: ExcelJS } = await import("exceljs");
    const { rows } = await pool.query(`
      SELECT e.employee_id, e.status,
        e.first_name, COALESCE(e.father_husband_name,'') AS father_husband_name,
        e.last_name, e.email, e.phone, COALESCE(e.alt_phone,'') AS alt_phone,
        e.date_of_birth, e.gender,
        COALESCE(e.marital_status,'') AS marital_status,
        COALESCE(e.educational_qualification,'') AS educational_qualification,
        COALESCE(e.blood_group,'') AS blood_group,
        COALESCE(e.pan_number,'') AS pan_number,
        COALESCE(e.aadhar_number,'') AS aadhar_number,
        COALESCE(e.uan_number,'') AS uan_number,
        e.department, e.position AS designation, e.joining_date, e.employment_type,
        COALESCE(e.circle,'') AS circle, COALESCE(e.project_name,'') AS project_name,
        COALESCE(e.reporting_manager,'') AS reporting_manager,
        COALESCE(e.basic_salary,0) AS basic_salary, COALESCE(e.hra,0) AS hra,
        COALESCE(e.other_allowances,0) AS other_allowances,
        e.bank_name, COALESCE(e.bank_branch,'') AS bank_branch,
        e.account_number, e.ifsc_code, COALESCE(e.account_holder_name,'') AS account_holder_name
      FROM employees e ORDER BY e.created_at DESC
    `);
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "No employee data found" });
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Employees", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    const headers = [
      "Employee ID",
      "Status",
      "First Name",
      "Father/Husband",
      "Last Name",
      "Email",
      "Phone",
      "Alt Phone",
      "Date of Birth",
      "Gender",
      "Marital Status",
      "Educational Qualification",
      "Blood Group",
      "PAN Number",
      "Aadhaar Number",
      "UAN Number",
      "Department",
      "Designation",
      "Joining Date",
      "Employment Type",
      "Circle",
      "Project",
      "Reporting Manager",
      "Basic Salary",
      "HRA",
      "Other Allowances",
      "Total Salary",
      "Bank Name",
      "Bank Branch",
      "Account Number",
      "IFSC Code",
      "Account Holder",
    ];
    headers.forEach((h, idx) => {
      ws.getColumn(idx + 1).width = 18;
      const cell = ws.getCell(1, idx + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F2937" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    ws.getRow(1).height = 24;
    rows.forEach((emp, idx) => {
      const rowNum = idx + 2;
      const total =
        (emp.basic_salary || 0) + (emp.hra || 0) + (emp.other_allowances || 0);
      const values = [
        emp.employee_id,
        emp.status,
        emp.first_name,
        emp.father_husband_name,
        emp.last_name,
        emp.email,
        emp.phone,
        emp.alt_phone,
        fmtDate(emp.date_of_birth),
        emp.gender,
        emp.marital_status,
        emp.educational_qualification,
        emp.blood_group,
        emp.pan_number,
        emp.aadhar_number,
        emp.uan_number,
        emp.department,
        emp.designation,
        fmtDate(emp.joining_date),
        emp.employment_type,
        emp.circle,
        emp.project_name,
        emp.reporting_manager,
        emp.basic_salary,
        emp.hra,
        emp.other_allowances,
        total,
        emp.bank_name,
        emp.bank_branch,
        emp.account_number,
        emp.ifsc_code,
        emp.account_holder_name,
      ];
      const bg = idx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
      values.forEach((val, colIdx) => {
        const cell = ws.getCell(rowNum, colIdx + 1);
        cell.value = val;
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bg },
        };
        cell.font = { size: 9 };
        cell.alignment = { vertical: "middle" };
      });
      ws.getRow(rowNum).height = 16;
    });
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="employees_export_${date}.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[exportData]", err.message);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: "Export failed" });
  }
}

export async function getById(req, res) {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.id::text=$1 OR e.employee_id=$1 GROUP BY e.id`,
      [String(req.params.id)],
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[getById]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch employee" });
  }
}

// ── POST /api/employees ───────────────────────────────────────────────────────
export async function createEmployee(req, res) {
  console.log("[createEmployee] started");

  const client = await pool.connect();
  let uploadedKeys = [];

  try {
    await client.query("BEGIN");

    const b = req.body;
    const uanNumber = req.uanNumber;
    const files = req.files || {};

    console.log(
      "[createEmployee] files received:",
      Object.keys(files).map((k) => `${k}(${files[k]?.length})`),
    );
    console.log("[createEmployee] body keys:", Object.keys(b));

    // ── Validation ────────────────────────────────────────────────────────────
    const missing = [];
    if (!b.firstName?.trim()) missing.push("First Name");
    if (!b.lastName?.trim()) missing.push("Last Name");
    if (!b.email?.trim()) missing.push("Email");
    if (!b.phone?.trim()) missing.push("Phone");
    if (!b.dob) missing.push("Date of Birth");
    if (!b.gender) missing.push("Gender");
    if (!b.joiningDate) missing.push("Joining Date");
    if (!b.department) missing.push("Department");
    if (!b.designation?.trim()) missing.push("Designation");
    if (!b.employmentType) missing.push("Employment Type");
    if (!b.bankName?.trim()) missing.push("Bank Name");
    if (!b.accountNumber?.trim()) missing.push("Account Number");
    if (!b.ifscCode?.trim()) missing.push("IFSC Code");

    if (missing.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    if (!files.id_photo?.[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "Employee photo is required. Make sure the photo field is named 'id_photo'.",
      });
    }

    // ── Employee ID ───────────────────────────────────────────────────────────
    const eid = b.employeeId?.toString().trim();
    const employeeId =
      eid && eid !== "Loading..." ? eid : await generateEmployeeId(client);
    console.log("[createEmployee] employeeId:", employeeId);

    // ── Upload files to S3 ────────────────────────────────────────────────────
    console.log("[createEmployee] uploading id_photo to S3...");
    let id_photo_upload;
    try {
      id_photo_upload = await uploadFileToS3(
        files.id_photo[0],
        EMPLOYEE_DOCS_FOLDER,
      );
    } catch (s3Err) {
      throw new Error(
        `S3 upload failed for id_photo: ${extractErrorMessage(s3Err)}`,
      );
    }
    const id_photo_url = id_photo_upload.key;
    uploadedKeys.push(id_photo_url);
    console.log("[createEmployee] id_photo uploaded:", id_photo_url);

    let aadhar_card_url = null;
    if (files.aadhar_card?.[0]) {
      try {
        const r = await uploadFileToS3(
          files.aadhar_card[0],
          EMPLOYEE_DOCS_FOLDER,
        );
        aadhar_card_url = r.key;
        uploadedKeys.push(aadhar_card_url);
        console.log("[createEmployee] aadhar_card uploaded:", aadhar_card_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for aadhar_card: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let pan_card_url = null;
    if (files.pan_card?.[0]) {
      try {
        const r = await uploadFileToS3(files.pan_card[0], EMPLOYEE_DOCS_FOLDER);
        pan_card_url = r.key;
        uploadedKeys.push(pan_card_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for pan_card: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let bank_passbook_url = null;
    if (files.bank_passbook?.[0]) {
      try {
        const r = await uploadFileToS3(
          files.bank_passbook[0],
          EMPLOYEE_DOCS_FOLDER,
        );
        bank_passbook_url = r.key;
        uploadedKeys.push(bank_passbook_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for bank_passbook: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let resume_url = null;
    if (files.resume?.[0]) {
      try {
        const r = await uploadFileToS3(files.resume[0], EMPLOYEE_DOCS_FOLDER);
        resume_url = r.key;
        uploadedKeys.push(resume_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for resume: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let pay_slip_url = null;
    if (files.payslip?.[0]) {
      try {
        const r = await uploadFileToS3(files.payslip[0], EMPLOYEE_DOCS_FOLDER);
        pay_slip_url = r.key;
        uploadedKeys.push(pay_slip_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for payslip: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let other_certificates_url = null;
    if (files.other_certificates?.[0]) {
      try {
        const r = await uploadFileToS3(
          files.other_certificates[0],
          EMPLOYEE_DOCS_FOLDER,
        );
        other_certificates_url = r.key;
        uploadedKeys.push(other_certificates_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for other_certificates: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let medical_certificate_url = null;
    if (files.medical_certificate?.[0]) {
      try {
        const r = await uploadFileToS3(
          files.medical_certificate[0],
          EMPLOYEE_DOCS_FOLDER,
        );
        medical_certificate_url = r.key;
        uploadedKeys.push(medical_certificate_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for medical_certificate: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let academic_records_url = null;
    if (files.academic_records?.[0]) {
      try {
        const r = await uploadFileToS3(
          files.academic_records[0],
          EMPLOYEE_DOCS_FOLDER,
        );
        academic_records_url = r.key;
        uploadedKeys.push(academic_records_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for academic_records: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    let farm_to_cli_certificate_url = null;
    if (files.farm_to_cli?.[0]) {
      try {
        const r = await uploadFileToS3(
          files.farm_to_cli[0],
          EMPLOYEE_DOCS_FOLDER,
        );
        farm_to_cli_certificate_url = r.key;
        uploadedKeys.push(farm_to_cli_certificate_url);
      } catch (s3Err) {
        throw new Error(
          `S3 upload failed for farm_to_cli: ${extractErrorMessage(s3Err)}`,
        );
      }
    }

    console.log("[createEmployee] all S3 uploads done, inserting into DB...");

    // ── INSERT EMPLOYEE ───────────────────────────────────────────────────────
    const { rows } = await client.query(
      `INSERT INTO employees (
        employee_id,
        first_name, middle_name, last_name, father_husband_name,
        email, phone, alt_phone,
        date_of_birth, gender, marital_status, educational_qualification, blood_group,
        pan_number, name_on_pan, aadhar_number, name_on_aadhar,
        uan_number,
        family_member_name, family_contact_no, family_working_status,
        family_employer_name, family_employer_contact,
        emergency_contact_name, emergency_contact_no,
        emergency_contact_address, emergency_contact_relation,
        permanent_address, permanent_phone, permanent_landmark, permanent_lat_long,
        local_same_as_permanent, local_address, local_phone, local_landmark, local_lat_long,
        ref1_name, ref1_designation, ref1_organization, ref1_address,
        ref1_city_state_pin, ref1_contact_no, ref1_email,
        ref2_name, ref2_designation, ref2_organization, ref2_address,
        ref2_city_state_pin, ref2_contact_no, ref2_email,
        ref3_name, ref3_designation, ref3_organization, ref3_address,
        ref3_city_state_pin, ref3_contact_no, ref3_email,
        address, city, state, zip_code,
        bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
        position, department, circle, project_name, joining_date,
        reporting_manager, employment_type,
        status, basic_salary, hra, other_allowances,
        id_photo_url, aadhar_card_url, pan_card_url, resume_url,
        bank_passbook_url, pay_slip_url, other_certificates_url,
        medical_certificate_url, academic_records_url, farm_to_cli_certificate_url
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
        $39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56,
        $57,$58,$59,$60,$61,$62,$63,$64,$65,$66,$67,$68,$69,$70,$71,$72,$73,$74,
        $75,$76,$77,$78,$79,$80,$81,$82,$83,$84,$85,$86,$87
      ) RETURNING *`,
      [
        employeeId, // $1
        b.firstName?.trim(), // $2
        null, // $3  middle_name
        b.lastName?.trim(), // $4
        b.fatherHusbandName?.trim() || null, // $5
        b.email?.trim().toLowerCase(), // $6
        b.phone?.trim(), // $7
        b.altPhone?.trim() || null, // $8
        b.dob, // $9
        b.gender, // $10
        b.maritalStatus || null, // $11
        b.educationalQualification || null, // $12
        b.bloodGroup || null, // $13
        b.panNumber?.trim() || null, // $14
        b.nameOnPan?.trim() || null, // $15
        b.aadhar?.replace(/\s/g, "") || null, // $16
        b.nameOnAadhar?.trim() || null, // $17
        uanNumber || null, // $18
        b.familyMemberName?.trim() || null, // $19
        b.familyContactNo?.trim() || null, // $20
        b.familyWorkingStatus || null, // $21
        b.familyEmployerName?.trim() || null, // $22
        b.familyEmployerContact?.trim() || null, // $23
        b.emergencyContactName?.trim() || null, // $24
        b.emergencyContactNo?.trim() || null, // $25
        b.emergencyContactAddress?.trim() || null, // $26
        b.emergencyContactRelation || null, // $27
        b.permanentAddress?.trim() || null, // $28
        b.permanentPhone?.trim() || null, // $29
        b.permanentLandmark?.trim() || null, // $30
        b.permanentLatLong?.trim() || null, // $31
        b.localSameAsPermanent === "true" || b.localSameAsPermanent === true, // $32
        b.localAddress?.trim() || null, // $33
        b.localPhone?.trim() || null, // $34
        b.localLandmark?.trim() || null, // $35
        b.localLatLong?.trim() || null, // $36
        b.ref1Name?.trim() || null, // $37
        b.ref1Designation?.trim() || null, // $38
        b.ref1Organization?.trim() || null, // $39
        b.ref1Address?.trim() || null, // $40
        b.ref1CityStatePin?.trim() || null, // $41
        b.ref1ContactNo?.trim() || null, // $42
        b.ref1Email?.trim() || null, // $43
        b.ref2Name?.trim() || null, // $44
        b.ref2Designation?.trim() || null, // $45
        b.ref2Organization?.trim() || null, // $46
        b.ref2Address?.trim() || null, // $47
        b.ref2CityStatePin?.trim() || null, // $48
        b.ref2ContactNo?.trim() || null, // $49
        b.ref2Email?.trim() || null, // $50
        b.ref3Name?.trim() || null, // $51
        b.ref3Designation?.trim() || null, // $52
        b.ref3Organization?.trim() || null, // $53
        b.ref3Address?.trim() || null, // $54
        b.ref3CityStatePin?.trim() || null, // $55
        b.ref3ContactNo?.trim() || null, // $56
        b.ref3Email?.trim() || null, // $57
        b.address || "", // $58
        b.city || "", // $59
        b.state || "", // $60
        b.zipCode || "", // $61
        b.bankName?.trim(), // $62
        b.accountNumber?.trim(), // $63
        b.ifscCode?.trim().toUpperCase(), // $64
        b.accountHolderName?.trim() ||
          `${b.firstName?.trim()} ${b.lastName?.trim()}`, // $65
        b.bankBranch?.trim() || b.branch?.trim() || null, // $66
        b.designation?.trim(), // $67  → position
        b.department, // $68
        b.circle || null, // $69
        b.projectName || null, // $70
        b.joiningDate, // $71
        b.reportingManager || null, // $72
        b.employmentType, // $73
        b.status || "Active", // $74
        parseFloat(b.basicSalary) || 0, // $75
        parseFloat(b.hra) || 0, // $76
        parseFloat(b.otherAllowances) || 0, // $77
        id_photo_url, // $78
        aadhar_card_url, // $79
        pan_card_url, // $80
        resume_url, // $81
        bank_passbook_url, // $82
        pay_slip_url, // $83
        other_certificates_url, // $84
        medical_certificate_url, // $85
        academic_records_url, // $86
        farm_to_cli_certificate_url, // $87
      ],
    );

    const dbId = rows[0].id;
    console.log("[createEmployee] employee row inserted, dbId:", dbId);

    // ── Save document records in employee_documents ───────────────────────────
    await Promise.all([
      client.query(
        `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
         VALUES ($1,'photo',$2,$3,$4,$5)`,
        [
          dbId,
          id_photo_url,
          files.id_photo[0].originalname,
          files.id_photo[0].size,
          files.id_photo[0].mimetype,
        ],
      ),
      saveDocument(client, dbId, "aadhar_card", files.aadhar_card?.[0]),
      saveDocument(client, dbId, "pan_card", files.pan_card?.[0]),
      saveDocument(client, dbId, "bank_passbook", files.bank_passbook?.[0]),
      saveDocument(client, dbId, "resume", files.resume?.[0]),
      saveDocument(client, dbId, "payslip", files.payslip?.[0]),
      saveDocument(
        client,
        dbId,
        "other_certificates",
        files.other_certificates?.[0],
      ),
      saveDocument(
        client,
        dbId,
        "medical_certificate",
        files.medical_certificate?.[0],
      ),
      saveDocument(
        client,
        dbId,
        "academic_records",
        files.academic_records?.[0],
      ),
      saveDocument(client, dbId, "farm_to_cli", files.farm_to_cli?.[0]),
    ]);

    await client.query("COMMIT");
    console.log("[createEmployee] committed successfully");

    return res.status(201).json({
      success: true,
      message: "Employee added successfully",
      data: rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});

    const errMsg = extractErrorMessage(err);
    console.error("[createEmployee] FAILED:", errMsg);
    console.error("[createEmployee] err.code:", err.code);
    console.error("[createEmployee] err.constraint:", err.constraint);
    console.error("[createEmployee] err.detail:", err.detail);
    console.error("[createEmployee] err.table:", err.table);
    console.error("[createEmployee] err.column:", err.column);
    console.error(
      "[createEmployee] full err:",
      JSON.stringify(err, Object.getOwnPropertyNames(err)),
    );

    return res.status(500).json({
      success: false,
      message: "Failed to save employee.",
      detail: errMsg,
      pg: {
        code: err.code || null,
        constraint: err.constraint || null,
        column: err.column || null,
        table: err.table || null,
        detail: err.detail || null,
      },
    });
  } finally {
    client.release();
  }
}

// ── PUT /api/employees/:id ────────────────────────────────────────────────────
export async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const b = req.body;
    const uanNumber = req.uanNumber;

    const { rows } = await pool.query(
      `UPDATE employees SET
        first_name=$1, middle_name=$2, last_name=$3, father_husband_name=$4,
        email=$5, phone=$6, alt_phone=$7, date_of_birth=$8,
        gender=$9, marital_status=$10, educational_qualification=$11, blood_group=$12,
        pan_number=$13, name_on_pan=$14, aadhar_number=$15, name_on_aadhar=$16,
        uan_number=$17,
        family_member_name=$18, family_contact_no=$19, family_working_status=$20,
        family_employer_name=$21, family_employer_contact=$22,
        emergency_contact_name=$23, emergency_contact_no=$24,
        emergency_contact_address=$25, emergency_contact_relation=$26,
        permanent_address=$27, permanent_phone=$28, permanent_landmark=$29, permanent_lat_long=$30,
        local_same_as_permanent=$31, local_address=$32, local_phone=$33,
        local_landmark=$34, local_lat_long=$35,
        ref1_name=$36, ref1_designation=$37, ref1_organization=$38,
        ref1_address=$39, ref1_city_state_pin=$40, ref1_contact_no=$41, ref1_email=$42,
        ref2_name=$43, ref2_designation=$44, ref2_organization=$45,
        ref2_address=$46, ref2_city_state_pin=$47, ref2_contact_no=$48, ref2_email=$49,
        ref3_name=$50, ref3_designation=$51, ref3_organization=$52,
        ref3_address=$53, ref3_city_state_pin=$54, ref3_contact_no=$55, ref3_email=$56,
        department=$57, position=$58, employment_type=$59, joining_date=$60,
        circle=$61, project_name=$62, reporting_manager=$63,
        status=$64, basic_salary=$65, hra=$66, other_allowances=$67,
        bank_name=$68, account_number=$69, ifsc_code=$70,
        account_holder_name=$71, bank_branch=$72,
        updated_at=CURRENT_TIMESTAMP
      WHERE id::text=$73 OR employee_id=$73
      RETURNING *`,
      [
        b.firstName?.trim() || null,
        null,
        b.lastName?.trim() || null,
        b.fatherHusbandName?.trim() || null,
        b.email?.trim() || null,
        b.phone?.trim() || null,
        b.altPhone?.trim() || null,
        b.dob || null,
        b.gender || null,
        b.maritalStatus || null,
        b.educationalQualification || null,
        b.bloodGroup || null,
        b.panNumber?.trim() || null,
        b.nameOnPan?.trim() || null,
        b.aadhar?.replace(/\s/g, "") || null,
        b.nameOnAadhar?.trim() || null,
        uanNumber || null,
        b.familyMemberName?.trim() || null,
        b.familyContactNo?.trim() || null,
        b.familyWorkingStatus || null,
        b.familyEmployerName?.trim() || null,
        b.familyEmployerContact?.trim() || null,
        b.emergencyContactName?.trim() || null,
        b.emergencyContactNo?.trim() || null,
        b.emergencyContactAddress?.trim() || null,
        b.emergencyContactRelation || null,
        b.permanentAddress?.trim() || null,
        b.permanentPhone?.trim() || null,
        b.permanentLandmark?.trim() || null,
        b.permanentLatLong?.trim() || null,
        b.localSameAsPermanent === "true" ||
          b.localSameAsPermanent === true ||
          false,
        b.localAddress?.trim() || null,
        b.localPhone?.trim() || null,
        b.localLandmark?.trim() || null,
        b.localLatLong?.trim() || null,
        b.ref1Name?.trim() || null,
        b.ref1Designation?.trim() || null,
        b.ref1Organization?.trim() || null,
        b.ref1Address?.trim() || null,
        b.ref1CityStatePin?.trim() || null,
        b.ref1ContactNo?.trim() || null,
        b.ref1Email?.trim() || null,
        b.ref2Name?.trim() || null,
        b.ref2Designation?.trim() || null,
        b.ref2Organization?.trim() || null,
        b.ref2Address?.trim() || null,
        b.ref2CityStatePin?.trim() || null,
        b.ref2ContactNo?.trim() || null,
        b.ref2Email?.trim() || null,
        b.ref3Name?.trim() || null,
        b.ref3Designation?.trim() || null,
        b.ref3Organization?.trim() || null,
        b.ref3Address?.trim() || null,
        b.ref3CityStatePin?.trim() || null,
        b.ref3ContactNo?.trim() || null,
        b.ref3Email?.trim() || null,
        b.department || null,
        b.designation?.trim() || null,
        b.employmentType || null,
        b.joiningDate || null,
        b.circle || null,
        b.projectName || null,
        b.reportingManager || null,
        b.status || "Active",
        parseFloat(b.basicSalary) || 0,
        parseFloat(b.hra) || 0,
        parseFloat(b.otherAllowances) || 0,
        b.bankName?.trim() || null,
        b.accountNumber?.trim() || null,
        b.ifscCode?.trim().toUpperCase() || null,
        b.accountHolderName?.trim() || null,
        b.bankBranch?.trim() || null,
        String(id),
      ],
    );

    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });

    const full = await pool.query(`${EMP_SELECT} WHERE e.id=$1 GROUP BY e.id`, [
      rows[0].id,
    ]);
    console.log(`✅ Employee updated: ${rows[0].employee_id}`);
    return res.json({
      success: true,
      message: "Employee updated successfully",
      data: full.rows[0],
    });
  } catch (err) {
    const errMsg = extractErrorMessage(err);
    console.error("[updateEmployee]", errMsg);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to update employee",
        detail: errMsg,
      });
  }
}

export async function deleteEmployee(req, res) {
  try {
    const { rows } = await pool.query(
      `UPDATE employees SET status='Inactive', updated_at=CURRENT_TIMESTAMP
       WHERE id::text=$1 OR employee_id=$1
       RETURNING id, employee_id, first_name, last_name, status`,
      [String(req.params.id)],
    );
    if (rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    return res.json({
      success: true,
      message: "Employee deactivated",
      data: rows[0],
    });
  } catch (err) {
    console.error("[deleteEmployee]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to deactivate employee" });
  }
}

export async function updateStatus(req, res) {
  const { id } = req.params;
  const { status, reason, changedByName } = req.body;
  const allowed = [
    "Active",
    "Inactive",
    "Pending",
    "Blacklist",
    "Blacklisted",
    "active",
    "inactive",
    "pending_rejoin",
  ];
  if (!allowed.includes(status))
    return res
      .status(400)
      .json({ success: false, message: "Invalid status value" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT id, status, employee_id, department FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)],
    );
    if (current.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }
    const empRow = current.rows[0];
    const { rows } = await client.query(
      `UPDATE employees SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,
      [status, empRow.id],
    );
    await recordStatusHistory(client, {
      employeeId: empRow.id,
      fromStatus: empRow.status,
      toStatus: status,
      changedByName: changedByName || "HR Admin",
      reason: reason || null,
      employeePublicId: empRow.employee_id,
      department: empRow.department,
    });
    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Status updated",
      data: rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[updateStatus]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update status" });
  } finally {
    client.release();
  }
}

export async function sendStatusNotification(req, res) {
  try {
    const { status, reason, email, firstName, lastName } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Employee email is required" });
    const {
      sendActiveNotificationEmail,
      sendInactiveNotificationEmail,
      sendBlacklistNotificationEmail,
    } = await import("../services/emailService.js");
    let result;
    if (status === "Active")
      result = await sendActiveNotificationEmail({
        to: email,
        firstName,
        lastName,
      });
    else if (status === "Inactive")
      result = await sendInactiveNotificationEmail({
        to: email,
        firstName,
        lastName,
        reason,
      });
    else if (status === "Blacklist" || status === "Blacklisted")
      result = await sendBlacklistNotificationEmail({
        to: email,
        firstName,
        lastName,
        reason,
      });
    else
      return res.json({
        success: true,
        message: "No notification email required for this status",
      });
    return result.success
      ? res.json({
          success: true,
          message: `Notification email sent to ${email}`,
        })
      : res
          .status(500)
          .json({
            success: false,
            message: "Email dispatch failed",
            error: result.error,
          });
  } catch (err) {
    console.error("[sendStatusNotification]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send notification" });
  }
}

export async function getHistory(req, res) {
  const { id } = req.params;
  try {
    const empResult = await pool.query(
      `SELECT id, employee_id, first_name, last_name, email, department, position, joining_date, status, created_at
       FROM employees WHERE id=$1`,
      [id],
    );
    if (empResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    const employee = empResult.rows[0];
    const countResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM employee_status_history WHERE employee_id=$1`,
      [id],
    );
    if (parseInt(countResult.rows[0].cnt, 10) === 0) {
      await pool.query(
        `INSERT INTO employee_status_history (employee_id, from_status, to_status, changed_by_name, reason, metadata, created_at)
         VALUES ($1, NULL, $2, 'System (backfill)', 'Initial status — employee joined', $3, $4)`,
        [
          id,
          employee.status,
          JSON.stringify({
            employee_id: employee.employee_id,
            department: employee.department,
          }),
          employee.created_at || new Date(),
        ],
      );
    }
    const historyResult = await pool.query(
      `SELECT id, from_status, to_status, changed_by_name, reason, metadata, created_at
       FROM employee_status_history WHERE employee_id=$1 ORDER BY created_at ASC`,
      [id],
    );
    return res.json({
      success: true,
      employee,
      history: { all: historyResult.rows },
    });
  } catch (err) {
    console.error("[getHistory]", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

export async function uploadPhoto(req, res) {
  if (!req.file)
    return res
      .status(400)
      .json({ success: false, message: "No photo file provided" });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const empResult = await client.query(
      `SELECT id FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)],
    );
    if (empResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }
    const empDbId = empResult.rows[0].id;
    const existing = await client.query(
      `SELECT id, file_path FROM employee_documents WHERE employee_id=$1 AND document_type='photo'`,
      [empDbId],
    );
    for (const doc of existing.rows) {
      await deleteFileFromS3(doc.file_path);
      await client.query(`DELETE FROM employee_documents WHERE id=$1`, [
        doc.id,
      ]);
    }
    const { key } = await uploadFileToS3(req.file, EMPLOYEE_DOCS_FOLDER);
    const { rows } = await client.query(
      `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
       VALUES ($1, 'photo', $2, $3, $4, $5)
       RETURNING id, document_type, file_path, file_name, mime_type`,
      [empDbId, key, req.file.originalname, req.file.size, req.file.mimetype],
    );
    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Photo uploaded successfully",
      data: rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[uploadPhoto]", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to save photo",
        detail: extractErrorMessage(err),
      });
  } finally {
    client.release();
  }
}

const ALLOWED_DOC_TYPES = [
  "photo",
  "aadharCard",
  "panCard",
  "bankPassbook",
  "idPhoto",
  "resume",
  "medicalCertificate",
  "academicRecords",
  "payslip",
  "otherCertificates",
  "farmToCli",
];

export async function uploadDocument(req, res) {
  const uploadedFile = req.files?.[0];
  if (!uploadedFile)
    return res
      .status(400)
      .json({ success: false, message: "No file provided" });
  const { id } = req.params;
  const documentType = req.body.documentType || uploadedFile.fieldname;
  if (!ALLOWED_DOC_TYPES.includes(documentType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid documentType. Must be one of: ${ALLOWED_DOC_TYPES.join(", ")}`,
    });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const empResult = await client.query(
      `SELECT id FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)],
    );
    if (empResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }
    const empDbId = empResult.rows[0].id;
    const existing = await client.query(
      `SELECT id, file_path FROM employee_documents WHERE employee_id=$1 AND document_type=$2`,
      [empDbId, documentType],
    );
    for (const doc of existing.rows) {
      await deleteFileFromS3(doc.file_path);
      await client.query(`DELETE FROM employee_documents WHERE id=$1`, [
        doc.id,
      ]);
    }
    const { key } = await uploadFileToS3(uploadedFile, EMPLOYEE_DOCS_FOLDER);
    const { rows } = await client.query(
      `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, document_type, file_path, file_name, mime_type`,
      [
        empDbId,
        documentType,
        key,
        uploadedFile.originalname,
        uploadedFile.size,
        uploadedFile.mimetype,
      ],
    );
    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Document uploaded successfully",
      data: rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[uploadDocument]", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to save document",
        detail: extractErrorMessage(err),
      });
  } finally {
    client.release();
  }
}

export async function deleteDocument(req, res) {
  const { id, docId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const empResult = await client.query(
      `SELECT id FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)],
    );
    if (empResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }
    const empDbId = empResult.rows[0].id;
    const docResult = await client.query(
      `SELECT id, file_path FROM employee_documents WHERE id=$1 AND employee_id=$2`,
      [docId, empDbId],
    );
    if (docResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }
    const doc = docResult.rows[0];
    await deleteFileFromS3(doc.file_path);
    await client.query(`DELETE FROM employee_documents WHERE id=$1`, [doc.id]);
    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[deleteDocument]", err.message);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete document",
        detail: extractErrorMessage(err),
      });
  } finally {
    client.release();
  }
}

export async function sendRejoinInvite(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rows } = await client.query(
      `SELECT * FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)],
    );
    if (!rows[0])
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    const emp = rows[0];
    if (emp.status === "active")
      return res
        .status(409)
        .json({ success: false, message: "Employee is currently active." });
    if (emp.status === "blacklisted" || emp.status === "Blacklist")
      return res
        .status(403)
        .json({
          success: false,
          message: "Blacklisted employees cannot be invited to rejoin.",
        });
    if (!emp.email)
      return res
        .status(400)
        .json({
          success: false,
          message: "Employee has no email address on record.",
        });
    const { rows: existingLinks } = await client.query(
      `SELECT id FROM registration_links WHERE employee_email=$1 AND is_used=false AND expires_at>CURRENT_TIMESTAMP AND is_rejoin=true`,
      [emp.email],
    );
    if (existingLinks[0])
      return res
        .status(409)
        .json({
          success: false,
          message: "A rejoin invite was already sent and is still valid.",
        });
    const snapshot = buildSnapshot(emp);
    const { v4: uuidv4 } = await import("uuid");
    const linkId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const registrationUrl = `${baseUrl}/registration/${linkId}`;
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO registration_links (link_id, employee_email, status, expires_at, is_used, is_rejoin, prefill_employee_id, multi_use, use_count)
       VALUES ($1, $2, 'active', $3, false, true, $4, false, 0)`,
      [linkId, emp.email, expiresAt, emp.id],
    );
    await client.query(
      `UPDATE employees SET rejoin_snapshot=$1, active_rejoin_link_id=$2, rejoin_invite_sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$3`,
      [JSON.stringify(snapshot), linkId, emp.id],
    );
    await client.query("COMMIT");
    const { sendRejoinInvitationEmail } =
      await import("../services/emailService.js");
    await sendRejoinInvitationEmail({
      to: emp.email,
      firstName: emp.first_name,
      lastName: emp.last_name,
      employeeId: emp.employee_id,
      registrationUrl,
      expiresAt: expiresAt.toISOString(),
    });
    return res.json({
      success: true,
      message: `Rejoin invitation sent to ${emp.email}`,
      data: { linkId, registrationUrl, expiresAt: expiresAt.toISOString() },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[sendRejoinInvite]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

export async function cancelPendingRejoin(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rows: empRows } = await client.query(
      `SELECT * FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)],
    );
    if (!empRows[0])
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    const emp = empRows[0];
    if (emp.status !== "pending_rejoin") {
      return res.status(400).json({
        success: false,
        message: `Employee status is "${emp.status}", not "pending_rejoin". Nothing to cancel.`,
      });
    }
    await client.query("BEGIN");
    await restoreFromSnapshot(client, emp.id, emp.rejoin_snapshot, "inactive");
    await client.query(
      `DELETE FROM registration_links WHERE employee_email=$1 AND is_rejoin=true AND is_used=false`,
      [emp.email],
    );
    await client.query("COMMIT");
    const emailMod = await import("../services/emailService.js").catch(
      () => null,
    );
    if (emailMod?.sendRejoinCancelledEmail && emp.email) {
      emailMod
        .sendRejoinCancelledEmail({
          to: emp.email,
          firstName: emp.first_name,
          lastName: emp.last_name,
          employeeId: emp.employee_id,
        })
        .catch((e) => console.error("Cancellation email failed:", e.message));
    }
    return res.json({
      success: true,
      message: `Rejoin request for ${emp.first_name} ${emp.last_name} cancelled. Employee restored to Inactive.`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[cancelPendingRejoin]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}
