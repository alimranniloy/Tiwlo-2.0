import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const PERMISSION_PRESETS = [
  { label: 'AI Community & Auto-Mod (Recommended)', value: '274877975552' },
  { label: 'Full Administrator (8)', value: '8' },
  { label: 'Support, Welcome & Tickets', value: '268437568' },
];

const EMPTY_BOT_FORM = {
  id: null,
  name: 'Tiwlo Official AI Bot',
  clientId: '',
  botToken: '',
  permissionsInt: '274877975552',
  oauthUrlTemplate: '',
  status: 'active',
  isDefault: true,
  description: 'Official centralized Tiwlo Discord AI Assistant with Auto-Moderation, Welcome Automation, and Ticket Workflows.',
  featuresText: 'AI Community Q&A\nSmart Auto-Moderation\nWelcome & Verification\nSlash Commands & Support Tickets',
};

function authHeaders(json = false) {
  const token = localStorage.getItem('stockpro_session');
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function buildInvitePreview(clientId, permissionsInt, oauthUrlTemplate) {
  const cid = String(clientId || '').trim();
  const perms = String(permissionsInt || '274877975552').trim() || '274877975552';
  if (!cid) return '';
  if (oauthUrlTemplate && oauthUrlTemplate.includes('{clientId}')) {
    return oauthUrlTemplate
      .replace(/\{clientId\}/g, encodeURIComponent(cid))
      .replace(/\{permissions\}/g, encodeURIComponent(perms));
  }
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(cid)}&permissions=${encodeURIComponent(perms)}&scope=bot%20applications.commands`;
}

export function AdminDiscordBotView({ onBackToDashboard, showToast, currentUser }) {
  const currencyCtx = useAdminCurrency();
  const [activeTab, setActiveTab] = useState('fleet');

  // Tab 1: Official Bot Fleet
  const [officialBots, setOfficialBots] = useState([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [savingBot, setSavingBot] = useState(false);
  const [botForm, setBotForm] = useState(EMPTY_BOT_FORM);
  const [editingMeta, setEditingMeta] = useState({ hasToken: false, maskedToken: null });
  const [copiedId, setCopiedId] = useState(null);

  // Tab 2: Connected Users & Servers
  const [servers, setServers] = useState([]);
  const [serversTotal, setServersTotal] = useState(0);
  const [serversPage, setServersPage] = useState(1);
  const [serversLimit, setServersLimit] = useState(10);
  const [serversSearch, setServersSearch] = useState('');
  const [loadingServers, setLoadingServers] = useState(false);

  // Tab 3: Discord Bot Orders
  const [orders, setOrders] = useState([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState(10);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  const isSuperAdmin = useMemo(() => {
    const role = String(currentUser?.role || '').toLowerCase();
    const email = String(currentUser?.email || '').toLowerCase();
    return role === 'super_admin' || email === 'tiwloltd@gmail.com';
  }, [currentUser]);

  const formatMoney = useCallback((amountUsd) => {
    if (typeof currencyCtx?.formatMoney === 'function') {
      return currencyCtx.formatMoney(amountUsd);
    }
    const n = Number(amountUsd || 0);
    return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
  }, [currencyCtx]);

  const loadOfficialBots = useCallback(async () => {
    try {
      setLoadingBots(true);
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/discord/admin/official-bots`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load Official Discord AI bots.');
      }
      const list = Array.isArray(json.officialBots) ? json.officialBots : [];
      setOfficialBots(list);
      if (list.length > 0 && !botForm.id) {
        selectBotForEdit(list[0]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not load Official Discord AI bots.');
    } finally {
      setLoadingBots(false);
    }
  }, []);

  const loadServers = useCallback(async () => {
    try {
      setLoadingServers(true);
      setErrorMsg('');
      const params = new URLSearchParams({
        page: String(serversPage),
        limit: String(serversLimit),
        ...(serversSearch.trim() ? { search: serversSearch.trim() } : {}),
      });
      const res = await fetch(`${API_BASE}/discord/admin/servers?${params.toString()}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load connected Discord servers.');
      }
      setServers(Array.isArray(json.items) ? json.items : []);
      setServersTotal(Number(json.total || 0));
    } catch (err) {
      setErrorMsg(err.message || 'Could not load connected Discord servers.');
    } finally {
      setLoadingServers(false);
    }
  }, [serversPage, serversLimit, serversSearch]);

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      setErrorMsg('');
      const params = new URLSearchParams({
        page: String(ordersPage),
        limit: String(ordersLimit),
        ...(ordersSearch.trim() ? { search: ordersSearch.trim() } : {}),
      });
      const res = await fetch(`${API_BASE}/discord/admin/orders?${params.toString()}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load Discord Bot orders.');
      }
      setOrders(Array.isArray(json.items) ? json.items : []);
      setOrdersTotal(Number(json.total || 0));
    } catch (err) {
      setErrorMsg(err.message || 'Could not load Discord Bot orders.');
    } finally {
      setLoadingOrders(false);
    }
  }, [ordersPage, ordersLimit, ordersSearch]);

  useEffect(() => {
    loadOfficialBots();
  }, [loadOfficialBots]);

  useEffect(() => {
    if (activeTab === 'servers') loadServers();
  }, [activeTab, loadServers]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
  }, [activeTab, loadOrders]);

  const selectBotForEdit = (bot) => {
    if (!bot) {
      setBotForm(EMPTY_BOT_FORM);
      setEditingMeta({ hasToken: false, maskedToken: null });
      return;
    }
    setBotForm({
      id: bot.id,
      name: bot.name || '',
      clientId: bot.clientId || '',
      botToken: '',
      permissionsInt: bot.permissionsInt || '274877975552',
      oauthUrlTemplate: bot.oauthUrlTemplate || '',
      status: bot.status || 'active',
      isDefault: Boolean(bot.isDefault),
      description: bot.description || '',
      featuresText: Array.isArray(bot.features) ? bot.features.join('\n') : '',
    });
    setEditingMeta({
      hasToken: Boolean(bot.hasToken),
      maskedToken: bot.maskedToken || null,
    });
  };

  const handleSaveOfficialBot = async (e) => {
    e.preventDefault();
    if (!botForm.name.trim() || !botForm.clientId.trim()) {
      showToast?.('Bot Name and Discord Application/Client ID are required.', 'error');
      return;
    }
    try {
      setSavingBot(true);
      setErrorMsg('');
      const payload = {
        name: botForm.name.trim(),
        clientId: botForm.clientId.trim(),
        permissionsInt: botForm.permissionsInt.trim() || '274877975552',
        oauthUrlTemplate: botForm.oauthUrlTemplate.trim(),
        status: botForm.status,
        isDefault: Boolean(botForm.isDefault),
        description: botForm.description.trim(),
        features: botForm.featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
      };
      if (botForm.botToken.trim()) {
        payload.botToken = botForm.botToken.trim();
      }

      const isEdit = Boolean(botForm.id);
      const url = isEdit
        ? `${API_BASE}/discord/admin/official-bots/${encodeURIComponent(botForm.id)}`
        : `${API_BASE}/discord/admin/official-bots`;

      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save Official Discord bot.');
      }
      showToast?.(json.message || 'Official Tiwlo Discord bot saved.', 'success');
      await loadOfficialBots();
      if (json.bot) selectBotForEdit(json.bot);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save Official Discord bot.');
      showToast?.(err.message || 'Failed to save Official Discord bot.', 'error');
    } finally {
      setSavingBot(false);
    }
  };

  const handleDeleteOfficialBot = async (botId) => {
    if (!window.confirm('Delete this Official Tiwlo Discord bot configuration?')) return;
    try {
      const res = await fetch(`${API_BASE}/discord/admin/official-bots/${encodeURIComponent(botId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete Official Discord bot.');
      }
      showToast?.('Official Discord bot removed.', 'success');
      if (botForm.id === botId) selectBotForEdit(null);
      await loadOfficialBots();
    } catch (err) {
      showToast?.(err.message || 'Failed to delete Official Discord bot.', 'error');
    }
  };

  const handleToggleServerSuspension = async (serverRow) => {
    try {
      const targetId = serverRow.id || serverRow.guildId;
      const res = await fetch(`${API_BASE}/discord/admin/servers/${encodeURIComponent(targetId)}/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(true),
        body: JSON.stringify({ suspended: !serverRow.isSuspended }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update server status.');
      }
      showToast?.(json.message || 'Server status updated.', 'success');
      await loadServers();
    } catch (err) {
      showToast?.(err.message || 'Failed to update server status.', 'error');
    }
  };

  const handleRevokeServer = async (serverRow) => {
    if (!window.confirm(`Disconnect & revoke "${serverRow.guildName}" (${serverRow.guildId})?`)) return;
    try {
      const targetId = serverRow.id || serverRow.guildId;
      const res = await fetch(`${API_BASE}/discord/admin/servers/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to revoke Discord server.');
      }
      showToast?.('Discord server disconnected and revoked.', 'success');
      await loadServers();
    } catch (err) {
      showToast?.(err.message || 'Failed to revoke Discord server.', 'error');
    }
  };

  const copyInviteUrl = async (url, id) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
      showToast?.('OAuth2 install link copied.', 'success');
    } catch {
      showToast?.('Could not copy invite URL.', 'error');
    }
  };

  const liveInvitePreview = buildInvitePreview(
    botForm.clientId,
    botForm.permissionsInt,
    botForm.oauthUrlTemplate
  );

  const serversTotalPages = Math.max(1, Math.ceil(serversTotal / serversLimit));
  const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / ordersLimit));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <Bot className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Official Discord AI Bot Control
            </h1>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Manage Tiwlo&apos;s centralized Official Discord AI Bot(s), audit user server connections, and monitor paid Discord Bot subscription orders.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeTab === 'fleet') loadOfficialBots();
            else if (activeTab === 'servers') loadServers();
            else loadOrders();
          }}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Shadcn-style Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-neutral-100/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
        {[
          { id: 'fleet', label: 'Official Bot Config & Fleet', icon: Bot, count: officialBots.length },
          { id: 'servers', label: 'Connected Users & Servers', icon: Server, count: serversTotal },
          { id: 'orders', label: 'Discord Bot Orders & Subscriptions', icon: Receipt, count: ordersTotal },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-200/80 dark:bg-neutral-950 dark:text-white dark:ring-neutral-800'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#1ED760]' : ''}`} />
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                active
                  ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                  : 'bg-neutral-200/70 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OFFICIAL DISCORD AI BOT CONFIG & FLEET */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Fleet List */}
          <div className="space-y-3 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Platform Bot Instances
              </h2>
              <button
                type="button"
                onClick={() => selectBotForEdit(null)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-black transition hover:bg-[#19c354]"
              >
                <Plus className="h-3.5 w-3.5" />
                New Official Bot
              </button>
            </div>

            {loadingBots ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950" />
                ))}
              </div>
            ) : officialBots.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-950">
                <Bot className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
                <p className="text-sm font-medium text-neutral-900 dark:text-white">No Official Discord Bot configured yet</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Register Tiwlo&apos;s Official Discord Application ID and encrypted token on the right so paying users can invite the bot.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {officialBots.map((bot) => {
                  const selected = botForm.id === bot.id;
                  return (
                    <div
                      key={bot.id}
                      onClick={() => selectBotForEdit(bot)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        selected
                          ? 'border-[#1ED760] bg-[#1ED760]/5 dark:bg-[#1ED760]/5'
                          : 'border-neutral-200/80 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {bot.name}
                            </p>
                            {bot.isDefault && (
                              <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                                Default
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              bot.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-[#1ED760]'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}>
                              {bot.status === 'active' ? 'Active' : 'Maintenance'}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-neutral-500">
                            Client ID: {bot.clientId}
                          </p>
                        </div>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOfficialBot(bot.id);
                            }}
                            title="Delete Official Bot"
                            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/60 pt-2.5 text-[11px] dark:border-neutral-800">
                        <span className="inline-flex items-center gap-1.5 font-mono text-neutral-600 dark:text-neutral-400">
                          <KeyRound className="h-3 w-3 text-[#1ED760]" />
                          {bot.hasToken ? bot.maskedToken : 'No token stored'}
                        </span>

                        {bot.inviteUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyInviteUrl(bot.inviteUrl, bot.id);
                            }}
                            className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline dark:text-[#1ED760]"
                          >
                            {copiedId === bot.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            Copy OAuth2 URL
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bot Config Editor */}
          <form
            onSubmit={handleSaveOfficialBot}
            className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-7"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  {botForm.id ? 'Edit Official Discord AI Bot' : 'Register New Official Discord AI Bot'}
                </h2>
                <p className="text-xs text-neutral-500">
                  Tokens are AES-256-GCM encrypted at rest and never exposed in API responses.
                </p>
              </div>
              {editingMeta.hasToken && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-[#1ED760]/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                  <Shield className="h-3 w-3" />
                  Token Configured ({editingMeta.maskedToken})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Bot Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={botForm.name}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Tiwlo Official AI Bot"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Discord Application / Client ID *
                </label>
                <input
                  type="text"
                  required
                  value={botForm.clientId}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, clientId: e.target.value }))}
                  placeholder="e.g. 123456789012345678"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Encrypted Bot Token (Write-Only)
                  </label>
                  {!isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="h-3 w-3" />
                      Super Admin required to write/rotate token
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={!isSuperAdmin}
                  value={botForm.botToken}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, botToken: e.target.value }))}
                  placeholder={
                    editingMeta.hasToken
                      ? `Stored: ${editingMeta.maskedToken} — leave blank to keep existing token`
                      : 'Paste Discord Bot Token (stored encrypted, never shown again)'
                  }
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-sm text-neutral-900 outline-none focus:border-[#1ED760] disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Permissions Integer
                </label>
                <input
                  type="text"
                  value={botForm.permissionsInt}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, permissionsInt: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PERMISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setBotForm((prev) => ({ ...prev, permissionsInt: preset.value }))}
                      className="rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600 hover:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Status &amp; Routing
                </label>
                <div className="flex h-9 items-center gap-4">
                  <select
                    value={botForm.status}
                    onChange={(e) => setBotForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="h-9 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    <option value="active">Active (Live)</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={botForm.isDefault}
                      onChange={(e) => setBotForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                      className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                    />
                    Primary Default Bot
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  OAuth2 Invite URL Template (optional — supports {'{clientId}'} &amp; {'{permissions}'})
                </label>
                <input
                  type="text"
                  value={botForm.oauthUrlTemplate}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, oauthUrlTemplate: e.target.value }))}
                  placeholder="Leave blank to auto-generate standard Discord OAuth2 authorize link"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              {liveInvitePreview && (
                <div className="rounded-xl border border-emerald-500/30 bg-[#1ED760]/5 p-3 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                      Live OAuth2 Install URL Preview
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyInviteUrl(liveInvitePreview, 'preview')}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-neutral-950 dark:text-neutral-300"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                      <a
                        href={liveInvitePreview}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-[#1ED760]"
                      >
                        Test Link
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                    {liveInvitePreview}
                  </p>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Description
                </label>
                <input
                  type="text"
                  value={botForm.description}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                  Supported Capabilities (one per line)
                </label>
                <textarea
                  rows={3}
                  value={botForm.featuresText}
                  onChange={(e) => setBotForm((prev) => ({ ...prev, featuresText: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <button
                type="submit"
                disabled={savingBot}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingBot ? 'Saving...' : (botForm.id ? 'Update Official Bot' : 'Create Official Bot')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: CONNECTED USERS & SERVERS */}
      {activeTab === 'servers' && (
        <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={serversSearch}
                onChange={(e) => {
                  setServersSearch(e.target.value);
                  setServersPage(1);
                }}
                placeholder="Search guild, user email, tiwiId..."
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white pl-9 pr-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>Rows per page:</span>
              <select
                value={serversLimit}
                onChange={(e) => {
                  setServersLimit(Number(e.target.value));
                  setServersPage(1);
                }}
                className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800">
                  <th className="py-2.5 pr-4">User / Tiwlo ID</th>
                  <th className="py-2.5 pr-4">Discord Server (Guild)</th>
                  <th className="py-2.5 pr-4">Plan &amp; Servers Quota</th>
                  <th className="py-2.5 pr-4">Active Modules</th>
                  <th className="py-2.5 pr-4">AI / Commands</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/80">
                {loadingServers ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">Loading connected Discord servers...</td>
                  </tr>
                ) : servers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">No Discord servers matched your filter.</td>
                  </tr>
                ) : (
                  servers.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-neutral-950 dark:text-white">{row.userName || 'Tiwlo User'}</p>
                        <p className="text-[11px] text-neutral-500">{row.userEmail || row.userId}</p>
                        {row.tiwiId && <p className="font-mono text-[10px] text-neutral-400">{row.tiwiId}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-neutral-900 dark:text-white">{row.guildName}</p>
                        <p className="font-mono text-[11px] text-neutral-500">{row.guildId}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                          {row.planName}
                        </span>
                        <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                          {row.serversUsedCount} / {row.maxServers || '—'} servers
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {(row.activeModules || []).map((mod) => (
                            <span
                              key={mod}
                              className="rounded-md bg-[#1ED760]/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-[#1ED760]"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {Number(row.commandsUsedMonth || 0).toLocaleString()} / {row.monthlyCommandsLimit ? Number(row.monthlyCommandsLimit).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.isSuspended
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                            : 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                        }`}>
                          {row.isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleServerSuspension(row)}
                            className="rounded-lg border border-neutral-200/80 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            {row.isSuspended ? 'Resume' : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeServer(row)}
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200/80 pt-3 text-xs text-neutral-500 dark:border-neutral-800">
            <span>
              Page {serversPage} of {serversTotalPages} ({serversTotal} total servers)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={serversPage <= 1}
                onClick={() => setServersPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 disabled:opacity-40 dark:border-neutral-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={serversPage >= serversTotalPages}
                onClick={() => setServersPage((p) => Math.min(serversTotalPages, p + 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 disabled:opacity-40 dark:border-neutral-800"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DISCORD BOT ORDERS & SUBSCRIPTIONS */}
      {activeTab === 'orders' && (
        <div className="space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={ordersSearch}
                onChange={(e) => {
                  setOrdersSearch(e.target.value);
                  setOrdersPage(1);
                }}
                placeholder="Search order ref, user, plan..."
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white pl-9 pr-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span>Rows per page:</span>
              <select
                value={ordersLimit}
                onChange={(e) => {
                  setOrdersLimit(Number(e.target.value));
                  setOrdersPage(1);
                }}
                className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs font-medium text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-800">
                  <th className="py-2.5 pr-4">Order Ref</th>
                  <th className="py-2.5 pr-4">Customer</th>
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Credits Paid</th>
                  <th className="py-2.5 pr-4">Started</th>
                  <th className="py-2.5 pr-4">Expires</th>
                  <th className="py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/80">
                {loadingOrders ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">Loading Discord Bot orders...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">No Discord Bot subscription orders found.</td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40">
                      <td className="py-3 pr-4 font-mono font-semibold text-neutral-900 dark:text-white">
                        {order.orderNumber || order.id}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-neutral-900 dark:text-white">{order.userName || order.userId}</p>
                        <p className="text-[11px] text-neutral-500">{order.userEmail || order.tiwiId || ''}</p>
                      </td>
                      <td className="py-3 pr-4 font-medium text-neutral-800 dark:text-neutral-200">
                        {order.planName || order.planId}
                      </td>
                      <td className="py-3 pr-4 font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                        {formatMoney(order.amountUsd)}
                      </td>
                      <td className="py-3 pr-4 text-neutral-500">
                        {order.startedAt ? new Date(order.startedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 pr-4 text-neutral-500">
                        {order.expiresAt ? new Date(order.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-[#1ED760]">
                          {order.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200/80 pt-3 text-xs text-neutral-500 dark:border-neutral-800">
            <span>
              Page {ordersPage} of {ordersTotalPages} ({ordersTotal} total orders)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={ordersPage <= 1}
                onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 disabled:opacity-40 dark:border-neutral-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={ordersPage >= ordersTotalPages}
                onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 disabled:opacity-40 dark:border-neutral-800"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDiscordBotView;
