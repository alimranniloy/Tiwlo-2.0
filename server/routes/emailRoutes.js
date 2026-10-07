import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import { getPgPool } from '../db/postgres.js';
import { sendTiwloEmail } from '../db/emailService.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { securityLimiters } from '../plugins/security/index.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 5 * 1024 * 1024 }
});
const VALID_FOLDERS = new Set(['inbox', 'sent', 'drafts', 'junk', 'trash', 'archive', 'flagged']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAILBOX_LOCAL_PART_PATTERN = /^(?!.*\.\.)[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;
const RESERVED_MAILBOX_NAMES = new Set([
  'abuse', 'admin', 'administrator', 'billing', 'contact', 'help', 'hostmaster',
  'info', 'mail', 'mailer-daemon', 'noreply', 'postmaster', 'root', 'sales',
  'security', 'support', 'webmaster'
]);
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_DAILY_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const MAX_RECIPIENTS_PER_MESSAGE = 10;

router.use((req, res, next) => {
  if (!req.activeUser?.id) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});

function normalizeMailboxLocalPart(value) {
  const localPart = String(value || '').trim().toLowerCase();
  if (!MAILBOX_LOCAL_PART_PATTERN.test(localPart) || RESERVED_MAILBOX_NAMES.has(localPart)) return null;
  return localPart;
}

router.get('/mailbox', async (req, res, next) => {
  try {
    const { rows } = await getPgPool().query(
      `SELECT address, created_at AS "createdAt"
       FROM system_user_mailboxes WHERE user_id = $1`,
      [req.activeUser.id]
    );
    res.json({ success: true, mailbox: rows[0] || null, domain: PLATFORM_CONFIG.primaryDomain });
  } catch (error) {
    next(error);
  }
});

router.get('/mailbox/availability', securityLimiters.mailboxAvailability, async (req, res, next) => {
  try {
    const localPart = normalizeMailboxLocalPart(req.query.localPart);
    if (!localPart) {
      return res.json({
        success: true,
        available: false,
        error: 'Use 3–30 lowercase letters, numbers, dots, hyphens, or underscores; reserved names are unavailable.'
      });
    }
    const address = `${localPart}@${PLATFORM_CONFIG.primaryDomain}`;
    const { rows } = await getPgPool().query(
      `SELECT EXISTS (SELECT 1 FROM system_user_mailboxes WHERE LOWER(address) = $1) AS taken`,
      [address]
    );
    res.json({ success: true, address, available: !rows[0].taken });
  } catch (error) {
    next(error);
  }
});

router.post('/mailbox', securityLimiters.mailboxCreationIp, securityLimiters.mailboxCreationAccount, async (req, res, next) => {
  try {
    const localPart = normalizeMailboxLocalPart(req.body?.localPart);
    if (!localPart) {
      return res.status(400).json({
        success: false,
        error: 'Choose 3–30 lowercase letters, numbers, dots, hyphens, or underscores. Reserved names cannot be used.'
      });
    }
    const address = `${localPart}@${PLATFORM_CONFIG.primaryDomain}`;
    const pool = getPgPool();
    const { rows: currentRows } = await pool.query(
      `SELECT address FROM system_user_mailboxes WHERE user_id = $1`,
      [req.activeUser.id]
    );
    if (currentRows.length) {
      return res.status(409).json({
        success: false,
        error: 'A Tiwlo Mail address is already linked to this account.',
        mailbox: currentRows[0]
      });
    }
    const { rows } = await pool.query(
      `INSERT INTO system_user_mailboxes (user_id, address)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING address, created_at AS "createdAt"`,
      [req.activeUser.id, address]
    );
    if (!rows.length) {
      return res.status(409).json({ success: false, error: 'That Tiwlo Mail address is no longer available.' });
    }
    res.status(201).json({ success: true, mailbox: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.use(async (req, res, next) => {
  try {
    const { rows } = await getPgPool().query(
      `SELECT address FROM system_user_mailboxes WHERE user_id = $1`,
      [req.activeUser.id]
    );
    if (!rows.length) {
      return res.status(403).json({
        success: false,
        code: 'MAILBOX_REQUIRED',
        error: 'Create a Tiwlo Mail address to continue.'
      });
    }
    req.mailbox = rows[0];
    next();
  } catch (error) {
    next(error);
  }
});

function parseRecipients(value, label, optional = false) {
  if (value == null || value === '') {
    if (optional) return [];
    throw new TypeError(`${label} recipient is required.`);
  }
  const recipients = (Array.isArray(value) ? value : String(value).split(/[;,]/))
    .map((entry) => typeof entry === 'string' ? entry.trim() : String(entry?.email || '').trim())
    .filter(Boolean);
  if (recipients.length > 50 || (!optional && recipients.length === 0) || recipients.some((email) =>
    email.length > 254 || !EMAIL_PATTERN.test(email)
  )) {
    throw new TypeError(`Enter valid email addresses in ${label}.`);
  }
  return [...new Set(recipients.map((email) => email.toLowerCase()))];
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function renderBodyHtml(value) {
  return `<p>${escapeHtml(value)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, '<a href="$2" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/\n/g, '<br>')}</p>`;
}

function makeMessage(row, attachments = []) {
  const createdAt = new Date(row.created_at);
  const senderName = row.sender_name || row.sender_email;
  const initials = senderName.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  return {
    id: row.id,
    folder: row.folder,
    isFocused: true,
    isUnread: row.is_unread,
    isFlagged: row.is_flagged,
    isPinned: row.is_pinned,
    sender: {
      name: senderName,
      email: row.sender_email,
      avatar: null,
      initials,
      avatarColor: 'bg-[#0078D4]',
      isVerified: false
    },
    to: row.to_recipients,
    cc: row.cc_recipients,
    bcc: row.bcc_recipients,
    subject: row.subject,
    preview: row.preview,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    date: createdAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    fullDate: createdAt.toLocaleString(),
    category: row.category,
    categoryColor: '#0078D4',
    deliveryStatus: row.delivery_status,
    hasAttachments: attachments.length > 0,
    attachments
  };
}

async function getMessage(userId, messageId, { markRead = false } = {}) {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT * FROM system_user_mail_messages WHERE id = $1 AND user_id = $2`,
    [messageId, userId]
  );
  if (!rows.length) return null;
  if (markRead && rows[0].is_unread && rows[0].folder !== 'drafts') {
    await pool.query(
      `UPDATE system_user_mail_messages
       SET is_unread = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [messageId, userId]
    );
    rows[0].is_unread = false;
  }
  const attachmentResult = await pool.query(
    `SELECT id, filename, content_type, size_bytes
     FROM system_user_mail_attachments WHERE message_id = $1 ORDER BY created_at`,
    [messageId]
  );
  const attachments = attachmentResult.rows.map((attachment) => ({
    id: attachment.id,
    filename: attachment.filename,
    contentType: attachment.content_type,
    sizeBytes: Number(attachment.size_bytes),
    size: `${(Number(attachment.size_bytes) / (1024 * 1024)).toFixed(2)} MB`,
    url: `/api/email/attachments/${attachment.id}`
  }));
  return makeMessage(rows[0], attachments);
}

function handleUploadError(req, res, next) {
  upload.array('attachments', 5)(req, res, (error) => {
    if (!error) return next();
    const message = error instanceof multer.MulterError
      ? error.code === 'LIMIT_FILE_SIZE'
        ? 'Each attachment must be 5 MB or smaller.'
        : 'A maximum of 5 attachments can be sent at once.'
      : 'Could not process email attachments.';
    res.status(400).json({ success: false, error: message });
  });
}

router.get('/messages', async (req, res, next) => {
  try {
    const folder = String(req.query.folder || 'inbox');
    const tab = String(req.query.tab || 'all');
    const query = String(req.query.q || '').trim().slice(0, 200);
    if (!VALID_FOLDERS.has(folder)) {
      return res.status(400).json({ success: false, error: 'Unknown mail folder.' });
    }
    const pool = getPgPool();
    const countsResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE folder = 'inbox' AND is_unread)::integer AS "inboxUnread",
         COUNT(*) FILTER (WHERE folder = 'junk')::integer AS "junkCount",
         COUNT(*) FILTER (WHERE folder = 'drafts')::integer AS "draftsCount",
         COUNT(*) FILTER (WHERE folder = 'sent')::integer AS "sentCount",
         COUNT(*) FILTER (WHERE folder = 'trash')::integer AS "trashCount",
         COUNT(*) FILTER (WHERE folder = 'archive')::integer AS "archiveCount",
         COUNT(*) FILTER (WHERE is_flagged)::integer AS "flaggedCount"
       FROM system_user_mail_messages WHERE user_id = $1`,
      [req.activeUser.id]
    );
    const where = ['user_id = $1'];
    const params = [req.activeUser.id];
    if (folder === 'flagged') where.push('is_flagged = TRUE');
    else {
      params.push(folder);
      where.push(`folder = $${params.length}`);
    }
    if (folder === 'inbox') {
      if (tab === 'unread') where.push('is_unread = TRUE');
      else if (tab === 'focused') where.push('TRUE');
    }
    if (query) {
      params.push(`%${query.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`(subject ILIKE $${params.length} OR preview ILIKE $${params.length} OR sender_email ILIKE $${params.length})`);
    }
    params.push(200);
    const { rows } = await pool.query(
      `SELECT * FROM system_user_mail_messages
       WHERE ${where.join(' AND ')}
       ORDER BY is_pinned DESC, created_at DESC
       LIMIT $${params.length}`,
      params
    );
    const emails = rows.map((row) => makeMessage(row));
    res.json({ success: true, emails, counts: countsResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/messages/:id', async (req, res, next) => {
  try {
    const email = await getMessage(req.activeUser.id, req.params.id, { markRead: true });
    if (!email) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true, email });
  } catch (error) {
    next(error);
  }
});

router.post('/drafts', async (req, res, next) => {
  try {
    const userId = req.activeUser.id;
    const senderEmail = req.mailbox.address;
    if (!senderEmail) return res.status(400).json({ success: false, error: 'Your account has no email address.' });
    const { to = '', cc = '', bcc = '', subject = '', body = '', draftId = null } = req.body || {};
    const senderName = req.activeUser.name || senderEmail;
    const id = draftId || crypto.randomUUID();
    const bodyText = String(body).slice(0, 100000);
    const preview = bodyText.trim().slice(0, 200) || 'Draft';
    const pool = getPgPool();
    const { rows } = await pool.query(
      `INSERT INTO system_user_mail_messages
         (id, user_id, folder, sender_name, sender_email, to_recipients, cc_recipients,
          bcc_recipients, subject, body_html, body_text, preview, category)
       VALUES ($1, $2, 'drafts', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, 'Work')
       ON CONFLICT (id) DO UPDATE SET
         to_recipients = EXCLUDED.to_recipients,
         cc_recipients = EXCLUDED.cc_recipients,
         bcc_recipients = EXCLUDED.bcc_recipients,
         subject = EXCLUDED.subject,
         body_html = EXCLUDED.body_html,
         body_text = EXCLUDED.body_text,
         preview = EXCLUDED.preview,
         updated_at = CURRENT_TIMESTAMP
       WHERE system_user_mail_messages.user_id = $2 AND system_user_mail_messages.folder = 'drafts'
       RETURNING *`,
      [
        id,
        userId,
        senderName,
        senderEmail,
        JSON.stringify(parseRecipients(to, 'To', true).map((email) => ({ name: email, email }))),
        JSON.stringify(parseRecipients(cc, 'Cc', true).map((email) => ({ name: email, email }))),
        JSON.stringify(parseRecipients(bcc, 'Bcc', true).map((email) => ({ name: email, email }))),
        String(subject).slice(0, 998),
        renderBodyHtml(bodyText),
        bodyText,
        preview
      ]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Draft not found.' });
    res.json({ success: true, email: makeMessage(rows[0]) });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ success: false, error: error.message });
    next(error);
  }
});

router.delete('/drafts/:id', async (req, res, next) => {
  try {
    const { rowCount } = await getPgPool().query(
      `DELETE FROM system_user_mail_messages
       WHERE id = $1 AND user_id = $2 AND folder = 'drafts'`,
      [req.params.id, req.activeUser.id]
    );
    if (!rowCount) return res.status(404).json({ success: false, error: 'Draft not found.' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/send', securityLimiters.mailSendAccount, securityLimiters.mailSendDailyAccount, handleUploadError, async (req, res, next) => {
  try {
    const userId = req.activeUser.id;
    const senderEmail = req.mailbox.address;
    if (!senderEmail) return res.status(400).json({ success: false, error: 'Your account has no email address.' });
    const to = parseRecipients(req.body.to, 'To');
    const cc = parseRecipients(req.body.cc, 'Cc', true);
    const bcc = parseRecipients(req.body.bcc, 'Bcc', true);
    if (new Set([...to, ...cc, ...bcc]).size > MAX_RECIPIENTS_PER_MESSAGE) {
      return res.status(400).json({
        success: false,
        error: `A message can have at most ${MAX_RECIPIENTS_PER_MESSAGE} unique recipients.`
      });
    }
    const { subject = '', body = '', draftId = null } = req.body;
    const cleanSubject = String(subject).replace(/[\r\n]/g, ' ').trim().slice(0, 998);
    if (!cleanSubject) return res.status(400).json({ success: false, error: 'A subject is required.' });
    const bodyText = String(body || '').slice(0, 100000);
    const files = req.files || [];
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return res.status(400).json({ success: false, error: 'Total attachment size must be 20 MB or smaller.' });
    }
    const messageId = crypto.randomUUID();
    const attachmentMetadata = files.map((file) => ({
      id: crypto.randomUUID(),
      filename: pathSafeFilename(file.originalname),
      contentType: /^[\w.+-]+\/[\w.+-]+$/.test(file.mimetype)
        ? file.mimetype
        : 'application/octet-stream',
      size: file.size
    }));
    const pool = getPgPool();
    const { rows: attachmentUsageRows } = await pool.query(
      `SELECT COALESCE(SUM(a.size_bytes), 0)::bigint AS attachment_bytes
       FROM system_user_mail_attachments a
       JOIN system_user_mail_messages m ON m.id = a.message_id
       WHERE m.user_id = $1 AND m.folder = 'sent'
         AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
      [userId]
    );
    if (Number(attachmentUsageRows[0].attachment_bytes) + totalBytes > MAX_DAILY_ATTACHMENT_BYTES) {
      return res.status(429).json({
        success: false,
        error: 'This account has reached its daily attachment sending limit.'
      });
    }
    await pool.query(
      `INSERT INTO system_user_mail_messages
         (id, user_id, folder, sender_name, sender_email, to_recipients, cc_recipients,
          bcc_recipients, subject, body_html, body_text, preview, category, delivery_status)
       VALUES ($1, $2, 'sent', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, 'Work', 'sending')`,
      [
        messageId,
        userId,
        req.activeUser.name || senderEmail,
        senderEmail,
        JSON.stringify(to.map((email) => ({ name: email, email }))),
        JSON.stringify(cc.map((email) => ({ name: email, email }))),
        JSON.stringify(bcc.map((email) => ({ name: email, email }))),
        cleanSubject,
        renderBodyHtml(bodyText),
        bodyText,
        bodyText.trim().slice(0, 200)
      ]
    );
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const attachment = attachmentMetadata[index];
        await pool.query(
          `INSERT INTO system_user_mail_attachments
             (id, message_id, filename, content_type, size_bytes, content)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [attachment.id, messageId, attachment.filename, attachment.contentType, file.size, file.buffer]
        );
      }
      const delivery = await sendTiwloEmail({
        fromEmail: senderEmail,
        fromName: req.activeUser.name || senderEmail,
        replyTo: senderEmail,
        to: to.join(', '),
        cc: cc.join(', '),
        bcc: bcc.join(', '),
        attachments: files.map((file, index) => ({
          filename: attachmentMetadata[index].filename,
          content: file.buffer,
          contentType: attachmentMetadata[index].contentType
        })),
        subject: cleanSubject,
        html: renderBodyHtml(bodyText),
        text: bodyText,
        type: 'user_mail',
        metadata: { userId, messageId }
      });
      await pool.query(
        `UPDATE system_user_mail_messages
         SET delivery_status = $1, message_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4`,
        [delivery.status, delivery.messageId, messageId, userId]
      );
      const email = await getMessage(userId, messageId);
      if (!delivery.success) {
        return res.status(502).json({
          success: false,
          error: 'The SMTP server could not deliver this email. Check the email configuration and retry.',
          email
        });
      }
      if (draftId) {
        await pool.query(
          `DELETE FROM system_user_mail_messages WHERE id = $1 AND user_id = $2 AND folder = 'drafts'`,
          [draftId, userId]
        );
      }
      return res.status(201).json({ success: true, email });
    } catch (error) {
      await pool.query(
        `UPDATE system_user_mail_messages
         SET delivery_status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2`,
        [messageId, userId]
      );
      throw error;
    }
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ success: false, error: error.message });
    next(error);
  }
});

function pathSafeFilename(filename) {
  const basename = String(filename || 'attachment').split(/[\\/]/).pop().replace(/[\r\n"]/g, '_');
  return basename.slice(0, 255) || 'attachment';
}

router.get('/attachments/:id', async (req, res, next) => {
  try {
    const { rows } = await getPgPool().query(
      `SELECT a.filename, a.content_type, a.content
       FROM system_user_mail_attachments a
       JOIN system_user_mail_messages m ON m.id = a.message_id
       WHERE a.id = $1 AND m.user_id = $2`,
      [req.params.id, req.activeUser.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Attachment not found.' });
    res.setHeader('Content-Type', rows[0].content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(rows[0].filename)}"`);
    res.send(rows[0].content);
  } catch (error) {
    next(error);
  }
});

async function updateMessage(req, res, updateSql, values = []) {
  const { rowCount } = await getPgPool().query(
    `UPDATE system_user_mail_messages SET ${updateSql}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2`,
    [req.body.id, req.activeUser.id, ...values]
  );
  if (!rowCount) return res.status(404).json({ success: false, error: 'Message not found.' });
  return res.json({ success: true });
}

router.post('/toggle-flag', async (req, res, next) => {
  try {
    const { rows } = await getPgPool().query(
      `UPDATE system_user_mail_messages SET is_flagged = NOT is_flagged, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING is_flagged`,
      [req.body.id, req.activeUser.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true, isFlagged: rows[0].is_flagged });
  } catch (error) {
    next(error);
  }
});

router.post('/toggle-read', async (req, res, next) => {
  try {
    const isUnread = typeof req.body.isUnread === 'boolean' ? req.body.isUnread : null;
    const { rows } = await getPgPool().query(
      `UPDATE system_user_mail_messages
       SET is_unread = COALESCE($3, NOT is_unread), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING is_unread`,
      [req.body.id, req.activeUser.id, isUnread]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true, isUnread: rows[0].is_unread });
  } catch (error) {
    next(error);
  }
});

router.post('/toggle-pin', async (req, res, next) => {
  try {
    const { rows } = await getPgPool().query(
      `UPDATE system_user_mail_messages SET is_pinned = NOT is_pinned, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 RETURNING is_pinned`,
      [req.body.id, req.activeUser.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true, isPinned: rows[0].is_pinned });
  } catch (error) {
    next(error);
  }
});

router.post('/delete', async (req, res, next) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(
      `SELECT folder FROM system_user_mail_messages WHERE id = $1 AND user_id = $2`,
      [req.body.id, req.activeUser.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Message not found.' });
    if (rows[0].folder === 'trash') {
      await pool.query(
        `DELETE FROM system_user_mail_messages WHERE id = $1 AND user_id = $2`,
        [req.body.id, req.activeUser.id]
      );
      return res.json({ success: true, message: 'Message permanently deleted.' });
    }
    await updateMessage(req, res, `folder = 'trash', is_unread = FALSE`);
  } catch (error) {
    next(error);
  }
});

router.post('/archive', async (req, res, next) => {
  try {
    await updateMessage(req, res, `folder = 'archive'`);
  } catch (error) {
    next(error);
  }
});

router.use((error, req, res, next) => {
  console.error('[Tiwi Mail API] Request failed:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, error: 'The mail request could not be completed.' });
});

export default router;
