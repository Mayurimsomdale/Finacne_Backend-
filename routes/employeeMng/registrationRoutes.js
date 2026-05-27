// routes/registration.routes.js


import express from 'express';

import {
  handleUpload,
  resolveSubmissionContext,
  guardNoDuplicateAadhar,
} from '../../middleware/employeeMng/registration.middleware.js';

import { requireAdmin } from '../../middleware/employeeMng/registrationLink.middleware.js';

import {
  checkAadhar,
  getPrefill,
  submitRegistration,
  getPending,
  approve,
  reject,
  rejectRejoin,
} from '../../controllers/employeeMng/registrationController.js';

const router = express.Router();

// ── Public endpoints (called from the employee-facing registration form) ──────

// GET /api/registrations/check-aadhar/:aadhar

router.get('/check-aadhar/:aadhar', checkAadhar);

// GET /api/registrations/prefill/:token

router.get('/prefill/:token', getPrefill);

// POST /api/registrations

router.post(
  '/',
  handleUpload,
  resolveSubmissionContext,
  guardNoDuplicateAadhar,
  submitRegistration
);

// ── Admin endpoints ───────────────────────────────────────────────────────────

// GET /api/registrations/pending
// List all pending and pending_rejoin submissions for the HR dashboard.
router.get('/pending', requireAdmin, getPending);

// POST /api/registrations/:id/approve
// Approve a pending submission — generates employee ID, sends approval email.
router.post('/:id/approve', requireAdmin, approve);

// POST /api/registrations/:id/reject
// Reject a new/resubmit submission — sends resubmission link.
router.post('/:id/reject', requireAdmin, reject);

// POST /api/registrations/:id/reject-rejoin
// Reject a rejoin request — restores snapshot, sends re-edit link.
router.post('/:id/reject-rejoin', requireAdmin, rejectRejoin);

export default router;