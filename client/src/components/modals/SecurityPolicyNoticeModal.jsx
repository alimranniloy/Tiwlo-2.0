import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight, X, ExternalLink } from 'lucide-react';

export default function SecurityPolicyNoticeModal({
  isOpen,
  onClose,
  noticeData = {}
}) {
  if (!isOpen) return null;

  const {
    policyName = 'Tiwlo Platform Safety Policy',
    reason = 'The submitted content violated our platform standards and could not be published.',
    code = 'POLICY_VIOLATION',
    strikes = 1,
    actionTaken = 'WARNING',
    appealUrl = '/help-support'
  } = noticeData;

  const isCritical = actionTaken === 'DISABLED' || strikes >= 3;
  const isCooldown = actionTaken === 'COOLDOWN' || strikes === 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#202124] text-[#202124] dark:text-[#e8eaed] rounded-[24px] border border-[#dadce0] dark:border-[#3c4043] shadow-[0_8px_32px_rgba(0,0,0,0.2)] overflow-hidden transition-all select-none animate-in zoom-in-95 duration-200"
      >
        {/* Top Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-[#f1f3f4] dark:border-[#303134]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isCritical
                ? 'bg-red-50 dark:bg-red-950/40 text-[#d93025] dark:text-[#f28b82]'
                : isCooldown
                ? 'bg-amber-50 dark:bg-amber-950/40 text-[#f29900] dark:text-[#fdd663]'
                : 'bg-blue-50 dark:bg-blue-950/40 text-[#0b57d0] dark:text-[#8ab4f8]'
            }`}>
              {isCritical ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-[17px] sm:text-[19px] font-medium tracking-tight text-[#1f1f1f] dark:text-white leading-tight">
                {isCritical ? 'Account Security Notice' : 'Content Policy Violation'}
              </h2>
              <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                Automated Trust & Safety Enforcement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <p className="text-[14px] text-[#3c4043] dark:text-[#bdc1c6] leading-relaxed">
            Your item was blocked or removed because it violated Tiwlo's{' '}
            <strong className="text-[#1f1f1f] dark:text-white font-medium">
              {policyName}
            </strong>.
          </p>

          {/* Google Policy Detail Card */}
          <div className="p-4 rounded-xl bg-[#f8f9fa] dark:bg-[#1a1c1e] border border-[#dadce0] dark:border-[#3c4043] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#70757a] dark:text-[#9aa0a6]">
              <span>Reason for Removal</span>
              {strikes && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  strikes >= 3 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                  strikes === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  Strike {strikes} of 3
                </span>
              )}
            </div>
            <div className="text-[13px] font-medium text-[#d93025] dark:text-[#f28b82] leading-snug">
              {reason}
            </div>
          </div>

          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
            {isCritical ? (
              <p>Due to the severity of this violation, access has been restricted. A detailed notification has been dispatched to your verified email.</p>
            ) : isCooldown ? (
              <p>Your account is temporarily placed in cooldown. Further violations will result in permanent suspension across all services.</p>
            ) : (
              <p>Tiwlo strictly forbids weapons, adult content, harassment, illicit narcotics, and prohibited links. Please ensure all future uploads adhere to our platform guidelines.</p>
            )}
          </div>
        </div>

        {/* Bottom Actions: Google Material 3 Pill Buttons */}
        <div className="px-6 py-4 bg-[#f8f9fa] dark:bg-[#1a1c1e] border-t border-[#f1f3f4] dark:border-[#303134] flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (appealUrl) window.location.href = appealUrl;
            }}
            className="px-5 py-2 rounded-full border border-[#747775] text-[#0b57d0] dark:text-[#8ab4f8] hover:bg-white dark:hover:bg-[#303134] text-[13px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Learn more & appeal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white text-[13px] font-medium shadow-xs transition-all cursor-pointer"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}
