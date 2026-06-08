// middleware/employeeMng/employeeDocMiddleware.js
// Multer configs (memoryStorage for S3), shared utilities, and CORS headers
// for employee-doc upload routes.
//
// S3 CHANGE: switched from diskStorage to memoryStorage.
// Files now land in req.files[field][n].buffer — no disk writes.
// PROJECT_ROOT, UPLOAD_DIR, cleanupFiles kept for backward-compat imports.
// uploadsCorsMw is unchanged.

import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Kept for backward-compat imports ─────────────────────────────────────────
export const PROJECT_ROOT = path.resolve(__dirname, "../");
export const UPLOAD_DIR = path.join(
  PROJECT_ROOT,
  "uploads",
  "employee_submitted_docs",
);

// ── Memory storage ────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const fileFilter = (_req, file, cb) =>
  ALLOWED_MIMES.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only PDF and image files are accepted"), false);

const FILE_SIZE_LIMIT = 10 * 1024 * 1024; // 10 MB

// ── Three multer instances ────────────────────────────────────────────────────

/**
 * Employee self-upload: signed_kye (required) + other (up to 3)
 */
const _uploadEmployee = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter,
}).fields([
  { name: "signed_kye", maxCount: 1 },
  { name: "other", maxCount: 3 },
]);

/**
 * HR BGV / email-screenshot upload
 */
const _uploadHRBgv = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter,
}).fields([
  { name: "bgv_form", maxCount: 1 },
  { name: "email_screenshot", maxCount: 1 },
]);

/**
 * HR KYE insert / replace
 */
const _uploadHRKye = multer({
  storage,
  limits: { fileSize: FILE_SIZE_LIMIT },
  fileFilter,
}).fields([{ name: "signed_kye", maxCount: 1 }]);

// ── Promise wrappers ──────────────────────────────────────────────────────────
const promisify = (fn) => (req, res) =>
  new Promise((resolve, reject) =>
    fn(req, res, (err) => (err ? reject(err) : resolve())),
  );

export const runUploadEmployee = promisify(_uploadEmployee);
export const runUploadHRBgv = promisify(_uploadHRBgv);
export const runUploadHRKye = promisify(_uploadHRKye);

// ── Express middleware factory ────────────────────────────────────────────────
/**
 * Wraps any multer runner and converts errors into 400 JSON responses.
 */
export function handleMulterError(multerRunner) {
  return async (req, res, next) => {
    try {
      await multerRunner(req, res);
      next();
    } catch (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "File too large — maximum 10 MB per file"
          : err.message;
      return res.status(400).json({ success: false, message });
    }
  };
}

/**
 * No-op — kept for import compatibility.
 * With memoryStorage there are no temp files on disk to delete.
 */
export function cleanupFiles(_files = {}) {}

// ── CORS middleware for /uploads static files ─────────────────────────────────
/**
 * Unchanged from original — still useful if any legacy /uploads path is served.
 */
export function uploadsCorsMw(req, res, next) {
  const origin = process.env.FRONTEND_URL || "http://localhost:3000";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
