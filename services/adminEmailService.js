// services/adminEmailService.js
// ─── Auth-related email notifications ────────────────────────────────────────
// Covers:
//   1. sendPasswordResetOTPEmail       — OTP email to admin on forgot-password
//   2. sendAdminRegistrationEmail      — Welcome email to newly registered admin
//   3. sendHRAdminRegistrationNotification — Security alert to HR on new admin signup
//
// All functions return { success: boolean, result?, error? }
// They NEVER throw — callers can fire-and-forget safely.
// =============================================================================

import Mailjet from 'node-mailjet';

// ── Mailjet client ────────────────────────────────────────────────────────────
const mj = Mailjet.apiConnect(
  process.env.MJ_JOB_PUBLIC,
  process.env.MJ_JOB_PRIVATE
);

// ── Constants ─────────────────────────────────────────────────────────────────
const HR_EMAIL   = process.env.HR_EMAIL  || 'humanresources@instagrp.com';
const HR_NAME    = process.env.HR_NAME   || 'HR Team — Insta ICT Solutions';
const COMPANY    = 'Insta ICT Solutions';
const YEAR       = new Date().getFullYear();
const FRONTEND   = process.env.FRONTEND_URL || 'http://localhost:3000';

// ══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Low-level send ────────────────────────────────────────────────────────────
async function sendEmail({ to, toName, subject, htmlBody, textBody }) {
  try {
    const result = await mj.post('send', { version: 'v3.1' }).request({
      Messages: [{
        From:     { Email: HR_EMAIL, Name: HR_NAME },
        To:       [{ Email: to, Name: toName || to }],
        Subject:  subject,
        TextPart: textBody || subject,
        HTMLPart: htmlBody,
      }],
    });
    console.log(`✅ [adminEmailService] Email sent → ${to} | "${subject}"`);
    return { success: true, result: result.body };
  } catch (err) {
    console.error(`❌ [adminEmailService] Email FAILED → ${to} | ${err.message}`);
    if (err.statusCode) {
      console.error(`   Mailjet HTTP ${err.statusCode}:`, JSON.stringify(err.response?.body || {}));
    }
    return { success: false, error: err.message };
  }
}

// ── Shared CSS (scoped — no conflicts with emailService.js) ───────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: #f0f2f7;
    font-family: Georgia, 'Times New Roman', Times, serif;
    -webkit-text-size-adjust: 100%;
  }
  table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
  img   { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  a     { text-decoration: none; }
  .outer { background-color: #f0f2f7; padding: 44px 16px; width: 100%; }
  .card  { max-width: 620px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d8dce8; }
  .accent-bar   { height: 4px; }
  .accent-navy  { background-color: #162040; }
  .accent-green { background-color: #145a30; }
  .header {
    padding: 36px 48px 28px;
    border-bottom: 3px solid #162040;
  }
  .header-green { border-bottom-color: #145a30; }
  .org-label {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px; font-weight: 700; letter-spacing: 2.5px;
    text-transform: uppercase; color: #9098b4; margin: 0 0 16px;
  }
  .header-title {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 24px; font-weight: normal; color: #0e1a3a;
    margin: 0 0 8px; line-height: 1.25; letter-spacing: -0.3px;
  }
  .header-subtitle {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px; color: #6b7592; margin: 0; line-height: 1.65;
  }
  .badge {
    display: inline-block; margin-top: 14px; padding: 4px 14px;
    font-family: Arial, Helvetica, sans-serif; font-size: 10px;
    font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; border: 1px solid;
  }
  .badge-navy  { color: #162040; border-color: #162040; background-color: #f0f2f8; }
  .badge-green { color: #145a30; border-color: #145a30; background-color: #edf7f1; }
  .body { padding: 32px 48px; }
  .greeting {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 16px; color: #0e1a3a; margin: 0 0 12px;
  }
  .lead {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px; color: #3d4563; line-height: 1.85; margin: 0 0 20px;
  }
  /* OTP / ID panel */
  .code-panel {
    background-color: #f7f8fc; border: 1px solid #dde1ea;
    padding: 24px; text-align: center; margin: 20px 0;
  }
  .code-label {
    font-family: Arial, Helvetica, sans-serif; font-size: 10px;
    font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    color: #9098b4; margin: 0 0 10px;
  }
  .code-value {
    font-family: 'Courier New', Courier, monospace;
    font-size: 46px; font-weight: 700; letter-spacing: 14px;
    color: #162040; margin: 0; line-height: 1.1;
  }
  .code-value.green { color: #145a30; }
  .code-note {
    font-family: Arial, Helvetica, sans-serif; font-size: 11px;
    color: #9098b4; margin: 12px 0 0;
  }
  /* Info table */
  .info-table { width: 100%; border: 1px solid #e0e4f0; border-collapse: collapse; margin: 18px 0; }
  .info-table td {
    padding: 10px 16px; border-bottom: 1px solid #eef0f8;
    font-family: Arial, Helvetica, sans-serif; font-size: 13px; vertical-align: top;
  }
  .info-table tr:last-child td { border-bottom: none; }
  .info-label {
    color: #9098b4; font-weight: 600; font-size: 11px; letter-spacing: 0.3px;
    white-space: nowrap; width: 36%; background-color: #fafbfd; text-transform: uppercase;
  }
  .info-value { color: #1c2340; font-weight: 500; padding-left: 16px !important; }
  /* Notices */
  .notice { padding: 16px 20px; margin: 18px 0; border-left: 4px solid; }
  .notice-navy   { background: #f0f2f8; border-color: #162040; }
  .notice-green  { background: #edf7f1; border-color: #145a30; }
  .notice-amber  { background: #fdf6e8; border-color: #a0620a; }
  .notice-red    { background: #fdf1f1; border-color: #8e1c1c; }
  .notice-title {
    font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 700;
    letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 6px;
  }
  .notice-navy  .notice-title { color: #162040; }
  .notice-green .notice-title { color: #145a30; }
  .notice-amber .notice-title { color: #a0620a; }
  .notice-red   .notice-title { color: #8e1c1c; }
  .notice-text {
    font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.8; margin: 0;
  }
  .notice-navy  .notice-text { color: #2a3560; }
  .notice-green .notice-text { color: #1a5a32; }
  .notice-amber .notice-text { color: #7a4a08; }
  .notice-red   .notice-text { color: #6e1818; }
  /* Steps */
  .steps-table { width: 100%; border-collapse: collapse; }
  .step-num-cell { width: 34px; vertical-align: middle; padding: 10px 10px 10px 0; }
  .step-num {
    width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px;
    font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700;
    color: #ffffff; background-color: #162040;
  }
  .step-num.green { background-color: #145a30; }
  .step-text {
    font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #3d4563;
    line-height: 1.7; padding: 10px 0; vertical-align: middle;
    border-bottom: 1px solid #f0f2f8;
  }
  /* Button */
  .btn-wrap { text-align: center; margin: 24px 0; }
  .btn {
    display: inline-block; padding: 13px 36px;
    font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: 1px; text-transform: uppercase; color: #ffffff !important; text-decoration: none;
    background-color: #162040;
  }
  .btn-green { background-color: #145a30; }
  /* Divider */
  .divider { border: none; border-top: 1px solid #e8eaf2; margin: 24px 0; }
  .ref-text {
    font-family: Arial, Helvetica, sans-serif; font-size: 12px;
    color: #9098b4; line-height: 1.7; margin: 0;
  }
  /* Footer */
  .footer { background-color: #162040; padding: 28px 48px; text-align: center; }
  .footer-company {
    font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase; color: #fff; margin: 0 0 5px;
  }
  .footer-dept  { font-family: Arial,Helvetica,sans-serif; font-size: 11px; color: rgba(255,255,255,0.50); margin: 0 0 14px; }
  .footer-line  { width: 36px; height: 1px; background: rgba(255,255,255,0.18); margin: 12px auto; }
  .footer-note  { font-family: Arial,Helvetica,sans-serif; font-size: 11px; color: rgba(255,255,255,0.38); line-height: 1.9; margin: 0; }
  .footer-link  { color: rgba(255,255,255,0.60); text-decoration: underline; }
  .footer-copy  { font-family: Arial,Helvetica,sans-serif; font-size: 10px; color: rgba(255,255,255,0.25); margin: 10px 0 0; }
  @media (max-width: 600px) {
    .header, .body, .footer { padding-left: 20px !important; padding-right: 20px !important; }
    .code-value { font-size: 32px !important; letter-spacing: 8px !important; }
  }
`;

// ── Base HTML wrapper ─────────────────────────────────────────────────────────
function buildHtml(preheader, {
  accentVariant = 'navy',
  headerVariant = 'navy',
  headerTitle,
  headerSubtitle,
  badgeLabel,
  bodyContent,
}) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${COMPANY}</title>
  <style>${BASE_CSS}</style>
</head>
<body>
<div class="outer">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f2f7;">${preheader}</div>
  <div class="card">
    <div class="accent-bar accent-${accentVariant}"></div>
    <div class="header header-${headerVariant === 'green' ? 'green' : ''}">
      <p class="org-label">Insta ICT Solutions &nbsp;&mdash;&nbsp; Human Resources</p>
      <h1 class="header-title">${headerTitle}</h1>
      <p class="header-subtitle">${headerSubtitle}</p>
      ${badgeLabel ? `<div><span class="badge badge-${headerVariant}">${badgeLabel}</span></div>` : ''}
    </div>
    <div class="body">${bodyContent}</div>
    <div class="footer">
      <p class="footer-company">${COMPANY}</p>
      <p class="footer-dept">Human Resources Department</p>
      <div class="footer-line"></div>
      <p class="footer-note">
        This is an automated message from the HR System.<br/>
        Please do not reply directly to this email.<br/>
        For queries, contact <a href="mailto:${HR_EMAIL}" class="footer-link">${HR_EMAIL}</a>
      </p>
      <p class="footer-copy">&#169; ${YEAR} ${COMPANY}. All rights reserved.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Steps list helper ─────────────────────────────────────────────────────────
function buildSteps(items, variant = 'navy') {
  const rows = items.map((text, i) => `
    <tr>
      <td class="step-num-cell">
        <div class="step-num ${variant === 'green' ? 'green' : ''}">${i + 1}</div>
      </td>
      <td class="step-text">${text}</td>
    </tr>`).join('');
  return `<table class="steps-table" role="presentation" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}

// ── Info row helper ───────────────────────────────────────────────────────────
function infoRow(label, value) {
  if (!value) return '';
  return `<tr><td class="info-label">${label}</td><td class="info-value">${value}</td></tr>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// 1. PASSWORD RESET OTP
//    Sent to the admin who clicked "Forgot Password"
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {string} params.to        - Admin's email address
 * @param {string} params.toName    - Admin's full name
 * @param {string} params.otp       - 6-digit OTP (plain text — hashed version stored in DB)
 * @returns {Promise<{success: boolean}>}
 */
export async function sendPasswordResetOTPEmail({ to, toName, otp }) {
  const firstName = (toName || '').split(' ')[0] || 'Admin';

  const bodyContent = `
    <p class="greeting">Dear ${firstName},</p>
    <p class="lead">
      We received a request to reset the password for your admin account at
      <strong>${COMPANY}</strong>. Use the one-time code below to complete the
      reset. This code expires in <strong>15 minutes</strong>.
    </p>

    <div class="code-panel">
      <p class="code-label">Your Password Reset Code</p>
      <p class="code-value green">${otp}</p>
      <p class="code-note">
        Expires in <strong>15 minutes</strong> from the time this email was sent.
      </p>
    </div>

    <div class="notice notice-amber">
      <p class="notice-title">Security Notice</p>
      <p class="notice-text">
        Never share this code with anyone — including HR staff.
        If you did not request a password reset, please ignore this email.
        Your password will <strong>not</strong> change unless this code is entered.
      </p>
    </div>

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;
              color:#0e1a3a;margin:20px 0 14px;">
      How to Reset Your Password
    </p>
    ${buildSteps([
      'Go back to the login page and click <strong>Forgot Password</strong>',
      `Enter the 6-digit code: <strong style="font-family:'Courier New',Courier,monospace;
        font-size:15px;letter-spacing:4px;">${otp}</strong>`,
      'Choose a new strong password (minimum 8 characters)',
      'Sign in with your new password',
    ])}

    <div class="notice notice-red" style="margin-top:20px;">
      <p class="notice-title">Did Not Request This?</p>
      <p class="notice-text">
        If you did not initiate this request, your account may be at risk.
        Contact HR immediately at <strong>${HR_EMAIL}</strong>.
      </p>
    </div>

    <hr class="divider"/>
    <p class="ref-text" style="text-align:center;">
      This code was requested for the account associated with
      <strong>${to}</strong>
    </p>
  `;

  const html = buildHtml(
    `Your password reset code is ${otp} — expires in 15 minutes`,
    {
      accentVariant:  'navy',
      headerVariant:  'navy',
      headerTitle:    'Password Reset Code',
      headerSubtitle: `Requested for your admin account at ${COMPANY}`,
      badgeLabel:     'Security Code',
      bodyContent,
    }
  );

  return sendEmail({
    to,
    toName: toName || to,
    subject:  `Password Reset Code: ${otp} — ${COMPANY} Admin`,
    htmlBody: html,
    textBody: [
      `Password Reset Code`,
      ``,
      `Dear ${firstName},`,
      ``,
      `Your 6-digit password reset code is: ${otp}`,
      ``,
      `This code expires in 15 minutes.`,
      ``,
      `If you did not request this, please ignore this email.`,
      `Your password will not be changed unless this code is used.`,
      ``,
      `${COMPANY} — HR Department`,
    ].join('\n'),
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN REGISTRATION — Welcome email to the newly registered admin
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {string} params.to        - New admin's email address
 * @param {string} params.toName    - New admin's full name
 * @param {string} params.username  - Chosen username
 * @param {string} params.role      - Assigned role (e.g. "hr", "organization")
 * @returns {Promise<{success: boolean}>}
 */
export async function sendAdminRegistrationEmail({ to, toName, username, role }) {
  const firstName  = (toName || '').split(' ')[0] || 'Admin';
  const roleLabel  = role === 'hr' ? 'HR Administrator' : 'Organization Administrator';
  const registeredAt = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const bodyContent = `
    <p class="greeting">Dear ${firstName},</p>
    <p class="lead">
      Your admin account has been successfully created at
      <strong>${COMPANY}</strong>. Use the login details below to
      sign in to the admin panel.
    </p>

    <!-- ── Login credentials panel ───────────────────────────────────── -->
    <div class="code-panel">
      <p class="code-label">Your Login Username</p>
      <p class="code-value green" style="font-size:32px;letter-spacing:6px;">${username}</p>
      <p class="code-note">
        Use this username along with your password to sign in.
      </p>
    </div>

    <!-- ── Account details table ──────────────────────────────────────── -->
    <table class="info-table"><tbody>
      ${infoRow('Full Name',      toName)}
      ${infoRow('Login Username', username)}
      ${infoRow('Email Address',  to)}
      ${infoRow('Role',           roleLabel)}
      ${infoRow('Registered On',  registeredAt)}
    </tbody></table>

    <div class="notice notice-green">
      <p class="notice-title">Account Active</p>
      <p class="notice-text">
        Your account is now active. Sign in at
        <strong>${FRONTEND}/login</strong> using your username
        <strong>${username}</strong> and the password you set during registration.
      </p>
    </div>

    <div class="btn-wrap">
      <a href="${FRONTEND}/login" class="btn btn-green">Sign In to Admin Panel</a>
    </div>

    <div class="notice notice-amber">
      <p class="notice-title">Keep Your Credentials Safe</p>
      <p class="notice-text">
        Never share your username or password with anyone — including HR staff.
        If you believe your account has been compromised, contact HR immediately
        at <strong>${HR_EMAIL}</strong>.
      </p>
    </div>

    <hr class="divider"/>
    <p class="ref-text" style="text-align:center;">
      Account created for <strong>${to}</strong> &nbsp;&bull;&nbsp;
      Login username: <strong>${username}</strong>
    </p>
  `;

  const html = buildHtml(
    `Your admin account is ready — login username: ${username}`,
    {
      accentVariant:  'green',
      headerVariant:  'green',
      headerTitle:    'Admin Account Created',
      headerSubtitle: `Your login username is: ${username}`,
      badgeLabel:     'Account Active',
      bodyContent,
    }
  );

  return sendEmail({
    to,
    toName: toName || to,
    subject:  `Your Admin Account is Ready — Login: ${username} — ${COMPANY}`,
    htmlBody: html,
    textBody: [
      `Admin Account Created`,
      ``,
      `Dear ${firstName},`,
      ``,
      `Your admin account has been successfully created.`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Login Username : ${username}`,
      `Email Address  : ${to}`,
      `Role           : ${roleLabel}`,
      `Registered     : ${registeredAt}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `Sign in at: ${FRONTEND}/login`,
      ``,
      `Never share your credentials with anyone.`,
      `If this account was not created by you, contact HR at ${HR_EMAIL} immediately.`,
      ``,
      `${COMPANY} — HR Department`,
    ].join('\n'),
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// 3. ADMIN REGISTRATION — HR security notification
//    Sent to HR every time a new admin account is registered
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} params
 * @param {string} params.fullName  - New admin's full name
 * @param {string} params.username  - Chosen username
 * @param {string} params.email     - New admin's email
 * @param {string} params.role      - Assigned role
 * @returns {Promise<{success: boolean}>}
 */
export async function sendHRAdminRegistrationNotification({ fullName, username, email, role }) {
  const roleLabel    = role === 'hr' ? 'HR Administrator' : 'Organization Administrator';
  const registeredAt = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const bodyContent = `
    <p class="lead">
      A new admin account has been created in the system. Please review
      the details below and verify this registration was authorised.
    </p>

    <table class="info-table"><tbody>
      ${infoRow('Full Name',     fullName)}
      ${infoRow('Username',      username)}
      ${infoRow('Email Address', email)}
      ${infoRow('Role',          roleLabel)}
      ${infoRow('Registered On', registeredAt)}
    </tbody></table>

    <div class="notice notice-amber">
      <p class="notice-title">Security Notice</p>
      <p class="notice-text">
        If this registration was <strong>not authorised</strong>, please deactivate
        the account immediately from the admin panel and contact the system administrator.
        Unauthorised admin accounts are a security risk.
      </p>
    </div>

    <div class="btn-wrap">
      <a href="${FRONTEND}/dashboard" class="btn">
        Go to Admin Panel
      </a>
    </div>

    <hr class="divider"/>
    <p class="ref-text" style="text-align:center;">
      This is an automated security notification from the HR system.
    </p>
  `;

  const html = buildHtml(
    `New admin registered — ${fullName} (${username}) — please verify`,
    {
      accentVariant:  'navy',
      headerVariant:  'navy',
      headerTitle:    'New Admin Account Registered',
      headerSubtitle: 'A new admin account has been created — please verify',
      badgeLabel:     'Security Alert',
      bodyContent,
    }
  );

  return sendEmail({
    to:      HR_EMAIL,
    toName:  HR_NAME,
    subject:  `New Admin Registered: ${fullName} (${username}) — ${COMPANY}`,
    htmlBody: html,
    textBody: [
      `New Admin Account Registered`,
      ``,
      `Full Name : ${fullName}`,
      `Username  : ${username}`,
      `Email     : ${email}`,
      `Role      : ${roleLabel}`,
      `Registered: ${registeredAt}`,
      ``,
      `If this was NOT authorised, deactivate the account immediately.`,
      `Admin Panel: ${FRONTEND}/dashboard`,
      ``,
      `${COMPANY} — HR Department`,
    ].join('\n'),
  });
}