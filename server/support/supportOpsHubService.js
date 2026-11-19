import { randomUUID } from 'node:crypto';
import { isPgActive as defaultIsPgActive, queryPg as defaultQueryPg } from '../db/postgres.js';
import { MasterDB as defaultMasterDB } from '../db/multiTenant.js';
import {
  defaultTicketingService,
  isSuperAdminUserRecord,
  resolveSupportPermissions
} from './ticketingService.js';
import { getDefaultLiveChatQueueService } from './liveChatQueueService.js';
import { executeGeminiWithFailover } from './ai/aiKeyPoolService.js';

export class SupportOpsHubError extends Error {
  constructor(message, { statusCode = 400, code = 'SUPPORT_OPS_ERROR' } = {}) {
    super(message);
    this.name = 'SupportOpsHubError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const DEFAULT_STAFF_PREFERENCES = Object.freeze({
  ringDurationSeconds: 5,
  vibrationEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  requirePinOnLaunch: false,
  autoLockMinutes: 5,
  signatureText: 'Best regards,\nTiwlo Support Team',
  autoAppendSignature: false,
  defaultReplyMode: 'public',
  aiPreferredTone: 'warm_brand',
  preClickPreviewEnabled: true,
  uiDensity: 'comfortable',
  selectiveBorders: true,
  defaultLandingTab: 'home',
  dailyResolvedGoal: 15
});

function slugify(value, fallback = 'item') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function parseJsonValue(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeStringArray(input, maxItems = 25, maxLen = 80) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const clean = String(raw || '').trim().slice(0, maxLen);
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

function extractTicketRefs(text) {
  const matches = String(text || '').match(/#(?:TKT|TWTK)-[A-Za-z0-9_-]+/gi) || [];
  const seen = new Set();
  const refs = [];
  for (const m of matches) {
    const upper = m.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      refs.push(upper);
    }
  }
  return refs;
}

function buildDefaultKbArticles(nowIso) {
  return [
    {
      id: 'kb_payment_reconciliation',
      title: 'Payment & Top-Up Reconciliation Guide (bKash, Nagad & Cards)',
      slug: 'payment-top-up-reconciliation-guide-bkash-nagad-cards',
      category: 'Billing & Payments',
      visibility: 'internal',
      summary: 'Step-by-step verification playbook when a merchant reports a delayed cloud credit top-up or gateway callback.',
      content: [
        '1. Open Customer Context and locate the Billing ID (`TIWI-...`) and recent `cloud_credit_topups` transactions.',
        '2. Verify gateway reference / TrxID and confirm whether status is `pending`, `paid`, or `expired`.',
        '3. If debited at gateway with delayed webhook, escalate via Tier-2 Action Approvals (`credit` or `refund`) with TrxID attached.',
        '4. Never promise instant manual wallet credit without verified gateway settlement.'
      ].join('\n'),
      tags: ['billing', 'bkash', 'nagad', 'reconciliation'],
      pinned: true,
      viewsCount: 24,
      helpfulCount: 11,
      authorId: 'system',
      authorName: 'Tiwlo Billing Ops',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'kb_custom_domain_ssl',
      title: 'Custom Domain DNS & Auto-SSL Troubleshooting',
      slug: 'custom-domain-dns-auto-ssl-troubleshooting',
      category: 'Technical Cloud',
      visibility: 'public',
      summary: 'How merchants point A/CNAME records to Tiwlo storefronts and resolve pending SSL certificate issuance.',
      content: [
        'Ensure the root domain points to Tiwlo edge ingress and `www` CNAME targets the store subdomain.',
        'Remove conflicting Cloudflare proxy orange-cloud or AAAA records if ACME HTTP-01 challenge stalls.',
        'DNS propagation typically completes within 15–30 minutes; SSL provisions automatically once verified.'
      ].join('\n'),
      tags: ['dns', 'ssl', 'domains', 'storefront'],
      pinned: true,
      viewsCount: 42,
      helpfulCount: 19,
      authorId: 'system',
      authorName: 'Tiwlo Cloud Engineering',
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      id: 'kb_account_appeal_sop',
      title: 'Restricted Account & KYC Appeal Handling SOP',
      slug: 'restricted-account-kyc-appeal-handling-sop',
      category: 'Trust & Safety',
      visibility: 'internal',
      summary: 'Mandatory identity, multi-account risk graph, and specialist lock rules when reviewing account appeals.',
      content: [
        'All `PICK_ACCOUNT_APPEAL` tickets require specialist acceptance before any public reply.',
        'Check Multi-Account Risk score, active sessions, and KYC status in Customer 360 before recommending unlock.',
        'Submit an `account_unlock` approval request for Tier-2 Trust & Safety sign-off when risk score >= 50.'
      ].join('\n'),
      tags: ['kyc', 'appeals', 'security', 'sop'],
      pinned: false,
      viewsCount: 18,
      helpfulCount: 8,
      authorId: 'system',
      authorName: 'Trust & Safety Lead',
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
}

function buildDefaultDepartments(nowIso) {
  return [
    {
      id: 'dept_customer_support',
      name: 'Customer Support',
      slug: 'customer-support',
      leadName: 'Nadia Rahman',
      slaResponseMinutes: 30,
      slaResolveMinutes: 480,
      businessHours: '24/7 Live Coverage (GMT+6)',
      autoAckMessage: 'Hello! Tiwlo Customer Support has received your request and a specialist will assist you shortly.',
      isActive: true,
      updatedAt: nowIso
    },
    {
      id: 'dept_technical_cloud',
      name: 'Technical Cloud',
      slug: 'technical-cloud',
      leadName: 'Tanvir Hasan',
      slaResponseMinutes: 20,
      slaResolveMinutes: 240,
      businessHours: '24/7 Cloud Ops (GMT+6)',
      autoAckMessage: 'Tiwlo Cloud Engineering is reviewing your store/server telemetry and DNS logs now.',
      isActive: true,
      updatedAt: nowIso
    },
    {
      id: 'dept_billing_finance',
      name: 'Billing & Finance',
      slug: 'billing-finance',
      leadName: 'Farhana Karim',
      slaResponseMinutes: 45,
      slaResolveMinutes: 720,
      businessHours: 'Sun–Thu, 09:00–21:00 (GMT+6)',
      autoAckMessage: 'Thank you for contacting Tiwlo Billing. Please share your invoice or transaction ID for faster verification.',
      isActive: true,
      updatedAt: nowIso
    },
    {
      id: 'dept_trust_safety',
      name: 'Trust & Safety',
      slug: 'trust-safety',
      leadName: 'Arif Chowdhury',
      slaResponseMinutes: 60,
      slaResolveMinutes: 1440,
      businessHours: 'Daily, 08:00–00:00 (GMT+6)',
      autoAckMessage: 'Your security or account verification inquiry has been routed to Tiwlo Trust & Safety.',
      isActive: true,
      updatedAt: nowIso
    }
  ];
}

function buildDefaultAutomationRules(nowIso) {
  return [
    {
      id: 'rule_outage_urgent',
      name: 'Storefront Down / 502 Priority Escalator',
      description: 'Automatically elevate tickets mentioning 502, outage, or server down to Urgent priority.',
      enabled: true,
      triggerField: 'keyword',
      triggerValue: 'server down, 502, store offline',
      actionType: 'set_priority',
      actionValue: 'urgent',
      hitsCount: 14,
      updatedAt: nowIso
    },
    {
      id: 'rule_billing_route',
      name: 'Payment & Refund Department Router',
      description: 'Route Billing & Orders inquiries directly to Billing & Finance.',
      enabled: true,
      triggerField: 'category',
      triggerValue: 'Billing & Orders',
      actionType: 'set_department',
      actionValue: 'Billing & Finance',
      hitsCount: 39,
      updatedAt: nowIso
    },
    {
      id: 'rule_appeal_escalate',
      name: 'Account Appeal Tier-2 Flag',
      description: 'Tag and mark account appeals for Trust & Safety specialist review.',
      enabled: true,
      triggerField: 'category',
      triggerValue: 'PICK_ACCOUNT_APPEAL',
      actionType: 'mark_escalated',
      actionValue: 'tier2',
      hitsCount: 9,
      updatedAt: nowIso
    }
  ];
}

export function createSupportOpsHubService(options = {}) {
  const {
    isPgActive: customIsPgActive = null,
    queryPg: customQueryPg = null,
    ticketingService = null,
    liveChatQueueService = null,
    executeAiFn = executeGeminiWithFailover,
    MasterDB: customMasterDB = null,
    useMemory = false
  } = options;

  const queryPgFn = customQueryPg || defaultQueryPg;
  const isPgActiveFn = customIsPgActive || defaultIsPgActive;

  const getTicketing = () => ticketingService || defaultTicketingService;
  const getLiveChat = () => liveChatQueueService || getDefaultLiveChatQueueService();
  const getMasterDb = () => customMasterDB || defaultMasterDB;

  // Map<collection, Map<itemId, { payload, updatedAt }>>
  const memStore = new Map();
  let schemaReady = false;
  let schemaPromise = null;

  function isUsingPg() {
    if (useMemory === true) return false;
    if (typeof customIsPgActive === 'function') return Boolean(customIsPgActive());
    if (typeof customQueryPg === 'function') return true;
    return Boolean(isPgActiveFn());
  }

  async function ensureOpsSchema() {
    if (!isUsingPg()) return { ok: true, mode: 'memory' };
    if (schemaReady) return { ok: true, mode: 'postgres', cached: true };
    if (schemaPromise) return schemaPromise;

    schemaPromise = (async () => {
      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_ops_kv_store (
          collection VARCHAR(64) NOT NULL,
          item_id VARCHAR(120) NOT NULL,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (collection, item_id)
        )
      `);
      await queryPgFn(`
        CREATE INDEX IF NOT EXISTS idx_support_ops_kv_collection
        ON support_ops_kv_store (collection, updated_at DESC)
      `);
      schemaReady = true;
      return { ok: true, mode: 'postgres' };
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });

    return schemaPromise;
  }

  function getMemCollection(collection) {
    if (!memStore.has(collection)) {
      memStore.set(collection, new Map());
    }
    return memStore.get(collection);
  }

  async function kvGet(collection, itemId) {
    const col = String(collection);
    const key = String(itemId);
    if (isUsingPg()) {
      await ensureOpsSchema();
      const { rows } = await queryPgFn(
        `SELECT payload FROM support_ops_kv_store WHERE collection = $1 AND item_id = $2 LIMIT 1`,
        [col, key]
      );
      if (!rows?.[0]) return null;
      const parsed = parseJsonValue(rows[0].payload, null);
      return parsed && typeof parsed === 'object' ? structuredClone(parsed) : parsed;
    }
    const bucket = getMemCollection(col);
    const entry = bucket.get(key);
    return entry ? structuredClone(entry.payload) : null;
  }

  async function kvPut(collection, itemId, payload) {
    const col = String(collection).slice(0, 64);
    const key = String(itemId).slice(0, 120);
    const nowIso = new Date().toISOString();
    if (isUsingPg()) {
      await ensureOpsSchema();
      await queryPgFn(
        `INSERT INTO support_ops_kv_store (collection, item_id, payload, updated_at)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (collection, item_id)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
        [col, key, JSON.stringify(payload), nowIso]
      );
      return structuredClone(payload);
    }
    const bucket = getMemCollection(col);
    bucket.set(key, { payload: structuredClone(payload), updatedAt: nowIso });
    return structuredClone(payload);
  }

  async function kvDelete(collection, itemId) {
    const col = String(collection);
    const key = String(itemId);
    if (isUsingPg()) {
      await ensureOpsSchema();
      const res = await queryPgFn(
        `DELETE FROM support_ops_kv_store WHERE collection = $1 AND item_id = $2`,
        [col, key]
      );
      return (res?.rowCount || 0) > 0;
    }
    const bucket = getMemCollection(col);
    return bucket.delete(key);
  }

  async function kvList(collection) {
    const col = String(collection);
    if (isUsingPg()) {
      await ensureOpsSchema();
      const { rows } = await queryPgFn(
        `SELECT item_id, payload, updated_at FROM support_ops_kv_store
         WHERE collection = $1
         ORDER BY updated_at DESC`,
        [col]
      );
      return (rows || [])
        .map((r) => parseJsonValue(r.payload, null))
        .filter((item) => item && typeof item === 'object');
    }
    const bucket = getMemCollection(col);
    return Array.from(bucket.values())
      .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
      .map((entry) => structuredClone(entry.payload));
  }

  async function ensureSeeded(collection, builderFn) {
    const seedMarkerKey = `seed:${collection}`;
    const alreadySeeded = await kvGet('_meta', seedMarkerKey);
    if (alreadySeeded) return;

    const existing = await kvList(collection);
    if (existing.length === 0) {
      const nowIso = new Date().toISOString();
      const defaults = builderFn(nowIso);
      for (const item of defaults) {
        await kvPut(collection, item.id, item);
      }
    }
    await kvPut('_meta', seedMarkerKey, { seededAt: new Date().toISOString() });
  }

  function hasReplyPermission(adminUser, adminProfile = null) {
    if (!adminUser) return false;
    if (isSuperAdminUserRecord(adminUser)) return true;
    const resolved = resolveSupportPermissions(adminUser, adminProfile, {
      rawPermissions: Array.isArray(adminProfile?.supportPermissions)
        ? adminProfile.supportPermissions
        : Array.isArray(adminProfile?.permissions)
          ? adminProfile.permissions
          : Array.isArray(adminUser?.permissions)
            ? adminUser.permissions
            : null
    });
    return resolved.isSuperAdmin || resolved.permissions.has('support.reply');
  }

  function computeTicketReplyAccess(ticket, { adminUser, adminProfile = null }) {
    const statusLower = String(ticket?.status || '').toLowerCase();
    if (statusLower === 'closed') {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Conversation is closed.'
      };
    }
    if (!hasReplyPermission(adminUser, adminProfile)) {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Read-only permission.'
      };
    }
    const actorId = String(adminUser?.id || '');
    const isSuper = isSuperAdminUserRecord(adminUser);
    const assignedId = ticket?.assignedAgentId ? String(ticket.assignedAgentId) : '';
    const pendingId = ticket?.pendingAssigneeId
      ? String(ticket.pendingAssigneeId)
      : ticket?.metadata?.pendingAssigneeId
        ? String(ticket.metadata.pendingAssigneeId)
        : '';
    const assignmentStatus = String(
      ticket?.assignmentStatus || ticket?.metadata?.assignmentStatus || ''
    ).toLowerCase();

    if (assignedId && (!actorId || assignedId !== actorId)) {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Handled by another specialist.'
      };
    }
    if (pendingId && pendingId !== actorId && !isSuper) {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Handled by another specialist.'
      };
    }
    if (assignmentStatus !== 'accepted' || !assignedId) {
      return {
        canReply: false,
        requiresAccept: true,
        unableReason: 'Unable to reply — Accept required first.'
      };
    }
    return {
      canReply: true,
      requiresAccept: false,
      unableReason: null
    };
  }

  function computeLiveChatReplyAccess(chat, { adminUser, adminProfile = null }) {
    const statusLower = String(chat?.status || '').toLowerCase();
    if (statusLower === 'closed' || statusLower === 'cancelled') {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Conversation is closed.'
      };
    }
    if (!hasReplyPermission(adminUser, adminProfile)) {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Read-only permission.'
      };
    }
    const actorId = String(adminUser?.id || '');
    const assignedId = chat?.assignedAgentId ? String(chat.assignedAgentId) : '';
    if (statusLower === 'active' && assignedId && (!actorId || assignedId !== actorId)) {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: 'Unable to reply — Handled by another specialist.'
      };
    }
    if (statusLower !== 'active' || !assignedId) {
      return {
        canReply: false,
        requiresAccept: true,
        unableReason: 'Unable to reply — Accept required first.'
      };
    }
    return {
      canReply: true,
      requiresAccept: false,
      unableReason: null
    };
  }

  // 1. Pre-Click Quick Peek (non-mutating)
  async function getQuickPeek({ kind, id, adminUser, adminProfile = null } = {}) {
    const rawKind = String(kind || '').trim().toLowerCase();
    const normalizedKind = rawKind === 'live_chat' || rawKind === 'chat' ? 'livechat' : rawKind;
    const targetId = String(id || '').trim();
    if (!['ticket', 'livechat'].includes(normalizedKind) || !targetId) {
      throw new SupportOpsHubError('Valid quick-peek kind ("ticket" or "livechat") and id are required.', {
        statusCode: 400,
        code: 'INVALID_QUICK_PEEK_PARAMS'
      });
    }

    if (normalizedKind === 'ticket') {
      const ticketing = getTicketing();
      try {
        const detail = await ticketing.getTicketDetail(targetId, {
          viewerType: 'admin',
          deskIsolation: false,
          adminUser,
          adminProfile
        });
        const messages = Array.isArray(detail?.messages) ? detail.messages : [];
        const replyAccess = computeTicketReplyAccess(detail.ticket, { adminUser, adminProfile });
        return {
          success: true,
          kind: 'ticket',
          ticket: detail.ticket,
          chat: null,
          recentMessages: messages.slice(-4),
          replyAccess
        };
      } catch (err) {
        if (err?.statusCode === 403 && !isSuperAdminUserRecord(adminUser)) {
          // Probe safely to distinguish isolated-to-another-specialist vs protected super-admin record
          const probe = await ticketing.getTicketDetail(targetId, {
            viewerType: 'admin',
            deskIsolation: false,
            adminUser: { id: '__ops_peek_probe__', role: 'super_admin' }
          });
          const ownerEmail = String(probe?.ticket?.userEmail || probe?.ticket?.guestEmail || '')
            .trim()
            .toLowerCase();
          if (ownerEmail === 'tiwloltd@gmail.com') {
            throw err;
          }
          const summaryTicket = {
            id: probe.ticket.id,
            ticketId: probe.ticket.ticketId,
            serialNumber: probe.ticket.serialNumber,
            subject: probe.ticket.subject,
            status: probe.ticket.status,
            priority: probe.ticket.priority,
            category: probe.ticket.category,
            department: probe.ticket.department,
            assignedAgentId: probe.ticket.assignedAgentId,
            assignedAgentName: probe.ticket.assignedAgentName,
            assignmentStatus: probe.ticket.assignmentStatus,
            createdAt: probe.ticket.createdAt,
            updatedAt: probe.ticket.updatedAt
          };
          const closed = String(summaryTicket.status || '').toLowerCase() === 'closed';
          return {
            success: true,
            kind: 'ticket',
            ticket: summaryTicket,
            chat: null,
            recentMessages: [],
            replyAccess: {
              canReply: false,
              requiresAccept: false,
              unableReason: closed
                ? 'Unable to reply — Conversation is closed.'
                : !hasReplyPermission(adminUser, adminProfile)
                  ? 'Unable to reply — Read-only permission.'
                  : 'Unable to reply — Handled by another specialist.'
            }
          };
        }
        throw err;
      }
    }

    // Live Chat Quick Peek
    const liveChat = getLiveChat();
    try {
      const detail = await liveChat.getAdminLiveChatDetail(targetId, adminUser, {
        deskIsolation: false
      });
      const messages = Array.isArray(detail?.messages) ? detail.messages : [];
      const replyAccess = computeLiveChatReplyAccess(detail.chat, { adminUser, adminProfile });
      return {
        success: true,
        kind: 'livechat',
        ticket: null,
        chat: detail.chat,
        recentMessages: messages.slice(-4),
        replyAccess
      };
    } catch (err) {
      if (err?.statusCode === 403 && !isSuperAdminUserRecord(adminUser)) {
        const probe = await liveChat.getAdminLiveChatDetail(
          targetId,
          { id: '__ops_peek_probe__', role: 'super_admin', isSuperAdmin: true },
          { deskIsolation: false }
        );
        const summaryChat = {
          id: probe.chat.id,
          chatNumber: probe.chat.chatNumber,
          topic: probe.chat.topic,
          department: probe.chat.department,
          status: probe.chat.status,
          guestName: probe.chat.guestName,
          assignedAgentId: probe.chat.assignedAgentId,
          assignedAgentName: probe.chat.assignedAgentName,
          joinedAt: probe.chat.joinedAt,
          lastMessageAt: probe.chat.lastMessageAt
        };
        const closed = ['closed', 'cancelled'].includes(String(summaryChat.status || '').toLowerCase());
        return {
          success: true,
          kind: 'livechat',
          ticket: null,
          chat: summaryChat,
          recentMessages: [],
          replyAccess: {
            canReply: false,
            requiresAccept: false,
            unableReason: closed
              ? 'Unable to reply — Conversation is closed.'
              : !hasReplyPermission(adminUser, adminProfile)
                ? 'Unable to reply — Read-only permission.'
                : 'Unable to reply — Handled by another specialist.'
          }
        };
      }
      throw err;
    }
  }

  // 2. Outbound Staff Ticket Creation
  async function createOutboundTicket({
    customerName,
    customerEmail,
    customerPhone = '',
    subject,
    description = '',
    priority = 'medium',
    category = 'General Inquiry',
    department = 'Customer Support',
    assignToSelf = true,
    adminUser,
    adminProfile = null,
    req = null
  } = {}) {
    const cleanName = String(customerName || '').trim();
    const cleanEmail = String(customerEmail || '').trim().toLowerCase();
    const cleanSubject = String(subject || '').trim();
    const cleanDesc = String(description || '').trim();

    if (cleanName.length < 2) {
      throw new SupportOpsHubError('Customer name is required (at least 2 characters).', {
        statusCode: 400,
        code: 'CUSTOMER_NAME_REQUIRED'
      });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      throw new SupportOpsHubError('A valid customer email address is required.', {
        statusCode: 400,
        code: 'VALID_EMAIL_REQUIRED'
      });
    }
    if (!cleanSubject) {
      throw new SupportOpsHubError('Ticket subject is required.', {
        statusCode: 400,
        code: 'SUBJECT_REQUIRED'
      });
    }

    let matchedUser = null;
    if (isUsingPg()) {
      try {
        const { rows } = await queryPgFn(
          `SELECT id, name, store_name, email, avatar, tiwi_id, store_id
           FROM system_users
           WHERE LOWER(email) = LOWER($1)
           LIMIT 1`,
          [cleanEmail]
        );
        if (rows?.[0]) {
          matchedUser = {
            id: rows[0].id,
            name: rows[0].name || rows[0].store_name || cleanName,
            email: rows[0].email || cleanEmail,
            avatar: rows[0].avatar || null,
            tiwiId: rows[0].tiwi_id || null,
            storeId: rows[0].store_id || null,
            storeName: rows[0].store_name || null
          };
        }
      } catch {
        // Ignore if system_users table is absent in isolated tests
      }
    }
    const masterDb = getMasterDb();
    if (!matchedUser && typeof masterDb?.findUserByIdentifier === 'function') {
      try {
        const found = await masterDb.findUserByIdentifier(cleanEmail);
        if (found?.id) {
          matchedUser = {
            id: found.id,
            name: found.name || found.storeName || cleanName,
            email: found.email || cleanEmail,
            avatar: found.avatar || null,
            tiwiId: found.tiwiId || null,
            storeId: found.storeId || null,
            storeName: found.storeName || null
          };
        }
      } catch {
        // Non-fatal
      }
    }

    const ticketing = getTicketing();
    const cleanPhoneRaw = String(customerPhone || '').trim();
    const safeGuestPhone = cleanPhoneRaw && /\d{7,}/.test(cleanPhoneRaw.replace(/\D/g, ''))
      ? cleanPhoneRaw
      : '+8801700000000';

    let guestSession = null;
    if (!matchedUser) {
      const createdSess = await ticketing.createOrUpdateGuestSession({
        guestName: cleanName,
        guestEmail: cleanEmail,
        guestPhone: safeGuestPhone,
        req
      });
      guestSession = createdSess.session;
    }

    const created = await ticketing.createTicket({
      authUser: matchedUser,
      guestSession,
      guestContact: matchedUser
        ? null
        : {
            guestName: cleanName,
            guestEmail: cleanEmail,
            guestPhone: safeGuestPhone
          },
      req,
      subject: cleanSubject,
      description: cleanDesc || cleanSubject,
      category: category || 'General Inquiry',
      department: department || 'Customer Support',
      priority: priority || 'medium',
      channel: 'outbound_staff',
      metadata: {
        outboundCreatedByStaffId: adminUser?.id ? String(adminUser.id) : null,
        outboundCreatedByStaffName: adminUser?.name || adminUser?.email || 'Support Specialist'
      }
    });

    let finalTicket = created.ticket;
    if (assignToSelf && adminUser?.id) {
      finalTicket = await ticketing.acceptTicketAssignment({
        ticketIdOrKey: created.ticket.id,
        adminUser,
        adminProfile
      });
    } else {
      const detail = await ticketing.getTicketDetail(created.ticket.id, {
        viewerType: 'admin',
        adminUser,
        adminProfile
      });
      finalTicket = detail.ticket;
    }

    return { success: true, ticket: finalTicket };
  }

  // 3. Staff Workspace Preferences
  function sanitizePreferences(existing, patch = {}) {
    const base = { ...DEFAULT_STAFF_PREFERENCES, ...existing };
    const raw =
      patch?.preferences && typeof patch.preferences === 'object'
        ? { ...patch, ...patch.preferences }
        : { ...patch };

    const ringDur = Number(raw.ringDurationSeconds);
    if ([5, 10, 15].includes(ringDur)) base.ringDurationSeconds = ringDur;

    if (typeof raw.vibrationEnabled === 'boolean') base.vibrationEnabled = raw.vibrationEnabled;
    if (typeof raw.quietHoursEnabled === 'boolean') base.quietHoursEnabled = raw.quietHoursEnabled;
    if (typeof raw.quietHoursStart === 'string' && raw.quietHoursStart.trim()) {
      base.quietHoursStart = raw.quietHoursStart.trim().slice(0, 10);
    }
    if (typeof raw.quietHoursEnd === 'string' && raw.quietHoursEnd.trim()) {
      base.quietHoursEnd = raw.quietHoursEnd.trim().slice(0, 10);
    }
    if (typeof raw.requirePinOnLaunch === 'boolean') base.requirePinOnLaunch = raw.requirePinOnLaunch;

    const autoLock = Number(raw.autoLockMinutes);
    if ([0, 1, 5, 15].includes(autoLock)) base.autoLockMinutes = autoLock;

    if (typeof raw.signatureText === 'string') base.signatureText = raw.signatureText.slice(0, 500);
    if (typeof raw.autoAppendSignature === 'boolean') base.autoAppendSignature = raw.autoAppendSignature;

    if (['public', 'internal'].includes(raw.defaultReplyMode)) {
      base.defaultReplyMode = raw.defaultReplyMode;
    }
    if (['warm_brand', 'concise_technical', 'empathetic_apology'].includes(raw.aiPreferredTone)) {
      base.aiPreferredTone = raw.aiPreferredTone;
    }
    if (typeof raw.preClickPreviewEnabled === 'boolean') {
      base.preClickPreviewEnabled = raw.preClickPreviewEnabled;
    }
    if (['comfortable', 'compact'].includes(raw.uiDensity)) {
      base.uiDensity = raw.uiDensity;
    }
    if (typeof raw.selectiveBorders === 'boolean') base.selectiveBorders = raw.selectiveBorders;
    if (['home', 'tickets', 'livechat'].includes(raw.defaultLandingTab)) {
      base.defaultLandingTab = raw.defaultLandingTab;
    }
    if (raw.dailyResolvedGoal !== undefined && Number.isFinite(Number(raw.dailyResolvedGoal))) {
      base.dailyResolvedGoal = Math.min(500, Math.max(1, Math.round(Number(raw.dailyResolvedGoal))));
    }

    return base;
  }

  async function getStaffPreferences(staffId) {
    const key = String(staffId || '').trim();
    if (!key) {
      throw new SupportOpsHubError('Authenticated staff ID is required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const stored = await kvGet('staff_preferences', key);
    const preferences = sanitizePreferences(stored, {});
    return { success: true, preferences };
  }

  async function updateStaffPreferences(staffId, patch = {}) {
    const key = String(staffId || '').trim();
    if (!key) {
      throw new SupportOpsHubError('Authenticated staff ID is required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const stored = await kvGet('staff_preferences', key);
    const preferences = sanitizePreferences(stored, patch);
    await kvPut('staff_preferences', key, preferences);
    return { success: true, preferences };
  }

  // 4. Knowledge Base Articles
  async function listKbArticles({ q = '', category = '', visibility = '' } = {}) {
    await ensureSeeded('kb_articles', buildDefaultKbArticles);
    const all = await kvList('kb_articles');
    const query = String(q || '').trim().toLowerCase();
    const catLower = String(category || '').trim().toLowerCase();
    const visLower = String(visibility || '').trim().toLowerCase();

    const articles = all
      .filter((a) => {
        if (catLower && catLower !== 'all' && String(a.category || '').toLowerCase() !== catLower) return false;
        if (visLower && visLower !== 'all' && String(a.visibility || '').toLowerCase() !== visLower) return false;
        if (query) {
          const hay = [
            a.title,
            a.summary,
            a.content,
            a.category,
            ...(Array.isArray(a.tags) ? a.tags : [])
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
        return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
      });

    return { success: true, articles };
  }

  async function getKbArticle(id, { incrementView = true } = {}) {
    await ensureSeeded('kb_articles', buildDefaultKbArticles);
    const key = String(id || '').trim();
    const existing = await kvGet('kb_articles', key);
    if (!existing) {
      throw new SupportOpsHubError('Knowledge base article not found.', { statusCode: 404, code: 'KB_NOT_FOUND' });
    }
    if (incrementView) {
      existing.viewsCount = Number(existing.viewsCount || 0) + 1;
      await kvPut('kb_articles', key, existing);
    }
    return { success: true, article: existing };
  }

  async function createKbArticle(payload = {}, adminUser = null) {
    await ensureSeeded('kb_articles', buildDefaultKbArticles);
    const title = String(payload.title || '').trim().slice(0, 200);
    const content = String(payload.content || '').trim().slice(0, 50000);
    if (!title || !content) {
      throw new SupportOpsHubError('Article title and content are required.', {
        statusCode: 400,
        code: 'KB_INVALID_INPUT'
      });
    }
    const nowIso = new Date().toISOString();
    const visibility = payload.visibility === 'public' ? 'public' : 'internal';
    const summary = String(payload.summary || content.slice(0, 180)).trim().slice(0, 400);
    const article = {
      id: `kb_${randomUUID()}`,
      title,
      slug: slugify(title, 'kb-article'),
      category: String(payload.category || 'General').trim().slice(0, 80) || 'General',
      visibility,
      summary,
      content,
      tags: normalizeStringArray(payload.tags, 15, 40),
      pinned: Boolean(payload.pinned),
      viewsCount: 0,
      helpfulCount: 0,
      authorId: adminUser?.id ? String(adminUser.id) : null,
      authorName: String(adminUser?.name || adminUser?.email || 'Support Specialist').slice(0, 120),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await kvPut('kb_articles', article.id, article);
    return { success: true, article };
  }

  async function updateKbArticle(id, payload = {}) {
    await ensureSeeded('kb_articles', buildDefaultKbArticles);
    const key = String(id || '').trim();
    const existing = await kvGet('kb_articles', key);
    if (!existing) {
      throw new SupportOpsHubError('Knowledge base article not found.', { statusCode: 404, code: 'KB_NOT_FOUND' });
    }
    const next = { ...existing };
    if (payload.title !== undefined) {
      const t = String(payload.title || '').trim().slice(0, 200);
      if (!t) {
        throw new SupportOpsHubError('Article title cannot be empty.', { statusCode: 400, code: 'KB_INVALID_INPUT' });
      }
      next.title = t;
      next.slug = slugify(t, 'kb-article');
    }
    if (payload.content !== undefined) {
      const c = String(payload.content || '').trim().slice(0, 50000);
      if (!c) {
        throw new SupportOpsHubError('Article content cannot be empty.', { statusCode: 400, code: 'KB_INVALID_INPUT' });
      }
      next.content = c;
    }
    if (payload.summary !== undefined) next.summary = String(payload.summary || '').trim().slice(0, 400);
    if (payload.category !== undefined) next.category = String(payload.category || 'General').trim().slice(0, 80);
    if (payload.visibility !== undefined) {
      next.visibility = payload.visibility === 'public' ? 'public' : 'internal';
    }
    if (payload.tags !== undefined) next.tags = normalizeStringArray(payload.tags, 15, 40);
    if (payload.pinned !== undefined) next.pinned = Boolean(payload.pinned);
    next.updatedAt = new Date().toISOString();

    await kvPut('kb_articles', key, next);
    return { success: true, article: next };
  }

  async function deleteKbArticle(id) {
    await ensureSeeded('kb_articles', buildDefaultKbArticles);
    const key = String(id || '').trim();
    const existed = await kvDelete('kb_articles', key);
    if (!existed) {
      throw new SupportOpsHubError('Knowledge base article not found.', { statusCode: 404, code: 'KB_NOT_FOUND' });
    }
    return { success: true };
  }

  async function markKbArticleHelpful(id) {
    await ensureSeeded('kb_articles', buildDefaultKbArticles);
    const key = String(id || '').trim();
    const existing = await kvGet('kb_articles', key);
    if (!existing) {
      throw new SupportOpsHubError('Knowledge base article not found.', { statusCode: 404, code: 'KB_NOT_FOUND' });
    }
    existing.helpfulCount = Number(existing.helpfulCount || 0) + 1;
    await kvPut('kb_articles', key, existing);
    return { success: true, article: existing };
  }

  // 5. Major Incidents & Outage Broadcasts
  async function listIncidents({ status = '' } = {}) {
    const all = await kvList('incidents');
    const filterStatus = String(status || '').trim().toLowerCase();
    const incidents = all
      .filter((inc) => {
        if (!filterStatus || filterStatus === 'all') return true;
        if (filterStatus === 'open' || filterStatus === 'active') return inc.status !== 'resolved';
        return String(inc.status || '').toLowerCase() === filterStatus;
      })
      .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return { success: true, incidents };
  }

  async function createIncident(payload = {}, adminUser = null) {
    const title = String(payload.title || '').trim().slice(0, 200);
    const summary = String(payload.summary || '').trim().slice(0, 2000);
    if (!title) {
      throw new SupportOpsHubError('Incident title is required.', { statusCode: 400, code: 'INCIDENT_TITLE_REQUIRED' });
    }
    const severity = ['minor', 'major', 'critical'].includes(payload.severity) ? payload.severity : 'major';
    const status = ['investigating', 'identified', 'monitoring', 'resolved'].includes(payload.status)
      ? payload.status
      : 'investigating';
    const existing = await kvList('incidents');
    const maxNum = existing.reduce((acc, item) => {
      const m = String(item.code || '').match(/INC-(\d+)/i);
      const n = m ? Number.parseInt(m[1], 10) : 100;
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 100);
    const code = `INC-${maxNum + 1}`;
    const nowIso = new Date().toISOString();
    const authorName = String(adminUser?.name || adminUser?.email || 'Incident Commander').slice(0, 120);

    const incident = {
      id: `inc_${randomUUID()}`,
      code,
      title,
      severity,
      status,
      summary: summary || title,
      affectedComponents: normalizeStringArray(payload.affectedComponents, 20, 80),
      linkedTicketIds: normalizeStringArray(payload.linkedTicketIds, 100, 80),
      broadcastCount: 0,
      updates: [
        {
          id: `incupd_${randomUUID()}`,
          status,
          message: summary || `Incident opened: ${title}`,
          authorName,
          createdAt: nowIso
        }
      ],
      createdByName: authorName,
      resolvedAt: status === 'resolved' ? nowIso : null,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await kvPut('incidents', incident.id, incident);
    return { success: true, incident };
  }

  async function addIncidentUpdate(incidentId, payload = {}, adminUser = null) {
    const key = String(incidentId || '').trim();
    const existing = await kvGet('incidents', key);
    if (!existing) {
      throw new SupportOpsHubError('Incident not found.', { statusCode: 404, code: 'INCIDENT_NOT_FOUND' });
    }
    const message = String(payload.message || '').trim().slice(0, 2000);
    if (!message) {
      throw new SupportOpsHubError('Update message is required.', { statusCode: 400, code: 'MESSAGE_REQUIRED' });
    }
    const nextStatus = ['investigating', 'identified', 'monitoring', 'resolved'].includes(payload.status)
      ? payload.status
      : existing.status;
    const nowIso = new Date().toISOString();
    const authorName = String(adminUser?.name || adminUser?.email || 'Incident Commander').slice(0, 120);

    const updateEntry = {
      id: `incupd_${randomUUID()}`,
      status: nextStatus,
      message,
      authorName,
      createdAt: nowIso
    };
    existing.status = nextStatus;
    existing.updates = [...(Array.isArray(existing.updates) ? existing.updates : []), updateEntry];
    if (nextStatus === 'resolved') {
      existing.resolvedAt = existing.resolvedAt || nowIso;
    } else {
      existing.resolvedAt = null;
    }
    existing.updatedAt = nowIso;
    await kvPut('incidents', key, existing);
    return { success: true, incident: existing };
  }

  async function broadcastIncidentUpdate(incidentId, payload = {}, adminUser = null) {
    const key = String(incidentId || '').trim();
    const existing = await kvGet('incidents', key);
    if (!existing) {
      throw new SupportOpsHubError('Incident not found.', { statusCode: 404, code: 'INCIDENT_NOT_FOUND' });
    }
    const message = String(payload.message || '').trim().slice(0, 2000);
    if (!message) {
      throw new SupportOpsHubError('Broadcast message is required.', { statusCode: 400, code: 'MESSAGE_REQUIRED' });
    }

    const targetFilter = payload.targetFilter || 'open_tickets';
    const explicitIds = Array.isArray(payload.ticketIds) ? payload.ticketIds.map((x) => String(x).trim()).filter(Boolean) : [];
    let matchedTickets = [];

    try {
      const ticketing = getTicketing();
      const { tickets = [] } = await ticketing.listAdminTickets({
        limit: 200,
        excludeDismissed: false,
        adminUser: { id: adminUser?.id || 'system_incident', name: adminUser?.name || 'Incident Broadcast', role: 'super_admin' }
      });

      if (explicitIds.length > 0) {
        const idSet = new Set(explicitIds.map((x) => x.toLowerCase()));
        matchedTickets = tickets.filter((t) =>
          idSet.has(String(t.id || '').toLowerCase()) ||
          idSet.has(String(t.ticketId || '').toLowerCase()) ||
          idSet.has(String(t.serialNumber || '').toLowerCase())
        );
      } else if (targetFilter === 'linked_only') {
        const linkedSet = new Set((existing.linkedTicketIds || []).map((x) => String(x).toLowerCase()));
        matchedTickets = tickets.filter((t) =>
          linkedSet.has(String(t.id || '').toLowerCase()) ||
          linkedSet.has(String(t.ticketId || '').toLowerCase()) ||
          linkedSet.has(String(t.serialNumber || '').toLowerCase())
        );
      } else if (targetFilter === 'escalated_tickets') {
        matchedTickets = tickets.filter((t) => String(t.status || '').toLowerCase() === 'escalated');
      } else {
        matchedTickets = tickets.filter(
          (t) => !['resolved', 'closed'].includes(String(t.status || '').toLowerCase())
        );
      }

      for (const t of matchedTickets) {
        await ticketing.addTicketReply({
          ticketIdOrKey: t.id,
          message: `[Incident Broadcast · ${existing.code}] ${message}`,
          isInternal: true,
          actorType: 'admin',
          adminUser: adminUser || { id: 'system_incident', name: 'Incident Broadcast', role: 'super_admin' }
        }).catch(() => {});
      }
    } catch {
      // Best-effort ticket note broadcast
    }

    const nowIso = new Date().toISOString();
    const authorName = String(adminUser?.name || adminUser?.email || 'Incident Commander').slice(0, 120);
    const notifiedCount = matchedTickets.length;

    existing.broadcastCount = Number(existing.broadcastCount || 0) + 1;
    const mergedLinked = new Set([
      ...(Array.isArray(existing.linkedTicketIds) ? existing.linkedTicketIds : []),
      ...matchedTickets.map((t) => t.serialNumber || t.id)
    ]);
    existing.linkedTicketIds = Array.from(mergedLinked).slice(0, 100);
    existing.updates = [
      ...(Array.isArray(existing.updates) ? existing.updates : []),
      {
        id: `incupd_${randomUUID()}`,
        status: existing.status,
        message: `[Broadcast to ${notifiedCount} ticket(s)] ${message}`,
        authorName,
        createdAt: nowIso
      }
    ];
    existing.updatedAt = nowIso;

    await kvPut('incidents', key, existing);
    return { success: true, notifiedCount, incident: existing };
  }

  // 6. Shift Handovers
  async function listShiftHandovers() {
    const all = await kvList('shift_handovers');
    const handovers = all.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return { success: true, handovers };
  }

  async function createShiftHandover(payload = {}, adminUser = null) {
    const headline = String(payload.headline || '').trim().slice(0, 200);
    const summary = String(payload.summary || '').trim().slice(0, 4000);
    if (!headline || !summary) {
      throw new SupportOpsHubError('Shift handover headline and summary are required.', {
        statusCode: 400,
        code: 'HANDOVER_INVALID_INPUT'
      });
    }
    const shiftType = ['morning', 'evening', 'night'].includes(payload.shiftType)
      ? payload.shiftType
      : 'morning';
    const nowIso = new Date().toISOString();
    const handover = {
      id: `shf_${randomUUID()}`,
      shiftType,
      headline,
      summary,
      blockers: String(payload.blockers || '').trim().slice(0, 2000),
      watchTicketIds: normalizeStringArray(payload.watchTicketIds, 30, 60),
      createdById: String(adminUser?.id || 'staff'),
      createdByName: String(adminUser?.name || adminUser?.email || 'Support Specialist').slice(0, 120),
      createdByAvatar: adminUser?.avatar || null,
      acknowledgedBy: [],
      createdAt: nowIso
    };
    await kvPut('shift_handovers', handover.id, handover);
    return { success: true, handover };
  }

  async function acknowledgeShiftHandover(id, adminUser = null) {
    const key = String(id || '').trim();
    const existing = await kvGet('shift_handovers', key);
    if (!existing) {
      throw new SupportOpsHubError('Shift handover not found.', { statusCode: 404, code: 'HANDOVER_NOT_FOUND' });
    }
    const staffId = String(adminUser?.id || '').trim();
    if (!staffId) {
      throw new SupportOpsHubError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const staffName = String(adminUser?.name || adminUser?.email || 'Support Specialist').slice(0, 120);
    const acks = Array.isArray(existing.acknowledgedBy) ? [...existing.acknowledgedBy] : [];
    if (!acks.some((a) => String(a.staffId) === staffId)) {
      acks.push({
        staffId,
        staffName,
        at: new Date().toISOString()
      });
      existing.acknowledgedBy = acks;
      await kvPut('shift_handovers', key, existing);
    }
    return { success: true, handover: existing };
  }

  // 7. Internal Team Wall
  async function listTeamWallPosts() {
    const all = await kvList('team_wall');
    const posts = all.sort((a, b) => {
      if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
      return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
    });
    return { success: true, posts };
  }

  async function createTeamWallPost(payload = {}, adminUser = null, adminProfile = null) {
    const body = String(payload.body || '').trim().slice(0, 4000);
    if (!body) {
      throw new SupportOpsHubError('Post body is required.', { statusCode: 400, code: 'BODY_REQUIRED' });
    }
    const category = ['announcement', 'urgent', 'tip', 'shoutout'].includes(payload.category)
      ? payload.category
      : 'announcement';
    const nowIso = new Date().toISOString();
    const post = {
      id: `wall_${randomUUID()}`,
      category,
      body,
      ticketRefs: extractTicketRefs(body),
      pinned: Boolean(payload.pinned),
      authorId: String(adminUser?.id || 'staff'),
      authorName: String(adminUser?.name || adminUser?.email || 'Support Specialist').slice(0, 120),
      authorAvatar: adminUser?.avatar || null,
      authorRole: String(adminProfile?.roleKey || adminUser?.role || 'Support Staff').slice(0, 64),
      reactions: {},
      createdAt: nowIso
    };
    await kvPut('team_wall', post.id, post);
    return { success: true, post };
  }

  async function togglePinTeamWallPost(id) {
    const key = String(id || '').trim();
    const existing = await kvGet('team_wall', key);
    if (!existing) {
      throw new SupportOpsHubError('Team wall post not found.', { statusCode: 404, code: 'POST_NOT_FOUND' });
    }
    existing.pinned = !existing.pinned;
    await kvPut('team_wall', key, existing);
    return { success: true, post: existing };
  }

  async function reactTeamWallPost(id, { emoji } = {}, adminUser = null) {
    const key = String(id || '').trim();
    const cleanEmoji = String(emoji || '').trim().slice(0, 16);
    if (!cleanEmoji) {
      throw new SupportOpsHubError('Emoji is required.', { statusCode: 400, code: 'EMOJI_REQUIRED' });
    }
    const staffId = String(adminUser?.id || '').trim();
    if (!staffId) {
      throw new SupportOpsHubError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const existing = await kvGet('team_wall', key);
    if (!existing) {
      throw new SupportOpsHubError('Team wall post not found.', { statusCode: 404, code: 'POST_NOT_FOUND' });
    }
    const reactions = existing.reactions && typeof existing.reactions === 'object' ? { ...existing.reactions } : {};
    const currentUsers = Array.isArray(reactions[cleanEmoji]) ? reactions[cleanEmoji].map(String) : [];
    if (currentUsers.includes(staffId)) {
      const filtered = currentUsers.filter((u) => u !== staffId);
      if (filtered.length === 0) {
        delete reactions[cleanEmoji];
      } else {
        reactions[cleanEmoji] = filtered;
      }
    } else {
      reactions[cleanEmoji] = [...currentUsers, staffId];
    }
    existing.reactions = reactions;
    await kvPut('team_wall', key, existing);
    return { success: true, post: existing };
  }

  async function deleteTeamWallPost(id) {
    const key = String(id || '').trim();
    const deleted = await kvDelete('team_wall', key);
    if (!deleted) {
      throw new SupportOpsHubError('Team wall post not found.', { statusCode: 404, code: 'POST_NOT_FOUND' });
    }
    return { success: true };
  }

  // 8. Tier-2 Escalations & Action Approvals
  async function listApprovals({ status = '' } = {}) {
    const all = await kvList('approvals');
    const filterStatus = String(status || '').trim().toLowerCase();
    const approvals = all
      .filter((item) => !filterStatus || filterStatus === 'all' || item.status === filterStatus)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return { success: true, approvals };
  }

  async function createApprovalRequest(payload = {}, adminUser = null) {
    const customerName = String(payload.customerName || '').trim().slice(0, 160);
    const reason = String(payload.reason || '').trim().slice(0, 2000);
    if (!customerName || !reason) {
      throw new SupportOpsHubError('Customer name and reason are required for an approval request.', {
        statusCode: 400,
        code: 'APPROVAL_INVALID_INPUT'
      });
    }
    const validTypes = ['refund', 'credit', 'account_unlock', 'sla_override', 'tier2_escalation'];
    const requestType = validTypes.includes(payload.requestType) ? payload.requestType : 'tier2_escalation';
    const nowIso = new Date().toISOString();
    const approval = {
      id: `apr_${randomUUID()}`,
      requestType,
      ticketId: payload.ticketId ? String(payload.ticketId).trim().slice(0, 80) : null,
      ticketSerial: payload.ticketSerial ? String(payload.ticketSerial).trim().slice(0, 40) : null,
      customerName,
      amountLabel: payload.amountLabel ? String(payload.amountLabel).trim().slice(0, 64) : null,
      reason,
      status: 'pending',
      requestedById: String(adminUser?.id || 'staff'),
      requestedByName: String(adminUser?.name || adminUser?.email || 'Support Specialist').slice(0, 120),
      decidedByName: null,
      decisionNote: null,
      decidedAt: null,
      createdAt: nowIso
    };
    await kvPut('approvals', approval.id, approval);
    return { success: true, approval };
  }

  async function decideApprovalRequest(id, { decision, decisionNote = '' } = {}, adminUser = null) {
    const key = String(id || '').trim();
    if (!['approved', 'rejected'].includes(decision)) {
      throw new SupportOpsHubError('Decision must be "approved" or "rejected".', {
        statusCode: 400,
        code: 'INVALID_DECISION'
      });
    }
    const existing = await kvGet('approvals', key);
    if (!existing) {
      throw new SupportOpsHubError('Approval request not found.', { statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    }
    existing.status = decision;
    existing.decidedByName = String(adminUser?.name || adminUser?.email || 'Lead Reviewer').slice(0, 120);
    existing.decisionNote = decisionNote ? String(decisionNote).trim().slice(0, 1000) : null;
    existing.decidedAt = new Date().toISOString();
    await kvPut('approvals', key, existing);
    return { success: true, approval: existing };
  }

  // 9. QA Reviews & Coaching Scorecards
  function computeQaSummary(reviews) {
    const totalReviews = reviews.length;
    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        averagePct: 0,
        avgTone: 0,
        avgAccuracy: 0,
        avgBrand: 0,
        avgSpeed: 0
      };
    }
    const sumPct = reviews.reduce((s, r) => s + Number(r.overallPct || 0), 0);
    const sumTone = reviews.reduce((s, r) => s + Number(r.toneScore || 0), 0);
    const sumAcc = reviews.reduce((s, r) => s + Number(r.accuracyScore || 0), 0);
    const sumBrand = reviews.reduce((s, r) => s + Number(r.brandScore || 0), 0);
    const sumSpeed = reviews.reduce((s, r) => s + Number(r.speedScore || 0), 0);
    return {
      totalReviews,
      averagePct: Math.round(sumPct / totalReviews),
      avgTone: Number((sumTone / totalReviews).toFixed(1)),
      avgAccuracy: Number((sumAcc / totalReviews).toFixed(1)),
      avgBrand: Number((sumBrand / totalReviews).toFixed(1)),
      avgSpeed: Number((sumSpeed / totalReviews).toFixed(1))
    };
  }

  async function listQaReviews() {
    const all = await kvList('qa_reviews');
    const reviews = all.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    const summary = computeQaSummary(reviews);
    return { success: true, reviews, summary };
  }

  async function createQaReview(payload = {}, adminUser = null) {
    const targetId = String(payload.targetId || payload.targetSerial || '').trim().slice(0, 80);
    const agentName = String(payload.agentName || '').trim().slice(0, 120);
    if (!targetId || !agentName) {
      throw new SupportOpsHubError('Target ID and agent name are required for QA scorecards.', {
        statusCode: 400,
        code: 'QA_INVALID_INPUT'
      });
    }
    const clampScore = (v) => Math.min(5, Math.max(1, Math.round(Number(v) || 5)));
    const toneScore = clampScore(payload.toneScore);
    const accuracyScore = clampScore(payload.accuracyScore);
    const brandScore = clampScore(payload.brandScore);
    const speedScore = clampScore(payload.speedScore);
    const overallPct = Math.round(((toneScore + accuracyScore + brandScore + speedScore) / 20) * 100);

    const review = {
      id: `qa_${randomUUID()}`,
      targetType: payload.targetType === 'livechat' ? 'livechat' : 'ticket',
      targetId,
      targetSerial: String(payload.targetSerial || targetId).trim().slice(0, 40),
      agentId: payload.agentId ? String(payload.agentId).trim().slice(0, 64) : null,
      agentName,
      reviewerName: String(adminUser?.name || adminUser?.email || 'QA Reviewer').slice(0, 120),
      toneScore,
      accuracyScore,
      brandScore,
      speedScore,
      overallPct,
      coachingNote: String(payload.coachingNote || '').trim().slice(0, 2000),
      createdAt: new Date().toISOString()
    };
    await kvPut('qa_reviews', review.id, review);
    const { reviews, summary } = await listQaReviews();
    return { success: true, review, summary, totalReviews: reviews.length };
  }

  // 10. AI Copilot Playground
  function buildPlaygroundPrompt({ task, input, customerName = 'Customer' }) {
    const baseHeader = [
      'You are Tiwlo Support AI Copilot assisting an internal customer support specialist.',
      'Follow Tiwlo Brand Guidelines: warm, clear, trustworthy, accurate, and respectful.',
      'Never invent unverified refunds, credentials, or internal URLs. Output ONLY the requested text without markdown code fences.'
    ].join('\n');

    const promptsByTask = {
      draft_reply: `Draft a complete, polite Tiwlo Customer Support reply to ${customerName} addressing the following inquiry or notes:\n"""\n${input}\n"""`,
      polish: `Polish and refine the following support specialist draft for ${customerName} while keeping every factual detail intact:\n"""\n${input}\n"""`,
      translate_bn: `Translate the following support message into natural, polite Bengali suitable for Tiwlo Customer Support:\n"""\n${input}\n"""`,
      translate_en: `Translate the following message into clear, natural English suitable for Tiwlo Customer Support:\n"""\n${input}\n"""`,
      summarize: `Summarize the following customer support conversation or issue in 3 concise bullet points (Issue, Context, Next Action):\n"""\n${input}\n"""`,
      empathetic: `Rewrite the following message to ${customerName} with calm, empathetic reassurance while keeping clear next steps:\n"""\n${input}\n"""`,
      kb_draft: `Turn the following support resolution notes into a structured Knowledge Base article draft (Title, Summary, and Step-by-Step Resolution):\n"""\n${input}\n"""`
    };

    return `${baseHeader}\n\n${promptsByTask[task] || promptsByTask.draft_reply}`;
  }

  function buildLocalFallbackAiOutput({ task, input, customerName = 'Valued Customer' }) {
    const clean = String(input || '').trim();
    const name = String(customerName || 'Valued Customer').trim() || 'Valued Customer';
    switch (task) {
      case 'translate_bn':
        return `প্রিয় ${name},\nTiwlo সাপোর্টে যোগাযোগ করার জন্য ধন্যবাদ। আপনার বার্তাটি আমরা পেয়েছি এবং বিষয়টি গুরুত্বের সাথে যাচাই করছি:\n"${clean}"\nখুব শীঘ্রই আপনাকে আপডেট জানানো হবে।\nশুভেচ্ছান্তে,\nTiwlo Support Team`;
      case 'translate_en':
        return `Hello ${name},\n\nThank you for contacting Tiwlo Support. Here is the English summary of the message:\n"${clean}"\n\nPlease let us know if we can assist you further.\n\nBest regards,\nTiwlo Support Team`;
      case 'summarize':
        return [
          `• Issue: ${clean.slice(0, 140)}${clean.length > 140 ? '...' : ''}`,
          `• Customer: ${name}`,
          '• Recommended Next Action: Verify account/order telemetry in Customer 360 and provide a clear resolution update.'
        ].join('\n');
      case 'empathetic':
        return `Hello ${name},\n\nWe completely understand how important this is for your store operations, and we appreciate your patience. ${clean}\n\nWe are actively prioritizing this for you and will keep you updated every step of the way.\n\nWarm regards,\nTiwlo Customer Support`;
      case 'kb_draft':
        return [
          `Title: Resolution Guide — ${clean.slice(0, 60)}`,
          '',
          `Summary: Standard operating steps for resolving inquiries related to "${clean.slice(0, 100)}".`,
          '',
          'Steps:',
          '1. Inspect customer account & store context in Customer 360.',
          `2. Verify details: ${clean}`,
          '3. Confirm resolution with the customer and document internal notes.'
        ].join('\n');
      case 'polish':
        return `Hello ${name},\n\nThank you for reaching out to Tiwlo Support. ${clean}\n\nPlease let us know if you have any additional questions—we are happy to help!\n\nBest regards,\nTiwlo Support Team`;
      case 'draft_reply':
      default:
        return `Hello ${name},\n\nThank you for contacting Tiwlo Customer Support! We have reviewed your request regarding "${clean.slice(0, 120)}" and are checking the details on our end right now.\n\nWe will follow up shortly with the next steps.\n\nBest regards,\nTiwlo Support Team`;
    }
  }

  async function runAiPlayground({ task = 'draft_reply', input = '', customerName = 'Customer' } = {}) {
    const cleanInput = String(input || '').trim().slice(0, 8000);
    if (!cleanInput) {
      throw new SupportOpsHubError('Input text is required for AI Playground.', {
        statusCode: 400,
        code: 'AI_INPUT_REQUIRED'
      });
    }
    const validTasks = ['draft_reply', 'polish', 'translate_bn', 'translate_en', 'summarize', 'empathetic', 'kb_draft'];
    const safeTask = validTasks.includes(task) ? task : 'draft_reply';
    const prompt = buildPlaygroundPrompt({ task: safeTask, input: cleanInput, customerName });

    try {
      const aiRes = await executeAiFn({
        payload: {
          contents: [{ parts: [{ text: prompt }] }]
        }
      });
      const aiText = String(aiRes?.text || '').trim();
      if (aiRes && aiRes.ok !== false && aiText) {
        return {
          success: true,
          output: aiText,
          model: aiRes.model || aiRes.usedModel || 'gemini-flash',
          keyLabel: aiRes.keyLabel || aiRes.usedKeyLabel || 'pool-key'
        };
      }
    } catch {
      // Fall through to deterministic local fallback when no Gemini key is configured in dev/test
    }

    return {
      success: true,
      output: buildLocalFallbackAiOutput({ task: safeTask, input: cleanInput, customerName }),
      model: 'tiwlo-local-fallback',
      keyLabel: 'local-fallback'
    };
  }

  // 11. Automation Rules
  async function listAutomationRules() {
    await ensureSeeded('automation_rules', buildDefaultAutomationRules);
    const all = await kvList('automation_rules');
    const rules = all.sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    return { success: true, rules };
  }

  async function createAutomationRule(payload = {}) {
    await ensureSeeded('automation_rules', buildDefaultAutomationRules);
    const name = String(payload.name || '').trim().slice(0, 160);
    const triggerValue = String(payload.triggerValue || '').trim().slice(0, 240);
    const actionValue = String(payload.actionValue || '').trim().slice(0, 240);
    if (!name || !triggerValue || !actionValue) {
      throw new SupportOpsHubError('Rule name, triggerValue, and actionValue are required.', {
        statusCode: 400,
        code: 'RULE_INVALID_INPUT'
      });
    }
    const validTriggers = ['keyword', 'priority', 'category', 'requester_type', 'channel'];
    const validActions = ['set_priority', 'set_department', 'add_tag', 'mark_escalated'];
    const rule = {
      id: `rule_${randomUUID()}`,
      name,
      description: String(payload.description || '').trim().slice(0, 500),
      enabled: payload.enabled !== false,
      triggerField: validTriggers.includes(payload.triggerField) ? payload.triggerField : 'keyword',
      triggerValue,
      actionType: validActions.includes(payload.actionType) ? payload.actionType : 'add_tag',
      actionValue,
      hitsCount: 0,
      updatedAt: new Date().toISOString()
    };
    await kvPut('automation_rules', rule.id, rule);
    return { success: true, rule };
  }

  async function updateAutomationRule(id, payload = {}) {
    await ensureSeeded('automation_rules', buildDefaultAutomationRules);
    const key = String(id || '').trim();
    const existing = await kvGet('automation_rules', key);
    if (!existing) {
      throw new SupportOpsHubError('Automation rule not found.', { statusCode: 404, code: 'RULE_NOT_FOUND' });
    }
    const validTriggers = ['keyword', 'priority', 'category', 'requester_type', 'channel'];
    const validActions = ['set_priority', 'set_department', 'add_tag', 'mark_escalated'];
    const next = { ...existing };
    if (payload.name !== undefined) {
      const n = String(payload.name || '').trim().slice(0, 160);
      if (!n) throw new SupportOpsHubError('Rule name cannot be empty.', { statusCode: 400, code: 'RULE_INVALID_INPUT' });
      next.name = n;
    }
    if (payload.description !== undefined) next.description = String(payload.description || '').trim().slice(0, 500);
    if (typeof payload.enabled === 'boolean') next.enabled = payload.enabled;
    if (payload.triggerField !== undefined && validTriggers.includes(payload.triggerField)) {
      next.triggerField = payload.triggerField;
    }
    if (payload.triggerValue !== undefined) next.triggerValue = String(payload.triggerValue || '').trim().slice(0, 240);
    if (payload.actionType !== undefined && validActions.includes(payload.actionType)) {
      next.actionType = payload.actionType;
    }
    if (payload.actionValue !== undefined) next.actionValue = String(payload.actionValue || '').trim().slice(0, 240);
    next.updatedAt = new Date().toISOString();
    await kvPut('automation_rules', key, next);
    return { success: true, rule: next };
  }

  async function deleteAutomationRule(id) {
    await ensureSeeded('automation_rules', buildDefaultAutomationRules);
    const key = String(id || '').trim();
    const deleted = await kvDelete('automation_rules', key);
    if (!deleted) {
      throw new SupportOpsHubError('Automation rule not found.', { statusCode: 404, code: 'RULE_NOT_FOUND' });
    }
    return { success: true };
  }

  // 12. Departments & Business Hours
  async function listDepartments() {
    await ensureSeeded('departments', buildDefaultDepartments);
    const all = await kvList('departments');
    const departments = all.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return { success: true, departments };
  }

  async function createDepartment(payload = {}) {
    await ensureSeeded('departments', buildDefaultDepartments);
    const name = String(payload.name || '').trim().slice(0, 120);
    if (!name) {
      throw new SupportOpsHubError('Department name is required.', { statusCode: 400, code: 'DEPT_NAME_REQUIRED' });
    }
    const department = {
      id: `dept_${randomUUID()}`,
      name,
      slug: slugify(name, 'department'),
      leadName: String(payload.leadName || 'Support Lead').trim().slice(0, 120),
      slaResponseMinutes: Math.max(5, Math.round(Number(payload.slaResponseMinutes) || 60)),
      slaResolveMinutes: Math.max(15, Math.round(Number(payload.slaResolveMinutes) || 720)),
      businessHours: String(payload.businessHours || '24/7 Coverage').trim().slice(0, 160),
      autoAckMessage: String(
        payload.autoAckMessage || `Thank you for contacting Tiwlo ${name}. A specialist will reply shortly.`
      )
        .trim()
        .slice(0, 600),
      isActive: payload.isActive !== false,
      updatedAt: new Date().toISOString()
    };
    await kvPut('departments', department.id, department);
    return { success: true, department };
  }

  async function updateDepartment(id, payload = {}) {
    await ensureSeeded('departments', buildDefaultDepartments);
    const key = String(id || '').trim();
    const existing = await kvGet('departments', key);
    if (!existing) {
      throw new SupportOpsHubError('Department not found.', { statusCode: 404, code: 'DEPT_NOT_FOUND' });
    }
    const next = { ...existing };
    if (payload.name !== undefined) {
      const n = String(payload.name || '').trim().slice(0, 120);
      if (!n) throw new SupportOpsHubError('Department name cannot be empty.', { statusCode: 400, code: 'DEPT_NAME_REQUIRED' });
      next.name = n;
      next.slug = slugify(n, 'department');
    }
    if (payload.leadName !== undefined) next.leadName = String(payload.leadName || '').trim().slice(0, 120);
    if (payload.slaResponseMinutes !== undefined) {
      next.slaResponseMinutes = Math.max(5, Math.round(Number(payload.slaResponseMinutes) || 60));
    }
    if (payload.slaResolveMinutes !== undefined) {
      next.slaResolveMinutes = Math.max(15, Math.round(Number(payload.slaResolveMinutes) || 720));
    }
    if (payload.businessHours !== undefined) next.businessHours = String(payload.businessHours || '').trim().slice(0, 160);
    if (payload.autoAckMessage !== undefined) next.autoAckMessage = String(payload.autoAckMessage || '').trim().slice(0, 600);
    if (typeof payload.isActive === 'boolean') next.isActive = payload.isActive;
    next.updatedAt = new Date().toISOString();
    await kvPut('departments', key, next);
    return { success: true, department: next };
  }

  async function deleteDepartment(id) {
    await ensureSeeded('departments', buildDefaultDepartments);
    const key = String(id || '').trim();
    const deleted = await kvDelete('departments', key);
    if (!deleted) {
      throw new SupportOpsHubError('Department not found.', { statusCode: 404, code: 'DEPT_NOT_FOUND' });
    }
    return { success: true };
  }

  // 13. Spam & Abuse Blocklist
  async function listBlocklist() {
    const all = await kvList('blocklist');
    const rules = all.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return { success: true, rules };
  }

  async function addBlocklistRule(payload = {}, adminUser = null) {
    const validKinds = ['email', 'ip', 'domain', 'keyword', 'phone'];
    const kind = validKinds.includes(payload.kind) ? payload.kind : 'email';
    const value = String(payload.value || '').trim().slice(0, 200);
    const reason = String(payload.reason || 'Spam / Abuse Shield').trim().slice(0, 500);
    if (!value) {
      throw new SupportOpsHubError('Blocklist pattern value is required.', {
        statusCode: 400,
        code: 'BLOCKLIST_VALUE_REQUIRED'
      });
    }
    const rule = {
      id: `blk_${randomUUID()}`,
      kind,
      value,
      reason,
      hitsCount: 0,
      createdByName: String(adminUser?.name || adminUser?.email || 'Trust & Safety').slice(0, 120),
      createdAt: new Date().toISOString()
    };
    await kvPut('blocklist', rule.id, rule);
    return { success: true, rule };
  }

  async function deleteBlocklistRule(id) {
    const key = String(id || '').trim();
    const deleted = await kvDelete('blocklist', key);
    if (!deleted) {
      throw new SupportOpsHubError('Blocklist rule not found.', { statusCode: 404, code: 'BLOCKLIST_NOT_FOUND' });
    }
    return { success: true };
  }

  // 14. Personal Staff Tasks (strictly scoped per staffId)
  async function listPersonalTasks(staffId) {
    const ownerId = String(staffId || '').trim();
    if (!ownerId) {
      throw new SupportOpsHubError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const all = await kvList('personal_tasks');
    const tasks = all
      .filter((t) => String(t.staffId) === ownerId)
      .sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) return b.pinned ? 1 : -1;
        if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
        return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
      });
    return { success: true, tasks };
  }

  async function createPersonalTask(staffId, payload = {}) {
    const ownerId = String(staffId || '').trim();
    if (!ownerId) {
      throw new SupportOpsHubError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const title = String(payload.title || '').trim().slice(0, 240);
    if (!title) {
      throw new SupportOpsHubError('Task title is required.', { statusCode: 400, code: 'TASK_TITLE_REQUIRED' });
    }
    const priority = ['low', 'medium', 'high'].includes(payload.priority) ? payload.priority : 'medium';
    const nowIso = new Date().toISOString();
    const task = {
      id: `ptsk_${randomUUID()}`,
      staffId: ownerId,
      title,
      note: String(payload.note || '').trim().slice(0, 2000),
      priority,
      linkedTicketSerial: payload.linkedTicketSerial
        ? String(payload.linkedTicketSerial).trim().slice(0, 40)
        : null,
      dueLabel: payload.dueLabel ? String(payload.dueLabel).trim().slice(0, 80) : null,
      completed: Boolean(payload.completed),
      pinned: Boolean(payload.pinned),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await kvPut('personal_tasks', task.id, task);
    return { success: true, task };
  }

  async function updatePersonalTask(staffId, id, payload = {}) {
    const ownerId = String(staffId || '').trim();
    const key = String(id || '').trim();
    const existing = await kvGet('personal_tasks', key);
    if (!existing || String(existing.staffId) !== ownerId) {
      throw new SupportOpsHubError('Personal task not found.', { statusCode: 404, code: 'TASK_NOT_FOUND' });
    }
    const next = { ...existing };
    if (payload.title !== undefined) {
      const t = String(payload.title || '').trim().slice(0, 240);
      if (!t) throw new SupportOpsHubError('Task title cannot be empty.', { statusCode: 400, code: 'TASK_TITLE_REQUIRED' });
      next.title = t;
    }
    if (payload.note !== undefined) next.note = String(payload.note || '').trim().slice(0, 2000);
    if (payload.priority !== undefined && ['low', 'medium', 'high'].includes(payload.priority)) {
      next.priority = payload.priority;
    }
    if (payload.linkedTicketSerial !== undefined) {
      next.linkedTicketSerial = payload.linkedTicketSerial
        ? String(payload.linkedTicketSerial).trim().slice(0, 40)
        : null;
    }
    if (payload.dueLabel !== undefined) {
      next.dueLabel = payload.dueLabel ? String(payload.dueLabel).trim().slice(0, 80) : null;
    }
    if (typeof payload.completed === 'boolean') next.completed = payload.completed;
    if (typeof payload.pinned === 'boolean') next.pinned = payload.pinned;
    next.updatedAt = new Date().toISOString();
    await kvPut('personal_tasks', key, next);
    return { success: true, task: next };
  }

  async function deletePersonalTask(staffId, id) {
    const ownerId = String(staffId || '').trim();
    const key = String(id || '').trim();
    const existing = await kvGet('personal_tasks', key);
    if (!existing || String(existing.staffId) !== ownerId) {
      throw new SupportOpsHubError('Personal task not found.', { statusCode: 404, code: 'TASK_NOT_FOUND' });
    }
    await kvDelete('personal_tasks', key);
    return { success: true };
  }

  // 15. Customer 360 Directory & Profile Notes
  function deriveCustomerKey({ email, userId, fallbackId }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (cleanEmail) return cleanEmail;
    const cleanUid = String(userId || '').trim();
    if (cleanUid && cleanUid !== 'guest' && cleanUid !== 'guest_session') return `user:${cleanUid}`;
    return `guest:${String(fallbackId || randomUUID()).trim()}`;
  }

  async function buildCustomerDirectoryMap({ adminUser, adminProfile = null } = {}) {
    const ticketing = getTicketing();
    const liveChat = getLiveChat();

    const [{ tickets = [] }, chatsResult, storedProfiles] = await Promise.all([
      ticketing
        .listAdminTickets({
          limit: 200,
          excludeDismissed: false,
          adminUser,
          adminProfile
        })
        .catch(() => ({ tickets: [] })),
      liveChat
        .listAdminLiveChats({
          status: 'all',
          excludeDismissed: false,
          staffActor: adminUser || { id: 'staff_reader', role: 'admin' }
        })
        .catch(() => ({ chats: [] })),
      kvList('customer_profiles')
    ]);

    const chats = Array.isArray(chatsResult?.chats) ? chatsResult.chats : [];
    const profileByKey = new Map();
    for (const p of storedProfiles) {
      if (p?.key) profileByKey.set(String(p.key).toLowerCase(), p);
    }

    const directory = new Map();
    const ensureCustomer = (key, seed = {}) => {
      const normKey = String(key).toLowerCase();
      if (!directory.has(normKey)) {
        const stored = profileByKey.get(normKey);
        directory.set(normKey, {
          key: normKey,
          userId: seed.userId || stored?.userId || null,
          name: seed.name || stored?.name || 'Customer',
          email: seed.email || stored?.email || '',
          phone: seed.phone || stored?.phone || null,
          avatar: seed.avatar || stored?.avatar || null,
          isRegistered: Boolean(seed.isRegistered || stored?.isRegistered),
          segment: ['standard', 'vip', 'watchlist'].includes(stored?.segment) ? stored.segment : 'standard',
          tickets: [],
          chats: [],
          notes: Array.isArray(stored?.notes) ? stored.notes : [],
          lastActivityAt: seed.lastActivityAt || stored?.updatedAt || new Date(0).toISOString()
        });
      }
      const entry = directory.get(normKey);
      if (!entry.userId && seed.userId) entry.userId = seed.userId;
      if ((!entry.name || entry.name === 'Customer' || entry.name === 'Visitor') && seed.name) entry.name = seed.name;
      if (!entry.email && seed.email) entry.email = seed.email;
      if (!entry.phone && seed.phone) entry.phone = seed.phone;
      if (!entry.avatar && seed.avatar) entry.avatar = seed.avatar;
      if (seed.isRegistered) entry.isRegistered = true;
      if (seed.lastActivityAt && Date.parse(seed.lastActivityAt) > Date.parse(entry.lastActivityAt || 0)) {
        entry.lastActivityAt = seed.lastActivityAt;
      }
      return entry;
    };

    for (const t of tickets) {
      const email = t.userEmail || t.guestEmail || '';
      const isReg = Boolean(t.userId && t.userId !== 'guest' && t.requesterType !== 'guest');
      const key = deriveCustomerKey({
        email,
        userId: isReg ? t.userId : null,
        fallbackId: t.guestSessionId || t.id
      });
      const entry = ensureCustomer(key, {
        userId: isReg ? t.userId : null,
        name: t.userName || t.guestName || email || 'Customer',
        email,
        phone: t.guestPhone || null,
        avatar: t.userAvatar || null,
        isRegistered: isReg,
        lastActivityAt: t.updatedAt || t.createdAt
      });
      entry.tickets.push(t);
    }

    for (const c of chats) {
      const email = c.guestEmail || '';
      const isReg = Boolean(c.userId && c.userId !== 'guest');
      const key = deriveCustomerKey({
        email,
        userId: isReg ? c.userId : null,
        fallbackId: c.id
      });
      const entry = ensureCustomer(key, {
        userId: isReg ? c.userId : null,
        name: c.guestName || email || 'Visitor',
        email,
        phone: c.guestPhone || null,
        avatar: c.userAvatar || null,
        isRegistered: isReg,
        lastActivityAt: c.lastMessageAt || c.joinedAt || c.createdAt
      });
      entry.chats.push(c);
    }

    for (const p of storedProfiles) {
      if (p?.key && !directory.has(String(p.key).toLowerCase())) {
        ensureCustomer(p.key, {
          userId: p.userId || null,
          name: p.name || p.key,
          email: p.email || (String(p.key).includes('@') ? p.key : ''),
          phone: p.phone || null,
          isRegistered: Boolean(p.userId),
          lastActivityAt: p.updatedAt || new Date().toISOString()
        });
      }
    }

    return directory;
  }

  function toCustomerSummary(entry) {
    const openTicketsCount = entry.tickets.filter(
      (t) => !['resolved', 'closed'].includes(String(t.status || '').toLowerCase())
    ).length;
    return {
      key: entry.key,
      userId: entry.userId || null,
      name: entry.name || 'Customer',
      email: entry.email || '',
      phone: entry.phone || null,
      avatar: entry.avatar || null,
      isRegistered: Boolean(entry.isRegistered),
      segment: entry.segment || 'standard',
      ticketsCount: entry.tickets.length,
      openTicketsCount,
      chatsCount: entry.chats.length,
      lastActivityAt: entry.lastActivityAt || new Date().toISOString()
    };
  }

  function findEntryInDirectory(directory, rawKey) {
    const target = String(rawKey || '').trim().toLowerCase();
    if (!target) return null;
    if (directory.has(target)) return directory.get(target);
    if (directory.has(`user:${target}`)) return directory.get(`user:${target}`);
    for (const entry of directory.values()) {
      if (
        (entry.userId && String(entry.userId).toLowerCase() === target) ||
        (entry.email && String(entry.email).toLowerCase() === target)
      ) {
        return entry;
      }
    }
    return null;
  }

  async function listCustomers({ q = '', segment = '', adminUser = null, adminProfile = null } = {}) {
    const directory = await buildCustomerDirectoryMap({ adminUser, adminProfile });
    const query = String(q || '').trim().toLowerCase();
    const segFilter = String(segment || '').trim().toLowerCase();

    const customers = Array.from(directory.values())
      .map(toCustomerSummary)
      .filter((c) => {
        if (segFilter && segFilter !== 'all' && c.segment !== segFilter) return false;
        if (query) {
          const hay = [c.name, c.email, c.phone, c.userId, c.key].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.lastActivityAt || 0) - Date.parse(a.lastActivityAt || 0));

    return { success: true, customers };
  }

  async function getCustomer360(rawKey, { adminUser = null, adminProfile = null } = {}) {
    const directory = await buildCustomerDirectoryMap({ adminUser, adminProfile });
    const entry = findEntryInDirectory(directory, rawKey);
    if (!entry) {
      throw new SupportOpsHubError('Customer record not found.', { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
    }
    return {
      success: true,
      customer: toCustomerSummary(entry),
      tickets: entry.tickets,
      chats: entry.chats,
      notes: entry.notes
    };
  }

  async function updateCustomerProfileNote(rawKey, { note, segment, adminUser = null, adminProfile = null } = {}) {
    const cleanKeyInput = String(rawKey || '').trim().toLowerCase();
    if (!cleanKeyInput) {
      throw new SupportOpsHubError('Customer key is required.', { statusCode: 400, code: 'CUSTOMER_KEY_REQUIRED' });
    }
    const directory = await buildCustomerDirectoryMap({ adminUser, adminProfile });
    const matched = findEntryInDirectory(directory, cleanKeyInput);
    const canonicalKey = matched ? matched.key : cleanKeyInput;

    const existingProfile = (await kvGet('customer_profiles', canonicalKey)) || {
      key: canonicalKey,
      name: matched?.name || canonicalKey,
      email: matched?.email || (canonicalKey.includes('@') ? canonicalKey : ''),
      userId: matched?.userId || null,
      segment: matched?.segment || 'standard',
      notes: Array.isArray(matched?.notes) ? [...matched.notes] : []
    };

    if (segment !== undefined && ['standard', 'vip', 'watchlist'].includes(segment)) {
      existingProfile.segment = segment;
    }
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 2000) : '';
    if (cleanNote) {
      const newNote = {
        id: `cnote_${randomUUID()}`,
        body: cleanNote,
        authorName: String(adminUser?.name || adminUser?.email || 'Support Specialist').slice(0, 120),
        createdAt: new Date().toISOString()
      };
      existingProfile.notes = [newNote, ...(Array.isArray(existingProfile.notes) ? existingProfile.notes : [])];
    }
    existingProfile.updatedAt = new Date().toISOString();
    await kvPut('customer_profiles', canonicalKey, existingProfile);

    return getCustomer360(canonicalKey, { adminUser, adminProfile });
  }

  // 16. Public & Admin Staff Onboarding / Access Requests
  async function generateUniqueAccessRequestCode() {
    const existing = await kvList('staff_access_requests');
    const codes = new Set(existing.map((r) => String(r.requestCode || '').toUpperCase()));
    for (let i = 0; i < 10; i += 1) {
      const code = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;
      if (!codes.has(code)) return code;
    }
    return `REQ-${Date.now().toString().slice(-6)}`;
  }

  async function submitStaffAccessRequest(payload = {}) {
    const fullName = String(payload.fullName || '').trim().slice(0, 140);
    const email = String(payload.email || '').trim().toLowerCase().slice(0, 254);
    const phone = String(payload.phone || '').trim().slice(0, 40);
    const desiredRole = String(payload.desiredRole || 'support_agent').trim().slice(0, 64);
    const department = String(payload.department || 'Customer Support').trim().slice(0, 80);
    const inviteCode = payload.inviteCode ? String(payload.inviteCode).trim().slice(0, 64) : null;
    const reason = String(payload.reason || '').trim().slice(0, 2000);

    if (fullName.length < 2) {
      throw new SupportOpsHubError('Full name is required (at least 2 characters).', {
        statusCode: 400,
        code: 'NAME_REQUIRED'
      });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new SupportOpsHubError('A valid work email address is required.', {
        statusCode: 400,
        code: 'VALID_EMAIL_REQUIRED'
      });
    }

    const requestCode = await generateUniqueAccessRequestCode();
    const nowIso = new Date().toISOString();
    const request = {
      id: `sar_${randomUUID()}`,
      requestCode,
      fullName,
      email,
      phone,
      desiredRole,
      department,
      inviteCode,
      reason,
      status: 'pending',
      reviewNote: null,
      reviewedByName: null,
      reviewedAt: null,
      createdAt: nowIso
    };
    await kvPut('staff_access_requests', request.id, request);
    return {
      success: true,
      request,
      message: `Access request ${requestCode} submitted. An administrator will review your onboarding request.`
    };
  }

  async function checkStaffAccessRequestStatus({ email = '', code = '' } = {}) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawCode = String(code || '').trim().toUpperCase();
    if (!cleanEmail || !rawCode) {
      throw new SupportOpsHubError('Both email and request code are required to check status.', {
        statusCode: 400,
        code: 'STATUS_LOOKUP_PARAMS_REQUIRED'
      });
    }
    const normalizedCode = rawCode.startsWith('REQ-') ? rawCode : `REQ-${rawCode.replace(/^#+/, '')}`;
    const all = await kvList('staff_access_requests');
    const matched = all.find(
      (r) =>
        String(r.email || '').toLowerCase() === cleanEmail &&
        (String(r.requestCode || '').toUpperCase() === rawCode ||
          String(r.requestCode || '').toUpperCase() === normalizedCode)
    );
    if (!matched) {
      throw new SupportOpsHubError('No matching staff access request found for that email and request code.', {
        statusCode: 404,
        code: 'ACCESS_REQUEST_NOT_FOUND'
      });
    }
    return { success: true, request: matched };
  }

  async function listStaffAccessRequests({ status = '' } = {}) {
    const all = await kvList('staff_access_requests');
    const filterStatus = String(status || '').trim().toLowerCase();
    const requests = all
      .filter((r) => !filterStatus || filterStatus === 'all' || r.status === filterStatus)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
    return { success: true, requests };
  }

  async function decideStaffAccessRequest(id, { decision, reviewNote = '' } = {}, adminUser = null) {
    const key = String(id || '').trim();
    if (!['approved', 'rejected'].includes(decision)) {
      throw new SupportOpsHubError('Decision must be "approved" or "rejected".', {
        statusCode: 400,
        code: 'INVALID_DECISION'
      });
    }
    const existing = await kvGet('staff_access_requests', key);
    if (!existing) {
      throw new SupportOpsHubError('Staff access request not found.', {
        statusCode: 404,
        code: 'ACCESS_REQUEST_NOT_FOUND'
      });
    }
    existing.status = decision;
    existing.reviewNote = reviewNote ? String(reviewNote).trim().slice(0, 1000) : null;
    existing.reviewedByName = String(adminUser?.name || adminUser?.email || 'Administrator').slice(0, 120);
    existing.reviewedAt = new Date().toISOString();
    await kvPut('staff_access_requests', key, existing);
    return { success: true, request: existing };
  }

  return {
    ensureOpsSchema,
    computeTicketReplyAccess,
    computeLiveChatReplyAccess,
    getQuickPeek,
    createOutboundTicket,
    getStaffPreferences,
    updateStaffPreferences,
    listKbArticles,
    getKbArticle,
    createKbArticle,
    updateKbArticle,
    deleteKbArticle,
    markKbArticleHelpful,
    listIncidents,
    createIncident,
    addIncidentUpdate,
    broadcastIncidentUpdate,
    listShiftHandovers,
    createShiftHandover,
    acknowledgeShiftHandover,
    listTeamWallPosts,
    createTeamWallPost,
    togglePinTeamWallPost,
    reactTeamWallPost,
    deleteTeamWallPost,
    listApprovals,
    createApprovalRequest,
    decideApprovalRequest,
    listQaReviews,
    createQaReview,
    runAiPlayground,
    listAutomationRules,
    createAutomationRule,
    updateAutomationRule,
    deleteAutomationRule,
    listDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    listBlocklist,
    addBlocklistRule,
    deleteBlocklistRule,
    listPersonalTasks,
    createPersonalTask,
    updatePersonalTask,
    deletePersonalTask,
    listCustomers,
    getCustomer360,
    updateCustomerProfileNote,
    submitStaffAccessRequest,
    checkStaffAccessRequestStatus,
    listStaffAccessRequests,
    decideStaffAccessRequest
  };
}

export const defaultSupportOpsHubService = createSupportOpsHubService();

export default defaultSupportOpsHubService;
