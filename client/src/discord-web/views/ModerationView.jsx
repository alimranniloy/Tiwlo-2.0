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
          <span className="text-[#5F6368]">Moderation</span>
        </button>

        <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
          Automated Moderation & Safety Policies
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
          Enforce automated safeguards against spam, unauthorized links, mass mentions, and toxic content.
        </p>
      </div>

      {saved && (
        <div className="p-3.5 rounded-lg bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] text-[13px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Security and moderation policies applied across all linked guilds.</span>
        </div>
      )}

      {/* 2. Policies Card */}
      <form onSubmit={handleSave} className="bg-white border border-[#DADCE0] rounded-lg p-6 sm:p-7 space-y-5">
        <h2 className="text-[15px] font-medium text-[#202124] border-b border-[#F1F3F4] pb-2">
          Active Defense Rules
        </h2>

        <div className="space-y-4 divide-y divide-[#F1F3F4]">
          <div className="flex items-center justify-between pt-3 first:pt-0">
            <div>
              <h4 className="text-[13px] font-medium text-[#202124]">Anti-Spam Rate Limiter</h4>
              <p className="text-[12px] text-[#5F6368]">Temporarily isolates users sending more than 5 messages within 3 seconds.</p>
            </div>
            <input
              type="checkbox"
              checked={spamFilter}
              onChange={(e) => setSpamFilter(e.target.checked)}
              className="w-4 h-4 rounded border-[#DADCE0] accent-[#1A73E8] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <h4 className="text-[13px] font-medium text-[#202124]">Unauthorized Invites & Links Shield</h4>
              <p className="text-[12px] text-[#5F6368]">Intercepts third-party Discord invitations and unverified link redirects.</p>
            </div>
            <input
              type="checkbox"
              checked={linkFilter}
              onChange={(e) => setLinkFilter(e.target.checked)}
              className="w-4 h-4 rounded border-[#DADCE0] accent-[#1A73E8] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <h4 className="text-[13px] font-medium text-[#202124]">Profanity & Toxic Vocabulary Filter</h4>
              <p className="text-[12px] text-[#5F6368]">Automated redaction of offensive terms based on machine learning classifications.</p>
            </div>
            <input
              type="checkbox"
              checked={profanityFilter}
              onChange={(e) => setProfanityFilter(e.target.checked)}
              className="w-4 h-4 rounded border-[#DADCE0] accent-[#1A73E8] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <h4 className="text-[13px] font-medium text-[#202124]">Mass Mention & Raid Protection</h4>
              <p className="text-[12px] text-[#5F6368]">Suppresses messages mentioning more than 4 roles or accounts simultaneously.</p>
            </div>
            <input
              type="checkbox"
              checked={mentionRaidFilter}
              onChange={(e) => setMentionRaidFilter(e.target.checked)}
              className="w-4 h-4 rounded border-[#DADCE0] accent-[#1A73E8] cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#F1F3F4] flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Apply Rules</span>
          </button>
        </div>
      </form>
    </div>
  );
}
