import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  Check,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  X
} from 'lucide-react';
import { resolveAvatarUrl } from '../utils/mediaUtils';

const TABS = [
  { id: 'profile', label: 'Profile & Photo', icon: UserRound },
  { id: 'security', label: 'Security & Password', icon: ShieldCheck },
  { id: 'preferences', label: 'Preferences & Sessions', icon: SlidersHorizontal }
];

const CURRENCY_OPTIONS = ['USD', 'BDT', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'SGD', 'MYR', 'CAD', 'AUD'];
const TIMEZONE_OPTIONS = [
  'Asia/Dhaka',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Australia/Sydney'
];

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const token = localStorage.getItem('stockpro_session');
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

function syncUserToClientStorage(updatedUser) {
  if (!updatedUser) return;
  try {
    const existingRaw = localStorage.getItem('stockpro_user');
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = { ...existing, ...updatedUser };
    localStorage.setItem('stockpro_user', JSON.stringify(merged));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('tiwlo:user-updated', { detail: updatedUser }));
  } catch {}
}

export default function UserAccountSettingsModal(props) {
  if (!props.isOpen) return null;
  return <UserAccountSettingsModalContent key={props.initialTab || 'profile'} {...props} />;
}

function UserAccountSettingsModalContent({
  initialTab = 'profile',
  currentUser,
  onClose,
  onUserUpdated,
  showToast
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile fields
  const [name, setName] = useState(currentUser?.name || '');
  const [storeName, setStoreName] = useState(currentUser?.storeName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    currentUser?.dateOfBirth ? String(currentUser.dateOfBirth).slice(0, 10) : ''
  );
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');

  // Security fields
  const [email, setEmail] = useState(currentUser?.email || '');
  const [initialEmail, setInitialEmail] = useState(currentUser?.email || '');
  const [initialPhone, setInitialPhone] = useState(currentUser?.phone || '');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(currentUser?.twoFactorEnabled));
  const [initialTwoFactorEnabled, setInitialTwoFactorEnabled] = useState(Boolean(currentUser?.twoFactorEnabled));
  const [hasPassword, setHasPassword] = useState(currentUser?.hasPassword !== false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [otpNow, setOtpNow] = useState(() => Date.now());
  const [otpRequiredPrompt, setOtpRequiredPrompt] = useState(false);

  // Preferences & sessions
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    securityAlerts: true,
    marketingEmails: false,
    currency: 'USD',
    timezone: 'Asia/Dhaka',
    requireOtp: false
  });
  const [initialRequireOtp, setInitialRequireOtp] = useState(false);
  const [sessions, setSessions] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (!otpExpiresAt) return undefined;
    const timer = setInterval(() => setOtpNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [otpExpiresAt]);

  const otpRemainingSeconds = otpExpiresAt
    ? Math.max(0, Math.ceil((otpExpiresAt - otpNow) / 1000))
    : 0;

  const applyAccountPayload = (userData, prefsData, sessionList) => {
    if (userData) {
      setName(userData.name || '');
      setStoreName(userData.storeName || '');
      setPhone(userData.phone || '');
      setInitialPhone(userData.phone || '');
      setAddress(userData.address || '');
      setDateOfBirth(
        userData.dateOfBirth ? String(userData.dateOfBirth).slice(0, 10) : ''
      );
      setAvatar(userData.avatar || '');
      setEmail(userData.email || '');
      setInitialEmail(userData.email || '');
      setTwoFactorEnabled(Boolean(userData.twoFactorEnabled));
      setInitialTwoFactorEnabled(Boolean(userData.twoFactorEnabled));
      setHasPassword(userData.hasPassword !== false);
    }
    if (prefsData) {
      setPreferences({
        emailNotifications: prefsData.emailNotifications !== false,
        securityAlerts: prefsData.securityAlerts !== false,
        marketingEmails: Boolean(prefsData.marketingEmails),
        currency: prefsData.currency || 'USD',
        timezone: prefsData.timezone || 'Asia/Dhaka',
        requireOtp: Boolean(prefsData.requireOtp)
      });
      setInitialRequireOtp(Boolean(prefsData.requireOtp));
    }
    if (Array.isArray(sessionList)) {
      setSessions(sessionList);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/user/account/settings', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders()
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Could not load account settings.');
        }
        if (active) {
          applyAccountPayload(data.user, data.preferences, data.sessions);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Could not load account settings.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const needsOtpVerification = useMemo(() => {
    const emailChanged = email.trim().toLowerCase() !== initialEmail.trim().toLowerCase();
    const phoneChanged = phone.trim() !== initialPhone.trim();
    const twoFaChanged = Boolean(twoFactorEnabled) !== Boolean(initialTwoFactorEnabled);
    const passwordChanged = newPassword.length > 0;
    const requireOtpToggled = Boolean(preferences.requireOtp) !== Boolean(initialRequireOtp);
    return Boolean(
      initialRequireOtp ||
      preferences.requireOtp ||
      emailChanged ||
      phoneChanged ||
      twoFaChanged ||
      passwordChanged ||
      requireOtpToggled ||
      otpRequiredPrompt
    );
  }, [
    email,
    initialEmail,
    phone,
    initialPhone,
    twoFactorEnabled,
    initialTwoFactorEnabled,
    newPassword,
    preferences.requireOtp,
    initialRequireOtp,
    otpRequiredPrompt
  ]);



  const handleAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP, GIF, or AVIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo must be 5 MB or smaller.');
      return;
    }

    setError('');
    setSuccessMsg('');
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('/api/user/account/avatar', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.avatar) {
        throw new Error(data.error || 'Failed to upload profile photo.');
      }

      setAvatar(data.avatar);
      setAvatarPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      const mergedUser = data.user ? { ...currentUser, ...data.user } : { ...currentUser, avatar: data.avatar };
      syncUserToClientStorage(mergedUser);
      onUserUpdated?.(mergedUser);
      setSuccessMsg('Profile photo updated.');
      showToast?.('Profile photo updated');
    } catch (err) {
      setError(err.message || 'Failed to upload profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRequestOtp = async () => {
    setError('');
    setSuccessMsg('');
    setSendingOtp(true);
    try {
      const res = await fetch('/api/user/account/otp-request', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send verification code.');
      }
      setOtpToken(data.otpToken || '');
      setOtpMaskedEmail(data.maskedEmail || '');
      setOtpExpiresAt(Date.now() + Number(data.expiresInSeconds || 600) * 1000);
      setSuccessMsg(`6-digit Email OTP sent to ${data.maskedEmail || 'your email'}.`);
    } catch (err) {
      setError(err.message || 'Failed to send Email OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSave = async (event) => {
    event?.preventDefault?.();
    setError('');
    setSuccessMsg('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      setActiveTab('security');
      return;
    }

    if (needsOtpVerification && !/^\d{6}$/.test(otpCode.trim())) {
      setOtpRequiredPrompt(true);
      setActiveTab('security');
      setError('Enter the 6-digit Email OTP to confirm account changes.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        storeName: storeName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        dateOfBirth: dateOfBirth.trim(),
        email: email.trim(),
        twoFactorEnabled,
        preferences,
        ...(newPassword ? { currentPassword, newPassword } : {}),
        ...(otpCode.trim() ? { otpCode: otpCode.trim(), otpToken } : {})
      };

      const res = await fetch('/api/user/account/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.requiresOtp) {
        setOtpRequiredPrompt(true);
        setActiveTab('security');
        throw new Error(data.error || 'Email OTP verification required to save account changes.');
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save account settings.');
      }

      const mergedUser = { ...currentUser, ...data.user };
      applyAccountPayload(data.user, data.preferences, null);
      syncUserToClientStorage(mergedUser);
      onUserUpdated?.(mergedUser);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpCode('');
      setOtpToken('');
      setOtpExpiresAt(0);
      setOtpRequiredPrompt(false);
      setSuccessMsg('Account settings saved.');
      showToast?.('Account settings saved');
    } catch (err) {
      setError(err.message || 'Failed to save account settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId, scope = 'single') => {
    setError('');
    setRevokingSessionId(scope === 'others' ? 'others' : sessionId);
    try {
      const res = await fetch('/api/user/account/sessions/revoke', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(scope === 'others' ? { scope: 'others' } : { sessionId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign out session.');
      }
      setSessions(data.sessions || []);
      setSuccessMsg(scope === 'others' ? 'Signed out all other sessions.' : 'Session signed out.');
    } catch (err) {
      setError(err.message || 'Failed to sign out session.');
    } finally {
      setRevokingSessionId('');
    }
  };

  const effectiveAvatarSrc = avatarPreviewUrl || resolveAvatarUrl(avatar);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-account-settings-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
          <div>
            <h2
              id="user-account-settings-title"
              className="text-base font-bold text-neutral-950 dark:text-white"
            >
              User Account Settings
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Manage your Tiwlo User profile, security controls, and active sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account settings"
            className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-50/70 px-5 py-2 dark:border-neutral-800 dark:bg-neutral-900/50">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-neutral-950 text-white shadow-2xs dark:bg-[#1ED760] dark:text-black'
                    : 'text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {loading && (
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Refreshing account details...</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
              >
                {error}
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                <Check className="size-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* TAB 1: PROFILE & PHOTO */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 sm:flex-row sm:items-center dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div className="relative size-16 shrink-0">
                    <img
                      src={effectiveAvatarSrc}
                      alt={name || 'Profile avatar'}
                      className="size-16 rounded-full border border-neutral-200 object-cover dark:border-neutral-700"
                    />
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white">
                        <Loader2 className="size-4 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Profile Picture
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      JPG, PNG, WebP, GIF, or AVIF up to 5 MB. Updates across your dashboard immediately.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
                  >
                    <Camera className="size-3.5" />
                    <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Workspace / Organization Name
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1700-000000"
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Address
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, Country"
                    className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: SECURITY & PASSWORD */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-200 p-4 space-y-3 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                    <Mail className="size-4 text-neutral-500" />
                    <span>Account Email</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Changing your email requires verification with an Email OTP sent to your current verified email.
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 p-4 space-y-3 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                    <Lock className="size-4 text-neutral-500" />
                    <span>Change Password</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {hasPassword && (
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                          Current Password
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-950 outline-none focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                        Two-Factor Authentication (Email OTP)
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Require a 6-digit email verification code when signing in from new sessions.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      className="size-4 accent-[#1ED760]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
                    <div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                        Require OTP to confirm changes
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Always require Email OTP verification before saving any account setting change.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.requireOtp}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, requireOtp: e.target.checked }))
                      }
                      className="size-4 accent-[#1ED760]"
                    />
                  </label>
                </div>

                {/* Email OTP Verification Box */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <KeyRound className="size-4 text-[#1ED760]" />
                      <div>
                        <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                          Email OTP Verification
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {otpMaskedEmail
                            ? `Code sent to ${otpMaskedEmail}${otpRemainingSeconds > 0 ? ` (${Math.floor(otpRemainingSeconds / 60)}:${String(otpRemainingSeconds % 60).padStart(2, '0')} left)` : ' (expired)'}`
                            : 'Required for email, phone, password, or security setting updates.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={sendingOtp}
                      onClick={handleRequestOtp}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-950 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                    >
                      {sendingOtp && <Loader2 className="size-3 animate-spin" />}
                      <span>{otpMaskedEmail ? 'Resend Email OTP' : 'Send Email OTP'}</span>
                    </button>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                      6-Digit Email OTP Code {needsOtpVerification ? '(Required to save changes)' : '(Optional unless changing security fields)'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 font-mono text-sm tracking-[0.25em] text-neutral-950 outline-none focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 dark:border-rose-900/50 dark:bg-rose-950/15">
                  <div>
                    <p className="text-xs font-semibold text-neutral-950 dark:text-white">Delete Account</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Permanently remove your Tiwlo and linked PICK accounts.
                    </p>
                  </div>
                  <a
                    href="/delete-account"
                    className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    Open Delete Account
                  </a>
                </div>
              </div>
            )}

            {/* TAB 3: PREFERENCES & SESSIONS */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <div className="space-y-2.5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                    <Bell className="size-4 text-neutral-500" />
                    <span>Notifications & Regional Preferences</span>
                  </div>

                  <label className="flex cursor-pointer items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Email notifications</span>
                    <input
                      type="checkbox"
                      checked={preferences.emailNotifications}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, emailNotifications: e.target.checked }))
                      }
                      className="size-4 accent-[#1ED760]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Security & login alerts</span>
                    <input
                      type="checkbox"
                      checked={preferences.securityAlerts}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, securityAlerts: e.target.checked }))
                      }
                      className="size-4 accent-[#1ED760]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">Product updates & marketing emails</span>
                    <input
                      type="checkbox"
                      checked={preferences.marketingEmails}
                      onChange={(e) =>
                        setPreferences((prev) => ({ ...prev, marketingEmails: e.target.checked }))
                      }
                      className="size-4 accent-[#1ED760]"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        Preferred Currency
                      </label>
                      <select
                        value={preferences.currency}
                        onChange={(e) =>
                          setPreferences((prev) => ({ ...prev, currency: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-950 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      >
                        {CURRENCY_OPTIONS.map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        Timezone
                      </label>
                      <select
                        value={preferences.timezone}
                        onChange={(e) =>
                          setPreferences((prev) => ({ ...prev, timezone: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-950 outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-white">
                      <Laptop className="size-4 text-neutral-500" />
                      <span>Active Sessions ({sessions.length})</span>
                    </div>
                    {sessions.some((s) => !s.isCurrent) && (
                      <button
                        type="button"
                        disabled={revokingSessionId === 'others'}
                        onClick={() => handleRevokeSession('', 'others')}
                        className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-neutral-800 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      >
                        {revokingSessionId === 'others' ? 'Signing out...' : 'Sign out other sessions'}
                      </button>
                    )}
                  </div>

                  {sessions.length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Only your current session is active.
                    </p>
                  ) : (
                    <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {sessions.map((session) => {
                        const isMobile = /Android|iOS/i.test(session.device || '');
                        return (
                          <div
                            key={session.id}
                            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              {isMobile ? (
                                <Smartphone className="size-4 shrink-0 text-neutral-400" />
                              ) : (
                                <Laptop className="size-4 shrink-0 text-neutral-400" />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-xs font-semibold text-neutral-900 dark:text-white">
                                    {session.device || 'Web Session'}
                                  </p>
                                  {session.isCurrent && (
                                    <span className="rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                                  IP: {session.ip || 'Unknown'}
                                  {session.createdAt ? ` · ${new Date(session.createdAt).toLocaleDateString()}` : ''}
                                </p>
                              </div>
                            </div>
                            {!session.isCurrent && (
                              <button
                                type="button"
                                disabled={revokingSessionId === session.id}
                                onClick={() => handleRevokeSession(session.id, 'single')}
                                className="rounded-md border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                              >
                                {revokingSessionId === session.id ? 'Signing out...' : 'Sign out'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50/70 px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {needsOtpVerification
                ? 'Email OTP verification is required to save these changes.'
                : 'Profile changes save directly.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1ED760] px-4 text-xs font-bold text-black transition hover:bg-[#18c755] disabled:opacity-60"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
