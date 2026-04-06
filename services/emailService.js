// services/emailService.js
import Mailjet from 'node-mailjet';

const mj = Mailjet.apiConnect(
  process.env.MJ_JOB_PUBLIC,
  process.env.MJ_JOB_PRIVATE
);

const HR_EMAIL = process.env.HR_EMAIL || 'humanresources@instagrp.com';
const HR_NAME  = process.env.HR_NAME  || 'HR Team — Insta ICT Solutions';
const COMPANY  = 'Insta ICT Solutions';
const YEAR     = new Date().getFullYear();

// ─── Send helper ──────────────────────────────────────────────────────────────
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
    console.log(`📧 Email sent → ${to} | ${subject}`);
    return { success: true, result: result.body };
  } catch (err) {
    console.error(`❌ Email failed → ${to} | ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Base layout ──────────────────────────────────────────────────────────────
function base(preheader, content) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>${COMPANY}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #eef2f7; font-family: 'Segoe UI', Arial, sans-serif; -webkit-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
  img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  .outer { background: #eef2f7; padding: 40px 16px; }
  .card { background: #ffffff; border-radius: 20px; overflow: hidden; max-width: 620px; margin: 0 auto; box-shadow: 0 8px 48px rgba(15,37,87,.13); }
  .hdr { background: linear-gradient(135deg, #0f2557 0%, #1d4ed8 55%, #3b82f6 100%); padding: 40px 40px 36px; text-align: center; }
  .hdr-rejoin { background: linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #7c3aed 100%); padding: 40px 40px 36px; text-align: center; }
  .hdr-green { background: linear-gradient(135deg, #14532d 0%, #16a34a 55%, #22c55e 100%); padding: 40px 40px 36px; text-align: center; }
  .hdr-logo { display: inline-block; background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.25); border-radius: 12px; padding: 10px 22px; margin-bottom: 20px; }
  .hdr-logo span { font-size: 18px; font-weight: 900; color: #fff; letter-spacing: 2px; text-transform: uppercase; }
  .hdr h1, .hdr-rejoin h1, .hdr-green h1 { color: #fff; font-size: 22px; font-weight: 700; margin: 0 0 8px; line-height: 1.3; }
  .hdr p, .hdr-rejoin p, .hdr-green p { color: rgba(255,255,255,.78); font-size: 13px; margin: 0; }
  .bd { padding: 36px 40px; }
  .greeting { font-size: 16px; color: #1e293b; font-weight: 700; margin-bottom: 10px; }
  .lead { font-size: 14px; color: #475569; line-height: 1.75; margin-bottom: 20px; }
  .sec { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px 24px; margin: 18px 0; }
  .sec-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 16px; padding-left: 10px; border-left: 3px solid #2563eb; }
  .sec-title-indigo { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 16px; padding-left: 10px; border-left: 3px solid #4f46e5; }
  .sec-title-green { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 16px; padding-left: 10px; border-left: 3px solid #16a34a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-full { grid-column: 1 / -1; }
  .fld-lbl { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: .6px; margin-bottom: 3px; }
  .fld-val { font-size: 13px; color: #1e293b; font-weight: 600; line-height: 1.4; }
  .box-green { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 14px; padding: 24px; margin: 18px 0; text-align: center; }
  .box-red { background: linear-gradient(135deg, #fff5f5, #fee2e2); border: 1px solid #fca5a5; border-radius: 14px; padding: 20px 24px; margin: 18px 0; }
  .box-orange { background: linear-gradient(135deg, #fff7ed, #ffedd5); border: 2px solid #fb923c; border-radius: 14px; padding: 24px; margin: 18px 0; text-align: center; }
  .box-blue { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; border-radius: 14px; padding: 20px 24px; margin: 18px 0; }
  .box-indigo { background: linear-gradient(135deg, #eef2ff, #e0e7ff); border: 1px solid #a5b4fc; border-radius: 14px; padding: 20px 24px; margin: 18px 0; }
  .box-yellow { background: linear-gradient(135deg, #fefce8, #fef9c3); border: 1px solid #fde047; border-radius: 14px; padding: 16px 20px; margin: 18px 0; }
  .emp-id { font-size: 38px; font-weight: 900; color: #15803d; letter-spacing: 6px; margin: 10px 0 6px; }
  .emp-id-indigo { font-size: 38px; font-weight: 900; color: #4338ca; letter-spacing: 6px; margin: 10px 0 6px; }
  .link-box { background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 8px; padding: 12px 16px; font-family: 'Courier New', monospace; font-size: 11px; color: #2563eb; word-break: break-all; margin: 12px 0; line-height: 1.6; text-align: left; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 26px 0; }
  .warn { background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 10px 10px 0; padding: 12px 16px; font-size: 12px; color: #92400e; margin: 18px 0; line-height: 1.6; }
  .rejoin-badge { display: inline-block; background: linear-gradient(135deg,#ede9fe,#ddd6fe); color: #5b21b6; border: 1px solid #c4b5fd; border-radius: 20px; padding: 4px 12px; font-size: 11px; font-weight: 800; letter-spacing: .5px; margin-bottom: 12px; }
  .ftr { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 26px 40px; text-align: center; }
  .ftr-brand { font-size: 13px; font-weight: 800; color: #64748b; margin-bottom: 8px; letter-spacing: .5px; }
  .ftr p { font-size: 11px; color: #94a3b8; line-height: 1.8; margin: 0; }
  .ftr a { color: #2563eb; text-decoration: none; font-weight: 700; }
  @media (max-width: 600px) {
    .outer { padding: 16px 8px; }
    .hdr, .hdr-rejoin, .hdr-green, .bd, .ftr { padding: 24px 20px !important; }
    .grid { grid-template-columns: 1fr !important; }
  }
</style>
</head>
<body>
<div class="outer">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#eef2f7;">${preheader}</div>
  <div class="card">
    ${content.headerHtml}
    <div class="bd">${content.body}</div>
    <div class="ftr">
      <p class="ftr-brand">${COMPANY}</p>
      <p>This is an automated message from the HR System.<br/>Please do not reply directly to this email.<br/>For queries, contact <a href="mailto:${HR_EMAIL}">${HR_EMAIL}</a></p>
      <p style="margin-top:10px;">© ${YEAR} ${COMPANY}. All rights reserved.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── Header builders ──────────────────────────────────────────────────────────
function stdHeader(title, subtitle) {
  return `<div class="hdr"><div class="hdr-logo"><span>INSTA ICT Solutions </span></div><h1>${title}</h1><p>${subtitle}</p></div>`;
}
function rejoinHeader(title, subtitle) {
  return `<div class="hdr-rejoin"><div class="hdr-logo"><span>INSTA ICT Solutions</span></div><div class="rejoin-badge">↩ Rejoin Request</div><h1>${title}</h1><p>${subtitle}</p></div>`;
}
function greenHeader(title, subtitle) {
  return `<div class="hdr-green"><div class="hdr-logo"><span>INSTA ICT Solutions</span></div><h1>${title}</h1><p>${subtitle}</p></div>`;
}

// ─── Field helper ─────────────────────────────────────────────────────────────
const fld = (lbl, val, full = false) =>
  val ? `<div class="${full ? 'grid-full' : ''}"><div class="fld-lbl">${lbl}</div><div class="fld-val">${val}</div></div>` : '';

// ─── Button helper ────────────────────────────────────────────────────────────
function btn(text, href, color = '#1d4ed8', colorEnd = '#3b82f6') {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:26px auto;"><tr><td style="border-radius:10px;background:linear-gradient(135deg,${color},${colorEnd});"><a href="${href}" style="display:inline-block;padding:14px 36px;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:.3px;">${text}</a></td></tr></table>`;
}

// ─── Steps list helper ────────────────────────────────────────────────────────
function stepsList(steps, color = '#2563eb') {
  const rows = steps.map((text, i) => `
    <tr>
      <td style="width:36px;padding:8px 12px 8px 0;vertical-align:middle;border-bottom:${i < steps.length - 1 ? '1px solid #f1f5f9' : 'none'};">
        <div style="width:26px;height:26px;background:${color};border-radius:50%;text-align:center;line-height:26px;font-size:11px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;">${i + 1}</div>
      </td>
      <td style="font-size:13px;color:#475569;line-height:1.6;padding:8px 0;vertical-align:middle;border-bottom:${i < steps.length - 1 ? '1px solid #f1f5f9' : 'none'};">${text}</td>
    </tr>`).join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;">${rows}</table>`;
}

// ─── KYC sections ─────────────────────────────────────────────────────────────
function kycSections(d) {
  return `
  <div class="sec"><div class="sec-title">Personal Information</div><div class="grid">
    ${fld('Full Name', `${d.firstName || ''} ${d.lastName || ''}`.trim(), true)}
    ${fld('Father / Husband Name', d.fatherHusbandName, true)}
    ${fld('Date of Birth', d.dob)} ${fld('Gender', d.gender)}
    ${fld('Marital Status', d.maritalStatus)} ${fld('Blood Group', d.bloodGroup)}
    ${fld('Educational Qualification', d.educationalQualification, true)}
    ${fld('PAN Number', d.panNumber)} ${fld('Name on PAN', d.nameOnPan)}
    ${fld('Aadhaar Number', d.aadhar)} ${fld('Name on Aadhaar', d.nameOnAadhar)}
  </div></div>
  <div class="sec"><div class="sec-title">Contact Details</div><div class="grid">
    ${fld('Email Address', d.email, true)}
    ${fld('Primary Phone', d.phone)} ${fld('Alternate Phone', d.altPhone)}
  </div></div>
  <div class="sec"><div class="sec-title">Address Details</div><div class="grid">
    ${fld('Permanent Address', d.permanentAddress, true)}
    ${fld('Local Address', (d.localSameAsPermanent === 'true' || d.localSameAsPermanent === true) ? 'Same as Permanent Address' : d.localAddress, true)}
  </div></div>
  <div class="sec"><div class="sec-title">Emergency Contact</div><div class="grid">
    ${fld('Contact Name', d.emergencyContactName)} ${fld('Phone', d.emergencyContactNo)}
    ${fld('Relation', d.emergencyContactRelation)} ${fld('Address', d.emergencyContactAddress, true)}
  </div></div>
  <div class="sec"><div class="sec-title">Employment Details</div><div class="grid">
    ${fld('Department', d.department)} ${fld('Designation', d.position || d.designation)}
    ${fld('Employment Type', d.employmentType)} ${fld('Joining Date', d.joiningDate)}
    ${fld('Reporting Manager', d.reportingManager)} ${fld('Circle', d.circle)}
    ${fld('Project Name', d.projectName)}
  </div></div>
  <div class="sec"><div class="sec-title">Bank Details</div><div class="grid">
    ${fld('Bank Name', d.bankName)} ${fld('Branch', d.bankBranch)}
    ${fld('Account Number', d.accountNumber)} ${fld('IFSC Code', d.ifscCode)}
    ${fld('Account Holder Name', d.accountHolderName, true)}
  </div></div>`;
}

// =============================================================================
// 1. REGISTRATION LINK → employee
// =============================================================================
export async function sendRegistrationLinkEmail({ to, toName, registrationUrl, expiresAt }) {
  const expiry = new Date(expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const firstName = (toName || '').split(' ')[0] || 'Applicant';
  const html = base(`Complete your registration with ${COMPANY}`, {
    headerHtml: stdHeader('Employee Registration Invitation', `You've been invited to join ${COMPANY}`),
    body: `
      <p class="greeting">Dear ${firstName},</p>
      <p class="lead">You have been invited to complete your employee registration with <strong>${COMPANY}</strong>. Please click the button below to fill in your details and submit your documents.</p>
      ${btn('&#10003;&nbsp; Complete Registration Form', registrationUrl, '#16a34a', '#22c55e')}
      <p style="font-size:13px;color:#64748b;margin:0 0 6px;font-weight:600;">Or copy this link into your browser:</p>
      <div class="link-box">${registrationUrl}</div>
      <div class="warn">&#9888;&nbsp; This link expires on <strong>${expiry}</strong> and can only be used <strong>once</strong>. Please do not share it with anyone.</div>
      <hr class="divider"/>
      <div class="sec"><div class="sec-title">What Happens After You Submit</div>
        ${stepsList(['Fill all 4 sections: Personal Info, Employment, Bank Details &amp; Documents','HR team reviews your submitted information and documents','You receive a confirmation email with a copy of your submission','On approval, you receive your Employee ID by email'])}
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:20px;">Need help? Contact HR at <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a></p>`,
  });
  return sendEmail({ to, toName: toName || to, subject: `Your Employee Registration Link — ${COMPANY}`, htmlBody: html });
}

// =============================================================================
// 2. FORM SUBMITTED → employee (handles normal + rejoin)
// =============================================================================
export async function sendFormSubmissionConfirmation({ to, formData, isRejoin = false }) {
  const name        = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
  const firstName   = formData.firstName || 'Applicant';
  const submittedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(
    isRejoin ? `Rejoin request submitted — HR will review within 1–2 days` : `Registration submitted — HR will review within 1–2 days`,
    {
      headerHtml: isRejoin
        ? rejoinHeader('Rejoin Request Submitted', 'Your application to rejoin is under review')
        : stdHeader('Registration Submitted', 'Thank you — your application is under review'),
      body: `
        <p class="greeting">Dear ${firstName},</p>
        <p class="lead">
          ${isRejoin
            ? `Your <strong>rejoin request</strong> has been successfully submitted to <strong>${COMPANY}</strong>. Our HR team will verify your previous employment record and respond within <strong>1–2 business days</strong>.`
            : `Your employee registration has been successfully submitted to <strong>${COMPANY}</strong>. Our HR team will review your information and get back to you within <strong>1–2 business days</strong>.`
          }
        </p>
        <div class="${isRejoin ? 'box-indigo' : 'box-green'}" style="text-align:center;">
          <div style="font-size:36px;margin-bottom:10px;">${isRejoin ? '↩' : '✓'}</div>
          <div style="font-size:17px;font-weight:800;color:${isRejoin ? '#3730a3' : '#166534'};margin-bottom:6px;">
            ${isRejoin ? 'Rejoin Request Confirmed' : 'Submission Confirmed'}
          </div>
          <div style="font-size:12px;color:${isRejoin ? '#4338ca' : '#166534'};margin-top:4px;">Submitted on: ${submittedAt}</div>
          <div style="font-size:12px;color:${isRejoin ? '#6366f1' : '#16a34a'};margin-top:4px;">Reference Email: ${to}</div>
        </div>
        <hr class="divider"/>
        <p style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">Your Submitted Details</p>
        <p style="font-size:12px;color:#64748b;margin-bottom:0;">Please review the details below. If anything is incorrect, contact HR immediately.</p>
        ${kycSections(formData)}
        <div class="warn">&#9888;&nbsp; If any information above is incorrect, please contact HR immediately at <a href="mailto:${HR_EMAIL}" style="color:#92400e;font-weight:700;">${HR_EMAIL}</a> before your application is processed.</div>`,
    }
  );
  return sendEmail({ to, toName: name, subject: isRejoin ? `Rejoin Request Submitted — ${COMPANY}` : `Registration Submitted — ${COMPANY}`, htmlBody: html });
}

// =============================================================================
// 3. FORM SUBMITTED → HR notification (handles normal + rejoin)
// =============================================================================
export async function sendHRSubmissionNotification({ formData, employeeDbId, isRejoin = false }) {
  const name        = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
  const submittedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(
    isRejoin ? `Rejoin request from ${name} — action required` : `New registration from ${name} — action required`,
    {
      headerHtml: isRejoin
        ? rejoinHeader('Rejoin Request Received', 'A previously inactive employee wants to rejoin')
        : stdHeader('New Registration Submitted', 'A new employee application requires your review'),
      body: `
        <p class="lead">
          ${isRejoin
            ? `A <strong>rejoin request</strong> has been submitted by a previously inactive employee and is awaiting your review in the admin panel.`
            : `A new employee registration has been submitted and is awaiting your review in the admin panel.`
          }
        </p>
        ${isRejoin ? `
        <div class="box-indigo">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#3730a3;margin-bottom:10px;">⚠️ Rejoin Request — Action Required</div>
          <p style="font-size:13px;color:#3730a3;margin:0;line-height:1.7;">
            This employee was previously inactive and is requesting to rejoin the organisation.
            Please verify their previous employment record before approving.
          </p>
        </div>` : ''}
        <div class="${isRejoin ? 'box-indigo' : 'box-blue'}">
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${isRejoin ? '#3730a3' : '#1d4ed8'};margin-bottom:14px;">&#128100; Applicant Overview</div>
          <div class="grid">
            ${fld('Full Name', name)}
            ${fld('Email', formData.email || '—')}
            ${fld('Phone', formData.phone || '—')}
            ${fld('Department', formData.department || '—')}
            ${fld('Designation', formData.position || formData.designation || '—')}
            ${fld('Joining Date', formData.joiningDate || '—')}
            ${fld('Employment Type', formData.employmentType || '—')}
            ${fld('Submitted At', submittedAt)}
          </div>
        </div>
        ${btn(
          isRejoin ? '&#128065;&nbsp; Review Rejoin Request in Admin Panel' : '&#128065;&nbsp; Review Application in Admin Panel',
          `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pending-approvals`,
          isRejoin ? '#4f46e5' : '#1d4ed8',
          isRejoin ? '#7c3aed' : '#3b82f6'
        )}
        <hr class="divider"/>
        <p style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">Full KYC Details</p>
        ${kycSections(formData)}`,
    }
  );
  return sendEmail({
    to: HR_EMAIL, toName: HR_NAME,
    subject: isRejoin
      ? `⚠️ Rejoin Request: ${name} (${formData.department || 'Unknown'}) — Review Required`
      : `New Registration: ${name} (${formData.department || 'Unknown'}) — Review Required`,
    htmlBody: html,
  });
}

// =============================================================================
// 4. APPROVED → employee (handles normal + rejoin)
// =============================================================================
export async function sendApprovalEmail({ to, firstName, lastName, employeeId, isRejoin = false }) {
  const name       = `${firstName || ''} ${lastName || ''}`.trim();
  const approvedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(
    isRejoin ? `Welcome back! Your rejoin request has been approved` : `Congratulations! Your registration has been approved`,
    {
      headerHtml: isRejoin
        ? rejoinHeader('Welcome Back! 🎉', `Your rejoin request has been approved — ${COMPANY}`)
        : stdHeader('🎉 Registration Approved!', `Welcome to the ${COMPANY} family`),
      body: `
        <p class="greeting">Dear ${firstName || 'Employee'},</p>
        <p class="lead">
          ${isRejoin
            ? `Congratulations! Your <strong>rejoin request</strong> with <strong>${COMPANY}</strong> has been reviewed and approved by the HR team. Welcome back to the family!`
            : `Congratulations! Your employee registration with <strong>${COMPANY}</strong> has been reviewed and <strong>approved</strong> by the HR team. You are now officially onboarded.`
          }
        </p>
        <div class="${isRejoin ? 'box-indigo' : 'box-green'}" style="text-align:center;">
          <div style="font-size:13px;font-weight:800;color:${isRejoin ? '#3730a3' : '#166534'};text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;">
            Your ${isRejoin ? 'New' : ''} Employee ID
          </div>
          <div class="${isRejoin ? 'emp-id-indigo' : 'emp-id'}">${employeeId}</div>
          <div style="font-size:12px;color:${isRejoin ? '#4338ca' : '#166534'};margin-top:8px;">Approved on: ${approvedAt}</div>
          <div style="font-size:11px;color:${isRejoin ? '#6366f1' : '#15803d'};margin-top:6px;font-weight:700;">Keep this ID safe — you will need it for all official purposes</div>
        </div>
        <div class="sec">
          <div class="${isRejoin ? 'sec-title-indigo' : 'sec-title'}">Your Next Steps</div>
          ${stepsList(isRejoin
            ? [
              `Your new Employee ID <strong>${employeeId}</strong> is now active in our system`,
              'HR will reach out with your updated onboarding schedule and joining details',
              'All previous records have been updated — your new ID supersedes the old one',
              'Report any discrepancies in your details to HR within <strong>7 working days</strong>'
            ]
            : [
              `Your Employee ID <strong>${employeeId}</strong> is now active in our system`,
              'HR will reach out with your onboarding schedule and joining details',
              'Use your Employee ID for salary processing, ID card issuance &amp; official correspondence',
              'Report any discrepancies in your details to HR within <strong>7 working days</strong>'
            ],
            isRejoin ? '#4f46e5' : '#16a34a'
          )}
        </div>
        <div class="warn">&#128273;&nbsp; Please save your Employee ID <strong>${employeeId}</strong> securely. You will need it for all HR communications, salary processing, and official records.</div>
        <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">Questions? Contact HR at <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a></p>`,
    }
  );
  return sendEmail({
    to, toName: name,
    subject: isRejoin
      ? `Welcome Back — Your New Employee ID: ${employeeId} — ${COMPANY}`
      : `Approved — Your Employee ID: ${employeeId} — ${COMPANY}`,
    htmlBody: html,
  });
}

// =============================================================================
// 5. REJECTION with re-submission link → employee
// =============================================================================
export async function sendRejectionEmailWithRelink({ to, firstName, lastName, reason, resubmitUrl, resubmitExpiry }) {
  const name       = `${firstName || ''} ${lastName || ''}`.trim();
  const expiry     = resubmitExpiry ? new Date(resubmitExpiry).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const rejectedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(`Action required — please resubmit your registration`, {
    headerHtml: stdHeader('Registration — Action Required', 'Your application needs corrections before it can be approved'),
    body: `
      <p class="greeting">Dear ${firstName || 'Applicant'},</p>
      <p class="lead">Thank you for submitting your registration with <strong>${COMPANY}</strong>. After careful review by our HR team, your application requires some corrections before it can be approved.</p>
      <div class="box-red">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#991b1b;margin-bottom:10px;">Reason for Rejection</div>
        <p style="font-size:14px;color:#7f1d1d;margin:0;line-height:1.75;font-weight:500;">${reason || 'Your application did not meet the required criteria. Please review all sections and resubmit.'}</p>
        <p style="font-size:11px;color:#dc2626;margin:10px 0 0;">Reviewed on: ${rejectedAt}</p>
      </div>
      <div class="box-orange">
        <div style="font-size:32px;margin-bottom:10px;">📝</div>
        <div style="font-size:16px;font-weight:800;color:#c2410c;margin-bottom:10px;">Resubmit Your Application</div>
        <p style="font-size:13px;color:#7c2d12;margin:0 0 18px;line-height:1.7;">Your previous details have been <strong>saved automatically</strong>.<br/>Click below to open your pre-filled form — only correct what needs fixing.</p>
        ${btn('📝&nbsp; Open Pre-filled Form &amp; Resubmit', resubmitUrl, '#ea580c', '#f97316')}
        <p style="font-size:12px;color:#9a3412;margin:10px 0 4px;font-weight:700;">Or copy this link:</p>
        <div class="link-box" style="background:#fff7ed;border-color:#fb923c;color:#c2410c;">${resubmitUrl}</div>
        ${expiry ? `<p style="font-size:11px;color:#9a3412;margin:10px 0 0;">⏰ Link expires: <strong>${expiry}</strong> · One-time use only</p>` : ''}
      </div>
      <div class="sec"><div class="sec-title">How to Resubmit</div>
        ${stepsList(['Click the orange button above to open your pre-filled registration form','Review all sections — especially the one mentioned in the rejection reason above','Correct any wrong or missing information and re-upload documents if needed','Submit the updated form — HR will review your corrected application'], '#ea580c')}
      </div>`,
  });
  return sendEmail({ to, toName: name, subject: `Action Required: Please Resubmit Your Registration — ${COMPANY}`, htmlBody: html });
}

export const sendRejectionEmail = sendRejectionEmailWithRelink;

// =============================================================================
// 6. APPROVED → HR log (handles normal + rejoin)
// =============================================================================
export async function sendHRApprovalNotification({ firstName, lastName, employeeId, previousEmployeeId, email, department, isRejoin = false }) {
  const name       = `${firstName || ''} ${lastName || ''}`.trim();
  const approvedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(`Employee ${isRejoin ? 'rejoin' : ''} approved — ${name} assigned ID ${employeeId}`, {
    headerHtml: isRejoin
      ? rejoinHeader('✓ Rejoin Request Approved', 'Previously inactive employee re-activated with new ID')
      : stdHeader('✓ Employee Approved', 'Registration has been approved and Employee ID assigned'),
    body: `
      <p class="lead">The following employee ${isRejoin ? 'rejoin request' : 'registration'} has been approved and a${isRejoin ? ' new' : 'n'} Employee ID has been assigned.</p>
      <div class="${isRejoin ? 'box-indigo' : 'box-green'}" style="text-align:center;">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${isRejoin ? '#3730a3' : '#166534'};margin-bottom:10px;">${isRejoin ? 'New' : ''} Employee ID Assigned</div>
        <div class="${isRejoin ? 'emp-id-indigo' : 'emp-id'}">${employeeId}</div>
      </div>
      <div class="sec">
        <div class="${isRejoin ? 'sec-title-indigo' : 'sec-title'}">Employee Details</div>
        <div class="grid">
          ${fld('Full Name', name)}
          ${fld('New Employee ID', employeeId)}
          ${isRejoin && previousEmployeeId ? fld('Previous Employee ID', previousEmployeeId) : ''}
          ${fld('Email', email || '—')}
          ${fld('Department', department || '—')}
          ${fld('Approved On', approvedAt, true)}
        </div>
      </div>
      ${isRejoin ? `<div class="box-yellow"><p style="font-size:13px;color:#78350f;margin:0;line-height:1.7;">📋&nbsp; Please update any internal records that reference the employee's previous ID <strong>${previousEmployeeId || 'N/A'}</strong>. The employee has been notified by email with their new Employee ID.</p></div>` : ''}
      <p style="font-size:12px;color:#64748b;text-align:center;">The employee has been notified by email with their ${isRejoin ? 'new' : ''} Employee ID.</p>`,
  });
  return sendEmail({
    to: HR_EMAIL, toName: HR_NAME,
    subject: isRejoin
      ? `Rejoin Approved: ${name} — New ID ${employeeId} (was ${previousEmployeeId || 'N/A'})`
      : `Approved: ${name} — Employee ID ${employeeId}`,
    htmlBody: html,
  });
}

// =============================================================================
// 7. REJECTED → HR log
// =============================================================================
export async function sendHRRejectionNotification({ firstName, lastName, email, reason }) {
  const name       = `${firstName || ''} ${lastName || ''}`.trim();
  const rejectedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(`Registration rejected — ${name}`, {
    headerHtml: stdHeader('Registration Rejected', 'A resubmission link has been sent to the employee'),
    body: `
      <p class="lead">The following employee registration has been rejected. A pre-filled resubmission link has been automatically sent to the employee.</p>
      <div class="box-red">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#991b1b;margin-bottom:12px;">Rejection Summary</div>
        <div class="grid">
          ${fld('Applicant Name', name)} ${fld('Email', email || '—')}
          ${fld('Rejected On', rejectedAt, true)}
          ${reason ? fld('Reason Given', reason, true) : ''}
        </div>
      </div>
      <div class="box-yellow"><p style="font-size:13px;color:#78350f;margin:0;line-height:1.7;">🔒&nbsp; A <strong>pre-filled resubmission link</strong> has been sent to <strong>${email || 'the employee'}</strong>. Their previous data is pre-loaded in the form.</p></div>
      ${btn('View Pending Approvals →', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pending-approvals`)}`,
  });
  return sendEmail({ to: HR_EMAIL, toName: HR_NAME, subject: `Rejected: ${name} — Resubmission Link Sent`, htmlBody: html });
}

// =============================================================================
// 8. STATUS CHANGED → ACTIVE → employee  ← NEW
// =============================================================================
export async function sendActiveNotificationEmail({ to, firstName, lastName }) {
  const name      = `${firstName || ''} ${lastName || ''}`.trim();
  const changedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(`Great news — your account at ${COMPANY} has been reactivated`, {
    headerHtml: greenHeader('Account Reactivated ✓', 'Your employee account is now active again'),
    body: `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">Great news! Your employee account at <strong>${COMPANY}</strong> has been <strong>reactivated</strong> as of <strong>${changedAt}</strong>. You are now an active member of the team.</p>
      <div class="box-green" style="text-align:center;">
        <div style="font-size:36px;margin-bottom:10px;">✓</div>
        <div style="font-size:17px;font-weight:800;color:#166534;margin-bottom:6px;">Account Successfully Reactivated</div>
        <div style="font-size:12px;color:#166534;margin-top:4px;">Effective: ${changedAt}</div>
      </div>
      <div class="sec"><div class="sec-title-green">What's Next</div>
        ${stepsList([
          'Your access to company systems has been fully restored',
          'Contact your reporting manager for updated work assignments',
          'Reach HR if you face any issues with system access or payroll',
          'Report any discrepancies in your records to HR within <strong>7 working days</strong>'
        ], '#16a34a')}
      </div>
      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">Questions? Contact HR at <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a></p>`,
  });
  return sendEmail({ to, toName: name, subject: `Account Reactivated — Welcome Back to ${COMPANY}`, htmlBody: html });
}

// =============================================================================
// 9. STATUS CHANGED → INACTIVE → employee
// =============================================================================
export async function sendInactiveNotificationEmail({ to, firstName, lastName, reason }) {
  const name       = `${firstName || ''} ${lastName || ''}`.trim();
  const changedAt  = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(`Your account at ${COMPANY} has been deactivated`, {
    headerHtml: stdHeader('Account Deactivated', 'Your employee account has been deactivated'),
    body: `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">We want to inform you that your employee account at <strong>${COMPANY}</strong> has been deactivated as of <strong>${changedAt}</strong>.</p>
      <div class="box-yellow">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#78350f;margin-bottom:10px;">⚠️ Reason for Deactivation</div>
        <p style="font-size:14px;color:#78350f;margin:0;line-height:1.75;font-weight:500;">${reason || 'Your account has been deactivated by HR. Please contact HR for more information.'}</p>
        <p style="font-size:11px;color:#92400e;margin:10px 0 0;">Effective: ${changedAt}</p>
      </div>
      <div class="sec"><div class="sec-title">What This Means</div>
        ${stepsList(['Your access to company systems may be revoked','Pending salary or dues will be processed as per company policy','Please return any company assets or equipment if applicable','For any queries or disputes, contact HR immediately'], '#d97706')}
      </div>
      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">Questions? Contact HR at <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a></p>`,
  });
  return sendEmail({ to, toName: name, subject: `Account Deactivated — ${COMPANY}`, htmlBody: html });
}

// =============================================================================
// 10. STATUS CHANGED → BLACKLIST → employee
// =============================================================================
export async function sendBlacklistNotificationEmail({ to, firstName, lastName, reason }) {
  const name      = `${firstName || ''} ${lastName || ''}`.trim();
  const changedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = base(`Important notice regarding your account at ${COMPANY}`, {
    headerHtml: stdHeader('Account Blacklisted', `Important notice from ${COMPANY} HR`),
    body: `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">This is an official notice from <strong>${COMPANY}</strong> HR that your employee account has been <strong>blacklisted</strong> effective <strong>${changedAt}</strong>.</p>
      <div class="box-red">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#991b1b;margin-bottom:10px;">⚠️ Reason for Blacklisting</div>
        <p style="font-size:14px;color:#7f1d1d;margin:0;line-height:1.75;font-weight:500;">${reason || 'Your account has been blacklisted due to a policy violation. Please contact HR for further details.'}</p>
        <p style="font-size:11px;color:#dc2626;margin:10px 0 0;">Effective: ${changedAt}</p>
      </div>
      <div class="warn">🔒&nbsp; A blacklisted account means you are no longer eligible for re-employment at <strong>${COMPANY}</strong> and all associated records have been flagged in our HR system.</div>
      <div class="sec"><div class="sec-title">Immediate Actions Required</div>
        ${stepsList(['Return all company assets, equipment, ID cards, and access devices immediately','Any pending dues or clearances will be processed per company policy','Unauthorized access to company premises or systems is strictly prohibited','If you believe this action is in error, contact HR within 7 working days'], '#dc2626')}
      </div>
      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">For official correspondence, contact HR at <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a></p>`,
  });
  return sendEmail({ to, toName: name, subject: `Official Notice: Account Blacklisted — ${COMPANY}`, htmlBody: html });
}

// ─── ADD THESE TWO FUNCTIONS TO THE BOTTOM OF services/emailService.js ───────
// Copy-paste both functions into emailService.js before the closing.
// They use the same base(), btn(), stepsList(), and sendEmail() helpers
// already defined at the top of that file.

// =============================================================================
// 12. REJOIN REQUEST DECLINED → employee
//     Called by POST /api/registrations/:id/reject-rejoin
// =============================================================================
export async function sendRejoinDeclinedEmail({ to, firstName, lastName, employeeId, reason }) {
  const name       = `${firstName || ""} ${lastName || ""}`.trim();
  const declinedAt = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const html = base(`Your rejoin request has been declined — ${COMPANY}`, {
    headerHtml: stdHeader("Rejoin Request Declined", `${COMPANY} HR has reviewed your request`),
    body: `
      <p class="greeting">Dear ${firstName || "Employee"},</p>
      <p class="lead">
        Thank you for your interest in rejoining <strong>${COMPANY}</strong>.
        After careful review, we regret to inform you that your rejoin request has been <strong>declined</strong>
        at this time.
      </p>

      <div class="box-red">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#991b1b;margin-bottom:10px;">
          Reason for Declining
        </div>
        <p style="font-size:14px;color:#7f1d1d;margin:0;line-height:1.75;font-weight:500;">
          ${reason || "Your rejoin request did not meet the current requirements. Please contact HR for more information."}
        </p>
        <p style="font-size:11px;color:#dc2626;margin:10px 0 0;">Reviewed on: ${declinedAt}</p>
      </div>

      <div class="sec">
        <div class="sec-title">What This Means</div>
        ${stepsList([
          "Your employee record has been returned to <strong>Inactive</strong> status",
          "Your original profile information has been preserved",
          "HR may reach out with a new invitation in the future if circumstances change",
          "For questions or appeals, contact HR directly",
        ], "#dc2626")}
      </div>

      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">
        Questions? Contact HR at <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a>
      </p>`,
  });

  return sendEmail({
    to,
    toName: name,
    subject: `Rejoin Request Declined — ${COMPANY}`,
    htmlBody: html,
  });
}

// =============================================================================
// 13. REJOIN INVITE EXPIRED (7 days, not used) → employee
//     Called by GET /api/employees/cleanup-expired-rejoin-invites
// =============================================================================
export async function sendRejoinInviteExpiredEmail({ to, firstName, lastName, employeeId }) {
  const name      = `${firstName || ""} ${lastName || ""}`.trim();
  const expiredAt = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const html = base(`Your rejoin invitation has expired — ${COMPANY}`, {
    headerHtml: stdHeader("Invitation Expired", "Your rejoin registration link is no longer valid"),
    body: `
      <p class="greeting">Dear ${firstName || "Employee"},</p>
      <p class="lead">
        The rejoin invitation link sent to you by <strong>${COMPANY}</strong> HR has <strong>expired</strong>
        without being used. Registration links are valid for <strong>7 days</strong> from the date they are sent.
      </p>

      <div class="box-yellow">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#78350f;margin-bottom:10px;">
          ⏰ Link Expired
        </div>
        <p style="font-size:13px;color:#78350f;line-height:1.75;">
          ${employeeId ? `Previous Employee ID: <strong>${employeeId}</strong><br/>` : ""}
          Expired on: <strong>${expiredAt}</strong>
        </p>
      </div>

      <div class="sec">
        <div class="sec-title">What Happens Next</div>
        ${stepsList([
          "Your employee record remains in <strong>Inactive</strong> status",
          "If you still wish to rejoin, please contact HR to request a new invitation link",
          "HR can send you a fresh 7-day invitation at any time",
          "There is no penalty for an expired link — simply request a new one",
        ], "#d97706")}
      </div>

      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">
        To request a new invitation, contact HR at
        <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a>
      </p>`,
  });

  return sendEmail({
    to,
    toName: name,
    subject: `Your Rejoin Invitation Has Expired — ${COMPANY}`,
    htmlBody: html,
  });
}

// =============================================================================
// 14. REJOIN REQUEST CANCELLED by HR (Delete button) → employee
//     Called by DELETE /api/employees/:id/pending-rejoin
//     (Optional — only if sendRejoinCancelledEmail is imported in employeeRoutes)
// =============================================================================
export async function sendRejoinCancelledEmail({ to, firstName, lastName, employeeId }) {
  const name        = `${firstName || ""} ${lastName || ""}`.trim();
  const cancelledAt = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const html = base(`Your rejoin request has been cancelled — ${COMPANY}`, {
    headerHtml: stdHeader("Rejoin Request Cancelled", `${COMPANY} HR has cancelled your pending request`),
    body: `
      <p class="greeting">Dear ${firstName || "Employee"},</p>
      <p class="lead">
        This is to inform you that your pending rejoin request with <strong>${COMPANY}</strong>
        has been <strong>cancelled</strong> by HR as of <strong>${cancelledAt}</strong>.
      </p>

      <div class="box-yellow">
        <p style="font-size:13px;color:#78350f;margin:0;line-height:1.75;">
          ${employeeId ? `Previous Employee ID: <strong>${employeeId}</strong><br/>` : ""}
          Your employee record has been returned to <strong>Inactive</strong> status
          and your original profile information has been preserved.
        </p>
      </div>

      <div class="sec">
        <div class="sec-title">Next Steps</div>
        ${stepsList([
          "Your original employee data has been fully restored",
          "If you believe this was done in error, please contact HR immediately",
          "HR can re-issue a rejoin invitation at any time in the future",
        ], "#d97706")}
      </div>

      <p style="font-size:13px;color:#64748b;text-align:center;margin-top:20px;">
        Questions? Contact HR at
        <a href="mailto:${HR_EMAIL}" style="color:#2563eb;font-weight:700;">${HR_EMAIL}</a>
      </p>`,
  });

  return sendEmail({
    to,
    toName: name,
    subject: `Rejoin Request Cancelled — ${COMPANY}`,
    htmlBody: html,
  });
}
// =============================================================================
// 11. REJOIN INVITATION → inactive employee (sent by HR from admin panel)
// =============================================================================
export async function sendRejoinInvitationEmail({ to, firstName, lastName, employeeId, registrationUrl, expiresAt }) {
  const name     = `${firstName || ''} ${lastName || ''}`.trim();
  const expiry   = new Date(expiresAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const html = base(`You've been invited to rejoin ${COMPANY}`, {
    headerHtml: rejoinHeader(
      'Invitation to Rejoin',
      `${COMPANY} HR is inviting you back`
    ),
    body: `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">
        We are pleased to inform you that <strong>${COMPANY}</strong> HR has sent you an invitation
        to <strong>rejoin the organisation</strong>. Your previous employment record has been located and
        your details will be <strong>auto-filled</strong> in the registration form — you only need to
        review and update what has changed.
      </p>

      <div class="box-indigo" style="text-align:center;">
        <div style="font-size:36px;margin-bottom:10px;">↩</div>
        <div style="font-size:17px;font-weight:800;color:#3730a3;margin-bottom:6px;">
          Rejoin ${COMPANY}
        </div>
        ${employeeId ? `<div style="font-size:12px;color:#4338ca;margin-top:6px;">Previous Employee ID: <strong>${employeeId}</strong></div>` : ''}
        <div style="font-size:12px;color:#6366f1;margin-top:4px;">A new Employee ID will be assigned upon approval</div>
      </div>

      ${btn('↩&nbsp; Open Rejoin Registration Form', registrationUrl, '#4f46e5', '#7c3aed')}

      <p style="font-size:13px;color:#64748b;margin:0 0 6px;font-weight:600;">Or copy this link into your browser:</p>
      <div class="link-box" style="border-color:#a5b4fc;color:#4f46e5;">${registrationUrl}</div>

      <div class="warn">⏰&nbsp; This link expires on <strong>${expiry}</strong> and can only be used <strong>once</strong>.
      Please do not share it with anyone.</div>

      <div class="sec">
        <div class="sec-title-indigo">How the Rejoin Process Works</div>
        ${stepsList([
          'Click the button above to open your <strong>pre-filled</strong> registration form',
          'Review each section — your previous details are auto-loaded',
          'Update any information that has changed (address, bank, emergency contact, etc.)',
          'Upload fresh documents and submit — HR will review within <strong>1–2 business days</strong>',
          'Upon approval, you will receive a <strong>new Employee ID</strong> by email'
        ], '#4f46e5')}
      </div>

      <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:20px;">
        Need help? Contact HR at <a href="mailto:${HR_EMAIL}" style="color:#4f46e5;font-weight:700;">${HR_EMAIL}</a>
      </p>`,
  });

  return sendEmail({
    to,
    toName: name,
    subject: `You're Invited to Rejoin ${COMPANY} — Complete Your Registration`,
    htmlBody: html,
  });
}