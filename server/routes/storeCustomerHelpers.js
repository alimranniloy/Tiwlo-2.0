import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { amountToCents } from '../../shared/accountingHelpers.mjs';

export const CUSTOMER_SESSION_COOKIE = 'tiwlo_store_customer_session';
export const CUSTOMER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeCustomerEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TypeError('Enter a valid email address.');
  }
  return email;
}

export function getCustomerOtpType(tiwiId) {
  const tenantDigest = createHash('sha256').update(String(tiwiId)).digest('hex').slice(0, 17);
  return `store_customer_${tenantDigest}`;
}

export function hashCustomerSessionToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export function createCustomerSession(accountId, now = Date.now()) {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    record: {
      id: randomUUID(),
      accountId,
      tokenHash: hashCustomerSessionToken(token),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CUSTOMER_SESSION_MAX_AGE_MS).toISOString()
    }
  };
}

export function findCustomerSession(sessions, token, now = Date.now()) {
  if (!token || !Array.isArray(sessions)) return null;
  const candidateHash = Buffer.from(hashCustomerSessionToken(token), 'hex');
  return sessions.find(session => {
    const expiresAt = Date.parse(session?.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now ||
        !/^[a-f0-9]{64}$/.test(session?.tokenHash || '')) return false;
    const storedHash = Buffer.from(session.tokenHash, 'hex');
    return storedHash.length === candidateHash.length && timingSafeEqual(storedHash, candidateHash);
  }) || null;
}

export function normalizeCustomerAddress(input, id = randomUUID()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Provide an address object.');
  }
  const fields = {
    label: 40,
    recipient: 120,
    phone: 40,
    line1: 200,
    line2: 200,
    city: 100,
    region: 100,
    postalCode: 32,
    countryCode: 2,
    country: 100
  };
  const address = { id };
  for (const [key, maxLength] of Object.entries(fields)) {
    const value = String(input[key] || '').trim();
    if (value.length > maxLength) throw new TypeError(`${key} must be no longer than ${maxLength} characters.`);
    address[key] = value;
  }
  if (!address.recipient || !address.phone || !address.line1 || !address.city || !address.country) {
    throw new TypeError('Recipient, phone, address, city, and country are required.');
  }
  address.countryCode = address.countryCode.toUpperCase();
  if (address.countryCode && !/^[A-Z]{2}$/.test(address.countryCode)) {
    throw new TypeError('Country code must be a two-letter ISO code.');
  }
  address.isDefault = input.isDefault === true;
  return address;
}

export function validateCustomerReview(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Review data is required.');
  }
  const rating = Number(input.rating);
  const title = String(input.title || '').trim();
  const body = String(input.body || '').trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new TypeError('Rating must be a whole number from 1 to 5.');
  }
  if (title.length > 120 || body.length < 10 || body.length > 3000) {
    throw new TypeError('Add a review from 10 to 3000 characters and a title no longer than 120 characters.');
  }
  return { rating, title, body };
}

export function canReviewOrder(order, productId, customerId) {
  return Boolean(
    order && String(order.customerAccountId || '') === String(customerId) &&
    String(order.status || '').toLowerCase() === 'delivered' &&
    (order.items || []).some(item => String(item.productId || item.id) === String(productId))
  );
}

export function canEditStoreOrder(order) {
  return ['Pending', 'Confirmed'].includes(order?.status || 'Pending');
}

export function normalizeRefundAmount(value, order, existingRefunds = []) {
  const amountCents = amountToCents(value);
  const totalCents = amountToCents(order?.totalAmount);
  let reservedCents = 0;
  for (const refund of existingRefunds) {
    if (![
      'requested',
      'approved',
      'gateway_processing',
      'gateway_pending',
      'gateway_unknown',
      'manually_processed',
      'gateway_confirmed'
    ].includes(refund.status)) continue;
    const existingCents = amountToCents(refund.amount);
    if (existingCents === null || !Number.isSafeInteger(reservedCents + existingCents)) {
      throw new TypeError('Existing refund history cannot be totaled safely.');
    }
    reservedCents += existingCents;
  }
  if (amountCents === null || amountCents <= 0 || totalCents === null ||
      reservedCents > totalCents || amountCents > totalCents - reservedCents) {
    throw new TypeError('Refund amount must be positive and cannot exceed the remaining paid order balance.');
  }
  return amountCents / 100;
}
