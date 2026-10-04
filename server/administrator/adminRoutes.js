import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MasterDB } from '../db/multiTenant.js';
import { sendAccountDisabledEmail, sendAccountRestoredEmail } from '../db/emailService.js';
import { RestoreSessions } from '../db/restoreSessions.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORES_DIR = path.resolve(__dirname, '../data/stores');

const router = express.Router();

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
    const isSuperAdmin = user.role === 'super_admin' || user.email === 'tiwloltd@gmail.com';
    if (!isSuperAdmin && user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }
    req.adminUser = user;
    next();
  }).catch(err => {
    console.error('[Admin Auth Error]', err);
    res.status(500).json({ error: 'Authentication check failed.' });
  });
}

// Helper to read Cloud DB
function getCloudData() {
  return { droplets: [] };
}

// Helper to read Master DB safely
function getMasterDataRaw() {
  return MasterDB.getMasterData();
}

// Helper to write Master DB safely
function saveMasterDataRaw(data) {
  MasterDB.saveMasterData(data);
  return true;
}

// Helper to aggregate store metrics
function getAggregatedStoreData() {
  let allProducts = [];
  let allSales = [];
  let allCustomers = [];
  let allActivities = [];

  try {
    if (fs.existsSync(STORES_DIR)) {
      const storeFiles = fs.readdirSync(STORES_DIR).filter(f => f.endsWith('.json'));
      for (const file of storeFiles) {
        try {
          const store = JSON.parse(fs.readFileSync(path.join(STORES_DIR, file), 'utf8'));
          if (Array.isArray(store.products)) allProducts.push(...store.products);
          if (Array.isArray(store.sales)) allSales.push(...store.sales);
          if (Array.isArray(store.customers)) allCustomers.push(...store.customers);
          if (Array.isArray(store.activities)) allActivities.push(...store.activities);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.error('[Admin] Error reading store dir:', e);
  }

  return { allProducts, allSales, allCustomers, allActivities };
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
    const range = req.query.range || '7days';
    const cloud = getCloudData();
    const { allProducts, allSales, allCustomers, allActivities } = getAggregatedStoreData();
    const masterUsers = await MasterDB.getUsers();

    const liveRevenueTotal = allSales.reduce((acc, s) => acc + (Number(s.totalAmount || s.grandTotal || s.total || 0)), 0);
    const totalRevenue = liveRevenueTotal;
    const totalOrders = allSales.length;
    const totalCustomers = allCustomers.length + masterUsers.length;
    const activeServers = (cloud.droplets && cloud.droplets.length > 0) ? cloud.droplets.length : 0;

    let salesChart = [];
    if (range === '7days') {
      salesChart = [
        { label: 'Sep 23', sales: 2100, orders: 84 },
        { label: 'Sep 24', sales: 3850, orders: 142 },
        { label: 'Sep 25', sales: 4200, orders: 165 },
        { label: 'Sep 26', sales: 4050, orders: 152 },
        { label: 'Sep 27', sales: 4950, orders: 188 },
        { label: 'Sep 28', sales: 5120, orders: 196 },
        { label: 'Sep 29', sales: 6842, orders: 234 }
      ];
    } else if (range === '30days') {
      salesChart = [
        { label: 'W1', sales: 18200, orders: 740 },
        { label: 'W2', sales: 22400, orders: 890 },
        { label: 'W3', sales: 26100, orders: 980 },
        { label: 'W4', sales: 29500, orders: 1140 }
      ];
    } else {
      salesChart = [
        { label: 'Jul', sales: 64200, orders: 2600 },
        { label: 'Aug', sales: 78900, orders: 3100 },
        { label: 'Sep', sales: 94500, orders: 3800 }
      ];
    }

    const revenueBreakdown = {
      total: totalRevenue,
      categories: [
        { name: 'Products', percentage: 58.4, color: '#3b82f6', amount: (totalRevenue * 0.584).toFixed(2) },
        { name: 'Cloud Services', percentage: 24.1, color: '#8b5cf6', amount: (totalRevenue * 0.241).toFixed(2) },
        { name: 'Shipping', percentage: 9.8, color: '#10b981', amount: (totalRevenue * 0.098).toFixed(2) },
        { name: 'Other', percentage: 7.7, color: '#f59e0b', amount: (totalRevenue * 0.077).toFixed(2) }
      ]
    };

    const recentActivities = [
      { id: 'act-1', type: 'order', title: 'New order received', target: 'Order #TWL-1042', timeAgo: '2m ago', icon: 'shopping-bag', color: 'blue' },
      { id: 'act-2', type: 'user', title: 'New customer registered', target: 'user@example.com', timeAgo: '12m ago', icon: 'user-plus', color: 'indigo' },
      { id: 'act-3', type: 'server', title: 'Server deployed', target: 'web-2 (Ubuntu 22.04)', timeAgo: '18m ago', icon: 'server', color: 'emerald' },
      { id: 'act-4', type: 'coupon', title: 'Coupon created', target: 'SAVE20 - 20% off', timeAgo: '32m ago', icon: 'tag', color: 'amber' },
      { id: 'act-5', type: 'domain', title: 'Domain registered', target: PLATFORM_CONFIG.primaryDomain, timeAgo: '1h ago', icon: 'globe', color: 'sky' },
      { id: 'act-6', type: 'refund', title: 'Refund processed', target: 'Order #TWL-1037', timeAgo: '2h ago', icon: 'refresh-cw', color: 'orange' }
    ];

    const completedOrdersCount = allSales.filter(s => (s.paymentStatus || s.status || '').toLowerCase() === 'completed').length;
    const pendingOrdersCount = allSales.filter(s => (s.paymentStatus || s.status || '').toLowerCase() === 'pending').length;

    // Top products derived from live store catalog
    const topProducts = allProducts.slice(0, 5).map((p, idx) => ({
      rank: idx + 1,
      name: p.name || 'Store Product',
      orders: 0,
      revenue: Number(p.price || 0),
      image: p.image && !p.image.includes('unsplash.com') ? p.image : '/apple-touch-icon.png'
    }));

    const ecommerceOverview = {
      totalOrders: allSales.length,
      pendingOrders: pendingOrdersCount,
      completedOrders: completedOrdersCount,
      totalSales: liveRevenueTotal,
      topProducts
    };

    const serverCount = (cloud.droplets && cloud.droplets.length) || 0;
    const cloudOverview = {
      totalServers: serverCount,
      activeServers: serverCount,
      totalStorage: `${serverCount * 80} GB`,
      bandwidthUsage: '0 GB',
      serverUsage: (cloud.droplets || []).map(d => ({
        os: d.image || 'Linux Server',
        active: 1,
        total: 1,
        percent: 100,
        color: '#3b82f6'
      }))
    };

    const systemInfo = {
      platformVersion: 'v2.8.0',
      phpVersion: '8.2.12',
      nodeVersion: process.version || 'v20.18.0',
      database: 'PostgreSQL 15',
      serverUptime: getFormattedUptime(),
      status: 'All systems operational',
      operational: true
    };

    res.json({
      success: true,
      data: {
        metrics: {
          totalRevenue: { value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, trend: '+12.5%', period: 'vs. last 7 days', positive: true },
          totalOrders: { value: totalOrders.toLocaleString('en-US'), trend: '+8.2%', period: 'vs. last 7 days', positive: true },
          totalCustomers: { value: totalCustomers.toLocaleString('en-US'), trend: '+15.6%', period: 'vs. last 7 days', positive: true },
          activeCloudServers: { value: activeServers.toString(), trend: '+4.3%', period: 'vs. last 7 days', positive: true }
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
    res.status(500).json({ error: 'Failed to aggregate admin overview.' });
  }
});

// GET /api/admin/customers - E-commerce Merchants & Customers with real Store Counts
router.get('/customers', requireAdmin, async (req, res) => {
  try {
    const master = getMasterDataRaw();
    const users = master.users || [];
    const stores = master.stores || [];
    const query = (req.query.q || req.query.search || '').trim().toLowerCase();

    // Map each customer/store owner
    let customers = users.map(u => {
      // Find all stores belonging to this user
      const userStores = stores.filter(s =>
        (s.ownerId && s.ownerId === u.id) ||
        (s.tiwiId && s.tiwiId === u.tiwiId) ||
        (u.storeId && s.tiwiId === u.storeId)
      );

      const storeCount = userStores.length > 0 ? userStores.length : (u.storeName ? 1 : 0);
      const storeNames = userStores.map(s => s.storeName).filter(Boolean);
      if (storeNames.length === 0 && u.storeName) storeNames.push(u.storeName);

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
        primaryStoreName: userStores[0]?.storeName || u.storeName || 'Primary Store',
        subdomain: userStores[0]?.subdomain || u.subdomain || `shop.${PLATFORM_CONFIG.storeDomain}`,
        planName: u.planName || 'Free Starter',
        planId: u.planId || 'free',
        isBanned: !!u.isBanned,
        banReason: u.banReason || '',
        status: u.isBanned ? 'Suspended' : 'Active',
        createdAt: u.createdAt || '2026-09-01T00:00:00.000Z'
      };
    });

    // Apply search filter if provided
    if (query) {
      customers = customers.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
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
    const master = getMasterDataRaw();
    const rawUsers = master.users || [];
    const stores = master.stores || [];

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

      const storeCount = userStores.length > 0 ? userStores.length : (u.storeName ? 1 : 0);

      return {
        id: u.id,
        tiwiId: u.tiwiId || u.storeId || '',
        name: u.name || u.storeName || 'System User',
        email: u.email,
        role: u.role || (u.email === 'tiwloltd@gmail.com' ? 'super_admin' : 'owner'),
        planId: u.planId || 'free',
        planName: u.planName || 'Free Starter',
        storeCount,
        stores: userStores.map(s => ({ id: s.id, name: s.storeName, subdomain: s.subdomain })),
        avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
        isBanned: !!u.isBanned,
        banReason: u.banReason || '',
        bannedAt: u.bannedAt || null,
        emailVerified: u.emailVerified === true,
        twoFactorEnabled: u.twoFactorEnabled === true,
        createdAt: u.createdAt || '2026-09-01T00:00:00.000Z'
      };
    });

    // 1. Search Filter (Tiwi ID, Email, Name)
    if (query) {
      sanitizedUsers = sanitizedUsers.filter(u =>
        u.tiwiId.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
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
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedUsers = sanitizedUsers.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      users: paginatedUsers,
      total,
      page,
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
    const master = getMasterDataRaw();

    const uIndex = (master.users || []).findIndex(u =>
      u.id === id || u.tiwiId === id || u.email?.toLowerCase() === id.toLowerCase()
    );

    if (uIndex === -1) {
      return res.status(404).json({ error: 'User not found in system.' });
    }

    const targetUser = master.users[uIndex];

    // Protect Super Admin from being banned
    if (targetUser.role === 'super_admin' || targetUser.email === 'tiwloltd@gmail.com') {
      return res.status(403).json({ error: 'Super Administrator accounts cannot be disabled.' });
    }

    const newBanStatus = isBanned !== undefined ? !!isBanned : !targetUser.isBanned;
    targetUser.isBanned = newBanStatus;
    targetUser.banReason = newBanStatus
      ? (reason?.trim() || 'Your account was disabled due to a violation of platform policies.')
      : null;
    targetUser.bannedAt = newBanStatus ? new Date().toISOString() : null;
    targetUser.updatedAt = new Date().toISOString();

    // If banned, kill all active sessions for this user immediately
    if (newBanStatus && Array.isArray(master.sessions)) {
      master.sessions = master.sessions.filter(s =>
        s.userId !== targetUser.id &&
        s.email?.toLowerCase() !== targetUser.email?.toLowerCase()
      );
    }

    saveMasterDataRaw(master);

    // Dispatch Security Email (clean security notice with cryptographic session tokens)
    if (newBanStatus) {
      const restoreSession = RestoreSessions.createRestoreSession({
        email: targetUser.email,
        userId: targetUser.id,
        reason: targetUser.banReason
      });

      sendAccountDisabledEmail({
        to: targetUser.email,
        name: targetUser.name || targetUser.storeName || 'Merchant',
        reason: targetUser.banReason,
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
        banReason: targetUser.banReason,
        bannedAt: targetUser.bannedAt
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
    const { name, email, role, planId, planName, phone, address } = req.body;
    const master = getMasterDataRaw();

    const uIndex = (master.users || []).findIndex(u =>
      u.id === id || u.tiwiId === id || u.email?.toLowerCase() === id.toLowerCase()
    );

    if (uIndex === -1) {
      return res.status(404).json({ error: 'User not found in system.' });
    }

    const user = master.users[uIndex];

    if (name) user.name = name.trim();
    if (email && email.includes('@')) user.email = email.trim().toLowerCase();
    if (role && (role === 'owner' || role === 'staff' || role === 'customer' || role === 'admin' || role === 'super_admin')) {
      user.role = role;
    }
    if (planId) user.planId = planId;
    if (planName) user.planName = planName;
    if (phone) {
      if (!user.billingDetails) user.billingDetails = {};
      user.billingDetails.phone = phone;
    }
    if (address) {
      if (!user.billingDetails) user.billingDetails = {};
      user.billingDetails.address = address;
    }

    user.updatedAt = new Date().toISOString();
    saveMasterDataRaw(master);

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
    const master = getMasterDataRaw();

    const uIndex = (master.users || []).findIndex(u =>
      u.id === id || u.tiwiId === id || u.email?.toLowerCase() === id.toLowerCase()
    );

    if (uIndex === -1) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetUser = master.users[uIndex];

    // Protect Super Admin
    if (targetUser.role === 'super_admin' || targetUser.email === 'tiwloltd@gmail.com') {
      return res.status(403).json({ error: 'Super Administrator accounts cannot be deleted.' });
    }

    master.users.splice(uIndex, 1);
    if (Array.isArray(master.sessions)) {
      master.sessions = master.sessions.filter(s =>
        s.userId !== targetUser.id && s.email?.toLowerCase() !== targetUser.email?.toLowerCase()
      );
    }

    saveMasterDataRaw(master);

    res.json({ success: true, message: `User ${targetUser.email} deleted successfully.` });
  } catch (err) {
    console.error('[Admin Delete User Error]', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/admin/orders - Full orders list (from actual store sales)
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { allSales } = getAggregatedStoreData();
    const orders = allSales.map((s, idx) => ({
      id: s.id || s.invoiceNo || `TWL-${1000 + idx}`,
      customer: s.customerName || s.customer || 'Store Customer',
      items: Array.isArray(s.items) ? s.items.length : 1,
      total: Number(s.totalAmount || s.grandTotal || s.total || 0),
      status: s.paymentStatus || s.status || 'Completed',
      date: s.date || s.createdAt || new Date().toISOString()
    }));

    res.json({ success: true, orders, liveCount: allSales.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

// GET /api/admin/servers - Cloud servers list
router.get('/servers', requireAdmin, async (req, res) => {
  try {
    const cloud = getCloudData();
    res.json({ success: true, droplets: cloud.droplets || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve servers.' });
  }
});

export default router;
