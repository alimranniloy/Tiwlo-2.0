import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Top App Bar for Identity Verification (Arrow + Title)
 */
export default function VerificationHeader({
  title = "Identity Verification",
  onBack = null,
  showBack = true,
  className = ""
}) {
  return (
    <div className={`w-full flex items-center justify-between px-5 pt-5 pb-2 relative select-none ${className}`}>
      {/* Left Back Arrow */}
      {showBack && onBack ? (
        <button
          onClick={onBack}
          type="button"
          aria-label="Go back"
          className="w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-slate-900 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
        </button>
      ) : showBack ? (
        <div className="w-8 h-8 -ml-1 flex items-center justify-center text-slate-800">
          <ArrowLeft className="w-5 h-5 text-slate-800" strokeWidth={2.2} />
        </div>
      ) : (
        <div className="w-8 h-8" />
      )}

      {/* Center Title */}
      <h1 className="text-[16px] font-semibold text-slate-900 tracking-tight text-center">
        {title}
      </h1>

      {/* Right optical spacer */}
      <div className="w-8 h-8" />
    </div>
  );
}
