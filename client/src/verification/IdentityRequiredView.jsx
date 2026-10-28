import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  Smartphone
} from 'lucide-react';

const verificationSteps = [
  { icon: Smartphone, label: 'Open the secure check on your phone' },
  { icon: ScanFace, label: 'Share your ID and complete a live selfie check' },
  { icon: Check, label: 'Get account access back automatically' }
];

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  const accountInitial = user?.name?.trim()?.[0] || user?.email?.trim()?.[0] || 'T';

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8FAFD] text-[#202124]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-48 h-[440px] w-[440px] rounded-full bg-[#E8F0FE]/70 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 -left-40 h-[480px] w-[480px] rounded-full bg-[#E6F4EA]/55 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1120px] items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0FE] text-[#1A73E8]">
            <ShieldCheck className="h-[21px] w-[21px]" strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-[#202124]">Tiwlo</p>
            <p className="text-xs text-[#5F6368]">Account security</p>
          </div>
        </div>
        <a
          href="mailto:support@tiwlo.com"
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-[#5F6368] transition hover:bg-white hover:text-[#202124] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D2E3FC]"
        >
          <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="hidden sm:inline">Help</span>
        </a>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-1 items-center px-4 pb-8 sm:px-8 sm:pb-12">
        <div className="grid w-full overflow-hidden rounded-[32px] bg-white shadow-[0_8px_32px_rgba(60,64,67,0.10)] ring-1 ring-[#DADCE0]/70 lg:min-h-[590px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 rounded-full bg-[#F8F9FA] py-1.5 pl-1.5 pr-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D3E3FD] text-sm font-semibold uppercase text-[#174EA6]">
                  {accountInitial}
                </div>
                <div className="min-w-0">
                  <p className="max-w-[240px] truncate text-xs font-medium text-[#202124]">
                    {user?.name || 'Your Tiwlo account'}
                  </p>
                  <p className="max-w-[240px] truncate text-xs text-[#5F6368]">{user?.email}</p>
                </div>
                <ChevronRight className="ml-1 h-4 w-4 shrink-0 text-[#80868B]" aria-hidden="true" />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF7E0] px-3 py-1.5 text-xs font-medium text-[#8A5A00]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F9AB00]" />
                Action required
              </span>
            </div>

            <div className="mt-10 sm:mt-14">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[17px] bg-[#FCE8E6] text-[#B3261E]">
                <LockKeyhole className="h-[23px] w-[23px]" strokeWidth={1.9} aria-hidden="true" />
              </div>
              <h1 className="max-w-[560px] text-[34px] font-normal leading-[1.13] tracking-[-0.045em] text-[#202124] sm:text-[42px]">
                Let’s get your account back
              </h1>
              <p className="mt-4 max-w-[490px] text-[15px] leading-7 text-[#5F6368]">
                Your account is temporarily locked. Complete a quick identity check to securely restore access.
              </p>

              <button
                type="button"
                onClick={onStartVerification}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#0B57D0] px-7 text-sm font-medium text-white shadow-[0_1px_2px_rgba(60,64,67,0.25)] transition hover:bg-[#0842A0] hover:shadow-[0_2px_6px_rgba(60,64,67,0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D2E3FC] active:scale-[0.99]"
              >
                Verify your identity
                <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="ml-2 min-h-12 rounded-full px-5 text-sm font-medium text-[#0B57D0] transition hover:bg-[#F1F3F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D2E3FC]"
              >
                Sign out
              </button>
            </div>

            <div className="mt-10 border-t border-[#E8EAED] pt-6 sm:mt-12">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-[#5F6368]">
                What happens next
              </p>
              <ol className="space-y-3">
                {verificationSteps.map(({ icon: Icon, label }, index) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1F3F4] text-[#5F6368]">
                      {index === 2
                        ? <Check className="h-4 w-4 text-[#137333]" aria-hidden="true" />
                        : <Icon className="h-4 w-4" aria-hidden="true" />}
                    </span>
                    <span className="text-[13px] leading-5 text-[#3C4043]">{label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <aside className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden bg-[#F1F6FE] px-7 py-10 sm:min-h-[380px] lg:min-h-full lg:px-10">
            <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-[#D2E3FC]" />
            <div aria-hidden="true" className="absolute -bottom-36 -left-24 h-80 w-80 rounded-full border border-[#D2E3FC]" />
            <div aria-hidden="true" className="absolute right-10 top-12 h-2 w-2 rounded-full bg-[#AECBFA]" />
            <div aria-hidden="true" className="absolute bottom-24 right-16 h-3 w-3 rounded-full bg-[#C2E7FF]" />

            <div className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60">
              <div className="absolute inset-0 rounded-full bg-white/70 shadow-[0_8px_32px_rgba(66,133,244,0.10)]" />
              <div className="absolute inset-5 rounded-full border border-[#D2E3FC]" />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-[38px] bg-gradient-to-br from-[#4285F4] to-[#0B57D0] text-white shadow-[0_12px_28px_rgba(26,115,232,0.30)] sm:h-36 sm:w-36">
                <Fingerprint className="h-[68px] w-[68px]" strokeWidth={1.25} aria-hidden="true" />
                <span className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#137333] shadow-[0_3px_12px_rgba(60,64,67,0.16)]">
                  <BadgeCheck className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
                </span>
              </div>
              <div className="absolute -left-1 top-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#1A73E8] shadow-[0_4px_14px_rgba(60,64,67,0.12)]">
                <Smartphone className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="absolute -bottom-1 right-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#188038] shadow-[0_4px_14px_rgba(60,64,67,0.12)]">
                <ShieldCheck className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
              </div>
            </div>

            <div className="relative mt-8 max-w-[350px] text-center">
              <h2 className="text-lg font-medium tracking-[-0.02em] text-[#202124]">
                A secure check, then you’re back in
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#5F6368]">
                Scan the code on your computer with your phone, or continue directly on mobile.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-medium text-[#3C4043]">
                <ShieldCheck className="h-4 w-4 text-[#188038]" aria-hidden="true" />
                Access returns after a successful check
              </div>
            </div>
          </aside>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-2 px-5 pb-6 text-xs text-[#5F6368] sm:flex-row sm:px-8">
        <p>© {new Date().getFullYear()} Tiwlo</p>
        <p className="text-center sm:text-right">
          Your document is checked for a face match; document authenticity is not confirmed.
        </p>
      </footer>
    </main>
  );
}
