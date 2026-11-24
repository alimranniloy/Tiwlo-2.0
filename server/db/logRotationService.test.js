import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_RETENTION_POLICY,
  GC_CHECKPOINT_SETTING_KEY,
  PROTECTED_IMMUTABLE_TABLES,
  PRUNABLE_TRANSIENT_TABLES,
  RETENTION_POLICY_SETTING_KEY,
  assertTablePrunable,
  cleanupTempUploadArtifacts,
  getStorageAndMemoryHealth,
  pruneTransientTable,
  runAutomatedLogGarbageCollection,
  sanitizeRetentionPolicy,
  saveRetentionPolicy,
  startAutomatedLogRetentionScheduler,
  stopAutomatedLogRetentionScheduler
} from './logRotationService.js';

test('sanitizeRetentionPolicy clamps extreme values and preserves valid defaults', () => {
  const clamped = sanitizeRetentionPolicy({
    autoGcEnabled: false,
    liveVisitorStaleMinutes: 0,
    visitorSeenDedupDays: 999,
    userActivityTrailDays: -5,
    userActivityTrailMaxRows: 10,
    securityEventsDays: 500,
    emailOutboxMaxRows: 99999999,
    analyticsDailyRollupDays: 1,
    diskLogMaxMb: 0.1,
    gcIntervalMinutes: 1
  });

  assert.equal(clamped.autoGcEnabled, false);
  assert.equal(clamped.liveVisitorStaleMinutes, 1);
  assert.equal(clamped.visitorSeenDedupDays, 30);
  assert.equal(clamped.userActivityTrailDays, 1);
  assert.equal(clamped.userActivityTrailMaxRows, 1000);
  assert.equal(clamped.securityEventsDays, 365);
  assert.equal(clamped.emailOutboxMaxRows, 2000000);
  assert.equal(clamped.analyticsDailyRollupDays, 7);
  assert.equal(clamped.diskLogMaxMb, 1);
  assert.equal(clamped.gcIntervalMinutes, 5);
});

test('runAutomatedLogGarbageCollection deletes expired rows in small ctid batches and updates persistent checkpoint', async () => {
  const settingsStore = new Map();
  settingsStore.set(GC_CHECKPOINT_SETTING_KEY, {
    lastRunAt: '2026-11-14T00:00:00.000Z',
    nextRunAt: '2026-11-14T00:30:00.000Z',
    lastDeletedCounts: {},
    totalHistoricalPrunedRows: 500,
    lastDiskRotated: [],
    lastDurationMs: 12
  });

  let activityDeleteCalls = 0;
  const queries = [];

  const queryPg = async (sql, params = []) => {
    const text = String(sql).trim();
    queries.push({ sql: text, params });

    if (text.startsWith('SELECT settings FROM system_settings')) {
      const val = settingsStore.get(params[0]);
      return { rows: val ? [{ settings: val }] : [] };
    }
    if (text.startsWith('INSERT INTO system_settings')) {
      settingsStore.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    }
    if (text.includes('DELETE FROM user_activity_trail') && text.includes('ctid IN')) {
      activityDeleteCalls += 1;
      // First batch full (100), second batch partial (25) -> should stop after 2 batches!
      return { rowCount: activityDeleteCalls === 1 ? 100 : 25 };
    }
    if (text.includes('DELETE FROM live_visitor_sessions') && text.includes('ctid IN')) {
      return { rowCount: 10 };
    }
    if (text.includes('DELETE FROM system_sessions') && text.includes('ctid IN')) {
      return { rowCount: 7 };
    }
    if (text.includes('DELETE FROM user_sessions') && text.includes('ctid IN')) {
      const err = new Error('relation "user_sessions" does not exist');
      err.code = '42P01';
      throw err;
    }
    if (text.includes('DELETE FROM') && text.includes('ctid IN')) {
      return { rowCount: 3 };
    }
    return { rows: [], rowCount: 0 };
  };

  const report = await runAutomatedLogGarbageCollection(
    { force: true, batchSize: 100 },
    {
      queryPg,
      logsDir: path.join(os.tmpdir(), 'tiwlo-nonexistent-logs-dir-test'),
      uploadDirs: [],
      tmpDir: null
    }
  );

  assert.equal(report.skipped, false);
  assert.equal(activityDeleteCalls, 2);
  assert.equal(report.deletedCounts.userActivityTrail, 125);
  assert.equal(report.deletedCounts.liveVisitorSessions, 10);
  assert.equal(report.deletedCounts.expiredSessions, 7);
  assert.equal(report.deletedCounts.serverConnectivityLogs, 3);
  assert.equal(report.deletedCounts.emailLogs, 3);
  assert.equal(report.deletedCounts.dropletTelemetrySamples, 3);
  // 125 + 10 + 7 + 3*8 (visitorSeenDedup, securityEvents, emailOutbox, emailLogs, serverConnectivityLogs, dropletTelemetrySamples, analyticsPageDaily, analyticsProductDaily) = 166
  assert.equal(report.totalDeleted, 166);
  assert.equal(report.totalHistoricalPrunedRows, 666);
  assert.ok(report.nextRunAt);

  const savedCheckpoint = settingsStore.get(GC_CHECKPOINT_SETTING_KEY);
  assert.equal(savedCheckpoint.totalHistoricalPrunedRows, 666);
  assert.equal(savedCheckpoint.lastDeletedCounts.userActivityTrail, 125);

  // Verify ctid batch LIMIT queries were used
  const ctidQueries = queries.filter((q) => q.sql.includes('ctid IN'));
  assert.ok(ctidQueries.length >= 11);
  for (const q of ctidQueries) {
    assert.match(q.sql, /LIMIT \$\d+/);
  }
});

test('runAutomatedLogGarbageCollection skips when autoGcEnabled is false unless force=true', async () => {
  const settingsStore = new Map([
    [RETENTION_POLICY_SETTING_KEY, { ...DEFAULT_RETENTION_POLICY, autoGcEnabled: false }]
  ]);

  const queryPg = async (sql, params = []) => {
    const text = String(sql).trim();
    if (text.startsWith('SELECT settings FROM system_settings')) {
      const val = settingsStore.get(params[0]);
      return { rows: val ? [{ settings: val }] : [] };
    }
    if (text.startsWith('INSERT INTO system_settings')) {
      settingsStore.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL during skipped GC: ${text}`);
  };

  const skipped = await runAutomatedLogGarbageCollection(
    { force: false },
    { queryPg, logsDir: path.join(os.tmpdir(), 'tiwlo-nonexistent-logs-dir-test') }
  );
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.reason, 'auto_gc_disabled');
});

test('runAutomatedLogGarbageCollection rotates oversized .log files keeping max 3 backups (.1, .2, .3)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-logrotate-'));
  try {
    const logFile = path.join(tmpDir, 'server.log');
    fs.writeFileSync(logFile, 'A'.repeat(1_200_000)); // > 1 MB
    fs.writeFileSync(`${logFile}.1`, 'backup1');
    fs.writeFileSync(`${logFile}.2`, 'backup2');
    fs.writeFileSync(`${logFile}.3`, 'backup3');
    fs.writeFileSync(`${logFile}.4`, 'stale4');

    const settingsStore = new Map([
      [RETENTION_POLICY_SETTING_KEY, { ...DEFAULT_RETENTION_POLICY, diskLogMaxMb: 1 }]
    ]);

    const queryPg = async (sql, params = []) => {
      const text = String(sql).trim();
      if (text.startsWith('SELECT settings FROM system_settings')) {
        const val = settingsStore.get(params[0]);
        return { rows: val ? [{ settings: val }] : [] };
      }
      if (text.startsWith('INSERT INTO system_settings')) {
        settingsStore.set(params[0], JSON.parse(params[1]));
        return { rows: [] };
      }
      return { rows: [], rowCount: 0 };
    };

    const report = await runAutomatedLogGarbageCollection(
      { force: true },
      { queryPg, logsDir: tmpDir }
    );

    assert.equal(report.diskRotated.length, 1);
    assert.equal(report.diskRotated[0].file, 'server.log');
    assert.equal(fs.statSync(logFile).size, 0);
    assert.equal(fs.statSync(`${logFile}.1`).size, 1_200_000);
    assert.equal(fs.readFileSync(`${logFile}.2`, 'utf8'), 'backup1');
    assert.equal(fs.readFileSync(`${logFile}.3`, 'utf8'), 'backup2');
    assert.equal(fs.existsSync(`${logFile}.4`), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('getStorageAndMemoryHealth returns Node memory, system memory, PG table stats, policy, and checkpoint metadata', async () => {
  const settingsStore = new Map([
    [
      GC_CHECKPOINT_SETTING_KEY,
      {
        lastRunAt: '2026-11-15T12:00:00.000Z',
        nextRunAt: '2026-11-15T12:30:00.000Z',
        lastDeletedCounts: { userActivityTrail: 42 },
        totalHistoricalPrunedRows: 1200,
        lastDiskRotated: [],
        lastDurationMs: 35
      }
    ]
  ]);

  const queryPg = async (sql, params = []) => {
    const text = String(sql).trim();
    if (text.startsWith('SELECT settings FROM system_settings')) {
      const val = settingsStore.get(params[0]);
      return { rows: val ? [{ settings: val }] : [] };
    }
    if (text.startsWith('INSERT INTO system_settings')) {
      settingsStore.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    }
    if (text.includes('to_regclass')) {
      return { rows: [{ rel: params[0] }] };
    }
    if (text.includes('pg_total_relation_size')) {
      return { rows: [{ row_count: '15', size_bytes: '32768' }] };
    }
    return { rows: [] };
  };

  await saveRetentionPolicy({ securityEventsDays: 45 }, { queryPg });
  const health = await getStorageAndMemoryHealth({
    queryPg,
    logsDir: path.join(os.tmpdir(), 'tiwlo-nonexistent-logs-dir-test')
  });

  assert.equal(typeof health.memory.rssMb, 'number');
  assert.equal(typeof health.memory.heapUsedMb, 'number');
  assert.equal(typeof health.systemMemory.freeSystemMb, 'number');
  assert.equal(health.policy.securityEventsDays, 45);
  assert.equal(health.lastRunAt, '2026-11-15T12:00:00.000Z');
  assert.equal(health.nextScheduledRunAt, '2026-11-15T12:30:00.000Z');
  assert.equal(health.totalHistoricalPrunedRows, 1200);
  assert.equal(health.tables.length, 8);
  assert.equal(health.tables[0].rowCount, 15);
  assert.equal(health.tables[0].sizeBytes, 32768);
});

test('startAutomatedLogRetentionScheduler resumes countdown from persisted nextRunAt across server reboots', async () => {
  const overdueCheckpoint = {
    lastRunAt: new Date(Date.now() - 3600_000).toISOString(),
    nextRunAt: new Date(Date.now() - 60_000).toISOString(),
    lastDeletedCounts: {},
    totalHistoricalPrunedRows: 10
  };
  const futureCheckpoint = {
    lastRunAt: new Date(Date.now() - 60_000).toISOString(),
    nextRunAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    lastDeletedCounts: {},
    totalHistoricalPrunedRows: 10
  };

  const makeQuery = (cp) => async (sql, params = []) => {
    const text = String(sql).trim();
    if (text.startsWith('SELECT settings FROM system_settings')) {
      if (params[0] === GC_CHECKPOINT_SETTING_KEY) return { rows: [{ settings: cp }] };
      return { rows: [] };
    }
    return { rows: [] };
  };

  try {
    const overdueStart = await startAutomatedLogRetentionScheduler({ queryPg: makeQuery(overdueCheckpoint) });
    assert.equal(overdueStart.delayMs, 5000);
    stopAutomatedLogRetentionScheduler();

    const futureStart = await startAutomatedLogRetentionScheduler({ queryPg: makeQuery(futureCheckpoint) });
    assert.ok(futureStart.delayMs > 9 * 60_000 && futureStart.delayMs <= 10 * 60_000);
  } finally {
    stopAutomatedLogRetentionScheduler();
  }
});

test('PROTECTED_IMMUTABLE_TABLES is frozen and explicitly blocks pruning invoices, billing orders, topups, and daily telemetry rollups', async () => {
  assert.equal(Object.isFrozen(PROTECTED_IMMUTABLE_TABLES), true);
  assert.deepEqual([...PROTECTED_IMMUTABLE_TABLES], [
    'cloud_droplet_invoices',
    'platform_billing_orders',
    'cloud_credit_topups',
    'cloud_droplet_telemetry_daily',
    'system_account_service_holds',
    'system_account_lifecycle_audits',
    'system_ipv6_change_events'
  ]);

  for (const immutableTable of PROTECTED_IMMUTABLE_TABLES) {
    assert.equal(PRUNABLE_TRANSIENT_TABLES.includes(immutableTable), false);
    assert.throws(
      () => assertTablePrunable(immutableTable),
      (err) => err.code === 'PROTECTED_IMMUTABLE_TABLE' && err.message.includes(immutableTable)
    );
  }

  let sqlCalled = false;
  const neverCalledQuery = async () => {
    sqlCalled = true;
    return { rowCount: 0, rows: [] };
  };

  for (const target of [
    'cloud_droplet_invoices',
    'platform_billing_orders',
    'cloud_credit_topups',
    'cloud_droplet_telemetry_daily',
    'system_account_service_holds',
    'system_account_lifecycle_audits',
    'system_ipv6_change_events'
  ]) {
    await assert.rejects(
      () => pruneTransientTable({
        queryPg: neverCalledQuery,
        table: target,
        whereSql: '1=1'
      }),
      (err) => err.code === 'PROTECTED_IMMUTABLE_TABLE'
    );
  }

  await assert.rejects(
    () => pruneTransientTable({
      queryPg: neverCalledQuery,
      table: 'system_users',
      whereSql: '1=1'
    }),
    (err) => err.code === 'TABLE_NOT_ALLOWLISTED'
  );

  assert.equal(sqlCalled, false);
});

test('runAutomatedLogGarbageCollection prunes noisy connectivity/email/raw telemetry logs and temp uploads while preserving all immutable tables', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-gc-suite-'));
  const logsDir = path.join(tmpRoot, 'logs');
  const uploadDir = path.join(tmpRoot, 'uploads');
  const tmpScratchDir = path.join(tmpRoot, 'tmp');
  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(tmpScratchDir, { recursive: true });

  try {
    // Oversized noisy log file -> should rotate
    const noisyLog = path.join(logsDir, 'connectivity.log');
    fs.writeFileSync(noisyLog, 'X'.repeat(1_100_000));

    // Stale staging upload temp file (>24h) vs fresh staging file & permanent media file
    const staleStaging = path.join(uploadDir, '.tiwlo-staging-123e4567-e89b-12d3-a456-426614174000.tmp');
    const freshStaging = path.join(uploadDir, '.tiwlo-staging-223e4567-e89b-12d3-a456-426614174000.tmp');
    const permanentMedia = path.join(uploadDir, 'tenant-logo.png');
    fs.writeFileSync(staleStaging, 'stale-tmp');
    fs.writeFileSync(freshStaging, 'fresh-tmp');
    fs.writeFileSync(permanentMedia, 'real-image-bytes');

    const staleTmpUploadDir = path.join(tmpScratchDir, 'tiwlo-upload-abc123');
    const freshTmpUploadDir = path.join(tmpScratchDir, 'tiwlo-upload-xyz789');
    fs.mkdirSync(staleTmpUploadDir, { recursive: true });
    fs.mkdirSync(freshTmpUploadDir, { recursive: true });
    fs.writeFileSync(path.join(staleTmpUploadDir, 'chunk.bin'), 'old');

    const nowMs = Date.now();
    const oldDate = new Date(nowMs - 48 * 3600 * 1000);
    fs.utimesSync(staleStaging, oldDate, oldDate);
    fs.utimesSync(staleTmpUploadDir, oldDate, oldDate);

    const settingsStore = new Map([
      [RETENTION_POLICY_SETTING_KEY, {
        ...DEFAULT_RETENTION_POLICY,
        diskLogMaxMb: 1,
        dropletTelemetrySamplesDays: 30,
        serverConnectivityLogsDays: 14,
        emailLogsDays: 30,
        tempUploadArtifactMaxAgeHours: 24
      }]
    ]);

    const executedSql = [];
    const queryPg = async (sql, params = []) => {
      const text = String(sql).trim();
      executedSql.push({ sql: text, params });
      if (text.startsWith('SELECT settings FROM system_settings')) {
        const val = settingsStore.get(params[0]);
        return { rows: val ? [{ settings: val }] : [] };
      }
      if (text.startsWith('INSERT INTO system_settings')) {
        settingsStore.set(params[0], JSON.parse(params[1]));
        return { rows: [] };
      }
      if (text.includes('DELETE FROM system_server_connectivity_logs')) return { rowCount: 14 };
      if (text.includes('DELETE FROM email_logs')) return { rowCount: 9 };
      if (text.includes('DELETE FROM cloud_droplet_telemetry_samples')) return { rowCount: 42 };
      return { rows: [], rowCount: 0 };
    };

    const report = await runAutomatedLogGarbageCollection(
      { force: true, batchSize: 200 },
      {
        queryPg,
        logsDir,
        uploadDirs: [uploadDir],
        tmpDir: tmpScratchDir,
        nowMs
      }
    );

    assert.equal(report.skipped, false);
    assert.equal(report.deletedCounts.serverConnectivityLogs, 14);
    assert.equal(report.deletedCounts.emailLogs, 9);
    assert.equal(report.deletedCounts.dropletTelemetrySamples, 42);
    assert.equal(report.diskRotated.length, 1);
    assert.equal(fs.statSync(noisyLog).size, 0);
    assert.equal(report.tempArtifacts.removedFiles, 1);
    assert.equal(report.tempArtifacts.removedDirs, 1);
    assert.equal(fs.existsSync(staleStaging), false);
    assert.equal(fs.existsSync(freshStaging), true);
    assert.equal(fs.existsSync(permanentMedia), true);
    assert.equal(fs.existsSync(staleTmpUploadDir), false);
    assert.equal(fs.existsSync(freshTmpUploadDir), true);

    // Ensure 0 DELETE/TRUNCATE queries ever touched any protected immutable table
    const deleteQueries = executedSql.filter((entry) => /\b(DELETE|TRUNCATE)\b/i.test(entry.sql));
    assert.ok(deleteQueries.length > 0);
    for (const entry of deleteQueries) {
      for (const immutableTable of PROTECTED_IMMUTABLE_TABLES) {
        assert.equal(
          entry.sql.includes(immutableTable),
          false,
          `Protected immutable table ${immutableTable} must never appear in destructive SQL: ${entry.sql}`
        );
      }
    }

    // Verify raw telemetry samples prune uses the 30-day TTL parameter
    const rawTelemetrySql = deleteQueries.find((e) => e.sql.includes('cloud_droplet_telemetry_samples'));
    assert.ok(rawTelemetrySql);
    assert.equal(rawTelemetrySql.params[0], 30);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('sanitizeRetentionPolicy clamps Google-Cloud-style TTL bounds for connectivity, email logs, telemetry samples, and temp uploads', () => {
  const clamped = sanitizeRetentionPolicy({
    serverConnectivityLogsDays: 0,
    serverConnectivityLogsMaxRows: 10,
    emailLogsDays: 999,
    emailLogsMaxRows: 100,
    dropletTelemetrySamplesDays: 2,
    tempUploadArtifactMaxAgeHours: 0
  });
  assert.equal(clamped.serverConnectivityLogsDays, 1);
  assert.equal(clamped.serverConnectivityLogsMaxRows, 1000);
  assert.equal(clamped.emailLogsDays, 365);
  assert.equal(clamped.emailLogsMaxRows, 500);
  assert.equal(clamped.dropletTelemetrySamplesDays, 7);
  assert.equal(clamped.tempUploadArtifactMaxAgeHours, 1);

  const emptyCleanup = cleanupTempUploadArtifacts({ uploadDirs: [], tmpDir: null });
  assert.deepEqual(emptyCleanup, { removedFiles: 0, removedDirs: 0, reclaimedBytes: 0 });
});
