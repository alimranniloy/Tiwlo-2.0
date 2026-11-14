import assert from 'node:assert/strict';
import test from 'node:test';
import { isInternalTlsAskClient } from './systemRoutes.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

test('TLS ask allows loopback and private Docker bridge IPs without forwarding headers', () => {
  for (const remoteAddress of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:172.30.240.6', '172.18.0.4', '10.0.0.5', '192.168.1.2']) {
    assert.equal(
      isInternalTlsAskClient({ socket: { remoteAddress }, headers: {} }),
      true,
      `Expected ${remoteAddress} to be allowed`
    );
  }
});

test('TLS ask rejects public IPs and any proxied request carrying forwarding headers', () => {
  assert.equal(isInternalTlsAskClient({ socket: { remoteAddress: '203.0.113.10' }, headers: {} }), false);
  assert.equal(
    isInternalTlsAskClient({ socket: { remoteAddress: '172.30.240.6' }, headers: { 'x-forwarded-for': '203.0.113.10' } }),
    false
  );
  assert.equal(
    isInternalTlsAskClient({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'cf-connecting-ip': '203.0.113.10' } }),
    false
  );
});

test('Platform managed domains include root, auth, pick, uids, and www hosts', () => {
  for (const host of ['tiwlo.com', 'www.tiwlo.com', 'auth.tiwlo.com', 'pick.tiwlo.com', 'uids.app', 'www.uids.app']) {
    assert.equal(PLATFORM_CONFIG.managedDomains.includes(host), true, `Missing managed host: ${host}`);
  }
});
