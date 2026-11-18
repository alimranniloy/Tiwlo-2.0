import { isPgActive as defaultIsPgActive, queryPg as defaultQueryPg } from '../db/postgres.js';

const memTokens = new Map();
let pushSchemaPromise = null;

async function ensurePushSchema(queryPgFn, isPgActiveFn) {
  if (!isPgActiveFn()) return;
  if (pushSchemaPromise) return pushSchemaPromise;
  pushSchemaPromise = (async () => {
    await queryPgFn(`
      CREATE TABLE IF NOT EXISTS support_staff_push_tokens (
        token VARCHAR(255) PRIMARY KEY,
        staff_id VARCHAR(64) NOT NULL,
        staff_email VARCHAR(255),
        platform VARCHAR(32) NOT NULL DEFAULT 'android',
        device_name VARCHAR(160),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_support_push_staff ON support_staff_push_tokens (staff_id, is_active)`);
  })().catch((err) => {
    pushSchemaPromise = null;
    throw err;
  });
  return pushSchemaPromise;
}

export async function registerStaffPushToken({
  staffId,
  staffEmail = '',
  token,
  platform = 'android',
  deviceName = '',
  queryPgFn = defaultQueryPg,
  isPgActiveFn = defaultIsPgActive
} = {}) {
  const cleanToken = String(token || '').trim();
  const cleanStaffId = String(staffId || '').trim();
  if (!cleanToken || !cleanStaffId) return null;

  const record = {
    token: cleanToken.slice(0, 255),
    staffId: cleanStaffId,
    staffEmail: String(staffEmail || '').trim().toLowerCase() || null,
    platform: String(platform || 'android').slice(0, 32),
    deviceName: String(deviceName || '').slice(0, 160),
    isActive: true,
    updatedAt: new Date().toISOString()
  };

  if (isPgActiveFn()) {
    await ensurePushSchema(queryPgFn, isPgActiveFn);
    await queryPgFn(
      `INSERT INTO support_staff_push_tokens (token, staff_id, staff_email, platform, device_name, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (token) DO UPDATE SET
         staff_id = EXCLUDED.staff_id,
         staff_email = EXCLUDED.staff_email,
         platform = EXCLUDED.platform,
         device_name = EXCLUDED.device_name,
         is_active = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
      [record.token, record.staffId, record.staffEmail, record.platform, record.deviceName]
    );
  } else {
    memTokens.set(record.token, record);
  }
  return record;
}

export async function unregisterStaffPushToken({
  staffId = '',
  token = '',
  queryPgFn = defaultQueryPg,
  isPgActiveFn = defaultIsPgActive
} = {}) {
  const cleanToken = String(token || '').trim();
  const cleanStaff = String(staffId || '').trim();

  if (isPgActiveFn()) {
    await ensurePushSchema(queryPgFn, isPgActiveFn);
    if (cleanToken) {
      await queryPgFn(`UPDATE support_staff_push_tokens SET is_active = FALSE WHERE token = $1`, [cleanToken]);
    } else if (cleanStaff) {
      await queryPgFn(`UPDATE support_staff_push_tokens SET is_active = FALSE WHERE staff_id = $1`, [cleanStaff]);
    }
    return;
  }

  for (const [k, v] of memTokens.entries()) {
    if ((cleanToken && k === cleanToken) || (cleanStaff && v.staffId === cleanStaff)) {
      memTokens.delete(k);
    }
  }
}

export async function listActivePushTokens({
  targetStaffIds = null,
  excludeStaffIds = [],
  queryPgFn = defaultQueryPg,
  isPgActiveFn = defaultIsPgActive
} = {}) {
  const excludeSet = new Set((excludeStaffIds || []).map((id) => String(id)));
  const targetSet = Array.isArray(targetStaffIds) && targetStaffIds.length > 0
    ? new Set(targetStaffIds.map((id) => String(id)))
    : null;

  let rows = [];
  if (isPgActiveFn()) {
    try {
      await ensurePushSchema(queryPgFn, isPgActiveFn);
      const res = await queryPgFn(
        `SELECT token, staff_id, platform FROM support_staff_push_tokens WHERE is_active = TRUE`
      );
      rows = (res.rows || []).map((r) => ({
        token: r.token,
        staffId: String(r.staff_id),
        platform: r.platform
      }));
    } catch {
      return [];
    }
  } else {
    rows = Array.from(memTokens.values()).filter((r) => r.isActive !== false);
  }

  return rows.filter((r) => {
    if (!r.token || !r.token.startsWith('ExponentPushToken[')) return false;
    if (excludeSet.has(String(r.staffId))) return false;
    if (targetSet && !targetSet.has(String(r.staffId))) return false;
    return true;
  });
}

export async function dispatchSupportPushAlert({
  title,
  body,
  data = {},
  targetStaffIds = null,
  excludeStaffIds = [],
  queryPgFn = defaultQueryPg,
  isPgActiveFn = defaultIsPgActive
} = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    return { skipped: true, reason: 'test_env' };
  }
  const tokens = await listActivePushTokens({
    targetStaffIds,
    excludeStaffIds,
    queryPgFn,
    isPgActiveFn
  });
  if (tokens.length === 0) return { dispatched: 0 };

  const messages = tokens.map((entry) => ({
    to: entry.token,
    sound: 'default',
    priority: 'high',
    channelId: data?.ring === false ? 'tiwlo_support_alerts' : 'tiwlo_support_ring',
    title: String(title || 'Tiwlo Support').slice(0, 120),
    body: String(body || 'New support activity requires attention.').slice(0, 220),
    data: {
      ...data,
      ring: data?.ring !== false
    }
  }));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages),
      signal: controller.signal
    });
    clearTimeout(timer);
    return { dispatched: messages.length };
  } catch {
    return { dispatched: 0 };
  }
}
