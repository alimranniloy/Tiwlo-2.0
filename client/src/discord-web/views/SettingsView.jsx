import React, { useState } from 'react';
import { ArrowLeft, Settings, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsView({ currentUser, onNavigate }) {
  const [consoleTitle, setConsoleTitle] = useState('Tiwlo Discord Console');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans">
      {/* 1. Google Cloud Header */}
      <div className="border-b border-[#DADCE0] pb-4">
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1A73E8] hover:text-[#174EA6] cursor-pointer mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Console Overview</span>
          <span className="text-[#BDC1C6]">/</span>
          <span className="text-[#5F6368]">Settings</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Console Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Configure general bot manager settings, webhook notification channels, and operational alerts.
        </p>
      </div>

      {saved && (
        <div className="p-3.5 rounded-lg bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-[13px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Console preferences synchronized and saved.</span>
        </div>
      )}

      {/* 2. Google Cloud Settings Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-5">
        <h2 className="text-[15px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
          General Properties
        </h2>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Console Scope Identifier
          </label>
          <input
            type="text"
            value={consoleTitle}
            onChange={(e) => setConsoleTitle(e.target.value)}
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] focus:outline-none focus:border-[#1A73E8]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-[#202124]">
            Discord Audit Webhook URL (Optional)
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full bg-white border border-[#DADCE0] rounded-md px-3 py-2 text-[13px] text-[#202124] font-mono focus:outline-none focus:border-[#1A73E8]"
          />
          <p className="text-[11px] text-[#5F6368]">Sends security alerts, bot status changes, and critical errors directly to your private Discord moderation channel.</p>
        </div>

        <div className="pt-4 border-t border-[#F1F3F4] flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
