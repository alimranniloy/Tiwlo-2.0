import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Laptop,
  LayoutGrid,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  Users
} from 'lucide-react';
import { supportFetch } from '../utils/supportFetch';
import { resolveAvatarUrl } from '../utils/mediaUtils';
import { COUNTRIES, findCountry } from '../utils/countries';
import UserSessionsView from './UserSessionsView';

const PROFILE_SECTIONS = [
  { id: 'profile', label: 'Profile & Photo', icon: UserRound },
  { id: 'security', label: 'Password & Security PIN', icon: ShieldCheck },
  { id: 'sessions', label: 'Active Sessions', icon: Smartphone },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'widgets', label: 'Widget Settings', icon: LayoutGrid },
  { id: 'activity', label: 'Activity Log', icon: Activity }
];

const VALID_SECTIONS = new Set(PROFILE_SECTIONS.map((item) => item.id));

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'Bengali (বাংলা)' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'ar', label: 'Arabic (العربية)' },
  { value: 'hi', label: 'Hindi (हिन्दी)' },
  { value: 'ms', label: 'Malay (Bahasa Melayu)' }
];

const TIMEZONE_OPTIONS = [
  'Asia/Dhaka',
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Tokyo',
  'Australia/Sydney'
];

const DEFAULT_NOTIFICATION_PREFS = {
  orderAlerts: true,
  billingInvoices: true,
  teamActivity: true,
  cloudIncidents: true,
  weeklyDigest: false,
  inAppToasts: true
};

const NOTIFICATION_CHANNELS = [
  {
    key: 'orderAlerts',
    title: 'Orders & Fulfillment Updates',
    description: 'Receive notifications when new store orders, refunds, or fulfillment events occur.'
  },
  {
    key: 'billingInvoices',
    title: 'Billing, Credits & Invoices',
    description: 'Alerts for subscription renewals, payment receipts, and low cloud credit balances.'
  },
  {
    key: 'teamActivity',
    title: 'Team & Staff Access Events',
    description: 'Notifications when staff members accept invites, change permissions, or get suspended.'
  },
  {
    key: 'cloudIncidents',
    title: 'Cloud Droplets & Domain SSL',
    description: 'Status alerts for droplet health, DNS propagation, and SSL certificate renewals.'
  },
  {
    key: 'weeklyDigest',
    title: 'Weekly Performance Digest',
    description: 'A weekly summary of store revenue, traffic, and cloud resource utilization.'
  },
  {
    key: 'inAppToasts',
    title: 'In-App Toast Banners',
    description: 'Show real-time status banners and completion toasts inside the dashboard.'
  }
];

const DEFAULT_WIDGET_CONFIG = {
  showQuickActions: true,
  showRevenuePulse: true,
  showStoreHealth: true,
  showCloudResources: true,
  showRecentActivity: true,
  showTeamSnapshot: true,
  compactDensity: false,
  defaultLanding: 'overview',
  autoRefreshInterval: '60s'
};

const WIDGET_TOGGLES = [
  {
    key: 'showQuickActions',
    title: 'Quick Actions Bar',
    description: 'Display one-click shortcuts for creating stores, droplets, products, and domains.'
  },
  {
    key: 'showRevenuePulse',
    title: 'Revenue & Orders Pulse',
    description: 'Show daily and 30-day store sales performance metrics on the main dashboard.'
  },
  {
    key: 'showStoreHealth',
    title: 'Storefront & Domain Status',
    description: 'Monitor active storefront uptime, custom domain TLS status, and store links.'
  },
  {
    key: 'showCloudResources',
    title: 'Cloud Droplets & Usage Meter',
    description: 'Track active compute droplets, CPU/RAM allocation, and monthly credit burn.'
  },
  {
    key: 'showRecentActivity',
    title: 'Recent Activity Feed',
    description: 'Surface the latest account, store, and deployment events in your workspace overview.'
  },
  {
    key: 'showTeamSnapshot',
    title: 'Team Access Snapshot',
    description: 'Show active staff count and pending invitations directly on your dashboard.'
  }
];

const CARD_CLASS = 'rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950';
const SURFACE_CLASS = 'rounded-xl border border-neutral-200/80 bg-[#fafafa] dark:border-neutral-800 dark:bg-neutral-900/50';
const INPUT_CLASS = 'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:border-neutral-500';
const PRIMARY_BTN_CLASS = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BTN_CLASS = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800';

function syncUserToClientStorage(updatedUser) {
  if (!updatedUser) return;
  try {
    const existingRaw = localStorage.getItem('stockpro_user');
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    localStorage.setItem('stockpro_user', JSON.stringify({ ...existing, ...updatedUser }));
  } catch {
    // Ignore storage quota or serialization errors
  }
  try {
    window.dispatchEvent(new CustomEvent('tiwlo:user-updated', { detail: updatedUser }));
  } catch {
    // Ignore window event errors
  }
}

async function readJsonPayload(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || fallbackMessage);
  }
  return data;
}

function normalizeCountryValue(rawCountry) {
  if (!rawCountry) return '';
  return findCountry(rawCountry)?.name || String(rawCountry).trim();
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
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

function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? 'border-[#1ED760] bg-[#1ED760]'
          : 'border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800'
      }`}
    >
      <span
        className={`inline-block size-3.5 transform rounded-full bg-white shadow-xs transition ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Dedicated full-page profile, security (password, PIN, sessions), notifications,
 * widget configuration, and activity log hub for the signed-in Tiwlo account.
 */
export default function UserProfileSettingsView({
  currentUser,
  initialSection = 'profile',
  onUserUpdated,
  onBack,
  onOpenTwoFactor,
  onOpenTeamManagement,
  onOpenSessions,
  showToast
}) {
  const [section, setSection] = useState(() =>
    VALID_SECTIONS.has(initialSection) ? initialSection : 'profile'
  );
  const [prevInitialSection, setPrevInitialSection] = useState(initialSection);
  if (initialSection !== prevInitialSection) {
    setPrevInitialSection(initialSection);
    if (VALID_SECTIONS.has(initialSection)) {
      setSection(initialSection);
    }
  }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile state
  const [accountUser, setAccountUser] = useState(currentUser || {});
  const [name, setName] = useState(currentUser?.name || '');
  const [storeName, setStoreName] = useState(currentUser?.storeName || '');
  const [country, setCountry] = useState(() => normalizeCountryValue(currentUser?.country));
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password state
  const [hasPassword, setHasPassword] = useState(currentUser?.hasPassword !== false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Security PIN state
  const [hasSecurityPin, setHasSecurityPin] = useState(Boolean(currentUser?.hasSecurityPin));
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pinPassword, setPinPassword] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [confirmRemovePin, setConfirmRemovePin] = useState(false);
  const [removingPin, setRemovingPin] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [revokingSessionId, setRevokingSessionId] = useState('');

  // Account deletion state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOtpToken, setDeleteOtpToken] = useState('');
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const [deleteOtpMaskedEmail, setDeleteOtpMaskedEmail] = useState('');
  const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [copiedDeleteLink, setCopiedDeleteLink] = useState(false);

  // Two-factor summary for shortcut card
  const [twoFactorSummary, setTwoFactorSummary] = useState({
    twoFactorEnabled: Boolean(currentUser?.twoFactorEnabled),
    totpEnabled: Boolean(currentUser?.totpEnabled),
    emailTwoFactorEnabled: Boolean(currentUser?.emailTwoFactorEnabled ?? currentUser?.twoFactorEnabled),
    activeMethod: currentUser?.totpEnabled ? 'totp' : currentUser?.twoFactorEnabled ? 'email' : 'off'
  });

  // Preferences & Widgets state
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('Asia/Dhaka');
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [widgetConfig, setWidgetConfig] = useState(DEFAULT_WIDGET_CONFIG);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Activity Log state
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logCategory, setLogCategory] = useState('all');

  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const clearBanners = () => {
    setError('');
    setSuccessMsg('');
  };

  const applyLoadedAccount = useCallback((payload) => {
    const userData = payload?.user || payload?.account || {};
    const prefsData = payload?.preferences || userData?.preferences || {};
    const twoFa = payload?.twoFactor || payload?.security?.twoFactor || {};

    if (userData && Object.keys(userData).length > 0) {
      setAccountUser((prev) => ({ ...prev, ...userData }));
      setName(userData.name || '');
      setStoreName(userData.storeName || '');
      setCountry(normalizeCountryValue(userData.country));
      setAvatar(userData.avatar || '');
      setHasPassword(userData.hasPassword !== false);
    }

    const pinConfigured = Boolean(
      payload?.hasSecurityPin ??
      payload?.securityPinEnabled ??
      payload?.security?.hasSecurityPin ??
      payload?.security?.pinConfigured ??
      userData?.hasSecurityPin
    );
    setHasSecurityPin(pinConfigured);

    setTwoFactorSummary({
      twoFactorEnabled: Boolean(twoFa.twoFactorEnabled ?? payload?.twoFactorEnabled ?? userData?.twoFactorEnabled),
      totpEnabled: Boolean(twoFa.totpEnabled ?? payload?.totpEnabled ?? userData?.totpEnabled),
      emailTwoFactorEnabled: Boolean(
        twoFa.emailTwoFactorEnabled ??
        payload?.emailTwoFactorEnabled ??
        userData?.emailTwoFactorEnabled ??
        userData?.twoFactorEnabled
      ),
      activeMethod:
        twoFa.activeMethod ||
        payload?.activeMethod ||
        (userData?.totpEnabled ? 'totp' : userData?.twoFactorEnabled ? 'email' : 'off')
    });

    if (prefsData && typeof prefsData === 'object') {
      if (prefsData.language) setLanguage(prefsData.language);
      if (prefsData.timezone) setTimezone(prefsData.timezone);
      if (prefsData.securityAlerts !== undefined) setSecurityAlerts(Boolean(prefsData.securityAlerts));
      if (prefsData.marketingEmails !== undefined) setMarketingEmails(Boolean(prefsData.marketingEmails));
      if (prefsData.notificationPrefs && typeof prefsData.notificationPrefs === 'object') {
        setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...prefsData.notificationPrefs });
      }
      if (prefsData.widgetConfig && typeof prefsData.widgetConfig === 'object') {
        setWidgetConfig({ ...DEFAULT_WIDGET_CONFIG, ...prefsData.widgetConfig });
      }
    }

    if (Array.isArray(payload?.sessions)) {
      setSessions(payload.sessions);
    }
  }, []);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await supportFetch('/api/user/account', { method: 'GET' });
      const data = await readJsonPayload(response, 'Could not load account profile.');
      applyLoadedAccount(data);
    } catch (err) {
      setError(err.message || 'Could not load account profile.');
    } finally {
      setLoading(false);
    }
  }, [applyLoadedAccount]);

  const loadActivityLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const response = await supportFetch('/api/user/account/activity-log', { method: 'GET' });
      const data = await readJsonPayload(response, 'Could not load activity log.');
      setActivityLogs(Array.isArray(data.logs) ? data.logs : []);
      setLogsLoaded(true);
    } catch (err) {
      setError(err.message || 'Could not load activity log.');
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAccount);
  }, [loadAccount]);

  useEffect(() => {
    if (section === 'activity' && !logsLoaded && !loadingLogs) {
      void Promise.resolve().then(loadActivityLogs);
    }
  }, [section, logsLoaded, loadingLogs, loadActivityLogs]);

  const pushUserUpdate = (partialUser) => {
    const mergedUser = { ...accountUser, ...currentUser, ...partialUser };
    setAccountUser(mergedUser);
    syncUserToClientStorage(mergedUser);
    onUserUpdated?.(mergedUser);
  };

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

    clearBanners();
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });
    setUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await supportFetch('/api/user/account/avatar', {
        method: 'POST',
        body: formData
      });
      const data = await readJsonPayload(response, 'Failed to upload profile photo.');
      const nextAvatar = data.avatar || data.user?.avatar || '';
      setAvatar(nextAvatar);
      setAvatarPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      pushUserUpdate(data.user || { avatar: nextAvatar });
      setSuccessMsg('Profile photo updated.');
      showToast?.('Profile photo updated');
    } catch (err) {
      setError(err.message || 'Failed to upload profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    clearBanners();
    setDeletingAvatar(true);
    try {
      const response = await supportFetch('/api/user/account/avatar', { method: 'DELETE' });
      const data = await readJsonPayload(response, 'Failed to remove profile photo.');
      setAvatar('');
      setAvatarPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      pushUserUpdate(data.user || { avatar: '' });
      setSuccessMsg('Profile photo removed.');
      showToast?.('Profile photo removed');
    } catch (err) {
      setError(err.message || 'Failed to remove profile photo.');
    } finally {
      setDeletingAvatar(false);
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    clearBanners();
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    setSavingProfile(true);
    try {
      const response = await supportFetch('/api/user/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          storeName: storeName.trim(),
          country: country.trim()
        })
      });
      const data = await readJsonPayload(response, 'Failed to save profile.');
      const updated = data.user || { name: name.trim(), storeName: storeName.trim(), country: country.trim() };
      pushUserUpdate(updated);
      setSuccessMsg('Profile information saved.');
      showToast?.('Profile saved');
    } catch (err) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (event) => {
    event.preventDefault();
    clearBanners();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const response = await supportFetch('/api/user/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      await readJsonPayload(response, 'Failed to update password.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setHasPassword(true);
      setSuccessMsg('Account password updated.');
      showToast?.('Password updated');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSavePin = async (event) => {
    event.preventDefault();
    clearBanners();
    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setError('Security PIN must be 4 to 6 digits.');
      return;
    }
    if (cleanPin !== confirmPin.replace(/\D/g, '')) {
      setError('Security PIN and confirmation do not match.');
      return;
    }
    if (hasSecurityPin && !currentPin.trim()) {
      setError('Enter your current security PIN to set a new PIN.');
      return;
    }
    setSavingPin(true);
    try {
      const response = await supportFetch('/api/user/account/security-pin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: cleanPin,
          ...(currentPin.trim() ? { currentPin: currentPin.trim() } : {}),
          ...(pinPassword ? { currentPassword: pinPassword } : {})
        })
      });
      await readJsonPayload(response, 'Failed to save security PIN.');
      setHasSecurityPin(true);
      setPin('');
      setConfirmPin('');
      setCurrentPin('');
      setPinPassword('');
      setConfirmRemovePin(false);
      setSuccessMsg('Security PIN updated.');
      showToast?.('Security PIN saved');
    } catch (err) {
      setError(err.message || 'Failed to save security PIN.');
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    clearBanners();
    setRemovingPin(true);
    try {
      const response = await supportFetch('/api/user/account/security-pin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(currentPin.trim() ? { currentPin: currentPin.trim() } : {}),
          ...(pinPassword ? { currentPassword: pinPassword } : {})
        })
      });
      await readJsonPayload(response, 'Failed to remove security PIN.');
      setHasSecurityPin(false);
      setCurrentPin('');
      setPinPassword('');
      setConfirmRemovePin(false);
      setSuccessMsg('Security PIN removed.');
      showToast?.('Security PIN removed');
    } catch (err) {
      setError(err.message || 'Failed to remove security PIN.');
    } finally {
      setRemovingPin(false);
    }
  };

  const handleRevokeSession = async (sessionId = '') => {
    clearBanners();
    const targetKey = sessionId || 'others';
    setRevokingSessionId(targetKey);
    try {
      const endpoint = sessionId
        ? `/api/user/account/sessions/${encodeURIComponent(sessionId)}`
        : '/api/user/account/sessions';
      const response = await supportFetch(endpoint, { method: 'DELETE' });
      const data = await readJsonPayload(response, 'Failed to revoke session.');
      if (Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else if (sessionId) {
        setSessions((prev) => prev.filter((item) => item.id !== sessionId));
      } else {
        setSessions((prev) => prev.filter((item) => item.isCurrent));
      }
      const msg = sessionId ? 'Session signed out.' : 'Signed out all other sessions.';
      setSuccessMsg(msg);
      showToast?.(msg);
    } catch (err) {
      setError(err.message || 'Failed to revoke session.');
    } finally {
      setRevokingSessionId('');
    }
  };

  const handleSavePreferences = async (nextOverrides = {}, customSuccessMessage = 'Preferences saved.') => {
    clearBanners();
    const payload = {
      language: nextOverrides.language ?? language,
      timezone: nextOverrides.timezone ?? timezone,
      marketingEmails: nextOverrides.marketingEmails ?? marketingEmails,
      securityAlerts: nextOverrides.securityAlerts ?? securityAlerts,
      notificationPrefs: nextOverrides.notificationPrefs ?? notificationPrefs,
      widgetConfig: nextOverrides.widgetConfig ?? widgetConfig
    };

    setSavingPreferences(true);
    try {
      const response = await supportFetch('/api/user/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await readJsonPayload(response, 'Failed to save preferences.');
      const savedPrefs = data.preferences || payload;
      setLanguage(savedPrefs.language || payload.language);
      setTimezone(savedPrefs.timezone || payload.timezone);
      setMarketingEmails(Boolean(savedPrefs.marketingEmails));
      setSecurityAlerts(savedPrefs.securityAlerts !== false);
      setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...(savedPrefs.notificationPrefs || payload.notificationPrefs) });
      setWidgetConfig({ ...DEFAULT_WIDGET_CONFIG, ...(savedPrefs.widgetConfig || payload.widgetConfig) });
      setSuccessMsg(customSuccessMessage);
      showToast?.(customSuccessMessage);
    } catch (err) {
      setError(err.message || 'Failed to save preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const logCategories = useMemo(() => {
    const categories = new Set(['all']);
    for (const item of activityLogs) {
      const rawCat = String(item.category || item.type || 'general').toLowerCase();
      if (rawCat) categories.add(rawCat);
    }
    return Array.from(categories);
  }, [activityLogs]);

  const filteredLogs = useMemo(() => {
    const query = logSearch.trim().toLowerCase();
    return activityLogs.filter((item) => {
      const category = String(item.category || item.type || 'general').toLowerCase();
      if (logCategory !== 'all' && category !== logCategory) return false;
      if (!query) return true;
      const haystack = [
        item.action,
        item.title,
        item.event,
        item.details,
        item.description,
        item.message,
        item.ip,
        item.ipAddress,
        category
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activityLogs, logCategory, logSearch]);

  const effectiveAvatarSrc = avatarPreviewUrl || resolveAvatarUrl(avatar);
  const twoFactorBadgeLabel = twoFactorSummary.totpEnabled
    ? 'Authenticator App (TOTP)'
    : twoFactorSummary.emailTwoFactorEnabled || twoFactorSummary.twoFactorEnabled
      ? 'Email OTP Active'
      : 'Not Enabled';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-200/80 pb-5 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-2xl">
                User &amp; Account Settings
              </h1>
              {accountUser?.planName && (
                <span className="inline-flex items-center rounded-full border border-neutral-200 bg-[#fafafa] px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  {accountUser.planName}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Manage your personal profile, security controls, notifications, dashboard widgets, and account activity.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenTwoFactor && (
            <button
              type="button"
              onClick={onOpenTwoFactor}
              className={SECONDARY_BTN_CLASS}
            >
              <Shield className="size-3.5 text-[#1ED760]" />
              <span>Two-Factor Auth</span>
            </button>
          )}
          {onOpenTeamManagement && (
            <button
              type="button"
              onClick={onOpenTeamManagement}
              className={SECONDARY_BTN_CLASS}
            >
              <Users className="size-3.5 text-neutral-500 dark:text-neutral-400" />
              <span>Team &amp; Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 bg-[#fafafa] px-4 py-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
          <Loader2 className="size-4 animate-spin text-[#1ED760]" />
          <span>Loading your account settings...</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <span className="sr-only">Dismiss</span>
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

      {/* Main Layout: Sidebar Nav + Dedicated Content Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Navigation + Dedicated Page Shortcuts */}
        <aside className="space-y-4 lg:col-span-3">
          <nav
            aria-label="Account setting sections"
            className={`${CARD_CLASS} flex gap-1.5 overflow-x-auto p-2 lg:flex-col`}
          >
            {PROFILE_SECTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    clearBanners();
                    setSection(item.id);
                  }}
                  className={`inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${
                    isActive
                      ? 'bg-neutral-950 text-white shadow-2xs dark:bg-[#1ED760] dark:text-black'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Shortcut Cards to Dedicated Sub-Pages */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {onOpenTwoFactor && (
              <button
                type="button"
                onClick={onOpenTwoFactor}
                className={`${CARD_CLASS} group flex w-full items-start justify-between gap-3 p-4 text-left transition hover:border-neutral-300 hover:bg-[#fafafa] dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-[#1ED760]" />
                    <span className="text-xs font-bold text-neutral-950 dark:text-white">
                      Two-Factor Auth Hub
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Configure Authenticator App QR codes, recovery codes &amp; Email OTP.
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      twoFactorSummary.twoFactorEnabled || twoFactorSummary.totpEnabled
                        ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    {twoFactorBadgeLabel}
                  </span>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-900 dark:group-hover:text-white" />
              </button>
            )}

            {onOpenSessions && (
              <button
                type="button"
                onClick={onOpenSessions}
                className={`${CARD_CLASS} group flex w-full items-start justify-between gap-3 p-4 text-left transition hover:border-neutral-300 hover:bg-[#fafafa] dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-neutral-700 dark:text-neutral-300" />
                    <span className="text-xs font-bold text-neutral-950 dark:text-white">
                      Sessions &amp; Devices
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Inspect logged-in phones, browsers, IPs &amp; sign out remotely.
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 tabular-nums dark:bg-neutral-800 dark:text-neutral-300">
                    {sessions.length} Active
                  </span>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-900 dark:group-hover:text-white" />
              </button>
            )}

            {onOpenTeamManagement && (
              <button
                type="button"
                onClick={onOpenTeamManagement}
                className={`${CARD_CLASS} group flex w-full items-start justify-between gap-3 p-4 text-left transition hover:border-neutral-300 hover:bg-[#fafafa] dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-neutral-700 dark:text-neutral-300" />
                    <span className="text-xs font-bold text-neutral-950 dark:text-white">
                      Team &amp; Staff Access
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Invite staff, customize store/cloud permissions &amp; enforce 2FA.
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    Workspace Scoped
                  </span>
                </div>
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-900 dark:group-hover:text-white" />
              </button>
            )}
          </div>
        </aside>

        {/* Right Section Panel */}
        <div className="space-y-5 lg:col-span-9">
          {/* SECTION 1: PROFILE & PHOTO */}
          {section === 'profile' && (
            <div className="space-y-5">
              {/* Avatar Card */}
              <div className={`${CARD_CLASS} p-5`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative size-18 shrink-0">
                    <img
                      src={effectiveAvatarSrc}
                      alt={name || 'Profile photo'}
                      className="size-18 rounded-full border border-neutral-200 object-cover dark:border-neutral-800"
                    />
                    {(uploadingAvatar || deletingAvatar) && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Profile Photo
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Upload a JPG, PNG, WebP, GIF, or AVIF image up to 5 MB. Synced across your Tiwlo workspaces.
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarSelected}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingAvatar || deletingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className={SECONDARY_BTN_CLASS}
                    >
                      <Camera className="size-3.5" />
                      <span>{uploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
                    </button>
                    {avatar && (
                      <button
                        type="button"
                        disabled={uploadingAvatar || deletingAvatar}
                        onClick={handleRemoveAvatar}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/60 dark:bg-neutral-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="size-3.5" />
                        <span>{deletingAvatar ? 'Removing...' : 'Remove'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Details Form */}
              <form onSubmit={handleSaveProfile} className={`${CARD_CLASS} overflow-hidden`}>
                <div className="border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Personal &amp; Workspace Identity
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Update your personal display name, workspace label, and country.
                  </p>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Workspace / Display Label
                      </label>
                      <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="e.g. Acme Studio"
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Country / Region
                      </label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className={INPUT_CLASS}
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map((item) => (
                          <option key={item.code} value={item.name}>
                            {item.flag ? `${item.flag} ` : ''}{item.name} ({item.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Primary Email
                      </label>
                      <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-[#fafafa] px-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                        <span className="truncate">{accountUser?.email || 'Not set'}</span>
                        {accountUser?.emailVerified && (
                          <span className="shrink-0 rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Read-only Account Identifiers */}
                  <div className={`${SURFACE_CLASS} grid grid-cols-1 gap-3 p-4 sm:grid-cols-3`}>
                    <div>
                      <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Tiwlo ID</p>
                      <p className="mt-0.5 font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                        {accountUser?.tiwiId || accountUser?.storeId || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Account Role</p>
                      <p className="mt-0.5 text-xs font-semibold capitalize text-neutral-900 dark:text-white">
                        {accountUser?.role || 'Owner'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Auth Method</p>
                      <p className="mt-0.5 text-xs font-semibold capitalize text-neutral-900 dark:text-white">
                        {accountUser?.authMethod || 'Credentials'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <button type="submit" disabled={savingProfile} className={PRIMARY_BTN_CLASS}>
                    {savingProfile ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 2: SECURITY (PASSWORD, PIN & SESSIONS) */}
          {section === 'security' && (
            <div className="space-y-5">
              {/* Two-Factor Auth Quick Status Banner */}
              {onOpenTwoFactor && (
                <div className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-4 p-5`}>
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                          Two-Factor Authentication (2FA)
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            twoFactorSummary.twoFactorEnabled || twoFactorSummary.totpEnabled
                              ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          }`}
                        >
                          {twoFactorBadgeLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        Manage Authenticator App QR setup, backup recovery codes, and Email OTP verification on the dedicated 2FA page.
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={onOpenTwoFactor} className={PRIMARY_BTN_CLASS}>
                    <span>Manage 2FA</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Change Password Card */}
              <form onSubmit={handleSavePassword} className={`${CARD_CLASS} overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-neutral-500" />
                    <div>
                      <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                        {hasPassword ? 'Change Password' : 'Set Account Password'}
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Use a strong password of at least 6 characters that you don&apos;t reuse elsewhere.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                  >
                    {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    <span>{showPasswords ? 'Hide' : 'Show'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
                  {hasPassword && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Current Password
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className={INPUT_CLASS}
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      New Password
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Confirm New Password
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <button type="submit" disabled={savingPassword} className={PRIMARY_BTN_CLASS}>
                    {savingPassword && <Loader2 className="size-3.5 animate-spin" />}
                    <span>{savingPassword ? 'Updating...' : hasPassword ? 'Update Password' : 'Set Password'}</span>
                  </button>
                </div>
              </form>

              {/* Security PIN Card */}
              <form onSubmit={handleSavePin} className={`${CARD_CLASS} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-neutral-500" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                          Security PIN
                        </h2>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            hasSecurityPin
                              ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {hasSecurityPin ? 'Configured' : 'Not Set'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        4–6 digit PIN for confirming sensitive billing, domain, or team actions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {hasSecurityPin && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Current PIN
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={currentPin}
                          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••"
                          className={`${INPUT_CLASS} font-mono tracking-[0.25em]`}
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        {hasSecurityPin ? 'New PIN (4–6 digits)' : 'Security PIN (4–6 digits)'}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        className={`${INPUT_CLASS} font-mono tracking-[0.25em]`}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        className={`${INPUT_CLASS} font-mono tracking-[0.25em]`}
                      />
                    </div>
                    {hasPassword && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Account Password
                        </label>
                        <input
                          type="password"
                          value={pinPassword}
                          onChange={(e) => setPinPassword(e.target.value)}
                          placeholder="Verify password"
                          className={INPUT_CLASS}
                        />
                      </div>
                    )}
                  </div>

                  {hasSecurityPin && confirmRemovePin && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/20">
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        Confirm removing your Security PIN? Enter your Current PIN{hasPassword ? ' or Account Password' : ''} above first.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmRemovePin(false)}
                          className={SECONDARY_BTN_CLASS}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={removingPin}
                          onClick={handleRemovePin}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                        >
                          {removingPin && <Loader2 className="size-3.5 animate-spin" />}
                          <span>Confirm Remove PIN</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <div>
                    {hasSecurityPin && !confirmRemovePin && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemovePin(true)}
                        className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                      >
                        Remove Security PIN
                      </button>
                    )}
                  </div>
                  <button type="submit" disabled={savingPin} className={PRIMARY_BTN_CLASS}>
                    {savingPin && <Loader2 className="size-3.5 animate-spin" />}
                    <span>{savingPin ? 'Saving...' : hasSecurityPin ? 'Update PIN' : 'Enable Security PIN'}</span>
                  </button>
                </div>
              </form>

              {/* Active Sessions Dedicated Page Card */}
              <div className={`${CARD_CLASS} flex flex-wrap items-center justify-between gap-4 p-5`}>
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-[#fafafa] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                    <Smartphone className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Active Sessions &amp; Devices <span className="tabular-nums text-neutral-500">({sessions.length})</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      View mobile devices, web browsers, IP addresses, and remotely sign out sessions on the dedicated Sessions page.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (onOpenSessions ? onOpenSessions() : setSection('sessions'))}
                    className={SECONDARY_BTN_CLASS}
                  >
                    <span>Manage Sessions</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Delete Account Card (Shadcn UI) */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError('');
                  setSuccessMsg('');
                  if (!deleteOtpToken || !/^\d{6}$/.test(deleteOtpCode.trim())) {
                    setError('Request an Email OTP and enter the 6-digit code to delete your account.');
                    return;
                  }
                  if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
                    setError('Type DELETE to confirm account deletion.');
                    return;
                  }
                  if (hasPassword && !deletePassword.trim()) {
                    setError('Enter your account password to delete your account.');
                    return;
                  }
                  setDeletingAccount(true);
                  try {
                    const res = await supportFetch('/api/user/account/delete', {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        confirmation: deleteConfirmText.trim(),
                        otpToken: deleteOtpToken,
                        otpCode: deleteOtpCode.trim(),
                        password: deletePassword || undefined
                      })
                    });
                    await readJsonPayload(res, 'Failed to delete account.');
                    try {
                      localStorage.removeItem('stockpro_session');
                      localStorage.removeItem('stockpro_user');
                      sessionStorage.clear();
                    } catch {}
                    showToast?.('Your account has been deleted and can no longer sign in.');
                    window.location.assign('/');
                  } catch (err) {
                    setError(err.message || 'Failed to delete account.');
                  } finally {
                    setDeletingAccount(false);
                  }
                }}
                className={`${CARD_CLASS} overflow-hidden`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Trash2 className="size-4 text-rose-600 dark:text-rose-400" />
                    <div>
                      <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                        Delete Account
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Disable Tiwlo, PICK &amp; PICK Delivery login access while preserving billing history.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = typeof window !== 'undefined'
                        ? `${window.location.origin}/delete-account`
                        : 'https://tiwlo.com/delete-account';
                      try {
                        await navigator.clipboard.writeText(url);
                        setCopiedDeleteLink(true);
                        setTimeout(() => setCopiedDeleteLink(false), 2000);
                      } catch {}
                    }}
                    className={SECONDARY_BTN_CLASS}
                  >
                    {copiedDeleteLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    <span>{copiedDeleteLink ? 'Link Copied' : 'Copy Delete URL'}</span>
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <span>
                      {deleteOtpMaskedEmail
                        ? `Email OTP sent to ${deleteOtpMaskedEmail}`
                        : 'Email OTP verification is required before deleting your account.'}
                    </span>
                    <button
                      type="button"
                      disabled={sendingDeleteOtp}
                      onClick={async () => {
                        setError('');
                        setSendingDeleteOtp(true);
                        try {
                          const res = await supportFetch('/api/user/account/otp-request', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                          });
                          const data = await readJsonPayload(res, 'Could not send Email OTP.');
                          setDeleteOtpToken(data.otpToken || '');
                          setDeleteOtpMaskedEmail(data.emailMasked || accountUser?.email || 'your email');
                        } catch (err) {
                          setError(err.message || 'Could not send Email OTP.');
                        } finally {
                          setSendingDeleteOtp(false);
                        }
                      }}
                      className={SECONDARY_BTN_CLASS}
                    >
                      {sendingDeleteOtp && <Loader2 className="size-3.5 animate-spin" />}
                      <span>{deleteOtpToken ? 'Resend Email OTP' : 'Send Email OTP'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        6-Digit Email OTP
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={deleteOtpCode}
                        onChange={(e) => setDeleteOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className={`${INPUT_CLASS} font-mono tracking-[0.2em]`}
                      />
                    </div>
                    {hasPassword && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Account Password
                        </label>
                        <input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Verify your password"
                          className={INPUT_CLASS}
                        />
                      </div>
                    )}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Type <span className="font-mono text-rose-600 dark:text-rose-400">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <a
                    href="/delete-account"
                    className="text-[11px] font-medium text-neutral-600 hover:underline dark:text-neutral-400"
                  >
                    Open /delete-account page
                  </a>
                  <button
                    type="submit"
                    disabled={deletingAccount}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingAccount ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    <span>{deletingAccount ? 'Deleting...' : 'Delete Account'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 2B: DEDICATED ACTIVE SESSIONS & DEVICES */}
          {section === 'sessions' && (
            <UserSessionsView
              embedded
              onSessionsChanged={setSessions}
              showToast={showToast}
            />
          )}

          {/* SECTION 3: NOTIFICATIONS & REGIONAL PREFERENCES */}
          {section === 'notifications' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePreferences({}, 'Notification preferences saved.');
              }}
              className={`${CARD_CLASS} overflow-hidden`}
            >
              <div className="border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                  Notification Preferences &amp; Localization
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  Control how Tiwlo alerts you about security events, store orders, billing, and team updates.
                </p>
              </div>

              <div className="space-y-6 p-5">
                {/* Language & Timezone */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      <Globe className="size-3.5 text-neutral-400" />
                      <span>Interface Language</span>
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      <Clock className="size-3.5 text-neutral-400" />
                      <span>Preferred Timezone</span>
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={INPUT_CLASS}
                    >
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Essential Account Emails */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Account &amp; Marketing Emails
                  </h3>
                  <div className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                          Security &amp; Login Alerts
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Email alerts for new device sign-ins, password resets, and 2FA changes.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={securityAlerts}
                        onChange={setSecurityAlerts}
                        label="Toggle security and login alerts"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                      <div>
                        <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                          Product Updates &amp; Announcements
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          Occasional news on new Tiwlo features, cloud regions, and platform updates.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={marketingEmails}
                        onChange={setMarketingEmails}
                        label="Toggle product updates and marketing emails"
                      />
                    </div>
                  </div>
                </div>

                {/* Granular Workspace Notification Channels */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Workspace &amp; Store Notifications
                  </h3>
                  <div className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
                    {NOTIFICATION_CHANNELS.map((channel) => (
                      <div key={channel.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                            {channel.title}
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {channel.description}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={Boolean(notificationPrefs[channel.key])}
                          onChange={(val) =>
                            setNotificationPrefs((prev) => ({ ...prev, [channel.key]: val }))
                          }
                          label={`Toggle ${channel.title}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                <button type="submit" disabled={savingPreferences} className={PRIMARY_BTN_CLASS}>
                  {savingPreferences ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>{savingPreferences ? 'Saving...' : 'Save Notification Settings'}</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 4: WIDGET SETTINGS */}
          {section === 'widgets' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePreferences({}, 'Widget settings saved.');
              }}
              className={`${CARD_CLASS} overflow-hidden`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Dashboard Widget Configuration
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Choose which summary widgets, density, and auto-refresh behavior appear in your workspace.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWidgetConfig({ ...DEFAULT_WIDGET_CONFIG })}
                  className={SECONDARY_BTN_CLASS}
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <div className="space-y-6 p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Default Landing View
                    </label>
                    <select
                      value={widgetConfig.defaultLanding || 'overview'}
                      onChange={(e) =>
                        setWidgetConfig((prev) => ({ ...prev, defaultLanding: e.target.value }))
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="overview">Dashboard Overview</option>
                      <option value="stores">Online Stores</option>
                      <option value="cloud">Cloud Infrastructure</option>
                      <option value="analytics">Sales &amp; Analytics</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Metric Auto-Refresh Interval
                    </label>
                    <select
                      value={widgetConfig.autoRefreshInterval || '60s'}
                      onChange={(e) =>
                        setWidgetConfig((prev) => ({ ...prev, autoRefreshInterval: e.target.value }))
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="off">Manual Refresh Only</option>
                      <option value="30s">Every 30 seconds</option>
                      <option value="60s">Every 60 seconds</option>
                      <option value="5m">Every 5 minutes</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200/80 bg-[#fafafa] px-4 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div>
                    <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                      Compact Card Density
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Use tighter vertical spacing across dashboard KPI cards and tables.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={Boolean(widgetConfig.compactDensity)}
                    onChange={(val) => setWidgetConfig((prev) => ({ ...prev, compactDensity: val }))}
                    label="Toggle compact card density"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    Visible Dashboard Widgets
                  </h3>
                  <div className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
                    {WIDGET_TOGGLES.map((widget) => (
                      <div key={widget.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                            {widget.title}
                          </p>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                            {widget.description}
                          </p>
                        </div>
                        <ToggleSwitch
                          checked={Boolean(widgetConfig[widget.key])}
                          onChange={(val) =>
                            setWidgetConfig((prev) => ({ ...prev, [widget.key]: val }))
                          }
                          label={`Toggle ${widget.title}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-neutral-200/80 bg-[#fafafa] px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                <button type="submit" disabled={savingPreferences} className={PRIMARY_BTN_CLASS}>
                  {savingPreferences ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>{savingPreferences ? 'Saving...' : 'Save Widget Settings'}</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 5: ACTIVITY LOG */}
          {section === 'activity' && (
            <div className={`${CARD_CLASS} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-4 dark:border-neutral-800">
                <div>
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Account Activity Log
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    Chronological audit trail of logins, profile updates, 2FA events, and team changes.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingLogs}
                  onClick={loadActivityLogs}
                  className={SECONDARY_BTN_CLASS}
                >
                  <RefreshCw className={`size-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>{loadingLogs ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-3 border-b border-neutral-200/80 bg-[#fafafa] px-5 py-3 dark:border-neutral-800 dark:bg-neutral-900/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search activity, IP, or action..."
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-white pr-3 pl-8 text-xs text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {logCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLogCategory(cat)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                        logCategory === cat
                          ? 'bg-neutral-950 text-white dark:bg-[#1ED760] dark:text-black'
                          : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                {loadingLogs && activityLogs.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-xs text-neutral-500">
                    <Loader2 className="size-4 animate-spin text-[#1ED760]" />
                    <span>Loading activity history...</span>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className={`${SURFACE_CLASS} p-8 text-center`}>
                    <Activity className="mx-auto mb-2 size-6 text-neutral-400" />
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      No matching activity events
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      {activityLogs.length === 0
                        ? 'Your recent security and account actions will appear here.'
                        : 'Try clearing your search or switching category filters.'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200/70 rounded-xl border border-neutral-200/80 dark:divide-neutral-800 dark:border-neutral-800">
                    {filteredLogs.map((log, index) => {
                      const title = log.title || log.action || log.event || 'Account event';
                      const details = log.details || log.description || log.message || '';
                      const category = String(log.category || log.type || 'general');
                      const timestamp = log.createdAt || log.timestamp || log.at;
                      const ip = log.ip || log.ipAddress;
                      return (
                        <div
                          key={log.id || `${title}-${index}`}
                          className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                                {title}
                              </span>
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                                {category}
                              </span>
                            </div>
                            {details && (
                              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                {details}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-left text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400 sm:text-right">
                            <p>{formatDateTime(timestamp)}</p>
                            {ip && <p className="font-mono text-[10px] text-neutral-400">IP {ip}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
