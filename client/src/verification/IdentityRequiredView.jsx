import React from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
} from '../components/ui/shadcnPrimitives';

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  const displayName = user?.name?.trim() || '';
  const accountInitial = (displayName[0] || user?.email?.trim()?.[0] || 'T').toUpperCase();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F8F9FA] px-3.5 py-4 text-neutral-950 sm:px-6 dark:bg-neutral-950 dark:text-neutral-50">
      <Card className="w-full max-w-[560px] rounded-[24px] sm:rounded-[28px] border-neutral-200/80 bg-white px-5 py-6 shadow-[0_1px_3px_rgba(60,64,67,0.12),0_12px_32px_rgba(15,23,42,0.04)] sm:px-9 sm:py-8 dark:border-neutral-800 dark:bg-neutral-900">
        <header className="mb-5 flex items-center justify-between gap-3">
          <img
            src="/tiwlo-light-logo.png"
            alt="Tiwlo"
            className="h-6 sm:h-7 w-auto max-w-[104px] object-contain object-left"
          />
          <Badge variant="destructive" className="gap-1.5 px-2.5 py-1 text-[11px] font-medium">
            <LockKeyhole className="h-3 w-3" aria-hidden="true" />
            Account locked
          </Badge>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-neutral-200/90 bg-neutral-50/70 py-1 pl-1 pr-3 dark:border-neutral-800 dark:bg-neutral-950/60">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1ED760]/20 text-[11px] font-semibold text-emerald-900 dark:text-[#1ED760]">
              {accountInitial}
            </span>
            <span className="truncate text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {user?.email || displayName || 'Tiwlo account'}
            </span>
          </div>
          <Badge variant="brand" className="px-2.5 py-0.5 text-[11px]">
            ~2 min check
          </Badge>
        </div>

        <h1 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.025em] text-neutral-950 sm:text-[30px] dark:text-white">
          Verify it’s you
        </h1>
        <p className="mt-2.5 text-[13.5px] sm:text-sm leading-5 sm:leading-6 text-neutral-600 dark:text-neutral-400">
          Your account is temporarily locked. Complete a quick ID and live selfie check on this device or your phone to restore access.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">1. Upload ID</Badge>
          <Badge variant="secondary">2. Live Selfie / QR</Badge>
          <Badge variant="secondary">3. Instant Restore</Badge>
        </div>

        <div className="mt-6 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="mt-5 flex items-start gap-2.5 border-t border-neutral-200/80 pt-4 dark:border-neutral-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#18a94c] dark:text-[#1ED760]" aria-hidden="true" />
          <p className="text-[11.5px] leading-4 text-neutral-500 dark:text-neutral-400">
            Access returns automatically once Tiwlo verifies your document and live selfie (or after Identity Review team approval).
          </p>
        </div>
      </Card>
    </main>
  );
}
