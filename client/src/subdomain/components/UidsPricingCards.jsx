import React from 'react';
import { Check, ArrowRight } from 'lucide-react';

/**
 * UidsPricingCards Component
 * Minimized, compact and sleek per user feedback:
 * - Refined padding and typography
 * - Crisp Google-style borders
 * - Subtle elevation, zero bloat
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
    <div id="pricing" className="w-full max-w-5xl mx-auto px-4 mt-6 sm:mt-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* FREE PLAN CARD (Mint Green Tint) */}
        <div className="relative bg-[#F4FBF7] border border-emerald-200/90 hover:border-emerald-300 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              {/* Badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-wider uppercase">
                FREE PLAN
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-3 mb-1 tracking-tight">
              20MB Hosting
            </h2>

            {/* Subtitle */}
            <p className="text-xs text-slate-600 font-normal leading-relaxed mb-4">
              Perfect for simple sites, portfolios, links or early projects.
            </p>

            {/* Checklist */}
            <ul className="space-y-2 mb-6">
              {freePoints.map((point, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
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
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          </div>
        </div>

        {/* PAID PLAN CARD (Ice Blue Tint) */}
        <div className="relative bg-[#F0F8FF] border border-blue-200/90 hover:border-blue-300 rounded-2xl p-5 sm:p-6 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              {/* Badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold tracking-wider uppercase">
                PAID PLAN
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#2563EB] mt-3 mb-1 tracking-tight">
              More Power
            </h2>

            {/* Subtitle */}
            <p className="text-xs text-slate-600 font-normal leading-relaxed mb-4">
              Run Node.js backend, get more storage and advanced features.
            </p>

            {/* Checklist */}
            <ul className="space-y-2 mb-6">
              {paidPoints.map((point, i) => (
                <li key={i} className="flex items-center gap-2.5 text-xs font-medium text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
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
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-2xs hover:shadow-xs transition-all duration-150 active:scale-[0.99]"
            >
              <span>Upgrade to Pro</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
