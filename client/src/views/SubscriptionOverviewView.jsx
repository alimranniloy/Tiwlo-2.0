import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  Globe,
  ArrowLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

const API_BASE = '/api';

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

  // Real-time scan of both subscription config and actual products database
  const loadData = async () => {
    try {
      setRefreshing(true);
      const [subRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/subscription`),
        fetch(`${API_BASE}/products`)
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData);
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
      }
    } catch (err) {
      console.error('Error fetching subscription overview:', err);
      showToast?.('Error scanning database', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copySubdomain = () => {
    if (!subscription?.subdomain) return;
    const url = `https://${subscription.subdomain}`;
    navigator.clipboard.writeText(url);
    setCopiedSubdomain(true);
    showToast?.('Domain copied to clipboard!');
    setTimeout(() => setCopiedSubdomain(false), 2000);
  };

  // Metrics from real-time database scan
  const totalCount = products.length;
  const productLimit = subscription?.productLimit || 50;
  const usagePercent = Math.min(100, Math.round((totalCount / productLimit) * 100));
  const remainingSlots = Math.max(0, productLimit - totalCount);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-150">
      {/* ========================================================= */}
      {/* 1. TOP HEADER                                             */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 dark:border-gray-800 gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToDashboard}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs cursor-pointer group shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Subscription & Storage
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex-1 sm:flex-none justify-center flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Scan Database</span>
          </button>

          <button
            onClick={onNavigateToPricing}
            className="flex-1 sm:flex-none justify-center flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white/20" />
            <span>Upgrade Plan</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CURRENT PLAN & PRODUCT STORAGE PANEL                   */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-6 sm:p-7 shadow-xs space-y-6">
        {/* Plan Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-gray-700/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Current Plan
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800">
                Active
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {subscription?.planName || 'Free Starter'}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                (${subscription?.price || 0} / month)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              1 Central Warehouse Location • POS Register & Online Storefront Included
            </p>
          </div>

          <div>
            <button
              onClick={onNavigateToPricing}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              Change Plan
            </button>
          </div>
        </div>

        {/* Product Catalog Storage Bar (Clean Google One Style) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Product Catalog Storage
            </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {totalCount} of {productLimit > 100000 ? 'Unlimited' : `${productLimit} products`} ({usagePercent}%)
            </span>
          </div>

          {/* Simple, sleek 8px progress bar */}
          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${Math.max(3, Math.min(100, usagePercent))}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {productLimit > 100000 ? 'Unlimited product capacity' : `${remainingSlots} product slots remaining on Free Starter`}
            </span>
            <button
              onClick={onNavigateToPricing}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
            >
              Get more slots →
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. STOREFRONT DOMAIN & NETWORK PANEL                      */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 p-6 sm:p-7 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Storefront Domain
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            The web address customers use to browse your catalog and place orders
          </p>
        </div>

        {/* Primary Subdomain Row */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {subscription?.subdomain || 'No subdomain assigned'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  SSL Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Free pre-configured subdomain provided by Tiwlo
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={copySubdomain}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-slate-100 dark:hover:bg-gray-700 border border-slate-200 dark:border-gray-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition flex items-center space-x-1 cursor-pointer"
            >
              {copiedSubdomain ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSubdomain ? 'Copied' : 'Copy'}</span>
            </button>
            <a
              href="/?view=store"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 text-xs font-semibold transition flex items-center space-x-1 cursor-pointer"
            >
              <span>Visit Store</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Custom Domain Note Row */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-gray-700/70">
          <span>
            Want to use your own domain (e.g. <strong className="text-slate-700 dark:text-slate-200">store.yourbrand.com</strong>)?
          </span>
          <button
            onClick={onNavigateToPricing}
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            Available on Growth & Pro →
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. CLEAN PRODUCTION UPGRADE BANNER                        */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 dark:from-gray-800/90 dark:via-blue-950/20 dark:to-gray-800/90 border border-blue-200/70 dark:border-gray-700 rounded-2xl p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Need more product slots or your own custom domain?
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl">
            Upgrade to Growth Retailer ($19/mo) for 500 products or Pro Business ($49/mo) for 5,000 products, multi-warehouse routing, and multi-vendor boothing.
          </p>
        </div>

        <div className="shrink-0">
          <button
            onClick={onNavigateToPricing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95 group"
          >
            <span>View Plans & Pricing</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
