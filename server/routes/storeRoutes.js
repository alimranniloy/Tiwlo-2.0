import express from 'express';
import multer from 'multer';
import fs from 'fs';
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
  SUBSCRIPTION_FILE
} from '../db/storeDataAdapter.js';
import {
  contentSafetyMiddleware,
  checkAssetScope,
  recordViolation,
  scanAndSanitizeImage
} from '../security/index.js';
import { PaymentSecurity } from '../security/cryptoSecurity.js';
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
import { calculatePromotionDiscount } from './promotionHelpers.js';
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  normalizePaymentProviderConfiguration,
  PAYMENT_PROVIDER_DEFINITIONS,
  toPublicPaymentProvider
} from './paymentProviderHelpers.js';
import {
  normalizeStorefrontAddress,
  normalizeShippingZones,
  quoteShipping
} from './shippingHelpers.js';
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
const CURRENCY_SYMBOLS = Object.freeze({
  BDT: '৳',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  USD: '$'
});

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
      const [products, categories, storedSettings] = await Promise.all([
        readData(PRODUCTS_FILE, [], store.tiwiId),
        readData(CATEGORIES_FILE, [], store.tiwiId),
        readData(STORE_SETTINGS_FILE, {}, store.tiwiId)
      ]);
      const settings = Object.fromEntries([
        'storeName', 'storeTagline', 'storeTitle', 'storeDescription',
        'storeLogo', 'storeFavicon', 'activeTheme', 'themeColor',
        'themeColorPreset', 'themeMode', 'contactEmail', 'contactPhone',
        'storeAddress', 'storeCity', 'storeCountry', 'storePostalCode',
        'currency', 'currencySymbol', 'bannerSlidingSpeed', 'heroBanners',
        'taxRate', 'shippingFlatRate', 'freeShippingThreshold', 'shippingZones',
        'promoActive', 'promoCode', 'promoDiscountPercent'
      ].filter(key => storedSettings?.[key] !== undefined)
        .map(key => [key, storedSettings[key]]));
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
        products: products.map(product => ({
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          category: product.category,
          description: product.description,
          image: product.image,
          images: product.images,
          status: product.status,
          stock: product.stock
        })),
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

router.put('/store/payment-providers/:provider', async (req, res) => {
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
    const promotion = calculatePromotionDiscount(settings, req.body?.code, subtotal);
    if (!promotion.valid) {
      return res.status(400).json({ error: 'This promotion code is invalid or no longer active.' });
    }
    return res.json(promotion);
  } catch (error) {
    console.error('Failed to validate promotion code:', error);
    return res.status(500).json({ error: 'Could not validate this promotion code.' });
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
    const quote = quoteShipping(settings, req.body?.country, subtotal);
    if (!quote.available) return res.status(422).json({ error: 'This store does not ship to the selected country.' });
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
    unit
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

  if (!name || !sku) {
    return res.status(400).json({ error: 'Name and SKU are required' });
  }

  const existingSku = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
  if (existingSku) {
    return res.status(400).json({ error: 'A product with this SKU already exists' });
  }

  const { valid: stockIsValid, stock: stockVal } = validateStock(stock, 0);
  if (!stockIsValid) {
    return res.status(400).json({ error: 'Stock must be a valid non-negative whole number.' });
  }
  const minStockVal = minStock === undefined ? 20 : getMinStock({ minStock });
  const autoStatus = getStockStatus({ stock: stockVal, minStock: minStockVal });
  const { valid: priceIsValid, price: parsedPrice } = validateSellingPrice(price);
  if (!priceIsValid) {
    return res.status(400).json({ error: 'Selling price must be a valid non-negative amount' });
  }

  const newProduct = {
    id: `prod-${Date.now()}`,
    name,
    sku,
    barcode: barcode || `BC-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    category: category || '',
    subCategory: subCategory || '',
    stock: stockVal,
    minStock: minStockVal,
    price: parsedPrice,
    costPrice: parseFloat(costPrice) || 0,
    status: autoStatus,
    location: location || 'Main Warehouse',
    supplierId: supplierId || '',
    supplierName: supplierName || '',
    image: image || (Array.isArray(images) && images[0]) || '',
    images: Array.isArray(images) && images.length ? images : (image ? [image] : []),
    description: description || '',
    brand: brand || '',
    unit: unit || 'Pcs',
    sold: 0,
    revenue: 0,
    growth: '+0%',
    createdAt: new Date().toISOString()
  };

  products.unshift(newProduct);
  (await writeData(PRODUCTS_FILE, products));

  (await logActivity('product', 'New product added', `${name} (${sku}) - Stock: ${stockVal}`));
  res.status(201).json(newProduct);
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
    unit
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

  if (sku && sku.toLowerCase() !== existing.sku.toLowerCase()) {
    const existingSku = products.find(p => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== id);
    if (existingSku) {
      return res.status(400).json({ error: 'A product with this SKU already exists' });
    }
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

  const updatedProduct = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    sku: sku !== undefined ? sku : existing.sku,
    barcode: barcode !== undefined ? barcode : existing.barcode,
    category: category !== undefined ? category : existing.category,
    subCategory: subCategory !== undefined ? subCategory : existing.subCategory,
    stock: stockVal,
    minStock: minStockVal,
    price: parsedPrice,
    costPrice: costPrice !== undefined ? parseFloat(costPrice) : existing.costPrice,
    status: autoStatus,
    location: location !== undefined ? location : existing.location,
    supplierId: supplierId !== undefined ? supplierId : existing.supplierId,
    supplierName: supplierName !== undefined ? supplierName : existing.supplierName,
    image: image !== undefined ? image : existing.image,
    images: images !== undefined ? images : existing.images,
    description: description !== undefined ? description : existing.description,
    brand: brand !== undefined ? brand : existing.brand,
    unit: unit !== undefined ? unit : existing.unit,
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
  const totalUnits = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);
  const totalCostValuation = products.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.costPrice) || ((Number(p.price) || 0) * 0.5))), 0);
  const potentialProfit = totalRetailValuation - totalCostValuation;

  const lowStock = products.filter(isLowStock);
  const outOfStock = products.filter(p => getStockStatus(p) === 'Out of Stock');

  res.json({
    totalProducts: products.length,
    totalUnits,
    totalRetailValuation: Math.round(totalRetailValuation),
    totalCostValuation: Math.round(totalCostValuation),
    potentialProfit: Math.round(potentialProfit),
    marginPercent: totalRetailValuation > 0 ? Math.round((potentialProfit / totalRetailValuation) * 100) : 0,
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
  const { supplierId, supplierName, items, notes, expectedDelivery } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'At least one item is required for purchase order' });
  }
  if (items.some(item => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0)) {
    return res.status(400).json({ error: 'Each purchase item needs a positive whole quantity and a valid unit cost' });
  }

  let totalAmount = 0;
  const enrichedItems = items.map(item => {
    const qty = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const itemTotal = qty * unitCost;
    totalAmount += itemTotal;

    const prod = products.find(p => p.id === item.productId);
    return {
      productId: item.productId,
      productName: prod ? prod.name : (item.productName || 'General Item'),
      sku: prod ? prod.sku : (item.sku || 'SKU-000'),
      quantity: qty,
      unitCost,
      total: itemTotal
    };
  });

  const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

  const newPO = {
    id: `po-${Date.now()}`,
    poNumber,
    supplierId: supplierId || '',
    supplierName: supplierName || 'Global Supplier',
    date: new Date().toISOString(),
    status: 'Pending',
    paymentStatus: 'Unpaid',
    items: enrichedItems,
    totalAmount: Math.round(totalAmount * 100) / 100,
    expectedDelivery: expectedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: notes || 'Standard restocking order'
  };

  purchases.unshift(newPO);
  (await writeData(PURCHASES_FILE, purchases));

  (await logActivity('purchase', 'Purchase order created', `${poNumber} • $${totalAmount.toFixed(2)} (${newPO.supplierName})`));

  res.status(201).json(newPO);
});

router.put('/purchases/:id', async (req, res) => {
  const purchases = (await readData(PURCHASES_FILE, []));
  const products = (await readData(PRODUCTS_FILE, []));
  const { id } = req.params;
  const index = purchases.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Purchase order not found' });

  const existing = purchases[index];
  const { status, paymentStatus, notes } = req.body;

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
    paymentStatus: paymentStatus || existing.paymentStatus,
    notes: notes !== undefined ? notes : existing.notes,
    updatedAt: new Date().toISOString()
  };

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

router.delete('/purchases/:id', async (req, res) => {
  const purchases = (await readData(PURCHASES_FILE, []));
  const { id } = req.params;
  const index = purchases.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Purchase order not found' });

  const [deleted] = purchases.splice(index, 1);
  (await writeData(PURCHASES_FILE, purchases));

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

router.post('/sales', async (req, res) => {
  const sales = (await readData(SALES_FILE, []));
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

  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one item is required to create a sale' });
  }

  let storefrontAddress = null;
  if (isPublicStorefrontOrder) {
    try {
      storefrontAddress = normalizeStorefrontAddress(req.body?.shippingAddress);
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: error.message });
      throw error;
    }
  }

  if (isPublicStorefrontOrder &&
      (!String(customerName || '').trim() || !String(customerPhone || '').trim())) {
    return res.status(400).json({ error: 'Name, phone, and delivery address are required for storefront orders.' });
  }
  if (isPublicStorefrontOrder) {
    const normalizedPhone = normalizePhone(customerPhone);
    if (String(customerName).trim().length > 120 || normalizedPhone.length < 7 || normalizedPhone.length > 15 ||
        (customerEmail && (String(customerEmail).length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)))) {
      return res.status(400).json({ error: 'Enter valid customer contact details and a delivery address.' });
    }
  }

  if (isPublicStorefrontOrder && paymentMethod !== 'Cash on Delivery (COD)') {
    return res.status(400).json({ error: 'Online checkout is not available for this store yet. Select Cash on Delivery.' });
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

  let subtotal = 0;
  const enrichedItems = [];

  const requestedQuantities = new Map();
  for (const item of items) {
    const qty = Number(item.quantity);
    const prod = products.find(p => p.id === item.productId || p.id === item.id);
    if (!Number.isInteger(qty) || qty <= 0) {
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
    const unitPrice = Number(prod.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: `Invalid price configured for ${prod.name}` });
    }
    const itemTotal = parseFloat((qty * unitPrice).toFixed(2));
    subtotal += itemTotal;

    prod.stock = Number(prod.stock || 0) - qty;
    prod.sold = Number(prod.sold || 0) + qty;
    prod.revenue = parseFloat((Number(prod.revenue || 0) + itemTotal).toFixed(2));
    prod.status = getStockStatus(prod);

    enrichedItems.push({
      productId: item.productId || item.id,
      productName: prod ? prod.name : (item.productName || 'Store Product'),
      sku: prod ? prod.sku : (item.sku || 'SKU-000'),
      quantity: qty,
      unitPrice,
      total: itemTotal,
      image: prod.image || prod.images?.[0] || ''
    });
  }

  subtotal = parseFloat(Number(subtotal).toFixed(2));
  const storeSettings = (await readData(STORE_SETTINGS_FILE, {}, tiwiId));
  const shippingQuote = isPublicStorefrontOrder
    ? quoteShipping(storeSettings, storefrontAddress.country, subtotal)
    : null;
  if (isPublicStorefrontOrder && !shippingQuote.available) {
    return res.status(422).json({ error: 'This store does not ship to the selected country.' });
  }
  if (isPublicStorefrontOrder && shippingQuote.codEnabled === false) {
    return res.status(400).json({ error: 'Cash on Delivery is unavailable for this delivery zone.' });
  }
  const configuredTaxRate = storeSettings?.taxRate != null && String(storeSettings.taxRate).trim() !== ''
    ? Number(storeSettings.taxRate)
    : NaN;
  const taxRate = Number.isFinite(configuredTaxRate) && configuredTaxRate >= 0 ? configuredTaxRate / 100 : 0;
  const promotion = isPublicStorefrontOrder
    ? calculatePromotionDiscount(storeSettings, req.body?.promoCode, subtotal)
    : null;
  if (isPublicStorefrontOrder && req.body?.promoCode && !promotion.valid) {
    return res.status(400).json({ error: 'This promotion code is invalid or no longer active.' });
  }
  const requestedDiscount = isPublicStorefrontOrder
    ? promotion?.discountAmount || 0
    : Number(discount);
  const discountAmount = Number.isFinite(requestedDiscount) ? Math.min(subtotal, Math.max(0, requestedDiscount)) : 0;
  const tax = parseFloat(Math.max(0, (subtotal - discountAmount) * taxRate).toFixed(2));
  let shipping = isPublicStorefrontOrder && Number.isFinite(shippingQuote.amount)
    ? shippingQuote.amount
    : 0;
  shipping = parseFloat(shipping.toFixed(2));
  const totalAmount = parseFloat((subtotal - discountAmount + tax + shipping).toFixed(2));
  const storeCurrencyValue = req.activeStore?.currency || storeSettings?.currency || req.activeUser?.currency || 'USD';
  const orderCurrency = String(storeCurrencyValue).match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (customerId && !isPublicStorefrontOrder) {
    const custIndex = customers.findIndex(c => c.id === customerId);
    if (custIndex !== -1) {
      customers[custIndex].totalOrders = (customers[custIndex].totalOrders || 0) + 1;
      customers[custIndex].totalSpent = parseFloat(((customers[custIndex].totalSpent || 0) + totalAmount).toFixed(2));
      (await writeData(CUSTOMERS_FILE, customers, tiwiId));
    }
  }

  const newSale = {
    id: `inv-${Date.now()}`,
    invoiceNumber,
    customerId: isPublicStorefrontOrder ? '' : customerId || '',
    customerName: customerName || 'Walk-in Customer',
    customerPhone: isPublicStorefrontOrder ? customerPhone || '' : undefined,
    customerEmail: isPublicStorefrontOrder ? customerEmail || '' : undefined,
    deliveryAddress: isPublicStorefrontOrder ? storefrontAddress.deliveryAddress : undefined,
    shippingAddress: isPublicStorefrontOrder ? {
      street: storefrontAddress.street,
      city: storefrontAddress.city,
      region: storefrontAddress.region,
      postalCode: storefrontAddress.postalCode,
      country: storefrontAddress.country
    } : undefined,
    date: new Date().toISOString(),
    items: enrichedItems,
    subtotal,
    tax,
    discount: discountAmount,
    promoCode: isPublicStorefrontOrder ? promotion?.code || '' : undefined,
    shipping,
    shippingZoneId: isPublicStorefrontOrder ? shippingQuote.zoneId : undefined,
    shippingCountry: isPublicStorefrontOrder ? storefrontAddress.country : undefined,
    shippingEstimateDays: isPublicStorefrontOrder && shippingQuote.zoneId
      ? { min: shippingQuote.minDeliveryDays, max: shippingQuote.maxDeliveryDays }
      : undefined,
    currency: orderCurrency,
    totalAmount,
    paymentMethod: paymentMethod || 'Cash',
    paymentToken: isPublicStorefrontOrder ? null : paymentToken || `pay_verified_${Date.now()}`,
    channel: isPublicStorefrontOrder ? 'storefront' : 'pos',
    paymentStatus: isPublicStorefrontOrder ? 'Pending' : 'Paid',
    status: isPublicStorefrontOrder ? 'Pending' : 'Completed',
    statusHistory: [{
      status: isPublicStorefrontOrder ? 'Pending' : 'Completed',
      at: new Date().toISOString()
    }],
    notes: notes || 'Point of Sale Transaction'
  };

  sales.unshift(newSale);
  await writeTenantData({ products, sales }, tiwiId);

  (await logActivity(
    'sale',
    isPublicStorefrontOrder ? 'New storefront order received' : 'New sale completed',
    `${invoiceNumber} • ${newSale.currency} ${totalAmount.toFixed(2)} (${newSale.customerName})`,
    tiwiId
  ));

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

  const validationError = validateOrderUpdate(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const hasUpdates = ['status', 'paymentStatus', 'courierService', 'trackingNumber', 'trackingUrl']
    .some(key => Object.hasOwn(req.body || {}, key));
  if (!hasUpdates) return res.status(400).json({ error: 'Provide an order status, payment status, courier, or tracking number to update.' });

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
  const updatedOrder = {
    ...order,
    status: nextStatus,
    paymentStatus: req.body.paymentStatus || order.paymentStatus || 'Pending',
    courierService: nextCourier,
    trackingNumber: nextTrackingNumber,
    trackingUrl: nextTrackingUrl,
    updatedAt,
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
    for (const item of order.items || []) {
      const product = products.find(entry => entry.id === item.productId);
      if (!product) continue;
      product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
      product.sold = Math.max(0, Number(product.sold || 0) - Number(item.quantity || 0));
      product.revenue = Math.max(0, Number((Number(product.revenue || 0) - Number(item.total || 0)).toFixed(2)));
      product.status = getStockStatus(product);
      product.updatedAt = updatedAt;
    }
    updates.products = products;
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

  if (!companyName) return res.status(400).json({ error: 'Company name is required' });

  const newSupplier = {
    id: `sup-${Date.now()}`,
    companyName,
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

  (await logActivity('supplier', 'New supplier onboarded', `${companyName} (${newSupplier.category})`));
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
  const numericSettings = ['taxRate', 'shippingFlatRate', 'freeShippingThreshold', 'promoDiscountPercent'];
  for (const key of numericSettings) {
    if (req.body?.[key] === undefined || req.body[key] === '') continue;
    const value = Number(req.body[key]);
    if (!Number.isFinite(value) || value < 0 || (['taxRate', 'promoDiscountPercent'].includes(key) && value > 100)) {
      return res.status(400).json({ error: `${key} must be a valid non-negative number${['taxRate', 'promoDiscountPercent'].includes(key) ? ' no greater than 100' : ''}.` });
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
    promoCode: 32
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
  if (req.body?.promoCode !== undefined && req.body.promoCode && !/^[A-Za-z0-9_-]+$/.test(req.body.promoCode.trim())) {
    return res.status(400).json({ error: 'Promotion code may contain only letters, numbers, hyphens, and underscores.' });
  }
  if (req.body?.promoActive === true && (!String(req.body.promoCode || '').trim() ||
      !Number.isFinite(Number(req.body.promoDiscountPercent)) || Number(req.body.promoDiscountPercent) <= 0)) {
    return res.status(400).json({ error: 'Set a promotion code and a discount greater than 0% before enabling it.' });
  }

  const current = (await readData(STORE_SETTINGS_FILE, {}));
  const updated = {
    ...current,
    ...req.body,
    paymentProviderCredentials: current.paymentProviderCredentials,
    paymentProviders: current.paymentProviders,
    currencyExchange: current.currencyExchange,
    storeName: req.body?.storeName !== undefined ? req.body.storeName.trim() : current.storeName,
    promoCode: req.body?.promoCode !== undefined ? req.body.promoCode.trim().toUpperCase() : current.promoCode,
    updatedAt: new Date().toISOString()
  };
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
