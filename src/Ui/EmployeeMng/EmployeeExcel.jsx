import React, { useState } from 'react';
import {
  X, Upload, FileSpreadsheet, Download, AlertCircle,
  CheckCircle, Loader, Table2, ChevronDown, ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import employeeService from '../../services/employeeService';

const BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:5000/api';

const ImportExcelModal = ({ onClose, showToast, onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloadingExport, setDownloadingExport] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [showImportedTable, setShowImportedTable] = useState(true);

  // ─────────────────────────────────────────────────────────────
  // AUTO-DETECT HEADER ROW
  // Export file  → 1 header row  → range: 0  (row 0 = "First Name", "Last Name"…)
  // Template file → 2 header rows → range: 1  (row 0 = "Personal Information"…,
  //                                             row 1 = "First Name *", "Last Name *"…)
  // Detection: if first row's first cell looks like a section label → range:1
  // ─────────────────────────────────────────────────────────────
  const detectHeaderRange = (workbook) => {
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];

    // Read first 2 rows raw (array_of_arrays)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rows || rows.length === 0) return 0;

    const firstRowValues = rows[0].map(v => String(v || '').trim().toLowerCase());

    // If first row contains section group labels → 2-row header (template format)
    const sectionLabels = ['personal information', 'employment details', 'salary & bank', 'salary and bank'];
    const isTemplate = firstRowValues.some(v => sectionLabels.includes(v));

    return isTemplate ? 1 : 0;
  };

  // ─────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────
  const validateEmployeeData = (data) => {
    const errors = [];

    const requiredFields = [
      { key: 'firstName',      label: 'First Name' },
      { key: 'lastName',       label: 'Last Name' },
      { key: 'email',          label: 'Email' },
      { key: 'phone',          label: 'Phone' },
      { key: 'dob',            label: 'Date of Birth' },
      { key: 'gender',         label: 'Gender' },
      { key: 'department',     label: 'Department' },
      { key: 'designation',    label: 'Designation' },
      { key: 'joiningDate',    label: 'Joining Date' },
      { key: 'employmentType', label: 'Employment Type' },
      { key: 'bankName',       label: 'Bank Name' },
      { key: 'accountNumber',  label: 'Account Number' },
      { key: 'ifscCode',       label: 'IFSC Code' },
    ];

    data.forEach((row, index) => {
      const rowNum = index + 2;

      requiredFields.forEach(({ key, label }) => {
        if (!row[key] || String(row[key]).trim() === '') {
          errors.push(`Row ${rowNum}: Missing required field — ${label}`);
        }
      });

      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Row ${rowNum}: Invalid email format`);
      }

      if (row.phone && !/^[6-9]\d{9}$/.test(String(row.phone).replace(/\s/g, ''))) {
        errors.push(`Row ${rowNum}: Invalid phone (must be 10 digits starting with 6-9)`);
      }

      if (row.dob) {
        const dob = new Date(row.dob);
        if (!isNaN(dob.getTime())) {
          const age = Math.floor((new Date() - dob) / 31557600000);
          if (age < 18 || age > 100) {
            errors.push(`Row ${rowNum}: Date of Birth invalid (age must be 18–100)`);
          }
        }
      }
    });

    return errors;
  };

  // ─────────────────────────────────────────────────────────────
  // MAP Excel row → backend field names
  // Handles BOTH export format ("First Name") and
  // template format ("First Name *") seamlessly
  // ─────────────────────────────────────────────────────────────
  const processExcelData = (data) =>
    data.map(row => {
      // Helper: try multiple key variants, return first non-empty value
      const g = (keys, fallback = '') => {
        for (const k of keys) {
          const v = row[k];
          if (v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== 'nan') {
            return String(v).trim();
          }
        }
        return fallback;
      };

      return {
        // ── Personal Info ──────────────────────────────────────
        firstName:        g(['First Name *',   'First Name',   'firstName']),
        middleName:       g(['Middle Name',     'middleName']),
        lastName:         g(['Last Name *',     'Last Name',    'lastName']),
        email:            g(['Email *',         'Email',        'email']).toLowerCase(),
        phone:            g(['Phone *',         'Phone',        'phone']).replace(/\D/g, '').slice(-10),
        altPhone:         g(['Alternate Phone', 'altPhone',     'Alt Phone']).replace(/\D/g, ''),
        dob:              g(['Date of Birth *', 'Date of Birth','dob', 'dateOfBirth']),
        gender:           g(['Gender *',        'Gender',       'gender']),
        aadhar:           g(['Aadhar Number *', 'Aadhar Number','aadhar', 'aadhar_number']).replace(/\s/g, ''),
        address:          g(['Address',         'address']),
        city:             g(['City',            'city']),
        state:            g(['State',           'state']),
        zipCode:          g(['Zip Code',        'zipCode',      'pinCode', 'zip_code']),

        // ── Employment Details ─────────────────────────────────
        department:       g(['Department *',    'Department',   'department']),
        designation:      g(['Designation *',   'Designation',  'designation', 'position']),
        joiningDate:      g(['Joining Date *',  'Joining Date', 'joiningDate', 'joining_date']),
        employmentType:   g(['Employment Type *','Employment Type','employmentType','employment_type']),
        circle:           g(['Circle',          'circle']),
        projectName:      g(['Project Name',    'projectName',  'project_name']),
        reportingManager: g(['Reporting Manager','reportingManager','reporting_manager']),

        // ── Salary & Bank ──────────────────────────────────────
        basicSalary:      parseFloat(g(['Basic Salary',     'basicSalary',     'basic_salary'],    '0')) || 0,
        hra:              parseFloat(g(['HRA',              'hra'],            '0')) || 0,
        otherAllowances:  parseFloat(g(['Other Allowances', 'otherAllowances', 'other_allowances'],'0')) || 0,
        bankName:         g(['Bank Name *',     'Bank Name',    'bankName',     'bank_name']),
        branch:           g(['Bank Branch',     'bankBranch',   'branch',       'bank_branch']),
        accountNumber:    g(['Account Number *','Account Number','accountNumber','account_number']),
        ifscCode:         g(['IFSC Code *',     'IFSC Code',    'ifscCode',     'ifsc_code']).toUpperCase(),
        accountHolderName:g(['Account Holder Name','accountHolderName','account_holder_name']),

        status: 'Active',
      };
    });

  // ─────────────────────────────────────────────────────────────
  // PARSE FILE — shared by preview + import
  // ─────────────────────────────────────────────────────────────
  const parseFile = (arrayBuffer) => {
    const data     = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const range    = detectHeaderRange(workbook);          // ← THE KEY FIX
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '', range });

    // Filter out footer rows like "Total Employees: X"
    const filtered = jsonData.filter(row => {
      const firstVal = String(Object.values(row)[0] || '').trim();
      return firstVal !== '' && !firstVal.toLowerCase().startsWith('total employees');
    });

    return { workbook, range, jsonData: filtered };
  };

  // ─────────────────────────────────────────────────────────────
  // FILE CHANGE
  // ─────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      showToast?.('Please upload a valid Excel or CSV file', 'error');
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { jsonData } = parseFile(ev.target.result);
        setPreview(jsonData.slice(0, 5));
      } catch (err) {
        showToast?.('Error reading file', 'error');
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // ─────────────────────────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) { showToast?.('Please select a file', 'error'); return; }

    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const { jsonData } = parseFile(ev.target.result);

        if (jsonData.length === 0) {
          showToast?.('The Excel file is empty or has no data rows', 'error');
          setImporting(false);
          return;
        }

        const processedData = processExcelData(jsonData);
        const errors        = validateEmployeeData(processedData);

        if (errors.length > 0) {
          setValidationErrors(errors);
          setImporting(false);
          return;
        }

        let successCount = 0;
        let errorCount   = 0;
        const importedRows = [];

        for (let i = 0; i < processedData.length; i++) {
          try {
            const empData = { ...processedData[i] };
            empData.totalSalary = (empData.basicSalary || 0) + (empData.hra || 0) + (empData.otherAllowances || 0);
            await employeeService.addEmployee(empData);
            successCount++;
            importedRows.push({ ...empData, _rowNum: i + 2, _status: 'success' });
          } catch (error) {
            errorCount++;
            const msg = error.message || 'Unknown error';
            importedRows.push({ ...processedData[i], _rowNum: i + 2, _status: 'error', _error: msg });
          }
        }

        setImporting(false);
        setImportResult({ successCount, errorCount, importedRows });
        setShowImportedTable(true);

        if (errorCount === 0) {
          showToast?.(`Successfully imported ${successCount} employee${successCount > 1 ? 's' : ''}!`, 'success');
          onImportComplete?.();
        } else {
          showToast?.(`Imported ${successCount} employees. ${errorCount} failed.`, 'error');
        }
      } catch (error) {
        console.error('Import error:', error);
        showToast?.('Error processing file. Please check the format.', 'error');
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ─────────────────────────────────────────────────────────────
  // DOWNLOAD TEMPLATE
  // ─────────────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const res = await fetch(`${BASE_URL}/employees/export/template`);
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'employee_import_template.xlsx';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast?.('Template downloaded!', 'success');
        return;
      }
    } catch (_) {}

    // Fallback: local template (single header row, plain column names)
    const headers = [
      'First Name', 'Middle Name', 'Last Name',
      'Email', 'Phone', 'Alternate Phone',
      'Date of Birth', 'Gender', 'Aadhar Number',
      'Address', 'City', 'State', 'Zip Code',
      'Department', 'Designation', 'Joining Date', 'Employment Type',
      'Circle', 'Project Name', 'Reporting Manager',
      'Basic Salary', 'HRA', 'Other Allowances',
      'Bank Name', 'Bank Branch', 'Account Number', 'IFSC Code', 'Account Holder Name',
    ];
    const sample = [
      'Rahul', 'Suresh', 'Sharma', 'rahul.sharma@example.com', '9876543210', '',
      '1995-06-15', 'Male', '123456789012',
      '45 MG Road', 'Pune', 'Maharashtra', '411001',
      'IT', 'Software Developer', '2024-01-10', 'Full-time',
      'West', 'Project Alpha', 'Amit Joshi',
      45000, 13500, 5000,
      'State Bank of India', 'Pune Main', '1234567890', 'SBIN0001234', 'Rahul Suresh Sharma',
    ];
    const row = {};
    headers.forEach((h, i) => { row[h] = sample[i]; });
    const ws = XLSX.utils.json_to_sheet([row]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Import');
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.writeFile(wb, 'employee_import_template.xlsx');
    showToast?.('Template downloaded!', 'success');
  };

  // ─────────────────────────────────────────────────────────────
  // EXPORT ALL EMPLOYEES
  // ─────────────────────────────────────────────────────────────
  const downloadEmployeesExcel = async () => {
    setDownloadingExport(true);
    try {
      const res = await fetch(`${BASE_URL}/employees/export/data`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `employees_export_${date}.xlsx`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast?.('Employees exported successfully!', 'success');
    } catch {
      showToast?.('Failed to export employee data', 'error');
    } finally {
      setDownloadingExport(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 rounded-xl p-2"><FileSpreadsheet className="w-6 h-6" /></div>
            <div>
              <h3 className="text-xl font-bold">Import Employees from Excel</h3>
              <p className="text-green-100 text-sm mt-0.5">
                Upload the import template <span className="font-semibold">or</span> the exported employees file
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={importing}
            className="p-2 hover:bg-green-700 rounded-lg transition-all disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto flex-1">
          {!importResult && (
            <>
              {/* Upload area */}
              <div className="mb-4">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-500 transition-colors">
                  <input type="file" accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange} disabled={importing}
                    className="hidden" id="excel-upload" />
                  <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="bg-green-100 rounded-full p-4">
                      <Upload className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <p className="text-gray-700 font-medium">
                        {file ? file.name : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Accepts: import template <span className="text-gray-400">·</span> exported employees file <span className="text-gray-400">·</span> CSV
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Template download */}
              <div className="mb-5 flex justify-end">
                <button onClick={downloadTemplate}
                  className="text-sm text-green-700 hover:underline flex items-center gap-1 font-medium">
                  <Download className="w-4 h-4" /> Download Import Template
                </button>
              </div>

              {/* Preview */}
              {preview && preview.length > 0 && (
                <div className="mb-5">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Preview ({preview.length} row{preview.length > 1 ? 's' : ''} detected)
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2">
                    {preview.map((row, idx) => {
                      const processed = processExcelData([row])[0];
                      return (
                        <div key={idx} className="bg-white p-3 rounded border border-gray-200 text-sm flex flex-wrap gap-4">
                          <span className="font-semibold text-gray-500">Row {idx + 2}:</span>
                          <span className="font-medium text-gray-900">{processed.firstName} {processed.lastName}</span>
                          <span className="text-gray-500">{processed.email}</span>
                          {processed.department && (
                            <span className="text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded">{processed.department}</span>
                          )}
                          {processed.designation && (
                            <span className="text-gray-500 text-xs">· {processed.designation}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 rounded-xl p-5 mb-5 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-2">
                        Validation Errors ({validationErrors.length})
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {validationErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-700">• {err}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Field guide */}
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-3 text-sm">Field Guide</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm text-amber-800">
                  <div>
                    <p className="font-semibold text-amber-900 mb-1">Required</p>
                    <p>First Name, Last Name, Email, Phone</p>
                    <p>Date of Birth <span className="text-xs">(age 18–100)</span>, Gender</p>
                    <p>Department, Designation</p>
                    <p>Joining Date, Employment Type</p>
                    <p>Bank Name, Account Number, IFSC Code</p>
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900 mb-1">Optional (saved as empty if blank)</p>
                    <p>Middle Name, Alternate Phone, Aadhar</p>
                    <p>Address, City, State, Zip Code</p>
                    <p>Circle, Project Name, Reporting Manager</p>
                    <p>Basic Salary, HRA, Other Allowances</p>
                    <p>Bank Branch, Account Holder Name</p>
                    <p className="text-xs mt-1 text-amber-700">
                      ✓ Both the exported file and the import template are accepted
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* POST-IMPORT RESULT */}
          {importResult && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-green-100 rounded-full p-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">{importResult.successCount}</p>
                    <p className="text-sm text-green-600 font-medium">Successfully Imported</p>
                  </div>
                </div>
                <div className={`border rounded-xl p-4 flex items-center gap-4 ${
                  importResult.errorCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className={`rounded-full p-3 ${importResult.errorCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                    <AlertCircle className={`w-6 h-6 ${importResult.errorCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${importResult.errorCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {importResult.errorCount}
                    </p>
                    <p className={`text-sm font-medium ${importResult.errorCount > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      Failed
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowImportedTable(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700">
                  <span className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-gray-500" />
                    Imported Data ({importResult.importedRows.length} rows)
                  </span>
                  {showImportedTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showImportedTable && (
                  <div className="overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          {['#','Status','Name','Email','Phone','Dept','Designation','Joining Date','Salary','Note'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importResult.importedRows.map((row, idx) => (
                          <tr key={idx} className={row._status === 'error' ? 'bg-red-50' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-2.5 text-gray-500">{row._rowNum}</td>
                            <td className="px-4 py-2.5">
                              {row._status === 'success'
                                ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />OK</span>
                                : <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium"><AlertCircle className="w-3.5 h-3.5" />Failed</span>}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{row.firstName} {row.lastName}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.email}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.phone}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.department}</td>
                            <td className="px-4 py-2.5 text-gray-600">{row.designation}</td>
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{row.joiningDate}</td>
                            <td className="px-4 py-2.5 text-gray-600">
                              {row.totalSalary ? `₹${Number(row.totalSalary).toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-red-500 text-xs max-w-[160px] truncate" title={row._error || ''}>
                              {row._error || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <button onClick={() => { setFile(null); setPreview(null); setImportResult(null); setValidationErrors([]); }}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Upload className="w-4 h-4" /> Import another file
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={importing}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all disabled:opacity-50">
            {importResult ? 'Close' : 'Cancel'}
          </button>

          {!importResult && (
            <button onClick={handleImport} disabled={!file || importing}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed">
              {importing
                ? <><Loader className="w-4 h-4 animate-spin" />Importing...</>
                : <><Upload className="w-4 h-4" />Import Employees</>}
            </button>
          )}

          {importResult && importResult.successCount > 0 && (
            <button onClick={downloadEmployeesExcel} disabled={downloadingExport}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:opacity-60">
              {downloadingExport ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export All Employees
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExcelModal;