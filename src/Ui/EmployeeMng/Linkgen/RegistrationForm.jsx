// src/Ui/EmployeeMng/Linkgen/RegistrationForm.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, Loader, User, Briefcase, Building,
  CreditCard, Phone, Mail, Calendar, Upload, FileText, Image, Check, ChevronLeft, ChevronRight
} from 'lucide-react';
import employeeService from '../../../services/employeeService';
import { departments, employmentTypes, genders } from '../../../data/empmockdata';

// ─── Document Upload Card ─────────────────────────────────────────────────────
const DocCard = ({ title, fieldName, required, documents, handleDocChange, errors }) => {
  const doc = documents[fieldName];
  const getFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className={`border-2 rounded-xl p-4 text-center transition-all ${
        doc ? 'border-green-400 bg-green-50' :
        errors[fieldName] ? 'border-red-300 bg-red-50' :
        'border-dashed border-gray-300 hover:border-blue-400 bg-white'
      }`}>
        {doc ? (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500 truncate">{doc.name}</p>
            <p className="text-xs text-gray-400">{getFileSize(doc.size)}</p>
            <div className="flex gap-2 justify-center">
              <label className="cursor-pointer text-xs text-blue-600 font-medium hover:underline">
                Replace
                <input type="file" accept="image/*,application/pdf" onChange={(e) => handleDocChange(fieldName, e.target.files[0])} className="hidden" />
              </label>
              <button type="button" onClick={() => handleDocChange(fieldName, null)} className="text-xs text-red-500 font-medium hover:underline">Remove</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <FileText className="w-10 h-10 mx-auto text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">
              {title}{required && <span className="text-red-500 ml-1">*</span>}
            </p>
            <p className="text-xs text-gray-500">PNG, JPG, PDF • Max 5MB</p>
            <label className="cursor-pointer">
              <span className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all">
                Choose File
              </span>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleDocChange(fieldName, e.target.files[0])} className="hidden" />
            </label>
          </div>
        )}
      </div>
      {errors[fieldName] && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{errors[fieldName]}
        </p>
      )}
    </div>
  );
};

// ─── Main Registration Form ───────────────────────────────────────────────────
const RegistrationForm = () => {
  const { linkId } = useParams();
  const navigate = useNavigate();

  const [linkStatus, setLinkStatus] = useState('validating'); // validating | valid | invalid | expired | used
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    firstName: '', middleName: '', lastName: '',
    email: '', phone: '', dateOfBirth: '', gender: '',
    address: '', city: '', state: '', zipCode: '',
    department: '', position: '', joiningDate: '',
    employmentType: '', reportingManager: '',
    bankName: '', accountNumber: '', ifscCode: '',
    accountHolderName: '', bankBranch: '',
  });

  const [documents, setDocuments] = useState({
    idPhoto: null,
    aadharCard: null,
    bankPassbook: null,
    panCard: null,
  });

  // Validate link on mount
  useEffect(() => {
    const validateLink = async () => {
      try {
        const res = await employeeService.validateLink(linkId);
        if (res.success && res.valid) {
          setLinkStatus('valid');
        } else {
          setLinkStatus('invalid');
        }
      } catch (err) {
        if (err.expired) setLinkStatus('expired');
        else if (err.used) setLinkStatus('used');
        else setLinkStatus('invalid');
      }
    };
    validateLink();
  }, [linkId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 10) {
      setFormData(prev => ({ ...prev, phone: value }));
      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const handleDocChange = (field, file) => {
    if (!file) {
      setDocuments(prev => ({ ...prev, [field]: null }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [field]: 'File must be less than 5MB' }));
      return;
    }
    setDocuments(prev => ({ ...prev, [field]: file }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      else if (!/^[6-9]\d{9}$/.test(formData.phone)) newErrors.phone = 'Enter a valid 10-digit Indian phone number';
      if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
      else {
        const age = Math.floor((new Date() - new Date(formData.dateOfBirth)) / 31557600000);
        if (age < 18) newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
      if (!formData.gender) newErrors.gender = 'Gender is required';
    }

    if (step === 2) {
      if (!formData.department) newErrors.department = 'Department is required';
      if (!formData.position.trim()) newErrors.position = 'Position is required';
      if (!formData.joiningDate) newErrors.joiningDate = 'Joining date is required';
      if (!formData.employmentType) newErrors.employmentType = 'Employment type is required';
    }

    if (step === 3) {
      if (!formData.bankName.trim()) newErrors.bankName = 'Bank name is required';
      if (!formData.accountNumber.trim()) newErrors.accountNumber = 'Account number is required';
      if (!formData.ifscCode.trim()) newErrors.ifscCode = 'IFSC code is required';
    }

    if (step === 4) {
      if (!documents.idPhoto) newErrors.idPhoto = 'ID photo is required';
      if (!documents.aadharCard) newErrors.aadharCard = 'Aadhar card is required';
      if (!documents.bankPassbook) newErrors.bankPassbook = 'Bank passbook is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => setCurrentStep(prev => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      await employeeService.submitRegistration(
        { ...formData, linkId },
        documents
      );
      setIsSubmitted(true);
    } catch (err) {
      console.error('Submission error:', err);
      if (err.used) {
        setLinkStatus('used');
      } else if (err.expired) {
        setLinkStatus('expired');
      } else {
        setErrors({ submit: err.message || 'Submission failed. Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = ['Personal Info', 'Employment', 'Bank Details', 'Documents'];

  // ─── Link invalid / expired / used states ──────────────────────────────────
  if (linkStatus === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Validating your registration link...</p>
        </div>
      </div>
    );
  }

  if (linkStatus === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Link Expired</h2>
          <p className="text-gray-600">This registration link has expired. Please contact HR to get a new link.</p>
        </div>
      </div>
    );
  }

  if (linkStatus === 'used') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Link Already Used</h2>
          <p className="text-gray-600">This registration link has already been used. Please contact HR if you have any questions.</p>
        </div>
      </div>
    );
  }

  if (linkStatus === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Invalid Link</h2>
          <p className="text-gray-600">This registration link is not valid. Please contact HR for assistance.</p>
        </div>
      </div>
    );
  }

  // ─── Success state ─────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-14 h-14 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Registration Submitted!</h2>
          <p className="text-gray-600 mb-6">
            Your registration has been submitted successfully. HR will review your application and you will be notified once it's approved.
          </p>
          <div className="bg-blue-50 rounded-xl p-4 text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">What happens next?</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>✓ HR reviews your submitted information</li>
              <li>✓ Documents are verified</li>
              <li>✓ You receive your Employee ID on approval</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full mb-4 shadow-lg">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Employee Registration</h1>
          <p className="text-gray-600 mt-2">Please fill in your details accurately</p>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentStep > idx + 1 ? 'bg-green-500 text-white' :
                    currentStep === idx + 1 ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > idx + 1 ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`mt-1.5 text-xs font-medium hidden sm:block ${
                    currentStep >= idx + 1 ? 'text-gray-800' : 'text-gray-400'
                  }`}>{step}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 rounded-full ${currentStep > idx + 1 ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {errors.submit && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Step 1: Personal Info */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="First Name" name="firstName" value={formData.firstName} onChange={handleInputChange} error={errors.firstName} required placeholder="John" />
                <Field label="Middle Name" name="middleName" value={formData.middleName} onChange={handleInputChange} placeholder="Kumar" />
                <Field label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} error={errors.lastName} required placeholder="Doe" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} error={errors.email} required placeholder="john@example.com" />
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Phone <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+91</span>
                    <input type="tel" name="phone" value={formData.phone} onChange={handlePhoneChange}
                      className={`w-full pl-12 pr-4 py-2.5 rounded-lg border-2 ${errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'} focus:border-blue-500 outline-none font-mono`}
                      placeholder="9876543210" />
                  </div>
                  {errors.phone && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.phone}</p>}
                </div>
                <Field label="Date of Birth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} error={errors.dateOfBirth} required max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]} />
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Gender <span className="text-red-500">*</span></label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 rounded-lg border-2 ${errors.gender ? 'border-red-500 bg-red-50' : 'border-gray-300'} focus:border-blue-500 outline-none bg-white cursor-pointer appearance-none`}>
                    <option value="">Select Gender</option>
                    {genders.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {errors.gender && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.gender}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Address" name="address" value={formData.address} onChange={handleInputChange} placeholder="123 Main Street" />
                <Field label="City" name="city" value={formData.city} onChange={handleInputChange} placeholder="Mumbai" />
                <Field label="State" name="state" value={formData.state} onChange={handleInputChange} placeholder="Maharashtra" />
                <Field label="Pin Code" name="zipCode" value={formData.zipCode} onChange={handleInputChange} placeholder="400001" />
              </div>
            </div>
          )}

          {/* Step 2: Employment */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />Employment Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Department <span className="text-red-500">*</span></label>
                  <select name="department" value={formData.department} onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 rounded-lg border-2 ${errors.department ? 'border-red-500 bg-red-50' : 'border-gray-300'} focus:border-blue-500 outline-none bg-white cursor-pointer appearance-none`}>
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.department}</p>}
                </div>
                <Field label="Position / Designation" name="position" value={formData.position} onChange={handleInputChange} error={errors.position} required placeholder="e.g. Software Engineer" />
                <Field label="Joining Date" name="joiningDate" type="date" value={formData.joiningDate} onChange={handleInputChange} error={errors.joiningDate} required />
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Employment Type <span className="text-red-500">*</span></label>
                  <select name="employmentType" value={formData.employmentType} onChange={handleInputChange}
                    className={`w-full px-4 py-2.5 rounded-lg border-2 ${errors.employmentType ? 'border-red-500 bg-red-50' : 'border-gray-300'} focus:border-blue-500 outline-none bg-white cursor-pointer appearance-none`}>
                    <option value="">Select Type</option>
                    {employmentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.employmentType && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.employmentType}</p>}
                </div>
                <Field label="Reporting Manager" name="reportingManager" value={formData.reportingManager} onChange={handleInputChange} placeholder="Manager's name" />
              </div>
            </div>
          )}

          {/* Step 3: Bank */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-green-600" />Bank Account Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Bank Name" name="bankName" value={formData.bankName} onChange={handleInputChange} error={errors.bankName} required placeholder="State Bank of India" />
                <Field label="Branch Name" name="bankBranch" value={formData.bankBranch} onChange={handleInputChange} placeholder="Main Branch, Mumbai" />
                <Field label="Account Number" name="accountNumber" value={formData.accountNumber} onChange={handleInputChange} error={errors.accountNumber} required placeholder="Enter account number" mono />
                <Field label="IFSC Code" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} error={errors.ifscCode} required placeholder="SBIN0001234" mono uppercase />
                <Field label="Account Holder Name" name="accountHolderName" value={formData.accountHolderName} onChange={handleInputChange} placeholder="Full name as per bank" />
              </div>
            </div>
          )}

          {/* Step 4: Documents */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />Document Upload
              </h2>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg text-sm text-blue-800">
                <strong>Required:</strong> ID Photo, Aadhar Card, Bank Passbook. PAN Card is optional.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DocCard title="ID Photo" fieldName="idPhoto" required documents={documents} handleDocChange={handleDocChange} errors={errors} />
                <DocCard title="Aadhar Card" fieldName="aadharCard" required documents={documents} handleDocChange={handleDocChange} errors={errors} />
                <DocCard title="Bank Passbook / Cancelled Cheque" fieldName="bankPassbook" required documents={documents} handleDocChange={handleDocChange} errors={errors} />
                <DocCard title="PAN Card (Optional)" fieldName="panCard" required={false} documents={documents} handleDocChange={handleDocChange} errors={errors} />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                currentStep === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />Back
            </button>

            <span className="text-sm text-gray-500">Step {currentStep} of {steps.length}</span>

            {currentStep < steps.length ? (
              <button type="button" onClick={handleNext} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all">
                Next<ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader className="w-4 h-4 animate-spin" />Submitting...</>
                ) : (
                  <><Check className="w-4 h-4" />Submit Registration</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Reusable Field Component ─────────────────────────────────────────────────
const Field = ({ label, name, type = 'text', value, onChange, error, required, placeholder, max, mono, uppercase }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-semibold text-gray-700">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      max={max}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-lg border-2 ${
        error ? 'border-red-500 bg-red-50' : 'border-gray-300'
      } focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all ${
        mono ? 'font-mono tracking-wide' : ''
      } ${uppercase ? 'uppercase' : ''}`}
    />
    {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
  </div>
);

export default RegistrationForm;