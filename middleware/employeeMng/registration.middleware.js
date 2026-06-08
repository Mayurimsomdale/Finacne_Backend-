// middleware/employeeMng/registration.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Middleware for the employee registration form submission flow.
// Covers: multer upload, link/token resolution, rejoin guard, aadhar dup-check.
//
// S3 CHANGE: switched from diskStorage to memoryStorage.
// Files now land in req.files[field][n].buffer — nothing written to disk.
// cleanupFiles() becomes a no-op — no disk temp files to remove.
// All original logic (resolveSubmissionContext, guardNoDuplicateAadhar) is
// completely unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import multer from "multer";
import pool from "../../config/database.js";

// ── Memory storage ────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();


  const _upload = multer({
  storage,
  limits: { 
    fileSize: 20 * 1024 * 1024,   // 20MB per file
    files: 10,                     // max 10 files total
    fieldSize: 10 * 1024 * 1024,  // 10MB for text fields
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(
          new Error(
            "Invalid file type — only JPEG, PNG, WEBP and PDF are accepted.",
          ),
          false,
        );
  },
}).fields([
  { name: "idPhoto", maxCount: 1 },
  { name: "aadharCard", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
  { name: "resume", maxCount: 1 },
  { name: "medicalCertificate", maxCount: 1 },
  { name: "academicRecords", maxCount: 1 },
  { name: "bankPassbook", maxCount: 1 },
  { name: "payslip", maxCount: 1 },
  { name: "farmToCli", maxCount: 1 },
  { name: "otherCertificates", maxCount: 1 },
]);

/**
 * No-op — kept for import compatibility.
 * With memoryStorage there are no temp files on disk to delete.
 */
export function cleanupFiles(_files = {}) {}

// ─── handleUpload ─────────────────────────────────────────────────────────────
export const handleUpload = (req, res, next) => {
  _upload(req, res, (err) => {
    if (!err) return next();

    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File size must be less than 5 MB."
        : err.message || "File upload error.";

    return res.status(400).json({ success: false, message });
  });
};

// ─── resolveSubmissionContext ─────────────────────────────────────────────────
export const resolveSubmissionContext = async (req, res, next) => {
  const d = req.body;
  const str = (v) =>
    v !== undefined && v !== null && String(v).trim() !== ""
      ? String(v).trim()
      : null;
  const bool = (v) => v === true || v === "true" || v === "1";

  const linkId = str(d.linkId);
  const resubmitToken = str(d.resubmitToken);
  const isRejoin = bool(d.isRejoin);

  try {
    // ── Flow 1: resubmit ───────────────────────────────────────────────────
    if (resubmitToken) {
      const { rows } = await pool.query(
        `SELECT id FROM employees
         WHERE resubmit_token = $1
           AND resubmit_expires_at > CURRENT_TIMESTAMP
           AND status = 'rejected'`,
        [resubmitToken],
      );

      if (!rows[0]) {
        return res.status(410).json({
          success: false,
          message: "Resubmission link is invalid or has expired.",
        });
      }

      req.submissionType = "resubmit";
      req.existingEmpId = rows[0].id;
      return next();
    }

    // ── Flow 2: rejoin ─────────────────────────────────────────────────────
    if (isRejoin) {
      const aadhar = str(d.aadhar)?.replace(/\s/g, "") || null;
      if (!aadhar) {
        return res.status(400).json({
          success: false,
          message: "Aadhaar number is required for rejoin.",
        });
      }

      const { rows: empRows } = await pool.query(
        `SELECT * FROM employees
         WHERE aadhar_number = $1
         ORDER BY created_at DESC LIMIT 1`,
        [aadhar],
      );

      if (!empRows[0]) {
        return res.status(404).json({
          success: false,
          message: "No existing record found for this Aadhaar number.",
        });
      }

      const emp = empRows[0];

      if (emp.status === "blacklisted") {
        return res.status(403).json({
          success: false,
          message: "This employee is blacklisted and cannot rejoin.",
        });
      }
      if (emp.status === "active") {
        return res.status(409).json({
          success: false,
          message: "This employee is currently active.",
        });
      }

      if (!linkId) {
        return res.status(400).json({
          success: false,
          message: "Missing registration link ID for rejoin request.",
        });
      }

      const { rows: linkRows } = await pool.query(
        `SELECT * FROM registration_links WHERE link_id = $1`,
        [linkId],
      );

      if (!linkRows[0]) {
        return res
          .status(404)
          .json({ success: false, message: "Invalid registration link." });
      }

      const link = linkRows[0];

      if (link.is_used) {
        return res
          .status(410)
          .json({ success: false, used: true, message: "Link already used." });
      }
      if (new Date(link.expires_at) < new Date()) {
        return res
          .status(410)
          .json({ success: false, expired: true, message: "Link expired." });
      }

      req.submissionType = "rejoin";
      req.existingEmp = emp;
      req.existingEmpId = emp.id;
      req.registrationLink = link;
      return next();
    }

    // ── Flow 3: new employee ───────────────────────────────────────────────
    if (linkId) {
      const { rows: linkRows } = await pool.query(
        `SELECT * FROM registration_links WHERE link_id = $1`,
        [linkId],
      );

      if (!linkRows[0]) {
        return res
          .status(404)
          .json({ success: false, message: "Invalid registration link." });
      }

      const link = linkRows[0];

      if (link.is_used) {
        return res
          .status(410)
          .json({ success: false, used: true, message: "Link already used." });
      }
      if (new Date(link.expires_at) < new Date()) {
        return res
          .status(410)
          .json({ success: false, expired: true, message: "Link expired." });
      }

      req.submissionType = "new";
      req.registrationLink = link;
      return next();
    }

    // ── None of the above ──────────────────────────────────────────────────
    return res.status(400).json({
      success: false,
      message: "Missing linkId or resubmitToken.",
    });
  } catch (err) {
    console.error("❌ [resolveSubmissionContext]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── guardNoDuplicateAadhar ────────────────────────────────────────────────
export const guardNoDuplicateAadhar = async (req, res, next) => {
  if (req.submissionType !== "new") return next();

  const raw = req.body.aadhar;
  const str = (v) =>
    v !== undefined && v !== null && String(v).trim() !== ""
      ? String(v).trim()
      : null;
  const aadhar = str(raw)?.replace(/\s/g, "") || null;

  if (!aadhar) return next();

  try {
    const { rows } = await pool.query(
      `SELECT id, status FROM employees WHERE aadhar_number = $1`,
      [aadhar],
    );

    if (rows.length > 0) {
      return res.status(409).json({
        success: false,
        aadharExists: true,
        status: rows[0].status,
        message: "An employee with this Aadhaar number already exists.",
      });
    }

    next();
  } catch (err) {
    console.error("❌ [guardNoDuplicateAadhar]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};
