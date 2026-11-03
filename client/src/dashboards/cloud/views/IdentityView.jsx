import React from 'react';
import { ArrowRight, Check, IdCard, ScanFace } from 'lucide-react';

function ProcessStep({ number, title, description, icon: Icon }) {
  return (
    <div className="flex items-start gap-4 py-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#efefef] text-[#5e5e5e]">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#636363]">
          Step {number}
        </p>
        <h3 className="mt-1 text-sm font-medium text-[#212121]">{title}</h3>
        <p className="mt-1 max-w-md text-sm leading-5 text-[#636363]">{description}</p>
      </div>
    </div>
  );
}

export default function IdentityView({ currentUser, onStartVerification }) {
  const isVerified = currentUser?.identityVerified === true;

  return (
    <main className="min-h-full bg-white px-5 py-7 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-xs font-medium text-[#636363]">Account</p>
          <h1 className="mt-1 text-[28px] font-normal tracking-[-0.02em] text-[#212121] sm:text-[32px]">
            Identity
          </h1>
        </header>

        <section className="rounded-[28px] bg-[#f6f6f6] px-6 py-8 sm:px-10 sm:py-11">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-[#636363]">
            <span className={`h-2 w-2 rounded-full ${isVerified ? 'bg-[#188038]' : 'bg-[#9f9f9f]'}`} />
            {isVerified ? 'Verified' : 'Not verified'}
          </div>

          <h2 className="mt-5 max-w-xl text-[28px] font-normal leading-tight tracking-[-0.025em] text-[#212121] sm:text-[36px]">
            {isVerified ? 'Your identity check is complete' : 'Verify it’s really you'}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#636363] sm:text-base">
            {isVerified
              ? 'Your selfie matched the photo on your submitted document, and your account is active.'
              : 'Match your selfie with your ID photo in a quick, guided check.'}
          </p>

          {!isVerified && (
            <button
              type="button"
              onClick={onStartVerification}
              className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#696969] px-6 text-sm font-medium text-white shadow-[0_1px_2px_rgba(60,64,67,0.3)] transition hover:bg-[#5c5c5c] hover:shadow-[0_2px_5px_rgba(60,64,67,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#e1e1e1] active:bg-[#535353]"
            >
              Start verification
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </section>

        <section className="mt-9">
          <h2 className="text-lg font-normal tracking-[-0.01em] text-[#212121]">
            What to expect
          </h2>
          <div className="mt-2 divide-y divide-[#eaeaea] sm:grid sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
            <div className="sm:pr-7">
              <ProcessStep
                number="1"
                title="Upload your ID"
                description="Add a clear photo of your identity document."
                icon={IdCard}
              />
            </div>
            <div className="sm:pl-7">
              <ProcessStep
                number="2"
                title="Take a live selfie"
                description="Follow the camera prompts while we compare the faces."
                icon={ScanFace}
              />
            </div>
          </div>
        </section>

        <p className="mt-5 flex items-start gap-2.5 text-xs leading-5 text-[#636363]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#636363]" aria-hidden="true" />
          This checks face match and liveness only. It does not confirm that your ID is genuine.
        </p>
      </div>
    </main>
  );
}
