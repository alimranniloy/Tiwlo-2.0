import { isPgActive, queryPg } from './postgres.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_SAMPLE_RETENTION_DAYS = 30;
export const DEFAULT_SAMPLE_INTERVAL_SECONDS = 60;

export const DROPLET_TELEMETRY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS cloud_droplet_telemetry_samples (
    id BIGSERIAL PRIMARY KEY,
    droplet_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cpu_pct NUMERIC(5,2),
    ram_used_mb INT,
    ram_pct NUMERIC(5,2),
    disk_used_gb NUMERIC(10,2),
    disk_pct NUMERIC(5,2),
    net_in_mbps NUMERIC(10,2),
    net_out_mbps NUMERIC(10,2)
  );

  CREATE INDEX IF NOT EXISTS idx_cloud_droplet_telemetry_samples_droplet_time
    ON cloud_droplet_telemetry_samples(droplet_id, recorded_at DESC);

  CREATE INDEX IF NOT EXISTS idx_cloud_droplet_telemetry_samples_recorded_at
    ON cloud_droplet_telemetry_samples(recorded_at);

  CREATE TABLE IF NOT EXISTS cloud_droplet_telemetry_daily (
    droplet_id VARCHAR(64) NOT NULL,
    day_date DATE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    samples_count INT NOT NULL DEFAULT 0,
    avg_cpu_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_cpu_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_ram_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    max_ram_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_disk_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    disk_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_in_gb NUMERIC(12,4) NOT NULL DEFAULT 0,
    net_out_gb NUMERIC(12,4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (droplet_id, day_date)
  );

  CREATE INDEX IF NOT EXISTS idx_cloud_droplet_telemetry_daily_user
    ON cloud_droplet_telemetry_daily(user_id, droplet_id, day_date DESC);
`;

// ==========================================
// IN-MEMORY STORE FOR DETERMINISTIC TESTS
// ==========================================

const memorySamples = [];
const memoryDaily = new Map(); // key: `${dropletId}::${dayDate}`
let nextMemorySampleId = 1;

let schemaEnsured = false;
let schemaPromise = null;
const ensuredQueryables = new WeakSet();

export function resetInMemoryDropletTelemetryForTests() {
  memorySamples.length = 0;
  memoryDaily.clear();
  nextMemorySampleId = 1;
  schemaEnsured = false;
  schemaPromise = null;
}

export function getInMemoryDropletTelemetryStateForTests() {
  return {
    samples: memorySamples.map((s) => ({ ...s })),
    daily: [...memoryDaily.values()].map((d) => ({ ...d }))
  };
}

// ==========================================
// NORMALIZATION & MATH HELPERS
// ==========================================

function createInputError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function roundTo(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimals;
  return Math.round((num + Math.sign(num) * 1e-9) * factor) / factor;
}

function clampPct(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return roundTo(Math.min(100, Math.max(0, num)), 2);
}

function clampNonNegative(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return roundTo(Math.max(0, num), decimals);
}

function clampNonNegativeInt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num));
}

function parseDateInput(value, { endOfDayIfDateOnly = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const suffix = endOfDayIfDateOnly ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    const d = new Date(`${str}${suffix}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toUtcDayDate(date) {
  return date.toISOString().slice(0, 10);
}

function toUtcHourIso(date) {
  const ms = Math.floor(date.getTime() / HOUR_MS) * HOUR_MS;
  return new Date(ms).toISOString();
}

function mbpsToGbForInterval(mbps, intervalSeconds) {
  return roundTo((Math.max(0, mbps) * intervalSeconds) / 8000, 4);
}

function gbToAvgMbps(gb, samplesCount, intervalSeconds = DEFAULT_SAMPLE_INTERVAL_SECONDS) {
  const totalSeconds = Math.max(1, samplesCount) * intervalSeconds;
  return roundTo((Math.max(0, gb) * 8000) / totalSeconds, 2);
}

async function runQuery(queryable, sql, params = []) {
  if (queryable) {
    return await queryable.query(sql, params);
  }
  return await queryPg(sql, params);
}

async function ensureSchemaIfNeeded(queryable = null) {
  if (queryable) {
    if (ensuredQueryables.has(queryable)) return;
    await ensureDropletTelemetrySchema(queryable);
    return;
  }
  if (!isPgActive()) return;
  if (!schemaEnsured) {
    await ensureDropletTelemetrySchema();
  }
}

// ==========================================
// SCHEMA INITIALIZATION
// ==========================================

export async function ensureDropletTelemetrySchema(queryable = null) {
  if (queryable) {
    if (typeof queryable.exec === 'function') {
      await queryable.exec(DROPLET_TELEMETRY_SCHEMA_SQL);
    } else {
      await queryable.query(DROPLET_TELEMETRY_SCHEMA_SQL);
    }
    ensuredQueryables.add(queryable);
    return { ok: true, mode: 'queryable' };
  }

  if (!isPgActive()) {
    return { ok: true, mode: 'memory' };
  }

  if (schemaEnsured) {
    return { ok: true, mode: 'postgres', cached: true };
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      await queryPg(DROPLET_TELEMETRY_SCHEMA_SQL);
      schemaEnsured = true;
      return { ok: true, mode: 'postgres', cached: false };
    })().finally(() => {
      schemaPromise = null;
    });
  }

  return await schemaPromise;
}

// ==========================================
// RECORD TELEMETRY SAMPLE + DAILY ROLLUP
// ==========================================

export async function recordDropletTelemetrySample({
  dropletId,
  userId = '',
  recordedAt = null,
  cpuPct = 0,
  ramUsedMb = 0,
  ramPct = 0,
  diskUsedGb = 0,
  diskPct = 0,
  netInMbps = 0,
  netOutMbps = 0,
  netInGb = undefined,
  netOutGb = undefined,
  sampleIntervalSeconds = DEFAULT_SAMPLE_INTERVAL_SECONDS,
  queryable = null
} = {}) {
  const cleanDropletId = String(dropletId ?? '').trim();
  if (!cleanDropletId) {
    throw createInputError('dropletId is required');
  }
  const cleanUserId = String(userId ?? '').trim();

  const recordedDate = recordedAt === null || recordedAt === undefined || recordedAt === ''
    ? new Date()
    : parseDateInput(recordedAt);
  if (!recordedDate) {
    throw createInputError('recordedAt must be a valid date or ISO timestamp');
  }

  const normalizedCpuPct = clampPct(cpuPct);
  const normalizedRamUsedMb = clampNonNegativeInt(ramUsedMb);
  const normalizedRamPct = clampPct(ramPct);
  const normalizedDiskUsedGb = clampNonNegative(diskUsedGb, 2);
  const normalizedDiskPct = clampPct(diskPct);
  const normalizedNetInMbps = clampNonNegative(netInMbps, 2);
  const normalizedNetOutMbps = clampNonNegative(netOutMbps, 2);

  const intervalSec = Math.max(1, Number(sampleIntervalSeconds) || DEFAULT_SAMPLE_INTERVAL_SECONDS);
  const netInGbInc = netInGb !== undefined && netInGb !== null
    ? clampNonNegative(netInGb, 4)
    : mbpsToGbForInterval(normalizedNetInMbps, intervalSec);
  const netOutGbInc = netOutGb !== undefined && netOutGb !== null
    ? clampNonNegative(netOutGb, 4)
    : mbpsToGbForInterval(normalizedNetOutMbps, intervalSec);

  const recordedIso = recordedDate.toISOString();
  const dayDate = toUtcDayDate(recordedDate);

  if (!queryable && !isPgActive()) {
    const sample = {
      id: nextMemorySampleId++,
      dropletId: cleanDropletId,
      userId: cleanUserId,
      recordedAt: recordedIso,
      cpuPct: normalizedCpuPct,
      ramUsedMb: normalizedRamUsedMb,
      ramPct: normalizedRamPct,
      diskUsedGb: normalizedDiskUsedGb,
      diskPct: normalizedDiskPct,
      netInMbps: normalizedNetInMbps,
      netOutMbps: normalizedNetOutMbps
    };
    memorySamples.push(sample);

    const dailyKey = `${cleanDropletId}::${dayDate}`;
    const existing = memoryDaily.get(dailyKey);
    const nowIso = new Date().toISOString();
    let daily;

    if (!existing) {
      daily = {
        dropletId: cleanDropletId,
        dayDate,
        userId: cleanUserId,
        samplesCount: 1,
        avgCpuPct: normalizedCpuPct,
        maxCpuPct: normalizedCpuPct,
        avgRamPct: normalizedRamPct,
        maxRamPct: normalizedRamPct,
        avgDiskPct: normalizedDiskPct,
        diskUsedGb: normalizedDiskUsedGb,
        netInGb: netInGbInc,
        netOutGb: netOutGbInc,
        updatedAt: nowIso
      };
    } else {
      const oldN = existing.samplesCount;
      const nextN = oldN + 1;
      daily = {
        dropletId: cleanDropletId,
        dayDate,
        userId: cleanUserId || existing.userId,
        samplesCount: nextN,
        avgCpuPct: roundTo(((existing.avgCpuPct * oldN) + normalizedCpuPct) / nextN, 2),
        maxCpuPct: Math.max(existing.maxCpuPct, normalizedCpuPct),
        avgRamPct: roundTo(((existing.avgRamPct * oldN) + normalizedRamPct) / nextN, 2),
        maxRamPct: Math.max(existing.maxRamPct, normalizedRamPct),
        avgDiskPct: roundTo(((existing.avgDiskPct * oldN) + normalizedDiskPct) / nextN, 2),
        diskUsedGb: normalizedDiskUsedGb,
        netInGb: roundTo(existing.netInGb + netInGbInc, 4),
        netOutGb: roundTo(existing.netOutGb + netOutGbInc, 4),
        updatedAt: nowIso
      };
    }

    memoryDaily.set(dailyKey, daily);
    return {
      sample: { ...sample },
      daily: { ...daily }
    };
  }

  await ensureSchemaIfNeeded(queryable);

  const sql = `
    WITH inserted_sample AS (
      INSERT INTO cloud_droplet_telemetry_samples (
        droplet_id, user_id, recorded_at,
        cpu_pct, ram_used_mb, ram_pct,
        disk_used_gb, disk_pct, net_in_mbps, net_out_mbps
      )
      VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        id, droplet_id, user_id, recorded_at,
        cpu_pct, ram_used_mb, ram_pct,
        disk_used_gb, disk_pct, net_in_mbps, net_out_mbps
    ),
    upserted_daily AS (
      INSERT INTO cloud_droplet_telemetry_daily (
        droplet_id, day_date, user_id, samples_count,
        avg_cpu_pct, max_cpu_pct,
        avg_ram_pct, max_ram_pct,
        avg_disk_pct, disk_used_gb,
        net_in_gb, net_out_gb,
        updated_at
      )
      SELECT
        droplet_id,
        ((recorded_at AT TIME ZONE 'UTC')::date),
        user_id,
        1,
        cpu_pct, cpu_pct,
        ram_pct, ram_pct,
        disk_pct, disk_used_gb,
        $11::numeric, $12::numeric,
        CURRENT_TIMESTAMP
      FROM inserted_sample
      ON CONFLICT (droplet_id, day_date) DO UPDATE SET
        user_id = CASE WHEN EXCLUDED.user_id <> '' THEN EXCLUDED.user_id ELSE cloud_droplet_telemetry_daily.user_id END,
        samples_count = cloud_droplet_telemetry_daily.samples_count + 1,
        avg_cpu_pct = ROUND(
          ((cloud_droplet_telemetry_daily.avg_cpu_pct * cloud_droplet_telemetry_daily.samples_count) + EXCLUDED.avg_cpu_pct)
          / (cloud_droplet_telemetry_daily.samples_count + 1),
          2
        ),
        max_cpu_pct = GREATEST(cloud_droplet_telemetry_daily.max_cpu_pct, EXCLUDED.max_cpu_pct),
        avg_ram_pct = ROUND(
          ((cloud_droplet_telemetry_daily.avg_ram_pct * cloud_droplet_telemetry_daily.samples_count) + EXCLUDED.avg_ram_pct)
          / (cloud_droplet_telemetry_daily.samples_count + 1),
          2
        ),
        max_ram_pct = GREATEST(cloud_droplet_telemetry_daily.max_ram_pct, EXCLUDED.max_ram_pct),
        avg_disk_pct = ROUND(
          ((cloud_droplet_telemetry_daily.avg_disk_pct * cloud_droplet_telemetry_daily.samples_count) + EXCLUDED.avg_disk_pct)
          / (cloud_droplet_telemetry_daily.samples_count + 1),
          2
        ),
        disk_used_gb = EXCLUDED.disk_used_gb,
        net_in_gb = ROUND(cloud_droplet_telemetry_daily.net_in_gb + EXCLUDED.net_in_gb, 4),
        net_out_gb = ROUND(cloud_droplet_telemetry_daily.net_out_gb + EXCLUDED.net_out_gb, 4),
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        droplet_id,
        to_char(day_date, 'YYYY-MM-DD') AS day_date,
        user_id,
        samples_count,
        avg_cpu_pct,
        max_cpu_pct,
        avg_ram_pct,
        max_ram_pct,
        avg_disk_pct,
        disk_used_gb,
        net_in_gb,
        net_out_gb,
        updated_at
    )
    SELECT
      s.id AS sample_id,
      s.droplet_id,
      s.user_id,
      s.recorded_at,
      s.cpu_pct,
      s.ram_used_mb,
      s.ram_pct,
      s.disk_used_gb,
      s.disk_pct,
      s.net_in_mbps,
      s.net_out_mbps,
      d.day_date,
      d.samples_count,
      d.avg_cpu_pct,
      d.max_cpu_pct,
      d.avg_ram_pct,
      d.max_ram_pct,
      d.avg_disk_pct,
      d.disk_used_gb AS daily_disk_used_gb,
      d.net_in_gb,
      d.net_out_gb,
      d.updated_at AS daily_updated_at
    FROM inserted_sample s
    JOIN upserted_daily d ON d.droplet_id = s.droplet_id;
  `;

  const { rows } = await runQuery(queryable, sql, [
    cleanDropletId,
    cleanUserId,
    recordedIso,
    normalizedCpuPct,
    normalizedRamUsedMb,
    normalizedRamPct,
    normalizedDiskUsedGb,
    normalizedDiskPct,
    normalizedNetInMbps,
    normalizedNetOutMbps,
    netInGbInc,
    netOutGbInc
  ]);

  const row = rows[0];
  return {
    sample: {
      id: Number(row.sample_id),
      dropletId: row.droplet_id,
      userId: row.user_id,
      recordedAt: new Date(row.recorded_at).toISOString(),
      cpuPct: Number(row.cpu_pct),
      ramUsedMb: Number(row.ram_used_mb),
      ramPct: Number(row.ram_pct),
      diskUsedGb: Number(row.disk_used_gb),
      diskPct: Number(row.disk_pct),
      netInMbps: Number(row.net_in_mbps),
      netOutMbps: Number(row.net_out_mbps)
    },
    daily: {
      dropletId: row.droplet_id,
      dayDate: row.day_date,
      userId: row.user_id,
      samplesCount: Number(row.samples_count),
      avgCpuPct: Number(row.avg_cpu_pct),
      maxCpuPct: Number(row.max_cpu_pct),
      avgRamPct: Number(row.avg_ram_pct),
      maxRamPct: Number(row.max_ram_pct),
      avgDiskPct: Number(row.avg_disk_pct),
      diskUsedGb: Number(row.daily_disk_used_gb),
      netInGb: Number(row.net_in_gb),
      netOutGb: Number(row.net_out_gb),
      updatedAt: new Date(row.daily_updated_at).toISOString()
    }
  };
}

// ==========================================
// MULTI-RESOLUTION TELEMETRY QUERY ENGINE
// ==========================================

const VALID_RANGES = new Set(['1h', '24h', '7d', '30d', '1y', 'all', 'custom']);

function resolveQueryPlan({ range, from, to, nowDate }) {
  const normalizedRange = String(range || '24h').trim().toLowerCase();
  if (!VALID_RANGES.has(normalizedRange)) {
    throw createInputError(`Unsupported telemetry range: ${range}`);
  }

  const parsedFrom = parseDateInput(from, { endOfDayIfDateOnly: false });
  if (from !== null && from !== undefined && from !== '' && !parsedFrom) {
    throw createInputError('from must be a valid date or ISO timestamp');
  }

  const parsedTo = parseDateInput(to, { endOfDayIfDateOnly: true });
  if (to !== null && to !== undefined && to !== '' && !parsedTo) {
    throw createInputError('to must be a valid date or ISO timestamp');
  }

  const hasCustomBounds = Boolean(parsedFrom || parsedTo);

  if (hasCustomBounds) {
    const effectiveFrom = parsedFrom || null;
    const effectiveTo = parsedTo || (normalizedRange === 'all' ? null : nowDate);

    if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
      throw createInputError('from must not be after to');
    }

    let resolution;
    const spanMs = effectiveFrom && effectiveTo ? effectiveTo.getTime() - effectiveFrom.getTime() : Infinity;
    const retentionCutoffMs = nowDate.getTime() - DEFAULT_SAMPLE_RETENTION_DAYS * DAY_MS;
    const touchesPrunedHistory = !effectiveFrom || effectiveFrom.getTime() < retentionCutoffMs;

    if (normalizedRange === '1y' || normalizedRange === 'all' || normalizedRange === '30d') {
      resolution = 'daily';
    } else if (normalizedRange === '7d') {
      resolution = touchesPrunedHistory ? 'daily' : 'hourly';
    } else if (touchesPrunedHistory || spanMs > 45 * DAY_MS) {
      resolution = 'daily';
    } else if (spanMs > 48 * HOUR_MS) {
      resolution = 'hourly';
    } else {
      resolution = 'raw';
    }

    return {
      effectiveRange: parsedFrom || parsedTo ? (range === '24h' ? 'custom' : normalizedRange) : normalizedRange,
      resolution,
      fromDate: effectiveFrom,
      toDate: effectiveTo
    };
  }

  switch (normalizedRange) {
    case '1h':
      return {
        effectiveRange: '1h',
        resolution: 'raw',
        fromDate: new Date(nowDate.getTime() - HOUR_MS),
        toDate: nowDate
      };
    case '24h':
      return {
        effectiveRange: '24h',
        resolution: 'raw',
        fromDate: new Date(nowDate.getTime() - DAY_MS),
        toDate: nowDate
      };
    case '7d':
      return {
        effectiveRange: '7d',
        resolution: 'hourly',
        fromDate: new Date(nowDate.getTime() - 7 * DAY_MS),
        toDate: nowDate
      };
    case '30d':
      return {
        effectiveRange: '30d',
        resolution: 'daily',
        fromDate: new Date(nowDate.getTime() - 30 * DAY_MS),
        toDate: nowDate
      };
    case '1y':
      return {
        effectiveRange: '1y',
        resolution: 'daily',
        fromDate: new Date(nowDate.getTime() - 365 * DAY_MS),
        toDate: nowDate
      };
    case 'all':
    case 'custom':
    default:
      return {
        effectiveRange: normalizedRange,
        resolution: 'daily',
        fromDate: null,
        toDate: null
      };
  }
}

function buildSummary(points, latestRecordedAt) {
  if (!points.length) {
    return {
      sampleCount: 0,
      avgCpuPct: 0,
      peakCpuPct: 0,
      avgRamPct: 0,
      peakRamPct: 0,
      latestRecordedAt: null
    };
  }

  let totalSamples = 0;
  let weightedCpuSum = 0;
  let weightedRamSum = 0;
  let peakCpuPct = 0;
  let peakRamPct = 0;

  for (const pt of points) {
    const weight = Math.max(1, Number(pt.samplesCount ?? 1));
    totalSamples += weight;
    weightedCpuSum += pt.cpuPct * weight;
    weightedRamSum += pt.ramPct * weight;
    if (pt.maxCpuPct > peakCpuPct) peakCpuPct = pt.maxCpuPct;
    if (pt.maxRamPct > peakRamPct) peakRamPct = pt.maxRamPct;
  }

  return {
    sampleCount: totalSamples,
    avgCpuPct: roundTo(weightedCpuSum / totalSamples, 2),
    peakCpuPct: roundTo(peakCpuPct, 2),
    avgRamPct: roundTo(weightedRamSum / totalSamples, 2),
    peakRamPct: roundTo(peakRamPct, 2),
    latestRecordedAt: latestRecordedAt || points[points.length - 1].timestamp
  };
}

function queryInMemory({ dropletId, userId, resolution, fromDate, toDate }) {
  const fromMs = fromDate ? fromDate.getTime() : -Infinity;
  const toMs = toDate ? toDate.getTime() : Infinity;

  if (resolution === 'raw') {
    const matched = memorySamples
      .filter((s) => {
        if (s.dropletId !== dropletId) return false;
        if (userId && s.userId !== userId) return false;
        const ts = Date.parse(s.recordedAt);
        return ts >= fromMs && ts <= toMs;
      })
      .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id - b.id);

    const points = matched.map((s) => ({
      timestamp: s.recordedAt,
      cpuPct: s.cpuPct,
      maxCpuPct: s.cpuPct,
      ramPct: s.ramPct,
      maxRamPct: s.ramPct,
      diskPct: s.diskPct,
      netInMbps: s.netInMbps,
      netOutMbps: s.netOutMbps,
      ramUsedMb: s.ramUsedMb,
      diskUsedGb: s.diskUsedGb,
      samplesCount: 1
    }));

    return {
      points,
      latestRecordedAt: points.length ? points[points.length - 1].timestamp : null
    };
  }

  if (resolution === 'hourly') {
    const buckets = new Map();
    let latestMs = -Infinity;

    for (const s of memorySamples) {
      if (s.dropletId !== dropletId) continue;
      if (userId && s.userId !== userId) continue;
      const d = new Date(s.recordedAt);
      const ms = d.getTime();
      if (ms < fromMs || ms > toMs) continue;

      if (ms > latestMs) latestMs = ms;
      const hourIso = toUtcHourIso(d);
      let bucket = buckets.get(hourIso);
      if (!bucket) {
        bucket = {
          timestamp: hourIso,
          count: 0,
          cpuSum: 0,
          maxCpuPct: 0,
          ramSum: 0,
          maxRamPct: 0,
          diskSum: 0,
          netInSum: 0,
          netOutSum: 0
        };
        buckets.set(hourIso, bucket);
      }
      bucket.count += 1;
      bucket.cpuSum += s.cpuPct;
      if (s.cpuPct > bucket.maxCpuPct) bucket.maxCpuPct = s.cpuPct;
      bucket.ramSum += s.ramPct;
      if (s.ramPct > bucket.maxRamPct) bucket.maxRamPct = s.ramPct;
      bucket.diskSum += s.diskPct;
      bucket.netInSum += s.netInMbps;
      bucket.netOutSum += s.netOutMbps;
    }

    const points = [...buckets.values()]
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      .map((b) => ({
        timestamp: b.timestamp,
        cpuPct: roundTo(b.cpuSum / b.count, 2),
        maxCpuPct: roundTo(b.maxCpuPct, 2),
        ramPct: roundTo(b.ramSum / b.count, 2),
        maxRamPct: roundTo(b.maxRamPct, 2),
        diskPct: roundTo(b.diskSum / b.count, 2),
        netInMbps: roundTo(b.netInSum / b.count, 2),
        netOutMbps: roundTo(b.netOutSum / b.count, 2),
        samplesCount: b.count
      }));

    return {
      points,
      latestRecordedAt: Number.isFinite(latestMs) && latestMs > -Infinity ? new Date(latestMs).toISOString() : null
    };
  }

  // resolution === 'daily'
  const fromDay = fromDate ? toUtcDayDate(fromDate) : null;
  const toDay = toDate ? toUtcDayDate(toDate) : null;

  const matched = [...memoryDaily.values()]
    .filter((d) => {
      if (d.dropletId !== dropletId) return false;
      if (userId && d.userId !== userId) return false;
      if (fromDay && d.dayDate < fromDay) return false;
      if (toDay && d.dayDate > toDay) return false;
      return true;
    })
    .sort((a, b) => a.dayDate.localeCompare(b.dayDate));

  const points = matched.map((d) => ({
    timestamp: `${d.dayDate}T00:00:00.000Z`,
    dayDate: d.dayDate,
    cpuPct: d.avgCpuPct,
    maxCpuPct: d.maxCpuPct,
    ramPct: d.avgRamPct,
    maxRamPct: d.maxRamPct,
    diskPct: d.avgDiskPct,
    netInMbps: gbToAvgMbps(d.netInGb, d.samplesCount),
    netOutMbps: gbToAvgMbps(d.netOutGb, d.samplesCount),
    diskUsedGb: d.diskUsedGb,
    netInGb: d.netInGb,
    netOutGb: d.netOutGb,
    samplesCount: d.samplesCount
  }));

  return {
    points,
    latestRecordedAt: points.length ? points[points.length - 1].timestamp : null
  };
}

export async function queryDropletTelemetry({
  dropletId,
  userId = null,
  range = '24h',
  from = null,
  to = null,
  now = new Date(),
  queryable = null
} = {}) {
  const cleanDropletId = String(dropletId ?? '').trim();
  if (!cleanDropletId) {
    throw createInputError('dropletId is required');
  }
  const cleanUserId = userId !== null && userId !== undefined && String(userId).trim() !== ''
    ? String(userId).trim()
    : null;
  const nowDate = parseDateInput(now) || new Date();

  const plan = resolveQueryPlan({ range, from, to, nowDate });

  if (!queryable && !isPgActive()) {
    const { points, latestRecordedAt } = queryInMemory({
      dropletId: cleanDropletId,
      userId: cleanUserId,
      resolution: plan.resolution,
      fromDate: plan.fromDate,
      toDate: plan.toDate
    });
    return {
      range: plan.effectiveRange,
      resolution: plan.resolution,
      points,
      summary: buildSummary(points, latestRecordedAt)
    };
  }

  await ensureSchemaIfNeeded(queryable);

  if (plan.resolution === 'raw') {
    const conditions = ['droplet_id = $1'];
    const params = [cleanDropletId];

    if (cleanUserId) {
      params.push(cleanUserId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (plan.fromDate) {
      params.push(plan.fromDate.toISOString());
      conditions.push(`recorded_at >= $${params.length}::timestamptz`);
    }
    if (plan.toDate) {
      params.push(plan.toDate.toISOString());
      conditions.push(`recorded_at <= $${params.length}::timestamptz`);
    }

    const { rows } = await runQuery(
      queryable,
      `SELECT
        recorded_at,
        cpu_pct,
        ram_used_mb,
        ram_pct,
        disk_used_gb,
        disk_pct,
        net_in_mbps,
        net_out_mbps
      FROM cloud_droplet_telemetry_samples
      WHERE ${conditions.join(' AND ')}
      ORDER BY recorded_at ASC, id ASC`,
      params
    );

    const points = rows.map((r) => {
      const cpu = Number(r.cpu_pct) || 0;
      const ram = Number(r.ram_pct) || 0;
      return {
        timestamp: new Date(r.recorded_at).toISOString(),
        cpuPct: cpu,
        maxCpuPct: cpu,
        ramPct: ram,
        maxRamPct: ram,
        diskPct: Number(r.disk_pct) || 0,
        netInMbps: Number(r.net_in_mbps) || 0,
        netOutMbps: Number(r.net_out_mbps) || 0,
        ramUsedMb: Number(r.ram_used_mb) || 0,
        diskUsedGb: Number(r.disk_used_gb) || 0,
        samplesCount: 1
      };
    });

    return {
      range: plan.effectiveRange,
      resolution: plan.resolution,
      points,
      summary: buildSummary(points, points.length ? points[points.length - 1].timestamp : null)
    };
  }

  if (plan.resolution === 'hourly') {
    const conditions = ['droplet_id = $1'];
    const params = [cleanDropletId];

    if (cleanUserId) {
      params.push(cleanUserId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (plan.fromDate) {
      params.push(plan.fromDate.toISOString());
      conditions.push(`recorded_at >= $${params.length}::timestamptz`);
    }
    if (plan.toDate) {
      params.push(plan.toDate.toISOString());
      conditions.push(`recorded_at <= $${params.length}::timestamptz`);
    }

    const { rows } = await runQuery(
      queryable,
      `SELECT
        to_char(date_trunc('hour', recorded_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS".000Z"') AS bucket_iso,
        COUNT(*)::int AS samples_count,
        ROUND(AVG(cpu_pct), 2) AS avg_cpu_pct,
        MAX(cpu_pct) AS max_cpu_pct,
        ROUND(AVG(ram_pct), 2) AS avg_ram_pct,
        MAX(ram_pct) AS max_ram_pct,
        ROUND(AVG(disk_pct), 2) AS avg_disk_pct,
        ROUND(AVG(net_in_mbps), 2) AS avg_net_in_mbps,
        ROUND(AVG(net_out_mbps), 2) AS avg_net_out_mbps,
        MAX(recorded_at) AS latest_recorded_at
      FROM cloud_droplet_telemetry_samples
      WHERE ${conditions.join(' AND ')}
      GROUP BY date_trunc('hour', recorded_at AT TIME ZONE 'UTC')
      ORDER BY date_trunc('hour', recorded_at AT TIME ZONE 'UTC') ASC`,
      params
    );

    let latestRecordedAt = null;
    const points = rows.map((r) => {
      const recIso = r.latest_recorded_at ? new Date(r.latest_recorded_at).toISOString() : null;
      if (recIso && (!latestRecordedAt || recIso > latestRecordedAt)) {
        latestRecordedAt = recIso;
      }
      return {
        timestamp: r.bucket_iso,
        cpuPct: Number(r.avg_cpu_pct) || 0,
        maxCpuPct: Number(r.max_cpu_pct) || 0,
        ramPct: Number(r.avg_ram_pct) || 0,
        maxRamPct: Number(r.max_ram_pct) || 0,
        diskPct: Number(r.avg_disk_pct) || 0,
        netInMbps: Number(r.avg_net_in_mbps) || 0,
        netOutMbps: Number(r.avg_net_out_mbps) || 0,
        samplesCount: Number(r.samples_count) || 0
      };
    });

    return {
      range: plan.effectiveRange,
      resolution: plan.resolution,
      points,
      summary: buildSummary(points, latestRecordedAt)
    };
  }

  // resolution === 'daily' -> permanent lifetime rollup table
  const conditions = ['droplet_id = $1'];
  const params = [cleanDropletId];

  if (cleanUserId) {
    params.push(cleanUserId);
    conditions.push(`user_id = $${params.length}`);
  }
  if (plan.fromDate) {
    params.push(toUtcDayDate(plan.fromDate));
    conditions.push(`day_date >= $${params.length}::date`);
  }
  if (plan.toDate) {
    params.push(toUtcDayDate(plan.toDate));
    conditions.push(`day_date <= $${params.length}::date`);
  }

  const { rows } = await runQuery(
    queryable,
    `SELECT
      to_char(day_date, 'YYYY-MM-DD') AS day_date,
      samples_count,
      avg_cpu_pct,
      max_cpu_pct,
      avg_ram_pct,
      max_ram_pct,
      avg_disk_pct,
      disk_used_gb,
      net_in_gb,
      net_out_gb,
      updated_at
    FROM cloud_droplet_telemetry_daily
    WHERE ${conditions.join(' AND ')}
    ORDER BY day_date ASC`,
    params
  );

  const points = rows.map((r) => {
    const samplesCount = Number(r.samples_count) || 0;
    const netInGb = Number(r.net_in_gb) || 0;
    const netOutGb = Number(r.net_out_gb) || 0;
    return {
      timestamp: `${r.day_date}T00:00:00.000Z`,
      dayDate: r.day_date,
      cpuPct: Number(r.avg_cpu_pct) || 0,
      maxCpuPct: Number(r.max_cpu_pct) || 0,
      ramPct: Number(r.avg_ram_pct) || 0,
      maxRamPct: Number(r.max_ram_pct) || 0,
      diskPct: Number(r.avg_disk_pct) || 0,
      netInMbps: gbToAvgMbps(netInGb, samplesCount),
      netOutMbps: gbToAvgMbps(netOutGb, samplesCount),
      diskUsedGb: Number(r.disk_used_gb) || 0,
      netInGb,
      netOutGb,
      samplesCount
    };
  });

  return {
    range: plan.effectiveRange,
    resolution: plan.resolution,
    points,
    summary: buildSummary(points, points.length ? points[points.length - 1].timestamp : null)
  };
}

// ==========================================
// RETENTION PRUNING (PRESERVES LIFETIME DAILY)
// ==========================================

export async function purgeTelemetryOlderSamplesKeepLifetimeDaily({
  retentionDays = DEFAULT_SAMPLE_RETENTION_DAYS,
  now = new Date(),
  dropletId = null,
  queryable = null
} = {}) {
  const days = Math.max(1, Number(retentionDays) || DEFAULT_SAMPLE_RETENTION_DAYS);
  const nowDate = parseDateInput(now) || new Date();
  const cutoffDate = new Date(nowDate.getTime() - days * DAY_MS);
  const cutoffIso = cutoffDate.toISOString();
  const cleanDropletId = dropletId !== null && dropletId !== undefined && String(dropletId).trim() !== ''
    ? String(dropletId).trim()
    : null;

  if (!queryable && !isPgActive()) {
    let deletedSamples = 0;
    for (let i = memorySamples.length - 1; i >= 0; i -= 1) {
      const s = memorySamples[i];
      if (cleanDropletId && s.dropletId !== cleanDropletId) continue;
      if (Date.parse(s.recordedAt) < cutoffDate.getTime()) {
        memorySamples.splice(i, 1);
        deletedSamples += 1;
      }
    }

    return {
      deletedSamples,
      retentionDays: days,
      cutoffAt: cutoffIso,
      dailyRollupsPreserved: true,
      remainingSamples: memorySamples.length,
      remainingDailyRows: memoryDaily.size
    };
  }

  await ensureSchemaIfNeeded(queryable);

  const conditions = ['recorded_at < $1::timestamptz'];
  const params = [cutoffIso];
  if (cleanDropletId) {
    params.push(cleanDropletId);
    conditions.push(`droplet_id = $${params.length}`);
  }

  const { rows } = await runQuery(
    queryable,
    `WITH deleted AS (
      DELETE FROM cloud_droplet_telemetry_samples
      WHERE ${conditions.join(' AND ')}
      RETURNING id
    )
    SELECT COUNT(*)::int AS deleted_samples FROM deleted`,
    params
  );

  return {
    deletedSamples: Number(rows[0]?.deleted_samples || 0),
    retentionDays: days,
    cutoffAt: cutoffIso,
    dailyRollupsPreserved: true
  };
}

export const pruneHighResSamplesKeepLifetimeDaily = purgeTelemetryOlderSamplesKeepLifetimeDaily;
