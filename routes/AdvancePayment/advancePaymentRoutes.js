// ─────────────────────────────────────────────────────────────────────────────
// FILE: routes/AdvancePayment/advancePaymentRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticateAdmin as verifyToken } from '../../middleware/auth.js';
import { uploadMiddleware } from '../../middleware/Advancepayment.js';

import {
  // Payment types
  getPaymentTypes,

  // Stats
  getStats,

  // Requests
  listRequests,
  getRequest,
  createRequest,
  createPublicRequest,
  approveRequest,
  rejectRequest,

  // Resubmit token (public)
  validateResubmitToken,

  // Deductions
  getDeductions,
  updateDeduction,

  // Links
  createLink,
  sendLinkEmail,
  validateLink,
  listLinks,

  // Salary history
  getSalaryHistory,
} from '../../controllers/AdvancePayment/advancePaymentController.js';

const router = Router();

// ── Payment types (public — needed for employee link form) ────────────────────
router.get('/types', getPaymentTypes);

// ── Stats (admin) ─────────────────────────────────────────────────────────────
router.get('/stats', verifyToken, getStats);

// ── Resubmit token (public — employee validates their resubmit link) ──────────
// IMPORTANT: must be defined BEFORE any /:id routes to avoid param conflict
router.get('/resubmit/:token', validateResubmitToken);

// ── Requests ──────────────────────────────────────────────────────────────────
// IMPORTANT: /requests/public must be defined BEFORE /requests/:id
router.get  ('/requests',                 verifyToken,      listRequests);
router.post ('/requests/public',          uploadMiddleware,  createPublicRequest);  
router.post ('/requests',                 uploadMiddleware,  createRequest);        
router.get  ('/requests/:id',             verifyToken,       getRequest);
router.post ('/requests/:id/approve',     verifyToken,       approveRequest);
router.post ('/requests/:id/reject',      verifyToken,       rejectRequest);

// ── Deductions ────────────────────────────────────────────────────────────────
router.get  ('/requests/:id/deductions',  verifyToken,       getDeductions);
router.patch('/deductions/:id',           verifyToken,       updateDeduction);

// ── Links ─────────────────────────────────────────────────────────────────────
router.post('/links',                     verifyToken,       createLink);
router.get ('/links',                     verifyToken,       listLinks);
router.post('/links/send-email',          verifyToken,       sendLinkEmail);
router.get ('/links/:token/validate',                        validateLink);   // public

// ── Salary history (admin) ────────────────────────────────────────────────────
router.get('/salary-history', verifyToken, getSalaryHistory);

export default router;