import express from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import { getAgentByTier, getOnlineSpecialists, generateTicketSerial } from './agentsPool.js';
import { TiwiAI as defaultTiwiAI } from './tiwiAi.js';
import { SystemBrain as defaultSystemBrain } from './brain.js';
import { processSecurityAppeal as defaultProcessSecurityAppeal } from './verificationAgent.js';
import { RestoreSessions as defaultRestoreSessions } from '../../db/restoreSessions.js';
import { SupportDB as defaultSupportDB } from '../../db/supportDb.js';
import { MasterDB as defaultMasterDB } from '../../db/multiTenant.js';
import { getPublicMediaUrl as defaultGetPublicMediaUrl, storeMedia as defaultStoreMedia } from '../../db/mediaStorage.js';
import { PLATFORM_CONFIG } from '../../config/platformConfig.js';
import { securityLimiters } from '../../plugins/security/index.js';
import { isSuperAdminAccount } from '../../administrator/identityRiskGraph.js';
import {
  defaultTicketingService,
  GUEST_SUPPORT_COOKIE,
  setGuestSupportCookie,
  clearGuestSupportCookie,
  validateGuestContact,
  validateSupportAttachment,
  SAFE_INLINE_IMAGE_MIMES,
  SAFE_SUPPORT_DOWNLOAD_MIMES,
  startsWithActiveMarkupOrScript,
  SupportServiceError
} from '../ticketingService.js';
import {
  getDefaultLiveChatQueueService,
  LiveChatQueueError
} from '../liveChatQueueService.js';

const uploadAttachmentMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    try {
      validateSupportAttachment({
        filename: file?.originalname,
        mimetype: file?.mimetype
      });
      cb(null, true);
    } catch (err) {
      cb(err);
    }
  }
});

export function isSupportStaffUser(user) {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'super_admin' || isSuperAdminAccount(user);
}

export function getAuthenticatedSupportUser(req) {
  const user = req.activeUser || req.user || null;
  if (!user || !user.id || user.id === 'guest' || user.id === 'guest_session') {
    return null;
  }
  return user;
}

export function userMatchesRecord(user, recordUserId) {
  if (!user || !recordUserId || recordUserId === 'guest' || recordUserId === 'guest_session') {
    return false;
  }
  if (user.role === 'admin' || user.role === 'super_admin' || isSuperAdminAccount(user)) return true;
  return recordUserId === user.id || (Boolean(user.tiwiId) && recordUserId === user.tiwiId);
}

function handleRouteError(res, err, fallbackMessage = 'Support request failed.') {
  if (err instanceof SupportServiceError || (err && Number.isInteger(err.statusCode))) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {})
    });
  }
  console.error('[SupportRoutes Error]', err);
  return res.status(500).json({ success: false, error: fallbackMessage });
}

export function createSupportRouter(deps = {}) {
  const router = express.Router();
  const ticketing = deps.ticketingService || defaultTicketingService;
  const SupportDB = deps.SupportDB || defaultSupportDB;
  const MasterDB = deps.MasterDB || defaultMasterDB;
  const TiwiAI = deps.TiwiAI || defaultTiwiAI;
  const SystemBrain = deps.SystemBrain || defaultSystemBrain;
  const RestoreSessions = deps.RestoreSessions || defaultRestoreSessions;
  const processSecurityAppeal = deps.processSecurityAppeal || defaultProcessSecurityAppeal;
  const storeMediaFn = deps.storeMedia || defaultStoreMedia;
  const getPublicMediaUrlFn = deps.getPublicMediaUrl || defaultGetPublicMediaUrl;

  async function resolveSupportRequester(req, res, { allowInlineGuestContact = false } = {}) {
    const authUser = getAuthenticatedSupportUser(req);
    if (authUser) {
      return { authUser, guestSession: null };
    }
    const existingGuest = await ticketing.resolveGuestSessionFromRequest(req);
    if (existingGuest) {
      return { authUser: null, guestSession: existingGuest };
    }
    if (!allowInlineGuestContact) {
      throw new SupportServiceError('Authentication or verified guest support session required.', {
        statusCode: 401,
        code: 'GUEST_CONTACT_REQUIRED'
      });
    }
    const body = req.body || {};
    const toggles = await ticketing.getSupportToggles();
    if (!toggles.guestTicketingEnabled) {
      throw new SupportServiceError('Guest ticketing is currently disabled. Please sign in.', {
        statusCode: 403,
        code: 'GUEST_TICKETING_DISABLED'
      });
    }
    const created = await ticketing.createOrUpdateGuestSession({
      guestName: body.guestName ?? body.name ?? body.visitorName ?? body.userName,
      guestEmail: body.guestEmail ?? body.email ?? body.visitorEmail,
      guestPhone: body.guestPhone ?? body.phone ?? body.visitorPhone,
      req
    });
    setGuestSupportCookie(res, created.rawToken, req);
    return { authUser: null, guestSession: created.session };
  }

  // 0. Public Support Configuration Toggles
  router.get('/config', async (req, res) => {
    try {
      const config = await ticketing.getPublicSupportConfig();
      const authUser = getAuthenticatedSupportUser(req);
      const acctStatus = String(authUser?.status || '').trim().toLowerCase();
      const riskScore = Number(authUser?.riskScore ?? authUser?.fraudScore ?? 0);
      const liveChatBlocked = Boolean(
        authUser &&
        (authUser.isBanned === true ||
          ['banned', 'disabled', 'suspended'].includes(acctStatus) ||
          (Number.isFinite(riskScore) && riskScore >= 80))
      );
      res.json({
        success: true,
        config: {
          ...config,
          liveChatBlocked,
          liveChatBlockReason: liveChatBlocked
            ? 'Live chat is disabled for restricted or high-risk accounts. Please submit a Support Appeal Ticket.'
            : null,
          liveChatWidgetEnabled: liveChatBlocked ? false : Boolean(config.liveChatWidgetEnabled)
        }
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to fetch support config');
    }
  });

  // 0b. Guest Support Session Endpoints
  router.get('/guest/session', async (req, res) => {
    try {
      const guestSession = await ticketing.resolveGuestSessionFromRequest(req);
      res.json({
        success: true,
        authenticated: Boolean(guestSession),
        guestSession: guestSession || null
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to inspect guest session');
    }
  });

  router.post('/guest/session', async (req, res) => {
    try {
      const toggles = await ticketing.getSupportToggles();
      if (!toggles.guestTicketingEnabled) {
        return res.status(403).json({
          success: false,
          code: 'GUEST_TICKETING_DISABLED',
          error: 'Guest support sessions are currently disabled.'
        });
      }
      const body = req.body || {};
      const guestName = body.guestName ?? body.name ?? body.fullName ?? body.visitorName ?? body.userName;
      const guestEmail = body.guestEmail ?? body.email ?? body.visitorEmail;
      const guestPhone = body.guestPhone ?? body.phone ?? body.visitorPhone;
      const existingGuest = await ticketing.resolveGuestSessionFromRequest(req);
      const requestedEmail = String(guestEmail || '').trim().toLowerCase();
      if (
        existingGuest &&
        requestedEmail &&
        String(existingGuest.visitorEmail || '').trim().toLowerCase() === requestedEmail
      ) {
        validateGuestContact({ guestName, guestEmail, guestPhone });
        const existingRawToken =
          req?.cookies?.[GUEST_SUPPORT_COOKIE] ||
          req?.headers?.['x-guest-support-token'] ||
          null;
        if (existingRawToken) {
          setGuestSupportCookie(res, existingRawToken, req);
        }
        return res.status(200).json({ success: true, guestSession: existingGuest, reused: true });
      }
      const { session, rawToken } = await ticketing.createOrUpdateGuestSession({
        guestName,
        guestEmail,
        guestPhone,
        req
      });
      setGuestSupportCookie(res, rawToken, req);
      res.status(201).json({ success: true, guestSession: session });
    } catch (err) {
      handleRouteError(res, err, 'Failed to create guest session');
    }
  });

  router.post('/guest/lookup', async (req, res) => {
    try {
      const { ticketNumber, guestEmail, guestPhone, recoveryCode } = req.body || {};
      const result = await ticketing.lookupGuestTicket({
        ticketNumber,
        guestEmail,
        guestPhone,
        recoveryCode,
        req
      });
      setGuestSupportCookie(res, result.rawToken, req);
      const { rawToken: _omit, ...safeResult } = result;
      res.json({ success: true, ...safeResult });
    } catch (err) {
      handleRouteError(res, err, 'Failed to verify guest ticket lookup');
    }
  });

  router.post('/guest/claim', async (req, res) => {
    try {
      const authUser = getAuthenticatedSupportUser(req);
      if (!authUser) {
        return res.status(401).json({ success: false, error: 'Authentication required to claim guest tickets.' });
      }
      const result = await ticketing.claimGuestSessionsForUser({
        userId: authUser.id,
        userEmail: authUser.email || '',
        userName: authUser.name || authUser.storeName || '',
        req
      });
      clearGuestSupportCookie(res, req);
      res.json({ success: true, ...result });
    } catch (err) {
      handleRouteError(res, err, 'Failed to claim guest sessions');
    }
  });

  // 1. Get online specialists count (512 online) and sample avatars
  router.get('/online-agents', (_req, res) => {
    try {
      const data = getOnlineSpecialists(4);
      res.json({
        onlineCount: 512,
        agents: data.sampleAgents
      });
    } catch {
      res.status(500).json({ error: 'Failed to fetch online specialists' });
    }
  });

  // 2. Tickets API: GET tickets strictly filtered by verified user or guest session (+ ?q= search)
  router.get('/tickets', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const tickets = await ticketing.listTicketsForRequester({
        authUser,
        guestSession,
        q: req.query?.q || '',
        status: req.query?.status || '',
        priority: req.query?.priority || ''
      });
      res.json({ success: true, tickets });
    } catch (err) {
      handleRouteError(res, err, 'Failed to fetch tickets');
    }
  });

  // 2b. Duplicate / Similar ticket detector (MUST be registered before /tickets/:id)
  router.get('/tickets/similar', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const similar = await ticketing.findSimilarTickets({
        query: req.query?.q || '',
        subject: req.query?.subject || '',
        description: req.query?.description || '',
        excludeTicketId: req.query?.excludeId || null,
        authUser,
        guestSession
      });
      res.json({ success: true, tickets: similar });
    } catch (err) {
      handleRouteError(res, err, 'Failed to search similar tickets');
    }
  });

  // 3. Tickets API: POST create new ticket (authenticated user OR verified/inline guest contact)
  router.post('/tickets', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: true });
      const {
        subject,
        category = 'General Inquiry',
        department = 'general',
        priority = 'medium',
        description = '',
        attachments = [],
        tags = [],
        watchers = [],
        tiwiId = null,
        storeId = null,
        storeName = null,
        channel = 'web'
      } = req.body || {};

      const created = await ticketing.createTicket({
        authUser,
        guestSession,
        req,
        subject,
        description,
        category,
        department,
        priority,
        channel,
        tiwiId,
        storeId,
        storeName,
        attachments,
        tags,
        watchers,
        assignedAgent: null
      });

      res.status(201).json({
        success: true,
        ticket: created.ticket,
        ...(created.recoveryCode ? { recoveryCode: created.recoveryCode } : {}),
        ...(created.guestSession ? { guestSession: created.guestSession } : {})
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to create ticket');
    }
  });

  router.get('/tickets/:id', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const detail = await ticketing.getTicketDetail(req.params.id, {
        viewerType: authUser ? 'customer' : 'guest',
        authUser,
        guestSession
      });
      res.json({ success: true, ...detail });
    } catch (err) {
      handleRouteError(res, err, 'Failed to load ticket');
    }
  });

  router.patch('/tickets/:id', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const ticket = await ticketing.updateTicket({
        ticketIdOrKey: req.params.id,
        updates: req.body || {},
        actorType: authUser ? 'customer' : 'guest',
        authUser,
        guestSession
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleRouteError(res, err, 'Failed to update ticket');
    }
  });

  router.post('/tickets/:id/replies', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const result = await ticketing.addTicketReply({
        ticketIdOrKey: req.params.id,
        message: req.body?.message ?? req.body?.text,
        attachments: req.body?.attachments || [],
        actorType: authUser ? 'customer' : 'guest',
        authUser,
        guestSession
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      handleRouteError(res, err, 'Failed to post reply');
    }
  });

  router.patch('/tickets/:id/replies/:replyId', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const result = await ticketing.editTicketReply({
        ticketIdOrKey: req.params.id,
        replyId: req.params.replyId,
        message: req.body?.message ?? req.body?.text,
        actorType: authUser ? 'customer' : 'guest',
        authUser,
        guestSession
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleRouteError(res, err, 'Failed to edit reply');
    }
  });

  router.post('/tickets/:id/status', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const ticket = await ticketing.updateTicket({
        ticketIdOrKey: req.params.id,
        updates: { status: req.body?.status },
        actorType: authUser ? 'customer' : 'guest',
        authUser,
        guestSession
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleRouteError(res, err, 'Failed to update ticket status');
    }
  });

  router.post('/tickets/:id/csat', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const ticket = await ticketing.submitTicketCsat({
        ticketIdOrKey: req.params.id,
        rating: req.body?.rating,
        comment: req.body?.comment || '',
        authUser,
        guestSession
      });
      res.json({ success: true, ticket });
    } catch (err) {
      handleRouteError(res, err, 'Failed to submit CSAT feedback');
    }
  });

  // Attachment upload endpoint using storeMedia from server/db/mediaStorage.js
  router.post(
    '/attachments',
    (req, res, next) => {
      const ct = String(req.headers['content-type'] || '').toLowerCase();
      if (ct.includes('multipart/form-data')) {
        return uploadAttachmentMiddleware.any()(req, res, (err) => {
          if (err) {
            return res.status(err.statusCode || 400).json({
              success: false,
              error: err.message || 'Invalid upload payload.',
              ...(err.code ? { code: err.code } : {})
            });
          }
          return next();
        });
      }
      return next();
    },
    async (req, res) => {
      try {
        const toggles = await ticketing.getSupportToggles();
        if (!toggles.allowAttachments) {
          return res.status(403).json({
            success: false,
            code: 'ATTACHMENTS_DISABLED',
            error: 'Support attachments are currently disabled.'
          });
        }
        const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });

        const uploaded = [];
        const files = Array.isArray(req.files) ? req.files : [];
        if (files.length > 0) {
          for (const file of files) {
            const validated = validateSupportAttachment({
              filename: file.originalname || 'attachment',
              mimetype: file.mimetype,
              buffer: file.buffer,
              maxBytes: 10 * 1024 * 1024
            });
            const safeName = validated.filename;
            const aliasPath = `/uploads/support/${randomUUID()}-${safeName}`;
            const contentType = validated.mimeType;
            const stored = await storeMediaFn({
              aliases: [aliasPath],
              buffer: file.buffer,
              contentType,
              originalFilename: safeName,
              ownerId: authUser?.id || null,
              purpose: 'support_attachment'
            });
            const url = await getPublicMediaUrlFn(aliasPath);
            uploaded.push({
              id: stored.id,
              url,
              filename: safeName,
              contentType,
              size: stored.size
            });
          }
        } else if (req.body?.dataBase64 && req.body?.filename) {
          const rawBase64 = String(req.body.dataBase64).replace(/^data:[^;]+;base64,/i, '');
          const buffer = Buffer.from(rawBase64, 'base64');
          if (!buffer.length) {
            return res.status(400).json({ success: false, error: 'Attachment dataBase64 cannot be empty.' });
          }
          const validated = validateSupportAttachment({
            filename: req.body.filename,
            contentType: req.body.contentType,
            buffer,
            maxBytes: 10 * 1024 * 1024
          });
          const safeName = validated.filename;
          const aliasPath = `/uploads/support/${randomUUID()}-${safeName}`;
          const contentType = validated.mimeType;
          const stored = await storeMediaFn({
            aliases: [aliasPath],
            buffer,
            contentType,
            originalFilename: safeName,
            ownerId: authUser?.id || null,
            purpose: 'support_attachment'
          });
          const url = await getPublicMediaUrlFn(aliasPath);
          uploaded.push({
            id: stored.id,
            url,
            filename: safeName,
            contentType,
            size: stored.size
          });
        } else {
          return res.status(400).json({ success: false, error: 'No attachment file provided.' });
        }

        res.status(201).json({
          success: true,
          attachments: uploaded,
          requesterType: authUser ? 'user' : 'guest',
          guestSessionId: guestSession?.id || null
        });
      } catch (err) {
        handleRouteError(res, err, 'Failed to upload attachment');
      }
    }
  );

  function mapTicketMessageToConvMessage(tm) {
    const senderTypeLower = String(tm?.senderType || tm?.senderRole || '').toLowerCase();
    const isCustomer = ['user', 'customer', 'guest', 'requester'].includes(senderTypeLower);
    const isBot = senderTypeLower === 'bot' || senderTypeLower === 'ai';
    const isSystem = senderTypeLower === 'system';
    const ts = tm?.createdAt || tm?.timestamp || new Date().toISOString();
    const parsedTs = Date.parse(ts);
    const timeStr = Number.isFinite(parsedTs)
      ? new Date(parsedTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    return {
      id: tm.id,
      ticketMessageId: tm.id,
      sender: isCustomer ? 'user' : isSystem ? 'system' : 'agent',
      senderType: senderTypeLower || (isCustomer ? 'user' : 'agent'),
      isBot,
      isSystemNotice: isSystem,
      agentName: isCustomer
        ? undefined
        : isBot
          ? (tm.senderName || 'Tiwi AI Assistant')
          : (tm.senderName || 'Support Specialist'),
      avatar: tm.senderAvatar || null,
      text: tm.message ?? tm.body ?? tm.text ?? '',
      attachments: Array.isArray(tm.attachments) ? tm.attachments : [],
      editedAt: tm.editedAt || null,
      time: timeStr,
      timestamp: ts
    };
  }

  async function enrichConversationWithTicket(conv, { authUser, guestSession }) {
    if (!conv || !conv.ticketId) return conv;
    try {
      const detail = await ticketing.getTicketDetail(conv.ticketId, {
        viewerType: authUser ? 'customer' : 'guest',
        authUser,
        guestSession
      });
      const publicTicketMessages = (Array.isArray(detail?.messages) ? detail.messages : [])
        .filter((m) => !m.isInternal && m.visibility !== 'internal');

      const baseMessages = Array.isArray(conv.messages) ? conv.messages.map((m) => ({ ...m })) : [];
      const normalizeBody = (v) => String(v || '').trim().replace(/\s+/g, ' ');
      const roleGroup = (m) => {
        const s = String(m?.senderType || m?.sender || '').toLowerCase();
        if (['user', 'customer', 'guest', 'requester'].includes(s)) return 'user';
        if (s === 'system' || m?.isSystemNotice) return 'system';
        return 'agent';
      };

      for (const tm of publicTicketMessages) {
        const mapped = mapTicketMessageToConvMessage(tm);
        const mappedBody = normalizeBody(mapped.text);
        const mappedTs = Date.parse(mapped.timestamp || 0) || 0;

        const existingById = baseMessages.find(
          (m) => (m.id && m.id === tm.id) || (m.ticketMessageId && m.ticketMessageId === tm.id)
        );
        if (existingById) {
          existingById.text = mapped.text;
          existingById.editedAt = mapped.editedAt;
          if (Array.isArray(mapped.attachments) && mapped.attachments.length > 0) {
            existingById.attachments = mapped.attachments;
          }
          if (!existingById.agentName && mapped.agentName) existingById.agentName = mapped.agentName;
          if (!existingById.senderType && mapped.senderType) existingById.senderType = mapped.senderType;
          continue;
        }

        const duplicate = baseMessages.find((m) => {
          if (roleGroup(m) !== roleGroup(mapped)) return false;
          if (normalizeBody(m.text ?? m.body ?? m.message) !== mappedBody) return false;
          const mTs = Date.parse(m.timestamp || m.createdAt || 0) || 0;
          if (!mTs || !mappedTs) return true;
          return Math.abs(mTs - mappedTs) < 120000;
        });
        if (duplicate) {
          if (!duplicate.ticketMessageId) duplicate.ticketMessageId = tm.id;
          if ((!Array.isArray(duplicate.attachments) || duplicate.attachments.length === 0) && Array.isArray(mapped.attachments) && mapped.attachments.length > 0) {
            duplicate.attachments = mapped.attachments;
          }
          continue;
        }

        baseMessages.push(mapped);
      }

      baseMessages.sort((a, b) => {
        const ta = Date.parse(a.timestamp || a.createdAt || 0) || 0;
        const tb = Date.parse(b.timestamp || b.createdAt || 0) || 0;
        if (ta && tb && ta !== tb) return ta - tb;
        return 0;
      });

      const lastMsg = baseMessages[baseMessages.length - 1];
      return {
        ...conv,
        serialNumber: detail?.ticket?.serialNumber || conv.serialNumber,
        ticketStatus: detail?.ticket?.status || conv.ticketStatus,
        assignedAgentName: detail?.ticket?.assignedAgentName ?? conv.assignedAgentName ?? null,
        messages: baseMessages,
        lastMessage: lastMsg?.text || conv.lastMessage,
        time: lastMsg?.time || conv.time
      };
    } catch {
      return conv;
    }
  }

  // 4. Conversations API: GET conversations strictly filtered by verified user or guest session
  router.get('/conversations', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const db = await SupportDB.getAllData();
      const ownedTickets = await ticketing.listTicketsForRequester({ authUser, guestSession }).catch(() => []);
      const ownedTicketIds = new Set();
      for (const t of ownedTickets || []) {
        if (t?.id) ownedTicketIds.add(t.id);
        if (t?.ticketId) ownedTicketIds.add(t.ticketId);
      }

      const userConvs = (db.conversations || []).filter((c) => {
        if (authUser) {
          return userMatchesRecord(authUser, c.userId) || Boolean(c.ticketId && ownedTicketIds.has(c.ticketId));
        }
        return Boolean(
          guestSession &&
          (c.guestSessionId === guestSession.id || (c.ticketId && ownedTicketIds.has(c.ticketId)))
        );
      });

      const enriched = await Promise.all(
        userConvs.map((c) => enrichConversationWithTicket(c, { authUser, guestSession }))
      );
      res.json({ success: true, conversations: enriched });
    } catch (err) {
      handleRouteError(res, err, 'Failed to fetch conversations');
    }
  });

  // 5. Conversations API: POST message to conversation with AI generation & closed ticket lock
  router.post('/conversations/:id/messages', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: true });
      const { id } = req.params;
      const {
        text,
        clientSource = req.headers['x-client-source'] || 'web',
        sessionId = req.headers['x-session-id'] || null,
        deviceFingerprint = null
      } = req.body || {};

      if (!text || !String(text).trim()) {
        return res.status(400).json({ success: false, error: 'Message text is required' });
      }

      const toggles = await ticketing.getSupportToggles();
      const db = await SupportDB.getAllData();
      let conv = (db.conversations || []).find((c) => c.id === id);

      if (conv) {
        const ownsConv = authUser
          ? userMatchesRecord(authUser, conv.userId)
          : Boolean(guestSession && conv.guestSessionId === guestSession.id);
        if (!ownsConv) {
          return res.status(403).json({ success: false, error: 'Not authorized to access this conversation' });
        }
      }

      const linkedTicketId = conv?.ticketId || null;
      if (linkedTicketId) {
        try {
          const detail = await ticketing.getTicketDetail(linkedTicketId, {
            viewerType: authUser ? 'customer' : 'guest',
            authUser,
            guestSession
          });
          if (detail.ticket?.status === 'closed') {
            return res.status(403).json({
              success: false,
              code: 'TICKET_CLOSED_PERMANENTLY',
              error: 'This ticket is closed and permanently locked. Replies are disabled.'
            });
          }
        } catch (err) {
          if (err?.statusCode === 403) {
            return res.status(403).json({ success: false, error: err.message, code: err.code });
          }
        }
      }

      const verifiedUserId = authUser ? authUser.id : guestSession.id;
      const verifiedUserName = authUser
        ? (authUser.name || authUser.storeName || 'Store Owner')
        : guestSession.visitorName;

      if (!conv) {
        conv = {
          id,
          userId: authUser ? authUser.id : 'guest',
          guestSessionId: guestSession?.id || null,
          name: 'Support Team',
          role: 'Support Team',
          time: 'Just now',
          unread: 0,
          isSupport: true,
          lastMessage: String(text).trim(),
          messages: []
        };
        db.conversations.unshift(conv);
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userMessage = {
        id: `msg_${Date.now()}`,
        sender: 'user',
        text: String(text).trim(),
        time: timeStr,
        timestamp: now.toISOString()
      };
      conv.messages.push(userMessage);
      conv.lastMessage = String(text).trim();
      conv.time = timeStr;

      if (linkedTicketId) {
        await ticketing.addTicketReply({
          ticketIdOrKey: linkedTicketId,
          message: String(text).trim(),
          actorType: authUser ? 'customer' : 'guest',
          authUser,
          guestSession
        }).catch((err) => {
          if (err?.statusCode === 403) throw err;
        });
      }

      let agentMessage = null;
      if (toggles.aiAutoReplyEnabled !== false) {
        const clientContext = {
          clientSource: clientSource || req.headers['x-client-source'] || 'web',
          sessionId: sessionId || req.headers['x-session-id'],
          deviceFingerprint: deviceFingerprint || {
            platform: req.headers['x-client-platform'] || 'web',
            ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
          }
        };

        let replyText = `Hello ${verifiedUserName}, thank you for reaching out to Tiwlo Support. We are reviewing your request now.`;
        try {
          const history = conv.messages.slice(-8).map((m) => ({
            role: m.sender === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }));
          const replyData = await TiwiAI.generateSupportReply({
            agentName: 'Tiwi Support AI',
            agentRole: 'Support Specialist',
            userId: authUser ? authUser.id : 'guest',
            userName: verifiedUserName,
            userEmail: authUser?.email || guestSession?.visitorEmail || '',
            isLoggedIn: Boolean(authUser),
            userMessage: String(text).trim(),
            conversationHistory: history,
            clientContext
          });
          if (replyData?.reply) replyText = replyData.reply;
        } catch {
          // Fallback reply text already set
        }

        agentMessage = {
          id: `msg_reply_${Date.now()}`,
          sender: 'agent',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date().toISOString()
        };
        conv.messages.push(agentMessage);
        conv.lastMessage = replyText;

        if (linkedTicketId) {
          await ticketing.addTicketReply({
            ticketIdOrKey: linkedTicketId,
            message: replyText,
            actorType: 'bot',
            authUser,
            guestSession
          }).catch(() => {});
        }
      }

      await SupportDB.saveAllData(db);

      res.json({
        success: true,
        userMessage,
        agentMessage,
        conversation: conv,
        userId: verifiedUserId
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to post message');
    }
  });

  // 5b. Convert conversation to formal ticket
  router.post('/conversations/:id/convert-to-ticket', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const db = await SupportDB.getAllData();
      const conv = (db.conversations || []).find((c) => c.id === req.params.id);
      if (!conv) {
        return res.status(404).json({ success: false, error: 'Conversation not found.' });
      }
      const ownsConv = authUser
        ? userMatchesRecord(authUser, conv.userId)
        : Boolean(guestSession && conv.guestSessionId === guestSession.id);
      if (!ownsConv) {
        return res.status(403).json({ success: false, error: 'Not authorized to convert this conversation.' });
      }

      const initialMessages = (conv.messages || [])
        .filter((m) => m && m.text)
        .map((m) => ({
          senderType: m.sender === 'user' ? (authUser ? 'user' : 'guest') : 'bot',
          senderName: m.sender === 'user'
            ? (authUser?.name || guestSession?.visitorName || 'Customer')
            : (m.agentName || 'Tiwi AI Assistant'),
          message: m.text
        }));

      const created = await ticketing.createTicket({
        authUser,
        guestSession,
        req,
        subject: req.body?.subject || conv.name || 'Converted Support Conversation',
        description: req.body?.description || conv.lastMessage || 'Converted from support inbox.',
        category: req.body?.category || 'Live Support',
        priority: req.body?.priority || 'medium',
        channel: 'chat',
        initialMessages
      });

      conv.ticketId = created.ticket.ticketId;
      conv.serialNumber = created.ticket.serialNumber;
      await SupportDB.saveAllData(db).catch(() => {});

      res.status(201).json({
        success: true,
        ticket: created.ticket,
        ...(created.recoveryCode ? { recoveryCode: created.recoveryCode } : {})
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to convert conversation to ticket');
    }
  });

  // 6. Initiate support session with ticket serial & personalized greeting (enforces auth or guest contact!)
  router.post('/initiate', async (req, res) => {
    try {
      const toggles = await ticketing.getSupportToggles();
      if (!toggles.liveChatWidgetEnabled) {
        return res.status(403).json({
          success: false,
          code: 'LIVE_CHAT_DISABLED',
          error: 'Live support chat is currently disabled.'
        });
      }

      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: true });
      const { initialSubject } = req.body || {};

      const agent = getAgentByTier(1);
      const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cleanName = authUser
        ? (authUser.name || authUser.storeName || 'Store Owner')
        : guestSession.visitorName;

      const created = await ticketing.createTicket({
        authUser,
        guestSession,
        req,
        subject: initialSubject || (authUser ? `Live Support Session (${cleanName})` : `Guest Support Inquiry (${cleanName})`),
        description: 'Support session initiated via Tiwlo Live Support Widget.',
        category: authUser ? 'Live Support' : 'Guest Inquiry',
        priority: 'medium',
        channel: 'chat',
        assignedAgent: null,
        metadata: { sessionId }
      });

      const serialNumber = created.ticket.serialNumber || generateTicketSerial().serialNumber;
      const welcomeGreeting = authUser
        ? `Hello ${cleanName}! My name is ${agent.firstName} from Tiwlo Customer Support (Ticket ${serialNumber}). How can I assist you with your servers, stores, or POS system today?`
        : `Hello ${cleanName} and welcome to Tiwlo Support! My name is ${agent.firstName} (Ticket ${serialNumber}). How can I help you today?`;

      try {
        const db = await SupportDB.getAllData();
        const newConv = {
          id: sessionId,
          ticketId: created.ticket.ticketId,
          serialNumber,
          userId: authUser ? authUser.id : 'guest',
          guestSessionId: guestSession?.id || null,
          name: `${agent.name} (${serialNumber})`,
          role: agent.tierTitle,
          time: 'Just now',
          unread: 0,
          isSupport: true,
          lastMessage: welcomeGreeting,
          messages: [
            {
              id: `msg_welcome_${Date.now()}`,
              sender: 'agent',
              agentName: agent.name,
              avatar: agent.avatar,
              tierTitle: agent.tierTitle,
              text: welcomeGreeting,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: new Date().toISOString()
            }
          ]
        };
        db.conversations.unshift(newConv);
        await SupportDB.saveAllData(db);
      } catch {
        // Non-fatal if SupportDB PG state doc isn't active in isolated unit test
      }

      res.json({
        success: true,
        sessionId,
        ticket: created.ticket,
        ...(created.recoveryCode ? { recoveryCode: created.recoveryCode } : {}),
        ...(guestSession ? { guestSession } : {}),
        agent,
        currentTier: 1,
        welcomeGreeting
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to initiate support session');
    }
  });

  // 7. Multi-Tier Support Handover Endpoint (Tier 1 -> Tier 2 -> Tier 3)
  router.post('/transfer', async (req, res) => {
    try {
      const { targetTier = 2, currentAgentId, userName = 'Customer', activeTicketId = null } = req.body || {};
      const newTier = Math.min(3, Math.max(1, parseInt(targetTier, 10) || 2));
      const newAgent = getAgentByTier(newTier, currentAgentId);

      if (activeTicketId) {
        const authUser = getAuthenticatedSupportUser(req);
        const guestSession = authUser ? null : await ticketing.resolveGuestSessionFromRequest(req);
        if (authUser || guestSession) {
          await ticketing.updateTicket({
            ticketIdOrKey: activeTicketId,
            updates: { status: newTier >= 2 ? 'escalated' : 'open' },
            actorType: authUser ? 'customer' : 'guest',
            authUser,
            guestSession
          }).catch(() => {});
        }
      }

      const handoffNotice = newTier === 2
        ? `Transferring you to our Tier-2 Technical & Cloud Operations Specialist (${newAgent.name})...`
        : `Escalating your session to Tier-3 Senior Systems & Infrastructure Lead (${newAgent.name})...`;

      const introGreeting = newTier === 2
        ? `Hi ${userName}, this is ${newAgent.firstName} from Technical Cloud Operations. I've received your ticket and reviewed your server/system metrics. Let's get this resolved for you!`
        : `Hello ${userName}, ${newAgent.name} here from Senior Infrastructure & Architecture. I have taken over your case with direct system clearance. How can I resolve this for you?`;

      res.json({
        success: true,
        newTier,
        handoffNotice,
        agent: newAgent,
        introGreeting
      });
    } catch {
      res.status(500).json({ error: 'Failed to transfer support session' });
    }
  });

  // 8. Send message & get response via Tiwi AI Engine (enforces auth or verified guest + closed lock)
  router.post('/message', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: true });
      const {
        agentName = 'Tiwi Support AI',
        agentRole = 'Support Specialist',
        currentTier = 1,
        message,
        activeTicketId = null,
        conversationHistory = [],
        clientSource = req.headers['x-client-source'] || 'web',
        sessionId = req.headers['x-session-id'] || null,
        deviceFingerprint = null
      } = req.body || {};

      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, error: 'Message is required' });
      }

      const toggles = await ticketing.getSupportToggles();
      if (activeTicketId) {
        try {
          const detail = await ticketing.getTicketDetail(activeTicketId, {
            viewerType: authUser ? 'customer' : 'guest',
            authUser,
            guestSession
          });
          if (detail.ticket?.status === 'closed') {
            return res.status(403).json({
              success: false,
              code: 'TICKET_CLOSED_PERMANENTLY',
              error: 'This ticket is closed and permanently locked. Replies are disabled.'
            });
          }
        } catch (err) {
          if (err?.statusCode === 403 || err?.statusCode === 404) {
            return res.status(err.statusCode).json({ success: false, error: err.message, code: err.code });
          }
        }
      }

      const verifiedUserId = authUser ? authUser.id : 'guest';
      const verifiedUserName = authUser
        ? (authUser.name || authUser.storeName || 'Store Owner')
        : guestSession.visitorName;
      const verifiedUserEmail = authUser ? (authUser.email || '') : guestSession.visitorEmail;

      const clientContext = {
        clientSource: clientSource || req.headers['x-client-source'] || 'web',
        sessionId: sessionId || req.headers['x-session-id'],
        deviceFingerprint: deviceFingerprint || {
          platform: req.headers['x-client-platform'] || 'web',
          ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1'
        }
      };

      const replyData = toggles.aiAutoReplyEnabled !== false
        ? await TiwiAI.generateSupportReply({
            agentName,
            agentRole,
            userId: verifiedUserId,
            userName: verifiedUserName,
            userEmail: verifiedUserEmail,
            isLoggedIn: Boolean(authUser),
            userMessage: String(message).trim(),
            activeTicketId,
            conversationHistory,
            clientContext
          })
        : {
            reply: 'Thank you for your message. A support specialist will review your ticket shortly.',
            actionsExecuted: []
          };

      if (activeTicketId) {
        await ticketing.addTicketReply({
          ticketIdOrKey: activeTicketId,
          message: String(message).trim(),
          actorType: authUser ? 'customer' : 'guest',
          authUser,
          guestSession
        });
        if (replyData?.reply) {
          await ticketing.addTicketReply({
            ticketIdOrKey: activeTicketId,
            message: replyData.reply,
            actorType: 'bot',
            authUser,
            guestSession
          }).catch(() => {});
        }
      }

      try {
        const db = await SupportDB.getAllData();
        const targetSessionId = sessionId || activeTicketId;
        const conv = (db.conversations || []).find((c) => {
          const idMatch = c.id === targetSessionId || c.ticketId === activeTicketId || c.ticketId === targetSessionId;
          if (!idMatch) return false;
          if (authUser) return userMatchesRecord(authUser, c.userId);
          return Boolean(guestSession && c.guestSessionId === guestSession.id);
        });
        if (conv) {
          const now = new Date();
          const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (!Array.isArray(conv.messages)) conv.messages = [];
          conv.messages.push({
            id: `msg_u_${Date.now()}`,
            sender: 'user',
            text: String(message).trim(),
            time: timeStr,
            timestamp: now.toISOString()
          });
          conv.messages.push({
            id: `msg_a_${Date.now()}`,
            sender: 'agent',
            agentName,
            text: replyData.reply,
            time: timeStr,
            timestamp: now.toISOString()
          });
          conv.lastMessage = replyData.reply;
          conv.time = timeStr;
          await SupportDB.saveAllData(db);
        }
      } catch {
        // Non-fatal
      }

      let shouldOfferTransfer = false;
      let transferToTier = null;
      const lower = String(message).toLowerCase();

      if (currentTier === 1) {
        if (
          lower.includes('error') || lower.includes('bug') || lower.includes('crash') ||
          lower.includes('kernel') || lower.includes('firewall') || lower.includes('dns') ||
          lower.includes('ssh') || lower.includes('root') || lower.includes('ip address') ||
          lower.includes('database schema') || lower.includes('server down') || lower.includes('hang')
        ) {
          shouldOfferTransfer = true;
          transferToTier = 2;
        }
      } else if (currentTier === 2) {
        if (
          lower.includes('enterprise') || lower.includes('escalate') || lower.includes('manager') ||
          lower.includes('sla') || lower.includes('contract') || lower.includes('architecture') ||
          lower.includes('disaster recovery')
        ) {
          shouldOfferTransfer = true;
          transferToTier = 3;
        }
      }

      res.json({
        ...replyData,
        shouldOfferTransfer,
        transferToTier
      });
    } catch (err) {
      handleRouteError(res, err, 'Internal support error');
    }
  });

  // 9. Brain diagnostic status endpoint
  router.get('/brain-status', async (req, res) => {
    try {
      const userId = req.activeUser?.id || req.user?.id || req.session?.userId || null;
      const state = await SystemBrain.scanUserSystemState(userId);
      res.json({
        status: 'active',
        engine: 'Tiwi AI Live Support Core',
        systemScan: state
      });
    } catch {
      res.status(500).json({ error: 'Failed to scan brain status' });
    }
  });

  // 10. Account Security Verification & Resolution Pipeline (Preserved!)
  router.post('/appeal-chat', securityLimiters.otpRequestIp, securityLimiters.otpRequestAccount, async (req, res) => {
    try {
      let { email, message } = req.body || {};
      if (!message?.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      if (!email || email === `user@${PLATFORM_CONFIG.primaryDomain}` || !email.trim()) {
        const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          email = emailMatch[0];
        }
      }

      if (!email) {
        return res.json({
          reply: 'Please provide your registered Tiwlo email address so the Account Security Team can locate your record and evaluate your appeal.',
          restored: false,
          requiresEmail: true
        });
      }

      const result = await processSecurityAppeal({ email, message });
      res.json(result);
    } catch (err) {
      console.error('Error in /api/support/appeal-chat:', err);
      res.status(500).json({ error: 'Security review server is temporarily unavailable. Please try again.' });
    }
  });

  // 11. Cryptographic Restore & Security Checkup Token Verification Endpoint (Preserved!)
  router.post('/verify-restore-token', async (req, res) => {
    try {
      const { token } = req.body || {};
      const verification = RestoreSessions.verifySession(token);
      if (!verification.valid) {
        return res.json(verification);
      }

      let userDetails = null;
      try {
        const found = await MasterDB.findUserByIdentifier(verification.session.userId || verification.session.email);
        if (found) {
          userDetails = {
            id: found.id,
            email: found.email,
            name: found.name || found.storeName || 'Tiwlo User',
            storeName: found.storeName || '',
            tiwiId: found.tiwiId || found.storeId || '',
            avatar: found.avatar || null,
            twoFactorEnabled: !!found.twoFactorEnabled,
            createdAt: found.createdAt
          };
        }
      } catch (e) {
        console.warn('Error reading master user for restore token:', e.message);
      }

      res.json({
        ...verification,
        user: userDetails || { email: verification.session.email }
      });
    } catch (err) {
      res.status(500).json({ valid: false, error: err.message });
    }
  });

  // 12. Real-Time Live Chat Queue & AI-to-Human Handoff Endpoints
  const liveChatQueue = deps.liveChatQueueService || getDefaultLiveChatQueueService();

  function handleLiveChatErr(res, err, fallback) {
    if (err instanceof LiveChatQueueError || (err && Number.isInteger(err.statusCode))) {
      return res.status(err.statusCode || 400).json({
        success: false,
        error: err.message,
        ...(err.code ? { code: err.code } : {})
      });
    }
    return handleRouteError(res, err, fallback);
  }

  router.post('/live-chat/request', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: true });
      const body = req.body || {};
      const result = await liveChatQueue.requestLiveChat({
        authUser,
        guestSession,
        guestName: body.guestName || guestSession?.visitorName,
        guestEmail: body.guestEmail || guestSession?.visitorEmail,
        guestPhone: body.guestPhone || guestSession?.visitorPhone,
        topic: body.topic || 'Live Support Request',
        department: body.department || 'General Support',
        initialMessage: body.initialMessage || body.message || '',
        req
      });
      res.status(result.reused ? 200 : 201).json({ success: true, ...result });
    } catch (err) {
      handleLiveChatErr(res, err, 'Failed to join live chat queue');
    }
  });

  router.get('/live-chat/status', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const result = await liveChatQueue.getCustomerLiveChatStatus({
        chatId: req.query.chatId || null,
        authUser,
        guestSession
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleLiveChatErr(res, err, 'Failed to read live chat status');
    }
  });

  router.post('/live-chat/messages', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const body = req.body || {};
      const result = await liveChatQueue.sendCustomerLiveChatMessage({
        chatId: body.chatId,
        body: body.message || body.body,
        authUser,
        guestSession
      });
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      handleLiveChatErr(res, err, 'Failed to send live chat message');
    }
  });

  router.post('/live-chat/end', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const chat = await liveChatQueue.endLiveChatSession(req.body?.chatId, {
        actor: { authUser, guestSession },
        actorType: 'customer',
        req
      });
      res.json({ success: true, chat });
    } catch (err) {
      handleLiveChatErr(res, err, 'Failed to end live chat session');
    }
  });

  // 12b. Consent-Based Visitor Co-Browsing State Sync
  router.post('/live-chat/co-browse', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const body = req.body || {};
      const result = await liveChatQueue.updateCoBrowsingState(body.chatId, {
        actorType: 'customer',
        authUser,
        guestSession,
        enabled: body.enabled,
        route: body.route,
        scrollPct: body.scrollPct,
        viewport: body.viewport
      });
      res.json({ success: true, ...result });
    } catch (err) {
      handleLiveChatErr(res, err, 'Failed to update co-browsing state');
    }
  });

  // 12c. Post-Resolution Automated CSAT Survey
  router.post('/csat-survey', async (req, res) => {
    try {
      const { authUser, guestSession } = await resolveSupportRequester(req, res, { allowInlineGuestContact: false });
      const body = req.body || {};
      const targetType = body.targetType === 'ticket' ? 'ticket' : 'live_chat';
      let staffIdOverride = null;
      let staffNameOverride = null;
      let resolvedTargetId = body.targetId || body.chatId || body.ticketId;

      if (targetType === 'ticket') {
        const ticket = await ticketing.getCustomerTicket(resolvedTargetId, {
          user: authUser,
          guestSession
        });
        if (!ticket) {
          return res.status(404).json({ success: false, error: 'Ticket not found.' });
        }
        resolvedTargetId = ticket.id;
        staffIdOverride = ticket.assignedAgentId || null;
        staffNameOverride = ticket.assignedAgentName || null;
      }

      const survey = await liveChatQueue.submitCsatSurvey({
        targetType,
        targetId: resolvedTargetId,
        rating: body.rating,
        tags: body.tags || [],
        comment: body.comment || '',
        authUser,
        guestSession,
        staffIdOverride,
        staffNameOverride
      });
      res.status(201).json({ success: true, survey });
    } catch (err) {
      handleLiveChatErr(res, err, 'Failed to submit customer satisfaction survey');
    }
  });

  // 13. Support Attachment Download & Inbound Email Sync
  router.get('/attachments/:attachmentId', async (req, res) => {
    try {
      const adminCandidate = req.adminUser?.id && isSupportStaffUser(req.adminUser) ? req.adminUser : null;
      const activeUser = getAuthenticatedSupportUser(req);
      const resolvedUser = activeUser || adminCandidate;
      const guestSession = resolvedUser ? null : await ticketing.resolveGuestSessionFromRequest(req);
      if (!resolvedUser && !guestSession) {
        return res.status(401).json({
          success: false,
          code: 'GUEST_CONTACT_REQUIRED',
          error: 'Authentication or verified guest support session required.'
        });
      }

      const isStaff = isSupportStaffUser(resolvedUser);
      const att = await ticketing.getSupportAttachmentById(req.params.attachmentId, {
        authUser: isStaff ? null : resolvedUser,
        adminUser: isStaff ? resolvedUser : null,
        adminProfile: req.adminProfile || null,
        guestSession
      });
      if (!att) {
        return res.status(404).json({ success: false, error: 'Attachment not found.' });
      }

      const rawMime = String(att.mimeType || '').split(';')[0].trim().toLowerCase();
      const safeMime = SAFE_SUPPORT_DOWNLOAD_MIMES.has(rawMime) ? rawMime : 'application/octet-stream';
      const canInline = SAFE_INLINE_IMAGE_MIMES.has(safeMime) && !startsWithActiveMarkupOrScript(att.buffer);
      const cleanFilename = String(att.filename || 'file').replace(/[\r\n"\\/]/g, '_');

      res.setHeader('Content-Type', safeMime);
      res.setHeader('Content-Disposition', `${canInline ? 'inline' : 'attachment'}; filename="${cleanFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'private, no-store');
      return res.send(att.buffer);
    } catch (err) {
      return handleRouteError(res, err, 'Failed to load attachment');
    }
  });

  router.post('/email-inbound', async (req, res) => {
    try {
      const webhookSecret = String(process.env.SUPPORT_EMAIL_WEBHOOK_SECRET || '');
      if (!webhookSecret) {
        return res.status(503).json({
          success: false,
          code: 'EMAIL_WEBHOOK_NOT_CONFIGURED',
          error: 'Inbound email webhook secret is not configured.'
        });
      }
      const providedHeader = Array.isArray(req.headers['x-tiwlo-email-secret'])
        ? req.headers['x-tiwlo-email-secret'][0]
        : req.headers['x-tiwlo-email-secret'];
      const expectedBuf = Buffer.from(webhookSecret, 'utf8');
      const providedBuf = Buffer.from(String(providedHeader || ''), 'utf8');
      if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
        return res.status(401).json({ success: false, error: 'Invalid inbound email webhook secret.' });
      }
      const result = await ticketing.ingestInboundTicketEmail(req.body || {});
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      handleRouteError(res, err, 'Failed to ingest inbound ticket email');
    }
  });

  return router;
}

const defaultRouter = createSupportRouter();
export default defaultRouter;
