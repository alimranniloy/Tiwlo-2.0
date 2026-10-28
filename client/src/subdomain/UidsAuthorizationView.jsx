import React from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';

export default function UidsAuthorizationView({ user, loading, onAuthorize, onSignIn, onCancel }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-8 text-[#202124]">
      <section className="w-full max-w-[460px] rounded-[28px] border border-[#dadce0] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 text-center">
          <div className="text-xl font-bold tracking-tight text-slate-900">
            uids<span className="text-[#00a854]">.app</span>
          </div>
          <h1 className="mt-7 text-[26px] font-normal leading-tight tracking-[-0.02em]">
            Connect your Tiwlo account
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5f6368]">
            Use your Tiwlo account to continue to UIDS. Your account stays managed by Tiwlo.
          </p>
        </div>

        {loading ? (
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-blue-600" aria-label="Loading account" />
        ) : user ? (
          <>
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#dadce0] p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0fe] text-sm font-medium uppercase text-[#174ea6]">
                {user.avatar
                  ? <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  : (user.name?.trim()?.[0] || user.email?.trim()?.[0] || 'T')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#202124]">{user.name || 'Tiwlo account'}</p>
                <p className="truncate text-xs text-[#5f6368]">{user.email}</p>
              </div>
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[#188038]" aria-hidden="true" />
            </div>

            <div className="mb-7 rounded-2xl bg-[#f8f9fa] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5f6368]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-[#202124]">What happens next</p>
                  <p className="mt-1 text-xs leading-5 text-[#5f6368]">
                    UIDS uses your Tiwlo account to prepare your domain dashboard. If your account needs identity verification, Tiwlo will ask you to complete it before access is restored.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onAuthorize}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white transition hover:bg-[#1765cc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d2e3fc]"
            >
              Authorize and continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 min-h-10 w-full rounded-full px-4 text-sm font-medium text-[#1a73e8] transition hover:bg-[#f1f3f4]"
            >
              Not now
            </button>
          </>
        ) : (
          <>
            <p className="mb-5 text-center text-sm text-[#5f6368]">Sign in to your Tiwlo account to authorize UIDS.</p>
            <button
              type="button"
              onClick={onSignIn}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white transition hover:bg-[#1765cc]"
            >
              Sign in to Tiwlo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 min-h-10 w-full rounded-full px-4 text-sm font-medium text-[#1a73e8] transition hover:bg-[#f1f3f4]"
            >
              Not now
            </button>
          </>
        )}
      </section>
    </main>
  );
}
