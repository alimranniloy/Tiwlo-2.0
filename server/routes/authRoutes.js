import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import { hasUnverifiedSsoIdentity } from '../security/authGuards.js';
import {
  PasswordSecurity,
  SessionSecurity,
  BruteForceShield,
  SsoSecurity
} from '../security/cryptoSecurity.js';
import {
  consumeSecureGrant,
  createSecureGrant,
  generateSecureOtp,
  verifySecureOtp,
  getOtpSession,
  deleteOtpSession,
  sendTwoFactorOtpEmail,
  sendSignupVerificationOtpEmail,
  sendPasswordResetOtpEmail,
  sendLoginActivityAlertEmail,
  getEmailConfig,
  verifySmtpConnection,
  sendTiwloEmail
} from '../db/emailService.js';
import { listEmailDeliveries } from '../db/securityPersistence.js';
import { renderBaseEmail } from '../email/index.js';
import { logActivity } from '../db/storeDataAdapter.js';
import { requireAdmin } from '../administrator/adminRoutes.js';
import { SocialDB } from '../social/socialDb.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { securityLimiters } from '../plugins/security/index.js';

const router = express.Router();

function getRequestSessionToken(req) {
  const authHeader = req.headers.authorization;
  return req.cookies?.tiwlo_session ||
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null) ||
    req.headers?.['x-session-token'] ||
    null;
}

const PLAN_CATALOG = {
  free: { planId: 'free', planName: 'Free Starter', price: 0, productLimit: 50, warehouseLimit: 1, hasCustomDomain: false },
  growth: { planId: 'growth', planName: 'Growth Retailer', price: 19, productLimit: 500, warehouseLimit: 2, hasCustomDomain: true },
  pro: { planId: 'pro', planName: 'Pro Business', price: 49, productLimit: 5000, warehouseLimit: 5, hasCustomDomain: true },
  enterprise: { planId: 'enterprise', planName: 'Enterprise VIP', price: 129, productLimit: 999999, warehouseLimit: 99, hasCustomDomain: true }
};

function getSessionCookieOptions(req) {
  const host = (req?.headers?.host || req?.hostname || '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '');
  const isTiwloDomain = [PLATFORM_CONFIG.primaryDomain, PLATFORM_CONFIG.storeDomain].some(
    domain => hostname === domain || hostname.endsWith(`.${domain}`)
  );
  const isSecure = process.env.NODE_ENV === 'production' || req?.secure || req?.headers?.['x-forwarded-proto'] === 'https';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    ...(isTiwloDomain ? { domain: PLATFORM_CONFIG.cookieDomain } : {})
  };
}

export function setSessionCookie(res, req, sessionToken) {
  const opts = {
    ...getSessionCookieOptions(req),
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
  res.cookie('tiwlo_session', sessionToken, opts);
}

export function clearSessionCookie(res, req) {
  const isSecure = process.env.NODE_ENV === 'production' || req?.secure || req?.headers?.['x-forwarded-proto'] === 'https';
  res.clearCookie('tiwlo_session', { path: '/', domain: PLATFORM_CONFIG.cookieDomain, secure: isSecure, sameSite: 'lax' });
  res.clearCookie('tiwlo_session', { path: '/', domain: PLATFORM_CONFIG.primaryDomain, secure: isSecure, sameSite: 'lax' });
  res.clearCookie('tiwlo_session', { path: '/', secure: isSecure, sameSite: 'lax' });
  res.clearCookie('tiwlo_session');
}

function maskEmail(em) {
  if (!em || !em.includes('@')) return em || '';
  const [u, d] = em.split('@');
  if (u.length <= 2) return `${u[0]}***@${d}`;
  return `${u[0]}${'*'.repeat(Math.max(3, u.length - 2))}${u[u.length - 1]}@${d}`;
}

function formatRemainingWaitTime(seconds) {
  if (!seconds || seconds <= 0) return 'a few moments';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

// ==========================================
// 1. SOCIAL SSO CHECK
// ==========================================
router.post('/auth/social-check', async (req, res) => {
  try {
    const { email, name, provider = 'Google' } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required for social authentication' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await MasterDB.findUserByIdentifier(cleanEmail);

    if (user) {
      if (!user.emailVerified) {
        const otpResult = await generateSecureOtp(user.email, 'email_verify', 15);
        const masked = maskEmail(user.email);
        await sendSignupVerificationOtpEmail({
          to: user.email,
          name: user.name || user.storeName,
          code: otpResult.code
        }).catch(() => {});
        return res.json({
          exists: true,
          requiresEmailVerification: true,
          tempToken: otpResult.token,
          email: user.email,
          emailMasked: masked,
          message: `Please verify your email address. A 6-digit verification code was sent to ${masked}`
        });
      }

      if (!user.twoFactorEnabled) {
        const otpResult = await generateSecureOtp(user.email, 'setup_2fa', 15);
        const masked = maskEmail(user.email);
        await sendTwoFactorOtpEmail({
          to: user.email,
          name: user.name || user.storeName,
          code: otpResult.code
        }).catch(() => {});
        return res.json({
          exists: true,
          requires2FASetup: true,
          tempToken: otpResult.token,
          email: user.email,
          emailMasked: masked,
          message: `Two-Step Verification setup is required. A 6-digit code was sent to ${masked}`
        });
      }

      const otpResult = await generateSecureOtp(user.email, 'login_2fa', 10);
      const masked = maskEmail(user.email);
      await sendTwoFactorOtpEmail({
        to: user.email,
        name: user.name || user.storeName,
        code: otpResult.code
      }).catch(() => {});

      logActivity('auth', `2FA Login Challenge Initiated via ${provider}`, `Target: ${user.email} • Code dispatched to ${masked}`);

      return res.json({
        exists: true,
        requires2FA: true,
        tempToken: otpResult.token,
        email: user.email,
        emailMasked: masked,
        message: `Two-Step Verification code dispatched to ${masked}`
      });
    }

    return res.json({
      exists: false,
      profileComplete: false,
      requiresProfileSetup: true,
      email: cleanEmail,
      name: name || '',
      provider
    });
  } catch (err) {
    console.error('Social auth check error:', err);
    res.status(500).json({ error: 'Failed to verify social authentication' });
  }
});

// Check Email
router.post('/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.json({ exists: false });
    }
    const normalized = email.trim().toLowerCase();
    const existing = await MasterDB.findUserByIdentifier(normalized);
    if (existing) {
      return res.json({
        exists: true,
        message: 'That email is already in use.'
      });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error('Check email error:', err);
    return res.json({ exists: false });
  }
});

// Availability Checker (Unified Email & Username/Handle Availability)
router.all('/auth/check-availability', async (req, res) => {
  try {
    const email = req.query.email || req.body?.email || '';
    const handle = req.query.handle || req.query.username || req.body?.handle || req.body?.username || '';
    // A caller must not be able to make an existing email/handle appear free
    // by supplying somebody else's ID in the request.
    const userId = req.activeUser?.id || req.user?.id || req.session?.userId || null;
    const result = await SocialDB.checkAvailability({ email, handle, userId });
    return res.json(result);
  } catch (err) {
    console.error('Check availability error:', err);
    return res.status(500).json({ error: 'Availability check failed' });
  }
});

// Register
router.post('/auth/register', securityLimiters.registration, securityLimiters.registrationDaily, securityLimiters.registrationMonthly, async (req, res) => {
  try {
    if (hasUnverifiedSsoIdentity(req.body)) {
      return res.status(400).json({
        error: 'Social sign-up is unavailable until the identity provider can be verified securely. Register with email and password instead.'
      });
    }

    const {
      email,
      password,
      storeName,
      name,
      handle,
      username,
      businessName,
      accountType = 'personal',
      address,
      phone,
      dateOfBirth,
      birthday,
      gender,
      billingDetails,
    } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const effectiveDisplayName = (accountType === 'business' ? (businessName || storeName) : (name || storeName))?.trim();
    if (!effectiveDisplayName) {
      return res.status(400).json({
        error: accountType === 'business' ? 'Business or company name is required' : 'Full name is required'
      });
    }

    const billingAddress = billingDetails?.address?.trim() || address?.trim();
    if (!billingAddress) {
      return res.status(400).json({ error: 'Billing address is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Strict Email Uniqueness Check (Shield against duplicate accounts)
    const emailTaken = await SocialDB.isEmailTaken(normalizedEmail);
    const existing = await MasterDB.findUserByIdentifier(normalizedEmail);

    if (existing || emailTaken) {
      return res.status(409).json({ error: 'That email is already in use. Please sign in or use another email.' });
    }

    // 2. Strict Handle / Username Format & Collision Shield
    let candidateHandle = (handle || username || '').trim().toLowerCase();
    if (candidateHandle.startsWith('@')) candidateHandle = candidateHandle.substring(1);
    if (!candidateHandle) {
      candidateHandle = effectiveDisplayName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(candidateHandle)) {
      return res.status(400).json({ error: 'Username must be 3-30 characters and can only contain letters, numbers, and underscores.' });
    }

    const handleTaken = await SocialDB.isHandleTaken(candidateHandle);
    if (handleTaken) {
      return res.status(409).json({ error: 'That username is already taken. Please choose another username.' });
    }

    const users = await MasterDB.getUsers();
    let tiwiId;
    let isUnique = false;
    while (!isUnique) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      tiwiId = `TIW-${randomNum}`;
      if (!users.some(u => u.tiwiId === tiwiId || u.storeId === tiwiId)) {
        isUnique = true;
      }
    }

    const cleanSlug = candidateHandle.toLowerCase().replace(/[^a-z0-9]/g, '') || 'store';
    const subdomain = `${cleanSlug}.${PLATFORM_CONFIG.storeDomain}`;
    // Public signup must never grant a paid plan; upgrades require a verified payment flow.
    const selectedPlan = PLAN_CATALOG.free;
    const finalBillingDetails = {
      address: billingAddress,
      city: billingDetails?.city || '',
      country: billingDetails?.country || '',
      phone: billingDetails?.phone || phone || '',
      postalCode: billingDetails?.postalCode || ''
    };

    const newUser = await MasterDB.createUser({
      tiwiId,
      storeName: effectiveDisplayName,
      name: (accountType === 'business' ? (name || effectiveDisplayName) : effectiveDisplayName)?.trim(),
      businessName: businessName?.trim() || (accountType === 'business' ? effectiveDisplayName : ''),
      accountType,
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      email: normalizedEmail,
      password,
      dateOfBirth: dateOfBirth || birthday || '',
      birthday: birthday || dateOfBirth || '',
      gender: gender || '',
      billingDetails: finalBillingDetails,
      planId: selectedPlan.planId,
      planName: selectedPlan.planName,
      subdomain,
      authMethod: 'credentials',
      emailVerified: false,
      twoFactorEnabled: false
    });

    // 3. Immediately Provision Unique Profile in SocialDB to prevent any profile routing collisions
    try {
      const socialData = SocialDB.getData();
      if (!socialData.profiles) socialData.profiles = {};
      const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(newUser.name || effectiveDisplayName)}&background=0B57D0&color=fff&size=256&bold=true`;
      socialData.profiles[newUser.id] = {
        name: newUser.name || effectiveDisplayName,
        handle: `@${candidateHandle}`,
        avatar: defaultAvatar,
        coverPhoto: null,
        accountType: newUser.accountType || 'personal',
        bio: newUser.accountType === 'business' ? 'Official Business Account • Tiwlo' : 'Tiwlo Member',
        location: finalBillingDetails.city ? `${finalBillingDetails.city}, ${finalBillingDetails.country || 'Bangladesh'}` : '',
        website: '',
        isVerified: newUser.accountType === 'business',
        birthday: newUser.birthday || '',
        gender: newUser.gender || 'Rather not say',
        phone: newUser.phone || '',
        backupPhones: [],
        recoveryEmail: '',
        billingAddress: finalBillingDetails,
        workAddress: '',
        privacySettings: {
          protectPosts: false,
          photoTagging: true,
          locationSharing: false,
          discoverability: true,
        },
        advancedSettings: {
          personalizedAds: true,
          dataCollection: true,
          reduceMotion: false,
          increaseContrast: false,
          language: 'English (United States)',
          appIcon: 'Default',
        },
      };
      SocialDB.saveData(socialData);
    } catch (socErr) {
      console.warn('[Register] SocialDB profile provisioning warning:', socErr.message);
    }

    logActivity('auth', `Store "${newUser.storeName}" Created`, `Tiwi ID: ${tiwiId} • Email: ${normalizedEmail}`, tiwiId);

    const verifyOtp = await generateSecureOtp(newUser.email, 'email_verify', 15);
    const masked = maskEmail(newUser.email);
    const emailResult = await sendSignupVerificationOtpEmail({
      to: newUser.email,
      name: newUser.name || newUser.storeName,
      code: verifyOtp.code
    }).catch(e => ({ success: false, delivered: false, error: e.message }));

    return res.status(201).json({
      success: true,
      requiresEmailVerification: true,
      tempToken: verifyOtp.token,
      email: newUser.email,
      emailMasked: masked,
      tiwiId,
      storeId: tiwiId,
      subdomain: newUser.subdomain,
      user: {
        id: newUser.id,
        tiwiId,
        storeId: tiwiId,
        storeName: newUser.storeName,
        name: newUser.name,
        email: newUser.email,
        accountType: newUser.accountType,
        planId: newUser.planId,
        planName: newUser.planName,
        subdomain: newUser.subdomain
      },
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status || 'queued_in_outbox',
      message: `Store "${newUser.storeName}" created! A 6-digit verification code was sent to ${masked}. Please verify your email to activate your store.`
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create new account' });
  }
});

// Login
router.post('/auth/login', securityLimiters.login, async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter both your Email/Tiwi ID and password.' });
    }

    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const cleanId = identifier.trim().toLowerCase();

    const ipLocked = await BruteForceShield.isLocked(clientIp);
    if (ipLocked) {
      const waitTime = formatRemainingWaitTime(ipLocked.remainingSeconds);
      return res.status(429).json({
        error: `Too many unsuccessful sign-in attempts. For your security, access has been temporarily paused. Please try again in ${waitTime}.`,
        isLocked: true,
        remainingSeconds: ipLocked.remainingSeconds
      });
    }

    const acctLocked = await BruteForceShield.isLocked(cleanId);
    if (acctLocked) {
      const waitTime = formatRemainingWaitTime(acctLocked.remainingSeconds);
      return res.status(429).json({
        error: `Too many unsuccessful attempts for this account. For your security, sign-in is temporarily paused. Please try again in ${waitTime}.`,
        isLocked: true,
        remainingSeconds: acctLocked.remainingSeconds
      });
    }

    const user = await MasterDB.findUserByIdentifier(cleanId);
    const isPasswordValid = user ? PasswordSecurity.verify(password, user.password) : false;

    if (!user || !isPasswordValid) {
      await BruteForceShield.recordFailure(clientIp);
      const acctRecord = await BruteForceShield.recordFailure(cleanId);
      await recordSecurityEvent({
        eventType: 'auth.login_failed',
        severity: 'warning',
        subject: cleanId,
        ip: clientIp,
        userAgent: req.get('user-agent'),
        details: { accountExists: Boolean(user) }
      });
      logActivity('alert', `Failed Login Attempt`, `Target: ${cleanId} from IP ${clientIp}`);

      const remaining = Math.max(0, BruteForceShield.MAX_ATTEMPTS - (acctRecord?.count || 1));
      let errorMsg = 'Incorrect email, Tiwi ID, or password. Please verify and try again.';
      if (remaining === 1) {
        errorMsg = 'Incorrect password. 1 attempt remaining before temporary security pause.';
      } else if (remaining === 0) {
        errorMsg = 'Too many unsuccessful attempts. For your security, sign-in is temporarily paused for 15 minutes.';
      }

      return res.status(401).json({
        error: errorMsg,
        remainingAttempts: remaining
      });
    }

    if (user.isBanned) {
      await recordSecurityEvent({
        eventType: 'auth.disabled_account_login_blocked',
        severity: 'warning',
        userId: user.id,
        subject: cleanId,
        ip: clientIp,
        userAgent: req.get('user-agent')
      });
      logActivity('alert', `Disabled Account Sign-In Blocked`, `Target: ${cleanId} from IP ${clientIp}`);
      return res.status(403).json({
        error: 'Your Tiwlo Account has been disabled.',
        isBanned: true,
        email: user.email,
        name: user.name || user.storeName,
        avatar: user.avatar || null,
        storeName: user.storeName || user.name || 'Store',
        tiwiId: user.tiwiId || user.storeId || null,
        banReason: user.banReason || 'Your account was disabled due to a violation of platform policies.',
        bannedAt: user.bannedAt
      });
    }

    await BruteForceShield.recordSuccess(clientIp);
    await BruteForceShield.recordSuccess(cleanId);
    await recordSecurityEvent({
      eventType: 'auth.password_verified',
      userId: user.id,
      subject: cleanId,
      ip: clientIp,
      userAgent: req.get('user-agent')
    });

    if (!user.password.startsWith('scrypt$')) {
      user.password = PasswordSecurity.hash(password);
      await MasterDB.updateUser(user.id, { password: user.password });
    }

    const isSuperAdmin = user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
    if (isSuperAdmin) {
      const tiwiId = user.tiwiId || user.storeId || 'TIW-00001';
      const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);
      setSessionCookie(res, req, sessionToken);

      logActivity('auth', `Super Admin Authenticated`, `Administrator: ${user.name || 'Alimran Niloy'} (${user.email})`, tiwiId);

      return res.json({
        success: true,
        sessionToken,
        user: {
          id: user.id,
          tiwiId,
          storeId: tiwiId,
          storeName: user.storeName || 'Tiwlo Administration',
          name: user.name || 'Alimran Niloy',
          role: 'super_admin',
          avatar: user.avatar || '/tiwlo-icon.png',
          coverPhoto: user.coverPhoto || '/cloud-hero-full-bg.jpg',
          email: user.email,
          planId: user.planId || 'enterprise',
          planName: user.planName || 'Enterprise Super Admin',
          subdomain: user.subdomain || `admin.${PLATFORM_CONFIG.storeDomain}`,
          billingDetails: user.billingDetails
        },
        message: `Welcome back, Super Admin ${user.name || 'Alimran Niloy'}!`
      });
    }

    const isEmailVerified = user.emailVerified === true;
    if (!isEmailVerified) {
      const otpResult = await generateSecureOtp(user.email, 'email_verify', 15);
      const masked = maskEmail(user.email);

      const emailResult = await sendSignupVerificationOtpEmail({
        to: user.email,
        name: user.name || user.storeName,
        code: otpResult.code
      }).catch(err => ({ success: false, delivered: false, error: err.message }));

      logActivity('auth', `Email Verification Required`, `Target: ${cleanId} • Code dispatched to ${masked}`);

      return res.json({
        success: true,
        requiresEmailVerification: true,
        tempToken: otpResult.token,
        email: user.email,
        emailMasked: masked,
        delivered: emailResult?.delivered || false,
        deliveryStatus: emailResult?.status || 'queued_in_outbox',
        message: `Please verify your email address. A 6-digit code was sent to ${masked}`
      });
    }

    if (!user.twoFactorEnabled) {
      const otpResult = await generateSecureOtp(user.email, 'setup_2fa', 15);
      const masked = maskEmail(user.email);

      const emailResult = await sendTwoFactorOtpEmail({
        to: user.email,
        name: user.name || user.storeName,
        code: otpResult.code
      });

      logActivity('auth', `2FA Setup Challenge Initiated`, `Target: ${cleanId} • Status: ${emailResult?.status}`);

      return res.json({
        success: true,
        requires2FASetup: true,
        tempToken: otpResult.token,
        email: user.email,
        emailMasked: masked,
        delivered: emailResult?.delivered || false,
        deliveryStatus: emailResult?.status,
        message: `Two-Step verification setup required. A 6-digit confirmation code was sent to ${masked}`
      });
    }

    const otpResult = await generateSecureOtp(user.email, 'login_2fa', 10);
    const masked = maskEmail(user.email);

    const emailResult = await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: otpResult.code
    });

    logActivity('auth', `2FA Challenge Initiated`, `Target: ${cleanId} • Status: ${emailResult?.status}`);

    return res.json({
      success: true,
      requires2FA: true,
      tempToken: otpResult.token,
      email: user.email,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status,
      message: `Two-Step verification code sent to ${masked}`
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to process login' });
  }
});

// Verify 2FA
router.post('/auth/verify-2fa', async (req, res) => {
  try {
    const { tempToken, otpCode } = req.body;
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = await verifySecureOtp(tempToken, otpCode, 'login_2fa');
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const tiwiId = user.tiwiId || user.storeId;

    const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);
    setSessionCookie(res, req, sessionToken);

    logActivity('auth', `User completed 2FA login`, `Store: ${user.storeName} (${tiwiId})`, tiwiId);

    sendLoginActivityAlertEmail({
      to: user.email,
      name: user.name || user.storeName,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'Web Browser',
      location: 'Dhaka, Bangladesh',
      timestamp: new Date().toUTCString()
    }).catch(e => console.error('[Login Alert Email Error]', e));

    return res.json({
      success: true,
      sessionToken,
      tiwiId,
      storeId: tiwiId,
      subdomain: user.subdomain,
      user: {
        id: user.id,
        tiwiId,
        storeId: tiwiId,
        storeName: user.storeName,
        name: user.name || user.storeName,
        avatar: user.avatar || '/tiwlo-icon.png',
        coverPhoto: user.coverPhoto || '/cloud-hero-full-bg.jpg',
        email: user.email,
        role: (user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com' ? 'super_admin' : (user.role && user.role !== 'super_admin' ? user.role : 'owner')),
        planId: user.planId,
        planName: user.planName,
        subdomain: user.subdomain,
        billingDetails: user.billingDetails,
        accountType: user.accountType,
        address: user.address,
        phone: user.phone
      },
      message: `Two-Step verification successful. Welcome back, ${user.name || user.storeName}!`
    });
  } catch (err) {
    console.error('2FA verification error:', err);
    res.status(500).json({ error: 'Failed to complete two-step verification' });
  }
});

// Resend 2FA
router.post('/auth/resend-2fa', async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Temporary verification token is required.' });
    }

    const session = await getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await deleteOtpSession(tempToken);
    const newOtp = await generateSecureOtp(user.email, 'login_2fa', 10);
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    });

    logActivity('auth', '2FA Code Resent', `Target: ${user.email} • Status: ${emailResult?.status}`);

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status,
      message: `A fresh 6-digit code has been sent to ${masked}`
    });
  } catch (err) {
    console.error('Resend 2FA error:', err);
    res.status(500).json({ error: 'Failed to resend verification code' });
  }
});

// Resend 2FA Setup Code
router.post('/auth/resend-setup-2fa', async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Temporary verification token is required.' });
    }

    const session = await getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await deleteOtpSession(tempToken);
    const newOtp = await generateSecureOtp(user.email, 'setup_2fa', 15);
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    });

    logActivity('auth', '2FA Setup Code Resent', `Target: ${user.email} • Status: ${emailResult?.status}`);

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status,
      message: `A fresh 6-digit confirmation code has been sent to ${masked}`
    });
  } catch (err) {
    console.error('Resend 2FA setup error:', err);
    res.status(500).json({ error: 'Failed to resend confirmation code' });
  }
});

// Setup 2FA
router.post('/auth/setup-2fa', async (req, res) => {
  try {
    const { tempToken, otpCode } = req.body;
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = await verifySecureOtp(tempToken, otpCode, 'setup_2fa');
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    await MasterDB.updateUser(user.id, { twoFactorEnabled: true, emailVerified: true });

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const tiwiId = user.tiwiId || user.storeId;

    const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);
    setSessionCookie(res, req, sessionToken);

    logActivity('auth', `User completed 2FA setup & signed in`, `Store: ${user.storeName} (${tiwiId})`, tiwiId);

    sendLoginActivityAlertEmail({
      to: user.email,
      name: user.name || user.storeName,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'Web Browser',
      location: 'Dhaka, Bangladesh',
      timestamp: new Date().toUTCString()
    }).catch(e => console.error('[Login Alert Email Error]', e));

    return res.json({
      success: true,
      sessionToken,
      tiwiId,
      storeId: tiwiId,
      subdomain: user.subdomain,
      user: {
        id: user.id,
        tiwiId,
        storeId: tiwiId,
        storeName: user.storeName,
        name: user.name || user.storeName,
        avatar: user.avatar || '/tiwlo-icon.png',
        coverPhoto: user.coverPhoto || '/cloud-hero-full-bg.jpg',
        email: user.email,
        role: (user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com' ? 'super_admin' : (user.role && user.role !== 'super_admin' ? user.role : 'owner')),
        planId: user.planId,
        planName: user.planName,
        subdomain: user.subdomain,
        billingDetails: user.billingDetails,
        accountType: user.accountType,
        address: user.address,
        phone: user.phone
      },
      message: `2-Step Verification activated successfully! Welcome to Tiwlo, ${user.name || user.storeName}!`
    });
  } catch (err) {
    console.error('Setup 2FA error:', err);
    res.status(500).json({ error: 'Failed to complete 2-Step Verification setup' });
  }
});

// Resend Setup 2FA
router.post('/auth/resend-setup-2fa', async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Temporary verification token is required.' });
    }

    const session = await getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await deleteOtpSession(tempToken);
    const newOtp = await generateSecureOtp(user.email, 'setup_2fa', 15);
    const masked = maskEmail(user.email);

    const emailResult = await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    }).catch(e => ({ success: false, delivered: false, error: e.message }));

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status || 'queued_in_outbox',
      message: `A fresh 6-digit confirmation code has been sent to ${masked}`
    });
  } catch (err) {
    console.error('Resend setup 2FA error:', err);
    res.status(500).json({ error: 'Failed to resend confirmation code' });
  }
});

// Verify Email
router.post('/auth/verify-email', async (req, res) => {
  try {
    const { tempToken, otpCode } = req.body;
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = await verifySecureOtp(tempToken, otpCode, 'email_verify');
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    await MasterDB.updateUser(user.id, { emailVerified: true });
    logActivity('auth', 'Email Address Verified', `User: ${user.email} (${user.tiwiId})`, user.tiwiId);

    const masked = maskEmail(user.email);

    if (user.twoFactorEnabled === true) {
      const twoFaOtp = await generateSecureOtp(user.email, 'login_2fa', 10);
      const emailResult = await sendTwoFactorOtpEmail({
        to: user.email,
        name: user.name || user.storeName,
        code: twoFaOtp.code
      }).catch(err => ({ success: false, delivered: false, error: err.message }));

      return res.json({
        success: true,
        emailVerified: true,
        requires2FA: true,
        tempToken: twoFaOtp.token,
        email: user.email,
        emailMasked: masked,
        delivered: emailResult?.delivered || false,
        deliveryStatus: emailResult?.status || 'queued_in_outbox',
        message: 'Email verified successfully! Please enter your Two-Step verification code.'
      });
    } else {
      const setupOtp = await generateSecureOtp(user.email, 'setup_2fa', 15);
      const emailResult = await sendTwoFactorOtpEmail({
        to: user.email,
        name: user.name || user.storeName,
        code: setupOtp.code
      }).catch(err => ({ success: false, delivered: false, error: err.message }));

      return res.json({
        success: true,
        emailVerified: true,
        requires2FASetup: true,
        tempToken: setupOtp.token,
        email: user.email,
        emailMasked: masked,
        delivered: emailResult?.delivered || false,
        deliveryStatus: emailResult?.status || 'queued_in_outbox',
        message: 'Email verified successfully! Please enter the 6-digit confirmation code to set up 2-Step Verification.'
      });
    }
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Failed to verify email address.' });
  }
});

// Change Email
router.post('/auth/change-email', async (req, res) => {
  try {
    const { tempToken, newEmail } = req.body;
    if (!tempToken || !newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid new email address.' });
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const session = await getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const existing = await MasterDB.findUserByIdentifier(cleanNewEmail);
    if (existing && existing.email !== session.email) {
      return res.status(400).json({ error: 'This email address is already associated with another account.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    await MasterDB.updateUser(user.id, {
      email: cleanNewEmail,
      emailVerified: false
    });

    await deleteOtpSession(tempToken);
    const newOtp = await generateSecureOtp(cleanNewEmail, 'email_verify', 15);
    const [u, d] = cleanNewEmail.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendSignupVerificationOtpEmail({
      to: cleanNewEmail,
      name: user.name || user.storeName,
      code: newOtp.code
    }).catch(err => ({ success: false, delivered: false, error: err.message }));

    logActivity('auth', 'User Updated Email Address', `Old: ${session.email} • New: ${cleanNewEmail}`, user.tiwiId);

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      email: cleanNewEmail,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status || 'queued_in_outbox',
      message: `Email address changed to ${cleanNewEmail}. Verification passcode sent.`
    });
  } catch (err) {
    console.error('Change email error:', err);
    res.status(500).json({ error: 'Failed to change email address.' });
  }
});

// Resend Email Verification
router.post('/auth/resend-email-verification', async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Verification session token is required.' });
    }

    const session = await getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await deleteOtpSession(tempToken);
    const newOtp = await generateSecureOtp(user.email, 'email_verify', 15);
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendSignupVerificationOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    }).catch(err => ({ success: false, delivered: false, error: err.message }));

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      email: user.email,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status || 'queued_in_outbox',
      message: `A fresh 6-digit verification code has been dispatched to ${masked}`
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code.' });
  }
});

// Forgot Password Request
router.post('/auth/forgot-password/request', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: 'Please enter your registered Email or Tiwi ID.' });
    }

    const user = await MasterDB.findUserByIdentifier(identifier.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No registered account found with this Email or Tiwi ID. Please check the spelling.'
      });
    }

    const otp = await generateSecureOtp(user.email, 'forgot_password', 15);
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendPasswordResetOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: otp.code
    });

    logActivity('auth', 'Password Recovery Dispatched', `Target: ${user.email} • Status: ${emailResult?.status}`);

    return res.json({
      success: true,
      resetToken: otp.token,
      emailMasked: masked,
      delivered: emailResult?.delivered || false,
      deliveryStatus: emailResult?.status,
      message: `Password recovery passcode sent to ${masked}`
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password recovery request' });
  }
});

router.post('/auth/forgot-password/verify-code', async (req, res) => {
  const { resetToken, otpCode } = req.body;
  if (!resetToken || !otpCode) {
    return res.status(400).json({ error: 'Reset token and 6-digit code are required.' });
  }
  const verification = await verifySecureOtp(resetToken, otpCode, 'forgot_password');
  if (!verification.valid) {
    return res.status(400).json({ error: verification.error });
  }

  const passwordResetToken = await createSecureGrant(verification.email, 'password_reset_grant', 15);
  res.json({ success: true, valid: true, resetToken: passwordResetToken });
});

router.post('/auth/forgot-password/reset', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) {
    return res.status(400).json({ error: 'Reset token and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  try {
    const email = await consumeSecureGrant(resetToken, 'password_reset_grant');
    if (!email) {
      return res.status(400).json({ error: 'Password reset session expired. Please request a new code.' });
    }
    const user = await MasterDB.findUserByIdentifier(email);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    await MasterDB.updatePasswordAndRevokeSessions(user.id, PasswordSecurity.hash(newPassword));
    logActivity('security', 'Password reset completed', `User: ${user.email} (${user.tiwiId})`, user.tiwiId);
    res.json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('App password reset error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Forgot Password Verify
router.post('/auth/forgot-password/verify', async (req, res) => {
  try {
    const { resetToken, otpCode, newPassword } = req.body;
    if (!resetToken || !otpCode || !newPassword) {
      return res.status(400).json({ error: 'Reset token, 6-digit code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const verification = await verifySecureOtp(resetToken, otpCode, 'forgot_password');
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const hashedPassword = PasswordSecurity.hash(newPassword);
    await MasterDB.updatePasswordAndRevokeSessions(user.id, hashedPassword);

    logActivity('security', 'Password reset completed', `User: ${user.email} (${user.tiwiId})`, user.tiwiId);

    return res.json({
      success: true,
      message: 'Password reset successful! You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('Password reset verify error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Admin Email Config
router.get('/admin/email-config', requireAdmin, async (req, res) => {
  try {
    const config = getEmailConfig();
    res.json({ success: true, config });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch email config' });
  }
});

router.get('/admin/email-outbox', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const type = req.query.type || null;
    const outbox = await listEmailDeliveries({ limit, type });
    res.json({ success: true, count: outbox.length, outbox });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch outbox' });
  }
});

router.post('/admin/email-test', requireAdmin, async (req, res) => {
  try {
    const { to } = req.body || {};
    const target = (to || '').trim().toLowerCase();
    if (!target || !target.includes('@')) {
      return res.status(400).json({ success: false, error: 'Recipient email address ("to") is required.' });
    }
    const config = getEmailConfig();

    const verification = await verifySmtpConnection();
    if (!verification.ok) {
      return res.status(400).json({
        success: false,
        delivered: false,
        error: verification.error,
        smtpConfig: {
          host: config.smtp?.host,
          port: config.smtp?.port,
          provider: config.smtp?.provider,
          credentialsConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
        },
        troubleshooting: 'Outbound port 25 is blocked by VPS provider. Please configure an authenticated SMTP relay on port 465 or 587.'
      });
    }

    const sendRes = await sendTiwloEmail({
      to: target,
      subject: 'Tiwlo: Live SMTP Deliverability Test',
      html: renderBaseEmail({
        title: 'Tiwlo SMTP Relay Test',
        recipientEmail: target,
        contentHtml: `
          <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
            SMTP Deliverability Test
          </h1>
          <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
            Your Tiwlo SMTP relay configuration to <strong>${target}</strong> is active and delivering verified messages.
          </p>
        `
      }),
      type: 'test'
    });

    return res.json({ success: sendRes.delivered, result: sendRes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Session
router.get('/auth/session', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);

    if (!token) {
      return res.json({ authenticated: false });
    }

    const sessionData = await MasterDB.getSession(token, req);
    if (!sessionData || !sessionData.user) {
      return res.json({ authenticated: false });
    }

    const { user } = sessionData;
    const tiwiId = user.tiwiId || user.storeId;

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        tiwiId,
        storeId: tiwiId,
        storeName: user.storeName,
        name: user.name || user.storeName,
        avatar: user.avatar || '/tiwlo-icon.png',
        coverPhoto: user.coverPhoto || '/cloud-hero-full-bg.jpg',
        email: user.email,
        planId: user.planId,
        planName: user.planName,
        subdomain: user.subdomain
      }
    });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

// Me
router.get('/auth/me', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);

    let targetUser = null;
    if (token) {
      const sessionData = await MasterDB.getSession(token, req);
      if (sessionData && sessionData.user) {
        targetUser = sessionData.user;
      }
    }

    if (!targetUser) {
      return res.json({ success: false, authenticated: false, user: null });
    }

    const allUsers = await MasterDB.getUsers();
    const freshUser = allUsers.find(u => u.id === targetUser.id || u.tiwiId === targetUser.tiwiId) || targetUser;

    if (freshUser.isBanned) {
      return res.json({
        success: false,
        authenticated: false,
        isBanned: true,
        email: freshUser.email,
        name: freshUser.name || freshUser.storeName,
        avatar: freshUser.avatar || null,
        storeName: freshUser.storeName || freshUser.name || 'Store',
        tiwiId: freshUser.tiwiId || freshUser.storeId || null,
        banReason: freshUser.banReason || 'Your account was disabled due to a violation of platform policies.',
        user: null
      });
    }

    const tiwiId = freshUser.tiwiId || freshUser.storeId || null;

    res.json({
      success: true,
      authenticated: true,
      sessionToken: token || null,
      tiwiId,
      storeId: tiwiId,
      user: {
        id: freshUser.id,
        tiwiId,
        storeId: tiwiId,
        storeName: freshUser.storeName || freshUser.name || 'Tiwlo Store',
        name: freshUser.name || freshUser.storeName || 'Tiwlo Store',
        avatar: freshUser.avatar || '/tiwlo-icon.png',
        coverPhoto: freshUser.coverPhoto || '/cloud-hero-full-bg.jpg',
        email: freshUser.email,
        role: (freshUser.email?.toLowerCase().trim() === 'tiwloltd@gmail.com' ? 'super_admin' : (freshUser.role && freshUser.role !== 'super_admin' ? freshUser.role : 'owner')),
        planId: freshUser.planId,
        planName: freshUser.planName,
        subdomain: freshUser.subdomain,
        billingDetails: freshUser.billingDetails,
        credits: freshUser.credits !== undefined ? freshUser.credits : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch live user' });
  }
});

// Sync Session
router.get('/auth/sync-session', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);

    if (!token) {
      return res.json({ success: false, authenticated: false, user: null });
    }

    const sessionData = await MasterDB.getSession(token, req);
    if (!sessionData || !sessionData.user) {
      return res.json({ success: false, authenticated: false, user: null });
    }

    const targetUser = sessionData.user;
    const allUsers = await MasterDB.getUsers();
    const freshUser = allUsers.find(u => u.id === targetUser.id || u.tiwiId === targetUser.tiwiId) || targetUser;

    if (freshUser.isBanned) {
      return res.json({
        success: false,
        authenticated: false,
        isBanned: true,
        email: freshUser.email,
        name: freshUser.name || freshUser.storeName,
        avatar: freshUser.avatar || null,
        storeName: freshUser.storeName || freshUser.name || 'Store',
        tiwiId: freshUser.tiwiId || freshUser.storeId || null,
        banReason: freshUser.banReason || 'Your account was disabled due to a violation of platform policies.',
        user: null
      });
    }

    const tiwiId = freshUser.tiwiId || freshUser.storeId || null;

    res.json({
      success: true,
      authenticated: true,
      sessionToken: token,
      tiwiId,
      storeId: tiwiId,
      user: {
        id: freshUser.id,
        tiwiId,
        storeId: tiwiId,
        storeName: freshUser.storeName || freshUser.name || 'Tiwlo Store',
        name: freshUser.name || freshUser.storeName || 'Tiwlo Store',
        avatar: freshUser.avatar || '/tiwlo-icon.png',
        coverPhoto: freshUser.coverPhoto || '/cloud-hero-full-bg.jpg',
        email: freshUser.email,
        role: (freshUser.email?.toLowerCase().trim() === 'tiwloltd@gmail.com' ? 'super_admin' : (freshUser.role && freshUser.role !== 'super_admin' ? freshUser.role : 'owner')),
        planId: freshUser.planId,
        planName: freshUser.planName,
        subdomain: freshUser.subdomain,
        billingDetails: freshUser.billingDetails,
        credits: freshUser.credits !== undefined ? freshUser.credits : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync session' });
  }
});

// SSO Handshake Generation
router.post('/auth/sso/generate-handshake', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies?.tiwlo_session ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    let targetUser = null;
    if (token) {
      const sessionData = await MasterDB.getSession(token, req);
      if (sessionData && sessionData.user) {
        targetUser = sessionData.user;
      }
    }

    if (!targetUser) {
      return res.status(401).json({ error: 'Authentication required: Valid session token must be provided to initiate SSO handshake.' });
    }

    const tiwiId = targetUser.tiwiId || targetUser.storeId || null;

    const deviceData = {
      platform: req.body.platform || 'mobile',
      osVersion: req.body.osVersion || 'unknown',
      deviceModel: req.body.deviceModel || 'Tiwi Mobile Device',
      appVersion: req.body.appVersion || '1.0.0',
      networkType: req.body.networkType || 'cellular/wifi'
    };

    const handshake = await SsoSecurity.generateHandshakeTicket({
      userId: targetUser.id,
      tiwiId,
      email: targetUser.email,
      deviceData,
      appTrustToken: req.headers['x-tiwi-app-trust'] || req.body.appTrustToken,
      origin: 'tiwi_mobile_app',
      req
    });

    logActivity('security', 'SSO Handshake Generated', `User: ${targetUser.name} (${tiwiId}) via Mobile App`, tiwiId);

    res.json({
      success: true,
      ssoToken: handshake.ssoToken,
      nonce: handshake.nonce,
      expiresAt: handshake.expiresAt,
      isAppTrusted: handshake.isAppTrusted,
      deviceFingerprint: handshake.deviceFingerprint
    });
  } catch (err) {
    console.error('SSO Handshake generation error:', err);
    res.status(500).json({ error: 'Failed to generate SSO handshake' });
  }
});

// SSO Handshake Consumption
router.post('/auth/sso/consume-handshake', async (req, res) => {
  try {
    const { ssoToken, nonce } = req.body;

    if (!ssoToken || !nonce) {
      return res.status(400).json({ error: 'Missing SSO token or nonce in handshake request' });
    }

    const verification = await SsoSecurity.verifyAndConsumeTicket({ ssoToken, nonce, req });

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: verification.error
      });
    }

    let user = await MasterDB.findUserByIdentifier(verification.user.id);
    if (!user && verification.user.email) {
      user = await MasterDB.findUserByIdentifier(verification.user.email);
    }
    if (!user) {
      const allUsers = await MasterDB.getUsers();
      user = allUsers.find(u => u.id === verification.user.id || u.tiwiId === verification.user.tiwiId);
    }
    if (!user) {
      return res.status(404).json({ error: 'SSO user not found in database' });
    }

    const tiwiId = user.tiwiId || user.storeId || null;
    const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);

    setSessionCookie(res, req, sessionToken);

    logActivity('auth', 'SSO Auto-Login Verified', `User: ${user.name} (${tiwiId}) logged in via Mobile App Trust Handshake`, tiwiId);

    res.json({
      success: true,
      authenticated: true,
      sessionToken,
      clientSource: 'tiwi_mobile_app',
      isAppTrusted: verification.isAppTrusted,
      deviceFingerprint: verification.deviceFingerprint,
      user: {
        id: user.id,
        tiwiId,
        storeId: tiwiId,
        storeName: user.storeName || user.name || 'Tiwlo Store',
        name: user.name || user.storeName || 'Tiwlo Store',
        avatar: user.avatar || '/tiwlo-icon.png',
        coverPhoto: user.coverPhoto || '/cloud-hero-full-bg.jpg',
        email: user.email,
        planId: user.planId,
        planName: user.planName,
        subdomain: user.subdomain,
        billingDetails: user.billingDetails
      },
      message: `Authenticated securely via Tiwi Mobile SSO Handshake`
    });
  } catch (err) {
    console.error('SSO Handshake consumption error:', err);
    res.status(500).json({ error: 'Failed to consume SSO handshake' });
  }
});

// Admin Users List
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await MasterDB.getUsers();
    const safeUsers = users.map(u => ({
      id: u.id,
      tiwiId: u.tiwiId || u.storeId,
      storeName: u.storeName,
      name: u.name || u.storeName,
      avatar: u.avatar || '/tiwlo-icon.png',
      coverPhoto: u.coverPhoto || '/cloud-hero-full-bg.jpg',
      email: u.email,
      planId: u.planId,
      planName: u.planName,
      subdomain: u.subdomain,
      createdAt: u.createdAt
    }));
    res.json({ success: true, count: safeUsers.length, users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update Profile
router.put('/auth/profile', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);
    const sessionData = token ? await MasterDB.getSession(token, req) : null;
    const userId = sessionData?.user?.id || req.activeUser?.id || req.user?.id || req.session?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { name, storeName, avatar, coverPhoto } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (storeName) updates.storeName = storeName;
    if (avatar) updates.avatar = avatar;
    if (coverPhoto) updates.coverPhoto = coverPhoto;

    const updated = await MasterDB.updateUser(userId, updates);
    if (updated) {
      try {
        const { SocialDB } = await import('../social/socialDb.js');
        await SocialDB.updateProfile(userId, updates);
      } catch (e) {}
    }
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Logout
router.post('/auth/logout', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);
    clearSessionCookie(res, req);

    if (token) {
      await MasterDB.deleteSession(token);
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

export default router;
