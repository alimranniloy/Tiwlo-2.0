import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { getOperationAST, parse } from 'graphql';
import { queryPg } from '../db/postgres.js';
import { hashSecuritySubject, recordSecurityEvent } from '../db/securityPersistence.js';

let redisClient = null;
const DASHBOARD_MUTATIONS_PER_WINDOW = 300;
const AUTOMATION_PATTERN = /(curl|wget|python-requests|scrapy|selenium|headlesschrome|phantomjs|nikto|sqlmap|爬虫)/i;
const SENSITIVE_PATH_PATTERN = /^\/(?:api\/)?(?:auth|subdomains|domains|graphql)(?:\/|$)/i;

function isSuspiciousRequest(req) {
  if (!SENSITIVE_PATH_PATTERN.test(req.path || req.originalUrl || '')) return false;
  const userAgent = req.get?.('user-agent') || '';
  return !userAgent || AUTOMATION_PATTERN.test(userAgent);
}

function isDashboardWrite(req) {
  const method = String(req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  if (!/^\/(?:api\/)?graphql\/?$/i.test(req.path || '')) return true;
  if (typeof req.body?.query !== 'string') return false;
  try {
    return getOperationAST(parse(req.body.query), req.body.operationName)?.operation === 'mutation';
  } catch {
    return false;
  }
}

async function recordDashboardActivity(req) {
  const userId = req.activeUser?.id;
  const method = String(req.method || '').toUpperCase();
  if (!userId || !isDashboardWrite(req)) return 0;

  const keyHash = hashSecuritySubject(`dashboard-write:${userId}`);
  const { rows } = await queryPg(
    `INSERT INTO system_security_rate_limits
       (policy_id, key_hash, hit_count, window_started_at, expires_at, updated_at)
     VALUES ('dashboard_user_write_5m', $1, 1, CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP + INTERVAL '5 minutes', CURRENT_TIMESTAMP)
     ON CONFLICT (policy_id, key_hash) DO UPDATE SET
       hit_count = CASE
         WHEN system_security_rate_limits.expires_at <= CURRENT_TIMESTAMP THEN 1
         ELSE LEAST(system_security_rate_limits.hit_count + 1, 2147483647)
       END,
       window_started_at = CASE
         WHEN system_security_rate_limits.expires_at <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
         ELSE system_security_rate_limits.window_started_at
       END,
       expires_at = CASE
         WHEN system_security_rate_limits.expires_at <= CURRENT_TIMESTAMP
           THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes'
         ELSE system_security_rate_limits.expires_at
       END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING hit_count, expires_at`,
    [keyHash]
  );
  const hitCount = Number(rows[0]?.hit_count) || 0;
  if (hitCount === DASHBOARD_MUTATIONS_PER_WINDOW + 1) {
    await recordSecurityEvent({
      eventType: 'security.dashboard_mutation_rate_limited',
      severity: 'high',
      userId,
      ip: req.ip,
      userAgent: req.get?.('user-agent'),
      details: {
        mutationRequestsInFiveMinutes: hitCount,
        resource: String(req.baseUrl || req.path || '/api').slice(0, 120),
        automationSignal: isSuspiciousRequest(req)
      }
    });
  }
  if (hitCount > DASHBOARD_MUTATIONS_PER_WINDOW) {
    return Math.max(1, Math.ceil((new Date(rows[0].expires_at).getTime() - Date.now()) / 1000));
  }
  if (hitCount !== 60) return 0;
  await recordSecurityEvent({
    eventType: 'security.dashboard_activity_burst',
    severity: 'warning',
    userId,
    ip: req.ip,
    userAgent: req.get?.('user-agent'),
    details: {
      writeRequestsInFiveMinutes: 60,
      method,
      resource: String(req.baseUrl || req.path || '/api').slice(0, 120),
      automationSignal: isSuspiciousRequest(req)
    }
  });
  return 0;
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
  try {
    const retryAfterSeconds = await recordDashboardActivity(req);
    if (retryAfterSeconds) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many dashboard changes in a short period. Try again after the cooldown.',
        code: 'DASHBOARD_MUTATION_RATE_LIMITED',
        retryAfterSeconds
      });
    }
  } catch (error) {
    console.error('[Security] Could not record dashboard activity:', error.message);
  }
  if (!isSuspiciousRequest(req)) return next();

  // A User-Agent string is trivial to spoof and must never be enough to ban an
  // account. Persist the observation for administrator review; rate limiting
  // and authentication middleware remain responsible for request enforcement.
  await recordSecurityEvent({
    eventType: 'security.local_automation_signal',
    severity: 'warning',
    userId: req.activeUser?.id || null,
    ip: req.ip,
    userAgent: req.get?.('user-agent'),
    details: { path: req.path, method: req.method }
  }).catch(error => console.error('[Security] Could not record automation signal:', error.message));
  return next();
}

export async function closeOptionalSecurity() {
  if (redisClient?.isOpen) await redisClient.quit();
}
