import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import { STORE_DOMAIN } from '../config/platformConfig';
import { getCloudBillingData } from '../dashboards/cloud/graphql/cloudQueries';
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  CreditCard,
  Database,
  Globe,
  HelpCircle,
  Monitor,
  Plus,
  RefreshCw,
  ShoppingBag,
  Users
} from 'lucide-react';

const API_BASE = '/api';

const BASE_PLANS = [
  {
    planId: 'free',
    planName: 'Free Starter',
    description: 'Ideal for independent store owners testing online retail and local stock management.',
    price: 0,
    productLimit: 50,
    warehouseLimit: 1,
    staffLimit: 1,
    monthlyOrderLimit: 100,
    hasCustomDomain: false,
    hasPos: false,
    enabled: true
  },
  {
    planId: 'growth',
    planName: 'Growth Retailer',
    description: 'For expanding retail shops wanting custom branding, POS, and higher limits.',
    price: 19,
    productLimit: 500,
    warehouseLimit: 2,
    staffLimit: 3,
    monthlyOrderLimit: 1000,
    hasCustomDomain: true,
    hasPos: true,
    enabled: true
  },
  {
    planId: 'pro',
    planName: 'Pro Business',
    description: 'Complete commerce tier with multi-warehouse routing, higher staff seats, and POS.',
    price: 49,
    productLimit: 5000,
    warehouseLimit: 5,
    staffLimit: 10,
    monthlyOrderLimit: 10000,
    hasCustomDomain: true,
    hasPos: true,
    enabled: true
  },
  {
    planId: 'enterprise',
    planName: 'Enterprise VIP',
    description: 'High-volume infrastructure for retail chains, wholesalers, and large teams.',
    price: 129,
    productLimit: 999999,
    warehouseLimit: 99,
    staffLimit: 999999,
    monthlyOrderLimit: 999999,
    hasCustomDomain: true,
    hasPos: true,
    enabled: true
  }
];

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
    description: 'Enable the in-store POS register and barcode receipt terminal.',
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

function formatLimit(value, singular, plural) {
  const num = Number(value ?? 0);
  if (num >= 999999) return `Unlimited ${plural}`;
  return `${num.toLocaleString()} ${num === 1 ? singular : plural}`;
}

function getAddonCount(subscription, addonId) {
  const addons = subscription?.addons;
  if (!addons) return 0;
  if (Array.isArray(addons)) {
    return addons.filter((item) => (item?.addonId || item?.id || item) === addonId).length;
  }
  if (typeof addons === 'object') {
    const val = addons[addonId];
    if (typeof val === 'number') return val;
    if (val) return 1;
  }
  return 0;
}

export default function PricingPlansView({
  currentUser,
  onBackToOverview,
  onOpenBilling,
  showToast,
  onRefreshData
}) {
  const [subscription, setSubscription] = useState(null);
  const [livePackages, setLivePackages] = useState([]);
  const [liveAddons, setLiveAddons] = useState(null);
  const [creditBalance, setCreditBalance] = useState(null);
  const [creditShortfall, setCreditShortfall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);
  const [purchasingAddonId, setPurchasingAddonId] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  const fetchPricingData = async (userId) => {
    const [subRes, pkgRes, billingData] = await Promise.all([
      fetch(`${API_BASE}/subscription`),
      fetch(`${API_BASE}/packages`).catch(() => null),
      getCloudBillingData(userId).catch(() => null)
    ]);
    const subData = subRes.ok ? await subRes.json() : null;
    const pkgJson = pkgRes && pkgRes.ok ? await pkgRes.json().catch(() => null) : null;
    const rawCredits = Number(billingData?.account?.credits);
    return {
      subData,
      packages: Array.isArray(pkgJson?.packages) ? pkgJson.packages : null,
      addons: Array.isArray(pkgJson?.addons) ? pkgJson.addons : null,
      credits: Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 0
    };
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const data = await fetchPricingData(currentUser?.id);
      if (data.subData) setSubscription(data.subData);
      if (data.packages) setLivePackages(data.packages);
      if (data.addons) setLiveAddons(data.addons);
      setCreditBalance(data.credits);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      showToast?.('Failed to load subscription status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchPricingData(currentUser?.id)
      .then((data) => {
        if (cancelled) return;
        if (data.subData) setSubscription(data.subData);
        if (data.packages) setLivePackages(data.packages);
        if (data.addons) setLiveAddons(data.addons);
        setCreditBalance(data.credits);
      })
      .catch((err) => {
        console.error('Error fetching subscription:', err);
        if (!cancelled) showToast?.('Failed to load subscription status', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, showToast]);

  const baseById = new Map(BASE_PLANS.map((p) => [p.planId, p]));
  const plans = (livePackages.length > 0 ? livePackages : BASE_PLANS)
    .map((pkg) => {
      const base = baseById.get(pkg.planId) || {};
      if (pkg.enabled === false) return null;
      return {
        planId: pkg.planId,
        planName: pkg.planName || base.planName || pkg.planId,
        description: pkg.description ?? base.description ?? '',
        price: Number(pkg.price ?? base.price ?? 0),
        productLimit: Number(pkg.productLimit ?? base.productLimit ?? 50),
        warehouseLimit: Number(pkg.warehouseLimit ?? base.warehouseLimit ?? 1),
        staffLimit: Number(pkg.staffLimit ?? base.staffLimit ?? 1),
        monthlyOrderLimit: Number(pkg.monthlyOrderLimit ?? base.monthlyOrderLimit ?? 100),
        hasCustomDomain: pkg.hasCustomDomain !== undefined ? Boolean(pkg.hasCustomDomain) : Boolean(base.hasCustomDomain),
        hasPos: pkg.hasPos !== undefined ? Boolean(pkg.hasPos) : Boolean(base.hasPos)
      };
    })
    .filter(Boolean);

  const addons = (Array.isArray(liveAddons) ? liveAddons : DEFAULT_ADDONS)
    .filter((addon) => addon && addon.enabled !== false)
    .map((addon) => ({
      ...addon,
      addonId: addon.addonId || addon.id,
      price: Number(addon.price ?? 0),
      quantity: Number(addon.quantity ?? addon.slots ?? 1)
    }));

  const currentPlanId = subscription?.planId || 'free';

  const handleSelectPlan = async (planId) => {
    if (currentPlanId === planId) return;

    const targetPlan = plans.find((p) => p.planId === planId);
    const planPrice = Number(targetPlan?.price || 0);
    if (planPrice > 0 && creditBalance !== null && creditBalance < planPrice) {
      setCreditShortfall({ name: targetPlan?.planName || planId, price: planPrice });
      showToast?.('Add your credit to upgrade to this plan.', 'error');
      return;
    }

    try {
      setUpgradingPlanId(planId);
      setCreditShortfall(null);
      const res = await fetch(`${API_BASE}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle: 'monthly' })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSubscription(result.subscription);
        if (typeof result.creditBalance === 'number') {
          setCreditBalance(result.creditBalance);
        } else if (planPrice > 0 && creditBalance !== null) {
          setCreditBalance(Math.max(0, Number((creditBalance - planPrice).toFixed(2))));
        }
        showToast?.(`Your account is now on ${result.subscription?.planName || targetPlan?.planName}.`);
        onRefreshData?.();
      } else {
        if (res.status === 402) {
          setCreditShortfall({ name: targetPlan?.planName || planId, price: planPrice });
        }
        showToast?.(result.error || 'Failed to update subscription', 'error');
      }
    } catch (err) {
      console.error('Plan upgrade error:', err);
      showToast?.('Connection error while updating plan', 'error');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const handlePurchaseAddon = async (addon) => {
    const addonId = addon.addonId || addon.id;
    const addonPrice = Number(addon.price || 0);

    if (addonPrice > 0 && creditBalance !== null && creditBalance < addonPrice) {
      setCreditShortfall({ name: addon.name || addonId, price: addonPrice });
      showToast?.('Add your credit to purchase this add-on.', 'error');
      return;
    }

    try {
      setPurchasingAddonId(addonId);
      setCreditShortfall(null);
      const res = await fetch(`${API_BASE}/subscription/addons/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonId })
      });
      const result = await res.json();

      if (res.ok && result.success) {
        if (result.subscription) {
          setSubscription(result.subscription);
        } else {
          await fetchSubscription();
        }
        if (typeof result.creditBalance === 'number') {
          setCreditBalance(result.creditBalance);
        } else if (addonPrice > 0 && creditBalance !== null) {
          setCreditBalance(Math.max(0, Number((creditBalance - addonPrice).toFixed(2))));
        }
        showToast?.(result.message || `${addon.name} activated.`);
        onRefreshData?.();
      } else {
        if (res.status === 402) {
          setCreditShortfall({ name: addon.name || addonId, price: addonPrice });
        }
        showToast?.(result.error || 'Failed to purchase add-on', 'error');
      }
    } catch (err) {
      console.error('Add-on purchase error:', err);
      showToast?.('Connection error while purchasing add-on', 'error');
    } finally {
      setPurchasingAddonId(null);
    }
  };

  const faqs = [
    {
      q: 'How does monthly Cloud Credit billing work?',
      a: 'Plans and store add-ons are billed monthly using your Cloud Credit balance. Top up your credits anytime from Billing.'
    },
    {
      q: 'How do Add-ons & Extra Slots work?',
      a: 'Add-ons expand your current plan immediately without switching tiers. You can add extra product slots, staff seats, or unlock POS System access.'
    },
    {
      q: 'Can I connect my own custom domain?',
      a: `Every store receives a free *.${STORE_DOMAIN} subdomain. Plans with Custom Domain enabled allow connecting your own domain with SSL.`
    },
    {
      q: 'What happens when I reach a quota limit?',
      a: 'Existing products, orders, and storefront traffic keep running normally. You can upgrade your monthly plan or add extra slots anytime.'
    }
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToOverview}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            title="Back to Subscription Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Plans & Add-ons
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Choose a monthly package or add extra product slots, staff seats, and POS access.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <CreditCard className="h-4 w-4 text-neutral-500" />
            <span>Cloud Credits:</span>
            <span className="font-semibold text-neutral-950 dark:text-white">
              {creditBalance === null ? '—' : `$${creditBalance.toFixed(2)}`}
            </span>
          </div>
          {onOpenBilling && (
            <button
              type="button"
              onClick={onOpenBilling}
              className="inline-flex h-8 items-center rounded-lg bg-[#1ed760] px-3 text-xs font-semibold text-black transition hover:bg-[#16c653]"
            >
              Add your credit
            </button>
          )}
        </div>
      </div>

      {creditShortfall && (
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600 dark:text-neutral-400" />
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Add your credit
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {creditShortfall.name} requires ${Number(creditShortfall.price || 0).toFixed(2)}/mo in Cloud Credits. Your current balance is ${(creditBalance || 0).toFixed(2)}.
              </p>
            </div>
          </div>
          {onOpenBilling && (
            <button
              type="button"
              onClick={onOpenBilling}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#1ed760] px-4 text-xs font-semibold text-black transition hover:bg-[#16c653]"
            >
              Add your credit
            </button>
          )}
        </div>
      )}

      {/* Monthly Packages Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
            Monthly Packages
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Predictable monthly limits billed from your Cloud Credit balance.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-80 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan.planId;
              const isUpgrading = upgradingPlanId === plan.planId;

              return (
                <div
                  key={plan.planId}
                  className={`flex flex-col justify-between rounded-xl border bg-white p-5 dark:bg-neutral-900 ${
                    isCurrent
                      ? 'border-neutral-950 dark:border-neutral-200'
                      : 'border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                          {plan.planName}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                          {plan.description}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="border-b border-neutral-100 pb-4 dark:border-neutral-800">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            / month
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                      <li className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                        <span>{formatLimit(plan.productLimit, 'product', 'products')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Boxes className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                        <span>{formatLimit(plan.warehouseLimit, 'warehouse', 'warehouses')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                        <span>{formatLimit(plan.staffLimit, 'staff seat', 'staff seats')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                        <span>
                          {plan.monthlyOrderLimit >= 999999
                            ? 'Unlimited monthly orders'
                            : `${plan.monthlyOrderLimit.toLocaleString()} orders / month`}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Monitor className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                        <span>{plan.hasPos ? 'POS System included' : 'Online storefront only'}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                        <span>
                          {plan.hasCustomDomain
                            ? 'Custom domain + SSL'
                            : `*.${STORE_DOMAIN} subdomain`}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.planId)}
                      disabled={isCurrent || isUpgrading}
                      className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition ${
                        isCurrent
                          ? 'border border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
                          : 'bg-[#1ed760] text-black hover:bg-[#16c653] cursor-pointer disabled:opacity-50'
                      }`}
                    >
                      {isUpgrading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : isCurrent ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Current Plan</span>
                        </>
                      ) : (
                        <>
                          <span>{plan.planId === 'free' ? 'Switch to Free' : `Select ${plan.planName}`}</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add-ons & Extra Slots Section */}
      {addons.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Add-ons & Extra Slots
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Expand your store capacity or unlock POS access using Cloud Credits without changing your base tier.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {addons.map((addon) => {
              const addonId = addon.addonId;
              const isPurchasing = purchasingAddonId === addonId;
              const activeCount = getAddonCount(subscription, addonId);
              const isPosAddon = addonId === 'pos_access';
              const posAlreadyActive = isPosAddon && (Boolean(subscription?.hasPos) || activeCount > 0);

              return (
                <div
                  key={addonId}
                  className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {addon.name}
                      </h3>
                      {posAlreadyActive ? (
                        <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          Active
                        </span>
                      ) : activeCount > 0 ? (
                        <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {activeCount} active
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                      {addon.description}
                    </p>

                    <div className="pt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                      ${addon.price}
                      <span className="ml-1 text-xs font-normal text-neutral-500 dark:text-neutral-400">
                        / month
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handlePurchaseAddon(addon)}
                      disabled={posAlreadyActive || isPurchasing}
                      className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-semibold transition ${
                        posAlreadyActive
                          ? 'border border-neutral-200 bg-neutral-100 text-neutral-500 cursor-not-allowed dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-400'
                          : 'bg-[#1ed760] text-black hover:bg-[#16c653] cursor-pointer disabled:opacity-50'
                      }`}
                    >
                      {isPurchasing ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : posAlreadyActive ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Included in Account</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add for ${addon.price}/mo</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Package Limits Comparison Table */}
      {plans.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
              Plan Limits Comparison
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Side-by-side quotas across available monthly packages.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  <th className="py-3 pr-4 font-medium">Capability</th>
                  {plans.map((plan) => (
                    <th key={plan.planId} className="px-3 py-3 font-semibold text-neutral-950 dark:text-white">
                      {plan.planName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-700 dark:divide-neutral-800 dark:text-neutral-300">
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">Monthly Price</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3 font-mono">
                      {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">Product Limit</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3 font-mono">
                      {plan.productLimit >= 999999 ? 'Unlimited' : plan.productLimit.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">Warehouse Limit</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3 font-mono">
                      {plan.warehouseLimit >= 99 ? 'Unlimited' : plan.warehouseLimit}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">Staff Limit</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3 font-mono">
                      {plan.staffLimit >= 999999 ? 'Unlimited' : plan.staffLimit}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">Monthly Order Limit</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3 font-mono">
                      {plan.monthlyOrderLimit >= 999999 ? 'Unlimited' : plan.monthlyOrderLimit.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">POS System</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3">
                      {plan.hasPos ? 'Included' : 'Add-on'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-neutral-950 dark:text-white">Custom Domain</td>
                  {plans.map((plan) => (
                    <td key={plan.planId} className="px-3 py-3">
                      {plan.hasCustomDomain ? 'Included' : `*.${STORE_DOMAIN}`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 dark:border-neutral-800 dark:bg-neutral-900 space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-neutral-500" />
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:text-white dark:hover:bg-neutral-800/60"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-3 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-300">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
