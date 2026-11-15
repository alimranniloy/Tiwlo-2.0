import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useState } from 'react';
import {
  ArrowUpRight,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Store,
} from 'lucide-react';
import { STORE_DOMAIN, getStoreUrl } from '../../../config/platformConfig';
import StoreNotificationsBanner from '../../../components/StoreNotificationsBanner';

function getStoreHost(subdomain) {
  const value = String(subdomain || '').trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  if (!value) return '';
  if (value.endsWith(`.${STORE_DOMAIN}`) && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(value)) return value;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) ? `${value}.${STORE_DOMAIN}` : '';
}

function StatCard({ label, value, icon: Icon, tone = 'default' }) {
  const tones = {
    ink: 'bg-black text-white ring-black',
    primary: 'bg-[#1ed760] text-black ring-[#1ed760]',
    default: 'bg-white text-neutral-950 ring-neutral-200 dark:bg-neutral-900 dark:text-white dark:ring-neutral-800',
  };
  return (
    <div className={`flex flex-col justify-between gap-6 rounded-3xl p-5 ring-1 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${tone === 'default' ? 'text-neutral-500 dark:text-neutral-400' : 'opacity-70'}`}>
          {label}
        </span>
        <span className={`flex size-9 items-center justify-center rounded-full ${
          tone === 'ink' ? 'bg-white/10' : tone === 'primary' ? 'bg-black/10' : 'bg-neutral-100 dark:bg-neutral-800'
        }`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default function MyOnlineStoreView({
  userStores = [],
  currentStore,
  onSelectStore,
  onOpenStoreDashboard,
  onOpenCreateStore,
  onOpenUpgrade,
  onOpenBilling,
  onRenewSuccess,
  showToast
}) {
  const [search, setSearch] = useState('');
  const [renewingStoreId, setRenewingStoreId] = useState('');
  const [renewNotice, setRenewNotice] = useState('');
  const stores = userStores;
  const activeFreeStore = stores.find(
    (store) =>
      String(store?.status || 'active').toLowerCase() !== 'deleted' &&
      String(store?.planId || 'free').toLowerCase() === 'free'
  ) || null;
  const query = search.trim().toLowerCase();
  const filteredStores = query
    ? stores.filter((store) => [
      store.storeName,
      store.tiwiId,
      store.category,
      store.subdomain,
      store.status,
    ].some((value) => String(value || '').toLowerCase().includes(query)))
    : stores;
  const liveStores = stores.filter((store) => ['active', 'live', 'running'].includes(String(store.status || '').toLowerCase())).length;
  const configuredDomains = stores.filter((store) => Boolean(getStoreHost(store.subdomain))).length;

  const openStore = (store) => {
    onSelectStore?.(store);
    onOpenStoreDashboard?.(store);
  };

  const navigateToBilling = () => {
    if (onOpenBilling) {
      onOpenBilling('overview');
      return;
    }
    try {
      window.history.pushState(null, '', '/billing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign('/billing');
    }
  };

  const handleRenewStore = async (store) => {
    if (!store?.tiwiId) {
      navigateToBilling();
      return;
    }
    setRenewingStoreId(store.tiwiId);
    setRenewNotice('');
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(store.tiwiId)}/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 402 || payload?.insufficientFunds || payload?.code === 'INSUFFICIENT_FUNDS') {
        const msg = payload?.error || 'Insufficient billing balance. Add funds to reactivate your store.';
        setRenewNotice(msg);
        showToast?.(msg, 'error');
        navigateToBilling();
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not renew this store.');
      }
      const okMsg = payload?.message || `${store.storeName || store.tiwiId} has been renewed and reactivated.`;
      setRenewNotice(okMsg);
      showToast?.(okMsg);
      await onRenewSuccess?.();
    } catch (error) {
      const errMsg = error.message || 'Could not renew store. Redirecting to billing.';
      setRenewNotice(errMsg);
      showToast?.(errMsg, 'error');
      navigateToBilling();
    } finally {
      setRenewingStoreId('');
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Products</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">
            Online store
          </h1>
          <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
            All stores registered to this account.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenCreateStore}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#1ed760] px-5 text-sm font-bold text-black transition hover:bg-[#16c653]"
        >
          <Plus className="size-4" aria-hidden="true" />
          Create store
        </button>
      </header>

      <StoreNotificationsBanner
        tiwiId={currentStore?.tiwiId}
        stores={stores}
        onOpenUpgrade={(target) => onOpenUpgrade?.(target?.tiwiId ? target : activeFreeStore || currentStore)}
        onOpenBilling={navigateToBilling}
        onRenewSuccess={onRenewSuccess}
        showToast={showToast}
      />

      {renewNotice && (
        <div
          role="status"
          className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
        >
          {renewNotice}
        </div>
      )}

      {activeFreeStore && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                  You have already created 1 Free store
                </p>
                <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
                  1 / 1 Free Slot Used
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Free accounts include 1 store slot ({activeFreeStore.storeName || activeFreeStore.tiwiId}). Upgrade your plan to unlock additional store slots.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenUpgrade?.(activeFreeStore)}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 dark:border-neutral-700 dark:bg-[#1ed760] dark:text-black dark:hover:bg-[#16c653]"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Upgrade Plan
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Stores" value={stores.length} icon={Store} tone="ink" />
        <StatCard label="Live stores" value={liveStores} icon={Store} />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Domains configured" value={configuredDomains} icon={Globe} tone="primary" />
        </div>
      </div>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800 sm:p-6">
        <div className="mb-5">
          <label className="relative block max-w-md">
            <span className="sr-only">Search stores</span>
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search stores"
              className="h-10 w-full rounded-full bg-neutral-100 pl-11 pr-4 text-sm text-neutral-900 outline-none ring-neutral-900/10 transition placeholder:text-neutral-500 focus:bg-white focus:ring-2 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-950"
            />
          </label>
        </div>

        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-500 dark:border-neutral-800">
                <th className="px-5 pb-3 font-semibold sm:px-6">Store</th>
                <th className="pb-3 font-semibold">Domain</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="px-5 pb-3 text-right font-semibold sm:px-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((store, index) => {
                const host = getStoreHost(store.subdomain);
                const active = currentStore?.tiwiId === store.tiwiId;
                const status = store.status || 'Unknown';
                const isLive = ['active', 'live', 'running'].includes(String(status).toLowerCase());
                return (
                  <tr key={store.tiwiId || store.id || index} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-5 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className={`flex size-10 items-center justify-center rounded-xl ${
                          active ? 'bg-black text-[#1ed760]' : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}>
                          <Store className="size-4" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="font-semibold text-neutral-950 dark:text-white">{store.storeName || 'Unnamed Store'}</p>
                          <p className="text-xs text-neutral-500">{store.tiwiId || 'Store ID unavailable'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      {host ? (
                        <a
                          href={getStoreUrl(host.slice(0, -(STORE_DOMAIN.length + 1)))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-neutral-600 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                        >
                          <span>{host}</span>
                          <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </a>
                      ) : <span className="text-xs text-neutral-500">No domain assigned</span>}
                    </td>
                    <td className="py-4 text-neutral-600 dark:text-neutral-300">{store.category || '—'}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isLive
                          ? 'bg-[#1ed760]/15 text-[#0f7a37] dark:text-[#1ed760]'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}>
                        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right sm:px-6">
                      <div className="inline-flex items-center justify-end gap-2">
                        {String(status).toLowerCase() === 'suspended' && (
                          <button
                            type="button"
                            disabled={renewingStoreId === store.tiwiId}
                            onClick={() => handleRenewStore(store)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1ED760] px-3 text-xs font-semibold text-black transition hover:bg-[#18B953] disabled:opacity-60"
                          >
                            <RefreshCw className={`size-3.5 ${renewingStoreId === store.tiwiId ? 'animate-spin' : ''}`} aria-hidden="true" />
                            {renewingStoreId === store.tiwiId ? 'Renewing...' : 'Renew & Reactivate'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openStore(store)}
                          className="inline-flex h-8 items-center rounded-full bg-neutral-100 px-3 text-xs font-bold transition hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                        >
                          Open dashboard
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredStores.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center sm:px-6">
                    <Store className="mx-auto size-8 text-neutral-400" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                      {stores.length ? 'No stores match your search' : 'No stores yet'}
                    </p>
                    {!stores.length && (
                      <button
                        type="button"
                        onClick={onOpenCreateStore}
                        className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-black px-4 text-xs font-bold text-white"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        Create store
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
