import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireRecentReauth } from '../security/recentReauth.js';
import { provisionCustomDomain } from '../dns/sslManager.js';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import { getEcommercePackageById } from '../db/packages.js';
import {
  beginDomainSslProvisioning,
  createUserDomain,
  deletePendingUserDomain,
  DomainServiceError,
  getLivePlatformDnsConfig,
  getUserDomain,
  listUserDomains,
  markDomainSslStatus,
  verifyDomainAddress,
  verifyDomainNameservers,
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
const getTiwiId = req => req.activeStore?.tiwiId || req.activeUser?.tiwiId || req.activeUser?.storeId;

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

router.post('/', domainActionLimiter, requireRecentReauth, async (req, res) => {
  try {
    const domain = await createUserDomain({
      userId: getUserId(req),
      tiwiId: getTiwiId(req),
      domain: req.body?.domain
    });
    res.status(201).json({
      domain,
      instructions: 'Add the provided TXT record to prove ownership, then point an A and/or AAAA record at the supplied server address. Alternatively, delegate the domain to the supplied Tiwlo nameservers. Then call the verify endpoint.'
    });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.get('/config/dns', async (req, res) => {
  try {
    const userId = getUserId(req);
    const tiwiId = getTiwiId(req);
    const [dnsConfig, tenantStore, userStores, userRow] = await Promise.all([
      getLivePlatformDnsConfig(),
      tiwiId ? TenantDB.getStoreDb(tiwiId).catch(() => null) : Promise.resolve(null),
      userId ? MasterDB.getUserStores(userId).catch(() => []) : Promise.resolve([]),
      isPgActive() && userId
        ? queryPg('SELECT plan_id, plan_name, subdomain FROM system_users WHERE id = $1 LIMIT 1', [userId])
          .then(result => result.rows[0] || null)
          .catch(() => null)
        : Promise.resolve(null)
    ]);

    const matchedStore = (userStores || []).find(s => String(s.tiwiId) === String(tiwiId)) || req.activeStore || null;
    const tenantSub = tenantStore?.subscription || {};
    const planId = String(
      tenantSub.planId ||
      matchedStore?.planId ||
      userRow?.plan_id ||
      req.activeUser?.planId ||
      'free'
    ).trim().toLowerCase();
    const pkg = await getEcommercePackageById(planId).catch(() => null);
    const hasCustomDomain = tenantSub.hasCustomDomain !== undefined
      ? Boolean(tenantSub.hasCustomDomain)
      : Boolean(pkg?.hasCustomDomain ?? ['growth', 'pro', 'enterprise'].includes(planId));
    const subdomain = tenantSub.subdomain ||
      matchedStore?.subdomain ||
      tenantStore?.store_settings?.subdomain ||
      userRow?.subdomain ||
      req.activeUser?.subdomain ||
      null;

    res.json({
      dnsConfig,
      plan: {
        tiwiId: tiwiId || null,
        planId,
        planName: tenantSub.planName || pkg?.planName || userRow?.plan_name || 'Free Starter',
        hasCustomDomain,
        subdomain
      }
    });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const domain = await getUserDomain({ userId: getUserId(req), id: req.params.id });
    const [dns, nameservers] = await Promise.all([
      verifyDomainAddress(domain.domain),
      verifyDomainNameservers(domain.domain)
    ]);
    res.json({ domain, dns, nameservers });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.post('/:id/verify', domainActionLimiter, requireRecentReauth, async (req, res) => {
  try {
    const domain = await verifyUserDomain({ userId: getUserId(req), id: req.params.id });
    const [dns, nameservers] = await Promise.all([
      verifyDomainAddress(domain.domain),
      verifyDomainNameservers(domain.domain)
    ]);
    res.json({
      domain,
      dns,
      nameservers,
      readyForSsl: domain.status === 'verified' && (dns.ready || nameservers.ready)
    });
  } catch (error) {
    sendDomainError(res, error);
  }
});

router.post('/:id/provision', domainActionLimiter, requireRecentReauth, async (req, res) => {
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
    const [dns, nameservers] = await Promise.all([
      verifyDomainAddress(domain.domain),
      verifyDomainNameservers(domain.domain)
    ]);
    if (!dns.ready && !nameservers.ready) {
      return res.status(409).json({
        error: 'The domain A/AAAA record does not point to this server and the domain is not yet delegated to both Tiwlo nameservers.',
        dns,
        nameservers
      });
    }

    await beginDomainSslProvisioning({
      id: domain.id,
      userId: getUserId(req)
    });
    provisioningStarted = true;
    const sslProvider = String(process.env.SSL_PROVIDER || '').trim().toLowerCase();
    const issued = sslProvider === 'caddy' ? true : await provisionCustomDomain(domain.domain);
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

router.delete('/:id', requireRecentReauth, async (req, res) => {
  try {
    await deletePendingUserDomain({ userId: getUserId(req), id: req.params.id });
    res.status(204).end();
  } catch (error) {
    sendDomainError(res, error);
  }
});

export default router;
