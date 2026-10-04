/**
 * Tiwlo Clean Email System - Base Template
 * 
 * Clean, minimalist typography and responsive card container:
 * - Minimalist, distraction-free typography
 * - Card container (border: 1px solid #dadce0; border-radius: 8px;)
 * - Clean Roboto / system font stack
 * - Bulletproof HTML table layout for high deliverability & cross-client rendering
 * - ZERO emojis in layout or subjects
 * - Clean neutral footer (no garish colors or badges)
 */

export function renderBaseEmail({
  title,
  recipientEmail,
  contentHtml,
  preheader = ''
}) {
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${title || 'Tiwlo'}</title>
  <!--[if mso]>
  <style>
    * { font-family: sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
      }
      .email-body-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .code-display {
        font-size: 28px !important;
        letter-spacing: 4px !important;
        padding: 12px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #ffffff;">
  ${preheader ? `
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
    ${preheader}
  </div>` : ''}

  <!-- Main Centered Layout Table -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; background-color: #ffffff; font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
    <tr>
      <td align="center" style="padding: 32px 16px 40px 16px;">
        
        <!-- Email Card Container -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 516px; border: 1px solid #dadce0; border-radius: 8px; background-color: #ffffff; text-align: left; overflow: hidden;">
          
          <!-- Header (Logo) -->
          <tr>
            <td align="center" style="padding: 36px 32px 16px 32px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://tiwlo.com" target="_blank" style="text-decoration: none; display: inline-block;">
                      <img src="https://tiwlo.com/tiwlologo.png" alt="Tiwlo" width="105" height="30" style="display: block; width: 105px; height: 30px; object-fit: contain; border: 0;" />
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${recipientEmail ? `
          <!-- Recipient Account Chip -->
          <tr>
            <td align="center" style="padding: 0 32px 20px 32px;">
              <div style="display: inline-block; font-size: 13px; color: #5f6368; font-weight: 400; line-height: 18px; padding: 3px 12px; background-color: #f1f3f4; border-radius: 14px; font-family: Roboto, Arial, sans-serif;">
                ${recipientEmail}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Main Body Content -->
          <tr>
            <td class="email-body-padding" style="padding: 0 32px 32px 32px; font-family: Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td style="border-top: 1px solid #dadce0; padding: 0;"></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 28px 32px; text-align: center; font-size: 11px; line-height: 16px; color: #5f6368; font-family: Roboto, Arial, sans-serif;">
              <div style="margin-bottom: 8px;">
                You received this email to let you know about important changes to your Tiwlo Account and services.
              </div>
              <div style="color: #70757a; margin-bottom: 8px;">
                This message was sent from a notification-only address that cannot accept incoming email. Please do not reply directly to this message.
              </div>
              <div style="color: #70757a;">
                &copy; ${currentYear} Tiwlo, Inc. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
        <!-- End Email Card Container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}
