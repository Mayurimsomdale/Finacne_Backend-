// middleware/employeeMng/employeeDocMiddleware.js
// Multer configs, shared utilities, and CORS headers for employee-doc upload routes.

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Upload directory ──────────────────────────────────────────────────────────
export const PROJECT_ROOT = path.resolve(__dirname, "../");
export const UPLOAD_DIR = path.join(
  PROJECT_ROOT,
  "uploads",
  "employee_submitted_docs",
);

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

// ── Cleanup helper ────────────────────────────────────────────────────────────
export function cleanupFiles(files = {}) {
  Object.values(files)
    .flat()
    .forEach((f) => {
      try {
        fs.unlinkSync(f.path);
      } catch (_) {}
    });
}

// ── CORS middleware for /uploads static files ─────────────────────────────────
/**
 * FIX: This middleware resolves the "SecurityError: tainted canvas" and
 * "TypeError: Failed to fetch" errors when the PDF generator tries to
 * embed images from /uploads.
 *
 * HOW TO USE — in your main app.js / server.js, add these two lines
 * BEFORE your existing express.static call for /uploads:
 *
 *   import { uploadsCorsMw } from './middleware/employeeMng/employeeDocMiddleware.js';
 *
 *   // ✅ ADD THIS — must come before express.static
 *   app.use('/uploads', uploadsCorsMw);
 *   // your existing line (keep as-is):
 *   app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'uploads')));
 *
 * WHY THIS IS NEEDED:
 *   The browser's canvas API marks a canvas as "tainted" when an image is
 *   drawn onto it from a cross-origin URL that didn't send CORS headers.
 *   Once tainted, toBlob() / toDataURL() throw a SecurityError, which breaks
 *   the PDF download. This middleware sends the correct CORS headers so the
 *   browser allows the fetch() to read image bytes and embed them in the PDF.
 *
 * WHAT IT SENDS:
 *   Access-Control-Allow-Origin:      <your FRONTEND_URL env var>
 *   Access-Control-Allow-Credentials: true
 *   Access-Control-Allow-Methods:     GET, OPTIONS
 *   Access-Control-Allow-Headers:     Content-Type, Authorization
 *   Access-Control-Max-Age:           600  (preflight cached 10 min)
 *
 * ENVIRONMENT VARIABLE:
 *   Set FRONTEND_URL in your .env file:
 *     FRONTEND_URL=http://localhost:3000        (development)
 *     FRONTEND_URL=https://yourapp.example.com  (production)
 *
 *   If FRONTEND_URL is not set, it falls back to http://localhost:3000.
 */
export function uploadsCorsMw(req, res, next) {
  const origin = process.env.FRONTEND_URL || "http://localhost:3000";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Cache preflight for 10 minutes to reduce OPTIONS round-trips
  res.setHeader("Access-Control-Max-Age", "600");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}
