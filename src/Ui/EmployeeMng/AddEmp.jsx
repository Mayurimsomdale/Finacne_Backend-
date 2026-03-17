
  // src/Ui/EmployeeMng/AddEmp/index.jsx
import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
  import PersonalInformation from './AddEmp/PersonalInfo';
  import EmploymentDetails from './AddEmp/employeeDetails';
  import SalaryDetails from './AddEmp/SalaryInfo';
  import DocumentUpload from './AddEmp/IDProof';

const AddEmployeeWizard = ({ onClose, onSubmit, generateEmployeeId }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    aadhar: '',
    dob: '',
    gender: '',
    email: '',
    phone: '',
    altPhone: '',
    employeeId: generateEmployeeId(),
    joiningDate: '',
    department: '',
    designation: '',
    employmentType: '',
    basicSalary: '',
    hra: '',
    otherAllowances: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    status: 'Active',
  });

  const [documents, setDocuments] = useState({
    photo: null,
    aadharCard: null,
    panCard: null,
    bankPassbook: null,
  });

  const steps = [
    { number: 1, title: 'Personal Info', component: PersonalInformation },
    { number: 2, title: 'Employee Details', component: EmploymentDetails },
    { number: 3, title: 'Salary & Bank', component: SalaryDetails },
    { number: 4, title: 'Documents', component: DocumentUpload },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileUpload = (documentType, file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [documentType]: 'File size must be less than 5MB' }));
      return;
    }
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, [documentType]: 'Only JPEG, PNG, GIF, WEBP, and PDF files are allowed' }));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setDocuments(prev => ({
        ...prev,
        [documentType]: { file, preview: reader.result, name: file.name },
      }));
      if (errors[documentType]) {
        setErrors(prev => ({ ...prev, [documentType]: '' }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileRemove = (documentType) => {
    setDocuments(prev => ({ ...prev, [documentType]: null }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      else if (formData.firstName.length < 2) newErrors.firstName = 'Must be at least 2 characters';
      else if (!/^[a-zA-Z\s]+$/.test(formData.firstName)) newErrors.firstName = 'Only letters allowed';

      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      else if (formData.lastName.length < 2) newErrors.lastName = 'Must be at least 2 characters';
      else if (!/^[a-zA-Z\s]+$/.test(formData.lastName)) newErrors.lastName = 'Only letters allowed';

      if (!formData.aadhar.trim()) newErrors.aadhar = 'Aadhar number is required';
      else if (!/^\d{12}$/.test(formData.aadhar.replace(/\s/g, ''))) newErrors.aadhar = 'Aadhar must be exactly 12 digits';

      if (!formData.dob) newErrors.dob = 'Date of birth is required';
      else {
        const age = Math.floor((new Date() - new Date(formData.dob)) / 31557600000);
        if (age < 18) newErrors.dob = 'Employee must be at least 18 years old';
        else if (age > 100) newErrors.dob = 'Please enter a valid date of birth';
      }

      if (!formData.gender) newErrors.gender = 'Gender is required';

      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';

      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
      else if (!/^[6-9]\d{9}$/.test(formData.phone)) newErrors.phone = 'Please enter a valid 10-digit Indian phone number';

      if (formData.altPhone && !/^[6-9]\d{9}$/.test(formData.altPhone)) {
        newErrors.altPhone = 'Please enter a valid 10-digit Indian phone number';
      }
    }

    if (step === 2) {
      if (!formData.joiningDate) newErrors.joiningDate = 'Joining date is required';
      else {
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        if (new Date(formData.joiningDate) > oneYearFromNow) {
          newErrors.joiningDate = 'Joining date cannot be more than 1 year in the future';
        }
      }
      if (!formData.department) newErrors.department = 'Department is required';
      if (!formData.designation.trim()) newErrors.designation = 'Designation is required';
      else if (formData.designation.length < 2) newErrors.designation = 'Must be at least 2 characters';
      if (!formData.employmentType) newErrors.employmentType = 'Employment type is required';
    }

    if (step === 3) {
      if (!formData.basicSalary) newErrors.basicSalary = 'Basic salary is required';
      else if (parseFloat(formData.basicSalary) <= 0) newErrors.basicSalary = 'Salary must be greater than 0';
      else if (parseFloat(formData.basicSalary) > 10000000) newErrors.basicSalary = 'Please enter a realistic salary amount';
      if (!formData.bankName.trim()) newErrors.bankName = 'Bank name is required';
      if (!formData.accountNumber.trim()) newErrors.accountNumber = 'Account number is required';
      if (!formData.ifscCode.trim()) newErrors.ifscCode = 'IFSC code is required';
    }

    if (step === 4) {
      if (!documents.photo) newErrors.photo = 'Employee photo is required';
      if (!documents.aadharCard) newErrors.aadharCard = 'Aadhar card is required';
      if (!documents.bankPassbook) newErrors.bankPassbook = 'Bank passbook or cancelled cheque is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const firstError = document.querySelector('.border-red-500, .border-red-300');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      const totalSalary =
        (parseFloat(formData.basicSalary) || 0) +
        (parseFloat(formData.hra) || 0) +
        (parseFloat(formData.otherAllowances) || 0);

      const newEmployee = {
        ...formData,
        totalSalary,
        documents,
        createdAt: new Date().toISOString(),
      };

      await onSubmit(newEmployee);
      // onClose is called by parent on success
    } catch (error) {
      console.error('Submit error:', error);
      setErrors({ submit: error.message || 'Failed to add employee. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[95vh] flex flex-col overflow-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-8 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Add New Employee</h2>
              <p className="text-white/90 text-sm mt-1">
                Step {currentStep} of {steps.length}: {steps[currentStep - 1].title}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="px-8 pt-5 pb-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    currentStep > step.number
                      ? 'bg-green-500 text-white shadow-md'
                      : currentStep === step.number
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${currentStep > step.number ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-8 py-6" style={{ scrollbarWidth: 'thin' }}>
            {errors.submit && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{errors.submit}</p>
              </div>
            )}
            <CurrentStepComponent
              formData={formData}
              handleInputChange={handleInputChange}
              documents={documents}
              handleFileUpload={handleFileUpload}
              handleFileRemove={handleFileRemove}
              errors={errors}
              touched={touched}
            />
            <div className="h-8" />
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                currentStep === 1 || isSubmitting
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 shadow-sm'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />Back
            </button>

            <div className="text-sm text-gray-600 font-medium">Step {currentStep} of {steps.length}</div>

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all shadow-md disabled:opacity-50"
              >
                Next<ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all shadow-md disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Submitting...
                  </>
                ) : (
                  <><Check className="w-4 h-4" />Submit</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AddEmployeeWizard;