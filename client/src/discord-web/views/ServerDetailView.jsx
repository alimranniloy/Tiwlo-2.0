import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Loader2,
  Save,
  Shield,
  Sparkles,
  Terminal,
  Trash2,
  UserCheck,
  Zap,
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';
import DiscordPlanSelector from '../components/DiscordPlanModal';

const DEFAULT_CONFIG = {
  enabled: true,
  persona: 'community',
  systemPrompt: 'You are the Official Tiwlo AI Discord Assistant. Help community members politely, enforce server guidelines, and answer questions accurately.',
  commandPrefix: '/',
  autoMod: {
    antiSpam: true,
    blockUnauthorizedLinks: true,
    raidProtection: false,
    profanityFilter: true,
  },
  welcome: {
    enabled: true,
    channelName: '#welcome',
    message: 'Welcome to {server}, {user}! Please check the rules and verify your account.',
    autoRoleName: 'Member',
    verificationEnabled: false,
  },
  slashCommands: {
    askAi: true,
    help: true,
    ticket: true,
    verify: false,
    catalog: false,
  },
  allowedChannels: [],
};

export default function ServerDetailView({
  serverId,
  overviewData,
  currentUser,
  onBack,
  onServerUpdated,
  onServerDeleted,
}) {
  const [server, setServer] = useState(null);
  const [aiConfig, setAiConfig] = useState(DEFAULT_CONFIG);
  const [channelsText, setChannelsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const subscription = overviewData?.subscription || null;
  const commandsLimit = Number(subscription?.limits?.monthlyCommandsLimit || 2500);
  const commandsUsed = Number(subscription?.usage?.monthlyCommands || 0);
  const autoModIncluded = Boolean(subscription?.limits?.autoModEnabled);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    DiscordAPI.getServerById(serverId)
      .then((data) => {
        if (cancelled) return;
        setServer(data);
        const cfg = {
          ...DEFAULT_CONFIG,
          ...(data.aiConfig || {}),
          autoMod: { ...DEFAULT_CONFIG.autoMod, ...(data.aiConfig?.autoMod || {}) },
          welcome: { ...DEFAULT_CONFIG.welcome, ...(data.aiConfig?.welcome || {}) },
          slashCommands: { ...DEFAULT_CONFIG.slashCommands, ...(data.aiConfig?.slashCommands || {}) },
        };
        setAiConfig(cfg);
        setChannelsText(Array.isArray(cfg.allowedChannels) ? cfg.allowedChannels.join(', ') : '');
      })
      .catch((err) => {
        if (!cancelled) setStatusBanner({ type: 'error', text: err.message || 'Could not load server.' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const handleSave = async () => {
    setSaving(true);
    setStatusBanner(null);
    try {
      const payload = {
        ...aiConfig,
        allowedChannels: channelsText
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      };
      const res = await DiscordAPI.saveServerAiConfig(serverId, payload);
      setServer(res.server);
      setStatusBanner({ type: 'success', text: res.message || 'Official AI Bot server settings saved.' });
      await onServerUpdated?.();
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message || 'Could not save server configuration.' });
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.code === 'FEATURE_NOT_IN_PLAN') {
        setShowPlanModal(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setStatusBanner(null);
    try {
      const res = await DiscordAPI.simulateServerCommand(serverId, 1);
      if (res.server) setServer(res.server);
      setStatusBanner({ type: 'success', text: res.reply || 'Official AI command simulated.' });
      await onServerUpdated?.();
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message || 'Command simulation blocked.' });
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.code === 'LIMIT_EXCEEDED') {
        setShowPlanModal(true);
      }
    } finally {
      setSimulating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Disconnect "${server?.name || 'this server'}" from Tiwlo Official AI Bot?`)) return;
    try {
      await DiscordAPI.deleteServer(serverId);
      await onServerDeleted?.();
      onBack();
    } catch (err) {
      setStatusBanner({ type: 'error', text: err.message || 'Could not disconnect server.' });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
        <div className="h-80 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-neutral-200/80 bg-white p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-neutral-900">Discord Server not found</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Servers
        </button>
      </div>
    );
  }

  const usagePct = Math.min(100, Math.round((commandsUsed / Math.max(1, commandsLimit)) * 100));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Connected Servers
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950">{server.name}</h1>
            <span className="font-mono text-xs text-neutral-400">#{server.guildId || server.id}</span>
            {server.isSuspended ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                Suspended by Admin
              </span>
            ) : (
              <span className="rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                Official Bot Linked
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={simulating || server.isSuspended}
            onClick={handleSimulate}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5 text-[#1ED760]" />
            {simulating ? 'Running...' : 'Simulate AI Command'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save AI Config'}
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
          statusBanner.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-emerald-200 bg-[#1ED760]/15 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            {statusBanner.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{statusBanner.text}</span>
          </div>
          <button type="button" onClick={() => setStatusBanner(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      {/* AI Quota Progress */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-semibold text-neutral-900">
            <Bot className="h-4 w-4 text-[#1ED760]" />
            <span>Monthly Official AI Commands &amp; Quota ({subscription?.planName || 'No Plan'})</span>
          </div>
          <span className="font-semibold tabular-nums text-neutral-800">
            {commandsUsed.toLocaleString()} / {commandsLimit.toLocaleString()} commands ({Number(server.commandsUsedMonth || 0).toLocaleString()} on this server)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-[#1ED760] transition-all" style={{ width: `${usagePct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AI Persona & System Prompt */}
        <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#1ED760]" />
              <h2 className="text-sm font-semibold text-neutral-950">AI Persona &amp; System Prompt</h2>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={aiConfig.enabled}
                onChange={(e) => setAiConfig((p) => ({ ...p, enabled: e.target.checked }))}
                className="h-4 w-4 accent-[#1ED760]"
              />
              AI Enabled
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Persona Mode</label>
              <select
                value={aiConfig.persona}
                onChange={(e) => setAiConfig((p) => ({ ...p, persona: e.target.value }))}
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium outline-none focus:border-[#1ED760]"
              >
                <option value="community">Community Assistant</option>
                <option value="support">Support Helpdesk</option>
                <option value="sales">Sales &amp; Product Guide</option>
                <option value="moderation">Strict Enforcer</option>
                <option value="custom">Custom Persona</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Legacy Prefix</label>
              <input
                type="text"
                maxLength={8}
                value={aiConfig.commandPrefix}
                onChange={(e) => setAiConfig((p) => ({ ...p, commandPrefix: e.target.value }))}
                className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 font-mono text-sm outline-none focus:border-[#1ED760]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">System Instructions</label>
            <textarea
              rows={4}
              value={aiConfig.systemPrompt}
              onChange={(e) => setAiConfig((p) => ({ ...p, systemPrompt: e.target.value }))}
              className="w-full rounded-xl border border-neutral-200/80 px-3 py-2 text-xs outline-none focus:border-[#1ED760]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Channel Restrictions (comma-separated channel IDs or #names, leave blank for all)
            </label>
            <input
              type="text"
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              placeholder="#general, #ai-help, #support"
              className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 text-xs outline-none focus:border-[#1ED760]"
            />
          </div>
        </div>

        {/* Auto-Moderation */}
        <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#1ED760]" />
              <h2 className="text-sm font-semibold text-neutral-950">Auto-Moderation Guards</h2>
            </div>
            {!autoModIncluded && (
              <button
                type="button"
                onClick={() => setShowPlanModal(true)}
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
              >
                Upgrade Plan for Auto-Mod
              </button>
            )}
          </div>

          <div className="space-y-3">
            {[
              { key: 'antiSpam', label: 'AI Anti-Spam Flood Shield', desc: 'Automatically throttles and deletes rapid spam bursts.' },
              { key: 'blockUnauthorizedLinks', label: 'Block Unauthorized Links & Phishing', desc: 'Filters suspicious invites and unverified external URLs.' },
              { key: 'profanityFilter', label: 'Toxicity & Profanity Filter', desc: 'Scans messages in real time for abusive language.' },
              { key: 'raidProtection', label: 'Anti-Raid Lockdown Mode', desc: 'Detects coordinated join spikes and slows new member invites.' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-neutral-100 p-3 hover:bg-neutral-50"
              >
                <div>
                  <p className="text-xs font-semibold text-neutral-900">{item.label}</p>
                  <p className="text-[11px] text-neutral-500">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(aiConfig.autoMod?.[item.key])}
                  onChange={(e) =>
                    setAiConfig((p) => ({
                      ...p,
                      autoMod: { ...p.autoMod, [item.key]: e.target.checked },
                    }))
                  }
                  className="mt-0.5 h-4 w-4 accent-[#1ED760]"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Welcome & Verification Workflows */}
        <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-[#1ED760]" />
              <h2 className="text-sm font-semibold text-neutral-950">Welcome &amp; Verification</h2>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
              <input
                type="checkbox"
                checked={Boolean(aiConfig.welcome?.enabled)}
                onChange={(e) =>
                  setAiConfig((p) => ({
                    ...p,
                    welcome: { ...p.welcome, enabled: e.target.checked },
                  }))
                }
                className="h-4 w-4 accent-[#1ED760]"
              />
              Enabled
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Welcome Channel</label>
              <input
                type="text"
                value={aiConfig.welcome?.channelName || ''}
                onChange={(e) =>
                  setAiConfig((p) => ({
                    ...p,
                    welcome: { ...p.welcome, channelName: e.target.value },
                  }))
                }
                className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 text-xs outline-none focus:border-[#1ED760]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Auto-Assign Role</label>
              <input
                type="text"
                value={aiConfig.welcome?.autoRoleName || ''}
                onChange={(e) =>
                  setAiConfig((p) => ({
                    ...p,
                    welcome: { ...p.welcome, autoRoleName: e.target.value },
                  }))
                }
                className="h-9 w-full rounded-xl border border-neutral-200/80 px-3 text-xs outline-none focus:border-[#1ED760]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Welcome Greeting Template</label>
            <textarea
              rows={2}
              value={aiConfig.welcome?.message || ''}
              onChange={(e) =>
                setAiConfig((p) => ({
                  ...p,
                  welcome: { ...p.welcome, message: e.target.value },
                }))
              }
              className="w-full rounded-xl border border-neutral-200/80 px-3 py-2 text-xs outline-none focus:border-[#1ED760]"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={Boolean(aiConfig.welcome?.verificationEnabled)}
              onChange={(e) =>
                setAiConfig((p) => ({
                  ...p,
                  welcome: { ...p.welcome, verificationEnabled: e.target.checked },
                }))
              }
              className="h-4 w-4 accent-[#1ED760]"
            />
            Require button verification before assigning Auto-Role
          </label>
        </div>

        {/* Slash Commands Toggles */}
        <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Terminal className="h-4 w-4 text-[#1ED760]" />
            <h2 className="text-sm font-semibold text-neutral-950">Slash Commands Toggles</h2>
          </div>

          <div className="space-y-2.5">
            {[
              { key: 'askAi', cmd: '/ask-ai', desc: 'Answers community questions using your custom AI persona.' },
              { key: 'help', cmd: '/help', desc: 'Displays server commands and guidelines card.' },
              { key: 'ticket', cmd: '/ticket', desc: 'Opens a private support ticket thread with staff.' },
              { key: 'verify', cmd: '/verify', desc: 'Interactive member verification flow.' },
              { key: 'catalog', cmd: '/catalog', desc: 'Shares linked Tiwlo store products directly inside Discord.' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-100 p-3 hover:bg-neutral-50"
              >
                <div>
                  <span className="font-mono text-xs font-semibold text-neutral-950">{item.cmd}</span>
                  <p className="text-[11px] text-neutral-500">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(aiConfig.slashCommands?.[item.key])}
                  onChange={(e) =>
                    setAiConfig((p) => ({
                      ...p,
                      slashCommands: { ...p.slashCommands, [item.key]: e.target.checked },
                    }))
                  }
                  className="h-4 w-4 accent-[#1ED760]"
                />
              </label>
            ))}
          </div>

          <div className="flex justify-end border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Disconnect Server
            </button>
          </div>
        </div>
      </div>

      {showPlanModal && (
        <DiscordPlanSelector
          isModal
          currentUser={currentUser}
          subscription={subscription}
          onClose={() => setShowPlanModal(false)}
          onActivated={async () => {
            await onServerUpdated?.();
          }}
        />
      )}
    </div>
  );
}
