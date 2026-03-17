import React from 'react';
import { Building2, CreditCard, Hash, User } from 'lucide-react';

const BankDetailsStep = ({ formData, errors, onChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bank Details</h2>
        <p className="text-gray-600">Enter your bank account information for salary payments</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Please ensure all bank details are accurate. This information will be used for salary deposits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bank Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="bankName"
              value={formData.bankName}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.bankName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter bank name"
            />
          </div>
          {errors.bankName && (
            <p className="mt-1 text-sm text-red-500">{errors.bankName}</p>
          )}
        </div>

        {/* Account Holder Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Account Holder Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="accountHolderName"
              value={formData.accountHolderName}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.accountHolderName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Name as per bank records"
            />
          </div>
          {errors.accountHolderName && (
            <p className="mt-1 text-sm text-red-500">{errors.accountHolderName}</p>
          )}
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Account Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="accountNumber"
              value={formData.accountNumber}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.accountNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter account number"
            />
          </div>
          {errors.accountNumber && (
            <p className="mt-1 text-sm text-red-500">{errors.accountNumber}</p>
          )}
        </div>

        {/* Confirm Account Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Confirm Account Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="confirmAccountNumber"
              value={formData.confirmAccountNumber}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                errors.confirmAccountNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Re-enter account number"
            />
          </div>
          {errors.confirmAccountNumber && (
            <p className="mt-1 text-sm text-red-500">{errors.confirmAccountNumber}</p>
          )}
        </div>

        {/* IFSC Code */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            IFSC Code <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="ifscCode"
              value={formData.ifscCode}
              onChange={onChange}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase ${
                errors.ifscCode ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="ABCD0123456"
              maxLength="11"
            />
          </div>
          {errors.ifscCode && (
            <p className="mt-1 text-sm text-red-500">{errors.ifscCode}</p>
          )}
        </div>

       
        {/* Bank Branch */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bank Branch
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="bankBranch"
              value={formData.bankBranch}
              onChange={onChange}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter bank branch name/location"
            />
          </div>
        </div>

       
      </div>
    </div>
  );
};

export default BankDetailsStep;