import crypto from 'crypto';
import '../config/loadRootEnv.js';
import {
  checkAuthRateLimitWithRust,
  clearAuthRateLimitWithRust,
  generateSsoHandshakeWithRust,
  recordAuthRateLimitFailureWithRust,
  verifySsoHandshakeWithRust
} from './rustAuthSessionClient.js';

// Secret key for HMAC signing.
// In production, this is loaded from process.env.SECURITY_SECRET or a securely generated 256-bit key
const SECURITY_SECRET = process.env.SECURITY_SECRET || crypto.randomBytes(32).toString('hex');

// ====================================================================
// PAYMENT TOKENIZATION & ANTI-TAMPER INTEGRITY (HMAC SHA-256)
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
// BRUTE-FORCE SHIELD & ACCOUNT LOCKOUT ENGINE
// ====================================================================
export const BruteForceShield = {
  async isLocked(key) {
    if (!key) return false;
    return checkAuthRateLimitWithRust(key);
  },

  async recordFailure(key) {
    if (!key) return;
    return recordAuthRateLimitFailureWithRust(key);
  },

  async recordSuccess(key) {
    if (key) await clearAuthRateLimitWithRust(key);
  }
};

// ====================================================================
// INPUT SANITIZATION & PROTOTYPE POLLUTION DEFENSE
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
export const SsoSecurity = {
  generateHandshakeTicket(options) {
    return generateSsoHandshakeWithRust({
      ...options,
      request: options?.req
    });
  },

  verifyAndConsumeTicket(options) {
    return verifySsoHandshakeWithRust(options);
  }
};
