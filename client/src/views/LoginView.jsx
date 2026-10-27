import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect, useRef } from 'react';
import { getDashboardUrl } from '../utils/navigation';
import { COUNTRY_OPTIONS, MONTH_OPTIONS, getDaysInBirthMonth } from '../utils/accountFormOptions';
import {
  Eye,
  EyeOff,
  AlertCircle,
  RotateCw,
  ShieldCheck
} from 'lucide-react';
import TiwloPageLoader from '../components/TiwloUniqueLoader';

const API_BASE = '/api';

export default function LoginView({
  onLoginSuccess,
  onNavigateToRegister,
  onAccountDisabled,
  showToast
}) {
  const [socialAuthInitial] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const socialError = searchParams.get('social_error');
    const [, reason] = (socialError || '').split(':');
    const messages = {
      cancelled: 'Sign-in was cancelled.',
      unavailable: 'This social sign-in provider is not configured.',
      disabled: 'This Tiwlo account has been disabled.',
      email: 'We could not send your verification code. Please try signing in again or contact support.',
      failed: 'Social sign-in could not be completed. Please try again.'
    };
    return {
      socialFlow: searchParams.get('social_flow') === '1',
      profileRequired: searchParams.get('social_profile') === 'required',
      hasSocialError: Boolean(socialError),
      viewMode: searchParams.get('social_profile') === 'required'
        ? 'profile_complete'
        : 'login',
      errorMessage: socialError ? (messages[reason] || messages.failed) : ''
    };
  });

  // View Modes: 'login' | 'email_verify' | '2fa' | 'setup_2fa' | 'forgot_request' | 'forgot_verify'
  const [viewMode, setViewMode] = useState(socialAuthInitial.viewMode);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(socialAuthInitial.errorMessage);
  const [socialProviders, setSocialProviders] = useState({ google: false, github: false, loaded: false });
  const [socialProfile, setSocialProfile] = useState({
    name: '',
    email: '',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    address: '',
    addressLine2: '',
    city: '',
    postalCode: '',
    country: 'Bangladesh',
    avatar: ''
  });
  const [socialProfileLoading, setSocialProfileLoading] = useState(socialAuthInitial.profileRequired);
  const [socialProfileChallengeToken] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('social_profile_token') || ''
  );
  // Check for pending restore session token in URL or session quietly
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('restore_token');
      if (token) {
        sessionStorage.setItem('tiwlo_pending_restore_token', token);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!socialAuthInitial.profileRequired) return undefined;
    let active = true;
    const headers = socialProfileChallengeToken
      ? { 'X-Social-Profile-Challenge': socialProfileChallengeToken }
      : {};
    const profileRequest = fetch(`${API_BASE}/auth/social/profile-challenge`, {
      credentials: 'include',
      headers
    });
    if (socialProfileChallengeToken) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    profileRequest
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.profile) {
          throw new Error(result.error || 'Profile completion session expired. Please sign in again.');
        }
        if (active) {
          const [birthYear = '', birthMonth = '', birthDay = ''] = (result.profile.dateOfBirth || '').split('-');
          const country = result.profile.country || 'Bangladesh';
          setSocialProfile({
            ...result.profile,
            handle: (result.profile.handle || '').replace(/^@/, ''),
            birthYear,
            birthMonth,
            birthDay,
            addressLine2: result.profile.addressLine2 || '',
            city: result.profile.city || '',
            postalCode: result.profile.postalCode || '',
            country,
            gender: result.profile.gender || ''
          });
        }
      })
      .catch(error => {
        if (active) setErrorMsg(error.message);
      })
      .finally(() => {
        if (active) setSocialProfileLoading(false);
      });
    return () => { active = false; };
  }, [socialAuthInitial.profileRequired, socialProfileChallengeToken]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/auth/social/providers`, { credentials: 'include' })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not load social login options.');
        if (active) {
          setSocialProviders({
            google: result.google === true,
            github: result.github === true
          });
        }
      })
      .catch(error => console.error('Could not load social login provider status:', error))
      .finally(() => {
        if (active) setSocialProviders(current => ({ ...current, loaded: true }));
      });
    return () => { active = false; };
  }, []);

  const startSocialLogin = (provider) => {
    const params = new URLSearchParams();
    const returnTo = new URLSearchParams(window.location.search).get('return_to') ||
      getDashboardUrl('/oneprofile');
    params.set('return_to', returnTo);
    window.location.assign(`/api/auth/${provider}${params.size ? `?${params}` : ''}`);
  };

  const handleCompleteSocialProfile = async (event) => {
    event.preventDefault();
    const birthYear = Number(socialProfile.birthYear);
    const birthDay = Number(socialProfile.birthDay);
    const maxBirthDay = getDaysInBirthMonth(socialProfile.birthMonth, socialProfile.birthYear);
    const normalizedBirthDate = `${socialProfile.birthYear}-${socialProfile.birthMonth}-${socialProfile.birthDay.padStart(2, '0')}`;
    const parsedBirthDate = new Date(`${normalizedBirthDate}T00:00:00.000Z`);
    if (
      !/^\d{4}$/.test(socialProfile.birthYear) ||
      birthYear < 1900 ||
      birthYear > new Date().getFullYear() ||
      !/^\d{1,2}$/.test(socialProfile.birthDay) ||
      birthDay < 1 ||
      birthDay > maxBirthDay ||
      Number.isNaN(parsedBirthDate.getTime()) ||
      parsedBirthDate.toISOString().slice(0, 10) !== normalizedBirthDate ||
      parsedBirthDate > new Date()
    ) {
      setErrorMsg('Enter a valid date of birth.');
      return;
    }
    const handle = socialProfile.handle.trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
      setErrorMsg('Username must be 3-30 characters and can only contain letters, numbers, and underscores.');
      return;
    }
    if (!socialProfile.name.trim() || !socialProfile.address.trim() || !socialProfile.city.trim() || !socialProfile.country) {
      setErrorMsg('Enter your full name, street address, city, and country.');
      return;
    }
    const countryOption = COUNTRY_OPTIONS.find(option => option.name === socialProfile.country);
    const inputPhone = socialProfile.phone.trim();
    const phone = inputPhone.startsWith('+')
      ? inputPhone
      : `${countryOption?.dial || ''} ${inputPhone}`.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setErrorMsg('Enter a valid phone number.');
      return;
    }
    const fullAddress = [
      socialProfile.address.trim(),
      socialProfile.addressLine2.trim(),
      socialProfile.city.trim(),
      socialProfile.postalCode.trim(),
      socialProfile.country
    ].filter(Boolean).join(', ');
    if (fullAddress.length > 2000) {
      setErrorMsg('Your address must be 2,000 characters or fewer.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_BASE}/auth/social/complete-profile`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(socialProfileChallengeToken
            ? { 'X-Social-Profile-Challenge': socialProfileChallengeToken }
            : {})
        },
        body: JSON.stringify({
          challengeToken: socialProfileChallengeToken || undefined,
          name: socialProfile.name.trim(),
          handle,
          dateOfBirth: normalizedBirthDate,
          address: fullAddress,
          phone,
          city: socialProfile.city.trim(),
          country: socialProfile.country,
          postalCode: socialProfile.postalCode.trim(),
          gender: socialProfile.gender
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not save your required profile details.');
      }
      setResendCountdown(result.deliveryStatus === 'failed' ? 0 : 60);
      if (result.challenge === 'login') {
        setTwoFactorData({
          tempToken: '',
          email: socialProfile.email,
          emailMasked: result.emailMasked,
          code: ''
        });
        setViewMode('2fa');
      } else {
        setSetup2FAData({
          tempToken: '',
          email: socialProfile.email,
          emailMasked: result.emailMasked,
          code: ''
        });
        setViewMode('setup_2fa');
      }
      if (result.deliveryStatus === 'failed') setErrorMsg(result.message);
      else showToast?.(result.message);
    } catch (error) {
      setErrorMsg(error.message || 'Could not save your required profile details.');
    } finally {
      setLoading(false);
    }
  };

  // 1. Email Verification State (for users without emailVerified)
  const [emailVerifyData, setEmailVerifyData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: ''
  });
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');

  // 2. 2FA State (Two-Step Verification)
  const [twoFactorData, setTwoFactorData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: ''
  });

  // 2b. 2FA Setup State (Mandatory Setup for users without 2FA)
  const [setup2FAData, setSetup2FAData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: ''
  });
  const [resendCountdown, setResendCountdown] = useState(0);
  const mfaSubmitting = useRef(false);
  const setupMfaSubmitting = useRef(false);

  // 3. Forgot Password State
  const [resetData, setResetData] = useState({
    resetToken: '',
    emailMasked: '',
    code: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!socialAuthInitial.socialFlow || socialAuthInitial.profileRequired || socialAuthInitial.hasSocialError) {
      return undefined;
    }
    let active = true;
    fetch(`${API_BASE}/auth/social/mfa-challenge`, { credentials: 'include' })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !['login', 'setup'].includes(result.challenge)) {
          throw new Error(result.error || 'Social sign-in verification expired. Please sign in again.');
        }
        if (!active) return;
        const challengeData = {
          tempToken: '',
          email: '',
          emailMasked: result.emailMasked || 'your verified email',
          code: ''
        };
        setViewMode(result.challenge === 'login' ? '2fa' : 'setup_2fa');
        setResendCountdown(60);
        if (result.challenge === 'login') setTwoFactorData(challengeData);
        else setSetup2FAData(challengeData);
      })
      .catch(error => {
        if (active) setErrorMsg(error.message);
      });
    return () => { active = false; };
  }, [socialAuthInitial.hasSocialError, socialAuthInitial.profileRequired, socialAuthInitial.socialFlow]);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // ==========================================
  // HANDLERS
  // ==========================================

  // Step 1: Standard Credentials Login Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg('Enter an email or Tiwi ID and password');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const minTimer = new Promise((resolve) => setTimeout(resolve, 600));

      const authPromise = fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: identifier.trim(), password })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          return { ok: res.ok, data };
        })
        .catch((err) => {
          return { ok: false, error: err };
        });

      const [authResult] = await Promise.all([authPromise, minTimer]);

      if (authResult.ok && authResult.data?.success) {
        // Condition A: Email is NOT verified -> Prompt Email Verification first
        if (authResult.data.requiresEmailVerification) {
          setEmailVerifyData({
            tempToken: authResult.data.tempToken,
            email: authResult.data.email || identifier,
            emailMasked: authResult.data.emailMasked || identifier,
            code: ''
          });
          setResendCountdown(60);
          setViewMode('email_verify');
          setLoading(false);
          showToast?.(authResult.data.message || 'Please verify your email address to continue.');
          return;
        }

        // Condition B: Email is verified -> Mandatory Two-Step Verification (2FA)
        if (authResult.data.requires2FA) {
          setTwoFactorData({
            tempToken: authResult.data.tempToken,
            email: authResult.data.email || identifier,
            emailMasked: authResult.data.emailMasked || 'your registered email',
            code: ''
          });
          setResendCountdown(60);
          setViewMode('2fa');
          setLoading(false);
          showToast?.(authResult.data.message || 'Two-step verification code sent.');
          return;
        }

        // Condition C: Email is verified but 2FA is not yet configured -> Mandatory Setup
        if (authResult.data.requires2FASetup) {
          setSetup2FAData({
            tempToken: authResult.data.tempToken,
            email: authResult.data.email || identifier,
            emailMasked: authResult.data.emailMasked || 'your registered email',
            code: ''
          });
          setResendCountdown(60);
          setViewMode('setup_2fa');
          setLoading(false);
          showToast?.(authResult.data.message || 'Set up 2-Step Verification to secure your account.');
          return;
        }

        // Direct session bypass if neither is required
        localStorage.setItem('stockpro_session', authResult.data.sessionToken);
        localStorage.setItem('stockpro_user', JSON.stringify(authResult.data.user));
        showToast?.(`Welcome back, ${authResult.data.user.storeName || 'User'}!`);
        onLoginSuccess?.(authResult.data.user, authResult.data.sessionToken);
      } else {
        if (authResult.data?.isBanned) {
          localStorage.removeItem('stockpro_session');
          localStorage.removeItem('stockpro_user');
          const banInfo = {
            email: authResult.data.email || identifier,
            name: authResult.data.name,
            avatar: authResult.data.avatar,
            storeName: authResult.data.storeName,
            tiwiId: authResult.data.tiwiId,
            banReason: authResult.data.banReason
          };
          sessionStorage.setItem('tiwlo_banned_info', JSON.stringify(banInfo));
          localStorage.setItem('tiwlo_banned_info', JSON.stringify(banInfo));
          onAccountDisabled?.(banInfo);
          setLoading(false);
          return;
        }
        setErrorMsg(authResult.data?.error || 'Couldn’t find your Tiwlo Account or incorrect password.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Network connection error. Please try again.');
      setLoading(false);
    }
  };

  // Step 2: Verify Email Address Passcode
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    const cleanCode = emailVerifyData.code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Enter a valid 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tempToken: emailVerifyData.tempToken,
          otpCode: cleanCode
        })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        showToast?.('Email verified successfully!');
        if (data.requires2FA) {
          setTwoFactorData({
            tempToken: data.tempToken,
            email: data.email || emailVerifyData.email,
            emailMasked: data.emailMasked || emailVerifyData.emailMasked,
            code: ''
          });
          setResendCountdown(60);
          setViewMode('2fa');
          return;
        }
        if (data.requires2FASetup) {
          setSetup2FAData({
            tempToken: data.tempToken,
            email: data.email || emailVerifyData.email,
            emailMasked: data.emailMasked || emailVerifyData.emailMasked,
            code: ''
          });
          setResendCountdown(60);
          setViewMode('setup_2fa');
          return;
        }
        setViewMode('login');
      } else {
        setErrorMsg(data?.error || 'Wrong code. Try again.');
      }
    } catch (err) {
      console.error('Verify email error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: Change Email Address & Resend Verification Code
  const handleChangeEmailSubmit = async (e) => {
    e.preventDefault();
    if (!newEmailInput.trim() || !newEmailInput.includes('@')) {
      setErrorMsg('Enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/change-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tempToken: emailVerifyData.tempToken,
          newEmail: newEmailInput.trim(),
          password
        })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setEmailVerifyData(prev => ({
          ...prev,
          tempToken: data.newTempToken,
          email: data.email,
          emailMasked: data.emailMasked,
          code: ''
        }));
        setIsChangingEmail(false);
        setNewEmailInput('');
        setResendCountdown(data.deliveryStatus === 'failed' ? 0 : 60);
        if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
        else showToast?.(data.message || 'Email updated. Verification code sent.');
      } else {
        setErrorMsg(data?.error || 'Failed to update email address.');
      }
    } catch (err) {
      console.error('Change email error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2c: Resend Email Verification Passcode
  const handleResendEmailVerification = async () => {
    if (resendCountdown > 0) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/resend-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken: emailVerifyData.tempToken })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setEmailVerifyData(prev => ({
          ...prev,
          tempToken: data.newTempToken || prev.tempToken,
          emailMasked: data.emailMasked || prev.emailMasked,
          code: ''
        }));
        setResendCountdown(data.deliveryStatus === 'failed' ? 15 : 60);
        if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
        else showToast?.(data.message || 'A fresh verification code has been dispatched to your email.');
      } else {
        setErrorMsg(data?.error || 'Failed to resend verification code.');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Verify 2FA Code
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (mfaSubmitting.current) return;
    const cleanCode = twoFactorData.code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Enter the 6-digit verification code.');
      return;
    }

    try {
      mfaSubmitting.current = true;
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tempToken: twoFactorData.tempToken,
          otpCode: cleanCode
        })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        localStorage.setItem('stockpro_session', data.sessionToken);
        localStorage.setItem('stockpro_user', JSON.stringify(data.user));
        showToast?.(`Welcome back, ${data.user.name || data.user.storeName}!`);
        onLoginSuccess?.(data.user, data.sessionToken);
      } else {
        setErrorMsg(data?.error || 'Wrong code. Try again.');
      }
    } catch (err) {
      console.error('2FA verification error:', err);
      setErrorMsg('Network connection error. Please try again.');
    } finally {
      mfaSubmitting.current = false;
      setLoading(false);
    }
  };

  // Step 3b: Resend 2FA Code
  const handleResend2FA = async () => {
    if (resendCountdown > 0) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/resend-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken: twoFactorData.tempToken })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setTwoFactorData(prev => ({
          ...prev,
          tempToken: data.newTempToken,
          emailMasked: data.emailMasked || prev.emailMasked,
          code: ''
        }));
        setResendCountdown(data.deliveryStatus === 'failed' ? 15 : 60);
        if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
        else showToast?.(data.message || 'A fresh verification code has been dispatched to your email.');
      } else {
        setErrorMsg(data?.error || 'Failed to resend code. Please try again.');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3c: Verify 2FA Setup
  const handleVerifySetup2FA = async (e) => {
    e.preventDefault();
    if (setupMfaSubmitting.current) return;
    const cleanCode = setup2FAData.code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Enter the 6-digit confirmation code.');
      return;
    }

    try {
      setupMfaSubmitting.current = true;
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/setup-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tempToken: setup2FAData.tempToken,
          otpCode: cleanCode
        })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        localStorage.setItem('stockpro_session', data.sessionToken);
        localStorage.setItem('stockpro_user', JSON.stringify(data.user));
        showToast?.(data.message || `2-Step Verification enabled! Welcome, ${data.user.name || data.user.storeName}!`);
        onLoginSuccess?.(data.user, data.sessionToken);
      } else {
        setErrorMsg(data?.error || 'Wrong code. Try again.');
      }
    } catch (err) {
      console.error('Setup 2FA error:', err);
      setErrorMsg('Network connection error. Please try again.');
    } finally {
      setupMfaSubmitting.current = false;
      setLoading(false);
    }
  };

  // Step 3d: Resend 2FA Setup Code
  const handleResendSetup2FA = async () => {
    if (resendCountdown > 0) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/resend-setup-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken: setup2FAData.tempToken })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setSetup2FAData(prev => ({
          ...prev,
          tempToken: data.newTempToken,
          emailMasked: data.emailMasked || prev.emailMasked,
          code: ''
        }));
        setResendCountdown(data.deliveryStatus === 'failed' ? 15 : 60);
        if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
        else showToast?.(data.message || 'A fresh confirmation code has been dispatched.');
      } else {
        setErrorMsg(data?.error || 'Failed to resend confirmation code.');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Forgot Password Request
  const handleForgotPasswordRequest = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Enter your email or Tiwi ID');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: identifier.trim() })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setResetData({
          resetToken: data.resetToken,
          emailMasked: data.emailMasked || identifier,
          code: '',
          newPassword: '',
          confirmNewPassword: ''
        });
        setViewMode('forgot_verify');
        showToast?.(data.message || 'Recovery code sent to your email.');
      } else {
        setErrorMsg(data?.error || 'Unable to process recovery request.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4b: Forgot Password Verify & Reset
  const handleForgotPasswordVerify = async (e) => {
    e.preventDefault();
    if (!resetData.code || resetData.code.trim().length !== 6) {
      setErrorMsg('Enter the 6-digit recovery code.');
      return;
    }
    if (!resetData.newPassword || resetData.newPassword.length < 6) {
      setErrorMsg('Use 6 characters or more for your password.');
      return;
    }
    if (resetData.newPassword !== resetData.confirmNewPassword) {
      setErrorMsg('Those passwords didn’t match. Try again.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resetToken: resetData.resetToken,
          otpCode: resetData.code.trim(),
          newPassword: resetData.newPassword
        })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        showToast?.('Password reset successfully! Please sign in with your new password.');
        setPassword('');
        setViewMode('login');
      } else {
        setErrorMsg(data?.error || 'Invalid or expired recovery code.');
      }
    } catch (err) {
      console.error('Password reset verify error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F9] dark:bg-[#131314] flex flex-col justify-center items-center py-8 sm:py-12 px-4 selection:bg-[#0B57D0] selection:text-white transition-colors duration-200">
      {/* Liquid Page Loader */}
      {loading && <TiwloPageLoader />}

      {/* Main Google Material 3 Styled Card */}
      <div className="w-full max-w-[448px]">
        <div className="bg-white dark:bg-[#1E1F20] border border-[#DADCE0] dark:border-[#3C4043] rounded-[28px] p-7 sm:p-9 shadow-none space-y-5">
          
          {/* Top Brand Logo */}
          <div className="flex items-center">
            <img
              src="/tiwlologo.png"
              alt="Tiwlo"
              className="h-8 sm:h-9 w-auto object-contain dark:hidden"
            />
            <img
              src="/tiwlologo-dark.png"
              alt="Tiwlo"
              className="h-8 sm:h-9 w-auto object-contain hidden dark:block"
            />
          </div>

          {viewMode === 'profile_complete' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  Complete your profile
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  Add the required account details to finish setting up your Tiwlo ID. Your provider email is already verified.
                </p>
              </div>

              {socialProfile.avatar && (
                <img
                  src={socialProfile.avatar}
                  alt="Provider profile"
                  className="h-16 w-16 rounded-full object-cover"
                />
              )}
              {socialProfile.email && (
                <p className="text-sm text-slate-600 dark:text-slate-300">{socialProfile.email}</p>
              )}
              {errorMsg && (
                <div role="alert" className="rounded-lg bg-rose-50 p-3 text-[13px] font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {socialProfileLoading ? (
                <p className="text-sm text-slate-500">Loading your profile details…</p>
              ) : (
                <form onSubmit={handleCompleteSocialProfile} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Full name <span className="text-[#d93025]">*</span>
                    </label>
                    <input
                      type="text"
                      value={socialProfile.name}
                      onChange={event => setSocialProfile(current => ({
                        ...current,
                        name: event.target.value
                      }))}
                      placeholder="First and last name"
                      maxLength={255}
                      required
                      className="w-full rounded-[4px] border border-[#747775] px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Username (@handle) <span className="text-[#d93025]">*</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[14px] font-medium text-[#747775]">@</span>
                      <input
                        type="text"
                        value={socialProfile.handle}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          handle: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
                        }))}
                        placeholder="username"
                        minLength={3}
                        maxLength={30}
                        required
                        className="w-full rounded-[4px] border border-[#747775] py-3 pl-8 pr-3.5 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="mb-1 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Date of birth <span className="text-[#d93025]">*</span>
                    </label>
                    <p className="mb-2 text-[12px] text-[#747775]">
                      Used to keep your account details accurate.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={socialProfile.birthMonth}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          birthMonth: event.target.value
                        }))}
                        required
                        aria-label="Birth month"
                        className="w-full cursor-pointer rounded-[4px] border border-[#747775] bg-white px-3 py-2.5 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]"
                      >
                        <option value="">Month</option>
                        {MONTH_OPTIONS.map(month => (
                          <option key={month.value} value={month.value}>{month.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={socialProfile.birthDay}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          birthDay: event.target.value.replace(/\D/g, '').slice(0, 2)
                        }))}
                        placeholder="Day"
                        required
                        aria-label="Birth day"
                        className="w-full rounded-[4px] border border-[#747775] px-3 py-2.5 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={socialProfile.birthYear}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          birthYear: event.target.value.replace(/\D/g, '').slice(0, 4)
                        }))}
                        placeholder="Year"
                        required
                        aria-label="Birth year"
                        className="w-full rounded-[4px] border border-[#747775] px-3 py-2.5 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Country <span className="text-[#d93025]">*</span>
                    </label>
                    <select
                      value={socialProfile.country}
                      onChange={event => setSocialProfile(current => ({
                        ...current,
                        country: event.target.value
                      }))}
                      required
                      className="w-full cursor-pointer rounded-[4px] border border-[#747775] bg-white px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]"
                    >
                      {COUNTRY_OPTIONS.map(country => (
                        <option key={country.code} value={country.name}>
                          {country.flag} {country.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Phone number <span className="text-[#d93025]">*</span>
                    </label>
                    <div className="flex overflow-hidden rounded-[4px] border border-[#747775] focus-within:border-[#0b57d0] focus-within:ring-1 focus-within:ring-[#0b57d0]">
                      <span className="flex shrink-0 items-center border-r border-[#dadce0] bg-[#f8f9fa] px-3 text-[13px] text-[#1f1f1f]">
                        {COUNTRY_OPTIONS.find(option => option.name === socialProfile.country)?.dial || '+880'}
                      </span>
                      <input
                        type="tel"
                        value={socialProfile.phone.startsWith('+')
                          ? socialProfile.phone.replace(/^\+\d+\s*/, '')
                          : socialProfile.phone}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          phone: event.target.value.replace(/[^\d\s\-()]/g, '').slice(0, 24)
                        }))}
                        placeholder={COUNTRY_OPTIONS.find(option => option.name === socialProfile.country)?.placeholder || '1700-000000'}
                        autoComplete="tel-national"
                        required
                        className="w-full px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none placeholder:text-[#747775]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Street address <span className="text-[#d93025]">*</span>
                    </label>
                    <input
                      type="text"
                      value={socialProfile.address}
                      onChange={event => setSocialProfile(current => ({
                        ...current,
                        address: event.target.value
                      }))}
                      placeholder="Street address, P.O. box, company name, c/o"
                      required
                      className="w-full rounded-[4px] border border-[#747775] px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Apartment, suite, unit (optional)
                    </label>
                    <input
                      type="text"
                      value={socialProfile.addressLine2}
                      onChange={event => setSocialProfile(current => ({
                        ...current,
                        addressLine2: event.target.value
                      }))}
                      placeholder="Apt, Suite, Unit, Building, Floor, etc."
                      className="w-full rounded-[4px] border border-[#747775] px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                        City / Region <span className="text-[#d93025]">*</span>
                      </label>
                      <input
                        type="text"
                        value={socialProfile.city}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          city: event.target.value
                        }))}
                        placeholder="Dhaka"
                        required
                        className="w-full rounded-[4px] border border-[#747775] px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={socialProfile.postalCode}
                        onChange={event => setSocialProfile(current => ({
                          ...current,
                          postalCode: event.target.value
                        }))}
                        placeholder="1212"
                        className="w-full rounded-[4px] border border-[#747775] px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#1f1f1f] dark:text-[#E3E3E3]">
                      Gender
                    </label>
                    <select
                      value={socialProfile.gender}
                      onChange={event => setSocialProfile(current => ({
                        ...current,
                        gender: event.target.value
                      }))}
                      className="w-full cursor-pointer rounded-[4px] border border-[#747775] bg-white px-3.5 py-3 text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Rather not say">Rather not say</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-full bg-[#0B57D0] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0842A0] disabled:opacity-50"
                  >
                    {loading ? 'Saving…' : 'Continue'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. STANDARD LOGIN VIEW                                    */}
          {/* ========================================================= */}
          {viewMode === 'login' && (
            <>
              <div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  Sign in
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  to continue to Tiwlo ID
                </p>
              </div>

              {/* Social Quick Sign-In */}
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!socialProviders.loaded || !socialProviders.google}
                    onClick={() => startSocialLogin('google')}
                    title={!socialProviders.loaded ? 'Checking sign-in availability…' : (socialProviders.google ? 'Continue with Google' : 'Google sign-in is not configured.')}
                    className="flex items-center justify-center space-x-2 py-2 px-3 rounded-full border border-[#747775]/40 text-[#1F1F1F] dark:text-[#E3E3E3] text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.27 21.41 7.34 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.43l4.03-3.14z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.59 1.25 6.57l4.03 3.14c.95-2.83 3.6-4.96 6.72-4.96z"/>
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    disabled={!socialProviders.loaded || !socialProviders.github}
                    onClick={() => startSocialLogin('github')}
                    title={!socialProviders.loaded ? 'Checking sign-in availability…' : (socialProviders.github ? 'Continue with GitHub' : 'GitHub sign-in is not configured.')}
                    className="flex items-center justify-center space-x-2 py-2 px-3 rounded-full border border-[#747775]/40 text-[#1F1F1F] dark:text-[#E3E3E3] text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.51-1.29-1.24-1.63-1.24-1.63-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.76 2.01 3.44 1.54.1-.73.4-1.22.69-1.5-2.48-.28-5.09-1.24-5.09-5.53 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.1-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.16 1.78 1.16 3 0 4.3-2.62 5.25-5.12 5.52.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/>
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-[#747775]" role="status">
                  {!socialProviders.loaded
                    ? 'Checking social sign-in options…'
                    : (socialProviders.google || socialProviders.github
                      ? 'Continue securely with Google or GitHub. New accounts are created automatically.'
                      : 'Google and GitHub sign-in are temporarily unavailable.')}
                </p>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#DADCE0] dark:border-[#3C4043]" />
                  </div>
                  <div className="relative bg-white dark:bg-[#1E1F20] px-3 text-[11px] text-[#747775]">
                    or
                  </div>
                </div>
              </div>


              {/* Error Message Alert */}
              {errorMsg && (
                <div className="p-3 rounded-[8px] bg-[#FCE8E6] dark:bg-[#5C1D18] text-[#C5221F] dark:text-[#F28B82] text-[13px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email or Tiwi ID */}
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Email or Tiwi ID"
                      required
                      className="w-full px-4 py-3.5 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition placeholder:text-[#747775]"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="w-full pl-4 pr-11 py-3.5 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition placeholder:text-[#747775]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#747775] hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="mt-1.5 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setViewMode('forgot_request');
                      }}
                      className="text-[13px] font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {/* Google Material Action Buttons */}
                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onNavigateToRegister}
                    className="text-[14px] font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#0B57D0]/10 px-3 py-2 rounded-full transition cursor-pointer"
                  >
                    Create account
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Checking...' : 'Next'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ========================================================= */}
          {/* 2. EMAIL VERIFICATION VIEW (First step for unverified email)*/}
          {/* ========================================================= */}
          {viewMode === 'email_verify' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  Verify your email
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  To continue, confirm ownership of your email address.
                </p>
              </div>

              {/* Google Style Account Chip with Change Email button */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#747775]/40 bg-transparent text-[13px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                <span className="w-5 h-5 rounded-full bg-[#0B57D0]/10 text-[#0B57D0] dark:text-[#A8C7FA] flex items-center justify-center text-xs font-bold uppercase">
                  {(emailVerifyData.email || 'U').charAt(0)}
                </span>
                <span className="truncate max-w-[200px]">{emailVerifyData.email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingEmail(!isChangingEmail);
                    setErrorMsg('');
                  }}
                  className="text-[12px] font-semibold text-[#0B57D0] dark:text-[#A8C7FA] hover:underline ml-1 cursor-pointer"
                >
                  {isChangingEmail ? 'Cancel' : 'Change'}
                </button>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 rounded-[8px] bg-[#FCE8E6] dark:bg-[#5C1D18] text-[#C5221F] dark:text-[#F28B82] text-[13px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Change Email Form (If user clicked Change) */}
              {isChangingEmail ? (
                <form onSubmit={handleChangeEmailSubmit} className="space-y-4 pt-1">
                  <div>
                    <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5] mb-1">
                      Enter correct email address
                    </label>
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      placeholder="name@example.com"
                      required
                      autoFocus
                      className="w-full px-4 py-3 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0]"
                    />
                  </div>

                  <div>
                    <label htmlFor="email-correction-password" className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5] mb-1">
                      Confirm your account password
                    </label>
                    <input
                      id="email-correction-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setIsChangingEmail(false)}
                      className="text-[14px] font-medium text-[#747775] hover:bg-[#F0F4F9] dark:hover:bg-[#28292A] px-3 py-2 rounded-full cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !newEmailInput.trim()}
                      className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Update & Send Code'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Verification Code Input Form */
                <form onSubmit={handleVerifyEmail} className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5">
                      Enter the 6-digit code sent to your email
                    </label>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-[#444746] dark:text-[#C4C7C5] font-semibold text-base select-none">
                        T -
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailVerifyData.code}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setEmailVerifyData(prev => ({ ...prev, code: val }));
                          setErrorMsg('');
                        }}
                        placeholder="Enter code"
                        autoFocus
                        required
                        className="w-full pl-12 pr-4 py-3.5 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-lg font-medium tracking-[0.25em] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleResendEmailVerification}
                      disabled={resendCountdown > 0 || loading}
                      className="text-[14px] font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#0B57D0]/10 px-3 py-2 rounded-full cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                    >
                      <RotateCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      <span>{resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading || emailVerifyData.code.length !== 6}
                      className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Next'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. TWO-STEP VERIFICATION (2FA) VIEW                       */}
          {/* ========================================================= */}
          {viewMode === '2fa' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  2-Step Verification
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  To help keep your account safe, enter the 6-digit passcode sent to:
                </p>
              </div>

              {/* User Chip */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#747775]/40 bg-transparent text-[13px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                <span className="w-5 h-5 rounded-full bg-[#0B57D0]/10 text-[#0B57D0] dark:text-[#A8C7FA] flex items-center justify-center text-xs font-bold uppercase">
                  {(twoFactorData.emailMasked || 'U').charAt(0)}
                </span>
                <span>{twoFactorData.emailMasked}</span>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 rounded-[8px] bg-[#FCE8E6] dark:bg-[#5C1D18] text-[#C5221F] dark:text-[#F28B82] text-[13px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerify2FA} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5">
                    Enter the 6-digit code
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-[#444746] dark:text-[#C4C7C5] font-semibold text-base select-none">
                      T -
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={twoFactorData.code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setTwoFactorData(prev => ({ ...prev, code: val }));
                        setErrorMsg('');
                      }}
                      placeholder="Enter code"
                      autoFocus
                      required
                      className="w-full pl-12 pr-4 py-3.5 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-lg font-medium tracking-[0.25em] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResend2FA}
                    disabled={resendCountdown > 0 || loading}
                    className="text-[14px] font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#0B57D0]/10 px-3 py-2 rounded-full cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                  >
                    <RotateCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    <span>{resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading || twoFactorData.code.length !== 6}
                    className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Next'}
                  </button>
                </div>
              </form>

              <div className="pt-2 text-left border-t border-[#DADCE0] dark:border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setViewMode('login');
                  }}
                  className="text-[13px] text-[#0B57D0] dark:text-[#A8C7FA] hover:underline cursor-pointer"
                >
                  Try another way / Back to sign in
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3b. TWO-STEP VERIFICATION (2FA) SETUP VIEW                */}
          {/* ========================================================= */}
          {viewMode === 'setup_2fa' && (
            <div className="space-y-4">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#0B57D0]/10 text-[#0B57D0] dark:text-[#A8C7FA] flex items-center justify-center mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  Set up 2-Step Verification
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  To protect your account and data, Tiwlo requires 2-Step Verification. Enter the 6-digit passcode sent to:
                </p>
              </div>

              {/* User Chip */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#747775]/40 bg-transparent text-[13px] font-medium text-[#1F1F1F] dark:text-[#E3E3E3]">
                <span className="w-5 h-5 rounded-full bg-[#0B57D0]/10 text-[#0B57D0] dark:text-[#A8C7FA] flex items-center justify-center text-xs font-bold uppercase">
                  {(setup2FAData.emailMasked || 'U').charAt(0)}
                </span>
                <span>{setup2FAData.emailMasked}</span>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="p-3 rounded-[8px] bg-[#FCE8E6] dark:bg-[#5C1D18] text-[#C5221F] dark:text-[#F28B82] text-[13px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerifySetup2FA} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#444746] dark:text-[#C4C7C5] mb-1.5">
                    Enter the 6-digit confirmation code
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-[#444746] dark:text-[#C4C7C5] font-semibold text-base select-none">
                      T -
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={setup2FAData.code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setSetup2FAData(prev => ({ ...prev, code: val }));
                        setErrorMsg('');
                      }}
                      placeholder="Enter code"
                      autoFocus
                      required
                      className="w-full pl-12 pr-4 py-3.5 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-lg font-medium tracking-[0.25em] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResendSetup2FA}
                    disabled={resendCountdown > 0 || loading}
                    className="text-[14px] font-medium text-[#0B57D0] dark:text-[#A8C7FA] hover:bg-[#0B57D0]/10 px-3 py-2 rounded-full cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                  >
                    <RotateCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    <span>{resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading || setup2FAData.code.length !== 6}
                    className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Activating...' : 'Turn on 2FA'}
                  </button>
                </div>
              </form>

              <div className="pt-2 text-left border-t border-[#DADCE0] dark:border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setViewMode('login');
                  }}
                  className="text-[13px] text-[#0B57D0] dark:text-[#A8C7FA] hover:underline cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. FORGOT PASSWORD: REQUEST CODE                          */}
          {/* ========================================================= */}
          {viewMode === 'forgot_request' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  Account recovery
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  Enter your email or Tiwi ID to receive a recovery code.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-[8px] bg-[#FCE8E6] dark:bg-[#5C1D18] text-[#C5221F] dark:text-[#F28B82] text-[13px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Email or Tiwi ID"
                    required
                    autoFocus
                    className="w-full px-4 py-3.5 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition placeholder:text-[#747775]"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setViewMode('login');
                    }}
                    className="text-[14px] font-medium text-[#747775] hover:bg-[#F0F4F9] dark:hover:bg-[#28292A] px-3 py-2 rounded-full cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !identifier.trim()}
                    className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Next'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. FORGOT PASSWORD: VERIFY CODE & SET NEW PASSWORD        */}
          {/* ========================================================= */}
          {viewMode === 'forgot_verify' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-[24px] font-normal text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
                  Reset password
                </h1>
                <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-normal">
                  Enter the recovery code sent to {resetData.emailMasked} and choose a new password.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-[8px] bg-[#FCE8E6] dark:bg-[#5C1D18] text-[#C5221F] dark:text-[#F28B82] text-[13px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleForgotPasswordVerify} className="space-y-3.5">
                <div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-[#444746] dark:text-[#C4C7C5] font-semibold text-base select-none">
                      T -
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={resetData.code}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setResetData(prev => ({ ...prev, code: val }));
                        setErrorMsg('');
                      }}
                      placeholder="6-digit recovery code"
                      autoFocus
                      required
                      className="w-full pl-12 pr-4 py-3 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-base font-medium tracking-[0.2em] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0]"
                    />
                  </div>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={resetData.newPassword}
                      onChange={(e) => setResetData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="New password (min 6 characters)"
                      required
                      className="w-full pl-4 pr-11 py-3 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#747775] cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <input
                    type="password"
                    value={resetData.confirmNewPassword}
                    onChange={(e) => setResetData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                    placeholder="Confirm new password"
                    required
                    className="w-full px-4 py-3 rounded-[8px] border border-[#747775] dark:border-[#8E918F] bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0]"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setViewMode('login');
                    }}
                    className="text-[14px] font-medium text-[#747775] hover:bg-[#F0F4F9] dark:hover:bg-[#28292A] px-3 py-2 rounded-full cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading || resetData.code.length !== 6 || resetData.newPassword.length < 6}
                    className="px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-[14px] transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Resetting...' : 'Change password'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

        {/* Google Style Minimalist Footer */}
        <div className="mt-6 flex items-center justify-between text-[12px] text-[#747775] px-4">
          <span>English (United States)</span>
          <div className="space-x-4">
            <span className="hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] cursor-pointer">Help</span>
            <span className="hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] cursor-pointer">Privacy</span>
            <span className="hover:text-[#1F1F1F] dark:hover:text-[#E3E3E3] cursor-pointer">Terms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
