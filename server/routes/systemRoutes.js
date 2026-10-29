import express from 'express';
import { requireAdmin } from '../administrator/adminRoutes.js';
import {
  readData,
  writeData,
  logActivity,
  PRODUCTS_FILE,
  CATEGORIES_FILE,
  SUBCATEGORIES_FILE,
  PURCHASES_FILE,
  SALES_FILE,
  CUSTOMERS_FILE,
  SUPPLIERS_FILE,
  ADJUSTMENTS_FILE,
  ACTIVITIES_FILE
} from '../db/storeDataAdapter.js';

import { getFfmpegStatus } from '../security/videoProcessor.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { MasterDB } from '../db/multiTenant.js';
import { findActiveCustomDomain } from '../domains/domainService.js';
import { hashSecuritySubject, listSecurityEvents, recordSecurityEvent } from '../db/securityPersistence.js';
import { requireRecentReauth } from '../security/recentReauth.js';
import { queryPg } from '../db/postgres.js';
import { isValidLiveLocation, reverseGeocodeAddress } from '../db/addressVerification.js';
import { securityLimiters } from '../plugins/security/index.js';
import geoip from 'geoip-lite';
import {
  getSocialProviderStatuses,
  saveSocialProviderSettings
} from '../security/socialAuth.js';
import {
  getGoogleMapsApiKey,
  getGoogleMapsSettingsStatus,
  normalizeGoogleMapsApiKey,
  saveGoogleMapsApiKey
} from '../db/googleMapsSettings.js';

const router = express.Router();

function getSessionToken(req) {
  const authorization = req.headers.authorization;
  return req.cookies?.tiwlo_host_session ||
    (typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : null);
}

async function saveLoginLocation({ userId, sessionKey, source, location }) {
  await queryPg(
    `INSERT INTO system_user_login_locations
       (user_id, session_key, location_source, latitude, longitude, accuracy_meters,
        formatted_address, area, postal_code, plus_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (session_key) DO UPDATE
       SET location_source = EXCLUDED.location_source,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           accuracy_meters = EXCLUDED.accuracy_meters,
           formatted_address = EXCLUDED.formatted_address,
           area = EXCLUDED.area,
           postal_code = EXCLUDED.postal_code,
           plus_code = EXCLUDED.plus_code,
           captured_at = CURRENT_TIMESTAMP
       WHERE system_user_login_locations.user_id = EXCLUDED.user_id
         AND (
           system_user_login_locations.location_source = 'ip'
           OR EXCLUDED.location_source = 'gps'
         )`,
    [
      userId,
      sessionKey,
      source,
      location.latitude,
      location.longitude,
      location.accuracyMeters,
      location.formattedAddress,
      location.area,
      location.postalCode,
      location.plusCode
    ]
  );
  await queryPg(
    `DELETE FROM system_user_login_locations
     WHERE user_id = $1 AND id NOT IN (
       SELECT id FROM system_user_login_locations
       WHERE user_id = $1
       ORDER BY captured_at DESC, id DESC
       LIMIT 10
     )`,
    [userId]
  );
}

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// FFmpeg availability & worker queue status check
router.get('/ffmpeg-status', async (req, res) => {
  const status = await getFfmpegStatus();
  res.json(status);
});

// Caddy calls this before requesting an on-demand TLS certificate. Only this
// deployment's primary domain and its own subdomains are approved. The route
// deliberately stays before the authenticated system-route middleware.
router.get('/tls/allow', async (req, res) => {
  const requestedHost = String(req.query.domain || '').trim().toLowerCase().replace(/\.$/, '');
  const primaryDomain = PLATFORM_CONFIG.primaryDomain;
  if (!requestedHost || !primaryDomain) return res.sendStatus(403);

  const allowedDomains = [primaryDomain, PLATFORM_CONFIG.storeDomain];
  const isAllowedDomain = allowedDomains.some(
    domain => requestedHost === domain || requestedHost.endsWith(`.${domain}`)
  );
  if (isAllowedDomain) return res.sendStatus(200);
  try {
    return res.sendStatus(await findActiveCustomDomain(requestedHost) ? 200 : 403);
  } catch (error) {
    console.error('[SystemRoutes] Could not validate custom TLS domain:', error);
    return res.sendStatus(503);
  }
});

router.use((req, res, next) => {
  // Never intercept auth, public media, or health endpoints
  if (req.path.startsWith('/auth') || req.path.startsWith('/media') || req.path === '/health' || req.path === '/ffmpeg-status' || req.path.startsWith('/tls')) {
    return next();
  }
  if (!req.activeUser) return res.status(401).json({ error: 'Authentication required' });
  next();
});

router.get('/address-verification', async (req, res) => {
  try {
    const result = await queryPg(
      'SELECT address_verified_at, address_verified_location FROM system_users WHERE id = $1',
      [req.activeUser.id]
    );
    const account = result.rows[0];
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      verified: Boolean(account?.address_verified_at && account?.address_verified_location),
      verifiedAt: account?.address_verified_at || null,
      location: account?.address_verified_location
        ? { ...account.address_verified_location, verifiedAt: account.address_verified_at }
        : null
    });
  } catch (error) {
    console.error('[AddressVerification] Could not read saved location:', error.message);
    return res.status(503).json({ error: 'Saved address verification is currently unavailable.' });
  }
});

router.post('/address-verification', securityLimiters.addressVerification, async (req, res) => {
  const { latitude, longitude, accuracy } = req.body || {};
  if (!isValidLiveLocation({ latitude, longitude, accuracy })) {
    return res.status(400).json({
      error: 'Valid GPS coordinates and reported accuracy are required.'
    });
  }

  try {
    const googleAddress = await reverseGeocodeAddress({
      latitude,
      longitude,
      apiKey: await getGoogleMapsApiKey()
    });
    const location = {
      latitude,
      longitude,
      accuracyMeters: accuracy,
      ...googleAddress
    };
    const result = await queryPg(
      `UPDATE system_users
       SET address_verified_at = CURRENT_TIMESTAMP,
           address_verified_location = $2::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING address_verified_at, address_verified_location`,
      [req.activeUser.id, JSON.stringify(location)]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'The signed-in account could not be found.' });
    }
    recordSecurityEvent({
      eventType: 'address_verification.succeeded',
      severity: 'info',
      userId: req.activeUser.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        provider: 'google',
        accuracyMeters: accuracy,
        requiredAddressFieldsReturned: true
      }
    }).catch(auditError => {
      console.error('[AddressVerification] Could not record success audit event:', auditError.message);
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      verified: true,
      verifiedAt: result.rows[0].address_verified_at,
      location: {
        ...result.rows[0].address_verified_location,
        verifiedAt: result.rows[0].address_verified_at
      }
    });

  } catch (error) {
    console.error('[AddressVerification] Verification failed:', error.message);
    recordSecurityEvent({
      eventType: 'address_verification.failed',
      severity: 'warning',
      userId: req.activeUser.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: {
        provider: 'google',
        accuracyMeters: accuracy,
        reason: error.message
      }
    }).catch(auditError => {
      console.error('[AddressVerification] Could not record failure audit event:', auditError.message);
    });
    return res.status(error instanceof TypeError ? 400 : 503).json({
      error: 'Google could not verify a complete address for this location. Check your GPS accuracy or try again.'
    });
  }
});

router.post('/login-location', securityLimiters.loginLocation, async (req, res) => {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(401).json({ error: 'Your signed-in session could not be confirmed.' });
  }

  const { latitude, longitude, accuracy } = req.body || {};
  try {
    const sessionKey = hashSecuritySubject(sessionToken);
    let source = 'gps';
    let location;
    if (latitude !== undefined || longitude !== undefined || accuracy !== undefined) {
      if (!isValidLiveLocation({ latitude, longitude, accuracy })) {
        return res.status(400).json({ error: 'Valid GPS coordinates and reported accuracy are required.' });
      }
      const googleAddress = await reverseGeocodeAddress({
        latitude,
        longitude,
        apiKey: await getGoogleMapsApiKey()
      });
      location = {
        latitude,
        longitude,
        accuracyMeters: accuracy,
        formattedAddress: googleAddress.formattedAddress,
        area: googleAddress.area,
        postalCode: googleAddress.postalCode,
        plusCode: googleAddress.plusCode
      };
    } else {
      source = 'ip';
      const ip = String(req.ip || '').replace(/^::ffff:/, '');
      const ipLocation = geoip.lookup(ip);
      if (!ipLocation?.ll?.every(Number.isFinite)) {
        return res.status(422).json({ success: false, locationAvailable: false });
      }
      const [city, region] = [ipLocation.city, ipLocation.region].filter(Boolean);
      const country = ipLocation.country || '';
      const area = [city, region].filter(Boolean).join(', ') || country || 'Approximate network location';
      location = {
        latitude: ipLocation.ll[0],
        longitude: ipLocation.ll[1],
        accuracyMeters: null,
        formattedAddress: [city, region, country].filter(Boolean).join(', ') || 'Approximate network location',
        area,
        postalCode: null,
        plusCode: null
      };
    }

    await saveLoginLocation({
      userId: req.activeUser.id,
      sessionKey,
      source,
      location
    });
    recordSecurityEvent({
      eventType: 'login_location.captured',
      severity: 'info',
      userId: req.activeUser.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      details: { source }
    }).catch(auditError => {
      console.error('[LoginLocation] Could not record capture audit event:', auditError.message);
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, locationAvailable: true, source });
  } catch (error) {
    console.error('[LoginLocation] Could not capture login location:', error.message);
    return res.status(error instanceof TypeError ? 400 : 503).json({
      error: 'Could not resolve this login location.'
    });
  }
});

router.get('/admin/security-events', requireAdmin, async (req, res) => {
  try {
    const events = await listSecurityEvents({
      limit: req.query.limit,
      beforeId: req.query.beforeId
    });
    res.json({ success: true, count: events.length, events });
  } catch (error) {
    console.error('[SystemRoutes] Could not list security events:', error);
    res.status(500).json({ error: 'Failed to fetch security events.' });
  }
});

// Stats / Dashboard Overview
router.get('/stats', async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const categories = (await readData(CATEGORIES_FILE, []));
  const sales = (await readData(SALES_FILE, []));

  const totalProductCount = products.length;
  const lowStockCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < (p.minStock || 50)).length;
  const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;

  const currentTotalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalSalesRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

  const catDistribution = categories.map(cat => {
    const prodsInCat = products.filter(p => (p.category || '').toLowerCase() === cat.name.toLowerCase());
    const units = prodsInCat.reduce((sum, p) => sum + (p.stock || 0), 0);
    const percent = currentTotalStock > 0 ? Math.round((units / currentTotalStock) * 100) : 0;
    return {
      name: cat.name,
      units,
      percent,
      color: cat.color || '#3B82F6',
      productCount: prodsInCat.length
    };
  });

  const topSelling = [...products]
    .sort((a, b) => (b.sold || 0) - (a.sold || 0))
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      name: p.name.replace(/\s*\([^)]*\)/, ''),
      fullName: p.name,
      sold: `${p.sold || 0} sold`,
      soldCount: p.sold || 0,
      revenue: `$${((p.revenue || (p.sold * p.price)) || 0).toLocaleString()}`,
      image: p.image
    }));

  const stockMovementData = [];

  res.json({
    totalProducts: totalProductCount.toLocaleString(),
    activeProductCount: totalProductCount,
    totalStock: currentTotalStock.toLocaleString(),
    activeUnitsCount: currentTotalStock,
    totalSales: `$${Math.round(totalSalesRevenue).toLocaleString()}`,
    lowStockItems: lowStockCount,
    outOfStockItems: outOfStockCount,
    categoryDistribution: catDistribution,
    stockMovement: stockMovementData,
    topSellingProducts: topSelling
  });
});

// System Settings
const defaultSystemSettings = {
  companyName: 'Tiwlo Cloud Platform',
  storeEmail: PLATFORM_CONFIG.supportEmail,
  currency: 'USD',
  currencySymbol: '$',
  taxRate: 0,
  lowStockThreshold: 50,
  enableLowStockAlerts: true
};

router.get('/system/settings', async (req, res) => {
  try {
    res.json(await MasterDB.getSystemSettings(defaultSystemSettings));
  } catch (error) {
    console.error('[SystemRoutes] Failed to read PostgreSQL settings:', error);
    res.status(503).json({ error: 'System settings are unavailable because PostgreSQL could not be reached.' });
  }
});

router.put('/system/settings', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const current = await MasterDB.getSystemSettings(defaultSystemSettings);
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    res.json(await MasterDB.saveSystemSettings(updated));
    (await logActivity('settings', 'System settings updated', 'Settings saved by administrator'));
  } catch (error) {
    console.error('[SystemRoutes] Failed to save PostgreSQL settings:', error);
    res.status(503).json({ error: 'System settings could not be saved because PostgreSQL is unavailable.' });
  }
});

router.get('/admin/social-login', requireAdmin, async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, providers: await getSocialProviderStatuses() });
  } catch (error) {
    console.error('[SystemRoutes] Failed to read social login settings:', error.message);
    res.status(503).json({ error: 'Social login settings are currently unavailable.' });
  }
});

router.put('/admin/social-login/:provider', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const { clientId, clientSecret, enabled } = req.body || {};
    await saveSocialProviderSettings(req.params.provider, { clientId, clientSecret, enabled });
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      providers: await getSocialProviderStatuses()
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[SystemRoutes] Failed to save social login settings:', error.message);
    res.status(503).json({ error: 'Social login settings could not be saved.' });
  }
});

router.get('/admin/google-maps', requireAdmin, async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, settings: await getGoogleMapsSettingsStatus() });
  } catch (error) {
    console.error('[SystemRoutes] Failed to read Google Maps settings:', error.message);
    res.status(503).json({ error: 'Google Maps settings are currently unavailable.' });
  }
});

router.put('/admin/google-maps', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const apiKey = req.body?.clear === true ? '' : normalizeGoogleMapsApiKey(req.body?.apiKey);
    const settings = await saveGoogleMapsApiKey(apiKey);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, settings });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('[SystemRoutes] Failed to save Google Maps settings:', error.message);
    res.status(503).json({ error: 'Google Maps settings could not be saved.' });
  }
});

// System Info
router.get('/system/info', async (req, res) => {
  const products = (await readData(PRODUCTS_FILE, []));
  const categories = (await readData(CATEGORIES_FILE, []));
  const subcategories = (await readData(SUBCATEGORIES_FILE, []));
  const purchases = (await readData(PURCHASES_FILE, []));
  const sales = (await readData(SALES_FILE, []));
  const customers = (await readData(CUSTOMERS_FILE, []));
  const suppliers = (await readData(SUPPLIERS_FILE, []));
  const activities = (await readData(ACTIVITIES_FILE, []));

  const totalRecords = products.length + categories.length + subcategories.length +
    purchases.length + sales.length + customers.length + suppliers.length + activities.length;

  res.json({
    appName: 'StockPro Enterprise Inventory System',
    version: 'v3.2.0-PRO',
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    platform: process.platform,
    memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    databaseStatus: 'Healthy',
    totalDatabaseRecords: totalRecords,
    counts: {
      products: products.length,
      categories: categories.length,
      subcategories: subcategories.length,
      purchases: purchases.length,
      sales: sales.length,
      customers: customers.length,
      suppliers: suppliers.length,
      activities: activities.length
    }
  });
});

// System Backup (Admin Only)
router.get('/system/backup', requireAdmin, requireRecentReauth, async (req, res) => {
  try {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      systemVersion: 'v3.2.0',
      products: (await readData(PRODUCTS_FILE, [])),
      categories: (await readData(CATEGORIES_FILE, [])),
      subcategories: (await readData(SUBCATEGORIES_FILE, [])),
      purchases: (await readData(PURCHASES_FILE, [])),
      sales: (await readData(SALES_FILE, [])),
      customers: (await readData(CUSTOMERS_FILE, [])),
      suppliers: (await readData(SUPPLIERS_FILE, [])),
      adjustments: (await readData(ADJUSTMENTS_FILE, [])),
      settings: await MasterDB.getSystemSettings(defaultSystemSettings),
      activities: (await readData(ACTIVITIES_FILE, []))
    };
    res.json(fullBackup);
  } catch (error) {
    console.error('[SystemRoutes] Failed to create backup:', error);
    res.status(503).json({ error: 'Backup could not be created because PostgreSQL is unavailable.' });
  }
});

// Activities Log
router.get('/activities', async (req, res) => {
  const activities = (await readData(ACTIVITIES_FILE, []));
  res.json(activities);
});

router.delete('/activities/:id', async (req, res) => {
  const activities = (await readData(ACTIVITIES_FILE, []));
  const { id } = req.params;
  const filtered = activities.filter(a => a.id !== id);
  (await writeData(ACTIVITIES_FILE, filtered));
  res.json({ message: 'Activity deleted' });
});

router.delete('/activities', async (req, res) => {
  (await writeData(ACTIVITIES_FILE, []));
  res.json({ message: 'All activities cleared' });
});

export default router;
