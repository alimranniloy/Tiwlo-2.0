import { queryPg } from '../db/postgres.js';
import { normalizeClientIp } from '../security/freeTierAbuseGuard.js';

export const MAX_ACTIVE_RAM_SESSIONS = 2500;

const activeSessionsLru = new Map();
let schemaEnsured = false;
let schemaPromise = null;

export function resetLiveVisitorSchemaCache() {
  schemaEnsured = false;
  schemaPromise = null;
}

export function getActiveRamSessionsCount() {
  return activeSessionsLru.size;
}

export function clearActiveRamSessions() {
  activeSessionsLru.clear();
}

export function touchActiveRamSession(sessionId, entry) {
  const key = String(sessionId || '').trim().slice(0, 128);
  if (!key) return;
  if (activeSessionsLru.has(key)) {
    activeSessionsLru.delete(key);
  }
  activeSessionsLru.set(key, {
    ...entry,
    sessionId: key,
    touchedAtMs: Date.now()
  });
  while (activeSessionsLru.size > MAX_ACTIVE_RAM_SESSIONS) {
    const oldestKey = activeSessionsLru.keys().next().value;
    if (oldestKey === undefined) break;
    activeSessionsLru.delete(oldestKey);
  }
}

function capText(value, maxLen, fallback = '') {
  if (value === null || value === undefined) return fallback;
  let cleaned = '';
  for (const ch of String(value)) {
    const code = ch.charCodeAt(0);
    cleaned += code <= 31 || code === 127 ? ' ' : ch;
  }
  cleaned = cleaned.trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLen);
}

function normalizePath(value) {
  const raw = capText(value, 512, '/');
  if (!raw) return '/';
  const withoutHash = raw.split('#')[0] || '/';
  return withoutHash.startsWith('/') ? withoutHash.slice(0, 512) : `/${withoutHash}`.slice(0, 512);
}

export function parseUserAgentSummary(userAgent) {
  const ua = String(userAgent || '').trim();
  if (!ua) {
    return { deviceType: 'unknown', browserName: 'Unknown' };
  }
  const lower = ua.toLowerCase();

  let deviceType = 'desktop';
  if (/bot|crawler|spider|slurp|curl|wget|python-requests|headless/i.test(lower)) {
    deviceType = 'bot';
  } else if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(lower)) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(lower)) {
    deviceType = 'mobile';
  }

  let browserName = 'Unknown';
  if (deviceType === 'bot') {
    browserName = 'Bot';
  } else if (/edg\//i.test(ua)) {
    browserName = 'Edge';
  } else if (/opr\//i.test(ua) || /opera/i.test(lower)) {
    browserName = 'Opera';
  } else if (/samsungbrowser/i.test(lower)) {
    browserName = 'Samsung Internet';
  } else if (/brave/i.test(lower)) {
    browserName = 'Brave';
  } else if (/firefox|fxios/i.test(lower)) {
    browserName = 'Firefox';
  } else if (/chrome|crios/i.test(lower)) {
    browserName = 'Chrome';
  } else if (/safari/i.test(lower)) {
    browserName = 'Safari';
  }

  return { deviceType, browserName };
}

function sanitizeTrailMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const entries = Object.entries(input)
    .filter(([key, val]) =>
      typeof key === 'string' &&
      !/(password|otp|token|secret|authorization|cookie|pin)/i.test(key) &&
      (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean')
    )
    .slice(0, 12)
    .map(([key, val]) => [
      key.slice(0, 48),
      typeof val === 'string' ? val.slice(0, 200) : val
    ]);
  return Object.fromEntries(entries);
}

async function runSchemaStatements(q) {
  await q(`
    CREATE TABLE IF NOT EXISTS live_visitor_sessions (
      session_id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT,
      is_guest BOOLEAN DEFAULT true,
      current_path TEXT NOT NULL,
      page_title TEXT,
      tiwi_id TEXT,
      product_id TEXT,
      product_name TEXT,
      referrer TEXT,
      device_type TEXT,
      browser_name TEXT,
      ip_address TEXT,
      country TEXT,
      page_views_count INTEGER DEFAULT 1,
      active_seconds INTEGER DEFAULT 0,
      first_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      last_event_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_live_visitor_sessions_last_seen
    ON live_visitor_sessions(last_seen_at DESC)
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_live_visitor_sessions_path
    ON live_visitor_sessions(current_path)
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_live_visitor_sessions_user
    ON live_visitor_sessions(user_id)
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS analytics_page_daily (
      day_bucket DATE NOT NULL,
      page_path TEXT NOT NULL,
      page_title TEXT,
      views_count BIGINT DEFAULT 0,
      unique_visitors BIGINT DEFAULT 0,
      total_dwell_seconds BIGINT DEFAULT 0,
      PRIMARY KEY (day_bucket, page_path)
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS analytics_product_daily (
      day_bucket DATE NOT NULL,
      tiwi_id TEXT NOT NULL DEFAULT '',
      product_id TEXT NOT NULL,
      product_name TEXT,
      views_count BIGINT DEFAULT 0,
      unique_visitors BIGINT DEFAULT 0,
      PRIMARY KEY (day_bucket, tiwi_id, product_id)
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS analytics_visitor_seen_daily (
      day_bucket DATE NOT NULL,
      scope TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      PRIMARY KEY (day_bucket, scope, visitor_id)
    )
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS user_activity_trail (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      visitor_id TEXT,
      session_id TEXT,
      event_kind TEXT NOT NULL,
      page_path TEXT,
      target_label TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_user_activity_trail_user_id_desc
    ON user_activity_trail(user_id, id DESC)
  `);
  await q(`
    CREATE INDEX IF NOT EXISTS idx_user_activity_trail_created_at
    ON user_activity_trail(created_at)
  `);
}

export async function ensureLiveVisitorSchema({ queryPg: q = queryPg } = {}) {
  if (q !== queryPg) {
    await runSchemaStatements(q);
    return;
  }
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = runSchemaStatements(q)
      .then(() => {
        schemaEnsured = true;
      })
      .catch((err) => {
        schemaPromise = null;
        throw err;
      });
  }
  await schemaPromise;
}

export async function recordVisitorHeartbeat(payload = {}, { queryPg: q = queryPg } = {}) {
  await ensureLiveVisitorSchema({ queryPg: q });

  const sessionId = capText(payload.sessionId, 128);
  const visitorId = capText(payload.visitorId || sessionId, 128);
  if (!sessionId || !visitorId) {
    const err = new TypeError('sessionId and visitorId are required.');
    err.statusCode = 400;
    throw err;
  }

  const currentPath = normalizePath(payload.path);
  const pageTitle = capText(payload.title, 256, null);
  const tiwiId = capText(payload.tiwiId, 64, '');
  const productId = capText(payload.productId, 128, null);
  const productName = capText(payload.productName, 256, null);
  const referrer = capText(payload.referrer, 512, null);
  const country = capText(payload.country, 64, null);
  const normalizedIp = payload.ip ? normalizeClientIp(String(payload.ip)) : null;
  const ipAddress = capText(normalizedIp || payload.ip, 64, null);
  const { deviceType, browserName } = parseUserAgentSummary(payload.userAgent);

  const dwellRaw = Number(payload.dwellDeltaSeconds);
  const dwellDeltaSeconds = Number.isFinite(dwellRaw)
    ? Math.max(0, Math.min(120, Math.round(dwellRaw)))
    : 0;

  const isPageTransition = payload.isPageTransition === true;
  const cleanEventKind = capText(payload.eventKind, 64, isPageTransition ? 'page_view' : 'heartbeat');
  const targetLabel = capText(payload.targetLabel, 256, null);

  const user = payload.user && payload.user.id ? payload.user : null;
  const userId = user ? capText(user.id, 64, null) : null;
  const userName = user ? capText(user.name || user.storeName || user.email, 255, null) : null;
  const userEmail = user ? capText(user.email, 255, null) : null;
  const isGuest = !userId;

  const isMeaningfulEvent =
    isPageTransition ||
    Boolean(targetLabel) ||
    (cleanEventKind !== 'heartbeat' && cleanEventKind !== 'stay' && cleanEventKind !== 'ping');

  touchActiveRamSession(sessionId, {
    visitorId,
    userId,
    isGuest,
    currentPath,
    tiwiId: tiwiId || null
  });

  await q(
    `INSERT INTO live_visitor_sessions (
       session_id, visitor_id, user_id, user_name, user_email, is_guest,
       current_path, page_title, tiwi_id, product_id, product_name, referrer,
       device_type, browser_name, ip_address, country,
       page_views_count, active_seconds, first_seen_at, last_seen_at, last_event_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, NULLIF($9, ''), $10, $11, $12,
       $13, $14, $15, $16,
       $17, $18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     )
     ON CONFLICT (session_id) DO UPDATE SET
       visitor_id = EXCLUDED.visitor_id,
       user_id = COALESCE(EXCLUDED.user_id, live_visitor_sessions.user_id),
       user_name = COALESCE(EXCLUDED.user_name, live_visitor_sessions.user_name),
       user_email = COALESCE(EXCLUDED.user_email, live_visitor_sessions.user_email),
       is_guest = CASE WHEN EXCLUDED.user_id IS NOT NULL THEN false ELSE live_visitor_sessions.is_guest END,
       current_path = EXCLUDED.current_path,
       page_title = COALESCE(EXCLUDED.page_title, live_visitor_sessions.page_title),
       tiwi_id = COALESCE(EXCLUDED.tiwi_id, live_visitor_sessions.tiwi_id),
       product_id = EXCLUDED.product_id,
       product_name = EXCLUDED.product_name,
       referrer = COALESCE(EXCLUDED.referrer, live_visitor_sessions.referrer),
       device_type = COALESCE(EXCLUDED.device_type, live_visitor_sessions.device_type),
       browser_name = COALESCE(EXCLUDED.browser_name, live_visitor_sessions.browser_name),
       ip_address = COALESCE(EXCLUDED.ip_address, live_visitor_sessions.ip_address),
       country = COALESCE(EXCLUDED.country, live_visitor_sessions.country),
       page_views_count = live_visitor_sessions.page_views_count + $19,
       active_seconds = live_visitor_sessions.active_seconds + $18,
       last_seen_at = CURRENT_TIMESTAMP,
       last_event_at = CASE WHEN $20 THEN CURRENT_TIMESTAMP ELSE live_visitor_sessions.last_event_at END`,
    [
      sessionId,
      visitorId,
      userId,
      userName,
      userEmail,
      isGuest,
      currentPath,
      pageTitle,
      tiwiId,
      productId,
      productName,
      referrer,
      deviceType,
      browserName,
      ipAddress,
      country,
      isPageTransition ? 1 : 0,
      dwellDeltaSeconds,
      isPageTransition ? 1 : 0,
      isMeaningfulEvent
    ]
  );

  if (isPageTransition || dwellDeltaSeconds > 0) {
    let uniquePageDelta = 0;
    if (isPageTransition) {
      const seenScope = capText(`page:${currentPath}`, 540);
      const seenRes = await q(
        `INSERT INTO analytics_visitor_seen_daily (day_bucket, scope, visitor_id)
         VALUES (CURRENT_DATE, $1, $2)
         ON CONFLICT (day_bucket, scope, visitor_id) DO NOTHING
         RETURNING visitor_id`,
        [seenScope, visitorId]
      );
      uniquePageDelta = Array.isArray(seenRes?.rows) && seenRes.rows.length > 0 ? 1 : 0;
    }

    await q(
      `INSERT INTO analytics_page_daily (
         day_bucket, page_path, page_title, views_count, unique_visitors, total_dwell_seconds
       ) VALUES (
         CURRENT_DATE, $1, $2, $3, $4, $5
       )
       ON CONFLICT (day_bucket, page_path) DO UPDATE SET
         page_title = COALESCE(NULLIF(EXCLUDED.page_title, ''), analytics_page_daily.page_title),
         views_count = analytics_page_daily.views_count + EXCLUDED.views_count,
         unique_visitors = analytics_page_daily.unique_visitors + EXCLUDED.unique_visitors,
         total_dwell_seconds = analytics_page_daily.total_dwell_seconds + EXCLUDED.total_dwell_seconds`,
      [
        currentPath,
        pageTitle,
        isPageTransition ? 1 : 0,
        uniquePageDelta,
        dwellDeltaSeconds
      ]
    );
  }

  if (isPageTransition && productId) {
    const productScope = capText(`product:${tiwiId}:${productId}`, 540);
    const seenProdRes = await q(
      `INSERT INTO analytics_visitor_seen_daily (day_bucket, scope, visitor_id)
       VALUES (CURRENT_DATE, $1, $2)
       ON CONFLICT (day_bucket, scope, visitor_id) DO NOTHING
       RETURNING visitor_id`,
      [productScope, visitorId]
    );
    const uniqueProdDelta = Array.isArray(seenProdRes?.rows) && seenProdRes.rows.length > 0 ? 1 : 0;

    await q(
      `INSERT INTO analytics_product_daily (
         day_bucket, tiwi_id, product_id, product_name, views_count, unique_visitors
       ) VALUES (
         CURRENT_DATE, $1, $2, $3, 1, $4
       )
       ON CONFLICT (day_bucket, tiwi_id, product_id) DO UPDATE SET
         product_name = COALESCE(NULLIF(EXCLUDED.product_name, ''), analytics_product_daily.product_name),
         views_count = analytics_product_daily.views_count + 1,
         unique_visitors = analytics_product_daily.unique_visitors + EXCLUDED.unique_visitors`,
      [tiwiId, productId, productName, uniqueProdDelta]
    );
  }

  if (isMeaningfulEvent) {
    const safeMeta = sanitizeTrailMetadata({
      ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
      ...(tiwiId ? { tiwiId } : {}),
      ...(productId ? { productId } : {}),
      ...(productName ? { productName } : {}),
      ...(pageTitle ? { title: pageTitle } : {})
    });
    await q(
      `INSERT INTO user_activity_trail (
         user_id, visitor_id, session_id, event_kind, page_path, target_label, metadata, ip_address
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        userId,
        visitorId,
        sessionId,
        cleanEventKind,
        currentPath,
        targetLabel,
        JSON.stringify(safeMeta),
        ipAddress
      ]
    );
  }

  return {
    ok: true,
    sessionId,
    visitorId,
    recordedTrail: isMeaningfulEvent
  };
}

export async function getLiveVisitorAnalytics(
  { windowSeconds = 120, days = 7, limit = 25 } = {},
  { queryPg: q = queryPg, viewerIsSuperAdmin = true } = {}
) {
  await ensureLiveVisitorSchema({ queryPg: q });

  const boundedWindow = Math.max(15, Math.min(3600, Number.parseInt(windowSeconds, 10) || 120));
  const boundedDays = Math.max(1, Math.min(90, Number.parseInt(days, 10) || 7));
  const boundedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 25));
  const dayOffset = boundedDays - 1;

  const [liveCountRes, liveRowsRes, breakdownRes, popularPagesRes, popularProductsRes] = await Promise.all([
    q(
      `SELECT COUNT(*)::int AS total
       FROM live_visitor_sessions
       WHERE last_seen_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')`,
      [boundedWindow]
    ),
    q(
      `SELECT session_id, visitor_id, user_id, user_name, user_email, is_guest,
              current_path, page_title, tiwi_id, product_id, product_name, referrer,
              device_type, browser_name, ip_address, country,
              page_views_count, active_seconds, first_seen_at, last_seen_at, last_event_at
       FROM live_visitor_sessions
       WHERE last_seen_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
       ORDER BY last_seen_at DESC
       LIMIT $2`,
      [boundedWindow, boundedLimit]
    ),
    q(
      `SELECT current_path AS path,
              MAX(page_title) AS title,
              COUNT(*)::int AS active_count
       FROM live_visitor_sessions
       WHERE last_seen_at >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
       GROUP BY current_path
       ORDER BY active_count DESC, current_path ASC
       LIMIT $2`,
      [boundedWindow, boundedLimit]
    ),
    q(
      `SELECT page_path AS path,
              MAX(page_title) AS title,
              SUM(views_count)::bigint AS views_count,
              SUM(unique_visitors)::bigint AS unique_visitors,
              SUM(total_dwell_seconds)::bigint AS total_dwell_seconds
       FROM analytics_page_daily
       WHERE day_bucket >= CURRENT_DATE - ($1 * INTERVAL '1 day')
       GROUP BY page_path
       ORDER BY views_count DESC, unique_visitors DESC, page_path ASC
       LIMIT $2`,
      [dayOffset, boundedLimit]
    ),
    q(
      `SELECT tiwi_id,
              product_id,
              MAX(product_name) AS product_name,
              SUM(views_count)::bigint AS views_count,
              SUM(unique_visitors)::bigint AS unique_visitors
       FROM analytics_product_daily
       WHERE day_bucket >= CURRENT_DATE - ($1 * INTERVAL '1 day')
       GROUP BY tiwi_id, product_id
       ORDER BY views_count DESC, unique_visitors DESC, product_id ASC
       LIMIT $2`,
      [dayOffset, boundedLimit]
    )
  ]);

  const liveVisitorsCount = Number(liveCountRes?.rows?.[0]?.total || 0);

  const liveVisitors = (liveRowsRes?.rows || []).map((row) => {
    const isProtectedSuper =
      !viewerIsSuperAdmin &&
      String(row.user_email || '').trim().toLowerCase() === 'tiwloltd@gmail.com';
    return {
      sessionId: row.session_id,
      visitorId: row.visitor_id,
      userId: isProtectedSuper ? null : (row.user_id || null),
      userName: isProtectedSuper ? 'Visitor' : (row.user_name || null),
      userEmail: isProtectedSuper ? null : (row.user_email || null),
      isGuest: isProtectedSuper ? true : Boolean(row.is_guest ?? !row.user_id),
      currentPath: row.current_path || '/',
      pageTitle: row.page_title || null,
      tiwiId: row.tiwi_id || null,
      productId: row.product_id || null,
      productName: row.product_name || null,
      referrer: row.referrer || null,
      deviceType: row.device_type || 'unknown',
      browserName: row.browser_name || 'Unknown',
      ipAddress: isProtectedSuper ? null : (row.ip_address || null),
      country: row.country || null,
      pageViewsCount: Number(row.page_views_count || 0),
      activeSeconds: Number(row.active_seconds || 0),
      firstSeenAt: row.first_seen_at || null,
      lastSeenAt: row.last_seen_at || null,
      lastEventAt: row.last_event_at || null
    };
  });

  const breakdownRows = breakdownRes?.rows || [];
  const breakdownTotal = liveVisitorsCount > 0
    ? liveVisitorsCount
    : breakdownRows.reduce((sum, r) => sum + Number(r.active_count || 0), 0);

  const livePageBreakdown = breakdownRows.map((row) => {
    const activeCount = Number(row.active_count || 0);
    return {
      path: row.path || '/',
      title: row.title || null,
      activeCount,
      sharePct: breakdownTotal > 0 ? Math.round((activeCount / breakdownTotal) * 1000) / 10 : 0
    };
  });

  const pageRows = popularPagesRes?.rows || [];
  const totalPageViews = pageRows.reduce((sum, r) => sum + Number(r.views_count || 0), 0);
  const popularPages = pageRows.map((row) => {
    const viewsCount = Number(row.views_count || 0);
    const uniqueVisitors = Number(row.unique_visitors || 0);
    const totalDwell = Number(row.total_dwell_seconds || 0);
    return {
      path: row.path || '/',
      title: row.title || null,
      viewsCount,
      uniqueVisitors,
      avgDwellSeconds: viewsCount > 0 ? Math.round(totalDwell / viewsCount) : 0,
      sharePct: totalPageViews > 0 ? Math.round((viewsCount / totalPageViews) * 1000) / 10 : 0
    };
  });

  const productRows = popularProductsRes?.rows || [];
  const totalProductViews = productRows.reduce((sum, r) => sum + Number(r.views_count || 0), 0);
  const popularProducts = productRows.map((row) => {
    const viewsCount = Number(row.views_count || 0);
    return {
      productId: row.product_id,
      productName: row.product_name || row.product_id,
      tiwiId: row.tiwi_id || '',
      viewsCount,
      uniqueVisitors: Number(row.unique_visitors || 0),
      sharePct: totalProductViews > 0 ? Math.round((viewsCount / totalProductViews) * 1000) / 10 : 0
    };
  });

  return {
    liveVisitorsCount,
    liveVisitors,
    livePageBreakdown,
    popularPages,
    popularProducts
  };
}

async function safeQueryOptional(q, sql, params = []) {
  try {
    return await q(sql, params);
  } catch (err) {
    if (err?.code === '42P01' || err?.code === '42703') {
      return { rows: [] };
    }
    throw err;
  }
}

export async function getUserPaginatedTrail(
  userId,
  { cursorId = null, limit = 30 } = {},
  { queryPg: q = queryPg, userEmail = null } = {}
) {
  await ensureLiveVisitorSchema({ queryPg: q });

  const cleanUserId = capText(userId, 64);
  if (!cleanUserId) {
    const err = new TypeError('userId is required.');
    err.statusCode = 400;
    throw err;
  }

  const boundedLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 30));
  const cleanCursor = cursorId !== null && cursorId !== undefined && cursorId !== ''
    ? String(cursorId).trim()
    : null;
  if (cleanCursor !== null && !/^\d+$/.test(cleanCursor)) {
    const err = new TypeError('cursorId must be a numeric ID.');
    err.statusCode = 400;
    throw err;
  }

  const trailRes = await q(
    `SELECT id, user_id, visitor_id, session_id, event_kind, page_path,
            target_label, metadata, ip_address, created_at
     FROM user_activity_trail
     WHERE user_id = $1
       AND ($2::bigint IS NULL OR id < $2)
     ORDER BY id DESC
     LIMIT $3`,
    [cleanUserId, cleanCursor, boundedLimit + 1]
  );

  const rawRows = trailRes?.rows || [];
  const hasMore = rawRows.length > boundedLimit;
  const pageRows = hasMore ? rawRows.slice(0, boundedLimit) : rawRows;
  const items = pageRows.map((row) => ({
    id: String(row.id),
    userId: row.user_id,
    visitorId: row.visitor_id || null,
    sessionId: row.session_id || null,
    eventKind: row.event_kind,
    pagePath: row.page_path || null,
    targetLabel: row.target_label || null,
    metadata: row.metadata || {},
    ipAddress: row.ip_address || null,
    createdAt: row.created_at
  }));
  const nextCursorId = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  // Bounded auxiliary context (security events & email outbox) on initial page load
  let securityEvents = [];
  let securityEventsCount = 0;
  let emailActivity = [];
  let emailActivityCount = 0;

  if (cleanCursor === null) {
    const [secRowsRes, secCountRes] = await Promise.all([
      safeQueryOptional(
        q,
        `SELECT id, event_type, severity, remote_ip::text AS remote_ip, user_agent, details, created_at
         FROM system_security_events
         WHERE user_id = $1
         ORDER BY id DESC
         LIMIT 15`,
        [cleanUserId]
      ),
      safeQueryOptional(
        q,
        `SELECT COUNT(*)::int AS total FROM system_security_events WHERE user_id = $1`,
        [cleanUserId]
      )
    ]);
    securityEvents = (secRowsRes?.rows || []).map((row) => ({
      id: String(row.id),
      eventType: row.event_type,
      severity: row.severity,
      ipAddress: row.remote_ip || null,
      userAgent: row.user_agent || null,
      details: row.details || {},
      createdAt: row.created_at
    }));
    securityEventsCount = Number(secCountRes?.rows?.[0]?.total || securityEvents.length);

    if (userEmail) {
      const cleanEmail = capText(userEmail, 255).toLowerCase();
      const [mailRowsRes, mailCountRes] = await Promise.all([
        safeQueryOptional(
          q,
          `SELECT id, recipient, subject, email_type, delivery_status, created_at
           FROM system_email_outbox
           WHERE LOWER(recipient) = $1
           ORDER BY id DESC
           LIMIT 15`,
          [cleanEmail]
        ),
        safeQueryOptional(
          q,
          `SELECT COUNT(*)::int AS total FROM system_email_outbox WHERE LOWER(recipient) = $1`,
          [cleanEmail]
        )
      ]);
      emailActivity = (mailRowsRes?.rows || []).map((row) => ({
        id: String(row.id),
        recipient: row.recipient,
        subject: row.subject,
        emailType: row.email_type,
        status: row.delivery_status,
        createdAt: row.created_at
      }));
      emailActivityCount = Number(mailCountRes?.rows?.[0]?.total || emailActivity.length);
    }
  }

  return {
    items,
    nextCursorId,
    hasMore,
    securityEvents,
    securityEventsCount,
    emailActivity,
    emailActivityCount
  };
}
