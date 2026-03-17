import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Link2,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Loader,
  AlertCircle,
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import AddEmployeeWizard from "./AddEmp";
import PublicLinkModal from "./GenerateLink";
import ImportExcelModal from "./EmployeeExcel";
import ViewEmployee from "./ViewEmployee";
import EditEmployee from "./EditEmployee";
import employeeService from "../../services/employeeService";

const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:5000/api";

// ── Inline Toast Component ─────────────────────────────────────────────────
const Toast = ({ toasts, removeToast }) => {
  const icons = {
    success: <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />,
    error: <XCircle className="w-4 h-4 text-red-500   flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500  flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
  };
  const colors = {
    success: "border-green-200 bg-green-50  text-green-800",
    error: "border-red-200   bg-red-50    text-red-800",
    info: "border-blue-200  bg-blue-50   text-blue-800",
    warning: "border-amber-200 bg-amber-50  text-amber-800",
  };

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium min-w-[260px] max-w-[360px] animate-slide-in ${colors[t.type] || colors.info}`}
        >
          {icons[t.type] || icons.info}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity text-base leading-none"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in { animation: slide-in 0.25s ease-out; }
      `}</style>
    </div>
  );
};

// ── Confirm Dialog Component ───────────────────────────────────────────────
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-[9998] backdrop-blur-sm bg-black/40 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-sm font-medium text-gray-800">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
const EmployeeManagement = ({ showToast: parentShowToast }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [exportLoading, setExportLoading] = useState(false);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const toast = useCallback(
    (message, type = "info") => {
      const id = Date.now() + Math.random();
      setToasts((p) => [...p, { id, message, type }]);
      parentShowToast?.(message, type);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
    },
    [parentShowToast],
  );

  const removeToast = (id) => setToasts((p) => p.filter((t) => t.id !== id));

  const confirmAction = (message) =>
    new Promise((resolve) => {
      setConfirm({
        message,
        onConfirm: () => {
          setConfirm(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirm(null);
          resolve(false);
        },
      });
    });

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await employeeService.getAllEmployees();
      if (response.success) {
        setEmployees(response.data || []);
      } else {
        setError(response.message || "Failed to load employees");
      }
    } catch (err) {
      setError(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const generateEmployeeId = () => {
    if (employees.length === 0) return "EMP001";
    const ids = employees.map((emp) => {
      const raw = (emp.employee_id || emp.id || "")
        .toString()
        .replace(/\D/g, "");
      return parseInt(raw) || 0;
    });
    const maxId = Math.max(...ids, 0);
    return `EMP${String(maxId + 1).padStart(3, "0")}`;
  };

  const handleAddEmployee = async (employeeData) => {
    const response = await employeeService.addEmployee(employeeData);
    if (response.success) {
      toast("Employee added successfully!", "success");
      setShowModal(false);
      fetchEmployees();
    } else {
      throw new Error(response.message || "Failed to add employee");
    }
  };

  const handleEditSave = (updatedEmployee) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === updatedEmployee.id ||
        e.employee_id === updatedEmployee.employee_id
          ? { ...e, ...updatedEmployee }
          : e,
      ),
    );
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmAction(
      "Are you sure you want to deactivate this employee?",
    );
    if (!confirmed) return;
    try {
      const response = await employeeService.deleteEmployee(id);
      if (response.success) {
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === id || e.employee_id === id
              ? { ...e, status: "Inactive" }
              : e,
          ),
        );
        toast("Employee deactivated successfully", "success");
      } else {
        throw new Error(response.message);
      }
    } catch (err) {
      toast(err.message || "Failed to deactivate employee", "error");
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      toast("Exporting employee data…", "info");
      const res = await fetch(`${BASE_URL}/employees/export/data`);
      if (!res.ok) throw new Error("Export failed. Please try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `employees_export_${date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast("Employee data exported successfully!", "success");
    } catch (err) {
      toast(err.message || "Failed to export data", "error");
    } finally {
      setExportLoading(false);
    }
  };

  const normalizeStatus = (status) => {
    const s = status?.toLowerCase();
    if (s === "active" || s === "approved") return "Active";
    if (s === "pending") return "Pending";
    if (s === "inactive" || s === "rejected") return "Inactive";
    return status || "Unknown";
  };

  const filteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    const firstName = emp.first_name || emp.firstName || "";
    const lastName = emp.last_name || emp.lastName || "";
    const matchSearch =
      firstName.toLowerCase().includes(q) ||
      lastName.toLowerCase().includes(q) ||
      (emp.employee_id || "").toLowerCase().includes(q) ||
      (emp.email || "").toLowerCase().includes(q);
    const matchFilter =
      filterStatus === "all" || normalizeStatus(emp.status) === filterStatus;
    return matchSearch && matchFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* ── Toast notifications ── */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* ── Confirm dialog ── */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Employee Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Manage your workforce — add, search, and maintain employee records
          </p>
        </div>
        <button
          onClick={fetchEmployees}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={fetchEmployees}
            className="ml-auto text-xs text-red-600 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setModalType("add");
            setShowModal(true);
          }}
          className="px-6 py-4 bg-blue-600 text-white border-2 border-blue-600 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" /> Add Employee Manually
        </button>
        <button
          onClick={() => {
            setModalType("link");
            setShowModal(true);
          }}
          className="px-6 py-4 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-50 transition-all shadow-sm"
        >
          <Link2 className="w-5 h-5" /> Generate Public Link
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="px-6 py-4 bg-white border-2 border-green-600 text-green-600 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-green-50 transition-all shadow-sm"
        >
          <Upload className="w-5 h-5" /> Import from Excel
        </button>
        <button
          onClick={handleExportData}
          disabled={exportLoading}
          className={`px-6 py-4 border-2 border-purple-600 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-sm ${
            exportLoading
              ? "bg-purple-100 text-purple-400 cursor-not-allowed"
              : "bg-white text-purple-600 hover:bg-purple-50"
          }`}
        >
          <Download
            className={`w-5 h-5 ${exportLoading ? "animate-bounce" : ""}`}
          />
          {exportLoading ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {/* ── Search & Filter ── */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[260px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 outline-none bg-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Employees Found
            </h3>
            <p className="text-gray-500 mb-5 text-sm">
              {employees.length === 0
                ? "Get started by adding your first employee"
                : "Try adjusting your search or filters"}
            </p>
            {employees.length === 0 && (
              <button
                onClick={() => {
                  setModalType("add");
                  setShowModal(true);
                }}
                className="bg-blue-600 px-6 py-3 text-white rounded-lg font-medium inline-flex items-center gap-2 hover:bg-blue-700 transition-all"
              >
                <Plus className="w-5 h-5" /> Add First Employee
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {[
                      "Employee",
                      "ID",
                      "Department",
                      "Designation",
                      "Joining Date",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEmployees.map((emp) => {
                    const normalizedStatus = normalizeStatus(emp.status);
                    const firstName = emp.first_name || emp.firstName || "";
                    const lastName = emp.last_name || emp.lastName || "";
                    const empId = emp.employee_id || emp.id || "";
                    const department = emp.department || "";
                    const designation = emp.designation || emp.position || "";
                    const joiningDate =
                      emp.joining_date || emp.joiningDate || "";

                    return (
                      <tr
                        key={emp.id || emp.employee_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                              {firstName[0] || "N"}
                              {lastName[0] || "A"}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {firstName} {lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {emp.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-medium text-gray-700">
                            {empId}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">
                            {department || "—"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-700">
                            {designation || "—"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-500">
                            {joiningDate
                              ? new Date(joiningDate).toLocaleDateString(
                                  "en-IN",
                                )
                              : "—"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              normalizedStatus === "Active"
                                ? "bg-green-100 text-green-700"
                                : normalizedStatus === "Inactive"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {normalizedStatus}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              className="p-2 hover:bg-blue-50 rounded-lg transition-all"
                              title="View"
                              onClick={() => setViewEmployee(emp)}
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </button>
                            <button
                              className="p-2 hover:bg-green-50 rounded-lg transition-all"
                              title="Edit"
                              onClick={() => setEditEmployee(emp)}
                            >
                              <Edit2 className="w-4 h-4 text-green-600" />
                            </button>
                            {normalizedStatus !== "Inactive" && (
                              <button
                                className="p-2 hover:bg-red-50 rounded-lg transition-all"
                                title="Deactivate"
                                onClick={() =>
                                  handleDelete(emp.id || emp.employee_id)
                                }
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
              Showing {filteredEmployees.length} of {employees.length} employees
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showModal && modalType === "add" && (
        <AddEmployeeWizard
          onClose={() => setShowModal(false)}
          onSubmit={handleAddEmployee}
          generateEmployeeId={generateEmployeeId}
        />
      )}
      {showModal && modalType === "link" && (
        <PublicLinkModal
          onClose={() => setShowModal(false)}
          showToast={toast}
        />
      )}
      {showImportModal && (
        <ImportExcelModal
          onClose={() => setShowImportModal(false)}
          showToast={toast}
          onImportComplete={() => {
            fetchEmployees();
            setShowImportModal(false);
          }}
        />
      )}
      {viewEmployee && (
        <ViewEmployee
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
        />
      )}
      {editEmployee && (
        <EditEmployee
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onSave={handleEditSave}
          showToast={toast}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;
