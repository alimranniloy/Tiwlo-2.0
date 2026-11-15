import crypto from 'node:crypto';
import { queryPg, isPgActive } from '../db/postgres.js';
import { ensureDiscordSchema } from './discordSchema.js';

const TOKEN_EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getBotTokenKey() {
  const secret = process.env.DISCORD_TOKEN_SECRET || process.env.SECURITY_SECRET || TOKEN_EPHEMERAL_SECRET;
  return crypto.scryptSync(String(secret), 'tiwlo-official-discord-bot-v1', 32);
}

export function encryptBotToken(rawToken) {
  const cleaned = String(rawToken || '').trim();
  if (!cleaned) return { ciphertext: null, last4: null, hasToken: false };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getBotTokenKey(), iv);
  cipher.setAAD(Buffer.from('tiwlo-discord-official-bot-token-v1'));
  const encrypted = Buffer.concat([cipher.update(cleaned, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: JSON.stringify({
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64')
    }),
    last4: cleaned.slice(-4),
    hasToken: true
  };
}

export function maskBotToken(last4, hasToken = true) {
  if (!hasToken || !last4) return null;
  return `•••• •••• •••• ${String(last4).slice(-4)}`;
}

export function buildOfficialBotInviteUrl({ clientId, permissionsInt = '274877975552', oauthUrlTemplate = '' } = {}) {
  const cleanClientId = String(clientId || '').trim();
  const cleanPerms = String(permissionsInt || '274877975552').trim() || '274877975552';
  if (!cleanClientId) return null;
  if (oauthUrlTemplate && oauthUrlTemplate.includes('{clientId}')) {
    return oauthUrlTemplate
      .replace(/\{clientId\}/g, encodeURIComponent(cleanClientId))
      .replace(/\{permissions\}/g, encodeURIComponent(cleanPerms));
  }
  if (oauthUrlTemplate && /^https:\/\/discord\.com\/oauth2\/authorize/i.test(oauthUrlTemplate)) {
    return oauthUrlTemplate;
  }
  return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(cleanClientId)}&permissions=${encodeURIComponent(cleanPerms)}&scope=bot%20applications.commands`;
}

export const DEFAULT_SERVER_AI_CONFIG = Object.freeze({
  enabled: true,
  persona: 'community',
  systemPrompt: 'You are the Official Tiwlo AI Discord Assistant. Help community members politely, enforce server guidelines, and answer questions accurately.',
  commandPrefix: '/',
  autoMod: {
    antiSpam: true,
    blockUnauthorizedLinks: true,
    raidProtection: false,
    profanityFilter: true
  },
  welcome: {
    enabled: true,
    channelName: '#welcome',
    message: 'Welcome to {server}, {user}! Please check the rules and verify your account.',
    autoRoleName: 'Member',
    verificationEnabled: false
  },
  slashCommands: {
    askAi: true,
    help: true,
    ticket: true,
    verify: false,
    catalog: false
  },
  allowedChannels: []
});

export function normalizeServerAiConfig(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    enabled: src.enabled !== false,
    persona: ['community', 'support', 'sales', 'moderation', 'custom'].includes(src.persona) ? src.persona : 'community',
    systemPrompt: typeof src.systemPrompt === 'string' && src.systemPrompt.trim()
      ? src.systemPrompt.trim()
      : DEFAULT_SERVER_AI_CONFIG.systemPrompt,
    commandPrefix: typeof src.commandPrefix === 'string' && src.commandPrefix.trim()
      ? src.commandPrefix.trim().slice(0, 8)
      : '/',
    autoMod: {
      antiSpam: src.autoMod?.antiSpam !== false,
      blockUnauthorizedLinks: src.autoMod?.blockUnauthorizedLinks !== false,
      raidProtection: Boolean(src.autoMod?.raidProtection),
      profanityFilter: src.autoMod?.profanityFilter !== false
    },
    welcome: {
      enabled: src.welcome?.enabled !== false,
      channelName: typeof src.welcome?.channelName === 'string' ? src.welcome.channelName.trim() : '#welcome',
      message: typeof src.welcome?.message === 'string' ? src.welcome.message : DEFAULT_SERVER_AI_CONFIG.welcome.message,
      autoRoleName: typeof src.welcome?.autoRoleName === 'string' ? src.welcome.autoRoleName.trim() : 'Member',
      verificationEnabled: Boolean(src.welcome?.verificationEnabled)
    },
    slashCommands: {
      askAi: src.slashCommands?.askAi !== false,
      help: src.slashCommands?.help !== false,
      ticket: src.slashCommands?.ticket !== false,
      verify: Boolean(src.slashCommands?.verify),
      catalog: Boolean(src.slashCommands?.catalog)
    },
    allowedChannels: Array.isArray(src.allowedChannels)
      ? src.allowedChannels.map((c) => String(c || '').trim()).filter(Boolean)
      : []
  };
}

export function mapOfficialBot(row) {
  if (!row) return null;
  const hasToken = Boolean(row.has_token && row.token_last4);
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id || '',
    hasToken,
    maskedToken: maskBotToken(row.token_last4, hasToken),
    permissionsInt: row.permissions_int || '274877975552',
    oauthUrlTemplate: row.oauth_url_template || '',
    inviteUrl: buildOfficialBotInviteUrl({
      clientId: row.client_id,
      permissionsInt: row.permissions_int,
      oauthUrlTemplate: row.oauth_url_template
    }),
    status: row.status || 'active',
    description: row.description || '',
    features: Array.isArray(row.features) ? row.features : [],
    avatarUrl: row.avatar_url || null,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

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

const FIRST_PARTY_PRODUCTS = [
  {
    id: 'tiwlo-discord-bot-manager',
    name: 'Discord Bot Manager',
    developer: 'Tiwlo',
    category: 'community',
    description: 'Deploy the Official Tiwlo Discord AI Bot to your servers with AI personas, auto-moderation, welcome flows, and command analytics.',
    rating: null,
    reviewsCount: 0,
    pricingType: 'paid',
    serviceType: 'discord',
    price: 'From $9/mo',
    pricingLabel: 'Paid (Tiwlo Credits)',
    iconType: 'discord',
    iconBg: '#5865F2',
    iconColor: '#FFFFFF',
    logoUrl: null,
    installCount: 0,
    verified: true,
    features: ['Official Tiwlo AI Bot', 'Server OAuth2 Installer', 'Auto-Moderation & Raid Shield', 'AI Persona & Slash Commands'],
    managePath: 'discord'
  },
  {
    id: 'tiwlo-whatsapp-automation',
    name: 'WhatsApp Automation',
    developer: 'Tiwlo',
    category: 'automation',
    description: 'Connect WhatsApp Business numbers with Tiwi 2.0 AI sales & support assistants and real-time store catalog sync.',
    rating: null,
    reviewsCount: 0,
    pricingType: 'paid',
    serviceType: 'whatsapp',
    price: 'From $12/mo',
    pricingLabel: 'Paid (Tiwlo Credits)',
    iconType: 'whatsapp',
    iconBg: '#25D366',
    iconColor: '#FFFFFF',
    logoUrl: null,
    installCount: 0,
    verified: true,
    features: ['Multi-Device QR Gateway', 'Tiwi 2.0 AI Auto-Reply', 'Live Store Catalog Sync', 'Broadcast & Flow Quotas'],
    managePath: 'whatsapp-automation'
  }
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
  officialBotId: row.official_bot_id || null,
  isSuspended: Boolean(row.is_suspended),
  aiConfig: normalizeServerAiConfig(row.ai_config),
  commandsUsedMonth: Number(row.commands_used_month) || 0,
  bots: row.bots || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at
}) : null;

const mapService = (row) => ({
  id: row.id,
  userId: row.user_id,
  serviceId: row.service_id,
  name: row.name,
  productName: row.product_name,
  managePath: row.product_manage_path,
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
    const [officialBots, servers, recentActivities] = await Promise.all([
      this.getOfficialBots({ includeDisabled: false }),
      this.getServers(userId),
      this.getRecentActivities(userId, 10)
    ]);
    return {
      botsRegisteredCount: officialBots.length,
      officialBots,
      connectedServersCount: servers.length,
      totalMembersCount: servers.reduce((total, server) => total + server.memberCount, 0),
      servers,
      bots: officialBots,
      recentActivities
    };
  },

  async getOfficialBots({ includeDisabled = false } = {}) {
    if (!isPgActive()) return [];
    await ensureDiscordSchema({ query: queryPg });
    const whereClause = includeDisabled ? '' : `WHERE status = 'active'`;
    const result = await queryPg(`
      SELECT id, name, client_id, token_last4, has_token, permissions_int, oauth_url_template,
             status, description, features, avatar_url, is_default, created_at, updated_at
      FROM discord_official_bots
      ${whereClause}
      ORDER BY is_default DESC, created_at DESC
    `);
    return (result.rows || []).map(mapOfficialBot);
  },

  async getOfficialBotById(id) {
    if (!isPgActive() || !id) return null;
    await ensureDiscordSchema({ query: queryPg });
    const result = await queryPg(`
      SELECT id, name, client_id, token_last4, has_token, permissions_int, oauth_url_template,
             status, description, features, avatar_url, is_default, created_at, updated_at
      FROM discord_official_bots
      WHERE id = $1
      LIMIT 1
    `, [id]);
    return mapOfficialBot(result.rows?.[0]);
  },

  async createOfficialBot(data = {}) {
    await ensureDiscordSchema({ query: queryPg });
    const name = String(data?.name || '').trim();
    const clientId = String(data?.clientId || '').trim();
    if (!name) throw new Error('Official bot name is required.');
    if (!clientId) throw new Error('Discord Application / Client ID is required.');
    const id = makeId('offbot');
    const tokenData = encryptBotToken(data.botToken);
    const permissionsInt = String(data.permissionsInt || '274877975552').trim() || '274877975552';
    const status = ['active', 'maintenance', 'disabled'].includes(data.status) ? data.status : 'active';
    const features = Array.isArray(data.features)
      ? data.features.map((f) => String(f || '').trim()).filter(Boolean)
      : ['AI Persona Assistant', 'Auto-Moderation', 'Slash Commands', 'Welcome Flows'];
    const isDefault = data.isDefault !== false;

    if (isDefault) {
      await queryPg('UPDATE discord_official_bots SET is_default = FALSE WHERE is_default = TRUE');
    }

    await queryPg(`
      INSERT INTO discord_official_bots
        (id, name, client_id, token_ciphertext, token_last4, has_token, permissions_int,
         oauth_url_template, status, description, features, avatar_url, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
    `, [
      id,
      name,
      clientId,
      tokenData.ciphertext,
      tokenData.last4,
      tokenData.hasToken,
      permissionsInt,
      data.oauthUrlTemplate ? String(data.oauthUrlTemplate).trim() : null,
      status,
      String(data.description || '').trim(),
      JSON.stringify(features),
      data.avatarUrl ? String(data.avatarUrl).trim() : null,
      isDefault
    ]);
    return this.getOfficialBotById(id);
  },

  async updateOfficialBot(id, data = {}) {
    await ensureDiscordSchema({ query: queryPg });
    const existing = await this.getOfficialBotById(id);
    if (!existing) return null;

    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const values = [];
    const pushSet = (col, val, cast = '') => {
      values.push(val);
      sets.push(`${col} = $${values.length}${cast}`);
    };

    if (data.name !== undefined && String(data.name).trim()) pushSet('name', String(data.name).trim());
    if (data.clientId !== undefined && String(data.clientId).trim()) pushSet('client_id', String(data.clientId).trim());
    if (data.permissionsInt !== undefined) pushSet('permissions_int', String(data.permissionsInt || '274877975552').trim());
    if (data.oauthUrlTemplate !== undefined) pushSet('oauth_url_template', data.oauthUrlTemplate ? String(data.oauthUrlTemplate).trim() : null);
    if (data.status !== undefined && ['active', 'maintenance', 'disabled'].includes(data.status)) pushSet('status', data.status);
    if (data.description !== undefined) pushSet('description', String(data.description || '').trim());
    if (data.avatarUrl !== undefined) pushSet('avatar_url', data.avatarUrl ? String(data.avatarUrl).trim() : null);
    if (Array.isArray(data.features)) {
      pushSet('features', JSON.stringify(data.features.map((f) => String(f || '').trim()).filter(Boolean)), '::jsonb');
    }
    if (data.isDefault === true) {
      await queryPg('UPDATE discord_official_bots SET is_default = FALSE WHERE is_default = TRUE AND id <> $1', [id]);
      pushSet('is_default', true);
    } else if (data.isDefault === false) {
      pushSet('is_default', false);
    }
    if (typeof data.botToken === 'string' && data.botToken.trim()) {
      const tokenData = encryptBotToken(data.botToken);
      pushSet('token_ciphertext', tokenData.ciphertext);
      pushSet('token_last4', tokenData.last4);
      pushSet('has_token', tokenData.hasToken);
    }

    values.push(id);
    await queryPg(
      `UPDATE discord_official_bots SET ${sets.join(', ')} WHERE id = $${values.length}`,
      values
    );
    return this.getOfficialBotById(id);
  },

  async deleteOfficialBot(id) {
    await ensureDiscordSchema({ query: queryPg });
    const result = await queryPg('DELETE FROM discord_official_bots WHERE id = $1 RETURNING id', [id]);
    return Boolean(result.rowCount);
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
    await ensureDiscordSchema({ query: queryPg });
    let officialBotId = data.officialBotId || null;
    if (!officialBotId) {
      const officialBots = await this.getOfficialBots({ includeDisabled: false });
      officialBotId = officialBots[0]?.id || null;
    }
    const aiConfig = normalizeServerAiConfig(data.aiConfig || {});
    const id = makeId('srv');
    await queryPg(`
      INSERT INTO discord_servers (id, user_id, name, icon, member_count, guild_id, official_bot_id, ai_config)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `, [
      id,
      userId,
      data.name.trim(),
      data.icon || null,
      Math.max(0, Number.parseInt(data.memberCount ?? '0', 10) || 0),
      data.guildId?.trim() || null,
      officialBotId,
      JSON.stringify(aiConfig)
    ]);
    await this.logActivity(userId, {
      serverId: id,
      title: `Server "${data.name.trim()}" connected`,
      description: 'Discord server bound to Official Tiwlo AI Bot.',
      actionType: 'server_connected'
    });
    return this.getServerById(userId, id);
  },

  async updateServer(userId, serverId, data = {}) {
    requireUser(userId);
    await ensureDiscordSchema({ query: queryPg });
    const existing = await this.getServerById(userId, serverId);
    if (!existing) return null;
    const nextAiConfig = data.aiConfig !== undefined
      ? normalizeServerAiConfig({ ...existing.aiConfig, ...data.aiConfig })
      : null;
    const result = await queryPg(`
      UPDATE discord_servers
      SET name = COALESCE($1, name),
          member_count = COALESCE($2, member_count),
          icon = COALESCE($3, icon),
          guild_id = COALESCE($4, guild_id),
          official_bot_id = COALESCE($5, official_bot_id),
          ai_config = COALESCE($6::jsonb, ai_config),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING id
    `, [
      data.name ?? null,
      data.memberCount == null ? null : Math.max(0, Number.parseInt(data.memberCount, 10) || 0),
      data.icon ?? null,
      data.guildId ?? null,
      data.officialBotId ?? null,
      nextAiConfig ? JSON.stringify(nextAiConfig) : null,
      serverId,
      userId
    ]);
    return result.rows?.[0] ? this.getServerById(userId, serverId) : null;
  },

  async incrementServerCommands(userId, serverId, amount = 1) {
    requireUser(userId);
    const delta = Math.max(1, Number.parseInt(amount, 10) || 1);
    await queryPg(`
      UPDATE discord_servers
      SET commands_used_month = COALESCE(commands_used_month, 0) + $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
    `, [serverId, userId, delta]);
    return true;
  },

  async adminListServers({ page = 1, limit = 25, search = '' } = {}) {
    await ensureDiscordSchema({ query: queryPg });
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    const offset = (safePage - 1) * safeLimit;
    const queryText = String(search || '').trim();
    const values = [];
    let filterSql = '';
    if (queryText) {
      values.push(`%${queryText}%`);
      filterSql = `WHERE (
        s.name ILIKE $1 OR
        COALESCE(s.guild_id, '') ILIKE $1 OR
        s.user_id ILIKE $1 OR
        COALESCE(u.email, '') ILIKE $1 OR
        COALESCE(u.name, '') ILIKE $1 OR
        COALESCE(u.tiwi_id, '') ILIKE $1
      )`;
    }

    const countRes = await queryPg(`
      SELECT COUNT(*)::int AS total
      FROM discord_servers s
      LEFT JOIN system_users u ON u.id = s.user_id
      ${filterSql}
    `, values);
    const total = countRes.rows?.[0]?.total || 0;

    const listParams = [...values, safeLimit, offset];
    const limitParam = `$${listParams.length - 1}`;
    const offsetParam = `$${listParams.length}`;
    const { rows } = await queryPg(`
      SELECT s.*,
             u.name AS user_name,
             u.email AS user_email,
             u.tiwi_id,
             sub.plan_id,
             sub.plan_name,
             sub.limits_json,
             sub.usage_json,
             sub.status AS subscription_status,
             ob.name AS official_bot_name,
             (SELECT COUNT(*)::int FROM discord_servers s2 WHERE s2.user_id = s.user_id) AS servers_used_count
      FROM discord_servers s
      LEFT JOIN system_users u ON u.id = s.user_id
      LEFT JOIN platform_service_subscriptions sub ON sub.user_id = s.user_id AND sub.service_type = 'discord'
      LEFT JOIN discord_official_bots ob ON ob.id = s.official_bot_id
      ${filterSql}
      ORDER BY s.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, listParams);

    const items = (rows || []).map((row) => {
      const limits = row.limits_json && typeof row.limits_json === 'object' ? row.limits_json : {};
      const usage = row.usage_json && typeof row.usage_json === 'object' ? row.usage_json : {};
      const aiConfig = normalizeServerAiConfig(row.ai_config);
      const activeModules = [];
      if (aiConfig.enabled) activeModules.push('AI Chat');
      if (aiConfig.autoMod?.antiSpam || aiConfig.autoMod?.blockUnauthorizedLinks) activeModules.push('Auto-Mod');
      if (aiConfig.welcome?.enabled) activeModules.push('Welcome');
      if (aiConfig.slashCommands?.ticket) activeModules.push('Tickets');
      return {
        id: row.id,
        guildId: row.guild_id || row.id,
        guildName: row.name,
        memberCount: Number(row.member_count || 0),
        userId: row.user_id,
        tiwiId: row.tiwi_id || '',
        userName: row.user_name || '',
        userEmail: row.user_email || '',
        officialBotId: row.official_bot_id || null,
        officialBotName: row.official_bot_name || 'Official Tiwlo AI Bot',
        planId: row.plan_id || null,
        planName: row.plan_name || 'No Active Plan',
        subscriptionStatus: row.subscription_status || 'none',
        serversUsedCount: Number(row.servers_used_count || 1),
        maxServers: Number(limits.maxServersPerBot || 0),
        commandsUsedMonth: Number(row.commands_used_month || usage.monthlyCommands || 0),
        monthlyCommandsLimit: Number(limits.monthlyCommandsLimit || 0),
        activeModules,
        isSuspended: Boolean(row.is_suspended),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    return { items, total, page: safePage, limit: safeLimit };
  },

  async adminToggleServerSuspension(idOrGuildId, isSuspended) {
    await ensureDiscordSchema({ query: queryPg });
    const result = await queryPg(`
      UPDATE discord_servers
      SET is_suspended = COALESCE($2, NOT is_suspended),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 OR guild_id = $1
      RETURNING id, name, guild_id, is_suspended
    `, [idOrGuildId, typeof isSuspended === 'boolean' ? isSuspended : null]);
    const row = result.rows?.[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      guildId: row.guild_id || row.id,
      isSuspended: Boolean(row.is_suspended)
    };
  },

  async adminRevokeServer(idOrGuildId) {
    await ensureDiscordSchema({ query: queryPg });
    const result = await queryPg(`
      DELETE FROM discord_servers
      WHERE id = $1 OR guild_id = $1
      RETURNING id, user_id, name
    `, [idOrGuildId]);
    return result.rows?.[0] || null;
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
    const query = search.trim().toLowerCase();
    const firstPartyProducts = FIRST_PARTY_PRODUCTS.filter((product) => {
      if (category && category !== 'all' && product.category.toLowerCase() !== category.toLowerCase()) return false;
      if (pricing === 'free' && !['free', 'freemium'].includes(product.pricingType)) return false;
      if (pricing === 'paid' && product.pricingType !== 'paid') return false;
      if (query && ![product.name, product.description, product.developer, product.category]
        .some((value) => value.toLowerCase().includes(query))) return false;
      return true;
    });
    const products = [...(result.rows || []), ...firstPartyProducts];
    if (sort === 'rating') {
      products.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || a.name.localeCompare(b.name));
    } else if (sort === 'name') {
      products.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      products.sort((a, b) => (Number(b.installCount) || 0) - (Number(a.installCount) || 0) || a.name.localeCompare(b.name));
    }
    return products;
  },

  async getMarketplaceProductById(productId) {
    const firstPartyProduct = FIRST_PARTY_PRODUCTS.find((product) => product.id === productId);
    if (firstPartyProduct) return firstPartyProduct;
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

  async activateMarketplaceProduct(userId, productId, { serviceName, logoUrl = null, planName = null } = {}) {
    requireUser(userId);
    const normalizedName = typeof serviceName === 'string' ? serviceName.trim() : '';
    if (!normalizedName) throw new Error('Workspace service name is required.');

    const product = await this.getMarketplaceProductById(productId);
    if (!product) throw new Error('Marketplace product not found.');

    const existing = await queryPg(`
      SELECT id
      FROM discord_workspace_services
      WHERE user_id = $1 AND service_id = $2 AND name = $3
      LIMIT 1
    `, [userId, product.id, normalizedName]);
    if (existing.rows?.[0]) throw new Error('A workspace service with this name already exists for this product.');

    const resolvedPlan =
      (typeof planName === 'string' && planName.trim()) ||
      (product.pricingType === 'paid'
        ? (product.price || product.pricingLabel || 'Paid Plan')
        : (product.price || product.pricingLabel || 'Free'));

    const id = makeId('ws');
    const result = await queryPg(`
      INSERT INTO discord_workspace_services
        (id, user_id, service_id, name, product_name, product_manage_path, category, icon_type, status, server_name, plan, logo_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', 'Not connected', $9, $10)
      RETURNING *
    `, [
      id, userId, product.id, normalizedName, product.name, product.managePath || null,
      product.category, product.iconType || null, resolvedPlan,
      logoUrl || product.logoUrl || null
    ]);
    const service = mapService(result.rows[0]);
    await this.logWorkspaceOperation(userId, {
      operation: 'Product enabled in Workspace',
      serviceId: product.id,
      serviceName: normalizedName,
      result: 'Completed'
    });
    return { service, product };
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
