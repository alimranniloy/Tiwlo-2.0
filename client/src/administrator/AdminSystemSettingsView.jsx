import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bot,
  Coins,
  Download,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Map,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || window.location.origin;

const CURRENCY_CHOICES = [
  { code: 'BDT', label: 'BDT (৳ বাংলা টাকা)', symbol: '৳' },
  { code: 'USD', label: 'USD ($ US Dollar)', symbol: '$' },
  { code: 'EUR', label: 'EUR (€ Euro)', symbol: '€' },
  { code: 'GBP', label: 'GBP (£ British Pound)', symbol: '£' },
  { code: 'CAD', label: 'CAD (C$ Canadian Dollar)', symbol: 'C$' },
  { code: 'AUD', label: 'AUD (A$ Australian Dollar)', symbol: 'A$' },
  { code: 'SGD', label: 'SGD (S$ Singapore Dollar)', symbol: 'S$' },
  { code: 'AED', label: 'AED (د.إ UAE Dirham)', symbol: 'AED' },
  { code: 'INR', label: 'INR (₹ Indian Rupee)', symbol: '₹' },
];

const FALLBACK_RATES = {
  USD: 1,
  BDT: 121.5,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.38,
  AUD: 1.53,
  SGD: 1.34,
  AED: 3.6725,
  INR: 84.5,
};

const GEMINI_MODEL_OPTIONS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

const CHAT_FEATURE_SWITCHES = [
  { key: 'liveChatWidget', label: 'Live Chat Widget', description: 'Show the live support chat widget across Tiwlo apps.' },
  { key: 'guestTicketsEnabled', label: 'Guest Ticketing', description: 'Allow unauthenticated guests to open support tickets.' },
  { key: 'requireGuestContact', label: 'Mandatory Guest Email & Phone', description: 'Verify guest email and phone before starting chat or tickets.' },
  { key: 'allowNewTickets', label: 'Allow New Tickets', description: 'Enable new ticket creation for Tiwlo users and visitors.' },
  { key: 'lockClosedReplies', label: 'Lock Replies on Closed Tickets', description: 'Block customer-facing replies on Closed tickets.' },
  { key: 'allowCustomerReopen', label: 'Allow Customer Reopen', description: 'Allow customers to reopen resolved tickets.' },
  { key: 'fileAttachmentsEnabled', label: 'File Attachments', description: 'Allow file uploads inside support threads.' },
  { key: 'aiAutoReply', label: 'AI Auto-Reply', description: 'Enable automated Tiwi AI responses in live chat.' },
  { key: 'aiAgentDraftAssist', label: 'AI Agent Draft Assist', description: 'Enable AI-assisted reply drafting for support agents.' },
  { key: 'restrictStaffToAssignedQueue', label: 'Restrict Staff to Assigned Queue', description: 'Limit non-lead staff to assigned or unassigned tickets.' },
];

const DEFAULT_CHAT_SETTINGS = {
  aiEnabled: true,
  autoFailover: true,
  cooldownMinutes: 15,
  preferredModel: 'gemini-3.1-flash-lite-preview',
  requireGuestContact: true,
  guestChatEnabled: true,
  guestTicketsEnabled: true,
  systemInstructionsSuffix: '',
  liveChatWidget: true,
  allowNewTickets: true,
  lockClosedReplies: true,
  allowCustomerReopen: true,
  fileAttachmentsEnabled: true,
  aiAutoReply: true,
  aiAgentDraftAssist: true,
  restrictStaffToAssignedQueue: false,
};

function ChatSwitch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-[#1ED760] bg-[#1ED760]'
          : 'border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function getKeyStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'healthy' || s === 'ok') {
    return 'border-[#1ED760]/30 bg-[#1ED760]/12 text-emerald-700 dark:text-[#1ED760]';
  }
  if (s === 'cooldown' || s === 'rate_limited') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (s === 'quota_exhausted' || s === 'exhausted' || s === 'invalid' || s === 'error') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  return 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
}

function formatKeyStatusLabel(keyObj) {
  if (keyObj?.enabled === false || keyObj?.isActive === false) return 'Disabled';
  const raw = String(keyObj?.status || 'active').toLowerCase();
  if (raw === 'cooldown' || raw === 'rate_limited') return 'Cooldown';
  if (raw === 'quota_exhausted' || raw === 'exhausted') return 'Quota Exhausted';
  if (raw === 'invalid' || raw === 'error') return 'Invalid';
  if (raw === 'disabled') return 'Disabled';
  return 'Active';
}

export default function AdminSystemSettingsView({ onBackToDashboard, onNavigate, showToast }) {
  const currencyCtx = useAdminCurrency();
  const activeCurrency = currencyCtx?.currency || 'USD';
  const rates = useMemo(
    () => ({ ...FALLBACK_RATES, ...(currencyCtx?.rates || {}) }),
    [currencyCtx?.rates]
  );
  const rateSource = currencyCtx?.rateSource || 'Fallback reference';
  const observedAt = currencyCtx?.observedAt || null;

  const [activeTab, setActiveTab] = useState('currency'); // 'currency' | 'platform' | 'chat-system' | 'backup'

  // Chat System & AI Keys state
  const [chatSettings, setChatSettings] = useState(DEFAULT_CHAT_SETTINGS);
  const [chatKeys, setChatKeys] = useState([]);
  const [loadingChatSystem, setLoadingChatSystem] = useState(false);
  const [savingChatSettings, setSavingChatSettings] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    label: '',
    provider: 'gemini',
    apiKey: '',
    priority: '10',
    modelOverride: '',
  });
  const [showNewApiKey, setShowNewApiKey] = useState(false);
  const [addingKey, setAddingKey] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editKeyForm, setEditKeyForm] = useState({ label: '', priority: '10', modelOverride: '', apiKey: '' });
  const [savingKeyEdit, setSavingKeyEdit] = useState(false);
  const [deleteKeyTarget, setDeleteKeyTarget] = useState(null);
  const [deletingKey, setDeletingKey] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState('');
  const [resettingKeyId, setResettingKeyId] = useState('');
  const [togglingKeyId, setTogglingKeyId] = useState('');

  // Currency converter & default currency state
  const [calcAmount, setCalcAmount] = useState('100');
  const [calcFrom, setCalcFrom] = useState('USD');
  const [calcTo, setCalcTo] = useState('BDT');
  const [defaultCurrencyDraft, setDefaultCurrencyDraft] = useState(null);
  const [manualBdtRateDraft, setManualBdtRateDraft] = useState(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [refreshingRates, setRefreshingRates] = useState(false);

  const defaultCurrency = defaultCurrencyDraft ?? activeCurrency ?? 'USD';
  const manualBdtRate =
    manualBdtRateDraft ??
    String(rates?.BDT && Number.isFinite(Number(rates.BDT)) ? rates.BDT : 121.5);

  // Platform settings state
  const [sysSettings, setSysSettings] = useState({
    companyName: 'Tiwlo Cloud Platform',
    storeEmail: '',
    currency: 'USD',
    currencySymbol: '$',
    taxRate: 0,
    lowStockThreshold: 50,
    enableLowStockAlerts: true,
  });
  const [loadingSys, setLoadingSys] = useState(true);
  const [savingSys, setSavingSys] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSystemSettings = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const res = await fetch(`${API_BASE}/system/settings`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load system settings.');
        if (!active) return;
        setSysSettings((prev) => ({ ...prev, ...data }));
        setErrorMsg('');
      } catch (err) {
        if (!active) return;
        setErrorMsg(err.message || 'System settings unavailable.');
      } finally {
        if (active) setLoadingSys(false);
      }
    };
    loadSystemSettings();
    return () => {
      active = false;
    };
  }, []);

  // Effective rates merging live rates + manual BDT override preview
  const effectiveRates = useMemo(() => {
    const parsedBdt = Number(manualBdtRate);
    return {
      ...rates,
      ...(Number.isFinite(parsedBdt) && parsedBdt > 0 ? { BDT: parsedBdt } : {}),
    };
  }, [rates, manualBdtRate]);

  const convertedOutput = useMemo(() => {
    const amount = Number(calcAmount);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    const fromRate = Number(effectiveRates[calcFrom] || 1);
    const toRate = Number(effectiveRates[calcTo] || 1);
    if (fromRate <= 0 || toRate <= 0) return 0;
    return (amount / fromRate) * toRate;
  }, [calcAmount, calcFrom, calcTo, effectiveRates]);

  const swapConverterCurrencies = () => {
    setCalcFrom(calcTo);
    setCalcTo(calcFrom);
  };

  const handleRefreshRates = async () => {
    try {
      setRefreshingRates(true);
      if (typeof currencyCtx?.refreshRates === 'function') {
        await currencyCtx.refreshRates();
      }
      setManualBdtRateDraft(null);
      showToast?.('Live exchange rates refreshed.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Could not refresh exchange rates.', 'error');
    } finally {
      setRefreshingRates(false);
    }
  };

  const loadChatSystem = useCallback(async () => {
    setLoadingChatSystem(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/chat-system`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not load chat system configuration.');
      }
      const payload = json.data || json;
      const incomingSettings = payload.settings || payload.config || payload;
      const incomingSwitches = incomingSettings.switches || incomingSettings.featureSwitches || {};
      setChatSettings({
        ...DEFAULT_CHAT_SETTINGS,
        ...incomingSettings,
        ...incomingSwitches,
      });
      const keysList = payload.keys || payload.apiKeys || [];
      setChatKeys(Array.isArray(keysList) ? keysList : []);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err.message || 'Could not load chat system configuration.');
    } finally {
      setLoadingChatSystem(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'chat-system') {
      loadChatSystem();
    }
  }, [activeTab, loadChatSystem]);

  const handleSaveChatSettings = async (e) => {
    e?.preventDefault();
    try {
      setSavingChatSettings(true);
      setErrorMsg('');
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const switchesPayload = Object.fromEntries(
        CHAT_FEATURE_SWITCHES.map((sw) => [sw.key, Boolean(chatSettings[sw.key])])
      );
      const res = await fetch(`${API_BASE}/admin/chat-system/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          ...chatSettings,
          cooldownMinutes: Math.max(1, Number(chatSettings.cooldownMinutes || 15)),
          switches: switchesPayload,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to save chat system settings.');
      }
      showToast?.('Chat system & AI settings saved.', 'success');
      await loadChatSystem();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save chat system settings.');
      showToast?.(err.message || 'Failed to save chat system settings.', 'error');
    } finally {
      setSavingChatSettings(false);
    }
  };

  const handleAddGeminiKey = async (e) => {
    e.preventDefault();
    if (!newKeyForm.label.trim() || !newKeyForm.apiKey.trim()) {
      showToast?.('Enter both a key label and API key.', 'error');
      return;
    }
    try {
      setAddingKey(true);
      setErrorMsg('');
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/chat-system/keys`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          label: newKeyForm.label.trim(),
          provider: newKeyForm.provider || 'gemini',
          apiKey: newKeyForm.apiKey.trim(),
          priority: Number(newKeyForm.priority || 10),
          modelOverride: newKeyForm.modelOverride.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not add API key.');
      }
      setNewKeyForm((prev) => ({
        label: '',
        provider: 'gemini',
        apiKey: '',
        priority: String(Number(prev.priority || 10) + 10),
        modelOverride: '',
      }));
      setShowNewApiKey(false);
      showToast?.('Gemini API key added to pool.', 'success');
      await loadChatSystem();
    } catch (err) {
      setErrorMsg(err.message || 'Could not add API key.');
      showToast?.(err.message || 'Could not add API key.', 'error');
    } finally {
      setAddingKey(false);
    }
  };

  const handleToggleKeyEnabled = async (keyObj) => {
    try {
      setTogglingKeyId(keyObj.id);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const nextEnabled = !(keyObj.enabled !== false && keyObj.isActive !== false && String(keyObj.status || '').toLowerCase() !== 'disabled');
      const res = await fetch(`${API_BASE}/admin/chat-system/keys/${encodeURIComponent(keyObj.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ enabled: nextEnabled, isActive: nextEnabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not update key status.');
      }
      showToast?.(`Key "${keyObj.label}" ${nextEnabled ? 'enabled' : 'disabled'}.`, 'success');
      await loadChatSystem();
    } catch (err) {
      showToast?.(err.message || 'Could not update key status.', 'error');
    } finally {
      setTogglingKeyId('');
    }
  };

  const handleSaveKeyEdit = async (e) => {
    e.preventDefault();
    if (!editingKey) return;
    try {
      setSavingKeyEdit(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const payload = {
        label: editKeyForm.label.trim(),
        priority: Number(editKeyForm.priority || 10),
        modelOverride: editKeyForm.modelOverride.trim() || null,
      };
      if (editKeyForm.apiKey.trim()) {
        payload.apiKey = editKeyForm.apiKey.trim();
      }
      const res = await fetch(`${API_BASE}/admin/chat-system/keys/${encodeURIComponent(editingKey.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not update API key.');
      }
      setEditingKey(null);
      showToast?.('API key updated.', 'success');
      await loadChatSystem();
    } catch (err) {
      showToast?.(err.message || 'Could not update API key.', 'error');
    } finally {
      setSavingKeyEdit(false);
    }
  };

  const handleTestKey = async (keyObj) => {
    try {
      setTestingKeyId(keyObj.id);
      const res = await fetch(`${API_BASE}/admin/chat-system/keys/${encodeURIComponent(keyObj.id)}/test`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Connectivity test failed.');
      }
      showToast?.(json.message || `Key "${keyObj.label}" passed live connectivity test.`, 'success');
      await loadChatSystem();
    } catch (err) {
      showToast?.(err.message || 'Connectivity test failed.', 'error');
      await loadChatSystem();
    } finally {
      setTestingKeyId('');
    }
  };

  const handleResetKeyQuota = async (keyObj) => {
    try {
      setResettingKeyId(keyObj.id);
      const res = await fetch(`${API_BASE}/admin/chat-system/keys/${encodeURIComponent(keyObj.id)}/reset-quota`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: '{}',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not reset quota state.');
      }
      showToast?.(`Cooldown cleared for "${keyObj.label}".`, 'success');
      await loadChatSystem();
    } catch (err) {
      showToast?.(err.message || 'Could not reset quota state.', 'error');
    } finally {
      setResettingKeyId('');
    }
  };

  const handleConfirmDeleteKey = async () => {
    if (!deleteKeyTarget) return;
    try {
      setDeletingKey(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/chat-system/keys/${encodeURIComponent(deleteKeyTarget.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not delete API key.');
      }
      setDeleteKeyTarget(null);
      showToast?.('API key removed from pool.', 'success');
      await loadChatSystem();
    } catch (err) {
      showToast?.(err.message || 'Could not delete API key.', 'error');
    } finally {
      setDeletingKey(false);
    }
  };

  const handleSaveCurrencySettings = async (e) => {
    e.preventDefault();
    const parsedBdt = Number(manualBdtRate);
    if (!Number.isFinite(parsedBdt) || parsedBdt <= 0) {
      showToast?.('Enter a valid positive BDT exchange rate.', 'error');
      return;
    }
    try {
      setSavingCurrency(true);
      setErrorMsg('');
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/currency-settings`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          defaultCurrency,
          displayCurrency: defaultCurrency,
          manualRates: { BDT: parsedBdt },
          bdtRateOverride: parsedBdt,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to save currency settings.');
      }
      if (typeof currencyCtx?.setDisplayCurrency === 'function') {
        currencyCtx.setDisplayCurrency(defaultCurrency);
      }
      if (typeof currencyCtx?.refreshRates === 'function') {
        await currencyCtx.refreshRates().catch(() => {});
      }
      showToast?.(`Default dashboard currency saved as ${defaultCurrency}.`, 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Currency settings update failed.');
      showToast?.(err.message || 'Currency settings update failed.', 'error');
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleSaveSystemSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSys(true);
      setErrorMsg('');
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/system/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          ...sysSettings,
          taxRate: Number(sysSettings.taxRate || 0),
          lowStockThreshold: Math.max(0, Number(sysSettings.lowStockThreshold || 0)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save platform settings.');
      setSysSettings((prev) => ({ ...prev, ...data }));
      showToast?.('Platform system configuration saved.', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save platform settings.');
      showToast?.(err.message || 'Failed to save platform settings.', 'error');
    } finally {
      setSavingSys(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setDownloadingBackup(true);
      setErrorMsg('');
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/system/backup`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        throw new Error(json?.error || 'Could not generate system backup.');
      }
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tiwlo-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast?.('Platform backup JSON downloaded.', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Backup download failed.');
      showToast?.(err.message || 'Backup download failed.', 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const allCurrencyCodes = useMemo(() => {
    const known = new Set(CURRENCY_CHOICES.map((c) => c.code));
    Object.keys(effectiveRates).forEach((k) => known.add(k));
    return Array.from(known);
  }, [effectiveRates]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            System Settings &amp; Real-Time Currency
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Configure live USD ↔ BDT (৳ বাংলা টাকা) rates, default dashboard currency, platform configuration, and backups.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshRates}
          disabled={refreshingRates}
          className="inline-flex h-9 items-center gap-2 self-start rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshingRates ? 'animate-spin' : ''}`} />
          Sync Live Rates
        </button>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-xl border border-neutral-200/80 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950">
        {[
          { id: 'currency', label: 'Currency & Live Converter', icon: Coins },
          { id: 'platform', label: 'Platform Configuration', icon: Settings },
          { id: 'chat-system', label: 'Chat System & AI Keys', icon: Bot },
          { id: 'backup', label: 'Backups & Integrations', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                active
                  ? 'bg-[#1ED760] font-semibold text-black'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {activeTab === 'currency' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Interactive Currency Converter Calculator */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Live Currency Converter (BDT / বাংলা টাকা ↔ USD)
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Instant conversion across BDT, USD, EUR, GBP and supported currencies.
                </p>
              </div>
              <span className="rounded-full border border-[#1ED760]/30 bg-[#1ED760]/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-[#1ED760]">
                1 USD = ৳{Number(effectiveRates.BDT || 121.5).toFixed(2)} BDT
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Amount
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-sm font-semibold tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-11">
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    From Currency
                  </label>
                  <select
                    value={calcFrom}
                    onChange={(e) => setCalcFrom(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    {allCurrencyCodes.map((code) => {
                      const meta = CURRENCY_CHOICES.find((c) => c.code === code);
                      return (
                        <option key={code} value={code}>
                          {meta ? meta.label : code}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex justify-center sm:col-span-1">
                  <button
                    type="button"
                    onClick={swapConverterCurrencies}
                    title="Swap currencies"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200/80 bg-neutral-50 text-neutral-700 transition hover:border-[#1ED760] hover:bg-[#1ED760] hover:text-black dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    To Currency
                  </label>
                  <select
                    value={calcTo}
                    onChange={(e) => setCalcTo(e.target.value)}
                    className="h-10 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  >
                    {allCurrencyCodes.map((code) => {
                      const meta = CURRENCY_CHOICES.find((c) => c.code === code);
                      return (
                        <option key={code} value={code}>
                          {meta ? meta.label : code}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 p-4">
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  Converted Result
                </span>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: calcTo,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(convertedOutput)}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400">
                  Rate: 1 {calcFrom} ={' '}
                  {((effectiveRates[calcTo] || 1) / (effectiveRates[calcFrom] || 1)).toFixed(4)} {calcTo}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
                <span>Source: {rateSource}</span>
                <span>Observed: {observedAt ? new Date(observedAt).toLocaleString() : 'Live / Manual Fallback'}</span>
              </div>
            </div>
          </div>

          {/* Default Dashboard Currency & Manual Rate Fallback */}
          <form
            onSubmit={handleSaveCurrencySettings}
            className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-5"
          >
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Dashboard Currency &amp; Offline Rate Fallback
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Persist default admin currency and BDT fallback rate (`PUT /api/admin/currency-settings`).
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Default Admin Dashboard Currency
                </label>
                <select
                  value={defaultCurrency}
                  onChange={(e) => {
                    setDefaultCurrencyDraft(e.target.value);
                    currencyCtx?.setDisplayCurrency?.(e.target.value);
                  }}
                  className="h-10 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  {CURRENCY_CHOICES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Manual BDT Rate Fallback / Override (1 USD = ? BDT)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={manualBdtRate}
                  onChange={(e) => setManualBdtRateDraft(e.target.value)}
                  className="h-10 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 text-sm font-semibold tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-neutral-500">
                  Ensures BDT (৳ বাংলা টাকা) conversions always resolve reliably even when external FX feeds are offline.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingCurrency}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingCurrency ? 'Verifying & Saving...' : 'Save Default Currency & Rate'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'platform' && (
        <form
          onSubmit={handleSaveSystemSettings}
          className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Platform System Configuration
              </h2>
              <p className="text-xs text-neutral-500">
                Global defaults stored in PostgreSQL (`GET/PUT /api/system/settings`).
              </p>
            </div>
            <button
              type="submit"
              disabled={loadingSys || savingSys}
              className="inline-flex h-9 items-center gap-2 self-start rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50 sm:self-auto"
            >
              <Save className="h-3.5 w-3.5" />
              {savingSys ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {loadingSys ? (
            <div className="py-10 text-center text-xs text-neutral-400">Loading system settings...</div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Platform / Company Name
                </label>
                <input
                  type="text"
                  value={sysSettings.companyName || ''}
                  onChange={(e) => setSysSettings((s) => ({ ...s, companyName: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Support / Store Email
                </label>
                <input
                  type="email"
                  value={sysSettings.storeEmail || ''}
                  onChange={(e) => setSysSettings((s) => ({ ...s, storeEmail: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Default Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sysSettings.taxRate ?? 0}
                  onChange={(e) => setSysSettings((s) => ({ ...s, taxRate: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Default Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={sysSettings.lowStockThreshold ?? 50}
                  onChange={(e) => setSysSettings((s) => ({ ...s, lowStockThreshold: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={Boolean(sysSettings.enableLowStockAlerts)}
                    onChange={(e) => setSysSettings((s) => ({ ...s, enableLowStockAlerts: e.target.checked }))}
                    className="h-4 w-4 rounded accent-[#1ED760]"
                  />
                  Enable Platform Low Stock Alerts
                </label>
              </div>
            </div>
          )}
        </form>
      )}

      {activeTab === 'chat-system' && (
        <div className="space-y-5">
          {/* Top Chat & AI System Settings Form */}
          <form
            onSubmit={handleSaveChatSettings}
            className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex flex-col justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Chat System &amp; Tiwi AI Configuration
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Configure Gemini model routing, automatic quota failover, guest verification, and system instructions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadChatSystem}
                  disabled={loadingChatSystem}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingChatSystem ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="submit"
                  disabled={loadingChatSystem || savingChatSettings}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingChatSettings ? 'Verifying & Saving...' : 'Save Chat Settings'}
                </button>
              </div>
            </div>

            {loadingChatSystem && chatKeys.length === 0 ? (
              <div className="py-10 text-center text-xs text-neutral-400">Loading chat system &amp; AI key pool...</div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Preferred Gemini Model
                    </label>
                    <select
                      value={chatSettings.preferredModel || 'gemini-3.1-flash-lite-preview'}
                      onChange={(e) => setChatSettings((s) => ({ ...s, preferredModel: e.target.value }))}
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    >
                      {GEMINI_MODEL_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      {!GEMINI_MODEL_OPTIONS.includes(chatSettings.preferredModel) && chatSettings.preferredModel && (
                        <option value={chatSettings.preferredModel}>{chatSettings.preferredModel}</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Failover Cooldown (Minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={chatSettings.cooldownMinutes ?? 15}
                      onChange={(e) => setChatSettings((s) => ({ ...s, cooldownMinutes: e.target.value }))}
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-col justify-end gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">AI Chat System Enabled</span>
                      <ChatSwitch
                        label="AI Chat System Enabled"
                        checked={Boolean(chatSettings.aiEnabled)}
                        onChange={(v) => setChatSettings((s) => ({ ...s, aiEnabled: v }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Automatic Quota Failover</span>
                      <ChatSwitch
                        label="Automatic Quota Failover"
                        checked={Boolean(chatSettings.autoFailover)}
                        onChange={(v) => setChatSettings((s) => ({ ...s, autoFailover: v }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Guest Chat Enabled</span>
                    <ChatSwitch
                      label="Guest Chat Enabled"
                      checked={Boolean(chatSettings.guestChatEnabled)}
                      onChange={(v) => setChatSettings((s) => ({ ...s, guestChatEnabled: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Guest Tickets Enabled</span>
                    <ChatSwitch
                      label="Guest Tickets Enabled"
                      checked={Boolean(chatSettings.guestTicketsEnabled)}
                      onChange={(v) => setChatSettings((s) => ({ ...s, guestTicketsEnabled: v }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                    <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200">Mandatory Guest Email &amp; Phone</span>
                    <ChatSwitch
                      label="Mandatory Guest Email & Phone"
                      checked={Boolean(chatSettings.requireGuestContact)}
                      onChange={(v) => setChatSettings((s) => ({ ...s, requireGuestContact: v }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Custom Support AI System Instructions Suffix
                  </label>
                  <textarea
                    rows={3}
                    value={chatSettings.systemInstructionsSuffix || ''}
                    onChange={(e) => setChatSettings((s) => ({ ...s, systemInstructionsSuffix: e.target.value }))}
                    placeholder="Optional operational rules appended to Tiwi AI support prompts (e.g., escalation policy, refund SLA, regional tone)..."
                    className="w-full rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>

                {/* Support & Chat Operational Feature Controls */}
                <div className="border-t border-neutral-200/80 pt-4 dark:border-neutral-800">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Support &amp; Chat Feature Controls
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {CHAT_FEATURE_SWITCHES.map((sw) => (
                      <div
                        key={sw.key}
                        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-3.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-neutral-950 dark:text-white">{sw.label}</p>
                          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{sw.description}</p>
                        </div>
                        <ChatSwitch
                          label={sw.label}
                          checked={Boolean(chatSettings[sw.key])}
                          onChange={(val) => setChatSettings((s) => ({ ...s, [sw.key]: val }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Unlimited Gemini API Key Pool Manager */}
          <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Gemini API Key Pool ({chatKeys.length} Configured)
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Add unlimited Gemini API keys with priority ordering, live connectivity tests, and automatic quota cooldown rotation.
                </p>
              </div>
            </div>

            {/* Add Key Form */}
            <form
              onSubmit={handleAddGeminiKey}
              className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 md:grid-cols-12"
            >
              <div className="md:col-span-3">
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Key Label
                </label>
                <input
                  type="text"
                  required
                  value={newKeyForm.label}
                  onChange={(e) => setNewKeyForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Primary Production Key"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Provider
                </label>
                <select
                  value={newKeyForm.provider}
                  onChange={(e) => setNewKeyForm((f) => ({ ...f, provider: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                >
                  <option value="gemini">Gemini</option>
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showNewApiKey ? 'text' : 'password'}
                    required
                    value={newKeyForm.apiKey}
                    onChange={(e) => setNewKeyForm((f) => ({ ...f, apiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white pl-3 pr-9 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewApiKey((v) => !v)}
                    aria-label={showNewApiKey ? 'Hide API key' : 'Show API key'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    {showNewApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Priority
                </label>
                <input
                  type="number"
                  min="1"
                  value={newKeyForm.priority}
                  onChange={(e) => setNewKeyForm((f) => ({ ...f, priority: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Model Override
                </label>
                <input
                  type="text"
                  value={newKeyForm.modelOverride}
                  onChange={(e) => setNewKeyForm((f) => ({ ...f, modelOverride: e.target.value }))}
                  placeholder="Optional"
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                />
              </div>

              <div className="flex justify-end md:col-span-12">
                <button
                  type="submit"
                  disabled={addingKey}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addingKey ? 'Verifying & Adding...' : 'Add Gemini Key'}
                </button>
              </div>
            </form>

            {/* Live Key Pool Cards / Table */}
            <div className="mt-4 space-y-2.5">
              {chatKeys.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-xs text-neutral-500 dark:border-neutral-800">
                  No Gemini API keys added yet. Use the form above to add one or more failover keys.
                </div>
              ) : (
                chatKeys.map((keyObj) => {
                  const statusLabel = formatKeyStatusLabel(keyObj);
                  const isEnabled =
                    keyObj.enabled !== false &&
                    keyObj.isActive !== false &&
                    String(keyObj.status || '').toLowerCase() !== 'disabled';
                  const statsObj = keyObj.telemetry || keyObj.usage || keyObj;

                  return (
                    <div
                      key={keyObj.id}
                      className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/40 p-4 dark:border-neutral-800 dark:bg-neutral-900/30 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
                            P{keyObj.priority ?? 10}
                          </span>
                          <span className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {keyObj.label}
                          </span>
                          <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 font-mono text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                            {keyObj.maskedKey || keyObj.keyPreview || 'AIza••••'}
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getKeyStatusBadgeClass(statusLabel.toLowerCase().replace(/\s+/g, '_'))}`}>
                            {statusLabel}
                          </span>
                          {keyObj.modelOverride && (
                            <span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                              Model: {keyObj.modelOverride}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>Requests: <strong className="tabular-nums text-neutral-800 dark:text-neutral-200">{statsObj.requests ?? statsObj.requestCount ?? 0}</strong></span>
                          <span>Success: <strong className="tabular-nums text-neutral-800 dark:text-neutral-200">{statsObj.success ?? statsObj.successCount ?? 0}</strong></span>
                          <span>Quota Hits: <strong className="tabular-nums text-neutral-800 dark:text-neutral-200">{statsObj.quotaHits ?? statsObj.rateLimitHits ?? 0}</strong></span>
                          <span>Errors: <strong className="tabular-nums text-neutral-800 dark:text-neutral-200">{statsObj.errors ?? statsObj.errorCount ?? 0}</strong></span>
                          {keyObj.cooldownUntil && (
                            <span>Cooldown Ends: <strong className="text-neutral-800 dark:text-neutral-200">{new Date(keyObj.cooldownUntil).toLocaleString()}</strong></span>
                          )}
                        </div>

                        {keyObj.lastError && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400">
                            Last Error: {keyObj.lastError}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 pr-1">
                          <span className="text-[11px] font-medium text-neutral-500">
                            {isEnabled ? 'On' : 'Off'}
                          </span>
                          <ChatSwitch
                            label={`Toggle ${keyObj.label}`}
                            checked={isEnabled}
                            disabled={togglingKeyId === keyObj.id}
                            onChange={() => handleToggleKeyEnabled(keyObj)}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={testingKeyId === keyObj.id}
                          onClick={() => handleTestKey(keyObj)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-[11px] font-medium text-neutral-700 hover:border-[#1ED760] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                        >
                          <Play className="h-3 w-3" />
                          {testingKeyId === keyObj.id ? 'Testing...' : 'Test'}
                        </button>

                        <button
                          type="button"
                          disabled={resettingKeyId === keyObj.id}
                          onClick={() => handleResetKeyQuota(keyObj)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-[11px] font-medium text-neutral-700 hover:border-[#1ED760] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                        >
                          <RotateCcw className="h-3 w-3" />
                          {resettingKeyId === keyObj.id ? 'Clearing...' : 'Reset Quota'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingKey(keyObj);
                            setEditKeyForm({
                              label: keyObj.label || '',
                              priority: String(keyObj.priority ?? 10),
                              modelOverride: keyObj.modelOverride || '',
                              apiKey: '',
                            });
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-[11px] font-medium text-neutral-700 hover:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteKeyTarget(keyObj)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-[11px] font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Gemini Key Modal */}
      {editingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveKeyEdit}
            className="w-full max-w-md space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Edit Key: {editingKey.label}
            </h3>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Label
              </label>
              <input
                type="text"
                required
                value={editKeyForm.label}
                onChange={(e) => setEditKeyForm((f) => ({ ...f, label: e.target.value }))}
                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  Priority
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editKeyForm.priority}
                  onChange={(e) => setEditKeyForm((f) => ({ ...f, priority: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs tabular-nums outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  Model Override
                </label>
                <input
                  type="text"
                  value={editKeyForm.modelOverride}
                  onChange={(e) => setEditKeyForm((f) => ({ ...f, modelOverride: e.target.value }))}
                  placeholder="Optional"
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Replace API Key (leave blank to keep current)
              </label>
              <input
                type="password"
                value={editKeyForm.apiKey}
                onChange={(e) => setEditKeyForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="AIzaSy..."
                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 font-mono text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingKey(null)}
                className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingKeyEdit}
                className="h-8 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
              >
                {savingKeyEdit ? 'Saving...' : 'Save Key'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Key Confirmation Modal */}
      {deleteKeyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Remove Gemini API Key?
            </h3>
            <p className="text-xs text-neutral-500">
              Are you sure you want to delete <strong>{deleteKeyTarget.label}</strong> ({deleteKeyTarget.maskedKey || deleteKeyTarget.keyPreview || 'key'}) from the pool?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteKeyTarget(null)}
                className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingKey}
                onClick={handleConfirmDeleteKey}
                className="h-8 rounded-lg bg-rose-600 px-3.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingKey ? 'Deleting...' : 'Delete Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-4">
          {/* Backup Card */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Platform Backup JSON Export
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Download a complete PostgreSQL snapshot (`GET /api/system/backup`) protected by admin re-authentication.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={downloadingBackup}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingBackup ? 'Exporting...' : 'Download Backup JSON'}
            </button>
          </div>

          {/* Integrations Navigation */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onNavigate?.('social-login')}
              className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-4 text-left transition hover:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                    Social Login OAuth
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    Google &amp; GitHub client credentials
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-neutral-400" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate?.('google-maps')}
              className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-4 text-left transition hover:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
                  <Map className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
                    Google Maps API Key
                  </span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    Manage PostgreSQL-backed maps key
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-neutral-400" />
                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
