import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';
import { getCloudBillingData } from '../../dashboards/cloud/graphql/cloudQueries.js';

export function DiscordPlanSelector({
  currentUser,
  subscription,
  packages: propPackages,
  tierInsight = null,
  onActivated,
  onNavigateBilling,
  onClose,
  isModal = false,
}) {
  const [packages, setPackages] = useState(Array.isArray(propPackages) ? propPackages : []);
  const [creditBalance, setCreditBalance] = useState(null);
  const [autoRenew, setAutoRenew] = useState(subscription?.autoRenew !== false);
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatedInvoiceId, setGeneratedInvoiceId] = useState(null);

  useEffect(() => {
    if (typeof subscription?.autoRenew === 'boolean') {
      setAutoRenew(subscription.autoRenew);
    }
  }, [subscription?.autoRenew]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setLoading(true);
      try {
        const [pkgs, billing] = await Promise.all([
          Array.isArray(propPackages) && propPackages.length > 0
            ? Promise.resolve(propPackages)
            : DiscordAPI.getPackages(),
          currentUser?.id
            ? getCloudBillingData(currentUser.id).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setPackages(Array.isArray(pkgs) ? pkgs : []);
        const rawCredits = billing?.account?.credits ?? billing?.credits;
        if (rawCredits !== undefined && rawCredits !== null && Number.isFinite(Number(rawCredits))) {
          setCreditBalance(Number(rawCredits));
        }
      } catch (err) {
        if (!cancelled) setErrorMsg(err.message || 'Could not load Discord Bot packages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, propPackages]);

  const navigateBillingPath = (path, tab) => {
    if (typeof onNavigateBilling === 'function') {
      onNavigateBilling(path, tab);
      return;
    }
    try {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign(path);
    }
  };

  const handlePurchase = async (pkg) => {
    setErrorMsg('');
    setSuccessMsg('');
    setGeneratedInvoiceId(null);
    setPurchasingId(pkg.planId);
    try {
      const res = await DiscordAPI.purchaseSubscription(pkg.planId, autoRenew);
      setSuccessMsg(`${pkg.planName} activated using Tiwlo Credits!`);
      if (res?.invoice?.id) {
        setGeneratedInvoiceId(res.invoice.id);
      }
      if (res?.billing?.remainingCredits !== undefined && res.billing?.remainingCredits !== null) {
        setCreditBalance(Number(res.billing.remainingCredits));
      } else if (creditBalance !== null) {
        setCreditBalance(Math.max(0, Number((creditBalance - Number(pkg.price || 0)).toFixed(2))));
      }
      window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
      await onActivated?.(res.subscription, res);
      if (isModal && onClose && !res?.invoice?.id) {
        setTimeout(() => onClose(), 700);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not activate Discord Bot subscription.');
    } finally {
      setPurchasingId(null);
    }
  };

  const content = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Tiwlo Credits Billing
          </p>
          <p className="mt-0.5 text-sm font-medium text-neutral-900">
            Select a paid Discord Bot subscription plan. Free activation is disabled.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3.5 py-2">
          <Wallet className="h-4 w-4 text-[#1ED760]" />
          <span className="text-xs text-neutral-500">Available Credits:</span>
          <span className="text-sm font-bold tabular-nums text-neutral-950">
            {creditBalance !== null ? `$${creditBalance.toFixed(2)}` : 'Checking...'}
          </span>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-4 py-3 cursor-pointer">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="h-4 w-4 text-[#1ED760]" />
          <div>
            <p className="text-xs font-semibold text-neutral-900">Auto-Renew Monthly with Tiwlo Credits</p>
            <p className="text-[11px] text-neutral-500">Automatically renew every 30 days using your wallet balance.</p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={autoRenew}
          onChange={(e) => setAutoRenew(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760] cursor-pointer"
        />
      </label>

      {errorMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => navigateBillingPath('/billing/credits', 'credits')}
            className="font-semibold text-rose-800 underline hover:text-rose-950 cursor-pointer"
          >
            Add Tiwlo Credits →
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-[#1ED760]/15 px-4 py-3 text-xs font-semibold text-emerald-800">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
          {generatedInvoiceId && (
            <button
              type="button"
              onClick={() => navigateBillingPath(`/billing/invoices/${encodeURIComponent(generatedInvoiceId)}`, 'invoices')}
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 border border-emerald-200 hover:bg-emerald-50 cursor-pointer"
            >
              <FileText className="h-3 w-3" />
              View Invoice
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-64 animate-pulse rounded-xl border border-neutral-200/80 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {packages.map((pkg) => {
            const isCurrent = subscription?.isActive && subscription?.planId === pkg.planId;
            const isRecommended = tierInsight?.recommendedPlanId === pkg.planId || pkg.recommended;
            const badgeText = pkg.badge || (isRecommended ? 'Recommended' : null);
            const insufficient = creditBalance !== null && creditBalance < Number(pkg.price || 0);
            return (
              <div
                key={pkg.planId}
                className={`flex flex-col justify-between rounded-xl border p-5 transition ${
                  isCurrent
                    ? 'border-[#1ED760] bg-[#1ED760]/5 ring-1 ring-[#1ED760]/40'
                    : badgeText
                      ? 'border-neutral-300 bg-white shadow-sm'
                      : 'border-neutral-200/80 bg-white'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-950">{pkg.planName}</h3>
                      <p className="mt-0.5 text-xs text-neutral-500">{pkg.description}</p>
                    </div>
                    {badgeText && (
                      <span className="shrink-0 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                        {badgeText}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 border-b border-neutral-100 pb-3">
                    <span className="text-2xl font-bold tabular-nums text-neutral-950">
                      ${Number(pkg.price || 0).toFixed(2)}
                    </span>
                    <span className="text-xs text-neutral-500">/ month (Credits)</span>
                  </div>

                  <div className="space-y-2 text-xs text-neutral-700">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Connected Servers</span>
                      <span className="font-semibold">{pkg.maxServersPerBot} server(s)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Monthly AI Commands</span>
                      <span className="font-semibold tabular-nums">{Number(pkg.monthlyCommandsLimit || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Auto-Moderation Suite</span>
                      <span className={`inline-flex items-center gap-1 font-semibold ${pkg.autoModEnabled ? 'text-emerald-700' : 'text-neutral-400'}`}>
                        <Shield className="h-3 w-3" />
                        {pkg.autoModEnabled ? 'Included' : 'Starter Excluded'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500">Custom Persona Prompt</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <Sparkles className="h-3 w-3" />
                        Yes
                      </span>
                    </div>
                  </div>

                  {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                    <ul className="space-y-1.5 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
                      {pkg.features.slice(0, 4).map((feat, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1ED760]" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    disabled={purchasingId !== null || isCurrent}
                    onClick={() => handlePurchase(pkg)}
                    className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition ${
                      isCurrent
                        ? 'border border-[#1ED760] bg-[#1ED760]/15 text-emerald-800 cursor-default'
                        : insufficient
                          ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'bg-[#1ED760] text-black hover:bg-[#19c354]'
                    } disabled:opacity-60`}
                  >
                    {purchasingId === pkg.planId ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Processing Credits...
                      </>
                    ) : isCurrent ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Current Active Plan
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-3.5 w-3.5" />
                        {subscription?.isActive ? `Switch to ${pkg.planName}` : `Pay $${Number(pkg.price || 0).toFixed(2)} Credits`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!isModal) return content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Discord AI Bot Subscription Plans</h2>
            <p className="text-xs text-neutral-500">Instant activation or upgrade using your Tiwlo Credit balance.</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {content}
      </div>
    </div>
  );
}

export default DiscordPlanSelector;
