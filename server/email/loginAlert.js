import { renderBaseEmail } from './baseTemplate.js';

/**
 * Login Activity Alert Email Template
 * 
 * Clean, professional security alert layout:
 * - Direct, clear heading
 * - Device / Session Card with clean key-value rows
 * - Action button to check activity
 * - Calibrated security advice
 */
export function renderLoginAlertEmail({
  to,
  name,
  ip = '127.0.0.1',
  userAgent = 'Web Browser',
  location = 'Dhaka, Bangladesh',
  timestamp = null,
  actionUrl = 'https://tiwlo.com'
}) {
  const formattedTime = timestamp || new Date().toUTCString();
  const deviceDisplay = userAgent && userAgent.length > 55 ? userAgent.slice(0, 55) + '...' : (userAgent || 'Desktop Web Browser');

  const contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Security alert
    </h1>

    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Your Tiwlo Account was just signed in to from a new device. You're getting this email to make sure that it was you.
    </p>

    <!-- Device & Activity Card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #dadce0; border-radius: 8px; margin: 20px 0; border-collapse: separate;">
      <tr>
        <td style="padding: 18px 20px; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
          <div style="font-size: 15px; font-weight: 500; color: #202124; margin-bottom: 12px; line-height: 20px;">
            ${deviceDisplay}
          </div>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 22px;">
            <tr>
              <td style="padding: 3px 0; color: #70757a; width: 90px; vertical-align: top;">Time</td>
              <td style="padding: 3px 0; color: #202124; font-weight: 400;">${formattedTime}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #70757a; width: 90px; vertical-align: top;">Approx. region</td>
              <td style="padding: 3px 0; color: #202124; font-weight: 400;">${location}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; color: #70757a; width: 90px; vertical-align: top;">IP address</td>
              <td style="padding: 3px 0; color: #202124; font-weight: 400; font-family: 'Google Sans', Roboto, Consolas, monospace;">${ip}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Primary Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${actionUrl}" target="_blank" style="background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 24px; border-radius: 4px; display: inline-block; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
            Check activity
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        If this was you, you don't need to do anything. If this wasn't you, your account may be compromised. Please review your account security and change your password immediately.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: 'Security alert: New sign-in to your Tiwlo Account',
    recipientEmail: to,
    contentHtml,
    preheader: `New sign-in detected on your Tiwlo Account from ${deviceDisplay} (${location}).`
  });
}
