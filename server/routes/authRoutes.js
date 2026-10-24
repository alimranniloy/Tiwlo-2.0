import express from 'express';
import crypto from 'node:crypto';
import { MasterDB } from '../db/multiTenant.js';
import { hasUnverifiedSsoIdentity } from '../security/authGuards.js';
import {
  BruteForceShield,
  SsoSecurity
} from '../security/cryptoSecurity.js';
import {
  completeMfaSetupWithRust,
  hashPasswordWithRust,
  verifyPasswordWithRust
} from '../security/rustAuthSessionClient.js';
import {
  consumeSecureGrant,
  completeEmailVerificationWithRust,
  completeMfaLoginWithRust,
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
import {
  getWebSsoBridgeUrl,
  isAllowedWebSsoReturnUrl
} from '../security/webSsoReturnUrl.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { securityLimiters, registrationGuards } from '../plugins/security/index.js';
import { normalizeSignupEmail, isDuplicateAccountError, isDuplicateBrowserError } from '../security/signupIdentity.js';
import { getPgPool, queryPg } from '../db/postgres.js';
import {
  findOrCreateSocialUser,
  getSocialCallbackUrl,
  getSocialProviderCredentials,
  getSocialProviderStatuses
} from '../security/socialAuth.js';

const router = express.Router();

function getRequestSessionToken(req) {
  const authHeader = req.headers.authorization;
  return req.cookies?.tiwlo_host_session ||
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
  const isSecure = process.env.NODE_ENV === 'production' || req?.secure || req?.headers?.['x-forwarded-proto'] === 'https';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/'
  };
}

function clearLegacySessionCookies(res, req) {
  const isSecure = process.env.NODE_ENV === 'production' || req?.secure || req?.headers?.['x-forwarded-proto'] === 'https';
  for (const domain of new Set([PLATFORM_CONFIG.cookieDomain, PLATFORM_CONFIG.primaryDomain])) {
    res.clearCookie('tiwlo_session', { path: '/', domain, secure: isSecure, sameSite: 'lax' });
  }
  res.clearCookie('tiwlo_session', { path: '/', secure: isSecure, sameSite: 'lax' });
  res.clearCookie('tiwlo_session');
}

export function setSessionCookie(res, req, sessionToken) {
  clearLegacySessionCookies(res, req);
  const opts = {
    ...getSessionCookieOptions(req),
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
  res.cookie('tiwlo_host_session', sessionToken, opts);
}

export function clearSessionCookie(res, req) {
  clearLegacySessionCookies(res, req);
  res.clearCookie('tiwlo_host_session', getSessionCookieOptions(req));
  res.clearCookie('tiwlo_host_session');
}

function migrateSessionCookie(res, req, sessionToken) {
  const host = (req?.headers?.host || req?.hostname || '').toLowerCase().replace(/:\d+$/, '');
  const cookieParentDomain = PLATFORM_CONFIG.cookieDomain.replace(/^\./, '');
  const isSharedCookieHost = [
    PLATFORM_CONFIG.primaryDomain,
    PLATFORM_CONFIG.storeDomain,
    cookieParentDomain,
    PLATFORM_CONFIG.authDomain
  ].some(domain => host === domain || host.endsWith(`.${domain}`));

  if (isSharedCookieHost && sessionToken) {
    setSessionCookie(res, req, sessionToken);
  }
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

async function createWebSsoRedirectUrl(returnTo, user, req) {
  const handshake = await SsoSecurity.generateHandshakeTicket({
    userId: user.id,
    tiwiId: user.tiwiId || user.storeId || null,
    email: user.email,
    origin: 'web_sso',
    req
  });
  const target = new URL(returnTo);
  target.searchParams.set('sso_token', handshake.ssoToken);
  target.searchParams.set('sso_nonce', handshake.nonce);
  return target.toString();
}

function getSocialLoginUrl(provider, { returnTo, error = '' } = {}) {
  const authOrigin = PLATFORM_CONFIG.authDomain.startsWith('http')
    ? PLATFORM_CONFIG.authDomain
    : `https://${PLATFORM_CONFIG.authDomain}`;
  const loginUrl = new URL('/login', authOrigin);
  loginUrl.searchParams.set('social_flow', '1');
  if (returnTo) loginUrl.searchParams.set('return_to', returnTo);
  if (error) loginUrl.searchParams.set('social_error', `${provider}:${error}`);
  return loginUrl.toString();
}

function getSocialProfileCompletionUrl(provider, { returnTo, challengeToken }) {
  const authOrigin = PLATFORM_CONFIG.authDomain.startsWith('http')
    ? PLATFORM_CONFIG.authDomain
    : `https://${PLATFORM_CONFIG.authDomain}`;
  const profileUrl = new URL('/create-account', authOrigin);
  profileUrl.searchParams.set('social_flow', '1');
  profileUrl.searchParams.set('social_profile', 'required');
  profileUrl.searchParams.set('social_provider', provider);
  if (returnTo) profileUrl.searchParams.set('return_to', returnTo);
  profileUrl.hash = new URLSearchParams({ social_profile_token: challengeToken }).toString();
  return profileUrl.toString();
}

function getSocialStateCookieOptions(req) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60 * 1000
  };
}

function clearOAuthMfaCookie(res, req) {
  const { maxAge, ...cookieOptions } = getSocialStateCookieOptions(req);
  res.clearCookie('tiwlo_oauth_mfa', cookieOptions);
}

function getSocialProfileChallengeCookieOptions(req) {
  return { ...getSocialStateCookieOptions(req), path: '/', maxAge: 30 * 60 * 1000 };
}

function getSocialProfileChallengeToken(req) {
  const headerToken = req.get('x-social-profile-challenge');
  const bodyToken = req.body?.challengeToken;
  const token = typeof headerToken === 'string' ? headerToken : bodyToken;
  return typeof token === 'string' && token ? token : req.cookies?.tiwlo_social_profile;
}

function hashSocialProfileChallenge(token) {
  return crypto.createHash('sha256').update(token).digest();
}

function isValidSocialBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    parsed <= new Date();
}

function sameState(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function maskSocialEmail(email) {
  return maskEmail(email);
}

async function readOAuthJson(url, options, provider) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${provider} returned an unsuccessful OAuth response.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function fetchSocialProfile(provider, code, credentials) {
  const callbackUrl = getSocialCallbackUrl(provider);
  if (provider === 'google') {
    const token = await readOAuthJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code'
      })
    }, 'Google');
    if (!token.access_token) throw new Error('Google did not return an access token.');
    const profile = await readOAuthJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    }, 'Google');
    if (profile.email_verified !== true || !profile.sub || !profile.email) {
      throw new Error('Google account does not have a verified email address.');
    }
    let dateOfBirth = '';
    let address = '';
    try {
      const personalProfile = await readOAuthJson(
        'https://people.googleapis.com/v1/people/me?personFields=birthdays,addresses',
        { headers: { Authorization: `Bearer ${token.access_token}` } },
        'Google People API'
      );
      const birthday = personalProfile.birthdays?.find(item => item.metadata?.primary)?.date ||
        personalProfile.birthdays?.[0]?.date;
      if (birthday?.year && birthday.month && birthday.day) {
        dateOfBirth = [
          String(birthday.year).padStart(4, '0'),
          String(birthday.month).padStart(2, '0'),
          String(birthday.day).padStart(2, '0')
        ].join('-');
      }
      address = personalProfile.addresses?.find(item => item.metadata?.primary)?.formattedValue ||
        personalProfile.addresses?.find(item => item.formattedValue)?.formattedValue ||
        '';
    } catch (error) {
      console.warn('[SocialAuth] Google did not provide optional birthday/address data:', error.message);
    }
    return {
      providerUserId: String(profile.sub),
      email: profile.email,
      name: profile.name || profile.given_name || '',
      avatar: profile.picture || '',
      dateOfBirth,
      address
    };
  }

  const token = await readOAuthJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: callbackUrl
    })
  }, 'GitHub');
  if (!token.access_token) throw new Error('GitHub did not return an access token.');
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const [profile, emailList] = await Promise.all([
    readOAuthJson('https://api.github.com/user', { headers }, 'GitHub'),
    readOAuthJson('https://api.github.com/user/emails', { headers }, 'GitHub')
  ]);
  if (!Number.isSafeInteger(profile.id) || !Array.isArray(emailList)) {
    throw new Error('GitHub returned an invalid identity response.');
  }
  const verifiedEmail = emailList.find(item => item.primary === true && item.verified === true) ||
    emailList.find(item => item.verified === true);
  if (!verifiedEmail?.email) throw new Error('GitHub account does not have a verified email address.');
  return {
    providerUserId: String(profile.id),
    email: verifiedEmail.email,
    name: profile.name || profile.login || '',
    avatar: profile.avatar_url || ''
  };
}

async function startSocialLogin(provider, req, res) {
  const credentials = await getSocialProviderCredentials(provider);
  if (!credentials) return res.status(503).send(`${provider} sign-in is not configured yet.`);

  const defaultReturnTo = `${PLATFORM_CONFIG.dashboardUrl.replace(/\/+$/, '')}/oneprofile`;
  const requestedReturnTo = typeof req.query.return_to === 'string'
    ? req.query.return_to
    : defaultReturnTo;
  if (!isAllowedWebSsoReturnUrl(requestedReturnTo, {
    dashboardHost: PLATFORM_CONFIG.dashboardHost,
    mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
  })) {
    return res.status(400).send('Invalid sign-in return destination.');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const cookieName = `tiwlo_${provider}_oauth_state`;
  res.cookie(cookieName, JSON.stringify({ state, returnTo: requestedReturnTo }), getSocialStateCookieOptions(req));
  const callbackUrl = getSocialCallbackUrl(provider);

  if (provider === 'google') {
    const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizeUrl.search = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/user.birthday.read',
        'https://www.googleapis.com/auth/user.addresses.read'
      ].join(' '),
      state,
      prompt: 'select_account'
    }).toString();
    return res.redirect(authorizeUrl.toString());
  }

  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.search = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true'
  }).toString();
  return res.redirect(authorizeUrl.toString());
}

async function completeSocialLogin(provider, req, res) {
  const callbackState = req.query.state;
  const cookieName = `tiwlo_${provider}_oauth_state`;
  const cookieOptions = getSocialStateCookieOptions(req);
  let savedState;
  try {
    savedState = JSON.parse(req.cookies?.[cookieName] || 'null');
  } catch {
    savedState = null;
  }
  res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
  if (!savedState || !sameState(callbackState, savedState.state) ||
      typeof savedState.returnTo !== 'string' ||
      !isAllowedWebSsoReturnUrl(savedState.returnTo, {
        dashboardHost: PLATFORM_CONFIG.dashboardHost,
        mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
      })) {
    return res.status(400).send('Social sign-in could not verify the OAuth state. Please try again.');
  }

  if (typeof req.query.error === 'string' || typeof req.query.code !== 'string') {
    return res.redirect(getSocialLoginUrl(provider, { returnTo: savedState.returnTo, error: 'cancelled' }));
  }

  try {
    const credentials = await getSocialProviderCredentials(provider);
    if (!credentials) {
      return res.redirect(getSocialLoginUrl(provider, { returnTo: savedState.returnTo, error: 'unavailable' }));
    }
    const identity = await fetchSocialProfile(provider, req.query.code, credentials);
    const user = await findOrCreateSocialUser({ provider, ...identity });
    const socialData = await SocialDB.getData();
    const socialProfile = socialData.profiles?.[user.id] || {};
    if (
      !user.dateOfBirth ||
      !user.address?.trim() ||
      !user.phone?.trim() ||
      !user.billingDetails?.city?.trim() ||
      !user.billingDetails?.country?.trim() ||
      !socialProfile.handle?.trim()
    ) {
      const challengeToken = crypto.randomBytes(32).toString('base64url');
      await queryPg(
        'DELETE FROM system_social_profile_challenges WHERE expires_at <= CURRENT_TIMESTAMP'
      );
      await queryPg(
        `INSERT INTO system_social_profile_challenges (token_hash, user_id, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')`,
        [hashSocialProfileChallenge(challengeToken), user.id]
      );
      res.cookie('tiwlo_social_profile', challengeToken, getSocialProfileChallengeCookieOptions(req));
      return res.redirect(getSocialProfileCompletionUrl(provider, {
        returnTo: savedState.returnTo,
        challengeToken
      }));
    }
    const mfaMode = user.twoFactorEnabled ? 'login' : 'setup';
    const otp = await generateSecureOtp(
      user.email,
      mfaMode === 'login' ? 'login_2fa' : 'setup_2fa',
      mfaMode === 'login' ? 10 : 15
    );
    await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: otp.code
    });
    res.cookie('tiwlo_oauth_mfa', otp.token, {
      ...getSocialStateCookieOptions(req),
      maxAge: 15 * 60 * 1000
    });
    const loginUrl = new URL(getSocialLoginUrl(provider, { returnTo: savedState.returnTo }));
    return res.redirect(loginUrl.toString());
  } catch (error) {
    if (error.code === 'ACCOUNT_DISABLED') {
      return res.redirect(getSocialLoginUrl(provider, { returnTo: savedState.returnTo, error: 'disabled' }));
    }
    console.error(`[SocialAuth] ${provider} callback failed:`, error.message);
    return res.redirect(getSocialLoginUrl(provider, { returnTo: savedState.returnTo, error: 'failed' }));
  }
}

// ==========================================
// 1. SOCIAL SSO CHECK
// ==========================================
router.get('/auth/social/profile-challenge', async (req, res) => {
  const challengeToken = getSocialProfileChallengeToken(req);
  if (!challengeToken) return res.status(401).json({ error: 'Profile completion session expired. Please sign in again.' });
  try {
    const { rows } = await queryPg(
      `SELECT c.user_id, u.name, u.store_name, u.email, u.date_of_birth, u.address, u.avatar,
              u.phone, u.city, u.country, u.postal_code
       FROM system_social_profile_challenges c
       JOIN system_users u ON u.id = c.user_id
       WHERE c.token_hash = $1 AND c.expires_at > CURRENT_TIMESTAMP`,
      [hashSocialProfileChallenge(challengeToken)]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Profile completion session expired. Please sign in again.' });
    const socialData = await SocialDB.getData();
    const socialProfile = socialData.profiles?.[rows[0].user_id] || {};
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      profile: {
        name: rows[0].name || rows[0].store_name || '',
        email: rows[0].email,
        dateOfBirth: rows[0].date_of_birth ? String(rows[0].date_of_birth).slice(0, 10) : '',
        address: rows[0].address || '',
        avatar: rows[0].avatar || '',
        phone: rows[0].phone || '',
        city: rows[0].city || '',
        country: rows[0].country || 'Bangladesh',
        postalCode: rows[0].postal_code || '',
        handle: socialProfile.handle || '',
        gender: socialProfile.gender || ''
      }
    });
  } catch (error) {
    console.error('[SocialAuth] Could not load required profile details:', error.message);
    return res.status(503).json({ error: 'Required profile details are temporarily unavailable.' });
  }
});

router.get('/auth/social/mfa-challenge', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const tempToken = req.cookies?.tiwlo_oauth_mfa;
  if (!tempToken) return res.status(401).json({ error: 'Social sign-in verification expired. Please sign in again.' });
  try {
    const challenge = await getOtpSession(tempToken);
    if (!challenge || !['login_2fa', 'setup_2fa'].includes(challenge.type)) {
      return res.status(401).json({ error: 'Social sign-in verification expired. Please sign in again.' });
    }
    return res.json({
      success: true,
      challenge: challenge.type === 'login_2fa' ? 'login' : 'setup',
      emailMasked: maskSocialEmail(challenge.email)
    });
  } catch (error) {
    console.error('[SocialAuth] Could not verify MFA challenge:', error.message);
    return res.status(503).json({ error: 'Could not verify social sign-in. Please try again.' });
  }
});

router.post('/auth/social/check-handle', async (req, res) => {
  const challengeToken = getSocialProfileChallengeToken(req);
  const handle = typeof req.body?.handle === 'string' ? req.body.handle.trim() : '';
  if (!challengeToken) return res.status(401).json({ error: 'Profile completion session expired. Please sign in again.' });
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(handle)) {
    return res.status(422).json({
      handleAvailable: false,
      handleError: 'Username must be 3-30 letters, numbers, or underscores.'
    });
  }
  try {
    const { rows } = await queryPg(
      `SELECT user_id FROM system_social_profile_challenges
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [hashSocialProfileChallenge(challengeToken)]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Profile completion session expired. Please sign in again.' });
    const availability = await SocialDB.checkAvailability({
      handle,
      userId: rows[0].user_id
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      handleAvailable: availability.handleAvailable,
      handleError: availability.handleError
    });
  } catch (error) {
    console.error('[SocialAuth] Could not check profile username:', error.message);
    return res.status(503).json({ error: 'Could not check username availability. Please try again.' });
  }
});

router.post('/auth/social/complete-profile', async (req, res) => {
  const challengeToken = getSocialProfileChallengeToken(req);
  const dateOfBirth = req.body?.dateOfBirth;
  const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const handle = typeof req.body?.handle === 'string'
    ? req.body.handle.trim().replace(/^@/, '').toLowerCase()
    : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const city = typeof req.body?.city === 'string' ? req.body.city.trim() : '';
  const country = typeof req.body?.country === 'string' ? req.body.country.trim() : '';
  const postalCode = typeof req.body?.postalCode === 'string' ? req.body.postalCode.trim() : '';
  const gender = typeof req.body?.gender === 'string' ? req.body.gender.trim() : '';
  if (!challengeToken) return res.status(401).json({ error: 'Profile completion session expired. Please sign in again.' });
  if (!isValidSocialBirthDate(dateOfBirth)) {
    return res.status(422).json({ error: 'Enter a valid date of birth that is not in the future.' });
  }
  if (!name || name.length > 255) {
    return res.status(422).json({ error: 'Enter your full name.' });
  }
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
    return res.status(422).json({ error: 'Username must be 3-30 characters and can only contain letters, numbers, and underscores.' });
  }
  if (!address || address.length > 2000 || !city || city.length > 100 || !country || country.length > 100) {
    return res.status(422).json({ error: 'Enter your street address, city, and country.' });
  }
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15 || phone.length > 32) {
    return res.status(422).json({ error: 'Enter a valid phone number.' });
  }
  if (postalCode.length > 32 || gender.length > 50) {
    return res.status(422).json({ error: 'Some profile details are too long.' });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  let userId;
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`social-handle:${handle}`]
    );
    const challenge = await client.query(
      `SELECT user_id FROM system_social_profile_challenges
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
       FOR UPDATE`,
      [hashSocialProfileChallenge(challengeToken)]
    );
    if (!challenge.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Profile completion session expired. Please sign in again.' });
    }
    userId = challenge.rows[0].user_id;
    if (await SocialDB.isHandleTaken(handle, userId)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That username is already taken. Choose another.' });
    }
    await client.query(
      `UPDATE system_users
       SET name = $2,
           store_name = CASE WHEN COALESCE(account_type, 'personal') = 'personal' THEN $2 ELSE store_name END,
           date_of_birth = $3::date, address = $4,
           phone = $5, city = $6, country = $7, postal_code = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, name, dateOfBirth, address, phone, city, country, postalCode]
    );
    const socialProfileWrite = await client.query(
      `INSERT INTO social_profiles
         (id, tiwi_id, name, handle, location, phone, gender, birthday, updated_at)
       SELECT id, tiwi_id, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
       FROM system_users
       WHERE id = $1
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         handle = EXCLUDED.handle,
         location = EXCLUDED.location,
         phone = EXCLUDED.phone,
         gender = EXCLUDED.gender,
         birthday = EXCLUDED.birthday,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [userId, name, `@${handle}`, `${city}, ${country}`, phone, gender || 'Rather not say', dateOfBirth]
    );
    if (!socialProfileWrite.rows[0]) {
      throw new Error('Could not persist the social username.');
    }
    await client.query('COMMIT');

    const user = await MasterDB.findUserByIdentifier(userId);
    if (!user) throw new Error('Could not resolve the account after profile completion.');
    const socialData = await SocialDB.getData();
    const currentProfile = socialData.profiles?.[userId] || {};
    const normalizedHandle = `@${handle}`;
    const billingAddress = {
      ...(currentProfile.billingAddress || {}),
      address,
      city,
      country,
      postalCode,
      phone
    };
    const updatedProfile = await SocialDB.updateProfile(userId, {
      name,
      handle: normalizedHandle,
      phone,
      birthday: dateOfBirth,
      gender: gender || currentProfile.gender || 'Rather not say',
      location: `${city}, ${country}`,
      billingAddress
    });
    if (!updatedProfile) throw new Error('Could not save the social profile details.');
    await queryPg(
      'DELETE FROM system_social_profile_challenges WHERE token_hash = $1',
      [hashSocialProfileChallenge(challengeToken)]
    );
    const mfaMode = user.twoFactorEnabled ? 'login' : 'setup';
    const otp = await generateSecureOtp(
      user.email,
      mfaMode === 'login' ? 'login_2fa' : 'setup_2fa',
      mfaMode === 'login' ? 10 : 15
    );
    await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: otp.code
    });
    res.clearCookie('tiwlo_social_profile', {
      ...getSocialProfileChallengeCookieOptions(req),
      maxAge: undefined
    });
    res.cookie('tiwlo_oauth_mfa', otp.token, {
      ...getSocialStateCookieOptions(req),
      maxAge: 15 * 60 * 1000
    });
    return res.json({
      success: true,
      challenge: mfaMode,
      emailMasked: maskSocialEmail(user.email),
      message: 'Profile saved. A verification code has been sent to your email.'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken. Choose another.' });
    }
    console.error('[SocialAuth] Could not complete required profile details:', error.message);
    return res.status(503).json({ error: 'Profile details could not be saved. Please try again.' });
  } finally {
    client.release();
  }
});

router.get('/auth/social/providers', async (_req, res) => {
  try {
    const providers = await getSocialProviderStatuses();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      google: providers.google.enabled,
      github: providers.github.enabled
    });
  } catch (error) {
    console.error('[SocialAuth] Could not read provider status:', error.message);
    res.status(503).json({ error: 'Social sign-in status is unavailable.' });
  }
});

router.get('/auth/google', (req, res, next) => startSocialLogin('google', req, res).catch(next));
router.get('/auth/google/callback', (req, res) => completeSocialLogin('google', req, res));
router.get('/auth/github', (req, res, next) => startSocialLogin('github', req, res).catch(next));
router.get('/auth/github/callback', (req, res) => completeSocialLogin('github', req, res));

router.post('/auth/social-check', (_req, res) => {
  return res.status(503).json({
    error: 'Google and GitHub sign-in are unavailable until provider identity tokens can be verified securely.'
  });
});

// Check Email
router.post('/auth/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!normalizeSignupEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    const normalized = email.trim().toLowerCase();
    const existing = await MasterDB.isSignupEmailTaken(normalized);
    if (existing) {
      return res.json({
        exists: true,
        message: 'That email is already in use.'
      });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error('Check email error:', err);
    return res.status(503).json({ error: 'Email availability is temporarily unavailable.' });
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
router.post('/auth/register', ...registrationGuards, async (req, res) => {
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

    if (typeof password !== 'string' || password.length < 6) {
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
      signupBrowserKey: req.signupBrowserKey,
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
      const socialData = (await SocialDB.getData());
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
      (await SocialDB.saveData(socialData));
    } catch (socErr) {
      console.warn('[Register] SocialDB profile provisioning warning:', socErr.message);
    }

    (await logActivity('auth', `Store "${newUser.storeName}" Created`, `Tiwi ID: ${tiwiId} • Email: ${normalizedEmail}`, tiwiId));

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
    if (isDuplicateBrowserError(err)) {
      return res.status(409).json({ error: 'This browser already created an account. Please sign in or contact support for help with a shared device.' });
    }
    if (isDuplicateAccountError(err)) {
      return res.status(409).json({ error: 'An account already uses this email. Please sign in or recover your existing account.' });
    }
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
    const passwordCheck = user?.password
      ? await verifyPasswordWithRust(user.id, password)
      : { valid: false, rehashPerformed: false };

    if (!user || !passwordCheck.valid) {
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
      (await logActivity('alert', `Failed Login Attempt`, `Target: ${cleanId} from IP ${clientIp}`));

      const remaining = acctRecord?.remainingAttempts ?? 0;
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
      (await logActivity('alert', `Disabled Account Sign-In Blocked`, `Target: ${cleanId} from IP ${clientIp}`));
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

    const isEmailVerified = user.emailVerified === true;
    if (!isEmailVerified) {
      const otpResult = await generateSecureOtp(user.email, 'email_verify', 15);
      const masked = maskEmail(user.email);

      const emailResult = await sendSignupVerificationOtpEmail({
        to: user.email,
        name: user.name || user.storeName,
        code: otpResult.code
      }).catch(err => ({ success: false, delivered: false, error: err.message }));

      (await logActivity('auth', `Email Verification Required`, `Target: ${cleanId} • Code dispatched to ${masked}`));

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

      (await logActivity('auth', `2FA Setup Challenge Initiated`, `Target: ${cleanId} • Status: ${emailResult?.status}`));

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

    (await logActivity('auth', `2FA Challenge Initiated`, `Target: ${cleanId} • Status: ${emailResult?.status}`));

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
    const tempToken = req.body?.tempToken || req.cookies?.tiwlo_oauth_mfa;
    const { otpCode } = req.body || {};
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = await completeMfaLoginWithRust(tempToken, otpCode, req);
    if (!verification.valid) {
      return res.status(verification.notFound ? 404 : 400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.userId);
    if (!user || user.email.toLowerCase() !== verification.email.toLowerCase()) {
      await MasterDB.deleteSession(verification.sessionToken);
      return res.status(404).json({ error: 'User account not found.' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const tiwiId = user.tiwiId || user.storeId;

    const { sessionToken } = verification;
    setSessionCookie(res, req, sessionToken);
    clearOAuthMfaCookie(res, req);

    (await logActivity('auth', `User completed 2FA login`, `Store: ${user.storeName} (${tiwiId})`, tiwiId));

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
        role: user.role || 'owner',
        planId: user.planId,
        planName: user.planName,
        subdomain: user.subdomain,
        billingDetails: user.billingDetails,
        accountType: user.accountType,
        address: user.address,
        dateOfBirth: user.dateOfBirth || '',
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
    const tempToken = req.body?.tempToken || req.cookies?.tiwlo_oauth_mfa;
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
    if (req.cookies?.tiwlo_oauth_mfa) {
      res.cookie('tiwlo_oauth_mfa', newOtp.token, {
        ...getSocialStateCookieOptions(req),
        maxAge: 15 * 60 * 1000
      });
    }
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    });

    (await logActivity('auth', '2FA Code Resent', `Target: ${user.email} • Status: ${emailResult?.status}`));

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
    const tempToken = req.body?.tempToken || req.cookies?.tiwlo_oauth_mfa;
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
    if (req.cookies?.tiwlo_oauth_mfa) {
      res.cookie('tiwlo_oauth_mfa', newOtp.token, {
        ...getSocialStateCookieOptions(req),
        maxAge: 15 * 60 * 1000
      });
    }
    const [u, d] = user.email.split('@');
    const masked = `${u[0]}***@${d}`;

    const emailResult = await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    });

    (await logActivity('auth', '2FA Setup Code Resent', `Target: ${user.email} • Status: ${emailResult?.status}`));

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
    const tempToken = req.body?.tempToken || req.cookies?.tiwlo_oauth_mfa;
    const { otpCode } = req.body || {};
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = await completeMfaSetupWithRust(tempToken, otpCode);
    if (!verification.valid) {
      return res.status(verification.notFound ? 404 : 400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const tiwiId = user.tiwiId || user.storeId;

    const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);
    setSessionCookie(res, req, sessionToken);
    clearOAuthMfaCookie(res, req);

    (await logActivity('auth', `User completed 2FA setup & signed in`, `Store: ${user.storeName} (${tiwiId})`, tiwiId));

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
        role: user.role || 'owner',
        planId: user.planId,
        planName: user.planName,
        subdomain: user.subdomain,
        billingDetails: user.billingDetails,
        accountType: user.accountType,
        address: user.address,
        dateOfBirth: user.dateOfBirth || '',
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
    const tempToken = req.body?.tempToken || req.cookies?.tiwlo_oauth_mfa;
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
    if (req.cookies?.tiwlo_oauth_mfa) {
      res.cookie('tiwlo_oauth_mfa', newOtp.token, {
        ...getSocialStateCookieOptions(req),
        maxAge: 15 * 60 * 1000
      });
    }
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

    const verification = await completeEmailVerificationWithRust(tempToken, otpCode);
    if (!verification.valid) {
      return res.status(verification.notFound ? 404 : 400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    (await logActivity('auth', 'Email Address Verified', `User: ${user.email} (${user.tiwiId})`, user.tiwiId));

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
export async function authorizeEmailCorrection(req, res, next) {
  const { tempToken, password } = req.body || {};
  if (typeof password !== 'string' || !password || typeof tempToken !== 'string' || !tempToken) {
    return res.status(401).json({ error: 'Confirm your account password to correct your email address.' });
  }
  try {
    const challenge = await getOtpSession(tempToken);
    if (!challenge || challenge.type !== 'email_verify') {
      return res.status(403).json({ error: 'A pending email verification is required.' });
    }
    const user = await MasterDB.findUserByIdentifier(challenge.email);
    // This is only a signup typo-correction flow. Verified accounts and accounts
    // with 2FA must not be downgraded to password-only account recovery.
    if (!user || user.emailVerified || user.twoFactorEnabled || user.isBanned ||
        (req.activeUser && req.activeUser.id !== user.id)) {
      return res.status(403).json({ error: 'This account is not eligible for email correction.' });
    }
    const lockKey = `email-correction:${user.id}`;
    const locked = await BruteForceShield.isLocked(lockKey);
    if (locked) return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    const passwordCheck = await verifyPasswordWithRust(user.id, password);
    if (!passwordCheck.valid) {
      await BruteForceShield.recordFailure(lockKey);
      return res.status(401).json({ error: 'Incorrect account password.' });
    }
    req.emailCorrection = { user, challenge };
    return next();
  } catch (error) {
    return next(error);
  }
}

router.post('/auth/change-email', authorizeEmailCorrection, async (req, res) => {
  try {
    const { tempToken, newEmail } = req.body;
    if (!tempToken || !normalizeSignupEmail(newEmail)) {
      return res.status(400).json({ error: 'Please provide a valid new email address.' });
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const { user, challenge: session } = req.emailCorrection;

    const existing = await MasterDB.isSignupEmailTaken(cleanNewEmail, user.id);
    if (existing) {
      return res.status(400).json({ error: 'This email address is already associated with another account.' });
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

    (await logActivity('auth', 'User Updated Email Address', `Old: ${session.email} • New: ${cleanNewEmail}`, user.tiwiId));

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
    if (isDuplicateAccountError(err)) {
      return res.status(409).json({ error: 'This email address is already associated with another account.' });
    }
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

    (await logActivity('auth', 'Password Recovery Dispatched', `Target: ${user.email} • Status: ${emailResult?.status}`));

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
    const passwordHash = await hashPasswordWithRust(newPassword);
    await MasterDB.updatePasswordAndRevokeSessions(user.id, passwordHash);
    (await logActivity('security', 'Password reset completed', `User: ${user.email} (${user.tiwiId})`, user.tiwiId));
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

    const hashedPassword = await hashPasswordWithRust(newPassword);
    await MasterDB.updatePasswordAndRevokeSessions(user.id, hashedPassword);

    (await logActivity('security', 'Password reset completed', `User: ${user.email} (${user.tiwiId})`, user.tiwiId));

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
    migrateSessionCookie(res, req, token);

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
    migrateSessionCookie(res, req, token);

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
        role: freshUser.role || 'owner',
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
    migrateSessionCookie(res, req, token);

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
        role: freshUser.role || 'owner',
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

router.get('/auth/sso/web-start', async (req, res) => {
  try {
    const returnTo = String(req.query.return_to || '').trim();
    const allowedReturn = isAllowedWebSsoReturnUrl(returnTo, {
      dashboardHost: PLATFORM_CONFIG.dashboardHost,
      mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
    });
    if (!allowedReturn) return res.status(400).json({ error: 'Invalid SSO return URL' });

    const token = getRequestSessionToken(req);
    if (!token) {
      const dashboardBridgeUrl = getWebSsoBridgeUrl(returnTo, {
        platformUrl: `https://${PLATFORM_CONFIG.primaryDomain}`,
        dashboardHost: PLATFORM_CONFIG.dashboardHost,
        mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
      });
      if (dashboardBridgeUrl) return res.redirect(dashboardBridgeUrl);
      return res.redirect(`${PLATFORM_CONFIG.authDomain.startsWith('http') ? PLATFORM_CONFIG.authDomain : `https://${PLATFORM_CONFIG.authDomain}`}/login?return_to=${encodeURIComponent(returnTo)}&sso_login=1`);
    }

    const sessionData = await MasterDB.getSession(token, req);
    if (!sessionData?.user) {
      const dashboardBridgeUrl = getWebSsoBridgeUrl(returnTo, {
        platformUrl: `https://${PLATFORM_CONFIG.primaryDomain}`,
        dashboardHost: PLATFORM_CONFIG.dashboardHost,
        mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
      });
      if (dashboardBridgeUrl) return res.redirect(dashboardBridgeUrl);
      return res.redirect(`${PLATFORM_CONFIG.authDomain.startsWith('http') ? PLATFORM_CONFIG.authDomain : `https://${PLATFORM_CONFIG.authDomain}`}/login?return_to=${encodeURIComponent(returnTo)}&sso_login=1`);
    }

    res.redirect(await createWebSsoRedirectUrl(returnTo, sessionData.user, req));
  } catch (err) {
    console.error('Web SSO start error:', err);
    res.status(500).json({ error: 'Failed to start web SSO' });
  }
});

router.post('/auth/sso/web-start', async (req, res) => {
  try {
    const returnTo = String(req.body?.return_to || '').trim();
    const allowedReturn = isAllowedWebSsoReturnUrl(returnTo, {
      dashboardHost: PLATFORM_CONFIG.dashboardHost,
      mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
    });
    if (!allowedReturn) return res.status(400).json({ error: 'Invalid SSO return URL' });

    res.setHeader('Cache-Control', 'no-store');
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : getRequestSessionToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const sessionData = await MasterDB.getSession(token, req);
    if (!sessionData?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const redirectUrl = await createWebSsoRedirectUrl(returnTo, sessionData.user, req);
    return res.json({ redirectUrl });
  } catch (err) {
    console.error('Web SSO session handoff error:', err);
    return res.status(500).json({ error: 'Failed to start web SSO' });
  }
});

// SSO Handshake Generation
router.post('/auth/sso/generate-handshake', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies?.tiwlo_host_session ||
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

    (await logActivity('security', 'SSO Handshake Generated', `User: ${targetUser.name} (${tiwiId}) via Mobile App`, tiwiId));

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

    const user = await MasterDB.findUserByIdentifier(verification.user.id);
    if (!user || user.id !== verification.user.id) {
      return res.status(404).json({ error: 'SSO user not found in database' });
    }
    if (user.isBanned) return res.status(403).json({ error: 'Account disabled' });

    const tiwiId = user.tiwiId || user.storeId || null;
    const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);

    setSessionCookie(res, req, sessionToken);

    (await logActivity('auth', 'SSO Auto-Login Verified', `User: ${user.name} (${tiwiId}) logged in via Mobile App Trust Handshake`, tiwiId));

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

    const { name, storeName, avatar, coverPhoto, address, dateOfBirth } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (storeName) updates.storeName = storeName;
    if (avatar !== undefined) {
      if (typeof avatar !== 'string' || avatar.length > 4096 ||
          !(avatar.startsWith('https://') || avatar.startsWith('/api/upload/') || avatar.startsWith('/upload/'))) {
        return res.status(422).json({ error: 'Profile photo URL is invalid.' });
      }
      updates.avatar = avatar;
    }
    if (coverPhoto) updates.coverPhoto = coverPhoto;
    if (address !== undefined) {
      if (typeof address !== 'string' || address.trim().length > 2000) {
        return res.status(422).json({ error: 'Address must be 2,000 characters or fewer.' });
      }
      updates.address = address.trim();
    }
    if (dateOfBirth !== undefined) {
      if (!isValidSocialBirthDate(dateOfBirth)) {
        return res.status(422).json({ error: 'Enter a valid date of birth that is not in the future.' });
      }
      updates.dateOfBirth = dateOfBirth;
    }

    const updated = await MasterDB.updateUser(userId, updates);
    if (updated) {
      try {
        await SocialDB.updateProfile(userId, updates);
      } catch (error) {
        console.error('[Profile] Could not synchronize the social profile:', error.message);
      }
    }
    res.json({
      success: true,
      user: updated ? {
        id: updated.id,
        tiwiId: updated.tiwiId || updated.storeId,
        storeId: updated.tiwiId || updated.storeId,
        name: updated.name,
        storeName: updated.storeName,
        email: updated.email,
        avatar: updated.avatar,
        dateOfBirth: updated.dateOfBirth || '',
        address: updated.address || '',
        role: updated.role,
        planId: updated.planId,
        planName: updated.planName,
        subdomain: updated.subdomain
      } : null
    });
  } catch (err) {
    console.error('[Profile] Could not update account profile:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/oneprofile/summary', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);
    const sessionData = token ? await MasterDB.getSession(token, req) : null;
    const userId = sessionData?.user?.id || req.activeUser?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    await queryPg(
      `INSERT INTO system_oneprofile_profiles (user_id)
       VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const [profile, websites, domains, notifications, counts] = await Promise.all([
      queryPg(
        `SELECT headline, bio, public_slug, profile_visibility, created_at, updated_at
         FROM system_oneprofile_profiles WHERE user_id = $1`,
        [userId]
      ),
      queryPg(
        `SELECT id, domain, title, template_id, status, view_count, created_at, updated_at
         FROM system_oneprofile_websites WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
      ),
      queryPg(
        `SELECT id, subdomain, domain, status, created_at, updated_at
         FROM system_free_subdomains WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      queryPg(
        `SELECT id, notification_type, title, body, read_at, created_at
         FROM system_oneprofile_notifications WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [userId]
      ),
      queryPg(
        `SELECT
           (SELECT COUNT(*)::int FROM system_oneprofile_websites WHERE user_id = $1) AS websites,
           (SELECT COUNT(*)::int FROM system_free_subdomains WHERE user_id = $1 AND status = 'active') AS domains,
           (SELECT COALESCE(SUM(view_count), 0)::bigint FROM system_oneprofile_websites WHERE user_id = $1) AS views,
           (SELECT COUNT(*)::int FROM system_oneprofile_notifications WHERE user_id = $1 AND read_at IS NULL) AS unread_notifications`,
        [userId]
      )
    ]);
    res.json({
      success: true,
      profile: profile.rows[0] || null,
      websites: websites.rows,
      domains: domains.rows,
      notifications: notifications.rows,
      metrics: counts.rows[0]
    });
  } catch (error) {
    console.error('OneProfile summary error:', error);
    res.status(500).json({ error: 'Failed to fetch OneProfile data' });
  }
});

router.put('/oneprofile/profile', async (req, res) => {
  try {
    const token = getRequestSessionToken(req);
    const sessionData = token ? await MasterDB.getSession(token, req) : null;
    const userId = sessionData?.user?.id || req.activeUser?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const headline = typeof req.body?.headline === 'string' ? req.body.headline.trim() : '';
    const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim() : '';
    const visibility = req.body?.profileVisibility === 'public' ? 'public' : 'private';
    if (headline.length > 255 || bio.length > 5000) {
      return res.status(422).json({ error: 'Profile text exceeds the allowed length' });
    }

    const result = await queryPg(
      `INSERT INTO system_oneprofile_profiles (user_id, headline, bio, profile_visibility)
       VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), $4)
       ON CONFLICT (user_id) DO UPDATE SET
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         profile_visibility = EXCLUDED.profile_visibility,
         updated_at = CURRENT_TIMESTAMP
       RETURNING headline, bio, public_slug, profile_visibility, created_at, updated_at`,
      [userId, headline, bio, visibility]
    );
    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('OneProfile profile update error:', error);
    res.status(500).json({ error: 'Failed to update OneProfile profile' });
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
