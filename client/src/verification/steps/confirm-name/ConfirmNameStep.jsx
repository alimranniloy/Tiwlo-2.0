import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { useVerification } from '../../context/VerificationContext';
import VerificationHeader from '../../components/VerificationHeader';
import StepIndicator from '../../components/StepIndicator';
import {
  isVerificationFetchError,
  VERIFICATION_CONNECTION_ERROR,
} from '../../utils/verificationErrors';

function normalizeDateInput(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return isoMatch ? isoMatch[1] : '';
}

/**
 * Pre-Verification Name & Date of Birth Check / Correction Step
 * Appears between Document Upload and Live Selfie when Gemini AI detects
 * a name/DOB mismatch, missing account DOB, or extracted identity details to confirm.
 */
export default function ConfirmNameStep({ onNext = null, onBack = null }) {
  const {
    STEPS,
    verificationAccessToken,
    documentAnalysis,
    setDocumentAnalysis,
    goToStep,
    prevStep,
  } = useVerification();

  const extracted = documentAnalysis?.extracted || {};
  const accountName = documentAnalysis?.accountName || '';
  const accountDob = normalizeDateInput(
    documentAnalysis?.accountDateOfBirth || documentAnalysis?.accountDob || ''
  );
  const detectedName = extracted?.fullName || '';
  const detectedDob = normalizeDateInput(extracted?.dateOfBirth || extracted?.dob || '');
  const detectedAddress = extracted?.address || '';
  const detectedDocNumber = extracted?.documentNumber || '';

  const hasNameMismatch = Boolean(documentAnalysis?.nameMismatch);
  const hasDobMismatch = Boolean(documentAnalysis?.dobMismatch);
  const missingAccountDob = !accountDob;
  const hasAnyMismatch = Boolean(
    documentAnalysis?.needsNameCorrection || hasNameMismatch || hasDobMismatch || missingAccountDob
  );

  const [fullName, setFullName] = useState(() => detectedName || accountName || '');
  const [dateOfBirth, setDateOfBirth] = useState(() => detectedDob || accountDob || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const advanceTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const handleBack = () => {
    if (isSubmitting) return;
    if (onBack) {
      onBack();
    } else {
      prevStep();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setErrorMessage('Please enter your full legal name as shown on your document.');
      return;
    }

    const trimmedDob = dateOfBirth.trim();
    if ((hasDobMismatch || missingAccountDob || Boolean(detectedDob)) && !trimmedDob) {
      setErrorMessage('Please enter your date of birth as shown on your document.');
      return;
    }
    if (trimmedDob && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDob)) {
      setErrorMessage('Please enter a valid date of birth (YYYY-MM-DD).');
      return;
    }

    setErrorMessage('');
    setConfirmationMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/verification/confirm-name', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(verificationAccessToken
            ? { Authorization: `Bearer ${verificationAccessToken}` }
            : {}),
        },
        body: JSON.stringify({
          fullName: trimmedName,
          dateOfBirth: trimmedDob || undefined,
          address: detectedAddress || undefined,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          result?.error || `Could not update your details (HTTP ${response.status}).`
        );
      }

      setDocumentAnalysis((prev) =>
        prev
          ? {
              ...prev,
              accountName: result?.fullName || trimmedName,
              accountDateOfBirth: result?.dateOfBirth || trimmedDob || prev.accountDateOfBirth,
              accountDob: result?.dateOfBirth || trimmedDob || prev.accountDob,
              needsNameCorrection: false,
              nameMismatch: false,
              dobMismatch: false,
            }
          : prev
      );

      setConfirmationMessage('Account details updated. Continuing to live selfie check...');

      advanceTimerRef.current = window.setTimeout(() => {
        if (onNext) {
          onNext({ fullName: trimmedName, dateOfBirth: trimmedDob, address: detectedAddress });
        } else {
          goToStep(STEPS.CAPTURE_SELFIE);
        }
      }, 450);
    } catch (error) {
      if (isVerificationFetchError(error)) {
        setErrorMessage(VERIFICATION_CONNECTION_ERROR);
      } else {
        setErrorMessage(error.message || 'Could not update your details. Please try again.');
      }
      setIsSubmitting(false);
    }
  };

  const mismatchBadgeText = hasNameMismatch && hasDobMismatch
    ? 'Name & date of birth mismatch detected'
    : hasNameMismatch
      ? 'Name mismatch detected'
      : hasDobMismatch
        ? 'Date of birth mismatch detected'
        : missingAccountDob
          ? 'Date of birth needed on account'
          : 'Confirm extracted details';

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pb-6 pt-1 select-none">
      <div>
        <VerificationHeader
          title="Identity Verification"
          showBack={true}
          onBack={handleBack}
        />
        <StepIndicator currentStep={2} totalSteps={5} />

        <div className="mt-4 mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/80">
            <UserCheck className="h-6 w-6" />
          </div>

          {hasAnyMismatch && (
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11.5px] font-semibold text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>{mismatchBadgeText}</span>
            </div>
          )}

          <h2 className="text-[23px] font-bold text-neutral-900 tracking-tight leading-snug">
            Confirm your identity details
          </h2>
          <p className="text-[13.5px] text-neutral-500 font-normal mt-1.5 leading-relaxed px-2">
            {hasNameMismatch || hasDobMismatch
              ? 'Details on your uploaded document differ from your Tiwlo account. Confirm or update your name and date of birth below before starting the Face ID liveness check.'
              : 'Review and confirm your legal name and date of birth detected from your document before starting the Face ID liveness check.'}
          </p>
        </div>

        {/* Side-by-Side Comparison Card (Account Value vs Document Value) */}
        <div className="mb-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 space-y-3 shadow-2xs">
          {/* Full Name comparison */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200/80 bg-white px-3.5 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Account name
              </p>
              <p className="mt-0.5 text-[13.5px] font-semibold text-neutral-800 truncate">
                {accountName || 'Not set'}
              </p>
            </div>
            <div className={`rounded-xl border px-3.5 py-2.5 ${
              hasNameMismatch
                ? 'border-amber-200 bg-amber-50/60'
                : 'border-neutral-200/80 bg-white'
            }`}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Document name (Gemini)
              </p>
              <p className="mt-0.5 text-[13.5px] font-semibold text-neutral-900 truncate">
                {detectedName || 'Not detected'}
              </p>
            </div>
          </div>

          {/* Date of Birth comparison */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className={`rounded-xl border px-3.5 py-2.5 ${
              missingAccountDob
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-neutral-200/80 bg-white'
            }`}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Account date of birth
              </p>
              <p className="mt-0.5 text-[13.5px] font-semibold text-neutral-800">
                {accountDob || 'Not set'}
              </p>
            </div>
            <div className={`rounded-xl border px-3.5 py-2.5 ${
              hasDobMismatch
                ? 'border-amber-200 bg-amber-50/60'
                : 'border-neutral-200/80 bg-white'
            }`}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Document DOB (Gemini)
              </p>
              <p className="mt-0.5 text-[13.5px] font-semibold text-neutral-900">
                {detectedDob || 'Not detected'}
              </p>
            </div>
          </div>

          {(detectedDocNumber || detectedAddress) && (
            <div className="border-t border-neutral-200/80 pt-3 space-y-2">
              {detectedDocNumber && (
                <div className="flex items-start gap-2 text-[12.5px] text-neutral-600">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <div className="min-w-0">
                    <span className="font-medium text-neutral-500">Document No: </span>
                    <span className="font-semibold text-neutral-800">{detectedDocNumber}</span>
                  </div>
                </div>
              )}
              {detectedAddress && (
                <div className="flex items-start gap-2 text-[12.5px] text-neutral-600">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <div className="min-w-0">
                    <span className="font-medium text-neutral-500">Address: </span>
                    <span className="text-neutral-700">{detectedAddress}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editable Full Name & Date of Birth Form */}
        <form id="confirm-name-form" onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="confirm-full-name"
              className="block text-[13px] font-semibold text-neutral-800 mb-1.5 px-0.5"
            >
              Full Legal Name
            </label>
            <input
              id="confirm-full-name"
              type="text"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              disabled={isSubmitting}
              placeholder="Enter full name exactly as on document"
              autoComplete="name"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[14.5px] font-medium text-neutral-900 placeholder:text-neutral-400 shadow-2xs transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-100 disabled:text-neutral-500"
            />
            {detectedName && fullName.trim() !== detectedName && (
              <button
                type="button"
                onClick={() => setFullName(detectedName)}
                className="mt-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
              >
                Use detected document name ({detectedName})
              </button>
            )}
          </div>

          <div>
            <label
              htmlFor="confirm-date-of-birth"
              className="flex items-center gap-1.5 text-[13px] font-semibold text-neutral-800 mb-1.5 px-0.5"
            >
              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
              <span>Date of Birth</span>
            </label>
            <input
              id="confirm-date-of-birth"
              type="date"
              value={dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                setDateOfBirth(event.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              disabled={isSubmitting}
              autoComplete="bday"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[14.5px] font-medium text-neutral-900 shadow-2xs transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-100 disabled:text-neutral-500"
            />
            {detectedDob && dateOfBirth !== detectedDob && (
              <button
                type="button"
                onClick={() => setDateOfBirth(detectedDob)}
                className="mt-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-900 underline cursor-pointer"
              >
                Use detected document DOB ({detectedDob})
              </button>
            )}
          </div>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {confirmationMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{confirmationMessage}</span>
            </div>
          )}
        </form>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="submit"
          form="confirm-name-form"
          disabled={isSubmitting}
          className="w-full py-3.5 px-4 bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 disabled:bg-neutral-400 text-white font-semibold text-[15px] rounded-xl shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating Details...</span>
            </>
          ) : (
            'Update & Continue to Liveness'
          )}
        </button>

        <button
          type="button"
          onClick={handleBack}
          disabled={isSubmitting}
          className="w-full py-2.5 px-4 text-[13.5px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          Re-upload a different document
        </button>
      </div>
    </div>
  );
}
