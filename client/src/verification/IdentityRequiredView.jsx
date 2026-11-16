import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Clock, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
} from '../components/ui/shadcnPrimitives';

export default function IdentityRequiredView({ user, onStartVerification, onSignOut }) {
  const displayName = user?.name?.trim() || '';
  const accountInitial = (displayName[0] || user?.email?.trim()?.[0] || 'T').toUpperCase();

  const [reviewState, setReviewState] = useState({
    status: user?.identityReviewStatus || null,
    reviewId: user?.identityReviewId || null,
    reviewReason: user?.identityReviewReason || null,
  });
  const [checkingStatus, setCheckingStatus] = useState(false);

  const checkLiveReviewStatus = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setCheckingStatus(true);
    try {
      const response = await fetch('/api/verification/review-status', {
        credentials: 'include',
      });
      if (!response.ok) return;
      const json = await response.json().catch(() => null);
      if (!json || typeof json !== 'object') return;
      if (json.identityVerified === true || json.reviewStatus === 'accepted') {
        window.location.reload();
        return;
      }
      setReviewState({
        status: json.reviewStatus || null,
        reviewId: json.reviewId || null,
        reviewReason: json.reviewReason || null,
      });
    } catch {
      // Keep current status gracefully
    } finally {
      if (isManualRefresh) setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/verification/review-status', { credentials: 'include' })
      .then((response) => (response.ok ? response.json().catch(() => null) : null))
      .then((json) => {
        if (!active || !json || typeof json !== 'object') return;
        if (json.identityVerified === true || json.reviewStatus === 'accepted') {
          window.location.reload();
          return;
        }
        setReviewState({
          status: json.reviewStatus || null,
          reviewId: json.reviewId || null,
          reviewReason: json.reviewReason || null,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isPendingManualReview = reviewState.status === 'pending_review';
  const isPermanentlyClosed = reviewState.status === 'permanently_closed';
  const isDeclined = reviewState.status === 'declined';

  if (isPendingManualReview) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F8F9FA] px-3.5 py-4 text-neutral-950 sm:px-6 dark:bg-neutral-950 dark:text-neutral-50">
        <Card className="w-full max-w-[560px] rounded-[24px] sm:rounded-[28px] border-neutral-200/80 bg-white px-6 py-7 shadow-[0_1px_3px_rgba(60,64,67,0.12),0_12px_32px_rgba(15,23,42,0.04)] sm:px-10 sm:py-9 dark:border-neutral-800 dark:bg-neutral-900">
          <header className="mb-6 flex items-center justify-between gap-3">
            <img
              src="/tiwlo-light-logo.png"
              alt="Tiwlo"
              className="h-6 sm:h-7 w-auto max-w-[104px] object-contain object-left"
            />
            <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-[11px] font-medium">
              <Clock className="h-3 w-3 text-neutral-600" aria-hidden="true" />
              Pending Review
            </Badge>
          </header>

          <div className="mb-5 flex w-fit max-w-full items-center gap-2 rounded-full border border-neutral-200/90 bg-neutral-50/70 py-1 pl-1 pr-3 dark:border-neutral-800 dark:bg-neutral-950/60">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1ED760]/20 text-[11px] font-semibold text-emerald-900 dark:text-[#1ED760]">
              {accountInitial}
            </span>
            <span className="truncate text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {user?.email || displayName || 'Tiwlo account'}
            </span>
          </div>

          <h1 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.025em] text-neutral-950 sm:text-[30px] dark:text-white">
            Submitted for Manual Review
          </h1>
          <p className="mt-2.5 text-[13.5px] sm:text-sm leading-5 sm:leading-6 text-neutral-600 dark:text-neutral-400">
            Your identity document and selfie check have been submitted cleanly to our Identity Review team. You do not need to upload again.
          </p>

          <div className="mt-5 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 text-xs text-neutral-600 space-y-1.5 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-300">
            <p className="font-semibold text-neutral-900 dark:text-white">What happens next</p>
            <p className="leading-5">
              Our Identity Review team will verify your details shortly. Once approved, your account will unlock automatically.
            </p>
            {reviewState.reviewId && (
              <p className="pt-1 text-[11.5px] text-neutral-500">
                Reference ID: <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">{reviewState.reviewId}</span>
              </p>
            )}
          </div>

          <div className="mt-7 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
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
              disabled={checkingStatus}
              onClick={() => checkLiveReviewStatus(true)}
              className="rounded-full px-6"
            >
              <RefreshCw className={`h-4 w-4 ${checkingStatus ? 'animate-spin' : ''}`} aria-hidden="true" />
              {checkingStatus ? 'Checking...' : 'Check status'}
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F8F9FA] px-3.5 py-4 text-neutral-950 sm:px-6 dark:bg-neutral-950 dark:text-neutral-50">
      <Card className="w-full max-w-[560px] rounded-[24px] sm:rounded-[28px] border-neutral-200/80 bg-white px-6 py-7 shadow-[0_1px_3px_rgba(60,64,67,0.12),0_12px_32px_rgba(15,23,42,0.04)] sm:px-10 sm:py-9 dark:border-neutral-800 dark:bg-neutral-900">
        <header className="mb-6 flex items-center">
          <img
            src="/tiwlo-light-logo.png"
            alt="Tiwlo"
            className="h-6 sm:h-7 w-auto max-w-[104px] object-contain object-left"
          />
        </header>

        <div className="mb-5 flex w-fit max-w-full items-center gap-2 rounded-full border border-neutral-200/90 bg-neutral-50/70 py-1 pl-1 pr-3 dark:border-neutral-800 dark:bg-neutral-950/60">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1ED760]/20 text-[11px] font-semibold text-emerald-900 dark:text-[#1ED760]">
            {accountInitial}
          </span>
          <span className="truncate text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {user?.email || displayName || 'Tiwlo account'}
          </span>
        </div>

        <h1 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.025em] text-neutral-950 sm:text-[30px] dark:text-white">
          {isPermanentlyClosed ? 'Verification Closed' : 'Verify it’s you'}
        </h1>
        <p className="mt-2.5 text-[13.5px] sm:text-sm leading-5 sm:leading-6 text-neutral-600 dark:text-neutral-400">
          {isPermanentlyClosed
            ? 'This identity verification case has been permanently closed by our compliance team.'
            : isDeclined
              ? reviewState.reviewReason || 'Your previous verification submission needs a new clear document and selfie check.'
              : 'Your account is temporarily locked. Verify your identity on this device or scan the QR code with your phone to restore access.'}
        </p>

        <div className="mt-7 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            size="lg"
            onClick={onSignOut}
            className="rounded-full px-5"
          >
            Sign out
          </Button>
          {!isPermanentlyClosed && (
            <Button
              variant="primary"
              size="lg"
              onClick={onStartVerification}
              className="rounded-full px-6"
            >
              Verify identity
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className="mt-6 flex items-start gap-2.5 border-t border-neutral-200/80 pt-4 dark:border-neutral-800">
          {isPermanentlyClosed ? (
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#18a94c] dark:text-[#1ED760]" aria-hidden="true" />
          )}
          <p className="text-[11.5px] leading-4 text-neutral-500 dark:text-neutral-400">
            Access returns automatically once Tiwlo verifies your document and live selfie (or after Identity Review team approval).
          </p>
        </div>
      </Card>
    </main>
  );
}
