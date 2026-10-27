import React, { useEffect } from 'react';
import { VerificationProvider, useVerification, STEPS } from './context/VerificationContext';
import MobileFrame from './components/MobileFrame';

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

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-[#F0F5FA] px-4 py-8">
      <MobileFrame>
        {renderCurrentStep()}
      </MobileFrame>
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
