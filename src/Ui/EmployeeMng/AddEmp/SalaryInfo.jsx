// src/Ui/EmployeeMng/AddEmp/SalaryInfo.jsx
import React from 'react';
import { DollarSign, Building, BadgeIndianRupee, Landmark, AlertCircle } from 'lucide-react';

const SalaryDetails = ({ formData, handleInputChange, errors = {} }) => {
  const calculateTotal = () => {
    const basic = parseFloat(formData.basicSalary) || 0;
    const hra = parseFloat(formData.hra) || 0;
    const allowances = parseFloat(formData.otherAllowances) || 0;
    return basic + hra + allowances;
  };

  const formatCurrency = (value) => {
    if (!value) return '0';
    return parseFloat(value).toLocaleString('en-IN');
  };

  const total = calculateTotal();

  return (
    <div className="space-y-6">
      {/* Salary Section */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Salary Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Basic Salary */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Basic Salary <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">₹</span>
              <input
                type="number"
                name="basicSalary"
                value={formData.basicSalary}
                onChange={handleInputChange}
                min="0"
                step="1000"
                className={`w-full pl-8 pr-4 py-2.5 rounded-lg border-2 ${
                  errors.basicSalary ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
                } focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all outline-none font-medium`}
                placeholder="50000"
              />
            </div>
            {errors.basicSalary && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{errors.basicSalary}
              </p>
            )}
          </div>

          {/* HRA */}
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
              <Building className="w-3.5 h-3.5 text-gray-500" />HRA
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">₹</span>
              <input
                type="number"
                name="hra"
                value={formData.hra}
                onChange={handleInputChange}
                min="0"
                step="1000"
                className="w-full pl-8 pr-4 py-2.5 rounded-lg border-2 border-gray-300 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all outline-none font-medium"
                placeholder="15000"
              />
            </div>
          </div>

          {/* Other Allowances */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Other Allowances</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">₹</span>
              <input
                type="number"
                name="otherAllowances"
                value={formData.otherAllowances}
                onChange={handleInputChange}
                min="0"
                step="1000"
                className="w-full pl-8 pr-4 py-2.5 rounded-lg border-2 border-gray-300 bg-white focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all outline-none font-medium"
                placeholder="5000"
              />
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="mt-4 p-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white/80 mb-0.5">Total Monthly Salary</p>
              <p className="text-2xl font-bold text-white">₹ {formatCurrency(total)}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <BadgeIndianRupee className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-blue-600" />
          Bank Account Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bank Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Bank Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="bankName"
              value={formData.bankName}
              onChange={handleInputChange}
              className={`w-full px-4 py-2.5 rounded-lg border-2 ${
                errors.bankName ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
              } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none`}
              placeholder="e.g., State Bank of India"
            />
            {errors.bankName && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{errors.bankName}
              </p>
            )}
          </div>

          {/* Branch */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Branch Name</label>
            <input
              type="text"
              name="branch"
              value={formData.branch}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
              placeholder="e.g., Main Branch, Mumbai"
            />
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Account Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={handleInputChange}
              className={`w-full px-4 py-2.5 rounded-lg border-2 ${
                errors.accountNumber ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
              } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none font-mono tracking-wide`}
              placeholder="Enter account number"
            />
            {errors.accountNumber && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{errors.accountNumber}
              </p>
            )}
          </div>

          {/* IFSC Code */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              IFSC Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="ifscCode"
              value={formData.ifscCode}
              onChange={handleInputChange}
              className={`w-full px-4 py-2.5 rounded-lg border-2 ${
                errors.ifscCode ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
              } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none font-mono tracking-wide uppercase`}
              placeholder="e.g., SBIN0001234"
            />
            {errors.ifscCode && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{errors.ifscCode}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryDetails;