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
      console.log(`✅ Email sent to ${to} | ${subject}`);
      return { success: true, result: result.body };
    } catch (err) {
      console.error(`❌ Email failed to ${to} | ${err.message}`);
      if (err.statusCode) {
        console.error(`   Mailjet HTTP ${err.statusCode}:`, JSON.stringify(err.response?.body || {}));
      }
      return { success: false, error: err.message };
    }
  }

  // ─── Send helper WITH attachment ──────────────────────────────────────────────
  async function sendEmailWithAttachment({ to, toName, subject, htmlBody, textBody, attachments = [] }) {
    try {
      const message = {
        From:     { Email: HR_EMAIL, Name: HR_NAME },
        To:       [{ Email: to, Name: toName || to }],
        Subject:  subject,
        TextPart: textBody || subject,
        HTMLPart: htmlBody,
      };

      if (attachments.length > 0) {
        message.Attachments = attachments;
      }

      const result = await mj.post('send', { version: 'v3.1' }).request({
        Messages: [message],
      });

      const status = result?.body?.Messages?.[0]?.Status || 'unknown';
      console.log(`✅ Email sent to ${to} | ${subject} | Mailjet status: ${status}${attachments.length > 0 ? ` | ${attachments.length} attachment(s)` : ''}`);
      return { success: true, result: result.body };
    } catch (err) {
      console.error(`❌ Email failed to ${to} | ${err.message}`);
      if (err.statusCode) {
        console.error(`   Mailjet HTTP ${err.statusCode}:`, JSON.stringify(err.response?.body || {}));
      }
      return { success: false, error: err.message };
    }
  }

  // ─── Shared CSS ────────────────────────────────────────────────────────────────
  const BASE_CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #f0f2f7;
      font-family: Georgia, 'Times New Roman', Times, serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
    img   { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    a     { text-decoration: none; }
    .outer { background-color: #f0f2f7; padding: 44px 16px; width: 100%; }
    .card  { max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d8dce8; }
    .accent-bar          { height: 4px; }
    .accent-navy         { background-color: #162040; }
    .accent-green        { background-color: #145a30; }
    .accent-amber        { background-color: #a0620a; }
    .accent-red          { background-color: #8e1c1c; }
    .accent-indigo       { background-color: #2d2880; }
    .header { padding: 38px 52px 32px; border-bottom: 1px solid #e8eaf2; }
    .header-navy   { border-bottom: 3px solid #162040; }
    .header-green  { border-bottom: 3px solid #145a30; }
    .header-amber  { border-bottom: 3px solid #a0620a; }
    .header-red    { border-bottom: 3px solid #8e1c1c; }
    .header-indigo { border-bottom: 3px solid #2d2880; }
    .org-label {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 2.5px;
      text-transform: uppercase; color: #9098b4; margin: 0 0 18px;
    }
    .header-title {
      font-family: Georgia, 'Times New Roman', Times, serif;
      font-size: 26px; font-weight: normal; color: #0e1a3a;
      margin: 0 0 8px; line-height: 1.25; letter-spacing: -0.3px;
    }
    .header-subtitle {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px; color: #6b7592; margin: 0; line-height: 1.65;
    }
    .badge {
      display: inline-block; margin-top: 16px; padding: 4px 16px;
      font-family: Arial, Helvetica, sans-serif; font-size: 10px;
      font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; border: 1px solid;
    }
    .badge-navy   { color: #162040; border-color: #162040; background-color: #f0f2f8; }
    .badge-green  { color: #145a30; border-color: #145a30; background-color: #edf7f1; }
    .badge-amber  { color: #a0620a; border-color: #a0620a; background-color: #fdf6e8; }
    .badge-red    { color: #8e1c1c; border-color: #8e1c1c; background-color: #fdf1f1; }
    .badge-indigo { color: #2d2880; border-color: #2d2880; background-color: #f0f0fa; }
    .body { padding: 36px 52px; }
    .greeting {
      font-family: Georgia, 'Times New Roman', Times, serif;
      font-size: 16px; color: #0e1a3a; margin: 0 0 12px;
    }
    .lead {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px; color: #3d4563; line-height: 1.85; margin: 0 0 22px;
    }
    .emp-id-panel {
      background-color: #f7f8fc; border: 1px solid #dde1ea;
      padding: 24px; text-align: center; margin: 22px 0;
    }
    .amount-label {
      font-family: Arial, Helvetica, sans-serif; font-size: 10px;
      font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
      color: #9098b4; margin: 0 0 8px;
    }
    .emp-id-figure {
      font-family: 'Courier New', Courier, monospace;
      font-size: 38px; font-weight: 700; letter-spacing: 6px; margin: 0; line-height: 1.1;
    }
    .emp-id-figure.green  { color: #145a30; }
    .emp-id-figure.indigo { color: #2d2880; }
    .info-table { width: 100%; border: 1px solid #e0e4f0; border-collapse: collapse; margin: 20px 0; }
    .info-table td {
      padding: 11px 18px; border-bottom: 1px solid #eef0f8;
      font-family: Arial, Helvetica, sans-serif; font-size: 13px; vertical-align: top;
    }
    .info-table tr:last-child td { border-bottom: none; }
    .info-label-cell {
      color: #9098b4; font-weight: 600; font-size: 11px; letter-spacing: 0.3px;
      white-space: nowrap; width: 38%; background-color: #fafbfd; text-transform: uppercase;
    }
    .info-value-cell { color: #1c2340; font-weight: 500; padding-left: 18px !important; }
    .info-value-cell.mono {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #162040;
    }
    .section-block { border: 1px solid #e0e4f0; margin: 16px 0; }
    .section-header {
      background-color: #f7f8fc; border-bottom: 1px solid #e0e4f0; padding: 10px 18px;
      font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 700;
      letter-spacing: 2px; text-transform: uppercase; color: #6b7592;
    }
    .section-grid { display: table; width: 100%; padding: 4px 0; }
    .section-row  { display: table-row; }
    .section-cell-label {
      display: table-cell; width: 38%; padding: 9px 18px;
      font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700;
      color: #9098b4; letter-spacing: 0.3px; vertical-align: top;
      border-bottom: 1px solid #f2f4fb; text-transform: uppercase;
    }
    .section-cell-value {
      display: table-cell; padding: 9px 18px;
      font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 500;
      color: #1c2340; vertical-align: top; border-bottom: 1px solid #f2f4fb;
    }
    .notice { padding: 18px 22px; margin: 20px 0; border-left: 4px solid; }
    .notice-navy   { background-color: #f0f2f8; border-left-color: #162040; }
    .notice-green  { background-color: #edf7f1; border-left-color: #145a30; }
    .notice-amber  { background-color: #fdf6e8; border-left-color: #a0620a; }
    .notice-red    { background-color: #fdf1f1; border-left-color: #8e1c1c; }
    .notice-indigo { background-color: #f0f0fa; border-left-color: #2d2880; }
    .notice-pdf    { background-color: #fffbea; border-left-color: #d97706; }
    .notice-title {
      font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 700;
      letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 7px;
    }
    .notice-navy   .notice-title { color: #162040; }
    .notice-green  .notice-title { color: #145a30; }
    .notice-amber  .notice-title { color: #a0620a; }
    .notice-red    .notice-title { color: #8e1c1c; }
    .notice-indigo .notice-title { color: #2d2880; }
    .notice-pdf    .notice-title { color: #d97706; }
    .notice-text {
      font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.8; margin: 0;
    }
    .notice-navy   .notice-text { color: #2a3560; }
    .notice-green  .notice-text { color: #1a5a32; }
    .notice-amber  .notice-text { color: #7a4a08; }
    .notice-red    .notice-text { color: #6e1818; }
    .notice-indigo .notice-text { color: #28246a; }
    .notice-pdf    .notice-text { color: #78350f; }
    .steps-table { width: 100%; border-collapse: collapse; }
    .step-num-cell { width: 34px; vertical-align: middle; padding: 10px 12px 10px 0; }
    .step-num {
      width: 28px; height: 28px; border-radius: 50%; text-align: center; line-height: 28px;
      font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #ffffff;
    }
    .step-text-cell {
      font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #3d4563;
      line-height: 1.7; padding: 10px 0; vertical-align: middle;
    }
    .step-divider td { border-bottom: 1px solid #f0f2f8; }
    .resubmit-box {
      border: 1px solid #c8a828; background-color: #fdf8ec;
      padding: 28px 30px; margin: 22px 0; text-align: center;
    }
    .resubmit-title { font-family: Georgia,'Times New Roman',Times,serif; font-size: 18px; color: #5a3c00; margin: 0 0 10px; }
    .resubmit-sub   { font-family: Arial,Helvetica,sans-serif; font-size: 13px; color: #7a5210; line-height: 1.75; margin: 0 0 20px; }
    .resubmit-expiry { font-family: Arial,Helvetica,sans-serif; font-size: 11px; color: #8a6220; margin: 14px 0 0; }
    .btn-wrap { text-align: center; margin: 26px 0; }
    .btn {
      display: inline-block; padding: 14px 38px;
      font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700;
      letter-spacing: 1px; text-transform: uppercase; color: #ffffff !important; text-decoration: none;
    }
    .btn-navy   { background-color: #162040; }
    .btn-green  { background-color: #145a30; }
    .btn-amber  { background-color: #a0620a; }
    .btn-red    { background-color: #8e1c1c; }
    .btn-indigo { background-color: #2d2880; }
    .url-box {
      background-color: #f7f8fc; border: 1px dashed #c0c6dc; padding: 12px 18px;
      font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #162040;
      word-break: break-all; margin: 10px 0; line-height: 1.6; text-align: left;
    }
    .ref-code {
      font-family: 'Courier New', Courier, monospace; font-size: 12px;
      background-color: #f0f2f8; padding: 2px 7px; color: #162040; font-weight: 700; letter-spacing: 0.5px;
    }
    .divider { border: none; border-top: 1px solid #e8eaf2; margin: 26px 0; }
    .ref-text {
      font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #9098b4; line-height: 1.7; margin: 0;
    }
    .footer { background-color: #162040; padding: 30px 52px; text-align: center; }
    .footer-company {
      font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700;
      letter-spacing: 2px; text-transform: uppercase; color: #ffffff; margin: 0 0 6px;
    }
    .footer-dept   { font-family: Arial,Helvetica,sans-serif; font-size: 11px; color: rgba(255,255,255,0.50); margin: 0 0 16px; }
    .footer-line   { width: 36px; height: 1px; background-color: rgba(255,255,255,0.18); margin: 14px auto; }
    .footer-note   { font-family: Arial,Helvetica,sans-serif; font-size: 11px; color: rgba(255,255,255,0.38); line-height: 1.9; margin: 0; }
    .footer-link   { color: rgba(255,255,255,0.60); text-decoration: underline; }
    .footer-copy   { font-family: Arial,Helvetica,sans-serif; font-size: 10px; color: rgba(255,255,255,0.25); margin: 12px 0 0; }
    @media (max-width: 600px) {
      .header, .body, .footer { padding-left: 24px !important; padding-right: 24px !important; }
      .emp-id-figure { font-size: 26px !important; letter-spacing: 3px !important; }
    }
  `;

  // ─── Base layout wrapper ───────────────────────────────────────────────────────
  function base(preheader, { accentVariant = 'navy', headerVariant = 'navy', headerTitle, headerSubtitle, badgeLabel, bodyContent }) {
    return `<!DOCTYPE html>
  <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="x-apple-disable-message-reformatting"/>
    <title>${COMPANY}</title>
    <style>${BASE_CSS}</style>
  </head>
  <body>
  <div class="outer">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f0f2f7;">${preheader}</div>
    <div class="card">
      <div class="accent-bar accent-${accentVariant}"></div>
      <div class="header header-${headerVariant}">
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

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  function infoRow(label, value) {
    if (!value) return '';
    return `<tr><td class="info-label-cell">${label}</td><td class="info-value-cell">${value}</td></tr>`;
  }
  function infoRowMono(label, value) {
    if (!value) return '';
    return `<tr><td class="info-label-cell">${label}</td><td class="info-value-cell mono">${value}</td></tr>`;
  }
  function sectionBlock(title, rows) {
    const rowsHtml = rows.filter(Boolean).map(([label, value]) => value ? `
      <div class="section-row">
        <div class="section-cell-label">${label}</div>
        <div class="section-cell-value">${value}</div>
      </div>` : '').join('');
    return `<div class="section-block"><div class="section-header">${title}</div><div class="section-grid">${rowsHtml}</div></div>`;
  }
  function btn(text, href, variant = 'navy') {
    return `<div class="btn-wrap"><a href="${href}" class="btn btn-${variant}">${text}</a></div>`;
  }
  function steps(items, variant = 'navy') {
    const colors = { navy: '#162040', green: '#145a30', amber: '#a0620a', red: '#8e1c1c', indigo: '#2d2880' };
    const color  = colors[variant] || colors.navy;
    const rows   = items.map((text, i) => {
      const isLast = i === items.length - 1;
      return `<tr class="${isLast ? '' : 'step-divider'}">
        <td class="step-num-cell"><div class="step-num" style="background-color:${color};">${i + 1}</div></td>
        <td class="step-text-cell">${text}</td>
      </tr>`;
    }).join('');
    return `<table class="steps-table" role="presentation" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
  }
  function urlBox(link) { return `<div class="url-box">${link}</div>`; }

  function kycSections(d) {
    const fullName  = `${d.firstName || ''} ${d.lastName || ''}`.trim();
    const localAddr = (d.localSameAsPermanent === 'true' || d.localSameAsPermanent === true)
      ? 'Same as Permanent Address' : d.localAddress;
    return [
      sectionBlock('Personal Information', [
        ['Full Name', fullName], ['Father / Husband Name', d.fatherHusbandName],
        ['Date of Birth', d.dob], ['Gender', d.gender], ['Marital Status', d.maritalStatus],
        ['Blood Group', d.bloodGroup], ['Educational Qualification', d.educationalQualification],
        ['PAN Number', d.panNumber], ['Name on PAN', d.nameOnPan],
        ['Aadhaar Number', d.aadhar], ['Name on Aadhaar', d.nameOnAadhar],
      ]),
      sectionBlock('Contact Details', [
        ['Email Address', d.email], ['Primary Phone', d.phone], ['Alternate Phone', d.altPhone],
      ]),
      sectionBlock('Address Details', [
        ['Permanent Address', d.permanentAddress], ['Local Address', localAddr],
      ]),
      sectionBlock('Emergency Contact', [
        ['Contact Name', d.emergencyContactName], ['Phone', d.emergencyContactNo],
        ['Relation', d.emergencyContactRelation], ['Address', d.emergencyContactAddress],
      ]),
      sectionBlock('Employment Details', [
        ['Department', d.department], ['Designation', d.position || d.designation],
        ['Employment Type', d.employmentType], ['Joining Date', d.joiningDate],
        ['Reporting Manager', d.reportingManager], ['Circle', d.circle], ['Project Name', d.projectName],
      ]),
      sectionBlock('Bank Details', [
        ['Bank Name', d.bankName], ['Branch', d.bankBranch],
        ['Account Number', d.accountNumber], ['IFSC Code', d.ifscCode],
        ['Account Holder Name', d.accountHolderName],
      ]),
    ].join('');
  }

  // ─── Build approval email HTML (reusable) ─────────────────────────────────────
  function buildApprovalEmailHtml({ firstName, lastName, employeeId, isRejoin, approvedAt }) {
    const name    = `${firstName || ''} ${lastName || ''}`.trim();
    const variant = isRejoin ? 'indigo' : 'green';

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">
        ${isRejoin
          ? `Congratulations! Your <strong>rejoin request</strong> with <strong>${COMPANY}</strong> has been reviewed and approved by the HR team. Welcome back to the organisation.`
          : `Congratulations! Your employee registration with <strong>${COMPANY}</strong> has been reviewed and <strong>approved</strong> by the HR team. You are now officially onboarded.`
        }
      </p>
      <div class="emp-id-panel">
        <p class="amount-label">Your ${isRejoin ? 'New ' : ''}Employee ID</p>
        <p class="emp-id-figure ${isRejoin ? 'indigo' : 'green'}">${employeeId}</p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9098b4;margin:10px 0 0;">
          Approved on: ${approvedAt}
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#6b7592;margin:6px 0 0;">
          Please save this ID — you will need it for all official purposes.
        </p>
      </div>
      <div class="notice notice-${variant}">
        <p class="notice-title">${isRejoin ? 'Rejoin Request Approved' : 'Registration Approved'}</p>
        <p class="notice-text">
          Your Employee ID <strong>${employeeId}</strong> is now active in our system.
          HR will reach out with your ${isRejoin ? 'updated ' : ''}onboarding schedule and joining details.
        </p>
      </div>
      <div class="notice notice-pdf">
        <p class="notice-title">&#128206; KYE Form Attached</p>
        <p class="notice-text">
          Your <strong>Know Your Employee (KYE) form</strong> is attached to this email as a PDF.
          Please <strong>print it, fill in the handwritten sections, sign it</strong>, and submit the
          physical copy along with all required documents to the HR office on or before your joining date.
        </p>
      </div>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:20px 0 14px;">Your Next Steps</p>
      ${steps(
        isRejoin
          ? [
              `Your new Employee ID <strong>${employeeId}</strong> is now active in our system`,
              'HR will reach out with your updated onboarding schedule and joining details',
              '<strong>Print, fill, sign and submit</strong> the attached KYE form to the HR office',
              'All previous records have been updated — your new ID supersedes the old one',
            ]
          : [
              `Your Employee ID <strong>${employeeId}</strong> is now active in our system`,
              'HR will reach out with your onboarding schedule and joining details',
              '<strong>Print, fill, sign and submit</strong> the attached KYE form to the HR office',
              'Use your Employee ID for salary processing, ID card issuance and official correspondence',
            ],
        variant
      )}
      <div class="notice notice-amber" style="margin-top:20px;">
        <p class="notice-title">Reminder</p>
        <p class="notice-text">
          Please save your Employee ID <strong>${employeeId}</strong> securely.
          You will need it for all HR communications, salary processing, and official records.
        </p>
      </div>
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">
        Questions? Contact HR at <strong>${HR_EMAIL}</strong>
      </p>
    `;

    return base(
      isRejoin ? `Welcome back — your rejoin request has been approved` : `Congratulations — your registration has been approved`,
      {
        accentVariant:  variant,
        headerVariant:  variant,
        headerTitle:    isRejoin ? 'Welcome Back' : 'Registration Approved',
        headerSubtitle: isRejoin
          ? `Your rejoin request has been approved — ${COMPANY}`
          : `Welcome to the ${COMPANY} family`,
        badgeLabel: 'Approved',
        bodyContent,
      }
    );
  }

  // =============================================================================
  // 1. REGISTRATION LINK — sent to employee by HR
  // =============================================================================
  export async function sendRegistrationLinkEmail({ to, toName, registrationUrl, expiresAt }) {
    const expiry    = new Date(expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const firstName = (toName || '').split(' ')[0] || 'Applicant';

    const bodyContent = `
      <p class="greeting">Dear ${firstName},</p>
      <p class="lead">
        You have been invited to complete your employee registration with <strong>${COMPANY}</strong>.
        Please use the link below to fill in your details, provide the required documents, and submit your registration form.
      </p>
      ${btn('Complete Registration Form', registrationUrl, 'green')}
      <p class="lead" style="margin-bottom:8px;font-size:13px;">If the button does not work, copy and paste the following link into your browser:</p>
      ${urlBox(registrationUrl)}
      <div class="notice notice-amber">
        <p class="notice-title">Important</p>
        <p class="notice-text">
          This link expires on <strong>${expiry}</strong> and can only be used <strong>once</strong>.
          Please do not share it with anyone.
        </p>
      </div>
      <hr class="divider"/>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:0 0 14px;">What Happens After You Submit</p>
      ${steps([
        'Fill all sections: Personal Information, Employment Details, Bank Details and Documents',
        'HR will review your submitted information and documents',
        'You will receive a confirmation email with a copy of your submission',
        'Upon approval, you will receive your Employee ID by email along with your KYE form to print and submit',
      ], 'green')}
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">Need help? Contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`Complete your registration with ${COMPANY}`, {
      accentVariant: 'green', headerVariant: 'green',
      headerTitle: 'Employee Registration Invitation',
      headerSubtitle: `You have been invited to join ${COMPANY}`,
      badgeLabel: 'Action Required', bodyContent,
    });

    return sendEmail({
      to, toName: toName || to,
      subject: `Your Employee Registration Link — ${COMPANY}`,
      htmlBody: html,
      textBody: `Employee Registration Invitation\n\nDear ${firstName},\n\nComplete your registration here:\n${registrationUrl}\n\nLink expires: ${expiry}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 2. FORM SUBMITTED — confirmation to employee (normal + rejoin)
  // =============================================================================
  export async function sendFormSubmissionConfirmation({ to, formData, isRejoin = false }) {
    const name        = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
    const firstName   = formData.firstName || 'Applicant';
    const submittedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const variant     = isRejoin ? 'indigo' : 'navy';

    const bodyContent = `
      <p class="greeting">Dear ${firstName},</p>
      <p class="lead">
        ${isRejoin
          ? `Your <strong>rejoin request</strong> has been successfully submitted to <strong>${COMPANY}</strong>. Our HR team will verify your previous employment record and respond within <strong>1 to 2 business days</strong>.`
          : `Your employee registration has been successfully submitted to <strong>${COMPANY}</strong>. Our HR team will review your information and get back to you within <strong>1 to 2 business days</strong>.`
        }
      </p>
      <div class="emp-id-panel">
        <p class="amount-label">${isRejoin ? 'Rejoin Request' : 'Submission'} Confirmed</p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#0e1a3a;margin:10px 0 4px;">${name}</p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9098b4;margin:0;">Submitted on: ${submittedAt}</p>
      </div>
      <div class="notice notice-${variant}">
        <p class="notice-title">Pending Review</p>
        <p class="notice-text">
          Your ${isRejoin ? 'rejoin request' : 'registration'} has been placed in the review queue.
          Please retain this email for your records.
        </p>
      </div>
      <hr class="divider"/>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:0 0 6px;">Your Submitted Details</p>
      ${kycSections(formData)}
    `;

    const html = base(
      isRejoin ? 'Rejoin request submitted — HR will review within 1 to 2 business days' : 'Registration submitted — HR will review within 1 to 2 business days',
      {
        accentVariant: variant, headerVariant: variant,
        headerTitle: isRejoin ? 'Rejoin Request Submitted' : 'Registration Submitted',
        headerSubtitle: isRejoin ? 'Your application to rejoin is currently under review' : 'Thank you — your application is under review',
        badgeLabel: 'Pending Review', bodyContent,
      }
    );

    return sendEmail({
      to, toName: name,
      subject: isRejoin ? `Rejoin Request Submitted — ${COMPANY}` : `Registration Submitted — ${COMPANY}`,
      htmlBody: html,
      textBody: `${isRejoin ? 'Rejoin Request' : 'Registration'} Submitted\n\nDear ${firstName},\n\nYour ${isRejoin ? 'rejoin request' : 'registration'} has been received and is pending review.\nSubmitted: ${submittedAt}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 3. FORM SUBMITTED — HR notification (normal + rejoin)
  // =============================================================================
  export async function sendHRSubmissionNotification({ formData, employeeDbId, isRejoin = false }) {
    const name        = `${formData.firstName || ''} ${formData.lastName || ''}`.trim();
    const submittedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const variant     = isRejoin ? 'indigo' : 'navy';

    const bodyContent = `
      <p class="lead">
        ${isRejoin
          ? `A <strong>rejoin request</strong> has been submitted by a previously inactive employee and is awaiting your review.`
          : `A new employee registration has been submitted and is awaiting your review in the admin panel.`
        }
      </p>
      ${isRejoin ? `
      <div class="notice notice-amber">
        <p class="notice-title">Action Required — Rejoin Request</p>
        <p class="notice-text">
          This employee was previously inactive and is requesting to rejoin.
          Please verify their previous employment record before approving.
        </p>
      </div>` : ''}
      <table class="info-table"><tbody>
        ${infoRow('Full Name', name)}
        ${infoRow('Email', formData.email || '—')}
        ${infoRow('Phone', formData.phone || '—')}
        ${infoRow('Department', formData.department || '—')}
        ${infoRow('Designation', formData.position || formData.designation || '—')}
        ${infoRow('Joining Date', formData.joiningDate || '—')}
        ${infoRow('Employment Type', formData.employmentType || '—')}
        ${infoRow('Submitted On', submittedAt)}
      </tbody></table>
      ${btn(
        isRejoin ? 'Review Rejoin Request in Admin Panel' : 'Review Application in Admin Panel',
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pending-approvals`,
        variant
      )}
      <hr class="divider"/>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:0 0 6px;">Full KYC Details Submitted</p>
      ${kycSections(formData)}
    `;

    const html = base(
      isRejoin ? `Rejoin request from ${name} — action required` : `New registration from ${name} — action required`,
      {
        accentVariant: variant, headerVariant: variant,
        headerTitle: isRejoin ? 'Rejoin Request Received' : 'New Registration Submitted',
        headerSubtitle: isRejoin ? 'A previously inactive employee has submitted a rejoin request' : 'A new employee application requires your review',
        badgeLabel: 'Awaiting Your Review', bodyContent,
      }
    );

    return sendEmail({
      to: HR_EMAIL, toName: HR_NAME,
      subject: isRejoin
        ? `Rejoin Request: ${name} (${formData.department || 'Unknown'}) — Review Required`
        : `New Registration: ${name} (${formData.department || 'Unknown'}) — Review Required`,
      htmlBody: html,
      textBody: `${isRejoin ? 'Rejoin Request' : 'New Registration'} Received\n\nApplicant: ${name}\nEmail: ${formData.email}\nDept: ${formData.department}\n\nReview in admin panel.\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 4. APPROVED — sent to employee WITHOUT PDF (fallback only)
  // =============================================================================
  export async function sendApprovalEmail({ to, firstName, lastName, employeeId, isRejoin = false }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const approvedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const html = buildApprovalEmailHtml({ firstName, lastName, employeeId, isRejoin, approvedAt });

    return sendEmail({
      to, toName: name,
      subject: isRejoin
        ? `Welcome Back — Your New Employee ID: ${employeeId} — ${COMPANY}`
        : `Approved — Your Employee ID: ${employeeId} — ${COMPANY}`,
      htmlBody: html,
      textBody: `Registration Approved\n\nDear ${firstName},\n\nYour ${isRejoin ? 'rejoin request' : 'registration'} has been approved.\nEmployee ID: ${employeeId}\nApproved: ${approvedAt}\n\nPlease print, fill by hand, sign and submit the attached KYE form to the HR office.\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 4b. APPROVED — sent to employee WITH KYE PDF attachment (PRIMARY approval email)
  //
  // CHANGES: Removed upload link, BGV form requirement, and email screenshot
  //          from the email. Employee only needs to print, fill, sign and
  //          physically submit the attached KYE form to the HR office.
  // =============================================================================
  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH for services/emailService.js
  // Replace the entire sendApprovalEmailWithKYEPdf function with this version.
  //
  // KEY CHANGE: The upload link (uploadUrl / uploadExpiresAt) is NOW rendered
  // in the email body so employees know they must print, sign and ALSO upload
  // a photo/scan of the signed form via the secure link.
  // ═══════════════════════════════════════════════════════════════════════════

  export async function sendApprovalEmailWithKYEPdf({
    to, firstName, lastName, employeeId, isRejoin = false,
    pdfBase64   = null,
    uploadUrl   = null,        // ← NOW USED in email body
    uploadExpiresAt = null,    // ← NOW USED in email body
  }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const approvedAt = new Date().toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const variant = isRejoin ? 'indigo' : 'green';

    // Format upload link expiry date
    const uploadExpiry = uploadExpiresAt
      ? new Date(uploadExpiresAt).toLocaleString('en-IN', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      : null;

    const bodyContent = `
      <p style="font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;color:#0e1a3a;margin:0 0 12px;">
        Dear ${firstName || 'Employee'},
      </p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3d4563;line-height:1.85;margin:0 0 22px;">
        ${isRejoin
          ? `Congratulations! Your <strong>rejoin request</strong> with <strong>${COMPANY}</strong> has been reviewed and approved by the HR team. Welcome back to the organisation.`
          : `Congratulations! Your employee registration with <strong>${COMPANY}</strong> has been reviewed and <strong>approved</strong> by the HR team. You are now officially onboarded.`
        }
      </p>

      <!-- ── Employee ID panel ─────────────────────────────────────────── -->
      <div style="background-color:#f7f8fc;border:1px solid #dde1ea;padding:24px;text-align:center;margin:22px 0;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:2px;text-transform:uppercase;color:#9098b4;margin:0 0 8px;">
          Your ${isRejoin ? 'New ' : ''}Employee ID
        </p>
        <p style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:700;
                  letter-spacing:6px;margin:0;line-height:1.1;color:${isRejoin ? '#2d2880' : '#145a30'};">
          ${employeeId}
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9098b4;margin:10px 0 0;">
          Approved on: ${approvedAt}
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:#6b7592;margin:6px 0 0;">
          Please save this ID — you will need it for all official purposes.
        </p>
      </div>

   

      <!-- ── Upload link panel (only shown when uploadUrl is provided) ─── -->
      ${uploadUrl ? `
      <div style="border:1.5px solid #c8a828;background-color:#fdf8ec;padding:26px 28px;margin:22px 0;text-align:center;">
        <p style="font-family:Georgia,'Times New Roman',Times,serif;font-size:17px;color:#5a3c00;margin:0 0 10px;font-weight:700;">
           Upload Your Signed KYE Form
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7a5210;line-height:1.75;margin:0 0 20px;">
          After signing the KYE form, please upload a clear photo or scan using the
          secure link below. This allows HR to verify your document digitally
          before you submit the physical copy.
        </p>
        <div style="text-align:center;margin:0 0 16px;">
          <a href="${uploadUrl}"
            style="display:inline-block;padding:14px 38px;background-color:#a0620a;color:#ffffff;
                    font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                    letter-spacing:1px;text-transform:uppercase;text-decoration:none;">
            Upload Signed KYE Form
          </a>
        </div>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a6220;margin:10px 0 4px;font-weight:700;">
          Or copy this link into your browser:
        </p>
        <div style="background-color:#fff8e6;border:1px dashed #c0a020;padding:10px 14px;
                    font-family:'Courier New',Courier,monospace;font-size:10px;color:#5a3c00;
                    word-break:break-all;text-align:left;line-height:1.6;">
          ${uploadUrl}
        </div>
        ${uploadExpiry ? `
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a6220;margin:14px 0 0;font-style:italic;">
          ⏰ This upload link expires on <strong>${uploadExpiry}</strong> and can only be used once.
          <br/>If it expires, contact HR at <strong>${HR_EMAIL}</strong> to request a new link.
        </p>` : ''}
      </div>
      ` : ''}

      <!-- ── Action checklist ──────────────────────────────────────────── -->
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:20px 0 14px;">
        Your Complete Action Checklist
      </p>
      <table style="width:100%;border-collapse:collapse;" role="presentation">
        ${[
          `Print the <strong>attached KYE form</strong> (PDF)`,
          `Fill in all sections <strong>by hand</strong> (digitally filled forms are not accepted)`,
          `Sign the KYE form`,
          uploadUrl
            ? `<strong>Upload a clear photo or scan</strong> of your signed form using the secure link above`
            : `Submit the physical signed KYE form to the <strong>HR office</strong>`,
          `Submit the <strong>original signed physical copy</strong> to the HR office on or before your joining date`,
          `HR will complete your onboarding upon receiving and verifying the signed form`,
        ].map((text, i) => `
          <tr style="border-bottom:1px solid #f0f2f8;">
            <td style="width:34px;vertical-align:middle;padding:10px 12px 10px 0;">
              <div style="width:28px;height:28px;border-radius:50%;background-color:${isRejoin ? '#2d2880' : '#145a30'};
                          text-align:center;line-height:28px;font-family:Arial,Helvetica,sans-serif;
                          font-size:11px;font-weight:700;color:#ffffff;">${i + 1}</div>
            </td>
            <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#3d4563;
                      line-height:1.7;padding:10px 0;vertical-align:middle;">${text}</td>
          </tr>`).join('')}
      </table>

      <!-- ── Reminder ──────────────────────────────────────────────────── -->
      <div style="padding:18px 22px;margin:20px 0;border-left:4px solid #a0620a;background:#fdf6e8;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:1.8px;text-transform:uppercase;color:#a0620a;margin:0 0 7px;">Reminder</p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#7a4a08;margin:0;">
          Please save your Employee ID <strong>${employeeId}</strong> securely.
          You will need it for all HR communications, salary processing, and official records.
        </p>
      </div>

      <hr style="border:none;border-top:1px solid #e8eaf2;margin:26px 0;"/>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9098b4;
                line-height:1.7;margin:0;text-align:center;">
        Questions? Contact HR at <strong>${HR_EMAIL}</strong>
      </p>
    `;

    const html = base(
      isRejoin
        ? `Welcome back — your rejoin request has been approved`
        : `Congratulations — your registration has been approved`,
      {
        accentVariant:  variant,
        headerVariant:  variant,
        headerTitle:    isRejoin ? 'Welcome Back' : 'Registration Approved',
        headerSubtitle: isRejoin
          ? `Your rejoin request has been approved — ${COMPANY}`
          : `Welcome to the ${COMPANY} family`,
        badgeLabel: 'Approved',
        bodyContent,
      }
    );

    const textBody = [
      `Registration Approved`,
      ``,
      `Dear ${firstName},`,
      ``,
      `Employee ID: ${employeeId}`,
      `Approved: ${approvedAt}`,
      ``,
      `Your KYE form is attached as a PDF. Please:`,
      `1. Print it`,
      `2. Fill in all sections by hand`,
      `3. Sign it`,
      uploadUrl ? `4. Upload a photo/scan here: ${uploadUrl}` : `4. Submit the physical copy to HR`,
      `5. Bring the original signed copy to the HR office on your joining date`,
      ``,
      uploadExpiry ? `Upload link expires: ${uploadExpiry}` : ``,
      ``,
      `Insta ICT Solutions — HR Department`,
    ].filter(l => l !== null).join('\n');

    const subject = isRejoin
      ? `Welcome Back — Your New Employee ID: ${employeeId} — ${COMPANY}`
      : `Approved — Your Employee ID: ${employeeId} — ${COMPANY}`;

    const safeName    = `${(firstName || 'employee').replace(/[^a-zA-Z0-9]/g, '_')}_KYE_Form.pdf`;
    const attachments = pdfBase64
      ? [{ ContentType: 'application/pdf', Filename: safeName, Base64Content: pdfBase64 }]
      : [];

    if (pdfBase64) {
      console.log(`📎 Sending approval email WITH KYE PDF to ${to}`);
    } else {
      console.warn(`⚠️  Sending approval email WITHOUT KYE PDF to ${to}`);
    }

    if (uploadUrl) {
      console.log(`🔗 Approval email includes upload link: ${uploadUrl}`);
    }

    return sendEmailWithAttachment({
      to, toName: name, subject, htmlBody: html, textBody, attachments,
    });
  }

  // =============================================================================
  // NEW: sendHRDocSubmissionNotification
  // HR notification when an employee uploads their signed KYE doc
  // =============================================================================
  export async function sendHRDocSubmissionNotification({
    firstName, lastName, empId, email, docsUploaded,
  }) {
    const name        = `${firstName || ''} ${lastName || ''}`.trim();
    const submittedAt = new Date().toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

    const bodyContent = `
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3d4563;line-height:1.85;margin:0 0 22px;">
        An employee has uploaded their signed KYE document and it is ready for your review.
      </p>
      <table style="width:100%;border:1px solid #e0e4f0;border-collapse:collapse;font-size:9pt;margin-bottom:3mm;">
        <tbody>
          <tr>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#9098b4;font-weight:600;font-size:11px;
                      letter-spacing:0.3px;white-space:nowrap;width:38%;background:#fafbfd;text-transform:uppercase;">
              Employee Name</td>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#1c2340;font-weight:500;">${name}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#9098b4;font-weight:600;font-size:11px;
                      letter-spacing:0.3px;white-space:nowrap;width:38%;background:#fafbfd;text-transform:uppercase;">
              Employee ID</td>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;font-family:'Courier New',monospace;
                      font-size:13px;font-weight:700;letter-spacing:0.5px;color:#162040;">${empId || '—'}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#9098b4;font-weight:600;font-size:11px;
                      letter-spacing:0.3px;white-space:nowrap;width:38%;background:#fafbfd;text-transform:uppercase;">
              Email</td>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#1c2340;font-weight:500;">${email || '—'}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#9098b4;font-weight:600;font-size:11px;
                      letter-spacing:0.3px;white-space:nowrap;width:38%;background:#fafbfd;text-transform:uppercase;">
              Documents Uploaded</td>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#145a30;font-weight:700;">${docsUploaded} file(s)</td>
          </tr>
          <tr>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#9098b4;font-weight:600;font-size:11px;
                      letter-spacing:0.3px;white-space:nowrap;width:38%;background:#fafbfd;text-transform:uppercase;">
              Submitted At</td>
            <td style="border:1px solid #e0e4f0;padding:11px 18px;color:#1c2340;font-weight:500;">${submittedAt}</td>
          </tr>
        </tbody>
      </table>

      <div style="text-align:center;margin:26px 0;">
        <a href="${FRONTEND_URL}/pending-approvals"
          style="display:inline-block;padding:14px 38px;background-color:#162040;color:#ffffff;
                  font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                  letter-spacing:1px;text-transform:uppercase;text-decoration:none;">
          Review Documents in Admin Panel
        </a>
      </div>

      <div style="padding:18px 22px;margin:20px 0;border-left:4px solid #162040;background:#f0f2f8;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:1.8px;text-transform:uppercase;color:#162040;margin:0 0 7px;">Action Required</p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#2a3560;margin:0;">
          Please log in to the admin panel, navigate to the employee's profile, and verify
          the uploaded signed KYE form.
        </p>
      </div>
    `;

    const html = base(
      `${name} has uploaded their signed KYE document — action required`,
      {
        accentVariant: 'green', headerVariant: 'green',
        headerTitle:   'KYE Document Submitted',
        headerSubtitle: `${name} has uploaded their signed KYE form`,
        badgeLabel: 'Review Required',
        bodyContent,
      }
    );

    return sendEmail({
      to:      HR_EMAIL,
      toName:  HR_NAME,
      subject: `KYE Document Submitted: ${name} (${empId || 'N/A'}) — Review Required`,
      htmlBody: html,
      textBody: `KYE Document Submitted\n\n${name} (${empId}) has uploaded ${docsUploaded} document(s).\nSubmitted: ${submittedAt}\n\nReview in admin panel.\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 5. REJECTION WITH RESUBMIT LINK — sent to employee
  // =============================================================================
  export async function sendRejectionEmailWithRelink({ to, firstName, lastName, reason, resubmitUrl, resubmitExpiry }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const expiry     = resubmitExpiry
      ? new Date(resubmitExpiry).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : null;
    const rejectedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Applicant'},</p>
      <p class="lead">
        Thank you for submitting your registration with <strong>${COMPANY}</strong>.
        After careful review by our HR team, your application requires corrections before it can be approved.
      </p>
      <div class="notice notice-red">
        <p class="notice-title">Reason for Rejection</p>
        <p class="notice-text">
          ${reason || 'Your application did not meet the required criteria. Please review all sections carefully and resubmit.'}
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8e1c1c;margin:10px 0 0;">Reviewed on: ${rejectedAt}</p>
      </div>
      <div class="resubmit-box">
        <p class="resubmit-title">Resubmit Your Application</p>
        <p class="resubmit-sub">
          Your previous details have been saved automatically. Click the button below to open your
          pre-filled form — review each section, make the necessary corrections, and resubmit.
        </p>
        ${btn('Open Pre-Filled Form and Resubmit', resubmitUrl, 'amber')}
        <p class="resubmit-sub" style="margin:0 0 6px;font-size:12px;">Or copy this link into your browser:</p>
        ${urlBox(resubmitUrl)}
        ${expiry ? `<p class="resubmit-expiry">This link expires on <strong>${expiry}</strong> and can only be used once.</p>` : ''}
      </div>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:20px 0 14px;">How to Resubmit</p>
      ${steps([
        'Click the button above to open your pre-filled registration form',
        'Review all sections — pay particular attention to the rejection reason stated above',
        'Correct any incorrect or missing information and re-upload documents if needed',
        'Submit the updated form — HR will review your corrected application',
      ], 'amber')}
    `;

    const html = base('Action required — please resubmit your registration', {
      accentVariant: 'amber', headerVariant: 'amber',
      headerTitle: 'Registration — Action Required',
      headerSubtitle: 'Your application requires corrections before it can be approved',
      badgeLabel: 'Action Required', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `Action Required: Please Resubmit Your Registration — ${COMPANY}`,
      htmlBody: html,
      textBody: `Registration — Action Required\n\nDear ${firstName},\n\nReason: ${reason || 'Please review and resubmit.'}\n\nResubmit here:\n${resubmitUrl}\n\n${expiry ? `Link expires: ${expiry}` : ''}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  export const sendRejectionEmail = sendRejectionEmailWithRelink;

  // =============================================================================
  // 6. APPROVED — HR log notification (normal + rejoin)
  // =============================================================================
  export async function sendHRApprovalNotification({ firstName, lastName, employeeId, previousEmployeeId, email, department, isRejoin = false }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const approvedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const variant    = isRejoin ? 'indigo' : 'green';

    const bodyContent = `
      <p class="lead">
        The following employee ${isRejoin ? 'rejoin request' : 'registration'} has been approved and ${isRejoin ? 'a new' : 'an'} Employee ID has been assigned.
      </p>
      <div class="emp-id-panel">
        <p class="amount-label">${isRejoin ? 'New ' : ''}Employee ID Assigned</p>
        <p class="emp-id-figure ${isRejoin ? 'indigo' : 'green'}">${employeeId}</p>
      </div>
      <table class="info-table"><tbody>
        ${infoRow('Full Name', name)}
        ${infoRowMono('New Employee ID', employeeId)}
        ${isRejoin && previousEmployeeId ? infoRowMono('Previous Employee ID', previousEmployeeId) : ''}
        ${infoRow('Email', email || '—')}
        ${infoRow('Department', department || '—')}
        ${infoRow('Approved On', approvedAt)}
      </tbody></table>
      <div class="notice notice-${variant}">
        <p class="notice-title">Notification Sent</p>
        <p class="notice-text">
          The employee has been notified by email with their ${isRejoin ? 'new ' : ''}Employee ID <strong>${employeeId}</strong> and a KYE PDF form attachment.
          They will print, fill by hand, sign and submit the physical form to the HR office.
        </p>
      </div>
    `;

    const html = base(
      `Employee ${isRejoin ? 'rejoin ' : ''}approved — ${name} assigned ID ${employeeId}`,
      {
        accentVariant: variant, headerVariant: variant,
        headerTitle: isRejoin ? 'Rejoin Request Approved' : 'Employee Approved',
        headerSubtitle: isRejoin ? 'Previously inactive employee re-activated with a new Employee ID' : 'Registration has been approved and an Employee ID has been assigned',
        badgeLabel: 'Approved', bodyContent,
      }
    );

    return sendEmail({
      to: HR_EMAIL, toName: HR_NAME,
      subject: isRejoin
        ? `Rejoin Approved: ${name} — New ID ${employeeId}`
        : `Approved: ${name} — Employee ID ${employeeId}`,
      htmlBody: html,
      textBody: `Employee Approved\n\n${name}\nEmployee ID: ${employeeId}\nApproved: ${approvedAt}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 7. REJECTED — HR log notification
  // =============================================================================
  export async function sendHRRejectionNotification({ firstName, lastName, email, reason }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const rejectedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="lead">The following employee registration has been rejected. A pre-filled resubmission link has been automatically sent to the employee.</p>
      <table class="info-table"><tbody>
        ${infoRow('Applicant Name', name)}
        ${infoRow('Email', email || '—')}
        ${infoRow('Rejected On', rejectedAt)}
        ${reason ? infoRow('Reason Given', reason) : ''}
      </tbody></table>
      <div class="notice notice-amber">
        <p class="notice-title">Resubmission Link Sent</p>
        <p class="notice-text">A pre-filled resubmission link has been sent to <strong>${email || 'the employee'}</strong>.</p>
      </div>
      ${btn('View Pending Approvals', `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pending-approvals`, 'navy')}
    `;

    const html = base(`Registration rejected — ${name}`, {
      accentVariant: 'red', headerVariant: 'red',
      headerTitle: 'Registration Rejected',
      headerSubtitle: 'A resubmission link has been sent to the employee',
      badgeLabel: 'Rejected', bodyContent,
    });

    return sendEmail({
      to: HR_EMAIL, toName: HR_NAME,
      subject: `Rejected: ${name} — Resubmission Link Sent`,
      htmlBody: html,
      textBody: `Registration Rejected\n\n${name}\nEmail: ${email}\nReason: ${reason || 'N/A'}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 8. STATUS CHANGED TO ACTIVE — sent to employee
  // =============================================================================
  export async function sendActiveNotificationEmail({ to, firstName, lastName }) {
    const name      = `${firstName || ''} ${lastName || ''}`.trim();
    const changedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">Your employee account at <strong>${COMPANY}</strong> has been <strong>reactivated</strong> effective <strong>${changedAt}</strong>.</p>
      <div class="notice notice-green">
        <p class="notice-title">Account Reactivated</p>
        <p class="notice-text">Your access to company systems has been fully restored. Please contact your reporting manager for updated work assignments.</p>
      </div>
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">Questions? Contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`Your account at ${COMPANY} has been reactivated`, {
      accentVariant: 'green', headerVariant: 'green',
      headerTitle: 'Account Reactivated',
      headerSubtitle: 'Your employee account is now active again',
      badgeLabel: 'Active', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `Account Reactivated — Welcome Back to ${COMPANY}`,
      htmlBody: html,
      textBody: `Account Reactivated\n\nDear ${firstName},\n\nYour account has been reactivated effective ${changedAt}.\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 9. STATUS CHANGED TO INACTIVE — sent to employee
  // =============================================================================
  export async function sendInactiveNotificationEmail({ to, firstName, lastName, reason }) {
    const name      = `${firstName || ''} ${lastName || ''}`.trim();
    const changedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">Your employee account at <strong>${COMPANY}</strong> has been <strong>deactivated</strong> as of <strong>${changedAt}</strong>.</p>
      <div class="notice notice-amber">
        <p class="notice-title">Reason for Deactivation</p>
        <p class="notice-text">${reason || 'Your account has been deactivated by HR. Please contact HR for more information.'}</p>
      </div>
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">Questions? Contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`Your account at ${COMPANY} has been deactivated`, {
      accentVariant: 'amber', headerVariant: 'amber',
      headerTitle: 'Account Deactivated',
      headerSubtitle: 'Your employee account has been deactivated',
      badgeLabel: 'Inactive', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `Account Deactivated — ${COMPANY}`,
      htmlBody: html,
      textBody: `Account Deactivated\n\nDear ${firstName},\n\nYour account has been deactivated effective ${changedAt}.\nReason: ${reason || 'Contact HR for details.'}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 10. STATUS CHANGED TO BLACKLIST — sent to employee
  // =============================================================================
  export async function sendBlacklistNotificationEmail({ to, firstName, lastName, reason }) {
    const name      = `${firstName || ''} ${lastName || ''}`.trim();
    const changedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">Your employee account at <strong>${COMPANY}</strong> has been <strong>blacklisted</strong> effective <strong>${changedAt}</strong>.</p>
      <div class="notice notice-red">
        <p class="notice-title">Reason for Blacklisting</p>
        <p class="notice-text">${reason || 'Your account has been blacklisted due to a policy violation. Please contact HR for further details.'}</p>
      </div>
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">For official correspondence, contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`Important notice regarding your account at ${COMPANY}`, {
      accentVariant: 'red', headerVariant: 'red',
      headerTitle: 'Account Blacklisted',
      headerSubtitle: `Official notice from ${COMPANY} HR`,
      badgeLabel: 'Blacklisted', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `Official Notice: Account Blacklisted — ${COMPANY}`,
      htmlBody: html,
      textBody: `Official Notice: Account Blacklisted\n\nDear ${firstName},\n\nYour account has been blacklisted effective ${changedAt}.\nReason: ${reason || 'Contact HR for details.'}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 11. REJOIN INVITATION — sent to inactive employee by HR
  // =============================================================================
  export async function sendRejoinInvitationEmail({ to, firstName, lastName, employeeId, registrationUrl, expiresAt }) {
    const name   = `${firstName || ''} ${lastName || ''}`.trim();
    const expiry = new Date(expiresAt).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">
        <strong>${COMPANY}</strong> HR has extended an invitation for you to <strong>rejoin the organisation</strong>.
        Your previous employment record has been located and your details will be pre-filled in the registration form.
      </p>
      ${btn('Open Rejoin Registration Form', registrationUrl, 'indigo')}
      <p class="lead" style="margin-bottom:8px;font-size:13px;">If the button does not work, copy and paste the following link into your browser:</p>
      ${urlBox(registrationUrl)}
      <div class="notice notice-amber">
        <p class="notice-title">Important</p>
        <p class="notice-text">
          This link expires on <strong>${expiry}</strong> and can only be used <strong>once</strong>.
          Please do not share it with anyone.
        </p>
      </div>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:20px 0 14px;">How the Rejoin Process Works</p>
      ${steps([
        'Click the button above to open your pre-filled registration form',
        'Review each section — your previous details are auto-loaded',
        'Update any information that has changed',
        'Upload fresh documents and submit — HR will review within 1 to 2 business days',
        'Upon approval, you will receive a new Employee ID and KYE form by email',
      ], 'indigo')}
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">Need help? Contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`You have been invited to rejoin ${COMPANY}`, {
      accentVariant: 'indigo', headerVariant: 'indigo',
      headerTitle: 'Invitation to Rejoin',
      headerSubtitle: `${COMPANY} HR is inviting you back to the organisation`,
      badgeLabel: 'Rejoin Request', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `You are Invited to Rejoin ${COMPANY} — Complete Your Registration`,
      htmlBody: html,
      textBody: `Rejoin Invitation\n\nDear ${firstName},\n\nOpen the rejoin form here:\n${registrationUrl}\n\nExpires: ${expiry}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 12. REJOIN REQUEST DECLINED — sent to employee
  // =============================================================================
export async function sendRejoinDeclinedEmail({
  to, firstName, lastName, employeeId, reason,
  rejoinUrl = null,           // ← NEW
  rejoinUrlExpiry = null,     // ← NEW
}) {
  const name       = `${firstName || ''} ${lastName || ''}`.trim();
  const declinedAt = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const expiry = rejoinUrlExpiry
    ? new Date(rejoinUrlExpiry).toLocaleString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  const bodyContent = `
    <p class="greeting">Dear ${firstName || 'Employee'},</p>
    <p class="lead">
      Thank you for your interest in rejoining <strong>${COMPANY}</strong>.
      After careful review, your rejoin request has been <strong>declined</strong>.
      ${rejoinUrl
        ? `However, you may <strong>correct and resubmit</strong> your application using the link below.`
        : `Please contact HR for more information.`
      }
    </p>

    <div class="notice notice-red">
      <p class="notice-title">Reason for Declining</p>
      <p class="notice-text">
        ${reason || 'Your rejoin request did not meet the current requirements. Please review your details and resubmit.'}
      </p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8e1c1c;margin:10px 0 0;">
        Reviewed on: ${declinedAt}
      </p>
    </div>

    ${rejoinUrl ? `
    <!-- ── Re-edit link panel ─────────────────────────────── -->
    <div style="border:1.5px solid #c8a828;background-color:#fdf8ec;padding:26px 28px;margin:22px 0;text-align:center;">
      <p style="font-family:Georgia,'Times New Roman',Times,serif;font-size:17px;color:#5a3c00;margin:0 0 10px;font-weight:700;">
         Correct &amp; Resubmit Your Rejoin Request
      </p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#7a5210;line-height:1.75;margin:0 0 20px;">
        Your previous details have been saved. Click the button below to open your
        pre-filled form, make the necessary corrections, and resubmit.
      </p>
      <div style="text-align:center;margin:0 0 16px;">
        <a href="${rejoinUrl}"
          style="display:inline-block;padding:14px 38px;background-color:#2d2880;color:#ffffff;
                  font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                  letter-spacing:1px;text-transform:uppercase;text-decoration:none;">
          Open Pre-Filled Rejoin Form
        </a>
      </div>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a6220;margin:10px 0 4px;font-weight:700;">
        Or copy this link into your browser:
      </p>
      <div style="background-color:#fff8e6;border:1px dashed #c0a020;padding:10px 14px;
                  font-family:'Courier New',Courier,monospace;font-size:10px;color:#5a3c00;
                  word-break:break-all;text-align:left;line-height:1.6;">
        ${rejoinUrl}
      </div>
      ${expiry ? `
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a6220;margin:14px 0 0;font-style:italic;">
        ⏰ This link expires on <strong>${expiry}</strong> and can only be used once.
        If it expires, contact HR at <strong>${HR_EMAIL}</strong> to request a new link.
      </p>` : ''}
    </div>

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#0e1a3a;margin:20px 0 14px;">
      How to Resubmit
    </p>
    ${steps([
      'Click the button above to open your pre-filled rejoin form',
      'Review all sections — pay attention to the decline reason stated above',
      'Correct any incorrect or missing information and re-upload documents if needed',
      'Submit the updated form — HR will review your resubmission',
    ], 'indigo')}
    ` : `
    ${steps([
      'Your employee record has been returned to Inactive status',
      'Your original profile information has been preserved',
      'HR may reach out with a new invitation in the future if circumstances change',
      'For questions or appeals, please contact HR directly',
    ], 'red')}
    `}

    <hr class="divider"/>
    <p class="ref-text" style="text-align:center;">
      Questions? Contact HR at <strong>${HR_EMAIL}</strong>
    </p>
  `;

  const html = base(
    rejoinUrl
      ? `Your rejoin request was declined — please correct and resubmit`
      : `Your rejoin request has been declined — ${COMPANY}`,
    {
      accentVariant: rejoinUrl ? 'amber' : 'red',
      headerVariant: rejoinUrl ? 'amber' : 'red',
      headerTitle:   'Rejoin Request Declined',
      headerSubtitle: rejoinUrl
        ? 'Please review the reason and resubmit your corrected application'
        : `${COMPANY} HR has reviewed your request`,
      badgeLabel: rejoinUrl ? 'Action Required' : 'Declined',
      bodyContent,
    }
  );

  return sendEmail({
    to, toName: name,
    subject: rejoinUrl
      ? `Action Required: Resubmit Your Rejoin Request — ${COMPANY}`
      : `Rejoin Request Declined — ${COMPANY}`,
    htmlBody: html,
    textBody: [
      `Rejoin Request Declined`,
      ``,
      `Dear ${firstName},`,
      ``,
      `Reason: ${reason || 'Please contact HR for details.'}`,
      `Reviewed: ${declinedAt}`,
      rejoinUrl ? `\nResubmit here: ${rejoinUrl}` : '',
      expiry    ? `Link expires: ${expiry}` : '',
      ``,
      `Insta ICT Solutions — HR Department`,
    ].filter(l => l !== null).join('\n'),
  });
}

  // =============================================================================
  // 13. REJOIN INVITE EXPIRED — sent to employee
  // =============================================================================
  export async function sendRejoinInviteExpiredEmail({ to, firstName, lastName, employeeId }) {
    const name      = `${firstName || ''} ${lastName || ''}`.trim();
    const expiredAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">
        The rejoin invitation link sent to you by <strong>${COMPANY}</strong> HR has <strong>expired</strong> without being used.
        Registration links are valid for <strong>7 days</strong> from the date they are sent.
      </p>
      <div class="notice notice-amber">
        <p class="notice-title">Link Expired</p>
        <p class="notice-text">Expired on: <strong>${expiredAt}</strong></p>
      </div>
      ${steps([
        'Your employee record remains in Inactive status',
        'If you still wish to rejoin, please contact HR to request a new invitation link',
        'HR can send you a fresh 7-day invitation at any time',
      ], 'amber')}
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">To request a new invitation, contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`Your rejoin invitation has expired — ${COMPANY}`, {
      accentVariant: 'amber', headerVariant: 'amber',
      headerTitle: 'Invitation Expired',
      headerSubtitle: 'Your rejoin registration link is no longer valid',
      badgeLabel: 'Expired', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `Your Rejoin Invitation Has Expired — ${COMPANY}`,
      htmlBody: html,
      textBody: `Rejoin Invitation Expired\n\nDear ${firstName},\n\nYour rejoin invitation expired on ${expiredAt}.\nPlease contact HR to request a new invitation.\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // 14. REJOIN REQUEST CANCELLED BY HR — sent to employee
  // =============================================================================
  export async function sendRejoinCancelledEmail({ to, firstName, lastName, employeeId }) {
    const name        = `${firstName || ''} ${lastName || ''}`.trim();
    const cancelledAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const bodyContent = `
      <p class="greeting">Dear ${firstName || 'Employee'},</p>
      <p class="lead">
        Your pending rejoin request with <strong>${COMPANY}</strong> has been <strong>cancelled</strong> by HR as of <strong>${cancelledAt}</strong>.
        Your employee record has been returned to Inactive status and your original profile information has been preserved.
      </p>
      <div class="notice notice-navy">
        <p class="notice-title">Request Cancelled</p>
        <p class="notice-text">If you believe this was done in error, please contact HR immediately.</p>
      </div>
      <hr class="divider"/>
      <p class="ref-text" style="text-align:center;">Questions? Contact HR at <strong>${HR_EMAIL}</strong></p>
    `;

    const html = base(`Your rejoin request has been cancelled — ${COMPANY}`, {
      accentVariant: 'navy', headerVariant: 'navy',
      headerTitle: 'Rejoin Request Cancelled',
      headerSubtitle: `${COMPANY} HR has cancelled your pending request`,
      badgeLabel: 'Cancelled', bodyContent,
    });

    return sendEmail({
      to, toName: name,
      subject: `Rejoin Request Cancelled — ${COMPANY}`,
      htmlBody: html,
      textBody: `Rejoin Request Cancelled\n\nDear ${firstName},\n\nYour rejoin request was cancelled by HR on ${cancelledAt}.\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // NEW: sendDocAcceptanceEmail — sent to employee when KYE doc is accepted
  // =============================================================================
  export async function sendDocAcceptanceEmail({ to, firstName, lastName, employeeId }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const acceptedAt = new Date().toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const bodyContent = `
      <p style="font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;color:#0e1a3a;margin:0 0 12px;">
        Dear ${firstName || 'Employee'},
      </p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3d4563;line-height:1.85;margin:0 0 22px;">
        We are pleased to inform you that your submitted KYE form has been
        <strong>reviewed and accepted</strong> by the HR team. Your onboarding is now complete.
      </p>
      <div style="background-color:#f7f8fc;border:1px solid #dde1ea;padding:24px;text-align:center;margin:22px 0;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:2px;text-transform:uppercase;color:#9098b4;margin:0 0 8px;">
          Employee ID
        </p>
        <p style="font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;
                  letter-spacing:5px;margin:0;line-height:1.1;color:#145a30;">
          ${employeeId || '—'}
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9098b4;margin:10px 0 0;">
          Document accepted on: ${acceptedAt}
        </p>
      </div>
      <div style="padding:18px 22px;margin:20px 0;border-left:4px solid #145a30;background:#edf7f1;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:1.8px;text-transform:uppercase;color:#145a30;margin:0 0 7px;">
          Onboarding Complete
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#1a5a32;margin:0;">
          Your signed KYE form has been verified and accepted.
          Your employee record is fully complete.
          HR will reach out with further joining details if required.
        </p>
      </div>
      <hr style="border:none;border-top:1px solid #e8eaf2;margin:26px 0;"/>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9098b4;
                line-height:1.7;margin:0;text-align:center;">
        Questions? Contact HR at <strong>${HR_EMAIL}</strong>
      </p>
    `;

    const html = base(
      'Your submitted KYE document has been accepted — onboarding complete',
      {
        accentVariant: 'green', headerVariant: 'green',
        headerTitle:   'KYE Document Accepted',
        headerSubtitle: `Your onboarding is complete — ${COMPANY}`,
        badgeLabel: 'Accepted',
        bodyContent,
      }
    );

    return sendEmail({
      to, toName: name,
      subject: `KYE Document Accepted — Onboarding Complete — ${COMPANY}`,
      htmlBody: html,
      textBody: `KYE Document Accepted\n\nDear ${firstName},\n\nYour signed KYE form has been reviewed and accepted.\nEmployee ID: ${employeeId}\nAccepted: ${acceptedAt}\n\nInsta ICT Solutions — HR Department`,
    });
  }

  // =============================================================================
  // NEW: sendDocRejectionEmail — sent to employee when KYE doc is rejected
  // =============================================================================
  export async function sendDocRejectionEmail({ to, firstName, lastName, employeeId, reason, uploadUrl }) {
    const name       = `${firstName || ''} ${lastName || ''}`.trim();
    const rejectedAt = new Date().toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const bodyContent = `
      <p style="font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;color:#0e1a3a;margin:0 0 12px;">
        Dear ${firstName || 'Employee'},
      </p>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#3d4563;line-height:1.85;margin:0 0 22px;">
        Thank you for submitting your KYE form. After review, the HR team has
        <strong>rejected</strong> your submitted document and you will need to re-submit it.
      </p>
      <div style="padding:18px 22px;margin:20px 0;border-left:4px solid #8e1c1c;background:#fdf1f1;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:1.8px;text-transform:uppercase;color:#8e1c1c;margin:0 0 7px;">
          Reason for Rejection
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#6e1818;margin:0;">
          ${reason || 'Your KYE form did not meet the required criteria. Please ensure the form is fully filled by hand, clearly legible, and properly signed before re-submitting.'}
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8e1c1c;margin:10px 0 0;">
          Reviewed on: ${rejectedAt}
        </p>
      </div>
      <div style="padding:18px 22px;margin:20px 0;border-left:4px solid #a0620a;background:#fdf6e8;">
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;
                  letter-spacing:1.8px;text-transform:uppercase;color:#a0620a;margin:0 0 7px;">
          Next Steps
        </p>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.8;color:#7a4a08;margin:0;">
          Please contact HR at <strong>${HR_EMAIL}</strong> to arrange re-submission of your signed KYE form.
        </p>
      </div>
      <hr style="border:none;border-top:1px solid #e8eaf2;margin:26px 0;"/>
      <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9098b4;
                line-height:1.7;margin:0;text-align:center;">
        Questions? Contact HR at <strong>${HR_EMAIL}</strong>
      </p>
    `;

    
    const html = base(
      'Your submitted KYE document has been rejected — please re-submit',
      {
        accentVariant: 'red', headerVariant: 'red',
        headerTitle:   'KYE Document Rejected',
        headerSubtitle: 'Please re-submit your signed KYE form — action required',
        badgeLabel: 'Action Required',
        bodyContent,
      }
    );

    return sendEmail({
      to, toName: name,
      subject: `Action Required: Re-submit KYE Document — ${COMPANY}`,
      htmlBody: html,
      textBody: `KYE Document Rejected\n\nDear ${firstName},\n\nReason: ${reason || 'Please review and re-submit.'}\nReviewed: ${rejectedAt}\n\nContact HR at ${HR_EMAIL} to arrange re-submission.\n\nInsta ICT Solutions — HR Department`,
    });
  }
  