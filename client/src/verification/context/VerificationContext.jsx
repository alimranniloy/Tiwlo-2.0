import React, { createContext, useContext, useState, useCallback } from 'react';

const VerificationContext = createContext(null);

export const STEPS = {
  SELECT_DOCUMENT: 1,
  UPLOAD_DOCUMENT: 2,
  CONFIRM_NAME: 'confirm-name',
  CAPTURE_SELFIE: 3,
  PROCESSING: 4,
  SUCCESS: 5,
  FAILED: 6,
};

export const STEP_ROUTES = {
  1: '/verification/select-document',
  2: '/verification/upload-document',
  'confirm-name': '/verification/confirm-name',
  3: '/verification/capture-selfie',
  4: '/verification/processing',
  5: '/verification/success',
  6: '/verification/failed',
};

const VALID_STEPS = new Set(Object.values(STEPS));

export function VerificationProvider({
  children,
  initialStep = 1,
  onComplete = null,
  onCancel = null,
  accessToken = null,
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedDocument, setSelectedDocument] = useState('passport'); // 'passport' | 'national_id' | 'other_document'
  const [documentFile, setDocumentFile] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentBackFile, setDocumentBackFile] = useState(null);
  const [documentBackPreview, setDocumentBackPreview] = useState(null);
  const [documentAnalysis, setDocumentAnalysis] = useState(null);
  const [manualReviewInfo, setManualReviewInfo] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [livenessSessionId, setLivenessSessionId] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null); // 'success' | 'manual_review' | 'failed' | null
  const [failureReason, setFailureReason] = useState("We couldn't verify your identity. Please check your information and try again.");
  const [failureType, setFailureType] = useState('verification');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Real-time animated checklist stages for Step 4 (Processing)
  const [processingStages, setProcessingStages] = useState({
    documentCheck: false,
    faceMatching: false,
    securityValidation: false,
  });

  const goToStep = useCallback((step) => {
    const targetStep = VALID_STEPS.has(step)
      ? step
      : typeof step === 'number'
        ? Math.max(1, Math.min(step, 6))
        : STEPS.SELECT_DOCUMENT;
    setCurrentStep(targetStep);

    // Update browser URL predictably without reload
    try {
      const route = STEP_ROUTES[targetStep] || '/verification';
      if (window.location.pathname !== route) {
        window.history.pushState({
          step: targetStep,
          identityVerificationStarted: window.history.state?.identityVerificationStarted === true,
        }, '', route);
      }
    } catch {}
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep === STEPS.SELECT_DOCUMENT) {
      goToStep(STEPS.UPLOAD_DOCUMENT);
    } else if (currentStep === STEPS.UPLOAD_DOCUMENT) {
      goToStep(STEPS.CONFIRM_NAME);
    } else if (currentStep === STEPS.CONFIRM_NAME) {
      goToStep(STEPS.CAPTURE_SELFIE);
    } else if (currentStep === STEPS.CAPTURE_SELFIE) {
      goToStep(STEPS.PROCESSING);
    } else if (currentStep === STEPS.PROCESSING) {
      goToStep(verificationResult === 'failed' ? STEPS.FAILED : STEPS.SUCCESS);
    } else if (typeof currentStep === 'number' && currentStep < 5) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, verificationResult, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStep === STEPS.UPLOAD_DOCUMENT) {
      goToStep(STEPS.SELECT_DOCUMENT);
    } else if (currentStep === STEPS.CONFIRM_NAME) {
      goToStep(STEPS.UPLOAD_DOCUMENT);
    } else if (currentStep === STEPS.CAPTURE_SELFIE) {
      if (
        documentAnalysis?.needsNameCorrection ||
        documentAnalysis?.nameMismatch ||
        documentAnalysis?.dobMismatch
      ) {
        goToStep(STEPS.CONFIRM_NAME);
      } else {
        goToStep(STEPS.UPLOAD_DOCUMENT);
      }
    } else if (currentStep === STEPS.PROCESSING) {
      goToStep(STEPS.CAPTURE_SELFIE);
    } else if (currentStep === STEPS.FAILED) {
      goToStep(STEPS.SELECT_DOCUMENT);
    } else if (onCancel) {
      onCancel();
    }
  }, [currentStep, documentAnalysis, goToStep, onCancel]);

  const setUploadedDocument = useCallback((file, previewUrl = null) => {
    if (documentPreview && documentPreview !== previewUrl) {
      URL.revokeObjectURL(documentPreview);
    }
    setDocumentFile(file);
    setDocumentPreview(previewUrl);
  }, [documentPreview]);

  const setUploadedDocumentBack = useCallback((file, previewUrl = null) => {
    if (documentBackPreview && documentBackPreview !== previewUrl) {
      URL.revokeObjectURL(documentBackPreview);
    }
    setDocumentBackFile(file);
    setDocumentBackPreview(previewUrl);
  }, [documentBackPreview]);

  const setConsent = useCallback((accepted) => {
    setConsentAccepted(Boolean(accepted));
  }, []);

  const selectDocumentType = useCallback((type) => {
    setSelectedDocument(type);
    setUploadedDocument(null, null);
    setUploadedDocumentBack(null, null);
    setDocumentAnalysis(null);
    setConsent(false);
  }, [setConsent, setUploadedDocument, setUploadedDocumentBack]);

  const setCapturedSelfie = useCallback((imageDataUrl) => {
    setSelfieImage(imageDataUrl);
  }, []);

  const resetVerification = useCallback(() => {
    setUploadedDocument(null, null);
    setUploadedDocumentBack(null, null);
    setDocumentAnalysis(null);
    setManualReviewInfo(null);
    setSelfieImage(null);
    setRecordedVideo(null);
    setLivenessSessionId(null);
    setConsentAccepted(false);
    setProcessingStages({
      documentCheck: false,
      faceMatching: false,
      securityValidation: false,
    });
    setVerificationResult(null);
    setFailureReason("We couldn't verify your identity. Please check your information and try again.");
    setFailureType('verification');
    goToStep(STEPS.SELECT_DOCUMENT);
  }, [goToStep, setFailureReason, setUploadedDocument, setUploadedDocumentBack]);

  return (
    <VerificationContext.Provider
      value={{
        STEPS,
        currentStep,
        verificationAccessToken: accessToken,
        setCurrentStep,
        goToStep,
        nextStep,
        prevStep,
        selectedDocument,
        selectDocumentType,
        documentFile,
        documentPreview,
        setUploadedDocument,
        documentBackFile,
        documentBackPreview,
        setUploadedDocumentBack,
        documentAnalysis,
        setDocumentAnalysis,
        manualReviewInfo,
        setManualReviewInfo,
        selfieImage,
        setCapturedSelfie,
        recordedVideo,
        setRecordedVideo,
        livenessSessionId,
        setLivenessSessionId,
        consentAccepted,
        setConsentAccepted: setConsent,
        processingStages,
        setProcessingStages,
        verificationResult,
        setVerificationResult,
        failureReason,
        setFailureReason,
        failureType,
        setFailureType,
        resetVerification,
        onComplete,
        onCancel,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
}
