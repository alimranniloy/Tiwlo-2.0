import React from 'react';
import { Zap, Code2, Database, ShieldCheck } from 'lucide-react';

/**
 * UidsFeaturesRow Component
 * Matches screenshot 4 feature cards:
 * 1. Free Hosting (⚡)
 * 2. Node.js Support (</>)
 * 3. More Storage (🗄️)
 * 4. Your Brand (🛡️)
 */
export default function UidsFeaturesRow() {
  const features = [
    {
      title: 'Free Hosting',
      desc: 'Get 20MB static hosting for free with every subdomain.',
      icon: <Zap className="w-5 h-5 text-emerald-600" />,
      iconBg: 'bg-emerald-50 border border-emerald-100',
    },
    {
      title: 'Node.js Support',
      desc: 'No backend on free plan. Paid plan supports Node.js.',
      icon: <Code2 className="w-5 h-5 text-slate-800" />,
      iconBg: 'bg-slate-100 border border-slate-200',
    },
    {
      title: 'More Storage',
      desc: 'Upgrade anytime for larger storage and features.',
      icon: <Database className="w-5 h-5 text-purple-600" />,
      iconBg: 'bg-purple-50 border border-purple-100',
    },
    {
      title: 'Your Brand',
      desc: 'Use it for your app, tool, portfolio, blog or business.',
      icon: <ShieldCheck className="w-5 h-5 text-pink-600" />,
      iconBg: 'bg-pink-50 border border-pink-100',
    },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 mt-12 sm:mt-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {features.map((f, i) => (
          <div
            key={i}
            className="group relative bg-white/90 backdrop-blur-sm border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 text-left flex flex-col justify-between"
          >
            <div>
              {/* Soft Rounded Icon Container */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3.5 ${f.iconBg} group-hover:scale-105 transition-transform duration-150`}>
                {f.icon}
              </div>

              {/* Title */}
              <h3 className="text-[15px] sm:text-base font-bold text-slate-900 tracking-tight mb-1">
                {f.title}
              </h3>

              {/* Description */}
              <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed font-normal">
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
