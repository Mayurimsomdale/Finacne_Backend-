// routes/registrationRoutes.js
import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pool from '../../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ── Multer setup ───────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

const docFields = upload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'idPhoto', maxCount: 1 },
  { name: 'bankPassbook', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
]);

// ── Helpers ────────────────────────────────────────────────────────────────
const getFilePath = (files, field) =>
  files?.[field]?.[0] ? `/uploads/${files[field][0].filename}` : null;
const getFileName = (files, field) =>
  files?.[field]?.[0]?.originalname || null;
const getFileSize = (files, field) =>
  files?.[field]?.[0]?.size || null;
const getFileMime = (files, field) =>
  files?.[field]?.[0]?.mimetype || null;

const deleteUploadedFiles = (files) => {
  if (!files) return;
  Object.values(files).flat().forEach((f) => {
    const fullPath = path.join(__dirname, '../uploads', f.filename);
    fs.unlink(fullPath, () => {});
  });
};

// =============================================================================
// POST /api/registrations
// Employee submits self-registration form
// =============================================================================
router.post('/', docFields, async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body;

    console.log('📝 Registration:', `${b.firstName} ${b.lastName}`, b.email, 'linkId:', b.linkId);

    // Validate required docs
    if (!req.files?.idPhoto?.[0]) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'ID Photo is required' });
    }
    if (!req.files?.aadharCard?.[0]) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'Aadhar card is required' });
    }
    if (!req.files?.bankPassbook?.[0]) {
      deleteUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'Bank passbook is required' });
    }

    // Validate the link
    const { rows: linkRows } = await client.query(
      'SELECT * FROM registration_links WHERE link_id = $1',
      [b.linkId]
    );
    const link = linkRows[0];

    if (!link) {
      deleteUploadedFiles(req.files);
      return res.status(404).json({ success: false, message: 'Invalid registration link' });
    }
    if (link.is_used) {
      deleteUploadedFiles(req.files);
      return res.status(410).json({ success: false, used: true, message: 'This link has already been used' });
    }
    if (new Date(link.expires_at) < new Date()) {
      deleteUploadedFiles(req.files);
      return res.status(410).json({ success: false, expired: true, message: 'This link has expired' });
    }

    await client.query('BEGIN');

    // Insert employee with status='pending'
    const { rows: empRows } = await client.query(
      `INSERT INTO employees (
         registration_link_id,
         first_name, middle_name, last_name,
         email, phone, date_of_birth, gender,
         address, city, state, zip_code,
         bank_name, account_number, ifsc_code, account_holder_name, bank_branch,
         position, department, circle, project_name,
         joining_date, reporting_manager, employment_type,
         status
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'pending'
       ) RETURNING id`,
      [
        link.id,
        b.firstName, b.middleName || null, b.lastName,
        b.email, b.phone, b.dateOfBirth, b.gender,
        b.address || '', b.city || '', b.state || '', b.zipCode || '',
        b.bankName, b.accountNumber, b.ifscCode,
        b.accountHolderName || `${b.firstName} ${b.lastName}`,
        b.bankBranch || null,
        b.position || b.designation || '', b.department || '',
        b.circle || null, b.projectName || null,
        b.joiningDate, b.reportingManager || null, b.employmentType || '',
      ]
    );
    const newEmpDbId = empRows[0].id;

    // Insert documents
    const docTypes = [
      { field: 'aadharCard', type: 'aadharCard' },
      { field: 'idPhoto', type: 'idPhoto' },
      { field: 'bankPassbook', type: 'bankPassbook' },
      { field: 'panCard', type: 'panCard' },
    ];

    for (const doc of docTypes) {
      const fp = getFilePath(req.files, doc.field);
      if (fp) {
        await client.query(
          `INSERT INTO employee_documents (employee_id, document_type, file_path, file_name, file_size, mime_type)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [newEmpDbId, doc.type, fp, getFileName(req.files, doc.field),
           getFileSize(req.files, doc.field), getFileMime(req.files, doc.field)]
        );
      }
    }

    // Mark link as used
    await client.query(
      `UPDATE registration_links SET is_used=true, status='used', used_at=NOW() WHERE id=$1`,
      [link.id]
    );

    await client.query('COMMIT');

    console.log(`✅ Registration submitted → pending DB id: ${newEmpDbId}`);
    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully! HR will review your application.',
      data: { id: newEmpDbId }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    deleteUploadedFiles(req.files);
    console.error('❌ submitRegistration:', err.message);
    if (err.code === '23505' && err.constraint?.includes('email')) {
      return res.status(409).json({ success: false, message: 'An application with this email already exists.' });
    }
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// GET /api/registrations/pending
// Admin fetches all pending submissions
// =============================================================================
router.get('/pending', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: employees } = await client.query(
      `SELECT e.*, rl.link_id
       FROM employees e
       LEFT JOIN registration_links rl ON rl.id = e.registration_link_id
       WHERE e.status = 'pending'
       ORDER BY e.created_at DESC`
    );

    const result = await Promise.all(
      employees.map(async (emp) => {
        const { rows: docs } = await client.query(
          'SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY uploaded_at',
          [emp.id]
        );
        const docMap = {};
        docs.forEach((d) => {
          docMap[`${d.document_type}_url`] = d.file_path;
        });
        return { ...emp, ...docMap, documents: docs };
      })
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ getPending:', err.message);
    res.status(500).json({ success: false, message: err.message });
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
    const { id } = req.params;

    const { rows } = await client.query(
      "SELECT * FROM employees WHERE id=$1 AND status='pending'",
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Pending submission not found' });
    }

    // Auto-generate employee ID
    const { rows: maxRows } = await client.query(
      `SELECT MAX(CAST(SUBSTRING(employee_id FROM 4) AS INTEGER)) AS max_num
       FROM employees WHERE employee_id ~ '^EMP[0-9]+$'`
    );
    const nextNum = (maxRows[0].max_num || 0) + 1;
    const employeeId = `EMP${String(nextNum).padStart(3, '0')}`;

    await client.query(
      `UPDATE employees SET status='active', employee_id=$1, approved_at=NOW() WHERE id=$2`,
      [employeeId, id]
    );

    console.log(`✅ APPROVED: id=${id} → ${employeeId}`);
    res.json({
      success: true,
      message: `Employee approved! ID assigned: ${employeeId}`,
      data: { employeeId }
    });
  } catch (err) {
    console.error('❌ approveSubmission:', err.message);
    res.status(500).json({ success: false, message: err.message });
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
    const { id } = req.params;

    const { rows } = await client.query(
      "SELECT id FROM employees WHERE id=$1 AND status='pending'",
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Pending submission not found' });
    }

    const { rows: docs } = await client.query(
      'SELECT file_path FROM employee_documents WHERE employee_id=$1',
      [id]
    );

    await client.query('DELETE FROM employees WHERE id=$1', [id]);

    docs.forEach((doc) => {
      const fullPath = path.join(__dirname, '..', doc.file_path);
      fs.unlink(fullPath, () => {});
    });

    console.log(`❌ REJECTED & DELETED: id=${id}`);
    res.json({
      success: true,
      message: 'Registration rejected and removed from the system.'
    });
  } catch (err) {
    console.error('❌ rejectSubmission:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

export default router;