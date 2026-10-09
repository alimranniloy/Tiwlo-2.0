import React, { useState } from 'react';
import { ArrowLeft, Shield, AlertTriangle, CheckCircle2, Save } from 'lucide-react';

export default function ModerationView({ onNavigate }) {
  const [spamFilter, setSpamFilter] = useState(true);
  const [linkFilter, setLinkFilter] = useState(false);
  const [profanityFilter, setProfanityFilter] = useState(true);
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
          Auto Moderation
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Automated rules to keep your Discord community safe, civil, and spam-free.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Moderation rules saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="space-y-4 divide-y divide-gray-100">
          <div className="flex items-center justify-between pt-3 first:pt-0">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">Anti-Spam Rate Limiter</h4>
              <p className="text-xs text-gray-500">Mutes users sending more than 5 messages within 3 seconds.</p>
            </div>
            <input
              type="checkbox"
              checked={spamFilter}
              onChange={(e) => setSpamFilter(e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">Unauthorized Links Shield</h4>
              <p className="text-xs text-gray-500">Deletes unauthorized invite links and suspicious URL domains.</p>
            </div>
            <input
              type="checkbox"
              checked={linkFilter}
              onChange={(e) => setLinkFilter(e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <h4 className="text-sm font-bold text-[#0F172A]">Profanity & Toxic Language Filter</h4>
              <p className="text-xs text-gray-500">Automatically censors or deletes messages with blocked keywords.</p>
            </div>
            <input
              type="checkbox"
              checked={profanityFilter}
              onChange={(e) => setProfanityFilter(e.target.checked)}
              className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Rules</span>
          </button>
        </div>
      </form>
    </div>
  );
}
