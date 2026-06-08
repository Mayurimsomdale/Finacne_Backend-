// routes/employeeRoutes.js
import express from "express";

import {
  noCache,
  validateUAN,
  handleMulterError,
  runUploadMultiFields,
  runUploadPhotoOnly,
  runUploadDocAny,
} from "../../middleware/employeeMng/employeeMiddleware.js";

import * as ctrl from "../../controllers/employeeMng/employeeController.js";

const router = express.Router();

// ── Apply no-cache to every employee route ────────────────────────────────────
router.use(noCache);

// ══════════════════════════════════════════════════════════════════════════════
// PRESIGNED URL  (must be before /:id param routes)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/employees/s3/presign?key=uploads/employee_docs/abc.png
 * Returns a temporary signed URL so the browser can load a private S3 file.
 */
router.get("/s3/presign", async (req, res) => {
  try {
    const { key } = req.query;
    console.log("[presign] key:", key); // ← add
    console.log("[presign] BUCKET:", process.env.AWS_BUCKET_NAME); // ← add
    console.log("[presign] REGION:", process.env.AWS_REGION); // ← add

    if (!key)
      return res.status(400).json({ success: false, message: "key required" });

    const { getPresignedUrl } = await import("../../utills/s3.js");
    const url = await getPresignedUrl(key, 3600);
    console.log("[presign] generated url:", url?.slice(0, 80)); // ← add
    return res.json({ success: true, url });
  } catch (err) {
    console.error("[presign] ERROR:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// STATIC ROUTES  (must come before /:id param routes)
// ══════════════════════════════════════════════════════════════════════════════

// Utility
router.get("/next-id", ctrl.getNextId);
router.get("/pending-count", ctrl.getPendingCount);
router.get("/pending-rejoin-count", ctrl.getPendingRejoinCount);

// Lists
router.get("/", ctrl.getAll);
router.get("/pending-rejoin", ctrl.getPendingRejoin);
router.get("/activity-log", ctrl.getActivityLog);

// Exports
router.get("/export/template", ctrl.exportTemplate);
router.get("/export/data", ctrl.exportData);

// Maintenance
router.get("/cleanup-expired-rejoin-invites", ctrl.cleanupExpiredRejoinInvites);

// Create employee  (multi-field upload + UAN validation)
router.post(
  "/",
  handleMulterError(runUploadMultiFields),
  validateUAN,
  ctrl.createEmployee,
);

// ══════════════════════════════════════════════════════════════════════════════
// PARAM ROUTES  /:id …
// ══════════════════════════════════════════════════════════════════════════════

router.get("/:id", ctrl.getById);
router.put("/:id", validateUAN, ctrl.updateEmployee);
router.delete("/:id", ctrl.deleteEmployee);

// Status
router.patch("/:id/status", ctrl.updateStatus);
router.post("/:id/status-notification", ctrl.sendStatusNotification);

// History
router.get("/:id/history", ctrl.getHistory);

// Photo upload (image only)
router.post(
  "/:id/upload-photo",
  handleMulterError(runUploadPhotoOnly),
  ctrl.uploadPhoto,
);

// Generic document upload (any field name, image or PDF)
router.post(
  "/:id/upload-document",
  handleMulterError(runUploadDocAny),
  ctrl.uploadDocument,
);

// Delete a specific document
router.delete("/:id/documents/:docId", ctrl.deleteDocument);

// Rejoin flow
router.post("/:id/send-rejoin-invite", ctrl.sendRejoinInvite);
router.delete("/:id/pending-rejoin", ctrl.cancelPendingRejoin);

export default router;
