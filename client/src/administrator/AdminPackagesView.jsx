import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Globe, Package, RefreshCw, Save } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminPackagesView({ onBackToDashboard, showToast }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadPackages = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/packages`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load e-commerce packages.');
      }
      setPackages(Array.isArray(json.packages) ? json.packages : []);
    } catch (err) {
      setErrorMsg(err.message || 'Could not load packages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const updateField = (planId, field, value) => {
    setPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.planId !== planId) return pkg;
        if (planId === 'free' && field === 'price') return { ...pkg, price: 0 };
        if (planId === 'free' && field === 'enabled') return { ...pkg, enabled: true };
        return { ...pkg, [field]: value };
      })
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorMsg('');
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/packages`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ packages })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save packages.');
      }
      setPackages(json.packages || packages);
      showToast?.('E-commerce packages saved to PostgreSQL.', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save packages.');
      showToast?.(err.message || 'Failed to save packages.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
              E-Commerce Packages
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Configure monthly pricing, product quotas, and store limits stored in PostgreSQL.
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
            />
          ))}
        </div>
      ) : (
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
                      checked={pkg.enabled !== false}
                      disabled={isFree}
                      onChange={(e) => updateField(pkg.planId, 'enabled', e.target.checked)}
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
                      value={pkg.planName}
                      onChange={(e) => updateField(pkg.planId, 'planName', e.target.value)}
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      Monthly Price (USD / mo)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={isFree}
                      value={pkg.price}
                      onChange={(e) => updateField(pkg.planId, 'price', e.target.value)}
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
                      value={pkg.productLimit}
                      onChange={(e) => updateField(pkg.planId, 'productLimit', e.target.value)}
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
                      value={pkg.warehouseLimit}
                      onChange={(e) => updateField(pkg.planId, 'warehouseLimit', e.target.value)}
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
                    onChange={(e) => updateField(pkg.planId, 'description', e.target.value)}
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={Boolean(pkg.hasCustomDomain)}
                      onChange={(e) => updateField(pkg.planId, 'hasCustomDomain', e.target.checked)}
                      className="h-4 w-4 rounded border-neutral-300 accent-[#1ed760]"
                    />
                    <Globe className="h-3.5 w-3.5 text-neutral-500" />
                    Allow Custom Domain
                  </label>

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                    <Check className="h-3.5 w-3.5 text-[#1ed760]" />
                    Monthly Credit Billing
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
