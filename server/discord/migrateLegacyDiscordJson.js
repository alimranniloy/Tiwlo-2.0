import '../config/loadRootEnv.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPgPool, testPgConnection } from '../db/postgres.js';
import { ensureDiscordSchema } from './discordSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data/db/discord');
const DEMO_PRODUCTS = new Set([
  'prod_sentinel',
  'prod_ticketflow',
  'prod_levelup',
  'prod_insight',
  'prod_welcome',
  'prod_eventkit',
  'prod_autoroles'
]);
const DEMO_SERVICE_ROWS = new Set([
  'ws_sentinel',
  'ws_ticketflow',
  'ws_insight',
  'ws_eventkit',
  'ws_welcome',
  'ws_autoroles'
]);
const DEMO_OPERATION_ROWS = new Set(['op_1', 'op_2', 'op_3']);

function readArray(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return [];
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(value)) throw new Error(`${filename} must contain a JSON array.`);
  return value;
}

async function userExists(client, userId) {
  if (!userId) return false;
  const result = await client.query('SELECT 1 FROM system_users WHERE id = $1', [userId]);
  return result.rowCount > 0;
}

async function insertRecord(client, sql, values) {
  const result = await client.query(sql, values);
  return result.rowCount > 0;
}

export async function migrateLegacyDiscordJson() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('[Discord migration] No legacy JSON directory found; nothing to import.');
    return { imported: 0, skipped: 0 };
  }
  if (!await testPgConnection()) {
    throw new Error('PostgreSQL is unavailable; Discord JSON migration was not started.');
  }

  const client = await getPgPool().connect();
  const counts = { imported: 0, skipped: 0 };
  try {
    await client.query('BEGIN');
    await ensureDiscordSchema(client);

    for (const row of readArray('bots.json')) {
      const added = await insertRecord(client, `
        INSERT INTO discord_bots
          (id, user_id, name, token, client_id, avatar, prefix, status, description, commands_today, created_at, updated_at)
        SELECT $1, u.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        FROM system_users u WHERE u.id = $2
        ON CONFLICT (id) DO NOTHING
      `, [
        row.id, row.userId, row.name, row.token || null, row.clientId || null, row.avatar || null,
        row.prefix || '!', row.status || 'offline', row.description || '',
        Number(row.commandsToday) || 0, row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString()
      ]);
      counts[added ? 'imported' : 'skipped']++;
    }

    for (const row of readArray('servers.json')) {
      const added = await insertRecord(client, `
        INSERT INTO discord_servers
          (id, user_id, name, icon, member_count, guild_id, created_at, updated_at)
        SELECT $1, u.id, $3, $4, $5, $6, $7, $8
        FROM system_users u WHERE u.id = $2
        ON CONFLICT (id) DO NOTHING
      `, [
        row.id, row.userId, row.name, row.icon || null, Number(row.memberCount) || 0,
        row.guildId || null, row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString()
      ]);
      counts[added ? 'imported' : 'skipped']++;
    }

    for (const row of readArray('bot_servers.json')) {
      const added = await insertRecord(client, `
        INSERT INTO discord_bot_servers (id, bot_id, server_id, added_at)
        SELECT $1, b.id, s.id, $4
        FROM discord_bots b
        JOIN discord_servers s ON s.id = $3 AND s.user_id = b.user_id
        WHERE b.id = $2
        ON CONFLICT (bot_id, server_id) DO NOTHING
      `, [row.id, row.botId, row.serverId, row.addedAt || new Date().toISOString()]);
      counts[added ? 'imported' : 'skipped']++;
    }

    for (const row of readArray('activities.json')) {
      const title = String(row.title || '');
      const isLegacyProductDemo = row.actionType === 'marketplace_install' &&
        [...DEMO_PRODUCTS].some((id) => title.toLowerCase().includes(id.replace('prod_', '')));
      if (isLegacyProductDemo || !(await userExists(client, row.userId))) {
        counts.skipped++;
        continue;
      }
      const added = await insertRecord(client, `
        INSERT INTO discord_activities
          (id, user_id, bot_id, server_id, title, description, action_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        row.id, row.userId, row.botId || null, row.serverId || null, row.title,
        row.description || '', row.actionType || 'general', row.createdAt || new Date().toISOString()
      ]);
      counts[added ? 'imported' : 'skipped']++;
    }

    for (const row of readArray('automations.json')) {
      const added = await insertRecord(client, `
        INSERT INTO discord_automations
          (id, user_id, bot_id, server_id, type, title, description, config, enabled, created_at, updated_at)
        SELECT $1, u.id, $3, $4, $5, $6, $7, $8, $9, $10, $11
        FROM system_users u WHERE u.id = $2
        ON CONFLICT (id) DO NOTHING
      `, [
        row.id, row.userId, row.botId || null, row.serverId || null, row.type, row.title,
        row.description || '', row.config || {}, row.enabled !== false,
        row.createdAt || new Date().toISOString(),
        row.updatedAt || row.createdAt || new Date().toISOString()
      ]);
      counts[added ? 'imported' : 'skipped']++;
    }

    for (const row of readArray('tickets.json')) {
      const added = await insertRecord(client, `
        INSERT INTO discord_tickets
          (id, user_id, server_id, channel_name, author_name, subject, status, created_at)
        SELECT $1, u.id, $3, $4, $5, $6, $7, $8
        FROM system_users u WHERE u.id = $2
        ON CONFLICT (id) DO NOTHING
      `, [
        row.id, row.userId, row.serverId || null, row.channelName || null,
        row.authorName || null, row.subject || null, row.status || 'open',
        row.createdAt || new Date().toISOString()
      ]);
      counts[added ? 'imported' : 'skipped']++;
    }

    const files = fs.readdirSync(DATA_DIR);
    for (const filename of files.filter((name) => /^workspace_services_.+\.json$/.test(name))) {
      for (const row of readArray(filename)) {
        if (DEMO_SERVICE_ROWS.has(row.id) || DEMO_PRODUCTS.has(row.serviceId)) {
          counts.skipped++;
          continue;
        }
        const userId = row.userId || filename.slice('workspace_services_'.length, -'.json'.length);
        const added = await insertRecord(client, `
          INSERT INTO discord_workspace_services
            (id, user_id, service_id, name, category, icon_type, status, server_id, server_name, plan,
             usage_current, usage_limit, usage_label, renewal_date, logo_url, created_at, updated_at)
          SELECT $1, u.id, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          FROM system_users u WHERE u.id = $2
          ON CONFLICT (id) DO NOTHING
        `, [
          row.id, userId, row.serviceId || null, row.name, row.category || 'General',
          row.iconType || null, row.status || 'Active', row.serverId || null, row.serverName,
          row.plan || null, row.usageCurrent ?? null, row.usageLimit ?? null,
          row.usageLabel || null, row.renewalDate || null, row.logoUrl || null,
          row.createdAt || new Date().toISOString(), row.updatedAt || row.createdAt || new Date().toISOString()
        ]);
        counts[added ? 'imported' : 'skipped']++;
      }
    }

    for (const filename of files.filter((name) => /^workspace_operations_.+\.json$/.test(name))) {
      for (const row of readArray(filename)) {
        if (DEMO_OPERATION_ROWS.has(row.id) || DEMO_PRODUCTS.has(row.serviceId)) {
          counts.skipped++;
          continue;
        }
        const userId = row.userId || filename.slice('workspace_operations_'.length, -'.json'.length);
        const added = await insertRecord(client, `
          INSERT INTO discord_workspace_operations
            (id, user_id, operation, service_id, service_name, result, time_ago, created_at)
          SELECT $1, u.id, $3, $4, $5, $6, $7, $8
          FROM system_users u WHERE u.id = $2
          ON CONFLICT (id) DO NOTHING
        `, [
          row.id, userId, row.operation, row.serviceId || null, row.serviceName || '—',
          row.result || 'Completed', row.timeAgo || null,
          row.createdAt || new Date().toISOString()
        ]);
        counts[added ? 'imported' : 'skipped']++;
      }
    }

    await client.query('COMMIT');
    console.log(`[Discord migration] Imported ${counts.imported} records; skipped ${counts.skipped}. Source JSON files were preserved.`);
    return counts;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrateLegacyDiscordJson().catch((error) => {
    console.error('[Discord migration] Failed; source JSON files were preserved:', error.message);
    process.exitCode = 1;
  });
}
