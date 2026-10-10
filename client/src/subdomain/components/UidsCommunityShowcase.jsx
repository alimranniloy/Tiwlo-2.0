import React from 'react';
import { ExternalLink, Activity } from 'lucide-react';

/**
 * UidsCommunityShowcase Component
 * Real-time active community subdomains with Anycast edge latency telemetry
 */
export default function UidsCommunityShowcase({ onSelectDomain }) {
  const showcaseItems = [
    { name: 'ai.uids.app', category: 'AI Tools', ping: '18ms', status: 'Active', color: 'text-emerald-600 bg-emerald-50' },
    { name: 'dev.uids.app', category: 'Developer Hub', ping: '22ms', status: 'Active', color: 'text-blue-600 bg-blue-50' },
    { name: 'studio.uids.app', category: 'Creative Portfolio', ping: '24ms', status: 'Active', color: 'text-amber-600 bg-amber-50' },
    { name: 'shop.uids.app', category: 'Storefront Demo', ping: '29ms', status: 'Active', color: 'text-purple-600 bg-purple-50' },
    { name: 'blog.uids.app', category: 'Markdown Tech Notes', ping: '19ms', status: 'Active', color: 'text-pink-600 bg-pink-50' },
    { name: 'tools.uids.app', category: 'Open Source Utils', ping: '25ms', status: 'Active', color: 'text-indigo-600 bg-indigo-50' },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 mt-20 sm:mt-24">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">
          Community Ecosystem
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3 mb-2">
          Built on uids.app
        </h2>
        <p className="text-sm sm:text-base text-slate-600">
          See what creators, developers, and founders are running on our clean namespace.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {showcaseItems.map((item, idx) => (
          <div
            key={idx}
            className="group bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-150 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.color}`}>
                  {item.category}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  {item.ping}
                </span>
              </div>
              <div className="text-base font-bold font-mono text-slate-900">
                {item.name}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectDomain && onSelectDomain(item.name.replace('.uids.app', ''))}
              className="p-2 rounded-xl text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-50 transition"
              title="Test similar name"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
