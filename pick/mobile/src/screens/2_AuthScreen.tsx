import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { PickLogo } from '../components/common/PickLogo';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import { AddressVerificationScreen } from './AddressVerificationScreen';
import {
  AuthChallenge,
  PickUser,
  clearPendingAuthChallenge,
  getPendingAuthChallenge,
  loginPickAccount,
  AuthRateLimitError,
  requestPickPasswordReset,
  resetPickPassword,
  resendPickEmailVerification,
  resendPickTwoFactor,
  savePendingAuthChallenge,
  startPickSocialSignIn,
  startTiwloSignIn,
  verifyPickEmail,
  verifyPickTwoFactor,
  verifyPickPasswordResetCode
} from '../services/auth';
import {
  COUNTRY_DIALING_OPTIONS,
  DEFAULT_COUNTRY_DIALING_OPTION
} from '../utils/countryDialing';
import type { CountryDialingOption } from '../utils/countryDialing';

type AuthStep = 'form' | 'email' | 'address' | 'two_factor' |
  'forgot_request' | 'forgot_code' | 'forgot_new_password';
type AuthMode = 'login' | 'signup';

interface AuthScreenProps {
  onAuthenticated: (user: PickUser) => void;
  offline?: boolean;
}

function isAuthChallenge(value: unknown): value is AuthChallenge {
  return Boolean(value && typeof value === 'object' && 'success' in value);
}

function normalizePhoneIdentifier(value: string, dialingCode: string): string {
  const identifier = value.trim();
  if (!identifier || !/^[\d\s().+-]+$/.test(identifier)) return identifier;
  if (identifier.startsWith('+')) return `+${identifier.slice(1).replace(/\D/g, '')}`;
  if (identifier.startsWith('00')) return `+${identifier.slice(2).replace(/\D/g, '')}`;

  let digits = identifier.replace(/\D/g, '');
  const countryDigits = dialingCode.replace(/\D/g, '');
  if (digits.startsWith(countryDigits)) return `+${digits}`;
  digits = digits.replace(/^0+/, '');
  return digits ? `${dialingCode}${digits}` : identifier;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated, offline = false }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('login');
  const [step, setStep] = useState<AuthStep>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY_DIALING_OPTION);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryGrant, setRecoveryGrant] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const timer = setTimeout(() => setResendCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const beginChallenge = (result: AuthChallenge) => {
    setChallenge(result);
    setCode('');
    setNotice(result.message || '');
    setResendCountdown(60);
    if (result.isBanned && result.user) onAuthenticated(result.user);
    else if (result.requiresAddressVerification && result.tempToken) setStep('address');
    else if (result.requiresEmailVerification) setStep('email');
    else if (result.requires2FA || result.requires2FASetup) setStep('two_factor');
    else if (result.user) onAuthenticated(result.user);
    else setError(result.message || t('Sign-in could not be completed.', 'লগইন সম্পন্ন করা যায়নি।'));
  };

  useEffect(() => {
    let active = true;
    getPendingAuthChallenge()
      .then((pendingChallenge) => {
        if (!active || !pendingChallenge) return;
        setChallenge(pendingChallenge);
        if (pendingChallenge.requiresAddressVerification) setStep('address');
        else if (pendingChallenge.requiresEmailVerification) setStep('email');
        else if (pendingChallenge.requires2FA || pendingChallenge.requires2FASetup) setStep('two_factor');
      })
      .catch((error: unknown) => {
        if (active) {
          setError(error instanceof Error
            ? error.message
            : 'Could not restore your sign-in verification.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
    } catch (caught) {
      if (caught instanceof AuthRateLimitError) {
        setResendCountdown(caught.retryAfterSeconds ?? 60);
      }
      setError(caught instanceof Error ? caught.message : t('Something went wrong. Please try again.', 'সমস্যা হয়েছে। আবার চেষ্টা করুন।'));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = () => run(async () => {
    beginChallenge(await loginPickAccount(normalizePhoneIdentifier(email, selectedCountry.dial), password));
  });

  const handleTiwloSignUp = () => run(async () => {
    const result = await startTiwloSignIn('signup');
    if (result) onAuthenticated(result.user);
  });

  const handleSocialSignIn = (provider: 'google' | 'github') => run(async () => {
    const result = await startPickSocialSignIn(provider);
    if (!result) return;
    if ('sessionToken' in result && result.user) {
      onAuthenticated(result.user);
      return;
    }
    if (isAuthChallenge(result)) {
      beginChallenge(result);
      return;
    }
    throw new Error(t('Could not complete social sign-in.', 'সোশ্যাল লগইন সম্পন্ন করা যায়নি।'));
  });

  const handleCodeSubmit = () => run(async () => {
    if (!challenge?.tempToken) throw new Error(t('Verification session expired. Start again.', 'যাচাইকরণের সময় শেষ। আবার শুরু করুন।'));
    if (!/^\d{6}$/.test(code.trim())) throw new Error(t('Enter the 6-digit code from your email.', 'ইমেইলে পাওয়া ৬ সংখ্যার কোড লিখুন।'));
    if (step === 'email') {
      beginChallenge(await verifyPickEmail(challenge.tempToken, code.trim()));
      return;
    }
    const result = await verifyPickTwoFactor(
      challenge.tempToken,
      code.trim(),
      challenge.requires2FASetup === true
    );
    if (result.user) onAuthenticated(result.user);
    else beginChallenge(result);
  });

  const handleResend = () => run(async () => {
    if (resendCountdown > 0) return;
    if (!challenge?.tempToken) throw new Error(t('Verification session expired. Start again.', 'যাচাইকরণের সময় শেষ। আবার শুরু করুন।'));
    const result = step === 'email'
      ? await resendPickEmailVerification(challenge.tempToken)
      : await resendPickTwoFactor(challenge.tempToken, challenge.requires2FASetup === true);
    setChallenge((current) => current ? { ...current, ...result } : result);
    setNotice(result.message || t('A new code has been requested.', 'নতুন কোড পাঠানোর অনুরোধ করা হয়েছে।'));
    setCode('');
    setResendCountdown(60);
  });

  const handlePasswordResetRequest = () => run(async () => {
    if (!email.trim()) throw new Error(t('Enter your email or Tiwi ID.', 'আপনার ইমেইল অথবা Tiwi ID লিখুন।'));
    const result = await requestPickPasswordReset(email.trim());
    setRecoveryToken(result.resetToken);
    setRecoveryEmail(result.emailMasked);
    setStep('forgot_code');
    setCode('');
    setResendCountdown(60);
    setNotice(t(`A recovery code was sent to ${result.emailMasked}.`, `${result.emailMasked}-এ রিকভারি কোড পাঠানো হয়েছে।`));
  });

  const handlePasswordResetResend = () => run(async () => {
    if (resendCountdown > 0) return;
    if (!email.trim()) throw new Error(t('Enter your email or Tiwi ID.', 'আপনার ইমেইল অথবা Tiwi ID লিখুন।'));
    const result = await requestPickPasswordReset(email.trim());
    setRecoveryToken(result.resetToken);
    setRecoveryEmail(result.emailMasked);
    setCode('');
    setResendCountdown(60);
    setNotice(t(`A new recovery code was sent to ${result.emailMasked}.`, `${result.emailMasked}-এ নতুন রিকভারি কোড পাঠানো হয়েছে।`));
  });

  const handlePasswordResetCode = () => run(async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      throw new Error(t('Enter the 6-digit code from your email.', 'ইমেইলে পাওয়া ৬ সংখ্যার কোড লিখুন।'));
    }
    const grant = await verifyPickPasswordResetCode(recoveryToken, code.trim());
    setRecoveryGrant(grant);
    setCode('');
    setStep('forgot_new_password');
    setNotice('');
  });

  const handlePasswordReset = () => run(async () => {
    if (newPassword.length < 6) throw new Error(t('Use at least 6 characters for your password.', 'পাসওয়ার্ডে অন্তত ৬টি অক্ষর দিন।'));
    if (newPassword !== confirmNewPassword) throw new Error(t('Passwords do not match.', 'পাসওয়ার্ড দুটি মিলছে না।'));
    await resetPickPassword(recoveryGrant, newPassword);
    setPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryGrant('');
    setRecoveryToken('');
    setStep('form');
    setNotice(t('Password updated. Sign in with your new password.', 'পাসওয়ার্ড পরিবর্তিত হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'));
  });

  const handlePreAuthAddressVerified = () => {
    if (!challenge) return;
    const updatedChallenge = { ...challenge, requiresAddressVerification: false };
    setChallenge(updatedChallenge);
    setNotice(t('Address verified. Continue with 2-step verification.', 'ঠিকানা যাচাই হয়েছে। এখন ২-ধাপ যাচাই করুন।'));
    setStep('two_factor');
    void savePendingAuthChallenge(updatedChallenge).catch((saveError: unknown) => {
      setError(saveError instanceof Error
        ? saveError.message
        : t('Could not save your sign-in progress.', 'লগইনের অগ্রগতি সংরক্ষণ করা যায়নি।'));
    });
  };

  const changeMode = (nextMode: AuthMode) => {
    void clearPendingAuthChallenge();
    setMode(nextMode);
    setStep('form');
    setChallenge(null);
    setError('');
    setNotice('');
    setCode('');
    setResendCountdown(0);
  };

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    options: {
      placeholder?: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      secureTextEntry?: boolean;
      multiline?: boolean;
    } = {}
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, options.multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={options.placeholder || label}
        placeholderTextColor="#A1A1AA"
        keyboardType={options.keyboardType || 'default'}
        autoCapitalize={options.autoCapitalize || 'sentences'}
        autoCorrect={false}
        secureTextEntry={options.secureTextEntry}
        multiline={options.multiline}
        textAlignVertical={options.multiline ? 'top' : 'center'}
        editable={!busy}
      />
    </View>
  );

  const isSetup = challenge?.requires2FASetup === true;
  const destination = challenge?.emailMasked || challenge?.email || '';

  if (step === 'address' && challenge?.tempToken) {
    return (
      <AddressVerificationScreen
        preAuthTempToken={challenge.tempToken}
        onPreAuthComplete={handlePreAuthAddressVerified}
        onCancelPreAuth={() => run(async () => {
          await clearPendingAuthChallenge();
          setChallenge(null);
          setStep('form');
          setError('');
          setNotice('');
        })}
      />
    );
  }

  return (
    <ScreenContainer dark={false} applyTopInset applyBottomInset={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: SYSTEM_INSETS.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <PickLogo variant="stacked-black" width={94} height={72} />
          </View>
          {offline && (
            <Text accessibilityRole="alert" style={styles.offlineNotice}>
              {t(
                'You’re offline. Your verification stays saved; reconnect to continue or sign out when you choose.',
                'আপনি অফলাইনে আছেন। যাচাইয়ের অগ্রগতি সংরক্ষিত আছে; চালিয়ে যেতে ইন্টারনেট চালু করুন অথবা চাইলে লগ আউট করুন।'
              )}
            </Text>
          )}

          {step === 'form' ? mode === 'login' ? (
            <>
              <Text style={styles.headline}>
                {t('Welcome back', 'আবার স্বাগতম')}
              </Text>
              <Text style={styles.helperText}>
                {t('Sign in with your phone, email or Tiwi ID.', 'ফোন, ইমেইল অথবা Tiwi ID দিয়ে লগইন করুন।')}
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>{t('Phone, email or Tiwi ID', 'ফোন, ইমেইল অথবা Tiwi ID')}</Text>
                <View style={styles.phoneInputRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('Choose country calling code', 'দেশের কলিং কোড বেছে নিন')}
                    style={styles.countryCodeButton}
                    onPress={() => setCountryPickerVisible(true)}
                    disabled={busy}
                  >
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryDial}>{selectedCountry.dial}</Text>
                    <Text style={styles.countryChevron}>⌄</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={t('Phone, email or Tiwi ID', 'ফোন, ইমেইল অথবা Tiwi ID')}
                    placeholderTextColor="#A1A1AA"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!busy}
                  />
                </View>
              </View>
              {field(t('Password', 'পাসওয়ার্ড'), password, setPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => {
                  setStep('forgot_request');
                  setError('');
                  setNotice('');
                }}
                disabled={busy}
              >
                <Text style={styles.forgotLinkText}>{t('Forgot password?', 'পাসওয়ার্ড ভুলে গেছেন?')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text style={styles.primaryButtonText}>{t('Sign in', 'লগইন')}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>{t('or continue with', 'অথবা ব্যবহার করুন')}</Text>
                <View style={styles.divider} />
              </View>
              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => handleSocialSignIn('google')}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialButtonText}>{t('Google', 'Google')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => handleSocialSignIn('github')}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialButtonText}>{t('GitHub', 'GitHub')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.modeLink}
                onPress={() => changeMode(mode === 'login' ? 'signup' : 'login')}
                disabled={busy}
              >
                <Text style={styles.modeLinkText}>
                  {mode === 'login'
                    ? t('New to PICK? Create an account', 'PICK-এ নতুন? অ্যাকাউন্ট তৈরি করুন')
                    : t('Already have an account? Sign in', 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.headline}>{t('Create your PICK account', 'আপনার PICK অ্যাকাউন্ট তৈরি করুন')}</Text>
              <Text style={styles.helperText}>
                {t('Create your account securely with Tiwlo or continue with a social account.', 'Tiwlo অথবা সোশ্যাল অ্যাকাউন্ট দিয়ে নিরাপদে অ্যাকাউন্ট তৈরি করুন।')}
              </Text>
              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => handleSocialSignIn('google')}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialButtonText}>{t('Google', 'Google')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={() => handleSocialSignIn('github')}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.socialButtonText}>{t('GitHub', 'GitHub')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>{t('or with Tiwlo', 'অথবা Tiwlo দিয়ে')}</Text>
                <View style={styles.divider} />
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handleTiwloSignUp}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.primaryButtonText}>{t('Continue with Tiwlo', 'Tiwlo দিয়ে চালিয়ে যান')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeLink} onPress={() => changeMode('login')} disabled={busy}>
                <Text style={styles.modeLinkText}>{t('Already have an account? Sign in', 'আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন')}</Text>
              </TouchableOpacity>
            </>
          ) : step === 'forgot_request' ? (
            <>
              <Text style={styles.headline}>{t('Reset your password', 'পাসওয়ার্ড রিসেট করুন')}</Text>
              <Text style={styles.helperText}>
                {t('Enter your account email or Tiwi ID and we’ll send a recovery code.', 'আপনার অ্যাকাউন্টের ইমেইল অথবা Tiwi ID দিন, আমরা রিকভারি কোড পাঠাব।')}
              </Text>
              {field(t('Email or Tiwi ID', 'ইমেইল অথবা Tiwi ID'), email, setEmail, { autoCapitalize: 'none' })}
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handlePasswordResetRequest}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('Send recovery code', 'রিকভারি কোড পাঠান')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => setStep('form')} disabled={busy}>
                <Text style={styles.backLinkText}>{t('Back to sign in', 'লগইনে ফিরে যান')}</Text>
              </TouchableOpacity>
            </>
          ) : step === 'forgot_code' ? (
            <>
              <Text style={styles.headline}>{t('Check your email', 'ইমেইল দেখুন')}</Text>
              <Text style={styles.helperText}>
                {t(`Enter the 6-digit recovery code sent to ${recoveryEmail}.`, `${recoveryEmail}-এ পাঠানো ৬ সংখ্যার রিকভারি কোড লিখুন।`)}
              </Text>
              {field(t('6-digit code', '৬ সংখ্যার কোড'), code, setCode, { keyboardType: 'number-pad', autoCapitalize: 'none' })}
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handlePasswordResetCode}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('Verify code', 'কোড যাচাই করুন')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modeLink}
                onPress={handlePasswordResetResend}
                disabled={busy || resendCountdown > 0}
              >
                <Text style={[styles.modeLinkText, resendCountdown > 0 && styles.mutedLink]}>
                  {resendCountdown > 0
                    ? t(`Resend code in ${resendCountdown}s`, `${resendCountdown} সেকেন্ড পর আবার কোড পাঠান`)
                    : t('Resend code', 'কোড আবার পাঠান')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => {
                  setStep('forgot_request');
                  setRecoveryToken('');
                  setResendCountdown(0);
                  setError('');
                }}
                disabled={busy}
              >
                <Text style={styles.backLinkText}>{t('Change account email', 'অ্যাকাউন্টের ইমেইল পরিবর্তন করুন')}</Text>
              </TouchableOpacity>
            </>
          ) : step === 'forgot_new_password' ? (
            <>
              <Text style={styles.headline}>{t('Choose a new password', 'নতুন পাসওয়ার্ড দিন')}</Text>
              {field(t('New password', 'নতুন পাসওয়ার্ড'), newPassword, setNewPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
              {field(t('Confirm new password', 'নতুন পাসওয়ার্ড নিশ্চিত করুন'), confirmNewPassword, setConfirmNewPassword, { secureTextEntry: true, autoCapitalize: 'none' })}
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handlePasswordReset}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('Update password', 'পাসওয়ার্ড আপডেট করুন')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.headline}>
                {step === 'email'
                  ? t('Verify your email', 'ইমেইল যাচাই করুন')
                  : isSetup
                    ? t('Set up 2-step verification', '২-ধাপ যাচাইকরণ চালু করুন')
                    : t('Confirm it’s you', 'আপনার পরিচয় নিশ্চিত করুন')}
              </Text>
              <Text style={styles.helperText}>
                {step === 'email'
                  ? t(`Enter the 6-digit code sent to ${destination}.`, `${destination}-এ পাঠানো ৬ সংখ্যার কোড লিখুন।`)
                  : t(`Enter the 6-digit security code sent to ${destination}.`, `${destination}-এ পাঠানো ৬ সংখ্যার নিরাপত্তা কোড লিখুন।`)}
              </Text>
              {field(t('6-digit code', '৬ সংখ্যার কোড'), code, setCode, {
                keyboardType: 'number-pad',
                autoCapitalize: 'none'
              })}
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handleCodeSubmit}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color="#FFFFFF" /> : (
                  <Text style={styles.primaryButtonText}>{t('Verify and continue', 'যাচাই করে এগিয়ে যান')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modeLink} onPress={handleResend} disabled={busy || resendCountdown > 0}>
                <Text style={[styles.modeLinkText, resendCountdown > 0 && styles.mutedLink]}>
                  {resendCountdown > 0
                    ? t(`Resend code in ${resendCountdown}s`, `${resendCountdown} সেকেন্ড পর আবার কোড পাঠান`)
                    : t('Resend code', 'কোড আবার পাঠান')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => run(async () => {
                  await clearPendingAuthChallenge();
                  setStep('form');
                  setChallenge(null);
                  setCode('');
                  setError('');
                  setNotice('');
                  setResendCountdown(0);
                })}
                disabled={busy}
              >
                <Text style={styles.backLinkText}>{t('Sign out', 'লগ আউট')}</Text>
              </TouchableOpacity>
            </>
          )}
          {Boolean(error) && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
          {Boolean(notice && !error) && <Text style={styles.noticeText}>{notice}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCountryPickerVisible(false);
          setCountrySearch('');
        }}
      >
        <View style={styles.countryModalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Close country picker', 'দেশের তালিকা বন্ধ করুন')}
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setCountryPickerVisible(false);
              setCountrySearch('');
            }}
          />
          <View style={styles.countrySheet}>
            <View style={styles.countryHandle} />
            <Text style={styles.countryTitle}>{t('Select country code', 'দেশের কোড বেছে নিন')}</Text>
            <TextInput
              style={styles.countrySearch}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder={t('Search country or code', 'দেশ বা কোড খুঁজুন')}
              placeholderTextColor="#A1A1AA"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FlatList
              data={COUNTRY_DIALING_OPTIONS.filter((country) =>
                `${country.name} ${country.code} ${country.dial}`
                  .toLowerCase()
                  .includes(countrySearch.trim().toLowerCase())
              )}
              keyExtractor={(country) => country.code}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={20}
              renderItem={({ item }: { item: CountryDialingOption }) => (
                <Pressable
                  accessibilityRole="button"
                  style={styles.countryOption}
                  onPress={() => {
                    setSelectedCountry(item);
                    setCountryPickerVisible(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.countryOptionFlag}>{item.flag}</Text>
                  <Text numberOfLines={1} style={styles.countryOptionName}>{item.name}</Text>
                  <Text style={styles.countryOptionDial}>{item.dial}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 },
  logoWrap: { marginBottom: 22 },
  headline: { fontSize: 26, fontWeight: '700', color: '#09090B', marginBottom: 6, letterSpacing: -0.4 },
  helperText: { fontSize: 15, lineHeight: 22, color: '#71717A', marginBottom: 22 },
  offlineNotice: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    borderRadius: 9,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  fieldGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: '600', color: '#3F3F46', marginBottom: 7 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    paddingHorizontal: 14,
    color: '#09090B',
    fontSize: 15,
    backgroundColor: '#FFFFFF'
  },
  phoneInputRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    backgroundColor: '#FFFFFF'
  },
  countryCodeButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#E4E4E7',
    gap: 5
  },
  countryFlag: { fontSize: 18 },
  countryDial: { color: '#18181B', fontSize: 13, fontWeight: '600' },
  countryChevron: { color: '#71717A', fontSize: 16 },
  phoneInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    color: '#09090B',
    fontSize: 15
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -7, marginBottom: 8, paddingVertical: 6 },
  forgotLinkText: { color: '#3F3F46', fontSize: 13, fontWeight: '600' },
  mutedLink: { color: '#A1A1AA' },
  countryModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9, 9, 11, 0.48)'
  },
  countrySheet: {
    maxHeight: '80%',
    minHeight: '55%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: SYSTEM_INSETS.bottom
  },
  countryHandle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D4D4D8',
    marginBottom: 18
  },
  countryTitle: { color: '#09090B', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  countrySearch: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 13,
    color: '#09090B',
    marginBottom: 8
  },
  countryOption: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    gap: 10
  },
  countryOptionFlag: { fontSize: 19 },
  countryOptionName: { flex: 1, color: '#18181B', fontSize: 14 },
  countryOptionDial: { color: '#52525B', fontSize: 13, fontWeight: '600' },
  multilineInput: { minHeight: 76, paddingTop: 12 },
  addressButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D4D4D8',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 16
  },
  addressVerifiedButton: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  addressButtonText: { color: '#27272A', fontSize: 14, fontWeight: '600' },
  addressVerifiedText: { color: '#166534' },
  availableText: { color: '#15803D', fontSize: 13, lineHeight: 19, marginTop: -7, marginBottom: 12 },
  primaryButton: {
    minHeight: 50,
    backgroundColor: '#09090B',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22, marginBottom: 16 },
  divider: { height: 1, flex: 1, backgroundColor: '#E4E4E7' },
  dividerText: { color: '#71717A', fontSize: 12, marginHorizontal: 12 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  socialButtonText: { color: '#18181B', fontWeight: '600', fontSize: 14 },
  modeLink: { alignItems: 'center', paddingVertical: 18 },
  modeLinkText: { color: '#3F3F46', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  backLink: { alignItems: 'center', paddingBottom: 8 },
  backLinkText: { color: '#71717A', fontSize: 14 },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 },
  noticeText: { color: '#166534', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 }
});
