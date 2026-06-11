// middleware/employeeMng/registration.middleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Multer upload + submission context resolution + aadhar dup-check.
// Field names match DB columns exactly.
// memoryStorage — nothing written to disk.
// ─────────────────────────────────────────────────────────────────────────────

import multer from "multer";
import pool from "../../config/database.js";

// ── Memory storage ────────────────────────────────────────────────────────────
const storage = multer.memoryStorage();

// ── Multer instance ───────────────────────────────────────────────────────────
// Field names MUST match exactly what RegistrationForm.jsx appends to FormData.
const _upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
    files: 10, // max 10 files total
    fieldSize: 10 * 1024 * 1024, // 10 MB for text fields
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
  // ── camelCase names match RegistrationForm.jsx FormData.append() calls ──
  { name: "idPhoto", maxCount: 1 }, // → id_photo_url
  { name: "aadharCard", maxCount: 1 }, // → aadhar_card_url
  { name: "panCard", maxCount: 1 }, // → pan_card_url
  { name: "resume", maxCount: 1 }, // → resume_url
  { name: "bankPassbook", maxCount: 1 }, // → bank_passbook_url
  { name: "medicalCertificate", maxCount: 1 }, // → medical_certificate_url
  { name: "academicRecords", maxCount: 1 }, // → academic_records_url
  { name: "payslip", maxCount: 1 }, // → pay_slip_url
  { name: "farmToCli", maxCount: 1 }, // → farm_to_cli_certificate_url
  { name: "otherCertificates", maxCount: 1 }, // → other_certificates_url
]);

// ── No-op — kept for import compatibility ────────────────────────────────────
export function cleanupFiles(_files = {}) {}

// ── handleUpload ──────────────────────────────────────────────────────────────
export const handleUpload = (req, res, next) => {
  _upload(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File size must be less than 20 MB."
        : err.message || "File upload error.";
    return res.status(400).json({ success: false, message });
  });
};

// ── resolveSubmissionContext ──────────────────────────────────────────────────
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
        `SELECT * FROM employees WHERE aadhar_number = $1 ORDER BY created_at DESC LIMIT 1`,
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
      if (link.is_used)
        return res
          .status(410)
          .json({ success: false, used: true, message: "Link already used." });
      if (new Date(link.expires_at) < new Date())
        return res
          .status(410)
          .json({ success: false, expired: true, message: "Link expired." });

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
      if (link.is_used)
        return res
          .status(410)
          .json({ success: false, used: true, message: "Link already used." });
      if (new Date(link.expires_at) < new Date())
        return res
          .status(410)
          .json({ success: false, expired: true, message: "Link expired." });

      req.submissionType = "new";
      req.registrationLink = link;
      return next();
    }

    return res
      .status(400)
      .json({ success: false, message: "Missing linkId or resubmitToken." });
  } catch (err) {
    console.error("❌ [resolveSubmissionContext]", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── guardNoDuplicateAadhar ────────────────────────────────────────────────────
export const guardNoDuplicateAadhar = async (req, res, next) => {
  if (req.submissionType !== "new") return next();

  const str = (v) =>
    v !== undefined && v !== null && String(v).trim() !== ""
      ? String(v).trim()
      : null;
  const aadhar = str(req.body.aadhar)?.replace(/\s/g, "") || null;
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
