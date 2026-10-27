import React, { useEffect, useRef, useState } from 'react';
import { Shield, Check, Loader2 } from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import StepIndicator from '../../components/StepIndicator';
import {
  isVerificationFetchError,
  VERIFICATION_CONNECTION_ERROR,
} from '../../utils/verificationErrors';

function imageDataUrlToBlob(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z\d+/]+=*)$/i.exec(dataUrl);
  if (!match) throw new Error('The camera selfie could not be prepared. Please try again.');

  const binary = window.atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: match[1] });
}

/**
 * Step 4: Verifying your identity (Processing)
 * Screen 4 in reference mockup
 * Features animated circular spinner with central shield, and real-time step checklist
 */
export default function ProcessingStep() {
  const {
    goToStep,
    STEPS,
    setVerificationResult,
    documentFile,
    selfieImage,
    recordedVideo,
    livenessSessionId,
    consentAccepted,
    setFailureReason,
    setFailureType,
  } = useVerification();

  const [documentChecked, setDocumentChecked] = useState(false);
  const [faceMatched, setFaceMatched] = useState(false);
  const [securityValidated, setSecurityValidated] = useState(false);
  const requestStarted = useRef(false);

  useEffect(() => {
    if (requestStarted.current) return undefined;
    requestStarted.current = true;
    let active = true;
    const controller = new AbortController();

    const finish = (result) => {
      if (!active) return;
      setVerificationResult(result);
      goToStep(result === 'success' ? STEPS.SUCCESS : STEPS.FAILED);
    };

    const submitVerification = async () => {
      if (!documentFile || !recordedVideo || !livenessSessionId ||
          typeof selfieImage !== 'string' || !selfieImage.startsWith('data:image/')) {
        setFailureReason('Complete the live camera challenges and recording before starting verification.');
        finish('failed');
        return;
      }
      if (!consentAccepted) {
        setFailureReason('Consent is required before biometric processing.');
        finish('failed');
        return;
      }

      try {
        const selfieBlob = imageDataUrlToBlob(selfieImage);
        const body = new FormData();
        body.append('document', documentFile, documentFile.name || 'document-image');
        body.append('selfie', selfieBlob, 'selfie-image');
        body.append('recording', recordedVideo, recordedVideo.name);
        body.append('livenessSessionId', livenessSessionId);
        body.append('consent', 'true');
        setDocumentChecked(true);

        let response;
        try {
          response = await fetch('/api/verification/face-match', {
            method: 'POST',
            credentials: 'include',
            body,
            signal: controller.signal,
          });
        } catch (error) {
          if (error.name === 'AbortError') throw error;
          if (isVerificationFetchError(error)) {
            setFailureType('connection');
            throw new Error(VERIFICATION_CONNECTION_ERROR);
          }
          throw error;
        }
        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error('The verification service returned an invalid response.');
        }
        if (!response.ok) {
          const error = new Error(result.error || 'The verification service is unavailable.');
          error.failureType = response.status === 429 || response.status >= 500
            ? 'service'
            : 'verification';
          throw error;
        }
        if (result.success !== true || typeof result.isMatch !== 'boolean') {
          throw new Error('The verification service returned an invalid result.');
        }

        setFaceMatched(true);
        setSecurityValidated(true);
        if (result.isMatch) {
          setFailureReason('');
          setFailureType('verification');
          finish('success');
          return;
        }
        setFailureType('verification');
        setFailureReason(
          result.reason === 'liveness_check_failed'
            ? 'The selfie could not pass the available liveness check. Please capture a new selfie in good lighting.'
            : result.reason === 'face_mismatch'
              ? 'The face in the selfie did not match the face in the document image.'
              : 'Use a clear image showing one face in the document and a live selfie.'
        );
        finish('failed');
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (isVerificationFetchError(error) || error.message === VERIFICATION_CONNECTION_ERROR) {
          setFailureType('connection');
          setFailureReason(VERIFICATION_CONNECTION_ERROR);
        } else {
          setFailureType(error.failureType || 'verification');
          setFailureReason(error.message || 'The verification service is temporarily unavailable.');
        }
        finish('failed');
      }
    };

    submitVerification();
    return () => {
      active = false;
      requestStarted.current = false;
      controller.abort();
    };
  }, [
    consentAccepted,
    documentFile,
    goToStep,
    livenessSessionId,
    selfieImage,
    recordedVideo,
    setFailureReason,
    setFailureType,
    setVerificationResult,
    STEPS.FAILED,
    STEPS.SUCCESS,
  ]);

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-6 select-none">
      <div>
        {/* Top Stepper - Exactly matching reference Screen 4 (No navbar header) */}
        <StepIndicator currentStep={4} totalSteps={5} className="pt-2 pb-1" />

        {/* Central Circular Progress Spinner Ring with Blue Shield */}
        <div className="w-full flex items-center justify-center my-8">
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Soft blue central background */}
            <div className="absolute inset-2 rounded-full bg-blue-50/80 flex items-center justify-center">
              <Shield className="w-12 h-12 text-blue-600 animate-pulse" strokeWidth={1.75} />
            </div>

            {/* Rotating SVG Spinner Arc */}
            <svg
              className="absolute inset-0 w-full h-full animate-spin"
              viewBox="0 0 100 100"
              style={{ animationDuration: '2.5s' }}
            >
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="#E2E8F0"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                stroke="#2563EB"
                strokeWidth="4"
                strokeDasharray="90 190"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>

        {/* Title & Guidance */}
        <div className="text-center mb-7">
          <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-snug">
            Checking the face match
          </h2>
          <p className="text-[13.5px] text-slate-500 font-normal mt-2 leading-relaxed px-4">
            Images are processed for this check and are not saved.
          </p>
        </div>

        {/* Verification Checklist Card */}
        <div className="w-full p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-4">
          {/* Check 1: Document check */}
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                documentChecked
                  ? 'bg-blue-600 text-white scale-100'
                  : 'bg-blue-100 text-blue-600 animate-pulse'
              }`}
            >
              {documentChecked ? (
                <Check className="w-3.5 h-3.5" strokeWidth={2.8} />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              )}
            </div>
            <span className={`text-[14px] font-medium transition-colors ${documentChecked ? 'text-slate-800' : 'text-slate-500'}`}>
              Preparing document image
            </span>
          </div>

          {/* Check 2: Face matching */}
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                faceMatched
                  ? 'bg-blue-600 text-white scale-100'
                  : documentChecked
                  ? 'bg-blue-100 text-blue-600 animate-pulse'
                  : 'bg-slate-100 text-slate-300'
              }`}
            >
              {faceMatched ? (
                <Check className="w-3.5 h-3.5" strokeWidth={2.8} />
              ) : documentChecked ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              )}
            </div>
            <span className={`text-[14px] font-medium transition-colors ${faceMatched ? 'text-slate-800' : 'text-slate-500'}`}>
              Comparing faces
            </span>
          </div>

          {/* Check 3: Security validation */}
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
                securityValidated
                  ? 'bg-blue-600 text-white scale-100'
                  : faceMatched
                  ? 'bg-blue-100 text-blue-600 animate-pulse'
                  : 'bg-slate-100 text-slate-300'
              }`}
            >
              {securityValidated ? (
                <Check className="w-3.5 h-3.5" strokeWidth={2.8} />
              ) : faceMatched ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              )}
            </div>
            <span className={`text-[14px] font-medium transition-colors ${securityValidated ? 'text-slate-800' : 'text-slate-500'}`}>
              Checking passive liveness
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 text-center text-[12px] text-slate-400">
        The face match does not verify document authenticity.
      </div>
    </div>
  );
}
