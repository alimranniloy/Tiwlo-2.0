import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedWebSsoReturnUrl } from './webSsoReturnUrl.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const hosts = {
  dashboardHost: 'uids.tiwlo.com',
  mailHost: 'tmail.tiwlo.com'
};

test('allows OneProfile and TMail HTTPS SSO return URLs', () => {
  assert.equal(
    isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/oneprofile', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tmail.tiwlo.com/', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tmail.tiwlo.com/inbox?filter=unread', hosts),
    true
  );
});

test('rejects non-HTTPS and untrusted SSO return URLs', () => {
  assert.equal(
    isAllowedWebSsoReturnUrl('http://tmail.tiwlo.com/', hosts),
    false
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://evil.example/oneprofile', hosts),
    false
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/dashboard', hosts),
    false
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tmail.tiwlo.com.evil.example/', hosts),
    false
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://user@tmail.tiwlo.com/', hosts),
    false
  );
  assert.equal(isAllowedWebSsoReturnUrl('/oneprofile', hosts), false);
});

test('exposes the configured dashboard host to the SSO allowlist', () => {
  assert.equal(typeof PLATFORM_CONFIG.dashboardHost, 'string');
  assert.equal(
    isAllowedWebSsoReturnUrl(
      `${PLATFORM_CONFIG.dashboardUrl}/oneprofile`,
      {
        dashboardHost: PLATFORM_CONFIG.dashboardHost,
        mailHost: `${PLATFORM_CONFIG.mailSubdomain}.${PLATFORM_CONFIG.primaryDomain}`
      }
    ),
    true
  );
});
