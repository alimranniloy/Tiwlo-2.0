import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  IdCard,
  Info,
  ScanFace,
  ShieldCheck
} from 'lucide-react';

function CheckItem({ icon: Icon, title, description, tone = 'blue' }) {
  const iconColors = tone === 'slate'
    ? 'bg-slate-100 text-slate-600'
    : 'bg-blue-50 text-blue-700';

  return (
    <div className="flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconColors}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#202124]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[#5F6368]">{description}</p>
      </div>
    </div>
  );
}

export default function IdentityView({ onStartVerification }) {
  return (
    <div className="min-h-full bg-[#F8FAFD] px-4 py-6 sm:px-7 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5F6368]">
            Account
          </p>
          <h1 className="mt-2 text-3xl font-normal tracking-tight text-[#202124] sm:text-[34px]">
            Identity
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6368] sm:text-base">
            Review your identity check status and see what the check covers.
          </p>
        </header>

        <section
          aria-labelledby="identity-status-title"
          className="overflow-hidden rounded-[28px] border border-[#DADCE0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)]"
        >
          <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E8F0FE] text-[#1967D2]">
                <IdCard className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#5F6368]">Current status</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 id="identity-status-title" className="text-2xl font-medium tracking-tight text-[#202124]">
                    Not verified
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F3F4] px-3 py-1 text-xs font-semibold text-[#5F6368]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#80868B]" />
                    No saved record
                  </span>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#5F6368]">
                  There is no completed identity-check status saved to this account yet.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartVerification}
              className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-[#1A73E8] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1765CC] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 active:bg-[#185ABC] sm:self-center"
            >
              Start identity check
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-start gap-3 border-t border-[#E8EAED] bg-[#F8FAFD] px-5 py-4 sm:px-8">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5F6368]" aria-hidden="true" />
            <p className="text-xs leading-5 text-[#5F6368]">
              Verification results are not currently saved to your account, so this status will not persist after the check.
            </p>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[24px] border border-[#DADCE0] bg-white p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-[#202124]">What this check does</h2>
              <p className="mt-1 text-sm leading-6 text-[#5F6368]">
                The current flow checks these two things:
              </p>
            </div>
            <div className="space-y-6">
              <CheckItem
                icon={ScanFace}
                title="Face match"
                description="Compares the face in your document image with your selfie."
              />
              <CheckItem
                icon={CheckCircle2}
                title="Live check"
                description="Confirms you completed the requested live camera actions."
              />
            </div>
          </section>

          <section className="rounded-[24px] border border-[#DADCE0] bg-white p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-[#202124]">What it doesn’t verify</h2>
              <p className="mt-1 text-sm leading-6 text-[#5F6368]">
                A successful face match is not a document-authenticity check.
              </p>
            </div>
            <CheckItem
              icon={ShieldCheck}
              title="Document authenticity"
              description="The current flow does not confirm whether an ID was genuinely issued or whether its printed details are authentic."
              tone="slate"
            />
            <p className="mt-6 border-t border-[#E8EAED] pt-4 text-xs leading-5 text-[#5F6368]">
              Treat a successful result as a face-match and liveness check only—not as formal KYC approval.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
