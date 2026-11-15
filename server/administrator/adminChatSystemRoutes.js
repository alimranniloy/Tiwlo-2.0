import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import { isPgActive } from '../db/postgres.js';
import { recordSecurityEvent as defaultRecordSecurityEvent } from '../db/securityPersistence.js';
import { requireRecentReauth as defaultRequireRecentReauth } from '../security/recentReauth.js';
import { isSuperAdminAccount } from './identityRiskGraph.js';
import { hasAdminPermission, isSuperAdminUser } from './staffSecurityService.js';
import {
  addAiKey,
  addAiKeys,
  deleteAiKey,
  ensureAiKeyPoolSchema,
  getChatSystemOverview,
  resetAiKeyQuota,
  testGeminiKeyById,
  updateAiKey,
  updateChatSystemSettings
} from '../support/ai/aiKeyPoolService.js';

const ALLOWED_MANAGE_PERMISSIONS = [
  'support.manage_ai',
  'settings.manage',
  'manage_system_settings'
];

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
      console.error('[Admin Chat System Auth Error]', err.message);
      return res.status(500).json({ error: 'Authentication check failed.' });
    });
  };
}

function hasChatSystemManagePermission(req) {
  const user = req.adminUser;
  if (!user || user.isBanned) return false;
  if (isSuperAdminUser(user) || isSuperAdminAccount(user) || user.role === 'super_admin') {
    return true;
  }

  const profile = req.adminProfile || req.staffProfile || null;
  if (profile && (profile.isActive === false || profile.is_active === false)) {
    return false;
  }

  const explicitProfilePerms = Array.isArray(profile?.permissions) && profile.permissions.length > 0
    ? profile.permissions
    : null;
  if (explicitProfilePerms) {
    return explicitProfilePerms.some((perm) => ALLOWED_MANAGE_PERMISSIONS.includes(perm));
  }

  if (Array.isArray(user.permissions)) {
    return user.permissions.some((perm) => ALLOWED_MANAGE_PERMISSIONS.includes(perm));
  }

  return ALLOWED_MANAGE_PERMISSIONS.some((perm) => hasAdminPermission(user, profile, perm));
}

function requireChatSystemPermission(req, res, next) {
  if (!req.adminUser) {
    return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
  }
  if (!hasChatSystemManagePermission(req)) {
    return res.status(403).json({
      error: 'Forbidden. Missing AI & Chat System management permission.',
      code: 'ADMIN_PERMISSION_DENIED',
      requiredPermissions: ALLOWED_MANAGE_PERMISSIONS
    });
  }
  return next();
}

function handleRouteError(res, err, fallbackMessage) {
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
    ? err.statusCode
    : 500;
  if (status >= 500) {
    console.error('[Admin Chat System Error]', err?.message || err);
  }
  return res.status(status).json({
    error: status >= 500 ? fallbackMessage : (err?.message || fallbackMessage)
  });
}

/**
 * Creates the Express router for Admin Chat System & Gemini AI Key Pool management.
 */
export function createAdminChatSystemRouter({
  requireAdmin = createFallbackRequireAdmin(),
  requireRecentReauth = defaultRequireRecentReauth,
  recordSecurityEvent = null,
  fetchFn = globalThis.fetch
} = {}) {
  const router = express.Router();

  queueMicrotask(() => {
    ensureAiKeyPoolSchema().catch((err) => {
      console.warn('[Admin Chat System Schema Warning]', err?.message || err);
    });
  });

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  async function safeRecordAudit(req, { eventType, severity = 'info', details = {} }) {
    const payload = {
      eventType,
      severity,
      userId: req.adminUser?.id || null,
      subject: req.adminUser?.email || null,
      ip: req.ip,
      userAgent: req.get?.('user-agent') || null,
      details
    };

    if (typeof recordSecurityEvent === 'function') {
      await recordSecurityEvent(payload);
      return;
    }

    if (!isPgActive() || !process.env.SECURITY_SECRET) {
      return;
    }

    try {
      await defaultRecordSecurityEvent(payload);
    } catch (err) {
      console.warn('[Admin Chat System Audit Warning]', err?.message || err);
    }
  }

  async function handleGetChatSystem(_req, res) {
    try {
      const overview = await getChatSystemOverview();
      return res.json({
        success: true,
        ...overview,
        config: overview.settings
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to load chat system configuration and key pool.');
    }
  }

  async function handleUpdateSettings(req, res) {
    try {
      const body = req.body?.settings ?? req.body?.config ?? req.body ?? {};
      const settings = await updateChatSystemSettings(body, req.adminUser?.id || null);

      await safeRecordAudit(req, {
        eventType: 'admin.chat_system_settings_updated',
        details: {
          enabled: settings.enabled,
          autoFailover: settings.autoFailover,
          aiAutoReplyEnabled: settings.aiAutoReplyEnabled,
          aiTriageEnabled: settings.aiTriageEnabled,
          aiAgentAssistEnabled: settings.aiAgentAssistEnabled,
          liveChatWidgetEnabled: settings.liveChatWidgetEnabled,
          guestChatEnabled: settings.guestChatEnabled,
          blockChatOnClosedTicket: settings.blockChatOnClosedTicket,
          preferredModel: settings.preferredModel
        }
      });

      return res.json({
        success: true,
        settings,
        config: settings
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to update chat system settings.');
    }
  }

  // GET /api/admin/chat-system & /api/admin/chat-system/config
  router.get('/chat-system', requireAdmin, handleGetChatSystem);
  router.get('/chat-system/config', requireAdmin, handleGetChatSystem);

  // PUT /api/admin/chat-system/settings & /api/admin/chat-system/config
  router.put(
    '/chat-system/settings',
    requireAdmin,
    requireChatSystemPermission,
    requireRecentReauth,
    handleUpdateSettings
  );
  router.put(
    '/chat-system/config',
    requireAdmin,
    requireChatSystemPermission,
    requireRecentReauth,
    handleUpdateSettings
  );

  // POST /api/admin/chat-system/keys (supports single key object or batch array/{ keys: [...] })
  router.post(
    '/chat-system/keys',
    requireAdmin,
    requireChatSystemPermission,
    requireRecentReauth,
    async (req, res) => {
      try {
        const actorId = req.adminUser?.id || null;
        const batchInput = Array.isArray(req.body)
          ? req.body
          : Array.isArray(req.body?.keys)
            ? req.body.keys
            : null;

        if (batchInput) {
          const keys = await addAiKeys(batchInput, actorId);
          await safeRecordAudit(req, {
            eventType: 'admin.chat_system_keys_added',
            details: {
              count: keys.length,
              keyIds: keys.map((k) => k.id).join(',').slice(0, 400)
            }
          });
          return res.status(201).json({
            success: true,
            key: keys[0] || null,
            keys
          });
        }

        const key = await addAiKey(req.body || {}, actorId);
        await safeRecordAudit(req, {
          eventType: 'admin.chat_system_key_added',
          details: {
            keyId: key.id,
            label: key.label,
            keyPreview: key.keyPreview,
            provider: key.provider
          }
        });
        return res.status(201).json({
          success: true,
          key,
          keys: [key]
        });
      } catch (err) {
        return handleRouteError(res, err, 'Failed to add AI API key.');
      }
    }
  );

  // PATCH /api/admin/chat-system/keys/:id
  router.patch(
    '/chat-system/keys/:id',
    requireAdmin,
    requireChatSystemPermission,
    requireRecentReauth,
    async (req, res) => {
      try {
        const key = await updateAiKey(req.params.id, req.body || {}, req.adminUser?.id || null);
        if (!key) {
          return res.status(404).json({ error: 'AI API key not found.' });
        }

        await safeRecordAudit(req, {
          eventType: 'admin.chat_system_key_updated',
          details: {
            keyId: key.id,
            label: key.label,
            isEnabled: key.isEnabled,
            priority: key.priority,
            keyPreview: key.keyPreview
          }
        });

        return res.json({
          success: true,
          key
        });
      } catch (err) {
        return handleRouteError(res, err, 'Failed to update AI API key.');
      }
    }
  );

  // DELETE /api/admin/chat-system/keys/:id
  router.delete(
    '/chat-system/keys/:id',
    requireAdmin,
    requireChatSystemPermission,
    requireRecentReauth,
    async (req, res) => {
      try {
        const deleted = await deleteAiKey(req.params.id);
        if (!deleted) {
          return res.status(404).json({ error: 'AI API key not found.' });
        }

        await safeRecordAudit(req, {
          eventType: 'admin.chat_system_key_deleted',
          details: { keyId: req.params.id }
        });

        return res.json({
          success: true,
          deleted: true
        });
      } catch (err) {
        return handleRouteError(res, err, 'Failed to delete AI API key.');
      }
    }
  );

  // POST /api/admin/chat-system/keys/:id/test
  router.post(
    '/chat-system/keys/:id/test',
    requireAdmin,
    requireChatSystemPermission,
    async (req, res) => {
      try {
        const result = await testGeminiKeyById(req.params.id, { fetchFn });
        if (!result) {
          return res.status(404).json({ error: 'AI API key not found.' });
        }

        await safeRecordAudit(req, {
          eventType: 'admin.chat_system_key_tested',
          severity: result.ok ? 'info' : 'warning',
          details: {
            keyId: result.id,
            ok: result.ok,
            status: result.status,
            latencyMs: result.latencyMs
          }
        });

        return res.json({
          success: true,
          ...result
        });
      } catch (err) {
        return handleRouteError(res, err, 'Failed to test AI API key.');
      }
    }
  );

  // POST /api/admin/chat-system/keys/:id/reset-quota
  router.post(
    '/chat-system/keys/:id/reset-quota',
    requireAdmin,
    requireChatSystemPermission,
    requireRecentReauth,
    async (req, res) => {
      try {
        const key = await resetAiKeyQuota(req.params.id);
        if (!key) {
          return res.status(404).json({ error: 'AI API key not found.' });
        }

        await safeRecordAudit(req, {
          eventType: 'admin.chat_system_key_quota_reset',
          details: {
            keyId: key.id,
            label: key.label,
            status: key.status
          }
        });

        return res.json({
          success: true,
          key
        });
      } catch (err) {
        return handleRouteError(res, err, 'Failed to reset AI API key quota state.');
      }
    }
  );

  return router;
}

export default createAdminChatSystemRouter;
