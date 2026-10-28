import { renderBaseEmail } from './baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

export function renderIdentityVerificationCompleteEmail({ to, accountUrl }) {
  const targetUrl = accountUrl || getPlatformUrl('dashboard');
  const contentHtml = `
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:400;line-height:32px;color:#202124;text-align:center;font-family:'Google Sans',Roboto,-apple-system,BlinkMacSystemFont,sans-serif;">
      Your account is verified
    </h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#3c4043;text-align:center;font-family:Roboto,-apple-system,BlinkMacSystemFont,sans-serif;">
      Your identity check was successful and your Tiwlo account is unlocked. You can now continue using your account.
    </p>
    <div style="margin:20px 0 24px;padding:16px 18px;background:#e6f4ea;border-radius:12px;">
      <div style="font-size:12px;font-weight:600;letter-spacing:.3px;color:#137333;margin-bottom:6px;">
        Account status: Active
      </div>
      <div style="font-size:13px;line-height:20px;color:#3c4043;">
        Your account access has been restored following the successful identity check.
      </div>
    </div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${targetUrl}" target="_blank" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;font-size:14px;font-weight:500;line-height:20px;padding:12px 28px;border-radius:20px;font-family:'Google Sans',Roboto,-apple-system,BlinkMacSystemFont,sans-serif;">
          Open Tiwlo
        </a>
      </td></tr>
    </table>
    <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#5f6368;text-align:center;">
      This check confirms face match and liveness; it does not confirm that an identity document is genuine.
    </p>
  `;

  return renderBaseEmail({
    title: 'Identity verification complete',
    recipientEmail: to,
    contentHtml,
    preheader: 'Your Tiwlo account is verified and access has been restored.'
  });
}
