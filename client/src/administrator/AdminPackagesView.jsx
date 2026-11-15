import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Globe,
  Monitor,
  Package,
  PlusSquare,
  RefreshCw,
  Save
} from 'lucide-react';

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
    enabled: true
  },
  {
    addonId: 'extra_products_100',
    name: '+100 Product Slots',
    price: 15,
    quantity: 100,
    description: 'Add 100 extra product slots to your active store catalog.',
    enabled: true
  },
  {
    addonId: 'pos_access',
    name: 'POS System Access',
    price: 10,
    quantity: 1,
    description: 'Unlock the in-store POS register and barcode receipt terminal.',
    enabled: true
  },
  {
    addonId: 'extra_staff_3',
    name: '+3 Staff Seats',
    price: 8,
    quantity: 3,
    description: 'Add 3 additional team member seats with role-based permissions.',
    enabled: true
  }
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
      enabled: existing.enabled !== false
    };
  });
  for (const item of serverAddons) {
    const key = getAddonKey(item);
    if (key && !DEFAULT_ADDONS.some((d) => d.addonId === key)) {
      merged.push({
        ...item,
        addonId: key,
        quantity: item.quantity ?? item.slots ?? 1,
        enabled: item.enabled !== false
      });
    }
  }
  return merged;
}

export default function AdminPackagesView({ onBackToDashboard, showToast }) {
  const [packages, setPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPackagesData = async () => {
    const token = localStorage.getItem('stockpro_session');
    const res = await fetch(`${API_BASE}/admin/packages`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to load e-commerce packages.');
    }
    return {
      packages: Array.isArray(json.packages) ? json.packages : [],
      addons: normalizeAddonsList(json.addons)
    };
  };

  const loadPackages = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await fetchPackagesData();
      setPackages(data.packages);
      setAddons(data.addons);
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      const token = localStorage.getItem('stockpro_session');

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
          enabled: isFree ? true : pkg.enabled !== false
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
          enabled: addon.enabled !== false
        };
      });

      const res = await fetch(`${API_BASE}/admin/packages`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ packages: sanitizedPackages, addons: sanitizedAddons })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save packages.');
      }
      setPackages(Array.isArray(json.packages) ? json.packages : sanitizedPackages);
      setAddons(normalizeAddonsList(json.addons || sanitizedAddons));
      showToast?.('Packages and add-ons saved.', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save packages.');
      showToast?.(err.message || 'Failed to save packages.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Packages & Store Add-ons
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Configure monthly pricing, tier limits, POS access, and purchasable add-ons.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPackages}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:bg-[#16c653] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-72 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-48 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                Monthly Packages
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Set quotas, staff seats, monthly order limits, and module access for each tier.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {packages.map((pkg) => {
                const isFree = pkg.planId === 'free';
                return (
                  <div
                    key={pkg.planId}
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
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

                      <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={isFree ? true : pkg.enabled !== false}
                          disabled={isFree}
                          onChange={(e) => updatePackageField(pkg.planId, 'enabled', e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 accent-[#1ed760]"
                        />
                        Active
                      </label>
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Price ($/mo)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={isFree}
                          value={isFree ? 0 : (pkg.price ?? 0)}
                          onChange={(e) => updatePackageField(pkg.planId, 'price', e.target.value)}
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white dark:disabled:bg-neutral-800"
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
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
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={Boolean(pkg.hasCustomDomain)}
                            onChange={(e) => updatePackageField(pkg.planId, 'hasCustomDomain', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ed760]"
                          />
                          <Globe className="h-3.5 w-3.5 text-neutral-500" />
                          Custom Domain
                        </label>

                        <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          <input
                            type="checkbox"
                            checked={Boolean(pkg.hasPos)}
                            onChange={(e) => updatePackageField(pkg.planId, 'hasPos', e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 accent-[#1ed760]"
                          />
                          <Monitor className="h-3.5 w-3.5 text-neutral-500" />
                          POS System
                        </label>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                        <Check className="h-3.5 w-3.5 text-[#1ed760]" />
                        Monthly Credits
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
                return (
                  <div
                    key={addonId}
                    className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
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

                      <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        <input
                          type="checkbox"
                          checked={addon.enabled !== false}
                          onChange={(e) => updateAddonField(addonId, 'enabled', e.target.checked)}
                          className="h-4 w-4 rounded border-neutral-300 accent-[#1ed760]"
                        />
                        Active
                      </label>
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                          Monthly Price ($/mo)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={addon.price ?? 0}
                          onChange={(e) => updateAddonField(addonId, 'price', e.target.value)}
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
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
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
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
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
