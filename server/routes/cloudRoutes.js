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

router.patch('/droplets/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const droplet = await CloudDB.updateDropletStatus(req.params.id, status);
    if (!droplet) return res.status(404).json({ error: 'Droplet not found' });
    res.json(droplet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update droplet status' });
  }
});

router.delete('/droplets/:id', async (req, res) => {
  try {
    const ok = await CloudDB.deleteDroplet(req.params.id);
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
    res.json({ success: true, account });
  } catch (err) {
    console.error('Error fetching billing account:', err);
    res.status(500).json({ error: 'Failed to fetch billing account' });
  }
});

router.post('/billing/credits/add', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { bundleAmount, paymentMethod } = req.body;
    const result = await BillingDB.addCredits(userId, bundleAmount, paymentMethod);
    res.json(result);
  } catch (err) {
    console.error('Error adding cloud credits:', err);
    res.status(500).json({ error: 'Failed to add cloud credits' });
  }
});

router.post('/billing/vouchers/redeem', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { code } = req.body;
    const result = await BillingDB.redeemVoucher(userId, code);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    console.error('Error redeeming voucher:', err);
    res.status(500).json({ error: 'Failed to redeem voucher' });
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
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const budget = await BillingDB.createBudget(userId, req.body);
    res.json({ success: true, budget });
  } catch (err) {
    console.error('Error creating budget:', err);
    res.status(500).json({ error: 'Failed to create budget' });
  }
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
