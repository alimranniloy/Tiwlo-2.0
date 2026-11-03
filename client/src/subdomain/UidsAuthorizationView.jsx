import React from 'react';
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react';

export default function UidsAuthorizationView({ user, loading, onAuthorize, onSignIn, onCancel }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-4 py-8 text-[#212121]">
      <section className="w-full max-w-[460px] rounded-[28px] border border-[#dcdcdc] bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <div className="mb-8 text-center">
          <div className="text-xl font-bold tracking-tight text-neutral-900">
            uids<span className="text-[#00a854]">.app</span>
          </div>
          <h1 className="mt-7 text-[26px] font-normal leading-tight tracking-[-0.02em]">
            Connect your Tiwlo account
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#636363]">
            Use your Tiwlo account to continue to UIDS. Your account stays managed by Tiwlo.
          </p>
        </div>

        {loading ? (
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-neutral-600" aria-label="Loading account" />
        ) : user ? (
          <>
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#dcdcdc] p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efefef] text-sm font-medium uppercase text-[#494949]">
                {user.avatar
                  ? <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  : (user.name?.trim()?.[0] || user.email?.trim()?.[0] || 'T')}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#212121]">{user.name || 'Tiwlo account'}</p>
                <p className="truncate text-xs text-[#636363]">{user.email}</p>
              </div>
              <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[#188038]" aria-hidden="true" />
            </div>

            <div className="mb-7 rounded-2xl bg-[#f8f9fa] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#636363]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-[#212121]">What happens next</p>
                  <p className="mt-1 text-xs leading-5 text-[#636363]">
                    UIDS uses your Tiwlo account to prepare your domain dashboard. If your account needs identity verification, Tiwlo will ask you to complete it before access is restored.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onAuthorize}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#696969] px-6 text-sm font-medium text-white transition hover:bg-[#5c5c5c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e1e1e1]"
            >
              Authorize and continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 min-h-10 w-full rounded-full px-4 text-sm font-medium text-[#696969] transition hover:bg-[#f1f3f4]"
            >
              Not now
            </button>
          </>
        ) : (
          <>
            <p className="mb-5 text-center text-sm text-[#636363]">Sign in to your Tiwlo account to authorize UIDS.</p>
            <button
              type="button"
              onClick={onSignIn}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#696969] px-6 text-sm font-medium text-white transition hover:bg-[#5c5c5c]"
            >
              Sign in to Tiwlo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="mt-3 min-h-10 w-full rounded-full px-4 text-sm font-medium text-[#696969] transition hover:bg-[#f1f3f4]"
            >
              Not now
            </button>
          </>
        )}
      </section>
    </main>
  );
}
