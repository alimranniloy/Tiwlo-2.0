import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hashSecuritySubject } from '../db/securityPersistence.js';
import { normalizeSignupEmail } from './signupIdentity.js';

export const SIGNUP_BROWSER_COOKIE = 'tiwlo_signup_browser';
const lifetime = 180 * 24 * 60 * 60 * 1000;

export function issueSignupBrowser(now = Date.now()) {
  const payload = `${randomBytes(24).toString('hex')}.${now + lifetime}`;
  return `${payload}.${hashSecuritySubject(`signup-browser:${payload}`)}`;
}

export function verifySignupBrowser(value, now = Date.now()) {
  if (typeof value !== 'string' || !/^[a-f0-9]{48}\.\d{13}\.[a-f0-9]{64}$/.test(value)) return null;
  const [id, expires, signature] = value.split('.');
  if (Number(expires) <= now || Number(expires) > now + lifetime) return null;
  const expected = hashSecuritySubject(`signup-browser:${id}.${expires}`);
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')) ? id : null;
}

// This cookie is a rate-limit signal, never proof of a person's identity.
// Clearing cookies defeats this signal; mailbox and network controls remain.
export function prepareSignupRequest(req, res, next) {
  try {
    if (req.activeUser?.id) {
      return res.status(409).json({ error: 'You already have an account. Use your existing workspace.' });
    }
    const email = normalizeSignupEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'A valid email address is required.' });
    req.body.email = email;
    let token = req.cookies?.[SIGNUP_BROWSER_COOKIE];
    let browserId = verifySignupBrowser(token);
    if (!browserId) {
      token = issueSignupBrowser();
      browserId = verifySignupBrowser(token);
      res.cookie(SIGNUP_BROWSER_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || Boolean(req.secure),
        sameSite: 'lax',
        path: '/',
        maxAge: lifetime
      });
    }
    req.signupBrowserId = browserId;
    req.signupBrowserKey = hashSecuritySubject(`signup-browser-claim:${browserId}`);
    return next();
  } catch (error) {
    return next(error);
  }
}
