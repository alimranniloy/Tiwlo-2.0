import { readState, saveState } from './stateDocuments.js';
import { MasterDB } from './multiTenant.js';
import { CloudDB } from './cloud.js';
import { getPlatformPaymentGatewaysRaw } from '../administrator/adminRoutes.js';

async function readBillingDb() { return readState('billing', 'accounts', { accounts: [] }); }
async function writeBillingDb(data) { await saveState('billing', 'accounts', data); }

export const BillingDB = {
  init() { /* PostgreSQL schema is initialized by server startup. */ },

  async getPlatformGateways() {
    const raw = await getPlatformPaymentGatewaysRaw();
    const activeGateways = [];
    for (const [id, gw] of Object.entries(raw)) {
      if (gw.enabled) {
        let isReady = false;
        if (id === 'bkash' && gw.appKey && gw.appSecret && gw.username && gw.password) isReady = true;
        else if (id === 'nagad' && gw.merchantId && gw.merchantPrivateKey) isReady = true;
        else if (id === 'sslcommerz' && gw.storeId && gw.storePassword) isReady = true;
        else if (id === 'paypal' && gw.clientId && gw.clientSecret) isReady = true;
        else if (id === 'stripe' && gw.publishableKey && gw.secretKey) isReady = true;

        if (isReady) {
          activeGateways.push({
            id: gw.id,
            name: gw.name,
            mode: gw.mode,
            enabled: true,
            currencies: gw.currencies || ['USD']
          });
        }
      }
    }
    return {
      allGateways: raw,
      activeGateways,
      hasVerifiedGateway: activeGateways.length > 0
    };
  },

  async getBillingAccount(userId) {
    if (!userId) return null;
    const [db, gatewayInfo, masterUser, droplets] = await Promise.all([
      readBillingDb(),
      this.getPlatformGateways(),
      MasterDB.getUser(userId).catch(() => null),
      CloudDB.getDroplets(userId).catch(() => [])
    ]);

    const accounts = Array.isArray(db.accounts) ? db.accounts : [];
    const account = accounts.find(
      (a) => a.userId === userId || a.tiwiId === userId
    );

    const verifiedCredits = Number.isSafeInteger(masterUser?.credits) && masterUser.credits >= 0
      ? masterUser.credits
      : (Number.isSafeInteger(account?.verifiedCredits) && account.verifiedCredits >= 0 ? account.verifiedCredits : 0);

    const promotionalCredits = Number.isSafeInteger(account?.verifiedPromotionalCredits) && account.verifiedPromotionalCredits > 0
      ? account.verifiedPromotionalCredits
      : 0;

    const shortId = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase() || 'A24B39C72E';
    const billingAccountId = `01${shortId.slice(0, 4)}-${shortId.slice(4, 10) || '39C72E'}-F890`;

    return {
      userId,
      billingAccountId,
      billingAccountName: `Tiwlo Cloud (${masterUser?.name || 'Primary Account'})`,
      currency: 'USD',
      status: gatewayInfo.hasVerifiedGateway ? 'ACTIVE' : 'UNCONFIGURED',
      hasVerifiedGateway: gatewayInfo.hasVerifiedGateway,
      paymentGatewayStatusMessage: gatewayInfo.hasVerifiedGateway
        ? `${gatewayInfo.activeGateways.length} verified payment gateway(s) active`
        : 'No verified payment gateway configured',
      credits: verifiedCredits,
      promotionalCredits,
      paymentMethods: gatewayInfo.activeGateways,
      configuredGateways: gatewayInfo.activeGateways,
      invoices: (Array.isArray(account?.invoices) ? account.invoices : []).filter(invoice =>
        invoice?.paymentVerified === true || invoice?.grantVerified === true
      ),
      budgets: Array.isArray(account?.budgets) ? account.budgets : [],
      monthToDateSpent: 0.00,
      projectedCost: 0.00,
      billingEnabled: gatewayInfo.hasVerifiedGateway,
      usageMeteringEnabled: true,
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
