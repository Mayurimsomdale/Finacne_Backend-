
// src/Ui/EmployeeMng/PendingApprovals.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, Eye, Loader, AlertCircle, RefreshCw,
  User, Mail, Phone, Building2, Calendar, FileText, Clock, Users,
  Briefcase, MapPin, CreditCard, Home, Shield, UserCircle, Building, FileCheck,
  Award, DollarSign, ChevronUp, ChevronDown, ExternalLink, Download, ZoomIn
} from 'lucide-react';
import employeeService from '../../services/employeeService';

const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace('/api', '')) || 'http://localhost:5000';

// ─── Utilities ────────────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};
const formatDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const formatDateShort = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ firstName, lastName, size = 'md' }) => {
  const initials = `${(firstName?.[0] || 'N').toUpperCase()}${(lastName?.[0] || 'A').toUpperCase()}`;
  const sizes = {
    sm: 'w-9 h-9 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-20 h-20 text-2xl',
  };
  return (
    <div
      className={`${sizes[size]} rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0`}
      style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 60%, #60a5fa 100%)', boxShadow: '0 4px 14px rgba(59,130,246,0.4)' }}
    >
      {initials}
    </div>
  );
};

// ─── Document Viewer Modal ────────────────────────────────────────────────────
const DocViewer = ({ url, title, onClose }) => {
  const fullUrl = `${BASE_URL}${url}`;
  const isPdf = url?.toLowerCase().endsWith('.pdf');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(90deg,#1e3a5f 0%,#1d4ed8 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">{title}</h3>
              <p className="text-blue-200 text-xs mt-0.5">Review document carefully before approval</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-medium transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in Tab
            </a>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-900 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-all"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {isPdf ? (
            <iframe src={fullUrl} className="w-full rounded-xl shadow-lg bg-white" style={{ minHeight: '72vh' }} title={title} />
          ) : (
            <div className="flex items-center justify-center min-h-[65vh]">
              <img src={fullUrl} alt={title} className="max-w-full max-h-[68vh] rounded-xl shadow-xl object-contain border border-gray-200" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Full Form Viewer Modal ───────────────────────────────────────────────────
const FullFormViewer = ({ employee, onClose }) => {
  const [docViewer, setDocViewer] = useState(null);

  const f = (label, value, span = false) =>
    `<div class="field${span ? ' span2' : ''}"><label>${label}</label><p${!value ? ' class="empty"' : ''}>${value || 'Not provided'}</p></div>`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Employee Registration Form – ${employee.first_name} ${employee.last_name}</title>
          <meta charset="utf-8" />
          <style>
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; font-size: 12px; padding: 24px; }
            h1 { font-size: 20px; font-weight: 700; color: #1e3a5f; margin-bottom: 4px; }
            .subtitle { color: #555; font-size: 12px; margin-bottom: 20px; }
            .header-banner { background: linear-gradient(90deg,#1e3a5f,#1d4ed8); color: #fff; border-radius: 10px; padding: 18px 22px; margin-bottom: 22px; display: flex; align-items: center; gap: 16px; }
            .avatar { width: 54px; height: 54px; border-radius: 10px; background: linear-gradient(135deg,#60a5fa,#3b82f6); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #fff; flex-shrink: 0; }
            .header-name { font-size: 18px; font-weight: 700; }
            .header-sub { font-size: 12px; color: #bfdbfe; margin-top: 3px; }
            .badge { display: inline-block; background: rgba(251,191,36,0.25); border: 1px solid rgba(251,191,36,0.5); color: #fcd34d; border-radius: 20px; padding: 2px 10px; font-size: 11px; margin-top: 6px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; break-inside: avoid; }
            .section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #1e3a5f; border-bottom: 1px solid #f3f4f6; padding-bottom: 10px; margin-bottom: 12px; }
            .section-num { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#1d4ed8,#3b82f6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
            .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .field { margin-bottom: 0; }
            .field.span2 { grid-column: span 2; }
            .field label { display: block; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 3px; }
            .field p { font-size: 12px; color: #111; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; min-height: 30px; word-break: break-word; }
            .field p.empty { color: #9ca3af; font-style: italic; }
            .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6; }
            .doc-card { border: 1px solid; border-radius: 8px; padding: 8px 12px; }
            .doc-card.uploaded { border-color: #bfdbfe; background: #eff6ff; }
            .doc-card.missing { border-color: #e5e7eb; background: #f9fafb; }
            .doc-name { font-size: 11px; font-weight: 600; color: #1e40af; }
            .doc-status { font-size: 10px; }
            .doc-status.ok { color: #16a34a; }
            .doc-status.no { color: #9ca3af; }
            .declaration { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; padding: 16px; margin-top: 16px; break-inside: avoid; }
            .declaration h4 { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 8px; }
            .declaration p { font-size: 11px; color: #374151; line-height: 1.6; }
            .declaration-footer { display: flex; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid #bfdbfe; }
            .declaration-footer .label { font-size: 10px; color: #6b7280; }
            .declaration-footer .value { font-size: 12px; font-weight: 600; color: #111; }
            .print-footer { text-align: center; color: #9ca3af; font-size: 10px; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
            @page { size: A4; margin: 15mm; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Employee Registration Form</h1>
          <p class="subtitle">Generated on ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Confidential – For HR Use Only</p>
          <div class="header-banner">
            <div class="avatar">${(employee.first_name?.[0]||'N').toUpperCase()}${(employee.last_name?.[0]||'A').toUpperCase()}</div>
            <div>
              <div class="header-name">${employee.first_name||''} ${employee.middle_name ? employee.middle_name+' ' : ''}${employee.last_name||''}</div>
              <div class="header-sub">${employee.position||'Position not specified'} &bull; ${employee.department||'Department not specified'}</div>
              <div class="badge">Applied: ${formatDateTime(employee.created_at)}</div>
            </div>
          </div>
          <div class="grid">
            <div>
              <div class="section">
                <div class="section-title"><div class="section-num">1</div> Personal Information</div>
                <div class="fields">
                  ${f('First Name', employee.first_name)}${f('Middle Name', employee.middle_name)}
                  ${f('Last Name', employee.last_name)}${f('Date of Birth', formatDate(employee.date_of_birth))}
                  ${f('Gender', employee.gender)}${f('Blood Group', employee.blood_group)}
                  ${f('Marital Status', employee.marital_status)}${f('Nationality', employee.nationality)}
                  ${f("Father's Name", employee.father_name)}${f("Mother's Name", employee.mother_name)}
                </div>
              </div>
              <div class="section">
                <div class="section-title"><div class="section-num">2</div> Contact Information</div>
                <div class="fields">
                  ${f('Email Address', employee.email, true)}
                  ${f('Primary Phone', employee.phone)}${f('Alternate Phone', employee.alternate_phone)}
                  ${f('Emergency Contact', employee.emergency_contact)}${f('Emergency Contact Name', employee.emergency_contact_name)}
                  ${f('Relationship', employee.emergency_contact_relationship, true)}
                </div>
              </div>
              <div class="section">
                <div class="section-title"><div class="section-num">3</div> Address Details</div>
                <div class="fields">
                  ${f('Current Address', employee.current_address, true)}
                  ${f('City', employee.city)}${f('State', employee.state)}
                  ${f('PIN Code', employee.pin_code)}${f('Country', employee.country)}
                  ${f('Permanent Address', employee.permanent_address, true)}
                </div>
              </div>
              <div class="section">
                <div class="section-title"><div class="section-num">4</div> Employment Details</div>
                <div class="fields">
                  ${f('Department', employee.department)}${f('Position', employee.position)}
                  ${f('Employment Type', employee.employment_type)}${f('Joining Date', formatDate(employee.joining_date))}
                  ${f('Salary', employee.salary ? '₹'+Number(employee.salary).toLocaleString('en-IN') : null)}${f('Reporting Manager', employee.reporting_manager)}
                  ${f('Work Location', employee.work_location)}${f('Shift Timing', employee.shift_timing)}
                </div>
              </div>
            </div>
            <div>
              <div class="section">
                <div class="section-title"><div class="section-num">5</div> Education & Qualifications</div>
                <div class="fields">
                  ${f('Highest Qualification', employee.qualification)}${f('Institution', employee.institution)}
                  ${f('Year of Passing', employee.year_of_passing)}${f('Specialization', employee.specialization)}
                  ${f('Percentage / CGPA', employee.percentage)}${f('Certifications', employee.certifications, true)}
                </div>
              </div>
              <div class="section">
                <div class="section-title"><div class="section-num">6</div> Professional Experience</div>
                <div class="fields">
                  ${f('Previous Company', employee.previous_company)}${f('Previous Designation', employee.previous_designation)}
                  ${f('Years of Experience', employee.years_of_experience)}${f('Notice Period', employee.notice_period)}
                  ${f('Skills', employee.skills, true)}
                </div>
              </div>
              <div class="section">
                <div class="section-title"><div class="section-num">7</div> Bank Account Details</div>
                <div class="fields">
                  ${f('Bank Name', employee.bank_name)}${f('Account Holder', employee.account_holder_name)}
                  ${f('Account Number', employee.account_number)}${f('IFSC Code', employee.ifsc_code)}
                  ${f('Branch', employee.branch)}${f('Account Type', employee.account_type)}
                </div>
              </div>
              <div class="section">
                <div class="section-title"><div class="section-num">8</div> Identity & Documents</div>
                <div class="fields">
                  ${f('Aadhar Number', employee.aadhar_number)}${f('PAN Number', employee.pan_number)}
                  ${f('Passport Number', employee.passport_number)}${f('Driving License', employee.driving_license)}
                  ${f('Voter ID', employee.voter_id)}${f('UAN Number', employee.uan_number)}
                  ${f('ESI Number', employee.esi_number)}${f('PF Number', employee.pf_number)}
                </div>
                <div class="doc-grid">
                  ${[
                    { key: 'idPhoto_url', label: 'ID Photo' },
                    { key: 'aadharCard_url', label: 'Aadhar Card' },
                    { key: 'panCard_url', label: 'PAN Card' },
                    { key: 'bankPassbook_url', label: 'Bank Passbook' },
                  ].map(doc => `
                    <div class="doc-card ${employee[doc.key] ? 'uploaded' : 'missing'}">
                      <div class="doc-name">${doc.label}</div>
                      <div class="doc-status ${employee[doc.key] ? 'ok' : 'no'}">${employee[doc.key] ? '✓ Uploaded' : '✗ Not uploaded'}</div>
                    </div>`).join('')}
                </div>
              </div>
              ${(employee.notes || employee.references || employee.hobbies) ? `
              <div class="section">
                <div class="section-title"><div class="section-num">9</div> Additional Information</div>
                <div class="fields">
                  ${f('Notes', employee.notes, true)}
                  ${f('References', employee.references, true)}
                  ${f('Hobbies', employee.hobbies, true)}
                </div>
              </div>` : ''}
            </div>
          </div>
          <div class="declaration">
            <h4>Declaration</h4>
            <p>I hereby declare that all the information provided above is true and correct to the best of my knowledge. I understand that any false information may result in the rejection of my application or termination of employment.</p>
            <div class="declaration-footer">
              <div><div class="label">Applicant Name</div><div class="value">${employee.first_name||''} ${employee.middle_name ? employee.middle_name+' ' : ''}${employee.last_name||''}</div></div>
              <div style="text-align:right"><div class="label">Submission Date</div><div class="value">${formatDate(employee.created_at)}</div></div>
            </div>
          </div>
          <div class="print-footer">This document is auto-generated and is confidential. Unauthorized distribution is prohibited.</div>
          <script>window.onload = function(){ window.print(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const docs = [
    { key: 'idPhoto_url', label: 'ID Photo', icon: <UserCircle className="w-4 h-4" /> },
    { key: 'aadharCard_url', label: 'Aadhar Card', icon: <CreditCard className="w-4 h-4" /> },
    { key: 'panCard_url', label: 'PAN Card', icon: <FileCheck className="w-4 h-4" /> },
    { key: 'bankPassbook_url', label: 'Bank Passbook', icon: <Building className="w-4 h-4" /> },
  ];

  const SectionTitle = ({ num, title, icon }) => (
    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}>
        {num}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
      </div>
    </div>
  );

  const Field = ({ label, value, span = 1 }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 min-h-[36px]">
        {value || <span className="text-gray-400 italic text-xs">Not provided</span>}
      </p>
    </div>
  );

  return (
    <>
      {docViewer && (
        <DocViewer url={docViewer.url} title={docViewer.label} onClose={() => setDocViewer(null)} />
      )}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl my-4 flex flex-col" style={{ maxHeight: '95vh' }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0"
            style={{ background: 'linear-gradient(90deg,#1e3a5f 0%,#1d4ed8 100%)', borderRadius: '16px 16px 0 0' }}>
            <div className="flex items-center gap-4">
              <Avatar firstName={employee.first_name} lastName={employee.last_name} size="lg" />
              <div>
                <h2 className="text-xl font-bold text-white">
                  {employee.first_name} {employee.middle_name ? employee.middle_name + ' ' : ''}{employee.last_name}
                </h2>
                <p className="text-blue-200 text-sm mt-0.5">
                  {employee.position || 'Position not specified'} &bull; {employee.department || 'Department not specified'}
                </p>
                <p className="text-blue-300 text-xs mt-1.5">Applied: {formatDateTime(employee.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition-all border border-white/20">
                <FileText className="w-3.5 h-3.5" /> Print
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-white text-blue-900 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-all">
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="1" title="Personal Information" icon={<User className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" value={employee.first_name} />
                    <Field label="Middle Name" value={employee.middle_name} />
                    <Field label="Last Name" value={employee.last_name} />
                    <Field label="Date of Birth" value={formatDate(employee.date_of_birth)} />
                    <Field label="Gender" value={employee.gender} />
                    <Field label="Blood Group" value={employee.blood_group} />
                    <Field label="Marital Status" value={employee.marital_status} />
                    <Field label="Nationality" value={employee.nationality} />
                    <Field label="Father's Name" value={employee.father_name} />
                    <Field label="Mother's Name" value={employee.mother_name} />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="2" title="Contact Information" icon={<Mail className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Email Address" value={employee.email} span={2} />
                    <Field label="Primary Phone" value={employee.phone} />
                    <Field label="Alternate Phone" value={employee.alternate_phone} />
                    <Field label="Emergency Contact" value={employee.emergency_contact} />
                    <Field label="Emergency Contact Name" value={employee.emergency_contact_name} />
                    <Field label="Relationship" value={employee.emergency_contact_relationship} span={2} />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="3" title="Address Details" icon={<MapPin className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Current Address" value={employee.current_address} span={2} />
                    <Field label="City" value={employee.city} />
                    <Field label="State" value={employee.state} />
                    <Field label="PIN Code" value={employee.pin_code} />
                    <Field label="Country" value={employee.country} />
                    <Field label="Permanent Address" value={employee.permanent_address} span={2} />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="4" title="Employment Details" icon={<Briefcase className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Department" value={employee.department} />
                    <Field label="Position" value={employee.position} />
                    <Field label="Employment Type" value={employee.employment_type} />
                    <Field label="Joining Date" value={formatDate(employee.joining_date)} />
                    <Field label="Salary" value={employee.salary ? `₹${Number(employee.salary).toLocaleString('en-IN')}` : null} />
                    <Field label="Reporting Manager" value={employee.reporting_manager} />
                    <Field label="Work Location" value={employee.work_location} />
                    <Field label="Shift Timing" value={employee.shift_timing} />
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="5" title="Education & Qualifications" icon={<Award className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Highest Qualification" value={employee.qualification} />
                    <Field label="Institution" value={employee.institution} />
                    <Field label="Year of Passing" value={employee.year_of_passing} />
                    <Field label="Specialization" value={employee.specialization} />
                    <Field label="Percentage / CGPA" value={employee.percentage} />
                    <Field label="Certifications" value={employee.certifications} span={2} />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="6" title="Professional Experience" icon={<Briefcase className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Previous Company" value={employee.previous_company} />
                    <Field label="Previous Designation" value={employee.previous_designation} />
                    <Field label="Years of Experience" value={employee.years_of_experience} />
                    <Field label="Notice Period" value={employee.notice_period} />
                    <Field label="Skills" value={employee.skills} span={2} />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="7" title="Bank Account Details" icon={<CreditCard className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bank Name" value={employee.bank_name} />
                    <Field label="Account Holder" value={employee.account_holder_name} />
                    <Field label="Account Number" value={employee.account_number} />
                    <Field label="IFSC Code" value={employee.ifsc_code} />
                    <Field label="Branch" value={employee.branch} />
                    <Field label="Account Type" value={employee.account_type} />
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <SectionTitle num="8" title="Identity & Documents" icon={<Shield className="w-4 h-4" />} />
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <Field label="Aadhar Number" value={employee.aadhar_number} />
                    <Field label="PAN Number" value={employee.pan_number} />
                    <Field label="Passport Number" value={employee.passport_number} />
                    <Field label="Driving License" value={employee.driving_license} />
                    <Field label="Voter ID" value={employee.voter_id} />
                    <Field label="UAN Number" value={employee.uan_number} />
                    <Field label="ESI Number" value={employee.esi_number} />
                    <Field label="PF Number" value={employee.pf_number} />
                  </div>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Uploaded Documents
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {docs.map(doc => {
                        const uploaded = !!employee[doc.key];
                        return (
                          <div
                            key={doc.key}
                            className={`rounded-xl border p-3 transition-all ${
                              uploaded
                                ? 'border-blue-200 bg-blue-50/60 hover:border-blue-400 hover:shadow-md'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${uploaded ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                                  {doc.icon}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">{doc.label}</p>
                                  <p className={`text-xs ${uploaded ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                                    {uploaded ? '✓ Uploaded' : 'Not uploaded'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {uploaded && (
                              <button
                                onClick={() => setDocViewer({ url: employee[doc.key], label: doc.label })}
                                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 hover:shadow-md"
                                style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                View Document
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {(employee.notes || employee.references || employee.hobbies) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <SectionTitle num="9" title="Additional Information" icon={<FileText className="w-4 h-4" />} />
                    <div className="grid grid-cols-1 gap-3">
                      <Field label="Notes" value={employee.notes} />
                      <Field label="References" value={employee.references} />
                      <Field label="Hobbies" value={employee.hobbies} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Declaration</h4>
              <p className="text-xs text-gray-600 leading-relaxed mb-4">
                I hereby declare that all the information provided above is true and correct to the best of my knowledge.
                I understand that any false information may result in the rejection of my application or termination of employment.
              </p>
              <div className="flex items-end justify-between border-t border-blue-200 pt-3">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Applicant Name</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {employee.first_name} {employee.middle_name ? employee.middle_name + ' ' : ''}{employee.last_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Submission Date</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(employee.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Reject Modal ─────────────────────────────────────────────────────────────
const RejectModal = ({ employee, onConfirm, onCancel, loading }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg,#ef4444,#f97316)' }} />
        <div className="p-8">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#fee2e2,#fecaca)' }}>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-1">Reject Registration</h3>
          <p className="text-gray-500 text-sm text-center mb-6">
            Rejecting <strong className="text-gray-900">{employee.first_name} {employee.last_name}</strong>'s registration will permanently remove their data.
          </p>
          <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Reason for Rejection</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Provide a reason (optional but recommended)..."
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-red-400 outline-none text-sm mb-5 resize-none transition-colors"
          />
          <div className="flex gap-3">
            <button onClick={onCancel} disabled={loading} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-all disabled:opacity-50">
              Cancel
            </button>
            <button onClick={() => onConfirm(reason)} disabled={loading} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {loading ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Employee Card ────────────────────────────────────────────────────────────
const EmployeeCard = ({ employee, onApprove, onReject, approving, rejecting }) => {
  const [showFullForm, setShowFullForm] = useState(false);

  return (
    <>
      {showFullForm && (
        <FullFormViewer employee={employee} onClose={() => setShowFullForm(false)} />
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
        {/* Top accent line */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#1d4ed8,#3b82f6,#60a5fa)' }} />

        {/* Card Header */}
        <div className="px-5 pt-4 pb-3.5 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3.5">
              <Avatar firstName={employee.first_name} lastName={employee.last_name} size="md" />
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  {employee.first_name} {employee.middle_name ? employee.middle_name + ' ' : ''}{employee.last_name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                  <Briefcase className="w-3 h-3" />
                  <span>{employee.position || 'Not specified'}</span>
                  <span className="text-gray-300">•</span>
                  <Building2 className="w-3 h-3" />
                  <span>{employee.department || 'Not specified'}</span>
                </div>
              </div>
            </div>

            {/* ── ACTION BUTTONS — compact, right-aligned in header ── */}
            <div className="flex items-center gap-1.5">
              {/* View Form */}
              <button
                onClick={() => setShowFullForm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all duration-150 text-xs font-medium"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>

              {/* Approve */}
              <button
                onClick={onApprove}
                disabled={approving || rejecting}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: approving
                    ? '#15803d'
                    : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                  boxShadow: approving ? 'none' : '0 1px 6px rgba(34,197,94,0.35)',
                }}
              >
                {approving ? (
                  <><Loader className="w-3.5 h-3.5 animate-spin" /><span>Approving…</span></>
                ) : (
                  <><CheckCircle className="w-3.5 h-3.5" /><span>Approve</span></>
                )}
              </button>

              {/* Reject */}
              <button
                onClick={onReject}
                disabled={approving || rejecting}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-all duration-150 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card Body — info only, no action row at bottom */}
        <div className="px-5 py-4">
          {/* Key Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            {[
              { icon: <Mail className="w-3.5 h-3.5 text-blue-500" />, label: 'Email', value: employee.email },
              { icon: <Phone className="w-3.5 h-3.5 text-blue-500" />, label: 'Phone', value: employee.phone },
              { icon: <Calendar className="w-3.5 h-3.5 text-blue-500" />, label: 'Joining Date', value: formatDateShort(employee.joining_date) },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-none mb-0.5">{item.label}</p>
                  <p className="text-xs font-semibold text-gray-800 truncate">{item.value || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Applied + Type */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Applied:</span>
              <span className="font-semibold text-gray-700">{formatDateTime(employee.created_at)}</span>
            </div>
            {employee.employment_type && (
              <span
                className="px-2 py-0.5 text-[11px] font-semibold rounded-full"
                style={{ background: '#dbeafe', color: '#1d4ed8' }}
              >
                {employee.employment_type}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PendingApprovals = ({ showToast, onEmployeeApproved }) => {
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [rejectTarget, setRejectTarget] = useState(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await employeeService.getPendingSubmissions();
      setPendingList(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load pending submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (employee) => {
    setActionLoading(prev => ({ ...prev, [`approve_${employee.id}`]: true }));
    try {
      const res = await employeeService.approveSubmission(employee.id);
      if (res.success) {
        showToast?.(`✅ ${employee.first_name} ${employee.last_name} approved! Employee ID: ${res.data?.employeeId}`, 'success');
        setPendingList(prev => prev.filter(e => e.id !== employee.id));
        onEmployeeApproved?.();
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to approve employee', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`approve_${employee.id}`]: false }));
    }
  };

  const handleRejectConfirm = async (reason) => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setActionLoading(prev => ({ ...prev, [`reject_${id}`]: true }));
    try {
      await employeeService.rejectSubmission(id, reason);
      showToast?.(`❌ Registration from ${rejectTarget.first_name} ${rejectTarget.last_name} has been rejected.`, 'success');
      setPendingList(prev => prev.filter(e => e.id !== id));
      setRejectTarget(null);
    } catch (err) {
      showToast?.(err.message || 'Failed to reject submission', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`reject_${id}`]: false }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}>
          <Loader className="w-8 h-8 text-white animate-spin" />
        </div>
        <p className="text-gray-600 font-medium">Loading pending requests…</p>
        <p className="text-gray-400 text-sm mt-1">Please wait</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      {rejectTarget && (
        <RejectModal
          employee={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={!!actionLoading[`reject_${rejectTarget?.id}`]}
        />
      )}

      {/* Page Header */}
      <div className="mb-7">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)' }}>
                <Users className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
            </div>
            <p className="text-gray-500 text-sm ml-13">
              {pendingList.length > 0
                ? <span><strong className="text-blue-700">{pendingList.length}</strong> {pendingList.length === 1 ? 'request' : 'requests'} awaiting review</span>
                : 'No pending requests at the moment'}
            </p>
          </div>
          <button
            onClick={fetchPending}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Stats Strip */}
        {pendingList.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Pending', value: pendingList.length, color: '#1d4ed8', bg: '#dbeafe' },
              { label: 'Oldest Request', value: pendingList.length > 0 ? formatDateShort(pendingList[pendingList.length - 1]?.created_at) : '—', color: '#d97706', bg: '#fef3c7' },
              { label: 'Latest Request', value: pendingList.length > 0 ? formatDateShort(pendingList[0]?.created_at) : '—', color: '#059669', bg: '#d1fae5' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 mb-1">{stat.label}</p>
                <p className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-medium text-red-700 flex-1">{error}</p>
          <button onClick={fetchPending} className="px-3 py-1.5 bg-white border border-red-300 hover:bg-red-50 rounded-lg text-xs font-semibold text-red-600 transition-all">
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {pendingList.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' }}>
            <CheckCircle className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            There are no pending approval requests at the moment. New submissions will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingList.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              onApprove={() => handleApprove(emp)}
              onReject={() => setRejectTarget(emp)}
              approving={!!actionLoading[`approve_${emp.id}`]}
              rejecting={!!actionLoading[`reject_${emp.id}`]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;