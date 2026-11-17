import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import {
  sendAccountDisabledEmail,
  sendAccountRestoredEmail
} from '../db/emailService.js';
import { RestoreSessions } from '../db/restoreSessions.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { requireRecentReauth as defaultRequireRecentReauth } from '../security/recentReauth.js';
import {
  buildUserActivityDossier,
  enrichUsersWithRiskIntel,
  executeClusterBanAction,
  isSuperAdminAccount
} from './identityRiskGraph.js';

function createFallbackRequireAdmin() {
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
      if (user.isBanned || (!isSuperAdminAccount(user) && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
      }
      req.adminUser = user;
      return next();
    }).catch((err) => {
      console.error('[Admin Risk Auth Error]', err);
      return res.status(500).json({ error: 'Authentication check failed.' });
    });
  };
}

export function createAdminRiskRouter({
  requireAdmin = createFallbackRequireAdmin(),
  requireRecentReauth = defaultRequireRecentReauth
} = {}) {
  const router = express.Router();

  // GET /api/admin/users/risk-intel
  router.get('/users/risk-intel', requireAdmin, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const rawUsers = await MasterDB.getUsers();
      const sanitizedUsers = rawUsers.map((u) => ({
        id: u.id,
        tiwiId: u.tiwiId || u.storeId || '',
        name: u.name || u.storeName || 'System User',
        email: u.email,
        phone: u.phone || '',
        role: u.role || 'owner',
        planId: u.planId || 'free',
        planName: u.planName || u.planId || 'Free Starter',
        avatar: u.avatar && !String(u.avatar).includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
        isBanned: Boolean(u.isBanned),
        banReason: u.banReason || '',
        emailVerified: u.emailVerified === true,
        twoFactorEnabled: u.twoFactorEnabled === true,
        identityVerified: u.identityVerified === true,
        identityVerificationRequired: u.identityVerificationRequired === true,
        createdAt: u.createdAt || null
      }));

      const { users: enrichedUsers, summary, riskByUserId } = await enrichUsersWithRiskIntel(
        sanitizedUsers,
        { viewerIsSuperAdmin }
      );

      const flaggedUsers = enrichedUsers
        .filter((u) => viewerIsSuperAdmin || !isSuperAdminAccount(u))
        .filter((u) =>
          (u.riskIntelligence?.riskScore || 0) > 0 ||
          (u.riskIntelligence?.flags?.length || 0) > 0 ||
          u.isBanned
        )
        .sort((a, b) => (b.riskIntelligence?.riskScore || 0) - (a.riskIntelligence?.riskScore || 0));

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        summary,
        flaggedUsers,
        riskByUserId
      });
    } catch (error) {
      console.error('[Admin Risk Intel Error]', error.message);
      return res.status(500).json({ error: 'Failed to compute identity risk intelligence.' });
    }
  });

  // GET /api/admin/users/:id/activity
  router.get('/users/:id/activity', requireAdmin, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const dossier = await buildUserActivityDossier(req.params.id, { viewerIsSuperAdmin });

      if (dossier?.forbidden) {
        return res.status(403).json({ error: dossier.error || 'Forbidden.' });
      }
      if (!dossier) {
        return res.status(404).json({ error: 'User not found in system.' });
      }

      recordSecurityEvent({
        eventType: 'admin.user_activity_dossier_viewed',
        severity: 'info',
        userId: req.adminUser.id,
        ip: req.ip,
        userAgent: req.get?.('user-agent'),
        details: {
          viewedUserId: dossier.user.id,
          riskScore: dossier.riskIntelligence?.riskScore || 0
        }
      }).catch((auditErr) => {
        console.warn('[Admin Risk Dossier] Audit log failed:', auditErr.message);
      });

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        ...dossier
      });
    } catch (error) {
      console.error('[Admin User Activity Error]', error.message);
      return res.status(500).json({ error: 'Failed to load user activity dossier.' });
    }
  });

  // POST /api/admin/users/:id/ban-cluster
  router.post('/users/:id/ban-cluster', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const viewerIsSuperAdmin = isSuperAdminAccount(req.adminUser);
      const { id } = req.params;
      const {
        isBanned = true,
        reason = '',
        banLinkedCluster = false,
        blockDeviceSignals = false
      } = req.body || {};

      if (typeof isBanned !== 'boolean') {
        return res.status(400).json({ error: 'isBanned must be a boolean value.' });
      }

      const existingUser = await MasterDB.findUserByIdentifier(id);
      if (!existingUser) {
        return res.status(404).json({ error: 'User not found in system.' });
      }
      if (isSuperAdminAccount(existingUser)) {
        return res.status(403).json({ error: 'Super Administrator accounts cannot be disabled.' });
      }
      if (existingUser.role === 'admin' && !viewerIsSuperAdmin) {
        return res.status(403).json({ error: 'Only a super administrator can change another administrator account.' });
      }

      const result = await executeClusterBanAction({
        targetUser: existingUser,
        actorEmail: req.adminUser.email,
        actorIp: req.ip,
        isBanned,
        reason,
        banLinkedCluster: Boolean(banLinkedCluster),
        blockDeviceSignals: Boolean(blockDeviceSignals)
      });

      // Dispatch notification emails asynchronously without failing the response
      if (isBanned) {
        for (const affected of result.affectedUsers) {
          if (!affected.email) continue;
          try {
            const restoreSession = RestoreSessions.createRestoreSession({
              email: affected.email,
              userId: affected.id,
              reason: result.reason
            });
            sendAccountDisabledEmail({
              to: affected.email,
              name: affected.name || 'Tiwlo User',
              reason: result.reason,
              restoreUrl: restoreSession.url
            }).catch((err) => console.error('[Cluster Ban Email Error]', err.message));
          } catch (err) {
            console.warn('[Cluster Ban RestoreSession Error]', err.message);
          }
        }
      } else if (existingUser.email) {
        try {
          const checkupSession = RestoreSessions.createSecurityCheckupSession({
            email: existingUser.email,
            userId: existingUser.id
          });
          sendAccountRestoredEmail({
            to: existingUser.email,
            name: existingUser.name || existingUser.storeName || 'Tiwlo User',
            checkupUrl: checkupSession.url
          }).catch((err) => console.error('[Cluster Restore Email Error]', err.message));
        } catch (err) {
          console.warn('[Cluster Restore CheckupSession Error]', err.message);
        }
      }

      const affectedCount = result.affectedUsers.length;
      const message = isBanned
        ? (affectedCount > 1
          ? `Disabled ${affectedCount} accounts in cluster${result.blockedSignalsCount ? ` and blocked ${result.blockedSignalsCount} device/network signals` : ''}.`
          : `User ${existingUser.name || existingUser.email} has been disabled${result.blockedSignalsCount ? ` and ${result.blockedSignalsCount} device/network signals were blocked` : ''}.`)
        : `User ${existingUser.name || existingUser.email} has been restored successfully.`;

      return res.json({
        success: true,
        message,
        user: result.affectedUsers[0] || null,
        ...result
      });
    } catch (error) {
      const status = error.statusCode || 500;
      console.error('[Admin Cluster Ban Error]', error.message);
      return res.status(status).json({ error: status === 500 ? 'Failed to execute cluster ban action.' : error.message });
    }
  });

  return router;
}

export default createAdminRiskRouter();
