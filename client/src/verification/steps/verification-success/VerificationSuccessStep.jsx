import React from 'react';
import { Check } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';

/**
 * Step 5: Verification Successful
 * Screen 5 in reference mockup
 */
export default function VerificationSuccessStep({ onContinue = null }) {
  const { onComplete, resetVerification } = useVerification();

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else if (onComplete) {
      onComplete();
    } else {
      // Default: Return to main dashboard
      try {
        window.location.href = '/dashboard';
      } catch {
        resetVerification();
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-10 select-none">
      {/* Central Success Illustration & Copy */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
        {/* Large Green Circular Badge with White Checkmark */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-8 ring-emerald-50">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
        </div>

        {/* Title & Description */}
        <h2 className="text-[25px] font-bold text-slate-900 tracking-tight leading-snug">
          Verification Successful
        </h2>
        <p className="text-[14px] text-slate-500 font-normal mt-2.5 max-w-[290px] leading-relaxed">
          Your selfie matched the face in the submitted document image. This check does not verify whether the document is genuine.
        </p>
      </div>

      {/* Action Button */}
      <div className="pt-4">
        <button
          onClick={handleContinue}
          type="button"
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-[15px] rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
