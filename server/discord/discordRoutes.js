import express from 'express';
import { DiscordDB } from './discordDb.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { MasterDB } from '../db/multiTenant.js';
import { CloudDB } from '../db/cloud.js';
import { BillingDB } from '../db/billing.js';
import { getDiscordPackages, getWhatsappPackages, saveDiscordPackages } from '../db/packages.js';
import {
  checkServiceLimit,
  evaluateServiceTierInsight,
  getServiceSubscription,
  incrementServiceUsage,
  listServiceNotifications,
  listServiceOrders,
  markServiceNotificationsRead,
  setServiceAutoRenew,
  subscribeServiceWithCredits
} from '../db/serviceSubscriptions.js';
import { isSuperAdminAccount } from '../administrator/identityRiskGraph.js';

const router = express.Router();

// Helper to get authenticated user ID
function getAuthUserId(req) {
  return req.activeUser?.id || req.user?.id || req.session?.userId || null;
}

function isAdminUser(user) {
  if (!user || user.isBanned) return false;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'admin' || role === 'super_admin' || isSuperAdminAccount(user);
}

function isSuperAdminUser(user) {
  if (!user || user.isBanned) return false;
  return String(user.role || '').trim().toLowerCase() === 'super_admin' || isSuperAdminAccount(user);
}

function requireDiscordAdmin(req, res, next) {
  if (!isAdminUser(req.activeUser || req.user)) {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
}

function requireDiscordSuperAdmin(req, res, next) {
  if (!isSuperAdminUser(req.activeUser || req.user)) {
    return res.status(403).json({ error: 'Super Administrator privileges required.' });
  }
  next();
}

// Authentication guard middleware for Discord management
function requireDiscordAuth(req, res, next) {
  const userId = getAuthUserId(req);
  if (!userId) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access Discord Bot Manager.'
    });
  }
  next();
}

// Public packages endpoint (includeDisabled only honored for authenticated admins)
router.get('/packages', async (req, res) => {
  try {
    const includeDisabled = req.query.includeDisabled === 'true' && isAdminUser(req.activeUser || req.user);
    const packages = await getDiscordPackages({ includeDisabled });
    res.json({ success: true, packages });
  } catch (err) {
    console.error('[Discord API] Get packages error:', err);
    res.status(500).json({ error: 'Failed to load Discord Bot packages' });
  }
});

function mapStoreWorkspaceService(store) {
  return {
    id: `store:${store.tiwiId}`,
    workspaceItemType: 'store',
    storeId: store.tiwiId,
    store: {
      id: store.id,
      tiwiId: store.tiwiId,
      storeName: store.storeName,
      subdomain: store.subdomain,
      currency: store.currency
    },
    name: store.storeName || 'Online Store',
    productName: 'Online Store',
    category: store.category || 'Commerce',
    iconType: 'store',
    status: store.status || 'active',
    serverName: store.subdomain || '—',
    plan: store.planId || 'free',
    usageLabel: store.tiwiId,
    renewalDate: '—'
  };
}

function mapDropletWorkspaceService(droplet) {
  return {
    id: `droplet:${droplet.id}`,
    workspaceItemType: 'droplet',
    dropletId: droplet.id,
    name: droplet.name || 'Cloud droplet',
    productName: 'Cloud Droplet',
    category: 'Infrastructure',
    iconType: 'cloud',
    status: droplet.status || 'unknown',
    serverName: droplet.region || droplet.ip || '—',
    plan: droplet.specs || '—',
    usageLabel: [droplet.vcpus ? `${droplet.vcpus} vCPU` : '', droplet.memory, droplet.storage].filter(Boolean).join(' · ') || '—',
    renewalDate: '—'
  };
}

function isAllowedWithoutDiscordSubscription(reqPath = '') {
  const p = String(reqPath || '/');
  return (
    p === '/packages' ||
    p === '/subscription' ||
    p.startsWith('/subscription/') ||
    p === '/marketplace' ||
    p.startsWith('/marketplace/') ||
    p === '/workspace' ||
    p.startsWith('/workspace/') ||
    p === '/admin' ||
    p.startsWith('/admin/')
  );
}

async function requireActiveDiscordSubscription(req, res, next) {
  try {
    if (isAllowedWithoutDiscordSubscription(req.path)) {
      return next();
    }
    const userId = getAuthUserId(req);
    const subscription = await getServiceSubscription(userId, 'discord');
    if (!subscription || subscription.isActive !== true) {
      const packages = await getDiscordPackages();
      return res.status(402).json({
        error: 'Active subscription required before entering the dashboard.',
        code: 'SUBSCRIPTION_REQUIRED',
        serviceType: 'discord',
        subscription: subscription || null,
        packages
      });
    }
    req.serviceSubscription = subscription;
    return next();
  } catch (err) {
    console.error('[Discord API] Subscription gate error:', err);
    return res.status(500).json({ error: 'Failed to verify Discord subscription status' });
  }
}

router.use(requireDiscordAuth);
router.use(requireActiveDiscordSubscription);

// ==========================================
// 0. SUBSCRIPTION & OFFICIAL BOT DISCOVERY
// ==========================================
router.get('/subscription', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const [subscription, packages, servers, officialBots, notifications] = await Promise.all([
      getServiceSubscription(userId, 'discord'),
      getDiscordPackages(),
      DiscordDB.getServers(userId).catch(() => []),
      DiscordDB.getOfficialBots({ activeOnly: true }).catch(() => []),
      listServiceNotifications(userId, { serviceType: 'discord', unreadOnly: true })
    ]);
    const usage = {
      serversCount: servers.length,
      botsCount: 0,
      monthlyCommandsUsed: Number(subscription?.usage?.monthlyCommands || 0)
    };
    const tierInsight = await evaluateServiceTierInsight({
      serviceType: 'discord',
      subscription,
      packages,
      usage: {
        serversCount: usage.serversCount,
        botsCount: usage.botsCount,
        monthlyCommands: usage.monthlyCommandsUsed
      }
    });
    res.json({
      success: true,
      subscription,
      packages,
      officialBots,
      usage,
      tierInsight,
      notifications
    });
  } catch (err) {
    console.error('[Discord API] Get subscription error:', err);
    res.status(500).json({ error: 'Failed to load Discord subscription status' });
  }
});

router.post('/subscription/purchase', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { planId, autoRenew } = req.body || {};
    if (!planId || typeof planId !== 'string') {
      return res.status(400).json({ error: 'planId is required.' });
    }
    if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
      return res.status(400).json({ error: 'autoRenew must be a boolean.' });
    }
    const result = await subscribeServiceWithCredits({
      userId,
      userRole: req.activeUser?.role || req.user?.role,
      serviceType: 'discord',
      planId,
      autoRenew,
      billingDB: BillingDB,
      userEmail: req.activeUser?.email || req.user?.email || null,
      userName: req.activeUser?.storeName || req.activeUser?.name || req.user?.name || null
    });
    if (!result.success) {
      return res.status(result.statusCode || 402).json({
        error: result.error,
        code: result.code || 'PAYMENT_REQUIRED',
        requiredAmount: result.requiredAmount,
        availableCredits: result.availableCredits,
        shortfall: result.shortfall,
        packages: result.packages
      });
    }
    res.json({
      success: true,
      subscription: result.subscription,
      billing: result.chargeResult || result.billing,
      orderNumber: result.orderNumber || result.chargeResult?.orderNumber || result.invoice?.orderNumber || null,
      invoice: result.invoice || result.chargeResult?.invoice || null,
      message: `${result.subscription?.planName || 'Discord Bot'} subscription activated.`
    });
  } catch (err) {
    console.error('[Discord API] Purchase subscription error:', err);
    res.status(500).json({ error: err.message || 'Failed to activate Discord Bot subscription' });
  }
});

router.patch('/subscription/auto-renew', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { autoRenew } = req.body || {};
    if (typeof autoRenew !== 'boolean') {
      return res.status(400).json({ error: 'autoRenew boolean is required.' });
    }
    const result = await setServiceAutoRenew({
      userId,
      serviceType: 'discord',
      autoRenew
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: result.error,
        code: result.code
      });
    }
    res.json({
      success: true,
      subscription: result.subscription,
      message: `Discord Bot auto-renewal ${autoRenew ? 'enabled' : 'disabled'}.`
    });
  } catch (err) {
    console.error('[Discord API] Toggle auto-renew error:', err);
    res.status(500).json({ error: 'Failed to update Discord auto-renewal setting' });
  }
});

router.get('/subscription/notifications', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await listServiceNotifications(userId, {
      serviceType: 'discord',
      unreadOnly
    });
    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.readAt).length
    });
  } catch (err) {
    console.error('[Discord API] List notifications error:', err);
    res.status(500).json({ error: 'Failed to load Discord subscription notifications' });
  }
});

router.post('/subscription/notifications/read', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const result = await markServiceNotificationsRead(userId, {
      serviceType: 'discord',
      notificationId: req.body?.notificationId || null
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Discord API] Mark notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark Discord notifications as read' });
  }
});

router.get('/official-bots', async (req, res) => {
  try {
    const officialBots = await DiscordDB.getOfficialBots({ activeOnly: true });
    res.json({ success: true, officialBots });
  } catch (err) {
    console.error('[Discord API] Get official bots error:', err);
    res.status(500).json({ error: 'Failed to retrieve Official Tiwlo Discord bots' });
  }
});

// ==========================================
// 1. OVERVIEW & STATS (REAL DATA ONLY)
// ==========================================
router.get('/overview', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const data = await DiscordDB.getOverview(userId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[Discord API] Overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve Discord workspace overview' });
  }
});

// ==========================================
// 2. BOTS MANAGEMENT (CUSTOM BOT CREATION LOCKED DOWN)
// ==========================================
router.get('/bots', async (req, res) => {
  try {
    const officialBots = await DiscordDB.getOfficialBots({ activeOnly: true });
    res.json({ success: true, bots: officialBots, officialBots });
  } catch (err) {
    console.error('[Discord API] Get bots error:', err);
    res.status(500).json({ error: 'Failed to retrieve bots' });
  }
});

router.post('/bots', async (req, res) => {
  if (!isAdminUser(req.activeUser || req.user)) {
    return res.status(403).json({
      error: 'Custom Discord bot registration is disabled. Connect your Discord server to the Official Tiwlo Discord AI Bot instead.',
      code: 'CUSTOM_BOT_DISABLED'
    });
  }
  try {
    const userId = getAuthUserId(req);
    const { name, token, clientId, prefix, status, description, avatar } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bot name is required' });
    }

    const bot = await DiscordDB.createBot(userId, {
      name,
      token,
      clientId,
      prefix,
      status: status || 'offline',
      description,
      avatar
    });

    res.status(201).json({ success: true, bot, message: 'Bot registered successfully' });
  } catch (err) {
    console.error('[Discord API] Create bot error:', err);
    res.status(500).json({ error: err.message || 'Failed to create bot' });
  }
});

router.get('/bots/:id', async (req, res) => {
  try {
    const official = await DiscordDB.getOfficialBotById(req.params.id);
    if (official) {
      return res.json({ success: true, bot: official });
    }
    const userId = getAuthUserId(req);
    const bot = await DiscordDB.getBotById(userId, req.params.id);
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ success: true, bot });
  } catch (err) {
    console.error('[Discord API] Get bot error:', err);
    res.status(500).json({ error: 'Failed to retrieve bot' });
  }
});

router.put('/bots/:id', async (req, res) => {
  if (!isAdminUser(req.activeUser || req.user)) {
    return res.status(403).json({
      error: 'Custom Discord bot editing is disabled. Configure your server modules under Connected Servers.',
      code: 'CUSTOM_BOT_DISABLED'
    });
  }
  try {
    const userId = getAuthUserId(req);
    const updated = await DiscordDB.updateBot(userId, req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json({ success: true, bot: updated, message: 'Bot updated successfully' });
  } catch (err) {
    console.error('[Discord API] Update bot error:', err);
    res.status(500).json({ error: err.message || 'Failed to update bot' });
  }
});

router.delete('/bots/:id', async (req, res) => {
  if (!isAdminUser(req.activeUser || req.user)) {
    return res.status(403).json({
      error: 'Custom Discord bot deletion is disabled.',
      code: 'CUSTOM_BOT_DISABLED'
    });
  }
  try {
    const userId = getAuthUserId(req);
    await DiscordDB.deleteBot(userId, req.params.id);
    res.json({ success: true, message: 'Bot deleted successfully' });
  } catch (err) {
    console.error('[Discord API] Delete bot error:', err);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// ==========================================
// 3. SERVERS (GUILDS) MANAGEMENT (SUBSCRIPTION GATED)
// ==========================================
router.get('/servers', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const servers = await DiscordDB.getServers(userId);
    res.json({ success: true, servers });
  } catch (err) {
    console.error('[Discord API] Get servers error:', err);
    res.status(500).json({ error: 'Failed to retrieve servers' });
  }
});

router.post('/servers', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { name, icon, memberCount, guildId, botId, officialBotId, aiConfig } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Server name is required' });
    }

    const currentServers = await DiscordDB.getServers(userId);
    const gate = await checkServiceLimit(userId, 'discord', { serversCount: currentServers.length });
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        metric: gate.metric,
        limit: gate.limit,
        current: gate.current,
        packages: gate.packages
      });
    }

    let resolvedOfficialBotId = officialBotId || null;
    if (resolvedOfficialBotId) {
      const bot = await DiscordDB.getOfficialBotById(resolvedOfficialBotId);
      if (!bot || !bot.isActive) {
        return res.status(400).json({ error: 'Selected Official Tiwlo Discord bot is unavailable.' });
      }
    } else {
      const activeOfficialBots = await DiscordDB.getOfficialBots({ activeOnly: true });
      if (activeOfficialBots.length > 0) {
        resolvedOfficialBotId = activeOfficialBots[0].id;
      }
    }

    if (aiConfig?.autoMod?.enabled && !gate.limits?.autoModEnabled) {
      return res.status(403).json({
        error: 'Auto-Moderation is not included in your current Discord Bot package. Please upgrade your plan.',
        code: 'FEATURE_NOT_IN_PLAN'
      });
    }

    const server = await DiscordDB.createServer(userId, {
      name,
      icon,
      memberCount: memberCount || 0,
      guildId,
      botId,
      officialBotId: resolvedOfficialBotId,
      aiConfig
    });

    res.status(201).json({ success: true, server, message: 'Server connected to Official Tiwlo AI Bot successfully' });
  } catch (err) {
    console.error('[Discord API] Create server error:', err);
    res.status(500).json({ error: err.message || 'Failed to connect server' });
  }
});

router.get('/servers/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const server = await DiscordDB.getServerById(userId, req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json({ success: true, server });
  } catch (err) {
    console.error('[Discord API] Get server error:', err);
    res.status(500).json({ error: 'Failed to retrieve server' });
  }
});

router.put('/servers/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const gate = await checkServiceLimit(userId, 'discord', {});
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        packages: gate.packages
      });
    }
    if (req.body?.aiConfig?.autoMod?.enabled && !gate.limits?.autoModEnabled) {
      return res.status(403).json({
        error: 'Auto-Moderation is not included in your current Discord Bot package.',
        code: 'FEATURE_NOT_IN_PLAN'
      });
    }
    const updated = await DiscordDB.updateServer(userId, req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json({ success: true, server: updated, message: 'Server updated successfully' });
  } catch (err) {
    console.error('[Discord API] Update server error:', err);
    res.status(500).json({ error: err.message || 'Failed to update server' });
  }
});

router.put('/servers/:id/ai-config', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const gate = await checkServiceLimit(userId, 'discord', {});
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        packages: gate.packages
      });
    }
    const aiConfig = req.body?.aiConfig || req.body || {};
    if (aiConfig?.autoMod?.enabled && !gate.limits?.autoModEnabled) {
      return res.status(403).json({
        error: 'Auto-Moderation requires Discord Pro or higher.',
        code: 'FEATURE_NOT_IN_PLAN'
      });
    }
    const updated = await DiscordDB.updateServer(userId, req.params.id, { aiConfig });
    if (!updated) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json({ success: true, server: updated, message: 'AI Bot server configuration saved' });
  } catch (err) {
    console.error('[Discord API] Save AI config error:', err);
    res.status(500).json({ error: err.message || 'Failed to save AI Bot server configuration' });
  }
});

router.post('/servers/:id/simulate', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const existing = await DiscordDB.getServerById(userId, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Server not found' });
    }
    if (existing.isSuspended) {
      return res.status(403).json({ error: 'This server connection has been suspended by an administrator.', code: 'SERVER_SUSPENDED' });
    }
    const gate = await checkServiceLimit(userId, 'discord', { checkCommands: true });
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        metric: gate.metric,
        limit: gate.limit,
        current: gate.current,
        packages: gate.packages
      });
    }
    const amount = Math.max(1, Math.min(25, Number(req.body?.count) || 1));
    const subscription = await incrementServiceUsage(userId, 'discord', 'monthlyCommands', amount);
    const server = await DiscordDB.incrementServerCommands(userId, req.params.id, amount);
    res.json({
      success: true,
      server,
      subscription,
      reply: `Official Tiwlo AI (${existing.aiConfig?.personaName || 'Tiwlo AI'}) processed command in ${existing.name}.`
    });
  } catch (err) {
    console.error('[Discord API] Simulate command error:', err);
    res.status(500).json({ error: err.message || 'Failed to execute AI command' });
  }
});

router.delete('/servers/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    await DiscordDB.deleteServer(userId, req.params.id);
    res.json({ success: true, message: 'Server deleted successfully' });
  } catch (err) {
    console.error('[Discord API] Delete server error:', err);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

router.post('/servers/:id/bots', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { botId } = req.body || {};
    if (!botId) return res.status(400).json({ error: 'Bot ID is required' });
    await DiscordDB.assignBotToServer(userId, botId, req.params.id);
    const server = await DiscordDB.getServerById(userId, req.params.id);
    res.json({ success: true, server, message: 'Bot assigned to server' });
  } catch (err) {
    console.error('[Discord API] Assign bot error:', err);
    res.status(500).json({ error: 'Failed to assign bot to server' });
  }
});

router.delete('/servers/:id/bots/:botId', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    await DiscordDB.removeBotFromServer(userId, req.params.botId, req.params.id);
    const server = await DiscordDB.getServerById(userId, req.params.id);
    res.json({ success: true, server, message: 'Bot removed from server' });
  } catch (err) {
    console.error('[Discord API] Remove bot error:', err);
    res.status(500).json({ error: 'Failed to remove bot from server' });
  }
});

// ==========================================
// 4. ACTIVITIES & AUDIT LOG
// ==========================================
router.get('/activities', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const limit = parseInt(req.query.limit || '20', 10);
    const activities = await DiscordDB.getRecentActivities(userId, limit);
    res.json({ success: true, activities });
  } catch (err) {
    console.error('[Discord API] Get activities error:', err);
    res.status(500).json({ error: 'Failed to retrieve activities' });
  }
});

// ==========================================
// 5. AUTOMATIONS (WELCOME, AUTO-ROLES, COMMANDS)
// ==========================================
router.get('/automations', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const type = req.query.type || null;
    const automations = await DiscordDB.getAutomations(userId, type);
    res.json({ success: true, automations });
  } catch (err) {
    console.error('[Discord API] Get automations error:', err);
    res.status(500).json({ error: 'Failed to retrieve automations' });
  }
});

router.post('/automations', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const gate = await checkServiceLimit(userId, 'discord', {});
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        packages: gate.packages
      });
    }
    if (String(req.body?.type || '').toLowerCase() === 'moderation' && !gate.limits?.autoModEnabled) {
      return res.status(403).json({
        error: 'Moderation automations require Discord Pro or higher.',
        code: 'FEATURE_NOT_IN_PLAN'
      });
    }
    const saved = await DiscordDB.saveAutomation(userId, req.body || {});
    res.json({ success: true, automation: saved, message: 'Automation saved successfully' });
  } catch (err) {
    console.error('[Discord API] Save automation error:', err);
    res.status(500).json({ error: err.message || 'Failed to save automation' });
  }
});

// ==========================================
// 6. TICKETS
// ==========================================
router.get('/tickets', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const tickets = await DiscordDB.getTickets(userId);
    res.json({ success: true, tickets });
  } catch (err) {
    console.error('[Discord API] Get tickets error:', err);
    res.status(500).json({ error: 'Failed to retrieve tickets' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const gate = await checkServiceLimit(userId, 'discord', {});
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        packages: gate.packages
      });
    }
    const ticket = await DiscordDB.createTicket(userId, req.body || {});
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    console.error('[Discord API] Create ticket error:', err);
    res.status(500).json({ error: err.message || 'Failed to create ticket' });
  }
});

// ==========================================
// 7. MARKETPLACE
// ==========================================
router.get('/marketplace', async (req, res) => {
  try {
    const { category, pricing, search, sort } = req.query || {};
    const products = await DiscordDB.getMarketplaceProducts({
      category: category || 'all',
      pricing: pricing || 'all',
      search: search || '',
      sort: sort || 'recommended'
    });
    res.json({ success: true, count: products.length, total: products.length, products });
  } catch (err) {
    console.error('[Discord API] Marketplace products error:', err);
    res.status(500).json({ error: 'Failed to retrieve marketplace products' });
  }
});

router.get('/marketplace/:id', async (req, res) => {
  try {
    const product = await DiscordDB.getMarketplaceProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Marketplace product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    console.error('[Discord API] Marketplace product detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve marketplace product' });
  }
});

router.post('/marketplace/:id/install', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { serviceName, logoUrl, planId } = req.body || {};
    if (typeof serviceName !== 'string' || !serviceName.trim()) {
      return res.status(400).json({ error: 'Workspace service name is required.' });
    }
    if (serviceName.trim().length > 255) {
      return res.status(400).json({ error: 'Workspace service name must be 255 characters or fewer.' });
    }
    if (logoUrl != null) {
      if (typeof logoUrl !== 'string' || logoUrl.length > 2048) {
        return res.status(400).json({ error: 'Workspace icon URL is invalid.' });
      }
      let iconUrl;
      try {
        iconUrl = new URL(logoUrl, `${req.protocol}://${req.get('host')}`);
      } catch {
        return res.status(400).json({ error: 'Workspace icon URL is invalid.' });
      }
      const trustedHost = iconUrl.hostname === PLATFORM_CONFIG.primaryDomain ||
        iconUrl.hostname.endsWith(`.${PLATFORM_CONFIG.primaryDomain}`) ||
        iconUrl.hostname === 'localhost' || iconUrl.hostname.endsWith('.localhost');
      const secureProtocol = iconUrl.protocol === 'https:' ||
        (iconUrl.protocol === 'http:' && (iconUrl.hostname === 'localhost' || iconUrl.hostname.endsWith('.localhost')));
      if (!trustedHost || !secureProtocol || !/^\/uploads\/[^/]+$/.test(iconUrl.pathname)) {
        return res.status(400).json({ error: 'Workspace icons must use an uploaded Tiwlo image.' });
      }
    }

    const paidServiceType =
      req.params.id === 'tiwlo-discord-bot-manager' ? 'discord'
        : req.params.id === 'tiwlo-whatsapp-automation' ? 'whatsapp'
        : null;

    let resolvedPlanName = null;
    let subscription = null;
    let billing = null;
    let orderNumber = null;
    let invoice = null;

    if (paidServiceType) {
      if (planId && typeof planId === 'string') {
        const purchase = await subscribeServiceWithCredits({
          userId,
          userRole: req.activeUser?.role || req.user?.role,
          serviceType: paidServiceType,
          planId,
          billingDB: BillingDB,
          userEmail: req.activeUser?.email || req.user?.email || null,
          userName: req.activeUser?.storeName || req.activeUser?.name || req.user?.name || null
        });
        if (!purchase.success) {
          return res.status(purchase.statusCode || 402).json({
            error: purchase.error,
            code: purchase.code || 'PAYMENT_REQUIRED',
            serviceType: paidServiceType,
            requiredAmount: purchase.requiredAmount,
            availableCredits: purchase.availableCredits,
            shortfall: purchase.shortfall,
            packages: purchase.packages
          });
        }
        subscription = purchase.subscription;
        billing = purchase.chargeResult || purchase.billing;
        orderNumber = purchase.orderNumber || billing?.orderNumber || purchase.invoice?.orderNumber || null;
        invoice = purchase.invoice || billing?.invoice || null;
        resolvedPlanName = subscription?.planName || null;
      } else {
        const activeSub = await getServiceSubscription(userId, paidServiceType);
        const notExpired = !activeSub?.expiresAt || new Date(activeSub.expiresAt).getTime() > Date.now();
        if (!activeSub || activeSub.status !== 'active' || !notExpired) {
          const packages = paidServiceType === 'discord'
            ? await getDiscordPackages()
            : await getWhatsappPackages();
          return res.status(402).json({
            error: `A paid ${paidServiceType === 'discord' ? 'Discord Bot' : 'WhatsApp Bot'} subscription package is required to activate this service.`,
            code: 'SUBSCRIPTION_REQUIRED',
            serviceType: paidServiceType,
            packages
          });
        }
        subscription = activeSub;
        resolvedPlanName = activeSub.planName || null;
      }
    }

    const result = await DiscordDB.activateMarketplaceProduct(userId, req.params.id, {
      serviceName,
      logoUrl: logoUrl || null,
      planName: resolvedPlanName
    });
    res.status(201).json({ success: true, ...result, subscription, billing, orderNumber, invoice });
  } catch (err) {
    const status = err.message === 'Marketplace product not found.' ? 404
      : err.message.includes('already exists') ? 409
      : err.message.includes('service name is required') ? 400
      : 500;
    if (status === 500) console.error('[Discord API] Marketplace activation error:', err);
    res.status(status).json({ error: status === 500 ? 'Failed to enable Marketplace product in Workspace.' : err.message });
  }
});

// ==========================================
// 8. WORKSPACE ENDPOINTS
// ==========================================
router.get('/workspace', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { search, filter } = req.query || {};
    const [workspace, stores, droplets] = await Promise.all([
      DiscordDB.getWorkspace(userId, { search, filter }),
      MasterDB.getUserStores(userId),
      CloudDB.getDroplets(userId)
    ]);
    const query = String(search || '').trim().toLowerCase();
    workspace.services = [
      ...workspace.services,
      ...stores.map(mapStoreWorkspaceService),
      ...droplets.map(mapDropletWorkspaceService)
    ].filter(service => !query || [
      service.name, service.productName, service.category, service.serverName, service.status,
      service.plan, service.usageLabel
    ].some(value => String(value || '').toLowerCase().includes(query)));
    workspace.totalServices = workspace.services.length;
    res.json({ success: true, workspace });
  } catch (err) {
    console.error('[Discord API] Workspace error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace data' });
  }
});

router.get('/workspace/services/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const service = await DiscordDB.getWorkspaceServiceById(userId, req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Workspace service not found' });
    }
    res.json({ success: true, service });
  } catch (err) {
    console.error('[Discord API] Get workspace service error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace service' });
  }
});

router.put('/workspace/services/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const service = await DiscordDB.updateWorkspaceService(userId, req.params.id, req.body || {});
    res.json({ success: true, service });
  } catch (err) {
    console.error('[Discord API] Update workspace service error:', err);
    res.status(500).json({ error: err.message || 'Failed to update service' });
  }
});

router.delete('/workspace/services/:id', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const result = await DiscordDB.deleteWorkspaceService(userId, req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[Discord API] Delete workspace service error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete service' });
  }
});

router.get('/workspace/operations', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const operations = await DiscordDB.getWorkspaceOperations(userId);
    res.json({ success: true, operations });
  } catch (err) {
    console.error('[Discord API] Workspace operations error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace operations' });
  }
});

router.post('/workspace/refresh', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const workspace = await DiscordDB.getWorkspace(userId);
    const [stores, droplets] = await Promise.all([
      MasterDB.getUserStores(userId),
      CloudDB.getDroplets(userId)
    ]);
    workspace.services = [
      ...workspace.services,
      ...stores.map(mapStoreWorkspaceService),
      ...droplets.map(mapDropletWorkspaceService)
    ];
    workspace.totalServices = workspace.services.length;
    res.json({ success: true, workspace });
  } catch (err) {
    console.error('[Discord API] Refresh workspace error:', err);
    res.status(500).json({ error: 'Failed to refresh workspace' });
  }
});

// ==========================================
// 9. ADMIN PANEL DISCORD MANAGEMENT
// ==========================================
router.get('/admin/packages', requireDiscordAdmin, async (req, res) => {
  try {
    const packages = await getDiscordPackages({ includeDisabled: true });
    res.json({ success: true, packages });
  } catch (err) {
    console.error('[Discord Admin] Get packages error:', err);
    res.status(500).json({ error: 'Failed to load Discord Bot packages' });
  }
});

router.put('/admin/packages', requireDiscordAdmin, async (req, res) => {
  try {
    const { packages } = req.body || {};
    if (!Array.isArray(packages)) {
      return res.status(400).json({ error: 'packages array is required.' });
    }
    const saved = await saveDiscordPackages(packages);
    res.json({ success: true, packages: saved, message: 'Discord Bot packages updated successfully.' });
  } catch (err) {
    console.error('[Discord Admin] Save packages error:', err);
    res.status(400).json({ error: err.message || 'Failed to update Discord Bot packages' });
  }
});

router.get('/admin/official-bots', requireDiscordAdmin, async (req, res) => {
  try {
    const officialBots = await DiscordDB.getOfficialBots({ activeOnly: false });
    res.json({ success: true, officialBots });
  } catch (err) {
    console.error('[Discord Admin] Get official bots error:', err);
    res.status(500).json({ error: 'Failed to retrieve Official Discord bots' });
  }
});

router.post('/admin/official-bots', requireDiscordAdmin, async (req, res) => {
  try {
    const hasTokenWrite = typeof req.body?.botToken === 'string' && req.body.botToken.trim().length > 0;
    if (hasTokenWrite && !isSuperAdminUser(req.activeUser || req.user)) {
      return res.status(403).json({ error: 'Super Administrator role is required to write or rotate a Discord bot token.' });
    }
    const bot = await DiscordDB.createOfficialBot(req.body || {});
    res.status(201).json({ success: true, bot, message: 'Official Tiwlo Discord bot saved.' });
  } catch (err) {
    console.error('[Discord Admin] Create official bot error:', err);
    res.status(400).json({ error: err.message || 'Failed to create Official Discord bot' });
  }
});

router.put('/admin/official-bots/:id', requireDiscordAdmin, async (req, res) => {
  try {
    const hasTokenWrite = typeof req.body?.botToken === 'string' && req.body.botToken.trim().length > 0;
    if (hasTokenWrite && !isSuperAdminUser(req.activeUser || req.user)) {
      return res.status(403).json({ error: 'Super Administrator role is required to write or rotate a Discord bot token.' });
    }
    const bot = await DiscordDB.updateOfficialBot(req.params.id, req.body || {});
    if (!bot) {
      return res.status(404).json({ error: 'Official Discord bot not found' });
    }
    res.json({ success: true, bot, message: 'Official Tiwlo Discord bot updated.' });
  } catch (err) {
    console.error('[Discord Admin] Update official bot error:', err);
    res.status(400).json({ error: err.message || 'Failed to update Official Discord bot' });
  }
});

router.delete('/admin/official-bots/:id', requireDiscordSuperAdmin, async (req, res) => {
  try {
    const deleted = await DiscordDB.deleteOfficialBot(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Official Discord bot not found' });
    }
    res.json({ success: true, message: 'Official Tiwlo Discord bot deleted.' });
  } catch (err) {
    console.error('[Discord Admin] Delete official bot error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete Official Discord bot' });
  }
});

router.get('/admin/servers', requireDiscordAdmin, async (req, res) => {
  try {
    const result = await DiscordDB.adminListServers({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      status: req.query.status
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Discord Admin] List servers error:', err);
    res.status(500).json({ error: 'Failed to retrieve connected Discord servers' });
  }
});

router.post('/admin/servers/:guildId/toggle', requireDiscordAdmin, async (req, res) => {
  try {
    const server = await DiscordDB.adminToggleServerSuspension(req.params.guildId, req.body?.suspended);
    if (!server) {
      return res.status(404).json({ error: 'Connected Discord server not found' });
    }
    res.json({
      success: true,
      server,
      message: server.isSuspended ? 'Discord server suspended.' : 'Discord server reactivated.'
    });
  } catch (err) {
    console.error('[Discord Admin] Toggle server error:', err);
    res.status(500).json({ error: err.message || 'Failed to toggle Discord server status' });
  }
});

router.delete('/admin/servers/:guildId', requireDiscordAdmin, async (req, res) => {
  try {
    const revoked = await DiscordDB.adminRevokeServer(req.params.guildId);
    if (!revoked) {
      return res.status(404).json({ error: 'Connected Discord server not found' });
    }
    res.json({ success: true, message: 'Discord server disconnected and revoked.' });
  } catch (err) {
    console.error('[Discord Admin] Revoke server error:', err);
    res.status(500).json({ error: err.message || 'Failed to revoke Discord server' });
  }
});

router.get('/admin/orders', requireDiscordAdmin, async (req, res) => {
  try {
    const result = await listServiceOrders({
      serviceType: 'discord',
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Discord Admin] List orders error:', err);
    res.status(500).json({ error: 'Failed to load Discord Bot orders' });
  }
});

export default router;
