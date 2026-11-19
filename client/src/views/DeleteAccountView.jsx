import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  LogIn,
  Mail,
  Trash2
} from 'lucide-react';
import { PLATFORM_DOMAIN, SUPPORT_EMAIL, getPlatformUrl } from '../config/platformConfig';
import { getAuthUrl } from '../utils/navigation';
import { supportFetch } from '../utils/supportFetch';

const INPUT_CLASS = 'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-500';
const SECONDARY_BTN_CLASS = 'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';

export default function DeleteAccountView({
  currentUser,
  onBack,
  onNavigate,
  onAccountDeleted,
}) {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const domain = PLATFORM_DOMAIN || 'tiwlo.com';
  const contactEmail = SUPPORT_EMAIL || 'support@tiwlo.com';
  const deletionUrl = `https://${domain}/delete-account`;
  const hasPassword = currentUser?.hasPassword !== false;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(deletionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSignIn = () => {
    const returnTo = typeof window !== 'undefined' ? window.location.href : deletionUrl;
    window.location.assign(getAuthUrl(`/login?return_to=${encodeURIComponent(returnTo)}`));
  };

  const handleRequestOtp = async () => {
    setError('');
    setSendingOtp(true);
    try {
      const response = await supportFetch('/api/user/account/otp-request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Could not send Email OTP.');
      }
      setOtpToken(data.otpToken || '');
      setOtpMaskedEmail(data.emailMasked || currentUser?.email || 'your email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send Email OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpToken || !/^\d{6}$/.test(otpCode.trim())) {
      setError('Request an Email OTP and enter the 6-digit verification code.');
      return;
    }
    if (confirmation.trim().toUpperCase() !== 'DELETE') {
      setError('Type DELETE to confirm account deletion.');
      return;
    }
    if (hasPassword && !password.trim()) {
      setError('Enter your account password to confirm.');
      return;
    }

    setDeleting(true);
    try {
      const response = await supportFetch('/api/user/account/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: confirmation.trim(),
          otpToken,
          otpCode: otpCode.trim(),
          password: password || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Could not delete account.');
      }

      try {
        localStorage.removeItem('stockpro_session');
        localStorage.removeItem('stockpro_user');
        sessionStorage.clear();
      } catch {}

      setDeleted(true);
      onAccountDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className={SECONDARY_BTN_CLASS}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <a href={getPlatformUrl('/')} className={SECONDARY_BTN_CLASS}>
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Home</span>
              </a>
            )}
            <img src="/tiwlo-light-logo.png" alt="Tiwlo" className="h-5 w-auto object-contain dark:hidden" />
            <img src="/tiwlo-dark-bg-logo.png" alt="Tiwlo" className="hidden h-5 w-auto object-contain dark:block" />
          </div>

          <a
            href="/privacy-policy"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                try {
                  window.history.pushState(null, '', '/privacy-policy');
                } catch {}
                onNavigate('privacy-policy');
              }
            }}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
          >
            Privacy Policy
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <div className="border-b border-neutral-200/80 px-6 py-5 dark:border-neutral-800">
            <h1 className="text-base font-bold text-neutral-950 dark:text-white">
              Delete Tiwlo &amp; PICK Account
            </h1>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Deactivate and lock your Tiwlo, PICK, and PICK Delivery account access with Email OTP verification.
            </p>
          </div>

          <div className="divide-y divide-neutral-200/80 text-xs text-neutral-700 dark:divide-neutral-800 dark:text-neutral-300">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Account Deletion URL
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-neutral-900 dark:text-neutral-100">
                  {deletionUrl}
                </p>
              </div>
              <button type="button" onClick={handleCopyLink} className={SECONDARY_BTN_CLASS}>
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="space-y-1.5 px-6 py-4 leading-relaxed">
              <p className="font-semibold text-neutral-950 dark:text-white">What happens after deletion:</p>
              <ul className="list-disc space-y-1 pl-5 text-neutral-600 dark:text-neutral-400">
                <li>Your Tiwlo, PICK (`com.pick.tiwlo`), and PICK Delivery (`com.pick.delivery`) sessions are revoked and login is permanently blocked.</li>
                <li>Billing history, invoices, and completed order records are retained securely for accounting and legal compliance.</li>
              </ul>
            </div>

            {deleted ? (
              <div className="px-6 py-5 text-emerald-700 dark:text-emerald-400">
                <p className="font-semibold">Account deleted.</p>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                  Your account has been deleted and can no longer be used to sign in.
                </p>
              </div>
            ) : !currentUser ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                <p className="text-neutral-600 dark:text-neutral-400">
                  Sign in to verify your email with OTP and delete your account.
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href={`mailto:${contactEmail}?subject=Account%20Deletion%20Request`}
                    className="font-medium text-neutral-600 hover:underline dark:text-neutral-400"
                  >
                    {contactEmail}
                  </a>
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    <LogIn className="size-3.5" />
                    <span>Sign in to Delete</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDelete} className="space-y-4 px-6 py-5">
                <p className="text-neutral-600 dark:text-neutral-400">
                  Signed in as <span className="font-semibold text-neutral-950 dark:text-white">{currentUser.email}</span>
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {otpMaskedEmail
                      ? `OTP sent to ${otpMaskedEmail}`
                      : 'Verify with a 6-digit Email OTP before deleting.'}
                  </span>
                  <button
                    type="button"
                    disabled={sendingOtp}
                    onClick={handleRequestOtp}
                    className={SECONDARY_BTN_CLASS}
                  >
                    {sendingOtp ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                    <span>{otpToken ? 'Resend Email OTP' : 'Send Email OTP'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-700 dark:text-neutral-300">
                      6-Digit Email OTP
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className={`${INPUT_CLASS} font-mono tracking-[0.2em]`}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-700 dark:text-neutral-300">
                      Type <span className="font-mono text-rose-600 dark:text-rose-400">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder="DELETE"
                      className={`${INPUT_CLASS} font-mono`}
                    />
                  </div>
                </div>

                {hasPassword && (
                  <div>
                    <label className="mb-1.5 block font-semibold text-neutral-700 dark:text-neutral-300">
                      Account Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={INPUT_CLASS}
                    />
                  </div>
                )}

                {error && (
                  <p className="font-medium text-rose-600 dark:text-rose-400">{error}</p>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={deleting}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    <span>{deleting ? 'Deleting...' : 'Delete Account'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
