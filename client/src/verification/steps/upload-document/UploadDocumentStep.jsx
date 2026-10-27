import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, X, AlertCircle } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';
import { UploadHeroIllustration } from '../../components/DocumentIllustrations';

/**
 * Step 2: Upload your document
 * Screen 2 in reference mockup
 */
export default function UploadDocumentStep({ onNext = null, onBack = null }) {
  const {
    selectedDocument,
    documentFile,
    setUploadedDocument,
    consentAccepted,
    setConsentAccepted,
    nextStep,
    prevStep,
  } = useVerification();

  const fileInputRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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
    setUploadedDocument(null, null);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleContinue = () => {
    if (!documentFile) {
      setErrorMessage('Upload a clear image of your selected document to continue.');
      return;
    }
    if (!consentAccepted) {
      setErrorMessage('Please agree to the temporary biometric processing before continuing.');
      return;
    }

    if (onNext) {
      onNext();
    } else {
      nextStep();
    }
  };

  const handleBack = () => {
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
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-snug">
            Upload your document
          </h2>
          <p className="text-[13.5px] text-slate-500 font-normal mt-2 leading-relaxed px-2">
            Take a clear photo or upload a scanned copy of your passport, national ID card or Aadhaar card. Make sure all details are visible and readable.
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
                ? 'border-blue-500 bg-blue-50/70 shadow-sm'
                : 'border-blue-300/80 bg-slate-50/60 hover:bg-blue-50/30 hover:border-blue-400'
            }`}
          >
            {/* Blue Cloud Upload Icon */}
            <div className="w-12 h-12 rounded-full bg-blue-100/70 flex items-center justify-center text-blue-600 mb-3 shadow-2xs">
              <UploadCloud className="w-6 h-6 text-blue-600" strokeWidth={2} />
            </div>

            <p className="text-[15px] font-semibold text-slate-800">
              Tap to upload
            </p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              JPG, PNG or WebP • Max 10MB
            </p>
          </div>
        ) : (
          /* File Uploaded Preview Card */
          <div className="w-full p-4 rounded-2xl border border-blue-200 bg-blue-50/40 flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-3 min-w-0 pr-2">
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 truncate">
                  {documentFile.name || `${selectedDocument.toUpperCase()}_document.jpg`}
                </p>
                <p className="text-[12px] text-slate-500">
                  {documentFile.size ? `${(documentFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Ready to verify'}
                </p>
              </div>
            </div>

            <button
              onClick={handleRemoveFile}
              type="button"
              className="p-1.5 rounded-full hover:bg-blue-100 text-slate-500 hover:text-slate-700 transition-colors"
              aria-label="Remove document"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mt-3 flex items-center space-x-1.5 text-red-600 text-[12px] px-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        <label className="mt-4 flex items-start space-x-2.5 px-1 text-[12px] text-slate-500 leading-relaxed">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
          />
          <span>
            I agree to temporarily process this document image and selfie to compare their faces.
            Images are not saved. This check does not confirm that the document is genuine.
          </span>
        </label>
      </div>

      {/* Action Buttons & Bottom Link */}
      <div className="mt-6 space-y-3.5">
        <button
          onClick={handleContinue}
          type="button"
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-[15px] rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          Continue
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => alert("Need assistance? Please ensure your document has adequate lighting, without reflections or blur.")}
            className="text-[13.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
          >
            Need help?
          </button>
        </div>
      </div>
    </div>
  );
}
