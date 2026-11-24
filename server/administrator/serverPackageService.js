import { DROPLET_IMAGE_CATALOG } from '../db/cloudCatalogConstants.js';
import { getPgPool, isPgActive, queryPg } from '../db/postgres.js';

export const PACKAGE_CATEGORIES = Object.freeze([
  'standard',
  'cpu_optimized',
  'memory_optimized',
  'storage_nvme'
]);

export const IMAGE_TYPES = Object.freeze(['os', 'app']);

export const DEFAULT_SERVER_PACKAGES = Object.freeze([
  Object.freeze({
    id: 'pkg-micro',
    name: 'Micro',
    category: 'standard',
    monthlyPriceUsd: 4.0,
    displayedVcpus: 1,
    displayedRamGb: 1.0,
    displayedStorageGb: 25,
    displayedBandwidthTb: 1.0,
    backendCpuQuotaPct: 50,
    backendRamMb: 512,
    backendStorageGb: 15,
    burstRamMb: 256,
    isActive: true,
    sortOrder: 1,
    description: 'Entry droplet for static sites, lightweight APIs, and staging.'
  }),
  Object.freeze({
    id: 'pkg-standard',
    name: 'Standard',
    category: 'standard',
    monthlyPriceUsd: 8.0,
    displayedVcpus: 2,
    displayedRamGb: 2.0,
    displayedStorageGb: 50,
    displayedBandwidthTb: 2.0,
    backendCpuQuotaPct: 100,
    backendRamMb: 1024,
    backendStorageGb: 35,
    burstRamMb: 512,
    isActive: true,
    sortOrder: 2,
    description: 'Balanced general-purpose compute for production web apps.'
  }),
  Object.freeze({
    id: 'pkg-pro',
    name: 'Pro',
    category: 'standard',
    monthlyPriceUsd: 16.0,
    displayedVcpus: 4,
    displayedRamGb: 4.0,
    displayedStorageGb: 80,
    displayedBandwidthTb: 4.0,
    backendCpuQuotaPct: 200,
    backendRamMb: 2560,
    backendStorageGb: 60,
    burstRamMb: 512,
    isActive: true,
    sortOrder: 3,
    description: 'High-throughput multi-service workloads and managed containers.'
  }),
  Object.freeze({
    id: 'pkg-compute',
    name: 'Compute',
    category: 'cpu_optimized',
    monthlyPriceUsd: 24.0,
    displayedVcpus: 4,
    displayedRamGb: 4.0,
    displayedStorageGb: 100,
    displayedBandwidthTb: 5.0,
    backendCpuQuotaPct: 300,
    backendRamMb: 3072,
    backendStorageGb: 80,
    burstRamMb: 512,
    isActive: true,
    sortOrder: 4,
    description: 'CPU-optimized allocation for CI runners, workers, and SSR.'
  }),
  Object.freeze({
    id: 'pkg-memory',
    name: 'Memory',
    category: 'memory_optimized',
    monthlyPriceUsd: 32.0,
    displayedVcpus: 4,
    displayedRamGb: 8.0,
    displayedStorageGb: 120,
    displayedBandwidthTb: 5.0,
    backendCpuQuotaPct: 250,
    backendRamMb: 6144,
    backendStorageGb: 90,
    burstRamMb: 1024,
    isActive: true,
    sortOrder: 5,
    description: 'Memory-dense plan suited for caches, databases, and JVM apps.'
  }),
  Object.freeze({
    id: 'pkg-storage-nvme',
    name: 'Storage NVMe',
    category: 'storage_nvme',
    monthlyPriceUsd: 40.0,
    displayedVcpus: 4,
    displayedRamGb: 8.0,
    displayedStorageGb: 250,
    displayedBandwidthTb: 8.0,
    backendCpuQuotaPct: 250,
    backendRamMb: 6144,
    backendStorageGb: 200,
    burstRamMb: 1024,
    isActive: true,
    sortOrder: 6,
    description: 'High-capacity NVMe storage tier for media, backups, and analytics.'
  })
]);

const DEFAULT_OS_IMAGES = Object.freeze(
  DROPLET_IMAGE_CATALOG.map((img) =>
    Object.freeze({
      id: img.id,
      name: img.name,
      os: img.os,
      version: img.version || '',
      type: img.type === 'app' ? 'app' : 'os',
      iconUrl: img.iconUrl || null,
      runtimeImage: img.runtimeImage || null,
      monthlySurchargeUsd: 0,
      available: img.id === 'ubuntu-24' ? true : Boolean(img.available),
      description: img.version ? `${img.name} (${img.version})` : img.name
    })
  )
);

const DEFAULT_CUSTOM_BUILDER_CONFIG = Object.freeze({
  enabled: false,
  pricePerVcpuMonthly: 3.0,
  pricePerRamGbMonthly: 2.0,
  pricePerStorageGbMonthly: 0.15,
  pricePerBandwidthTbMonthly: 1.0,
  minVcpus: 1,
  maxVcpus: 32,
  minRamGb: 1,
  maxRamGb: 128,
  minStorageGb: 10,
  maxStorageGb: 2000
});

const CUSTOM_BUILDER_SETTING_KEY = 'custom_builder';

const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{1,62}$/;
const PACKAGE_CATEGORY_SET = new Set(PACKAGE_CATEGORIES);
const IMAGE_TYPE_SET = new Set(IMAGE_TYPES);

let pgSchemaReady = false;
let pgSchemaPromise = null;

const memoryPackages = new Map();
const memoryImages = new Map();
const memorySettings = new Map();
let memorySeeded = false;

function usePg() {
  return isPgActive() && Boolean(getPgPool());
}

function createInputError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function roundTo(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

function slugifyId(raw, prefix = '') {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  if (!base) return '';
  if (!prefix || base.startsWith(prefix)) return base;
  return `${prefix}${base}`.slice(0, 63);
}

function parseBooleanInput(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function parseFiniteNumber(value, fieldLabel, { min = -Infinity, max = Infinity, integer = false, decimals = 2 } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw createInputError(`${fieldLabel} must be a valid finite number.`);
  }
  if (integer && !Number.isInteger(num)) {
    throw createInputError(`${fieldLabel} must be a whole integer.`);
  }
  if (num < min) {
    throw createInputError(`${fieldLabel} must be at least ${min}.`);
  }
  if (num > max) {
    throw createInputError(`${fieldLabel} must not exceed ${max}.`);
  }
  return integer ? Math.trunc(num) : roundTo(num, decimals);
}

function parseMemoryMbFromString(raw) {
  const str = String(raw || '').trim().toUpperCase();
  if (!str) return null;
  const match = str.match(/([0-9]+(?:\.[0-9]+)?)\s*(TB|GB|MB)?/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  const unit = match[2] || 'GB';
  if (unit === 'TB') return Math.round(num * 1024 * 1024);
  if (unit === 'MB') return Math.round(num);
  return Math.round(num * 1024);
}

function parseStorageGbFromString(raw) {
  const str = String(raw || '').trim().toUpperCase();
  if (!str) return null;
  const match = str.match(/([0-9]+(?:\.[0-9]+)?)\s*(TB|GB)?/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  const unit = match[2] || 'GB';
  return unit === 'TB' ? Math.round(num * 1024) : Math.round(num);
}

function toPackageRecordFromSeed(pkg, nowIso) {
  return {
    id: pkg.id,
    name: pkg.name,
    category: pkg.category,
    monthly_price_usd: pkg.monthlyPriceUsd,
    displayed_vcpus: pkg.displayedVcpus,
    displayed_ram_gb: pkg.displayedRamGb,
    displayed_storage_gb: pkg.displayedStorageGb,
    displayed_bandwidth_tb: pkg.displayedBandwidthTb,
    backend_cpu_quota_pct: pkg.backendCpuQuotaPct,
    backend_ram_mb: pkg.backendRamMb,
    backend_storage_gb: pkg.backendStorageGb,
    burst_ram_mb: pkg.burstRamMb,
    is_active: pkg.isActive,
    sort_order: pkg.sortOrder,
    description: pkg.description || '',
    created_at: nowIso,
    updated_at: nowIso
  };
}

function toImageRecordFromSeed(img, nowIso) {
  return {
    id: img.id,
    name: img.name,
    os: img.os,
    version: img.version || '',
    type: img.type,
    icon_url: img.iconUrl || null,
    runtime_image: img.runtimeImage || null,
    monthly_surcharge_usd: img.monthlySurchargeUsd,
    available: img.available,
    description: img.description || '',
    updated_at: nowIso
  };
}

function ensureInMemorySeeded() {
  if (memorySeeded) return;
  const nowIso = new Date().toISOString();
  for (const pkg of DEFAULT_SERVER_PACKAGES) {
    if (!memoryPackages.has(pkg.id)) {
      memoryPackages.set(pkg.id, toPackageRecordFromSeed(pkg, nowIso));
    }
  }
  for (const img of DEFAULT_OS_IMAGES) {
    if (!memoryImages.has(img.id)) {
      memoryImages.set(img.id, toImageRecordFromSeed(img, nowIso));
    }
  }
  if (!memorySettings.has(CUSTOM_BUILDER_SETTING_KEY)) {
    memorySettings.set(CUSTOM_BUILDER_SETTING_KEY, {
      key: CUSTOM_BUILDER_SETTING_KEY,
      value: { ...DEFAULT_CUSTOM_BUILDER_CONFIG },
      updated_by: null,
      updated_at: nowIso
    });
  }
  memorySeeded = true;
}

export function resetInMemoryServerPackagesForTests() {
  memoryPackages.clear();
  memoryImages.clear();
  memorySettings.clear();
  memorySeeded = false;
  pgSchemaReady = false;
  pgSchemaPromise = null;
  ensureInMemorySeeded();
}

function toPackageDto(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category || 'standard'),
    monthlyPriceUsd: roundTo(row.monthly_price_usd ?? row.monthlyPriceUsd ?? 0, 2),
    displayedVcpus: Number(row.displayed_vcpus ?? row.displayedVcpus ?? 1),
    displayedRamGb: roundTo(row.displayed_ram_gb ?? row.displayedRamGb ?? 1, 2),
    displayedStorageGb: Number(row.displayed_storage_gb ?? row.displayedStorageGb ?? 25),
    displayedBandwidthTb: roundTo(row.displayed_bandwidth_tb ?? row.displayedBandwidthTb ?? 1, 2),
    backendCpuQuotaPct: Number(row.backend_cpu_quota_pct ?? row.backendCpuQuotaPct ?? 50),
    backendRamMb: Number(row.backend_ram_mb ?? row.backendRamMb ?? 512),
    backendStorageGb: Number(row.backend_storage_gb ?? row.backendStorageGb ?? 15),
    burstRamMb: Number(row.burst_ram_mb ?? row.burstRamMb ?? 0),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    description: row.description != null ? String(row.description) : '',
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}

function toImageDto(row) {
  if (!row) return null;
  const available = Boolean(row.available);
  return {
    id: String(row.id),
    name: String(row.name),
    os: String(row.os),
    version: row.version != null ? String(row.version) : '',
    type: String(row.type || 'os'),
    iconUrl: row.icon_url ?? row.iconUrl ?? null,
    runtimeImage: row.runtime_image ?? row.runtimeImage ?? null,
    monthlySurchargeUsd: roundTo(row.monthly_surcharge_usd ?? row.monthlySurchargeUsd ?? 0, 2),
    available,
    badge: available ? 'Available' : 'Unavailable',
    description: row.description != null ? String(row.description) : '',
    updatedAt: row.updated_at || row.updatedAt || null
  };
}

function validateAndNormalizePackagePayload(payload = {}, existing = null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createInputError('Package payload must be an object.');
  }

  const rawName = payload.name !== undefined ? payload.name : existing?.name;
  const name = String(rawName || '').trim();
  if (!name || name.length > 120) {
    throw createInputError('Package name is required and must be 1–120 characters.');
  }

  const rawId = payload.id !== undefined ? payload.id : existing?.id;
  const id = rawId ? String(rawId).trim().toLowerCase() : slugifyId(name, 'pkg-');
  if (!VALID_ID_RE.test(id)) {
    throw createInputError('Package id must be 2–63 characters of lowercase letters, numbers, underscores, or hyphens.');
  }

  const rawCategory = payload.category !== undefined ? payload.category : (existing?.category || 'standard');
  const category = String(rawCategory).trim().toLowerCase();
  if (!PACKAGE_CATEGORY_SET.has(category)) {
    throw createInputError(`Invalid package category. Expected one of: ${PACKAGE_CATEGORIES.join(', ')}.`);
  }

  const monthlyPriceUsd = parseFiniteNumber(
    payload.monthlyPriceUsd ?? payload.monthly_price_usd ?? existing?.monthlyPriceUsd,
    'monthlyPriceUsd',
    { min: 0, max: 1000000, decimals: 2 }
  );

  const displayedVcpus = parseFiniteNumber(
    payload.displayedVcpus ?? payload.displayed_vcpus ?? existing?.displayedVcpus,
    'displayedVcpus',
    { min: 1, max: 256, integer: true }
  );

  const displayedRamGb = parseFiniteNumber(
    payload.displayedRamGb ?? payload.displayed_ram_gb ?? existing?.displayedRamGb,
    'displayedRamGb',
    { min: 0.5, max: 4096, decimals: 2 }
  );

  const displayedStorageGb = parseFiniteNumber(
    payload.displayedStorageGb ?? payload.displayed_storage_gb ?? existing?.displayedStorageGb,
    'displayedStorageGb',
    { min: 1, max: 100000, integer: true }
  );

  const displayedBandwidthTb = parseFiniteNumber(
    payload.displayedBandwidthTb ?? payload.displayed_bandwidth_tb ?? existing?.displayedBandwidthTb ?? 1,
    'displayedBandwidthTb',
    { min: 0, max: 10000, decimals: 2 }
  );

  const backendCpuQuotaPct = parseFiniteNumber(
    payload.backendCpuQuotaPct ?? payload.backend_cpu_quota_pct ?? existing?.backendCpuQuotaPct,
    'backendCpuQuotaPct',
    { min: 10, max: 25600, integer: true }
  );

  const backendRamMb = parseFiniteNumber(
    payload.backendRamMb ?? payload.backend_ram_mb ?? existing?.backendRamMb,
    'backendRamMb',
    { min: 128, max: 4194304, integer: true }
  );

  const backendStorageGb = parseFiniteNumber(
    payload.backendStorageGb ?? payload.backend_storage_gb ?? existing?.backendStorageGb,
    'backendStorageGb',
    { min: 1, max: 100000, integer: true }
  );

  const burstRamMb = parseFiniteNumber(
    payload.burstRamMb ?? payload.burst_ram_mb ?? existing?.burstRamMb ?? 0,
    'burstRamMb',
    { min: 0, max: 1048576, integer: true }
  );

  const sortOrder = parseFiniteNumber(
    payload.sortOrder ?? payload.sort_order ?? existing?.sortOrder ?? 0,
    'sortOrder',
    { min: -10000, max: 100000, integer: true }
  );

  const isActive = parseBooleanInput(
    payload.isActive ?? payload.is_active,
    existing ? existing.isActive : true
  );

  const rawDesc = payload.description !== undefined ? payload.description : (existing?.description ?? '');
  const description = String(rawDesc || '').trim().slice(0, 1000);

  return {
    id,
    name,
    category,
    monthlyPriceUsd,
    displayedVcpus,
    displayedRamGb,
    displayedStorageGb,
    displayedBandwidthTb,
    backendCpuQuotaPct,
    backendRamMb,
    backendStorageGb,
    burstRamMb,
    isActive,
    sortOrder,
    description
  };
}

function validateAndNormalizeImagePayload(payload = {}, existing = null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createInputError('OS image payload must be an object.');
  }

  const rawName = payload.name !== undefined ? payload.name : existing?.name;
  const name = String(rawName || '').trim();
  if (!name || name.length > 120) {
    throw createInputError('OS image name is required and must be 1–120 characters.');
  }

  const rawId = payload.id !== undefined ? payload.id : existing?.id;
  const id = rawId ? String(rawId).trim().toLowerCase() : slugifyId(name);
  if (!VALID_ID_RE.test(id)) {
    throw createInputError('OS image id must be 2–63 characters of lowercase letters, numbers, underscores, or hyphens.');
  }

  const rawOs = payload.os !== undefined ? payload.os : (existing?.os || name.split(/\s+/)[0]);
  const os = String(rawOs || '').trim();
  if (!os || os.length > 80) {
    throw createInputError('OS family name is required and must be 1–80 characters.');
  }

  const rawVersion = payload.version !== undefined ? payload.version : (existing?.version ?? '');
  const version = String(rawVersion || '').trim().slice(0, 160);

  const rawType = payload.type !== undefined ? payload.type : (existing?.type || 'os');
  const type = String(rawType).trim().toLowerCase();
  if (!IMAGE_TYPE_SET.has(type)) {
    throw createInputError(`Invalid image type. Expected one of: ${IMAGE_TYPES.join(', ')}.`);
  }

  const monthlySurchargeUsd = parseFiniteNumber(
    payload.monthlySurchargeUsd ?? payload.monthly_surcharge_usd ?? existing?.monthlySurchargeUsd ?? 0,
    'monthlySurchargeUsd',
    { min: 0, max: 100000, decimals: 2 }
  );

  const available = parseBooleanInput(
    payload.available,
    existing ? existing.available : false
  );

  const rawIconUrl = payload.iconUrl !== undefined
    ? payload.iconUrl
    : (payload.icon_url !== undefined ? payload.icon_url : existing?.iconUrl);
  const iconUrl = rawIconUrl ? String(rawIconUrl).trim().slice(0, 500) : null;

  const rawRuntimeImage = payload.runtimeImage !== undefined
    ? payload.runtimeImage
    : (payload.runtime_image !== undefined ? payload.runtime_image : existing?.runtimeImage);
  const runtimeImage = rawRuntimeImage ? String(rawRuntimeImage).trim().slice(0, 500) : null;

  const rawDescription = payload.description !== undefined ? payload.description : (existing?.description ?? '');
  const description = String(rawDescription || '').trim().slice(0, 1000);

  return {
    id,
    name,
    os,
    version,
    type,
    iconUrl,
    runtimeImage,
    monthlySurchargeUsd,
    available,
    description
  };
}

export async function ensureServerPackageSchema() {
  if (!usePg()) {
    ensureInMemorySeeded();
    return { ok: true, mode: 'memory' };
  }
  if (pgSchemaReady) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (pgSchemaPromise) {
    return pgSchemaPromise;
  }

  pgSchemaPromise = (async () => {
    await queryPg(`
      CREATE TABLE IF NOT EXISTS system_server_packages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'standard',
        monthly_price_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
        displayed_vcpus INT NOT NULL DEFAULT 1,
        displayed_ram_gb NUMERIC(8,2) NOT NULL DEFAULT 1,
        displayed_storage_gb INT NOT NULL DEFAULT 25,
        displayed_bandwidth_tb NUMERIC(8,2) NOT NULL DEFAULT 1,
        backend_cpu_quota_pct INT NOT NULL DEFAULT 50,
        backend_ram_mb INT NOT NULL DEFAULT 512,
        backend_storage_gb INT NOT NULL DEFAULT 15,
        burst_ram_mb INT NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        description TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_server_packages_active_sort
        ON system_server_packages (is_active, category, sort_order);

      CREATE TABLE IF NOT EXISTS system_server_os_images (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        os TEXT NOT NULL,
        version TEXT DEFAULT '',
        type TEXT NOT NULL DEFAULT 'os',
        icon_url TEXT,
        runtime_image TEXT,
        monthly_surcharge_usd NUMERIC(12,2) DEFAULT 0,
        available BOOLEAN DEFAULT FALSE,
        description TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_server_os_images_avail
        ON system_server_os_images (available, type);

      CREATE TABLE IF NOT EXISTS system_server_package_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const pkgCountRes = await queryPg('SELECT COUNT(*)::int AS cnt FROM system_server_packages');
    if (Number(pkgCountRes.rows?.[0]?.cnt || 0) === 0) {
      for (const pkg of DEFAULT_SERVER_PACKAGES) {
        await queryPg(
          `INSERT INTO system_server_packages (
             id, name, category, monthly_price_usd,
             displayed_vcpus, displayed_ram_gb, displayed_storage_gb, displayed_bandwidth_tb,
             backend_cpu_quota_pct, backend_ram_mb, backend_storage_gb, burst_ram_mb,
             is_active, sort_order, description
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            pkg.id,
            pkg.name,
            pkg.category,
            pkg.monthlyPriceUsd,
            pkg.displayedVcpus,
            pkg.displayedRamGb,
            pkg.displayedStorageGb,
            pkg.displayedBandwidthTb,
            pkg.backendCpuQuotaPct,
            pkg.backendRamMb,
            pkg.backendStorageGb,
            pkg.burstRamMb,
            pkg.isActive,
            pkg.sortOrder,
            pkg.description
          ]
        );
      }
    }

    const imgCountRes = await queryPg('SELECT COUNT(*)::int AS cnt FROM system_server_os_images');
    if (Number(imgCountRes.rows?.[0]?.cnt || 0) === 0) {
      for (const img of DEFAULT_OS_IMAGES) {
        await queryPg(
          `INSERT INTO system_server_os_images (
             id, name, os, version, type, icon_url, runtime_image,
             monthly_surcharge_usd, available, description
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            img.id,
            img.name,
            img.os,
            img.version,
            img.type,
            img.iconUrl,
            img.runtimeImage,
            img.monthlySurchargeUsd,
            img.available,
            img.description
          ]
        );
      }
    }

    await queryPg(
      `INSERT INTO system_server_package_settings (key, value)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [CUSTOM_BUILDER_SETTING_KEY, JSON.stringify(DEFAULT_CUSTOM_BUILDER_CONFIG)]
    );

    pgSchemaReady = true;
    return { ok: true, mode: 'postgres' };
  })().finally(() => {
    pgSchemaPromise = null;
  });

  return pgSchemaPromise;
}

export async function getServerPackageById(id) {
  const cleanId = String(id || '').trim().toLowerCase();
  if (!cleanId) return null;

  await ensureServerPackageSchema();
  if (usePg()) {
    const { rows } = await queryPg('SELECT * FROM system_server_packages WHERE id = $1 LIMIT 1', [cleanId]);
    return rows[0] ? toPackageDto(rows[0]) : null;
  }

  const existing = memoryPackages.get(cleanId);
  return existing ? toPackageDto(existing) : null;
}

export async function listServerPackages({
  includeInactive = true,
  category = '',
  q = '',
  page = 1,
  pageSize = 20
} = {}) {
  await ensureServerPackageSchema();

  const safeIncludeInactive = parseBooleanInput(includeInactive, true);
  const cleanCategory = String(category || '').trim().toLowerCase();
  const cleanQuery = String(q || '').trim().toLowerCase();
  const safePage = Math.max(1, Math.trunc(Number(page) || 1));
  const safePageSize = Math.max(1, Math.min(100, Math.trunc(Number(pageSize) || 20)));

  if (usePg()) {
    const conditions = [];
    const params = [];

    if (!safeIncludeInactive) {
      conditions.push('is_active = TRUE');
    }
    if (cleanCategory) {
      params.push(cleanCategory);
      conditions.push(`category = $${params.length}`);
    }
    if (cleanQuery) {
      params.push(`%${cleanQuery}%`);
      const pIdx = params.length;
      conditions.push(`(LOWER(id) LIKE $${pIdx} OR LOWER(name) LIKE $${pIdx} OR LOWER(category) LIKE $${pIdx} OR LOWER(COALESCE(description, '')) LIKE $${pIdx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await queryPg(`SELECT COUNT(*)::int AS total FROM system_server_packages ${whereClause}`, params);
    const total = Number(countRes.rows?.[0]?.total || 0);

    const offset = (safePage - 1) * safePageSize;
    const dataParams = [...params, safePageSize, offset];
    const { rows } = await queryPg(
      `SELECT * FROM system_server_packages ${whereClause}
       ORDER BY sort_order ASC, monthly_price_usd ASC, name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    return {
      packages: rows.map(toPackageDto),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    };
  }

  let items = Array.from(memoryPackages.values()).map(toPackageDto);
  if (!safeIncludeInactive) {
    items = items.filter((item) => item.isActive);
  }
  if (cleanCategory) {
    items = items.filter((item) => item.category === cleanCategory);
  }
  if (cleanQuery) {
    items = items.filter((item) =>
      item.id.toLowerCase().includes(cleanQuery) ||
      item.name.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery) ||
      item.description.toLowerCase().includes(cleanQuery)
    );
  }

  items.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.monthlyPriceUsd !== b.monthlyPriceUsd) return a.monthlyPriceUsd - b.monthlyPriceUsd;
    return a.name.localeCompare(b.name);
  });

  const total = items.length;
  const offset = (safePage - 1) * safePageSize;
  const packages = items.slice(offset, offset + safePageSize);

  return {
    packages,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize))
  };
}

export async function upsertServerPackage(payload = {}, _actorId = null) {
  await ensureServerPackageSchema();

  const targetId = payload?.id ? String(payload.id).trim().toLowerCase() : '';
  const existing = targetId ? await getServerPackageById(targetId) : null;
  const normalized = validateAndNormalizePackagePayload(payload, existing);

  if (usePg()) {
    const { rows } = await queryPg(
      `INSERT INTO system_server_packages (
         id, name, category, monthly_price_usd,
         displayed_vcpus, displayed_ram_gb, displayed_storage_gb, displayed_bandwidth_tb,
         backend_cpu_quota_pct, backend_ram_mb, backend_storage_gb, burst_ram_mb,
         is_active, sort_order, description, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         monthly_price_usd = EXCLUDED.monthly_price_usd,
         displayed_vcpus = EXCLUDED.displayed_vcpus,
         displayed_ram_gb = EXCLUDED.displayed_ram_gb,
         displayed_storage_gb = EXCLUDED.displayed_storage_gb,
         displayed_bandwidth_tb = EXCLUDED.displayed_bandwidth_tb,
         backend_cpu_quota_pct = EXCLUDED.backend_cpu_quota_pct,
         backend_ram_mb = EXCLUDED.backend_ram_mb,
         backend_storage_gb = EXCLUDED.backend_storage_gb,
         burst_ram_mb = EXCLUDED.burst_ram_mb,
         is_active = EXCLUDED.is_active,
         sort_order = EXCLUDED.sort_order,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        normalized.id,
        normalized.name,
        normalized.category,
        normalized.monthlyPriceUsd,
        normalized.displayedVcpus,
        normalized.displayedRamGb,
        normalized.displayedStorageGb,
        normalized.displayedBandwidthTb,
        normalized.backendCpuQuotaPct,
        normalized.backendRamMb,
        normalized.backendStorageGb,
        normalized.burstRamMb,
        normalized.isActive,
        normalized.sortOrder,
        normalized.description
      ]
    );
    return toPackageDto(rows[0]);
  }

  const nowIso = new Date().toISOString();
  const prevRow = memoryPackages.get(normalized.id);
  const record = {
    id: normalized.id,
    name: normalized.name,
    category: normalized.category,
    monthly_price_usd: normalized.monthlyPriceUsd,
    displayed_vcpus: normalized.displayedVcpus,
    displayed_ram_gb: normalized.displayedRamGb,
    displayed_storage_gb: normalized.displayedStorageGb,
    displayed_bandwidth_tb: normalized.displayedBandwidthTb,
    backend_cpu_quota_pct: normalized.backendCpuQuotaPct,
    backend_ram_mb: normalized.backendRamMb,
    backend_storage_gb: normalized.backendStorageGb,
    burst_ram_mb: normalized.burstRamMb,
    is_active: normalized.isActive,
    sort_order: normalized.sortOrder,
    description: normalized.description,
    created_at: prevRow?.created_at || nowIso,
    updated_at: nowIso
  };
  memoryPackages.set(normalized.id, record);
  return toPackageDto(record);
}

export async function deleteServerPackage(id) {
  const cleanId = String(id || '').trim().toLowerCase();
  if (!cleanId) return false;

  await ensureServerPackageSchema();
  if (usePg()) {
    const res = await queryPg('DELETE FROM system_server_packages WHERE id = $1 RETURNING id', [cleanId]);
    return res.rowCount > 0;
  }

  return memoryPackages.delete(cleanId);
}

export async function getServerOsImageById(id) {
  const cleanId = String(id || '').trim().toLowerCase();
  if (!cleanId) return null;

  await ensureServerPackageSchema();
  if (usePg()) {
    const { rows } = await queryPg('SELECT * FROM system_server_os_images WHERE id = $1 LIMIT 1', [cleanId]);
    return rows[0] ? toImageDto(rows[0]) : null;
  }

  const existing = memoryImages.get(cleanId);
  return existing ? toImageDto(existing) : null;
}

export async function listServerOsImages({ onlyAvailable = false } = {}) {
  await ensureServerPackageSchema();
  const safeOnlyAvailable = parseBooleanInput(onlyAvailable, false);

  if (usePg()) {
    const whereClause = safeOnlyAvailable ? 'WHERE available = TRUE' : '';
    const { rows } = await queryPg(
      `SELECT * FROM system_server_os_images ${whereClause}
       ORDER BY available DESC, type DESC, name ASC`
    );
    return rows.map(toImageDto);
  }

  let items = Array.from(memoryImages.values()).map(toImageDto);
  if (safeOnlyAvailable) {
    items = items.filter((img) => img.available);
  }
  items.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.type !== b.type) return b.type.localeCompare(a.type);
    return a.name.localeCompare(b.name);
  });
  return items;
}

export async function upsertServerOsImage(payload = {}, _actorId = null) {
  await ensureServerPackageSchema();

  const targetId = payload?.id ? String(payload.id).trim().toLowerCase() : '';
  const existing = targetId ? await getServerOsImageById(targetId) : null;
  const normalized = validateAndNormalizeImagePayload(payload, existing);

  if (usePg()) {
    const { rows } = await queryPg(
      `INSERT INTO system_server_os_images (
         id, name, os, version, type, icon_url, runtime_image,
         monthly_surcharge_usd, available, description, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         os = EXCLUDED.os,
         version = EXCLUDED.version,
         type = EXCLUDED.type,
         icon_url = EXCLUDED.icon_url,
         runtime_image = EXCLUDED.runtime_image,
         monthly_surcharge_usd = EXCLUDED.monthly_surcharge_usd,
         available = EXCLUDED.available,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        normalized.id,
        normalized.name,
        normalized.os,
        normalized.version,
        normalized.type,
        normalized.iconUrl,
        normalized.runtimeImage,
        normalized.monthlySurchargeUsd,
        normalized.available,
        normalized.description
      ]
    );
    return toImageDto(rows[0]);
  }

  const nowIso = new Date().toISOString();
  const record = {
    id: normalized.id,
    name: normalized.name,
    os: normalized.os,
    version: normalized.version,
    type: normalized.type,
    icon_url: normalized.iconUrl,
    runtime_image: normalized.runtimeImage,
    monthly_surcharge_usd: normalized.monthlySurchargeUsd,
    available: normalized.available,
    description: normalized.description,
    updated_at: nowIso
  };
  memoryImages.set(normalized.id, record);
  return toImageDto(record);
}

export async function deleteServerOsImage(imageId) {
  await ensureServerPackageSchema();
  const cleanId = validateId(imageId, 'OS image id');
  if (usePg()) {
    const { rowCount } = await queryPg('DELETE FROM system_server_os_images WHERE id = $1', [cleanId]);
    return rowCount > 0;
  }
  return memoryImages.delete(cleanId);
}

export async function getServerPackagesOverview() {
  await ensureServerPackageSchema();

  const [packagesRes, images] = await Promise.all([
    listServerPackages({ includeInactive: true, page: 1, pageSize: 100 }),
    listServerOsImages({ onlyAvailable: false })
  ]);

  const packages = packagesRes.packages;
  const activePlans = packages.filter((p) => p.isActive);
  const availableImages = images.filter((img) => img.available);

  const allocationComparison = packages.map((pkg) => {
    const backendRamGb = roundTo(pkg.backendRamMb / 1024, 4);
    const backendVcpus = roundTo(pkg.backendCpuQuotaPct / 100, 4);

    const ramOvercommitRatio = backendRamGb > 0 ? roundTo(pkg.displayedRamGb / backendRamGb, 2) : 0;
    const cpuOvercommitRatio = backendVcpus > 0 ? roundTo(pkg.displayedVcpus / backendVcpus, 2) : 0;
    const storageOvercommitRatio = pkg.backendStorageGb > 0
      ? roundTo(pkg.displayedStorageGb / pkg.backendStorageGb, 2)
      : 0;

    return {
      id: pkg.id,
      name: pkg.name,
      category: pkg.category,
      isActive: pkg.isActive,
      monthlyPriceUsd: pkg.monthlyPriceUsd,
      displayedVcpus: pkg.displayedVcpus,
      backendCpuQuotaPct: pkg.backendCpuQuotaPct,
      backendVcpus,
      displayedRamGb: pkg.displayedRamGb,
      backendRamMb: pkg.backendRamMb,
      backendRamGb,
      burstRamMb: pkg.burstRamMb,
      displayedStorageGb: pkg.displayedStorageGb,
      backendStorageGb: pkg.backendStorageGb,
      cpuOvercommitRatio,
      ramOvercommitRatio,
      storageOvercommitRatio
    };
  });

  const activeRows = allocationComparison.filter((item) => item.isActive);
  const sum = (list, key) => list.reduce((acc, item) => acc + Number(item[key] || 0), 0);

  const totalDisplayedRamGb = roundTo(sum(activeRows, 'displayedRamGb'), 2);
  const totalBackendRamGb = roundTo(sum(activeRows, 'backendRamGb'), 2);
  const totalDisplayedVcpus = roundTo(sum(activeRows, 'displayedVcpus'), 2);
  const totalBackendVcpus = roundTo(sum(activeRows, 'backendVcpus'), 2);
  const totalDisplayedStorageGb = Math.round(sum(activeRows, 'displayedStorageGb'));
  const totalBackendStorageGb = Math.round(sum(activeRows, 'backendStorageGb'));

  const summary = {
    totalPackages: packages.length,
    activePlans: activePlans.length,
    inactivePlans: packages.length - activePlans.length,
    totalImages: images.length,
    availableImages: availableImages.length,
    unavailableImages: images.length - availableImages.length,
    paidAddonImages: images.filter((img) => img.monthlySurchargeUsd > 0).length,
    totalDisplayedVcpus,
    totalBackendVcpus,
    totalDisplayedRamGb,
    totalBackendRamGb,
    totalDisplayedStorageGb,
    totalBackendStorageGb,
    overallCpuOvercommitRatio: totalBackendVcpus > 0 ? roundTo(totalDisplayedVcpus / totalBackendVcpus, 2) : 0,
    overallRamOvercommitRatio: totalBackendRamGb > 0 ? roundTo(totalDisplayedRamGb / totalBackendRamGb, 2) : 0,
    overallStorageOvercommitRatio: totalBackendStorageGb > 0 ? roundTo(totalDisplayedStorageGb / totalBackendStorageGb, 2) : 0
  };

  return {
    summary,
    totalActivePlans: activePlans.length,
    availableImagesCount: availableImages.length,
    allocationComparison
  };
}

function normalizeCustomBuilderConfig(raw = {}, fallback = DEFAULT_CUSTOM_BUILDER_CONFIG) {
  const base = fallback || DEFAULT_CUSTOM_BUILDER_CONFIG;
  const enabled = parseBooleanInput(raw.enabled, base.enabled);

  const pricePerVcpuMonthly = parseFiniteNumber(
    raw.pricePerVcpuMonthly ?? base.pricePerVcpuMonthly,
    'pricePerVcpuMonthly',
    { min: 0, max: 10000, decimals: 2 }
  );
  const pricePerRamGbMonthly = parseFiniteNumber(
    raw.pricePerRamGbMonthly ?? base.pricePerRamGbMonthly,
    'pricePerRamGbMonthly',
    { min: 0, max: 10000, decimals: 2 }
  );
  const pricePerStorageGbMonthly = parseFiniteNumber(
    raw.pricePerStorageGbMonthly ?? base.pricePerStorageGbMonthly,
    'pricePerStorageGbMonthly',
    { min: 0, max: 1000, decimals: 2 }
  );
  const pricePerBandwidthTbMonthly = parseFiniteNumber(
    raw.pricePerBandwidthTbMonthly ?? base.pricePerBandwidthTbMonthly,
    'pricePerBandwidthTbMonthly',
    { min: 0, max: 1000, decimals: 2 }
  );

  const minVcpus = parseFiniteNumber(raw.minVcpus ?? base.minVcpus, 'minVcpus', { min: 1, max: 256, integer: true });
  const maxVcpus = parseFiniteNumber(raw.maxVcpus ?? base.maxVcpus, 'maxVcpus', { min: minVcpus, max: 256, integer: true });

  const minRamGb = parseFiniteNumber(raw.minRamGb ?? base.minRamGb, 'minRamGb', { min: 0.5, max: 4096, decimals: 2 });
  const maxRamGb = parseFiniteNumber(raw.maxRamGb ?? base.maxRamGb, 'maxRamGb', { min: minRamGb, max: 4096, decimals: 2 });

  const minStorageGb = parseFiniteNumber(raw.minStorageGb ?? base.minStorageGb, 'minStorageGb', { min: 1, max: 100000, integer: true });
  const maxStorageGb = parseFiniteNumber(raw.maxStorageGb ?? base.maxStorageGb, 'maxStorageGb', { min: minStorageGb, max: 100000, integer: true });

  return {
    enabled,
    pricePerVcpuMonthly,
    pricePerRamGbMonthly,
    pricePerStorageGbMonthly,
    pricePerBandwidthTbMonthly,
    minVcpus,
    maxVcpus,
    minRamGb,
    maxRamGb,
    minStorageGb,
    maxStorageGb
  };
}

export async function getCustomBuilderConfig() {
  await ensureServerPackageSchema();

  if (usePg()) {
    const { rows } = await queryPg(
      'SELECT value, updated_by, updated_at FROM system_server_package_settings WHERE key = $1 LIMIT 1',
      [CUSTOM_BUILDER_SETTING_KEY]
    );
    const stored = rows[0]?.value && typeof rows[0].value === 'object' ? rows[0].value : {};
    return {
      ...normalizeCustomBuilderConfig(stored),
      updatedBy: rows[0]?.updated_by || null,
      updatedAt: rows[0]?.updated_at || null
    };
  }

  const record = memorySettings.get(CUSTOM_BUILDER_SETTING_KEY);
  const stored = record?.value && typeof record.value === 'object' ? record.value : {};
  return {
    ...normalizeCustomBuilderConfig(stored),
    updatedBy: record?.updated_by || null,
    updatedAt: record?.updated_at || null
  };
}

export async function updateCustomBuilderConfig(patch = {}, actorId = null) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw createInputError('Custom builder configuration payload must be an object.');
  }
  await ensureServerPackageSchema();
  const current = await getCustomBuilderConfig();
  const normalized = normalizeCustomBuilderConfig(patch, current);
  const cleanActor = actorId ? String(actorId).slice(0, 128) : null;

  if (usePg()) {
    const { rows } = await queryPg(
      `INSERT INTO system_server_package_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING value, updated_by, updated_at`,
      [CUSTOM_BUILDER_SETTING_KEY, JSON.stringify(normalized), cleanActor]
    );
    return {
      ...normalizeCustomBuilderConfig(rows[0]?.value || normalized),
      updatedBy: rows[0]?.updated_by || cleanActor,
      updatedAt: rows[0]?.updated_at || null
    };
  }

  const nowIso = new Date().toISOString();
  memorySettings.set(CUSTOM_BUILDER_SETTING_KEY, {
    key: CUSTOM_BUILDER_SETTING_KEY,
    value: normalized,
    updated_by: cleanActor,
    updated_at: nowIso
  });
  return {
    ...normalized,
    updatedBy: cleanActor,
    updatedAt: nowIso
  };
}

export async function calculateCustomDropletPrice({
  vcpus,
  ramGb,
  storageGb,
  bandwidthTb = 1,
  imageId = null
} = {}) {
  const cfg = await getCustomBuilderConfig();

  const cleanVcpus = parseFiniteNumber(vcpus, 'vcpus', {
    min: cfg.minVcpus,
    max: cfg.maxVcpus,
    integer: true
  });
  const cleanRamGb = parseFiniteNumber(ramGb, 'ramGb', {
    min: cfg.minRamGb,
    max: cfg.maxRamGb,
    decimals: 2
  });
  const cleanStorageGb = parseFiniteNumber(storageGb, 'storageGb', {
    min: cfg.minStorageGb,
    max: cfg.maxStorageGb,
    integer: true
  });
  const cleanBandwidthTb = parseFiniteNumber(bandwidthTb ?? 1, 'bandwidthTb', {
    min: 0,
    max: 1000,
    decimals: 2
  });

  let imageSurcharge = 0;
  if (imageId) {
    const img = await getServerOsImageById(imageId);
    if (img) {
      imageSurcharge = roundTo(img.monthlySurchargeUsd, 2);
    }
  }

  const cpuCost = roundTo(cleanVcpus * cfg.pricePerVcpuMonthly, 2);
  const ramCost = roundTo(cleanRamGb * cfg.pricePerRamGbMonthly, 2);
  const storageCost = roundTo(cleanStorageGb * cfg.pricePerStorageGbMonthly, 2);
  const bandwidthCost = roundTo(cleanBandwidthTb * cfg.pricePerBandwidthTbMonthly, 2);
  const monthlyPrice = roundTo(cpuCost + ramCost + storageCost + bandwidthCost + imageSurcharge, 2);

  return {
    enabled: cfg.enabled,
    monthlyPrice,
    breakdown: {
      cpuCost,
      ramCost,
      storageCost,
      bandwidthCost,
      imageSurcharge
    }
  };
}

export async function resolveEffectivePackageForOrder(packageIdOrPayload, fallbackSpecs = {}) {
  let cleanId = '';
  let specs = {};

  if (packageIdOrPayload && typeof packageIdOrPayload === 'object' && !Array.isArray(packageIdOrPayload)) {
    cleanId = packageIdOrPayload.packageId ? String(packageIdOrPayload.packageId).trim().toLowerCase() : '';
    specs = { ...(fallbackSpecs && typeof fallbackSpecs === 'object' ? fallbackSpecs : {}), ...packageIdOrPayload };
  } else {
    cleanId = packageIdOrPayload ? String(packageIdOrPayload).trim().toLowerCase() : '';
    specs = fallbackSpecs && typeof fallbackSpecs === 'object' ? fallbackSpecs : {};
  }

  const imageId = specs.imageId ? String(specs.imageId).trim().toLowerCase() : null;
  let imageSurcharge = 0;
  if (imageId) {
    const img = await getServerOsImageById(imageId);
    if (img) {
      imageSurcharge = roundTo(img.monthlySurchargeUsd, 2);
    }
  }

  if (cleanId === 'custom') {
    const cfg = await getCustomBuilderConfig();
    if (!cfg.enabled) {
      throw createInputError('Custom droplet builder is currently disabled by administrator.', 403);
    }

    const parsedMemoryMb = specs.memory ? parseMemoryMbFromString(specs.memory) : null;
    const rawRamGb = specs.displayedRamGb ?? specs.ramGb ?? (parsedMemoryMb ? roundTo(parsedMemoryMb / 1024, 2) : undefined);

    const parsedStorageGb = specs.storage ? parseStorageGbFromString(specs.storage) : null;
    const rawStorageGb = specs.displayedStorageGb ?? specs.storageGb ?? (parsedStorageGb ?? undefined);

    const vcpus = parseFiniteNumber(specs.displayedVcpus ?? specs.vcpus, 'vcpus', {
      min: cfg.minVcpus,
      max: cfg.maxVcpus,
      integer: true
    });
    const ramGb = parseFiniteNumber(rawRamGb, 'ramGb', {
      min: cfg.minRamGb,
      max: cfg.maxRamGb,
      decimals: 2
    });
    const storageGb = parseFiniteNumber(rawStorageGb, 'storageGb', {
      min: cfg.minStorageGb,
      max: cfg.maxStorageGb,
      integer: true
    });
    const bandwidthTb = specs.bandwidthTb ?? specs.displayedBandwidthTb ?? 1;

    const calc = await calculateCustomDropletPrice({
      vcpus,
      ramGb,
      storageGb,
      bandwidthTb,
      imageId
    });

    const rawBackendCpu = Number(specs.backendCpuQuotaPct);
    const backendCpuQuotaPct = Number.isFinite(rawBackendCpu) && rawBackendCpu >= 10
      ? Math.trunc(rawBackendCpu)
      : Math.max(10, vcpus * 50);

    const rawBackendRamMb = Number(specs.backendRamMb);
    const backendRamMb = Number.isFinite(rawBackendRamMb) && rawBackendRamMb >= 128
      ? Math.trunc(rawBackendRamMb)
      : Math.max(128, Math.round(ramGb * 1024));

    const rawBackendStorageGb = Number(specs.backendStorageGb);
    const backendStorageGb = Number.isFinite(rawBackendStorageGb) && rawBackendStorageGb >= 1
      ? Math.trunc(rawBackendStorageGb)
      : storageGb;

    return {
      packageId: 'custom',
      monthlyPrice: calc.monthlyPrice,
      displayedVcpus: vcpus,
      displayedRamGb: ramGb,
      displayedStorageGb: storageGb,
      backendCpuQuotaPct,
      backendRamMb,
      backendStorageGb,
      breakdown: calc.breakdown
    };
  }

  if (cleanId) {
    const pkg = await getServerPackageById(cleanId);
    if (!pkg || pkg.isActive !== true) {
      throw createInputError('Selected server package is unavailable or inactive.', 400);
    }
    return {
      packageId: pkg.id,
      monthlyPrice: roundTo(pkg.monthlyPriceUsd + imageSurcharge, 2),
      displayedVcpus: pkg.displayedVcpus,
      displayedRamGb: pkg.displayedRamGb,
      displayedStorageGb: pkg.displayedStorageGb,
      backendCpuQuotaPct: pkg.backendCpuQuotaPct,
      backendRamMb: pkg.backendRamMb,
      backendStorageGb: pkg.backendStorageGb
    };
  }

  // Legacy un-keyed spec call fallback (requires explicit valid positive price; never allows $0 free compute)
  const displayedVcpus = Math.max(1, Math.min(256, Math.trunc(Number(specs.displayedVcpus ?? specs.vcpus) || 1)));

  const parsedMemoryMb = specs.memory ? parseMemoryMbFromString(specs.memory) : null;
  const rawRamGb = Number(specs.displayedRamGb ?? specs.ramGb);
  const displayedRamGb = Number.isFinite(rawRamGb) && rawRamGb >= 0.5
    ? roundTo(rawRamGb, 2)
    : parsedMemoryMb
      ? roundTo(Math.max(0.5, parsedMemoryMb / 1024), 2)
      : 1;

  const parsedStorageGb = specs.storage ? parseStorageGbFromString(specs.storage) : null;
  const rawStorageGb = Number(specs.displayedStorageGb ?? specs.storageGb);
  const displayedStorageGb = Number.isFinite(rawStorageGb) && rawStorageGb >= 1
    ? Math.trunc(rawStorageGb)
    : parsedStorageGb || 25;

  const rawPrice = Number(specs.monthlyPrice ?? specs.monthlyPriceUsd ?? specs.price);
  const floorPrice = roundTo(Math.max(4, displayedVcpus * 2 + displayedRamGb * 1 + displayedStorageGb * 0.05), 2);
  const basePrice = Number.isFinite(rawPrice) && rawPrice > 0
    ? Math.max(floorPrice, roundTo(rawPrice, 2))
    : floorPrice;
  const monthlyPrice = roundTo(basePrice + imageSurcharge, 2);

  const rawBackendCpu = Number(specs.backendCpuQuotaPct);
  const backendCpuQuotaPct = Number.isFinite(rawBackendCpu) && rawBackendCpu >= 10
    ? Math.trunc(rawBackendCpu)
    : Math.max(10, displayedVcpus * 50);

  const rawBackendRamMb = Number(specs.backendRamMb);
  const backendRamMb = Number.isFinite(rawBackendRamMb) && rawBackendRamMb >= 128
    ? Math.trunc(rawBackendRamMb)
    : Math.max(128, Math.round(displayedRamGb * 1024));

  const rawBackendStorageGb = Number(specs.backendStorageGb);
  const backendStorageGb = Number.isFinite(rawBackendStorageGb) && rawBackendStorageGb >= 1
    ? Math.trunc(rawBackendStorageGb)
    : displayedStorageGb;

  return {
    packageId: null,
    monthlyPrice,
    displayedVcpus,
    displayedRamGb,
    displayedStorageGb,
    backendCpuQuotaPct,
    backendRamMb,
    backendStorageGb
  };
}
