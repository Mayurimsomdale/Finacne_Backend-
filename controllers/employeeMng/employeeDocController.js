// controllers/employeeDocController.js
// All business logic, DB queries, and file operations for employee-doc routes.
// Each export maps 1-to-1 with a route in employeeDocUploadRoutes.js.

import path   from 'path';
import fs     from 'fs';
import crypto from 'crypto';
import pool from '../../config/database.js';

import {
  PROJECT_ROOT,
  cleanupFiles
} from '../../middleware/employeeMng/employeeDocMiddleware.js';

import {
  sendHRDocSubmissionNotification,
  sendDocAcceptanceEmail,
  sendDocRejectionEmail,
} from '../../services/emailService.js';

// ══════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Inserts a row into employee_submitted_docs and returns its id.
 */
async function saveDoc(client, empDbId, tokenId, type, file) {
  if (!file) return null;
  const { rows } = await client.query(
    `INSERT INTO employee_submitted_docs
       (employee_id, upload_token_id, document_type,
        file_path, file_name, file_size, mime_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING id`,
    [
      empDbId, tokenId, type,
      `/uploads/employee_submitted_docs/${file.filename}`,
      file.originalname, file.size, file.mimetype,
    ]
  );
  return rows[0].id;
}

/**
 * Creates a new upload token for an employee, updates employees.active_doc_upload_token,
 * and returns { token, expiresAt }.
 */
async function generateFreshUploadToken(client, empDbId, empPublicId) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await client.query(
    `INSERT INTO employee_doc_upload_tokens
       (token, employee_id, employee_emp_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [token, empDbId, empPublicId, expiresAt]
  );

  await client.query(
    `UPDATE employees SET active_doc_upload_token=$1 WHERE id=$2`,
    [token, empDbId]
  );

  return { token, expiresAt };
}

/**
 * Resolves the FRONTEND_URL env var with a safe fallback.
 */
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER EXPORTS
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/employee-docs/validate/:token ────────────────────────────────────
export async function validateToken(req, res) {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const { rows } = await client.query(
      `SELECT t.*, e.first_name, e.last_name, e.email,
              e.employee_id AS emp_id, e.department, e.position, e.docs_submitted
       FROM employee_doc_upload_tokens t
       JOIN employees e ON e.id = t.employee_id
       WHERE t.token = $1`,
      [token]
    );

    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Upload link is invalid or has expired.' });

    const t = rows[0];

    if (t.is_used)
      return res.status(410).json({
        success: false, used: true,
        message: 'Documents already submitted via this link.',
        employeeName: `${t.first_name} ${t.last_name}`,
        empId: t.emp_id,
      });

    if (new Date(t.expires_at) < new Date())
      return res.status(410).json({
        success: false, expired: true,
        message: 'This upload link has expired. Please contact HR for a new link.',
      });

    return res.json({
      success: true,
      employee: {
        firstName:  t.first_name,
        lastName:   t.last_name,
        email:      t.email,
        empId:      t.emp_id,
        department: t.department,
        position:   t.position,
      },
      expiresAt:     t.expires_at,
      docsSubmitted: t.docs_submitted,
    });
  } catch (err) {
    console.error('[validateToken]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── POST /api/employee-docs/upload/:token ─────────────────────────────────────
export async function employeeUpload(req, res) {
  const client = await pool.connect();
  try {
    const { token } = req.params;
    const f = req.files || {};

    const { rows: tokenRows } = await client.query(
      `SELECT t.*, e.first_name, e.last_name, e.email, e.employee_id AS emp_id
       FROM employee_doc_upload_tokens t
       JOIN employees e ON e.id = t.employee_id
       WHERE t.token = $1`,
      [token]
    );

    if (!tokenRows[0]) {
      cleanupFiles(f);
      return res.status(404).json({ success: false, message: 'Invalid upload link' });
    }

    const t = tokenRows[0];

    if (t.is_used) {
      cleanupFiles(f);
      return res.status(410).json({ success: false, used: true, message: 'Documents already submitted via this link.' });
    }

    if (new Date(t.expires_at) < new Date()) {
      cleanupFiles(f);
      return res.status(410).json({ success: false, expired: true, message: 'Upload link expired.' });
    }

    if (!f.signed_kye?.[0]) {
      cleanupFiles(f);
      return res.status(400).json({ success: false, message: 'The Signed KYE Form is required.' });
    }

    await client.query('BEGIN');

    const savedIds = [];
    savedIds.push(await saveDoc(client, t.employee_id, t.id, 'signed_kye', f.signed_kye[0]));
    if (f.other) {
      for (const file of f.other)
        savedIds.push(await saveDoc(client, t.employee_id, t.id, 'other', file));
    }

    await client.query(
      `UPDATE employee_doc_upload_tokens
       SET is_used=true, used_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [t.id]
    );
    await client.query(
      `UPDATE employees
       SET docs_submitted=true, docs_submitted_at=CURRENT_TIMESTAMP,
           active_doc_upload_token=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [t.employee_id]
    );

    await client.query('COMMIT');
    console.log(`✅ [DOC UPLOAD] Employee ${t.emp_id} submitted ${savedIds.length} doc(s) (token ${t.id})`);

    setImmediate(async () => {
      try {
        await sendHRDocSubmissionNotification({
          firstName:    t.first_name,
          lastName:     t.last_name,
          empId:        t.emp_id,
          email:        t.email,
          docsUploaded: Object.keys(f).length,
        });
      } catch (e) { console.error('HR doc notification email failed:', e.message); }
    });

    return res.status(201).json({
      success: true,
      message: 'Document submitted successfully. HR has been notified.',
      data: { docsUploaded: savedIds.length },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    cleanupFiles(req.files);
    console.error('[employeeUpload]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── GET /api/employee-docs/submissions/:empDbId ───────────────────────────────
export async function getSubmissions(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT d.*, e.first_name, e.last_name, e.employee_id AS emp_id
       FROM employee_submitted_docs d
       JOIN employees e ON e.id = d.employee_id
       JOIN employee_doc_upload_tokens t ON t.id = d.upload_token_id
       WHERE d.employee_id = $1
         AND d.document_type = 'signed_kye'
         AND t.id = (
           SELECT id FROM employee_doc_upload_tokens
           WHERE employee_id = $1 AND is_used = true
           ORDER BY used_at DESC LIMIT 1
         )
       ORDER BY d.uploaded_at DESC`,
      [req.params.empDbId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getSubmissions]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── GET /api/employee-docs/pending ────────────────────────────────────────────
export async function getPending(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `WITH latest_tokens AS (
         SELECT DISTINCT ON (employee_id) id, employee_id
         FROM employee_doc_upload_tokens
         WHERE is_used = true
         ORDER BY employee_id, used_at DESC
       )
       SELECT
         e.id, e.employee_id AS emp_id,
         e.first_name, e.last_name,
         e.email, e.phone, e.department, e.position, e.docs_submitted_at,
         COUNT(d.id) FILTER (
           WHERE d.reviewed = false AND (d.status IS NULL OR d.status = 'pending')
         ) AS unreviewed_count,
         COUNT(d.id) AS total_docs
       FROM employees e
       JOIN latest_tokens lt ON lt.employee_id = e.id
       JOIN employee_submitted_docs d
         ON d.employee_id = e.id
        AND d.upload_token_id = lt.id
        AND d.document_type = 'signed_kye'
       WHERE e.docs_submitted = true
       GROUP BY e.id
       HAVING COUNT(d.id) FILTER (
         WHERE d.reviewed = false AND (d.status IS NULL OR d.status = 'pending')
       ) > 0
       ORDER BY e.docs_submitted_at DESC`
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[getPending]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── GET /api/employee-docs/reviewed ──────────────────────────────────────────
export async function getReviewed(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `WITH latest_tokens AS (
         SELECT DISTINCT ON (employee_id) id, employee_id, used_at
         FROM employee_doc_upload_tokens
         WHERE is_used = true
         ORDER BY employee_id, used_at DESC
       ),
       doc_counts AS (
         SELECT
           d.employee_id,
           lt.id       AS token_id,
           lt.used_at,
           COUNT(d.id) AS total_docs,
           COUNT(d.id) FILTER (
             WHERE d.status = 'accepted'
               OR (d.reviewed = true AND (d.status IS NULL OR d.status = 'pending'))
           ) AS accepted_docs,
           COUNT(d.id) FILTER (WHERE d.status = 'rejected') AS rejected_docs,
           COUNT(d.id) FILTER (
             WHERE d.reviewed = false AND (d.status IS NULL OR d.status = 'pending')
           ) AS pending_docs,
           json_agg(
             json_build_object(
               'id',            d.id,
               'document_type', d.document_type,
               'file_path',     d.file_path,
               'file_name',     d.file_name,
               'mime_type',     d.mime_type,
               'status',        COALESCE(
                                  d.status,
                                  CASE WHEN d.reviewed THEN 'accepted' ELSE 'pending' END
                                ),
               'reviewed',      d.reviewed,
               'reviewed_at',   d.reviewed_at,
               'uploaded_at',   d.uploaded_at
             ) ORDER BY d.uploaded_at ASC
           ) AS docs
         FROM employee_submitted_docs d
         JOIN latest_tokens lt
           ON lt.employee_id = d.employee_id
          AND lt.id = d.upload_token_id
         WHERE d.document_type = 'signed_kye'
         GROUP BY d.employee_id, lt.id, lt.used_at
       )
       SELECT
         e.id,
         e.employee_id         AS emp_id,
         e.first_name,
         e.last_name,
         e.father_husband_name,
         e.email,
         e.phone,
         e.department,
         e.position,
         e.docs_submitted_at,
         e.status              AS emp_status,
         dc.total_docs,
         dc.accepted_docs,
         dc.rejected_docs,
         dc.pending_docs,
         dc.used_at            AS docs_submitted_at_token,
         dc.docs
       FROM employees e
       JOIN doc_counts dc ON dc.employee_id = e.id
       WHERE dc.total_docs   > 0
         AND dc.pending_docs  = 0
         AND dc.rejected_docs = 0
         AND dc.accepted_docs = dc.total_docs
       ORDER BY dc.used_at DESC`
    );
    return res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('[getReviewed]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── POST /api/employee-docs/mark-reviewed/:docId ──────────────────────────────
export async function markReviewed(req, res) {
  const client = await pool.connect();
  try {
    const reviewerName = req.admin?.name || req.body?.reviewerName || 'HR';

    const { rows } = await client.query(
      `UPDATE employee_submitted_docs
       SET reviewed=true, status='accepted',
           reviewed_by=$1, reviewed_at=CURRENT_TIMESTAMP
       WHERE id=$2
       RETURNING *`,
      [reviewerName, req.params.docId]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Document not found' });

    const empId = rows[0].employee_id;

    // Check if any docs from this employee's latest token are still unreviewed
    const { rows: remaining } = await client.query(
      `SELECT COUNT(*) AS pending
       FROM employee_submitted_docs d
       JOIN employee_doc_upload_tokens t ON t.id = d.upload_token_id
       WHERE d.employee_id = $1
         AND d.document_type = 'signed_kye'
         AND t.id = (
           SELECT id FROM employee_doc_upload_tokens
           WHERE employee_id = $1 AND is_used = true
           ORDER BY used_at DESC LIMIT 1
         )
         AND d.reviewed = false
         AND (d.status IS NULL OR d.status = 'pending')`,
      [empId]
    );

    if (parseInt(remaining[0].pending, 10) === 0) {
      const { rows: empRows } = await client.query(
        `SELECT first_name, last_name, email, employee_id FROM employees WHERE id=$1`, [empId]
      );
      if (empRows[0]) {
        const emp = empRows[0];
        setImmediate(async () => {
          try {
            await sendDocAcceptanceEmail({
              to: emp.email, firstName: emp.first_name,
              lastName: emp.last_name, employeeId: emp.employee_id,
            });
            console.log(`✅ Doc acceptance email sent to ${emp.email}`);
          } catch (e) { console.error('Doc acceptance email failed:', e.message); }
        });
      }
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[markReviewed]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── POST /api/employee-docs/reject-doc/:docId ─────────────────────────────────
export async function rejectDoc(req, res) {
  const client = await pool.connect();
  try {
    const { rejection_reason } = req.body || {};
    const reviewerName = req.admin?.name || req.body?.reviewerName || 'HR';

    const { rows } = await client.query(
      `UPDATE employee_submitted_docs
       SET status='rejected', rejection_reason=$1,
           reviewed=true, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP
       WHERE id=$3
       RETURNING *`,
      [rejection_reason || null, reviewerName, req.params.docId]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Document not found' });

    const empDbId = rows[0].employee_id;
    const { rows: empRows } = await client.query(
      `SELECT first_name, last_name, email, employee_id FROM employees WHERE id=$1`, [empDbId]
    );

    if (empRows[0]) {
      const emp = empRows[0];
      const { token: freshToken } = await generateFreshUploadToken(client, empDbId, emp.employee_id);
      const uploadUrl = `${frontendUrl()}/upload-documents/${freshToken}`;
      console.log(`🔗 Fresh upload token generated for ${emp.employee_id}: ${freshToken}`);

      setImmediate(async () => {
        try {
          await sendDocRejectionEmail({
            to:         emp.email,
            firstName:  emp.first_name,
            lastName:   emp.last_name,
            employeeId: emp.employee_id,
            reason:     rejection_reason || '',
            uploadUrl,
          });
          console.log(`✅ Doc rejection email sent to ${emp.email}`);
        } catch (e) { console.error('Doc rejection email failed:', e.message); }
      });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[rejectDoc]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── POST /api/employee-docs/generate-upload-link/:empDbId ─────────────────────
export async function generateUploadLink(req, res) {
  const client = await pool.connect();
  try {
    const { empDbId } = req.params;
    const { rows: empRows } = await client.query(
      `SELECT * FROM employees WHERE id=$1`, [empDbId]
    );
    if (!empRows[0])
      return res.status(404).json({ success: false, message: 'Employee not found' });

    const emp = empRows[0];
    const { token, expiresAt } = await generateFreshUploadToken(client, empDbId, emp.employee_id);
    const uploadUrl = `${frontendUrl()}/upload-documents/${token}`;

    return res.json({
      success:   true,
      token,
      uploadUrl,
      expiresAt: expiresAt.toISOString(),
      message:   'Upload link generated.',
    });
  } catch (err) {
    console.error('[generateUploadLink]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── POST /api/employee-docs/hr-upload/:empDbId ────────────────────────────────
export async function hrUpload(req, res) {
  const client = await pool.connect();
  try {
    const { empDbId } = req.params;
    const f = req.files || {};

    const { rows: empRows } = await client.query(
      `SELECT id, employee_id, first_name, last_name FROM employees WHERE id=$1`, [empDbId]
    );
    if (!empRows[0]) {
      cleanupFiles(f);
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    if (!f.bgv_form?.[0] && !f.email_screenshot?.[0])
      return res.status(400).json({ success: false, message: 'Please upload at least one document.' });

    const uploadedBy = req.admin?.name || req.body?.uploadedBy || 'HR';

    await client.query('BEGIN');

    const insertHRDoc = async (docType, file) => {
      const { rows } = await client.query(
        `INSERT INTO employee_hr_uploaded_docs
           (employee_id, document_type, file_path, file_name,
            file_size, mime_type, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, employee_id, document_type, file_path, file_name,
                   file_size, mime_type, uploaded_by, uploaded_at`,
        [
          empDbId, docType,
          `/uploads/employee_submitted_docs/${file.filename}`,
          file.originalname, file.size, file.mimetype, uploadedBy,
        ]
      );
      return rows[0];
    };

    const saved = [];
    if (f.bgv_form?.[0])         saved.push(await insertHRDoc('bgv_form',         f.bgv_form[0]));
    if (f.email_screenshot?.[0]) saved.push(await insertHRDoc('email_screenshot',  f.email_screenshot[0]));

    await client.query('COMMIT');
    console.log(`✅ [HR UPLOAD] ${saved.length} doc(s) uploaded for employee ${empRows[0].employee_id}`);

    return res.status(201).json({
      success: true,
      message: `${saved.length} document(s) uploaded successfully.`,
      data:    saved,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    cleanupFiles(req.files);
    console.error('[hrUpload]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── GET /api/employee-docs/hr-uploads/:empDbId ───────────────────────────────
export async function getHRUploads(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM employee_hr_uploaded_docs
       WHERE employee_id=$1
       ORDER BY uploaded_at DESC`,
      [req.params.empDbId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getHRUploads]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── DELETE /api/employee-docs/hr-uploads/:docId ───────────────────────────────
export async function deleteHRUpload(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `DELETE FROM employee_hr_uploaded_docs WHERE id=$1 RETURNING *`,
      [req.params.docId]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: 'Document not found.' });

    try { fs.unlinkSync(path.join(PROJECT_ROOT, rows[0].file_path)); } catch (_) {}

    return res.json({ success: true, message: 'Document deleted.' });
  } catch (err) {
    console.error('[deleteHRUpload]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── POST /api/employee-docs/hr-kye-upload/:empDbId ───────────────────────────
export async function hrKyeInsert(req, res) {
  const client = await pool.connect();
  try {
    const { empDbId } = req.params;
    const f = req.files || {};

    if (!f.signed_kye?.[0])
      return res.status(400).json({ success: false, message: 'signed_kye file is required.' });

    const { rows: empRows } = await client.query(
      `SELECT id, employee_id, first_name, last_name FROM employees WHERE id=$1`, [empDbId]
    );
    if (!empRows[0]) {
      cleanupFiles(f);
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
    const emp = empRows[0];

    await client.query('BEGIN');

    // Synthetic token — already marked used, expires 1 year out
    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { rows: tokenRows } = await client.query(
      `INSERT INTO employee_doc_upload_tokens
         (token, employee_id, employee_emp_id, expires_at, is_used, used_at)
       VALUES ($1,$2,$3,$4,true,CURRENT_TIMESTAMP)
       RETURNING id`,
      [token, empDbId, emp.employee_id, expiresAt]
    );
    const tokenId    = tokenRows[0].id;
    const uploadedBy = req.admin?.name || req.body?.uploadedBy || 'HR';
    const file       = f.signed_kye[0];

    const { rows: docRows } = await client.query(
      `INSERT INTO employee_submitted_docs
         (employee_id, upload_token_id, document_type,
          file_path, file_name, file_size, mime_type,
          status, reviewed, reviewed_by, reviewed_at)
       VALUES ($1,$2,'signed_kye',$3,$4,$5,$6,'accepted',true,$7,CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        empDbId, tokenId,
        `/uploads/employee_submitted_docs/${file.filename}`,
        file.originalname, file.size, file.mimetype, uploadedBy,
      ]
    );

    // Ensure docs_submitted is set without overwriting an earlier timestamp
    await client.query(
      `UPDATE employees
       SET docs_submitted=true,
           docs_submitted_at=COALESCE(docs_submitted_at, CURRENT_TIMESTAMP),
           active_doc_upload_token=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [empDbId]
    );

    await client.query('COMMIT');
    console.log(`✅ [HR KYE INSERT] HR uploaded KYE doc for employee ${emp.employee_id}`);

    return res.status(201).json({
      success: true,
      message: 'KYE document uploaded and accepted.',
      data:    docRows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    cleanupFiles(req.files);
    console.error('[hrKyeInsert]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── PUT /api/employee-docs/kye/:docId ────────────────────────────────────────
export async function hrKyeReplace(req, res) {
  const client = await pool.connect();
  try {
    const { docId } = req.params;
    const f = req.files || {};

    const { rows: existing } = await client.query(
      `SELECT * FROM employee_submitted_docs
       WHERE id=$1 AND document_type='signed_kye'`,
      [docId]
    );
    if (!existing[0]) {
      cleanupFiles(f);
      return res.status(404).json({ success: false, message: 'KYE document not found.' });
    }

    const uploadedBy = req.admin?.name || req.body?.uploadedBy || 'HR';

    if (f.signed_kye?.[0]) {
      // Delete old physical file before writing the new one
      try { fs.unlinkSync(path.join(PROJECT_ROOT, existing[0].file_path)); } catch (_) {}

      const file = f.signed_kye[0];
      const { rows } = await client.query(
        `UPDATE employee_submitted_docs
         SET file_path=$1, file_name=$2, file_size=$3, mime_type=$4,
             status='accepted', reviewed=true,
             reviewed_by=$5, reviewed_at=CURRENT_TIMESTAMP,
             uploaded_at=CURRENT_TIMESTAMP
         WHERE id=$6
         RETURNING *`,
        [
          `/uploads/employee_submitted_docs/${file.filename}`,
          file.originalname, file.size, file.mimetype, uploadedBy, docId,
        ]
      );
      console.log(`✅ [HR KYE REPLACE] doc ${docId} replaced by ${uploadedBy}`);
      return res.json({ success: true, message: 'KYE document replaced.', data: rows[0] });
    }

    // No new file supplied — just re-accept the existing row
    const { rows } = await client.query(
      `UPDATE employee_submitted_docs
       SET status='accepted', reviewed=true,
           reviewed_by=$1, reviewed_at=CURRENT_TIMESTAMP
       WHERE id=$2
       RETURNING *`,
      [uploadedBy, docId]
    );
    return res.json({ success: true, message: 'KYE document status updated.', data: rows[0] });
  } catch (err) {
    cleanupFiles(req.files);
    console.error('[hrKyeReplace]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}

// ── DELETE /api/employee-docs/kye/:docId ─────────────────────────────────────
export async function hrKyeDelete(req, res) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `DELETE FROM employee_submitted_docs
       WHERE id=$1 AND document_type='signed_kye'
       RETURNING *`,
      [req.params.docId]
    );
    if (!rows[0])
      return res.status(404).json({ success: false, message: 'KYE document not found.' });

    try { fs.unlinkSync(path.join(PROJECT_ROOT, rows[0].file_path)); } catch (_) {}

    console.log(`🗑️  [HR KYE DELETE] doc ${req.params.docId} deleted`);
    return res.json({ success: true, message: 'KYE document deleted.' });
  } catch (err) {
    console.error('[hrKyeDelete]', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
}