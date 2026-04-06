// routes/employeeMng/employeeRoutes.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import pool from '../../config/database.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Multer setup ──────────────────────────────────────────────────────────────
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
  }
});

// ── Multer: bulk create (fields) ──────────────────────────────────────────────
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/jpg','image/png','image/gif','image/webp','application/pdf'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'), false);
  }
}).fields([
  { name: 'photo',        maxCount: 1 },
  { name: 'aadharCard',   maxCount: 1 },
  { name: 'panCard',      maxCount: 1 },
  { name: 'bankPassbook', maxCount: 1 }
]);

// ── Multer: photo only (single) ───────────────────────────────────────────────
const uploadPhotoOnly = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    ok.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only image files are allowed'), false);
  }
}).single('photo');

// ── Multer: any document (any field name) ─────────────────────────────────────
const uploadDocAny = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
    ];
    ok.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only images and PDFs are allowed'), false);
  },
}).any();

function applyMulter(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => err ? reject(err) : resolve());
  });
}

function cleanupFiles(files = {}) {
  Object.values(files).flat().forEach(f => {
    try { fs.unlinkSync(f.path); } catch (_) {}
  });
}

// No-cache middleware
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// generateEmployeeId — Format: Insta-YYMMNNN+
//
// Examples:
//   First employee in April 2026  → Insta-26041001
//   Second employee in April 2026 → Insta-26041002
//   Employee in May 2026          → Insta-26051003  (sequence keeps going up)
//
// The YYMM prefix reflects the CURRENT month of generation.
// The numeric suffix (starting at 1001) is a GLOBAL ever-increasing sequence
// that never resets — it just keeps incrementing from the last issued number.
// ══════════════════════════════════════════════════════════════════════════════
async function generateEmployeeId(client) {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(-2);          // "26"
  const mm  = String(now.getMonth() + 1).padStart(2, '0'); // "04"
  const prefix = `Insta-${yy}${mm}`;                       // "Insta-2604"

  // Find the last issued Insta- ID (any month) to get the running sequence
  const { rows } = await client.query(`
    SELECT employee_id
    FROM employees
    WHERE employee_id ~ '^Insta-[0-9]{8,}$'
    ORDER BY
      CAST(REGEXP_REPLACE(employee_id, '[^0-9]', '', 'g') AS BIGINT) DESC
    LIMIT 1
  `);

  let nextSeq = 1001; // default starting sequence number
  if (rows[0]) {
    // e.g. "Insta-25092077" → strip "Insta-YYMM" (9 chars: "Insta-" + 4 digits) → "2077"
    const lastId      = rows[0].employee_id;               // "Insta-25092077"
    const withoutTag  = lastId.replace(/^Insta-/, '');     // "25092077"
    const seqStr      = withoutTag.slice(4);               // skip YYMM → "2077"
    const lastSeq     = parseInt(seqStr, 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${nextSeq}`; // "Insta-26042078"
}

// ── GET /api/employees/next-id ────────────────────────────────────────────────
// Used by the AddEmployeeWizard frontend to preview the next Employee ID.
router.get('/next-id', async (req, res) => {
  const client = await pool.connect();
  try {
    const nextId = await generateEmployeeId(client);
    return res.json({ success: true, nextId });
  } catch (err) {
    console.error('[GET /api/employees/next-id]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to generate next employee ID' });
  } finally {
    client.release();
  }
});

async function saveDocument(client, empDbId, type, file) {
  if (!file) return;
  await client.query(
    `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [empDbId, type, `/uploads/employee_docs/${file.filename}`, file.originalname, file.size, file.mimetype]
  );
}

const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString().split('T')[0];
};

async function recordStatusHistory(client, {
  employeeId, fromStatus, toStatus, changedByName,
  reason, employeePublicId = null, department = null,
}) {
  const metadata = { employee_id: employeePublicId || null, department: department || null };
  await client.query(
    `INSERT INTO employee_status_history
      (employee_id, from_status, to_status, changed_by_name, reason, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)`,
    [employeeId, fromStatus || null, toStatus, changedByName || 'HR Admin', reason || null, JSON.stringify(metadata)]
  );
}

// ── Full SELECT ───────────────────────────────────────────────────────────────
const EMP_SELECT = `
  SELECT
    e.id, e.employee_id,
    e.first_name, e.last_name, e.middle_name,
    e.father_husband_name,
    e.email, e.phone, e.alt_phone,
    e.date_of_birth, e.gender,
    e.marital_status, e.educational_qualification, e.blood_group,
    e.pan_number, e.name_on_pan,
    e.aadhar_number, e.name_on_aadhar,
    e.family_member_name, e.family_contact_no, e.family_working_status,
    e.family_employer_name, e.family_employer_contact,
    e.emergency_contact_name, e.emergency_contact_no,
    e.emergency_contact_address, e.emergency_contact_relation,
    e.permanent_address, e.permanent_phone, e.permanent_landmark, e.permanent_lat_long,
    e.local_same_as_permanent, e.local_address, e.local_phone, e.local_landmark, e.local_lat_long,
    e.ref1_name, e.ref1_designation, e.ref1_organization, e.ref1_address, e.ref1_city_state_pin, e.ref1_contact_no, e.ref1_email,
    e.ref2_name, e.ref2_designation, e.ref2_organization, e.ref2_address, e.ref2_city_state_pin, e.ref2_contact_no, e.ref2_email,
    e.ref3_name, e.ref3_designation, e.ref3_organization, e.ref3_address, e.ref3_city_state_pin, e.ref3_contact_no, e.ref3_email,
    e.address, e.city, e.state, e.zip_code,
    e.bank_name, e.account_number, e.ifsc_code,
    e.account_holder_name, e.bank_branch,
    e.position AS designation,
    e.department,
    e.joining_date,
    e.employment_type,
    e.circle, e.project_name, e.reporting_manager,
    e.status,
    COALESCE(e.basic_salary, 0)      AS basic_salary,
    COALESCE(e.hra, 0)               AS hra,
    COALESCE(e.other_allowances, 0)  AS other_allowances,
    COALESCE(e.basic_salary, 0) + COALESCE(e.hra, 0) + COALESCE(e.other_allowances, 0) AS total_salary,
    e.created_at, e.updated_at,
    COALESCE(
      json_agg(
        json_build_object(
          'id', d.id,
          'document_type', d.document_type,
          'file_path', d.file_path,
          'file_name', d.file_name,
          'mime_type', d.mime_type
        )
      ) FILTER (WHERE d.id IS NOT NULL),
      '[]'::json
    ) AS documents
  FROM employees e
  LEFT JOIN employee_documents d ON d.employee_id = e.id
`;

function buildSnapshot(emp) {
  return {
    first_name: emp.first_name, last_name: emp.last_name,
    middle_name: emp.middle_name, father_husband_name: emp.father_husband_name,
    email: emp.email, phone: emp.phone, alt_phone: emp.alt_phone,
    date_of_birth: emp.date_of_birth, gender: emp.gender,
    marital_status: emp.marital_status, educational_qualification: emp.educational_qualification,
    blood_group: emp.blood_group, pan_number: emp.pan_number,
    name_on_pan: emp.name_on_pan, aadhar_number: emp.aadhar_number,
    name_on_aadhar: emp.name_on_aadhar, family_member_name: emp.family_member_name,
    family_contact_no: emp.family_contact_no, family_working_status: emp.family_working_status,
    family_employer_name: emp.family_employer_name, family_employer_contact: emp.family_employer_contact,
    emergency_contact_name: emp.emergency_contact_name, emergency_contact_no: emp.emergency_contact_no,
    emergency_contact_address: emp.emergency_contact_address, emergency_contact_relation: emp.emergency_contact_relation,
    permanent_address: emp.permanent_address, permanent_phone: emp.permanent_phone,
    permanent_landmark: emp.permanent_landmark, permanent_lat_long: emp.permanent_lat_long,
    local_same_as_permanent: emp.local_same_as_permanent, local_address: emp.local_address,
    local_phone: emp.local_phone, local_landmark: emp.local_landmark, local_lat_long: emp.local_lat_long,
    ref1_name: emp.ref1_name, ref1_designation: emp.ref1_designation, ref1_organization: emp.ref1_organization,
    ref1_address: emp.ref1_address, ref1_city_state_pin: emp.ref1_city_state_pin,
    ref1_contact_no: emp.ref1_contact_no, ref1_email: emp.ref1_email,
    ref2_name: emp.ref2_name, ref2_designation: emp.ref2_designation, ref2_organization: emp.ref2_organization,
    ref2_address: emp.ref2_address, ref2_city_state_pin: emp.ref2_city_state_pin,
    ref2_contact_no: emp.ref2_contact_no, ref2_email: emp.ref2_email,
    ref3_name: emp.ref3_name, ref3_designation: emp.ref3_designation, ref3_organization: emp.ref3_organization,
    ref3_address: emp.ref3_address, ref3_city_state_pin: emp.ref3_city_state_pin,
    ref3_contact_no: emp.ref3_contact_no, ref3_email: emp.ref3_email,
    department: emp.department, position: emp.position, joining_date: emp.joining_date,
    employment_type: emp.employment_type, circle: emp.circle, project_name: emp.project_name,
    reporting_manager: emp.reporting_manager, bank_name: emp.bank_name,
    account_number: emp.account_number, ifsc_code: emp.ifsc_code,
    account_holder_name: emp.account_holder_name, bank_branch: emp.bank_branch,
    basic_salary: emp.basic_salary, hra: emp.hra, other_allowances: emp.other_allowances,
    address: emp.address, city: emp.city, state: emp.state, zip_code: emp.zip_code,
    status: emp.status, employee_id: emp.employee_id,
  };
}

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
  const s = snapshot;
  await client.query(`
    UPDATE employees SET
      first_name=$1, last_name=$2, middle_name=$3, father_husband_name=$4,
      email=$5, phone=$6, alt_phone=$7,
      date_of_birth=$8, gender=$9, marital_status=$10,
      educational_qualification=$11, blood_group=$12,
      pan_number=$13, name_on_pan=$14,
      aadhar_number=$15, name_on_aadhar=$16,
      family_member_name=$17, family_contact_no=$18, family_working_status=$19,
      family_employer_name=$20, family_employer_contact=$21,
      emergency_contact_name=$22, emergency_contact_no=$23,
      emergency_contact_address=$24, emergency_contact_relation=$25,
      permanent_address=$26, permanent_phone=$27, permanent_landmark=$28, permanent_lat_long=$29,
      local_same_as_permanent=$30, local_address=$31, local_phone=$32,
      local_landmark=$33, local_lat_long=$34,
      ref1_name=$35, ref1_designation=$36, ref1_organization=$37, ref1_address=$38,
      ref1_city_state_pin=$39, ref1_contact_no=$40, ref1_email=$41,
      ref2_name=$42, ref2_designation=$43, ref2_organization=$44, ref2_address=$45,
      ref2_city_state_pin=$46, ref2_contact_no=$47, ref2_email=$48,
      ref3_name=$49, ref3_designation=$50, ref3_organization=$51, ref3_address=$52,
      ref3_city_state_pin=$53, ref3_contact_no=$54, ref3_email=$55,
      department=$56, position=$57, joining_date=$58, employment_type=$59,
      circle=$60, project_name=$61, reporting_manager=$62,
      bank_name=$63, account_number=$64, ifsc_code=$65,
      account_holder_name=$66, bank_branch=$67,
      basic_salary=$68, hra=$69, other_allowances=$70,
      address=$71, city=$72, state=$73, zip_code=$74,
      status=$75, rejoin_snapshot=NULL, active_rejoin_link_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE id=$76
  `, [
    s.first_name, s.last_name, s.middle_name, s.father_husband_name,
    s.email, s.phone, s.alt_phone, s.date_of_birth, s.gender, s.marital_status,
    s.educational_qualification, s.blood_group, s.pan_number, s.name_on_pan,
    s.aadhar_number, s.name_on_aadhar, s.family_member_name, s.family_contact_no,
    s.family_working_status, s.family_employer_name, s.family_employer_contact,
    s.emergency_contact_name, s.emergency_contact_no, s.emergency_contact_address,
    s.emergency_contact_relation, s.permanent_address, s.permanent_phone,
    s.permanent_landmark, s.permanent_lat_long, s.local_same_as_permanent,
    s.local_address, s.local_phone, s.local_landmark, s.local_lat_long,
    s.ref1_name, s.ref1_designation, s.ref1_organization, s.ref1_address,
    s.ref1_city_state_pin, s.ref1_contact_no, s.ref1_email,
    s.ref2_name, s.ref2_designation, s.ref2_organization, s.ref2_address,
    s.ref2_city_state_pin, s.ref2_contact_no, s.ref2_email,
    s.ref3_name, s.ref3_designation, s.ref3_organization, s.ref3_address,
    s.ref3_city_state_pin, s.ref3_contact_no, s.ref3_email,
    s.department, s.position, s.joining_date, s.employment_type,
    s.circle, s.project_name, s.reporting_manager,
    s.bank_name, s.account_number, s.ifsc_code, s.account_holder_name, s.bank_branch,
    s.basic_salary || 0, s.hra || 0, s.other_allowances || 0,
    s.address || '', s.city || '', s.state || '', s.zip_code || '',
    newStatus, empId,
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// STATIC ROUTES — must be BEFORE /:id param routes
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/employees
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.status NOT IN ('pending','pending_rejoin') GROUP BY e.id ORDER BY e.created_at DESC`
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/employees]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch employees', detail: err.message });
  }
});

// GET /api/employees/pending-count
router.get('/pending-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM employees WHERE LOWER(status) IN ('pending','pending_rejoin')`
    );
    return res.status(200).json({ success: true, count: parseInt(rows[0].count, 10) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending count' });
  }
});

// GET /api/employees/pending-rejoin-count
router.get('/pending-rejoin-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM employees WHERE LOWER(status) = 'pending_rejoin'`
    );
    return res.status(200).json({ success: true, count: parseInt(rows[0].count, 10) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending rejoin count' });
  }
});

// GET /api/employees/pending-rejoin
router.get('/pending-rejoin', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.status = 'pending_rejoin' GROUP BY e.id ORDER BY e.updated_at DESC`
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/employees/pending-rejoin]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/employees/activity-log
router.get('/activity-log', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        h.id,
        h.employee_id   AS emp_db_id,
        h.from_status,
        h.to_status,
        h.changed_by_name,
        h.reason,
        h.metadata,
        h.created_at,
        e.employee_id,
        e.first_name          AS emp_first_name,
        e.father_husband_name AS emp_father_name,
        e.last_name           AS emp_last_name,
        e.department          AS emp_department,
        e.email               AS emp_email
      FROM employee_status_history h
      JOIN employees e ON e.id = h.employee_id
      ORDER BY h.created_at DESC
      LIMIT 500
    `);
    return res.json({
      success: true,
      count: rows.length,
      data: rows.map(row => ({
        ...row,
        metadata: row.metadata
          ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata)
          : null,
      })),
    });
  } catch (err) {
    console.error('[GET /api/employees/activity-log]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch activity log', detail: err.message });
  }
});

// GET /api/employees/cleanup-expired-rejoin-invites
router.get('/cleanup-expired-rejoin-invites', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: expiredLinks } = await client.query(`
      SELECT rl.id, rl.link_id, rl.employee_email, rl.prefill_employee_id, rl.expires_at
      FROM registration_links rl
      WHERE rl.is_rejoin = true AND rl.is_used = false AND rl.expires_at < CURRENT_TIMESTAMP
    `);
    if (expiredLinks.length === 0)
      return res.json({ success: true, message: 'No expired rejoin invites found.', cleaned: 0 });

    let cleaned = 0;
    const { sendRejoinInviteExpiredEmail } = await import('../../services/emailService.js').catch(() => ({ sendRejoinInviteExpiredEmail: null }));

    for (const link of expiredLinks) {
      await client.query('BEGIN');
      try {
        let emp = null;
        if (link.prefill_employee_id) {
          const { rows } = await client.query(`SELECT * FROM employees WHERE id=$1`, [link.prefill_employee_id]);
          emp = rows[0] || null;
        }
        if (emp) {
          if (emp.status === 'pending_rejoin' && emp.rejoin_snapshot) {
            await restoreFromSnapshot(client, emp.id, emp.rejoin_snapshot, 'inactive');
          } else if (emp.status === 'inactive') {
            await client.query(`UPDATE employees SET active_rejoin_link_id=NULL WHERE id=$1`, [emp.id]);
          }
          if (sendRejoinInviteExpiredEmail && emp.email) {
            sendRejoinInviteExpiredEmail({ to: emp.email, firstName: emp.first_name, lastName: emp.last_name, employeeId: emp.employee_id })
              .catch(e => console.error('Expiry email failed:', e.message));
          }
        }
        await client.query(`DELETE FROM registration_links WHERE id=$1`, [link.id]);
        await client.query('COMMIT');
        cleaned++;
      } catch (innerErr) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to clean link ${link.link_id}:`, innerErr.message);
      }
    }
    return res.json({ success: true, message: `Cleaned ${cleaned} expired rejoin invite(s).`, cleaned });
  } catch (err) {
    console.error('[GET /cleanup-expired-rejoin-invites]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// GET /api/employees/export/template
router.get('/export/template', async (req, res) => {
  try {
    const { default: ExcelJS } = await import('exceljs');
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employee Import');
    worksheet.views = [{ state: 'frozen', ySplit: 2 }];

    const sections = [
      { label: 'Personal Information', start: 1,  end: 12, color: 'FF1D4ED8' },
      { label: 'Employment Details',   start: 13, end: 19, color: 'FF7C3AED' },
      { label: 'Salary & Bank',        start: 20, end: 27, color: 'FF047857' },
    ];
    sections.forEach(({ label, start, end, color }) => {
      worksheet.mergeCells(1, start, 1, end);
      const cell = worksheet.getCell(1, start);
      cell.value = label;
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    worksheet.getRow(1).height = 22;

    const columns = [
      { header: 'First Name *',        key: 'first_name',          width: 16, req: true  },
      { header: 'Last Name *',         key: 'last_name',           width: 16, req: true  },
      { header: 'Email *',             key: 'email',               width: 28, req: true  },
      { header: 'Phone *',             key: 'phone',               width: 14, req: true  },
      { header: 'Alternate Phone',     key: 'alt_phone',           width: 14, req: false },
      { header: 'Date of Birth *',     key: 'dob',                 width: 14, req: true  },
      { header: 'Gender *',            key: 'gender',              width: 10, req: true  },
      { header: 'Aadhar Number *',     key: 'aadhar_number',       width: 16, req: true  },
      { header: 'Address',             key: 'address',             width: 24, req: false },
      { header: 'City',                key: 'city',                width: 14, req: false },
      { header: 'State',               key: 'state',               width: 14, req: false },
      { header: 'Zip Code',            key: 'zip_code',            width: 12, req: false },
      { header: 'Department *',        key: 'department',          width: 18, req: true  },
      { header: 'Designation *',       key: 'designation',         width: 20, req: true  },
      { header: 'Joining Date *',      key: 'joining_date',        width: 14, req: true  },
      { header: 'Employment Type *',   key: 'employment_type',     width: 16, req: true  },
      { header: 'Circle',              key: 'circle',              width: 12, req: false },
      { header: 'Project Name',        key: 'project_name',        width: 18, req: false },
      { header: 'Reporting Manager',   key: 'reporting_manager',   width: 20, req: false },
      { header: 'Basic Salary',        key: 'basic_salary',        width: 14, req: false },
      { header: 'HRA',                 key: 'hra',                 width: 12, req: false },
      { header: 'Other Allowances',    key: 'other_allowances',    width: 18, req: false },
      { header: 'Bank Name *',         key: 'bank_name',           width: 22, req: true  },
      { header: 'Bank Branch',         key: 'bank_branch',         width: 18, req: false },
      { header: 'Account Number *',    key: 'account_number',      width: 18, req: true  },
      { header: 'IFSC Code *',         key: 'ifsc_code',           width: 14, req: true  },
      { header: 'Account Holder Name', key: 'account_holder_name', width: 22, req: false },
    ];

    columns.forEach((col, idx) => {
      const cell = worksheet.getCell(2, idx + 1);
      cell.value = col.header;
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.req ? 'FF16A34A' : 'FF0F766E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      worksheet.getColumn(idx + 1).width = col.width;
    });
    worksheet.getRow(2).height = 22;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[GET /export/template]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to generate template' });
  }
});

// GET /api/employees/export/data
router.get('/export/data', async (req, res) => {
  try {
    const { default: ExcelJS } = await import('exceljs');
    const { rows } = await pool.query(`
      SELECT e.employee_id, e.status,
        e.first_name, COALESCE(e.father_husband_name,'') AS father_husband_name, e.last_name,
        e.email, e.phone, COALESCE(e.alt_phone,'') AS alt_phone,
        e.date_of_birth, e.gender,
        COALESCE(e.marital_status,'') AS marital_status,
        COALESCE(e.educational_qualification,'') AS educational_qualification,
        COALESCE(e.blood_group,'') AS blood_group,
        COALESCE(e.pan_number,'') AS pan_number,
        COALESCE(e.aadhar_number,'') AS aadhar_number,
        e.department, e.position AS designation,
        e.joining_date, e.employment_type,
        COALESCE(e.circle,'') AS circle,
        COALESCE(e.project_name,'') AS project_name,
        COALESCE(e.reporting_manager,'') AS reporting_manager,
        COALESCE(e.basic_salary,0) AS basic_salary,
        COALESCE(e.hra,0) AS hra,
        COALESCE(e.other_allowances,0) AS other_allowances,
        e.bank_name, COALESCE(e.bank_branch,'') AS bank_branch,
        e.account_number, e.ifsc_code,
        COALESCE(e.account_holder_name,'') AS account_holder_name
      FROM employees e ORDER BY e.created_at DESC
    `);

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'No employee data found' });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Employees', { views: [{ state: 'frozen', ySplit: 2 }] });

    const headers = [
      'Employee ID','Status','First Name','Father/Husband','Last Name','Email','Phone','Alt Phone',
      'Date of Birth','Gender','Marital Status','Educational Qualification','Blood Group',
      'PAN Number','Aadhaar Number','Department','Designation','Joining Date','Employment Type',
      'Circle','Project','Reporting Manager','Basic Salary','HRA','Other Allowances','Total Salary',
      'Bank Name','Bank Branch','Account Number','IFSC Code','Account Holder',
    ];

    headers.forEach((h, idx) => {
      ws.getColumn(idx + 1).width = 18;
      const cell = ws.getCell(1, idx + 1);
      cell.value = h;
      cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(1).height = 24;

    rows.forEach((emp, idx) => {
      const rowNum = idx + 2;
      const total  = (emp.basic_salary||0) + (emp.hra||0) + (emp.other_allowances||0);
      const values = [
        emp.employee_id||'', emp.status||'',
        emp.first_name||'', emp.father_husband_name||'', emp.last_name||'',
        emp.email||'', emp.phone||'', emp.alt_phone||'',
        fmtDate(emp.date_of_birth), emp.gender||'',
        emp.marital_status||'', emp.educational_qualification||'', emp.blood_group||'',
        emp.pan_number||'', emp.aadhar_number||'',
        emp.department||'', emp.designation||'',
        fmtDate(emp.joining_date), emp.employment_type||'',
        emp.circle||'', emp.project_name||'', emp.reporting_manager||'',
        emp.basic_salary||0, emp.hra||0, emp.other_allowances||0, total,
        emp.bank_name||'', emp.bank_branch||'', emp.account_number||'', emp.ifsc_code||'', emp.account_holder_name||'',
      ];
      const bg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
      values.forEach((val, colIdx) => {
        const cell = ws.getCell(rowNum, colIdx + 1);
        cell.value = val;
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font  = { size: 9 };
        cell.alignment = { vertical: 'middle' };
      });
      ws.getRow(rowNum).height = 16;
    });

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="employees_export_${date}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[GET /export/data]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PARAM ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/employees/:id/upload-photo ─────────────────────────────────────
router.post('/:id/upload-photo', (req, res, next) => {
  uploadPhotoOnly(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'File must be under 5 MB' : err.message,
      });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No photo file provided' });
  }

  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empResult = await client.query(
      `SELECT id FROM employees WHERE id::text = $1 OR employee_id = $1`,
      [String(id)]
    );
    if (empResult.rows.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const empDbId = empResult.rows[0].id;

    const existing = await client.query(
      `SELECT id, file_path FROM employee_documents WHERE employee_id = $1 AND document_type = 'photo'`,
      [empDbId]
    );
    for (const doc of existing.rows) {
      const oldPath = path.join(PROJECT_ROOT, doc.file_path.replace(/^\//, ''));
      try { fs.unlinkSync(oldPath); } catch (_) {}
      await client.query(`DELETE FROM employee_documents WHERE id = $1`, [doc.id]);
    }

    const filePath = `/uploads/employee_docs/${req.file.filename}`;
    const { rows } = await client.query(
      `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
      VALUES ($1, 'photo', $2, $3, $4, $5)
      RETURNING id, document_type, file_path, file_name, mime_type`,
      [empDbId, filePath, req.file.originalname, req.file.size, req.file.mimetype]
    );

    await client.query('COMMIT');
    console.log(`📸 Photo uploaded for employee id=${empDbId}: ${filePath}`);
    return res.json({
      success: true,
      message: 'Photo uploaded and saved successfully',
      data: rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    try { fs.unlinkSync(req.file.path); } catch (_) {}
    console.error('[POST /api/employees/:id/upload-photo]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to save photo', detail: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/employees/:id/upload-document ───────────────────────────────────
router.post('/:id/upload-document', (req, res, next) => {
  uploadDocAny(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' ? 'File must be under 5 MB' : err.message,
      });
    }
    next();
  });
}, async (req, res) => {
  const uploadedFile = req.files?.[0];
  if (!uploadedFile) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }

  const { id } = req.params;
  const documentType = req.body.documentType || uploadedFile.fieldname;

  const ALLOWED_TYPES = [
    'photo', 'aadharCard', 'panCard', 'bankPassbook',
    'idPhoto', 'resume', 'medicalCertificate', 'academicRecords',
    'payslip', 'otherCertificates', 'farmToCli',
  ];
  if (!ALLOWED_TYPES.includes(documentType)) {
    try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
    return res.status(400).json({
      success: false,
      message: `Invalid documentType. Must be one of: ${ALLOWED_TYPES.join(', ')}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empResult = await client.query(
      `SELECT id FROM employees WHERE id::text = $1 OR employee_id = $1`,
      [String(id)]
    );
    if (empResult.rows.length === 0) {
      try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const empDbId = empResult.rows[0].id;

    const existing = await client.query(
      `SELECT id, file_path FROM employee_documents WHERE employee_id = $1 AND document_type = $2`,
      [empDbId, documentType]
    );
    for (const doc of existing.rows) {
      const oldPath = path.join(PROJECT_ROOT, doc.file_path.replace(/^\//, ''));
      try { fs.unlinkSync(oldPath); } catch (_) {}
      await client.query(`DELETE FROM employee_documents WHERE id = $1`, [doc.id]);
    }

    const filePath = `/uploads/employee_docs/${uploadedFile.filename}`;
    const { rows } = await client.query(
      `INSERT INTO employee_documents
        (employee_id, document_type, file_path, file_name, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, document_type, file_path, file_name, mime_type`,
      [empDbId, documentType, filePath, uploadedFile.originalname, uploadedFile.size, uploadedFile.mimetype]
    );

    await client.query('COMMIT');
    console.log(`📎 Document uploaded for employee id=${empDbId}: [${documentType}] ${filePath}`);
    return res.json({ success: true, message: 'Document uploaded successfully', data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
    console.error('[POST /api/employees/:id/upload-document]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to save document', detail: err.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/employees/:id/documents/:docId ────────────────────────────────
router.delete('/:id/documents/:docId', async (req, res) => {
  const { id, docId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const empResult = await client.query(
      `SELECT id FROM employees WHERE id::text = $1 OR employee_id = $1`,
      [String(id)]
    );
    if (empResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    const empDbId = empResult.rows[0].id;

    const docResult = await client.query(
      `SELECT id, file_path FROM employee_documents WHERE id = $1 AND employee_id = $2`,
      [docId, empDbId]
    );
    if (docResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const doc = docResult.rows[0];
    const diskPath = path.join(PROJECT_ROOT, doc.file_path.replace(/^\//, ''));
    try { fs.unlinkSync(diskPath); } catch (_) {}

    await client.query(`DELETE FROM employee_documents WHERE id = $1`, [doc.id]);
    await client.query('COMMIT');

    console.log(`🗑  Document deleted for employee id=${empDbId}: doc id=${doc.id}`);
    return res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DELETE /api/employees/:id/documents/:docId]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete document', detail: err.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/employees/:id/pending-rejoin ──────────────────────────────────
router.delete('/:id/pending-rejoin', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rows: empRows } = await client.query(
      `SELECT * FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)]
    );
    if (!empRows[0]) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = empRows[0];

    if (emp.status !== 'pending_rejoin') {
      return res.status(400).json({
        success: false,
        message: `Employee status is "${emp.status}", not "pending_rejoin". Nothing to delete.`
      });
    }

    await client.query('BEGIN');
    await restoreFromSnapshot(client, emp.id, emp.rejoin_snapshot, 'inactive');
    await client.query(
      `DELETE FROM registration_links WHERE employee_email=$1 AND is_rejoin=true AND is_used=false`,
      [emp.email]
    );
    await client.query('COMMIT');

    const emailMod = await import('../../services/emailService.js').catch(() => null);
    if (emailMod?.sendRejoinCancelledEmail && emp.email) {
      emailMod.sendRejoinCancelledEmail({
        to: emp.email, firstName: emp.first_name,
        lastName: emp.last_name, employeeId: emp.employee_id,
      }).catch(e => console.error('Cancellation email failed:', e.message));
    }

    return res.json({
      success: true,
      message: `Rejoin request for ${emp.first_name} ${emp.last_name} has been cancelled. Employee restored to Inactive.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DELETE /api/employees/:id/pending-rejoin]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ── GET /api/employees/:id/history ───────────────────────────────────────────
router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const empResult = await pool.query(
      `SELECT id, employee_id, first_name, last_name, email,
              department, position, joining_date, status, created_at
      FROM employees WHERE id = $1`,
      [id]
    );
    if (empResult.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Employee not found' });

    const employee = empResult.rows[0];

    const countResult = await pool.query(
      `SELECT COUNT(*) AS cnt FROM employee_status_history WHERE employee_id = $1`,
      [id]
    );
    if (parseInt(countResult.rows[0].cnt, 10) === 0) {
      await pool.query(
        `INSERT INTO employee_status_history
          (employee_id, from_status, to_status, changed_by_name, reason, metadata, created_at)
        VALUES ($1, NULL, $2, 'System (backfill)', 'Initial status — employee joined', $3, $4)`,
        [id, employee.status, JSON.stringify({ employee_id: employee.employee_id, department: employee.department }), employee.created_at || new Date()]
      );
    }

    const historyResult = await pool.query(
      `SELECT id, from_status, to_status, changed_by_name, reason, metadata, created_at
      FROM employee_status_history
      WHERE employee_id = $1
      ORDER BY created_at ASC`,
      [id]
    );

    return res.json({ success: true, employee, history: { all: historyResult.rows } });
  } catch (err) {
    console.error('[GET /api/employees/:id/history]', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── PATCH /api/employees/:id/status ──────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  const { id }                            = req.params;
  const { status, reason, changedByName } = req.body;

  const allowed = ['Active','Inactive','Pending','Blacklist','Blacklisted','active','inactive','pending_rejoin'];
  if (!allowed.includes(status))
    return res.status(400).json({ success: false, message: 'Invalid status value' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(
      `SELECT id, status, employee_id, department FROM employees WHERE id::text=$1 OR employee_id=$1`,
      [String(id)]
    );
    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const empRow     = current.rows[0];
    const empDbId    = empRow.id;
    const fromStatus = empRow.status;

    const { rows } = await client.query(
      `UPDATE employees SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,
      [status, empDbId]
    );

    await recordStatusHistory(client, {
      employeeId:       empDbId,
      fromStatus,
      toStatus:         status,
      changedByName:    changedByName || 'HR Admin',
      reason:           reason || null,
      employeePublicId: empRow.employee_id,
      department:       empRow.department,
    });

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Status updated', data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PATCH /api/employees/:id/status]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  } finally {
    client.release();
  }
});

// ── POST /api/employees/:id/status-notification ───────────────────────────────
router.post('/:id/status-notification', async (req, res) => {
  try {
    const { status, reason, email, firstName, lastName } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Employee email is required' });

    const {
      sendActiveNotificationEmail,
      sendInactiveNotificationEmail,
      sendBlacklistNotificationEmail,
    } = await import('../../services/emailService.js');

    let result;
    if (status === 'Active') {
      result = await sendActiveNotificationEmail({ to: email, firstName, lastName });
    } else if (status === 'Inactive') {
      result = await sendInactiveNotificationEmail({ to: email, firstName, lastName, reason });
    } else if (status === 'Blacklist' || status === 'Blacklisted') {
      result = await sendBlacklistNotificationEmail({ to: email, firstName, lastName, reason });
    } else {
      return res.status(200).json({ success: true, message: 'No notification email required for this status' });
    }

    return result.success
      ? res.status(200).json({ success: true, message: `Notification email sent to ${email}` })
      : res.status(500).json({ success: false, message: 'Email dispatch failed', error: result.error });
  } catch (err) {
    console.error('[POST /api/employees/:id/status-notification]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send notification' });
  }
});

// ── POST /api/employees/:id/send-rejoin-invite ────────────────────────────────
router.post('/:id/send-rejoin-invite', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rows } = await client.query(
      `SELECT * FROM employees WHERE id::text = $1 OR employee_id = $1`,
      [String(id)]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Employee not found' });
    const emp = rows[0];

    if (emp.status === 'active')
      return res.status(409).json({ success: false, message: 'Employee is currently active.' });
    if (emp.status === 'blacklisted' || emp.status === 'Blacklist')
      return res.status(403).json({ success: false, message: 'Blacklisted employees cannot be invited to rejoin.' });
    if (!emp.email)
      return res.status(400).json({ success: false, message: 'Employee has no email address on record.' });

    const { rows: existingLinks } = await client.query(
      `SELECT id FROM registration_links
      WHERE employee_email = $1 AND is_used = false AND expires_at > CURRENT_TIMESTAMP AND is_rejoin = true`,
      [emp.email]
    );
    if (existingLinks[0]) {
      return res.status(409).json({
        success: false,
        message: 'A rejoin invite was already sent and is still valid. Ask the employee to check their email, or wait for it to expire before resending.'
      });
    }

    const snapshot = buildSnapshot(emp);
    const { v4: uuidv4 } = await import('uuid');
    const linkId    = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const baseUrl         = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationUrl = `${baseUrl}/registration/${linkId}`;

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO registration_links
        (link_id, employee_email, expires_at, status, is_used, is_rejoin, prefill_employee_id)
      VALUES ($1, $2, $3, 'active', false, true, $4)`,
      [linkId, emp.email, expiresAt, emp.id]
    );
    await client.query(
      `UPDATE employees SET
        rejoin_snapshot=$1, active_rejoin_link_id=$2,
        rejoin_invite_sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE id=$3`,
      [JSON.stringify(snapshot), linkId, emp.id]
    );
    await client.query('COMMIT');

    const { sendRejoinInvitationEmail } = await import('../../services/emailService.js');
    await sendRejoinInvitationEmail({
      to: emp.email, firstName: emp.first_name, lastName: emp.last_name,
      employeeId: emp.employee_id, registrationUrl, expiresAt: expiresAt.toISOString(),
    });

    console.log(`📧 Rejoin invite sent → ${emp.email} (${emp.employee_id || emp.id})`);
    return res.json({
      success: true,
      message: `Rejoin invitation sent to ${emp.email}`,
      data: { linkId, registrationUrl, expiresAt: expiresAt.toISOString() },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [POST /employees/:id/send-rejoin-invite]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// ── GET /api/employees/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.id::text=$1 OR e.employee_id=$1 GROUP BY e.id`,
      [String(req.params.id)]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch employee' });
  }
});

// ── POST /api/employees ───────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try { await applyMulter(req, res); } catch (uploadErr) {
    return res.status(400).json({
      success: false,
      message: uploadErr.code === 'LIMIT_FILE_SIZE' ? 'File size must be less than 5MB' : uploadErr.message
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = req.body;

    const missing = [];
    if (!b.firstName?.trim())     missing.push('First Name');
    if (!b.lastName?.trim())      missing.push('Last Name');
    if (!b.email?.trim())         missing.push('Email');
    if (!b.phone?.trim())         missing.push('Phone');
    if (!b.dob)                   missing.push('Date of Birth');
    if (!b.gender)                missing.push('Gender');
    if (!b.joiningDate)           missing.push('Joining Date');
    if (!b.department)            missing.push('Department');
    if (!b.designation?.trim())   missing.push('Designation');
    if (!b.employmentType)        missing.push('Employment Type');
    if (!b.bankName?.trim())      missing.push('Bank Name');
    if (!b.accountNumber?.trim()) missing.push('Account Number');
    if (!b.ifscCode?.trim())      missing.push('IFSC Code');

    if (missing.length > 0) {
      cleanupFiles(req.files);
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
    }

    // ── Use provided employeeId OR generate a new Insta-YYMM#### ID ──────────
    const eid = b.employeeId?.toString().trim();
    const employeeId = (eid && eid !== 'Loading...') ? eid : await generateEmployeeId(client);

    const { rows } = await client.query(`
      INSERT INTO employees (
        employee_id,
        first_name, middle_name, last_name, father_husband_name,
        email, phone, alt_phone,
        date_of_birth, gender, marital_status, educational_qualification, blood_group,
        pan_number, name_on_pan, aadhar_number, name_on_aadhar,
        family_member_name, family_contact_no, family_working_status,
        family_employer_name, family_employer_contact,
        emergency_contact_name, emergency_contact_no,
        emergency_contact_address, emergency_contact_relation,
        permanent_address, permanent_phone, permanent_landmark, permanent_lat_long,
        local_same_as_permanent, local_address, local_phone, local_landmark, local_lat_long,
        ref1_name, ref1_designation, ref1_organization, ref1_address, ref1_city_state_pin, ref1_contact_no, ref1_email,
        ref2_name, ref2_designation, ref2_organization, ref2_address, ref2_city_state_pin, ref2_contact_no, ref2_email,
        ref3_name, ref3_designation, ref3_organization, ref3_address, ref3_city_state_pin, ref3_contact_no, ref3_email,
        address, city, state, zip_code,
        bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
        position, department, circle, project_name, joining_date, reporting_manager, employment_type,
        status, basic_salary, hra, other_allowances
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,
        $43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,
        $56,$57,$58,$59,$60,$61,$62,$63,$64,$65,$66,$67,$68,$69,$70,$71,$72,$73,$74,$75,$76
      ) RETURNING *
    `, [
      employeeId,
      b.firstName?.trim(), null, b.lastName?.trim(), b.fatherHusbandName?.trim() || null,
      b.email?.trim().toLowerCase(), b.phone?.trim(), b.altPhone?.trim() || null,
      b.dob, b.gender, b.maritalStatus || null, b.educationalQualification || null, b.bloodGroup || null,
      b.panNumber?.trim() || null, b.nameOnPan?.trim() || null,
      b.aadhar?.replace(/\s/g,'') || null, b.nameOnAadhar?.trim() || null,
      b.familyMemberName?.trim() || null, b.familyContactNo?.trim() || null, b.familyWorkingStatus || null,
      b.familyEmployerName?.trim() || null, b.familyEmployerContact?.trim() || null,
      b.emergencyContactName?.trim() || null, b.emergencyContactNo?.trim() || null,
      b.emergencyContactAddress?.trim() || null, b.emergencyContactRelation || null,
      b.permanentAddress?.trim() || null, b.permanentPhone?.trim() || null,
      b.permanentLandmark?.trim() || null, b.permanentLatLong?.trim() || null,
      b.localSameAsPermanent === 'true' || b.localSameAsPermanent === true || false,
      b.localAddress?.trim() || null, b.localPhone?.trim() || null,
      b.localLandmark?.trim() || null, b.localLatLong?.trim() || null,
      b.ref1Name?.trim() || null, b.ref1Designation?.trim() || null, b.ref1Organization?.trim() || null,
      b.ref1Address?.trim() || null, b.ref1CityStatePin?.trim() || null,
      b.ref1ContactNo?.trim() || null, b.ref1Email?.trim() || null,
      b.ref2Name?.trim() || null, b.ref2Designation?.trim() || null, b.ref2Organization?.trim() || null,
      b.ref2Address?.trim() || null, b.ref2CityStatePin?.trim() || null,
      b.ref2ContactNo?.trim() || null, b.ref2Email?.trim() || null,
      b.ref3Name?.trim() || null, b.ref3Designation?.trim() || null, b.ref3Organization?.trim() || null,
      b.ref3Address?.trim() || null, b.ref3CityStatePin?.trim() || null,
      b.ref3ContactNo?.trim() || null, b.ref3Email?.trim() || null,
      b.address || '', b.city || '', b.state || '', b.zipCode || '',
      b.bankName?.trim(), b.accountNumber?.trim(), b.ifscCode?.trim().toUpperCase(),
      b.accountHolderName?.trim() || `${b.firstName?.trim()} ${b.lastName?.trim()}`,
      b.bankBranch?.trim() || b.branch?.trim() || null,
      b.designation?.trim(), b.department,
      b.circle || null, b.projectName || null,
      b.joiningDate, b.reportingManager || null, b.employmentType,
      b.status || 'Active',
      parseFloat(b.basicSalary) || 0,
      parseFloat(b.hra)         || 0,
      parseFloat(b.otherAllowances) || 0,
    ]);

    const dbId  = rows[0].id;
    const files = req.files || {};
    await Promise.all([
      saveDocument(client, dbId, 'photo',        files.photo?.[0]),
      saveDocument(client, dbId, 'aadharCard',   files.aadharCard?.[0]),
      saveDocument(client, dbId, 'panCard',      files.panCard?.[0]),
      saveDocument(client, dbId, 'bankPassbook', files.bankPassbook?.[0]),
    ]);

    await recordStatusHistory(client, {
      employeeId:       dbId,
      fromStatus:       null,
      toStatus:         rows[0].status,
      changedByName:    'HR Admin',
      reason:           'Employee registered manually',
      employeePublicId: rows[0].employee_id,
      department:       rows[0].department,
    });

    await client.query('COMMIT');
    console.log(`✅ Employee created: ${employeeId}`);

    const full = await pool.query(`${EMP_SELECT} WHERE e.id=$1 GROUP BY e.id`, [dbId]);
    return res.status(201).json({ success: true, message: 'Employee added successfully', data: full.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    cleanupFiles(req.files);
    console.error('[POST /api/employees]', err.message);
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'email address' : 'employee ID';
      return res.status(409).json({ success: false, message: `Employee with this ${field} already exists` });
    }
    return res.status(500).json({ success: false, message: 'Failed to save employee.', detail: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/employees/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const b      = req.body;

    const { rows } = await pool.query(`
      UPDATE employees SET
        first_name = $1, middle_name = $2, last_name = $3, father_husband_name = $4,
        email = $5, phone = $6, alt_phone = $7, date_of_birth = $8,
        gender = $9, marital_status = $10, educational_qualification = $11, blood_group = $12,
        pan_number = $13, name_on_pan = $14, aadhar_number = $15, name_on_aadhar = $16,
        family_member_name = $17, family_contact_no = $18, family_working_status = $19,
        family_employer_name = $20, family_employer_contact = $21,
        emergency_contact_name = $22, emergency_contact_no = $23,
        emergency_contact_address = $24, emergency_contact_relation = $25,
        permanent_address = $26, permanent_phone = $27, permanent_landmark = $28, permanent_lat_long = $29,
        local_same_as_permanent = $30, local_address = $31, local_phone = $32,
        local_landmark = $33, local_lat_long = $34,
        ref1_name = $35, ref1_designation = $36, ref1_organization = $37, ref1_address = $38,
        ref1_city_state_pin = $39, ref1_contact_no = $40, ref1_email = $41,
        ref2_name = $42, ref2_designation = $43, ref2_organization = $44, ref2_address = $45,
        ref2_city_state_pin = $46, ref2_contact_no = $47, ref2_email = $48,
        ref3_name = $49, ref3_designation = $50, ref3_organization = $51, ref3_address = $52,
        ref3_city_state_pin = $53, ref3_contact_no = $54, ref3_email = $55,
        department = $56, position = $57, employment_type = $58, joining_date = $59,
        circle = $60, project_name = $61, reporting_manager = $62,
        status = $63, basic_salary = $64, hra = $65, other_allowances = $66,
        bank_name = $67, account_number = $68, ifsc_code = $69,
        account_holder_name = $70, bank_branch = $71,
        updated_at = CURRENT_TIMESTAMP
      WHERE id::text = $72 OR employee_id = $72
      RETURNING *
    `, [
      b.firstName?.trim()||null, null, b.lastName?.trim()||null, b.fatherHusbandName?.trim()||null,
      b.email?.trim()||null, b.phone?.trim()||null, b.altPhone?.trim()||null, b.dob||null,
      b.gender||null, b.maritalStatus||null, b.educationalQualification||null, b.bloodGroup||null,
      b.panNumber?.trim()||null, b.nameOnPan?.trim()||null,
      b.aadhar?.replace(/\s/g,'')||null, b.nameOnAadhar?.trim()||null,
      b.familyMemberName?.trim()||null, b.familyContactNo?.trim()||null, b.familyWorkingStatus||null,
      b.familyEmployerName?.trim()||null, b.familyEmployerContact?.trim()||null,
      b.emergencyContactName?.trim()||null, b.emergencyContactNo?.trim()||null,
      b.emergencyContactAddress?.trim()||null, b.emergencyContactRelation||null,
      b.permanentAddress?.trim()||null, b.permanentPhone?.trim()||null,
      b.permanentLandmark?.trim()||null, b.permanentLatLong?.trim()||null,
      b.localSameAsPermanent==='true'||b.localSameAsPermanent===true||false,
      b.localAddress?.trim()||null, b.localPhone?.trim()||null,
      b.localLandmark?.trim()||null, b.localLatLong?.trim()||null,
      b.ref1Name?.trim()||null, b.ref1Designation?.trim()||null, b.ref1Organization?.trim()||null,
      b.ref1Address?.trim()||null, b.ref1CityStatePin?.trim()||null, b.ref1ContactNo?.trim()||null, b.ref1Email?.trim()||null,
      b.ref2Name?.trim()||null, b.ref2Designation?.trim()||null, b.ref2Organization?.trim()||null,
      b.ref2Address?.trim()||null, b.ref2CityStatePin?.trim()||null, b.ref2ContactNo?.trim()||null, b.ref2Email?.trim()||null,
      b.ref3Name?.trim()||null, b.ref3Designation?.trim()||null, b.ref3Organization?.trim()||null,
      b.ref3Address?.trim()||null, b.ref3CityStatePin?.trim()||null, b.ref3ContactNo?.trim()||null, b.ref3Email?.trim()||null,
      b.department||null, b.designation?.trim()||null, b.employmentType||null, b.joiningDate||null,
      b.circle||null, b.projectName||null, b.reportingManager||null,
      b.status||'Active',
      parseFloat(b.basicSalary)||0, parseFloat(b.hra)||0, parseFloat(b.otherAllowances)||0,
      b.bankName?.trim()||null, b.accountNumber?.trim()||null,
      b.ifscCode?.trim().toUpperCase()||null, b.accountHolderName?.trim()||null, b.bankBranch?.trim()||null,
      String(id),
    ]);

    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
    const full = await pool.query(`${EMP_SELECT} WHERE e.id = $1 GROUP BY e.id`, [rows[0].id]);
    console.log(`✅ Employee updated: ${rows[0].employee_id}`);
    return res.json({ success: true, message: 'Employee updated successfully', data: full.rows[0] });
  } catch (err) {
    console.error('[PUT /api/employees/:id]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update employee' });
  }
});

// ── DELETE /api/employees/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE employees SET status='Inactive', updated_at=CURRENT_TIMESTAMP
      WHERE id::text=$1 OR employee_id=$1
      RETURNING id, employee_id, first_name, last_name, status`,
      [String(req.params.id)]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Employee deactivated', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate employee' });
  }
});

export default router;