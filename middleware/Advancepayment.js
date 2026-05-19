// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/Advancepayment.js
// ─────────────────────────────────────────────────────────────────────────────
import multer from 'multer';
import path   from 'path';
import fs     from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Resolve uploads root ──────────────────────────────────────────────────────
// Structure:
//   backend/
//     server.js
//     uploads/
//       advance-payment/
//         2026-04/
//           file.png
//     middleware/
//       Advancepayment.js   ← THIS FILE
//
// __dirname = backend/middleware  →  one '..' up = backend/
// UPLOADS_ROOT = backend/uploads
// ADVANCE_DIR  = backend/uploads/advance-payment
// ─────────────────────────────────────────────────────────────────────────────
const UPLOADS_ROOT  = path.join(__dirname, '..', 'uploads');
const ADVANCE_DIR   = path.join(UPLOADS_ROOT, 'advance-payment');

// Create the base folder immediately on startup so we can confirm the path
fs.mkdirSync(ADVANCE_DIR, { recursive: true });

console.log('='.repeat(60));
console.log('📁 [Advancepayment middleware]');
console.log('   UPLOADS_ROOT :', UPLOADS_ROOT);
console.log('   ADVANCE_DIR  :', ADVANCE_DIR);
console.log('='.repeat(60));

// ── Storage engine ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Subfolder per year-month, e.g. advance-payment/2026-04
    const now   = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const dir   = path.join(ADVANCE_DIR, `${year}-${month}`);

    fs.mkdirSync(dir, { recursive: true });
    console.log(`📂 [multer] saving ${file.fieldname} → ${dir}`);
    cb(null, dir);
  },

  filename: (req, file, cb) => {
    // Sanitise original name and prefix with timestamp
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 60);
    const name = `${Date.now()}_${base}${ext}`;
    console.log(`📄 [multer] filename → ${name}`);
    cb(null, name);
  },
});

// ── File filter ───────────────────────────────────────────────────────────────
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
    { name: 'screenshot', maxCount: 1 },
    { name: 'proof',      maxCount: 1 },
    { name: 'receipt',    maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) {
      // Log what was received
      if (req.files) {
        Object.entries(req.files).forEach(([field, arr]) => {
          arr.forEach(f => console.log(`✅ [multer] received [${field}]: ${f.path}`));
        });
      }
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ success: false, message: 'File must be smaller than 5 MB' });
      if (err.code === 'LIMIT_UNEXPECTED_FILE')
        return res.status(400).json({ success: false, message: `Unexpected file field: ${err.field}` });
      return res.status(400).json({ success: false, message: err.message });
    }

    return res.status(400).json({ success: false, message: err.message });
  });
};

// ── Helper: convert absolute disk path → relative URL path ───────────────────
// Express serves: app.use('/uploads', express.static(UPLOADS_ROOT))
//
// File on disk : backend/uploads/advance-payment/2026-04/file.png
// Stored in DB : uploads/advance-payment/2026-04/file.png
// Browser URL  : http://localhost:5000/uploads/advance-payment/2026-04/file.png
//
export function getRelativePath(absolutePath) {
  const norm = absolutePath.replace(/\\/g, '/');
  const idx  = norm.indexOf('uploads/');
  return idx !== -1 ? norm.slice(idx) : norm;
}

// Export UPLOADS_ROOT so server.js can use the same value for express.static
export { UPLOADS_ROOT };