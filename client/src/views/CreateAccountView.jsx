import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import { getPlatformUrl } from '../config/platformConfig';
import { COUNTRY_OPTIONS, MONTH_OPTIONS, getDaysInBirthMonth } from '../utils/accountFormOptions';
import {
  Eye,
  EyeOff,
  User,
  Building2,
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Copy,
  RotateCw,
  Globe,
  Plus,
  ChevronDown,
  Edit2,
  Trash2,
  Search
} from 'lucide-react';
import TiwloPageLoader from '../components/TiwloUniqueLoader';

const API_BASE = '/api';

export default function CreateAccountView({
  onNavigateToLogin,
  onRegisterSuccess,
  showToast,
  initialSsoData = null
}) {
  // Stepper state: 1, 2, 3, 4 (Verify Email), 5 (Setup 2FA) or 'success'
  const [socialProfileMode] = useState(() =>
    new URLSearchParams(window.location.search).get('social_profile') === 'required'
  );
  const [socialProfileChallengeToken] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('social_profile_token') || ''
  );
  const [step, setStep] = useState(socialProfileMode ? 2 : 1);
  const [socialProviders, setSocialProviders] = useState({ google: false, github: false, loaded: false });

  // Form State
  const [formData, setFormData] = useState({
    // SSO Flags
    isSso: false,
    ssoProvider: null, // 'Google' | 'GitHub'

    // Step 1: Credentials
    email: '',
    handle: '',
    password: '',
    confirmPassword: '',

    // Step 2: Account Type & Details
    accountType: 'personal', // 'personal' | 'business'
    fullName: '',
    businessName: '',
    ownerName: '',
    birthMonth: '',
    birthDay: '',
    birthYear: '',
    gender: '',
    dateOfBirth: '',
    phoneCountryCode: '+880',
    phoneNational: '',
    phone: '',
    address: '',
    addressLine2: '',
    city: '',
    postalCode: '',
    country: 'Bangladesh',

    // Step 3: Billing Address (Google Cloud style)
    sameAsAddress: true,
    billingAddress: '',
    billingCity: '',
    billingPostalCode: '',
    billingCountry: 'Bangladesh'
  });

  // Country selector state for phone
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Step 3: Google Cloud-style Billing Addresses state
  const [billingAddresses, setBillingAddresses] = useState([]);
  const [selectedBillingId, setSelectedBillingId] = useState('primary');
  const [showAddBillingForm, setShowAddBillingForm] = useState(false);
  const [editingBillingId, setEditingBillingId] = useState(null);
  const [billingFormData, setBillingFormData] = useState({
    name: '',
    street: '',
    street2: '',
    city: 'Dhaka',
    postalCode: '1212',
    country: 'Bangladesh',
    taxId: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialProfileLoading, setSocialProfileLoading] = useState(socialProfileMode);
  const [errorMsg, setErrorMsg] = useState('');
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Verification States (Mandatory Email Verification & 2FA Setup)
  const [verifyEmailData, setVerifyEmailData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: ''
  });
  const [setup2FAData, setSetup2FAData] = useState({
    tempToken: '',
    email: '',
    emailMasked: '',
    code: ''
  });
  const [resendCountdown, setResendCountdown] = useState(0);

  // Real-time Email Check State (Google Style Live Sync)
  const [emailError, setEmailError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Real-time Handle/Username Check State
  const [handleError, setHandleError] = useState('');
  const [handleAvailable, setHandleAvailable] = useState(false);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);

  useEffect(() => {
    if (!socialProfileMode) return undefined;
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
        const profile = result.profile;
        const [birthYear = '', birthMonth = '', birthDay = ''] = (profile.dateOfBirth || '').split('-');
        const matchedCountry = COUNTRY_OPTIONS.find(country => country.name === profile.country) || COUNTRY_OPTIONS[0];
        const rawPhone = profile.phone || '';
        const phoneCountry = COUNTRY_OPTIONS.find(country => rawPhone.startsWith(country.dial)) || matchedCountry;
        const phoneNational = rawPhone.startsWith(phoneCountry.dial)
          ? rawPhone.slice(phoneCountry.dial.length).trim()
          : rawPhone;
        const suggestedHandle = (profile.handle || profile.name || profile.email?.split('@')[0] || '')
          .replace(/^@/, '')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 30);
        setSelectedCountry(phoneCountry);
        setFormData(current => ({
          ...current,
          email: profile.email || '',
          handle: suggestedHandle,
          accountType: 'personal',
          fullName: profile.name || '',
          birthMonth,
          birthDay,
          birthYear,
          gender: profile.gender || '',
          dateOfBirth: profile.dateOfBirth || '',
          phoneCountryCode: phoneCountry.dial,
          phoneNational,
          phone: rawPhone,
          address: profile.address || '',
          addressLine2: profile.addressLine2 || '',
          city: profile.city || '',
          postalCode: profile.postalCode || '',
          country: profile.country || matchedCountry.name
        }));
      })
      .catch(error => {
        if (active) setErrorMsg(error.message);
      })
      .finally(() => {
        if (active) setSocialProfileLoading(false);
      });
    return () => { active = false; };
  }, [socialProfileMode, socialProfileChallengeToken]);

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
    const returnTo = new URLSearchParams(window.location.search).get('return_to');
    if (returnTo) params.set('return_to', returnTo);
    window.location.assign(`/api/auth/${provider}${params.toString() ? `?${params}` : ''}`);
  };

  // Live Sync: Check email uniqueness in real-time
  useEffect(() => {
    const emailToTest = formData.email?.trim();
    if (!emailToTest || !emailToTest.includes('@') || !emailToTest.includes('.')) {
      setEmailError('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingEmail(true);
        const res = await fetch(`${API_BASE}/auth/check-availability?email=${encodeURIComponent(emailToTest)}`);
        const data = await res.json();
        if (data && !data.emailAvailable) {
          setEmailError(data.emailError || 'That email is already in use.');
        } else {
          setEmailError('');
        }
      } catch (err) {
        console.error('Email check error:', err);
        setEmailError('Could not check email availability. Please try again.');
      } finally {
        setIsCheckingEmail(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [formData.email]);

  // Live Sync: Check handle/username uniqueness in real-time
  useEffect(() => {
    let active = true;
    let raw = formData.handle?.trim().toLowerCase() || '';
    if (raw.startsWith('@')) raw = raw.substring(1);
    if (!raw) {
      setHandleError('');
      setHandleAvailable(false);
      return () => { active = false; };
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(raw)) {
      setHandleError('Username must be 3-30 letters, numbers, or underscores.');
      setHandleAvailable(false);
      return () => { active = false; };
    }

    const timer = setTimeout(async () => {
      try {
        setIsCheckingHandle(true);
        const res = socialProfileMode
          ? await fetch(`${API_BASE}/auth/social/check-handle`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(socialProfileChallengeToken
                ? { 'X-Social-Profile-Challenge': socialProfileChallengeToken }
                : {})
            },
            body: JSON.stringify({
              handle: raw,
              challengeToken: socialProfileChallengeToken || undefined
            })
          })
          : await fetch(`${API_BASE}/auth/check-availability?handle=${encodeURIComponent(raw)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not check username availability.');
        if (!active) return;
        if (data && !data.handleAvailable) {
          setHandleError(data.handleError || 'That username is already taken. Try another.');
          setHandleAvailable(false);
        } else {
          setHandleError('');
          setHandleAvailable(true);
        }
      } catch (err) {
        console.error('Handle check error:', err);
        if (active) {
          setHandleError(err.message || 'Could not check username availability. Please try again.');
          setHandleAvailable(false);
        }
      } finally {
        if (active) setIsCheckingHandle(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [formData.handle, socialProfileMode, socialProfileChallengeToken]);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Handle incoming SSO data if navigated from Login or Social SSO trigger
  useEffect(() => {
    if (initialSsoData && initialSsoData.email) {
      let matchedCountry = COUNTRY_OPTIONS[0];
      let nationalNum = initialSsoData.phone || '';
      if (initialSsoData.phone) {
        const found = COUNTRY_OPTIONS.find(c => initialSsoData.phone.startsWith(c.dial));
        if (found) {
          matchedCountry = found;
          nationalNum = initialSsoData.phone.replace(found.dial, '').trim();
        }
      }
      setSelectedCountry(matchedCountry);

      setFormData(prev => ({
        ...prev,
        email: initialSsoData.email,
        fullName: initialSsoData.name || prev.fullName,
        ownerName: initialSsoData.name || prev.ownerName,
        isSso: true,
        ssoProvider: initialSsoData.provider || 'Google',
        accountType: initialSsoData.accountType || prev.accountType,
        address: initialSsoData.address || prev.address,
        phoneNational: nationalNum,
        phone: initialSsoData.phone || prev.phone
      }));
      setStep(2);
    }
  }, [initialSsoData]);

  const updateField = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    if (field === 'handle') {
      setHandleAvailable(false);
      setHandleError('');
      setIsCheckingHandle(false);
    }
    setErrorMsg('');
  };

  // Password strength calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', color: 'bg-[#dadce0]' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-[#d93025]', text: 'text-[#d93025]' };
    if (score <= 4) return { score: 2, label: 'Good', color: 'bg-[#f29900]', text: 'text-[#b06000]' };
    return { score: 3, label: 'Strong', color: 'bg-[#137333]', text: 'text-[#137333]' };
  };

  const pwdStrength = getPasswordStrength(formData.password);

  const handleDisconnectSso = () => {
    setFormData(prev => ({
      ...prev,
      isSso: false,
      ssoProvider: null
    }));
    setStep(1);
  };

  // Step 1 Validation & Next
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (emailError) {
      return;
    }

    let rawHandle = (formData.handle || '').trim().toLowerCase();
    if (rawHandle.startsWith('@')) rawHandle = rawHandle.substring(1);
    if (!rawHandle || rawHandle.length < 3) {
      setHandleError('Please choose a username of at least 3 characters.');
      return;
    }

    if (handleError) {
      return;
    }

    // Synchronously verify email and username uniqueness before proceeding
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/auth/check-availability?email=${encodeURIComponent(formData.email.trim())}&handle=${encodeURIComponent(rawHandle)}`);
      const data = await res.json();
      if (data && !data.emailAvailable) {
        setEmailError(data.emailError || 'That email is already in use.');
        setLoading(false);
        return;
      }
      if (data && !data.handleAvailable) {
        setHandleError(data.handleError || 'That username is already taken. Try another.');
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Check availability submit error:', err);
      setErrorMsg('Could not check email and username availability. Check your connection and try again.');
      return;
    } finally {
      setLoading(false);
    }

    if (!formData.password || formData.password.length < 6) {
      setErrorMsg('Use 6 or more characters for your password.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords didn't match. Try again.");
      return;
    }
    setErrorMsg('');
    setEmailError('');
    setHandleError('');
    setStep(2);
  };

  // Step 2 Validation & Next
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    if (!formData.accountType) {
      setErrorMsg('Please select an account type (Personal or Business).');
      return;
    }

    if (formData.accountType === 'personal') {
      if (!formData.fullName.trim()) {
        setErrorMsg('Please enter your full personal name.');
        return;
      }
      if (!formData.birthMonth || !formData.birthDay || !formData.birthYear) {
        setErrorMsg('Please select your complete date of birth (Month, Day, Year).');
        return;
      }
      const birthYear = Number(formData.birthYear);
      const birthDay = Number(formData.birthDay);
      const maxBirthDay = getDaysInBirthMonth(formData.birthMonth, formData.birthYear);
      const normalizedBirthDate = `${formData.birthYear}-${formData.birthMonth}-${formData.birthDay.padStart(2, '0')}`;
      const parsedBirthDate = new Date(`${normalizedBirthDate}T00:00:00.000Z`);
      if (
        !/^\d{4}$/.test(formData.birthYear) ||
        birthYear < 1900 ||
        birthYear > new Date().getFullYear() ||
        !/^\d{1,2}$/.test(formData.birthDay) ||
        birthDay < 1 ||
        birthDay > maxBirthDay ||
        Number.isNaN(parsedBirthDate.getTime()) ||
        parsedBirthDate.toISOString().slice(0, 10) !== normalizedBirthDate ||
        parsedBirthDate > new Date()
      ) {
        setErrorMsg('Enter a valid date of birth.');
        return;
      }
    } else {
      if (!formData.businessName.trim()) {
        setErrorMsg('Please enter your company or business name.');
        return;
      }
      if (!formData.ownerName.trim()) {
        setErrorMsg('Please enter the contact or representative name.');
        return;
      }
    }

    if (!formData.address.trim()) {
      setErrorMsg('Please enter your street address.');
      return;
    }

    // Combine country calling code and phone number
    const completePhone = formData.phoneNational?.trim()
      ? `${selectedCountry.dial} ${formData.phoneNational.trim()}`
      : (formData.phone?.trim() || '');

    const effectiveName = formData.accountType === 'business'
      ? formData.businessName.trim()
      : formData.fullName.trim();

    const monthObj = MONTH_OPTIONS.find(m => m.value === formData.birthMonth);
    const birthFormatted = (formData.birthYear && formData.birthMonth && formData.birthDay)
      ? `${monthObj ? monthObj.name : formData.birthMonth} ${formData.birthDay}, ${formData.birthYear}`
      : (formData.dateOfBirth || '');

    if (socialProfileMode) {
      const handle = (formData.handle || '').trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
        setHandleError('Username must be 3-30 letters, numbers, or underscores.');
        setErrorMsg('Choose a valid username.');
        return;
      }
      if (isCheckingHandle || !handleAvailable || handleError) {
        setErrorMsg(handleError || 'Wait for the username availability check to finish.');
        return;
      }
      const phoneDigits = completePhone.replace(/\D/g, '');
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        setErrorMsg('Please enter a valid phone number.');
        return;
      }
      if (!formData.city.trim() || !formData.country) {
        setErrorMsg('Please enter your city and country.');
        return;
      }
      const fullAddress = [
        formData.address.trim(),
        formData.addressLine2.trim(),
        formData.city.trim(),
        formData.postalCode.trim(),
        formData.country
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
            name: effectiveName,
            handle,
            dateOfBirth: `${formData.birthYear}-${formData.birthMonth}-${formData.birthDay.padStart(2, '0')}`,
            address: fullAddress,
            phone: completePhone,
            city: formData.city.trim(),
            country: formData.country,
            postalCode: formData.postalCode.trim(),
            gender: formData.gender
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          if (response.status === 409) {
            setHandleAvailable(false);
            setHandleError(result.error || 'That username is already taken. Choose another.');
          }
          throw new Error(result.error || 'Could not save your profile. Please try again.');
        }
        const loginParams = new URLSearchParams({
          social_flow: '1'
        });
        const returnTo = new URLSearchParams(window.location.search).get('return_to');
        if (returnTo) loginParams.set('return_to', returnTo);
        window.location.replace(`/login?${loginParams.toString()}`);
      } catch (error) {
        setErrorMsg(error.message || 'Could not save your profile. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Prepare primary billing address from step 2
    const primaryAddr = {
      id: 'primary',
      name: effectiveName,
      street: formData.address.trim(),
      street2: formData.addressLine2 ? formData.addressLine2.trim() : '',
      city: formData.city?.trim() || '',
      postalCode: formData.postalCode?.trim() || '',
      country: formData.country || selectedCountry.name || 'Bangladesh',
      taxId: '',
      isPrimary: true
    };

    setBillingAddresses(prev => {
      const existingOthers = prev.filter(a => a.id !== 'primary');
      return [primaryAddr, ...existingOthers];
    });

    if (!selectedBillingId) {
      setSelectedBillingId('primary');
    }

    setFormData(prev => ({
      ...prev,
      dateOfBirth: birthFormatted,
      phone: completePhone,
      billingAddress: prev.address,
      billingCity: prev.city,
      billingPostalCode: prev.postalCode || '',
      billingCountry: prev.country || selectedCountry.name || 'Bangladesh'
    }));

    setErrorMsg('');
    setStep(3);
  };

  // Open form to add a new billing address (Google Cloud style)
  const handleOpenAddBillingForm = () => {
    const effectiveName = formData.accountType === 'business'
      ? formData.businessName.trim()
      : formData.fullName.trim();

    setBillingFormData({
      name: effectiveName,
      street: '',
      street2: '',
      city: formData.city || 'Dhaka',
      postalCode: formData.postalCode || '1212',
      country: formData.country || selectedCountry.name || 'Bangladesh',
      taxId: ''
    });
    setEditingBillingId(null);
    setShowAddBillingForm(true);
    setErrorMsg('');
  };

  // Open form to edit an existing billing address
  const handleEditBillingAddress = (addr) => {
    setBillingFormData({
      name: addr.name || '',
      street: addr.street || '',
      street2: addr.street2 || '',
      city: addr.city || 'Dhaka',
      postalCode: addr.postalCode || '1212',
      country: addr.country || 'Bangladesh',
      taxId: addr.taxId || ''
    });
    setEditingBillingId(addr.id);
    setShowAddBillingForm(true);
    setErrorMsg('');
  };

  // Save the billing address from the inline form
  const handleSaveBillingAddress = (e) => {
    e.preventDefault();
    if (!billingFormData.name.trim()) {
      setErrorMsg('Please specify the invoicing entity or individual name.');
      return;
    }
    if (!billingFormData.street.trim()) {
      setErrorMsg('Please enter the billing street address.');
      return;
    }
    if (!billingFormData.city.trim()) {
      setErrorMsg('Please enter the city for billing.');
      return;
    }

    if (editingBillingId) {
      setBillingAddresses(prev => prev.map(addr => {
        if (addr.id === editingBillingId) {
          return {
            ...addr,
            name: billingFormData.name.trim(),
            street: billingFormData.street.trim(),
            street2: billingFormData.street2.trim(),
            city: billingFormData.city.trim(),
            postalCode: billingFormData.postalCode.trim(),
            country: billingFormData.country.trim(),
            taxId: billingFormData.taxId.trim()
          };
        }
        return addr;
      }));
      setSelectedBillingId(editingBillingId);
    } else {
      const newId = 'addr_' + Date.now();
      const newAddress = {
        id: newId,
        name: billingFormData.name.trim(),
        street: billingFormData.street.trim(),
        street2: billingFormData.street2.trim(),
        city: billingFormData.city.trim(),
        postalCode: billingFormData.postalCode.trim(),
        country: billingFormData.country.trim(),
        taxId: billingFormData.taxId.trim(),
        isPrimary: false
      };
      setBillingAddresses(prev => [...prev, newAddress]);
      setSelectedBillingId(newId);
    }

    setShowAddBillingForm(false);
    setEditingBillingId(null);
    setErrorMsg('');
  };

  // Delete a secondary billing address
  const handleDeleteBillingAddress = (idToDelete) => {
    if (idToDelete === 'primary') return;
    setBillingAddresses(prev => prev.filter(a => a.id !== idToDelete));
    if (selectedBillingId === idToDelete) {
      setSelectedBillingId('primary');
    }
  };

  // Step 3 Final Registration Submit
  const handleFinalSubmit = async (e) => {
    e.preventDefault();

    if (showAddBillingForm) {
      setErrorMsg('Please save or cancel the billing address form before proceeding.');
      return;
    }

    const activeBilling = billingAddresses.find(a => a.id === selectedBillingId) || billingAddresses[0];

    const fullBillingStreet = activeBilling
      ? `${activeBilling.street}${activeBilling.street2 ? ', ' + activeBilling.street2 : ''}`
      : (formData.address || formData.billingAddress);

    if (!fullBillingStreet || !fullBillingStreet.trim()) {
      setErrorMsg('Please specify a valid billing address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const displayName = formData.accountType === 'business'
        ? formData.businessName.trim()
        : formData.fullName.trim();

      const monthObj = MONTH_OPTIONS.find(m => m.value === formData.birthMonth);
      const birthFormatted = (formData.birthYear && formData.birthMonth && formData.birthDay)
        ? `${monthObj ? monthObj.name : formData.birthMonth} ${formData.birthDay}, ${formData.birthYear}`
        : (formData.dateOfBirth || '');

      const payload = {
        email: formData.email.trim(),
        handle: (formData.handle || '').trim().replace(/^@/, ''),
        username: (formData.handle || '').trim().replace(/^@/, ''),
        password: formData.isSso ? undefined : formData.password,
        isSso: formData.isSso,
        authMethod: formData.ssoProvider ? formData.ssoProvider.toLowerCase() : 'credentials',
        accountType: formData.accountType,
        name: formData.accountType === 'personal' ? formData.fullName.trim() : formData.ownerName.trim(),
        businessName: formData.accountType === 'business' ? formData.businessName.trim() : '',
        storeName: displayName,
        address: formData.address.trim(),
        phone: formData.phone.trim(),
        dateOfBirth: birthFormatted,
        birthday: birthFormatted,
        gender: formData.gender || '',
        billingDetails: {
          name: activeBilling?.name || displayName,
          address: fullBillingStreet.trim(),
          city: activeBilling?.city || formData.city || '',
          postalCode: activeBilling?.postalCode || formData.postalCode || '',
          country: activeBilling?.country || formData.country || 'Bangladesh',
          taxId: activeBilling?.taxId || '',
          phone: formData.phone.trim()
        },
        planId: 'free'
      };

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        if (data.requiresEmailVerification) {
          setVerifyEmailData({
            tempToken: data.tempToken,
            email: data.email || formData.email,
            emailMasked: data.emailMasked || formData.email,
            code: ''
          });
          setResendCountdown(data.deliveryStatus === 'failed' ? 0 : 60);
          setStep(4);
          if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
          else showToast?.(data.message || 'Please verify your email address to continue.');
          return;
        }

        if (data.requires2FASetup) {
          setSetup2FAData({
            tempToken: data.tempToken,
            email: data.email || formData.email,
            emailMasked: data.emailMasked || formData.email,
            code: ''
          });
          setResendCountdown(60);
          setStep(5);
          showToast?.(data.message || 'Please set up 2-Step Verification to secure your account.');
          return;
        }

        if (data.sessionToken) {
          localStorage.setItem('stockpro_session', data.sessionToken);
        }
        if (data.user) {
          localStorage.setItem('stockpro_user', JSON.stringify(data.user));
        }

        setCreatedResult(data);
        setStep('success');
        showToast?.(`Account created successfully! Welcome, ${displayName}`);
      } else {
        setErrorMsg(data?.error || 'Registration failed. Please verify your details.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg('Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Verify Email OTP Submit
  const handleVerifyEmailSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = verifyEmailData.code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit verification code.');
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
          tempToken: verifyEmailData.tempToken,
          otpCode: cleanCode
        })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        showToast?.('Email verified successfully!');
        if (data.requires2FASetup) {
          setSetup2FAData({
            tempToken: data.tempToken,
            email: data.email || verifyEmailData.email,
            emailMasked: data.emailMasked || verifyEmailData.emailMasked,
            code: ''
          });
          setResendCountdown(60);
          setStep(5);
          return;
        }
        if (data.sessionToken) {
          localStorage.setItem('stockpro_session', data.sessionToken);
        }
        if (data.user) {
          localStorage.setItem('stockpro_user', JSON.stringify(data.user));
        }
        setCreatedResult(data);
        setStep('success');
      } else {
        setErrorMsg(data?.error || 'Wrong code. Please try again.');
      }
    } catch (err) {
      console.error('Verify email error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (resendCountdown > 0) return;
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch(`${API_BASE}/auth/resend-email-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken: verifyEmailData.tempToken })
      });

      const data = await res.json();

      if (res.ok && data?.success) {
        setVerifyEmailData(prev => ({
          ...prev,
          tempToken: data.newTempToken || prev.tempToken,
          emailMasked: data.emailMasked || prev.emailMasked,
          code: ''
        }));
        setResendCountdown(data.deliveryStatus === 'failed' ? 15 : 60);
        if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
        else showToast?.(data.message || 'A fresh verification code has been dispatched.');
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

  // Step 5: Setup 2FA Submit
  const handleVerifySetup2FASubmit = async (e) => {
    e.preventDefault();
    const cleanCode = setup2FAData.code.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit confirmation code.');
      return;
    }

    try {
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
        const resolvedTiwiId = data.tiwiId || data.storeId || data.user?.tiwiId || data.user?.storeId || '';
        const userObj = data.user ? { ...data.user, tiwiId: resolvedTiwiId, storeId: resolvedTiwiId } : null;

        if (data.sessionToken) {
          localStorage.setItem('stockpro_session', data.sessionToken);
        }
        if (userObj) {
          localStorage.setItem('stockpro_user', JSON.stringify(userObj));
        }
        setCreatedResult({
          ...data,
          tiwiId: resolvedTiwiId,
          storeId: resolvedTiwiId,
          user: userObj
        });
        setStep('success');
      } else {
        setErrorMsg(data?.error || 'Incorrect security code. Please check your inbox.');
      }
    } catch (err) {
      console.error('2FA setup error:', err);
      setErrorMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSetup2FAOtp = async () => {
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
          tempToken: data.newTempToken || prev.tempToken,
          emailMasked: data.emailMasked || prev.emailMasked,
          code: ''
        }));
        setResendCountdown(data.deliveryStatus === 'failed' ? 15 : 60);
        if (data.deliveryStatus === 'failed') setErrorMsg(data.message);
        else showToast?.(data.message || 'A fresh confirmation code has been sent.');
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

  const handleCopyTiwiId = () => {
    const idToCopy = createdResult?.tiwiId || createdResult?.user?.tiwiId || createdResult?.user?.storeId;
    if (idToCopy) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      showToast?.(`Tiwi ID ${idToCopy} copied to clipboard!`);
    }
  };

  // Helper titles & subtitles per step
  const getStepHeader = () => {
    switch (step) {
      case 1:
        return {
          title: 'Create a Tiwlo Account',
          subtitle: 'Enter your credentials to access your Tiwlo SaaS cloud workspace and services.'
        };
      case 2:
        return {
          title: socialProfileMode ? 'Complete your profile' : 'Choose your account type',
          subtitle: socialProfileMode
            ? 'Your provider email is verified. Add your account details to continue.'
            : "Select how you'll use Tiwlo and enter your verified profile details."
        };
      case 3:
        return {
          title: 'Billing address',
          subtitle: 'Select or add your billing address for platform invoicing and tax receipts.'
        };
      case 4:
        return {
          title: 'Verify your email address',
          subtitle: `A 6-digit confirmation code was sent to ${verifyEmailData.emailMasked || verifyEmailData.email || formData.email}.`
        };
      case 5:
        return {
          title: 'Set up 2-Step Verification',
          subtitle: 'Protect your account and financial settlements with mandatory two-step security.'
        };
      case 'success':
        return {
          title: 'Welcome to Tiwlo!',
          subtitle: 'Your account and business partition are active and ready to use.'
        };
      default:
        return {
          title: 'Create your Tiwlo ID',
          subtitle: 'One account for your Tiwlo services.'
        };
    }
  };

  const headerInfo = getStepHeader();

  return (
    <div className="min-h-screen bg-[#ffffff] sm:bg-[#f8f9fa] flex flex-col justify-between py-6 sm:py-12 px-4 sm:px-6 font-sans antialiased text-[#1f1f1f] select-none">
      {/* Liquid Page Loader */}
      {loading && <TiwloPageLoader />}

      {/* ============================================================== */}
      {/* MAIN CARD CONTAINER (GOOGLE ACCOUNT 2-COLUMN CLONE)             */}
      {/* ============================================================== */}
      <div className="w-full max-w-[1040px] mx-auto my-auto bg-white sm:border sm:border-[#dadce0] sm:rounded-[28px] p-6 sm:p-10 lg:p-12 sm:shadow-[0_1px_3px_0_rgba(60,64,67,0.15)] transition-all">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-start">
          
          {/* ============================================================ */}
          {/* LEFT COLUMN: BRAND LOGO, GOOGLE HEADLINE & STEP TRACKER      */}
          {/* ============================================================ */}
          <div className="flex flex-col justify-between lg:min-h-[420px]">
            <div>
              {/* Tiwlo Logo */}
              <div className="mb-5 sm:mb-6">
                <a href={getPlatformUrl()} className="inline-block transition-opacity hover:opacity-90">
                  <img
                    src="/tiwlologo.png"
                    alt="Tiwlo"
                    className="h-7 sm:h-8 w-auto object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="hidden items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#0b57d0] text-white font-bold flex items-center justify-center text-sm">
                      T
                    </div>
                    <span className="font-semibold text-lg text-[#1f1f1f] tracking-tight">Tiwlo</span>
                  </div>
                </a>
              </div>

              {/* Main Heading */}
              <h1 className="text-[28px] sm:text-[36px] font-normal text-[#1f1f1f] tracking-tight leading-[1.2] mb-3">
                {headerInfo.title}
              </h1>

              {/* Subheading */}
              <p className="text-[15px] sm:text-[16px] text-[#444746] leading-relaxed max-w-[420px]">
                {headerInfo.subtitle}
              </p>
            </div>

            {/* Google Minimal Step Indicator (Steps 1 to 5) */}
            {step !== 'success' && (
              <div className="mt-8 pt-6 border-t border-[#f1f3f4] hidden lg:block">
                <div className="flex items-center justify-between text-[12px] text-[#444746] mb-2 font-medium">
                  <span>
                    {step === 1 && "Step 1: Account credentials"}
                    {step === 2 && (socialProfileMode ? 'Complete your profile' : 'Step 2: Profile & account type')}
                    {step === 3 && "Step 3: Billing address"}
                    {step === 4 && "Step 4: Email confirmation"}
                    {step === 5 && "Step 5: 2-Step Verification"}
                  </span>
                  <span className="font-mono text-[#747775]">
                    {socialProfileMode ? 'Profile details' : `Step ${step} of 5`}
                  </span>
                </div>
                <div className="w-full bg-[#e0e2ec] h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0b57d0] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(step / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* RIGHT COLUMN: INTERACTIVE FORM & GOOGLE CONTROLS            */}
          {/* ============================================================ */}
          <div className="flex flex-col justify-between lg:min-h-[420px]">
            
            <div className="space-y-4">
              {/* Error Message Alert (Google Minimal Style - No Background) */}
              {errorMsg && (
                <div className="flex items-center gap-2 text-[13px] text-[#d93025] font-medium py-1">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#d93025]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ======================================================== */}
              {/* STEP 1: EMAIL & PASSWORD CREDENTIALS                     */}
              {/* ======================================================== */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Google & GitHub SSO Buttons */}
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={!socialProviders.loaded || !socialProviders.google}
                        onClick={() => startSocialLogin('google')}
                        className="flex items-center justify-center gap-2.5 h-10 px-4 rounded-full border border-[#747775] text-[#1f1f1f] text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        title={!socialProviders.loaded ? 'Checking sign-in availability...' : (socialProviders.google ? 'Continue with Google' : 'Google sign-in is not configured.')}
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
                        className="flex items-center justify-center gap-2.5 h-10 px-4 rounded-full border border-[#747775] text-[#1f1f1f] text-[13px] font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        title={!socialProviders.loaded ? 'Checking sign-in availability...' : (socialProviders.github ? 'Continue with GitHub' : 'GitHub sign-in is not configured.')}
                      >
                        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.54v-2.1c-3.1.67-3.76-1.32-3.76-1.32-.51-1.29-1.24-1.63-1.24-1.63-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.76 2.01 3.44 1.54.1-.73.4-1.22.69-1.5-2.48-.28-5.09-1.24-5.09-5.53 0-1.22.44-2.22 1.16-3-.12-.28-.5-1.42.11-2.96 0 0 .95-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.1-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.16 1.78 1.16 3 0 4.3-2.62 5.25-5.12 5.52.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/>
                        </svg>
                        <span>GitHub</span>
                      </button>
                    </div>
                    <p className="mt-2 text-center text-xs text-[#747775]" role="status">
                      {!socialProviders.loaded
                        ? 'Checking social sign-in options...'
                        : (socialProviders.google || socialProviders.github
                          ? 'Create your account with Google or GitHub. Existing accounts will be signed in.'
                          : 'Google and GitHub sign-up are temporarily unavailable.')}
                    </p>

                    {/* Google Minimal Divider */}
                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#dadce0]" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-3 bg-white text-[#747775] text-[12px] font-normal">
                          or continue with email
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Step 1 Form */}
                  <form onSubmit={handleStep1Submit} className="space-y-4">
                    {/* Email Input with Live Sync Check */}
                    <div>
                      <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                        Email address
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => {
                            updateField('email', e.target.value);
                            if (emailError) setEmailError('');
                          }}
                          placeholder="you@example.com"
                          required
                          className={`w-full px-3.5 py-3 rounded-[4px] border text-[14px] text-[#1f1f1f] outline-none transition-colors placeholder:text-[#747775] ${
                            emailError
                              ? 'border-[#d93025] focus:border-[#d93025] focus:ring-1 focus:ring-[#d93025]'
                              : 'border-[#747775] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]'
                          }`}
                        />
                        {isCheckingEmail && (
                          <div className="absolute right-3.5 top-3.5">
                            <RotateCw className="w-4 h-4 text-[#747775] animate-spin" />
                          </div>
                        )}
                      </div>
                      {emailError && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[#d93025]">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {emailError}{' '}
                            <button
                              type="button"
                              onClick={onNavigateToLogin}
                              className="underline font-medium hover:text-[#b31412] cursor-pointer"
                            >
                              Sign in instead
                            </button>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Username / Handle Input with Live Availability Check */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[13px] font-medium text-[#1f1f1f]">
                          Username (@handle)
                        </label>
                        {handleAvailable && !isCheckingHandle && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-[#137333] bg-[#e6f4ea] px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Available
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#747775] text-[14px] font-medium">
                          @
                        </div>
                        <input
                          type="text"
                          value={formData.handle?.replace(/^@/, '') || ''}
                          onChange={(e) => {
                            let val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            updateField('handle', val);
                            if (handleError) setHandleError('');
                          }}
                          placeholder="username"
                          maxLength={30}
                          required
                          className={`w-full pl-8 pr-10 py-3 rounded-[4px] border text-[14px] text-[#1f1f1f] outline-none transition-colors placeholder:text-[#747775] ${
                            handleError
                              ? 'border-[#d93025] focus:border-[#d93025] focus:ring-1 focus:ring-[#d93025]'
                              : handleAvailable
                              ? 'border-[#137333] focus:border-[#137333] focus:ring-1 focus:ring-[#137333]'
                              : 'border-[#747775] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]'
                          }`}
                        />
                        {isCheckingHandle && (
                          <div className="absolute right-3.5 top-3.5">
                            <RotateCw className="w-4 h-4 text-[#747775] animate-spin" />
                          </div>
                        )}
                      </div>
                      {handleError && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[#d93025]">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{handleError}</span>
                        </div>
                      )}
                    </div>

                    {/* Password Input */}
                    <div>
                      <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => updateField('password', e.target.value)}
                          placeholder="Password"
                          required
                          className="w-full pl-3.5 pr-10 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#747775] hover:text-[#1f1f1f] cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password Input */}
                    <div>
                      <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                        Confirm password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => updateField('confirmPassword', e.target.value)}
                          placeholder="Confirm"
                          required
                          className="w-full pl-3.5 pr-10 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#747775] hover:text-[#1f1f1f] cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <p className="text-[12px] text-[#747775] leading-normal">
                      Use 6 or more characters with a mix of letters, numbers & symbols.
                    </p>

                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#747775]">Strength:</span>
                          <span className={`font-medium ${pwdStrength.text}`}>{pwdStrength.label}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <div className={`h-1 rounded-full ${pwdStrength.score >= 1 ? pwdStrength.color : 'bg-[#dadce0]'}`} />
                          <div className={`h-1 rounded-full ${pwdStrength.score >= 2 ? pwdStrength.color : 'bg-[#dadce0]'}`} />
                          <div className={`h-1 rounded-full ${pwdStrength.score >= 3 ? pwdStrength.color : 'bg-[#dadce0]'}`} />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="pt-6 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={onNavigateToLogin}
                        className="text-[#0b57d0] hover:bg-[#0b57d0]/10 rounded-full px-4 py-2 font-medium text-[14px] cursor-pointer transition-colors"
                      >
                        Sign in instead
                      </button>

                      <button
                        type="submit"
                        className="bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white rounded-full px-7 h-10 font-medium text-[14px] shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all"
                      >
                        <span>Next</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ======================================================== */}
              {/* STEP 2: PROFILE & ACCOUNT TYPE (Personal vs Business)    */}
              {/* ======================================================== */}
              {step === 2 && (
                <form onSubmit={handleStep2Submit} className="space-y-4">
                  {socialProfileMode && socialProfileLoading && (
                    <p className="text-sm text-[#5f6368]" role="status">Loading your verified profile…</p>
                  )}
                  {socialProfileMode && !socialProfileLoading && formData.email && (
                    <div className="rounded-[8px] border border-[#d2e3fc] bg-[#e8f0fe] p-3 text-[13px] text-[#174ea6]">
                      Verified email: <span className="font-medium">{formData.email}</span>
                    </div>
                  )}

                  {/* SSO Verified Chip */}
                  {formData.isSso && (
                    <div className="p-3 rounded-[8px] bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-[#1a73e8]" />
                        <span className="font-medium text-[#1a73e8]">
                          Connected via {formData.ssoProvider} ({formData.email})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectSso}
                        className="text-[#0b57d0] hover:underline font-medium cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {socialProfileMode && (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="block text-[13px] font-medium text-[#1f1f1f]">
                          Username (@handle) <span className="text-[#d93025]">*</span>
                        </label>
                        {isCheckingHandle && <RotateCw className="h-4 w-4 animate-spin text-[#747775]" />}
                        {handleAvailable && !isCheckingHandle && (
                          <span className="flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-medium text-[#137333]">
                            <Check className="h-3 w-3" /> Available
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[14px] font-medium text-[#747775]">@</span>
                        <input
                          type="text"
                          value={formData.handle?.replace(/^@/, '') || ''}
                          onChange={event => {
                            updateField('handle', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30));
                            setHandleAvailable(false);
                            setHandleError('');
                          }}
                          placeholder="username"
                          minLength={3}
                          maxLength={30}
                          required
                          aria-describedby={handleError ? 'social-handle-error' : undefined}
                          className={`w-full rounded-[4px] border py-3 pl-8 pr-10 text-[14px] text-[#1f1f1f] outline-none transition-colors placeholder:text-[#747775] ${
                            handleError
                              ? 'border-[#d93025] focus:border-[#d93025] focus:ring-1 focus:ring-[#d93025]'
                              : handleAvailable
                                ? 'border-[#137333] focus:border-[#137333] focus:ring-1 focus:ring-[#137333]'
                                : 'border-[#747775] focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0]'
                          }`}
                        />
                      </div>
                      {handleError && (
                        <div id="social-handle-error" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#d93025]" role="alert">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{handleError}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Account Type Selection Tiles (Google Style) */}
                  {!socialProfileMode && <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-2">
                      Account Type <span className="text-[#d93025]">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Personal */}
                      <button
                        type="button"
                        onClick={() => updateField('accountType', 'personal')}
                        className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${
                          formData.accountType === 'personal'
                            ? 'border-[#0b57d0] bg-[#f0f4f9] text-[#1f1f1f] ring-1 ring-[#0b57d0]'
                            : 'border-[#747775] hover:border-[#1f1f1f] bg-transparent text-[#444746]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <User className={`w-4 h-4 ${formData.accountType === 'personal' ? 'text-[#0b57d0]' : 'text-[#747775]'}`} />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.accountType === 'personal' ? 'border-[#0b57d0] bg-[#0b57d0] text-white' : 'border-[#747775]'}`}>
                            {formData.accountType === 'personal' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div className="font-medium text-[14px] text-[#1f1f1f]">Personal</div>
                        <div className="text-[12px] text-[#747775]">For individual or creator</div>
                      </button>

                      {/* Business */}
                      <button
                        type="button"
                        onClick={() => updateField('accountType', 'business')}
                        className={`p-3.5 rounded-[8px] border text-left transition-all cursor-pointer ${
                          formData.accountType === 'business'
                            ? 'border-[#0b57d0] bg-[#f0f4f9] text-[#1f1f1f] ring-1 ring-[#0b57d0]'
                            : 'border-[#747775] hover:border-[#1f1f1f] bg-transparent text-[#444746]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Building2 className={`w-4 h-4 ${formData.accountType === 'business' ? 'text-[#0b57d0]' : 'text-[#747775]'}`} />
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.accountType === 'business' ? 'border-[#0b57d0] bg-[#0b57d0] text-white' : 'border-[#747775]'}`}>
                            {formData.accountType === 'business' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                        <div className="font-medium text-[14px] text-[#1f1f1f]">Business</div>
                        <div className="text-[12px] text-[#747775]">For merchant or retailer</div>
                      </button>
                    </div>
                  </div>}

                  {/* Personal vs Business Fields */}
                  {formData.accountType === 'personal' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                          Full Name <span className="text-[#d93025]">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => updateField('fullName', e.target.value)}
                          placeholder="First and last name"
                          required
                          className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                        />
                      </div>

                      {/* Date of Birth */}
                      <div className="pt-1">
                        <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1">
                          Date of birth <span className="text-[#d93025]">*</span>
                        </label>
                        <p className="text-[12px] text-[#747775] mb-2">
                          Used to keep your account details accurate.
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <select
                              value={formData.birthMonth}
                              onChange={(e) => updateField('birthMonth', e.target.value)}
                              className="w-full px-3 py-2.5 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white cursor-pointer"
                              required
                            >
                              <option value="">Month</option>
                              {MONTH_OPTIONS.map(m => (
                                <option key={m.value} value={m.value}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={2}
                              value={formData.birthDay}
                              onChange={(e) => updateField('birthDay', e.target.value.replace(/\D/g, '').slice(0, 2))}
                              placeholder="Day"
                              required
                              aria-label="Birth day"
                              className="w-full px-3 py-2.5 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={formData.birthYear}
                              onChange={(e) => updateField('birthYear', e.target.value.replace(/\D/g, '').slice(0, 4))}
                              placeholder="Year"
                              required
                              aria-label="Birth year"
                              className="w-full px-3 py-2.5 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] placeholder:text-[#747775]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Gender Selector */}
                      <div>
                        <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                          Gender
                        </label>
                        <select
                          value={formData.gender}
                          onChange={(e) => updateField('gender', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white cursor-pointer"
                        >
                          <option value="">Select gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Rather not say">Rather not say</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                          Organization / Business Name <span className="text-[#d93025]">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="e.g. Apex Technologies Ltd"
                          required
                          className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                          Representative / Owner Name <span className="text-[#d93025]">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.ownerName}
                          onChange={(e) => updateField('ownerName', e.target.value)}
                          placeholder="Authorized representative name"
                          required
                          className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Country / Region Selector */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                      Country/Region <span className="text-[#d93025]">*</span>
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => {
                        const cName = e.target.value;
                        updateField('country', cName);
                        updateField('billingCountry', cName);
                        const match = COUNTRY_OPTIONS.find(c => c.name === cName);
                        if (match) {
                          setSelectedCountry(match);
                          updateField('phoneCountryCode', match.dial);
                          if (formData.phoneNational) {
                            updateField('phone', `${match.dial} ${formData.phoneNational}`);
                          }
                        }
                      }}
                      className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors cursor-pointer"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Street Address */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                      Street address <span className="text-[#d93025]">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Street address, P.O. box, company name, c/o"
                      required
                      className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                    />
                  </div>

                  {/* Apartment, Suite, Unit (Optional) */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                      Apartment, suite, unit (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.addressLine2}
                      onChange={(e) => updateField('addressLine2', e.target.value)}
                      placeholder="Apt, Suite, Unit, Building, Floor, etc."
                      className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                    />
                  </div>

                  {/* City & Postal Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                        City / Region <span className="text-[#d93025]">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        placeholder="Dhaka"
                        required
                        className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                        Postal Code
                      </label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => updateField('postalCode', e.target.value)}
                        placeholder="1212"
                        className="w-full px-3.5 py-3 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors placeholder:text-[#747775]"
                      />
                    </div>
                  </div>

                  {/* Phone with Country Code Selector (Google Style) */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                      Phone Number {socialProfileMode && <span className="text-[#d93025]">*</span>}
                    </label>
                    <div className="relative flex rounded-[4px] border border-[#747775] focus-within:border-[#0b57d0] focus-within:ring-1 focus-within:ring-[#0b57d0] transition-colors bg-white">
                      {/* Country Code Trigger */}
                      <button
                        type="button"
                        onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2.5 border-r border-[#dadce0] bg-[#f8f9fa] hover:bg-[#f1f3f4] text-[13px] text-[#1f1f1f] rounded-l-[3px] cursor-pointer transition-colors shrink-0"
                      >
                        <span className="text-[17px] leading-none">{selectedCountry.flag}</span>
                        <span className="font-medium text-[13px]">{selectedCountry.dial}</span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#5f6368]" />
                      </button>

                      {/* Phone National Input */}
                      <input
                        type="tel"
                        value={formData.phoneNational}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^\d\s\-()]/g, '');
                          updateField('phoneNational', val);
                          updateField('phone', val ? `${selectedCountry.dial} ${val}` : '');
                        }}
                        placeholder={selectedCountry.placeholder}
                        required={socialProfileMode}
                        autoComplete="tel-national"
                        className="w-full px-3.5 py-2.5 text-[14px] text-[#1f1f1f] outline-none bg-transparent placeholder:text-[#747775]"
                      />

                      {/* Dropdown Menu */}
                      {countryDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => {
                              setCountryDropdownOpen(false);
                              setCountrySearch('');
                            }}
                          />
                          <div className="absolute top-full left-0 mt-1 w-72 max-h-64 bg-white border border-[#dadce0] rounded-[8px] shadow-lg z-50 overflow-hidden flex flex-col">
                            <div className="p-2 border-b border-[#f1f3f4] bg-white">
                              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#f8f9fa] rounded-[6px] border border-[#dadce0]">
                                <Search className="w-3.5 h-3.5 text-[#747775]" />
                                <input
                                  type="text"
                                  value={countrySearch}
                                  onChange={(e) => setCountrySearch(e.target.value)}
                                  placeholder="Search country..."
                                  className="w-full text-xs outline-none bg-transparent text-[#1f1f1f]"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="overflow-y-auto max-h-52 divide-y divide-[#f8f9fa]">
                              {COUNTRY_OPTIONS
                                .filter(c =>
                                  c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                  c.dial.includes(countrySearch) ||
                                  c.code.toLowerCase().includes(countrySearch.toLowerCase())
                                )
                                .map((c) => (
                                  <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      updateField('phoneCountryCode', c.dial);
                                      updateField('country', c.name);
                                      if (formData.phoneNational) {
                                        updateField('phone', `${c.dial} ${formData.phoneNational}`);
                                      }
                                      setCountryDropdownOpen(false);
                                      setCountrySearch('');
                                    }}
                                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#f0f4f9] transition-colors cursor-pointer ${
                                      selectedCountry.code === c.code ? 'bg-[#e8f0fe] font-medium text-[#0b57d0]' : 'text-[#1f1f1f]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 truncate">
                                      <span className="text-[16px] leading-none shrink-0">{c.flag}</span>
                                      <span className="truncate">{c.name}</span>
                                    </div>
                                    <span className="text-[#5f6368] font-mono text-[11px] ml-2 shrink-0">{c.dial}</span>
                                  </button>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-[#747775] mt-1.5">
                      We will use this phone number for account security alerts and verification.
                    </p>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        if (formData.isSso) handleDisconnectSso();
                        else setStep(1);
                      }}
                      className="text-[#0b57d0] hover:bg-[#0b57d0]/10 rounded-full px-4 py-2 font-medium text-[14px] cursor-pointer transition-colors"
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading || socialProfileLoading || (socialProfileMode && (!handleAvailable || isCheckingHandle))}
                      className="bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] disabled:bg-slate-300 text-white rounded-full px-7 h-10 font-medium text-[14px] shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all"
                    >
                      <span>{loading ? 'Saving…' : socialProfileMode ? 'Continue' : 'Next'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* STEP 3: BILLING ADDRESS (GOOGLE CLOUD BILLING STYLE)     */}
              {/* ======================================================== */}
              {step === 3 && (
                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  {/* Google Cloud Payments Profile Header */}
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-[16px] font-medium text-[#1f1f1f]">Payments profile</h2>
                      <p className="text-[12px] text-[#5f6368] mt-0.5 leading-relaxed">
                        This profile is associated with your billing account. It's used for invoicing, statements, and tax compliance.
                      </p>
                    </div>

                    {/* Country/Region in Payments Profile */}
                    <div>
                      <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                        Country/Region <span className="text-[#d93025]">*</span>
                      </label>
                      <select
                        value={formData.billingCountry || formData.country}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateField('billingCountry', val);
                          updateField('country', val);
                          setBillingAddresses(prev => prev.map(a => a.isPrimary ? { ...a, country: val } : a));
                          setBillingFormData(prev => ({ ...prev, country: val }));
                        }}
                        className="w-full px-3.5 py-2.5 rounded-[4px] border border-[#747775] text-[14px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors cursor-pointer"
                      >
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.flag} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Account Type Row (Google Cloud Style with Change button) */}
                    <div className="flex items-center justify-between py-2 border-b border-[#dadce0]">
                      <div>
                        <span className="block text-[11px] text-[#5f6368] font-medium uppercase tracking-wider">Account type</span>
                        <span className="text-[14px] font-medium text-[#1f1f1f] capitalize">
                          {formData.accountType === 'business' ? 'Business' : 'Individual'}
                        </span>
                        <span className="text-[12px] text-[#5f6368] block">
                          {formData.accountType === 'business' ? (formData.businessName || 'Business organization') : (formData.fullName || 'Individual / personal')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-[13px] font-medium text-[#0b57d0] hover:text-[#0842a0] hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {/* Billing Address Selection & Management */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="block text-[13px] font-medium text-[#1f1f1f]">
                          Billing address <span className="text-[#d93025]">*</span>
                        </label>
                        <p className="text-[11px] text-[#5f6368]">
                          Select or add the address for official invoices, statements, and tax receipts.
                        </p>
                      </div>
                    </div>

                    {/* Address Cards List */}
                    <div className="space-y-2.5">
                      {billingAddresses.map((addr) => {
                        const isSelected = selectedBillingId === addr.id;
                        return (
                          <div
                            key={addr.id}
                            onClick={() => setSelectedBillingId(addr.id)}
                            className={`p-3.5 rounded-[10px] border transition-all cursor-pointer relative ${
                              isSelected
                                ? 'border-[#0b57d0] bg-[#f0f4f9] shadow-xs ring-1 ring-[#0b57d0]'
                                : 'border-[#dadce0] hover:border-[#747775] bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected
                                      ? 'border-[#0b57d0] bg-[#0b57d0]'
                                      : 'border-[#747775] bg-white'
                                  }`}
                                >
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[13px] font-semibold text-[#1f1f1f]">
                                      {addr.name}
                                    </span>
                                    {addr.isPrimary && (
                                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#e8f0fe] text-[#0b57d0]">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[12px] text-[#444746] leading-relaxed">
                                    {addr.street}
                                    {addr.street2 ? `, ${addr.street2}` : ''}
                                  </p>
                                  <p className="text-[12px] text-[#5f6368]">
                                    {addr.city}{addr.postalCode ? ` - ${addr.postalCode}` : ''}, {addr.country}
                                  </p>
                                  {addr.taxId && (
                                    <p className="text-[11px] text-[#747775] font-mono pt-0.5">
                                      Tax ID / BIN: {addr.taxId}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Edit / Remove actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditBillingAddress(addr);
                                  }}
                                  className="p-1.5 rounded-full hover:bg-black/5 text-[#5f6368] hover:text-[#1f1f1f] transition-colors cursor-pointer"
                                  title="Edit address"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                {!addr.isPrimary && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBillingAddress(addr.id);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-[#fce8e6] text-[#5f6368] hover:text-[#c5221f] transition-colors cursor-pointer"
                                    title="Delete address"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Google Cloud "+ Add billing address" Button */}
                    {!showAddBillingForm && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleOpenAddBillingForm}
                          className="w-full py-2.5 px-4 rounded-[8px] border border-dashed border-[#747775] hover:border-[#0b57d0] hover:bg-[#f0f4f9] text-[#0b57d0] text-[13px] font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add billing address</span>
                        </button>
                      </div>
                    )}

                    {/* Inline Add / Edit Billing Address Card */}
                    {showAddBillingForm && (
                      <div className="mt-3 p-4 rounded-[10px] bg-[#f8f9fa] border border-[#dadce0] space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-[#dadce0]">
                          <span className="text-[13px] font-semibold text-[#1f1f1f]">
                            {editingBillingId ? 'Edit billing address' : 'Add new billing address'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddBillingForm(false);
                              setEditingBillingId(null);
                            }}
                            className="text-[12px] text-[#5f6368] hover:text-[#1f1f1f] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>

                        <div>
                          <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                            Invoicing / Business name <span className="text-[#d93025]">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingFormData.name}
                            onChange={(e) => setBillingFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Invoicing entity or company name"
                            required
                            className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors placeholder:text-[#747775]"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                            Street address <span className="text-[#d93025]">*</span>
                          </label>
                          <input
                            type="text"
                            value={billingFormData.street}
                            onChange={(e) => setBillingFormData(prev => ({ ...prev, street: e.target.value }))}
                            placeholder="Street address, building, P.O. box"
                            required
                            className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors placeholder:text-[#747775]"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                            Apartment, suite, unit (optional)
                          </label>
                          <input
                            type="text"
                            value={billingFormData.street2}
                            onChange={(e) => setBillingFormData(prev => ({ ...prev, street2: e.target.value }))}
                            placeholder="Suite, unit, floor, etc."
                            className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors placeholder:text-[#747775]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                              City <span className="text-[#d93025]">*</span>
                            </label>
                            <input
                              type="text"
                              value={billingFormData.city}
                              onChange={(e) => setBillingFormData(prev => ({ ...prev, city: e.target.value }))}
                              placeholder="City"
                              required
                              className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors placeholder:text-[#747775]"
                            />
                          </div>
                          <div>
                            <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                              Postal code
                            </label>
                            <input
                              type="text"
                              value={billingFormData.postalCode}
                              onChange={(e) => setBillingFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                              placeholder="1212"
                              className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] bg-white transition-colors placeholder:text-[#747775]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                              Country
                            </label>
                            <select
                              value={billingFormData.country}
                              onChange={(e) => setBillingFormData(prev => ({ ...prev, country: e.target.value }))}
                              className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] bg-white transition-colors"
                            >
                              {COUNTRY_OPTIONS.map((c) => (
                                <option key={c.code} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[12px] font-medium text-[#1f1f1f] mb-1">
                              Tax ID / BIN (optional)
                            </label>
                            <input
                              type="text"
                              value={billingFormData.taxId}
                              onChange={(e) => setBillingFormData(prev => ({ ...prev, taxId: e.target.value }))}
                              placeholder="e.g. BIN-001928"
                              className="w-full px-3 py-2 rounded-[4px] border border-[#747775] text-[13px] text-[#1f1f1f] outline-none focus:border-[#0b57d0] bg-white transition-colors placeholder:text-[#747775]"
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddBillingForm(false);
                              setEditingBillingId(null);
                            }}
                            className="px-3 py-1.5 rounded-full text-[12px] text-[#444746] hover:bg-[#dadce0]/40 font-medium transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveBillingAddress}
                            className="px-4 py-1.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-[12px] font-medium shadow-xs transition-colors cursor-pointer"
                          >
                            Save billing address
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[12px] text-[#5f6368] leading-relaxed pt-2">
                    By submitting, you agree to the Tiwlo Payments Terms of Service. The Tiwlo Privacy Notice describes how payments data is handled.
                  </p>

                  {/* Action Buttons Row */}
                  <div className="pt-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[#0b57d0] hover:bg-[#0b57d0]/10 rounded-full px-4 py-2 font-medium text-[14px] cursor-pointer transition-colors"
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] disabled:bg-slate-300 text-white rounded-full px-7 h-10 font-medium text-[14px] shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all"
                    >
                      <span>{loading ? 'Creating account...' : 'Create account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* STEP 4: VERIFY EMAIL ADDRESS (OTP)                       */}
              {/* ======================================================== */}
              {step === 4 && (
                <form onSubmit={handleVerifyEmailSubmit} className="space-y-4">
                  <div className="p-3.5 rounded-[8px] bg-[#f8f9fa] border border-[#dadce0]">
                    <span className="text-[12px] text-[#5f6368] block mb-1">Confirmation sent to:</span>
                    <span className="text-[14px] font-medium text-[#1f1f1f] block font-mono">
                      {verifyEmailData.emailMasked || verifyEmailData.email || formData.email}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                      6-Digit Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={verifyEmailData.code}
                      onChange={(e) => setVerifyEmailData(prev => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))}
                      placeholder="&bull; &bull; &bull; &bull; &bull; &bull;"
                      required
                      className="w-full text-center font-mono text-[22px] tracking-[0.4em] px-4 py-3 rounded-[4px] border border-[#747775] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors"
                    />
                  </div>

                  <div className="text-left">
                    <button
                      type="button"
                      disabled={resendCountdown > 0 || loading}
                      onClick={handleResendEmailOtp}
                      className="text-[13px] text-[#0b57d0] hover:underline disabled:text-[#747775] font-medium cursor-pointer"
                    >
                      {resendCountdown > 0
                        ? `Resend code in ${resendCountdown}s`
                        : "Didn't get a code? Resend code"}
                    </button>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-[#0b57d0] hover:bg-[#0b57d0]/10 rounded-full px-4 py-2 font-medium text-[14px] cursor-pointer transition-colors"
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading || verifyEmailData.code.length !== 6}
                      className="bg-[#0b57d0] hover:bg-[#0842a0] disabled:bg-slate-300 text-white rounded-full px-7 h-10 font-medium text-[14px] shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all"
                    >
                      <span>{loading ? 'Verifying...' : 'Next'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* STEP 5: SETUP 2-STEP VERIFICATION                        */}
              {/* ======================================================== */}
              {step === 5 && (
                <form onSubmit={handleVerifySetup2FASubmit} className="space-y-4">
                  <div className="flex items-center gap-3 p-3.5 rounded-[8px] bg-[#e6f4ea] border border-[#ceead6]">
                    <div className="w-8 h-8 rounded-full bg-[#137333] text-white flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-xs text-[#0d652d]">
                      <span className="font-semibold block text-[13px]">Mandatory Account Protection</span>
                      <span>Enter the security code dispatched to your registered email to activate 2FA.</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-[#1f1f1f] mb-1.5">
                      6-Digit Security Passcode
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={setup2FAData.code}
                      onChange={(e) => setSetup2FAData(prev => ({ ...prev, code: e.target.value.replace(/\D/g, '') }))}
                      placeholder="&bull; &bull; &bull; &bull; &bull; &bull;"
                      required
                      className="w-full text-center font-mono text-[22px] tracking-[0.4em] px-4 py-3 rounded-[4px] border border-[#747775] text-[#1f1f1f] outline-none focus:border-[#0b57d0] focus:ring-1 focus:ring-[#0b57d0] transition-colors"
                    />
                  </div>

                  <div className="text-left">
                    <button
                      type="button"
                      disabled={resendCountdown > 0 || loading}
                      onClick={handleResendSetup2FAOtp}
                      className="text-[13px] text-[#0b57d0] hover:underline disabled:text-[#747775] font-medium cursor-pointer"
                    >
                      {resendCountdown > 0
                        ? `Resend passcode in ${resendCountdown}s`
                        : "Didn't receive passcode? Resend"}
                    </button>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-6 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="text-[#0b57d0] hover:bg-[#0b57d0]/10 rounded-full px-4 py-2 font-medium text-[14px] cursor-pointer transition-colors"
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading || setup2FAData.code.length !== 6}
                      className="bg-[#0b57d0] hover:bg-[#0842a0] disabled:bg-slate-300 text-white rounded-full px-7 h-10 font-medium text-[14px] shadow-xs cursor-pointer inline-flex items-center gap-2 transition-all"
                    >
                      <span>{loading ? 'Activating...' : 'Confirm & Activate'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ======================================================== */}
              {/* SUCCESS VIEW: ACCOUNT CREATED (GOOGLE WELCOME CARD)      */}
              {/* ======================================================== */}
              {step === 'success' && createdResult && (
                <div className="text-center py-4 space-y-5">
                  <div className="w-16 h-16 rounded-full bg-[#e6f4ea] text-[#137333] flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-[22px] font-normal text-[#1f1f1f]">
                      Registration Complete
                    </h3>
                    <p className="text-[14px] text-[#5f6368]">
                      Your account credentials and merchant workspace have been provisioned.
                    </p>
                  </div>

                  {/* Tiwi ID Display Card */}
                  <div className="p-4 rounded-[8px] bg-[#f8f9fa] border border-[#dadce0] space-y-2 max-w-sm mx-auto">
                    <span className="text-[12px] font-medium text-[#5f6368] block">
                      Your Official Tiwi ID:
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[18px] font-mono font-semibold text-[#0b57d0]">
                        {createdResult.tiwiId || createdResult.user?.tiwiId || createdResult.user?.storeId || 'TIW-READY'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyTiwiId}
                        className="p-1.5 rounded-full hover:bg-[#e8eaed] text-[#5f6368] transition-colors cursor-pointer"
                        title="Copy Tiwi ID"
                      >
                        {copiedId ? <Check className="w-4 h-4 text-[#137333]" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#747775]">
                      Use your email or this unique Tiwi ID for sign-in.
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        const u = createdResult.user || { tiwiId: createdResult.tiwiId };
                        const tok = createdResult.sessionToken || localStorage.getItem('stockpro_session');
                        onRegisterSuccess?.(u, tok);
                      }}
                      className="w-full sm:w-auto min-w-[220px] h-10 px-8 bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full text-[14px] font-medium shadow-xs cursor-pointer inline-flex items-center justify-center gap-2 transition-all"
                    >
                      <span>Continue to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* ============================================================== */}
      {/* STANDARD GOOGLE ACCOUNT FOOTER                                 */}
      {/* ============================================================== */}
      <footer className="w-full max-w-[1040px] mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#5f6368] gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#5f6368]" />
          <span className="hover:text-[#1f1f1f] cursor-pointer">English (United States)</span>
        </div>

        <div className="flex items-center gap-6">
          <a href={getPlatformUrl()} className="hover:text-[#1f1f1f] transition-colors">Help</a>
          <a href={getPlatformUrl()} className="hover:text-[#1f1f1f] transition-colors">Privacy</a>
          <a href={getPlatformUrl()} className="hover:text-[#1f1f1f] transition-colors">Terms</a>
          <span>&copy; 2026 Tiwlo, Inc.</span>
        </div>
      </footer>

    </div>
  );
}
