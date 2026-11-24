import crypto from 'node:crypto';
import path from 'node:path';
import { isPgActive, queryPg } from '../db/postgres.js';
import {
  BACKUPS_BASE_DIR,
  SHARED_UBUNTU_RUNTIME_IMAGE,
  TENANTS_BASE_DIR
} from './constants.js';

export { BACKUPS_BASE_DIR, SHARED_UBUNTU_RUNTIME_IMAGE, TENANTS_BASE_DIR };

const inMemoryTenants = new Map();
let schemaReady = false;
let schemaPromise = null;

function createValidationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function sanitizeTenantSlug(rawValue) {
  const raw = String(rawValue || '').trim();
  if (raw.includes('..') || raw.includes('/') || raw.includes('\\')) {
    throw createValidationError('Tenant identifier cannot contain path separators or traversal.');
  }
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);

  if (!/^[a-z0-9][a-z0-9_]{1,35}$/.test(cleaned)) {
    throw createValidationError(
      'Tenant identifier must contain at least 2 alphanumeric characters.'
    );
  }
  return cleaned;
}

function parseBoundedInt(value, fallback, min, max, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw createValidationError(`${label} must be an integer between ${min} and ${max}.`);
  }
  return num;
}

export function buildTenantBlueprint({
  userId,
  tiwiId = '',
  tenantSlug = '',
  nodeId = 'primary-ubuntu-node',
  sharedImage = SHARED_UBUNTU_RUNTIME_IMAGE,
  cpuQuotaPercent = 50,
  ramLimitMb = 512,
  storageLimitGb = 5
} = {}) {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) {
    throw createValidationError('userId is required to build a tenant blueprint.');
  }
  const cleanNodeId = String(nodeId || '').trim();
  if (!cleanNodeId || /[^a-zA-Z0-9._:-]/.test(cleanNodeId)) {
    throw createValidationError('nodeId contains invalid characters.');
  }

  const slug = sanitizeTenantSlug(tenantSlug || tiwiId || cleanUserId);
  const rootPath = path.posix.join(TENANTS_BASE_DIR, slug);
  const backupPath = path.posix.join(BACKUPS_BASE_DIR, slug);

  return {
    tenantId: `ubt_${crypto.createHash('sha256').update(`${cleanUserId}:${slug}`).digest('hex').slice(0, 16)}`,
    userId: cleanUserId,
    tiwiId: String(tiwiId || '').trim() || null,
    tenantSlug: slug,
    nodeId: cleanNodeId,
    ubuntuUser: `tw_${slug}`,
    rootPath,
    appPath: path.posix.join(rootPath, 'app'),
    storagePath: path.posix.join(rootPath, 'storage'),
    logsPath: path.posix.join(rootPath, 'logs'),
    backupPath,
    dbName: `cust_${slug}`,
    dbRole: `role_${slug}`,
    sharedImage: String(sharedImage || SHARED_UBUNTU_RUNTIME_IMAGE).trim(),
    cpuQuotaPercent: parseBoundedInt(cpuQuotaPercent, 50, 10, 400, 'cpuQuotaPercent'),
    ramLimitMb: parseBoundedInt(ramLimitMb, 512, 128, 32768, 'ramLimitMb'),
    storageLimitGb: parseBoundedInt(storageLimitGb, 5, 1, 2000, 'storageLimitGb')
  };
}

function formatTenantRow(row) {
  if (!row) return null;
  return {
    tenantId: row.id,
    userId: row.user_id,
    tiwiId: row.tiwi_id || null,
    tenantSlug: row.tenant_slug,
    nodeId: row.node_id,
    ubuntuUser: row.ubuntu_user,
    rootPath: row.root_path,
    appPath: path.posix.join(row.root_path, 'app'),
    storagePath: path.posix.join(row.root_path, 'storage'),
    logsPath: path.posix.join(row.root_path, 'logs'),
    backupPath: row.backup_path,
    dbName: row.db_name,
    dbRole: row.db_role,
    sharedImage: row.shared_image,
    cpuQuotaPercent: Number(row.cpu_quota_percent),
    ramLimitMb: Number(row.ram_limit_mb),
    storageLimitGb: Number(row.storage_limit_gb),
    status: row.status,
    migratedFromNodeId: row.migrated_from_node_id || null,
    lastBackupAt: row.last_backup_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

export function resetInMemoryUbuntuTenantsForTests() {
  inMemoryTenants.clear();
  schemaReady = false;
  schemaPromise = null;
}

export async function ensureUbuntuTenantSchema() {
  if (!isPgActive()) {
    return { ok: true, mode: 'memory' };
  }
  if (schemaReady) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise = (async () => {
    await queryPg(`
      CREATE TABLE IF NOT EXISTS system_ubuntu_tenants (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tiwi_id TEXT,
        tenant_slug TEXT NOT NULL UNIQUE,
        node_id TEXT NOT NULL,
        ubuntu_user TEXT NOT NULL,
        root_path TEXT NOT NULL,
        backup_path TEXT NOT NULL,
        db_name TEXT NOT NULL UNIQUE,
        db_role TEXT NOT NULL,
        shared_image TEXT NOT NULL DEFAULT '${SHARED_UBUNTU_RUNTIME_IMAGE}',
        cpu_quota_percent INTEGER NOT NULL DEFAULT 50,
        ram_limit_mb INTEGER NOT NULL DEFAULT 512,
        storage_limit_gb INTEGER NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'active',
        migrated_from_node_id TEXT,
        last_backup_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ubuntu_tenants_user
        ON system_ubuntu_tenants(user_id);
      CREATE INDEX IF NOT EXISTS idx_ubuntu_tenants_node
        ON system_ubuntu_tenants(node_id, status);
    `);
    schemaReady = true;
    return { ok: true, mode: 'postgres' };
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

export async function registerUbuntuTenant(input = {}) {
  const blueprint = buildTenantBlueprint(input);
  const nowIso = new Date().toISOString();

  if (!isPgActive()) {
    const existingBySlug = [...inMemoryTenants.values()].find(
      (item) => item.tenantSlug === blueprint.tenantSlug && item.tenantId !== blueprint.tenantId
    );
    if (existingBySlug) {
      throw createValidationError(`Tenant slug "${blueprint.tenantSlug}" is already assigned.`, 409);
    }
    const existing = inMemoryTenants.get(blueprint.tenantId);
    const record = {
      ...blueprint,
      status: existing?.status || 'active',
      migratedFromNodeId: existing?.migratedFromNodeId || null,
      lastBackupAt: existing?.lastBackupAt || null,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso
    };
    inMemoryTenants.set(record.tenantId, record);
    return record;
  }

  await ensureUbuntuTenantSchema();
  const { rows } = await queryPg(
    `INSERT INTO system_ubuntu_tenants (
       id, user_id, tiwi_id, tenant_slug, node_id, ubuntu_user,
       root_path, backup_path, db_name, db_role, shared_image,
       cpu_quota_percent, ram_limit_mb, storage_limit_gb, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
     ON CONFLICT (id) DO UPDATE SET
       node_id = EXCLUDED.node_id,
       shared_image = EXCLUDED.shared_image,
       cpu_quota_percent = EXCLUDED.cpu_quota_percent,
       ram_limit_mb = EXCLUDED.ram_limit_mb,
       storage_limit_gb = EXCLUDED.storage_limit_gb,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      blueprint.tenantId,
      blueprint.userId,
      blueprint.tiwiId,
      blueprint.tenantSlug,
      blueprint.nodeId,
      blueprint.ubuntuUser,
      blueprint.rootPath,
      blueprint.backupPath,
      blueprint.dbName,
      blueprint.dbRole,
      blueprint.sharedImage,
      blueprint.cpuQuotaPercent,
      blueprint.ramLimitMb,
      blueprint.storageLimitGb
    ]
  );

  return formatTenantRow(rows[0]);
}

export async function listUbuntuTenants({ nodeId = '', userId = '' } = {}) {
  const cleanNode = String(nodeId || '').trim();
  const cleanUser = String(userId || '').trim();

  if (!isPgActive()) {
    return [...inMemoryTenants.values()]
      .filter((t) => (!cleanNode || t.nodeId === cleanNode) && (!cleanUser || t.userId === cleanUser))
      .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
  }

  await ensureUbuntuTenantSchema();
  const conditions = [];
  const params = [];
  if (cleanNode) {
    params.push(cleanNode);
    conditions.push(`node_id = $${params.length}`);
  }
  if (cleanUser) {
    params.push(cleanUser);
    conditions.push(`user_id = $${params.length}`);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await queryPg(
    `SELECT * FROM system_ubuntu_tenants ${whereClause} ORDER BY updated_at DESC`,
    params
  );
  return rows.map(formatTenantRow);
}

export async function migrateUbuntuTenantNode({ tenantId, targetNodeId } = {}) {
  const cleanTenantId = String(tenantId || '').trim();
  const cleanTargetNodeId = String(targetNodeId || '').trim();
  if (!cleanTenantId || !cleanTargetNodeId) {
    throw createValidationError('tenantId and targetNodeId are required.');
  }
  if (/[^a-zA-Z0-9._:-]/.test(cleanTargetNodeId)) {
    throw createValidationError('targetNodeId contains invalid characters.');
  }

  if (!isPgActive()) {
    const existing = inMemoryTenants.get(cleanTenantId);
    if (!existing) return null;
    const updated = {
      ...existing,
      migratedFromNodeId: existing.nodeId,
      nodeId: cleanTargetNodeId,
      status: 'active',
      updatedAt: new Date().toISOString()
    };
    inMemoryTenants.set(cleanTenantId, updated);
    return updated;
  }

  await ensureUbuntuTenantSchema();
  const { rows } = await queryPg(
    `UPDATE system_ubuntu_tenants
     SET migrated_from_node_id = node_id,
         node_id = $2,
         status = 'active',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [cleanTenantId, cleanTargetNodeId]
  );
  return formatTenantRow(rows[0] || null);
}

/**
 * Reclaims a deleted droplet/tenant slot and frees its reserved storage quota back to the cluster pool.
 */
export async function reclaimUbuntuTenant({ tenantId, userId = null, systemAdmin = false } = {}) {
  const cleanTenantId = String(tenantId || '').trim();
  const cleanUserId = userId ? String(userId).trim() : '';
  if (!cleanTenantId || (!cleanUserId && systemAdmin !== true)) return null;

  if (!isPgActive()) {
    const existing = inMemoryTenants.get(cleanTenantId);
    if (!existing || (!systemAdmin && existing.userId !== cleanUserId)) return null;
    inMemoryTenants.delete(cleanTenantId);
    return existing;
  }

  await ensureUbuntuTenantSchema();
  const params = [cleanTenantId];
  const userFilter = systemAdmin ? '' : ` AND user_id = $2`;
  if (!systemAdmin) params.push(cleanUserId);
  const { rows } = await queryPg(
    `DELETE FROM system_ubuntu_tenants WHERE id = $1${userFilter} RETURNING *`,
    params
  );
  return formatTenantRow(rows[0] || null);
}

export async function updateUbuntuTenantStatus({ tenantId, status, userId = null, systemAdmin = false } = {}) {
  const cleanTenantId = String(tenantId || '').trim();
  const cleanStatus = String(status || '').trim().toLowerCase();
  const cleanUserId = userId ? String(userId).trim() : '';
  if (!cleanTenantId || (!cleanUserId && systemAdmin !== true) || !['active', 'stopped', 'suspended'].includes(cleanStatus)) return null;

  if (!isPgActive()) {
    const existing = inMemoryTenants.get(cleanTenantId);
    if (!existing || (!systemAdmin && existing.userId !== cleanUserId)) return null;
    const updated = { ...existing, status: cleanStatus, updatedAt: new Date().toISOString() };
    inMemoryTenants.set(cleanTenantId, updated);
    return updated;
  }

  await ensureUbuntuTenantSchema();
  const params = [cleanTenantId, cleanStatus];
  const userFilter = systemAdmin ? '' : ` AND user_id = $3`;
  if (!systemAdmin) params.push(cleanUserId);
  const { rows } = await queryPg(
    `UPDATE system_ubuntu_tenants
     SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1${userFilter}
     RETURNING *`,
    params
  );
  return formatTenantRow(rows[0] || null);
}
