import React, { useEffect, useMemo, useState } from 'react';
import { applicationFetch } from '../api/graphqlTransport.js';
import { getCloudBillingData } from '../dashboards/cloud/graphql/cloudQueries.js';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  Shield,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';

async function resilientFetch(url, options = {}) {
  const token =
    localStorage.getItem('stockpro_session') ||
    sessionStorage.getItem('stockpro_session') ||
    '';
  const mergedHeaders = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const requestOptions = {
    credentials: 'include',
    ...options,
    headers: mergedHeaders,
  };

  try {
    return await applicationFetch(url, requestOptions);
  } catch (err) {
    if (String(err?.message || '').includes('No GraphQL operation is registered')) {
      return globalThis.fetch(url, requestOptions);
    }
    throw err;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function ServiceSubscriptionGateView({
  serviceType = 'discord',
  currentUser,
  initialData = null,
  onActivated,
  onBack,
  onNavigateBilling,
  showToast,
}) {
  const isDiscord = serviceType === 'discord';
  const serviceName = isDiscord ? 'Tiwlo Discord AI Bot' : 'WhatsApp Business Automation';
  const serviceShort = isDiscord ? 'Discord Console' : 'WhatsApp Automation';
  const ServiceIcon = isDiscord ? Bot : MessageCircle;

  const [loading, setLoading] = useState(!initialData);
  const [subscription, setSubscription] = useState(initialData?.subscription || null);
  const [packages, setPackages] = useState(
    Array.isArray(initialData?.packages) ? initialData.packages : []
  );
  const [tierInsight, setTierInsight] = useState(initialData?.tierInsight || null);
  const [notifications, setNotifications] = useState(
    Array.isArray(initialData?.notifications) ? initialData.notifications : []
  );
  const [creditBalance, setCreditBalance] = useState(null);

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);
  const [activationResult, setActivationResult] = useState(null);
  const [dismissingAlert, setDismissingAlert] = useState(false);

  const navigateToPath = (path, billingTab = 'overview') => {
    if (typeof onNavigateBilling === 'function') {
      onNavigateBilling(path, billingTab);
      return;
    }
    try {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign(path);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setLoading(true);
      try {
        const [subRes, pkgsRes, notifRes, billingRes] = await Promise.all([
          resilientFetch(`/api/${serviceType}/subscription`)
            .then((r) => (r.ok ? r.json().catch(() => null) : null))
            .catch(() => null),
          resilientFetch(`/api/${serviceType}/packages`)
            .then((r) => (r.ok ? r.json().catch(() => null) : null))
            .catch(() => null),
          resilientFetch(`/api/${serviceType}/subscription/notifications`)
            .then((r) => (r.ok ? r.json().catch(() => null) : null))
            .catch(() => null),
          currentUser?.id
            ? getCloudBillingData(currentUser.id).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const nextSub = subRes?.subscription ?? initialData?.subscription ?? null;
        const nextPackages = Array.isArray(subRes?.packages) && subRes.packages.length > 0
          ? subRes.packages
          : Array.isArray(pkgsRes?.packages) && pkgsRes.packages.length > 0
            ? pkgsRes.packages
            : Array.isArray(initialData?.packages)
              ? initialData.packages
              : [];
        const nextTierInsight = subRes?.tierInsight ?? initialData?.tierInsight ?? null;
        const nextNotifications = Array.isArray(notifRes?.notifications)
          ? notifRes.notifications
          : Array.isArray(subRes?.notifications)
            ? subRes.notifications
            : Array.isArray(initialData?.notifications)
              ? initialData.notifications
              : [];

        setSubscription(nextSub);
        setPackages(nextPackages);
        setTierInsight(nextTierInsight);
        setNotifications(nextNotifications);

        if (typeof nextSub?.autoRenew === 'boolean') {
          setAutoRenew(nextSub.autoRenew);
        }

        const rawCredits = billingRes?.account?.credits ?? billingRes?.credits;
        if (rawCredits !== undefined && rawCredits !== null && Number.isFinite(Number(rawCredits))) {
          setCreditBalance(Number(rawCredits));
        }

        const recommendedId =
          nextTierInsight?.recommendedPlanId ||
          nextPackages.find((p) => p.recommended || p.badge)?.planId ||
          nextPackages[0]?.planId ||
          '';
        setSelectedPlanId((prev) => (prev && nextPackages.some((p) => p.planId === prev) ? prev : recommendedId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [serviceType, currentUser?.id]);

  const enrichedPackages = useMemo(() => {
    const insightTiers = Array.isArray(tierInsight?.tiers) ? tierInsight.tiers : [];
    return packages.map((pkg) => {
      const matched = insightTiers.find((t) => t.planId === pkg.planId) || {};
      const isRecommended = Boolean(
        matched.isRecommended ||
          tierInsight?.recommendedPlanId === pkg.planId ||
          pkg.recommended ||
          pkg.badge
      );
      return {
        ...pkg,
        ...matched,
        planId: pkg.planId,
        planName: pkg.planName || matched.planName,
        price: Number(pkg.price ?? matched.price ?? 0),
        isRecommended,
        badgeLabel:
          matched.badge ||
          (tierInsight?.recommendedPlanId === pkg.planId ? 'Recommended' : null) ||
          pkg.badge ||
          (pkg.recommended ? 'Recommended' : null),
      };
    });
  }, [packages, tierInsight]);

  const selectedPlan = useMemo(
    () => enrichedPackages.find((p) => p.planId === selectedPlanId) || enrichedPackages[0] || null,
    [enrichedPackages, selectedPlanId]
  );

  const unreadPaymentAlerts = useMemo(
    () =>
      notifications.filter(
        (n) => (n.kind === 'payment_failed' || n.type === 'payment_failed') && !n.readAt && !n.read
      ),
    [notifications]
  );

  const hasPaymentAlert = Boolean(
    subscription?.status === 'past_due' ||
      subscription?.lastRenewalError ||
      unreadPaymentAlerts.length > 0
  );

  const handleDismissNotifications = async () => {
    if (dismissingAlert) return;
    setDismissingAlert(true);
    try {
      const ids = unreadPaymentAlerts.map((n) => n.id).filter(Boolean);
      await resilientFetch(`/api/${serviceType}/subscription/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids.length ? { notificationIds: ids } : {}),
      });
      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          n.kind === 'payment_failed' || n.type === 'payment_failed' ? { ...n, readAt, read: true } : n
        )
      );
      showToast?.('Alert dismissed.', 'info');
    } catch (err) {
      showToast?.(err.message || 'Could not dismiss alert.', 'error');
    } finally {
      setDismissingAlert(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan || purchasing) return;
    setPurchasing(true);
    setPurchaseError(null);

    try {
      const res = await resilientFetch(`/api/${serviceType}/subscription/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.planId,
          autoRenew: Boolean(autoRenew),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const requiredAmount = Number(data.requiredAmount ?? selectedPlan.price ?? 0);
        const availableCredits =
          data.availableCredits !== undefined && data.availableCredits !== null
            ? Number(data.availableCredits)
            : creditBalance;
        const shortfall =
          data.shortfall !== undefined && data.shortfall !== null
            ? Number(data.shortfall)
            : availableCredits !== null
              ? Math.max(0, Number((requiredAmount - availableCredits).toFixed(2)))
              : null;

        setPurchaseError({
          message:
            data.error ||
            (res.status === 402
              ? `Insufficient Tiwlo Credits to activate ${selectedPlan.planName}.`
              : 'Could not complete subscription purchase.'),
          code: data.code || (res.status === 402 ? 'INSUFFICIENT_CREDITS' : 'PURCHASE_FAILED'),
          status: res.status,
          requiredAmount,
          availableCredits,
          shortfall,
        });
        if (Array.isArray(data.packages) && data.packages.length > 0) {
          setPackages(data.packages);
        }
        return;
      }

      if (
        data?.billing?.remainingCredits !== undefined &&
        data?.billing?.remainingCredits !== null
      ) {
        setCreditBalance(Number(data.billing.remainingCredits));
      } else if (creditBalance !== null) {
        setCreditBalance(Math.max(0, Number((creditBalance - Number(selectedPlan.price || 0)).toFixed(2))));
      }

      setSubscription(data.subscription || null);
      setActivationResult(data);
      window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
      showToast?.(data.message || `${selectedPlan.planName} activated!`, 'success');
    } catch (err) {
      setPurchaseError({
        message: err.message || 'Subscription request failed.',
        code: 'NETWORK_ERROR',
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-24 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-72 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
            <div className="h-72 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
            <div className="h-72 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  // Post-purchase Invoice Confirmation Card
  if (activationResult) {
    const activatedSub = activationResult.subscription || subscription || {};
    const inv = activationResult.invoice || {};
    const billing = activationResult.billing || {};
    const invoiceId = inv.id || billing.invoiceId || null;
    const orderNumber = inv.orderNumber || billing.orderNumber || null;
    const amount = Number(inv.amount ?? billing.chargedAmount ?? activatedSub.price ?? selectedPlan?.price ?? 0);
    const statusLabel = inv.status || 'Paid';
    const invoiceDate = inv.paidAt || inv.createdAt || activatedSub.startedAt || new Date().toISOString();

    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1ED760]/15 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    Subscription Activated · Paid
                  </span>
                  <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">
                    {activatedSub.planName || selectedPlan?.planName} is Active
                  </h1>
                  <p className="mt-1 text-xs text-neutral-500">
                    Your {serviceName} workspace has been provisioned and your billing invoice has been generated.
                  </p>
                </div>
              </div>
            </div>

            {/* Generated Invoice Confirmation Card */}
            <div className="rounded-xl border border-neutral-200/80 bg-[#fafafa] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200/70 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-neutral-700" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                    Generated Invoice Confirmation
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-emerald-800">
                  <Check className="h-3 w-3" />
                  {statusLabel}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">Invoice Reference</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-neutral-950 break-all">
                    {invoiceId || orderNumber || activatedSub.id || 'Generated'}
                  </dd>
                </div>
                {orderNumber && (
                  <div>
                    <dt className="text-neutral-500">Order Number</dt>
                    <dd className="mt-0.5 font-mono font-semibold text-neutral-950">
                      {orderNumber}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-neutral-500">Plan</dt>
                  <dd className="mt-0.5 font-semibold text-neutral-950">
                    {activatedSub.planName || selectedPlan?.planName}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Amount Charged</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-neutral-950">
                    ${amount.toFixed(2)} USD (Tiwlo Credits)
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Date</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">{formatDate(invoiceDate)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Auto-Renewal</dt>
                  <dd className="mt-0.5 font-medium text-neutral-800">
                    {activatedSub.autoRenew !== false ? 'Enabled (Monthly)' : 'Off (Manual)'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
              <button
                type="button"
                onClick={() =>
                  navigateToPath(
                    invoiceId ? `/billing/invoices/${encodeURIComponent(invoiceId)}` : '/billing',
                    'invoices'
                  )
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-neutral-600" />
                <span>View &amp; Download Invoice</span>
                <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
                  onActivated?.(activationResult);
                }}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-5 text-xs font-semibold text-black transition hover:bg-[#19c354] cursor-pointer"
              >
                <span>Enter Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (onBack) onBack();
              else navigateToPath('/workspace', 'overview');
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Workspace</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs">
              <Wallet className="h-3.5 w-3.5 text-[#1ED760]" />
              <span className="text-neutral-500">Wallet Credits:</span>
              <span className="font-bold tabular-nums text-neutral-950">
                {creditBalance !== null ? `$${creditBalance.toFixed(2)}` : 'Checking...'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigateToPath('/billing/credits', 'credits')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50 cursor-pointer"
            >
              <span>Top Up Credits</span>
            </button>
          </div>
        </div>

        {/* Payment Failure / Past-Due Alert Banner */}
        {hasPaymentAlert && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-rose-950">
                  {subscription?.status === 'past_due'
                    ? 'Subscription Past Due — Auto-Renewal Payment Failed'
                    : 'Payment Failure Alert'}
                </p>
                <p className="text-xs text-rose-800 leading-relaxed">
                  {subscription?.lastRenewalError ||
                    unreadPaymentAlerts[0]?.message ||
                    'Automatic renewal could not be completed due to insufficient Tiwlo Credits. Top up your credits and reactivate a plan below to restore dashboard access.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigateToPath('/billing/credits', 'credits')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>Top Up Credits</span>
              </button>
              {unreadPaymentAlerts.length > 0 && (
                <button
                  type="button"
                  disabled={dismissingAlert}
                  onClick={handleDismissNotifications}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{dismissingAlert ? 'Dismissing...' : 'Dismiss'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Service Gate Hero Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  isDiscord ? 'bg-[#1ED760] text-black' : 'bg-[#25D366] text-white'
                }`}
              >
                <ServiceIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                    <Lock className="h-3 w-3" />
                    Active Subscription Required
                  </span>
                  <span className="text-xs font-medium text-neutral-500">{serviceShort}</span>
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                  Activate {serviceName}
                </h1>
                <p className="mt-1 max-w-2xl text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {isDiscord
                    ? 'An active paid subscription is required before entering the Discord Console. Choose a usage tier below to unlock Official Tiwlo AI Bot invites, server binding, Auto-Moderation, and monthly AI commands.'
                    : 'An active paid subscription is required before entering WhatsApp Automation. Choose a usage tier below to unlock QR device linking, AI auto-replies, store catalog sync, and broadcast messaging.'}
                </p>
              </div>
            </div>
          </div>

          {/* Insufficient Credits / Purchase Error Banner */}
          {purchaseError && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-rose-950">{purchaseError.message}</p>
                  {purchaseError.shortfall !== null && purchaseError.shortfall !== undefined && purchaseError.shortfall > 0 && (
                    <p>
                      Required: <span className="font-semibold">${Number(purchaseError.requiredAmount || 0).toFixed(2)}</span> ·
                      Available: <span className="font-semibold">${Number(purchaseError.availableCredits || 0).toFixed(2)}</span> ·
                      Shortfall: <span className="font-semibold text-rose-950">${Number(purchaseError.shortfall).toFixed(2)}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateToPath('/billing/credits', 'credits')}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5 text-[#1ED760]" />
                <span>Top Up Wallet Credits</span>
              </button>
            </div>
          )}

          {/* Usage-Based Tiered Plans Grid */}
          {enrichedPackages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-xs text-neutral-500">
              No subscription packages are currently available. Please contact support or check billing.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {enrichedPackages.map((pkg) => {
                const isSelected = selectedPlan?.planId === pkg.planId;
                const price = Number(pkg.price || 0);
                const insufficient = creditBalance !== null && creditBalance < price;
                const shortfall = insufficient ? Math.max(0, price - creditBalance) : 0;

                return (
                  <button
                    key={pkg.planId}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(pkg.planId);
                      setPurchaseError(null);
                    }}
                    className={`flex flex-col justify-between rounded-xl border p-5 text-left transition cursor-pointer ${
                      isSelected
                        ? 'border-[#1ED760] bg-[#1ED760]/5 ring-2 ring-[#1ED760]/40'
                        : pkg.isRecommended
                          ? 'border-neutral-300 bg-white shadow-xs hover:border-neutral-400'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="text-base font-semibold text-neutral-950">{pkg.planName}</h2>
                          <p className="mt-0.5 text-xs text-neutral-500">{pkg.description}</p>
                        </div>
                        {pkg.badgeLabel && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            <Sparkles className="h-2.5 w-2.5" />
                            {pkg.badgeLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between border-b border-neutral-100 pb-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold tabular-nums text-neutral-950">
                            ${price.toFixed(2)}
                          </span>
                          <span className="text-xs text-neutral-500">/ month</span>
                        </div>
                        {creditBalance !== null && (
                          <span
                            className={`text-[11px] font-semibold ${
                              insufficient ? 'text-amber-700' : 'text-emerald-700'
                            }`}
                          >
                            {insufficient ? `Short $${shortfall.toFixed(2)}` : 'Credits Ready'}
                          </span>
                        )}
                      </div>

                      {isDiscord ? (
                        <div className="space-y-2 text-xs text-neutral-700">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Connected Servers</span>
                            <span className="font-semibold">{pkg.maxServersPerBot ?? 1} server(s)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Monthly AI Commands</span>
                            <span className="font-semibold tabular-nums">
                              {Number(pkg.monthlyCommandsLimit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Webhooks Limit</span>
                            <span className="font-semibold tabular-nums">{pkg.webhookLimit ?? 2}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Auto-Moderation</span>
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                pkg.autoModEnabled ? 'text-emerald-700' : 'text-neutral-400'
                              }`}
                            >
                              <Shield className="h-3 w-3" />
                              {pkg.autoModEnabled ? 'Included' : 'Starter Excluded'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs text-neutral-700">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">WhatsApp Sessions</span>
                            <span className="font-semibold">{pkg.maxSessions ?? 1} number(s)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Monthly Messages</span>
                            <span className="font-semibold tabular-nums">
                              {Number(pkg.monthlyMessagesLimit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Daily Broadcasts</span>
                            <span className="font-semibold tabular-nums">
                              {Number(pkg.dailyBroadcastLimit || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Auto-Reply Flows</span>
                            <span className="font-semibold">{pkg.autoReplyFlowsLimit ?? 3}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Custom Webhooks</span>
                            <span className="font-semibold">
                              {pkg.webhookEnabled ? 'Included' : 'Pro+'}
                            </span>
                          </div>
                        </div>
                      )}

                      {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                        <ul className="space-y-1.5 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                          {pkg.features.slice(0, 3).map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1ED760]" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-5 w-full">
                      <div
                        className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-[#1ED760] text-black'
                            : 'border border-neutral-200 bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Selected Tier</span>
                          </>
                        ) : (
                          <span>Select {pkg.planName}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Auto-Renewal Toggle & Primary Activation CTA */}
          {selectedPlan && (
            <div className="flex flex-col gap-4 rounded-xl border border-neutral-200/80 bg-[#fafafa] p-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(e) => setAutoRenew(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-[#1ED760] cursor-pointer"
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-950">
                    <RefreshCw className="h-3.5 w-3.5 text-[#1ED760]" />
                    <span>Auto-Renew Monthly with Tiwlo Credits</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    Automatically renews your {selectedPlan.planName} subscription every 30 days using your wallet balance. You can toggle this off anytime.
                  </p>
                </div>
              </label>

              <button
                type="button"
                disabled={purchasing || !selectedPlan}
                onClick={handlePurchase}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-5 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-60 cursor-pointer"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Activating with Credits...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>
                      Activate {selectedPlan.planName} · ${Number(selectedPlan.price || 0).toFixed(2)} Credits
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
