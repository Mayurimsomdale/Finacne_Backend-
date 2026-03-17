import React from 'react';
import { CheckCircle, Home } from 'lucide-react';

const SuccessMessage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full text-center">
        <div className="mb-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Registration Complete!</h1>
          <p className="text-lg text-gray-600 mb-2">
            Thank you for submitting your information.
          </p>
          <p className="text-gray-500">
            Your details have been successfully received and are being processed by our HR team.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-3">What happens next?</h3>
          <ul className="text-left text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>Our HR team will review your information within 1-2 business days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>You'll receive a confirmation email with next steps</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">3.</span>
              <span>If any additional information is needed, we'll contact you directly</span>
            </li>
          </ul>
        </div>

        <div className="text-sm text-gray-500 mb-6">
          <p>Reference Number: <span className="font-mono font-semibold text-gray-700">REG-{Date.now().toString().slice(-8)}</span></p>
          <p className="mt-1">Please save this for your records</p>
        </div>

        <div className="pt-6 border-t">
          <p className="text-sm text-gray-600 mb-4">
            Have questions? Contact HR at <a href="mailto:hr@company.com" className="text-blue-600 hover:underline font-medium">hr@company.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessMessage;