// middleware/employeeMiddleware.js
// Handles: multer uploads, no-cache headers, UAN validation, multer error wrapper

import path from 'path';
import fs   from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Upload directory ──────────────────────────────────────────────────────────
export const PROJECT_ROOT = path.resolve(__dirname, '../');
export const UPLOAD_DIR   = path.join(PROJECT_ROOT, 'uploads', 'employee_docs');

// ── Shared storage engine ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

// ── File-type filters ─────────────────────────────────────────────────────────
const imageAndPdfFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Only images and PDFs are allowed'), false);
};

const imageOnlyFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Only image files are allowed'), false);
};

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5 MB

// ── Multer instances ──────────────────────────────────────────────────────────

/**
 * For POST /api/employees  — photo + aadharCard + panCard + bankPassbook
 */
const _uploadMultiFields = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter: imageAndPdfFilter,
}).fields([
  { name: 'photo',        maxCount: 1 },
  { name: 'aadharCard',   maxCount: 1 },
  { name: 'panCard',      maxCount: 1 },
  { name: 'bankPassbook', maxCount: 1 },
]);

/**
 * For POST /api/employees/:id/upload-photo  — single image
 */
const _uploadPhotoOnly = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter: imageOnlyFilter,
}).single('photo');

/**
 * For POST /api/employees/:id/upload-document  — any field name, image or PDF
 */
const _uploadDocAny = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter: imageAndPdfFilter,
}).any();

// ── Promise wrappers (so controllers can await them) ──────────────────────────
const promisify = (fn) => (req, res) =>
  new Promise((resolve, reject) =>
    fn(req, res, (err) => (err ? reject(err) : resolve()))
  );

export const runUploadMultiFields = promisify(_uploadMultiFields);
export const runUploadPhotoOnly   = promisify(_uploadPhotoOnly);
export const runUploadDocAny      = promisify(_uploadDocAny);

// ── Express middleware (use directly in router.use / router.post) ─────────────

/**
 * Wraps a multer runner and converts errors to 400 JSON responses.
 * Usage:  router.post('/', handleMulterError(runUploadMultiFields), controller.create)
 */
export function handleMulterError(multerRunner) {
  return async (req, res, next) => {
    try {
      await multerRunner(req, res);
      next();
    } catch (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File must be under 5 MB'
          : err.message;
      return res.status(400).json({ success: false, message });
    }
  };
}

/**
 * Disables all client-side caching.
 */
export function noCache(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
}

/**
 * Validates req.body.uanNumber and attaches sanitised value to req.uanNumber.
 * Skips if the field is absent / empty.
 */
export function validateUAN(req, res, next) {
  const raw = req.body?.uanNumber?.toString().trim() || null;
  if (raw && !/^\d{1,12}$/.test(raw)) {
    return res.status(400).json({
      success: false,
      message: 'UAN Number must be numeric and up to 12 digits.',
    });
  }
  req.uanNumber = raw; // available downstream
  next();
}

// ── Utility: delete uploaded files on error ───────────────────────────────────
export function cleanupFiles(files = {}) {
  Object.values(files)
    .flat()
    .forEach((f) => {
      try { fs.unlinkSync(f.path); } catch (_) {}
    });
}