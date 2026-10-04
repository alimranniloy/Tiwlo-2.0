import { renderBaseEmail } from './baseTemplate.js';

/**
 * Password Reset Recovery Code Email Template
 * 
 * Styled after Google's Account Recovery emails:
 * - Direct, clear heading
 * - High-visibility verification code
 * - Clear safety disclaimer
 */
export function renderPasswordResetEmail({ to, name, code }) {
  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Reset your password
    </h1>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      We received a request to reset the password for your Tiwlo Account. Enter this code to set a new password:
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
      This code will expire in 15 minutes.
    </p>

    <div style="margin-top: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        <strong>Didn't request this?</strong> If you didn't ask to reset your password, you can safely ignore this email. Your password won't change until you create a new one using this code.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: `${code} is your Tiwlo password recovery code`,
    recipientEmail: to,
    contentHtml,
    preheader: `${code} is your Tiwlo password recovery code. Enter this code to choose a new password.`
  });
}
