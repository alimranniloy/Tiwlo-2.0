import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { createTemporaryFileStorage } from '../db/temporaryFileStorage.js';
import { getPublicMediaUrl, inferMediaType, storeMedia } from '../db/mediaStorage.js';
import {
  readData,
  writeData,
  logActivity,
  getActiveTiwiId,
  resolveActiveStore,
  resolveStorefrontHost,
  tenantContext,
  writeTenantData,
  PRODUCTS_FILE,
  CATEGORIES_FILE,
  SUBCATEGORIES_FILE,
  PURCHASES_FILE,
  SALES_FILE,
  CUSTOMERS_FILE,
  SUPPLIERS_FILE,
  STORE_SETTINGS_FILE,
  SUBSCRIPTION_FILE,
  STORE_CUSTOMER_ACCOUNTS_FILE,
  STORE_CUSTOMER_SESSIONS_FILE,
  STORE_REVIEWS_FILE
} from '../db/storeDataAdapter.js';
import { generateOtpWithRust, verifyOtpWithRust } from '../security/rustAuthSessionClient.js';
import { sendInvoiceEmail, sendSignupVerificationOtpEmail } from '../db/emailService.js';
import {
  contentSafetyMiddleware,
  checkAssetScope,
  recordViolation,
  scanAndSanitizeImage
} from '../security/index.js';
import { PaymentSecurity } from '../security/cryptoSecurity.js';
import { requireRecentReauth } from '../security/recentReauth.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { getMinStock, getStockStatus, isLowStock } from '../../shared/inventoryRules.js';
import {
  createStockAdjustment,
  deleteCategoryReferences,
  deleteSubcategoryReferences,
  getCategoryMetrics,
  renameCategoryReferences,
  renameSubcategoryReferences,
  validateStock,
  validateSellingPrice
} from './catalogHelpers.js';
import {
  canTransitionOrder,
  normalizePhone,
  validateOrderUpdate
} from './orderHelpers.js';
import { canTransitionPurchase, PURCHASE_STATUSES, receivePurchaseOrder } from './purchaseHelpers.js';
import {
  amountToCents,
  calculateAccountBalance,
  calculateInventoryValuation,
  calculatePercentageCents,
  reverseOrderInventory,
  sumPaymentCents
} from './accountingHelpers.js';
import {
  calculateCashbookBalance,
  calculateFixedPayrollGrossCents,
  calculateOutstandingAdvanceCents,
  calculatePayrollGrossCents,
  parseDateOnly,
  parseHoursToHundredths
} from './hrAccountingHelpers.js';
import {
  recordVerifiedGatewayPayment,
  updateOrderRefundPaymentStatus
} from './storePaymentAccounting.js';
import {
  calculatePromotionDiscount,
  getPromotionUsage,
  validatePromotionSettings
} from './promotionHelpers.js';
import { normalizeStorePages } from './storePageHelpers.js';
import {
  canEditStoreOrder,
  canReviewOrder,
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  findCustomerSession,
  getCustomerOtpType,
  hashCustomerSessionToken,
  normalizeCustomerAddress,
  normalizeCustomerEmail,
  normalizeRefundAmount,
  validateCustomerReview
} from './storeCustomerHelpers.js';
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  CHECKOUT_READY_PROVIDERS,
  normalizePaymentProviderConfiguration,
  PAYMENT_PROVIDER_DEFINITIONS,
  toPublicPaymentProvider
} from './paymentProviderHelpers.js';
import {
  createHostedPayment,
  createHostedRefund,
  verifyHostedPaymentReturn,
  verifyStripeWebhook,
  verifyStripeWebhookSignature
} from './storePaymentGatewayService.js';
import {
  normalizeStorefrontAddress,
  normalizeShippingZones,
  quoteShipping
} from './shippingHelpers.js';
import { getShippingCountries, searchShippingCities } from './shippingGeography.js';
import {
  convertCurrencyAmount,
  getFreshUsdRates,
  normalizeCurrencyCode,
  normalizeUsdRates,
  validateMarketRateRows
} from './currencyHelpers.js';

const storage = createTemporaryFileStorage('store-upload');

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();
const MARKET_RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let marketUsdRateCache = null;
let marketUsdRateRequest = null;
const FINANCE_LEDGER_FILE = 'finance_ledger';
const FINANCE_SETTINGS_FILE = 'finance_settings';
const STAFF_FILE = 'staff';
const STAFF_TRANSACTIONS_FILE = 'staff_transactions';
const PAYROLL_FILE = 'payroll_records';

function appendFinanceEntry(ledger, entry) {
  if (entry.referenceId && ledger.some(existing =>
    existing.referenceType === entry.referenceType && existing.referenceId === entry.referenceId
  )) return ledger;
  const latestSequence = ledger.reduce((maximum, existing) =>
    Number.isSafeInteger(existing.sequence) ? Math.max(maximum, existing.sequence) : maximum, 0);
  ledger.unshift({ id: `fin-${randomUUID()}`, ...entry, sequence: latestSequence + 1 });
  return ledger;
}

function getFinanceBalance(financeSettings, ledger) {
  if (!Number.isSafeInteger(financeSettings?.openingBalanceCents) ||
      !financeSettings?.openingBalanceAt) return null;
  return calculateCashbookBalance(
    financeSettings.openingBalanceCents,
    financeSettings.openingBalanceAt,
    ledger
  );
}

function addCashbookExpense(ledger, financeSettings, { amountCents, description, category, referenceType, referenceId, staffId = '', paymentMethod = 'Cash', reference = '' }) {
  const balanceCents = getFinanceBalance(financeSettings, ledger);
  const isConfigured = Number.isSafeInteger(financeSettings?.openingBalanceCents) &&
    Boolean(financeSettings.openingBalanceAt);
  if (isConfigured && balanceCents === null) {
    return { error: 'Company cashbook is invalid. Resolve its ledger before recording payments.' };
  }
  if (balanceCents !== null && amountCents > balanceCents) {
    return { error: 'This payment exceeds the available company balance.' };
  }
  const createdAt = new Date().toISOString();
  return {
    ledger: appendFinanceEntry(ledger, {
      direction: 'out',
      amountCents,
      category,
      description,
      referenceType,
      referenceId,
      staffId,
      paymentMethod,
      reference,
      createdAt
    }),
    createdAt
  };
}

function addCashbookIncome(ledger, { amountCents, description, category, referenceType, referenceId, staffId = '', paymentMethod = 'Cash', reference = '' }) {
  return appendFinanceEntry(ledger, {
    direction: 'in',
    amountCents,
    category,
    description,
    referenceType,
    referenceId,
    staffId,
    paymentMethod,
    reference,
    createdAt: new Date().toISOString()
  });
}

const CURRENCY_SYMBOLS = Object.freeze({
  BDT: '৳',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  USD: '$'
});
const customerOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many code requests. Please wait and try again.' }
});
const customerOtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please wait and try again.' }
});

function customerSessionCookieOptions(req, maxAge = 30 * 24 * 60 * 60 * 1000) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req.secure || req.headers?.['x-forwarded-proto'] === 'https',
    sameSite: 'strict',
    path: '/',
    maxAge
  };
}

async function runOnStorefrontTenant(req, res, callback) {
  const store = await resolveStorefrontHost(req.hostname);
  if (!store) return res.status(404).json({ error: 'Storefront not found.' });
  req.storefrontStore = store;
  req.activeStore = store;
  return tenantContext.run({ tiwiId: store.tiwiId }, () => callback(store));
}

async function getStoreCustomer(req) {
  const token = req.cookies?.[CUSTOMER_SESSION_COOKIE];
  if (!token) return null;
  const sessions = await readData(STORE_CUSTOMER_SESSIONS_FILE, []);
  const session = findCustomerSession(sessions, token);
  if (!session) return null;
  const accounts = await readData(STORE_CUSTOMER_ACCOUNTS_FILE, []);
  const account = accounts.find(customer => customer.id === session.accountId && customer.disabled !== true);
  return account ? { account, session } : null;
}

function paymentTokenMatches(order, token) {
  const stored = order?.paymentGateway?.returnTokenHash;
  if (!stored || typeof token !== 'string' || token.length < 32 || token.length > 128) return false;
  const expected = Buffer.from(stored, 'hex');
  const candidate = createHash('sha256').update(token).digest();
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

async function getProviderCredentials(settings, provider, tiwiId) {
  const record = settings?.paymentProviderCredentials?.[provider];
  if (!record) throw new TypeError('This payment method is not configured.');
  return decryptPaymentCredentials(tiwiId, provider, {
    ciphertext: Buffer.from(record.ciphertext, 'base64'),
    iv: Buffer.from(record.iv, 'base64'),
    authTag: Buffer.from(record.authTag, 'base64')
  });
}

function paymentOrderReceipt(order) {
  return {
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    date: order.date,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paidAmount: order.paidAmount ?? (order.paymentStatus === 'Paid' ? order.totalAmount : 0),
    dueAmount: order.dueAmount ?? (order.paymentStatus === 'Paid' ? 0 : order.totalAmount),
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount,
    currency: order.currency,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryAddress: order.deliveryAddress,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    items: (order.items || []).map(item => ({
      productId: item.productId || item.id,
      productName: item.productName || item.name,
      name: item.productName || item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? item.price,
      total: item.total,
      image: item.image
    }))
  };
}

async function recordVerifiedPayment(order, verification, sales, index) {
  const changed = recordVerifiedGatewayPayment(order, verification);
  if (!changed) return false;
  sales[index] = order;
  return true;
}

async function handleStorePaymentReturn(req, res, provider, { ipn = false, webhook = false } = {}) {
  let customerReturnUrl = '';
  try {
    return await runOnStorefrontTenant(req, res, async store => {
      const sales = await readData(SALES_FILE, [], store.tiwiId);
      const settings = await readData(STORE_SETTINGS_FILE, {}, store.tiwiId);
      let order;
      let verification;

      if (webhook) {
        if (!Buffer.isBuffer(req.rawBody)) {
          return res.status(400).json({ error: 'Stripe webhook body is unavailable.' });
        }
        const credentials = await getProviderCredentials(settings, provider, store.tiwiId);
        if (!verifyStripeWebhookSignature(
          req.rawBody,
          req.headers['stripe-signature'],
          credentials.webhookSecret
        )) {
          return res.status(400).json({ error: 'Stripe webhook signature is invalid.' });
        }
        let event;
        try {
          event = JSON.parse(req.rawBody.toString('utf8'));
        } catch {
          return res.status(400).json({ error: 'Stripe webhook payload is invalid.' });
        }
        const eventObject = event.data?.object;
        if (['refund.updated', 'refund.created', 'refund.failed'].includes(event.type)) {
          const refundOrderId = String(eventObject?.metadata?.order_id || '');
          const refundId = String(eventObject?.metadata?.refund_id || '');
          const refundOrderIndex = sales.findIndex(sale =>
            sale.id === refundOrderId && sale.channel === 'storefront' &&
            sale.paymentGateway?.provider === provider
          );
          if (refundOrderIndex < 0) return res.status(404).json({ error: 'Refund order not found.' });
          const refundOrder = sales[refundOrderIndex];
          const refundEntry = (refundOrder.refundHistory || []).find(entry =>
            entry.id === refundId && entry.providerRefundId === eventObject?.id
          );
          if (!refundEntry) return res.status(404).json({ error: 'Refund record not found.' });
          if (eventObject.payment_intent !== refundOrder.paymentGateway?.transactionId ||
              Number(eventObject.amount) !== Math.round(Number(refundEntry.amount) * 100) ||
              String(eventObject.currency).toUpperCase() !== String(refundOrder.currency).toUpperCase()) {
            return res.status(400).json({ error: 'Stripe refund event does not match the stored refund.' });
          }
          if (eventObject.status === 'succeeded' && refundEntry.status !== 'gateway_confirmed') {
            refundEntry.status = 'gateway_confirmed';
            refundEntry.processedAt = new Date().toISOString();
            refundEntry.events = [
              ...(refundEntry.events || []),
              {
                action: 'gateway-refund-confirmed',
                actorType: 'gateway',
                actorId: provider,
                at: refundEntry.processedAt,
                reference: eventObject.id
              }
            ];
            updateOrderRefundPaymentStatus(refundOrder);
            refundOrder.updatedAt = refundEntry.processedAt;
            sales[refundOrderIndex] = refundOrder;
            const refundCents = amountToCents(refundEntry.amount);
            if (refundCents === null) return res.status(409).json({ error: 'Confirmed refund amount cannot be recorded safely.' });
            const financeLedger = await readData(FINANCE_LEDGER_FILE, [], store.tiwiId);
            const nextFinanceLedger = appendFinanceEntry(financeLedger, {
              direction: 'out',
              amountCents: refundCents,
              category: 'Storefront refund',
              description: `Gateway refund for ${refundOrder.invoiceNumber}`,
              referenceType: 'refund',
              referenceId: refundEntry.id,
              reference: eventObject.id,
              paymentMethod: `Gateway (${provider})`,
              createdAt: refundEntry.processedAt
            });
            await writeTenantData({
              [SALES_FILE]: sales,
              [FINANCE_LEDGER_FILE]: nextFinanceLedger
            }, store.tiwiId);
            await logActivity('sale', 'Gateway refund confirmed', `${refundOrder.invoiceNumber} • ${refundOrder.currency} ${refundEntry.amount}`, store.tiwiId);
          } else if (['failed', 'canceled'].includes(eventObject.status) &&
              ['gateway_pending', 'gateway_unknown'].includes(refundEntry.status)) {
            refundEntry.status = 'gateway_failed';
            refundEntry.failureReason = String(eventObject.failure_reason || eventObject.failure_message || 'Refund failed at provider.').slice(0, 500);
            refundEntry.updatedAt = new Date().toISOString();
            refundEntry.events = [
              ...(refundEntry.events || []),
              {
                action: 'gateway-refund-failed',
                actorType: 'gateway',
                actorId: provider,
                at: refundEntry.updatedAt,
                note: refundEntry.failureReason,
                reference: eventObject.id
              }
            ];
            sales[refundOrderIndex] = refundOrder;
            await writeData(SALES_FILE, sales, store.tiwiId);
          }
          return res.status(200).json({ received: true });
        }
        if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) ||
            eventObject?.payment_status !== 'paid') {
          return res.status(200).json({ received: true });
        }
        const orderId = String(eventObject?.metadata?.order_id || '');
        const index = sales.findIndex(sale =>
          sale.id === orderId && sale.channel === 'storefront' &&
          sale.paymentGateway?.provider === provider
        );
        if (index < 0) return res.status(404).json({ error: 'Payment order not found.' });
        order = sales[index];
        verification = await verifyStripeWebhook({
          credentials,
          rawBody: req.rawBody,
          signature: req.headers['stripe-signature'],
          order
        });
        if (verification.paid) {
          const changed = await recordVerifiedPayment(order, verification, sales, index);
          if (changed) {
            const ledger = await readData(FINANCE_LEDGER_FILE, [], store.tiwiId);
            const amountCents = amountToCents(verification.amount);
            if (amountCents === null) throw new TypeError('Verified gateway amount cannot be recorded safely.');
            const payment = order.payments.at(-1);
            const nextLedger = addCashbookIncome(ledger, {
              amountCents,
              description: `Verified storefront payment for ${order.invoiceNumber}`,
              category: 'Verified storefront payment',
              referenceType: 'sale_payment',
              referenceId: payment.id,
              paymentMethod: payment.method,
              reference: payment.reference
            });
            await writeTenantData({ [SALES_FILE]: sales, [FINANCE_LEDGER_FILE]: nextLedger }, store.tiwiId);
            await logActivity('sale', 'Storefront payment verified', `${order.invoiceNumber} • ${provider}`, store.tiwiId);
          }
        }
        return res.status(200).json({ received: true });
      }

      const body = req.body || {};
      const orderId = String(req.query?.orderId || body.value_a || '').trim();
      const token = String(req.query?.token || body.token || '');
      if (!orderId || orderId.length > 120) {
        return ipn ? res.sendStatus(400) : res.status(400).json({ error: 'Payment order reference is missing.' });
      }
      const index = sales.findIndex(sale =>
        sale.id === orderId && sale.channel === 'storefront' &&
        sale.paymentGateway?.provider === provider
      );
      if (index < 0) return ipn ? res.sendStatus(404) : res.status(404).json({ error: 'Payment order not found.' });
      order = sales[index];
      if (!paymentTokenMatches(order, token)) {
        return ipn ? res.sendStatus(403) : res.status(403).json({ error: 'Payment return could not be verified.' });
      }

      const indexUrl = `${req.protocol}://${req.get('host')}/#/store/order-success/${encodeURIComponent(order.id)}`;
      customerReturnUrl = `${indexUrl}?receipt=${encodeURIComponent(token)}&payment=pending`;
      const resultHint = String(req.query?.result || '').toLowerCase();
      let pageState = ['cancelled', 'failed'].includes(resultHint) ? resultHint : 'pending';
      if (!['cancelled', 'failed'].includes(resultHint)) {
        const credentials = await getProviderCredentials(settings, provider, store.tiwiId);
        verification = await verifyHostedPaymentReturn({
          provider,
          tiwiId: store.tiwiId,
          credentials,
          mode: order.paymentGateway?.mode || settings.paymentProviders?.[provider]?.mode || 'sandbox',
          order,
          query: req.query || {},
          body
        });
        if (verification.paid) {
          const changed = await recordVerifiedPayment(order, verification, sales, index);
          pageState = 'paid';
          if (changed) {
            const ledger = await readData(FINANCE_LEDGER_FILE, [], store.tiwiId);
            const amountCents = amountToCents(verification.amount);
            if (amountCents === null) throw new TypeError('Verified gateway amount cannot be recorded safely.');
            const payment = order.payments.at(-1);
            const nextLedger = addCashbookIncome(ledger, {
              amountCents,
              description: `Verified storefront payment for ${order.invoiceNumber}`,
              category: 'Verified storefront payment',
              referenceType: 'sale_payment',
              referenceId: payment.id,
              paymentMethod: payment.method,
              reference: payment.reference
            });
            await writeTenantData({ [SALES_FILE]: sales, [FINANCE_LEDGER_FILE]: nextLedger }, store.tiwiId);
            await logActivity('sale', 'Storefront payment verified', `${order.invoiceNumber} • ${provider}`, store.tiwiId);
          }
        } else if (['cancel', 'cancelled', 'failure', 'failed'].includes(
          String(verification.rawStatus || '').toLowerCase()
        )) {
          pageState = 'failed';
        }
      }
      if (ipn) return res.sendStatus(200);
      const redirect = `${indexUrl}?receipt=${encodeURIComponent(token)}&payment=${encodeURIComponent(pageState)}`;
      return res.redirect(303, redirect);
    });
  } catch (error) {
    if (!ipn && !webhook && customerReturnUrl) {
      console.error(`[Store payment] ${provider} return verification failed:`, error.message);
      return res.redirect(303, customerReturnUrl);
    }
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error(`[Store payment] ${provider} return verification failed:`, error.message);
    return res.status(502).json({ error: 'The payment status could not be confirmed. Contact the store before trying again.' });
  }
}

function publicCustomer(account) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    phone: account.phone || '',
    addresses: Array.isArray(account.addresses) ? account.addresses : [],
    createdAt: account.createdAt
  };
}

function getStoreCurrencySettings(currencyValue, fallbackSymbol = '') {
  const currency = String(currencyValue || 'USD');
  const code = currency.match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';
  const currencySymbol = currency.match(/\(([^)]+)\)/)?.[1] || CURRENCY_SYMBOLS[code] || fallbackSymbol;
  return { currency, currencySymbol };
}

async function getMarketUsdRates() {
  const now = Date.now();
  if (marketUsdRateCache &&
      now - marketUsdRateCache.fetchedAt < MARKET_RATE_CACHE_TTL_MS &&
      getFreshUsdRates(marketUsdRateCache, now)) {
    return marketUsdRateCache;
  }
  if (marketUsdRateRequest) return marketUsdRateRequest;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD', {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Frankfurter returned HTTP ${response.status}.`);
      const { rates, rateDates, observedAt } = validateMarketRateRows(await response.json());
      marketUsdRateCache = {
        rates,
        rateDates,
        observedAt,
        fetchedAt: Date.now(),
        source: 'Frankfurter blended central-bank reference rates'
      };
      return marketUsdRateCache;
    } finally {
      clearTimeout(timeout);
    }
  })();
  marketUsdRateRequest = request;
  try {
    return await request;
  } finally {
    if (marketUsdRateRequest === request) marketUsdRateRequest = null;
  }
}

// Store management and POS data are private to an authenticated tenant.
router.use(async (req, res, next) => {
  // Never intercept auth or public endpoints
  if (req.path.startsWith('/auth') || req.path.startsWith('/public') || req.path.startsWith('/media')) {
    return next();
  }
  if (req.method === 'POST' && req.path === '/sales' && req.body?.channel === 'storefront') {
    try {
      const storefrontStore = await resolveStorefrontHost(req.hostname);
      if (storefrontStore) {
        req.storefrontStore = storefrontStore;
        req.activeStore = storefrontStore;
        return tenantContext.run({ tiwiId: storefrontStore.tiwiId }, next);
      }
    } catch (error) {
      return next(error);
    }
  }
  if (!req.activeUser) return res.status(401).json({ error: 'Authentication required' });
  next();
});

const getReqUserId = (req) => {
  // This route runs after authentication: ownership always comes from the
  // verified session, never from a spoofable request field.
  return req.activeUser?.id || req.activeUser?.tiwiId || null;
};

async function persistStoreImageUpload(req, purpose) {
  const file = req.file;
  if (!file) throw new Error('No image file uploaded.');
  const contentType = inferMediaType(file.filename);
  if (!contentType.startsWith('image/')) {
    await fs.promises.unlink(file.path);
    const error = new Error('Only image files are accepted.');
    error.statusCode = 415;
    throw error;
  }

  const buffer = await fs.promises.readFile(file.path);
  const scanResult = await scanAndSanitizeImage(buffer, purpose, file.originalname);
  if (scanResult.isVideo || !scanResult.safe) {
    await fs.promises.unlink(file.path);
    if (!scanResult.isVideo) {
      await recordViolation({
        user: req.activeUser,
        category: 'ADULT_CONTENT',
        policyName: 'Adult & Sexually Explicit Content Policy',
        reason: scanResult.reason,
        contentType: purpose
      });
    }
    const error = new Error(scanResult.isVideo ? 'Only image files are accepted.' : scanResult.reason);
    error.statusCode = scanResult.isVideo ? 415 : 400;
    throw error;
  }

  const url = `/uploads/${file.filename}`;
  await storeMedia({
    aliases: [url],
    buffer: scanResult.sanitizedBuffer || buffer,
    contentType,
    originalFilename: file.originalname,
    ownerId: req.activeUser?.id,
    purpose
  });
  await fs.promises.unlink(file.path);
  return getPublicMediaUrl(url);
}

router.get('/public/storefront', async (req, res) => {
  try {
    const store = await resolveStorefrontHost(req.hostname);
    if (!store) return res.status(404).json({ error: 'Storefront not found.' });

    const storefrontData = await tenantContext.run({ tiwiId: store.tiwiId }, async () => {
      const [products, categories, storedSettings, reviews] = await Promise.all([
        readData(PRODUCTS_FILE, [], store.tiwiId),
        readData(CATEGORIES_FILE, [], store.tiwiId),
        readData(STORE_SETTINGS_FILE, {}, store.tiwiId),
        readData(STORE_REVIEWS_FILE, [], store.tiwiId)
      ]);
      const settings = Object.fromEntries([
        'storeName', 'storeTagline', 'storeTitle', 'storeDescription',
        'storeLogo', 'storeFavicon', 'activeTheme', 'themeColor',
        'themeColorPreset', 'themeMode', 'contactEmail', 'contactPhone',
        'storeAddress', 'storeCity', 'storeCountry', 'storePostalCode',
        'currency', 'currencySymbol', 'bannerSlidingSpeed', 'heroBanners',
        'taxRate', 'shippingFlatRate', 'freeShippingThreshold', 'shippingZones',
        'promoActive', 'promoCode', 'promoDiscountPercent', 'storePages',
        'refundRequestsEnabled'
      ].filter(key => storedSettings?.[key] !== undefined)
        .map(key => [key, storedSettings[key]]));
      settings.storePages = normalizeStorePages(settings.storePages || [])
        .filter(page => page.enabled);
      settings.refundRequestsEnabled = storedSettings?.refundRequestsEnabled !== false;
      settings.paymentMethods = Object.entries(PAYMENT_PROVIDER_DEFINITIONS)
        .map(([provider]) => toPublicPaymentProvider(
          provider,
          storedSettings?.paymentProviders?.[provider],
          storedSettings?.paymentProviderCredentials?.[provider]
        ))
        .filter(method => method.enabled);
      return {
        settings: {
          ...settings,
          isStorefront: true,
          ...getStoreCurrencySettings(store.currency || settings.currency, settings.currencySymbol),
          storeName: settings.storeName || store.storeName
        },
        products: products.map(product => {
          const productReviews = reviews.filter(review =>
            review.productId === product.id && review.status === 'approved'
          );
          const rating = productReviews.length
            ? productReviews.reduce((total, review) => total + review.rating, 0) / productReviews.length
            : null;
          return {
            id: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            category: product.category,
            description: product.description,
            image: product.image,
            images: product.images,
            status: product.status,
            stock: product.stock,
            rating: rating === null ? undefined : Number(rating.toFixed(1)),
            reviews: productReviews.length
          };
        }),
        categories: categories.map(category => typeof category === 'string'
          ? { id: category, name: category }
          : {
            id: category.id,
            name: category.name,
            description: category.description,
            image: category.image
          })
      };
    });

    res.json({ store, ...storefrontData });
  } catch (error) {
    console.error('Failed to load public storefront:', error);
    res.status(500).json({ error: 'Could not load this storefront.' });
  }
});

router.post('/public/customer-auth/request-otp', customerOtpLimiter, async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async store => {
      const email = normalizeCustomerEmail(req.body?.email);
      const otp = await generateOtpWithRust(email, getCustomerOtpType(store.tiwiId), 10);
      const delivery = await sendSignupVerificationOtpEmail({
        to: email,
        name: String(req.body?.name || 'Shopper').trim().slice(0, 120) || 'Shopper',
        code: otp.code
      });
      return res.json({
        success: true,
        verificationToken: otp.token,
        emailMasked: `${email.slice(0, 2)}***@${email.split('@')[1]}`,
        expiresAt: otp.expiresAt,
        deliveryStatus: delivery?.status || 'queued'
      });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store customer auth] OTP request failed:', error.message);
    return res.status(503).json({ error: 'Could not send the sign-in code. Please try again shortly.' });
  }
});

router.post('/public/customer-auth/verify-otp', customerOtpVerifyLimiter, async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async store => {
      const token = String(req.body?.verificationToken || '');
      const code = String(req.body?.code || '').trim();
      if (!/^tok_[a-f0-9]{48}$/.test(token) || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ error: 'Enter the six-digit email code.' });
      }
      const verification = await verifyOtpWithRust(token, code, getCustomerOtpType(store.tiwiId));
      if (!verification.valid) return res.status(401).json({ error: 'The code is invalid or expired. Request a new code.' });
      const email = normalizeCustomerEmail(verification.email);
      const accounts = await readData(STORE_CUSTOMER_ACCOUNTS_FILE, []);
      let account = accounts.find(customer => customer.email === email);
      const name = String(req.body?.name || '').trim();
      if (name.length > 120) return res.status(400).json({ error: 'Name must be no longer than 120 characters.' });
      if (!account) {
        account = {
          id: randomUUID(),
          email,
          name: name || email.split('@')[0],
          phone: '',
          addresses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        accounts.push(account);
      } else if (name && account.name !== name) {
        account.name = name;
        account.updatedAt = new Date().toISOString();
      }
      await writeData(STORE_CUSTOMER_ACCOUNTS_FILE, accounts);
      const sessions = (await readData(STORE_CUSTOMER_SESSIONS_FILE, []))
        .filter(session => Date.parse(session.expiresAt) > Date.now() && session.accountId !== account.id);
      const { token: sessionToken, record } = createCustomerSession(account.id);
      const customerSessions = [
        ...sessions,
        ...(await readData(STORE_CUSTOMER_SESSIONS_FILE, []))
          .filter(session => session.accountId === account.id && Date.parse(session.expiresAt) > Date.now())
          .slice(-9),
        record
      ];
      await writeData(STORE_CUSTOMER_SESSIONS_FILE, customerSessions);
      res.cookie(CUSTOMER_SESSION_COOKIE, sessionToken, customerSessionCookieOptions(req));
      return res.json({ success: true, customer: publicCustomer(account) });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store customer auth] OTP verification failed:', error.message);
    return res.status(503).json({ error: 'Could not verify the sign-in code. Please try again.' });
  }
});

router.get('/public/customer-auth/me', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) {
        res.clearCookie(CUSTOMER_SESSION_COOKIE, customerSessionCookieOptions(req, 0));
        return res.status(401).json({ error: 'Sign in to view your customer account.' });
      }
      const sales = await readData(SALES_FILE, []);
      const orders = sales
        .filter(order => order.customerAccountId === current.account.id)
        .map(order => ({
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          date: order.date,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          currency: order.currency,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          shippingAddress: order.shippingAddress,
          billingAddress: order.billingAddress,
          items: (order.items || []).map(item => ({
            productId: item.productId || item.id,
            name: item.productName || item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? item.price,
            total: item.total,
            image: item.image
          })),
          statusHistory: (order.statusHistory || []).map(({ status, at }) => ({ status, at })),
          refundHistory: (order.refundHistory || []).map(refund => ({
            id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            status: refund.status,
            reason: refund.reason,
            requestedAt: refund.requestedAt,
            processedAt: refund.processedAt,
            manualReference: refund.manualReference
          }))
        }));
      return res.json({ customer: publicCustomer(current.account), orders });
    });
  } catch (error) {
    console.error('[Store customer auth] Account lookup failed:', error.message);
    return res.status(500).json({ error: 'Could not load this customer account.' });
  }
});

router.patch('/public/customer-auth/profile', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to update your profile.' });
      const name = String(req.body?.name ?? current.account.name).trim();
      const phone = String(req.body?.phone ?? current.account.phone ?? '').trim();
      if (!name || name.length > 120 || phone.length > 40) {
        return res.status(400).json({ error: 'Name is required (up to 120 characters); phone must be at most 40 characters.' });
      }
      const accounts = await readData(STORE_CUSTOMER_ACCOUNTS_FILE, []);
      const account = accounts.find(customer => customer.id === current.account.id);
      account.name = name;
      account.phone = phone;
      account.updatedAt = new Date().toISOString();
      await writeData(STORE_CUSTOMER_ACCOUNTS_FILE, accounts);
      return res.json({ customer: publicCustomer(account) });
    });
  } catch (error) {
    console.error('[Store customer auth] Profile update failed:', error.message);
    return res.status(500).json({ error: 'Could not update your profile.' });
  }
});

router.post('/public/customer-auth/addresses', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to manage saved addresses.' });
      const address = normalizeCustomerAddress(req.body);
      const accounts = await readData(STORE_CUSTOMER_ACCOUNTS_FILE, []);
      const account = accounts.find(customer => customer.id === current.account.id);
      if ((account.addresses || []).length >= 20) return res.status(400).json({ error: 'You can save up to 20 addresses.' });
      const addresses = [...(account.addresses || [])].map(item => ({ ...item, isDefault: address.isDefault ? false : item.isDefault }));
      if (address.isDefault || addresses.length === 0) address.isDefault = true;
      addresses.push(address);
      account.addresses = addresses;
      account.updatedAt = new Date().toISOString();
      await writeData(STORE_CUSTOMER_ACCOUNTS_FILE, accounts);
      return res.status(201).json({ customer: publicCustomer(account) });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store customer auth] Address creation failed:', error.message);
    return res.status(500).json({ error: 'Could not save this address.' });
  }
});

router.put('/public/customer-auth/addresses/:id', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to manage saved addresses.' });
      const accounts = await readData(STORE_CUSTOMER_ACCOUNTS_FILE, []);
      const account = accounts.find(customer => customer.id === current.account.id);
      const index = (account.addresses || []).findIndex(address => address.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: 'Address not found.' });
      const address = normalizeCustomerAddress(req.body, req.params.id);
      const addresses = [...account.addresses].map((item, itemIndex) => ({
        ...(itemIndex === index ? address : item),
        isDefault: address.isDefault ? itemIndex === index : item.isDefault
      }));
      if (!addresses.some(item => item.isDefault)) addresses[0].isDefault = true;
      account.addresses = addresses;
      account.updatedAt = new Date().toISOString();
      await writeData(STORE_CUSTOMER_ACCOUNTS_FILE, accounts);
      return res.json({ customer: publicCustomer(account) });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store customer auth] Address update failed:', error.message);
    return res.status(500).json({ error: 'Could not update this address.' });
  }
});

router.delete('/public/customer-auth/addresses/:id', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to manage saved addresses.' });
      const accounts = await readData(STORE_CUSTOMER_ACCOUNTS_FILE, []);
      const account = accounts.find(customer => customer.id === current.account.id);
      const addresses = (account.addresses || []).filter(address => address.id !== req.params.id);
      if (addresses.length === (account.addresses || []).length) return res.status(404).json({ error: 'Address not found.' });
      if (addresses.length && !addresses.some(address => address.isDefault)) addresses[0].isDefault = true;
      account.addresses = addresses;
      account.updatedAt = new Date().toISOString();
      await writeData(STORE_CUSTOMER_ACCOUNTS_FILE, accounts);
      return res.json({ customer: publicCustomer(account) });
    });
  } catch (error) {
    console.error('[Store customer auth] Address deletion failed:', error.message);
    return res.status(500).json({ error: 'Could not delete this address.' });
  }
});

router.post('/public/customer-auth/logout', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const token = req.cookies?.[CUSTOMER_SESSION_COOKIE];
      if (token) {
        const hash = hashCustomerSessionToken(token);
        const sessions = await readData(STORE_CUSTOMER_SESSIONS_FILE, []);
        await writeData(STORE_CUSTOMER_SESSIONS_FILE, sessions.filter(session => session.tokenHash !== hash));
      }
      res.clearCookie(CUSTOMER_SESSION_COOKIE, customerSessionCookieOptions(req, 0));
      return res.json({ success: true });
    });
  } catch (error) {
    console.error('[Store customer auth] Sign-out failed:', error.message);
    return res.status(500).json({ error: 'Could not sign out. Please try again.' });
  }
});

router.patch('/public/customer-auth/orders/:id', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to edit your order.' });
      const sales = await readData(SALES_FILE, []);
      const index = sales.findIndex(order => order.id === req.params.id);
      if (index < 0 || sales[index].customerAccountId !== current.account.id) {
        return res.status(404).json({ error: 'Order not found.' });
      }
      const order = sales[index];
      if (!canEditStoreOrder(order)) {
        return res.status(409).json({ error: 'Order details can only be edited before processing starts.' });
      }
      const allowedKeys = ['customerName', 'customerPhone', 'customerEmail', 'shippingAddress', 'billingAddress'];
      const unexpectedKey = Object.keys(req.body || {}).find(key => !allowedKeys.includes(key));
      if (unexpectedKey) return res.status(400).json({ error: `Order field "${unexpectedKey}" cannot be edited here.` });
      const changedFields = [];
      const updatedAt = new Date().toISOString();
      if (req.body.customerName !== undefined) {
        const value = String(req.body.customerName).trim();
        if (!value || value.length > 120) return res.status(400).json({ error: 'Enter a valid customer name.' });
        if (value !== order.customerName) changedFields.push('customerName');
        order.customerName = value;
      }
      if (req.body.customerPhone !== undefined) {
        const value = String(req.body.customerPhone).trim();
        const normalized = normalizePhone(value);
        if (value.length > 40 || normalized.length < 7 || normalized.length > 15) {
          return res.status(400).json({ error: 'Enter a valid customer phone number.' });
        }
        if (value !== order.customerPhone) changedFields.push('customerPhone');
        order.customerPhone = value;
      }
      if (req.body.customerEmail !== undefined) {
        const value = req.body.customerEmail ? normalizeCustomerEmail(req.body.customerEmail) : '';
        if (value !== order.customerEmail) changedFields.push('customerEmail');
        order.customerEmail = value;
      }
      if (req.body.shippingAddress !== undefined) {
        const address = normalizeStorefrontAddress(req.body.shippingAddress);
        if (address.deliveryAddress !== order.deliveryAddress) changedFields.push('shippingAddress');
        order.deliveryAddress = address.deliveryAddress;
        order.shippingAddress = address;
      }
      if (req.body.billingAddress !== undefined) {
        const address = req.body.billingAddress === null
          ? null
          : normalizeStorefrontAddress(req.body.billingAddress);
        if (JSON.stringify(address) !== JSON.stringify(order.billingAddress || null)) changedFields.push('billingAddress');
        order.billingAddress = address;
      }
      if (!changedFields.length) return res.status(400).json({ error: 'No order details changed.' });
      order.updatedAt = updatedAt;
      order.orderEditHistory = [
        ...(Array.isArray(order.orderEditHistory) ? order.orderEditHistory : []),
        { actorType: 'customer', actorId: current.account.id, changedFields, at: updatedAt }
      ];
      sales[index] = order;
      await writeData(SALES_FILE, sales);
      return res.json({ success: true, order });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store customer orders] Order edit failed:', error.message);
    return res.status(500).json({ error: 'Could not update this order.' });
  }
});

router.post('/public/customer-auth/orders/:id/refunds', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const storeSettings = await readData(STORE_SETTINGS_FILE, {});
      if (storeSettings.refundRequestsEnabled === false) {
        return res.status(403).json({ error: 'This store is not accepting new refund requests.' });
      }
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to request a refund.' });
      const sales = await readData(SALES_FILE, []);
      const index = sales.findIndex(order => order.id === req.params.id);
      if (index < 0 || sales[index].customerAccountId !== current.account.id) {
        return res.status(404).json({ error: 'Order not found.' });
      }
      const order = sales[index];
      if (!['Paid', 'Partially Refunded'].includes(order.paymentStatus)) {
        return res.status(409).json({ error: 'A refund can only be requested for an order recorded as paid.' });
      }
      const refundHistory = Array.isArray(order.refundHistory) ? order.refundHistory : [];
      const amount = normalizeRefundAmount(req.body?.amount, order, refundHistory);
      const reason = String(req.body?.reason || '').trim();
      if (!reason || reason.length > 1000) return res.status(400).json({ error: 'Provide a refund reason of up to 1000 characters.' });
      if (refundHistory.some(refund => refund.status === 'requested' || refund.status === 'approved')) {
        return res.status(409).json({ error: 'A refund request is already awaiting the store decision.' });
      }
      const timestamp = new Date().toISOString();
      const refund = {
        id: randomUUID(),
        amount,
        currency: order.currency || 'USD',
        reason,
        status: 'requested',
        requestedAt: timestamp,
        requestedBy: current.account.id,
        events: [{ action: 'requested', actorType: 'customer', actorId: current.account.id, at: timestamp }]
      };
      order.refundHistory = [...refundHistory, refund];
      order.updatedAt = timestamp;
      sales[index] = order;
      await writeData(SALES_FILE, sales);
      return res.status(201).json({ success: true, refund });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store customer orders] Refund request failed:', error.message);
    return res.status(500).json({ error: 'Could not submit the refund request.' });
  }
});

router.patch('/sales/:id/refunds/:refundId', async (req, res) => {
  const sales = await readData(SALES_FILE, []);
  const orderIndex = sales.findIndex(order => order.id === req.params.id && order.channel === 'storefront');
  if (orderIndex < 0) return res.status(404).json({ error: 'Order not found.' });
  const order = sales[orderIndex];
  const refunds = Array.isArray(order.refundHistory) ? order.refundHistory : [];
  const refund = refunds.find(entry => entry.id === req.params.refundId);
  if (!refund) return res.status(404).json({ error: 'Refund request not found.' });
  const action = String(req.body?.action || '');
  const note = String(req.body?.note || '').trim();
  const reference = String(req.body?.reference || '').trim();
  if (note.length > 1000 || reference.length > 160) {
    return res.status(400).json({ error: 'Note or refund reference exceeds the allowed length.' });
  }
  if (!['approve', 'reject', 'manual-process', 'gateway-process'].includes(action)) {
    return res.status(400).json({ error: 'Choose approve, reject, manual-process, or gateway-process.' });
  }
  if (!['manual-process', 'gateway-process'].includes(action) &&
      !['requested', 'approved'].includes(refund.status)) {
    return res.status(409).json({ error: 'This refund request can no longer be changed.' });
  }
  if (action === 'gateway-process' && refund.status !== 'approved') {
    return res.status(409).json({ error: 'Approve the refund request before starting a gateway refund.' });
  }
  if (action === 'manual-process' && !['approved', 'gateway_unknown'].includes(refund.status)) {
    return res.status(409).json({ error: 'Approve the request, or verify the uncertain gateway refund before recording it manually.' });
  }
  if (['manual-process', 'gateway-process'].includes(action) &&
      !['Paid', 'Partially Refunded'].includes(order.paymentStatus)) {
    return res.status(409).json({ error: 'Only a paid order with a remaining balance can be refunded.' });
  }
  if (action === 'manual-process' && reference.length < 3) {
    return res.status(400).json({ error: 'Enter a bank, cash, or gateway reference before recording a manual refund.' });
  }
  if (['manual-process', 'gateway-process'].includes(action)) {
    try {
      normalizeRefundAmount(
        refund.amount,
        order,
        refunds.filter(entry => entry.id !== refund.id)
      );
    } catch (error) {
      if (error instanceof TypeError) return res.status(409).json({ error: error.message });
      throw error;
    }
  }
  if (action === 'gateway-process') {
    const provider = order.paymentGateway?.provider;
    if (!['bkash', 'stripe', 'paypal'].includes(provider) ||
        !CHECKOUT_READY_PROVIDERS.has(provider) ||
        !order.paymentGateway?.transactionId) {
      return res.status(409).json({
        error: 'Automatic gateway refunds are unavailable for this payment. Use the manual refund workflow.'
      });
    }
    const settings = await readData(STORE_SETTINGS_FILE, {});
    let credentials;
    try {
      credentials = await getProviderCredentials(settings, provider, getActiveTiwiId(req));
    } catch (error) {
      console.error(`[Store refund] Could not load ${provider} credentials:`, error.message);
      return res.status(503).json({ error: 'Could not securely load the gateway credentials.' });
    }
    const timestamp = new Date().toISOString();
    refund.status = 'gateway_processing';
    refund.gatewayProvider = provider;
    refund.gatewayStartedAt = timestamp;
    refund.events = [
      ...(refund.events || []),
      {
        action: 'gateway-refund-started',
        actorType: 'merchant',
        actorId: getReqUserId(req),
        at: timestamp
      }
    ];
    order.refundHistory = refunds;
    order.updatedAt = timestamp;
    sales[orderIndex] = order;
    await writeData(SALES_FILE, sales);

    try {
      const result = await createHostedRefund({
        provider,
        tiwiId: getActiveTiwiId(req),
        credentials,
        mode: order.paymentGateway.mode || settings.paymentProviders?.[provider]?.mode || 'sandbox',
        order,
        refund
      });
      if (Math.abs(Number(result.amount) - Number(refund.amount)) > 0.005 ||
          String(result.currency).toUpperCase() !== String(refund.currency).toUpperCase() ||
          !result.providerRefundId) {
        throw new Error('Gateway refund response did not match the requested refund.');
      }
      refund.providerRefundId = result.providerRefundId;
      refund.gatewayStatus = result.status;
      refund.status = result.status === 'succeeded' ? 'gateway_confirmed' : 'gateway_pending';
      refund.processedAt = result.status === 'succeeded' ? new Date().toISOString() : undefined;
      refund.updatedAt = new Date().toISOString();
      refund.events = [
        ...(refund.events || []),
        {
          action: result.status === 'succeeded' ? 'gateway-refund-confirmed' : 'gateway-refund-pending',
          actorType: 'gateway',
          actorId: provider,
          at: refund.updatedAt,
          reference: result.providerRefundId
        }
      ];
      updateOrderRefundPaymentStatus(order);
      order.refundHistory = refunds;
      order.updatedAt = refund.updatedAt;
      sales[orderIndex] = order;
      if (result.status === 'succeeded') {
        const refundCents = amountToCents(refund.amount);
        if (refundCents === null) return res.status(409).json({ error: 'Confirmed refund amount cannot be recorded safely.' });
        const financeLedger = await readData(FINANCE_LEDGER_FILE, []);
        const nextFinanceLedger = appendFinanceEntry(financeLedger, {
          direction: 'out',
          amountCents: refundCents,
          category: 'Storefront refund',
          description: `Gateway refund for ${order.invoiceNumber}`,
          referenceType: 'refund',
          referenceId: refund.id,
          reference: result.providerRefundId,
          paymentMethod: `Gateway (${provider})`,
          createdAt: refund.processedAt
        });
        await writeTenantData({
          [SALES_FILE]: sales,
          [FINANCE_LEDGER_FILE]: nextFinanceLedger
        }, getActiveTiwiId(req));
      } else {
        await writeData(SALES_FILE, sales);
      }
      await logActivity(
        'sale',
        `Gateway refund ${result.status === 'succeeded' ? 'confirmed' : 'pending'}`,
        `${order.invoiceNumber} • ${refund.currency} ${Number(refund.amount).toFixed(2)} • ${provider}`,
        getActiveTiwiId(req)
      );
      return res.json({ success: true, refund, paymentStatus: order.paymentStatus });
    } catch (error) {
      refund.status = 'gateway_unknown';
      refund.failureReason = 'The gateway response could not be confirmed. Check the provider dashboard before retrying.';
      refund.updatedAt = new Date().toISOString();
      refund.events = [
        ...(refund.events || []),
        {
          action: 'gateway-refund-unconfirmed',
          actorType: 'system',
          at: refund.updatedAt,
          note: refund.failureReason
        }
      ];
      order.refundHistory = refunds;
      order.updatedAt = refund.updatedAt;
      sales[orderIndex] = order;
      await writeData(SALES_FILE, sales);
      console.error(`[Store refund] ${provider} refund response could not be confirmed:`, error.message);
      return res.status(502).json({
        error: 'The refund result is uncertain. Check the gateway dashboard before taking further action.',
        refund,
        paymentStatus: order.paymentStatus
      });
    }
  }
  const timestamp = new Date().toISOString();
  if (action === 'approve') refund.status = 'approved';
  if (action === 'reject') {
    refund.status = 'rejected';
    refund.decisionNote = note;
  }
  if (action === 'manual-process') {
    refund.status = 'manually_processed';
    refund.manualReference = reference;
    refund.processedAt = timestamp;
    updateOrderRefundPaymentStatus(order);
  }
  refund.events = [
    ...(Array.isArray(refund.events) ? refund.events : []),
    {
      action,
      actorType: 'merchant',
      actorId: getReqUserId(req),
      at: timestamp,
      note: note || undefined,
      reference: action === 'manual-process' ? reference : undefined
    }
  ];
  order.refundHistory = refunds;
  order.updatedAt = timestamp;
  sales[orderIndex] = order;
  if (action === 'manual-process') {
    const refundCents = amountToCents(refund.amount);
    if (refundCents === null) return res.status(409).json({ error: 'Refund amount cannot be recorded safely.' });
    const financeLedger = await readData(FINANCE_LEDGER_FILE, []);
    const nextFinanceLedger = appendFinanceEntry(financeLedger, {
      direction: 'out',
      amountCents: refundCents,
      category: 'Storefront refund',
      description: `Manual refund for ${order.invoiceNumber}`,
      referenceType: 'refund',
      referenceId: refund.id,
      reference,
      paymentMethod: 'Manual refund',
      createdAt: timestamp
    });
    await writeTenantData({
      [SALES_FILE]: sales,
      [FINANCE_LEDGER_FILE]: nextFinanceLedger
    }, getActiveTiwiId(req));
  } else {
    await writeData(SALES_FILE, sales);
  }
  await logActivity('sale', `Refund ${refund.status.replaceAll('_', ' ')}`, `${order.invoiceNumber} • ${refund.currency} ${Number(refund.amount).toFixed(2)}`);
  return res.json({ success: true, refund, paymentStatus: order.paymentStatus });
});

router.get('/public/reviews/:productId', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const reviews = await readData(STORE_REVIEWS_FILE, []);
      const approved = reviews
        .filter(review => review.productId === req.params.productId && review.status === 'approved')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 100)
        .map(({ id, productId, customerName, rating, title, body, createdAt, merchantReply }) => ({
          id, productId, customerName, rating, title, body, createdAt, merchantReply
        }));
      return res.json({ reviews: approved });
    });
  } catch (error) {
    console.error('[Store reviews] Public review lookup failed:', error.message);
    return res.status(500).json({ error: 'Could not load product reviews.' });
  }
});

router.post('/public/reviews', customerOtpVerifyLimiter, async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async () => {
      const current = await getStoreCustomer(req);
      if (!current) return res.status(401).json({ error: 'Sign in to review a delivered purchase.' });
      const productId = String(req.body?.productId || '').trim();
      const orderId = String(req.body?.orderId || '').trim();
      if (!productId || productId.length > 100 || !orderId || orderId.length > 100) {
        return res.status(400).json({ error: 'A product and delivered order are required.' });
      }
      const sales = await readData(SALES_FILE, []);
      const order = sales.find(sale => sale.id === orderId);
      if (!canReviewOrder(order, productId, current.account.id)) {
        return res.status(403).json({ error: 'Reviews are available only for products in your delivered orders.' });
      }
      const reviewFields = validateCustomerReview(req.body);
      const reviews = await readData(STORE_REVIEWS_FILE, []);
      if (reviews.some(review => review.orderId === orderId && review.productId === productId)) {
        return res.status(409).json({ error: 'You have already submitted a review for this order item.' });
      }
      const review = {
        id: randomUUID(),
        productId,
        orderId,
        customerId: current.account.id,
        customerName: current.account.name,
        ...reviewFields,
        status: 'pending',
        createdAt: new Date().toISOString(),
        moderationHistory: [{ action: 'submitted', actor: current.account.id, at: new Date().toISOString() }]
      };
      reviews.push(review);
      await writeData(STORE_REVIEWS_FILE, reviews);
      return res.status(201).json({
        success: true,
        review: { id: review.id, rating: review.rating, title: review.title, body: review.body, status: review.status }
      });
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('[Store reviews] Review submission failed:', error.message);
    return res.status(500).json({ error: 'Could not submit this review.' });
  }
});

router.get('/reviews', async (req, res) => {
  const reviews = await readData(STORE_REVIEWS_FILE, []);
  return res.json(reviews.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
});

router.patch('/reviews/:id', async (req, res) => {
  const reviews = await readData(STORE_REVIEWS_FILE, []);
  const index = reviews.findIndex(review => review.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Review not found.' });
  const { status, merchantReply } = req.body || {};
  if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Select pending, approved, or rejected.' });
  }
  if (merchantReply !== undefined &&
      (typeof merchantReply !== 'string' || merchantReply.trim().length > 2000)) {
    return res.status(400).json({ error: 'Merchant reply must be no longer than 2000 characters.' });
  }
  const review = reviews[index];
  const actionAt = new Date().toISOString();
  if (status !== undefined && status !== review.status) {
    review.moderationHistory = [
      ...(Array.isArray(review.moderationHistory) ? review.moderationHistory : []),
      { action: status, actor: getReqUserId(req), at: actionAt }
    ];
    review.status = status;
  }
  if (merchantReply !== undefined) {
    review.merchantReply = merchantReply.trim();
    review.merchantRepliedAt = actionAt;
    review.moderationHistory = [
      ...(Array.isArray(review.moderationHistory) ? review.moderationHistory : []),
      { action: review.merchantReply ? 'replied' : 'reply_removed', actor: getReqUserId(req), at: actionAt }
    ];
  }
  reviews[index] = review;
  await writeData(STORE_REVIEWS_FILE, reviews);
  return res.json(review);
});

router.post('/public/orders/:id/receipt', async (req, res) => {
  try {
    return await runOnStorefrontTenant(req, res, async store => {
      const order = (await readData(SALES_FILE, [], store.tiwiId)).find(sale =>
        sale.id === req.params.id && sale.channel === 'storefront'
      );
      if (!order || !paymentTokenMatches(order, String(req.body?.token || ''))) {
        return res.status(404).json({ error: 'Order receipt not found.' });
      }
      return res.json({ order: paymentOrderReceipt(order) });
    });
  } catch (error) {
    console.error('[Store payment] Could not load payment receipt:', error.message);
    return res.status(500).json({ error: 'Could not load this order receipt.' });
  }
});

router.get('/public/payments/:provider/return', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  if (!CHECKOUT_READY_PROVIDERS.has(provider)) {
    return res.status(404).json({ error: 'Payment provider not found.' });
  }
  return handleStorePaymentReturn(req, res, provider);
});

router.post('/public/payments/:provider/return', async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  if (!['sslcommerz'].includes(provider)) {
    return res.status(404).json({ error: 'Payment provider callback not found.' });
  }
  return handleStorePaymentReturn(req, res, provider);
});

router.post('/public/payments/sslcommerz/ipn', (req, res) =>
  handleStorePaymentReturn(req, res, 'sslcommerz', { ipn: true })
);

router.post('/public/payments/stripe/webhook', (req, res) =>
  handleStorePaymentReturn(req, res, 'stripe', { webhook: true })
);

router.get('/public/orders/track', async (req, res) => {
  try {
    const store = await resolveStorefrontHost(req.hostname);
    if (!store) return res.status(404).json({ error: 'Storefront not found.' });
    const reference = String(req.query?.reference || '').trim();
    const phone = normalizePhone(req.query?.phone);
    if (reference.length < 3 || reference.length > 120 || phone.length < 7 || phone.length > 15) {
      return res.status(400).json({ error: 'Enter a valid order or tracking number and the phone used at checkout.' });
    }

    const order = await tenantContext.run({ tiwiId: store.tiwiId }, async () => {
      const sales = await readData(SALES_FILE, [], store.tiwiId);
      return sales.find(sale => {
        if (sale.channel !== 'storefront' || normalizePhone(sale.customerPhone) !== phone) return false;
        return String(sale.invoiceNumber || '').toLowerCase() === reference.toLowerCase() ||
          String(sale.trackingNumber || '').toLowerCase() === reference.toLowerCase();
      });
    });
    if (!order) return res.status(404).json({ error: 'No matching order was found. Check the number and checkout phone.' });

    return res.json({
      orderNumber: order.invoiceNumber,
      status: order.status,
      paymentStatus: order.paymentStatus || 'Pending',
      courierService: order.courierService || '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl && !validateOrderUpdate({ trackingUrl: order.trackingUrl }) ? order.trackingUrl : '',
      date: order.date,
      updatedAt: order.updatedAt || order.date,
      statusHistory: Array.isArray(order.statusHistory)
        ? order.statusHistory.map(({ status, at }) => ({ status, at }))
        : [{ status: order.status, at: order.date }]
    });
  } catch (error) {
    console.error('Failed to track public order:', error);
    return res.status(500).json({ error: 'Could not look up this order.' });
  }
});

router.get('/store/payment-providers', async (req, res) => {
  try {
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const providers = Object.entries(PAYMENT_PROVIDER_DEFINITIONS).map(([provider, definition]) => ({
      ...toPublicPaymentProvider(
        provider,
        settings.paymentProviders?.[provider],
        settings.paymentProviderCredentials?.[provider]
      ),
      credentialFields: definition.credentialFields
    }));
    return res.json({ providers });
  } catch (error) {
    console.error('Could not load store payment provider settings:', error);
    return res.status(500).json({ error: 'Could not load payment provider settings.' });
  }
});

router.get('/store/currency', async (req, res) => {
  try {
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const exchange = settings.currencyExchange || {};
    const mode = exchange.mode === 'api' ? 'api' : 'manual';
    const allRates = normalizeUsdRates(exchange.rates || { USD: 1 });
    const apiRates = mode === 'api'
      ? getFreshUsdRates({
        rates: allRates,
        rateDates: exchange.rateDates,
        observedAt: exchange.observedAt
      })
      : null;
    const rates = mode === 'api' ? apiRates?.rates || { USD: 1 } : allRates;
    return res.json({
      mode,
      rates,
      observedAt: exchange.observedAt || null,
      updatedAt: exchange.updatedAt || null,
      source: mode === 'api' ? exchange.source || 'Frankfurter' : 'Manual merchant rates',
      fresh: mode === 'manual' ? Object.keys(rates).length > 1 : Boolean(apiRates),
      storeCurrency: getStoreCurrencySettings(
        req.activeStore?.currency || settings.currency || req.activeUser?.currency || 'USD'
      ).currency
    });
  } catch (error) {
    console.error('Could not load store currency settings:', error);
    return res.status(500).json({ error: 'Could not load currency settings.' });
  }
});

router.put('/store/currency', async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Currency settings must be provided as an object.' });
  }
  if (req.body.mode !== 'manual') {
    return res.status(400).json({ error: 'Select manual rates here; use the market-rate refresh action for API rates.' });
  }
  try {
    const rates = normalizeUsdRates(req.body.rates);
    if (Object.keys(rates).length < 2) {
      return res.status(400).json({ error: 'Add at least one non-USD conversion rate.' });
    }
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const now = new Date().toISOString();
    settings.currencyExchange = {
      mode: 'manual',
      rates,
      observedAt: now.slice(0, 10),
      updatedAt: now,
      source: 'Manual merchant rates'
    };
    await writeData(STORE_SETTINGS_FILE, settings);
    return res.json({
      mode: 'manual',
      rates,
      observedAt: settings.currencyExchange.observedAt,
      updatedAt: now,
      source: settings.currencyExchange.source,
      fresh: true
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('Could not save manual store currency rates:', error);
    return res.status(500).json({ error: 'Could not save manual currency rates.' });
  }
});

router.post('/store/currency/rates/refresh', async (req, res) => {
  try {
    const marketRates = await getMarketUsdRates();
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const now = new Date().toISOString();
    settings.currencyExchange = {
      mode: 'api',
      rates: marketRates.rates,
      rateDates: marketRates.rateDates,
      observedAt: marketRates.observedAt,
      updatedAt: now,
      source: marketRates.source
    };
    await writeData(STORE_SETTINGS_FILE, settings);
    return res.json({
      mode: 'api',
      rates: marketRates.rates,
      observedAt: marketRates.observedAt,
      updatedAt: now,
      source: marketRates.source,
      fresh: true
    });
  } catch (error) {
    console.error('Could not refresh market currency rates:', error);
    return res.status(502).json({
      error: 'Could not refresh market rates. Existing rates were not changed.',
      details: error.name === 'AbortError' ? 'The rate source timed out.' : error.message
    });
  }
});

router.post('/store/currency/preview', async (req, res) => {
  try {
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const exchange = settings.currencyExchange || {};
    const mode = exchange.mode === 'api' ? 'api' : 'manual';
    let rates;
    if (mode === 'api') {
      const freshRates = getFreshUsdRates(exchange);
      if (!freshRates) {
        return res.status(409).json({ error: 'Market rates are missing or stale. Refresh them before converting an amount.' });
      }
      rates = freshRates.rates;
    } else {
      rates = normalizeUsdRates(exchange.rates || { USD: 1 });
    }
    const storeCurrency = getStoreCurrencySettings(
      req.activeStore?.currency || settings.currency || req.activeUser?.currency || 'USD'
    ).currency;
    const fromCurrency = normalizeCurrencyCode(req.body?.fromCurrency) ||
      String(storeCurrency).match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';
    const conversion = convertCurrencyAmount(
      req.body?.amount,
      fromCurrency,
      req.body?.toCurrency,
      rates
    );
    return res.json({
      ...conversion,
      source: exchange.source || (mode === 'manual' ? 'Manual merchant rates' : 'Frankfurter'),
      observedAt: exchange.observedAt || null,
      gatewayCheckoutReady: false
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('Could not convert store currency amount:', error);
    return res.status(500).json({ error: 'Could not convert this amount.' });
  }
});

router.put('/store/payment-providers/:provider', requireRecentReauth, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const definition = PAYMENT_PROVIDER_DEFINITIONS[provider];
  if (!definition) return res.status(404).json({ error: 'Unsupported payment provider.' });
  try {
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const storedCredentials = settings.paymentProviderCredentials?.[provider];
    const currentCredentials = storedCredentials
      ? decryptPaymentCredentials(getActiveTiwiId(req), provider, {
        ciphertext: Buffer.from(storedCredentials.ciphertext, 'base64'),
        iv: Buffer.from(storedCredentials.iv, 'base64'),
        authTag: Buffer.from(storedCredentials.authTag, 'base64')
      })
      : {};
    const normalized = normalizePaymentProviderConfiguration(provider, req.body || {}, {
      ...(settings.paymentProviders?.[provider] || {}),
      credentials: currentCredentials
    });
    const encrypted = Object.keys(normalized.credentials).length
      ? encryptPaymentCredentials(getActiveTiwiId(req), provider, normalized.credentials)
      : null;
    settings.paymentProviders ||= {};
    settings.paymentProviders[provider] = normalized.config;
    settings.paymentProviderCredentials ||= {};
    if (encrypted) {
      settings.paymentProviderCredentials[provider] = {
        ciphertext: encrypted.ciphertext.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64')
      };
    }
    await writeData(STORE_SETTINGS_FILE, settings);
    const safeProvider = {
      ...toPublicPaymentProvider(provider, normalized.config, encrypted || storedCredentials),
      credentialFields: definition.credentialFields
    };
    return res.json({ provider: safeProvider });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error(`Could not save ${provider} merchant configuration:`, error);
    return res.status(500).json({ error: 'Could not save this payment provider configuration.' });
  }
});

router.post('/public/coupons/validate', async (req, res) => {
  try {
    const store = await resolveStorefrontHost(req.hostname);
    if (!store) return res.status(404).json({ error: 'Storefront not found.' });
    const subtotal = Number(req.body?.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return res.status(400).json({ error: 'Enter a valid order subtotal.' });
    }
    const settings = await readData(STORE_SETTINGS_FILE, {}, store.tiwiId);
    const sales = await readData(SALES_FILE, [], store.tiwiId);
    const customer = {
      email: req.body?.email,
      phone: req.body?.phone
    };
    const usage = getPromotionUsage(sales, req.body?.code, customer);
    const promotion = calculatePromotionDiscount(settings, req.body?.code, subtotal, {
      countryCode: req.body?.countryCode,
      totalRedemptions: usage.total,
      customerRedemptions: usage.customer
    });
    if (!promotion.valid) {
      return res.status(400).json({ error: promotion.error });
    }
    return res.json(promotion);
  } catch (error) {
    console.error('Failed to validate promotion code:', error);
    return res.status(500).json({ error: 'Could not validate this promotion code.' });
  }
});

router.get('/public/shipping/countries', (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.json({
      countries: getShippingCountries(),
      attribution: 'Country names: i18n-iso-countries, ISO 3166.'
    });
  } catch (error) {
    console.error('Failed to load shipping country list:', error);
    return res.status(500).json({ error: 'Could not load the country list.' });
  }
});

router.get('/public/shipping/cities', (req, res) => {
  try {
    const countryCode = String(req.query?.countryCode || '').trim().toUpperCase();
    const cities = searchShippingCities(countryCode, req.query?.q);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.json({
      countryCode,
      cities,
      attribution: 'City data: GeoNames Gazetteer, CC BY 4.0.'
    });
  } catch (error) {
    console.error('Failed to search shipping cities:', error);
    return res.status(500).json({ error: 'Could not search cities.' });
  }
});

router.post('/public/shipping/quote', async (req, res) => {
  try {
    const store = await resolveStorefrontHost(req.hostname);
    if (!store) return res.status(404).json({ error: 'Storefront not found.' });
    const subtotal = Number(req.body?.subtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return res.status(400).json({ error: 'Enter a valid order subtotal.' });
    }
    const settings = await readData(STORE_SETTINGS_FILE, {}, store.tiwiId);
    const products = await readData(PRODUCTS_FILE, [], store.tiwiId);
    const requestedItems = req.body?.items;
    if (requestedItems !== undefined && (!Array.isArray(requestedItems) || requestedItems.length > 100)) {
      return res.status(400).json({ error: 'Shipping quote items must be a list of no more than 100 products.' });
    }
    let weightKg = 0;
    let weightComplete = Array.isArray(requestedItems) && requestedItems.length > 0;
    for (const item of requestedItems || []) {
      const quantity = Number(item?.quantity);
      const product = products.find(entry => entry.id === item?.productId);
      if (!product || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Shipping quote contains an invalid product or quantity.' });
      }
      const itemWeight = product.shippingWeightKg;
      if (itemWeight === null || itemWeight === undefined || itemWeight === '' ||
          !Number.isFinite(Number(itemWeight)) || Number(itemWeight) < 0) {
        weightComplete = false;
      } else {
        weightKg += Number(itemWeight) * quantity;
      }
    }
    const quote = quoteShipping(settings, req.body?.country, subtotal, {
      countryCode: req.body?.countryCode,
      city: req.body?.city,
      weightKg,
      weightComplete
    });
    if (!quote.available) {
      return res.status(422).json({ error: quote.error || 'This store does not ship to the selected destination.' });
    }
    return res.json({ ...quote, currency: settings.currency || 'USD' });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    console.error('Failed to calculate storefront shipping:', error);
    return res.status(500).json({ error: 'Could not calculate shipping for this order.' });
  }
});

// ==========================================
// MULTI-STORE DIRECTORY ("YOUR STORE")
// ==========================================
router.post('/stores/active', async (req, res) => {
  const userId = getReqUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const selectedTiwiId = String(req.body?.tiwiId || '').trim();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000
  };
  if (!selectedTiwiId) {
    res.clearCookie('tiwlo_active_store', {
      httpOnly: true,
      sameSite: 'lax',
      secure: cookieOptions.secure,
      path: '/'
    });
    return res.json({ success: true, store: null });
  }

  const store = await resolveActiveStore(req, selectedTiwiId);
  if (!store) return res.status(403).json({ error: 'You do not have access to that store.' });
  res.cookie('tiwlo_active_store', store.tiwiId, cookieOptions);
  return res.json({ success: true, store });
});

router.get('/stores', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const stores = await MasterDB.getUserStores(userId);
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

router.get('/stores/subdomain-availability', async (req, res) => {
  try {
    if (!getReqUserId(req)) return res.status(401).json({ error: 'Unauthorized' });
    const result = await MasterDB.getStoreSubdomainAvailability(req.query.subdomain);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Unable to check subdomain availability.' });
  }
});

router.patch('/stores/:tiwiId/status', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const status = String(req.body?.status || '').toLowerCase();
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Store status must be active or suspended.' });
    }
    const store = await MasterDB.setStoreStatusForUser(userId, req.params.tiwiId, status);
    if (!store) return res.status(404).json({ error: 'Store not found.' });
    res.json({ success: true, store });
  } catch (err) {
    console.error('Error updating store status:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to update store status.' });
  }
});

router.delete('/stores/:tiwiId', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Explicit confirmation is required to permanently delete a store.' });
    }
    const deleted = await MasterDB.deleteStoreForUser(userId, req.params.tiwiId);
    if (!deleted) return res.status(404).json({ error: 'Store not found.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error permanently deleting store:', err);
    res.status(500).json({ error: 'Failed to permanently delete store.' });
  }
});

router.post('/stores', async (req, res) => {
  try {
    const { storeName, subdomain, planId, category, currency, email, phone, description, billingDetails } = req.body;
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!storeName || !storeName.trim()) {
      return res.status(400).json({ error: 'Store name is required' });
    }
    const store = await MasterDB.createStoreForUser({
      userId,
      storeName,
      subdomain,
      planId: planId || 'free',
      category,
      currency,
      email,
      phone,
      description,
      billingDetails
    });
    res.json(store);
  } catch (err) {
    console.error('Error creating store:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Failed to create store' });
  }
});

// ==========================================
// PRODUCTS CRUD
// ==========================================
router.get('/products', async (req, res) => {
  let products = (await readData(PRODUCTS_FILE, []));
  const { category, subCategory, status, search, sortBy } = req.query;

  if (category && category !== 'All Categories') {
    products = products.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
  }

  if (subCategory && subCategory !== 'All Subcategories') {
    products = products.filter(p => (p.subCategory || '').toLowerCase() === subCategory.toLowerCase());
  }

  if (status && status !== 'All Status') {
    products = products.filter(p => getStockStatus(p).toLowerCase() === status.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.subCategory || '').toLowerCase().includes(q)
    );
  }

  if (sortBy) {
    if (sortBy === 'name') products.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'stock-asc') products.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    else if (sortBy === 'stock-desc') products.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    else if (sortBy === 'price-asc') products.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sortBy === 'price-desc') products.sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  res.json(products);
});

router.get('/products/:id', async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/products', contentSafetyMiddleware('public_product'), async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  const purchases = (await readData(PURCHASES_FILE, []));
  const tiwiId = getActiveTiwiId(req);
  const {
    name,
    sku,
    barcode,
    category,
    subCategory,
    stock,
    minStock,
    price,
    costPrice,
    status,
    location,
    supplierId,
    supplierName,
    stockSource,
    initialPaidAmount,
    image,
    images,
    description,
    brand,
    unit,
    shippingWeightKg
  } = req.body;

  const candidateImages = [image, ...(Array.isArray(images) ? images : [])].filter(Boolean);
  for (const imgUrl of candidateImages) {
    const scopeCheck = await checkAssetScope(imgUrl, 'public_catalog');
    if (!scopeCheck.allowed) {
      return res.status(403).json({
        error: 'SECURITY_SCOPE_VIOLATION',
        message: scopeCheck.reason
      });
    }
  }

  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const normalizedSku = typeof sku === 'string' ? sku.trim() : '';
  const normalizedBarcode = typeof barcode === 'string' ? barcode.trim() : '';
  if (barcode !== undefined && typeof barcode !== 'string') {
    return res.status(400).json({ error: 'Barcode must be text.' });
  }
  if (!normalizedName || !normalizedSku) {
    return res.status(400).json({ error: 'Name and SKU are required' });
  }
  if (normalizedName.length > 180 || normalizedSku.length > 80 || normalizedBarcode.length > 100) {
    return res.status(400).json({ error: 'Product name, SKU, or barcode is longer than the allowed limit.' });
  }
  const selectedSupplier = supplierId
    ? suppliers.find(supplier => supplier.id === supplierId && supplier.status !== 'Inactive')
    : null;
  if (supplierId && !selectedSupplier) {
    return res.status(400).json({ error: 'Select an active supplier or add one before saving this product.' });
  }
  if (supplierName && !selectedSupplier) {
    return res.status(400).json({ error: 'Supplier names must reference an existing supplier record. Select or add the supplier first.' });
  }
  const existingSku = products.find(p => String(p?.sku || '').trim().toLowerCase() === normalizedSku.toLowerCase());
  if (existingSku) {
    return res.status(400).json({ error: 'A product with this SKU already exists' });
  }
  if (normalizedBarcode && products.some(p => String(p?.barcode || '').trim().toLowerCase() === normalizedBarcode.toLowerCase())) {
    return res.status(400).json({ error: 'A product with this barcode already exists' });
  }

  const { valid: stockIsValid, stock: stockVal } = validateStock(stock, 0);
  if (!stockIsValid) {
    return res.status(400).json({ error: 'Stock must be a valid non-negative whole number.' });
  }
  if (stockVal > 0 && !['own', 'supplier'].includes(stockSource)) {
    return res.status(400).json({ error: 'Choose whether opening stock is already owned or comes from a supplier.' });
  }
  if (stockSource === 'supplier' && !selectedSupplier) {
    return res.status(400).json({ error: 'Select an active supplier for supplier-sourced opening stock.' });
  }
  if (stockSource === 'own' && selectedSupplier) {
    return res.status(400).json({ error: 'Choose either an existing supplier or own stock as the opening stock source, not both.' });
  }
  const minStockVal = minStock === undefined ? 20 : getMinStock({ minStock });
  const autoStatus = getStockStatus({ stock: stockVal, minStock: minStockVal });
  const { valid: priceIsValid, price: parsedPrice } = validateSellingPrice(price);
  if (!priceIsValid) {
    return res.status(400).json({ error: 'Selling price must be a valid non-negative amount' });
  }
  const costCents = amountToCents(costPrice ?? 0);
  const paidCents = amountToCents(initialPaidAmount || 0);
  const openingCostCents = costCents === null ? null : stockVal * costCents;
  if (costCents === null || paidCents === null || !Number.isSafeInteger(openingCostCents)) {
    return res.status(400).json({ error: 'Cost price and opening stock value must be valid safe amounts.' });
  }
  const parsedCostPrice = costCents / 100;
  if (paidCents < 0 || paidCents > openingCostCents) {
    return res.status(400).json({ error: 'Amount paid cannot exceed the opening stock purchase total.' });
  }
  if (paidCents > 0 && !selectedSupplier) {
    return res.status(400).json({ error: 'Select a supplier before recording a payment for opening stock.' });
  }
  if (selectedSupplier && stockVal > 0 && parsedCostPrice <= 0) {
    return res.status(400).json({ error: 'Enter a cost price greater than zero to create the opening supplier invoice.' });
  }
  let openingPayment = null;
  let openingPaymentLedger = null;
  if (paidCents > 0) {
    const method = String(req.body.initialPaymentMethod || 'Cash').trim().slice(0, 40);
    const reference = String(req.body.initialPaymentReference || '').trim().slice(0, 120);
    if (!/^cash$/i.test(method) && !reference) {
      return res.status(400).json({ error: 'Enter the transaction reference for a non-cash opening stock payment.' });
    }
    const paymentId = `spp-${randomUUID()}`;
    const ledger = await readData(FINANCE_LEDGER_FILE, [], tiwiId);
    const financeSettings = await readData(FINANCE_SETTINGS_FILE, {}, tiwiId);
    const expense = addCashbookExpense(ledger, financeSettings, {
      amountCents: paidCents,
      description: `Opening stock payment for ${name} to ${selectedSupplier.companyName}`,
      category: 'Supplier purchase payment',
      referenceType: 'supplier_payment',
      referenceId: paymentId,
      paymentMethod: method,
      reference
    });
    if (expense.error) return res.status(409).json({ error: expense.error });
    openingPaymentLedger = expense.ledger;
    openingPayment = {
      id: paymentId,
      amount: paidCents / 100,
      method,
      reference,
      note: 'Payment recorded during product opening stock setup',
      createdAt: expense.createdAt
    };
  }
  const parsedShippingWeightKg = shippingWeightKg === '' || shippingWeightKg == null
    ? null
    : Number(shippingWeightKg);
  if (parsedShippingWeightKg !== null &&
      (!Number.isFinite(parsedShippingWeightKg) || parsedShippingWeightKg < 0 || parsedShippingWeightKg > 100000)) {
    return res.status(400).json({ error: 'Shipping weight must be between 0 and 100,000 kg.' });
  }

  const newProduct = {
    id: `prod-${randomUUID()}`,
    name: normalizedName,
    sku: normalizedSku,
    barcode: normalizedBarcode || `BC-${randomUUID().slice(0, 12).toUpperCase()}`,
    category: category || '',
    subCategory: subCategory || '',
    stock: stockVal,
    minStock: minStockVal,
    price: parsedPrice,
    costPrice: parsedCostPrice,
    status: autoStatus,
    location: location || 'Main Warehouse',
    supplierId: selectedSupplier?.id || '',
    supplierName: selectedSupplier?.companyName || supplierName || '',
    stockSource: stockSource || (selectedSupplier ? 'supplier' : 'own'),
    image: image || (Array.isArray(images) && images[0]) || '',
    images: Array.isArray(images) && images.length ? images : (image ? [image] : []),
    description: description || '',
    brand: brand || '',
    unit: unit || 'Pcs',
    shippingWeightKg: parsedShippingWeightKg,
    sold: 0,
    revenue: 0,
    growth: '+0%',
    createdAt: new Date().toISOString()
  };

  products.unshift(newProduct);
  let initialPurchase = null;
  if (selectedSupplier && stockVal > 0) {
    const now = new Date().toISOString();
    const poNumber = `PO-${now.slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    initialPurchase = {
      id: `po-${randomUUID()}`,
      poNumber,
      supplierId: selectedSupplier.id,
      supplierName: selectedSupplier.companyName,
      date: now,
      receivedAt: now,
      status: 'Received',
      paymentStatus: paidCents >= openingCostCents ? 'Paid' : paidCents > 0 ? 'Partial' : 'Unpaid',
      payments: openingPayment ? [openingPayment] : [],
      items: [{
        productId: newProduct.id,
        productName: newProduct.name,
        sku: newProduct.sku,
        quantity: stockVal,
        unitCost: costCents / 100,
        total: openingCostCents / 100
      }],
      totalAmount: openingCostCents / 100,
      paidAmount: paidCents / 100,
      dueAmount: (openingCostCents - paidCents) / 100,
      expectedDelivery: now,
      notes: 'Opening stock received during product setup'
    };
    purchases.unshift(initialPurchase);
    await writeTenantData({
      products,
      purchases,
      ...(openingPaymentLedger ? { [FINANCE_LEDGER_FILE]: openingPaymentLedger } : {})
    }, tiwiId);
    await logActivity('purchase', 'Opening stock received', `${poNumber} • ${initialPurchase.totalAmount.toFixed(2)} (${selectedSupplier.companyName})`);
  } else {
    await writeTenantData({
      [PRODUCTS_FILE]: products,
      ...(openingPaymentLedger ? { [FINANCE_LEDGER_FILE]: openingPaymentLedger } : {})
    }, tiwiId);
  }

  (await logActivity('product', 'New product added', `${name} (${sku}) - Stock: ${stockVal}`));
  res.status(201).json({ ...newProduct, initialPurchase: initialPurchase ? {
    poNumber: initialPurchase.poNumber,
    totalAmount: initialPurchase.totalAmount,
    paidAmount: initialPurchase.paidAmount,
    dueAmount: initialPurchase.dueAmount
  } : undefined });
});

router.put('/products/:id', contentSafetyMiddleware('public_product'), async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const { id } = req.params;
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const existing = products[index];
  const previousStock = Number(existing.stock) || 0;
  const {
    name,
    sku,
    barcode,
    category,
    subCategory,
    stock,
    minStock,
    price,
    costPrice,
    status,
    location,
    supplierId,
    supplierName,
    image,
    images,
    description,
    brand,
    unit,
    shippingWeightKg
  } = req.body;

  const candidateImages = [
    image !== undefined ? image : existing.image,
    ...(Array.isArray(images) ? images : Array.isArray(existing.images) ? existing.images : [])
  ].filter(Boolean);
  for (const imageUrl of candidateImages) {
    const scopeCheck = await checkAssetScope(imageUrl, 'public_catalog');
    if (!scopeCheck.allowed) {
      return res.status(403).json({
        error: 'SECURITY_SCOPE_VIOLATION',
        message: scopeCheck.reason
      });
    }
  }

  const normalizedSku = sku === undefined ? String(existing.sku || '').trim() : typeof sku === 'string' ? sku.trim() : '';
  const normalizedBarcode = barcode === undefined ? String(existing.barcode || '').trim() : typeof barcode === 'string' ? barcode.trim() : '';
  const normalizedName = name === undefined ? String(existing.name || '').trim() : typeof name === 'string' ? name.trim() : '';
  if (barcode !== undefined && typeof barcode !== 'string') {
    return res.status(400).json({ error: 'Barcode must be text.' });
  }
  if (!normalizedName || !normalizedSku || normalizedName.length > 180 || normalizedSku.length > 80 || normalizedBarcode.length > 100) {
    return res.status(400).json({ error: 'Product name, SKU, or barcode is invalid or longer than the allowed limit.' });
  }
  if (normalizedSku.toLowerCase() !== String(existing.sku || '').trim().toLowerCase()) {
    const existingSku = products.find(p => String(p?.sku || '').trim().toLowerCase() === normalizedSku.toLowerCase() && p.id !== id);
    if (existingSku) {
      return res.status(400).json({ error: 'A product with this SKU already exists' });
    }
  }
  if (normalizedBarcode.toLowerCase() !== String(existing.barcode || '').trim().toLowerCase() &&
      normalizedBarcode && products.some(p => p.id !== id && String(p?.barcode || '').trim().toLowerCase() === normalizedBarcode.toLowerCase())) {
    return res.status(400).json({ error: 'A product with this barcode already exists' });
  }

  const { valid: stockIsValid, stock: stockVal } = validateStock(stock, existing.stock);
  if (!stockIsValid) {
    return res.status(400).json({ error: 'Stock must be a valid non-negative whole number.' });
  }
  const minStockVal = minStock !== undefined ? getMinStock({ minStock }) : getMinStock(existing);
  const autoStatus = getStockStatus({ stock: stockVal, minStock: minStockVal });
  const { valid: priceIsValid, price: validatedPrice } = validateSellingPrice(price);
  if (price !== undefined && !priceIsValid) {
    return res.status(400).json({ error: 'Selling price must be a valid non-negative amount' });
  }
  const parsedPrice = price !== undefined ? validatedPrice : existing.price;
  const parsedCostCents = costPrice === undefined
    ? amountToCents(existing.costPrice ?? 0)
    : amountToCents(costPrice);
  if (parsedCostCents === null) {
    return res.status(400).json({ error: 'Cost price must be a valid non-negative amount.' });
  }
  const parsedShippingWeightKg = shippingWeightKg === undefined
    ? existing.shippingWeightKg ?? null
    : shippingWeightKg === '' || shippingWeightKg === null
      ? null
      : Number(shippingWeightKg);
  if (parsedShippingWeightKg !== null &&
      (!Number.isFinite(parsedShippingWeightKg) || parsedShippingWeightKg < 0 || parsedShippingWeightKg > 100000)) {
    return res.status(400).json({ error: 'Shipping weight must be between 0 and 100,000 kg.' });
  }

  const updatedProduct = {
    ...existing,
    name: normalizedName,
    sku: normalizedSku,
    barcode: normalizedBarcode,
    category: category !== undefined ? category : existing.category,
    subCategory: subCategory !== undefined ? subCategory : existing.subCategory,
    stock: stockVal,
    minStock: minStockVal,
    price: parsedPrice,
    costPrice: parsedCostCents / 100,
    status: autoStatus,
    location: location !== undefined ? location : existing.location,
    supplierId: supplierId !== undefined ? supplierId : existing.supplierId,
    supplierName: supplierName !== undefined ? supplierName : existing.supplierName,
    image: image !== undefined ? image : existing.image,
    images: images !== undefined ? images : existing.images,
    description: description !== undefined ? description : existing.description,
    brand: brand !== undefined ? brand : existing.brand,
    unit: unit !== undefined ? unit : existing.unit,
    shippingWeightKg: parsedShippingWeightKg,
    updatedAt: new Date().toISOString()
  };

  products[index] = updatedProduct;
  (await writeData(PRODUCTS_FILE, products));

  if (stock !== undefined && Number(stockVal) !== previousStock) {
    const adjustments = await readData('inventory_adjustments', []);
    adjustments.unshift(createStockAdjustment(updatedProduct, previousStock, Number(stockVal)));
    await writeData('inventory_adjustments', adjustments.slice(0, 100));
  }

  (await logActivity('product', 'Product updated', `${updatedProduct.name} (${updatedProduct.sku})`));
  res.json(updatedProduct);
});

router.delete('/products/:id', async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const { id } = req.params;
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const [deletedProduct] = products.splice(index, 1);
  (await writeData(PRODUCTS_FILE, products));

  (await logActivity('alert', 'Product deleted', `${deletedProduct.name} (${deletedProduct.sku})`));
  res.json({ message: 'Product deleted successfully', product: deletedProduct });
});

// ==========================================
// CATEGORIES & SUBCATEGORIES
// ==========================================
router.get('/categories', async (req, res) => {
  const categories = (await readData(CATEGORIES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const enriched = categories.map(cat => ({ ...cat, ...getCategoryMetrics(cat, products) }));

  res.json(enriched);
});

router.post('/categories', async (req, res) => {
  const categories = (await readData(CATEGORIES_FILE, []));
  const { name, description, icon, color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const existing = categories.find(c => (c.name || '').toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Category with this name already exists' });
  }

  const newCategory = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: description || '',
    icon: icon || 'Package',
    color: color || '#3B82F6',
    itemCount: 0,
    createdAt: new Date().toISOString()
  };

  categories.push(newCategory);
  (await writeData(CATEGORIES_FILE, categories));

  (await logActivity('category', 'New category created', newCategory.name));
  res.status(201).json(newCategory);
});

router.put('/categories/:id', async (req, res) => {
  const categories = (await readData(CATEGORIES_FILE, []));
  const { id } = req.params;
  const index = categories.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Category not found' });

  const existing = categories[index];
  const { name, description, icon, color } = req.body;
  const normalizedName = name !== undefined ? name.trim() : existing.name;
  if (!normalizedName) return res.status(400).json({ error: 'Category name is required' });
  const duplicate = categories.find(category =>
    category.id !== id && (category.name || '').toLowerCase() === normalizedName.toLowerCase()
  );
  if (duplicate) return res.status(400).json({ error: 'Category with this name already exists' });

  const updated = {
    ...existing,
    name: normalizedName,
    slug: name !== undefined ? normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : existing.slug,
    description: description !== undefined ? description : existing.description,
    icon: icon !== undefined ? icon : existing.icon,
    color: color !== undefined ? color : existing.color,
    updatedAt: new Date().toISOString()
  };
  categories[index] = updated;
  if (updated.name !== existing.name) {
    const products = await readData(PRODUCTS_FILE, []);
    const subcategories = await readData(SUBCATEGORIES_FILE, []);
    const references = renameCategoryReferences(products, subcategories, existing.name, updated.name);
    await writeData(PRODUCTS_FILE, references.products);
    await writeData(SUBCATEGORIES_FILE, references.subcategories);
  }
  (await writeData(CATEGORIES_FILE, categories));

  (await logActivity('category', 'Category updated', updated.name));
  res.json(updated);
});

router.delete('/categories/:id', async (req, res) => {
  const categories = (await readData(CATEGORIES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const subcategories = (await readData(SUBCATEGORIES_FILE, []));
  const { id } = req.params;
  const index = categories.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Category not found' });

  const [deleted] = categories.splice(index, 1);
  const references = deleteCategoryReferences(products, subcategories, deleted);
  await writeData(PRODUCTS_FILE, references.products);
  await writeData(SUBCATEGORIES_FILE, references.subcategories);
  (await writeData(CATEGORIES_FILE, categories));

  (await logActivity('alert', 'Category deleted', deleted.name));
  res.json({ message: 'Category deleted successfully', category: deleted });
});

router.get('/subcategories', async (req, res) => {
  let subcategories = (await readData(SUBCATEGORIES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const { categoryId, categoryName } = req.query;

  if (categoryId) {
    subcategories = subcategories.filter(s => s.categoryId === categoryId);
  }
  if (categoryName) {
    subcategories = subcategories.filter(s => (s.categoryName || '').toLowerCase() === categoryName.toLowerCase());
  }

  const enriched = subcategories.map(sub => {
    const prods = products.filter(p =>
      (p.subCategory || '').toLowerCase() === sub.name.toLowerCase() &&
      (p.category || '').toLowerCase() === (sub.categoryName || '').toLowerCase()
    );
    return {
      ...sub,
      productCount: prods.length
    };
  });

  res.json(enriched);
});

router.post('/subcategories', async (req, res) => {
  const subcategories = (await readData(SUBCATEGORIES_FILE, []));
  const categories = (await readData(CATEGORIES_FILE, []));
  const { categoryId, categoryName, name, description } = req.body;

  if ((!categoryId && !categoryName) || !name) {
    return res.status(400).json({ error: 'Parent Category and Subcategory Name are required' });
  }

  const parentCat = categories.find(c => c.id === categoryId || (categoryName && c.name.toLowerCase() === categoryName.toLowerCase()));
  const parentName = parentCat ? parentCat.name : (categoryName || 'General');
  const finalCatId = parentCat ? parentCat.id : (categoryId || `cat-${Date.now()}`);

  const newSub = {
    id: `sub-${Date.now()}`,
    categoryId: finalCatId,
    categoryName: parentName,
    name: name.trim(),
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: description || '',
    createdAt: new Date().toISOString()
  };

  subcategories.push(newSub);
  (await writeData(SUBCATEGORIES_FILE, subcategories));

  (await logActivity('category', 'New subcategory created', `${newSub.name} (in ${parentName})`));
  res.status(201).json(newSub);
});

router.put('/subcategories/:id', async (req, res) => {
  const subcategories = (await readData(SUBCATEGORIES_FILE, []));
  const categories = (await readData(CATEGORIES_FILE, []));
  const { id } = req.params;
  const index = subcategories.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Subcategory not found' });

  const existing = subcategories[index];
  const { categoryId, name, description } = req.body;

  let parentName = existing.categoryName;
  if (categoryId && categoryId !== existing.categoryId) {
    const parentCat = categories.find(c => c.id === categoryId);
    if (parentCat) parentName = parentCat.name;
  }

  const updated = {
    ...existing,
    categoryId: categoryId || existing.categoryId,
    categoryName: parentName,
    name: name !== undefined ? name.trim() : existing.name,
    slug: name !== undefined ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : existing.slug,
    description: description !== undefined ? description : existing.description,
    updatedAt: new Date().toISOString()
  };

  subcategories[index] = updated;
  if (updated.name !== existing.name) {
    const products = await readData(PRODUCTS_FILE, []);
    await writeData(
      PRODUCTS_FILE,
      renameSubcategoryReferences(products, existing.name, updated.name, existing.categoryName)
    );
  }
  (await writeData(SUBCATEGORIES_FILE, subcategories));

  (await logActivity('category', 'Subcategory updated', updated.name));
  res.json(updated);
});

router.delete('/subcategories/:id', async (req, res) => {
  const subcategories = (await readData(SUBCATEGORIES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const { id } = req.params;
  const index = subcategories.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Subcategory not found' });

  const [deleted] = subcategories.splice(index, 1);
  await writeData(PRODUCTS_FILE, deleteSubcategoryReferences(products, deleted));
  (await writeData(SUBCATEGORIES_FILE, subcategories));

  (await logActivity('alert', 'Subcategory deleted', deleted.name));
  res.json({ message: 'Subcategory deleted successfully', subcategory: deleted });
});

// ==========================================
// INVENTORY CONTROL & ADJUSTMENTS
// ==========================================
router.get('/inventory/summary', async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const valuation = calculateInventoryValuation(products);
  if (!valuation) {
    return res.status(409).json({ error: 'Inventory valuation data is invalid. Review stock quantities and product prices before totaling.' });
  }

  const lowStock = products.filter(isLowStock);
  const outOfStock = products.filter(p => getStockStatus(p) === 'Out of Stock');

  res.json({
    totalProducts: products.length,
    totalUnits: valuation.totalUnits,
    totalRetailValuation: valuation.retailValueCents / 100,
    totalCostValuation: valuation.costValueCents === null ? null : valuation.costValueCents / 100,
    potentialProfit: valuation.potentialProfitCents === null ? null : valuation.potentialProfitCents / 100,
    marginPercent: valuation.marginPercent,
    unvaluedProductCount: valuation.unvaluedProductCount,
    costValuationComplete: valuation.isCostValuationComplete,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStockProducts: lowStock,
    outOfStockProducts: outOfStock
  });
});

router.get('/inventory/adjustments', async (req, res) => {
  const adjustments = (await readData('inventory_adjustments', []));
  res.json(adjustments);
});

router.post('/inventory/adjustments', async (req, res) => {
  const adjustments = (await readData('inventory_adjustments', []));
  const products = (await readData(PRODUCTS_FILE, []));
  const { productId, type, quantity, reason, adjustedBy } = req.body;

  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const qty = parseInt(quantity) || 0;
  const previousStock = product.stock || 0;
  let newStock = previousStock;

  if (type === 'Add' || type === 'Received') {
    newStock = previousStock + Math.abs(qty);
  } else if (type === 'Remove' || type === 'Damage' || type === 'Loss') {
    newStock = Math.max(0, previousStock - Math.abs(qty));
  } else if (type === 'Audit Count' || type === 'Exact Set') {
    newStock = Math.max(0, qty);
  }

  product.stock = newStock;
  product.status = getStockStatus({ ...product, stock: newStock });
  product.updatedAt = new Date().toISOString();

  (await writeData(PRODUCTS_FILE, products));

  const newAdjustment = {
    id: `adj-${Date.now()}`,
    productId,
    productName: product.name,
    sku: product.sku,
    type: type || 'Stock Adjustment',
    quantity: newStock - previousStock,
    reason: reason || 'Routine inventory reconciliation',
    adjustedBy: adjustedBy || 'Inventory Manager',
    previousStock,
    newStock,
    createdAt: new Date().toISOString()
  };

  adjustments.unshift(newAdjustment);
  (await writeData('inventory_adjustments', adjustments.slice(0, 100)));

  (await logActivity('stock', 'Inventory adjusted', `${product.name} (${product.sku}): ${previousStock} ➔ ${newStock} (${newAdjustment.type})`));

  res.status(201).json({ adjustment: newAdjustment, product });
});

// ==========================================
// PURCHASES & RESTOCK ORDERS
// ==========================================
router.get('/purchases', async (req, res) => {
  const purchases = (await readData(PURCHASES_FILE, []));
  res.json(purchases);
});

router.post('/purchases', async (req, res) => {
  const purchases = (await readData(PURCHASES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  const { supplierId, supplierName, items, notes, expectedDelivery } = req.body;

  const supplier = suppliers.find(item => item.id === supplierId && item.status !== 'Inactive');
  if (!supplier) {
    return res.status(400).json({ error: 'Choose an active, existing supplier before creating a purchase order.' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'At least one item is required for purchase order' });
  }
  if (items.some(item => !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || amountToCents(item.unitCost) === null || !products.some(product => product.id === item.productId))) {
    return res.status(400).json({ error: 'Each purchase item needs a positive whole quantity and a valid unit cost' });
  }
  if (new Set(items.map(item => item.productId)).size !== items.length) {
    return res.status(400).json({ error: 'A product can appear only once in a purchase order. Combine duplicate product quantities into one line.' });
  }

  let totalCents = 0;
  const enrichedItems = items.map(item => {
    const qty = Number(item.quantity);
    const unitCostCents = amountToCents(item.unitCost);
    const itemTotalCents = qty * unitCostCents;
    totalCents += itemTotalCents;

    const prod = products.find(p => p.id === item.productId);
    return {
      productId: item.productId,
      productName: prod ? prod.name : (item.productName || 'General Item'),
      sku: prod ? prod.sku : (item.sku || 'SKU-000'),
      quantity: qty,
      unitCost: unitCostCents / 100,
      total: itemTotalCents / 100
    };
  });
  if (!Number.isSafeInteger(totalCents)) {
    return res.status(400).json({ error: 'Purchase total is too large to record safely.' });
  }

  const poNumber = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

  const newPO = {
    id: `po-${randomUUID()}`,
    poNumber,
    supplierId: supplier.id,
    supplierName: supplier.companyName || supplierName,
    date: new Date().toISOString(),
    status: 'Pending',
    paymentStatus: 'Unpaid',
    payments: [],
    items: enrichedItems,
    totalAmount: totalCents / 100,
    paidAmount: 0,
    dueAmount: 0,
    expectedDelivery: expectedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: notes || 'Standard restocking order'
  };

  purchases.unshift(newPO);
  (await writeData(PURCHASES_FILE, purchases));

  (await logActivity('purchase', 'Purchase order created', `${poNumber} • ${newPO.totalAmount.toFixed(2)} (${newPO.supplierName})`));

  res.status(201).json(newPO);
});

router.put('/purchases/:id', async (req, res) => {
  const purchases = (await readData(PURCHASES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const { id } = req.params;
  const index = purchases.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Purchase order not found' });

  const existing = purchases[index];
  const { status, notes } = req.body;
  if (Object.hasOwn(req.body, 'paymentStatus')) {
    return res.status(400).json({ error: 'Payment status cannot be edited directly. Record an actual supplier payment instead.' });
  }

  if (status !== undefined && !PURCHASE_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Select a valid purchase order status.' });
  }
  const currentStatus = existing.status || 'Pending';
  const nextStatus = status || currentStatus;
  if (!canTransitionPurchase(currentStatus, nextStatus)) {
    return res.status(409).json({ error: `Purchase order cannot move from ${currentStatus} to ${nextStatus}.` });
  }
  const updated = {
    ...existing,
    status: nextStatus,
    notes: notes !== undefined ? notes : existing.notes,
    updatedAt: new Date().toISOString()
  };
  const paidCents = amountToCents(existing.paidAmount || 0);
  const totalCents = amountToCents(existing.totalAmount || 0);
  const creditCents = sumPaymentCents((existing.supplierReturns || []).map(vendorReturn => ({ amount: vendorReturn.creditAmount || 0 })));
  if (paidCents === null || totalCents === null || creditCents === null) {
    return res.status(409).json({ error: 'This purchase contains an invalid financial ledger and cannot be updated.' });
  }
  const balance = calculateAccountBalance(totalCents, paidCents, creditCents);
  updated.paidAmount = paidCents / 100;
  updated.supplierCreditAmount = creditCents / 100;
  updated.supplierCreditBalance = balance.creditBalanceCents / 100;
  updated.dueAmount = nextStatus === 'Received' ? balance.dueCents / 100 : 0;
  updated.paymentStatus = nextStatus === 'Received'
    ? balance.paymentStatus
    : paidCents > 0 ? 'Partial' : 'Unpaid';

  let didRestock = false;
  if (nextStatus === 'Received' && currentStatus !== 'Received') {
    const receipt = receivePurchaseOrder({ ...updated, status: currentStatus }, products, updated.updatedAt);
    Object.assign(updated, receipt.purchase);
    didRestock = receipt.restocked;
    if (didRestock) {
      receipt.products.forEach(product => {
        product.status = getStockStatus(product);
        product.updatedAt = updated.updatedAt;
      });
      products.splice(0, products.length, ...receipt.products);
    }
  }

  purchases[index] = updated;
  if (didRestock) {
    await writeTenantData({ products, purchases });
    await logActivity('stock', 'PO Items Restocked into Inventory', `${updated.poNumber} received - stocks updated.`);
  } else {
    (await writeData(PURCHASES_FILE, purchases));
  }

  (await logActivity('purchase', 'Purchase order updated', `${updated.poNumber} status: ${updated.status}`));
  res.json(updated);
});

router.post('/purchases/:id/payments', async (req, res) => {
  const purchases = await readData(PURCHASES_FILE, []);
  const financeLedger = await readData(FINANCE_LEDGER_FILE, []);
  const index = purchases.findIndex(purchase => purchase.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Purchase order not found.' });

  const purchase = purchases[index];
  const amountCents = amountToCents(req.body?.amount);
  if (amountCents === null || amountCents <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }
  const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
  const paidCents = sumPaymentCents(payments);
  const totalCents = amountToCents(purchase.totalAmount || 0);
  const creditCents = sumPaymentCents((purchase.supplierReturns || []).map(vendorReturn => ({ amount: vendorReturn.creditAmount || 0 })));
  if (paidCents === null || totalCents === null || creditCents === null) {
    return res.status(409).json({ error: 'This purchase contains an invalid financial ledger and cannot accept more payments.' });
  }
  if (paidCents + creditCents + amountCents > totalCents) {
    return res.status(400).json({ error: 'Payment cannot exceed the remaining purchase balance.' });
  }

  const payment = {
    id: `spp-${randomUUID()}`,
    amount: amountCents / 100,
    method: String(req.body?.method || 'Cash').trim().slice(0, 40),
    reference: String(req.body?.reference || '').trim().slice(0, 120),
    note: String(req.body?.note || '').trim().slice(0, 500),
    createdAt: new Date().toISOString()
  };
  if (!/^cash$/i.test(payment.method) && !payment.reference) {
    return res.status(400).json({ error: 'Enter the transaction reference for a non-cash supplier payment.' });
  }
  const expense = addCashbookExpense(financeLedger, await readData(FINANCE_SETTINGS_FILE, {}), {
    amountCents,
    description: `Supplier payment for ${purchase.poNumber} to ${purchase.supplierName}`,
    category: 'Supplier purchase payment',
    referenceType: 'supplier_payment',
    referenceId: payment.id,
    paymentMethod: payment.method,
    reference: payment.reference
  });
  if (expense.error) return res.status(409).json({ error: expense.error });
  payments.push(payment);
  const nextPaidCents = paidCents + amountCents;
  const received = purchase.status === 'Received';
  const balance = calculateAccountBalance(totalCents, nextPaidCents, creditCents);
  const updated = {
    ...purchase,
    payments,
    paidAmount: nextPaidCents / 100,
    supplierCreditAmount: creditCents / 100,
    supplierCreditBalance: balance.creditBalanceCents / 100,
    dueAmount: received ? balance.dueCents / 100 : 0,
    paymentStatus: received ? balance.paymentStatus : nextPaidCents > 0 ? 'Partial' : 'Unpaid',
    updatedAt: payment.createdAt
  };
  purchases[index] = updated;
  await writeTenantData({
    [PURCHASES_FILE]: purchases,
    [FINANCE_LEDGER_FILE]: expense.ledger
  }, getActiveTiwiId(req));
  await logActivity('payment', 'Supplier payment recorded', `${purchase.poNumber} • ${payment.amount.toFixed(2)} (${purchase.supplierName})`);
  res.status(201).json({ purchase: updated, payment });
});

router.post('/purchases/:id/returns', async (req, res) => {
  const purchases = await readData(PURCHASES_FILE, []);
  const products = await readData(PRODUCTS_FILE, []);
  const index = purchases.findIndex(purchase => purchase.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Purchase order not found.' });
  const purchase = purchases[index];
  if (purchase.status !== 'Received') {
    return res.status(409).json({ error: 'Only received supplier purchases can be returned.' });
  }
  const productId = String(req.body?.productId || '');
  const quantity = Number(req.body?.quantity);
  const reason = String(req.body?.reason || '').trim();
  if (!productId || !Number.isInteger(quantity) || quantity <= 0 || !reason || reason.length > 500) {
    return res.status(400).json({ error: 'Choose a product, enter a positive whole quantity, and provide a return reason.' });
  }
  const purchaseItem = (purchase.items || []).find(item => item.productId === productId);
  if (!purchaseItem) {
    return res.status(400).json({ error: 'The selected product is not part of this supplier purchase.' });
  }
  const returnedBefore = (purchase.supplierReturns || [])
    .flatMap(vendorReturn => vendorReturn.items || [])
    .filter(item => item.productId === productId)
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
  const purchaseQuantity = (purchase.items || [])
    .filter(item => item.productId === productId)
    .reduce((total, item) => total + Number(item.quantity || 0), 0);
  if (returnedBefore + quantity > purchaseQuantity) {
    return res.status(400).json({ error: 'Return quantity cannot exceed the quantity originally received minus previous returns.' });
  }
  const productIndex = products.findIndex(product => product.id === productId);
  if (productIndex === -1) {
    return res.status(409).json({ error: 'The returned product no longer exists in inventory.' });
  }
  if (Number(products[productIndex].stock || 0) < quantity) {
    return res.status(409).json({ error: 'There is not enough current stock to return this quantity. Record the stock discrepancy first.' });
  }
  const unitCostCents = amountToCents(purchaseItem.unitCost);
  const creditCents = quantity * unitCostCents;
  if (unitCostCents === null || !Number.isSafeInteger(creditCents) || creditCents <= 0) {
    return res.status(409).json({ error: 'This purchase line has an invalid cost and cannot be returned safely.' });
  }
  const now = new Date().toISOString();
  const vendorReturn = {
    id: `spr-${randomUUID()}`,
    returnNumber: `SR-${now.slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
    items: [{
      productId,
      productName: purchaseItem.productName,
      sku: purchaseItem.sku,
      quantity,
      unitCost: unitCostCents / 100,
      total: creditCents / 100
    }],
    creditAmount: creditCents / 100,
    reason,
    createdAt: now
  };
  const allReturns = [...(purchase.supplierReturns || []), vendorReturn];
  const allCreditCents = sumPaymentCents(allReturns.map(entry => ({ amount: entry.creditAmount || 0 })));
  const payments = Array.isArray(purchase.payments) ? purchase.payments : [];
  const paidCents = sumPaymentCents(payments);
  const totalCents = amountToCents(purchase.totalAmount || 0);
  if (allCreditCents === null || paidCents === null || totalCents === null) {
    return res.status(409).json({ error: 'This purchase contains an invalid financial ledger and cannot accept a return.' });
  }
  const balance = calculateAccountBalance(totalCents, paidCents, allCreditCents);
  const updatedPurchase = {
    ...purchase,
    supplierReturns: allReturns,
    paidAmount: paidCents / 100,
    supplierCreditAmount: allCreditCents / 100,
    supplierCreditBalance: balance.creditBalanceCents / 100,
    dueAmount: balance.dueCents / 100,
    paymentStatus: balance.paymentStatus,
    updatedAt: now
  };
  products[productIndex].stock = Number(products[productIndex].stock || 0) - quantity;
  products[productIndex].status = getStockStatus(products[productIndex]);
  products[productIndex].updatedAt = now;
  purchases[index] = updatedPurchase;
  await writeTenantData({ products, purchases }, getActiveTiwiId(req));
  await logActivity('supplier-return', 'Items returned to supplier', `${vendorReturn.returnNumber} • ${quantity} × ${purchaseItem.productName} • credit ${vendorReturn.creditAmount.toFixed(2)}`);
  res.status(201).json({ purchase: updatedPurchase, supplierReturn: vendorReturn });
});

router.delete('/purchases/:id', async (req, res) => {
  const purchases = (await readData(PURCHASES_FILE, []));
  const { id } = req.params;
  const index = purchases.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Purchase order not found' });

  const purchase = purchases[index];
  const recordedPaidCents = amountToCents(purchase.paidAmount ?? 0);
  const recordedCreditCents = amountToCents(purchase.supplierCreditAmount ?? 0);
  const hasReceivedHistory = (purchase.items || []).some(item => {
    const received = Number(item.receivedQuantity ?? 0);
    return !Number.isSafeInteger(received) || received !== 0;
  });
  const hasFinancialOrStockHistory = (purchase.payments || []).length > 0 ||
    (purchase.supplierReturns || []).length > 0 ||
    hasReceivedHistory ||
    recordedPaidCents === null ||
    recordedPaidCents > 0 ||
    recordedCreditCents === null ||
    recordedCreditCents > 0;
  if (hasFinancialOrStockHistory || !['Draft', 'Cancelled'].includes(purchase.status)) {
    return res.status(409).json({
      error: 'This purchase has financial, receipt, or stock history and cannot be deleted. Keep it for audit; cancel or record a return instead.'
    });
  }

  const [deleted] = purchases.splice(index, 1);
  await writeTenantData({ purchases }, getActiveTiwiId(req));

  (await logActivity('alert', 'Purchase order deleted', deleted.poNumber));
  res.json({ message: 'Purchase order deleted', purchase: deleted });
});

// ==========================================
// PAYMENT TOKENIZATION & SALES
// ==========================================
router.post('/payments/tokenize', (req, res) => {
  try {
    const tiwiId = getActiveTiwiId(req);
    const { items, totalAmount, currency = 'USD' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required for payment tokenization' });
    }

    const paymentIntent = PaymentSecurity.tokenizePaymentIntent(tiwiId, items, totalAmount, currency);
    res.json({
      success: true,
      paymentIntent,
      message: 'Payment intent cryptographically tokenized successfully'
    });
  } catch (err) {
    console.error('Payment tokenization error:', err);
    res.status(500).json({ error: 'Failed to tokenize payment intent' });
  }
});

router.get('/sales', async (req, res) => {
  const sales = (await readData(SALES_FILE, []));
  res.json(sales);
});

router.post('/sales/:id/payments', async (req, res) => {
  const sales = await readData(SALES_FILE, []);
  const financeLedger = await readData(FINANCE_LEDGER_FILE, []);
  const index = sales.findIndex(sale => sale.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Invoice not found.' });

  const sale = sales[index];
  const isStorefrontCod = sale.channel === 'storefront' &&
    /cash\s*on\s*delivery|\bcod\b/i.test(String(sale.paymentMethod || ''));
  if (sale.channel === 'storefront' && (!isStorefrontCod || sale.status !== 'Delivered')) {
    return res.status(409).json({ error: 'Storefront payment can be recorded here only for a delivered COD order. Online payments must be gateway-verified.' });
  }
  if (sale.channel !== 'storefront' && !sale.customerId) {
    return res.status(400).json({ error: 'Only a customer-account POS invoice can receive a due payment here.' });
  }
  const amountCents = amountToCents(req.body?.amount);
  const totalCents = amountToCents(sale.totalAmount || 0);
  if (amountCents === null || amountCents <= 0 || totalCents === null) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
  }
  const recordedPayments = Array.isArray(sale.payments) ? sale.payments : [];
  const recordedPaidCents = sumPaymentCents(recordedPayments);
  const storedPaidCents = amountToCents(sale.paidAmount || 0);
  if (recordedPaidCents === null || storedPaidCents === null) {
    return res.status(409).json({ error: 'This invoice contains an invalid payment ledger and cannot accept more payments.' });
  }
  const paidCents = sale.paymentStatus === 'Paid'
    ? totalCents
    : Math.max(recordedPaidCents, storedPaidCents);
  if (amountCents > totalCents - paidCents) {
    return res.status(400).json({ error: 'Payment cannot exceed the remaining invoice balance.' });
  }

  const method = String(req.body?.method || 'Cash').trim().slice(0, 40);
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  const isExternalPayment = !/^cash$/i.test(method);
  if (isExternalPayment && !reference) {
    return res.status(400).json({ error: 'Enter the payment transaction reference before recording a non-cash payment.' });
  }
  const payment = {
    id: `cp-${randomUUID()}`,
    amount: amountCents / 100,
    method,
    reference,
    note: String(req.body?.note || '').trim().slice(0, 500),
    verificationStatus: isExternalPayment ? 'merchant_recorded' : 'cashier_recorded',
    gatewayVerified: false,
    createdAt: new Date().toISOString()
  };
  const nextFinanceLedger = addCashbookIncome(financeLedger, {
    amountCents,
    description: `Customer payment for ${sale.invoiceNumber} from ${sale.customerName}`,
    category: isStorefrontCod ? 'Cash on delivery receipt' : 'Customer invoice payment',
    referenceType: 'customer_payment',
    referenceId: payment.id,
    staffId: '',
    paymentMethod: payment.method,
    reference: payment.reference
  });
  const nextPaidCents = paidCents + amountCents;
  const updated = {
    ...sale,
    payments: [...recordedPayments, payment],
    paidAmount: nextPaidCents / 100,
    dueAmount: Math.max(0, totalCents - nextPaidCents) / 100,
    paymentStatus: nextPaidCents >= totalCents ? 'Paid' : 'Partial',
    ...(isStorefrontCod ? { paymentMethod: 'Cash on Delivery (COD)' } : {}),
    updatedAt: payment.createdAt
  };
  sales[index] = updated;
  await writeTenantData({
    [SALES_FILE]: sales,
    [FINANCE_LEDGER_FILE]: nextFinanceLedger
  }, getActiveTiwiId(req));
  await logActivity('payment', 'Customer payment recorded', `${sale.invoiceNumber} • ${payment.amount.toFixed(2)} (${sale.customerName})`);
  res.status(201).json({ sale: updated, payment });
});

router.patch('/sales/:id/invoice', async (req, res) => {
  const sales = await readData(SALES_FILE, []);
  const index = sales.findIndex(sale => sale.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Invoice not found.' });

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Invoice changes must be provided as an object.' });
  }
  const allowedFields = ['customerName', 'customerEmail', 'invoiceNotes'];
  const unexpectedField = Object.keys(req.body).find(key => !allowedFields.includes(key));
  if (unexpectedField) {
    return res.status(400).json({ error: `Invoice field "${unexpectedField}" cannot be edited.` });
  }
  if (!allowedFields.some(key => Object.hasOwn(req.body, key))) {
    return res.status(400).json({ error: 'Provide customer details or an invoice note to update.' });
  }

  const sale = sales[index];
  if (req.body.customerName !== undefined) {
    if (typeof req.body.customerName !== 'string') {
      return res.status(400).json({ error: 'Customer name must be text.' });
    }
    const customerName = req.body.customerName.trim();
    if (!customerName || customerName.length > 120) {
      return res.status(400).json({ error: 'Customer name must be between 1 and 120 characters.' });
    }
    sale.customerName = customerName;
  }
  if (req.body.customerEmail !== undefined) {
    if (typeof req.body.customerEmail !== 'string') {
      return res.status(400).json({ error: 'Customer email must be text.' });
    }
    const email = req.body.customerEmail.trim();
    try {
      sale.customerEmail = email ? normalizeCustomerEmail(email) : '';
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      throw error;
    }
  }
  if (req.body.invoiceNotes !== undefined) {
    if (typeof req.body.invoiceNotes !== 'string' || req.body.invoiceNotes.length > 500) {
      return res.status(400).json({ error: 'Invoice note must be text no longer than 500 characters.' });
    }
    sale.invoiceNotes = req.body.invoiceNotes.trim();
  }

  const updatedAt = new Date().toISOString();
  sale.updatedAt = updatedAt;
  sale.invoiceHistory = [
    ...(Array.isArray(sale.invoiceHistory) ? sale.invoiceHistory : []),
    { action: 'details_updated', at: updatedAt }
  ].slice(-50);
  sales[index] = sale;
  await writeData(SALES_FILE, sales);
  await logActivity('sale', 'Invoice details updated', `${sale.invoiceNumber} • ${sale.customerName}`);
  return res.json(sale);
});

router.post('/sales/:id/invoice-email', async (req, res) => {
  const sales = await readData(SALES_FILE, []);
  const sale = sales.find(entry => entry.id === req.params.id);
  if (!sale) return res.status(404).json({ error: 'Invoice not found.' });
  if (!sale.customerEmail) return res.status(409).json({ error: 'Add a valid customer email before sending this invoice.' });
  let recipient;
  try {
    recipient = normalizeCustomerEmail(sale.customerEmail);
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(409).json({ error: 'Update the invoice with a valid customer email before sending it.' });
    }
    throw error;
  }

  try {
    const settings = await readData(STORE_SETTINGS_FILE, {});
    const emailResult = await sendInvoiceEmail({
      to: recipient,
      name: sale.customerName,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date && Number.isFinite(Date.parse(sale.date))
        ? new Date(sale.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '',
      amount: Number(sale.totalAmount || 0),
      paidAmount: sale.paidAmount ?? (sale.paymentStatus === 'Paid' ? Number(sale.totalAmount || 0) : 0),
      dueAmount: sale.dueAmount ?? (sale.paymentStatus === 'Paid' ? 0 : Math.max(0, Number(sale.totalAmount || 0) - Number(sale.paidAmount || 0))),
      currency: sale.currency || 'USD',
      paymentStatus: sale.paymentStatus || 'Pending',
      paymentMethod: sale.paymentMethod || 'Not recorded',
      storeName: settings.storeName || 'Tiwlo Store',
      items: (sale.items || []).map(item => ({
        description: item.productName || item.name || 'Store item',
        qty: Number(item.quantity) || 1,
        amount: Number(item.total ?? (Number(item.unitPrice || item.price || 0) * (Number(item.quantity) || 1)))
      }))
    });
    if (!emailResult?.success) {
      return res.status(502).json({ error: 'The invoice could not be delivered. Check the store email delivery configuration.' });
    }
    return res.json({ success: true, sentTo: recipient, status: emailResult.status });
  } catch (error) {
    console.error('[Store invoice email] Delivery failed:', error.message);
    return res.status(502).json({ error: 'The invoice could not be delivered. Check the store email delivery configuration.' });
  }
});

router.post('/sales', async (req, res) => {
  const sales = (await readData(SALES_FILE, []));
  const financeLedger = await readData(FINANCE_LEDGER_FILE, []);
  const products = (await readData(PRODUCTS_FILE, []));
  const customers = (await readData(CUSTOMERS_FILE, []));
  const tiwiId = getActiveTiwiId(req);
  const isPublicStorefrontOrder = !!req.storefrontStore;

  const {
    customerId,
    customerName,
    customerPhone,
    customerEmail,
    items,
    paymentMethod,
    discount,
    notes,
    paymentToken,
    paymentSignature,
    paymentTimestamp
  } = req.body;
  const selectedProvider = isPublicStorefrontOrder && paymentMethod !== 'Cash on Delivery (COD)'
    ? String(paymentMethod || '').toLowerCase()
    : '';

  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one item is required to create a sale' });
  }

  let storefrontAddress = null;
  let storefrontBillingAddress = null;
  let customerAccount = null;
  let orderCustomerEmail = customerEmail || '';
  if (isPublicStorefrontOrder) {
    try {
      storefrontAddress = normalizeStorefrontAddress(req.body?.shippingAddress);
      if (req.body?.billingAddress) {
        storefrontBillingAddress = normalizeStorefrontAddress(req.body.billingAddress);
      }
      customerAccount = (await getStoreCustomer(req))?.account || null;
      if (customerAccount && customerEmail &&
          normalizeCustomerEmail(customerEmail) !== customerAccount.email) {
        return res.status(400).json({ error: 'Checkout email must match the signed-in customer account.' });
      }
      if (customerAccount && !orderCustomerEmail) orderCustomerEmail = customerAccount.email;
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      throw error;
    }
  }

  if (isPublicStorefrontOrder &&
      (!String(customerName || '').trim() || !String(customerPhone || '').trim())) {
    return res.status(400).json({ error: 'Name, phone, and delivery address are required for storefront orders.' });
  }
  if (isPublicStorefrontOrder && !paymentMethod) {
    return res.status(400).json({ error: 'Choose a payment method before placing the order.' });
  }
  if (isPublicStorefrontOrder) {
    const normalizedPhone = normalizePhone(customerPhone);
    if (String(customerName).trim().length > 120 || normalizedPhone.length < 7 || normalizedPhone.length > 15 ||
        (customerEmail && (String(customerEmail).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)))) {
      return res.status(400).json({ error: 'Enter valid customer contact details and a delivery address.' });
    }
  }

  if (isPublicStorefrontOrder && selectedProvider && !CHECKOUT_READY_PROVIDERS.has(selectedProvider)) {
    return res.status(400).json({ error: 'Select an enabled payment method supported by this store.' });
  }

  if (!isPublicStorefrontOrder && paymentToken && paymentSignature && paymentTimestamp) {
    const isTamperFree = PaymentSecurity.verifyPaymentIntegrity(
      tiwiId,
      paymentToken,
      paymentSignature,
      paymentTimestamp,
      items,
      req.body.totalAmount || 0
    );
    if (!isTamperFree) {
      (await logActivity('alert', 'Payment Tampering Attempt Detected!', `Invalid signature on payment token: ${paymentToken}`, tiwiId));
      return res.status(403).json({ error: '🚨 Security Alert: Cryptographic payment integrity verification failed. Transaction blocked.' });
    }
  }

  let subtotalCents = 0;
  const enrichedItems = [];

  const requestedQuantities = new Map();
  for (const item of items) {
    const qty = Number(item.quantity);
    const prod = products.find(p => p.id === item.productId || p.id === item.id);
    if (!Number.isSafeInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Each sale item needs a positive whole quantity' });
    }
    if (!prod) {
      return res.status(400).json({ error: 'Every sale item must reference an existing product' });
    }
    const requested = (requestedQuantities.get(prod.id) || 0) + qty;
    if (requested > Number(prod.stock || 0)) {
      return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });
    }
    requestedQuantities.set(prod.id, requested);
    const unitPriceCents = amountToCents(prod.price);
    if (unitPriceCents === null) {
      return res.status(400).json({ error: `Invalid price configured for ${prod.name}` });
    }
    const itemTotalCents = qty * unitPriceCents;
    const nextSubtotalCents = subtotalCents + itemTotalCents;
    if (!Number.isSafeInteger(itemTotalCents) || !Number.isSafeInteger(nextSubtotalCents)) {
      return res.status(400).json({ error: 'Sale total is too large to calculate safely.' });
    }
    const unitPrice = unitPriceCents / 100;
    const itemTotal = itemTotalCents / 100;
    subtotalCents = nextSubtotalCents;

    prod.stock = Number(prod.stock || 0) - qty;
    prod.sold = Number(prod.sold || 0) + qty;
    const existingRevenueCents = amountToCents(prod.revenue || 0);
    if (existingRevenueCents === null || !Number.isSafeInteger(existingRevenueCents + itemTotalCents)) {
      return res.status(409).json({ error: `Revenue data for ${prod.name} is invalid and cannot be updated safely.` });
    }
    prod.revenue = (existingRevenueCents + itemTotalCents) / 100;
    prod.status = getStockStatus(prod);

    enrichedItems.push({
      productId: item.productId || item.id,
      productName: prod ? prod.name : (item.productName || 'Store Product'),
      sku: prod ? prod.sku : (item.sku || 'SKU-000'),
      quantity: qty,
      unitPrice,
      total: itemTotal,
      shippingWeightKg: prod.shippingWeightKg ?? null,
      image: prod.image || prod.images?.[0] || ''
    });
  }

  const subtotal = subtotalCents / 100;
  const storeSettings = (await readData(STORE_SETTINGS_FILE, {}, tiwiId));
  const shippingQuote = isPublicStorefrontOrder
    ? quoteShipping(storeSettings, storefrontAddress.country, subtotal, {
      countryCode: storefrontAddress.countryCode,
      city: storefrontAddress.city,
      weightKg: enrichedItems.reduce((total, item) => total + (Number(item.shippingWeightKg) || 0) * item.quantity, 0),
      weightComplete: enrichedItems.every(item => item.shippingWeightKg !== null)
    })
    : null;
  if (isPublicStorefrontOrder && !shippingQuote.available) {
    return res.status(422).json({ error: shippingQuote.error || 'This store does not ship to the selected destination.' });
  }
  if (isPublicStorefrontOrder && !selectedProvider && shippingQuote.codEnabled === false) {
    return res.status(400).json({ error: 'Cash on Delivery is unavailable for this delivery zone.' });
  }
  const configuredTaxRate = Number(shippingQuote?.taxRate ?? storeSettings?.taxRate ?? 0);
  if (!Number.isFinite(configuredTaxRate) || configuredTaxRate < 0) {
    return res.status(409).json({ error: 'The store tax rate is invalid. Correct store settings before recording a sale.' });
  }
  const promotionUsage = isPublicStorefrontOrder
    ? getPromotionUsage(sales, req.body?.promoCode, {
      email: orderCustomerEmail,
      phone: customerPhone
    })
    : null;
  const promotion = isPublicStorefrontOrder
    ? calculatePromotionDiscount(storeSettings, req.body?.promoCode, subtotal, {
      countryCode: storefrontAddress.countryCode,
      totalRedemptions: promotionUsage.total,
      customerRedemptions: promotionUsage.customer
    })
    : null;
  if (isPublicStorefrontOrder && req.body?.promoCode && !promotion.valid) {
    return res.status(400).json({ error: promotion.error });
  }
  const requestedDiscount = isPublicStorefrontOrder
    ? promotion?.discountAmount || 0
    : Number(discount);
  const requestedDiscountCents = amountToCents(requestedDiscount ?? 0);
  if (requestedDiscountCents === null) {
    return res.status(400).json({ error: 'Discount must be a valid non-negative amount.' });
  }
  const discountCents = Math.min(subtotalCents, requestedDiscountCents);
  const netCents = subtotalCents - discountCents;
  const taxCents = calculatePercentageCents(netCents, configuredTaxRate);
  const shippingCents = isPublicStorefrontOrder ? amountToCents(shippingQuote.amount) : 0;
  if (taxCents === null || shippingCents === null || !Number.isSafeInteger(netCents + taxCents + shippingCents)) {
    return res.status(400).json({ error: 'Tax, shipping, or invoice total is invalid and cannot be calculated safely.' });
  }
  const discountAmount = discountCents / 100;
  const tax = taxCents / 100;
  const shipping = shippingCents / 100;
  let totalCents = netCents + taxCents + shippingCents;
  let totalAmount = totalCents / 100;
  const storeCurrencyValue = req.activeStore?.currency || storeSettings?.currency || req.activeUser?.currency || 'USD';
  const orderCurrency = String(storeCurrencyValue).match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';
  let paymentFee = 0;
  let gatewayConfig = null;
  let gatewayCredentials = null;
  if (selectedProvider) {
    gatewayConfig = storeSettings.paymentProviders?.[selectedProvider];
    const credentialRecord = storeSettings.paymentProviderCredentials?.[selectedProvider];
    if (!gatewayConfig?.enabled || !credentialRecord) {
      return res.status(400).json({ error: 'This online payment method is not enabled for this store.' });
    }
    if (!CHECKOUT_READY_PROVIDERS.has(selectedProvider)) {
      return res.status(400).json({ error: 'This payment gateway is not ready for checkout yet.' });
    }
    const providerDefinition = PAYMENT_PROVIDER_DEFINITIONS[selectedProvider];
    if (!providerDefinition?.currencies.includes(orderCurrency)) {
      return res.status(400).json({
        error: `${providerDefinition?.name || 'This payment provider'} does not support the store currency ${orderCurrency}.`
      });
    }
    try {
      gatewayCredentials = decryptPaymentCredentials(tiwiId, selectedProvider, {
        ciphertext: Buffer.from(credentialRecord.ciphertext, 'base64'),
        iv: Buffer.from(credentialRecord.iv, 'base64'),
        authTag: Buffer.from(credentialRecord.authTag, 'base64')
      });
    } catch (error) {
      console.error(`[Store payment] Could not decrypt ${selectedProvider} credentials:`, error.message);
      return res.status(503).json({ error: 'The store payment configuration is unavailable. Contact the store owner.' });
    }
    if (gatewayConfig.feeMode === 'customer') {
      const fixedFeeCents = amountToCents(gatewayConfig.feeFixed || 0);
      const feePercent = Number(gatewayConfig.feePercent || 0);
      const percentageFeeCents = calculatePercentageCents(totalCents, feePercent);
      if (fixedFeeCents === null || percentageFeeCents === null ||
          !Number.isSafeInteger(totalCents + fixedFeeCents + percentageFeeCents)) {
        return res.status(409).json({ error: 'The payment fee configuration is invalid and cannot be calculated safely.' });
      }
      const feeCents = fixedFeeCents + percentageFeeCents;
      paymentFee = feeCents / 100;
      totalCents += feeCents;
      totalAmount = totalCents / 100;
    }
  }

  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    return res.status(400).json({ error: 'Invoice total is too large or invalid to record safely.' });
  }
  const paidCents = isPublicStorefrontOrder
    ? 0
    : req.body.paidAmount === undefined
      ? totalCents
      : amountToCents(req.body.paidAmount);
  if (paidCents === null || paidCents < 0 || paidCents > totalCents) {
    return res.status(400).json({ error: 'Collected amount must be between zero and the invoice total.' });
  }
  const paidMethod = String(req.body?.paidMethod || paymentMethod || 'Cash').trim().slice(0, 40);
  const paymentReference = String(req.body?.paymentReference || '').trim().slice(0, 120);
  const isExternalTerminalPayment = !isPublicStorefrontOrder && paidCents > 0 && !/^cash$/i.test(paidMethod);
  if (isExternalTerminalPayment && !paymentReference) {
    return res.status(400).json({ error: 'Enter the external payment transaction reference before recording this payment.' });
  }
  if (!isPublicStorefrontOrder && paidCents < totalCents) {
    const customer = customers.find(item => item.id === customerId);
    if (!customer) {
      return res.status(400).json({ error: 'Select an existing customer before recording an unpaid or partially paid sale.' });
    }
    let existingDueCents = 0;
    for (const previousSale of sales.filter(sale => sale.customerId === customerId && sale.channel !== 'storefront')) {
      const previousTotalCents = amountToCents(previousSale.totalAmount || 0);
      const previousPaidCents = previousSale.paymentStatus === 'Paid'
        ? previousTotalCents
        : amountToCents(previousSale.paidAmount || 0);
      if (previousTotalCents === null || previousPaidCents === null) {
        return res.status(409).json({ error: 'This customer has an invalid previous invoice balance. Review the customer ledger before extending more credit.' });
      }
      const nextDueCents = existingDueCents + Math.max(0, previousTotalCents - previousPaidCents);
      if (!Number.isSafeInteger(nextDueCents)) {
        return res.status(409).json({ error: 'The customer balance is too large to calculate safely.' });
      }
      existingDueCents = nextDueCents;
    }
    const creditLimitCents = amountToCents(customer.creditLimit || 0);
    if (creditLimitCents === null || !Number.isSafeInteger(existingDueCents + totalCents - paidCents)) {
      return res.status(409).json({ error: 'Customer credit data is invalid and cannot be calculated safely.' });
    }
    if (creditLimitCents > 0 && existingDueCents + totalCents - paidCents > creditLimitCents) {
      return res.status(400).json({ error: 'This sale exceeds the customer credit limit after including their existing balance.' });
    }
  }

  const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().toUpperCase()}`;
  const paymentReturnToken = selectedProvider ? randomBytes(32).toString('base64url') : '';
  const paymentProviderDefinition = selectedProvider
    ? PAYMENT_PROVIDER_DEFINITIONS[selectedProvider]
    : null;

  if (customerId && !isPublicStorefrontOrder) {
    const custIndex = customers.findIndex(c => c.id === customerId);
    if (custIndex !== -1) {
      customers[custIndex].totalOrders = (customers[custIndex].totalOrders || 0) + 1;
      const previousSpentCents = amountToCents(customers[custIndex].totalSpent || 0);
      if (previousSpentCents === null || !Number.isSafeInteger(previousSpentCents + totalCents)) {
        return res.status(409).json({ error: 'Customer sales total is invalid and cannot be updated safely.' });
      }
      customers[custIndex].totalSpent = (previousSpentCents + totalCents) / 100;
    }
  }

  const newSale = {
    id: `inv-${randomUUID()}`,
    invoiceNumber,
    customerId: isPublicStorefrontOrder ? '' : customerId || '',
    customerName: customerName || 'Walk-in Customer',
    customerPhone: isPublicStorefrontOrder ? customerPhone || '' : undefined,
    customerEmail: isPublicStorefrontOrder ? orderCustomerEmail : undefined,
    customerAccountId: isPublicStorefrontOrder ? customerAccount?.id || '' : undefined,
    deliveryAddress: isPublicStorefrontOrder ? storefrontAddress.deliveryAddress : undefined,
    shippingAddress: isPublicStorefrontOrder ? {
      street: storefrontAddress.street,
      city: storefrontAddress.city,
      region: storefrontAddress.region,
      postalCode: storefrontAddress.postalCode,
      country: storefrontAddress.country,
      countryCode: storefrontAddress.countryCode
    } : undefined,
    billingAddress: isPublicStorefrontOrder && storefrontBillingAddress ? {
      street: storefrontBillingAddress.street,
      city: storefrontBillingAddress.city,
      region: storefrontBillingAddress.region,
      postalCode: storefrontBillingAddress.postalCode,
      country: storefrontBillingAddress.country,
      countryCode: storefrontBillingAddress.countryCode
    } : undefined,
    date: new Date().toISOString(),
    items: enrichedItems,
    subtotal,
    tax,
    discount: discountAmount,
    paymentFee,
    promoCode: isPublicStorefrontOrder ? promotion?.code || '' : undefined,
    shipping,
    shippingZoneId: isPublicStorefrontOrder ? shippingQuote.zoneId : undefined,
    shippingCountry: isPublicStorefrontOrder ? storefrontAddress.country : undefined,
    shippingMethod: isPublicStorefrontOrder ? shippingQuote.shippingMethod || 'Standard shipping' : undefined,
    shippingEstimateDays: isPublicStorefrontOrder && shippingQuote.zoneId
      ? { min: shippingQuote.minDeliveryDays, max: shippingQuote.maxDeliveryDays }
      : undefined,
    currency: orderCurrency,
    totalAmount,
    paymentMethod: selectedProvider
      ? `${paymentProviderDefinition.name} online`
      : paymentMethod || 'Cash',
    paymentToken: isPublicStorefrontOrder ? null : paymentToken || `pay_verified_${Date.now()}`,
    channel: isPublicStorefrontOrder ? 'storefront' : 'pos',
    paidAmount: isPublicStorefrontOrder ? 0 : paidCents / 100,
    dueAmount: isPublicStorefrontOrder ? totalCents / 100 : (totalCents - paidCents) / 100,
    payments: !isPublicStorefrontOrder && paidCents > 0 ? [{
      id: `cp-${randomUUID()}`,
      amount: paidCents / 100,
      method: paidMethod,
      reference: paymentReference,
      verificationStatus: isExternalTerminalPayment ? 'merchant_recorded' : 'cashier_recorded',
      gatewayVerified: false,
      createdAt: new Date().toISOString()
    }] : [],
    paymentStatus: isPublicStorefrontOrder
      ? 'Pending'
      : paidCents >= totalCents ? 'Paid' : paidCents > 0 ? 'Partial' : 'Unpaid',
    paymentGateway: selectedProvider ? {
      provider: selectedProvider,
      status: 'creating',
      amount: totalAmount,
      amountMinor: totalCents,
      currency: orderCurrency,
      mode: gatewayConfig.mode,
      tiwiId,
      returnTokenHash: createHash('sha256').update(paymentReturnToken).digest('hex'),
      createdAt: new Date().toISOString()
    } : undefined,
    status: isPublicStorefrontOrder ? 'Pending' : 'Completed',
    statusHistory: [{
      status: isPublicStorefrontOrder ? 'Pending' : 'Completed',
      at: new Date().toISOString()
    }],
    notes: notes || 'Point of Sale Transaction'
  };

  sales.unshift(newSale);
  let nextFinanceLedger = financeLedger;
  if (!isPublicStorefrontOrder && paidCents > 0) {
    const firstPayment = newSale.payments[0];
    nextFinanceLedger = addCashbookIncome(financeLedger, {
      amountCents: paidCents,
      description: `POS receipt for ${invoiceNumber} from ${newSale.customerName}`,
      category: 'POS sale receipt',
      referenceType: 'sale_payment',
      referenceId: firstPayment.id,
      paymentMethod: firstPayment.method,
      reference: firstPayment.reference
    });
  }
  await writeTenantData({
    products,
    sales,
    ...(!isPublicStorefrontOrder ? { customers } : {}),
    ...(!isPublicStorefrontOrder && paidCents > 0 ? { [FINANCE_LEDGER_FILE]: nextFinanceLedger } : {})
  }, tiwiId);

  (await logActivity(
    'sale',
    isPublicStorefrontOrder ? 'New storefront order received' : 'New sale completed',
    `${invoiceNumber} • ${newSale.currency} ${totalAmount.toFixed(2)} (${newSale.customerName})`,
    tiwiId
  ));

  if (selectedProvider) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const callbackUrl = `${origin}/api/public/payments/${selectedProvider}/return?orderId=${encodeURIComponent(newSale.id)}&token=${encodeURIComponent(paymentReturnToken)}`;
    const cancelUrl = `${callbackUrl}&result=cancelled`;
    const successUrl = selectedProvider === 'stripe'
      ? `${callbackUrl}&session_id={CHECKOUT_SESSION_ID}`
      : callbackUrl;
    try {
      const checkout = await createHostedPayment({
        provider: selectedProvider,
        tiwiId,
        credentials: gatewayCredentials,
        mode: gatewayConfig.mode,
        order: newSale,
        callbackUrl,
        successUrl,
        cancelUrl
      });
      newSale.paymentGateway = {
        ...newSale.paymentGateway,
        status: 'awaiting_customer',
        providerPaymentId: checkout.providerPaymentId,
        updatedAt: new Date().toISOString()
      };
      sales[0] = newSale;
      await writeData(SALES_FILE, sales, tiwiId);
      const publicPaymentGateway = Object.fromEntries(
        Object.entries(newSale.paymentGateway).filter(([key]) =>
          !['returnTokenHash', 'tiwiId', 'amountMinor'].includes(key)
        )
      );
      return res.status(201).json({
        ...newSale,
        paymentGateway: publicPaymentGateway,
        checkoutUrl: checkout.checkoutUrl,
        receiptToken: paymentReturnToken
      });
    } catch (error) {
      newSale.paymentGateway.status = 'initiation_failed';
      newSale.paymentGateway.updatedAt = new Date().toISOString();
      sales[0] = newSale;
      await writeData(SALES_FILE, sales, tiwiId);
      console.error(`[Store payment] ${selectedProvider} checkout could not be created:`, error.message);
      return res.status(502).json({
        error: 'The order was recorded but the payment page could not be opened. Contact the store before retrying.',
        orderId: newSale.id,
        invoiceNumber: newSale.invoiceNumber
      });
    }
  }

  res.status(201).json(newSale);
});

router.patch('/sales/:id', async (req, res) => {
  const sales = await readData(SALES_FILE, []);
  const orderIndex = sales.findIndex(sale => sale.id === req.params.id);
  if (orderIndex === -1) return res.status(404).json({ error: 'Order not found.' });
  const order = sales[orderIndex];
  if (order.channel !== 'storefront') {
    return res.status(400).json({ error: 'Only storefront orders can be updated here.' });
  }
  if (Object.hasOwn(req.body || {}, 'paymentStatus')) {
    return res.status(400).json({
      error: 'Payment status is controlled by verified gateway results or recorded COD collections; it cannot be edited directly.'
    });
  }

  const validationError = validateOrderUpdate(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const editableFields = ['customerName', 'customerPhone', 'customerEmail', 'shippingAddress', 'billingAddress'];
  const hasOrderEdits = editableFields.some(key => Object.hasOwn(req.body || {}, key));
  if (hasOrderEdits && !canEditStoreOrder(order)) {
    return res.status(409).json({ error: 'Customer and address details can only be edited before processing starts.' });
  }
  const hasUpdates = ['status', 'courierService', 'trackingNumber', 'trackingUrl', ...editableFields]
    .some(key => Object.hasOwn(req.body || {}, key));
  if (!hasUpdates) return res.status(400).json({ error: 'Provide an order status, payment status, courier, tracking number, contact, or address update.' });

  const currentStatus = order.status || 'Pending';
  const nextStatus = req.body.status || currentStatus;
  if (!canTransitionOrder(currentStatus, nextStatus)) {
    return res.status(409).json({ error: `Order cannot move from ${currentStatus} to ${nextStatus}.` });
  }
  const nextCourier = req.body.courierService === undefined
    ? order.courierService || ''
    : req.body.courierService.trim();
  const nextTrackingNumber = req.body.trackingNumber === undefined
    ? order.trackingNumber || ''
    : req.body.trackingNumber.trim();
  const nextTrackingUrl = req.body.trackingUrl === undefined
    ? order.trackingUrl || ''
    : req.body.trackingUrl.trim();
  if (['Shipped', 'Out for Delivery'].includes(nextStatus) && (!nextCourier || !nextTrackingNumber)) {
    return res.status(400).json({ error: 'Select a courier and enter its tracking number before marking the order shipped.' });
  }

  const updatedAt = new Date().toISOString();
  const changedFields = [];
  let shippingAddress = order.shippingAddress;
  let deliveryAddress = order.deliveryAddress;
  let billingAddress = order.billingAddress;
  if (req.body.customerName !== undefined) {
    const value = String(req.body.customerName).trim();
    if (!value || value.length > 120) return res.status(400).json({ error: 'Enter a valid customer name.' });
    if (value !== order.customerName) changedFields.push('customerName');
    order.customerName = value;
  }
  if (req.body.customerPhone !== undefined) {
    const value = String(req.body.customerPhone).trim();
    const normalized = normalizePhone(value);
    if (value.length > 40 || normalized.length < 7 || normalized.length > 15) {
      return res.status(400).json({ error: 'Enter a valid customer phone number.' });
    }
    if (value !== order.customerPhone) changedFields.push('customerPhone');
    order.customerPhone = value;
  }
  if (req.body.customerEmail !== undefined) {
    const value = req.body.customerEmail ? normalizeCustomerEmail(req.body.customerEmail) : '';
    if (value !== order.customerEmail) changedFields.push('customerEmail');
    order.customerEmail = value;
  }
  if (req.body.shippingAddress !== undefined) {
    const address = normalizeStorefrontAddress(req.body.shippingAddress);
    if (address.deliveryAddress !== order.deliveryAddress) changedFields.push('shippingAddress');
    shippingAddress = address;
    deliveryAddress = address.deliveryAddress;
  }
  if (req.body.billingAddress !== undefined) {
    billingAddress = req.body.billingAddress === null
      ? null
      : normalizeStorefrontAddress(req.body.billingAddress);
    if (JSON.stringify(billingAddress) !== JSON.stringify(order.billingAddress || null)) changedFields.push('billingAddress');
  }
  const updatedOrder = {
    ...order,
    status: nextStatus,
    courierService: nextCourier,
    trackingNumber: nextTrackingNumber,
    trackingUrl: nextTrackingUrl,
    shippingAddress,
    deliveryAddress,
    billingAddress,
    updatedAt,
    orderEditHistory: changedFields.length
      ? [
        ...(Array.isArray(order.orderEditHistory) ? order.orderEditHistory : []),
        { actorType: 'merchant', actorId: getReqUserId(req), changedFields, at: updatedAt }
      ]
      : order.orderEditHistory,
    statusHistory: nextStatus === currentStatus
      ? (Array.isArray(order.statusHistory) ? order.statusHistory : [{ status: currentStatus, at: order.date }])
      : [...(Array.isArray(order.statusHistory) ? order.statusHistory : [{ status: currentStatus, at: order.date }]), {
        status: nextStatus,
        at: updatedAt
      }]
  };
  sales[orderIndex] = updatedOrder;

  const updates = { sales };
  if (nextStatus === 'Cancelled' && currentStatus !== 'Cancelled' && !order.stockRestocked) {
    const products = await readData(PRODUCTS_FILE, []);
    const inventoryReversal = reverseOrderInventory(products, order.items || []);
    if (!inventoryReversal) {
      return res.status(409).json({ error: 'Order stock or revenue history is invalid or incomplete. Review this order and inventory before reversing its stock.' });
    }
    for (const productId of inventoryReversal.changedProductIds) {
      const product = inventoryReversal.products.find(entry => entry.id === productId);
      product.status = getStockStatus(product);
      product.updatedAt = updatedAt;
    }
    updates.products = inventoryReversal.products;
    updatedOrder.stockRestocked = true;
  }

  await writeTenantData(updates);
  await logActivity(
    'sale',
    `Order ${nextStatus.toLowerCase()}`,
    `${order.invoiceNumber}${nextTrackingNumber ? ` • Tracking ${nextTrackingNumber}` : ''}`,
    getActiveTiwiId(req)
  );
  return res.json(updatedOrder);
});

// ==========================================
// CUSTOMERS & SUPPLIERS CRUD
// ==========================================
router.get('/staff', async (req, res) => {
  const [staff, transactions] = await Promise.all([
    readData(STAFF_FILE, []),
    readData(STAFF_TRANSACTIONS_FILE, [])
  ]);
  res.json(staff.map(person => ({
    ...person,
    outstandingAdvanceCents: calculateOutstandingAdvanceCents(person.id, transactions)
  })));
});

router.post('/staff', requireRecentReauth, async (req, res) => {
  const staff = await readData(STAFF_FILE, []);
  const { name, phone, email, address, jobTitle, department, startDate, salaryFrequency } = req.body || {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || normalizedName.length > 120) {
    return res.status(400).json({ error: 'Staff name must be between 1 and 120 characters.' });
  }
  if (phone && (typeof phone !== 'string' || phone.trim().length > 40)) {
    return res.status(400).json({ error: 'Enter a phone number up to 40 characters.' });
  }
  if (email && (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: 'Enter a valid staff email address.' });
  }
  const normalizedStartDate = parseDateOnly(startDate);
  if (!normalizedStartDate) return res.status(400).json({ error: 'Enter a valid staff start date.' });
  if (!['Monthly', 'Weekly', 'Hourly'].includes(salaryFrequency)) {
    return res.status(400).json({ error: 'Choose a monthly, weekly, or hourly pay schedule.' });
  }
  const salaryAmountCents = salaryFrequency === 'Hourly' ? 0 : amountToCents(req.body.salaryAmount);
  const hourlyRateCents = salaryFrequency === 'Hourly' ? amountToCents(req.body.hourlyRate) : 0;
  if ((salaryFrequency !== 'Hourly' && (salaryAmountCents === null || salaryAmountCents <= 0)) ||
      (salaryFrequency === 'Hourly' && (hourlyRateCents === null || hourlyRateCents <= 0))) {
    return res.status(400).json({ error: 'Enter a valid positive salary or hourly rate.' });
  }

  const now = new Date().toISOString();
  const person = {
    id: `staff-${randomUUID()}`,
    name: normalizedName,
    phone: String(phone || '').trim().slice(0, 40),
    email: String(email || '').trim().toLowerCase(),
    address: String(address || '').trim().slice(0, 500),
    jobTitle: String(jobTitle || '').trim().slice(0, 120),
    department: String(department || '').trim().slice(0, 120),
    startDate: normalizedStartDate,
    salaryFrequency,
    salaryAmountCents: salaryFrequency === 'Hourly' ? 0 : salaryAmountCents,
    hourlyRateCents: salaryFrequency === 'Hourly' ? hourlyRateCents : 0,
    status: 'Active',
    createdAt: now,
    updatedAt: now
  };
  staff.unshift(person);
  await writeTenantData({ [STAFF_FILE]: staff }, getActiveTiwiId(req));
  await logActivity('staff', 'Staff member added', `${person.name} • ${person.jobTitle || person.department || 'Staff'}`);
  res.status(201).json(person);
});

router.put('/staff/:id', requireRecentReauth, async (req, res) => {
  const staff = await readData(STAFF_FILE, []);
  const index = staff.findIndex(person => person.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Staff member not found.' });
  const existing = staff[index];
  const payload = req.body || {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : existing.name;
  const frequency = payload.salaryFrequency ?? existing.salaryFrequency;
  const startDate = payload.startDate ?? existing.startDate;
  const salaryAmountCents = frequency === 'Hourly'
    ? 0
    : payload.salaryAmount === undefined ? existing.salaryAmountCents : amountToCents(payload.salaryAmount);
  const hourlyRateCents = frequency === 'Hourly'
    ? payload.hourlyRate === undefined ? existing.hourlyRateCents : amountToCents(payload.hourlyRate)
    : 0;
  if (!name || name.length > 120) return res.status(400).json({ error: 'Enter a valid staff name.' });
  if (!['Monthly', 'Weekly', 'Hourly'].includes(frequency)) return res.status(400).json({ error: 'Choose a valid pay schedule.' });
  if (!parseDateOnly(startDate)) return res.status(400).json({ error: 'Enter a valid staff start date.' });
  if ((frequency !== 'Hourly' && (!Number.isSafeInteger(salaryAmountCents) || salaryAmountCents <= 0)) ||
      (frequency === 'Hourly' && (!Number.isSafeInteger(hourlyRateCents) || hourlyRateCents <= 0))) {
    return res.status(400).json({ error: 'Enter a valid positive salary or hourly rate.' });
  }
  if (payload.status !== undefined && !['Active', 'Inactive'].includes(payload.status)) {
    return res.status(400).json({ error: 'Staff status must be Active or Inactive.' });
  }
  if (payload.email && (typeof payload.email !== 'string' || payload.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))) {
    return res.status(400).json({ error: 'Enter a valid staff email address.' });
  }
  const updated = {
    ...existing,
    name,
    phone: payload.phone === undefined ? existing.phone : String(payload.phone).trim().slice(0, 40),
    email: payload.email === undefined ? existing.email : String(payload.email).trim().toLowerCase(),
    address: payload.address === undefined ? existing.address : String(payload.address).trim().slice(0, 500),
    jobTitle: payload.jobTitle === undefined ? existing.jobTitle : String(payload.jobTitle).trim().slice(0, 120),
    department: payload.department === undefined ? existing.department : String(payload.department).trim().slice(0, 120),
    startDate,
    salaryFrequency: frequency,
    salaryAmountCents,
    hourlyRateCents,
    status: payload.status || existing.status,
    updatedAt: new Date().toISOString()
  };
  staff[index] = updated;
  await writeTenantData({ [STAFF_FILE]: staff }, getActiveTiwiId(req));
  await logActivity('staff', 'Staff profile updated', updated.name);
  res.json(updated);
});

router.get('/finance/summary', async (req, res) => {
  const [financeSettings, ledger, staff, payroll] = await Promise.all([
    readData(FINANCE_SETTINGS_FILE, {}),
    readData(FINANCE_LEDGER_FILE, []),
    readData(STAFF_FILE, []),
    readData(PAYROLL_FILE, [])
  ]);
  const balanceCents = getFinanceBalance(financeSettings, ledger);
  if (financeSettings.openingBalanceAt && balanceCents === null) {
    return res.status(409).json({ error: 'Company cashbook contains invalid entries. Review its ledger before recording more transactions.' });
  }
  const staffTransactions = await readData(STAFF_TRANSACTIONS_FILE, []);
  const outstandingAdvanceCents = staff.reduce((total, person) => {
    if (total === null) return null;
    const amount = calculateOutstandingAdvanceCents(person.id, staffTransactions);
    return amount === null || !Number.isSafeInteger(total + amount) ? null : total + amount;
  }, 0);
  if (outstandingAdvanceCents === null) {
    return res.status(409).json({ error: 'Staff advance history is invalid and cannot be totaled safely.' });
  }
  const unpaidPayrollCents = payroll.reduce((total, record) => {
    if (total === null) return null;
    const netPayCents = record.netPayCents;
    const paidCents = record.paidCents;
    const due = netPayCents - paidCents;
    return Number.isSafeInteger(netPayCents) && netPayCents >= 0 &&
      Number.isSafeInteger(paidCents) && paidCents >= 0 && paidCents <= netPayCents &&
      Number.isSafeInteger(due) && Number.isSafeInteger(total + due)
      ? total + due
      : null;
  }, 0);
  if (unpaidPayrollCents === null) {
    return res.status(409).json({ error: 'Payroll history is invalid and cannot be totaled safely.' });
  }
  const openingBalanceSet = Number.isSafeInteger(financeSettings.openingBalanceCents) && Boolean(financeSettings.openingBalanceAt);
  const openingTimestamp = openingBalanceSet ? Date.parse(financeSettings.openingBalanceAt) : null;
  res.json({
    openingBalanceSet,
    openingBalanceCents: financeSettings.openingBalanceCents ?? null,
    openingBalanceAt: financeSettings.openingBalanceAt || null,
    balanceCents,
    outstandingAdvanceCents,
    unpaidPayrollCents,
    staffCount: staff.filter(person => person.status === 'Active').length,
    currency: req.activeStore?.currency || req.activeUser?.currency || 'USD',
    ledger: ledger.slice(0, 200).map(entry => ({
      ...entry,
      includedInBalance: openingBalanceSet && Date.parse(entry.createdAt) >= openingTimestamp
    })),
    payroll: payroll.slice(0, 100),
    staffTransactions: staffTransactions.slice(0, 100)
  });
});

router.post('/finance/opening-balance', async (req, res) => {
  const financeSettings = await readData(FINANCE_SETTINGS_FILE, {});
  if (Number.isSafeInteger(financeSettings.openingBalanceCents) && financeSettings.openingBalanceAt) {
    return res.status(409).json({ error: 'Company opening balance is already set. Use a documented income or expense entry to correct it.' });
  }
  const openingBalanceCents = amountToCents(req.body?.amount);
  if (openingBalanceCents === null) return res.status(400).json({ error: 'Enter a valid non-negative opening balance.' });
  const now = new Date().toISOString();
  const settings = { openingBalanceCents, openingBalanceAt: now };
  await writeTenantData({ [FINANCE_SETTINGS_FILE]: settings }, getActiveTiwiId(req));
  res.status(201).json({ openingBalanceCents, balanceCents: openingBalanceCents, openingBalanceAt: now });
});

router.post('/finance/income', async (req, res) => {
  const [financeSettings, ledger] = await Promise.all([
    readData(FINANCE_SETTINGS_FILE, {}),
    readData(FINANCE_LEDGER_FILE, [])
  ]);
  const amountCents = amountToCents(req.body?.amount);
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const paymentMethod = String(req.body?.paymentMethod || 'Cash').trim().slice(0, 40);
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  if (amountCents === null || amountCents <= 0 || !description || description.length > 500) {
    return res.status(400).json({ error: 'Enter a positive income amount and a description up to 500 characters.' });
  }
  if (!/^cash$/i.test(paymentMethod) && !reference) {
    return res.status(400).json({ error: 'Enter a transaction reference for non-cash company income.' });
  }
  const currentBalanceCents = getFinanceBalance(financeSettings, ledger);
  if (currentBalanceCents === null) {
    return res.status(409).json({ error: 'Set the company opening balance before recording income.' });
  }
  const entry = {
    direction: 'in',
    amountCents,
    category: String(req.body?.category || 'Other income').trim().slice(0, 100),
    description,
    referenceType: 'manual_income',
    referenceId: `income-${randomUUID()}`,
    recipientName: String(req.body?.receivedFrom || '').trim().slice(0, 120),
    paymentMethod,
    reference,
    createdAt: new Date().toISOString()
  };
  const nextLedger = appendFinanceEntry(ledger, entry);
  const balanceCents = getFinanceBalance(financeSettings, nextLedger);
  if (balanceCents === null) return res.status(409).json({ error: 'Income amount exceeds safe accounting limits.' });
  await writeTenantData({ [FINANCE_LEDGER_FILE]: nextLedger }, getActiveTiwiId(req));
  res.status(201).json({ entry, balanceCents });
});

router.post('/hr/expenses', async (req, res) => {
  const [financeSettings, ledger] = await Promise.all([
    readData(FINANCE_SETTINGS_FILE, {}),
    readData(FINANCE_LEDGER_FILE, [])
  ]);
  const amountCents = amountToCents(req.body?.amount);
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const recipientName = typeof req.body?.recipientName === 'string' ? req.body.recipientName.trim() : '';
  const paymentMethod = String(req.body?.paymentMethod || 'Cash').trim().slice(0, 40);
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  if (req.body?.expenseDate && !parseDateOnly(req.body.expenseDate)) {
    return res.status(400).json({ error: 'Enter a valid expense date.' });
  }
  if (!Number.isSafeInteger(financeSettings?.openingBalanceCents) || !financeSettings.openingBalanceAt) {
    return res.status(409).json({ error: 'Set the company opening balance before recording HR expenses.' });
  }
  if (amountCents === null || amountCents <= 0 || !description || description.length > 500 ||
      !recipientName || recipientName.length > 120) {
    return res.status(400).json({ error: 'Enter an expense amount, reason, and payee.' });
  }
  if (!/^cash$/i.test(paymentMethod) && !reference) {
    return res.status(400).json({ error: 'Enter a transaction reference for non-cash expenses.' });
  }
  const payment = addCashbookExpense(ledger, financeSettings, {
    amountCents,
    description,
    category: String(req.body?.category || 'Other').trim().slice(0, 100),
    referenceType: 'staff_expense',
    referenceId: `expense-${randomUUID()}`,
    paymentMethod,
    reference
  });
  if (payment.error) return res.status(409).json({ error: payment.error });
  const entry = payment.ledger[0];
  Object.assign(entry, {
    recipientName,
    expenseDate: req.body?.expenseDate || entry.createdAt.slice(0, 10),
    transportMode: String(req.body?.transportMode || '').trim().slice(0, 60),
    location: String(req.body?.location || '').trim().slice(0, 200),
    address: String(req.body?.address || '').trim().slice(0, 300),
    notes: String(req.body?.notes || '').trim().slice(0, 500)
  });
  const balanceCents = getFinanceBalance(financeSettings, payment.ledger);
  if (balanceCents === null) return res.status(409).json({ error: 'Expense cannot be applied safely to the company balance.' });
  await writeTenantData({ [FINANCE_LEDGER_FILE]: payment.ledger }, getActiveTiwiId(req));
  await logActivity('expense', 'Company expense recorded', `${recipientName} • ${description}`);
  res.status(201).json({ entry, balanceCents });
});

router.post('/hr/advances', async (req, res) => {
  const [staff, staffTransactions, financeSettings, ledger] = await Promise.all([
    readData(STAFF_FILE, []),
    readData(STAFF_TRANSACTIONS_FILE, []),
    readData(FINANCE_SETTINGS_FILE, {}),
    readData(FINANCE_LEDGER_FILE, [])
  ]);
  const employee = staff.find(person => person.id === req.body?.staffId && person.status === 'Active');
  if (!employee) return res.status(404).json({ error: 'Select an active staff member.' });
  if (!Number.isSafeInteger(financeSettings?.openingBalanceCents) || !financeSettings.openingBalanceAt) {
    return res.status(409).json({ error: 'Set the company opening balance before paying staff advances.' });
  }
  const amountCents = amountToCents(req.body?.amount);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const paymentMethod = String(req.body?.paymentMethod || 'Cash').trim().slice(0, 40);
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  if (amountCents === null || amountCents <= 0 || !reason || reason.length > 500) {
    return res.status(400).json({ error: 'Enter a positive advance amount and a clear reason.' });
  }
  if (!/^cash$/i.test(paymentMethod) && !reference) {
    return res.status(400).json({ error: 'Enter a transaction reference for non-cash salary advances.' });
  }
  const outstandingCents = calculateOutstandingAdvanceCents(employee.id, staffTransactions);
  if (outstandingCents === null || !Number.isSafeInteger(outstandingCents + amountCents)) {
    return res.status(409).json({ error: 'Existing staff advance balance is invalid.' });
  }
  const referenceId = `advance-${randomUUID()}`;
  const payment = addCashbookExpense(ledger, financeSettings, {
    amountCents,
    description: `Salary advance to ${employee.name}: ${reason}`,
    category: 'Staff salary advance',
    referenceType: 'salary_advance',
    referenceId,
    staffId: employee.id,
    paymentMethod,
    reference
  });
  if (payment.error) return res.status(409).json({ error: payment.error });
  const transaction = {
    id: `stx-${randomUUID()}`,
    staffId: employee.id,
    type: 'advance_issued',
    amountCents,
    reason,
    referenceId,
    paymentMethod,
    reference,
    createdAt: payment.createdAt
  };
  staffTransactions.unshift(transaction);
  await writeTenantData({
    [STAFF_TRANSACTIONS_FILE]: staffTransactions,
    [FINANCE_LEDGER_FILE]: payment.ledger
  }, getActiveTiwiId(req));
  await logActivity('salary-advance', 'Staff salary advance paid', `${employee.name} • ${(amountCents / 100).toFixed(2)}`);
  res.status(201).json({
    transaction,
    outstandingAdvanceCents: outstandingCents + amountCents,
    balanceCents: getFinanceBalance(financeSettings, payment.ledger)
  });
});

router.post('/hr/advances/:staffId/repayments', async (req, res) => {
  const [staff, staffTransactions, financeSettings, ledger] = await Promise.all([
    readData(STAFF_FILE, []),
    readData(STAFF_TRANSACTIONS_FILE, []),
    readData(FINANCE_SETTINGS_FILE, {}),
    readData(FINANCE_LEDGER_FILE, [])
  ]);
  const employee = staff.find(person => person.id === req.params.staffId);
  if (!employee) return res.status(404).json({ error: 'Staff member not found.' });
  if (!Number.isSafeInteger(financeSettings?.openingBalanceCents) || !financeSettings.openingBalanceAt) {
    return res.status(409).json({ error: 'Set the company opening balance before recording cash repayments.' });
  }
  const amountCents = amountToCents(req.body?.amount);
  const outstandingCents = calculateOutstandingAdvanceCents(employee.id, staffTransactions);
  const paymentMethod = String(req.body?.paymentMethod || 'Cash').trim().slice(0, 40);
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  if (amountCents === null || amountCents <= 0 || outstandingCents === null || amountCents > outstandingCents) {
    return res.status(400).json({ error: 'Repayment must be positive and cannot exceed this staff member’s outstanding advance.' });
  }
  if (!/^cash$/i.test(paymentMethod) && !reference) {
    return res.status(400).json({ error: 'Enter a transaction reference for non-cash advance repayments.' });
  }
  const now = new Date().toISOString();
  const transaction = {
    id: `stx-${randomUUID()}`,
    staffId: employee.id,
    type: 'advance_repayment',
    amountCents,
    reason: String(req.body?.note || 'Cash advance repayment').trim().slice(0, 500),
    paymentMethod,
    reference,
    createdAt: now
  };
  const referenceId = `advance-repayment-${transaction.id}`;
  const nextTransactions = [transaction, ...staffTransactions];
  const nextLedger = addCashbookIncome(ledger, {
    amountCents,
    description: `Advance repayment from ${employee.name}`,
    category: 'Staff advance repayment',
    referenceType: 'advance_repayment',
    referenceId,
    staffId: employee.id,
    paymentMethod,
    reference
  });
  if (getFinanceBalance(financeSettings, nextLedger) === null) {
    return res.status(409).json({ error: 'Advance repayment cannot be applied safely to the company ledger.' });
  }
  await writeTenantData({
    [STAFF_TRANSACTIONS_FILE]: nextTransactions,
    [FINANCE_LEDGER_FILE]: nextLedger
  }, getActiveTiwiId(req));
  res.status(201).json({
    transaction,
    outstandingAdvanceCents: outstandingCents - amountCents,
    balanceCents: getFinanceBalance(financeSettings, nextLedger)
  });
});

router.post('/hr/payroll', async (req, res) => {
  const [staff, payroll, staffTransactions] = await Promise.all([
    readData(STAFF_FILE, []),
    readData(PAYROLL_FILE, []),
    readData(STAFF_TRANSACTIONS_FILE, [])
  ]);
  const employee = staff.find(person => person.id === req.body?.staffId && person.status === 'Active');
  if (!employee) return res.status(404).json({ error: 'Select an active staff member.' });
  const periodStart = parseDateOnly(req.body?.periodStart);
  const periodEnd = parseDateOnly(req.body?.periodEnd);
  if (!periodStart || !periodEnd || periodEnd < periodStart || periodEnd > new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Enter a valid completed payroll period.' });
  }
  if (periodStart < employee.startDate) {
    return res.status(400).json({ error: 'Payroll cannot include dates before this staff member’s start date.' });
  }
  const overlap = payroll.some(record =>
    record.staffId === employee.id && periodStart <= record.periodEnd && periodEnd >= record.periodStart
  );
  if (overlap) return res.status(409).json({ error: 'This payroll period overlaps a payroll already recorded for this staff member.' });
  const hoursHundredths = employee.salaryFrequency === 'Hourly'
    ? parseHoursToHundredths(req.body?.hours)
    : null;
  const grossCents = employee.salaryFrequency === 'Hourly'
    ? calculatePayrollGrossCents(employee, hoursHundredths)
    : calculateFixedPayrollGrossCents(employee, periodStart, periodEnd);
  const deductionCents = amountToCents(req.body?.advanceDeduction ?? 0);
  const outstandingCents = calculateOutstandingAdvanceCents(employee.id, staffTransactions);
  if (grossCents === null || deductionCents === null || outstandingCents === null ||
      deductionCents > outstandingCents || deductionCents > grossCents) {
    return res.status(400).json({ error: 'Salary or advance deduction is invalid; the deduction cannot exceed salary or outstanding advance.' });
  }
  const netPayCents = grossCents - deductionCents;
  const now = new Date().toISOString();
  const record = {
    id: `payroll-${randomUUID()}`,
    staffId: employee.id,
    staffName: employee.name,
    salaryFrequency: employee.salaryFrequency,
    periodStart,
    periodEnd,
    hoursHundredths,
    grossCents,
    advanceDeductionCents: deductionCents,
    netPayCents,
    paidCents: 0,
    status: netPayCents === 0 ? 'Paid' : 'Unpaid',
    createdAt: now
  };
  payroll.unshift(record);
  const updates = { [PAYROLL_FILE]: payroll };
  let nextTransactions = staffTransactions;
  if (deductionCents > 0) {
    nextTransactions = [{
      id: `stx-${randomUUID()}`,
      staffId: employee.id,
      type: 'advance_payroll_deduction',
      amountCents: deductionCents,
      reason: `Payroll deduction for ${periodStart} to ${periodEnd}`,
      referenceId: record.id,
      createdAt: now
    }, ...staffTransactions];
    updates[STAFF_TRANSACTIONS_FILE] = nextTransactions;
  }
  await writeTenantData(updates, getActiveTiwiId(req));
  await logActivity('payroll', 'Payroll period prepared', `${employee.name} • ${(netPayCents / 100).toFixed(2)} due`);
  res.status(201).json(record);
});

router.post('/hr/payroll/:id/payments', async (req, res) => {
  const [payroll, financeSettings, ledger] = await Promise.all([
    readData(PAYROLL_FILE, []),
    readData(FINANCE_SETTINGS_FILE, {}),
    readData(FINANCE_LEDGER_FILE, [])
  ]);
  const index = payroll.findIndex(record => record.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Payroll record not found.' });
  if (!Number.isSafeInteger(financeSettings?.openingBalanceCents) || !financeSettings.openingBalanceAt) {
    return res.status(409).json({ error: 'Set the company opening balance before paying salaries.' });
  }
  const record = payroll[index];
  const amountCents = amountToCents(req.body?.amount);
  if (!Number.isSafeInteger(record.netPayCents) || record.netPayCents < 0 ||
      !Number.isSafeInteger(record.paidCents) || record.paidCents < 0 ||
      record.paidCents > record.netPayCents) {
    return res.status(409).json({ error: 'This payroll record has an invalid balance and cannot accept payment.' });
  }
  const dueCents = record.netPayCents - record.paidCents;
  const paymentMethod = String(req.body?.method || 'Cash').trim().slice(0, 40);
  const reference = String(req.body?.reference || '').trim().slice(0, 120);
  if (amountCents === null || amountCents <= 0 || amountCents > dueCents) {
    return res.status(400).json({ error: 'Salary payment must be positive and cannot exceed the outstanding payroll amount.' });
  }
  if (!/^cash$/i.test(paymentMethod) && !reference) {
    return res.status(400).json({ error: 'Enter a transaction reference for a non-cash salary payment.' });
  }
  const payment = addCashbookExpense(ledger, financeSettings, {
    amountCents,
    description: `Salary payment to ${record.staffName} (${record.periodStart} to ${record.periodEnd})`,
    category: 'Staff salary',
    referenceType: 'payroll_payment',
    referenceId: `payroll-payment-${randomUUID()}`,
    staffId: record.staffId,
    paymentMethod
  });
  if (payment.error) return res.status(409).json({ error: payment.error });
  const nextPaidCents = record.paidCents + amountCents;
  const updated = {
    ...record,
    paidCents: nextPaidCents,
    status: nextPaidCents === record.netPayCents ? 'Paid' : 'Partial',
    payments: [...(record.payments || []), {
      id: `pyp-${randomUUID()}`,
      amountCents,
      method: paymentMethod,
      reference,
      createdAt: payment.createdAt
    }]
  };
  payroll[index] = updated;
  const entry = payment.ledger[0];
  entry.referenceId = updated.payments.at(-1).id;
  entry.referenceType = 'payroll_payment';
  entry.referenceLabel = record.id;
  entry.reference = reference;
  const balanceCents = getFinanceBalance(financeSettings, payment.ledger);
  if (balanceCents === null) return res.status(409).json({ error: 'Salary payment cannot be applied safely to the company balance.' });
  await writeTenantData({
    [PAYROLL_FILE]: payroll,
    [FINANCE_LEDGER_FILE]: payment.ledger
  }, getActiveTiwiId(req));
  res.status(201).json({ payroll: updated, balanceCents });
});

router.get('/customers', async (req, res) => {
  const customers = (await readData(CUSTOMERS_FILE, []));
  res.json(customers);
});

router.post('/customers', async (req, res) => {
  const customers = (await readData(CUSTOMERS_FILE, []));
  const {
    name,
    email,
    phone,
    address,
    city,
    customerType,
    contactPerson,
    taxId,
    country,
    paymentTerms,
    creditLimit,
    notes
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Customer name is required' });

  const newCust = {
    id: `cust-${Date.now()}`,
    name,
    customerType: customerType || 'Retail',
    contactPerson: contactPerson || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    city: city || 'Dhaka',
    country: country || 'Global',
    taxId: taxId || '',
    paymentTerms: paymentTerms || 'Immediate',
    creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
    notes: notes || '',
    totalOrders: 0,
    totalSpent: 0,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  customers.unshift(newCust);
  (await writeData(CUSTOMERS_FILE, customers));

  (await logActivity('customer', 'New customer registered', `${name} (${newCust.customerType} - ${newCust.city})`));
  res.status(201).json(newCust);
});

router.put('/customers/:id', async (req, res) => {
  const customers = (await readData(CUSTOMERS_FILE, []));
  const { id } = req.params;
  const index = customers.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const existing = customers[index];
  const {
    name,
    email,
    phone,
    address,
    city,
    customerType,
    contactPerson,
    taxId,
    country,
    paymentTerms,
    creditLimit,
    notes,
    status
  } = req.body;

  const updated = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    customerType: customerType !== undefined ? customerType : (existing.customerType || 'Retail'),
    contactPerson: contactPerson !== undefined ? contactPerson : (existing.contactPerson || ''),
    email: email !== undefined ? email : existing.email,
    phone: phone !== undefined ? phone : existing.phone,
    address: address !== undefined ? address : existing.address,
    city: city !== undefined ? city : existing.city,
    country: country !== undefined ? country : (existing.country || 'Global'),
    taxId: taxId !== undefined ? taxId : (existing.taxId || ''),
    paymentTerms: paymentTerms !== undefined ? paymentTerms : (existing.paymentTerms || 'Immediate'),
    creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : (existing.creditLimit || 0),
    notes: notes !== undefined ? notes : (existing.notes || ''),
    status: status !== undefined ? status : existing.status,
    updatedAt: new Date().toISOString()
  };

  customers[index] = updated;
  (await writeData(CUSTOMERS_FILE, customers));

  (await logActivity('customer', 'Customer updated', updated.name));
  res.json(updated);
});

router.delete('/customers/:id', async (req, res) => {
  const customers = (await readData(CUSTOMERS_FILE, []));
  const { id } = req.params;
  const index = customers.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const [deleted] = customers.splice(index, 1);
  (await writeData(CUSTOMERS_FILE, customers));

  (await logActivity('alert', 'Customer deleted', deleted.name));
  res.json({ message: 'Customer deleted', customer: deleted });
});

router.get('/suppliers', async (req, res) => {
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  res.json(suppliers);
});

router.post('/suppliers', async (req, res) => {
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  const { companyName, contactPerson, email, phone, address, category, leadTimeDays } = req.body;
  const normalizedCompanyName = typeof companyName === 'string' ? companyName.trim() : '';

  if (!normalizedCompanyName || normalizedCompanyName.length > 120) {
    return res.status(400).json({ error: 'Supplier name must be between 1 and 120 characters.' });
  }
  if (email && (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: 'Enter a valid supplier email address.' });
  }
  if (phone && (typeof phone !== 'string' || phone.length > 40)) {
    return res.status(400).json({ error: 'Supplier phone must be 40 characters or fewer.' });
  }

  const newSupplier = {
    id: `sup-${randomUUID()}`,
    companyName: normalizedCompanyName,
    contactPerson: contactPerson || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    category: category || 'General',
    leadTimeDays: parseInt(leadTimeDays) || 5,
    rating: 4.8,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  suppliers.unshift(newSupplier);
  (await writeData(SUPPLIERS_FILE, suppliers));

  (await logActivity('supplier', 'New supplier onboarded', `${normalizedCompanyName} (${newSupplier.category})`));
  res.status(201).json(newSupplier);
});

router.put('/suppliers/:id', async (req, res) => {
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  const { id } = req.params;
  const index = suppliers.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Supplier not found' });

  const existing = suppliers[index];
  const { companyName, contactPerson, email, phone, address, category, leadTimeDays, status } = req.body;

  const updated = {
    ...existing,
    companyName: companyName !== undefined ? companyName : existing.companyName,
    contactPerson: contactPerson !== undefined ? contactPerson : existing.contactPerson,
    email: email !== undefined ? email : existing.email,
    phone: phone !== undefined ? phone : existing.phone,
    address: address !== undefined ? address : existing.address,
    category: category !== undefined ? category : existing.category,
    leadTimeDays: leadTimeDays !== undefined ? parseInt(leadTimeDays) : existing.leadTimeDays,
    status: status !== undefined ? status : existing.status,
    updatedAt: new Date().toISOString()
  };

  suppliers[index] = updated;
  (await writeData(SUPPLIERS_FILE, suppliers));

  (await logActivity('supplier', 'Supplier updated', updated.companyName));
  res.json(updated);
});

router.delete('/suppliers/:id', async (req, res) => {
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  const { id } = req.params;
  const index = suppliers.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Supplier not found' });

  const [deleted] = suppliers.splice(index, 1);
  (await writeData(SUPPLIERS_FILE, suppliers));

  (await logActivity('alert', 'Supplier deleted', deleted.companyName));
  res.json({ message: 'Supplier deleted', supplier: deleted });
});

// ==========================================
// STORE SETTINGS & ASSET UPLOADS
// ==========================================
router.get('/store/settings', async (req, res) => {
  const account = req.activeUser || {};
  const defaultSettings = {
    storeName: account.storeName || account.name || 'Your Store',
    subdomain: req.activeStore?.subdomain || account.subdomain || '',
    storeTagline: 'Shop Global • Sell Global',
    storeLogo: null,
    activeTheme: 'TiwiMart',
    themeColor: '#2563eb',
    themeColorPreset: 'sapphire',
    themeMode: 'light',
    contactEmail: account.email || '',
    contactPhone: account.phone || '',
    storeAddress: '',
    storeCity: '',
    storeCountry: '',
    storePostalCode: '',
    refundRequestsEnabled: true,
    ...getStoreCurrencySettings(req.activeStore?.currency || account.currency || 'USD ($)'),
    taxRate: 0,
    bannerSlidingSpeed: 5,
    availableThemes: [
      {
        id: 'TiwiMart',
        name: 'TiwiMart Global Marketplace',
        tagline: 'Modern Multi-Vendor & eCommerce Marketplace',
        category: 'Marketplace',
        rating: 4.9,
        reviewsCount: 1420,
        author: 'Tiwlo Engineering',
        version: '1.2.0',
        features: ['Sliding Hero Banner', 'Multi-Vendor Stores', 'Live Stock Sync', 'Realtime Cart & COD'],
        previewImage: '/banners/hero_banner_main.png'
      }
    ]
  };
  const settings = (await readData(STORE_SETTINGS_FILE, defaultSettings));
  const { paymentProviderCredentials, ...publicSettings } = settings;
  res.json({
    ...defaultSettings,
    ...publicSettings,
    ...getStoreCurrencySettings(
      req.activeStore?.currency || settings.currency || defaultSettings.currency,
      settings.currencySymbol
    )
  });
});

router.put('/store/settings', async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Store settings must be provided as an object.' });
  }
  if (Object.hasOwn(req.body || {}, 'paymentProviderCredentials') ||
      Object.hasOwn(req.body || {}, 'paymentProviders') ||
      Object.hasOwn(req.body || {}, 'currencyExchange')) {
    return res.status(400).json({ error: 'Use the dedicated payment or currency settings endpoint to update these values.' });
  }
  const numericSettings = ['taxRate', 'shippingFlatRate', 'freeShippingThreshold'];
  for (const key of numericSettings) {
    if (req.body?.[key] === undefined || req.body[key] === '') continue;
    const value = Number(req.body[key]);
    if (!Number.isFinite(value) || value < 0 || (key === 'taxRate' && value > 100)) {
      return res.status(400).json({ error: `${key} must be a valid non-negative number${key === 'taxRate' ? ' no greater than 100' : ''}.` });
    }
  }
  const stringLimits = {
    storeName: 120,
    storeAddress: 240,
    storeCity: 100,
    storeCountry: 100,
    storePostalCode: 24,
    contactEmail: 254,
    contactPhone: 40,
    promoCode: 32,
    promoStartsAt: 40,
    promoEndsAt: 40
  };
  for (const [key, maxLength] of Object.entries(stringLimits)) {
    if (req.body?.[key] !== undefined &&
        (typeof req.body[key] !== 'string' || req.body[key].length > maxLength)) {
      return res.status(400).json({ error: `${key} must be text no longer than ${maxLength} characters.` });
    }
  }
  if (req.body?.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.contactEmail)) {
    return res.status(400).json({ error: 'Enter a valid store contact email.' });
  }
  if (req.body?.promoActive !== undefined && typeof req.body.promoActive !== 'boolean') {
    return res.status(400).json({ error: 'promoActive must be true or false.' });
  }
  if (req.body?.refundRequestsEnabled !== undefined && typeof req.body.refundRequestsEnabled !== 'boolean') {
    return res.status(400).json({ error: 'refundRequestsEnabled must be true or false.' });
  }
  if (req.body?.refundRequestsEnabled !== undefined && typeof req.body.refundRequestsEnabled !== 'boolean') {
    return res.status(400).json({ error: 'refundRequestsEnabled must be true or false.' });
  }
  if (req.body?.promoCode !== undefined && req.body.promoCode && !/^[A-Za-z0-9_-]+$/.test(req.body.promoCode.trim())) {
    return res.status(400).json({ error: 'Promotion code may contain only letters, numbers, hyphens, and underscores.' });
  }

  const current = (await readData(STORE_SETTINGS_FILE, {}));
  const promotionSettings = { ...current, ...req.body };
  const promotionErrors = validatePromotionSettings(promotionSettings);
  if (promotionErrors.length) return res.status(400).json({ error: promotionErrors[0] });
  if (promotionSettings.promoActive === true &&
      (!String(promotionSettings.promoCode || '').trim() ||
       !Number.isFinite(Number(promotionSettings.promoDiscountPercent)) ||
       Number(promotionSettings.promoDiscountPercent) <= 0)) {
    return res.status(400).json({ error: 'Set a promotion code and a discount greater than 0 before enabling it.' });
  }
  const updated = {
    ...current,
    ...req.body,
    paymentProviderCredentials: current.paymentProviderCredentials,
    paymentProviders: current.paymentProviders,
    currencyExchange: current.currencyExchange,
    storeName: req.body?.storeName !== undefined ? req.body.storeName.trim() : current.storeName,
    promoCode: req.body?.promoCode !== undefined ? req.body.promoCode.trim().toUpperCase() : current.promoCode,
    promoDiscountType: req.body?.promoDiscountType !== undefined
      ? req.body.promoDiscountType
      : current.promoDiscountType || 'percent',
    promoAllowedCountries: req.body?.promoAllowedCountries !== undefined
      ? [...new Set(req.body.promoAllowedCountries.map(countryCode => String(countryCode).trim().toUpperCase()))]
      : current.promoAllowedCountries || [],
    updatedAt: new Date().toISOString()
  };
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'storePages')) {
    try {
      updated.storePages = normalizeStorePages(req.body.storePages);
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      throw error;
    }
  }
  if (Object.hasOwn(req.body || {}, 'shippingZones')) {
    try {
      updated.shippingZones = normalizeShippingZones(req.body.shippingZones);
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      throw error;
    }
  }
  (await writeData(STORE_SETTINGS_FILE, updated));
  (await logActivity('settings', 'Store settings updated', `Store: ${updated.storeName || 'TiwloMart'} • Theme: ${updated.activeTheme || 'TiwiMart'}`));
  const { paymentProviderCredentials, ...safeSettings } = updated;
  res.json(safeSettings);
});

router.post('/store/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo image file uploaded' });
    }
    const logoUrl = await persistStoreImageUpload(req, 'store_logo');
    const current = (await readData(STORE_SETTINGS_FILE, {}));
    current.storeLogo = logoUrl;
    current.updatedAt = new Date().toISOString();
    (await writeData(STORE_SETTINGS_FILE, current));
    (await logActivity('settings', 'Store logo updated', `New logo uploaded: ${req.file.originalname}`));
    res.json({ success: true, logoUrl, message: 'Store logo uploaded successfully' });
  } catch (err) {
    console.error('Logo upload error:', err);
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch((cleanupError) => {
      console.error('[StoreUpload] Could not remove temporary logo:', cleanupError.message);
    });
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to upload logo image' });
  }
});

router.post('/store/upload-favicon', upload.single('favicon'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No favicon image file uploaded' });
    }
    const faviconUrl = await persistStoreImageUpload(req, 'store_favicon');
    const current = (await readData(STORE_SETTINGS_FILE, {}));
    current.storeFavicon = faviconUrl;
    current.updatedAt = new Date().toISOString();
    (await writeData(STORE_SETTINGS_FILE, current));
    (await logActivity('settings', 'Store favicon updated', `New favicon uploaded: ${req.file.originalname}`));
    res.json({ success: true, faviconUrl, message: 'Store favicon uploaded successfully' });
  } catch (err) {
    console.error('Favicon upload error:', err);
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch((cleanupError) => {
      console.error('[StoreUpload] Could not remove temporary favicon:', cleanupError.message);
    });
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to upload favicon image' });
  }
});

router.post('/store/upload-banner', upload.single('banner'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No banner image file uploaded' });
    }
    const bannerUrl = await persistStoreImageUpload(req, 'store_banner');
    res.json({ success: true, bannerUrl, message: 'Banner image uploaded successfully' });
  } catch (err) {
    console.error('Banner upload error:', err);
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch((cleanupError) => {
      console.error('[StoreUpload] Could not remove temporary banner:', cleanupError.message);
    });
    res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to upload banner image' });
  }
});

// ==========================================
// SUBSCRIPTION & PLANS
// ==========================================
const DEFAULT_SUBSCRIPTION = {
  planId: 'free',
  planName: 'Free Starter',
  price: 0,
  billingCycle: 'monthly',
  productLimit: 50,
  warehouseLimit: 1,
  hasCustomDomain: false,
  subdomain: null,
  customDomain: null,
  activatedAt: null,
  status: 'active'
};

const PLAN_CATALOG = {
  free: { planId: 'free', planName: 'Free Starter', price: 0, productLimit: 50, warehouseLimit: 1, hasCustomDomain: false },
  growth: { planId: 'growth', planName: 'Growth Retailer', price: 19, productLimit: 500, warehouseLimit: 2, hasCustomDomain: true },
  pro: { planId: 'pro', planName: 'Pro Business', price: 49, productLimit: 5000, warehouseLimit: 5, hasCustomDomain: true },
  enterprise: { planId: 'enterprise', planName: 'Enterprise VIP', price: 129, productLimit: 999999, warehouseLimit: 99, hasCustomDomain: true }
};

router.get('/subscription', async (req, res) => {
  const sub = (await readData(SUBSCRIPTION_FILE, DEFAULT_SUBSCRIPTION));
  const products = (await readData(PRODUCTS_FILE, []));
  const storeSettings = (await readData(STORE_SETTINGS_FILE, {}));

  const currentProducts = products.length;
  const productLimit = sub.productLimit || 50;
  const usagePercent = Math.min(100, Math.round((currentProducts / productLimit) * 100));
  const remainingQuota = Math.max(0, productLimit - currentProducts);
  const isLimitReached = currentProducts >= productLimit;

  const cleanStoreName = (storeSettings.storeName || req.activeUser?.storeName || 'store').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dynamicSubdomain = `${cleanStoreName || 'store'}.${PLATFORM_CONFIG.storeDomain}`;

  res.json({
    ...sub,
    subdomain: sub.subdomain || dynamicSubdomain,
    currentProducts,
    productLimit,
    usagePercent,
    remainingQuota,
    isLimitReached
  });
});

router.post('/subscription/upgrade', async (req, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;
    const planInfo = PLAN_CATALOG[planId];
    if (!planInfo) {
      return res.status(400).json({ error: 'Invalid subscription plan selected' });
    }

    const currentSub = (await readData(SUBSCRIPTION_FILE, DEFAULT_SUBSCRIPTION));
    const storeSettings = (await readData(STORE_SETTINGS_FILE, {}));
    const cleanStoreName = (storeSettings.storeName || req.activeUser?.storeName || 'store').toLowerCase().replace(/[^a-z0-9]/g, '');

    const updated = {
      ...currentSub,
      planId: planInfo.planId,
      planName: planInfo.planName,
      price: billingCycle === 'annual' ? Math.round(planInfo.price * 0.8) : planInfo.price,
      billingCycle,
      productLimit: planInfo.productLimit,
      warehouseLimit: planInfo.warehouseLimit,
      hasCustomDomain: planInfo.hasCustomDomain,
      subdomain: currentSub.subdomain || `${cleanStoreName || 'store'}.${PLATFORM_CONFIG.storeDomain}`,
      updatedAt: new Date().toISOString()
    };

    (await writeData(SUBSCRIPTION_FILE, updated));
    (await logActivity('subscription', `Plan upgraded to ${planInfo.planName}`, `Billing: ${billingCycle}`));

    const products = (await readData(PRODUCTS_FILE, []));
    const currentProducts = products.length;
    const usagePercent = Math.min(100, Math.round((currentProducts / updated.productLimit) * 100));
    const remainingQuota = Math.max(0, updated.productLimit - currentProducts);

    res.json({
      success: true,
      subscription: {
        ...updated,
        currentProducts,
        usagePercent,
        remainingQuota,
        isLimitReached: currentProducts >= updated.productLimit
      },
      message: `Successfully switched to ${planInfo.planName}`
    });
  } catch (err) {
    console.error('Subscription upgrade error:', err);
    res.status(500).json({ error: 'Failed to process subscription upgrade' });
  }
});

export default router;
