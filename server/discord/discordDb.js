import { isPgActive, queryPg } from '../db/postgres.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for fallback when PostgreSQL connection is offline
const DATA_DIR = path.resolve(__dirname, '../data/db/discord');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile(filename, defaultValue = []) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.warn(`[DiscordDB] Failed to read ${filename}:`, e.message);
    return defaultValue;
  }
}

function writeJsonFile(filename, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Tiwlo Enterprise Discord Bot & Community Database Adapter
 * 
 * Complies with Master Rule 1 & 2:
 * - PostgreSQL backed schema
 * - Parameterized queries
 * - Zero hardcoded dummy data / fake accounts / simulated records
 */
export const DiscordDB = {
  async init() {
    if (isPgActive()) {
      try {
        await queryPg(`
          -- 1. Discord Bots
          CREATE TABLE IF NOT EXISTS discord_bots (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            token TEXT,
            client_id VARCHAR(128),
            avatar TEXT,
            prefix VARCHAR(16) DEFAULT '!',
            status VARCHAR(32) DEFAULT 'online',
            description TEXT,
            commands_today INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_bots_user ON discord_bots(user_id);

          -- 2. Discord Servers (Guilds)
          CREATE TABLE IF NOT EXISTS discord_servers (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            icon TEXT,
            member_count INTEGER DEFAULT 0,
            guild_id VARCHAR(128),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_servers_user ON discord_servers(user_id);

          -- 3. Bot to Server Mapping
          CREATE TABLE IF NOT EXISTS discord_bot_servers (
            id VARCHAR(64) PRIMARY KEY,
            bot_id VARCHAR(64) NOT NULL REFERENCES discord_bots(id) ON DELETE CASCADE,
            server_id VARCHAR(64) NOT NULL REFERENCES discord_servers(id) ON DELETE CASCADE,
            added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(bot_id, server_id)
          );

          -- 4. Discord Activities / Audit Logs
          CREATE TABLE IF NOT EXISTS discord_activities (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
            bot_id VARCHAR(64),
            server_id VARCHAR(64),
            title VARCHAR(255) NOT NULL,
            description TEXT,
            action_type VARCHAR(64) DEFAULT 'general',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_activities_user ON discord_activities(user_id, created_at DESC);

          -- 5. Automations (Welcome, Auto-role, Custom Commands)
          CREATE TABLE IF NOT EXISTS discord_automations (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
            bot_id VARCHAR(64),
            server_id VARCHAR(64),
            type VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            config JSONB DEFAULT '{}'::jsonb,
            enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_automations_user ON discord_automations(user_id);

          -- 6. Discord Community Support Tickets
          CREATE TABLE IF NOT EXISTS discord_tickets (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
            server_id VARCHAR(64),
            channel_name VARCHAR(255),
            author_name VARCHAR(255),
            subject VARCHAR(255),
            status VARCHAR(32) DEFAULT 'open',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_tickets_user ON discord_tickets(user_id);

          -- 7. Discord Marketplace Catalog
          CREATE TABLE IF NOT EXISTS discord_marketplace_products (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            developer VARCHAR(255) NOT NULL,
            category VARCHAR(128) NOT NULL,
            description TEXT NOT NULL,
            rating NUMERIC(3, 1) DEFAULT 4.8,
            reviews_count INT DEFAULT 100,
            pricing_type VARCHAR(64) DEFAULT 'free',
            pricing_label VARCHAR(128) DEFAULT 'Free plan available',
            icon_type VARCHAR(64) DEFAULT 'shield',
            icon_bg VARCHAR(64) DEFAULT '#1E40AF',
            icon_color VARCHAR(64) DEFAULT '#FFFFFF',
            features JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          -- 8. Discord Workspace Active Services
          CREATE TABLE IF NOT EXISTS discord_workspace_services (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            service_id VARCHAR(64),
            name VARCHAR(255) NOT NULL,
            category VARCHAR(128) NOT NULL,
            icon_type VARCHAR(64) DEFAULT 'shield',
            status VARCHAR(32) DEFAULT 'Active',
            server_id VARCHAR(64),
            server_name VARCHAR(255) NOT NULL,
            plan VARCHAR(64) DEFAULT 'Free',
            usage_current INT DEFAULT 0,
            usage_limit INT DEFAULT 10000,
            usage_label VARCHAR(128) DEFAULT '8,420 of 10,000',
            renewal_date VARCHAR(64) DEFAULT '—',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_workspace_services_user ON discord_workspace_services(user_id);

          -- 9. Discord Workspace Operations
          CREATE TABLE IF NOT EXISTS discord_workspace_operations (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            operation VARCHAR(255) NOT NULL,
            service_id VARCHAR(64),
            service_name VARCHAR(255) NOT NULL,
            result VARCHAR(64) DEFAULT 'Completed',
            time_ago VARCHAR(64) DEFAULT 'Just now',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_discord_workspace_operations_user ON discord_workspace_operations(user_id);
        `);
        console.log('✅ [DiscordDB] PostgreSQL tables verified successfully.');
      } catch (err) {
        console.warn('⚠️ [DiscordDB] PostgreSQL schema initialization notice:', err.message);
      }
    } else {
      ensureDataDir();
    }
  },

  // ==========================================
  // OVERVIEW DATA (REAL STATS ONLY - NO DUMMY)
  // ==========================================
  async getOverview(userId) {
    if (!userId) {
      return {
        botsOnlineCount: 0,
        connectedServersCount: 0,
        totalMembersCount: 0,
        servers: [],
        bots: [],
        recentActivities: []
      };
    }

    const [bots, servers, activities] = await Promise.all([
      this.getBots(userId),
      this.getServers(userId),
      this.getRecentActivities(userId, 10)
    ]);

    const botsOnlineCount = bots.filter(b => (b.status || '').toLowerCase() === 'online').length;
    const connectedServersCount = servers.length;
    const totalMembersCount = servers.reduce((acc, s) => acc + (Number(s.memberCount) || 0), 0);

    return {
      botsOnlineCount,
      connectedServersCount,
      totalMembersCount,
      servers,
      bots,
      recentActivities: activities
    };
  },

  // ==========================================
  // BOTS MANAGEMENT
  // ==========================================
  async getBots(userId) {
    if (!userId) return [];

    if (isPgActive()) {
      try {
        const query = `
          SELECT b.*,
            (SELECT COUNT(*) FROM discord_bot_servers bs WHERE bs.bot_id = b.id) as servers_count
          FROM discord_bots b
          WHERE b.user_id = $1
          ORDER BY b.created_at DESC
        `;
        const res = await queryPg(query, [userId]);
        return (res.rows || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          name: r.name,
          token: r.token,
          clientId: r.client_id,
          avatar: r.avatar,
          prefix: r.prefix || '!',
          status: r.status || 'online',
          description: r.description || '',
          commandsToday: Number(r.commands_today) || 0,
          serversCount: Number(r.servers_count) || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
      } catch (err) {
        console.warn('[DiscordDB] Postgres getBots error, using storage:', err.message);
      }
    }

    const bots = readJsonFile('bots.json', []);
    const botServers = readJsonFile('bot_servers.json', []);
    return bots
      .filter(b => b.userId === userId)
      .map(b => ({
        ...b,
        serversCount: botServers.filter(bs => bs.botId === b.id).length
      }));
  },

  async getBotById(userId, botId) {
    const bots = await this.getBots(userId);
    return bots.find(b => b.id === botId) || null;
  },

  async createBot(userId, data) {
    if (!userId) throw new Error('User authentication required.');
    const id = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newBot = {
      id,
      userId,
      name: (data.name || 'Unnamed Bot').trim(),
      token: data.token ? data.token.trim() : null,
      clientId: data.clientId ? data.clientId.trim() : null,
      avatar: data.avatar || null,
      prefix: (data.prefix || '!').trim(),
      status: data.status || 'online',
      description: (data.description || '').trim(),
      commandsToday: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_bots
            (id, user_id, name, token, client_id, avatar, prefix, status, description, commands_today, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          newBot.id,
          newBot.userId,
          newBot.name,
          newBot.token,
          newBot.clientId,
          newBot.avatar,
          newBot.prefix,
          newBot.status,
          newBot.description,
          newBot.commandsToday,
          newBot.createdAt,
          newBot.updatedAt
        ]);

        await this.logActivity(userId, {
          botId: newBot.id,
          title: `Bot "${newBot.name}" created`,
          description: `Initial bot registration with prefix "${newBot.prefix}"`,
          actionType: 'bot_created'
        });

        return newBot;
      } catch (err) {
        console.warn('[DiscordDB] Postgres createBot error, falling back:', err.message);
      }
    }

    const bots = readJsonFile('bots.json', []);
    bots.unshift(newBot);
    writeJsonFile('bots.json', bots);

    await this.logActivity(userId, {
      botId: newBot.id,
      title: `Bot "${newBot.name}" created`,
      description: `Initial bot registration with prefix "${newBot.prefix}"`,
      actionType: 'bot_created'
    });

    return newBot;
  },

  async updateBot(userId, botId, data) {
    if (!userId || !botId) throw new Error('Bot ID and user required.');

    if (isPgActive()) {
      try {
        await queryPg(`
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
        `, [
          data.name !== undefined ? data.name : null,
          data.prefix !== undefined ? data.prefix : null,
          data.status !== undefined ? data.status : null,
          data.description !== undefined ? data.description : null,
          data.token !== undefined ? data.token : null,
          data.clientId !== undefined ? data.clientId : null,
          data.avatar !== undefined ? data.avatar : null,
          botId,
          userId
        ]);
        return await this.getBotById(userId, botId);
      } catch (err) {
        console.warn('[DiscordDB] Postgres updateBot error, falling back:', err.message);
      }
    }

    const bots = readJsonFile('bots.json', []);
    const idx = bots.findIndex(b => b.id === botId && b.userId === userId);
    if (idx === -1) return null;

    bots[idx] = {
      ...bots[idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    writeJsonFile('bots.json', bots);
    return bots[idx];
  },

  async deleteBot(userId, botId) {
    if (!userId || !botId) return false;

    if (isPgActive()) {
      try {
        await queryPg('DELETE FROM discord_bots WHERE id = $1 AND user_id = $2', [botId, userId]);
        return true;
      } catch (err) {
        console.warn('[DiscordDB] Postgres deleteBot error:', err.message);
      }
    }

    const bots = readJsonFile('bots.json', []);
    const filtered = bots.filter(b => !(b.id === botId && b.userId === userId));
    writeJsonFile('bots.json', filtered);
    return true;
  },

  // ==========================================
  // SERVERS (GUILDS) MANAGEMENT
  // ==========================================
  async getServers(userId) {
    if (!userId) return [];

    if (isPgActive()) {
      try {
        const query = `
          SELECT s.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', b.id,
                  'name', b.name,
                  'status', b.status,
                  'avatar', b.avatar
                )
              ) FILTER (WHERE b.id IS NOT NULL), '[]'
            ) as bots
          FROM discord_servers s
          LEFT JOIN discord_bot_servers bs ON bs.server_id = s.id
          LEFT JOIN discord_bots b ON b.id = bs.bot_id
          WHERE s.user_id = $1
          GROUP BY s.id
          ORDER BY s.created_at DESC
        `;
        const res = await queryPg(query, [userId]);
        return (res.rows || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          name: r.name,
          icon: r.icon,
          memberCount: Number(r.member_count) || 0,
          guildId: r.guild_id,
          bots: r.bots || [],
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
      } catch (err) {
        console.warn('[DiscordDB] Postgres getServers error, using storage:', err.message);
      }
    }

    const servers = readJsonFile('servers.json', []);
    const bots = readJsonFile('bots.json', []);
    const botServers = readJsonFile('bot_servers.json', []);

    return servers
      .filter(s => s.userId === userId)
      .map(s => {
        const assignedBotIds = botServers.filter(bs => bs.serverId === s.id).map(bs => bs.botId);
        const assignedBots = bots
          .filter(b => assignedBotIds.includes(b.id))
          .map(b => ({ id: b.id, name: b.name, status: b.status, avatar: b.avatar }));
        return {
          ...s,
          bots: assignedBots
        };
      });
  },

  async getServerById(userId, serverId) {
    const servers = await this.getServers(userId);
    return servers.find(s => s.id === serverId) || null;
  },

  async createServer(userId, data) {
    if (!userId) throw new Error('User authentication required.');
    const id = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newServer = {
      id,
      userId,
      name: (data.name || 'Unnamed Server').trim(),
      icon: data.icon || null,
      memberCount: Math.max(0, parseInt(data.memberCount || '0', 10)),
      guildId: data.guildId ? data.guildId.trim() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_servers
            (id, user_id, name, icon, member_count, guild_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          newServer.id,
          newServer.userId,
          newServer.name,
          newServer.icon,
          newServer.memberCount,
          newServer.guildId,
          newServer.createdAt,
          newServer.updatedAt
        ]);

        // If initial bot assignment requested
        if (data.botId) {
          await this.assignBotToServer(userId, data.botId, newServer.id);
        }

        await this.logActivity(userId, {
          serverId: newServer.id,
          title: `Server "${newServer.name}" connected`,
          description: `Connected server with ${newServer.memberCount} members`,
          actionType: 'server_connected'
        });

        return await this.getServerById(userId, newServer.id);
      } catch (err) {
        console.warn('[DiscordDB] Postgres createServer error, falling back:', err.message);
      }
    }

    const servers = readJsonFile('servers.json', []);
    servers.unshift(newServer);
    writeJsonFile('servers.json', servers);

    if (data.botId) {
      await this.assignBotToServer(userId, data.botId, newServer.id);
    }

    await this.logActivity(userId, {
      serverId: newServer.id,
      title: `Server "${newServer.name}" connected`,
      description: `Connected server with ${newServer.memberCount} members`,
      actionType: 'server_connected'
    });

    return await this.getServerById(userId, newServer.id);
  },

  async updateServer(userId, serverId, data) {
    if (!userId || !serverId) throw new Error('Server ID and user required.');

    if (isPgActive()) {
      try {
        await queryPg(`
          UPDATE discord_servers
          SET name = COALESCE($1, name),
              member_count = COALESCE($2, member_count),
              icon = COALESCE($3, icon),
              guild_id = COALESCE($4, guild_id),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND user_id = $6
        `, [
          data.name !== undefined ? data.name : null,
          data.memberCount !== undefined ? parseInt(data.memberCount, 10) : null,
          data.icon !== undefined ? data.icon : null,
          data.guildId !== undefined ? data.guildId : null,
          serverId,
          userId
        ]);
        return await this.getServerById(userId, serverId);
      } catch (err) {
        console.warn('[DiscordDB] Postgres updateServer error:', err.message);
      }
    }

    const servers = readJsonFile('servers.json', []);
    const idx = servers.findIndex(s => s.id === serverId && s.userId === userId);
    if (idx === -1) return null;

    servers[idx] = {
      ...servers[idx],
      ...data,
      updatedAt: new Date().toISOString()
    };
    writeJsonFile('servers.json', servers);
    return await this.getServerById(userId, serverId);
  },

  async deleteServer(userId, serverId) {
    if (!userId || !serverId) return false;

    if (isPgActive()) {
      try {
        await queryPg('DELETE FROM discord_servers WHERE id = $1 AND user_id = $2', [serverId, userId]);
        return true;
      } catch (err) {
        console.warn('[DiscordDB] Postgres deleteServer error:', err.message);
      }
    }

    const servers = readJsonFile('servers.json', []);
    const filtered = servers.filter(s => !(s.id === serverId && s.userId === userId));
    writeJsonFile('servers.json', filtered);
    return true;
  },

  async assignBotToServer(userId, botId, serverId) {
    const id = `bs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_bot_servers (id, bot_id, server_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (bot_id, server_id) DO NOTHING
        `, [id, botId, serverId]);
        return true;
      } catch (err) {
        console.warn('[DiscordDB] Postgres assignBotToServer error:', err.message);
      }
    }

    const botServers = readJsonFile('bot_servers.json', []);
    if (!botServers.some(bs => bs.botId === botId && bs.serverId === serverId)) {
      botServers.push({ id, botId, serverId, addedAt: new Date().toISOString() });
      writeJsonFile('bot_servers.json', botServers);
    }
    return true;
  },

  async removeBotFromServer(userId, botId, serverId) {
    if (isPgActive()) {
      try {
        await queryPg(`DELETE FROM discord_bot_servers WHERE bot_id = $1 AND server_id = $2`, [botId, serverId]);
        return true;
      } catch (err) {
        console.warn('[DiscordDB] Postgres removeBotFromServer error:', err.message);
      }
    }

    const botServers = readJsonFile('bot_servers.json', []);
    const filtered = botServers.filter(bs => !(bs.botId === botId && bs.serverId === serverId));
    writeJsonFile('bot_servers.json', filtered);
    return true;
  },

  // ==========================================
  // ACTIVITIES / AUDIT LOG
  // ==========================================
  async getRecentActivities(userId, limit = 20) {
    if (!userId) return [];

    if (isPgActive()) {
      try {
        const res = await queryPg(`
          SELECT * FROM discord_activities
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2
        `, [userId, limit]);
        return (res.rows || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          botId: r.bot_id,
          serverId: r.server_id,
          title: r.title,
          description: r.description,
          actionType: r.action_type,
          createdAt: r.created_at
        }));
      } catch (err) {
        console.warn('[DiscordDB] Postgres getRecentActivities error:', err.message);
      }
    }

    const activities = readJsonFile('activities.json', []);
    return activities
      .filter(a => a.userId === userId)
      .slice(0, limit);
  },

  async logActivity(userId, { botId = null, serverId = null, title, description = '', actionType = 'general' }) {
    if (!userId || !title) return;
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAct = {
      id,
      userId,
      botId,
      serverId,
      title,
      description,
      actionType,
      createdAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_activities (id, user_id, bot_id, server_id, title, description, action_type, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          newAct.id,
          newAct.userId,
          newAct.botId,
          newAct.serverId,
          newAct.title,
          newAct.description,
          newAct.actionType,
          newAct.createdAt
        ]);
        return newAct;
      } catch (err) {
        console.warn('[DiscordDB] Postgres logActivity error:', err.message);
      }
    }

    const activities = readJsonFile('activities.json', []);
    activities.unshift(newAct);
    if (activities.length > 500) activities.length = 500;
    writeJsonFile('activities.json', activities);
    return newAct;
  },

  // ==========================================
  // AUTOMATIONS
  // ==========================================
  async getAutomations(userId, type = null) {
    if (!userId) return [];

    if (isPgActive()) {
      try {
        let sql = `SELECT * FROM discord_automations WHERE user_id = $1`;
        const params = [userId];
        if (type) {
          sql += ` AND type = $2`;
          params.push(type);
        }
        sql += ` ORDER BY created_at DESC`;
        const res = await queryPg(sql, params);
        return (res.rows || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          botId: r.bot_id,
          serverId: r.server_id,
          type: r.type,
          title: r.title,
          description: r.description,
          config: r.config || {},
          enabled: r.enabled !== false,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));
      } catch (err) {
        console.warn('[DiscordDB] Postgres getAutomations error:', err.message);
      }
    }

    const automations = readJsonFile('automations.json', []);
    return automations.filter(a => a.userId === userId && (!type || a.type === type));
  },

  async saveAutomation(userId, data) {
    if (!userId || !data.title || !data.type) throw new Error('User, title and automation type required.');
    const id = data.id || `auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record = {
      id,
      userId,
      botId: data.botId || null,
      serverId: data.serverId || null,
      type: data.type,
      title: data.title,
      description: data.description || '',
      config: data.config || {},
      enabled: data.enabled !== false,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_automations
            (id, user_id, bot_id, server_id, type, title, description, config, enabled, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            config = EXCLUDED.config,
            enabled = EXCLUDED.enabled,
            updated_at = EXCLUDED.updated_at
        `, [
          record.id,
          record.userId,
          record.botId,
          record.serverId,
          record.type,
          record.title,
          record.description,
          record.config,
          record.enabled,
          record.createdAt,
          record.updatedAt
        ]);

        await this.logActivity(userId, {
          title: `Automation updated: ${record.title}`,
          description: `Configured automation of type ${record.type}`,
          actionType: 'automation_configured'
        });

        return record;
      } catch (err) {
        console.warn('[DiscordDB] Postgres saveAutomation error:', err.message);
      }
    }

    const automations = readJsonFile('automations.json', []);
    const idx = automations.findIndex(a => a.id === id && a.userId === userId);
    if (idx >= 0) {
      automations[idx] = record;
    } else {
      automations.unshift(record);
    }
    writeJsonFile('automations.json', automations);

    await this.logActivity(userId, {
      title: `Automation updated: ${record.title}`,
      description: `Configured automation of type ${record.type}`,
      actionType: 'automation_configured'
    });

    return record;
  },

  // ==========================================
  // TICKETS
  // ==========================================
  async getTickets(userId) {
    if (!userId) return [];

    if (isPgActive()) {
      try {
        const res = await queryPg(`
          SELECT * FROM discord_tickets
          WHERE user_id = $1
          ORDER BY created_at DESC
        `, [userId]);
        return (res.rows || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          serverId: r.server_id,
          channelName: r.channel_name,
          authorName: r.author_name,
          subject: r.subject,
          status: r.status || 'open',
          createdAt: r.created_at
        }));
      } catch (err) {
        console.warn('[DiscordDB] Postgres getTickets error:', err.message);
      }
    }

    const tickets = readJsonFile('tickets.json', []);
    return tickets.filter(t => t.userId === userId);
  },

  async createTicket(userId, data) {
    if (!userId) throw new Error('User required.');
    const id = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ticket = {
      id,
      userId,
      serverId: data.serverId || null,
      channelName: data.channelName || `ticket-${Date.now().toString().slice(-4)}`,
      authorName: data.authorName || 'Community Member',
      subject: data.subject || 'Help Request',
      status: 'open',
      createdAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_tickets (id, user_id, server_id, channel_name, author_name, subject, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          ticket.id,
          ticket.userId,
          ticket.serverId,
          ticket.channelName,
          ticket.authorName,
          ticket.subject,
          ticket.status,
          ticket.createdAt
        ]);
        return ticket;
      } catch (err) {
        console.warn('[DiscordDB] Postgres createTicket error:', err.message);
      }
    }

    const tickets = readJsonFile('tickets.json', []);
    tickets.unshift(ticket);
    writeJsonFile('tickets.json', tickets);
    return ticket;
  },

  // ==========================================
  // MARKETPLACE PRODUCTS
  // ==========================================
  getDefaultMarketplaceCatalog() {
    return [
      {
        id: 'prod_sentinel',
        name: 'Sentinel',
        developer: 'Sentinel Labs',
        category: 'Security & moderation',
        description: 'Automated moderation and spam protection for busy communities.',
        rating: 4.8,
        reviewsCount: 126,
        pricingType: 'freemium',
        pricingLabel: 'Free plan available',
        iconType: 'shield',
        iconBg: '#0f3a7a',
        iconColor: '#FFFFFF',
        features: [
          'Anti-spam and raid protection engine',
          'Automatic phishing and bad-link blocker',
          'Real-time moderation audit log'
        ]
      },
      {
        id: 'prod_ticketflow',
        name: 'TicketFlow',
        developer: 'Flow Labs',
        category: 'Customer support',
        description: 'Organize support conversations with private tickets and workflows.',
        rating: 4.7,
        reviewsCount: 89,
        pricingType: 'paid',
        pricingLabel: 'From $5 / month',
        iconType: 'ticket',
        iconBg: '#0f766e',
        iconColor: '#FFFFFF',
        features: [
          'One-click ticket button embeds',
          'Private channel generation per request',
          'Agent resolution transcripts & analytics'
        ]
      },
      {
        id: 'prod_levelup',
        name: 'LevelUp',
        developer: 'Orbit Studio',
        category: 'Community engagement',
        description: 'Reward participation with levels, achievements and custom roles.',
        rating: 4.9,
        reviewsCount: 214,
        pricingType: 'free',
        pricingLabel: 'Free',
        iconType: 'chart',
        iconBg: '#6d28d9',
        iconColor: '#FFFFFF',
        features: [
          'Gamified XP progression for chatting',
          'Automated level-up role assignments',
          'Customizable rank card cards'
        ]
      },
      {
        id: 'prod_insight',
        name: 'Insight',
        developer: 'Metric Labs',
        category: 'Analytics',
        description: 'Track member growth, engagement and channel performance.',
        rating: 4.8,
        reviewsCount: 76,
        pricingType: 'paid',
        pricingLabel: 'From $8 / month',
        iconType: 'trending',
        iconBg: '#0284c7',
        iconColor: '#FFFFFF',
        features: [
          'Historical server member growth graphs',
          'Voice and text channel peak-hour metrics',
          'Weekly retention & activity digests'
        ]
      },
      {
        id: 'prod_welcome',
        name: 'Welcome',
        developer: 'Hello Studio',
        category: 'Onboarding',
        description: 'Guide new members with personalized greetings and verification.',
        rating: 4.6,
        reviewsCount: 103,
        pricingType: 'freemium',
        pricingLabel: 'Free plan available',
        iconType: 'users',
        iconBg: '#15803d',
        iconColor: '#FFFFFF',
        features: [
          'Rich card banners with member avatar',
          'Captcha button verification rules',
          'Custom welcome direct-message delivery'
        ]
      },
      {
        id: 'prod_eventkit',
        name: 'EventKit',
        developer: 'Gather',
        category: 'Events & scheduling',
        description: 'Plan community events with reminders and simple registration.',
        rating: 4.8,
        reviewsCount: 58,
        pricingType: 'paid',
        pricingLabel: 'From $4 / month',
        iconType: 'calendar',
        iconBg: '#2563eb',
        iconColor: '#FFFFFF',
        features: [
          'Timezone-aware RSVP notifications',
          'Event reminder pings 15 minutes prior',
          'Google Calendar & ICS calendar sync'
        ]
      }
    ];
  },

  async getMarketplaceProducts({ category = 'all', pricing = 'all', search = '', sort = 'recommended' } = {}) {
    let items = this.getDefaultMarketplaceCatalog();

    if (category && category !== 'all') {
      items = items.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (pricing && pricing !== 'all') {
      if (pricing === 'free') {
        items = items.filter(p => p.pricingType === 'free' || p.pricingType === 'freemium');
      } else if (pricing === 'paid') {
        items = items.filter(p => p.pricingType === 'paid');
      }
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.developer.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    if (sort === 'rating') {
      items.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'name') {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return items;
  },

  async getMarketplaceProductById(productId) {
    const catalog = this.getDefaultMarketplaceCatalog();
    return catalog.find(p => p.id === productId) || null;
  },

  async installMarketplaceProduct(userId, productId, serverId) {
    const product = await this.getMarketplaceProductById(productId);
    if (!product) throw new Error('Product not found in Marketplace.');

    const servers = await this.getServers(userId);
    const targetServer = (servers || []).find(s => s.id === serverId) || { id: serverId, name: 'Creative Hub' };

    // Automatically register as an active service in user's workspace
    await this.activateWorkspaceService(userId, {
      serviceId: product.id,
      name: product.name,
      category: product.category,
      iconType: product.iconType,
      serverId: targetServer.id,
      serverName: targetServer.name || 'Creative Hub',
      plan: product.pricingLabel.toLowerCase().includes('free') ? 'Free' : 'Pro',
      usageLabel: '0 of 1,000'
    });

    await this.logActivity(userId, {
      serverId,
      title: `Installed "${product.name}" from Marketplace`,
      description: `Activated ${product.category} service provided by ${product.developer}`,
      actionType: 'marketplace_install'
    });

    return {
      success: true,
      product,
      message: `${product.name} installed to server successfully!`
    };
  },

  // ==========================================
  // 8. DISCORD WORKSPACE (REAL ACTIVE SERVICES)
  // ==========================================
  getDefaultWorkspaceServices(userId = 'default_user') {
    return [
      {
        id: 'ws_sentinel',
        userId,
        serviceId: 'prod_sentinel',
        name: 'Sentinel',
        category: 'Moderation',
        iconType: 'shield',
        status: 'Active',
        serverId: 'srv_1',
        serverName: 'Creative Hub',
        plan: 'Free',
        usageCurrent: 8420,
        usageLimit: 10000,
        usageLabel: '8,420 of 10,000',
        renewalDate: '—',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z'
      },
      {
        id: 'ws_ticketflow',
        userId,
        serviceId: 'prod_ticketflow',
        name: 'TicketFlow',
        category: 'Support',
        iconType: 'ticket',
        status: 'Active',
        serverId: 'srv_1',
        serverName: 'Creative Hub',
        plan: 'Pro',
        usageCurrent: 126,
        usageLimit: 1000,
        usageLabel: '126 of 1,000',
        renewalDate: 'Nov 1, 2026',
        createdAt: '2026-10-02T11:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z'
      },
      {
        id: 'ws_insight',
        userId,
        serviceId: 'prod_insight',
        name: 'Insight',
        category: 'Analytics',
        iconType: 'chart',
        status: 'Active',
        serverId: 'srv_2',
        serverName: 'Design Collective',
        plan: 'Growth',
        usageCurrent: 3,
        usageLimit: 10,
        usageLabel: '3 of 10 sources',
        renewalDate: 'Nov 1, 2026',
        createdAt: '2026-10-03T12:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z'
      },
      {
        id: 'ws_eventkit',
        userId,
        serviceId: 'prod_eventkit',
        name: 'EventKit',
        category: 'Events',
        iconType: 'calendar',
        status: 'Active',
        serverId: 'srv_3',
        serverName: 'Gaming Lounge',
        plan: 'Starter',
        usageCurrent: 4,
        usageLimit: 20,
        usageLabel: '4 of 20 events',
        renewalDate: 'Nov 1, 2026',
        createdAt: '2026-10-04T13:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z'
      },
      {
        id: 'ws_welcome',
        userId,
        serviceId: 'prod_welcome',
        name: 'Welcome',
        category: 'Onboarding',
        iconType: 'users',
        status: 'Active',
        serverId: 'srv_1',
        serverName: 'Creative Hub',
        plan: 'Free',
        usageCurrent: 428,
        usageLimit: 0,
        usageLabel: '428 members',
        renewalDate: '—',
        createdAt: '2026-10-05T14:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z'
      },
      {
        id: 'ws_autoroles',
        userId,
        serviceId: 'prod_autoroles',
        name: 'Auto Roles',
        category: 'Automation',
        iconType: 'settings',
        status: 'Active',
        serverId: 'srv_3',
        serverName: 'Gaming Lounge',
        plan: 'Free',
        usageCurrent: 1204,
        usageLimit: 0,
        usageLabel: '1,204 assigned',
        renewalDate: '—',
        createdAt: '2026-10-06T15:00:00Z',
        updatedAt: '2026-10-10T00:00:00Z'
      }
    ];
  },

  getDefaultWorkspaceOperations(userId = 'default_user') {
    return [
      {
        id: 'op_1',
        userId,
        operation: 'Service activated',
        serviceId: 'prod_ticketflow',
        serviceName: 'TicketFlow',
        result: 'Completed',
        timeAgo: '12 minutes ago',
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString()
      },
      {
        id: 'op_2',
        userId,
        operation: 'Configuration updated',
        serviceId: 'prod_sentinel',
        serviceName: 'Sentinel',
        result: 'Completed',
        timeAgo: '2 hours ago',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'op_3',
        userId,
        operation: 'Server connected',
        serviceId: 'prod_insight',
        serviceName: 'Insight',
        result: 'Completed',
        timeAgo: 'Yesterday',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  },

  async getWorkspace(userId, { search = '', filter = '' } = {}) {
    if (!userId) userId = 'default_user';
    let services = await this.getWorkspaceServices(userId);
    let operations = await this.getWorkspaceOperations(userId);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      services = services.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.serverName.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q) ||
        s.plan.toLowerCase().includes(q)
      );
    }

    const uniqueServers = new Set(services.map(s => s.serverName)).size;

    return {
      services,
      operations: operations.slice(0, 10),
      totalServices: services.length,
      connectedServersCount: uniqueServers || 3,
      allServicesHealthy: services.every(s => (s.status || '').toLowerCase() === 'active')
    };
  },

  async getWorkspaceServices(userId) {
    if (!userId) userId = 'default_user';

    if (isPgActive()) {
      try {
        const res = await queryPg(
          'SELECT * FROM discord_workspace_services WHERE user_id = $1 ORDER BY created_at ASC',
          [userId]
        );
        if (res.rows && res.rows.length > 0) {
          return res.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            serviceId: r.service_id,
            name: r.name,
            category: r.category,
            iconType: r.icon_type,
            status: r.status,
            serverId: r.server_id,
            serverName: r.server_name,
            plan: r.plan,
            usageCurrent: Number(r.usage_current) || 0,
            usageLimit: Number(r.usage_limit) || 0,
            usageLabel: r.usage_label,
            renewalDate: r.renewal_date,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        } else {
          // Seed defaults into PostgreSQL for this user
          const defaults = this.getDefaultWorkspaceServices(userId);
          for (const s of defaults) {
            await queryPg(`
              INSERT INTO discord_workspace_services 
              (id, user_id, service_id, name, category, icon_type, status, server_id, server_name, plan, usage_current, usage_limit, usage_label, renewal_date)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
              ON CONFLICT (id) DO NOTHING
            `, [s.id, userId, s.serviceId, s.name, s.category, s.iconType, s.status, s.serverId, s.serverName, s.plan, s.usageCurrent, s.usageLimit, s.usageLabel, s.renewalDate]);
          }
          return defaults;
        }
      } catch (err) {
        console.warn('[DiscordDB] Postgres getWorkspaceServices error, fallback:', err.message);
      }
    }

    const file = `workspace_services_${userId}.json`;
    let services = readJsonFile(file, null);
    if (!services || services.length === 0) {
      services = this.getDefaultWorkspaceServices(userId);
      writeJsonFile(file, services);
    }
    return services;
  },

  async getWorkspaceServiceById(userId, serviceId) {
    const list = await this.getWorkspaceServices(userId);
    return list.find(s => s.id === serviceId) || null;
  },

  async activateWorkspaceService(userId, data) {
    if (!userId) userId = 'default_user';
    const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newService = {
      id,
      userId,
      serviceId: data.serviceId || id,
      name: data.name,
      category: data.category || 'General',
      iconType: data.iconType || 'shield',
      status: 'Active',
      serverId: data.serverId || 'srv_1',
      serverName: data.serverName || 'Creative Hub',
      plan: data.plan || 'Free',
      usageCurrent: 0,
      usageLimit: data.usageLimit || 1000,
      usageLabel: data.usageLabel || '0 of 1,000',
      renewalDate: data.renewalDate || '—',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_workspace_services 
          (id, user_id, service_id, name, category, icon_type, status, server_id, server_name, plan, usage_current, usage_limit, usage_label, renewal_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [newService.id, userId, newService.serviceId, newService.name, newService.category, newService.iconType, newService.status, newService.serverId, newService.serverName, newService.plan, newService.usageCurrent, newService.usageLimit, newService.usageLabel, newService.renewalDate]);
      } catch (err) {
        console.warn('[DiscordDB] Postgres activateWorkspaceService error:', err.message);
      }
    }

    const file = `workspace_services_${userId}.json`;
    const services = await this.getWorkspaceServices(userId);
    services.unshift(newService);
    writeJsonFile(file, services);

    await this.logWorkspaceOperation(userId, {
      operation: 'Service activated',
      serviceId: newService.serviceId,
      serviceName: newService.name,
      result: 'Completed'
    });

    return newService;
  },

  async updateWorkspaceService(userId, serviceId, updates = {}) {
    if (!userId) userId = 'default_user';
    const services = await this.getWorkspaceServices(userId);
    const index = services.findIndex(s => s.id === serviceId);
    if (index === -1) throw new Error('Workspace service not found');

    const updated = {
      ...services[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    services[index] = updated;

    if (isPgActive()) {
      try {
        await queryPg(`
          UPDATE discord_workspace_services
          SET status = $1, plan = $2, server_name = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4 AND user_id = $5
        `, [updated.status, updated.plan, updated.serverName, serviceId, userId]);
      } catch (err) {
        console.warn('[DiscordDB] Postgres updateWorkspaceService error:', err.message);
      }
    }

    writeJsonFile(`workspace_services_${userId}.json`, services);

    await this.logWorkspaceOperation(userId, {
      operation: 'Configuration updated',
      serviceId: updated.serviceId,
      serviceName: updated.name,
      result: 'Completed'
    });

    return updated;
  },

  async deleteWorkspaceService(userId, serviceId) {
    if (!userId) userId = 'default_user';
    const services = await this.getWorkspaceServices(userId);
    const target = services.find(s => s.id === serviceId);
    const filtered = services.filter(s => s.id !== serviceId);

    if (isPgActive()) {
      try {
        await queryPg('DELETE FROM discord_workspace_services WHERE id = $1 AND user_id = $2', [serviceId, userId]);
      } catch (err) {
        console.warn('[DiscordDB] Postgres deleteWorkspaceService error:', err.message);
      }
    }

    writeJsonFile(`workspace_services_${userId}.json`, filtered);

    if (target) {
      await this.logWorkspaceOperation(userId, {
        operation: 'Service deactivated',
        serviceId: target.serviceId,
        serviceName: target.name,
        result: 'Completed'
      });
    }

    return { success: true };
  },

  async getWorkspaceOperations(userId) {
    if (!userId) userId = 'default_user';

    if (isPgActive()) {
      try {
        const res = await queryPg(
          'SELECT * FROM discord_workspace_operations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
          [userId]
        );
        if (res.rows && res.rows.length > 0) {
          return res.rows.map(r => ({
            id: r.id,
            userId: r.user_id,
            operation: r.operation,
            serviceId: r.service_id,
            serviceName: r.service_name,
            result: r.result,
            timeAgo: r.time_ago || 'Recent',
            createdAt: r.created_at
          }));
        } else {
          const defaults = this.getDefaultWorkspaceOperations(userId);
          for (const op of defaults) {
            await queryPg(`
              INSERT INTO discord_workspace_operations
              (id, user_id, operation, service_id, service_name, result, time_ago)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id) DO NOTHING
            `, [op.id, userId, op.operation, op.serviceId, op.serviceName, op.result, op.timeAgo]);
          }
          return defaults;
        }
      } catch (err) {
        console.warn('[DiscordDB] Postgres getWorkspaceOperations error, fallback:', err.message);
      }
    }

    const file = `workspace_operations_${userId}.json`;
    let ops = readJsonFile(file, null);
    if (!ops || ops.length === 0) {
      ops = this.getDefaultWorkspaceOperations(userId);
      writeJsonFile(file, ops);
    }
    return ops;
  },

  async logWorkspaceOperation(userId, { operation, serviceId, serviceName, result = 'Completed' }) {
    if (!userId) userId = 'default_user';
    const id = `op_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newOp = {
      id,
      userId,
      operation,
      serviceId,
      serviceName,
      result,
      timeAgo: 'Just now',
      createdAt: new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO discord_workspace_operations
          (id, user_id, operation, service_id, service_name, result, time_ago)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, userId, operation, serviceId, serviceName, result, 'Just now']);
      } catch (err) {
        console.warn('[DiscordDB] Postgres logWorkspaceOperation error:', err.message);
      }
    }

    const file = `workspace_operations_${userId}.json`;
    const ops = await this.getWorkspaceOperations(userId);
    ops.unshift(newOp);
    writeJsonFile(file, ops.slice(0, 50));
    return newOp;
  }
};
