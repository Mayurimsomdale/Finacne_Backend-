import React from 'react';
import { Upload, FileText, CreditCard, Building2, User, AlertCircle } from 'lucide-react';

const DocumentUploadStep = ({ formData, errors, onFileChange }) => {
  const handleFileSelect = (e, fieldName) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type (images and PDFs)
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        alert('Please upload only JPG, PNG, or PDF files');
        e.target.value = '';
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        e.target.value = '';
        return;
      }
      
      onFileChange(fieldName, file);
    }
  };

  const getFileName = (file) => {
    if (file instanceof File) {
      return file.name;
    }
    return file || 'No file chosen';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Upload</h2>
        <p className="text-gray-600">Please upload the required documents</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Document Guidelines:</p>
            <ul className="space-y-1">
              <li>• Accepted formats: JPG, PNG, PDF</li>
              <li>• Maximum file size: 5MB per document</li>
              <li>• Ensure documents are clear and readable</li>
              <li>• All documents must be valid and not expired</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Aadhar Card */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Aadhar Card <span className="text-red-500">*</span>
          </label>
          <div className={`border-2 border-dashed rounded-lg p-6 transition-all ${
            errors.aadharCard ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
          }`}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {formData.aadharCard ? getFileName(formData.aadharCard) : 'Upload Aadhar Card'}
                </p>
                <p className="text-xs text-gray-500">JPG, PNG or PDF (Max 5MB)</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileSelect(e, 'aadharCard')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Choose File</span>
                </div>
              </label>
            </div>
          </div>
          {errors.aadharCard && (
            <p className="mt-1 text-sm text-red-500">{errors.aadharCard}</p>
          )}
        </div>

        {/* ID Photo */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ID Photo (Passport Size) <span className="text-red-500">*</span>
          </label>
          <div className={`border-2 border-dashed rounded-lg p-6 transition-all ${
            errors.idPhoto ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
          }`}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <User className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {formData.idPhoto ? getFileName(formData.idPhoto) : 'Upload ID Photo'}
                </p>
                <p className="text-xs text-gray-500">JPG, PNG (Max 5MB)</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'idPhoto')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Choose File</span>
                </div>
              </label>
            </div>
          </div>
          {errors.idPhoto && (
            <p className="mt-1 text-sm text-red-500">{errors.idPhoto}</p>
          )}
        </div>

        {/* Bank Passbook */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Bank Passbook <span className="text-red-500">*</span>
          </label>
          <div className={`border-2 border-dashed rounded-lg p-6 transition-all ${
            errors.bankPassbook ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
          }`}>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {formData.bankPassbook ? getFileName(formData.bankPassbook) : 'Upload Bank Passbook'}
                </p>
                <p className="text-xs text-gray-500">JPG, PNG or PDF (Max 5MB)</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileSelect(e, 'bankPassbook')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Choose File</span>
                </div>
              </label>
            </div>
          </div>
          {errors.bankPassbook && (
            <p className="mt-1 text-sm text-red-500">{errors.bankPassbook}</p>
          )}
        </div>

        {/* PAN Card - Optional */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            PAN Card <span className="text-gray-500 text-xs">(Optional)</span>
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-all">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {formData.panCard ? getFileName(formData.panCard) : 'Upload PAN Card'}
                </p>
                <p className="text-xs text-gray-500">JPG, PNG or PDF (Max 5MB)</p>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileSelect(e, 'panCard')}
                  className="hidden"
                />
                <div className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Choose File</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
        <p className="text-sm text-yellow-800">
          <strong>Important:</strong> Please ensure all uploaded documents are clear, valid, and match the information provided in previous steps.
        </p>
      </div>
    </div>
  );
};

export default DocumentUploadStep;