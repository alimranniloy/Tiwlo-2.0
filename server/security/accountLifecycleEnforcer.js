// Ensure serverPackageService resolves its DROPLET_IMAGE_CATALOG dependency on cloud.js before postgres.js loads billing -> cloud.
import '../administrator/serverPackageService.js';
import { randomUUID } from 'node:crypto';
import { getPgPool, isPgActive, queryPg } from '../db/postgres.js';
import {
  holdDropletIpAllocations,
  releaseDropletIpAllocations,
  restoreDropletIpAllocations
} from '../ubuntu/ipv6PoolService.js';
import {
  reclaimUbuntuTenant,
  updateUbuntuTenantStatus
} from '../ubuntu/tenantLayout.js';
import { adjustNodeActiveDroplets } from '../administrator/serverFleetService.js';
import { setDropletPowerOnHost } from '../ubuntu/hostProvisionerClient.js';

export const HOLD_TYPES = Object.freeze({
  NID_REVIEW: 'nid_review',
  TEMP_BAN: 'temp_ban',
  PERMANENT_BAN: 'permanent_ban',
  CLEARED: 'cleared'
});

const ACTIVE_HOLD_TYPES = new Set([
  HOLD_TYPES.NID_REVIEW,
  HOLD_TYPES.TEMP_BAN,
  HOLD_TYPES.PERMANENT_BAN
]);

const DAY_MS = 24 * 60 * 60 * 1000;

export const ACCOUNT_LIFECYCLE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS system_account_service_holds (
    user_id VARCHAR(64) PRIMARY KEY,
    hold_type VARCHAR(32) NOT NULL
      CHECK (hold_type IN ('nid_review', 'temp_ban', 'permanent_ban', 'cleared')),
    non_refundable BOOLEAN NOT NULL DEFAULT TRUE,
    paused_at TIMESTAMPTZ,
    retain_until TIMESTAMPTZ,
    purged_at TIMESTAMPTZ,
    reason TEXT,
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_account_service_holds_purge
    ON system_account_service_holds(hold_type, retain_until)
    WHERE purged_at IS NULL;

  CREATE TABLE IF NOT EXISTS system_account_lifecycle_audits (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    hold_type VARCHAR(32),
    non_refundable BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_account_lifecycle_audits_user
    ON system_account_lifecycle_audits(user_id, created_at DESC);

  DO $$
  BEGIN
    IF to_regclass('public.system_stores') IS NOT NULL THEN
      ALTER TABLE system_stores ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
    END IF;
    IF to_regclass('public.system_subscriptions') IS NOT NULL THEN
      ALTER TABLE system_subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active';
      ALTER TABLE system_subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    END IF;
    IF to_regclass('public.cloud_droplets') IS NOT NULL THEN
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ;
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(12, 2);
    END IF;
  END $$;
`;

// ============================================================================
// IN-MEMORY STORE (FOR DETERMINISTIC UNIT TESTS & NON-PG ENVIRONMENTS)
// ============================================================================

const memoryHolds = new Map();
const memoryDroplets = new Map();
const memoryTenants = new Map();
const memoryNodes = new Map();
const memoryStores = new Map();
const memoryStoreSubscriptions = new Map();
const memoryServiceSubscriptions = new Map();
const memoryNotifications = [];
const memoryAudits = [];

let schemaEnsured = false;

function createLifecycleError(message, statusCode = 400, code = 'ACCOUNT_LIFECYCLE_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value) {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function cleanUserId(userId) {
  const clean = String(userId || '').trim();
  if (!clean) {
    throw createLifecycleError('userId is required.', 400, 'INVALID_USER_ID');
  }
  return clean;
}

function resolveRunner(queryable = null) {
  if (queryable) {
    if (typeof queryable === 'function') {
      return { active: true, query: queryable, exec: null, pool: null };
    }
    if (typeof queryable.query === 'function') {
      const hasExec = typeof queryable.exec === 'function';
      return {
        active: true,
        query: async (sql, params = []) => {
          if ((!params || params.length === 0) && hasExec) {
            const results = await queryable.exec(sql);
            return Array.isArray(results) ? (results[results.length - 1] || { rows: [] }) : { rows: [] };
          }
          return queryable.query(sql, params);
        },
        exec: hasExec ? (sql) => queryable.exec(sql) : null,
        pool: typeof queryable.connect === 'function' ? queryable : null
      };
    }
  }
  if (isPgActive()) {
    return {
      active: true,
      query: queryPg,
      exec: null,
      pool: getPgPool()
    };
  }
  return { active: false, query: null, exec: null, pool: null };
}

async function tableExists(runner, tableName) {
  const { rows } = await runner.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`public.${tableName}`]
  );
  return Boolean(rows?.[0]?.exists);
}

async function getTableColumns(runner, tableName) {
  const exists = await tableExists(runner, tableName);
  if (!exists) return new Set();
  const { rows } = await runner.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set((rows || []).map((r) => r.column_name));
}

export function resetInMemoryAccountLifecycleForTests() {
  memoryHolds.clear();
  memoryDroplets.clear();
  memoryTenants.clear();
  memoryNodes.clear();
  memoryStores.clear();
  memoryStoreSubscriptions.clear();
  memoryServiceSubscriptions.clear();
  memoryNotifications.length = 0;
  memoryAudits.length = 0;
  schemaEnsured = false;
}

export function getInMemoryAccountLifecycleStateForTests() {
  return {
    holds: [...memoryHolds.values()].map((h) => structuredClone(h)),
    droplets: [...memoryDroplets.values()].map((d) => ({ ...d })),
    tenants: [...memoryTenants.values()].map((t) => ({ ...t })),
    nodes: [...memoryNodes.values()].map((n) => ({ ...n })),
    stores: [...memoryStores.values()].map((s) => ({ ...s })),
    storeSubscriptions: [...memoryStoreSubscriptions.values()].map((s) => ({ ...s })),
    serviceSubscriptions: [...memoryServiceSubscriptions.values()].map((s) => ({ ...s })),
    notifications: memoryNotifications.map((n) => structuredClone(n)),
    audits: memoryAudits.map((a) => structuredClone(a))
  };
}

export function seedInMemoryAccountServicesForTests({
  userId,
  droplets = [],
  tenants = [],
  nodes = [],
  stores = [],
  storeSubscriptions = [],
  serviceSubscriptions = []
} = {}) {
  const cleanUid = userId ? String(userId).trim() : null;

  for (const node of nodes) {
    if (!node?.id) continue;
    memoryNodes.set(String(node.id), {
      id: String(node.id),
      activeDroplets: Number(node.activeDroplets ?? node.active_droplets ?? 0)
    });
  }

  for (const tenant of tenants) {
    const tenantId = tenant?.tenantId || tenant?.id;
    if (!tenantId) continue;
    memoryTenants.set(String(tenantId), {
      tenantId: String(tenantId),
      userId: String(tenant.userId ?? tenant.user_id ?? cleanUid ?? ''),
      nodeId: String(tenant.nodeId ?? tenant.node_id ?? 'primary-ubuntu-node'),
      status: String(tenant.status || 'active')
    });
  }

  for (const droplet of droplets) {
    if (!droplet?.id) continue;
    memoryDroplets.set(String(droplet.id), {
      id: String(droplet.id),
      userId: String(droplet.userId ?? droplet.user_id ?? cleanUid ?? ''),
      name: String(droplet.name || droplet.id),
      tenantId: droplet.tenantId ?? droplet.tenant_id ?? null,
      nodeId: droplet.nodeId ?? droplet.node_id ?? 'primary-ubuntu-node',
      status: String(droplet.status || 'active'),
      monthlyPrice: droplet.monthlyPrice ?? droplet.monthly_price ?? null,
      nextBillingAt: toIso(droplet.nextBillingAt ?? droplet.next_billing_at ?? droplet.currentPeriodEnd ?? droplet.current_period_end),
      suspendedAt: toIso(droplet.suspendedAt ?? droplet.suspended_at),
      sshPort: Number(droplet.sshPort ?? droplet.ssh_port ?? 22),
      accessUsername: String(droplet.accessUsername ?? droplet.access_username ?? 'root')
    });
  }

  for (const store of stores) {
    const tiwiId = store?.tiwiId ?? store?.tiwi_id ?? store?.id;
    if (!tiwiId) continue;
    memoryStores.set(String(tiwiId), {
      id: String(store.id || tiwiId),
      tiwiId: String(tiwiId),
      ownerId: String(store.ownerId ?? store.owner_id ?? cleanUid ?? ''),
      storeName: String(store.storeName ?? store.store_name ?? 'Test Store'),
      planId: String(store.planId ?? store.plan_id ?? 'free'),
      status: String(store.status || 'active'),
      lifecycleStatus: String(store.lifecycleStatus || store.status || 'active'),
      expiresAt: toIso(store.expiresAt ?? store.expires_at ?? store.currentPeriodEnd ?? store.current_period_end)
    });
  }

  for (const sub of storeSubscriptions) {
    const tiwiId = sub?.tiwiId ?? sub?.tiwi_id;
    if (!tiwiId) continue;
    memoryStoreSubscriptions.set(String(tiwiId), {
      id: String(sub.id || `sub_${tiwiId}`),
      tiwiId: String(tiwiId),
      ownerId: String(sub.ownerId ?? sub.owner_id ?? cleanUid ?? ''),
      planId: String(sub.planId ?? sub.plan_id ?? 'pro'),
      planName: String(sub.planName ?? sub.plan_name ?? 'Pro Store'),
      price: Number(sub.price ?? 0),
      status: String(sub.status || 'active'),
      expiresAt: toIso(sub.expiresAt ?? sub.expires_at ?? sub.nextBillingAt ?? sub.next_billing_at ?? sub.currentPeriodEnd ?? sub.current_period_end)
    });
  }

  for (const sub of serviceSubscriptions) {
    const uid = String(sub.userId ?? sub.user_id ?? cleanUid ?? '');
    const serviceType = String(sub.serviceType ?? sub.service_type ?? '').trim().toLowerCase();
    if (!uid || !serviceType) continue;
    memoryServiceSubscriptions.set(`${uid}::${serviceType}`, {
      id: String(sub.id || `svc_${uid}_${serviceType}`),
      userId: uid,
      serviceType,
      planId: String(sub.planId ?? sub.plan_id ?? 'starter'),
      planName: String(sub.planName ?? sub.plan_name ?? `${serviceType} Plan`),
      price: Number(sub.price ?? 0),
      status: String(sub.status || 'active'),
      autoRenew: sub.autoRenew !== undefined ? Boolean(sub.autoRenew) : (sub.auto_renew !== undefined ? Boolean(sub.auto_renew) : true),
      expiresAt: toIso(sub.expiresAt ?? sub.expires_at ?? sub.nextBillingAt ?? sub.next_billing_at ?? sub.currentPeriodEnd ?? sub.current_period_end)
    });
  }
}

export async function ensureAccountLifecycleSchema(queryable = null) {
  const runner = resolveRunner(queryable);
  if (!runner.active) {
    return { ok: true, mode: 'memory' };
  }
  if (!queryable && schemaEnsured) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (runner.exec) {
    await runner.exec(ACCOUNT_LIFECYCLE_SCHEMA_SQL);
  } else {
    await runner.query(ACCOUNT_LIFECYCLE_SCHEMA_SQL);
  }
  if (!queryable) {
    schemaEnsured = true;
  }
  return { ok: true, mode: 'postgres' };
}

function formatHoldRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    holdType: row.hold_type,
    nonRefundable: row.non_refundable !== false,
    pausedAt: toIso(row.paused_at),
    retainUntil: toIso(row.retain_until),
    purgedAt: toIso(row.purged_at),
    reason: row.reason || null,
    snapshot: row.snapshot_json && typeof row.snapshot_json === 'object' ? row.snapshot_json : {},
    updatedAt: toIso(row.updated_at)
  };
}

export async function getUserAccountHold(userId, { queryable = null } = {}) {
  const uid = cleanUserId(userId);
  const runner = resolveRunner(queryable);
  if (!runner.active) {
    const existing = memoryHolds.get(uid);
    return existing ? structuredClone(existing) : null;
  }
  await ensureAccountLifecycleSchema(queryable);
  const { rows } = await runner.query(
    'SELECT * FROM system_account_service_holds WHERE user_id = $1 LIMIT 1',
    [uid]
  );
  return formatHoldRow(rows?.[0] || null);
}

function isPaidSubscriptionCandidate({ price, planId, status }, { includeHeldStatuses = false } = {}) {
  const cleanStatus = String(status || 'active').toLowerCase();
  const allowedStatuses = includeHeldStatuses
    ? new Set(['active', 'trialing', 'past_due', 'paused', 'suspended', 'grace_period'])
    : new Set(['active', 'trialing', 'past_due']);
  if (!allowedStatuses.has(cleanStatus)) return false;

  const cleanPlan = String(planId || '').trim().toLowerCase();
  if (cleanPlan === 'free') return false;
  if (price !== null && price !== undefined) {
    return Number(price) > 0;
  }
  return true;
}

function computeRetainUntilIso(candidates, nowDate) {
  let maxMs = 0;
  const nowMs = nowDate.getTime();
  for (const candidate of candidates) {
    const endDate = toDate(candidate);
    if (endDate && endDate.getTime() > nowMs && endDate.getTime() > maxMs) {
      maxMs = endDate.getTime();
    }
  }
  if (maxMs > nowMs) {
    return new Date(maxMs).toISOString();
  }
  return new Date(nowMs + DAY_MS).toISOString();
}

function buildHoldNotificationCopy({ holdType, reason, retainUntil, nonRefundable = true }) {
  const policyText = nonRefundable
    ? 'All active billing periods remain non-refundable and continue running without extension or refund.'
    : '';

  if (holdType === HOLD_TYPES.NID_REVIEW) {
    return {
      type: 'account_nid_hold',
      title: 'Account Services Paused Pending NID Verification',
      snippet: 'All services are paused and IPs are held pending identity verification.',
      content: `Your account services (VPS, Discord bots, WhatsApp automation, and E-commerce store) have been paused pending NID/identity verification (${reason}). Assigned IPv6 addresses are temporarily held for your account. ${policyText}`
    };
  }
  if (holdType === HOLD_TYPES.TEMP_BAN) {
    return {
      type: 'account_temp_suspension',
      title: 'Account Temporarily Suspended — Services Paused',
      snippet: 'All services are paused and IPs are held during temporary suspension.',
      content: `Your account has been temporarily suspended (${reason}). All running services have been paused and assigned IPv6 addresses remain held. ${policyText}`
    };
  }
  if (holdType === HOLD_TYPES.PERMANENT_BAN) {
    return {
      type: 'account_permanent_ban',
      title: 'Account Permanently Banned — Scheduled Data Purge',
      snippet: `Services paused; permanent purge scheduled for ${retainUntil}.`,
      content: `Your account has been permanently banned (${reason}). All services are immediately paused and cannot be restored. Existing data is retained in a paused state only until ${retainUntil}, after which all servers, IPs, bots, and store data will be permanently purged. ${policyText}`
    };
  }
  return {
    type: 'account_hold_cleared',
    title: 'Account Hold Cleared — Services Restored',
    snippet: 'Your account verification/hold has been cleared and services reactivated.',
    content: `Your account hold has been cleared and your previously active services and held IPv6 addresses have been restored. ${policyText}`
  };
}

async function insertNotification(runner, { userId, type, title, snippet, content, meta = {}, nowIso }) {
  const id = `notif_${randomUUID()}`;
  if (!runner.active) {
    const record = {
      id,
      recipientId: userId,
      senderId: null,
      type,
      title,
      snippet,
      content,
      entityId: userId,
      isRead: false,
      meta,
      createdAt: nowIso
    };
    memoryNotifications.unshift(record);
    return record;
  }

  const cols = await getTableColumns(runner, 'social_notifications');
  if (cols.size === 0) return null;

  const insertCols = ['id', 'recipient_id', 'sender_id', 'type', 'content', 'entity_id', 'is_read', 'created_at'];
  const insertVals = [id, userId, null, type, content, userId, false, nowIso];

  if (cols.has('title')) {
    insertCols.push('title');
    insertVals.push(title);
  }
  if (cols.has('snippet')) {
    insertCols.push('snippet');
    insertVals.push(snippet);
  }
  if (cols.has('meta')) {
    insertCols.push('meta');
    insertVals.push(JSON.stringify(meta));
  }

  const placeholders = insertCols.map((col, idx) => (col === 'meta' ? `$${idx + 1}::jsonb` : `$${idx + 1}`));
  const { rows } = await runner.query(
    `INSERT INTO social_notifications (${insertCols.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING *`,
    insertVals
  );
  return rows?.[0] || null;
}

async function insertAuditRecord(runner, { userId, action, holdType, nonRefundable = true, reason = null, details = {}, nowIso }) {
  const id = `aud_${randomUUID()}`;
  if (!runner.active) {
    const record = {
      id,
      userId,
      action,
      holdType,
      nonRefundable,
      reason,
      details,
      createdAt: nowIso
    };
    memoryAudits.unshift(record);
    return record;
  }

  const { rows } = await runner.query(
    `INSERT INTO system_account_lifecycle_audits
       (id, user_id, action, hold_type, non_refundable, reason, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     RETURNING *`,
    [id, userId, action, holdType, Boolean(nonRefundable), reason, JSON.stringify(details), nowIso]
  );
  return rows?.[0] || null;
}

async function invokeHoldIp(runner, holdIpFn, dropletId, reason) {
  if (typeof holdIpFn === 'function') {
    return holdIpFn({ dropletId, reason, queryFn: runner.active ? runner.query : null });
  }
  if (!runner.active) {
    return holdDropletIpAllocations({ dropletId, reason });
  }
  if (await tableExists(runner, 'system_ip_allocations')) {
    return holdDropletIpAllocations({ dropletId, reason, queryFn: runner.query });
  }
  return { dropletId, status: 'held', heldAddresses: [] };
}

async function invokeRestoreIp(runner, restoreIpFn, droplet, { mustExist = false } = {}) {
  const dropletId = droplet.id;
  const invoke = () => {
    if (typeof restoreIpFn === 'function') {
      return restoreIpFn({
        dropletId,
        sshPort: droplet.sshPort ?? droplet.ssh_port ?? 22,
        username: droplet.accessUsername ?? droplet.access_username ?? 'root',
        queryFn: runner.active ? runner.query : null
      });
    }
    if (!runner.active) {
      return restoreDropletIpAllocations({
        dropletId,
        sshPort: droplet.sshPort ?? 22,
        username: droplet.accessUsername ?? 'root'
      });
    }
    return restoreDropletIpAllocations({
      dropletId,
      sshPort: droplet.ssh_port ?? 22,
      username: droplet.access_username ?? 'root',
      queryFn: runner.query
    });
  };

  if (runner.active && typeof restoreIpFn !== 'function') {
    const hasAllocTable = await tableExists(runner, 'system_ip_allocations');
    if (!hasAllocTable) return null;
  }

  try {
    return await invoke();
  } catch (err) {
    if (err?.code === 'IPV6_ALLOCATION_NOT_FOUND' && !mustExist) {
      return null;
    }
    throw err;
  }
}

async function invokeReleaseIp(runner, releaseIpFn, dropletId, reason) {
  if (typeof releaseIpFn === 'function') {
    return releaseIpFn({ dropletId, reason, queryFn: runner.active ? runner.query : null });
  }
  if (!runner.active) {
    return releaseDropletIpAllocations({ dropletId, reason });
  }
  if (await tableExists(runner, 'system_ip_allocations')) {
    return releaseDropletIpAllocations({ dropletId, reason, queryFn: runner.query });
  }
  return { dropletId, status: 'released', releasedAddresses: [] };
}

async function setTenantStatus(runner, updateTenantStatusFn, { tenantId, userId, status }) {
  if (!tenantId) return null;
  if (typeof updateTenantStatusFn === 'function') {
    return updateTenantStatusFn({ tenantId, userId, status });
  }
  if (!runner.active) {
    const memRec = memoryTenants.get(String(tenantId));
    if (memRec && (!userId || memRec.userId === String(userId))) {
      memRec.status = status;
      return { ...memRec };
    }
    return updateUbuntuTenantStatus({ tenantId, userId, status });
  }
  if (await tableExists(runner, 'system_ubuntu_tenants')) {
    const params = [String(tenantId), status];
    const userFilter = userId ? ' AND user_id = $3' : '';
    if (userId) params.push(String(userId));
    const { rows } = await runner.query(
      `UPDATE system_ubuntu_tenants
       SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1${userFilter}
       RETURNING *`,
      params
    );
    return rows?.[0] || null;
  }
  return null;
}

async function reclaimTenant(runner, reclaimTenantFn, { tenantId, userId }) {
  if (!tenantId) return null;
  if (typeof reclaimTenantFn === 'function') {
    return reclaimTenantFn({ tenantId, userId });
  }
  if (!runner.active) {
    const memRec = memoryTenants.get(String(tenantId));
    if (memRec && (!userId || memRec.userId === String(userId))) {
      memoryTenants.delete(String(tenantId));
      return memRec;
    }
    return reclaimUbuntuTenant({ tenantId, userId });
  }
  if (await tableExists(runner, 'system_ubuntu_tenants')) {
    const params = [String(tenantId)];
    const userFilter = userId ? ' AND user_id = $2' : '';
    if (userId) params.push(String(userId));
    const { rows } = await runner.query(
      `DELETE FROM system_ubuntu_tenants WHERE id = $1${userFilter} RETURNING *`,
      params
    );
    return rows?.[0] || null;
  }
  return null;
}

async function adjustNodeCount(runner, adjustNodeFn, nodeId, delta) {
  const cleanNode = String(nodeId || '').trim();
  if (!cleanNode || !delta) return null;
  if (typeof adjustNodeFn === 'function') {
    return adjustNodeFn(cleanNode, delta);
  }
  if (!runner.active) {
    const node = memoryNodes.get(cleanNode);
    if (node) {
      node.activeDroplets = Math.max(0, Number(node.activeDroplets || 0) + delta);
      return { ...node };
    }
    return adjustNodeActiveDroplets(cleanNode, delta);
  }
  if (await tableExists(runner, 'system_server_nodes')) {
    const { rows } = await runner.query(
      `UPDATE system_server_nodes
       SET active_droplets = GREATEST(0, active_droplets + $2),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [cleanNode, delta]
    );
    return rows?.[0] || null;
  }
  return null;
}

async function updateMasterDirectoryStores(runner, userId, mutator) {
  if (!(await tableExists(runner, 'system_state_documents'))) return [];
  const { rows } = await runner.query(
    `SELECT data, version
     FROM system_state_documents
     WHERE namespace = 'master' AND document_key = 'directory'
     LIMIT 1`
  );
  if (!rows?.[0]?.data) return [];
  const directory = structuredClone(rows[0].data);
  const stores = Array.isArray(directory.stores) ? directory.stores : [];
  const subscriptions = Array.isArray(directory.subscriptions) ? directory.subscriptions : [];
  const matchedStores = [];

  for (const store of stores) {
    if (String(store.ownerId) !== String(userId)) continue;
    const sub = subscriptions.find((s) => String(s.tiwiId) === String(store.tiwiId)) || null;
    matchedStores.push({ store, sub });
    mutator(store, sub, directory);
  }

  if (matchedStores.length > 0) {
    await runner.query(
      `UPDATE system_state_documents
       SET data = $1::jsonb, version = version + 1, updated_at = CURRENT_TIMESTAMP
       WHERE namespace = 'master' AND document_key = 'directory'`,
      [JSON.stringify(directory)]
    );
  }
  return matchedStores;
}

// ============================================================================
// CORE LIFECYCLE OPERATIONS
// ============================================================================

export async function enforceUserAccountHold({
  userId,
  reason = 'policy_hold',
  permanent = false,
  holdType = null,
  now = new Date(),
  releaseIpFn = null, // Accepted for interface symmetry; holds preserve IPs via holdIpFn
  holdIpFn = null,
  updateTenantStatusFn = null,
  queryable = null
} = {}) {
  void releaseIpFn;
  const uid = cleanUserId(userId);
  const nowDate = toDate(now) || new Date();
  const nowIso = nowDate.toISOString();

  let effectiveHoldType = holdType ? String(holdType).trim().toLowerCase() : null;
  if (permanent === true) {
    effectiveHoldType = HOLD_TYPES.PERMANENT_BAN;
  } else if (!effectiveHoldType) {
    effectiveHoldType = HOLD_TYPES.NID_REVIEW;
  }
  if (!ACTIVE_HOLD_TYPES.has(effectiveHoldType)) {
    throw createLifecycleError(
      `Invalid holdType "${effectiveHoldType}". Expected nid_review, temp_ban, or permanent_ban.`,
      400,
      'INVALID_HOLD_TYPE'
    );
  }
  const isPermanent = effectiveHoldType === HOLD_TYPES.PERMANENT_BAN;
  const cleanReason = String(reason || 'policy_hold').trim().slice(0, 1000) || 'policy_hold';
  const runner = resolveRunner(queryable);

  if (!runner.active) {
    const existingHold = memoryHolds.get(uid) || null;
    const existingSnap = existingHold?.snapshot && existingHold.holdType !== HOLD_TYPES.CLEARED
      ? existingHold.snapshot
      : null;

    const paidPeriodCandidates = [];
    const snapshot = {
      droplets: existingSnap?.droplets ? { ...existingSnap.droplets } : {},
      tenants: existingSnap?.tenants ? { ...existingSnap.tenants } : {},
      heldIpDropletIds: new Set(existingSnap?.heldIpDropletIds || []),
      stores: existingSnap?.stores ? { ...existingSnap.stores } : {},
      storeSubscriptions: existingSnap?.storeSubscriptions ? { ...existingSnap.storeSubscriptions } : {},
      serviceSubscriptions: existingSnap?.serviceSubscriptions ? { ...existingSnap.serviceSubscriptions } : {}
    };

    // 1. Droplets & Held IPs & Tenants
    const affectedDroplets = [];
    const heldIps = [];
    const affectedTenants = [];
    for (const droplet of memoryDroplets.values()) {
      if (droplet.userId !== uid || droplet.status === 'deleted') continue;
      if (!snapshot.droplets[droplet.id]) {
        snapshot.droplets[droplet.id] = {
          status: droplet.status || 'active',
          tenantId: droplet.tenantId || null,
          nodeId: droplet.nodeId || null
        };
      }
      const preHoldStatus = snapshot.droplets[droplet.id].status;
      if (
        isPaidSubscriptionCandidate({
          price: droplet.monthlyPrice,
          planId: 'vps',
          status: preHoldStatus
        }, { includeHeldStatuses: Boolean(existingSnap) })
      ) {
        paidPeriodCandidates.push(droplet.nextBillingAt);
      }

      droplet.status = 'suspended';
      droplet.suspendedAt = droplet.suspendedAt || nowIso;
      affectedDroplets.push(droplet.id);

      const ipResult = await invokeHoldIp(runner, holdIpFn, droplet.id, cleanReason);
      if (ipResult?.heldAddresses?.length > 0) {
        snapshot.heldIpDropletIds.add(droplet.id);
        heldIps.push(...ipResult.heldAddresses.map((a) => a.ipAddress));
      }

      if (droplet.tenantId) {
        const tRec = memoryTenants.get(String(droplet.tenantId));
        if (tRec && !snapshot.tenants[tRec.tenantId]) {
          snapshot.tenants[tRec.tenantId] = { status: tRec.status || 'active' };
        }
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: droplet.tenantId,
          userId: uid,
          status: 'suspended'
        });
        affectedTenants.push(droplet.tenantId);
      }
    }

    for (const tenant of memoryTenants.values()) {
      if (tenant.userId !== uid) continue;
      if (!snapshot.tenants[tenant.tenantId]) {
        snapshot.tenants[tenant.tenantId] = { status: tenant.status || 'active' };
      }
      if (tenant.status !== 'suspended') {
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: tenant.tenantId,
          userId: uid,
          status: 'suspended'
        });
      }
      if (!affectedTenants.includes(tenant.tenantId)) {
        affectedTenants.push(tenant.tenantId);
      }
    }

    // 2. E-commerce stores & store subscriptions
    const affectedStores = [];
    for (const store of memoryStores.values()) {
      if (store.ownerId !== uid || store.status === 'terminated') continue;
      if (!snapshot.stores[store.tiwiId]) {
        snapshot.stores[store.tiwiId] = {
          status: store.status || 'active',
          lifecycleStatus: store.lifecycleStatus || store.status || 'active'
        };
      }
      store.status = 'suspended';
      store.lifecycleStatus = 'suspended';
      affectedStores.push(store.tiwiId);

      const storeSub = memoryStoreSubscriptions.get(store.tiwiId);
      if (storeSub) {
        if (!snapshot.storeSubscriptions[store.tiwiId]) {
          snapshot.storeSubscriptions[store.tiwiId] = { status: storeSub.status || 'active' };
        }
        const preStatus = snapshot.storeSubscriptions[store.tiwiId].status;
        if (isPaidSubscriptionCandidate({
          price: storeSub.price,
          planId: storeSub.planId,
          status: preStatus
        }, { includeHeldStatuses: Boolean(existingSnap) })) {
          paidPeriodCandidates.push(storeSub.expiresAt || store.expiresAt);
        }
        storeSub.status = 'paused';
      } else if (store.planId !== 'free' && store.expiresAt) {
        paidPeriodCandidates.push(store.expiresAt);
      }
    }

    // 3. Service subscriptions (WhatsApp, Discord, etc.)
    const affectedServices = [];
    for (const sub of memoryServiceSubscriptions.values()) {
      if (sub.userId !== uid || sub.status === 'terminated') continue;
      if (!snapshot.serviceSubscriptions[sub.serviceType]) {
        snapshot.serviceSubscriptions[sub.serviceType] = {
          status: sub.status || 'active',
          autoRenew: sub.autoRenew !== false
        };
      }
      const preStatus = snapshot.serviceSubscriptions[sub.serviceType].status;
      if (isPaidSubscriptionCandidate({
        price: sub.price,
        planId: sub.planId,
        status: preStatus
      }, { includeHeldStatuses: Boolean(existingSnap) })) {
        paidPeriodCandidates.push(sub.expiresAt);
      }
      sub.status = 'paused';
      if (isPermanent) sub.autoRenew = false;
      affectedServices.push(sub.serviceType);
    }

    const retainUntilIso = isPermanent ? computeRetainUntilIso(paidPeriodCandidates, nowDate) : null;
    const pausedAtIso = existingHold?.holdType !== HOLD_TYPES.CLEARED && existingHold?.pausedAt
      ? existingHold.pausedAt
      : nowIso;

    const serializedSnapshot = {
      ...snapshot,
      heldIpDropletIds: [...snapshot.heldIpDropletIds]
    };

    const holdRecord = {
      userId: uid,
      holdType: effectiveHoldType,
      nonRefundable: true,
      pausedAt: pausedAtIso,
      retainUntil: retainUntilIso,
      purgedAt: null,
      reason: cleanReason,
      snapshot: serializedSnapshot,
      updatedAt: nowIso
    };
    memoryHolds.set(uid, holdRecord);

    const notifCopy = buildHoldNotificationCopy({
      holdType: effectiveHoldType,
      reason: cleanReason,
      retainUntil: retainUntilIso,
      nonRefundable: true
    });
    const notification = await insertNotification(runner, {
      userId: uid,
      ...notifCopy,
      meta: {
        holdType: effectiveHoldType,
        nonRefundable: true,
        reason: cleanReason,
        pausedAt: pausedAtIso,
        retainUntil: retainUntilIso
      },
      nowIso
    });
    await insertAuditRecord(runner, {
      userId: uid,
      action: `hold_${effectiveHoldType}`,
      holdType: effectiveHoldType,
      nonRefundable: true,
      reason: cleanReason,
      details: {
        pausedAt: pausedAtIso,
        retainUntil: retainUntilIso,
        affectedDroplets,
        affectedTenants,
        heldIps,
        affectedStores,
        affectedServices
      },
      nowIso
    });

    return {
      ok: true,
      userId: uid,
      holdType: effectiveHoldType,
      permanent: isPermanent,
      nonRefundable: true,
      pausedAt: pausedAtIso,
      retainUntil: retainUntilIso,
      purgedAt: null,
      reason: cleanReason,
      affected: {
        droplets: affectedDroplets,
        tenants: affectedTenants,
        heldIps,
        stores: affectedStores,
        serviceSubscriptions: affectedServices
      },
      notification
    };
  }

  // PostgreSQL / PGlite path
  await ensureAccountLifecycleSchema(queryable);
  const existingHold = await getUserAccountHold(uid, { queryable });
  const existingSnap = existingHold?.snapshot && existingHold.holdType !== HOLD_TYPES.CLEARED
    ? existingHold.snapshot
    : null;

  const paidPeriodCandidates = [];
  const snapshot = {
    droplets: existingSnap?.droplets ? { ...existingSnap.droplets } : {},
    tenants: existingSnap?.tenants ? { ...existingSnap.tenants } : {},
    heldIpDropletIds: new Set(existingSnap?.heldIpDropletIds || []),
    stores: existingSnap?.stores ? { ...existingSnap.stores } : {},
    storeSubscriptions: existingSnap?.storeSubscriptions ? { ...existingSnap.storeSubscriptions } : {},
    serviceSubscriptions: existingSnap?.serviceSubscriptions ? { ...existingSnap.serviceSubscriptions } : {},
    discordBots: existingSnap?.discordBots ? { ...existingSnap.discordBots } : {},
    discordServers: existingSnap?.discordServers ? { ...existingSnap.discordServers } : {},
    discordWorkspaceServices: existingSnap?.discordWorkspaceServices ? { ...existingSnap.discordWorkspaceServices } : {}
  };

  // 1. Cloud Droplets & Held IPs & Ubuntu Tenants
  const affectedDroplets = [];
  const heldIps = [];
  const affectedTenants = [];

  if (await tableExists(runner, 'cloud_droplets')) {
    const dropletCols = await getTableColumns(runner, 'cloud_droplets');
    const { rows: dropletRows } = await runner.query(
      `SELECT * FROM cloud_droplets WHERE user_id = $1 AND status <> 'deleted'`,
      [uid]
    );
    for (const d of dropletRows || []) {
      if (!snapshot.droplets[d.id]) {
        snapshot.droplets[d.id] = {
          status: d.status || 'active',
          tenantId: d.tenant_id || null,
          nodeId: d.node_id || null
        };
      }
      const preStatus = snapshot.droplets[d.id].status;
      if (isPaidSubscriptionCandidate({
        price: d.monthly_price,
        planId: 'vps',
        status: preStatus
      }, { includeHeldStatuses: Boolean(existingSnap) })) {
        paidPeriodCandidates.push(d.next_billing_at || d.current_period_end || d.expires_at);
      }

      if (dropletCols.has('suspended_at')) {
        await runner.query(
          `UPDATE cloud_droplets
           SET status = 'suspended',
               suspended_at = COALESCE(suspended_at, $2::timestamptz)
           WHERE id = $1`,
          [d.id, nowIso]
        );
      } else {
        await runner.query(
          `UPDATE cloud_droplets SET status = 'suspended' WHERE id = $1`,
          [d.id]
        );
      }
      affectedDroplets.push(d.id);
      await setDropletPowerOnHost(d.id, 'suspend').catch(() => {});

      const ipResult = await invokeHoldIp(runner, holdIpFn, d.id, cleanReason);
      if (ipResult?.heldAddresses?.length > 0) {
        snapshot.heldIpDropletIds.add(d.id);
        heldIps.push(...ipResult.heldAddresses.map((a) => a.ipAddress));
      }

      if (d.tenant_id) {
        if (await tableExists(runner, 'system_ubuntu_tenants')) {
          const { rows: tRows } = await runner.query(
            'SELECT id, status FROM system_ubuntu_tenants WHERE id = $1',
            [d.tenant_id]
          );
          if (tRows?.[0] && !snapshot.tenants[d.tenant_id]) {
            snapshot.tenants[d.tenant_id] = { status: tRows[0].status || 'active' };
          }
        }
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: d.tenant_id,
          userId: uid,
          status: 'suspended'
        });
        affectedTenants.push(d.tenant_id);
      }
    }
  }

  if (await tableExists(runner, 'system_ubuntu_tenants')) {
    const { rows: userTenants } = await runner.query(
      'SELECT id, status FROM system_ubuntu_tenants WHERE user_id = $1',
      [uid]
    );
    for (const t of userTenants || []) {
      if (!snapshot.tenants[t.id]) {
        snapshot.tenants[t.id] = { status: t.status || 'active' };
      }
      if (t.status !== 'suspended') {
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: t.id,
          userId: uid,
          status: 'suspended'
        });
      }
      if (!affectedTenants.includes(t.id)) {
        affectedTenants.push(t.id);
      }
    }
  }

  // 2. E-Commerce Stores & Store Subscriptions
  const affectedStores = [];
  if (await tableExists(runner, 'system_stores')) {
    const storeCols = await getTableColumns(runner, 'system_stores');
    const { rows: storeRows } = await runner.query(
      'SELECT * FROM system_stores WHERE owner_id = $1',
      [uid]
    );
    const tiwiIds = (storeRows || []).map((s) => s.tiwi_id).filter(Boolean);

    for (const s of storeRows || []) {
      const key = s.tiwi_id || s.id;
      if (!snapshot.stores[key]) {
        snapshot.stores[key] = { status: s.status || 'active' };
      }
      if (storeCols.has('status')) {
        await runner.query(
          `UPDATE system_stores SET status = 'suspended' WHERE id = $1`,
          [s.id]
        );
      }
      if (s.tiwi_id && !affectedStores.includes(s.tiwi_id)) {
        affectedStores.push(s.tiwi_id);
      }
    }

    if (tiwiIds.length > 0 && await tableExists(runner, 'system_subscriptions')) {
      const subCols = await getTableColumns(runner, 'system_subscriptions');
      const { rows: subRows } = await runner.query(
        'SELECT * FROM system_subscriptions WHERE tiwi_id = ANY($1::text[])',
        [tiwiIds]
      );
      for (const sub of subRows || []) {
        if (!snapshot.storeSubscriptions[sub.tiwi_id]) {
          snapshot.storeSubscriptions[sub.tiwi_id] = { status: sub.status || 'active' };
        }
        const preStatus = snapshot.storeSubscriptions[sub.tiwi_id].status;
        if (isPaidSubscriptionCandidate({
          price: sub.price,
          planId: sub.plan_id,
          status: preStatus
        }, { includeHeldStatuses: Boolean(existingSnap) })) {
          paidPeriodCandidates.push(sub.expires_at || sub.current_period_end || sub.next_billing_at);
        }
        if (subCols.has('status')) {
          await runner.query(
            `UPDATE system_subscriptions
             SET status = 'paused', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [sub.id]
          );
        }
      }
    }
  }

  await updateMasterDirectoryStores(runner, uid, (store, sub) => {
    if (!snapshot.stores[store.tiwiId]) {
      snapshot.stores[store.tiwiId] = {
        status: store.status || 'active',
        lifecycleStatus: store.lifecycleStatus || store.status || 'active',
        subscriptionStatus: sub?.subscriptionStatus || store.subscriptionStatus || 'active'
      };
    }
    const subPlanId = sub?.planId || store.planId;
    const subPrice = sub?.price ?? store.price ?? 0;
    const preStatus = snapshot.stores[store.tiwiId].lifecycleStatus;
    if (isPaidSubscriptionCandidate({
      price: subPrice,
      planId: subPlanId,
      status: preStatus
    }, { includeHeldStatuses: Boolean(existingSnap) })) {
      paidPeriodCandidates.push(sub?.expiresAt || store.expiresAt || sub?.nextBillingAt || sub?.currentPeriodEnd);
    }
    store.status = 'suspended';
    store.lifecycleStatus = 'suspended';
    store.subscriptionStatus = 'suspended';
    store.suspendedAt = store.suspendedAt || nowIso;
    if (sub) {
      sub.lifecycleStatus = 'suspended';
      sub.subscriptionStatus = 'suspended';
      sub.suspendedAt = sub.suspendedAt || nowIso;
    }
    if (!affectedStores.includes(store.tiwiId)) {
      affectedStores.push(store.tiwiId);
    }
  });

  // 3. Service Subscriptions (platform_service_subscriptions & optional service_subscriptions)
  const affectedServices = [];
  for (const subTable of ['platform_service_subscriptions', 'service_subscriptions']) {
    if (!(await tableExists(runner, subTable))) continue;
    const cols = await getTableColumns(runner, subTable);
    const { rows: svcRows } = await runner.query(
      `SELECT * FROM ${subTable} WHERE user_id = $1 AND status <> 'terminated'`,
      [uid]
    );
    for (const svc of svcRows || []) {
      const svcKey = `${subTable}:${svc.service_type || svc.id}`;
      if (!snapshot.serviceSubscriptions[svcKey]) {
        snapshot.serviceSubscriptions[svcKey] = {
          table: subTable,
          id: svc.id,
          serviceType: svc.service_type || null,
          status: svc.status || 'active',
          autoRenew: svc.auto_renew !== false
        };
      }
      const preStatus = snapshot.serviceSubscriptions[svcKey].status;
      if (isPaidSubscriptionCandidate({
        price: svc.price,
        planId: svc.plan_id,
        status: preStatus
      }, { includeHeldStatuses: Boolean(existingSnap) })) {
        paidPeriodCandidates.push(svc.expires_at || svc.current_period_end || svc.next_billing_at);
      }

      if (cols.has('auto_renew') && isPermanent) {
        await runner.query(
          `UPDATE ${subTable}
           SET status = 'paused', auto_renew = FALSE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [svc.id]
        );
      } else {
        await runner.query(
          `UPDATE ${subTable}
           SET status = 'paused', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [svc.id]
        );
      }
      affectedServices.push(svc.service_type || svc.id);
    }
  }

  // Optional Discord resource tables
  if (await tableExists(runner, 'discord_bots')) {
    const { rows: botRows } = await runner.query(
      'SELECT id, status FROM discord_bots WHERE user_id = $1',
      [uid]
    );
    for (const bot of botRows || []) {
      if (!snapshot.discordBots[bot.id]) {
        snapshot.discordBots[bot.id] = { status: bot.status || 'offline' };
      }
      await runner.query(
        `UPDATE discord_bots SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [bot.id]
      );
    }
  }
  if (await tableExists(runner, 'discord_servers')) {
    const { rows: srvRows } = await runner.query(
      'SELECT id, is_suspended FROM discord_servers WHERE user_id = $1',
      [uid]
    );
    for (const srv of srvRows || []) {
      if (!snapshot.discordServers[srv.id]) {
        snapshot.discordServers[srv.id] = { isSuspended: Boolean(srv.is_suspended) };
      }
      await runner.query(
        `UPDATE discord_servers SET is_suspended = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [srv.id]
      );
    }
  }
  if (await tableExists(runner, 'discord_workspace_services')) {
    const { rows: wsRows } = await runner.query(
      'SELECT id, status FROM discord_workspace_services WHERE user_id = $1',
      [uid]
    );
    for (const ws of wsRows || []) {
      if (!snapshot.discordWorkspaceServices[ws.id]) {
        snapshot.discordWorkspaceServices[ws.id] = { status: ws.status || 'Active' };
      }
      await runner.query(
        `UPDATE discord_workspace_services SET status = 'Paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [ws.id]
      );
    }
  }

  const retainUntilIso = isPermanent ? computeRetainUntilIso(paidPeriodCandidates, nowDate) : null;
  const pausedAtIso = existingHold?.holdType !== HOLD_TYPES.CLEARED && existingHold?.pausedAt
    ? existingHold.pausedAt
    : nowIso;
  const serializedSnapshot = {
    ...snapshot,
    heldIpDropletIds: [...snapshot.heldIpDropletIds]
  };

  await runner.query(
    `INSERT INTO system_account_service_holds (
       user_id, hold_type, non_refundable, paused_at, retain_until,
       purged_at, reason, snapshot_json, updated_at
     )
     VALUES ($1, $2, TRUE, $3::timestamptz, $4::timestamptz, NULL, $5, $6::jsonb, $7::timestamptz)
     ON CONFLICT (user_id) DO UPDATE SET
       hold_type = EXCLUDED.hold_type,
       non_refundable = TRUE,
       paused_at = COALESCE(system_account_service_holds.paused_at, EXCLUDED.paused_at),
       retain_until = EXCLUDED.retain_until,
       purged_at = NULL,
       reason = EXCLUDED.reason,
       snapshot_json = EXCLUDED.snapshot_json,
       updated_at = EXCLUDED.updated_at`,
    [uid, effectiveHoldType, pausedAtIso, retainUntilIso, cleanReason, JSON.stringify(serializedSnapshot), nowIso]
  );

  const notifCopy = buildHoldNotificationCopy({
    holdType: effectiveHoldType,
    reason: cleanReason,
    retainUntil: retainUntilIso,
    nonRefundable: true
  });
  const notification = await insertNotification(runner, {
    userId: uid,
    ...notifCopy,
    meta: {
      holdType: effectiveHoldType,
      nonRefundable: true,
      reason: cleanReason,
      pausedAt: pausedAtIso,
      retainUntil: retainUntilIso
    },
    nowIso
  });

  await insertAuditRecord(runner, {
    userId: uid,
    action: `hold_${effectiveHoldType}`,
    holdType: effectiveHoldType,
    nonRefundable: true,
    reason: cleanReason,
    details: {
      pausedAt: pausedAtIso,
      retainUntil: retainUntilIso,
      affectedDroplets,
      affectedTenants,
      heldIps,
      affectedStores,
      affectedServices
    },
    nowIso
  });

  return {
    ok: true,
    userId: uid,
    holdType: effectiveHoldType,
    permanent: isPermanent,
    nonRefundable: true,
    pausedAt: pausedAtIso,
    retainUntil: retainUntilIso,
    purgedAt: null,
    reason: cleanReason,
    affected: {
      droplets: affectedDroplets,
      tenants: affectedTenants,
      heldIps,
      stores: affectedStores,
      serviceSubscriptions: affectedServices
    },
    notification
  };
}

export async function restoreUserAccountServices({
  userId,
  now = new Date(),
  allowPermanentOverride = false,
  overrideReason = null,
  restoreIpFn = null,
  updateTenantStatusFn = null,
  queryable = null
} = {}) {
  const uid = cleanUserId(userId);
  const nowDate = toDate(now) || new Date();
  const nowIso = nowDate.toISOString();
  const runner = resolveRunner(queryable);

  const existingHold = await getUserAccountHold(uid, { queryable });
  if (!existingHold || existingHold.holdType === HOLD_TYPES.CLEARED) {
    return {
      ok: true,
      restored: false,
      alreadyCleared: true,
      userId: uid,
      holdType: HOLD_TYPES.CLEARED
    };
  }

  if (existingHold.holdType === HOLD_TYPES.PERMANENT_BAN && !allowPermanentOverride) {
    throw createLifecycleError(
      'Permanently banned accounts cannot be restored without explicit permanent override.',
      403,
      'PERMANENT_BAN_RESTORE_FORBIDDEN'
    );
  }

  if (existingHold.purgedAt) {
    throw createLifecycleError(
      'Account services have already been permanently purged and cannot be restored.',
      409,
      'ACCOUNT_ALREADY_PURGED'
    );
  }

  const snap = existingHold.snapshot || {};
  const heldIpDropletSet = new Set(snap.heldIpDropletIds || []);
  const restoredDroplets = [];
  const restoredIps = [];
  const restoredTenants = [];
  const restoredStores = [];
  const restoredServices = [];

  if (!runner.active) {
    // 1. Droplets & Held IPs & Tenants
    for (const droplet of memoryDroplets.values()) {
      if (droplet.userId !== uid || droplet.status === 'deleted') continue;
      const targetStatus = snap.droplets?.[droplet.id]?.status || 'active';
      droplet.status = targetStatus;
      droplet.suspendedAt = null;
      restoredDroplets.push(droplet.id);

      const ipRes = await invokeRestoreIp(runner, restoreIpFn, droplet, {
        mustExist: heldIpDropletSet.has(droplet.id)
      });
      if (ipRes?.ipv6) {
        restoredIps.push(ipRes.ipv6);
      }

      if (droplet.tenantId) {
        const targetTenantStatus = snap.tenants?.[droplet.tenantId]?.status || 'active';
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: droplet.tenantId,
          userId: uid,
          status: targetTenantStatus
        });
        restoredTenants.push(droplet.tenantId);
      }
    }

    for (const tenant of memoryTenants.values()) {
      if (tenant.userId !== uid) continue;
      const targetTenantStatus = snap.tenants?.[tenant.tenantId]?.status || 'active';
      if (tenant.status !== targetTenantStatus) {
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: tenant.tenantId,
          userId: uid,
          status: targetTenantStatus
        });
      }
      if (!restoredTenants.includes(tenant.tenantId)) {
        restoredTenants.push(tenant.tenantId);
      }
    }

    // 2. E-commerce stores & store subscriptions
    for (const store of memoryStores.values()) {
      if (store.ownerId !== uid || store.status === 'terminated') continue;
      const prevStore = snap.stores?.[store.tiwiId];
      store.status = prevStore?.status || 'active';
      store.lifecycleStatus = prevStore?.lifecycleStatus || 'active';
      restoredStores.push(store.tiwiId);

      const storeSub = memoryStoreSubscriptions.get(store.tiwiId);
      if (storeSub) {
        const endDate = toDate(storeSub.expiresAt);
        const prevSubStatus = snap.storeSubscriptions?.[store.tiwiId]?.status || 'active';
        storeSub.status = endDate && endDate <= nowDate ? 'expired' : prevSubStatus;
      }
    }

    // 3. Service subscriptions
    for (const sub of memoryServiceSubscriptions.values()) {
      if (sub.userId !== uid || sub.status === 'terminated') continue;
      const prev = snap.serviceSubscriptions?.[sub.serviceType];
      const endDate = toDate(sub.expiresAt);
      const targetStatus = endDate && endDate <= nowDate ? 'expired' : (prev?.status || 'active');
      sub.status = targetStatus;
      if (prev?.autoRenew !== undefined) sub.autoRenew = prev.autoRenew;
      restoredServices.push(sub.serviceType);
    }

    memoryHolds.set(uid, {
      ...existingHold,
      holdType: HOLD_TYPES.CLEARED,
      nonRefundable: true,
      retainUntil: null,
      reason: overrideReason || existingHold.reason,
      updatedAt: nowIso
    });

    const notifCopy = buildHoldNotificationCopy({
      holdType: HOLD_TYPES.CLEARED,
      reason: overrideReason || existingHold.reason,
      nonRefundable: true
    });
    const notification = await insertNotification(runner, {
      userId: uid,
      ...notifCopy,
      meta: {
        previousHoldType: existingHold.holdType,
        restoredAt: nowIso,
        nonRefundable: true
      },
      nowIso
    });
    await insertAuditRecord(runner, {
      userId: uid,
      action: 'hold_restored',
      holdType: HOLD_TYPES.CLEARED,
      nonRefundable: true,
      reason: overrideReason || existingHold.reason,
      details: {
        previousHoldType: existingHold.holdType,
        allowPermanentOverride: Boolean(allowPermanentOverride),
        restoredDroplets,
        restoredIps,
        restoredTenants,
        restoredStores,
        restoredServices
      },
      nowIso
    });

    return {
      ok: true,
      restored: true,
      userId: uid,
      previousHoldType: existingHold.holdType,
      holdType: HOLD_TYPES.CLEARED,
      nonRefundable: true,
      restoredAt: nowIso,
      restoredServices: {
        droplets: restoredDroplets,
        ips: restoredIps,
        tenants: restoredTenants,
        stores: restoredStores,
        serviceSubscriptions: restoredServices
      },
      notification
    };
  }

  // PostgreSQL / PGlite path
  if (await tableExists(runner, 'cloud_droplets')) {
    const dropletCols = await getTableColumns(runner, 'cloud_droplets');
    const { rows: dropletRows } = await runner.query(
      `SELECT * FROM cloud_droplets WHERE user_id = $1 AND status <> 'deleted'`,
      [uid]
    );
    for (const d of dropletRows || []) {
      const targetStatus = snap.droplets?.[d.id]?.status || 'active';
      if (dropletCols.has('suspended_at')) {
        await runner.query(
          `UPDATE cloud_droplets SET status = $2, suspended_at = NULL WHERE id = $1`,
          [d.id, targetStatus]
        );
      } else {
        await runner.query(
          `UPDATE cloud_droplets SET status = $2 WHERE id = $1`,
          [d.id, targetStatus]
        );
      }
      restoredDroplets.push(d.id);
      await setDropletPowerOnHost(d.id, targetStatus === 'active' ? 'start' : 'stop').catch(() => {});

      const ipRes = await invokeRestoreIp(runner, restoreIpFn, d, {
        mustExist: heldIpDropletSet.has(d.id)
      });
      if (ipRes?.ipv6) {
        restoredIps.push(ipRes.ipv6);
      }

      if (d.tenant_id) {
        const targetTenantStatus = snap.tenants?.[d.tenant_id]?.status || 'active';
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: d.tenant_id,
          userId: uid,
          status: targetTenantStatus
        });
        restoredTenants.push(d.tenant_id);
      }
    }
  }

  if (await tableExists(runner, 'system_ubuntu_tenants')) {
    const { rows: userTenants } = await runner.query(
      'SELECT id, status FROM system_ubuntu_tenants WHERE user_id = $1',
      [uid]
    );
    for (const t of userTenants || []) {
      const targetTenantStatus = snap.tenants?.[t.id]?.status || 'active';
      if (t.status !== targetTenantStatus) {
        await setTenantStatus(runner, updateTenantStatusFn, {
          tenantId: t.id,
          userId: uid,
          status: targetTenantStatus
        });
      }
      if (!restoredTenants.includes(t.id)) {
        restoredTenants.push(t.id);
      }
    }
  }

  if (await tableExists(runner, 'system_stores')) {
    const storeCols = await getTableColumns(runner, 'system_stores');
    const { rows: storeRows } = await runner.query(
      'SELECT * FROM system_stores WHERE owner_id = $1',
      [uid]
    );
    const tiwiIds = (storeRows || []).map((s) => s.tiwi_id).filter(Boolean);

    for (const s of storeRows || []) {
      const key = s.tiwi_id || s.id;
      const targetStatus = snap.stores?.[key]?.status || 'active';
      if (storeCols.has('status')) {
        await runner.query(
          'UPDATE system_stores SET status = $2 WHERE id = $1',
          [s.id, targetStatus]
        );
      }
      if (s.tiwi_id && !restoredStores.includes(s.tiwi_id)) {
        restoredStores.push(s.tiwi_id);
      }
    }

    if (tiwiIds.length > 0 && await tableExists(runner, 'system_subscriptions')) {
      const subCols = await getTableColumns(runner, 'system_subscriptions');
      if (subCols.has('status')) {
        const { rows: subRows } = await runner.query(
          'SELECT * FROM system_subscriptions WHERE tiwi_id = ANY($1::text[])',
          [tiwiIds]
        );
        for (const sub of subRows || []) {
          const endDate = toDate(sub.expires_at || sub.current_period_end || sub.next_billing_at);
          const prevSubStatus = snap.storeSubscriptions?.[sub.tiwi_id]?.status || 'active';
          const targetSubStatus = endDate && endDate <= nowDate ? 'expired' : prevSubStatus;
          await runner.query(
            `UPDATE system_subscriptions SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [sub.id, targetSubStatus]
          );
        }
      }
    }
  }

  await updateMasterDirectoryStores(runner, uid, (store, sub) => {
    const prev = snap.stores?.[store.tiwiId];
    store.status = prev?.status || 'active';
    store.lifecycleStatus = prev?.lifecycleStatus || 'active';
    store.subscriptionStatus = prev?.subscriptionStatus || 'active';
    store.suspendedAt = null;
    if (sub) {
      sub.lifecycleStatus = prev?.lifecycleStatus || 'active';
      sub.subscriptionStatus = prev?.subscriptionStatus || 'active';
      sub.suspendedAt = null;
    }
    if (!restoredStores.includes(store.tiwiId)) {
      restoredStores.push(store.tiwiId);
    }
  });

  for (const subTable of ['platform_service_subscriptions', 'service_subscriptions']) {
    if (!(await tableExists(runner, subTable))) continue;
    const cols = await getTableColumns(runner, subTable);
    const { rows: svcRows } = await runner.query(
      `SELECT * FROM ${subTable} WHERE user_id = $1 AND status <> 'terminated'`,
      [uid]
    );
    for (const svc of svcRows || []) {
      const svcKey = `${subTable}:${svc.service_type || svc.id}`;
      const prev = snap.serviceSubscriptions?.[svcKey];
      const endDate = toDate(svc.expires_at || svc.current_period_end || svc.next_billing_at);
      const targetStatus = endDate && endDate <= nowDate ? 'expired' : (prev?.status || 'active');
      if (cols.has('auto_renew') && prev?.autoRenew !== undefined) {
        await runner.query(
          `UPDATE ${subTable}
           SET status = $2, auto_renew = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [svc.id, targetStatus, Boolean(prev.autoRenew)]
        );
      } else {
        await runner.query(
          `UPDATE ${subTable}
           SET status = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [svc.id, targetStatus]
        );
      }
      restoredServices.push(svc.service_type || svc.id);
    }
  }

  if (await tableExists(runner, 'discord_bots')) {
    const { rows: botRows } = await runner.query(
      'SELECT id FROM discord_bots WHERE user_id = $1',
      [uid]
    );
    for (const bot of botRows || []) {
      const targetStatus = snap.discordBots?.[bot.id]?.status || 'offline';
      await runner.query(
        'UPDATE discord_bots SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [bot.id, targetStatus]
      );
    }
  }
  if (await tableExists(runner, 'discord_servers')) {
    const { rows: srvRows } = await runner.query(
      'SELECT id FROM discord_servers WHERE user_id = $1',
      [uid]
    );
    for (const srv of srvRows || []) {
      const targetSuspended = Boolean(snap.discordServers?.[srv.id]?.isSuspended ?? false);
      await runner.query(
        'UPDATE discord_servers SET is_suspended = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [srv.id, targetSuspended]
      );
    }
  }
  if (await tableExists(runner, 'discord_workspace_services')) {
    const { rows: wsRows } = await runner.query(
      'SELECT id FROM discord_workspace_services WHERE user_id = $1',
      [uid]
    );
    for (const ws of wsRows || []) {
      const targetStatus = snap.discordWorkspaceServices?.[ws.id]?.status || 'Active';
      await runner.query(
        'UPDATE discord_workspace_services SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [ws.id, targetStatus]
      );
    }
  }

  await runner.query(
    `UPDATE system_account_service_holds
     SET hold_type = 'cleared',
         non_refundable = TRUE,
         retain_until = NULL,
         reason = COALESCE($2, reason),
         updated_at = $3::timestamptz
     WHERE user_id = $1`,
    [uid, overrideReason, nowIso]
  );

  const notifCopy = buildHoldNotificationCopy({
    holdType: HOLD_TYPES.CLEARED,
    reason: overrideReason || existingHold.reason,
    nonRefundable: true
  });
  const notification = await insertNotification(runner, {
    userId: uid,
    ...notifCopy,
    meta: {
      previousHoldType: existingHold.holdType,
      restoredAt: nowIso,
      nonRefundable: true
    },
    nowIso
  });

  await insertAuditRecord(runner, {
    userId: uid,
    action: 'hold_restored',
    holdType: HOLD_TYPES.CLEARED,
    nonRefundable: true,
    reason: overrideReason || existingHold.reason,
    details: {
      previousHoldType: existingHold.holdType,
      allowPermanentOverride: Boolean(allowPermanentOverride),
      restoredDroplets,
      restoredIps,
      restoredTenants,
      restoredStores,
      restoredServices
    },
    nowIso
  });

  return {
    ok: true,
    restored: true,
    userId: uid,
    previousHoldType: existingHold.holdType,
    holdType: HOLD_TYPES.CLEARED,
    nonRefundable: true,
    restoredAt: nowIso,
    restoredServices: {
      droplets: restoredDroplets,
      ips: restoredIps,
      tenants: restoredTenants,
      stores: restoredStores,
      serviceSubscriptions: restoredServices
    },
    notification
  };
}

export async function runPermanentBanPurgeSweep({
  now = new Date(),
  reclaimTenantFn = null,
  releaseIpFn = null,
  adjustNodeFn = null,
  queryable = null
} = {}) {
  const nowDate = toDate(now) || new Date();
  const nowIso = nowDate.toISOString();
  const runner = resolveRunner(queryable);
  const purgedUsers = [];

  if (!runner.active) {
    const dueHolds = [...memoryHolds.values()].filter(
      (h) =>
        h.holdType === HOLD_TYPES.PERMANENT_BAN &&
        !h.purgedAt &&
        h.retainUntil &&
        toDate(h.retainUntil) <= nowDate
    );

    for (const hold of dueHolds) {
      const uid = hold.userId;
      const deletedDroplets = [];
      const releasedIps = [];
      const reclaimedTenants = [];
      const terminatedStores = [];
      const terminatedServices = [];

      const userDroplets = [...memoryDroplets.values()].filter((d) => d.userId === uid);
      for (const droplet of userDroplets) {
        const ipRes = await invokeReleaseIp(runner, releaseIpFn, droplet.id, 'permanent_ban_purge');
        if (ipRes?.releasedAddresses?.length > 0) {
          releasedIps.push(...ipRes.releasedAddresses.map((a) => a.ipAddress));
        }
        if (droplet.tenantId) {
          await reclaimTenant(runner, reclaimTenantFn, {
            tenantId: droplet.tenantId,
            userId: uid
          });
          reclaimedTenants.push(droplet.tenantId);
        }
        if (droplet.nodeId) {
          await adjustNodeCount(runner, adjustNodeFn, droplet.nodeId, -1);
        }
        memoryDroplets.delete(droplet.id);
        deletedDroplets.push(droplet.id);
      }

      const orphanTenants = [...memoryTenants.values()].filter((t) => t.userId === uid);
      for (const tenant of orphanTenants) {
        await reclaimTenant(runner, reclaimTenantFn, {
          tenantId: tenant.tenantId,
          userId: uid
        });
        if (!reclaimedTenants.includes(tenant.tenantId)) {
          reclaimedTenants.push(tenant.tenantId);
        }
      }

      for (const store of memoryStores.values()) {
        if (store.ownerId !== uid) continue;
        store.status = 'terminated';
        store.lifecycleStatus = 'terminated';
        terminatedStores.push(store.tiwiId);
        const storeSub = memoryStoreSubscriptions.get(store.tiwiId);
        if (storeSub) {
          storeSub.status = 'terminated';
        }
      }

      for (const sub of memoryServiceSubscriptions.values()) {
        if (sub.userId !== uid) continue;
        sub.status = 'terminated';
        sub.autoRenew = false;
        terminatedServices.push(sub.serviceType);
      }

      hold.purgedAt = nowIso;
      hold.updatedAt = nowIso;
      hold.snapshot = {
        ...(hold.snapshot || {}),
        purgeSummary: {
          purgedAt: nowIso,
          deletedDroplets,
          releasedIps,
          reclaimedTenants,
          terminatedStores,
          terminatedServices
        }
      };

      const audit = await insertAuditRecord(runner, {
        userId: uid,
        action: 'permanent_ban_purged',
        holdType: HOLD_TYPES.PERMANENT_BAN,
        nonRefundable: true,
        reason: hold.reason,
        details: {
          irreversible: true,
          purgedAt: nowIso,
          retainUntil: hold.retainUntil,
          deletedDroplets,
          releasedIps,
          reclaimedTenants,
          terminatedStores,
          terminatedServices
        },
        nowIso
      });

      await insertNotification(runner, {
        userId: uid,
        type: 'account_permanent_purge_completed',
        title: 'Account Data Permanently Purged',
        snippet: 'Retention period ended; all services and resources have been purged.',
        content: `Your permanent ban retention window ended at ${hold.retainUntil}. All servers, IP allocations, bots, and store services have been permanently purged.`,
        meta: { purgedAt: nowIso, auditId: audit?.id || null, nonRefundable: true },
        nowIso
      });

      purgedUsers.push({
        userId: uid,
        purgedAt: nowIso,
        retainUntil: hold.retainUntil,
        deletedDroplets,
        releasedIps,
        reclaimedTenants,
        terminatedStores,
        terminatedServices,
        auditId: audit?.id || null
      });
    }

    return {
      ok: true,
      processed: purgedUsers.length,
      purgedUsers
    };
  }

  // PostgreSQL / PGlite path
  await ensureAccountLifecycleSchema(queryable);
  const { rows: dueRows } = await runner.query(
    `SELECT *
     FROM system_account_service_holds
     WHERE hold_type = 'permanent_ban'
       AND purged_at IS NULL
       AND retain_until IS NOT NULL
       AND retain_until <= $1::timestamptz
     ORDER BY retain_until ASC`,
    [nowIso]
  );

  for (const row of dueRows || []) {
    const hold = formatHoldRow(row);
    const uid = hold.userId;
    const deletedDroplets = [];
    const releasedIps = [];
    const reclaimedTenants = [];
    const terminatedStores = [];
    const terminatedServices = [];

    if (await tableExists(runner, 'cloud_droplets')) {
      const { rows: dropletRows } = await runner.query(
        'SELECT * FROM cloud_droplets WHERE user_id = $1',
        [uid]
      );
      for (const d of dropletRows || []) {
        const ipRes = await invokeReleaseIp(runner, releaseIpFn, d.id, 'permanent_ban_purge');
        if (ipRes?.releasedAddresses?.length > 0) {
          releasedIps.push(...ipRes.releasedAddresses.map((a) => a.ipAddress));
        }
        if (d.tenant_id) {
          await reclaimTenant(runner, reclaimTenantFn, {
            tenantId: d.tenant_id,
            userId: uid
          });
          reclaimedTenants.push(d.tenant_id);
        }
        if (d.node_id) {
          await adjustNodeCount(runner, adjustNodeFn, d.node_id, -1);
        }
        await runner.query('DELETE FROM cloud_droplets WHERE id = $1', [d.id]);
        deletedDroplets.push(d.id);
      }
    }

    if (await tableExists(runner, 'system_ubuntu_tenants')) {
      const { rows: orphanTenants } = await runner.query(
        'SELECT id FROM system_ubuntu_tenants WHERE user_id = $1',
        [uid]
      );
      for (const t of orphanTenants || []) {
        await reclaimTenant(runner, reclaimTenantFn, {
          tenantId: t.id,
          userId: uid
        });
        if (!reclaimedTenants.includes(t.id)) {
          reclaimedTenants.push(t.id);
        }
      }
    }

    if (await tableExists(runner, 'system_stores')) {
      const storeCols = await getTableColumns(runner, 'system_stores');
      const { rows: storeRows } = await runner.query(
        'SELECT id, tiwi_id FROM system_stores WHERE owner_id = $1',
        [uid]
      );
      const tiwiIds = (storeRows || []).map((s) => s.tiwi_id).filter(Boolean);

      for (const s of storeRows || []) {
        if (storeCols.has('status')) {
          await runner.query(
            `UPDATE system_stores SET status = 'terminated' WHERE id = $1`,
            [s.id]
          );
        }
        if (s.tiwi_id && !terminatedStores.includes(s.tiwi_id)) {
          terminatedStores.push(s.tiwi_id);
        }
      }

      if (tiwiIds.length > 0 && await tableExists(runner, 'system_subscriptions')) {
        const subCols = await getTableColumns(runner, 'system_subscriptions');
        if (subCols.has('status')) {
          await runner.query(
            `UPDATE system_subscriptions
             SET status = 'terminated', updated_at = CURRENT_TIMESTAMP
             WHERE tiwi_id = ANY($1::text[])`,
            [tiwiIds]
          );
        }
      }

      if (tiwiIds.length > 0 && await tableExists(runner, 'system_custom_domains')) {
        await runner.query(
          `UPDATE system_custom_domains
           SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
           WHERE tiwi_id = ANY($1::text[])`,
          [tiwiIds]
        );
      }
    }

    await updateMasterDirectoryStores(runner, uid, (store, sub) => {
      store.status = 'terminated';
      store.lifecycleStatus = 'terminated';
      store.subscriptionStatus = 'terminated';
      store.terminatedAt = nowIso;
      if (sub) {
        sub.lifecycleStatus = 'terminated';
        sub.subscriptionStatus = 'terminated';
        sub.terminatedAt = nowIso;
      }
      if (!terminatedStores.includes(store.tiwiId)) {
        terminatedStores.push(store.tiwiId);
      }
    });

    for (const subTable of ['platform_service_subscriptions', 'service_subscriptions']) {
      if (!(await tableExists(runner, subTable))) continue;
      const cols = await getTableColumns(runner, subTable);
      const { rows: svcRows } = await runner.query(
        `UPDATE ${subTable}
         SET status = 'terminated'${cols.has('auto_renew') ? ', auto_renew = FALSE' : ''},
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1
         RETURNING id, service_type`,
        [uid]
      );
      for (const r of svcRows || []) {
        terminatedServices.push(r.service_type || r.id);
      }
    }

    if (await tableExists(runner, 'discord_bots')) {
      await runner.query(
        `UPDATE discord_bots SET status = 'terminated', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [uid]
      );
    }
    if (await tableExists(runner, 'discord_servers')) {
      await runner.query(
        `UPDATE discord_servers SET is_suspended = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [uid]
      );
    }
    if (await tableExists(runner, 'discord_workspace_services')) {
      await runner.query(
        `UPDATE discord_workspace_services SET status = 'Terminated', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [uid]
      );
    }
    if (await tableExists(runner, 'whatsapp_auth_state')) {
      await runner.query(
        `DELETE FROM whatsapp_auth_state WHERE state_key = $1 OR state_key LIKE $2 OR state_key LIKE $3`,
        [uid, `${uid}:%`, `wa_${uid}%`]
      );
    }

    const updatedSnapshot = {
      ...(hold.snapshot || {}),
      purgeSummary: {
        purgedAt: nowIso,
        deletedDroplets,
        releasedIps,
        reclaimedTenants,
        terminatedStores,
        terminatedServices
      }
    };

    await runner.query(
      `UPDATE system_account_service_holds
       SET purged_at = $2::timestamptz,
           snapshot_json = $3::jsonb,
           updated_at = $2::timestamptz
       WHERE user_id = $1`,
      [uid, nowIso, JSON.stringify(updatedSnapshot)]
    );

    const audit = await insertAuditRecord(runner, {
      userId: uid,
      action: 'permanent_ban_purged',
      holdType: HOLD_TYPES.PERMANENT_BAN,
      nonRefundable: true,
      reason: hold.reason,
      details: {
        irreversible: true,
        purgedAt: nowIso,
        retainUntil: hold.retainUntil,
        deletedDroplets,
        releasedIps,
        reclaimedTenants,
        terminatedStores,
        terminatedServices
      },
      nowIso
    });

    await insertNotification(runner, {
      userId: uid,
      type: 'account_permanent_purge_completed',
      title: 'Account Data Permanently Purged',
      snippet: 'Retention period ended; all services and resources have been purged.',
      content: `Your permanent ban retention window ended at ${hold.retainUntil}. All servers, IP allocations, bots, and store services have been permanently purged.`,
      meta: { purgedAt: nowIso, auditId: audit?.id || null, nonRefundable: true },
      nowIso
    });

    purgedUsers.push({
      userId: uid,
      purgedAt: nowIso,
      retainUntil: hold.retainUntil,
      deletedDroplets,
      releasedIps,
      reclaimedTenants,
      terminatedStores,
      terminatedServices,
      auditId: audit?.id || null
    });
  }

  return {
    ok: true,
    processed: purgedUsers.length,
    purgedUsers
  };
}
