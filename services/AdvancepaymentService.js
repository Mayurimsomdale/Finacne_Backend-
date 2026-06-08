// ─────────────────────────────────────────────────────────────────────────────
// FILE: services/AdvancepaymentService.js
// Mailjet email service for the Advance Payment module.
//
// Emails:
//   1. sendAdvancePaymentLinkEmail       — link sent to employee by admin
//   2. sendSubmissionConfirmationEmail   — receipt after employee submits
//   3. sendHRNewRequestNotification      — HR alert when request comes in
//   4. sendApprovalEmail                 — employee notified of approval
//   5. sendRejectionEmail                — employee notified of rejection
//                                          + resubmit link embedded in email
//   6. sendVendorApprovalEmail           — HR notified when org_to_vendor approved
//   7. sendVendorRejectionEmail          — HR notified when org_to_vendor rejected
// ─────────────────────────────────────────────────────────────────────────────
import Mailjet from 'node-mailjet';

// ── Mailjet client ─────────────────────────────────────────────────────────────
let mjClient = null;

function getClient() {
  if (!mjClient) {
    const apiKey    = process.env.MJ_JOB_PUBLIC;
    const apiSecret = process.env.MJ_JOB_PRIVATE;
    if (!apiKey || !apiSecret) {
      throw new Error('Mailjet keys missing: set MJ_JOB_PUBLIC and MJ_JOB_PRIVATE in .env');
    }
    mjClient = new Mailjet({ apiKey, apiSecret });
  }
  return mjClient;
}

// ── Sender identity ────────────────────────────────────────────────────────────
function getSender() {
  return {
    Email: process.env.HR_EMAIL || 'humanresources@instagrp.com',
    Name:  process.env.HR_NAME  || 'HR Team — Insta ICT Solutions',
  };
}

// ── Low-level send ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, htmlPart, textPart }) {
  const client = getClient();
  const sender = getSender();
  const toArr  = Array.isArray(to) ? to : [to];

  const result = await client.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From:     sender,
        To:       toArr.map(t => ({ Email: t.email, Name: t.name || t.email })),
        Subject:  subject,
        HTMLPart: htmlPart,
        TextPart: textPart || subject,
      },
    ],
  });
  return result.body;
}

// ── Utility formatters ─────────────────────────────────────────────────────────
function inr(n) {
  return 'Rs. ' + Number(n).toLocaleString('en-IN');
}

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
    : new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
}

function fmtShortDate(d) {
  return d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
}

// ── Shared CSS ─────────────────────────────────────────────────────────────────
const BASE_STYLE = `
  /* Reset */
  body, table, td, p, a, li, blockquote {
    -webkit-text-size-adjust: 100%;
    -ms-text-size-adjust: 100%;
  }
  body {
    margin: 0;
    padding: 0;
    background-color: #f2f4f8;
    font-family: Georgia, 'Times New Roman', Times, serif;
  }
  table { border-collapse: collapse; }
  img   { border: 0; outline: none; text-decoration: none; }
  a     { text-decoration: none; }

  /* Outer wrapper */
  .email-outer {
    width: 100%;
    background-color: #f2f4f8;
    padding: 40px 0;
  }

  /* Card container */
  .email-card {
    max-width: 620px;
    margin: 0 auto;
    background-color: #ffffff;
    border: 1px solid #dde1ea;
  }

  /* ── HEADER ── */
  .email-header {
    padding: 0;
  }
  .header-top-bar {
    height: 5px;
    background-color: #1b2a52;
  }
  .header-body {
    padding: 36px 48px 30px;
    border-bottom: 1px solid #e8ebf2;
  }
  .header-body.approved {
    border-bottom: 3px solid #1a6e3a;
  }
  .header-body.rejected {
    border-bottom: 3px solid #a32020;
  }
  .header-body.pending {
    border-bottom: 3px solid #b07a10;
  }
  .header-body.info {
    border-bottom: 3px solid #1b2a52;
  }

  .company-name {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #8a91a8;
    margin: 0 0 20px;
  }

  .email-title {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 24px;
    font-weight: normal;
    color: #0d1b3e;
    margin: 0 0 8px;
    line-height: 1.3;
  }

  .email-subtitle {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #6b7592;
    margin: 0;
    line-height: 1.6;
  }

  /* Status badge */
  .status-badge {
    display: inline-block;
    margin-top: 18px;
    padding: 5px 18px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    border: 1px solid currentColor;
  }
  .badge-approved { color: #1a6e3a; border-color: #1a6e3a; background-color: #f0faf4; }
  .badge-rejected { color: #a32020; border-color: #a32020; background-color: #fdf4f4; }
  .badge-pending  { color: #b07a10; border-color: #b07a10; background-color: #fdf8ec; }
  .badge-info     { color: #1b2a52; border-color: #1b2a52; background-color: #f0f2f8; }

  /* ── BODY ── */
  .email-body {
    padding: 36px 48px;
  }

  .greeting {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 16px;
    color: #0d1b3e;
    margin: 0 0 14px;
  }

  .body-text {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px;
    color: #3d4563;
    line-height: 1.8;
    margin: 0 0 20px;
  }

  /* Amount display */
  .amount-section {
    background-color: #f7f8fc;
    border: 1px solid #dde1ea;
    padding: 24px;
    text-align: center;
    margin: 24px 0;
  }
  .amount-label {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #8a91a8;
    margin: 0 0 8px;
  }
  .amount-value {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 36px;
    color: #0d1b3e;
    margin: 0;
    line-height: 1.1;
  }
  .amount-value.approved { color: #1a6e3a; }
  .amount-value.rejected { color: #a32020; }

  /* Info table */
  .info-table {
    width: 100%;
    border: 1px solid #e4e8f0;
    border-collapse: collapse;
    margin: 20px 0;
  }
  .info-table td {
    padding: 11px 18px;
    border-bottom: 1px solid #eef0f6;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    vertical-align: top;
  }
  .info-table tr:last-child td {
    border-bottom: none;
  }
  .info-label-cell {
    color: #8a91a8;
    font-weight: 600;
    white-space: nowrap;
    width: 40%;
    background-color: #fafbfd;
    letter-spacing: 0.2px;
  }
  .info-value-cell {
    color: #1c2340;
    font-weight: 500;
    padding-left: 16px !important;
  }
  .info-value-cell.mono {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #1b2a52;
  }

  /* Notice boxes */
  .notice-box {
    padding: 18px 20px;
    margin: 20px 0;
    border-left: 4px solid;
  }
  .notice-box.approved {
    background-color: #f0faf4;
    border-left-color: #1a6e3a;
  }
  .notice-box.rejected {
    background-color: #fdf4f4;
    border-left-color: #a32020;
  }
  .notice-box.pending {
    background-color: #fdf8ec;
    border-left-color: #b07a10;
  }
  .notice-box.info {
    background-color: #f0f2f8;
    border-left-color: #1b2a52;
  }
  .notice-title {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin: 0 0 7px;
  }
  .notice-box.approved .notice-title { color: #1a6e3a; }
  .notice-box.rejected .notice-title { color: #a32020; }
  .notice-box.pending  .notice-title { color: #b07a10; }
  .notice-box.info     .notice-title { color: #1b2a52; }
  .notice-text {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.75;
    margin: 0;
  }
  .notice-box.approved .notice-text { color: #1a5230; }
  .notice-box.rejected .notice-text { color: #7a1a1a; }
  .notice-box.pending  .notice-text  { color: #7a5210; }
  .notice-box.info     .notice-text  { color: #1b2a52; }

  /* Resubmit box */
  .resubmit-box {
    border: 1px solid #c8a828;
    background-color: #fdf8ec;
    padding: 26px 28px;
    margin: 24px 0;
    text-align: center;
  }
  .resubmit-title {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 17px;
    color: #5a3c00;
    margin: 0 0 8px;
  }
  .resubmit-sub {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #7a5210;
    line-height: 1.7;
    margin: 0 0 20px;
  }
  .resubmit-expiry {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #8a6220;
    margin: 14px 0 0;
  }

  /* CTA Button */
  .btn-wrap {
    text-align: center;
    margin: 24px 0;
  }
  .btn {
    display: inline-block;
    padding: 14px 36px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #ffffff !important;
    text-decoration: none;
  }
  .btn-navy    { background-color: #1b2a52; }
  .btn-green   { background-color: #1a6e3a; }
  .btn-red     { background-color: #a32020; }
  .btn-amber   { background-color: #b07a10; }

  /* URL fallback text */
  .url-fallback {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #8a91a8;
    line-height: 1.7;
    margin: 8px 0 0;
    text-align: center;
  }
  .url-text {
    color: #1b2a52;
    word-break: break-all;
    display: block;
    margin-top: 4px;
  }

  /* Divider */
  .divider {
    border: none;
    border-top: 1px solid #eef0f6;
    margin: 24px 0;
  }

  /* Reference text */
  .ref-text {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #8a91a8;
    line-height: 1.7;
    margin: 0;
  }
  .ref-code {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    background-color: #f2f4f8;
    padding: 2px 6px;
    color: #1b2a52;
    font-weight: 700;
  }

  /* ── FOOTER ── */
  .email-footer {
    background-color: #1b2a52;
    padding: 28px 48px;
    text-align: center;
  }
  .footer-company {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #ffffff;
    margin: 0 0 6px;
  }
  .footer-dept {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
    margin: 0 0 14px;
  }
  .footer-note {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.40);
    line-height: 1.8;
    margin: 0;
  }
  .footer-line {
    width: 40px;
    height: 1px;
    background-color: rgba(255, 255, 255, 0.2);
    margin: 14px auto;
  }
`;

// ── HTML wrapper ───────────────────────────────────────────────────────────────
function htmlWrapper({
  headerVariant = 'info',
  headerTitle,
  headerSubtitle,
  badgeLabel,
  bodyContent,
  footerNote = 'This is an automated notification from the HR system. Please do not reply to this email.',
}) {
  const badgeClass = {
    approved: 'badge-approved',
    rejected: 'badge-rejected',
    pending:  'badge-pending',
    info:     'badge-info',
  }[headerVariant] || 'badge-info';

  const badgeHtml = badgeLabel
    ? `<div><span class="status-badge ${badgeClass}">${badgeLabel}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${headerTitle}</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
<div class="email-outer">
  <div class="email-card">

    <!-- HEADER -->
    <div class="email-header">
      <div class="header-top-bar"></div>
      <div class="header-body ${headerVariant}">
        <p class="company-name">Insta ICT Solutions &nbsp;&mdash;&nbsp; HR Department</p>
        <h1 class="email-title">${headerTitle}</h1>
        <p class="email-subtitle">${headerSubtitle}</p>
        ${badgeHtml}
      </div>
    </div>

    <!-- BODY -->
    <div class="email-body">
      ${bodyContent}
    </div>

    <!-- FOOTER -->
    <div class="email-footer">
      <p class="footer-company">Insta ICT Solutions</p>
      <p class="footer-dept">Human Resources Department</p>
      <div class="footer-line"></div>
      <p class="footer-note">${footerNote}</p>
    </div>

  </div>
</div>
</body>
</html>`;
}

// ── Info row helper ────────────────────────────────────────────────────────────
function infoRow(label, value, mono = false) {
  return `
    <tr>
      <td class="info-label-cell">${label}</td>
      <td class="info-value-cell${mono ? ' mono' : ''}">${value}</td>
    </tr>`;
}


// =============================================================================
// 1. SEND PAYMENT LINK TO EMPLOYEE
// =============================================================================
export async function sendAdvancePaymentLinkEmail({ to, link, paymentTypeLabel, expiresAt, adminName }) {
  const expiry = fmtShortDate(expiresAt);
  const recipientName = to.name || 'Employee';

  const bodyContent = `
    <p class="greeting">Dear ${recipientName},</p>
    <p class="body-text">
      The HR team has prepared an <strong>Advance Payment Request form</strong> for you.
      Please use the button below to open the form, complete your details, and upload the
      required payment screenshot.
    </p>

    <table class="info-table">
      <tbody>
        ${infoRow('Payment Type', paymentTypeLabel)}
        ${infoRow('Prepared By',  adminName)}
        ${infoRow('Link Valid Until', expiry)}
      </tbody>
    </table>

    <div class="btn-wrap">
      <a href="${link}" class="btn btn-navy">Open Request Form</a>
    </div>

    <hr class="divider">

    <p class="ref-text">
      If the button above does not work, copy and paste the following link into your browser:
      <span class="url-text" style="color:#1b2a52;word-break:break-all;">${link}</span>
    </p>
    <p class="ref-text" style="margin-top:12px;">
      This link is valid until <strong>${expiry}</strong> and can only be used once.
      If it has expired, please contact HR to request a new one.
    </p>
  `;

  return sendEmail({
    to: [to],
    subject: `Action Required: Advance Payment Request Form — ${paymentTypeLabel}`,
    htmlPart: htmlWrapper({
      headerVariant: 'info',
      headerTitle:   'Advance Payment Request Form',
      headerSubtitle: `HR has shared a form with you for: ${paymentTypeLabel}`,
      badgeLabel:    'Action Required',
      bodyContent,
      footerNote:    `This link expires on ${expiry}. Contact HR if you need assistance.`,
    }),
    textPart: `
Advance Payment Request Form
-----------------------------
Dear ${recipientName},

HR has shared an Advance Payment Request form with you.

Payment Type : ${paymentTypeLabel}
Prepared By  : ${adminName}
Valid Until  : ${expiry}

Open the form here:
${link}

If the link has expired, please contact HR for a new one.

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// =============================================================================
// 2. SUBMISSION CONFIRMATION
// =============================================================================
export async function sendSubmissionConfirmationEmail({ to, requestCode, amount, paymentTypeLabel, reason, submittedAt }) {
  const date          = fmtDate(submittedAt);
  const recipientName = to.name || 'Employee';

  const bodyContent = `
    <p class="greeting">Dear ${recipientName},</p>
    <p class="body-text">
      Your advance payment request has been <strong>received and submitted successfully</strong>.
      Our HR team will review it and notify you of the outcome within 1 to 2 business days.
    </p>

    <div class="amount-section">
      <p class="amount-label">Amount Requested</p>
      <p class="amount-value">${inr(amount)}</p>
    </div>

    <table class="info-table">
      <tbody>
        ${infoRow('Request Reference', requestCode, true)}
        ${infoRow('Payment Type',      paymentTypeLabel)}
        ${infoRow('Reason',            reason)}
        ${infoRow('Submitted On',      date)}
      </tbody>
    </table>

    <div class="notice-box pending">
      <p class="notice-title">Pending Review</p>
      <p class="notice-text">
        Your request has been placed in the review queue. Please retain your reference code
        <span class="ref-code">${requestCode}</span> for future correspondence with HR.
      </p>
    </div>

    <hr class="divider">
    <p class="ref-text">Reference: <span class="ref-code">${requestCode}</span></p>
  `;

  return sendEmail({
    to: [to],
    subject: `Request Received: Advance Payment ${requestCode} — Pending Review`,
    htmlPart: htmlWrapper({
      headerVariant:  'pending',
      headerTitle:    'Request Submitted Successfully',
      headerSubtitle: `Your advance payment request is now under review by HR`,
      badgeLabel:     'Pending Review',
      bodyContent,
    }),
    textPart: `
Request Submitted Successfully
--------------------------------
Dear ${recipientName},

Your advance payment request has been received.

Reference  : ${requestCode}
Type       : ${paymentTypeLabel}
Amount     : ${inr(amount)}
Reason     : ${reason}
Submitted  : ${date}
Status     : Pending Review

Please keep your reference code for HR correspondence.

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// =============================================================================
// 3. HR NOTIFICATION — New request submitted
// =============================================================================
export async function sendHRNewRequestNotification({ hrEmail, requestCode, empName, empId, empDept, amount, paymentTypeLabel, reason, adminPanelUrl }) {

  const bodyContent = `
    <p class="greeting">HR Team,</p>
    <p class="body-text">
      A new advance payment request has been submitted by an employee via a shared link.
      Please log in to the admin panel to review and take action.
    </p>

    <div class="amount-section">
      <p class="amount-label">Amount Requested</p>
      <p class="amount-value">${inr(amount)}</p>
    </div>

    <table class="info-table">
      <tbody>
        ${infoRow('Request Reference', requestCode, true)}
        ${infoRow('Employee Name',     empName)}
        ${infoRow('Employee ID',       empId, true)}
        ${infoRow('Department',        empDept)}
        ${infoRow('Payment Type',      paymentTypeLabel)}
        ${infoRow('Reason for Request', reason)}
      </tbody>
    </table>

    <div class="btn-wrap">
      <a href="${adminPanelUrl || '#'}" class="btn btn-navy">Review in Admin Panel</a>
    </div>

    <div class="notice-box info">
      <p class="notice-title">Action Required</p>
      <p class="notice-text">
        This request is awaiting your review. Please approve or reject it with a clear reason.
        The employee will be notified automatically once a decision is recorded.
      </p>
    </div>

    <hr class="divider">
    <p class="ref-text">Reference: <span class="ref-code">${requestCode}</span></p>
  `;

  return sendEmail({
    to: [{ email: hrEmail, name: 'HR Team' }],
    subject: `New Advance Request: ${requestCode} — ${empName} (${inr(amount)})`,
    htmlPart: htmlWrapper({
      headerVariant:  'info',
      headerTitle:    'New Advance Payment Request',
      headerSubtitle: `${empName} has submitted a request requiring your review`,
      badgeLabel:     'Awaiting Review',
      bodyContent,
    }),
    textPart: `
New Advance Payment Request
-----------------------------
HR Team,

A new request has been submitted and requires your review.

Reference  : ${requestCode}
Employee   : ${empName} (${empId})
Department : ${empDept}
Type       : ${paymentTypeLabel}
Amount     : ${inr(amount)}
Reason     : ${reason}

Review here: ${adminPanelUrl || 'N/A'}

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// =============================================================================
// 4. APPROVAL EMAIL
// =============================================================================
export async function sendApprovalEmail({ to, requestCode, amount, paymentTypeLabel, adjustedIn, approvedBy, approvedAt }) {
  const date          = fmtDate(approvedAt);
  const recipientName = to.name || 'Employee';

  const bodyContent = `
    <p class="greeting">Dear ${recipientName},</p>
    <p class="body-text">
      We are pleased to inform you that your advance payment request has been
      <strong>approved</strong> by the HR team.
    </p>

    <div class="amount-section">
      <p class="amount-label">Amount Approved</p>
      <p class="amount-value approved">${inr(amount)}</p>
    </div>

    <table class="info-table">
      <tbody>
        ${infoRow('Request Reference',      requestCode, true)}
        ${infoRow('Payment Type',           paymentTypeLabel)}
        ${adjustedIn ? infoRow('Salary Adjustment Month', adjustedIn) : ''}
        ${infoRow('Approved By',            approvedBy)}
        ${infoRow('Approved On',            date)}
      </tbody>
    </table>

    <div class="notice-box approved">
      <p class="notice-title">Request Approved</p>
      <p class="notice-text">
        Your advance payment request for <strong>${inr(amount)}</strong> has been approved.
        The funds will be disbursed as per HR's scheduled process.
      </p>
    </div>

    ${adjustedIn ? `
    <div class="notice-box info">
      <p class="notice-title">Salary Deduction Notice</p>
      <p class="notice-text">
        Please note that the approved amount of <strong>${inr(amount)}</strong> will be
        adjusted as a deduction from your <strong>${adjustedIn}</strong> salary.
        If you have any queries regarding the deduction schedule, please contact HR directly.
      </p>
    </div>` : ''}

    <hr class="divider">
    <p class="ref-text">Reference: <span class="ref-code">${requestCode}</span></p>
  `;

  return sendEmail({
    to: [to],
    subject: `Approved: Advance Payment Request ${requestCode} — ${inr(amount)}`,
    htmlPart: htmlWrapper({
      headerVariant:  'approved',
      headerTitle:    'Advance Payment Approved',
      headerSubtitle: `Your request ${requestCode} has been approved by HR`,
      badgeLabel:     'Approved',
      bodyContent,
    }),
    textPart: `
Advance Payment Request Approved
----------------------------------
Dear ${recipientName},

Your advance payment request has been approved.

Reference          : ${requestCode}
Amount Approved    : ${inr(amount)}
Type               : ${paymentTypeLabel}
Salary Adjustment  : ${adjustedIn || 'N/A'}
Approved By        : ${approvedBy}
Approved On        : ${date}

The advance amount will be deducted from your ${adjustedIn || 'upcoming'} salary.

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// =============================================================================
// 5. REJECTION EMAIL
//    Always includes a resubmit CTA when a resubmit link is provided.
// =============================================================================
export async function sendRejectionEmail({
  to,
  requestCode,
  amount,
  paymentTypeLabel,
  rejectionReason,
  rejectedBy,
  rejectedAt,
  resubmitLink,
  resubmitExpiry,
}) {
  const date          = fmtDate(rejectedAt);
  const expiryLabel   = resubmitExpiry ? fmtShortDate(resubmitExpiry) : null;
  const recipientName = to.name || 'Employee';

  const resubmitSection = resubmitLink ? `
    <div class="resubmit-box">
      <p class="resubmit-title">Would you like to edit and resubmit?</p>
      <p class="resubmit-sub">
        Use the button below to open a pre-filled form with your original request details.
        Review the rejection reason, make the necessary corrections, upload a fresh screenshot,
        and resubmit your request.
      </p>
      <div class="btn-wrap" style="margin:0;">
        <a href="${resubmitLink}" class="btn btn-amber">Edit and Resubmit Request</a>
      </div>
      ${expiryLabel ? `<p class="resubmit-expiry">This resubmit link expires on <strong>${expiryLabel}</strong> and can only be used once.</p>` : ''}
    </div>

    <p class="url-fallback">
      If the button does not work, copy and paste this URL into your browser:
      <span class="url-text" style="color:#b07a10;">${resubmitLink}</span>
    </p>
  ` : `
    <div class="notice-box info">
      <p class="notice-title">Next Steps</p>
      <p class="notice-text">
        If you believe this decision was made in error, or you have additional supporting
        documents to provide, please contact your HR manager to discuss further options.
      </p>
    </div>
  `;

  const bodyContent = `
    <p class="greeting">Dear ${recipientName},</p>
    <p class="body-text">
      We regret to inform you that your advance payment request has not been approved
      at this time. Please review the details and reason provided below.
    </p>

    <div class="amount-section">
      <p class="amount-label">Amount Requested</p>
      <p class="amount-value rejected">${inr(amount)}</p>
    </div>

    <table class="info-table">
      <tbody>
        ${infoRow('Request Reference', requestCode, true)}
        ${infoRow('Payment Type',      paymentTypeLabel)}
        ${infoRow('Rejected By',       rejectedBy)}
        ${infoRow('Rejected On',       date)}
      </tbody>
    </table>

    <div class="notice-box rejected">
      <p class="notice-title">Reason for Rejection</p>
      <p class="notice-text">
        ${rejectionReason || 'No specific reason was provided. Please contact HR for further clarification.'}
      </p>
    </div>

    ${resubmitSection}

    <hr class="divider">
    <p class="ref-text">Reference: <span class="ref-code">${requestCode}</span></p>
  `;

  const subjectSuffix = resubmitLink ? ' — Please Review and Resubmit' : ' — Request Not Approved';

  return sendEmail({
    to: [to],
    subject: `Request Update: Advance Payment ${requestCode}${subjectSuffix}`,
    htmlPart: htmlWrapper({
      headerVariant:  'rejected',
      headerTitle:    'Advance Payment Not Approved',
      headerSubtitle: `Your request ${requestCode} has not been approved`,
      badgeLabel:     'Not Approved',
      bodyContent,
    }),
    textPart: `
Advance Payment Request — Not Approved
----------------------------------------
Dear ${recipientName},

Your advance payment request has not been approved.

Reference  : ${requestCode}
Type       : ${paymentTypeLabel}
Amount     : ${inr(amount)}
Rejected By: ${rejectedBy}
Rejected On: ${date}
Reason     : ${rejectionReason || 'No reason provided. Please contact HR.'}

${resubmitLink ? `RESUBMIT YOUR REQUEST (valid until ${expiryLabel}):\n${resubmitLink}\n\nThis link can only be used once.` : 'Please contact your HR manager if you wish to discuss this decision.'}

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// =============================================================================
// 6. VENDOR APPROVAL EMAIL
//    Sent to HR_EMAIL when an org_to_vendor request is approved.
//    Since vendors are external with no system email, HR is notified instead
//    so they can proceed with disbursing the payment to the vendor.
// =============================================================================
export async function sendVendorApprovalEmail({
  hrEmail,
  requestCode,
  vendorName,
  vendorGST,
  vendorRef,
  amount,
  reason,
  approverName,
  approvedBy,
  approvedAt,
  adjustedIn,
}) {
  const date = fmtDate(approvedAt);

  const bodyContent = `
    <p class="greeting">HR Team,</p>
    <p class="body-text">
      The following <strong>Organization &rarr; Vendor</strong> advance payment request
      has been <strong>approved</strong>. Please proceed with disbursing the payment
      to the vendor as per your payment schedule.
    </p>

    <div class="amount-section">
      <p class="amount-label">Amount Approved</p>
      <p class="amount-value approved">${inr(amount)}</p>
    </div>

    <table class="info-table">
      <tbody>
        ${infoRow('Request Reference',          requestCode, true)}
        ${infoRow('Vendor Name',                vendorName)}
        ${vendorGST ? infoRow('GST Number',     vendorGST, true) : ''}
        ${vendorRef ? infoRow('PO / Reference', vendorRef, true) : ''}
        ${infoRow('Reason for Payment',         reason)}
        ${approverName ? infoRow('Authorized By', approverName) : ''}
        ${infoRow('Approved By (Admin)',         approvedBy)}
        ${adjustedIn ? infoRow('Adjusted In',   adjustedIn) : ''}
        ${infoRow('Approved On',                date)}
      </tbody>
    </table>

    <div class="notice-box approved">
      <p class="notice-title">Vendor Payment Approved — Action Required</p>
      <p class="notice-text">
        Please disburse <strong>${inr(amount)}</strong> to <strong>${vendorName}</strong>
        at your earliest convenience. Ensure this reference code
        <span class="ref-code">${requestCode}</span> is quoted in your payment records.
      </p>
    </div>

    <div class="notice-box info">
      <p class="notice-title">Remittance Checklist</p>
      <p class="notice-text">
        Before processing the payment, verify the following:<br>
        &bull; Vendor name matches your records: <strong>${vendorName}</strong><br>
        ${vendorGST ? `&bull; GST number on invoice matches: <strong>${vendorGST}</strong><br>` : ''}
        ${vendorRef ? `&bull; PO / reference on file: <strong>${vendorRef}</strong><br>` : ''}
        &bull; Amount to disburse: <strong>${inr(amount)}</strong>
      </p>
    </div>

    <hr class="divider">
    <p class="ref-text">Reference: <span class="ref-code">${requestCode}</span></p>
  `;

  return sendEmail({
    to: [{ email: hrEmail, name: 'HR Team' }],
    subject: `Vendor Advance Approved: ${requestCode} — ${vendorName} (${inr(amount)})`,
    htmlPart: htmlWrapper({
      headerVariant:  'approved',
      headerTitle:    'Vendor Advance Payment Approved',
      headerSubtitle: `Request ${requestCode} for ${vendorName} has been approved — please disburse`,
      badgeLabel:     'Approved',
      bodyContent,
    }),
    textPart: `
Vendor Advance Payment Approved
---------------------------------
HR Team,

The following vendor advance payment has been approved.

Reference    : ${requestCode}
Vendor       : ${vendorName}
GST          : ${vendorGST  || 'N/A'}
PO / Ref     : ${vendorRef  || 'N/A'}
Amount       : ${inr(amount)}
Reason       : ${reason}
Authorized By: ${approverName || 'N/A'}
Approved By  : ${approvedBy}
Adjusted In  : ${adjustedIn || 'N/A'}
Approved On  : ${date}

Please disburse ${inr(amount)} to ${vendorName} and quote reference ${requestCode} in your payment records.

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// =============================================================================
// 7. VENDOR REJECTION EMAIL
//    Sent to HR_EMAIL when an org_to_vendor request is rejected.
//    Includes the rejection reason so HR knows not to disburse and why.
// =============================================================================
export async function sendVendorRejectionEmail({
  hrEmail,
  requestCode,
  vendorName,
  vendorGST,
  vendorRef,
  amount,
  reason,
  approverName,
  rejectionReason,
  rejectedBy,
  rejectedAt,
}) {
  const date = fmtDate(rejectedAt);

  const bodyContent = `
    <p class="greeting">HR Team,</p>
    <p class="body-text">
      The following <strong>Organization &rarr; Vendor</strong> advance payment request
      has been <strong>rejected</strong>. <strong>Do not disburse</strong> any payment
      for this request. Please review the rejection reason below and take appropriate action.
    </p>

    <div class="amount-section">
      <p class="amount-label">Amount Requested (Not to be Disbursed)</p>
      <p class="amount-value rejected">${inr(amount)}</p>
    </div>

    <table class="info-table">
      <tbody>
        ${infoRow('Request Reference',          requestCode, true)}
        ${infoRow('Vendor Name',                vendorName)}
        ${vendorGST ? infoRow('GST Number',     vendorGST, true) : ''}
        ${vendorRef ? infoRow('PO / Reference', vendorRef, true) : ''}
        ${infoRow('Reason for Request',         reason)}
        ${approverName ? infoRow('Original Authorizer', approverName) : ''}
        ${infoRow('Rejected By',                rejectedBy)}
        ${infoRow('Rejected On',                date)}
      </tbody>
    </table>

    <div class="notice-box rejected">
      <p class="notice-title">Reason for Rejection</p>
      <p class="notice-text">
        ${rejectionReason || 'No specific reason was provided. Please contact the admin for clarification.'}
      </p>
    </div>

    <div class="notice-box info">
      <p class="notice-title">Next Steps</p>
      <p class="notice-text">
        If this rejection was made in error or you have additional supporting documentation,
        please contact the admin team to raise a fresh request. Ensure all vendor details,
        GST numbers, and PO references are verified before resubmitting.
      </p>
    </div>

    <hr class="divider">
    <p class="ref-text">Reference: <span class="ref-code">${requestCode}</span></p>
  `;

  return sendEmail({
    to: [{ email: hrEmail, name: 'HR Team' }],
    subject: `Vendor Advance Rejected: ${requestCode} — ${vendorName} | Reason Enclosed`,
    htmlPart: htmlWrapper({
      headerVariant:  'rejected',
      headerTitle:    'Vendor Advance Payment Rejected',
      headerSubtitle: `Request ${requestCode} for ${vendorName} has been rejected — do not disburse`,
      badgeLabel:     'Rejected',
      bodyContent,
    }),
    textPart: `
Vendor Advance Payment Rejected
----------------------------------
HR Team,

The following vendor advance payment request has been REJECTED.
DO NOT disburse any payment for this request.

Reference        : ${requestCode}
Vendor           : ${vendorName}
GST              : ${vendorGST       || 'N/A'}
PO / Ref         : ${vendorRef       || 'N/A'}
Amount           : ${inr(amount)}
Reason           : ${reason}
Authorized By    : ${approverName    || 'N/A'}
Rejected By      : ${rejectedBy}
Rejected On      : ${date}
Rejection Reason : ${rejectionReason || 'No reason provided. Please contact the admin.'}

If you believe this was rejected in error, please contact the admin team to raise a new request.

Insta ICT Solutions — HR Department
    `.trim(),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default {
  sendAdvancePaymentLinkEmail,
  sendSubmissionConfirmationEmail,
  sendHRNewRequestNotification,
  sendApprovalEmail,
  sendRejectionEmail,
  sendVendorApprovalEmail,
  sendVendorRejectionEmail,
};