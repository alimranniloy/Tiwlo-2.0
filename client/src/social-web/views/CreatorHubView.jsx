import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Check,
  Sparkles,
  DollarSign,
  TrendingUp,
  Award,
  Video,
  Edit3,
  ShieldCheck,
  CreditCard,
  Zap,
  BarChart3
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function CreatorHubView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [billingCycle, setBillingCycle] = useState('annual'); // 'annual' | 'monthly'
  const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'monetization'
  const [subscribedTier, setSubscribedTier] = useState(currentUser?.isVerified ? 'pro' : null);

  const handleSubscribe = (tierKey) => {
    setSubscribedTier(tierKey);
    showToast(`Subscribed to Tiwi ${tierKey.toUpperCase()}! Verified creator badge activated.`, 'info');
  };

  const plans = [
    {
      id: 'basic',
      name: 'Starter Creator',
      popular: false,
      priceMonthly: 0,
      priceAnnual: 0,
      desc: 'Everything you need to share, connect, and build an audience on Tiwi.',
      features: [
        'Standard stream publishing',
        'Direct messaging and audio spaces',
        'Public collections and bookmarks',
        'Up to 720p standard video uploads',
      ],
    },
    {
      id: 'pro',
      name: 'Tiwi One Pro',
      popular: true,
      priceMonthly: 6,
      priceAnnual: 60,
      desc: 'Our most popular plan for creators seeking verified identity and advanced reach.',
      features: [
        'Everything in Starter, plus:',
        'Official Verified Creator Badge',
        'High-definition 1080p video uploads (up to 2 hours)',
        'Full Tiwi Assistant AI reasoning access',
        'Ads Revenue Sharing program eligibility',
        'Advanced post engagement analytics',
        'Edit post within 1 hour of publishing',
      ],
    },
    {
      id: 'vip',
      name: 'Tiwi One Studio',
      popular: false,
      priceMonthly: 14,
      priceAnnual: 140,
      desc: 'Maximum priority, custom creator branding, and revenue sharing pool boost.',
      features: [
        'Everything in Tiwi One Pro, plus:',
        'Gold Creator Studio badge option',
        'Top reply ranking in all community threads',
        'Priority ad revenue pool payout multiplier',
        'Custom domain support for creator profile',
        'Dedicated 24/7 creator concierge support',
      ],
    },
  ];

  return (
    <div className="w-full flex flex-col min-h-screen max-w-4xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
              Creator Hub & Verification
            </h1>
            <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              Monetization, verified badges, and creator tools
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.05] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-white dark:bg-[#16161f] text-[#1c1e21] dark:text-[#e4e6eb] shadow-xs'
                : 'text-[#65676b] dark:text-[#8a8d91]'
            }`}
          >
            Plans
          </button>
          <button
            onClick={() => setActiveTab('monetization')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'monetization'
                ? 'bg-white dark:bg-[#16161f] text-[#1c1e21] dark:text-[#e4e6eb] shadow-xs'
                : 'text-[#65676b] dark:text-[#8a8d91]'
            }`}
          >
            Analytics & Payouts
          </button>
        </div>
      </div>

      {activeTab === 'plans' ? (
        <div className="space-y-6">
          {/* Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 p-6 sm:p-8 text-white shadow-xl">
            <div className="max-w-xl relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md">
                  Tiwi Creator Program
                </span>
                <CheckCircle2 className="w-4 h-4 text-violet-200 fill-current" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                Elevate your reach. Get verified.
              </h2>
              <p className="text-white/80 text-sm leading-relaxed mb-4">
                Unlock high-bitrate video streaming, AI assistant tools, ad revenue sharing, and your official verified badge.
              </p>

              {/* Billing Toggle */}
              <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-md p-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    billingCycle === 'monthly' ? 'bg-white text-violet-900 shadow-sm' : 'text-white/80'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    billingCycle === 'annual' ? 'bg-white text-violet-900 shadow-sm' : 'text-white/80'
                  }`}
                >
                  <span>Annual</span>
                  <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const isSubscribed = subscribedTier === plan.id;
              const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;

              return (
                <div
                  key={plan.id}
                  className={`bg-white dark:bg-[#16161f] rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 relative ${
                    plan.popular
                      ? 'border-violet-500 shadow-xl shadow-violet-500/10 ring-1 ring-violet-500'
                      : 'border-black/[0.05] dark:border-white/[0.06] shadow-sm'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <h3 className="text-[17px] font-bold text-[#1c1e21] dark:text-[#e4e6eb]">
                      {plan.name}
                    </h3>
                    <p className="text-[12px] text-[#65676b] dark:text-[#8a8d91] mt-1 min-h-[36px]">
                      {plan.desc}
                    </p>

                    <div className="my-5">
                      <span className="text-3xl font-extrabold text-[#1c1e21] dark:text-[#e4e6eb]">
                        ${price}
                      </span>
                      <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91] ml-1">
                        /{billingCycle === 'annual' ? 'year' : 'month'}
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-[12.5px] text-[#4b4f56] dark:text-[#b0b3b8]">
                          <Check className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isSubscribed}
                    className={`mt-6 w-full py-2.5 rounded-xl font-semibold text-[13px] transition cursor-pointer active:scale-95 shadow-sm ${
                      isSubscribed
                        ? 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1c1e21] dark:text-[#e4e6eb]'
                        : plan.popular
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/25'
                        : 'bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] text-[#1c1e21] dark:text-[#e4e6eb]'
                    }`}
                  >
                    {isSubscribed ? 'Current Plan' : plan.priceMonthly === 0 ? 'Free Starter' : 'Subscribe Now'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Analytics & Payouts Tab */
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#16161f] p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm">
              <span className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91]">Estimated Earnings</span>
              <div className="text-2xl font-extrabold text-[#1c1e21] dark:text-[#e4e6eb] mt-1">$482.50</div>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 inline-block">+18% this month</span>
            </div>

            <div className="bg-white dark:bg-[#16161f] p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm">
              <span className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91]">Monthly Impressions</span>
              <div className="text-2xl font-extrabold text-[#1c1e21] dark:text-[#e4e6eb] mt-1">248.6K</div>
              <span className="text-[11px] text-violet-500 font-semibold mt-1 inline-block">Top 5% creator</span>
            </div>

            <div className="bg-white dark:bg-[#16161f] p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm">
              <span className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91]">Subscriber Tips</span>
              <div className="text-2xl font-extrabold text-[#1c1e21] dark:text-[#e4e6eb] mt-1">1,240 Coins</div>
              <span className="text-[11px] text-amber-500 font-semibold mt-1 inline-block">12 tips received</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#16161f] p-6 rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm">
            <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-2">
              Ad Revenue Sharing Eligibility
            </h3>
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] mb-4">
              Creators with Tiwi One Pro or Studio who maintain at least 500 followers and 10,000 monthly impressions receive bi-weekly revenue payouts directly to their linked bank or crypto wallet.
            </p>

            <button
              onClick={() => showToast('Payout setup is ready. Connect Stripe or Bank in Settings.', 'info')}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-violet-500/20 cursor-pointer"
            >
              Configure Payout Method
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
