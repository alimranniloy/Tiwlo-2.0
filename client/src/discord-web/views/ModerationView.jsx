import React, { useState } from 'react';
import { ArrowLeft, Shield, CheckCircle2, Save } from 'lucide-react';

export default function ModerationView({ onNavigate }) {
  const [spamFilter, setSpamFilter] = useState(true);
  const [linkFilter, setLinkFilter] = useState(false);
  const [profanityFilter, setProfanityFilter] = useState(true);
  const [mentionRaidFilter, setMentionRaidFilter] = useState(true);
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
          <span className="text-[#444746]">Moderation</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#1F1F1F] tracking-tight">
          Automated Moderation & Safety Policies
        </h1>
        <p className="text-xs sm:text-sm text-[#444746] mt-1">
          Enforce automated safeguards against spam, unauthorized links, mass mentions, and toxic content.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-[#C4EED0]/30 border border-[#C4EED0] text-[#072711] text-[13px] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#137333]" />
          <span>Security and moderation policies applied across all linked guilds.</span>
        </div>
      )}

      {/* 2. Policies Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#E0E2EC] rounded-2xl p-6 sm:p-8 space-y-5 shadow-none">
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
              checked={spamFilter}
              onChange={(e) => setSpamFilter(e.target.checked)}
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
              checked={linkFilter}
              onChange={(e) => setLinkFilter(e.target.checked)}
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
              checked={profanityFilter}
              onChange={(e) => setProfanityFilter(e.target.checked)}
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
              checked={mentionRaidFilter}
              onChange={(e) => setMentionRaidFilter(e.target.checked)}
              className="w-5 h-5 rounded-lg accent-[#0B57D0] cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#F0F4F9] flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Apply Rules</span>
          </button>
        </div>
      </form>
    </div>
  );
}
