import express from 'express';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { getEcommerceCatalog, getEcommercePackageById, saveEcommerceCatalog } from '../db/packages.js';
import {
  getWelcomePromoSettings,
  saveWelcomePromoSettings,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  listPromoClaims
} from '../db/promotions.js';
import { SupportDB } from '../db/supportDb.js';
import {
  sendAccountDisabledEmail,
  sendAccountRestoredEmail,
  identityVerificationEmailNotifications
} from '../db/emailService.js';
import { RestoreSessions } from '../db/restoreSessions.js';
import { getPgPool, isPgActive, queryPg, recordPlatformBillingOrder } from '../db/postgres.js';
import { BillingDB } from '../db/billing.js';
import { deleteMedia } from '../db/mediaStorage.js';
import { purgeStoreMediaAssets, syncStoreLifecycleOnPlanChange } from '../db/storeLifecycle.js';
import { isStoreSubdomainAvailable, normalizeStoreSubdomain } from '../db/storeSubdomain.js';
import { identityVerificationEvidence } from '../db/identityVerificationEvidence.js';
import { identityReviewStore } from '../db/identityReviewStore.js';
import { scanAndNotifyExpiringDocuments } from '../security/identityVerificationEngine.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { requireRecentReauth } from '../security/recentReauth.js';
import { unblockUserAndSignals } from '../security/freeTierAbuseGuard.js';
import { formatTrend, getSalesPeriod } from './adminAnalytics.js';
import {
  computePlatformFinancialSummary,
  computeStoreTierBreakdown
} from './platformAccounting.js';
import { createAdminRiskRouter } from './adminRiskRoutes.js';
import { createAdminStaffRouter } from './adminStaffRoutes.js';
import { createAdminServerFleetRouter } from './adminServerFleetRoutes.js';
import { createAdminPlatformOpsRouter } from './adminPlatformOpsRoutes.js';
import { createAdminSupportRouter } from './adminSupportRoutes.js';
import { createAdminChatSystemRouter } from './adminChatSystemRoutes.js';
import { createAdminTelemetryRouter } from './adminTelemetryRoutes.js';
import { defaultTicketingService } from '../support/ticketingService.js';
import { enrichUsersWithRiskIntel, isSuperAdminAccount } from './identityRiskGraph.js';
import { getMarketUsdRates } from '../routes/marketCurrencyRates.js';
import { normalizeCurrencyCode, normalizeUsdRates } from '../routes/currencyHelpers.js';
import {
  addGoogleDriveServiceAccount,
  getPlatformStorageSettings,
  listGoogleDriveAccounts,
  setDriveStorageActive
} from './googleDriveStorage.js';
import { getStorageSyncStatus, startStorageSync } from '../db/mediaMigration.js';
import { getDefaultPlatformDnsRecords, PLATFORM_DNS_RECORD_TYPES } from '../dns/platformDnsRecords.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const router = express.Router();
const PICK_APPEAL_CATEGORY = 'PICK Account Appeal';
const PICK_APPEAL_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'REJECTED', 'RESOLVED']);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOAD_DIRS = [
  path.resolve(__dirname, '../../upload'),
  path.resolve(__dirname, '../uploads')
];

let cachedStaffSecurityService = null;
let lastStaffSecurityAttempt = 0;
async function loadStaffSecurityService() {
  if (cachedStaffSecurityService) return cachedStaffSecurityService;
  if (Date.now() - lastStaffSecurityAttempt < 5000) return null;
  lastStaffSecurityAttempt = Date.now();
  try {
    cachedStaffSecurityService = await import('./staffSecurityService.js');
    return cachedStaffSecurityService;
  } catch {
    return null;
  }
}

export const adminStaffRouter = createAdminStaffRouter({ requireAdmin, requireRecentReauth, getMasterDb: () => MasterDB });
export const adminRiskRouter = createAdminRiskRouter({ requireAdmin, requireRecentReauth });
export const adminFleetRouter = createAdminServerFleetRouter({ requireAdmin, requireRecentReauth });
export const adminPlatformOpsRouter = createAdminPlatformOpsRouter({ requireAdmin, requireRecentReauth });
export const adminSupportRouter = createAdminSupportRouter({ requireAdmin, requireRecentReauth });
export const adminChatSystemRouter = createAdminChatSystemRouter({ requireAdmin, requireRecentReauth });
export const adminTelemetryRouter = createAdminTelemetryRouter({ requireAdmin, requireRecentReauth });

// ---- Sub-router mounting (Staff/PIN, Identity Risk, Server Fleet, Platform Ops, Support Desk, Chat AI, Telemetry) ----
// Mounted before legacy routes so the platform (non-retail) handlers take precedence.
router.use(adminStaffRouter);
router.use(adminRiskRouter);
router.use('/fleet', adminFleetRouter);
router.use(adminPlatformOpsRouter);
router.use(adminSupportRouter);
router.use(adminChatSystemRouter);
router.use('/telemetry', adminTelemetryRouter);

function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.adminUser) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }
    if (isSuperAdminUser(req.adminUser)) return next();
    const staffSvc = await loadStaffSecurityService();
    if (staffSvc && typeof staffSvc.hasAdminPermission === 'function') {
      const allowed = staffSvc.hasAdminPermission(req.adminUser, req.adminProfile, permission);
      if (!allowed) {
        return res.status(403).json({
          error: 'You do not have permission to perform this action.',
          code: 'ADMIN_PERMISSION_DENIED',
          permission
        });
      }
    }
    return next();
  };
}

const DNS_HOST_TARGET = /^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*\.?$/i;
function validateDnsRecord(input = {}) {
  const name = String(input.name || '').trim().toLowerCase();
  const type = String(input.type || '').trim().toUpperCase();
  const content = String(input.content ?? '').trim();
  const ttl = Number(input.ttl ?? 300);
  const priority = type === 'MX' ? Number(input.priority ?? 10) : null;
  if (!name || name.length > 253 || !(name === '@' || name === '*' || /^[a-z0-9_*-]+(?:\.[a-z0-9_*-]+)*$/i.test(name))) {
    throw new Error('Enter a valid relative DNS name, such as @, www, or _dmarc.');
  }
  if (!PLATFORM_DNS_RECORD_TYPES.includes(type)) throw new Error('Choose a supported DNS record type.');
  if (!content || content.length > 4096 || /[\r\n\0]/.test(content)) throw new Error('Enter valid DNS record content.');
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86400) throw new Error('TTL must be between 60 and 86400 seconds.');
  if (type === 'A' && !isIPv4(content)) throw new Error('A records require an IPv4 address.');
  if (type === 'AAAA' && !isIPv6(content)) throw new Error('AAAA records require an IPv6 address.');
  if (['CNAME', 'MX', 'NS'].includes(type) && !DNS_HOST_TARGET.test(content)) throw new Error(`${type} records require a valid hostname.`);
  if (type === 'MX' && (!Number.isInteger(priority) || priority < 0 || priority > 65535)) throw new Error('MX priority must be between 0 and 65535.');
  return { name, type, content, ttl, priority };
}

router.get('/dns/records', requireAdmin, async (_req, res) => {
  try {
    const zone = PLATFORM_CONFIG.primaryDomain;
    const { rows } = await queryPg(
      `SELECT id, zone, name, type, content, ttl, priority, system_key AS "systemKey",
              is_system AS "isSystem", enabled, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM system_platform_dns_records WHERE zone = $1 ORDER BY name, type, priority NULLS FIRST, content`,
      [zone]
    );
    return res.json({ success: true, zone, records: rows, defaults: getDefaultPlatformDnsRecords() });
  } catch (error) {
    console.error('[Admin DNS] Could not load records:', error.message);
    return res.status(503).json({ error: 'Could not load DNS records.' });
  }
});

router.post('/dns/records', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const record = validateDnsRecord(req.body);
    const id = `dns_${randomUUID().replace(/-/g, '')}`;
    const zone = PLATFORM_CONFIG.primaryDomain;
    const { rows } = await queryPg(
      `INSERT INTO system_platform_dns_records
        (id, zone, name, type, content, ttl, priority, enabled, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$8) RETURNING *`,
      [id, zone, record.name, record.type, record.content, record.ttl, record.priority, req.adminUser.id]
    );
    res.status(201).json({ success: true, record: rows[0] });
  } catch (error) {
    const status = error.code === '23505' ? 409 : error.message.startsWith('Enter ') || error.message.startsWith('Choose ') || error.message.startsWith('TTL ') || error.message.startsWith('A ') || error.message.startsWith('AAAA ') || error.message.startsWith('MX ') || error.message.startsWith('CNAME ') || error.message.startsWith('NS ') ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Could not add DNS record.' : error.message });
  }
});

router.put('/dns/records/:id', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const record = validateDnsRecord(req.body);
    const { rows } = await queryPg(
      `UPDATE system_platform_dns_records SET name=$1, type=$2, content=$3, ttl=$4, priority=$5,
         enabled=TRUE, is_system=FALSE, updated_by=$6, updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 AND zone=$8 RETURNING *`,
      [record.name, record.type, record.content, record.ttl, record.priority, req.adminUser.id, req.params.id, PLATFORM_CONFIG.primaryDomain]
    );
    if (!rows[0]) return res.status(404).json({ error: 'DNS record not found.' });
    res.json({ success: true, record: rows[0] });
  } catch (error) {
    const status = error.code === '23505' ? 409 : 400;
    res.status(status).json({ error: error.message || 'Could not update DNS record.' });
  }
});

router.delete('/dns/records/:id', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const { rows } = await queryPg(
      `UPDATE system_platform_dns_records SET enabled=FALSE, is_system=FALSE, updated_by=$1,
         updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND zone=$3 RETURNING id`,
      [req.adminUser.id, req.params.id, PLATFORM_CONFIG.primaryDomain]
    );
    if (!rows[0]) return res.status(404).json({ error: 'DNS record not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin DNS] Could not delete record:', error.message);
    res.status(500).json({ error: 'Could not delete DNS record.' });
  }
});

router.get('/pick-account-appeals', requireAdmin, async (_req, res) => {
  try {
    const tickets = await SupportDB.getTickets();
    const appeals = tickets
      .filter((ticket) => ticket.category === PICK_APPEAL_CATEGORY)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return res.json({ success: true, appeals });
  } catch (error) {
    console.error('[Admin PICK Appeals] Could not load review requests:', error.message);
    return res.status(503).json({ error: 'Could not load PICK account review requests.' });
  }
});

router.patch('/pick-account-appeals/:id', requireAdmin, async (req, res) => {
  try {
    const status = typeof req.body?.status === 'string' ? req.body.status.toUpperCase() : '';
    if (!PICK_APPEAL_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Choose a supported account review status.' });
    }
    const resolutionNotes = req.body?.resolutionNotes === undefined
      ? ''
      : typeof req.body.resolutionNotes === 'string'
        ? req.body.resolutionNotes.trim()
        : null;
    if (resolutionNotes === null || resolutionNotes.length > 2000) {
      return res.status(400).json({ error: 'Enter a review note with at most 2000 characters.' });
    }
    if (status === 'REJECTED' && !resolutionNotes) {
      return res.status(400).json({ error: 'Add a reason before rejecting this request.' });
    }
    const ticket = await SupportDB.getTicketById(req.params.id);
    if (!ticket || ticket.category !== PICK_APPEAL_CATEGORY) {
      return res.status(404).json({ error: 'PICK account review request was not found.' });
    }
    const appeal = await SupportDB.updateTicket(ticket.id, {
      status,
      resolutionNotes,
      reviewedBy: req.adminUser.id,
      reviewedAt: new Date().toISOString()
    });
    return res.json({ success: true, appeal });
  } catch (error) {
    console.error('[Admin PICK Appeals] Could not update review request:', error.message);
    return res.status(503).json({ error: 'Could not update the PICK account review request.' });
  }
});

router.get('/storage/google-drive', requireAdmin, async (req, res) => {
  try {
    const [accounts, storage, sync] = await Promise.all([
      listGoogleDriveAccounts(),
      getPlatformStorageSettings(),
      getStorageSyncStatus()
    ]);
    res.json({ success: true, accounts, storage, sync });
  } catch (error) {
    console.error('[Admin Google Drive] Could not list account metadata:', error.message);
    res.status(503).json({ error: 'Could not load Google Drive accounts.' });
  }
});

router.post('/storage/google-drive', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const account = await addGoogleDriveServiceAccount(
      req.body?.credentials,
      req.body?.name,
      req.body?.rootFolderId
    );
    res.status(201).json({ success: true, account });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[Admin Google Drive] Could not store encrypted credentials:', error.message);
    res.status(503).json({ error: 'Could not save the Google Drive credentials.' });
  }
});

router.post('/storage/google-drive/:id/activate', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const sync = await getStorageSyncStatus();
    if (sync.status === 'running') return res.status(409).json({ error: 'Storage transfer is running; wait for it to finish.' });
    const storage = await setDriveStorageActive(req.params.id);
    res.json({ success: true, storage });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[Admin Google Drive] Could not verify/activate account:', error.message);
    res.status(503).json({ error: error.message || 'Could not activate Google Drive storage.' });
  }
});

router.post('/storage/sync/:direction', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const { direction } = req.params;
    const state = await getStorageSyncStatus();
    if (state.status === 'running') return res.status(409).json({ error: 'Storage transfer is already running.' });
    if (direction !== 'to_drive' && direction !== 'to_server') {
      return res.status(400).json({ error: 'Unknown storage transfer direction.' });
    }
    const sync = await startStorageSync(direction);
    res.status(202).json({ success: true, sync });
  } catch (error) {
    console.error('[Admin Storage] Could not start media sync:', error.message);
    res.status(503).json({ error: error.message || 'Could not start the media sync.' });
  }
});

// Middleware to verify Admin / Super Admin access
export function requireAdmin(req, res, next) {
  const token = req.cookies?.tiwlo_host_session ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : null) ||
    req.headers?.['x-session-token'];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }

  MasterDB.getSession(token, req).then(sessionData => {
    if (!sessionData || !sessionData.user) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }
    const user = sessionData.user;
    if (user.isBanned || (!isSuperAdminUser(user) && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }
    req.adminUser = user;
    if (isSuperAdminUser(user)) return next();
    // Optional per-staff IP whitelist: block immediately when configured and not matched.
    return loadStaffSecurityService().then(async (staffSvc) => {
      if (staffSvc && typeof staffSvc.enforceStaffIpForLogin === 'function') {
        const check = await staffSvc.enforceStaffIpForLogin(user, req);
        req.adminProfile = check?.profile || null;
        if (check && check.allowed === false) {
          return res.status(check.statusCode || 403).json({
            error: check.error || 'Your IP is not whitelisted',
            code: check.code || 'ADMIN_IP_NOT_ALLOWED'
          });
        }
      }
      return next();
    });
  }).catch(err => {
    console.error('[Admin Auth Error]', err);
    res.status(500).json({ error: 'Authentication check failed.' });
  });
}

function isSuperAdminUser(user) {
  return user?.role === 'super_admin' || isSuperAdminAccount(user);
}

// Helper to read Master DB safely
async function getMasterDataRaw() {
  return (await MasterDB.getMasterData());
}

// Helper to write Master DB safely
async function saveMasterDataRaw(data) {
  (await MasterDB.saveMasterData(data));
  return true;
}

// Helper to aggregate store metrics
async function getAggregatedStoreData() {
  const allStores = [];
  const allProducts = [];
  const allSales = [];
  const allCustomers = [];
  const allActivities = [];

  for (const store of (await TenantDB.getAllStoreData())) {
    const storeId = String(store.tiwiId || store.storeId || 'unknown-store');
    const storeName = String(store.storeName || store.store_settings?.storeName || 'Store');
    const currency = String(store.store_settings?.currency || 'USD ($)');
    allStores.push({
      id: store.id || storeId,
      tiwiId: storeId,
      ownerId: store.ownerId || null,
      storeName,
      subdomain: store.subdomain || store.store_settings?.subdomain || null,
      planId: store.planId || null,
      status: store.status || null,
      createdAt: store.createdAt || store.created_at || null
    });
    if (Array.isArray(store.products)) {
      allProducts.push(...store.products.map(product => ({ ...product, storeId, storeName, currency })));
    }
    if (Array.isArray(store.sales)) {
      allSales.push(...store.sales.map(sale => ({ ...sale, storeId, storeName, currency })));
    }
    if (Array.isArray(store.customers)) {
      allCustomers.push(...store.customers.map(customer => ({ ...customer, storeId })));
    }
    if (Array.isArray(store.activities)) {
      allActivities.push(...store.activities.map(activity => ({ ...activity, storeId, storeName })));
    }
  }
  return { allStores, allProducts, allSales, allCustomers, allActivities };
}

function getPeriodSales(sales, start, end) {
  return sales.filter(sale => {
    const timestamp = getSaleTimestamp(sale);
    return timestamp && timestamp >= start && timestamp < end;
  });
}

function getRevenue(sales) {
  return sales.filter(isPaidSale).reduce((total, sale) => total + getSaleAmount(sale), 0);
}

function metricTrend(current, previous) {
  return {
    trend: formatTrend(current, previous),
    period: 'vs. previous period',
    positive: current >= previous
  };
}

function formatRelativeTime(value, now = Date.now()) {
  const date = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(date)) return 'Time unavailable';
  const minutes = Math.max(0, Math.floor((now - date) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Calculate human-friendly uptime
function getFormattedUptime() {
  const uptimeSec = Math.floor(process.uptime());
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  if (days > 0) return `${days} days, ${hours} hours`;
  if (hours > 0) return `${hours} hours, ${minutes} mins`;
  return `${minutes} mins, ${uptimeSec % 60} secs`;
}

// GET /api/admin/overview
router.get('/overview', requireAdmin, async (req, res) => {
  try {
    const period = getSalesPeriod(String(req.query.range || '7days'));
    const { allProducts, allSales, allCustomers, allActivities } = (await getAggregatedStoreData());
    const periodSales = getPeriodSales(allSales, period.start, period.end);
    const previousSales = getPeriodSales(allSales, period.previousStart, period.previousEnd);
    const totalRevenue = getRevenue(periodSales);
    const previousRevenue = getRevenue(previousSales);
    const orderCount = periodSales.length;
    const previousOrderCount = previousSales.length;
    const totalCustomers = allCustomers.length;
    const periodCustomers = allCustomers.filter(customer => {
      const createdAt = new Date(customer.createdAt || customer.created_at || NaN);
      return Number.isFinite(createdAt.getTime()) && createdAt >= period.start && createdAt < period.end;
    }).length;
    const previousCustomers = allCustomers.filter(customer => {
      const createdAt = new Date(customer.createdAt || customer.created_at || NaN);
      return Number.isFinite(createdAt.getTime()) && createdAt >= period.previousStart && createdAt < period.previousEnd;
    }).length;
    const successfulOrders = periodSales.filter(isPaidSale);
    const currencySet = new Set(successfulOrders.map(sale => sale.currency).filter(Boolean));
    const hasMixedCurrencies = currencySet.size > 1;
    const currency = currencySet.size === 1 ? [...currencySet][0] : hasMixedCurrencies ? 'Mixed currencies' : 'USD ($)';

    const salesChart = period.bucketStarts.map((bucketStart, index) => {
      const bucketEnd = period.bucketStarts[index + 1] || period.end;
      const bucketSales = getPeriodSales(periodSales, bucketStart, bucketEnd);
      return {
        label: formatPeriodLabel(bucketStart, period.bucketUnit, bucketEnd),
        sales: hasMixedCurrencies ? null : getRevenue(bucketSales),
        orders: bucketSales.length
      };
    });

    const productCatalog = new Map(allProducts.map(product => [
      `${product.storeId}:${product.id}`,
      product
    ]));
    const productPerformance = new Map();
    successfulOrders.forEach((sale, saleIndex) => {
      const saleId = `${sale.storeId || 'store'}:${sale.id || sale.invoiceNumber || sale.invoiceNo || `sale-${saleIndex}`}`;
      for (const item of Array.isArray(sale.items) ? sale.items : []) {
        const productId = String(item.productId || item.id || item.productName || 'unknown');
        const productKey = `${sale.storeId}:${productId}`;
        const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        const amount = Number(item.total ?? item.lineTotal ?? Number(item.unitPrice || item.price || 0) * quantity);
        const product = productCatalog.get(`${sale.storeId}:${productId}`);
        const existing = productPerformance.get(productKey) || {
          name: item.productName || product?.name || 'Unnamed product',
          image: product?.image && !product.image.includes('unsplash.com') ? product.image : '/default-product.svg',
          orderIds: new Set(),
          revenue: 0
        };
        existing.orderIds.add(saleId);
        existing.revenue += Number.isFinite(amount) && amount >= 0 ? amount : 0;
        productPerformance.set(productKey, existing);
      }
    });
    const topProducts = [...productPerformance.values()]
      .sort((a, b) => hasMixedCurrencies
        ? b.orderIds.size - a.orderIds.size
        : b.revenue - a.revenue)
      .slice(0, 5)
      .map((product, index) => ({
        rank: index + 1,
        name: product.name,
        image: product.image,
        orders: product.orderIds.size,
        revenue: hasMixedCurrencies ? null : product.revenue
      }));

    const categoryRevenue = new Map();
    for (const sale of successfulOrders) {
      const items = Array.isArray(sale.items) ? sale.items : [];
      if (!items.length) {
        categoryRevenue.set('Uncategorized', (categoryRevenue.get('Uncategorized') || 0) + getSaleAmount(sale));
        continue;
      }
      for (const item of items) {
        const product = productCatalog.get(`${sale.storeId}:${String(item.productId || item.id)}`);
        const name = String(item.categoryName || item.category || product?.categoryName || product?.category || 'Uncategorized');
        const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        const amount = Number(item.total ?? item.lineTotal ?? Number(item.unitPrice || item.price || 0) * quantity);
        categoryRevenue.set(name, (categoryRevenue.get(name) || 0) + (Number.isFinite(amount) && amount >= 0 ? amount : 0));
      }
    }
    const categoryColors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
    const categoryTotal = [...categoryRevenue.values()].reduce((sum, value) => sum + value, 0);
    const sortedCategories = [...categoryRevenue.entries()].sort((a, b) => b[1] - a[1]);
    const visibleCategories = sortedCategories.slice(0, 5);
    if (sortedCategories.length > 5) {
      visibleCategories.push([
        'Other',
        sortedCategories.slice(5).reduce((sum, [, amount]) => sum + amount, 0)
      ]);
    }
    const revenueBreakdown = {
      total: hasMixedCurrencies ? null : totalRevenue,
      currency,
      categories: hasMixedCurrencies ? [] : visibleCategories
        .map(([name, amount], index) => ({
          name,
          amount,
          percentage: categoryTotal > 0 ? (amount / categoryTotal) * 100 : 0,
          color: categoryColors[index]
        }))
    };

    const recentActivities = allActivities
      .map((activity, index) => {
        const timestamp = activity.timestamp || activity.createdAt || activity.created_at;
        const time = new Date(timestamp || NaN);
        if (!Number.isFinite(time.getTime())) return null;
        const action = activity.action || activity.title || activity.type || 'Store activity';
        const type = String(activity.type || '').toLowerCase();
        return {
          id: `${activity.storeId || 'store'}:${activity.id || time.getTime()}:${index}`,
          title: String(action),
          target: String(activity.details || activity.target || activity.storeName || 'Store activity'),
          timeAgo: formatRelativeTime(time),
          timestamp: time.toISOString(),
          icon: type === 'sale' ? 'shopping-bag' : type === 'auth' ? 'user-plus' : 'activity'
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);

    const ecommerceOverview = {
      totalOrders: orderCount,
      pendingOrders: periodSales.filter(sale => String(sale.paymentStatus || sale.status || '').toLowerCase() === 'pending').length,
      completedOrders: successfulOrders.length,
      totalSales: hasMixedCurrencies ? null : totalRevenue,
      currency,
      topProducts
    };

    const cloudOverview = {
      providerConnected: false,
      totalServers: 0,
      activeServers: 0,
      totalStorage: null,
      bandwidthUsage: null,
      serverUsage: []
    };

    const { rows: databaseRows } = await queryPg('SHOW server_version');
    const systemInfo = {
      nodeVersion: process.version,
      database: `PostgreSQL ${databaseRows[0]?.server_version || 'version unavailable'}`,
      serverUptime: getFormattedUptime(),
      status: 'Application and database connected',
      operational: true
    };

    const revenueMetricTrend = metricTrend(totalRevenue, previousRevenue);
    const orderMetricTrend = metricTrend(orderCount, previousOrderCount);
    const customerMetricTrend = metricTrend(periodCustomers, previousCustomers);
    res.json({
      success: true,
      data: {
        metrics: {
          totalRevenue: { value: hasMixedCurrencies ? 'Mixed currencies' : `${currency === 'USD ($)' ? '$' : ''}${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, trend: hasMixedCurrencies ? '—' : revenueMetricTrend.trend, period: hasMixedCurrencies ? 'Cannot combine different currencies' : revenueMetricTrend.period, positive: hasMixedCurrencies ? false : revenueMetricTrend.positive },
          totalOrders: { value: orderCount.toLocaleString('en-US'), ...orderMetricTrend },
          totalCustomers: { value: totalCustomers.toLocaleString('en-US'), ...customerMetricTrend },
          activeCloudServers: { value: 'Not connected', trend: '—', period: 'Cloud provider unavailable', positive: false }
        },
        salesOverview: salesChart,
        revenueBreakdown,
        recentActivities,
        ecommerceOverview,
        cloudOverview,
        systemInfo
      }
    });
  } catch (err) {
    console.error('[Admin Overview Error]', err);
    res.status(503).json({ error: 'Failed to load current administrator metrics.' });
  }
});

// GET /api/admin/customers - E-commerce Merchants & Customers with real Store Counts
router.get('/customers', requireAdmin, async (req, res) => {
  try {
    const rawUsers = await MasterDB.getUsers();
    const requesterIsSuperAdmin = isSuperAdminUser(req.adminUser);
    const users = requesterIsSuperAdmin ? rawUsers : rawUsers.filter(u => !isSuperAdminUser(u));
    const { allStores: stores } = (await getAggregatedStoreData());
    const query = (req.query.q || req.query.search || '').trim().toLowerCase();
    const userIds = users.map(user => user.id);
    const [loginResult, locationResult] = userIds.length
      ? await Promise.all([
          queryPg(
            `SELECT user_id, MAX(created_at) AS last_login_at
             FROM system_sessions
             WHERE user_id = ANY($1::varchar[])
             GROUP BY user_id`,
            [userIds]
          ),
          queryPg(
            `SELECT DISTINCT ON (user_id)
                    user_id, location_source, formatted_address, area, captured_at
             FROM system_user_login_locations
             WHERE user_id = ANY($1::varchar[])
             ORDER BY user_id, captured_at DESC, id DESC`,
            [userIds]
          )
        ])
      : [{ rows: [] }, { rows: [] }];
    const loginByUser = new Map(loginResult.rows.map(row => [row.user_id, row.last_login_at]));
    const locationByUser = new Map(locationResult.rows.map(row => [row.user_id, row]));

    // Map each customer/store owner
    let customers = users.map(u => {
      // Find all stores belonging to this user
      const userStores = stores.filter(s =>
        (s.ownerId && s.ownerId === u.id) ||
        (s.tiwiId && s.tiwiId === u.tiwiId) ||
        (u.storeId && s.tiwiId === u.storeId)
      );

      const storeCount = userStores.length;
      const storeNames = userStores.map(s => s.storeName).filter(Boolean);

      return {
        id: u.id,
        tiwiId: u.tiwiId || u.storeId || '',
        name: u.name || u.storeName || 'Tiwlo User',
        email: u.email,
        avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
        role: u.role || 'owner',
        storeCount,
        stores: userStores.map(s => ({
          id: s.id,
          name: s.storeName,
          subdomain: s.subdomain,
          status: s.status || 'active',
          planId: s.planId || 'free',
          createdAt: s.createdAt
        })),
        storeNames,
        primaryStoreName: userStores[0]?.storeName || '—',
        subdomain: userStores[0]?.subdomain || u.subdomain || null,
        planName: u.planName || u.planId || 'Unknown',
        planId: u.planId || 'free',
        isBanned: !!u.isBanned,
        identityVerified: u.identityVerified === true,
        identityVerificationRequired: u.identityVerificationRequired === true,
        banReason: u.banReason || '',
        status: u.isBanned ? 'Suspended' : u.identityVerificationRequired && !u.identityVerified ? 'Identity required' : 'Active',
        createdAt: u.createdAt || null,
        lastLoginAt: loginByUser.get(u.id) || null,
        latestLocation: locationByUser.has(u.id) ? {
          source: locationByUser.get(u.id).location_source,
          address: locationByUser.get(u.id).formatted_address,
          area: locationByUser.get(u.id).area,
          capturedAt: locationByUser.get(u.id).captured_at
        } : null
      };
    });

    // Apply search filter if provided
    if (query) {
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(query) ||
        String(c.email || '').toLowerCase().includes(query) ||
        c.tiwiId.toLowerCase().includes(query) ||
        c.storeNames.some(sn => sn.toLowerCase().includes(query))
      );
    }

    // Sort by store count descending, then by joined date
    customers.sort((a, b) => b.storeCount - a.storeCount || new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      customers,
      total: customers.length,
      totalStores: stores.length
    });
  } catch (err) {
    console.error('[Admin Customers Error]', err);
    res.status(500).json({ error: 'Failed to retrieve customers.' });
  }
});

function roundCoord2(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLon = Number(lon1);
  const bLat = Number(lat2);
  const bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

function computeLocationTelemetry(captures = []) {
  const areaKeys = new Set();
  let gpsVerifiedCount = 0;
  let maxJumpKm = 0;
  let impossibleTravelFlag = false;

  const enrichedCaptures = captures.map((entry, idx) => {
    if (String(entry.location_source || '').toLowerCase() === 'gps') {
      gpsVerifiedCount += 1;
    }
    const areaKey =
      String(entry.area || entry.postal_code || '').trim().toLowerCase() ||
      (Number.isFinite(Number(entry.latitude)) && Number.isFinite(Number(entry.longitude))
        ? `${Number(entry.latitude).toFixed(1)},${Number(entry.longitude).toFixed(1)}`
        : '');
    if (areaKey) areaKeys.add(areaKey);

    let jumpKm = null;
    let deltaHours = null;
    let impossibleTravel = false;
    const prev = captures[idx + 1];
    if (prev) {
      jumpKm = haversineDistanceKm(entry.latitude, entry.longitude, prev.latitude, prev.longitude);
      const currMs = Date.parse(entry.captured_at);
      const prevMs = Date.parse(prev.captured_at);
      if (Number.isFinite(currMs) && Number.isFinite(prevMs)) {
        deltaHours = Math.round(Math.max(0, (currMs - prevMs) / 3600000) * 100) / 100;
      }
      if (jumpKm !== null && jumpKm > maxJumpKm) {
        maxJumpKm = jumpKm;
      }
      if (jumpKm !== null && jumpKm > 500 && deltaHours !== null && deltaHours <= 2) {
        impossibleTravel = true;
        impossibleTravelFlag = true;
      }
    }

    return {
      ...entry,
      jumpKm,
      deltaHours,
      impossibleTravel
    };
  });

  const totalCaptures = captures.length;
  const distinctAreasCount = areaKeys.size;
  const roundedMaxJumpKm = Math.round(maxJumpKm * 10) / 10;
  const multiCityFlag = distinctAreasCount > 1 || roundedMaxJumpKm >= 50;

  return {
    telemetry: {
      totalCaptures,
      distinctAreasCount,
      gpsVerifiedCount,
      approxIpCount: Math.max(0, totalCaptures - gpsVerifiedCount),
      multiCityFlag,
      maxJumpKm: roundedMaxJumpKm,
      impossibleTravelFlag
    },
    enrichedCaptures
  };
}

router.get('/user-locations', requireAdmin, requirePermission('manage_users_security'), async (req, res) => {
  try {
    const requesterIsSuperAdmin = isSuperAdminUser(req.adminUser);
    const searchQuery = String(req.query.q || '').trim().toLowerCase();
    const filterMode = ['all', 'gps', 'approx', 'multi', 'flagged'].includes(String(req.query.filter || '').toLowerCase())
      ? String(req.query.filter).toLowerCase()
      : 'all';
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));

    const result = await queryPg(
      `WITH all_locations AS (
         SELECT user_id, location_source, latitude, longitude, accuracy_meters,
                formatted_address, area, postal_code, plus_code, captured_at, id
         FROM system_user_login_locations
         UNION ALL
         SELECT id AS user_id, 'gps'::varchar(8) AS location_source,
                (address_verified_location->>'latitude')::double precision AS latitude,
                (address_verified_location->>'longitude')::double precision AS longitude,
                (address_verified_location->>'accuracyMeters')::double precision AS accuracy_meters,
                address_verified_location->>'formattedAddress' AS formatted_address,
                address_verified_location->>'area' AS area,
                address_verified_location->>'postalCode' AS postal_code,
                address_verified_location->>'plusCode' AS plus_code,
                address_verified_at AS captured_at, 0::bigint AS id
         FROM system_users
         WHERE address_verified_at IS NOT NULL
           AND address_verified_location IS NOT NULL
           AND (address_verified_location->>'latitude') IS NOT NULL
           AND (address_verified_location->>'longitude') IS NOT NULL
       ),
       ranked AS (
         SELECT u.id AS user_id, u.tiwi_id, u.name, u.email, u.role, u.avatar,
                l.location_source, l.latitude, l.longitude, l.accuracy_meters,
                l.formatted_address, l.area, l.postal_code, l.plus_code, l.captured_at,
                ROW_NUMBER() OVER (PARTITION BY l.user_id ORDER BY l.captured_at DESC, l.id DESC) AS rn
         FROM all_locations l
         JOIN system_users u ON u.id = l.user_id
       )
       SELECT user_id, tiwi_id, name, email, role, avatar,
              location_source, latitude, longitude, accuracy_meters,
              formatted_address, area, postal_code, captured_at
       FROM ranked
       WHERE rn <= 25
       ORDER BY captured_at DESC`
    );

    const byUser = new Map();
    for (const row of result.rows || []) {
      if (!requesterIsSuperAdmin && isSuperAdminUser(row)) continue;
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
      byUser.get(row.user_id).push(row);
    }

    const allUsers = [];
    for (const captures of byUser.values()) {
      const latest = captures[0];
      const { telemetry } = computeLocationTelemetry(captures);
      const maskedLat = roundCoord2(latest.latitude);
      const maskedLon = roundCoord2(latest.longitude);
      allUsers.push({
        user_id: latest.user_id,
        tiwi_id: latest.tiwi_id || '',
        name: latest.name,
        email: latest.email,
        avatar: latest.avatar,
        location_source: latest.location_source,
        latitude: maskedLat,
        longitude: maskedLon,
        approxCoords: { latitude: maskedLat, longitude: maskedLon },
        coordsMasked: true,
        accuracy_meters: latest.accuracy_meters,
        formatted_address: latest.formatted_address,
        area: latest.area,
        postal_code: latest.postal_code,
        plus_code: null,
        captured_at: latest.captured_at,
        distinctAreasCount: telemetry.distinctAreasCount,
        gpsVerifiedCount: telemetry.gpsVerifiedCount,
        approxIpCount: telemetry.approxIpCount,
        totalCaptures: telemetry.totalCaptures,
        multiCityFlag: telemetry.multiCityFlag,
        maxJumpKm: telemetry.maxJumpKm,
        impossibleTravelFlag: telemetry.impossibleTravelFlag
      });
    }

    allUsers.sort((a, b) => Date.parse(b.captured_at || 0) - Date.parse(a.captured_at || 0));

    const summary = {
      totalTracked: allUsers.length,
      gpsVerified: allUsers.filter(u => String(u.location_source || '').toLowerCase() === 'gps').length,
      approxIpOnly: allUsers.filter(u => String(u.location_source || '').toLowerCase() !== 'gps').length,
      multiCityOrAnomalies: allUsers.filter(u => u.multiCityFlag || u.impossibleTravelFlag).length,
      impossibleTravelCount: allUsers.filter(u => u.impossibleTravelFlag).length
    };

    let filtered = allUsers;
    if (searchQuery) {
      filtered = filtered.filter(u =>
        String(u.name || '').toLowerCase().includes(searchQuery) ||
        String(u.email || '').toLowerCase().includes(searchQuery) ||
        String(u.tiwi_id || '').toLowerCase().includes(searchQuery) ||
        String(u.user_id || '').toLowerCase().includes(searchQuery) ||
        String(u.area || '').toLowerCase().includes(searchQuery) ||
        String(u.formatted_address || '').toLowerCase().includes(searchQuery) ||
        String(u.postal_code || '').toLowerCase().includes(searchQuery)
      );
    }

    if (filterMode === 'gps') {
      filtered = filtered.filter(u => String(u.location_source || '').toLowerCase() === 'gps');
    } else if (filterMode === 'approx') {
      filtered = filtered.filter(u => String(u.location_source || '').toLowerCase() !== 'gps');
    } else if (filterMode === 'multi') {
      filtered = filtered.filter(u => u.multiCityFlag);
    } else if (filterMode === 'flagged') {
      filtered = filtered.filter(u => u.impossibleTravelFlag);
    }

    const totalFiltered = filtered.length;
    const pagedUsers = hasPagination
      ? filtered.slice((page - 1) * limit, page * limit)
      : filtered;

    recordSecurityEvent({
      eventType: 'admin.login_locations.listed',
      severity: 'info',
      userId: req.adminUser.id,
      subject: req.adminUser.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        resultCount: pagedUsers.length,
        totalFiltered,
        filter: filterMode,
        hasSearch: Boolean(searchQuery)
      }
    }).catch(auditError => {
      console.error('[Admin User Locations] Could not record list audit event:', auditError.message);
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      users: pagedUsers,
      total: totalFiltered,
      summary,
      ...(hasPagination ? { pagination: { page, limit, total: totalFiltered } } : {})
    });
  } catch (error) {
    console.error('[Admin User Locations] Could not list location records:', error.message);
    return res.status(503).json({ error: 'Could not load user location records.' });
  }
});

router.get('/user-locations/:userId', requireAdmin, requirePermission('manage_users_security'), async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const userResult = await queryPg(
      'SELECT id, tiwi_id, name, email, role, avatar FROM system_users WHERE id = $1',
      [targetUserId]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: 'User not found.' });
    if (isSuperAdminUser(userResult.rows[0]) && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Access restricted for Super Administrator accounts.' });
    }
    const { role: _hiddenRole, ...safeUser } = userResult.rows[0];

    const locationsResult = await queryPg(
      `WITH all_locations AS (
         SELECT user_id, location_source, latitude, longitude, accuracy_meters,
                formatted_address, area, postal_code, plus_code, captured_at, id
         FROM system_user_login_locations
         WHERE user_id = $1
         UNION ALL
         SELECT id AS user_id, 'gps'::varchar(8) AS location_source,
                (address_verified_location->>'latitude')::double precision AS latitude,
                (address_verified_location->>'longitude')::double precision AS longitude,
                (address_verified_location->>'accuracyMeters')::double precision AS accuracy_meters,
                address_verified_location->>'formattedAddress' AS formatted_address,
                address_verified_location->>'area' AS area,
                address_verified_location->>'postalCode' AS postal_code,
                address_verified_location->>'plusCode' AS plus_code,
                address_verified_at AS captured_at, 0::bigint AS id
         FROM system_users
         WHERE id = $1
           AND address_verified_at IS NOT NULL
           AND address_verified_location IS NOT NULL
           AND (address_verified_location->>'latitude') IS NOT NULL
           AND (address_verified_location->>'longitude') IS NOT NULL
       )
       SELECT location_source, latitude, longitude, accuracy_meters,
              formatted_address, area, postal_code, plus_code, captured_at
       FROM all_locations
       ORDER BY captured_at DESC, id DESC
       LIMIT 25`,
      [targetUserId]
    );

    const { telemetry, enrichedCaptures } = computeLocationTelemetry(locationsResult.rows || []);

    recordSecurityEvent({
      eventType: 'admin.login_locations.viewed',
      severity: telemetry.impossibleTravelFlag ? 'warning' : 'info',
      userId: req.adminUser.id,
      subject: req.adminUser.email,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        viewedUserId: targetUserId,
        resultCount: enrichedCaptures.length,
        impossibleTravelFlag: telemetry.impossibleTravelFlag
      }
    }).catch(auditError => {
      console.error('[Admin User Locations] Could not record access audit event:', auditError.message);
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      user: safeUser,
      locations: enrichedCaptures,
      telemetry
    });
  } catch (error) {
    console.error('[Admin User Locations] Could not load location history:', error.message);
    return res.status(503).json({ error: 'Could not load this user’s location history.' });
  }
});

router.get('/users/:id/identity-verification', requireAdmin, async (req, res) => {
  try {
    const user = await MasterDB.findUserByIdentifier(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const files = await identityVerificationEvidence.listForUser(user);
    return res.json({
      success: true,
      user: {
        id: user.id,
        tiwiId: user.tiwiId || user.storeId || '',
        name: user.name || user.storeName || 'Tiwlo user',
        email: user.email,
        identityVerified: user.identityVerified === true,
        identityVerificationRequired: user.identityVerificationRequired === true
      },
      files
    });
  } catch (error) {
    console.error('[Admin Identity Verification] Could not load evidence:', error.message);
    return res.status(503).json({ error: 'Identity verification records could not be loaded.' });
  }
});

router.get('/users/:id/identity-verification/media/:fileId', requireAdmin, async (req, res) => {
  try {
    const user = await MasterDB.findUserByIdentifier(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const file = await identityVerificationEvidence.readForUser(user, req.params.fileId);
    if (!file) return res.status(404).json({ error: 'Verification file not found.' });
    const filename = String(file.original_filename || 'identity-evidence')
      .replace(/[\r\n"]/g, '_')
      .slice(0, 180);
    res.set({
      'Cache-Control': 'private, no-store',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Type': file.content_type || 'application/octet-stream',
      'Content-Length': String(file.data.length),
      'Content-Disposition': `inline; filename="${filename}"`
    });
    return res.end(file.data);
  } catch (error) {
    console.error('[Admin Identity Verification] Could not read evidence:', error.message);
    return res.status(503).json({ error: 'The verification file could not be opened.' });
  }
});

router.delete('/users/:id/identity-verification/files', requireAdmin, async (req, res) => {
  try {
    const user = await MasterDB.findUserByIdentifier(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const deletedCount = await identityVerificationEvidence.deleteForUser(user);
    await recordSecurityEvent({
      eventType: 'admin.identity_evidence_deleted',
      severity: 'warning',
      userId: user.id,
      subject: user.email,
      details: { administrator: req.adminUser.email, deletedCount }
    });
    return res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('[Admin Identity Verification] Could not delete evidence:', error.message);
    return res.status(503).json({ error: 'Verification files could not be deleted.' });
  }
});

router.post('/users/:id/identity-verification/unverify', requireAdmin, async (req, res) => {
  try {
    const targetUser = await MasterDB.findUserByIdentifier(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (isSuperAdminUser(targetUser)) {
      return res.status(403).json({ error: 'Super Administrator identity status cannot be changed here.' });
    }
    if (targetUser.role === 'admin' && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Only a super administrator can change another administrator identity status.' });
    }
    if (!targetUser.identityVerified) {
      return res.status(409).json({ error: 'This account is not currently verified.' });
    }

    const updatedUser = await MasterDB.updateUser(targetUser.id, {
      identityVerified: false,
      identityVerificationRequired: true
    });
    if (!updatedUser) return res.status(404).json({ error: 'User not found.' });

    // Clear previous verification evidence & prior review records so the next verification starts clean
    try {
      await identityVerificationEvidence.deleteForUser(targetUser);
      await identityReviewStore.deleteByUserId(targetUser.id);
    } catch (cleanupErr) {
      console.warn('[Admin Identity Verification] Previous evidence cleanup warning:', cleanupErr.message);
    }

    await recordSecurityEvent({
      eventType: 'admin.identity_verification_revoked',
      severity: 'warning',
      userId: updatedUser.id,
      subject: updatedUser.email,
      details: { administrator: req.adminUser.email }
    });
    identityVerificationEmailNotifications.required({
      to: updatedUser.email,
      name: updatedUser.name || updatedUser.storeName || 'Tiwlo user'
    }).catch(error => console.error('[Identity Verification Required Email Error]', error.message));

    try {
      await MasterDB.revokeUserSessions(updatedUser.id);
    } catch (error) {
      console.error('[Admin Identity Verification] Could not revoke sessions after unverify:', error.message);
      return res.status(503).json({
        error: 'The account is now unverified and restricted, but existing sessions could not be signed out.'
      });
    }

    return res.json({
      success: true,
      message: `Identity verification was removed for ${updatedUser.name || updatedUser.email}.`,
      user: {
        id: updatedUser.id,
        identityVerified: false,
        identityVerificationRequired: true
      }
    });
  } catch (error) {
    console.error('[Admin Identity Verification] Could not change verification status:', error.message);
    return res.status(500).json({ error: 'Identity verification status could not be changed.' });
  }
});

router.post('/users/:id/identity-verification/require', requireAdmin, async (req, res) => {
  try {
    const targetUser = await MasterDB.findUserByIdentifier(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found in system.' });
    if (targetUser.isBanned) {
      return res.status(409).json({ error: 'Disabled accounts must be restored before identity verification can be required.' });
    }
    if (isSuperAdminUser(targetUser)) {
      return res.status(403).json({ error: 'Super Administrator accounts cannot be locked for identity verification.' });
    }
    if (targetUser.role === 'admin' && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Only a super administrator can require identity verification for another administrator.' });
    }
    if (targetUser.identityVerified) {
      return res.status(409).json({ error: 'This account has already completed identity verification.' });
    }
    if (targetUser.identityVerificationRequired) {
      return res.status(409).json({ error: 'Identity verification is already required for this account.' });
    }

    const updatedUser = await MasterDB.updateUser(targetUser.id, {
      identityVerificationRequired: true
    });
    if (!updatedUser) return res.status(404).json({ error: 'User not found in system.' });

    // Remove any stale prior ID evidence/review records when sending a fresh verification request
    try {
      await identityVerificationEvidence.deleteForUser(targetUser);
      await identityReviewStore.deleteByUserId(targetUser.id);
    } catch (cleanupErr) {
      console.warn('[Admin Identity Verification] Prior cleanup warning:', cleanupErr.message);
    }

    await recordSecurityEvent({
      eventType: 'admin.identity_verification_required',
      severity: 'warning',
      userId: updatedUser.id,
      subject: updatedUser.email,
      details: { administrator: req.adminUser.email }
    });

    identityVerificationEmailNotifications.required({
      to: updatedUser.email,
      name: updatedUser.name || updatedUser.storeName || 'Tiwlo user'
    }).catch(error => console.error('[Identity Verification Required Email Error]', error.message));

    try {
      await MasterDB.revokeUserSessions(updatedUser.id);
    } catch (error) {
      console.error('[Admin Identity Verification] Could not revoke existing sessions:', error.message);
      return res.status(503).json({
        error: 'Identity verification is required and account access is restricted, but existing sessions could not be signed out.'
      });
    }

    return res.json({
      success: true,
      message: `Identity verification is now required for ${updatedUser.name || updatedUser.email}.`,
      user: {
        id: updatedUser.id,
        tiwiId: updatedUser.tiwiId,
        identityVerified: false,
        identityVerificationRequired: true
      }
    });
  } catch (error) {
    console.error('[Admin Identity Verification] Could not require verification:', error);
    return res.status(500).json({ error: 'Could not require identity verification for this account.' });
  }
});

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc'
]);

function normalizeReviewDocumentType(docType) {
  const clean = String(docType || '').trim().toLowerCase();
  if (!clean) return null;
  return clean === 'aadhaar' ? 'other_document' : clean;
}

function formatDocumentTypeLabel(docType) {
  const clean = normalizeReviewDocumentType(docType);
  if (clean === 'passport') return 'Passport';
  if (clean === 'national_id') return 'National ID';
  if (clean === 'drivers_license') return "Driver's License";
  if (clean === 'other_document') return 'Other Document';
  return 'Identity Document';
}

async function safeRecordSecurityEvent(payload) {
  try {
    const pool = getPgPool();
    if (!isPgActive() && !pool?.query?.mock) return;
    await recordSecurityEvent(payload);
  } catch (error) {
    console.warn('[Admin Identity Review] Security event skipped:', error.message);
  }
}

async function safeFindReviewUser(userId) {
  if (!userId) return null;
  try {
    if (!isPgActive() && !MasterDB.findUserByIdentifier?.mock) return null;
    return await MasterDB.findUserByIdentifier(userId);
  } catch {
    return null;
  }
}

async function safeLoadStoresForReviews() {
  try {
    if (typeof MasterDB.listAllStores === 'function') {
      const stores = await MasterDB.listAllStores();
      return Array.isArray(stores) ? stores : [];
    }
    if (isPgActive() || MasterDB.getMasterData?.mock) {
      const master = await MasterDB.getMasterData();
      return Array.isArray(master?.stores) ? master.stores : [];
    }
  } catch {
    // Non-fatal fallback
  }
  return [];
}

async function safeLoadUserOrdersCount(userId, userStores = []) {
  const pool = getPgPool();
  if (pool && (isPgActive() || pool.query?.mock)) {
    const queries = [
      'SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1',
      'SELECT COUNT(*)::int AS count FROM system_orders WHERE user_id = $1',
      'SELECT COUNT(*)::int AS count FROM store_orders WHERE user_id = $1'
    ];
    for (const sql of queries) {
      try {
        const res = await pool.query(sql, [String(userId)]);
        const row = res?.rows?.[0];
        const rawCount = row?.count ?? row?.cnt ?? row?.total;
        if (rawCount !== undefined && rawCount !== null && Number.isFinite(Number(rawCount))) {
          return Number(rawCount);
        }
      } catch {
        // Table may not exist in current schema; try next non-fatally
      }
    }
  }

  if (isPgActive() && Array.isArray(userStores) && userStores.length > 0) {
    let total = 0;
    for (const store of userStores) {
      try {
        const storeId = store.tiwiId || store.id;
        if (!storeId) continue;
        const db = await TenantDB.getStoreDb(storeId);
        if (Array.isArray(db?.sales)) total += db.sales.length;
      } catch {
        // Non-fatal
      }
    }
    return total;
  }

  return 0;
}

function mergeEvidenceFiles(storedFiles = [], reviewFiles = []) {
  const byKey = new Map();
  for (const file of (Array.isArray(reviewFiles) ? reviewFiles : [])) {
    if (!file) continue;
    const key = String(file.id || file.storagePath || file.filename || file.originalFilename || randomUUID());
    byKey.set(key, {
      id: file.id || null,
      kind: file.kind || file.category || 'evidence',
      category: file.category || file.kind || 'evidence',
      label: file.label || file.name || 'Verification evidence',
      name: file.name || file.label || 'Verification evidence',
      filename: file.filename || file.originalFilename || 'evidence',
      originalFilename: file.originalFilename || file.filename || 'evidence',
      contentType: file.contentType || 'application/octet-stream',
      sizeBytes: Number(file.sizeBytes ?? file.size ?? 0),
      size: Number(file.size ?? file.sizeBytes ?? 0),
      storagePath: file.storagePath || null,
      createdAt: file.createdAt || null
    });
  }
  for (const file of (Array.isArray(storedFiles) ? storedFiles : [])) {
    if (!file) continue;
    const key = String(file.id || file.storagePath || file.originalFilename || file.filename || randomUUID());
    const prev = byKey.get(key) || {};
    byKey.set(key, {
      ...prev,
      id: file.id ?? prev.id ?? null,
      kind: file.kind || file.category || prev.kind || 'evidence',
      category: file.category || file.kind || prev.category || 'evidence',
      label: file.label || file.name || prev.label || 'Verification evidence',
      name: file.name || file.label || prev.name || 'Verification evidence',
      filename: file.filename || file.originalFilename || prev.filename || 'evidence',
      originalFilename: file.originalFilename || file.filename || prev.originalFilename || 'evidence',
      contentType: file.contentType || prev.contentType || 'application/octet-stream',
      sizeBytes: Number(file.sizeBytes ?? file.size ?? prev.sizeBytes ?? 0),
      size: Number(file.size ?? file.sizeBytes ?? prev.size ?? 0),
      storagePath: file.storagePath || prev.storagePath || null,
      createdAt: file.createdAt || prev.createdAt || null
    });
  }
  return [...byKey.values()];
}

function buildReviewRiskSummary(review, user, riskIntel, allReviews = []) {
  let riskScore = Number(riskIntel?.riskScore || 0);
  const flags = new Set(Array.isArray(riskIntel?.flags) ? riskIntel.flags : []);
  const riskSignals = new Set(
    Array.isArray(riskIntel?.matchedSignals)
      ? riskIntel.matchedSignals
      : (Array.isArray(riskIntel?.riskSignals) ? riskIntel.riskSignals : [])
  );

  const linkedAccounts = Array.isArray(riskIntel?.linkedAccounts) ? riskIntel.linkedAccounts : [];
  if (linkedAccounts.length > 0) {
    flags.add('MULTI_ACCOUNT_RING');
  }
  if (linkedAccounts.some(account => account?.isBanned)) {
    flags.add('BAN_EVASION_RISK');
    riskSignals.add('Linked Banned Account');
  }

  const email = String(user?.email || review.userEmail || '').trim().toLowerCase();
  const emailDomain = email.includes('@') ? email.split('@')[1] : '';
  if (emailDomain && DISPOSABLE_EMAIL_DOMAINS.has(emailDomain)) {
    flags.add('DISPOSABLE_EMAIL');
    riskSignals.add('Disposable Email Domain');
    riskScore = Math.min(100, Math.max(riskScore, 35));
  }

  const telemetry = review.metadata?.telemetry || {};
  const attestation = review.metadata?.attestation || {};
  if (
    telemetry.vpnDetected || telemetry.isVpn || telemetry.proxyDetected || telemetry.isProxy || telemetry.torDetected ||
    attestation.vpnDetected || attestation.proxyDetected
  ) {
    flags.add('VPN_OR_PROXY_NETWORK');
    riskSignals.add('VPN / Proxy Network');
    riskScore = Math.min(100, riskScore + 20);
  }

  const reviewTs = new Date(review.createdAt || 0).getTime();
  const sameUserRecentAttempts = Number.isFinite(reviewTs) && reviewTs > 0
    ? allReviews.filter(r =>
        String(r.userId) === String(review.userId) &&
        Math.abs(new Date(r.createdAt || 0).getTime() - reviewTs) <= 3600 * 1000
      ).length
    : 0;
  if (sameUserRecentAttempts >= 3 || Number(telemetry.attemptCount || 0) >= 3) {
    flags.add('RAPID_VERIFICATION_ATTEMPTS');
    riskSignals.add('Rapid Verification Attempts');
    riskScore = Math.min(100, riskScore + 15);
  }

  const riskLevel = riskScore >= 75
    ? 'critical'
    : (riskScore >= 50 ? 'high' : (riskScore >= 25 ? 'medium' : 'low'));

  return {
    riskScore,
    riskLevel,
    flags: [...flags],
    riskSignals: [...riskSignals]
  };
}

async function enrichIdentityReviews(reviews, { req, allReviewsForContext = reviews } = {}) {
  const viewerIsSuperAdmin = isSuperAdminUser(req.adminUser);
  const uniqueUserIds = [...new Set(reviews.map(r => String(r.userId)).filter(Boolean))];

  let knownUsers = [];
  try {
    if (isPgActive() || MasterDB.getUsers?.mock) {
      knownUsers = await MasterDB.getUsers();
    }
  } catch {
    knownUsers = [];
  }
  const usersById = new Map((Array.isArray(knownUsers) ? knownUsers : []).map(u => [String(u.id), u]));

  await Promise.all(
    uniqueUserIds.map(async (uid) => {
      if (usersById.has(uid)) return;
      const found = await safeFindReviewUser(uid);
      if (found) {
        usersById.set(uid, found);
      } else {
        const sample = reviews.find(r => String(r.userId) === uid);
        usersById.set(uid, {
          id: uid,
          tiwiId: sample?.tiwiId || '',
          name: sample?.userName || 'Tiwlo user',
          email: sample?.userEmail || '',
          role: 'owner'
        });
      }
    })
  );

  let riskByUserId = {};
  try {
    const riskResult = await enrichUsersWithRiskIntel([...usersById.values()], { viewerIsSuperAdmin });
    riskByUserId = riskResult?.riskByUserId || {};
  } catch (err) {
    console.warn('[Admin Identity Reviews] Risk enrichment fallback:', err.message);
  }

  const allStores = await safeLoadStoresForReviews();

  return Promise.all(
    reviews.map(async (review) => {
      const uid = String(review.userId);
      const user = usersById.get(uid) || null;
      const normalizedDocType = normalizeReviewDocumentType(review.documentType);

      let userStores = allStores.filter(s => s && (
        (s.ownerId && String(s.ownerId) === uid) ||
        (user?.storeId && (String(s.tiwiId) === String(user.storeId) || String(s.id) === String(user.storeId))) ||
        (user?.tiwiId && (String(s.tiwiId) === String(user.tiwiId) || String(s.id) === String(user.tiwiId))) ||
        (review.tiwiId && (String(s.tiwiId) === String(review.tiwiId) || String(s.id) === String(review.tiwiId)))
      ));

      if (userStores.length === 0 && (isPgActive() || MasterDB.getUserStores?.mock)) {
        try {
          const directStores = await MasterDB.getUserStores(uid);
          if (Array.isArray(directStores)) userStores = directStores;
        } catch {
          // Non-fatal
        }
      }

      const formattedStores = userStores.map(s => ({
        id: s.id || s.tiwiId,
        tiwiId: s.tiwiId || s.id,
        name: s.storeName || s.name || 'Store',
        subdomain: s.subdomain || null,
        planId: s.planId || null,
        status: s.status || null
      }));

      const ordersCount = await safeLoadUserOrdersCount(uid, formattedStores);
      const subscriptionPlan =
        user?.planName ||
        user?.planId ||
        review.metadata?.subscriptionPlan ||
        formattedStores[0]?.planId ||
        'free';

      let storedEvidence = [];
      try {
        const userForEvidence = {
          id: uid,
          tiwiId: user?.tiwiId || user?.storeId || review.tiwiId || uid
        };
        storedEvidence = await identityVerificationEvidence.listForUser(userForEvidence);
      } catch {
        storedEvidence = [];
      }

      const riskSummary = buildReviewRiskSummary(
        review,
        user,
        riskByUserId[uid] || user?.riskIntelligence || {},
        allReviewsForContext
      );

      return {
        ...review,
        metadata: {
          ...(review.metadata || {}),
          ...(Array.isArray(review.metadata?.duplicateLinkedAccounts)
            ? { duplicateLinkedAccounts: review.metadata.duplicateLinkedAccounts }
            : {})
        },
        documentType: normalizedDocType,
        documentTypeLabel: formatDocumentTypeLabel(normalizedDocType),
        user: user ? {
          id: user.id,
          tiwiId: user.tiwiId || user.storeId || review.tiwiId || '',
          name: user.name || user.storeName || review.userName || 'Tiwlo user',
          email: user.email || review.userEmail || '',
          planId: user.planId || 'free',
          planName: user.planName || user.planId || 'Free Starter',
          identityVerified: user.identityVerified === true,
          identityVerificationRequired: user.identityVerificationRequired === true,
          isBanned: user.isBanned === true
        } : null,
        riskSummary,
        stats: {
          storesCount: formattedStores.length,
          stores: formattedStores,
          ordersCount,
          subscriptionPlan
        },
        evidenceFiles: mergeEvidenceFiles(storedEvidence, review.evidenceFiles)
      };
    })
  );
}

// GET /api/admin/identity-reviews - List AI fallback & manual identity reviews with risk + account stats
router.get('/identity-reviews', requireAdmin, async (req, res) => {
  try {
    const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const allReviews = await identityReviewStore.listReviews({ status: 'all' });
    const scopedReviews = userIdFilter
      ? allReviews.filter(r => String(r.userId) === userIdFilter)
      : allReviews;
    const counts = {
      all: scopedReviews.length,
      pending_review: scopedReviews.filter(r => r.status === 'pending_review').length,
      accepted: scopedReviews.filter(r => r.status === 'accepted').length,
      declined: scopedReviews.filter(r => r.status === 'declined').length,
      permanently_closed: scopedReviews.filter(r => r.status === 'permanently_closed').length
    };

    let filteredReviews = await identityReviewStore.listReviews({
      status: req.query.status || 'all',
      search: req.query.q || req.query.search || ''
    });
    if (userIdFilter) {
      filteredReviews = filteredReviews.filter(r => String(r.userId) === userIdFilter);
    }

    const reviews = await enrichIdentityReviews(filteredReviews, {
      req,
      allReviewsForContext: allReviews
    });

    return res.json({ success: true, reviews, counts });
  } catch (error) {
    console.error('[Admin Identity Reviews] Could not list reviews:', error);
    return res.status(500).json({ error: 'Identity verification reviews could not be loaded.' });
  }
});

// POST /api/admin/identity-reviews/run-expiry-sweep - Automated 30-day document expiry alert & lock sweep
router.post('/identity-reviews/run-expiry-sweep', requireAdmin, async (req, res) => {
  try {
    const daysWindow = Math.max(1, Math.min(90, Number(req.body?.daysWindow) || 30));
    const result = await scanAndNotifyExpiringDocuments({ daysWindow });
    await safeRecordSecurityEvent({
      eventType: 'admin.identity_expiry_sweep_run',
      severity: 'info',
      userId: req.adminUser?.id || null,
      subject: req.adminUser?.email || null,
      details: { daysWindow, ...result }
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Admin Identity Expiry Sweep] Failed:', error.message);
    return res.status(503).json({ error: 'Document expiry sweep could not be completed.' });
  }
});

// GET /api/admin/identity-reviews/:id - Single enriched identity verification review
router.get('/identity-reviews/:id', requireAdmin, async (req, res) => {
  try {
    const review = await identityReviewStore.getReviewById(req.params.id);
    if (!review) {
      return res.status(404).json({
        error: 'Identity verification review not found.',
        code: 'REVIEW_NOT_FOUND'
      });
    }
    const [enriched] = await enrichIdentityReviews([review], { req });
    return res.json({ success: true, review: enriched });
  } catch (error) {
    console.error('[Admin Identity Review] Could not load review:', error);
    return res.status(500).json({ error: 'Identity verification review could not be loaded.' });
  }
});

// POST /api/admin/identity-reviews/:id/decision - Accept, decline, or permanently close a review
router.post('/identity-reviews/:id/decision', requireAdmin, async (req, res) => {
  try {
    const rawAction = String(req.body?.action || '').trim().toLowerCase();
    if (!['accept', 'decline', 'permanently_close', 'request_correction', 'sync_and_accept'].includes(rawAction)) {
      return res.status(400).json({
        error: 'Decision action must be accept, decline, request_correction, sync_and_accept, or permanently_close.',
        code: 'INVALID_REVIEW_ACTION'
      });
    }

    const mappedDecisionAction = rawAction === 'sync_and_accept'
      ? 'accept'
      : rawAction === 'request_correction'
        ? 'decline'
        : rawAction;

    let reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    if (rawAction === 'request_correction' && !reason.trim()) {
      reason = 'Your Tiwlo account name or date of birth did not match your submitted ID card. Please update your profile details during verification and re-submit.';
    }
    if (rawAction === 'sync_and_accept' && !reason.trim()) {
      reason = 'Account profile synced to verified ID document details and approved by administrator.';
    }
    const banUser = req.body?.banUser === true;
    const review = await identityReviewStore.decideReview({
      reviewId: req.params.id,
      action: mappedDecisionAction,
      reason,
      adminUser: req.adminUser,
      banUser
    });

    const user = await safeFindReviewUser(review.userId);
    const displayName = user?.name || user?.storeName || review.userName || 'Tiwlo user';
    const recipientEmail = user?.email || review.userEmail || null;

    if (mappedDecisionAction === 'accept') {
      if (user) {
        const acceptUpdates = {
          identityVerified: true,
          identityVerificationRequired: false
        };
        if (rawAction === 'sync_and_accept' && review.extractedData) {
          if (review.extractedData.fullName) acceptUpdates.name = String(review.extractedData.fullName).trim().slice(0, 120);
          if (review.extractedData.dateOfBirth && /^\d{4}-\d{2}-\d{2}/.test(String(review.extractedData.dateOfBirth))) {
            acceptUpdates.dateOfBirth = String(review.extractedData.dateOfBirth).slice(0, 10);
          }
        }
        await MasterDB.updateUser(user.id, acceptUpdates);
      }
      if (recipientEmail) {
        identityVerificationEmailNotifications.completed({
          to: recipientEmail,
          name: displayName
        }).catch(err => console.error('[Identity Verification Complete Email Error]', err.message));
      }
      await safeRecordSecurityEvent({
        eventType: rawAction === 'sync_and_accept' ? 'admin.identity_review_synced_accepted' : 'admin.identity_review_accepted',
        severity: 'info',
        userId: user?.id || review.userId,
        subject: recipientEmail,
        details: {
          reviewId: review.id,
          administrator: req.adminUser.email,
          reason: review.reviewReason || ''
        }
      });
    } else if (mappedDecisionAction === 'decline') {
      if (user) {
        await MasterDB.updateUser(user.id, {
          identityVerified: false,
          identityVerificationRequired: true
        });
      }
      if (recipientEmail) {
        identityVerificationEmailNotifications.required({
          to: recipientEmail,
          name: displayName,
          reason: review.reviewReason || ''
        }).catch(err => console.error('[Identity Verification Required Email Error]', err.message));
      }
      await safeRecordSecurityEvent({
        eventType: rawAction === 'request_correction' ? 'admin.identity_review_correction_requested' : 'admin.identity_review_declined',
        severity: 'warning',
        userId: user?.id || review.userId,
        subject: recipientEmail,
        details: {
          reviewId: review.id,
          administrator: req.adminUser.email,
          reason: review.reviewReason || ''
        }
      });
    } else if (mappedDecisionAction === 'permanently_close') {
      if (user) {
        const userUpdates = {
          identityVerified: false,
          identityVerificationRequired: true
        };
        if (banUser) {
          userUpdates.isBanned = true;
          userUpdates.banReason = review.reviewReason || 'Identity verification permanently closed.';
        }
        await MasterDB.updateUser(user.id, userUpdates);
      }
      if (recipientEmail) {
        identityVerificationEmailNotifications.required({
          to: recipientEmail,
          name: displayName,
          reason: review.reviewReason || 'Your verification case has been permanently closed.'
        }).catch(() => {});
      }
      await safeRecordSecurityEvent({
        eventType: 'admin.identity_review_permanently_closed',
        severity: 'warning',
        userId: user?.id || review.userId,
        subject: recipientEmail,
        details: {
          reviewId: review.id,
          administrator: req.adminUser.email,
          reason: review.reviewReason || ''
        }
      });
    }

    const normalizedDocType = normalizeReviewDocumentType(review.documentType);
    return res.json({
      success: true,
      review: {
        ...review,
        documentType: normalizedDocType,
        documentTypeLabel: formatDocumentTypeLabel(normalizedDocType)
      }
    });
  } catch (error) {
    if (error?.statusCode === 400 || error?.statusCode === 403 || error?.statusCode === 404) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    console.error('[Admin Identity Review] Could not record decision:', error);
    return res.status(500).json({ error: 'Identity verification decision could not be recorded.' });
  }
});

// GET /api/admin/users - Full System Users Management with strict 20 items/page pagination & search
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const allUsers = await MasterDB.getUsers();
    const requesterIsSuperAdmin = isSuperAdminUser(req.adminUser);
    const rawUsers = requesterIsSuperAdmin ? allUsers : allUsers.filter(u => !isSuperAdminUser(u));
    const { allStores: stores } = (await getAggregatedStoreData());
    const pickUsersResult = await queryPg(
      `SELECT pu.tiwlo_user_id, pu.registration_source,
              d.application_status AS delivery_application_status,
              d.vehicle_type AS delivery_vehicle_type,
              d.is_on_duty AS delivery_is_on_duty
       FROM pick.users pu
       LEFT JOIN pick.delivery_profiles d ON d.tiwlo_user_id = pu.tiwlo_user_id`
    );
    const registrationSources = new Map(
      pickUsersResult.rows.map(row => [row.tiwlo_user_id, row.registration_source])
    );
    const deliveryRegistrations = new Map(
      pickUsersResult.rows
        .filter(row => row.delivery_application_status)
        .map(row => [row.tiwlo_user_id, {
          status: row.delivery_application_status,
          vehicleType: row.delivery_vehicle_type,
          isOnDuty: row.delivery_is_on_duty === true
        }])
    );

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20)); // Strictly default 20
    const query = (req.query.q || req.query.search || '').trim().toLowerCase();
    const roleFilter = (req.query.role || 'all').toLowerCase();
    const statusFilter = (req.query.status || 'all').toLowerCase();

    // Map and sanitize users
    let sanitizedUsers = rawUsers.map(u => {
      const userStores = stores.filter(s =>
        (s.ownerId && s.ownerId === u.id) ||
        (s.tiwiId && s.tiwiId === u.tiwiId) ||
        (u.storeId && s.tiwiId === u.storeId)
      );

        const storeCount = userStores.length;
        const deliveryRegistration = deliveryRegistrations.get(u.id);

      return {
        id: u.id,
        tiwiId: u.tiwiId || u.storeId || '',
        name: u.name || u.storeName || 'System User',
        email: u.email,
        registrationSource: registrationSources.get(u.id) || 'tiwlo',
        deliveryRegistration: deliveryRegistration
          ? { ...deliveryRegistration, isOnDuty: deliveryRegistration.isOnDuty && !u.isBanned }
          : null,
        role: u.role || 'owner',
        planId: u.planId || 'free',
        planName: u.planName || u.planId || 'Unknown',
        storeCount,
        stores: userStores.map(s => ({ id: s.id, name: s.storeName, subdomain: s.subdomain })),
        avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
        isBanned: !!u.isBanned,
        identityVerified: u.identityVerified === true,
        identityVerificationRequired: u.identityVerificationRequired === true,
        banReason: u.banReason || '',
        bannedAt: u.bannedAt || null,
        emailVerified: u.emailVerified === true,
        twoFactorEnabled: u.twoFactorEnabled === true,
        createdAt: u.createdAt || null
      };
    });

    // 1. Search Filter (Tiwi ID, Email, Name)
    if (query) {
      sanitizedUsers = sanitizedUsers.filter(u =>
        u.tiwiId.toLowerCase().includes(query) ||
        String(u.email || '').toLowerCase().includes(query) ||
        u.name.toLowerCase().includes(query) ||
        (query === 'pick' && u.registrationSource === 'pick_app') ||
        (u.id && u.id.toLowerCase().includes(query))
      );
    }

    // 2. Role Filter
    if (roleFilter !== 'all') {
      sanitizedUsers = sanitizedUsers.filter(u => u.role === roleFilter);
    }

    // 3. Status Filter (active vs banned)
    if (statusFilter === 'active') {
      sanitizedUsers = sanitizedUsers.filter(u => !u.isBanned);
    } else if (statusFilter === 'banned' || statusFilter === 'suspended') {
      sanitizedUsers = sanitizedUsers.filter(u => u.isBanned);
    }

    const total = sanitizedUsers.length;
    const totalPages = Math.ceil(total / limit);
    const safePage = totalPages ? Math.min(page, totalPages) : 1;
    const startIndex = (safePage - 1) * limit;
    const paginatedUsers = sanitizedUsers.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      users: paginatedUsers,
      total,
      page: safePage,
      limit,
      totalPages
    });
  } catch (err) {
    console.error('[Admin Users Error]', err);
    res.status(500).json({ error: 'Failed to retrieve system users.' });
  }
});

// POST /api/admin/users/:id/ban - Ban / Suspend / Unban user with instant session termination & appeal assignment lock
router.post('/users/:id/ban', requireAdmin, requirePermission('ban_users'), requireRecentReauth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, reason, appealTicketId } = req.body;
    if (isBanned !== undefined && typeof isBanned !== 'boolean') {
      return res.status(400).json({ error: 'isBanned must be a boolean value.' });
    }
    const existingUser = await MasterDB.findUserByIdentifier(id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found in system.' });
    }
    if (isSuperAdminUser(existingUser)) {
      return res.status(403).json({ error: 'Super Administrator accounts cannot be disabled.' });
    }
    if (existingUser.role === 'admin' && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Only a super administrator can change another administrator account.' });
    }

    const newBanStatus = isBanned !== undefined ? isBanned === true : !existingUser.isBanned;
    // Anti-Collusion Appeal Assignment Lock:
    // Non-super-admin staff cannot unban friends by arbitrary ID — if unbanning, verify active appeal assignment!
    if (!newBanStatus && !isSuperAdminUser(req.adminUser)) {
      const adminList = await defaultTicketingService.listAdminTickets({
        search: existingUser.email || existingUser.id,
        limit: 50,
        adminUser: req.adminUser,
        adminProfile: req.adminProfile || null
      }).catch(() => ({ tickets: [] }));
      const userTickets = (adminList.tickets || []).filter(
        (t) =>
          (t.userId && String(t.userId) === String(existingUser.id)) ||
          (t.requesterEmail && existingUser.email && t.requesterEmail.toLowerCase() === existingUser.email.toLowerCase())
      );
      const activeAppeals = userTickets.filter(
        (t) => t.status !== 'closed' && (!appealTicketId || String(t.id) === String(appealTicketId) || String(t.serialNumber) === String(appealTicketId))
      );
      const assignedToActor = activeAppeals.some(
        (t) =>
          t.assignedAgentId &&
          String(t.assignedAgentId) === String(req.adminUser.id) &&
          t.assignmentState !== 'pending_acceptance'
      );
      if (!assignedToActor) {
        await defaultTicketingService.recordStaffPermissionAudit({
          actor: req.adminUser,
          action: 'user.unban_blocked_unassigned',
          targetType: 'user',
          targetId: existingUser.id,
          details: { targetEmail: existingUser.email, appealTicketId: appealTicketId || null },
          req
        }).catch(() => {});
        return res.status(403).json({
          error: 'Only the assigned specialist who accepted this user appeal ticket (or Super Admin) can unban/restore this account.',
          code: 'APPEAL_ASSIGNMENT_LOCKED'
        });
      }
    }
    const banReason = newBanStatus
      ? (typeof reason === 'string' && reason.trim()
        ? reason.trim().slice(0, 1000)
        : 'Your account was disabled due to a violation of platform policies.')
      : null;
    const targetUser = await MasterDB.updateUser(existingUser.id, {
      isBanned: newBanStatus,
      banReason
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found in system.' });
    if (newBanStatus) {
      const pickAccount = await queryPg(
        'SELECT 1 FROM pick.users WHERE tiwlo_user_id = $1 LIMIT 1',
        [targetUser.id]
      );
      if (!pickAccount.rows[0]) {
        await MasterDB.revokeUserSessions(targetUser.id);
      }
      await recordSecurityEvent({
        eventType: 'admin.account_disabled',
        severity: 'warning',
        userId: targetUser.id,
        subject: targetUser.email,
        details: { administrator: req.adminUser.email }
      });
    }

    // Dispatch Security Email (clean security notice with cryptographic session tokens)
    if (newBanStatus) {
      const restoreSession = RestoreSessions.createRestoreSession({
        email: targetUser.email,
        userId: targetUser.id,
        reason: banReason
      });

      sendAccountDisabledEmail({
        to: targetUser.email,
        name: targetUser.name || targetUser.storeName || 'Tiwlo User',
        reason: banReason,
        restoreUrl: restoreSession.url
      }).catch(err => console.error('[Ban Email Dispatch Error]', err.message));
    } else {
      await unblockUserAndSignals(targetUser.id).catch((err) =>
        console.warn('[Admin Unban] Failed to clear blocked device/IP records:', err.message)
      );
      const checkupSession = RestoreSessions.createSecurityCheckupSession({
        email: targetUser.email,
        userId: targetUser.id
      });

      sendAccountRestoredEmail({
        to: targetUser.email,
        name: targetUser.name || targetUser.storeName || 'Tiwlo User',
        checkupUrl: checkupSession.url
      }).catch(err => console.error('[Restore Email Dispatch Error]', err.message));
    }

    const actionText = newBanStatus ? 'disabled / banned' : 'restored / activated';
    await defaultTicketingService.recordStaffPermissionAudit({
      actor: req.adminUser,
      action: newBanStatus ? 'user.banned' : 'user.unbanned',
      targetType: 'user',
      targetId: targetUser.id,
      details: { email: targetUser.email, reason: banReason, appealTicketId: appealTicketId || null },
      req
    }).catch(() => {});
    console.log(`[Admin Action] User ${targetUser.email} has been ${actionText} by ${req.adminUser.email}`);

    res.json({
      success: true,
      message: `User ${targetUser.name || targetUser.email} has been ${actionText} successfully.`,
      user: {
        id: targetUser.id,
        tiwiId: targetUser.tiwiId,
        email: targetUser.email,
        isBanned: targetUser.isBanned,
        banReason,
        bannedAt: newBanStatus ? new Date().toISOString() : null
      }
    });
  } catch (err) {
    console.error('[Admin Ban User Error]', err);
    res.status(500).json({ error: 'Failed to update user ban status.' });
  }
});

// PUT /api/admin/users/:id - Edit user profile and plan details
router.put('/users/:id', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, planId, phone, address } = req.body;
    const currentUser = await MasterDB.findUserByIdentifier(id);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found in system.' });
    }
    if (isSuperAdminUser(currentUser)) {
      return res.status(403).json({ error: 'Super Administrator accounts cannot be edited here.' });
    }
    if (currentUser.role === 'admin' && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Only a super administrator can edit another administrator account.' });
    }
    if (role !== undefined && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Only a super administrator can change account roles.' });
    }
    if (role !== undefined && !['owner', 'staff', 'customer', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'The requested account role is not supported.' });
    }
    if (planId !== undefined && !['free', 'growth', 'pro', 'enterprise'].includes(planId)) {
      return res.status(400).json({ error: 'The requested subscription plan is not supported.' });
    }
    const updates = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'A non-empty display name is required.' });
      updates.name = name.trim().slice(0, 255);
    }
    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const duplicate = await MasterDB.findUserByIdentifier(normalizedEmail);
      if (duplicate && duplicate.id !== currentUser.id) {
        return res.status(409).json({ error: 'That email address is already assigned to another account.' });
      }
      updates.email = normalizedEmail;
    }
    if (role !== undefined) updates.role = role;
    if (planId !== undefined) {
      updates.planId = planId;
      updates.planName = ({ free: 'Free Starter', growth: 'Growth Retailer', pro: 'Pro Business', enterprise: 'Enterprise VIP' })[planId];
    }
    if (phone !== undefined) updates.phone = String(phone).slice(0, 64);
    if (address !== undefined) updates.address = String(address).slice(0, 2000);
    const user = await MasterDB.updateUser(currentUser.id, updates);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { password, ...safeUser } = user;
    res.json({ success: true, message: 'User updated successfully.', user: safeUser });
  } catch (err) {
    console.error('[Admin Edit User Error]', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /api/admin/users/:id - Delete user from system
router.delete('/users/:id', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await MasterDB.findUserByIdentifier(id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (isSuperAdminUser(targetUser)) {
      return res.status(403).json({ error: 'Super Administrator accounts cannot be deleted.' });
    }
    if (targetUser.role === 'admin' && !isSuperAdminUser(req.adminUser)) {
      return res.status(403).json({ error: 'Only a super administrator can delete another administrator.' });
    }
    await MasterDB.revokeUserSessions(targetUser.id);
    const deletion = await queryPg('DELETE FROM system_users WHERE id = $1', [targetUser.id]);
    if (!deletion.rowCount) return res.status(404).json({ error: 'User not found.' });
    await recordSecurityEvent({
      eventType: 'admin.account_deleted',
      severity: 'warning',
      userId: targetUser.id,
      subject: targetUser.email,
      details: { administrator: req.adminUser.email }
    });
    res.json({ success: true, message: `User ${targetUser.email} deleted successfully.` });
  } catch (err) {
    console.error('[Admin Delete User Error]', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/admin/orders - Full orders list (from actual store sales)
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { allSales } = (await getAggregatedStoreData());
    const orders = allSales.map((s, idx) => ({
      id: s.id || s.invoiceNumber || s.invoiceNo || null,
      rowKey: `${s.storeId || 'store'}:${s.id || s.invoiceNumber || s.invoiceNo || idx}`,
      store: s.storeName,
      currency: s.currency,
      customer: s.customerName || s.customer || 'Customer unavailable',
      items: Array.isArray(s.items) ? s.items.length : 0,
      total: s.totalAmount === undefined && s.grandTotal === undefined && s.total === undefined
        ? null
        : getSaleAmount(s),
      status: s.paymentStatus || s.status || 'Unknown',
      date: getSaleTimestamp(s)?.toISOString() || null
    })).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    res.json({ success: true, orders, liveCount: allSales.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

// GET /api/admin/servers - Cloud servers list
router.get('/servers', requireAdmin, async (req, res) => {
  res.json({
    success: true,
    providerConnected: false,
    droplets: [],
    message: 'Cloud provisioning is not connected to a provider.'
  });
});

// ==========================================
// PLATFORM PAYMENT GATEWAYS CONFIGURATION
// bKash, Nagad, SSLCommerz, PayPal, Stripe
// ==========================================

export const DEFAULT_PLATFORM_GATEWAYS = Object.freeze({
  bkash: {
    id: 'bkash',
    name: 'bKash Regular Checkout (URL)',
    enabled: false,
    mode: 'sandbox',
    appKey: '',
    appSecret: '',
    username: '',
    password: '',
    currencies: ['BDT']
  },
  nagad: {
    id: 'nagad',
    name: 'Nagad Direct Payment',
    enabled: false,
    mode: 'sandbox',
    merchantId: '',
    merchantPrivateKey: '',
    nagadPublicKey: '',
    currencies: ['BDT']
  },
  sslcommerz: {
    id: 'sslcommerz',
    name: 'SSLCOMMERZ Hosted Gateway',
    enabled: false,
    mode: 'sandbox',
    storeId: '',
    storePassword: '',
    currencies: ['BDT', 'USD']
  },
  paypal: {
    id: 'paypal',
    name: 'PayPal Global Gateway',
    enabled: false,
    mode: 'sandbox',
    clientId: '',
    clientSecret: '',
    currencies: ['USD', 'EUR', 'GBP']
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe Payments',
    enabled: false,
    mode: 'test',
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    currencies: ['USD', 'EUR', 'GBP']
  }
});

export async function getPlatformPaymentGatewaysRaw() {
  try {
    await queryPg(
      `INSERT INTO system_settings (setting_key, settings)
       VALUES ('platform_payment_gateways', $1::jsonb)
       ON CONFLICT (setting_key) DO NOTHING`,
      [JSON.stringify(DEFAULT_PLATFORM_GATEWAYS)]
    );
    const result = await queryPg(
      "SELECT settings FROM system_settings WHERE setting_key = 'platform_payment_gateways'"
    );
    return { ...DEFAULT_PLATFORM_GATEWAYS, ...(result.rows[0]?.settings || {}) };
  } catch (err) {
    console.error('[Platform Gateways] Error reading gateways from DB:', err.message);
    return DEFAULT_PLATFORM_GATEWAYS;
  }
}

export async function savePlatformPaymentGatewaysRaw(newSettings) {
  const result = await queryPg(
    `INSERT INTO system_settings (setting_key, settings, updated_at)
     VALUES ('platform_payment_gateways', $1::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (setting_key) DO UPDATE
     SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
     RETURNING settings`,
    [JSON.stringify(newSettings)]
  );
  return result.rows[0]?.settings || newSettings;
}

function maskCredential(val) {
  if (!val || typeof val !== 'string') return '';
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 4) + '••••••••' + val.slice(-4);
}

// GET /api/admin/payment-gateways
router.get('/payment-gateways', requireAdmin, async (req, res) => {
  try {
    const raw = await getPlatformPaymentGatewaysRaw();
    const masked = {};
    for (const [key, gw] of Object.entries(raw)) {
      masked[key] = {
        ...gw,
        appSecret: gw.appSecret ? maskCredential(gw.appSecret) : '',
        password: gw.password ? maskCredential(gw.password) : '',
        merchantPrivateKey: gw.merchantPrivateKey ? maskCredential(gw.merchantPrivateKey) : '',
        storePassword: gw.storePassword ? maskCredential(gw.storePassword) : '',
        clientSecret: gw.clientSecret ? maskCredential(gw.clientSecret) : '',
        secretKey: gw.secretKey ? maskCredential(gw.secretKey) : '',
        webhookSecret: gw.webhookSecret ? maskCredential(gw.webhookSecret) : '',
        hasAppSecret: Boolean(gw.appSecret),
        hasPassword: Boolean(gw.password),
        hasMerchantPrivateKey: Boolean(gw.merchantPrivateKey),
        hasStorePassword: Boolean(gw.storePassword),
        hasClientSecret: Boolean(gw.clientSecret),
        hasSecretKey: Boolean(gw.secretKey),
        hasWebhookSecret: Boolean(gw.webhookSecret)
      };
    }
    res.json({ success: true, gateways: masked });
  } catch (error) {
    console.error('[Admin Gateways Error]', error.message);
    res.status(500).json({ error: 'Failed to retrieve payment gateways.' });
  }
});

// POST /api/admin/payment-gateways
router.post('/payment-gateways', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const incoming = req.body?.gateways;
    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Invalid gateways configuration payload.' });
    }

    const current = await getPlatformPaymentGatewaysRaw();
    const updated = { ...current };

    const secretFields = [
      'appSecret',
      'password',
      'merchantPrivateKey',
      'storePassword',
      'clientSecret',
      'secretKey',
      'webhookSecret'
    ];

    for (const id of ['bkash', 'nagad', 'sslcommerz', 'paypal', 'stripe']) {
      if (incoming[id]) {
        const item = incoming[id];
        const prev = current[id] || {};
        const merged = { ...prev, ...item };

        for (const sec of secretFields) {
          if (item[sec] !== undefined) {
            const val = String(item[sec]).trim();
            if (!val || val.includes('••••')) {
              merged[sec] = prev[sec] || '';
            } else {
              merged[sec] = val;
            }
          }
        }
        merged.enabled = Boolean(item.enabled);
        merged.mode = item.mode === 'live' ? 'live' : (id === 'stripe' ? (item.mode === 'live' ? 'live' : 'test') : 'sandbox');
        updated[id] = merged;
      }
    }

    await savePlatformPaymentGatewaysRaw(updated);
    res.json({ success: true, message: 'Platform payment gateways updated successfully.' });
  } catch (error) {
    console.error('[Admin Gateways Save Error]', error.message);
    res.status(500).json({ error: 'Failed to save payment gateway settings.' });
  }
});

// GET /api/admin/packages
router.get('/packages', requireAdmin, async (_req, res) => {
  try {
    const catalog = await getEcommerceCatalog();
    res.json({ success: true, ...catalog });
  } catch (error) {
    console.error('[Admin Packages Get Error]', error.message);
    res.status(500).json({ error: 'Failed to load packages.' });
  }
});

// PUT /api/admin/packages
router.put('/packages', requireAdmin, async (req, res) => {
  try {
    const catalog = await saveEcommerceCatalog({
      packages: req.body?.packages,
      addons: req.body?.addons,
      discordPackages: req.body?.discordPackages,
      whatsappPackages: req.body?.whatsappPackages
    });
    res.json({ success: true, ...catalog, message: 'Subscription packages updated successfully.' });
  } catch (error) {
    console.error('[Admin Packages Save Error]', error.message);
    res.status(400).json({ error: error.message || 'Failed to save packages.' });
  }
});

// GET /api/admin/promotions
router.get('/promotions', requireAdmin, async (_req, res) => {
  try {
    const [welcomePromo, promoCodes, recentClaims] = await Promise.all([
      getWelcomePromoSettings(),
      listPromoCodes(),
      listPromoClaims({ limit: 100 })
    ]);
    res.json({ success: true, welcomePromo, promoCodes, recentClaims });
  } catch (error) {
    console.error('[Admin Promotions Get Error]', error.message);
    res.status(500).json({ error: 'Failed to load promotions configuration.' });
  }
});

// PUT /api/admin/promotions/welcome
router.put('/promotions/welcome', requireAdmin, async (req, res) => {
  try {
    const welcomePromo = await saveWelcomePromoSettings(req.body || {});
    res.json({ success: true, welcomePromo, message: 'Welcome credit-load offer updated.' });
  } catch (error) {
    console.error('[Admin Welcome Promo Save Error]', error.message);
    res.status(400).json({ error: error.message || 'Failed to update welcome promotion.' });
  }
});

// POST /api/admin/promotions/codes
router.post('/promotions/codes', requireAdmin, async (req, res) => {
  try {
    const promo = await createPromoCode(req.body || {}, req.adminUser?.id || null);
    res.status(201).json({ success: true, promo, message: `Promo code "${promo.code}" created.` });
  } catch (error) {
    const status = /unique|duplicate/i.test(error.message || '') ? 409 : 400;
    res.status(status).json({ error: status === 409 ? 'A promotional code with that code already exists.' : (error.message || 'Failed to create promo code.') });
  }
});

// PUT /api/admin/promotions/codes/:id
router.put('/promotions/codes/:id', requireAdmin, async (req, res) => {
  try {
    const promo = await updatePromoCode(req.params.id, req.body || {});
    if (!promo) return res.status(404).json({ error: 'Promotional code not found.' });
    res.json({ success: true, promo, message: `Promo code "${promo.code}" updated.` });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to update promo code.' });
  }
});

// DELETE /api/admin/promotions/codes/:id
router.delete('/promotions/codes/:id', requireAdmin, async (req, res) => {
  try {
    const ok = await deletePromoCode(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Promotional code not found.' });
    res.json({ success: true, message: 'Promotional code deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to delete promo code.' });
  }
});

export default router;
