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
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AuthChallengeResponse,
  checkAvailability,
  checkPhoneAvailability,
  normalizePhoneIdentifier,
  registerTiwloAccount,
  resendEmailCode,
  resendSetupTwoFactorCode,
  setupTwoFactorCode,
  TiwloUser,
  verifyEmailCode,
} from '../services/tiwloAuth';
import { CountryPickerField } from '../components/CountryPickerModal';
import {
  CountryOption,
  DEFAULT_COUNTRY,
  searchCountries,
} from '../utils/countries';
import {
  MONTH_OPTIONS,
  formatIsoBirthDate,
  getDaysInBirthMonth,
} from '../utils/dateOfBirth';
import { colors } from '../theme/tokens';

type CreateStep = 'credentials' | 'profile' | 'verify_email' | 'setup_authenticator';

interface CreateAccountScreenProps {
  onBack: () => void;
  onAuthenticated: (user: TiwloUser, sessionToken?: string) => void;
  onChallengeFromLogin?: (challenge: AuthChallengeResponse) => void;
}

export const CreateAccountScreen: React.FC<CreateAccountScreenProps> = ({
  onBack,
  onAuthenticated,
}) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<CreateStep>('credentials');
  const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY.name);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(DEFAULT_COUNTRY);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Dhaka');
  const [postalCode, setPostalCode] = useState('');

  // Step 3 & 4: Tiwlo Email Verify + Own 2-Step Authenticator Setup
  const [tempToken, setTempToken] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const filteredCountries = searchCountries(countryQuery);

  const handleNextCredentials = async () => {
    setErrorMsg('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanHandle = handle.trim().replace(/^@/, '').toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(cleanHandle)) {
      setErrorMsg('Username must be 3-30 letters, numbers, or underscores.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Use 6 or more characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const check = await checkAvailability({ email: cleanEmail, handle: cleanHandle });
      if (check.emailAvailable === false) {
        setErrorMsg(check.emailError || 'That email is already in use.');
        return;
      }
      if (check.handleAvailable === false) {
        setErrorMsg(check.handleError || 'That username is already taken.');
        return;
      }
      setStep('profile');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not verify availability.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setErrorMsg('');
    const displayName = accountType === 'business' ? businessName.trim() : fullName.trim();
    if (!displayName) {
      setErrorMsg(accountType === 'business' ? 'Enter your business name.' : 'Enter your full name.');
      return;
    }
    const normalizedDob = formatIsoBirthDate({ birthYear, birthMonth, birthDay });
    if (accountType === 'personal') {
      const yearNum = Number(birthYear);
      if (
        !birthMonth ||
        !birthDay ||
        !/^\d{4}$/.test(birthYear) ||
        yearNum < 1900 ||
        yearNum > new Date().getFullYear() ||
        !normalizedDob ||
        new Date(`${normalizedDob}T00:00:00.000Z`) > new Date()
      ) {
        setErrorMsg('Select a valid date of birth (Month, Day, and 4-digit Year).');
        return;
      }
    }
    if (!country.trim()) {
      setErrorMsg('Select your country.');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('Enter your street address.');
      return;
    }
    if (!city.trim()) {
      setErrorMsg('Enter your city.');
      return;
    }

    const fullPhone = phoneNational.trim()
      ? normalizePhoneIdentifier(phoneNational.trim(), selectedCountry.dial)
      : '';
    if (fullPhone) {
      const digits = fullPhone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        setErrorMsg('Enter a valid phone number.');
        return;
      }
    }

    setBusy(true);
    try {
      if (fullPhone) {
        const phoneCheck = await checkPhoneAvailability(fullPhone);
        if (phoneCheck.available === false) {
          setErrorMsg(phoneCheck.error || 'This phone number is already registered.');
          return;
        }
      }

      const result = await registerTiwloAccount({
        email: email.trim().toLowerCase(),
        handle: handle.trim().replace(/^@/, '').toLowerCase(),
        password,
        accountType,
        name: displayName,
        businessName: accountType === 'business' ? businessName.trim() : undefined,
        phone: fullPhone,
        dateOfBirth: accountType === 'personal' ? normalizedDob : '',
        address: address.trim(),
        billingDetails: {
          address: address.trim(),
          city: city.trim(),
          country: country.trim() || selectedCountry.name,
          phone: fullPhone,
          postalCode: postalCode.trim(),
        },
      });

      if (result.requiresEmailVerification && result.tempToken) {
        setTempToken(result.tempToken);
        setEmailMasked(result.emailMasked || email.trim());
        setOtpCode('');
        setResendCountdown(60);
        setStep('verify_email');
        return;
      }

      if (result.user) {
        onAuthenticated(result.user, result.sessionToken);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not create Tiwlo account.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmail = async () => {
    setErrorMsg('');
    const clean = otpCode.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit email verification code.');
      return;
    }
    setBusy(true);
    try {
      const result = await verifyEmailCode(tempToken, clean);
      if (result.requires2FASetup && result.tempToken) {
        setTempToken(result.tempToken);
        setEmailMasked(result.emailMasked || emailMasked);
        setOtpCode('');
        setResendCountdown(60);
        setStep('setup_authenticator');
        return;
      }
      if (result.user) {
        onAuthenticated(result.user, result.sessionToken);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Invalid verification code.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetupAuthenticator = async () => {
    setErrorMsg('');
    const clean = otpCode.replace(/\D/g, '').slice(0, 6);
    if (clean.length !== 6) {
      setErrorMsg('Enter the 6-digit Tiwlo Authenticator confirmation code.');
      return;
    }
    setBusy(true);
    try {
      const result = await setupTwoFactorCode(tempToken, clean);
      if (result.user) {
        onAuthenticated(result.user, result.sessionToken);
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not verify authenticator code.');
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
        step === 'verify_email'
          ? await resendEmailCode(tempToken)
          : await resendSetupTwoFactorCode(tempToken);
      setTempToken(res.newTempToken);
      if (res.emailMasked) setEmailMasked(res.emailMasked);
      setOtpCode('');
      setResendCountdown(60);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Could not resend code.');
    } finally {
      setBusy(false);
    }
  };

  const stepIndex =
    step === 'credentials' ? 1 : step === 'profile' ? 2 : step === 'verify_email' ? 3 : 4;

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
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (step === 'profile') {
                setStep('credentials');
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
              {step === 'profile' ? 'Back' : 'Back to sign in'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.stepLabel}>Step {stepIndex} of 4</Text>
        </View>

        <Image
          source={require('../../assets/tiwlo-light-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.progressRow}>
          {[1, 2, 3, 4].map((index) => (
            <View
              key={index}
              style={[styles.progressBar, stepIndex >= index && styles.progressActive]}
            />
          ))}
        </View>

        {step === 'credentials' && (
          <>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Create your Tiwlo account with email and Tiwlo Authenticator security.
            </Text>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => setErrorMsg('Use email sign-up below or sign in with Google from Sign in.')}
                activeOpacity={0.75}
              >
                <Ionicons name="logo-google" size={17} color={colors.ink} />
                <Text style={styles.socialText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => setErrorMsg('Use email sign-up below or sign in with GitHub from Sign in.')}
                activeOpacity={0.75}
              >
                <Ionicons name="logo-github" size={18} color={colors.ink} />
                <Text style={styles.socialText}>GitHub</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR WITH EMAIL</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={[styles.input, focused === 'email' && styles.inputFocused]}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="name@tiwlo.com"
                placeholderTextColor="#A1A1AA"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={[styles.input, focused === 'handle' && styles.inputFocused]}
                value={handle}
                onChangeText={(text) => {
                  setHandle(text.replace(/\s+/g, ''));
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('handle')}
                onBlur={() => setFocused(null)}
                placeholder="@username"
                placeholderTextColor="#A1A1AA"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputShell, focused === 'pass' && styles.inputFocused]}>
                <TextInput
                  style={styles.shellInput}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!busy}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((v) => !v)}>
                  {showPassword ? (
                    <EyeOff size={18} strokeWidth={1.9} color={colors.muted} />
                  ) : (
                    <Eye size={18} strokeWidth={1.9} color={colors.muted} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={[styles.inputShell, focused === 'cpass' && styles.inputFocused]}>
                <TextInput
                  style={styles.shellInput}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocused('cpass')}
                  onBlur={() => setFocused(null)}
                  placeholder="Re-enter password"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!busy}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? (
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
              onPress={() => void handleNextCredentials()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'profile' && (
          <>
            <Text style={styles.title}>Account details</Text>
            <Text style={styles.subtitle}>
              Enter your Tiwlo profile and address details.
            </Text>

            <View style={styles.tabsTrack}>
              <TouchableOpacity
                style={[styles.tabItem, accountType === 'personal' && styles.tabItemActive]}
                onPress={() => setAccountType('personal')}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabLabel, accountType === 'personal' && styles.tabLabelActive]}>
                  Personal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabItem, accountType === 'business' && styles.tabItemActive]}
                onPress={() => setAccountType('business')}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabLabel, accountType === 'business' && styles.tabLabelActive]}>
                  Business
                </Text>
              </TouchableOpacity>
            </View>

            {accountType === 'personal' ? (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full name</Text>
                  <TextInput
                    style={[styles.input, focused === 'name' && styles.inputFocused]}
                    value={fullName}
                    onChangeText={(text) => {
                      setFullName(text);
                      if (errorMsg) setErrorMsg('');
                    }}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    placeholder="Your full name"
                    placeholderTextColor="#A1A1AA"
                    editable={!busy}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Date of birth</Text>
                  <View style={styles.dobRow}>
                    <TouchableOpacity
                      style={[styles.input, styles.dobMonthBtn]}
                      onPress={() => {
                        if (!busy) setMonthModalVisible(true);
                      }}
                      disabled={busy}
                      activeOpacity={0.75}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.dobMonthText, !birthMonth && styles.dobPlaceholder]}
                      >
                        {MONTH_OPTIONS.find((m) => m.value === birthMonth)?.name || 'Month'}
                      </Text>
                      <ChevronDown size={14} strokeWidth={2} color={colors.muted} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.dobDayInput, focused === 'dobDay' && styles.inputFocused]}
                      value={birthDay}
                      onChangeText={(text) => {
                        const digits = text.replace(/\D/g, '').slice(0, 2);
                        const maxDay = getDaysInBirthMonth(birthMonth, birthYear);
                        setBirthDay(digits && Number(digits) > maxDay ? String(maxDay) : digits);
                        if (errorMsg) setErrorMsg('');
                      }}
                      onFocus={() => setFocused('dobDay')}
                      onBlur={() => setFocused(null)}
                      placeholder="Day"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="number-pad"
                      maxLength={2}
                      editable={!busy}
                    />
                    <TextInput
                      style={[styles.input, styles.dobYearInput, focused === 'dobYear' && styles.inputFocused]}
                      value={birthYear}
                      onChangeText={(text) => {
                        setBirthYear(text.replace(/\D/g, '').slice(0, 4));
                        if (errorMsg) setErrorMsg('');
                      }}
                      onFocus={() => setFocused('dobYear')}
                      onBlur={() => setFocused(null)}
                      placeholder="Year"
                      placeholderTextColor="#A1A1AA"
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={!busy}
                    />
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Business name</Text>
                <TextInput
                  style={[styles.input, focused === 'bname' && styles.inputFocused]}
                  value={businessName}
                  onChangeText={(text) => {
                    setBusinessName(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocused('bname')}
                  onBlur={() => setFocused(null)}
                  placeholder="Company or store name"
                  placeholderTextColor="#A1A1AA"
                  editable={!busy}
                />
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Country / Region</Text>
              <CountryPickerField
                value={country}
                onChange={(countryName, countryObj) => {
                  setCountry(countryName);
                  setSelectedCountry(countryObj);
                  if (errorMsg) setErrorMsg('');
                }}
                disabled={busy}
                placeholder="Select country"
                title="Select country"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone number (optional)</Text>
              <View style={[styles.inputShell, focused === 'phone' && styles.inputFocused]}>
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
                  style={styles.phoneInput}
                  value={phoneNational}
                  onChangeText={(text) => {
                    setPhoneNational(text);
                    if (errorMsg) setErrorMsg('');
                  }}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                  placeholder="1700-000000"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="phone-pad"
                  editable={!busy}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Street address</Text>
              <TextInput
                style={[styles.input, focused === 'addr' && styles.inputFocused]}
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('addr')}
                onBlur={() => setFocused(null)}
                placeholder="House, road, area"
                placeholderTextColor="#A1A1AA"
                editable={!busy}
              />
            </View>

            <View style={styles.twoCol}>
              <View style={[styles.fieldGroup, styles.halfCol]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={[styles.input, focused === 'city' && styles.inputFocused]}
                  value={city}
                  onChangeText={setCity}
                  onFocus={() => setFocused('city')}
                  onBlur={() => setFocused(null)}
                  placeholder="Dhaka"
                  placeholderTextColor="#A1A1AA"
                  editable={!busy}
                />
              </View>
              <View style={[styles.fieldGroup, styles.halfCol]}>
                <Text style={styles.label}>Postal code</Text>
                <TextInput
                  style={[styles.input, focused === 'post' && styles.inputFocused]}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  onFocus={() => setFocused('post')}
                  onBlur={() => setFocused(null)}
                  placeholder="1212"
                  placeholderTextColor="#A1A1AA"
                  keyboardType="number-pad"
                  editable={!busy}
                />
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
              onPress={() => void handleRegister()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'verify_email' && (
          <>
            <Text style={styles.title}>Verify email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit verification code sent to {emailMasked}.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email verification code</Text>
              <TextInput
                style={[styles.input, styles.otpInput, focused === 'otp' && styles.inputFocused]}
                value={otpCode}
                onChangeText={(text) => {
                  setOtpCode(text.replace(/\D/g, '').slice(0, 6));
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('otp')}
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
              onPress={() => void handleVerifyEmail()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Verify email</Text>
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
          </>
        )}

        {step === 'setup_authenticator' && (
          <>
            <Text style={styles.title}>Tiwlo Authenticator</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit 2-Step Verification code sent to {emailMasked} to activate Tiwlo Authenticator.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Authenticator confirmation code</Text>
              <TextInput
                style={[styles.input, styles.otpInput, focused === 'authcode' && styles.inputFocused]}
                value={otpCode}
                onChangeText={(text) => {
                  setOtpCode(text.replace(/\D/g, '').slice(0, 6));
                  if (errorMsg) setErrorMsg('');
                }}
                onFocus={() => setFocused('authcode')}
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
              onPress={() => void handleSetupAuthenticator()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={colors.ink} /> : (
                <Text style={styles.primaryButtonText}>Activate & continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textLinkButton}
              onPress={() => void handleResend()}
              disabled={busy || resendCountdown > 0}
              activeOpacity={0.7}
            >
              <Text style={[styles.textLink, resendCountdown > 0 && styles.mutedLink]}>
                {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend authenticator code'}
              </Text>
            </TouchableOpacity>
          </>
        )}
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
            <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
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
            keyExtractor={(countryItem) => countryItem.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={24}
            renderItem={({ item: countryItem }) => (
              <TouchableOpacity
                style={styles.countryRow}
                onPress={() => {
                  setSelectedCountry(countryItem);
                  setCountry(countryItem.name);
                  setCountryModalVisible(false);
                  setCountryQuery('');
                }}
              >
                <Text style={styles.countryFlag}>{countryItem.flag}</Text>
                <Text style={styles.countryName}>{countryItem.name}</Text>
                <Text style={styles.countryDial}>{countryItem.dial}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      <Modal
        visible={monthModalVisible}
        animationType="slide"
        onRequestClose={() => setMonthModalVisible(false)}
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
            <Text style={styles.modalTitle}>Select birth month</Text>
            <TouchableOpacity onPress={() => setMonthModalVisible(false)}>
              <X size={22} strokeWidth={2} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {MONTH_OPTIONS.map((m) => {
              const active = m.value === birthMonth;
              return (
                <TouchableOpacity
                  key={m.value}
                  style={styles.countryRow}
                  onPress={() => {
                    setBirthMonth(m.value);
                    const maxDay = getDaysInBirthMonth(m.value, birthYear);
                    if (birthDay && Number(birthDay) > maxDay) {
                      setBirthDay(String(maxDay));
                    }
                    setMonthModalVisible(false);
                    if (errorMsg) setErrorMsg('');
                  }}
                >
                  <Text style={styles.countryName}>{m.name}</Text>
                  {active ? <Check size={16} strokeWidth={2.4} color={colors.primaryHover} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  stepLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  logo: { width: 104, height: 30, marginBottom: 18 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 22 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surface },
  progressActive: { backgroundColor: colors.primary },
  title: { fontSize: 28, fontWeight: '700', color: colors.foreground, letterSpacing: -0.6, marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, color: colors.muted, marginBottom: 20 },
  socialRow: { flexDirection: 'row', gap: 12 },
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
  socialText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: colors.muted },
  tabsTrack: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, padding: 4, marginBottom: 18 },
  tabItem: { flex: 1, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tabItemActive: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  tabLabel: { fontSize: 13, fontWeight: '500', color: colors.muted },
  tabLabelActive: { color: colors.foreground, fontWeight: '600' },
  fieldGroup: { marginBottom: 14 },
  dobRow: { flexDirection: 'row', gap: 8 },
  dobMonthBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dobMonthText: { flex: 1, fontSize: 14.5, color: colors.foreground },
  dobPlaceholder: { color: '#A1A1AA' },
  dobDayInput: { flex: 0.75, textAlign: 'center', paddingHorizontal: 8 },
  dobYearInput: { flex: 1, textAlign: 'center', paddingHorizontal: 8 },
  twoCol: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 6 },
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
  otpInput: { fontSize: 20, fontWeight: '700', letterSpacing: 8, textAlign: 'center' },
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
  dialButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    gap: 5,
  },
  dialFlag: { fontSize: 16 },
  dialCode: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  phoneInput: { flex: 1, height: 46, paddingHorizontal: 12, fontSize: 15, color: colors.foreground },
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
  modalFullPage: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground },
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
  countryFlag: { fontSize: 18 },
  countryName: { flex: 1, fontSize: 15, color: colors.foreground },
  countryDial: { fontSize: 14, fontWeight: '600', color: colors.muted },
});
