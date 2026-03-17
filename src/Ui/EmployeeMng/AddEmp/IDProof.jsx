// src/Ui/EmployeeMng/AddEmp/IDProof.jsx
import React from 'react';
import { Upload, Check, FileText, Shield, Image as ImageIcon, AlertCircle } from 'lucide-react';

const DocumentUpload = ({ documents, handleFileUpload, handleFileRemove, errors = {} }) => {
  const DocumentCard = ({ title, documentType, required = false, accept = 'image/*,application/pdf', icon, description }) => {
    const doc = documents[documentType];

    const onFileChange = (e) => {
      const file = e.target.files[0];
      if (file) handleFileUpload(documentType, file);
    };

    const getFileSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
      <div className="relative group">
        <div className={`rounded-xl p-5 border-2 transition-all duration-200 ${
          doc
            ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
            : errors[documentType]
            ? 'border-red-300 bg-red-50'
            : 'border-dashed border-gray-300 hover:border-blue-400 bg-white hover:bg-blue-50/30'
        }`}>
          <div className="text-center">
            {doc ? (
              <div className="space-y-3">
                <div className="w-14 h-14 mx-auto bg-green-500 rounded-full flex items-center justify-center shadow-md">
                  <Check className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 mb-1">{title}</div>
                  <div className="text-xs text-gray-600 truncate px-3 bg-white rounded py-1.5 border border-green-200">
                    {doc.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{getFileSize(doc.file.size)}</div>
                </div>
                {doc.preview && doc.file?.type?.startsWith('image/') && (
                  <div className="relative overflow-hidden rounded-lg border-2 border-green-200">
                    <img src={doc.preview} alt={title} className="max-h-40 w-full object-contain bg-white" />
                  </div>
                )}
                {doc.file?.type === 'application/pdf' && (
                  <div className="p-4 bg-white rounded-lg border-2 border-green-200">
                    <FileText className="w-12 h-12 mx-auto text-red-500" />
                    <div className="text-xs text-gray-700 font-medium mt-2">PDF Document</div>
                  </div>
                )}
                <div className="flex gap-2 justify-center pt-1">
                  <label className="cursor-pointer">
                    <span className="text-xs text-green-700 hover:text-green-800 font-semibold px-4 py-2 bg-green-100 rounded-lg hover:bg-green-200 transition-all inline-block">
                      Replace
                    </span>
                    <input type="file" accept={accept} onChange={onFileChange} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleFileRemove(documentType)}
                    className="text-xs text-red-700 hover:text-red-800 font-semibold px-4 py-2 bg-red-100 rounded-lg hover:bg-red-200 transition-all"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="relative">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-all duration-200">
                    {icon}
                  </div>
                  {required && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 mb-0.5">
                    {title}{required && <span className="text-red-500 ml-1">*</span>}
                  </div>
                  {description && <div className="text-xs text-gray-600 mt-1">{description}</div>}
                  <div className="text-xs text-gray-500 mt-2">PNG, JPG, PDF • Max 5MB</div>
                </div>
                <label className="cursor-pointer">
                  <span className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all inline-block shadow-sm hover:shadow-md">
                    Choose File
                  </span>
                  <input type="file" accept={accept} onChange={onFileChange} className="hidden" />
                </label>
              </div>
            )}
          </div>
        </div>
        {errors[documentType] && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{errors[documentType]}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full mb-3 shadow-lg">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Document Upload</h2>
        <p className="text-gray-600 text-sm">Upload required documents for verification</p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 mb-1">Required Documents</p>
            <p className="text-blue-700">Employee Photo, Aadhar Card, and Bank Passbook are mandatory. PAN Card is optional.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DocumentCard
          title="Employee Photo"
          documentType="photo"
          required={true}
          accept="image/*"
          description="Recent passport-size photo"
          icon={<ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" />}
        />
        <DocumentCard
          title="Aadhar Card"
          documentType="aadharCard"
          required={true}
          accept="image/*,application/pdf"
          description="Front and back sides"
          icon={<FileText className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" />}
        />
        <DocumentCard
          title="Bank Passbook / Cancelled Cheque"
          documentType="bankPassbook"
          required={true}
          accept="image/*,application/pdf"
          description="For account verification"
          icon={<FileText className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" />}
        />
        <DocumentCard
          title="PAN Card"
          documentType="panCard"
          required={false}
          accept="image/*,application/pdf"
          description="Optional - if available"
          icon={<FileText className="w-8 h-8 text-gray-400 group-hover:text-blue-600 transition-colors" />}
        />
      </div>
    </div>
  );
};

export default DocumentUpload;