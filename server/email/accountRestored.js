import { renderBaseEmail } from './baseTemplate.js';

/**
 * Account Restored Notice Email Template
 * 
 * Styled with clean minimalist typography and card containers:
 * - Direct, positive heading
 * - Account chip with recipient email
 * - Reassurance that access is fully restored
 * - Primary CTA: "Sign in to your account"
 */
export function renderAccountRestoredEmail({ to, name, checkupUrl }) {
  const targetUrl = checkupUrl || 'https://tiwlo.com/security-checkup';

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Access restored to your Tiwlo Account
    </h1>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Good news. We reviewed your account and confirmed that access has been restored.
    </p>

    <!-- Success Info Box -->
    <div style="margin: 20px 0 24px 0; padding: 16px 20px; background-color: #f6fbf7; border: 1px solid #ceead6; border-radius: 8px;">
      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #137333; margin-bottom: 6px;">
        Account status: Active
      </div>
      <div style="font-size: 13px; line-height: 20px; color: #0d652d;">
        Your stores, product catalogs, cloud instances, and POS terminals are now fully operational.
      </div>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 20px; color: #5f6368; text-align: center;">
      Please complete a quick security checkup to confirm your credentials and return to your dashboard.
    </p>

    <!-- Primary Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${targetUrl}" target="_blank" style="display: inline-block; background-color: #1a73e8; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; line-height: 20px; padding: 12px 32px; border-radius: 20px; font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
            Review Security & Sign in
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        Thank you for your cooperation and for being part of the Tiwlo ecosystem. If you have any further questions, our 24/7 Security Team is available on your dashboard.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: 'Access restored to your Tiwlo Account',
    recipientEmail: to,
    contentHtml,
    preheader: 'Access has been restored to your Tiwlo Account. You can now sign in.'
  });
}
