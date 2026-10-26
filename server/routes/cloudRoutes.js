import express from 'express';
import { CloudDB } from '../db/cloud.js';
import { BillingDB } from '../db/billing.js';

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

router.post('/billing/credits/add', async (req, res) => {
  if (!getReqUserId(req)) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(503).json({
    success: false,
    error: 'Credit checkout is not integrated. No payment was processed.'
  });
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
