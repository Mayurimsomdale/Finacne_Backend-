// routes/employeeMng/registrationRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Routes for the employee registration form submission flow.
// Public endpoints — no auth required for form submission.
// Admin endpoints — requireAdmin middleware applied.
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";

import {
  handleUpload,
  resolveSubmissionContext,
  guardNoDuplicateAadhar,
} from "../../middleware/employeeMng/registration.middleware.js";

import { requireAdmin } from "../../middleware/employeeMng/registrationLink.middleware.js";

import {
  checkAadhar,
  getPrefill,
  submitRegistration,
  getPending,
  approve,
  reject,
  rejectRejoin,
} from "../../controllers/employeeMng/registrationController.js";

const router = express.Router();

// ── Public endpoints (no auth — called from employee-facing registration form) ─

// GET /api/registrations/check-aadhar/:aadhar
router.get("/check-aadhar/:aadhar", checkAadhar);

// GET /api/registrations/prefill/:token
router.get("/prefill/:token", getPrefill);

// POST /api/registrations
// handleUpload     → multer parses multipart (files + fields)
// resolveSubmission→ sets req.submissionType, req.registrationLink, req.existingEmpId
// guardNoDuplicate → blocks duplicate Aadhaar for new registrations only
router.post(
  "/",
  handleUpload,
  resolveSubmissionContext,
  guardNoDuplicateAadhar,
  submitRegistration,
);

// ── Admin endpoints ───────────────────────────────────────────────────────────

// GET /api/registrations/pending
router.get("/pending", requireAdmin, getPending);

// POST /api/registrations/:id/approve
router.post("/:id/approve", requireAdmin, approve);

// POST /api/registrations/:id/reject
router.post("/:id/reject", requireAdmin, reject);

// POST /api/registrations/:id/reject-rejoin
router.post("/:id/reject-rejoin", requireAdmin, rejectRejoin);

export default router;
