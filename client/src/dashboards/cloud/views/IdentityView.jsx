import React from 'react';
import {
  ArrowRight,
  Check,
  Fingerprint,
  IdCard,
  ScanFace,
  ShieldCheck
} from 'lucide-react';

function IdentityIllustration() {
  return (
    <div className="relative mx-auto flex h-48 w-56 items-center justify-center sm:h-56 sm:w-64" aria-hidden="true">
      <div className="absolute h-40 w-40 rounded-full bg-[#D3E3FD] sm:h-48 sm:w-48" />
      <div className="absolute left-5 top-6 h-8 w-8 rounded-full bg-[#AECBFA] sm:left-4 sm:top-8 sm:h-10 sm:w-10" />
      <div className="absolute bottom-7 right-5 h-5 w-5 rounded-full bg-[#8AB4F8] sm:bottom-8 sm:right-6 sm:h-6 sm:w-6" />
      <div className="absolute right-8 top-8 h-2.5 w-2.5 rounded-full bg-[#4285F4] sm:right-10 sm:top-10" />
      <div className="absolute bottom-10 left-8 h-2 w-2 rounded-full bg-[#669DF6] sm:bottom-12 sm:left-9" />

      <div className="absolute left-3 top-14 w-32 -rotate-6 rounded-xl border border-[#DADCE0] bg-white p-3 shadow-[0_3px_8px_rgba(60,64,67,0.12)] sm:left-4 sm:top-16 sm:w-36">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-10 items-center justify-center rounded-lg bg-[#E8F0FE] text-[#4285F4]">
            <ScanFace className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-1.5 w-12 rounded-full bg-[#DADCE0]" />
            <div className="h-1.5 w-9 rounded-full bg-[#E8EAED]" />
            <div className="h-1.5 w-11 rounded-full bg-[#E8EAED]" />
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-12 flex h-16 w-16 items-center justify-center rounded-2xl border border-white bg-[#1A73E8] text-white shadow-[0_6px_16px_rgba(26,115,232,0.28)] sm:right-5 sm:top-14 sm:h-[72px] sm:w-[72px]">
        <Fingerprint className="h-9 w-9 sm:h-10 sm:w-10" strokeWidth={1.6} />
      </div>

      <div className="absolute bottom-4 right-5 flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#E8F0FE] bg-[#34A853] text-white shadow-sm sm:bottom-5 sm:right-7 sm:h-14 sm:w-14">
        <Check className="h-6 w-6" strokeWidth={3} />
      </div>
    </div>
  );
}

function CheckStep({ icon: Icon, number, title, description, last = false }) {
  return (
    <div className="relative flex gap-4">
      {!last && <div className="absolute left-[19px] top-10 h-[calc(100%-12px)] w-px bg-[#DADCE0]" />}
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-[#1967D2]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5F6368]">
          Step {number}
        </p>
        <h3 className="mt-1 text-sm font-medium text-[#202124]">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#5F6368]">{description}</p>
      </div>
    </div>
  );
}

export default function IdentityView({ onStartVerification }) {
  return (
    <main className="min-h-full bg-[#F8F9FA] px-4 py-6 sm:px-7 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-medium text-[#5F6368]">Account</p>
          <h1 className="mt-1 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
            Identity
          </h1>
        </header>

        <section className="overflow-hidden rounded-2xl border border-[#DADCE0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.12)]">
          <div className="grid items-center lg:grid-cols-[1.05fr_0.95fr]">
            <div className="order-2 px-5 pb-6 sm:px-9 sm:pb-9 lg:order-1 lg:py-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F1F3F4] px-3 py-1.5 text-xs font-medium text-[#5F6368]">
                <span className="h-2 w-2 rounded-full bg-[#9AA0A6]" />
                Not verified
              </div>

              <h2 className="mt-5 max-w-md text-[26px] font-normal leading-tight tracking-[-0.02em] text-[#202124] sm:text-[32px]">
                Verify it’s really you
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#5F6368] sm:text-base">
                Match your selfie with your ID photo using a quick face and live camera check.
              </p>

              <button
                type="button"
                onClick={onStartVerification}
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1A73E8] px-6 text-sm font-medium text-white shadow-[0_1px_2px_rgba(60,64,67,0.3)] transition hover:bg-[#1765CC] hover:shadow-[0_2px_5px_rgba(60,64,67,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D2E3FC] active:bg-[#185ABC]"
              >
                Start verification
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="order-1 flex min-h-56 items-center justify-center overflow-hidden bg-[#F1F6FE] px-4 pt-5 sm:min-h-72 lg:order-2 lg:min-h-[350px]">
              <IdentityIllustration />
            </div>
          </div>

          <div className="grid border-t border-[#E8EAED] bg-white sm:grid-cols-2">
            <div className="flex items-center gap-3 px-5 py-4 sm:px-7">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E6F4EA] text-[#188038]">
                <ScanFace className="h-[18px] w-[18px]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#202124]">Selfie face match</p>
                <p className="mt-0.5 text-xs text-[#5F6368]">Selfie compared with ID photo</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-[#E8EAED] px-5 py-4 sm:border-l sm:border-t-0 sm:px-7">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-[#1967D2]">
                <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-[#202124]">Live camera check</p>
                <p className="mt-0.5 text-xs text-[#5F6368]">Follow a few on-screen actions</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#DADCE0] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:px-7 sm:py-6">
          <div className="mb-5">
            <h2 className="text-base font-medium text-[#202124]">How it works</h2>
            <p className="mt-1 text-sm text-[#5F6368]">A short guided check, completed on your phone.</p>
          </div>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <CheckStep
              icon={IdCard}
              number="1"
              title="Add your ID photo"
              description="Upload a clear image of your identity document."
            />
            <CheckStep
              icon={ScanFace}
              number="2"
              title="Take a live selfie"
              description="Follow the camera prompts so we can compare the faces."
              last
            />
          </div>
          <p className="border-t border-[#E8EAED] pt-4 text-xs leading-5 text-[#5F6368]">
            This check compares faces and checks liveness; it does not confirm that an ID is genuine.
          </p>
        </section>
      </div>
    </main>
  );
}
