import crypto from 'crypto';
import '../config/loadRootEnv.js';
import { queryPg } from '../db/postgres.js';
import { hashSecuritySubject, recordSecurityEvent } from '../db/securityPersistence.js';

// Secret key for HMAC signing.
// In production, this is loaded from process.env.SECURITY_SECRET or a securely generated 256-bit key
const SECURITY_SECRET = process.env.SECURITY_SECRET || crypto.randomBytes(32).toString('hex');

// ====================================================================
// 1. ADVANCED PASSWORD HASHING (SCRYPT + SALT + TIMING-SAFE EQUAL)
// ====================================================================
export const PasswordSecurity = {
  /**
   * Hashes a password using crypto.scrypt with a random 16-byte cryptographic salt.
   * Format: scrypt$N:r:p$salt$derivedKey
   */
  hash(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const cost = 16384;
    const blockSize = 8;
    const parallel = 1;
    const key = crypto.scryptSync(password, salt, 64, {
      N: cost,
      r: blockSize,
      p: parallel,
      maxmem: 32 * 1024 * 1024
    }).toString('hex');

    return `scrypt$${cost}:${blockSize}:${parallel}$${salt}$${key}`;
  },

  /**
   * Timing-safe verification of password against stored hash.
   * Also supports seamless backward-compatibility migration for legacy passwords.
   */
  verify(password, storedHash) {
    if (!password || !storedHash) return false;

    // Check if stored hash is in scrypt format
    if (storedHash.startsWith('scrypt$')) {
      try {
        const parts = storedHash.split('$');
        if (parts.length !== 4) return false;
        const [N, r, p] = parts[1].split(':').map(Number);
        const salt = parts[2];
        const expectedKey = parts[3];

        const derivedKey = crypto.scryptSync(password, salt, 64, {
          N,
          r,
          p,
          maxmem: 32 * 1024 * 1024
        }).toString('hex');

        // Prevent timing attacks via crypto.timingSafeEqual
        const keyBuffer = Buffer.from(derivedKey, 'hex');
        const expectedBuffer = Buffer.from(expectedKey, 'hex');
        if (keyBuffer.length !== expectedBuffer.length) return false;

        return crypto.timingSafeEqual(keyBuffer, expectedBuffer);
      } catch (err) {
        console.error('Password verification error:', err);
        return false;
      }
    }

    // Fallback for legacy plaintext during one-time migration:
    // Uses timingSafeEqual to avoid timing side-channels
    const passBuf = Buffer.from(password);
    const storedBuf = Buffer.from(storedHash);
    if (passBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(passBuf, storedBuf);
  }
};

// ====================================================================
// 2. CRYPTOGRAPHIC SESSION MANAGEMENT & CLIENT CONSISTENCY
// ====================================================================
export const SessionSecurity = {
  /**
   * Generates a 384-bit cryptographically secure random session token.
   */
  generateToken() {
    return `sess_${crypto.randomBytes(48).toString('hex')}`;
  },

  /**
   * Stores a stable digest of the client User-Agent as a session consistency check.
   */
  createFingerprint(req) {
    const userAgent = String(req?.headers?.['user-agent'] || 'unknown-client').trim();
    return crypto.createHash('sha256').update(userAgent).digest('hex');
  },

  /**
   * Rejects a session presented by a client with a different User-Agent.
   */
  validateFingerprint(req, storedFingerprint) {
    if (!req || !storedFingerprint) return true;
    const currentFingerprint = this.createFingerprint(req);
    const currentBuffer = Buffer.from(currentFingerprint, 'hex');
    const storedBuffer = Buffer.from(storedFingerprint, 'hex');
    return currentBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(currentBuffer, storedBuffer);
  }
};

// ====================================================================
// 3. PAYMENT TOKENIZATION & ANTI-TAMPER INTEGRITY (HMAC SHA-256)
// ====================================================================
export const PaymentSecurity = {
  /**
   * Issues a cryptographically tokenized payment intent for sales & POS.
   * Signs the exact items, quantity, prices, and totals.
   */
  tokenizePaymentIntent(storeId, items = [], totalAmount, currency = 'USD') {
    const paymentToken = `pay_tok_${crypto.randomBytes(24).toString('hex')}`;
    const timestamp = Date.now();
    const expiresAt = new Date(timestamp + 30 * 60 * 1000).toISOString(); // 30 min lifetime

    // Digest of items (id:qty:price)
    const itemsDigest = (items || [])
      .map(i => `${i.id || i.productId || ''}:${i.quantity || 1}:${parseFloat(i.price || 0).toFixed(2)}`)
      .sort()
      .join('|');

    const canonicalString = `${paymentToken}:${storeId}:${parseFloat(totalAmount).toFixed(2)}:${currency}:${timestamp}:${itemsDigest}`;
    const signature = crypto
      .createHmac('sha256', SECURITY_SECRET)
      .update(canonicalString)
      .digest('hex');

    return {
      paymentToken,
      signature,
      timestamp,
      expiresAt,
      status: 'AUTHORIZED'
    };
  },

  /**
   * Verifies that the client has not tampered with any cart items or the total amount!
   */
  verifyPaymentIntegrity(storeId, paymentToken, signature, timestamp, items = [], totalAmount, currency = 'USD') {
    if (!paymentToken || !signature || !timestamp) return false;

    // Check expiration (30 minutes)
    if (Date.now() - Number(timestamp) > 30 * 60 * 1000) {
      return false; // Expired token
    }

    const itemsDigest = (items || [])
      .map(i => `${i.id || i.productId || ''}:${i.quantity || 1}:${parseFloat(i.price || 0).toFixed(2)}`)
      .sort()
      .join('|');

    const canonicalString = `${paymentToken}:${storeId}:${parseFloat(totalAmount).toFixed(2)}:${currency}:${timestamp}:${itemsDigest}`;
    const expectedSig = crypto
      .createHmac('sha256', SECURITY_SECRET)
      .update(canonicalString)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  }
};

// ====================================================================
// 4. BRUTE-FORCE SHIELD & ACCOUNT LOCKOUT ENGINE
// ====================================================================
export const BruteForceShield = {
  MAX_ATTEMPTS: 5,
  WINDOW_MS: 15 * 60 * 1000,   // 15 minutes window
  LOCKOUT_MS: 15 * 60 * 1000,  // 15 minutes lockout
  checksSinceCleanup: 0,

  normalizeKey(key) {
    if (!key || typeof key !== 'string') return 'unknown';
    let clean = key.split(',')[0].trim().toLowerCase();
    if (clean.startsWith('::ffff:')) clean = clean.substring(7);
    if (clean === '::1') clean = '127.0.0.1';
    return clean;
  },

  async isLocked(key) {
    if (!key) return false;
    const normalized = this.normalizeKey(key);
    const { rows } = await queryPg(
      'SELECT locked_until FROM system_auth_rate_limits WHERE key_hash = $1',
      [hashSecuritySubject(normalized)]
    );
    const record = rows[0];
    if (!record) return false;

    if (record.locked_until && new Date(record.locked_until).getTime() > Date.now()) {
      const remainingSeconds = Math.ceil((new Date(record.locked_until).getTime() - Date.now()) / 1000);
      return { isLocked: true, remainingSeconds };
    }

    await queryPg('DELETE FROM system_auth_rate_limits WHERE key_hash = $1', [hashSecuritySubject(normalized)]);
    return false;
  },

  async recordFailure(key) {
    if (!key) return;
    const normalized = this.normalizeKey(key);
    const keyHash = hashSecuritySubject(normalized);
    const { rows } = await queryPg(
      `INSERT INTO system_auth_rate_limits
         (key_hash, failure_count, first_failure_at, locked_until, updated_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
       ON CONFLICT (key_hash) DO UPDATE SET
         failure_count = CASE
           WHEN system_auth_rate_limits.first_failure_at <
             CURRENT_TIMESTAMP - ($2 * INTERVAL '1 millisecond') THEN 1
           ELSE system_auth_rate_limits.failure_count + 1
         END,
         first_failure_at = CASE
           WHEN system_auth_rate_limits.first_failure_at <
             CURRENT_TIMESTAMP - ($2 * INTERVAL '1 millisecond') THEN CURRENT_TIMESTAMP
           ELSE system_auth_rate_limits.first_failure_at
         END,
         locked_until = CASE
           WHEN CASE
             WHEN system_auth_rate_limits.first_failure_at <
               CURRENT_TIMESTAMP - ($2 * INTERVAL '1 millisecond') THEN 1
             ELSE system_auth_rate_limits.failure_count + 1
           END >= $3
           THEN CURRENT_TIMESTAMP + ($4 * INTERVAL '1 millisecond')
           ELSE NULL
         END,
         updated_at = CURRENT_TIMESTAMP
       RETURNING failure_count, first_failure_at, locked_until`,
      [keyHash, this.WINDOW_MS, this.MAX_ATTEMPTS, this.LOCKOUT_MS]
    );
    const record = rows[0];
    this.checksSinceCleanup += 1;
    if (this.checksSinceCleanup >= 500) {
      this.checksSinceCleanup = 0;
      await queryPg(
        `DELETE FROM system_auth_rate_limits
         WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'`
      );
    }
    if (record.failure_count >= this.MAX_ATTEMPTS) {
      await recordSecurityEvent({
        eventType: 'auth.brute_force_lockout',
        severity: 'warning',
        subject: normalized,
        details: { failureCount: record.failure_count }
      });
    }
    return {
      count: record.failure_count,
      firstAttempt: new Date(record.first_failure_at).getTime(),
      lockedUntil: record.locked_until ? new Date(record.locked_until).getTime() : null
    };
  },

  async recordSuccess(key) {
    if (key) {
      const normalized = this.normalizeKey(key);
      await queryPg('DELETE FROM system_auth_rate_limits WHERE key_hash = $1', [hashSecuritySubject(normalized)]);
    }
  },

  async reset(key) {
    if (key) {
      const normalized = this.normalizeKey(key);
      await queryPg('DELETE FROM system_auth_rate_limits WHERE key_hash = $1', [hashSecuritySubject(normalized)]);
    }
  },

  async clearAll() {
    await queryPg('DELETE FROM system_auth_rate_limits');
  }
};

// ====================================================================
// 5. INPUT SANITIZATION & PROTOTYPE POLLUTION DEFENSE
// ====================================================================
export const InputSanitizer = {
  /**
   * Recursively neutralizes dangerous input, HTML script injections,
   * null-byte injections, and prototype pollution attempts.
   */
  sanitize(input) {
    if (input === null || input === undefined) return input;

    if (typeof input === 'string') {
      // Remove null bytes
      let clean = input.replace(/\0/g, '');
      // Strip potentially executable HTML tags
      clean = clean
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:text\/html/gi, '')
        .replace(/on\w+\s*=/gi, '');
      return clean.trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitize(item));
    }

    if (typeof input === 'object') {
      const sanitizedObj = {};
      for (const [key, value] of Object.entries(input)) {
        // Block Prototype Pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          console.warn(`🚨 [SECURITY ALERT] Blocked prototype pollution attempt on key '${key}'`);
          continue;
        }
        sanitizedObj[key] = this.sanitize(value);
      }
      return sanitizedObj;
    }

    return input;
  },

  /**
   * Validates identifier (email or Tiwi ID: TIW-XXXXX)
   */
  validateIdentifier(id) {
    if (!id || typeof id !== 'string') return false;
    const clean = id.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
    const isTiwiId = /^TIW-[0-9]{4,6}$/i.test(clean);
    return isEmail || isTiwiId;
  }
};

// ====================================================================
// 6. CRYPTOGRAPHIC MOBILE SSO & ANTI-CLONE TRUST HANDSHAKE
// ====================================================================
export const TIWI_APP_TRUST_KEY = process.env.TIWI_APP_TRUST_KEY || '';

export const SsoSecurity = {
  /**
   * Extracts client network IP cleanly
   */
  getClientIp(req) {
    let rawIp = req?.ip || req?.socket?.remoteAddress || '127.0.0.1';
    if (typeof rawIp === 'string') {
      rawIp = rawIp.split(',')[0].trim();
      if (rawIp.startsWith('::ffff:')) rawIp = rawIp.substring(7);
      if (rawIp === '::1') rawIp = '127.0.0.1';
    }
    return rawIp;
  },

  /**
   * Generates a device & network fingerprint hash from mobile hardware/network specs
   */
  generateDeviceFingerprint(mobileData = {}, req = null) {
    const ip = this.getClientIp(req);
    const platform = mobileData.platform || 'mobile';
    const osVersion = mobileData.osVersion || 'unknown';
    const deviceModel = mobileData.deviceModel || 'unknown_device';
    const appVersion = mobileData.appVersion || '1.0.0';
    const networkType = mobileData.networkType || 'cellular/wifi';

    const rawString = `${platform}|${osVersion}|${deviceModel}|${appVersion}|${networkType}|${ip}`;
    const hash = crypto.createHash('sha256').update(rawString).digest('hex');

    return {
      hash,
      platform,
      osVersion,
      deviceModel,
      appVersion,
      networkType,
      ip,
      capturedAt: new Date().toISOString()
    };
  },

  /**
   * Generates a single-use, 60-second cryptographic SSO handshake ticket.
   * Signed with HMAC-SHA256 using server master secret.
   */
  async generateHandshakeTicket({
    userId,
    tiwiId,
    email,
    deviceData = {},
    appTrustToken = null,
    origin = 'tiwi_mobile_app',
    req = null
  }) {
    // 1. Verify App Trust Attestation
    const isAppTrusted = Boolean(TIWI_APP_TRUST_KEY) && appTrustToken === TIWI_APP_TRUST_KEY;

    // 2. Generate secure single-use nonce
    const nonce = `sso_nonce_${crypto.randomBytes(24).toString('hex')}`;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 60 * 1000; // 60 seconds strict TTL

    const deviceFingerprint = this.generateDeviceFingerprint(deviceData, req);

    const payload = {
      userId,
      tiwiId,
      email,
      nonce,
      issuedAt,
      expiresAt,
      origin,
      isAppTrusted,
      deviceFingerprint
    };

    // 3. Create HMAC-SHA256 signature
    const signaturePayload = `${userId}|${tiwiId}|${nonce}|${expiresAt}|${origin}|${deviceFingerprint.hash}`;
    const signature = crypto
      .createHmac('sha256', SECURITY_SECRET)
      .update(signaturePayload)
      .digest('hex');

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const ssoToken = `${encodedPayload}.${signature}`;

    // 4. Save ticket state for replay defense
    await queryPg(
      `INSERT INTO system_sso_nonces (nonce_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [hashSecuritySubject(nonce), userId, new Date(expiresAt)]
    );
    await queryPg('DELETE FROM system_sso_nonces WHERE expires_at < CURRENT_TIMESTAMP');

    return {
      ssoToken,
      nonce,
      expiresAt,
      isAppTrusted,
      deviceFingerprint
    };
  },

  /**
   * Validates and immediately consumes an SSO handshake ticket.
   * If any tampering, expiration, or replay is detected, it fails securely.
   */
  async verifyAndConsumeTicket({ ssoToken, nonce, req = null }) {
    if (!ssoToken || !nonce) {
      return { valid: false, error: 'Missing SSO token or nonce' };
    }

    // Parse token.
    const parts = ssoToken.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Malformed SSO token structure' };
    }

    const [encodedPayload, receivedSignature] = parts;
    let payload;
    try {
      payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    } catch (e) {
      return { valid: false, error: 'Invalid SSO token payload encoding' };
    }

    // Verify nonce match.
    if (payload.nonce !== nonce) {
      return { valid: false, error: 'Nonce mismatch in token payload' };
    }

    // Verify expiration (strictly 60 seconds TTL).
    if (Date.now() > payload.expiresAt) {
      return { valid: false, error: 'SSO handshake token has expired' };
    }

    // Verify Cryptographic HMAC-SHA256 Signature.
    const expectedSignaturePayload = `${payload.userId}|${payload.tiwiId}|${payload.nonce}|${payload.expiresAt}|${payload.origin}|${payload.deviceFingerprint?.hash || ''}`;
    const expectedSignature = crypto
      .createHmac('sha256', SECURITY_SECRET)
      .update(expectedSignaturePayload)
      .digest('hex');

    const sigBuf = Buffer.from(receivedSignature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, error: 'Cryptographic signature verification failed: invalid or forged SSO token' };
    }

    const consumed = await queryPg(
      `DELETE FROM system_sso_nonces
       WHERE nonce_hash = $1 AND user_id = $2 AND expires_at > CURRENT_TIMESTAMP
       RETURNING nonce_hash`,
      [hashSecuritySubject(nonce), payload.userId]
    );
    if (!consumed.rowCount) {
      return { valid: false, error: 'SSO handshake is expired or has already been consumed' };
    }

    return {
      valid: true,
      user: {
        id: payload.userId,
        tiwiId: payload.tiwiId,
        email: payload.email
      },
      origin: payload.origin,
      isAppTrusted: payload.isAppTrusted,
      deviceFingerprint: payload.deviceFingerprint
    };
  }
};
