import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { COLORS } from '../config/colors';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function AuthScreen({ onLoginSuccess, initialMode = 'signin', initialBlockedData = null }) {
  const {
    theme,
    isDarkMode,
    login,
    verify2FA,
    resend2FA,
    register,
    verifyEmail,
    resendEmailVerification,
    setup2FA,
    resendSetup2FA,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    submitAppeal,
  } = useAuth();

  // Mode: 'signin' | '2fa' | 'blocked' | 'register' | 'reg_verify_email' | 'reg_setup_2fa' | 'forgot_email' | 'forgot_code' | 'forgot_newpass'
  const [mode, setMode] = useState(initialMode || 'signin');

  // Sign In State
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA State
  const [twoFaData, setTwoFaData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: '',
  });
  const [countdown, setCountdown] = useState(0);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  // Registration Verification States
  const [regVerifyData, setRegVerifyData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: '',
  });
  const [regSetup2FaData, setRegSetup2FaData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: '',
  });

  // Blocked / Disabled State
  const [blockedData, setBlockedData] = useState(initialBlockedData || {
    banReason: '',
    email: '',
    name: '',
  });
  const [appealText, setAppealText] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
    if (initialBlockedData) setBlockedData(initialBlockedData);
  }, [initialMode, initialBlockedData]);

  // Forgot Password / Account Recovery State
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryMasked, setRecoveryMasked] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Register State
  const [regStep, setRegStep] = useState(1); // 1: credentials, 2: basic info & address
  const [regAccountType, setRegAccountType] = useState('personal'); // 'personal' | 'business'
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regHandle, setRegHandle] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regEmailError, setRegEmailError] = useState('');
  const [regHandleError, setRegHandleError] = useState('');
  const emailDebounceTimer = useRef(null);
  const handleDebounceTimer = useRef(null);

  // Register Step 2: Basic Info & Address State
  const [regBirthMonth, setRegBirthMonth] = useState('');
  const [regBirthDay, setRegBirthDay] = useState('');
  const [regBirthYear, setRegBirthYear] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [regGender, setRegGender] = useState('Rather not say');
  const [regPhone, setRegPhone] = useState('');
  const [regCountry, setRegCountry] = useState('Bangladesh');
  const [regCity, setRegCity] = useState('');
  const [regStreet, setRegStreet] = useState('');
  const [regPostalCode, setRegPostalCode] = useState('');

  // UI State
  const [focusedField, setFocusedField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Clean Material Theme Tokens (Borderless, Modern M3)
  const gTheme = {
    bg: isDarkMode ? COLORS.hex_131314 : COLORS.white,
    surface: isDarkMode ? COLORS.hex_131314 : COLORS.white,
    cardBorder: COLORS.named_transparent,
    textPrimary: isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text,
    textSecondary: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary,
    textMuted: isDarkMode ? COLORS.hex_8E918F : COLORS.textMuted,
    border: COLORS.named_transparent,
    borderFocused: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary,
    primary: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary,
    primaryText: isDarkMode ? COLORS.hex_040E28 : COLORS.white,
    link: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary,
    error: isDarkMode ? COLORS.hex_F2B8B5 : COLORS.danger,
    errorBg: isDarkMode ? COLORS.hex_371E1E : COLORS.hex_FCE8E6,
    success: isDarkMode ? COLORS.hex_81C995 : COLORS.hex_137333,
    successBg: isDarkMode ? COLORS.hex_173420 : COLORS.hex_E6F4EA,
    chipActiveBg: isDarkMode ? COLORS.hex_004A77 : COLORS.hex_C2E7FF,
    chipActiveText: isDarkMode ? COLORS.hex_C2E7FF : COLORS.hex_001D35,
    chipInactiveBg: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_F2F4F7,
    chipInactiveText: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary,
    inputBg: isDarkMode ? COLORS.hex_1E1F20 : COLORS.hex_F2F4F7,
  };

  // Countdown timer for 2FA / Recovery
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  // 1. SIGN IN FLOW
  const handleSignIn = async () => {
    if (!emailOrPhone.trim()) {
      setErrorMessage('Enter an email address or Tiwi ID');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Enter your password');
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const res = await login(emailOrPhone.trim(), password.trim());

      // 1. Account Disabled / Suspended Flow
      if (res.isBanned) {
        setBlockedData({
          banReason: res.banReason || 'Your account has been disabled for safety policy violation.',
          email: res.email || emailOrPhone.trim(),
          name: res.name || 'User',
        });
        setMode('blocked');
        return;
      }

      // 2. 2-Step Verification (2FA) Flow
      if (res.requires2FA) {
        setTwoFaData({
          tempToken: res.tempToken,
          email: res.email,
          emailMasked: res.emailMasked || res.email,
          code: '',
        });
        setCountdown(60);
        setMode('2fa');
        return;
      }

      // 3. Direct Login Success
      if (res && res.user) {
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || "Couldn't find your Tiwi Account or password was incorrect.");
    } finally {
      setLoading(false);
    }
  };

  // 2. TWO-STEP VERIFICATION FLOW
  const handleVerify2FA = async () => {
    const cleanCode = twoFaData.code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Enter the complete 6-digit verification code');
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const res = await verify2FA(twoFaData.tempToken, cleanCode);
      if (res && res.isBanned) {
        setBlockedData({
          banReason: res.banReason || 'Account suspended.',
          email: twoFaData.email,
          name: 'User',
        });
        setMode('blocked');
        setLoading(false);
        return;
      }
      if (res && res.user) {
        if (onLoginSuccess) {
          try {
            onLoginSuccess();
          } catch (e) {
            console.warn('[onLoginSuccess]', e);
          }
        }
        return;
      }
      setLoading(false);
    } catch (err) {
      setErrorMessage(err.message || 'Wrong code. Try again or request a new code.');
      setLoading(false);
    }
  };

  const handleResend2FA = async () => {
    if (countdown > 0) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await resend2FA(twoFaData.tempToken);
      if (res.newTempToken) {
        setTwoFaData((prev) => ({ ...prev, tempToken: res.newTempToken }));
      }
      setCountdown(60);
      setSuccessMessage('A fresh 6-digit code was sent to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. FORGOT PASSWORD / ACCOUNT RECOVERY FLOW
  const handleStartRecovery = () => {
    clearMessages();
    setRecoveryEmail(emailOrPhone.trim());
    setMode('forgot_email');
  };

  const handleRequestRecoveryOtp = async () => {
    const clean = recoveryEmail.trim();
    if (!clean) {
      setErrorMessage('Enter your email or Tiwi ID to recover your account');
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      const res = await forgotPassword(clean);
      setRecoveryToken(res.tempToken);
      setRecoveryMasked(res.emailMasked || clean);
      setCountdown(60);
      setMode('forgot_code');
    } catch (err) {
      setErrorMessage(err.message || 'Could not initiate account recovery. Check your email or Tiwi ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async () => {
    const cleanCode = recoveryCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Enter the complete 6-digit code');
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      const res = await verifyResetCode(recoveryToken, cleanCode);
      if (res.valid) {
        setRecoveryToken(res.resetToken || recoveryToken);
        setMode('forgot_newpass');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      setErrorMessage('Use 6 characters or more for your new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Those passwords didn’t match. Try again.');
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      const res = await resetPassword(recoveryToken, newPassword.trim());
      setSuccessMessage(res.message || 'Password updated! Sign in with your new password.');
      setEmailOrPhone(recoveryEmail);
      setPassword('');
      setMode('signin');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. ACCOUNT APPEAL / DISABLED RESTORE FLOW
  const handleSubmitAppeal = async () => {
    if (!appealText.trim()) {
      setErrorMessage('Please provide details for your appeal explanation.');
      return;
    }
    setLoading(true);
    clearMessages();
    try {
      const res = await submitAppeal(blockedData.email, appealText.trim());
      setAppealSubmitted(true);
      setSuccessMessage(res.message || 'Your appeal has been submitted.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit appeal.');
    } finally {
      setLoading(false);
    }
  };

  // 5. REGISTRATION FLOW (Live Availability & Uniqueness Check)
  const handleEmailChange = (val) => {
    setRegEmail(val);
    setRegEmailError('');
    if (emailDebounceTimer.current) clearTimeout(emailDebounceTimer.current);

    const clean = val.trim().toLowerCase();
    if (!clean) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      setRegEmailError('Enter a valid email address');
      return;
    }

    emailDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await TiwiAPI.checkAvailability({ email: clean });
        if (res && !res.emailAvailable) {
          setRegEmailError(res.emailError || 'That email is taken. Try another.');
        } else {
          setRegEmailError('');
        }
      } catch (e) {}
    }, 350);
  };

  const handleHandleChange = (val) => {
    setRegHandle(val);
    setRegHandleError('');
    if (handleDebounceTimer.current) clearTimeout(handleDebounceTimer.current);

    let clean = val.trim().toLowerCase();
    if (clean.startsWith('@')) clean = clean.substring(1);
    if (!clean) return;

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(clean)) {
      setRegHandleError('Username must be 3-30 characters (letters, numbers, underscores)');
      return;
    }

    handleDebounceTimer.current = setTimeout(async () => {
      try {
        const res = await TiwiAPI.checkAvailability({ handle: clean });
        if (res && !res.handleAvailable) {
          setRegHandleError(res.handleError || 'That username is taken. Try another.');
        } else {
          setRegHandleError('');
        }
      } catch (e) {}
    }, 350);
  };

  const handleRegStep1Next = async () => {
    const fullName = `${regFirstName.trim()} ${regLastName.trim()}`.trim();
    if (!fullName) {
      setErrorMessage(regAccountType === 'business' ? 'Enter company or brand name' : 'Enter your name');
      return;
    }
    if (!regEmail.trim()) {
      setErrorMessage('Enter an email address');
      return;
    }
    const cleanEmail = regEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setRegEmailError('Enter a valid email address');
      setErrorMessage('Enter a valid email address');
      return;
    }
    if (!regPassword.trim() || regPassword.length < 6) {
      setErrorMessage('Use 6 characters or more for your password');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Those passwords didn’t match. Try again.');
      return;
    }

    if (regEmailError || regHandleError) {
      setErrorMessage(regEmailError || regHandleError);
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      let cleanHandle = regHandle.trim();
      if (cleanHandle.startsWith('@')) cleanHandle = cleanHandle.substring(1);

      const res = await TiwiAPI.checkAvailability({
        email: cleanEmail,
        handle: cleanHandle,
      });

      if (res && !res.emailAvailable) {
        setRegEmailError(res.emailError || 'That email is taken. Try another.');
        setErrorMessage(res.emailError || 'That email is taken. Try another.');
        return;
      }
      if (res && !res.handleAvailable) {
        setRegHandleError(res.handleError || 'That username is taken. Try another.');
        setErrorMessage(res.handleError || 'That username is taken. Try another.');
        return;
      }

      clearMessages();
      setRegStep(2);
    } catch (err) {
      setErrorMessage('Could not verify email and username availability. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const fullName = `${regFirstName.trim()} ${regLastName.trim()}`.trim();

    if (regAccountType === 'personal') {
      if (!regBirthMonth || !regBirthDay.trim() || !regBirthYear.trim()) {
        setErrorMessage('Please enter your complete date of birth (Month, Day, Year)');
        return;
      }
    }

    setLoading(true);
    clearMessages();
    try {
      const cleanHandle = regHandle.trim()
        ? regHandle.trim().startsWith('@')
          ? regHandle.trim()
          : `@${regHandle.trim()}`
        : `@${fullName.toLowerCase().replace(/[^a-z0-9_]/g, '')}`;

      const birthdayStr = (regBirthMonth && regBirthDay.trim() && regBirthYear.trim())
        ? `${regBirthMonth} ${regBirthDay.trim()}, ${regBirthYear.trim()}`
        : '';

      const billingAddressObj = {
        country: regCountry.trim() || 'Bangladesh',
        city: regCity.trim(),
        address: regStreet.trim(),
        phone: regPhone.trim(),
        postalCode: regPostalCode.trim(),
      };

      const res = await register({
        name: fullName,
        email: regEmail.trim(),
        handle: cleanHandle,
        password: regPassword.trim(),
        accountType: regAccountType,
        birthday: birthdayStr,
        gender: regGender,
        phone: regPhone.trim(),
        billingAddress: billingAddressObj,
      });

      // 1. Email Verification Flow (6-digit OTP sent to user's email)
      if (res && res.requiresEmailVerification) {
        setRegVerifyData({
          tempToken: res.tempToken,
          email: res.email || regEmail.trim(),
          emailMasked: res.emailMasked || regEmail.trim(),
          code: '',
        });
        setCountdown(60);
        setMode('reg_verify_email');
        setSuccessMessage('A 6-digit verification code has been sent to your email.');
        return;
      }

      // Direct Login Success fallback
      if (res && res.user) {
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 6. REGISTRATION EMAIL VERIFICATION FLOW
  const handleVerifyRegEmail = async () => {
    const cleanCode = regVerifyData.code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Enter the complete 6-digit verification code');
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const res = await verifyEmail(regVerifyData.tempToken, cleanCode);
      if (res && res.requires2FASetup) {
        setRegSetup2FaData({
          tempToken: res.tempToken,
          email: res.email || regVerifyData.email,
          emailMasked: res.emailMasked || regVerifyData.emailMasked,
          code: '',
        });
        setCountdown(60);
        setMode('reg_setup_2fa');
        setSuccessMessage('Email verified! Set up 2-Step Verification to complete registration.');
        return;
      }
      if (res && res.user) {
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Wrong code. Try again or request a new code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendRegEmail = async () => {
    if (countdown > 0) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await resendEmailVerification(regVerifyData.tempToken);
      if (res && res.newTempToken) {
        setRegVerifyData((prev) => ({ ...prev, tempToken: res.newTempToken }));
      }
      setCountdown(60);
      setSuccessMessage('A fresh verification code was sent to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 7. REGISTRATION 2FA SETUP FLOW
  const handleVerifyReg2FA = async () => {
    const cleanCode = regSetup2FaData.code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setErrorMessage('Enter the complete 6-digit security code');
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const res = await setup2FA(regSetup2FaData.tempToken, cleanCode);
      if (res && res.user) {
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Wrong code. Try again or request a new code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendReg2FA = async () => {
    if (countdown > 0) return;
    setLoading(true);
    clearMessages();
    try {
      const res = await resendSetup2FA(regSetup2FaData.tempToken);
      if (res && res.newTempToken) {
        setRegSetup2FaData((prev) => ({ ...prev, tempToken: res.newTempToken }));
      }
      setCountdown(60);
      setSuccessMessage('A fresh security code was sent to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: gTheme.bg }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={gTheme.bg}
        translucent={false}
      />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
        >
          <View style={styles.cardWrapper}>
            {/* Top Tiwi Website Logo Header */}
            <View style={styles.brandHeader}>
              <View style={styles.logoRow}>
                <Image
                  source={require('../../assets/tiwi.png')}
                  style={styles.brandLogoIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.brandLogoText, { color: gTheme.textPrimary }]}>Tiwi</Text>
              </View>

              {/* Dynamic View Titles */}
              <Text style={[styles.headline, { color: gTheme.textPrimary }]}>
                {mode === 'signin' && 'Sign in'}
                {mode === '2fa' && '2-Step Verification'}
                {mode === 'blocked' && 'Your account is disabled'}
                {mode === 'forgot_email' && 'Account recovery'}
                {mode === 'forgot_code' && 'Check your email'}
                {mode === 'forgot_newpass' && 'Change password'}
                {mode === 'register' && (regStep === 2 ? 'Basic information' : 'Create a Tiwi Account')}
                {mode === 'reg_verify_email' && 'Verify your email'}
                {mode === 'reg_setup_2fa' && 'Set up 2-Step Verification'}
              </Text>

              <Text style={[styles.subhead, { color: gTheme.textSecondary }]}>
                {mode === 'signin' && 'to continue to Tiwi'}
                {mode === '2fa' && 'To help keep your account safe, Tiwi wants to make sure it’s really you'}
                {mode === 'blocked' && 'You’ve been signed out'}
                {mode === 'forgot_email' && 'To help keep your account safe, Tiwi needs to verify it’s you'}
                {mode === 'forgot_code' && `Tiwi sent a verification code to ${recoveryMasked}`}
                {mode === 'forgot_newpass' && 'Create a strong password that you haven’t used before'}
                {mode === 'register' && (regStep === 2 ? 'Enter your birthday, gender, and billing details' : 'Enter your name and account details')}
                {mode === 'reg_verify_email' && `Tiwi sent a 6-digit verification code to ${regVerifyData.emailMasked || regVerifyData.email || 'your email'}`}
                {mode === 'reg_setup_2fa' && `Tiwi sent a 6-digit security code to ${regSetup2FaData.emailMasked || regSetup2FaData.email || 'your email'} to enable 2-Step Verification`}
              </Text>
            </View>

            {/* Error Banner */}
            {!!errorMessage && (
              <View style={[styles.alertCard, { backgroundColor: gTheme.errorBg }]}>
                <Ionicons name="alert-circle" size={18} color={gTheme.error} style={{ marginRight: 8 }} />
                <Text style={[styles.alertCardText, { color: gTheme.error }]}>{errorMessage}</Text>
              </View>
            )}

            {/* Success Banner */}
            {!!successMessage && (
              <View style={[styles.alertCard, { backgroundColor: gTheme.successBg }]}>
                <Ionicons name="checkmark-circle" size={18} color={gTheme.success} style={{ marginRight: 8 }} />
                <Text style={[styles.alertCardText, { color: gTheme.success }]}>{successMessage}</Text>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 1: SIGN IN                                          */}
            {/* ======================================================== */}
            {mode === 'signin' && (
              <View style={styles.formBody}>
                {/* Outlined Field 1: Email or Tiwi ID */}
                <View style={styles.fieldContainer}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: focusedField === 'email' ? gTheme.borderFocused : gTheme.textSecondary },
                    ]}
                  >
                    Email or Tiwi ID
                  </Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      {
                        borderColor: focusedField === 'email' ? gTheme.borderFocused : gTheme.border,
                        borderWidth: focusedField === 'email' ? 2 : 1,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.input, { color: gTheme.textPrimary }]}
                      placeholder="e.g. user@gmail.com or TIW-10001"
                      placeholderTextColor={gTheme.textMuted}
                      value={emailOrPhone}
                      onChangeText={setEmailOrPhone}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                {/* Outlined Field 2: Password */}
                <View style={styles.fieldContainer}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: focusedField === 'password' ? gTheme.borderFocused : gTheme.textSecondary },
                    ]}
                  >
                    Password
                  </Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      {
                        borderColor: focusedField === 'password' ? gTheme.borderFocused : gTheme.border,
                        borderWidth: focusedField === 'password' ? 2 : 1,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.input, { color: gTheme.textPrimary }]}
                      placeholder="Enter your password"
                      placeholderTextColor={gTheme.textMuted}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={handleSignIn}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      activeOpacity={0.6}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={gTheme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Links: Forgot Password */}
                <View style={styles.linksRow}>
                  <TouchableOpacity onPress={handleStartRecovery} style={styles.linkTouch}>
                    <Text style={[styles.linkText, { color: gTheme.link }]}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                {/* Guest Mode Security Note */}
                <View style={styles.guestNoteBox}>
                  <Text style={[styles.guestNoteText, { color: gTheme.textSecondary }]}>
                    Not your computer? Use Guest mode to sign in privately.
                  </Text>
                </View>

                {/* Bottom Action Bar */}
                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('register');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Create account</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleSignIn}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Next</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 2: 2-STEP VERIFICATION                              */}
            {/* ======================================================== */}
            {mode === '2fa' && (
              <View style={styles.formBody}>
                {/* Identity Badge */}
                <View style={[styles.userChip, { backgroundColor: gTheme.inputBg, borderColor: gTheme.cardBorder }]}>
                  <Ionicons name="person-circle" size={24} color={gTheme.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.userChipText, { color: gTheme.textPrimary }]}>{twoFaData.emailMasked}</Text>
                </View>

                {/* Shield Graphic Container */}
                <View style={styles.twoFaContextCard}>
                  <View style={[styles.shieldIconWrap, { backgroundColor: isDarkMode ? COLORS.hex_283344 : COLORS.primaryLight }]}>
                    <Ionicons name="shield-checkmark" size={32} color={gTheme.primary} />
                  </View>
                  <Text style={[styles.twoFaPromptText, { color: gTheme.textSecondary }]}>
                    A verification email with a 6-digit code was sent to{' '}
                    <Text style={{ fontWeight: '700', color: gTheme.textPrimary }}>{twoFaData.emailMasked}</Text>.
                  </Text>
                </View>

                {/* Verification Code Input with "T -" prefix */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.borderFocused }]}>Enter 6-digit code</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      styles.codeBox,
                      {
                        borderColor: gTheme.borderFocused,
                        borderWidth: 2,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <Text style={[styles.gPrefix, { color: gTheme.textSecondary }]}>T -</Text>
                    <TextInput
                      style={[styles.codeInput, { color: gTheme.textPrimary }]}
                      placeholder="000000"
                      placeholderTextColor={gTheme.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={twoFaData.code}
                      onChangeText={(val) => setTwoFaData((prev) => ({ ...prev, code: val }))}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Checkbox: Don't ask again on this device */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setDontAskAgain(!dontAskAgain)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={dontAskAgain ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={dontAskAgain ? gTheme.primary : gTheme.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.checkboxLabel, { color: gTheme.textPrimary }]}>
                    Don’t ask again on this device
                  </Text>
                </TouchableOpacity>

                {/* Resend Link */}
                <View style={styles.resendRow}>
                  <TouchableOpacity
                    onPress={handleResend2FA}
                    disabled={countdown > 0 || loading}
                    style={styles.linkTouch}
                  >
                    <Text
                      style={[
                        styles.linkText,
                        { color: countdown > 0 ? gTheme.textMuted : gTheme.link },
                      ]}
                    >
                      {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Action Bar */}
                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('signin');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Try another way</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleVerify2FA}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Next</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 3: ACCOUNT DISABLED                                 */}
            {/* ======================================================== */}
            {mode === 'blocked' && (
              <View style={styles.formBody}>
                {/* User Identity Chip */}
                {!!blockedData.email && (
                  <View style={[styles.userChip, { backgroundColor: gTheme.inputBg, borderColor: gTheme.cardBorder, marginBottom: 16 }]}>
                    <Ionicons name="person-circle" size={22} color={gTheme.textSecondary} style={{ marginRight: 8 }} />
                    <Text style={[styles.userChipText, { color: gTheme.textPrimary }]}>{blockedData.email}</Text>
                  </View>
                )}

                {/* Account Disabled Body (Clean, Borderless, Natural Prose) */}
                <View style={styles.disabledBodyWrap}>
                  <Text style={[styles.disabledParagraph, { color: gTheme.textPrimary }]}>
                    Your Tiwlo Account was disabled because it was used in a way that violated our Community Standards on adult and sexually explicit content.
                  </Text>
                  <Text style={[styles.disabledParagraph, { color: gTheme.textSecondary }]}>
                    To keep our platform safe and welcoming for everyone, accounts that repeatedly violate our safety policies or post prohibited material are permanently suspended.
                  </Text>
                </View>

                {/* What you can do */}
                <View style={styles.appealExplainer}>
                  <Text style={[styles.appealTitle, { color: gTheme.textPrimary }]}>What you can do</Text>
                  <Text style={[styles.appealBody, { color: gTheme.textSecondary }]}>
                    If you believe your account was disabled by mistake, submit an appeal for our Trust & Safety team to review.
                  </Text>
                </View>

                {/* Interactive Appeal Form */}
                {!appealSubmitted ? (
                  <View style={styles.appealInputWrap}>
                    <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>
                      Explain why your account should be restored
                    </Text>
                    <View
                      style={[
                        styles.outlinedBox,
                        styles.textAreaBox,
                        { borderColor: gTheme.border, backgroundColor: gTheme.inputBg },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, styles.textAreaInput, { color: gTheme.textPrimary }]}
                        placeholder="Provide any details or context that could help in the review..."
                        placeholderTextColor={gTheme.textMuted}
                        multiline
                        numberOfLines={4}
                        value={appealText}
                        onChangeText={setAppealText}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.alertCard, { backgroundColor: gTheme.successBg }]}>
                    <Ionicons name="checkmark-circle" size={20} color={gTheme.success} style={{ marginRight: 8 }} />
                    <Text style={[styles.alertCardText, { color: gTheme.success }]}>
                      Appeal submitted successfully. We will contact you at {blockedData.email}.
                    </Text>
                  </View>
                )}

                {/* Action Row */}
                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('signin');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Try another account</Text>
                  </TouchableOpacity>

                  {!appealSubmitted ? (
                    <TouchableOpacity
                      style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                      onPress={handleSubmitAppeal}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color={gTheme.primaryText} />
                      ) : (
                        <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Submit appeal</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                      onPress={() => {
                        clearMessages();
                        setMode('signin');
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 4: FORGOT PASSWORD (STEP 1: EMAIL)                  */}
            {/* ======================================================== */}
            {mode === 'forgot_email' && (
              <View style={styles.formBody}>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.borderFocused }]}>Email address or Tiwi ID</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      {
                        borderColor: gTheme.borderFocused,
                        borderWidth: 2,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.input, { color: gTheme.textPrimary }]}
                      placeholder="e.g. name@domain.com or TIW-10001"
                      placeholderTextColor={gTheme.textMuted}
                      value={recoveryEmail}
                      onChangeText={setRecoveryEmail}
                      autoCapitalize="none"
                      autoFocus
                    />
                  </View>
                </View>

                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('signin');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleRequestRecoveryOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Next</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 5: FORGOT PASSWORD (STEP 2: ENTER CODE)             */}
            {/* ======================================================== */}
            {mode === 'forgot_code' && (
              <View style={styles.formBody}>
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.borderFocused }]}>Enter 6-digit code</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      styles.codeBox,
                      {
                        borderColor: gTheme.borderFocused,
                        borderWidth: 2,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <Text style={[styles.gPrefix, { color: gTheme.textSecondary }]}>T -</Text>
                    <TextInput
                      style={[styles.codeInput, { color: gTheme.textPrimary }]}
                      placeholder="000000"
                      placeholderTextColor={gTheme.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={recoveryCode}
                      onChangeText={setRecoveryCode}
                      autoFocus
                    />
                  </View>
                </View>

                <View style={styles.resendRow}>
                  <TouchableOpacity
                    onPress={handleRequestRecoveryOtp}
                    disabled={countdown > 0 || loading}
                    style={styles.linkTouch}
                  >
                    <Text
                      style={[
                        styles.linkText,
                        { color: countdown > 0 ? gTheme.textMuted : gTheme.link },
                      ]}
                    >
                      {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('forgot_email');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleVerifyRecoveryCode}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Next</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 6: FORGOT PASSWORD (STEP 3: NEW PASSWORD)           */}
            {/* ======================================================== */}
            {mode === 'forgot_newpass' && (
              <View style={styles.formBody}>
                {/* New Password */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.borderFocused }]}>Create new password</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      {
                        borderColor: gTheme.borderFocused,
                        borderWidth: 2,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.input, { color: gTheme.textPrimary }]}
                      placeholder="At least 6 characters"
                      placeholderTextColor={gTheme.textMuted}
                      secureTextEntry={!showNewPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeBtn}
                    >
                      <Ionicons
                        name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={gTheme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Confirm new password</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      {
                        borderColor: gTheme.border,
                        borderWidth: 1,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.input, { color: gTheme.textPrimary }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor={gTheme.textMuted}
                      secureTextEntry={!showNewPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                  </View>
                </View>

                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('signin');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleSetNewPassword}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Save password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 7: CREATE ACCOUNT (Multi-Step Flow)                 */}
            {/* ======================================================== */}
            {mode === 'register' && (
              <View style={styles.formBody}>
                {regStep === 1 ? (
                  <>
                    {/* Account Type Chips */}
                    <View style={styles.chipRow}>
                      <TouchableOpacity
                        style={[
                          styles.pillChip,
                          {
                            backgroundColor: regAccountType === 'personal' ? gTheme.chipActiveBg : gTheme.chipInactiveBg,
                          },
                        ]}
                        onPress={() => setRegAccountType('personal')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="person"
                          size={16}
                          color={regAccountType === 'personal' ? gTheme.chipActiveText : gTheme.chipInactiveText}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: regAccountType === 'personal' ? gTheme.chipActiveText : gTheme.chipInactiveText,
                              fontWeight: regAccountType === 'personal' ? '600' : '400',
                            },
                          ]}
                        >
                          Personal
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.pillChip,
                          {
                            backgroundColor: regAccountType === 'business' ? gTheme.chipActiveBg : gTheme.chipInactiveBg,
                          },
                        ]}
                        onPress={() => setRegAccountType('business')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="briefcase"
                          size={16}
                          color={regAccountType === 'business' ? gTheme.chipActiveText : gTheme.chipInactiveText}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: regAccountType === 'business' ? gTheme.chipActiveText : gTheme.chipInactiveText,
                              fontWeight: regAccountType === 'business' ? '600' : '400',
                            },
                          ]}
                        >
                          Business
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Name Fields (First and Last Name or Brand) */}
                    {regAccountType === 'business' ? (
                      <View style={styles.fieldContainer}>
                        <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Business or Brand name</Text>
                        <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                          <TextInput
                            style={[styles.input, { color: gTheme.textPrimary }]}
                            placeholder="e.g. Tiwlo Digital Agency"
                            placeholderTextColor={gTheme.textMuted}
                            value={regFirstName}
                            onChangeText={setRegFirstName}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.twoColumnRow}>
                        <View style={[styles.fieldContainer, { flex: 1, marginRight: 8 }]}>
                          <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>First name</Text>
                          <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                            <TextInput
                              style={[styles.input, { color: gTheme.textPrimary }]}
                              placeholder="e.g. Imran"
                              placeholderTextColor={gTheme.textMuted}
                              value={regFirstName}
                              onChangeText={setRegFirstName}
                            />
                          </View>
                        </View>
                        <View style={[styles.fieldContainer, { flex: 1, marginLeft: 8 }]}>
                          <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Last name</Text>
                          <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                            <TextInput
                              style={[styles.input, { color: gTheme.textPrimary }]}
                              placeholder="e.g. Niloy"
                              placeholderTextColor={gTheme.textMuted}
                              value={regLastName}
                              onChangeText={setRegLastName}
                            />
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Email Address */}
                    <View style={styles.fieldContainer}>
                      <Text style={[
                        styles.fieldLabel,
                        { color: regEmailError ? gTheme.error : (focusedField === 'regEmail' ? gTheme.borderFocused : gTheme.textSecondary) }
                      ]}>
                        Email address
                      </Text>
                      <View style={[
                        styles.outlinedBox,
                        {
                          borderColor: regEmailError ? gTheme.error : (focusedField === 'regEmail' ? gTheme.borderFocused : gTheme.border),
                          borderWidth: regEmailError || focusedField === 'regEmail' ? 2 : 1,
                          backgroundColor: gTheme.inputBg,
                        }
                      ]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="e.g. name@domain.com"
                          placeholderTextColor={gTheme.textMuted}
                          value={regEmail}
                          onChangeText={handleEmailChange}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          onFocus={() => setFocusedField('regEmail')}
                          onBlur={() => setFocusedField(null)}
                        />
                      </View>
                      {!!regEmailError && (
                        <View style={styles.inlineErrorRow}>
                          <Ionicons name="alert-circle" size={14} color={gTheme.error} style={{ marginRight: 5 }} />
                          <Text style={[styles.inlineErrorText, { color: gTheme.error }]}>{regEmailError}</Text>
                        </View>
                      )}
                    </View>

                    {/* Handle */}
                    <View style={styles.fieldContainer}>
                      <Text style={[
                        styles.fieldLabel,
                        { color: regHandleError ? gTheme.error : (focusedField === 'regHandle' ? gTheme.borderFocused : gTheme.textSecondary) }
                      ]}>
                        Username
                      </Text>
                      <View style={[
                        styles.outlinedBox,
                        {
                          borderColor: regHandleError ? gTheme.error : (focusedField === 'regHandle' ? gTheme.borderFocused : gTheme.border),
                          borderWidth: regHandleError || focusedField === 'regHandle' ? 2 : 1,
                          backgroundColor: gTheme.inputBg,
                        }
                      ]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="e.g. @imran"
                          placeholderTextColor={gTheme.textMuted}
                          value={regHandle}
                          onChangeText={handleHandleChange}
                          autoCapitalize="none"
                          onFocus={() => setFocusedField('regHandle')}
                          onBlur={() => setFocusedField(null)}
                        />
                      </View>
                      {!!regHandleError && (
                        <View style={styles.inlineErrorRow}>
                          <Ionicons name="alert-circle" size={14} color={gTheme.error} style={{ marginRight: 5 }} />
                          <Text style={[styles.inlineErrorText, { color: gTheme.error }]}>{regHandleError}</Text>
                        </View>
                      )}
                    </View>

                    {/* Password & Confirm */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Password</Text>
                      <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="Use 6 or more characters"
                          placeholderTextColor={gTheme.textMuted}
                          secureTextEntry={!showRegPassword}
                          value={regPassword}
                          onChangeText={setRegPassword}
                        />
                        <TouchableOpacity
                          onPress={() => setShowRegPassword(!showRegPassword)}
                          style={styles.eyeBtn}
                        >
                          <Ionicons
                            name={showRegPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={gTheme.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Confirm password</Text>
                      <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="Confirm your password"
                          placeholderTextColor={gTheme.textMuted}
                          secureTextEntry={!showRegPassword}
                          value={regConfirmPassword}
                          onChangeText={setRegConfirmPassword}
                        />
                      </View>
                    </View>

                    {/* Bottom Action Bar for Step 1 */}
                    <View style={styles.bottomActionBar}>
                      <TouchableOpacity
                        onPress={() => {
                          clearMessages();
                          setRegStep(1);
                          setMode('signin');
                        }}
                        style={styles.textBtn}
                      >
                        <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Sign in instead</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                        onPress={handleRegStep1Next}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Next</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    {/* STEP 2: Basic Information & Billing Details */}
                    {/* 1. Date of Birth */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>
                        Date of birth {regAccountType === 'personal' && <Text style={{ color: gTheme.error }}>*</Text>}
                      </Text>
                      <View style={styles.threeColumnRow}>
                        {/* Month Picker */}
                        <TouchableOpacity
                          style={[
                            styles.outlinedBox,
                            {
                              flex: 1.4,
                              borderColor: gTheme.border,
                              backgroundColor: gTheme.inputBg,
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              paddingHorizontal: 12,
                            },
                          ]}
                          onPress={() => setShowMonthPicker(true)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.input,
                              { color: regBirthMonth ? gTheme.textPrimary : gTheme.textMuted, paddingHorizontal: 0 },
                            ]}
                            numberOfLines={1}
                          >
                            {regBirthMonth || 'Month'}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={gTheme.textMuted} />
                        </TouchableOpacity>

                        {/* Day Input */}
                        <View style={[styles.outlinedBox, { flex: 1, borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                          <TextInput
                            style={[styles.input, { color: gTheme.textPrimary, textAlign: 'center' }]}
                            placeholder="Day"
                            placeholderTextColor={gTheme.textMuted}
                            keyboardType="number-pad"
                            maxLength={2}
                            value={regBirthDay}
                            onChangeText={(t) => setRegBirthDay(t.replace(/[^0-9]/g, ''))}
                          />
                        </View>

                        {/* Year Input */}
                        <View style={[styles.outlinedBox, { flex: 1.2, borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                          <TextInput
                            style={[styles.input, { color: gTheme.textPrimary, textAlign: 'center' }]}
                            placeholder="Year"
                            placeholderTextColor={gTheme.textMuted}
                            keyboardType="number-pad"
                            maxLength={4}
                            value={regBirthYear}
                            onChangeText={(t) => setRegBirthYear(t.replace(/[^0-9]/g, ''))}
                          />
                        </View>
                      </View>
                    </View>

                    {/* 2. Gender Selection */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Gender</Text>
                      <View style={[styles.chipRow, { marginBottom: 4, flexWrap: 'wrap', gap: 8 }]}>
                        {['Male', 'Female', 'Rather not say', 'Custom'].map((g) => {
                          const isSel = regGender === g;
                          return (
                            <TouchableOpacity
                              key={g}
                              style={[
                                styles.pillChip,
                                {
                                  flex: 0,
                                  paddingHorizontal: 14,
                                  height: 38,
                                  backgroundColor: isSel ? gTheme.chipActiveBg : gTheme.chipInactiveBg,
                                },
                              ]}
                              onPress={() => setRegGender(g)}
                              activeOpacity={0.8}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  {
                                    fontSize: 13,
                                    color: isSel ? gTheme.chipActiveText : gTheme.chipInactiveText,
                                    fontWeight: isSel ? '700' : '400',
                                  },
                               ]}
                              >
                                {g}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* 3. Mobile Phone Number */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Phone number</Text>
                      <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="e.g. +880 1700-000000"
                          placeholderTextColor={gTheme.textMuted}
                          keyboardType="phone-pad"
                          value={regPhone}
                          onChangeText={setRegPhone}
                        />
                      </View>
                    </View>

                    {/* 4. Country & City */}
                    <View style={styles.twoColumnRow}>
                      <View style={[styles.fieldContainer, { flex: 1, marginRight: 8 }]}>
                        <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Country</Text>
                        <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                          <TextInput
                            style={[styles.input, { color: gTheme.textPrimary }]}
                            placeholder="Country"
                            placeholderTextColor={gTheme.textMuted}
                            value={regCountry}
                            onChangeText={setRegCountry}
                          />
                        </View>
                      </View>
                      <View style={[styles.fieldContainer, { flex: 1, marginLeft: 8 }]}>
                        <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>City / District</Text>
                        <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                          <TextInput
                            style={[styles.input, { color: gTheme.textPrimary }]}
                            placeholder="e.g. Dhaka"
                            placeholderTextColor={gTheme.textMuted}
                            value={regCity}
                            onChangeText={setRegCity}
                          />
                        </View>
                      </View>
                    </View>

                    {/* 5. Street / House Address */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Street / House Address</Text>
                      <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="House, road, apartment, area"
                          placeholderTextColor={gTheme.textMuted}
                          value={regStreet}
                          onChangeText={setRegStreet}
                        />
                      </View>
                    </View>

                    {/* 6. Postal Code */}
                    <View style={styles.fieldContainer}>
                      <Text style={[styles.fieldLabel, { color: gTheme.textSecondary }]}>Postal / Zip Code</Text>
                      <View style={[styles.outlinedBox, { borderColor: gTheme.border, backgroundColor: gTheme.inputBg }]}>
                        <TextInput
                          style={[styles.input, { color: gTheme.textPrimary }]}
                          placeholder="e.g. 1205"
                          placeholderTextColor={gTheme.textMuted}
                          keyboardType="numeric"
                          value={regPostalCode}
                          onChangeText={setRegPostalCode}
                        />
                      </View>
                    </View>

                    {/* Bottom Action Bar for Step 2 */}
                    <View style={styles.bottomActionBar}>
                      <TouchableOpacity
                        onPress={() => {
                          clearMessages();
                          setRegStep(1);
                        }}
                        style={styles.textBtn}
                      >
                        <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                        onPress={handleRegister}
                        disabled={loading}
                        activeOpacity={0.85}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color={gTheme.primaryText} />
                        ) : (
                          <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Create Account</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 6: REGISTRATION EMAIL VERIFICATION                   */}
            {/* ======================================================== */}
            {mode === 'reg_verify_email' && (
              <View style={styles.formBody}>
                {/* Identity Badge */}
                <View style={[styles.userChip, { backgroundColor: gTheme.inputBg, borderColor: gTheme.cardBorder }]}>
                  <Ionicons name="mail-outline" size={22} color={gTheme.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.userChipText, { color: gTheme.textPrimary }]}>
                    {regVerifyData.emailMasked || regVerifyData.email}
                  </Text>
                </View>

                {/* Context Card */}
                <View style={styles.twoFaContextCard}>
                  <View style={[styles.shieldIconWrap, { backgroundColor: isDarkMode ? COLORS.hex_283344 : COLORS.primaryLight }]}>
                    <Ionicons name="mail" size={32} color={gTheme.primary} />
                  </View>
                  <Text style={[styles.twoFaPromptText, { color: gTheme.textSecondary }]}>
                    Enter the 6-digit verification code sent to{' '}
                    <Text style={{ fontWeight: '700', color: gTheme.textPrimary }}>
                      {regVerifyData.emailMasked || regVerifyData.email}
                    </Text>{' '}
                    to verify your email address.
                  </Text>
                </View>

                {/* 6-Digit Code Input */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.borderFocused }]}>Enter 6-digit code</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      styles.codeBox,
                      {
                        borderColor: gTheme.borderFocused,
                        borderWidth: 2,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <Text style={[styles.gPrefix, { color: gTheme.textSecondary }]}>T -</Text>
                    <TextInput
                      style={[styles.codeInput, { color: gTheme.textPrimary }]}
                      placeholder="000000"
                      placeholderTextColor={gTheme.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={regVerifyData.code}
                      onChangeText={(val) => setRegVerifyData((prev) => ({ ...prev, code: val }))}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Resend Link */}
                <View style={styles.resendRow}>
                  <TouchableOpacity
                    onPress={handleResendRegEmail}
                    disabled={countdown > 0 || loading}
                    style={styles.linkTouch}
                  >
                    <Text
                      style={[
                        styles.linkText,
                        { color: countdown > 0 ? gTheme.textMuted : gTheme.link },
                      ]}
                    >
                      {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Action Bar */}
                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('register');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleVerifyRegEmail}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Verify Email</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================== */}
            {/* VIEW 7: REGISTRATION 2-STEP VERIFICATION SETUP             */}
            {/* ======================================================== */}
            {mode === 'reg_setup_2fa' && (
              <View style={styles.formBody}>
                {/* Identity Badge */}
                <View style={[styles.userChip, { backgroundColor: gTheme.inputBg, borderColor: gTheme.cardBorder }]}>
                  <Ionicons name="shield-checkmark" size={22} color={gTheme.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.userChipText, { color: gTheme.textPrimary }]}>
                    {regSetup2FaData.emailMasked || regSetup2FaData.email}
                  </Text>
                </View>

                {/* Context Card */}
                <View style={styles.twoFaContextCard}>
                  <View style={[styles.shieldIconWrap, { backgroundColor: isDarkMode ? COLORS.hex_283344 : COLORS.primaryLight }]}>
                    <Ionicons name="shield-checkmark" size={32} color={gTheme.primary} />
                  </View>
                  <Text style={[styles.twoFaPromptText, { color: gTheme.textSecondary }]}>
                    To keep your account secure, 2-Step Verification is required. Enter the 6-digit security code sent to{' '}
                    <Text style={{ fontWeight: '700', color: gTheme.textPrimary }}>
                      {regSetup2FaData.emailMasked || regSetup2FaData.email}
                    </Text>{' '}
                    to activate 2FA and finish setting up your account.
                  </Text>
                </View>

                {/* 6-Digit Code Input */}
                <View style={styles.fieldContainer}>
                  <Text style={[styles.fieldLabel, { color: gTheme.borderFocused }]}>Enter 6-digit security code</Text>
                  <View
                    style={[
                      styles.outlinedBox,
                      styles.codeBox,
                      {
                        borderColor: gTheme.borderFocused,
                        borderWidth: 2,
                        backgroundColor: gTheme.inputBg,
                      },
                    ]}
                  >
                    <Text style={[styles.gPrefix, { color: gTheme.textSecondary }]}>T -</Text>
                    <TextInput
                      style={[styles.codeInput, { color: gTheme.textPrimary }]}
                      placeholder="000000"
                      placeholderTextColor={gTheme.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={regSetup2FaData.code}
                      onChangeText={(val) => setRegSetup2FaData((prev) => ({ ...prev, code: val }))}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Resend Link */}
                <View style={styles.resendRow}>
                  <TouchableOpacity
                    onPress={handleResendReg2FA}
                    disabled={countdown > 0 || loading}
                    style={styles.linkTouch}
                  >
                    <Text
                      style={[
                        styles.linkText,
                        { color: countdown > 0 ? gTheme.textMuted : gTheme.link },
                      ]}
                    >
                      {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Bottom Action Bar */}
                <View style={styles.bottomActionBar}>
                  <TouchableOpacity
                    onPress={() => {
                      clearMessages();
                      setMode('signin');
                    }}
                    style={styles.textBtn}
                  >
                    <Text style={[styles.textBtnLabel, { color: gTheme.link }]}>Sign in</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.pillBtn, { backgroundColor: gTheme.primary }]}
                    onPress={handleVerifyReg2FA}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={gTheme.primaryText} />
                    ) : (
                      <Text style={[styles.pillBtnLabel, { color: gTheme.primaryText }]}>Complete Setup</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.white }]}>
            <Text style={[styles.modalTitle, { color: gTheme.textPrimary }]}>Select Month</Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {MONTHS.map((m) => {
                const isSel = regBirthMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.modalItem,
                      isSel && { backgroundColor: isDarkMode ? COLORS.hex_283344 : COLORS.primaryLight },
                    ]}
                    onPress={() => {
                      setRegBirthMonth(m);
                      setShowMonthPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        { color: isSel ? gTheme.primary : gTheme.textPrimary, fontWeight: isSel ? '700' : '400' },
                      ]}
                    >
                      {m}
                    </Text>
                    {isSel && <Ionicons name="checkmark" size={18} color={gTheme.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 36 : 24,
    paddingBottom: 48,
    width: '100%',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingVertical: 8,
  },
  // Brand Header
  brandHeader: {
    marginBottom: 24,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandLogoIcon: {
    width: 34,
    height: 34,
    marginLeft: -3.9,
    marginRight: -2,
  },
  brandLogoText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headline: {
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 32,
  },
  subhead: {
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '400',
  },
  // Alert Card
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  alertCardText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  // Form Body
  formBody: {
    width: '100%',
  },
  fieldContainer: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  outlinedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 20,
  },
  linkTouch: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  guestNoteBox: {
    marginBottom: 28,
  },
  guestNoteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  // Bottom Action Bar (Left: Text Button, Right: Filled Pill)
  bottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  textBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  textBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  pillBtn: {
    height: 40,
    paddingHorizontal: 26,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 92,
  },
  pillBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // User Identity Badge
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  userChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // 2FA Specific
  twoFaContextCard: {
    alignItems: 'center',
    marginBottom: 20,
  },
  shieldIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  twoFaPromptText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeBox: {
    justifyContent: 'center',
  },
  gPrefix: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  codeInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 6,
    height: '100%',
    paddingVertical: 0,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  resendRow: {
    marginBottom: 20,
  },
  // Disabled Account Specific
  disabledBodyWrap: {
    marginBottom: 16,
  },
  disabledParagraph: {
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 12,
  },
  disabledAlertCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  disabledHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  disabledReasonTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  disabledReasonContent: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  banDetailBox: {
    paddingTop: 8,
  },
  banDetailTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  banDetailText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  appealExplainer: {
    marginBottom: 16,
  },
  appealTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  appealBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  appealInputWrap: {
    marginBottom: 16,
  },
  textAreaBox: {
    height: 100,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  textAreaInput: {
    height: '100%',
    textAlignVertical: 'top',
  },
  // Chips Row
  chipRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  pillChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
  },
  chipText: {
    fontSize: 14,
  },
  twoColumnRow: {
    flexDirection: 'row',
    width: '100%',
  },
  threeColumnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.rgba_0_0_0_0p5,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 18,
    elevation: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalItemText: {
    fontSize: 14,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  inlineErrorText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
