import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import QRCode from 'qrcode';
import { MasterDB } from '../db/multiTenant.js';
import { queryPg, isPgActive } from '../db/postgres.js';
import { readState, saveState } from '../db/stateDocuments.js';
import { createTemporaryFileStorage } from '../db/temporaryFileStorage.js';
import { getPublicMediaUrl, inferMediaType, storeMedia } from '../db/mediaStorage.js';
import {
  generateSecureOtp,
  verifySecureOtp,
  sendTwoFactorOtpEmail,
  sendTiwloEmail,
  identityVerificationEmailNotifications
} from '../db/emailService.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { renderBaseEmail } from '../email/index.js';
import { getPlatformUrl } from '../config/platformConfig.js';
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

export const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  emailSecurityAlerts: true,
  loginAlerts: true,
  orderAlerts: true,
  billingAlerts: true,
  teamInviteAlerts: true,
  productUpdates: false,
  digestFrequency: 'realtime'
});

export const DEFAULT_WIDGET_ORDER = Object.freeze([
  'hero',
  'metrics',
  'active-services',
  'performance',
  'droplets',
  'overview-services',
  'quick-access'
]);

export const DEFAULT_WIDGET_CONFIG = Object.freeze({
  showQuickStats: true,
  showRecentActivity: true,
  showRevenueChart: true,
  showStoreHealth: true,
  showTeamActivity: true,
  compactDensity: false,
  widgetOrder: [...DEFAULT_WIDGET_ORDER]
});

export const VALID_DIGEST_FREQUENCIES = new Set(['realtime', 'daily', 'weekly']);

export const TEAM_PERMISSION_CATALOG = Object.freeze([
  { key: 'products', label: 'Products & Catalog', description: 'Create, edit, and organize store products and collections.' },
  { key: 'orders', label: 'Orders & Fulfillment', description: 'View, process, and update customer orders and shipments.' },
  { key: 'inventory', label: 'Inventory & Stock', description: 'Manage stock levels, warehouses, and inventory adjustments.' },
  { key: 'pos', label: 'Point of Sale (POS)', description: 'Operate POS registers and in-person checkout sessions.' },
  { key: 'analytics', label: 'Analytics & Reports', description: 'View sales analytics, conversion metrics, and reports.' },
  { key: 'store_settings', label: 'Store Settings', description: 'Configure store profile, checkout, and storefront preferences.' },
  { key: 'cloud_droplets', label: 'Cloud & Droplets', description: 'View and manage cloud servers and infrastructure droplets.' },
  { key: 'domains', label: 'Domains & DNS', description: 'Manage custom domains, SSL certificates, and DNS records.' },
  { key: 'billing_view', label: 'Billing (View Only)', description: 'View invoices, subscription status, and billing history.' },
  { key: 'support_tickets', label: 'Support Tickets', description: 'Create and respond to Tiwlo support tickets.' },
  { key: 'team_view', label: 'Team Directory (View)', description: 'View assigned staff members and their access roles.' }
]);

const VALID_TEAM_PERMISSION_KEYS = new Set(TEAM_PERMISSION_CATALOG.map((item) => item.key));

export const TEAM_ROLE_PRESETS = Object.freeze({
  manager: {
    key: 'manager',
    label: 'Store Manager',
    description: 'Broad operational access across store, orders, inventory, analytics, and team view.',
    permissions: ['products', 'orders', 'inventory', 'pos', 'analytics', 'store_settings', 'cloud_droplets', 'domains', 'billing_view', 'support_tickets', 'team_view']
  },
  catalog_editor: {
    key: 'catalog_editor',
    label: 'Catalog Editor',
    description: 'Manage products, collections, and stock levels.',
    permissions: ['products', 'inventory']
  },
  order_operator: {
    key: 'order_operator',
    label: 'Order Operator',
    description: 'Handle orders, fulfillment, POS checkout, and stock checks.',
    permissions: ['orders', 'inventory', 'pos']
  },
  support_agent: {
    key: 'support_agent',
    label: 'Support Agent',
    description: 'Assist customers with orders and handle support tickets.',
    permissions: ['orders', 'support_tickets']
  },
  analyst: {
    key: 'analyst',
    label: 'Business Analyst',
    description: 'Read-only visibility into analytics, orders, and billing.',
    permissions: ['analytics', 'orders', 'billing_view']
  },
  custom: {
    key: 'custom',
    label: 'Custom Role',
    description: 'Tailored set of permissions selected by the account owner.',
    permissions: []
  }
});

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PROCESS_FALLBACK_TOTP_KEY = crypto.randomBytes(32);

export function encodeBase32(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

export function decodeBase32(input) {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[\s=-]+/g, '');
  if (!clean) return Buffer.alloc(0);
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid Base32 character in TOTP secret.');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secretBase32, timestampMs = Date.now(), stepSeconds = 30, digits = 6) {
  const key = decodeBase32(secretBase32);
  if (key.length === 0) {
    throw new Error('TOTP secret cannot be empty.');
  }
  const counter = BigInt(Math.floor(timestampMs / 1000 / stepSeconds));
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter, 0);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, '0');
}

export function verifyTotpCode(secretBase32, code, { timestampMs = Date.now(), stepSeconds = 30, window = 1, digits = 6 } = {}) {
  const cleanCode = String(code ?? '').replace(/\s+/g, '');
  if (!new RegExp(`^\\d{${digits}}$`).test(cleanCode)) {
    return { valid: false, delta: null };
  }
  const providedBuf = Buffer.from(cleanCode, 'utf8');
  for (let delta = -window; delta <= window; delta += 1) {
    const expected = generateTotpCode(
      secretBase32,
      timestampMs + delta * stepSeconds * 1000,
      stepSeconds,
      digits
    );
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return { valid: true, delta };
    }
  }
  return { valid: false, delta: null };
}

function getTotpCipherKey(secretOverride = null) {
  const configured = secretOverride || process.env.SECURITY_SECRET || process.env.SESSION_SECRET || '';
  if (configured.length >= 16) {
    return crypto.createHash('sha256').update(`tiwlo-totp-secret-v1:${configured}`).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY_SECRET must be configured in production for TOTP secret encryption.');
  }
  return PROCESS_FALLBACK_TOTP_KEY;
}

export function encryptTotpSecret(plainSecret, secretOverride = null) {
  const key = getTotpCipherKey(secretOverride);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainSecret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptTotpSecret(wrapped, secretOverride = null) {
  if (!wrapped || typeof wrapped !== 'string') return null;
  const parts = wrapped.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') return null;
  const [, , ivHex, tagHex, dataHex] = parts;
  const key = getTotpCipherKey(secretOverride);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

export function generateRecoveryCodes(count = 8, length = 8) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    let code = '';
    for (let j = 0; j < length; j += 1) {
      code += RECOVERY_CODE_ALPHABET[crypto.randomInt(0, RECOVERY_CODE_ALPHABET.length)];
    }
    codes.push(code);
  }
  return codes;
}

export function normalizeRecoveryCode(code) {
  return String(code || '').trim().replace(/[\s-]+/g, '').toUpperCase();
}

export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

function matchAndConsumeRecoveryHash(recoveryCodeHashes, candidateCode) {
  const normalized = normalizeRecoveryCode(candidateCode);
  if (!/^[A-Z0-9]{6,16}$/.test(normalized) || !Array.isArray(recoveryCodeHashes) || recoveryCodeHashes.length === 0) {
    return { matched: false, remainingHashes: Array.isArray(recoveryCodeHashes) ? recoveryCodeHashes : [] };
  }
  const candidateHashBuf = Buffer.from(hashRecoveryCode(normalized), 'hex');
  let matchedIdx = -1;
  for (let i = 0; i < recoveryCodeHashes.length; i += 1) {
    const stored = String(recoveryCodeHashes[i] || '');
    if (stored.length !== 64) continue;
    const storedBuf = Buffer.from(stored, 'hex');
    if (storedBuf.length === candidateHashBuf.length && crypto.timingSafeEqual(storedBuf, candidateHashBuf)) {
      matchedIdx = i;
      break;
    }
  }
  if (matchedIdx === -1) {
    return { matched: false, remainingHashes: recoveryCodeHashes };
  }
  const remainingHashes = recoveryCodeHashes.filter((_, idx) => idx !== matchedIdx);
  return { matched: true, remainingHashes };
}

export function hashSecurityPin(pin) {
  const cleanPin = String(pin ?? '').trim();
  if (!/^\d{4,8}$/.test(cleanPin)) {
    throw new Error('Security PIN must be 4 to 8 digits.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(cleanPin, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifySecurityPinHash(pin, storedHash) {
  const cleanPin = String(pin ?? '').trim();
  if (!/^\d{4,8}$/.test(cleanPin) || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hex] = parts;
  if (!salt || !hex || hex.length !== 128) return false;
  const derived = crypto.scryptSync(cleanPin, salt, 64);
  const storedBuf = Buffer.from(hex, 'hex');
  return derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf);
}

export function normalizeExtendedAccountPrefs(raw = {}, base = {}) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const fb = base && typeof base === 'object' && !Array.isArray(base) ? base : {};

  const language = typeof src.language === 'string' && src.language.trim()
    ? src.language.trim().slice(0, 16)
    : (typeof fb.language === 'string' && fb.language.trim() ? fb.language.trim().slice(0, 16) : 'en');
  const timezone = typeof src.timezone === 'string' && src.timezone.trim()
    ? src.timezone.trim().slice(0, 64)
    : (typeof fb.timezone === 'string' && fb.timezone.trim() ? fb.timezone.trim().slice(0, 64) : DEFAULT_ACCOUNT_PREFERENCES.timezone);
  const currency = typeof src.currency === 'string' && src.currency.trim()
    ? src.currency.trim().slice(0, 16)
    : (typeof fb.currency === 'string' && fb.currency.trim() ? fb.currency.trim().slice(0, 16) : DEFAULT_ACCOUNT_PREFERENCES.currency);

  const srcNotif = src.notificationPrefs && typeof src.notificationPrefs === 'object' && !Array.isArray(src.notificationPrefs)
    ? src.notificationPrefs
    : {};
  const fbNotif = fb.notificationPrefs && typeof fb.notificationPrefs === 'object' && !Array.isArray(fb.notificationPrefs)
    ? fb.notificationPrefs
    : DEFAULT_NOTIFICATION_PREFS;

  const rawFreq = typeof srcNotif.digestFrequency === 'string'
    ? srcNotif.digestFrequency.trim().toLowerCase()
    : (fbNotif.digestFrequency || DEFAULT_NOTIFICATION_PREFS.digestFrequency);
  const digestFrequency = VALID_DIGEST_FREQUENCIES.has(rawFreq) ? rawFreq : DEFAULT_NOTIFICATION_PREFS.digestFrequency;

  const notificationPrefs = {
    emailSecurityAlerts: srcNotif.emailSecurityAlerts !== undefined
      ? Boolean(srcNotif.emailSecurityAlerts)
      : Boolean(fbNotif.emailSecurityAlerts ?? DEFAULT_NOTIFICATION_PREFS.emailSecurityAlerts),
    loginAlerts: srcNotif.loginAlerts !== undefined
      ? Boolean(srcNotif.loginAlerts)
      : Boolean(fbNotif.loginAlerts ?? DEFAULT_NOTIFICATION_PREFS.loginAlerts),
    orderAlerts: srcNotif.orderAlerts !== undefined
      ? Boolean(srcNotif.orderAlerts)
      : Boolean(fbNotif.orderAlerts ?? DEFAULT_NOTIFICATION_PREFS.orderAlerts),
    billingAlerts: srcNotif.billingAlerts !== undefined
      ? Boolean(srcNotif.billingAlerts)
      : Boolean(fbNotif.billingAlerts ?? DEFAULT_NOTIFICATION_PREFS.billingAlerts),
    teamInviteAlerts: srcNotif.teamInviteAlerts !== undefined
      ? Boolean(srcNotif.teamInviteAlerts)
      : Boolean(fbNotif.teamInviteAlerts ?? DEFAULT_NOTIFICATION_PREFS.teamInviteAlerts),
    productUpdates: srcNotif.productUpdates !== undefined
      ? Boolean(srcNotif.productUpdates)
      : Boolean(fbNotif.productUpdates ?? DEFAULT_NOTIFICATION_PREFS.productUpdates),
    digestFrequency
  };

  const srcWidget = src.widgetConfig && typeof src.widgetConfig === 'object' && !Array.isArray(src.widgetConfig)
    ? src.widgetConfig
    : {};
  const fbWidget = fb.widgetConfig && typeof fb.widgetConfig === 'object' && !Array.isArray(fb.widgetConfig)
    ? fb.widgetConfig
    : DEFAULT_WIDGET_CONFIG;

  const rawWidgetOrder = Array.isArray(srcWidget.widgetOrder)
    ? srcWidget.widgetOrder
    : (Array.isArray(fbWidget.widgetOrder) ? fbWidget.widgetOrder : DEFAULT_WIDGET_ORDER);
  const sanitizedWidgetOrder = [];
  for (const w of rawWidgetOrder) {
    const clean = String(w || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (clean && !sanitizedWidgetOrder.includes(clean)) sanitizedWidgetOrder.push(clean);
    if (sanitizedWidgetOrder.length >= 16) break;
  }

  const widgetConfig = {
    showQuickStats: srcWidget.showQuickStats !== undefined
      ? Boolean(srcWidget.showQuickStats)
      : Boolean(fbWidget.showQuickStats ?? DEFAULT_WIDGET_CONFIG.showQuickStats),
    showRecentActivity: srcWidget.showRecentActivity !== undefined
      ? Boolean(srcWidget.showRecentActivity)
      : Boolean(fbWidget.showRecentActivity ?? DEFAULT_WIDGET_CONFIG.showRecentActivity),
    showRevenueChart: srcWidget.showRevenueChart !== undefined
      ? Boolean(srcWidget.showRevenueChart)
      : Boolean(fbWidget.showRevenueChart ?? DEFAULT_WIDGET_CONFIG.showRevenueChart),
    showStoreHealth: srcWidget.showStoreHealth !== undefined
      ? Boolean(srcWidget.showStoreHealth)
      : Boolean(fbWidget.showStoreHealth ?? DEFAULT_WIDGET_CONFIG.showStoreHealth),
    showTeamActivity: srcWidget.showTeamActivity !== undefined
      ? Boolean(srcWidget.showTeamActivity)
      : Boolean(fbWidget.showTeamActivity ?? DEFAULT_WIDGET_CONFIG.showTeamActivity),
    compactDensity: srcWidget.compactDensity !== undefined
      ? Boolean(srcWidget.compactDensity)
      : Boolean(fbWidget.compactDensity ?? DEFAULT_WIDGET_CONFIG.compactDensity),
    widgetOrder: sanitizedWidgetOrder.length ? sanitizedWidgetOrder : [...DEFAULT_WIDGET_ORDER]
  };

  const hasSecurityPin = Boolean((src.hasSecurityPin ?? fb.hasSecurityPin) && (src.securityPinHash ?? fb.securityPinHash));
  const securityPinHash = src.securityPinHash !== undefined ? src.securityPinHash : (fb.securityPinHash || null);
  const pinUpdatedAt = src.pinUpdatedAt !== undefined ? src.pinUpdatedAt : (fb.pinUpdatedAt || null);

  return {
    language,
    timezone,
    currency,
    emailNotifications: src.emailNotifications !== undefined
      ? Boolean(src.emailNotifications)
      : Boolean(fb.emailNotifications ?? DEFAULT_ACCOUNT_PREFERENCES.emailNotifications),
    marketingEmails: src.marketingEmails !== undefined
      ? Boolean(src.marketingEmails)
      : Boolean(fb.marketingEmails ?? DEFAULT_ACCOUNT_PREFERENCES.marketingEmails),
    securityAlerts: src.securityAlerts !== undefined
      ? Boolean(src.securityAlerts)
      : Boolean(fb.securityAlerts ?? DEFAULT_ACCOUNT_PREFERENCES.securityAlerts),
    notificationPrefs,
    widgetConfig,
    hasSecurityPin,
    securityPinHash,
    pinUpdatedAt
  };
}

export function toPublicPreferencesResponse(prefsDoc) {
  const normalized = normalizeExtendedAccountPrefs(prefsDoc, {});
  return {
    preferences: {
      language: normalized.language,
      timezone: normalized.timezone,
      currency: normalized.currency,
      emailNotifications: normalized.emailNotifications,
      marketingEmails: normalized.marketingEmails,
      securityAlerts: normalized.securityAlerts,
      notificationPrefs: normalized.notificationPrefs,
      widgetConfig: normalized.widgetConfig
    },
    notificationPrefs: normalized.notificationPrefs,
    widgetConfig: normalized.widgetConfig,
    hasSecurityPin: Boolean(normalized.hasSecurityPin && normalized.securityPinHash),
    pinUpdatedAt: normalized.pinUpdatedAt || null
  };
}

function toSafeTeamMember(member) {
  if (!member || typeof member !== 'object') return null;
  const { inviteTokenHash: _hiddenTokenHash, ...safe } = member;
  return safe;
}

function normalizeStoreScope(scope) {
  if (scope === undefined || scope === null || scope === '') return 'all';
  if (Array.isArray(scope)) {
    const cleaned = [...new Set(scope.map((s) => String(s || '').trim().slice(0, 64)).filter(Boolean))].slice(0, 20);
    return cleaned.length > 0 ? cleaned : 'all';
  }
  return String(scope).trim().slice(0, 120) || 'all';
}

export async function getUserTwoFactorStatus(userId, user = null, depsOverride = {}) {
  const readFn = depsOverride.readState || readState;
  const key = String(userId || '');
  let totpDoc = {};
  try {
    totpDoc = await readFn('user_account_totp', key, {});
  } catch {
    totpDoc = {};
  }
  const totpEnabled = Boolean(totpDoc?.totpEnabled && totpDoc?.activeSecretEnc);
  const emailTwoFactorEnabled = totpDoc?.emailTwoFactorEnabled !== undefined
    ? Boolean(totpDoc.emailTwoFactorEnabled)
    : Boolean(user?.twoFactorEnabled) && !totpEnabled;
  const twoFactorEnabled = Boolean(user?.twoFactorEnabled ?? (totpEnabled || emailTwoFactorEnabled));
  const activeMethod = totpEnabled
    ? 'totp'
    : (emailTwoFactorEnabled || twoFactorEnabled ? 'email' : 'off');

  return {
    twoFactorEnabled,
    emailTwoFactorEnabled,
    totpEnabled,
    activeMethod,
    totpEnrolledAt: totpDoc?.enrolledAt || null,
    backupCodesRemaining: Array.isArray(totpDoc?.recoveryCodeHashes) ? totpDoc.recoveryCodeHashes.length : 0,
    hasPendingSetup: Boolean(totpDoc?.pendingSecretEnc)
  };
}

export async function verifyUserTotpOrRecoveryCode(userId, submittedCode, depsOverride = {}) {
  const readFn = depsOverride.readState || readState;
  const saveFn = depsOverride.saveState || saveState;
  const totpSecretOverride = depsOverride.totpEncryptionSecret || null;
  const key = String(userId || '');
  const code = String(submittedCode ?? '').trim();
  if (!key || !code) {
    return { valid: false, method: null };
  }

  let totpDoc;
  try {
    totpDoc = await readFn('user_account_totp', key, {});
  } catch {
    return { valid: false, method: null };
  }

  if (!totpDoc?.totpEnabled || !totpDoc?.activeSecretEnc) {
    return { valid: false, method: null };
  }

  const secret = decryptTotpSecret(totpDoc.activeSecretEnc, totpSecretOverride);
  if (secret && /^\d{6}$/.test(code.replace(/\s+/g, ''))) {
    const check = verifyTotpCode(secret, code);
    if (check.valid) {
      return {
        valid: true,
        method: 'totp',
        recoveryCodesRemaining: Array.isArray(totpDoc.recoveryCodeHashes) ? totpDoc.recoveryCodeHashes.length : 0
      };
    }
  }

  const recoveryCheck = matchAndConsumeRecoveryHash(totpDoc.recoveryCodeHashes, code);
  if (recoveryCheck.matched) {
    const nextDoc = {
      ...totpDoc,
      recoveryCodeHashes: recoveryCheck.remainingHashes,
      updatedAt: new Date().toISOString()
    };
    await saveFn('user_account_totp', key, nextDoc, totpDoc).catch(() => {});
    return {
      valid: true,
      method: 'recovery_code',
      recoveryCodesRemaining: recoveryCheck.remainingHashes.length
    };
  }

  return { valid: false, method: null };
}

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

const BLOCKED_WEBHOOK_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data'
]);

function isRestrictedIpv4Octets(a, b, c, _d) {
  if (a === 0) return true; // 0.0.0.0/8 unspecified
  if (a === 10) return true; // 10.0.0.0/8 RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT & 100.100.100.200
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 RFC1918
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return true; // 192.88.99.0/24 6to4 relay
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255
  return false;
}

function parseIpv6Groups(rawIp) {
  let addr = String(rawIp || '').trim().toLowerCase();
  if (!addr || addr.includes('%')) return null;

  // Convert trailing dotted-quad IPv4 (e.g. ::ffff:127.0.0.1) to two 16-bit hex groups.
  if (addr.includes('.')) {
    const lastColon = addr.lastIndexOf(':');
    if (lastColon === -1) return null;
    const v4Part = addr.slice(lastColon + 1);
    if (!net.isIPv4(v4Part)) return null;
    const octets = v4Part.split('.').map(Number);
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const doubleColonParts = addr.split('::');
  if (doubleColonParts.length > 2) return null;

  let groups;
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = addr.split(':');
    if (groups.length !== 8) return null;
  }

  const parsed = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    parsed.push(Number.parseInt(g, 16));
  }
  return parsed;
}

export function isPublicUnicastIp(rawIp) {
  const ip = String(rawIp || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!ip || ip.includes('%')) return false;

  const family = net.isIP(ip);
  if (family === 4) {
    const [a, b, c, d] = ip.split('.').map(Number);
    return !isRestrictedIpv4Octets(a, b, c, d);
  }
  if (family !== 6) return false;

  const g = parseIpv6Groups(ip);
  if (!g) return false;

  const isZeroPrefix5 = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
  // Unspecified (::) and Loopback (::1)
  if (isZeroPrefix5 && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return false;
  // IPv4-mapped IPv6 (::ffff:0:0/96): validate embedded IPv4 address.
  if (isZeroPrefix5 && g[5] === 0xffff) {
    return !isRestrictedIpv4Octets(g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff);
  }
  // IPv4-compatible IPv6 (::/96)
  if (isZeroPrefix5 && g[5] === 0) return false;
  // NAT64 (64:ff9b::/96 and 64:ff9b:1::/48)
  if (g[0] === 0x0064 && g[1] === 0xff9b && ((g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) || g[2] === 1)) {
    return false;
  }
  // Unique Local Address fc00::/7 (includes fd00:ec2::254)
  if ((g[0] & 0xfe00) === 0xfc00) return false;
  // Link-local fe80::/10 and deprecated site-local fec0::/10
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) return false;
  // Multicast ff00::/8
  if ((g[0] & 0xff00) === 0xff00) return false;
  // Documentation 2001:db8::/32 and Teredo 2001::/32
  if (g[0] === 0x2001 && (g[1] === 0x0db8 || g[1] === 0)) return false;
  // 6to4 2002::/16: reject if embedded IPv4 is restricted.
  if (g[0] === 0x2002 && isRestrictedIpv4Octets(g[1] >> 8, g[1] & 0xff, g[2] >> 8, g[2] & 0xff)) {
    return false;
  }
  // Require IPv6 Global Unicast (2000::/3).
  return (g[0] & 0xe000) === 0x2000;
}

export function validateSafeWebhookUrl(rawUrl) {
  try {
    const clean = String(rawUrl || '').trim();
    if (!clean || /[\r\n\0\s]/.test(clean)) return null;
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
    if (!host) return null;
    if (
      BLOCKED_WEBHOOK_HOSTNAMES.has(host) ||
      host.endsWith('.localhost') ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return null;
    }

    if (net.isIP(host)) {
      if (!isPublicUnicastIp(host)) return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export async function resolveAndAssertSafeWebhookUrl(rawUrl, { dnsLookup = dns.lookup } = {}) {
  const safeUrl = validateSafeWebhookUrl(rawUrl);
  if (!safeUrl) return null;

  const parsed = new URL(safeUrl);
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  const literalFamily = net.isIP(host);
  if (literalFamily) {
    if (!isPublicUnicastIp(host)) return null;
    return {
      url: safeUrl,
      hostname: host,
      addresses: [{ address: host, family: literalFamily }]
    };
  }

  let records;
  try {
    records = await dnsLookup(host, { all: true });
  } catch {
    return null;
  }

  if (!Array.isArray(records) || records.length === 0) return null;

  const validated = [];
  for (const rec of records) {
    const addr = String(rec?.address || '').trim();
    if (!addr || !isPublicUnicastIp(addr)) {
      return null;
    }
    const family = rec?.family === 4 || rec?.family === 6 ? rec.family : net.isIP(addr);
    if (family !== 4 && family !== 6) return null;
    validated.push({ address: addr, family });
  }

  return {
    url: safeUrl,
    hostname: host,
    addresses: validated
  };
}

function createPinnedDnsLookup(expectedHost, resolvedAddresses) {
  return (hostname, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? {} : (options || {});
    const normalized = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
    if (normalized !== expectedHost) {
      return cb(new Error(`Unexpected DNS lookup hostname: ${hostname}`));
    }
    const family = opts.family;
    const candidates = family
      ? resolvedAddresses.filter((entry) => entry.family === family)
      : resolvedAddresses;
    if (!candidates.length) {
      return cb(Object.assign(new Error(`No validated IP addresses available for ${hostname}`), { code: 'ENOTFOUND' }));
    }
    if (opts.all) {
      return cb(null, candidates.map((entry) => ({ address: entry.address, family: entry.family })));
    }
    return cb(null, candidates[0].address, candidates[0].family);
  };
}

function dispatchPinnedHttpsWebhook({ url, hostname, addresses, headers, body, signal }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body, 'utf8')
        },
        signal,
        lookup: createPinnedDnsLookup(hostname, addresses)
      },
      (res) => {
        res.resume();
        const statusCode = Number(res.statusCode || 0);
        const ok = statusCode >= 200 && statusCode < 300;
        const isRedirect = statusCode >= 300 && statusCode < 400;
        resolve({
          ok,
          status: statusCode,
          statusText: isRedirect
            ? (res.statusMessage ? `${res.statusMessage} (Redirect blocked)` : 'Redirect blocked')
            : (res.statusMessage || '')
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
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
    sendTiwloEmail,
    renderBaseEmail,
    getPlatformUrl,
    totpEncryptionSecret: null,
    hashPasswordWithRust,
    verifyPasswordWithRust,
    scanAndSanitizeImage,
    storeMedia,
    getPublicMediaUrl,
    logActivity,
    dnsLookup: dns.lookup,
    webhookFetch: null,
    ...overrides
  };

  const inMemoryOtpFallback = new Map();
  const inMemoryPrefsFallback = new Map();
  const inMemoryExtendedPrefsFallback = new Map();
  const inMemoryTotpFallback = new Map();
  const inMemoryActivityFallback = new Map();
  const inMemoryTeamFallback = new Map();
  const inMemoryWebhooksFallback = new Map();
  const inMemoryBackupPolicyFallback = new Map();

  async function loadStateDoc(namespace, key, defaultDoc, fallbackMap) {
    const strKey = String(key);
    try {
      const stored = await deps.readState(namespace, strKey, defaultDoc);
      const doc = stored && typeof stored === 'object' ? stored : structuredClone(defaultDoc);
      return { doc, snapshotSource: stored };
    } catch {
      const cached = fallbackMap.get(strKey);
      return {
        doc: cached ? structuredClone(cached) : structuredClone(defaultDoc),
        snapshotSource: null
      };
    }
  }

  async function persistStateDoc(namespace, key, nextDoc, snapshotSource, fallbackMap, defaultDoc = {}) {
    const strKey = String(key);
    fallbackMap.set(strKey, structuredClone(nextDoc));
    try {
      if (snapshotSource) {
        await deps.saveState(namespace, strKey, nextDoc, snapshotSource);
      } else {
        const current = await deps.readState(namespace, strKey, defaultDoc);
        await deps.saveState(namespace, strKey, nextDoc, current);
      }
    } catch (error) {
      if (deps.isPgActive()) {
        throw error;
      }
    }
    return nextDoc;
  }

  async function appendUserActivity(userId, entry = {}) {
    const key = String(userId);
    const nowIso = new Date().toISOString();
    const record = {
      id: `act_${crypto.randomUUID()}`,
      userId: key,
      source: 'account',
      type: String(entry.type || 'account_event').slice(0, 64),
      category: String(entry.category || 'security').slice(0, 32),
      title: String(entry.title || 'Account activity').slice(0, 160),
      description: String(entry.description || '').slice(0, 500),
      severity: ['info', 'warning', 'error', 'critical'].includes(entry.severity) ? entry.severity : 'info',
      ip: entry.ip ? String(entry.ip).slice(0, 64) : null,
      device: entry.userAgent ? summarizeDeviceFromUserAgent(entry.userAgent) : null,
      location: null,
      createdAt: nowIso
    };
    try {
      const { doc, snapshotSource } = await loadStateDoc(
        'user_account_activity',
        key,
        { entries: [] },
        inMemoryActivityFallback
      );
      const existingEntries = Array.isArray(doc.entries) ? doc.entries : [];
      const nextDoc = {
        entries: [record, ...existingEntries].slice(0, 100),
        updatedAt: nowIso
      };
      await persistStateDoc('user_account_activity', key, nextDoc, snapshotSource, inMemoryActivityFallback, { entries: [] });
    } catch {
      // Activity log persistence should not break primary security actions
    }
    return record;
  }

  function getClientIp(req) {
    const fwd = req.headers?.['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.trim()) {
      return fwd.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
  }

  async function sendTeamInviteEmail({ owner, member, inviteLink }) {
    const ownerLabel = owner.storeName || owner.name || owner.email || 'Tiwlo Workspace';
    const roleLabel = TEAM_ROLE_PRESETS[member.role]?.label || member.role;
    const html = deps.renderBaseEmail({
      title: `You have been invited to ${ownerLabel} on Tiwlo`,
      recipientEmail: member.email,
      contentHtml: `
        <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: #202124;">
          Team Access Invitation
        </h1>
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #3c4043;">
          ${ownerLabel} invited you (${member.name}) to join their Tiwlo team as <strong>${roleLabel}</strong>.
        </p>
        <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 20px; color: #5f6368;">
          Permissions: ${member.permissions.join(', ') || 'Custom'}${member.require2fa ? ' (Two-Factor Authentication required)' : ''}.
        </p>
        <p style="margin: 20px 0;">
          <a href="${inviteLink}" style="display: inline-block; background-color: #1a73e8; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500;">
            Accept Team Invitation
          </a>
        </p>
        <p style="margin: 0; font-size: 12px; color: #70757a; word-break: break-all;">
          Direct link: ${inviteLink}
        </p>
      `
    });

    try {
      const delivery = await deps.sendTiwloEmail({
        to: member.email,
        subject: `Team invitation from ${ownerLabel} on Tiwlo`,
        html,
        text: `${ownerLabel} invited you to join their Tiwlo team as ${roleLabel}. Accept invitation: ${inviteLink}`,
        type: 'team_invite',
        metadata: { ownerId: String(owner.id), memberId: member.id, role: member.role }
      });
      if (delivery && delivery.success === false) {
        return {
          inviteEmailSent: false,
          inviteStatus: 'pending_manual',
          inviteWarning: delivery.error || 'Email delivery unavailable. Share the invite link manually.'
        };
      }
      return {
        inviteEmailSent: true,
        inviteStatus: 'sent',
        inviteWarning: null
      };
    } catch (err) {
      return {
        inviteEmailSent: false,
        inviteStatus: 'pending_manual',
        inviteWarning: err?.message || 'Email delivery unavailable. Share the invite link manually.'
      };
    }
  }

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
      if (sessionData.user.isDeleted) {
        return res.status(403).json({ error: "You deleted this account and can't login.", isDeleted: true });
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
      let identityReverificationTriggered = false;
      const previousNameNorm = String(user.name || '').trim().toLowerCase();
      const nextNameNorm = updates.name !== undefined ? String(updates.name || '').trim().toLowerCase() : previousNameNorm;
      const previousDobNorm = user.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '';
      const nextDobNorm = updates.dateOfBirth !== undefined ? String(updates.dateOfBirth || '').slice(0, 10) : previousDobNorm;
      if (
        user.identityVerified === true &&
        user.role !== 'super_admin' &&
        (nextNameNorm !== previousNameNorm || nextDobNorm !== previousDobNorm)
      ) {
        updates.identityVerified = false;
        updates.identityVerificationRequired = true;
        identityReverificationTriggered = true;
      }

      if (Object.keys(updates).length > 0) {
        updatedUser = (await deps.masterDb.updateUser(user.id, updates)) || { ...user, ...updates };
        if (identityReverificationTriggered) {
          identityVerificationEmailNotifications.required({
            to: updatedUser.email || user.email,
            name: updatedUser.name || updatedUser.storeName || 'Tiwlo user',
            reason: 'Your account display name or date of birth was changed, so re-verification is required with a valid matching ID document.'
          }).catch(() => {});
          recordSecurityEvent({
            eventType: 'account.identity_details_changed_reverify',
            severity: 'warning',
            userId: user.id,
            subject: updatedUser.email || user.email,
            details: {
              nameChanged: nextNameNorm !== previousNameNorm,
              dobChanged: nextDobNorm !== previousDobNorm
            }
          }).catch(() => {});
        }
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

      if (updates.twoFactorEnabled !== undefined) {
        try {
          const { doc: totpDoc, snapshotSource: totpSource } = await loadStateDoc(
            'user_account_totp',
            user.id,
            {},
            inMemoryTotpFallback
          );
          const nextTotpDoc = updates.twoFactorEnabled
            ? { ...totpDoc, emailTwoFactorEnabled: true, updatedAt: new Date().toISOString() }
            : {
                ...totpDoc,
                totpEnabled: false,
                emailTwoFactorEnabled: false,
                activeSecretEnc: null,
                pendingSecretEnc: null,
                pendingCreatedAt: null,
                recoveryCodeHashes: [],
                enrolledAt: null,
                updatedAt: new Date().toISOString()
              };
          await persistStateDoc('user_account_totp', user.id, nextTotpDoc, totpSource, inMemoryTotpFallback, {});
        } catch {
          // Non-fatal
        }
      }

      await appendUserActivity(user.id, {
        type: 'account_settings_updated',
        category: 'security',
        title: 'Account settings updated',
        description: `Updated ${Object.keys(updates).join(', ') || 'preferences'}`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

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

      await appendUserActivity(user.id, {
        type: 'session_revoked',
        category: 'security',
        title: scope === 'others' ? 'Other sessions revoked' : 'Session revoked',
        description: scope === 'others' ? 'Signed out of all other active sessions' : `Revoked session ${sessionId}`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      const sessions = await listUserSessions(user.id, req.accountSessionToken);
      return res.json({ success: true, sessions });
    } catch (error) {
      console.error('[UserAccount] Failed to revoke sessions:', error.message);
      return res.status(500).json({ error: 'Failed to revoke sessions.' });
    }
  });

  // 6. GET /user/account/two-factor/status
  router.get('/user/account/two-factor/status', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const { doc: totpDoc } = await loadStateDoc('user_account_totp', user.id, {}, inMemoryTotpFallback);
      const totpEnabled = Boolean(totpDoc?.totpEnabled && totpDoc?.activeSecretEnc);
      const emailTwoFactorEnabled = totpDoc?.emailTwoFactorEnabled !== undefined
        ? Boolean(totpDoc.emailTwoFactorEnabled)
        : Boolean(user.twoFactorEnabled) && !totpEnabled;
      const twoFactorEnabled = Boolean(user.twoFactorEnabled || totpEnabled || emailTwoFactorEnabled);
      const activeMethod = totpEnabled
        ? 'totp'
        : (emailTwoFactorEnabled || twoFactorEnabled ? 'email' : 'off');

      return res.json({
        success: true,
        twoFactorEnabled,
        emailTwoFactorEnabled,
        totpEnabled,
        activeMethod,
        totpEnrolledAt: totpDoc?.enrolledAt || null,
        backupCodesRemaining: Array.isArray(totpDoc?.recoveryCodeHashes) ? totpDoc.recoveryCodeHashes.length : 0
      });
    } catch (error) {
      console.error('[UserAccount] Failed to read 2FA status:', error.message);
      return res.status(500).json({ error: 'Failed to load two-factor status.' });
    }
  });

  // 7. POST /user/account/two-factor/totp/setup
  router.post('/user/account/two-factor/totp/setup', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const rawSecret = crypto.randomBytes(20);
      const manualKey = encodeBase32(rawSecret);
      const cleanEmail = String(user.email || user.tiwiId || user.id || 'user')
        .trim()
        .replace(/[\s?#&/\\]+/g, '');
      const issuer = 'Tiwlo';
      const otpauthUrl = `otpauth://totp/${issuer}:${cleanEmail}?secret=${manualKey}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 240, margin: 1 });

      const { doc: totpDoc, snapshotSource } = await loadStateDoc('user_account_totp', user.id, {}, inMemoryTotpFallback);
      const priorEmail2fa = totpDoc.emailTwoFactorEnabled !== undefined
        ? Boolean(totpDoc.emailTwoFactorEnabled)
        : Boolean(user.twoFactorEnabled && !totpDoc.totpEnabled);

      const nextDoc = {
        ...totpDoc,
        emailTwoFactorEnabled: priorEmail2fa,
        pendingSecretEnc: encryptTotpSecret(manualKey, deps.totpEncryptionSecret),
        pendingCreatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await persistStateDoc('user_account_totp', user.id, nextDoc, snapshotSource, inMemoryTotpFallback, {});

      return res.json({
        success: true,
        qrCodeDataUrl,
        manualKey,
        otpauthUrl,
        issuer,
        accountName: cleanEmail
      });
    } catch (error) {
      console.error('[UserAccount] Failed to start TOTP setup:', error.message);
      return res.status(500).json({ error: 'Failed to generate authenticator QR code.' });
    }
  });

  // 8. POST /user/account/two-factor/totp/verify
  router.post('/user/account/two-factor/totp/verify', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const code = String(body.code ?? body.otpCode ?? body.totpCode ?? '').trim();
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'Enter a valid 6-digit authenticator code.' });
      }

      const { doc: totpDoc, snapshotSource } = await loadStateDoc('user_account_totp', user.id, {}, inMemoryTotpFallback);
      const pendingSecret = totpDoc.pendingSecretEnc
        ? decryptTotpSecret(totpDoc.pendingSecretEnc, deps.totpEncryptionSecret)
        : null;
      const activeSecret = totpDoc.activeSecretEnc
        ? decryptTotpSecret(totpDoc.activeSecretEnc, deps.totpEncryptionSecret)
        : null;

      const candidateSecret = pendingSecret || activeSecret;
      if (!candidateSecret) {
        return res.status(400).json({ error: 'Authenticator setup has not been initiated. Generate a QR code first.' });
      }

      const verification = verifyTotpCode(candidateSecret, code, { window: 1 });
      if (!verification.valid) {
        return res.status(400).json({ error: 'Invalid authenticator code. Please check your device clock and try again.' });
      }

      const isActivatingPending = Boolean(pendingSecret);
      const recoveryCodes = isActivatingPending || !Array.isArray(totpDoc.recoveryCodeHashes) || totpDoc.recoveryCodeHashes.length === 0
        ? generateRecoveryCodes(8, 8)
        : null;
      const nowIso = new Date().toISOString();

      const nextDoc = {
        ...totpDoc,
        totpEnabled: true,
        emailTwoFactorEnabled: totpDoc.emailTwoFactorEnabled !== undefined
          ? Boolean(totpDoc.emailTwoFactorEnabled)
          : Boolean(user.twoFactorEnabled && !totpDoc.totpEnabled),
        activeSecretEnc: isActivatingPending ? totpDoc.pendingSecretEnc : totpDoc.activeSecretEnc,
        pendingSecretEnc: null,
        pendingCreatedAt: null,
        enrolledAt: totpDoc.enrolledAt && !isActivatingPending ? totpDoc.enrolledAt : nowIso,
        recoveryCodeHashes: recoveryCodes
          ? recoveryCodes.map((rc) => hashRecoveryCode(rc))
          : totpDoc.recoveryCodeHashes,
        updatedAt: nowIso
      };

      await persistStateDoc('user_account_totp', user.id, nextDoc, snapshotSource, inMemoryTotpFallback, {});
      if (!user.twoFactorEnabled) {
        await deps.masterDb.updateUser(user.id, { twoFactorEnabled: true });
      }
      await touchAccountSecurityRecord(user.id);

      await appendUserActivity(user.id, {
        type: 'totp_enabled',
        category: 'security',
        title: 'Authenticator app (TOTP) enabled',
        description: 'Two-factor authentication verified and activated via authenticator app.',
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      try {
        await deps.logActivity(
          'security',
          'Authenticator TOTP enabled',
          `User ${user.email || user.id} enabled authenticator app 2FA`,
          user.tiwiId || null
        );
      } catch {
        // ignore
      }

      return res.json({
        success: true,
        totpEnabled: true,
        twoFactorEnabled: true,
        emailTwoFactorEnabled: Boolean(nextDoc.emailTwoFactorEnabled),
        activeMethod: 'totp',
        totpEnrolledAt: nextDoc.enrolledAt,
        backupCodesRemaining: nextDoc.recoveryCodeHashes.length,
        ...(recoveryCodes ? { recoveryCodes } : {})
      });
    } catch (error) {
      console.error('[UserAccount] Failed to verify TOTP:', error.message);
      return res.status(500).json({ error: 'Failed to verify authenticator code.' });
    }
  });

  // 9. POST /user/account/two-factor/totp/disable
  router.post('/user/account/two-factor/totp/disable', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { doc: totpDoc, snapshotSource } = await loadStateDoc('user_account_totp', user.id, {}, inMemoryTotpFallback);

      if (!totpDoc?.totpEnabled || !totpDoc?.activeSecretEnc) {
        return res.status(400).json({ error: 'Authenticator app 2FA is not currently enabled.' });
      }

      const code = String(body.code ?? body.totpCode ?? '').trim();
      const recoveryCode = String(body.recoveryCode ?? '').trim();
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';

      if (!code && !recoveryCode && !currentPassword) {
        return res.status(400).json({
          error: 'Provide your authenticator code, a recovery code, or your current password to disable authenticator 2FA.'
        });
      }

      let verified = false;
      if (code) {
        const activeSecret = decryptTotpSecret(totpDoc.activeSecretEnc, deps.totpEncryptionSecret);
        if (activeSecret && verifyTotpCode(activeSecret, code, { window: 1 }).valid) {
          verified = true;
        }
      }
      if (!verified && recoveryCode) {
        if (matchAndConsumeRecoveryHash(totpDoc.recoveryCodeHashes, recoveryCode).matched) {
          verified = true;
        }
      }
      if (!verified && currentPassword && user.password) {
        const pwdCheck = await deps.verifyPasswordWithRust(user.id, currentPassword);
        if (pwdCheck?.valid) {
          verified = true;
        }
      }

      if (!verified) {
        return res.status(401).json({ error: 'Verification failed. Invalid authenticator code, recovery code, or password.' });
      }

      const keepEmail2fa = body.keepEmail2fa !== undefined
        ? Boolean(body.keepEmail2fa)
        : Boolean(totpDoc.emailTwoFactorEnabled);
      const nowIso = new Date().toISOString();

      const nextDoc = {
        ...totpDoc,
        totpEnabled: false,
        emailTwoFactorEnabled: keepEmail2fa,
        activeSecretEnc: null,
        pendingSecretEnc: null,
        pendingCreatedAt: null,
        enrolledAt: null,
        recoveryCodeHashes: [],
        updatedAt: nowIso
      };

      await persistStateDoc('user_account_totp', user.id, nextDoc, snapshotSource, inMemoryTotpFallback, {});
      await deps.masterDb.updateUser(user.id, { twoFactorEnabled: keepEmail2fa });
      await touchAccountSecurityRecord(user.id);

      await appendUserActivity(user.id, {
        type: 'totp_disabled',
        category: 'security',
        title: 'Authenticator app (TOTP) disabled',
        description: keepEmail2fa
          ? 'Authenticator app removed; Email 2FA remains active.'
          : 'Authenticator app and 2FA disabled.',
        severity: 'warning',
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        totpEnabled: false,
        emailTwoFactorEnabled: keepEmail2fa,
        twoFactorEnabled: keepEmail2fa,
        activeMethod: keepEmail2fa ? 'email' : 'off',
        backupCodesRemaining: 0
      });
    } catch (error) {
      console.error('[UserAccount] Failed to disable TOTP:', error.message);
      return res.status(500).json({ error: 'Failed to disable authenticator 2FA.' });
    }
  });

  // 10. POST /user/account/two-factor/recovery-codes/regenerate
  router.post('/user/account/two-factor/recovery-codes/regenerate', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { doc: totpDoc, snapshotSource } = await loadStateDoc('user_account_totp', user.id, {}, inMemoryTotpFallback);

      if (!totpDoc?.totpEnabled || !totpDoc?.activeSecretEnc) {
        return res.status(400).json({ error: 'Enable authenticator app 2FA before regenerating recovery codes.' });
      }

      const code = String(body.code ?? body.totpCode ?? '').trim();
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      if (!code && !currentPassword) {
        return res.status(400).json({ error: 'Provide your current authenticator code or password.' });
      }

      let verified = false;
      if (code) {
        const activeSecret = decryptTotpSecret(totpDoc.activeSecretEnc, deps.totpEncryptionSecret);
        if (activeSecret && verifyTotpCode(activeSecret, code, { window: 1 }).valid) {
          verified = true;
        }
      }
      if (!verified && currentPassword && user.password) {
        const pwdCheck = await deps.verifyPasswordWithRust(user.id, currentPassword);
        if (pwdCheck?.valid) {
          verified = true;
        }
      }
      if (!verified) {
        return res.status(401).json({ error: 'Invalid authenticator code or password.' });
      }

      const recoveryCodes = generateRecoveryCodes(8, 8);
      const nextDoc = {
        ...totpDoc,
        recoveryCodeHashes: recoveryCodes.map((rc) => hashRecoveryCode(rc)),
        updatedAt: new Date().toISOString()
      };
      await persistStateDoc('user_account_totp', user.id, nextDoc, snapshotSource, inMemoryTotpFallback, {});

      await appendUserActivity(user.id, {
        type: 'recovery_codes_regenerated',
        category: 'security',
        title: '2FA recovery codes regenerated',
        description: 'Issued 8 new single-use recovery codes and invalidated previous codes.',
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        recoveryCodes,
        backupCodesRemaining: recoveryCodes.length
      });
    } catch (error) {
      console.error('[UserAccount] Failed to regenerate recovery codes:', error.message);
      return res.status(500).json({ error: 'Failed to regenerate recovery codes.' });
    }
  });

  // 11. PUT /user/account/security-pin
  router.put('/user/account/security-pin', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const nextPin = String(body.pin ?? body.newPin ?? '').trim();
      if (!/^\d{4,8}$/.test(nextPin)) {
        return res.status(422).json({ error: 'Security PIN must be 4 to 8 digits.' });
      }

      const { doc: rawPrefs, snapshotSource } = await loadStateDoc(
        'user_account_prefs',
        user.id,
        {},
        inMemoryExtendedPrefsFallback
      );
      const prefs = normalizeExtendedAccountPrefs(rawPrefs, {});

      const currentPin = String(body.currentPin ?? '').trim();
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';

      if (prefs.hasSecurityPin && prefs.securityPinHash) {
        if (!currentPin && !currentPassword) {
          return res.status(400).json({ error: 'Current Security PIN or account password is required to change your PIN.' });
        }
        let verified = false;
        if (currentPin && verifySecurityPinHash(currentPin, prefs.securityPinHash)) {
          verified = true;
        }
        if (!verified && currentPassword && user.password) {
          const pwdCheck = await deps.verifyPasswordWithRust(user.id, currentPassword);
          if (pwdCheck?.valid) verified = true;
        }
        if (!verified) {
          return res.status(401).json({ error: 'Current Security PIN or password is incorrect.' });
        }
      } else if (currentPassword && user.password) {
        const pwdCheck = await deps.verifyPasswordWithRust(user.id, currentPassword);
        if (!pwdCheck?.valid) {
          return res.status(401).json({ error: 'Current password is incorrect.' });
        }
      }

      const pinUpdatedAt = new Date().toISOString();
      const nextDoc = {
        ...prefs,
        hasSecurityPin: true,
        securityPinHash: hashSecurityPin(nextPin),
        pinUpdatedAt
      };
      await persistStateDoc('user_account_prefs', user.id, nextDoc, snapshotSource, inMemoryExtendedPrefsFallback, {});
      await touchAccountSecurityRecord(user.id);

      await appendUserActivity(user.id, {
        type: prefs.hasSecurityPin ? 'security_pin_changed' : 'security_pin_set',
        category: 'security',
        title: prefs.hasSecurityPin ? 'Security PIN updated' : 'Security PIN enabled',
        description: 'Account Security PIN was configured.',
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        hasSecurityPin: true,
        pinUpdatedAt
      });
    } catch (error) {
      console.error('[UserAccount] Failed to save security PIN:', error.message);
      return res.status(500).json({ error: 'Failed to update Security PIN.' });
    }
  });

  // 12. DELETE /user/account/security-pin
  router.delete('/user/account/security-pin', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { doc: rawPrefs, snapshotSource } = await loadStateDoc(
        'user_account_prefs',
        user.id,
        {},
        inMemoryExtendedPrefsFallback
      );
      const prefs = normalizeExtendedAccountPrefs(rawPrefs, {});

      if (!prefs.hasSecurityPin || !prefs.securityPinHash) {
        return res.status(400).json({ error: 'No Security PIN is currently configured.' });
      }

      const currentPin = String(body.currentPin ?? req.query?.currentPin ?? '').trim();
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      if (!currentPin && !currentPassword) {
        return res.status(400).json({ error: 'Current Security PIN or account password is required to remove your PIN.' });
      }

      let verified = false;
      if (currentPin && verifySecurityPinHash(currentPin, prefs.securityPinHash)) {
        verified = true;
      }
      if (!verified && currentPassword && user.password) {
        const pwdCheck = await deps.verifyPasswordWithRust(user.id, currentPassword);
        if (pwdCheck?.valid) verified = true;
      }
      if (!verified) {
        return res.status(401).json({ error: 'Current Security PIN or password is incorrect.' });
      }

      const nextDoc = {
        ...prefs,
        hasSecurityPin: false,
        securityPinHash: null,
        pinUpdatedAt: null
      };
      await persistStateDoc('user_account_prefs', user.id, nextDoc, snapshotSource, inMemoryExtendedPrefsFallback, {});
      await touchAccountSecurityRecord(user.id);

      await appendUserActivity(user.id, {
        type: 'security_pin_removed',
        category: 'security',
        title: 'Security PIN removed',
        description: 'Account Security PIN was removed.',
        severity: 'warning',
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        hasSecurityPin: false,
        pinUpdatedAt: null
      });
    } catch (error) {
      console.error('[UserAccount] Failed to remove security PIN:', error.message);
      return res.status(500).json({ error: 'Failed to remove Security PIN.' });
    }
  });

  // 13. GET /user/account/preferences
  router.get('/user/account/preferences', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const { doc: rawPrefs } = await loadStateDoc(
        'user_account_prefs',
        user.id,
        {},
        inMemoryExtendedPrefsFallback
      );
      return res.json({
        success: true,
        ...toPublicPreferencesResponse(rawPrefs)
      });
    } catch (error) {
      console.error('[UserAccount] Failed to load preferences:', error.message);
      return res.status(500).json({ error: 'Failed to load preferences.' });
    }
  });

  // 14. PUT /user/account/preferences
  router.put('/user/account/preferences', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
      const nested = body.preferences && typeof body.preferences === 'object' && !Array.isArray(body.preferences)
        ? body.preferences
        : {};

      const { doc: rawPrefs, snapshotSource } = await loadStateDoc(
        'user_account_prefs',
        user.id,
        {},
        inMemoryExtendedPrefsFallback
      );
      const current = normalizeExtendedAccountPrefs(rawPrefs, {});

      const incomingNotif = body.notificationPrefs ?? nested.notificationPrefs;
      if (
        incomingNotif &&
        typeof incomingNotif === 'object' &&
        incomingNotif.digestFrequency !== undefined &&
        !VALID_DIGEST_FREQUENCIES.has(String(incomingNotif.digestFrequency).trim().toLowerCase())
      ) {
        return res.status(422).json({ error: 'digestFrequency must be realtime, daily, or weekly.' });
      }

      const candidate = {
        language: body.language ?? nested.language,
        timezone: body.timezone ?? nested.timezone,
        currency: body.currency ?? nested.currency,
        emailNotifications: body.emailNotifications ?? nested.emailNotifications,
        marketingEmails: body.marketingEmails ?? nested.marketingEmails,
        securityAlerts: body.securityAlerts ?? nested.securityAlerts,
        notificationPrefs: incomingNotif,
        widgetConfig: body.widgetConfig ?? nested.widgetConfig,
        hasSecurityPin: current.hasSecurityPin,
        securityPinHash: current.securityPinHash,
        pinUpdatedAt: current.pinUpdatedAt
      };

      const nextDoc = normalizeExtendedAccountPrefs(candidate, current);
      await persistStateDoc('user_account_prefs', user.id, nextDoc, snapshotSource, inMemoryExtendedPrefsFallback, {});

      await appendUserActivity(user.id, {
        type: 'preferences_updated',
        category: 'preferences',
        title: 'Preferences & workspace widgets updated',
        description: `Updated account preferences (${nextDoc.language}, ${nextDoc.timezone})`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        ...toPublicPreferencesResponse(nextDoc)
      });
    } catch (error) {
      console.error('[UserAccount] Failed to save preferences:', error.message);
      return res.status(500).json({ error: 'Failed to save preferences.' });
    }
  });

  // 15. GET /user/account/activity-log
  router.get('/user/account/activity-log', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const userId = String(user.id);
      const requestedLimit = Number.parseInt(String(req.query?.limit || '50'), 10);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(50, Math.max(1, requestedLimit))
        : 50;

      const [accountState, loginLocationsRes, securityEventsRes] = await Promise.all([
        loadStateDoc('user_account_activity', userId, { entries: [] }, inMemoryActivityFallback),
        deps.queryPg(
          `SELECT id, user_id, location_source, formatted_address, area, postal_code, captured_at
           FROM system_user_login_locations
           WHERE user_id = $1
           ORDER BY captured_at DESC
           LIMIT 50`,
          [userId]
        ).catch(() => ({ rows: [] })),
        deps.queryPg(
          `SELECT id, event_type, severity, user_id, remote_ip, user_agent, details, created_at
           FROM system_security_events
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 50`,
          [userId]
        ).catch(() => ({ rows: [] }))
      ]);

      const items = [];

      const accountEntries = Array.isArray(accountState.doc?.entries) ? accountState.doc.entries : [];
      for (const entry of accountEntries) {
        if (entry?.userId && String(entry.userId) !== userId) continue;
        items.push({
          id: String(entry.id || `act_${items.length}`),
          source: 'account',
          type: entry.type || 'account_event',
          category: entry.category || 'security',
          title: entry.title || 'Account activity',
          description: entry.description || '',
          severity: entry.severity || 'info',
          ip: entry.ip || null,
          device: entry.device || null,
          location: entry.location || null,
          createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : new Date(0).toISOString()
        });
      }

      for (const row of loginLocationsRes?.rows || []) {
        if (row?.user_id !== undefined && row.user_id !== null && String(row.user_id) !== userId) continue;
        items.push({
          id: `loc_${row.id}`,
          source: 'login_location',
          type: 'login_location',
          category: 'login',
          title: `Sign-in location (${String(row.location_source || 'ip').toUpperCase()})`,
          description: row.formatted_address || row.area || 'Login location recorded',
          severity: 'info',
          ip: null,
          device: null,
          location: row.formatted_address || row.area || null,
          createdAt: row.captured_at ? new Date(row.captured_at).toISOString() : new Date(0).toISOString()
        });
      }

      for (const row of securityEventsRes?.rows || []) {
        if (row?.user_id !== undefined && row.user_id !== null && String(row.user_id) !== userId) continue;
        const safeDetails = row.details && typeof row.details === 'object' ? row.details : {};
        const summary = typeof safeDetails.message === 'string'
          ? safeDetails.message
          : (typeof safeDetails.reason === 'string' ? safeDetails.reason : String(row.event_type || 'security_event'));
        items.push({
          id: `sec_${row.id}`,
          source: 'security_event',
          type: row.event_type || 'security_event',
          category: 'security',
          title: String(row.event_type || 'Security event').replace(/[._]+/g, ' '),
          description: summary,
          severity: row.severity || 'info',
          ip: row.remote_ip ? String(row.remote_ip) : null,
          device: row.user_agent ? summarizeDeviceFromUserAgent(row.user_agent) : null,
          location: null,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date(0).toISOString()
        });
      }

      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const bounded = items.slice(0, limit);

      return res.json({
        success: true,
        activities: bounded,
        total: bounded.length
      });
    } catch (error) {
      console.error('[UserAccount] Failed to load activity log:', error.message);
      return res.status(500).json({ error: 'Failed to load account activity log.' });
    }
  });

  // 16. GET /user/account/team-staff
  router.get('/user/account/team-staff', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const { doc: teamDoc } = await loadStateDoc(
        'user_team_staff',
        ownerId,
        { members: [], auditLogs: [] },
        inMemoryTeamFallback
      );
      const members = (Array.isArray(teamDoc.members) ? teamDoc.members : [])
        .filter((m) => !m.ownerId || String(m.ownerId) === ownerId)
        .map(toSafeTeamMember);
      const auditLogs = (Array.isArray(teamDoc.auditLogs) ? teamDoc.auditLogs : []).slice(0, 50);

      return res.json({
        success: true,
        ownerId,
        members,
        permissionsCatalog: TEAM_PERMISSION_CATALOG,
        rolePresets: TEAM_ROLE_PRESETS,
        auditLogs
      });
    } catch (error) {
      console.error('[UserAccount] Failed to load team staff:', error.message);
      return res.status(500).json({ error: 'Failed to load team staff.' });
    }
  });

  // 17. POST /user/account/team-staff
  router.post('/user/account/team-staff', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const owner = req.accountUser;
      const ownerId = String(owner.id);
      const body = req.body && typeof req.body === 'object' ? req.body : {};

      const cleanName = String(body.name || '').trim();
      if (!cleanName || cleanName.length > 120) {
        return res.status(422).json({ error: 'Team member name must be between 1 and 120 characters.' });
      }

      const cleanEmail = normalizeSignupEmail(body.email);
      if (!cleanEmail) {
        return res.status(422).json({ error: 'Enter a valid email address for the team member.' });
      }

      const ownerEmail = normalizeSignupEmail(owner.email || '');
      if (ownerEmail && cleanEmail === ownerEmail) {
        return res.status(422).json({ error: 'You cannot add your own account email as a team staff member.' });
      }

      const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'custom';
      if (!Object.prototype.hasOwnProperty.call(TEAM_ROLE_PRESETS, role)) {
        return res.status(422).json({ error: 'Invalid team role preset.' });
      }

      let resolvedPermissions;
      if (body.permissions !== undefined) {
        if (!Array.isArray(body.permissions)) {
          return res.status(422).json({ error: 'Permissions must be an array of permission keys.' });
        }
        const deduped = [...new Set(body.permissions.map((p) => String(p || '').trim()).filter(Boolean))];
        const invalidPerm = deduped.find((p) => !VALID_TEAM_PERMISSION_KEYS.has(p));
        if (invalidPerm) {
          return res.status(422).json({ error: `Unknown permission key: ${invalidPerm}` });
        }
        if (deduped.length === 0) {
          return res.status(422).json({ error: 'Select at least one permission for this team member.' });
        }
        resolvedPermissions = deduped;
      } else {
        resolvedPermissions = [...TEAM_ROLE_PRESETS[role].permissions];
        if (resolvedPermissions.length === 0) {
          return res.status(422).json({ error: 'Select at least one permission for a custom role.' });
        }
      }

      const { doc: teamDoc, snapshotSource } = await loadStateDoc(
        'user_team_staff',
        ownerId,
        { members: [], auditLogs: [] },
        inMemoryTeamFallback
      );
      const existingMembers = Array.isArray(teamDoc.members) ? teamDoc.members : [];
      if (existingMembers.some((m) => normalizeSignupEmail(m.email) === cleanEmail)) {
        return res.status(409).json({ error: 'A team member with this email already exists on your account.' });
      }

      const sendInviteEmail = Boolean(body.sendInviteEmail);
      const nowIso = new Date().toISOString();
      const rawInviteToken = sendInviteEmail ? crypto.randomBytes(24).toString('hex') : null;
      const inviteTokenHash = rawInviteToken
        ? crypto.createHash('sha256').update(rawInviteToken).digest('hex')
        : null;
      const inviteLink = rawInviteToken
        ? `${deps.getPlatformUrl('team-invite')}?token=${rawInviteToken}&owner=${encodeURIComponent(ownerId)}`
        : null;

      const memberRecord = {
        id: `tm_${crypto.randomUUID()}`,
        ownerId,
        name: cleanName,
        email: cleanEmail,
        role,
        permissions: resolvedPermissions,
        require2fa: Boolean(body.require2fa),
        storeScope: normalizeStoreScope(body.storeScope),
        status: sendInviteEmail ? 'pending' : 'active',
        inviteStatus: sendInviteEmail ? 'pending_manual' : 'not_required',
        inviteTokenHash,
        invitedAt: sendInviteEmail ? nowIso : null,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      let inviteEmailSent = false;
      let inviteWarning = null;
      if (sendInviteEmail && inviteLink) {
        const delivery = await sendTeamInviteEmail({ owner, member: memberRecord, inviteLink });
        inviteEmailSent = delivery.inviteEmailSent;
        memberRecord.inviteStatus = delivery.inviteStatus;
        inviteWarning = delivery.inviteWarning;
      }

      const auditEntry = {
        id: `ta_${crypto.randomUUID()}`,
        action: 'member_added',
        memberId: memberRecord.id,
        memberEmail: memberRecord.email,
        role: memberRecord.role,
        actorId: ownerId,
        detail: `${cleanName} (${cleanEmail}) added as ${TEAM_ROLE_PRESETS[role].label}`,
        createdAt: nowIso
      };

      const nextTeamDoc = {
        members: [memberRecord, ...existingMembers],
        auditLogs: [auditEntry, ...(Array.isArray(teamDoc.auditLogs) ? teamDoc.auditLogs : [])].slice(0, 100),
        updatedAt: nowIso
      };

      await persistStateDoc(
        'user_team_staff',
        ownerId,
        nextTeamDoc,
        snapshotSource,
        inMemoryTeamFallback,
        { members: [], auditLogs: [] }
      );

      await appendUserActivity(ownerId, {
        type: 'team_member_added',
        category: 'team',
        title: 'Team member added',
        description: `Added ${cleanName} (${cleanEmail}) with role ${role}`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.status(201).json({
        success: true,
        member: toSafeTeamMember(memberRecord),
        inviteEmailSent,
        inviteStatus: memberRecord.inviteStatus,
        ...(inviteWarning ? { inviteWarning } : {}),
        ...(inviteLink ? { inviteLink } : {}),
        auditLogs: nextTeamDoc.auditLogs.slice(0, 50)
      });
    } catch (error) {
      console.error('[UserAccount] Failed to add team member:', error.message);
      return res.status(500).json({ error: 'Failed to add team member.' });
    }
  });

  // 18. PUT /user/account/team-staff/:memberId
  router.put('/user/account/team-staff/:memberId', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const owner = req.accountUser;
      const ownerId = String(owner.id);
      const memberId = String(req.params.memberId || '').trim();
      const body = req.body && typeof req.body === 'object' ? req.body : {};

      const { doc: teamDoc, snapshotSource } = await loadStateDoc(
        'user_team_staff',
        ownerId,
        { members: [], auditLogs: [] },
        inMemoryTeamFallback
      );
      const existingMembers = Array.isArray(teamDoc.members) ? teamDoc.members : [];
      const memberIdx = existingMembers.findIndex(
        (m) => m.id === memberId && (!m.ownerId || String(m.ownerId) === ownerId)
      );
      if (memberIdx === -1) {
        return res.status(404).json({ error: 'Team member not found.' });
      }

      const existingMember = existingMembers[memberIdx];
      const updated = { ...existingMember };

      if (body.name !== undefined) {
        const cleanName = String(body.name || '').trim();
        if (!cleanName || cleanName.length > 120) {
          return res.status(422).json({ error: 'Team member name must be between 1 and 120 characters.' });
        }
        updated.name = cleanName;
      }

      if (body.role !== undefined) {
        const nextRole = String(body.role || '').trim();
        if (!Object.prototype.hasOwnProperty.call(TEAM_ROLE_PRESETS, nextRole)) {
          return res.status(422).json({ error: 'Invalid team role preset.' });
        }
        updated.role = nextRole;
        if (body.permissions === undefined && nextRole !== 'custom') {
          updated.permissions = [...TEAM_ROLE_PRESETS[nextRole].permissions];
        }
      }

      if (body.permissions !== undefined) {
        if (!Array.isArray(body.permissions)) {
          return res.status(422).json({ error: 'Permissions must be an array of permission keys.' });
        }
        const deduped = [...new Set(body.permissions.map((p) => String(p || '').trim()).filter(Boolean))];
        const invalidPerm = deduped.find((p) => !VALID_TEAM_PERMISSION_KEYS.has(p));
        if (invalidPerm) {
          return res.status(422).json({ error: `Unknown permission key: ${invalidPerm}` });
        }
        if (deduped.length === 0) {
          return res.status(422).json({ error: 'Select at least one permission for this team member.' });
        }
        updated.permissions = deduped;
      }

      if (body.status !== undefined) {
        const nextStatus = String(body.status || '').trim().toLowerCase();
        if (!['active', 'pending', 'suspended'].includes(nextStatus)) {
          return res.status(422).json({ error: 'Status must be active, pending, or suspended.' });
        }
        updated.status = nextStatus;
      }

      if (body.require2fa !== undefined) {
        updated.require2fa = Boolean(body.require2fa);
      }

      if (body.storeScope !== undefined) {
        updated.storeScope = normalizeStoreScope(body.storeScope);
      }

      const nowIso = new Date().toISOString();
      let resendExtras = null;
      if (body.resendInvite === true) {
        const rawInviteToken = crypto.randomBytes(24).toString('hex');
        const inviteTokenHash = crypto.createHash('sha256').update(rawInviteToken).digest('hex');
        const inviteLink = `${deps.getPlatformUrl('team-invite')}?token=${rawInviteToken}&owner=${encodeURIComponent(ownerId)}`;
        updated.inviteTokenHash = inviteTokenHash;
        updated.invitedAt = nowIso;
        updated.status = 'pending';
        const delivery = await sendTeamInviteEmail({ owner, member: updated, inviteLink });
        updated.inviteStatus = delivery.inviteStatus;
        resendExtras = {
          inviteEmailSent: delivery.inviteEmailSent,
          inviteStatus: delivery.inviteStatus,
          ...(delivery.inviteWarning ? { inviteWarning: delivery.inviteWarning } : {}),
          inviteLink
        };
      }

      updated.updatedAt = nowIso;
      const nextMembers = existingMembers.map((m, idx) => (idx === memberIdx ? updated : m));

      const auditEntry = {
        id: `ta_${crypto.randomUUID()}`,
        action: body.resendInvite === true ? 'invite_resent' : 'member_updated',
        memberId: updated.id,
        memberEmail: updated.email,
        role: updated.role,
        actorId: ownerId,
        detail: body.resendInvite === true
          ? `Resent team invite to ${updated.email}`
          : `Updated access/profile for ${updated.email} (${updated.status})`,
        createdAt: nowIso
      };

      const nextTeamDoc = {
        members: nextMembers,
        auditLogs: [auditEntry, ...(Array.isArray(teamDoc.auditLogs) ? teamDoc.auditLogs : [])].slice(0, 100),
        updatedAt: nowIso
      };

      await persistStateDoc(
        'user_team_staff',
        ownerId,
        nextTeamDoc,
        snapshotSource,
        inMemoryTeamFallback,
        { members: [], auditLogs: [] }
      );

      await appendUserActivity(ownerId, {
        type: body.resendInvite === true ? 'team_invite_resent' : 'team_member_updated',
        category: 'team',
        title: body.resendInvite === true ? 'Team invite resent' : 'Team member updated',
        description: auditEntry.detail,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        member: toSafeTeamMember(updated),
        ...(resendExtras || {}),
        auditLogs: nextTeamDoc.auditLogs.slice(0, 50)
      });
    } catch (error) {
      console.error('[UserAccount] Failed to update team member:', error.message);
      return res.status(500).json({ error: 'Failed to update team member.' });
    }
  });

  // 19. DELETE /user/account/team-staff/:memberId
  router.delete('/user/account/team-staff/:memberId', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const memberId = String(req.params.memberId || '').trim();

      const { doc: teamDoc, snapshotSource } = await loadStateDoc(
        'user_team_staff',
        ownerId,
        { members: [], auditLogs: [] },
        inMemoryTeamFallback
      );
      const existingMembers = Array.isArray(teamDoc.members) ? teamDoc.members : [];
      const target = existingMembers.find(
        (m) => m.id === memberId && (!m.ownerId || String(m.ownerId) === ownerId)
      );
      if (!target) {
        return res.status(404).json({ error: 'Team member not found.' });
      }

      const nowIso = new Date().toISOString();
      const nextMembers = existingMembers.filter((m) => m.id !== memberId);
      const auditEntry = {
        id: `ta_${crypto.randomUUID()}`,
        action: 'member_removed',
        memberId: target.id,
        memberEmail: target.email,
        role: target.role,
        actorId: ownerId,
        detail: `Removed ${target.name} (${target.email}) from team`,
        createdAt: nowIso
      };

      const nextTeamDoc = {
        members: nextMembers,
        auditLogs: [auditEntry, ...(Array.isArray(teamDoc.auditLogs) ? teamDoc.auditLogs : [])].slice(0, 100),
        updatedAt: nowIso
      };

      await persistStateDoc(
        'user_team_staff',
        ownerId,
        nextTeamDoc,
        snapshotSource,
        inMemoryTeamFallback,
        { members: [], auditLogs: [] }
      );

      await appendUserActivity(ownerId, {
        type: 'team_member_removed',
        category: 'team',
        title: 'Team member removed',
        description: auditEntry.detail,
        severity: 'warning',
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });

      return res.json({
        success: true,
        removedMemberId: target.id,
        auditLogs: nextTeamDoc.auditLogs.slice(0, 50)
      });
    } catch (error) {
      console.error('[UserAccount] Failed to remove team member:', error.message);
      return res.status(500).json({ error: 'Failed to remove team member.' });
    }
  });

  // 20. GET /user/account/webhooks
  router.get('/user/account/webhooks', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const { doc } = await loadStateDoc(
        'user_webhooks',
        ownerId,
        { webhooks: [], deliveries: [] },
        inMemoryWebhooksFallback
      );
      return res.json({
        webhooks: Array.isArray(doc.webhooks) ? doc.webhooks : [],
        deliveries: Array.isArray(doc.deliveries) ? doc.deliveries : []
      });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to load webhooks.' });
    }
  });

  // 21. POST /user/account/webhooks
  router.post('/user/account/webhooks', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const resolved = await resolveAndAssertSafeWebhookUrl(req.body?.url, { dnsLookup: deps.dnsLookup });
      if (!resolved) {
        return res.status(400).json({ error: 'Provide a valid public HTTPS webhook URL.' });
      }
      const safeUrl = resolved.url;
      const events = Array.isArray(req.body?.events)
        ? [...new Set(req.body.events.map((e) => String(e || '').trim()).filter(Boolean))].slice(0, 20)
        : ['order.created'];
      if (!events.length) {
        return res.status(400).json({ error: 'Select at least one webhook event.' });
      }
      const name = String(req.body?.name || 'Workspace Webhook').trim().slice(0, 80) || 'Workspace Webhook';

      const { doc, snapshotSource } = await loadStateDoc(
        'user_webhooks',
        ownerId,
        { webhooks: [], deliveries: [] },
        inMemoryWebhooksFallback
      );
      const existing = Array.isArray(doc.webhooks) ? doc.webhooks : [];
      if (existing.length >= 25) {
        return res.status(400).json({ error: 'Maximum of 25 webhooks per account reached.' });
      }

      const webhook = {
        id: `wh_${crypto.randomUUID()}`,
        name,
        url: safeUrl,
        events,
        active: true,
        signingSecret: `whsec_${crypto.randomBytes(24).toString('hex')}`,
        createdAt: new Date().toISOString()
      };
      const nextDoc = {
        webhooks: [webhook, ...existing],
        deliveries: Array.isArray(doc.deliveries) ? doc.deliveries : []
      };
      await persistStateDoc(
        'user_webhooks',
        ownerId,
        nextDoc,
        snapshotSource,
        inMemoryWebhooksFallback,
        { webhooks: [], deliveries: [] }
      );
      await appendUserActivity(ownerId, {
        type: 'webhook_created',
        category: 'workspace',
        title: 'Webhook endpoint added',
        description: `Registered ${webhook.name} -> ${webhook.url}`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });
      return res.status(201).json({ success: true, webhook });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to register webhook.' });
    }
  });

  // 22. PUT /user/account/webhooks/:webhookId
  router.put('/user/account/webhooks/:webhookId', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const webhookId = String(req.params.webhookId || '').trim();
      const { doc, snapshotSource } = await loadStateDoc(
        'user_webhooks',
        ownerId,
        { webhooks: [], deliveries: [] },
        inMemoryWebhooksFallback
      );
      const existing = Array.isArray(doc.webhooks) ? doc.webhooks : [];
      const idx = existing.findIndex((w) => w.id === webhookId);
      if (idx === -1) return res.status(404).json({ error: 'Webhook not found.' });

      const updated = {
        ...existing[idx],
        ...(req.body?.active !== undefined ? { active: Boolean(req.body.active) } : {}),
        ...(typeof req.body?.name === 'string' && req.body.name.trim() ? { name: req.body.name.trim().slice(0, 80) } : {}),
        updatedAt: new Date().toISOString()
      };
      const nextHooks = [...existing];
      nextHooks[idx] = updated;
      await persistStateDoc(
        'user_webhooks',
        ownerId,
        { ...doc, webhooks: nextHooks },
        snapshotSource,
        inMemoryWebhooksFallback,
        { webhooks: [], deliveries: [] }
      );
      return res.json({ success: true, webhook: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update webhook.' });
    }
  });

  // 23. POST /user/account/webhooks/:webhookId/test
  router.post('/user/account/webhooks/:webhookId/test', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const webhookId = String(req.params.webhookId || '').trim();
      const { doc, snapshotSource } = await loadStateDoc(
        'user_webhooks',
        ownerId,
        { webhooks: [], deliveries: [] },
        inMemoryWebhooksFallback
      );
      const target = (Array.isArray(doc.webhooks) ? doc.webhooks : []).find((w) => w.id === webhookId);
      if (!target) return res.status(404).json({ error: 'Webhook not found.' });
      const resolved = await resolveAndAssertSafeWebhookUrl(target.url, { dnsLookup: deps.dnsLookup });
      if (!resolved) return res.status(400).json({ error: 'Webhook URL is no longer permitted.' });

      const payloadJson = JSON.stringify({
        id: `evt_${crypto.randomUUID()}`,
        event: target.events?.[0] || 'tiwlo.test',
        ownerId,
        timestamp: new Date().toISOString(),
        test: true
      });
      const signature = crypto
        .createHmac('sha256', target.signingSecret || '')
        .update(payloadJson)
        .digest('hex');

      let ok = false;
      let statusCode = 0;
      let statusText = '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const headers = {
          'Content-Type': 'application/json',
          'X-Tiwlo-Signature': `sha256=${signature}`
        };
        const pingRes = typeof deps.webhookFetch === 'function'
          ? await deps.webhookFetch(
              resolved.url,
              {
                method: 'POST',
                redirect: 'manual',
                signal: controller.signal,
                headers,
                body: payloadJson
              },
              resolved
            )
          : await dispatchPinnedHttpsWebhook({
              url: resolved.url,
              hostname: resolved.hostname,
              addresses: resolved.addresses,
              headers,
              body: payloadJson,
              signal: controller.signal
            });
        statusCode = pingRes.status;
        ok = Boolean(pingRes.ok) && !(statusCode >= 300 && statusCode < 400);
        statusText = pingRes.statusText || (statusCode >= 300 && statusCode < 400 ? 'Redirect blocked' : '');
      } catch (err) {
        statusText = err.name === 'AbortError' ? 'Timed out (5s)' : (err.message || 'Unreachable');
      } finally {
        clearTimeout(timeout);
      }

      const delivery = {
        id: `whd_${crypto.randomUUID()}`,
        webhookId: target.id,
        url: target.url,
        event: target.events?.[0] || 'tiwlo.test',
        ok,
        statusCode,
        statusText,
        createdAt: new Date().toISOString()
      };
      const nextDeliveries = [delivery, ...(Array.isArray(doc.deliveries) ? doc.deliveries : [])].slice(0, 50);
      await persistStateDoc(
        'user_webhooks',
        ownerId,
        { ...doc, deliveries: nextDeliveries },
        snapshotSource,
        inMemoryWebhooksFallback,
        { webhooks: [], deliveries: [] }
      );
      return res.json({ success: true, delivery });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to test webhook.' });
    }
  });

  // 24. DELETE /user/account/webhooks/:webhookId
  router.delete('/user/account/webhooks/:webhookId', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const webhookId = String(req.params.webhookId || '').trim();
      const { doc, snapshotSource } = await loadStateDoc(
        'user_webhooks',
        ownerId,
        { webhooks: [], deliveries: [] },
        inMemoryWebhooksFallback
      );
      const nextHooks = (Array.isArray(doc.webhooks) ? doc.webhooks : []).filter((w) => w.id !== webhookId);
      await persistStateDoc(
        'user_webhooks',
        ownerId,
        { ...doc, webhooks: nextHooks },
        snapshotSource,
        inMemoryWebhooksFallback,
        { webhooks: [], deliveries: [] }
      );
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete webhook.' });
    }
  });

  const DEFAULT_BACKUP_POLICY = {
    enabled: true,
    frequency: 'daily',
    retentionDays: 30,
    preferredWindowUtc: '02:00',
    includeStoreCatalog: true,
    includeOrdersBilling: true,
    includeTeamAudit: true,
    encryptAtRest: true,
    notifyOnFailure: true
  };

  // 25. GET /user/account/backup-policy
  router.get('/user/account/backup-policy', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const { doc } = await loadStateDoc(
        'user_backup_policy',
        ownerId,
        { policy: DEFAULT_BACKUP_POLICY, snapshots: [] },
        inMemoryBackupPolicyFallback
      );
      return res.json({
        policy: { ...DEFAULT_BACKUP_POLICY, ...(doc.policy || {}) },
        snapshots: Array.isArray(doc.snapshots) ? doc.snapshots : []
      });
    } catch {
      return res.status(500).json({ error: 'Failed to load backup policy.' });
    }
  });

  // 26. PUT /user/account/backup-policy
  router.put('/user/account/backup-policy', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const { doc, snapshotSource } = await loadStateDoc(
        'user_backup_policy',
        ownerId,
        { policy: DEFAULT_BACKUP_POLICY, snapshots: [] },
        inMemoryBackupPolicyFallback
      );
      const freq = ['hourly', 'daily', 'weekly'].includes(req.body?.frequency) ? req.body.frequency : 'daily';
      const retentionDays = [7, 14, 30, 90].includes(Number(req.body?.retentionDays))
        ? Number(req.body.retentionDays)
        : 30;
      const nextPolicy = {
        ...DEFAULT_BACKUP_POLICY,
        ...(doc.policy || {}),
        enabled: req.body?.enabled !== undefined ? Boolean(req.body.enabled) : true,
        frequency: freq,
        retentionDays,
        preferredWindowUtc: /^\d{2}:\d{2}$/.test(String(req.body?.preferredWindowUtc || ''))
          ? String(req.body.preferredWindowUtc)
          : '02:00',
        includeStoreCatalog: Boolean(req.body?.includeStoreCatalog ?? true),
        includeOrdersBilling: Boolean(req.body?.includeOrdersBilling ?? true),
        includeTeamAudit: Boolean(req.body?.includeTeamAudit ?? true),
        notifyOnFailure: Boolean(req.body?.notifyOnFailure ?? true),
        updatedAt: new Date().toISOString()
      };
      await persistStateDoc(
        'user_backup_policy',
        ownerId,
        { ...doc, policy: nextPolicy },
        snapshotSource,
        inMemoryBackupPolicyFallback,
        { policy: DEFAULT_BACKUP_POLICY, snapshots: [] }
      );
      await appendUserActivity(ownerId, {
        type: 'backup_policy_updated',
        category: 'workspace',
        title: 'Backup policy updated',
        description: `Schedule ${nextPolicy.enabled ? nextPolicy.frequency : 'disabled'} (${nextPolicy.retentionDays}d retention)`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });
      return res.json({ success: true, policy: nextPolicy });
    } catch {
      return res.status(500).json({ error: 'Failed to save backup policy.' });
    }
  });

  // 27. POST /user/account/backup-policy/run
  router.post('/user/account/backup-policy/run', requireAuthenticatedUser, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const ownerId = String(req.accountUser.id);
      const { doc, snapshotSource } = await loadStateDoc(
        'user_backup_policy',
        ownerId,
        { policy: DEFAULT_BACKUP_POLICY, snapshots: [] },
        inMemoryBackupPolicyFallback
      );
      const policy = { ...DEFAULT_BACKUP_POLICY, ...(doc.policy || {}) };
      const scopes = [
        policy.includeStoreCatalog && 'Catalog/Settings',
        policy.includeOrdersBilling && 'Billing/Orders',
        policy.includeTeamAudit && 'Team/Audit'
      ].filter(Boolean);
      const snapshot = {
        id: `chk_${crypto.randomUUID().slice(0, 8)}`,
        scopeSummary: scopes.join(' · ') || 'Account Metadata',
        retentionDays: policy.retentionDays,
        createdAt: new Date().toISOString()
      };
      const nextSnapshots = [snapshot, ...(Array.isArray(doc.snapshots) ? doc.snapshots : [])].slice(0, 30);
      await persistStateDoc(
        'user_backup_policy',
        ownerId,
        { ...doc, policy, snapshots: nextSnapshots },
        snapshotSource,
        inMemoryBackupPolicyFallback,
        { policy: DEFAULT_BACKUP_POLICY, snapshots: [] }
      );
      await appendUserActivity(ownerId, {
        type: 'backup_checkpoint_created',
        category: 'workspace',
        title: 'Manual backup checkpoint recorded',
        description: `Checkpoint ${snapshot.id} (${snapshot.scopeSummary})`,
        ip: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });
      return res.status(201).json({ success: true, snapshot, snapshots: nextSnapshots });
    } catch {
      return res.status(500).json({ error: 'Failed to record backup checkpoint.' });
    }
  });

  async function handleAccountDeletion(req, res) {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const user = req.accountUser;
      const userId = String(user.id);

      const isSuperAdmin =
        user.role === 'super_admin' ||
        String(user.email || '').toLowerCase().trim() === 'tiwloltd@gmail.com';
      if (isSuperAdmin) {
        return res.status(403).json({
          error: 'Super Administrator accounts cannot be self-deleted.'
        });
      }

      const confirmation = String(req.body?.confirmation || '').trim().toUpperCase();
      if (confirmation !== 'DELETE') {
        return res.status(400).json({
          error: 'Please type DELETE to confirm account deletion.'
        });
      }

      const otpCode = String(req.body?.otpCode || '').trim();
      const otpToken = String(req.body?.otpToken || '').trim();
      if (!otpCode || !otpToken) {
        return res.status(400).json({
          error: 'Email OTP verification is required to delete your account.',
          requiresOtp: true
        });
      }

      const otpVerification = await deps.verifySecureOtp(otpToken, otpCode, USER_ACCOUNT_OTP_PURPOSE);
      if (!otpVerification?.valid) {
        return res.status(400).json({
          error: otpVerification?.error || 'Invalid or expired Email OTP code.'
        });
      }

      const storedOtp = await loadOtpChallenge(userId);
      if (storedOtp?.token && storedOtp.token !== otpToken) {
        return res.status(400).json({ error: 'Verification token mismatch. Please request a new Email OTP.' });
      }

      const suppliedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
      if (suppliedPassword) {
        if (typeof deps.verifyPasswordWithRust !== 'function') {
          return res.status(500).json({ error: 'Password verification service unavailable.' });
        }
        const passwordResult = await deps.verifyPasswordWithRust(userId, suppliedPassword);
        if (!passwordResult?.valid) {
          return res.status(401).json({ error: 'Incorrect account password.' });
        }
      }

      // Preserve billing history, invoices, and orders: disable PICK duty/push alerts
      // and soft-delete the central system_users record so the user can never log in again.
      try {
        await deps.queryPg(
          `UPDATE pick.delivery_profiles
           SET is_on_duty = FALSE, expo_push_token = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE tiwlo_user_id = $1`,
          [userId]
        );
      } catch (pickCleanupErr) {
        if (pickCleanupErr?.code && !['42P01', '3F000'].includes(pickCleanupErr.code)) {
          throw pickCleanupErr;
        }
      }

      if (typeof deps.masterDb.revokeUserSessions === 'function') {
        await deps.masterDb.revokeUserSessions(userId);
      }

      const deletion = await deps.queryPg(
        `UPDATE system_users
         SET is_deleted = TRUE,
             deleted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );
      if (deletion && typeof deletion.rowCount === 'number' && deletion.rowCount === 0) {
        return res.status(404).json({ error: 'Account not found.' });
      }

      await clearOtpChallenge(userId);

      await recordSecurityEvent({
        eventType: 'user.account_deleted',
        severity: 'warning',
        userId,
        subject: user.email || userId,
        details: {
          selfService: true,
          softDelete: true,
          billingHistoryPreserved: true,
          tiwiId: user.tiwiId || user.storeId || null
        }
      }).catch(() => {});

      res.clearCookie?.('tiwlo_host_session', { path: '/' });
      res.clearCookie?.('tiwlo_session', { path: '/' });

      return res.json({
        success: true,
        deleted: true,
        message: "Your account has been deleted and can no longer be used to sign in."
      });
    } catch (error) {
      console.error('[UserAccount] Account deletion error:', error);
      return res.status(500).json({ error: 'Failed to delete account. Please try again or contact support.' });
    }
  }

  // 28. POST /user/account/delete & DELETE /user/account
  router.post('/user/account/delete', requireAuthenticatedUser, handleAccountDeletion);
  router.delete('/user/account', requireAuthenticatedUser, handleAccountDeletion);

  return router;
}

export default createUserAccountRouter();
