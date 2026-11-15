import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Server,
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';
import DiscordPlanSelector from '../components/DiscordPlanModal';

export default function AddServerView({ overviewData, currentUser, onBack, onServerCreated, onReload }) {
  const [name, setName] = useState('');
  const [guildId, setGuildId] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [persona, setPersona] = useState('community');
  const [officialBotId, setOfficialBotId] = useState('');
  const [officialBots, setOfficialBots] = useState(overviewData?.officialBots || []);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const subscription = overviewData?.subscription || null;
  const isSubscribed = Boolean(subscription?.isActive);
  const selectedBot = officialBots.find((b) => b.id === officialBotId) || officialBots[0] || null;

  useEffect(() => {
    DiscordAPI.getOfficialBots()
      .then((list) => {
        setOfficialBots(list);
        if (list.length > 0 && !officialBotId) {
          const def = list.find((b) => b.isDefault) || list[0];
          setOfficialBotId(def.id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Discord server name is required.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    setNeedsUpgrade(false);
    try {
      await DiscordAPI.createServer({
        name: name.trim(),
        guildId: guildId.trim() || undefined,
        memberCount: Number(memberCount || 0) || 0,
        officialBotId: officialBotId || undefined,
        aiConfig: { persona },
      });
      await onServerCreated?.();
    } catch (err) {
      setErrorMsg(err.message || 'Could not bind Discord server.');
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.code === 'LIMIT_EXCEEDED') {
        setNeedsUpgrade(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Connected Servers
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700">
            <Server className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-neutral-950">
              Install &amp; Bind Discord Server
            </h1>
            <p className="text-xs text-neutral-500">
              Invite Tiwlo&apos;s Official Discord AI Bot via OAuth2, then register your Discord Server under your subscription.
            </p>
          </div>
        </div>
      </div>

      {(!isSubscribed || needsUpgrade) && (
        <div className="rounded-xl border border-amber-200 bg-white p-5 space-y-4">
          <div className="flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                {needsUpgrade ? 'Subscription Upgrade Required' : 'Paid Discord Bot Subscription Required'}
              </p>
              <p className="mt-0.5 text-neutral-600">
                {errorMsg || 'Select a paid Discord Bot package using Tiwlo Credits below to bind your server.'}
              </p>
            </div>
          </div>
          <DiscordPlanSelector
            currentUser={currentUser}
            subscription={subscription}
            onActivated={async () => {
              setNeedsUpgrade(false);
              setErrorMsg('');
              await onReload?.();
            }}
          />
        </div>
      )}

      {isSubscribed && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-neutral-200/80 bg-white p-6">
          {/* OAuth2 Step */}
          <div className="rounded-xl border border-emerald-200 bg-[#1ED760]/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <Bot className="h-4 w-4 text-[#1ED760]" />
                <span>Step A · Invite {selectedBot?.name || 'Official Tiwlo AI Bot'} to your Discord Server</span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Authorize the Official Tiwlo Bot on Discord first so slash commands and AI listeners are active in your server.
              </p>
            </div>
            {selectedBot?.inviteUrl && (
              <a
                href={selectedBot.inviteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Install Tiwlo AI Bot to Discord Server
              </a>
            )}
          </div>

          {errorMsg && !needsUpgrade && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Discord Server Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tiwlo VIP Community"
                className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 text-sm outline-none focus:border-[#1ED760]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Discord Guild / Server ID
              </label>
              <input
                type="text"
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
                placeholder="e.g. 119283746509182736"
                className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 font-mono text-sm outline-none focus:border-[#1ED760]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Official Bot Instance
              </label>
              <select
                value={officialBotId}
                onChange={(e) => setOfficialBotId(e.target.value)}
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium outline-none focus:border-[#1ED760]"
              >
                {officialBots.length === 0 ? (
                  <option value="">Tiwlo Official AI Bot (Default)</option>
                ) : (
                  officialBots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name} ({bot.status})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Initial AI Persona
              </label>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium outline-none focus:border-[#1ED760]"
              >
                <option value="community">Community Assistant</option>
                <option value="support">Customer Support Agent</option>
                <option value="sales">E-Commerce &amp; Sales Concierge</option>
                <option value="moderation">Strict Community Moderator</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700">
                Approx. Member Count (optional)
              </label>
              <input
                type="number"
                min="0"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                placeholder="e.g. 250"
                className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 text-sm outline-none focus:border-[#1ED760]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <button
              type="button"
              onClick={onBack}
              className="h-9 rounded-xl border border-neutral-200/80 px-4 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {submitting ? 'Binding Server...' : 'Bind Server & Configure AI'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
