import test from 'node:test';
import assert from 'node:assert/strict';
import { setSessionCookie } from './authRoutes.js';

test('session cookies are host-only and legacy shared-domain cookies are cleared', () => {
  const cookies = [];
  const cleared = [];
  const response = {
    cookie: (...args) => cookies.push(args),
    clearCookie: (...args) => cleared.push(args)
  };

  setSessionCookie(response, { headers: { host: 'shop.tiwlo.com' } }, 'session-token');

  assert.equal(cookies[0][0], 'tiwlo_host_session');
  assert.equal(cookies[0][2].domain, undefined);
  assert.equal(cookies[0][2].httpOnly, true);
  assert.ok(cleared.some(([name, options]) => name === 'tiwlo_session' && options?.domain === '.tiwlo.com'));
});
