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

export function renderCloudPaymentReminderEmail({
  to,
  name,
  provider,
  amount,
  currency,
  creditAmount,
  reference,
  invoiceUrl,
  expiresAt
}) {
  const safeName = escapeHtml(name || 'Tiwlo Cloud customer');
  const safeProvider = escapeHtml(String(provider || '').toUpperCase());
  const safeAmount = escapeHtml(`${currency} ${Number(amount).toFixed(2)}`);
  const safeCredits = escapeHtml(`USD ${Number(creditAmount).toFixed(2)}`);
  const safeReference = escapeHtml(reference);
  const safeInvoiceUrl = escapeHtml(invoiceUrl);
  const safeExpiry = escapeHtml(new Date(expiresAt).toUTCString());
  const contentHtml = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Your Cloud checkout expires in 6 hours
    </h1>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #3c4043;">
      Hi ${safeName}, this is a reminder that your Tiwlo Cloud checkout has not yet received verified payment confirmation. If you have already paid, no further action is needed while the provider confirms it.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #dadce0; border-radius: 8px; border-collapse: separate; margin: 20px 0;">
      <tr><td style="padding: 16px 18px 4px; color: #70757a; font-size: 12px;">Payment method</td></tr>
      <tr><td style="padding: 0 18px 12px; color: #202124; font-size: 14px; font-weight: 500;">${safeProvider}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Payment amount</td></tr>
      <tr><td style="padding: 0 18px 12px; color: #202124; font-size: 14px; font-weight: 500;">${safeAmount}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Cloud credits</td></tr>
      <tr><td style="padding: 0 18px 12px; color: #202124; font-size: 14px; font-weight: 500;">${safeCredits}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Reference</td></tr>
      <tr><td style="padding: 0 18px 16px; color: #202124; font-size: 13px; font-family: monospace; word-break: break-all;">${safeReference}</td></tr>
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr><td align="center">
        <a href="${safeInvoiceUrl}" target="_blank" rel="noopener" style="background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 11px 24px; border-radius: 4px; display: inline-block;">
          Review invoice
        </a>
      </td></tr>
    </table>
    <p style="margin: 0 0 16px; color: #5f6368; font-size: 12px; line-height: 18px;">
      This Tiwlo billing session expires at ${safeExpiry}. The payment provider may have its own checkout deadline. Any payment confirmed by the provider will still be verified.
    </p>
  `;

  return renderBaseEmail({
    title: 'Your Tiwlo Cloud checkout expires in 6 hours',
    recipientEmail: to,
    contentHtml,
    preheader: `Your ${safeProvider} Cloud checkout expires in about 6 hours.`
  });
}

export function renderCloudPaymentCancelledEmail({
  to,
  name,
  provider,
  amount,
  currency,
  reference,
  invoiceUrl
}) {
  const safeName = escapeHtml(name || 'Tiwlo Cloud customer');
  const safeProvider = escapeHtml(String(provider || '').toUpperCase());
  const safeAmount = escapeHtml(`${currency} ${Number(amount).toFixed(2)}`);
  const safeReference = escapeHtml(reference);
  const safeInvoiceUrl = escapeHtml(invoiceUrl);
  const contentHtml = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Cloud checkout cancelled
    </h1>
    <p style="margin: 0 0 20px; font-size: 14px; line-height: 22px; color: #3c4043;">
      Hi ${safeName}, your Tiwlo billing session has been cancelled as requested.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #dadce0; border-radius: 8px; border-collapse: separate; margin: 20px 0;">
      <tr><td style="padding: 16px 18px 4px; color: #70757a; font-size: 12px;">Payment method</td></tr>
      <tr><td style="padding: 0 18px 12px; color: #202124; font-size: 14px; font-weight: 500;">${safeProvider}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Amount</td></tr>
      <tr><td style="padding: 0 18px 12px; color: #202124; font-size: 14px; font-weight: 500;">${safeAmount}</td></tr>
      <tr><td style="padding: 0 18px 4px; color: #70757a; font-size: 12px;">Reference</td></tr>
      <tr><td style="padding: 0 18px 16px; color: #202124; font-size: 13px; font-family: monospace; word-break: break-all;">${safeReference}</td></tr>
    </table>
    <p style="margin: 0 0 16px; color: #5f6368; font-size: 12px; line-height: 18px;">
      This cancellation closes the Tiwlo billing session; it may not close the payment provider's hosted page. If a payment was completed, its verified confirmation will still be applied to your Cloud credits. Check the invoice for the latest status.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr><td align="center">
        <a href="${safeInvoiceUrl}" target="_blank" rel="noopener" style="background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 11px 24px; border-radius: 4px; display: inline-block;">
          View billing
        </a>
      </td></tr>
    </table>
  `;

  return renderBaseEmail({
    title: 'Your Tiwlo Cloud checkout was cancelled',
    recipientEmail: to,
    contentHtml,
    preheader: `Your Tiwlo Cloud billing session ${safeReference} was cancelled.`
  });
}
