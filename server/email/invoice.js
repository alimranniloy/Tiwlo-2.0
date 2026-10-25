import { renderBaseEmail } from './baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

/**
 * Invoice & Payment Receipt Email Template
 * 
 * Styled after Google Workspace & Cloud billing receipt emails:
 * - Clean total amount display with green "Paid" status chip
 * - High-clarity invoice metadata table
 * - Itemized billing breakdown
 * - Google Blue "View invoice" button (#1a73e8)
 */
export function renderInvoiceEmail({
  to,
  name,
  invoiceNumber = 'INV-2026-001',
  date = null,
  amount = '0.00',
  paidAmount = undefined,
  dueAmount = undefined,
  currency = 'USD',
  paymentStatus = 'Paid',
  planName = 'Tiwlo Cloud Pro',
  paymentMethod = 'Online Payment',
  storeName = 'Tiwlo Store',
  items = [],
  actionUrl = getPlatformUrl()
}) {
  const formattedDate = date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
  const currencyPrefix = currency === 'BDT'
    ? '৳'
    : currency === 'USD'
      ? '$'
      : `${escapeHtml(currency)} `;
  const rawDisplayAmount = typeof amount === 'number' ? amount.toFixed(2) : amount;
  const displayAmount = escapeHtml(rawDisplayAmount);
  const invoiceTotal = Number(amount) || 0;
  const paidTotal = Number.isFinite(Number(paidAmount))
    ? Number(paidAmount)
    : safePaymentStatus === 'Paid' ? invoiceTotal : 0;
  const outstandingTotal = Number.isFinite(Number(dueAmount))
    ? Number(dueAmount)
    : Math.max(0, invoiceTotal - paidTotal);
  const displayPaid = escapeHtml(paidTotal.toFixed(2));
  const displayDue = escapeHtml(outstandingTotal.toFixed(2));
  const safePaymentStatus = ['Paid', 'Partial', 'Unpaid', 'Pending', 'Credited', 'Partially Refunded', 'Refunded', 'Failed'].includes(paymentStatus)
    ? paymentStatus
    : 'Pending';
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeDate = escapeHtml(formattedDate);
  const safeStoreName = escapeHtml(storeName || name);
  const safePaymentMethod = escapeHtml(paymentMethod);
  const safePlanName = escapeHtml(planName);
  const safeActionUrl = (() => {
    try {
      const parsed = new URL(actionUrl);
      return ['http:', 'https:'].includes(parsed.protocol) ? escapeHtml(parsed.href) : getPlatformUrl();
    } catch {
      return getPlatformUrl();
    }
  })();
  const amountLabel = 'Invoice Total';
  const statusColors = safePaymentStatus === 'Paid'
    ? { background: '#e6f4ea', foreground: '#137333' }
    : { background: '#fef7e0', foreground: '#8a4b00' };

  const billingItems = items && items.length > 0 ? items : [
    { description: `${planName} Subscription`, qty: 1, amount: rawDisplayAmount }
  ];

  const contentHtml = `
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Your Tiwlo invoice
    </h1>

    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; color: #5f6368; text-align: center;">
      Thank you for your business. Here is the invoice summary for your order.
    </p>

    <!-- Amount & Status Summary Card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px; text-align: center; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${amountLabel}</div>
          <div style="font-size: 32px; font-weight: 500; color: #202124; line-height: 38px; margin-bottom: 8px;">
            ${currencyPrefix}${displayAmount}
          </div>
          <div>
            <span style="display: inline-block; background-color: ${statusColors.background}; color: ${statusColors.foreground}; font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 4px;">
              ${safePaymentStatus}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Invoice Details Meta Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 22px; margin-bottom: 24px; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
      <tr>
        <td style="padding: 4px 0; color: #70757a; width: 120px;">Invoice number</td>
        <td style="padding: 4px 0; color: #202124; font-weight: 500; font-family: 'Google Sans', Roboto, Consolas, monospace;">${safeInvoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Invoice date</td>
        <td style="padding: 4px 0; color: #202124;">${safeDate}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Store / Account</td>
        <td style="padding: 4px 0; color: #202124;">${safeStoreName}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Payment method</td>
        <td style="padding: 4px 0; color: #202124;">${safePaymentMethod}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Amount paid</td>
        <td style="padding: 4px 0; color: #202124;">${currencyPrefix}${displayPaid}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Outstanding due</td>
        <td style="padding: 4px 0; color: #202124; font-weight: 600;">${currencyPrefix}${displayDue}</td>
      </tr>
    </table>

    <!-- Itemized Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; font-size: 13px; margin-bottom: 24px; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
      <thead>
        <tr style="border-bottom: 1px solid #dadce0;">
          <th align="left" style="padding: 8px 0; color: #70757a; font-weight: 500; font-size: 12px;">Description</th>
          <th align="center" style="padding: 8px 8px; color: #70757a; font-weight: 500; font-size: 12px; width: 40px;">Qty</th>
          <th align="right" style="padding: 8px 0; color: #70757a; font-weight: 500; font-size: 12px; width: 80px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${billingItems.map(item => `
          <tr style="border-bottom: 1px solid #f1f3f4;">
            <td style="padding: 10px 0; color: #202124;">${escapeHtml(item.description || item.name)}</td>
            <td align="center" style="padding: 10px 8px; color: #5f6368;">${escapeHtml(item.qty || 1)}</td>
            <td align="right" style="padding: 10px 0; color: #202124; font-weight: 500;">${currencyPrefix}${escapeHtml(typeof item.amount === 'number' ? item.amount.toFixed(2) : item.amount)}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="2" style="padding: 12px 0 0 0; color: #202124; font-weight: 500; font-size: 14px;">Total</td>
          <td align="right" style="padding: 12px 0 0 0; color: #202124; font-weight: 500; font-size: 14px;">${currencyPrefix}${displayAmount}</td>
        </tr>
      </tbody>
    </table>

    <!-- Primary Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td align="center">
          <a href="${safeActionUrl}" target="_blank" style="background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 24px; border-radius: 4px; display: inline-block; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
            View invoice
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 16px; padding: 14px 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        Keep this invoice for your records. Contact the store if you have questions about this order.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: `Your Tiwlo invoice [${safeInvoiceNumber}]`,
    recipientEmail: to,
    contentHtml,
    preheader: `Invoice total ${currencyPrefix}${displayAmount} for ${safePlanName}. Invoice ${safeInvoiceNumber}.`
  });
}
