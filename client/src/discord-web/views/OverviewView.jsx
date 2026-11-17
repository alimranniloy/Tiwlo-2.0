import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  Shield,
  Sparkles,
  Terminal,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';
import DiscordPlanSelector from '../components/DiscordPlanModal';

function QuotaBar({ label, current, limit, unit = '' }) {
  const safeCurrent = Number(current || 0);
  const safeLimit = Math.max(1, Number(limit || 1));
  const pct = Math.min(100, Math.round((safeCurrent / safeLimit) * 100));
  const nearMax = pct >= 85;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-600">{label}</span>
        <span className="font-semibold tabular-nums text-neutral-900">
          {safeCurrent.toLocaleString()} / {safeLimit.toLocaleString()}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full transition-all ${nearMax ? 'bg-amber-500' : 'bg-[#1ED760]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function OverviewView({
  overviewData,
  loading,
  currentUser,
  subscriptionState,
  onNavigate,
  onNavigateBilling,
  onToggleAutoRenew,
  onReload,
}) {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [packages, setPackages] = useState(
    Array.isArray(subscriptionState?.packages) ? subscriptionState.packages : []
  );
  const [simulatingId, setSimulatingId] = useState(null);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [upgradingTier, setUpgradingTier] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const subscription = overviewData?.subscription || subscriptionState?.subscription || null;
  const tierInsight = subscriptionState?.tierInsight || overviewData?.tierInsight || null;
  const officialBots = Array.isArray(overviewData?.officialBots) ? overviewData.officialBots : [];
  const primaryBot = officialBots.find((b) => b.isDefault) || officialBots[0] || null;
  const servers = Array.isArray(overviewData?.servers) ? overviewData.servers : [];
  const activities = Array.isArray(overviewData?.recentActivities) ? overviewData.recentActivities : [];

  const isSubscribed = Boolean(subscription?.isActive);
  const serversLimit = Number(subscription?.limits?.maxServersPerBot || 0);
  const commandsLimit = Number(subscription?.limits?.monthlyCommandsLimit || 0);
  const commandsUsed = Number(subscription?.usage?.monthlyCommands || 0);
  const autoRenewEnabled = subscription?.autoRenew !== false;

  const serversPct = serversLimit > 0 ? Math.min(100, Math.round((servers.length / serversLimit) * 100)) : 0;
  const commandsPct = commandsLimit > 0 ? Math.min(100, Math.round((commandsUsed / commandsLimit) * 100)) : 0;
  const peakUsagePct = Number.isFinite(Number(tierInsight?.peakUsagePercent))
    ? Number(tierInsight.peakUsagePercent)
    : Math.max(serversPct, commandsPct);

  const sortedPackages = [...packages].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  const currentPrice = Number(subscription?.price || 0);
  const nextUpgradePlan =
    (tierInsight?.recommendedPlanId &&
      sortedPackages.find((p) => p.planId === tierInsight.recommendedPlanId && p.planId !== subscription?.planId)) ||
    sortedPackages.find((p) => Number(p.price || 0) > currentPrice) ||
    null;
  const shouldSuggestUpgrade = Boolean(
    isSubscribed &&
      nextUpgradePlan &&
      (peakUsagePct >= 75 || tierInsight?.shouldUpgrade)
  );

  useEffect(() => {
    DiscordAPI.getPackages().then(setPackages).catch(() => {});
  }, []);

  const handleToggleAutoRenewClick = async () => {
    if (!onToggleAutoRenew || togglingAutoRenew) return;
    setTogglingAutoRenew(true);
    setToastMsg(null);
    try {
      const next = !autoRenewEnabled;
      await onToggleAutoRenew(next);
      setToastMsg({
        type: 'success',
        text: `Monthly auto-renewal ${next ? 'enabled' : 'disabled'}.`,
      });
    } catch (err) {
      setToastMsg({ type: 'error', text: err.message || 'Could not update auto-renewal preference.' });
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  const handleOneClickUpgrade = async (targetPlan) => {
    if (!targetPlan || upgradingTier) return;
    setUpgradingTier(true);
    setToastMsg(null);
    try {
      const res = await DiscordAPI.purchaseSubscription(targetPlan.planId, autoRenewEnabled);
      setToastMsg({
        type: 'success',
        text: res.message || `Upgraded to ${targetPlan.planName}!`,
      });
      window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
      await onReload?.();
    } catch (err) {
      setToastMsg({ type: 'error', text: err.message || 'Could not upgrade plan.' });
      setShowPlanModal(true);
    } finally {
      setUpgradingTier(false);
    }
  };

  const handleSimulateAi = async (server) => {
    setSimulatingId(server.id);
    setToastMsg(null);
    try {
      const res = await DiscordAPI.simulateServerCommand(server.id, 1);
      setToastMsg({ type: 'success', text: res.reply || `AI command executed in ${server.name}.` });
      await onReload?.();
    } catch (err) {
      setToastMsg({ type: 'error', text: err.message || 'Could not execute AI command.' });
      if (err.code === 'SUBSCRIPTION_REQUIRED' || err.code === 'LIMIT_EXCEEDED') {
        setShowPlanModal(true);
      }
    } finally {
      setSimulatingId(null);
    }
  };

  if (loading && !overviewData) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-56 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
          <div className="h-56 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700">
              <Bot className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
              Tiwlo Official Discord AI Bot
            </h1>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Activate a paid Tiwlo Credits package, invite our centralized Official AI Bot to your Discord server(s), and customize per-server AI behavior.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
          >
            <CreditCard className="h-3.5 w-3.5 text-[#1ED760]" />
            {isSubscribed ? 'Manage / Upgrade Plan' : 'Choose Subscription'}
          </button>
          <button
            type="button"
            onClick={() => (isSubscribed ? onNavigate('/discord/servers/new') : setShowPlanModal(true))}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354]"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect Discord Server
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
          toastMsg.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-emerald-200 bg-[#1ED760]/15 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            {toastMsg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            <span>{toastMsg.text}</span>
          </div>
          <button type="button" onClick={() => setToastMsg(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1: PAID SUBSCRIPTION GATE */}
      {!isSubscribed ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-3">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                Step 1 · Subscription Required
              </span>
              <h2 className="mt-1.5 text-base font-semibold text-neutral-950">
                Activate a Discord AI Bot Package with Tiwlo Credits
              </h2>
              <p className="text-xs text-neutral-500">
                Choose a plan below to unlock Official Tiwlo AI Bot invites, server binding, Auto-Moderation, and monthly AI commands.
              </p>
            </div>
          </div>

          <DiscordPlanSelector
            currentUser={currentUser}
            subscription={subscription}
            packages={packages}
            onActivated={async () => {
              await onReload?.();
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Active Subscription & Quota Bars */}
          <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 lg:col-span-6">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" /> Active Subscription
                </span>
                <h2 className="mt-1.5 text-lg font-semibold text-neutral-950">
                  {subscription.planName}
                </h2>
                <p className="text-xs text-neutral-500">
                  ${Number(subscription.price || 0).toFixed(2)}/mo · Renews {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString() : 'Monthly'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(true)}
                className="rounded-lg border border-neutral-200/80 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Upgrade Plan
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/70 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
                    <TrendingUp className="h-3.5 w-3.5 text-[#1ED760]" />
                    Tier Usage Meter
                  </span>
                  <span className={`font-semibold tabular-nums ${peakUsagePct >= 75 ? 'text-amber-700' : 'text-neutral-900'}`}>
                    {peakUsagePct}% peak capacity
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80">
                  <div
                    className={`h-full rounded-full transition-all ${peakUsagePct >= 85 ? 'bg-rose-500' : peakUsagePct >= 75 ? 'bg-amber-500' : 'bg-[#1ED760]'}`}
                    style={{ width: `${Math.min(100, peakUsagePct)}%` }}
                  />
                </div>
              </div>

              <QuotaBar
                label="Connected Discord Servers"
                current={servers.length}
                limit={serversLimit}
                unit="servers"
              />
              <QuotaBar
                label="Monthly AI Commands & Responses"
                current={commandsUsed}
                limit={commandsLimit}
                unit="cmds"
              />
            </div>

            {shouldSuggestUpgrade && nextUpgradePlan && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-950">
                    {peakUsagePct}% tier capacity reached — upgrade to {nextUpgradePlan.planName}
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Unlock {nextUpgradePlan.maxServersPerBot} servers &amp; {Number(nextUpgradePlan.monthlyCommandsLimit || 0).toLocaleString()} cmds/mo for ${Number(nextUpgradePlan.price || 0).toFixed(2)}/mo.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={upgradingTier}
                  onClick={() => handleOneClickUpgrade(nextUpgradePlan)}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-60 cursor-pointer"
                >
                  {upgradingTier ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Upgrading...</span>
                    </>
                  ) : (
                    <>
                      <span>Upgrade Now</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                  subscription.limits?.autoModEnabled
                    ? 'bg-[#1ED760]/15 text-emerald-800'
                    : 'bg-neutral-100 text-neutral-500'
                }`}>
                  <Shield className="h-3 w-3" />
                  Auto-Moderation: {subscription.limits?.autoModEnabled ? 'Enabled' : 'Upgrade for Auto-Mod'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 font-medium text-neutral-700">
                  <Zap className="h-3 w-3 text-[#1ED760]" />
                  Webhooks Limit: {subscription.limits?.webhookLimit || 2}
                </span>
              </div>

              <button
                type="button"
                disabled={togglingAutoRenew}
                onClick={handleToggleAutoRenewClick}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition cursor-pointer disabled:opacity-60 ${
                  autoRenewEnabled
                    ? 'border-[#1ED760]/50 bg-[#1ED760]/10 text-emerald-900 hover:bg-[#1ED760]/20'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {togglingAutoRenew ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <span>Auto-Renew: {autoRenewEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>
          </div>

          {/* Step 2: Install Official Bot Card */}
          <div className="flex flex-col justify-between space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 lg:col-span-6">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1ED760] text-black">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                      Step 2 · Official Tiwlo Bot
                    </span>
                    <h2 className="mt-0.5 text-base font-semibold text-neutral-950">
                      {primaryBot?.name || 'Tiwlo Official AI Bot'}
                    </h2>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  primaryBot?.status === 'active'
                    ? 'bg-[#1ED760]/15 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {primaryBot?.status === 'active' ? 'Online' : (primaryBot ? 'Maintenance' : 'Standby')}
                </span>
              </div>

              <p className="text-xs leading-relaxed text-neutral-600">
                {primaryBot?.description || 'Managed Tiwlo AI Bot hosted centrally by Tiwlo. No bot token or server hosting required — install directly via Discord OAuth2 and bind your server.'}
              </p>

              {Array.isArray(primaryBot?.features) && primaryBot.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {primaryBot.features.slice(0, 4).map((feat, idx) => (
                    <span key={idx} className="rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-700">
                      {feat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
              {primaryBot?.inviteUrl ? (
                <a
                  href={primaryBot.inviteUrl}
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
                  onClick={() => onNavigate('/discord/bots')}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-xs font-semibold text-neutral-700"
                >
                  <Bot className="h-3.5 w-3.5" />
                  View Official Bot Details
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigate('/discord/servers/new')}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-4 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                <Server className="h-3.5 w-3.5" />
                Bind Server to Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CONNECTED SERVERS & AI CONFIG */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-neutral-950">
              Step 3 · Connected Discord Servers &amp; AI Settings
            </h2>
            <p className="text-xs text-neutral-500">
              Configure AI Persona, System Prompt, Auto-Moderation, Welcome Workflows, and Slash Commands per server.
            </p>
          </div>
          {isSubscribed && (
            <button
              type="button"
              onClick={() => onNavigate('/discord/servers/new')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-black hover:bg-[#19c354]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Server
            </button>
          )}
        </div>

        {servers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center">
            <Server className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-900">No Discord servers connected yet</p>
            <p className="mt-1 text-xs text-neutral-500">
              {isSubscribed
                ? 'Install the Official Tiwlo AI Bot via Discord OAuth2 and bind your first Discord Server here.'
                : 'Activate a Discord AI Bot package above to connect your first Discord Server.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {servers.map((server) => {
              const ai = server.aiConfig || {};
              return (
                <div
                  key={server.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200/80 p-4 transition hover:border-neutral-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-neutral-950">{server.name}</h3>
                        {server.isSuspended ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Suspended
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        Guild ID: {server.guildId || server.id} · Persona: <span className="capitalize">{ai.persona || 'community'}</span>
                      </p>
                    </div>
                    <span className="rounded-lg bg-neutral-100 px-2 py-1 text-[11px] font-semibold tabular-nums text-neutral-700">
                      {Number(server.commandsUsedMonth || 0).toLocaleString()} cmds
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
                      <Sparkles className="h-3 w-3 text-[#1ED760]" /> AI Chat: {ai.enabled !== false ? 'On' : 'Off'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
                      <Shield className="h-3 w-3 text-[#1ED760]" /> Auto-Mod: {ai.autoMod?.antiSpam ? 'On' : 'Off'}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-700">
                      <Terminal className="h-3 w-3 text-[#1ED760]" /> Prefix: {ai.commandPrefix || '/'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onNavigate(`/discord/servers/${encodeURIComponent(server.id)}`)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-800"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Configure AI Bot
                    </button>
                    <button
                      type="button"
                      disabled={simulatingId === server.id || server.isSuspended}
                      onClick={() => handleSimulateAi(server)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Zap className="h-3.5 w-3.5 text-[#1ED760]" />
                      {simulatingId === server.id ? 'Running...' : 'Test AI Command'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
              <Activity className="h-4 w-4 text-[#1ED760]" />
              Recent Bot &amp; Server Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/discord/activity')}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              View all logs →
            </button>
          </div>
          <div className="divide-y divide-neutral-100">
            {activities.slice(0, 5).map((act) => (
              <div key={act.id} className="flex items-center justify-between py-2 text-xs">
                <span className="font-medium text-neutral-800">{act.message || act.action}</span>
                <span className="text-neutral-400">{act.timeAgo || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPlanModal && (
        <DiscordPlanSelector
          isModal
          currentUser={currentUser}
          subscription={subscription}
          packages={packages}
          tierInsight={tierInsight}
          onNavigateBilling={onNavigateBilling}
          onClose={() => setShowPlanModal(false)}
          onActivated={async () => {
            await onReload?.();
          }}
        />
      )}
    </div>
  );
}
