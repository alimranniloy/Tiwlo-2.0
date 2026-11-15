import React, { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Server,
  Shield,
  Sparkles,
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';
import DiscordPlanSelector from '../components/DiscordPlanModal';

export default function BotsView({ overviewData, currentUser, onNavigate, onReload }) {
  const [officialBots, setOfficialBots] = useState(overviewData?.officialBots || []);
  const [loading, setLoading] = useState(!overviewData?.officialBots);
  const [copiedId, setCopiedId] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const subscription = overviewData?.subscription || null;
  const isSubscribed = Boolean(subscription?.isActive);

  useEffect(() => {
    let cancelled = false;
    DiscordAPI.getOfficialBots()
      .then((list) => {
        if (!cancelled) setOfficialBots(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [overviewData]);

  const copyInvite = async (url, id) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700">
              <Bot className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
              Official Tiwlo Discord AI Bot
            </h1>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Tiwlo hosts and operates our verified Official Discord AI Bot infrastructure. No bot tokens or custom hosting setup needed — simply install via OAuth2 and bind your Discord server.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (isSubscribed ? onNavigate('/discord/servers/new') : setShowPlanModal(true))}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354]"
        >
          <Plus className="h-3.5 w-3.5" />
          {isSubscribed ? 'Bind Discord Server' : 'Activate Plan First'}
        </button>
      </div>

      {!isSubscribed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-amber-900">
            <p className="font-semibold">Paid Subscription Required</p>
            <p className="mt-0.5 text-amber-800">
              Activate a paid Discord AI Bot plan with Tiwlo Credits before connecting your Discord server to our Official AI Bot.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="inline-flex h-8 shrink-0 items-center rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-800"
          >
            View Paid Plans
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
          ))}
        </div>
      ) : officialBots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-10 text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 text-neutral-300" />
          <h3 className="text-sm font-semibold text-neutral-900">Official Discord AI Bot Coming Soon</h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">
            Your workspace administrator has not published an active Official Discord AI Bot instance yet. Once configured in Admin Panel, the OAuth2 Install CTA will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {officialBots.map((bot) => (
            <div
              key={bot.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200/80 bg-white p-5"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1ED760] text-black">
                      <Bot className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-neutral-950">{bot.name}</h2>
                        {bot.isDefault && (
                          <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Official Primary
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-neutral-500">
                        App ID: {bot.clientId}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <CheckCircle2 className="h-3 w-3" /> {bot.status === 'active' ? 'Online' : 'Maintenance'}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-neutral-600">{bot.description}</p>

                {Array.isArray(bot.features) && bot.features.length > 0 && (
                  <div className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2">
                    {bot.features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-neutral-700">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#1ED760]" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
                  <Shield className="h-3.5 w-3.5 text-[#1ED760]" />
                  <span>Credentials &amp; uptime centrally managed by Tiwlo</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                {bot.inviteUrl && isSubscribed ? (
                  <a
                    href={bot.inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Install Tiwlo AI Bot to Discord Server
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(true)}
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354]"
                  >
                    Activate Subscription to Install
                  </button>
                )}

                {bot.inviteUrl && isSubscribed && (
                  <button
                    type="button"
                    onClick={() => copyInvite(bot.inviteUrl, bot.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    {copiedId === bot.id ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === bot.id ? 'Copied' : 'Copy Link'}
                  </button>
                )}

                {isSubscribed && (
                  <button
                    type="button"
                    onClick={() => onNavigate('/discord/servers/new')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    <Server className="h-3.5 w-3.5" />
                    Bind Server
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPlanModal && (
        <DiscordPlanSelector
          isModal
          currentUser={currentUser}
          subscription={subscription}
          onClose={() => setShowPlanModal(false)}
          onActivated={async () => {
            await onReload?.();
          }}
        />
      )}
    </div>
  );
}
