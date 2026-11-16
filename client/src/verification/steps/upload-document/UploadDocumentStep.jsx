import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, X, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';
import { UploadHeroIllustration } from '../../components/DocumentIllustrations';
import {
  isVerificationFetchError,
  VERIFICATION_CONNECTION_ERROR,
} from '../../utils/verificationErrors';

/**
 * Step 2: Upload your document
 * Screen 2 in reference mockup
 */
export default function UploadDocumentStep({ onNext = null, onBack = null }) {
  const {
    STEPS,
    verificationAccessToken,
    selectedDocument,
    documentFile,
    setUploadedDocument,
    documentBackFile,
    setUploadedDocumentBack,
    setDocumentAnalysis,
    consentAccepted,
    setConsentAccepted,
    setFailureReason,
    setFailureType,
    goToStep,
    prevStep,
  } = useVerification();

  const fileInputRef = useRef(null);
  const backFileInputRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const validateFile = (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Please choose a JPEG, PNG or WebP image.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('File size exceeds 10MB limit. Please choose a smaller image.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;
    const previewUrl = URL.createObjectURL(file);
    setUploadedDocument(file, previewUrl);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!validateFile(file)) return;
    const previewUrl = URL.createObjectURL(file);
    setUploadedDocument(file, previewUrl);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    if (isAnalyzing) return;
    setUploadedDocument(null, null);
    setDocumentAnalysis(null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleContinue = async () => {
    if (isAnalyzing) return;
    if (!documentFile) {
      setErrorMessage('Upload a clear image of your selected document to continue.');
      return;
    }
    if (!consentAccepted) {
      setErrorMessage('Please agree to the identity verification terms before continuing.');
      return;
    }

    setErrorMessage('');
    setIsAnalyzing(true);
    try {
      const body = new FormData();
      body.append('document', documentFile, documentFile.name || 'document-image');
      if (documentBackFile) {
        body.append('documentBack', documentBackFile, documentBackFile.name || 'document-back-image');
      }
      body.append('documentType', selectedDocument);

      const response = await fetch('/api/verification/document-analyze', {
        method: 'POST',
        credentials: 'include',
        headers: verificationAccessToken
          ? { Authorization: `Bearer ${verificationAccessToken}` }
          : {},
        body,
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        if (
          response.status === 403 &&
          (json?.code === 'DUPLICATE_IDENTITY_PERMANENT_BAN' || json?.permanentlyBanned === true)
        ) {
          const banMessage =
            json?.error ||
            'This identity document was already used on another verified account. Your account has been permanently disabled.';
          setFailureType('verification');
          setFailureReason(banMessage);
          setErrorMessage(banMessage);
          return;
        }
        throw new Error(
          json?.error || `Could not analyze the document (HTTP ${response.status}).`
        );
      }

      const analysis = json && typeof json === 'object' ? json : {};
      setDocumentAnalysis(analysis);

      if (onNext) {
        onNext(analysis);
      } else if (analysis.needsNameCorrection || analysis.nameMismatch || analysis.dobMismatch) {
        goToStep(STEPS.CONFIRM_NAME);
      } else {
        goToStep(STEPS.CAPTURE_SELFIE);
      }
    } catch (error) {
      if (isVerificationFetchError(error)) {
        setErrorMessage(VERIFICATION_CONNECTION_ERROR);
      } else {
        setErrorMessage(error.message || 'Could not analyze the document. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleBack = () => {
    if (isAnalyzing) return;
    if (onBack) {
      onBack();
    } else {
      prevStep();
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-1 select-none">
      <div>
        {/* Top Header & Stepper */}
        <VerificationHeader
          title="Identity Verification"
          showBack={true}
          onBack={handleBack}
        />
        <StepIndicator currentStep={2} totalSteps={5} />

        {/* Central Graphic Illustration */}
        <div className="w-full flex items-center justify-center my-4">
          <UploadHeroIllustration className="w-48 h-32" />
        </div>

        {/* Title & Description */}
        <div className="text-center mb-5">
          <h2 className="text-[24px] font-bold text-neutral-900 tracking-tight leading-snug">
            Upload your document
          </h2>
          <p className="text-[13.5px] text-neutral-500 font-normal mt-2 leading-relaxed px-2">
            Take a clear photo or upload a scanned copy of your passport, national ID card, or other government ID. Make sure all details are visible and readable.
          </p>
        </div>

        {/* Hidden Native File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Upload Dropzone / Tap to Upload Box */}
        {!documentFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`w-full py-8 px-4 rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center cursor-pointer active:scale-[0.99] ${
              isDragging
                ? 'border-neutral-500 bg-neutral-50/70 shadow-sm'
                : 'border-neutral-300/80 bg-neutral-50/60 hover:bg-neutral-50/30 hover:border-neutral-400'
            }`}
          >
            {/* Blue Cloud Upload Icon */}
            <div className="w-12 h-12 rounded-full bg-neutral-100/70 flex items-center justify-center text-neutral-600 mb-3 shadow-2xs">
              <UploadCloud className="w-6 h-6 text-neutral-600" strokeWidth={2} />
            </div>

            <p className="text-[15px] font-semibold text-neutral-800">
              Tap to upload
            </p>
            <p className="text-[12px] text-neutral-400 mt-0.5">
              JPG, PNG or WebP • Max 10MB
            </p>
          </div>
        ) : (
          /* File Uploaded Preview Card */
          <div className="w-full p-4 rounded-2xl border border-neutral-200 bg-neutral-50/40 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-11 h-11 rounded-xl bg-neutral-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-neutral-900 truncate">
                  {documentFile.name || `${selectedDocument.toUpperCase()}_document.jpg`}
                </p>
                <p className="text-[12px] text-neutral-500">
                  {documentFile.size ? `${(documentFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Ready to verify'}
                </p>
              </div>
            </div>

            <button
              onClick={handleRemoveFile}
              disabled={isAnalyzing}
              type="button"
              className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors disabled:opacity-40"
              aria-label="Remove document"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Optional Back-Side Document Upload for cross-check (address, barcode/QR) */}
        <input
          ref={backFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !validateFile(file)) return;
            setUploadedDocumentBack(file, URL.createObjectURL(file));
          }}
          className="hidden"
        />
        <div className="mt-3">
          {!documentBackFile ? (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => backFileInputRef.current?.click()}
              className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-neutral-300/80 bg-neutral-50/50 hover:bg-neutral-100/60 text-left flex items-center justify-between gap-2 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-neutral-800">
                  {selectedDocument === 'passport'
                    ? 'Passport Back / Address Page (Optional)'
                    : 'ID Card Back Side (Recommended)'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Cross-checks back address &amp; barcode against front details
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-white border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                Add Back
              </span>
            </button>
          ) : (
            <div className="w-full p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-[12px] font-medium text-neutral-800 truncate">
                  Back side: {documentBackFile.name}
                </span>
              </div>
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => {
                  setUploadedDocumentBack(null, null);
                  if (backFileInputRef.current) backFileInputRef.current.value = '';
                }}
                className="p-1 rounded-full hover:bg-white text-neutral-500"
                aria-label="Remove back document"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Analyzing status banner */}
        {isAnalyzing && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-800">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 animate-pulse" />
            <span>Analyzing document with Gemini AI...</span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-700 text-[12.5px] leading-snug">
            <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        <label className="mt-4 flex items-start space-x-2.5 px-1 text-[12px] text-neutral-500 leading-relaxed">
          <input
            type="checkbox"
            checked={consentAccepted}
            disabled={isAnalyzing}
            onChange={(event) => setConsentAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-neutral-600"
          />
          <span>
            I agree to process this document image, live selfie, and liveness check using Gemini AI to verify my identity.
            If automated verification is busy or unavailable, your submission may be queued for manual review by authorized Identity Review administrators, and verification records are stored securely.
          </span>
        </label>
      </div>

      {/* Action Buttons & Bottom Link */}
      <div className="mt-6 space-y-3.5">
        <button
          onClick={handleContinue}
          disabled={isAnalyzing}
          type="button"
          className="w-full py-3.5 px-4 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 disabled:bg-neutral-400 text-white font-semibold text-[15px] rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing document with Gemini AI...</span>
            </>
          ) : (
            'Continue'
          )}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => alert("Need assistance? Please ensure your document has adequate lighting, without reflections or blur.")}
            className="text-[13.5px] font-medium text-neutral-600 hover:text-neutral-700 hover:underline cursor-pointer"
          >
            Need help?
          </button>
        </div>
      </div>
    </div>
  );
}
