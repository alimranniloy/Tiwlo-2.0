import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWebSsoBridgeUrl,
  isAllowedSocialReturnUrl,
  isAllowedWebSsoReturnUrl
} from './webSsoReturnUrl.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const hosts = {
  dashboardHost: 'uids.tiwlo.com',
  mailHost: 'tmail.tiwlo.com',
  platformHost: 'tiwlo.com'
};

test('allows UIDS product and TMail HTTPS SSO return URLs', () => {
  assert.equal(
    isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/oneprofile', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/product/123', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl(
      'https://uids.app/authorize?next=https%3A%2F%2Ftiwlo.com%2Fdashboard',
      { ...hosts, dashboardHosts: ['uids.app'] }
    ),
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
  assert.equal(isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/login', hosts), false);
  assert.equal(isAllowedWebSsoReturnUrl('https://uids.tiwlo.com/api/auth/session', hosts), false);
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

test('allows only the fixed Tiwlo app callback for mobile social sign-in', () => {
  assert.equal(isAllowedSocialReturnUrl('tiwlo://auth/callback', hosts), true);
  assert.equal(isAllowedSocialReturnUrl('tiwlo://evil/callback', hosts), false);
  assert.equal(isAllowedSocialReturnUrl('pick://auth/callback', hosts), true);
  assert.equal(isAllowedSocialReturnUrl('pick://evil/callback', hosts), false);
  assert.equal(isAllowedSocialReturnUrl('javascript:alert(1)', hosts), false);
  assert.equal(
    isAllowedSocialReturnUrl('https://tiwlo.com/dashboard', hosts),
    true
  );
});

test('allows platform app routes but rejects auth and API endpoints', () => {
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tiwlo.com/dashboard', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tiwlo.com/products?sort=name', hosts),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tiwlo.com/login', hosts),
    false
  );
  assert.equal(
    isAllowedWebSsoReturnUrl('https://tiwlo.com/api/auth/sso/web-start', hosts),
    false
  );
});

test('allows the PICK dashboard as a Tiwlo-authenticated SSO return destination', () => {
  const allowlist = {
    ...hosts,
    dashboardHosts: [PLATFORM_CONFIG.pickDashboardHost]
  };
  assert.equal(
    isAllowedWebSsoReturnUrl(`https://${PLATFORM_CONFIG.pickDashboardHost}/dashboard`, allowlist),
    true
  );
  assert.equal(
    isAllowedWebSsoReturnUrl(`https://${PLATFORM_CONFIG.pickDashboardHost}/api/auth/sso/consume-handoff`, allowlist),
    false
  );
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

test('creates a platform-origin bridge only for an allowlisted TMail return URL', () => {
  assert.equal(
    getWebSsoBridgeUrl('https://tmail.tiwlo.com/inbox', {
      platformUrl: 'https://tiwlo.com',
      ...hosts
    }),
    'https://tiwlo.com/?web_sso_return_to=https%3A%2F%2Ftmail.tiwlo.com%2Finbox'
  );
  assert.equal(
    getWebSsoBridgeUrl('https://uids.tiwlo.com/oneprofile', {
      platformUrl: 'https://tiwlo.com',
      ...hosts
    }),
    null
  );
  assert.equal(
    getWebSsoBridgeUrl('https://tmail.tiwlo.com/', {
      platformUrl: 'https://evil.example',
      ...hosts
    }),
    null
  );
  assert.equal(
    getWebSsoBridgeUrl('https://tmail.tiwlo.com/', {
      platformUrl: 'http://tiwlo.com',
      ...hosts
    }),
    null
  );
});
