import React from 'react';
import {
  ArrowRight,
  FileCheck2,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Separator,
} from '../components/ui/shadcnPrimitives';

const VERIFICATION_STEPS = [
  {
    icon: FileCheck2,
    title: 'Scan document front & back',
    detail: 'NID, Passport, Driver’s License, or Other ID.',
  },
  {
    icon: UserCheck,
    title: 'Confirm legal details',
    detail: 'Match your name and date of birth cleanly.',
  },
  {
    icon: ScanFace,
    title: 'Live selfie or phone QR',
    detail: 'Verify here or scan QR on mobile without logging in again.',
  },
];

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  const displayName = user?.name?.trim() || '';
  const accountInitial = (displayName[0] || user?.email?.trim()?.[0] || 'T').toUpperCase();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4 py-8 text-neutral-950 sm:px-6 dark:bg-neutral-950 dark:text-neutral-50">
      <Card className="w-full max-w-[560px] rounded-[28px] border-neutral-200/80 bg-white px-6 py-8 shadow-[0_1px_3px_rgba(60,64,67,0.12),0_12px_32px_rgba(15,23,42,0.04)] sm:px-10 sm:py-10 dark:border-neutral-800 dark:bg-neutral-900">
        <header className="mb-7 flex items-center justify-between gap-4">
          <img
            src="/tiwlo-light-logo.png"
            alt="Tiwlo"
            className="h-7 w-auto max-w-[104px] object-contain object-left"
          />
          <Badge variant="destructive" className="gap-1.5 px-3 py-1 text-xs font-medium">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            Account locked
          </Badge>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 max-w-full items-center gap-2.5 rounded-full border border-neutral-200/90 bg-neutral-50/70 py-1 pl-1 pr-3 dark:border-neutral-800 dark:bg-neutral-950/60">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1ED760]/20 text-xs font-semibold text-emerald-900 dark:text-[#1ED760]">
              {accountInitial}
            </span>
            <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {user?.email || displayName || 'Tiwlo account'}
            </span>
          </div>
          <Badge variant="brand" className="px-2.5 py-1 text-[11px]">
            ~2 min check
          </Badge>
        </div>

        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-neutral-950 sm:text-[32px] dark:text-white">
          Verify it’s you
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          Your account is temporarily locked. Verify your identity to restore full access to your Tiwlo account.
        </p>

        <div className="mt-6 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              What happens next
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              Desktop or mobile QR
            </span>
          </div>
          <div className="space-y-3">
            {VERIFICATION_STEPS.map(({ icon: StepIcon, title, detail }, idx) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 bg-white text-neutral-700 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                  <StepIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {idx + 1}. {title}
                  </p>
                  <p className="text-xs leading-4 text-neutral-500 dark:text-neutral-400">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={onSignOut}
            className="rounded-full px-5"
          >
            Sign out
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onStartVerification}
            className="rounded-full px-6"
          >
            Verify identity
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <Separator className="my-6" />

        <Alert variant="default" className="rounded-2xl border-neutral-200/80 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-950/60">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#18a94c] dark:text-[#1ED760]" aria-hidden="true" />
          <p className="text-xs leading-5 text-neutral-600 dark:text-neutral-400">
            Access returns automatically after Gemini AI verifies your identity document, face match, and live selfie check (or after our Identity Review team completes manual review if automated verification falls back to review).
          </p>
        </Alert>
      </Card>
    </main>
  );
}
