import React, { useEffect, useId, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  X
} from 'lucide-react';

function getDefaultApiOrigin() {
  if (typeof window === 'undefined') return '';
  if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) {
    return 'http://localhost:5000';
  }
  return window.location.origin;
}

function buildAuthHeaders(headers = {}) {
  const merged = new Headers(headers);
  merged.set('Content-Type', 'application/json');
  if (!merged.has('Authorization') && typeof window !== 'undefined') {
    const token = window.localStorage?.getItem('stockpro_session');
    if (token) merged.set('Authorization', `Bearer ${token}`);
  }
  return merged;
}

function isFourToEightDigits(value) {
  return /^\d{4,8}$/.test(String(value || '').trim());
}

/**
 * Mandatory, non-dismissible full-screen Security PIN setup gate shown to
 * any admin or support staff member who has not yet configured a PIN.
 */
export function AdminPinMandatoryPage({
  currentUser,
  onSuccess,
  onLogout,
  apiOrigin
}) {
  const resolvedOrigin = (apiOrigin || getDefaultApiOrigin()).replace(/\/+$/, '');
  const [step, setStep] = useState(1);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [secondConfirmation, setSecondConfirmation] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinInputId = useId();
  const confirmInputId = useId();
  const finalInputId = useId();

  const handleContinueToFinalStep = (e) => {
    e.preventDefault();
    setError('');
    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();
    if (!isFourToEightDigits(cleanPin)) {
      setError('Security PIN must be 4 to 8 numeric digits.');
      return;
    }
    if (cleanPin !== cleanConfirm) {
      setError('Security PIN and confirmation PIN do not match.');
      return;
    }
    setSecondConfirmation('');
    setStep(2);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanPin = pin.trim();
    const cleanSecond = secondConfirmation.trim();
    if (!isFourToEightDigits(cleanSecond)) {
      setError('Re-enter your 4 to 8 digit Security PIN to finish setup.');
      return;
    }
    if (cleanSecond !== cleanPin) {
      setError('Final confirmation PIN does not match your chosen PIN.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await globalThis.fetch(`${resolvedOrigin}/api/admin/security-pin/setup`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          pin: cleanPin,
          confirmPin: confirmPin.trim(),
          secondConfirmation: cleanSecond,
          confirmedTwice: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not configure Security PIN.');
      }
      onSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Could not save Security PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[260] flex min-h-screen w-full items-center justify-center overflow-y-auto bg-neutral-100/95 p-3 sm:p-6 dark:bg-neutral-950/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Mandatory Admin Security PIN Setup"
    >
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Card Header */}
        <div className="border-b border-neutral-100 px-5 py-5 sm:px-6 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-[#149642] dark:text-[#1ED760]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  Mandatory Security Gate
                </span>
                <h1 className="mt-1 truncate text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                  Set Admin Security PIN
                </h1>
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              Step {step} of 2
            </span>
          </div>

          <p className="mt-3 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Protect sensitive Tiwlo Admin actions with a personal 4–8 digit Security PIN. Once set, sensitive actions verify instantly with your PIN instead of sending email OTPs.
          </p>

          {currentUser?.email && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-300">
              <Lock className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <span className="truncate font-medium">{currentUser.email}</span>
            </div>
          )}
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-2 gap-2 px-5 pt-4 sm:px-6">
          <div className={`h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-[#1ED760]' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
          <div className={`h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-[#1ED760]' : 'bg-neutral-200 dark:bg-neutral-800'}`} />
        </div>

        {/* Body Form */}
        <div className="px-5 py-5 sm:px-6">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleContinueToFinalStep} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={pinInputId} className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Create Security PIN (4–8 digits)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  id={pinInputId}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter 4–8 numeric digits"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor={confirmInputId} className="mb-1.5 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Confirm Security PIN
                </label>
                <input
                  id={confirmInputId}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Re-enter PIN"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-[#18b953] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/40"
              >
                <span>Continue to Final Confirmation</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="rounded-xl border border-[#1ED760]/30 bg-[#1ED760]/10 px-3.5 py-3 text-xs text-neutral-800 dark:text-neutral-200">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#149642] dark:text-[#1ED760]" />
                  <span>Final Confirmation</span>
                </div>
                <p className="mt-1 leading-relaxed text-neutral-600 dark:text-neutral-300">
                  Re-enter your PIN one more time to confirm and lock your Admin Console. You cannot dismiss this gate until your PIN is saved.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor={finalInputId} className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Re-enter Security PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  id={finalInputId}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={8}
                  autoFocus
                  value={secondConfirmation}
                  onChange={(e) => setSecondConfirmation(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Re-enter your PIN"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setError('');
                    setStep(1);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-[#18b953] disabled:opacity-60"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>{submitting ? 'Locking Console...' : 'Set Security PIN & Unlock Admin'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer with Sign Out only */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-5 py-3.5 sm:px-6 dark:border-neutral-800">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Stored with scrypt cryptographic hashing
          </span>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shadcn-styled Admin Security PIN Challenge Modal with inline "Forgot PIN?" Email OTP recovery.
 * Never triggers Email OTP automatically unless the admin explicitly clicks "Forgot PIN?".
 */
export function AdminPinChallengeModal(props) {
  if (!props.open) return null;
  return <AdminPinChallengeDialogContent {...props} />;
}

function AdminPinChallengeDialogContent({
  title = 'Confirm Admin Action',
  description = 'Enter your Admin Security PIN to authorize this sensitive change.',
  headers,
  apiOrigin,
  onSuccess,
  onCancel
}) {
  const resolvedOrigin = (apiOrigin || getDefaultApiOrigin()).replace(/\/+$/, '');
  const [mode, setMode] = useState('pin'); // 'pin' | 'forgot'
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');

  const pinInputRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const timer = setTimeout(() => pinInputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const handlePinVerify = async (e) => {
    e.preventDefault();
    setError('');
    const cleanPin = pin.trim();
    if (!isFourToEightDigits(cleanPin)) {
      setError('Enter your 4 to 8 digit Security PIN.');
      return;
    }

    try {
      setLoading(true);
      const res = await globalThis.fetch(`${resolvedOrigin}/api/admin/security-pin/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(headers),
        body: JSON.stringify({ pin: cleanPin })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.grant) {
        throw new Error(data.error || 'Could not verify Security PIN.');
      }
      onSuccess?.(data.grant);
    } catch (err) {
      setError(err.message || 'Incorrect Security PIN.');
    } finally {
      setLoading(false);
    }
  };

  const triggerForgotOtpRequest = async () => {
    setError('');
    try {
      setSendingOtp(true);
      const res = await globalThis.fetch(`${resolvedOrigin}/api/admin/security-pin/forgot-request`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(headers),
        body: '{}'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.tempToken) {
        throw new Error(data.error || 'Could not send PIN recovery OTP.');
      }
      setOtpToken(data.tempToken);
      setEmailMasked(data.emailMasked || 'your verified email');
      setMode('forgot');
    } catch (err) {
      setError(err.message || 'Could not send PIN recovery email.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleForgotResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpCode.trim()) {
      setError('Enter the 6-digit OTP sent to your email.');
      return;
    }
    if (!isFourToEightDigits(newPin.trim())) {
      setError('New Security PIN must be 4 to 8 numeric digits.');
      return;
    }
    if (newPin.trim() !== confirmNewPin.trim()) {
      setError('New Security PIN and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await globalThis.fetch(`${resolvedOrigin}/api/admin/security-pin/reset`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(headers),
        body: JSON.stringify({
          tempToken: otpToken,
          otpCode: otpCode.trim(),
          newPin: newPin.trim(),
          confirmPin: confirmNewPin.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.grant) {
        throw new Error(data.error || 'Could not reset Security PIN.');
      }
      onSuccess?.(data.grant);
    } catch (err) {
      setError(err.message || 'Could not reset Security PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-[#149642] dark:text-[#1ED760]">
              {mode === 'forgot' ? <Mail className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                {mode === 'forgot' ? 'Reset Security PIN via Email OTP' : title}
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {mode === 'forgot' ? 'One-time email verification' : 'Instant PIN verification · No email OTP'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => onCancel?.()}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <div className="mb-3.5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'pin' ? (
            <form onSubmit={handlePinVerify} className="space-y-4">
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {description}
              </p>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Security PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  >
                    {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showPin ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  ref={pinInputRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter 4–8 digit PIN"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={sendingOtp || loading}
                  onClick={triggerForgotOtpRequest}
                  className="inline-flex items-center gap-1 font-semibold text-[#149642] hover:underline disabled:opacity-50 dark:text-[#1ED760]"
                >
                  {sendingOtp ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                  <span>{sendingOtp ? 'Sending Email OTP...' : 'Forgot PIN?'}</span>
                </button>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCancel?.()}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-5 py-2 text-xs sm:text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-[#18b953] disabled:opacity-60"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>{loading ? 'Verifying...' : 'Confirm Action'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotResetSubmit} className="space-y-3.5">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-300">
                Enter the 6-digit recovery OTP sent to <span className="font-semibold">{emailMasked}</span> and set a new 4–8 digit Security PIN.
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Email OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  New Security PIN (4–8 digits)
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter new 4–8 digit PIN"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Confirm New PIN
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Re-enter new PIN"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-base sm:text-sm tracking-widest text-neutral-900 placeholder:tracking-normal placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/25 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setMode('pin');
                  }}
                  className="inline-flex items-center gap-1 font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to PIN</span>
                </button>
                <button
                  type="button"
                  disabled={sendingOtp}
                  onClick={triggerForgotOtpRequest}
                  className="font-semibold text-[#149642] hover:underline disabled:opacity-50 dark:text-[#1ED760]"
                >
                  {sendingOtp ? 'Resending...' : 'Resend Email OTP'}
                </button>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCancel?.()}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-5 py-2 text-xs sm:text-sm font-semibold text-neutral-950 shadow-sm transition hover:bg-[#18b953] disabled:opacity-60"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>{loading ? 'Resetting...' : 'Reset PIN & Proceed'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Self-mounting imperative helper used by `requestSensitiveActionGrant` inside the Admin Panel.
 * Opens the Shadcn PIN Challenge Modal (with Forgot PIN OTP support) and resolves with the
 * `sensitive_action_grant` token without sending any Email OTP unless Forgot PIN is clicked.
 */
export function requestAdminPinGrant(headers = {}, apiOrigin = undefined, options = {}) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Admin Security PIN modal requires a browser context.'));
  }

  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.setAttribute('data-tiwlo-admin-pin-portal', 'true');
    document.body.appendChild(container);
    const root = createRoot(container);

    let settled = false;
    const cleanup = () => {
      try {
        root.unmount();
      } catch {
        // ignore unmount race
      }
      container.remove();
    };

    const handleSuccess = (grant) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(grant);
    };

    const handleCancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Security PIN verification was cancelled.'));
    };

    root.render(
      <AdminPinChallengeModal
        open
        title={options.title || 'Confirm Admin Action'}
        description={options.description || 'Enter your Admin Security PIN to authorize this sensitive change.'}
        headers={headers}
        apiOrigin={apiOrigin}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    );
  });
}

export default AdminPinMandatoryPage;
