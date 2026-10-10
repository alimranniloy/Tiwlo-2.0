import { createHmac } from 'node:crypto';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const IDENTITY_SECRET = process.env.ABUSE_HASH_SECRET ||
  process.env.SECURITY_SECRET ||
  PLATFORM_CONFIG.primaryDomain;

function hashSignal(label, value) {
  return createHmac('sha256', IDENTITY_SECRET)
    .update(`${label}:${String(value || 'unknown').trim()}`)
    .digest('hex');
}

function getClientHints(request) {
  const headers = request?.headers || {};
  return [
    headers['sec-ch-ua'],
    headers['sec-ch-ua-mobile'],
    headers['sec-ch-ua-platform']
  ].map(value => String(value || '').trim()).join('|');
}

export function getDeviceIdentitySignals(request, userId) {
  const headers = request?.headers || {};
  const ip = request?.ip || request?.socket?.remoteAddress || 'unknown';
  const userAgent = headers['user-agent'] || 'unknown-client';
  const deviceCookie = request?.cookies?.uids_device || '';
  const clientHints = getClientHints(request);
  const identityMaterial = deviceCookie || `${userAgent}|${clientHints}|${ip}`;

  return {
    userId,
    identityHash: hashSignal('identity', identityMaterial),
    deviceHash: deviceCookie ? hashSignal('device-cookie', deviceCookie) : null,
    ipHash: hashSignal('ip', ip),
    userAgentHash: hashSignal('user-agent', userAgent),
    clientHintsHash: clientHints ? hashSignal('client-hints', clientHints) : null,
    platformClass: String(headers['sec-ch-ua-platform'] || 'unknown')
      .replace(/["']/g, '').slice(0, 32) || 'unknown'
  };
}
