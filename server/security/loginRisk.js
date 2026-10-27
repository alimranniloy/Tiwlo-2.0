import { hashSecuritySubject, recordSecurityEvent } from '../db/securityPersistence.js';
import { queryPg } from '../db/postgres.js';

function digest(value) {
  return hashSecuritySubject(String(value || 'unknown').trim().toLowerCase());
}

/** Store a privacy-preserving login device/network signal after MFA succeeds. */
export async function recordSuccessfulLoginDevice(user, req) {
  if (!user?.id || !req) return { newDevice: false, newNetwork: false };
  const userId = String(user.id).slice(0, 64);
  const userAgent = String(req.get?.('user-agent') || '').slice(0, 512);
  const clientHints = [
    req.get?.('sec-ch-ua') || '',
    req.get?.('sec-ch-ua-platform') || '',
    req.get?.('sec-ch-ua-mobile') || ''
  ].join('|');
  const platformClass = /android|iphone|ipad|mobile/i.test(`${clientHints}|${userAgent}`)
    ? 'mobile'
    : userAgent ? 'desktop' : 'unknown';
  const deviceHash = digest(`device:${userAgent}|${clientHints}`);
  const identityHash = digest(`account:${userId}:device:${deviceHash}`);
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const ipHash = digest(`ip:${ip}`);
  const userAgentHash = digest(`ua:${userAgent}`);
  const clientHintsHash = clientHints !== '||' ? digest(`hints:${clientHints}`) : null;

  const { rows: knownRows } = await queryPg(
    `SELECT
       EXISTS(SELECT 1 FROM system_user_device_identities WHERE user_id = $1 AND identity_hash = $2) AS known_device,
       EXISTS(SELECT 1 FROM system_user_device_identities WHERE user_id = $1 AND ip_hash = $3) AS known_network`,
    [userId, identityHash, ipHash]
  );
  const newDevice = !knownRows[0]?.known_device;
  const newNetwork = !knownRows[0]?.known_network;

  await queryPg(
    `INSERT INTO system_user_device_identities
       (user_id, identity_hash, device_hash, ip_hash, user_agent_hash, client_hints_hash, platform_class)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, identity_hash) DO UPDATE SET
       ip_hash = EXCLUDED.ip_hash,
       user_agent_hash = EXCLUDED.user_agent_hash,
       client_hints_hash = EXCLUDED.client_hints_hash,
       platform_class = EXCLUDED.platform_class,
       last_seen_at = CURRENT_TIMESTAMP,
       login_count = system_user_device_identities.login_count + 1`,
    [userId, identityHash, deviceHash, ipHash, userAgentHash, clientHintsHash, platformClass]
  );

  if (newDevice) {
    await recordSecurityEvent({
      eventType: 'auth.new_device_login',
      severity: 'warning',
      userId,
      ip,
      userAgent,
      details: { deviceKey: identityHash, platformClass, newNetwork }
    });
  } else if (newNetwork) {
    await recordSecurityEvent({
      eventType: 'auth.new_network_login',
      severity: 'info',
      userId,
      ip,
      userAgent,
      details: { deviceKey: identityHash, platformClass }
    });
  }

  return { newDevice, newNetwork };
}
