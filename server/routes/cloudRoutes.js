import express from 'express';
import rateLimit from 'express-rate-limit';
import { CloudDB } from '../db/cloud.js';
import { BillingDB } from '../db/billing.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { getPlatformPaymentGatewaysRaw } from '../administrator/adminRoutes.js';

const creditCheckoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many credit checkout attempts. Try again later.' }
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
    const droplet = await CloudDB.createDroplet(userId, req.body);
    res.status(501).json(droplet);
  } catch (err) {
    console.error('Error creating droplet:', err);
    res.status(501).json({ error: err.message || 'Cloud provisioning is not configured' });
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
    console.error('Error renaming droplet:', err);
    res.status(500).json({ error: 'Failed to rename droplet' });
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
    res.status(500).json({ error: 'Failed to update droplet status' });
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
      customerEmail: req.activeUser?.email || req.user?.email
    });
    return res.status(201).json({ success: true, ...checkout });
  } catch (error) {
    const unavailable = /not enabled|not configured|not available|live payment credentials/i.test(error.message || '');
    const status = unavailable ? 503 : error instanceof TypeError ? 400 : 502;
    return res.status(status).json({ success: false, error: error.message || 'Could not open secure credit checkout.' });
  }
});

router.get('/billing/credits/return/:provider', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const resultHint = String(req.query?.result || '').toLowerCase();
  try {
    const topup = await BillingDB.getCreditTopupForReturn(
      String(req.query?.orderId || ''), provider, req.query?.returnToken
    );
    if (!topup) return redirectCreditResult(res, 'invalid');
    if (topup.status === 'paid') return redirectCreditResult(res, 'success', topup.return_origin);
    if (resultHint === 'cancelled' || resultHint === 'failed') {
      return redirectCreditResult(res, 'cancelled', topup.return_origin);
    }
    const verified = await BillingDB.verifyAndCompleteCreditTopup(topup, { query: req.query, body: req.body });
    return redirectCreditResult(res, verified.success ? 'success' : 'pending', topup.return_origin);
  } catch (error) {
    console.error('[Cloud Billing] Credit checkout verification failed:', error.message);
    return redirectCreditResult(res, 'pending');
  }
});

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
    return res.json({ received: true, completed: verified.success });
  } catch (error) {
    console.error('[Cloud Billing] Stripe credit webhook rejected:', error.message);
    return res.status(400).json({ error: 'Stripe webhook could not be verified.' });
  }
});

router.post('/billing/vouchers/redeem', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await BillingDB.redeemVoucher(userId, req.body?.code);
    if (!result.success) return res.status(400).json(result);
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
