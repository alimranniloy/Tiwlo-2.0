import express from 'express';
import { DiscordDB } from './discordDb.js';

const router = express.Router();

// Helper to get authenticated user ID
function getAuthUserId(req) {
  return req.activeUser?.id || req.user?.id || req.session?.userId || null;
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

router.use(requireDiscordAuth);

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
// 2. BOTS MANAGEMENT
// ==========================================
router.get('/bots', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const bots = await DiscordDB.getBots(userId);
    res.json({ success: true, bots });
  } catch (err) {
    console.error('[Discord API] Get bots error:', err);
    res.status(500).json({ error: 'Failed to retrieve bots' });
  }
});

router.post('/bots', async (req, res) => {
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
      status: status || 'online',
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
// 3. SERVERS (GUILDS) MANAGEMENT
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
    const { name, icon, memberCount, guildId, botId } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Server name is required' });
    }

    const server = await DiscordDB.createServer(userId, {
      name,
      icon,
      memberCount: memberCount || 0,
      guildId,
      botId
    });

    res.status(201).json({ success: true, server, message: 'Server connected successfully' });
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
    res.json({ success: true, count: products.length, total: 128, products });
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
    const { serverId } = req.body || {};
    const result = await DiscordDB.installMarketplaceProduct(userId, req.params.id, serverId);
    res.json(result);
  } catch (err) {
    console.error('[Discord API] Install marketplace product error:', err);
    res.status(500).json({ error: err.message || 'Failed to install product' });
  }
});

// ==========================================
// 8. WORKSPACE ENDPOINTS
// ==========================================
router.get('/workspace', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { search, filter } = req.query || {};
    const workspace = await DiscordDB.getWorkspace(userId, { search, filter });
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

router.post('/workspace/services', async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const service = await DiscordDB.activateWorkspaceService(userId, req.body || {});
    res.status(201).json({ success: true, service });
  } catch (err) {
    console.error('[Discord API] Activate workspace service error:', err);
    res.status(500).json({ error: err.message || 'Failed to activate service' });
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
    res.json({ success: true, workspace });
  } catch (err) {
    console.error('[Discord API] Refresh workspace error:', err);
    res.status(500).json({ error: 'Failed to refresh workspace' });
  }
});

export default router;

