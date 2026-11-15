import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Loader2,
  Mail,
  QrCode,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { supportFetch } from '../utils/supportFetch';

const CARD_CLASS = 'rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950';
const SURFACE_CLASS = 'rounded-xl border border-neutral-200/80 bg-[#fafafa] dark:border-neutral-800 dark:bg-neutral-900/50';
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-500';
const PRIMARY_BTN_CLASS = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN_CLASS = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';

const AUTHENTICATOR_APPS = [
  'Google Authenticator',
  '1Password',
  'Authy',
  'Microsoft Authenticator'
];

function syncUserToClientStorage(updatedUser) {
  if (!updatedUser) return;
  try {
    const existingRaw = localStorage.getItem('stockpro_user');
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    localStorage.setItem('stockpro_user', JSON.stringify({ ...existing, ...updatedUser }));
  } catch {
    // Ignore storage errors
  }
  try {
    window.dispatchEvent(new CustomEvent('tiwlo:user-updated', { detail: updatedUser }));
  } catch {
    // Ignore event dispatch errors
  }
}

async function readJsonPayload(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || fallbackMessage);
  }
  return data;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function resolveActiveMethodInfo(status) {
  const totp = Boolean(status.totpEnabled);
  const email = Boolean(status.emailTwoFactorEnabled);
  const method = String(status.activeMethod || '').toLowerCase();

  if (totp && email) {
    return {
      label: 'Authenticator App (TOTP) + Email OTP',
      badge: 'Maximum Protection',
      tone: 'active',
      description: 'Your account is protected with Authenticator App TOTP codes, with Email OTP also enabled.'
    };
  }
  if (totp || method === 'totp' || method === 'authenticator') {
    return {
      label: 'Authenticator App (TOTP)',
      badge: 'Active',
      tone: 'active',
      description: 'Sign-ins require a 6-digit time-based code from your authenticator app.'
    };
  }
  if (email || status.twoFactorEnabled || method === 'email') {
    return {
      label: 'Email OTP 2FA',
      badge: 'Active',
      tone: 'active',
      description: 'Sign-ins from new sessions require a 6-digit verification code sent to your email.'
    };
  }
  return {
    label: 'Off',
    badge: 'Disabled',
    tone: 'off',
    description: 'Two-factor authentication is currently turned off. Enroll an authenticator app or Email OTP below.'
  };
}

/**
 * Dedicated full-page Two-Factor Authentication hub supporting Email OTP 2FA,
 * Authenticator App (TOTP) QR enrollment, and one-time recovery codes.
 */
export default function UserTwoFactorView({
  currentUser,
  onUserUpdated,
  onBack,
  showToast
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [status, setStatus] = useState({
    twoFactorEnabled: Boolean(currentUser?.twoFactorEnabled),
    emailTwoFactorEnabled: Boolean(currentUser?.emailTwoFactorEnabled ?? currentUser?.twoFactorEnabled),
    totpEnabled: Boolean(currentUser?.totpEnabled),
    activeMethod: currentUser?.totpEnabled ? 'totp' : currentUser?.twoFactorEnabled ? 'email' : 'off',
    totpEnrolledAt: currentUser?.totpEnrolledAt || null,
    backupCodesRemaining: Number(currentUser?.backupCodesRemaining || 0)
  });

  // Email 2FA toggle state
  const [togglingEmail2fa, setTogglingEmail2fa] = useState(false);

  // TOTP Setup flow state
  const [startingSetup, setStartingSetup] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyingTotp, setVerifyingTotp] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Recovery codes display state
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Regenerate recovery codes panel
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false);
  const [regenCode, setRegenCode] = useState('');
  const [regenPassword, setRegenPassword] = useState('');
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);

  // Disable TOTP panel
  const [showDisablePanel, setShowDisablePanel] = useState(false);
  const [disableMode, setDisableMode] = useState('totp');
  const [disableCode, setDisableCode] = useState('');
  const [disableRecoveryCode, setDisableRecoveryCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [keepEmail2fa, setKeepEmail2fa] = useState(true);
  const [disablingTotp, setDisablingTotp] = useState(false);

  const hasPassword = currentUser?.hasPassword !== false;

  const syncUserFromStatus = useCallback((nextStatus) => {
    if (!nextStatus) return;
    const mergedUser = {
      ...currentUser,
      twoFactorEnabled: Boolean(nextStatus.twoFactorEnabled),
      emailTwoFactorEnabled: Boolean(nextStatus.emailTwoFactorEnabled),
      totpEnabled: Boolean(nextStatus.totpEnabled),
      activeMethod: nextStatus.activeMethod,
      totpEnrolledAt: nextStatus.totpEnrolledAt || null,
      backupCodesRemaining: Number(nextStatus.backupCodesRemaining || 0)
    };
    syncUserToClientStorage(mergedUser);
    onUserUpdated?.(mergedUser);
  }, [currentUser, onUserUpdated]);

  const applyStatusPayload = useCallback((payload, shouldSyncUser = false) => {
    const src = payload?.status && typeof payload.status === 'object' ? payload.status : payload;
    const next = {
      twoFactorEnabled: Boolean(src?.twoFactorEnabled),
      emailTwoFactorEnabled: Boolean(src?.emailTwoFactorEnabled),
      totpEnabled: Boolean(src?.totpEnabled),
      activeMethod: src?.activeMethod || (src?.totpEnabled ? 'totp' : src?.emailTwoFactorEnabled ? 'email' : 'off'),
      totpEnrolledAt: src?.totpEnrolledAt || null,
      backupCodesRemaining: Number(src?.backupCodesRemaining ?? 0)
    };
    setStatus(next);
    if (shouldSyncUser) {
      syncUserFromStatus(next);
    }
    return next;
  }, [syncUserFromStatus]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await supportFetch('/api/user/account/two-factor/status', { method: 'GET' });
      const data = await readJsonPayload(response, 'Could not load two-factor authentication status.');
      applyStatusPayload(data, false);
    } catch (err) {
      setError(err.message || 'Could not load two-factor authentication status.');
    } finally {
      setLoading(false);
    }
  }, [applyStatusPayload]);

  useEffect(() => {
    void Promise.resolve().then(loadStatus);
  }, [loadStatus]);

  const copyText = async (text, onCopied) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(true);
      setTimeout(() => onCopied(false), 2000);
    } catch {
      setError('Clipboard access is unavailable. Please copy manually.');
    }
  };

  const handleToggleEmailTwoFactor = async () => {
    setError('');
    setSuccessMsg('');
    const nextEnabled = !status.emailTwoFactorEnabled;
    setTogglingEmail2fa(true);
    try {
      const response = await supportFetch('/api/user/account/two-factor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextEnabled })
      });
      const data = await readJsonPayload(response, 'Failed to update Email OTP 2FA.');
      if (data.status || data.twoFactorEnabled !== undefined || data.emailTwoFactorEnabled !== undefined) {
        applyStatusPayload({
          ...status,
          ...data,
          emailTwoFactorEnabled: data.emailTwoFactorEnabled ?? nextEnabled,
          twoFactorEnabled: data.twoFactorEnabled ?? (nextEnabled || status.totpEnabled)
        }, true);
      } else {
        await loadStatus();
      }
      const msg = nextEnabled ? 'Email OTP 2FA enabled.' : 'Email OTP 2FA disabled.';
      setSuccessMsg(msg);
      showToast?.(msg);
    } catch (err) {
      setError(err.message || 'Failed to update Email OTP 2FA.');
    } finally {
      setTogglingEmail2fa(false);
    }
  };

  const handleStartTotpSetup = async () => {
    setError('');
    setSuccessMsg('');
    setStartingSetup(true);
    try {
      const response = await supportFetch('/api/user/account/two-factor/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await readJsonPayload(response, 'Failed to generate authenticator QR code.');
      setSetupData({
        qrCodeDataUrl: data.qrCodeDataUrl || '',
        manualKey: data.manualKey || '',
        otpauthUrl: data.otpauthUrl || '',
        issuer: data.issuer || 'Tiwlo',
        accountName: data.accountName || currentUser?.email || ''
      });
      setVerifyCode('');
      setRecoveryCodes([]);
    } catch (err) {
      setError(err.message || 'Failed to generate authenticator QR code.');
    } finally {
      setStartingSetup(false);
    }
  };

  const handleVerifyTotp = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    const cleanCode = verifyCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setError('Enter the 6-digit code shown in your authenticator app.');
      return;
    }
    setVerifyingTotp(true);
    try {
      const response = await supportFetch('/api/user/account/two-factor/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode })
      });
      const data = await readJsonPayload(response, 'Invalid verification code.');
      const nextCodes = Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
      setRecoveryCodes(nextCodes);
      setSetupData(null);
      setVerifyCode('');
      if (data.status) {
        applyStatusPayload(data.status, true);
      } else {
        const refreshed = await supportFetch('/api/user/account/two-factor/status', { method: 'GET' });
        const refreshedData = await readJsonPayload(refreshed, 'Could not refresh status.');
        applyStatusPayload(refreshedData, true);
      }
      setSuccessMsg('Authenticator App (TOTP) activated. Save your recovery codes now.');
      showToast?.('Authenticator App 2FA activated');
    } catch (err) {
      setError(err.message || 'Verification failed. Check your authenticator clock and code.');
    } finally {
      setVerifyingTotp(false);
    }
  };

  const handleRegenerateRecoveryCodes = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    const cleanCode = regenCode.replace(/\D/g, '').slice(0, 6);
    if (cleanCode.length !== 6) {
      setError('Enter a valid 6-digit Authenticator App code to regenerate recovery codes.');
      return;
    }
    setRegeneratingCodes(true);
    try {
      const response = await supportFetch('/api/user/account/two-factor/recovery-codes/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          ...(regenPassword ? { currentPassword: regenPassword } : {})
        })
      });
      const data = await readJsonPayload(response, 'Failed to regenerate recovery codes.');
      const nextCodes = Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
      setRecoveryCodes(nextCodes);
      setRegenCode('');
      setRegenPassword('');
      setShowRegeneratePanel(false);
      if (data.status) {
        applyStatusPayload(data.status, true);
      } else {
        setStatus((prev) => ({ ...prev, backupCodesRemaining: nextCodes.length || prev.backupCodesRemaining }));
      }
      setSuccessMsg('New recovery codes generated. Previous recovery codes are now invalid.');
      showToast?.('Recovery codes regenerated');
    } catch (err) {
      setError(err.message || 'Failed to regenerate recovery codes.');
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const handleDisableTotp = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanCode = disableCode.replace(/\D/g, '').slice(0, 6);
    const cleanRecovery = disableRecoveryCode.trim();
    if (disableMode === 'totp' && cleanCode.length !== 6) {
      setError('Enter the 6-digit Authenticator App code.');
      return;
    }
    if (disableMode === 'recovery' && !cleanRecovery) {
      setError('Enter one of your unused recovery codes.');
      return;
    }

    setDisablingTotp(true);
    try {
      const response = await supportFetch('/api/user/account/two-factor/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(disableMode === 'totp' ? { code: cleanCode } : { recoveryCode: cleanRecovery }),
          ...(disablePassword ? { currentPassword: disablePassword } : {}),
          keepEmail2fa
        })
      });
      const data = await readJsonPayload(response, 'Failed to disable Authenticator App.');
      setShowDisablePanel(false);
      setDisableCode('');
      setDisableRecoveryCode('');
      setDisablePassword('');
      setRecoveryCodes([]);
      if (data.status) {
        applyStatusPayload(data.status, true);
      } else {
        const refreshed = await supportFetch('/api/user/account/two-factor/status', { method: 'GET' });
        const refreshedData = await readJsonPayload(refreshed, 'Could not refresh status.');
        applyStatusPayload(refreshedData, true);
      }
      setSuccessMsg('Authenticator App (TOTP) has been disabled.');
      showToast?.('Authenticator App disabled');
    } catch (err) {
      setError(err.message || 'Failed to disable Authenticator App.');
    } finally {
      setDisablingTotp(false);
    }
  };

  const handleDownloadRecoveryCodes = () => {
    if (recoveryCodes.length === 0) return;
    const content = [
      'Tiwlo Two-Factor Recovery Codes',
      `Account: ${currentUser?.email || 'Tiwlo User'}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'Store these one-time recovery codes in a safe place. Each code can only be used once.',
      '',
      ...recoveryCodes.map((code, index) => `${String(index + 1).padStart(2, '0')}. ${code}`)
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tiwlo-recovery-codes.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const activeInfo = resolveActiveMethodInfo(status);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-2xl">
              Two-Factor Authentication
            </h1>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Protect your Tiwlo account with an Authenticator App (TOTP) QR setup, one-time recovery codes, or Email OTP.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={loadStatus}
          className={SECONDARY_BTN_CLASS}
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Feedback Banners */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check className="size-4 shrink-0" />
          <span className="flex-1">{successMsg}</span>
        </div>
      )}

      {/* Currently Active 2FA Status Banner */}
      <div className={`${CARD_CLASS} p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                activeInfo.tone === 'active'
                  ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              {activeInfo.tone === 'active' ? <ShieldCheck className="size-6" /> : <ShieldAlert className="size-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Currently Active 2FA
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    activeInfo.tone === 'active'
                      ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {activeInfo.badge}
                </span>
              </div>
              <h2 className="mt-1 text-base font-bold text-neutral-950 dark:text-white">
                {activeInfo.label}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                {activeInfo.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:shrink-0">
            <div className={`${SURFACE_CLASS} px-3.5 py-2.5`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                TOTP Enrolled
              </p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-neutral-950 dark:text-white">
                {status.totpEnabled ? formatDateTime(status.totpEnrolledAt) : 'Not enrolled'}
              </p>
            </div>
            <div className={`${SURFACE_CLASS} px-3.5 py-2.5`}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Recovery Codes
              </p>
              <p className="mt-0.5 text-xs font-bold tabular-nums text-neutral-950 dark:text-white">
                {status.totpEnabled ? `${status.backupCodesRemaining} remaining` : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* One-Time Recovery Codes Display (shown right after TOTP verify or regenerate) */}
      {recoveryCodes.length > 0 && (
        <div className="rounded-xl border-2 border-[#1ED760]/60 bg-[#1ED760]/5 p-5 dark:bg-[#1ED760]/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2.5">
              <KeyRound className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-[#1ED760]" />
              <div>
                <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                  Save Your One-Time Recovery Codes
                </h3>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                  These codes are shown only once. Use any code to regain access if you lose your authenticator device.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(recoveryCodes.join('\n'), setCopiedCodes)}
                className={SECONDARY_BTN_CLASS}
              >
                {copiedCodes ? <Check className="size-3.5 text-[#1ED760]" /> : <Copy className="size-3.5" />}
                <span>{copiedCodes ? 'Copied All' : 'Copy All'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadRecoveryCodes}
                className={PRIMARY_BTN_CLASS}
              >
                <Download className="size-3.5" />
                <span>Download .TXT</span>
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {recoveryCodes.map((code) => (
              <div
                key={code}
                className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-center font-mono text-xs font-semibold tracking-wider text-neutral-950 tabular-nums dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setRecoveryCodes([])}
              className="text-xs font-semibold text-neutral-600 underline hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
            >
              I have securely saved these codes
            </button>
          </div>
        </div>
      )}

      {/* Authenticator App (TOTP) Card */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-[#fafafa] text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <QrCode className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                  Authenticator App (TOTP)
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    status.totpEnabled
                      ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {status.totpEnabled ? 'Enrolled' : 'Recommended'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Scan a cryptographic QR secret with your mobile authenticator app for offline 6-digit verification codes.
              </p>
            </div>
          </div>

          {!status.totpEnabled && !setupData && (
            <button
              type="button"
              disabled={startingSetup || loading}
              onClick={handleStartTotpSetup}
              className={PRIMARY_BTN_CLASS}
            >
              {startingSetup ? <Loader2 className="size-3.5 animate-spin" /> : <Smartphone className="size-3.5" />}
              <span>{startingSetup ? 'Generating QR...' : 'Set Up Authenticator App'}</span>
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Case A: TOTP Not Enrolled & Setup Not Started */}
          {!status.totpEnabled && !setupData && (
            <div className={`${SURFACE_CLASS} grid grid-cols-1 gap-4 p-4 md:grid-cols-3`}>
              <div className="space-y-1">
                <p className="text-xs font-bold text-neutral-950 dark:text-white">1. Generate QR Secret</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Tiwlo creates a unique TOTP secret key and renders an otpauth QR code for your account.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-neutral-950 dark:text-white">2. Scan With Authenticator</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Scan with Google Authenticator, 1Password, Authy, or Microsoft Authenticator (or enter the manual key).
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-neutral-950 dark:text-white">3. Verify &amp; Save Backup Codes</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Confirm with one 6-digit code to activate TOTP and receive one-time recovery codes.
                </p>
              </div>
            </div>
          )}

          {/* Case B: Interactive QR Enrollment Flow */}
          {!status.totpEnabled && setupData && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
              {/* QR Code Column */}
              <div className={`${SURFACE_CLASS} flex flex-col items-center justify-center gap-3 p-5 md:col-span-5`}>
                <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xs">
                  {setupData.qrCodeDataUrl ? (
                    <img
                      src={setupData.qrCodeDataUrl}
                      alt="Authenticator App TOTP QR Code"
                      className="size-48 object-contain"
                    />
                  ) : (
                    <div className="flex size-48 items-center justify-center text-xs text-neutral-400">
                      QR unavailable — use manual key
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                    {setupData.issuer || 'Tiwlo'}
                  </p>
                  {setupData.accountName && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {setupData.accountName}
                    </p>
                  )}
                </div>
              </div>

              {/* Manual Key + 6-digit Verification Form */}
              <div className="flex flex-col justify-between space-y-5 md:col-span-7">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-neutral-950 dark:text-white">
                      Step 1: Scan the QR code or enter the secret key manually
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      Works with {AUTHENTICATOR_APPS.join(', ')}.
                    </p>
                  </div>

                  {setupData.manualKey && (
                    <div className={`${SURFACE_CLASS} p-3`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                          Manual Setup Key
                        </span>
                        <button
                          type="button"
                          onClick={() => copyText(setupData.manualKey, setCopiedKey)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-200/70 dark:text-neutral-200 dark:hover:bg-neutral-800"
                        >
                          {copiedKey ? <Check className="size-3 text-[#1ED760]" /> : <Copy className="size-3" />}
                          <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                        </button>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs font-semibold tracking-wider text-neutral-950 dark:text-white">
                        {setupData.manualKey}
                      </p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleVerifyTotp} className="space-y-3 border-t border-neutral-200/80 pt-4 dark:border-neutral-800">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-neutral-950 dark:text-white">
                      Step 2: Enter the 6-digit code from your authenticator app
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className={`${INPUT_CLASS} font-mono text-base font-bold tracking-[0.35em] tabular-nums`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={startingSetup}
                        onClick={handleStartTotpSetup}
                        className={SECONDARY_BTN_CLASS}
                      >
                        <RefreshCw className={`size-3.5 ${startingSetup ? 'animate-spin' : ''}`} />
                        <span>New QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSetupData(null);
                          setVerifyCode('');
                        }}
                        className="px-2 py-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                    <button type="submit" disabled={verifyingTotp} className={PRIMARY_BTN_CLASS}>
                      {verifyingTotp ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      <span>{verifyingTotp ? 'Verifying...' : 'Verify & Activate'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Case C: TOTP Enrolled — Management Controls */}
          {status.totpEnabled && (
            <div className="space-y-4">
              <div className={`${SURFACE_CLASS} flex flex-wrap items-center justify-between gap-4 p-4`}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 shrink-0 text-[#1ED760]" />
                  <div>
                    <p className="text-xs font-bold text-neutral-950 dark:text-white">
                      Authenticator App is active on your account
                    </p>
                    <p className="text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">
                      Enrolled {formatDateTime(status.totpEnrolledAt)} · {status.backupCodesRemaining} recovery codes remaining
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRegeneratePanel((prev) => !prev);
                      setShowDisablePanel(false);
                    }}
                    className={SECONDARY_BTN_CLASS}
                  >
                    <KeyRound className="size-3.5" />
                    <span>Regenerate Recovery Codes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisablePanel((prev) => !prev);
                      setShowRegeneratePanel(false);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:bg-neutral-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <Shield className="size-3.5" />
                    <span>Disable Authenticator</span>
                  </button>
                </div>
              </div>

              {/* Regenerate Recovery Codes Inline Form */}
              {showRegeneratePanel && (
                <form
                  onSubmit={handleRegenerateRecoveryCodes}
                  className={`${SURFACE_CLASS} space-y-4 p-4`}
                >
                  <div>
                    <h3 className="text-xs font-bold text-neutral-950 dark:text-white">
                      Regenerate One-Time Recovery Codes
                    </h3>
                    <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      Generating a new set immediately invalidates all previously issued recovery codes.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        6-Digit Authenticator Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={regenCode}
                        onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className={`${INPUT_CLASS} font-mono tracking-[0.25em] tabular-nums`}
                      />
                    </div>
                    {hasPassword && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={regenPassword}
                          onChange={(e) => setRegenPassword(e.target.value)}
                          placeholder="••••••••"
                          className={INPUT_CLASS}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRegeneratePanel(false)}
                      className={SECONDARY_BTN_CLASS}
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={regeneratingCodes} className={PRIMARY_BTN_CLASS}>
                      {regeneratingCodes && <Loader2 className="size-3.5 animate-spin" />}
                      <span>Generate New Codes</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Disable TOTP Inline Form */}
              {showDisablePanel && (
                <form
                  onSubmit={handleDisableTotp}
                  className="space-y-4 rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/20"
                >
                  <div>
                    <h3 className="text-xs font-bold text-rose-800 dark:text-rose-200">
                      Disable Authenticator App (TOTP)
                    </h3>
                    <p className="mt-0.5 text-[11px] text-rose-700/80 dark:text-rose-300/80">
                      Confirm with a current 6-digit authenticator code or an unused recovery code.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDisableMode('totp')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        disableMode === 'totp'
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-black'
                          : 'border border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
                      }`}
                    >
                      Use Authenticator Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisableMode('recovery')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        disableMode === 'recovery'
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-black'
                          : 'border border-neutral-200 bg-white text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
                      }`}
                    >
                      Use Recovery Code
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {disableMode === 'totp' ? (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          6-Digit Authenticator Code
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={disableCode}
                          onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className={`${INPUT_CLASS} font-mono tracking-[0.25em] tabular-nums`}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          One-Time Recovery Code
                        </label>
                        <input
                          type="text"
                          required
                          value={disableRecoveryCode}
                          onChange={(e) => setDisableRecoveryCode(e.target.value)}
                          placeholder="XXXX-XXXX"
                          className={`${INPUT_CLASS} font-mono`}
                        />
                      </div>
                    )}
                    {hasPassword && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="••••••••"
                          className={INPUT_CLASS}
                        />
                      </div>
                    )}
                  </div>

                  <label className="flex cursor-pointer items-center gap-2.5 text-xs text-neutral-800 dark:text-neutral-200">
                    <input
                      type="checkbox"
                      checked={keepEmail2fa}
                      onChange={(e) => setKeepEmail2fa(e.target.checked)}
                      className="size-4 accent-[#1ED760]"
                    />
                    <span>Keep Email OTP 2FA enabled as a fallback after disabling Authenticator App</span>
                  </label>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDisablePanel(false)}
                      className={SECONDARY_BTN_CLASS}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={disablingTotp}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {disablingTotp && <Loader2 className="size-3.5 animate-spin" />}
                      <span>Disable Authenticator</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email OTP 2FA Card */}
      <div className={`${CARD_CLASS} p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-[#fafafa] text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
              <Mail className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                  Email OTP Two-Factor Authentication
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    status.emailTwoFactorEnabled
                      ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {status.emailTwoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Receive a 6-digit verification code at <span className="font-semibold text-neutral-800 dark:text-neutral-200">{currentUser?.email || 'your account email'}</span> when signing in from unrecognized sessions.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={status.emailTwoFactorEnabled}
            disabled={togglingEmail2fa || loading}
            onClick={handleToggleEmailTwoFactor}
            className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-semibold transition disabled:opacity-60 ${
              status.emailTwoFactorEnabled
                ? 'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800'
                : 'bg-[#1ED760] text-black hover:bg-[#19c354]'
            }`}
          >
            {togglingEmail2fa && <Loader2 className="size-3.5 animate-spin" />}
            <span>{status.emailTwoFactorEnabled ? 'Disable Email 2FA' : 'Enable Email 2FA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
