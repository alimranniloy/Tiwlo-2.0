import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  areValidParcelPins,
  createPickCallbackUrl,
  createPickMobileHandoff,
  getPickMobileLoginUrl,
  hashPickCodeVerifier,
  isValidPickCodeChallenge,
  parseGroceryDeliveryFee
} from './routes.js';
import { getPickPaymentProviders } from './payments.js';

test('exposes only enabled live BDT payment providers without credentials', () => {
  const providers = getPickPaymentProviders({
    bkash: {
      id: 'bkash',
      name: 'bKash',
      enabled: true,
      mode: 'live',
      appKey: 'key',
      appSecret: 'secret',
      username: 'user',
      password: 'password',
      currencies: ['BDT']
    },
    sslcommerz: {
      enabled: true,
      mode: 'sandbox',
      storeId: 'store',
      storePassword: 'password',
      currencies: ['BDT']
    },
    stripe: {
      enabled: true,
      mode: 'live',
      secretKey: 'secret',
      currencies: ['USD']
    }
  });

  assert.deepEqual(providers, [{ id: 'bkash', name: 'bKash', currency: 'BDT' }]);
  assert.equal(JSON.stringify(providers).includes('secret'), false);
});

test('accepts only configured, non-negative grocery delivery fees', () => {
  assert.equal(parseGroceryDeliveryFee('35'), 35);
  assert.equal(parseGroceryDeliveryFee('35.50'), 35.5);
  assert.equal(parseGroceryDeliveryFee('0'), 0);
  assert.equal(parseGroceryDeliveryFee(''), null);
  assert.equal(parseGroceryDeliveryFee('-1'), null);
  assert.equal(parseGroceryDeliveryFee('1.234'), null);
  assert.equal(parseGroceryDeliveryFee('1000001'), null);
});

test('validates PKCE S256 challenges and verifiers', () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const expected = crypto.createHash('sha256').update(verifier).digest('base64url');

  assert.equal(isValidPickCodeChallenge(expected), true);
  assert.equal(isValidPickCodeChallenge('not-a-challenge'), false);
  assert.equal(hashPickCodeVerifier(verifier), expected);
  assert.throws(() => hashPickCodeVerifier('short'), /Invalid sign-in verifier/);
});

test('requires finite in-range pickup and delivery map pins', () => {
  assert.equal(areValidParcelPins(
    { latitude: 23.8103, longitude: 90.4125 },
    { latitude: 23.7806, longitude: 90.4070 }
  ), true);
  assert.equal(areValidParcelPins(
    { latitude: 23.8103, longitude: 90.4125 },
    { latitude: null, longitude: null }
  ), false);
  assert.equal(areValidParcelPins(
    { latitude: 91, longitude: 90 },
    { latitude: 23.7806, longitude: 90.4070 }
  ), false);
});

test('creates a callback URL containing only the one-time code and state', () => {
  const callback = new URL(createPickCallbackUrl({
    code: 'a'.repeat(43),
    state: 'b'.repeat(43)
  }));

  assert.equal(callback.protocol, 'pick:');
  assert.equal(callback.host, 'auth');
  assert.equal(callback.pathname, '/callback');
  assert.equal(callback.searchParams.get('code'), 'a'.repeat(43));
  assert.equal(callback.searchParams.get('state'), 'b'.repeat(43));
  assert.equal(callback.hash, '');
});

test('creates PICK login URLs that preserve the callback and force account selection', () => {
  const url = new URL(getPickMobileLoginUrl({
    codeChallenge: 'c'.repeat(43),
    state: 's'.repeat(43),
    mode: 'signup'
  }));

  assert.equal(url.pathname, '/create-account');
  assert.equal(url.searchParams.get('return_to'), 'pick://auth/callback');
  assert.equal(url.searchParams.get('sso_login'), '1');
  assert.equal(url.searchParams.get('pick_code_challenge'), 'c'.repeat(43));
  assert.equal(url.searchParams.get('pick_state'), 's'.repeat(43));
  assert.equal(url.searchParams.get('pick_account'), '1');
});

test('stores only a hashed, expiring one-time handoff code', async () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const params = [];
  const callbackUrl = await createPickMobileHandoff({
    userId: 'tiwlo-user-1',
    codeChallenge,
    state: 's'.repeat(43),
    query: async (_sql, values) => {
      params.push(...values);
      return { rows: [] };
    }
  });
  const callback = new URL(callbackUrl);

  assert.match(params[0], /^[a-f0-9]{64}$/);
  assert.equal(params[1], 'tiwlo-user-1');
  assert.equal(params[2], codeChallenge);
  assert.equal(callback.searchParams.get('state'), 's'.repeat(43));
  assert.notEqual(callback.searchParams.get('code'), params[0]);
  await assert.rejects(createPickMobileHandoff({
    userId: 'tiwlo-user-1',
    codeChallenge: 'invalid',
    state: 's'.repeat(43),
    query: async () => ({ rows: [] })
  }), /Invalid PICK sign-in handoff/);
});
