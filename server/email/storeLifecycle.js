import { renderBaseEmail } from './baseTemplate.js';
import { getPlatformUrl } from '../config/platformConfig.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function safeUrl(value, fallback = getPlatformUrl()) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? esc(parsed.href) : esc(fallback);
  } catch {
    return esc(fallback);
  }
}

function formatUtc(value) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toUTCString() : 'N/A';
}

export function renderStoreCreatedEmail({
  to,
  name,
  storeName,
  subdomain,
  planName = 'Free Starter',
  storeUrl,
  dashboardUrl = getPlatformUrl('dashboard')
}) {
  const safeStore = esc(storeName || 'Your Store');
  const safeSubdomain = esc(subdomain || '');
  const safePlan = esc(planName || 'Free Starter');
  const safeName = esc(name || 'Merchant');
  const safeStoreUrl = safeUrl(storeUrl || (subdomain ? `https://${subdomain}` : getPlatformUrl()));
  const safeDashUrl = safeUrl(dashboardUrl);

  const contentHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Your Tiwlo store is ready
    </h1>
    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Hello ${safeName}, your new online store <strong>${safeStore}</strong> has been created and provisioned on Tiwlo.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #3c4043;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 4px 0; color: #5f6368; width: 40%;">Store name</td>
              <td style="padding: 4px 0; color: #202124; font-weight: 500; text-align: right;">${safeStore}</td>
            </tr>
            ${safeSubdomain ? `
            <tr>
              <td style="padding: 4px 0; color: #5f6368;">Subdomain</td>
              <td style="padding: 4px 0; color: #202124; font-weight: 500; text-align: right;">${safeSubdomain}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 4px 0; color: #5f6368;">Plan</td>
              <td style="padding: 4px 0; color: #202124; font-weight: 500; text-align: right;">${safePlan}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${safeStoreUrl}" target="_blank" style="display: inline-block; background-color: #1ed760; color: #000000; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px; margin-right: 8px;">
            Visit storefront
          </a>
          <a href="${safeDashUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #202124; border: 1px solid #dadce0; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 20px; border-radius: 6px;">
            Open dashboard
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderBaseEmail({
    title: `Store Created - ${storeName || 'Tiwlo'}`,
    recipientEmail: to,
    contentHtml,
    preheader: `${storeName || 'Your store'} is now active on ${subdomain || 'Tiwlo'}.`
  });
}

export function renderStoreGracePeriodEmail({
  to,
  name,
  storeName,
  subdomain,
  planName = 'Store Subscription',
  amountDue = 0,
  currency = 'USD',
  graceEndsAt,
  billingUrl = getPlatformUrl('billing')
}) {
  const safeStore = esc(storeName || 'Your Store');
  const safeSubdomain = esc(subdomain || '');
  const safePlan = esc(planName || 'Store Subscription');
  const safeAmount = `${esc(currency)} ${Number(amountDue || 0).toFixed(2)}`;
  const safeDeadline = esc(formatUtc(graceEndsAt));
  const safeBillingUrl = safeUrl(billingUrl);

  const contentHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Action required: 3-day grace period active
    </h1>
    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Hello ${esc(name || 'Merchant')}, your subscription for <strong>${safeStore}</strong> has expired and automatic billing could not deduct <strong>${safeAmount}</strong> due to insufficient funds.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef7e0; border: 1px solid #f6d57a; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #3c4043;">
          <div><strong>Store:</strong> ${safeStore} ${safeSubdomain ? `(${safeSubdomain})` : ''}</div>
          <div><strong>Plan:</strong> ${safePlan} (${safeAmount})</div>
          <div><strong>Grace period ends:</strong> ${safeDeadline}</div>
          <div style="margin-top: 8px; color: #5f6368;">
            Add funds before the deadline to keep your store active. If payment is not completed within 3 days, your storefront will be suspended.
          </div>
        </td>
      </tr>
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #1ed760; color: #000000; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px;">
            Add funds &amp; renew store
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderBaseEmail({
    title: `3-Day Grace Period Notice - ${storeName || 'Tiwlo Store'}`,
    recipientEmail: to,
    contentHtml,
    preheader: `Add funds within 3 days to prevent suspension of ${storeName || 'your store'}.`
  });
}

export function renderStoreSuspendedEmail({
  to,
  name,
  storeName,
  subdomain,
  planName = 'Store Subscription',
  suspendedAt,
  scheduledDeletionAt,
  billingUrl = getPlatformUrl('billing')
}) {
  const safeStore = esc(storeName || 'Your Store');
  const safeSubdomain = esc(subdomain || '');
  const safeSuspended = esc(formatUtc(suspendedAt));
  const safeDeletion = esc(formatUtc(scheduledDeletionAt));
  const safeBillingUrl = safeUrl(billingUrl);

  const contentHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Store suspended due to unpaid subscription
    </h1>
    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Hello ${esc(name || 'Merchant')}, the 3-day grace period for <strong>${safeStore}</strong> (${esc(planName)}) has ended without sufficient funds. Your storefront is now suspended.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fce8e6; border: 1px solid #f6aea9; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #3c4043;">
          <div><strong>Store:</strong> ${safeStore} ${safeSubdomain ? `(${safeSubdomain})` : ''}</div>
          <div><strong>Suspended on:</strong> ${safeSuspended}</div>
          <div><strong>Permanent deletion date (180 days):</strong> ${safeDeletion}</div>
          <div style="margin-top: 8px; color: #5f6368;">
            All store database records, products, and uploaded media files will be permanently deleted after 180 days unless renewed. Your Tiwlo user account will remain intact.
          </div>
        </td>
      </tr>
    </table>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #1ed760; color: #000000; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px;">
            Renew subscription to reactivate
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderBaseEmail({
    title: `Store Suspended - ${storeName || 'Tiwlo Store'}`,
    recipientEmail: to,
    contentHtml,
    preheader: `${storeName || 'Your store'} is suspended and scheduled for permanent deletion in 180 days.`
  });
}

export function renderStoreDeletedEmail({
  to,
  name,
  storeName,
  subdomain,
  deletedAt,
  dashboardUrl = getPlatformUrl('dashboard')
}) {
  const safeStore = esc(storeName || 'Store');
  const safeSubdomain = esc(subdomain || '');
  const safeDeletedAt = esc(formatUtc(deletedAt));
  const safeDashUrl = safeUrl(dashboardUrl);

  const contentHtml = `
    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Suspended store permanently deleted
    </h1>
    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Hello ${esc(name || 'Merchant')}, after 180 days of suspension without renewal, <strong>${safeStore}</strong> ${safeSubdomain ? `(${safeSubdomain})` : ''} and its store database records and uploaded images have been permanently removed on ${safeDeletedAt}.
    </p>
    <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 20px; color: #5f6368; text-align: center;">
      Your Tiwlo account remains active and unaffected. You can launch a new store at any time from your workspace.
    </p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${safeDashUrl}" target="_blank" style="display: inline-block; background-color: #202124; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 22px; border-radius: 6px;">
            Go to Tiwlo workspace
          </a>
        </td>
      </tr>
    </table>
  `;

  return renderBaseEmail({
    title: `Store Permanently Deleted - ${storeName || 'Tiwlo'}`,
    recipientEmail: to,
    contentHtml,
    preheader: `${storeName || 'Your suspended store'} was deleted after 180 days. Your Tiwlo user account remains active.`
  });
}
