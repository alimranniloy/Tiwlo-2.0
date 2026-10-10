import React from 'react';
import { Check, ArrowRight } from 'lucide-react';

/**
 * UidsPricingCards Component
 * Clean Google-inspired Plan Cards:
 * - Free Plan: 20MB Hosting (Mint Green Surface)
 * - Paid Plan: More Power (Ice Blue Surface)
 * Crisp borders, no lag, generous whitespace.
 */
export default function UidsPricingCards({ onSelectPlan }) {
  const freePoints = [
    'Short & clean subdomain',
    '20MB static hosting',
    'Custom branding',
    'No backend (static only)',
  ];

  const paidPoints = [
    'Larger storage space',
    'Node.js backend support',
    'Custom domains (optional)',
    'Priority support',
  ];

  return (
    <div id="pricing" className="w-full max-w-6xl mx-auto px-4 mt-8 sm:mt-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* FREE PLAN CARD (Mint Green Tint) */}
        <div className="relative bg-[#F4FBF7] border border-emerald-200/80 hover:border-emerald-300 rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              {/* Badge */}
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100/90 text-emerald-800 text-[11px] font-bold tracking-wider uppercase">
                FREE PLAN
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-4 mb-2 tracking-tight">
              20MB Hosting
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-slate-600 font-normal leading-relaxed mb-6">
              Perfect for simple sites, portfolios, links or early projects.
            </p>

            {/* Checklist */}
            <ul className="space-y-3 mb-8">
              {freePoints.map((point, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onSelectPlan && onSelectPlan('free')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-sm shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4 text-emerald-700" />
            </button>
          </div>
        </div>

        {/* PAID PLAN CARD (Ice Blue Tint) */}
        <div className="relative bg-[#F0F8FF] border border-blue-200/80 hover:border-blue-300 rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              {/* Badge */}
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100/90 text-blue-800 text-[11px] font-bold tracking-wider uppercase">
                PAID PLAN
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#2563EB] mt-4 mb-2 tracking-tight">
              More Power
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-slate-600 font-normal leading-relaxed mb-6">
              Run Node.js backend, get more storage and advanced features.
            </p>

            {/* Checklist */}
            <ul className="space-y-3 mb-8">
              {paidPoints.map((point, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <div className="w-5 h-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <button
              type="button"
              onClick={() => onSelectPlan && onSelectPlan('paid')}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-sm shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99]"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
