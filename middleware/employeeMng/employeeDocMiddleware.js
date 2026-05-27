// middleware/employeeDocMiddleware.js
// Multer configs and shared utilities for all employee-doc upload routes.

import multer from 'multer';
import path   from 'path';
import fs     from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Upload directory ──────────────────────────────────────────────────────────
export const PROJECT_ROOT = path.resolve(__dirname, '../');
export const UPLOAD_DIR   = path.join(PROJECT_ROOT, 'uploads', 'employee_submitted_docs');

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

const ALLOWED_MIMES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf',
];

const fileFilter = (_req, file, cb) =>
  ALLOWED_MIMES.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('Only PDF and image files are accepted'), false);

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB

// ── Three multer instances ────────────────────────────────────────────────────

/**
 * Employee self-upload: signed_kye (required) + other (up to 3)
 */
const _uploadEmployee = multer({ storage, limits: { fileSize: FILE_SIZE_LIMIT }, fileFilter })
  .fields([
    { name: 'signed_kye', maxCount: 1 },
    { name: 'other',      maxCount: 3 },
  ]);

/**
 * HR BGV / email-screenshot upload
 */
const _uploadHRBgv = multer({ storage, limits: { fileSize: FILE_SIZE_LIMIT }, fileFilter })
  .fields([
    { name: 'bgv_form',          maxCount: 1 },
    { name: 'email_screenshot',  maxCount: 1 },
  ]);

/**
 * HR KYE insert / replace
 */
const _uploadHRKye = multer({ storage, limits: { fileSize: FILE_SIZE_LIMIT }, fileFilter })
  .fields([{ name: 'signed_kye', maxCount: 1 }]);

// ── Promise wrappers ──────────────────────────────────────────────────────────
const promisify = (fn) => (req, res) =>
  new Promise((resolve, reject) =>
    fn(req, res, (err) => (err ? reject(err) : resolve()))
  );

export const runUploadEmployee = promisify(_uploadEmployee);
export const runUploadHRBgv    = promisify(_uploadHRBgv);
export const runUploadHRKye    = promisify(_uploadHRKye);

// ── Express middleware factory ────────────────────────────────────────────────
/**
 * Wraps any multer runner and converts errors into 400 JSON responses.
 * Usage: router.post('/path', handleMulterError(runUploadEmployee), controller.fn)
 */
export function handleMulterError(multerRunner) {
  return async (req, res, next) => {
    try {
      await multerRunner(req, res);
      next();
    } catch (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'File too large — maximum 10 MB per file'
          : err.message;
      return res.status(400).json({ success: false, message });
    }
  };
}

// ── Cleanup helper ────────────────────────────────────────────────────────────
export function cleanupFiles(files = {}) {
  Object.values(files)
    .flat()
    .forEach((f) => {
      try { fs.unlinkSync(f.path); } catch (_) {}
    });
}