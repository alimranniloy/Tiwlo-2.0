import React from 'react';
import { Search, Globe2, Rocket } from 'lucide-react';

/**
 * UidsHowItWorks Component
 * Minimized, compact and sleek 3-step guide
 */
export default function UidsHowItWorks({ onGetStarted }) {
  const steps = [
    {
      num: '01',
      title: 'Search & Claim',
      desc: 'Lock your clean .uids.app address in seconds with zero credit card.',
      icon: <Search className="w-4 h-4 text-emerald-600" />,
      tag: 'Instant'
    },
    {
      num: '02',
      title: 'Connect or Upload',
      desc: 'Route to Vercel, GitHub Pages, or use built-in 20MB edge static storage.',
      icon: <Globe2 className="w-4 h-4 text-blue-600" />,
      tag: 'Zero-Config'
    },
    {
      num: '03',
      title: 'Broadcast Globally',
      desc: 'Live on Anycast edge with automated wildcard SSL in under 60 seconds.',
      icon: <Rocket className="w-4 h-4 text-purple-600" />,
      tag: 'Global Edge'
    }
  ];

  return (
    <section id="how-it-works" className="w-full max-w-5xl mx-auto px-4">
      <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          Simple 3-Step Setup
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-2 mb-1">
          How uids.app Works
        </h2>
        <p className="text-xs sm:text-sm text-slate-600">
          From project idea to a globally reachable live link in under a minute.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {steps.map((s, i) => (
          <div
            key={i}
            className="group bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all duration-150 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {s.icon}
                </div>
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  {s.num}
                </span>
              </div>

              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                {s.tag}
              </div>

              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {s.title}
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
