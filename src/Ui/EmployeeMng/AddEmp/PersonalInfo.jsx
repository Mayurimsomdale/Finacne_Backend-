// src/Ui/EmployeeMng/AddEmp/PersonalInfo.jsx
import React from 'react';
import { Mail, Phone, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import { genders } from '../../../data/empmockdata';

const PersonalInformation = ({ formData, handleInputChange, errors = {}, touched = {} }) => {
  const formatAadhar = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const match = cleaned.match(/(\d{0,4})(\d{0,4})(\d{0,4})/);
    if (match) {
      return [match[1], match[2], match[3]].filter(Boolean).join(' ');
    }
    return value;
  };

  const handleAadharChange = (e) => {
    const value = e.target.value.replace(/\s/g, '');
    if (/^\d*$/.test(value) && value.length <= 12) {
      handleInputChange({ target: { name: 'aadhar', value } });
    }
  };

  const handlePhoneChange = (e, fieldName) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 10) {
      handleInputChange({ target: { name: fieldName, value } });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* First Name */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none`}
            placeholder="John"
          />
          {errors.firstName && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.firstName}
            </p>
          )}
        </div>

        {/* Middle Name */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">Middle Name</label>
          <input
            type="text"
            name="middleName"
            value={formData.middleName}
            onChange={handleInputChange}
            className="w-full px-4 py-2.5 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
            placeholder="Michael"
          />
        </div>

        {/* Last Name */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none`}
            placeholder="Doe"
          />
          {errors.lastName && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.lastName}
            </p>
          )}
        </div>

        {/* Aadhar */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <CreditCard className="w-4 h-4 text-gray-500" />
            Aadhar Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="aadhar"
            value={formatAadhar(formData.aadhar)}
            onChange={handleAadharChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.aadhar ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none font-mono tracking-wide`}
            placeholder="1234 5678 9012"
          />
          {errors.aadhar && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.aadhar}
            </p>
          )}
        </div>

        {/* DOB */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Calendar className="w-4 h-4 text-gray-500" />
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleInputChange}
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.dob ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none`}
          />
          {errors.dob && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.dob}
            </p>
          )}
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Gender <span className="text-red-500">*</span>
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.gender ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none appearance-none bg-white cursor-pointer`}
          >
            <option value="">Select Gender</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {errors.gender && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.gender}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Mail className="w-4 h-4 text-gray-500" />
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`w-full px-4 py-2.5 rounded-lg border-2 ${
              errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
            } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none`}
            placeholder="john.doe@example.com"
          />
          {errors.email && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.email}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Phone className="w-4 h-4 text-gray-500" />
            Phone <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">+91</span>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e, 'phone')}
              className={`w-full pl-12 pr-4 py-2.5 rounded-lg border-2 ${
                errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'
              } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none font-mono`}
              placeholder="9876543210"
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors.phone}
            </p>
          )}
        </div>

        {/* Alt Phone */}
        <div className="space-y-2 md:col-span-2">
          <label className="flex items-center gap-1 text-sm font-semibold text-gray-700">
            <Phone className="w-4 h-4 text-gray-500" />
            Alternate Phone
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">+91</span>
            <input
              type="tel"
              name="altPhone"
              value={formData.altPhone}
              onChange={(e) => handlePhoneChange(e, 'altPhone')}
              className="w-full pl-12 pr-4 py-2.5 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none font-mono"
              placeholder="9876543210"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
        <p className="text-sm text-blue-800 font-medium">
          Please ensure all information is accurate and matches official documents. Fields marked with <span className="text-red-600 font-bold">*</span> are mandatory.
        </p>
      </div>
    </div>
  );
};

export default PersonalInformation;