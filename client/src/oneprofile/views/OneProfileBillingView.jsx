import React from 'react';
import { CreditCard, Check, Crown, ArrowRight, ShieldCheck } from 'lucide-react';

export default function OneProfileBillingView() {
  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Billing & Subscriptions</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage your active plans, payment cards, and invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Free Plan Card */}
        <div className="bg-[#F4FBF7] rounded-2xl border border-emerald-200/90 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
              CURRENT PLAN
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900 mt-3 mb-1">Free 200MB Tier</h3>
            <p className="text-xs text-slate-600 mb-5">Perfect for personal portfolios, simple links and hobby sites.</p>

            <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>1 Live Website on your own .uids.app subdomain</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>200MB Edge Static Storage</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>Automated SSL certificates</span>
              </li>
            </ul>
          </div>

          <div className="text-xs text-slate-500 font-medium">Free forever. No credit card required.</div>
        </div>

        {/* Pro Plan Card */}
        <div className="bg-[#F0F8FF] rounded-2xl border border-blue-200/90 p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider">
                RECOMMENDED
              </span>
              <span className="text-sm font-extrabold text-[#2563EB]">$9 / month</span>
            </div>
            <h3 className="text-2xl font-extrabold text-[#2563EB] mt-3 mb-1">Pro Developer</h3>
            <p className="text-xs text-slate-600 mb-5">Unlocks Node.js backend, multiple subdomains and custom domains.</p>

            <ul className="space-y-2 text-xs text-slate-700 font-medium mb-6">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] stroke-[3]" />
                <span>Unlimited .uids.app subdomains</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] stroke-[3]" />
                <span>Connect your own custom root domains (.com, .dev, etc.)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] stroke-[3]" />
                <span>Node.js Serverless Execution & 5GB Storage</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2563EB] stroke-[3]" />
                <span>Discounted NFC physical cards</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            className="w-full py-2.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
