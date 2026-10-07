import crypto from 'crypto';
import { spawn } from 'node:child_process';
import fs from 'fs';
import sanitizeHtml from 'sanitize-html';
import { simpleParser } from 'mailparser';
import { getPgPool } from '../db/postgres.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';

const MAX_RAW_MESSAGE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 20;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_MAILBOX_MESSAGES = 2000;
const MAX_MAILBOX_ATTACHMENT_BYTES = 500 * 1024 * 1024;
const SPAM_CHECK_TIMEOUT_MS = 5000;
const LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;

function scanForSpam(rawMessage) {
  if (process.env.NODE_ENV !== 'production') return Promise.resolve({ isSpam: false, score: null });

  const spamcPath = process.env.TIWLO_SPAMC_PATH || '/usr/bin/spamc';
  return new Promise((resolve, reject) => {
    const scanner = spawn(spamcPath, ['-c', '-s', String(MAX_RAW_MESSAGE_BYTES)], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '';
    let errorOutput = '';
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      scanner.kill('SIGKILL');
      finish(reject, new Error('SpamAssassin scan timed out.'));
    }, SPAM_CHECK_TIMEOUT_MS);

    scanner.stdout.on('data', (chunk) => {
      output = `${output}${chunk.toString()}`.slice(0, 256);
    });
    scanner.stderr.on('data', (chunk) => {
      errorOutput = `${errorOutput}${chunk.toString()}`.slice(0, 1024);
    });
    scanner.on('error', (error) => finish(reject, error));
    scanner.on('close', (code) => {
      const score = Number.parseFloat(output.trim().split('/')[0]);
      if (code === 0 || code === 1) {
        if (!Number.isFinite(score)) {
          return finish(reject, new Error('SpamAssassin returned no usable spam score.'));
        }
        return finish(resolve, { isSpam: code === 1, score });
      } else {
        finish(reject, new Error(`SpamAssassin scan failed (${code}): ${errorOutput.trim() || 'no diagnostic output'}`));
      }
    });
    scanner.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') finish(reject, error);
    });
    scanner.stdin.end(rawMessage);
  });
}

function cleanAddress(value) {
  const address = String(value || '').trim().toLowerCase();
  const [localPart, domain, ...extra] = address.split('@');
  if (extra.length || !localPart || domain !== PLATFORM_CONFIG.primaryDomain ||
      !LOCAL_PART_PATTERN.test(localPart) || localPart.includes('..')) {
    return null;
  }
  return address;
}

function toRecipients(addresses = []) {
  return addresses
    .filter((entry) => entry.address)
    .map((entry) => ({ name: entry.name || entry.address, email: entry.address.toLowerCase() }));
}

function safeFilename(value) {
  return String(value || 'attachment')
    .split(/[\\/]/)
    .pop()
    .replace(/[\r\n"]/g, '_')
    .slice(0, 255) || 'attachment';
}

function safeHtml(value, fallbackText) {
  if (!value) {
    return `<p>${String(fallbackText || '')
      .replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[character])
      .replace(/\r?\n/g, '<br>')}</p>`;
  }
  return sanitizeHtml(String(value), {
    allowedTags: [
      'a', 'b', 'blockquote', 'br', 'caption', 'code', 'div', 'em', 'h1', 'h2', 'h3',
      'hr', 'i', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody', 'td',
      'th', 'thead', 'tr', 'u', 'ul'
    ],
    allowedAttributes: { a: ['href', 'title'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard'
  });
}

export async function storeInboundMail(rawMessage, envelopeRecipient) {
  if (!Buffer.isBuffer(rawMessage) || rawMessage.length === 0 || rawMessage.length > MAX_RAW_MESSAGE_BYTES) {
    throw new TypeError('Incoming message size is invalid.');
  }
  const recipient = cleanAddress(envelopeRecipient);
  if (!recipient) throw new TypeError('Incoming recipient is invalid.');

  const spamResult = await scanForSpam(rawMessage);
  const parsed = await simpleParser(rawMessage, {
    maxHtmlLengthToParse: MAX_RAW_MESSAGE_BYTES,
    skipHtmlToText: true,
    skipTextToHtml: true
  });
  const sender = parsed.from?.value?.[0];
  const senderEmail = String(sender?.address || '').trim().toLowerCase();
  if (!senderEmail || senderEmail.length > 254) {
    throw new TypeError('Incoming message has no valid sender address.');
  }

  const attachments = parsed.attachments || [];
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new TypeError(`Incoming messages may contain at most ${MAX_ATTACHMENTS} attachments.`);
  }
  const totalAttachmentBytes = attachments.reduce((total, attachment) =>
    total + (Buffer.isBuffer(attachment.content) ? attachment.content.length : Buffer.byteLength(attachment.content || '')),
  0);
  if (totalAttachmentBytes > MAX_ATTACHMENT_BYTES) {
    throw new TypeError('Incoming message attachments exceed the 20 MB total limit.');
  }
  const headerRecipients = toRecipients(parsed.to?.value || []);
  if (!headerRecipients.some((entry) => entry.email === recipient)) {
    headerRecipients.push({ name: recipient, email: recipient });
  }
  const ccRecipients = toRecipients(parsed.cc?.value || []);
  const bodyText = String(parsed.text || '').slice(0, 100000);
  const bodyHtml = safeHtml(parsed.html, bodyText);
  const deliveryKey = crypto.createHash('sha256')
    .update(recipient)
    .update('\0')
    .update(rawMessage)
    .digest('hex');

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: mailboxRows } = await client.query(
      `SELECT user_id FROM system_user_mailboxes WHERE LOWER(address) = $1 FOR SHARE`,
      [recipient]
    );
    if (!mailboxRows.length) throw new Error('Incoming recipient mailbox no longer exists.');
    const userId = mailboxRows[0].user_id;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tiwlo-mailbox:${userId}`]);
    const { rows: duplicateRows } = await client.query(
      `SELECT 1 FROM system_user_mail_messages
       WHERE user_id = $1 AND delivery_key = $2 LIMIT 1`,
      [userId, deliveryKey]
    );
    if (duplicateRows.length) {
      await client.query('COMMIT');
      return { duplicate: true };
    }
    const { rows: usageRows } = await client.query(
      `SELECT COUNT(DISTINCT m.id)::integer AS message_count,
              COALESCE(SUM(a.size_bytes), 0)::bigint AS attachment_bytes
       FROM system_user_mail_messages m
       LEFT JOIN system_user_mail_attachments a ON a.message_id = m.id
       WHERE m.user_id = $1`,
      [userId]
    );
    const usage = usageRows[0];
    if (Number(usage.message_count) >= MAX_MAILBOX_MESSAGES ||
        Number(usage.attachment_bytes) + totalAttachmentBytes > MAX_MAILBOX_ATTACHMENT_BYTES) {
      const error = new Error('The mailbox has reached its incoming storage limit.');
      error.code = 'MAILBOX_QUOTA_EXCEEDED';
      throw error;
    }
    const messageId = crypto.randomUUID();
    const { rows: inserted } = await client.query(
      `INSERT INTO system_user_mail_messages
         (id, user_id, folder, sender_name, sender_email, to_recipients, cc_recipients,
          subject, body_html, body_text, preview, category, is_unread, delivery_status,
          message_id, delivery_key)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11,
          $12, TRUE, 'received', $13, $14)
       ON CONFLICT (user_id, delivery_key) WHERE delivery_key IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        messageId,
        userId,
        spamResult.isSpam ? 'junk' : 'inbox',
        String(sender.name || senderEmail).slice(0, 255),
        senderEmail,
        JSON.stringify(headerRecipients),
        JSON.stringify(ccRecipients),
        String(parsed.subject || '(no subject)').replace(/[\r\n]/g, ' ').slice(0, 998),
        bodyHtml,
        bodyText,
        bodyText.trim().slice(0, 200) || '(no message text)',
        spamResult.isSpam ? 'Junk' : 'Personal',
        String(parsed.messageId || '').slice(0, 255) || null,
        deliveryKey
      ]
    );

    if (inserted.length) {
      for (const attachment of attachments) {
        const content = Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(attachment.content || '');
        await client.query(
          `INSERT INTO system_user_mail_attachments
             (id, message_id, filename, content_type, size_bytes, content)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            crypto.randomUUID(),
            messageId,
            safeFilename(attachment.filename),
            String(attachment.contentType || 'application/octet-stream').slice(0, 255),
            content.length,
            content
          ]
        );
      }
    }
    await client.query('COMMIT');
    if (inserted.length && spamResult.isSpam) {
      recordSecurityEvent({
        eventType: 'mail.inbound_spam_quarantined',
        severity: 'warning',
        userId,
        subject: senderEmail,
        details: { spamScore: spamResult.score ?? 'unavailable' }
      }).catch((error) => {
        console.error('[Tiwi Mail] Could not record quarantined spam event:', error.message);
      });
    }
    return { duplicate: inserted.length === 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function readInboundDeliveryToken() {
  const tokenPath = process.env.TIWLO_INBOUND_TOKEN_FILE || '/etc/postfix/tiwlo-inbound-token';
  try {
    return String(process.env.TIWLO_INBOUND_TOKEN || fs.readFileSync(tokenPath, 'utf8')).trim();
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}
