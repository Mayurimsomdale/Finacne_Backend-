// services/kyePdfService.js
// ─────────────────────────────────────────────────────────────────────────────
// Generates a KYE (Know Your Employee) form as a PDF Buffer using Puppeteer.
// ✅ UPDATED: UAN Number displayed in:
//   - Page 1: Employee Personal Details table (after Name on Aadhaar Card)
//   - Page 4: For Office Use Only — UAN row populated with actual value
// ─────────────────────────────────────────────────────────────────────────────

import puppeteer from 'puppeteer';
import fs        from 'fs';
import path      from 'path';
import { fileURLToPath } from 'url';

const __filename   = fileURLToPath(import.meta.url);
const __dirname    = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

// ── Logo path resolution ───────────────────────────────────────────────────────
const LOGO_RELATIVE_PATH = 'Public/assets/Insta_LOGO.png';

function resolveLogoDataUri() {
  const absPath = path.resolve(PROJECT_ROOT, LOGO_RELATIVE_PATH);
  try {
    if (fs.existsSync(absPath)) {
      const ext      = path.extname(absPath).toLowerCase();
      const mimeMap  = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      const mimeType = mimeMap[ext] || 'image/png';
      const b64      = fs.readFileSync(absPath).toString('base64');
      console.log(`✅ [KYE PDF] Logo loaded from: ${absPath}`);
      return `data:${mimeType};base64,${b64}`;
    }
  } catch (err) {
    console.warn(`⚠️  [KYE PDF] Could not load logo from ${absPath}:`, err.message);
  }
  const fallbacks = [
    path.resolve(PROJECT_ROOT, 'public/assets/Insta_LOGO.png'),
    path.resolve(PROJECT_ROOT, 'assets/Insta_LOGO.png'),
    path.resolve(PROJECT_ROOT, 'Public/Assets/Insta_LOGO.png'),
  ];
  for (const fb of fallbacks) {
    try {
      if (fs.existsSync(fb)) {
        const b64 = fs.readFileSync(fb).toString('base64');
        console.log(`✅ [KYE PDF] Logo loaded from fallback: ${fb}`);
        return `data:image/png;base64,${b64}`;
      }
    } catch (_) {}
  }
  console.warn('⚠️  [KYE PDF] Logo not found in any path — rendering without logo.');
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const val = (v) =>
  v ? String(v)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
    : '';

// ── Resolve UAN — handles both snake_case (DB) and camelCase (form state) ─────
const resolveUan = (e) => val(e.uan_number || e.uanNumber || '');

// ── Resolve employee photo to inline base64 data URI ─────────────────────────
function resolvePhotoDataUri(rawPath) {
  if (!rawPath) return null;
  try {
    const relativePath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
    const absPath      = path.resolve(PROJECT_ROOT, relativePath);
    if (!fs.existsSync(absPath)) {
      console.warn(`⚠️  [KYE PDF] Photo not found: ${absPath}`);
      return null;
    }
    const ext      = path.extname(absPath).toLowerCase();
    const mimeMap  = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    const mimeType = mimeMap[ext] || 'image/jpeg';
    const b64      = fs.readFileSync(absPath).toString('base64');
    return `data:${mimeType};base64,${b64}`;
  } catch (err) {
    console.warn('⚠️  [KYE PDF] Could not read photo:', err.message);
    return null;
  }
}

// ── Table row helpers ──────────────────────────────────────────────────────────
const row = (label, value) => `
  <tr>
    <td class="label">${label}</td>
    <td class="value">${val(value)}</td>
    <td class="check"></td>
    <td class="check"></td>
  </tr>`;

const rowTall = (label, value, height = '18mm') => `
<tr class="tall-row">
  <td class="label">${label}</td>
  <td class="value" style="height:${height};">${val(value)}</td>
  <td class="check"></td>
  <td class="check"></td>
</tr>`;

// ── Reference section rows ─────────────────────────────────────────────────────
const buildRefRows = (e) => `
  <tr>
    <td class="ref-label">Name</td>
    <td class="ref-val">${val(e.ref1_name)}</td>
    <td class="ref-val">${val(e.ref2_name)}</td>
    <td class="ref-val">${val(e.ref3_name)}</td>
  </tr>
  <tr>
    <td class="ref-label">Designation</td>
    <td class="ref-val">${val(e.ref1_designation)}</td>
    <td class="ref-val">${val(e.ref2_designation)}</td>
    <td class="ref-val">${val(e.ref3_designation)}</td>
  </tr>
  <tr>
    <td class="ref-label">Name of Organisation</td>
    <td class="ref-val">${val(e.ref1_organization)}</td>
    <td class="ref-val">${val(e.ref2_organization)}</td>
    <td class="ref-val">${val(e.ref3_organization)}</td>
  </tr>
  <tr>
    <td class="ref-label">Address</td>
    <td class="ref-val" style="height:30px;">${val(e.ref1_address)}</td>
    <td class="ref-val">${val(e.ref2_address)}</td>
    <td class="ref-val">${val(e.ref3_address)}</td>
  </tr>
  <tr>
    <td class="ref-label">City, State, Pin Code</td>
    <td class="ref-val">${val(e.ref1_city_state_pin)}</td>
    <td class="ref-val">${val(e.ref2_city_state_pin)}</td>
    <td class="ref-val">${val(e.ref3_city_state_pin)}</td>
  </tr>
  <tr>
    <td class="ref-label">Contact No. (Mobile / Landline)</td>
    <td class="ref-val">${val(e.ref1_contact_no)}</td>
    <td class="ref-val">${val(e.ref2_contact_no)}</td>
    <td class="ref-val">${val(e.ref3_contact_no)}</td>
  </tr>
  <tr>
    <td class="ref-label">Email ID (Preferably Official)</td>
    <td class="ref-val">${val(e.ref1_email)}</td>
    <td class="ref-val">${val(e.ref2_email)}</td>
    <td class="ref-val">${val(e.ref3_email)}</td>
  </tr>
  <tr>
    <td class="ref-label" style="vertical-align:top;padding-top:4px;">
      Verification Comment<br>
      <span style="font-size:7pt;font-weight:400;">(To be recorded by HR Manager)</span>
    </td>
    <td class="ref-val" style="height:48px;"></td>
    <td class="ref-val"></td>
    <td class="ref-val"></td>
  </tr>`;

// ── Document checklist helper ──────────────────────────────────────────────────
const docAttached = (docs, ...types) => {
  if (!Array.isArray(docs)) return '';
  const found = docs.find(d => types.includes(d.type || d.document_type));
  return found ? 'Yes ✓' : '';
};

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
*{
  box-sizing:border-box;
}

body{
  margin:0;
  padding:0;
  font-family:Arial,Helvetica,sans-serif;
  color:#000;
  background:#fff;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}

.page{
  width:210mm;
  min-height:297mm;
  padding:7mm 11mm 10mm 11mm;
  position:relative;
  background:#fff;
  page-break-after:always;
}

.page:last-child{
  page-break-after:auto;
}

.page-top-row{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  margin-bottom:2mm;
}

.revision-label{
  font-size:7pt;
  color:#222;
  padding-top:1mm;
}

.logo-img{
  width:24mm;
  height:auto;
  object-fit:contain;
}

.form-title-box{
  border:1.2px solid #000;
  text-align:center;
  padding:7px 0 6px;
  margin-bottom:3mm;
}

.title-line1{
  font-size:13pt;
  font-weight:700;
  line-height:1.2;
}

.title-line2{
  font-size:13pt;
  font-weight:700;
  line-height:1.2;
}

.photo-wrap{
  display:flex;
  justify-content:flex-end;
  margin-bottom:2mm;
}

.photo-box{
  width:31mm;
  height:38mm;
  border:1px solid #000;
  background:#f7f7f7;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}

.photo-box img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.photo-placeholder{
  font-size:6pt;
  text-align:center;
  line-height:1.5;
  color:#888;
  padding:4px;
}

.sec-heading{
  font-size:9.5pt;
  font-weight:700;
  text-decoration:underline;
  margin:2mm 0 1mm;
}

.ver-header{
  width:188mm;
  border-collapse:collapse;
  table-layout:fixed;
  margin-bottom:0;
  margin-left:0;
}

.ver-header td{
  border:1px solid #000;
  text-align:center;
  font-size:6.2pt;
  padding:2px 1px;
  line-height:1.25;
  font-weight:700;
}

.ver-spacer{
  width:144mm;
  border:none !important;
  background:transparent;
}

.ver-group{
  width:44mm;
}

.ver-sub{
  width:22mm;
}

.data-table{
  width:188mm;
  border-collapse:collapse;
  table-layout:fixed;
  margin-bottom:2.5mm;
}

.data-table td{
  border:1px solid #000;
  padding:3px 5px;
  font-size:8.5pt;
  vertical-align:middle;
  line-height:1.25;
}

.label{
  width:62mm;
  font-weight:400;
}

.value{
  width:82mm;
}

.check{
  width:22mm;
}

.tall-row td{
  vertical-align:top;
  padding-top:4px;
}

.addr-sub{
  font-size:8.8pt;
  font-weight:700;
  margin:2mm 0 1mm;
}

.ref-table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  margin-bottom:3mm;
}

.ref-table th,
.ref-table td{
  border:1px solid #000;
  padding:4px;
  font-size:8.3pt;
  line-height:1.25;
}

.ref-table thead th{
  background:#4472C4;
  color:#fff;
  text-align:center;
  font-weight:700;
}

.ref-lbl-hdr{
  background:#D9E2F3 !important;
  color:#000 !important;
  text-align:left !important;
}

.ref-label{
  width:54mm;
  font-weight:400;
}

.ref-val{
  height:20px;
}

.decl-eng{
  font-size:8.6pt;
  line-height:1.6;
  text-align:justify;
  margin-bottom:3mm;
}

.decl-hindi{
  border:1px solid #ccc;
  background:#fafafa;
  padding:6px 8px;
  font-size:8.5pt;
  line-height:1.7;
  text-align:justify;
}

.decl-hindi-title{
  font-weight:700;
  margin-bottom:3px;
}

.name-blank{
  display:inline-block;
  min-width:85mm;
  border-bottom:1px solid #000;
}

.name-blank-sm{
  display:inline-block;
  min-width:70mm;
  border-bottom:1px solid #000;
}

.sig-area{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  margin-top:7mm;
}

.sig-left div{
  margin-bottom:7mm;
  font-size:8.8pt;
}

.sig-right{
  text-align:center;
}

.sig-title{
  font-size:9pt;
  font-weight:700;
}

.sig-line{
  width:62mm;
  border-top:1px solid #000;
  margin-top:13mm;
  padding-top:2px;
  font-size:8pt;
}

.note-box{
  border:1px solid #000;
  padding:7px 9px;
  margin-top:5mm;
  font-size:8.6pt;
  line-height:1.5;
  font-weight:700;
  background:#fff;
}

.doc-table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  margin-top:2mm;
}

.doc-table th,
.doc-table td{
  border:1px solid #000;
  padding:4px 5px;
  font-size:8.3pt;
  line-height:1.3;
}

.doc-table th{
  background:#4472C4;
  color:#fff;
  font-weight:700;
}

.doc-table .sr{
  width:12mm;
  text-align:center;
}

.doc-table .att{
  width:30mm;
  text-align:center;
}

.office-table{
  width:100%;
  border-collapse:collapse;
  margin-top:2mm;
}

.office-table td{
  border:1px solid #000;
  padding:4px 5px;
  font-size:8.3pt;
}

.office-table .num{
  width:12mm;
  text-align:center;
}

.office-table .lbl{
  width:55mm;
}

.office-table .val{
  height:24px;
}

/* ✅ UAN value cell — monospace, slightly bolder */
.office-table .uan-val{
  font-family:monospace;
  font-weight:600;
  font-size:8.5pt;
}

.page-footer{
  position:absolute;
  right:11mm;
  bottom:5mm;
  font-size:7pt;
  color:#666;
}

@page{
  size:A4;
  margin:0;
}

@media print{
  body{
    margin:0;
    padding:0;
  }
}
`;

// ── Build verification header ─────────────────────────────────────────────────
const verHeader = `
  <table class="ver-header">
    <colgroup>
      <col style="width:144mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    <tr>
      <td class="ver-spacer"></td>
      <td colspan="2" class="ver-group">Verification Status</td>
    </tr>
    <tr>
      <td class="ver-spacer"></td>
      <td class="ver-sub">Verified<br>Yes / No</td>
      <td class="ver-sub">Referred<br>Document Name</td>
    </tr>
  </table>`;

// ── Build full KYE HTML ────────────────────────────────────────────────────────
function buildKYEHtml(employee, employeeId, logoDataUri) {
  const e    = employee || {};
  const docs = Array.isArray(e.documents) ? e.documents : [];

  const fullName = [e.first_name, e.middle_name, e.last_name]
    .map(s => (s || '').trim()).filter(Boolean).join(' ') || e.employee_name || '';

  // ── Resolve UAN from both possible field names ─────────────────────────────
  const uanDisplay = resolveUan(e);

  const photoDoc     = docs.find(d => ['idPhoto', 'photo'].includes(d.type || d.document_type));
  const rawPhotoPath = photoDoc?.path || photoDoc?.file_path || null;
  const photoDataUri = resolvePhotoDataUri(rawPhotoPath);
  const photoContent = photoDataUri
    ? `<img src="${photoDataUri}" alt="Employee Photo" />`
    : `<div class="photo-placeholder">Employee Passport<br>Size Photograph<br>(45cm &times; 35cm)</div>`;

  const logoElement = logoDataUri
    ? `<img src="${logoDataUri}" class="logo-img" alt="Insta ICT Solutions" />`
    : `<div class="logo-placeholder">Insta ICT Solutions</div>`;

  const pageHeader = `
    <div class="page-top-row">
      <div class="revision-label">KYE Form Revision - 1</div>
      ${logoElement}
    </div>`;

  const hindiText = `मैं\u00a0<span class="name-blank-sm">&nbsp;</span>, एतद्द्वारा घोषणा करता/करती हूं कि ऊपर दी गई जानकारी मेरे सर्वोत्तम ज्ञान और विश्वास के अनुसार सत्य, पूर्ण और सही है। मैं समझता/समझती हूं कि किसी भी स्तर पर मेरी जानकारी के गलत या गलत पाए जाने की स्थिति में, मेरी उम्मीदवारी/नियुक्ति बिना किसी सूचना के रद्द/समाप्त की जा सकती है या उसके बदले में कोई कटौती की जा सकती है। ली गई जानकारी विशुद्ध रूप से रोजगार सत्यापन प्रक्रिया के लिए है और मैंने रोजगार संबंधी गतिविधि के लिए इसके सत्यापन के लिए इंस्टा आईसीटी प्राइवेट लिमिटेड को अपनी सहमति दी है।`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>KYE Form &ndash; ${val(fullName)}</title>
  <style>${CSS}</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════
     PAGE 1 — Personal Details + Family Details
     ═══════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader}

  <div class="form-title-box">
    <div class="title-line1">General Information Form for</div>
    <div class="title-line2">KYE</div>
  </div>

  <div class="photo-wrap">
    <div class="photo-box">${photoContent}</div>
  </div>

  <div class="sec-heading">1. Employee Personal Details &ndash;</div>
  ${verHeader}
  <table class="data-table">
    <colgroup>
      <col style="width:62mm;">
      <col style="width:82mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    ${row('Employee Name:',                        fullName)}
    ${row('Date of birth (DD-MMM-YYYY)',           fmt(e.date_of_birth))}
    ${row('Educational qualification',             e.educational_qualification)}
    ${row('Name of Father/Husband',                e.father_husband_name)}
    ${row('Marital Status (Married/Unmarried)',    e.marital_status)}
    ${row('Employee Blood Group',                  e.blood_group)}
    ${row('Email ID',                              e.email)}
    ${row('Mobile / Phone Number',                 e.phone || e.mobile)}
    ${row('PAN Number',                            e.pan_number)}
    ${row('Name on PAN',                           e.name_on_pan)}
    ${row('Aadhaar No',                            e.aadhar_number)}
    ${row('Name on Aadhaar Card',                  e.name_on_aadhar)}
    ${row('UAN Number',                            uanDisplay)}
  </table>

  <div class="sec-heading">2. Employee Family Details &ndash;</div>
  ${verHeader}
  <table class="data-table">
    <colgroup>
      <col style="width:62mm;">
      <col style="width:82mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    ${row('Father/Mother /Spouse Name',                     e.family_member_name)}
    ${row('Father/Mother / Spouse contact number',          e.family_contact_no)}
    ${row('Father/Mother / Spouse working status',          e.family_working_status)}
    ${row('Father/Mother / Spouse Employer name',           e.family_employer_name)}
    ${row('Father/Spouse / Mother Employer contact number', e.family_employer_contact)}
  </table>

  <div class="page-footer">Page 1 of 4</div>
</div>


<!-- ═══════════════════════════════════════════════════════════════════
     PAGE 2 — Emergency Contact + Bank Details + Address Details
     ═══════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader}

  <div class="sec-heading">3. Employee Emergency Contact Details &ndash;</div>
  ${verHeader}
  <table class="data-table">
    <colgroup>
      <col style="width:62mm;">
      <col style="width:82mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    ${row('Emergency Contact Person Name',                   e.emergency_contact_name)}
    ${row('Emergency Contact Person No',                     e.emergency_contact_no)}
    ${rowTall('Emergency Contact Person Address',            e.emergency_contact_address, '20mm')}
    ${row('Emergency Contact Person Relation with Employee', e.emergency_contact_relation)}
  </table>

  <div class="sec-heading">4. Employee Bank account Details &ndash;</div>
  ${verHeader}
  <table class="data-table">
    <colgroup>
      <col style="width:62mm;">
      <col style="width:82mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    ${row('Name of Bank',           e.bank_name)}
    ${row('Bank A/c No',            e.account_number)}
    ${row('IFSC Code',              e.ifsc_code)}
    ${row('Name on bank passbook',  e.account_holder_name)}
    ${row('Address of the Bank',    e.bank_branch)}
  </table>

  <div class="sec-heading">5. Employee Address Details &ndash;</div>
  ${verHeader}

  <div class="addr-sub">A) Permanent Address</div>
  <table class="data-table">
    <colgroup>
      <col style="width:62mm;">
      <col style="width:82mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    ${rowTall('Permanent Address', e.permanent_address, '20mm')}
    ${row('Phone/Mobile No',                 e.permanent_phone)}
    ${row('Permanent Address Land mark',     e.permanent_landmark)}
    ${row('Permanent Address Lat-long',      e.permanent_lat_long)}
  </table>

  <div class="addr-sub">B) Local Address</div>
  <table class="data-table">
    <colgroup>
      <col style="width:62mm;">
      <col style="width:82mm;">
      <col style="width:22mm;">
      <col style="width:22mm;">
    </colgroup>
    <tr>
      <td class="label" style="vertical-align:top;padding-top:4px;">Local Address</td>
      <td class="value" style="height:20mm;vertical-align:top;padding-top:4px;">
        ${e.local_same_as_permanent ? 'Same as Permanent Address' : val(e.local_address)}
      </td>
      <td class="check"></td>
      <td class="check"></td>
    </tr>
    ${row('Phone/Mobile No',         e.local_same_as_permanent ? e.permanent_phone    : e.local_phone)}
    ${row('Local Address Landmark',  e.local_same_as_permanent ? e.permanent_landmark : e.local_landmark)}
    ${row('Local Address Lat-long',  e.local_same_as_permanent ? e.permanent_lat_long : e.local_lat_long)}
  </table>

  <div class="page-footer">Page 2 of 4</div>
</div>


<!-- ═══════════════════════════════════════════════════════════════════
     PAGE 3 — Reference Details + Declaration
     ═══════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader}

  <div class="sec-heading">6. Reference Details &ndash;</div>
  <table class="ref-table">
    <thead>
      <tr>
        <th class="ref-lbl-hdr" style="width:55mm;">Personal References</th>
        <th style="width:31mm;">
          Reference 1<br>
          <span style="font-weight:400;font-size:7.5pt;">(Relevant Industry)</span>
        </th>
        <th style="width:31mm;">
          Reference 2<br>
          <span style="font-weight:400;font-size:7.5pt;">(Local Area)</span>
        </th>
        <th style="width:31mm;">
          Reference 3<br>
          <span style="font-weight:400;font-size:7.5pt;">(Other than relative)</span>
        </th>
      </tr>
    </thead>
    <tbody>
      ${buildRefRows(e)}
    </tbody>
  </table>

  <div class="sec-heading">7. DECLARATION &ndash;</div>
  <div style="margin:2.5mm 0 4mm 0;">

    <div class="decl-eng">
      I<span class="name-blank">&nbsp;</span>, Hereby declare that the information furnished
      above is true, complete and correct to the best of my knowledge and belief. I understand
      that in the event of my information being found false or incorrect at any stage, my
      candidature / appointment shall be liable to cancellation / termination without notice or
      any compensation in lieu thereof. Information taken is purely for employment verification
      process and I have given my consent to Insta ICT Pvt Ltd for verification of it for
      employment related activity.
    </div>

    <div class="decl-hindi">
      <div class="decl-hindi-title">घोषणा &ndash;</div>
      ${hindiText}
    </div>
  </div>

  <div class="sig-area">
    <div class="sig-left">
      <div>Date &nbsp;&nbsp;: &nbsp;<span style="display:inline-block;min-width:55mm;border-bottom:1px solid #000;">&nbsp;</span></div>
      <div>Place &nbsp;: &nbsp;<span style="display:inline-block;min-width:55mm;border-bottom:1px solid #000;">&nbsp;</span></div>
    </div>
    <div class="sig-right">
      <div class="sig-title">Employee Signature</div>
      <div class="sig-line">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
    </div>
  </div>

  <div class="note-box">
    &#9888;&nbsp; NOTE: Digitally filled KYE form is <u>not acceptable</u>.
    The KYE form <strong>must be handwritten</strong> by the respective employee
    and submitted physically to the HR office.
  </div>

  <div class="page-footer">Page 3 of 4</div>
</div>


<!-- ═══════════════════════════════════════════════════════════════════
     PAGE 4 — Documents Checklist + For Office Use Only
     ═══════════════════════════════════════════════════════════════════ -->
<div class="page">
  ${pageHeader}

  <div class="sec-heading" style="margin-top:4mm;">
    8. Please attach the below-listed documents with the KYE form. &ndash;
  </div>
  <table class="doc-table">
    <thead>
      <tr>
        <th style="width:13mm;">Sr. No.</th>
        <th style="text-align:left;">Name of Document</th>
        <th style="width:34mm;">Attached (Yes / No)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sr">1</td>
        <td>Resume &mdash; Signed copy</td>
        <td class="att">${docAttached(docs, 'resume')}</td>
      </tr>
      <tr>
        <td class="sr">2</td>
        <td>2 passport size photographs &mdash; Name should be written on backside</td>
        <td class="att">${docAttached(docs, 'idPhoto', 'photo')}</td>
      </tr>
      <tr>
        <td class="sr">3</td>
        <td>Medical Certificate &mdash; Latest</td>
        <td class="att">${docAttached(docs, 'medicalCertificate')}</td>
      </tr>
      <tr>
        <td class="sr">4</td>
        <td>Aadhaar Card</td>
        <td class="att">${docAttached(docs, 'aadharCard')}</td>
      </tr>
      <tr>
        <td class="sr">5</td>
        <td>Pan Card</td>
        <td class="att">${docAttached(docs, 'panCard')}</td>
      </tr>
      <tr>
        <td class="sr">6</td>
        <td>Academic records (SSC, ITI, HSC, Diploma, Degree Certificates Copy)</td>
        <td class="att">${docAttached(docs, 'academicRecords')}</td>
      </tr>
      <tr>
        <td class="sr">7</td>
        <td>Bank Details</td>
        <td class="att">${docAttached(docs, 'bankPassbook')}</td>
      </tr>
      <tr>
        <td class="sr">8</td>
        <td>Pay slip or bank statement reflecting last drawn salary</td>
        <td class="att">${docAttached(docs, 'payslip')}</td>
      </tr>
      <tr>
        <td class="sr">9</td>
        <td>Other certificates, if any</td>
        <td class="att">${docAttached(docs, 'otherCertificates')}</td>
      </tr>
    </tbody>
  </table>

  <div class="sec-heading" style="margin-top:6mm;">9. For office Use only.</div>
  <table class="office-table">
    <tr>
      <td class="num">1</td>
      <td class="lbl">DOJ</td>
      <td class="val"></td>
    </tr>
    <tr>
      <td class="num">2</td>
      <td class="lbl">Experience</td>
      <td class="val"></td>
    </tr>
    <!-- ✅ UAN row: populated with actual value from employee record -->
    <tr>
      <td class="num">3</td>
      <td class="lbl">UAN</td>
      <td class="${uanDisplay ? 'uan-val' : 'val'}">${uanDisplay}</td>
    </tr>
    <tr>
      <td class="num">4</td>
      <td class="lbl">Member ID</td>
      <td class="val"></td>
    </tr>
    <tr>
      <td class="num">5</td>
      <td class="lbl">Remarks</td>
      <td class="val" style="height:45px;"></td>
    </tr>
  </table>

  <div class="page-footer">Page 4 of 4</div>
</div>

</body>
</html>`;
}

// ── Main export ────────────────────────────────────────────────────────────────
/**
 * Generates the KYE form as a PDF Buffer.
 * Returns null (never throws) so callers can always fall back gracefully.
 *
 * @param {object} employee   - Full employee row (with documents array)
 * @param {string} employeeId - e.g. "Insta-26041016"
 * @returns {Promise<Buffer|null>}
 */
export async function generateKYEPdfBuffer(employee, employeeId) {
  console.log(`\n📄 [KYE PDF] Starting generation for Employee ID: ${employeeId}`);

  const logoDataUri = resolveLogoDataUri();
  const html        = buildKYEHtml(employee, employeeId, logoDataUri);
  let   browser     = null;

  try {
    console.log('🌐 [KYE PDF] Launching Puppeteer...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--font-render-hinting=none',
      ],
      timeout: 45_000,
    });

    console.log('✅ [KYE PDF] Browser launched. Opening page...');
    const page = await browser.newPage();
    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 2,
    });

    console.log('✅ [KYE PDF] Setting HTML content...');
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

    // Allow Devanagari fonts and layout to fully settle
    await new Promise(r => setTimeout(r, 1500));

    console.log('✅ [KYE PDF] Generating PDF bytes...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    const buf = Buffer.from(pdfBuffer);
    console.log(`✅ [KYE PDF] Success — ${Math.round(buf.length / 1024)} KB generated for ${employeeId}`);
    return buf;

  } catch (err) {
    console.error(`❌ [KYE PDF] GENERATION FAILED for ${employeeId}:`);
    console.error(`   Error name   : ${err.name}`);
    console.error(`   Error message: ${err.message}`);
    console.error(`   Stack        :`, err.stack);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      console.log('🔒 [KYE PDF] Browser closed.');
    }
  }
}