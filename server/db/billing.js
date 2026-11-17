import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readState } from './stateDocuments.js';
import { buildPlatformOrderNumber, queryPg, recordPlatformBillingOrder } from './postgres.js';
import { CloudDB } from './cloud.js';
import { getPlatformPaymentGatewaysRaw } from '../administrator/adminRoutes.js';
import { extractClientSignals } from '../security/freeTierAbuseGuard.js';
import { redeemPromoCodeForUser, tryGrantWelcomeDepositBonus } from './promotions.js';
import { createHostedPayment, verifyHostedPaymentReturn, verifyStripeWebhook } from '../routes/storePaymentGatewayService.js';
import { convertCurrencyAmount } from '../routes/currencyHelpers.js';
import { getMarketUsdRates } from '../routes/marketCurrencyRates.js';
import {
  sendCloudPaymentCancelledEmail,
  sendCloudPaymentReminderEmail,
  sendCloudPaymentStartedEmail
} from './emailService.js';

const CHECKOUT_CURRENCIES = Object.freeze({ stripe: 'USD', paypal: 'USD', bkash: 'BDT', sslcommerz: 'BDT' });
const CHECKOUT_PROVIDERS = new Set(Object.keys(CHECKOUT_CURRENCIES));
const TERMINAL_TOPUP_STATUSES = new Set(['failed', 'cancelled']);
const memorySubscriptionInvoices = new Map();
let topupExpiryTimer = null;

export function resetMemoryBillingInvoices() {
  memorySubscriptionInvoices.clear();
}

const invoiceUrlForTopup = topup => {
  const origin = new URL(topup.return_origin).origin;
  return `${origin}/billing/invoices/${encodeURIComponent(topup.id)}`;
};

function parseCreditAmount(amount) {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000 || Math.round(parsedAmount * 100) !== parsedAmount * 100) {
    throw new TypeError('Choose a top-up amount from USD 1.00 to USD 10,000.00.');
  }
  return parsedAmount;
}
const toInvoice = row => ({
  id: String(row.id),
  orderNumber: String(row.id),
  amount: Number(row.amount),
  currency: String(row.currency || 'USD'),
  status: row.status === 'paid' ? 'Paid' : ['pending', 'processing'].includes(row.status) ? 'Pending'
    : row.status === 'cancelled' && row.cancel_reason === 'expired' ? 'Expired'
      : row.status === 'cancelled' ? 'Cancelled' : 'Failed',
  description: `${String(row.provider || '').toUpperCase()} Cloud credit top-up`,
  createdAt: new Date(row.created_at).toISOString(),
  paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
  expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
  orderType: 'credit_topup',
  planId: null,
  planName: null,
  isFreeTrial: false,
  cashCreditUsed: Number(row.amount),
  promoCreditUsed: 0
});

function mapOrderStatusToDisplay(rawStatus, grossAmountUsd) {
  const normalized = String(rawStatus || '').trim().toLowerCase();
  if (normalized === 'trial' || normalized === 'free_trial' || normalized === 'free') {
    return 'Free Trial';
  }
  if (normalized === 'paid') {
    return Number(grossAmountUsd || 0) <= 0 ? 'Free Trial' : 'Paid';
  }
  if (['pending', 'processing'].includes(normalized)) return 'Pending';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Failed';
}

function orderRowToInvoice(row) {
  const amount = Number(row.gross_amount_usd ?? row.amount ?? 0);
  const rawStatus = String(row.status || (amount <= 0 ? 'trial' : 'paid')).toLowerCase();
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const isFreeTrial = Boolean(
    metadata.isFreeTrial ||
    amount <= 0 ||
    rawStatus === 'trial' ||
    rawStatus === 'free' ||
    rawStatus === 'free_trial'
  );
  const planName = metadata.planName || row.item_name || row.plan_id || 'Subscription';
  const baseDesc = String(row.item_name || planName || row.order_type || 'Subscription');
  const description = isFreeTrial && !/free trial/i.test(baseDesc)
    ? `${baseDesc} (Free Trial)`
    : baseDesc;
  const createdAt = row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString();
  const displayStatus = mapOrderStatusToDisplay(rawStatus, amount);
  const orderNumber = String(row.order_number || row.id);
  return {
    id: orderNumber,
    orderNumber,
    amount,
    currency: String(row.currency || 'USD'),
    status: displayStatus,
    description,
    createdAt,
    paidAt: (displayStatus === 'Paid' || displayStatus === 'Free Trial') ? createdAt : null,
    expiresAt: null,
    orderType: row.order_type || null,
    planId: row.plan_id || null,
    planName,
    isFreeTrial,
    cashCreditUsed: Number(row.cash_credit_used_usd ?? 0),
    promoCreditUsed: Number(row.promo_credit_used_usd ?? 0)
  };
}

async function getCheckoutGateway(provider) {
  if (!CHECKOUT_PROVIDERS.has(provider)) throw new TypeError('Choose an available payment method.');
  const currency = CHECKOUT_CURRENCIES[provider];
  const gateways = await getPlatformPaymentGatewaysRaw();
  const gateway = gateways[provider];
  const credentialsReady = provider === 'stripe' ? gateway?.secretKey
    : provider === 'paypal' ? gateway?.clientId && gateway?.clientSecret
      : provider === 'bkash' ? gateway?.appKey && gateway?.appSecret && gateway?.username && gateway?.password
        : gateway?.storeId && gateway?.storePassword;
  if (!gateway?.enabled || !Array.isArray(gateway.currencies) || !gateway.currencies.includes(currency) || !credentialsReady) {
    throw new TypeError(`This checkout method is not enabled for ${currency} Cloud credit purchases.`);
  }
  if (gateway.mode !== 'live') {
    throw new TypeError('Live payment credentials are required for Cloud credit purchases.');
  }
  return gateway;
}

export const BillingDB = {
  init() { /* PostgreSQL schema is initialized by server startup. */ },

  startPendingTopupExpiry() {
    if (topupExpiryTimer) return;
    const expire = () => {
      this.expirePendingCreditTopups().catch(error => {
        console.error('[Cloud Billing] Pending top-up expiry job failed:', error.message);
      });
      this.sendPendingCreditTopupReminders().catch(error => {
        console.error('[Cloud Billing] Pending top-up reminder job failed:', error.message);
      });
    };
    expire();
    topupExpiryTimer = setInterval(expire, 60_000);
    topupExpiryTimer.unref?.();
  },

  async expirePendingCreditTopups() {
    const { rows } = await queryPg(`
      UPDATE cloud_credit_topups
      SET status = 'cancelled', cancel_reason = 'expired',
          cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'pending' AND expires_at <= CURRENT_TIMESTAMP
      RETURNING id
    `);
    return rows.length;
  },

  async sendPendingCreditTopupReminders() {
    const { rows } = await queryPg(`
      WITH due AS (
        SELECT id
        FROM cloud_credit_topups
        WHERE status = 'pending'
          AND expires_at > CURRENT_TIMESTAMP
          AND expires_at <= CURRENT_TIMESTAMP + INTERVAL '6 hours'
          AND reminder_sent_at IS NULL
          AND (reminder_claimed_at IS NULL OR reminder_claimed_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes')
        ORDER BY expires_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      ), claimed AS (
        UPDATE cloud_credit_topups topup
        SET reminder_claimed_at = CURRENT_TIMESTAMP
        FROM due
        WHERE topup.id = due.id AND topup.status = 'pending' AND topup.reminder_sent_at IS NULL
        RETURNING topup.id, topup.user_id, topup.provider, topup.amount,
                  topup.currency, topup.provider_amount, topup.provider_currency,
                  topup.expires_at, topup.return_origin, topup.reminder_claimed_at
      )
      SELECT claimed.*, users.email, users.name, users.store_name
      FROM claimed
      JOIN system_users users ON users.id = claimed.user_id
      WHERE users.email_verified = TRUE AND users.email IS NOT NULL AND BTRIM(users.email) <> ''
    `);

    let sent = 0;
    for (const topup of rows) {
      try {
        const delivery = await sendCloudPaymentReminderEmail({
          to: topup.email,
          name: topup.store_name || topup.name || 'Tiwlo Cloud customer',
          provider: topup.provider,
          amount: Number(topup.provider_amount ?? topup.amount),
          currency: topup.provider_currency || topup.currency,
          creditAmount: Number(topup.amount),
          reference: topup.id,
          invoiceUrl: invoiceUrlForTopup(topup),
          expiresAt: topup.expires_at
        });
        if (!delivery.success) {
          console.error(`[Cloud Billing] Checkout reminder could not be sent for ${topup.id}:`, delivery.error || 'mail transport failed');
          await queryPg(`
            UPDATE cloud_credit_topups
            SET reminder_claimed_at = NULL
            WHERE id = $1 AND reminder_claimed_at = $2 AND reminder_sent_at IS NULL
          `, [topup.id, topup.reminder_claimed_at]);
          continue;
        }
        await queryPg(`
          UPDATE cloud_credit_topups
          SET reminder_sent_at = CURRENT_TIMESTAMP, reminder_claimed_at = NULL
          WHERE id = $1 AND reminder_claimed_at = $2 AND reminder_sent_at IS NULL
        `, [topup.id, topup.reminder_claimed_at]);
        sent += 1;
      } catch (error) {
        console.error(`[Cloud Billing] Checkout reminder failed for ${topup.id}:`, error.message);
        await queryPg(`
          UPDATE cloud_credit_topups
          SET reminder_claimed_at = NULL
          WHERE id = $1 AND reminder_claimed_at = $2 AND reminder_sent_at IS NULL
        `, [topup.id, topup.reminder_claimed_at]);
      }
    }
    return sent;
  },

  async cancelCreditTopup(userId, id) {
    if (!userId || !id) return null;
    const { rows } = await queryPg(`
      UPDATE cloud_credit_topups
      SET status = 'cancelled',
          cancel_reason = CASE WHEN expires_at <= CURRENT_TIMESTAMP THEN 'expired' ELSE 'user' END,
          cancelled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $1 AND status = 'pending'
      RETURNING id, status, cancel_reason, expires_at
    `, [userId, id]);
    if (rows[0]) return { ...rows[0], cancelledNow: true };
    const existing = await queryPg(`
      SELECT id, status, cancel_reason, expires_at
      FROM cloud_credit_topups WHERE id = $2 AND user_id = $1 LIMIT 1
    `, [userId, id]);
    return existing.rows[0] ? { ...existing.rows[0], cancelledNow: false } : null;
  },

  async sendCreditTopupCancellationEmail(userId, id) {
    const { rows } = await queryPg(`
      SELECT topup.id, topup.provider, topup.amount, topup.currency,
             topup.provider_amount, topup.provider_currency, topup.return_origin,
             users.email, users.email_verified, users.name, users.store_name
      FROM cloud_credit_topups topup
      JOIN system_users users ON users.id = topup.user_id
      WHERE topup.id = $1 AND topup.user_id = $2
        AND topup.status = 'cancelled' AND topup.cancel_reason = 'user'
      LIMIT 1
    `, [id, userId]);
    const topup = rows[0];
    if (!topup?.email || topup.email_verified !== true) return false;
    const delivery = await sendCloudPaymentCancelledEmail({
      to: topup.email,
      name: topup.store_name || topup.name || 'Tiwlo Cloud customer',
      provider: topup.provider,
      amount: Number(topup.provider_amount ?? topup.amount),
      currency: topup.provider_currency || topup.currency,
      reference: topup.id,
      invoiceUrl: invoiceUrlForTopup(topup)
    });
    if (!delivery.success) {
      console.error(`[Cloud Billing] Checkout cancellation email could not be sent for ${id}:`, delivery.error || 'mail transport failed');
    }
    return delivery.success === true;
  },

  async setCreditTopupTerminalStatus(id, status) {
    if (!TERMINAL_TOPUP_STATUSES.has(status)) throw new TypeError('Invalid terminal credit top-up status.');
    const reason = status === 'cancelled' ? 'provider' : null;
    const { rows } = await queryPg(`
      UPDATE cloud_credit_topups
      SET status = $2, cancel_reason = $3,
          cancelled_at = CASE WHEN $2 = 'cancelled' THEN CURRENT_TIMESTAMP ELSE cancelled_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'pending'
      RETURNING id, status, cancel_reason, expires_at
    `, [id, status, reason]);
    if (rows[0]) return rows[0];
    const existing = await queryPg(`
      SELECT id, status, cancel_reason, expires_at
      FROM cloud_credit_topups WHERE id = $1 LIMIT 1
    `, [id]);
    return existing.rows[0] || null;
  },

  async getCreditQuote({ provider, amount }) {
    const creditAmount = parseCreditAmount(amount);
    await getCheckoutGateway(provider);
    const paymentCurrency = CHECKOUT_CURRENCIES[provider];
    if (paymentCurrency === 'USD') {
      return { creditAmount, creditCurrency: 'USD', paymentAmount: creditAmount, paymentCurrency: 'USD', exchangeRate: 1 };
    }
    const rates = await getMarketUsdRates();
    const converted = convertCurrencyAmount(creditAmount, 'USD', paymentCurrency, rates.rates);
    return {
      creditAmount, creditCurrency: 'USD', paymentAmount: converted.amount, paymentCurrency,
      exchangeRate: converted.exchangeRate, rateDate: rates.rateDates[paymentCurrency] || rates.observedAt,
      rateSource: rates.source
    };
  },

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

    const creditCheckoutGateways = activeGateways.filter(gateway =>
      CHECKOUT_PROVIDERS.has(gateway.id) && gateway.currencies.includes(CHECKOUT_CURRENCIES[gateway.id]) &&
      gateway.mode === 'live'
    );
    return {
      activeGateways,
      hasConfiguredGateway: activeGateways.length > 0,
      creditCheckoutGateways
    };
  },

  async getBillingAccount(userId) {
    if (!userId) return null;

    // Only a real authenticated system user may have a billing account.
    const { rows: users } = await queryPg(
      'SELECT id, tiwi_id, name, store_name, account_type, business_name, address, city, country, phone, postal_code FROM system_users WHERE id = $1 LIMIT 1',
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

    await queryPg(
      `UPDATE cloud_billing_accounts
       SET promotional_credits = 0, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
         AND promotional_credits > 0
         AND promotional_expires_at IS NOT NULL
         AND promotional_expires_at <= CURRENT_TIMESTAMP`,
      [user.id]
    ).catch(() => {});

    const billingRows = await queryPg(`
        INSERT INTO cloud_billing_accounts (id, user_id, credits, monthly_spend, currency, account_type, business_name)
        VALUES ($1, $2, $3, 0, 'USD', $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
          account_type = COALESCE(cloud_billing_accounts.account_type, EXCLUDED.account_type),
          business_name = COALESCE(cloud_billing_accounts.business_name, EXCLUDED.business_name)
        RETURNING id, user_id, credits, promotional_credits, promotional_expires_at,
                  welcome_promo_claimed_at, first_paid_topup_at, monthly_spend, currency,
                  account_type, business_name, updated_at
      `, [randomUUID(), user.id, initialCredits, user.account_type || 'personal', user.business_name || '']);
    const billingRow = billingRows.rows[0];
    if (!billingRow) throw new Error('Billing account could not be loaded from PostgreSQL.');

    const credits = billingRow.credits === null ? Number.NaN : Number(billingRow.credits);
    if (!Number.isFinite(credits) || credits < 0) {
      throw new Error('Billing account contains an invalid PostgreSQL balance.');
    }
    await this.expirePendingCreditTopups();
    const { rows: topups } = await queryPg(`
      SELECT id, amount, currency, provider, status, cancel_reason, expires_at, created_at, paid_at
      FROM cloud_credit_topups WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
    `, [user.id]);
    let orderRows = [];
    try {
      const orderResult = await queryPg(`
        SELECT id, order_number, user_id, tiwi_id, order_type, plan_id, item_name,
               gross_amount_usd, cash_credit_used_usd, promo_credit_used_usd,
               provider, currency, status, metadata, created_at
        FROM platform_billing_orders
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [user.id]);
      orderRows = Array.isArray(orderResult?.rows) ? orderResult.rows : [];
    } catch {
      orderRows = [];
    }
    const orderInvoices = orderRows.map(orderRowToInvoice);
    const seenOrderNumbers = new Set(orderInvoices.map(inv => inv.orderNumber || inv.id));
    const memInvoices = (memorySubscriptionInvoices.get(String(user.id)) || [])
      .filter(inv => !seenOrderNumbers.has(inv.orderNumber || inv.id));
    const legacyInvoices = (Array.isArray(legacyAccount?.invoices) ? legacyAccount.invoices : [])
      .filter(invoice =>
        (invoice?.paymentVerified === true || invoice?.grantVerified === true) &&
        invoice.id && Number.isFinite(Number(invoice.amount)) && invoice.createdAt
      )
      .map(invoice => ({
        id: String(invoice.id),
        orderNumber: String(invoice.id),
        amount: Number(invoice.amount),
        currency: String(invoice.currency || billingRow.currency || 'USD'),
        status: String(invoice.status || 'Verified'),
        description: String(invoice.description || ''),
        createdAt: String(invoice.createdAt),
        paidAt: invoice.paidAt ? String(invoice.paidAt) : null
      }));
    const invoices = [...topups.map(toInvoice), ...orderInvoices, ...memInvoices, ...legacyInvoices]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 50);

    return {
      userId: user.id,
      billingAccountId: billingRow.id,
      billingAccountName: user.store_name || user.name || 'Cloud Billing Account',
      accountType: billingRow.account_type || user.account_type || 'personal',
      companyName: billingRow.business_name || user.business_name || '',
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
      promotionalCredits: Number(billingRow.promotional_credits || 0) > 0
        ? Number(billingRow.promotional_credits)
        : (Number.isFinite(Number(legacyAccount?.verifiedPromotionalCredits))
          ? Number(legacyAccount.verifiedPromotionalCredits)
          : 0),
      promotionalExpiresAt: billingRow.promotional_expires_at ? new Date(billingRow.promotional_expires_at).toISOString() : null,
      paymentMethods: gatewayInfo.activeGateways,
      configuredGateways: gatewayInfo.activeGateways,
      invoices,
      budgets: [],
      monthToDateSpent: null,
      projectedCost: null,
      billingEnabled: false,
      usageMeteringEnabled: false,
      droplets,
      creditCheckoutGateways: gatewayInfo.creditCheckoutGateways
    };
  },

  async createCreditCheckout({ userId, provider, amount, origin, returnOrigin, expectedPaymentAmount, expectedRateDate, request = null }) {
    const parsedAmount = parseCreditAmount(amount);
    const gateway = await getCheckoutGateway(provider);
    const checkoutCurrency = CHECKOUT_CURRENCIES[provider];
    const rateSnapshot = checkoutCurrency === 'BDT' ? await getMarketUsdRates() : null;
    const converted = rateSnapshot ? convertCurrencyAmount(parsedAmount, 'USD', 'BDT', rateSnapshot.rates) : null;
    const providerAmount = converted?.amount ?? parsedAmount;
    const exchangeRate = converted?.exchangeRate ?? 1;
    const rateDate = rateSnapshot?.rateDates?.BDT ?? null;
    if (checkoutCurrency === 'BDT' && (
      Number(expectedPaymentAmount) !== providerAmount || String(expectedRateDate || '') !== String(rateDate || rateSnapshot?.observedAt || '')
    )) {
      throw new TypeError('The BDT conversion rate changed. Review the updated amount and try again.');
    }
    const billingAccount = await this.getBillingAccount(userId);
    if (!billingAccount) throw new TypeError('Cloud billing account is unavailable for this user.');
    if (provider === 'sslcommerz' && !billingAccount.billingAddress.phone.trim()) {
      throw new TypeError('Add a phone number to your billing address before using SSLCOMMERZ.');
    }
    const { rows: accountUsers } = await queryPg(
      'SELECT email, email_verified FROM system_users WHERE id = $1 LIMIT 1',
      [userId]
    );
    const accountUser = accountUsers[0];
    if (!accountUser?.email || accountUser.email_verified !== true) {
      throw new TypeError('Verify the email address on your Tiwlo account before starting a Cloud checkout.');
    }

    const id = `ctu-${randomUUID()}`;
    const invoiceNumber = id;
    const returnToken = randomBytes(32).toString('base64url');
    const returnTokenHash = createHash('sha256').update(returnToken).digest('hex');
    const mode = gateway.mode || (provider === 'stripe' ? 'test' : 'sandbox');
    const signals = extractClientSignals(request);
    const insertedTopups = await queryPg(`
      INSERT INTO cloud_credit_topups
        (id, user_id, provider, mode, amount, currency, provider_amount, provider_currency,
         exchange_rate, rate_date, rate_source, return_origin, return_token_hash, status, expires_at,
         device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash)
      VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7, $8, $9, $10, $11, $12, 'pending',
              CURRENT_TIMESTAMP + INTERVAL '24 hours', $13, $14, $15, $16, $17, $18)
      RETURNING expires_at
    `, [id, userId, provider, mode, parsedAmount, providerAmount, checkoutCurrency,
      exchangeRate, rateDate, rateSnapshot?.source || null, returnOrigin, returnTokenHash,
      signals.fingerprintHash, signals.deviceTokenHash, signals.browserCookieHash,
      signals.ipHash, signals.subnetHash, signals.userAgentHash]);
    const expiresAt = insertedTopups.rows[0]?.expires_at;
    if (!expiresAt) throw new Error('Checkout expiration could not be recorded.');

    const callbackUrl = `${origin}/api/cloud/billing/credits/return/${provider}?orderId=${encodeURIComponent(id)}&returnToken=${encodeURIComponent(returnToken)}`;
    const order = {
      id,
      invoiceNumber,
      currency: checkoutCurrency,
      customerEmail: accountUser.email,
      customerName: billingAccount.billingAccountName,
      customerPhone: billingAccount.billingAddress.phone,
      deliveryAddress: billingAccount.billingAddress.address,
      shippingAddress: {
        street: billingAccount.billingAddress.address,
        city: billingAccount.billingAddress.city,
        postalCode: billingAccount.billingAddress.postalCode,
        country: billingAccount.billingAddress.country
      },
      paymentGateway: { amount: providerAmount, amountMinor: Math.round(providerAmount * 100), tiwiId: userId }
    };
    try {
      const checkout = await createHostedPayment({
        provider, tiwiId: userId, credentials: gateway, mode, order,
        callbackUrl,
        successUrl: provider === 'stripe' ? `${callbackUrl}&session_id={CHECKOUT_SESSION_ID}` : callbackUrl,
        cancelUrl: `${callbackUrl}&result=cancelled`
      });
      await queryPg(`
        UPDATE cloud_credit_topups
        SET provider_payment_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'pending'
      `, [id, checkout.providerPaymentId]);
      let notificationSent = false;
      try {
        const notification = await sendCloudPaymentStartedEmail({
          to: accountUser.email,
          name: billingAccount.billingAccountName,
          provider,
          amount: providerAmount,
          currency: checkoutCurrency,
          creditAmount: parsedAmount,
          creditCurrency: 'USD',
          reference: id,
          checkoutUrl: checkout.checkoutUrl,
          expiresAt
        });
        notificationSent = notification.success === true;
        if (!notificationSent) {
          console.error(`[Cloud Billing] Checkout email could not be sent for ${id}:`, notification.error || 'mail transport failed');
        }
      } catch (error) {
        console.error(`[Cloud Billing] Checkout email failed for ${id}:`, error.message);
      }
      return {
        checkoutUrl: checkout.checkoutUrl, topupId: id,
        creditAmount: parsedAmount, creditCurrency: 'USD',
        paymentAmount: providerAmount, paymentCurrency: checkoutCurrency,
        exchangeRate, rateDate, rateSource: rateSnapshot?.source || null,
        expiresAt: new Date(expiresAt).toISOString(),
        notificationSent
      };
    } catch (error) {
      await queryPg(`UPDATE cloud_credit_topups SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      throw error;
    }
  },

  async getCreditTopupForReturn(id, provider, returnToken) {
    const { rows } = await queryPg(`
      SELECT id, user_id, provider, mode, amount, currency, provider_amount, provider_currency,
             exchange_rate, rate_date, rate_source, provider_payment_id,
             transaction_id, return_origin, return_token_hash, status, cancel_reason,
             expires_at, created_at, paid_at
      FROM cloud_credit_topups WHERE id = $1 AND provider = $2 LIMIT 1
    `, [id, provider]);
    const topup = rows[0];
    if (!topup || typeof returnToken !== 'string' || returnToken.length > 128) return null;
    const expected = Buffer.from(String(topup.return_token_hash || ''), 'hex');
    const supplied = createHash('sha256').update(returnToken).digest();
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    return topup;
  },

  async getCreditTopupById(id, provider) {
    const { rows } = await queryPg(`
      SELECT id, user_id, provider, mode, amount, currency, provider_amount, provider_currency,
             exchange_rate, rate_date, rate_source, provider_payment_id,
             transaction_id, return_origin, return_token_hash, status, cancel_reason,
             expires_at, created_at, paid_at
      FROM cloud_credit_topups WHERE id = $1 AND provider = $2 LIMIT 1
    `, [id, provider]);
    return rows[0] || null;
  },

  async verifyAndCompleteCreditTopup(topup, { query = {}, body = {}, rawBody, signature } = {}) {
    if (!topup?.id || !['pending', 'cancelled', 'failed'].includes(topup.status) || !topup.provider_payment_id) {
      return { success: topup?.status === 'paid', status: topup?.status || 'missing' };
    }
    const gateway = await getCheckoutGateway(topup.provider);
    const order = {
      id: topup.id,
      invoiceNumber: topup.id,
      currency: String(topup.provider_currency || topup.currency).toUpperCase(),
      paymentGateway: {
        amount: Number(topup.provider_amount ?? topup.amount), amountMinor: Math.round(Number(topup.provider_amount ?? topup.amount) * 100),
        tiwiId: topup.user_id, providerPaymentId: topup.provider_payment_id
      }
    };
    const verification = topup.provider === 'stripe' && rawBody
      ? await verifyStripeWebhook({ credentials: gateway, rawBody, signature, order })
      : await verifyHostedPaymentReturn({
        provider: topup.provider, tiwiId: topup.user_id, credentials: gateway,
        mode: topup.mode, order, query, body
      });
    if (!verification.paid) return { success: false, status: verification.rawStatus || 'pending' };
    if (Math.abs(Number(verification.amount) - Number(topup.provider_amount ?? topup.amount)) > 0.005 ||
        String(verification.currency).toUpperCase() !== String(topup.provider_currency || topup.currency).toUpperCase() ||
        String(verification.providerPaymentId) !== String(topup.provider_payment_id)) {
      throw new Error('Verified payment amount, currency, or provider reference did not match the pending top-up.');
    }

    const { rows: priorPaidRows } = await queryPg(
      `SELECT EXISTS(SELECT 1 FROM cloud_credit_topups WHERE user_id = $1 AND status = 'paid') AS had_paid`,
      [topup.user_id]
    );
    const hadPaidTopupsBefore = Boolean(priorPaidRows[0]?.had_paid);

    const { rows } = await queryPg(`
      WITH settled AS (
        UPDATE cloud_credit_topups topup
        SET status = 'paid', transaction_id = $5, paid_at = CURRENT_TIMESTAMP,
            cancel_reason = NULL, cancelled_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE topup.id = $1 AND topup.status IN ('pending', 'cancelled', 'failed')
          AND topup.provider_payment_id = $2 AND topup.amount = $3 AND topup.currency = $4
          AND EXISTS (SELECT 1 FROM cloud_billing_accounts account WHERE account.user_id = topup.user_id)
        RETURNING topup.id, topup.user_id, topup.amount, topup.currency,
                  topup.provider, topup.status, topup.created_at, topup.paid_at,
                  topup.device_fingerprint_hash, topup.device_token_hash, topup.browser_cookie_hash,
                  topup.ip_hash, topup.subnet_hash, topup.user_agent_hash
      ), credited AS (
        UPDATE cloud_billing_accounts account
        SET credits = COALESCE(account.credits, 0) + settled.amount,
            updated_at = CURRENT_TIMESTAMP
        FROM settled WHERE account.user_id = settled.user_id
        RETURNING account.user_id, account.credits
      )
      SELECT settled.*, credited.credits AS balance
      FROM settled JOIN credited ON credited.user_id = settled.user_id
    `, [topup.id, topup.provider_payment_id, Number(topup.amount), String(topup.currency), String(verification.transactionId || '').slice(0, 255)]);
    if (rows[0]) {
      const promoResult = await tryGrantWelcomeDepositBonus({
        userId: rows[0].user_id,
        topup: rows[0],
        hadPaidTopupsBefore
      }).catch((err) => {
        console.warn('[Cloud Billing] Welcome promo bonus check failed:', err.message);
        return { granted: false };
      });
      return {
        success: true,
        status: 'paid',
        balance: Number(rows[0].balance),
        invoice: toInvoice(rows[0]),
        promoGranted: Boolean(promoResult?.granted),
        promoBonusAmount: promoResult?.granted ? Number(promoResult.bonusAmountUsd || 0) : 0
      };
    }
    const { rows: currentRows } = await queryPg(
      'SELECT status FROM cloud_credit_topups WHERE id = $1 LIMIT 1',
      [topup.id]
    );
    const currentStatus = currentRows[0]?.status || topup.status;
    return { success: currentStatus === 'paid', status: currentStatus };
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

  async updateBillingProfile(userId, accountType, companyName) {
    if (!userId) throw new Error('Authentication required.');
    const { rows } = await queryPg(`
      UPDATE cloud_billing_accounts
      SET account_type = $2,
          business_name = CASE WHEN $2 = 'business' THEN $3 ELSE business_name END,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING account_type, business_name
    `, [userId, accountType, companyName]);
    if (!rows[0]) return null;
    return { accountType: rows[0].account_type, companyName: rows[0].business_name || '' };
  },

  async addCredits() {
    throw new Error('Credit checkout is not connected. No payment or credits were processed.');
  },

  async redeemVoucher(userId, rawCode, req = null) {
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    if (!userId) return { success: false, error: 'Authentication required.' };
    if (!code || code.length > 64) return { success: false, error: 'Enter a valid promotional or voucher code.' };
    if (!await this.getBillingAccount(userId)) {
      return { success: false, error: 'Billing account is unavailable for this user.' };
    }

    const promoResult = await redeemPromoCodeForUser({ userId, rawCode: code, req });
    if (promoResult?.found) {
      return promoResult;
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
    const addedCredits = Number(rows[0].amount);
    await recordPlatformBillingOrder({
      userId,
      orderType: 'voucher_redeem',
      itemName: `Voucher Credit (${code})`,
      grossAmountUsd: addedCredits,
      cashCreditUsedUsd: 0,
      promoCreditUsedUsd: 0,
      netCashRevenueUsd: 0,
      provider: 'voucher',
      currency: 'USD',
      status: 'paid',
      metadata: { voucherId: rows[0].id, code }
    });
    return {
      success: true,
      voucherId: rows[0].id,
      addedCredits,
      balance: Number(rows[0].credits)
    };
  },

  async deductCredits() {
    return {
      success: false,
      error: 'Cloud usage metering is not connected. No credits were deducted.'
    };
  },

  async recordSubscriptionInvoice(userId, {
    amountUsd = 0,
    cashCreditUsedUsd = 0,
    promoCreditUsedUsd = 0,
    planName = 'Subscription',
    tiwiId = null,
    orderType = 'subscription_charge',
    planId = null,
    provider = null,
    status = null,
    metadata = {},
    orderNumber = null
  } = {}) {
    if (!userId) return null;
    const numericAmount = Number(Number(amountUsd || 0).toFixed(2));
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const isFreeTrial = numericAmount <= 0 || ['trial', 'free', 'free_trial'].includes(normalizedStatus);
    const resolvedStatus = normalizedStatus || (isFreeTrial ? 'trial' : 'paid');
    const resolvedProvider = provider || (isFreeTrial ? 'free_trial' : 'wallet');
    const resolvedOrderNumber = orderNumber || buildPlatformOrderNumber();
    const nowIso = new Date().toISOString();
    const resolvedMetadata = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      isFreeTrial,
      planName
    };
    const cashUsed = Number(Number(cashCreditUsedUsd || 0).toFixed(2));
    const promoUsed = Number(Number(promoCreditUsedUsd || 0).toFixed(2));

    const persistedRecord = await recordPlatformBillingOrder({
      userId,
      tiwiId,
      orderType,
      planId,
      itemName: planName,
      grossAmountUsd: numericAmount,
      cashCreditUsedUsd: cashUsed,
      promoCreditUsedUsd: promoUsed,
      netCashRevenueUsd: cashUsed,
      provider: resolvedProvider,
      currency: 'USD',
      status: resolvedStatus,
      orderNumber: resolvedOrderNumber,
      metadata: resolvedMetadata
    });

    const mapped = orderRowToInvoice({
      id: persistedRecord?.id || `ord_${randomUUID()}`,
      order_number: persistedRecord?.orderNumber || resolvedOrderNumber,
      user_id: String(userId),
      tiwi_id: tiwiId,
      order_type: orderType,
      plan_id: planId,
      item_name: planName,
      gross_amount_usd: numericAmount,
      cash_credit_used_usd: cashUsed,
      promo_credit_used_usd: promoUsed,
      provider: resolvedProvider,
      currency: 'USD',
      status: resolvedStatus,
      metadata: resolvedMetadata,
      created_at: nowIso
    });

    if (!persistedRecord) {
      const existingList = memorySubscriptionInvoices.get(String(userId)) || [];
      existingList.unshift(mapped);
      memorySubscriptionInvoices.set(String(userId), existingList.slice(0, 100));
    }

    return mapped;
  },

  async chargeSubscriptionPlan(userId, amountUsd, planName = 'Store Subscription', context = {}) {
    const chargeAmount = Number(amountUsd);
    if (!userId) {
      return { success: false, statusCode: 401, error: 'Authentication required for subscription billing.' };
    }
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) {
      const invoice = await this.recordSubscriptionInvoice(userId, {
        amountUsd: 0,
        cashCreditUsedUsd: 0,
        promoCreditUsedUsd: 0,
        planName,
        tiwiId: context?.tiwiId || null,
        orderType: context?.orderType || 'subscription_charge',
        planId: context?.planId || null,
        provider: context?.provider || 'free_trial',
        status: context?.status || 'trial',
        metadata: context?.metadata || {}
      });
      return {
        success: true,
        chargedAmount: 0,
        cashCreditUsed: 0,
        promoCreditUsed: 0,
        orderNumber: invoice?.orderNumber || null,
        invoice
      };
    }
    const { rows } = await queryPg(
      `WITH prev AS (
         SELECT
           user_id,
           COALESCE(credits, 0) AS prev_credits,
           CASE
             WHEN promotional_expires_at IS NOT NULL AND promotional_expires_at <= CURRENT_TIMESTAMP THEN 0
             ELSE COALESCE(promotional_credits, 0)
           END AS prev_promo
         FROM cloud_billing_accounts
         WHERE user_id = $1
         FOR UPDATE
       ), upd AS (
         UPDATE cloud_billing_accounts a
         SET promotional_credits = GREATEST(0, prev.prev_promo - $2::numeric),
             credits = prev.prev_credits - GREATEST(0, $2::numeric - prev.prev_promo),
             monthly_spend = COALESCE(a.monthly_spend, 0) + $2::numeric,
             updated_at = CURRENT_TIMESTAMP
         FROM prev
         WHERE a.user_id = prev.user_id
           AND (prev.prev_credits + prev.prev_promo) >= $2::numeric
         RETURNING
           a.credits,
           a.promotional_credits,
           LEAST(prev.prev_promo, $2::numeric) AS promo_used,
           GREATEST(0, $2::numeric - LEAST(prev.prev_promo, $2::numeric)) AS cash_used
       )
       SELECT * FROM upd`,
      [userId, chargeAmount]
    );
    if (!rows[0]) {
      return {
        success: false,
        statusCode: 402,
        error: `Insufficient verified billing credits ($${chargeAmount.toFixed(2)} USD required for ${planName}). Please top up your billing credits first.`
      };
    }
    const promoCreditUsed = Number(Number(rows[0].promo_used || 0).toFixed(2));
    const cashCreditUsed = Number(Number(rows[0].cash_used || 0).toFixed(2));
    const invoice = await this.recordSubscriptionInvoice(userId, {
      amountUsd: chargeAmount,
      cashCreditUsedUsd: cashCreditUsed,
      promoCreditUsedUsd: promoCreditUsed,
      planName,
      tiwiId: context?.tiwiId || null,
      orderType: context?.orderType || 'subscription_charge',
      planId: context?.planId || null,
      provider: context?.provider || 'wallet',
      status: 'paid',
      metadata: context?.metadata || {}
    });
    return {
      success: true,
      chargedAmount: chargeAmount,
      cashCreditUsed,
      promoCreditUsed,
      orderNumber: invoice?.orderNumber || null,
      invoice,
      remainingCredits: Number(rows[0].credits) + Number(rows[0].promotional_credits || 0)
    };
  },

  async createBudget() {
    throw new Error('Cloud usage metering is not connected. No budget alert was saved.');
  },

  async deleteBudget() {
    return false;
  }
};
