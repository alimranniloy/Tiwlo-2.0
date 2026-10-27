import test from 'node:test';
import assert from 'node:assert/strict';
import { setSessionCookie } from './authRoutes.js';

test('session cookies are shared across the platform domain and legacy cookies are cleared', () => {
  const cookies = [];
  const cleared = [];
  const response = {
    cookie: (...args) => cookies.push(args),
    clearCookie: (...args) => cleared.push(args)
  };

  setSessionCookie(response, { headers: { host: 'shop.tiwlo.com' } }, 'session-token');

  assert.equal(cookies[0][0], 'tiwlo_host_session');
  assert.equal(cookies[0][2].domain, '.tiwlo.com');
  assert.equal(cookies[0][2].httpOnly, true);
  assert.ok(cleared.some(([name, options]) => name === 'tiwlo_session' && options?.domain === '.tiwlo.com'));
});
