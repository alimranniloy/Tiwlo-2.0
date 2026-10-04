import { renderBaseEmail } from './baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

/**
 * Content Removed Due to Policy Violation Email Template (1000% Google Standard)
 */
export function renderContentRemovedEmail({
  to,
  name,
  contentType = 'photo',
  policyName = 'Community Standards',
  reason,
  appealUrl = getPlatformUrl('help-support')
}) {
  const recipientName = name || (to ? to.split('@')[0] : 'Member');

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 400; line-height: 28px; color: #202124; text-align: center; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      Content removed from your account
    </h1>

    <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #3c4043; text-align: center; font-family: Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      Hi ${recipientName}, we recently removed a ${contentType} posted from your account because it violates our Community Standards on sexually explicit content.
    </p>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #5f6368; text-align: center; font-family: Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      To keep Tiwi safe, respectful, and family-friendly for everyone, adult material and nudity are not permitted on public feeds.
    </p>

    <div style="margin: 20px 0 24px 0; padding: 18px 24px; background-color: #f8f9fa; border-radius: 12px; border: 1px solid #e8eaed;">
      <p style="margin: 0 0 8px 0; font-size: 13.5px; font-weight: 600; color: #202124; font-family: 'Google Sans', Roboto, sans-serif;">
        What this means for your account:
      </p>
      <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 20px; color: #444746; font-family: Roboto, sans-serif;">
        • A warning strike has been recorded on your account.
      </p>
      <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 20px; color: #444746; font-family: Roboto, sans-serif;">
        • If an account receives 3 strikes, it will be permanently disabled.
      </p>
      <p style="margin: 0; font-size: 13px; line-height: 20px; color: #444746; font-family: Roboto, sans-serif;">
        • If you think we made a mistake, you can review our guidelines and submit an appeal.
      </p>
    </div>

    <!-- Primary Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${appealUrl}" target="_blank" style="display: inline-block; background-color: #0b57d0; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; line-height: 20px; padding: 12px 32px; border-radius: 20px; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
            Review Community Standards
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #747775; text-align: center; font-family: Roboto, sans-serif;">
        If you have questions, our Trust & Safety team is available to assist you.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: 'Content removed from your account',
    recipientEmail: to,
    contentHtml,
    preheader: `We removed a ${contentType} from your account for violating Community Standards.`
  });
}
