import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Globe,
  MessageCircle,
  Monitor,
  Package,
  PlusSquare,
  RefreshCw,
  Save,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const DEFAULT_ADDONS = [
  {
    addonId: 'extra_products_25',
    name: '+25 Product Slots',
    price: 5,
    quantity: 25,
    description: 'Add 25 extra product slots to your active store catalog.',
    enabled: true,
  },
  {
    addonId: 'extra_products_100',
    name: '+100 Product Slots',
    price: 12,
    quantity: 100,
    description: 'Add 100 extra product slots to your active store catalog.',
    enabled: true,
  },
  {
    addonId: 'pos_access',
    name: 'POS System Access',
    price: 9,
    quantity: 1,
    description: 'Unlock the in-store POS register and barcode receipt terminal.',
    enabled: true,
  },
  {
    addonId: 'extra_staff_3',
    name: '+3 Staff Seats',
    price: 6,
    quantity: 3,
    description: 'Add 3 additional team member seats with role-based permissions.',
    enabled: true,
  },
];

function getAddonKey(addon) {
  return addon?.addonId || addon?.id || '';
}

function normalizeAddonsList(serverAddons) {
  if (!Array.isArray(serverAddons) || serverAddons.length === 0) {
    return DEFAULT_ADDONS.map((item) => ({ ...item }));
  }
  const byId = new Map(serverAddons.map((item) => [getAddonKey(item), item]));
  const merged = DEFAULT_ADDONS.map((def) => {
    const existing = byId.get(def.addonId);
    if (!existing) return { ...def };
    return {
      ...def,
      ...existing,
      addonId: getAddonKey(existing) || def.addonId,
      name: existing.name ?? def.name,
      price: existing.price ?? def.price,
      quantity: existing.quantity ?? existing.slots ?? def.quantity,
      description: existing.description ?? def.description,
      enabled: existing.enabled !== false,
    };
  });
  for (const item of serverAddons) {
    const key = getAddonKey(item);
    if (key && !DEFAULT_ADDONS.some((d) => d.addonId === key)) {
      merged.push({
        ...item,
        addonId: key,
        quantity: item.quantity ?? item.slots ?? 1,
        enabled: item.enabled !== false,
      });
    }
  }
  return merged;
}

export default function AdminPackagesView({ onBackToDashboard, showToast }) {
  const currencyCtx = useAdminCurrency();
  const [activeTab, setActiveTab] = useState('ecommerce');
  const [packages, setPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [discordPackages, setDiscordPackages] = useState([]);
  const [whatsappPackages, setWhatsappPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const fetchPackagesData = async () => {
    const token = localStorage.getItem('stockpro_session');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const [ecomRes, discordRes, waRes] = await Promise.all([
      fetch(`${API_BASE}/admin/packages`, { credentials: 'include', headers }),
      fetch(`${API_BASE}/discord/admin/packages`, { credentials: 'include', headers }),
      fetch(`${API_BASE}/whatsapp/admin/packages`, { credentials: 'include', headers }),
    ]);

    const ecomJson = await ecomRes.json();
    if (!ecomRes.ok || !ecomJson.success) {
      throw new Error(ecomJson.error || 'Failed to load e-commerce packages.');
    }

    const discordJson = discordRes.ok ? await discordRes.json().catch(() => ({})) : {};
    const waJson = waRes.ok ? await waRes.json().catch(() => ({})) : {};

    return {
      packages: Array.isArray(ecomJson.packages) ? ecomJson.packages : [],
      addons: normalizeAddonsList(ecomJson.addons),
      discordPackages: Array.isArray(discordJson.packages) ? discordJson.packages : [],
      whatsappPackages: Array.isArray(waJson.packages) ? waJson.packages : [],
    };
  };

  const loadPackages = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await fetchPackagesData();
      setPackages(data.packages);
      setAddons(data.addons);
      setDiscordPackages(data.discordPackages);
      setWhatsappPackages(data.whatsappPackages);
    } catch (err) {
      setErrorMsg(err.message || 'Could not load packages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchPackagesData()
      .then((data) => {
        if (cancelled) return;
        setPackages(data.packages);
        setAddons(data.addons);
        setDiscordPackages(data.discordPackages);
        setWhatsappPackages(data.whatsappPackages);
      })
      .catch((err) => {
        if (!cancelled) setErrorMsg(err.message || 'Could not load packages.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePackageField = (planId, field, value) => {
    setPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.planId !== planId) return pkg;
        if (planId === 'free' && field === 'price') return { ...pkg, price: 0 };
        if (planId === 'free' && field === 'enabled') return { ...pkg, enabled: true };
        return { ...pkg, [field]: value };
      })
    );
  };

  const updateAddonField = (addonId, field, value) => {
    setAddons((prev) =>
      prev.map((addon) => {
        if (getAddonKey(addon) !== addonId) return addon;
        return { ...addon, [field]: value };
      })
    );
  };

  const updateDiscordField = (planId, field, value) => {
    setDiscordPackages((prev) =>
      prev.map((pkg) => (pkg.planId === planId ? { ...pkg, [field]: value } : pkg))
    );
  };

  const updateWhatsappField = (planId, field, value) => {
    setWhatsappPackages((prev) =>
      prev.map((pkg) => (pkg.planId === planId ? { ...pkg, [field]: value } : pkg))
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      const token = localStorage.getItem('stockpro_session');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const sanitizedPackages = packages.map((pkg) => {
        const isFree = pkg.planId === 'free';
        const price = isFree ? 0 : Math.max(0, Number(pkg.price || 0));
        const productLimit = Math.max(1, Math.round(Number(pkg.productLimit || 50)));
        const warehouseLimit = Math.max(1, Math.round(Number(pkg.warehouseLimit || 1)));
        const staffLimit = Math.max(1, Math.round(Number(pkg.staffLimit ?? 1)));
        const monthlyOrderLimit = Math.max(1, Math.round(Number(pkg.monthlyOrderLimit ?? 100)));
        return {
          ...pkg,
          price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
          productLimit: Number.isFinite(productLimit) ? productLimit : 50,
          warehouseLimit: Number.isFinite(warehouseLimit) ? warehouseLimit : 1,
          staffLimit: Number.isFinite(staffLimit) ? staffLimit : 1,
          monthlyOrderLimit: Number.isFinite(monthlyOrderLimit) ? monthlyOrderLimit : 100,
          hasCustomDomain: Boolean(pkg.hasCustomDomain),
          hasPos: Boolean(pkg.hasPos),
          enabled: isFree ? true : pkg.enabled !== false,
        };
      });

      const sanitizedAddons = addons.map((addon) => {
        const price = Math.max(0, Number(addon.price || 0));
        const quantity = Math.max(1, Math.round(Number(addon.quantity ?? 1)));
        return {
          ...addon,
          addonId: getAddonKey(addon),
          name: String(addon.name || '').trim() || getAddonKey(addon),
          price: Number.isFinite(price) ? Number(price.toFixed(2)) : 0,
          quantity: Number.isFinite(quantity) ? quantity : 1,
          description: String(addon.description || '').trim(),
          enabled: addon.enabled !== false,
        };
      });

      const sanitizedDiscord = discordPackages.map((pkg) => ({
        ...pkg,
        planName: String(pkg.planName || pkg.planId).trim(),
        badge: String(pkg.badge || '').trim(),
        description: String(pkg.description || '').trim(),
        price: Math.max(1, Number(Number(pkg.price || 9).toFixed(2))),
        maxBots: Math.max(1, Math.round(Number(pkg.maxBots || 1))),
        maxServersPerBot: Math.max(1, Math.round(Number(pkg.maxServersPerBot || 1))),
        monthlyCommandsLimit: Math.max(100, Math.round(Number(pkg.monthlyCommandsLimit || 2500))),
        webhookLimit: Math.max(1, Math.round(Number(pkg.webhookLimit || 2))),
        autoModEnabled: Boolean(pkg.autoModEnabled),
        customBranding: Boolean(pkg.customBranding),
        enabled: pkg.enabled !== false,
        features: Array.isArray(pkg.features)
          ? pkg.features.map((f) => String(f || '').trim()).filter(Boolean)
          : String(pkg.features || '').split('\n').map((f) => f.trim()).filter(Boolean),
      }));

      const sanitizedWhatsapp = whatsappPackages.map((pkg) => ({
        ...pkg,
        planName: String(pkg.planName || pkg.planId).trim(),
        badge: String(pkg.badge || '').trim(),
        description: String(pkg.description || '').trim(),
        price: Math.max(1, Number(Number(pkg.price || 12).toFixed(2))),
        maxSessions: Math.max(1, Math.round(Number(pkg.maxSessions || 1))),
        monthlyMessagesLimit: Math.max(100, Math.round(Number(pkg.monthlyMessagesLimit || 2000))),
        dailyBroadcastLimit: Math.max(1, Math.round(Number(pkg.dailyBroadcastLimit || 100))),
        autoReplyFlowsLimit: Math.max(1, Math.round(Number(pkg.autoReplyFlowsLimit || 3))),
        contactLimit: Math.max(50, Math.round(Number(pkg.contactLimit || 1000))),
        webhookEnabled: Boolean(pkg.webhookEnabled),
        enabled: pkg.enabled !== false,
        features: Array.isArray(pkg.features)
          ? pkg.features.map((f) => String(f || '').trim()).filter(Boolean)
          : String(pkg.features || '').split('\n').map((f) => f.trim()).filter(Boolean),
      }));

      const requests = [
        fetch(`${API_BASE}/admin/packages`, {
          method: 'PUT',
          credentials: 'include',
          headers,
          body: JSON.stringify({ packages: sanitizedPackages, addons: sanitizedAddons }),
        }),
      ];

      if (sanitizedDiscord.length > 0) {
        requests.push(
          fetch(`${API_BASE}/discord/admin/packages`, {
            method: 'PUT',
            credentials: 'include',
            headers,
            body: JSON.stringify({ packages: sanitizedDiscord }),
          })
        );
      }

      if (sanitizedWhatsapp.length > 0) {
        requests.push(
          fetch(`${API_BASE}/whatsapp/admin/packages`, {
            method: 'PUT',
            credentials: 'include',
            headers,
            body: JSON.stringify({ packages: sanitizedWhatsapp }),
          })
        );
      }

      const responses = await Promise.all(requests);
      const jsons = await Promise.all(responses.map((r) => r.json().catch(() => ({}))));

      if (!responses[0].ok || !jsons[0].success) {
        throw new Error(jsons[0].error || 'Failed to save e-commerce packages.');
      }
      setPackages(Array.isArray(jsons[0].packages) ? jsons[0].packages : sanitizedPackages);
      setAddons(normalizeAddonsList(jsons[0].addons || sanitizedAddons));

      let idx = 1;
      if (sanitizedDiscord.length > 0) {
        const dRes = responses[idx];
        const dJson = jsons[idx++];
        if (!dRes.ok || !dJson.success) {
          throw new Error(dJson.error || 'Failed to save Discord Bot packages.');
        }
        setDiscordPackages(Array.isArray(dJson.packages) ? dJson.packages : sanitizedDiscord);
      }

      if (sanitizedWhatsapp.length > 0) {
        const wRes = responses[idx];
        const wJson = jsons[idx++];
        if (!wRes.ok || !wJson.success) {
          throw new Error(wJson.error || 'Failed to save WhatsApp Bot packages.');
        }
        setWhatsappPackages(Array.isArray(wJson.packages) ? wJson.packages : sanitizedWhatsapp);
      }

      showToast?.('All subscription packages saved.', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save packages.');
      showToast?.(err.message || 'Failed to save packages.', 'error');
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            Packages &amp; Store Add-ons
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Configure USD base monthly pricing, tier quotas, POS access, and purchasable add-ons with live currency preview.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadPackages}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Shadcn-style Section Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-neutral-100/80 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
        {[
          { id: 'ecommerce', label: 'E-Commerce Plans', icon: Package, count: packages.length },
          { id: 'addons', label: 'E-Commerce Add-ons', icon: PlusSquare, count: addons.length },
          { id: 'discord', label: 'Discord Bot Plans', icon: Bot, count: discordPackages.length },
          { id: 'whatsapp', label: 'WhatsApp Bot Plans', icon: MessageCircle, count: whatsappPackages.length },
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
                  ? 'bg-white text-neutral-950 shadow-sm dark:bg-neutral-950 dark:text-white ring-1 ring-neutral-200/80 dark:ring-neutral-800'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#1ED760]' : ''}`} />
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
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

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-72 animate-pulse rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'ecommerce' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                Monthly E-Commerce Packages
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Set quotas, staff seats, monthly order limits, and module access for each tier.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {packages.map((pkg) => {
                const isFree = pkg.planId === 'free';
                const usdPrice = isFree ? 0 : Number(pkg.price || 0);
                return (
                  <div
                    key={pkg.planId}
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          <Package className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {pkg.planName}
                          </p>
                          <p className="font-mono text-[11px] text-neutral-500">
                            ID: {pkg.planId} {isFree ? '· Always Active' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={isFree ? true : pkg.enabled !== false}
                            disabled={isFree}
                            onChange={(e) => updatePackageField(pkg.planId, 'enabled', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                          />
                          Active
                        </label>
                        <span className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                          ${usdPrice.toFixed(2)} USD · {formatMoney(usdPrice)}/mo
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Package Name
                        </label>
                        <input
                          type="text"
                          value={pkg.planName || ''}
                          onChange={(e) => updatePackageField(pkg.planId, 'planName', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Price ($ USD/mo)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={isFree}
                          value={isFree ? 0 : (pkg.price ?? 0)}
                          onChange={(e) => updatePackageField(pkg.planId, 'price', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:disabled:bg-neutral-800"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Product Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.productLimit ?? 50}
                          onChange={(e) => updatePackageField(pkg.planId, 'productLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Warehouse Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.warehouseLimit ?? 1}
                          onChange={(e) => updatePackageField(pkg.planId, 'warehouseLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Staff Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.staffLimit ?? 1}
                          onChange={(e) => updatePackageField(pkg.planId, 'staffLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Order Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.monthlyOrderLimit ?? 100}
                          onChange={(e) => updatePackageField(pkg.planId, 'monthlyOrderLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Description
                      </label>
                      <input
                        type="text"
                        value={pkg.description || ''}
                        onChange={(e) => updatePackageField(pkg.planId, 'description', e.target.value)}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={Boolean(pkg.hasCustomDomain)}
                            onChange={(e) => updatePackageField(pkg.planId, 'hasCustomDomain', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                          />
                          <Globe className="h-3.5 w-3.5 text-neutral-500" />
                          Custom Domain
                        </label>

                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={Boolean(pkg.hasPos)}
                            onChange={(e) => updatePackageField(pkg.planId, 'hasPos', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                          />
                          <Monitor className="h-3.5 w-3.5 text-neutral-500" />
                          POS System
                        </label>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                        <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                        Monthly Credits
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {activeTab === 'addons' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                Store Add-ons
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Configure optional monthly add-ons merchants can purchase using Cloud Credits.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {addons.map((addon) => {
                const addonId = getAddonKey(addon);
                const addonPriceUsd = Number(addon.price || 0);
                return (
                  <div
                    key={addonId}
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          <PlusSquare className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                            {addon.name || addonId}
                          </p>
                          <p className="font-mono text-[11px] text-neutral-500">
                            ID: {addonId}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={addon.enabled !== false}
                            onChange={(e) => updateAddonField(addonId, 'enabled', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                          />
                          Active
                        </label>
                        <span className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                          ${addonPriceUsd.toFixed(2)} USD · {formatMoney(addonPriceUsd)}/mo
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Add-on Name
                        </label>
                        <input
                          type="text"
                          value={addon.name || ''}
                          onChange={(e) => updateAddonField(addonId, 'name', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Price ($ USD/mo)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={addon.price ?? 0}
                          onChange={(e) => updateAddonField(addonId, 'price', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Quantity / Slots
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={addon.quantity ?? 1}
                          onChange={(e) => updateAddonField(addonId, 'quantity', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Description
                      </label>
                      <input
                        type="text"
                        value={addon.description || ''}
                        onChange={(e) => updateAddonField(addonId, 'description', e.target.value)}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {activeTab === 'discord' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                Official Discord AI Bot Plans (Paid via Tiwlo Credits)
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                All Discord Bot subscriptions require verified Tiwlo Credits (minimum $1.00 USD/mo). Configure connected server caps, monthly AI command quotas, and auto-moderation access.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {discordPackages.map((pkg) => {
                const usdPrice = Number(pkg.price || 9);
                return (
                  <div
                    key={pkg.planId}
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          <Bot className="h-4 w-4 text-[#1ED760]" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {pkg.planName}
                            </p>
                            {pkg.badge && (
                              <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                                {pkg.badge}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[11px] uppercase text-neutral-500">
                            ID: {pkg.planId}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={pkg.enabled !== false}
                            onChange={(e) => updateDiscordField(pkg.planId, 'enabled', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                          />
                          Active
                        </label>
                        <span className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                          ${usdPrice.toFixed(2)} USD · {formatMoney(usdPrice)}/mo
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Plan Name
                        </label>
                        <input
                          type="text"
                          value={pkg.planName || ''}
                          onChange={(e) => updateDiscordField(pkg.planId, 'planName', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Credits Price ($ USD)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={pkg.price ?? 9}
                          onChange={(e) => updateDiscordField(pkg.planId, 'price', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Badge
                        </label>
                        <input
                          type="text"
                          value={pkg.badge || ''}
                          placeholder="e.g. Most Popular"
                          onChange={(e) => updateDiscordField(pkg.planId, 'badge', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Max Connected Servers
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.maxServersPerBot ?? 1}
                          onChange={(e) => updateDiscordField(pkg.planId, 'maxServersPerBot', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly AI Commands Limit
                        </label>
                        <input
                          type="number"
                          min="100"
                          value={pkg.monthlyCommandsLimit ?? 2500}
                          onChange={(e) => updateDiscordField(pkg.planId, 'monthlyCommandsLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Webhook Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.webhookLimit ?? 2}
                          onChange={(e) => updateDiscordField(pkg.planId, 'webhookLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Description
                      </label>
                      <input
                        type="text"
                        value={pkg.description || ''}
                        onChange={(e) => updateDiscordField(pkg.planId, 'description', e.target.value)}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Features (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={Array.isArray(pkg.features) ? pkg.features.join('\n') : (pkg.features || '')}
                        onChange={(e) => updateDiscordField(pkg.planId, 'features', e.target.value.split('\n'))}
                        className="w-full rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.autoModEnabled)}
                          onChange={(e) => updateDiscordField(pkg.planId, 'autoModEnabled', e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                        />
                        <Shield className="h-3.5 w-3.5 text-neutral-400" />
                        Auto-Moderation Suite
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.customBranding)}
                          onChange={(e) => updateDiscordField(pkg.planId, 'customBranding', e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                        />
                        <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
                        Custom Persona Branding
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {activeTab === 'whatsapp' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                WhatsApp Messaging &amp; AI Bot Plans (Paid via Tiwlo Credits)
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                All WhatsApp Bot subscriptions require verified Tiwlo Credits (minimum $1.00 USD/mo). Configure active QR sessions, monthly messages, daily broadcasts, and auto-reply flow caps.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {whatsappPackages.map((pkg) => {
                const usdPrice = Number(pkg.price || 12);
                return (
                  <div
                    key={pkg.planId}
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                          <MessageCircle className="h-4 w-4 text-[#1ED760]" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                              {pkg.planName}
                            </p>
                            {pkg.badge && (
                              <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                                {pkg.badge}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[11px] uppercase text-neutral-500">
                            ID: {pkg.planId}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={pkg.enabled !== false}
                            onChange={(e) => updateWhatsappField(pkg.planId, 'enabled', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                          />
                          Active
                        </label>
                        <span className="text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                          ${usdPrice.toFixed(2)} USD · {formatMoney(usdPrice)}/mo
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Plan Name
                        </label>
                        <input
                          type="text"
                          value={pkg.planName || ''}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'planName', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Credits Price ($ USD)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={pkg.price ?? 12}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'price', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Badge
                        </label>
                        <input
                          type="text"
                          value={pkg.badge || ''}
                          placeholder="e.g. Best Seller"
                          onChange={(e) => updateWhatsappField(pkg.planId, 'badge', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Max WhatsApp Sessions
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.maxSessions ?? 1}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'maxSessions', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Messages Limit
                        </label>
                        <input
                          type="number"
                          min="100"
                          value={pkg.monthlyMessagesLimit ?? 2000}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'monthlyMessagesLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Daily Broadcast Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.dailyBroadcastLimit ?? 100}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'dailyBroadcastLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Auto-Reply Flows Limit
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={pkg.autoReplyFlowsLimit ?? 3}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'autoReplyFlowsLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Contacts Limit
                        </label>
                        <input
                          type="number"
                          min="50"
                          value={pkg.contactLimit ?? 1000}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'contactLimit', e.target.value)}
                          className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Description
                      </label>
                      <input
                        type="text"
                        value={pkg.description || ''}
                        onChange={(e) => updateWhatsappField(pkg.planId, 'description', e.target.value)}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Features (one per line)
                      </label>
                      <textarea
                        rows={3}
                        value={Array.isArray(pkg.features) ? pkg.features.join('\n') : (pkg.features || '')}
                        onChange={(e) => updateWhatsappField(pkg.planId, 'features', e.target.value.split('\n'))}
                        className="w-full rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={Boolean(pkg.webhookEnabled)}
                          onChange={(e) => updateWhatsappField(pkg.planId, 'webhookEnabled', e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760]"
                        />
                        <Globe className="h-3.5 w-3.5 text-neutral-400" />
                        Custom Webhook Automation
                      </label>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                        <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                        Monthly Credits
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          )}
        </>
      )}
    </div>
  );
}
