import express from 'express';
import rateLimit from 'express-rate-limit';
import { provisionCustomDomain } from '../dns/sslManager.js';
import {
  beginDomainSslProvisioning,
  createUserDomain,
  deletePendingUserDomain,
  DomainServiceError,
  getUserDomain,
  listUserDomains,
  markDomainSslStatus,
  verifyDomainAddress,
  verifyUserDomain
} from '../domains/domainService.js';

const router = express.Router();
const domainActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many domain verification or SSL requests. Try again later.' }
});

const getUserId = req => req.activeUser?.id;
const getTiwiId = req => req.activeUser?.tiwiId || req.activeUser?.storeId;

function sendDomainError(res, error) {
  if (error instanceof DomainServiceError) {
    return res.status(error.statusCode).json({ error: error.message, ...error.details });
  }
  console.error('[DomainRoutes] Domain operation failed:', error);
  return res.status(500).json({ error: 'The domain operation failed unexpectedly.' });
}

router.use((req, res, next) => {
  if (!req.activeUser?.id) return res.status(401).json({ error: 'Authentication required.' });
  next();
});

router.get('/', async (req, res) => {
  try {
    res.json({ domains: await listUserDomains(getUserId(req)) });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.post('/', domainActionLimiter, async (req, res) => {
  try {
    const domain = await createUserDomain({
      userId: getUserId(req),
      tiwiId: getTiwiId(req),
      domain: req.body?.domain
    });
    res.status(201).json({
      domain,
      instructions: 'Add the provided TXT record to prove ownership and an A record pointing to the provided server IP. Then call the verify endpoint.'
    });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const domain = await getUserDomain({ userId: getUserId(req), id: req.params.id });
    const dns = await verifyDomainAddress(domain.domain);
    res.json({ domain, dns });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.post('/:id/verify', domainActionLimiter, async (req, res) => {
  try {
    const domain = await verifyUserDomain({ userId: getUserId(req), id: req.params.id });
    const dns = await verifyDomainAddress(domain.domain);
    res.json({
      domain,
      dns,
      readyForSsl: domain.status === 'verified' && dns.ready
    });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.post('/:id/provision', domainActionLimiter, async (req, res) => {
  let domain;
  let provisioningStarted = false;
  try {
    domain = await getUserDomain({ userId: getUserId(req), id: req.params.id });
    if (domain.status === 'active' && domain.sslStatus === 'active') {
      return res.json({ domain });
    }
    if (domain.status !== 'verified') {
      return res.status(409).json({ error: 'Verify DNS ownership before requesting SSL.' });
    }
    const dns = await verifyDomainAddress(domain.domain);
    if (!dns.ready) {
      return res.status(409).json({
        error: 'The domain A record does not point to this server yet.',
        dns
      });
    }

    await beginDomainSslProvisioning({
      id: domain.id,
      userId: getUserId(req)
    });
    provisioningStarted = true;
    const issued = await provisionCustomDomain(domain.domain);
    if (!issued) throw new Error('Certificate provisioning is not supported on this server platform.');

    const activeDomain = await markDomainSslStatus({
      id: domain.id,
      userId: getUserId(req),
      status: 'active',
      sslStatus: 'active',
      error: null
    });
    res.json({ domain: activeDomain });
  } catch (error) {
    if (domain && provisioningStarted) {
      try {
        await markDomainSslStatus({
          id: domain.id,
          userId: getUserId(req),
          status: 'verified',
          sslStatus: 'failed',
          error: String(error.message || 'Certificate provisioning failed').slice(0, 500)
        });
      } catch (statusError) {
        console.error('[DomainRoutes] Could not save SSL failure status:', statusError);
      }
    }
    if (error instanceof DomainServiceError) return sendDomainError(res, error);
    console.error('[DomainRoutes] SSL provisioning failed:', error);
    res.status(502).json({ error: 'SSL provisioning failed. Check DNS propagation and the server SSL configuration before retrying.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deletePendingUserDomain({ userId: getUserId(req), id: req.params.id });
    res.status(204).end();
  } catch (error) {
    sendDomainError(res, error);
  }
});

export default router;
