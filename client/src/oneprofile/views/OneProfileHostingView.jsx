import React from 'react';
import { Cloud, Server, Database, ShieldCheck, Zap, HardDrive, Check, ArrowRight } from 'lucide-react';

export default function OneProfileHostingView() {
  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Cloud Edge Hosting</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">High-performance static hosting and Node.js serverless execution on Anycast edge.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Storage Metric */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-500 mb-1">Storage Usage</div>
          <div className="text-xl font-extrabold text-slate-900 mb-2">48 MB / 200 MB</div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-600 rounded-full" style={{ width: '24%' }} />
          </div>
        </div>

        {/* Bandwidth Metric */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Zap className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-500 mb-1">Monthly Edge Bandwidth</div>
          <div className="text-xl font-extrabold text-slate-900 mb-2">1.8 GB / 10 GB</div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: '18%' }} />
          </div>
        </div>

        {/* Global Latency */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs font-semibold text-slate-500 mb-1">Edge Availability</div>
          <div className="text-xl font-extrabold text-emerald-600 mb-2">99.99%</div>
          <div className="text-[11px] text-slate-500">200+ Global Anycast POPs active</div>
        </div>
      </div>

      {/* Hosting Configuration & Plan Upgrades */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">CURRENT PLAN: FREE 200MB</span>
            <h3 className="text-lg font-extrabold text-slate-900 mt-1">Upgrade to Pro for Full Node.js Backend</h3>
            <p className="text-xs text-slate-500 mt-0.5">Run dynamic serverless APIs, persistent databases, and custom container images.</p>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
          >
            Upgrade to Pro
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Automatic HTTP/3 and TLS 1.3 certificates</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Integrated Layer-7 DDoS mitigation</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Git push to deploy & instant rollbacks</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Custom headers and redirect rule engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
