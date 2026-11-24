import { renderBaseEmail, escapeEmailHtml, sanitizeEmailUrl } from './baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

export function renderIdentityVerificationRequiredEmail({ to, identityUrl, reason = '' }) {
  const targetUrl = escapeEmailHtml(sanitizeEmailUrl(identityUrl, getPlatformUrl('identity-required')));
  const cleanReason = String(reason || '').trim().slice(0, 600);
  const reasonBlock = cleanReason
    ? `<div style="margin:0 0 18px;padding:14px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
        <div style="font-size:12px;font-weight:600;color:#b91c1c;margin-bottom:4px;">Reason / Details</div>
        <div style="font-size:13px;line-height:20px;color:#7f1d1d;">${escapeEmailHtml(cleanReason)}</div>
      </div>`
    : '';
  const contentHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:400;line-height:32px;color:#202124;text-align:center;font-family:'Google Sans',Roboto,-apple-system,BlinkMacSystemFont,sans-serif;">
      Verify your identity to restore access
    </h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#3c4043;text-align:center;font-family:Roboto,-apple-system,BlinkMacSystemFont,sans-serif;">
      Identity verification is required before you can use your Tiwlo account. Your account is temporarily locked while you complete this check.
    </p>
    ${reasonBlock}
    <div style="margin:20px 0 24px;padding:16px 18px;background:#f8f9fa;border-radius:12px;">
      <div style="font-size:13px;line-height:20px;color:#3c4043;">
        Sign in to Tiwlo, then upload an identity document and complete a live selfie check. Access will be restored automatically after a successful result.
      </div>
    </div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${targetUrl}" target="_blank" style="display:inline-block;background:#137333;color:#fff;text-decoration:none;font-size:14px;font-weight:500;line-height:20px;padding:12px 28px;border-radius:20px;font-family:'Google Sans',Roboto,-apple-system,BlinkMacSystemFont,sans-serif;">
          Start identity verification
        </a>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#5f6368;text-align:center;">
      If you believe this request is a mistake, contact Tiwlo Support.
    </p>
  `;

  return renderBaseEmail({
    title: 'Identity verification required',
    recipientEmail: to,
    contentHtml,
    preheader: 'Your Tiwlo account is temporarily locked until identity verification is complete.'
  });
}
