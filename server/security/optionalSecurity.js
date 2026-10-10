import { createHash } from 'node:crypto';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { queryPg } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';

let redisClient = null;
const riskCounters = new Map();
const AUTOMATION_PATTERN = /(curl|wget|python-requests|scrapy|selenium|headlesschrome|phantomjs|nikto|sqlmap|爬虫)/i;
const SENSITIVE_PATH_PATTERN = /^\/(?:api\/)?(?:auth|subdomains|domains|graphql)(?:\/|$)/i;

function requestFingerprint(req) {
  return createHash('sha256')
    .update([
      req.ip || req.socket?.remoteAddress || 'unknown',
      req.get?.('user-agent') || 'unknown',
      req.activeUser?.id || 'anonymous'
    ].join('|'))
    .digest('hex');
}

function isSuspiciousRequest(req) {
  if (!SENSITIVE_PATH_PATTERN.test(req.path || req.originalUrl || '')) return false;
  const userAgent = req.get?.('user-agent') || '';
  return !userAgent || AUTOMATION_PATTERN.test(userAgent);
}

async function enforceRepeatedAbuse(req) {
  const userId = req.activeUser?.id;
  if (!userId || process.env.LOCAL_SECURITY_ENFORCE !== 'true') return;

  const key = `user:${userId}`;
  const now = Date.now();
  const windowMs = Number(process.env.LOCAL_SECURITY_WINDOW_MS || 24 * 60 * 60 * 1000);
  const previous = riskCounters.get(key);
  const current = previous && previous.expiresAt > now
    ? { count: previous.count + 1, expiresAt: previous.expiresAt }
    : { count: 1, expiresAt: now + windowMs };
  riskCounters.set(key, current);
  if (current.count < 5) return;

  const reason = 'Repeated automated requests on protected endpoints';
  await queryPg(
    `INSERT INTO system_account_security
      (user_id, strikes, permanently_disabled, last_reason, updated_at)
     VALUES ($1, 1, TRUE, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       strikes = system_account_security.strikes + 1,
       permanently_disabled = TRUE,
       last_reason = EXCLUDED.last_reason,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, reason]
  );
  await queryPg(
    `UPDATE system_users
     SET is_banned = TRUE, ban_reason = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND is_banned = FALSE`,
    [userId, reason]
  );
  await queryPg('DELETE FROM system_sessions WHERE user_id = $1', [userId]);
  await recordSecurityEvent({
    eventType: 'security.account_disabled_automated_abuse',
    severity: 'critical',
    userId,
    ip: req.ip,
    userAgent: req.get?.('user-agent'),
    details: { riskCount: current.count, windowMs }
  });
  riskCounters.delete(key);
}

export async function initializeOptionalSecurity() {
  if (!process.env.REDIS_URL) return;
  const candidate = createClient({ url: process.env.REDIS_URL });
  candidate.on('error', error => {
    console.error('[Security] Redis error:', error.message);
  });
  try {
    await candidate.connect();
    redisClient = candidate;
  } catch (error) {
    console.error('[Security] Redis unavailable; using local/PostgreSQL limits:', error.message);
  }
}

export function getRateLimitStore(prefix = 'tiwlo') {
  if (!redisClient) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redisClient.sendCommand(args)
  });
}

export async function optionalSecurityMiddleware(req, res, next) {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/graphql')) return next();
  if (!isSuspiciousRequest(req)) return next();

  const fingerprint = requestFingerprint(req);
  recordSecurityEvent({
    eventType: 'security.local_automation_signal',
    severity: 'warning',
    userId: req.activeUser?.id || null,
    ip: req.ip,
    userAgent: req.get?.('user-agent'),
    details: { fingerprint, path: req.path }
  }).catch(error => console.error('[Security] Could not record automation signal:', error.message));

  try {
    await enforceRepeatedAbuse(req);
  } catch (error) {
    console.error('[Security] Local abuse enforcement failed:', error.message);
    return next(error);
  }

  if (process.env.LOCAL_SECURITY_ENFORCE === 'true') {
    return res.status(403).json({ error: 'Request blocked by local security policy.' });
  }
  return next();
}

export async function closeOptionalSecurity() {
  if (redisClient?.isOpen) await redisClient.quit();
}
