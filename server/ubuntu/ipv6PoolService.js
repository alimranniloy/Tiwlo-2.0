import crypto from 'node:crypto';
import net from 'node:net';
import { getPgPool, isPgActive, queryPg } from '../db/postgres.js';
import { sendTiwloEmail } from '../db/emailService.js';
import { renderBaseEmail, stripEmailHeaderCrlf } from '../email/baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

const MASK_64 = 0xffff_ffff_ffff_ffffn;
const MASK_128 = (1n << 128n) - 1n;
const PREFIX_64_MASK = MASK_64 << 64n;
const MAX_SUFFIX_ATTEMPTS = 64;
const LIVE_ALLOCATION_STATUSES = new Set(['active', 'held']);

// In-memory fallback stores for unit tests and non-PostgreSQL environments.
const inMemoryPools = new Map();
const inMemoryDroplets = new Map();
const inMemoryAllocations = new Map();
const inMemoryEvents = [];
const inMemoryNotifications = [];
const inMemoryDnsRecords = new Map();
const inMemoryUsers = new Map();
const inMemoryDedupKeys = new Set();

let schemaReady = false;
let schemaPromise = null;

function createServiceError(message, statusCode = 400, code = 'IPV6_POOL_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function sanitizeIdentifier(raw, label, maxLen = 128) {
  const value = String(raw || '').trim();
  if (!value || value.length > maxLen || /[^a-zA-Z0-9._:-]/.test(value)) {
    throw createServiceError(`${label} must be a valid non-empty identifier.`, 400, 'INVALID_IDENTIFIER');
  }
  return value;
}

function stripIpv6BracketsAndZone(rawInput) {
  let value = String(rawInput || '').trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1).trim();
  }
  const zoneIndex = value.indexOf('%');
  if (zoneIndex !== -1) {
    value = value.slice(0, zoneIndex).trim();
  }
  return value;
}

function splitAddressAndPrefixLen(rawInput) {
  const raw = String(rawInput || '').trim();
  if (!raw) {
    throw createServiceError('IPv6 address or prefix is required.', 400, 'INVALID_IPV6');
  }

  const slashParts = raw.split('/');
  if (slashParts.length > 2) {
    throw createServiceError(`Invalid IPv6 CIDR notation: "${raw}".`, 400, 'INVALID_IPV6');
  }

  const addrPart = stripIpv6BracketsAndZone(slashParts[0]);
  if (!net.isIPv6(addrPart)) {
    throw createServiceError(`Invalid IPv6 address: "${raw}".`, 400, 'INVALID_IPV6');
  }

  let prefixLen = null;
  if (slashParts.length === 2) {
    const parsedLen = Number(slashParts[1]);
    if (!Number.isInteger(parsedLen) || parsedLen < 0 || parsedLen > 128) {
      throw createServiceError(`Invalid IPv6 prefix length in "${raw}".`, 400, 'INVALID_IPV6_PREFIX');
    }
    prefixLen = parsedLen;
  }

  return { address: addrPart, prefixLen };
}

function expandIpv6ToGroups(addr) {
  let normalized = addr.toLowerCase();
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    if (lastColon === -1) {
      throw createServiceError(`Invalid IPv6 address: "${addr}".`, 400, 'INVALID_IPV6');
    }
    const v4Part = normalized.slice(lastColon + 1);
    if (!net.isIPv4(v4Part)) {
      throw createServiceError(`Invalid embedded IPv4 in IPv6 address: "${addr}".`, 400, 'INVALID_IPV6');
    }
    const octets = v4Part.split('.').map(Number);
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${normalized.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const doubleColonParts = normalized.split('::');
  if (doubleColonParts.length > 2) {
    throw createServiceError(`Invalid IPv6 address: "${addr}".`, 400, 'INVALID_IPV6');
  }

  let groups;
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    if (missing < 1) {
      throw createServiceError(`Invalid IPv6 compression in "${addr}".`, 400, 'INVALID_IPV6');
    }
    groups = [...left, ...Array(missing).fill('0'), ...right];
  } else {
    groups = normalized.split(':');
    if (groups.length !== 8) {
      throw createServiceError(`Invalid IPv6 group count in "${addr}".`, 400, 'INVALID_IPV6');
    }
  }

  return groups.map((group) => {
    if (!/^[0-9a-f]{1,4}$/.test(group)) {
      throw createServiceError(`Invalid IPv6 hextet "${group}" in "${addr}".`, 400, 'INVALID_IPV6');
    }
    return Number.parseInt(group, 16);
  });
}

export function parseIpv6ToBigInt(rawIp) {
  const { address, prefixLen } = splitAddressAndPrefixLen(rawIp);
  const groups = expandIpv6ToGroups(address);
  let value = 0n;
  for (const group of groups) {
    value = (value << 16n) | BigInt(group);
  }
  return { value, prefixLen };
}

export function bigIntToIpv6(value) {
  if (typeof value !== 'bigint' || value < 0n || value > MASK_128) {
    throw createServiceError('IPv6 integer value out of 128-bit range.', 400, 'INVALID_IPV6');
  }

  const groups = new Array(8);
  let cursor = value;
  for (let i = 7; i >= 0; i -= 1) {
    groups[i] = Number(cursor & 0xffffn);
    cursor >>= 16n;
  }

  // RFC 5952 canonical zero-compression: longest consecutive run of >= 2 zeros (earliest on tie).
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  for (let i = 0; i < 8; i += 1) {
    if (groups[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen += 1;
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen < 2) {
    return groups.map((g) => g.toString(16)).join(':');
  }

  const left = groups.slice(0, bestStart).map((g) => g.toString(16)).join(':');
  const right = groups.slice(bestStart + bestLen).map((g) => g.toString(16)).join(':');
  return `${left}::${right}`;
}

function assertRoutableIpv6BigInt(value, rawInput) {
  if (value === 0n) {
    throw createServiceError(`Unspecified IPv6 address "${rawInput}" cannot be used for a pool.`, 400, 'INVALID_IPV6_SCOPE');
  }
  if (value === 1n) {
    throw createServiceError(`Loopback IPv6 address "${rawInput}" cannot be used for a pool.`, 400, 'INVALID_IPV6_SCOPE');
  }
  const topByte = Number(value >> 120n);
  if (topByte === 0xff) {
    throw createServiceError(`Multicast IPv6 address "${rawInput}" cannot be used for a pool.`, 400, 'INVALID_IPV6_SCOPE');
  }
  const top10Bits = Number(value >> 118n);
  if (top10Bits === 0x3fa) {
    // fe80::/10 link-local
    throw createServiceError(`Link-local IPv6 address "${rawInput}" cannot be used for a global pool.`, 400, 'INVALID_IPV6_SCOPE');
  }
  // Enforce global unicast range (2000::/3), blocking unique-local (fc00::/7), IPv4-mapped, etc.
  if ((value >> 125n) !== 1n) {
    throw createServiceError(`Non-global IPv6 address "${rawInput}" outside 2000::/3 cannot be used for a pool.`, 400, 'INVALID_IPV6_SCOPE');
  }
}

export function normalizeIpv6(rawIp) {
  const { value, prefixLen } = parseIpv6ToBigInt(rawIp);
  if (prefixLen !== null && prefixLen !== 128) {
    throw createServiceError(`Expected a single IPv6 host address, got "/${prefixLen}".`, 400, 'INVALID_IPV6');
  }
  return bigIntToIpv6(value);
}

/**
 * Extracts a canonical /64 network prefix string (`<prefix>::/64`) from any IPv6
 * address or /48 /64 CIDR prefix using pure 128-bit BigInt arithmetic.
 */
export function extractIpv6Prefix64(ipv6Address) {
  const { value, prefixLen } = parseIpv6ToBigInt(ipv6Address);
  if (prefixLen !== null && (prefixLen < 1 || (prefixLen > 64 && prefixLen !== 128))) {
    throw createServiceError(`Unsupported IPv6 prefix length "/${prefixLen}".`, 400, 'INVALID_IPV6_PREFIX');
  }
  assertRoutableIpv6BigInt(value, ipv6Address);
  const masked = value & PREFIX_64_MASK;
  if (masked === 0n) {
    throw createServiceError(`IPv6 prefix "${ipv6Address}" resolves to an unspecified /64 network.`, 400, 'INVALID_IPV6_PREFIX');
  }
  return `${bigIntToIpv6(masked)}/64`;
}

function formatSuffix64BigInt(suffixBigInt) {
  const groups = [
    Number((suffixBigInt >> 48n) & 0xffffn).toString(16).padStart(4, '0'),
    Number((suffixBigInt >> 32n) & 0xffffn).toString(16).padStart(4, '0'),
    Number((suffixBigInt >> 16n) & 0xffffn).toString(16).padStart(4, '0'),
    Number(suffixBigInt & 0xffffn).toString(16).padStart(4, '0')
  ];
  return groups.join(':');
}

export function extractIpv6Suffix64(ipv6Address) {
  const { value } = parseIpv6ToBigInt(ipv6Address);
  return formatSuffix64BigInt(value & MASK_64);
}

function parseSuffix64ToBigInt(suffixHex) {
  if (typeof suffixHex === 'bigint') {
    if (suffixHex < 0n || suffixHex > MASK_64) {
      throw createServiceError('IPv6 interface suffix BigInt must be within 64 bits.', 400, 'INVALID_IPV6_SUFFIX');
    }
    return suffixHex;
  }
  if (typeof suffixHex === 'number') {
    if (!Number.isInteger(suffixHex) || suffixHex < 0) {
      throw createServiceError('IPv6 interface suffix number must be a non-negative integer.', 400, 'INVALID_IPV6_SUFFIX');
    }
    return BigInt(suffixHex) & MASK_64;
  }

  let raw = String(suffixHex ?? '').trim().toLowerCase();
  if (!raw) {
    throw createServiceError('IPv6 interface suffix is required.', 400, 'INVALID_IPV6_SUFFIX');
  }

  if (raw.startsWith('0x')) {
    raw = raw.slice(2);
  }

  if (raw.includes(':')) {
    const doubleColonSplits = raw.split('::');
    if (doubleColonSplits.length > 2) {
      throw createServiceError(`Invalid 64-bit IPv6 suffix "${suffixHex}": multiple "::".`, 400, 'INVALID_IPV6_SUFFIX');
    }
    let groups;
    if (doubleColonSplits.length === 2) {
      const left = doubleColonSplits[0] ? doubleColonSplits[0].split(':') : [];
      const right = doubleColonSplits[1] ? doubleColonSplits[1].split(':') : [];
      const missing = 4 - (left.length + right.length);
      if (missing < 0) {
        throw createServiceError(`Invalid 64-bit IPv6 suffix "${suffixHex}".`, 400, 'INVALID_IPV6_SUFFIX');
      }
      groups = [...left, ...Array(missing).fill('0'), ...right];
    } else {
      groups = raw.split(':');
      if (groups.length !== 4) {
        throw createServiceError(`Invalid 64-bit IPv6 suffix "${suffixHex}".`, 400, 'INVALID_IPV6_SUFFIX');
      }
    }
    if (groups.some((p) => !/^[0-9a-f]{1,4}$/.test(p))) {
      throw createServiceError(`Invalid colon-separated 64-bit IPv6 suffix "${suffixHex}".`, 400, 'INVALID_IPV6_SUFFIX');
    }
    let val = 0n;
    for (const part of groups) {
      val = (val << 16n) | BigInt(Number.parseInt(part, 16));
    }
    if (val === 0n) {
      throw createServiceError(`Unspecified 64-bit IPv6 suffix "${suffixHex}" cannot be assigned.`, 400, 'INVALID_IPV6_SUFFIX');
    }
    return val;
  }

  if (!/^[0-9a-f]{1,16}$/.test(raw)) {
    throw createServiceError(`Invalid hex 64-bit IPv6 suffix "${suffixHex}".`, 400, 'INVALID_IPV6_SUFFIX');
  }
  const parsedVal = BigInt(`0x${raw}`);
  if (parsedVal === 0n) {
    throw createServiceError(`Unspecified 64-bit IPv6 suffix "${suffixHex}" cannot be assigned.`, 400, 'INVALID_IPV6_SUFFIX');
  }
  return parsedVal;
}

/**
 * Combines a /64 (or /48) IPv6 prefix and a 64-bit interface suffix into a canonical /128 IPv6 string.
 */
export function deriveIpv6FromPrefix(prefixStr, suffixHex) {
  const { value: prefixValue, prefixLen } = parseIpv6ToBigInt(prefixStr);
  if (prefixLen !== null && (prefixLen < 1 || prefixLen > 64)) {
    throw createServiceError(
      `Prefix "${prefixStr}" must be /64 or broader (/48, /56, /64) to derive 64-bit host addresses.`,
      400,
      'INVALID_IPV6_PREFIX'
    );
  }
  assertRoutableIpv6BigInt(prefixValue, prefixStr);
  const upper64 = prefixValue & PREFIX_64_MASK;
  if (upper64 === 0n) {
    throw createServiceError(`Prefix "${prefixStr}" has an empty /64 network portion.`, 400, 'INVALID_IPV6_PREFIX');
  }

  const suffix64 = parseSuffix64ToBigInt(suffixHex);
  const fullIpv6 = bigIntToIpv6(upper64 | suffix64);
  if (!net.isIPv6(fullIpv6)) {
    throw createServiceError(`Derived address "${fullIpv6}" is not a valid IPv6 address.`, 500, 'INVALID_IPV6');
  }
  return fullIpv6;
}

/**
 * Deterministically hashes a droplet identifier + attempt counter into a non-reserved
 * 64-bit IPv6 interface identifier (`xxxx:xxxx:xxxx:xxxx`).
 */
export function generateDeterministicSuffix64(dropletId, attempt = 0) {
  const cleanId = sanitizeIdentifier(dropletId, 'dropletId');
  const numericAttempt = Number(attempt);
  const safeAttempt = Number.isSafeInteger(numericAttempt) && numericAttempt >= 0 ? numericAttempt : 0;
  const digest = crypto
    .createHash('sha256')
    .update(`tiwlo:ipv6:v1:${cleanId}:${safeAttempt}`)
    .digest();

  let suffix64 = digest.readBigUInt64BE(0);
  // Clear universal/global bit to indicate locally-administered interface ID and avoid
  // subnet-router anycast (0) and all-ones reserved IIDs.
  suffix64 &= ~(1n << 57n);
  if (suffix64 === 0n || suffix64 === MASK_64) {
    suffix64 = 0x0001_0000_0000_0001n + BigInt(safeAttempt);
  }
  return formatSuffix64BigInt(suffix64);
}

export function formatIpv6SshCommand({ ipv6, username = 'root', port = 22 } = {}) {
  const normalized = normalizeIpv6(ipv6);
  const cleanUser = String(username || 'root').trim() || 'root';
  const cleanPort = Number.isInteger(Number(port)) && Number(port) > 0 ? Number(port) : 22;
  return `ssh ${cleanUser}@${normalized} -p ${cleanPort}`;
}

function getQueryRunner(queryFn = null) {
  if (typeof queryFn === 'function') {
    return { active: true, query: queryFn, pool: null };
  }
  if (isPgActive()) {
    return { active: true, query: queryPg, pool: getPgPool() };
  }
  return { active: false, query: null, pool: null };
}

async function runWithTransaction(runner, fn) {
  if (!runner.active) {
    return fn(null);
  }
  if (runner.pool && typeof runner.pool.connect === 'function') {
    const client = await runner.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn((sql, params = []) => client.query(sql, params));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  return fn(runner.query);
}

export function resetInMemoryIpv6PoolForTests() {
  inMemoryPools.clear();
  inMemoryDroplets.clear();
  inMemoryAllocations.clear();
  inMemoryEvents.length = 0;
  inMemoryNotifications.length = 0;
  inMemoryDnsRecords.clear();
  inMemoryUsers.clear();
  inMemoryDedupKeys.clear();
  schemaReady = false;
  schemaPromise = null;
}

export function getInMemoryIpv6StateForTests() {
  return {
    pools: [...inMemoryPools.values()].map((p) => ({ ...p })),
    droplets: [...inMemoryDroplets.values()].map((d) => ({ ...d })),
    allocations: [...inMemoryAllocations.values()].map((a) => ({ ...a })),
    events: [...inMemoryEvents],
    notifications: [...inMemoryNotifications],
    dnsRecords: [...inMemoryDnsRecords.values()].map((r) => ({ ...r })),
    users: [...inMemoryUsers.values()].map((u) => ({ ...u }))
  };
}

export function registerInMemoryUserForTests({ id, email, name = 'Tiwlo User' } = {}) {
  const cleanId = sanitizeIdentifier(id, 'userId', 64);
  const record = {
    id: cleanId,
    email: String(email || '').trim().toLowerCase(),
    name: String(name || 'Tiwlo User').trim()
  };
  inMemoryUsers.set(cleanId, record);
  return { ...record };
}

export function registerInMemoryDnsRecordForTests({ id = null, zone = 'tiwlo.com', name = '@', type = 'AAAA', content, ttl = 300 } = {}) {
  const cleanType = String(type || 'AAAA').trim().toUpperCase();
  const normalizedContent = cleanType === 'AAAA' ? normalizeIpv6(content) : String(content || '').trim();
  const recordId = id || `dns_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const record = {
    id: recordId,
    zone: String(zone || 'tiwlo.com').trim().toLowerCase(),
    name: String(name || '@').trim().toLowerCase(),
    type: cleanType,
    content: normalizedContent,
    ttl: Number(ttl) || 300,
    updatedAt: new Date().toISOString()
  };
  inMemoryDnsRecords.set(recordId, record);
  return { ...record };
}

export function upsertInMemoryDropletForTests({
  id,
  userId = null,
  nodeId,
  name = null,
  sshPort = 22,
  accessUsername = 'root',
  status = 'active',
  ipv6 = null,
  ipv6Prefix = null,
  ipv6HostSuffix = null
} = {}) {
  const cleanId = sanitizeIdentifier(id, 'dropletId', 64);
  const existing = inMemoryDroplets.get(cleanId);
  const record = {
    id: cleanId,
    userId: userId ?? existing?.userId ?? null,
    nodeId: nodeId ? sanitizeIdentifier(nodeId, 'nodeId') : existing?.nodeId || 'primary-ubuntu-node',
    name: name || existing?.name || cleanId,
    sshPort: Number(sshPort || existing?.sshPort || 22),
    accessUsername: accessUsername || existing?.accessUsername || 'root',
    status: status || existing?.status || 'active',
    ipv6: ipv6 ? normalizeIpv6(ipv6) : existing?.ipv6 || null,
    ipv6Prefix: ipv6Prefix ? extractIpv6Prefix64(ipv6Prefix) : existing?.ipv6Prefix || null,
    ipv6HostSuffix: ipv6HostSuffix ?? existing?.ipv6HostSuffix ?? null,
    ipv6LastCheckedAt: existing?.ipv6LastCheckedAt || null
  };
  inMemoryDroplets.set(cleanId, record);
  return { ...record };
}

/**
 * Idempotent PostgreSQL schema migration for IPv6 pools, lifecycle allocations,
 * cloud_droplets IPv6 columns, and audit change events.
 */
export async function ensureIpv6PoolSchema({ queryFn = null } = {}) {
  const runner = getQueryRunner(queryFn);
  if (!runner.active) {
    return { ok: true, mode: 'memory' };
  }
  if (schemaReady && !queryFn) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (schemaPromise && !queryFn) {
    return schemaPromise;
  }

  const executeMigration = async () => {
    await runner.query(`
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ipv6 VARCHAR(128);
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ipv6_prefix VARCHAR(128);
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ipv6_host_suffix VARCHAR(64);
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ipv6_last_checked_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS system_node_ipv6_pools (
        node_id TEXT PRIMARY KEY,
        prefix TEXT NOT NULL,
        prefix_len INT NOT NULL DEFAULT 64,
        gateway TEXT,
        last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_ip_allocations (
        id TEXT PRIMARY KEY,
        droplet_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64),
        node_id TEXT NOT NULL,
        ip_address VARCHAR(128) NOT NULL,
        ip_version SMALLINT NOT NULL DEFAULT 6,
        prefix TEXT,
        host_suffix VARCHAR(64),
        status VARCHAR(24) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'held', 'released')),
        held_at TIMESTAMPTZ,
        released_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_allocations_live_ip_unique
        ON system_ip_allocations(ip_address)
        WHERE status IN ('active', 'held');
      CREATE INDEX IF NOT EXISTS idx_ip_allocations_droplet
        ON system_ip_allocations(droplet_id, status);
      CREATE INDEX IF NOT EXISTS idx_ip_allocations_node
        ON system_ip_allocations(node_id, status);

      CREATE TABLE IF NOT EXISTS system_ipv6_change_events (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        droplet_id VARCHAR(64),
        user_id VARCHAR(64),
        event_type VARCHAR(64) NOT NULL,
        old_prefix TEXT,
        new_prefix TEXT,
        old_ipv6 VARCHAR(128),
        new_ipv6 VARCHAR(128),
        dns_updated_count INT NOT NULL DEFAULT 0,
        notified_dashboard BOOLEAN NOT NULL DEFAULT FALSE,
        notified_email BOOLEAN NOT NULL DEFAULT FALSE,
        dedup_key VARCHAR(128),
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ipv6_change_events_node
        ON system_ipv6_change_events(node_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ipv6_change_events_droplet
        ON system_ipv6_change_events(droplet_id, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ipv6_change_events_dedup
        ON system_ipv6_change_events(dedup_key)
        WHERE dedup_key IS NOT NULL;
    `);
    if (!queryFn) {
      schemaReady = true;
    }
    return { ok: true, mode: 'postgres' };
  };

  if (queryFn) {
    return executeMigration();
  }

  schemaPromise = executeMigration().finally(() => {
    schemaPromise = null;
  });
  return schemaPromise;
}

function formatPoolRow(row) {
  if (!row) return null;
  return {
    nodeId: row.node_id ?? row.nodeId,
    prefix: row.prefix,
    prefixLen: Number(row.prefix_len ?? row.prefixLen ?? 64),
    gateway: row.gateway || null,
    lastSeenAt: row.last_seen_at ?? row.lastSeenAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null
  };
}

function formatAllocationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    dropletId: row.droplet_id ?? row.dropletId,
    userId: row.user_id ?? row.userId ?? null,
    nodeId: row.node_id ?? row.nodeId,
    ipAddress: row.ip_address ?? row.ipAddress,
    ipVersion: Number(row.ip_version ?? row.ipVersion ?? 6),
    prefix: row.prefix || null,
    hostSuffix: row.host_suffix ?? row.hostSuffix ?? null,
    status: row.status,
    heldAt: row.held_at ?? row.heldAt ?? null,
    releasedAt: row.released_at ?? row.releasedAt ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null
  };
}

export async function registerNodeIpv6Pool({
  nodeId,
  prefix,
  prefixLen = 64,
  gateway = null,
  queryFn = null
} = {}) {
  const cleanNodeId = sanitizeIdentifier(nodeId, 'nodeId');
  const normalizedPrefix = extractIpv6Prefix64(prefix);
  const cleanGateway = gateway ? normalizeIpv6(gateway) : null;
  const cleanPrefixLen = Number.isInteger(Number(prefixLen)) ? Number(prefixLen) : 64;
  const nowIso = new Date().toISOString();
  const runner = getQueryRunner(queryFn);

  if (!runner.active) {
    for (const [otherNodeId, otherPool] of inMemoryPools.entries()) {
      if (otherNodeId !== cleanNodeId && otherPool.prefix === normalizedPrefix) {
        throw createServiceError(
          `IPv6 prefix ${normalizedPrefix} is already registered to node "${otherNodeId}".`,
          409,
          'IPV6_PREFIX_CONFLICT'
        );
      }
    }
    const record = {
      nodeId: cleanNodeId,
      prefix: normalizedPrefix,
      prefixLen: cleanPrefixLen,
      gateway: cleanGateway,
      lastSeenAt: nowIso,
      updatedAt: nowIso
    };
    inMemoryPools.set(cleanNodeId, record);
    return { ...record };
  }

  await ensureIpv6PoolSchema({ queryFn: runner.query });
  const conflictCheck = await runner.query(
    `SELECT node_id FROM system_node_ipv6_pools WHERE prefix = $1 AND node_id <> $2 LIMIT 1`,
    [normalizedPrefix, cleanNodeId]
  );
  if (conflictCheck?.rows?.[0]) {
    throw createServiceError(
      `IPv6 prefix ${normalizedPrefix} is already registered to node "${conflictCheck.rows[0].node_id}".`,
      409,
      'IPV6_PREFIX_CONFLICT'
    );
  }
  const { rows } = await runner.query(
    `INSERT INTO system_node_ipv6_pools (node_id, prefix, prefix_len, gateway, last_seen_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (node_id) DO UPDATE SET
       prefix = EXCLUDED.prefix,
       prefix_len = EXCLUDED.prefix_len,
       gateway = COALESCE(EXCLUDED.gateway, system_node_ipv6_pools.gateway),
       last_seen_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [cleanNodeId, normalizedPrefix, cleanPrefixLen, cleanGateway]
  );
  return formatPoolRow(rows[0]);
}

export async function getNodeIpv6Pool(nodeId, { queryFn = null } = {}) {
  const cleanNodeId = sanitizeIdentifier(nodeId, 'nodeId');
  const runner = getQueryRunner(queryFn);
  if (!runner.active) {
    const pool = inMemoryPools.get(cleanNodeId);
    return pool ? { ...pool } : null;
  }
  await ensureIpv6PoolSchema({ queryFn: runner.query });
  const { rows } = await runner.query(
    'SELECT * FROM system_node_ipv6_pools WHERE node_id = $1 LIMIT 1',
    [cleanNodeId]
  );
  return formatPoolRow(rows[0]);
}

export async function listDropletIpAllocations({
  dropletId = null,
  nodeId = null,
  status = null,
  queryFn = null
} = {}) {
  const runner = getQueryRunner(queryFn);
  if (!runner.active) {
    return [...inMemoryAllocations.values()]
      .filter((item) =>
        (!dropletId || item.dropletId === dropletId) &&
        (!nodeId || item.nodeId === nodeId) &&
        (!status || item.status === status)
      )
      .map((item) => ({ ...item }));
  }

  await ensureIpv6PoolSchema({ queryFn: runner.query });
  const conditions = [];
  const params = [];
  if (dropletId) {
    params.push(String(dropletId));
    conditions.push(`droplet_id = $${params.length}`);
  }
  if (nodeId) {
    params.push(String(nodeId));
    conditions.push(`node_id = $${params.length}`);
  }
  if (status) {
    params.push(String(status));
    conditions.push(`status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await runner.query(
    `SELECT * FROM system_ip_allocations ${where} ORDER BY created_at DESC`,
    params
  );
  return rows.map(formatAllocationRow);
}

function findInMemoryLiveConflict(ipAddress, excludeDropletId = null) {
  const canonicalIp = normalizeIpv6(ipAddress);
  for (const alloc of inMemoryAllocations.values()) {
    if (
      alloc.ipAddress === canonicalIp &&
      LIVE_ALLOCATION_STATUSES.has(alloc.status) &&
      alloc.dropletId !== excludeDropletId
    ) {
      return alloc;
    }
  }
  for (const droplet of inMemoryDroplets.values()) {
    if (
      droplet.ipv6 === canonicalIp &&
      droplet.id !== excludeDropletId &&
      droplet.status !== 'deleted'
    ) {
      return { dropletId: droplet.id, ipAddress: droplet.ipv6, status: 'active' };
    }
  }
  return null;
}

async function findPgLiveConflict(query, ipAddress, excludeDropletId = null) {
  const canonicalIp = normalizeIpv6(ipAddress);
  const allocRes = await query(
    `SELECT id, droplet_id, status, ip_address
     FROM system_ip_allocations
     WHERE ip_address = $1
       AND status IN ('active', 'held')
       AND ($2::text IS NULL OR droplet_id <> $2)
     LIMIT 1`,
    [canonicalIp, excludeDropletId]
  );
  if (allocRes.rows?.[0]) {
    return formatAllocationRow(allocRes.rows[0]);
  }
  const dropletRes = await query(
    `SELECT id AS droplet_id, ipv6 AS ip_address
     FROM cloud_droplets
     WHERE ipv6 = $1
       AND ($2::text IS NULL OR id <> $2)
     LIMIT 1`,
    [canonicalIp, excludeDropletId]
  );
  if (dropletRes.rows?.[0]) {
    return {
      dropletId: dropletRes.rows[0].droplet_id,
      ipAddress: dropletRes.rows[0].ip_address,
      status: 'active'
    };
  }
  return null;
}

async function recordAuditEvent({
  query = null,
  nodeId,
  dropletId = null,
  userId = null,
  eventType,
  oldPrefix = null,
  newPrefix = null,
  oldIpv6 = null,
  newIpv6 = null,
  dnsUpdatedCount = 0,
  notifiedDashboard = false,
  notifiedEmail = false,
  dedupKey = null,
  details = {}
}) {
  const id = `ipv6evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const nowIso = new Date().toISOString();
  const entry = {
    id,
    nodeId,
    dropletId,
    userId,
    eventType,
    oldPrefix,
    newPrefix,
    oldIpv6,
    newIpv6,
    dnsUpdatedCount,
    notifiedDashboard,
    notifiedEmail,
    dedupKey,
    details,
    createdAt: nowIso
  };

  if (!query) {
    if (dedupKey) inMemoryDedupKeys.add(dedupKey);
    inMemoryEvents.unshift(entry);
    return entry;
  }

  await query(
    `INSERT INTO system_ipv6_change_events (
       id, node_id, droplet_id, user_id, event_type, old_prefix, new_prefix,
       old_ipv6, new_ipv6, dns_updated_count, notified_dashboard, notified_email,
       dedup_key, details
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING`,
    [
      id,
      nodeId,
      dropletId,
      userId,
      eventType,
      oldPrefix,
      newPrefix,
      oldIpv6,
      newIpv6,
      dnsUpdatedCount,
      notifiedDashboard,
      notifiedEmail,
      dedupKey,
      JSON.stringify(details && typeof details === 'object' ? details : {})
    ]
  );
  return entry;
}

function buildAllocationResult({
  dropletId,
  nodeId,
  userId = null,
  ipv6,
  prefix,
  hostSuffix,
  status = 'active',
  username = 'root',
  sshPort = 22,
  allocationId = null
}) {
  return {
    allocationId,
    dropletId,
    nodeId,
    userId,
    ipv6,
    prefix,
    hostSuffix,
    status,
    sshCommand: formatIpv6SshCommand({ ipv6, username, port: sshPort })
  };
}

/**
 * Allocates a unique /128 IPv6 address for a droplet from its node's /64 pool.
 * Rejects collisions against any other 'active' or 'held' allocation, while allowing
 * previously 'released' addresses to be safely reclaimed once verified free.
 */
export async function allocateDropletIpv6({
  nodeId,
  dropletId,
  preferredPrefix = null,
  userId = null,
  sshPort = 22,
  username = 'root',
  requestedIpv6 = null,
  requestedSuffix = null,
  queryFn = null
} = {}) {
  const cleanNodeId = sanitizeIdentifier(nodeId, 'nodeId');
  const cleanDropletId = sanitizeIdentifier(dropletId, 'dropletId', 64);
  const runner = getQueryRunner(queryFn);

  if (runner.active) {
    await ensureIpv6PoolSchema({ queryFn: runner.query });
  }

  // Resolve active /64 prefix for the node.
  let activePrefix = preferredPrefix ? extractIpv6Prefix64(preferredPrefix) : null;
  if (!activePrefix) {
    const existingPool = await getNodeIpv6Pool(cleanNodeId, { queryFn: runner.query });
    activePrefix = existingPool?.prefix || null;
  } else {
    await registerNodeIpv6Pool({ nodeId: cleanNodeId, prefix: activePrefix, queryFn: runner.query });
  }

  if (!activePrefix) {
    throw createServiceError(
      `No IPv6 prefix pool is registered for node "${cleanNodeId}". Pass preferredPrefix or register a pool first.`,
      404,
      'IPV6_POOL_NOT_FOUND'
    );
  }

  const explicitMode = Boolean(requestedIpv6 || requestedSuffix);
  const explicitTarget = requestedIpv6
    ? normalizeIpv6(requestedIpv6)
    : requestedSuffix
      ? deriveIpv6FromPrefix(activePrefix, requestedSuffix)
      : null;

  if (!runner.active) {
    const existingAllocs = [...inMemoryAllocations.values()].filter(
      (a) => a.dropletId === cleanDropletId && LIVE_ALLOCATION_STATUSES.has(a.status)
    );
    const activeSamePrefix = existingAllocs.find(
      (a) => a.status === 'active' && a.prefix === activePrefix && (!explicitTarget || a.ipAddress === explicitTarget)
    );
    if (activeSamePrefix) {
      const dropletRec = inMemoryDroplets.get(cleanDropletId);
      return buildAllocationResult({
        allocationId: activeSamePrefix.id,
        dropletId: cleanDropletId,
        nodeId: cleanNodeId,
        userId: userId ?? dropletRec?.userId ?? null,
        ipv6: activeSamePrefix.ipAddress,
        prefix: activeSamePrefix.prefix,
        hostSuffix: activeSamePrefix.hostSuffix,
        status: activeSamePrefix.status,
        username: dropletRec?.accessUsername || username,
        sshPort: dropletRec?.sshPort || sshPort
      });
    }

    const heldAlloc = existingAllocs.find((a) => a.status === 'held');
    if (heldAlloc) {
      throw createServiceError(
        `Droplet "${cleanDropletId}" currently has a held IPv6 allocation (${heldAlloc.ipAddress}). Call restoreDropletIpAllocations() to reactivate it.`,
        409,
        'IPV6_ALLOCATION_HELD'
      );
    }

    let chosenIpv6 = null;
    let chosenSuffix = null;

    if (explicitMode) {
      const conflict = findInMemoryLiveConflict(explicitTarget, cleanDropletId);
      if (conflict) {
        throw createServiceError(
          `IPv6 address ${explicitTarget} is already ${conflict.status} for droplet "${conflict.dropletId}".`,
          409,
          'IPV6_ALLOCATION_CONFLICT'
        );
      }
      chosenIpv6 = explicitTarget;
      chosenSuffix = extractIpv6Suffix64(explicitTarget);
    } else {
      for (let attempt = 0; attempt < MAX_SUFFIX_ATTEMPTS; attempt += 1) {
        const candidateSuffix = generateDeterministicSuffix64(cleanDropletId, attempt);
        const candidateIp = deriveIpv6FromPrefix(activePrefix, candidateSuffix);
        if (!findInMemoryLiveConflict(candidateIp, cleanDropletId)) {
          chosenIpv6 = candidateIp;
          chosenSuffix = candidateSuffix;
          break;
        }
      }
      if (!chosenIpv6) {
        throw createServiceError(
          `Unable to find an unallocated IPv6 address in prefix ${activePrefix} for droplet "${cleanDropletId}".`,
          503,
          'IPV6_POOL_EXHAUSTED'
        );
      }
    }

    const nowIso = new Date().toISOString();
    const allocId = `ipalloc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    inMemoryAllocations.set(allocId, {
      id: allocId,
      dropletId: cleanDropletId,
      userId,
      nodeId: cleanNodeId,
      ipAddress: chosenIpv6,
      ipVersion: 6,
      prefix: activePrefix,
      hostSuffix: chosenSuffix,
      status: 'active',
      heldAt: null,
      releasedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    });

    const existingDroplet = inMemoryDroplets.get(cleanDropletId);
    const updatedDroplet = {
      id: cleanDropletId,
      userId: userId ?? existingDroplet?.userId ?? null,
      nodeId: cleanNodeId,
      name: existingDroplet?.name || cleanDropletId,
      sshPort: existingDroplet?.sshPort || sshPort,
      accessUsername: existingDroplet?.accessUsername || username,
      status: existingDroplet?.status || 'active',
      ipv6: chosenIpv6,
      ipv6Prefix: activePrefix,
      ipv6HostSuffix: chosenSuffix,
      ipv6LastCheckedAt: nowIso
    };
    inMemoryDroplets.set(cleanDropletId, updatedDroplet);

    return buildAllocationResult({
      allocationId: allocId,
      dropletId: cleanDropletId,
      nodeId: cleanNodeId,
      userId: updatedDroplet.userId,
      ipv6: chosenIpv6,
      prefix: activePrefix,
      hostSuffix: chosenSuffix,
      status: 'active',
      username: updatedDroplet.accessUsername,
      sshPort: updatedDroplet.sshPort
    });
  }

  return runWithTransaction(runner, async (txQuery) => {
    const existingRes = await txQuery(
      `SELECT * FROM system_ip_allocations
       WHERE droplet_id = $1 AND status IN ('active', 'held')
       ORDER BY created_at DESC`,
      [cleanDropletId]
    );
    const existingRows = existingRes.rows || [];
    const activeSame = existingRows.find(
      (r) => r.status === 'active' && r.prefix === activePrefix && (!explicitTarget || r.ip_address === explicitTarget)
    );
    if (activeSame) {
      return buildAllocationResult({
        allocationId: activeSame.id,
        dropletId: cleanDropletId,
        nodeId: cleanNodeId,
        userId: userId ?? activeSame.user_id ?? null,
        ipv6: activeSame.ip_address,
        prefix: activeSame.prefix,
        hostSuffix: activeSame.host_suffix,
        status: activeSame.status,
        username,
        sshPort
      });
    }
    const heldRow = existingRows.find((r) => r.status === 'held');
    if (heldRow) {
      throw createServiceError(
        `Droplet "${cleanDropletId}" currently has a held IPv6 allocation (${heldRow.ip_address}). Call restoreDropletIpAllocations() to reactivate it.`,
        409,
        'IPV6_ALLOCATION_HELD'
      );
    }

    let allocatedRow = null;
    const attempts = explicitMode ? 1 : MAX_SUFFIX_ATTEMPTS;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidateSuffix = explicitMode
        ? extractIpv6Suffix64(explicitTarget)
        : generateDeterministicSuffix64(cleanDropletId, attempt);
      const candidateIp = explicitMode
        ? explicitTarget
        : deriveIpv6FromPrefix(activePrefix, candidateSuffix);

      const conflict = await findPgLiveConflict(txQuery, candidateIp, cleanDropletId);
      if (conflict) {
        if (explicitMode) {
          throw createServiceError(
            `IPv6 address ${candidateIp} is already ${conflict.status} for droplet "${conflict.dropletId}".`,
            409,
            'IPV6_ALLOCATION_CONFLICT'
          );
        }
        continue;
      }

      const allocId = `ipalloc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      try {
        const insertRes = await txQuery(
          `INSERT INTO system_ip_allocations (
             id, droplet_id, user_id, node_id, ip_address, ip_version, prefix, host_suffix, status
           )
           VALUES ($1, $2, $3, $4, $5, 6, $6, $7, 'active')
           RETURNING *`,
          [allocId, cleanDropletId, userId, cleanNodeId, candidateIp, activePrefix, candidateSuffix]
        );
        allocatedRow = insertRes.rows?.[0];
        break;
      } catch (err) {
        if (err?.code === '23505') {
          if (explicitMode) {
            throw createServiceError(
              `IPv6 address ${candidateIp} is already allocated to another active or held service.`,
              409,
              'IPV6_ALLOCATION_CONFLICT'
            );
          }
          continue;
        }
        throw err;
      }
    }

    if (!allocatedRow) {
      throw createServiceError(
        `Unable to allocate a collision-free IPv6 address in prefix ${activePrefix}.`,
        503,
        'IPV6_POOL_EXHAUSTED'
      );
    }

    await txQuery(
      `UPDATE cloud_droplets
       SET ipv6 = $1,
           ipv6_prefix = $2,
           ipv6_host_suffix = $3,
           ipv6_last_checked_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [allocatedRow.ip_address, allocatedRow.prefix, allocatedRow.host_suffix, cleanDropletId]
    );

    return buildAllocationResult({
      allocationId: allocatedRow.id,
      dropletId: cleanDropletId,
      nodeId: cleanNodeId,
      userId: userId ?? allocatedRow.user_id ?? null,
      ipv6: allocatedRow.ip_address,
      prefix: allocatedRow.prefix,
      hostSuffix: allocatedRow.host_suffix,
      status: 'active',
      username,
      sshPort
    });
  });
}

/**
 * Transitions a suspended droplet's active IP allocations to 'held' so its address
 * stays exclusively reserved and cannot be claimed by any other customer or service.
 */
export async function holdDropletIpAllocations({
  dropletId,
  reason = 'suspended',
  queryFn = null
} = {}) {
  const cleanDropletId = sanitizeIdentifier(dropletId, 'dropletId', 64);
  const runner = getQueryRunner(queryFn);
  const nowIso = new Date().toISOString();

  if (!runner.active) {
    const heldAddresses = [];
    for (const alloc of inMemoryAllocations.values()) {
      if (alloc.dropletId === cleanDropletId && alloc.status === 'active') {
        alloc.status = 'held';
        alloc.heldAt = nowIso;
        alloc.updatedAt = nowIso;
        heldAddresses.push({ ...alloc });
      } else if (alloc.dropletId === cleanDropletId && alloc.status === 'held') {
        heldAddresses.push({ ...alloc });
      }
    }
    const droplet = inMemoryDroplets.get(cleanDropletId);
    if (droplet) {
      droplet.status = 'suspended';
      droplet.routingDisabled = true;
    }
    if (heldAddresses.length > 0) {
      await recordAuditEvent({
        nodeId: heldAddresses[0].nodeId,
        dropletId: cleanDropletId,
        userId: heldAddresses[0].userId,
        eventType: 'allocation_held',
        oldIpv6: heldAddresses[0].ipAddress,
        newIpv6: heldAddresses[0].ipAddress,
        details: { reason }
      });
    }
    return {
      dropletId: cleanDropletId,
      status: 'held',
      routingDisabled: true,
      heldAddresses
    };
  }

  await ensureIpv6PoolSchema({ queryFn: runner.query });
  return runWithTransaction(runner, async (txQuery) => {
    const { rows } = await txQuery(
      `UPDATE system_ip_allocations
       SET status = 'held',
           held_at = COALESCE(held_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE droplet_id = $1 AND status IN ('active', 'held')
       RETURNING *`,
      [cleanDropletId]
    );
    const heldAddresses = (rows || []).map(formatAllocationRow);
    if (heldAddresses.length > 0) {
      await recordAuditEvent({
        query: txQuery,
        nodeId: heldAddresses[0].nodeId,
        dropletId: cleanDropletId,
        userId: heldAddresses[0].userId,
        eventType: 'allocation_held',
        oldIpv6: heldAddresses[0].ipAddress,
        newIpv6: heldAddresses[0].ipAddress,
        details: { reason }
      });
    }
    return {
      dropletId: cleanDropletId,
      status: 'held',
      routingDisabled: true,
      heldAddresses
    };
  });
}

/**
 * Restores a reactivated droplet's 'held' IP allocation back to 'active' with
 * its exact previously assigned address intact.
 */
export async function restoreDropletIpAllocations({
  dropletId,
  sshPort = 22,
  username = 'root',
  queryFn = null
} = {}) {
  const cleanDropletId = sanitizeIdentifier(dropletId, 'dropletId', 64);
  const runner = getQueryRunner(queryFn);
  const nowIso = new Date().toISOString();

  if (!runner.active) {
    const restored = [];
    for (const alloc of inMemoryAllocations.values()) {
      if (alloc.dropletId === cleanDropletId && LIVE_ALLOCATION_STATUSES.has(alloc.status)) {
        const conflict = findInMemoryLiveConflict(alloc.ipAddress, cleanDropletId);
        if (conflict) {
          throw createServiceError(
            `Cannot restore IPv6 ${alloc.ipAddress} for droplet "${cleanDropletId}"; held by "${conflict.dropletId}".`,
            409,
            'IPV6_ALLOCATION_CONFLICT'
          );
        }
        alloc.status = 'active';
        alloc.heldAt = null;
        alloc.updatedAt = nowIso;
        restored.push({ ...alloc });
      }
    }
    if (restored.length === 0) {
      throw createServiceError(
        `No held or active IPv6 allocation found for droplet "${cleanDropletId}".`,
        404,
        'IPV6_ALLOCATION_NOT_FOUND'
      );
    }
    const primary = restored[0];
    const droplet = inMemoryDroplets.get(cleanDropletId);
    if (droplet) {
      droplet.status = 'active';
      droplet.routingDisabled = false;
      droplet.ipv6 = primary.ipAddress;
      droplet.ipv6Prefix = primary.prefix;
      droplet.ipv6HostSuffix = primary.hostSuffix;
    }
    await recordAuditEvent({
      nodeId: primary.nodeId,
      dropletId: cleanDropletId,
      userId: primary.userId,
      eventType: 'allocation_restored',
      oldIpv6: primary.ipAddress,
      newIpv6: primary.ipAddress
    });
    return {
      dropletId: cleanDropletId,
      status: 'active',
      routingDisabled: false,
      ipv6: primary.ipAddress,
      prefix: primary.prefix,
      hostSuffix: primary.hostSuffix,
      sshCommand: formatIpv6SshCommand({
        ipv6: primary.ipAddress,
        username: droplet?.accessUsername || username,
        port: droplet?.sshPort || sshPort
      }),
      restoredAddresses: restored
    };
  }

  await ensureIpv6PoolSchema({ queryFn: runner.query });
  return runWithTransaction(runner, async (txQuery) => {
    const { rows } = await txQuery(
      `UPDATE system_ip_allocations
       SET status = 'active',
           held_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE droplet_id = $1 AND status IN ('held', 'active')
       RETURNING *`,
      [cleanDropletId]
    );
    const restored = (rows || []).map(formatAllocationRow);
    if (restored.length === 0) {
      throw createServiceError(
        `No held or active IPv6 allocation found for droplet "${cleanDropletId}".`,
        404,
        'IPV6_ALLOCATION_NOT_FOUND'
      );
    }
    const primary = restored[0];
    await txQuery(
      `UPDATE cloud_droplets
       SET ipv6 = $1,
           ipv6_prefix = $2,
           ipv6_host_suffix = $3,
           ipv6_last_checked_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [primary.ipAddress, primary.prefix, primary.hostSuffix, cleanDropletId]
    );
    await recordAuditEvent({
      query: txQuery,
      nodeId: primary.nodeId,
      dropletId: cleanDropletId,
      userId: primary.userId,
      eventType: 'allocation_restored',
      oldIpv6: primary.ipAddress,
      newIpv6: primary.ipAddress
    });
    return {
      dropletId: cleanDropletId,
      status: 'active',
      routingDisabled: false,
      ipv6: primary.ipAddress,
      prefix: primary.prefix,
      hostSuffix: primary.hostSuffix,
      sshCommand: formatIpv6SshCommand({ ipv6: primary.ipAddress, username, port: sshPort }),
      restoredAddresses: restored
    };
  });
}

/**
 * Permanently releases a deleted/purged droplet's IP allocations back into the pool.
 */
export async function releaseDropletIpAllocations({
  dropletId,
  reason = 'deleted',
  queryFn = null
} = {}) {
  const cleanDropletId = sanitizeIdentifier(dropletId, 'dropletId', 64);
  const runner = getQueryRunner(queryFn);
  const nowIso = new Date().toISOString();

  if (!runner.active) {
    const releasedAddresses = [];
    for (const alloc of inMemoryAllocations.values()) {
      if (alloc.dropletId === cleanDropletId && LIVE_ALLOCATION_STATUSES.has(alloc.status)) {
        alloc.status = 'released';
        alloc.releasedAt = nowIso;
        alloc.updatedAt = nowIso;
        releasedAddresses.push({ ...alloc });
      }
    }
    const droplet = inMemoryDroplets.get(cleanDropletId);
    if (droplet) {
      droplet.status = 'deleted';
      droplet.ipv6 = null;
      droplet.ipv6Prefix = null;
      droplet.ipv6HostSuffix = null;
    }
    if (releasedAddresses.length > 0) {
      await recordAuditEvent({
        nodeId: releasedAddresses[0].nodeId,
        dropletId: cleanDropletId,
        userId: releasedAddresses[0].userId,
        eventType: 'allocation_released',
        oldIpv6: releasedAddresses[0].ipAddress,
        details: { reason }
      });
    }
    return {
      dropletId: cleanDropletId,
      status: 'released',
      releasedAddresses
    };
  }

  await ensureIpv6PoolSchema({ queryFn: runner.query });
  return runWithTransaction(runner, async (txQuery) => {
    const { rows } = await txQuery(
      `UPDATE system_ip_allocations
       SET status = 'released',
           released_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE droplet_id = $1 AND status IN ('active', 'held')
       RETURNING *`,
      [cleanDropletId]
    );
    await txQuery(
      `UPDATE cloud_droplets
       SET ipv6 = NULL,
           ipv6_prefix = NULL,
           ipv6_host_suffix = NULL
       WHERE id = $1`,
      [cleanDropletId]
    );
    const releasedAddresses = (rows || []).map(formatAllocationRow);
    if (releasedAddresses.length > 0) {
      await recordAuditEvent({
        query: txQuery,
        nodeId: releasedAddresses[0].nodeId,
        dropletId: cleanDropletId,
        userId: releasedAddresses[0].userId,
        eventType: 'allocation_released',
        oldIpv6: releasedAddresses[0].ipAddress,
        details: { reason }
      });
    }
    return {
      dropletId: cleanDropletId,
      status: 'released',
      releasedAddresses
    };
  });
}

/**
 * Renders the Server IPv6 Changed email using Tiwlo's branded HTML email template wrapper.
 */
export function renderServerIpv6ChangedEmail({
  to,
  name = 'Tiwlo Cloud customer',
  nodeId,
  dropletId,
  dropletName,
  oldIpv6,
  newIpv6,
  oldPrefix = null,
  newPrefix = null,
  sshCommand = null,
  reason = 'prefix_changed',
  dashboardUrl = getPlatformUrl('cloud')
} = {}) {
  const safeName = escapeHtml(name || 'Tiwlo Cloud customer');
  const safeDroplet = escapeHtml(dropletName || dropletId || 'Cloud Server');
  const safeNode = escapeHtml(nodeId || 'primary-ubuntu-node');
  const safeOldIp = escapeHtml(oldIpv6 || 'Unassigned');
  const safeNewIp = escapeHtml(newIpv6 || '');
  const safeReasonLabel = reason === 'ipv6_unreachable'
    ? 'Unreachable IPv6 Replacement'
    : 'Host IPv6 Prefix Renewal';
  const resolvedSsh = sshCommand || (newIpv6 ? formatIpv6SshCommand({ ipv6: newIpv6 }) : '');
  const safeSsh = escapeHtml(resolvedSsh);
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  const introText = reason === 'ipv6_unreachable'
    ? `Hello ${safeName}, our network health monitor detected that the previous IPv6 address on <strong>${safeDroplet}</strong> became unreachable and automatically assigned a healthy replacement address.`
    : `Hello ${safeName}, the upstream IPv6 prefix on host node <strong>${safeNode}</strong> changed. We automatically updated the IPv6 address for <strong>${safeDroplet}</strong> and synchronized matching DNS AAAA records.`;

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Server IPv6 address updated
    </h1>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      ${introText}
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #dadce0; border-radius: 8px; margin: 20px 0; border-collapse: separate;">
      <tr>
        <td style="padding: 18px 20px; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
          <div style="font-size: 15px; font-weight: 500; color: #202124; margin-bottom: 12px; line-height: 20px;">
            ${safeDroplet}
          </div>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 22px;">
            <tr>
              <td style="padding: 4px 0; color: #70757a; width: 115px; vertical-align: top;">Reason</td>
              <td style="padding: 4px 0; color: #202124;">${safeReasonLabel}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #70757a; width: 115px; vertical-align: top;">Host node</td>
              <td style="padding: 4px 0; color: #202124; font-family: 'Google Sans', Roboto, Consolas, monospace;">${safeNode}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #70757a; width: 115px; vertical-align: top;">Previous IPv6</td>
              <td style="padding: 4px 0; color: #5f6368; font-family: 'Google Sans', Roboto, Consolas, monospace; word-break: break-all;">${safeOldIp}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #70757a; width: 115px; vertical-align: top;">New IPv6</td>
              <td style="padding: 4px 0; color: #137333; font-weight: 500; font-family: 'Google Sans', Roboto, Consolas, monospace; word-break: break-all;">${safeNewIp}</td>
            </tr>
            ${oldPrefix && newPrefix ? `
            <tr>
              <td style="padding: 4px 0; color: #70757a; width: 115px; vertical-align: top;">Prefix</td>
              <td style="padding: 4px 0; color: #202124; font-family: 'Google Sans', Roboto, Consolas, monospace; word-break: break-all;">${escapeHtml(newPrefix)}</td>
            </tr>` : ''}
            ${safeSsh ? `
            <tr>
              <td style="padding: 4px 0; color: #70757a; width: 115px; vertical-align: top;">SSH command</td>
              <td style="padding: 4px 0; color: #202124; font-family: 'Google Sans', Roboto, Consolas, monospace; word-break: break-all;">${safeSsh}</td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${safeDashboardUrl}" target="_blank" rel="noopener" style="background-color: #137333; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 24px; border-radius: 4px; display: inline-block; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
            Open Cloud Dashboard
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        Any platform-managed AAAA DNS records pointing to your previous IPv6 address were updated automatically. If you configured external DNS providers or firewall allowlists, please update them to ${safeNewIp}.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: `Server IPv6 updated: ${dropletName || dropletId || 'Cloud Server'}`,
    recipientEmail: to,
    contentHtml,
    preheader: `${dropletName || dropletId || 'Your server'} now uses IPv6 ${newIpv6}.`
  });
}

async function defaultSyncDnsAaaaRecords({ oldIpv6, newIpv6, userId = null, runner }) {
  if (!oldIpv6 || !newIpv6 || oldIpv6 === newIpv6) {
    return { updatedCount: 0, records: [] };
  }

  if (!runner.active) {
    const updated = [];
    for (const rec of inMemoryDnsRecords.values()) {
      if (
        rec.type === 'AAAA' &&
        rec.content.toLowerCase() === oldIpv6.toLowerCase() &&
        (!userId || !rec.userId || rec.userId === userId)
      ) {
        rec.content = newIpv6;
        rec.updatedAt = new Date().toISOString();
        updated.push({ ...rec });
      }
    }
    return { updatedCount: updated.length, records: updated };
  }

  const updatedRecords = [];
  const tableTargets = [
    {
      table: 'system_platform_dns_records',
      sql: `UPDATE system_platform_dns_records
            SET content = $2, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(type) = 'AAAA'
              AND LOWER(content) = LOWER($1)
              AND COALESCE(is_system, FALSE) = FALSE
            RETURNING id, zone, name, content`,
      params: [oldIpv6, newIpv6]
    },
    ...(userId
      ? [
          {
            table: 'system_free_subdomain_records',
            sql: `UPDATE system_free_subdomain_records r
                  SET value = $2
                  FROM system_free_subdomains s
                  WHERE r.subdomain_id = s.id
                    AND s.user_id = $3
                    AND UPPER(r.type) = 'AAAA'
                    AND LOWER(r.value) = LOWER($1)
                  RETURNING r.id, r.subdomain_id, r.name, r.value AS content`,
            params: [oldIpv6, newIpv6, String(userId)]
          }
        ]
      : [
          {
            table: 'system_free_subdomain_records',
            sql: `UPDATE system_free_subdomain_records
                  SET value = $2
                  WHERE UPPER(type) = 'AAAA' AND LOWER(value) = LOWER($1)
                  RETURNING id, subdomain_id, name, value AS content`,
            params: [oldIpv6, newIpv6]
          }
        ]),
    {
      table: 'dns_records',
      sql: `UPDATE dns_records
            SET content = $2, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(type) = 'AAAA' AND LOWER(content) = LOWER($1)
            RETURNING id, name, content`,
      params: [oldIpv6, newIpv6]
    }
  ];

  for (const target of tableTargets) {
    try {
      const res = await runner.query(target.sql, target.params);
      for (const row of res.rows || []) {
        updatedRecords.push({ table: target.table, ...row });
      }
    } catch (err) {
      // Ignore missing optional tables (PostgreSQL undefined_table 42P01).
      if (err?.code !== '42P01') {
        throw err;
      }
    }
  }

  return { updatedCount: updatedRecords.length, records: updatedRecords };
}

async function defaultInsertDashboardNotification({
  userId,
  dropletId,
  dropletName,
  nodeId,
  oldIpv6,
  newIpv6,
  oldPrefix,
  newPrefix,
  sshCommand,
  reason,
  runner
}) {
  if (!userId) return null;

  const id = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const title = 'Server IPv6 Address Updated';
  const snippet = `${dropletName || dropletId}: ${oldIpv6} -> ${newIpv6}`;
  const content = reason === 'ipv6_unreachable'
    ? `Unreachable IPv6 on ${dropletName || dropletId} was replaced (${oldIpv6} -> ${newIpv6}). Connect with: ${sshCommand}`
    : `Host node ${nodeId} IPv6 prefix changed. ${dropletName || dropletId} moved from ${oldIpv6} to ${newIpv6}. Connect with: ${sshCommand}`;
  const meta = {
    nodeId,
    dropletId,
    dropletName,
    oldIpv6,
    newIpv6,
    oldPrefix,
    newPrefix,
    reason,
    sshCommand
  };

  if (!runner.active) {
    const notif = {
      id,
      recipientId: userId,
      senderId: null,
      type: 'server_ipv6_changed',
      title,
      content,
      snippet,
      entityId: dropletId,
      meta,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    inMemoryNotifications.unshift(notif);
    return notif;
  }

  await runner.query(
    `INSERT INTO social_notifications
       (id, recipient_id, sender_id, type, content, entity_id, title, snippet, meta, is_read, created_at)
     VALUES ($1, $2, NULL, 'server_ipv6_changed', $3, $4, $5, $6, $7::jsonb, FALSE, CURRENT_TIMESTAMP)`,
    [id, userId, content, dropletId, title, snippet, JSON.stringify(meta)]
  );
  return {
    id,
    recipientId: userId,
    type: 'server_ipv6_changed',
    title,
    content,
    snippet,
    entityId: dropletId,
    meta
  };
}

async function resolveNotificationRecipient(userId, { resolveUserFn = null, runner }) {
  if (!userId) return null;
  if (typeof resolveUserFn === 'function') {
    return resolveUserFn(userId);
  }
  if (!runner.active) {
    return inMemoryUsers.get(userId) || null;
  }
  const { rows } = await runner.query(
    'SELECT id, email, name, store_name FROM system_users WHERE id = $1 LIMIT 1',
    [userId]
  );
  if (!rows?.[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    name: rows[0].name || rows[0].store_name || 'Tiwlo Cloud customer'
  };
}

async function loadNodeDropletsAndAllocations(nodeId, runner) {
  if (!runner.active) {
    const map = new Map();
    for (const droplet of inMemoryDroplets.values()) {
      if (droplet.nodeId === nodeId && droplet.status !== 'deleted') {
        map.set(droplet.id, { ...droplet });
      }
    }
    for (const alloc of inMemoryAllocations.values()) {
      if (alloc.nodeId === nodeId && LIVE_ALLOCATION_STATUSES.has(alloc.status)) {
        const existing = map.get(alloc.dropletId) || {
          id: alloc.dropletId,
          userId: alloc.userId,
          nodeId: alloc.nodeId,
          name: alloc.dropletId,
          sshPort: 22,
          accessUsername: 'root',
          status: alloc.status === 'held' ? 'suspended' : 'active'
        };
        existing.ipv6 = alloc.ipAddress;
        existing.ipv6Prefix = alloc.prefix;
        existing.ipv6HostSuffix = alloc.hostSuffix;
        existing.allocationId = alloc.id;
        existing.allocationStatus = alloc.status;
        map.set(alloc.dropletId, existing);
      }
    }
    return [...map.values()];
  }

  const dropletRes = await runner.query(
    `SELECT id, user_id, name, ssh_port, access_username, status, node_id,
            ipv6, ipv6_prefix, ipv6_host_suffix
     FROM cloud_droplets
     WHERE node_id = $1`,
    [nodeId]
  );
  const allocRes = await runner.query(
    `SELECT * FROM system_ip_allocations
     WHERE node_id = $1 AND status IN ('active', 'held')
     ORDER BY created_at DESC`,
    [nodeId]
  );

  const map = new Map();
  for (const row of dropletRes.rows || []) {
    map.set(row.id, {
      id: row.id,
      userId: row.user_id || null,
      nodeId: row.node_id,
      name: row.name || row.id,
      sshPort: Number(row.ssh_port || 22),
      accessUsername: row.access_username || 'root',
      status: row.status || 'active',
      ipv6: row.ipv6 || null,
      ipv6Prefix: row.ipv6_prefix || null,
      ipv6HostSuffix: row.ipv6_host_suffix || null
    });
  }
  for (const row of allocRes.rows || []) {
    const existing = map.get(row.droplet_id) || {
      id: row.droplet_id,
      userId: row.user_id || null,
      nodeId: row.node_id,
      name: row.droplet_id,
      sshPort: 22,
      accessUsername: 'root',
      status: row.status === 'held' ? 'suspended' : 'active'
    };
    existing.ipv6 = row.ip_address;
    existing.ipv6Prefix = row.prefix;
    existing.ipv6HostSuffix = row.host_suffix;
    existing.allocationId = row.id;
    existing.allocationStatus = row.status;
    map.set(row.droplet_id, existing);
  }
  return [...map.values()];
}

async function computeNonCollidingIpv6({
  dropletId,
  targetPrefix,
  preferredSuffix = null,
  excludeIp = null,
  excludeIps = null,
  runner
}) {
  if (preferredSuffix) {
    const candidateIp = deriveIpv6FromPrefix(targetPrefix, preferredSuffix);
    if (candidateIp !== excludeIp && (!excludeIps || !excludeIps.has(candidateIp))) {
      const conflict = runner.active
        ? await findPgLiveConflict(runner.query, candidateIp, dropletId)
        : findInMemoryLiveConflict(candidateIp, dropletId);
      if (!conflict) {
        return { ipv6: candidateIp, hostSuffix: preferredSuffix };
      }
    }
  }

  for (let attempt = 0; attempt < MAX_SUFFIX_ATTEMPTS; attempt += 1) {
    const candidateSuffix = generateDeterministicSuffix64(dropletId, attempt);
    const candidateIp = deriveIpv6FromPrefix(targetPrefix, candidateSuffix);
    if (candidateIp === excludeIp || (excludeIps && excludeIps.has(candidateIp))) continue;
    const conflict = runner.active
      ? await findPgLiveConflict(runner.query, candidateIp, dropletId)
      : findInMemoryLiveConflict(candidateIp, dropletId);
    if (!conflict) {
      return { ipv6: candidateIp, hostSuffix: candidateSuffix };
    }
  }

  throw createServiceError(
    `Unable to derive a collision-free replacement IPv6 in prefix ${targetPrefix} for "${dropletId}".`,
    503,
    'IPV6_POOL_EXHAUSTED'
  );
}

/**
 * Reconciles a node's active global IPv6 prefix (after ISP reset, router reboot, or NIC renewal)
 * and optionally probes droplet reachability. Atomically updates affected droplets preserving
 * host suffixes on prefix change (or generating a fresh suffix if a single IP is unreachable),
 * syncs DNS AAAA records, inserts `social_notifications`, and sends branded Tiwlo emails.
 */
export async function reconcileNodeIpv6PrefixChange({
  nodeId,
  newIpv6Address = null,
  newPrefix = null,
  gateway = null,
  sendEmailFn = sendTiwloEmail,
  notifyUserFn = null,
  notifyFn = null,
  dnsUpdaterFn = null,
  checkIpv6ReachabilityFn = null,
  reachabilityFn = null,
  resolveUserFn = null,
  queryFn = null
} = {}) {
  const cleanNodeId = sanitizeIdentifier(nodeId, 'nodeId');
  const runner = getQueryRunner(queryFn);
  const notify = notifyUserFn || notifyFn || null;
  const checkReachability = checkIpv6ReachabilityFn || reachabilityFn || null;

  if (runner.active) {
    await ensureIpv6PoolSchema({ queryFn: runner.query });
  }

  const existingPool = await getNodeIpv6Pool(cleanNodeId, { queryFn: runner.query });
  const rawAddressInput = newIpv6Address || newPrefix || existingPool?.prefix;
  if (!rawAddressInput) {
    throw createServiceError(
      `No new IPv6 address or existing pool prefix available for node "${cleanNodeId}".`,
      400,
      'INVALID_IPV6_PREFIX'
    );
  }

  const targetPrefix = extractIpv6Prefix64(rawAddressInput);
  const oldPrefix = existingPool?.prefix || null;
  const prefixChanged = Boolean(oldPrefix && oldPrefix !== targetPrefix);
  const cleanGateway = gateway ? normalizeIpv6(gateway) : existingPool?.gateway || null;

  const droplets = await loadNodeDropletsAndAllocations(cleanNodeId, runner);
  const plannedChanges = [];
  const plannedNewIps = new Set();

  for (const droplet of droplets) {
    if (!droplet.ipv6 && !droplet.ipv6HostSuffix) continue;

    const currentPrefix = droplet.ipv6Prefix || (droplet.ipv6 ? extractIpv6Prefix64(droplet.ipv6) : null);
    const dropletPrefixMismatch = Boolean(currentPrefix && currentPrefix !== targetPrefix);

    if (prefixChanged || dropletPrefixMismatch) {
      const preservedSuffix = droplet.ipv6HostSuffix || extractIpv6Suffix64(droplet.ipv6);
      const next = await computeNonCollidingIpv6({
        dropletId: droplet.id,
        targetPrefix,
        preferredSuffix: preservedSuffix,
        excludeIps: plannedNewIps,
        runner
      });
      if (next.ipv6 !== droplet.ipv6) {
        plannedNewIps.add(next.ipv6);
        plannedChanges.push({
          droplet,
          reason: 'prefix_changed',
          oldIpv6: droplet.ipv6,
          newIpv6: next.ipv6,
          oldPrefix: currentPrefix || oldPrefix,
          newPrefix: targetPrefix,
          newSuffix: next.hostSuffix
        });
      }
      continue;
    }

    if (checkReachability && droplet.allocationStatus !== 'held' && droplet.status !== 'suspended' && droplet.ipv6) {
      const checkResult = await checkReachability({
        nodeId: cleanNodeId,
        droplet,
        ipv6: droplet.ipv6
      });
      const isReachable = typeof checkResult === 'boolean'
        ? checkResult
        : checkResult?.reachable !== false;

      if (!isReachable) {
        const next = await computeNonCollidingIpv6({
          dropletId: droplet.id,
          targetPrefix,
          preferredSuffix: null,
          excludeIp: droplet.ipv6,
          excludeIps: plannedNewIps,
          runner
        });
        plannedNewIps.add(next.ipv6);
        plannedChanges.push({
          droplet,
          reason: 'ipv6_unreachable',
          oldIpv6: droplet.ipv6,
          newIpv6: next.ipv6,
          oldPrefix: currentPrefix || targetPrefix,
          newPrefix: targetPrefix,
          newSuffix: next.hostSuffix
        });
      }
    }
  }

  if (!prefixChanged && plannedChanges.length === 0) {
    await registerNodeIpv6Pool({
      nodeId: cleanNodeId,
      prefix: targetPrefix,
      gateway: cleanGateway,
      queryFn: runner.query
    });
    return {
      changed: false,
      deduplicated: Boolean(oldPrefix === targetPrefix),
      nodeId: cleanNodeId,
      oldPrefix,
      newPrefix: targetPrefix,
      updatedDroplets: [],
      dnsUpdates: [],
      notifications: [],
      emails: []
    };
  }

  // Persist pool + droplet + allocation updates atomically.
  const nowIso = new Date().toISOString();
  if (!runner.active) {
    inMemoryPools.set(cleanNodeId, {
      nodeId: cleanNodeId,
      prefix: targetPrefix,
      prefixLen: 64,
      gateway: cleanGateway,
      lastSeenAt: nowIso,
      updatedAt: nowIso
    });
    for (const change of plannedChanges) {
      const { droplet, newIpv6, newPrefix: nextPrefix, newSuffix, reason } = change;
      const dropletRec = inMemoryDroplets.get(droplet.id);
      if (dropletRec) {
        dropletRec.ipv6 = newIpv6;
        dropletRec.ipv6Prefix = nextPrefix;
        dropletRec.ipv6HostSuffix = newSuffix;
        dropletRec.ipv6LastCheckedAt = nowIso;
      }

      if (reason === 'ipv6_unreachable' && droplet.allocationId) {
        const oldAlloc = inMemoryAllocations.get(droplet.allocationId);
        if (oldAlloc) {
          oldAlloc.status = 'released';
          oldAlloc.releasedAt = nowIso;
          oldAlloc.updatedAt = nowIso;
        }
        const nextAllocId = `ipalloc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        inMemoryAllocations.set(nextAllocId, {
          id: nextAllocId,
          dropletId: droplet.id,
          userId: droplet.userId,
          nodeId: cleanNodeId,
          ipAddress: newIpv6,
          ipVersion: 6,
          prefix: nextPrefix,
          hostSuffix: newSuffix,
          status: 'active',
          heldAt: null,
          releasedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      } else if (droplet.allocationId && inMemoryAllocations.has(droplet.allocationId)) {
        const alloc = inMemoryAllocations.get(droplet.allocationId);
        alloc.ipAddress = newIpv6;
        alloc.prefix = nextPrefix;
        alloc.hostSuffix = newSuffix;
        alloc.updatedAt = nowIso;
      }
    }
  } else {
    await runWithTransaction(runner, async (txQuery) => {
      await txQuery(
        `INSERT INTO system_node_ipv6_pools (node_id, prefix, prefix_len, gateway, last_seen_at, updated_at)
         VALUES ($1, $2, 64, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (node_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           gateway = COALESCE(EXCLUDED.gateway, system_node_ipv6_pools.gateway),
           last_seen_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [cleanNodeId, targetPrefix, cleanGateway]
      );

      for (const change of plannedChanges) {
        const { droplet, newIpv6, newPrefix: nextPrefix, newSuffix, reason } = change;

        if (reason === 'ipv6_unreachable' && droplet.allocationId) {
          await txQuery(
            `UPDATE system_ip_allocations
             SET status = 'released', released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [droplet.allocationId]
          );
          const nextAllocId = `ipalloc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
          await txQuery(
            `INSERT INTO system_ip_allocations (
               id, droplet_id, user_id, node_id, ip_address, ip_version, prefix, host_suffix, status
             )
             VALUES ($1, $2, $3, $4, $5, 6, $6, $7, 'active')`,
            [nextAllocId, droplet.id, droplet.userId, cleanNodeId, newIpv6, nextPrefix, newSuffix]
          );
        } else if (droplet.allocationId) {
          await txQuery(
            `UPDATE system_ip_allocations
             SET ip_address = $1, prefix = $2, host_suffix = $3, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [newIpv6, nextPrefix, newSuffix, droplet.allocationId]
          );
        }

        await txQuery(
          `UPDATE cloud_droplets
           SET ipv6 = $1,
               ipv6_prefix = $2,
               ipv6_host_suffix = $3,
               ipv6_last_checked_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [newIpv6, nextPrefix, newSuffix, droplet.id]
        );
      }
    });
  }

  const updatedDroplets = [];
  const dnsUpdates = [];
  const notifications = [];
  const emails = [];

  for (const change of plannedChanges) {
    const { droplet, reason, oldIpv6, newIpv6, oldPrefix: prevPrefix, newPrefix: nextPrefix, newSuffix } = change;
    const sshCommand = formatIpv6SshCommand({
      ipv6: newIpv6,
      username: droplet.accessUsername || 'root',
      port: droplet.sshPort || 22
    });

    const dedupKey = `ipv6_change:${cleanNodeId}:${droplet.id}:${oldIpv6}->${newIpv6}`;
    const alreadyAlerted = runner.active
      ? Boolean((await runner.query(
        'SELECT 1 FROM system_ipv6_change_events WHERE dedup_key = $1 LIMIT 1',
        [dedupKey]
      )).rows?.length)
      : inMemoryDedupKeys.has(dedupKey);

    let dnsResult = { updatedCount: 0, records: [] };
    if (typeof dnsUpdaterFn === 'function') {
      const customDns = await dnsUpdaterFn({
        nodeId: cleanNodeId,
        dropletId: droplet.id,
        userId: droplet.userId,
        oldIpv6,
        newIpv6,
        reason
      });
      dnsResult = {
        updatedCount: Number(customDns?.updatedCount ?? (Array.isArray(customDns) ? customDns.length : 1)),
        records: customDns?.records || (Array.isArray(customDns) ? customDns : [customDns])
      };
    } else {
      dnsResult = await defaultSyncDnsAaaaRecords({
        oldIpv6,
        newIpv6,
        userId: droplet.userId,
        runner
      });
    }
    dnsUpdates.push({ dropletId: droplet.id, oldIpv6, newIpv6, ...dnsResult });

    let notifiedDashboard = false;
    let notifiedEmail = false;

    if (!alreadyAlerted) {
      const notifPayload = {
        userId: droplet.userId,
        dropletId: droplet.id,
        dropletName: droplet.name,
        nodeId: cleanNodeId,
        oldIpv6,
        newIpv6,
        oldPrefix: prevPrefix,
        newPrefix: nextPrefix,
        sshCommand,
        reason
      };

      if (typeof notify === 'function') {
        const res = await notify({
          ...notifPayload,
          type: 'server_ipv6_changed'
        });
        if (res !== false) {
          notifiedDashboard = true;
          notifications.push(res || { ...notifPayload, type: 'server_ipv6_changed' });
        }
      } else {
        const insertedNotif = await defaultInsertDashboardNotification({ ...notifPayload, runner });
        if (insertedNotif) {
          notifiedDashboard = true;
          notifications.push(insertedNotif);
        }
      }

      const recipient = await resolveNotificationRecipient(droplet.userId, { resolveUserFn, runner });
      if (recipient?.email && typeof sendEmailFn === 'function') {
        const html = renderServerIpv6ChangedEmail({
          to: recipient.email,
          name: recipient.name,
          nodeId: cleanNodeId,
          dropletId: droplet.id,
          dropletName: droplet.name,
          oldIpv6,
          newIpv6,
          oldPrefix: prevPrefix,
          newPrefix: nextPrefix,
          sshCommand,
          reason
        });
        const subject = stripEmailHeaderCrlf(`Server IPv6 updated for ${droplet.name || droplet.id}`);
        const text = `Your server ${droplet.name || droplet.id} IPv6 changed from ${oldIpv6} to ${newIpv6}. Connect with: ${sshCommand}`;
        try {
          const emailRes = await sendEmailFn({
            to: recipient.email,
            subject,
            html,
            text,
            type: 'server_ipv6_changed',
            metadata: {
              nodeId: cleanNodeId,
              dropletId: droplet.id,
              oldIpv6,
              newIpv6,
              reason
            }
          });
          notifiedEmail = emailRes?.success !== false;
          emails.push({ dropletId: droplet.id, to: recipient.email, subject, html, result: emailRes });
        } catch (err) {
          emails.push({ dropletId: droplet.id, to: recipient.email, subject, error: err.message });
        }
      }

      await recordAuditEvent({
        query: runner.active ? runner.query : null,
        nodeId: cleanNodeId,
        dropletId: droplet.id,
        userId: droplet.userId,
        eventType: reason,
        oldPrefix: prevPrefix,
        newPrefix: nextPrefix,
        oldIpv6,
        newIpv6,
        dnsUpdatedCount: dnsResult.updatedCount,
        notifiedDashboard,
        notifiedEmail,
        dedupKey,
        details: { sshCommand }
      });
    }

    updatedDroplets.push({
      dropletId: droplet.id,
      userId: droplet.userId,
      nodeId: cleanNodeId,
      reason,
      oldIpv6,
      newIpv6,
      oldPrefix: prevPrefix,
      newPrefix: nextPrefix,
      hostSuffix: newSuffix,
      sshCommand
    });
  }

  return {
    changed: true,
    deduplicated: false,
    nodeId: cleanNodeId,
    oldPrefix,
    newPrefix: targetPrefix,
    updatedDroplets,
    dnsUpdates,
    notifications,
    emails
  };
}
