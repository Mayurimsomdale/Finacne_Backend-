// =============================================================================
// FILE: controllers/AdvancePayment/advancePaymentController.js
//
// FIXES APPLIED:
//   FIX 1 — emp_email saved at INSERT time so rejection email always has address.
//   FIX 2 — rejectRequest has 3-level email fallback.
//   FIX 3 — approveRequest: if this employee's payroll for the CURRENT month is
//            already Paid, automatically assigns adjusted_in to NEXT month so
//            the deduction is never silently skipped or double-applied.
//   FIX 4 — resubmit token route /advance-resubmit/:token added (separate file).
// =============================================================================
import pool from '../../config/database.js';
import path from 'path';
import fs   from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  sendAdvancePaymentLinkEmail,
  sendSubmissionConfirmationEmail,
  sendHRNewRequestNotification,
  sendApprovalEmail,
  sendRejectionEmail,
} from '../../services/AdvancepaymentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateRequestCode(client) {
  const year   = new Date().getFullYear();
  const prefix = `ADV-${year}-`;
  const { rows } = await client.query(
    `SELECT request_code FROM advance_payment_requests
     WHERE request_code LIKE $1
     ORDER BY request_code DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length) {
    const last = rows[0].request_code;
    seq = parseInt(last.split('-')[2], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function paginationMeta(total, page, limit) {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}

function getAdminName(req) {
  return (
    req.admin?.full_name ||
    req.admin?.fullName  ||
    req.admin?.name      ||
    req.admin?.username  ||
    'Admin'
  );
}

// Safe email fire-and-forget — never crashes the main request
async function fireEmail(label, fn) {
  try {
    await fn();
    console.log(`📧 Email sent: ${label}`);
  } catch (err) {
    console.warn(`📧 Email FAILED (${label}):`, err.message);
  }
}

function frontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

function generateResubmitToken() {
  return crypto.randomBytes(32).toString('hex');
}

// =============================================================================
// Helper: resolve which month to assign a deduction to.
//
// Rules:
//   1. If the HR explicitly passed adjusted_in → use it as-is.
//   2. Else if the employee's payroll for the CURRENT calendar month is already
//      Paid → auto-roll to NEXT month (FIX 3).
//   3. Else → use the current calendar month.
//
// This prevents the silent-skip bug where an advance approved after payroll
// was paid for the month would have month_label = current month but the
// payroll controller would never re-process it (it's already Paid).
// =============================================================================
async function resolveAdjustedIn(client, empBizId, explicitAdjustedIn) {
  if (explicitAdjustedIn) return explicitAdjustedIn;

  const currentMonthLabel = new Date().toLocaleString('en-IN', {
    month: 'long', year: 'numeric',
  });

  try {
    const { rows } = await client.query(
      `SELECT pr.id
       FROM payroll_records pr
       JOIN employees e ON e.id = pr.employee_id
       WHERE e.employee_id = $1
         AND pr.for_month  = $2
         AND pr.status     = 'Paid'
       LIMIT 1`,
      [empBizId, currentMonthLabel]
    );

    if (rows.length > 0) {
      // Current month payroll already paid — roll to next month
      const now       = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextLabel = nextMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      console.log(
        `resolveAdjustedIn: payroll already Paid for ${empBizId} / ${currentMonthLabel}` +
        ` → rolling deduction to ${nextLabel}`
      );
      return nextLabel;
    }
  } catch (err) {
    // Non-fatal — default to current month
    console.warn('resolveAdjustedIn: DB check failed (non-fatal):', err.message);
  }

  return currentMonthLabel;
}


// =============================================================================
// SHARED CORE: validates link token, inserts request + attachments + history
// =============================================================================
async function _insertRequest(client, body, files) {
  const {
    payment_type_key,
    emp_id, emp_name, emp_dept,
    emp_email,
    amount, reason,
    to_emp_id, to_emp_name, to_emp_dept,
    vendor_name, vendor_ref,
    submitted_via_link,
    resubmit_token,
  } = body;

  if (!payment_type_key || !emp_id || !emp_name || !emp_dept || !amount || !reason) {
    const err = new Error('Missing required fields: payment_type_key, emp_id, emp_name, emp_dept, amount, reason');
    err.statusCode = 400;
    throw err;
  }
  if (isNaN(amount) || Number(amount) <= 0) {
    const err = new Error('Amount must be a positive number');
    err.statusCode = 400;
    throw err;
  }
  if (payment_type_key === 'emp_to_emp' && (!to_emp_id || !to_emp_name)) {
    const err = new Error('Recipient employee details required for emp_to_emp type');
    err.statusCode = 400;
    throw err;
  }
  if (payment_type_key === 'other' && !vendor_name) {
    const err = new Error('Vendor name is required for external payment type');
    err.statusCode = 400;
    throw err;
  }

  const typeCheck = await client.query(
    'SELECT key, label, short_label FROM advance_payment_types WHERE key = $1 AND is_active = true',
    [payment_type_key]
  );
  if (!typeCheck.rows.length) {
    const err = new Error('Invalid payment_type_key');
    err.statusCode = 400;
    throw err;
  }
  const paymentTypeLabel = typeCheck.rows[0].label;

  const screenshotFile = files?.screenshot?.[0];
  if (!screenshotFile) {
    const err = new Error('Payment screenshot is mandatory');
    err.statusCode = 400;
    throw err;
  }

  let employeeDbId   = null;
  let toEmployeeDbId = null;
  let recipientEmail = emp_email || null;

  try {
    const empRes = await client.query(
      'SELECT id, email FROM employees WHERE employee_id = $1 LIMIT 1', [emp_id]
    );
    if (empRes.rows.length) {
      employeeDbId = empRes.rows[0].id;
      if (!recipientEmail && empRes.rows[0].email) recipientEmail = empRes.rows[0].email;
    }
    if (to_emp_id) {
      const toEmpRes = await client.query(
        'SELECT id FROM employees WHERE employee_id = $1 LIMIT 1', [to_emp_id]
      );
      if (toEmpRes.rows.length) toEmployeeDbId = toEmpRes.rows[0].id;
    }
  } catch (_) { /* non-fatal */ }

  let originalRequestId = null;

  if (resubmit_token) {
    const tokenRes = await client.query(
      `SELECT id, original_request_id, is_used, expires_at, employee_email
       FROM advance_payment_resubmit_tokens WHERE token = $1`,
      [resubmit_token]
    );
    if (!tokenRes.rows.length) {
      const err = new Error('Resubmit link not found or already expired');
      err.statusCode = 404;
      throw err;
    }
    const tok = tokenRes.rows[0];
    if (tok.is_used) {
      const err = new Error('This resubmit link has already been used');
      err.statusCode = 400;
      throw err;
    }
    if (new Date(tok.expires_at) < new Date()) {
      const err = new Error('This resubmit link has expired');
      err.statusCode = 400;
      throw err;
    }
    await client.query(
      `UPDATE advance_payment_resubmit_tokens SET is_used = true, used_at = NOW() WHERE id = $1`,
      [tok.id]
    );
    originalRequestId = tok.original_request_id;
    if (!recipientEmail && tok.employee_email) recipientEmail = tok.employee_email;
  }

  let linkMultiUse = false;

  if (submitted_via_link) {
    const linkRes = await client.query(
      `SELECT id, is_used, expires_at, employee_email, multi_use
       FROM advance_payment_links WHERE token = $1`,
      [submitted_via_link]
    );
    if (!linkRes.rows.length) {
      const err = new Error('Link not found');
      err.statusCode = 404;
      throw err;
    }
    const link = linkRes.rows[0];
    linkMultiUse = link.multi_use || false;
    if (!linkMultiUse && link.is_used) {
      const err = new Error('This link has already been used');
      err.statusCode = 400;
      throw err;
    }
    if (new Date(link.expires_at) < new Date()) {
      const err = new Error('This link has expired');
      err.statusCode = 400;
      throw err;
    }
    if (!linkMultiUse) {
      await client.query(
        `UPDATE advance_payment_links SET is_used = true, used_at = NOW() WHERE token = $1`,
        [submitted_via_link]
      );
    }
    try {
      await client.query(
        `UPDATE advance_payment_links SET use_count = COALESCE(use_count, 0) + 1 WHERE token = $1`,
        [submitted_via_link]
      );
    } catch (_) { /* column may not exist yet */ }
    if (!recipientEmail && link.employee_email) recipientEmail = link.employee_email;
  }

  const requestCode = await generateRequestCode(client);

  let newRequest;
  try {
    const insertRes = await client.query(
      `INSERT INTO advance_payment_requests (
         request_code, payment_type_key,
         emp_id, emp_name, emp_dept, emp_email, employee_db_id,
         amount, reason,
         to_emp_id, to_emp_name, to_emp_dept, to_employee_db_id,
         vendor_name, vendor_ref,
         submitted_via_link, original_request_id, status, request_date
       ) VALUES (
         $1,$2, $3,$4,$5,$6,$7, $8,$9, $10,$11,$12,$13, $14,$15, $16,$17,'pending',CURRENT_DATE
       ) RETURNING *`,
      [
        requestCode, payment_type_key,
        emp_id, emp_name, emp_dept,
        recipientEmail || null,
        employeeDbId,
        Number(amount), reason,
        to_emp_id    || null, to_emp_name    || null,
        to_emp_dept  || null, toEmployeeDbId || null,
        vendor_name  || null, vendor_ref     || null,
        submitted_via_link || null,
        originalRequestId  || null,
      ]
    );
    newRequest = insertRes.rows[0];
  } catch (insertErr) {
    if (insertErr.message?.includes('emp_email')) {
      console.warn('⚠️  emp_email column missing — inserting without it. Run: ALTER TABLE advance_payment_requests ADD COLUMN IF NOT EXISTS emp_email VARCHAR(255);');
      const insertRes = await client.query(
        `INSERT INTO advance_payment_requests (
           request_code, payment_type_key,
           emp_id, emp_name, emp_dept, employee_db_id,
           amount, reason,
           to_emp_id, to_emp_name, to_emp_dept, to_employee_db_id,
           vendor_name, vendor_ref,
           submitted_via_link, original_request_id, status, request_date
         ) VALUES (
           $1,$2, $3,$4,$5,$6, $7,$8, $9,$10,$11,$12, $13,$14, $15,$16,'pending',CURRENT_DATE
         ) RETURNING *`,
        [
          requestCode, payment_type_key,
          emp_id, emp_name, emp_dept, employeeDbId,
          Number(amount), reason,
          to_emp_id    || null, to_emp_name    || null,
          to_emp_dept  || null, toEmployeeDbId || null,
          vendor_name  || null, vendor_ref     || null,
          submitted_via_link || null,
          originalRequestId  || null,
        ]
      );
      newRequest = insertRes.rows[0];
    } else {
      throw insertErr;
    }
  }

  const attachmentInserts = [
    client.query(
      `INSERT INTO advance_payment_attachments
         (request_id, attachment_role, file_name, file_path, file_size, mime_type)
       VALUES ($1,'screenshot',$2,$3,$4,$5)`,
      [newRequest.id, screenshotFile.originalname, screenshotFile.path,
       screenshotFile.size, screenshotFile.mimetype]
    ),
  ];
  if (files?.proof?.[0]) {
    const p = files.proof[0];
    attachmentInserts.push(client.query(
      `INSERT INTO advance_payment_attachments
         (request_id, attachment_role, file_name, file_path, file_size, mime_type)
       VALUES ($1,'proof',$2,$3,$4,$5)`,
      [newRequest.id, p.originalname, p.path, p.size, p.mimetype]
    ));
  }
  if (files?.receipt?.[0]) {
    const r = files.receipt[0];
    attachmentInserts.push(client.query(
      `INSERT INTO advance_payment_attachments
         (request_id, attachment_role, file_name, file_path, file_size, mime_type)
       VALUES ($1,'receipt',$2,$3,$4,$5)`,
      [newRequest.id, r.originalname, r.path, r.size, r.mimetype]
    ));
  }
  await Promise.all(attachmentInserts);

  const historyNote = originalRequestId
    ? `Resubmission of rejected request (original: #${originalRequestId})`
    : 'Request submitted';

  await client.query(
    `INSERT INTO advance_payment_history
       (request_id, from_status, to_status, changed_by, changed_by_name, reason)
     VALUES ($1, NULL, 'pending', NULL, 'System', $2)`,
    [newRequest.id, historyNote]
  );

  return { newRequest, requestCode, paymentTypeLabel, recipientEmail };
}


// ════════════════════════════════════════════════════════════════════════════
// PAYMENT TYPES
// ════════════════════════════════════════════════════════════════════════════

export async function getPaymentTypes(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, key, label, short_label, description, color, is_active, created_at
       FROM advance_payment_types
       WHERE is_active = true
       ORDER BY id`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getPaymentTypes:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch payment types' });
  }
}


// ════════════════════════════════════════════════════════════════════════════
// REQUESTS — LIST / STATS
// ════════════════════════════════════════════════════════════════════════════

export async function listRequests(req, res) {
  try {
    const {
      status, payment_type, search,
      page = 1, limit = 20, sort = 'created_at', order = 'DESC',
    } = req.query;

    const offset        = (parseInt(page) - 1) * parseInt(limit);
    const allowedSorts  = ['created_at', 'request_date', 'amount', 'emp_name', 'status'];
    const allowedOrders = ['ASC', 'DESC'];
    const safeSort      = allowedSorts.includes(sort)                ? sort                : 'created_at';
    const safeOrder     = allowedOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

    const conditions = [];
    const params     = [];

    if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
    if (payment_type) { params.push(payment_type); conditions.push(`r.payment_type_key = $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      conditions.push(`(r.emp_name ILIKE $${i} OR r.emp_id ILIKE $${i} OR r.request_code ILIKE $${i})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM advance_payment_requests r ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT
         r.*,
         pt.label       AS payment_type_label,
         pt.short_label AS payment_type_short,
         pt.color       AS payment_type_color,
         (
           SELECT json_agg(json_build_object(
             'id',   a.id,
             'role', a.attachment_role,
             'name', a.file_name,
             'path', a.file_path,
             'mime', a.mime_type
           ))
           FROM advance_payment_attachments a
           WHERE a.request_id = r.id
         ) AS attachments
       FROM advance_payment_requests r
       JOIN advance_payment_types pt ON pt.key = r.payment_type_key
       ${where}
       ORDER BY r.${safeSort} ${safeOrder}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: rows,
      pagination: paginationMeta(total, parseInt(page), parseInt(limit)),
    });
  } catch (err) {
    console.error('listRequests:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch requests', error: err.message });
  }
}


export async function getStats(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE status = 'pending')           AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')          AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')          AS rejected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) AS total_approved_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'),  0) AS total_pending_amount
      FROM advance_payment_requests
    `);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getStats:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
}


export async function getRequest(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT r.*,
         pt.label       AS payment_type_label,
         pt.short_label AS payment_type_short,
         pt.color       AS payment_type_color,
         pt.description AS payment_type_desc
       FROM advance_payment_requests r
       JOIN advance_payment_types pt ON pt.key = r.payment_type_key
       WHERE r.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Request not found' });

    const { rows: attachments } = await pool.query(
      `SELECT id, attachment_role, file_name, file_path, file_size, mime_type, uploaded_at
       FROM advance_payment_attachments WHERE request_id = $1 ORDER BY uploaded_at`,
      [id]
    );
    const { rows: history } = await pool.query(
      `SELECT id, from_status, to_status, changed_by_name, reason, metadata, created_at
       FROM advance_payment_history WHERE request_id = $1 ORDER BY created_at`,
      [id]
    );
    const { rows: deductions } = await pool.query(
      `SELECT id, month_label, deduction_date, amount, status, processed_at, note
       FROM advance_payment_deductions WHERE request_id = $1 ORDER BY created_at`,
      [id]
    );

    res.json({ success: true, data: { ...rows[0], attachments, history, deductions } });
  } catch (err) {
    console.error('getRequest:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch request' });
  }
}


// ════════════════════════════════════════════════════════════════════════════
// RESUBMIT TOKEN — VALIDATE
// ════════════════════════════════════════════════════════════════════════════

export async function validateResubmitToken(req, res) {
  try {
    const { token } = req.params;
    const { rows } = await pool.query(
      `SELECT
         t.id              AS token_id,
         t.is_used,
         t.expires_at,
         t.employee_email,
         r.id              AS request_id,
         r.request_code,
         r.payment_type_key,
         r.emp_id,
         r.emp_name,
         r.emp_dept,
         r.emp_email,
         r.amount,
         r.reason,
         r.rejection_reason,
         r.to_emp_id,
         r.to_emp_name,
         r.to_emp_dept,
         r.vendor_name,
         r.vendor_ref,
         r.reviewed_by_name  AS rejected_by,
         r.reviewed_at       AS rejected_at,
         pt.label            AS payment_type_label,
         pt.short_label,
         pt.color,
         pt.description
       FROM advance_payment_resubmit_tokens t
       JOIN advance_payment_requests        r  ON r.id  = t.original_request_id
       JOIN advance_payment_types           pt ON pt.key = r.payment_type_key
       WHERE t.token = $1`,
      [token]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Resubmit link not found', expired: true });
    }
    const row = rows[0];
    if (row.is_used) {
      return res.status(400).json({ success: false, message: 'This resubmit link has already been used', expired: true });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This resubmit link has expired. Please contact HR for a new one.', expired: true });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('validateResubmitToken:', err.message);
    res.status(500).json({ success: false, message: 'Failed to validate resubmit link' });
  }
}


// ════════════════════════════════════════════════════════════════════════════
// REQUESTS — CREATE (authenticated)
// ════════════════════════════════════════════════════════════════════════════

export async function createRequest(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { newRequest, requestCode, paymentTypeLabel, recipientEmail } =
      await _insertRequest(client, req.body, req.files);
    await client.query('COMMIT');

    const { submitted_via_link, emp_name, emp_id, emp_dept, amount, reason } = req.body;

    if (recipientEmail) {
      fireEmail('submission-confirmation', () =>
        sendSubmissionConfirmationEmail({
          to: { email: recipientEmail, name: emp_name },
          requestCode, amount, paymentTypeLabel, reason, submittedAt: new Date(),
        })
      );
    }
    const hrEmail = process.env.HR_EMAIL;
    if (hrEmail && submitted_via_link) {
      fireEmail('hr-new-request', () =>
        sendHRNewRequestNotification({
          hrEmail, requestCode, empName: emp_name, empId: emp_id,
          empDept: emp_dept, amount, paymentTypeLabel, reason,
          adminPanelUrl: `${frontendUrl()}/#/advance-payment`,
        })
      );
    }
    res.status(201).json({
      success: true,
      message: 'Advance payment request submitted successfully',
      data: { ...newRequest, requestCode, request_code: requestCode },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createRequest ERROR:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to create request' });
  } finally {
    client.release();
  }
}


// ════════════════════════════════════════════════════════════════════════════
// REQUESTS — CREATE PUBLIC
// ════════════════════════════════════════════════════════════════════════════

export async function createPublicRequest(req, res) {
  const linkToken     = req.body?.submitted_via_link;
  const resubmitToken = req.body?.resubmit_token;
  if (!linkToken && !resubmitToken) {
    return res.status(401).json({
      success: false,
      message: 'A valid link token or resubmit token is required for public submissions',
    });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { newRequest, requestCode, paymentTypeLabel, recipientEmail } =
      await _insertRequest(client, req.body, req.files);
    await client.query('COMMIT');

    const { emp_name, emp_id, emp_dept, amount, reason } = req.body;
    if (recipientEmail) {
      fireEmail('submission-confirmation', () =>
        sendSubmissionConfirmationEmail({
          to: { email: recipientEmail, name: emp_name },
          requestCode, amount, paymentTypeLabel, reason, submittedAt: new Date(),
        })
      );
    }
    const hrEmail = process.env.HR_EMAIL;
    if (hrEmail) {
      fireEmail('hr-new-request', () =>
        sendHRNewRequestNotification({
          hrEmail, requestCode, empName: emp_name, empId: emp_id,
          empDept: emp_dept, amount, paymentTypeLabel, reason,
          adminPanelUrl: `${frontendUrl()}/#/advance-payment`,
        })
      );
    }
    res.status(201).json({
      success: true,
      message: 'Advance payment request submitted successfully',
      data: { ...newRequest, requestCode, request_code: requestCode },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPublicRequest ERROR:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to create request' });
  } finally {
    client.release();
  }
}


// ════════════════════════════════════════════════════════════════════════════
// REQUESTS — APPROVE
//
// FIX 3: auto-roll adjusted_in to next month if this employee's current-month
// payroll is already Paid. Prevents the silent-skip bug.
// ════════════════════════════════════════════════════════════════════════════

export async function approveRequest(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id }                           = req.params;
    const { adjusted_in, deductions = [] } = req.body;

    const adminId   = null;
    const adminName = getAdminName(req);

    const { rows } = await client.query(
      `SELECT r.*, pt.label AS payment_type_label
       FROM advance_payment_requests r
       JOIN advance_payment_types pt ON pt.key = r.payment_type_key
       WHERE r.id = $1`,
      [id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot approve a request with status '${rows[0].status}'`,
      });
    }

    const request = rows[0];

    // ── FIX 3: resolve which month this deduction belongs to ─────────────────
    // If the HR explicitly passed adjusted_in, honour it.
    // Otherwise check whether the employee's payroll for the current month is
    // already Paid — if so, roll to next month automatically.
    const adjustedLabel = await resolveAdjustedIn(client, request.emp_id, adjusted_in || null);

    await client.query(
      `UPDATE advance_payment_requests
       SET status = 'approved', reviewed_by = $1, reviewed_by_name = $2,
           reviewed_at = NOW(), adjusted_in = $3, updated_at = NOW()
       WHERE id = $4`,
      [adminId, adminName, adjustedLabel, id]
    );

    await client.query(
      `INSERT INTO advance_payment_history
         (request_id, from_status, to_status, changed_by, changed_by_name, reason)
       VALUES ($1, 'pending', 'approved', $2, $3, $4)`,
      [id, adminId, adminName, `Approved — deduction assigned to ${adjustedLabel}`]
    );

    if (Array.isArray(deductions) && deductions.length > 0) {
      await Promise.all(
        deductions.map(d =>
          client.query(
            `INSERT INTO advance_payment_deductions
               (request_id, month_label, amount, status)
             VALUES ($1, $2, $3, 'upcoming')`,
            [id, d.month_label, d.amount]
          )
        )
      );
    } else {
      await client.query(
        `INSERT INTO advance_payment_deductions
           (request_id, month_label, amount, status)
         VALUES ($1, $2, $3, 'upcoming')`,
        [id, adjustedLabel, request.amount]
      );
    }

    await client.query('COMMIT');

    // Send approval email
    fireEmail('approval-email', async () => {
      let emailTo     = request.emp_email || null;
      let empFullName = request.emp_name;

      if (!emailTo) {
        try {
          const empEmailRes = await pool.query(
            `SELECT email, CONCAT(first_name, ' ', last_name) AS full_name
             FROM employees WHERE employee_id = $1 LIMIT 1`,
            [request.emp_id]
          );
          const empRow = empEmailRes.rows[0];
          if (empRow?.email) {
            emailTo     = empRow.email;
            empFullName = empRow.full_name || request.emp_name;
          }
        } catch (_) { /* non-fatal */ }
      }

      if (!emailTo) {
        console.warn(`approveRequest: ❌ No email found for employee ${request.emp_id} — approval email not sent`);
        return;
      }

      await sendApprovalEmail({
        to:               { email: emailTo, name: empFullName },
        requestCode:      request.request_code,
        amount:           request.amount,
        paymentTypeLabel: request.payment_type_label,
        adjustedIn:       adjustedLabel,
        approvedBy:       adminName,
        approvedAt:       new Date(),
      });
    });

    res.json({
      success: true,
      message: `Request approved — deduction assigned to ${adjustedLabel}`,
      data: { adjusted_in: adjustedLabel },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approveRequest ERROR:', err.message);
    res.status(500).json({ success: false, message: 'Failed to approve request', error: err.message });
  } finally {
    client.release();
  }
}


// ════════════════════════════════════════════════════════════════════════════
// REQUESTS — REJECT
//
// 3-level email fallback:
//   Level 1 — employees table
//   Level 2 — request.emp_email (saved at submission time)
//   Level 3 — advance_payment_resubmit_tokens.employee_email
// ════════════════════════════════════════════════════════════════════════════

export async function rejectRequest(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id }               = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !String(rejection_reason).trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    }

    const reason    = String(rejection_reason).trim();
    const adminId   = null;
    const adminName = getAdminName(req);

    const { rows } = await client.query(
      `SELECT r.*, pt.label AS payment_type_label
       FROM advance_payment_requests r
       JOIN advance_payment_types pt ON pt.key = r.payment_type_key
       WHERE r.id = $1`,
      [id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    if (rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot reject a request with status '${rows[0].status}'`,
      });
    }

    const request = rows[0];

    await client.query(
      `UPDATE advance_payment_requests
       SET status           = 'rejected',
           reviewed_by      = $1,
           reviewed_by_name = $2,
           reviewed_at      = NOW(),
           rejection_reason = $3,
           updated_at       = NOW()
       WHERE id = $4`,
      [adminId, adminName, reason, id]
    );

    await client.query(
      `INSERT INTO advance_payment_history
         (request_id, from_status, to_status, changed_by, changed_by_name, reason)
       VALUES ($1, 'pending', 'rejected', $2, $3, $4)`,
      [id, adminId, adminName, reason]
    );

    // Level 1: employees table
    let employeeEmail = null;
    try {
      const empRes = await client.query(
        `SELECT email FROM employees WHERE employee_id = $1 LIMIT 1`,
        [request.emp_id]
      );
      if (empRes.rows.length && empRes.rows[0].email) {
        employeeEmail = empRes.rows[0].email;
        console.log(`rejectRequest: ✅ Email from employees table: ${employeeEmail}`);
      }
    } catch (_) { /* non-fatal */ }

    // Level 2: emp_email on the request
    if (!employeeEmail && request.emp_email) {
      employeeEmail = request.emp_email;
      console.log(`rejectRequest: ✅ Email from request.emp_email: ${employeeEmail}`);
    }

    const resubmitToken = generateResubmitToken();
    const expiresAt     = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await client.query(
      `INSERT INTO advance_payment_resubmit_tokens
         (token, original_request_id, employee_email, expires_at, is_used)
       VALUES ($1, $2, $3, $4, false)`,
      [resubmitToken, id, employeeEmail, expiresAt]
    );

    await client.query('COMMIT');

    const resubmitLink = `${frontendUrl()}/advance-resubmit/${resubmitToken}`;

    fireEmail('rejection-email', async () => {
      let emailTo = employeeEmail;
      // Level 3: resubmit token record
      if (!emailTo) {
        try {
          const tokRes = await pool.query(
            `SELECT employee_email FROM advance_payment_resubmit_tokens WHERE token = $1`,
            [resubmitToken]
          );
          if (tokRes.rows[0]?.employee_email) {
            emailTo = tokRes.rows[0].employee_email;
            console.log(`rejectRequest: ✅ Email from resubmit token record: ${emailTo}`);
          }
        } catch (_) { /* non-fatal */ }
      }

      if (!emailTo) {
        console.warn(
          `rejectRequest: ❌ No email found for employee ${request.emp_id} ` +
          `(request #${id} / ${request.request_code}). ` +
          `Rejection email NOT sent. Run DB migration to add emp_email column.`
        );
        return;
      }

      await sendRejectionEmail({
        to:               { email: emailTo, name: request.emp_name },
        requestCode:      request.request_code,
        amount:           request.amount,
        paymentTypeLabel: request.payment_type_label,
        rejectionReason:  reason,
        rejectedBy:       adminName,
        rejectedAt:       new Date(),
        resubmitLink,
        resubmitExpiry:   expiresAt,
      });
    });

    res.json({
      success: true,
      message: 'Request rejected and resubmit link sent to employee',
      data: {
        id,
        status:           'rejected',
        rejection_reason: reason,
        reviewed_by_name: adminName,
        reviewed_at:      new Date().toISOString(),
        resubmit_token:   resubmitToken,
        resubmit_expires: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('rejectRequest ERROR:', err.message);
    res.status(500).json({ success: false, message: 'Failed to reject request', error: err.message });
  } finally {
    client.release();
  }
}


// ════════════════════════════════════════════════════════════════════════════
// DEDUCTIONS
// ════════════════════════════════════════════════════════════════════════════

export async function getDeductions(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM advance_payment_deductions WHERE request_id = $1 ORDER BY created_at`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getDeductions:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch deductions' });
  }
}

export async function updateDeduction(req, res) {
  try {
    const { id }           = req.params;
    const { status, note } = req.body;
    const allowed          = ['upcoming', 'done', 'skipped'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${allowed.join(', ')}` });
    }
    const { rows } = await pool.query(
      `UPDATE advance_payment_deductions
       SET status = $1, note = $2,
           processed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE processed_at END,
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, note || null, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Deduction not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateDeduction:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update deduction' });
  }
}


// ════════════════════════════════════════════════════════════════════════════
// PAYMENT LINKS
// ════════════════════════════════════════════════════════════════════════════

export async function createLink(req, res) {
  try {
    const {
      payment_type_key,
      employee_email  = '',
      expires_in_days = 30,
      multi_use       = false,
    } = req.body;

    if (!payment_type_key) {
      return res.status(400).json({ success: false, message: 'payment_type_key is required' });
    }

    const typeCheck = await pool.query(
      'SELECT key, label, short_label FROM advance_payment_types WHERE key = $1 AND is_active = true',
      [payment_type_key]
    );
    if (!typeCheck.rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid payment_type_key' });
    }
    const paymentTypeLabel = typeCheck.rows[0].label;
    const adminName        = getAdminName(req);

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const token = Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expires_in_days));

    let rows;
    try {
      ({ rows } = await pool.query(
        `INSERT INTO advance_payment_links
           (token, payment_type_key, employee_email, expires_at, created_by, created_by_name, multi_use)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [token, payment_type_key, employee_email, expiresAt, null, adminName, Boolean(multi_use)]
      ));
    } catch (_) {
      ({ rows } = await pool.query(
        `INSERT INTO advance_payment_links
           (token, payment_type_key, employee_email, expires_at, created_by, created_by_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [token, payment_type_key, employee_email, expiresAt, null, adminName]
      ));
    }

    const link = `${frontendUrl()}/advance-request/${payment_type_key}/${token}`;

    if (employee_email) {
      fireEmail('link-email', () =>
        sendAdvancePaymentLinkEmail({
          to: { email: employee_email, name: employee_email },
          link, paymentTypeLabel, expiresAt, adminName,
        })
      );
    }

    res.status(201).json({ success: true, data: { ...rows[0], token, payment_type_key }, link });
  } catch (err) {
    console.error('createLink ERROR:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create link', error: err.message });
  }
}


export async function sendLinkEmail(req, res) {
  try {
    const { token, email, payment_type_key } = req.body;
    if (!token || !email) {
      return res.status(400).json({ success: false, message: 'token and email are required' });
    }
    const { rows } = await pool.query(
      `SELECT apl.*, apt.label FROM advance_payment_links apl
       JOIN advance_payment_types apt ON apt.key = apl.payment_type_key
       WHERE apl.token = $1`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Link not found' });

    const linkRow = rows[0];
    const ptKey   = payment_type_key || linkRow.payment_type_key;
    const link    = `${frontendUrl()}/advance-request/${ptKey}/${token}`;

    await sendAdvancePaymentLinkEmail({
      to: { email, name: email }, link,
      paymentTypeLabel: linkRow.label,
      expiresAt: linkRow.expires_at,
      adminName: getAdminName(req),
    });
    res.json({ success: true, message: `Link emailed to ${email}` });
  } catch (err) {
    console.error('sendLinkEmail ERROR:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send email', error: err.message });
  }
}


export async function validateLink(req, res) {
  try {
    const { token } = req.params;
    const { rows }  = await pool.query(
      `SELECT apl.*, apt.label, apt.short_label, apt.color, apt.description
       FROM advance_payment_links apl
       JOIN advance_payment_types apt ON apt.key = apl.payment_type_key
       WHERE apl.token = $1`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Link not found' });
    const link = rows[0];
    const isMultiUse = link.multi_use || false;
    if (!isMultiUse && link.is_used) {
      return res.status(400).json({ success: false, message: 'This link has already been used', expired: true });
    }
    if (new Date(link.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'This link has expired', expired: true });
    }
    res.json({ success: true, data: link });
  } catch (err) {
    console.error('validateLink:', err.message);
    res.status(500).json({ success: false, message: 'Failed to validate link' });
  }
}

export async function listLinks(req, res) {
  try {
    const { active_only } = req.query;
    let query = `
      SELECT apl.*, apt.label AS type_label, apt.short_label AS type_short
      FROM advance_payment_links apl
      JOIN advance_payment_types apt ON apt.key = apl.payment_type_key
    `;
    if (active_only === 'true') {
      query += ` WHERE (apl.is_used = false OR apl.multi_use = true) AND apl.expires_at > NOW()`;
    }
    query += ` ORDER BY apl.created_at DESC`;
    const { rows } = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('listLinks:', err.message);
    res.status(500).json({ success: false, message: 'Failed to list links' });
  }
}


// ════════════════════════════════════════════════════════════════════════════
// SALARY HISTORY
// ════════════════════════════════════════════════════════════════════════════

export async function getSalaryHistory(req, res) {
  try {
    const { emp_id, month, status } = req.query;
    const conditions = [];
    const params     = [];

    if (emp_id) { params.push(emp_id); conditions.push(`r.emp_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`d.status = $${params.length}`); }
    if (month)  { params.push(month);  conditions.push(`d.month_label = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT
         d.id            AS deduction_id,
         d.month_label,
         d.amount        AS deduction_amount,
         d.status        AS deduction_status,
         d.processed_at,
         r.id            AS request_id,
         r.request_code,
         r.emp_id,
         r.emp_name,
         r.emp_dept,
         r.amount        AS advance_amount,
         r.payment_type_key,
         r.reason,
         r.adjusted_in,
         pt.label        AS payment_type_label
       FROM advance_payment_deductions d
       JOIN advance_payment_requests r  ON r.id  = d.request_id
       JOIN advance_payment_types    pt ON pt.key = r.payment_type_key
       ${where}
       ORDER BY d.month_label, r.emp_name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getSalaryHistory:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch salary history' });
  }
}