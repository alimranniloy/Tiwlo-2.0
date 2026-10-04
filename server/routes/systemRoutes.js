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

const router = express.Router();

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
router.get('/tls/allow', (req, res) => {
  const requestedHost = String(req.query.domain || '').trim().toLowerCase().replace(/\.$/, '');
  const primaryDomain = PLATFORM_CONFIG.primaryDomain;
  if (!requestedHost || !primaryDomain) return res.sendStatus(403);

  const allowedDomains = [primaryDomain, PLATFORM_CONFIG.storeDomain];
  const isAllowedDomain = allowedDomains.some(
    domain => requestedHost === domain || requestedHost.endsWith(`.${domain}`)
  );
  return res.sendStatus(isAllowedDomain ? 200 : 403);
});

router.use((req, res, next) => {
  // Never intercept auth, public media, or health endpoints
  if (req.path.startsWith('/auth') || req.path.startsWith('/media') || req.path === '/health' || req.path === '/ffmpeg-status' || req.path.startsWith('/tls')) {
    return next();
  }
  if (!req.activeUser) return res.status(401).json({ error: 'Authentication required' });
  next();
});

// Stats / Dashboard Overview
router.get('/stats', (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const categories = readData(CATEGORIES_FILE, []);
  const sales = readData(SALES_FILE, []);

  const totalProductCount = products.length;
  const lowStockCount = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < (p.minStock || 50)).length;
  const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;

  const currentTotalStock = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const totalSalesRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);

  const totalUnits = Math.max(1, currentTotalStock);
  const catDistribution = categories.map(cat => {
    const prodsInCat = products.filter(p => (p.category || '').toLowerCase() === cat.name.toLowerCase());
    const units = prodsInCat.reduce((sum, p) => sum + (p.stock || 0), 0);
    const percent = Math.round((units / totalUnits) * 100);
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
      growth: p.growth || '+10%',
      image: p.image
    }));

  const stockMovementData = [];

  res.json({
    totalProducts: totalProductCount.toLocaleString(),
    activeProductCount: totalProductCount,
    totalProductsGrowth: '+12% vs last month',
    totalStock: currentTotalStock.toLocaleString(),
    activeUnitsCount: currentTotalStock,
    totalStockGrowth: '+8% vs last month',
    totalSales: `$${Math.round(totalSalesRevenue).toLocaleString()}`,
    totalSalesGrowth: '+24% vs last month',
    lowStockItems: lowStockCount,
    outOfStockItems: outOfStockCount,
    lowStockGrowth: '-5% vs last month',
    categoryDistribution: catDistribution.length > 0 ? catDistribution : [
      { name: 'Electronics', percent: 28, units: 10213, color: '#3B82F6' },
      { name: 'Clothing', percent: 24, units: 8756, color: '#10B981' },
      { name: 'Home & Living', percent: 16, units: 5838, color: '#F59E0B' },
      { name: 'Beauty & Health', percent: 12, units: 4377, color: '#F43F5E' },
      { name: 'Sports', percent: 8, units: 2918, color: '#8B5CF6' },
      { name: 'Others', percent: 12, units: 4380, color: '#60A5FA' }
    ],
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

router.put('/system/settings', requireAdmin, async (req, res) => {
  try {
    const current = await MasterDB.getSystemSettings(defaultSystemSettings);
    const updated = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    res.json(await MasterDB.saveSystemSettings(updated));
    logActivity('settings', 'System settings updated', 'Settings saved by administrator');
  } catch (error) {
    console.error('[SystemRoutes] Failed to save PostgreSQL settings:', error);
    res.status(503).json({ error: 'System settings could not be saved because PostgreSQL is unavailable.' });
  }
});

// System Info
router.get('/system/info', (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const categories = readData(CATEGORIES_FILE, []);
  const subcategories = readData(SUBCATEGORIES_FILE, []);
  const purchases = readData(PURCHASES_FILE, []);
  const sales = readData(SALES_FILE, []);
  const customers = readData(CUSTOMERS_FILE, []);
  const suppliers = readData(SUPPLIERS_FILE, []);
  const activities = readData(ACTIVITIES_FILE, []);

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
router.get('/system/backup', requireAdmin, async (req, res) => {
  try {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      systemVersion: 'v3.2.0',
      products: readData(PRODUCTS_FILE, []),
      categories: readData(CATEGORIES_FILE, []),
      subcategories: readData(SUBCATEGORIES_FILE, []),
      purchases: readData(PURCHASES_FILE, []),
      sales: readData(SALES_FILE, []),
      customers: readData(CUSTOMERS_FILE, []),
      suppliers: readData(SUPPLIERS_FILE, []),
      adjustments: readData(ADJUSTMENTS_FILE, []),
      settings: await MasterDB.getSystemSettings(defaultSystemSettings),
      activities: readData(ACTIVITIES_FILE, [])
    };
    res.json(fullBackup);
  } catch (error) {
    console.error('[SystemRoutes] Failed to create backup:', error);
    res.status(503).json({ error: 'Backup could not be created because PostgreSQL is unavailable.' });
  }
});

// Activities Log
router.get('/activities', (req, res) => {
  const activities = readData(ACTIVITIES_FILE, []);
  res.json(activities);
});

router.delete('/activities/:id', (req, res) => {
  const activities = readData(ACTIVITIES_FILE, []);
  const { id } = req.params;
  const filtered = activities.filter(a => a.id !== id);
  writeData(ACTIVITIES_FILE, filtered);
  res.json({ message: 'Activity deleted' });
});

router.delete('/activities', (req, res) => {
  writeData(ACTIVITIES_FILE, []);
  res.json({ message: 'All activities cleared' });
});

export default router;
