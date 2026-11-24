import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import {
  ensureDropletTelemetrySchema,
  getInMemoryDropletTelemetryStateForTests,
  pruneHighResSamplesKeepLifetimeDaily,
  purgeTelemetryOlderSamplesKeepLifetimeDaily,
  queryDropletTelemetry,
  recordDropletTelemetrySample,
  resetInMemoryDropletTelemetryForTests
} from './dropletTelemetry.js';

test('recordDropletTelemetrySample clamps percentages to 0..100 and atomically calculates same-day avg & max rollups', async () => {
  resetInMemoryDropletTelemetryForTests();

  const r1 = await recordDropletTelemetrySample({
    dropletId: 'drp_1',
    userId: 'user_a',
    recordedAt: '2026-11-23T08:00:00.000Z',
    cpuPct: 12.5,
    ramUsedMb: 1024,
    ramPct: 25,
    diskUsedGb: 20,
    diskPct: 40,
    netInMbps: 100,
    netOutMbps: 40
  });

  assert.equal(r1.daily.samplesCount, 1);
  assert.equal(r1.daily.avgCpuPct, 12.5);
  assert.equal(r1.daily.maxCpuPct, 12.5);

  const r2 = await recordDropletTelemetrySample({
    dropletId: 'drp_1',
    userId: 'user_a',
    recordedAt: '2026-11-23T12:00:00.000Z',
    cpuPct: 150, // clamped to 100
    ramUsedMb: 3072,
    ramPct: -10, // clamped to 0
    diskUsedGb: 22,
    diskPct: 44,
    netInMbps: 200,
    netOutMbps: 60
  });

  assert.equal(r2.sample.cpuPct, 100);
  assert.equal(r2.sample.ramPct, 0);
  assert.equal(r2.daily.samplesCount, 2);
  assert.equal(r2.daily.avgCpuPct, 56.25); // (12.5 + 100) / 2
  assert.equal(r2.daily.maxCpuPct, 100);
  assert.equal(r2.daily.avgRamPct, 12.5); // (25 + 0) / 2
  assert.equal(r2.daily.maxRamPct, 25);

  const r3 = await recordDropletTelemetrySample({
    dropletId: 'drp_1',
    userId: 'user_a',
    recordedAt: '2026-11-23T18:00:00.000Z',
    cpuPct: 37.5,
    ramUsedMb: 2048,
    ramPct: 50,
    diskUsedGb: 24,
    diskPct: 48,
    netInMbps: 50,
    netOutMbps: 20
  });

  assert.equal(r3.daily.samplesCount, 3);
  assert.equal(r3.daily.avgCpuPct, 50); // (56.25*2 + 37.5) / 3 = 150 / 3
  assert.equal(r3.daily.maxCpuPct, 100);
  assert.equal(r3.daily.avgRamPct, 25); // (12.5*2 + 50) / 3 = 75 / 3
  assert.equal(r3.daily.maxRamPct, 50);
  assert.equal(r3.daily.diskUsedGb, 24);

  const mem = getInMemoryDropletTelemetryStateForTests();
  assert.equal(mem.samples.length, 3);
  assert.equal(mem.daily.length, 1);
});

test('queryDropletTelemetry supports 1h, 24h, 7d, 1y, all (multi-year 2024..2026 lifetime), and custom from..to filtering', async () => {
  resetInMemoryDropletTelemetryForTests();
  const now = new Date('2026-11-23T22:00:00.000Z');

  // 2024 historical sample
  await recordDropletTelemetrySample({
    dropletId: 'drp_life',
    userId: 'user_1',
    recordedAt: '2024-03-15T10:00:00.000Z',
    cpuPct: 20,
    ramUsedMb: 1024,
    ramPct: 30,
    diskUsedGb: 10,
    diskPct: 20,
    netInMbps: 10,
    netOutMbps: 5
  });

  // 2025 historical sample
  await recordDropletTelemetrySample({
    dropletId: 'drp_life',
    userId: 'user_1',
    recordedAt: '2025-07-04T14:00:00.000Z',
    cpuPct: 40,
    ramUsedMb: 2048,
    ramPct: 50,
    diskUsedGb: 15,
    diskPct: 30,
    netInMbps: 20,
    netOutMbps: 10
  });

  // 5 days ago (within 7d & 1y, outside 24h)
  await recordDropletTelemetrySample({
    dropletId: 'drp_life',
    userId: 'user_1',
    recordedAt: '2026-11-18T11:15:00.000Z',
    cpuPct: 60,
    ramUsedMb: 2560,
    ramPct: 62,
    diskUsedGb: 18,
    diskPct: 36,
    netInMbps: 40,
    netOutMbps: 20
  });
  await recordDropletTelemetrySample({
    dropletId: 'drp_life',
    userId: 'user_1',
    recordedAt: '2026-11-18T11:45:00.000Z',
    cpuPct: 80,
    ramUsedMb: 3072,
    ramPct: 78,
    diskUsedGb: 18,
    diskPct: 36,
    netInMbps: 60,
    netOutMbps: 30
  });

  // 10 hours ago (within 24h, outside 1h)
  await recordDropletTelemetrySample({
    dropletId: 'drp_life',
    userId: 'user_1',
    recordedAt: '2026-11-23T12:00:00.000Z',
    cpuPct: 30,
    ramUsedMb: 1536,
    ramPct: 40,
    diskUsedGb: 20,
    diskPct: 40,
    netInMbps: 25,
    netOutMbps: 15
  });

  // 20 minutes ago (within 1h)
  await recordDropletTelemetrySample({
    dropletId: 'drp_life',
    userId: 'user_1',
    recordedAt: '2026-11-23T21:40:00.000Z',
    cpuPct: 55,
    ramUsedMb: 2200,
    ramPct: 55,
    diskUsedGb: 20,
    diskPct: 40,
    netInMbps: 35,
    netOutMbps: 18
  });

  // Other user's droplet shouldn't leak
  await recordDropletTelemetrySample({
    dropletId: 'drp_other',
    userId: 'user_2',
    recordedAt: '2026-11-23T21:50:00.000Z',
    cpuPct: 99,
    ramPct: 99
  });

  const q1h = await queryDropletTelemetry({ dropletId: 'drp_life', userId: 'user_1', range: '1h', now });
  assert.equal(q1h.range, '1h');
  assert.equal(q1h.resolution, 'raw');
  assert.equal(q1h.points.length, 1);
  assert.equal(q1h.points[0].cpuPct, 55);
  assert.equal(q1h.summary.sampleCount, 1);
  assert.equal(q1h.summary.latestRecordedAt, '2026-11-23T21:40:00.000Z');

  const q24h = await queryDropletTelemetry({ dropletId: 'drp_life', userId: 'user_1', range: '24h', now });
  assert.equal(q24h.range, '24h');
  assert.equal(q24h.resolution, 'raw');
  assert.equal(q24h.points.length, 2);
  assert.equal(q24h.summary.sampleCount, 2);
  assert.equal(q24h.summary.avgCpuPct, 42.5);
  assert.equal(q24h.summary.peakCpuPct, 55);
  assert.equal(q24h.summary.avgRamPct, 47.5);
  assert.equal(q24h.summary.peakRamPct, 55);

  const q7d = await queryDropletTelemetry({ dropletId: 'drp_life', userId: 'user_1', range: '7d', now });
  assert.equal(q7d.range, '7d');
  assert.equal(q7d.resolution, 'hourly');
  assert.equal(q7d.points.length, 3); // 11:00 bucket (2 samples), 12:00 bucket, 21:00 bucket
  assert.equal(q7d.points[0].cpuPct, 70); // avg(60, 80)
  assert.equal(q7d.points[0].maxCpuPct, 80);
  assert.equal(q7d.summary.sampleCount, 4);

  const q1y = await queryDropletTelemetry({ dropletId: 'drp_life', userId: 'user_1', range: '1y', now });
  assert.equal(q1y.range, '1y');
  assert.equal(q1y.resolution, 'daily');
  assert.equal(q1y.points.length, 2); // 2026-11-18 and 2026-11-23 (2025-07-04 is > 365d before 2026-11-23)
  assert.equal(q1y.summary.sampleCount, 4);

  const qAll = await queryDropletTelemetry({ dropletId: 'drp_life', userId: 'user_1', range: 'all', now });
  assert.equal(qAll.range, 'all');
  assert.equal(qAll.resolution, 'daily');
  assert.equal(qAll.points.length, 4); // 2024-03-15, 2025-07-04, 2026-11-18, 2026-11-23
  assert.equal(qAll.points[0].dayDate, '2024-03-15');
  assert.equal(qAll.points[1].dayDate, '2025-07-04');
  assert.equal(qAll.summary.sampleCount, 6);
  assert.equal(qAll.summary.peakCpuPct, 80);

  // Custom date bounds across 2024..2025
  const qCustom = await queryDropletTelemetry({
    dropletId: 'drp_life',
    userId: 'user_1',
    from: '2024-01-01',
    to: '2025-12-31',
    now
  });
  assert.equal(qCustom.resolution, 'daily');
  assert.equal(qCustom.points.length, 2);
  assert.equal(qCustom.points[0].dayDate, '2024-03-15');
  assert.equal(qCustom.points[1].dayDate, '2025-07-04');
  assert.equal(qCustom.summary.sampleCount, 2);
  assert.equal(qCustom.summary.avgCpuPct, 30);

  // User isolation check
  const wrongUser = await queryDropletTelemetry({ dropletId: 'drp_life', userId: 'user_2', range: 'all', now });
  assert.equal(wrongUser.points.length, 0);
  assert.equal(wrongUser.summary.sampleCount, 0);
});

test('pruneHighResSamplesKeepLifetimeDaily removes >30d raw samples while preserving 100% of lifetime daily rollups', async () => {
  resetInMemoryDropletTelemetryForTests();
  const now = new Date('2026-11-23T22:00:00.000Z');

  // Old samples (>30 days ago)
  await recordDropletTelemetrySample({
    dropletId: 'drp_prune',
    userId: 'user_p',
    recordedAt: '2024-06-01T10:00:00.000Z',
    cpuPct: 35,
    ramPct: 45
  });
  await recordDropletTelemetrySample({
    dropletId: 'drp_prune',
    userId: 'user_p',
    recordedAt: '2026-10-10T10:00:00.000Z',
    cpuPct: 75,
    ramPct: 65
  });

  // Recent sample (<30 days ago)
  await recordDropletTelemetrySample({
    dropletId: 'drp_prune',
    userId: 'user_p',
    recordedAt: '2026-11-20T10:00:00.000Z',
    cpuPct: 50,
    ramPct: 55
  });

  const pruneResult = await pruneHighResSamplesKeepLifetimeDaily({
    retentionDays: 30,
    now
  });
  assert.equal(pruneResult.deletedSamples, 2);
  assert.equal(pruneResult.dailyRollupsPreserved, true);
  assert.equal(purgeTelemetryOlderSamplesKeepLifetimeDaily, pruneHighResSamplesKeepLifetimeDaily);

  const state = getInMemoryDropletTelemetryStateForTests();
  assert.equal(state.samples.length, 1);
  assert.equal(state.samples[0].recordedAt, '2026-11-20T10:00:00.000Z');
  assert.equal(state.daily.length, 3); // All 3 daily rollups intact!

  const lifetime = await queryDropletTelemetry({ dropletId: 'drp_prune', range: 'all', now });
  assert.equal(lifetime.points.length, 3);
  assert.equal(lifetime.points[0].dayDate, '2024-06-01');
  assert.equal(lifetime.points[0].cpuPct, 35);
  assert.equal(lifetime.points[1].dayDate, '2026-10-10');
  assert.equal(lifetime.points[1].cpuPct, 75);
  assert.equal(lifetime.points[2].dayDate, '2026-11-20');
  assert.equal(lifetime.summary.sampleCount, 3);
});

test('PGlite real PostgreSQL schema, atomic SQL daily rollup, multi-resolution queries, and pruning execute with zero SQL errors', async (t) => {
  const db = new PGlite();
  t.after(async () => { await db.close(); });

  const first = await ensureDropletTelemetrySchema(db);
  assert.equal(first.ok, true);
  const second = await ensureDropletTelemetrySchema(db);
  assert.equal(second.ok, true);

  // Verify tables and index exist
  const tablesRes = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('cloud_droplet_telemetry_samples', 'cloud_droplet_telemetry_daily')
  `);
  assert.equal(tablesRes.rows.length, 2);

  const now = new Date('2026-11-23T22:00:00.000Z');

  // 2024 historical sample
  await recordDropletTelemetrySample({
    dropletId: 'drp_pg_1',
    userId: 'user_pg',
    recordedAt: '2024-02-10T09:00:00.000Z',
    cpuPct: 15,
    ramUsedMb: 1024,
    ramPct: 25,
    diskUsedGb: 12,
    diskPct: 24,
    netInMbps: 20,
    netOutMbps: 10,
    queryable: db
  });

  // Two samples on 2026-11-20 in the same hour to verify atomic running avg/max + hourly bucket
  await recordDropletTelemetrySample({
    dropletId: 'drp_pg_1',
    userId: 'user_pg',
    recordedAt: '2026-11-20T14:10:00.000Z',
    cpuPct: 30,
    ramUsedMb: 2048,
    ramPct: 40,
    diskUsedGb: 20,
    diskPct: 40,
    netInMbps: 100,
    netOutMbps: 50,
    queryable: db
  });

  const rollupRes = await recordDropletTelemetrySample({
    dropletId: 'drp_pg_1',
    userId: 'user_pg',
    recordedAt: '2026-11-20T14:40:00.000Z',
    cpuPct: 70,
    ramUsedMb: 3072,
    ramPct: 80,
    diskUsedGb: 21,
    diskPct: 42,
    netInMbps: 200,
    netOutMbps: 70,
    queryable: db
  });

  assert.equal(rollupRes.daily.dayDate, '2026-11-20');
  assert.equal(rollupRes.daily.samplesCount, 2);
  assert.equal(rollupRes.daily.avgCpuPct, 50);
  assert.equal(rollupRes.daily.maxCpuPct, 70);
  assert.equal(rollupRes.daily.avgRamPct, 60);
  assert.equal(rollupRes.daily.maxRamPct, 80);

  // Recent sample in last 1h & 24h
  await recordDropletTelemetrySample({
    dropletId: 'drp_pg_1',
    userId: 'user_pg',
    recordedAt: '2026-11-23T21:45:00.000Z',
    cpuPct: 45,
    ramUsedMb: 2200,
    ramPct: 55,
    diskUsedGb: 22,
    diskPct: 44,
    netInMbps: 80,
    netOutMbps: 40,
    queryable: db
  });

  const pg1h = await queryDropletTelemetry({ dropletId: 'drp_pg_1', userId: 'user_pg', range: '1h', now, queryable: db });
  assert.equal(pg1h.resolution, 'raw');
  assert.equal(pg1h.points.length, 1);
  assert.equal(pg1h.points[0].cpuPct, 45);

  const pg24h = await queryDropletTelemetry({ dropletId: 'drp_pg_1', userId: 'user_pg', range: '24h', now, queryable: db });
  assert.equal(pg24h.resolution, 'raw');
  assert.equal(pg24h.points.length, 1);
  assert.equal(pg24h.summary.avgCpuPct, 45);

  const pg7d = await queryDropletTelemetry({ dropletId: 'drp_pg_1', userId: 'user_pg', range: '7d', now, queryable: db });
  assert.equal(pg7d.resolution, 'hourly');
  assert.equal(pg7d.points.length, 2);
  assert.equal(pg7d.points[0].cpuPct, 50);
  assert.equal(pg7d.points[0].maxCpuPct, 70);
  assert.equal(pg7d.summary.sampleCount, 3);

  const pg30d = await queryDropletTelemetry({ dropletId: 'drp_pg_1', userId: 'user_pg', range: '30d', now, queryable: db });
  assert.equal(pg30d.resolution, 'daily');
  assert.equal(pg30d.points.length, 2);
  assert.equal(pg30d.summary.sampleCount, 3);

  const pg1y = await queryDropletTelemetry({ dropletId: 'drp_pg_1', userId: 'user_pg', range: '1y', now, queryable: db });
  assert.equal(pg1y.resolution, 'daily');
  assert.equal(pg1y.points.length, 2);

  // Prune >30d raw samples; verify 2024 raw sample is deleted but daily rollup stays intact!
  const pruned = await pruneHighResSamplesKeepLifetimeDaily({ retentionDays: 30, now, queryable: db });
  assert.equal(pruned.deletedSamples, 1);

  const rawRemaining = await db.query('SELECT COUNT(*)::int AS cnt FROM cloud_droplet_telemetry_samples');
  assert.equal(rawRemaining.rows[0].cnt, 3);

  const dailyRemaining = await db.query('SELECT COUNT(*)::int AS cnt FROM cloud_droplet_telemetry_daily');
  assert.equal(dailyRemaining.rows[0].cnt, 3);

  const pgAll = await queryDropletTelemetry({ dropletId: 'drp_pg_1', userId: 'user_pg', range: 'all', now, queryable: db });
  assert.equal(pgAll.resolution, 'daily');
  assert.equal(pgAll.points.length, 3);
  assert.equal(pgAll.points[0].dayDate, '2024-02-10');
  assert.equal(pgAll.points[0].cpuPct, 15);
  assert.equal(pgAll.summary.sampleCount, 4);
  assert.equal(pgAll.summary.peakCpuPct, 70);

  // Custom date range across years after pruning
  const pgCustom = await queryDropletTelemetry({
    dropletId: 'drp_pg_1',
    from: '2024-01-01T00:00:00.000Z',
    to: '2025-12-31T23:59:59.999Z',
    now,
    queryable: db
  });
  assert.equal(pgCustom.resolution, 'daily');
  assert.equal(pgCustom.points.length, 1);
  assert.equal(pgCustom.points[0].dayDate, '2024-02-10');
});
