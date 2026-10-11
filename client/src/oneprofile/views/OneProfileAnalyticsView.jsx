import React from 'react';
import { Eye, TrendingUp, Globe, Users, ArrowUpRight, Clock } from 'lucide-react';

export default function OneProfileAnalyticsView() {
  const stats = [
    { label: 'Total Profile Views', val: '1,240', change: '+12.4%', up: true },
    { label: 'Unique Visitors', val: '890', change: '+8.1%', up: true },
    { label: 'Avg. Tap / Interaction', val: '42s', change: '+15.2%', up: true },
    { label: 'NFC Contact Downloads', val: '142', change: '+24.0%', up: true },
  ];

  const topReferrers = [
    { source: 'NFC Physical Card Tap', count: '460', pct: '37%' },
    { source: 'Direct / QR Code', count: '380', pct: '31%' },
    { source: 'X / Twitter Bio', count: '240', pct: '19%' },
    { source: 'GitHub Profile', count: '160', pct: '13%' },
  ];

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Analytics & Telemetry</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Live traffic telemetry from your UIDis websites and NFC contactless taps.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500 mb-1">{s.label}</div>
            <div className="text-2xl font-extrabold text-slate-900">{s.val}</div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 mt-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>{s.change} vs last month</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
        <h3 className="text-base font-extrabold text-slate-900 mb-4">Traffic Acquisition Sources</h3>
        <div className="space-y-3">
          {topReferrers.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">{r.source}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-mono">{r.count} hits</span>
                <span className="w-12 text-right font-bold text-slate-900">{r.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
