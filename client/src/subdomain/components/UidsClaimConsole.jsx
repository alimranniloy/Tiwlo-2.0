import React, { useState } from 'react';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';
import { getAuthUrl } from '../../utils/navigation';

export default function UidsClaimConsole({
  subdomain,
  suffix = '.uids.app',
  availability,
  onClose
}) {
  const [claimError, setClaimError] = useState('');
  const fullDomain = `${subdomain || 'mybrand'}${suffix}`;
  const isAvailable = availability?.available === true;

  const goToAuth = (mode) => {
    const redirect = `/dashboard?domain_claim=${encodeURIComponent(subdomain || '')}`;
    window.location.replace(getAuthUrl(`/${mode === 'signup' ? 'create-account' : 'login'}?redirect=${encodeURIComponent(redirect)}`));
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          <CheckCircle2 className="h-4 w-4" />
          {isAvailable ? 'Available to register' : 'Not available'}
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">{fullDomain}</h3>
        <p className="mt-2 text-sm text-slate-500">
          Free, renewable Tiwlo subdomain with DNS records managed from your dashboard.
        </p>
        {claimError && <p className="mt-4 text-sm text-rose-600">{claimError}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!isAvailable}
            onClick={() => {
              setClaimError('');
              if (!isAvailable) return;
              goToAuth('login');
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Login to claim <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!isAvailable}
            onClick={() => goToAuth('signup')}
            className="flex-1 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}
