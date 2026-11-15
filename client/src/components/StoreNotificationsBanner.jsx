import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, CreditCard, RefreshCw, Sparkles, XCircle } from 'lucide-react';

const DELETION_WINDOW_DAYS = 180;

function computeGraceRemaining(graceEndsAt) {
  if (!graceEndsAt) return null;
  const endMs = Date.parse(graceEndsAt);
  if (!Number.isFinite(endMs)) return null;
  const diffMs = Math.max(0, endMs - Date.now());
  const totalHours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours, totalHours };
}

function computeDaysLeft(targetDate, fallbackDays = DELETION_WINDOW_DAYS) {
  if (!targetDate) return fallbackDays;
  const ts = Date.parse(targetDate);
  if (!Number.isFinite(ts)) return fallbackDays;
  const diffDays = Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(DELETION_WINDOW_DAYS, diffDays));
}

const METRIC_TO_RESOURCE = {
  productLimit: 'products',
  staffLimit: 'staff',
  monthlyOrderLimit: 'orders',
  freeStoreSlot: 'freeStoreSlot',
};

function buildDerivedNotifications({ subscription, products, staff, stores, storeSummaries, tiwiId }) {
  const derived = [];
  const sourceStores = Array.isArray(stores) && stores.length > 0 ? stores : storeSummaries;

  if (Array.isArray(sourceStores) && sourceStores.length > 0) {
    for (const store of sourceStores) {
      if (!store?.tiwiId) continue;
      if (tiwiId && store.tiwiId !== tiwiId && !(Array.isArray(stores) && stores.length > 0)) continue;
      const lifecycle = String(store.lifecycleStatus || store.status || '').toLowerCase();
      if (lifecycle === 'grace_period' || (lifecycle !== 'suspended' && store.graceEndsAt)) {
        const remaining = computeGraceRemaining(store.graceEndsAt);
        derived.push({
          id: `derived:grace_period:${store.tiwiId}`,
          type: 'grace_period',
          tiwiId: store.tiwiId,
          storeName: store.storeName || store.name || store.tiwiId,
          graceEndsAt: store.graceEndsAt || null,
          daysLeft: remaining?.days ?? 3,
          hoursLeft: remaining?.hours ?? 0,
        });
      } else if (lifecycle === 'suspended') {
        const daysLeft = computeDaysLeft(store.scheduledDeletionAt, DELETION_WINDOW_DAYS);
        derived.push({
          id: `derived:suspended_deletion_countdown:${store.tiwiId}`,
          type: 'suspended_deletion_countdown',
          tiwiId: store.tiwiId,
          storeName: store.storeName || store.name || store.tiwiId,
          scheduledDeletionAt: store.scheduledDeletionAt || null,
          daysLeft,
          totalDays: DELETION_WINDOW_DAYS,
        });
      }
    }
  }

  if (subscription && typeof subscription === 'object') {
    const subStatus = String(subscription.lifecycleStatus || subscription.status || '').toLowerCase();
    const activeTiwiId = tiwiId || subscription.tiwiId || null;

    if (subStatus === 'grace_period' || (subStatus !== 'suspended' && subscription.graceEndsAt)) {
      const remaining = computeGraceRemaining(subscription.graceEndsAt);
      derived.push({
        id: `derived:grace_period:${activeTiwiId || 'current'}`,
        type: 'grace_period',
        tiwiId: activeTiwiId,
        graceEndsAt: subscription.graceEndsAt || null,
        daysLeft: remaining?.days ?? 3,
        hoursLeft: remaining?.hours ?? 0,
      });
    } else if (subStatus === 'suspended') {
      const daysLeft = computeDaysLeft(subscription.scheduledDeletionAt, DELETION_WINDOW_DAYS);
      derived.push({
        id: `derived:suspended_deletion_countdown:${activeTiwiId || 'current'}`,
        type: 'suspended_deletion_countdown',
        tiwiId: activeTiwiId,
        scheduledDeletionAt: subscription.scheduledDeletionAt || null,
        daysLeft,
        totalDays: DELETION_WINDOW_DAYS,
      });
    }

    const planId = String(subscription.planId || 'free').toLowerCase();
    if (planId === 'free') {
      const prodCount = Array.isArray(products)
        ? products.length
        : Number(subscription.currentProducts ?? 0);
      const prodLimit = Number(subscription.effectiveProductLimit ?? subscription.productLimit ?? 0);
      if (prodLimit > 0 && prodLimit < 999999 && prodCount >= Math.ceil(prodLimit * 0.8)) {
        derived.push({
          id: `derived:slot_limit_warning:products`,
          type: 'slot_limit_warning',
          resource: 'products',
          metric: 'productLimit',
          tiwiId: activeTiwiId,
          current: prodCount,
          used: prodCount,
          limit: prodLimit,
          exhausted: prodCount >= prodLimit,
          message:
            prodCount >= prodLimit
              ? `Product slot limit reached (${prodCount}/${prodLimit} used).`
              : `Running low on product slots (${prodCount}/${prodLimit} used).`,
        });
      }

      const staffCount = Array.isArray(staff)
        ? staff.length
        : Number(subscription.currentStaff ?? 0);
      const staffLimit = Number(subscription.effectiveStaffLimit ?? subscription.staffLimit ?? 0);
      if (staffLimit > 0 && staffLimit < 999999 && staffCount >= staffLimit) {
        derived.push({
          id: `derived:slot_limit_warning:staff`,
          type: 'slot_limit_warning',
          resource: 'staff',
          metric: 'staffLimit',
          tiwiId: activeTiwiId,
          current: staffCount,
          used: staffCount,
          limit: staffLimit,
          exhausted: true,
          message: `Staff seat limit reached (${staffCount}/${staffLimit} used).`,
        });
      }

      const ordersCount = Number(subscription.currentMonthlyOrders ?? subscription.monthlyOrders ?? 0);
      const ordersLimit = Number(subscription.monthlyOrderLimit ?? 0);
      if (ordersLimit > 0 && ordersLimit < 999999 && ordersCount >= Math.ceil(ordersLimit * 0.8)) {
        derived.push({
          id: `derived:slot_limit_warning:orders`,
          type: 'slot_limit_warning',
          resource: 'orders',
          metric: 'monthlyOrderLimit',
          tiwiId: activeTiwiId,
          current: ordersCount,
          used: ordersCount,
          limit: ordersLimit,
          exhausted: ordersCount >= ordersLimit,
          message:
            ordersCount >= ordersLimit
              ? `Monthly order limit reached (${ordersCount}/${ordersLimit} used).`
              : `Approaching monthly order limit (${ordersCount}/${ordersLimit} used).`,
        });
      }
    }
  }

  return derived;
}

async function fetchStoreNotifications(tiwiId) {
  try {
    const query = tiwiId ? `?tiwiId=${encodeURIComponent(tiwiId)}` : '';
    const response = await fetch(`/api/store-notifications${query}`, { credentials: 'include' });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return {
      notifications: Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.notifications)
          ? payload.notifications
          : [],
      storeSummaries: Array.isArray(payload?.storeSummaries) ? payload.storeSummaries : [],
    };
  } catch {
    return null;
  }
}

export default function StoreNotificationsBanner({
  tiwiId = null,
  subscription = null,
  products = null,
  staff = null,
  stores = null,
  onNavigateTab,
  onOpenBilling,
  onOpenUpgrade,
  onRenewSuccess,
  showToast,
}) {
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [storeSummaries, setStoreSummaries] = useState([]);
  const [renewingId, setRenewingId] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchStoreNotifications(tiwiId).then((result) => {
      if (!cancelled && result) {
        setLiveNotifications(result.notifications);
        setStoreSummaries(result.storeSummaries);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tiwiId]);

  const notifications = useMemo(() => {
    const derived = buildDerivedNotifications({
      subscription,
      products,
      staff,
      stores,
      storeSummaries,
      tiwiId,
    });
    const merged = new Map();

    const getDedupeKey = (item) => {
      const metricKey = item.resource || METRIC_TO_RESOURCE[item.metric] || item.metric || '';
      return `${item.type || 'notice'}:${item.tiwiId || 'store'}:${metricKey}`;
    };

    for (const item of derived) {
      merged.set(getDedupeKey(item), item);
    }
    for (const item of liveNotifications) {
      if (!item || !item.type) continue;
      merged.set(getDedupeKey(item), item);
    }

    return Array.from(merged.values());
  }, [liveNotifications, storeSummaries, subscription, products, staff, stores, tiwiId]);

  const goToBilling = () => {
    if (onOpenBilling) {
      onOpenBilling('overview');
      return;
    }
    if (onNavigateTab) {
      onNavigateTab('billing');
      return;
    }
    try {
      window.history.pushState(null, '', '/billing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign('/billing');
    }
  };

  const goToPricing = (targetStore) => {
    if (onOpenUpgrade) {
      onOpenUpgrade(targetStore);
      return;
    }
    if (onNavigateTab) {
      onNavigateTab('pricing');
      return;
    }
    try {
      window.history.pushState(null, '', '/pricing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign('/pricing');
    }
  };

  const handleRenewStore = async (item) => {
    const targetTiwiId = item?.tiwiId || tiwiId;
    if (!targetTiwiId) {
      goToBilling();
      return;
    }

    setRenewingId(targetTiwiId);
    try {
      const response = await fetch(`/api/stores/${encodeURIComponent(targetTiwiId)}/renew`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 402 || payload?.insufficientFunds || payload?.code === 'INSUFFICIENT_FUNDS') {
        showToast?.(payload?.error || 'Insufficient billing balance. Add funds to renew.', 'error');
        goToBilling();
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not renew store.');
      }
      showToast?.(payload?.message || 'Store renewed and reactivated!');
      const refreshed = await fetchStoreNotifications(tiwiId);
      if (refreshed) {
        setLiveNotifications(refreshed.notifications);
        setStoreSummaries(refreshed.storeSummaries);
      }
      await onRenewSuccess?.();
    } catch (error) {
      showToast?.(error.message || 'Could not renew store. Opening billing...', 'error');
      goToBilling();
    } finally {
      setRenewingId('');
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-2.5" aria-live="polite">
      {notifications.map((item, index) => {
        const key = item.id || `${item.type}-${item.tiwiId || item.metric || item.resource || index}`;

        if (item.type === 'grace_period') {
          const remaining = computeGraceRemaining(item.graceEndsAt);
          const days = item.daysLeft ?? remaining?.days ?? item.daysRemaining ?? 0;
          const hours = item.hoursLeft ?? remaining?.hours ?? (item.hoursRemaining != null ? item.hoursRemaining % 24 : 0);
          const timeText =
            days > 0
              ? `${days}d ${hours}h remaining`
              : hours > 0
                ? `${hours}h remaining`
                : 'Grace period ending soon';

          return (
            <div
              key={key}
              role="alert"
              className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      3-Day Grace Period Active{item.storeName ? ` · ${item.storeName}` : ''}
                    </p>
                    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                      {timeText}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {item.message ||
                      'Renewal payment failed due to insufficient funds. Add funds before the grace period expires to prevent storefront suspension.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={goToBilling}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black transition-colors hover:bg-[#18B953]"
              >
                <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                Add Funds &amp; Renew
              </button>
            </div>
          );
        }

        if (item.type === 'suspended_deletion_countdown' || item.type === 'suspended') {
          const daysLeft = item.daysLeft ?? item.daysRemaining ?? computeDaysLeft(item.scheduledDeletionAt, DELETION_WINDOW_DAYS);
          const totalDays = item.totalDays || DELETION_WINDOW_DAYS;
          const isRenewing = renewingId && renewingId === (item.tiwiId || tiwiId);

          return (
            <div
              key={key}
              role="alert"
              className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      Store Suspended{item.storeName ? ` · ${item.storeName}` : ''}
                    </p>
                    <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                      {daysLeft} of {totalDays} days left before permanent deletion
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {item.message ||
                      'Renew your subscription to reactivate this storefront. Database records and uploaded files are permanently deleted after 180 days.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Boolean(isRenewing)}
                onClick={() => handleRenewStore(item)}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black transition-colors hover:bg-[#18B953] disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRenewing ? 'animate-spin' : ''}`} aria-hidden="true" />
                {isRenewing ? 'Renewing...' : 'Renew & Reactivate'}
              </button>
            </div>
          );
        }

        if (item.type === 'slot_limit_warning') {
          const usedCount = item.used ?? item.current;
          return (
            <div
              key={key}
              role="status"
              className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {item.title || (item.exhausted ? 'Slot Limit Exhausted' : 'Slot Limit Warning')}
                    </p>
                    {usedCount != null && item.limit != null && (
                      <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        {usedCount} / {item.limit} used
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    {item.message || 'You are running low on free plan slots. Add extra slots or upgrade your plan to continue growing.'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPricing(item)}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
                >
                  Add Slots (Add-on)
                </button>
                <button
                  type="button"
                  onClick={() => goToPricing(item)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black transition-colors hover:bg-[#18B953]"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Upgrade Plan
                </button>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
