import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Gift,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const buildWelcomeCopy = ({ minDepositUsd = 1, bonusAmountUsd = 50, validityDays = 30 } = {}) => {
  const minText = `$${Number(minDepositUsd || 1).toFixed(2)}`;
  const bonusText = `$${Number(bonusAmountUsd || 0).toFixed(2)}`;
  const days = Number(validityDays || 30);
  return {
    title: `New Account ${bonusText} Gift Offer`,
    headline: `Load ${minText} credit to get ${bonusText} gift for ${days} days`,
    description: `New accounts that load at least ${minText} USD receive ${bonusText} USD in gift credits valid for ${days} days.`,
  };
};

const EMPTY_WELCOME = {
  enabled: true,
  ...buildWelcomeCopy({ minDepositUsd: 1, bonusAmountUsd: 50, validityDays: 30 }),
  badgeText: 'New Account Offer',
  minDepositUsd: 1,
  bonusAmountUsd: 50,
  validityDays: 30,
  newAccountsOnly: true,
  onePerDevice: true,
};

const EMPTY_CODE_FORM = {
  code: '',
  description: '',
  rewardType: 'promo_credit',
  amountUsd: '25',
  validityDays: '30',
  minTopupUsd: '0',
  maxTotalUses: '',
  targetType: 'all',
  targetEmails: '',
  onePerDevice: true,
  newAccountsOnly: false,
};

export default function AdminPromotionsView({ onBackToDashboard, showToast }) {
  const currencyCtx = useAdminCurrency();
  const [welcomePromo, setWelcomePromo] = useState(EMPTY_WELCOME);
  const [promoCodes, setPromoCodes] = useState([]);
  const [recentClaims, setRecentClaims] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [codeForm, setCodeForm] = useState(EMPTY_CODE_FORM);
  const [loading, setLoading] = useState(true);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const formatMoney = useCallback((amountUsd, options) => {
    if (typeof currencyCtx?.formatMoney === 'function') {
      return currencyCtx.formatMoney(amountUsd, options);
    }
    const n = Number(amountUsd || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  }, [currencyCtx]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('stockpro_session');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchPromotionsBundle = async () => {
    const [promoRes, usersRes] = await Promise.all([
      fetch(`${API_BASE}/admin/promotions`, { credentials: 'include', headers: getAuthHeaders() }),
      fetch(`${API_BASE}/admin/users?limit=100`, { credentials: 'include', headers: getAuthHeaders() }).catch(() => null),
    ]);
    const promoJson = await promoRes.json();
    if (!promoRes.ok || !promoJson.success) {
      throw new Error(promoJson.error || 'Failed to load promotions settings.');
    }
    const usersJson = usersRes?.ok ? await usersRes.json().catch(() => null) : null;
    return {
      welcomePromo: { ...EMPTY_WELCOME, ...(promoJson.welcomePromo || {}) },
      promoCodes: Array.isArray(promoJson.promoCodes) ? promoJson.promoCodes : [],
      recentClaims: Array.isArray(promoJson.recentClaims) ? promoJson.recentClaims : [],
      directoryUsers: Array.isArray(usersJson?.users) ? usersJson.users : null,
    };
  };

  const applyPromotionsBundle = (bundle) => {
    setWelcomePromo(bundle.welcomePromo);
    setPromoCodes(bundle.promoCodes);
    setRecentClaims(bundle.recentClaims);
    if (bundle.directoryUsers) {
      setDirectoryUsers(bundle.directoryUsers);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const bundle = await fetchPromotionsBundle();
      applyPromotionsBundle(bundle);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load promotions data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bundle = await fetchPromotionsBundle();
        if (!cancelled) {
          applyPromotionsBundle(bundle);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Unable to load promotions data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveWelcome = async (e) => {
    e.preventDefault();
    try {
      setSavingWelcome(true);
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/admin/promotions/welcome`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(welcomePromo),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update welcome promotion.');
      }
      setWelcomePromo(json.welcomePromo);
      showToast?.('Welcome credit promotion saved.', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save welcome promotion.');
    } finally {
      setSavingWelcome(false);
    }
  };

  const handleCreatePromoCode = async (e) => {
    e.preventDefault();
    try {
      setCreatingCode(true);
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/admin/promotions/codes`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...codeForm,
          amountUsd: Number(codeForm.amountUsd),
          validityDays: Number(codeForm.validityDays),
          minTopupUsd: Number(codeForm.minTopupUsd || 0),
          maxTotalUses: codeForm.maxTotalUses ? Number(codeForm.maxTotalUses) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create promotional code.');
      }
      setPromoCodes((prev) => [json.promo, ...prev]);
      setCodeForm(EMPTY_CODE_FORM);
      showToast?.(`Promo code ${json.promo.code} created.`, 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create promotional code.');
    } finally {
      setCreatingCode(false);
    }
  };

  const handleToggleCode = async (promo) => {
    try {
      const res = await fetch(`${API_BASE}/admin/promotions/codes/${encodeURIComponent(promo.id)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Update failed.');
      setPromoCodes((prev) => prev.map((item) => (item.id === promo.id ? json.promo : item)));
      showToast?.(`${promo.code} ${json.promo.isActive ? 'enabled' : 'paused'}.`, 'success');
    } catch (err) {
      showToast?.(err.message || 'Could not update promo code.', 'error');
    }
  };

  const handleDeleteCode = async (promo) => {
    try {
      const res = await fetch(`${API_BASE}/admin/promotions/codes/${encodeURIComponent(promo.id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Delete failed.');
      setPromoCodes((prev) => prev.filter((item) => item.id !== promo.id));
      showToast?.(`${promo.code} removed.`, 'success');
    } catch (err) {
      showToast?.(err.message || 'Could not delete promo code.', 'error');
    }
  };

  const appendTargetEmail = (email) => {
    if (!email) return;
    const current = codeForm.targetEmails
      .split(/[\s,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (current.includes(email.toLowerCase())) return;
    setCodeForm((prev) => ({
      ...prev,
      targetEmails: [...current, email.toLowerCase()].join(', '),
    }));
  };

  const filteredDirectory = directoryUsers
    .filter((u) => {
      if (!userSearch.trim()) return true;
      const q = userSearch.trim().toLowerCase();
      return (
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.tiwiId || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  const updateWelcomeNumericField = (field, rawValue) => {
    const numValue = Number(rawValue);
    setWelcomePromo((prev) => {
      const next = { ...prev, [field]: numValue };
      const prevAuto = buildWelcomeCopy(prev);
      const nextAuto = buildWelcomeCopy(next);
      const headlineWasAuto =
        !prev.headline ||
        prev.headline === prevAuto.headline ||
        /^Get \$\d+(?:\.\d+)? (?:promotional|gift) credit for \d+ days$/i.test(prev.headline);
      const descWasAuto =
        !prev.description ||
        prev.description === prevAuto.description ||
        /^Load at least \$\d+(?:\.\d+)? USD on your new account to unlock \$\d+(?:\.\d+)? in gift credits valid for \d+ days\.$/i.test(
          prev.description
        );

      return {
        ...next,
        title: !prev.title || prev.title === prevAuto.title ? nextAuto.title : prev.title,
        headline: headlineWasAuto ? nextAuto.headline : prev.headline,
        description: descWasAuto ? nextAuto.description : prev.description,
      };
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center">
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
            Promotions &amp; Trial Credits
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Configure credit-load welcome offers, free-trial expiration windows, targeted promo codes, and multi-device abuse controls.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Section 1: Credit-Load Gift / Trial Offer */}
      <form
        onSubmit={handleSaveWelcome}
        className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <Gift className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                New Account Credit-Load Offer
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Displayed at the top of the Billing page for eligible new accounts.
              </p>
            </div>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-200">
            <input
              type="checkbox"
              checked={welcomePromo.enabled}
              onChange={(e) => setWelcomePromo((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
            />
            Offer Enabled
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Minimum Credit Load ($ USD)
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={welcomePromo.minDepositUsd}
              onChange={(e) => updateWelcomeNumericField('minDepositUsd', e.target.value)}
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
              Display: {formatMoney(welcomePromo.minDepositUsd)}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Promotional Gift Credit ($ USD)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={welcomePromo.bonusAmountUsd}
              onChange={(e) => updateWelcomeNumericField('bonusAmountUsd', e.target.value)}
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            <p className="mt-1 text-[11px] tabular-nums text-emerald-700 dark:text-[#1ED760]">
              Display: {formatMoney(welcomePromo.bonusAmountUsd)}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Trial Validity Duration (Days)
            </label>
            <input
              type="number"
              min="1"
              max="365"
              required
              value={welcomePromo.validityDays}
              onChange={(e) => updateWelcomeNumericField('validityDays', e.target.value)}
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Billing Banner Headline
            </label>
            <input
              type="text"
              required
              value={welcomePromo.headline}
              onChange={(e) => setWelcomePromo((prev) => ({ ...prev, headline: e.target.value }))}
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Badge Label
            </label>
            <input
              type="text"
              value={welcomePromo.badgeText}
              onChange={(e) => setWelcomePromo((prev) => ({ ...prev, badgeText: e.target.value }))}
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Banner Description
            </label>
            <input
              type="text"
              value={welcomePromo.description}
              onChange={(e) => setWelcomePromo((prev) => ({ ...prev, description: e.target.value }))}
              className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200/80 pt-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-5 text-xs text-neutral-700 dark:text-neutral-300">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={welcomePromo.newAccountsOnly}
                onChange={(e) => setWelcomePromo((prev) => ({ ...prev, newAccountsOnly: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
              />
              New accounts only (never funded)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={welcomePromo.onePerDevice}
                onChange={(e) => setWelcomePromo((prev) => ({ ...prev, onePerDevice: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
              />
              Strict 1 claim per device fingerprint / IP (auto-ban abuse)
            </label>
          </div>

          <button
            type="submit"
            disabled={savingWelcome}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {savingWelcome ? 'Saving...' : 'Save Offer'}
          </button>
        </div>
      </form>

      {/* Section 2: Promotional Codes & Target Assigning */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleCreatePromoCode}
          className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 lg:col-span-5"
        >
          <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
            <Tag className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
            <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Create Promo Code &amp; Assign Targets
            </h2>
          </div>

          <div className="mt-4 space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Promo Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="WELCOME50"
                  value={codeForm.code}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs uppercase text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Gift Amount ($ USD)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={codeForm.amountUsd}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, amountUsd: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                  Display: {formatMoney(codeForm.amountUsd)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Validity (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={codeForm.validityDays}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, validityDays: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Min Topup ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={codeForm.minTopupUsd}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, minTopupUsd: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Max Uses
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={codeForm.maxTotalUses}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, maxTotalUses: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Credit Type
                </label>
                <select
                  value={codeForm.rewardType}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, rewardType: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="promo_credit">Promotional Credit Wallet (Separate from Cash)</option>
                  <option value="standard_credit">Cash Wallet Credit (Counts as Deposited Cash)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Target Assignment
                </label>
                <select
                  value={codeForm.targetType}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, targetType: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="all">All Accounts</option>
                  <option value="new_accounts">New Accounts Only</option>
                  <option value="specific_users">Specific Assigned Users</option>
                </select>
              </div>
            </div>

            {codeForm.targetType === 'specific_users' && (
              <div className="space-y-2 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                  Assigned Account Emails (comma-separated)
                </label>
                <textarea
                  rows={2}
                  placeholder="merchant1@example.com, merchant2@example.com"
                  value={codeForm.targetEmails}
                  onChange={(e) => setCodeForm((prev) => ({ ...prev, targetEmails: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 py-2 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                />
                {directoryUsers.length > 0 && (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Quick search user by email or TIW ID..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="h-8 w-full rounded-lg border border-neutral-200/80 bg-white px-2.5 text-[11px] text-neutral-950 outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                    <div className="flex flex-wrap gap-1">
                      {filteredDirectory.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => appendTargetEmail(u.email)}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        >
                          <Plus className="h-3 w-3" />
                          {u.email}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Internal / Customer Note
              </label>
              <input
                type="text"
                placeholder="VIP onboarding bonus or partner coupon"
                value={codeForm.description}
                onChange={(e) => setCodeForm((prev) => ({ ...prev, description: e.target.value }))}
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={codeForm.onePerDevice}
                onChange={(e) => setCodeForm((prev) => ({ ...prev, onePerDevice: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
              />
              Lock to 1 redemption per device fingerprint &amp; IP
            </label>

            <button
              type="submit"
              disabled={creatingCode}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {creatingCode ? 'Creating...' : 'Create Promo Code'}
            </button>
          </div>
        </form>

        {/* Active & Historical Promo Codes Table */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Active Promotional Codes ({promoCodes.length})
              </h2>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            {promoCodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                No custom promo codes created yet. Use the form on the left to issue one.
              </div>
            ) : (
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200/80 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Reward</th>
                    <th className="pb-2 font-medium">Target</th>
                    <th className="pb-2 font-medium">Uses</th>
                    <th className="pb-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                  {promoCodes.map((promo) => (
                    <tr key={promo.id} className="align-top">
                      <td className="py-3 pr-2">
                        <span className="font-mono font-semibold text-neutral-950 dark:text-white">
                          {promo.code}
                        </span>
                        {promo.description && (
                          <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                            {promo.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-2 text-neutral-800 dark:text-neutral-200">
                        <span className="font-semibold tabular-nums">${Number(promo.amountUsd).toFixed(2)}</span>
                        <span className="ml-1 text-[11px] tabular-nums text-emerald-700 dark:text-[#1ED760]">
                          ({formatMoney(promo.amountUsd)})
                        </span>
                        <span className="block text-[11px] text-neutral-500">
                          {promo.validityDays}d · {promo.rewardType === 'standard_credit' ? 'Standard' : 'Trial Gift'}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <span className="inline-block rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
                          {promo.targetType === 'specific_users'
                            ? `Assigned (${promo.targetEmails?.length || 0})`
                            : promo.targetType === 'new_accounts'
                              ? 'New Accounts'
                              : 'All Accounts'}
                        </span>
                        {promo.targetType === 'specific_users' && promo.targetEmails?.length > 0 && (
                          <p
                            className="mt-1 max-w-[160px] truncate text-[10px] text-neutral-500"
                            title={promo.targetEmails.join(', ')}
                          >
                            {promo.targetEmails.join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-2 tabular-nums text-neutral-700 dark:text-neutral-300">
                        {promo.usesCount} / {promo.maxTotalUses ?? '∞'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleCode(promo)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                              promo.isActive
                                ? 'border-[#1ED760]/40 bg-[#1ED760]/10 text-emerald-800 hover:bg-[#1ED760]/20 dark:text-[#1ED760]'
                                : 'border-neutral-200/80 bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300'
                            }`}
                          >
                            {promo.isActive ? 'Active' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCode(promo)}
                            title="Delete code"
                            className="rounded-lg border border-neutral-200 p-1 text-neutral-500 hover:border-rose-200 hover:text-rose-600 dark:border-neutral-800 dark:hover:border-rose-900"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Claims & Device Abuse Security Audit */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
        <div className="flex items-center gap-2 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
          <ShieldCheck className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
          <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
            Promotion Claims &amp; Anti-Abuse Log ({recentClaims.length})
          </h2>
        </div>

        <div className="mt-4 overflow-x-auto">
          {recentClaims.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 py-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              No promotional credits or multi-device claim blocks recorded yet.
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200/80 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  <th className="pb-2 font-medium">Account</th>
                  <th className="pb-2 font-medium">Promotion</th>
                  <th className="pb-2 font-medium">Credit</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                {recentClaims.map((claim) => (
                  <tr key={claim.id}>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-neutral-950 dark:text-white">
                        {claim.userEmail || claim.userId}
                      </span>
                      {claim.tiwiId && (
                        <span className="ml-2 font-mono text-[10px] text-neutral-500">{claim.tiwiId}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                      {claim.promoCode || claim.claimType}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-neutral-800 dark:text-neutral-200">
                      ${Number(claim.amountUsd).toFixed(2)} ({formatMoney(claim.amountUsd)}) · {claim.validityDays}d
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          claim.status === 'granted'
                            ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {claim.status === 'granted' && <Check className="h-3 w-3" />}
                        {claim.status}
                        {claim.isBanned ? ' · Banned' : ''}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[11px] text-neutral-500">
                      {new Date(claim.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
