import { readState, saveState } from './stateDocuments.js';
import { MasterDB } from './multiTenant.js';
import { CloudDB } from './cloud.js';

async function readBillingDb() { return readState('billing', 'accounts', { accounts: [] }); }
async function writeBillingDb(data) { await saveState('billing', 'accounts', data); }

export const BillingDB = {
  init() { /* PostgreSQL schema is initialized by server startup. */ },

  async getBillingAccount(userId) {
    if (!userId) return null;
    const db = (await readBillingDb());
    const accounts = Array.isArray(db.accounts) ? db.accounts : [];
    const account = accounts.find(
      (a) => a.userId === userId || a.tiwiId === userId
    );
    const droplets = await CloudDB.getDroplets(userId);

    return {
      userId,
      billingAccountId: null,
      billingAccountName: null,
      currency: 'USD',
      status: 'UNCONFIGURED',
      credits: Number.isSafeInteger(account?.verifiedCredits) && account.verifiedCredits > 0
        ? account?.verifiedCredits
        : 0,
      promotionalCredits: Number.isSafeInteger(account?.verifiedPromotionalCredits) && account.verifiedPromotionalCredits > 0
        ? account?.verifiedPromotionalCredits
        : 0,
      paymentMethods: (Array.isArray(account?.paymentMethods) ? account.paymentMethods : [])
        .filter(method => method?.verified === true),
      invoices: (Array.isArray(account?.invoices) ? account.invoices : []).filter(invoice =>
        invoice?.paymentVerified === true || invoice?.grantVerified === true
      ),
      budgets: [],
      monthToDateSpent: null,
      projectedCost: null,
      billingEnabled: false,
      usageMeteringEnabled: false,
      droplets
    };
  },

  async addCredits() {
    throw new Error('Cloud credit purchases are unavailable until a verified payment gateway is configured.');
  },

  async redeemVoucher() {
    throw new Error('Cloud vouchers are unavailable until a verified voucher program is configured.');
  },

  async deductCredits(userId, amount, serviceName = 'Cloud Resource', description = 'Usage deduction') {
    const db = await readBillingDb();
    const accounts = Array.isArray(db.accounts) ? db.accounts : [];
    const account = accounts.find(a => a.userId === userId || a.tiwiId === userId);
    if (account?.billingEnabled !== true || account?.usageMeteringEnabled !== true) {
      return { success: false, error: 'Cloud credit billing is not configured.' };
    }

    const deductAmount = Number(amount);
    const availableCredits = Number.isSafeInteger(account.verifiedCredits) && account.verifiedCredits > 0
      ? account.verifiedCredits
      : 0;
    if (!Number.isSafeInteger(deductAmount) || deductAmount <= 0) {
      return { success: false, error: 'Credit deduction must be a positive whole number.' };
    }
    if (availableCredits < deductAmount) {
      return {
        success: false,
        error: `Insufficient verified credits balance. Required: ${deductAmount}, Available: ${availableCredits}`
      };
    }

    account.verifiedCredits = availableCredits - deductAmount;
    account.credits = account.verifiedCredits;
    account.updatedAt = new Date().toISOString();

    try {
      await MasterDB.updateUser(userId, { credits: account.verifiedCredits });
    } catch (err) {
      console.warn('Failed to sync deduction to MasterDB:', err);
    }

    await writeBillingDb(db);

    return {
      success: true,
      deducted: deductAmount,
      remainingBalance: account.verifiedCredits
    };
  },

  async createBudget() {
    throw new Error('Cloud usage metering is unavailable; billing alerts cannot be configured.');
  },

  async deleteBudget(userId, budgetId) {
    let db = await readBillingDb();
    const accounts = Array.isArray(db.accounts) ? db.accounts : [];
    const account = accounts.find((a) => a.userId === userId || a.tiwiId === userId);
    if (!account) return false;

    account.budgets = (account.budgets || []).filter((b) => b.id !== budgetId);
    account.updatedAt = new Date().toISOString();

    (await writeBillingDb(db));
    return true;
  }
};
