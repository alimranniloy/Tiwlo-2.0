/**
 * Tiwlo Support Ticket Email Templates (Clean Minimal Shadcn UI Style)
 *
 * Distinct from core auth/security templates while keeping Tiwlo's clean white card,
 * neutral slate/zinc borders, crisp badges, and zero-emoji deliverability.
 */

import { renderBaseEmail, sanitizeEmailUrl } from './baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBadgeColors(status) {
  const s = String(status || 'open').toLowerCase();
  if (s === 'closed' || s === 'resolved') {
    return { bg: '#f4f4f5', border: '#e4e4e7', text: '#52525b', label: s === 'closed' ? 'Closed (Locked)' : 'Resolved' };
  }
  if (s === 'on_hold' || s === 'escalated') {
    return { bg: '#fafafa', border: '#d4d4d8', text: '#27272a', label: s === 'on_hold' ? 'On Hold' : 'Escalated' };
  }
  if (s === 'in_progress' || s === 'waiting_customer') {
    return { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', label: s === 'in_progress' ? 'In Progress' : 'Waiting for Reply' };
  }
  return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', label: 'Open' };
}

export function renderSupportTicketEmail({
  recipientEmail,
  recipientName = 'Customer',
  eventType = 'created', // 'created' | 'reply' | 'status_updated' | 'closed'
  ticketNumber,
  subject,
  status = 'open',
  priority = 'medium',
  department = 'General Support',
  replyToAlias = '',
  senderName = 'Tiwlo Support',
  messageBody = '',
  attachments = [],
  portalUrl = ''
}) {
  const safeRef = escapeHtml(ticketNumber);
  const safeSubj = escapeHtml(subject);
  const safeName = escapeHtml(recipientName);
  const safeReplyTo = escapeHtml(replyToAlias);
  const safeSender = escapeHtml(senderName);
  const safeMsg = escapeHtml(messageBody).replace(/\n/g, '<br>');
  const badge = formatBadgeColors(status);
  const safeUrl = escapeHtml(
    sanitizeEmailUrl(
      portalUrl || `${getPlatformUrl('main')}/support?ref=${encodeURIComponent(ticketNumber || '')}`,
      `${getPlatformUrl('main')}/support`
    )
  );

  const headingByEvent = {
    created: `Reply - Tiwlo Support [Ticket #${safeRef}]`,
    reply: `Reply - Tiwlo Support [Ticket #${safeRef}]`,
    status_updated: `Reply - Tiwlo Support [Ticket #${safeRef}] - Status Update`,
    closed: `Tiwlo Support [Ticket #${safeRef}] - Closed`
  };
  const title = headingByEvent[eventType] || `Support Update [${safeRef}]`;

  const attachmentsHtml = Array.isArray(attachments) && attachments.length > 0
    ? `
      <div style="margin-top: 16px; padding: 12px 14px; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px;">
        <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #71717a;">
          Attached Files (${attachments.length})
        </p>
        ${attachments.map((att) => `
          <div style="font-size: 12px; color: #18181b; padding: 2px 0;">
            ${escapeHtml(att.filename || att.name || 'attachment')}
            ${att.size ? `<span style="color: #71717a;"> (${Math.max(1, Math.round(Number(att.size) / 1024))} KB)</span>` : ''}
          </div>
        `).join('')}
      </div>`
    : '';

  const replyHintHtml = eventType === 'closed'
    ? `
      <div style="margin-top: 20px; padding: 14px 16px; background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #3f3f46;">
          This ticket is now permanently closed. Its dedicated reply-to email alias has been deactivated and deleted from our relay system. If you need further assistance, please submit a new support request from the Help Center.
        </p>
      </div>`
    : safeReplyTo
      ? `
      <div style="margin-top: 20px; padding: 14px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #475569;">
          You can reply directly to this email (<strong style="color: #0f172a;">${safeReplyTo}</strong>) with text or file attachments and your message will appear directly inside ticket <strong>${safeRef}</strong>. This temporary email address expires automatically once the ticket is closed.
        </p>
      </div>`
      : '';

  const contentHtml = `
    <div style="margin-bottom: 18px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td>
            <span style="display: inline-block; font-size: 11px; font-weight: 600; color: #71717a; letter-spacing: 0.04em; text-transform: uppercase;">
              Ticket Reference
            </span>
            <div style="font-family: 'Roboto Mono', Consolas, monospace; font-size: 16px; font-weight: 600; color: #09090b; margin-top: 2px;">
              ${safeRef}
            </div>
          </td>
          <td align="right" valign="middle">
            <span style="display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 600; border-radius: 9999px; background-color: ${badge.bg}; border: 1px solid ${badge.border}; color: ${badge.text};">
              ${badge.label}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding: 16px 18px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 18px;">
      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; line-height: 21px; color: #09090b;">
        ${safeSubj}
      </p>
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #71717a;">
        Department: ${escapeHtml(department)} &middot; Priority: ${escapeHtml(String(priority).toUpperCase())}
      </p>
    </div>

    <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 22px; color: #27272a;">
      Hi ${safeName},
    </p>

    ${safeMsg ? `
      <div style="padding: 16px 18px; background-color: #fafafa; border: 1px solid #e4e4e7; border-left: 3px solid #1ED760; border-radius: 6px; margin-bottom: 16px;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #52525b;">
          ${safeSender}
        </p>
        <div style="font-size: 14px; line-height: 22px; color: #18181b;">
          ${safeMsg}
        </div>
        ${attachmentsHtml}
      </div>` : ''}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 22px 0 8px 0;">
      <tr>
        <td align="left">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #09090b; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px;">
            View Ticket in Support Portal
          </a>
        </td>
      </tr>
    </table>

    ${replyHintHtml}
  `;

  return renderBaseEmail({
    title,
    recipientEmail,
    contentHtml,
    preheader: `${ticketNumber}: ${subject}`
  });
}
