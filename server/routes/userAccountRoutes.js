import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { MasterDB } from '../db/multiTenant.js';
import { queryPg, isPgActive } from '../db/postgres.js';
import { readState, saveState } from '../db/stateDocuments.js';
import { createTemporaryFileStorage } from '../db/temporaryFileStorage.js';
import { getPublicMediaUrl, inferMediaType, storeMedia } from '../db/mediaStorage.js';
import {
  generateSecureOtp,
  verifySecureOtp,
  sendTwoFactorOtpEmail
} from '../db/emailService.js';
import {
  hashPasswordWithRust,
  verifyPasswordWithRust
} from '../security/rustAuthSessionClient.js';
import { scanAndSanitizeImage } from '../security/index.js';
import { normalizeSignupEmail, normalizePhoneIdentifier } from '../security/signupIdentity.js';
import { SocialDB } from '../social/socialDb.js';
import { logActivity } from '../db/storeDataAdapter.js';

export const USER_ACCOUNT_OTP_PURPOSE = 'user_account_settings';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const OTP_EXPIRY_MINUTES = 10;

export const DEFAULT_ACCOUNT_PREFERENCES = Object.freeze({
  emailNotifications: true,
  securityAlerts: true,
  marketingEmails: false,
  currency: 'USD',
  timezone: 'Asia/Dhaka',
  requireOtp: false
});

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);

const avatarStorage = multer.diskStorage(createTemporaryFileStorage('user-avatar'));

export function getRequestSessionToken(req) {
  const authHeader = req?.headers?.authorization;
  return req?.cookies?.tiwlo_host_session ||
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null) ||
    req?.headers?.['x-session-token'] ||
    null;
}

export function maskEmail(email) {
  const clean = String(email || '').trim();
  if (!clean || !clean.includes('@')) return clean;
  const [localPart, domain] = clean.split('@');
  if (!localPart || !domain) return clean;
  if (localPart.length <= 2) return `${localPart[0]}***@${domain}`;
  return `${localPart[0]}${'*'.repeat(Math.max(3, localPart.length - 2))}${localPart[localPart.length - 1]}@${domain}`;
}

export function isValidAvatarUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 4096) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(trimmed)) return false;

  if (
    trimmed.startsWith('/api/upload/') ||
    trimmed.startsWith('/api/uploads/') ||
    trimmed.startsWith('/upload/') ||
    trimmed.startsWith('/uploads/')
  ) {
    return !trimmed.split('/').some(segment => segment === '.' || segment === '..');
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidBirthDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    parsed <= new Date();
}

export function validateImageMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { valid: false, format: null };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { valid: true, format: 'image/png' };
  }
  // GIF87a / GIF89a
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return { valid: true, format: 'image/gif' };
  }
  // WebP: RIFF....WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { valid: true, format: 'image/webp' };
  }
  // AVIF: ....ftypavif / ....ftypavis
  if (
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))
  ) {
    return { valid: true, format: 'image/avif' };
  }

  return { valid: false, format: null };
}

export function normalizeAccountPreferences(raw = {}, base = DEFAULT_ACCOUNT_PREFERENCES) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const fallback = base && typeof base === 'object' ? base : DEFAULT_ACCOUNT_PREFERENCES;

  const currency = typeof source.currency === 'string' && source.currency.trim()
    ? source.currency.trim().slice(0, 16)
    : (fallback.currency || DEFAULT_ACCOUNT_PREFERENCES.currency);
  const timezone = typeof source.timezone === 'string' && source.timezone.trim()
    ? source.timezone.trim().slice(0, 64)
    : (fallback.timezone || DEFAULT_ACCOUNT_PREFERENCES.timezone);

  return {
    emailNotifications: source.emailNotifications !== undefined
      ? Boolean(source.emailNotifications)
      : Boolean(fallback.emailNotifications ?? DEFAULT_ACCOUNT_PREFERENCES.emailNotifications),
    securityAlerts: source.securityAlerts !== undefined
      ? Boolean(source.securityAlerts)
      : Boolean(fallback.securityAlerts ?? DEFAULT_ACCOUNT_PREFERENCES.securityAlerts),
    marketingEmails: source.marketingEmails !== undefined
      ? Boolean(source.marketingEmails)
      : Boolean(fallback.marketingEmails ?? DEFAULT_ACCOUNT_PREFERENCES.marketingEmails),
    currency,
    timezone,
    requireOtp: source.requireOtp !== undefined
      ? Boolean(source.requireOtp)
      : Boolean(fallback.requireOtp ?? DEFAULT_ACCOUNT_PREFERENCES.requireOtp)
  };
}

export function hasSensitiveAccountChange(user = {}, payload = {}, existingPreferences = DEFAULT_ACCOUNT_PREFERENCES) {
  if (!payload || typeof payload !== 'object') return false;

  if (payload.requireOtp === true || existingPreferences?.requireOtp === true) {
    return true;
  }

  if (
    payload.preferences &&
    typeof payload.preferences === 'object' &&
    payload.preferences.requireOtp !== undefined &&
    Boolean(payload.preferences.requireOtp) !== Boolean(existingPreferences?.requireOtp)
  ) {
    return true;
  }

  if (payload.email !== undefined) {
    const nextEmail = normalizeSignupEmail(payload.email);
    const currentEmail = normalizeSignupEmail(user.email || '');
    if (nextEmail && nextEmail !== currentEmail) {
      return true;
    }
  }

  if (typeof payload.newPassword === 'string' && payload.newPassword.length > 0) {
    return true;
  }

  if (payload.twoFactorEnabled !== undefined && Boolean(payload.twoFactorEnabled) !== Boolean(user.twoFactorEnabled)) {
    return true;
  }

  if (payload.phone !== undefined) {
    const nextPhone = String(payload.phone || '').trim();
    const currentPhone = String(user.phone || '').trim();
    const nextNorm = normalizePhoneIdentifier(nextPhone) || nextPhone;
    const currNorm = normalizePhoneIdentifier(currentPhone) || currentPhone;
    if (nextNorm !== currNorm) {
      return true;
    }
  }

  return false;
}

export function toSafeUserProfile(user) {
  if (!user) return null;
  const dateOfBirthRaw = user.dateOfBirth ? String(user.dateOfBirth) : '';
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}/.test(dateOfBirthRaw)
    ? dateOfBirthRaw.slice(0, 10)
    : '';

  return {
    id: user.id,
    tiwiId: user.tiwiId || user.storeId || '',
    storeId: user.tiwiId || user.storeId || '',
    name: user.name || '',
    storeName: user.storeName || '',
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.avatar || '',
    coverPhoto: user.coverPhoto || '',
    address: user.address || '',
    dateOfBirth,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    emailVerified: Boolean(user.emailVerified),
    identityVerified: Boolean(user.identityVerified),
    authMethod: user.authMethod || 'credentials',
    role: user.role || 'owner',
    planId: user.planId || 'free',
    planName: user.planName || 'Free Starter',
    subdomain: user.subdomain || '',
    hasPassword: Boolean(user.password)
  };
}

export function hashSessionIdentifier(tokenValue) {
  return crypto
    .createHash('sha256')
    .update(String(tokenValue || ''))
    .digest('hex')
    .slice(0, 24);
}

export function summarizeDeviceFromUserAgent(userAgent = '') {
  const ua = String(userAgent || '');
  if (!ua) return 'Unknown device';

  let os = 'Unknown OS';
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/curl|node|undici/i.test(ua)) browser = 'API Client';

  return `${browser} on ${os}`;
}

export function createUserAccountRouter(overrides = {}) {
  const router = express.Router();
  const deps = {
    masterDb: MasterDB,
    socialDb: SocialDB,
    queryPg,
    isPgActive,
    readState,
    saveState,
    generateSecureOtp,
    verifySecureOtp,
    sendTwoFactorOtpEmail,
    hashPasswordWithRust,
    verifyPasswordWithRust,
    scanAndSanitizeImage,
    storeMedia,
    getPublicMediaUrl,
    logActivity,
    ...overrides
  };

  const inMemoryOtpFallback = new Map();
  const inMemoryPrefsFallback = new Map();

  async function requireAuthenticatedUser(req, res, next) {
    try {
      const token = getRequestSessionToken(req);
      if (!token || token === '[object Object]') {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const sessionData = await deps.masterDb.getSession(token, req);
      if (!sessionData?.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (sessionData.user.isBanned) {
        return res.status(403).json({ error: 'This Tiwlo account is disabled.' });
      }
      req.accountSessionToken = token;
      req.accountUser = sessionData.user;
      return next();
    } catch (error) {
      console.error('[UserAccount] Session resolution error:', error.message);
      return res.status(401).json({ error: 'Authentication required' });
    }
  }

  async function loadUserPreferences(userId) {
    const key = String(userId);
    try {
      const stored = await deps.readState('user_account_preferences', key, DEFAULT_ACCOUNT_PREFERENCES);
      return {
        preferences: normalizeAccountPreferences(stored, DEFAULT_ACCOUNT_PREFERENCES),
        snapshotSource: stored
      };
    } catch {
      const cached = inMemoryPrefsFallback.get(key) || DEFAULT_ACCOUNT_PREFERENCES;
      return {
        preferences: normalizeAccountPreferences(cached, DEFAULT_ACCOUNT_PREFERENCES),
        snapshotSource: null
      };
    }
  }

  async function persistUserPreferences(userId, nextPreferences, snapshotSource) {
    const key = String(userId);
    const normalized = normalizeAccountPreferences(nextPreferences, DEFAULT_ACCOUNT_PREFERENCES);
    inMemoryPrefsFallback.set(key, normalized);
    try {
      if (snapshotSource) {
        await deps.saveState('user_account_preferences', key, normalized, snapshotSource);
      } else {
        const current = await deps.readState('user_account_preferences', key, DEFAULT_ACCOUNT_PREFERENCES);
        await deps.saveState('user_account_preferences', key, normalized, current);
      }
    } catch (error) {
      if (deps.isPgActive()) {
        throw error;
      }
    }
    return normalized;
  }

  async function storeOtpChallenge(userId, challenge) {
    const key = String(userId);
    inMemoryOtpFallback.set(key, challenge);
    try {
      const existing = await deps.readState('user_account_otp', key, {});
      await deps.saveState('user_account_otp', key, challenge, existing);
    } catch {
      // Fallback map already holds challenge if PG state doc isn't active in unit tests
    }
  }

  async function loadOtpChallenge(userId) {
    const key = String(userId);
    try {
      const stored = await deps.readState('user_account_otp', key, {});
      if (stored && stored.token) return stored;
    } catch {
      // ignore and fall back to memory map
    }
    return inMemoryOtpFallback.get(key) || null;
  }

  async function clearOtpChallenge(userId) {
    const key = String(userId);
    inMemoryOtpFallback.delete(key);
    try {
      const existing = await deps.readState('user_account_otp', key, {});
      await deps.saveState('user_account_otp', key, {}, existing);
    } catch {
      // ignore
    }
  }

  async function listUserSessions(userId, currentToken) {
    const currentHash = crypto.createHash('sha256').update(String(currentToken || '')).digest('hex');
    try {
      const result = await deps.queryPg(
        `SELECT COALESCE(NULLIF(session_token, ''), token) AS token_ref,
                ip, user_agent, created_at, expires_at
         FROM system_sessions
         WHERE user_id = $1
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         ORDER BY created_at DESC
         LIMIT 25`,
        [String(userId)]
      );
      return (result?.rows || []).map((row) => {
        const ref = String(row.token_ref || '');
        const isCurrent = Boolean(
          currentToken &&
          (ref === currentToken || ref === currentHash)
        );
        return {
          id: hashSessionIdentifier(ref),
          ip: row.ip || 'Unknown IP',
          userAgent: row.user_agent || '',
          device: summarizeDeviceFromUserAgent(row.user_agent),
          createdAt: row.created_at || null,
          expiresAt: row.expires_at || null,
          isCurrent
        };
      });
    } catch {
      return [];
    }
  }

  async function readSecurityStatus(userId) {
    try {
      const result = await deps.queryPg(
        `SELECT strikes, cooldown_until, permanently_disabled, last_reason, updated_at
         FROM system_account_security
         WHERE user_id = $1
         LIMIT 1`,
        [String(userId)]
      );
      const row = result?.rows?.[0];
      if (!row) {
        return {
          strikes: 0,
          cooldownUntil: null,
          permanentlyDisabled: false,
          lastReason: null,
          updatedAt: null
        };
      }
      return {
        strikes: Number(row.strikes || 0),
        cooldownUntil: row.cooldown_until || null,
        permanentlyDisabled: Boolean(row.permanently_disabled),
        lastReason: row.last_reason || null,
        updatedAt: row.updated_at || null
      };
    } catch {
      return {
        strikes: 0,
        cooldownUntil: null,
        permanentlyDisabled: false,
        lastReason: null,
        updatedAt: null
      };
    }
  }

  async function touchAccountSecurityRecord(userId) {
    try {
      await deps.queryPg(
        `INSERT INTO system_account_security (user_id, updated_at)
         VALUES ($1, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`,
        [String(userId)]
      );
    } catch {
      // Non-fatal in isolated test environments without PG
    }
  }

  const upload = multer({
    storage: avatarStorage,
    limits: { fileSize: MAX_AVATAR_BYTES },
    fileFilter: (_req, file, callback) => {
      const mime = String(file?.mimetype || '').toLowerCase();
      if (!ALLOWED_AVATAR_MIME_TYPES.has(mime)) {
        const err = new Error('Only JPG, PNG, WebP, GIF, or AVIF image files are accepted.');
        err.statusCode = 415;
        return callback(err);
      }
      return callback(null, true);
    }
  });

  function handleAvatarMulter(req, res, next) {
    upload.single('avatar')(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Profile photo must be 5 MB or smaller.' });
      }
      return res.status(err.statusCode || 400).json({ error: err.message || 'Invalid image upload.' });
    });
  }

  // 1. GET /user/account/settings
  router.get('/user/account/settings', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const [{ preferences }, sessions, security] = await Promise.all([
        loadUserPreferences(user.id),
        listUserSessions(user.id, req.accountSessionToken),
        readSecurityStatus(user.id)
      ]);

      return res.json({
        success: true,
        user: toSafeUserProfile(user),
        preferences,
        security,
        sessions
      });
    } catch (error) {
      console.error('[UserAccount] Failed to load account settings:', error.message);
      return res.status(500).json({ error: 'Failed to load account settings.' });
    }
  });

  // 2. POST /user/account/avatar
  router.post('/user/account/avatar', requireAuthenticatedUser, handleAvatarMulter, async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Please select an image file to upload.' });
    }

    try {
      const rawBuffer = await fs.promises.readFile(file.path);
      if (rawBuffer.length > MAX_AVATAR_BYTES) {
        return res.status(413).json({ error: 'Profile photo must be 5 MB or smaller.' });
      }

      const magic = validateImageMagicBytes(rawBuffer);
      if (!magic.valid) {
        return res.status(415).json({ error: 'Invalid or corrupted image file. Only JPG, PNG, WebP, GIF, or AVIF images are allowed.' });
      }

      const contentType = inferMediaType(file.filename) !== 'application/octet-stream'
        ? inferMediaType(file.filename)
        : magic.format;

      const scanResult = await deps.scanAndSanitizeImage(rawBuffer, 'user_avatar', file.originalname);
      if (scanResult.isVideo || !scanResult.safe) {
        return res.status(scanResult.isVideo ? 415 : 400).json({
          error: scanResult.reason || 'Uploaded image failed safety verification.'
        });
      }

      const uploadPath = `/uploads/${file.filename}`;
      await deps.storeMedia({
        aliases: [uploadPath],
        buffer: scanResult.sanitizedBuffer || rawBuffer,
        contentType,
        originalFilename: file.originalname,
        ownerId: req.accountUser.id,
        purpose: 'user_avatar'
      });

      const avatar = await deps.getPublicMediaUrl(uploadPath);
      const updatedUser = await deps.masterDb.updateUser(req.accountUser.id, { avatar });
      try {
        await deps.socialDb.updateProfile(req.accountUser.id, { avatar });
      } catch (socialErr) {
        console.warn('[UserAccount] Social profile avatar sync warning:', socialErr.message);
      }

      return res.json({
        success: true,
        avatar,
        user: toSafeUserProfile(updatedUser || { ...req.accountUser, avatar })
      });
    } catch (error) {
      console.error('[UserAccount] Avatar upload failed:', error.message);
      return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to upload profile photo.' });
    } finally {
      if (file?.path) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
    }
  });

  // 3. POST /user/account/otp-request
  router.post('/user/account/otp-request', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const verifiedEmail = normalizeSignupEmail(user.email || '');
      if (!verifiedEmail) {
        return res.status(400).json({ error: 'A verified account email is required to send an OTP code.' });
      }

      const otp = await deps.generateSecureOtp(verifiedEmail, USER_ACCOUNT_OTP_PURPOSE, OTP_EXPIRY_MINUTES);
      await storeOtpChallenge(user.id, {
        token: otp.token,
        userId: user.id,
        email: verifiedEmail,
        purpose: USER_ACCOUNT_OTP_PURPOSE,
        expiresAt: otp.expiresAt || Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
      });

      const delivery = await deps.sendTwoFactorOtpEmail({
        to: verifiedEmail,
        name: user.name || user.storeName || 'Tiwlo User',
        code: otp.code
      });

      if (delivery && delivery.success === false) {
        return res.status(502).json({ error: delivery.error || 'Failed to deliver Email OTP.' });
      }

      const expiresInSeconds = otp.expiresAt
        ? Math.max(60, Math.round((Number(otp.expiresAt) - Date.now()) / 1000))
        : OTP_EXPIRY_MINUTES * 60;

      return res.json({
        success: true,
        otpToken: otp.token,
        expiresInSeconds,
        maskedEmail: maskEmail(verifiedEmail)
      });
    } catch (error) {
      console.error('[UserAccount] OTP request failed:', error.message);
      return res.status(500).json({ error: 'Failed to send Email OTP.' });
    }
  });

  // 4. PUT /user/account/settings
  router.put('/user/account/settings', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { preferences: existingPreferences, snapshotSource } = await loadUserPreferences(user.id);

      const updates = {};
      if (body.name !== undefined) {
        const cleanName = String(body.name || '').trim();
        if (!cleanName || cleanName.length > 120) {
          return res.status(422).json({ error: 'Display name must be between 1 and 120 characters.' });
        }
        updates.name = cleanName;
      }

      if (body.storeName !== undefined) {
        const cleanStore = String(body.storeName || '').trim();
        if (!cleanStore || cleanStore.length > 120) {
          return res.status(422).json({ error: 'Store / workspace name must be between 1 and 120 characters.' });
        }
        updates.storeName = cleanStore;
      }

      if (body.phone !== undefined) {
        const cleanPhone = String(body.phone || '').trim();
        if (cleanPhone.length > 32) {
          return res.status(422).json({ error: 'Phone number must be 32 characters or fewer.' });
        }
        updates.phone = cleanPhone;
      }

      if (body.address !== undefined) {
        if (typeof body.address !== 'string' || body.address.trim().length > 2000) {
          return res.status(422).json({ error: 'Address must be 2,000 characters or fewer.' });
        }
        updates.address = body.address.trim();
      }

      if (body.dateOfBirth !== undefined) {
        const cleanDob = String(body.dateOfBirth || '').trim();
        if (!isValidBirthDate(cleanDob)) {
          return res.status(422).json({ error: 'Enter a valid date of birth that is not in the future.' });
        }
        updates.dateOfBirth = cleanDob;
      }

      if (body.avatar !== undefined) {
        if (body.avatar === '') {
          // ignore empty avatar clearing unless explicitly non-empty
        } else if (!isValidAvatarUrl(body.avatar)) {
          return res.status(422).json({ error: 'Profile photo URL is invalid.' });
        } else {
          updates.avatar = body.avatar.trim();
        }
      }

      if (body.email !== undefined) {
        const cleanEmail = normalizeSignupEmail(body.email);
        if (!cleanEmail) {
          return res.status(422).json({ error: 'Enter a valid email address.' });
        }
        if (cleanEmail !== normalizeSignupEmail(user.email || '')) {
          updates.email = cleanEmail;
        }
      }

      if (body.twoFactorEnabled !== undefined) {
        updates.twoFactorEnabled = Boolean(body.twoFactorEnabled);
      }

      const wantsPasswordChange = typeof body.newPassword === 'string' && body.newPassword.length > 0;
      if (wantsPasswordChange) {
        if (body.newPassword.length < 6 || body.newPassword.length > 128) {
          return res.status(422).json({ error: 'New password must be between 6 and 128 characters.' });
        }
      }

      const requiresOtp = hasSensitiveAccountChange(user, body, existingPreferences);
      let verifiedOtpChallenge = null;
      if (requiresOtp) {
        const otpCode = String(body.otpCode || '').trim();
        if (!/^\d{6}$/.test(otpCode)) {
          return res.status(403).json({
            error: 'Email OTP verification required to save account changes.',
            requiresOtp: true
          });
        }

        const storedChallenge = await loadOtpChallenge(user.id);
        const challengeToken = String(body.otpToken || storedChallenge?.token || '').trim();
        if (!challengeToken || !storedChallenge || storedChallenge.userId !== user.id || storedChallenge.purpose !== USER_ACCOUNT_OTP_PURPOSE) {
          return res.status(403).json({
            error: 'Email OTP verification required to save account changes.',
            requiresOtp: true
          });
        }
        if (body.otpToken && storedChallenge.token && body.otpToken !== storedChallenge.token) {
          return res.status(403).json({
            error: 'Email OTP verification required to save account changes.',
            requiresOtp: true
          });
        }
        if (storedChallenge.expiresAt && Number(storedChallenge.expiresAt) < Date.now()) {
          return res.status(403).json({
            error: 'Email OTP has expired. Please request a new code.',
            requiresOtp: true
          });
        }
        verifiedOtpChallenge = { challengeToken, otpCode };
      }

      if (wantsPasswordChange && user.password) {
        const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to set a new password.' });
        }
        const passwordCheck = await deps.verifyPasswordWithRust(user.id, currentPassword);
        if (!passwordCheck?.valid) {
          return res.status(401).json({ error: 'Current password is incorrect.' });
        }
      }

      if (verifiedOtpChallenge) {
        const otpCheck = await deps.verifySecureOtp(
          verifiedOtpChallenge.challengeToken,
          verifiedOtpChallenge.otpCode,
          USER_ACCOUNT_OTP_PURPOSE
        );
        const expectedEmail = normalizeSignupEmail(user.email || '');
        if (!otpCheck?.valid || (otpCheck.email && normalizeSignupEmail(otpCheck.email) !== expectedEmail)) {
          return res.status(403).json({
            error: otpCheck?.error || 'Email OTP verification required to save account changes.',
            requiresOtp: true
          });
        }

        await clearOtpChallenge(user.id);
      }

      if (wantsPasswordChange) {
        const hashedPassword = await deps.hashPasswordWithRust(body.newPassword);
        await deps.masterDb.updatePasswordAndRevokeSessions(
          user.id,
          hashedPassword,
          req.accountSessionToken
        );
      }

      let updatedUser = user;
      if (Object.keys(updates).length > 0) {
        updatedUser = (await deps.masterDb.updateUser(user.id, updates)) || { ...user, ...updates };
        const socialFields = {};
        if (updates.name) socialFields.name = updates.name;
        if (updates.avatar) socialFields.avatar = updates.avatar;
        if (updates.phone !== undefined) socialFields.phone = updates.phone;
        if (Object.keys(socialFields).length > 0) {
          try {
            await deps.socialDb.updateProfile(user.id, socialFields);
          } catch (socialErr) {
            console.warn('[UserAccount] Social profile sync warning:', socialErr.message);
          }
        }
      }

      const nextPreferences = body.preferences !== undefined || body.requireOtp !== undefined
        ? await persistUserPreferences(
            user.id,
            {
              ...(body.preferences && typeof body.preferences === 'object' ? body.preferences : {}),
              ...(body.requireOtp !== undefined ? { requireOtp: Boolean(body.requireOtp) } : {})
            },
            snapshotSource
          )
        : existingPreferences;

      await touchAccountSecurityRecord(user.id);

      try {
        await deps.logActivity(
          'security',
          'Account settings updated',
          `User ${updatedUser.email || user.email} updated account settings`,
          updatedUser.tiwiId || user.tiwiId || null
        );
      } catch {
        // Activity logging should not break settings save
      }

      return res.json({
        success: true,
        user: toSafeUserProfile(updatedUser),
        preferences: nextPreferences
      });
    } catch (error) {
      if (error?.code === 'DUPLICATE_ACCOUNT' || /already registered/i.test(error?.message || '')) {
        return res.status(409).json({ error: 'That email address is already linked to another account.' });
      }
      console.error('[UserAccount] Failed to save account settings:', error.message);
      return res.status(500).json({ error: error.message || 'Failed to update account settings.' });
    }
  });

  // 5. POST /user/account/sessions/revoke
  router.post('/user/account/sessions/revoke', requireAuthenticatedUser, async (req, res) => {
    try {
      const user = req.accountUser;
      const scope = req.body?.scope === 'others' ? 'others' : 'single';
      const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';

      if (scope === 'others') {
        await deps.masterDb.revokeUserSessions(user.id, req.accountSessionToken);
      } else if (sessionId) {
        const result = await deps.queryPg(
          `SELECT token, session_token
           FROM system_sessions
           WHERE user_id = $1`,
          [String(user.id)]
        );
        const match = (result?.rows || []).find((row) => {
          const ref = String(row.session_token || row.token || '');
          return hashSessionIdentifier(ref) === sessionId;
        });
        if (!match) {
          return res.status(404).json({ error: 'Session not found.' });
        }
        await deps.queryPg(
          `DELETE FROM system_sessions
           WHERE user_id = $1 AND (token = $2 OR session_token = $3)`,
          [String(user.id), match.token || '', match.session_token || '']
        );
      } else {
        return res.status(400).json({ error: 'Specify a sessionId or scope: "others".' });
      }

      const sessions = await listUserSessions(user.id, req.accountSessionToken);
      return res.json({ success: true, sessions });
    } catch (error) {
      console.error('[UserAccount] Failed to revoke sessions:', error.message);
      return res.status(500).json({ error: 'Failed to revoke sessions.' });
    }
  });

  return router;
}

export default createUserAccountRouter();
