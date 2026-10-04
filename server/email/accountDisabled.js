import { renderBaseEmail } from './baseTemplate.js';

/**
 * Account Disabled Security Notice Email Template (1000% Google Standard)
 */
export function renderAccountDisabledEmail({ to, name, reason, restoreUrl }) {
  const targetUrl = restoreUrl || 'https://tiwlo.com/account-disabled';

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 400; line-height: 32px; color: #202124; text-align: center; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      Your account is disabled
    </h1>

    <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #3c4043; text-align: center; font-family: Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      Your Tiwlo Account was disabled because it was used in a way that violated our Community Standards on adult and sexually explicit content.
    </p>

    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #5f6368; text-align: center; font-family: Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      To keep our platform safe and welcoming for everyone, accounts that repeatedly violate our safety policies or post prohibited material are permanently suspended.
    </p>

    <p style="margin: 0 0 26px 0; font-size: 14px; line-height: 22px; color: #5f6368; text-align: center; font-family: Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
      If you believe your account was disabled by mistake, you can submit an appeal for our Trust & Safety team to review.
    </p>

    <!-- Primary Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 26px 0;">
      <tr>
        <td align="center">
          <a href="${targetUrl}" target="_blank" style="display: inline-block; background-color: #0b57d0; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; line-height: 20px; padding: 12px 36px; border-radius: 20px; font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, sans-serif;">
            Submit appeal
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #747775; text-align: center; font-family: Roboto, sans-serif;">
        Your data remains protected under Tiwlo Security Policies during the review period.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: 'Your account is disabled',
    recipientEmail: to,
    contentHtml,
    preheader: 'Your Tiwlo Account has been disabled. You can submit an appeal to request a review.'
  });
}
