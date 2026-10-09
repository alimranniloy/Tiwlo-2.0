import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { configureTrustedProxy } from './proxyTrust.js';

function clientIp(remoteAddress, forwarded, trusted) {
  const app = express();
  configureTrustedProxy(app, trusted);
  const req = Object.create(app.request);
  req.app = app;
  req.connection = { remoteAddress };
  req.headers = { 'x-forwarded-for': forwarded };
  return req.ip;
}

test('direct public clients cannot choose their IP using forwarded headers', () => {
  assert.equal(clientIp('198.51.100.1', '192.0.2.10', 'loopback'), '198.51.100.1');
});
test('trusted Nginx resolves the nearest untrusted hop, ignoring injected prefixes', () => {
  assert.equal(clientIp('127.0.0.1', '192.0.2.10, 198.51.100.1', 'loopback'), '198.51.100.1');
});
test('explicit private proxy addresses support container deployments', () => {
  assert.equal(clientIp('172.18.0.2', '198.51.100.1', '172.18.0.2/32'), '198.51.100.1');
});
