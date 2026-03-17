// src/Ui/EmployeeMng/GenerateLink.jsx
import React, { useState } from 'react';
import { X, AlertCircle, Copy, Check, ExternalLink, Loader, Link2, Calendar, Mail } from 'lucide-react';
import employeeService from '../../services/employeeService';

const PublicLinkModal = ({ onClose, showToast = () => {} }) => {
  const [step, setStep] = useState('input'); // 'input' | 'generating' | 'success'
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [linkData, setLinkData] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const validateEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const handleGenerateLink = async () => {
    setEmailError('');
    setGenerateError('');

    // Email is optional — we can generate without it
    if (email.trim() && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    try {
      setStep('generating');

      const response = await employeeService.generateRegistrationLink({
        employeeEmail: email.trim() || null,
        expiresInDays: 7,
      });

      if (response.success) {
        setLinkData(response.data);
        setStep('success');
        showToast('Registration link generated successfully!', 'success');
      } else {
        throw new Error(response.message || 'Failed to generate link');
      }
    } catch (error) {
      console.error('Error generating link:', error);
      setStep('input');
      setGenerateError(error.message || 'Failed to generate registration link. Please try again.');
    }
  };

  const handleCopyLink = () => {
    if (!linkData?.registrationUrl) return;
    navigator.clipboard.writeText(linkData.registrationUrl).catch(() => {
      const el = document.createElement('textarea');
      el.value = linkData.registrationUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setLinkCopied(true);
    showToast('Link copied to clipboard!', 'success');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleOpenLink = () => {
    if (linkData?.registrationUrl) {
      window.open(linkData.registrationUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">

        {/* Header */}
        <div className="bg-blue-600 text-white px-8 py-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 rounded-xl p-2">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">
                {step === 'success' ? 'Link Generated!' : 'Generate Registration Link'}
              </h3>
              <p className="text-blue-100 text-sm mt-0.5">
                {step === 'success'
                  ? 'Share this link for employee self-registration'
                  : 'Create a one-time registration link for an employee'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-700 rounded-lg transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8">

          {/* Step 1: Input */}
          {step === 'input' && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Employee Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); setGenerateError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateLink()}
                    placeholder="employee@example.com (optional)"
                    autoFocus
                    className={`w-full pl-11 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                      emailError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />{emailError}
                  </p>
                )}
              </div>

              {generateError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-800">{generateError}</p>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> The link expires in 7 days and can only be used once. The employee's submission will require admin approval before they are added to the system.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleGenerateLink}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <Link2 className="w-4 h-4" />Generate Link
                </button>
              </div>
            </>
          )}

          {/* Step 2: Generating */}
          {step === 'generating' && (
            <div className="text-center py-10">
              <Loader className="w-14 h-14 text-blue-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating Link...</h3>
              <p className="text-gray-500 text-sm">Please wait</p>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && linkData && (
            <>
              <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 rounded-full p-1">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-800">Link Generated Successfully!</p>
                    {linkData.employeeEmail && (
                      <p className="text-xs text-green-600 mt-0.5">For: {linkData.employeeEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Link display */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Registration Link</p>
                <div className="flex items-start gap-3">
                  <div className="flex-1 font-mono text-xs text-blue-600 bg-white px-4 py-3 rounded-lg border border-gray-200 break-all">
                    {linkData.registrationUrl}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className={`flex-shrink-0 px-4 py-3 rounded-lg font-medium flex items-center gap-2 transition-all text-sm ${
                      linkCopied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {linkCopied ? <><Check className="w-4 h-4" />Copied!</> : <><Copy className="w-4 h-4" />Copy</>}
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Expires: {new Date(linkData.expiresAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Important notes */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200 mb-6">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">How it works</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Employee fills the form using this link</li>
                    <li>• Submission appears in <strong>Pending Approvals</strong> tab</li>
                    <li>• Admin reviews and approves or rejects</li>
                    <li>• Approved employees get an Employee ID and appear in the dashboard</li>
                    <li>• Link expires in <strong>7 days</strong> and can only be used <strong>once</strong></li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleOpenLink}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />Open Link
                </button>
                <button onClick={onClose} className="px-8 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all text-sm">
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicLinkModal;