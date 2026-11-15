import React, { useState } from 'react';
import {
  Bot,
  ExternalLink,
  Plus,
  Server,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';
import DiscordPlanSelector from '../components/DiscordPlanModal';

export default function ServersView({ servers = [], overviewData, currentUser, onNavigate, onReload }) {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const subscription = overviewData?.subscription || null;
  const officialBots = Array.isArray(overviewData?.officialBots) ? overviewData.officialBots : [];
  const primaryBot = officialBots.find((b) => b.isDefault) || officialBots[0] || null;
  const isSubscribed = Boolean(subscription?.isActive);
  const maxServers = Number(subscription?.limits?.maxServersPerBot || 0);
  const atLimit = isSubscribed && maxServers > 0 && servers.length >= maxServers;

  const handleDisconnect = async (server) => {
    if (!window.confirm(`Disconnect "${server.name}" from Tiwlo Official AI Bot?`)) return;
    setRemovingId(server.id);
    try {
      await DiscordAPI.deleteServer(server.id);
      await onReload?.();
    } catch (err) {
      alert(err.message || 'Could not disconnect server.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950">
            Connected Discord Servers
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            {isSubscribed
              ? `Using ${servers.length} of ${maxServers} server slot(s) on ${subscription.planName}.`
              : 'Activate a paid Discord Bot subscription to connect your Discord server(s).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {primaryBot?.inviteUrl && isSubscribed && (
            <a
              href={primaryBot.inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#1ED760]" />
              Install Bot on Discord
            </a>
          )}
          <button
            type="button"
            onClick={() => (!isSubscribed || atLimit ? setShowPlanModal(true) : onNavigate('/discord/servers/new'))}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354]"
          >
            <Plus className="h-3.5 w-3.5" />
            {atLimit ? 'Upgrade to Add Server' : (isSubscribed ? 'Bind New Server' : 'Subscribe to Connect')}
          </button>
        </div>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white p-10 text-center space-y-3">
          <Server className="mx-auto h-10 w-10 text-neutral-300" />
          <h2 className="text-sm font-semibold text-neutral-900">No Discord servers connected yet</h2>
          <p className="mx-auto max-w-md text-xs text-neutral-500">
            {isSubscribed
              ? 'First invite the Official Tiwlo AI Bot to your Discord Server, then bind your Guild ID here to customize AI & Auto-Mod.'
              : 'Choose a paid Discord AI Bot plan to start connecting Discord communities.'}
          </p>
          <button
            type="button"
            onClick={() => (isSubscribed ? onNavigate('/discord/servers/new') : setShowPlanModal(true))}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354]"
          >
            {isSubscribed ? 'Connect First Server' : 'Select Subscription Plan'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const ai = server.aiConfig || {};
            return (
              <div
                key={server.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200/80 bg-white p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-neutral-950">{server.name}</h3>
                        {server.isSuspended ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            Suspended
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        Guild ID: {server.guildId || server.id}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-neutral-600">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Official Bot</span>
                      <span className="inline-flex items-center gap-1 font-medium text-neutral-900">
                        <Bot className="h-3.5 w-3.5 text-[#1ED760]" />
                        {primaryBot?.name || 'Tiwlo Official AI'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">AI Persona</span>
                      <span className="inline-flex items-center gap-1 font-medium capitalize text-neutral-900">
                        <Sparkles className="h-3.5 w-3.5 text-[#1ED760]" />
                        {ai.persona || 'community'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Auto-Moderation</span>
                      <span className="inline-flex items-center gap-1 font-medium text-neutral-900">
                        <Shield className="h-3.5 w-3.5 text-[#1ED760]" />
                        {ai.autoMod?.antiSpam ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Monthly AI Commands</span>
                      <span className="font-semibold tabular-nums text-neutral-900">
                        {Number(server.commandsUsedMonth || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/discord/servers/${encodeURIComponent(server.id)}`)}
                    className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-800"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Configure AI &amp; Rules
                  </button>
                  <button
                    type="button"
                    disabled={removingId === server.id}
                    onClick={() => handleDisconnect(server)}
                    title="Disconnect Server"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 text-neutral-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
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
