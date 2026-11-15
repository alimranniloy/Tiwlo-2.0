import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createAdminTelemetryRouter } from './adminTelemetryRoutes.js';
import { createTelemetryRouter } from '../routes/telemetryRoutes.js';

function startServer(setupFn) {
  const app = express();
  app.use(express.json());
  setupFn(app);

  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

test('POST /api/telemetry/visitor/heartbeat validates payload, extracts IP/UA/user, and handles sendBeacon text/plain', async () => {
  const recorded = [];
  const srv = await startServer((app) => {
    app.use((req, _res, next) => {
      if (req.headers['x-test-user']) {
        req.activeUser = JSON.parse(String(req.headers['x-test-user']));
      }
      next();
    });
    app.use(
      '/api/telemetry',
      createTelemetryRouter({
        rateLimitStore: undefined,
        recordHeartbeat: async (payload) => {
          recorded.push(payload);
          return { ok: true };
        }
      })
    );
  });

  try {
    // Missing visitorId/sessionId -> 400
    const badRes = await fetch(`${srv.baseUrl}/api/telemetry/visitor/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/' })
    });
    assert.equal(badRes.status, 400);

    // Valid JSON heartbeat with activeUser
    const okRes = await fetch(`${srv.baseUrl}/api/telemetry/visitor/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 Chrome/131.0.0.0',
        'cf-ipcountry': 'BD',
        'x-test-user': JSON.stringify({ id: 'u_9', name: 'Imran', email: 'imran@example.com' })
      },
      body: JSON.stringify({
        visitorId: 'vis_1',
        sessionId: 'ses_1',
        path: '/store/tiw_1/product/p_7',
        title: 'Product Seven',
        tiwiId: 'tiw_1',
        productId: 'p_7',
        productName: 'Product Seven',
        dwellDeltaSeconds: 20,
        isPageTransition: true
      })
    });
    assert.equal(okRes.status, 200);
    assert.deepEqual(await okRes.json(), { ok: true });
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].user.id, 'u_9');
    assert.equal(recorded[0].country, 'BD');
    assert.equal(recorded[0].productId, 'p_7');

    // sendBeacon text/plain JSON payload
    const beaconRes = await fetch(`${srv.baseUrl}/api/telemetry/visitor/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        visitorId: 'vis_2',
        sessionId: 'ses_2',
        path: '/pricing',
        dwellDeltaSeconds: 12
      })
    });
    assert.equal(beaconRes.status, 200);
    assert.equal(recorded.length, 2);
    assert.equal(recorded[1].path, '/pricing');
  } finally {
    await srv.close();
  }
});

test('adminTelemetryRoutes enforces super_admin isolation, permissions, and reauth on policy/GC endpoints', async () => {
  const users = [
    { id: 'u_super', email: 'tiwloltd@gmail.com', role: 'super_admin', name: 'Root', isBanned: false, identityVerified: true },
    { id: 'u_staff', email: 'staff@tiwlo.com', role: 'admin', name: 'Staff', isBanned: false, identityVerified: true },
    { id: 'u_owner1', email: 'owner1@example.com', role: 'owner', name: 'Owner 1', isBanned: false, identityVerified: true },
    { id: 'u_owner2', email: 'owner2@example.com', role: 'owner', name: 'Owner 2', isBanned: true, identityVerified: false }
  ];

  const profiles = {
    u_staff: {
      userId: 'u_staff',
      roleKey: 'support_lead',
      permissions: ['manage_orders', 'view_stores', 'manage_stores', 'manage_users_security'],
      isActive: true
    }
  };

  let reauthChecked = 0;

  const srv = await startServer((app) => {
    const requireAdmin = (req, res, next) => {
      const actorId = req.headers['x-actor'];
      const actor = users.find((u) => u.id === actorId);
      if (!actor) return res.status(401).json({ error: 'Unauthorized' });
      req.adminUser = actor;
      req.adminProfile = profiles[actor.id] || null;
      return next();
    };
    const requireRecentReauth = (req, res, next) => {
      reauthChecked += 1;
      if (!req.headers['x-tiwlo-reauth-grant']) {
        return res.status(428).json({ error: 'RECENT_VERIFICATION_REQUIRED' });
      }
      return next();
    };

    const router = createAdminTelemetryRouter({
      requireAdmin,
      requireRecentReauth,
      MasterDB: {
        getUsers: async () => users,
        findUserByIdentifier: async (id) => users.find((u) => u.id === id) || null
      },
      getLiveVisitorAnalytics: async () => ({
        liveVisitorsCount: 0,
        liveVisitors: [],
        livePageBreakdown: [],
        popularPages: [],
        popularProducts: []
      }),
      getUserPaginatedTrail: async (userId) => ({
        items: [{ id: '1', userId, eventKind: 'page_view', pagePath: '/dashboard', createdAt: '2026-11-15T12:00:00Z' }],
        nextCursorId: null,
        hasMore: false,
        securityEvents: [],
        securityEventsCount: 0,
        emailActivity: [],
        emailActivityCount: 0
      }),
      enrichUsersWithRiskIntel: async (list) => ({
        summary: {
          totalUsers: list.length,
          multiAccountRingCount: 1,
          banEvasionCount: 0
        }
      }),
      getStorageAndMemoryHealth: async () => ({
        memory: { rssMb: 40, heapUsedMb: 20, heapTotalMb: 30, externalMb: 2 },
        systemMemory: { freeSystemMb: 4000, totalSystemMb: 8000, usedSystemPct: 50 },
        tables: [],
        diskLogs: { directory: '', files: [], totalBytes: 0 },
        policy: { autoGcEnabled: true },
        lastRunAt: null,
        nextScheduledRunAt: null,
        totalHistoricalPrunedRows: 0
      }),
      saveRetentionPolicy: async (body) => ({ autoGcEnabled: Boolean(body.autoGcEnabled) }),
      runAutomatedLogGarbageCollection: async () => ({
        ranAt: '2026-11-15T12:00:00Z',
        skipped: false,
        deletedCounts: { liveVisitorSessions: 2 },
        totalDeleted: 2,
        diskRotated: [],
        durationMs: 4
      }),
      recordSecurityEvent: async () => {}
    });

    app.use('/api/admin/telemetry', router);
  });

  try {
    // Staff (non-super-admin) sees userMetrics excluding super_admin
    const lvRes = await fetch(`${srv.baseUrl}/api/admin/telemetry/live-visitors`, {
      headers: { 'x-actor': 'u_staff' }
    });
    assert.equal(lvRes.status, 200);
    const lvJson = await lvRes.json();
    assert.equal(lvJson.userMetrics.totalUsers, 3); // excludes u_super!
    assert.equal(lvJson.userMetrics.activeUsers, 2);
    assert.equal(lvJson.userMetrics.bannedUsers, 1);
    assert.equal(lvJson.userMetrics.verifiedUsers, 2);
    assert.equal(lvJson.userMetrics.multiAccountDetectedCount, 1);

    // Non-super-admin CANNOT inspect super_admin trail -> 403
    const blockedTrail = await fetch(`${srv.baseUrl}/api/admin/telemetry/users/u_super/live-trail`, {
      headers: { 'x-actor': 'u_staff' }
    });
    assert.equal(blockedTrail.status, 403);

    // Staff with manage_users_security CAN inspect normal user trail
    const okTrail = await fetch(`${srv.baseUrl}/api/admin/telemetry/users/u_owner1/live-trail`, {
      headers: { 'x-actor': 'u_staff' }
    });
    assert.equal(okTrail.status, 200);
    const trailJson = await okTrail.json();
    assert.equal(trailJson.items.length, 1);

    // Staff without manage_system_settings or manage_servers gets 403 on storage-health
    const deniedHealth = await fetch(`${srv.baseUrl}/api/admin/telemetry/storage-health`, {
      headers: { 'x-actor': 'u_staff' }
    });
    assert.equal(deniedHealth.status, 403);

    // Super admin can access storage-health
    const okHealth = await fetch(`${srv.baseUrl}/api/admin/telemetry/storage-health`, {
      headers: { 'x-actor': 'u_super' }
    });
    assert.equal(okHealth.status, 200);

    // PUT retention-policy requires reauth grant
    const noGrant = await fetch(`${srv.baseUrl}/api/admin/telemetry/retention-policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-actor': 'u_super' },
      body: JSON.stringify({ autoGcEnabled: true })
    });
    assert.equal(noGrant.status, 428);

    const withGrant = await fetch(`${srv.baseUrl}/api/admin/telemetry/retention-policy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-actor': 'u_super',
        'x-tiwlo-reauth-grant': 'grant-123'
      },
      body: JSON.stringify({ autoGcEnabled: true })
    });
    assert.equal(withGrant.status, 200);

    const runGcRes = await fetch(`${srv.baseUrl}/api/admin/telemetry/run-gc`, {
      method: 'POST',
      headers: {
        'x-actor': 'u_super',
        'x-tiwlo-reauth-grant': 'grant-123'
      }
    });
    assert.equal(runGcRes.status, 200);
    const runGcJson = await runGcRes.json();
    assert.equal(runGcJson.report.totalDeleted, 2);
    assert.ok(reauthChecked >= 2);
  } finally {
    await srv.close();
  }
});
