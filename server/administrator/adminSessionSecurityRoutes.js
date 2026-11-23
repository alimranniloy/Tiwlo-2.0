import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import { queryPg } from '../db/postgres.js';
import { logActivity } from '../db/storeDataAdapter.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import {
  extractSessionClientMetadata,
  getCandidateSessionTokens,
  listEnrichedUserSessions,
  revokeUserSessionByHash
} from '../security/sessionMetadata.js';
import { clearAllSessionTouchCache } from '../security/sessionTouchCache.js';
import {
  getAdminSessionPolicy,
  saveAdminSessionPolicy
} from '../security/adminSessionPolicy.js';

export function createAdminSessionSecurityRouter(deps = {}) {
  const router = express.Router();
  const requireAdmin = deps.requireAdmin || ((_req, _res, next) => next());
  const requireRecentReauth = deps.requireRecentReauth || ((_req, _res, next) => next());
  const getMasterDb = typeof deps.getMasterDb === 'function'
    ? deps.getMasterDb
    : () => deps.masterDb || MasterDB;
  const d = {
    queryPg: deps.queryPg || queryPg,
    getMasterDb,
    logActivity: deps.logActivity || logActivity,
    recordSecurityEvent: deps.recordSecurityEvent || recordSecurityEvent
  };

  const safeRecordEvent = async (event) => {
    try {
      await d.recordSecurityEvent(event);
    } catch {
      // Audit logging failure should not block admin session management
    }
  };

  // GET /api/admin/sessions - Active sessions signed in with the Admin's own account + security policy
  router.get('/sessions', requireAdmin, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const adminUser = req.adminUser;
      const candidateTokens = [
        ...(req.adminSessionToken ? [req.adminSessionToken] : []),
        ...getCandidateSessionTokens(req)
      ];
      const [sessionData, policy] = await Promise.all([
        listEnrichedUserSessions(d.queryPg, adminUser.id, candidateTokens),
        getAdminSessionPolicy({ queryPg: d.queryPg })
      ]);

      return res.json({
        success: true,
        account: {
          id: adminUser.id,
          email: adminUser.email || '',
          name: adminUser.name || adminUser.storeName || 'Administrator',
          role: adminUser.role || 'admin'
        },
        ...sessionData,
        policy
      });
    } catch (error) {
      console.error('[Admin Sessions] Failed to list admin active sessions:', error.message);
      return res.status(500).json({ error: 'Failed to load active admin sessions.' });
    }
  });

  // DELETE /api/admin/sessions - Immediately revoke all OTHER active sessions for this admin account
  router.delete('/sessions', requireAdmin, async (req, res) => {
    try {
      const adminUser = req.adminUser;
      const candidateTokens = [
        ...(req.adminSessionToken ? [req.adminSessionToken] : []),
        ...getCandidateSessionTokens(req)
      ];
      const currentToken = candidateTokens[0] || null;
      if (!currentToken) {
        return res.status(401).json({ error: 'Current admin session token could not be verified.' });
      }

      const beforeData = await listEnrichedUserSessions(d.queryPg, adminUser.id, candidateTokens);
      const otherCount = beforeData.sessions.filter((s) => !s.isCurrent).length;

      await d.getMasterDb().revokeUserSessions(adminUser.id, currentToken);
      clearAllSessionTouchCache(candidateTokens);

      const meta = extractSessionClientMetadata(req);
      await safeRecordEvent({
        eventType: 'admin.sessions_revoked_others',
        severity: 'warning',
        userId: adminUser.id,
        subject: adminUser.email || adminUser.id,
        ip: meta.ip || undefined,
        userAgent: req.headers?.['user-agent'],
        details: { revokedOtherCount: otherCount }
      });

      try {
        await d.logActivity(
          'security',
          'Admin Revoked All Other Sessions',
          `${adminUser.email || adminUser.id} signed out ${otherCount} other active session(s)`
        );
      } catch {
        // Non-fatal
      }

      const afterData = await listEnrichedUserSessions(d.queryPg, adminUser.id, candidateTokens);
      return res.json({
        success: true,
        revokedCount: otherCount,
        ...afterData,
        message: otherCount > 0
          ? `Immediately revoked ${otherCount} other active session(s).`
          : 'No other active sessions needed revocation.'
      });
    } catch (error) {
      console.error('[Admin Sessions] Failed to revoke other admin sessions:', error.message);
      return res.status(500).json({ error: 'Failed to revoke other admin sessions.' });
    }
  });

  // DELETE /api/admin/sessions/:sessionId - Immediately revoke one active session for this admin account
  router.delete('/sessions/:sessionId', requireAdmin, async (req, res) => {
    try {
      const adminUser = req.adminUser;
      const sessionId = String(req.params.sessionId || '').trim();
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required.' });
      }

      const candidateTokens = [
        ...(req.adminSessionToken ? [req.adminSessionToken] : []),
        ...getCandidateSessionTokens(req)
      ];
      const beforeData = await listEnrichedUserSessions(d.queryPg, adminUser.id, candidateTokens);
      const targetSession = beforeData.sessions.find((s) => s.id === sessionId);

      const removed = await revokeUserSessionByHash(d.queryPg, adminUser.id, sessionId);
      if (!removed) {
        return res.status(404).json({ error: 'Session not found.' });
      }

      const meta = extractSessionClientMetadata(req);
      await safeRecordEvent({
        eventType: 'admin.session_revoked',
        severity: 'warning',
        userId: adminUser.id,
        subject: adminUser.email || adminUser.id,
        ip: meta.ip || undefined,
        userAgent: req.headers?.['user-agent'],
        details: {
          revokedSessionId: sessionId,
          revokedDevice: targetSession?.device || null,
          revokedIp: targetSession?.ip || null,
          revokedCurrent: Boolean(targetSession?.isCurrent)
        }
      });

      try {
        await d.logActivity(
          'security',
          'Admin Session Revoked',
          `${adminUser.email || adminUser.id} revoked session ${sessionId} (${targetSession?.device || 'device'})`
        );
      } catch {
        // Non-fatal
      }

      const afterData = await listEnrichedUserSessions(d.queryPg, adminUser.id, candidateTokens);
      return res.json({
        success: true,
        revokedCurrent: Boolean(targetSession?.isCurrent),
        ...afterData,
        message: 'Session revoked immediately.'
      });
    } catch (error) {
      console.error('[Admin Sessions] Failed to revoke admin session:', error.message);
      return res.status(500).json({ error: 'Failed to revoke session.' });
    }
  });

  // GET /api/admin/session-security-policy
  router.get('/session-security-policy', requireAdmin, async (_req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const policy = await getAdminSessionPolicy({ queryPg: d.queryPg, bypassCache: true });
      return res.json({ success: true, policy });
    } catch (error) {
      console.error('[Admin Sessions] Failed to load session security policy:', error.message);
      return res.status(500).json({ error: 'Failed to load session security policy.' });
    }
  });

  // PUT /api/admin/session-security-policy
  router.put('/session-security-policy', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const adminUser = req.adminUser;
      const incoming = req.body?.policy && typeof req.body.policy === 'object'
        ? req.body.policy
        : (req.body || {});
      const policy = await saveAdminSessionPolicy({ queryPg: d.queryPg, policy: incoming });

      const meta = extractSessionClientMetadata(req);
      await safeRecordEvent({
        eventType: 'admin.session_security_policy_updated',
        severity: 'warning',
        userId: adminUser.id,
        subject: adminUser.email || adminUser.id,
        ip: meta.ip || undefined,
        userAgent: req.headers?.['user-agent'],
        details: { policy }
      });

      try {
        await d.logActivity(
          'security',
          'Admin Session Security Policy Updated',
          `${adminUser.email || adminUser.id} updated strict session security toggles`
        );
      } catch {
        // Non-fatal
      }

      return res.json({
        success: true,
        policy,
        message: 'Admin session security policy saved.'
      });
    } catch (error) {
      console.error('[Admin Sessions] Failed to save session security policy:', error.message);
      return res.status(500).json({ error: 'Failed to save session security policy.' });
    }
  });

  return router;
}
