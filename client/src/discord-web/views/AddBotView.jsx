import React from 'react';
import { ArrowLeft, Bot, Server, Shield } from 'lucide-react';

export default function AddBotView({ onBack }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-neutral-200/80 bg-white p-6 space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Official AI Bot
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-neutral-950">
            Managed Official Discord AI Bot
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600">
            Manual Discord bot creation and raw bot token entry have been replaced by Tiwlo&apos;s centralized Official Discord AI Bot. Simply activate a paid subscription package, click <strong>Install Tiwlo AI Bot to Discord Server</strong>, and configure your server rules.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs text-neutral-600">
        <Shield className="h-4 w-4 text-[#1ED760]" />
        <span>No Discord Developer Portal tokens or external bot hosting required.</span>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354]"
        >
          <Server className="h-3.5 w-3.5" />
          Go to Official AI Bot Hub
        </button>
      </div>
    </div>
  );
}
