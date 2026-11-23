import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  AtSign,
  BadgeCheck,
  Bell,
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Fingerprint,
  Globe,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  Save,
  Shield,
  ShieldCheck,
  Store,
  UserRound,
  Webhook,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import { CountryPickerField } from '../components/CountryPickerModal';
import { FingerprintDrawer } from '../components/FingerprintDrawer';
import type { TiwloUser } from '../services/tiwloAuth';
import { TIWLO_API_BASE } from '../services/tiwloAuth';
import {
  AccountProfilePayload,
  ActivityLogItem,
  fetchAccountActivityLog,
  fetchAccountDetails,
  removeSecurityPin,
  updateAccountPassword,
  updateAccountProfile,
  updateSecurityPin,
} from '../services/tiwloAccount';
import {
  checkBiometricAvailable,
  suppressFingerprintPrompt,
} from '../services/tiwloIntegrity';
import { colors } from '../theme/tokens';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

function resolveAvatarUri(avatar?: string): string | null {
  const clean = typeof avatar === 'string' ? avatar.trim() : '';
  if (!clean) return null;
  if (clean.startsWith('https://') || clean.startsWith('http://')) return clean;
  if (clean.startsWith('/')) return `${TIWLO_ORIGIN}${clean}`;
  return null;
}

type SettingsTab = 'profile' | 'security' | 'preferences' | 'activity';
type ActivityFilter = 'All' | 'Security' | 'Profile' | 'Billing';
type ThemeDensity = 'Comfortable' | 'Compact';
type CurrencyOption = 'USD $' | 'BDT ৳' | 'EUR €';

const BUSINESS_CATEGORIES = [
  'E-Commerce',
  'SaaS & Cloud',
  'Agency',
  'Creator',
  'Retail',
  'Services',
] as const;

const LANGUAGES = ['English', 'Bengali'] as const;

const CURRENCIES: readonly CurrencyOption[] = ['USD $', 'BDT ৳', 'EUR €'];

const TIMEZONES = [
  'Asia/Dhaka (UTC+6)',
  'UTC',
  'America/New_York',
  'Europe/London',
  'Asia/Singapore',
] as const;

const ACTIVITY_FILTERS: readonly ActivityFilter[] = [
  'All',
  'Security',
  'Profile',
  'Billing',
];

interface BiometricStatusResponse {
  enrolled?: boolean;
  hasBiometric?: boolean;
  enabled?: boolean;
  useForSignIn?: boolean;
  deviceName?: string;
  devices?: Array<{ deviceName?: string; name?: string }>;
}

interface PasswordStrength {
  score: 0 | 1 | 2 | 3;
  label: 'Weak' | 'Fair' | 'Strong' | '';
  color: string;
}

function evaluatePasswordStrength(pw: string): PasswordStrength {
  if (!pw) {
    return { score: 0, label: '', color: colors.surface };
  }
  let points = 0;
  if (pw.length >= 8) points += 1;
  if (pw.length >= 12) points += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) points += 1;
  if (/\d/.test(pw)) points += 1;
  if (/[^A-Za-z0-9]/.test(pw)) points += 1;

  if (points <= 2 || pw.length < 8) {
    return { score: 1, label: 'Weak', color: colors.danger };
  }
  if (points <= 3) {
    return { score: 2, label: 'Fair', color: colors.warning };
  }
  return { score: 3, label: 'Strong', color: colors.primary };
}

function classifyActivity(item: ActivityLogItem): Exclude<ActivityFilter, 'All'> {
  const haystack = `${item.action || ''} ${item.details || ''}`.toLowerCase();
  if (
    /password|pin|biometric|fingerprint|2fa|totp|login|sign|session|auth|security|key/.test(
      haystack
    )
  ) {
    return 'Security';
  }
  if (
    /bill|invoice|credit|payment|plan|wallet|voucher|subscription|charge|refund/.test(
      haystack
    )
  ) {
    return 'Billing';
  }
  return 'Profile';
}

interface UserSettingsScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onUserUpdated?: (patch: Partial<TiwloUser>) => void;
  onBack: () => void;
  onRequireAuth: () => void;
  fingerprintEnrolled?: boolean;
  onFingerprintChanged?: (enrolled: boolean) => void;
}

export const UserSettingsScreen: React.FC<UserSettingsScreenProps> = ({
  user,
  sessionToken,
  onUserUpdated,
  onBack,
  onRequireAuth,
  fingerprintEnrolled,
  onFingerprintChanged,
}) => {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [storeName, setStoreName] = useState(user?.storeName || '');
  const [bio, setBio] = useState('');
  const [businessCategory, setBusinessCategory] = useState<string>('E-Commerce');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [vatId, setVatId] = useState('');

  // Avatar URL toggle
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(user?.avatar || '');

  // Fingerprint & Biometric state
  const [biometricEnrolled, setBiometricEnrolled] = useState(
    Boolean(fingerprintEnrolled)
  );
  const [biometricDevice, setBiometricDevice] = useState('');
  const [useFingerprintSignIn, setUseFingerprintSignIn] = useState(
    Boolean(fingerprintEnrolled)
  );
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    checkBiometricAvailable()
      .then((hw) => {
        if (mounted) {
          setBiometricSupported(Boolean(hw.hardwarePresent && hw.available));
        }
      })
      .catch(() => {
        if (mounted) setBiometricSupported(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Password & PIN state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinPassword, setPinPassword] = useState('');
  const [hasPin, setHasPin] = useState(false);

  // Preferences state
  const [themeDensity, setThemeDensity] = useState<ThemeDensity>('Comfortable');
  const [language, setLanguage] = useState<string>('English');
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyOption>('USD $');
  const [timezone, setTimezone] = useState<string>('Asia/Dhaka (UTC+6)');
  const [securityPush, setSecurityPush] = useState(true);
  const [billingReceipts, setBillingReceipts] = useState(true);
  const [storeOrderAlerts, setStoreOrderAlerts] = useState(true);
  const [webhookFailures, setWebhookFailures] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  // Activity state
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('All');

  // Banner state
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    if (typeof fingerprintEnrolled === 'boolean') {
      setBiometricEnrolled(fingerprintEnrolled);
      if (fingerprintEnrolled) setUseFingerprintSignIn(true);
    }
  }, [fingerprintEnrolled]);

  const fetchBiometricStatus = useCallback(async () => {
    if (!sessionToken && !user) return;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
      const res = await fetch(`${TIWLO_API_BASE}/user/account/biometric/status`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => ({}))) as BiometricStatusResponse;
      const firstDevice =
        data.deviceName ||
        data.devices?.[0]?.deviceName ||
        data.devices?.[0]?.name ||
        '';
      const enrolled = Boolean(
        data.enrolled ?? data.hasBiometric ?? (firstDevice ? true : false)
      );
      setBiometricEnrolled(enrolled);
      setBiometricDevice(firstDevice);
      if (typeof data.useForSignIn === 'boolean') {
        setUseFingerprintSignIn(data.useForSignIn);
      } else if (typeof data.enabled === 'boolean') {
        setUseFingerprintSignIn(data.enabled);
      } else {
        setUseFingerprintSignIn(enrolled);
      }
    } catch {
      // Optional status probe
    }
  }, [sessionToken, user]);

  const loadSettings = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const [acctRes, logRes] = await Promise.allSettled([
        fetchAccountDetails(sessionToken),
        fetchAccountActivityLog(sessionToken),
        fetchBiometricStatus(),
      ]);
      if (acctRes.status === 'fulfilled') {
        const raw = (acctRes.value.user || acctRes.value.account) as
          | (AccountProfilePayload & Record<string, unknown>)
          | undefined;
        if (raw) {
          if (typeof raw.name === 'string') setName(raw.name);
          if (typeof raw.handle === 'string') setHandle(raw.handle);
          else if (typeof raw.displayHandle === 'string') setHandle(raw.displayHandle);
          if (typeof raw.email === 'string') setEmail(raw.email);
          if (typeof raw.recoveryEmail === 'string') setRecoveryEmail(raw.recoveryEmail);
          if (typeof raw.phone === 'string') setPhone(raw.phone);
          if (typeof raw.storeName === 'string') setStoreName(raw.storeName);
          if (typeof raw.bio === 'string') setBio(raw.bio);
          if (typeof raw.businessCategory === 'string' && raw.businessCategory) {
            setBusinessCategory(raw.businessCategory);
          }
          if (typeof raw.country === 'string') setCountry(raw.country);
          if (typeof raw.city === 'string') setCity(raw.city);
          if (typeof raw.postalCode === 'string') setPostalCode(raw.postalCode);
          if (typeof raw.vatId === 'string') setVatId(raw.vatId);
          else if (typeof raw.taxId === 'string') setVatId(raw.taxId);
          if (typeof raw.avatar === 'string') {
            setAvatarUrl(raw.avatar);
            setAvatarDraft(raw.avatar);
          }
          if (typeof raw.timezone === 'string' && raw.timezone) setTimezone(raw.timezone);
          if (typeof raw.language === 'string' && raw.language) setLanguage(raw.language);
          if (
            raw.themeDensity === 'Comfortable' ||
            raw.themeDensity === 'Compact'
          ) {
            setThemeDensity(raw.themeDensity);
          }
          if (typeof raw.currency === 'string') {
            if (raw.currency.includes('BDT')) setDefaultCurrency('BDT ৳');
            else if (raw.currency.includes('EUR')) setDefaultCurrency('EUR €');
            else if (raw.currency.includes('USD')) setDefaultCurrency('USD $');
          }
          const prefs = raw.notifications as Record<string, unknown> | undefined;
          if (prefs && typeof prefs === 'object') {
            if (typeof prefs.securityPush === 'boolean') setSecurityPush(prefs.securityPush);
            if (typeof prefs.billingReceipts === 'boolean') setBillingReceipts(prefs.billingReceipts);
            if (typeof prefs.storeOrderAlerts === 'boolean') setStoreOrderAlerts(prefs.storeOrderAlerts);
            if (typeof prefs.webhookFailures === 'boolean') setWebhookFailures(prefs.webhookFailures);
            if (typeof prefs.weeklyDigest === 'boolean') setWeeklyDigest(prefs.weeklyDigest);
          }
          setHasPin(Boolean(raw.hasSecurityPin));
        }
      }
      if (logRes.status === 'fulfilled') {
        setLogs(logRes.value.logs || logRes.value.activities || []);
      }
    } finally {
      setRefreshing(false);
    }
  }, [fetchBiometricStatus, sessionToken, user]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveAvatar = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    const cleanUrl = avatarDraft.trim();
    setSaving(true);
    try {
      await updateAccountProfile({ avatar: cleanUrl }, sessionToken);
      setAvatarUrl(cleanUrl);
      setAvatarEditorOpen(false);
      onUserUpdated?.({ avatar: cleanUrl });
      setBannerTone('success');
      setBanner('Avatar updated.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not update avatar URL.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        handle: handle.trim(),
        displayHandle: handle.trim(),
        recoveryEmail: recoveryEmail.trim(),
        phone: phone.trim(),
        storeName: storeName.trim(),
        bio: bio.trim(),
        businessCategory,
        country: country.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        vatId: vatId.trim(),
        timezone,
        language,
      } as Partial<AccountProfilePayload>;

      await updateAccountProfile(payload, sessionToken);
      onUserUpdated?.({
        name: name.trim(),
        phone: phone.trim(),
        storeName: storeName.trim(),
      });
      setBannerTone('success');
      setBanner('Profile settings saved.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFingerprintSignIn = async (nextValue: boolean) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (nextValue && !biometricEnrolled) {
      setDrawerVisible(true);
      return;
    }
    setUseFingerprintSignIn(nextValue);
    onFingerprintChanged?.(nextValue && biometricEnrolled);
    try {
      await updateAccountProfile(
        { biometricSignInEnabled: nextValue } as Partial<AccountProfilePayload>,
        sessionToken
      );
      setBannerTone('info');
      setBanner(
        nextValue
          ? 'Fingerprint sign-in enabled on this device.'
          : 'Fingerprint sign-in paused on this device.'
      );
    } catch {
      // Keep local toggle responsive even if profile field is optional
    }
  };

  const handleChangePassword = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!currentPassword || newPassword.length < 8) {
      setBannerTone('error');
      setBanner('Enter current password and at least 8 characters for the new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setBannerTone('error');
      setBanner('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      await updateAccountPassword({ currentPassword, newPassword }, sessionToken);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setBannerTone('success');
      setBanner('Account password updated.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!/^\d{6}$/.test(pinInput)) {
      setBannerTone('error');
      setBanner('Security PIN must be 6 digits.');
      return;
    }
    setSaving(true);
    try {
      await updateSecurityPin(pinInput, pinPassword, sessionToken);
      setHasPin(true);
      setPinInput('');
      setPinPassword('');
      setBannerTone('success');
      setBanner('6-digit Security PIN saved.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not save PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePin = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    try {
      await removeSecurityPin(pinPassword, sessionToken);
      setHasPin(false);
      setPinPassword('');
      setBannerTone('info');
      setBanner('Security PIN removed.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not remove PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    try {
      const currencyCode = defaultCurrency.split(' ')[0] || 'USD';
      await updateAccountProfile(
        {
          themeDensity,
          language,
          currency: currencyCode,
          timezone,
          notifications: {
            securityPush,
            billingReceipts,
            storeOrderAlerts,
            webhookFailures,
            weeklyDigest,
          },
        } as Partial<AccountProfilePayload>,
        sessionToken
      );
      setBannerTone('success');
      setBanner('Preferences & notification rules saved.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = resolveAvatarUri(avatarUrl || user?.avatar);
  const pwStrength = useMemo(
    () => evaluatePasswordStrength(newPassword),
    [newPassword]
  );
  const passwordMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  const filteredLogs = useMemo(() => {
    if (activityFilter === 'All') return logs;
    return logs.filter((item) => classifyActivity(item) === activityFilter);
  }, [activityFilter, logs]);

  const isVerified = Boolean(user?.identityVerified);

  return (
    <AccountPageShell
      title="User Settings"
      onBack={onBack}
      onRefresh={() => void loadSettings()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Top Flat Profile Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={styles.avatarHolder}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <UserRound size={24} strokeWidth={1.9} color={colors.foreground} />
            )}
          </View>

          <View style={styles.profileMeta}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name || user?.tiwiId || 'Tiwlo Account'}
            </Text>
            <Text style={styles.profileTiwiId} numberOfLines={1}>
              {user?.tiwiId
                ? `Tiwi ID: ${user.tiwiId}`
                : email || 'Sign in to sync settings'}
            </Text>
          </View>

          {!user ? (
            <TouchableOpacity
              style={styles.miniPrimaryBtn}
              onPress={onRequireAuth}
              activeOpacity={0.85}
            >
              <Text style={styles.miniPrimaryBtnText}>Sign in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.avatarToggleBtn}
              onPress={() => setAvatarEditorOpen((p) => !p)}
              activeOpacity={0.8}
            >
              <Pencil size={13} strokeWidth={2} color={colors.foreground} />
              <Text style={styles.avatarToggleText}>Avatar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>
              {user?.role ? user.role.toUpperCase() : 'MEMBER'}
            </Text>
          </View>

          <View
            style={[
              styles.verifyPill,
              isVerified ? styles.verifyPillSuccess : styles.verifyPillPending,
            ]}
          >
            <BadgeCheck
              size={13}
              strokeWidth={2.1}
              color={isVerified ? colors.primaryHover : colors.warning}
            />
            <Text
              style={[
                styles.verifyPillText,
                isVerified
                  ? styles.verifyPillTextSuccess
                  : styles.verifyPillTextPending,
              ]}
            >
              {isVerified ? 'Identity Verified' : 'Standard Account'}
            </Text>
          </View>
        </View>

        {avatarEditorOpen ? (
          <View style={styles.avatarEditorWrap}>
            <TextInput
              style={styles.avatarUrlInput}
              value={avatarDraft}
              onChangeText={setAvatarDraft}
              placeholder="https://... or /uploads/avatar.png"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.miniPrimaryBtn}
              onPress={() => void handleSaveAvatar()}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.miniPrimaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* 4 Segmented Tabs */}
      <View style={styles.segmentWrap}>
        {(
          [
            { key: 'profile', label: 'Profile' },
            { key: 'security', label: 'Password & Lock' },
            { key: 'preferences', label: 'Preferences' },
            { key: 'activity', label: 'Activity' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.segmentPill, active && styles.segmentPillActive]}
              onPress={() => setTab(item.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.segmentText, active && styles.segmentTextActive]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* TAB 1: PROFILE */}
      {tab === 'profile' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Personal & Workspace Identity</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.inputRow}>
              <UserRound size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Display Handle</Text>
            <View style={styles.inputRow}>
              <AtSign size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={handle}
                onChangeText={setHandle}
                placeholder="tiwlo_handle"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelWithTag}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              {email ? (
                <View style={styles.verifiedTag}>
                  <CheckCircle2
                    size={12}
                    strokeWidth={2.2}
                    color={colors.primaryHover}
                  />
                  <Text style={styles.verifiedTagText}>Verified</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.inputRow}>
              <Mail size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={email}
                editable={false}
                placeholder="Account email"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Recovery Email</Text>
            <View style={styles.inputRow}>
              <Mail size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={recoveryEmail}
                onChangeText={setRecoveryEmail}
                placeholder="backup@domain.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={styles.inputRow}>
              <Phone size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={phone}
                onChangeText={setPhone}
                placeholder="+880..."
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Store / Workspace Name</Text>
            <View style={styles.inputRow}>
              <Store size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="Store or company name"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Bio / Role Note</Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textAreaField}
                value={bio}
                onChangeText={setBio}
                placeholder="Founder, store operator, or engineering lead..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelWithIcon}>
              <Briefcase size={14} strokeWidth={1.9} color={colors.muted} />
              <Text style={styles.fieldLabel}>Business Category</Text>
            </View>
            <View style={styles.pillGrid}>
              {BUSINESS_CATEGORIES.map((category) => {
                const selected = businessCategory === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.choicePill, selected && styles.choicePillActive]}
                    onPress={() => setBusinessCategory(category)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        selected && styles.choicePillTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Location & Tax Profile</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Country</Text>
            <CountryPickerField
              value={country}
              onChange={(countryName) => setCountry(countryName)}
              placeholder="Select country"
              title="Select country"
            />
          </View>

          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                style={styles.inputBox}
                value={city}
                onChangeText={setCity}
                placeholder="Dhaka"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 0.75 }]}>
              <Text style={styles.fieldLabel}>Postal Code</Text>
              <TextInput
                style={styles.inputBox}
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="1212"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>VAT / Tax ID</Text>
            <View style={styles.inputRow}>
              <FileText size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={vatId}
                onChangeText={setVatId}
                placeholder="Optional BIN / VAT registration"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.disabledBtn]}
            disabled={saving}
            onPress={() => void handleSaveProfile()}
            activeOpacity={0.85}
          >
            <Save size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving...' : 'Save Profile Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 2: PASSWORD & LOCK */}
      {tab === 'security' && (
        <View style={styles.section}>
          {(biometricSupported || biometricEnrolled) && (
            <>
              {/* Fingerprint Password Section right next to Password (shown only on devices with fingerprint available or already enrolled) */}
              <View style={styles.surfacePanel}>
            <View style={styles.fingerprintHeader}>
              <View style={styles.fpIconCircle}>
                <Fingerprint
                  size={22}
                  strokeWidth={2}
                  color={biometricEnrolled ? colors.primaryHover : colors.foreground}
                />
              </View>
              <View style={styles.profileMeta}>
                <Text style={styles.panelTitle}>Fingerprint Password</Text>
                <View style={styles.fpStatusRow}>
                  <View
                    style={[
                      styles.fpStatusPill,
                      biometricEnrolled
                        ? styles.fpStatusEnrolled
                        : styles.fpStatusUnset,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fpStatusText,
                        biometricEnrolled && styles.fpStatusTextEnrolled,
                      ]}
                    >
                      {biometricEnrolled
                        ? `Enrolled on ${biometricDevice || 'this device'}`
                        : 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                if (!user) {
                  onRequireAuth();
                  return;
                }
                setDrawerVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Fingerprint size={17} strokeWidth={2} color={colors.ink} />
              <Text style={styles.primaryBtnText}>
                {biometricEnrolled ? 'Update Fingerprint' : 'Add Fingerprint'}
              </Text>
            </TouchableOpacity>

            <View style={styles.hairline} />

            <View style={styles.prefRow}>
              <View style={styles.profileMeta}>
                <Text style={styles.rowTitle}>Use Fingerprint to Sign In</Text>
                <Text style={styles.rowSub}>
                  Unlock Tiwlo with hardware biometric passkey
                </Text>
              </View>
              <Switch
                value={useFingerprintSignIn}
                onValueChange={(val) => void handleToggleFingerprintSignIn(val)}
                trackColor={{ false: '#E4E4E7', true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

              <Text style={styles.fpFootNote}>
                Enrolled fingerprints can also be removed anytime from Tiwlo Website User Settings.
              </Text>
              </View>

              <View style={styles.divider} />
            </>
          )}

          {/* Account Password Section */}
          <Text style={styles.sectionLabel}>Account Password</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Current Password</Text>
            <View style={styles.inputRow}>
              <Lock size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPw}
                placeholder="Enter current password"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowCurrentPw((p) => !p)}>
                {showCurrentPw ? (
                  <EyeOff size={16} strokeWidth={1.9} color={colors.muted} />
                ) : (
                  <Eye size={16} strokeWidth={1.9} color={colors.muted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={styles.inputRow}>
              <KeyRound size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPw}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowNewPw((p) => !p)}>
                {showNewPw ? (
                  <EyeOff size={16} strokeWidth={1.9} color={colors.muted} />
                ) : (
                  <Eye size={16} strokeWidth={1.9} color={colors.muted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Live Password Strength Bar */}
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBars}>
                {[1, 2, 3].map((segment) => (
                  <View
                    key={segment}
                    style={[
                      styles.strengthBarSegment,
                      pwStrength.score >= segment && {
                        backgroundColor: pwStrength.color,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text
                style={[
                  styles.strengthLabel,
                  pwStrength.score > 0 && { color: pwStrength.color },
                ]}
              >
                {pwStrength.label || 'Enter password'}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <View style={styles.inputRow}>
              <ShieldCheck size={16} strokeWidth={1.9} color={colors.muted} />
              <TextInput
                style={styles.inputField}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPw}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowConfirmPw((p) => !p)}>
                {showConfirmPw ? (
                  <EyeOff size={16} strokeWidth={1.9} color={colors.muted} />
                ) : (
                  <Eye size={16} strokeWidth={1.9} color={colors.muted} />
                )}
              </TouchableOpacity>
            </View>
            {passwordMismatch ? (
              <Text style={styles.mismatchText}>Passwords do not match.</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.disabledBtn]}
            disabled={saving}
            onPress={() => void handleChangePassword()}
            activeOpacity={0.85}
          >
            <Shield size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Update Password</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* 6-Digit Security PIN Section */}
          <View style={styles.labelWithTag}>
            <Text style={styles.sectionLabel}>6-Digit Security PIN</Text>
            <View
              style={[
                styles.fpStatusPill,
                hasPin ? styles.fpStatusEnrolled : styles.fpStatusUnset,
              ]}
            >
              <Text
                style={[
                  styles.fpStatusText,
                  hasPin && styles.fpStatusTextEnrolled,
                ]}
              >
                {hasPin ? 'Active' : 'Not set'}
              </Text>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>New 6-Digit PIN</Text>
            <TextInput
              style={styles.inputBox}
              value={pinInput}
              onChangeText={(t) => setPinInput(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Confirm with Account Password</Text>
            <TextInput
              style={styles.inputBox}
              value={pinPassword}
              onChangeText={setPinPassword}
              secureTextEntry
              placeholder="Current account password"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }, saving && styles.disabledBtn]}
              disabled={saving}
              onPress={() => void handleSavePin()}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {hasPin ? 'Update PIN' : 'Enable PIN'}
              </Text>
            </TouchableOpacity>
            {hasPin ? (
              <TouchableOpacity
                style={styles.dangerSoftBtn}
                disabled={saving}
                onPress={() => void handleRemovePin()}
                activeOpacity={0.85}
              >
                <Text style={styles.dangerSoftText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* TAB 3: PREFERENCES */}
      {tab === 'preferences' && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Workspace & Regional</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Theme Density</Text>
            <View style={styles.pillGrid}>
              {(['Comfortable', 'Compact'] as const).map((option) => {
                const selected = themeDensity === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.choicePill, selected && styles.choicePillActive]}
                    onPress={() => setThemeDensity(option)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        selected && styles.choicePillTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelWithIcon}>
              <Globe size={14} strokeWidth={1.9} color={colors.muted} />
              <Text style={styles.fieldLabel}>Language</Text>
            </View>
            <View style={styles.pillGrid}>
              {LANGUAGES.map((lang) => {
                const selected = language === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.choicePill, selected && styles.choicePillActive]}
                    onPress={() => setLanguage(lang)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        selected && styles.choicePillTextActive,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Default Currency</Text>
            <View style={styles.pillGrid}>
              {CURRENCIES.map((curr) => {
                const selected = defaultCurrency === curr;
                return (
                  <TouchableOpacity
                    key={curr}
                    style={[styles.choicePill, selected && styles.choicePillActive]}
                    onPress={() => setDefaultCurrency(curr)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        selected && styles.choicePillTextActive,
                      ]}
                    >
                      {curr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.labelWithIcon}>
              <Clock size={14} strokeWidth={1.9} color={colors.muted} />
              <Text style={styles.fieldLabel}>Timezone</Text>
            </View>
            <View style={styles.pillGrid}>
              {TIMEZONES.map((tz) => {
                const selected = timezone === tz;
                return (
                  <TouchableOpacity
                    key={tz}
                    style={[styles.choicePill, selected && styles.choicePillActive]}
                    onPress={() => setTimezone(tz)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.choicePillText,
                        selected && styles.choicePillTextActive,
                      ]}
                    >
                      {tz}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Notifications & Alerts</Text>

          <View style={styles.prefRow}>
            <Shield size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.profileMeta}>
              <Text style={styles.rowTitle}>Security Alerts Push</Text>
              <Text style={styles.rowSub}>New device logins & biometric updates</Text>
            </View>
            <Switch
              value={securityPush}
              onValueChange={setSecurityPush}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.hairline} />

          <View style={styles.prefRow}>
            <Receipt size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.profileMeta}>
              <Text style={styles.rowTitle}>Billing Receipts</Text>
              <Text style={styles.rowSub}>Invoice PDFs and credit top-up confirmations</Text>
            </View>
            <Switch
              value={billingReceipts}
              onValueChange={setBillingReceipts}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.hairline} />

          <View style={styles.prefRow}>
            <Store size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.profileMeta}>
              <Text style={styles.rowTitle}>Store Order Alerts</Text>
              <Text style={styles.rowSub}>Instant notice on checkout & fulfillment</Text>
            </View>
            <Switch
              value={storeOrderAlerts}
              onValueChange={setStoreOrderAlerts}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.hairline} />

          <View style={styles.prefRow}>
            <Webhook size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.profileMeta}>
              <Text style={styles.rowTitle}>Webhook Failures</Text>
              <Text style={styles.rowSub}>Retry alerts for failed API callbacks</Text>
            </View>
            <Switch
              value={webhookFailures}
              onValueChange={setWebhookFailures}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.hairline} />

          <View style={styles.prefRow}>
            <Bell size={18} strokeWidth={1.9} color={colors.muted} />
            <View style={styles.profileMeta}>
              <Text style={styles.rowTitle}>Weekly Analytics Digest</Text>
              <Text style={styles.rowSub}>Store traffic, revenue & droplet summary</Text>
            </View>
            <Switch
              value={weeklyDigest}
              onValueChange={setWeeklyDigest}
              trackColor={{ false: '#E4E4E7', true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.disabledBtn]}
            disabled={saving}
            onPress={() => void handleSavePreferences()}
            activeOpacity={0.85}
          >
            <Save size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving...' : 'Save Preferences'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* TAB 4: ACTIVITY */}
      {tab === 'activity' && (
        <View style={styles.section}>
          <View style={styles.pillGrid}>
            {ACTIVITY_FILTERS.map((filter) => {
              const active = activityFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.choicePill, active && styles.choicePillActive]}
                  onPress={() => setActivityFilter(filter)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.choicePillText,
                      active && styles.choicePillTextActive,
                    ]}
                  >
                    {filter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filteredLogs.length === 0 ? (
            <Text style={styles.emptyText}>
              {user
                ? `No ${activityFilter === 'All' ? '' : `${activityFilter.toLowerCase()} `}activity recorded.`
                : 'Sign in to view activity log.'}
            </Text>
          ) : (
            filteredLogs.slice(0, 25).map((item, idx) => (
              <React.Fragment key={item.id || `${item.action}-${idx}`}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <View style={styles.prefRow}>
                  <View style={styles.activityIconCircle}>
                    <Activity
                      size={15}
                      strokeWidth={2}
                      color={colors.primaryHover}
                    />
                  </View>
                  <View style={styles.profileMeta}>
                    <Text style={styles.rowTitle}>{item.action}</Text>
                    <Text style={styles.rowSub}>
                      {[item.details, item.ip, item.createdAt]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              </React.Fragment>
            ))
          )}
        </View>
      )}

      <FingerprintDrawer
        visible={drawerVisible}
        isUpdate={biometricEnrolled}
        userEmailOrId={email || user?.tiwiId || user?.id}
        sessionToken={sessionToken}
        onEnrolled={(deviceName) => {
          const userKey = user?.id || user?.tiwiId || user?.email || 'default';
          void suppressFingerprintPrompt(userKey, 'enrolled');
          setBiometricEnrolled(true);
          setBiometricDevice(deviceName);
          setUseFingerprintSignIn(true);
          onFingerprintChanged?.(true);
          setBannerTone('success');
          setBanner(`Fingerprint enrolled on ${deviceName}.`);
          void fetchBiometricStatus();
        }}
        onDismiss={() => setDrawerVisible(false)}
      />
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarHolder: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 999,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.foreground,
  },
  profileTiwiId: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  avatarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  avatarToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: 0.4,
  },
  verifyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  verifyPillSuccess: {
    backgroundColor: colors.primarySoft,
  },
  verifyPillPending: {
    backgroundColor: colors.warningSoft,
  },
  verifyPillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  verifyPillTextSuccess: {
    color: colors.primaryHover,
  },
  verifyPillTextPending: {
    color: colors.warning,
  },
  avatarEditorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarUrlInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    fontSize: 13,
    color: colors.foreground,
  },
  miniPrimaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
  },
  miniPrimaryBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: colors.background,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
  },
  segmentTextActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  section: {
    gap: 14,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.foreground,
  },
  labelWithTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  inputRow: {
    height: 45,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
  },
  inputBox: {
    height: 45,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.foreground,
  },
  textAreaWrap: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    minHeight: 82,
  },
  textAreaField: {
    fontSize: 14,
    color: colors.foreground,
    minHeight: 62,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choicePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
  },
  choicePillActive: {
    backgroundColor: colors.primarySoft,
  },
  choicePillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  choicePillTextActive: {
    color: colors.primaryHover,
    fontWeight: '700',
  },
  surfacePanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 13,
  },
  fingerprintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  fpStatusRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  fpStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  fpStatusEnrolled: {
    backgroundColor: colors.primarySoft,
  },
  fpStatusUnset: {
    backgroundColor: colors.background,
  },
  fpStatusText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.muted,
  },
  fpStatusTextEnrolled: {
    color: colors.primaryHover,
  },
  fpFootNote: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  strengthBarSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  strengthLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.muted,
    minWidth: 50,
    textAlign: 'right',
  },
  mismatchText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.danger,
  },
  primaryBtn: {
    height: 47,
    borderRadius: 11,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dangerSoftBtn: {
    paddingHorizontal: 18,
    height: 47,
    borderRadius: 11,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerSoftText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.danger,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 5,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  rowSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    paddingVertical: 12,
  },
});
