import React, { useState } from "react";
import { X, Save, Loader } from "lucide-react";
import employeeService from "../../services/employeeService";

const EditEmployee = ({ employee, onClose, onSave, showToast }) => {
  if (!employee) return null;

  const [form, setForm] = useState({
    firstName: employee.first_name || employee.firstName || "",
    middleName: employee.middle_name || employee.middleName || "",
    lastName: employee.last_name || employee.lastName || "",
    email: employee.email || "",
    phone: employee.phone || "",
    altPhone: employee.alt_phone || "",
    dob: employee.date_of_birth ? employee.date_of_birth.slice(0, 10) : "",
    gender: employee.gender || "",
    aadhar: employee.aadhar_number || "",
    address: employee.address || "",
    city: employee.city || "",
    state: employee.state || "",
    zipCode: employee.zip_code || "",
    department: employee.department || "",
    designation: employee.designation || employee.position || "",
    employmentType: employee.employment_type || "",
    joiningDate: employee.joining_date
      ? employee.joining_date.slice(0, 10)
      : "",
    circle: employee.circle || "",
    projectName: employee.project_name || "",
    reportingManager: employee.reporting_manager || "",
    basicSalary: employee.basic_salary || "",
    hra: employee.hra || "",
    otherAllowances: employee.other_allowances || "",
    bankName: employee.bank_name || "",
    accountNumber: employee.account_number || "",
    ifscCode: employee.ifsc_code || "",
    accountHolderName: employee.account_holder_name || "",
    bankBranch: employee.bank_branch || employee.branch || "",
    status: employee.status || "Active",
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.email.trim()) e.email = "Email is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    if (!form.department.trim()) e.department = "Department is required";
    if (!form.designation.trim()) e.designation = "Designation is required";
    if (!form.joiningDate) e.joiningDate = "Joining date is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setSaving(true);
    try {
      const id = employee.id || employee.employee_id;
      const payload = {
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        altPhone: form.altPhone,
        dob: form.dob,
        gender: form.gender,
        aadhar: form.aadhar,
        address: form.address,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        department: form.department,
        designation: form.designation,
        employmentType: form.employmentType,
        joiningDate: form.joiningDate,
        circle: form.circle,
        projectName: form.projectName,
        reportingManager: form.reportingManager,
        basicSalary: parseFloat(form.basicSalary) || 0,
        hra: parseFloat(form.hra) || 0,
        otherAllowances: parseFloat(form.otherAllowances) || 0,
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        accountHolderName: form.accountHolderName,
        bankBranch: form.bankBranch,
        status: form.status,
      };

      const response = await employeeService.updateEmployee(id, payload);
      if (response.success) {
        showToast?.("Employee updated successfully!", "success");
        onSave?.(response.data);
        onClose();
      } else {
        throw new Error(response.message || "Failed to update employee");
      }
    } catch (err) {
      showToast?.(err.message || "Failed to update employee", "error");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, type = "text", required, options }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {options ? (
        <select
          name={name}
          value={form[name]}
          onChange={handleChange}
          className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all
            ${
              errors[name]
                ? "border-red-400 bg-red-50"
                : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            }`}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={form[name]}
          onChange={handleChange}
          className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all
            ${
              errors[name]
                ? "border-red-400 bg-red-50"
                : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            }`}
        />
      )}
      {errors[name] && (
        <p className="text-xs text-red-500 mt-1">{errors[name]}</p>
      )}
    </div>
  );

  const SectionTitle = ({ title }) => (
    <div className="col-span-2 mt-4 mb-1 pb-1 border-b border-gray-100">
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
        {title}
      </h3>
    </div>
  );

  return (
    /* ── Overlay: blur + semi-transparent, starts below header ── */
    <div
      className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 flex items-start justify-center p-4 pt-20 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Employee</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {form.firstName} {form.lastName} ·{" "}
              {employee.employee_id || employee.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto max-h-[65vh]">
          <div className="grid grid-cols-2 gap-4">
            <SectionTitle title="Personal Information" />
            <Field label="First Name" name="firstName" required />
            <Field label="Middle Name" name="middleName" />
            <Field label="Last Name" name="lastName" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Phone" name="phone" required />
            <Field label="Alternate Phone" name="altPhone" />
            <Field label="Date of Birth" name="dob" type="date" />
            <Field
              label="Gender"
              name="gender"
              options={["Male", "Female", "Other"]}
            />
            <Field label="Aadhar Number" name="aadhar" />

            <SectionTitle title="Address" />
            <Field label="Address" name="address" />
            <Field label="City" name="city" />
            <Field label="State" name="state" />
            <Field label="Zip Code" name="zipCode" />

            <SectionTitle title="Employment Details" />
            <Field label="Department" name="department" required />
            <Field label="Designation" name="designation" required />
            <Field
              label="Employment Type"
              name="employmentType"
              options={["Full-time", "Part-time", "Contract", "Intern"]}
            />
            <Field
              label="Joining Date"
              name="joiningDate"
              type="date"
              required
            />
            <Field label="Circle" name="circle" />
            <Field label="Project Name" name="projectName" />
            <Field label="Reporting Manager" name="reportingManager" />
            <Field
              label="Status"
              name="status"
              options={["Active", "Inactive", "Pending"]}
            />

            <SectionTitle title="Salary Details" />
            <Field label="Basic Salary" name="basicSalary" type="number" />
            <Field label="HRA" name="hra" type="number" />
            <Field
              label="Other Allowances"
              name="otherAllowances"
              type="number"
            />

            <SectionTitle title="Bank Details" />
            <Field label="Bank Name" name="bankName" />
            <Field label="Account Number" name="accountNumber" />
            <Field label="IFSC Code" name="ifscCode" />
            <Field label="Account Holder Name" name="accountHolderName" />
            <Field label="Bank Branch" name="bankBranch" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditEmployee;
