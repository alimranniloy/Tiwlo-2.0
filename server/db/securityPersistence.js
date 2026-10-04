import crypto from 'crypto';
import { isIP } from 'node:net';
import '../config/loadRootEnv.js';
import { queryPg } from './postgres.js';

const RETENTION_DAYS = 90;
const AUDIT_SECRET = process.env.SECURITY_SECRET;

function requireAuditSecret() {
  if (!AUDIT_SECRET) throw new Error('SECURITY_SECRET must be configured for durable security records.');
}

export function hashSecuritySubject(value) {
  if (!value) return null;
  requireAuditSecret();
  return crypto.createHmac('sha256', AUDIT_SECRET).update(String(value).trim().toLowerCase()).digest('hex');
}

function safeDetails(details = {}) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  return Object.fromEntries(
    Object.entries(details)
      .filter(([key, value]) =>
        !/(password|otp|token|secret|code|html|body|content|authorization|cookie)/i.test(key) &&
        ['string', 'number', 'boolean'].includes(typeof value)
      )
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 500) : value])
  );
}

export async function recordSecurityEvent({
  eventType,
  severity = 'info',
  userId = null,
  subject = null,
  ip = null,
  userAgent = null,
  details = {}
}) {
  const safeEventType = String(eventType || '').replace(/[^a-z0-9_.-]/gi, '_').slice(0, 64);
  if (!safeEventType) throw new Error('A security event type is required.');
  const safeIp = typeof ip === 'string' && isIP(ip) ? ip : null;
  const inserted = await queryPg(
    `INSERT INTO system_security_events
       (event_type, severity, user_id, subject_hash, remote_ip, user_agent, details)
     VALUES ($1, $2, $3, $4, $5::inet, $6, $7::jsonb)
     RETURNING id`,
    [
      safeEventType,
      ['info', 'warning', 'error', 'critical'].includes(severity) ? severity : 'info',
      userId ? String(userId).slice(0, 64) : null,
      hashSecuritySubject(subject),
      safeIp,
      typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
      JSON.stringify(safeDetails(details))
    ]
  );
  if (Number(inserted.rows[0].id) % 1000 === 0) {
    await queryPg(
      `DELETE FROM system_security_events
       WHERE created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
          OR id < COALESCE(
            (SELECT id FROM system_security_events ORDER BY id DESC OFFSET 99999 LIMIT 1),
            0
          )`,
      [RETENTION_DAYS]
    );
  }
}

export async function listSecurityEvents({ limit = 100, beforeId = null } = {}) {
  const boundedLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));
  const cursor = beforeId === null || beforeId === undefined || beforeId === ''
    ? null
    : String(beforeId);
  if (cursor !== null && !/^\d+$/.test(cursor)) {
    throw new Error('Security event cursor must be a numeric event ID.');
  }
  const { rows } = await queryPg(
    `SELECT id, event_type, severity, user_id, subject_hash, remote_ip, user_agent, details, created_at
     FROM system_security_events
     WHERE ($1::bigint IS NULL OR id < $1)
     ORDER BY id DESC LIMIT $2`,
    [cursor, boundedLimit]
  );
  return rows;
}

export async function recordEmailDelivery(record) {
  const recipient = String(record.recipient || '').slice(0, 255);
  const sender = String(record.sender || '').slice(0, 255);
  const subject = String(record.subject || '').replace(/\b\d{6}\b/g, '[REDACTED]').slice(0, 998);
  const emailType = String(record.type || 'general').replace(/[^a-z0-9_.-]/gi, '_').slice(0, 64);
  const inserted = await queryPg(
    `INSERT INTO system_email_outbox
       (recipient, sender, subject, email_type, delivery_status, message_id, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id`,
    [
      recipient,
      sender,
      subject,
      emailType,
      String(record.status || 'failed').slice(0, 32),
      record.messageId ? String(record.messageId).slice(0, 255) : null,
      record.error ? String(record.error).replace(/[\r\n\t]/g, ' ').slice(0, 2000) : null,
      JSON.stringify(safeDetails(record.metadata))
    ]
  );
  if (Number(inserted.rows[0].id) % 100 === 0) {
    await queryPg(
      `DELETE FROM system_email_outbox
       WHERE created_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 day')
          OR id < COALESCE(
            (SELECT id FROM system_email_outbox ORDER BY id DESC OFFSET 49999 LIMIT 1),
            0
          )`,
      [RETENTION_DAYS]
    );
  }
}

export async function listEmailDeliveries({ limit = 100, type = null } = {}) {
  const boundedLimit = Math.min(500, Math.max(1, Number.parseInt(limit, 10) || 100));
  const { rows } = await queryPg(
    `SELECT id, recipient AS "to", sender AS "from", subject, email_type AS type,
            delivery_status AS status, message_id AS "messageId",
           error_message AS error, metadata, created_at AS "createdAt",
           created_at AS timestamp
     FROM system_email_outbox
     WHERE ($1::varchar IS NULL OR email_type = $1)
     ORDER BY created_at DESC LIMIT $2`,
    [type ? String(type).slice(0, 64) : null, boundedLimit]
  );
  return rows;
}
