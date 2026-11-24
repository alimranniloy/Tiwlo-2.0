import { randomUUID } from 'node:crypto';
import { isPgActive, queryPg } from '../db/postgres.js';
import { holdDropletIpAllocations } from '../ubuntu/ipv6PoolService.js';
import { setDropletPowerOnHost } from '../ubuntu/hostProvisionerClient.js';
import { enforceUserAccountHold, HOLD_TYPES } from './accountLifecycleEnforcer.js';

export const DEFAULT_BLOCKED_ABUSE_PORTS = Object.freeze([25, 465, 587]);
export const MINER_STRATUM_PORTS = Object.freeze([3333, 4444, 5555, 7777, 9999, 14433, 14444]);

export const VPS_ABUSE_THRESHOLDS = Object.freeze({
  SMTP_ATTEMPTS_PER_MIN: 40,
  OUTBOUND_CONNECTIONS_PER_MIN: 500,
  MINER_CPU_PCT: 98,
  MINER_HIGH_CPU_MINUTES: 30,
  MINER_CORROBORATING_CONNECTIONS_PER_MIN: 100
});

export const VPS_ABUSE_RULE_TYPES = Object.freeze({
  SMTP_SPAM_EGRESS: 'smtp_spam_egress',
  CRYPTO_MINER_SUSPECTED: 'crypto_miner_suspected',
  OUTBOUND_FLOOD_SCAN: 'outbound_flood_scan'
});

const BLOCKED_SMTP_PORT_SET = new Set(DEFAULT_BLOCKED_ABUSE_PORTS);
const MINER_STRATUM_PORT_SET = new Set(MINER_STRATUM_PORTS);

export const VPS_ABUSE_GUARD_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS system_vps_abuse_events (
    id VARCHAR(64) PRIMARY KEY,
    droplet_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64),
    rule_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_taken VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_vps_abuse_events_droplet
    ON system_vps_abuse_events(droplet_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_vps_abuse_events_user
    ON system_vps_abuse_events(user_id, created_at DESC);
`;

const memoryAbuseEvents = [];
const memoryNotifications = [];
let schemaEnsured = false;

function createGuardError(message, statusCode = 400, code = 'VPS_ABUSE_GUARD_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function toNonNegativeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizePortList(ports) {
  if (!ports) return [];
  const rawList = Array.isArray(ports)
    ? ports
    : ports instanceof Set
      ? [...ports]
      : typeof ports === 'string'
        ? ports.split(/[\s,;]+/)
        : [];
  if (rawList.length === 0) return [];
  const seen = new Set();
  for (const item of rawList) {
    const rawStr = String(item ?? '').trim().toLowerCase().replace(/^tcp\/|^udp\//, '');
    if (!rawStr) continue;
    const port = rawStr.startsWith('0x') ? Number.parseInt(rawStr, 16) : Number(rawStr);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) {
      seen.add(port);
    }
  }
  return [...seen];
}

function hasObfuscatedMiningOrSmtpSignature(rawText) {
  const s = String(rawText || '').toLowerCase().replace(/['"`]/g, '');
  if (!s) return false;
  return /\b(?:xmrig|minerd|cpuminer|ethminer|lolminer|nanominer)\b|stratum\+(?:tcp|ssl):\/\/|mining\.(?:subscribe|authorize|submit)|\b(?:ehlo|mail from:|rcpt to:)\b/i.test(s);
}

function toIso(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function resolveRunner(queryable = null) {
  if (queryable) {
    if (typeof queryable === 'function') {
      return { active: true, query: queryable, exec: null };
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
        exec: hasExec ? (sql) => queryable.exec(sql) : null
      };
    }
  }
  if (isPgActive()) {
    return { active: true, query: queryPg, exec: null };
  }
  return { active: false, query: null, exec: null };
}

async function tableExists(runner, tableName) {
  const { rows } = await runner.query(
    'SELECT to_regclass($1) IS NOT NULL AS exists',
    [`public.${tableName}`]
  );
  return Boolean(rows?.[0]?.exists);
}

async function getTableColumns(runner, tableName) {
  if (!(await tableExists(runner, tableName))) return new Set();
  const { rows } = await runner.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  return new Set((rows || []).map((r) => r.column_name));
}

export function resetInMemoryVpsAbuseGuardForTests() {
  memoryAbuseEvents.length = 0;
  memoryNotifications.length = 0;
  schemaEnsured = false;
}

export function getInMemoryVpsAbuseGuardStateForTests() {
  return {
    events: memoryAbuseEvents.map((e) => structuredClone(e)),
    notifications: memoryNotifications.map((n) => structuredClone(n))
  };
}

export async function ensureVpsAbuseGuardSchema(queryable = null) {
  const runner = resolveRunner(queryable);
  if (!runner.active) {
    return { ok: true, mode: 'memory' };
  }
  if (!queryable && schemaEnsured) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (runner.exec) {
    await runner.exec(VPS_ABUSE_GUARD_SCHEMA_SQL);
  } else {
    await runner.query(VPS_ABUSE_GUARD_SCHEMA_SQL);
  }
  if (!queryable) {
    schemaEnsured = true;
  }
  return { ok: true, mode: 'postgres' };
}

export function getDropletOutboundFirewallPolicy({
  dropletId = null,
  trustedSmtpEnabled = false
} = {}) {
  const cleanDropletId = dropletId ? String(dropletId).trim() : null;
  const trusted = Boolean(trustedSmtpEnabled);
  const blockedSmtpPorts = trusted ? [] : [...DEFAULT_BLOCKED_ABUSE_PORTS];
  const blockedMinerPorts = [...MINER_STRATUM_PORTS];
  return {
    dropletId: cleanDropletId,
    trustedSmtpEnabled: trusted,
    blockedSmtpPorts,
    blockedMinerPorts,
    blockedOutboundPorts: [...blockedSmtpPorts, ...blockedMinerPorts],
    defaultPolicy: trusted
      ? 'smtp_whitelisted_verified_sender'
      : 'block_untrusted_smtp_and_stratum'
  };
}

function formatAbuseEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    dropletId: row.droplet_id,
    userId: row.user_id || null,
    ruleType: row.rule_type,
    severity: row.severity,
    evidence: row.evidence_json && typeof row.evidence_json === 'object' ? row.evidence_json : {},
    actionTaken: row.action_taken,
    createdAt: toIso(row.created_at)
  };
}

export async function listVpsAbuseEvents({
  dropletId = null,
  userId = null,
  limit = 50,
  queryable = null
} = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
  const cleanDropletId = dropletId ? String(dropletId).trim() : null;
  const cleanUserId = userId ? String(userId).trim() : null;
  const runner = resolveRunner(queryable);

  if (!runner.active) {
    return memoryAbuseEvents
      .filter((ev) => (!cleanDropletId || ev.dropletId === cleanDropletId) && (!cleanUserId || ev.userId === cleanUserId))
      .slice(0, safeLimit)
      .map((ev) => structuredClone(ev));
  }

  await ensureVpsAbuseGuardSchema(queryable);
  const clauses = [];
  const params = [];
  if (cleanDropletId) {
    params.push(cleanDropletId);
    clauses.push(`droplet_id = $${params.length}`);
  }
  if (cleanUserId) {
    params.push(cleanUserId);
    clauses.push(`user_id = $${params.length}`);
  }
  params.push(safeLimit);
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await runner.query(
    `SELECT * FROM system_vps_abuse_events
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return (rows || []).map(formatAbuseEventRow);
}

async function recordAbuseEvent(runner, {
  dropletId,
  userId,
  ruleType,
  severity,
  evidence,
  actionTaken,
  nowIso
}) {
  const id = `vab_${randomUUID()}`;
  if (!runner.active) {
    const record = {
      id,
      dropletId,
      userId,
      ruleType,
      severity,
      evidence,
      actionTaken,
      createdAt: nowIso
    };
    memoryAbuseEvents.unshift(record);
    return structuredClone(record);
  }

  const { rows } = await runner.query(
    `INSERT INTO system_vps_abuse_events
       (id, droplet_id, user_id, rule_type, severity, evidence_json, action_taken, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
     RETURNING *`,
    [id, dropletId, userId, ruleType, severity, JSON.stringify(evidence), actionTaken, nowIso]
  );
  return formatAbuseEventRow(rows?.[0]);
}

async function resolveAdminRecipientId(runner, explicitAdminRecipientId, fallbackUserId) {
  if (explicitAdminRecipientId) return String(explicitAdminRecipientId).trim();
  if (await tableExists(runner, 'system_users')) {
    const cols = await getTableColumns(runner, 'system_users');
    if (cols.has('role')) {
      const { rows } = await runner.query(
        `SELECT id FROM system_users WHERE role IN ('admin', 'superadmin') LIMIT 1`
      );
      if (rows?.[0]?.id) return rows[0].id;
    }
    if (fallbackUserId) {
      const { rows } = await runner.query(
        `SELECT id FROM system_users WHERE id = $1 LIMIT 1`,
        [fallbackUserId]
      );
      if (rows?.[0]?.id) return rows[0].id;
    }
    return null;
  }
  return fallbackUserId || null;
}

async function insertAbuseNotification(runner, {
  dropletId,
  userId,
  adminRecipientId,
  ruleType,
  severity,
  actionTaken,
  evidence,
  nowIso
}) {
  const id = `notif_${randomUUID()}`;
  const title = `[${severity.toUpperCase()}] VPS Abuse Guard Triggered (${ruleType})`;
  const snippet = `Droplet ${dropletId} triggered ${ruleType}; action: ${actionTaken}.`;
  const content = `Automated VPS abuse guard detected ${ruleType} (severity: ${severity}) on droplet ${dropletId}${userId ? ` (owner: ${userId})` : ''}. Action taken: ${actionTaken}.`;
  const meta = {
    alertTarget: 'admin',
    dropletId,
    userId,
    ruleType,
    severity,
    actionTaken,
    evidence
  };

  if (!runner.active) {
    const record = {
      id,
      recipientId: adminRecipientId || userId || 'admin',
      senderId: null,
      type: 'vps_abuse_guard_alert',
      title,
      snippet,
      content,
      entityId: dropletId,
      isRead: false,
      meta,
      createdAt: nowIso
    };
    memoryNotifications.unshift(record);
    return structuredClone(record);
  }

  const cols = await getTableColumns(runner, 'social_notifications');
  if (cols.size === 0) return null;

  const recipientId = await resolveAdminRecipientId(runner, adminRecipientId, userId);
  const insertCols = ['id', 'recipient_id', 'sender_id', 'type', 'content', 'entity_id', 'is_read', 'created_at'];
  const insertVals = [id, recipientId, null, 'vps_abuse_guard_alert', content, dropletId, false, nowIso];

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

async function suspendSpecificDropletAndHoldIp(runner, {
  dropletId,
  reason,
  holdIpFn,
  nowIso
}) {
  if (runner.active && (await tableExists(runner, 'cloud_droplets'))) {
    const cols = await getTableColumns(runner, 'cloud_droplets');
    if (cols.has('suspended_at')) {
      await runner.query(
        `UPDATE cloud_droplets
         SET status = 'suspended',
             suspended_at = COALESCE(suspended_at, $2::timestamptz)
         WHERE id = $1`,
        [dropletId, nowIso]
      );
    } else {
      await runner.query(
        `UPDATE cloud_droplets SET status = 'suspended' WHERE id = $1`,
        [dropletId]
      );
    }
    await setDropletPowerOnHost(dropletId, 'suspend').catch(() => {});
  }

  if (typeof holdIpFn === 'function') {
    const res = await holdIpFn({ dropletId, reason, queryFn: runner.active ? runner.query : null });
    return (res?.heldAddresses || []).map((a) => a.ipAddress).filter(Boolean);
  }

  if (!runner.active) {
    const res = await holdDropletIpAllocations({ dropletId, reason });
    return (res?.heldAddresses || []).map((a) => a.ipAddress).filter(Boolean);
  }

  if (await tableExists(runner, 'system_ip_allocations')) {
    const res = await holdDropletIpAllocations({ dropletId, reason, queryFn: runner.query });
    return (res?.heldAddresses || []).map((a) => a.ipAddress).filter(Boolean);
  }
  return [];
}

function detectTelemetryRules({
  smtpAttempts,
  outboundConns,
  blockedPorts,
  cpuPct,
  highCpuMins,
  stratumPorts,
  trustedSmtpEnabled,
  miningSignatureDetected
}) {
  const matchedRules = [];
  const blockedSmtpHits = blockedPorts.filter((p) => BLOCKED_SMTP_PORT_SET.has(p));
  const blockedStratumHits = blockedPorts.filter((p) => MINER_STRATUM_PORT_SET.has(p));
  const detectedStratum = normalizePortList([...stratumPorts, ...blockedStratumHits]);

  const smtpBurst = smtpAttempts >= VPS_ABUSE_THRESHOLDS.SMTP_ATTEMPTS_PER_MIN;
  const unauthorizedSmtpEgress = !trustedSmtpEnabled && blockedSmtpHits.length > 0;
  if (smtpBurst || unauthorizedSmtpEgress) {
    matchedRules.push({
      ruleType: VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS,
      severity: 'critical',
      details: {
        smtpBurst,
        unauthorizedSmtpEgress,
        smtpAttemptsPerMin: smtpAttempts,
        blockedSmtpHits,
        trustedSmtpEnabled
      }
    });
  }

  const sustainedHighCpu =
    cpuPct >= VPS_ABUSE_THRESHOLDS.MINER_CPU_PCT &&
    highCpuMins >= VPS_ABUSE_THRESHOLDS.MINER_HIGH_CPU_MINUTES;
  const extendedElevatedCpu = cpuPct >= 88 && highCpuMins >= 45;
  const hasMiningConnSignature =
    detectedStratum.length > 0 ||
    outboundConns >= VPS_ABUSE_THRESHOLDS.MINER_CORROBORATING_CONNECTIONS_PER_MIN ||
    Boolean(miningSignatureDetected);

  if (detectedStratum.length > 0 || (sustainedHighCpu && hasMiningConnSignature) || (extendedElevatedCpu && hasMiningConnSignature)) {
    matchedRules.push({
      ruleType: VPS_ABUSE_RULE_TYPES.CRYPTO_MINER_SUSPECTED,
      severity: 'critical',
      details: {
        detectedStratumPorts: detectedStratum,
        sustainedHighCpu: sustainedHighCpu || extendedElevatedCpu,
        sustainedCpuPct: cpuPct,
        highCpuMinutes: highCpuMins,
        outboundConnectionsPerMin: outboundConns
      }
    });
  }

  if (outboundConns >= VPS_ABUSE_THRESHOLDS.OUTBOUND_CONNECTIONS_PER_MIN) {
    matchedRules.push({
      ruleType: VPS_ABUSE_RULE_TYPES.OUTBOUND_FLOOD_SCAN,
      severity: outboundConns >= VPS_ABUSE_THRESHOLDS.OUTBOUND_CONNECTIONS_PER_MIN * 2 ? 'critical' : 'high',
      details: {
        outboundConnectionsPerMin: outboundConns,
        threshold: VPS_ABUSE_THRESHOLDS.OUTBOUND_CONNECTIONS_PER_MIN
      }
    });
  }

  return {
    matchedRules,
    blockedSmtpHits,
    detectedStratum
  };
}

export async function evaluateDropletTelemetryForAbuse({
  dropletId,
  userId = null,
  smtpAttemptsPerMin = 0,
  outboundConnectionsPerMin = 0,
  blockedPortHits = [],
  sustainedCpuPct = 0,
  highCpuMinutes = 0,
  detectedStratumPorts = [],
  trustedSmtpEnabled = false,
  miningSignatureDetected = false,
  processSummary = '',
  suspendScope = 'account',
  autoSuspendFn = null,
  holdIpFn = null,
  adminRecipientId = null,
  now = new Date(),
  queryable = null
} = {}) {
  const cleanDropletId = String(dropletId || '').trim();
  if (!cleanDropletId) {
    throw createGuardError('dropletId is required.', 400, 'INVALID_DROPLET_ID');
  }
  const runner = resolveRunner(queryable);
  let cleanUserId = userId ? String(userId).trim() : null;
  if (!cleanUserId && runner.active) {
    try {
      const ownerRes = await runner.query(
        'SELECT user_id FROM cloud_droplets WHERE id = $1 LIMIT 1',
        [cleanDropletId]
      );
      if (ownerRes?.rows?.[0]?.user_id) {
        cleanUserId = String(ownerRes.rows[0].user_id).trim();
      }
    } catch {
      // ignore if lookup unavailable in non-PG mocks
    }
  }
  const isTrustedSmtp = Boolean(trustedSmtpEnabled);
  const nowIso = toIso(now);

  const smtpAttempts = toNonNegativeNumber(smtpAttemptsPerMin);
  const outboundConns = toNonNegativeNumber(outboundConnectionsPerMin);
  const cpuPct = toNonNegativeNumber(sustainedCpuPct);
  const highCpuMins = toNonNegativeNumber(highCpuMinutes);
  const blockedPorts = normalizePortList(blockedPortHits);
  const stratumPorts = normalizePortList(detectedStratumPorts);
  const effectiveMiningSignal = Boolean(miningSignatureDetected) || hasObfuscatedMiningOrSmtpSignature(processSummary);

  const { matchedRules, blockedSmtpHits, detectedStratum } = detectTelemetryRules({
    smtpAttempts,
    outboundConns,
    blockedPorts,
    cpuPct,
    highCpuMins,
    stratumPorts,
    trustedSmtpEnabled: isTrustedSmtp,
    miningSignatureDetected: effectiveMiningSignal
  });

  if (matchedRules.length === 0) {
    return {
      ok: true,
      allowed: true,
      action: 'allow',
      dropletId: cleanDropletId,
      userId: cleanUserId,
      severity: 'none',
      ruleType: null,
      matchedRules: [],
      trustedSmtpEnabled: isTrustedSmtp,
      blockedSmtpPorts: isTrustedSmtp ? [] : [...DEFAULT_BLOCKED_ABUSE_PORTS],
      suspended: false,
      heldIps: [],
      event: null,
      notification: null,
      evaluatedAt: nowIso
    };
  }

  const _runnerUnused = runner;
  if (_runnerUnused.active) {
    await ensureVpsAbuseGuardSchema(queryable);
  }

  const isCritical = matchedRules.some((r) => r.severity === 'critical');
  const severity = isCritical ? 'critical' : 'high';
  const primaryRule = matchedRules.find((r) => r.severity === severity) || matchedRules[0];
  const ruleType = primaryRule.ruleType;
  const reason = `Automated VPS abuse guard (${ruleType}) triggered on droplet ${cleanDropletId}`;

  const evidence = {
    dropletId: cleanDropletId,
    userId: cleanUserId,
    trustedSmtpEnabled: isTrustedSmtp,
    smtpAttemptsPerMin: smtpAttempts,
    outboundConnectionsPerMin: outboundConns,
    blockedPortHits: blockedPorts,
    blockedSmtpHits,
    detectedStratumPorts: detectedStratum,
    sustainedCpuPct: cpuPct,
    highCpuMinutes: highCpuMins,
    matchedRules: matchedRules.map((r) => ({ ruleType: r.ruleType, severity: r.severity }))
  };

  let actionTaken = 'alert_and_throttle';
  let accountHold = null;
  let heldIps = [];

  if (isCritical) {
    if (typeof autoSuspendFn === 'function') {
      const customRes = await autoSuspendFn({
        dropletId: cleanDropletId,
        userId: cleanUserId,
        ruleType,
        severity,
        reason,
        evidence,
        queryable
      });
      actionTaken = customRes?.actionTaken || 'auto_suspend_custom';
      if (Array.isArray(customRes?.heldIps)) {
        heldIps = [...customRes.heldIps];
      }
      accountHold = customRes?.accountHold || null;
    } else if (cleanUserId && suspendScope !== 'droplet') {
      accountHold = await enforceUserAccountHold({
        userId: cleanUserId,
        reason,
        holdType: HOLD_TYPES.TEMP_BAN,
        permanent: false,
        holdIpFn,
        now: new Date(nowIso),
        queryable
      });
      heldIps = [...(accountHold?.affected?.heldIps || [])];

      if (!accountHold?.affected?.droplets?.includes(cleanDropletId)) {
        const extraIps = await suspendSpecificDropletAndHoldIp(runner, {
          dropletId: cleanDropletId,
          reason,
          holdIpFn,
          nowIso
        });
        heldIps = [...new Set([...heldIps, ...extraIps])];
      }
      actionTaken = 'account_temp_ban_and_ip_hold';
    } else {
      heldIps = await suspendSpecificDropletAndHoldIp(runner, {
        dropletId: cleanDropletId,
        reason,
        holdIpFn,
        nowIso
      });
      actionTaken = 'droplet_suspended_and_ip_hold';
    }
  }

  const event = await recordAbuseEvent(runner, {
    dropletId: cleanDropletId,
    userId: cleanUserId,
    ruleType,
    severity,
    evidence,
    actionTaken,
    nowIso
  });

  const notification = await insertAbuseNotification(runner, {
    dropletId: cleanDropletId,
    userId: cleanUserId,
    adminRecipientId,
    ruleType,
    severity,
    actionTaken,
    evidence,
    nowIso
  });

  return {
    ok: true,
    allowed: false,
    action: isCritical ? 'suspend' : 'throttle_alert',
    actionTaken,
    dropletId: cleanDropletId,
    userId: cleanUserId,
    severity,
    ruleType,
    matchedRules,
    trustedSmtpEnabled: isTrustedSmtp,
    blockedSmtpPorts: isTrustedSmtp ? [] : [...DEFAULT_BLOCKED_ABUSE_PORTS],
    suspended: isCritical,
    heldIps,
    accountHold,
    event,
    notification,
    evaluatedAt: nowIso
  };
}
