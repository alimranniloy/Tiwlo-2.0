import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import {
  checkSubdomain,
  claimSubdomain,
  createSubdomainRecord,
  listSubdomainRecords,
  listUserSubdomains
} from '../domains/subdomainService.js';

const router = express.Router();
const checkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many availability checks. Try again shortly.' }
});
const claimLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many free-domain attempts from this network. Try again later.',
    code: 'FREE_DOMAIN_RATE_LIMITED'
  }
});

function sendSubdomainError(res, error) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message, ...error.details });
  }
  console.error('[SubdomainRoutes] Subdomain operation failed:', error);
  return res.status(500).json({ error: 'The subdomain operation failed unexpectedly.' });
}

router.get('/check', checkLimiter, async (req, res) => {
  try {
    res.json(await checkSubdomain(req.query?.name));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[SubdomainRoutes] Availability check failed:', error);
    res.status(500).json({ error: 'The subdomain availability check failed.' });
  }
});

router.post('/claim', claimLimiter, async (req, res) => {
  try {
    if (!req.cookies?.uids_device) {
      res.cookie('uids_device', randomBytes(32).toString('base64url'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || req.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000
      });
    }
    const registration = await claimSubdomain({
      userId: req.activeUser?.id,
      input: req.body?.name,
      request: req
    });
    res.status(201).json({ registration });
  } catch (error) {
    sendSubdomainError(res, error);
  }
});

router.use((req, res, next) => {
  if (!req.activeUser?.id) return res.status(401).json({ error: 'Authentication required.' });
  next();
});

router.get('/', async (req, res) => {
  try {
    res.json({ domains: await listUserSubdomains(req.activeUser.id) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[SubdomainRoutes] Domain list failed:', error);
    res.status(500).json({ error: 'Could not load your domains.' });
  }
});

router.get('/:id/records', async (req, res) => {
  try {
    res.json({ records: await listSubdomainRecords({ userId: req.activeUser.id, subdomainId: req.params.id }) });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[SubdomainRoutes] DNS record list failed:', error);
    res.status(500).json({ error: 'Could not load DNS records.' });
  }
});

router.post('/:id/records', async (req, res) => {
  try {
    const record = await createSubdomainRecord({
      userId: req.activeUser.id,
      subdomainId: req.params.id,
      ...req.body
    });
    res.status(201).json({ record });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[SubdomainRoutes] DNS record create failed:', error);
    res.status(500).json({ error: 'Could not create DNS record.' });
  }
});

export default router;
