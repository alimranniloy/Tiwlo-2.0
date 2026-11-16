import React from 'react';
import { Check, Clock, ShieldCheck } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';

/**
 * Step 5: Verification Successful or Submitted for Manual Review
 */
export default function VerificationSuccessStep({ onContinue = null }) {
  const {
    onComplete,
    resetVerification,
    verificationResult,
    manualReviewInfo,
  } = useVerification();

  const isManualReview = verificationResult === 'manual_review';

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else if (onComplete) {
      onComplete();
    } else {
      try {
        window.location.href = '/dashboard';
      } catch {
        resetVerification();
      }
    }
  };

  if (isManualReview) {
    const referenceId =
      manualReviewInfo?.referenceId ||
      manualReviewInfo?.reviewId ||
      manualReviewInfo?.requestId ||
      null;

    return (
      <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-10 select-none bg-white">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
          {/* Clean Monochrome / Tiwlo-Emerald Manual Review Badge (No yellow/amber borders) */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full border border-neutral-200 bg-neutral-50 flex items-center justify-center shadow-xs">
              <Clock className="w-9 h-9 text-neutral-800" strokeWidth={2.2} />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#1ED760] text-neutral-950 ring-4 ring-white shadow-xs">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.5} />
            </span>
          </div>

          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100/80 px-3 py-1 text-[11.5px] font-semibold text-neutral-700">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760]" />
            Pending Identity Review
          </span>

          <h2 className="text-[25px] font-bold text-neutral-900 tracking-tight leading-snug">
            Submitted for Manual Review
          </h2>
          <p className="text-[14px] text-neutral-500 font-normal mt-2.5 max-w-[320px] leading-relaxed">
            Your document and live selfie have been received and queued cleanly for our Identity Review team.
          </p>

          <div className="mt-5 w-full max-w-[320px] rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 text-left space-y-1.5">
            <p className="text-[12.5px] font-semibold text-neutral-900">
              What happens next?
            </p>
            <p className="text-[12px] leading-relaxed text-neutral-600">
              Our Identity Review team will review your submission shortly. Your access will restore automatically once approved.
            </p>
            {referenceId && (
              <p className="pt-1 text-[11.5px] font-medium text-neutral-500">
                Reference ID: <span className="font-mono text-neutral-900">{referenceId}</span>
              </p>
            )}
          </div>
        </div>

        <div className="pt-4">
          <button
            onClick={handleContinue}
            type="button"
            className="w-full py-3.5 px-4 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white font-semibold text-[15px] rounded-xl shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

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
        <h2 className="text-[25px] font-bold text-neutral-900 tracking-tight leading-snug">
          Verification Successful
        </h2>
        <p className="text-[14px] text-neutral-500 font-normal mt-2.5 max-w-[300px] leading-relaxed">
          Your identity document, face match, and live selfie check have been verified.
        </p>
      </div>

      {/* Action Button */}
      <div className="pt-4">
        <button
          onClick={handleContinue}
          type="button"
          className="w-full py-3.5 px-4 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white font-semibold text-[15px] rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
