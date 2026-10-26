import React, { useState } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export default function StudioPricingSection({ onNavigateAuth, onNavigateTab }) {
  const [billingPeriod, setBillingPeriod] = useState('monthly');

  const plans = [
    {
      id: 'starter',
      name: 'Starter Artist',
      description: 'Perfect for new creators releasing their first singles.',
      price: billingPeriod === 'monthly' ? '$0' : '$0',
      period: 'free forever',
      badge: null,
      features: [
        'Distribute to Spotify, Apple & 50+ stores',
        'Keep 100% of your master rights',
        'Standard delivery within 7 days',
        'Basic streaming analytics',
        'Community support'
      ],
      ctaText: 'Get Started Free',
      popular: false
    },
    {
      id: 'pro',
      name: 'Independent Pro',
      description: 'Unlimited releases with accelerated delivery and verified artist badge.',
      price: billingPeriod === 'monthly' ? '$9.99' : '$7.99',
      period: billingPeriod === 'monthly' ? '/ month' : '/ month billed annually',
      badge: 'Most Popular',
      features: [
        'Unlimited releases to 200+ platforms',
        '100% royalties with zero commission',
        'Priority store delivery in < 48 hours',
        'Real-time analytics & listener demographics',
        'Custom ISRC and UPC codes',
        'Dedicated artist landing page'
      ],
      ctaText: 'Start Pro Trial',
      popular: true
    },
    {
      id: 'label',
      name: 'Label & Collective',
      description: 'For management groups, indie labels, and artist collectives.',
      price: billingPeriod === 'monthly' ? '$29.99' : '$24.99',
      period: billingPeriod === 'monthly' ? '/ month' : '/ month billed annually',
      badge: 'For Teams',
      features: [
        'Manage up to 10 distinct artists',
        'Automatic royalty split calculations',
        'Direct YouTube Content ID claiming',
        'Custom metadata & delivery schedules',
        'Priority 24/7 dedicated label manager'
      ],
      ctaText: 'Contact Sales',
      popular: false
    }
  ];

  const handleSelect = (plan) => {
    if (onNavigateAuth) {
      onNavigateAuth('signup');
    } else if (onNavigateTab) {
      onNavigateTab('create-account');
    } else {
      window.location.href = '/create-account';
    }
  };

  return (
    <section id="pricing" className="py-20 md:py-32 relative bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 shadow-2xs mb-4 text-blue-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Pricing</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight mb-4">
            Keep 100% of Your Earnings.
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Simple, Predictable Plans.
            </span>
          </h2>

          <p className="text-base text-slate-600">
            No hidden cut. No surprise renewal fees. Scale your music career on your own terms.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="mt-8 inline-flex items-center p-1 rounded-full bg-slate-200/80 border border-slate-300/60 text-xs font-semibold">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-full transition-all cursor-pointer ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                billingPeriod === 'annual'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                plan.popular
                  ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-500/10 scale-100 md:-translate-y-2'
                  : 'bg-white border border-slate-200/80 shadow-sm hover:shadow-md'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-sm">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-950 mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  {plan.description}
                </p>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-slate-950 tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {plan.period}
                  </span>
                </div>

                <div className="space-y-3 mb-8 pt-6 border-t border-slate-100">
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleSelect(plan)}
                className={`w-full py-3 px-5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <span>{plan.ctaText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
