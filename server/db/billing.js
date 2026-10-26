import { randomUUID } from 'node:crypto';
import { readState } from './stateDocuments.js';
import { queryPg } from './postgres.js';
import { CloudDB } from './cloud.js';
import { getPlatformPaymentGatewaysRaw } from '../administrator/adminRoutes.js';

export const BillingDB = {
  init() { /* PostgreSQL schema is initialized by server startup. */ },

  async getPlatformGateways() {
    const raw = await getPlatformPaymentGatewaysRaw();
    const activeGateways = [];
    for (const [id, gateway] of Object.entries(raw)) {
      if (!gateway.enabled) continue;

      const credentialsPresent = id === 'bkash'
        ? gateway.appKey && gateway.appSecret && gateway.username && gateway.password
        : id === 'nagad'
          ? gateway.merchantId && gateway.merchantPrivateKey
          : id === 'sslcommerz'
            ? gateway.storeId && gateway.storePassword
            : id === 'paypal'
              ? gateway.clientId && gateway.clientSecret
              : id === 'stripe'
                ? gateway.publishableKey && gateway.secretKey
                : false;

      if (credentialsPresent) {
        activeGateways.push({
          id: gateway.id || id,
          name: gateway.name,
          mode: gateway.mode,
          enabled: true,
          currencies: Array.isArray(gateway.currencies) ? gateway.currencies : ['USD']
        });
      }
    }

    return {
      activeGateways,
      hasConfiguredGateway: activeGateways.length > 0
    };
  },

  async getBillingAccount(userId) {
    if (!userId) return null;

    // Only a real authenticated system user may have a billing account.
    const { rows: users } = await queryPg(
      'SELECT id, tiwi_id, name, store_name, address, city, country, phone, postal_code FROM system_users WHERE id = $1 LIMIT 1',
      [userId]
    );
    const user = users[0];
    if (!user) return null;

    const [legacyData, gatewayInfo, droplets] = await Promise.all([
      readState('billing', 'accounts', { accounts: [] }),
      this.getPlatformGateways(),
      CloudDB.getDroplets(user.id)
    ]);
    const legacyAccounts = Array.isArray(legacyData.accounts) ? legacyData.accounts : [];
    const legacyAccount = legacyAccounts.find(row =>
      row.userId === user.id || (user.tiwi_id && row.tiwiId === user.tiwi_id)
    );
    const legacyCredits = Number(legacyAccount?.verifiedCredits);
    const initialCredits = Number.isFinite(legacyCredits) && legacyCredits >= 0 ? legacyCredits : 0;

    const billingRows = await queryPg(`
        INSERT INTO cloud_billing_accounts (id, user_id, credits, monthly_spend, currency)
        VALUES ($1, $2, $3, 0, 'USD')
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING id, user_id, credits, monthly_spend, currency, updated_at
      `, [randomUUID(), user.id, initialCredits]);
    const billingRow = billingRows.rows[0];
    if (!billingRow) throw new Error('Billing account could not be loaded from PostgreSQL.');

    const credits = billingRow.credits === null ? Number.NaN : Number(billingRow.credits);
    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error('Billing account contains an invalid PostgreSQL balance.');
    }
    const invoices = (Array.isArray(legacyAccount?.invoices) ? legacyAccount.invoices : [])
      .filter(invoice =>
        (invoice?.paymentVerified === true || invoice?.grantVerified === true) &&
        invoice.id && Number.isFinite(Number(invoice.amount)) && invoice.createdAt
      )
      .map(invoice => ({
        id: String(invoice.id),
        amount: Number(invoice.amount),
        currency: String(invoice.currency || billingRow.currency || 'USD'),
        status: String(invoice.status || 'Verified'),
        description: String(invoice.description || ''),
        createdAt: String(invoice.createdAt),
        paidAt: invoice.paidAt ? String(invoice.paidAt) : null
      }));

    return {
      userId: user.id,
      billingAccountId: billingRow.id,
      billingAccountName: user.store_name || user.name || 'Cloud Billing Account',
      currency: billingRow.currency || 'USD',
      billingAddress: {
        address: user.address || '',
        city: user.city || '',
        country: user.country || '',
        phone: user.phone || '',
        postalCode: user.postal_code || ''
      },
      status: gatewayInfo.hasConfiguredGateway ? 'CONFIGURED' : 'UNCONFIGURED',
      hasConfiguredGateway: gatewayInfo.hasConfiguredGateway,
      paymentGatewayStatusMessage: gatewayInfo.hasConfiguredGateway
        ? `${gatewayInfo.activeGateways.length} platform gateway(s) have credentials configured`
        : 'No platform payment gateway configured',
      credits,
      promotionalCredits: Number.isFinite(Number(legacyAccount?.verifiedPromotionalCredits))
        ? Number(legacyAccount.verifiedPromotionalCredits)
        : null,
      paymentMethods: gatewayInfo.activeGateways,
      configuredGateways: gatewayInfo.activeGateways,
      invoices,
      budgets: [],
      monthToDateSpent: null,
      projectedCost: null,
      billingEnabled: false,
      usageMeteringEnabled: false,
      droplets
    };
  },

  async updateBillingAddress(userId, address) {
    if (!userId) throw new Error('Authentication required.');
    const { rows } = await queryPg(`
      UPDATE system_users
      SET address = $2,
          city = $3,
          country = $4,
          phone = $5,
          postal_code = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING address, city, country, phone, postal_code
    `, [userId, address.address, address.city, address.country, address.phone, address.postalCode]);
    if (!rows[0]) return null;
    return {
      address: rows[0].address || '',
      city: rows[0].city || '',
      country: rows[0].country || '',
      phone: rows[0].phone || '',
      postalCode: rows[0].postal_code || ''
    };
  },

  async addCredits() {
    throw new Error('Credit checkout is not connected. No payment or credits were processed.');
  },

  async redeemVoucher(userId, rawCode) {
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    if (!userId) return { success: false, error: 'Authentication required.' };
    if (!code || code.length > 64) return { success: false, error: 'Enter a valid voucher code.' };
    if (!await this.getBillingAccount(userId)) {
      return { success: false, error: 'Billing account is unavailable for this user.' };
    }

    const { rows } = await queryPg(`
      WITH claimed_voucher AS (
        UPDATE cloud_vouchers
        SET is_redeemed = TRUE, redeemed_by = $2, redeemed_at = CURRENT_TIMESTAMP
        WHERE UPPER(BTRIM(code)) = $1 AND is_redeemed = FALSE
        RETURNING id, amount
      ), updated_account AS (
        INSERT INTO cloud_billing_accounts (id, user_id, credits, monthly_spend, currency)
        SELECT $3, $2, amount, 0, 'USD' FROM claimed_voucher
        ON CONFLICT (user_id) DO UPDATE SET
          credits = COALESCE(cloud_billing_accounts.credits, 0) + EXCLUDED.credits,
          updated_at = CURRENT_TIMESTAMP
        RETURNING credits
      )
      SELECT claimed_voucher.id, claimed_voucher.amount, updated_account.credits
      FROM claimed_voucher CROSS JOIN updated_account
    `, [code, userId, randomUUID()]);

    if (!rows[0]) {
      return { success: false, error: 'Voucher code is invalid or has already been redeemed.' };
    }
    return {
      success: true,
      voucherId: rows[0].id,
      addedCredits: Number(rows[0].amount),
      balance: Number(rows[0].credits)
    };
  },

  async deductCredits() {
    return {
      success: false,
      error: 'Cloud usage metering is not connected. No credits were deducted.'
    };
  },

  async createBudget() {
    throw new Error('Cloud usage metering is not connected. No budget alert was saved.');
  },

  async deleteBudget() {
    return false;
  }
};
