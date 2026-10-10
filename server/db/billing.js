import { readState, saveState } from './stateDocuments.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { MasterDB } from './multiTenant.js';
import { CloudDB } from './cloud.js';

async function readBillingDb() { return readState('billing', 'accounts', { accounts: [] }); }
async function writeBillingDb(data) { await saveState('billing', 'accounts', data); }

export const BillingDB = {
  init() { /* PostgreSQL schema is initialized by server startup. */ },

  async getBillingAccount(userId) {
    if (!userId) return null;
    const db = (await readBillingDb());
    db.accounts = db.accounts || [];

    let account = db.accounts.find(
      (a) => a.userId === userId || a.tiwiId === userId
    );

    // If no account exists for this user, dynamically provision a real isolated billing account!
    if (!account) {
      const user = await MasterDB.findUserByIdentifier(userId);
      const rawTiwiId = user?.tiwiId || user?.storeId || userId;
      const cleanTiwiId = rawTiwiId.replace(/[^a-zA-Z0-9]/g, '');
      const billingAccountId = `BA-TIWLO-${cleanTiwiId}-TCP`;
      const accountName = `${user?.storeName || user?.name || 'Tiwlo Cloud'} Billing Account`;

      account = {
        userId: user?.id || userId,
        tiwiId: rawTiwiId,
        billingAccountId,
        billingAccountName: accountName,
        status: 'ACTIVE',
        currency: 'USD',
        credits: user?.credits !== undefined ? user?.credits : 0,
        promotionalCredits: 0,
        monthToDateSpent: 0.0,
        projectedCost: 0.0,
        redeemedVouchers: [],
        budgets: [],
        paymentMethods: [],
        invoices: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.accounts.push(account);
      (await writeBillingDb(db));
    }

    // Always fetch user's real droplets to compute real live infrastructure utilization
    const droplets = await CloudDB.getDroplets(userId);
    const runningDroplets = droplets.filter((d) => d.status === 'Running');
    
    // Dynamic calculate hourly compute usage
    // Droplet rate: ~$0.007/hr ($5/mo for standard droplet)
    const computeCost = runningDroplets.length * 5.04;
    const storageCost = droplets.reduce((acc, d) => acc + (parseInt(d.storage) || 40) * 0.02, 0);
    const tiwiAiCost = (account.credits < 1000) ? 0.34 : 0.12;

    const dynamicMtdSpent = parseFloat((computeCost + storageCost + tiwiAiCost).toFixed(2));
    account.monthToDateSpent = dynamicMtdSpent;
    account.projectedCost = parseFloat((dynamicMtdSpent * 1.25).toFixed(2));

    return {
      ...account,
      droplets
    };
  },

  async addCredits(userId, bundleAmount, paymentMethod = 'Credit Card') {
    let db = await readBillingDb();
    let account = db.accounts.find((a) => a.userId === userId || a.tiwiId === userId);

    if (!account) {
      await this.getBillingAccount(userId);
      db = await readBillingDb();
      account = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    }

    const creditAmounts = { 10: 1000, 25: 2750, 50: 6000, 100: 13000 };
    const numBundle = parseFloat(bundleAmount) || 50;
    const addedCredits = creditAmounts[numBundle] || Math.round(numBundle * 100);

    account.credits = (account.credits || 0) + addedCredits;
    account.updatedAt = new Date().toISOString();

    // Sync with MasterDB user credits
    try {
      await MasterDB.updateUser(userId, { credits: account.credits });
    } catch (err) {
      console.warn('Failed to sync credits to MasterDB:', err);
    }

    const newInvId = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const newInvoice = {
      id: newInvId,
      date: dateStr,
      period: 'Prepaid Cloud Credits',
      description: `Credit Top-Up: ${addedCredits.toLocaleString()} Credits ($${numBundle}.00 USD)`,
      grossAmount: numBundle,
      creditsOffset: 0.0,
      netPaid: numBundle,
      status: 'Paid in Full',
      items: [
        {
          service: 'Tiwlo Cloud Credits Top-Up',
          desc: `${addedCredits.toLocaleString()} Tokenized Compute Units`,
          rate: `$${numBundle}.00`,
          usage: `${addedCredits.toLocaleString()} credits`,
          amount: numBundle
        }
      ]
    };

    account.invoices = account.invoices || [];
    account.invoices.unshift(newInvoice);

    (await writeBillingDb(db));

    return {
      success: true,
      addedCredits,
      newBalance: account.credits,
      invoice: newInvoice,
      account
    };
  },

  async redeemVoucher(userId, voucherCode) {
    let db = await readBillingDb();
    let account = db.accounts.find((a) => a.userId === userId || a.tiwiId === userId);

    if (!account) {
      await this.getBillingAccount(userId);
      db = await readBillingDb();
      account = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    }

    const cleanCode = (voucherCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Please enter a valid voucher code.' };
    }

    account.redeemedVouchers = account.redeemedVouchers || [];
    if (account.redeemedVouchers.includes(cleanCode)) {
      return {
        success: false,
        error: `Voucher code "${cleanCode}" has already been redeemed on this account.`
      };
    }

    const voucherMap = {
      'TIWLO100': 100,
      'TIWI250': 250,
      'CLOUD500': 500,
      'WELCOME2026': 1000,
      'TIWLO-CLOUD': 300,
      'NEURAL1000': 1000,
      'DEV2026': 500
    };

    const addedCredits = voucherMap[cleanCode] || 150;

    account.redeemedVouchers.push(cleanCode);
    account.credits = (account.credits || 0) + addedCredits;
    account.promotionalCredits = (account.promotionalCredits || 0) + addedCredits;
    account.updatedAt = new Date().toISOString();

    // Sync with MasterDB user credits
    try {
      await MasterDB.updateUser(userId, { credits: account.credits });
    } catch (err) {
      console.warn('Failed to sync credits to MasterDB:', err);
    }

    const grantId = `CR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const dateStr = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const newGrant = {
      id: grantId,
      date: dateStr,
      period: 'Promotional Voucher Grant',
      description: `Voucher Redemption: ${cleanCode} (+${addedCredits.toLocaleString()} Credits)`,
      grossAmount: 0.0,
      creditsOffset: 0.0,
      netPaid: 0.0,
      status: 'Applied to Balance',
      isCreditGrant: true,
      grantCredits: addedCredits,
      items: [
        {
          service: 'Promotional Credit Voucher',
          desc: `Redemption Code: ${cleanCode}`,
          rate: 'Promotional Key',
          usage: `+${addedCredits.toLocaleString()} Credits`,
          amount: 0.0
        }
      ]
    };

    account.invoices = account.invoices || [];
    account.invoices.unshift(newGrant);

    (await writeBillingDb(db));

    return {
      success: true,
      addedCredits,
      newBalance: account.credits,
      grant: newGrant,
      account
    };
  },

  async deductCredits(userId, amount, serviceName = 'Cloud Resource', description = 'Usage deduction') {
    let db = await readBillingDb();
    let account = db.accounts.find((a) => a.userId === userId || a.tiwiId === userId);

    if (!account) {
      await this.getBillingAccount(userId);
      db = await readBillingDb();
      account = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    }

    const deductAmount = Math.max(0, parseInt(amount) || 0);
    if ((account.credits || 0) < deductAmount) {
      return {
        success: false,
        error: `Insufficient credits balance. Required: ${deductAmount}, Available: ${account.credits || 0}`
      };
    }

    account.credits -= deductAmount;
    account.updatedAt = new Date().toISOString();

    try {
      await MasterDB.updateUser(userId, { credits: account.credits });
    } catch (err) {
      console.warn('Failed to sync deduction to MasterDB:', err);
    }

    (await writeBillingDb(db));

    return {
      success: true,
      deducted: deductAmount,
      remainingBalance: account.credits
    };
  },

  async createBudget(userId, budgetInput) {
    let db = await readBillingDb();
    let account = db.accounts.find((a) => a.userId === userId || a.tiwiId === userId);

    if (!account) {
      await this.getBillingAccount(userId);
      db = await readBillingDb();
      account = db.accounts.find(a => a.userId === userId || a.tiwiId === userId);
    }

    const newBudget = {
      id: `b-${Date.now().toString().slice(-4)}`,
      name: budgetInput.name || 'Cloud Service Budget',
      targetAmount: parseFloat(budgetInput.targetAmount) || 50.0,
      spentAmount: account.monthToDateSpent || 0.0,
      thresholds: budgetInput.thresholds || [50, 90, 100],
      alertEmail: budgetInput.alertEmail || PLATFORM_CONFIG.adminEmail,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    account.budgets = account.budgets || [];
    account.budgets.push(newBudget);
    account.updatedAt = new Date().toISOString();

    (await writeBillingDb(db));
    return newBudget;
  },

  async deleteBudget(userId, budgetId) {
    let db = await readBillingDb();
    let account = db.accounts.find((a) => a.userId === userId || a.tiwiId === userId);
    if (!account) return false;

    account.budgets = (account.budgets || []).filter((b) => b.id !== budgetId);
    account.updatedAt = new Date().toISOString();

    (await writeBillingDb(db));
    return true;
  }
};
