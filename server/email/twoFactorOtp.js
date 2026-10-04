import { renderBaseEmail } from './baseTemplate.js';

/**
 * Two-Step Verification (2FA) OTP Email Template
 * 
 * Styled after Google's 2-Step Verification security emails:
 * - Clean title
 * - Large, prominent verification code inside a neutral rounded container
 * - Clear 10-minute expiry advisory
 * - Security instruction if unexpected
 */
export function renderTwoFactorEmail({ to, name, code }) {
  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      2-Step Verification
    </h1>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Use this code to complete sign-in to your Tiwlo Account.
    </p>

    <!-- Verification Code Container -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 24px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; padding: 16px 32px; text-align: center;">
            <span class="code-display" style="font-family: 'Google Sans', Roboto, 'Roboto Mono', Consolas, monospace; font-size: 32px; font-weight: 500; letter-spacing: 6px; color: #1f1f1f; line-height: 1;">
              ${code}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 20px; color: #5f6368; text-align: center;">
      This code will expire in 10 minutes.
    </p>

    <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        <strong>Security tip:</strong> Never share your verification code with anyone. Tiwlo employees will never call or message you asking for your verification code. If you did not make this request, someone may know your password. Change your password immediately to keep your account safe.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: `${code} is your Tiwlo 2-Step Verification code`,
    recipientEmail: to,
    contentHtml,
    preheader: `${code} is your Tiwlo 2-Step Verification code. Valid for 10 minutes.`
  });
}
