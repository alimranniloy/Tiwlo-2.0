import React from 'react';

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 text-[#202124] sm:px-6">
      <section className="w-full max-w-[560px] rounded-[28px] bg-white px-6 py-8 shadow-[0_1px_3px_rgba(60,64,67,0.12)] sm:px-10 sm:py-10">
        <header className="mb-9">
          <p className="text-[15px] font-medium tracking-[-0.01em] text-[#5F6368]">Tiwlo Account</p>
        </header>

        <div className="mb-7 border-b border-[#DADCE0] pb-6">
          <p className="truncate text-sm text-[#5F6368]">{user?.email}</p>
        </div>

        <p className="text-sm font-medium text-[#5F6368]">Account access</p>
        <h1 className="mt-2 text-[28px] font-normal leading-[1.25] tracking-[-0.025em] text-[#202124] sm:text-[32px]">
          Verify it’s you
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#5F6368]">
          Your account is temporarily locked. Verify your identity to restore access to your Tiwlo account.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#5F6368]">
          Continue on this device or scan the QR code with your phone. You don’t need to sign in again on your phone.
        </p>

        <div className="mt-8 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-10 rounded-full px-4 text-sm font-medium text-[#1A73E8] transition hover:bg-[#F1F3F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D2E3FC]"
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={onStartVerification}
            className="min-h-10 rounded-full bg-[#1A73E8] px-6 text-sm font-medium text-white transition hover:bg-[#1765CC] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D2E3FC]"
          >
            Verify identity
          </button>
        </div>

        <div className="mt-8 border-t border-[#E8EAED] pt-5">
          <p className="text-xs leading-5 text-[#5F6368]">
            Access returns automatically after a successful face-match and liveness check. The check compares your face with the document portrait; it does not authenticate the document itself.
          </p>
        </div>
      </section>
    </main>
  );
}
