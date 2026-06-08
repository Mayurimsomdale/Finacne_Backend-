// middleware/Advancepayment.js
//
// S3 CHANGE: switched from diskStorage to memoryStorage.
// Files now land in req.files[field][n].buffer — nothing written to disk.
// uploadMiddleware export signature is identical to the original.
// getRelativePath() and UPLOADS_ROOT kept for backward-compat imports.
// All original logic (field names, size limit, file filter) is unchanged.

import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Kept for backward-compat ──────────────────────────────────────────────────
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
export { UPLOADS_ROOT };

// ── Memory storage ────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();

// ── File filter (unchanged) ───────────────────────────────────────────────────
const ALLOWED = /\.(png|jpe?g|webp|gif|pdf|doc|docx|xlsx|csv)$/i;

const fileFilter = (_req, file, cb) => {
  if (ALLOWED.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname}`), false);
  }
};

// ── Multer instance ───────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

// ── Middleware: accept screenshot (required) + proof + receipt (optional) ─────
export const uploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: "screenshot", maxCount: 1 },
    { name: "proof", maxCount: 1 },
    { name: "receipt", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE")
        return res
          .status(400)
          .json({ success: false, message: "File must be smaller than 5 MB" });
      if (err.code === "LIMIT_UNEXPECTED_FILE")
        return res
          .status(400)
          .json({
            success: false,
            message: `Unexpected file field: ${err.field}`,
          });
      return res.status(400).json({ success: false, message: err.message });
    }

    return res.status(400).json({ success: false, message: err.message });
  });
};

/**
 * Kept for backward-compat — with S3 the key IS the relative path already.
 * Returns the input unchanged if it doesn't contain 'uploads/'.
 */
export function getRelativePath(absolutePath) {
  const norm = absolutePath.replace(/\\/g, "/");
  const idx = norm.indexOf("uploads/");
  return idx !== -1 ? norm.slice(idx) : norm;
}
