import crypto from 'node:crypto';

export const PAYMENT_PROVIDER_DEFINITIONS = Object.freeze({
  bkash: {
    id: 'bkash',
    name: 'bKash',
    currencies: ['BDT'],
    credentialFields: ['appKey', 'appSecret', 'username', 'password']
  },
  nagad: {
    id: 'nagad',
    name: 'Nagad',
    currencies: ['BDT'],
    credentialFields: ['merchantId', 'merchantPrivateKey', 'nagadPublicKey']
  },
  sslcommerz: {
    id: 'sslcommerz',
    name: 'SSLCOMMERZ',
    currencies: ['BDT'],
    credentialFields: ['storeId', 'storePassword']
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    currencies: ['USD', 'EUR', 'GBP'],
    credentialFields: ['secretKey', 'webhookSecret']
  },
  paypal: {
    id: 'paypal',
    name: 'PayPal',
    currencies: ['USD', 'EUR', 'GBP'],
    credentialFields: ['clientId', 'clientSecret']
  }
});

export const CHECKOUT_READY_PROVIDERS = new Set(['bkash', 'sslcommerz', 'stripe', 'paypal']);

const ENCRYPTION_CONTEXT = Buffer.from('tiwlo-store-payment-credentials-v1');

function getEncryptionKey() {
  const secret = process.env.SECURITY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('A stable SECURITY_SECRET of at least 32 characters is required to save payment credentials.');
  }
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(secret),
    ENCRYPTION_CONTEXT,
    ENCRYPTION_CONTEXT,
    32
  ));
}

function getProviderDefinition(provider) {
  const definition = PAYMENT_PROVIDER_DEFINITIONS[provider];
  if (!definition) throw new TypeError('Unsupported payment provider.');
  return definition;
}

export function validatePaymentProviderConfiguration(provider, input = {}) {
  const definition = getProviderDefinition(provider);
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    throw new TypeError('enabled must be true or false.');
  }
  if (input.mode !== undefined && !['sandbox', 'live'].includes(input.mode)) {
    throw new TypeError('Payment provider mode must be sandbox or live.');
  }
  if (input.feePercent !== undefined &&
      (!Number.isFinite(Number(input.feePercent)) || Number(input.feePercent) < 0 || Number(input.feePercent) > 100)) {
    throw new TypeError('Payment fee percent must be between 0 and 100.');
  }
  if (input.feeFixed !== undefined &&
      (!Number.isFinite(Number(input.feeFixed)) || Number(input.feeFixed) < 0)) {
    throw new TypeError('Fixed payment fee must be a non-negative amount.');
  }
  if (input.feeMode !== undefined && !['included', 'customer'].includes(input.feeMode)) {
    throw new TypeError('Payment fee must be included in the price or added to the customer total.');
  }

  const credentials = input.credentials || {};
  if (typeof credentials !== 'object' || Array.isArray(credentials)) {
    throw new TypeError('Payment credentials must be provided as named fields.');
  }
  for (const [key, value] of Object.entries(credentials)) {
    if (!definition.credentialFields.includes(key) || typeof value !== 'string' || value.length > 16000) {
      throw new TypeError(`Invalid payment credential field: ${key}.`);
    }
  }
  return definition;
}

export function normalizePaymentProviderConfiguration(provider, input = {}, current = {}) {
  const definition = validatePaymentProviderConfiguration(provider, input);
  const credentials = { ...(current.credentials || {}) };
  for (const [key, value] of Object.entries(input.credentials || {})) {
    if (value.trim()) credentials[key] = value.trim();
  }
  const enabled = input.enabled ?? current.enabled ?? false;
  if (enabled) {
    const missing = definition.credentialFields.filter(field => !credentials[field]);
    if (missing.length) {
      throw new TypeError(`Add the required ${definition.name} merchant credentials before enabling this payment method.`);
    }
  }
  return {
    config: {
      enabled,
      mode: input.mode ?? current.mode ?? 'sandbox',
      feePercent: Number(input.feePercent ?? current.feePercent ?? 0),
      feeFixed: Number(input.feeFixed ?? current.feeFixed ?? 0),
      feeMode: input.feeMode ?? current.feeMode ?? 'included'
    },
    credentials
  };
}

export function encryptPaymentCredentials(tiwiId, provider, credentials) {
  const definition = getProviderDefinition(provider);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.concat([ENCRYPTION_CONTEXT, Buffer.from(`:${tiwiId}:${definition.id}`)]));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final()
  ]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptPaymentCredentials(tiwiId, provider, record) {
  const definition = getProviderDefinition(provider);
  if (!record?.ciphertext || !record?.iv || !record?.authTag) {
    throw new TypeError('Encrypted merchant credentials are missing.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), record.iv);
  decipher.setAAD(Buffer.concat([ENCRYPTION_CONTEXT, Buffer.from(`:${tiwiId}:${definition.id}`)]));
  decipher.setAuthTag(record.authTag);
  const plaintext = Buffer.concat([
    decipher.update(record.ciphertext),
    decipher.final()
  ]).toString('utf8');
  const credentials = JSON.parse(plaintext);
  validatePaymentProviderConfiguration(provider, { credentials });
  return credentials;
}

export function toPublicPaymentProvider(provider, config = {}, credentialRecord = null) {
  const definition = getProviderDefinition(provider);
  return {
    id: definition.id,
    name: definition.name,
    currencies: definition.currencies,
    enabled: config.enabled === true && Boolean(credentialRecord),
    configured: Boolean(credentialRecord),
    checkoutReady: CHECKOUT_READY_PROVIDERS.has(definition.id),
    mode: config.mode === 'live' ? 'live' : 'sandbox',
    feePercent: Number(config.feePercent) || 0,
    feeFixed: Number(config.feeFixed) || 0,
    feeMode: config.feeMode === 'customer' ? 'customer' : 'included'
  };
}
