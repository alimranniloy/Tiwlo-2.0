import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  clearPendingChallenge,
  completePasswordRecovery,
  getPendingChallenge,
  loginStaffOrAdmin,
  requestPasswordRecovery,
  resendEmailVerificationOtp,
  resendTwoFactorCode,
  StaffAccessRestrictedError,
  VerifiedStaffSession,
  verifyEmailVerificationOtp,
  verifyPasswordRecoveryOtp,
  verifyStaffAdminSession,
  verifyTwoFactorCode,
} from '../../services/authService';
import { ApiRequestError } from '../../services/apiClient';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../../services/storage';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AuthChallenge } from '../../types/support';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { SupportLogo } from '../../components/common/SupportLogo';
import {
  BorderlessIconButton,
  CompactOtpInput,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { StaffAccessRequestScreen } from './StaffAccessRequestScreen';

const REMEMBERED_IDENTIFIER_KEY = 'tiwlo.support.remembered_identifier';

type AuthStep =
  | 'login'
  | 'verify_email'
  | 'two_factor'
  | 'forgot_request'
  | 'forgot_code'
  | 'forgot_new_password';

export interface LoginScreenProps {
  initialError?: string;
  onAuthenticated: (session: VerifiedStaffSession) => void;
  onOpenAccessRequest?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  initialError = '',
  onAuthenticated,
  onOpenAccessRequest,
}) => {
  const { theme, tokens, toggleTheme } = useAppTheme();
  const { toast } = useMagicToast();

  const [showInlineAccessRequest, setShowInlineAccessRequest] = useState(false);

  const [step, setStep] = useState<AuthStep>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);

  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [recoveryId, setRecoveryId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [recoveryMaskedEmail, setRecoveryMaskedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [prevInitialError, setPrevInitialError] = useState(initialError);
  const [notice, setNotice] = useState('');

  if (initialError !== prevInitialError) {
    setPrevInitialError(initialError);
    if (initialError) {
      setError(initialError);
    }
  }

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getPendingChallenge().catch(() => null),
      getSecureItem(REMEMBERED_IDENTIFIER_KEY).catch(() => null),
    ]).then(([savedChallenge, savedIdentifier]) => {
      if (!active) return;
      if (savedIdentifier) {
        setIdentifier(savedIdentifier);
        setRememberEmail(true);
      }
      if (savedChallenge) {
        setChallenge(savedChallenge);
        if (savedChallenge.requiresEmailVerification) setStep('verify_email');
        else if (savedChallenge.requires2FA || savedChallenge.requires2FASetup) {
          setStep('two_factor');
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const persistRememberedIdentifier = async (value: string, remember: boolean) => {
    if (remember && value.trim()) {
      await setSecureItem(REMEMBERED_IDENTIFIER_KEY, value.trim()).catch(() => {});
    } else {
      await deleteSecureItem(REMEMBERED_IDENTIFIER_KEY).catch(() => {});
    }
  };

  const finalizeStaffCheck = async () => {
    const verified = await verifyStaffAdminSession();
    if (!verified) {
      throw new Error('Could not load authenticated staff profile.');
    }
    onAuthenticated(verified);
  };

  const routeChallenge = async (res: AuthChallenge) => {
    setChallenge(res);
    setOtpCode('');
    setNotice(res.message || '');

    if (res.sessionToken) {
      await finalizeStaffCheck();
      return;
    }
    if (res.requiresEmailVerification) {
      setResendTimer(60);
      setStep('verify_email');
      return;
    }
    if (res.requires2FA || res.requires2FASetup) {
      setResendTimer(60);
      setUseRecoveryCode(false);
      setStep('two_factor');
      return;
    }
    setError(res.message || 'Additional verification could not be completed.');
  };

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiRequestError && err.retryAfterSeconds) {
        setResendTimer(err.retryAfterSeconds);
      }
      if (err instanceof StaffAccessRestrictedError) {
        setStep('login');
        setChallenge(null);
        await clearPendingChallenge().catch(() => {});
      }
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = () =>
    runAction(async () => {
      if (!identifier.trim() || !password) {
        throw new Error('Enter your staff email, Tiwi ID, or username and password.');
      }
      await persistRememberedIdentifier(identifier, rememberEmail);
      const res = await loginStaffOrAdmin(identifier, password);
      await routeChallenge(res);
    });

  const handleVerifyOtp = () =>
    runAction(async () => {
      if (!challenge?.tempToken) {
        throw new Error('Verification session expired. Please sign in again.');
      }
      const trimmed = otpCode.trim();
      if (!useRecoveryCode && !/^\d{6}$/.test(trimmed)) {
        throw new Error('Enter the 6-digit verification code.');
      }
      if (useRecoveryCode && trimmed.length < 6) {
        throw new Error('Enter a valid recovery code.');
      }
      if (step === 'verify_email') {
        const res = await verifyEmailVerificationOtp(challenge.tempToken, trimmed);
        await routeChallenge(res);
        return;
      }
      const res = await verifyTwoFactorCode(challenge.tempToken, trimmed, {
        setup: challenge.requires2FASetup === true,
        isRecovery: useRecoveryCode,
      });
      await routeChallenge(res);
    });

  const handleResendOtp = () =>
    runAction(async () => {
      if (resendTimer > 0) return;
      if (!challenge?.tempToken) {
        throw new Error('Verification session expired. Please sign in again.');
      }
      const next =
        step === 'verify_email'
          ? await resendEmailVerificationOtp(challenge.tempToken)
          : await resendTwoFactorCode(challenge.tempToken, challenge.requires2FASetup === true);
      setChallenge((prev) => (prev ? { ...prev, ...next } : next));
      setNotice(next.message || 'A fresh verification code has been dispatched.');
      setResendTimer(60);
    });

  const handleCancelChallenge = async () => {
    await clearPendingChallenge();
    setChallenge(null);
    setOtpCode('');
    setError('');
    setNotice('');
    setStep('login');
  };

  const handleForgotRequest = () =>
    runAction(async () => {
      if (!recoveryId.trim()) {
        throw new Error('Enter your registered staff email or Tiwi ID.');
      }
      const res = await requestPasswordRecovery(recoveryId);
      setResetToken(res.resetToken);
      setRecoveryMaskedEmail(res.emailMasked);
      setOtpCode('');
      setResendTimer(60);
      setStep('forgot_code');
      setNotice(res.message || `Recovery OTP sent to ${res.emailMasked}.`);
    });

  const handleResendForgotCode = () =>
    runAction(async () => {
      if (resendTimer > 0 || !recoveryId.trim()) return;
      const res = await requestPasswordRecovery(recoveryId);
      setResetToken(res.resetToken);
      setRecoveryMaskedEmail(res.emailMasked);
      setResendTimer(60);
      setNotice(res.message || `Fresh recovery OTP sent to ${res.emailMasked}.`);
    });

  const handleForgotVerifyCode = () =>
    runAction(async () => {
      if (!/^\d{6}$/.test(otpCode.trim())) {
        throw new Error('Enter the 6-digit recovery OTP.');
      }
      const res = await verifyPasswordRecoveryOtp(resetToken, otpCode);
      setResetToken(res.resetToken);
      setOtpCode('');
      setStep('forgot_new_password');
    });

  const handleForgotResetPassword = () =>
    runAction(async () => {
      if (newPassword.length < 6) {
        throw new Error('Password must contain at least 6 characters.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }
      await completePasswordRecovery(resetToken, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setResetToken('');
      setStep('login');
      toast.show({
        variant: 'success',
        label: 'Password updated. Sign in with your new credentials.',
      });
    });

  const handleOpenOnboarding = () => {
    if (onOpenAccessRequest) {
      onOpenAccessRequest();
      return;
    }
    setShowInlineAccessRequest(true);
  };

  if (showInlineAccessRequest) {
    return <StaffAccessRequestScreen onBackToLogin={() => setShowInlineAccessRequest(false)} />;
  }

  const isTotp = step === 'two_factor' && challenge?.twoFactorMethod === 'totp';

  const headingTitle =
    step === 'login'
      ? 'Sign in to Support Desk'
      : step === 'verify_email'
        ? 'Verify Staff Email'
        : step === 'two_factor'
          ? challenge?.requires2FASetup
            ? 'Complete 2FA Setup'
            : 'Two-Factor Verification'
          : step === 'forgot_request'
            ? 'Reset Staff Password'
            : step === 'forgot_code'
              ? 'Enter Recovery Code'
              : 'Create New Password';

  const headingSubtitle =
    step === 'login'
      ? 'Authorized access for Tiwlo support specialists, leads, and administrators.'
      : step === 'verify_email'
        ? `Enter the 6-digit code dispatched to ${challenge?.emailMasked || challenge?.email || 'your email'}.`
        : step === 'two_factor'
          ? isTotp && !useRecoveryCode
            ? 'Enter the 6-digit code from your authenticator app.'
            : `Enter the security verification code for ${challenge?.emailMasked || challenge?.email || 'your account'}.`
          : step === 'forgot_request'
            ? 'Enter your work email or Tiwi ID to receive a one-time recovery code.'
            : step === 'forgot_code'
              ? `Verification code sent to ${recoveryMaskedEmail || 'your registered email'}.`
              : 'Set a strong password of at least 6 characters for your staff account.';

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <View style={[styles.root, { backgroundColor: tokens.bg }]}>
        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={64}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Enterprise Brand Row — Zero Background Animation */}
          <View style={styles.brandHeader}>
            <SupportLogo
              variant="land"
              width={114}
              height={31}
              style={{ alignSelf: 'flex-start' }}
            />
            <View style={styles.headerRight}>
              <FlatBadge label="Staff & Admin Desk" tone="accent" withDot />
              <BorderlessIconButton
                name={theme === 'dark' ? 'sun' : 'moon'}
                size={18}
                onPress={toggleTheme}
                accessibilityLabel="Toggle color theme"
              />
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: tokens.text }]}>{headingTitle}</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{headingSubtitle}</Text>
          </View>

          <Hairline style={styles.divider} />

          {error ? <FlatNotice text={error} tone="danger" icon="alert-circle" /> : null}
          {notice ? <FlatNotice text={notice} tone="success" icon="check-circle" /> : null}

          {step === 'login' ? (
            <View style={styles.formStack}>
              <FlatInput
                label="Work Email, Username, or Tiwi ID"
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="name@tiwlo.com"
                keyboardType="email-address"
                leftIcon={<Feather name="user" size={15} color={tokens.textMuted} />}
              />

              <FlatInput
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                onSubmitEditing={handleLogin}
                leftIcon={<Feather name="lock" size={15} color={tokens.textMuted} />}
                rightSlot={
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                    <Feather
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={16}
                      color={tokens.textMuted}
                    />
                  </Pressable>
                }
              />

              {/* Remember Email + Forgot Password Row */}
              <View style={styles.utilityRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const next = !rememberEmail;
                    setRememberEmail(next);
                    if (!next) {
                      deleteSecureItem(REMEMBERED_IDENTIFIER_KEY).catch(() => {});
                    }
                  }}
                  style={styles.rememberRow}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: rememberEmail ? tokens.accent : tokens.hairlineStrong,
                        backgroundColor: rememberEmail ? tokens.accent : tokens.surfaceSubtle,
                      },
                    ]}
                  >
                    {rememberEmail ? (
                      <Feather name="check" size={11} color={tokens.accentText} />
                    ) : null}
                  </View>
                  <Text style={[styles.rememberLabel, { color: tokens.textSecondary }]}>
                    Remember email
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={busy}
                  onPress={() => {
                    setError('');
                    setNotice('');
                    setRecoveryId(identifier);
                    setStep('forgot_request');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.linkLabel, { color: tokens.accent }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.compactActionRow}>
                <ShimmerButton
                  label="Sign In"
                  size="md"
                  loading={busy}
                  onPress={handleLogin}
                  rightIcon={<Feather name="arrow-right" size={14} color={tokens.inkButtonText} />}
                />
              </View>
            </View>
          ) : null}

          {step === 'verify_email' || step === 'two_factor' ? (
            <View style={styles.formStack}>
              {useRecoveryCode ? (
                <FlatInput
                  label="Backup Recovery Code"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="XXXX-XXXX"
                  autoCapitalize="characters"
                  onSubmitEditing={handleVerifyOtp}
                />
              ) : (
                <CompactOtpInput
                  label={isTotp ? 'Authenticator Code' : '6-Digit Verification Code'}
                  value={otpCode}
                  onChange={setOtpCode}
                />
              )}

              {step === 'two_factor' && isTotp ? (
                <TouchableOpacity
                  onPress={() => {
                    setOtpCode('');
                    setUseRecoveryCode((v) => !v);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
                >
                  <Text style={[styles.linkLabel, { color: tokens.accent }]}>
                    {useRecoveryCode ? 'Use authenticator code' : 'Use backup recovery code'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.compactActionRow}>
                <ShimmerButton
                  label="Verify & Continue"
                  size="md"
                  loading={busy}
                  onPress={handleVerifyOtp}
                />

                <View style={styles.inlineLinks}>
                  {!useRecoveryCode && !(step === 'two_factor' && isTotp) ? (
                    <TouchableOpacity
                      disabled={busy || resendTimer > 0}
                      onPress={handleResendOtp}
                      hitSlop={8}
                    >
                      <Text
                        style={[
                          styles.linkLabel,
                          {
                            color: resendTimer > 0 ? tokens.textMuted : tokens.accent,
                          },
                        ]}
                      >
                        {resendTimer > 0 ? `Resend ${resendTimer}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={handleCancelChallenge} hitSlop={8}>
                    <Text style={[styles.linkLabel, { color: tokens.textMuted }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {step === 'forgot_request' ? (
            <View style={styles.formStack}>
              <FlatInput
                label="Work Email or Tiwi ID"
                value={recoveryId}
                onChangeText={setRecoveryId}
                placeholder="name@tiwlo.com or TW-0001"
                keyboardType="email-address"
                onSubmitEditing={handleForgotRequest}
                leftIcon={<Feather name="mail" size={15} color={tokens.textMuted} />}
              />

              <View style={styles.compactActionRow}>
                <ShimmerButton
                  label="Send Reset Code"
                  size="md"
                  loading={busy}
                  onPress={handleForgotRequest}
                />
                <TouchableOpacity
                  onPress={() => {
                    setError('');
                    setNotice('');
                    setStep('login');
                  }}
                  hitSlop={8}
                >
                  <Text style={[styles.linkLabel, { color: tokens.textMuted }]}>
                    Back to sign in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {step === 'forgot_code' ? (
            <View style={styles.formStack}>
              <CompactOtpInput
                label="6-Digit Recovery OTP"
                value={otpCode}
                onChange={setOtpCode}
              />
              <View style={styles.compactActionRow}>
                <ShimmerButton
                  label="Verify Code"
                  size="md"
                  loading={busy}
                  onPress={handleForgotVerifyCode}
                />
                <View style={styles.inlineLinks}>
                  <TouchableOpacity
                    disabled={busy || resendTimer > 0}
                    onPress={handleResendForgotCode}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.linkLabel,
                        { color: resendTimer > 0 ? tokens.textMuted : tokens.accent },
                      ]}
                    >
                      {resendTimer > 0 ? `Resend ${resendTimer}s` : 'Resend'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setStep('forgot_request')} hitSlop={8}>
                    <Text style={[styles.linkLabel, { color: tokens.textMuted }]}>
                      Change email
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {step === 'forgot_new_password' ? (
            <View style={styles.formStack}>
              <FlatInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimum 6 characters"
                secureTextEntry={!showNewPassword}
                leftIcon={<Feather name="lock" size={15} color={tokens.textMuted} />}
                rightSlot={
                  <Pressable onPress={() => setShowNewPassword((v) => !v)} hitSlop={10}>
                    <Feather
                      name={showNewPassword ? 'eye-off' : 'eye'}
                      size={16}
                      color={tokens.textMuted}
                    />
                  </Pressable>
                }
              />
              <FlatInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                secureTextEntry={!showNewPassword}
                onSubmitEditing={handleForgotResetPassword}
                leftIcon={<Feather name="check-circle" size={15} color={tokens.textMuted} />}
              />
              <View style={styles.compactActionRow}>
                <ShimmerButton
                  label="Update Password"
                  size="md"
                  loading={busy}
                  onPress={handleForgotResetPassword}
                />
                <TouchableOpacity onPress={() => setStep('login')} hitSlop={8}>
                  <Text style={[styles.linkLabel, { color: tokens.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <Hairline style={styles.footerDivider} />

          {/* Clean Onboarding Link */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleOpenOnboarding}
            style={styles.onboardingFooterBtn}
          >
            <Text style={[styles.onboardingMuted, { color: tokens.textMuted }]}>
              New team member?{' '}
              <Text style={[styles.onboardingAccent, { color: tokens.accent }]}>
                Request Staff Access →
              </Text>
            </Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    </ScreenContainer>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 16,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleBlock: {
    gap: 5,
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    marginVertical: 2,
  },
  formStack: {
    gap: 14,
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  compactActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  inlineLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  linkLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  footerDivider: {
    marginTop: 6,
  },
  onboardingFooterBtn: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  onboardingMuted: {
    fontSize: 12.5,
  },
  onboardingAccent: {
    fontWeight: '700',
  },
});
