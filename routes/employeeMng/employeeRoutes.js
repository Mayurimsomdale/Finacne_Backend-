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

/**
 * GET /api/employees/s3/proxy?key=uploads/employee_docs/abc.png
 * Fetches the S3 object server-side via AWS SDK and streams it to the browser.
 * Use this for PDF generation — avoids browser CORS/tainted-canvas issues
 * because the browser fetches from your own origin, not from S3 directly.
 *
 * Uses GetObjectCommand directly (no fetch, no presign) — works on all Node versions.
 */
router.get("/s3/proxy", async (req, res) => {
  try {
    const { key } = req.query;
    if (!key)
      return res.status(400).json({ success: false, message: "key required" });

    // Import S3Client and GetObjectCommand from AWS SDK v3
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");

    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    const s3Resp = await s3.send(command);

    // Set CORS + content headers so the browser accepts the response
    const origin = process.env.FRONTEND_URL_LOCAL || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader(
      "Content-Type",
      s3Resp.ContentType || "application/octet-stream",
    );
    if (s3Resp.ContentLength) {
      res.setHeader("Content-Length", s3Resp.ContentLength);
    }

    // Stream the S3 body directly to the HTTP response
    // s3Resp.Body is a ReadableStream (AWS SDK v3) — pipe it as a Node stream
    const { Readable } = await import("stream");
    const nodeStream = s3Resp.Body.transformToWebStream
      ? Readable.fromWeb(s3Resp.Body.transformToWebStream())
      : Readable.from(s3Resp.Body); // fallback for older SDK builds

    nodeStream.pipe(res);

    nodeStream.on("error", (err) => {
      console.error("[s3/proxy] stream error:", err.message);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    console.error("[s3/proxy] ERROR:", err.message);
    if (!res.headersSent)
      res.status(500).json({ success: false, message: err.message });
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
router.put("/:id", express.json(), validateUAN, ctrl.updateEmployee);
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
