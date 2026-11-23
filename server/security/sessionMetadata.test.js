import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  extractSessionClientMetadata,
  getCandidateSessionTokens,
  hashSessionIdentifier,
  listEnrichedUserSessions,
  revokeUserSessionByHash,
  summarizeSessionDevice
} from './sessionMetadata.js';
import { getLastSessionTouch, markSessionTouched } from './sessionTouchCache.js';

test('summarizeSessionDevice identifies PICK mobile devices, standard mobile browsers, and desktop browsers', () => {
  const pickAndroid = summarizeSessionDevice(
    'PICK/1.0.2 (Android 14; Samsung SM-S918B) Mobile',
    'Samsung SM-S918B',
    'PICK App'
  );
  assert.equal(pickAndroid.platform, 'mobile');
  assert.equal(pickAndroid.appName, 'PICK App');
  assert.match(pickAndroid.device, /Samsung SM-S918B/);
  assert.equal(pickAndroid.os, 'Android 14');

  const mobileWeb = summarizeSessionDevice(
    'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
  );
  assert.equal(mobileWeb.platform, 'mobile');
  assert.equal(mobileWeb.browser, 'Chrome');
  assert.equal(mobileWeb.os, 'Android 13');
  assert.match(mobileWeb.device, /SM-A536E/);

  const desktopWeb = summarizeSessionDevice(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  assert.equal(desktopWeb.platform, 'desktop');
  assert.equal(desktopWeb.appName, 'Tiwlo Web');
  assert.equal(desktopWeb.device, 'Chrome on Windows 10/11');
});

test('extractSessionClientMetadata reads forwarded IP and mobile headers cleanly', () => {
  const meta = extractSessionClientMetadata({
    ip: '103.145.12.88',
    headers: {
      'user-agent': 'PICK/1.0.2 (Android 14; Xiaomi 23049PCD8G) Mobile',
      'x-device-name': 'Xiaomi 23049PCD8G',
      'x-app-name': 'PICK App'
    }
  });
  assert.equal(meta.ip, '103.145.12.88');
  assert.equal(meta.deviceName, 'Xiaomi 23049PCD8G');
  assert.equal(meta.appName, 'PICK App');
  assert.equal(hashSessionIdentifier('abc').length, 24);
});

test('getCandidateSessionTokens extracts deduplicated valid tokens in precedence order', () => {
  const tokens = getCandidateSessionTokens({
    cookies: { tiwlo_host_session: '[object Object]' },
    headers: {
      authorization: 'Bearer fresh-bearer-token',
      'x-session-token': 'fallback-header-token'
    }
  });
  assert.deepEqual(tokens, ['fresh-bearer-token', 'fallback-header-token']);

  const withCookieAndBearer = getCandidateSessionTokens({
    cookies: { tiwlo_host_session: 'stale-cookie-token' },
    headers: { authorization: 'Bearer fresh-bearer-token' }
  });
  assert.deepEqual(withCookieAndBearer, ['stale-cookie-token', 'fresh-bearer-token']);
});

test('listEnrichedUserSessions enriches location and revokeUserSessionByHash avoids empty-string collision and clears touch cache', async () => {
  const webRaw = 'web-session-raw-token';
  const mobileRaw = 'mobile-bearer-raw-token';
  const webHash = crypto.createHash('sha256').update(webRaw).digest('hex');
  const mobileHash = crypto.createHash('sha256').update(mobileRaw).digest('hex');

  const rows = [
    {
      token: webHash,
      session_token: '',
      ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36',
      device_name: 'Desktop Browser',
      app_name: 'Tiwlo Web',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400_000).toISOString()
    },
    {
      token: mobileHash,
      session_token: '',
      ip: '103.145.12.88',
      user_agent: 'PICK/1.0.2 (Android 14; Pixel 8) Mobile',
      device_name: 'Pixel 8',
      app_name: 'PICK App',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400_000).toISOString()
    }
  ];

  const queryPg = async (sql, params = []) => {
    const q = String(sql);
    if (/FROM system_sessions/i.test(q) && /SELECT/i.test(q)) {
      return {
        rows: rows.map((r) => ({
          ...r,
          token_ref: r.session_token || r.token
        }))
      };
    }
    if (/FROM system_user_login_locations/i.test(q)) {
      return {
        rows: [
          {
            session_key: crypto.createHash('sha256').update(mobileHash).digest('hex'),
            location_source: 'gps',
            formatted_address: 'Banani, Dhaka, Bangladesh',
            area: 'Banani, Dhaka',
            captured_at: new Date().toISOString()
          }
        ]
      };
    }
    if (/DELETE FROM system_sessions/i.test(q)) {
      // params[0] is userId; params[1] should NEVER be ''
      assert.ok(params.slice(1).every((p) => typeof p === 'string' && p.length > 0));
      const targetVals = new Set(params.slice(1));
      for (let i = rows.length - 1; i >= 0; i--) {
        if (targetVals.has(rows[i].token) || targetVals.has(rows[i].session_token)) {
          rows.splice(i, 1);
        }
      }
      return { rowCount: 1 };
    }
    return { rows: [] };
  };

  const listed = await listEnrichedUserSessions(queryPg, 'usr_1', [webRaw]);
  assert.equal(listed.sessions.length, 2);
  const webItem = listed.sessions.find((s) => s.appName === 'Tiwlo Web');
  const mobItem = listed.sessions.find((s) => s.appName === 'PICK App');
  assert.equal(webItem.isCurrent, true);
  assert.equal(webItem.location, 'Local Network');
  assert.equal(mobItem.isCurrent, false);
  assert.equal(mobItem.location, 'Banani, Dhaka');

  markSessionTouched(mobileHash, Date.now());
  assert.ok(getLastSessionTouch(mobileHash) > 0);

  const removed = await revokeUserSessionByHash(queryPg, 'usr_1', mobItem.id);
  assert.equal(removed, true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].token, webHash);
  assert.equal(getLastSessionTouch(mobileHash), 0);
});
