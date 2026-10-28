import React from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-5 py-10 text-[#202124]">
      <div className="w-full max-w-[560px]">
        <header className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#5f6368]">Tiwlo Account</p>
            <p className="text-xs text-[#80868b]">{user?.email}</p>
          </div>
        </header>

        <section className="rounded-[28px] bg-white px-6 py-8 shadow-[0_1px_3px_rgba(60,64,67,0.12)] sm:px-10 sm:py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fce8e6] text-[#b3261e]">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.08em] text-[#b3261e]">
            Account locked
          </p>
          <h1 className="mt-2 text-[28px] font-normal leading-tight tracking-[-0.02em] text-[#202124] sm:text-[32px]">
            Verify your identity to unlock your account
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#5f6368]">
            Your account access is temporarily restricted until you complete a secure identity check. Scan the QR code with your phone or continue directly on mobile.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onStartVerification}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1a73e8] px-6 text-sm font-medium text-white transition hover:bg-[#1765cc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d2e3fc]"
            >
              Verify identity
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-11 rounded-full px-5 text-sm font-medium text-[#1a73e8] transition hover:bg-[#f1f3f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d2e3fc]"
            >
              Sign out
            </button>
          </div>

          <div className="mt-8 border-t border-[#e8eaed] pt-5">
            <div className="flex items-start gap-3 text-xs leading-5 text-[#5f6368]">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>Your account will unlock automatically after a successful face-match and liveness check. Your identity document itself is not authenticated by this check.</p>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-xs text-[#80868b]">
          Need help? Contact Tiwlo Support.
        </p>
      </div>
    </main>
  );
}
