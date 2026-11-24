import express from 'express';
import rateLimit from 'express-rate-limit';
import { CloudDB } from '../db/cloud.js';
import { BillingDB } from '../db/billing.js';
import { queryDropletTelemetry } from '../db/dropletTelemetry.js';
import { attemptAutoUnsuspendForUser } from '../db/cloudDropletBilling.js';
import { getUserWelcomePromoStatus } from '../db/promotions.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { getPlatformPaymentGatewaysRaw } from '../administrator/adminRoutes.js';
import { issueVpsTerminalTicket } from '../ubuntu/vpsTerminalWs.js';
import { getDropletStatsFromHost } from '../ubuntu/hostProvisionerClient.js';
import {
  addCloudDomainZoneRecord,
  bindCloudCustomDomain,
  deleteCloudDomainZoneRecord,
  linkCloudCustomDomainToDroplet,
  listDropletDomainsForUser,
  removeCloudCustomDomain,
  verifyCloudCustomDomain
} from '../ubuntu/dropletDomainService.js';

const creditCheckoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many credit checkout attempts. Try again later.' }
});
const creditQuoteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 24,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment quote requests. Try again later.' }
});

function dashboardOrigin(req) {
  const host = String(req.get('host') || '');
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return `${req.protocol}://${host}`;
  try { return new URL(PLATFORM_CONFIG.dashboardUrl).origin; }
  catch { return `https://${PLATFORM_CONFIG.freeSubdomainDomain}`; }
}

function userReturnOrigin(req) {
  const rawOrigin = req.get('origin') || req.get('referer');
  try {
    const candidate = new URL(rawOrigin);
    const isLocal = ['localhost', '127.0.0.1'].includes(candidate.hostname) && process.env.NODE_ENV !== 'production';
    const isManaged = PLATFORM_CONFIG.managedDomains.includes(candidate.hostname) || candidate.hostname === PLATFORM_CONFIG.dashboardHost;
    if (isLocal || (isManaged && candidate.protocol === 'https:')) return candidate.origin;
  } catch {}
  return new URL(PLATFORM_CONFIG.dashboardUrl).origin;
}

function redirectCreditResult(res, result, origin = new URL(PLATFORM_CONFIG.dashboardUrl).origin) {
  return res.redirect(303, `${origin.replace(/\/$/, '')}/billing?cloud_credit_payment=${encodeURIComponent(result)}`);
}

const router = express.Router();

const getReqUserId = (req) => {
  return req.activeUser?.id || req.user?.id || req.session?.userId || null;
};

// Initialize billing engine
BillingDB.init();

// ==========================================
// CLOUD DASHBOARD & DROPLETS
// ==========================================
router.get('/dashboard', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await CloudDB.getCloudDashboardData(userId);
    res.json(data);
  } catch (err) {
    console.error('Error fetching cloud dashboard:', err);
    res.status(500).json({ error: 'Failed to load cloud dashboard' });
  }
});

router.get('/droplets/catalog', async (_req, res) => {
  try {
    const catalog = await CloudDB.getDropletCatalog();
    res.json({ success: true, ...catalog });
  } catch (err) {
    console.error('Error loading droplet catalog:', err);
    res.status(500).json({ error: 'Failed to load droplet catalog' });
  }
});

router.get('/droplets/check-availability', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    const availability = await CloudDB.checkDropletAvailability({
      userId,
      hostname: req.query?.hostname || '',
      username: req.query?.username || ''
    });
    res.json({ success: true, ...availability });
  } catch (err) {
    console.error('Error checking droplet availability:', err);
    res.status(500).json({ error: 'Failed to check hostname and username availability' });
  }
});

router.get('/droplets', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const droplets = await CloudDB.getDroplets(userId);
    res.json(droplets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load droplets' });
  }
});

router.post('/droplets', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await CloudDB.createDroplet(userId, req.body || {});
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;
    if (status >= 500) console.error('Error creating droplet:', err);
    res.status(status).json({ error: err.message || 'Failed to provision droplet' });
  }
});

router.patch('/droplets/:id/name', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 255) {
      return res.status(400).json({ error: 'Droplet name must be between 1 and 255 characters.' });
    }
    const droplet = await CloudDB.renameDroplet(userId, req.params.id, name);
    if (!droplet) return res.status(404).json({ error: 'Droplet not found' });
    res.json(droplet);
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;
    if (status >= 500) console.error('Error renaming droplet:', err);
    res.status(status).json({ error: err?.message || 'Failed to rename droplet' });
  }
});

router.patch('/droplets/:id/status', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const droplet = await CloudDB.updateDropletStatus(userId, req.params.id, status);
    if (!droplet) return res.status(404).json({ error: 'Droplet not found' });
    res.json(droplet);
  } catch (err) {
    const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
      ? err.statusCode
      : 500;
    if (status >= 500) console.error('Error updating droplet status:', err);
    res.status(status).json({ error: err?.message || 'Failed to update droplet status' });
  }
});

router.delete('/droplets/:id', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    const ok = await CloudDB.deleteDroplet(userId, req.params.id);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete droplet' });
  }
});

router.get('/droplets/:id/detail', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const detail = await CloudDB.getDropletDetail(userId, req.params.id);
    if (!detail) return res.status(404).json({ error: 'Droplet not found' });
    res.json({ success: true, ...detail });
  } catch (err) {
    console.error('Error loading droplet detail:', err);
    res.status(500).json({ error: 'Failed to load droplet detail' });
  }
});

router.post('/droplets/:id/terminal-ticket', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    if (String(existing.status || '').toLowerCase() !== 'active') {
      return res.status(409).json({ error: `VPS is ${existing.status}. Power it on to open terminal.` });
    }
    const issued = issueVpsTerminalTicket({ userId, dropletId: existing.id });
    res.json({ success: true, ...issued });
  } catch (err) {
    console.error('Error issuing terminal ticket:', err);
    res.status(500).json({ error: 'Failed to prepare WebSocket terminal session' });
  }
});

router.get('/droplets/:id/stats', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    const stats = await getDropletStatsFromHost(existing.id);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(err?.statusCode || 503).json({ error: err?.message || 'Unable to query droplet stats' });
  }
});

router.get('/droplets/:id/telemetry', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    const telemetry = await queryDropletTelemetry({
      dropletId: req.params.id,
      userId,
      range: req.query?.range || '24h',
      from: req.query?.from || null,
      to: req.query?.to || null
    });
    res.json({ success: true, ...telemetry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load droplet telemetry' });
  }
});

router.post('/droplets/:id/firewall', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    const rule = await CloudDB.addDropletFirewallRule(userId, req.params.id, req.body || {});
    res.status(201).json({ success: true, rule });
  } catch (err) {
    res.status(err?.statusCode || 400).json({ error: err.message || 'Failed to add firewall rule' });
  }
});

router.delete('/droplets/:id/firewall/:ruleId', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await CloudDB.removeDropletFirewallRule(userId, req.params.id, req.params.ruleId);
    if (!ok) return res.status(404).json({ error: 'Firewall rule not found' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to remove firewall rule' });
  }
});

router.post('/droplets/:id/snapshots', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    const snapshot = await CloudDB.createDropletSnapshot(userId, req.params.id, req.body?.name);
    res.status(201).json({ success: true, snapshot });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create snapshot' });
  }
});

router.delete('/droplets/:id/snapshots/:snapId', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await CloudDB.removeDropletSnapshot(userId, req.params.id, req.params.snapId);
    if (!ok) return res.status(404).json({ error: 'Snapshot not found' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

router.post('/droplets/:id/snapshots/:snapId/restore', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    res.json({ success: true, restored: true, snapshotId: req.params.snapId });
  } catch {
    res.status(500).json({ error: 'Failed to restore snapshot' });
  }
});

router.patch('/droplets/:id/backups', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });
    res.json({ success: true, enabled: Boolean(req.body?.enabled) });
  } catch {
    res.status(500).json({ error: 'Failed to update backup preference' });
  }
});

router.post('/droplets/:id/dns', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });

    const { hostname, recordType, targetPort, ttl, proxyEnabled } = req.body || {};
    const result = await bindCloudCustomDomain({
      userId,
      dropletId: existing.id,
      hostname,
      recordType: recordType || 'A+AAAA',
      targetPort: targetPort ?? 80,
      ttl: ttl ?? 300,
      proxyEnabled: proxyEnabled !== false
    });
    res.status(201).json({
      success: true,
      record: result.domain,
      verification: result.verification,
      message: result.domain.status === 'active'
        ? `${result.domain.hostname} is active and routing traffic to ${existing.name} (port ${result.domain.targetPort}).`
        : `${result.domain.hostname} saved. Point nameservers to ${result.domain.nameservers.join(' & ')} or add Cloudflare AAAA -> ${result.domain.serverIpv6}, then click Verify.`
    });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to bind DNS record', ...(err?.details || {}) });
  }
});

router.post('/droplets/:id/dns/:recordId/verify', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const existing = await CloudDB.getDropletById(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ error: 'Droplet not found' });

    const result = await verifyCloudCustomDomain({
      userId,
      domainId: req.params.recordId,
      dropletId: existing.id
    });
    res.json({ success: result.verified, ...result });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Verification check failed' });
  }
});

router.delete('/droplets/:id/dns/:recordId', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await removeCloudCustomDomain({
      userId,
      domainId: req.params.recordId,
      dropletId: req.params.id
    });
    if (!ok) return res.status(404).json({ error: 'DNS domain binding not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to remove DNS domain binding' });
  }
});

// ==========================================
// CLOUD VPS CUSTOM DOMAINS & NAMESERVER ZONES
// ==========================================
router.get('/domains', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const domains = await listDropletDomainsForUser({ userId });
    res.json({ success: true, domains });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to list custom domains' });
  }
});

router.post('/domains', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { domain, hostname, dropletId, targetPort, ttl, proxyEnabled } = req.body || {};
    const result = await bindCloudCustomDomain({
      userId,
      hostname: hostname || domain,
      dropletId: dropletId || null,
      targetPort: targetPort ?? 80,
      ttl: ttl ?? 300,
      proxyEnabled: proxyEnabled !== false
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to add custom domain' });
  }
});

router.post('/domains/:domainId/verify', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await verifyCloudCustomDomain({
      userId,
      domainId: req.params.domainId
    });
    res.json({ success: result.verified, ...result });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Domain verification failed' });
  }
});

router.patch('/domains/:domainId/droplet', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const updated = await linkCloudCustomDomainToDroplet({
      userId,
      domainId: req.params.domainId,
      dropletId: req.body?.dropletId || null,
      targetPort: req.body?.targetPort ?? 80,
      proxyEnabled: req.body?.proxyEnabled !== false
    });
    res.json({ success: true, domain: updated });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to update VPS link' });
  }
});

router.delete('/domains/:domainId', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await removeCloudCustomDomain({
      userId,
      domainId: req.params.domainId
    });
    if (!ok) return res.status(404).json({ error: 'Custom domain not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to delete custom domain' });
  }
});

router.post('/domains/:domainId/records', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const record = await addCloudDomainZoneRecord({
      userId,
      domainId: req.params.domainId,
      type: req.body?.type,
      name: req.body?.name,
      value: req.body?.value,
      ttl: req.body?.ttl ?? 300
    });
    res.status(201).json({ success: true, record });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to add zone record' });
  }
});

router.delete('/domains/:domainId/records/:recordId', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await deleteCloudDomainZoneRecord({
      userId,
      domainId: req.params.domainId,
      recordId: req.params.recordId
    });
    if (!ok) return res.status(404).json({ error: 'Zone record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Failed to remove zone record' });
  }
});

// ==========================================
// CLOUD BILLING, CREDITS, INVOICES & BUDGETS
// ==========================================
router.get('/billing', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const account = await BillingDB.getBillingAccount(userId);
    if (!account) return res.status(404).json({ error: 'Billing account is unavailable for this user.' });
    res.json({ success: true, account });
  } catch (err) {
    console.error('Error fetching billing account:', err);
    res.status(500).json({ error: 'Failed to fetch billing account' });
  }
});

router.put('/billing/address', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });

    const input = req.body?.billingAddress || {};
    const billingAddress = {
      address: typeof input.address === 'string' ? input.address.trim() : '',
      city: typeof input.city === 'string' ? input.city.trim() : '',
      country: typeof input.country === 'string' ? input.country.trim() : '',
      phone: typeof input.phone === 'string' ? input.phone.trim() : '',
      postalCode: typeof input.postalCode === 'string' ? input.postalCode.trim() : ''
    };
    if (!billingAddress.address || !billingAddress.city || !billingAddress.country) {
      return res.status(422).json({ error: 'Street address, city, and country are required.' });
    }
    if (billingAddress.address.length > 2000 || billingAddress.city.length > 100 ||
        billingAddress.country.length > 100 || billingAddress.phone.length > 32 ||
        billingAddress.postalCode.length > 32) {
      return res.status(422).json({ error: 'One or more billing address fields are too long.' });
    }

    const saved = await BillingDB.updateBillingAddress(userId, billingAddress);
    if (!saved) return res.status(404).json({ error: 'Billing account user was not found.' });
    return res.json({ success: true, billingAddress: saved });
  } catch (err) {
    console.error('Error updating cloud billing address:', err);
    return res.status(500).json({ error: 'Could not update billing address.' });
  }
});

router.put('/billing/profile', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const accountType = typeof req.body?.accountType === 'string' ? req.body.accountType.trim().toLowerCase() : '';
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
    if (!['personal', 'business'].includes(accountType)) {
      return res.status(422).json({ error: 'Choose a personal or business billing profile.' });
    }
    if (accountType === 'business' && !companyName) {
      return res.status(422).json({ error: 'Company name is required for a business billing profile.' });
    }
    if (companyName.length > 255) return res.status(422).json({ error: 'Company name must be 255 characters or fewer.' });
    const profile = await BillingDB.updateBillingProfile(userId, accountType, companyName);
    if (!profile) return res.status(404).json({ error: 'Billing profile was not found.' });
    return res.json({ success: true, profile });
  } catch (err) {
    console.error('Error updating cloud billing profile:', err);
    return res.status(500).json({ error: 'Could not update billing profile.' });
  }
});

router.post('/billing/credits/quote', creditQuoteLimiter, async (req, res) => {
  try {
    if (!getReqUserId(req)) return res.status(401).json({ error: 'Authentication required.' });
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().toLowerCase() : '';
    const quote = await BillingDB.getCreditQuote({ provider, amount: req.body?.amount });
    return res.json({ success: true, quote });
  } catch (error) {
    const unavailable = /not enabled|not configured|not available|live payment credentials/i.test(error.message || '');
    const status = unavailable ? 503 : error instanceof TypeError ? 400 : 502;
    return res.status(status).json({ success: false, error: error.message || 'Could not quote the payment amount.' });
  }
});

router.post('/billing/credits/add', creditCheckoutLimiter, async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const provider = typeof req.body?.provider === 'string' ? req.body.provider.trim().toLowerCase() : '';
    if (!provider) return res.status(503).json({ success: false, error: 'USD credit checkout is not configured for this account.' });
    const checkout = await BillingDB.createCreditCheckout({
      userId,
      provider,
      amount: req.body?.amount,
      origin: dashboardOrigin(req),
      returnOrigin: userReturnOrigin(req),
      expectedPaymentAmount: req.body?.expectedPaymentAmount,
      expectedRateDate: req.body?.expectedRateDate,
      request: req
    });
    return res.status(201).json({ success: true, ...checkout });
  } catch (error) {
    const unavailable = /not enabled|not configured|not available|live payment credentials/i.test(error.message || '');
    const status = unavailable ? 503 : error instanceof TypeError ? 400 : 502;
    return res.status(status).json({ success: false, error: error.message || 'Could not open secure credit checkout.' });
  }
});

router.post('/billing/credits/:id/cancel', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Authentication required.' });
    const topup = await BillingDB.cancelCreditTopup(userId, req.params.id);
    if (!topup) return res.status(404).json({ success: false, error: 'Credit checkout not found.' });
    if (topup.status === 'paid') {
      return res.status(409).json({ success: false, status: topup.status, error: 'This payment was already completed.' });
    }
    if (topup.status === 'processing') {
      return res.status(409).json({ success: false, status: topup.status, error: 'Payment verification is already in progress.' });
    }
    let notificationSent = null;
    if (topup.cancelledNow && topup.cancel_reason === 'user') {
      try {
        notificationSent = await BillingDB.sendCreditTopupCancellationEmail(userId, req.params.id);
      } catch (error) {
        console.error(`[Cloud Billing] Checkout cancellation email failed for ${req.params.id}:`, error.message);
        notificationSent = false;
      }
    }
    return res.json({
      success: true,
      status: topup.status,
      expiresAt: topup.expires_at ? new Date(topup.expires_at).toISOString() : null,
      cancelReason: topup.cancel_reason || null,
      notificationSent
    });
  } catch (error) {
    console.error('[Cloud Billing] Could not cancel credit checkout:', error.message);
    return res.status(500).json({ success: false, error: 'Could not cancel this checkout.' });
  }
});

function getTerminalTopupStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['cancel', 'cancelled', 'canceled', 'expired', 'checkout.session.expired'].includes(status)) return 'cancelled';
  if (['fail', 'failed', 'failure', 'declined', 'checkout.session.async_payment_failed'].includes(status)) return 'failed';
  return null;
}

function getCreditReturnResult(topup) {
  if (topup?.status === 'paid') return 'success';
  if (['pending', 'processing'].includes(topup?.status)) return 'pending';
  if (topup?.status === 'failed') return 'failed';
  return 'cancelled';
}

async function handleCreditTopupReturn(req, res, { ipn = false } = {}) {
  const provider = String(req.params.provider || '').toLowerCase();
  const resultHint = String(req.query?.result || '').toLowerCase();
  let returnOrigin = new URL(PLATFORM_CONFIG.dashboardUrl).origin;
  try {
    const topup = await BillingDB.getCreditTopupForReturn(
      String(req.query?.orderId || ''), provider, req.query?.returnToken
    );
    if (!topup) return ipn ? res.status(404).json({ error: 'Credit top-up not found.' }) : redirectCreditResult(res, 'invalid');
    returnOrigin = topup.return_origin;
    if (topup.status === 'paid') return ipn ? res.json({ received: true, completed: true }) : redirectCreditResult(res, 'success', topup.return_origin);
    const hintedTerminalStatus = getTerminalTopupStatus(resultHint);
    if (hintedTerminalStatus) {
      const terminal = await BillingDB.setCreditTopupTerminalStatus(topup.id, hintedTerminalStatus);
      const result = getCreditReturnResult(terminal);
      return ipn ? res.json({ received: true, completed: result === 'success', status: result }) : redirectCreditResult(res, result, topup.return_origin);
    }
    const verified = await BillingDB.verifyAndCompleteCreditTopup(topup, { query: req.query, body: req.body });
    if (verified.success && (topup.user_id || topup.userId)) {
      await attemptAutoUnsuspendForUser({ userId: topup.user_id || topup.userId }).catch((err) =>
        console.warn('[Cloud Billing] Auto-unsuspend on topup return notice:', err?.message || err)
      );
    }
    if (!verified.success) {
      const terminalStatus = getTerminalTopupStatus(verified.status);
      if (terminalStatus) {
        const terminal = await BillingDB.setCreditTopupTerminalStatus(topup.id, terminalStatus);
        const result = getCreditReturnResult(terminal);
        return ipn ? res.json({ received: true, completed: result === 'success', status: result }) : redirectCreditResult(res, result, topup.return_origin);
      }
    }
    return ipn
      ? res.json({ received: true, completed: verified.success })
      : redirectCreditResult(res, verified.success ? 'success' : getCreditReturnResult({ status: verified.status }), topup.return_origin);
  } catch (error) {
    console.error('[Cloud Billing] Credit checkout verification failed:', error.message);
    return ipn ? res.status(400).json({ error: 'Credit payment could not be verified.' }) : redirectCreditResult(res, 'pending', returnOrigin);
  }
}

router.get('/billing/credits/return/:provider', (req, res) => handleCreditTopupReturn(req, res));
router.post('/billing/credits/return/:provider', (req, res) => handleCreditTopupReturn(req, res));
router.post('/billing/credits/ipn/sslcommerz', (req, res) => handleCreditTopupReturn(req, res, { ipn: true }));

router.post('/billing/credits/stripe/webhook', async (req, res) => {
  try {
    if (!Buffer.isBuffer(req.rawBody)) return res.status(400).json({ error: 'Stripe webhook body is unavailable.' });
    const event = JSON.parse(req.rawBody.toString('utf8'));
    const topupId = String(event.data?.object?.metadata?.order_id || '');
    if (!topupId) return res.json({ received: true });
    const topup = await BillingDB.getCreditTopupById(topupId, 'stripe');
    if (!topup) return res.status(404).json({ error: 'Credit top-up not found.' });
    const gateways = await getPlatformPaymentGatewaysRaw();
    if (!gateways.stripe?.webhookSecret) return res.status(503).json({ error: 'Stripe webhook verification is not configured.' });
    const verified = await BillingDB.verifyAndCompleteCreditTopup(topup, {
      rawBody: req.rawBody,
      signature: req.get('stripe-signature')
    });
    if (verified.success && (topup.user_id || topup.userId)) {
      await attemptAutoUnsuspendForUser({ userId: topup.user_id || topup.userId }).catch((err) =>
        console.warn('[Cloud Billing] Auto-unsuspend on Stripe webhook notice:', err?.message || err)
      );
    }
    if (!verified.success) {
      const terminalStatus = getTerminalTopupStatus(verified.status);
      if (terminalStatus) await BillingDB.setCreditTopupTerminalStatus(topup.id, terminalStatus);
    }
    return res.json({ received: true, completed: verified.success });
  } catch (error) {
    console.error('[Cloud Billing] Stripe credit webhook rejected:', error.message);
    return res.status(400).json({ error: 'Stripe webhook could not be verified.' });
  }
});

router.get('/billing/promotions/status', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const status = await getUserWelcomePromoStatus(userId, req);
    return res.json({ success: true, ...status });
  } catch (err) {
    console.error('Error fetching welcome promo status:', err);
    return res.status(500).json({ success: false, error: 'Failed to load promotion eligibility.' });
  }
});

router.post('/billing/vouchers/redeem', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await BillingDB.redeemVoucher(userId, req.body?.code, req);
    if (!result.success) return res.status(result.statusCode || 400).json(result);
    await attemptAutoUnsuspendForUser({ userId }).catch((err) =>
      console.warn('[Cloud Billing] Auto-unsuspend on voucher redeem notice:', err?.message || err)
    );
    return res.json(result);
  } catch (err) {
    console.error('Error redeeming cloud voucher:', err);
    return res.status(500).json({ success: false, error: 'Could not redeem voucher.' });
  }
});

router.post('/billing/deduct', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { amount, service, description } = req.body;
    const result = await BillingDB.deductCredits(userId, amount, service, description);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Error deducting credits:', err);
    res.status(500).json({ error: 'Failed to deduct credits' });
  }
});

router.post('/billing/budgets', async (req, res) => {
  if (!getReqUserId(req)) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(503).json({
    success: false,
    error: 'Cloud usage metering is unavailable; billing alerts cannot be configured.'
  });
});

router.delete('/billing/budgets/:id', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await BillingDB.deleteBudget(userId, req.params.id);
    res.json({ success: ok });
  } catch (err) {
    console.error('Error deleting budget:', err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;
