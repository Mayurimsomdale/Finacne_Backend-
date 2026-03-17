import React from "react";
import {
  X,
  User,
  MapPin,
  Briefcase,
  DollarSign,
  CreditCard,
} from "lucide-react";

const ViewEmployee = ({ employee, onClose }) => {
  if (!employee) return null;

  const firstName = employee.first_name || employee.firstName || "";
  const lastName = employee.last_name || employee.lastName || "";
  const middleName = employee.middle_name || employee.middleName || "";
  const empId = employee.employee_id || employee.id || "";
  const department = employee.department || "";
  const designation = employee.designation || employee.position || "";
  const joiningDate = employee.joining_date || employee.joiningDate || "";

  const normalizeStatus = (s) => {
    const v = s?.toLowerCase();
    if (v === "active" || v === "approved")
      return { label: "Active", color: "bg-green-100 text-green-700" };
    if (v === "inactive" || v === "rejected")
      return { label: "Inactive", color: "bg-red-100 text-red-700" };
    if (v === "pending")
      return { label: "Pending", color: "bg-amber-100 text-amber-700" };
    return { label: s || "Unknown", color: "bg-gray-100 text-gray-600" };
  };

  const { label: statusLabel, color: statusColor } = normalizeStatus(
    employee.status,
  );

  const Section = ({ title, icon: Icon, children }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <Icon className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );

  const Field = ({ label, value }) => (
    <div>
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );

  return (
    /* ── Overlay: blur + semi-transparent, starts below header ── */
    <div
      className="fixed inset-0 z-50 backdrop-blur-sm bg-black/40 flex items-start justify-center p-4 pt-20 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
              {firstName[0] || "N"}
              {lastName[0] || "A"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {firstName} {middleName} {lastName}
              </h2>
              <p className="text-sm text-gray-500">
                {designation} · {department}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}
            >
              {statusLabel}
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[65vh]">
          <Section title="Personal Information" icon={User}>
            <Field label="Employee ID" value={empId} />
            <Field
              label="Full Name"
              value={`${firstName} ${middleName} ${lastName}`.trim()}
            />
            <Field label="Email" value={employee.email} />
            <Field label="Phone" value={employee.phone} />
            <Field label="Alternate Phone" value={employee.alt_phone} />
            <Field
              label="Date of Birth"
              value={
                employee.date_of_birth
                  ? new Date(employee.date_of_birth).toLocaleDateString("en-IN")
                  : ""
              }
            />
            <Field label="Gender" value={employee.gender} />
            <Field label="Aadhar Number" value={employee.aadhar_number} />
          </Section>

          <Section title="Address" icon={MapPin}>
            <Field label="Address" value={employee.address} />
            <Field label="City" value={employee.city} />
            <Field label="State" value={employee.state} />
            <Field label="Zip Code" value={employee.zip_code} />
          </Section>

          <Section title="Employment Details" icon={Briefcase}>
            <Field label="Department" value={department} />
            <Field label="Designation" value={designation} />
            <Field label="Employment Type" value={employee.employment_type} />
            <Field
              label="Joining Date"
              value={
                joiningDate
                  ? new Date(joiningDate).toLocaleDateString("en-IN")
                  : ""
              }
            />
            <Field label="Circle" value={employee.circle} />
            <Field label="Project Name" value={employee.project_name} />
            <Field
              label="Reporting Manager"
              value={employee.reporting_manager}
            />
          </Section>

          <Section title="Salary Details" icon={DollarSign}>
            <Field
              label="Basic Salary"
              value={
                employee.basic_salary
                  ? `₹${Number(employee.basic_salary).toLocaleString("en-IN")}`
                  : ""
              }
            />
            <Field
              label="HRA"
              value={
                employee.hra
                  ? `₹${Number(employee.hra).toLocaleString("en-IN")}`
                  : ""
              }
            />
            <Field
              label="Other Allowances"
              value={
                employee.other_allowances
                  ? `₹${Number(employee.other_allowances).toLocaleString("en-IN")}`
                  : ""
              }
            />
            <Field
              label="Total Salary"
              value={`₹${(Number(employee.basic_salary || 0) + Number(employee.hra || 0) + Number(employee.other_allowances || 0)).toLocaleString("en-IN")}`}
            />
          </Section>

          <Section title="Bank Details" icon={CreditCard}>
            <Field label="Bank Name" value={employee.bank_name} />
            <Field label="Account Number" value={employee.account_number} />
            <Field label="IFSC Code" value={employee.ifsc_code} />
            <Field
              label="Account Holder Name"
              value={employee.account_holder_name}
            />
            <Field
              label="Bank Branch"
              value={employee.bank_branch || employee.branch}
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewEmployee;
