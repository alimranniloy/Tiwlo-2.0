import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function SettingsView({ currentUser, onNavigate }) {
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
          <span className="text-[#444746]">Settings</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Console Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Account details are shown here; configurable console preferences and webhooks are not implemented yet.
        </p>
      </div>

      <div className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-4">
        <h2 className="text-[16px] font-medium text-[#1F1F1F]">Account</h2>
        <p className="text-[13px] text-[#444746]">Name: {currentUser?.name || currentUser?.storeName || 'Not provided'}</p>
        <p className="text-[13px] text-[#444746]">Email: {currentUser?.email || 'Not provided'}</p>
        <p className="text-[12px] text-[#747775]">Discord webhook delivery and console preference storage are unavailable until a backend settings API is added.</p>
      </div>
    </div>
  );
}
