import { ipKeyGenerator } from 'express-rate-limit';
import { signupEmailKey } from '../../security/signupIdentity.js';
import { prepareSignupRequest } from '../../security/signupBrowser.js';
import { queryPg } from '../../db/postgres.js';
import { hashSecuritySubject, recordSecurityEvent } from '../../db/securityPersistence.js';

let requestsSinceCleanup = 0;

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

function getClientNetwork(req) {
  return ipKeyGenerator(getClientIp(req));
}

function requestKey(policyId, identity) {
  return hashSecuritySubject(`${policyId}:${identity}`);
}

async function incrementLimit(policyId, identity, windowMs) {
  const keyHash = requestKey(policyId, identity);
  const { rows } = await queryPg(
    `INSERT INTO system_security_rate_limits
       (policy_id, key_hash, hit_count, window_started_at, expires_at, updated_at)
     VALUES ($1, $2, 1, CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'), CURRENT_TIMESTAMP)
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
           THEN CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond')
         ELSE system_security_rate_limits.expires_at
       END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING hit_count AS "hitCount", expires_at AS "expiresAt"`,
    [policyId, keyHash, windowMs]
  );
  requestsSinceCleanup += 1;
  if (requestsSinceCleanup >= 1000) {
    requestsSinceCleanup = 0;
    queryPg('DELETE FROM system_security_rate_limits WHERE expires_at <= CURRENT_TIMESTAMP')
      .catch((error) => {
        console.error('[SecurityPlugin] Could not prune expired rate-limit records:', error.message);
      });
  }
  return rows[0];
}

function logExceededLimit(policyId, req, identity) {
  recordSecurityEvent({
    eventType: 'security.rate_limit_exceeded',
    severity: 'warning',
    userId: req.activeUser?.id || null,
    subject: identity,
    ip: getClientIp(req),
    userAgent: req.get?.('user-agent'),
    details: {
      policyId,
      method: req.method,
      path: String(req.originalUrl || req.path).split('?')[0].slice(0, 200)
    }
  }).catch((error) => {
    console.error(`[SecurityPlugin] Could not record ${policyId} rate-limit event:`, error.message);
  });
}

function createLimiter({
  policyId,
  windowMs,
  limit,
  error,
  getIdentity = getClientNetwork
}) {
  return async (req, res, next) => {
    try {
      const identity = String(getIdentity(req) || 'unknown').trim().slice(0, 512);
      const result = await incrementLimit(policyId, identity, windowMs);
      if (result.hitCount > limit) {
        if (result.hitCount === limit + 1) logExceededLimit(policyId, req, identity);
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / 1000)
        );
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({ success: false, error, retryAfterSeconds });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const month = 30 * day;

export const securityLimiters = {
  registrationEmail: createLimiter({
    policyId: 'auth_registration_mailbox',
    windowMs: hour,
    limit: 5,
    getIdentity: (req) => signupEmailKey(req.body?.email),
    error: 'Too many signup attempts for this email. Please sign in or try again later.'
  }),
  registrationBrowser: createLimiter({
    policyId: 'auth_registration_browser',
    windowMs: day,
    limit: 5,
    getIdentity: (req) => req.signupBrowserId,
    error: 'Too many account creation attempts in this browser. Please try again tomorrow.'
  }),
  registrationBrowserMonthly: createLimiter({
    policyId: 'auth_registration_browser_monthly',
    windowMs: month,
    limit: 10,
    getIdentity: (req) => req.signupBrowserId,
    error: 'This browser has reached its monthly signup limit. Please use your existing account.'
  }),
  login: createLimiter({
    policyId: 'auth_login_ip',
    windowMs: 15 * 60 * 1000,
    limit: 30,
    error: 'Too many sign-in requests. Please wait and try again.'
  }),
  registration: createLimiter({
    policyId: 'auth_registration_ip',
    windowMs: hour,
    limit: 5,
    error: 'Too many account creation requests. Please try again later.'
  }),
  registrationDaily: createLimiter({
    policyId: 'auth_registration_daily_ip',
    windowMs: day,
    limit: 10,
    error: 'Too many account creation requests from this network today. Please try again tomorrow.'
  }),
  registrationMonthly: createLimiter({
    policyId: 'auth_registration_monthly_ip',
    windowMs: month,
    limit: 30,
    error: 'This network has reached its monthly account creation limit.'
  }),
  mailboxAvailability: createLimiter({
    policyId: 'mailbox_availability_ip',
    windowMs: 15 * 60 * 1000,
    limit: 60,
    error: 'Too many mailbox availability checks. Please slow down.'
  }),
  mailboxCreationIp: createLimiter({
    policyId: 'mailbox_creation_ip',
    windowMs: day,
    limit: 10,
    error: 'Too many mailbox creation requests from this network. Try again tomorrow.'
  }),
  mailboxCreationAccount: createLimiter({
    policyId: 'mailbox_creation_account',
    windowMs: day,
    limit: 3,
    getIdentity: (req) => req.activeUser?.id ? `user:${req.activeUser.id}` : getClientNetwork(req),
    error: 'Too many mailbox creation requests for this account. Try again tomorrow.'
  }),
  mailSendAccount: createLimiter({
    policyId: 'mail_send_account_hourly',
    windowMs: hour,
    limit: 20,
    getIdentity: (req) => req.activeUser?.id ? `user:${req.activeUser.id}` : getClientNetwork(req),
    error: 'This account has reached its hourly sending limit. Try again later.'
  }),
  mailSendDailyAccount: createLimiter({
    policyId: 'mail_send_account_daily',
    windowMs: day,
    limit: 50,
    getIdentity: (req) => req.activeUser?.id ? `user:${req.activeUser.id}` : getClientNetwork(req),
    error: 'This account has reached its daily sending limit. Try again tomorrow.'
  })
};

// Keep both public registration APIs on exactly the same persisted policies.
export const registrationGuards = [
  prepareSignupRequest,
  securityLimiters.registration,
  securityLimiters.registrationDaily,
  securityLimiters.registrationMonthly,
  securityLimiters.registrationEmail,
  securityLimiters.registrationBrowser,
  securityLimiters.registrationBrowserMonthly
];

export default {
  id: 'security',
  name: 'Tiwlo Security Controls',
  version: '1.1.0',
  description: 'Persistent abuse throttles and security-event auditing for authentication and Tiwlo Mail.'
};
