import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, LockKeyhole, Smartphone } from 'lucide-react';

async function readJson(response) {
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || `Verification request failed (${response.status}).`);
  }
  if (!result || typeof result !== 'object') {
    throw new Error('The verification service returned an invalid response.');
  }
  return result;
}

export default function DesktopVerificationPage() {
  const [session, setSession] = useState(null);
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState('waiting');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const sessionRef = useRef(null);

  const requestSession = useCallback(async () => {
    const result = await readJson(await fetch('/api/verification/handoff', {
      method: 'POST',
      credentials: 'include',
    }));
    if (
      typeof result.sessionId !== 'string' ||
      typeof result.sessionKey !== 'string' ||
      typeof result.token !== 'string' ||
      typeof result.expiresAt !== 'number'
    ) {
      throw new Error('The verification service returned an invalid QR session.');
    }
    return {
      sessionId: result.sessionId,
      sessionKey: result.sessionKey,
      token: result.token,
      expiresAt: result.expiresAt,
    };
  }, []);

  const createSession = useCallback(async () => {
    setError('');
    setQrCode('');
    setSession(null);
    setStatus('waiting');
    try {
      const nextSession = await requestSession();
      sessionRef.current = nextSession;
      setSession(nextSession);
    } catch (requestError) {
      setError(requestError.message || 'Could not create a verification link.');
    }
  }, [requestSession]);

  const closeSession = useCallback((currentSession) => {
    if (!currentSession) return;
    fetch(`/api/verification/handoff/${encodeURIComponent(currentSession.sessionId)}/close`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-verification-session-key': currentSession.sessionKey },
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    requestSession().then(nextSession => {
      if (!active) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
    }).catch(requestError => {
      if (active) setError(requestError.message || 'Could not create a verification link.');
    });
    return () => { active = false; };
  }, [requestSession]);

  useEffect(() => {
    const handlePageHide = () => closeSession(sessionRef.current);
    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, [closeSession]);

  useEffect(() => {
    if (!session || status !== 'waiting') return undefined;
    let active = true;
    QRCode.toDataURL(`${window.location.origin}/verification/continue#token=${session.token}`, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#202124', light: '#ffffff' },
    }).then(dataUrl => {
      if (active) setQrCode(dataUrl);
    }).catch(qrError => {
      if (active) setError(qrError.message || 'Could not generate the verification QR code.');
    });
    return () => { active = false; };
  }, [session, status]);

  useEffect(() => {
    if (!session || status === 'success') return undefined;
    let active = true;
    const poll = async () => {
      try {
        const result = await readJson(await fetch(
          `/api/verification/handoff/${encodeURIComponent(session.sessionId)}/status`,
          {
            credentials: 'include',
            headers: { 'x-verification-session-key': session.sessionKey },
          }
        ));
        if (active && typeof result.status === 'string') setStatus(result.status);
      } catch (requestError) {
        if (!active) return;
        if (requestError.message?.toLowerCase().includes('no longer available')) {
          createSession();
        } else {
          setError(requestError.message || 'Could not check the verification status.');
        }
      }
    };
    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [createSession, session, status]);

  useEffect(() => {
    if (!session || status !== 'waiting') return undefined;
    let rotating = false;
    const updateTime = () => {
      const remaining = Math.max(0, session.expiresAt - Date.now());
      setSecondsLeft(Math.ceil(remaining / 1000));
      if (!remaining && !rotating) {
        rotating = true;
        fetch(`/api/verification/handoff/${encodeURIComponent(session.sessionId)}/rotate`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-verification-session-key': session.sessionKey },
        }).then(readJson).then(result => {
          setSession(current => current?.sessionId === session.sessionId
            ? { ...current, token: result.token, expiresAt: result.expiresAt }
            : current);
        }).catch(async () => {
          if (sessionRef.current?.sessionId !== session.sessionId) return;
          try {
            const current = await readJson(await fetch(
              `/api/verification/handoff/${encodeURIComponent(session.sessionId)}/status`,
              {
                credentials: 'include',
                headers: { 'x-verification-session-key': session.sessionKey },
              }
            ));
            if (current.status !== 'waiting') setStatus(current.status);
            else createSession();
          } catch {
            createSession();
          }
        });
      }
    };
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, [createSession, session, status]);

  const restart = () => {
    closeSession(sessionRef.current);
    sessionRef.current = null;
    createSession();
  };

  const statusContent = {
    waiting: {
      title: 'Scan with your phone',
      detail: 'Open your phone camera and scan this QR code. You will not need to sign in on your phone.',
    },
    connected: {
      title: 'Phone connected',
      detail: 'Continue on your phone. You can upload your document and complete the selfie check there.',
    },
    selfie: {
      title: 'Selfie check in progress',
      detail: 'Keep going on your phone. This page will update when verification finishes.',
    },
    processing: {
      title: 'Checking your information',
      detail: 'Your document and live selfie are being checked securely.',
    },
    success: {
      title: 'Verification complete',
      detail: 'Your identity check was successful.',
    },
    failed: {
      title: 'Verification needs another try',
      detail: 'The check could not be completed. Start a new verification to try again.',
    },
  }[status] || {
    title: 'Verification in progress',
    detail: 'Continue on your phone. This page will update automatically.',
  };

  return (
    <main className="min-h-screen bg-[#f8f9fa] px-5 py-10 text-[#202124] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-12 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#5f6368]">Tiwlo secure check</p>
            <h1 className="text-lg font-medium">Identity verification</h1>
          </div>
        </header>

        <div className="grid items-center gap-10 md:grid-cols-[1fr_390px] md:gap-16">
          <section>
            <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#1a73e8]">Continue on mobile</p>
            <h2 className="max-w-xl text-3xl font-normal leading-tight sm:text-4xl">
              Verify your identity using your phone
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5f6368]">
              Scan the one-time QR code, then upload your ID and take a live selfie on your phone.
              No phone sign-in is required.
            </p>
            <div className="mt-8 space-y-5">
              {[
                ['1', 'Scan the QR code with your phone camera'],
                ['2', 'Upload a clear photo of your identity document'],
                ['3', 'Complete the live selfie check on your phone'],
              ].map(([number, text]) => (
                <div key={number} className="flex items-center gap-4 text-sm text-[#3c4043]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#1a73e8] shadow-sm ring-1 ring-[#dadce0]">
                    {number}
                  </span>
                  {text}
                </div>
              ))}
            </div>
            <p className="mt-9 flex items-center gap-2 text-sm text-[#5f6368]">
              <LockKeyhole className="h-4 w-4" />
              The link can be used once. Closing this page ends the session.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(60,64,67,.12),0_2px_6px_2px_rgba(60,64,67,.08)] sm:p-9">
            <div className="mb-6 flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-[#5f6368]" />
              <div>
                <h3 className="font-medium">{statusContent.title}</h3>
                <p className="mt-1 text-sm leading-5 text-[#5f6368]">{statusContent.detail}</p>
              </div>
            </div>

            {status === 'waiting' && session && (
              <div className="flex flex-col items-center">
                <div className="flex h-[264px] w-[264px] items-center justify-center rounded-xl border border-[#dadce0] bg-white">
                  {qrCode
                    ? <img src={qrCode} alt="One-time identity verification QR code" className="h-60 w-60" />
                    : <LoaderCircle className="h-8 w-8 animate-spin text-[#1a73e8]" />}
                </div>
                <p className="mt-5 flex items-center gap-2 text-sm text-[#5f6368]">
                  <Clock3 className="h-4 w-4" />
                  Refreshes in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </p>
              </div>
            )}

            {status === 'connected' || status === 'selfie' || status === 'processing' ? (
              <div className="flex h-[264px] flex-col items-center justify-center rounded-xl bg-[#f8f9fa] text-center">
                <LoaderCircle className="h-10 w-10 animate-spin text-[#1a73e8]" />
                <p className="mt-4 text-sm text-[#5f6368]">Waiting for the phone to finish…</p>
              </div>
            ) : null}

            {status === 'success' && (
              <div className="flex h-[264px] flex-col items-center justify-center rounded-xl bg-[#e6f4ea] text-center">
                <CheckCircle2 className="h-12 w-12 text-[#188038]" />
                <p className="mt-4 font-medium text-[#137333]">You can close this page.</p>
              </div>
            )}

            {status === 'failed' && (
              <div className="flex h-[264px] flex-col items-center justify-center rounded-xl bg-[#fce8e6] text-center">
                <AlertCircle className="h-12 w-12 text-[#d93025]" />
                <button onClick={restart} className="mt-5 rounded-full bg-[#1a73e8] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#1765cc]">
                  Start again
                </button>
              </div>
            )}

            {error && (
              <div role="alert" className="mt-5 rounded-lg bg-[#fce8e6] p-3 text-sm text-[#b3261e]">
                <p>{error}</p>
                {!session && (
                  <button onClick={createSession} className="mt-3 rounded-full bg-[#1a73e8] px-4 py-2 font-medium text-white hover:bg-[#1765cc]">
                    Try again
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
