import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ACTIVE_RAM_SESSIONS,
  clearActiveRamSessions,
  ensureLiveVisitorSchema,
  getActiveRamSessionsCount,
  getLiveVisitorAnalytics,
  getUserPaginatedTrail,
  parseUserAgentSummary,
  recordVisitorHeartbeat,
  touchActiveRamSession
} from './liveVisitorService.js';

function createMockQueryRecorder({ responses = {} } = {}) {
  const calls = [];
  const queryPg = async (sql, params = []) => {
    const text = String(sql).trim();
    calls.push({ sql: text, params });
    if (typeof responses.handler === 'function') {
      const handled = await responses.handler(text, params, calls);
      if (handled !== undefined) return handled;
    }
    return { rows: [] };
  };
  return { calls, queryPg };
}

test('ensureLiveVisitorSchema creates all required tables and indexes idempotently', async () => {
  const { calls, queryPg } = createMockQueryRecorder();
  await ensureLiveVisitorSchema({ queryPg });

  const joined = calls.map((c) => c.sql).join('\n');
  assert.match(joined, /CREATE TABLE IF NOT EXISTS live_visitor_sessions/);
  assert.match(joined, /CREATE TABLE IF NOT EXISTS analytics_page_daily/);
  assert.match(joined, /CREATE TABLE IF NOT EXISTS analytics_product_daily/);
  assert.match(joined, /CREATE TABLE IF NOT EXISTS analytics_visitor_seen_daily/);
  assert.match(joined, /CREATE TABLE IF NOT EXISTS user_activity_trail/);
  assert.match(joined, /idx_live_visitor_sessions_last_seen/);
  assert.match(joined, /idx_live_visitor_sessions_path/);
  assert.match(joined, /idx_live_visitor_sessions_user/);
  assert.match(joined, /idx_user_activity_trail_user_id_desc/);
  assert.match(joined, /idx_user_activity_trail_created_at/);
});

test('in-memory active session LRU cache stays strictly bounded at MAX_ACTIVE_RAM_SESSIONS (2500)', () => {
  clearActiveRamSessions();
  assert.equal(MAX_ACTIVE_RAM_SESSIONS, 2500);

  for (let i = 1; i <= 2650; i++) {
    touchActiveRamSession(`sess_${i}`, { visitorId: `vis_${i}`, currentPath: '/' });
  }
  assert.equal(getActiveRamSessionsCount(), 2500);

  // Touching an existing session keeps size at 2500
  touchActiveRamSession('sess_2600', { visitorId: 'vis_2600', currentPath: '/pricing' });
  assert.equal(getActiveRamSessionsCount(), 2500);
  clearActiveRamSessions();
});

test('getLiveVisitorAnalytics returns strictly 0 and [] with zero dummy data when database is empty', async () => {
  const { queryPg } = createMockQueryRecorder();
  const result = await getLiveVisitorAnalytics({ windowSeconds: 120, days: 7, limit: 25 }, { queryPg });

  assert.deepEqual(result, {
    liveVisitorsCount: 0,
    liveVisitors: [],
    livePageBreakdown: [],
    popularPages: [],
    popularProducts: []
  });
});

test('recordVisitorHeartbeat clamps dwell, skips trail on stay pings, and logs meaningful transitions + product views', async () => {
  clearActiveRamSessions();
  const { calls, queryPg } = createMockQueryRecorder({
    responses: {
      handler: (sql) => {
        if (sql.includes('INSERT INTO analytics_visitor_seen_daily')) {
          return { rows: [{ visitor_id: 'v_1' }] };
        }
        return { rows: [] };
      }
    }
  });

  // 1. Periodic heartbeat ping -> must NOT insert into user_activity_trail
  const beat1 = await recordVisitorHeartbeat(
    {
      visitorId: 'v_1',
      sessionId: 's_1',
      path: '/products/shoes',
      title: 'Running Shoes',
      dwellDeltaSeconds: 999, // should clamp to 120
      isPageTransition: false,
      eventKind: 'heartbeat',
      ip: '::ffff:203.0.113.10',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
    },
    { queryPg }
  );
  assert.equal(beat1.recordedTrail, false);

  const sessionInsert = calls.find((c) => c.sql.includes('INSERT INTO live_visitor_sessions'));
  assert.ok(sessionInsert);
  assert.equal(sessionInsert.params[17], 120); // clamped dwell
  assert.equal(sessionInsert.params[12], 'mobile');
  assert.equal(sessionInsert.params[13], 'Safari');
  assert.equal(sessionInsert.params[14], '203.0.113.10');
  assert.equal(calls.some((c) => c.sql.includes('INSERT INTO user_activity_trail')), false);

  // 2. Page transition with product -> MUST update page daily, product daily, and user_activity_trail
  calls.length = 0;
  const beat2 = await recordVisitorHeartbeat(
    {
      visitorId: 'v_1',
      sessionId: 's_1',
      path: '/store/acme/product/sku_99',
      title: 'Apex Sneaker',
      tiwiId: 'tiw_acme',
      productId: 'sku_99',
      productName: 'Apex Sneaker',
      dwellDeltaSeconds: -5, // clamps to 0
      isPageTransition: true,
      eventKind: 'page_view',
      user: { id: 'u_42', name: 'Alice', email: 'alice@example.com' }
    },
    { queryPg }
  );
  assert.equal(beat2.recordedTrail, true);
  assert.equal(calls.some((c) => c.sql.includes('INSERT INTO analytics_page_daily')), true);
  assert.equal(calls.some((c) => c.sql.includes('INSERT INTO analytics_product_daily')), true);
  const trailInsert = calls.find((c) => c.sql.includes('INSERT INTO user_activity_trail'));
  assert.ok(trailInsert);
  assert.equal(trailInsert.params[0], 'u_42');
  assert.equal(trailInsert.params[3], 'page_view');
  assert.equal(trailInsert.params[4], '/store/acme/product/sku_99');
  clearActiveRamSessions();
});

test('getLiveVisitorAnalytics computes accurate page share %, avgDwellSeconds, and product rankings', async () => {
  const { queryPg } = createMockQueryRecorder({
    responses: {
      handler: (sql) => {
        if (sql.includes('SELECT COUNT(*)::int AS total') && sql.includes('FROM live_visitor_sessions')) {
          return { rows: [{ total: 4 }] };
        }
        if (sql.includes('FROM live_visitor_sessions') && sql.includes('ORDER BY last_seen_at DESC')) {
          return {
            rows: [
              {
                session_id: 's_1',
                visitor_id: 'v_1',
                user_id: 'u_1',
                user_name: 'Alice',
                user_email: 'alice@example.com',
                is_guest: false,
                current_path: '/',
                page_title: 'Home',
                device_type: 'desktop',
                browser_name: 'Chrome',
                page_views_count: 3,
                active_seconds: 95
              }
            ]
          };
        }
        if (sql.includes('GROUP BY current_path')) {
          return {
            rows: [
              { path: '/', title: 'Home', active_count: 3 },
              { path: '/pricing', title: 'Pricing', active_count: 1 }
            ]
          };
        }
        if (sql.includes('FROM analytics_page_daily')) {
          return {
            rows: [
              { path: '/', title: 'Home', views_count: '300', unique_visitors: '180', total_dwell_seconds: '9000' },
              { path: '/pricing', title: 'Pricing', views_count: '100', unique_visitors: '80', total_dwell_seconds: '4500' }
            ]
          };
        }
        if (sql.includes('FROM analytics_product_daily')) {
          return {
            rows: [
              { tiwi_id: 'tiw_1', product_id: 'p_1', product_name: 'Pro Hoodie', views_count: '80', unique_visitors: '50' },
              { tiwi_id: 'tiw_1', product_id: 'p_2', product_name: 'Cap', views_count: '20', unique_visitors: '15' }
            ]
          };
        }
        return { rows: [] };
      }
    }
  });

  const analytics = await getLiveVisitorAnalytics({ windowSeconds: 120, days: 7, limit: 25 }, { queryPg });
  assert.equal(analytics.liveVisitorsCount, 4);
  assert.equal(analytics.livePageBreakdown[0].sharePct, 75);
  assert.equal(analytics.livePageBreakdown[1].sharePct, 25);

  assert.equal(analytics.popularPages[0].path, '/');
  assert.equal(analytics.popularPages[0].viewsCount, 300);
  assert.equal(analytics.popularPages[0].avgDwellSeconds, 30);
  assert.equal(analytics.popularPages[0].sharePct, 75);
  assert.equal(analytics.popularPages[1].avgDwellSeconds, 45);
  assert.equal(analytics.popularPages[1].sharePct, 25);

  assert.equal(analytics.popularProducts[0].productId, 'p_1');
  assert.equal(analytics.popularProducts[0].sharePct, 80);
  assert.equal(analytics.popularProducts[1].sharePct, 20);
});

test('getUserPaginatedTrail enforces keyset cursor pagination and merges bounded security/email activity', async () => {
  const { calls, queryPg } = createMockQueryRecorder({
    responses: {
      handler: (sql, params) => {
        if (sql.includes('FROM user_activity_trail')) {
          assert.equal(params[0], 'u_42');
          assert.equal(params[2], 3); // limit + 1 when limit=2
          return {
            rows: [
              { id: '105', user_id: 'u_42', event_kind: 'click', page_path: '/dashboard', target_label: 'Save', metadata: {}, created_at: '2026-11-15T10:05:00Z' },
              { id: '104', user_id: 'u_42', event_kind: 'page_view', page_path: '/products', target_label: 'Products', metadata: {}, created_at: '2026-11-15T10:04:00Z' },
              { id: '103', user_id: 'u_42', event_kind: 'page_view', page_path: '/', target_label: 'Home', metadata: {}, created_at: '2026-11-15T10:03:00Z' }
            ]
          };
        }
        if (sql.includes('SELECT COUNT(*)::int AS total FROM system_security_events')) {
          return { rows: [{ total: 12 }] };
        }
        if (sql.includes('FROM system_security_events')) {
          return {
            rows: [
              { id: '9', event_type: 'auth.login', severity: 'info', remote_ip: '1.2.3.4', details: {}, created_at: '2026-11-15T10:00:00Z' }
            ]
          };
        }
        if (sql.includes('SELECT COUNT(*)::int AS total FROM system_email_outbox')) {
          return { rows: [{ total: 3 }] };
        }
        if (sql.includes('FROM system_email_outbox')) {
          return {
            rows: [
              { id: '5', recipient: 'alice@example.com', subject: 'Welcome', email_type: 'welcome', delivery_status: 'sent', created_at: '2026-11-15T09:50:00Z' }
            ]
          };
        }
        return { rows: [] };
      }
    }
  });

  const page1 = await getUserPaginatedTrail('u_42', { cursorId: null, limit: 2 }, { queryPg, userEmail: 'alice@example.com' });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.hasMore, true);
  assert.equal(page1.nextCursorId, '104');
  assert.equal(page1.securityEventsCount, 12);
  assert.equal(page1.securityEvents.length, 1);
  assert.equal(page1.emailActivityCount, 3);
  assert.equal(page1.emailActivity.length, 1);

  const trailQuery = calls.find((c) => c.sql.includes('FROM user_activity_trail'));
  assert.match(trailQuery.sql, /WHERE user_id = \$1\s+AND \(\$2::bigint IS NULL OR id < \$2\)\s+ORDER BY id DESC\s+LIMIT \$3/);

  // Cursor must reject non-numeric strings
  await assert.rejects(
    () => getUserPaginatedTrail('u_42', { cursorId: 'abc', limit: 2 }, { queryPg }),
    /numeric/i
  );
});

test('parseUserAgentSummary classifies desktop, mobile, tablet, and bots cleanly', () => {
  assert.deepEqual(
    parseUserAgentSummary('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'),
    { deviceType: 'desktop', browserName: 'Chrome' }
  );
  assert.deepEqual(
    parseUserAgentSummary('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'),
    { deviceType: 'tablet', browserName: 'Safari' }
  );
  assert.deepEqual(
    parseUserAgentSummary('curl/8.5.0'),
    { deviceType: 'bot', browserName: 'Bot' }
  );
});
