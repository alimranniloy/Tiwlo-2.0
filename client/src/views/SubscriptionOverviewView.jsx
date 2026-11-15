import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Database,
  ExternalLink,
  Globe,
  Monitor,
  RefreshCw,
  ShoppingBag,
  Users
} from 'lucide-react';

const API_BASE = '/api';

function formatQuotaMax(value) {
  const num = Number(value ?? 0);
  return num >= 999999 ? 'Unlimited' : num.toLocaleString();
}

export default function SubscriptionOverviewView({
  onBackToDashboard,
  onNavigateToPricing,
  showToast
}) {
  const [subscription, setSubscription] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedSubdomain, setCopiedSubdomain] = useState(false);

  const fetchOverviewData = async () => {
    const [subRes, prodRes] = await Promise.all([
      fetch(`${API_BASE}/subscription`),
      fetch(`${API_BASE}/products`)
    ]);
    return {
      subData: subRes.ok ? await subRes.json() : null,
      prodData: prodRes.ok ? await prodRes.json() : null
    };
  };

  const loadData = async () => {
    try {
      setRefreshing(true);
      const data = await fetchOverviewData();
      if (data.subData) setSubscription(data.subData);
      if (data.prodData) setProducts(Array.isArray(data.prodData) ? data.prodData : []);
    } catch (err) {
      console.error('Error fetching subscription overview:', err);
      showToast?.('Error scanning database', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchOverviewData()
      .then((data) => {
        if (cancelled) return;
        if (data.subData) setSubscription(data.subData);
        if (data.prodData) setProducts(Array.isArray(data.prodData) ? data.prodData : []);
      })
      .catch((err) => {
        console.error('Error fetching subscription overview:', err);
        if (!cancelled) showToast?.('Error scanning database', 'error');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const copySubdomain = () => {
    if (!subscription?.subdomain) return;
    const url = `https://${subscription.subdomain}`;
    navigator.clipboard.writeText(url);
    setCopiedSubdomain(true);
    showToast?.('Domain copied to clipboard!');
    setTimeout(() => setCopiedSubdomain(false), 2000);
  };

  const totalProducts = Number(subscription?.currentProducts ?? products.length ?? 0);
  const productLimit = Number(
    subscription?.effectiveProductLimit ?? subscription?.productLimit ?? 50
  );
  const extraProductSlots = Number(subscription?.extraProductSlots ?? 0);
  const isUnlimitedProducts = productLimit >= 999999;
  const usagePercent = isUnlimitedProducts
    ? 0
    : Math.min(100, Math.round((totalProducts / Math.max(1, productLimit)) * 100));
  const remainingSlots = isUnlimitedProducts ? null : Math.max(0, productLimit - totalProducts);

  const staffLimit = Number(
    subscription?.effectiveStaffLimit ?? subscription?.staffLimit ?? 1
  );
  const extraStaffSeats = Number(subscription?.extraStaffSeats ?? 0);
  const currentStaff =
    subscription?.currentStaff != null ? Number(subscription.currentStaff) : null;

  const monthlyOrderLimit = Number(subscription?.monthlyOrderLimit ?? 100);
  const currentMonthlyOrders =
    subscription?.currentMonthlyOrders != null
      ? Number(subscription.currentMonthlyOrders)
      : subscription?.monthlyOrders != null
        ? Number(subscription.monthlyOrders)
        : null;

  const hasPos = Boolean(subscription?.hasPos ?? subscription?.posAccess);
  const warehouseLimit = Number(subscription?.warehouseLimit ?? 1);
  const hasCustomDomain = Boolean(subscription?.hasCustomDomain);
  const planName = subscription?.planName || 'Free Starter';
  const planPrice = Number(subscription?.price ?? 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Subscription & Quotas
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Monitor your active monthly limits, add-on capacity, and storefront domain.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 sm:flex-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToPricing}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:bg-[#16c653] sm:flex-none"
          >
            <span>Upgrade & Add-ons</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Current Plan & Effective Limits Panel */}
      <div className="space-y-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col justify-between gap-3 border-b border-neutral-100 pb-5 sm:flex-row sm:items-center dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Current Plan
              </span>
              <span className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                Active
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {loading && !subscription ? 'Loading...' : planName}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {planPrice === 0 ? 'Free' : `$${planPrice}/mo`}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {warehouseLimit >= 99 ? 'Unlimited warehouses' : `${warehouseLimit} warehouse${warehouseLimit > 1 ? 's' : ''}`}
              {' · '}
              {hasCustomDomain ? 'Custom domain enabled' : 'Tiwlo subdomain included'}
            </p>
          </div>

          <button
            type="button"
            onClick={onNavigateToPricing}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Manage Plan & Add-ons
          </button>
        </div>

        {/* Product Catalog Usage */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Product Catalog Capacity
              {extraProductSlots > 0 && (
                <span className="ml-1.5 text-neutral-500 dark:text-neutral-400">
                  (includes +{extraProductSlots.toLocaleString()} add-on slots)
                </span>
              )}
            </span>
            <span className="font-semibold text-neutral-950 dark:text-white">
              {totalProducts.toLocaleString()} of {isUnlimitedProducts ? 'Unlimited' : `${productLimit.toLocaleString()} products`}
              {!isUnlimitedProducts && ` (${usagePercent}%)`}
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-[#1ed760] transition-all duration-300"
              style={{ width: isUnlimitedProducts ? '10%' : `${Math.max(2, Math.min(100, usagePercent))}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {isUnlimitedProducts
                ? 'Unlimited product slots available'
                : `${remainingSlots.toLocaleString()} product slots remaining`}
            </span>
            <button
              type="button"
              onClick={onNavigateToPricing}
              className="font-medium text-neutral-900 hover:underline dark:text-neutral-200"
            >
              Add extra product slots →
            </button>
          </div>
        </div>

        {/* Effective Limits Summary Grid */}
        <div className="grid grid-cols-1 gap-3 border-t border-neutral-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <Database className="h-3.5 w-3.5" />
              <span>Products</span>
            </div>
            <p className="mt-1.5 text-base font-semibold text-neutral-950 dark:text-white">
              {totalProducts.toLocaleString()} / {formatQuotaMax(productLimit)}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              {extraProductSlots > 0 ? `+${extraProductSlots} from add-ons` : 'Base plan quota'}
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <Users className="h-3.5 w-3.5" />
              <span>Staff Seats</span>
            </div>
            <p className="mt-1.5 text-base font-semibold text-neutral-950 dark:text-white">
              {currentStaff !== null
                ? `${currentStaff.toLocaleString()} / ${formatQuotaMax(staffLimit)}`
                : `${formatQuotaMax(staffLimit)} ${staffLimit === 1 ? 'seat' : 'seats'}`}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              {extraStaffSeats > 0 ? `Includes +${extraStaffSeats} extra seats` : 'Team access limit'}
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Monthly Orders</span>
            </div>
            <p className="mt-1.5 text-base font-semibold text-neutral-950 dark:text-white">
              {currentMonthlyOrders !== null
                ? `${currentMonthlyOrders.toLocaleString()} / ${formatQuotaMax(monthlyOrderLimit)}`
                : `${formatQuotaMax(monthlyOrderLimit)} / mo`}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              Monthly order allowance
            </p>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <Monitor className="h-3.5 w-3.5" />
              <span>POS Access</span>
            </div>
            <p className="mt-1.5 text-base font-semibold text-neutral-950 dark:text-white">
              {hasPos ? 'Enabled' : 'Not Included'}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              {hasPos ? 'In-store register active' : 'Unlock via upgrade or add-on'}
            </p>
          </div>
        </div>
      </div>

      {/* Storefront Domain Panel */}
      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
            Storefront Domain
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            The web address customers use to browse your catalog and place orders.
          </p>
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-950 dark:text-white">
                  {subscription?.subdomain || 'No subdomain assigned'}
                </span>
                <span className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  SSL Active
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                Pre-configured storefront subdomain
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={copySubdomain}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              {copiedSubdomain ? <Check className="h-3.5 w-3.5 text-[#1ed760]" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSubdomain ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href="/?view=store"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-950 px-3 text-xs font-medium text-white transition hover:bg-neutral-800 dark:border-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <span>Visit Store</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <span>
            {hasCustomDomain
              ? 'Custom domain support is enabled on your current plan.'
              : 'Need to connect your own custom domain?'}
          </span>
          {!hasCustomDomain && (
            <button
              type="button"
              onClick={onNavigateToPricing}
              className="font-medium text-neutral-900 hover:underline dark:text-neutral-200"
            >
              View Upgrade & Add-ons →
            </button>
          )}
        </div>
      </div>

      {/* Upgrade & Add-ons Footer Card */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-6 md:flex-row md:items-center dark:border-neutral-800 dark:bg-neutral-900">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
            Need more capacity or POS access?
          </h3>
          <p className="max-w-xl text-xs text-neutral-500 dark:text-neutral-400">
            Upgrade your monthly package or purchase add-ons for extra product slots, staff seats, and POS terminal access using Cloud Credits.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToPricing}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:bg-[#16c653]"
        >
          <span>Upgrade & Add-ons</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
