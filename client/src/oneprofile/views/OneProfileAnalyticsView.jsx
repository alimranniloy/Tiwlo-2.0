import React from 'react';
import { Eye, TrendingUp, Globe, Users, ArrowUpRight, Clock } from 'lucide-react';

export default function OneProfileAnalyticsView({ summary }) {
  const metrics = summary?.metrics || {};
  const stats = [
    { label: 'Total Profile Views', val: Number(metrics.views || 0).toLocaleString() },
    { label: 'Active Websites', val: Number(metrics.websites || 0).toLocaleString() },
    { label: 'Claimed Domains', val: Number(metrics.domains || 0).toLocaleString() },
    { label: 'Unread Notifications', val: Number(metrics.unread_notifications || 0).toLocaleString() },
  ];

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Analytics & Telemetry</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Live traffic telemetry from your UIDs websites and NFC contactless taps.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
            <div className="text-xs font-semibold text-slate-500 mb-1">{s.label}</div>
            <div className="text-2xl font-extrabold text-slate-900">{s.val}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs">
        <h3 className="text-base font-extrabold text-slate-900 mb-2">Traffic Acquisition Sources</h3>
        <p className="text-sm text-slate-500">Detailed referral telemetry will appear after analytics collection is enabled.</p>
      </div>
    </div>
  );
}
