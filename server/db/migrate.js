import '../config/loadRootEnv.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getPgPool, testPgConnection } from './postgres.js';

const defaultDirectory = process.env.TIWLO_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const arrayFields = ['products', 'categories', 'subcategories', 'customers', 'suppliers', 'purchases', 'sales', 'inventory_adjustments', 'activities'];
async function readOptional(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw new Error(`Cannot migrate ${path.basename(file)}: ${error.message}`); }
}
function validateStore(store) {
  if (!store || typeof store !== 'object' || Array.isArray(store) || !store.tiwiId) throw new Error('Invalid tenant document');
  for (const field of arrayFields) if (store[field] !== undefined && !Array.isArray(store[field])) throw new Error(`Invalid tenant collection: ${field}`);
}

// Upgrade only. Application reads/writes use PostgreSQL exclusively. Retain
// source files as backups; never destroy the only copy before verifying migration.
export async function runMigration(directory = defaultDirectory, pool = getPgPool()) {
  const client = await pool.connect();
  let imported = 0;
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(73192645)");
    const marker = await client.query("SELECT 1 FROM system_state_documents WHERE namespace = 'migration' AND document_key = 'tenant-postgres-v1'");
    if (marker.rows.length) { await client.query('COMMIT'); return 0; }
    const oldUsers = await readOptional(path.join(directory, 'users.json')) ?? [];
    if (!Array.isArray(oldUsers)) throw new Error('users.json must contain an array');
    for (const user of oldUsers) {
      if (!user?.id || !user.email || !(user.password_hash || user.password)) continue;
      const result = await client.query(`INSERT INTO system_users (
        id, tiwi_id, name, store_name, email, password, password_hash, role, plan_id, plan_name,
        avatar, cover_photo, phone, subdomain, is_banned, ban_reason, two_factor_enabled,
        email_verified, auth_method, created_at, account_type, business_name, address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      ON CONFLICT DO NOTHING`, [
        String(user.id), user.tiwiId || user.storeId || null, user.name || user.storeName || null,
        user.storeName || null, String(user.email).trim().toLowerCase(), user.password || user.password_hash,
        user.password_hash || user.password, user.role === 'admin' || user.role === 'super_admin' ? 'owner' : (user.role || 'owner'),
        user.planId || 'free', user.planName || 'Free Starter', user.avatar || null,
        user.coverPhoto || null, user.phone || null, user.subdomain || null, Boolean(user.isBanned),
        user.banReason || null, Boolean(user.twoFactorEnabled), Boolean(user.emailVerified),
        user.authMethod || 'credentials', user.createdAt || new Date().toISOString(),
        user.accountType || 'personal', user.businessName || null, user.address || null
      ]);
      imported += result.rowCount;
    }
    const persist = async (namespace, key, data) => {
      const result = await client.query(`INSERT INTO system_state_documents(namespace, document_key, data)
        VALUES ($1,$2,$3::jsonb) ON CONFLICT DO NOTHING RETURNING document_key`, [namespace, key, JSON.stringify(data)]);
      imported += result.rows.length;
    };
    const storesDir = path.join(directory, 'db', 'stores');
    const registry = await readOptional(path.join(storesDir, 'registry.json'));
    const oldSubscription = await readOptional(path.join(directory, 'subscription.json')) ?? {};
    if (registry !== null) {
      if (!Array.isArray(registry) || registry.some(row => !row?.tiwiId)) throw new Error('Invalid tenant registry');
      const subscriptions = Array.isArray(oldSubscription) ? oldSubscription : oldSubscription?.tiwiId ? [oldSubscription] : [];
      await persist('master', 'directory', { stores: registry, subscriptions });
    } else if (Array.isArray(oldSubscription) ? oldSubscription.length : Object.keys(oldSubscription).length) {
      const subscriptions = Array.isArray(oldSubscription) ? oldSubscription : oldSubscription.tiwiId ? [oldSubscription] : [];
      await persist('master', 'directory', { stores: [], subscriptions });
    }
    let files = [];
    try { files = await fs.readdir(storesDir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const file of files.filter(name => name.endsWith('.json') && name !== 'registry.json')) {
      const store = await readOptional(path.join(storesDir, file));
      validateStore(store);
      await persist('tenant', store.tiwiId, store);
    }
    const primary = { tiwiId: 'TIW-PRIMARY' };
    let found = false;
    for (const field of [...arrayFields, 'store_settings']) {
      const value = await readOptional(path.join(directory, `${field}.json`)) ?? await readOptional(path.join(directory, 'migration_backup', `${field}.json`));
      if (value !== null) { primary[field] = value; found = true; }
    }
    if (found) { validateStore(primary); await persist('tenant', primary.tiwiId, primary); }
    await client.query("INSERT INTO system_state_documents(namespace, document_key, data) VALUES ('migration','tenant-postgres-v1',$1::jsonb)", [JSON.stringify({ imported, completedAt: new Date().toISOString() })]);
    await client.query('COMMIT');
    return imported;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (!await testPgConnection()) throw new Error('PostgreSQL is required for migration');
    console.log(`Migrated ${await runMigration()} tenant documents to PostgreSQL.`);
  } finally { await getPgPool().end(); }
}
