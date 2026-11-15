import express from 'express';
import {
  getLiveVisitorAnalytics as defaultGetLiveVisitorAnalytics,
  getUserPaginatedTrail as defaultGetUserPaginatedTrail
} from '../analytics/liveVisitorService.js';
import {
  getStorageAndMemoryHealth as defaultGetStorageAndMemoryHealth,
  runAutomatedLogGarbageCollection as defaultRunAutomatedLogGarbageCollection,
  saveRetentionPolicy as defaultSaveRetentionPolicy
} from '../db/logRotationService.js';
import { MasterDB as defaultMasterDB } from '../db/multiTenant.js';
import { recordSecurityEvent as defaultRecordSecurityEvent } from '../db/securityPersistence.js';
import { requireRecentReauth as defaultRequireRecentReauth } from '../security/recentReauth.js';
import {
  enrichUsersWithRiskIntel as defaultEnrichUsersWithRiskIntel,
  isSuperAdminAccount
} from './identityRiskGraph.js';
import {
  getStaffSecurityProfile as defaultGetStaffSecurityProfile,
  hasAdminPermission as defaultHasAdminPermission,
  isSuperAdminUser
} from './staffSecurityService.js';

function createFallbackRequireAdmin(MasterDB) {
  return function fallbackRequireAdmin(req, res, next) {
    const token = req.cookies?.tiwlo_host_session ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null) ||
      req.headers?.['x-session-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }

    MasterDB.getSession(token, req).then((sessionData) => {
      if (!sessionData || !sessionData.user) {
        return res.status(401).json({ error: 'Session expired or invalid.' });
      }
      const user = sessionData.user;
      if (user.isBanned || (!isSuperAdminUser(user) && !isSuperAdminAccount(user) && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
      }
      req.adminUser = user;
      return next();
    }).catch((err) => {
      console.error('[Admin Telemetry Auth Error]', err?.message || err);
      return res.status(500).json({ error: 'Authentication check failed.' });
    });
  };
}

function isProtectedSuperAdmin(user) {
  return Boolean(user && (isSuperAdminUser(user) || isSuperAdminAccount(user)));
}

function createPermissionMiddleware(allowedPermissions = [], deps = {}) {
  const getProfile = deps.getStaffSecurityProfile || defaultGetStaffSecurityProfile;
  const checkPerm = deps.hasAdminPermission || defaultHasAdminPermission;

  return async (req, res, next) => {
    const actor = req.adminUser;
    if (!actor) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }
    if (isProtectedSuperAdmin(actor)) {
      return next();
    }
    try {
      let profile = req.adminProfile;
      if (profile === undefined && actor.id) {
        profile = await getProfile(actor.id).catch(() => null);
      }
      const allowed = allowedPermissions.some((perm) => checkPerm(actor, profile, perm));
      if (!allowed) {
        return res.status(403).json({
          error: 'You do not have permission to perform this action.',
          code: 'ADMIN_PERMISSION_DENIED',
          requiredPermissions: allowedPermissions
        });
      }
      return next();
    } catch (err) {
      console.error('[Admin Telemetry Permission Error]', err?.message || err);
      return res.status(500).json({ error: 'Permission check failed.' });
    }
  };
}

function handleError(res, err, fallbackMessage) {
  if (err instanceof TypeError || err?.statusCode === 400) {
    return res.status(400).json({ error: err.message || fallbackMessage });
  }
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
    ? err.statusCode
    : 500;
  if (status >= 500) {
    console.error('[Admin Telemetry Error]', err?.message || err);
  }
  return res.status(status).json({
    error: status >= 500 ? fallbackMessage : (err?.message || fallbackMessage)
  });
}

export function createAdminTelemetryRouter(deps = {}) {
  const MasterDB = deps.MasterDB || new Proxy({}, {
    get(_t, prop) {
      const val = defaultMasterDB[prop];
      return typeof val === 'function' ? val.bind(defaultMasterDB) : val;
    }
  });
  const requireAdmin = deps.requireAdmin || createFallbackRequireAdmin(MasterDB);
  const requireRecentReauth = deps.requireRecentReauth || defaultRequireRecentReauth;
  const getLiveVisitorAnalytics = deps.getLiveVisitorAnalytics || defaultGetLiveVisitorAnalytics;
  const getUserPaginatedTrail = deps.getUserPaginatedTrail || defaultGetUserPaginatedTrail;
  const getStorageAndMemoryHealth = deps.getStorageAndMemoryHealth || defaultGetStorageAndMemoryHealth;
  const saveRetentionPolicy = deps.saveRetentionPolicy || defaultSaveRetentionPolicy;
  const runAutomatedLogGarbageCollection =
    deps.runAutomatedLogGarbageCollection || defaultRunAutomatedLogGarbageCollection;
  const enrichUsersWithRiskIntel = deps.enrichUsersWithRiskIntel || defaultEnrichUsersWithRiskIntel;
  const recordSecurityEvent = deps.recordSecurityEvent || defaultRecordSecurityEvent;

  const router = express.Router();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // GET /api/admin/telemetry/live-visitors
  router.get('/live-visitors', requireAdmin, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isProtectedSuperAdmin(req.adminUser);
      const windowSeconds = req.query?.windowSeconds;
      const days = req.query?.days;
      const limit = req.query?.limit;

      const [analytics, rawUsers] = await Promise.all([
        getLiveVisitorAnalytics({ windowSeconds, days, limit }, { viewerIsSuperAdmin }),
        MasterDB.getUsers().catch(() => [])
      ]);

      const allUsers = Array.isArray(rawUsers) ? rawUsers : [];
      const visibleUsers = viewerIsSuperAdmin
        ? allUsers
        : allUsers.filter((u) => !isProtectedSuperAdmin(u));

      let riskSummary = null;
      if (visibleUsers.length > 0) {
        const sanitizedForRisk = visibleUsers.map((u) => ({
          id: u.id,
          tiwiId: u.tiwiId || u.storeId || '',
          name: u.name || u.storeName || 'System User',
          email: u.email,
          phone: u.phone || '',
          role: u.role || 'owner',
          isBanned: Boolean(u.isBanned),
          identityVerified: u.identityVerified === true,
          createdAt: u.createdAt || null
        }));
        const riskResult = await enrichUsersWithRiskIntel(sanitizedForRisk, { viewerIsSuperAdmin }).catch(() => null);
        riskSummary = riskResult?.summary || null;
      }

      const totalUsers = visibleUsers.length;
      const bannedUsers = visibleUsers.filter((u) => Boolean(u.isBanned)).length;
      const activeUsers = visibleUsers.filter((u) => !u.isBanned).length;
      const verifiedUsers = visibleUsers.filter((u) => u.identityVerified === true).length;
      const multiAccountDetectedCount = Number(riskSummary?.multiAccountRingCount || 0);
      const banEvasionCount = Number(riskSummary?.banEvasionCount || 0);

      return res.json({
        success: true,
        ...analytics,
        userMetrics: {
          totalUsers,
          activeUsers,
          bannedUsers,
          multiAccountDetectedCount,
          banEvasionCount,
          verifiedUsers
        }
      });
    } catch (err) {
      return handleError(res, err, 'Failed to load live visitor telemetry.');
    }
  });

  // GET /api/admin/telemetry/users/:id/live-trail
  router.get(
    '/users/:id/live-trail',
    requireAdmin,
    createPermissionMiddleware(['manage_users_security'], deps),
    async (req, res) => {
      try {
        const viewerIsSuperAdmin = isProtectedSuperAdmin(req.adminUser);
        const targetUser = await MasterDB.findUserByIdentifier(req.params.id);
        if (!targetUser) {
          return res.status(404).json({ error: 'User not found.' });
        }
        if (isProtectedSuperAdmin(targetUser) && !viewerIsSuperAdmin) {
          return res.status(403).json({
            error: 'Forbidden. Super Admin accounts are isolated and cannot be inspected.'
          });
        }

        const trail = await getUserPaginatedTrail(
          targetUser.id,
          {
            cursorId: req.query?.cursor || null,
            limit: req.query?.limit || 30
          },
          { userEmail: targetUser.email }
        );

        return res.json({
          success: true,
          user: {
            id: targetUser.id,
            tiwiId: targetUser.tiwiId || targetUser.storeId || '',
            name: targetUser.name || targetUser.storeName || 'System User',
            email: targetUser.email,
            role: targetUser.role || 'owner',
            isBanned: Boolean(targetUser.isBanned)
          },
          ...trail
        });
      } catch (err) {
        return handleError(res, err, 'Failed to load user activity trail.');
      }
    }
  );

  // GET /api/admin/telemetry/storage-health
  router.get(
    '/storage-health',
    requireAdmin,
    createPermissionMiddleware(['manage_system_settings', 'manage_servers'], deps),
    async (_req, res) => {
      try {
        const health = await getStorageAndMemoryHealth();
        return res.json({
          success: true,
          ...health
        });
      } catch (err) {
        return handleError(res, err, 'Failed to inspect storage and memory health.');
      }
    }
  );

  // PUT /api/admin/telemetry/retention-policy
  router.put(
    '/retention-policy',
    requireAdmin,
    requireRecentReauth,
    createPermissionMiddleware(['manage_system_settings'], deps),
    async (req, res) => {
      try {
        const policy = await saveRetentionPolicy(req.body || {});
        await recordSecurityEvent({
          eventType: 'admin.log_retention_policy_updated',
          severity: 'info',
          userId: req.adminUser?.id || null,
          subject: req.adminUser?.email || null,
          ip: req.ip || null,
          userAgent: req.get?.('user-agent') || null,
          details: policy
        }).catch(() => {});

        return res.json({
          success: true,
          policy,
          message: 'Automated log retention policy updated.'
        });
      } catch (err) {
        return handleError(res, err, 'Failed to update log retention policy.');
      }
    }
  );

  // POST /api/admin/telemetry/run-gc
  router.post(
    '/run-gc',
    requireAdmin,
    requireRecentReauth,
    createPermissionMiddleware(['manage_system_settings'], deps),
    async (req, res) => {
      try {
        const report = await runAutomatedLogGarbageCollection({ force: true });
        await recordSecurityEvent({
          eventType: 'admin.log_gc_manual_run',
          severity: 'info',
          userId: req.adminUser?.id || null,
          subject: req.adminUser?.email || null,
          ip: req.ip || null,
          userAgent: req.get?.('user-agent') || null,
          details: {
            totalDeleted: report.totalDeleted,
            durationMs: report.durationMs,
            diskRotatedCount: report.diskRotated?.length || 0
          }
        }).catch(() => {});

        return res.json({
          success: true,
          report
        });
      } catch (err) {
        return handleError(res, err, 'Failed to run log compaction and garbage collection.');
      }
    }
  );

  return router;
}

export default createAdminTelemetryRouter;
