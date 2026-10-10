import React from 'react';
import { Search, Globe2, Rocket, ArrowRight } from 'lucide-react';

/**
 * UidsHowItWorks Component
 * Google-inspired 3-step walkthrough for launching on uids.app
 */
export default function UidsHowItWorks({ onGetStarted }) {
  const steps = [
    {
      num: '01',
      title: 'Search & Claim',
      desc: 'Type your project name and claim your free .uids.app address instantly without credit cards.',
      icon: <Search className="w-5 h-5 text-emerald-600" />,
      tag: 'Instant Check'
    },
    {
      num: '02',
      title: 'Connect or Upload',
      desc: 'Route to Vercel, GitHub Pages, or use 20MB of high-speed static storage built directly into your subdomain.',
      icon: <Globe2 className="w-5 h-5 text-blue-600" />,
      tag: 'Zero-Config'
    },
    {
      num: '03',
      title: 'Broadcast Globally',
      desc: 'Your subdomain goes live across our global Anycast edge with automated SSL certificates in under 60 seconds.',
      icon: <Rocket className="w-5 h-5 text-purple-600" />,
      tag: 'Sub-50ms Edge'
    }
  ];

  return (
    <section id="how-it-works" className="w-full max-w-6xl mx-auto px-4 mt-20 sm:mt-24">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full uppercase tracking-wider">
          Simple 3-Step Setup
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 mb-2">
          How uids.app Works
        </h2>
        <p className="text-sm sm:text-base text-slate-600">
          From brainstorming a project idea to a globally reachable live link in less than a minute.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {steps.map((s, i) => (
          <div
            key={i}
            className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-6 shadow-xs hover:shadow-sm transition-all duration-150 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                  {s.icon}
                </div>
                <span className="text-xs font-bold text-slate-400 font-mono tracking-wider">
                  {s.num}
                </span>
              </div>

              <div className="inline-block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {s.tag}
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {s.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
