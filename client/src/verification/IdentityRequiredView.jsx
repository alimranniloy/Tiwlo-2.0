import React from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  const accountInitial = user?.name?.trim()?.[0] || user?.email?.trim()?.[0] || 'T';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 text-[#212121] sm:px-6">
      <section className="w-full max-w-[560px] rounded-[28px] bg-white px-6 py-8 shadow-[0_1px_3px_rgba(60,64,67,0.12)] sm:px-10 sm:py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <img src="/tiwlo-brand-mark.png" alt="Tiwlo" className="h-7 w-7 object-contain object-left" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FCE8E6] px-3 py-1.5 text-xs font-medium text-[#B3261E]">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Account locked
          </span>
        </header>

        <div className="mb-8 flex w-fit max-w-full items-center gap-2.5 rounded-full border border-[#dcdcdc] py-1 pl-1 pr-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#efefef] text-xs font-medium uppercase text-[#494949]">
            {accountInitial}
          </span>
          <p className="truncate text-sm text-[#3f3f3f]">{user?.email}</p>
        </div>

        <h1 className="mt-2 text-[28px] font-normal leading-[1.25] tracking-[-0.025em] text-[#212121] sm:text-[32px]">
          Verify it’s you
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#636363]">
          Your account is temporarily locked. Verify your identity to restore access to your Tiwlo account.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#636363]">
          Continue on this device or scan the QR code with your phone. You don’t need to sign in again on your phone.
        </p>

        <div className="mt-8 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-10 rounded-full px-4 text-sm font-medium text-[#696969] transition hover:bg-[#F1F3F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e1e1e1]"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onStartVerification}
            className="min-h-10 rounded-full bg-[#696969] px-6 text-sm font-medium text-white transition hover:bg-[#5c5c5c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e1e1e1]"
          >
            Verify identity
          </button>
        </div>

        <div className="mt-8 border-t border-[#eaeaea] pt-5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#636363]" aria-hidden="true" />
            <p className="text-xs leading-5 text-[#636363]">
              Access returns automatically after a successful face-match and liveness check. The check compares your face with the document portrait; it does not authenticate the document itself.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
