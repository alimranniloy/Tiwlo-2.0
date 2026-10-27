import React from 'react';
import { X } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';

/**
 * Step 6: Verification Failed
 * Screen 6 in reference mockup
 */
export default function VerificationFailedStep({ onTryAgain = null, onContactSupport = null }) {
  const { failureReason, failureType, resetVerification } = useVerification();

  const handleTryAgain = () => {
    if (onTryAgain) {
      onTryAgain();
    } else {
      resetVerification();
    }
  };

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      window.location.href = '/help-support';
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-10 select-none">
      {/* Central Failed Illustration & Copy */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
        {/* Large Red Circular Badge with White X */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/25 ring-8 ring-rose-50">
            <X className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Title & Description */}
        <h2 className="text-[25px] font-bold text-slate-900 tracking-tight leading-snug">
          {failureType === 'connection'
            ? 'Connection problem'
            : failureType === 'service'
              ? 'Verification temporarily unavailable'
              : 'Verification Failed'}
        </h2>
        <p className="text-[14px] text-slate-500 font-normal mt-2.5 max-w-[290px] leading-relaxed">
          {failureReason || "We couldn't verify your identity. Please check your information and try again."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 space-y-3">
        {/* Try Again Button: White with blue border */}
        <button
          onClick={handleTryAgain}
          type="button"
          className="w-full py-3.5 px-4 bg-white border border-blue-600 hover:bg-blue-50/50 text-blue-600 font-semibold text-[15px] rounded-xl transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          Try Again
        </button>

        {/* Contact Support Link */}
        <div className="text-center pt-1">
          <button
            onClick={handleContactSupport}
            type="button"
            className="text-[13.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}
