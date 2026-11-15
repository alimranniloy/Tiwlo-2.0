import crypto, { randomUUID } from 'node:crypto';
import { isPgActive as defaultIsPgActive, queryPg as defaultQueryPg } from '../db/postgres.js';
import { executeGeminiWithFailover, getChatSystemSettings } from './ai/aiKeyPoolService.js';
import { isSuperAdminAccount } from '../administrator/identityRiskGraph.js';

export const LIVE_CHAT_STATUSES = Object.freeze([
  'waiting',
  'active',
  'on_hold',
  'closed',
  'cancelled'
]);

const DEFAULT_TEMPLATES = Object.freeze([
  {
    id: 'tpl_greeting_verify',
    title: 'Warm Greeting & Verification',
    category: 'Greeting',
    shortcut: '/greet',
    body: 'Hello! Welcome to Tiwlo Support. I have joined your chat and am reviewing your request now. Could you please share your order reference if applicable?'
  },
  {
    id: 'tpl_checking_details',
    title: 'Investigating Account / Order',
    category: 'Investigation',
    shortcut: '/check',
    body: 'Thank you for waiting. I am checking the details on our end right now and will update you shortly.'
  },
  {
    id: 'tpl_hold_escalation',
    title: 'Placing on Hold for Specialist Review',
    category: 'Hold',
    shortcut: '/hold',
    body: 'I am placing this conversation on hold while our specialist team verifies the technical logs. Another team member or I will follow up right here shortly.'
  },
  {
    id: 'tpl_billing_refund',
    title: 'Payment & Refund Clarification',
    category: 'Billing',
    shortcut: '/refund',
    body: 'I have verified the payment status for you. Refunds typically reflect within 3–5 business days depending on your bank or payment gateway.'
  },
  {
    id: 'tpl_resolved_close',
    title: 'Issue Resolved & Closing',
    category: 'Closing',
    shortcut: '/close',
    body: 'I am glad we could resolve this for you today! If you need anything else in the future, feel free to open a new live chat or support ticket anytime.'
  }
]);

const SLOW_RESPONSE_THRESHOLD_MS = 120_000;
const UNANSWERED_WAIT_ATTENTION_MS = 180_000;
const ONLINE_HEARTBEAT_TTL_MS = 90_000;

const NEGATIVE_SENTIMENT_TERMS = [
  'angry', 'scam', 'fraud', 'worst', 'terrible', 'horrible', 'useless',
  'broken', 'failed', 'refund', 'cancel', 'late', 'never replied', 'waiting forever',
  'slow', 'bad support', 'unacceptable', 'complaint', 'disappointed', 'frustrated',
  'খারাপ', 'বাজে', 'সমস্যা', 'ফেরত', 'দেরি'
];

const POSITIVE_SENTIMENT_TERMS = [
  'thank', 'thanks', 'helpful', 'awesome', 'great', 'fixed', 'resolved',
  'working now', 'perfect', 'appreciate', 'fast', 'good job', 'wonderful',
  'ধন্যবাদ', 'ভালো', 'ঠিক হয়েছে'
];

export class LiveChatQueueError extends Error {
  constructor(message, { statusCode = 400, code = 'LIVE_CHAT_ERROR', details = null } = {}) {
    super(message);
    this.name = 'LiveChatQueueError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function sha256Hex(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function extractClientIp(req) {
  if (!req) return null;
  const xff = req.headers?.['x-forwarded-for'];
  if (xff) {
    const first = String(xff).split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) return String(realIp).trim();
  const direct = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress;
  return direct ? String(direct).trim() : null;
}

function extractDeviceFingerprint(req) {
  if (!req) return null;
  const explicit = req.headers?.['x-device-fingerprint'] || req.body?.deviceFingerprint || null;
  if (explicit) return sha256Hex(String(explicit).trim().slice(0, 256));
  const ua = String(req.headers?.['user-agent'] || '').trim().toLowerCase();
  const acceptLang = String(req.headers?.['accept-language'] || '').trim().toLowerCase();
  const ip = extractClientIp(req) || '';
  if (!ua && !ip) return null;
  return sha256Hex(`${ip}|${ua}|${acceptLang}`);
}

function generateChatNumber() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `TWLC-${num}`;
}

function isSuperAdminActor(actor) {
  if (!actor) return false;
  if (actor.isSuperAdmin === true || actor.role === 'super_admin') return true;
  return isSuperAdminAccount(actor);
}

function computeSentimentScore(messages = []) {
  const customerTexts = messages
    .filter((m) => m.senderType === 'customer')
    .map((m) => String(m.body || '').toLowerCase());
  if (customerTexts.length === 0) return { label: 'neutral', score: 0, negativeHits: 0, positiveHits: 0 };

  let negativeHits = 0;
  let positiveHits = 0;
  const joined = customerTexts.join(' ');
  for (const term of NEGATIVE_SENTIMENT_TERMS) {
    if (joined.includes(term)) negativeHits += 1;
  }
  for (const term of POSITIVE_SENTIMENT_TERMS) {
    if (joined.includes(term)) positiveHits += 1;
  }
  const score = Math.max(-100, Math.min(100, (positiveHits * 25) - (negativeHits * 30)));
  const label = score <= -25 ? 'frustrated' : score >= 20 ? 'satisfied' : 'neutral';
  return { label, score, negativeHits, positiveHits };
}

function detectProxyOrVpnHints(req) {
  if (!req?.headers) return [];
  const hints = [];
  const xff = String(req.headers['x-forwarded-for'] || '');
  if (xff.split(',').filter((s) => s.trim()).length >= 2) {
    hints.push('MULTI_HOP_PROXY_HEADER');
  }
  if (req.headers['via'] || req.headers['forwarded'] || req.headers['x-proxyuser-ip']) {
    hints.push('PROXY_VIA_HEADER');
  }
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (/mobile|android|iphone|ipad/i.test(ua)) {
    hints.push('MOBILE_SESSION_UA');
  }
  return hints;
}

function maskIpPrefix(ip) {
  if (!ip) return null;
  const clean = String(ip).trim();
  if (clean.includes('.')) {
    const parts = clean.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : 'ipv4-masked';
  }
  if (clean.includes(':')) {
    return `${clean.split(':').slice(0, 3).join(':')}::*`;
  }
  return 'masked';
}

function evaluateCollusionSignals({
  chat,
  staffActor,
  staffReq = null,
  staffKnownIpHashes = [],
  samePairCount = 0,
  recentMessages = [],
  avgStaffTurnMs = null
}) {
  const flags = [];
  let score = 0;

  // 1. Same user account or same email/phone between requester and accepting staff
  const staffEmail = String(staffActor?.email || '').trim().toLowerCase();
  const chatEmail = String(chat.guestEmail || '').trim().toLowerCase();
  if (chat.userId && staffActor?.id && String(chat.userId) === String(staffActor.id)) {
    flags.push('SELF_USER_ID');
    score += 100;
  }
  if (staffEmail && chatEmail && staffEmail === chatEmail) {
    flags.push('SAME_STAFF_EMAIL');
    score += 90;
  }

  // 2. Same IP address or same device/browser fingerprint
  const staffIp = extractClientIp(staffReq);
  const staffIpHash = chat._staffIpHashOverride || (staffIp ? sha256Hex(staffIp) : null);
  const staffFp = chat._staffFpOverride || extractDeviceFingerprint(staffReq);

  const knownIpSet = new Set(
    [staffIpHash, ...(staffKnownIpHashes || []), ...(chat._staffPresenceIps || [])].filter(Boolean)
  );
  if (chat.requesterIpHash && knownIpSet.has(chat.requesterIpHash)) {
    flags.push('SAME_IP_ADDRESS');
    score += 75;
  }
  if (chat.requesterDeviceHash && staffFp && chat.requesterDeviceHash === staffFp) {
    flags.push('SAME_DEVICE_FINGERPRINT');
    score += 80;
  }

  // 3. VPN / Mobile Dual-Device Behavioral Detection (catches 2nd phone on mobile data / VPN)
  const joinedMs = Date.parse(chat.joinedAt || 0);
  const acceptedMs = Date.parse(chat.acceptedAt || 0);
  const closedMs = Date.parse(chat.closedAt || 0);
  const acceptDelayMs = (acceptedMs && joinedMs) ? Math.max(0, acceptedMs - joinedMs) : null;

  if (acceptDelayMs !== null && acceptDelayMs < 2000 && chat.requesterIpHash !== staffIpHash) {
    flags.push('INSTANT_REMOTE_SELF_ACCEPT');
    score += 40;
  }

  // Repeated affinity across different IPs or VPN sessions
  if (samePairCount >= 2) {
    flags.push(samePairCount >= 3 ? 'REPEATED_SAME_PAIR_AFFINITY' : 'REPEAT_PAIR_WARNING');
    score += samePairCount >= 3 ? 50 : 25;
  }

  // Ultra-fast ping-pong conversation pattern (< 2.5s bot-like cadence + short closing)
  const shortMsgs = recentMessages.filter((m) => String(m.body || '').trim().length <= 12).length;
  if (acceptedMs && closedMs && (closedMs - acceptedMs) < 20_000 && shortMsgs >= 2) {
    flags.push('RAPID_DUMMY_PING_PONG');
    score += 55;
  }
  if (avgStaffTurnMs !== null && avgStaffTurnMs < 2500 && recentMessages.length >= 4) {
    flags.push('UNNATURAL_BOT_CADENCE');
    score += 35;
  }

  // Record if customer came from VPN/Proxy + Mobile while staff interacted
  if (Array.isArray(chat.requesterNetworkHints) && chat.requesterNetworkHints.some((h) => h.includes('PROXY')) && score >= 25) {
    flags.push('PROXY_OR_VPN_SESSION_CORRELATED');
    score += 20;
  }

  const normalizedScore = Math.min(100, score);
  return {
    collusionScore: normalizedScore,
    isSuspicious: normalizedScore >= 50,
    flags: [...new Set(flags)],
    evidence: {
      acceptDelayMs,
      samePairCount,
      staffIpPrefix: maskIpPrefix(staffIp),
      staffHasDifferentIpFromRequester: Boolean(chat.requesterIpHash && staffIpHash && chat.requesterIpHash !== staffIpHash),
      requesterNetworkHints: chat.requesterNetworkHints || []
    }
  };
}

function calculatePercentile(sortedAsc, percentile) {
  if (!sortedAsc.length) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((percentile / 100) * sortedAsc.length) - 1));
  return sortedAsc[idx];
}

export function createLiveChatQueueService({
  isPgActive: isPgActiveFn = defaultIsPgActive,
  queryPg: queryPgFn = defaultQueryPg,
  getChatSettingsFn = getChatSystemSettings,
  executeAiFn = executeGeminiWithFailover,
  useMemory = false
} = {}) {
  const mem = {
    chats: [],
    messages: new Map(),
    presence: new Map(),
    samples: [],
    forensicLogs: [],
    csatSurveys: [],
    templates: DEFAULT_TEMPLATES.map((t) => ({
      ...t,
      createdBy: 'system',
      isSystem: true,
      updatedAt: new Date().toISOString()
    }))
  };

  let schemaReady = false;
  let schemaPromise = null;

  function isUsingPg() {
    if (useMemory) return false;
    return Boolean(isPgActiveFn());
  }

  async function ensureLiveChatSchema() {
    if (!isUsingPg()) return { ok: true, mode: 'memory' };
    if (schemaReady) return { ok: true, mode: 'postgres', cached: true };
    if (schemaPromise) return schemaPromise;

    schemaPromise = (async () => {
      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_live_chat_requests (
          id VARCHAR(80) PRIMARY KEY,
          chat_number VARCHAR(32) UNIQUE NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'waiting',
          requester_type VARCHAR(16) NOT NULL DEFAULT 'guest',
          user_id VARCHAR(64),
          guest_session_id VARCHAR(96),
          guest_name VARCHAR(160),
          guest_email VARCHAR(255),
          guest_phone VARCHAR(64),
          requester_ip_hash VARCHAR(128),
          requester_device_hash VARCHAR(128),
          topic VARCHAR(255) NOT NULL DEFAULT 'General Support',
          department VARCHAR(64) NOT NULL DEFAULT 'General Support',
          assigned_agent_id VARCHAR(64),
          assigned_agent_name VARCHAR(160),
          assigned_agent_role VARCHAR(64),
          joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          accepted_at TIMESTAMPTZ,
          held_at TIMESTAMPTZ,
          closed_at TIMESTAMPTZ,
          awaiting_customer_since TIMESTAMPTZ,
          first_response_ms BIGINT,
          queue_wait_ms BIGINT,
          customer_messages_count INT NOT NULL DEFAULT 0,
          staff_messages_count INT NOT NULL DEFAULT 0,
          collusion_score INT NOT NULL DEFAULT 0,
          collusion_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
          sentiment_label VARCHAR(24) NOT NULL DEFAULT 'neutral',
          sentiment_score INT NOT NULL DEFAULT 0,
          converted_ticket_id VARCHAR(80),
          converted_ticket_number VARCHAR(32),
          last_message_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_live_chat_status_joined ON support_live_chat_requests (status, joined_at ASC)`);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_live_chat_agent_status ON support_live_chat_requests (assigned_agent_id, status)`);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_live_chat_guest_sess ON support_live_chat_requests (guest_session_id)`);

      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_live_chat_messages (
          id VARCHAR(80) PRIMARY KEY,
          chat_id VARCHAR(80) NOT NULL,
          sender_type VARCHAR(24) NOT NULL,
          sender_id VARCHAR(64),
          sender_name VARCHAR(160),
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_live_chat_msgs_chat ON support_live_chat_messages (chat_id, created_at ASC)`);

      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_agent_presence (
          agent_id VARCHAR(64) PRIMARY KEY,
          agent_name VARCHAR(160),
          agent_role VARCHAR(64),
          is_online BOOLEAN NOT NULL DEFAULT TRUE,
          last_ip_hash VARCHAR(128),
          last_device_hash VARCHAR(128),
          last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_staff_response_samples (
          id VARCHAR(80) PRIMARY KEY,
          staff_id VARCHAR(64) NOT NULL,
          staff_name VARCHAR(160),
          chat_id VARCHAR(80) NOT NULL,
          sample_type VARCHAR(32) NOT NULL DEFAULT 'turn_reply',
          response_ms BIGINT NOT NULL,
          is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
          exclusion_reason VARCHAR(255),
          responded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_staff_resp_samples_staff ON support_staff_response_samples (staff_id, responded_at DESC)`);

      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_live_chat_templates (
          id VARCHAR(80) PRIMARY KEY,
          title VARCHAR(160) NOT NULL,
          category VARCHAR(64) NOT NULL DEFAULT 'General',
          shortcut VARCHAR(32),
          body TEXT NOT NULL,
          created_by VARCHAR(64),
          is_system BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_staff_forensic_logs (
          id VARCHAR(80) PRIMARY KEY,
          staff_id VARCHAR(64) NOT NULL,
          staff_name VARCHAR(160),
          chat_id VARCHAR(80),
          chat_number VARCHAR(32),
          severity VARCHAR(24) NOT NULL DEFAULT 'warning',
          collusion_score INT NOT NULL DEFAULT 0,
          signals JSONB NOT NULL DEFAULT '[]'::jsonb,
          evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
          detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_staff_forensic_detected ON support_staff_forensic_logs (detected_at DESC)`);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_staff_forensic_staff ON support_staff_forensic_logs (staff_id, detected_at DESC)`);

      await queryPgFn(`ALTER TABLE support_live_chat_requests ADD COLUMN IF NOT EXISTS requester_network_hints JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await queryPgFn(`ALTER TABLE support_live_chat_requests ADD COLUMN IF NOT EXISTS co_browsing_state JSONB NOT NULL DEFAULT '{}'::jsonb`);

      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_csat_surveys (
          id VARCHAR(80) PRIMARY KEY,
          target_type VARCHAR(24) NOT NULL DEFAULT 'live_chat',
          target_id VARCHAR(80) NOT NULL,
          rating INT NOT NULL,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          comment TEXT,
          staff_id VARCHAR(64),
          staff_name VARCHAR(160),
          requester_id VARCHAR(80),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (target_type, target_id)
        )
      `);
      await queryPgFn(`CREATE INDEX IF NOT EXISTS idx_support_csat_staff ON support_csat_surveys (staff_id, created_at DESC)`);

      // Seed default system templates idempotently
      for (const tpl of DEFAULT_TEMPLATES) {
        await queryPgFn(
          `INSERT INTO support_live_chat_templates (id, title, category, shortcut, body, created_by, is_system)
           VALUES ($1, $2, $3, $4, $5, 'system', TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [tpl.id, tpl.title, tpl.category, tpl.shortcut, tpl.body]
        );
      }

      schemaReady = true;
      return { ok: true, mode: 'postgres' };
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });

    return schemaPromise;
  }

  function mapChatRow(row) {
    if (!row) return null;
    let flags = row.collusion_flags ?? row.collusionFlags ?? [];
    if (typeof flags === 'string') {
      try { flags = JSON.parse(flags); } catch { flags = []; }
    }
    let coBrowsing = row.co_browsing_state ?? row.coBrowsingState ?? {};
    if (typeof coBrowsing === 'string') {
      try { coBrowsing = JSON.parse(coBrowsing); } catch { coBrowsing = {}; }
    }
    if (!coBrowsing || typeof coBrowsing !== 'object' || Array.isArray(coBrowsing)) {
      coBrowsing = {};
    }
    return {
      id: row.id,
      chatNumber: row.chat_number ?? row.chatNumber,
      status: row.status,
      requesterType: row.requester_type ?? row.requesterType ?? 'guest',
      userId: row.user_id ?? row.userId ?? null,
      guestSessionId: row.guest_session_id ?? row.guestSessionId ?? null,
      guestName: row.guest_name ?? row.guestName ?? null,
      guestEmail: row.guest_email ?? row.guestEmail ?? null,
      guestPhone: row.guest_phone ?? row.guestPhone ?? null,
      requesterIpHash: row.requester_ip_hash ?? row.requesterIpHash ?? null,
      requesterDeviceHash: row.requester_device_hash ?? row.requesterDeviceHash ?? null,
      requesterNetworkHints: Array.isArray(row.requester_network_hints ?? row.requesterNetworkHints)
        ? (row.requester_network_hints ?? row.requesterNetworkHints)
        : [],
      coBrowsingState: {
        enabled: Boolean(coBrowsing.enabled),
        route: coBrowsing.route ? String(coBrowsing.route).slice(0, 240) : null,
        scrollPct: Number.isFinite(Number(coBrowsing.scrollPct)) ? Math.max(0, Math.min(100, Number(coBrowsing.scrollPct))) : 0,
        viewport: coBrowsing.viewport ? String(coBrowsing.viewport).slice(0, 64) : null,
        highlightSelector: coBrowsing.highlightSelector ? String(coBrowsing.highlightSelector).slice(0, 120) : null,
        agentGuidanceNote: coBrowsing.agentGuidanceNote ? String(coBrowsing.agentGuidanceNote).slice(0, 300) : null,
        updatedAt: coBrowsing.updatedAt || null
      },
      topic: row.topic ?? 'General Support',
      department: row.department ?? 'General Support',
      assignedAgentId: row.assigned_agent_id ?? row.assignedAgentId ?? null,
      assignedAgentName: row.assigned_agent_name ?? row.assignedAgentName ?? null,
      assignedAgentRole: row.assigned_agent_role ?? row.assignedAgentRole ?? null,
      joinedAt: row.joined_at ? new Date(row.joined_at).toISOString() : (row.joinedAt || new Date().toISOString()),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : (row.acceptedAt || null),
      heldAt: row.held_at ? new Date(row.held_at).toISOString() : (row.heldAt || null),
      closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : (row.closedAt || null),
      awaitingCustomerSince: row.awaiting_customer_since
        ? new Date(row.awaiting_customer_since).toISOString()
        : (row.awaitingCustomerSince || null),
      firstResponseMs: row.first_response_ms !== null && row.first_response_ms !== undefined ? Number(row.first_response_ms) : null,
      queueWaitMs: row.queue_wait_ms !== null && row.queue_wait_ms !== undefined ? Number(row.queue_wait_ms) : null,
      customerMessagesCount: Number(row.customer_messages_count ?? row.customerMessagesCount ?? 0),
      staffMessagesCount: Number(row.staff_messages_count ?? row.staffMessagesCount ?? 0),
      collusionScore: Number(row.collusion_score ?? row.collusionScore ?? 0),
      collusionFlags: Array.isArray(flags) ? flags : [],
      sentimentLabel: row.sentiment_label ?? row.sentimentLabel ?? 'neutral',
      sentimentScore: Number(row.sentiment_score ?? row.sentimentScore ?? 0),
      convertedTicketId: row.converted_ticket_id ?? row.convertedTicketId ?? null,
      convertedTicketNumber: row.converted_ticket_number ?? row.convertedTicketNumber ?? null,
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : (row.lastMessageAt || null),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : (row.updatedAt || null)
    };
  }

  function mapMessageRow(row) {
    return {
      id: row.id,
      chatId: row.chat_id ?? row.chatId,
      senderType: row.sender_type ?? row.senderType,
      senderId: row.sender_id ?? row.senderId ?? null,
      senderName: row.sender_name ?? row.senderName ?? 'Support',
      body: row.body,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : (row.createdAt || new Date().toISOString())
    };
  }

  function sanitizeChatForCustomer(chat) {
    if (!chat) return null;
    // IMPORTANT: Never expose internal staff role, agent email, IP/device hashes, or collusion forensics to customer!
    return {
      id: chat.id,
      chatNumber: chat.chatNumber,
      status: chat.status,
      topic: chat.topic,
      department: chat.department,
      assignedAgent: chat.assignedAgentId
        ? {
            id: chat.assignedAgentId,
            displayName: chat.assignedAgentName || 'Support Specialist'
          }
        : null,
      coBrowsing: chat.coBrowsingState || { enabled: false },
      joinedAt: chat.joinedAt,
      acceptedAt: chat.acceptedAt,
      heldAt: chat.heldAt,
      closedAt: chat.closedAt,
      convertedTicketNumber: chat.convertedTicketNumber,
      lastMessageAt: chat.lastMessageAt
    };
  }

  function sanitizeChatForAdmin(chat, { requesterIsSuperAdmin = false } = {}) {
    if (!chat) return null;
    const maskedIp = requesterIsSuperAdmin
      ? chat.requesterIpHash
      : (chat.requesterIpHash ? `ip_${String(chat.requesterIpHash).slice(0, 8)}***` : null);
    const maskedDevice = requesterIsSuperAdmin
      ? chat.requesterDeviceHash
      : (chat.requesterDeviceHash ? `dev_${String(chat.requesterDeviceHash).slice(0, 8)}***` : null);
    const maskedPhone = requesterIsSuperAdmin || !chat.guestPhone
      ? chat.guestPhone
      : `${String(chat.guestPhone).slice(0, 3)}****${String(chat.guestPhone).slice(-2)}`;
    return {
      ...chat,
      requesterIpHash: maskedIp,
      requesterDeviceHash: maskedDevice,
      guestPhone: maskedPhone,
      // Mask internal role column if viewer is not super_admin ("স্টাফ রোল দেখতে পারবে না")
      assignedAgentRole: requesterIsSuperAdmin ? chat.assignedAgentRole : null,
      requesterNetworkHints: requesterIsSuperAdmin ? (chat.requesterNetworkHints || []) : [],
      collusionFlags: requesterIsSuperAdmin ? (chat.collusionFlags || []) : [],
      isFlaggedSelfChat: chat.collusionScore >= 50
    };
  }

  function canStaffViewChat(chat, staffActor) {
    if (!chat || !staffActor) return false;
    if (isSuperAdminActor(staffActor)) return true;

    // Waiting queue items are visible to authorized staff so anyone available can Accept
    if (chat.status === 'waiting') return true;

    // Strict active chat isolation: while active, ONLY the assigned agent (and super_admin above) can view or search!
    if (chat.status === 'active') {
      return Boolean(chat.assignedAgentId && String(chat.assignedAgentId) === String(staffActor.id));
    }

    // Once placed on hold or closed/cancelled, authorized staff can view & inspect it (including by chat/ticket number)
    if (chat.status === 'on_hold' || chat.status === 'closed' || chat.status === 'cancelled') {
      return true;
    }

    return false;
  }

  function isCustomerOwner(chat, { authUser = null, guestSession = null } = {}) {
    if (!chat) return false;
    if (authUser?.id && chat.userId && String(chat.userId) === String(authUser.id)) return true;
    if (guestSession?.id && chat.guestSessionId && String(chat.guestSessionId) === String(guestSession.id)) return true;
    return false;
  }

  async function getAllChatsRaw() {
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(`SELECT * FROM support_live_chat_requests ORDER BY joined_at ASC, id ASC`);
      return (rows || []).map(mapChatRow);
    }
    return [...mem.chats]
      .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt) || String(a.id).localeCompare(String(b.id)))
      .map(mapChatRow);
  }

  async function findChatByIdOrNumber(idOrNumber) {
    const clean = String(idOrNumber || '').trim();
    if (!clean) return null;
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(
        `SELECT * FROM support_live_chat_requests
         WHERE id = $1 OR UPPER(chat_number) = UPPER($1) OR UPPER(converted_ticket_number) = UPPER($1)
         LIMIT 1`,
        [clean]
      );
      return rows?.[0] ? mapChatRow(rows[0]) : null;
    }
    const found = mem.chats.find(
      (c) =>
        c.id === clean ||
        String(c.chatNumber || '').toUpperCase() === clean.toUpperCase() ||
        String(c.convertedTicketNumber || '').toUpperCase() === clean.toUpperCase()
    );
    return found ? mapChatRow(found) : null;
  }

  async function listMessagesRaw(chatId) {
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(
        `SELECT * FROM support_live_chat_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
        [chatId]
      );
      return (rows || []).map(mapMessageRow);
    }
    return [...(mem.messages.get(chatId) || [])]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map(mapMessageRow);
  }

  async function recordForensicLog({ staffActor, chat, collusion, nowMs = Date.now() }) {
    if (!collusion || collusion.collusionScore < 25) return null;
    const severity = collusion.collusionScore >= 75 ? 'critical' : collusion.collusionScore >= 50 ? 'high' : 'warning';
    const entry = {
      id: `flog_${randomUUID()}`,
      staffId: String(staffActor?.id || chat?.assignedAgentId || 'unknown'),
      staffName: String(staffActor?.name || chat?.assignedAgentName || 'Support Staff').slice(0, 160),
      chatId: chat?.id || null,
      chatNumber: chat?.chatNumber || null,
      severity,
      collusionScore: collusion.collusionScore,
      signals: collusion.flags || [],
      evidence: collusion.evidence || {},
      detectedAt: new Date(nowMs).toISOString()
    };
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_staff_forensic_logs
           (id, staff_id, staff_name, chat_id, chat_number, severity, collusion_score, signals, evidence, detected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
        [
          entry.id, entry.staffId, entry.staffName, entry.chatId, entry.chatNumber,
          entry.severity, entry.collusionScore, JSON.stringify(entry.signals), JSON.stringify(entry.evidence), entry.detectedAt
        ]
      );
    } else {
      mem.forensicLogs.unshift(entry);
      if (mem.forensicLogs.length > 500) mem.forensicLogs.length = 500;
    }
    return entry;
  }

  async function listForensicAuditLogs({ limit = 50, severity = '', staffId = '' } = {}) {
    let logs = [];
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(
        `SELECT * FROM support_staff_forensic_logs ORDER BY detected_at DESC LIMIT $1`,
        [Math.min(200, Math.max(1, Number(limit) || 50))]
      );
      logs = (rows || []).map((r) => ({
        id: r.id,
        staffId: r.staff_id,
        staffName: r.staff_name,
        chatId: r.chat_id,
        chatNumber: r.chat_number,
        severity: r.severity,
        collusionScore: Number(r.collusion_score || 0),
        signals: Array.isArray(r.signals) ? r.signals : [],
        evidence: r.evidence && typeof r.evidence === 'object' ? r.evidence : {},
        detectedAt: r.detected_at ? new Date(r.detected_at).toISOString() : null
      }));
    } else {
      logs = [...mem.forensicLogs];
    }
    return logs
      .filter((l) => !severity || l.severity === severity)
      .filter((l) => !staffId || l.staffId === staffId)
      .slice(0, Math.min(200, Math.max(1, Number(limit) || 50)));
  }

  async function appendMessage({ chatId, senderType, senderId = null, senderName = 'Support', body, nowMs = Date.now() }) {
    const cleanBody = String(body || '').replace(/\0/g, '').trim();
    if (!cleanBody) {
      throw new LiveChatQueueError('Message cannot be empty.', { statusCode: 400, code: 'EMPTY_MESSAGE' });
    }
    const msg = {
      id: `lcmsg_${randomUUID()}`,
      chatId,
      senderType,
      senderId: senderId ? String(senderId) : null,
      senderName: String(senderName || 'Support').slice(0, 160),
      body: cleanBody.slice(0, 4000),
      createdAt: new Date(nowMs).toISOString()
    };

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_live_chat_messages (id, chat_id, sender_type, sender_id, sender_name, body, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [msg.id, msg.chatId, msg.senderType, msg.senderId, msg.senderName, msg.body, msg.createdAt]
      );
    } else {
      const list = mem.messages.get(chatId) || [];
      list.push(msg);
      mem.messages.set(chatId, list);
    }
    return msg;
  }

  async function heartbeatAgentPresence(agent, { isOnline = true, req = null, nowMs = Date.now() } = {}) {
    if (!agent?.id) return null;
    const ip = extractClientIp(req);
    const ipHash = ip ? sha256Hex(ip) : null;
    const deviceHash = extractDeviceFingerprint(req);
    const nowIso = new Date(nowMs).toISOString();

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_agent_presence
           (agent_id, agent_name, agent_role, is_online, last_ip_hash, last_device_hash, last_heartbeat_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (agent_id) DO UPDATE SET
           agent_name = EXCLUDED.agent_name,
           agent_role = EXCLUDED.agent_role,
           is_online = EXCLUDED.is_online,
           last_ip_hash = COALESCE(EXCLUDED.last_ip_hash, support_agent_presence.last_ip_hash),
           last_device_hash = COALESCE(EXCLUDED.last_device_hash, support_agent_presence.last_device_hash),
           last_heartbeat_at = EXCLUDED.last_heartbeat_at,
           updated_at = EXCLUDED.updated_at`,
        [
          String(agent.id),
          String(agent.name || agent.username || 'Staff').slice(0, 160),
          String(agent.role || 'support_agent').slice(0, 64),
          Boolean(isOnline),
          ipHash,
          deviceHash,
          nowIso
        ]
      );
    } else {
      const existing = mem.presence.get(String(agent.id)) || {};
      mem.presence.set(String(agent.id), {
        agentId: String(agent.id),
        agentName: String(agent.name || agent.username || 'Staff').slice(0, 160),
        agentRole: String(agent.role || 'support_agent').slice(0, 64),
        isOnline: Boolean(isOnline),
        lastIpHash: ipHash || existing.lastIpHash || null,
        lastDeviceHash: deviceHash || existing.lastDeviceHash || null,
        lastHeartbeatAt: nowIso
      });
    }
    return { agentId: String(agent.id), isOnline: Boolean(isOnline), lastHeartbeatAt: nowIso };
  }

  async function getOnlineAgentsSummary(nowMs = Date.now()) {
    const allChats = await getAllChatsRaw();
    const busyAgentIds = new Set(
      allChats.filter((c) => c.status === 'active' && c.assignedAgentId).map((c) => String(c.assignedAgentId))
    );

    let onlineRows = [];
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(`SELECT * FROM support_agent_presence WHERE is_online = TRUE`);
      onlineRows = (rows || []).map((r) => ({
        agentId: r.agent_id,
        lastHeartbeatAt: r.last_heartbeat_at ? new Date(r.last_heartbeat_at).toISOString() : null
      }));
    } else {
      onlineRows = Array.from(mem.presence.values()).filter((p) => p.isOnline);
    }

    const activeOnline = onlineRows.filter((p) => {
      const hb = Date.parse(p.lastHeartbeatAt || 0);
      return Number.isFinite(hb) && (nowMs - hb) <= ONLINE_HEARTBEAT_TTL_MS;
    });

    const onlineAgentsCount = activeOnline.length;
    const freeAgentsCount = activeOnline.filter((p) => !busyAgentIds.has(String(p.agentId))).length;
    return {
      onlineAgentsCount,
      freeAgentsCount,
      busyAgentsCount: Math.max(0, onlineAgentsCount - freeAgentsCount)
    };
  }

  async function computeQueueTelemetryForChat(chat, nowMs = Date.now()) {
    const allChats = await getAllChatsRaw();
    const waitingList = allChats
      .filter((c) => c.status === 'waiting')
      .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt) || String(a.id).localeCompare(String(b.id)));

    const totalWaiting = waitingList.length;
    const idx = chat ? waitingList.findIndex((c) => c.id === chat.id) : -1;
    const queuePosition = idx >= 0 ? idx + 1 : 0;

    const presenceStats = await getOnlineAgentsSummary(nowMs);

    // Estimate wait time dynamically from real non-flagged historical first_response_ms (no fake static guesswork if real samples exist)
    const validFirstResps = allChats
      .filter((c) => c.firstResponseMs !== null && c.firstResponseMs > 0 && c.collusionScore < 50)
      .map((c) => Number(c.firstResponseMs));
    const avgFirstRespSec = validFirstResps.length > 0
      ? Math.round(validFirstResps.reduce((s, n) => s + n, 0) / validFirstResps.length / 1000)
      : null;

    const parallelCapacity = Math.max(1, presenceStats.onlineAgentsCount || 1);
    const estimatedWaitSeconds = queuePosition > 0 && avgFirstRespSec !== null
      ? Math.max(15, Math.round((queuePosition / parallelCapacity) * avgFirstRespSec))
      : null;

    return {
      queuePosition,
      totalWaiting,
      onlineAgentsCount: presenceStats.onlineAgentsCount,
      freeAgentsCount: presenceStats.freeAgentsCount,
      estimatedWaitSeconds
    };
  }

  async function requestLiveChat({
    authUser = null,
    guestSession = null,
    guestName = null,
    guestEmail = null,
    guestPhone = null,
    topic = 'Live Support Request',
    department = 'General Support',
    initialMessage = '',
    req = null,
    nowMs = Date.now()
  } = {}) {
    const settings = await getChatSettingsFn().catch(() => ({ liveChatWidgetEnabled: true, enabled: true }));
    if (settings.liveChatWidgetEnabled === false) {
      throw new LiveChatQueueError('Live chat is currently disabled by administrators.', {
        statusCode: 503,
        code: 'LIVE_CHAT_DISABLED'
      });
    }

    // Hard-block banned, disabled, or high-fraud accounts from Live Chat (route to Support Appeal Ticket only!)
    const acctStatus = String(authUser?.status || '').trim().toLowerCase();
    const numericRiskScore = Number(authUser?.riskScore ?? authUser?.fraudScore ?? 0);
    if (
      authUser &&
      (authUser.isBanned === true ||
        ['banned', 'disabled', 'suspended'].includes(acctStatus) ||
        (Number.isFinite(numericRiskScore) && numericRiskScore >= 80))
    ) {
      throw new LiveChatQueueError(
        'Live chat is disabled for restricted or high-risk accounts. Please open a Support Appeal Ticket.',
        {
          statusCode: 403,
          code: 'LIVE_CHAT_BLOCKED_HIGH_FRAUD'
        }
      );
    }

    const isAuthed = Boolean(authUser?.id);
    if (!isAuthed) {
      const nameClean = String(guestName || guestSession?.guestName || '').trim();
      const emailClean = String(guestEmail || guestSession?.guestEmail || '').trim();
      const phoneClean = String(guestPhone || guestSession?.guestPhone || '').trim();
      if (nameClean.length < 2 || !emailClean.includes('@') || phoneClean.replace(/\D/g, '').length < 6) {
        throw new LiveChatQueueError('Guest full name, email address, and phone number are required before starting live chat.', {
          statusCode: 400,
          code: 'GUEST_CONTACT_REQUIRED'
        });
      }
      guestName = nameClean;
      guestEmail = emailClean.toLowerCase();
      guestPhone = phoneClean;
    }

    // Reconnect existing unresolved session for this requester
    const existingAll = await getAllChatsRaw();
    const existingOpen = existingAll.find(
      (c) =>
        ['waiting', 'active', 'on_hold'].includes(c.status) &&
        isCustomerOwner(c, { authUser, guestSession })
    );
    if (existingOpen) {
      const [messages, queue] = await Promise.all([
        listMessagesRaw(existingOpen.id),
        computeQueueTelemetryForChat(existingOpen, nowMs)
      ]);
      return {
        reused: true,
        chat: sanitizeChatForCustomer(existingOpen),
        messages,
        queue
      };
    }

    const ip = extractClientIp(req);
    const ipHash = ip ? sha256Hex(ip) : null;
    const deviceHash = extractDeviceFingerprint(req);
    const networkHints = detectProxyOrVpnHints(req);
    const nowIso = new Date(nowMs).toISOString();
    const chat = {
      id: `lchat_${randomUUID()}`,
      chatNumber: generateChatNumber(),
      status: 'waiting',
      requesterType: isAuthed ? 'user' : 'guest',
      userId: isAuthed ? String(authUser.id) : null,
      guestSessionId: !isAuthed && guestSession?.id ? String(guestSession.id) : null,
      guestName: isAuthed ? (authUser.name || authUser.username || 'Customer') : guestName,
      guestEmail: isAuthed ? (authUser.email || null) : guestEmail,
      guestPhone: isAuthed ? (authUser.phone || null) : guestPhone,
      requesterIpHash: ipHash,
      requesterDeviceHash: deviceHash,
      requesterNetworkHints: networkHints,
      topic: String(topic || 'Live Support Request').trim().slice(0, 200),
      department: String(department || 'General Support').trim().slice(0, 64),
      assignedAgentId: null,
      assignedAgentName: null,
      assignedAgentRole: null,
      joinedAt: nowIso,
      acceptedAt: null,
      heldAt: null,
      closedAt: null,
      awaitingCustomerSince: nowIso,
      firstResponseMs: null,
      queueWaitMs: null,
      customerMessagesCount: 0,
      staffMessagesCount: 0,
      collusionScore: 0,
      collusionFlags: [],
      sentimentLabel: 'neutral',
      sentimentScore: 0,
      convertedTicketId: null,
      convertedTicketNumber: null,
      lastMessageAt: nowIso,
      updatedAt: nowIso
    };

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_live_chat_requests (
           id, chat_number, status, requester_type, user_id, guest_session_id,
           guest_name, guest_email, guest_phone, requester_ip_hash, requester_device_hash,
           requester_network_hints, topic, department, joined_at, awaiting_customer_since, last_message_at, updated_at
         ) VALUES ($1,$2,'waiting',$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$14,$14,$14)`,
        [
          chat.id, chat.chatNumber, chat.requesterType, chat.userId, chat.guestSessionId,
          chat.guestName, chat.guestEmail, chat.guestPhone, chat.requesterIpHash, chat.requesterDeviceHash,
          JSON.stringify(chat.requesterNetworkHints || []), chat.topic, chat.department, nowIso
        ]
      );
    } else {
      mem.chats.push(chat);
    }

    if (String(initialMessage || '').trim()) {
      await appendMessage({
        chatId: chat.id,
        senderType: 'customer',
        senderId: chat.userId || chat.guestSessionId,
        senderName: chat.guestName || 'Customer',
        body: initialMessage,
        nowMs
      });
      await updateChatCountersAfterCustomerMessage(chat.id, nowMs);
    }

    const queue = await computeQueueTelemetryForChat(chat, nowMs);
    if (settings?.enabled === false || settings?.aiAutoReplyEnabled !== true) {
      await appendMessage({
        chatId: chat.id,
        senderType: 'system',
        senderId: 'system',
        senderName: 'Tiwlo Queue',
        body: `Your live chat has been transferred to our human support queue. Queue Position: #${queue.queuePosition || 1} • Online Agents Available: ${queue.freeAgentsCount ?? queue.onlineAgentsCount ?? 0}.`,
        nowMs: nowMs + 1
      });
    }

    const [freshChat, messages] = await Promise.all([
      findChatByIdOrNumber(chat.id),
      listMessagesRaw(chat.id)
    ]);

    return {
      reused: false,
      chat: sanitizeChatForCustomer(freshChat),
      messages,
      queue
    };
  }

  async function updateChatCountersAfterCustomerMessage(chatId, nowMs = Date.now()) {
    const msgs = await listMessagesRaw(chatId);
    const sentiment = computeSentimentScore(msgs);
    const nowIso = new Date(nowMs).toISOString();
    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_live_chat_requests
         SET customer_messages_count = customer_messages_count + 1,
             awaiting_customer_since = COALESCE(awaiting_customer_since, $2),
             sentiment_label = $3,
             sentiment_score = $4,
             last_message_at = $2,
             updated_at = $2
         WHERE id = $1`,
        [chatId, nowIso, sentiment.label, sentiment.score]
      );
    } else {
      const target = mem.chats.find((c) => c.id === chatId);
      if (target) {
        target.customerMessagesCount = Number(target.customerMessagesCount || 0) + 1;
        if (!target.awaitingCustomerSince) target.awaitingCustomerSince = nowIso;
        target.sentimentLabel = sentiment.label;
        target.sentimentScore = sentiment.score;
        target.lastMessageAt = nowIso;
        target.updatedAt = nowIso;
      }
    }
  }

  async function getCustomerLiveChatStatus({ chatId, authUser = null, guestSession = null, nowMs = Date.now() } = {}) {
    let chat = null;
    if (chatId) {
      chat = await findChatByIdOrNumber(chatId);
    } else {
      const all = await getAllChatsRaw();
      chat = all.find((c) => ['waiting', 'active', 'on_hold'].includes(c.status) && isCustomerOwner(c, { authUser, guestSession }))
        || all.filter((c) => isCustomerOwner(c, { authUser, guestSession })).slice(-1)[0]
        || null;
    }

    if (!chat) {
      const presence = await getOnlineAgentsSummary(nowMs);
      const all = await getAllChatsRaw();
      return {
        chat: null,
        messages: [],
        queue: {
          queuePosition: 0,
          totalWaiting: all.filter((c) => c.status === 'waiting').length,
          onlineAgentsCount: presence.onlineAgentsCount,
          freeAgentsCount: presence.freeAgentsCount,
          estimatedWaitSeconds: null
        }
      };
    }

    if (!isCustomerOwner(chat, { authUser, guestSession })) {
      throw new LiveChatQueueError('Not authorized to access this live chat session.', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    const [messages, queue] = await Promise.all([
      listMessagesRaw(chat.id),
      computeQueueTelemetryForChat(chat, nowMs)
    ]);

    return {
      chat: sanitizeChatForCustomer(chat),
      messages,
      queue
    };
  }

  async function sendCustomerLiveChatMessage({ chatId, body, authUser = null, guestSession = null, nowMs = Date.now() } = {}) {
    const chat = await findChatByIdOrNumber(chatId);
    if (!chat) {
      throw new LiveChatQueueError('Live chat session not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    if (!isCustomerOwner(chat, { authUser, guestSession })) {
      throw new LiveChatQueueError('Not authorized to message in this chat.', { statusCode: 403, code: 'FORBIDDEN' });
    }
    if (chat.status === 'closed' || chat.status === 'cancelled') {
      throw new LiveChatQueueError('This live chat session is closed.', { statusCode: 403, code: 'CHAT_CLOSED' });
    }

    const message = await appendMessage({
      chatId: chat.id,
      senderType: 'customer',
      senderId: authUser?.id || guestSession?.id || null,
      senderName: authUser?.name || chat.guestName || 'Customer',
      body,
      nowMs
    });
    await updateChatCountersAfterCustomerMessage(chat.id, nowMs);

    // Optional instant AI auto-assist if chat is still waiting in queue & AI auto-reply is enabled
    let aiReply = null;
    if (chat.status === 'waiting') {
      try {
        const settings = await getChatSettingsFn();
        if (settings?.enabled !== false && settings?.aiAutoReplyEnabled === true) {
          const allMsgs = await listMessagesRaw(chat.id);
          const transcript = allMsgs.slice(-6).map((m) => `${m.senderName}: ${m.body}`).join('\n');
          const res = await executeAiFn({
            payload: {
              contents: [{
                parts: [{
                  text: `You are Tiwlo Support Assistant. A customer is currently waiting in the live support queue (${chat.topic}). Give a concise, helpful, polite response or troubleshooting step while they wait for a human specialist.\n\nTranscript:\n${transcript}`
                }]
              }]
            }
          });
          if (res?.ok && res?.text) {
            aiReply = await appendMessage({
              chatId: chat.id,
              senderType: 'ai',
              senderId: 'tiwi_ai',
              senderName: 'Tiwi AI Assistant',
              body: res.text.trim(),
              nowMs: nowMs + 1
            });
          }
        }
      } catch {
        // Never fail customer message if AI fallback is unavailable
      }
    }

    const [freshChat, messages, queue] = await Promise.all([
      findChatByIdOrNumber(chat.id),
      listMessagesRaw(chat.id),
      computeQueueTelemetryForChat(chat, nowMs)
    ]);
    return {
      message,
      aiReply,
      chat: sanitizeChatForCustomer(freshChat),
      messages,
      queue
    };
  }

  async function acceptLiveChatRequest(chatIdOrNumber, staffActor, { req = null, nowMs = Date.now() } = {}) {
    if (!staffActor?.id) {
      throw new LiveChatQueueError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat request not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    if (chat.status === 'active' && String(chat.assignedAgentId) !== String(staffActor.id)) {
      throw new LiveChatQueueError('This live chat has already been accepted by another specialist.', {
        statusCode: 409,
        code: 'ALREADY_ACCEPTED'
      });
    }
    if (chat.status === 'closed' || chat.status === 'cancelled') {
      throw new LiveChatQueueError('Cannot accept a closed live chat.', { statusCode: 400, code: 'CHAT_CLOSED' });
    }

    await heartbeatAgentPresence(staffActor, { isOnline: true, req, nowMs });

    // Gather anti-collusion context
    const allChats = await getAllChatsRaw();
    const samePairCount = allChats.filter(
      (c) =>
        c.id !== chat.id &&
        String(c.assignedAgentId || '') === String(staffActor.id) &&
        ((chat.userId && c.userId === chat.userId) ||
          (chat.guestEmail && c.guestEmail === chat.guestEmail) ||
          (chat.requesterIpHash && c.requesterIpHash === chat.requesterIpHash))
    ).length;

    let knownIps = [];
    if (isUsingPg()) {
      const { rows: pRows } = await queryPgFn(
        `SELECT last_ip_hash FROM support_agent_presence WHERE agent_id = $1`,
        [String(staffActor.id)]
      );
      knownIps = (pRows || []).map((r) => r.last_ip_hash).filter(Boolean);
    } else {
      const pr = mem.presence.get(String(staffActor.id));
      if (pr?.lastIpHash) knownIps.push(pr.lastIpHash);
    }

    const recentMsgs = await listMessagesRaw(chat.id);
    const nowIso = new Date(nowMs).toISOString();
    const queueWaitMs = Math.max(0, nowMs - Date.parse(chat.joinedAt));

    const collusion = evaluateCollusionSignals({
      chat: { ...chat, acceptedAt: nowIso },
      staffActor,
      staffReq: req,
      staffKnownIpHashes: knownIps,
      samePairCount,
      recentMessages: recentMsgs
    });

    if (isUsingPg()) {
      const res = await queryPgFn(
        `UPDATE support_live_chat_requests
         SET status = 'active',
             assigned_agent_id = $2,
             assigned_agent_name = $3,
             assigned_agent_role = $4,
             accepted_at = COALESCE(accepted_at, $5),
             queue_wait_ms = COALESCE(queue_wait_ms, $6),
             awaiting_customer_since = COALESCE(awaiting_customer_since, $5),
             collusion_score = GREATEST(collusion_score, $7),
             collusion_flags = $8::jsonb,
             updated_at = $5
         WHERE id = $1 AND status IN ('waiting', 'on_hold', 'active')
         RETURNING *`,
        [
          chat.id,
          String(staffActor.id),
          String(staffActor.name || staffActor.username || 'Support Specialist').slice(0, 160),
          String(staffActor.role || 'support_agent').slice(0, 64),
          nowIso,
          queueWaitMs,
          collusion.collusionScore,
          JSON.stringify(collusion.flags)
        ]
      );
      if (!res.rows?.length) {
        throw new LiveChatQueueError('Chat could not be accepted in its current state.', { statusCode: 409, code: 'CONFLICT' });
      }
    } else {
      const target = mem.chats.find((c) => c.id === chat.id);
      target.status = 'active';
      target.assignedAgentId = String(staffActor.id);
      target.assignedAgentName = String(staffActor.name || staffActor.username || 'Support Specialist').slice(0, 160);
      target.assignedAgentRole = String(staffActor.role || 'support_agent').slice(0, 64);
      target.acceptedAt ||= nowIso;
      target.queueWaitMs ??= queueWaitMs;
      target.awaitingCustomerSince ||= nowIso;
      target.collusionScore = Math.max(Number(target.collusionScore || 0), collusion.collusionScore);
      target.collusionFlags = collusion.flags;
      target.updatedAt = nowIso;
    }

    await appendMessage({
      chatId: chat.id,
      senderType: 'system',
      senderId: 'system',
      senderName: 'System',
      body: `${staffActor.name || 'Support Specialist'} joined the conversation.`,
      nowMs
    });

    const [freshChat, messages] = await Promise.all([
      findChatByIdOrNumber(chat.id),
      listMessagesRaw(chat.id)
    ]);

    if (collusion.collusionScore >= 25) {
      await recordForensicLog({ staffActor, chat: freshChat, collusion, nowMs });
    }

    return {
      chat: sanitizeChatForAdmin(freshChat, { requesterIsSuperAdmin: isSuperAdminActor(staffActor) }),
      messages
    };
  }

  async function recordStaffResponseSample({ chat, staffActor, sampleType, responseMs, nowIso }) {
    const isFlagged = Number(chat.collusionScore || 0) >= 50;
    const exclusionReason = isFlagged
      ? `Collusion risk (${(chat.collusionFlags || []).join(', ') || `score=${chat.collusionScore}`})`
      : null;

    const sample = {
      id: `srs_${randomUUID()}`,
      staffId: String(staffActor.id),
      staffName: String(staffActor.name || staffActor.username || 'Staff').slice(0, 160),
      chatId: chat.id,
      sampleType,
      responseMs: Math.max(0, Math.round(responseMs)),
      isFlagged,
      exclusionReason,
      respondedAt: nowIso
    };

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_staff_response_samples
           (id, staff_id, staff_name, chat_id, sample_type, response_ms, is_flagged, exclusion_reason, responded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sample.id, sample.staffId, sample.staffName, sample.chatId,
          sample.sampleType, sample.responseMs, sample.isFlagged, sample.exclusionReason, sample.respondedAt
        ]
      );
    } else {
      mem.samples.push(sample);
    }
    return sample;
  }

  async function sendStaffLiveChatReply(chatIdOrNumber, { body, staffActor, req = null, nowMs = Date.now() } = {}) {
    if (!staffActor?.id) {
      throw new LiveChatQueueError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    if (chat.status === 'closed' || chat.status === 'cancelled') {
      throw new LiveChatQueueError('Cannot reply to a closed live chat.', { statusCode: 403, code: 'CHAT_CLOSED' });
    }
    const superAdmin = isSuperAdminActor(staffActor);
    if (chat.status === 'active' && !superAdmin && String(chat.assignedAgentId) !== String(staffActor.id)) {
      throw new LiveChatQueueError('This live chat is actively handled by another specialist until held or closed.', {
        statusCode: 403,
        code: 'CHAT_ISOLATED_ACTIVE'
      });
    }

    await heartbeatAgentPresence(staffActor, { isOnline: true, req, nowMs });

    const nowIso = new Date(nowMs).toISOString();
    const message = await appendMessage({
      chatId: chat.id,
      senderType: 'staff',
      senderId: String(staffActor.id),
      senderName: staffActor.name || 'Support Specialist',
      body,
      nowMs
    });

    // Calculate reboot-resilient wall-clock response latency against awaitingCustomerSince (or acceptedAt)
    let recordedSample = null;
    const isFirstStaffReply = Number(chat.staffMessagesCount || 0) === 0;
    const anchorIso = isFirstStaffReply
      ? (chat.acceptedAt || chat.awaitingCustomerSince || chat.joinedAt)
      : chat.awaitingCustomerSince;

    if (anchorIso) {
      const responseMs = Math.max(0, nowMs - Date.parse(anchorIso));
      recordedSample = await recordStaffResponseSample({
        chat,
        staffActor,
        sampleType: isFirstStaffReply ? 'first_response' : 'turn_reply',
        responseMs,
        nowIso
      });
    }

    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_live_chat_requests
         SET staff_messages_count = staff_messages_count + 1,
             first_response_ms = CASE WHEN first_response_ms IS NULL THEN $2 ELSE first_response_ms END,
             awaiting_customer_since = NULL,
             last_message_at = $3,
             updated_at = $3
         WHERE id = $1`,
        [chat.id, recordedSample && isFirstStaffReply ? recordedSample.responseMs : null, nowIso]
      );
    } else {
      const target = mem.chats.find((c) => c.id === chat.id);
      target.staffMessagesCount = Number(target.staffMessagesCount || 0) + 1;
      if (target.firstResponseMs === null && recordedSample && isFirstStaffReply) {
        target.firstResponseMs = recordedSample.responseMs;
      }
      target.awaitingCustomerSince = null;
      target.lastMessageAt = nowIso;
      target.updatedAt = nowIso;
    }

    const [freshChat, messages] = await Promise.all([
      findChatByIdOrNumber(chat.id),
      listMessagesRaw(chat.id)
    ]);

    return {
      message,
      sample: recordedSample,
      chat: sanitizeChatForAdmin(freshChat, { requesterIsSuperAdmin: superAdmin }),
      messages
    };
  }

  async function holdLiveChatSession(chatIdOrNumber, { staffActor, reason = '', nowMs = Date.now() } = {}) {
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    const superAdmin = isSuperAdminActor(staffActor);
    if (!superAdmin && chat.assignedAgentId && String(chat.assignedAgentId) !== String(staffActor?.id)) {
      throw new LiveChatQueueError('Only the assigned specialist or Super Admin can hold this active chat.', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }
    if (chat.status === 'closed' || chat.status === 'cancelled') {
      throw new LiveChatQueueError('Closed chat cannot be placed on hold.', { statusCode: 400, code: 'CHAT_CLOSED' });
    }

    const nowIso = new Date(nowMs).toISOString();
    const clearedCoBrowse = { enabled: false, route: null, scrollPct: 0, highlightSelector: null, agentGuidanceNote: null, updatedAt: nowIso };
    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_live_chat_requests
         SET status = 'on_hold', held_at = $2, co_browsing_state = $3::jsonb, updated_at = $2
         WHERE id = $1`,
        [chat.id, nowIso, JSON.stringify(clearedCoBrowse)]
      );
    } else {
      const target = mem.chats.find((c) => c.id === chat.id);
      target.status = 'on_hold';
      target.heldAt = nowIso;
      target.coBrowsingState = clearedCoBrowse;
      target.updatedAt = nowIso;
    }

    await appendMessage({
      chatId: chat.id,
      senderType: 'system',
      senderId: 'system',
      senderName: 'System',
      body: reason ? `Conversation placed on hold: ${reason}` : 'Conversation placed on hold for follow-up.',
      nowMs
    });

    const freshChat = await findChatByIdOrNumber(chat.id);
    return sanitizeChatForAdmin(freshChat, { requesterIsSuperAdmin: superAdmin });
  }

  async function endLiveChatSession(chatIdOrNumber, { actor = null, actorType = 'staff', req = null, nowMs = Date.now() } = {}) {
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }

    const isStaff = actorType === 'staff';
    const superAdmin = isStaff && isSuperAdminActor(actor);
    if (isStaff) {
      if (chat.status === 'active' && !superAdmin && chat.assignedAgentId && String(chat.assignedAgentId) !== String(actor?.id)) {
        throw new LiveChatQueueError('Only the assigned specialist or Super Admin can close this active chat.', {
          statusCode: 403,
          code: 'FORBIDDEN'
        });
      }
    } else if (!isCustomerOwner(chat, { authUser: actor?.authUser, guestSession: actor?.guestSession })) {
      throw new LiveChatQueueError('Not authorized to end this live chat.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    const nowIso = new Date(nowMs).toISOString();
    const msgs = await listMessagesRaw(chat.id);
    const sentiment = computeSentimentScore(msgs);
    const collusion = isStaff && actor?.id
      ? evaluateCollusionSignals({
          chat: { ...chat, closedAt: nowIso },
          staffActor: actor,
          staffReq: req,
          recentMessages: msgs
        })
      : { collusionScore: chat.collusionScore, flags: chat.collusionFlags };

    const mergedFlags = [...new Set([...(chat.collusionFlags || []), ...(collusion.flags || [])])];
    const nextScore = Math.max(Number(chat.collusionScore || 0), Number(collusion.collusionScore || 0));

    const clearedCoBrowse = { enabled: false, route: null, scrollPct: 0, highlightSelector: null, agentGuidanceNote: null, updatedAt: nowIso };
    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_live_chat_requests
         SET status = 'closed',
             closed_at = $2,
             awaiting_customer_since = NULL,
             sentiment_label = $3,
             sentiment_score = $4,
             collusion_score = $5,
             collusion_flags = $6::jsonb,
             co_browsing_state = $7::jsonb,
             updated_at = $2
         WHERE id = $1`,
        [chat.id, nowIso, sentiment.label, sentiment.score, nextScore, JSON.stringify(mergedFlags), JSON.stringify(clearedCoBrowse)]
      );
      if (nextScore >= 50) {
        await queryPgFn(
          `UPDATE support_staff_response_samples
           SET is_flagged = TRUE,
               exclusion_reason = COALESCE(exclusion_reason, $2)
           WHERE chat_id = $1`,
          [chat.id, `Collusion risk (${mergedFlags.join(', ')})`]
        );
      }
    } else {
      const target = mem.chats.find((c) => c.id === chat.id);
      target.status = 'closed';
      target.closedAt = nowIso;
      target.awaitingCustomerSince = null;
      target.sentimentLabel = sentiment.label;
      target.sentimentScore = sentiment.score;
      target.collusionScore = nextScore;
      target.collusionFlags = mergedFlags;
      target.coBrowsingState = clearedCoBrowse;
      target.updatedAt = nowIso;
      if (nextScore >= 50) {
        for (const s of mem.samples) {
          if (s.chatId === chat.id) {
            s.isFlagged = true;
            s.exclusionReason ||= `Collusion risk (${mergedFlags.join(', ')})`;
          }
        }
      }
    }

    await appendMessage({
      chatId: chat.id,
      senderType: 'system',
      senderId: 'system',
      senderName: 'System',
      body: isStaff ? 'Conversation marked as resolved and closed.' : 'Customer ended the live chat.',
      nowMs
    });

    const fresh = await findChatByIdOrNumber(chat.id);
    if (isStaff && collusion.collusionScore >= 25) {
      await recordForensicLog({
        staffActor: actor,
        chat: fresh,
        collusion: { ...collusion, collusionScore: nextScore, flags: mergedFlags },
        nowMs
      });
    }
    return isStaff
      ? sanitizeChatForAdmin(fresh, { requesterIsSuperAdmin: superAdmin })
      : sanitizeChatForCustomer(fresh);
  }

  async function listAdminLiveChats({ status = '', q = '', staffActor = null, nowMs = Date.now() } = {}) {
    if (!staffActor?.id) {
      throw new LiveChatQueueError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const superAdmin = isSuperAdminActor(staffActor);
    const all = await getAllChatsRaw();

    const visible = all.filter((c) => canStaffViewChat(c, staffActor));
    const counts = {
      all: visible.length,
      waiting: 0,
      active: 0,
      on_hold: 0,
      closed: 0,
      myActive: 0,
      flagged: 0
    };

    for (const c of visible) {
      if (c.status === 'waiting') counts.waiting += 1;
      else if (c.status === 'active') counts.active += 1;
      else if (c.status === 'on_hold') counts.on_hold += 1;
      else if (c.status === 'closed' || c.status === 'cancelled') counts.closed += 1;
      if (c.status === 'active' && String(c.assignedAgentId) === String(staffActor.id)) counts.myActive += 1;
      if (c.collusionScore >= 50) counts.flagged += 1;
    }

    const queryLower = String(q || '').trim().toLowerCase();
    const filtered = visible
      .filter((c) => {
        if (!status || status === 'all') return true;
        if (status === 'my_active') return c.status === 'active' && String(c.assignedAgentId) === String(staffActor.id);
        if (status === 'flagged') return c.collusionScore >= 50;
        if (status === 'closed') return c.status === 'closed' || c.status === 'cancelled';
        return c.status === status;
      })
      .filter((c) => {
        if (!queryLower) return true;
        return [
          c.chatNumber,
          c.convertedTicketNumber,
          c.topic,
          c.guestName,
          c.guestEmail,
          c.guestPhone,
          c.assignedAgentName
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(queryLower));
      })
      .sort((a, b) => Date.parse(b.lastMessageAt || b.joinedAt) - Date.parse(a.lastMessageAt || a.joinedAt));

    const presence = await getOnlineAgentsSummary(nowMs);
    return {
      chats: filtered.map((c) => sanitizeChatForAdmin(c, { requesterIsSuperAdmin: superAdmin })),
      counts,
      presence
    };
  }

  async function getAdminLiveChatDetail(chatIdOrNumber, staffActor) {
    if (!staffActor?.id) {
      throw new LiveChatQueueError('Staff authentication required.', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    if (!canStaffViewChat(chat, staffActor)) {
      throw new LiveChatQueueError(
        'This conversation is actively isolated to its assigned specialist until placed on hold or closed.',
        { statusCode: 403, code: 'CHAT_ISOLATED_ACTIVE' }
      );
    }
    const messages = await listMessagesRaw(chat.id);
    return {
      chat: sanitizeChatForAdmin(chat, { requesterIsSuperAdmin: isSuperAdminActor(staffActor) }),
      messages
    };
  }

  async function linkConvertedTicket(chatIdOrNumber, { ticketId, ticketNumber } = {}) {
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) return null;
    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_live_chat_requests
         SET converted_ticket_id = $2, converted_ticket_number = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [chat.id, ticketId || null, ticketNumber || null]
      );
    } else {
      const target = mem.chats.find((c) => c.id === chat.id);
      if (target) {
        target.convertedTicketId = ticketId || null;
        target.convertedTicketNumber = ticketNumber || null;
      }
    }
    return findChatByIdOrNumber(chat.id);
  }

  async function getAllCsatRows() {
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(`SELECT * FROM support_csat_surveys ORDER BY created_at DESC LIMIT 1000`);
      return (rows || []).map((r) => {
        let tags = r.tags ?? [];
        if (typeof tags === 'string') {
          try { tags = JSON.parse(tags); } catch { tags = []; }
        }
        return {
          id: r.id,
          targetType: r.target_type,
          targetId: r.target_id,
          rating: Number(r.rating),
          tags: Array.isArray(tags) ? tags : [],
          comment: r.comment || '',
          staffId: r.staff_id || null,
          staffName: r.staff_name || null,
          requesterId: r.requester_id || null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
        };
      });
    }
    return [...mem.csatSurveys].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  async function getStaffPerformanceMetrics({ category = 'all', nowMs = Date.now() } = {}) {
    const allChats = await getAllChatsRaw();
    const csatRows = await getAllCsatRows();
    let rawSamples = [];
    let presenceRows = [];

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const [sRes, pRes] = await Promise.all([
        queryPgFn(`SELECT * FROM support_staff_response_samples ORDER BY responded_at DESC`),
        queryPgFn(`SELECT * FROM support_agent_presence`)
      ]);
      rawSamples = (sRes.rows || []).map((r) => ({
        id: r.id,
        staffId: r.staff_id,
        staffName: r.staff_name,
        chatId: r.chat_id,
        sampleType: r.sample_type,
        responseMs: Number(r.response_ms),
        isFlagged: Boolean(r.is_flagged),
        exclusionReason: r.exclusion_reason || null,
        respondedAt: r.responded_at ? new Date(r.responded_at).toISOString() : null
      }));
      presenceRows = (pRes.rows || []).map((r) => ({
        agentId: r.agent_id,
        agentName: r.agent_name,
        isOnline: Boolean(r.is_online),
        lastHeartbeatAt: r.last_heartbeat_at ? new Date(r.last_heartbeat_at).toISOString() : null
      }));
    } else {
      rawSamples = [...mem.samples];
      presenceRows = Array.from(mem.presence.values());
    }

    const byStaff = new Map();
    const ensureEntry = (staffId, staffName) => {
      if (!byStaff.has(staffId)) {
        byStaff.set(staffId, {
          staffId,
          staffName: staffName || 'Support Staff',
          isOnline: false,
          chatsAccepted: 0,
          activeChats: 0,
          onHoldChats: 0,
          closedChats: 0,
          validSamples: [],
          firstResponseSamples: [],
          flaggedSamplesCount: 0,
          flaggedChatsCount: 0,
          currentlyWaitingTurnCount: 0,
          longestCurrentWaitMs: 0,
          frustratedChatsCount: 0,
          satisfiedChatsCount: 0
        });
      }
      return byStaff.get(staffId);
    };

    for (const p of presenceRows) {
      const entry = ensureEntry(p.agentId, p.agentName);
      const hb = Date.parse(p.lastHeartbeatAt || 0);
      entry.isOnline = Boolean(p.isOnline && Number.isFinite(hb) && (nowMs - hb) <= ONLINE_HEARTBEAT_TTL_MS);
    }

    for (const c of allChats) {
      if (!c.assignedAgentId) continue;
      const entry = ensureEntry(c.assignedAgentId, c.assignedAgentName);
      entry.chatsAccepted += 1;
      if (c.status === 'active') entry.activeChats += 1;
      else if (c.status === 'on_hold') entry.onHoldChats += 1;
      else if (c.status === 'closed') entry.closedChats += 1;

      if (c.collusionScore >= 50) entry.flaggedChatsCount += 1;
      if (c.sentimentLabel === 'frustrated') entry.frustratedChatsCount += 1;
      if (c.sentimentLabel === 'satisfied') entry.satisfiedChatsCount += 1;

      if (c.status === 'active' && c.awaitingCustomerSince) {
        const waitMs = Math.max(0, nowMs - Date.parse(c.awaitingCustomerSince));
        entry.currentlyWaitingTurnCount += 1;
        if (waitMs > entry.longestCurrentWaitMs) {
          entry.longestCurrentWaitMs = waitMs;
        }
      }
    }

    for (const s of rawSamples) {
      const entry = ensureEntry(s.staffId, s.staffName);
      if (s.isFlagged) {
        entry.flaggedSamplesCount += 1;
        continue;
      }
      entry.validSamples.push(s.responseMs);
      if (s.sampleType === 'first_response') {
        entry.firstResponseSamples.push(s.responseMs);
      }
    }

    const staffMetrics = [];
    for (const entry of byStaff.values()) {
      const sorted = [...entry.validSamples].sort((a, b) => a - b);
      const count = sorted.length;
      const avgResponseMs = count > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / count) : null;
      const medianResponseMs = calculatePercentile(sorted, 50);
      const p95ResponseMs = calculatePercentile(sorted, 95);
      const fastestResponseMs = count > 0 ? sorted[0] : null;
      const slowestResponseMs = count > 0 ? sorted[count - 1] : null;
      const firstResponseAvgMs = entry.firstResponseSamples.length > 0
        ? Math.round(entry.firstResponseSamples.reduce((a, b) => a + b, 0) / entry.firstResponseSamples.length)
        : null;
      const slowResponsesCount = sorted.filter((ms) => ms > SLOW_RESPONSE_THRESHOLD_MS).length;
      const slaCompliancePct = count > 0
        ? Math.round(((count - slowResponsesCount) / count) * 100)
        : null;
      const nonFlaggedTotal = Math.max(1, entry.chatsAccepted - entry.flaggedChatsCount);
      const resolutionRatePct = entry.chatsAccepted > 0
        ? Math.round((entry.closedChats / nonFlaggedTotal) * 100)
        : null;

      // First-Contact Resolution (closed directly without holding/converting to follow-up ticket)
      const staffChats = allChats.filter((c) => String(c.assignedAgentId || '') === String(entry.staffId) && c.collusionScore < 50);
      const fcrChats = staffChats.filter((c) => c.status === 'closed' && !c.heldAt && !c.convertedTicketId).length;
      const fcrRatePct = staffChats.length > 0 ? Math.round((fcrChats / staffChats.length) * 100) : null;
      const escalatedOrHeld = staffChats.filter((c) => Boolean(c.heldAt) || Boolean(c.convertedTicketId)).length;
      const escalationRatePct = staffChats.length > 0 ? Math.round((escalatedOrHeld / staffChats.length) * 100) : null;
      const allTpls = await listTemplates();
      const knowledgeContributions = allTpls.filter((t) => !t.isSystem && String(t.createdBy || '') === String(entry.staffId)).length;
      const staffCsat = csatRows.filter((s) => String(s.staffId || '') === String(entry.staffId));
      const csatCount = staffCsat.length;
      const avgCsat = csatCount > 0
        ? Number((staffCsat.reduce((sum, s) => sum + Number(s.rating || 0), 0) / csatCount).toFixed(2))
        : null;

      // Meta-style composite performance classification
      const reasons = [];
      let performanceCategory = 'normal';
      if (entry.flaggedChatsCount > 0 || entry.flaggedSamplesCount > 0) {
        reasons.push('Self-chat / Collusion risk quarantined');
      }
      if (entry.longestCurrentWaitMs > UNANSWERED_WAIT_ATTENTION_MS) {
        reasons.push(`Customer waiting ${Math.round(entry.longestCurrentWaitMs / 1000)}s`);
      }
      if (avgResponseMs !== null && avgResponseMs > SLOW_RESPONSE_THRESHOLD_MS) {
        reasons.push(`Slow avg reply ${(avgResponseMs / 1000).toFixed(1)}s`);
      }
      if (slaCompliancePct !== null && slaCompliancePct < 70) {
        reasons.push(`Low SLA (${slaCompliancePct}%)`);
      }

      if (entry.flaggedChatsCount > 0) {
        performanceCategory = 'integrity_risk';
      } else if (reasons.length > 0) {
        performanceCategory = 'needs_attention';
      } else if (count >= 1 && (avgResponseMs ?? 999999) <= 45_000 && (slaCompliancePct ?? 0) >= 85) {
        performanceCategory = 'top_performer';
      } else if (count === 0 && entry.longestCurrentWaitMs <= UNANSWERED_WAIT_ATTENTION_MS) {
        performanceCategory = 'no_data';
      }

      staffMetrics.push({
        staffId: entry.staffId,
        staffName: entry.staffName,
        isOnline: entry.isOnline,
        chatsAccepted: entry.chatsAccepted,
        activeChats: entry.activeChats,
        onHoldChats: entry.onHoldChats,
        closedChats: entry.closedChats,
        samplesCount: count,
        avgResponseMs,
        firstResponseAvgMs,
        medianResponseMs,
        p95ResponseMs,
        fastestResponseMs,
        slowestResponseMs,
        slowResponsesCount,
        slaCompliancePct,
        resolutionRatePct,
        fcrRatePct,
        escalationRatePct,
        knowledgeContributions,
        avgCsat,
        csatCount,
        currentlyWaitingTurnCount: entry.currentlyWaitingTurnCount,
        longestCurrentWaitMs: entry.longestCurrentWaitMs,
        flaggedChatsCount: entry.flaggedChatsCount,
        flaggedSamplesCount: entry.flaggedSamplesCount,
        frustratedChatsCount: entry.frustratedChatsCount,
        satisfiedChatsCount: entry.satisfiedChatsCount,
        performanceCategory,
        attentionReasons: reasons
      });
    }

    const catalogCounts = {
      all: staffMetrics.length,
      top_performer: staffMetrics.filter((m) => m.performanceCategory === 'top_performer').length,
      normal: staffMetrics.filter((m) => m.performanceCategory === 'normal').length,
      needs_attention: staffMetrics.filter((m) => m.performanceCategory === 'needs_attention').length,
      integrity_risk: staffMetrics.filter((m) => m.performanceCategory === 'integrity_risk').length,
      slow_response: staffMetrics.filter((m) => (m.avgResponseMs !== null && m.avgResponseMs > SLOW_RESPONSE_THRESHOLD_MS) || m.longestCurrentWaitMs > UNANSWERED_WAIT_ATTENTION_MS).length
    };

    const filtered = staffMetrics.filter((m) => {
      if (!category || category === 'all') return true;
      if (category === 'slow_response') {
        return (m.avgResponseMs !== null && m.avgResponseMs > SLOW_RESPONSE_THRESHOLD_MS)
          || m.longestCurrentWaitMs > UNANSWERED_WAIT_ATTENTION_MS;
      }
      return m.performanceCategory === category;
    });

    return {
      staffMetrics: filtered,
      catalogCounts
    };
  }

  async function listTemplates() {
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const { rows } = await queryPgFn(
        `SELECT * FROM support_live_chat_templates ORDER BY is_system DESC, category ASC, title ASC`
      );
      return (rows || []).map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        shortcut: r.shortcut,
        body: r.body,
        createdBy: r.created_by,
        isSystem: Boolean(r.is_system),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null
      }));
    }
    return [...mem.templates];
  }

  async function createTemplate({ title, category = 'General', shortcut = '', body, createdBy = null } = {}) {
    const cleanTitle = String(title || '').trim().slice(0, 160);
    const cleanBody = String(body || '').trim().slice(0, 2000);
    if (!cleanTitle || !cleanBody) {
      throw new LiveChatQueueError('Template title and body are required.', { statusCode: 400, code: 'INVALID_TEMPLATE' });
    }
    const tpl = {
      id: `lctpl_${randomUUID()}`,
      title: cleanTitle,
      category: String(category || 'General').trim().slice(0, 64),
      shortcut: String(shortcut || '').trim().slice(0, 32) || null,
      body: cleanBody,
      createdBy: createdBy ? String(createdBy) : null,
      isSystem: false,
      updatedAt: new Date().toISOString()
    };

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_live_chat_templates (id, title, category, shortcut, body, created_by, is_system, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)`,
        [tpl.id, tpl.title, tpl.category, tpl.shortcut, tpl.body, tpl.createdBy, tpl.updatedAt]
      );
    } else {
      mem.templates.push(tpl);
    }
    return tpl;
  }

  async function deleteTemplate(templateId) {
    const cleanId = String(templateId || '').trim();
    if (!cleanId) return { ok: false };
    if (isUsingPg()) {
      await ensureLiveChatSchema();
      const res = await queryPgFn(
        `DELETE FROM support_live_chat_templates WHERE id = $1 AND is_system = FALSE`,
        [cleanId]
      );
      return { ok: (res.rowCount || 0) > 0 };
    }
    const before = mem.templates.length;
    mem.templates = mem.templates.filter((t) => !(t.id === cleanId && !t.isSystem));
    return { ok: mem.templates.length < before };
  }

  async function generateAiAssistForLiveChat(chatIdOrNumber, { mode = 'suggest_reply', draft = '', staffActor = null } = {}) {
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    if (!canStaffViewChat(chat, staffActor)) {
      throw new LiveChatQueueError('Not authorized to access this live chat.', { statusCode: 403, code: 'FORBIDDEN' });
    }
    const settings = await getChatSettingsFn();
    if (settings?.enabled === false || settings?.aiAgentAssistEnabled === false) {
      throw new LiveChatQueueError('AI Agent Assist is currently disabled in Chat System Settings.', {
        statusCode: 503,
        code: 'AI_ASSIST_DISABLED'
      });
    }

    const msgs = await listMessagesRaw(chat.id);
    const transcript = msgs.slice(-15).map((m) => `${m.senderType.toUpperCase()} (${m.senderName}): ${m.body}`).join('\n');
    const instructions = {
      suggest_reply: 'Draft one clear, empathetic, accurate customer support reply ready to send in live chat. Do not invent facts or policy numbers.',
      polish_reply: `Polish and improve this agent draft while keeping its exact meaning:\n"${String(draft || '').trim()}"`,
      summarize: 'Summarize the customer issue, key context, sentiment, and next action in 3 short bullet points.'
    };
    const prompt = `${instructions[mode] || instructions.suggest_reply}\n\nCustomer Topic: ${chat.topic}\nTranscript:\n${transcript}`;

    const aiRes = await executeAiFn({
      payload: {
        contents: [{ parts: [{ text: prompt }] }]
      }
    });

    if (!aiRes?.ok) {
      throw new LiveChatQueueError(aiRes?.error || 'All configured Gemini AI keys are currently unavailable or exhausted.', {
        statusCode: 503,
        code: 'AI_UNAVAILABLE'
      });
    }

    return {
      ok: true,
      mode,
      suggestion: String(aiRes.text || '').trim(),
      model: aiRes.model || null,
      keyLabel: aiRes.keyLabel || null
    };
  }

  async function updateCoBrowsingState(chatIdOrNumber, {
    actorType = 'customer',
    authUser = null,
    guestSession = null,
    staffActor = null,
    enabled,
    route,
    scrollPct,
    viewport,
    highlightSelector,
    agentGuidanceNote,
    nowMs = Date.now()
  } = {}) {
    const chat = await findChatByIdOrNumber(chatIdOrNumber);
    if (!chat) {
      throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
    }
    if (chat.status === 'closed' || chat.status === 'cancelled' || chat.status === 'on_hold') {
      throw new LiveChatQueueError('Co-browsing is only available during an active or queued live chat.', {
        statusCode: 409,
        code: 'CO_BROWSE_SESSION_INACTIVE'
      });
    }

    const nowIso = new Date(nowMs).toISOString();
    const prev = chat.coBrowsingState || { enabled: false };
    let nextState = { ...prev, updatedAt: nowIso };

    if (actorType === 'customer') {
      if (!isCustomerOwner(chat, { authUser, guestSession })) {
        throw new LiveChatQueueError('Not authorized to control co-browsing for this chat.', { statusCode: 403, code: 'FORBIDDEN' });
      }
      const nextEnabled = enabled !== undefined ? Boolean(enabled) : Boolean(prev.enabled);
      if (!nextEnabled) {
        nextState = {
          enabled: false,
          route: null,
          scrollPct: 0,
          viewport: null,
          highlightSelector: null,
          agentGuidanceNote: null,
          updatedAt: nowIso
        };
      } else {
        nextState = {
          ...prev,
          enabled: true,
          route: route !== undefined ? String(route || '/').slice(0, 240) : (prev.route || '/'),
          scrollPct: scrollPct !== undefined ? Math.max(0, Math.min(100, Math.round(Number(scrollPct) || 0))) : (prev.scrollPct || 0),
          viewport: viewport !== undefined ? String(viewport || '').slice(0, 64) : (prev.viewport || null),
          updatedAt: nowIso
        };
      }
    } else if (actorType === 'staff') {
      const superAdmin = isSuperAdminActor(staffActor);
      if (!canStaffViewChat(chat, staffActor) || (!superAdmin && chat.assignedAgentId && String(chat.assignedAgentId) !== String(staffActor?.id))) {
        throw new LiveChatQueueError('Only the assigned active specialist or Super Admin can push co-browsing guidance.', {
          statusCode: 403,
          code: 'FORBIDDEN'
        });
      }
      if (!prev.enabled) {
        throw new LiveChatQueueError('Visitor has not enabled co-browsing consent for this session.', {
          statusCode: 409,
          code: 'CO_BROWSE_CONSENT_REQUIRED'
        });
      }
      nextState = {
        ...prev,
        enabled: true,
        highlightSelector: highlightSelector !== undefined ? (highlightSelector ? String(highlightSelector).slice(0, 120) : null) : prev.highlightSelector,
        agentGuidanceNote: agentGuidanceNote !== undefined ? (agentGuidanceNote ? String(agentGuidanceNote).slice(0, 300) : null) : prev.agentGuidanceNote,
        updatedAt: nowIso
      };
    }

    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_live_chat_requests
         SET co_browsing_state = $2::jsonb, updated_at = $3
         WHERE id = $1`,
        [chat.id, JSON.stringify(nextState), nowIso]
      );
    } else {
      const target = mem.chats.find((c) => c.id === chat.id);
      if (target) {
        target.coBrowsingState = nextState;
        target.updatedAt = nowIso;
      }
    }

    return {
      chatId: chat.id,
      coBrowsing: nextState
    };
  }

  async function submitCsatSurvey({
    targetType = 'live_chat',
    targetId,
    rating,
    tags = [],
    comment = '',
    authUser = null,
    guestSession = null,
    staffIdOverride = null,
    staffNameOverride = null,
    nowMs = Date.now()
  } = {}) {
    const normalizedType = targetType === 'ticket' ? 'ticket' : 'live_chat';
    const numericRating = Math.round(Number(rating));
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new LiveChatQueueError('CSAT rating must be between 1 and 5.', {
        statusCode: 400,
        code: 'INVALID_CSAT_RATING'
      });
    }
    if (!targetId) {
      throw new LiveChatQueueError('targetId is required to submit CSAT feedback.', {
        statusCode: 400,
        code: 'MISSING_TARGET_ID'
      });
    }

    let resolvedTargetId = String(targetId);
    let resolvedStaffId = staffIdOverride || null;
    let resolvedStaffName = staffNameOverride || null;
    const requesterId = authUser?.id ? String(authUser.id) : (guestSession?.id ? String(guestSession.id) : null);

    if (normalizedType === 'live_chat') {
      const chat = await findChatByIdOrNumber(targetId);
      if (!chat) {
        throw new LiveChatQueueError('Live chat not found.', { statusCode: 404, code: 'CHAT_NOT_FOUND' });
      }
      if (!isCustomerOwner(chat, { authUser, guestSession })) {
        throw new LiveChatQueueError('Not authorized to rate this live chat.', { statusCode: 403, code: 'FORBIDDEN' });
      }
      resolvedTargetId = chat.id;
      resolvedStaffId = chat.assignedAgentId || null;
      resolvedStaffName = chat.assignedAgentName || null;
    }

    const cleanTags = Array.isArray(tags)
      ? tags.map((t) => String(t || '').trim().slice(0, 40)).filter(Boolean).slice(0, 8)
      : [];
    const cleanComment = String(comment || '').trim().slice(0, 1000);
    const nowIso = new Date(nowMs).toISOString();
    const record = {
      id: `csat_${randomUUID()}`,
      targetType: normalizedType,
      targetId: resolvedTargetId,
      rating: numericRating,
      tags: cleanTags,
      comment: cleanComment,
      staffId: resolvedStaffId,
      staffName: resolvedStaffName,
      requesterId,
      createdAt: nowIso
    };

    if (isUsingPg()) {
      await ensureLiveChatSchema();
      await queryPgFn(
        `INSERT INTO support_csat_surveys (id, target_type, target_id, rating, tags, comment, staff_id, staff_name, requester_id, created_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
         ON CONFLICT (target_type, target_id)
         DO UPDATE SET rating = EXCLUDED.rating, tags = EXCLUDED.tags, comment = EXCLUDED.comment,
                       staff_id = COALESCE(EXCLUDED.staff_id, support_csat_surveys.staff_id),
                       staff_name = COALESCE(EXCLUDED.staff_name, support_csat_surveys.staff_name),
                       created_at = EXCLUDED.created_at`,
        [
          record.id, record.targetType, record.targetId, record.rating,
          JSON.stringify(record.tags), record.comment, record.staffId, record.staffName, record.requesterId, nowIso
        ]
      );
    } else {
      const idx = mem.csatSurveys.findIndex((s) => s.targetType === normalizedType && s.targetId === resolvedTargetId);
      if (idx >= 0) mem.csatSurveys[idx] = record;
      else mem.csatSurveys.push(record);
    }

    return record;
  }

  async function getCsatAnalytics() {
    const rows = await getAllCsatRows();
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    for (const r of rows) {
      const val = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
      distribution[val] = (distribution[val] || 0) + 1;
      totalScore += val;
    }
    const totalCount = rows.length;
    const positiveCount = (distribution[4] || 0) + (distribution[5] || 0);
    return {
      totalResponses: totalCount,
      averageRating: totalCount > 0 ? Number((totalScore / totalCount).toFixed(2)) : null,
      csatPositivePct: totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : null,
      distribution,
      recentSurveys: rows.slice(0, 50)
    };
  }

  async function getAdminIntegritySummary({ nowMs = Date.now() } = {}) {
    const [perf, logs, presence, allChats] = await Promise.all([
      getStaffPerformanceMetrics({ nowMs }),
      listForensicAuditLogs({ limit: 15 }),
      getOnlineAgentsSummary(nowMs),
      getAllChatsRaw()
    ]);
    return {
      onlineAgentsCount: presence.onlineAgentsCount,
      waitingQueueCount: allChats.filter((c) => c.status === 'waiting').length,
      activeChatsCount: allChats.filter((c) => c.status === 'active').length,
      onHoldChatsCount: allChats.filter((c) => c.status === 'on_hold').length,
      closedChatsCount: allChats.filter((c) => c.status === 'closed' || c.status === 'cancelled').length,
      catalogCounts: perf.catalogCounts,
      needsAttentionStaff: perf.staffMetrics.filter((m) => m.performanceCategory === 'needs_attention' || m.performanceCategory === 'integrity_risk'),
      recentForensicLogs: logs
    };
  }

  return {
    ensureLiveChatSchema,
    heartbeatAgentPresence,
    getOnlineAgentsSummary,
    requestLiveChat,
    getCustomerLiveChatStatus,
    sendCustomerLiveChatMessage,
    acceptLiveChatRequest,
    sendStaffLiveChatReply,
    holdLiveChatSession,
    endLiveChatSession,
    listAdminLiveChats,
    getAdminLiveChatDetail,
    linkConvertedTicket,
    getStaffPerformanceMetrics,
    listForensicAuditLogs,
    getAdminIntegritySummary,
    listTemplates,
    createTemplate,
    deleteTemplate,
    generateAiAssistForLiveChat,
    updateCoBrowsingState,
    submitCsatSurvey,
    getCsatAnalytics
  };
}

let defaultLiveChatQueueService = null;
export function getDefaultLiveChatQueueService() {
  if (!defaultLiveChatQueueService) {
    defaultLiveChatQueueService = createLiveChatQueueService();
  }
  return defaultLiveChatQueueService;
}
