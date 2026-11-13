import React, { useState } from 'react';
import { CheckCircle2, X, ArrowRight } from 'lucide-react';
import { getAuthUrl, getUidsDashboardUrl } from '../../utils/navigation';

export default function UidsClaimConsole({
  currentUser,
  subdomain,
  suffix = '.uids.app',
  availability,
  onClose,
  onNavigateAuth
}) {
  const [claimError, setClaimError] = useState('');
  const fullDomain = `${subdomain || 'mybrand'}${suffix}`;
  const isAvailable = availability?.available === true;

  const goToAuth = (mode) => {
    const returnPath = `/oneprofile/subdomains?domain_claim=${encodeURIComponent(subdomain || '')}`;
    if (currentUser) {
      window.location.assign(returnPath);
      return;
    }
    if (onNavigateAuth) {
      onNavigateAuth(mode, returnPath);
      return;
    }
    const returnTo = getUidsDashboardUrl(returnPath);
    const params = new URLSearchParams({ return_to: returnTo, sso_login: '1' });
    window.location.replace(getAuthUrl(`/${mode === 'signup' ? 'create-account' : 'login'}?${params}`));
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-6 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="relative rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-200/40 sm:p-8">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-full p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
        <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          <CheckCircle2 className="h-4 w-4" />
          {isAvailable ? 'Available to register' : 'Not available'}
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight text-neutral-900">{fullDomain}</h3>
        <p className="mt-2 text-sm text-neutral-500">
          Free, renewable uids.app subdomain with instant DNS records and website hosting managed from your Workspace.
        </p>
        {claimError && <p className="mt-4 text-sm text-rose-600">{claimError}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {currentUser ? (
            <button
              type="button"
              disabled={!isAvailable}
              onClick={() => {
                setClaimError('');
                if (!isAvailable) return;
                goToAuth('claim');
              }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Claim {fullDomain} in Workspace <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => {
                  setClaimError('');
                  if (!isAvailable) return;
                  goToAuth('login');
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Login to claim <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => goToAuth('signup')}
                className="flex-1 rounded-full border border-neutral-200 px-5 py-3 text-sm font-bold text-neutral-700 hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
