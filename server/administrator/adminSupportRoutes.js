import express from 'express';
import { isPgActive as defaultIsPgActive, queryPg as defaultQueryPg } from '../db/postgres.js';
import {
  defaultTicketingService,
  isSuperAdminUserRecord,
  resolveSupportPermissions,
  SupportServiceError
} from '../support/ticketingService.js';
import {
  getDefaultLiveChatQueueService,
  LiveChatQueueError
} from '../support/liveChatQueueService.js';

function defaultNoopMiddleware(_req, _res, next) {
  return next();
}

function handleAdminSupportError(res, err, fallbackMessage = 'Admin support operation failed.') {
  if (
    err instanceof SupportServiceError ||
    err instanceof LiveChatQueueError ||
    (err && Number.isInteger(err.statusCode))
  ) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {})
    });
  }
  console.error('[AdminSupportRoutes Error]', err);
  return res.status(500).json({ success: false, error: fallbackMessage });
}

export function createAdminSupportRouter({
  requireAdmin = defaultNoopMiddleware,
  requireRecentReauth: _requireRecentReauth = defaultNoopMiddleware,
  deps = {}
} = {}) {
  const router = express.Router();
  const ticketing = new Proxy({}, {
    get(_target, prop) {
      const svc = deps.ticketingService || defaultTicketingService;
      const val = svc[prop];
      return typeof val === 'function' ? val.bind(svc) : val;
    }
  });
  const liveChatQueue = new Proxy({}, {
    get(_target, prop) {
      const svc = deps.liveChatQueueService || getDefaultLiveChatQueueService();
      const val = svc[prop];
      return typeof val === 'function' ? val.bind(svc) : val;
    }
  });
  const queryPgFn = (...args) => (deps.queryPg || defaultQueryPg)(...args);
  const isPgActiveFn = () => (deps.isPgActive || defaultIsPgActive)();

  async function loadRawSupportPermissions(req) {
    if (req._rawSupportPerms !== undefined) return req._rawSupportPerms;
    const user = req.adminUser;
    if (!user || isSuperAdminUserRecord(user)) {
      req._rawSupportPerms = null;
      return null;
    }
    const existing = [
      ...(Array.isArray(req.adminProfile?.permissions) ? req.adminProfile.permissions : []),
      ...(Array.isArray(user.permissions) ? user.permissions : [])
    ];
    if (existing.some((p) => String(p).startsWith('support.'))) {
      req._rawSupportPerms = existing;
      return existing;
    }
    if (typeof deps.getStaffPermissions === 'function') {
      const custom = await deps.getStaffPermissions(user.id);
      req._rawSupportPerms = Array.isArray(custom) ? custom : null;
      return req._rawSupportPerms;
    }
    if (isPgActiveFn()) {
      try {
        const { rows } = await queryPgFn(
          `SELECT permissions, is_active FROM system_admin_staff_profiles WHERE user_id = $1 LIMIT 1`,
          [String(user.id)]
        );
        if (rows?.[0]) {
          if (rows[0].is_active === false && !req.adminProfile) {
            req.adminProfile = { isActive: false };
          }
          const parsed = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
          req._rawSupportPerms = parsed;
          return parsed;
        }
      } catch {
        // Ignore if table unavailable
      }
    }
    req._rawSupportPerms = null;
    return null;
  }

  function requireSupportPermission(...permKeys) {
    return async (req, res, next) => {
      if (!req.adminUser) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Admin credentials required.' });
      }
      if (isSuperAdminUserRecord(req.adminUser)) return next();

      const rawPermissions = await loadRawSupportPermissions(req);
      const resolved = resolveSupportPermissions(req.adminUser, req.adminProfile, { rawPermissions });
      const allowed = permKeys.some((k) => resolved.permissions.has(k));
      if (!allowed) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_PERMISSION_DENIED',
          error: `Forbidden. Missing required permission: ${permKeys.join(' or ')}`,
          requiredPermissions: permKeys
        });
      }
      req.supportPermissions = resolved;
      return next();
    };
  }

  async function buildEffectiveAdminContext(req) {
    const rawPermissions = await loadRawSupportPermissions(req);
    if (!rawPermissions || !rawPermissions.some((p) => String(p).startsWith('support.'))) {
      return { adminUser: req.adminUser, adminProfile: req.adminProfile || null };
    }
    return {
      adminUser: req.adminUser,
      adminProfile: {
        ...(req.adminProfile || {}),
        supportPermissions: rawPermissions
      }
    };
  }

  // Overview KPIs
  router.get('/support/overview', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const overview = await ticketing.getSupportOverview(ctx);
      res.json({ success: true, overview });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load support overview');
    }
  });

  // Real assignable support staff list (super_admin masked from non-super-admins)
  router.get('/support/agents', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const requesterIsSuperAdmin = isSuperAdminUserRecord(req.adminUser);
      const agents = await ticketing.listAssignableSupportStaff(requesterIsSuperAdmin);
      res.json({ success: true, agents });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load support agents');
    }
  });

  // Admin Support System Manual Feature Toggles
  router.get('/support/toggles', requireAdmin, requireSupportPermission('support.manage_settings'), async (_req, res) => {
    try {
      const toggles = await ticketing.getSupportToggles();
      res.json({ success: true, toggles });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to fetch support toggles');
    }
  });

  router.put('/support/toggles', requireAdmin, requireSupportPermission('support.manage_settings'), async (req, res) => {
    try {
      const toggles = await ticketing.updateSupportToggles(req.body || {}, req.adminUser);
      res.json({ success: true, toggles });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to update support toggles');
    }
  });

  // Tickets queue & search (?q= supports ticketId, serialNumber, id, email, phone, subject)
  router.get('/support/tickets', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const result = await ticketing.listAdminTickets({
        q: req.query?.q || '',
        status: req.query?.status || '',
        priority: req.query?.priority || '',
        category: req.query?.category || '',
        department: req.query?.department || '',
        assignedAgentId: req.query?.assignedAgentId || '',
        requesterType: req.query?.requesterType || '',
        slaBreached: req.query?.slaBreached ?? null,
        page: req.query?.page || 1,
        limit: req.query?.limit || 25,
        ...ctx
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to list support tickets');
    }
  });

  // CSV export
  router.get('/support/export.csv', requireAdmin, requireSupportPermission('support.export', 'support.view'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const resolved = req.supportPermissions || resolveSupportPermissions(req.adminUser, ctx.adminProfile);
      if (resolved.hasExplicitSupportPerms && !resolved.permissions.has('support.export')) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_PERMISSION_DENIED',
          error: 'Forbidden. Missing required permission: support.export'
        });
      }
      const csv = await ticketing.exportTicketsCsv({
        q: req.query?.q || '',
        status: req.query?.status || '',
        priority: req.query?.priority || '',
        category: req.query?.category || '',
        department: req.query?.department || '',
        assignedAgentId: req.query?.assignedAgentId || ''
      }, ctx);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tiwlo-support-tickets.csv"');
      res.send(csv);
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to export CSV');
    }
  });

  // Ticket detail
  router.get('/support/tickets/:id', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const detail = await ticketing.getTicketDetail(req.params.id, {
        viewerType: 'admin',
        ...ctx
      });
      res.json({ success: true, ...detail });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load ticket detail');
    }
  });

  // Collision viewer heartbeat
  router.post('/support/tickets/:id/view', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      // Verify ticket visibility first
      await ticketing.getTicketDetail(req.params.id, { viewerType: 'admin', ...ctx });
      const result = await ticketing.recordTicketViewerHeartbeat(req.params.id, req.adminUser);
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to record viewer heartbeat');
    }
  });

  // Update ticket metadata / status / priority / tags / watchers / snooze
  router.patch('/support/tickets/:id', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const ticket = await ticketing.updateTicket({
        ticketIdOrKey: req.params.id,
        updates: req.body || {},
        actorType: 'admin',
        ...ctx
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to update ticket');
    }
  });

  // Assign / reassign ticket
  router.post('/support/tickets/:id/assign', requireAdmin, requireSupportPermission('support.assign'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const assignedAgentId = req.body?.assignedAgentId ?? req.body?.agentId ?? null;
      const requireAcceptance = Boolean(req.body?.requireAcceptance);
      const ticket = await ticketing.assignTicket({
        ticketIdOrKey: req.params.id,
        assignedAgentId,
        requireAcceptance,
        ...ctx
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to assign ticket');
    }
  });

  // Staff public reply or internal note
  router.post('/support/tickets/:id/replies', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const result = await ticketing.addTicketReply({
        ticketIdOrKey: req.params.id,
        message: req.body?.message ?? req.body?.text,
        isInternal: Boolean(req.body?.isInternal),
        attachments: req.body?.attachments || [],
        actorType: 'admin',
        ...ctx
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to post reply');
    }
  });

  // Edit reply (immutable editHistory)
  router.patch('/support/tickets/:id/replies/:replyId', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const result = await ticketing.editTicketReply({
        ticketIdOrKey: req.params.id,
        replyId: req.params.replyId,
        message: req.body?.message ?? req.body?.text,
        actorType: 'admin',
        ...ctx
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to edit reply');
    }
  });

  // Merge ticket into targetTicketId (or sourceTicketId into :id)
  router.post('/support/tickets/:id/merge', requireAdmin, requireSupportPermission('support.merge', 'support.assign'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const { targetTicketId, sourceTicketId } = req.body || {};
      const resolvedSource = sourceTicketId || req.params.id;
      const resolvedTarget = sourceTicketId ? req.params.id : targetTicketId;
      const result = await ticketing.mergeTickets({
        sourceTicketIdOrKey: resolvedSource,
        targetTicketIdOrKey: resolvedTarget,
        ...ctx
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to merge tickets');
    }
  });

  // Create sub-ticket
  router.post('/support/tickets/:id/subticket', requireAdmin, requireSupportPermission('support.assign', 'support.reply'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const subTicket = await ticketing.createSubTicket({
        parentTicketIdOrKey: req.params.id,
        ...(req.body || {}),
        ...ctx
      });
      res.status(201).json({ success: true, subTicket });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to create sub-ticket');
    }
  });

  // Link guest ticket to registered user
  router.post('/support/tickets/:id/link-user', requireAdmin, requireSupportPermission('support.assign'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const ticket = await ticketing.linkTicketToUser({
        ticketIdOrKey: req.params.id,
        userId: req.body?.userId || null,
        userEmail: req.body?.userEmail || null,
        ...ctx
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to link ticket to user');
    }
  });

  // Bulk ticket updates
  router.post('/support/tickets/bulk', requireAdmin, requireSupportPermission('support.reply', 'support.assign'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const body = req.body || {};
      const resolved = req.supportPermissions || resolveSupportPermissions(req.adminUser, ctx.adminProfile);
      if (body.assignedAgentId !== undefined && !resolved.isSuperAdmin && !resolved.permissions.has('support.assign')) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_PERMISSION_DENIED',
          error: 'Forbidden. Missing required permission: support.assign'
        });
      }
      if ((body.status !== undefined || body.priority !== undefined || body.tags !== undefined) &&
          !resolved.isSuperAdmin && !resolved.permissions.has('support.reply')) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_PERMISSION_DENIED',
          error: 'Forbidden. Missing required permission: support.reply'
        });
      }
      const result = await ticketing.bulkUpdateTickets({
        ticketIds: body.ticketIds,
        status: body.status,
        priority: body.priority,
        assignedAgentId: body.assignedAgentId,
        tags: body.tags,
        ...ctx
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to execute bulk action');
    }
  });

  // Macros CRUD
  router.get('/support/macros', requireAdmin, requireSupportPermission('support.view'), async (_req, res) => {
    try {
      const macros = await ticketing.listMacros();
      res.json({ success: true, macros });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to list macros');
    }
  });

  router.post('/support/macros', requireAdmin, requireSupportPermission('support.macros', 'support.manage_settings'), async (req, res) => {
    try {
      const macro = await ticketing.createMacro({
        ...(req.body || {}),
        createdBy: req.adminUser?.id || null
      });
      res.status(201).json({ success: true, macro });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to create macro');
    }
  });

  router.patch('/support/macros/:id', requireAdmin, requireSupportPermission('support.macros', 'support.manage_settings'), async (req, res) => {
    try {
      const macro = await ticketing.updateMacro(req.params.id, req.body || {});
      res.json({ success: true, macro });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to update macro');
    }
  });

  router.delete('/support/macros/:id', requireAdmin, requireSupportPermission('support.macros', 'support.manage_settings'), async (req, res) => {
    try {
      const result = await ticketing.deleteMacro(req.params.id);
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to delete macro');
    }
  });

  // Accept Specialist Assignment Request (locks exclusive reply permission)
  router.post('/support/tickets/:id/accept-assignment', requireAdmin, requireSupportPermission('support.reply', 'support.view'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const ticket = await ticketing.acceptTicketAssignment({ ticketIdOrKey: req.params.id, ...ctx });
      await ticketing.recordStaffPermissionAudit({
        staffActor: req.adminUser,
        permissionKey: 'support.accept_assignment',
        action: 'accepted_specialist_ticket_assignment',
        targetType: 'ticket',
        targetId: req.params.id,
        req
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to accept assignment request');
    }
  });

  // Read-only Customer Context for Ticket / Live Chat (Billing ID, Orders, Invoices, Services, Multi-Account Risk, Activity)
  async function loadEnrichedCustomerContext(targetUserId, ticketIdOrKey, req) {
    const ctx = await buildEffectiveAdminContext(req);
    const base = await ticketing.getTicketCustomerContext({
      ticketIdOrKey,
      userId: targetUserId,
      ...ctx,
      req
    });
    const uid = base?.user?.id || targetUserId;
    if (!uid || !isPgActiveFn()) {
      return {
        ...base,
        billingId: base?.user?.tiwiId || uid || null,
        activeSessions: [],
        permissionOverrides: [],
        communicationHistory: []
      };
    }

    const safeQuery = async (sql, params) => {
      try {
        const r = await queryPgFn(sql, params);
        return r?.rows || [];
      } catch {
        return [];
      }
    };

    const [sessionRows, overrideRows, commRows, paymentRows] = await Promise.all([
      safeQuery(`SELECT id, ip, user_agent, created_at, expires_at, revoked_at FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15`, [String(uid)]),
      safeQuery(`SELECT permissions, is_active, role_key, updated_at FROM system_admin_staff_profiles WHERE user_id = $1 LIMIT 1`, [String(uid)]),
      safeQuery(`SELECT id, type, subject, status, created_at FROM email_deliveries WHERE LOWER(recipient_email) = LOWER($1) ORDER BY created_at DESC LIMIT 20`, [String(base?.user?.email || '')]),
      safeQuery(`SELECT id, payment_method, provider, amount, currency, status, created_at FROM billing_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25`, [String(uid)])
    ]);

    return {
      ...base,
      billingId: base?.user?.billingId || base?.user?.tiwiId || `BIL-${String(uid).slice(0, 8).toUpperCase()}`,
      activeSessions: sessionRows.filter((s) => !s.revoked_at),
      permissionOverrides: overrideRows[0]?.permissions || [],
      communicationHistory: commRows,
      payments: paymentRows
    };
  }

  router.get('/support/tickets/:id/customer-context', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const context = await loadEnrichedCustomerContext(null, req.params.id, req);
      res.json({ success: true, context });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load ticket customer context');
    }
  });

  router.get('/support/users/:userId/context', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const context = await loadEnrichedCustomerContext(req.params.userId, null, req);
      res.json({ success: true, context });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load user context');
    }
  });

  // Immutable Staff Permission & Security Audit Logs (ONLY Super Admin / Security Audit, NO delete endpoint)
  router.get('/support/staff-audit-logs', requireAdmin, async (req, res) => {
    try {
      const isSuper = isSuperAdminUserRecord(req.adminUser);
      const perms = Array.isArray(req.adminUser?.permissions) ? req.adminUser.permissions : [];
      if (!isSuper && !perms.includes('view_audit_logs') && !perms.includes('manage_users_security')) {
        return res.status(403).json({
          success: false,
          code: 'LOG_ADMIN_ONLY',
          error: 'Only Log Admins or Super Admin may inspect immutable staff audit logs.'
        });
      }
      const logs = await ticketing.listStaffPermissionAudits({
        staffId: req.query.staffId || '',
        limit: req.query.limit || 50
      });
      res.json({ success: true, logs });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load staff audit logs');
    }
  });

  // Immediate Session Termination Control (Super Admin / Security Admin ONLY)
  router.post('/support/security/terminate-sessions', requireAdmin, async (req, res) => {
    try {
      const isSuper = isSuperAdminUserRecord(req.adminUser);
      const perms = Array.isArray(req.adminUser?.permissions) ? req.adminUser.permissions : [];
      if (!isSuper && !perms.includes('manage_users_security') && !perms.includes('ban_users')) {
        return res.status(403).json({
          success: false,
          code: 'ADMIN_PERMISSION_DENIED',
          error: 'Only Security Admin or Super Admin can terminate user/staff sessions.'
        });
      }
      const result = await ticketing.revokeActorSessions({
        targetUserId: req.body?.userId || req.body?.targetUserId,
        reason: req.body?.reason || 'Immediate security termination',
        adminUser: req.adminUser,
        req
      });
      res.json(result);
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to terminate sessions');
    }
  });

  // Live Chat Queue, Isolation, Staff Performance Catalogs, Templates, AI Assist & Forensics
  router.get('/support/live-chats', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      await liveChatQueue.heartbeatAgentPresence(req.adminUser, { isOnline: true, req });
      const result = await liveChatQueue.listAdminLiveChats({
        status: req.query.status || '',
        q: req.query.q || '',
        staffActor: req.adminUser
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load live chat queue');
    }
  });

  router.post('/support/live-chats/presence', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const result = await liveChatQueue.heartbeatAgentPresence(req.adminUser, {
        isOnline: req.body?.isOnline !== false,
        req
      });
      res.json({ success: true, presence: result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to update agent presence');
    }
  });

  router.get('/support/live-chats/staff-metrics', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const result = await liveChatQueue.getStaffPerformanceMetrics({
        category: req.query.category || 'all'
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load staff performance metrics');
    }
  });

  router.get('/support/live-chats/forensic-logs', requireAdmin, async (req, res) => {
    try {
      const isSuper = isSuperAdminUserRecord(req.adminUser);
      const perms = Array.isArray(req.adminUser?.permissions) ? req.adminUser.permissions : [];
      if (!isSuper && !perms.includes('view_audit_logs') && !perms.includes('manage_users_security')) {
        return res.status(403).json({
          success: false,
          code: 'LOG_ADMIN_ONLY',
          error: 'Only Log Admins or Super Admin may access anti-fraud forensic trails.'
        });
      }
      const logs = await liveChatQueue.listForensicAuditLogs({
        limit: req.query.limit || 50,
        severity: req.query.severity || '',
        staffId: req.query.staffId || ''
      });
      res.json({ success: true, logs });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load forensic audit logs');
    }
  });

  router.get('/support/live-chats/templates', requireAdmin, requireSupportPermission('support.view'), async (_req, res) => {
    try {
      const templates = await liveChatQueue.listTemplates();
      res.json({ success: true, templates });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load live chat templates');
    }
  });

  router.post('/support/live-chats/templates', requireAdmin, requireSupportPermission('support.reply', 'support.macros'), async (req, res) => {
    try {
      const template = await liveChatQueue.createTemplate({
        ...(req.body || {}),
        createdBy: req.adminUser?.id || null
      });
      res.status(201).json({ success: true, template });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to create live chat template');
    }
  });

  router.delete('/support/live-chats/templates/:templateId', requireAdmin, requireSupportPermission('support.macros', 'support.manage_settings'), async (req, res) => {
    try {
      const result = await liveChatQueue.deleteTemplate(req.params.templateId);
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to delete live chat template');
    }
  });

  router.get('/support/live-chats/:id', requireAdmin, requireSupportPermission('support.view'), async (req, res) => {
    try {
      const detail = await liveChatQueue.getAdminLiveChatDetail(req.params.id, req.adminUser);
      res.json({ success: true, ...detail });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load live chat detail');
    }
  });

  router.post('/support/live-chats/:id/accept', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const result = await liveChatQueue.acceptLiveChatRequest(req.params.id, req.adminUser, { req });
      await ticketing.recordStaffPermissionAudit({
        staffActor: req.adminUser,
        permissionKey: 'support.live_chat_accept',
        action: 'accepted_live_chat',
        targetType: 'live_chat',
        targetId: result.chat?.chatNumber || req.params.id,
        req
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to accept live chat request');
    }
  });

  router.post('/support/live-chats/:id/reply', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const result = await liveChatQueue.sendStaffLiveChatReply(req.params.id, {
        body: req.body?.message || req.body?.body,
        staffActor: req.adminUser,
        req
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to send live chat reply');
    }
  });

  router.post('/support/live-chats/:id/hold', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const chat = await liveChatQueue.holdLiveChatSession(req.params.id, {
        staffActor: req.adminUser,
        reason: req.body?.reason || ''
      });
      res.json({ success: true, chat });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to place live chat on hold');
    }
  });

  router.post('/support/live-chats/:id/end', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const chat = await liveChatQueue.endLiveChatSession(req.params.id, {
        actor: req.adminUser,
        actorType: 'staff',
        req
      });
      res.json({ success: true, chat });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to end live chat');
    }
  });

  router.post('/support/live-chats/:id/ai-assist', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const result = await liveChatQueue.generateAiAssistForLiveChat(req.params.id, {
        mode: req.body?.mode || 'suggest_reply',
        draft: req.body?.draft || '',
        staffActor: req.adminUser
      });
      res.json(result);
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to generate AI live chat assist');
    }
  });

  router.post('/support/live-chats/:id/convert-to-ticket', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const detail = await liveChatQueue.getAdminLiveChatDetail(req.params.id, req.adminUser);
      const chat = detail.chat;
      const transcript = (detail.messages || []).map((m) => `[${m.senderName}]: ${m.body}`).join('\n');
      const authUser = chat.userId ? { id: chat.userId, name: chat.guestName, email: chat.guestEmail } : null;
      const created = await ticketing.createTicket({
        authUser,
        guestName: chat.guestName,
        guestEmail: chat.guestEmail,
        guestPhone: chat.guestPhone,
        channel: 'live_chat_handoff',
        subject: req.body?.subject || `Follow-up from Live Chat ${chat.chatNumber}: ${chat.topic}`,
        description: transcript || chat.topic,
        department: chat.department || 'General Support',
        priority: req.body?.priority || 'medium',
        assignedAgent: { id: req.adminUser?.id, name: req.adminUser?.name },
        metadata: { sourceChatId: chat.id, sourceChatNumber: chat.chatNumber }
      });
      const updatedChat = await liveChatQueue.linkConvertedTicket(chat.id, {
        ticketId: created.ticket.id,
        ticketNumber: created.ticket.serialNumber
      });
      res.status(201).json({ success: true, ticket: created.ticket, chat: updatedChat });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to convert live chat into ticket');
    }
  });

  // Co-Browsing Agent Guidance (requires visitor consent enabled)
  router.post('/support/live-chats/:chatId/co-browse-guide', requireAdmin, requireSupportPermission('support.reply'), async (req, res) => {
    try {
      const ctx = await buildEffectiveAdminContext(req);
      const result = await liveChatQueue.updateCoBrowsingState(req.params.chatId, {
        actorType: 'staff',
        staffActor: ctx.adminUser,
        highlightSelector: req.body?.highlightSelector,
        agentGuidanceNote: req.body?.agentGuidanceNote
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to push co-browsing guidance');
    }
  });

  // CSAT Survey Summary
  router.get('/support/analytics/csat', requireAdmin, requireSupportPermission('support.analytics', 'support.view'), async (_req, res) => {
    try {
      const csat = await liveChatQueue.getCsatAnalytics();
      res.json({ success: true, ...csat });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load CSAT analytics');
    }
  });

  // Real-time Platform Compliance, Resource Quota, Payment Method (bKash/Card/Nagad/etc), Orders & Store Analytics
  router.get('/support/analytics/platform-ops-summary', requireAdmin, async (req, res) => {
    try {
      const timeframe = ['7d', '30d', '12m'].includes(req.query.timeframe) ? req.query.timeframe : '30d';
      const days = timeframe === '7d' ? 7 : timeframe === '12m' ? 365 : 30;
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(5, Number.parseInt(req.query.limit, 10) || 25));

      const [integrity, staffAudits, toggles, csat] = await Promise.all([
        liveChatQueue.getAdminIntegritySummary(),
        ticketing.listStaffPermissionAudits({ limit: 40 }),
        ticketing.getSupportToggles(),
        liveChatQueue.getCsatAnalytics()
      ]);

      let paymentBreakdown = [];
      let orderStats = { total: 0, active: 0, cancelled: 0, expired: 0, completed: 0 };
      let ordersList = [];
      let storesBreakdown = [];
      let quotaMetrics = { totalUsers: 0, totalStores: 0, pgActive: isPgActiveFn(), memoryHeapMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)) };

      if (isPgActiveFn()) {
        const safeQ = async (sql, params = []) => {
          try {
            const r = await queryPgFn(sql, params);
            return r?.rows || [];
          } catch {
            return [];
          }
        };

        const [payRows, orderCountRows, orderRows, storeRows, userCntRows] = await Promise.all([
          safeQ(
            `SELECT COALESCE(LOWER(payment_method), LOWER(provider), 'unknown') AS method,
                    COUNT(*)::int AS tx_count,
                    COUNT(DISTINCT user_id)::int AS unique_users,
                    COALESCE(SUM(amount), 0)::numeric AS total_amount
             FROM billing_transactions
             WHERE created_at >= NOW() - ($1 || ' days')::interval
             GROUP BY 1
             ORDER BY tx_count DESC`,
            [String(days)]
          ),
          safeQ(
            `SELECT
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE LOWER(status) IN ('active', 'paid', 'processing'))::int AS active,
               COUNT(*) FILTER (WHERE LOWER(status) IN ('cancelled', 'canceled', 'refunded'))::int AS cancelled,
               COUNT(*) FILTER (WHERE LOWER(status) = 'expired' OR (expires_at IS NOT NULL AND expires_at < NOW() AND LOWER(status) NOT IN ('cancelled','canceled')))::int AS expired,
               COUNT(*) FILTER (WHERE LOWER(status) IN ('completed', 'fulfilled', 'delivered'))::int AS completed
             FROM orders
             WHERE created_at >= NOW() - ($1 || ' days')::interval`,
            [String(days)]
          ),
          safeQ(
            `SELECT o.id, o.order_number, o.user_id, o.total, o.currency, o.status, o.payment_method, o.expires_at, o.created_at,
                    u.name AS customer_name, u.email AS customer_email, u.tiwi_id AS billing_id
             FROM orders o
             LEFT JOIN system_users u ON u.id = o.user_id
             ORDER BY o.created_at DESC
             LIMIT $1 OFFSET $2`,
            [limit, (page - 1) * limit]
          ),
          safeQ(
            `SELECT s.id, s.name, s.slug, s.status, s.plan, s.custom_domain, s.created_at,
                    u.id AS owner_id, u.name AS creator_name, u.email AS creator_email, u.tiwi_id AS billing_id
             FROM stores s
             LEFT JOIN system_users u ON u.id = COALESCE(s.owner_id, s.user_id)
             ORDER BY s.created_at DESC
             LIMIT 100`
          ),
          safeQ(`SELECT COUNT(*)::int AS total_users FROM system_users`)
        ]);

        paymentBreakdown = payRows.map((p) => ({
          method: p.method || 'unknown',
          transactionsCount: Number(p.tx_count || 0),
          uniqueUsersCount: Number(p.unique_users || 0),
          totalAmount: Number(p.total_amount || 0)
        }));
        if (orderCountRows[0]) {
          orderStats = {
            total: Number(orderCountRows[0].total || 0),
            active: Number(orderCountRows[0].active || 0),
            cancelled: Number(orderCountRows[0].cancelled || 0),
            expired: Number(orderCountRows[0].expired || 0),
            completed: Number(orderCountRows[0].completed || 0)
          };
        }
        ordersList = orderRows;
        storesBreakdown = storeRows;
        quotaMetrics.totalUsers = Number(userCntRows[0]?.total_users || 0);
        quotaMetrics.totalStores = storeRows.length;
      }

      res.json({
        success: true,
        timeframe,
        pagination: { page, limit },
        integrity,
        csat,
        staffAudits,
        toggles,
        paymentBreakdown,
        orderStats,
        orders: ordersList,
        stores: storesBreakdown,
        quotaMetrics
      });
    } catch (err) {
      handleAdminSupportError(res, err, 'Failed to load platform operations summary');
    }
  });

  return router;
}

export default createAdminSupportRouter;
