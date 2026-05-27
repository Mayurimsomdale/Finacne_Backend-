// routes/employeeDocUploadRoutes.js
import express from 'express';
import {
  handleMulterError,
  runUploadEmployee,
  runUploadHRBgv,
  runUploadHRKye,
} from '../../middleware/employeeMng/employeeDocMiddleware.js';
import * as ctrl from '../../controllers/employeeMng/employeeDocController.js';

const router = express.Router();

// ── Token validation (public — employee uses this before uploading) ────────────
router.get('/validate/:token',          ctrl.validateToken);

// ── Employee self-upload ──────────────────────────────────────────────────────
router.post(
  '/upload/:token',
  handleMulterError(runUploadEmployee),
  ctrl.employeeUpload
);

// ── HR: view submissions ──────────────────────────────────────────────────────
router.get('/submissions/:empDbId',     ctrl.getSubmissions);
router.get('/pending',                  ctrl.getPending);
router.get('/reviewed',                 ctrl.getReviewed);

// ── HR: review actions ────────────────────────────────────────────────────────
router.post('/mark-reviewed/:docId',    ctrl.markReviewed);
router.post('/reject-doc/:docId',       ctrl.rejectDoc);

// ── HR: generate a fresh upload link ─────────────────────────────────────────
router.post('/generate-upload-link/:empDbId', ctrl.generateUploadLink);

// ── HR BGV / email-screenshot ─────────────────────────────────────────────────
router.post(
  '/hr-upload/:empDbId',
  handleMulterError(runUploadHRBgv),
  ctrl.hrUpload
);
router.get(   '/hr-uploads/:empDbId',   ctrl.getHRUploads);
router.delete('/hr-uploads/:docId',     ctrl.deleteHRUpload);

// ── HR KYE CRUD ───────────────────────────────────────────────────────────────
router.post(
  '/hr-kye-upload/:empDbId',
  handleMulterError(runUploadHRKye),
  ctrl.hrKyeInsert
);
router.put(
  '/kye/:docId',
  handleMulterError(runUploadHRKye),
  ctrl.hrKyeReplace
);
router.delete('/kye/:docId',            ctrl.hrKyeDelete);

export default router;