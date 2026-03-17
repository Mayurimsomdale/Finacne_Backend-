// src/Ui/EmployeeMng/AddEmp/employeeDetails.jsx
import React from 'react';
import { Calendar, Building2, Users, AlertCircle } from 'lucide-react';
import { departments, employmentTypes } from '../../../data/empmockdata';

const EmploymentDetails = ({ formData, handleInputChange, errors = {} }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Employee ID */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Employee ID</label>
          <div className="relative">
            <input
              type="text"
              name="employeeId"
              value={formData.employeeId}
              readOnly
              className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-200 bg-gray-50 outline-none font-mono tracking-wide text-gray-700"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                Auto-generated
              </span>
            </div>
          </div>
        </div>

        {/* Joining Date */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Calendar className="w-4 h-4 text-gray-500" />
            Joining Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="joiningDate"
            value={formData.joiningDate}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.joiningDate ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none`}
          />
          {errors.joiningDate && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.joiningDate}
            </p>
          )}
        </div>

        {/* Department */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Building2 className="w-4 h-4 text-gray-500" />
            Department <span className="text-red-500">*</span>
          </label>
          <select
            name="department"
            value={formData.department}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.department ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none appearance-none bg-white cursor-pointer`}
          >
            <option value="">Select Department</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.department && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.department}
            </p>
          )}
        </div>

        {/* Designation */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Users className="w-4 h-4 text-gray-500" />
            Designation <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="designation"
            value={formData.designation}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.designation ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none`}
            placeholder="e.g., Software Engineer"
          />
          {errors.designation && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.designation}
            </p>
          )}
        </div>

        {/* Employment Type */}
        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Employment Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {employmentTypes.map(type => (
              <label
                key={type}
                className={`relative flex items-center justify-center px-4 py-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.employmentType === type
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-gray-300 hover:border-indigo-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="employmentType"
                  value={type}
                  checked={formData.employmentType === type}
                  onChange={handleInputChange}
                  className="sr-only"
                />
                <span className={`text-sm font-medium ${
                  formData.employmentType === type ? 'text-indigo-700' : 'text-gray-700'
                }`}>
                  {type}
                </span>
                {formData.employmentType === type && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </label>
            ))}
          </div>
          {errors.employmentType && (
            <p className="text-xs text-red-600 flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" />{errors.employmentType}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmploymentDetails;