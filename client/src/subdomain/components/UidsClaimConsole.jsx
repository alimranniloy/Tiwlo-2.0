import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Globe, Server, ExternalLink, X, ShieldAlert } from 'lucide-react';

/**
 * UidsClaimConsole Component
 * In-Page Dedicated Subdomain Claim & DNS Wizard (NO POPUPS / NO MODALS per page-nopopup-role.md)
 * Expands directly in the page flow below the search bar.
 */
export default function UidsClaimConsole({
  subdomain,
  suffix = '.uids.app',
  availability,
  onClose,
  onNavigateAuth
}) {
  const [provider, setProvider] = useState('tiwlo'); // 'tiwlo', 'vercel', 'github', 'custom'
  const [githubUser, setGithubUser] = useState('');
  const [customIp, setCustomIp] = useState('76.76.21.21');
  const [copiedKey, setCopiedKey] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);

  const fullDomain = `${subdomain || 'mybrand'}${suffix}`;
  const isAvailable = availability?.available === true;

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getDnsRecord = () => {
    switch (provider) {
      case 'vercel':
        return { type: 'CNAME', host: subdomain || '@', value: 'cname.vercel-dns.com', ttl: '60s' };
      case 'github':
        return { type: 'CNAME', host: subdomain || '@', value: `${githubUser || 'username'}.github.io`, ttl: '300s' };
      case 'custom':
        return { type: 'A', host: subdomain || '@', value: customIp || '192.0.2.1', ttl: '300s' };
      case 'tiwlo':
      default:
        return { type: 'CNAME', host: subdomain || '@', value: 'edge.uids.app', ttl: 'Auto' };
    }
  };

  const record = getDnsRecord();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mt-8 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-emerald-300/80 shadow-xl shadow-emerald-500/5 p-6 sm:p-8 relative">
        {/* Close / Dismiss */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close claim console"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Availability Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isAvailable ? 'Available to Register' : 'Registration Status'}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{fullDomain}</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Free 20MB static edge hosting included with global SSL certificates.
            </p>
          </div>
        </div>

        {!claimed ? (
          <div className="mt-6 space-y-6">
            {/* Step 1: Select Hosting Target */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                1. Select Where To Route Your Subdomain
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'tiwlo', label: 'Tiwlo 20MB', badge: 'Free Hosting', icon: '⚡' },
                  { id: 'vercel', label: 'Vercel', badge: 'Next / React', icon: '▲' },
                  { id: 'github', label: 'GitHub Pages', badge: 'Git Repos', icon: '🐙' },
                  { id: 'custom', label: 'Custom VPS / IP', badge: 'A Record', icon: '🌐' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-150 ${
                      provider === p.id
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-lg mb-1">{p.icon}</div>
                    <div className="text-sm font-bold text-slate-900">{p.label}</div>
                    <div className="text-[11px] text-slate-500">{p.badge}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Configuration Input */}
            {provider === 'github' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Your GitHub Username / Organization
                </label>
                <input
                  type="text"
                  placeholder="e.g. octocat"
                  value={githubUser}
                  onChange={(e) => setGithubUser(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {provider === 'custom' && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Server IPv4 Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 76.76.21.21"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Step 2: Live DNS Record Table */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                2. Generated DNS Record
              </label>
              <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-3">Host / Name</div>
                  <div className="col-span-5">Value / Target</div>
                  <div className="col-span-2 text-right">TTL</div>
                </div>
                <div className="grid grid-cols-12 gap-2 px-4 py-3.5 text-xs font-mono items-center text-slate-800">
                  <div className="col-span-2 font-bold text-emerald-700">{record.type}</div>
                  <div className="col-span-3 truncate text-slate-700">{record.host}</div>
                  <div className="col-span-5 truncate text-slate-900 font-semibold flex items-center gap-1.5">
                    <span className="truncate">{record.value}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(record.value, 'val')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 shrink-0"
                      title="Copy value"
                    >
                      {copiedKey === 'val' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="col-span-2 text-right text-slate-500">{record.ttl}</div>
                </div>
              </div>
            </div>

            {/* Step 3: Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 text-center sm:text-left">
                No credit card required. Free subdomains renew automatically.
              </div>
              {claimError && <p className="text-xs text-rose-600">{claimError}</p>}
              <button
                type="button"
                disabled={!isAvailable || claiming}
                onClick={async () => {
                  setClaiming(true);
                  setClaimError('');
                  try {
                    const response = await fetch('/api/subdomains/claim', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: subdomain })
                    });
                    const payload = await response.json();
                    if (response.status === 401) {
                      onNavigateAuth?.('login');
                      return;
                    }
                    if (!response.ok) throw new Error(payload.error || 'Registration failed.');
                    setClaimed(true);
                  } catch (error) {
                    setClaimError(error.message);
                  } finally {
                    setClaiming(false);
                  }
                }}
                className="w-full sm:w-auto px-7 py-3 rounded-full bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {claiming ? 'Checking account…' : isAvailable ? `Claim ${fullDomain} Now` : 'Unavailable'}
              </button>
            </div>
          </div>
        ) : (
          /* Success Activation State */
          <div className="mt-6 py-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <h4 className="text-2xl font-extrabold text-slate-900">
              Subdomain Successfully Registered!
            </h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              <strong className="text-slate-900">{fullDomain}</strong> is now configured and broadcasting globally on our Anycast DNS network.
            </p>
            <div className="inline-flex items-center gap-2 p-2 px-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-sm text-slate-800">
              <span>https://{fullDomain}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(`https://${fullDomain}`, 'link')}
                className="p-1 hover:bg-slate-200 rounded text-slate-500"
              >
                {copiedKey === 'link' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setClaimed(false)}
                className="px-5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-full"
              >
                Configure Another Domain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
