import React, { useState, useEffect } from 'react';
import { STORE_DOMAIN } from '../config/platformConfig';
import {
  Sparkles,
  Check,
  Crown,
  Shield,
  Zap,
  Globe,
  Boxes,
  Database,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Server,
  Layers,
  ShoppingBag,
  Sliders,
  DollarSign
} from 'lucide-react';

const API_BASE = '/api';

export default function PricingPlansView({
  onBackToOverview,
  showToast,
  onRefreshData
}) {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'annual'
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  // Fetch real subscription & quota from database
  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/subscription`);
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
        if (data.billingCycle) {
          setBillingCycle(data.billingCycle);
        }
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      showToast?.('Failed to load subscription status', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  // Handle plan upgrade or change
  const handleSelectPlan = async (planId) => {
    if (subscription?.planId === planId && subscription?.billingCycle === billingCycle) {
      return; // Already active
    }

    try {
      setUpgradingPlanId(planId);
      const res = await fetch(`${API_BASE}/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSubscription(result.subscription);
        showToast?.(`Success! Your account is now on ${result.subscription.planName}.`);
        onRefreshData?.();
      } else {
        showToast?.(result.error || 'Failed to update subscription', 'error');
      }
    } catch (err) {
      console.error('Plan upgrade error:', err);
      showToast?.('Connection error while updating plan', 'error');
    } finally {
      setUpgradingPlanId(null);
    }
  };

  // Define the 4 Subscription Plans (Free + 3 Paid Tiers)
  const plans = [
    {
      id: 'free',
      name: 'Free Starter',
      badge: 'Free Forever',
      badgeColor: 'bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-slate-300',
      description: 'Ideal for independent store owners testing online retail & local stock management.',
      monthlyPrice: 0,
      annualPrice: 0,
      productLimit: 50,
      productLimitLabel: '50 Products Quota',
      warehouseLimit: 1,
      warehouseLabel: '1 Warehouse Location',
      domainLabel: `Free Tiwlo Subdomain (*.${STORE_DOMAIN})`,
      hasCustomDomain: false,
      buttonLabel: 'Current Plan',
      isPopular: false,
      isEnterprise: false,
      features: [
        'Up to 50 active products & SKUs',
        `Free Tiwlo subdomain (yourstore.${STORE_DOMAIN})`,
        '1 Warehouse inventory management',
        'Single POS register terminal',
        'Real-time barcode generation & scanning',
        'Basic order & receipt printing',
        'Standard community support'
      ]
    },
    {
      id: 'growth',
      name: 'Growth Retailer',
      badge: 'Growing Stores',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      description: 'For expanding retail shops wanting custom branding and higher product limits.',
      monthlyPrice: 19,
      annualPrice: 15,
      productLimit: 500,
      productLimitLabel: '500 Products Quota',
      warehouseLimit: 2,
      warehouseLabel: '2 Multi-Location Warehouses',
      domainLabel: 'Connect Custom Domain + Free SSL',
      hasCustomDomain: true,
      buttonLabel: 'Upgrade to Growth',
      isPopular: false,
      isEnterprise: false,
      features: [
        'Up to 500 active products & SKUs',
        'Connect your own custom domain + SSL',
        'Free Tiwlo subdomain included',
        '2 Warehouse locations with stock transfers',
        'Automated low-stock restock alerts',
        'Thermal barcode printing format',
        'Priority email support (24h response)'
      ]
    },
    {
      id: 'pro',
      name: 'Pro Business',
      badge: 'Most Popular',
      badgeColor: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold',
      description: 'The complete multi-vendor commerce powerhouse with AI analytics and multi-warehouse routing.',
      monthlyPrice: 49,
      annualPrice: 39,
      productLimit: 5000,
      productLimitLabel: '5,000 Products Quota',
      warehouseLimit: 5,
      warehouseLabel: '5 Multi-Regional Warehouses',
      domainLabel: 'Custom Domain + Global Edge CDN',
      hasCustomDomain: true,
      buttonLabel: 'Upgrade to Pro',
      isPopular: true,
      isEnterprise: false,
      features: [
        'Up to 5,000 active products & SKUs',
        'Multi-Vendor Marketplace & seller boothing',
        '5 Warehouses with automated order routing',
        'AI Demand Forecasting & smart reorders',
        'Connect custom domain + Global Edge CDN',
        'Cash on Delivery & multi-gateway checkout',
        'Live staff activity audit trail & logs',
        '24/7 Priority Live Chat & Email Support'
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise VIP',
      badge: 'Unlimited VIP',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
      description: 'High-volume retail chains, wholesalers, and enterprise multi-channel distributors.',
      monthlyPrice: 129,
      annualPrice: 99,
      productLimit: 999999,
      productLimitLabel: 'Unlimited Products & SKUs',
      warehouseLimit: 99,
      warehouseLabel: 'Unlimited Multi-Location Warehouses',
      domainLabel: 'White-Label Domain & Custom CDN',
      hasCustomDomain: true,
      buttonLabel: 'Upgrade to Enterprise',
      isPopular: false,
      isEnterprise: true,
      features: [
        'Unlimited products & SKU catalog capacity',
        'Unlimited multi-location global warehouses',
        'Full multi-vendor marketplace with vendor commissions',
        'Enterprise REST API & webhook event triggers',
        'White-label storefront branding & custom subdomains',
        'High-concurrency cloud infrastructure (99.99% SLA)',
        'Dedicated Technical Account Manager & WhatsApp SLA'
      ]
    }
  ];

  const currentPlanId = subscription?.planId || 'free';

  const faqs = [
    {
      q: 'How does the Free Subdomain work?',
      a: `Every Tiwlo store on the Free Starter plan receives an instant SSL subdomain (such as yourstore.${STORE_DOMAIN}). Your store is live immediately and accessible worldwide.`
    },
    {
      q: 'What happens when I reach my product limit?',
      a: 'The Tiwlo database protects your catalog. Once you reach your plan limit (e.g. 50 products on Free Starter), new product additions will prompt you to upgrade. Existing products, stock sync, and sales orders remain 100% operational.'
    },
    {
      q: 'Can I connect my own custom domain later?',
      a: 'Yes! When you upgrade to Growth Retailer, Pro Business, or Enterprise VIP, you can map your custom domain (like store.yourbrand.com) with automatic HTTPS SSL certificate provisioning.'
    },
    {
      q: 'Can I switch or cancel my plan at any time?',
      a: 'Yes, upgrades take effect immediately with zero downtime. You can also switch between monthly and annual billing whenever you choose.'
    }
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-gray-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToOverview}
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition shadow-2xs cursor-pointer group"
            title="Back to Subscription Overview"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Subscription & Pricing
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Database Guard Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center space-x-2.5">
              <span>Subscription Plans</span>
              <Sparkles className="w-6 h-6 text-amber-500 fill-amber-400/20" />
            </h1>
          </div>
        </div>

        {/* Back link */}
        <button
          onClick={onBackToOverview}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 cursor-pointer"
        >
          <span>← Back to Storage & Quota Overview</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* BILLING CYCLE SWITCHER (MONTHLY / ANNUAL 20% DISCOUNT)    */}
      {/* ========================================================= */}
      <div className="flex flex-col items-center justify-center space-y-3 pt-2">
        <div className="flex items-center space-x-3 bg-slate-100 dark:bg-gray-800/80 p-1.5 rounded-2xl border border-slate-200/90 dark:border-gray-700/80 shadow-2xs">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-gray-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
              billingCycle === 'annual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Annual Billing</span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500 text-white">
              SAVE 20%
            </span>
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Annual plans include 2 months free + instant product quota expansion
        </p>
      </div>

      {/* ========================================================= */}
      {/* 4-TIER SUBSCRIPTION CARDS GRID (FREE + 3 PAID PLANS)     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isUpgrading = upgradingPlanId === plan.id;
          const displayPrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl flex flex-col justify-between transition-all duration-300 ${
                plan.isPopular
                  ? 'bg-white dark:bg-gray-800 border-2 border-amber-500 dark:border-amber-500 shadow-xl shadow-amber-500/10 hover:-translate-y-1'
                  : plan.isEnterprise
                  ? 'bg-white dark:bg-gray-800 border-2 border-purple-500/50 dark:border-purple-500/60 shadow-lg hover:-translate-y-1'
                  : isCurrent
                  ? 'bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-500 shadow-md'
                  : 'bg-white dark:bg-gray-800 border border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-md'
              } p-5 sm:p-7`}
            >
              {/* Top Plan Tag */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span>Active</span>
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                {/* Price Display */}
                <div className="pt-2 pb-1 border-b border-slate-100 dark:border-gray-700/80">
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                      ${displayPrice}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      / month
                    </span>
                  </div>
                  {billingCycle === 'annual' && plan.monthlyPrice > 0 && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Billed annually (${displayPrice * 12}/yr)
                    </p>
                  )}
                </div>

                {/* Core Quotas Highlights */}
                <div className="space-y-2 py-2">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Database className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{plan.productLimitLabel}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Boxes className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{plan.warehouseLabel}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{plan.domainLabel}</span>
                  </div>
                </div>

                {/* Feature List */}
                <div className="pt-3 border-t border-slate-100 dark:border-gray-700/80 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Included Capabilities
                  </div>
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-gray-700/80">
                <button
                  type="button"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent || isUpgrading}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center space-x-2 cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-100 dark:bg-gray-700/80 text-slate-400 dark:text-slate-400 cursor-not-allowed'
                      : plan.isPopular
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25 active:scale-98'
                      : plan.isEnterprise
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/25 active:scale-98'
                      : 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-98'
                  }`}
                >
                  {isUpgrading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Database...</span>
                    </>
                  ) : isCurrent ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Current Plan</span>
                    </>
                  ) : (
                    <>
                      <span>{plan.id === 'free' ? 'Downgrade to Free' : `Choose ${plan.name}`}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* DETAILED PLAN COMPARISON MATRIX                           */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-4 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Detailed Feature Comparison Matrix</span>
            <Sliders className="w-4 h-4 text-blue-500" />
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Compare all backend and storefront capabilities side-by-side across our 4 subscription tiers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[660px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-gray-700 text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Feature / Capacity</th>
                <th className="py-3 px-4">Free Starter</th>
                <th className="py-3 px-4">Growth Retailer</th>
                <th className="py-3 px-4 font-bold text-amber-600 dark:text-amber-400">Pro Business</th>
                <th className="py-3 px-4 font-bold text-purple-600 dark:text-purple-400">Enterprise VIP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/70 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Active Product Limit</td>
                <td className="py-3.5 px-4 font-mono font-semibold">50 Products</td>
                <td className="py-3.5 px-4 font-mono font-semibold">500 Products</td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">5,000 Products</td>
                <td className="py-3.5 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Storefront Subdomain</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">Free *.{STORE_DOMAIN}</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">Free *.{STORE_DOMAIN}</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">Free *.{STORE_DOMAIN}</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">White-label Subdomain</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Custom Domain Mapping</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Supported + SSL</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Global Edge CDN</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Unlimited Custom Domains</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Warehouse Locations</td>
                <td className="py-3.5 px-4 font-mono">1 Location</td>
                <td className="py-3.5 px-4 font-mono">2 Locations</td>
                <td className="py-3.5 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">5 Locations</td>
                <td className="py-3.5 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">Unlimited Locations</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Multi-Vendor Marketplace</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Multi-Vendor Boothing</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Vendor Splits & Commissions</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">AI Demand Forecasting</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ AI Restock Engine</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Advanced Predictive ERP</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Barcode & Label Printing</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">Standard Print</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">Thermal 50x30mm + Grid</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">All Thermal Formats</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">Bulk Automated Labeling</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">REST API & Webhooks</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 text-slate-400">—</td>
                <td className="py-3.5 px-4 font-medium">Standard Webhooks</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">✓ Full API & Webhook Ingest</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">Customer Support SLA</td>
                <td className="py-3.5 px-4">Community</td>
                <td className="py-3.5 px-4">Email (24h SLA)</td>
                <td className="py-3.5 px-4 font-semibold text-amber-600 dark:text-amber-400">24/7 Priority Live Support</td>
                <td className="py-3.5 px-4 font-semibold text-purple-600 dark:text-purple-400">Dedicated Manager & WhatsApp SLA</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FREQUENTLY ASKED QUESTIONS SECTION                        */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Frequently Asked Questions</span>
            <HelpCircle className="w-4 h-4 text-blue-500" />
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Need more information about billing, database quotas, or custom domains?
          </p>
        </div>

        <div className="space-y-3 pt-2">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={i}
                className="border border-slate-200/80 dark:border-gray-700/80 rounded-2xl overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-gray-750 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-90 text-blue-500' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-gray-700/60 bg-slate-50/50 dark:bg-gray-900/30">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
