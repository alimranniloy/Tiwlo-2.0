import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Fingerprint,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AuthChallengeResponse,
  loginWithTiwlo,
  normalizePhoneIdentifier,
  TiwloUser,
} from '../services/tiwloAuth';
import {
  loginWithBiometricChallenge,
  requestBiometricChallenge,
} from '../services/tiwloAccount';
import {
  checkBiometricAvailable,
  signBiometricChallenge,
} from '../services/tiwloIntegrity';
import {
  CountryOption,
  DEFAULT_COUNTRY,
  searchCountries,
} from '../utils/countries';
import { colors } from '../theme/tokens';
import type { ChallengeMode } from './VerificationScreen';

type LoginMethod = 'phone' | 'email';

interface LoginScreenProps {
  onForgotPassword: (initialIdentifier: string) => void;
  onCreateAccount: () => void;
  onAuthenticated: (user: TiwloUser, sessionToken?: string) => void;
  onRequireChallenge: (challenge: AuthChallengeResponse, mode: ChallengeMode) => void;
  noticeBanner?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onForgotPassword,
  onCreateAccount,
  onAuthenticated,
  onRequireChallenge,
  noticeBanner = '',
}) => {
  const insets = useSafeAreaInsets();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(DEFAULT_COUNTRY);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleBiometricSignIn = async () => {
    setErrorMsg('');
    const rawId = loginMethod === 'phone' ? phone.trim() : email.trim();
    if (!rawId) {
      setErrorMsg('Enter your phone number or email first to unlock with fingerprint.');
      return;
    }
    const identifier =
      loginMethod === 'phone'
        ? normalizePhoneIdentifier(rawId, selectedCountry.dial)
        : rawId.toLowerCase();

    setBiometricLoading(true);
    try {
      const avail = await checkBiometricAvailable();
      if (!avail.available || !avail.hasStoredKey) {
        setErrorMsg('Fingerprint unlock is not enrolled on this device yet.');
        return;
      }
      const ch = await requestBiometricChallenge(identifier);
      const signed = await signBiometricChallenge(
        ch.challenge,
        'Tiwlo Fingerprint Sign In',
        `Verify fingerprint for ${identifier}`
      );
      const loginRes = await loginWithBiometricChallenge(ch.challengeId, signed.signatureBase64);
      if (loginRes.user) {
        onAuthenticated(loginRes.user, loginRes.sessionToken || loginRes.token);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Fingerprint verification did not succeed.'
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  const filteredCountries = searchCountries(countryQuery);

  const handleSignIn = async () => {
    setErrorMsg('');

    const rawId = loginMethod === 'phone' ? phone.trim() : email.trim();
    if (!rawId) {
      setErrorMsg(
        loginMethod === 'phone'
          ? 'Enter your phone number to continue.'
          : 'Enter your email address to continue.'
      );
      return;
    }
    if (loginMethod === 'email' && !rawId.includes('@')) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Enter your password.');
      return;
    }

    const identifier =
      loginMethod === 'phone'
        ? normalizePhoneIdentifier(rawId, selectedCountry.dial)
        : rawId.toLowerCase();

    setSubmitting(true);
    try {
      const res = await loginWithTiwlo(identifier, password);
      if (res.requiresEmailVerification && res.tempToken) {
        onRequireChallenge(res, 'email_verify');
        return;
      }
      if (res.requires2FA && res.tempToken) {
        onRequireChallenge(res, 'two_factor');
        return;
      }
      if (res.requires2FASetup && res.tempToken) {
        onRequireChallenge(res, 'setup_2fa');
        return;
      }
      if (res.user) {
        onAuthenticated(res.user, res.sessionToken);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
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
            paddingTop: Math.max(insets.top, 16) + 14,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
          <Image
            source={require('../../assets/tiwlo-light-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            Enter your phone number or email to continue.
          </Text>
        </View>

        {noticeBanner ? (
          <View style={styles.noticeLine}>
            <CheckCircle2 size={15} strokeWidth={2} color={colors.primaryHover} />
            <Text style={styles.noticeText}>{noticeBanner}</Text>
          </View>
        ) : null}

        <View style={styles.tabsTrack}>
          <TouchableOpacity
            style={[styles.tabItem, loginMethod === 'phone' && styles.tabItemActive]}
            onPress={() => {
              setLoginMethod('phone');
              setErrorMsg('');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabLabel, loginMethod === 'phone' && styles.tabLabelActive]}>
              Phone
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, loginMethod === 'email' && styles.tabItemActive]}
            onPress={() => {
              setLoginMethod('email');
              setErrorMsg('');
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabLabel, loginMethod === 'email' && styles.tabLabelActive]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            {loginMethod === 'phone' ? 'Phone number' : 'Email address'}
          </Text>
          {loginMethod === 'phone' ? (
            <View
              style={[
                styles.inputShell,
                focusedField === 'identifier' && styles.inputShellFocused,
              ]}
            >
              <TouchableOpacity
                style={styles.dialButton}
                onPress={() => setCountryModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dialFlag}>{selectedCountry.flag}</Text>
                <Text style={styles.dialCode}>{selectedCountry.dial}</Text>
                <ChevronDown size={14} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
              <TextInput
                style={styles.phoneTextInput}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocusedField('identifier')}
                onBlur={() => setFocusedField(null)}
                placeholder="1700-000000"
                placeholderTextColor="#A1A1AA"
                keyboardType="phone-pad"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
          ) : (
            <TextInput
              style={[
                styles.textInput,
                focusedField === 'identifier' && styles.inputShellFocused,
              ]}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMsg) setErrorMsg('');
              }}
              onFocus={() => setFocusedField('identifier')}
              onBlur={() => setFocusedField(null)}
              placeholder="name@tiwlo.com"
              placeholderTextColor="#A1A1AA"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
          )}
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.rowLabel}>Password</Text>
            <TouchableOpacity
              onPress={() => onForgotPassword(loginMethod === 'email' ? email.trim() : '')}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.inputShell,
              focusedField === 'password' && styles.inputShellFocused,
            ]}
          >
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMsg) setErrorMsg('');
              }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your password"
              placeholderTextColor="#A1A1AA"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {showPassword ? (
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
          style={[styles.primaryButton, (submitting || biometricLoading) && styles.buttonDisabled]}
          onPress={() => void handleSignIn()}
          disabled={submitting || biometricLoading}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in</Text>
          )}
        </TouchableOpacity>

        {biometricSupported ? (
          <TouchableOpacity
            style={[styles.socialButton, { marginTop: 10 }, (submitting || biometricLoading) && styles.buttonDisabled]}
            onPress={() => void handleBiometricSignIn()}
            disabled={submitting || biometricLoading}
            activeOpacity={0.8}
          >
            {biometricLoading ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <Fingerprint size={18} strokeWidth={1.9} color={colors.primaryHover} />
            )}
            <Text style={styles.socialText}>
              {biometricLoading ? 'Scanning...' : 'Fingerprint'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => setErrorMsg('Use phone or email sign in while OAuth callback is configured.')}
            disabled={submitting}
            activeOpacity={0.75}
          >
            <Ionicons name="logo-google" size={17} color={colors.ink} />
            <Text style={styles.socialText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => setErrorMsg('Use phone or email sign in while OAuth callback is configured.')}
            disabled={submitting}
            activeOpacity={0.75}
          >
            <Ionicons name="logo-github" size={18} color={colors.ink} />
            <Text style={styles.socialText}>GitHub</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerBlock}>
          <TouchableOpacity
            style={styles.signupRow}
            onPress={onCreateAccount}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.signupMuted}>New to Tiwlo? </Text>
            <Text style={styles.signupLink}>Create an account</Text>
          </TouchableOpacity>

          <Text style={styles.legalNote}>
            By signing in, you agree to Tiwlo Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={countryModalVisible}
        animationType="slide"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View
          style={[
            styles.modalFullPage,
            {
              paddingTop: Math.max(insets.top, 16) + 8,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select country code</Text>
            <TouchableOpacity
              onPress={() => setCountryModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} strokeWidth={2} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            value={countryQuery}
            onChangeText={setCountryQuery}
            placeholder="Search country or +dial code"
            placeholderTextColor="#A1A1AA"
            autoCapitalize="none"
          />

          <FlatList
            data={filteredCountries}
            keyExtractor={(country) => country.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={24}
            renderItem={({ item: country }) => {
              const active = country.code === selectedCountry.code;
              return (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    setSelectedCountry(country);
                    setCountryModalVisible(false);
                    setCountryQuery('');
                  }}
                >
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text style={styles.countryName}>{country.name}</Text>
                  <Text style={[styles.countryDial, active && styles.countryDialActive]}>
                    {country.dial}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  brandHeader: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  logo: {
    width: 108,
    height: 32,
  },
  titleBlock: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  noticeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
  },
  tabsTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  tabItem: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.foreground,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 7,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryHover,
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
  inputShellFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  dialButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 5,
  },
  dialFlag: {
    fontSize: 16,
  },
  dialCode: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  phoneTextInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.foreground,
  },
  passwordInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.foreground,
  },
  eyeButton: {
    paddingHorizontal: 14,
    height: 46,
    justifyContent: 'center',
  },
  errorLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    fontWeight: '500',
  },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  footerBlock: {
    marginTop: 'auto',
    paddingTop: 20,
    alignItems: 'center',
  },
  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  signupMuted: {
    fontSize: 14,
    color: colors.muted,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  legalNote: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.muted,
  },
  modalFullPage: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 10,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: colors.foreground,
  },
  countryDial: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  countryDialActive: {
    color: colors.primaryHover,
  },
});
