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

// ── Multer setup ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/employee_docs');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

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

async function generateEmployeeId(client) {
  const { rows } = await client.query(
    `SELECT employee_id FROM employees WHERE employee_id LIKE 'EMP%' ORDER BY id DESC LIMIT 1`
  );
  if (rows.length === 0) return 'EMP001';
  const num = parseInt(rows[0].employee_id.replace(/\D/g, ''), 10) || 0;
  return `EMP${String(num + 1).padStart(3, '0')}`;
}

async function saveDocument(client, empDbId, type, file) {
  if (!file) return;
  await client.query(
    `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [empDbId, type, `/uploads/employee_docs/${file.filename}`, file.originalname, file.size, file.mimetype]
  );
}

const EMP_SELECT = `
  SELECT
    e.id, e.employee_id,
    e.first_name, e.last_name, e.middle_name,
    e.email, e.phone,
    e.date_of_birth, e.gender,
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
    e.aadhar_number, e.alt_phone,
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

// ══════════════════════════════════════════════════════════════════════════════
// STATIC / NAMED ROUTES — MUST come BEFORE /:id param routes
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/employees ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${EMP_SELECT} WHERE e.status != 'pending' GROUP BY e.id ORDER BY e.created_at DESC`
    );
    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[GET /api/employees]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch employees', detail: err.message });
  }
});

// ── GET /api/employees/pending-count ─────────────────────────────────────
router.get('/pending-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM employees WHERE LOWER(status) = 'pending'`
    );
    return res.status(200).json({ success: true, count: parseInt(rows[0].count, 10) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending count' });
  }
});

// ── GET /api/employees/export/template ───────────────────────────────────
router.get('/export/template', async (req, res) => {
  try {
    const { default: ExcelJS } = await import('exceljs');

    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employee Import');
    worksheet.views = [{ state: 'frozen', ySplit: 2 }];

    const sections = [
      { label: 'Personal Information', start: 1,  end: 13, color: 'FF1D4ED8' },
      { label: 'Employment Details',   start: 14, end: 20, color: 'FF7C3AED' },
      { label: 'Salary & Bank',        start: 21, end: 28, color: 'FF047857' },
    ];
    sections.forEach(({ label, start, end, color }) => {
      worksheet.mergeCells(1, start, 1, end);
      const cell = worksheet.getCell(1, start);
      cell.value     = label;
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    worksheet.getRow(1).height = 22;

    const columns = [
      { header: 'First Name *',        key: 'first_name',          width: 16, req: true  },
      { header: 'Middle Name',         key: 'middle_name',         width: 16, req: false },
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
      cell.value     = col.header;
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.req ? 'FF16A34A' : 'FF0F766E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      worksheet.getColumn(idx + 1).width = col.width;
    });
    worksheet.getRow(2).height = 22;

    const sampleRow = worksheet.getRow(3);
    const sampleValues = [
      'Rahul', 'Suresh', 'Sharma', 'rahul.sharma@example.com', '9876543210', '9988776655',
      '1995-06-15', 'Male', '123456789012',
      '45 MG Road', 'Pune', 'Maharashtra', '411001',
      'IT', 'Software Developer', '2024-01-10', 'Full-time',
      'West', 'Project Alpha', 'Amit Joshi',
      45000, 13500, 5000,
      'State Bank of India', 'Pune Main', '1234567890', 'SBIN0001234', 'Rahul Suresh Sharma',
    ];
    sampleValues.forEach((val, idx) => {
      const cell = sampleRow.getCell(idx + 1);
      cell.value     = val;
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      cell.font      = { italic: true, color: { argb: 'FF374151' }, size: 10 };
      cell.alignment = { vertical: 'middle' };
    });
    sampleRow.height = 18;

    for (let r = 4; r <= 12; r++) {
      const row = worksheet.getRow(r);
      const bg  = r % 2 === 0 ? 'FFFAFAFA' : 'FFFFFFFF';
      for (let c = 1; c <= columns.length; c++) {
        const cell = row.getCell(c);
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { vertical: 'middle' };
      }
      row.height = 18;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employee_import_template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[GET /export/template]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to generate template', error: err.message });
  }
});

// ── GET /api/employees/export/data ────────────────────────────────────────
router.get('/export/data', async (req, res) => {
  try {
    const { default: ExcelJS } = await import('exceljs');

    const { rows } = await pool.query(`
      SELECT
        e.employee_id, e.first_name, e.middle_name, e.last_name,
        e.email, e.phone,
        COALESCE(e.alt_phone, '')        AS alt_phone,
        e.date_of_birth, e.gender,
        COALESCE(e.aadhar_number, '')    AS aadhar_number,
        COALESCE(e.address, '')          AS address,
        COALESCE(e.city, '')             AS city,
        COALESCE(e.state, '')            AS state,
        COALESCE(e.zip_code, '')         AS zip_code,
        e.department,
        e.position                       AS designation,
        e.joining_date, e.employment_type,
        COALESCE(e.circle, '')           AS circle,
        COALESCE(e.project_name, '')     AS project_name,
        COALESCE(e.reporting_manager,'') AS reporting_manager,
        COALESCE(e.basic_salary, 0)      AS basic_salary,
        COALESCE(e.hra, 0)               AS hra,
        COALESCE(e.other_allowances, 0)  AS other_allowances,
        e.bank_name,
        COALESCE(e.bank_branch, '')      AS bank_branch,
        e.account_number, e.ifsc_code,
        COALESCE(e.account_holder_name,'') AS account_holder_name,
        e.status
      FROM employees e
      WHERE e.status != 'pending'
      ORDER BY e.created_at DESC
    `);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No employee data found to export' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Employee Management System';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Employee Import', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    const COLUMNS = [
      { header: 'First Name *',        key: 'first_name',          req: true,  width: 16 },
      { header: 'Middle Name',         key: 'middle_name',         req: false, width: 16 },
      { header: 'Last Name *',         key: 'last_name',           req: true,  width: 16 },
      { header: 'Email *',             key: 'email',               req: true,  width: 28 },
      { header: 'Phone *',             key: 'phone',               req: true,  width: 14 },
      { header: 'Alternate Phone',     key: 'alt_phone',           req: false, width: 14 },
      { header: 'Date of Birth *',     key: 'date_of_birth',       req: true,  width: 14 },
      { header: 'Gender *',            key: 'gender',              req: true,  width: 10 },
      { header: 'Aadhar Number *',     key: 'aadhar_number',       req: true,  width: 16 },
      { header: 'Address',             key: 'address',             req: false, width: 24 },
      { header: 'City',                key: 'city',                req: false, width: 14 },
      { header: 'State',               key: 'state',               req: false, width: 14 },
      { header: 'Zip Code',            key: 'zip_code',            req: false, width: 12 },
      { header: 'Department *',        key: 'department',          req: true,  width: 18 },
      { header: 'Designation *',       key: 'designation',         req: true,  width: 20 },
      { header: 'Joining Date *',      key: 'joining_date',        req: true,  width: 14 },
      { header: 'Employment Type *',   key: 'employment_type',     req: true,  width: 16 },
      { header: 'Circle',              key: 'circle',              req: false, width: 12 },
      { header: 'Project Name',        key: 'project_name',        req: false, width: 18 },
      { header: 'Reporting Manager',   key: 'reporting_manager',   req: false, width: 20 },
      { header: 'Basic Salary',        key: 'basic_salary',        req: false, width: 14 },
      { header: 'HRA',                 key: 'hra',                 req: false, width: 12 },
      { header: 'Other Allowances',    key: 'other_allowances',    req: false, width: 18 },
      { header: 'Bank Name *',         key: 'bank_name',           req: true,  width: 22 },
      { header: 'Bank Branch',         key: 'bank_branch',         req: false, width: 18 },
      { header: 'Account Number *',    key: 'account_number',      req: true,  width: 18 },
      { header: 'IFSC Code *',         key: 'ifsc_code',           req: true,  width: 14 },
      { header: 'Account Holder Name', key: 'account_holder_name', req: false, width: 22 },
    ];

    COLUMNS.forEach((col, idx) => {
      ws.getColumn(idx + 1).width = col.width;
    });

    const SECTIONS = [
      { label: 'Personal Information', start: 1,  end: 13, color: 'FF1D4ED8' },
      { label: 'Employment Details',   start: 14, end: 20, color: 'FF7C3AED' },
      { label: 'Salary & Bank',        start: 21, end: 28, color: 'FF047857' },
    ];
    SECTIONS.forEach(({ label, start, end, color }) => {
      ws.mergeCells(1, start, 1, end);
      const cell = ws.getCell(1, start);
      cell.value     = label;
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    ws.getRow(1).height = 22;

    COLUMNS.forEach((col, idx) => {
      const cell = ws.getCell(2, idx + 1);
      cell.value     = col.header;
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.req ? 'FF16A34A' : 'FF0F766E' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    ws.getRow(2).height = 22;

    const hairBorder = {
      top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
      bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
      right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
    };

    rows.forEach((emp, idx) => {
      const rowNum = idx + 3;
      const bg     = idx % 2 === 0 ? 'FFF0FDF4' : 'FFFFFFFF';
      const values = [
        emp.first_name || '', emp.middle_name || '', emp.last_name || '',
        emp.email || '', emp.phone || '', emp.alt_phone || '',
        emp.date_of_birth ? new Date(emp.date_of_birth).toLocaleDateString('en-IN') : '',
        emp.gender || '', emp.aadhar_number || '',
        emp.address || '', emp.city || '', emp.state || '', emp.zip_code || '',
        emp.department || '', emp.designation || '',
        emp.joining_date ? new Date(emp.joining_date).toLocaleDateString('en-IN') : '',
        emp.employment_type || '', emp.circle || '', emp.project_name || '', emp.reporting_manager || '',
        Number(emp.basic_salary) || 0, Number(emp.hra) || 0, Number(emp.other_allowances) || 0,
        emp.bank_name || '', emp.bank_branch || '', emp.account_number || '',
        emp.ifsc_code || '', emp.account_holder_name || '',
      ];
      values.forEach((val, colIdx) => {
        const cell = ws.getCell(rowNum, colIdx + 1);
        cell.value     = val;
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { vertical: 'middle' };
        cell.border    = hairBorder;
        cell.font      = { size: 10 };
      });
      [21, 22, 23].forEach(colIdx => {
        const cell = ws.getCell(rowNum, colIdx);
        cell.numFmt = '₹#,##0.00';
        cell.font   = { size: 10, color: { argb: 'FF065F46' } };
      });
      ws.getRow(rowNum).height = 18;
    });

    const summaryRowNum = rows.length + 3;
    ws.getCell(summaryRowNum, 1).value = `Total Employees: ${rows.length}`;
    ws.getCell(summaryRowNum, 1).font  = { bold: true, color: { argb: 'FF4F46E5' }, size: 10 };
    ws.getRow(summaryRowNum).height = 18;

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="employees_export_${date}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
    console.log(`✅ Exported ${rows.length} employees`);

  } catch (err) {
    console.error('[GET /export/data]', err.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Export failed', error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PARAM ROUTES — always AFTER all static routes above
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/employees/:id ────────────────────────────────────────────────
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

// ── POST /api/employees ────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    await applyMulter(req, res);
  } catch (uploadErr) {
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

    const employeeId = b.employeeId?.trim() || await generateEmployeeId(client);

    const { rows } = await client.query(`
      INSERT INTO employees (
        employee_id, first_name, middle_name, last_name,
        email, phone, alt_phone, date_of_birth, gender, aadhar_number,
        address, city, state, zip_code,
        bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
        position, department, circle, project_name,
        joining_date, reporting_manager, employment_type, status,
        basic_salary, hra, other_allowances
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26,$27,
        $28,$29,$30
      ) RETURNING *
    `, [
      employeeId,
      b.firstName.trim(), b.middleName?.trim() || null, b.lastName.trim(),
      b.email.trim().toLowerCase(), b.phone.trim(),
      b.altPhone?.trim() || null,
      b.dob, b.gender,
      b.aadhar?.replace(/\s/g, '') || null,
      b.address || '', b.city || '', b.state || '', b.zipCode || '',
      b.bankName.trim(), b.accountNumber.trim(), b.ifscCode.trim().toUpperCase(),
      b.accountHolderName?.trim() || `${b.firstName.trim()} ${b.lastName.trim()}`,
      b.branch?.trim() || b.bankBranch?.trim() || null,
      b.designation.trim(), b.department,
      b.circle || null, b.projectName || null,
      b.joiningDate, b.reportingManager || null, b.employmentType,
      b.status || 'Active',
      parseFloat(b.basicSalary)     || 0,
      parseFloat(b.hra)             || 0,
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
    return res.status(500).json({ success: false, message: 'Failed to save employee. Please try again.', detail: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/employees/:id — UPDATED: all fields ──────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const b      = req.body;

    const { rows } = await pool.query(`
      UPDATE employees SET
        first_name          = $1,
        middle_name         = $2,
        last_name           = $3,
        email               = $4,
        phone               = $5,
        alt_phone           = $6,
        date_of_birth       = $7,
        gender              = $8,
        aadhar_number       = $9,
        address             = $10,
        city                = $11,
        state               = $12,
        zip_code            = $13,
        department          = $14,
        position            = $15,
        employment_type     = $16,
        joining_date        = $17,
        circle              = $18,
        project_name        = $19,
        reporting_manager   = $20,
        basic_salary        = $21,
        hra                 = $22,
        other_allowances    = $23,
        bank_name           = $24,
        account_number      = $25,
        ifsc_code           = $26,
        account_holder_name = $27,
        bank_branch         = $28,
        status              = $29,
        updated_at          = CURRENT_TIMESTAMP
      WHERE id::text = $30 OR employee_id = $30
      RETURNING *
    `, [
      b.firstName                       || null,  // $1
      b.middleName                      || null,  // $2
      b.lastName                        || null,  // $3
      b.email                           || null,  // $4
      b.phone                           || null,  // $5
      b.altPhone                        || null,  // $6
      b.dob                             || null,  // $7
      b.gender                          || null,  // $8
      b.aadhar                          || null,  // $9
      b.address                         || '',    // $10
      b.city                            || '',    // $11
      b.state                           || '',    // $12
      b.zipCode                         || '',    // $13
      b.department                      || null,  // $14
      b.designation                     || null,  // $15  (maps to position column)
      b.employmentType                  || null,  // $16
      b.joiningDate                     || null,  // $17
      b.circle                          || null,  // $18
      b.projectName                     || null,  // $19
      b.reportingManager                || null,  // $20
      parseFloat(b.basicSalary)         || 0,     // $21
      parseFloat(b.hra)                 || 0,     // $22
      parseFloat(b.otherAllowances)     || 0,     // $23
      b.bankName                        || null,  // $24
      b.accountNumber                   || null,  // $25
      b.ifscCode                        || null,  // $26
      b.accountHolderName               || null,  // $27
      b.bankBranch                      || null,  // $28
      b.status                          || 'Active', // $29
      String(id),                                 // $30
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Return full employee with documents
    const full = await pool.query(
      `${EMP_SELECT} WHERE e.id = $1 GROUP BY e.id`,
      [rows[0].id]
    );

    console.log(`✅ Employee updated: ${rows[0].employee_id}`);
    return res.json({ success: true, message: 'Employee updated successfully', data: full.rows[0] });

  } catch (err) {
    console.error('[PUT /api/employees/:id]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update employee', detail: err.message });
  }
});

// ── PATCH /api/employees/:id/status ───────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;
    const allowed    = ['Active', 'Inactive', 'Pending', 'active', 'inactive'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const { rows } = await pool.query(`
      UPDATE employees SET status=$1, updated_at=CURRENT_TIMESTAMP
      WHERE id::text=$2 OR employee_id=$2 RETURNING *
    `, [status, String(id)]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Status updated', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

// ── DELETE /api/employees/:id — soft delete ────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      UPDATE employees SET status='Inactive', updated_at=CURRENT_TIMESTAMP
      WHERE id::text=$1 OR employee_id=$1
      RETURNING id, employee_id, first_name, last_name, status
    `, [String(req.params.id)]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.json({ success: true, message: 'Employee deactivated', data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate employee' });
  }
});

export default router;