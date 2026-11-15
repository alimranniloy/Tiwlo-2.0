import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { queryPg } from './postgres.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOGS_DIR = path.resolve(__dirname, '../logs');

export const RETENTION_POLICY_SETTING_KEY = 'log_retention_policy';
export const GC_CHECKPOINT_SETTING_KEY = 'log_gc_checkpoint';

export const DEFAULT_RETENTION_POLICY = Object.freeze({
  autoGcEnabled: true,
  liveVisitorStaleMinutes: 15,
  visitorSeenDedupDays: 3,
  userActivityTrailDays: 14,
  userActivityTrailMaxRows: 100000,
  securityEventsDays: 30,
  securityEventsMaxRows: 100000,
  emailOutboxDays: 30,
  emailOutboxMaxRows: 50000,
  analyticsDailyRollupDays: 90,
  diskLogMaxMb: 10,
  gcIntervalMinutes: 30
});

const TRACKED_TABLES = Object.freeze([
  'live_visitor_sessions',
  'analytics_page_daily',
  'analytics_product_daily',
  'analytics_visitor_seen_daily',
  'user_activity_trail',
  'system_security_events',
  'system_email_outbox',
  'system_sessions'
]);

const MAX_BATCHES_PER_TABLE = 50;

let schedulerTimer = null;
let isGcRunning = false;
let inMemoryLastReport = null;

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampFloat(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed * 100) / 100));
}

export function sanitizeRetentionPolicy(input = {}, base = DEFAULT_RETENTION_POLICY) {
  const src = input && typeof input === 'object' ? input : {};
  const fallback = base && typeof base === 'object' ? base : DEFAULT_RETENTION_POLICY;
  return {
    autoGcEnabled:
      typeof src.autoGcEnabled === 'boolean'
        ? src.autoGcEnabled
        : (typeof fallback.autoGcEnabled === 'boolean' ? fallback.autoGcEnabled : true),
    liveVisitorStaleMinutes: clampInt(
      src.liveVisitorStaleMinutes,
      fallback.liveVisitorStaleMinutes ?? DEFAULT_RETENTION_POLICY.liveVisitorStaleMinutes,
      1,
      1440
    ),
    visitorSeenDedupDays: clampInt(
      src.visitorSeenDedupDays,
      fallback.visitorSeenDedupDays ?? DEFAULT_RETENTION_POLICY.visitorSeenDedupDays,
      1,
      30
    ),
    userActivityTrailDays: clampInt(
      src.userActivityTrailDays,
      fallback.userActivityTrailDays ?? DEFAULT_RETENTION_POLICY.userActivityTrailDays,
      1,
      365
    ),
    userActivityTrailMaxRows: clampInt(
      src.userActivityTrailMaxRows,
      fallback.userActivityTrailMaxRows ?? DEFAULT_RETENTION_POLICY.userActivityTrailMaxRows,
      1000,
      5000000
    ),
    securityEventsDays: clampInt(
      src.securityEventsDays,
      fallback.securityEventsDays ?? DEFAULT_RETENTION_POLICY.securityEventsDays,
      1,
      365
    ),
    securityEventsMaxRows: clampInt(
      src.securityEventsMaxRows,
      fallback.securityEventsMaxRows ?? DEFAULT_RETENTION_POLICY.securityEventsMaxRows,
      1000,
      5000000
    ),
    emailOutboxDays: clampInt(
      src.emailOutboxDays,
      fallback.emailOutboxDays ?? DEFAULT_RETENTION_POLICY.emailOutboxDays,
      1,
      365
    ),
    emailOutboxMaxRows: clampInt(
      src.emailOutboxMaxRows,
      fallback.emailOutboxMaxRows ?? DEFAULT_RETENTION_POLICY.emailOutboxMaxRows,
      500,
      2000000
    ),
    analyticsDailyRollupDays: clampInt(
      src.analyticsDailyRollupDays,
      fallback.analyticsDailyRollupDays ?? DEFAULT_RETENTION_POLICY.analyticsDailyRollupDays,
      7,
      730
    ),
    diskLogMaxMb: clampFloat(
      src.diskLogMaxMb,
      fallback.diskLogMaxMb ?? DEFAULT_RETENTION_POLICY.diskLogMaxMb,
      1,
      500
    ),
    gcIntervalMinutes: clampInt(
      src.gcIntervalMinutes,
      fallback.gcIntervalMinutes ?? DEFAULT_RETENTION_POLICY.gcIntervalMinutes,
      5,
      1440
    )
  };
}

function isMissingTableOrColumnError(err) {
  return err?.code === '42P01' || err?.code === '42703';
}

async function readSettingJson(q, key) {
  try {
    const res = await q(
      'SELECT settings FROM system_settings WHERE setting_key = $1 LIMIT 1',
      [key]
    );
    const val = res?.rows?.[0]?.settings;
    return val && typeof val === 'object' ? val : null;
  } catch (err) {
    if (isMissingTableOrColumnError(err)) return null;
    throw err;
  }
}

async function writeSettingJson(q, key, value) {
  try {
    await q(
      `INSERT INTO system_settings (setting_key, settings, updated_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key) DO UPDATE SET
         settings = EXCLUDED.settings,
         updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)]
    );
  } catch (err) {
    if (isMissingTableOrColumnError(err)) return;
    throw err;
  }
}

export async function getRetentionPolicy({ queryPg: q = queryPg } = {}) {
  const stored = await readSettingJson(q, RETENTION_POLICY_SETTING_KEY);
  return sanitizeRetentionPolicy(stored || {}, DEFAULT_RETENTION_POLICY);
}

export async function saveRetentionPolicy(updates = {}, deps = {}) {
  const q = deps.queryPg || queryPg;
  const current = await getRetentionPolicy({ queryPg: q });
  const nextPolicy = sanitizeRetentionPolicy(updates, current);
  await writeSettingJson(q, RETENTION_POLICY_SETTING_KEY, nextPolicy);

  // If scheduler is active, re-anchor next run cleanly when interval or enabled state changes
  if (schedulerTimer) {
    const nextRunAt = new Date(Date.now() + nextPolicy.gcIntervalMinutes * 60000).toISOString();
    const existingCp = await getGcCheckpoint({ queryPg: q });
    await saveGcCheckpoint(
      {
        ...existingCp,
        nextRunAt
      },
      { queryPg: q }
    ).catch(() => {});
    scheduleNextTimer(nextPolicy.gcIntervalMinutes * 60000, deps);
  }

  return nextPolicy;
}

export async function getGcCheckpoint({ queryPg: q = queryPg } = {}) {
  const stored = await readSettingJson(q, GC_CHECKPOINT_SETTING_KEY);
  if (!stored) {
    return {
      lastRunAt: null,
      nextRunAt: null,
      lastDeletedCounts: {},
      totalHistoricalPrunedRows: 0,
      lastDiskRotated: [],
      lastDurationMs: 0
    };
  }
  return {
    lastRunAt: stored.lastRunAt || null,
    nextRunAt: stored.nextRunAt || null,
    lastDeletedCounts:
      stored.lastDeletedCounts && typeof stored.lastDeletedCounts === 'object'
        ? stored.lastDeletedCounts
        : {},
    totalHistoricalPrunedRows: Number(stored.totalHistoricalPrunedRows || 0) || 0,
    lastDiskRotated: Array.isArray(stored.lastDiskRotated) ? stored.lastDiskRotated : [],
    lastDurationMs: Number(stored.lastDurationMs || 0) || 0
  };
}

export async function saveGcCheckpoint(checkpoint, { queryPg: q = queryPg } = {}) {
  const clean = {
    lastRunAt: checkpoint?.lastRunAt || null,
    nextRunAt: checkpoint?.nextRunAt || null,
    lastDeletedCounts: checkpoint?.lastDeletedCounts || {},
    totalHistoricalPrunedRows: Number(checkpoint?.totalHistoricalPrunedRows || 0) || 0,
    lastDiskRotated: Array.isArray(checkpoint?.lastDiskRotated) ? checkpoint.lastDiskRotated : [],
    lastDurationMs: Number(checkpoint?.lastDurationMs || 0) || 0
  };
  await writeSettingJson(q, GC_CHECKPOINT_SETTING_KEY, clean);
  return clean;
}

function extractDeletedCount(result) {
  if (!result) return 0;
  if (typeof result.rowCount === 'number' && Number.isFinite(result.rowCount)) {
    return Math.max(0, result.rowCount);
  }
  if (Array.isArray(result.rows)) {
    return result.rows.length;
  }
  return 0;
}

async function batchedDeleteByCtid(q, table, whereSql, params, batchSize) {
  let totalDeleted = 0;
  const limitParamIndex = params.length + 1;
  const sql = `
    DELETE FROM ${table}
    WHERE ctid IN (
      SELECT ctid FROM ${table}
      WHERE ${whereSql}
      LIMIT $${limitParamIndex}
    )
  `;

  for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
    let result;
    try {
      result = await q(sql, [...params, batchSize]);
    } catch (err) {
      if (isMissingTableOrColumnError(err)) {
        return totalDeleted;
      }
      throw err;
    }
    const deleted = extractDeletedCount(result);
    totalDeleted += deleted;
    if (deleted < batchSize) break;
  }

  return totalDeleted;
}

async function pruneTableWithDaysAndCap(q, table, days, maxRows, batchSize) {
  const offsetIndex = Math.max(0, maxRows - 1);
  const whereSql = `
    created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
    OR id < COALESCE(
      (SELECT id FROM ${table} ORDER BY id DESC OFFSET $2 LIMIT 1),
      0
    )
  `;
  return batchedDeleteByCtid(q, table, whereSql, [days, offsetIndex], batchSize);
}

export function rotateDiskLogs(logsDir = DEFAULT_LOGS_DIR, diskLogMaxMb = 10, fsModule = fs) {
  const rotated = [];
  const maxBytes = Math.max(1, Number(diskLogMaxMb) || 10) * 1024 * 1024;
  if (!logsDir || !fsModule.existsSync(logsDir)) {
    return rotated;
  }

  const entries = fsModule.readdirSync(logsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.log')) continue;
    const basePath = path.join(logsDir, entry.name);
    let stat;
    try {
      stat = fsModule.statSync(basePath);
    } catch {
      continue;
    }
    if (!stat || stat.size <= maxBytes) continue;

    // Remove any backups older than .3
    for (const extraName of entries) {
      if (extraName.isFile() && extraName.name.startsWith(`${entry.name}.`)) {
        const suffix = extraName.name.slice(entry.name.length + 1);
        if (/^\d+$/.test(suffix) && Number(suffix) >= 4) {
          try {
            fsModule.unlinkSync(path.join(logsDir, extraName.name));
          } catch {
            // ignore cleanup error
          }
        }
      }
    }

    const b1 = `${basePath}.1`;
    const b2 = `${basePath}.2`;
    const b3 = `${basePath}.3`;

    if (fsModule.existsSync(b3)) {
      fsModule.unlinkSync(b3);
    }
    if (fsModule.existsSync(b2)) {
      fsModule.renameSync(b2, b3);
    }
    if (fsModule.existsSync(b1)) {
      fsModule.renameSync(b1, b2);
    }

    // Copy + truncate so active file descriptors continue writing cleanly
    fsModule.copyFileSync(basePath, b1);
    fsModule.truncateSync(basePath, 0);

    rotated.push({
      file: entry.name,
      previousBytes: stat.size,
      rotatedTo: `${entry.name}.1`
    });
  }

  return rotated;
}

export async function runAutomatedLogGarbageCollection(
  { force = false, batchSize = 1000 } = {},
  deps = {}
) {
  if (isGcRunning) {
    return {
      ranAt: new Date().toISOString(),
      skipped: true,
      reason: 'gc_already_running',
      deletedCounts: {},
      totalDeleted: 0,
      diskRotated: [],
      durationMs: 0
    };
  }

  const q = deps.queryPg || queryPg;
  const fsModule = deps.fsModule || fs;
  const logsDir = deps.logsDir || DEFAULT_LOGS_DIR;
  const boundedBatch = clampInt(batchSize, 1000, 50, 5000);
  const startedAtMs = Date.now();
  const ranAt = new Date(startedAtMs).toISOString();

  isGcRunning = true;
  try {
    const policy = await getRetentionPolicy({ queryPg: q });
    const nextRunAt = new Date(Date.now() + policy.gcIntervalMinutes * 60000).toISOString();

    if (!policy.autoGcEnabled && !force) {
      const prevCp = await getGcCheckpoint({ queryPg: q });
      await saveGcCheckpoint({ ...prevCp, nextRunAt }, { queryPg: q }).catch(() => {});
      const skippedReport = {
        ranAt,
        skipped: true,
        reason: 'auto_gc_disabled',
        nextRunAt,
        deletedCounts: {},
        totalDeleted: 0,
        diskRotated: [],
        durationMs: Date.now() - startedAtMs
      };
      inMemoryLastReport = skippedReport;
      return skippedReport;
    }

    const [
      expiredSystemSessions,
      expiredUserSessions,
      liveVisitorSessions,
      visitorSeenDedup,
      userActivityTrail,
      securityEvents,
      emailOutbox,
      analyticsPageDaily,
      analyticsProductDaily
    ] = await Promise.all([
      batchedDeleteByCtid(
        q,
        'system_sessions',
        'expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP',
        [],
        boundedBatch
      ),
      batchedDeleteByCtid(
        q,
        'user_sessions',
        'expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP',
        [],
        boundedBatch
      ),
      batchedDeleteByCtid(
        q,
        'live_visitor_sessions',
        "last_seen_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 minute')",
        [policy.liveVisitorStaleMinutes],
        boundedBatch
      ),
      batchedDeleteByCtid(
        q,
        'analytics_visitor_seen_daily',
        "day_bucket < CURRENT_DATE - ($1 * INTERVAL '1 day')",
        [policy.visitorSeenDedupDays],
        boundedBatch
      ),
      pruneTableWithDaysAndCap(
        q,
        'user_activity_trail',
        policy.userActivityTrailDays,
        policy.userActivityTrailMaxRows,
        boundedBatch
      ),
      pruneTableWithDaysAndCap(
        q,
        'system_security_events',
        policy.securityEventsDays,
        policy.securityEventsMaxRows,
        boundedBatch
      ),
      pruneTableWithDaysAndCap(
        q,
        'system_email_outbox',
        policy.emailOutboxDays,
        policy.emailOutboxMaxRows,
        boundedBatch
      ),
      batchedDeleteByCtid(
        q,
        'analytics_page_daily',
        "day_bucket < CURRENT_DATE - ($1 * INTERVAL '1 day')",
        [policy.analyticsDailyRollupDays],
        boundedBatch
      ),
      batchedDeleteByCtid(
        q,
        'analytics_product_daily',
        "day_bucket < CURRENT_DATE - ($1 * INTERVAL '1 day')",
        [policy.analyticsDailyRollupDays],
        boundedBatch
      )
    ]);

    const deletedCounts = {
      expiredSessions: expiredSystemSessions + expiredUserSessions,
      liveVisitorSessions,
      visitorSeenDedup,
      userActivityTrail,
      securityEvents,
      emailOutbox,
      analyticsPageDaily,
      analyticsProductDaily
    };
    const totalDeleted = Object.values(deletedCounts).reduce((sum, n) => sum + Number(n || 0), 0);
    const diskRotated = rotateDiskLogs(logsDir, policy.diskLogMaxMb, fsModule);
    const durationMs = Math.max(0, Date.now() - startedAtMs);

    const prevCheckpoint = await getGcCheckpoint({ queryPg: q });
    const totalHistoricalPrunedRows = Number(prevCheckpoint.totalHistoricalPrunedRows || 0) + totalDeleted;

    await saveGcCheckpoint(
      {
        lastRunAt: ranAt,
        nextRunAt,
        lastDeletedCounts: deletedCounts,
        totalHistoricalPrunedRows,
        lastDiskRotated: diskRotated,
        lastDurationMs: durationMs
      },
      { queryPg: q }
    ).catch(() => {});

    const report = {
      ranAt,
      skipped: false,
      nextRunAt,
      deletedCounts,
      totalDeleted,
      totalHistoricalPrunedRows,
      diskRotated,
      durationMs
    };
    inMemoryLastReport = report;
    return report;
  } finally {
    isGcRunning = false;
  }
}

function bytesToMb(bytes) {
  return Math.round((Number(bytes || 0) / (1024 * 1024)) * 100) / 100;
}

async function inspectPgTableStats(q, tableName) {
  try {
    const existsRes = await q('SELECT to_regclass($1) AS rel', [tableName]);
    const exists = Boolean(existsRes?.rows?.[0]?.rel);
    if (!exists) {
      return { table: tableName, exists: false, rowCount: 0, sizeBytes: 0 };
    }
    const statRes = await q(
      `SELECT COUNT(*)::bigint AS row_count,
              pg_total_relation_size($1::regclass)::bigint AS size_bytes
       FROM ${tableName}`,
      [tableName]
    );
    const row = statRes?.rows?.[0] || {};
    return {
      table: tableName,
      exists: true,
      rowCount: Number(row.row_count || 0),
      sizeBytes: Number(row.size_bytes || 0)
    };
  } catch (err) {
    if (isMissingTableOrColumnError(err)) {
      return { table: tableName, exists: false, rowCount: 0, sizeBytes: 0 };
    }
    return { table: tableName, exists: false, rowCount: 0, sizeBytes: 0, error: err.message };
  }
}

function inspectDiskLogs(logsDir = DEFAULT_LOGS_DIR, fsModule = fs) {
  if (!logsDir || !fsModule.existsSync(logsDir)) {
    return { directory: logsDir, files: [], totalBytes: 0 };
  }
  const files = [];
  let totalBytes = 0;
  for (const entry of fsModule.readdirSync(logsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.log(\.\d+)?$/.test(entry.name)) continue;
    try {
      const stat = fsModule.statSync(path.join(logsDir, entry.name));
      totalBytes += stat.size;
      files.push({
        name: entry.name,
        sizeBytes: stat.size,
        updatedAt: stat.mtime ? stat.mtime.toISOString() : null
      });
    } catch {
      // skip unreadable file
    }
  }
  files.sort((a, b) => b.sizeBytes - a.sizeBytes);
  return { directory: logsDir, files, totalBytes };
}

export async function getStorageAndMemoryHealth(deps = {}) {
  const q = deps.queryPg || queryPg;
  const fsModule = deps.fsModule || fs;
  const logsDir = deps.logsDir || DEFAULT_LOGS_DIR;

  const mem = process.memoryUsage();
  const totalSystemBytes = os.totalmem();
  const freeSystemBytes = os.freemem();
  const usedSystemPct = totalSystemBytes > 0
    ? Math.round(((totalSystemBytes - freeSystemBytes) / totalSystemBytes) * 1000) / 10
    : 0;

  const [policy, checkpoint, tables] = await Promise.all([
    getRetentionPolicy({ queryPg: q }),
    getGcCheckpoint({ queryPg: q }),
    Promise.all(TRACKED_TABLES.map((tbl) => inspectPgTableStats(q, tbl)))
  ]);

  const diskLogs = inspectDiskLogs(logsDir, fsModule);

  return {
    memory: {
      rssMb: bytesToMb(mem.rss),
      heapUsedMb: bytesToMb(mem.heapUsed),
      heapTotalMb: bytesToMb(mem.heapTotal),
      externalMb: bytesToMb(mem.external)
    },
    systemMemory: {
      freeSystemMb: bytesToMb(freeSystemBytes),
      totalSystemMb: bytesToMb(totalSystemBytes),
      usedSystemPct
    },
    tables,
    diskLogs,
    policy,
    lastRunAt: checkpoint.lastRunAt || inMemoryLastReport?.ranAt || null,
    nextScheduledRunAt: checkpoint.nextRunAt || null,
    totalHistoricalPrunedRows: checkpoint.totalHistoricalPrunedRows || 0,
    lastGcReport: inMemoryLastReport || (checkpoint.lastRunAt ? {
      ranAt: checkpoint.lastRunAt,
      skipped: false,
      nextRunAt: checkpoint.nextRunAt,
      deletedCounts: checkpoint.lastDeletedCounts,
      totalDeleted: Object.values(checkpoint.lastDeletedCounts || {}).reduce((s, n) => s + Number(n || 0), 0),
      totalHistoricalPrunedRows: checkpoint.totalHistoricalPrunedRows,
      diskRotated: checkpoint.lastDiskRotated,
      durationMs: checkpoint.lastDurationMs
    } : null)
  };
}

function scheduleNextTimer(delayMs, deps = {}) {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  const safeDelay = Math.max(5000, Number(delayMs) || 30 * 60000);
  schedulerTimer = setTimeout(async () => {
    try {
      await runAutomatedLogGarbageCollection({ force: false }, deps);
    } catch (err) {
      console.warn('[LogRotation] Scheduled GC run failed:', err?.message || err);
    }
    try {
      const policy = await getRetentionPolicy({ queryPg: deps.queryPg || queryPg });
      scheduleNextTimer(policy.gcIntervalMinutes * 60000, deps);
    } catch {
      scheduleNextTimer(DEFAULT_RETENTION_POLICY.gcIntervalMinutes * 60000, deps);
    }
  }, safeDelay);
  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref();
  }
}

export async function startAutomatedLogRetentionScheduler(deps = {}) {
  const q = deps.queryPg || queryPg;
  const [policy, checkpoint] = await Promise.all([
    getRetentionPolicy({ queryPg: q }),
    getGcCheckpoint({ queryPg: q })
  ]);

  const intervalMs = policy.gcIntervalMinutes * 60000;
  let delayMs = intervalMs;

  if (checkpoint?.nextRunAt) {
    const targetMs = new Date(checkpoint.nextRunAt).getTime();
    if (Number.isFinite(targetMs)) {
      // Reboot-resilient: if nextRunAt passed while offline, run promptly (5s delay);
      // otherwise resume remaining countdown without resetting to full interval!
      delayMs = Math.max(5000, targetMs - Date.now());
    }
  } else {
    const anchoredNext = new Date(Date.now() + intervalMs).toISOString();
    await saveGcCheckpoint({ ...checkpoint, nextRunAt: anchoredNext }, { queryPg: q }).catch(() => {});
  }

  scheduleNextTimer(delayMs, deps);
  return { delayMs, policy };
}

export function stopAutomatedLogRetentionScheduler() {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}
