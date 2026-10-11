import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, LoaderCircle } from 'lucide-react';
import { FREE_SUBDOMAIN_DOMAIN } from '../../config/platformConfig';

export default function OneProfileSubdomainsView({ domains = [], onDomainClaimed }) {
  const [newSubdomain, setNewSubdomain] = useState('');
  const [availability, setAvailability] = useState(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    const name = newSubdomain.trim();
    if (!name) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      setError('');
      try {
        const response = await fetch(`/api/subdomains/check?name=${encodeURIComponent(name)}`, {
          credentials: 'include',
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not check subdomain availability.');
        setAvailability(data);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setAvailability(null);
          setError(requestError.message || 'Could not check subdomain availability.');
        }
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [newSubdomain]);

  const claimDomain = async (event) => {
    event.preventDefault();
    if (!availability?.available || availability.name !== newSubdomain.trim().toLowerCase() || claiming) return;
    setClaiming(true);
    setError('');
    try {
      const response = await fetch('/api/subdomains/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: availability.name })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not claim this subdomain.');
      if (!data.registration?.id || !data.registration?.domain) {
        throw new Error('The server did not return the claimed subdomain.');
      }
      onDomainClaimed?.(data.registration);
      setNewSubdomain('');
      setAvailability(null);
    } catch (requestError) {
      setError(requestError.message || 'Could not claim this subdomain.');
    } finally {
      setClaiming(false);
    }
  };

  const handleSubdomainChange = (event) => {
    setNewSubdomain(event.target.value.toLowerCase());
    setAvailability(null);
    setChecking(false);
    setError('');
  };

  const copyDomain = async (domain, key) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (copyError) {
      setError(`Could not copy domain: ${copyError.message}`);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 text-left">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Subdomain Management</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Check and claim your free .{FREE_SUBDOMAIN_DOMAIN} subdomain.
        </p>
      </div>

      <form onSubmit={claimDomain} className="bg-white rounded-2xl border border-blue-200/90 p-5 sm:p-6 shadow-2xs">
        <h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <span>Register New Subdomain</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Your account can claim one free subdomain. Your email must be verified before claiming.
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-3">
          <div className="flex-1 w-full">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <input
                type="text"
                autoComplete="off"
                maxLength={63}
                pattern="[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
                title="Use 1-63 letters, numbers, or hyphens; do not start or end with a hyphen."
                placeholder="your-name"
                value={newSubdomain}
                onChange={handleSubdomainChange}
                className="bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none w-full"
                aria-label="Subdomain name"
              />
              <span className="text-xs font-bold text-slate-400 pl-2 shrink-0">.{FREE_SUBDOMAIN_DOMAIN}</span>
            </div>
            {checking && <p className="mt-2 text-xs text-slate-500">Checking availability…</p>}
            {!checking && availability && (
              <p className={`mt-2 text-xs font-semibold ${availability.available ? 'text-emerald-700' : 'text-rose-700'}`}>
                {availability.available ? `${availability.domain} is available.` : `${availability.domain} is ${availability.status}.`}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!availability?.available || availability.name !== newSubdomain.trim().toLowerCase() || claiming || checking}
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition"
          >
            {claiming && <LoaderCircle className="w-4 h-4 animate-spin" />}
            <span>{claiming ? 'Claiming…' : 'Claim Subdomain'}</span>
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
      </form>

      <section className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">Your Active Subdomains</h3>
          <span className="text-xs font-semibold text-slate-500">{domains.length} connected</span>
        </div>

        <div className="divide-y divide-slate-100">
          {domains.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No .{FREE_SUBDOMAIN_DOMAIN} domain has been claimed yet.</div>
          ) : domains.map((sub) => (
            <div key={sub.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-extrabold text-slate-900 text-sm font-mono break-all">{sub.domain}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    {sub.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700">Nameservers</span>
                  <span>→</span>
                  <span className="font-mono text-slate-600">{(sub.nameservers || []).join(', ') || 'Managed by Tiwlo'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => copyDomain(sub.domain, sub.id)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-semibold text-slate-700 flex items-center gap-1 transition"
                >
                  {copiedKey === sub.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copiedKey === sub.id ? 'Copied' : 'Copy'}</span>
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
      </section>
    </div>
  );
}
