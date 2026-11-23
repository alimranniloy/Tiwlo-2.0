import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  completePasswordReset,
  requestPasswordReset,
  verifyPasswordResetCode,
} from '../services/tiwloAuth';
import { colors } from '../theme/tokens';

type ForgotStep = 'request' | 'code' | 'new_password';

interface ForgotPasswordScreenProps {
  initialIdentifier?: string;
  onBack: () => void;
  onSuccess: (message: string) => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  initialIdentifier = '',
  onBack,
  onSuccess,
}) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<ForgotStep>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [resetToken, setResetToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleRequestCode = async () => {
    setErrorMsg('');
    if (!identifier.trim()) {
      setErrorMsg('Enter your registered email or Tiwi ID.');
      return;
    }
    setBusy(true);
    try {
      const res = await requestPasswordReset(identifier.trim());
      setResetToken(res.resetToken);
      setEmailMasked(res.emailMasked || identifier.trim());
      setCode('');
      setResendCountdown(60);
      setStep('code');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to send recovery code.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    setErrorMsg('');
    const clean = code.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit recovery code.');
      return;
    }
    setBusy(true);
    try {
      const res = await verifyPasswordResetCode(resetToken, clean);
      setResetToken(res.resetToken);
      setStep('new_password');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Invalid or expired recovery code.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg('');
    if (newPassword.length < 6) {
      setErrorMsg('Use 6 or more characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await completePasswordReset(resetToken, newPassword);
      onSuccess(res.message || 'Password updated. Sign in with your new password.');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            paddingBottom: Math.max(insets.bottom, 24) + 20,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (step === 'code') {
                setStep('request');
                setErrorMsg('');
              } else if (step === 'new_password') {
                setStep('code');
                setErrorMsg('');
              } else {
                onBack();
              }
            }}
            disabled={busy}
            activeOpacity={0.7}
          >
            <ArrowLeft size={18} strokeWidth={2} color={colors.foreground} />
            <Text style={styles.backText}>
              {step === 'request' ? 'Back to sign in' : 'Back'}
            </Text>
          </TouchableOpacity>
        </View>

        <Image
          source={require('../../assets/tiwlo-light-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Thin step indicator */}
        <View style={styles.progressRow}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, (step === 'code' || step === 'new_password') && styles.progressActive]} />
          <View style={[styles.progressBar, step === 'new_password' && styles.progressActive]} />
        </View>

        {step === 'request' && (
          <>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter your registered email or Tiwi ID to receive a 6-digit recovery code.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email or Tiwi ID</Text>
              <TextInput
                style={[styles.input, focused === 'identifier' && styles.inputFocused]}
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('identifier')}
                onBlur={() => setFocused(null)}
                placeholder="name@tiwlo.com or TIW-12345"
                placeholderTextColor="#A1A1AA"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
            </View>

            {errorMsg ? (
              <View style={styles.errorLine}>
                <AlertCircle size={15} strokeWidth={2} color={colors.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => void handleRequestCode()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Send recovery code</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'code' && (
          <>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {emailMasked}.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Recovery code</Text>
              <TextInput
                style={[styles.input, styles.otpInput, focused === 'code' && styles.inputFocused]}
                value={code}
                onChangeText={(text) => {
                  setCode(text.replace(/\D/g, '').slice(0, 6));
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('code')}
                onBlur={() => setFocused(null)}
                placeholder="000000"
                placeholderTextColor="#A1A1AA"
                keyboardType="number-pad"
                maxLength={6}
                editable={!busy}
              />
            </View>

            {errorMsg ? (
              <View style={styles.errorLine}>
                <AlertCircle size={15} strokeWidth={2} color={colors.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => void handleVerifyCode()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Verify code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textLinkButton}
              onPress={() => void handleRequestCode()}
              disabled={busy || resendCountdown > 0}
              activeOpacity={0.7}
            >
              <Text style={[styles.textLink, resendCountdown > 0 && styles.mutedLink]}>
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend recovery code'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'new_password' && (
          <>
            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>
              Choose a strong password with at least 6 characters.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <View style={[styles.inputShell, focused === 'new' && styles.inputFocused]}>
                <TextInput
                  style={styles.shellInput}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocused('new')}
                  onBlur={() => setFocused(null)}
                  placeholder="Enter new password"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  editable={!busy}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew((v) => !v)}>
                  {showNew ? (
                    <EyeOff size={18} strokeWidth={1.9} color={colors.muted} />
                  ) : (
                    <Eye size={18} strokeWidth={1.9} color={colors.muted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={[styles.inputShell, focused === 'confirm' && styles.inputFocused]}>
                <TextInput
                  style={styles.shellInput}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused(null)}
                  placeholder="Re-enter password"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  editable={!busy}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirm((v) => !v)}>
                  {showConfirm ? (
                    <EyeOff size={18} strokeWidth={1.9} color={colors.muted} />
                  ) : (
                    <Eye size={18} strokeWidth={1.9} color={colors.muted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {errorMsg ? (
              <View style={styles.errorLine}>
                <AlertCircle size={15} strokeWidth={2} color={colors.danger} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => void handleResetPassword()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Update password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  topBar: { marginBottom: 20 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingVertical: 6 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  logo: { width: 104, height: 30, marginBottom: 20 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surface },
  progressActive: { backgroundColor: colors.primary },
  title: { fontSize: 28, fontWeight: '700', color: colors.foreground, letterSpacing: -0.6, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted, marginBottom: 24 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 7 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  otpInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  inputShell: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 1.5 },
  shellInput: { flex: 1, height: 46, paddingHorizontal: 14, fontSize: 15, color: colors.foreground },
  eyeButton: { paddingHorizontal: 14, height: 46, justifyContent: 'center' },
  errorLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: '500' },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  disabled: { opacity: 0.65 },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  textLinkButton: { alignItems: 'center', marginTop: 18, paddingVertical: 8 },
  textLink: { fontSize: 14, fontWeight: '600', color: colors.primaryHover },
  mutedLink: { color: colors.muted },
});
