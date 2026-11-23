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
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AuthChallengeResponse,
  resendEmailCode,
  resendSetupTwoFactorCode,
  resendTwoFactorCode,
  setupTwoFactorCode,
  TiwloUser,
  verifyEmailCode,
  verifyTwoFactorCode,
} from '../services/tiwloAuth';
import { colors } from '../theme/tokens';

export type ChallengeMode = 'email_verify' | 'two_factor' | 'setup_2fa';

interface VerificationScreenProps {
  challenge: AuthChallengeResponse;
  initialMode: ChallengeMode;
  onBack: () => void;
  onAuthenticated: (user: TiwloUser, sessionToken?: string) => void;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  challenge,
  initialMode,
  onBack,
  onAuthenticated,
}) => {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ChallengeMode>(initialMode);
  const [tempToken, setTempToken] = useState(challenge.tempToken || '');
  const [emailMasked, setEmailMasked] = useState(challenge.emailMasked || challenge.email || '');
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendCountdown, setResendCountdown] = useState(60);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSubmit = async () => {
    setErrorMsg('');
    const clean = code.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit verification code.');
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'email_verify'
          ? await verifyEmailCode(tempToken, clean)
          : mode === 'two_factor'
            ? await verifyTwoFactorCode(tempToken, clean)
            : await setupTwoFactorCode(tempToken, clean);

      if (result.requires2FA && result.tempToken) {
        setMode('two_factor');
        setTempToken(result.tempToken);
        setEmailMasked(result.emailMasked || emailMasked);
        setCode('');
        setResendCountdown(60);
        return;
      }
      if (result.requires2FASetup && result.tempToken) {
        setMode('setup_2fa');
        setTempToken(result.tempToken);
        setEmailMasked(result.emailMasked || emailMasked);
        setCode('');
        setResendCountdown(60);
        return;
      }
      if (result.user) {
        onAuthenticated(result.user, result.sessionToken);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Verification failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0 || busy) return;
    setErrorMsg('');
    setBusy(true);
    try {
      const res =
        mode === 'email_verify'
          ? await resendEmailCode(tempToken)
          : mode === 'two_factor'
            ? await resendTwoFactorCode(tempToken)
            : await resendSetupTwoFactorCode(tempToken);
      setTempToken(res.newTempToken);
      if (res.emailMasked) setEmailMasked(res.emailMasked);
      setCode('');
      setResendCountdown(60);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not resend code.');
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'email_verify'
      ? 'Verify email'
      : mode === 'setup_2fa'
        ? 'Tiwlo Authenticator setup'
        : 'Tiwlo Authenticator';

  const subtitle =
    mode === 'email_verify'
      ? `Enter the 6-digit code sent to ${emailMasked}.`
      : mode === 'setup_2fa'
        ? `Enter the 6-digit confirmation code sent to ${emailMasked} to enable Tiwlo Authenticator.`
        : `Enter the 6-digit verification code sent to ${emailMasked}.`;

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
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={busy} activeOpacity={0.7}>
            <ArrowLeft size={18} strokeWidth={2} color={colors.foreground} />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>

        <Image
          source={require('../../assets/tiwlo-light-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>6-digit code</Text>
          <TextInput
            style={[styles.input, focused && styles.inputFocused]}
            value={code}
            onChangeText={(text) => {
              setCode(text.replace(/\D/g, '').slice(0, 6));
              if (errorMsg) setErrorMsg('');
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
          onPress={() => void handleSubmit()}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? <ActivityIndicator color={colors.ink} /> : (
            <Text style={styles.primaryButtonText}>Verify & continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textLinkButton}
          onPress={() => void handleResend()}
          disabled={busy || resendCountdown > 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.textLink, resendCountdown > 0 && styles.mutedLink]}>
            {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend verification code'}
          </Text>
        </TouchableOpacity>
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
  logo: { width: 104, height: 30, marginBottom: 22 },
  title: { fontSize: 28, fontWeight: '700', color: colors.foreground, letterSpacing: -0.6, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted, marginBottom: 24 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 7 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  inputFocused: { borderColor: colors.primary, borderWidth: 1.5 },
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
