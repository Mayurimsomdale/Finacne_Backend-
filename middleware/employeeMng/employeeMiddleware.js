// middleware/employeeMng/employeeMiddleware.js
// Handles: multer uploads (memoryStorage for S3), no-cache headers,
// UAN validation, multer error wrapper.
//
// S3 CHANGE: switched from diskStorage to memoryStorage.
// Files now land in req.file.buffer / req.files[field][n].buffer.
// No files are ever written to local disk.
// PROJECT_ROOT and UPLOAD_DIR are kept as exports so any controller that
// already imports them does not need to change (they are unused for saving).
// cleanupFiles() becomes a no-op — nothing on disk to delete.

import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Kept for backward-compat imports (no longer used for saving files) ────────
export const PROJECT_ROOT = path.resolve(__dirname, "../");
export const UPLOAD_DIR = path.join(PROJECT_ROOT, "uploads", "employee_docs");

// ── Memory storage — files land in req.file.buffer ───────────────────────────
const storage = multer.memoryStorage();

// ── File-type filters ─────────────────────────────────────────────────────────
const imageAndPdfFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only images and PDFs are allowed"), false);
};

const imageOnlyFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only image files are allowed"), false);
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
  { name: "id_photo", maxCount: 1 },
  { name: "aadhar_card", maxCount: 1 },
  { name: "pan_card", maxCount: 1 },
  { name: "bank_passbook", maxCount: 1 },
  { name: "resume", maxCount: 1 },
  { name: "medical_certificate", maxCount: 1 },
  { name: "academic_records", maxCount: 1 },
  { name: "payslip", maxCount: 1 },
  { name: "other_certificates", maxCount: 1 },
  { name: "farm_to_cli", maxCount: 1 },
]);

/**
 * For POST /api/employees/:id/upload-photo  — single image
 */
const _uploadPhotoOnly = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter: imageOnlyFilter,
}).single("photo");

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
    fn(req, res, (err) => (err ? reject(err) : resolve())),
  );

export const runUploadMultiFields = promisify(_uploadMultiFields);
export const runUploadPhotoOnly = promisify(_uploadPhotoOnly);
export const runUploadDocAny = promisify(_uploadDocAny);

// ── Express middleware factory ────────────────────────────────────────────────

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
        err.code === "LIMIT_FILE_SIZE"
          ? "File must be under 5 MB"
          : err.message;
      return res.status(400).json({ success: false, message });
    }
  };
}

/**
 * Disables all client-side caching.
 */
export function noCache(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
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
      message: "UAN Number must be numeric and up to 12 digits.",
    });
  }
  req.uanNumber = raw;
  next();
}

/**
 * No-op — kept for import compatibility.
 * With memoryStorage there are no temp files on disk to delete.
 * S3 rollback (if needed) is done directly in controllers via deleteFileFromS3().
 */
export function cleanupFiles(_files = {}) {}
