import express from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import { requireRecentReauth } from '../security/recentReauth.js';
import {
  checkSubdomainWithRust,
  claimDomainWithRust,
  createDnsRecordWithRust,
  deleteDnsRecordWithRust,
  listDnsRecordsWithRust,
  listUserDomainsWithRust,
  updateDnsRecordWithRust
} from '../security/rustDomainClient.js';

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

function sendRustError(res, error, operation) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message, ...error.details });
  }
  console.error(`[SubdomainRoutes] ${operation} failed:`, error);
  return res.status(502).json({ error: 'The domain service is temporarily unavailable.' });
}

router.get('/check', checkLimiter, async (req, res) => {
  try {
    res.json(await checkSubdomainWithRust(req.query?.name));
  } catch (error) {
    sendRustError(res, error, 'Availability check');
  }
});

router.post('/claim', claimLimiter, requireRecentReauth, async (req, res) => {
  try {
    if (!req.activeUser?.id) return res.status(401).json({ error: 'Authentication required.' });
    if (!req.cookies?.uids_device) {
      res.cookie('uids_device', randomBytes(32).toString('base64url'), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || req.secure,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60 * 1000
      });
    }
    const registration = await claimDomainWithRust({
      user: req.activeUser,
      name: req.body?.name,
      request: req
    });
    res.status(201).json({ registration });
  } catch (error) {
    sendRustError(res, error, 'Domain claim');
  }
});

router.use((req, res, next) => {
  if (!req.activeUser?.id) return res.status(401).json({ error: 'Authentication required.' });
  next();
});

router.get('/', async (req, res) => {
  try {
    res.json(await listUserDomainsWithRust({ user: req.activeUser, request: req }));
  } catch (error) {
    sendRustError(res, error, 'Domain list');
  }
});

router.get('/:id/records', async (req, res) => {
  try {
    res.json(await listDnsRecordsWithRust({
      user: req.activeUser,
      subdomainId: req.params.id,
      request: req
    }));
  } catch (error) {
    sendRustError(res, error, 'DNS record list');
  }
});

router.post('/:id/records', requireRecentReauth, async (req, res) => {
  try {
    const payload = await createDnsRecordWithRust({
      user: req.activeUser,
      subdomainId: req.params.id,
      request: req,
      body: req.body
    });
    res.status(201).json(payload);
  } catch (error) {
    sendRustError(res, error, 'DNS record creation');
  }
});

router.patch('/:id/records/:recordId', requireRecentReauth, async (req, res) => {
  try {
    res.json(await updateDnsRecordWithRust({
      user: req.activeUser,
      subdomainId: req.params.id,
      recordId: req.params.recordId,
      request: req,
      body: req.body
    }));
  } catch (error) {
    sendRustError(res, error, 'DNS record update');
  }
});

router.delete('/:id/records/:recordId', requireRecentReauth, async (req, res) => {
  try {
    await deleteDnsRecordWithRust({
      user: req.activeUser,
      subdomainId: req.params.id,
      recordId: req.params.recordId,
      request: req
    });
    res.status(204).end();
  } catch (error) {
    sendRustError(res, error, 'DNS record deletion');
  }
});

export default router;
