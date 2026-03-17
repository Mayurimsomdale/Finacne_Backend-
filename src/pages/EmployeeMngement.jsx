import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import EmployeeDashboard from "../Ui/EmployeeMng/DashboardEmp";
import PendingApprovals from "../Ui/EmployeeMng/PendingApprovals";

const EmployeeRoutes = () => {
  return (
    <Routes>
      {/* Employee Management Dashboard - Main employee management page */}
      <Route path="management" element={<EmployeeDashboard />} />

      {/* Pending Approvals - Review and approve employee registrations */}
      <Route path="pending" element={<PendingApprovals />} />

      {/* Legacy route for backward compatibility */}
      <Route path="dashboard" element={<EmployeeDashboard />} />

      {/* Coming Soon Pages */}
      <Route 
        path="payments" 
        element={
          <div className="p-8 text-center">
            <div className="bg-white rounded-2xl border border-gray-200 p-16 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Advanced Payments</h2>
              <p className="text-gray-500">Coming Soon</p>
            </div>
          </div>
        } 
      />
      
      <Route 
        path="payroll" 
        element={
          <div className="p-8 text-center">
            <div className="bg-white rounded-2xl border border-gray-200 p-16 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payroll</h2>
              <p className="text-gray-500">Coming Soon</p>
            </div>
          </div>
        } 
      />
      
      <Route 
        path="reports" 
        element={
          <div className="p-8 text-center">
            <div className="bg-white rounded-2xl border border-gray-200 p-16 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reports</h2>
              <p className="text-gray-500">Coming Soon</p>
            </div>
          </div>
        } 
      />

      {/* NOTE: Public registration route has been moved to App.jsx as /registration/:linkId */}
      {/* This allows employees to register without authentication */}

      {/* Default redirect to management */}
      <Route path="/" element={<Navigate to="management" replace />} />
    </Routes>
  );
};

export default EmployeeRoutes;