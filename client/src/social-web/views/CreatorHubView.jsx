import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Check,
  Sparkles,
  Zap,
  DollarSign,
  TrendingUp,
  Award,
  Lock,
  Edit3,
  Video,
  FileText,
  BarChart2,
  FolderPlus
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function CreatorHubView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [billingCycle, setBillingCycle] = useState('annual'); // 'annual' | 'monthly'
  const [activeTab, setActiveTab] = useState('tiers'); // 'tiers' | 'monetization'
  const [subscribedTier, setSubscribedTier] = useState(currentUser?.isVerified ? 'premium' : null);

  const handleSubscribe = (tierKey) => {
    setSubscribedTier(tierKey);
    showToast(`Subscribed to Tiwi ${tierKey.toUpperCase()}! Verification badge active.`, 'info');
  };

  const tiers = [
    {
      id: 'basic',
      name: 'Basic',
      badge: null,
      priceMonthly: 3,
      priceAnnual: 32,
      desc: 'Essential creator features and personal branding.',
      features: [
        'Small reply boost',
        'Encrypted Direct Messages',
        'Bookmark Folders',
        'Highlights tab on profile',
        'Edit post within 1 hour',
        'Post longer videos (up to 1080p / 3 hours)',
        'Background video playback',
        'Download public videos',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      popular: true,
      badge: 'Blue Checkmark',
      priceMonthly: 8,
      priceAnnual: 84,
      desc: 'The complete creator experience with verified badge and monetization.',
      features: [
        'Everything in Basic, plus:',
        'Blue Verification Checkmark',
        'Half Ads in For You & Following feeds',
        'Larger reply boost in conversations',
        'Get paid to post: Ads Revenue Sharing',
        'Creator Subscriptions monetization',
        'Full Grok 2 AI Assistant access',
        'Tiwi Analytics & Audience Studio',
        'Access to Media Studio',
      ],
    },
    {
      id: 'premium_plus',
      name: 'Premium+',
      badge: 'Gold Checkmark Available',
      priceMonthly: 16,
      priceAnnual: 168,
      desc: 'Zero interruptions, maximum visibility, and long-form publishing.',
      features: [
        'Everything in Premium, plus:',
        'Fully Ad-Free in For You and Following',
        'Largest reply boost (top ranking in all replies)',
        'Write long-form Articles & formatting',
        'Tiwi Radar real-time trend analytics',
        'Priority 24/7 VIP support',
      ],
    },
  ];

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center gap-7 border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <button
          onClick={() => navigateTo('feed')}
          className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
            Premium
          </h1>
          <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
            Choose the right tier for you
          </span>
        </div>
      </div>

      {/* Top View Selector Tabs (Tiers vs Monetization) */}
      <div className="h-[53px] flex border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <button
          onClick={() => setActiveTab('tiers')}
          className="flex-1 h-full flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative cursor-pointer"
        >
          <span
            className={`text-[15px] ${
              activeTab === 'tiers'
                ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                : 'font-medium text-[#536471] dark:text-[#71767B]'
            }`}
          >
            Subscription Tiers
          </span>
          {activeTab === 'tiers' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('monetization')}
          className="flex-1 h-full flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative cursor-pointer"
        >
          <span
            className={`text-[15px] ${
              activeTab === 'monetization'
                ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                : 'font-medium text-[#536471] dark:text-[#71767B]'
            }`}
          >
            Monetization Dashboard
          </span>
          {activeTab === 'monetization' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
          )}
        </button>
      </div>

      {/* 2. Tiers View */}
      {activeTab === 'tiers' && (
        <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full pb-24 md:pb-12">
          {/* Hero Banner */}
          <div className="text-center flex flex-col items-center">
            <h2 className="text-[26px] sm:text-[32px] font-black text-[#0F1419] dark:text-[#E7E9EA] tracking-tight leading-tight">
              Upgrade your voice on Tiwi
            </h2>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B] max-w-md mt-1.5 leading-relaxed">
              Enjoy an enhanced experience, exclusive creator tools, verification, and monetization opportunities.
            </p>

            {/* Annual / Monthly Switcher with Discount Pill */}
            <div className="flex items-center gap-1 bg-[#EFF3F4] dark:bg-[#202327] p-1 rounded-full mt-5">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition flex items-center gap-1.5 ${
                  billingCycle === 'annual'
                    ? 'bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] shadow-xs'
                    : 'text-[#536471] dark:text-[#71767B]'
                }`}
              >
                <span>Annual</span>
                <span className="text-[11px] bg-[#00BA7C]/15 text-[#00BA7C] px-1.5 py-0.5 rounded-full font-bold">
                  SAVE 12%
                </span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-black text-[#0F1419] dark:text-[#E7E9EA] shadow-xs'
                    : 'text-[#536471] dark:text-[#71767B]'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {tiers.map((tier) => {
              const isCurrent = subscribedTier === tier.id;
              const price =
                billingCycle === 'annual'
                  ? `$${(tier.priceAnnual / 12).toFixed(2)}/mo`
                  : `$${tier.priceMonthly}/mo`;
              const billedNote =
                billingCycle === 'annual'
                  ? `Billed annually at $${tier.priceAnnual}/year`
                  : 'Billed monthly';

              return (
                <div
                  key={tier.id}
                  className={`rounded-3xl p-5 border flex flex-col justify-between transition relative ${
                    tier.popular
                      ? 'border-[#1D9BF0] shadow-[0_0_20px_rgba(29,155,240,0.15)] bg-white dark:bg-black'
                      : 'border-[#EFF3F4] dark:border-[#2F3336] bg-[#F7F9F9] dark:bg-[#16181C]'
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1D9BF0] text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA]">
                        {tier.name}
                      </h3>
                      {tier.badge && (
                        <CheckCircle2 className="w-5 h-5 text-[#1D9BF0] fill-current" />
                      )}
                    </div>

                    <div className="mt-3">
                      <span className="text-[28px] font-black text-[#0F1419] dark:text-[#E7E9EA]">
                        {price}
                      </span>
                      <p className="text-[12px] text-[#536471] dark:text-[#71767B] mt-0.5">
                        {billedNote}
                      </p>
                    </div>

                    <p className="text-[13px] text-[#536471] dark:text-[#71767B] mt-3 leading-relaxed">
                      {tier.desc}
                    </p>

                    <div className="flex flex-col gap-2.5 mt-5 pt-4 border-t border-[#EFF3F4] dark:border-[#2F3336]">
                      {tier.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-[13px]">
                          <Check className="w-4 h-4 text-[#1D9BF0] flex-shrink-0 mt-0.5" />
                          <span
                            className={
                              feat.includes('Checkmark') || feat.includes('Ad-Free')
                                ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                                : 'text-[#536471] dark:text-[#71767B]'
                            }
                          >
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
                      className={`w-full py-2.5 rounded-full font-bold text-[15px] transition active:scale-95 cursor-pointer ${
                        isCurrent
                          ? 'bg-[#00BA7C] text-white cursor-default'
                          : tier.popular
                          ? 'bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white shadow-xs'
                          : 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] hover:opacity-90'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : `Subscribe to ${tier.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Matrix Highlights */}
          <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-3xl p-5 bg-[#F7F9F9] dark:bg-[#16181C] mt-2">
            <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA] mb-4">
              Premium Creator Benefits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <Edit3 className="w-5 h-5 text-[#1D9BF0]" />
                <span className="font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">Edit Post</span>
                <span className="text-[12px] text-[#536471] dark:text-[#71767B]">
                  Update text, tags, and media up to 1 hour after posting.
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <Video className="w-5 h-5 text-[#1D9BF0]" />
                <span className="font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">1080p Video</span>
                <span className="text-[12px] text-[#536471] dark:text-[#71767B]">
                  Upload crisp 1080p video files up to 3 hours long.
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <Sparkles className="w-5 h-5 text-[#1D9BF0]" />
                <span className="font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">Grok 2 Access</span>
                <span className="text-[12px] text-[#536471] dark:text-[#71767B]">
                  Unrestricted conversations with Tiwi’s intelligent AI model.
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <DollarSign className="w-5 h-5 text-[#00BA7C]" />
                <span className="font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">Revenue Sharing</span>
                <span className="text-[12px] text-[#536471] dark:text-[#71767B]">
                  Earn monthly payouts directly from ads in your reply threads.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Monetization Dashboard View */}
      {activeTab === 'monetization' && (
        <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full pb-24 md:pb-12">
          {/* Monetization Summary Header */}
          <div className="bg-[#0F1419] dark:bg-[#16181C] text-white p-6 rounded-3xl border border-[#EFF3F4]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#1D9BF0] text-white tracking-wider">
                Payout Hub
              </span>
              <h2 className="text-[24px] font-black mt-2">Creator Earnings: $684.20</h2>
              <p className="text-[13px] text-[#71767B] mt-0.5">
                Next automatic payout on October 15, 2026 to connected Stripe account.
              </p>
            </div>
            <button
              onClick={() => showToast('Opening Stripe Express Payout portal...', 'info')}
              className="bg-white text-black font-bold text-[14px] px-5 py-2.5 rounded-full hover:bg-gray-100 transition self-start sm:self-auto"
            >
              Payout Settings
            </button>
          </div>

          {/* Stats Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4 bg-[#F7F9F9] dark:bg-[#16181C]">
              <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Monthly Impressions</div>
              <div className="text-[22px] font-black text-[#0F1419] dark:text-[#E7E9EA] mt-1">2.41M</div>
              <div className="text-[11px] text-[#00BA7C] font-bold mt-0.5">↑ +38% this month</div>
            </div>

            <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4 bg-[#F7F9F9] dark:bg-[#16181C]">
              <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Active Subscribers</div>
              <div className="text-[22px] font-black text-[#0F1419] dark:text-[#E7E9EA] mt-1">42</div>
              <div className="text-[11px] text-[#1D9BF0] font-bold mt-0.5">$4.99 / subscriber</div>
            </div>

            <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4 bg-[#F7F9F9] dark:bg-[#16181C]">
              <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Ads Revenue Share</div>
              <div className="text-[22px] font-black text-[#0F1419] dark:text-[#E7E9EA] mt-1">$474.62</div>
              <div className="text-[11px] text-[#00BA7C] font-bold mt-0.5">Verified replies pool</div>
            </div>

            <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-2xl p-4 bg-[#F7F9F9] dark:bg-[#16181C]">
              <div className="text-[13px] text-[#536471] dark:text-[#71767B]">Tips Received</div>
              <div className="text-[22px] font-black text-[#0F1419] dark:text-[#E7E9EA] mt-1">$209.58</div>
              <div className="text-[11px] text-[#536471] dark:text-[#71767B] font-bold mt-0.5">18 tippers</div>
            </div>
          </div>

          {/* Eligibility Progress */}
          <div className="border border-[#EFF3F4] dark:border-[#2F3336] rounded-3xl p-5 bg-[#F7F9F9] dark:bg-[#16181C] flex flex-col gap-4">
            <h3 className="font-extrabold text-[17px] text-[#0F1419] dark:text-[#E7E9EA]">
              Ads Revenue Sharing Program Status
            </h3>

            <div className="flex flex-col gap-3">
              <div>
                <div className="flex justify-between text-[13px] font-bold mb-1">
                  <span className="text-[#0F1419] dark:text-[#E7E9EA]">5 Million Impressions (Past 3 Months)</span>
                  <span className="text-[#1D9BF0]">2,410,000 / 5,000,000 (48%)</span>
                </div>
                <div className="w-full bg-[#EFF3F4] dark:bg-[#202327] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-[#1D9BF0] h-full w-[48%] rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[13px] font-bold mb-1">
                  <span className="text-[#0F1419] dark:text-[#E7E9EA]">Minimum 500 Verified Followers</span>
                  <span className="text-[#00BA7C]">1,840 / 500 (Completed)</span>
                </div>
                <div className="w-full bg-[#EFF3F4] dark:bg-[#202327] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-[#00BA7C] h-full w-full rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
