import VerificationFlow from './VerificationFlow';

export default VerificationFlow;
export { VerificationFlow };

// Re-export context and components
export { useVerification, VerificationProvider, STEPS, STEP_ROUTES } from './context/VerificationContext';
export { default as MobileFrame } from './components/MobileFrame';
export { default as MobileStatusBar } from './components/MobileStatusBar';
export { default as VerificationHeader } from './components/VerificationHeader';
export { default as StepIndicator } from './components/StepIndicator';
export { default as HomeIndicator } from './components/HomeIndicator';
export {
  PassportIcon,
  NationalIdIcon,
  AadhaarIcon,
  UploadHeroIllustration,
} from './components/DocumentIllustrations';

// Re-export Step Components
export { default as SelectDocumentStep } from './steps/select-document/SelectDocumentStep';
export { default as UploadDocumentStep } from './steps/upload-document/UploadDocumentStep';
export { default as CaptureSelfieStep } from './steps/capture-selfie/CaptureSelfieStep';
export { default as ProcessingStep } from './steps/processing/ProcessingStep';
export { default as VerificationSuccessStep } from './steps/verification-success/VerificationSuccessStep';
export { default as VerificationFailedStep } from './steps/verification-failed/VerificationFailedStep';
