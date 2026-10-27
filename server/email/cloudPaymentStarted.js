import { renderBaseEmail } from './baseTemplate.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function renderCloudPaymentStartedEmail({
  to,
  name,
  provider,
  amount,
  currency,
  creditAmount,
  creditCurrency,
  reference,
  checkoutUrl,
  expiresAt
}) {
  const safeName = escapeHtml(name || 'Tiwlo Cloud customer');
  const safeProvider = escapeHtml(String(provider || '').toUpperCase());
  const safeAmount = escapeHtml(`${currency} ${Number(amount).toFixed(2)}`);
  const safeReference = escapeHtml(reference);
  const safeCheckoutUrl = escapeHtml(checkoutUrl);
  const expiryLabel = expiresAt ? new Date(expiresAt).toUTCString() : 'within 24 hours';
  const safeExpiry = escapeHtml(expiryLabel);
  const contentHtml = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Continue your Cloud checkout
    </h1>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #3c4043;">
      Hi ${safeName}, a secure checkout session was created for your Tiwlo Cloud credit purchase.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #dadce0; border-radius: 8px; border-collapse: separate; margin: 20px 0;">
      <tr><td style="padding: 16px 18px 4px; color: #70757a; font-size: 12px;">Payment method</td></tr>
      <tr><td style="padding: 0 18px 14px; color: #202124; font-size: 14px; font-weight: 500;">${safeProvider}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Amount</td></tr>
      <tr><td style="padding: 0 18px 14px; color: #202124; font-size: 14px; font-weight: 500;">${safeAmount}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Cloud credits</td></tr>
      <tr><td style="padding: 0 18px 14px; color: #202124; font-size: 14px; font-weight: 500;">${escapeHtml(`${creditCurrency} ${Number(creditAmount).toFixed(2)}`)}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Reference</td></tr>
      <tr><td style="padding: 0 18px 16px; color: #202124; font-size: 13px; font-family: monospace; word-break: break-all;">${safeReference}</td></tr>
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr><td align="center">
        <a href="${safeCheckoutUrl}" target="_blank" rel="noopener" style="background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 11px 24px; border-radius: 4px; display: inline-block;">
          Continue to secure checkout
        </a>
      </td></tr>
    </table>
    <p style="margin: 0 0 16px; color: #5f6368; font-size: 12px; line-height: 18px;">
      This Tiwlo billing session expires at ${safeExpiry}. The provider's checkout page may have its own validity period.
    </p>
    <div style="padding: 14px 16px; background-color: #f8f9fa; border: 1px solid #e8eaed; border-radius: 8px;">
      <p style="margin: 0; color: #5f6368; font-size: 12px; line-height: 18px;">
        This email confirms only that a checkout session was created; it is not a payment receipt. Your billing record changes only after the provider's payment confirmation is verified. Any payment completed with the provider is still verified even if this billing session expires.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: 'Continue your Tiwlo Cloud checkout',
    recipientEmail: to,
    contentHtml,
    preheader: `A secure Tiwlo Cloud checkout session was created for ${safeAmount}.`
  });
}
