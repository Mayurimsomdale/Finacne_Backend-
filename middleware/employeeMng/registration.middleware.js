// middleware/registration.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Middleware for the employee registration form submission flow.
// Covers: multer upload, link/token resolution, rejoin guard, aadhar dup-check.
// ─────────────────────────────────────────────────────────────────────────────

import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';
import pool    from '../../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Multer setup ─────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '../');
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

const _upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png',
      'image/webp', 'application/pdf',
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Invalid file type — only JPEG, PNG, WEBP and PDF are accepted.'), false);
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

export function cleanupFiles(files = {}) {
  Object.values(files)
    .flat()
    .forEach((f) => { try { fs.unlinkSync(f.path); } catch (_) {} });
}

// ─── handleUpload ─────────────────────────────────────────────────────────────
// Wraps multer in a promise; on error cleans up any partial files and
// returns a 400 so later middleware never sees half-uploaded state.
export const handleUpload = (req, res, next) => {
  _upload(req, res, (err) => {
    if (!err) return next();

    cleanupFiles(req.files);

    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size must be less than 5 MB.'
        : err.message || 'File upload error.';

    return res.status(400).json({ success: false, message });
  });
};

// ─── resolveSubmissionContext ─────────────────────────────────────────────────
// Determines which of three flows is being used:
//   1. resubmit  — rejected employee correcting their form (resubmitToken)
//   2. rejoin    — inactive/rejected employee re-applying  (isRejoin + aadhar + linkId)
//   3. new       — brand-new employee using a link          (linkId)
//
// Sets on req:
//   req.submissionType  — 'resubmit' | 'rejoin' | 'new'
//   req.existingEmpId   — DB id for resubmit/rejoin
//   req.existingEmp     — full row for rejoin
//   req.registrationLink — full row for new/rejoin
//
// Rolls back and returns early on any invalid state.
export const resolveSubmissionContext = async (req, res, next) => {
  const d    = req.body;
  const str  = (v) => (v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : null);
  const bool = (v) => v === true || v === 'true' || v === '1';

  const linkId        = str(d.linkId);
  const resubmitToken = str(d.resubmitToken);
  const isRejoin      = bool(d.isRejoin);

  try {
    // ── Flow 1: resubmit ───────────────────────────────────────────────────
    if (resubmitToken) {
      const { rows } = await pool.query(
        `SELECT id FROM employees
         WHERE resubmit_token = $1
           AND resubmit_expires_at > CURRENT_TIMESTAMP
           AND status = 'rejected'`,
        [resubmitToken]
      );

      if (!rows[0]) {
        return res.status(410).json({
          success: false,
          message: 'Resubmission link is invalid or has expired.',
        });
      }

      req.submissionType  = 'resubmit';
      req.existingEmpId   = rows[0].id;
      return next();
    }

    // ── Flow 2: rejoin ─────────────────────────────────────────────────────
    if (isRejoin) {
      const aadhar = str(d.aadhar)?.replace(/\s/g, '') || null;
      if (!aadhar) {
        return res.status(400).json({
          success: false,
          message: 'Aadhaar number is required for rejoin.',
        });
      }

      const { rows: empRows } = await pool.query(
        `SELECT * FROM employees
         WHERE aadhar_number = $1
         ORDER BY created_at DESC LIMIT 1`,
        [aadhar]
      );

      if (!empRows[0]) {
        return res.status(404).json({
          success: false,
          message: 'No existing record found for this Aadhaar number.',
        });
      }

      const emp = empRows[0];

      if (emp.status === 'blacklisted') {
        return res.status(403).json({
          success: false,
          message: 'This employee is blacklisted and cannot rejoin.',
        });
      }
      if (emp.status === 'active') {
        return res.status(409).json({
          success: false,
          message: 'This employee is currently active.',
        });
      }

      if (!linkId) {
        return res.status(400).json({
          success: false,
          message: 'Missing registration link ID for rejoin request.',
        });
      }

      const { rows: linkRows } = await pool.query(
        `SELECT * FROM registration_links WHERE link_id = $1`,
        [linkId]
      );

      if (!linkRows[0]) {
        return res.status(404).json({ success: false, message: 'Invalid registration link.' });
      }

      const link = linkRows[0];

      if (link.is_used) {
        return res.status(410).json({ success: false, used: true, message: 'Link already used.' });
      }
      if (new Date(link.expires_at) < new Date()) {
        return res.status(410).json({ success: false, expired: true, message: 'Link expired.' });
      }

      req.submissionType    = 'rejoin';
      req.existingEmp       = emp;
      req.existingEmpId     = emp.id;
      req.registrationLink  = link;
      return next();
    }

    // ── Flow 3: new employee ───────────────────────────────────────────────
    if (linkId) {
      const { rows: linkRows } = await pool.query(
        `SELECT * FROM registration_links WHERE link_id = $1`,
        [linkId]
      );

      if (!linkRows[0]) {
        return res.status(404).json({ success: false, message: 'Invalid registration link.' });
      }

      const link = linkRows[0];

      if (link.is_used) {
        return res.status(410).json({ success: false, used: true, message: 'Link already used.' });
      }
      if (new Date(link.expires_at) < new Date()) {
        return res.status(410).json({ success: false, expired: true, message: 'Link expired.' });
      }

      req.submissionType   = 'new';
      req.registrationLink = link;
      return next();
    }

    // ── None of the above ──────────────────────────────────────────────────
    return res.status(400).json({
      success: false,
      message: 'Missing linkId or resubmitToken.',
    });

  } catch (err) {
    console.error('❌ [resolveSubmissionContext]', err.message);
    cleanupFiles(req.files);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── guardNoDuplicateAadhar ────────────────────────────────────────────────
// Only runs for the 'new' flow.
// Blocks duplicate Aadhaar registrations and surfaces the existing status.
export const guardNoDuplicateAadhar = async (req, res, next) => {
  if (req.submissionType !== 'new') return next();

  const raw = req.body.aadhar;
  const str = (v) => (v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : null);
  const aadhar = str(raw)?.replace(/\s/g, '') || null;

  if (!aadhar) return next(); // presence validation is on the controller

  try {
    const { rows } = await pool.query(
      `SELECT id, status FROM employees WHERE aadhar_number = $1`,
      [aadhar]
    );

    if (rows.length > 0) {
      return res.status(409).json({
        success:     false,
        aadharExists: true,
        status:      rows[0].status,
        message:     'An employee with this Aadhaar number already exists.',
      });
    }

    next();
  } catch (err) {
    console.error('❌ [guardNoDuplicateAadhar]', err.message);
    cleanupFiles(req.files);
    return res.status(500).json({ success: false, message: err.message });
  }
};