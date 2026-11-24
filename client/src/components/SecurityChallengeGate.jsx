import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/shadcnPrimitives';

const EVENT_NAME = 'tiwlo:security-challenge';
let activeChallengePromise = null;

/**
 * Triggers the clean shadcn security verification gate and awaits Proof-of-Work clearance.
 */
export function triggerInteractiveSecurityChallenge(initialChallenge = null) {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (activeChallengePromise) return activeChallengePromise;

  activeChallengePromise = new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: {
          challenge: initialChallenge,
          resolve: (verified) => {
            activeChallengePromise = null;
            resolve(Boolean(verified));
          },
        },
      })
    );
  });

  return activeChallengePromise;
}

async function computeSha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function solveProofOfWork({ challengeToken, difficulty = 4 }, onProgress, signal) {
  const prefix = '0'.repeat(Math.min(6, Math.max(3, Number(difficulty) || 4)));
  let counter = 0;

  while (!signal?.aborted) {
    const batchEnd = counter + 1200;
    while (counter < batchEnd) {
      if (signal?.aborted) return null;
      const solution = counter.toString(36);
      const hex = await computeSha256Hex(`${challengeToken}:${solution}`);
      if (hex.startsWith(prefix)) {
        return solution;
      }
      counter += 1;
    }
    onProgress?.(counter);
    await new Promise((r) => window.setTimeout(r, 0));
  }
  return null;
}

export default function SecurityChallengeGate() {
  const [request, setRequest] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | checking | verified | error
  const [attempts, setAttempts] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      setRequest(detail);
      setChallenge(detail.challenge || null);
      setStatus('idle');
      setAttempts(0);
      setErrorMsg('');
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const runVerification = async (seedChallenge = null) => {
    if (status === 'checking' || status === 'verified') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('checking');
    setErrorMsg('');
    setAttempts(0);

    try {
      let activeChallenge = seedChallenge || challenge;
      if (!activeChallenge?.challengeToken) {
        const issueRes = await globalThis.fetch('/api/security/challenge/issue', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        const issueJson = await issueRes.json().catch(() => ({}));
        if (issueJson?.cleared) {
          setStatus('verified');
          request?.resolve?.(true);
          setRequest(null);
          return;
        }
        activeChallenge = issueJson?.challenge || null;
        setChallenge(activeChallenge);
      }

      if (!activeChallenge?.challengeToken) {
        throw new Error('Could not initialize security challenge.');
      }

      const solution = await solveProofOfWork(
        activeChallenge,
        (count) => setAttempts(count),
        controller.signal
      );
      if (controller.signal.aborted || !solution) return;

      const verifyRes = await globalThis.fetch('/api/security/challenge/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: activeChallenge.challengeToken,
          solution,
        }),
        signal: controller.signal,
      });
      const verifyJson = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verifyJson?.verified) {
        throw new Error(verifyJson?.error || 'Verification did not succeed. Please retry.');
      }

      setStatus('verified');
      window.setTimeout(() => {
        request?.resolve?.(true);
        setRequest(null);
        setChallenge(null);
      }, 350);
    } catch (err) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setErrorMsg(err?.message || 'Security check failed.');
    }
  };

  useEffect(() => {
    if (!request) return undefined;
    runVerification(request.challenge || null);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  if (!request) return null;

  const difficulty = Number(challenge?.difficulty || 4);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-challenge-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
    >
      <Card className="w-full max-w-md border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
              {status === 'verified' ? (
                <CheckCircle2 className="h-5 w-5 text-[#1ED760]" />
              ) : status === 'error' ? (
                <ShieldAlert className="h-5 w-5 text-rose-500" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-[#1ED760]" />
              )}
            </div>
            <Badge variant={difficulty >= 5 ? 'warning' : 'secondary'}>
              {difficulty >= 5 ? 'Strict Verification' : 'Security Check'}
            </Badge>
          </div>
          <div className="space-y-1">
            <CardTitle id="security-challenge-title" className="text-base">
              {status === 'verified' ? 'Browser verified' : 'Verifying your connection'}
            </CardTitle>
            <CardDescription>
              {status === 'verified'
                ? 'Security clearance granted. Resuming your request.'
                : 'Automated cryptographic browser check to prevent abusive bots while keeping shared networks accessible.'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-neutral-200/80 bg-neutral-50 px-3.5 py-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
              {status === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-[#1ED760]" />}
              {status === 'verified' && <CheckCircle2 className="h-4 w-4 text-[#1ED760]" />}
              <span>
                {status === 'checking'
                  ? 'Computing cryptographic verification...'
                  : status === 'verified'
                    ? 'Verification complete'
                    : status === 'error'
                      ? 'Verification interrupted'
                      : 'Ready to verify'}
              </span>
            </div>
            {attempts > 0 && status === 'checking' && (
              <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                {attempts.toLocaleString()} checks
              </span>
            )}
          </div>

          {status === 'error' && errorMsg && (
            <Alert variant="destructive" className="py-2 text-xs">
              {errorMsg}
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              abortRef.current?.abort();
              request?.resolve?.(false);
              setRequest(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={status === 'checking' || status === 'verified'}
            onClick={() => {
              setChallenge(null);
              runVerification(null);
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
            {status === 'error' ? 'Retry Check' : 'Verify Now'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
