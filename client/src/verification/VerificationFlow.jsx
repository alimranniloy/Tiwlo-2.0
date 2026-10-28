import React, { useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, Smartphone } from 'lucide-react';
import { VerificationProvider, useVerification, STEPS } from './context/VerificationContext';
import DesktopVerificationPage from './DesktopVerificationPage';

// Step components
import SelectDocumentStep from './steps/select-document/SelectDocumentStep';
import UploadDocumentStep from './steps/upload-document/UploadDocumentStep';
import CaptureSelfieStep from './steps/capture-selfie/CaptureSelfieStep';
import ProcessingStep from './steps/processing/ProcessingStep';
import VerificationSuccessStep from './steps/verification-success/VerificationSuccessStep';
import VerificationFailedStep from './steps/verification-failed/VerificationFailedStep';

function FlowRouter() {
  const { currentStep, goToStep } = useVerification();

  // Sync with browser back/forward and initial path
  useEffect(() => {
    const syncRouteWithStep = () => {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname === 'verification/upload-document') {
        goToStep(STEPS.UPLOAD_DOCUMENT);
      } else if (pathname === 'verification/capture-selfie') {
        goToStep(STEPS.CAPTURE_SELFIE);
      } else if (pathname === 'verification/processing') {
        goToStep(STEPS.PROCESSING);
      } else if (pathname === 'verification/success') {
        goToStep(STEPS.SUCCESS);
      } else if (pathname === 'verification/failed') {
        goToStep(STEPS.FAILED);
      } else if (pathname === 'verification/select-document') {
        goToStep(STEPS.SELECT_DOCUMENT);
      }
    };

    syncRouteWithStep();
    window.addEventListener('popstate', syncRouteWithStep);
    return () => window.removeEventListener('popstate', syncRouteWithStep);
  }, [goToStep]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case STEPS.SELECT_DOCUMENT:
        return <SelectDocumentStep />;
      case STEPS.UPLOAD_DOCUMENT:
        return <UploadDocumentStep />;
      case STEPS.CAPTURE_SELFIE:
        return <CaptureSelfieStep />;
      case STEPS.PROCESSING:
        return <ProcessingStep />;
      case STEPS.SUCCESS:
        return <VerificationSuccessStep />;
      case STEPS.FAILED:
        return <VerificationFailedStep />;
      default:
        return <SelectDocumentStep />;
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#F8FAFC] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-white shadow-sm sm:border-x sm:border-slate-200">
        {renderCurrentStep()}
      </div>
    </div>
  );
}

function MobileHandoff({ token, initialStep, onComplete, onCancel }) {
  const [handoff, setHandoff] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const redeem = async () => {
      try {
        const response = await fetch('/api/verification/handoff/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'This verification link has expired.');
        if (typeof result?.sessionId !== 'string' || typeof result?.accessToken !== 'string') {
          throw new Error('The verification service returned an invalid mobile session.');
        }
        if (!active) return;
        window.history.replaceState(null, '', '/verification/continue');
        setHandoff(result);
      } catch (requestError) {
        if (active) setError(requestError.message || 'This verification link is unavailable.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    redeem();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!handoff) return undefined;
    const closeSession = () => {
      fetch(`/api/verification/handoff/${encodeURIComponent(handoff.sessionId)}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${handoff.accessToken}` },
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener('pagehide', closeSession);
    return () => window.removeEventListener('pagehide', closeSession);
  }, [handoff]);

  if (handoff) {
    return (
      <VerificationProvider initialStep={initialStep} onComplete={onComplete} onCancel={onCancel} accessToken={handoff.accessToken}>
        <FlowRouter />
      </VerificationProvider>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-6 text-center">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        {isLoading ? (
          <>
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-blue-600" />
            <h1 className="mt-5 text-lg font-semibold">Opening secure verification</h1>
            <p className="mt-2 text-sm text-slate-500">Connecting this phone to your verification session…</p>
          </>
        ) : (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
            <h1 className="mt-5 text-lg font-semibold">Link unavailable</h1>
            <p role="alert" className="mt-2 text-sm text-slate-500">{error}</p>
            <p className="mt-4 text-sm text-slate-500">Return to the desktop and scan its current QR code.</p>
          </>
        )}
      </section>
    </main>
  );
}

function MobileStartNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-6 text-center">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <Smartphone className="mx-auto h-10 w-10 text-blue-600" />
        <h1 className="mt-5 text-xl font-semibold">Start verification on your computer</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Open the verification page on your computer and scan its one-time QR code with this phone.
        </p>
      </section>
    </main>
  );
}

export default function VerificationFlow({ initialStep = 1, onComplete = null, onCancel = null }) {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const isContinueRoute = /^\/verification\/continue\/?$/.test(window.location.pathname);
  const token = isContinueRoute
    ? new URLSearchParams(window.location.hash.slice(1)).get('token')
    : null;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const updateViewport = event => setIsDesktop(event.matches);
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  if (token && /^[A-Za-z0-9_-]{40,64}$/.test(token)) {
    if (isDesktop) return <MobileStartNotice />;
    return <MobileHandoff token={token} initialStep={initialStep} onComplete={onComplete} onCancel={onCancel} />;
  }
  if (isDesktop) return <DesktopVerificationPage />;
  return <MobileStartNotice />;
}
