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
  CreditCard
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
        'Dedicated 24/7 creator support concierge',
      ],
    },
  ];

  return (
    <div className="w-full flex flex-col min-h-screen max-w-4xl mx-auto">
      {/* 1. App Bar Header */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center justify-between border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('feed')}
            className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-[20px] font-extrabold text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
              Creator Studio & Plans
            </h1>
            <p className="text-[12px] text-[#747775] dark:text-[#8E918F]">
              Unlock monetization tools, creator badges, and high-fidelity uploads
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Plans
          </button>
          <button
            onClick={() => setActiveTab('monetization')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer ${
              activeTab === 'monetization'
                ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                : 'text-[#444746] dark:text-[#C4C7C5]'
            }`}
          >
            Earnings
          </button>
        </div>
      </div>

      {/* 2. Plans View (Google One Inspired) */}
      {activeTab === 'plans' && (
        <div className="flex flex-col gap-6 pb-20">
          {/* Header Banner */}
          <div className="text-center flex flex-col items-center px-4">
            <div className="w-12 h-12 rounded-3xl bg-[#0B57D0]/10 text-[#0B57D0] flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-[26px] sm:text-[30px] font-extrabold text-[#1F1F1F] dark:text-[#E3E3E3] tracking-tight">
              Elevate your creator presence
            </h2>
            <p className="text-[14px] text-[#747775] dark:text-[#8E918F] max-w-md mt-1 leading-relaxed">
              Transparent, simple creator tiers designed to help you build and monetize your community.
            </p>

            {/* Annual / Monthly Switch */}
            <div className="flex items-center gap-1 bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full mt-6 shadow-xs">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                    : 'text-[#747775] dark:text-[#8E918F]'
                }`}
              >
                <span>Annual billing</span>
                <span className="text-[11px] bg-[#0F5223]/10 text-[#0F5223] dark:text-[#6DD58C] px-2 py-0.2 rounded-full font-bold">
                  Save 16%
                </span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                    : 'text-[#747775] dark:text-[#8E918F]'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-2">
            {plans.map((tier) => {
              const isCurrent = subscribedTier === tier.id || (tier.id === 'basic' && !subscribedTier);
              const priceText =
                tier.priceMonthly === 0
                  ? 'Free'
                  : billingCycle === 'annual'
                  ? `$${(tier.priceAnnual / 12).toFixed(2)}/mo`
                  : `$${tier.priceMonthly}/mo`;

              return (
                <div
                  key={tier.id}
                  className={`bg-white dark:bg-[#1E1F20] rounded-3xl p-6 border flex flex-col justify-between transition-all duration-200 shadow-xs relative ${
                    tier.popular
                      ? 'border-[#0B57D0] ring-2 ring-[#0B57D0]/20'
                      : 'border-[#E0E2EC] dark:border-[#313335]'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-6 bg-[#0B57D0] text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                      Recommended
                    </div>
                  )}

                  <div>
                    <h3 className="text-[18px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
                      {tier.name}
                    </h3>
                    <div className="mt-3">
                      <span className="text-[28px] font-black text-[#1F1F1F] dark:text-[#E3E3E3]">
                        {priceText}
                      </span>
                      {tier.priceMonthly > 0 && (
                        <p className="text-[12px] text-[#747775] dark:text-[#8E918F] mt-0.5">
                          {billingCycle === 'annual' ? `Billed $${tier.priceAnnual} annually` : 'Billed monthly'}
                        </p>
                      )}
                    </div>

                    <p className="text-[13px] text-[#747775] dark:text-[#8E918F] mt-3 leading-relaxed">
                      {tier.desc}
                    </p>

                    <div className="flex flex-col gap-2.5 mt-6 pt-5 border-t border-[#E0E2EC]/70 dark:border-[#313335]">
                      {tier.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-[13px]">
                          <Check className="w-4 h-4 text-[#0B57D0] flex-shrink-0 mt-0.5" />
                          <span className={feat.includes('Badge') ? 'font-bold text-[#1F1F1F] dark:text-[#E3E3E3]' : 'text-[#444746] dark:text-[#C4C7C5]'}>
                            {feat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={() => handleSubscribe(tier.id)}
                      disabled={isCurrent}
                      className={`w-full py-2.5 rounded-full font-semibold text-[14px] transition active:scale-95 cursor-pointer ${
                        isCurrent
                          ? 'bg-[#E9EEF6] dark:bg-[#282A2C] text-[#747775] dark:text-[#8E918F] cursor-default'
                          : tier.popular
                          ? 'bg-[#0B57D0] hover:bg-[#0842A0] text-white shadow-xs'
                          : 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : tier.priceMonthly === 0 ? 'Default Plan' : `Get ${tier.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Monetization Dashboard View (YouTube Studio Earn Inspired) */}
      {activeTab === 'monetization' && (
        <div className="flex flex-col gap-5 pb-20 px-2">
          {/* Earnings Card */}
          <div className="bg-gradient-to-r from-[#0B57D0] to-[#4285F4] text-white p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">
                Payout Hub
              </span>
              <h2 className="text-[28px] sm:text-[34px] font-black mt-2 leading-tight">
                $684.20
              </h2>
              <p className="text-[13px] text-blue-100 mt-1">
                Estimated balance ready for automatic payout via connected Stripe account.
              </p>
            </div>

            <button
              onClick={() => showToast('Opening Stripe Express dashboard...', 'info')}
              className="bg-white text-[#0B57D0] font-bold text-[13px] px-5 py-2.5 rounded-full hover:bg-blue-50 transition shadow-xs self-start sm:self-auto cursor-pointer"
            >
              Payout Settings
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs">
              <span className="text-[12px] font-medium text-[#747775] dark:text-[#8E918F]">Monthly Reach</span>
              <div className="text-[22px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] mt-1">2.41M</div>
              <span className="text-[11px] text-[#0F5223] dark:text-[#6DD58C] font-semibold">↑ +38% this month</span>
            </div>

            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs">
              <span className="text-[12px] font-medium text-[#747775] dark:text-[#8E918F]">Subscribers</span>
              <div className="text-[22px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] mt-1">42</div>
              <span className="text-[11px] text-[#0B57D0] font-semibold">$4.99 / subscriber</span>
            </div>

            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs">
              <span className="text-[12px] font-medium text-[#747775] dark:text-[#8E918F]">Ad Revenue Pool</span>
              <div className="text-[22px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] mt-1">$474.62</div>
              <span className="text-[11px] text-[#0F5223] dark:text-[#6DD58C] font-semibold">Verified replies</span>
            </div>

            <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-5 shadow-xs">
              <span className="text-[12px] font-medium text-[#747775] dark:text-[#8E918F]">Tips & Support</span>
              <div className="text-[22px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3] mt-1">$209.58</div>
              <span className="text-[11px] text-[#747775] dark:text-[#8E918F]">18 supporters</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
