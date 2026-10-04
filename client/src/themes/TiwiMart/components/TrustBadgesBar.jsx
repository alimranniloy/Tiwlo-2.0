import React from 'react';
import { ShieldCheck, CreditCard, Headphones, Globe2, CheckCircle2 } from 'lucide-react';

export default function TrustBadgesBar() {
  const pillars = [
    {
      icon: ShieldCheck,
      title: 'Buyer Protection',
      subtitle: 'Shop with confidence'
    },
    {
      icon: CreditCard,
      title: 'Secure Payments',
      subtitle: 'Multiple payment options'
    },
    {
      icon: Headphones,
      title: '24/7 Support',
      subtitle: "We're here to help"
    },
    {
      icon: Globe2,
      title: 'Global Reach',
      subtitle: '200+ countries & regions'
    },
    {
      icon: CheckCircle2,
      title: 'Verified Sellers',
      subtitle: 'Trusted & authentic'
    }
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-3">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs px-5 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {pillars.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center space-x-3 group cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Icon className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 leading-tight">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
