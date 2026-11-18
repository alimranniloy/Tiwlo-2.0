import crypto from 'node:crypto';
import { getPgPool, isPgActive, queryPg } from '../../db/postgres.js';

const KEY_POOL_AAD = Buffer.from('tiwlo-ai-key-pool-aes256gcm-v1');
const HKDF_SALT = Buffer.from('tiwlo-ai-key-pool-hkdf-salt-v1');
const HKDF_INFO = Buffer.from('tiwlo-ai-key-pool-enc-v1');
const EPHEMERAL_RUNTIME_SECRET = crypto.randomBytes(32).toString('hex');

export const CHAT_SYSTEM_SETTINGS_KEY = 'chat_system_settings';

export const KEY_STATUSES = Object.freeze([
  'active',
  'cooldown',
  'exhausted',
  'invalid'
]);

export const DEFAULT_CANDIDATE_MODELS = Object.freeze([
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash'
]);

export const DEFAULT_CHAT_SYSTEM_SETTINGS = Object.freeze({
  enabled: true,
  autoFailover: true,
  cooldownMinutes: 15,
  preferredModel: 'gemini-3.1-flash-lite-preview',
  candidateModels: [...DEFAULT_CANDIDATE_MODELS],
  requireGuestContact: true,
  guestChatEnabled: true,
  guestTicketsEnabled: true,
  aiAutoReplyEnabled: true,
  aiTriageEnabled: true,
  aiAgentAssistEnabled: true,
  liveChatWidgetEnabled: true,
  blockChatOnClosedTicket: true,
  maxKeysAllowed: null,
  systemPromptSuffix: ''
});

export const CHAT_TO_UI_SETTING_ALIASES = Object.freeze({
  enabled: 'aiEnabled',
  liveChatWidgetEnabled: 'liveChatWidget',
  aiAutoReplyEnabled: 'aiAutoReply',
  aiAgentAssistEnabled: 'aiAgentDraftAssist',
  systemPromptSuffix: 'systemInstructionsSuffix'
});

const SUPPORT_TOGGLES_SETTING_KEY = 'support_system_toggles';

const memoryKeys = new Map();
let memorySettings = cloneDefaultSettings();
let memorySettingsUpdatedAt = null;
let pgSchemaReady = false;
let pgSchemaPromise = null;
let pgTestOverride = null;

function cloneDefaultSettings() {
  return {
    ...DEFAULT_CHAT_SYSTEM_SETTINGS,
    candidateModels: [...DEFAULT_CHAT_SYSTEM_SETTINGS.candidateModels]
  };
}

function usePg() {
  if (pgTestOverride) {
    return Boolean(pgTestOverride.isActive);
  }
  return isPgActive() && Boolean(getPgPool());
}

async function runPg(sql, params = []) {
  if (pgTestOverride?.query) {
    return pgTestOverride.query(sql, params);
  }
  return queryPg(sql, params);
}

/**
 * Configures a test PostgreSQL driver override (e.g. PGlite) for isolated persistence tests.
 */
export function setAiKeyPoolPgDriverForTests(driver = null) {
  pgTestOverride = driver;
  pgSchemaReady = false;
  pgSchemaPromise = null;
}

/**
 * Simulates a process reboot by clearing in-memory caches while preserving the PostgreSQL database.
 */
export function resetAiKeyPoolRuntimeCachesForTests() {
  memoryKeys.clear();
  memorySettings = cloneDefaultSettings();
  memorySettingsUpdatedAt = null;
  pgSchemaReady = false;
  pgSchemaPromise = null;
}

/**
 * Resets the in-memory store, driver override, and schema cache for isolated unit tests.
 */
export function resetInMemoryAiKeyPoolForTests() {
  pgTestOverride = null;
  resetAiKeyPoolRuntimeCachesForTests();
}

function makeValidationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getSecretMaterial() {
  const configured =
    process.env.SECURITY_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.TIWLO_INTERNAL_IDENTITY_SECRET ||
    '';
  if (configured.length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SECURITY_SECRET, SESSION_SECRET, or TIWLO_INTERNAL_IDENTITY_SECRET must be configured in production.'
    );
  }
  return EPHEMERAL_RUNTIME_SECRET;
}

function deriveAesKey() {
  const secretBuf = Buffer.from(getSecretMaterial(), 'utf8');
  return Buffer.from(crypto.hkdfSync('sha256', secretBuf, HKDF_SALT, HKDF_INFO, 32));
}

/**
 * Generates a safe masked preview (e.g. "AIzaSy...9xYz") for an API key.
 */
export function buildApiKeyPreview(apiKey) {
  const clean = String(apiKey || '').replace(/\0/g, '').trim();
  if (!clean) return '****';
  if (clean.length >= 12) {
    return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
  }
  if (clean.length >= 8) {
    return `${clean.slice(0, 4)}...${clean.slice(-3)}`;
  }
  return `${clean.slice(0, 2)}...${clean.slice(-2)}`;
}

/**
 * Encrypts a plaintext API key using AES-256-GCM with an HKDF-derived key.
 */
export function encryptAiApiKey(plaintextKey) {
  const clean = String(plaintextKey || '').replace(/\0/g, '').trim();
  if (clean.length < 10 || /\s/.test(clean)) {
    throw makeValidationError('API key must be a valid non-empty key string (at least 10 characters, no spaces).');
  }
  const encKey = deriveAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  cipher.setAAD(KEY_POOL_AAD);
  const ciphertext = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    iv,
    authTag,
    preview: buildApiKeyPreview(clean)
  };
}

/**
 * Decrypts an AES-256-GCM encrypted API key buffer tuple.
 */
export function decryptAiApiKey({ ciphertext, iv, authTag }) {
  if (!ciphertext || !iv || !authTag) {
    throw new Error('Missing encrypted key material.');
  }
  const encKey = deriveAesKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv));
  decipher.setAAD(KEY_POOL_AAD);
  decipher.setAuthTag(Buffer.from(authTag));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext)),
    decipher.final()
  ]).toString('utf8');
}

function toIsoOrNull(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function computeCooldownRemainingSeconds(cooldownUntil) {
  if (!cooldownUntil) return 0;
  const targetMs = new Date(cooldownUntil).getTime();
  if (!Number.isFinite(targetMs)) return 0;
  return Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
}

function toKeyDto(row) {
  if (!row) return null;
  const cooldownUntil = toIsoOrNull(row.cooldown_until);
  return {
    id: row.id,
    label: row.label,
    provider: row.provider || 'gemini',
    modelOverride: row.model_override || null,
    keyPreview: row.key_preview,
    isEnabled: Boolean(row.is_enabled),
    priority: Number(row.priority ?? 100),
    status: row.status || 'active',
    cooldownUntil,
    cooldownRemainingSeconds: computeCooldownRemainingSeconds(cooldownUntil),
    quotaResetAt: toIsoOrNull(row.quota_reset_at),
    requestsCount: Number(row.requests_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    quotaHits: Number(row.quota_hits ?? 0),
    errorCount: Number(row.error_count ?? 0),
    minuteRequestsCount: Number(row.minute_requests_count ?? 0),
    minuteWindowStartedAt: toIsoOrNull(row.minute_window_started_at),
    dailyRequestsCount: Number(row.daily_requests_count ?? 0),
    dailyWindowStartedAt: toIsoOrNull(row.daily_window_started_at),
    lastError: row.last_error || null,
    lastErrorAt: toIsoOrNull(row.last_error_at),
    lastUsedAt: toIsoOrNull(row.last_used_at),
    lastTestedAt: toIsoOrNull(row.last_tested_at),
    createdBy: row.created_by || null,
    createdAt: toIsoOrNull(row.created_at),
    updatedAt: toIsoOrNull(row.updated_at)
  };
}

function sortKeyRows(rows) {
  return [...rows].sort((a, b) => {
    const prioDiff = Number(a.priority ?? 100) - Number(b.priority ?? 100);
    if (prioDiff !== 0) return prioDiff;
    const reqDiff = Number(a.requests_count ?? 0) - Number(b.requests_count ?? 0);
    if (reqDiff !== 0) return reqDiff;
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) return aCreated - bCreated;
    return String(a.id).localeCompare(String(b.id));
  });
}

function sanitizeModelName(value) {
  if (value === null || value === undefined) return null;
  const clean = String(value).replace(/\0/g, '').trim();
  if (!clean) return null;
  if (!/^[a-zA-Z0-9._-]{2,120}$/.test(clean)) {
    throw makeValidationError(`Invalid model identifier: "${clean.slice(0, 40)}".`);
  }
  return clean;
}

function sanitizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function withSettingAliases(settings) {
  const clean = {
    ...cloneDefaultSettings(),
    ...settings,
    candidateModels: Array.isArray(settings?.candidateModels) && settings.candidateModels.length > 0
      ? [...settings.candidateModels]
      : [...DEFAULT_CANDIDATE_MODELS],
    maxKeysAllowed: null
  };
  return {
    ...clean,
    aiEnabled: clean.enabled,
    liveChatWidget: clean.liveChatWidgetEnabled,
    aiAutoReply: clean.aiAutoReplyEnabled,
    aiAgentDraftAssist: clean.aiAgentAssistEnabled,
    systemInstructionsSuffix: clean.systemPromptSuffix || '',
    switches: {
      aiEnabled: clean.enabled,
      enabled: clean.enabled,
      autoFailover: clean.autoFailover,
      requireGuestContact: clean.requireGuestContact,
      guestChatEnabled: clean.guestChatEnabled,
      guestTicketsEnabled: clean.guestTicketsEnabled,
      aiAutoReply: clean.aiAutoReplyEnabled,
      aiAutoReplyEnabled: clean.aiAutoReplyEnabled,
      aiTriageEnabled: clean.aiTriageEnabled,
      aiAgentDraftAssist: clean.aiAgentAssistEnabled,
      aiAgentAssistEnabled: clean.aiAgentAssistEnabled,
      liveChatWidget: clean.liveChatWidgetEnabled,
      liveChatWidgetEnabled: clean.liveChatWidgetEnabled,
      blockChatOnClosedTicket: clean.blockChatOnClosedTicket
    }
  };
}

function normalizeSettingsPatchInput(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw makeValidationError('Settings payload must be a JSON object.');
  }
  const merged = patch.switches && typeof patch.switches === 'object' && !Array.isArray(patch.switches)
    ? { ...patch.switches, ...patch }
    : { ...patch };

  const aliasPairs = [
    ['aiEnabled', 'enabled'],
    ['liveChatWidget', 'liveChatWidgetEnabled'],
    ['aiAutoReply', 'aiAutoReplyEnabled'],
    ['aiAgentDraftAssist', 'aiAgentAssistEnabled'],
    ['systemInstructionsSuffix', 'systemPromptSuffix']
  ];
  for (const [aliasKey, canonicalKey] of aliasPairs) {
    if (merged[canonicalKey] === undefined && merged[aliasKey] !== undefined) {
      merged[canonicalKey] = merged[aliasKey];
    }
  }
  return merged;
}

function sanitizeSettingsPayload(patch = {}, current = cloneDefaultSettings()) {
  const flatPatch = normalizeSettingsPatchInput(patch);

  const next = {
    ...cloneDefaultSettings(),
    ...current
  };

  const booleanFields = [
    'enabled',
    'autoFailover',
    'requireGuestContact',
    'guestChatEnabled',
    'guestTicketsEnabled',
    'aiAutoReplyEnabled',
    'aiTriageEnabled',
    'aiAgentAssistEnabled',
    'liveChatWidgetEnabled',
    'blockChatOnClosedTicket'
  ];

  for (const field of booleanFields) {
    if (flatPatch[field] !== undefined) {
      next[field] = sanitizeBoolean(flatPatch[field], next[field]);
    }
  }

  if (flatPatch.cooldownMinutes !== undefined) {
    const mins = Number(flatPatch.cooldownMinutes);
    if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
      throw makeValidationError('cooldownMinutes must be a number between 1 and 1440.');
    }
    next.cooldownMinutes = Math.round(mins);
  }

  if (flatPatch.preferredModel !== undefined) {
    const cleanModel = sanitizeModelName(flatPatch.preferredModel);
    if (!cleanModel) {
      throw makeValidationError('preferredModel cannot be empty.');
    }
    next.preferredModel = cleanModel;
  }

  if (flatPatch.candidateModels !== undefined) {
    const rawList = Array.isArray(flatPatch.candidateModels)
      ? flatPatch.candidateModels
      : String(flatPatch.candidateModels || '')
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    const deduped = [];
    const seen = new Set();
    for (const item of rawList) {
      const m = sanitizeModelName(item);
      if (m && !seen.has(m)) {
        seen.add(m);
        deduped.push(m);
      }
    }
    if (deduped.length === 0) {
      throw makeValidationError('candidateModels must include at least one valid Gemini model.');
    }
    next.candidateModels = deduped;
  }

  if (flatPatch.systemPromptSuffix !== undefined) {
    next.systemPromptSuffix = String(flatPatch.systemPromptSuffix ?? '')
      .replace(/\0/g, '')
      .trim()
      .slice(0, 4000);
  }

  // Unlimited keys allowed: never impose an artificial key cap.
  next.maxKeysAllowed = null;

  return next;
}

/**
 * Idempotently creates and migrates the PostgreSQL schema for AI API keys and settings,
 * or returns memory mode when PostgreSQL is inactive. Safe to call at server.js startup.
 */
export async function ensureAiKeyPoolSchema() {
  if (!usePg()) {
    return { ok: true, mode: 'memory' };
  }
  if (pgSchemaReady) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (pgSchemaPromise) {
    return pgSchemaPromise;
  }

  pgSchemaPromise = (async () => {
    await runPg(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runPg(`
      CREATE TABLE IF NOT EXISTS system_ai_api_keys (
        id VARCHAR(64) PRIMARY KEY,
        label VARCHAR(120) NOT NULL,
        provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
        model_override VARCHAR(120),
        key_ciphertext BYTEA NOT NULL,
        key_iv BYTEA NOT NULL,
        key_auth_tag BYTEA NOT NULL,
        key_preview VARCHAR(32) NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        priority INTEGER NOT NULL DEFAULT 100,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        cooldown_until TIMESTAMPTZ,
        quota_reset_at TIMESTAMPTZ,
        requests_count BIGINT NOT NULL DEFAULT 0,
        success_count BIGINT NOT NULL DEFAULT 0,
        quota_hits BIGINT NOT NULL DEFAULT 0,
        error_count BIGINT NOT NULL DEFAULT 0,
        minute_requests_count BIGINT NOT NULL DEFAULT 0,
        minute_window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        daily_requests_count BIGINT NOT NULL DEFAULT 0,
        daily_window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_error TEXT,
        last_error_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        last_tested_at TIMESTAMPTZ,
        created_by VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Idempotent column migrations for existing deployments
    const alterStatements = [
      `ALTER TABLE system_ai_api_keys ADD COLUMN IF NOT EXISTS quota_reset_at TIMESTAMPTZ`,
      `ALTER TABLE system_ai_api_keys ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ`,
      `ALTER TABLE system_ai_api_keys ADD COLUMN IF NOT EXISTS minute_requests_count BIGINT NOT NULL DEFAULT 0`,
      `ALTER TABLE system_ai_api_keys ADD COLUMN IF NOT EXISTS minute_window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE system_ai_api_keys ADD COLUMN IF NOT EXISTS daily_requests_count BIGINT NOT NULL DEFAULT 0`,
      `ALTER TABLE system_ai_api_keys ADD COLUMN IF NOT EXISTS daily_window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `CREATE INDEX IF NOT EXISTS idx_system_ai_api_keys_order ON system_ai_api_keys (is_enabled, priority, requests_count, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_system_ai_api_keys_cooldown ON system_ai_api_keys (status, cooldown_until)`
    ];
    for (const stmt of alterStatements) {
      await runPg(stmt);
    }

    pgSchemaReady = true;
    return { ok: true, mode: 'postgres' };
  })().catch((err) => {
    pgSchemaPromise = null;
    throw err;
  });

  return pgSchemaPromise;
}

async function syncSupportTogglesFromChatPatch(rawPatch = {}) {
  const flat = rawPatch.switches && typeof rawPatch.switches === 'object' && !Array.isArray(rawPatch.switches)
    ? { ...rawPatch.switches, ...rawPatch }
    : { ...rawPatch };

  const mapped = {};
  for (const [aliasKey, toggleKey] of Object.entries(TICKET_TO_UI_SUPPORT_SYNC)) {
    if (flat[aliasKey] !== undefined) {
      mapped[toggleKey] = sanitizeBoolean(flat[aliasKey], true);
    }
  }
  if (Object.keys(mapped).length === 0 || !usePg()) {
    return;
  }

  try {
    await ensureAiKeyPoolSchema();
    const { rows } = await runPg(
      `SELECT settings FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      [SUPPORT_TOGGLES_SETTING_KEY]
    );
    const current = rows[0]?.settings && typeof rows[0].settings === 'object' ? rows[0].settings : {};
    const merged = { ...current, ...mapped };
    await runPg(
      `INSERT INTO system_settings (setting_key, settings, updated_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key)
       DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
      [SUPPORT_TOGGLES_SETTING_KEY, JSON.stringify(merged)]
    );
  } catch {
    // Non-fatal cross-sync
  }
}

const TICKET_TO_UI_SUPPORT_SYNC = Object.freeze({
  guestTicketsEnabled: 'guestTicketingEnabled',
  guestTicketingEnabled: 'guestTicketingEnabled',
  requireGuestContact: 'requireGuestEmailAndPhone',
  liveChatWidgetEnabled: 'liveChatWidgetEnabled',
  liveChatWidget: 'liveChatWidgetEnabled',
  allowNewTicketCreation: 'allowNewTicketCreation',
  allowNewTickets: 'allowNewTicketCreation',
  lockClosedTicketReplies: 'lockClosedTicketReplies',
  lockClosedReplies: 'lockClosedTicketReplies',
  allowCustomerReopenClosedTicket: 'allowCustomerReopenClosedTicket',
  allowCustomerReopen: 'allowCustomerReopenClosedTicket',
  allowAttachments: 'allowAttachments',
  fileAttachmentsEnabled: 'allowAttachments',
  aiAutoReplyEnabled: 'aiAutoReplyEnabled',
  aiAutoReply: 'aiAutoReplyEnabled',
  restrictStaffToAssignedTickets: 'restrictStaffToAssignedTickets',
  restrictStaffToAssignedQueue: 'restrictStaffToAssignedTickets'
});

/**
 * Loads Chat System & AI Failover settings from PostgreSQL or memory fallback.
 */
export async function getChatSystemSettings() {
  if (!usePg()) {
    return withSettingAliases({
      ...cloneDefaultSettings(),
      ...memorySettings,
      candidateModels: [...(memorySettings.candidateModels || DEFAULT_CANDIDATE_MODELS)],
      updatedAt: memorySettingsUpdatedAt
    });
  }

  await ensureAiKeyPoolSchema();
  const { rows } = await runPg(
    `SELECT settings, updated_at FROM system_settings WHERE setting_key = $1 LIMIT 1`,
    [CHAT_SYSTEM_SETTINGS_KEY]
  );
  const raw = rows[0]?.settings && typeof rows[0].settings === 'object' ? rows[0].settings : {};
  return withSettingAliases({
    ...cloneDefaultSettings(),
    ...raw,
    candidateModels: Array.isArray(raw.candidateModels) && raw.candidateModels.length > 0
      ? [...raw.candidateModels]
      : [...DEFAULT_CANDIDATE_MODELS],
    maxKeysAllowed: null,
    updatedAt: toIsoOrNull(rows[0]?.updated_at)
  });
}

export const getChatSystemConfig = getChatSystemSettings;

/**
 * Validates and persists Chat System & AI Failover settings.
 */
export async function updateChatSystemSettings(patch = {}, actorId = null) {
  const current = await getChatSystemSettings();
  const { updatedAt: _omit, switches: _omitSw, aiEnabled: _a1, liveChatWidget: _a2, aiAutoReply: _a3, aiAgentDraftAssist: _a4, systemInstructionsSuffix: _a5, ...currentBase } = current;
  const next = sanitizeSettingsPayload(patch, currentBase);
  const nowIso = new Date().toISOString();

  if (!usePg()) {
    memorySettings = next;
    memorySettingsUpdatedAt = nowIso;
    return withSettingAliases({ ...next, candidateModels: [...next.candidateModels], updatedAt: nowIso });
  }

  await ensureAiKeyPoolSchema();
  const stored = { ...next, updatedBy: actorId || null };
  const { rows } = await runPg(
    `INSERT INTO system_settings (setting_key, settings, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (setting_key)
     DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
     RETURNING settings, updated_at`,
    [CHAT_SYSTEM_SETTINGS_KEY, JSON.stringify(stored)]
  );
  await syncSupportTogglesFromChatPatch(patch);
  return withSettingAliases({
    ...next,
    candidateModels: [...next.candidateModels],
    updatedAt: toIsoOrNull(rows[0]?.updated_at) || nowIso
  });
}

export const updateChatSystemConfig = updateChatSystemSettings;

/**
 * Automatically resets keys whose cooldown window has expired (cooldown_until <= NOW()).
 * Always evaluates against PostgreSQL NOW() when PostgreSQL is active so state survives reboots.
 */
export async function expireKeyCooldowns(nowMs = null) {
  if (!usePg()) {
    const refMs = nowMs === null ? Date.now() : nowMs;
    const nowDate = new Date(refMs);
    let updated = 0;
    for (const row of memoryKeys.values()) {
      if (
        (row.status === 'cooldown' || row.status === 'exhausted') &&
        row.cooldown_until &&
        new Date(row.cooldown_until).getTime() <= refMs
      ) {
        row.status = 'active';
        row.cooldown_until = null;
        row.quota_reset_at = null;
        row.updated_at = nowDate.toISOString();
        updated += 1;
      }
    }
    return updated;
  }

  await ensureAiKeyPoolSchema();
  if (nowMs !== null) {
    const res = await runPg(
      `UPDATE system_ai_api_keys
       SET status = 'active',
           cooldown_until = NULL,
           quota_reset_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE status IN ('cooldown', 'exhausted')
         AND cooldown_until IS NOT NULL
         AND cooldown_until <= $1::timestamptz`,
      [new Date(nowMs)]
    );
    return res.rowCount || 0;
  }

  const res = await runPg(
    `UPDATE system_ai_api_keys
     SET status = 'active',
         cooldown_until = NULL,
         quota_reset_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE status IN ('cooldown', 'exhausted')
       AND cooldown_until IS NOT NULL
       AND cooldown_until <= NOW()`
  );
  return res.rowCount || 0;
}

async function getRawKeyRows({ onlyEnabled = false, onlyHealthy = false } = {}) {
  await expireKeyCooldowns();

  if (!usePg()) {
    const nowMs = Date.now();
    let rows = Array.from(memoryKeys.values());
    if (onlyEnabled) {
      rows = rows.filter((r) => Boolean(r.is_enabled));
    }
    if (onlyHealthy) {
      rows = rows.filter(
        (r) =>
          r.status !== 'invalid' &&
          (!r.cooldown_until || new Date(r.cooldown_until).getTime() <= nowMs)
      );
    }
    return sortKeyRows(rows);
  }

  await ensureAiKeyPoolSchema();
  const conditions = [];
  if (onlyEnabled) {
    conditions.push('is_enabled = TRUE');
  }
  if (onlyHealthy) {
    conditions.push(`status <> 'invalid'`);
    conditions.push(`(cooldown_until IS NULL OR cooldown_until <= NOW())`);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await runPg(
    `SELECT *
     FROM system_ai_api_keys
     ${whereClause}
     ORDER BY priority ASC, requests_count ASC, created_at ASC, id ASC`
  );
  return rows;
}

async function getRawKeyRowById(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;
  await expireKeyCooldowns();

  if (!usePg()) {
    return memoryKeys.get(cleanId) || null;
  }

  await ensureAiKeyPoolSchema();
  const { rows } = await runPg(
    `SELECT * FROM system_ai_api_keys WHERE id = $1 LIMIT 1`,
    [cleanId]
  );
  return rows[0] || null;
}

/**
 * Lists all configured AI API keys with masked previews (never decrypted secrets).
 */
export async function listAiKeys({ includeDisabled = true } = {}) {
  const rows = await getRawKeyRows({ onlyEnabled: !includeDisabled });
  return rows.map(toKeyDto);
}

/**
 * Computes summary telemetry for the key pool.
 */
export function buildKeyPoolSummary(keys = []) {
  const now = Date.now();
  let enabled = 0;
  let active = 0;
  let healthy = 0;
  let cooldown = 0;
  let exhausted = 0;
  let invalid = 0;
  let totalRequests = 0;
  let totalSuccess = 0;
  let totalQuotaHits = 0;
  let totalErrors = 0;
  let totalMinuteRequests = 0;
  let totalDailyRequests = 0;

  for (const key of keys) {
    if (key.isEnabled) enabled += 1;
    if (key.status === 'active') active += 1;
    else if (key.status === 'cooldown') cooldown += 1;
    else if (key.status === 'exhausted') exhausted += 1;
    else if (key.status === 'invalid') invalid += 1;

    const cooldownExpired = !key.cooldownUntil || Date.parse(key.cooldownUntil) <= now;
    if (key.isEnabled && key.status !== 'invalid' && cooldownExpired) {
      healthy += 1;
    }

    totalRequests += Number(key.requestsCount || 0);
    totalSuccess += Number(key.successCount || 0);
    totalQuotaHits += Number(key.quotaHits || 0);
    totalErrors += Number(key.errorCount || 0);
    totalMinuteRequests += Number(key.minuteRequestsCount || 0);
    totalDailyRequests += Number(key.dailyRequestsCount || 0);
  }

  return {
    total: keys.length,
    enabled,
    healthy,
    active,
    cooldown,
    exhausted,
    invalid,
    totalRequests,
    totalSuccess,
    totalQuotaHits,
    totalErrors,
    totalMinuteRequests,
    totalDailyRequests,
    envFallbackConfigured: Boolean(String(process.env.GEMINI_API_KEY || '').trim())
  };
}

/**
 * Returns full Chat System settings, masked key pool, and summary stats.
 */
export async function getChatSystemOverview() {
  const [settings, keys] = await Promise.all([
    getChatSystemSettings(),
    listAiKeys({ includeDisabled: true })
  ]);
  return {
    settings,
    keys,
    summary: buildKeyPoolSummary(keys)
  };
}

function normalizePriority(value, fallback = 100) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 1000000) {
    throw makeValidationError('priority must be an integer between 0 and 1000000.');
  }
  return Math.round(num);
}

/**
 * Adds a new encrypted AI API key to the pool (unlimited keys allowed).
 */
export async function addAiKey(input = {}, createdBy = null) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw makeValidationError('Key payload must be an object.');
  }

  const rawKey = input.apiKey ?? input.key ?? '';
  const encrypted = encryptAiApiKey(rawKey);

  const existingCount = (await listAiKeys({ includeDisabled: true })).length;
  const rawLabel = String(input.label ?? '').replace(/\0/g, '').trim();
  const label = (rawLabel || `Gemini Key #${existingCount + 1}`).slice(0, 120);
  const provider = String(input.provider || 'gemini').replace(/\0/g, '').trim().toLowerCase().slice(0, 32) || 'gemini';
  if (provider !== 'gemini') {
    throw makeValidationError('Currently only "gemini" provider keys are supported.');
  }
  const modelOverride = sanitizeModelName(input.modelOverride);
  const isEnabled = input.isEnabled === undefined ? true : sanitizeBoolean(input.isEnabled, true);
  const priority = normalizePriority(input.priority, 100);
  const id = `aik_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const nowIso = new Date().toISOString();

  if (!usePg()) {
    const row = {
      id,
      label,
      provider,
      model_override: modelOverride,
      key_ciphertext: encrypted.ciphertext,
      key_iv: encrypted.iv,
      key_auth_tag: encrypted.authTag,
      key_preview: encrypted.preview,
      is_enabled: isEnabled,
      priority,
      status: 'active',
      cooldown_until: null,
      quota_reset_at: null,
      requests_count: 0,
      success_count: 0,
      quota_hits: 0,
      error_count: 0,
      minute_requests_count: 0,
      minute_window_started_at: nowIso,
      daily_requests_count: 0,
      daily_window_started_at: nowIso,
      last_error: null,
      last_error_at: null,
      last_used_at: null,
      last_tested_at: null,
      created_by: createdBy ? String(createdBy).slice(0, 64) : null,
      created_at: nowIso,
      updated_at: nowIso
    };
    memoryKeys.set(id, row);
    return toKeyDto(row);
  }

  await ensureAiKeyPoolSchema();
  const { rows } = await runPg(
    `INSERT INTO system_ai_api_keys (
       id, label, provider, model_override,
       key_ciphertext, key_iv, key_auth_tag, key_preview,
       is_enabled, priority, status, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11)
     RETURNING *`,
    [
      id,
      label,
      provider,
      modelOverride,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.authTag,
      encrypted.preview,
      isEnabled,
      priority,
      createdBy ? String(createdBy).slice(0, 64) : null
    ]
  );
  return toKeyDto(rows[0]);
}

/**
 * Adds one or multiple AI API keys in sequence (unlimited keys allowed).
 */
export async function addAiKeys(inputs, createdBy = null) {
  const list = Array.isArray(inputs) ? inputs : [inputs];
  if (list.length === 0) {
    throw makeValidationError('At least one API key entry is required.');
  }
  const created = [];
  for (const item of list) {
    created.push(await addAiKey(item, createdBy));
  }
  return created;
}

/**
 * Updates metadata, priority, enablement, or replaces the encrypted secret of an existing key.
 */
export async function updateAiKey(id, patch = {}, _actorId = null) {
  const existing = await getRawKeyRowById(id);
  if (!existing) return null;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw makeValidationError('Update payload must be an object.');
  }

  const nextLabel = patch.label !== undefined
    ? String(patch.label || '').replace(/\0/g, '').trim().slice(0, 120)
    : existing.label;
  if (!nextLabel) {
    throw makeValidationError('Key label cannot be empty.');
  }

  const nextPriority = patch.priority !== undefined
    ? normalizePriority(patch.priority, Number(existing.priority ?? 100))
    : Number(existing.priority ?? 100);
  const nextEnabled = patch.isEnabled !== undefined
    ? sanitizeBoolean(patch.isEnabled, Boolean(existing.is_enabled))
    : Boolean(existing.is_enabled);
  const nextModelOverride = patch.modelOverride !== undefined
    ? sanitizeModelName(patch.modelOverride)
    : existing.model_override;

  let nextCiphertext = existing.key_ciphertext;
  let nextIv = existing.key_iv;
  let nextAuthTag = existing.key_auth_tag;
  let nextPreview = existing.key_preview;
  let nextStatus = existing.status;
  let nextCooldownUntil = existing.cooldown_until;
  let nextQuotaResetAt = existing.quota_reset_at;
  let nextLastError = existing.last_error;
  let nextLastErrorAt = existing.last_error_at;

  const replacementKey = patch.apiKey ?? patch.key;
  if (replacementKey !== undefined && String(replacementKey).trim() !== '') {
    const encrypted = encryptAiApiKey(replacementKey);
    nextCiphertext = encrypted.ciphertext;
    nextIv = encrypted.iv;
    nextAuthTag = encrypted.authTag;
    nextPreview = encrypted.preview;
    nextStatus = 'active';
    nextCooldownUntil = null;
    nextQuotaResetAt = null;
    nextLastError = null;
    nextLastErrorAt = null;
  }

  if (!usePg()) {
    const updated = {
      ...existing,
      label: nextLabel,
      priority: nextPriority,
      is_enabled: nextEnabled,
      model_override: nextModelOverride,
      key_ciphertext: nextCiphertext,
      key_iv: nextIv,
      key_auth_tag: nextAuthTag,
      key_preview: nextPreview,
      status: nextStatus,
      cooldown_until: nextCooldownUntil,
      quota_reset_at: nextQuotaResetAt,
      last_error: nextLastError,
      last_error_at: nextLastErrorAt,
      updated_at: new Date().toISOString()
    };
    memoryKeys.set(existing.id, updated);
    return toKeyDto(updated);
  }

  await ensureAiKeyPoolSchema();
  const { rows } = await runPg(
    `UPDATE system_ai_api_keys
     SET label = $2,
         priority = $3,
         is_enabled = $4,
         model_override = $5,
         key_ciphertext = $6,
         key_iv = $7,
         key_auth_tag = $8,
         key_preview = $9,
         status = $10,
         cooldown_until = $11,
         quota_reset_at = $12,
         last_error = $13,
         last_error_at = $14,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      existing.id,
      nextLabel,
      nextPriority,
      nextEnabled,
      nextModelOverride,
      nextCiphertext,
      nextIv,
      nextAuthTag,
      nextPreview,
      nextStatus,
      nextCooldownUntil,
      nextQuotaResetAt,
      nextLastError,
      nextLastErrorAt
    ]
  );
  return toKeyDto(rows[0]);
}

/**
 * Deletes an AI API key from the pool.
 */
export async function deleteAiKey(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return false;

  if (!usePg()) {
    return memoryKeys.delete(cleanId);
  }

  await ensureAiKeyPoolSchema();
  const res = await runPg(
    `DELETE FROM system_ai_api_keys WHERE id = $1`,
    [cleanId]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * Resets a key's cooldown/exhausted state back to 'active'.
 */
export async function resetAiKeyQuota(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;

  if (!usePg()) {
    const existing = memoryKeys.get(cleanId);
    if (!existing) return null;
    const updated = {
      ...existing,
      status: 'active',
      cooldown_until: null,
      quota_reset_at: null,
      last_error: null,
      last_error_at: null,
      updated_at: new Date().toISOString()
    };
    memoryKeys.set(cleanId, updated);
    return toKeyDto(updated);
  }

  await ensureAiKeyPoolSchema();
  const { rows } = await runPg(
    `UPDATE system_ai_api_keys
     SET status = 'active',
         cooldown_until = NULL,
         quota_reset_at = NULL,
         last_error = NULL,
         last_error_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [cleanId]
  );
  return rows[0] ? toKeyDto(rows[0]) : null;
}

function advanceMemoryWindowCounters(row, attemptAtMs) {
  const attemptIso = new Date(attemptAtMs).toISOString();
  const minuteStartMs = row.minute_window_started_at ? new Date(row.minute_window_started_at).getTime() : 0;
  if (!minuteStartMs || attemptAtMs - minuteStartMs >= 60_000) {
    row.minute_requests_count = 1;
    row.minute_window_started_at = attemptIso;
  } else {
    row.minute_requests_count = Number(row.minute_requests_count || 0) + 1;
  }

  const dailyStartDay = row.daily_window_started_at
    ? new Date(row.daily_window_started_at).toISOString().slice(0, 10)
    : '';
  const currentDay = attemptIso.slice(0, 10);
  if (!dailyStartDay || dailyStartDay !== currentDay) {
    row.daily_requests_count = 1;
    row.daily_window_started_at = attemptIso;
  } else {
    row.daily_requests_count = Number(row.daily_requests_count || 0) + 1;
  }
}

async function recordKeyOutcome(id, outcome) {
  if (!id || id === '__env_fallback__') return null;

  const {
    status,
    cooldownSeconds = null,
    clearCooldown = false,
    incSuccess = 0,
    incQuotaHit = 0,
    incError = 0,
    lastError,
    isFailure = false,
    usedAt = null,
    testedAt = null
  } = outcome;

  const nowMs = usedAt || testedAt || Date.now();

  if (!usePg()) {
    const row = memoryKeys.get(id);
    if (!row) return null;
    row.requests_count = Number(row.requests_count || 0) + 1;
    row.success_count = Number(row.success_count || 0) + incSuccess;
    row.quota_hits = Number(row.quota_hits || 0) + incQuotaHit;
    row.error_count = Number(row.error_count || 0) + incError;
    advanceMemoryWindowCounters(row, nowMs);

    if (status !== undefined) row.status = status;
    if (clearCooldown) {
      row.cooldown_until = null;
      row.quota_reset_at = null;
    } else if (Number.isFinite(cooldownSeconds) && cooldownSeconds > 0) {
      const targetIso = new Date(nowMs + cooldownSeconds * 1000).toISOString();
      row.cooldown_until = targetIso;
      row.quota_reset_at = targetIso;
    }
    if (lastError !== undefined) row.last_error = lastError;
    if (isFailure) row.last_error_at = new Date(nowMs).toISOString();
    else if (incSuccess > 0) row.last_error_at = null;
    if (usedAt) row.last_used_at = new Date(usedAt).toISOString();
    if (testedAt) row.last_tested_at = new Date(testedAt).toISOString();
    row.updated_at = new Date().toISOString();
    return toKeyDto(row);
  }

  await ensureAiKeyPoolSchema();
  const hasCooldownSeconds = Number.isFinite(cooldownSeconds) && cooldownSeconds > 0;
  const { rows } = await runPg(
    `UPDATE system_ai_api_keys
     SET requests_count = requests_count + 1,
         success_count = success_count + $2,
         quota_hits = quota_hits + $3,
         error_count = error_count + $4,
         minute_requests_count = CASE
           WHEN minute_window_started_at IS NULL OR minute_window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
           ELSE minute_requests_count + 1
         END,
         minute_window_started_at = CASE
           WHEN minute_window_started_at IS NULL OR minute_window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
           ELSE minute_window_started_at
         END,
         daily_requests_count = CASE
           WHEN daily_window_started_at IS NULL OR DATE_TRUNC('day', daily_window_started_at AT TIME ZONE 'UTC') < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') THEN 1
           ELSE daily_requests_count + 1
         END,
         daily_window_started_at = CASE
           WHEN daily_window_started_at IS NULL OR DATE_TRUNC('day', daily_window_started_at AT TIME ZONE 'UTC') < DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') THEN NOW()
           ELSE daily_window_started_at
         END,
         status = COALESCE($5, status),
         cooldown_until = CASE
           WHEN $6::boolean THEN NULL
           WHEN $7::integer IS NOT NULL THEN NOW() + ($7::integer * INTERVAL '1 second')
           ELSE cooldown_until
         END,
         quota_reset_at = CASE
           WHEN $6::boolean THEN NULL
           WHEN $7::integer IS NOT NULL THEN NOW() + ($7::integer * INTERVAL '1 second')
           ELSE quota_reset_at
         END,
         last_error = CASE WHEN $8::boolean THEN $9::text ELSE last_error END,
         last_error_at = CASE
           WHEN $10::boolean THEN CURRENT_TIMESTAMP
           WHEN $2 > 0 THEN NULL
           ELSE last_error_at
         END,
         last_used_at = CASE WHEN $11::boolean THEN CURRENT_TIMESTAMP ELSE last_used_at END,
         last_tested_at = CASE WHEN $12::boolean THEN CURRENT_TIMESTAMP ELSE last_tested_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [
      id,
      incSuccess,
      incQuotaHit,
      incError,
      status ?? null,
      Boolean(clearCooldown),
      hasCooldownSeconds ? Math.round(cooldownSeconds) : null,
      lastError !== undefined,
      lastError ?? null,
      Boolean(isFailure),
      Boolean(usedAt),
      Boolean(testedAt)
    ]
  );
  return rows[0] ? toKeyDto(rows[0]) : null;
}

function classifyGeminiFailure(httpStatus, data, thrownErr = null) {
  if (thrownErr) {
    return {
      kind: 'transient',
      message: String(thrownErr.message || 'Network or timeout error').slice(0, 500)
    };
  }
  const errStatus = String(data?.error?.status || '');
  const errMsg = String(data?.error?.message || `HTTP ${httpStatus || 500}`);
  const combined = `${httpStatus || ''} ${errStatus} ${errMsg}`.toLowerCase();

  if (
    httpStatus === 429 ||
    errStatus === 'RESOURCE_EXHAUSTED' ||
    combined.includes('resource_exhausted') ||
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('rate_limit')
  ) {
    return {
      kind: 'quota',
      message: errMsg.slice(0, 500)
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    errStatus === 'UNAUTHENTICATED' ||
    errStatus === 'PERMISSION_DENIED' ||
    combined.includes('api_key_invalid') ||
    combined.includes('api key not valid') ||
    combined.includes('invalid api key')
  ) {
    return {
      kind: 'invalid',
      message: errMsg.slice(0, 500)
    };
  }

  return {
    kind: 'transient',
    message: errMsg.slice(0, 500)
  };
}

async function callGeminiGenerateContent({ apiKey, model, payload, fetchFn, timeoutMs }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await res.json().catch(() => ({}));
  const parts = data?.candidates?.[0]?.content?.parts;
  const nonThoughtText = Array.isArray(parts)
    ? parts
        .filter((p) => p && p.thought !== true && typeof p.text === 'string' && p.text.length > 0)
        .map((p) => p.text)
        .join('')
    : '';
  const anyText = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('')
    : '';
  const text = nonThoughtText.trim() ? nonThoughtText : anyText;
  if (res.ok && typeof text === 'string' && text.trim().length > 0) {
    return { ok: true, text, data };
  }
  return {
    ok: false,
    failure: classifyGeminiFailure(res.status, data)
  };
}

function buildModelsForKey(keyModelOverride, preferredModel, settings) {
  const ordered = [];
  const seen = new Set();
  const pushModel = (m) => {
    const clean = typeof m === 'string' ? m.trim() : '';
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      ordered.push(clean);
    }
  };
  pushModel(keyModelOverride);
  pushModel(preferredModel);
  pushModel(settings.preferredModel);
  for (const m of settings.candidateModels || DEFAULT_CANDIDATE_MODELS) {
    pushModel(m);
  }
  return ordered;
}

function applySystemPromptSuffix(payload, suffix) {
  const cleanSuffix = String(suffix || '').trim();
  if (!cleanSuffix || !payload || typeof payload !== 'object') {
    return payload;
  }
  const existingParts = Array.isArray(payload.systemInstruction?.parts)
    ? payload.systemInstruction.parts
    : [];
  const nextParts = [...existingParts, { text: cleanSuffix }];
  return {
    ...payload,
    systemInstruction: {
      ...(payload.systemInstruction || {}),
      parts: nextParts
    }
  };
}

/**
 * Executes a Gemini generateContent payload across the prioritized key pool
 * with automatic quota cooldown and seamless failover in a single request.
 */
export async function executeGeminiWithFailover({
  payload,
  preferredModel = null,
  fetchFn = globalThis.fetch,
  timeoutMs = 15000
} = {}) {
  const settings = await getChatSystemSettings();
  if (settings.enabled === false) {
    return {
      ok: false,
      text: null,
      usedKeyId: null,
      usedKeyLabel: null,
      usedModel: null,
      failoverCount: 0,
      disabled: true,
      error: 'AI system is disabled in Chat System Settings.'
    };
  }

  if (typeof fetchFn !== 'function') {
    throw new Error('Fetch implementation is unavailable for Gemini API calls.');
  }

  const healthyRows = await getRawKeyRows({ onlyEnabled: true, onlyHealthy: true });

  const candidates = [];
  for (const row of healthyRows) {
    try {
      const apiKey = decryptAiApiKey({
        ciphertext: row.key_ciphertext,
        iv: row.key_iv,
        authTag: row.key_auth_tag
      });
      candidates.push({
        id: row.id,
        label: row.label,
        apiKey,
        modelOverride: row.model_override || null,
        isEnvFallback: false
      });
    } catch (err) {
      await recordKeyOutcome(row.id, {
        status: 'invalid',
        incError: 1,
        isFailure: true,
        lastError: `Decryption failed: ${err.message}`.slice(0, 500),
        usedAt: Date.now()
      });
    }
  }

  const envFallbackKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (envFallbackKey) {
    candidates.push({
      id: '__env_fallback__',
      label: 'Environment GEMINI_API_KEY',
      apiKey: envFallbackKey,
      modelOverride: null,
      isEnvFallback: true
    });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      text: null,
      usedKeyId: null,
      usedKeyLabel: null,
      usedModel: null,
      failoverCount: 0,
      reason: 'NO_HEALTHY_KEYS',
      error: 'No active Gemini API key is configured. Add one in AI Keys & Models or set GEMINI_API_KEY.'
    };
  }

  const effectivePayload = applySystemPromptSuffix(payload, settings.systemPromptSuffix);
  const cooldownSeconds = Math.max(1, Number(settings.cooldownMinutes || 15)) * 60;
  let failoverCount = 0;
  const errors = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    const models = buildModelsForKey(candidate.modelOverride, preferredModel, settings);
    let keyExhaustedOrInvalid = false;

    for (const model of models) {
      const attemptAt = Date.now();
      let result;
      try {
        result = await callGeminiGenerateContent({
          apiKey: candidate.apiKey,
          model,
          payload: effectivePayload,
          fetchFn,
          timeoutMs
        });
      } catch (err) {
        result = {
          ok: false,
          failure: classifyGeminiFailure(0, null, err)
        };
      }

      if (result.ok) {
        await recordKeyOutcome(candidate.id, {
          status: 'active',
          clearCooldown: true,
          incSuccess: 1,
          lastError: null,
          usedAt: attemptAt
        });
        return {
          ok: true,
          text: result.text,
          model,
          keyLabel: candidate.label,
          usedKeyId: candidate.id,
          usedKeyLabel: candidate.label,
          usedModel: model,
          failoverCount
        };
      }

      const { kind, message } = result.failure;
      errors.push({ keyId: candidate.id, model, kind, message });

      if (kind === 'quota') {
        await recordKeyOutcome(candidate.id, {
          status: 'cooldown',
          cooldownSeconds,
          incQuotaHit: 1,
          isFailure: true,
          lastError: message,
          usedAt: attemptAt
        });
        keyExhaustedOrInvalid = true;
        break;
      }

      if (kind === 'invalid') {
        await recordKeyOutcome(candidate.id, {
          status: 'invalid',
          clearCooldown: true,
          incError: 1,
          isFailure: true,
          lastError: message,
          usedAt: attemptAt
        });
        keyExhaustedOrInvalid = true;
        break;
      }

      await recordKeyOutcome(candidate.id, {
        incError: 1,
        isFailure: true,
        lastError: message,
        usedAt: attemptAt
      });
    }

    if (!settings.autoFailover) {
      break;
    }
    if (idx < candidates.length - 1 && (keyExhaustedOrInvalid || models.length > 0)) {
      failoverCount += 1;
    }
  }

  const lastErrMsg = errors.length > 0 ? errors[errors.length - 1]?.message : '';
  return {
    ok: false,
    text: null,
    usedKeyId: null,
    usedKeyLabel: null,
    usedModel: null,
    failoverCount,
    errors,
    error: lastErrMsg || 'All configured Gemini AI keys are currently unavailable or exhausted.'
  };
}

/**
 * Runs a live diagnostic ping ("Reply OK") against a specific stored key by ID.
 */
export async function testGeminiKeyById(id, { fetchFn = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const row = await getRawKeyRowById(id);
  if (!row) return null;
  if (typeof fetchFn !== 'function') {
    throw new Error('Fetch implementation is unavailable for Gemini API calls.');
  }

  const settings = await getChatSystemSettings();
  const candidateModels = row.model_override
    ? [row.model_override]
    : buildModelsForKey(null, null, settings);
  let model = candidateModels[0] || DEFAULT_CANDIDATE_MODELS[0];
  const startedAt = Date.now();

  let apiKey;
  try {
    apiKey = decryptAiApiKey({
      ciphertext: row.key_ciphertext,
      iv: row.key_iv,
      authTag: row.key_auth_tag
    });
  } catch (err) {
    await recordKeyOutcome(row.id, {
      status: 'invalid',
      incError: 1,
      isFailure: true,
      lastError: `Decryption failed: ${err.message}`.slice(0, 500),
      testedAt: startedAt
    });
    return {
      ok: false,
      id: row.id,
      label: row.label,
      status: 'invalid',
      model,
      latencyMs: Date.now() - startedAt,
      error: 'Stored key could not be decrypted.'
    };
  }

  let result = null;
  for (const tryModel of candidateModels) {
    model = tryModel;
    try {
      result = await callGeminiGenerateContent({
        apiKey,
        model: tryModel,
        payload: {
          contents: [{ role: 'user', parts: [{ text: 'Reply OK' }] }],
          generationConfig: { maxOutputTokens: 16, temperature: 0 }
        },
        fetchFn,
        timeoutMs
      });
    } catch (err) {
      result = {
        ok: false,
        failure: classifyGeminiFailure(0, null, err)
      };
    }
    if (result.ok || result.failure?.kind === 'quota' || result.failure?.kind === 'invalid') {
      break;
    }
  }

  const latencyMs = Math.max(0, Date.now() - startedAt);
  const testedAt = Date.now();

  if (result.ok) {
    await recordKeyOutcome(row.id, {
      status: 'active',
      clearCooldown: true,
      incSuccess: 1,
      lastError: null,
      testedAt
    });
    return {
      ok: true,
      id: row.id,
      label: row.label,
      status: 'active',
      model,
      latencyMs,
      replyPreview: result.text.trim().slice(0, 80)
    };
  }

  const { kind, message } = result.failure;
  if (kind === 'quota') {
    const cooldownSeconds = Math.max(1, Number(settings.cooldownMinutes || 15)) * 60;
    await recordKeyOutcome(row.id, {
      status: 'cooldown',
      cooldownSeconds,
      incQuotaHit: 1,
      isFailure: true,
      lastError: message,
      testedAt
    });
    return {
      ok: false,
      id: row.id,
      label: row.label,
      status: 'cooldown',
      model,
      latencyMs,
      error: message
    };
  }

  if (kind === 'invalid') {
    await recordKeyOutcome(row.id, {
      status: 'invalid',
      clearCooldown: true,
      incError: 1,
      isFailure: true,
      lastError: message,
      testedAt
    });
    return {
      ok: false,
      id: row.id,
      label: row.label,
      status: 'invalid',
      model,
      latencyMs,
      error: message
    };
  }

  const updated = await recordKeyOutcome(row.id, {
    incError: 1,
    isFailure: true,
    lastError: message,
    testedAt
  });
  return {
    ok: false,
    id: row.id,
    label: row.label,
    status: updated?.status || row.status || 'active',
    model,
    latencyMs,
    error: message
  };
}
