import React from 'react';
import { ShieldCheck, Zap, Server, Lock, Cpu, RefreshCw } from 'lucide-react';

/**
 * UidsEdgeSpecs Component
 * Google-inspired clean 6-card infrastructure feature grid
 */
export default function UidsEdgeSpecs() {
  const specs = [
    {
      title: 'Automated Edge SSL',
      desc: 'Instant wildcard TLS certificates issued and auto-renewed with zero manual configuration.',
      icon: <Lock className="w-5 h-5 text-emerald-600" />,
      bg: 'bg-emerald-50'
    },
    {
      title: 'Global Anycast DNS',
      desc: 'Over 200+ edge POPs worldwide ensuring ultra-low sub-50ms DNS resolution latencies.',
      icon: <Zap className="w-5 h-5 text-amber-600" />,
      bg: 'bg-amber-50'
    },
    {
      title: 'DDoS & L7 Defense',
      desc: 'Automatic protection against volumetric floods, script bots, and Layer-7 traffic spikes.',
      icon: <ShieldCheck className="w-5 h-5 text-blue-600" />,
      bg: 'bg-blue-50'
    },
    {
      title: 'Instant DNS Sync',
      desc: 'CNAME, A, and TXT updates propagate across all global resolvers within 60 seconds.',
      icon: <RefreshCw className="w-5 h-5 text-indigo-600" />,
      bg: 'bg-indigo-50'
    },
    {
      title: 'Custom Host Routing',
      desc: 'Seamlessly point your subdomains to Vercel, Netlify, GitHub Pages, Render, or custom VPS IPs.',
      icon: <Server className="w-5 h-5 text-purple-600" />,
      bg: 'bg-purple-50'
    },
    {
      title: 'Developer REST API',
      desc: 'Automate subdomain registration, programmatic validation, and routing through clean API endpoints.',
      icon: <Cpu className="w-5 h-5 text-slate-800" />,
      bg: 'bg-slate-100'
    }
  ];

  return (
    <section id="features" className="w-full max-w-6xl mx-auto px-4 mt-20 sm:mt-24">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-3 py-1 rounded-full uppercase tracking-wider">
          Enterprise Edge Backbone
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 mb-2">
          Engineered for Speed & Reliability
        </h2>
        <p className="text-sm sm:text-base text-slate-600">
          Everything your modern web application or portfolio needs to stay fast, secure, and always accessible.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {specs.map((s, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all duration-150 text-left"
          >
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
              {s.icon}
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1.5">
              {s.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
