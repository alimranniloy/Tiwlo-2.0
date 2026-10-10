import { queryPg } from '../db/postgres.js';
import { ensureDiscordSchema } from './discordSchema.js';

const DEMO_PRODUCT_IDS = [
  'prod_sentinel',
  'prod_ticketflow',
  'prod_levelup',
  'prod_insight',
  'prod_welcome',
  'prod_eventkit'
];
const DEMO_SERVICE_IDS = [...DEMO_PRODUCT_IDS, 'prod_autoroles'];
const DEMO_SERVICE_RECORD_IDS = [
  'ws_sentinel',
  'ws_ticketflow',
  'ws_insight',
  'ws_eventkit',
  'ws_welcome',
  'ws_autoroles'
];

const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const requireUser = (userId) => {
  if (!userId) throw new Error('User authentication required.');
};

const mapBot = (row) => row ? ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  token: row.token,
  clientId: row.client_id,
  avatar: row.avatar,
  prefix: row.prefix || '!',
  status: row.status || 'offline',
  description: row.description || '',
  commandsToday: Number(row.commands_today) || 0,
  serversCount: Number(row.servers_count) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at
}) : null;

const mapServer = (row) => row ? ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  icon: row.icon,
  memberCount: Number(row.member_count) || 0,
  guildId: row.guild_id,
  bots: row.bots || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at
}) : null;

const mapService = (row) => ({
  id: row.id,
  userId: row.user_id,
  serviceId: row.service_id,
  name: row.name,
  category: row.category,
  iconType: row.icon_type,
  status: row.status,
  serverId: row.server_id,
  serverName: row.server_name,
  plan: row.plan,
  usageCurrent: row.usage_current == null ? null : Number(row.usage_current),
  usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
  usageLabel: row.usage_label,
  renewalDate: row.renewal_date,
  logoUrl: row.logo_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapOperation = (row) => ({
  id: row.id,
  userId: row.user_id,
  operation: row.operation,
  serviceId: row.service_id,
  serviceName: row.service_name,
  result: row.result,
  timeAgo: row.time_ago,
  createdAt: row.created_at
});

export const DiscordDB = {
  async init() {
    await ensureDiscordSchema({ query: queryPg });
  },

  async getOverview(userId) {
    requireUser(userId);
    const [bots, servers, recentActivities] = await Promise.all([
      this.getBots(userId),
      this.getServers(userId),
      this.getRecentActivities(userId, 10)
    ]);
    return {
      botsRegisteredCount: bots.length,
      connectedServersCount: servers.length,
      totalMembersCount: servers.reduce((total, server) => total + server.memberCount, 0),
      servers,
      bots,
      recentActivities
    };
  },

  async getBots(userId) {
    requireUser(userId);
    const result = await queryPg(`
      SELECT b.*,
        (SELECT COUNT(*) FROM discord_bot_servers bs WHERE bs.bot_id = b.id) AS servers_count
      FROM discord_bots b
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [userId]);
    return (result.rows || []).map(mapBot);
  },

  async getBotById(userId, botId) {
    requireUser(userId);
    const result = await queryPg(`
      SELECT b.*,
        (SELECT COUNT(*) FROM discord_bot_servers bs WHERE bs.bot_id = b.id) AS servers_count
      FROM discord_bots b
      WHERE b.user_id = $1 AND b.id = $2
    `, [userId, botId]);
    return mapBot(result.rows?.[0]);
  },

  async createBot(userId, data) {
    requireUser(userId);
    if (!data?.name?.trim()) throw new Error('Bot name is required.');
    const id = makeId('bot');
    await queryPg(`
      INSERT INTO discord_bots
        (id, user_id, name, token, client_id, avatar, prefix, status, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      id, userId, data.name.trim(), data.token?.trim() || null, data.clientId?.trim() || null,
      data.avatar || null, data.prefix?.trim() || '!', data.status || 'offline',
      data.description?.trim() || ''
    ]);
    const bot = await this.getBotById(userId, id);
    await this.logActivity(userId, {
      botId: id,
      title: `Bot "${bot.name}" created`,
      description: `Initial bot registration with prefix "${bot.prefix}"`,
      actionType: 'bot_created'
    });
    return bot;
  },

  async updateBot(userId, botId, data = {}) {
    requireUser(userId);
    const result = await queryPg(`
      UPDATE discord_bots
      SET name = COALESCE($1, name),
          prefix = COALESCE($2, prefix),
          status = COALESCE($3, status),
          description = COALESCE($4, description),
          token = COALESCE($5, token),
          client_id = COALESCE($6, client_id),
          avatar = COALESCE($7, avatar),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND user_id = $9
      RETURNING id
    `, [
      data.name ?? null, data.prefix ?? null, data.status ?? null, data.description ?? null,
      data.token ?? null, data.clientId ?? null, data.avatar ?? null, botId, userId
    ]);
    return result.rows?.[0] ? this.getBotById(userId, botId) : null;
  },

  async deleteBot(userId, botId) {
    requireUser(userId);
    await queryPg('DELETE FROM discord_bots WHERE id = $1 AND user_id = $2', [botId, userId]);
    return true;
  },

  async getServers(userId) {
    requireUser(userId);
    const result = await queryPg(`
      SELECT s.*,
        COALESCE(
          json_agg(json_build_object(
            'id', b.id, 'name', b.name, 'status', b.status, 'avatar', b.avatar
          )) FILTER (WHERE b.id IS NOT NULL), '[]'
        ) AS bots
      FROM discord_servers s
      LEFT JOIN discord_bot_servers bs ON bs.server_id = s.id
      LEFT JOIN discord_bots b ON b.id = bs.bot_id AND b.user_id = s.user_id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [userId]);
    return (result.rows || []).map(mapServer);
  },

  async getServerById(userId, serverId) {
    const servers = await this.getServers(userId);
    return servers.find((server) => server.id === serverId) || null;
  },

  async createServer(userId, data) {
    requireUser(userId);
    if (!data?.name?.trim()) throw new Error('Server name is required.');
    const id = makeId('srv');
    await queryPg(`
      INSERT INTO discord_servers (id, user_id, name, icon, member_count, guild_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      id,
      userId,
      data.name.trim(),
      data.icon || null,
      Math.max(0, Number.parseInt(data.memberCount ?? '0', 10) || 0),
      data.guildId?.trim() || null
    ]);
    if (data.botId) await this.assignBotToServer(userId, data.botId, id);
    await this.logActivity(userId, {
      serverId: id,
      title: `Server "${data.name.trim()}" connected`,
      description: 'Discord server record added to the account.',
      actionType: 'server_connected'
    });
    return this.getServerById(userId, id);
  },

  async updateServer(userId, serverId, data = {}) {
    requireUser(userId);
    const result = await queryPg(`
      UPDATE discord_servers
      SET name = COALESCE($1, name),
          member_count = COALESCE($2, member_count),
          icon = COALESCE($3, icon),
          guild_id = COALESCE($4, guild_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND user_id = $6
      RETURNING id
    `, [
      data.name ?? null,
      data.memberCount == null ? null : Math.max(0, Number.parseInt(data.memberCount, 10) || 0),
      data.icon ?? null,
      data.guildId ?? null,
      serverId,
      userId
    ]);
    return result.rows?.[0] ? this.getServerById(userId, serverId) : null;
  },

  async deleteServer(userId, serverId) {
    requireUser(userId);
    await queryPg('DELETE FROM discord_servers WHERE id = $1 AND user_id = $2', [serverId, userId]);
    return true;
  },

  async assignBotToServer(userId, botId, serverId) {
    requireUser(userId);
    const result = await queryPg(`
      INSERT INTO discord_bot_servers (id, bot_id, server_id)
      SELECT $1, b.id, s.id
      FROM discord_bots b
      JOIN discord_servers s ON s.id = $3 AND s.user_id = $4
      WHERE b.id = $2 AND b.user_id = $4
      ON CONFLICT (bot_id, server_id) DO NOTHING
      RETURNING id
    `, [makeId('bs'), botId, serverId, userId]);
    if (!result.rowCount) {
      const exists = await queryPg(`
        SELECT 1 FROM discord_bot_servers bs
        JOIN discord_bots b ON b.id = bs.bot_id AND b.user_id = $3
        JOIN discord_servers s ON s.id = bs.server_id AND s.user_id = $3
        WHERE bs.bot_id = $1 AND bs.server_id = $2
      `, [botId, serverId, userId]);
      if (!exists.rowCount) throw new Error('Bot or server not found for this account.');
    }
    return true;
  },

  async removeBotFromServer(userId, botId, serverId) {
    requireUser(userId);
    await queryPg(`
      DELETE FROM discord_bot_servers bs
      USING discord_bots b, discord_servers s
      WHERE bs.bot_id = b.id AND bs.server_id = s.id
        AND b.user_id = $1 AND s.user_id = $1
        AND bs.bot_id = $2 AND bs.server_id = $3
    `, [userId, botId, serverId]);
    return true;
  },

  async getRecentActivities(userId, limit = 20) {
    requireUser(userId);
    const boundedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20));
    const result = await queryPg(`
      SELECT * FROM discord_activities
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, boundedLimit]);
    return (result.rows || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      botId: row.bot_id,
      serverId: row.server_id,
      title: row.title,
      description: row.description,
      actionType: row.action_type,
      createdAt: row.created_at
    }));
  },

  async logActivity(userId, { botId = null, serverId = null, title, description = '', actionType = 'general' }) {
    requireUser(userId);
    if (!title) throw new Error('Activity title is required.');
    const id = makeId('act');
    await queryPg(`
      INSERT INTO discord_activities
        (id, user_id, bot_id, server_id, title, description, action_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, userId, botId, serverId, title, description, actionType]);
    return { id, userId, botId, serverId, title, description, actionType, createdAt: new Date().toISOString() };
  },

  async getAutomations(userId, type = null) {
    requireUser(userId);
    const values = [userId];
    let typeFilter = '';
    if (type) {
      values.push(type);
      typeFilter = ' AND type = $2';
    }
    const result = await queryPg(`
      SELECT * FROM discord_automations
      WHERE user_id = $1${typeFilter}
      ORDER BY created_at DESC
    `, values);
    return (result.rows || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      botId: row.bot_id,
      serverId: row.server_id,
      type: row.type,
      title: row.title,
      description: row.description,
      config: row.config || {},
      enabled: row.enabled !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  },

  async saveAutomation(userId, data) {
    requireUser(userId);
    if (!data?.title || !data?.type) throw new Error('Automation title and type are required.');
    const id = data.id || makeId('auto');
    const result = await queryPg(`
      INSERT INTO discord_automations
        (id, user_id, bot_id, server_id, type, title, description, config, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        config = EXCLUDED.config,
        enabled = EXCLUDED.enabled,
        updated_at = CURRENT_TIMESTAMP
      WHERE discord_automations.user_id = EXCLUDED.user_id
      RETURNING *
    `, [
      id, userId, data.botId || null, data.serverId || null, data.type, data.title,
      data.description || '', data.config || {}, data.enabled !== false
    ]);
    if (!result.rows?.[0]) throw new Error('Automation could not be saved for this account.');
    await this.logActivity(userId, {
      title: `Automation updated: ${data.title}`,
      description: `Configured automation of type ${data.type}`,
      actionType: 'automation_configured'
    });
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      botId: row.bot_id,
      serverId: row.server_id,
      type: row.type,
      title: row.title,
      description: row.description,
      config: row.config || {},
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  async getTickets(userId) {
    requireUser(userId);
    const result = await queryPg(`
      SELECT * FROM discord_tickets WHERE user_id = $1 ORDER BY created_at DESC
    `, [userId]);
    return (result.rows || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      serverId: row.server_id,
      channelName: row.channel_name,
      authorName: row.author_name,
      subject: row.subject,
      status: row.status,
      createdAt: row.created_at
    }));
  },

  async createTicket(userId, data = {}) {
    requireUser(userId);
    const id = makeId('tkt');
    const result = await queryPg(`
      INSERT INTO discord_tickets (id, user_id, server_id, channel_name, author_name, subject)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      id, userId, data.serverId || null, data.channelName || null,
      data.authorName || null, data.subject || null
    ]);
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      serverId: row.server_id,
      channelName: row.channel_name,
      authorName: row.author_name,
      subject: row.subject,
      status: row.status,
      createdAt: row.created_at
    };
  },

  async getMarketplaceProducts({ category = 'all', pricing = 'all', search = '', sort = 'recommended' } = {}) {
    const values = [];
    const filters = [
      'is_published = TRUE',
      'id::text <> ALL($1::text[])'
    ];
    values.push(DEMO_PRODUCT_IDS);
    if (category && category !== 'all') {
      values.push(category);
      filters.push(`LOWER(category) = LOWER($${values.length})`);
    }
    if (pricing && pricing !== 'all') {
      if (pricing === 'free') {
        filters.push("LOWER(pricing_type) IN ('free', 'freemium')");
      } else {
        values.push(pricing);
        filters.push(`LOWER(pricing_type) = LOWER($${values.length})`);
      }
    }
    if (search?.trim()) {
      values.push(`%${search.trim()}%`);
      filters.push(`(name ILIKE $${values.length} OR developer ILIKE $${values.length} OR category ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    const orderBy = sort === 'rating' ? 'rating DESC NULLS LAST, name ASC'
      : sort === 'name' ? 'name ASC'
      : 'install_count DESC NULLS LAST, name ASC';
    const result = await queryPg(`
      SELECT id, name, developer, category, description, rating,
        reviews_count AS "reviewsCount", pricing_type AS "pricingType",
        pricing_label AS price, pricing_label AS "pricingLabel",
        icon_type AS "iconType", icon_bg AS "iconBg",
        icon_color AS "iconColor", logo_url AS "logoUrl",
        install_count AS "installCount", features
      FROM discord_marketplace_products
      WHERE ${filters.join(' AND ')}
      ORDER BY ${orderBy}
    `, values);
    return result.rows || [];
  },

  async getMarketplaceProductById(productId) {
    const result = await queryPg(`
      SELECT id, name, developer, category, description, rating,
        reviews_count AS "reviewsCount", pricing_type AS "pricingType",
        pricing_label AS price, pricing_label AS "pricingLabel",
        icon_type AS "iconType", icon_bg AS "iconBg",
        icon_color AS "iconColor", logo_url AS "logoUrl",
        install_count AS "installCount", features
      FROM discord_marketplace_products
      WHERE id = $1 AND is_published = TRUE AND id::text <> ALL($2::text[])
    `, [productId, DEMO_PRODUCT_IDS]);
    return result.rows?.[0] || null;
  },

  async getWorkspace(userId, { search = '' } = {}) {
    requireUser(userId);
    let services = await this.getWorkspaceServices(userId);
    const operations = await this.getWorkspaceOperations(userId);
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      services = services.filter((service) =>
        [service.name, service.category, service.serverName, service.status, service.plan]
          .some((value) => String(value || '').toLowerCase().includes(query))
      );
    }
    const servers = await this.getServers(userId);
    return {
      services,
      operations: operations.slice(0, 10),
      totalServices: services.length,
      connectedServersCount: servers.length,
      allServicesHealthy: null
    };
  },

  async getWorkspaceServices(userId) {
    requireUser(userId);
    const result = await queryPg(`
      SELECT * FROM discord_workspace_services
      WHERE user_id = $1
        AND id::text <> ALL($2::text[])
        AND (service_id IS NULL OR service_id::text <> ALL($3::text[]))
      ORDER BY created_at ASC
    `, [userId, DEMO_SERVICE_RECORD_IDS, DEMO_SERVICE_IDS]);
    return (result.rows || []).map(mapService);
  },

  async getWorkspaceServiceById(userId, serviceId) {
    const services = await this.getWorkspaceServices(userId);
    return services.find((service) => service.id === serviceId) || null;
  },

  async updateWorkspaceService(userId, serviceId, updates = {}) {
    requireUser(userId);
    const result = await queryPg(`
      UPDATE discord_workspace_services
      SET status = COALESCE($1, status),
          plan = COALESCE($2, plan),
          server_name = COALESCE($3, server_name),
          server_id = COALESCE($4, server_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND user_id = $6
        AND id::text <> ALL($7::text[])
        AND (service_id IS NULL OR service_id::text <> ALL($8::text[]))
      RETURNING *
    `, [
      updates.status ?? null, updates.plan ?? null, updates.serverName ?? null,
      updates.serverId ?? null, serviceId, userId, DEMO_SERVICE_RECORD_IDS, DEMO_SERVICE_IDS
    ]);
    if (!result.rows?.[0]) throw new Error('Workspace service not found.');
    const service = mapService(result.rows[0]);
    await this.logWorkspaceOperation(userId, {
      operation: 'Configuration updated',
      serviceId: service.serviceId,
      serviceName: service.name,
      result: 'Completed'
    });
    return service;
  },

  async deleteWorkspaceService(userId, serviceId) {
    requireUser(userId);
    const result = await queryPg(`
      DELETE FROM discord_workspace_services
      WHERE id = $1 AND user_id = $2
        AND id::text <> ALL($3::text[])
        AND (service_id IS NULL OR service_id::text <> ALL($4::text[]))
      RETURNING service_id, name
    `, [serviceId, userId, DEMO_SERVICE_RECORD_IDS, DEMO_SERVICE_IDS]);
    const service = result.rows?.[0];
    if (service) {
      await this.logWorkspaceOperation(userId, {
        operation: 'Service deactivated',
        serviceId: service.service_id,
        serviceName: service.name,
        result: 'Completed'
      });
    }
    return { success: true };
  },

  async getWorkspaceOperations(userId) {
    requireUser(userId);
    const result = await queryPg(`
      SELECT * FROM discord_workspace_operations
      WHERE user_id = $1 AND id NOT IN ('op_1', 'op_2', 'op_3')
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);
    return (result.rows || []).map(mapOperation);
  },

  async logWorkspaceOperation(userId, { operation, serviceId = null, serviceName, result = 'Completed' }) {
    requireUser(userId);
    if (!operation || !serviceName) throw new Error('Operation and service name are required.');
    const id = makeId('op');
    const inserted = await queryPg(`
      INSERT INTO discord_workspace_operations
        (id, user_id, operation, service_id, service_name, result, time_ago)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, userId, operation, serviceId, serviceName, result, 'Just now']);
    return mapOperation(inserted.rows[0]);
  }
};
