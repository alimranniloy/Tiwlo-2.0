import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function ModerationView({ onNavigate }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans bg-white">
      {/* 1. Modern Google Header */}
      <div className="border-b border-[#E0E2EC] pb-5">
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer mb-2.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Console Overview</span>
          <span className="text-[#C4C7C5]">/</span>
          <span className="text-[#444746]">Moderation</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Automated Moderation & Safety Policies
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Moderation policy configuration is unavailable because no live Discord bot worker is connected.
        </p>
      </div>

      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
          Active Defense Rules
        </h2>

        <div className="space-y-4 divide-y divide-[#F0F4F9]">
          <div className="flex items-center justify-between pt-4 first:pt-0">
            <div>
              <h4 className="text-[13px] font-medium text-[#1F1F1F]">Anti-Spam Rate Limiter</h4>
              <p className="text-[12px] text-[#747775]">Temporarily isolates users sending more than 5 messages within 3 seconds.</p>
            </div>
            <input
              type="checkbox"
              checked={false}
              disabled
              className="w-5 h-5 rounded-lg accent-[#0B57D0] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <h4 className="text-[13px] font-medium text-[#1F1F1F]">Unauthorized Invites & Links Shield</h4>
              <p className="text-[12px] text-[#747775]">Intercepts third-party Discord invitations and unverified link redirects.</p>
            </div>
            <input
              type="checkbox"
              checked={false}
              disabled
              className="w-5 h-5 rounded-lg accent-[#0B57D0] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <h4 className="text-[13px] font-medium text-[#1F1F1F]">Profanity & Toxic Vocabulary Filter</h4>
              <p className="text-[12px] text-[#747775]">Automated redaction of offensive terms based on machine learning classifications.</p>
            </div>
            <input
              type="checkbox"
              checked={false}
              disabled
              className="w-5 h-5 rounded-lg accent-[#0B57D0] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div>
              <h4 className="text-[13px] font-medium text-[#1F1F1F]">Mass Mention & Raid Protection</h4>
              <p className="text-[12px] text-[#747775]">Suppresses messages mentioning more than 4 roles or accounts simultaneously.</p>
            </div>
            <input
              type="checkbox"
              checked={false}
              disabled
              className="w-5 h-5 rounded-lg accent-[#0B57D0] cursor-pointer"
            />
          </div>
        </div>

        <p className="pt-4 border-t border-[#F0F4F9] text-[12px] text-[#747775]">These rules are informational only; no policies are saved or enforced.</p>
      </div>
    </div>
  );
}
