import React from 'react';
import { Globe, Plus, ExternalLink, Edit3, Trash2, CheckCircle2, ShieldCheck, Eye } from 'lucide-react';

export default function OneProfileWebsitesView({ onNavigateTab }) {
  const sites = [
    {
      domain: 'john.uids.app',
      title: "John Doe Portfolio",
      status: 'Live',
      template: 'Minimal Clean',
      views: '1,240',
      lastUpdated: '2 hours ago',
      ssl: 'Active',
    },
    {
      domain: 'dev.uids.app',
      title: "Dev Notes & Projects",
      status: 'Live',
      template: 'Creative Portfolio',
      views: '412',
      lastUpdated: '3 days ago',
      ssl: 'Active',
    }
  ];

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">My Websites</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage and edit your active digital websites and portfolios.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab('templates')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Site</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sites.map((site, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-xs transition">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{site.status}</span>
              </div>
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Visit</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <h3 className="text-lg font-extrabold text-slate-900">{site.title}</h3>
            <div className="text-xs font-mono font-semibold text-slate-500 mb-4">{site.domain}</div>

            <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-slate-50 rounded-xl text-xs mb-4">
              <div>
                <div className="text-[10px] text-slate-400">Template</div>
                <div className="font-bold text-slate-800 truncate">{site.template}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Views</div>
                <div className="font-bold text-slate-800">{site.views}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">SSL Status</div>
                <div className="font-bold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{site.ssl}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Content</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('templates')}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition"
              >
                Template
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
