import React, { useState } from 'react';
import { ArrowLeft, Settings, Save, CheckCircle2 } from 'lucide-react';

export default function SettingsView({ onNavigate }) {
  const [workspaceName, setWorkspaceName] = useState('My workspace');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <button
          onClick={() => onNavigate('/discord')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-[#0F172A] transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Workspace Overview</span>
        </button>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
          Discord Workspace Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure general bot manager settings, notification webhooks, and permissions.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Settings updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Workspace Name
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-[#0F172A] mb-1.5">
            Audit Log Webhook URL (Optional)
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Receive workspace alerts directly in a private Discord channel.</p>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
