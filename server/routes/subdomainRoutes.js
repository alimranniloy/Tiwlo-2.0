import express from 'express';
import rateLimit from 'express-rate-limit';
import { checkSubdomain, claimSubdomain } from '../domains/subdomainService.js';

const router = express.Router();
const checkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many availability checks. Try again shortly.' }
});

router.get('/check', checkLimiter, async (req, res) => {
  try {
    res.json(await checkSubdomain(req.query?.name));
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[SubdomainRoutes] Availability check failed:', error);
    res.status(500).json({ error: 'The subdomain availability check failed.' });
  }
});

router.post('/claim', async (req, res) => {
  try {
    const registration = await claimSubdomain({
      userId: req.activeUser?.id,
      input: req.body?.name
    });
    res.status(201).json({ registration });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error('[SubdomainRoutes] Claim failed:', error);
    res.status(500).json({ error: 'The subdomain registration failed.' });
  }
});

export default router;
