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
  currency = 'USD',
  planName = 'Tiwlo Cloud Pro',
  paymentMethod = 'Online Payment',
  storeName = 'Tiwlo Store',
  items = [],
  actionUrl = getPlatformUrl()
}) {
  const formattedDate = date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const currencySymbol = currency === 'BDT' ? '৳' : '$';
  const displayAmount = typeof amount === 'number' ? amount.toFixed(2) : amount;

  const billingItems = items && items.length > 0 ? items : [
    { description: `${planName} Subscription`, qty: 1, amount: displayAmount }
  ];

  const contentHtml = `
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Your Tiwlo receipt
    </h1>

    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 20px; color: #5f6368; text-align: center;">
      Thank you for your business. Here is a summary of your recent transaction.
    </p>

    <!-- Amount & Status Summary Card -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px; text-align: center; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
          <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</div>
          <div style="font-size: 32px; font-weight: 500; color: #202124; line-height: 38px; margin-bottom: 8px;">
            ${currencySymbol}${displayAmount}
          </div>
          <div>
            <span style="display: inline-block; background-color: #e6f4ea; color: #137333; font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 4px;">
              Paid
            </span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Invoice Details Meta Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 22px; margin-bottom: 24px; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
      <tr>
        <td style="padding: 4px 0; color: #70757a; width: 120px;">Invoice number</td>
        <td style="padding: 4px 0; color: #202124; font-weight: 500; font-family: 'Google Sans', Roboto, Consolas, monospace;">${invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Invoice date</td>
        <td style="padding: 4px 0; color: #202124;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Store / Account</td>
        <td style="padding: 4px 0; color: #202124;">${storeName || name}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; color: #70757a;">Payment method</td>
        <td style="padding: 4px 0; color: #202124;">${paymentMethod}</td>
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
            <td style="padding: 10px 0; color: #202124;">${item.description || item.name}</td>
            <td align="center" style="padding: 10px 8px; color: #5f6368;">${item.qty || 1}</td>
            <td align="right" style="padding: 10px 0; color: #202124; font-weight: 500;">${currencySymbol}${typeof item.amount === 'number' ? item.amount.toFixed(2) : item.amount}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="2" style="padding: 12px 0 0 0; color: #202124; font-weight: 500; font-size: 14px;">Total</td>
          <td align="right" style="padding: 12px 0 0 0; color: #202124; font-weight: 500; font-size: 14px;">${currencySymbol}${displayAmount}</td>
        </tr>
      </tbody>
    </table>

    <!-- Primary Action Button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td align="center">
          <a href="${actionUrl}" target="_blank" style="background-color: #1a73e8; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 24px; border-radius: 4px; display: inline-block; font-family: 'Google Sans', Roboto, Arial, sans-serif;">
            View invoice
          </a>
        </td>
      </tr>
    </table>

    <div style="margin-top: 16px; padding: 14px 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
      <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
        Need to update your billing details or download official tax invoices? You can manage your subscription settings anytime in your Tiwlo account console.
      </p>
    </div>
  `;

  return renderBaseEmail({
    title: `Your Tiwlo receipt [${invoiceNumber}]`,
    recipientEmail: to,
    contentHtml,
    preheader: `Your payment of ${currencySymbol}${displayAmount} for ${planName} was successful. Invoice ${invoiceNumber}.`
  });
}
