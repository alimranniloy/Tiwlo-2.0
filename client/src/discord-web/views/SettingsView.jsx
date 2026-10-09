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
          Configure general bot manager settings, webhook notification channels, and operational alerts.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-[#C4EED0]/30 border border-[#C4EED0] text-[#072711] text-[13px] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#137333]" />
          <span>Console preferences synchronized and saved.</span>
        </div>
      )}

      {/* 2. Modern Google Settings Form Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
        <h2 className="text-[16px] font-medium text-[#1F1F1F] border-b border-[#F0F4F9] pb-3">
          General Properties
        </h2>

        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Console Scope Identifier
          </label>
          <input
            type="text"
            value={consoleTitle}
            onChange={(e) => setConsoleTitle(e.target.value)}
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-[#1F1F1F]">
            Discord Audit Webhook URL (Optional)
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full bg-[#F0F4F9] border border-transparent rounded-xl px-4 py-2.5 text-[13px] text-[#1F1F1F] font-mono focus:outline-none focus:bg-white focus:border-[#0B57D0] transition-colors"
          />
          <p className="text-[11px] text-[#747775]">Sends security alerts, bot status changes, and critical errors directly to your private Discord moderation channel.</p>
        </div>

        <div className="pt-4 border-t border-[#F0F4F9] flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
}
