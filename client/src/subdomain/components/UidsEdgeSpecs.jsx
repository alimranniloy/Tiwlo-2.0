import React from 'react';
import { ShieldCheck, Zap, Server, Lock, Cpu, RefreshCw } from 'lucide-react';

/**
 * UidsEdgeSpecs Component
 * Minimized, compact and sleek 6-card infrastructure grid
 */
export default function UidsEdgeSpecs() {
  const specs = [
    {
      title: 'Automated Edge SSL',
      desc: 'Instant wildcard TLS certificates issued and renewed with zero manual setup.',
      icon: <Lock className="w-4 h-4 text-emerald-600" />,
      bg: 'bg-emerald-50'
    },
    {
      title: 'Global Anycast DNS',
      desc: '200+ edge POPs ensuring ultra-fast sub-50ms DNS resolution latencies.',
      icon: <Zap className="w-4 h-4 text-amber-600" />,
      bg: 'bg-amber-50'
    },
    {
      title: 'DDoS & L7 Defense',
      desc: 'Automatic protection against volumetric floods and traffic spikes.',
      icon: <ShieldCheck className="w-4 h-4 text-blue-600" />,
      bg: 'bg-blue-50'
    },
    {
      title: 'Instant DNS Sync',
      desc: 'CNAME, A, and TXT updates propagate across global resolvers in seconds.',
      icon: <RefreshCw className="w-4 h-4 text-indigo-600" />,
      bg: 'bg-indigo-50'
    },
    {
      title: 'Custom Host Routing',
      desc: 'Point to Vercel, Netlify, GitHub Pages, Render, or custom VPS IPs.',
      icon: <Server className="w-4 h-4 text-purple-600" />,
      bg: 'bg-purple-50'
    },
    {
      title: 'Developer REST API',
      desc: 'Automate subdomain registration and record updates programmatically.',
      icon: <Cpu className="w-4 h-4 text-slate-800" />,
      bg: 'bg-slate-100'
    }
  ];

  return (
    <section id="features" className="w-full max-w-5xl mx-auto px-4">
      <div className="text-center max-w-xl mx-auto mb-6 sm:mb-8">
        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
          Edge Infrastructure
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-2 mb-1">
          Engineered for Speed & Reliability
        </h2>
        <p className="text-xs sm:text-sm text-slate-600">
          Built-in performance and security so your projects stay fast and secure.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {specs.map((s, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all duration-150 text-left"
          >
            <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {s.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
