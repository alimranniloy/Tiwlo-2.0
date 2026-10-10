import express from 'express';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { sendAccountDisabledEmail, sendAccountRestoredEmail } from '../db/emailService.js';
import { RestoreSessions } from '../db/restoreSessions.js';
import { queryPg } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import {
  formatPeriodLabel,
  formatTrend,
  getSaleAmount,
  getSaleTimestamp,
  getSalesPeriod,
  isPaidSale
} from './adminAnalytics.js';
import {
  addGoogleDriveServiceAccount,
  getPlatformStorageSettings,
  listGoogleDriveAccounts,
  setDriveStorageActive
} from './googleDriveStorage.js';
import { getStorageSyncStatus, startStorageSync } from '../db/mediaMigration.js';

const router = express.Router();

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

router.post('/storage/google-drive', requireAdmin, async (req, res) => {
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

router.post('/storage/google-drive/:id/activate', requireAdmin, async (req, res) => {
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

router.post('/storage/sync/:direction', requireAdmin, async (req, res) => {
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
  const token = req.cookies?.tiwlo_session ||
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
    next();
  }).catch(err => {
    console.error('[Admin Auth Error]', err);
    res.status(500).json({ error: 'Authentication check failed.' });
  });
}

function isSuperAdminUser(user) {
  return user?.role === 'super_admin';
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
    const users = await MasterDB.getUsers();
    const { allStores: stores } = (await getAggregatedStoreData());
    const query = (req.query.q || req.query.search || '').trim().toLowerCase();

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
        name: u.name || u.storeName || 'Merchant User',
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
        banReason: u.banReason || '',
        status: u.isBanned ? 'Suspended' : 'Active',
        createdAt: u.createdAt || null
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

// GET /api/admin/users - Full System Users Management with strict 20 items/page pagination & search
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const rawUsers = await MasterDB.getUsers();
    const { allStores: stores } = (await getAggregatedStoreData());

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

      return {
        id: u.id,
        tiwiId: u.tiwiId || u.storeId || '',
        name: u.name || u.storeName || 'System User',
        email: u.email,
        role: u.role || 'owner',
        planId: u.planId || 'free',
        planName: u.planName || u.planId || 'Unknown',
        storeCount,
        stores: userStores.map(s => ({ id: s.id, name: s.storeName, subdomain: s.subdomain })),
        avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
        isBanned: !!u.isBanned,
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

// POST /api/admin/users/:id/ban - Ban / Suspend / Unban user with instant session termination
router.post('/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned, reason } = req.body;
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
      await queryPg('DELETE FROM system_sessions WHERE user_id = $1', [targetUser.id]);
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
        name: targetUser.name || targetUser.storeName || 'Merchant',
        reason: banReason,
        restoreUrl: restoreSession.url
      }).catch(err => console.error('[Ban Email Dispatch Error]', err.message));
    } else {
      const checkupSession = RestoreSessions.createSecurityCheckupSession({
        email: targetUser.email,
        userId: targetUser.id
      });

      sendAccountRestoredEmail({
        to: targetUser.email,
        name: targetUser.name || targetUser.storeName || 'Merchant',
        checkupUrl: checkupSession.url
      }).catch(err => console.error('[Restore Email Dispatch Error]', err.message));
    }

    const actionText = newBanStatus ? 'disabled / banned' : 'restored / activated';
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
router.put('/users/:id', requireAdmin, async (req, res) => {
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
router.delete('/users/:id', requireAdmin, async (req, res) => {
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
    await queryPg('DELETE FROM system_sessions WHERE user_id = $1', [targetUser.id]);
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

router.get('/products', requireAdmin, async (req, res) => {
  try {
    const { allProducts } = (await getAggregatedStoreData());
    const query = String(req.query.q || '').trim().toLowerCase();
    const products = allProducts
      .filter(product => !query || [
        product.name,
        product.sku,
        product.categoryName,
        product.category,
        product.storeName
      ].some(value => String(value || '').toLowerCase().includes(query)))
      .map(product => ({
        id: product.id,
        storeId: product.storeId,
        storeName: product.storeName,
        name: product.name || 'Unnamed product',
        sku: product.sku || '',
        category: product.categoryName || product.category || 'Uncategorized',
        price: product.price !== null && product.price !== undefined && Number.isFinite(Number(product.price)) ? Number(product.price) : null,
        stock: product.stock !== null && product.stock !== undefined && Number.isFinite(Number(product.stock)) ? Number(product.stock) : null,
        status: product.status || 'Unknown',
        image: product.image || null,
        currency: product.currency
      }));
    res.json({ success: true, products, total: products.length });
  } catch (error) {
    console.error('[Admin Products Error]', error.message);
    res.status(503).json({ error: 'Could not read live store product catalogs.' });
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

export default router;
