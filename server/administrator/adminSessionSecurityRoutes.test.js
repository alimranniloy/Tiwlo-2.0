import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAdminSessionSecurityRouter } from './adminSessionSecurityRoutes.js';
import {
  DEFAULT_ADMIN_SESSION_POLICY,
  evaluateAdminSessionPolicy,
  invalidateAdminSessionPolicyCache,
  normalizeAdminSessionPolicy
} from '../security/adminSessionPolicy.js';
import {
  getCandidateSessionTokens,
  revokeUserSessionByHash
} from '../security/sessionMetadata.js';
import { createUserAccountRouter } from '../routes/userAccountRoutes.js';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createSessionHarness() {
  invalidateAdminSessionPolicyCache();

  const users = new Map([
    [
      'adm_1',
      {
        id: 'adm_1',
        tiwiId: 'tiwlo_adm',
        email: 'admin@tiwlo.com',
        name: 'Platform Admin',
        role: 'super_admin',
        emailVerified: true,
        twoFactorEnabled: true
      }
    ]
  ]);

  const now = Date.now();
  const futureIso = new Date(now + 86400_000).toISOString();
  const sessionStore = new Map([
    [
      'web-admin-token',
      {
        user_id: 'adm_1',
        token: sha256('web-admin-token'),
        session_token: sha256('web-admin-token'),
        ip: '127.0.0.1',
        user_agent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
        device_name: 'iPhone · Safari on iOS 17.0',
        app_name: 'Tiwlo Web',
        created_at: new Date(now - 60_000).toISOString(),
        last_active_at: new Date(now - 5_000).toISOString(),
        expires_at: futureIso
      }
    ],
    [
      'mobile-admin-bearer',
      {
        user_id: 'adm_1',
        token: sha256('mobile-admin-bearer'),
        session_token: sha256('mobile-admin-bearer'),
        ip: '103.145.12.88',
        user_agent: 'PICK/1.0.2 (Android 14; Samsung SM-S918B) Mobile',
        device_name: 'Samsung SM-S918B',
        app_name: 'PICK App',
        created_at: new Date(now - 120_000).toISOString(),
        last_active_at: new Date(now - 15_000).toISOString(),
        expires_at: futureIso
      }
    ],
    [
      'desktop-admin-token',
      {
        user_id: 'adm_1',
        token: sha256('desktop-admin-token'),
        session_token: sha256('desktop-admin-token'),
        ip: '203.0.113.25',
        user_agent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
        device_name: 'Chrome on Windows 10/11',
        app_name: 'Tiwlo Web',
        created_at: new Date(now - 300_000).toISOString(),
        last_active_at: new Date(now - 30_000).toISOString(),
        expires_at: futureIso
      }
    ]
  ]);

  let storedPolicy = null;
  const securityEvents = [];
  const activities = [];

  const queryPg = async (sql, params = []) => {
    const q = String(sql).trim();
    if (/SELECT COALESCE\(NULLIF\(session_token/i.test(q)) {
      const uid = String(params[0]);
      const rows = Array.from(sessionStore.values())
        .filter((r) => String(r.user_id) === uid)
        .map((r) => ({ ...r, token_ref: r.session_token || r.token }));
      return { rows };
    }
    if (/SELECT token, session_token\s+FROM system_sessions/i.test(q)) {
      const uid = String(params[0]);
      return {
        rows: Array.from(sessionStore.values()).filter((r) => String(r.user_id) === uid)
      };
    }
    if (/DELETE FROM system_sessions/i.test(q)) {
      const uid = String(params[0]);
      const targets = new Set(params.slice(1).map(String));
      let removed = 0;
      for (const [rawKey, row] of sessionStore.entries()) {
        if (
          String(row.user_id) === uid &&
          (targets.has(row.token) || targets.has(row.session_token))
        ) {
          sessionStore.delete(rawKey);
          removed++;
        }
      }
      return { rowCount: removed };
    }
    if (/FROM system_user_login_locations/i.test(q)) {
      return { rows: [] };
    }
    if (/SELECT settings FROM system_settings/i.test(q)) {
      return { rows: storedPolicy ? [{ settings: storedPolicy }] : [] };
    }
    if (/INSERT INTO system_settings/i.test(q)) {
      storedPolicy = JSON.parse(params[1]);
      return { rows: [{ settings: storedPolicy }] };
    }
    return { rows: [] };
  };

  const masterDb = {
    async getSession(token) {
      if (!token) return null;
      const hash = sha256(token);
      for (const row of sessionStore.values()) {
        if (row.token === hash || row.session_token === hash) {
          return {
            session: { sessionToken: token, userId: row.user_id, expiresAt: row.expires_at },
            user: users.get(row.user_id)
          };
        }
      }
      return null;
    },
    async revokeUserSessions(userId, exceptToken = null) {
      const keepHash = exceptToken ? sha256(exceptToken) : '';
      for (const [rawKey, row] of sessionStore.entries()) {
        if (String(row.user_id) !== String(userId)) continue;
        if (keepHash && (row.token === keepHash || row.session_token === keepHash)) continue;
        sessionStore.delete(rawKey);
      }
    },
    async findUserByIdentifier(id) {
      return users.get(String(id)) || null;
    }
  };

  // Deliberately does NOT check User-Agent on token validation (simulating fixed Rust + JS session check)
  const requireAdmin = async (req, res, next) => {
    const candidates = getCandidateSessionTokens(req);
    for (const candidate of candidates) {
      const resolved = await masterDb.getSession(candidate, req);
      if (resolved?.user) {
        req.adminUser = resolved.user;
        req.adminSessionToken = candidate;
        return next();
      }
    }
    return res.status(401).json({ error: 'Authentication required' });
  };

  const requireRecentReauth = (req, res, next) => {
    if (!req.headers['x-tiwlo-reauth-grant']) {
      return res.status(428).json({ error: 'Re-authentication required', code: 'REAUTH_REQUIRED' });
    }
    return next();
  };

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    '/api/admin',
    createAdminSessionSecurityRouter({
      requireAdmin,
      requireRecentReauth,
      queryPg,
      getMasterDb: () => masterDb,
      logActivity: async (...args) => activities.push(args),
      recordSecurityEvent: async (evt) => securityEvents.push(evt)
    })
  );
  app.use(
    '/api',
    createUserAccountRouter({
      masterDb,
      queryPg,
      readState: async (_ns, _k, fallback) => fallback,
      saveState: async () => {},
      logActivity: async (...args) => activities.push(args),
      recordSecurityEvent: async (evt) => securityEvents.push(evt),
      appendUserActivity: async () => {}
    })
  );

  return { app, sessionStore, queryPg, securityEvents };
}

async function startServer(t, app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((r) => server.close(r)));
  const addr = server.address();
  return `http://127.0.0.1:${addr.port}`;
}

test('Admin session remains valid across mobile Desktop-Mode UA toggle and stale-cookie fallback', async (t) => {
  const { app } = createSessionHarness();
  const baseUrl = await startServer(t, app);

  // 1. Mobile UA request passes
  const mobileRes = await fetch(`${baseUrl}/api/admin/sessions`, {
    headers: {
      Authorization: 'Bearer web-admin-token',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1'
    }
  });
  assert.equal(mobileRes.status, 200);
  const mobileJson = await mobileRes.json();
  assert.equal(mobileJson.summary.total, 3);
  assert.equal(mobileJson.account.email, 'admin@tiwlo.com');

  // 2. Toggle to "Desktop Site" User-Agent using the exact same session token -> must still be 200!
  const desktopModeRes = await fetch(`${baseUrl}/api/admin/sessions`, {
    headers: {
      Authorization: 'Bearer web-admin-token',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36'
    }
  });
  assert.equal(desktopModeRes.status, 200);
  const desktopJson = await desktopModeRes.json();
  const current = desktopJson.sessions.find((s) => s.isCurrent);
  assert.ok(current);

  // 3. Stale revoked cookie present alongside a valid Bearer token -> falls back cleanly to Bearer token!
  const staleCookieRes = await fetch(`${baseUrl}/api/admin/sessions`, {
    headers: {
      Cookie: 'tiwlo_host_session=revoked-old-cookie',
      Authorization: 'Bearer mobile-admin-bearer'
    }
  });
  assert.equal(staleCookieRes.status, 200);
});

test('Multi-platform session revocation via DELETE /api/admin/sessions/:id & /api/user/account/sessions immediately enforces 401', async (t) => {
  const { app, securityEvents } = createSessionHarness();
  const baseUrl = await startServer(t, app);

  // List sessions as web-admin-token
  const listRes = await fetch(`${baseUrl}/api/admin/sessions`, {
    headers: { Authorization: 'Bearer web-admin-token' }
  });
  const listBody = await listRes.json();
  const mobileSession = listBody.sessions.find((s) => s.appName === 'PICK App');
  const desktopSession = listBody.sessions.find((s) => s.ip === '203.0.113.25');
  assert.ok(mobileSession);
  assert.ok(desktopSession);

  // Confirm mobile Bearer token currently works on both admin and user account endpoints
  const mobBefore = await fetch(`${baseUrl}/api/user/account/sessions`, {
    headers: { Authorization: 'Bearer mobile-admin-bearer' }
  });
  assert.equal(mobBefore.status, 200);

  // Revoke mobile session from Admin System Settings endpoint
  const revOneRes = await fetch(`${baseUrl}/api/admin/sessions/${encodeURIComponent(mobileSession.id)}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer web-admin-token' }
  });
  assert.equal(revOneRes.status, 200);
  const revOneBody = await revOneRes.json();
  assert.equal(revOneBody.sessions.length, 2);

  // Immediately verify mobile Bearer token now gets 401 on the VERY NEXT request (admin + user routes)
  const mobAfterAdmin = await fetch(`${baseUrl}/api/admin/sessions`, {
    headers: { Authorization: 'Bearer mobile-admin-bearer' }
  });
  assert.equal(mobAfterAdmin.status, 401);

  const mobAfterUser = await fetch(`${baseUrl}/api/user/account/sessions`, {
    headers: { Authorization: 'Bearer mobile-admin-bearer' }
  });
  assert.equal(mobAfterUser.status, 401);

  // Revoke All Other Sessions via /api/user/account/sessions
  const revAllRes = await fetch(`${baseUrl}/api/user/account/sessions`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer web-admin-token' }
  });
  assert.equal(revAllRes.status, 200);
  const revAllBody = await revAllRes.json();
  assert.equal(revAllBody.sessions.length, 1);
  assert.equal(revAllBody.sessions[0].isCurrent, true);

  // Desktop browser cookie session now immediately returns 401
  const desktopAfter = await fetch(`${baseUrl}/api/admin/sessions`, {
    headers: { Cookie: 'tiwlo_host_session=desktop-admin-token' }
  });
  assert.equal(desktopAfter.status, 401);

  assert.ok(securityEvents.some((e) => e.eventType === 'admin.session_revoked'));
});

test('Admin strict session security policy requires reauth to save and enforces idle timeout, max age, and IP binding', async (t) => {
  const { app } = createSessionHarness();
  const baseUrl = await startServer(t, app);

  // Unauthenticated blocked with 401
  const noAuthRes = await fetch(`${baseUrl}/api/admin/session-security-policy`);
  assert.equal(noAuthRes.status, 401);

  // Saving policy without reauth grant returns 428
  const noGrantRes = await fetch(`${baseUrl}/api/admin/session-security-policy`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer web-admin-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      enforceIdleTimeout: true,
      idleTimeoutMinutes: 15,
      strictIpBinding: true,
      singleActiveSessionOnly: true
    })
  });
  assert.equal(noGrantRes.status, 428);

  // Saving policy with reauth grant succeeds and normalizes bounds
  const saveRes = await fetch(`${baseUrl}/api/admin/session-security-policy`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer web-admin-token',
      'x-tiwlo-reauth-grant': 'reauth-ok',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      enforceIdleTimeout: true,
      idleTimeoutMinutes: 2, // below min 5 -> clamped to 5
      enforceMaxSessionAge: true,
      maxSessionAgeHours: 24,
      strictIpBinding: true,
      singleActiveSessionOnly: true
    })
  });
  assert.equal(saveRes.status, 200);
  const saveBody = await saveRes.json();
  assert.equal(saveBody.policy.idleTimeoutMinutes, 5);
  assert.equal(saveBody.policy.strictIpBinding, true);
  assert.equal(saveBody.policy.singleActiveSessionOnly, true);

  // Verify evaluator enforces timeouts & strict IP binding
  const baseNow = Date.now();
  const activeEval = evaluateAdminSessionPolicy({
    policy: saveBody.policy,
    sessionRow: {
      ip: '127.0.0.1',
      created_at: new Date(baseNow - 60_000).toISOString(),
      last_active_at: new Date(baseNow - 10_000).toISOString()
    },
    requestIp: '::ffff:127.0.0.1',
    nowMs: baseNow
  });
  assert.equal(activeEval.allowed, true);

  const idleFail = evaluateAdminSessionPolicy({
    policy: saveBody.policy,
    sessionRow: {
      ip: '127.0.0.1',
      created_at: new Date(baseNow - 3600_000).toISOString(),
      last_active_at: new Date(baseNow - 6 * 60_000).toISOString()
    },
    requestIp: '127.0.0.1',
    nowMs: baseNow
  });
  assert.equal(idleFail.allowed, false);
  assert.equal(idleFail.code, 'ADMIN_SESSION_IDLE_TIMEOUT');

  const ipFail = evaluateAdminSessionPolicy({
    policy: saveBody.policy,
    sessionRow: {
      ip: '127.0.0.1',
      created_at: new Date(baseNow - 60_000).toISOString(),
      last_active_at: new Date(baseNow - 5_000).toISOString()
    },
    requestIp: '198.51.100.44',
    nowMs: baseNow
  });
  assert.equal(ipFail.allowed, false);
  assert.equal(ipFail.code, 'ADMIN_SESSION_IP_MISMATCH');

  const defaults = normalizeAdminSessionPolicy(DEFAULT_ADMIN_SESSION_POLICY);
  assert.equal(defaults.enforceIdleTimeout, false);
  assert.equal(defaults.strictIpBinding, false);
});
