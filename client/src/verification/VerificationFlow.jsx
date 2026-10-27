import React, { useEffect, useState } from 'react';
import { VerificationProvider, useVerification, STEPS } from './context/VerificationContext';
import MobileFrame from './components/MobileFrame';
import VerificationShowcase from './components/VerificationShowcase';

// Step components
import SelectDocumentStep from './steps/select-document/SelectDocumentStep';
import UploadDocumentStep from './steps/upload-document/UploadDocumentStep';
import CaptureSelfieStep from './steps/capture-selfie/CaptureSelfieStep';
import ProcessingStep from './steps/processing/ProcessingStep';
import VerificationSuccessStep from './steps/verification-success/VerificationSuccessStep';
import VerificationFailedStep from './steps/verification-failed/VerificationFailedStep';

function FlowRouter() {
  const { currentStep, goToStep, setVerificationResult } = useVerification();
  // View mode: 'showcase' (shows all 6 screens side-by-side like reference image) or 'mobile' (single interactive device)
  const [viewMode, setViewMode] = useState('showcase');

  // Sync with browser back/forward and initial path
  useEffect(() => {
    const syncRouteWithStep = () => {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname === 'verification/upload-document') {
        goToStep(STEPS.UPLOAD_DOCUMENT);
        setViewMode('mobile');
      } else if (pathname === 'verification/capture-selfie') {
        goToStep(STEPS.CAPTURE_SELFIE);
        setViewMode('mobile');
      } else if (pathname === 'verification/processing') {
        goToStep(STEPS.PROCESSING);
        setViewMode('mobile');
      } else if (pathname === 'verification/success') {
        goToStep(STEPS.SUCCESS);
        setViewMode('mobile');
      } else if (pathname === 'verification/failed') {
        goToStep(STEPS.FAILED);
        setViewMode('mobile');
      } else if (pathname === 'verification/select-document') {
        goToStep(STEPS.SELECT_DOCUMENT);
        setViewMode('mobile');
      }
    };

    syncRouteWithStep();
    window.addEventListener('popstate', syncRouteWithStep);
    return () => window.removeEventListener('popstate', syncRouteWithStep);
  }, [goToStep]);

  // Render current active step for single mobile view
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

  const stepLabels = [
    { num: 1, label: '1. Select Document', step: STEPS.SELECT_DOCUMENT },
    { num: 2, label: '2. Upload Document', step: STEPS.UPLOAD_DOCUMENT },
    { num: 3, label: '3. Capture Selfie', step: STEPS.CAPTURE_SELFIE },
    { num: 4, label: '4. Processing', step: STEPS.PROCESSING },
    { num: 5, label: '5. Success', step: STEPS.SUCCESS },
    { num: 6, label: '6. Failure', step: STEPS.FAILED },
  ];

  return (
    <div className="relative w-full min-h-screen bg-[#F0F5FA] flex flex-col items-center">
      {/* Top Mode Switcher Bar */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">
            Identity Verification Suite
          </h2>
        </div>

        {/* View Mode Pill Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
          <button
            onClick={() => setViewMode('showcase')}
            type="button"
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'showcase'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Showcase (All 6 Screens)
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            type="button"
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'mobile'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Interactive Mobile Phone
          </button>
        </div>
      </header>

      {/* Main View Area */}
      {viewMode === 'showcase' ? (
        /* Showcase mode: All 6 screens side-by-side matching the reference image */
        <VerificationShowcase
          onSelectStep={(step) => {
            goToStep(step);
            setViewMode('mobile');
          }}
        />
      ) : (
        /* Single Mobile Phone mode: Pure mobile screen without fake status bar */
        <div className="py-8 px-4 w-full flex flex-col items-center">
          <MobileFrame>
            {renderCurrentStep()}
          </MobileFrame>

          {/* Bottom Step Switcher */}
          <aside aria-label="Step quick switcher" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[94vw] hidden md:block">
            <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400 font-medium mr-1.5 pl-1">Jump to:</span>
              {stepLabels.map((item) => {
                const isActive = currentStep === item.step;
                return (
                  <button
                    key={item.num}
                    onClick={() => {
                      if (item.step === STEPS.SUCCESS) {
                        setVerificationResult('success');
                      } else if (item.step === STEPS.FAILED) {
                        setVerificationResult('failed');
                      }
                      goToStep(item.step);
                    }}
                    type="button"
                    className={`px-2.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function VerificationFlow({ initialStep = 1, onComplete = null, onCancel = null }) {
  return (
    <VerificationProvider initialStep={initialStep} onComplete={onComplete} onCancel={onCancel}>
      <FlowRouter />
    </VerificationProvider>
  );
}
