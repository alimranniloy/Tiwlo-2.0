import React, { useState } from 'react';
import { Globe, Plus, Copy, Check, ExternalLink, ShieldCheck, Server, RefreshCw } from 'lucide-react';

export default function OneProfileSubdomainsView() {
  const [newSubdomain, setNewSubdomain] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('tiwlo');
  const [copiedKey, setCopiedKey] = useState(null);

  const subdomains = [
    {
      domain: 'john.uidis.app',
      target: 'edge.uidis.app (20MB Static)',
      type: 'CNAME',
      status: 'Active',
      ssl: 'Valid',
      created: 'Oct 02, 2026',
    },
    {
      domain: 'dev.uidis.app',
      target: 'cname.vercel-dns.com',
      type: 'CNAME',
      status: 'Active',
      ssl: 'Valid',
      created: 'Oct 08, 2026',
    }
  ];

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Subdomain Management</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Claim, route, and manage DNS records for your .uidis.app subdomains.</p>
      </div>

      {/* In-Page Create Subdomain Console (No popup/modal) */}
      <div className="bg-white rounded-2xl border border-blue-200/90 p-5 sm:p-6 shadow-2xs">
        <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>Register New Subdomain</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">Instant Anycast propagation with automated free SSL certificate.</p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full">
            <input
              type="text"
              placeholder="your-name"
              value={newSubdomain}
              onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none w-full"
            />
            <span className="text-xs font-bold text-slate-400 pl-2 shrink-0">.uidis.app</span>
          </div>

          <button
            type="button"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
          >
            Claim & Connect
          </button>
        </div>
      </div>

      {/* Active Subdomains Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">Your Active Subdomains</h3>
          <span className="text-xs font-semibold text-slate-500">{subdomains.length} connected</span>
        </div>

        <div className="divide-y divide-slate-100">
          {subdomains.map((sub, i) => (
            <div key={i} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-extrabold text-slate-900 text-sm font-mono">{sub.domain}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    {sub.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="font-semibold text-slate-700">{sub.type}</span>
                  <span>→</span>
                  <span className="font-mono text-slate-600 truncate">{sub.target}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(sub.domain, i)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-semibold text-slate-700 flex items-center gap-1 transition"
                >
                  {copiedKey === i ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedKey === i ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={`https://${sub.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 transition"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
