import crypto, { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isPgActive as defaultIsPgActive, queryPg as defaultQueryPg } from '../db/postgres.js';
import { sendTiwloEmail as defaultSendTiwloEmail } from '../db/emailService.js';
import { renderSupportTicketEmail } from '../email/index.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { MasterDB as defaultMasterDB } from '../db/multiTenant.js';
import { SupportDB as defaultSupportDB } from '../db/supportDb.js';
import { isSuperAdminAccount } from '../administrator/identityRiskGraph.js';

export const GUEST_SUPPORT_COOKIE = 'tiwlo_guest_support';
export const SUPPORT_TOGGLES_SETTING_KEY = 'support_system_toggles';
export const COLLISION_VIEWER_TTL_MS = 45_000;

export const CANONICAL_TICKET_STATUSES = Object.freeze([
  'open',
  'in_progress',
  'waiting_customer',
  'on_hold',
  'escalated',
  'resolved',
  'closed'
]);

export const CANONICAL_TICKET_PRIORITIES = Object.freeze([
  'low',
  'medium',
  'high',
  'urgent'
]);

export const SLA_HOURS_BY_PRIORITY = Object.freeze({
  urgent: 4,
  high: 8,
  medium: 24,
  low: 48
});

export const SLA_RESPONSE_MINUTES_BY_PRIORITY = Object.freeze({
  urgent: 30,
  high: 120,
  medium: 240,
  low: 480
});

export const GUEST_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_AUTO_CLOSE_HOURS = 72;

export const DEFAULT_SUPPORT_TOGGLES = Object.freeze({
  guestTicketingEnabled: true,
  requireGuestEmailAndPhone: true,
  liveChatWidgetEnabled: true,
  allowNewTicketCreation: true,
  lockClosedTicketReplies: true,
  allowCustomerReopenClosedTicket: false,
  allowAttachments: true,
  aiAutoReplyEnabled: true,
  restrictStaffToAssignedTickets: false
});

export const PUBLIC_SUPPORT_TOGGLE_KEYS = Object.freeze([
  'guestTicketingEnabled',
  'requireGuestEmailAndPhone',
  'liveChatWidgetEnabled',
  'allowNewTicketCreation',
  'lockClosedTicketReplies',
  'allowCustomerReopenClosedTicket',
  'allowAttachments',
  'aiAutoReplyEnabled'
]);

export const SUPPORT_PERMISSION_KEYS = Object.freeze([
  'support.view',
  'support.view_all',
  'support.reply',
  'support.assign',
  'support.manage_settings',
  'support.merge',
  'support.export',
  'support.macros'
]);

const ROLE_METADATA = Object.freeze({
  super_admin: { roleLabel: 'Super Admin', tier: 3, department: 'Executive & Infrastructure' },
  operations_admin: { roleLabel: 'Operations Admin', tier: 2, department: 'Operations' },
  support_lead: { roleLabel: 'Support Lead', tier: 2, department: 'Customer Support' },
  trust_safety: { roleLabel: 'Trust & Safety Moderator', tier: 2, department: 'Trust & Safety' },
  finance_analyst: { roleLabel: 'Finance & Billing Analyst', tier: 1, department: 'Billing' },
  support_agent: { roleLabel: 'Support Agent', tier: 1, department: 'Customer Support' }
});

const LEGACY_ROLE_SUPPORT_PERMISSIONS = Object.freeze({
  super_admin: [...SUPPORT_PERMISSION_KEYS],
  operations_admin: [
    'support.view', 'support.view_all', 'support.reply', 'support.assign',
    'support.merge', 'support.export', 'support.macros'
  ],
  support_lead: [
    'support.view', 'support.view_all', 'support.reply', 'support.assign',
    'support.merge', 'support.export', 'support.macros'
  ],
  support_agent: ['support.view', 'support.reply', 'support.macros'],
  trust_safety: ['support.view', 'support.view_all', 'support.reply'],
  finance_analyst: ['support.view']
});

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'not', 'are',
  'was', 'were', 'your', 'you', 'our', 'can', 'cannot', 'cant', 'will', 'how',
  'what', 'when', 'where', 'why', 'help', 'issue', 'problem', 'need', 'please',
  'support', 'ticket', 'account', 'store'
]);

const EPHEMERAL_GUEST_SECRET = randomBytes(32).toString('hex');
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class SupportServiceError extends Error {
  constructor(message, { statusCode = 400, code = 'SUPPORT_ERROR', extra = {} } = {}) {
    super(message);
    this.name = 'SupportServiceError';
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, extra);
  }
}

function getGuestSigningSecret() {
  return (
    process.env.SUPPORT_GUEST_SECRET ||
    process.env.SECURITY_SECRET ||
    process.env.SESSION_SECRET ||
    EPHEMERAL_GUEST_SECRET
  );
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeHexEqual(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (!s1 || s1.length !== s2.length) return false;
  return timingSafeEqual(Buffer.from(s1, 'utf8'), Buffer.from(s2, 'utf8'));
}

export function isSuperAdminUserRecord(user) {
  if (!user) return false;
  return user.role === 'super_admin' || isSuperAdminAccount(user);
}

export function normalizeTicketStatus(status, { allowLegacyRejected = true } = {}) {
  const raw = String(status || '').trim();
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (!key || key === 'open') return 'open';
  if (key === 'in_progress' || key === 'inprogress') return 'in_progress';
  if (key === 'waiting_customer' || key === 'waiting_on_customer' || key === 'waiting' || key === 'pending') {
    return 'waiting_customer';
  }
  if (key === 'escalated') return 'escalated';
  if (key === 'resolved') return 'resolved';
  if (key === 'closed') return 'closed';
  if (key === 'rejected') return allowLegacyRejected ? 'rejected' : 'closed';
  throw new SupportServiceError(`Unsupported ticket status: ${raw}`, {
    statusCode: 400,
    code: 'INVALID_TICKET_STATUS'
  });
}

export function normalizeTicketPriority(priority) {
  const key = String(priority || 'medium').trim().toLowerCase();
  if (key === 'urgent' || key === 'critical') return 'urgent';
  if (key === 'high') return 'high';
  if (key === 'low') return 'low';
  if (key === 'medium' || key === 'normal' || !key) return 'medium';
  throw new SupportServiceError(`Unsupported ticket priority: ${priority}`, {
    statusCode: 400,
    code: 'INVALID_TICKET_PRIORITY'
  });
}

export function computeSlaDueAt(createdAt, priority) {
  const baseMs = createdAt ? Date.parse(String(createdAt)) : Date.now();
  const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
  const normPriority = normalizeTicketPriority(priority);
  const hours = SLA_HOURS_BY_PRIORITY[normPriority] || 24;
  return new Date(safeBase + hours * 3600 * 1000).toISOString();
}

export function computeSlaResponseDueAt(createdAt, priority) {
  const baseMs = createdAt ? Date.parse(String(createdAt)) : Date.now();
  const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
  const normPriority = normalizeTicketPriority(priority);
  const mins = SLA_RESPONSE_MINUTES_BY_PRIORITY[normPriority] || 240;
  return new Date(safeBase + mins * 60 * 1000).toISOString();
}

export function computeAutoCloseAt(fromTime = Date.now(), hours = DEFAULT_AUTO_CLOSE_HOURS) {
  const baseMs = typeof fromTime === 'number' ? fromTime : Date.parse(String(fromTime));
  const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(safeBase + Math.max(1, Number(hours) || DEFAULT_AUTO_CLOSE_HOURS) * 3600 * 1000).toISOString();
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function validateGuestContact(input = {}) {
  const rawName = input.guestName ?? input.name ?? input.visitorName ?? '';
  const rawEmail = input.guestEmail ?? input.email ?? input.visitorEmail ?? '';
  const rawPhone = input.guestPhone ?? input.phone ?? input.visitorPhone ?? '';

  const guestName = String(rawName).trim();
  const guestEmail = String(rawEmail).trim().toLowerCase();
  const rawPhoneTrimmed = String(rawPhone).trim();

  const invalidNames = new Set(['undefined', 'null', 'guest', 'guest visitor', 'anonymous']);
  const nameValid =
    guestName.length >= 2 &&
    guestName.length <= 120 &&
    !invalidNames.has(guestName.toLowerCase());

  const emailValid =
    guestEmail.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guestEmail);

  const phoneCharsValid = /^[+\d\s().-]+$/.test(rawPhoneTrimmed);
  const normalizedPhone = rawPhoneTrimmed.replace(/[\s().-]/g, '');
  const phonePlusValid = !normalizedPhone.includes('+') || (normalizedPhone.startsWith('+') && normalizedPhone.indexOf('+', 1) === -1);
  const phoneDigits = normalizePhoneDigits(normalizedPhone);
  const phoneValid =
    phoneCharsValid &&
    phonePlusValid &&
    normalizedPhone.length >= 7 &&
    normalizedPhone.length <= 20 &&
    phoneDigits.length >= 7 &&
    phoneDigits.length <= 18;

  if (!nameValid || !emailValid || !phoneValid) {
    throw new SupportServiceError(
      'Guest users must provide name, email, and phone number before creating or replying to support.',
      { statusCode: 400, code: 'GUEST_CONTACT_REQUIRED' }
    );
  }

  return {
    guestName,
    guestEmail,
    guestPhone: normalizedPhone
  };
}

function signGuestSessionToken(sessionId) {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${sessionId}.${nonce}`;
  const sig = crypto.createHmac('sha256', getGuestSigningSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyGuestSessionToken(rawToken) {
  if (typeof rawToken !== 'string' || !rawToken) return null;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 3) return null;
  const [sessionId, nonce, sig] = parts;
  if (!sessionId || !nonce || !sig) return null;
  const expected = crypto.createHmac('sha256', getGuestSigningSecret()).update(`${sessionId}.${nonce}`).digest('hex');
  if (!safeHexEqual(sig, expected)) return null;
  return {
    sessionId,
    tokenHash: sha256Hex(rawToken.trim())
  };
}

function generateReadableRecoveryCode() {
  const pick = () => {
    let s = '';
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i += 1) {
      s += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
    }
    return s;
  };
  return `TW-${pick()}-${pick()}`;
}

function normalizeRecoveryCode(code) {
  return String(code || '').trim().toUpperCase();
}

function parseJsonField(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extractClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0]
      : req?.ip || req?.socket?.remoteAddress || '';
  return String(raw || '').trim();
}

function normalizeSearchNumber(value) {
  return String(value || '').trim().toLowerCase().replace(/^#+/, '');
}

function normalizeTagList(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const t of input) {
    const clean = String(t || '').trim().slice(0, 48);
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
    if (out.length >= 25) break;
  }
  return out;
}

function normalizeWatcherList(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const item of input) {
    if (typeof item === 'string') {
      const val = item.trim();
      if (!val || seen.has(val.toLowerCase())) continue;
      seen.add(val.toLowerCase());
      out.push(val.includes('@') ? { email: val.toLowerCase() } : { id: val });
    } else if (item && typeof item === 'object') {
      const id = item.id ? String(item.id).trim() : undefined;
      const email = item.email ? String(item.email).trim().toLowerCase() : undefined;
      const key = (id || email || '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        ...(id ? { id } : {}),
        ...(item.name ? { name: String(item.name).trim().slice(0, 120) } : {}),
        ...(email ? { email } : {}),
        ...(item.avatar ? { avatar: String(item.avatar) } : {}),
        addedAt: item.addedAt || new Date().toISOString()
      });
    }
    if (out.length >= 25) break;
  }
  return out;
}

function normalizeAttachments(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, 10)
    .map((att) => {
      if (typeof att === 'string') {
        return { url: att.trim(), filename: att.split('/').pop() || 'attachment' };
      }
      if (!att || typeof att !== 'object') return null;
      return {
        id: att.id ? String(att.id) : `att_${randomUUID().slice(0, 8)}`,
        url: att.url ? String(att.url) : '',
        filename: String(att.filename || att.name || 'attachment').slice(0, 200),
        contentType: att.contentType ? String(att.contentType).slice(0, 100) : 'application/octet-stream',
        size: Number.isFinite(Number(att.size)) ? Number(att.size) : 0
      };
    })
    .filter(Boolean);
}

function csvEscapeCell(val) {
  let str = val === null || val === undefined ? '' : String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function tokenizeKeywords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export function resolveSupportPermissions(adminUser, adminProfile = null, { rawPermissions = null } = {}) {
  if (!adminUser || adminUser.isBanned) {
    return { isSuperAdmin: false, permissions: new Set(), hasExplicitSupportPerms: false };
  }
  if (isSuperAdminUserRecord(adminUser)) {
    return {
      isSuperAdmin: true,
      permissions: new Set(SUPPORT_PERMISSION_KEYS),
      hasExplicitSupportPerms: false
    };
  }
  if (adminProfile && (adminProfile.isActive === false || adminProfile.is_active === false)) {
    return { isSuperAdmin: false, permissions: new Set(), hasExplicitSupportPerms: true };
  }

  const candidateLists = [
    Array.isArray(rawPermissions) ? rawPermissions : [],
    Array.isArray(adminProfile?.supportPermissions) ? adminProfile.supportPermissions : [],
    Array.isArray(adminProfile?.permissions) ? adminProfile.permissions : [],
    Array.isArray(adminUser?.supportPermissions) ? adminUser.supportPermissions : [],
    Array.isArray(adminUser?.permissions) ? adminUser.permissions : []
  ].flat().map((p) => String(p || '').trim()).filter(Boolean);

  const explicitSupport = candidateLists.filter((p) => p.startsWith('support.'));
  if (explicitSupport.length > 0) {
    return {
      isSuperAdmin: false,
      permissions: new Set(explicitSupport),
      hasExplicitSupportPerms: true
    };
  }

  const roleKey = adminProfile?.roleKey || adminProfile?.role_key || (adminUser.role === 'admin' ? 'operations_admin' : 'support_agent');
  const perms = new Set(LEGACY_ROLE_SUPPORT_PERMISSIONS[roleKey] || LEGACY_ROLE_SUPPORT_PERMISSIONS.support_agent);

  // Respect explicit legacy permissions if present
  if (candidateLists.length > 0) {
    if (candidateLists.includes('manage_system_settings')) {
      perms.add('support.manage_settings');
    }
    if (!candidateLists.includes('manage_orders') && !candidateLists.includes('manage_stores') && roleKey === 'finance_analyst') {
      perms.delete('support.reply');
      perms.delete('support.assign');
    }
  }

  return {
    isSuperAdmin: false,
    permissions: perms,
    hasExplicitSupportPerms: false
  };
}

export function hasSupportPermission(adminUser, adminProfile, permKey, opts = {}) {
  const resolved = resolveSupportPermissions(adminUser, adminProfile, opts);
  if (resolved.isSuperAdmin) return true;
  return resolved.permissions.has(permKey);
}

export function setGuestSupportCookie(res, token, req = null) {
  if (!res || typeof res.cookie !== 'function') return;
  res.cookie(GUEST_SUPPORT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: Boolean(req?.secure || process.env.NODE_ENV === 'production'),
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

export function clearGuestSupportCookie(res, req = null) {
  if (!res || typeof res.clearCookie !== 'function') return;
  res.clearCookie(GUEST_SUPPORT_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: Boolean(req?.secure || process.env.NODE_ENV === 'production')
  });
}

export function createTicketingService(deps = {}) {
  const queryPgFn = deps.queryPg || defaultQueryPg;
  const isPgActiveFn = deps.isPgActive || (() => {
    if (deps.useMemory === true) return false;
    if (deps.queryPg) return true;
    try {
      return Boolean(defaultIsPgActive());
    } catch {
      return false;
    }
  });
  const lazyProxy = (getter) => new Proxy({}, {
    get(_target, prop) {
      const obj = getter();
      const val = obj[prop];
      return typeof val === 'function' ? val.bind(obj) : val;
    }
  });
  const MasterDB = deps.MasterDB || lazyProxy(() => defaultMasterDB);
  const SupportDB = deps.SupportDB || lazyProxy(() => defaultSupportDB);
  const sendEmailFn = (...args) => (deps.sendTiwloEmail || defaultSendTiwloEmail)(...args);

  const mem = {
    tickets: [],
    messages: new Map(), // ticketId -> []
    events: new Map(), // ticketId -> []
    guestSessions: new Map(), // id -> row
    macros: new Map(), // id -> row
    emailThreads: new Map(), // ticketId -> { alias, rootMessageId, ... }
    attachments: new Map(), // attachmentId -> { id, filename, mimeType, size, dataBase64, ticketId }
    staffUsers: Array.isArray(deps.staffUsers) ? deps.staffUsers : [],
    staffProfiles: new Map(),
    toggles: { ...DEFAULT_SUPPORT_TOGGLES },
    viewers: new Map() // ticketId -> Map<viewerId, { id, name, avatar, role, lastSeenAt }>
  };

  let attachmentSchemaReady = false;
  async function ensureSupportEmailAndAttachmentSchema() {
    if (!isUsingPg() || attachmentSchemaReady) return;
    try {
      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_ticket_email_threads (
          ticket_id VARCHAR(80) PRIMARY KEY,
          ticket_number VARCHAR(32) NOT NULL,
          reply_to_alias VARCHAR(255) UNIQUE NOT NULL,
          root_message_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await queryPgFn(`
        CREATE TABLE IF NOT EXISTS support_attachments (
          id VARCHAR(80) PRIMARY KEY,
          ticket_id VARCHAR(80),
          filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          size BIGINT NOT NULL DEFAULT 0,
          content_base64 TEXT NOT NULL,
          uploaded_by VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      attachmentSchemaReady = true;
    } catch {
      // Non-fatal schema init
    }
  }

  function buildEphemeralTicketAlias(serialNumber, ticketId) {
    const cleanRef = String(serialNumber || ticketId || randomUUID())
      .replace(/[^a-zA-Z0-9-]/g, '')
      .toLowerCase();
    const token = randomBytes(4).toString('hex');
    const domain = PLATFORM_CONFIG?.primaryDomain || 'tiwlo.com';
    return `ticket+${cleanRef}-${token}@${domain}`;
  }

  async function createOrGetTicketEmailThread(ticket) {
    const alias = ticket?.metadata?.replyToEmailAlias || buildEphemeralTicketAlias(ticket.serialNumber, ticket.id);
    const domain = PLATFORM_CONFIG?.primaryDomain || 'tiwlo.com';
    const rootMessageId = ticket?.metadata?.emailThreadRootId || `<${ticket.id}.${randomBytes(3).toString('hex')}@${domain}>`;
    const thread = {
      ticketId: ticket.id,
      ticketNumber: ticket.serialNumber,
      replyToAlias: alias,
      rootMessageId
    };
    if (isUsingPg()) {
      await ensureSupportEmailAndAttachmentSchema();
      try {
        const { rows } = await queryPgFn(
          `INSERT INTO support_ticket_email_threads (ticket_id, ticket_number, reply_to_alias, root_message_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ticket_id) DO UPDATE SET ticket_number = EXCLUDED.ticket_number
           RETURNING reply_to_alias, root_message_id`,
          [thread.ticketId, thread.ticketNumber, thread.replyToAlias, thread.rootMessageId]
        );
        if (rows?.[0]) {
          thread.replyToAlias = rows[0].reply_to_alias || thread.replyToAlias;
          thread.rootMessageId = rows[0].root_message_id || thread.rootMessageId;
        }
      } catch {
        // Ignore duplicate alias conflict
      }
    } else {
      mem.emailThreads.set(ticket.id, thread);
    }
    return thread;
  }

  async function deleteTicketEmailThreadAndPurgeDeliveries(ticket) {
    if (!ticket?.id) return { deleted: false };
    mem.emailThreads.delete(ticket.id);
    if (isUsingPg()) {
      await ensureSupportEmailAndAttachmentSchema();
      try {
        await queryPgFn(`DELETE FROM support_ticket_email_threads WHERE ticket_id = $1`, [ticket.id]);
        await queryPgFn(
          `DELETE FROM email_deliveries WHERE (metadata->>'ticketId') = $1 OR (metadata->>'ticketId') = $2`,
          [String(ticket.id), String(ticket.ticketId || ticket.id)]
        );
      } catch {
        // Non-fatal purge if email_deliveries absent
      }
    }
    // Remove replyToEmailAlias from ticket metadata once permanently closed
    const nextMeta = { ...(ticket.metadata || {}) };
    delete nextMeta.replyToEmailAlias;
    nextMeta.emailThreadPurgedAt = new Date().toISOString();
    await persistTicketUpdate(ticket.id, { metadata: nextMeta }).catch(() => {});
    return { deleted: true, aliasPurgedAt: nextMeta.emailThreadPurgedAt };
  }

  const ALLOWED_ATTACHMENT_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'csv', 'json', 'zip', 'log']);
  const MIME_EXT_FALLBACK = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip'
  };
  async function storeSupportAttachments(files = [], { ticketId = null, uploadedBy = null } = {}) {
    if (!Array.isArray(files) || files.length === 0) return [];
    const saved = [];
    for (const file of files.slice(0, 10)) {
      const mimeTypeRaw = String(file?.mimeType || file?.contentType || file?.mimetype || 'application/octet-stream')
        .split(';')[0]
        .trim()
        .toLowerCase();
      let rawName = String(file?.filename || file?.name || file?.originalname || 'attachment')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 140);
      let ext = rawName.includes('.') ? rawName.split('.').pop().toLowerCase() : '';
      if (!ALLOWED_ATTACHMENT_EXTS.has(ext) && MIME_EXT_FALLBACK[mimeTypeRaw]) {
        ext = MIME_EXT_FALLBACK[mimeTypeRaw];
        rawName = `${rawName.replace(/\.+$/, '') || 'attachment'}.${ext}`;
      }
      if (!ALLOWED_ATTACHMENT_EXTS.has(ext)) {
        throw new SupportServiceError(`File type ".${ext || 'unknown'}" is not allowed for support attachments.`, {
          statusCode: 400,
          code: 'INVALID_ATTACHMENT_TYPE'
        });
      }
      const rawBase64 = String(file?.contentBase64 || file?.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
      let buf = null;
      if (file?.buffer instanceof Buffer) {
        buf = file.buffer;
      } else if (file?.content instanceof Buffer) {
        buf = file.content;
      } else if (file?.buffer instanceof Uint8Array) {
        buf = Buffer.from(file.buffer);
      } else if (file?.content instanceof Uint8Array) {
        buf = Buffer.from(file.content);
      } else if (rawBase64) {
        buf = Buffer.from(rawBase64, 'base64');
      }
      if (!buf || buf.length === 0) continue;
      if (buf.length > 5 * 1024 * 1024) {
        throw new SupportServiceError(`Attachment "${rawName}" exceeds 5MB limit.`, {
          statusCode: 400,
          code: 'ATTACHMENT_TOO_LARGE'
        });
      }
      const attId = `supatt_${randomUUID()}`;
      const mimeType = String(mimeTypeRaw || 'application/octet-stream').slice(0, 120);
      const b64 = buf.toString('base64');
      if (isUsingPg()) {
        await ensureSupportEmailAndAttachmentSchema();
        await queryPgFn(
          `INSERT INTO support_attachments (id, ticket_id, filename, mime_type, size, content_base64, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [attId, ticketId || null, rawName, mimeType, buf.length, b64, uploadedBy || null]
        );
      } else {
        mem.attachments.set(attId, {
          id: attId,
          ticketId: ticketId || null,
          filename: rawName,
          mimeType,
          size: buf.length,
          contentBase64: b64,
          uploadedBy: uploadedBy || null,
          createdAt: new Date().toISOString()
        });
      }
      saved.push({
        id: attId,
        name: rawName,
        filename: rawName,
        mimeType,
        size: buf.length,
        url: `/api/support/attachments/${attId}`
      });
    }
    return saved;
  }

  async function getSupportAttachmentById(attachmentId) {
    const cleanId = String(attachmentId || '').trim();
    if (!cleanId) return null;
    if (isUsingPg()) {
      await ensureSupportEmailAndAttachmentSchema();
      const { rows } = await queryPgFn(`SELECT * FROM support_attachments WHERE id = $1 LIMIT 1`, [cleanId]);
      const r = rows?.[0];
      if (!r) return null;
      return {
        id: r.id,
        ticketId: r.ticket_id,
        filename: r.filename,
        mimeType: r.mime_type,
        size: Number(r.size || 0),
        buffer: Buffer.from(r.content_base64 || '', 'base64')
      };
    }
    const item = mem.attachments.get(cleanId);
    if (!item) return null;
    return {
      ...item,
      buffer: Buffer.from(item.contentBase64 || '', 'base64')
    };
  }

  // Shared collision viewer map even in PG mode (45s TTL in-memory heartbeat)
  const collisionViewers = mem.viewers;

  function isUsingPg() {
    if (deps.useMemory === true) return false;
    if (deps.queryPg) return true;
    return Boolean(isPgActiveFn());
  }

  function isEmailConfigured() {
    if (typeof deps.sendTiwloEmail === 'function') return true;
    if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) return false;
    return Boolean(process.env.SMTP_HOST || process.env.SMTP_ENABLED === 'true');
  }

  function notifyEmailNonFatal(payload) {
    if (!isEmailConfigured() || !payload?.to) return;
    try {
      Promise.resolve(sendEmailFn(payload)).catch(() => {});
    } catch {
      // Non-fatal by design
    }
  }

  function mapTicketRow(r) {
    if (!r) return null;
    const priority = (() => {
      try { return normalizeTicketPriority(r.priority); } catch { return 'medium'; }
    })();
    const status = (() => {
      try { return normalizeTicketStatus(r.status, { allowLegacyRejected: true }); } catch { return 'open'; }
    })();
    const createdAt = r.created_at ? new Date(r.created_at).toISOString() : (r.createdAt || new Date().toISOString());
    const updatedAt = r.updated_at ? new Date(r.updated_at).toISOString() : (r.updatedAt || createdAt);
    const slaResolveDueAt = r.sla_resolve_due_at
      ? new Date(r.sla_resolve_due_at).toISOString()
      : (r.slaResolveDueAt || (r.sla_due_at ? new Date(r.sla_due_at).toISOString() : (r.slaDueAt || computeSlaDueAt(createdAt, priority))));
    const slaResponseDueAt = r.sla_response_due_at
      ? new Date(r.sla_response_due_at).toISOString()
      : (r.slaResponseDueAt || computeSlaResponseDueAt(createdAt, priority));
    const slaDueAt = r.sla_due_at ? new Date(r.sla_due_at).toISOString() : (r.slaDueAt || slaResolveDueAt);
    const autoCloseAt = r.auto_close_at ? new Date(r.auto_close_at).toISOString() : (r.autoCloseAt || null);
    const snoozedUntil = r.snoozed_until ? new Date(r.snoozed_until).toISOString() : (r.snoozedUntil || null);
    const slaBreachNotifiedAt = r.sla_breach_notified_at ? new Date(r.sla_breach_notified_at).toISOString() : (r.slaBreachNotifiedAt || null);
    const closedOrResolved = status === 'resolved' || status === 'closed';
    const slaDueMs = slaResolveDueAt ? Date.parse(slaResolveDueAt) : NaN;
    const slaBreached = Boolean(!closedOrResolved && Number.isFinite(slaDueMs) && Date.now() > slaDueMs);

    return {
      id: r.id,
      ticketId: r.ticket_id || r.ticketId || r.id,
      serialNumber: r.serial_number || r.serialNumber || `#${r.ticket_id || r.ticketId || r.id}`,
      userId: r.user_id ?? r.userId ?? null,
      userName: r.user_name ?? r.userName ?? null,
      userEmail: r.user_email ?? r.userEmail ?? null,
      requesterType: r.requester_type || r.requesterType || (r.user_id || r.userId ? 'user' : 'guest'),
      guestSessionId: r.guest_session_id ?? r.guestSessionId ?? null,
      guestName: r.guest_name ?? r.guestName ?? null,
      guestEmail: r.guest_email ?? r.guestEmail ?? null,
      guestPhone: r.guest_phone ?? r.guestPhone ?? null,
      guestAccessHash: r.guest_access_hash ?? r.guestAccessHash ?? null,
      tiwiId: r.tiwi_id ?? r.tiwiId ?? null,
      storeId: r.store_id ?? r.storeId ?? null,
      storeName: r.store_name ?? r.storeName ?? null,
      channel: r.channel || 'web',
      subject: r.subject || '',
      description: r.description ?? '',
      snippet: String(r.description || r.snippet || '').trim().slice(0, 120),
      category: r.category || 'General',
      department: r.department || 'general',
      priority,
      status,
      escalationTier: Number(r.escalation_tier ?? r.escalationTier ?? 1),
      assignedAgentId: r.assigned_agent_id ?? r.assignedAgentId ?? null,
      assignedAgentName: r.assigned_agent_name ?? r.assignedAgentName ?? null,
      assignedAgentAvatar: r.assigned_agent_avatar ?? r.assignedAgentAvatar ?? null,
      assignedAgentRole: r.assigned_agent_role ?? r.assignedAgentRole ?? null,
      assignedAgent: r.assigned_agent_name ?? r.assignedAgentName ?? r.assignedAgent ?? null,
      tags: parseJsonField(r.tags, []),
      watchers: parseJsonField(r.watchers, []),
      attachments: parseJsonField(r.attachments, []),
      slaDueAt,
      slaResponseDueAt,
      slaResolveDueAt,
      slaBreachNotifiedAt,
      autoCloseAt,
      snoozedUntil,
      slaBreached,
      slaRemainingMs: Number.isFinite(slaDueMs) ? slaDueMs - Date.now() : null,
      firstResponseAt: r.first_response_at ? new Date(r.first_response_at).toISOString() : (r.firstResponseAt || null),
      resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : (r.resolvedAt || null),
      closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : (r.closedAt || null),
      csatRating: r.csat_rating ?? r.csatRating ?? null,
      csatComment: r.csat_comment ?? r.csatComment ?? null,
      mergedIntoId: r.merged_into_id ?? r.mergedIntoId ?? null,
      parentTicketId: r.parent_ticket_id ?? r.parentTicketId ?? null,
      unreadByUser: Boolean(r.unread_by_user ?? r.unreadByUser ?? false),
      unreadByStaff: (r.unread_by_staff ?? r.unreadByStaff) !== false,
      resolution: r.resolution ?? null,
      metadata: parseJsonField(r.metadata, {}),
      createdAt,
      updatedAt
    };
  }

  function mapMessageRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      ticketId: r.ticket_id || r.ticketId,
      senderId: r.sender_id ?? r.senderId ?? null,
      senderType: r.sender_type || r.senderType || 'user',
      senderName: r.sender_name ?? r.senderName ?? null,
      senderAvatar: r.sender_avatar ?? r.senderAvatar ?? null,
      senderRole: r.sender_role ?? r.senderRole ?? null,
      message: r.message ?? '',
      isInternal: Boolean(r.is_internal ?? r.isInternal ?? false),
      editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : (r.editedAt || null),
      editHistory: parseJsonField(r.edit_history ?? r.editHistory, []),
      attachments: parseJsonField(r.attachments, []),
      deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : (r.deletedAt || null),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : (r.createdAt || new Date().toISOString())
    };
  }

  function mapEventRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      ticketId: r.ticket_id || r.ticketId,
      actorId: r.actor_id ?? r.actorId ?? null,
      actorName: r.actor_name ?? r.actorName ?? 'System',
      actorType: r.actor_type || r.actorType || 'system',
      eventType: r.event_type || r.eventType,
      summary: r.summary || '',
      changes: parseJsonField(r.changes, {}),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : (r.createdAt || new Date().toISOString())
    };
  }

  function mapGuestSessionRow(r) {
    if (!r) return null;
    const createdAt = r.created_at ? new Date(r.created_at).toISOString() : (r.createdAt || new Date().toISOString());
    const expiresAt = r.expires_at
      ? new Date(r.expires_at).toISOString()
      : (r.expiresAt || new Date(Date.parse(createdAt) + GUEST_SESSION_TTL_MS).toISOString());
    return {
      id: r.id,
      tokenHash: r.token_hash ?? r.tokenHash,
      visitorName: r.visitor_name ?? r.visitorName,
      visitorEmail: r.visitor_email ?? r.visitorEmail,
      visitorPhone: r.visitor_phone ?? r.visitorPhone,
      ipHash: r.ip_hash ?? r.ipHash ?? null,
      userAgent: r.user_agent ?? r.userAgent ?? null,
      deviceHint: r.device_hint ?? r.deviceHint ?? null,
      claimedUserId: r.claimed_user_id ?? r.claimedUserId ?? null,
      claimedAt: r.claimed_at ? new Date(r.claimed_at).toISOString() : (r.claimedAt || null),
      expiresAt,
      createdAt,
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : (r.lastSeenAt || createdAt)
    };
  }

  function mapMacroRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      category: r.category || 'General',
      body: r.body,
      defaultStatus: r.default_status ?? r.defaultStatus ?? null,
      defaultTags: parseJsonField(r.default_tags ?? r.defaultTags, []),
      createdBy: r.created_by ?? r.createdBy ?? null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : (r.createdAt || new Date().toISOString()),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : (r.updatedAt || new Date().toISOString())
    };
  }

  async function getSuperAdminIdSet() {
    const ids = new Set();
    if (isUsingPg()) {
      try {
        const { rows } = await queryPgFn(
          `SELECT id, email, role FROM system_users WHERE role = 'super_admin' OR LOWER(email) = 'tiwloltd@gmail.com'`
        );
        for (const r of rows || []) {
          if (r.id && isSuperAdminUserRecord(r)) ids.add(String(r.id));
        }
      } catch {
        // Ignore if table unavailable in isolated mock
      }
    } else {
      for (const u of mem.staffUsers) {
        if (u?.id && isSuperAdminUserRecord(u)) ids.add(String(u.id));
      }
    }
    return ids;
  }

  function isTicketOwnedBySuperAdmin(ticket, superAdminIds) {
    if (!ticket) return false;
    if (ticket.userId && superAdminIds.has(String(ticket.userId))) return true;
    const emails = [ticket.userEmail, ticket.guestEmail].filter(Boolean);
    return emails.some((email) => String(email).trim().toLowerCase() === 'tiwloltd@gmail.com');
  }

  function sanitizeTicketForViewer(ticket, { viewerType = 'customer', requesterIsSuperAdmin = false, superAdminIds = new Set() } = {}) {
    if (!ticket) return null;
    const copy = { ...ticket };
    delete copy.guestAccessHash;

    const assignedIsSuper = Boolean(
      copy.assignedAgentId && superAdminIds.has(String(copy.assignedAgentId))
    );
    if (assignedIsSuper && (!requesterIsSuperAdmin || viewerType !== 'admin')) {
      copy.assignedAgentId = null;
      copy.assignedAgentName = 'Senior Escalation Team';
      copy.assignedAgent = 'Senior Escalation Team';
      copy.assignedAgentAvatar = null;
      copy.assignedAgentRole = 'Infrastructure Escalation';
    }

    if (viewerType !== 'admin') {
      // Never expose internal metadata keys to customers/guests
      if (copy.metadata && typeof copy.metadata === 'object') {
        const safeMeta = { ...copy.metadata };
        delete safeMeta.internalNotes;
        delete safeMeta.adminFlags;
        copy.metadata = safeMeta;
      }
    }
    return copy;
  }

  function sanitizeMessagesForViewer(messages = [], { includeInternal = false, requesterIsSuperAdmin = false, superAdminIds = new Set() } = {}) {
    return messages
      .filter((m) => m && !m.deletedAt && (includeInternal || !m.isInternal))
      .map((m) => {
        const copy = { ...m };
        if (!requesterIsSuperAdmin && copy.senderId && superAdminIds.has(String(copy.senderId))) {
          copy.senderId = null;
          copy.senderName = 'Senior Escalation Team';
          copy.senderAvatar = null;
          copy.senderRole = 'Infrastructure Escalation';
        }
        return copy;
      });
  }

  async function appendEvent({ ticketId, actorId = null, actorName = 'System', actorType = 'system', eventType, summary, changes = {} }) {
    const evt = {
      id: `evt_${randomUUID()}`,
      ticketId,
      actorId,
      actorName,
      actorType,
      eventType,
      summary,
      changes,
      createdAt: new Date().toISOString()
    };
    if (isUsingPg()) {
      await queryPgFn(
        `INSERT INTO support_ticket_events
           (id, ticket_id, actor_id, actor_name, actor_type, event_type, summary, changes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [evt.id, evt.ticketId, evt.actorId, evt.actorName, evt.actorType, evt.eventType, evt.summary, JSON.stringify(evt.changes || {}), evt.createdAt]
      );
    } else {
      const list = mem.events.get(ticketId) || [];
      list.unshift(evt);
      mem.events.set(ticketId, list);
    }
    return evt;
  }

  async function getSupportToggles() {
    if (isUsingPg()) {
      try {
        const { rows } = await queryPgFn(
          `SELECT settings FROM system_settings WHERE setting_key = $1 LIMIT 1`,
          [SUPPORT_TOGGLES_SETTING_KEY]
        );
        const saved = parseJsonField(rows?.[0]?.settings, {});
        return { ...DEFAULT_SUPPORT_TOGGLES, ...saved };
      } catch {
        return { ...DEFAULT_SUPPORT_TOGGLES, ...mem.toggles };
      }
    }
    return { ...DEFAULT_SUPPORT_TOGGLES, ...mem.toggles };
  }

  async function getPublicSupportConfig() {
    const all = await getSupportToggles();
    const out = {};
    for (const key of PUBLIC_SUPPORT_TOGGLE_KEYS) {
      out[key] = Boolean(all[key]);
    }
    return out;
  }

  async function updateSupportToggles(patch = {}, actor = null) {
    const current = await getSupportToggles();
    const rawPatch = patch && typeof patch === 'object' && !Array.isArray(patch)
      ? (patch.switches && typeof patch.switches === 'object' ? { ...patch.switches, ...patch } : { ...patch })
      : {};
    const toggleAliasPairs = [
      ['allowNewTickets', 'allowNewTicketCreation'],
      ['lockClosedReplies', 'lockClosedTicketReplies'],
      ['allowCustomerReopen', 'allowCustomerReopenClosedTicket'],
      ['fileAttachmentsEnabled', 'allowAttachments'],
      ['restrictStaffToAssignedQueue', 'restrictStaffToAssignedTickets'],
      ['liveChatWidget', 'liveChatWidgetEnabled'],
      ['aiAutoReply', 'aiAutoReplyEnabled'],
      ['guestTicketsEnabled', 'guestTicketingEnabled'],
      ['requireGuestContact', 'requireGuestEmailAndPhone']
    ];
    for (const [aliasKey, canonicalKey] of toggleAliasPairs) {
      if (rawPatch[canonicalKey] === undefined && rawPatch[aliasKey] !== undefined) {
        rawPatch[canonicalKey] = rawPatch[aliasKey];
      }
    }

    const next = { ...current };
    for (const key of Object.keys(DEFAULT_SUPPORT_TOGGLES)) {
      if (Object.prototype.hasOwnProperty.call(rawPatch, key)) {
        if (typeof rawPatch[key] !== 'boolean') {
          throw new SupportServiceError(`Toggle "${key}" must be a boolean.`, {
            statusCode: 400,
            code: 'INVALID_TOGGLE_VALUE'
          });
        }
        next[key] = rawPatch[key];
      }
    }

    if (isUsingPg()) {
      await queryPgFn(
        `INSERT INTO system_settings (setting_key, settings, updated_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key)
         DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
        [SUPPORT_TOGGLES_SETTING_KEY, JSON.stringify(next)]
      );
      // Cross-sync shared keys into chat_system_settings
      try {
        const { rows } = await queryPgFn(
          `SELECT settings FROM system_settings WHERE setting_key = 'chat_system_settings' LIMIT 1`
        );
        const existingChat = rows?.[0]?.settings && typeof rows[0].settings === 'object' ? rows[0].settings : {};
        const syncedChat = {
          ...existingChat,
          liveChatWidgetEnabled: next.liveChatWidgetEnabled,
          aiAutoReplyEnabled: next.aiAutoReplyEnabled,
          guestTicketsEnabled: next.guestTicketingEnabled,
          requireGuestContact: next.requireGuestEmailAndPhone,
          blockChatOnClosedTicket: next.lockClosedTicketReplies
        };
        await queryPgFn(
          `INSERT INTO system_settings (setting_key, settings, updated_at)
           VALUES ('chat_system_settings', $1::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (setting_key)
           DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
          [JSON.stringify(syncedChat)]
        );
      } catch {
        // Non-fatal cross-sync
      }
    }
    mem.toggles = { ...next };
    if (actor?.id) {
      // Best-effort memory update already saved
    }
    return next;
  }

  async function createOrUpdateGuestSession({ guestName, guestEmail, guestPhone, req = null }) {
    const clean = validateGuestContact({ guestName, guestEmail, guestPhone });
    const id = `gsess_${randomUUID()}`;
    const rawToken = signGuestSessionToken(id);
    const tokenHash = sha256Hex(rawToken);
    const ip = extractClientIp(req);
    const ipHash = ip ? sha256Hex(ip) : null;
    const userAgent = req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 500) : null;
    const deviceHint = req?.headers?.['sec-ch-ua-platform']
      ? String(req.headers['sec-ch-ua-platform']).replace(/"/g, '').slice(0, 120)
      : null;
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + GUEST_SESSION_TTL_MS).toISOString();

    const sessionRecord = {
      id,
      tokenHash,
      visitorName: clean.guestName,
      visitorEmail: clean.guestEmail,
      visitorPhone: clean.guestPhone,
      ipHash,
      userAgent,
      deviceHint,
      claimedUserId: null,
      claimedAt: null,
      expiresAt,
      createdAt: now,
      lastSeenAt: now
    };

    if (isUsingPg()) {
      await queryPgFn(
        `INSERT INTO support_guest_sessions
           (id, token_hash, visitor_name, visitor_email, visitor_phone, ip_hash, user_agent, device_hint, expires_at, created_at, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [id, tokenHash, clean.guestName, clean.guestEmail, clean.guestPhone, ipHash, userAgent, deviceHint, expiresAt, now]
      );
    } else {
      mem.guestSessions.set(id, sessionRecord);
    }

    return {
      session: {
        id: sessionRecord.id,
        visitorName: sessionRecord.visitorName,
        visitorEmail: sessionRecord.visitorEmail,
        visitorPhone: sessionRecord.visitorPhone,
        claimedUserId: null,
        expiresAt,
        createdAt: now,
        lastSeenAt: now
      },
      rawToken
    };
  }

  async function resolveGuestSessionFromRequest(req) {
    const rawToken =
      req?.cookies?.[GUEST_SUPPORT_COOKIE] ||
      req?.headers?.['x-guest-support-token'] ||
      null;
    const verified = verifyGuestSessionToken(rawToken);
    if (!verified) return null;

    let session = null;
    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `SELECT * FROM support_guest_sessions WHERE id = $1 AND token_hash = $2 LIMIT 1`,
        [verified.sessionId, verified.tokenHash]
      );
      if (rows?.[0]) {
        session = mapGuestSessionRow(rows[0]);
        if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
          return null;
        }
        await queryPgFn(
          `UPDATE support_guest_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [session.id]
        ).catch(() => {});
      }
    } else {
      const row = mem.guestSessions.get(verified.sessionId);
      if (row && safeHexEqual(row.tokenHash, verified.tokenHash)) {
        if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) {
          return null;
        }
        row.lastSeenAt = new Date().toISOString();
        session = { ...row };
      }
    }
    if (!session) return null;
    const { tokenHash: _omit, ipHash: _omitIp, ...safeSession } = session;
    return safeSession;
  }

  async function findRawTicketByIdentifier(idOrNumber) {
    const raw = String(idOrNumber || '').trim();
    if (!raw) return null;
    const noHash = raw.replace(/^#+/, '');
    const withHash = `#${noHash}`;

    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `SELECT * FROM support_tickets
         WHERE id = $1 OR LOWER(ticket_id) = LOWER($2) OR LOWER(serial_number) = LOWER($3)
         LIMIT 1`,
        [raw, noHash, withHash]
      );
      return rows?.[0] ? mapTicketRow(rows[0]) : null;
    }

    const found = mem.tickets.find(
      (t) =>
        t.id === raw ||
        String(t.ticketId || '').toLowerCase() === noHash.toLowerCase() ||
        String(t.serialNumber || '').toLowerCase() === withHash.toLowerCase()
    );
    return found ? { ...found } : null;
  }

  async function generateUniqueTicketIdentifiers() {
    for (let i = 0; i < 6; i += 1) {
      const num = Math.floor(10000 + Math.random() * 90000);
      const ticketId = `TWTK-${num}`;
      const existing = await findRawTicketByIdentifier(ticketId);
      if (!existing) {
        return {
          id: `tkt_${randomUUID()}`,
          ticketId,
          serialNumber: `#${ticketId}`
        };
      }
    }
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    const ticketId = `TWTK-${suffix}`;
    return {
      id: `tkt_${randomUUID()}`,
      ticketId,
      serialNumber: `#${ticketId}`
    };
  }

  async function insertMessageRecord({
    ticketId,
    senderId = null,
    senderType = 'user',
    senderName = null,
    senderAvatar = null,
    senderRole = null,
    message,
    isInternal = false,
    attachments = []
  }) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      throw new SupportServiceError('Message text is required.', { statusCode: 400, code: 'MESSAGE_REQUIRED' });
    }
    const now = new Date().toISOString();
    const msg = {
      id: `msg_${randomUUID()}`,
      ticketId,
      senderId,
      senderType,
      senderName,
      senderAvatar,
      senderRole,
      message: cleanMessage.slice(0, 10000),
      isInternal: Boolean(isInternal),
      editedAt: null,
      editHistory: [],
      attachments: normalizeAttachments(attachments),
      deletedAt: null,
      createdAt: now
    };
    if (isUsingPg()) {
      await queryPgFn(
        `INSERT INTO support_ticket_messages
           (id, ticket_id, sender_id, sender_type, sender_name, sender_avatar, sender_role,
            message, is_internal, edit_history, attachments, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)`,
        [
          msg.id, msg.ticketId, msg.senderId, msg.senderType, msg.senderName, msg.senderAvatar, msg.senderRole,
          msg.message, msg.isInternal, JSON.stringify([]), JSON.stringify(msg.attachments), msg.createdAt
        ]
      );
    } else {
      const list = mem.messages.get(ticketId) || [];
      list.push(msg);
      mem.messages.set(ticketId, list);
    }
    return msg;
  }

  async function listMessagesForTicket(ticketId) {
    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `SELECT * FROM support_ticket_messages
         WHERE ticket_id = $1 AND deleted_at IS NULL
         ORDER BY created_at ASC`,
        [ticketId]
      );
      return (rows || []).map(mapMessageRow);
    }
    return (mem.messages.get(ticketId) || [])
      .filter((m) => !m.deletedAt)
      .map((m) => ({ ...m, editHistory: [...(m.editHistory || [])], attachments: [...(m.attachments || [])] }));
  }

  async function listEventsForTicket(ticketId) {
    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `SELECT * FROM support_ticket_events WHERE ticket_id = $1 ORDER BY created_at DESC`,
        [ticketId]
      );
      return (rows || []).map(mapEventRow);
    }
    return (mem.events.get(ticketId) || []).map((e) => ({ ...e }));
  }

  async function listAssignableSupportStaff(requesterIsSuperAdmin = false) {
    let rows = [];
    if (isUsingPg()) {
      try {
        const res = await queryPgFn(
          `SELECT u.id, u.name, u.store_name, u.email, u.avatar, u.role, u.is_banned,
                  p.role_key, p.is_active
           FROM system_users u
           LEFT JOIN system_admin_staff_profiles p ON p.user_id = u.id
           WHERE u.role IN ('admin', 'super_admin')
             AND COALESCE(u.is_banned, FALSE) = FALSE
             AND COALESCE(p.is_active, TRUE) = TRUE
           ORDER BY CASE WHEN u.role = 'super_admin' THEN 0 ELSE 1 END, u.name ASC NULLS LAST`
        );
        rows = res.rows || [];
      } catch (err) {
        if (err?.code === '42P01') {
          const res = await queryPgFn(
            `SELECT id, name, store_name, email, avatar, role, is_banned
             FROM system_users
             WHERE role IN ('admin', 'super_admin') AND COALESCE(is_banned, FALSE) = FALSE
             ORDER BY name ASC NULLS LAST`
          );
          rows = res.rows || [];
        } else {
          throw err;
        }
      }
    } else {
      rows = mem.staffUsers
        .filter((u) => ['admin', 'super_admin'].includes(u.role) && !u.isBanned)
        .map((u) => {
          const prof = mem.staffProfiles.get(u.id);
          return {
            id: u.id,
            name: u.name,
            store_name: u.storeName,
            email: u.email,
            avatar: u.avatar || null,
            role: u.role,
            is_banned: Boolean(u.isBanned),
            role_key: prof?.roleKey || u.roleKey || null,
            is_active: prof ? prof.isActive !== false : u.isActive !== false
          };
        })
        .filter((r) => r.is_active !== false);
    }

    return rows
      .filter((row) => requesterIsSuperAdmin || !isSuperAdminUserRecord(row))
      .map((row) => {
        const roleKey = isSuperAdminUserRecord(row)
          ? 'super_admin'
          : (row.role_key || 'support_agent');
        const meta = ROLE_METADATA[roleKey] || ROLE_METADATA.support_agent;
        return {
          id: row.id,
          name: row.name || row.store_name || row.email || 'Support Specialist',
          email: row.email || '',
          avatar: row.avatar || null,
          role: roleKey,
          roleLabel: meta.roleLabel,
          tier: Number(row.tier || meta.tier || 1),
          department: row.department || meta.department || 'Customer Support'
        };
      });
  }

  async function createTicket({
    authUser = null,
    guestSession = null,
    guestContact = null,
    req = null,
    subject,
    description = '',
    category = 'General',
    department = 'general',
    priority = 'medium',
    channel = 'web',
    tiwiId = null,
    storeId = null,
    storeName = null,
    attachments = [],
    tags = [],
    watchers = [],
    assignedAgent = null,
    parentTicketId = null,
    initialMessages = null,
    metadata = {}
  } = {}) {
    const toggles = await getSupportToggles();
    if (!toggles.allowNewTicketCreation) {
      throw new SupportServiceError('New support ticket creation is currently disabled.', {
        statusCode: 403,
        code: 'TICKET_CREATION_DISABLED'
      });
    }

    const cleanSubject = String(subject || '').trim();
    if (!cleanSubject) {
      throw new SupportServiceError('Subject is required.', { statusCode: 400, code: 'SUBJECT_REQUIRED' });
    }

    let activeGuestSession = guestSession;
    let rawGuestToken = null;
    let recoveryCode = null;
    let guestAccessHash = null;
    let requesterType = authUser ? 'user' : 'guest';

    if (!authUser) {
      if (!toggles.guestTicketingEnabled) {
        throw new SupportServiceError('Guest ticketing is currently disabled. Please sign in to create a ticket.', {
          statusCode: 403,
          code: 'GUEST_TICKETING_DISABLED'
        });
      }
      if (!activeGuestSession) {
        if (!guestContact && toggles.requireGuestEmailAndPhone) {
          validateGuestContact({});
        }
        const created = await createOrUpdateGuestSession({ ...(guestContact || {}), req });
        activeGuestSession = created.session;
        rawGuestToken = created.rawToken;
      } else if (guestContact && (guestContact.guestEmail || guestContact.email || guestContact.guestPhone || guestContact.phone)) {
        // Validate supplied override contact if provided
        validateGuestContact({
          guestName: guestContact.guestName || guestContact.name || activeGuestSession.visitorName,
          guestEmail: guestContact.guestEmail || guestContact.email || activeGuestSession.visitorEmail,
          guestPhone: guestContact.guestPhone || guestContact.phone || activeGuestSession.visitorPhone
        });
      }
      recoveryCode = generateReadableRecoveryCode();
      guestAccessHash = sha256Hex(normalizeRecoveryCode(recoveryCode));
    }

    const normPriority = normalizeTicketPriority(priority);
    const ids = await generateUniqueTicketIdentifiers();
    const now = new Date().toISOString();
    const slaResolveDueAt = computeSlaDueAt(now, normPriority);
    const slaResponseDueAt = computeSlaResponseDueAt(now, normPriority);
    const slaDueAt = slaResolveDueAt;
    const cleanDesc = String(description || '').trim().slice(0, 20000);

    const record = {
      id: ids.id,
      ticketId: ids.ticketId,
      serialNumber: ids.serialNumber,
      userId: authUser ? authUser.id : null,
      userName: authUser ? (authUser.name || authUser.storeName || authUser.email || 'Customer') : null,
      userEmail: authUser ? (authUser.email || null) : null,
      requesterType,
      guestSessionId: activeGuestSession ? activeGuestSession.id : null,
      guestName: activeGuestSession ? activeGuestSession.visitorName : null,
      guestEmail: activeGuestSession ? activeGuestSession.visitorEmail : null,
      guestPhone: activeGuestSession ? activeGuestSession.visitorPhone : null,
      guestAccessHash,
      tiwiId: tiwiId || authUser?.tiwiId || null,
      storeId: storeId || authUser?.storeId || null,
      storeName: storeName || authUser?.storeName || null,
      channel: String(channel || 'web').slice(0, 32),
      subject: cleanSubject.slice(0, 255),
      description: cleanDesc,
      category: String(category || 'General').slice(0, 128),
      department: String(department || 'general').slice(0, 64),
      priority: normPriority,
      status: 'open',
      escalationTier: 1,
      assignedAgentId: assignedAgent?.id || null,
      assignedAgentName: assignedAgent?.name || null,
      assignedAgentAvatar: assignedAgent?.avatar || null,
      assignedAgentRole: assignedAgent?.roleLabel || assignedAgent?.role || null,
      tags: normalizeTagList(tags),
      watchers: normalizeWatcherList(watchers),
      attachments: normalizeAttachments(attachments),
      slaDueAt,
      slaResponseDueAt,
      slaResolveDueAt,
      slaBreachNotifiedAt: null,
      autoCloseAt: null,
      snoozedUntil: null,
      firstResponseAt: null,
      resolvedAt: null,
      closedAt: null,
      csatRating: null,
      csatComment: null,
      mergedIntoId: null,
      parentTicketId: parentTicketId || null,
      unreadByUser: false,
      unreadByStaff: true,
      resolution: null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      createdAt: now,
      updatedAt: now
    };

    if (isUsingPg()) {
      await queryPgFn(
        `INSERT INTO support_tickets (
           id, ticket_id, serial_number, user_id, user_name, user_email,
           requester_type, guest_session_id, guest_name, guest_email, guest_phone, guest_access_hash,
           tiwi_id, store_id, store_name, channel, subject, description, category, department,
           priority, status, escalation_tier,
           assigned_agent_id, assigned_agent_name, assigned_agent_avatar, assigned_agent_role,
           tags, watchers, attachments, sla_due_at, sla_response_due_at, sla_resolve_due_at,
           parent_ticket_id, unread_by_user, unread_by_staff, metadata, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12,
           $13, $14, $15, $16, $17, $18, $19, $20,
           $21, $22, $23,
           $24, $25, $26, $27,
           $28::jsonb, $29::jsonb, $30::jsonb, $31, $32, $33,
           $34, $35, $36, $37::jsonb, $38, $39
         )`,
        [
          record.id, record.ticketId, record.serialNumber, record.userId, record.userName, record.userEmail,
          record.requesterType, record.guestSessionId, record.guestName, record.guestEmail, record.guestPhone, record.guestAccessHash,
          record.tiwiId, record.storeId, record.storeName, record.channel, record.subject, record.description, record.category, record.department,
          record.priority, record.status, record.escalationTier,
          record.assignedAgentId, record.assignedAgentName, record.assignedAgentAvatar, record.assignedAgentRole,
          JSON.stringify(record.tags), JSON.stringify(record.watchers), JSON.stringify(record.attachments),
          record.slaDueAt, record.slaResponseDueAt, record.slaResolveDueAt,
          record.parentTicketId, record.unreadByUser, record.unreadByStaff, JSON.stringify(record.metadata),
          record.createdAt, record.updatedAt
        ]
      );
    } else {
      mem.tickets.unshift(record);
    }

    if (Array.isArray(initialMessages) && initialMessages.length > 0) {
      for (const m of initialMessages) {
        if (!m?.message) continue;
        await insertMessageRecord({
          ticketId: record.id,
          senderId: m.senderId ?? (authUser?.id || activeGuestSession?.id || null),
          senderType: m.senderType || (authUser ? 'user' : 'guest'),
          senderName: m.senderName || (authUser ? record.userName : record.guestName),
          senderAvatar: m.senderAvatar || null,
          senderRole: m.senderRole || null,
          message: m.message,
          isInternal: false,
          attachments: m.attachments || []
        });
      }
    } else if (cleanDesc) {
      await insertMessageRecord({
        ticketId: record.id,
        senderId: authUser?.id || activeGuestSession?.id || null,
        senderType: authUser ? 'user' : 'guest',
        senderName: authUser ? record.userName : record.guestName,
        message: cleanDesc,
        isInternal: false,
        attachments: record.attachments
      });
    }

    await appendEvent({
      ticketId: record.id,
      actorId: authUser?.id || activeGuestSession?.id || null,
      actorName: authUser ? record.userName : record.guestName,
      actorType: authUser ? 'user' : 'guest',
      eventType: 'ticket_created',
      summary: `Ticket ${record.serialNumber} created (${record.priority} priority)`
    });

    const thread = await createOrGetTicketEmailThread(record);
    record.metadata = {
      ...(record.metadata || {}),
      replyToEmailAlias: thread.replyToAlias,
      emailThreadRootId: thread.rootMessageId
    };
    await persistTicketUpdate(record.id, { metadata: record.metadata }).catch(() => {});

    const recipientEmail = authUser ? record.userEmail : record.guestEmail;
    if (recipientEmail) {
      const html = renderSupportTicketEmail({
        recipientEmail,
        recipientName: authUser ? record.userName : record.guestName,
        eventType: 'created',
        ticketNumber: record.serialNumber,
        subject: record.subject,
        status: record.status,
        priority: record.priority,
        department: record.department,
        replyToAlias: thread.replyToAlias,
        senderName: 'Tiwlo Support Desk',
        messageBody: `${record.description}${recoveryCode ? `\n\nGuest Portal Recovery Code: ${recoveryCode}` : ''}`,
        attachments: record.attachments
      });
      notifyEmailNonFatal({
        to: recipientEmail,
        replyTo: thread.replyToAlias,
        headers: {
          'Message-ID': thread.rootMessageId,
          'References': thread.rootMessageId,
          'X-Tiwlo-Ticket-Ref': record.serialNumber
        },
        subject: `[${record.serialNumber}] Support Ticket Created: ${record.subject}`,
        html,
        text: `Ticket ${record.serialNumber} created. Subject: ${record.subject}${recoveryCode ? ` | Recovery Code: ${recoveryCode}` : ''} | Reply-To: ${thread.replyToAlias}`,
        type: 'support_ticket_created',
        metadata: { ticketId: record.ticketId, ticketNumber: record.serialNumber }
      });
    }

    const mapped = mapTicketRow(record);
    return {
      ticket: sanitizeTicketForViewer(mapped, { viewerType: authUser ? 'customer' : 'guest' }),
      recoveryCode,
      guestSession: activeGuestSession,
      rawToken: rawGuestToken
    };
  }

  function isRequesterOwner(ticket, { authUser = null, guestSession = null } = {}) {
    if (!ticket) return false;
    if (authUser) {
      if (isSuperAdminUserRecord(authUser) || authUser.role === 'admin') return true;
      if (ticket.userId && (ticket.userId === authUser.id || (authUser.tiwiId && ticket.userId === authUser.tiwiId))) {
        return true;
      }
    }
    if (guestSession && ticket.guestSessionId && ticket.guestSessionId === guestSession.id) {
      return true;
    }
    return false;
  }

  function matchesSearchQuery(ticket, q) {
    if (!q || !String(q).trim()) return true;
    const rawQ = String(q).trim().toLowerCase();
    const noHashQ = normalizeSearchNumber(rawQ);
    const haystacks = [
      ticket.id,
      ticket.ticketId,
      normalizeSearchNumber(ticket.ticketId),
      ticket.serialNumber,
      normalizeSearchNumber(ticket.serialNumber),
      ticket.subject,
      ticket.description,
      ticket.userEmail,
      ticket.userName,
      ticket.guestEmail,
      ticket.guestPhone,
      ticket.guestName,
      ticket.tiwiId,
      ticket.storeName
    ];
    return haystacks.some((val) => {
      if (!val) return false;
      const s = String(val).toLowerCase();
      return s.includes(rawQ) || (noHashQ && s.includes(noHashQ));
    });
  }

  async function listTicketsForRequester({ authUser = null, guestSession = null, q = '', status = '', priority = '' } = {}) {
    if (!authUser && !guestSession) {
      throw new SupportServiceError('Authentication or verified guest support session required.', {
        statusCode: 401,
        code: 'GUEST_CONTACT_REQUIRED'
      });
    }
    const superAdminIds = await getSuperAdminIdSet();
    let rows = [];

    if (isUsingPg()) {
      const conditions = [];
      const params = [];
      if (authUser) {
        params.push(authUser.id);
        const uidIdx = params.length;
        if (authUser.tiwiId) {
          params.push(authUser.tiwiId);
          conditions.push(`(user_id = $${uidIdx} OR user_id = $${params.length})`);
        } else {
          conditions.push(`user_id = $${uidIdx}`);
        }
      }
      if (guestSession) {
        params.push(guestSession.id);
        conditions.push(`guest_session_id = $${params.length}`);
      }
      const { rows: sqlRows } = await queryPgFn(
        `SELECT * FROM support_tickets WHERE ${conditions.join(' OR ')} ORDER BY updated_at DESC`,
        params
      );
      rows = (sqlRows || []).map(mapTicketRow);
    } else {
      rows = mem.tickets
        .filter((t) => isRequesterOwner(t, { authUser, guestSession }))
        .map(mapTicketRow);
    }

    const filterStatus = status ? normalizeTicketStatus(status) : null;
    const filterPriority = priority ? normalizeTicketPriority(priority) : null;

    return rows
      .filter((t) => (!filterStatus || t.status === filterStatus))
      .filter((t) => (!filterPriority || t.priority === filterPriority))
      .filter((t) => matchesSearchQuery(t, q))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .map((t) => sanitizeTicketForViewer(t, {
        viewerType: authUser ? 'customer' : 'guest',
        superAdminIds
      }));
  }

  function isTicketVisibleToStaff(ticket, { adminUser, adminProfile, toggles, superAdminIds }) {
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);
    if (!requesterIsSuperAdmin && isTicketOwnedBySuperAdmin(ticket, superAdminIds)) {
      return false;
    }
    if (
      !requesterIsSuperAdmin &&
      ticket.status !== 'closed' &&
      ticket.metadata?.assignmentStatus === 'accepted' &&
      ticket.assignedAgentId &&
      String(ticket.assignedAgentId) !== String(adminUser?.id || '')
    ) {
      return false;
    }
    if (!requesterIsSuperAdmin && toggles.restrictStaffToAssignedTickets) {
      const hasViewAll = hasSupportPermission(adminUser, adminProfile, 'support.view_all');
      if (!hasViewAll) {
        if (ticket.assignedAgentId && ticket.assignedAgentId !== adminUser.id) {
          return false;
        }
      }
    }
    return true;
  }

  async function listAdminTickets({
    q = '',
    status = '',
    priority = '',
    category = '',
    department = '',
    assignedAgentId = '',
    requesterType = '',
    slaBreached = null,
    page = 1,
    limit = 25,
    adminUser = null,
    adminProfile = null
  } = {}) {
    const toggles = await getSupportToggles();
    const superAdminIds = await getSuperAdminIdSet();
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);

    let allTickets = [];
    if (isUsingPg()) {
      const { rows } = await queryPgFn(`SELECT * FROM support_tickets ORDER BY updated_at DESC`);
      allTickets = (rows || []).map(mapTicketRow);
      // Preserve legacy PICK Account Appeal records from SupportDB if present
      try {
        const legacy = await SupportDB.getTickets();
        const existingIds = new Set(allTickets.map((t) => t.id));
        for (const lt of legacy || []) {
          if (lt?.category === 'PICK Account Appeal' && !existingIds.has(lt.id)) {
            allTickets.push(mapTicketRow(lt));
          }
        }
      } catch {
        // Ignore if state doc unavailable
      }
    } else {
      allTickets = mem.tickets.map(mapTicketRow);
    }

    const normStatus = status ? normalizeTicketStatus(status) : null;
    const normPriority = priority ? normalizeTicketPriority(priority) : null;

    const visibleTickets = allTickets
      .filter((t) => isTicketVisibleToStaff(t, { adminUser, adminProfile, toggles, superAdminIds }));

    const statusCounts = {
      all: visibleTickets.length,
      open: 0,
      in_progress: 0,
      waiting_customer: 0,
      on_hold: 0,
      escalated: 0,
      resolved: 0,
      closed: 0
    };
    for (const vt of visibleTickets) {
      if (Object.prototype.hasOwnProperty.call(statusCounts, vt.status)) {
        statusCounts[vt.status] += 1;
      }
    }

    const filtered = visibleTickets
      .filter((t) => !normStatus || t.status === normStatus)
      .filter((t) => !normPriority || t.priority === normPriority)
      .filter((t) => !category || String(t.category || '').toLowerCase() === String(category).trim().toLowerCase())
      .filter((t) => !department || String(t.department || '').toLowerCase() === String(department).trim().toLowerCase())
      .filter((t) => {
        if (!assignedAgentId) return true;
        if (assignedAgentId === 'unassigned') return !t.assignedAgentId;
        return t.assignedAgentId === assignedAgentId;
      })
      .filter((t) => !requesterType || t.requesterType === requesterType)
      .filter((t) => {
        if (slaBreached === null || slaBreached === undefined || slaBreached === '') return true;
        const want = slaBreached === true || slaBreached === 'true';
        return t.slaBreached === want;
      })
      .filter((t) => matchesSearchQuery(t, q))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 25));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const offset = (safePage - 1) * safeLimit;
    const items = filtered
      .slice(offset, offset + safeLimit)
      .map((t) => sanitizeTicketForViewer(t, { viewerType: 'admin', requesterIsSuperAdmin, superAdminIds }));

    return {
      tickets: items,
      statusCounts,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages
    };
  }

  async function getTicketDetail(ticketIdOrKey, {
    viewerType = 'customer',
    authUser = null,
    guestSession = null,
    adminUser = null,
    adminProfile = null
  } = {}) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const superAdminIds = await getSuperAdminIdSet();
    const requesterIsSuperAdmin = viewerType === 'admin' ? isSuperAdminUserRecord(adminUser) : false;

    if (viewerType === 'admin') {
      const toggles = await getSupportToggles();
      if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
        throw new SupportServiceError('Not authorized to access this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    } else if (!isRequesterOwner(raw, { authUser, guestSession })) {
      throw new SupportServiceError('Not authorized to access this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    const [rawMessages, rawEvents] = await Promise.all([
      listMessagesForTicket(raw.id),
      listEventsForTicket(raw.id)
    ]);

    const includeInternal = viewerType === 'admin';
    const messages = sanitizeMessagesForViewer(rawMessages, {
      includeInternal,
      requesterIsSuperAdmin,
      superAdminIds
    });

    const events = includeInternal
      ? rawEvents
      : rawEvents.filter((e) => !['internal_note_added', 'staff_collision_view'].includes(e.eventType));

    let subTickets = [];
    let parentTicket = null;
    if (isUsingPg()) {
      const { rows: subRows } = await queryPgFn(
        `SELECT * FROM support_tickets WHERE parent_ticket_id = $1 ORDER BY created_at ASC`,
        [raw.id]
      );
      subTickets = (subRows || [])
        .map(mapTicketRow)
        .map((st) => sanitizeTicketForViewer(st, { viewerType, requesterIsSuperAdmin, superAdminIds }));
    } else {
      subTickets = mem.tickets
        .filter((t) => t.parentTicketId === raw.id)
        .map(mapTicketRow)
        .map((st) => sanitizeTicketForViewer(st, { viewerType, requesterIsSuperAdmin, superAdminIds }));
    }

    if (raw.parentTicketId) {
      const p = await findRawTicketByIdentifier(raw.parentTicketId);
      if (p) {
        parentTicket = sanitizeTicketForViewer(p, { viewerType, requesterIsSuperAdmin, superAdminIds });
      }
    }

    return {
      ticket: sanitizeTicketForViewer(raw, { viewerType, requesterIsSuperAdmin, superAdminIds }),
      messages,
      events,
      subTickets,
      parentTicket,
      ...(viewerType === 'admin' ? { viewers: getActiveTicketViewers(raw.id, requesterIsSuperAdmin) } : {})
    };
  }

  async function lookupGuestTicket({ ticketNumber, guestEmail, guestPhone, recoveryCode, req = null }) {
    const cleanNumber = String(ticketNumber || '').trim();
    const cleanCode = normalizeRecoveryCode(recoveryCode);
    if (!cleanNumber || !cleanCode) {
      throw new SupportServiceError('Ticket number, contact details, and recovery code are required.', {
        statusCode: 400,
        code: 'GUEST_LOOKUP_FIELDS_REQUIRED'
      });
    }
    const contact = validateGuestContact({
      guestName: 'Verified Visitor',
      guestEmail,
      guestPhone
    });

    const raw = await findRawTicketByIdentifier(cleanNumber);
    if (!raw || !raw.guestAccessHash) {
      throw new SupportServiceError('Invalid ticket number, contact details, or recovery code.', {
        statusCode: 401,
        code: 'GUEST_LOOKUP_FAILED'
      });
    }

    const emailMatch = String(raw.guestEmail || '').trim().toLowerCase() === contact.guestEmail;
    const phoneMatch = normalizePhoneDigits(raw.guestPhone) === normalizePhoneDigits(contact.guestPhone);
    const codeMatch = safeHexEqual(sha256Hex(cleanCode), raw.guestAccessHash);

    if (!emailMatch || !phoneMatch || !codeMatch) {
      throw new SupportServiceError('Invalid ticket number, contact details, or recovery code.', {
        statusCode: 401,
        code: 'GUEST_LOOKUP_FAILED'
      });
    }

    const created = await createOrUpdateGuestSession({
      guestName: raw.guestName || 'Guest Visitor',
      guestEmail: raw.guestEmail,
      guestPhone: raw.guestPhone,
      req
    });

    // Attach new verified session id to ticket so cross-browser session stays linked
    if (isUsingPg()) {
      await queryPgFn(
        `UPDATE support_tickets SET guest_session_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [created.session.id, raw.id]
      );
    } else {
      const idx = mem.tickets.findIndex((t) => t.id === raw.id);
      if (idx >= 0) {
        mem.tickets[idx].guestSessionId = created.session.id;
      }
    }

    const detail = await getTicketDetail(raw.id, {
      viewerType: 'guest',
      guestSession: created.session
    });

    return {
      ...detail,
      guestSession: created.session,
      rawToken: created.rawToken
    };
  }

  async function claimGuestSessionsForUser({ userId, userEmail = '', userName = '', req = null } = {}) {
    if (!userId) {
      throw new SupportServiceError('Authenticated userId is required.', { statusCode: 400, code: 'USER_ID_REQUIRED' });
    }
    let resolvedEmail = String(userEmail || '').trim().toLowerCase();
    let resolvedName = String(userName || '').trim();

    if (!resolvedEmail && isUsingPg()) {
      try {
        const { rows } = await queryPgFn(`SELECT email, name, store_name FROM system_users WHERE id = $1 LIMIT 1`, [userId]);
        if (rows?.[0]) {
          resolvedEmail = String(rows[0].email || '').trim().toLowerCase();
          resolvedName = resolvedName || rows[0].name || rows[0].store_name || '';
        }
      } catch {
        // Ignore
      }
    } else if (!resolvedEmail) {
      try {
        const user = await MasterDB.findUserByIdentifier(userId);
        if (user) {
          resolvedEmail = String(user.email || '').trim().toLowerCase();
          resolvedName = resolvedName || user.name || user.storeName || '';
        }
      } catch {
        // Ignore
      }
    }

    const cookieSession = req ? await resolveGuestSessionFromRequest(req) : null;
    const now = new Date().toISOString();
    const matchedSessionIds = new Set();
    if (cookieSession?.id) matchedSessionIds.add(cookieSession.id);

    if (isUsingPg()) {
      if (resolvedEmail) {
        const { rows: sessRows } = await queryPgFn(
          `SELECT id FROM support_guest_sessions WHERE LOWER(visitor_email) = LOWER($1)`,
          [resolvedEmail]
        );
        for (const r of sessRows || []) matchedSessionIds.add(r.id);
      }

      const sessionList = Array.from(matchedSessionIds);
      let claimedSessionCount = 0;
      if (sessionList.length > 0) {
        const sessRes = await queryPgFn(
          `UPDATE support_guest_sessions
           SET claimed_user_id = $1, claimed_at = $2
           WHERE id = ANY($3::varchar[]) AND (claimed_user_id IS NULL OR claimed_user_id = $1)`,
          [userId, now, sessionList]
        );
        claimedSessionCount = sessRes.rowCount || 0;
      }

      const ticketMatchClauses = [];
      const params = [userId, resolvedEmail || null, resolvedName || null, now];
      if (sessionList.length > 0) {
        params.push(sessionList);
        ticketMatchClauses.push(`guest_session_id = ANY($${params.length}::varchar[])`);
      }
      if (resolvedEmail) {
        params.push(resolvedEmail);
        ticketMatchClauses.push(`(requester_type = 'guest' AND LOWER(guest_email) = LOWER($${params.length}))`);
      }
      if (ticketMatchClauses.length === 0) {
        return { claimedTicketCount: 0, claimedSessionCount, ticketIds: [] };
      }

      const { rows: claimedRows } = await queryPgFn(
        `UPDATE support_tickets
         SET user_id = $1,
             user_email = COALESCE(NULLIF(user_email, ''), NULLIF($2, ''), guest_email),
             user_name = COALESCE(NULLIF(user_name, ''), NULLIF($3, ''), guest_name),
             updated_at = $4
         WHERE (user_id IS NULL OR user_id = '' OR user_id = 'guest')
           AND (${ticketMatchClauses.join(' OR ')})
         RETURNING id, serial_number`,
        params
      );

      for (const r of claimedRows || []) {
        await appendEvent({
          ticketId: r.id,
          actorId: userId,
          actorName: resolvedName || resolvedEmail || userId,
          actorType: 'user',
          eventType: 'guest_claimed',
          summary: `Guest ticket ${r.serial_number || r.id} claimed by registered user ${userId}`
        });
      }

      return {
        claimedTicketCount: (claimedRows || []).length,
        claimedSessionCount,
        ticketIds: (claimedRows || []).map((r) => r.id)
      };
    }

    // In-memory mode
    let claimedSessionCount = 0;
    for (const sess of mem.guestSessions.values()) {
      const matches =
        matchedSessionIds.has(sess.id) ||
        (resolvedEmail && String(sess.visitorEmail || '').toLowerCase() === resolvedEmail);
      if (matches) {
        matchedSessionIds.add(sess.id);
        if (!sess.claimedUserId) {
          sess.claimedUserId = userId;
          sess.claimedAt = now;
          claimedSessionCount += 1;
        }
      }
    }

    const claimedIds = [];
    for (const t of mem.tickets) {
      const unclaimed = !t.userId || t.userId === 'guest';
      const matchesSession = t.guestSessionId && matchedSessionIds.has(t.guestSessionId);
      const matchesEmail = resolvedEmail && t.requesterType === 'guest' && String(t.guestEmail || '').toLowerCase() === resolvedEmail;
      if (unclaimed && (matchesSession || matchesEmail)) {
        t.userId = userId;
        t.userEmail = t.userEmail || resolvedEmail || t.guestEmail;
        t.userName = t.userName || resolvedName || t.guestName;
        t.updatedAt = now;
        claimedIds.push(t.id);
        await appendEvent({
          ticketId: t.id,
          actorId: userId,
          actorName: resolvedName || resolvedEmail || userId,
          actorType: 'user',
          eventType: 'guest_claimed',
          summary: `Guest ticket ${t.serialNumber} claimed by registered user ${userId}`
        });
      }
    }

    return {
      claimedTicketCount: claimedIds.length,
      claimedSessionCount,
      ticketIds: claimedIds
    };
  }

  async function persistTicketUpdate(ticketId, fields) {
    const now = new Date().toISOString();
    if (isUsingPg()) {
      const setClauses = ['updated_at = $2'];
      const params = [ticketId, now];
      const colMap = {
        subject: 'subject',
        description: 'description',
        category: 'category',
        department: 'department',
        priority: 'priority',
        status: 'status',
        escalationTier: 'escalation_tier',
        assignedAgentId: 'assigned_agent_id',
        assignedAgentName: 'assigned_agent_name',
        assignedAgentAvatar: 'assigned_agent_avatar',
        assignedAgentRole: 'assigned_agent_role',
        slaDueAt: 'sla_due_at',
        slaResponseDueAt: 'sla_response_due_at',
        slaResolveDueAt: 'sla_resolve_due_at',
        slaBreachNotifiedAt: 'sla_breach_notified_at',
        autoCloseAt: 'auto_close_at',
        snoozedUntil: 'snoozed_until',
        firstResponseAt: 'first_response_at',
        resolvedAt: 'resolved_at',
        closedAt: 'closed_at',
        csatRating: 'csat_rating',
        csatComment: 'csat_comment',
        mergedIntoId: 'merged_into_id',
        parentTicketId: 'parent_ticket_id',
        unreadByUser: 'unread_by_user',
        unreadByStaff: 'unread_by_staff',
        resolution: 'resolution',
        userId: 'user_id',
        userName: 'user_name',
        userEmail: 'user_email'
      };
      const jsonCols = { tags: 'tags', watchers: 'watchers', attachments: 'attachments', metadata: 'metadata' };

      for (const [k, col] of Object.entries(colMap)) {
        if (Object.prototype.hasOwnProperty.call(fields, k)) {
          params.push(fields[k]);
          setClauses.push(`${col} = $${params.length}`);
        }
      }
      for (const [k, col] of Object.entries(jsonCols)) {
        if (Object.prototype.hasOwnProperty.call(fields, k)) {
          params.push(JSON.stringify(fields[k]));
          setClauses.push(`${col} = $${params.length}::jsonb`);
        }
      }

      const { rows } = await queryPgFn(
        `UPDATE support_tickets SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
        params
      );
      return rows?.[0] ? mapTicketRow(rows[0]) : null;
    }

    const idx = mem.tickets.findIndex((t) => t.id === ticketId);
    if (idx < 0) return null;
    Object.assign(mem.tickets[idx], fields, { updatedAt: now });
    return mapTicketRow(mem.tickets[idx]);
  }

  async function addTicketReply({
    ticketIdOrKey,
    message,
    isInternal = false,
    attachments = [],
    actorType = 'customer', // 'customer' | 'guest' | 'admin' | 'bot'
    authUser = null,
    guestSession = null,
    adminUser = null,
    adminProfile = null
  } = {}) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const toggles = await getSupportToggles();
    const superAdminIds = await getSuperAdminIdSet();
    const requesterIsSuperAdmin = actorType === 'admin' ? isSuperAdminUserRecord(adminUser) : false;

    if (actorType === 'admin') {
      if (
        !isInternal &&
        !requesterIsSuperAdmin &&
        raw.assignedAgentId &&
        String(raw.assignedAgentId) !== String(adminUser?.id || '')
      ) {
        throw new SupportServiceError('This ticket is locked exclusively to the specialist who accepted or owns the assignment.', {
          statusCode: 403,
          code: 'TICKET_LOCKED_TO_ASSIGNEE'
        });
      }
      if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
        throw new SupportServiceError('Not authorized to access this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    } else {
      if (!isRequesterOwner(raw, { authUser, guestSession })) {
        throw new SupportServiceError('Not authorized to reply to this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    }

    if (raw.status === 'closed' && toggles.lockClosedTicketReplies !== false && actorType !== 'bot') {
      throw new SupportServiceError('This ticket is closed and permanently locked. Replies are disabled.', {
        statusCode: 403,
        code: 'TICKET_CLOSED_LOCKED'
      });
    }

    if (actorType === 'admin' && !isInternal && !requesterIsSuperAdmin) {
      if (raw.assignedAgentId && String(raw.assignedAgentId) !== String(adminUser?.id || '')) {
        throw new SupportServiceError('This ticket is locked exclusively to the specialist who accepted or owns the assignment.', {
          statusCode: 403,
          code: 'TICKET_LOCKED_TO_ASSIGNEE'
        });
      }
      if (raw.metadata?.assignmentStatus !== 'accepted' || !raw.assignedAgentId) {
        throw new SupportServiceError('You must Accept this ticket before posting a public reply.', {
          statusCode: 403,
          code: 'TICKET_ACCEPTANCE_REQUIRED'
        });
      }
    }

    const effectiveInternal = actorType === 'admin' ? Boolean(isInternal) : false;
    const sender = actorType === 'admin'
      ? {
          senderId: adminUser?.id || null,
          senderType: 'agent',
          senderName: adminUser?.name || adminUser?.email || 'Support Specialist',
          senderAvatar: adminUser?.avatar || null,
          senderRole: adminProfile?.roleKey || (requesterIsSuperAdmin ? 'super_admin' : 'support_agent')
        }
      : actorType === 'bot'
        ? {
            senderId: 'tiwi_ai',
            senderType: 'bot',
            senderName: 'Tiwi AI Assistant',
            senderAvatar: null,
            senderRole: 'AI Support Assistant'
          }
        : authUser
          ? {
              senderId: authUser.id,
              senderType: 'user',
              senderName: authUser.name || authUser.storeName || authUser.email || 'Customer',
              senderAvatar: authUser.avatar || null,
              senderRole: 'customer'
            }
          : {
              senderId: guestSession?.id || null,
              senderType: 'guest',
              senderName: guestSession?.visitorName || raw.guestName || 'Guest',
              senderAvatar: null,
              senderRole: 'guest'
            };

    const msg = await insertMessageRecord({
      ticketId: raw.id,
      ...sender,
      message,
      isInternal: effectiveInternal,
      attachments
    });

    const patch = {};
    if (actorType === 'admin') {
      if (!effectiveInternal) {
        if (!raw.firstResponseAt) patch.firstResponseAt = new Date().toISOString();
        patch.unreadByUser = true;
        patch.unreadByStaff = false;
      }
    } else if (actorType !== 'bot') {
      patch.unreadByStaff = true;
      patch.unreadByUser = false;
      patch.autoCloseAt = null;
      if (raw.status === 'waiting_customer') {
        patch.status = 'open';
      }
    }
    const updated = await persistTicketUpdate(raw.id, patch);

    await appendEvent({
      ticketId: raw.id,
      actorId: sender.senderId,
      actorName: sender.senderName,
      actorType: sender.senderType,
      eventType: effectiveInternal ? 'internal_note_added' : 'reply_added',
      summary: effectiveInternal
        ? `${sender.senderName} added an internal note`
        : `${sender.senderName} posted a reply`
    });

    if (actorType === 'admin' && !effectiveInternal) {
      const recipientEmail = raw.userEmail || raw.guestEmail;
      if (recipientEmail) {
        const thread = await createOrGetTicketEmailThread(raw);
        const html = renderSupportTicketEmail({
          recipientEmail,
          recipientName: raw.userName || raw.guestName || 'Customer',
          eventType: 'reply',
          ticketNumber: raw.serialNumber,
          subject: raw.subject,
          status: updated.status,
          priority: updated.priority,
          department: updated.department,
          replyToAlias: thread.replyToAlias,
          senderName: sender.senderName,
          messageBody: msg.message,
          attachments: msg.attachments
        });
        notifyEmailNonFatal({
          to: recipientEmail,
          replyTo: thread.replyToAlias,
          headers: {
            'In-Reply-To': thread.rootMessageId,
            'References': thread.rootMessageId,
            'X-Tiwlo-Ticket-Ref': raw.serialNumber
          },
          subject: `Reply - Tiwlo Support [Ticket #${raw.serialNumber}] - ${raw.subject}`,
          html,
          text: `Reply - Tiwlo Support [${raw.serialNumber}]: ${msg.message} | Reply directly to: ${thread.replyToAlias}`,
          type: 'support_ticket_reply',
          metadata: { ticketId: raw.ticketId, ticketNumber: raw.serialNumber }
        });
      }
    }

    const sanitizedMsg = sanitizeMessagesForViewer([msg], {
      includeInternal: actorType === 'admin',
      requesterIsSuperAdmin,
      superAdminIds
    })[0];

    return {
      reply: sanitizedMsg,
      ticket: sanitizeTicketForViewer(updated, {
        viewerType: actorType === 'admin' ? 'admin' : (authUser ? 'customer' : 'guest'),
        requesterIsSuperAdmin,
        superAdminIds
      })
    };
  }

  async function editTicketReply({
    ticketIdOrKey,
    replyId,
    message,
    actorType = 'customer',
    authUser = null,
    guestSession = null,
    adminUser = null,
    adminProfile = null
  } = {}) {
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      throw new SupportServiceError('Edited message text cannot be empty.', { statusCode: 400, code: 'MESSAGE_REQUIRED' });
    }
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const toggles = await getSupportToggles();
    const superAdminIds = await getSuperAdminIdSet();
    const requesterIsSuperAdmin = actorType === 'admin' ? isSuperAdminUserRecord(adminUser) : false;

    if (actorType === 'admin') {
      if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
        throw new SupportServiceError('Not authorized to edit replies on this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    } else {
      if (!isRequesterOwner(raw, { authUser, guestSession })) {
        throw new SupportServiceError('Not authorized to edit replies on this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
      if (raw.status === 'closed' && toggles.lockClosedTicketReplies !== false) {
        throw new SupportServiceError('This ticket is closed. Replies are disabled.', {
          statusCode: 403,
          code: 'TICKET_CLOSED_LOCKED'
        });
      }
    }

    const messages = await listMessagesForTicket(raw.id);
    const target = messages.find((m) => m.id === replyId);
    if (!target || target.deletedAt) {
      throw new SupportServiceError('Reply not found.', { statusCode: 404, code: 'REPLY_NOT_FOUND' });
    }

    if (actorType !== 'admin') {
      const ownerActorId = authUser?.id || guestSession?.id;
      if (!ownerActorId || target.senderId !== ownerActorId || target.isInternal) {
        throw new SupportServiceError('You can only edit your own public replies.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    }

    const now = new Date().toISOString();
    const actorId = actorType === 'admin' ? adminUser?.id : (authUser?.id || guestSession?.id || null);
    const actorName = actorType === 'admin'
      ? (adminUser?.name || adminUser?.email || 'Support Specialist')
      : (authUser?.name || guestSession?.visitorName || 'Customer');

    const newEntry = {
      previousMessage: target.message,
      editedById: actorId,
      editedByName: actorName,
      editedAt: now
    };
    const nextHistory = [...(Array.isArray(target.editHistory) ? target.editHistory : []), newEntry];

    let updatedMsg;
    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `UPDATE support_ticket_messages
         SET message = $2, edited_at = $3, edit_history = $4::jsonb
         WHERE id = $1 AND ticket_id = $5
         RETURNING *`,
        [replyId, cleanMessage.slice(0, 10000), now, JSON.stringify(nextHistory), raw.id]
      );
      updatedMsg = mapMessageRow(rows[0]);
      await queryPgFn(`UPDATE support_tickets SET updated_at = $2 WHERE id = $1`, [raw.id, now]);
    } else {
      const list = mem.messages.get(raw.id) || [];
      const idx = list.findIndex((m) => m.id === replyId);
      list[idx].message = cleanMessage.slice(0, 10000);
      list[idx].editedAt = now;
      list[idx].editHistory = nextHistory;
      updatedMsg = { ...list[idx] };
      await persistTicketUpdate(raw.id, {});
    }

    await appendEvent({
      ticketId: raw.id,
      actorId,
      actorName,
      actorType: actorType === 'admin' ? 'agent' : (authUser ? 'user' : 'guest'),
      eventType: 'reply_edited',
      summary: `${actorName} edited a reply`,
      changes: { replyId }
    });

    return {
      reply: sanitizeMessagesForViewer([updatedMsg], {
        includeInternal: actorType === 'admin',
        requesterIsSuperAdmin,
        superAdminIds
      })[0]
    };
  }

  async function updateTicket({
    ticketIdOrKey,
    updates = {},
    actorType = 'customer',
    authUser = null,
    guestSession = null,
    adminUser = null,
    adminProfile = null
  } = {}) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const toggles = await getSupportToggles();
    const superAdminIds = await getSuperAdminIdSet();
    const requesterIsSuperAdmin = actorType === 'admin' ? isSuperAdminUserRecord(adminUser) : false;

    if (actorType === 'admin') {
      if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
        throw new SupportServiceError('Not authorized to update this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    } else {
      if (!isRequesterOwner(raw, { authUser, guestSession })) {
        throw new SupportServiceError('Not authorized to update this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
      }
    }

    const patch = {};
    const changes = {};
    const now = new Date().toISOString();

    if (updates.status !== undefined) {
      const nextStatus = normalizeTicketStatus(updates.status, { allowLegacyRejected: raw.category === 'PICK Account Appeal' || actorType === 'admin' });
      if (raw.status === 'closed' && nextStatus !== 'closed') {
        throw new SupportServiceError('Closed tickets are permanently locked and cannot be reopened by anyone, including administrators.', {
          statusCode: 403,
          code: 'TICKET_CLOSED_PERMANENTLY'
        });
      }
      if (actorType !== 'admin') {
        if (!['open', 'resolved', 'closed'].includes(nextStatus)) {
          throw new SupportServiceError('Customers can only set status to resolved or closed.', {
            statusCode: 403,
            code: 'FORBIDDEN'
          });
        }
      }
      if (nextStatus !== raw.status) {
        patch.status = nextStatus;
        changes.status = { from: raw.status, to: nextStatus };
        if (nextStatus === 'resolved' && !raw.resolvedAt) patch.resolvedAt = now;
        if (nextStatus === 'waiting_customer' || nextStatus === 'resolved') {
          patch.autoCloseAt = updates.autoCloseAt !== undefined
            ? (updates.autoCloseAt ? new Date(updates.autoCloseAt).toISOString() : null)
            : computeAutoCloseAt(now);
        } else if (nextStatus === 'closed') {
          patch.closedAt = now;
          patch.autoCloseAt = null;
        } else {
          patch.autoCloseAt = null;
        }
        if (nextStatus !== 'closed' && raw.closedAt) patch.closedAt = null;
      }
    }

    if (updates.watchers !== undefined) {
      patch.watchers = normalizeWatcherList(updates.watchers);
      changes.watchers = patch.watchers.length;
    }

    if (updates.subject !== undefined) {
      const s = String(updates.subject || '').trim();
      if (!s) throw new SupportServiceError('Subject cannot be empty.', { statusCode: 400, code: 'SUBJECT_REQUIRED' });
      patch.subject = s.slice(0, 255);
      changes.subject = patch.subject;
    }

    if (updates.description !== undefined) {
      patch.description = String(updates.description || '').trim().slice(0, 20000);
    }

    if (actorType === 'admin') {
      if (updates.priority !== undefined) {
        const nextPriority = normalizeTicketPriority(updates.priority);
        if (nextPriority !== raw.priority) {
          patch.priority = nextPriority;
          patch.slaResolveDueAt = computeSlaDueAt(raw.createdAt, nextPriority);
          patch.slaResponseDueAt = computeSlaResponseDueAt(raw.createdAt, nextPriority);
          patch.slaDueAt = patch.slaResolveDueAt;
          changes.priority = { from: raw.priority, to: nextPriority };
        }
      }
      if (updates.autoCloseAt !== undefined && patch.autoCloseAt === undefined) {
        patch.autoCloseAt = updates.autoCloseAt ? new Date(updates.autoCloseAt).toISOString() : null;
        changes.autoCloseAt = patch.autoCloseAt;
      }
      if (updates.snoozedUntil !== undefined) {
        patch.snoozedUntil = updates.snoozedUntil ? new Date(updates.snoozedUntil).toISOString() : null;
        changes.snoozedUntil = patch.snoozedUntil;
      }
      if (updates.category !== undefined) {
        patch.category = String(updates.category || 'General').trim().slice(0, 128);
        changes.category = patch.category;
      }
      if (updates.department !== undefined) {
        patch.department = String(updates.department || 'general').trim().slice(0, 64);
        changes.department = patch.department;
      }
      if (updates.escalationTier !== undefined) {
        const tier = Math.min(3, Math.max(1, Number.parseInt(updates.escalationTier, 10) || 1));
        patch.escalationTier = tier;
        changes.escalationTier = tier;
      }
      if (updates.tags !== undefined) {
        patch.tags = normalizeTagList(updates.tags);
        changes.tags = patch.tags;
      }
      if (updates.resolution !== undefined) {
        patch.resolution = updates.resolution === null ? null : String(updates.resolution).trim().slice(0, 5000);
        changes.resolution = patch.resolution;
      }
      if (updates.unreadByStaff !== undefined) patch.unreadByStaff = Boolean(updates.unreadByStaff);
      if (updates.unreadByUser !== undefined) patch.unreadByUser = Boolean(updates.unreadByUser);
    }

    const updated = await persistTicketUpdate(raw.id, patch);

    if (Object.keys(changes).length > 0) {
      const actorId = actorType === 'admin' ? adminUser?.id : (authUser?.id || guestSession?.id || null);
      const actorName = actorType === 'admin'
        ? (adminUser?.name || adminUser?.email || 'Admin')
        : (authUser?.name || guestSession?.visitorName || 'Customer');
      await appendEvent({
        ticketId: raw.id,
        actorId,
        actorName,
        actorType: actorType === 'admin' ? 'agent' : (authUser ? 'user' : 'guest'),
        eventType: changes.status ? 'status_changed' : 'ticket_updated',
        summary: changes.status
          ? `Status changed from ${changes.status.from} to ${changes.status.to}`
          : `Ticket updated by ${actorName}`,
        changes
      });
    }

    if (changes.status?.to === 'closed') {
      const recipientEmail = updated.userEmail || updated.guestEmail;
      if (recipientEmail) {
        const html = renderSupportTicketEmail({
          recipientEmail,
          recipientName: updated.userName || updated.guestName || 'Customer',
          eventType: 'closed',
          ticketNumber: updated.serialNumber,
          subject: updated.subject,
          status: 'closed',
          priority: updated.priority,
          department: updated.department,
          senderName: 'Tiwlo Support Desk',
          messageBody: updated.resolution || 'Your support request has been completed and permanently closed.'
        });
        notifyEmailNonFatal({
          to: recipientEmail,
          subject: `Tiwlo Support [Ticket #${updated.serialNumber}] - Closed`,
          html,
          text: `Ticket ${updated.serialNumber} is now closed and locked. Thank you for contacting Tiwlo Support.`,
          type: 'support_ticket_closed',
          metadata: { ticketId: updated.ticketId, ticketNumber: updated.serialNumber }
        });
      }
      await deleteTicketEmailThreadAndPurgeDeliveries(updated).catch(() => {});
    }

    const latestAfterClose = changes.status?.to === 'closed'
      ? (await findRawTicketByIdentifier(raw.id)) || updated
      : updated;

    return sanitizeTicketForViewer(latestAfterClose, {
      viewerType: actorType === 'admin' ? 'admin' : (authUser ? 'customer' : 'guest'),
      requesterIsSuperAdmin,
      superAdminIds
    });
  }

  async function assignTicket({ ticketIdOrKey, assignedAgentId = null, requireAcceptance = true, adminUser, adminProfile = null } = {}) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);
    const superAdminIds = await getSuperAdminIdSet();
    const toggles = await getSupportToggles();

    if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
      throw new SupportServiceError('Not authorized to assign this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    let patch;
    let summary;
    if (!assignedAgentId) {
      patch = {
        assignedAgentId: null,
        assignedAgentName: null,
        assignedAgentAvatar: null,
        assignedAgentRole: null,
        metadata: {
          ...(raw.metadata || {}),
          assignmentStatus: 'unassigned',
          pendingAssigneeId: null,
          pendingAssigneeName: null
        }
      };
      summary = 'Ticket unassigned';
    } else {
      const staff = await listAssignableSupportStaff(requesterIsSuperAdmin);
      const target = staff.find((s) => s.id === assignedAgentId);
      if (!target) {
        if (!requesterIsSuperAdmin && superAdminIds.has(String(assignedAgentId))) {
          throw new SupportServiceError('Cannot assign ticket to protected account.', { statusCode: 403, code: 'FORBIDDEN' });
        }
        throw new SupportServiceError('Target support agent not found.', { statusCode: 404, code: 'AGENT_NOT_FOUND' });
      }
      if (requireAcceptance) {
        patch = {
          assignedAgentId: null,
          assignedAgentName: null,
          assignedAgentAvatar: null,
          assignedAgentRole: null,
          metadata: {
            ...(raw.metadata || {}),
            assignmentStatus: 'pending_acceptance',
            pendingAssigneeId: target.id,
            pendingAssigneeName: target.name,
            pendingAssignedById: adminUser?.id || null,
            pendingAssignedByName: adminUser?.name || adminUser?.email || 'Admin',
            pendingAssignedAt: new Date().toISOString()
          }
        };
        summary = `Assignment request sent to ${target.name} (${target.roleLabel})`;
      } else {
        patch = {
          assignedAgentId: target.id,
          assignedAgentName: target.name,
          assignedAgentAvatar: target.avatar || null,
          assignedAgentRole: target.roleLabel,
          escalationTier: target.tier || raw.escalationTier,
          metadata: {
            ...(raw.metadata || {}),
            assignmentStatus: 'assigned',
            pendingAssigneeId: null,
            pendingAssigneeName: null
          }
        };
        summary = `Assigned to ${target.name} (${target.roleLabel})`;
      }
    }

    const updated = await persistTicketUpdate(raw.id, patch);
    await appendEvent({
      ticketId: raw.id,
      actorId: adminUser?.id || null,
      actorName: adminUser?.name || adminUser?.email || 'Admin',
      actorType: 'agent',
      eventType: 'ticket_assigned',
      summary,
      changes: {
        assignedAgentId: updated.assignedAgentId,
        assignedAgentName: updated.assignedAgentName,
        assignmentStatus: updated.metadata?.assignmentStatus || 'assigned',
        pendingAssigneeId: updated.metadata?.pendingAssigneeId || null
      }
    });

    return sanitizeTicketForViewer(updated, {
      viewerType: 'admin',
      requesterIsSuperAdmin,
      superAdminIds
    });
  }

  async function acceptTicketAssignment({ ticketIdOrKey, adminUser, adminProfile = null } = {}) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    if (raw.status === 'closed') {
      throw new SupportServiceError('Closed tickets are permanently locked.', { statusCode: 403, code: 'TICKET_CLOSED_PERMANENTLY' });
    }
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);
    const superAdminIds = await getSuperAdminIdSet();
    if (
      raw.metadata?.assignmentStatus === 'accepted' &&
      raw.assignedAgentId &&
      String(raw.assignedAgentId) !== String(adminUser?.id || '') &&
      !requesterIsSuperAdmin
    ) {
      throw new SupportServiceError('This ticket has already been accepted by another specialist.', {
        statusCode: 409,
        code: 'TICKET_ALREADY_ACCEPTED'
      });
    }
    const pendingId = raw.metadata?.pendingAssigneeId;
    if (pendingId && String(pendingId) !== String(adminUser?.id) && !requesterIsSuperAdmin) {
      throw new SupportServiceError('Only the designated specialist can accept this assignment request.', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }
    const staff = await listAssignableSupportStaff(true);
    const matched = staff.find((s) => s.id === String(adminUser?.id));
    const roleLabel = matched?.roleLabel || adminProfile?.roleKey || (requesterIsSuperAdmin ? 'Super Admin' : 'Support Specialist');
    const updated = await persistTicketUpdate(raw.id, {
      assignedAgentId: String(adminUser?.id),
      assignedAgentName: adminUser?.name || matched?.name || 'Support Specialist',
      assignedAgentAvatar: adminUser?.avatar || matched?.avatar || null,
      assignedAgentRole: roleLabel,
      status: raw.status === 'open' ? 'in_progress' : raw.status,
      metadata: {
        ...(raw.metadata || {}),
        assignmentStatus: 'accepted',
        pendingAssigneeId: null,
        pendingAssigneeName: null,
        acceptedById: String(adminUser?.id),
        acceptedAt: new Date().toISOString()
      }
    });
    await appendEvent({
      ticketId: raw.id,
      actorId: adminUser?.id || null,
      actorName: updated.assignedAgentName,
      actorType: 'agent',
      eventType: 'assignment_accepted',
      summary: `${updated.assignedAgentName} accepted specialist ownership (exclusive reply lock active)`
    });
    return sanitizeTicketForViewer(updated, {
      viewerType: 'admin',
      requesterIsSuperAdmin,
      superAdminIds
    });
  }

  async function ingestInboundTicketEmail({
    to,
    fromEmail,
    fromName = null,
    subject = '',
    text = '',
    html = '',
    attachments = [],
    emailMessageId = null
  } = {}) {
    const toLower = String(to || '').trim().replace(/^<|>$/g, '').toLowerCase();
    const subjStr = String(subject || '').trim();
    const strippedHtml = String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+\n/g, '\n')
      .trim();
    const cleanBody = String(text || '').trim() || strippedHtml;
    if (!cleanBody && (!Array.isArray(attachments) || attachments.length === 0)) {
      throw new SupportServiceError('Inbound email must contain message text or attachments.', {
        statusCode: 400,
        code: 'EMPTY_INBOUND_EMAIL'
      });
    }

    let matchedTicket = null;
    if (isUsingPg() && toLower) {
      await ensureSupportEmailAndAttachmentSchema();
      const { rows } = await queryPgFn(
        `SELECT ticket_id FROM support_ticket_email_threads WHERE LOWER(reply_to_alias) = $1 LIMIT 1`,
        [toLower]
      );
      if (rows?.[0]?.ticket_id) {
        matchedTicket = await findRawTicketByIdentifier(rows[0].ticket_id);
      }
      if (!matchedTicket) {
        const { rows: metaRows } = await queryPgFn(
          `SELECT * FROM support_tickets WHERE LOWER(COALESCE(metadata->>'replyToEmailAlias', '')) = $1 LIMIT 1`,
          [toLower]
        );
        if (metaRows?.[0]) {
          matchedTicket = rowToTicket(metaRows[0]);
        }
      }
    } else if (toLower) {
      for (const tInfo of mem.emailThreads.values()) {
        if (String(tInfo.replyToAlias || '').toLowerCase() === toLower) {
          matchedTicket = await findRawTicketByIdentifier(tInfo.ticketId);
          break;
        }
      }
      if (!matchedTicket) {
        for (const t of mem.tickets.values()) {
          if (String(t?.metadata?.replyToEmailAlias || '').toLowerCase() === toLower) {
            matchedTicket = t;
            break;
          }
        }
      }
    }

    // Only allow subject fallback if no ephemeral ticket+ alias was supplied in To:
    const hasEphemeralTicketAddress = toLower.startsWith('ticket+');
    if (!matchedTicket && !hasEphemeralTicketAddress) {
      const refMatch = subjStr.match(/TWTK-[A-Z0-9-]+/i);
      if (refMatch) {
        matchedTicket = await findRawTicketByIdentifier(refMatch[0].toUpperCase());
      }
    }

    if (!matchedTicket) {
      throw new SupportServiceError('Ticket thread not found or email alias has expired.', {
        statusCode: 404,
        code: 'EMAIL_THREAD_NOT_FOUND'
      });
    }
    if (matchedTicket.status === 'closed') {
      throw new SupportServiceError('Cannot reply to a closed ticket via email. Alias deleted.', {
        statusCode: 403,
        code: 'TICKET_CLOSED_LOCKED'
      });
    }

    const cleanEmailMsgId = String(emailMessageId || '').trim();
    const seenEmailIds = Array.isArray(matchedTicket.metadata?.processedEmailMessageIds)
      ? matchedTicket.metadata.processedEmailMessageIds
      : [];
    if (cleanEmailMsgId && seenEmailIds.includes(cleanEmailMsgId)) {
      return {
        duplicate: true,
        reply: null,
        ticket: matchedTicket,
        attachments: []
      };
    }

    const storedFiles = await storeSupportAttachments(attachments, {
      ticketId: matchedTicket.id,
      uploadedBy: fromEmail || matchedTicket.guestEmail || matchedTicket.userEmail || 'email'
    });

    const displayMessage = cleanBody || `(Email attachment${storedFiles.length > 1 ? 's' : ''}: ${storedFiles.map((f) => f.filename).join(', ')})`;
    const msg = await insertMessageRecord({
      ticketId: matchedTicket.id,
      senderId: matchedTicket.userId || matchedTicket.guestSessionId || null,
      senderType: matchedTicket.userId ? 'user' : 'guest',
      senderName: fromName || matchedTicket.userName || matchedTicket.guestName || fromEmail || 'Customer (Email)',
      senderRole: 'email_reply',
      message: displayMessage,
      isInternal: false,
      attachments: storedFiles
    });

    const nextPatch = {
      unreadByStaff: true,
      unreadByUser: false,
      autoCloseAt: null,
      ...(cleanEmailMsgId
        ? {
            metadata: {
              ...(matchedTicket.metadata || {}),
              processedEmailMessageIds: [...seenEmailIds, cleanEmailMsgId].slice(-50)
            }
          }
        : {})
    };
    if (matchedTicket.status === 'waiting_customer') {
      nextPatch.status = 'open';
    }
    const updated = await persistTicketUpdate(matchedTicket.id, nextPatch);
    await appendEvent({
      ticketId: matchedTicket.id,
      actorId: matchedTicket.userId || matchedTicket.guestSessionId || null,
      actorName: msg.senderName,
      actorType: 'customer',
      eventType: 'inbound_email_reply',
      summary: `Inbound email reply (${storedFiles.length} attachment${storedFiles.length === 1 ? '' : 's'}) synced from ${fromEmail || 'customer'}`
    });

    // Push inbound email reply + attachments directly into linked Support Inbox conversations
    try {
      const db = await SupportDB.getAllData();
      const convs = Array.isArray(db?.conversations) ? db.conversations : [];
      const createdTs = msg.createdAt || new Date().toISOString();
      const timeStr = new Date(createdTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let changed = false;
      for (const c of convs) {
        if (c && (c.ticketId === matchedTicket.ticketId || c.ticketId === matchedTicket.id)) {
          if (!Array.isArray(c.messages)) c.messages = [];
          if (!c.messages.some((m) => m.id === msg.id || m.ticketMessageId === msg.id)) {
            c.messages.push({
              id: msg.id,
              ticketMessageId: msg.id,
              sender: 'user',
              senderType: 'email_reply',
              senderName: msg.senderName,
              text: displayMessage,
              attachments: storedFiles,
              time: timeStr,
              timestamp: createdTs
            });
          }
          c.lastMessage = displayMessage;
          c.time = timeStr;
          c.ticketStatus = updated.status || c.ticketStatus;
          changed = true;
        }
      }
      if (changed) {
        await SupportDB.saveAllData(db);
      }
    } catch {
      // Best-effort non-fatal sync
    }

    return {
      duplicate: false,
      reply: msg,
      ticket: updated,
      attachments: storedFiles
    };
  }

  async function recordStaffPermissionAudit({
    staffActor,
    permissionKey,
    action,
    targetType = 'ticket',
    targetId = null,
    details = {},
    req = null
  } = {}) {
    if (!staffActor?.id) return null;
    const entry = {
      id: `spaud_${randomUUID()}`,
      staffId: String(staffActor.id),
      staffName: String(staffActor.name || staffActor.email || 'Staff').slice(0, 160),
      staffRole: String(staffActor.role || 'staff').slice(0, 64),
      permissionKey: String(permissionKey || 'support.view').slice(0, 80),
      action: String(action || 'view').slice(0, 120),
      targetType: String(targetType || 'ticket').slice(0, 64),
      targetId: targetId ? String(targetId).slice(0, 120) : null,
      details: details && typeof details === 'object' ? details : {},
      ip: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || null,
      createdAt: new Date().toISOString()
    };
    if (isUsingPg()) {
      try {
        await queryPgFn(`
          CREATE TABLE IF NOT EXISTS staff_permission_audit_logs (
            id VARCHAR(80) PRIMARY KEY,
            staff_id VARCHAR(64) NOT NULL,
            staff_name VARCHAR(160),
            staff_role VARCHAR(64),
            permission_key VARCHAR(80) NOT NULL,
            action VARCHAR(120) NOT NULL,
            target_type VARCHAR(64),
            target_id VARCHAR(120),
            details JSONB NOT NULL DEFAULT '{}'::jsonb,
            ip VARCHAR(128),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await queryPgFn(
          `INSERT INTO staff_permission_audit_logs
             (id, staff_id, staff_name, staff_role, permission_key, action, target_type, target_id, details, ip, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
          [
            entry.id, entry.staffId, entry.staffName, entry.staffRole,
            entry.permissionKey, entry.action, entry.targetType, entry.targetId,
            JSON.stringify(entry.details), entry.ip, entry.createdAt
          ]
        );
      } catch {
        mem.staffAuditLogs = [entry, ...(mem.staffAuditLogs || [])].slice(0, 500);
      }
    } else {
      mem.staffAuditLogs = [entry, ...(mem.staffAuditLogs || [])].slice(0, 500);
    }
    return entry;
  }

  async function listStaffPermissionAudits({ staffId = '', limit = 50 } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    if (isUsingPg()) {
      try {
        const sql = staffId
          ? `SELECT * FROM staff_permission_audit_logs WHERE staff_id = $1 ORDER BY created_at DESC LIMIT $2`
          : `SELECT * FROM staff_permission_audit_logs ORDER BY created_at DESC LIMIT $1`;
        const params = staffId ? [String(staffId), safeLimit] : [safeLimit];
        const { rows } = await queryPgFn(sql, params);
        return (rows || []).map((r) => ({
          id: r.id,
          staffId: r.staff_id,
          staffName: r.staff_name,
          staffRole: r.staff_role,
          permissionKey: r.permission_key,
          action: r.action,
          targetType: r.target_type,
          targetId: r.target_id,
          details: r.details || {},
          ip: r.ip || null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null
        }));
      } catch {
        // Fallback below
      }
    }
    return (mem.staffAuditLogs || [])
      .filter((l) => !staffId || l.staffId === String(staffId))
      .slice(0, safeLimit);
  }

  async function getTicketCustomerContext({ ticketIdOrKey = null, userId = null, adminUser = null, adminProfile = null, req = null } = {}) {
    let targetUserId = userId ? String(userId) : null;
    if (!targetUserId && ticketIdOrKey) {
      const raw = await findRawTicketByIdentifier(ticketIdOrKey);
      if (raw) {
        const superAdminIds = await getSuperAdminIdSet();
        const toggles = await getSupportToggles();
        if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
          throw new SupportServiceError('Not authorized to access this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
        }
        targetUserId = raw.userId ? String(raw.userId) : null;
      }
    }

    await recordStaffPermissionAudit({
      staffActor: adminUser,
      permissionKey: 'support.view_customer_context',
      action: 'inspect_customer_invoices_orders_services',
      targetType: ticketIdOrKey ? 'ticket' : 'user',
      targetId: ticketIdOrKey || targetUserId,
      req
    });

    if (!targetUserId) {
      return {
        isGuest: true,
        user: null,
        orders: [],
        invoices: [],
        services: { active: [], deactivated: [] },
        multiAccountRisk: null,
        recentActivity: []
      };
    }

    let userSummary = null;
    let orders = [];
    let invoices = [];
    let activeServices = [];
    let deactivatedServices = [];
    let recentActivity = [];
    let multiAccountRisk = { detected: false, linkedAccountsCount: 0, flags: [] };

    if (isUsingPg()) {
      const safeQuery = async (sql, params) => {
        try {
          const r = await queryPgFn(sql, params);
          return r?.rows || [];
        } catch {
          return [];
        }
      };

      const uRows = await safeQuery(
        `SELECT id, tiwi_id, name, email, phone, status, plan, created_at FROM system_users WHERE id = $1 LIMIT 1`,
        [targetUserId]
      );
      if (uRows[0]) {
        userSummary = {
          id: uRows[0].id,
          tiwiId: uRows[0].tiwi_id,
          name: uRows[0].name,
          email: uRows[0].email,
          phone: uRows[0].phone || null,
          status: uRows[0].status || 'active',
          plan: uRows[0].plan || 'free',
          createdAt: uRows[0].created_at
        };
      }

      const storeRows = await safeQuery(
        `SELECT id, name, slug, status, plan, custom_domain, created_at, updated_at
         FROM stores WHERE owner_id = $1 OR user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [targetUserId]
      );
      for (const st of storeRows) {
        const svc = {
          id: st.id,
          name: st.name || st.slug || 'Store Service',
          status: st.status || 'active',
          plan: st.plan || 'standard',
          domain: st.custom_domain || (st.slug ? `${st.slug}.tiwlo.com` : null),
          createdAt: st.created_at
        };
        if (['active', 'running', 'trialing'].includes(String(svc.status).toLowerCase())) {
          activeServices.push(svc);
        } else {
          deactivatedServices.push(svc);
        }
      }

      const txRows = await safeQuery(
        `SELECT id, invoice_number, amount, currency, status, description, plan_name, created_at
         FROM billing_invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [targetUserId]
      );
      invoices = txRows.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number || inv.id,
        amount: Number(inv.amount || 0),
        currency: inv.currency || 'USD',
        status: inv.status || 'paid',
        description: inv.description || inv.plan_name || 'Platform Invoice',
        createdAt: inv.created_at
      }));

      const orderRows = await safeQuery(
        `SELECT id, order_number, total, currency, status, fulfillment_status, created_at
         FROM orders WHERE user_id = $1 OR customer_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [targetUserId]
      );
      orders = orderRows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number || o.id,
        total: Number(o.total || 0),
        currency: o.currency || 'USD',
        status: o.status || 'pending',
        fulfillmentStatus: o.fulfillment_status || null,
        createdAt: o.created_at
      }));

      const actRows = await safeQuery(
        `SELECT id, action, event_type, ip, user_agent, metadata, created_at
         FROM user_activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25`,
        [targetUserId]
      );
      recentActivity = actRows.map((a) => ({
        id: a.id,
        action: a.action || a.event_type || 'activity',
        ip: a.ip || null,
        createdAt: a.created_at
      }));

      const riskRows = await safeQuery(
        `SELECT COUNT(*)::int AS cnt FROM identity_risk_links WHERE user_id = $1 OR linked_user_id = $1`,
        [targetUserId]
      );
      const linkedCnt = Number(riskRows[0]?.cnt || 0);
      if (linkedCnt > 0) {
        multiAccountRisk = {
          detected: true,
          linkedAccountsCount: linkedCnt,
          flags: ['LINKED_IDENTITY_CLUSTER']
        };
      }
    }

    return {
      isGuest: false,
      readOnlyForStaff: true,
      user: userSummary,
      orders,
      invoices,
      services: {
        active: activeServices,
        deactivated: deactivatedServices
      },
      multiAccountRisk,
      recentActivity
    };
  }

  async function revokeActorSessions({ targetUserId, reason = 'Security termination by administrator', adminUser = null, req = null } = {}) {
    if (!targetUserId) {
      throw new SupportServiceError('targetUserId is required.', { statusCode: 400, code: 'USER_ID_REQUIRED' });
    }
    let revokedCount = 0;
    if (isUsingPg()) {
      try {
        const res = await queryPgFn(
          `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
          [String(targetUserId), String(reason).slice(0, 200)]
        );
        revokedCount += Number(res?.rowCount || 0);
      } catch {
        // Table schema may vary; fallback to delete active token rows if supported
        try {
          const res2 = await queryPgFn(`DELETE FROM auth_sessions WHERE user_id = $1`, [String(targetUserId)]);
          revokedCount += Number(res2?.rowCount || 0);
        } catch {
          // Non-fatal
        }
      }
    }
    await recordStaffPermissionAudit({
      staffActor: adminUser,
      permissionKey: 'security.terminate_sessions',
      action: 'terminate_all_sessions',
      targetType: 'user_sessions',
      targetId: String(targetUserId),
      details: { reason, revokedCount },
      req
    });
    return { ok: true, targetUserId: String(targetUserId), revokedCount, reason };
  }

  async function submitTicketCsat({ ticketIdOrKey, rating, comment = '', authUser = null, guestSession = null } = {}) {
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      throw new SupportServiceError('CSAT rating must be an integer between 1 and 5.', {
        statusCode: 400,
        code: 'INVALID_CSAT_RATING'
      });
    }
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    if (!isRequesterOwner(raw, { authUser, guestSession })) {
      throw new SupportServiceError('Not authorized to rate this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
    }
    const cleanComment = comment ? String(comment).trim().slice(0, 1000) : null;
    const updated = await persistTicketUpdate(raw.id, {
      csatRating: numRating,
      csatComment: cleanComment
    });
    await appendEvent({
      ticketId: raw.id,
      actorId: authUser?.id || guestSession?.id || null,
      actorName: authUser?.name || guestSession?.visitorName || 'Customer',
      actorType: authUser ? 'user' : 'guest',
      eventType: 'csat_submitted',
      summary: `Customer submitted CSAT rating: ${numRating}/5`,
      changes: { rating: numRating }
    });
    return sanitizeTicketForViewer(updated, { viewerType: authUser ? 'customer' : 'guest' });
  }

  async function mergeTickets({ sourceTicketIdOrKey, targetTicketIdOrKey, adminUser, adminProfile = null } = {}) {
    const source = await findRawTicketByIdentifier(sourceTicketIdOrKey);
    const target = await findRawTicketByIdentifier(targetTicketIdOrKey);
    if (!source || !target) {
      throw new SupportServiceError('Both source and target tickets must exist.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    if (source.id === target.id) {
      throw new SupportServiceError('Cannot merge a ticket into itself.', { statusCode: 400, code: 'INVALID_MERGE' });
    }
    const superAdminIds = await getSuperAdminIdSet();
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);
    const toggles = await getSupportToggles();

    if (
      !isTicketVisibleToStaff(source, { adminUser, adminProfile, toggles, superAdminIds }) ||
      !isTicketVisibleToStaff(target, { adminUser, adminProfile, toggles, superAdminIds })
    ) {
      throw new SupportServiceError('Not authorized to merge these tickets.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    const now = new Date().toISOString();
    const mergedSource = await persistTicketUpdate(source.id, {
      mergedIntoId: target.id,
      status: 'closed',
      closedAt: now,
      resolution: source.resolution || `Merged into ${target.serialNumber}`
    });

    const actorName = adminUser?.name || adminUser?.email || 'Admin';
    await insertMessageRecord({
      ticketId: target.id,
      senderId: adminUser?.id || null,
      senderType: 'agent',
      senderName: actorName,
      message: `Merged ticket ${source.serialNumber} ("${source.subject}") into this ticket.`,
      isInternal: true
    });

    await appendEvent({
      ticketId: source.id,
      actorId: adminUser?.id || null,
      actorName,
      actorType: 'agent',
      eventType: 'ticket_merged',
      summary: `Merged into ${target.serialNumber}`,
      changes: { mergedIntoId: target.id }
    });
    await appendEvent({
      ticketId: target.id,
      actorId: adminUser?.id || null,
      actorName,
      actorType: 'agent',
      eventType: 'ticket_merged',
      summary: `Received merged ticket ${source.serialNumber}`,
      changes: { mergedFromId: source.id }
    });

    return {
      sourceTicket: sanitizeTicketForViewer(mergedSource, { viewerType: 'admin', requesterIsSuperAdmin, superAdminIds }),
      targetTicket: sanitizeTicketForViewer(target, { viewerType: 'admin', requesterIsSuperAdmin, superAdminIds })
    };
  }

  async function createSubTicket({
    parentTicketIdOrKey,
    subject,
    description = '',
    priority = null,
    department = null,
    category = null,
    assignedAgentId = null,
    adminUser,
    adminProfile = null
  } = {}) {
    const parent = await findRawTicketByIdentifier(parentTicketIdOrKey);
    if (!parent) {
      throw new SupportServiceError('Parent ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);
    const superAdminIds = await getSuperAdminIdSet();
    const toggles = await getSupportToggles();
    if (!isTicketVisibleToStaff(parent, { adminUser, adminProfile, toggles, superAdminIds })) {
      throw new SupportServiceError('Not authorized to create sub-ticket for this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    let assignedAgent = null;
    if (assignedAgentId) {
      const staff = await listAssignableSupportStaff(requesterIsSuperAdmin);
      assignedAgent = staff.find((s) => s.id === assignedAgentId) || null;
    }

    const fakeAuthOwner = parent.userId
      ? { id: parent.userId, name: parent.userName, email: parent.userEmail, tiwiId: parent.tiwiId, storeId: parent.storeId, storeName: parent.storeName }
      : null;
    const fakeGuestSession = !fakeAuthOwner && parent.guestSessionId
      ? { id: parent.guestSessionId, visitorName: parent.guestName, visitorEmail: parent.guestEmail, visitorPhone: parent.guestPhone }
      : null;

    const created = await createTicket({
      authUser: fakeAuthOwner,
      guestSession: fakeGuestSession,
      guestContact: !fakeAuthOwner && !fakeGuestSession
        ? { guestName: parent.guestName || 'Guest Visitor', guestEmail: parent.guestEmail || 'guest@example.com', guestPhone: parent.guestPhone || '+0000000' }
        : null,
      subject: subject || `Sub-task: ${parent.subject}`,
      description,
      priority: priority || parent.priority,
      department: department || parent.department,
      category: category || parent.category,
      assignedAgent,
      parentTicketId: parent.id
    });

    await appendEvent({
      ticketId: parent.id,
      actorId: adminUser?.id || null,
      actorName: adminUser?.name || adminUser?.email || 'Admin',
      actorType: 'agent',
      eventType: 'subticket_created',
      summary: `Created sub-ticket ${created.ticket.serialNumber}`,
      changes: { subTicketId: created.ticket.id }
    });

    return created.ticket;
  }

  async function linkTicketToUser({ ticketIdOrKey, userId = null, userEmail = null, adminUser, adminProfile = null } = {}) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    const requesterIsSuperAdmin = isSuperAdminUserRecord(adminUser);
    const superAdminIds = await getSuperAdminIdSet();
    const toggles = await getSupportToggles();
    if (!isTicketVisibleToStaff(raw, { adminUser, adminProfile, toggles, superAdminIds })) {
      throw new SupportServiceError('Not authorized to modify this ticket.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    const identifier = String(userId || userEmail || '').trim();
    if (!identifier) {
      throw new SupportServiceError('Target userId or userEmail is required.', { statusCode: 400, code: 'USER_IDENTIFIER_REQUIRED' });
    }

    let targetUser = null;
    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `SELECT id, name, store_name, email, role, tiwi_id FROM system_users
         WHERE id = $1 OR LOWER(email) = LOWER($1) LIMIT 1`,
        [identifier]
      );
      if (rows?.[0]) targetUser = rows[0];
    } else {
      targetUser = mem.staffUsers.find(
        (u) => u.id === identifier || String(u.email || '').toLowerCase() === identifier.toLowerCase()
      ) || null;
      if (!targetUser) {
        try {
          targetUser = await MasterDB.findUserByIdentifier(identifier);
        } catch {
          targetUser = null;
        }
      }
    }

    if (!targetUser) {
      throw new SupportServiceError('Target user not found.', { statusCode: 404, code: 'USER_NOT_FOUND' });
    }
    if (!requesterIsSuperAdmin && isSuperAdminUserRecord(targetUser)) {
      throw new SupportServiceError('Cannot link ticket to protected account.', { statusCode: 403, code: 'FORBIDDEN' });
    }

    const updated = await persistTicketUpdate(raw.id, {
      userId: targetUser.id,
      userName: targetUser.name || targetUser.store_name || targetUser.storeName || targetUser.email,
      userEmail: targetUser.email || raw.guestEmail
    });

    await appendEvent({
      ticketId: raw.id,
      actorId: adminUser?.id || null,
      actorName: adminUser?.name || adminUser?.email || 'Admin',
      actorType: 'agent',
      eventType: 'user_linked',
      summary: `Linked ticket to user ${targetUser.email || targetUser.id}`,
      changes: { userId: targetUser.id }
    });

    return sanitizeTicketForViewer(updated, { viewerType: 'admin', requesterIsSuperAdmin, superAdminIds });
  }

  async function bulkUpdateTickets({
    ticketIds = [],
    status = undefined,
    priority = undefined,
    assignedAgentId = undefined,
    tags = undefined,
    adminUser,
    adminProfile = null
  } = {}) {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      throw new SupportServiceError('ticketIds array is required.', { statusCode: 400, code: 'TICKET_IDS_REQUIRED' });
    }
    const boundedIds = ticketIds.slice(0, 100);
    const updated = [];
    const skippedIds = [];

    for (const tid of boundedIds) {
      try {
        let ticket = null;
        if (assignedAgentId !== undefined) {
          ticket = await assignTicket({ ticketIdOrKey: tid, assignedAgentId, adminUser, adminProfile });
        }
        if (status !== undefined || priority !== undefined || tags !== undefined) {
          ticket = await updateTicket({
            ticketIdOrKey: tid,
            updates: {
              ...(status !== undefined ? { status } : {}),
              ...(priority !== undefined ? { priority } : {}),
              ...(tags !== undefined ? { tags } : {})
            },
            actorType: 'admin',
            adminUser,
            adminProfile
          });
        }
        if (ticket) updated.push(ticket);
        else skippedIds.push(tid);
      } catch {
        skippedIds.push(tid);
      }
    }
    return { updatedCount: updated.length, skippedIds, tickets: updated };
  }

  async function findSimilarTickets({
    query = '',
    subject = '',
    description = '',
    authUser = null,
    guestSession = null,
    excludeTicketId = null,
    adminScope = false,
    adminUser = null,
    adminProfile = null
  } = {}) {
    const keywords = tokenizeKeywords(`${query} ${subject} ${description}`);
    if (keywords.length === 0) return [];

    let candidates = [];
    if (adminScope) {
      const res = await listAdminTickets({ limit: 150, adminUser, adminProfile });
      candidates = res.tickets;
    } else {
      candidates = await listTicketsForRequester({ authUser, guestSession });
    }

    const scored = [];
    for (const t of candidates) {
      if (excludeTicketId && (t.id === excludeTicketId || t.ticketId === excludeTicketId)) continue;
      const haystack = `${t.subject} ${t.description} ${t.category}`.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (haystack.includes(kw)) score += 1;
      }
      if (score > 0) {
        scored.push({
          id: t.id,
          ticketId: t.ticketId,
          serialNumber: t.serialNumber,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          score
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  function pruneStaleViewers(ticketId) {
    const map = collisionViewers.get(ticketId);
    if (!map) return null;
    const cutoff = Date.now() - COLLISION_VIEWER_TTL_MS;
    for (const [vid, info] of map.entries()) {
      if (info.lastSeenMs < cutoff) map.delete(vid);
    }
    if (map.size === 0) {
      collisionViewers.delete(ticketId);
      return null;
    }
    return map;
  }

  function getActiveTicketViewers(ticketId, requesterIsSuperAdmin = false) {
    const map = pruneStaleViewers(ticketId);
    if (!map) return [];
    const out = [];
    for (const info of map.values()) {
      if (!requesterIsSuperAdmin && info.isSuperAdmin) continue;
      out.push({
        id: info.id,
        name: info.name,
        avatar: info.avatar || null,
        role: info.role || 'support_agent',
        lastSeenAt: new Date(info.lastSeenMs).toISOString()
      });
    }
    return out;
  }

  async function recordTicketViewerHeartbeat(ticketIdOrKey, adminUser) {
    const raw = await findRawTicketByIdentifier(ticketIdOrKey);
    if (!raw) {
      throw new SupportServiceError('Support ticket not found.', { statusCode: 404, code: 'TICKET_NOT_FOUND' });
    }
    let map = collisionViewers.get(raw.id);
    if (!map) {
      map = new Map();
      collisionViewers.set(raw.id, map);
    }
    map.set(adminUser.id, {
      id: adminUser.id,
      name: adminUser.name || adminUser.email || 'Staff',
      avatar: adminUser.avatar || null,
      role: adminUser.role || 'admin',
      isSuperAdmin: isSuperAdminUserRecord(adminUser),
      lastSeenMs: Date.now()
    });
    const viewers = getActiveTicketViewers(raw.id, isSuperAdminUserRecord(adminUser));
    return { viewers, activeCount: viewers.length };
  }

  async function listMacros() {
    if (isUsingPg()) {
      const { rows } = await queryPgFn(`SELECT * FROM support_macros ORDER BY category ASC, title ASC`);
      return (rows || []).map(mapMacroRow);
    }
    return Array.from(mem.macros.values())
      .map(mapMacroRow)
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async function createMacro({ title, category = 'General', body, defaultStatus = null, defaultTags = [], createdBy = null } = {}) {
    const cleanTitle = String(title || '').trim();
    const cleanBody = String(body || '').trim();
    if (!cleanTitle || !cleanBody) {
      throw new SupportServiceError('Macro title and body are required.', { statusCode: 400, code: 'MACRO_FIELDS_REQUIRED' });
    }
    const id = `macro_${randomUUID()}`;
    const now = new Date().toISOString();
    const normStatus = defaultStatus ? normalizeTicketStatus(defaultStatus) : null;
    const cleanTags = normalizeTagList(defaultTags);
    const record = {
      id,
      title: cleanTitle.slice(0, 160),
      category: String(category || 'General').trim().slice(0, 128),
      body: cleanBody.slice(0, 10000),
      defaultStatus: normStatus,
      defaultTags: cleanTags,
      createdBy,
      createdAt: now,
      updatedAt: now
    };
    if (isUsingPg()) {
      await queryPgFn(
        `INSERT INTO support_macros (id, title, category, body, default_status, default_tags, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
        [record.id, record.title, record.category, record.body, record.defaultStatus, JSON.stringify(record.defaultTags), record.createdBy, now, now]
      );
    } else {
      mem.macros.set(id, record);
    }
    return mapMacroRow(record);
  }

  async function updateMacro(id, updates = {}) {
    const now = new Date().toISOString();
    if (isUsingPg()) {
      const { rows: existingRows } = await queryPgFn(`SELECT * FROM support_macros WHERE id = $1 LIMIT 1`, [id]);
      if (!existingRows?.[0]) {
        throw new SupportServiceError('Macro not found.', { statusCode: 404, code: 'MACRO_NOT_FOUND' });
      }
      const cur = mapMacroRow(existingRows[0]);
      const next = {
        title: updates.title !== undefined ? String(updates.title).trim().slice(0, 160) : cur.title,
        category: updates.category !== undefined ? String(updates.category).trim().slice(0, 128) : cur.category,
        body: updates.body !== undefined ? String(updates.body).trim().slice(0, 10000) : cur.body,
        defaultStatus: updates.defaultStatus !== undefined
          ? (updates.defaultStatus ? normalizeTicketStatus(updates.defaultStatus) : null)
          : cur.defaultStatus,
        defaultTags: updates.defaultTags !== undefined ? normalizeTagList(updates.defaultTags) : cur.defaultTags
      };
      if (!next.title || !next.body) {
        throw new SupportServiceError('Macro title and body cannot be empty.', { statusCode: 400, code: 'MACRO_FIELDS_REQUIRED' });
      }
      const { rows } = await queryPgFn(
        `UPDATE support_macros
         SET title = $2, category = $3, body = $4, default_status = $5, default_tags = $6::jsonb, updated_at = $7
         WHERE id = $1 RETURNING *`,
        [id, next.title, next.category, next.body, next.defaultStatus, JSON.stringify(next.defaultTags), now]
      );
      return mapMacroRow(rows[0]);
    }
    const existing = mem.macros.get(id);
    if (!existing) {
      throw new SupportServiceError('Macro not found.', { statusCode: 404, code: 'MACRO_NOT_FOUND' });
    }
    const next = {
      ...existing,
      ...(updates.title !== undefined ? { title: String(updates.title).trim().slice(0, 160) } : {}),
      ...(updates.category !== undefined ? { category: String(updates.category).trim().slice(0, 128) } : {}),
      ...(updates.body !== undefined ? { body: String(updates.body).trim().slice(0, 10000) } : {}),
      ...(updates.defaultStatus !== undefined ? { defaultStatus: updates.defaultStatus ? normalizeTicketStatus(updates.defaultStatus) : null } : {}),
      ...(updates.defaultTags !== undefined ? { defaultTags: normalizeTagList(updates.defaultTags) } : {}),
      updatedAt: now
    };
    if (!next.title || !next.body) {
      throw new SupportServiceError('Macro title and body cannot be empty.', { statusCode: 400, code: 'MACRO_FIELDS_REQUIRED' });
    }
    mem.macros.set(id, next);
    return mapMacroRow(next);
  }

  async function deleteMacro(id) {
    if (isUsingPg()) {
      const res = await queryPgFn(`DELETE FROM support_macros WHERE id = $1`, [id]);
      if (!res.rowCount) {
        throw new SupportServiceError('Macro not found.', { statusCode: 404, code: 'MACRO_NOT_FOUND' });
      }
      return { deleted: true, id };
    }
    if (!mem.macros.delete(id)) {
      throw new SupportServiceError('Macro not found.', { statusCode: 404, code: 'MACRO_NOT_FOUND' });
    }
    return { deleted: true, id };
  }

  async function getSupportOverview({ adminUser, adminProfile = null } = {}) {
    const [{ tickets }, agents, macros] = await Promise.all([
      listAdminTickets({ limit: 500, adminUser, adminProfile }),
      listAssignableSupportStaff(isSuperAdminUserRecord(adminUser)),
      listMacros()
    ]);

    const byStatus = {
      open: 0,
      in_progress: 0,
      waiting_customer: 0,
      escalated: 0,
      resolved: 0,
      closed: 0
    };
    const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    let slaBreachedCount = 0;
    let unassignedCount = 0;
    let csatSum = 0;
    let csatCount = 0;

    for (const t of tickets) {
      if (Object.prototype.hasOwnProperty.call(byStatus, t.status)) byStatus[t.status] += 1;
      if (Object.prototype.hasOwnProperty.call(byPriority, t.priority)) byPriority[t.priority] += 1;
      if (t.slaBreached) slaBreachedCount += 1;
      if (!t.assignedAgentId && !['resolved', 'closed'].includes(t.status)) unassignedCount += 1;
      if (Number.isFinite(Number(t.csatRating)) && Number(t.csatRating) >= 1) {
        csatSum += Number(t.csatRating);
        csatCount += 1;
      }
    }

    return {
      totalTickets: tickets.length,
      openCount: byStatus.open + byStatus.in_progress + byStatus.waiting_customer + byStatus.escalated,
      byStatus,
      byPriority,
      slaBreachedCount,
      unassignedCount,
      csatAverage: csatCount > 0 ? Number((csatSum / csatCount).toFixed(2)) : null,
      csatResponses: csatCount,
      assignableAgentsCount: agents.length,
      macrosCount: macros.length,
      recentTickets: tickets.slice(0, 10)
    };
  }

  async function exportTicketsCsv(filters = {}, { adminUser, adminProfile = null } = {}) {
    const { tickets } = await listAdminTickets({ ...filters, page: 1, limit: 1000, adminUser, adminProfile });
    const header = [
      'Ticket ID', 'Serial', 'Subject', 'Status', 'Priority', 'Category', 'Department',
      'Requester Type', 'Requester Name', 'Requester Email', 'Requester Phone',
      'Assigned Agent', 'Tier', 'SLA Due At', 'CSAT Rating', 'Created At', 'Updated At'
    ].join(',');
    const lines = tickets.map((t) => [
      t.ticketId,
      t.serialNumber,
      t.subject,
      t.status,
      t.priority,
      t.category,
      t.department,
      t.requesterType,
      t.requesterType === 'guest' ? t.guestName : t.userName,
      t.requesterType === 'guest' ? t.guestEmail : t.userEmail,
      t.guestPhone || '',
      t.assignedAgentName || 'Unassigned',
      t.escalationTier,
      t.slaDueAt || '',
      t.csatRating ?? '',
      t.createdAt,
      t.updatedAt
    ].map(csvEscapeCell).join(','));
    return [header, ...lines].join('\n');
  }

  let schedulerInterval = null;
  const scheduledDeadlines = new Map();

  function clearScheduledTimers() {
    for (const handle of scheduledDeadlines.values()) {
      clearTimeout(handle);
    }
    scheduledDeadlines.clear();
  }

  function stopSupportAutomationScheduler() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    clearScheduledTimers();
  }

  async function resumePendingSupportTimers({ now = Date.now(), scheduleTimers = false } = {}) {
    const nowMs = typeof now === 'number' ? now : Date.parse(String(now));
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
    const nowIso = new Date(safeNowMs).toISOString();

    let activeTickets = [];
    if (isUsingPg()) {
      const { rows } = await queryPgFn(
        `SELECT * FROM support_tickets
         WHERE status <> 'closed' OR auto_close_at IS NOT NULL OR snoozed_until IS NOT NULL`
      );
      activeTickets = (rows || []).map(mapTicketRow);
    } else {
      activeTickets = mem.tickets
        .filter((t) => t.status !== 'closed' || t.autoCloseAt || t.snoozedUntil)
        .map(mapTicketRow);
    }

    clearScheduledTimers();

    const triggered = {
      autoClosedIds: [],
      snoozeExpiredIds: [],
      slaBreachedIds: []
    };
    const pendingTimers = [];

    for (const t of activeTickets) {
      if (t.autoCloseAt && ['waiting_customer', 'resolved'].includes(t.status)) {
        const autoCloseMs = Date.parse(t.autoCloseAt);
        if (Number.isFinite(autoCloseMs)) {
          const remainingMs = autoCloseMs - safeNowMs;
          if (remainingMs <= 0) {
            await persistTicketUpdate(t.id, {
              status: 'closed',
              closedAt: nowIso,
              autoCloseAt: null,
              resolution: t.resolution || 'Automatically closed after inactivity window'
            });
            await deleteTicketEmailThreadAndPurgeDeliveries(t).catch(() => {});
            await appendEvent({
              ticketId: t.id,
              actorId: null,
              actorName: 'System Automation',
              actorType: 'system',
              eventType: 'auto_closed',
              summary: `Ticket ${t.serialNumber} auto-closed after deadline ${t.autoCloseAt}`
            });
            triggered.autoClosedIds.push(t.id);
          } else {
            pendingTimers.push({
              ticketId: t.id,
              type: 'auto_close',
              deadlineAt: t.autoCloseAt,
              remainingMs
            });
          }
        }
      }

      if (t.snoozedUntil && t.status !== 'closed') {
        const snoozeMs = Date.parse(t.snoozedUntil);
        if (Number.isFinite(snoozeMs)) {
          const remainingMs = snoozeMs - safeNowMs;
          if (remainingMs <= 0) {
            await persistTicketUpdate(t.id, {
              snoozedUntil: null,
              unreadByStaff: true
            });
            await appendEvent({
              ticketId: t.id,
              actorId: null,
              actorName: 'System Automation',
              actorType: 'system',
              eventType: 'snooze_expired',
              summary: `Ticket ${t.serialNumber} snooze expired at ${t.snoozedUntil}`
            });
            triggered.snoozeExpiredIds.push(t.id);
          } else {
            pendingTimers.push({
              ticketId: t.id,
              type: 'snooze',
              deadlineAt: t.snoozedUntil,
              remainingMs
            });
          }
        }
      }

      if (!['resolved', 'closed'].includes(t.status)) {
        const respMs = t.slaResponseDueAt && !t.firstResponseAt ? Date.parse(t.slaResponseDueAt) : NaN;
        const resMs = t.slaResolveDueAt ? Date.parse(t.slaResolveDueAt) : NaN;
        const respOverdue = Number.isFinite(respMs) && respMs <= safeNowMs;
        const resOverdue = Number.isFinite(resMs) && resMs <= safeNowMs;

        if ((respOverdue || resOverdue) && !t.slaBreachNotifiedAt) {
          await persistTicketUpdate(t.id, { slaBreachNotifiedAt: nowIso });
          await appendEvent({
            ticketId: t.id,
            actorId: null,
            actorName: 'SLA Monitor',
            actorType: 'system',
            eventType: 'sla_breached',
            summary: resOverdue
              ? `Resolution SLA breached (due ${t.slaResolveDueAt})`
              : `First response SLA breached (due ${t.slaResponseDueAt})`
          });
          triggered.slaBreachedIds.push(t.id);
        }

        if (Number.isFinite(respMs) && respMs > safeNowMs) {
          pendingTimers.push({
            ticketId: t.id,
            type: 'sla_response',
            deadlineAt: t.slaResponseDueAt,
            remainingMs: respMs - safeNowMs
          });
        }
        if (Number.isFinite(resMs) && resMs > safeNowMs) {
          pendingTimers.push({
            ticketId: t.id,
            type: 'sla_resolve',
            deadlineAt: t.slaResolveDueAt,
            remainingMs: resMs - safeNowMs
          });
        }
      }
    }

    if (scheduleTimers && pendingTimers.length > 0) {
      for (const item of pendingTimers) {
        if (item.remainingMs > 0 && item.remainingMs <= 2_147_483_647) {
          const key = `${item.ticketId}:${item.type}`;
          const handle = setTimeout(() => {
            scheduledDeadlines.delete(key);
            void resumePendingSupportTimers({ scheduleTimers: true }).catch(() => {});
          }, item.remainingMs);
          handle.unref?.();
          scheduledDeadlines.set(key, handle);
        }
      }
    }

    return {
      checkedAt: nowIso,
      triggered,
      pendingTimers,
      overdueCount:
        triggered.autoClosedIds.length +
        triggered.snoozeExpiredIds.length +
        triggered.slaBreachedIds.length,
      scheduledCount: pendingTimers.length
    };
  }

  function startSupportAutomationScheduler({ intervalMs = 60_000 } = {}) {
    stopSupportAutomationScheduler();
    void resumePendingSupportTimers({ scheduleTimers: true }).catch((err) => {
      console.warn('[Support Automation] Initial timer resume skipped:', err?.message || err);
    });
    const safeInterval = Math.max(5_000, Number(intervalMs) || 60_000);
    schedulerInterval = setInterval(() => {
      void resumePendingSupportTimers({ scheduleTimers: true }).catch(() => {});
    }, safeInterval);
    schedulerInterval.unref?.();
    return { stop: stopSupportAutomationScheduler };
  }

  function resetMemoryState({ staffUsers = [], staffProfiles = [] } = {}) {
    stopSupportAutomationScheduler();
    mem.tickets = [];
    mem.messages.clear();
    mem.events.clear();
    mem.guestSessions.clear();
    mem.macros.clear();
    mem.toggles = { ...DEFAULT_SUPPORT_TOGGLES };
    mem.viewers.clear();
    mem.staffUsers = [...staffUsers];
    mem.staffProfiles = new Map(staffProfiles.map((p) => [p.userId, p]));
  }

  return {
    validateGuestContact,
    normalizeTicketStatus,
    normalizeTicketPriority,
    computeSlaDueAt,
    computeSlaResponseDueAt,
    computeAutoCloseAt,
    resolveSupportPermissions,
    hasSupportPermission,
    getSupportToggles,
    getPublicSupportConfig,
    updateSupportToggles,
    createOrUpdateGuestSession,
    resolveGuestSessionFromRequest,
    lookupGuestTicket,
    claimGuestSessionsForUser,
    listAssignableSupportStaff,
    createTicket,
    listTicketsForRequester,
    listAdminTickets,
    getTicketDetail,
    addTicketReply,
    editTicketReply,
    updateTicket,
    assignTicket,
    acceptTicketAssignment,
    ingestInboundTicketEmail,
    storeSupportAttachments,
    getSupportAttachmentById,
    getTicketCustomerContext,
    recordStaffPermissionAudit,
    listStaffPermissionAudits,
    revokeActorSessions,
    submitTicketCsat,
    mergeTickets,
    createSubTicket,
    linkTicketToUser,
    bulkUpdateTickets,
    findSimilarTickets,
    recordTicketViewerHeartbeat,
    getActiveTicketViewers,
    listMacros,
    createMacro,
    updateMacro,
    deleteMacro,
    getSupportOverview,
    exportTicketsCsv,
    resumePendingSupportTimers,
    startSupportAutomationScheduler,
    stopSupportAutomationScheduler,
    resetMemoryState
  };
}

export const defaultTicketingService = createTicketingService();

export const {
  getSupportToggles,
  getPublicSupportConfig,
  updateSupportToggles,
  createOrUpdateGuestSession,
  resolveGuestSessionFromRequest,
  lookupGuestTicket,
  claimGuestSessionsForUser,
  listAssignableSupportStaff,
  createTicket,
  listTicketsForRequester,
  listAdminTickets,
  getTicketDetail,
  addTicketReply,
  editTicketReply,
  updateTicket,
  assignTicket,
  acceptTicketAssignment,
  ingestInboundTicketEmail,
  storeSupportAttachments,
  getSupportAttachmentById,
  getTicketCustomerContext,
  recordStaffPermissionAudit,
  listStaffPermissionAudits,
  revokeActorSessions,
  submitTicketCsat,
  mergeTickets,
  createSubTicket,
  linkTicketToUser,
  bulkUpdateTickets,
  findSimilarTickets,
  recordTicketViewerHeartbeat,
  getActiveTicketViewers,
  listMacros,
  createMacro,
  updateMacro,
  deleteMacro,
  getSupportOverview,
  exportTicketsCsv,
  resumePendingSupportTimers,
  startSupportAutomationScheduler,
  stopSupportAutomationScheduler
} = defaultTicketingService;
