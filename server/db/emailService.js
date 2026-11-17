/**
 * Tiwlo Enterprise Email & OTP Security Service
 * 
 * Manages:
 * - Configured no-reply SMTP delivery
 * - Two-Step Verification (2FA) OTP lifecycle
 * - Password reset codes & Signup verification
 * - Real-time Login Activity notifications
 * - Unlimited email outbox storage for auditing & future Admin Dashboard
 * - High-deliverability anti-spam header alignment (SPF, DMARC, Google Verified)
 */

import nodemailer from 'nodemailer';
import { isIPv4 } from 'node:net';
import { PLATFORM_CONFIG, getPlatformUrl, getSubdomain } from '../config/platformConfig.js';
import { listEmailDeliveries, recordEmailDelivery } from './securityPersistence.js';
import {
  completeMfaLoginWithRust,
  completeMfaSetupWithRust,
  completeEmailVerificationWithRust,
  consumeSecureGrantWithRust as consumeSecureGrant,
  createSecureGrantWithRust as createSecureGrant,
  deleteOtpSessionWithRust as deleteOtpSession,
  generateOtpWithRust as generateSecureOtp,
  getOtpSessionWithRust as getOtpSession,
  verifyOtpWithRust as verifySecureOtp
} from '../security/rustAuthSessionClient.js';
export {
  completeMfaLoginWithRust,
  completeMfaSetupWithRust,
  completeEmailVerificationWithRust,
  consumeSecureGrant,
  createSecureGrant,
  deleteOtpSession,
  generateSecureOtp,
  getOtpSession,
  verifySecureOtp
};

import {
  renderBaseEmail,
  renderTwoFactorEmail,
  renderSignupVerificationEmail,
  renderPasswordResetEmail,
  renderLoginAlertEmail,
  renderCloudPaymentStartedEmail,
  renderCloudPaymentReminderEmail,
  renderCloudPaymentCancelledEmail,
  renderInvoiceEmail,
  renderAccountDisabledEmail,
  renderAccountRestoredEmail,
  renderIdentityVerificationRequiredEmail,
  renderIdentityVerificationCompleteEmail,
  renderContentRemovedEmail,
  renderStoreCreatedEmail,
  renderStoreGracePeriodEmail,
  renderStoreSuspendedEmail,
  renderStoreDeletedEmail
} from '../email/index.js';

// Runtime email configuration is derived from environment and platform config.
// Note: External SMTP relays and non-25 submission ports verify TLS certificates by default.
// Set SMTP_TLS_REJECT_UNAUTHORIZED=false only if using a custom internal relay with a self-signed cert.
export function getEmailConfig() {
  const host = process.env.SMTP_HOST || '127.0.0.1';
  const port = Number.parseInt(process.env.SMTP_PORT || '25', 10);
  const isLocalPort25 = (host === '127.0.0.1' || host === 'localhost') && port === 25;

  return {
    senderEmail: PLATFORM_CONFIG.noreplyEmail,
    senderName: PLATFORM_CONFIG.emailSenderName,
    replyTo: PLATFORM_CONFIG.noreplyEmail,
    accountType: 'system_noreply',
    storage: 'postgresql_with_90_day_retention',
    inboundPolicy: 'registered_mailboxes_only',
    smtp: {
      provider: process.env.SMTP_PROVIDER || 'local_postfix',
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      ignoreTLS: isLocalPort25,
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
        ...(process.env.SMTP_TLS_SERVERNAME
          ? { servername: process.env.SMTP_TLS_SERVERNAME }
          : {})
      }
    },
    dnsRecords: {
      mx: { host: getSubdomain(PLATFORM_CONFIG.mtaSubdomain), priority: 10 },
      spf: `v=spf1 mx ${isIPv4(PLATFORM_CONFIG.serverIpv4) ? `ip4:${PLATFORM_CONFIG.serverIpv4} ` : ''}${PLATFORM_CONFIG.dnsSpfPolicy}`,
      dmarc: `v=DMARC1; p=${PLATFORM_CONFIG.dnsDmarcPolicy}; rua=mailto:${PLATFORM_CONFIG.securityEmail}; pct=100; sp=${PLATFORM_CONFIG.dnsDmarcPolicy}`,
      dkimSelector: `${PLATFORM_CONFIG.dkimSelector}._domainkey.${PLATFORM_CONFIG.primaryDomain}`
    },
    antiSpam: {
      googleVerified: true,
      headerHeaders: {
        'X-Entity-Ref-ID': 'tiwlo-security-system',
        'Precedence': 'bulk',
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All'
      }
    },
    updatedAt: new Date().toISOString()
  };
}

// ==========================================
// EMAIL TEMPLATES & DISPATCH ENGINE
// ==========================================

/**
 * Creates ultra-modern, high-security HTML email layout
 */
function buildHtmlEmail({ title, recipientEmail, mainMessage, otpCode, details, securityTip }) {
  let contentHtml = `
    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      ${title || 'Tiwlo Notification'}
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      ${mainMessage || ''}
    </p>
  `;

  if (otpCode) {
    contentHtml += `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 24px 0;">
        <tr>
          <td align="center">
            <div style="display: inline-block; background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; padding: 16px 32px; text-align: center;">
              <span class="code-display" style="font-family: 'Google Sans', Roboto, Consolas, monospace; font-size: 32px; font-weight: 500; letter-spacing: 6px; color: #1f1f1f; line-height: 1;">
                ${otpCode}
              </span>
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  if (details && details.length > 0) {
    contentHtml += `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #dadce0; border-radius: 8px; margin: 20px 0;">
        <tr>
          <td style="padding: 16px 20px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 22px;">
              ${details.map(d => `
                <tr>
                  <td style="padding: 3px 0; color: #70757a; width: 100px;">${d.label}</td>
                  <td style="padding: 3px 0; color: #202124;">${d.value}</td>
                </tr>
              `).join('')}
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  if (securityTip) {
    contentHtml += `
      <div style="margin-top: 20px; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e8eaed;">
        <p style="margin: 0; font-size: 12px; line-height: 18px; color: #5f6368;">
          ${securityTip}
        </p>
      </div>
    `;
  }

  return renderBaseEmail({
    title,
    recipientEmail,
    contentHtml
  });
}

function resolveSmtpTlsOptions(smtpTls) {
  // Enforce certificate verification by default; allow explicit opt-out via
  // SMTP_TLS_REJECT_UNAUTHORIZED=false for self-signed custom mail relays.
  const defaultRejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
  const baseTls = {
    rejectUnauthorized: defaultRejectUnauthorized,
    ...(process.env.SMTP_TLS_SERVERNAME
      ? { servername: process.env.SMTP_TLS_SERVERNAME }
      : {})
  };
  if (smtpTls && typeof smtpTls === 'object') {
    return {
      ...baseTls,
      ...smtpTls,
      rejectUnauthorized:
        smtpTls.rejectUnauthorized !== undefined
          ? Boolean(smtpTls.rejectUnauthorized)
          : defaultRejectUnauthorized
    };
  }
  return baseTls;
}

function createLocalPostfixFallbackTransport() {
  // Unencrypted local Postfix loopback on 127.0.0.1:25 (ignoreTLS skips STARTTLS handshake).
  return nodemailer.createTransport({
    host: '127.0.0.1',
    port: 25,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  });
}

/**
 * Core SMTP / Nodemailer Transporter
 */
export function createTransporter(config = getEmailConfig()) {
  const smtp = config.smtp || {};
  const provider = process.env.SMTP_PROVIDER || smtp.provider;
  const host = process.env.SMTP_HOST || smtp.host;
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  // If provider is gmail or host is smtp.gmail.com
  if (provider === 'gmail' || (host && host.includes('gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  // Local Postfix Loopback (127.0.0.1:25) - Standard for Linux VPS
  const isLocal = !host || host === '127.0.0.1' || host === 'localhost' ||
    (provider === 'local_postfix' && !process.env.SMTP_HOST);
  const port = Number.parseInt(process.env.SMTP_PORT || smtp.port || (isLocal ? '25' : '587'), 10);
  const isPort25 = port === 25;

  if (isLocal) {
    if (isPort25) {
      // Unencrypted local Postfix loopback on 127.0.0.1:25; never send auth on trusted port 25.
      return createLocalPostfixFallbackTransport();
    }
    return nodemailer.createTransport({
      host: '127.0.0.1',
      port,
      secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : (smtp.secure === true),
      ignoreTLS: false,
      tls: resolveSmtpTlsOptions(smtp.tls),
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000
    });
  }

  // Standard external SMTP / SSL / TLS relay.
  return nodemailer.createTransport({
    host,
    port: Number.parseInt(process.env.SMTP_PORT || smtp.port || '587', 10),
    secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : (smtp.secure === true),
    ...(user && pass ? { auth: { user, pass } } : {}),
    tls: resolveSmtpTlsOptions(smtp.tls),
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  });
}

/**
 * Live SMTP Connection Diagnostic Verifier
 */
export async function verifySmtpConnection() {
  const config = getEmailConfig();
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { ok: true, host: config.smtp?.host, port: config.smtp?.port };
  } catch (err) {
    // If primary failed, test fallback local postfix loopback
    try {
      const fallback = createLocalPostfixFallbackTransport();
      await fallback.verify();
      return { ok: true, host: '127.0.0.1', port: 25, note: 'Connected via Postfix loopback fallback' };
    } catch (fbErr) {
      return { ok: false, error: `${err.message} (Fallback: ${fbErr.message})`, host: config.smtp?.host, port: config.smtp?.port };
    }
  }
}

/**
 * Universal Mail Dispatcher
 */
export async function sendTiwloEmail({
  to,
  cc,
  bcc,
  attachments,
  fromEmail,
  fromName,
  replyTo,
  headers: customHeaders = {},
  subject,
  html,
  text,
  type = 'general',
  metadata = {}
}) {
  const config = getEmailConfig();
  const cleanTo = (to || '').trim();
  const cleanFromEmail = String(fromEmail || config.senderEmail).trim().toLowerCase();
  const cleanReplyTo = String(replyTo || config.replyTo).trim().toLowerCase();
  const isUserMail = type === 'user_mail';
  const domainSuffix = `@${PLATFORM_CONFIG.primaryDomain}`;
  if (!cleanFromEmail.endsWith(domainSuffix) || !cleanReplyTo.endsWith(domainSuffix) ||
      !/^[^\s@]+@[^\s@]+$/.test(cleanFromEmail) || !/^[^\s@]+@[^\s@]+$/.test(cleanReplyTo)) {
    throw new TypeError('Email sender must be a valid address on the configured Tiwlo domain.');
  }
  const cleanFromName = String(fromName || config.senderName).replace(/[\r\n"]/g, ' ').slice(0, 120);

  const mailOptions = {
    from: { name: cleanFromName, address: cleanFromEmail },
    to: cleanTo,
    replyTo: cleanReplyTo,
    ...(cc?.length ? { cc } : {}),
    ...(bcc?.length ? { bcc } : {}),
    ...(attachments?.length ? { attachments } : {}),
    subject,
    html,
    text: text || subject,
    headers: {
      ...(!isUserMail ? config.antiSpam.headerHeaders : {}),
      'X-Tiwlo-Mail-Type': type,
      'X-Mailer': isUserMail ? 'Tiwlo Mail' : 'Tiwlo Core Security v2.5',
      ...(customHeaders && typeof customHeaders === 'object' ? customHeaders : {})
    }
  };

  let deliveryStatus = type === 'user_mail' ? 'queued' : 'delivered';
  let errorMsg = null;
  let messageId = null;

  try {
    const transporter = createTransporter(config);
    const info = await transporter.sendMail(mailOptions);
    if (Array.isArray(info?.accepted) && info.accepted.length === 0) {
      throw new Error('SMTP server rejected all message recipients.');
    }
    messageId = info?.messageId || `msg_${Date.now()}`;
    console.log(`✉️ [EmailService] Successfully sent ${type} to ${cleanTo} (${messageId})`);
  } catch (err) {
    console.warn(`⚠️ [EmailService] Primary transport failed (${err.code || err.name || 'unknown'}); trying configured fallback.`);
    try {
      const fallbackTransporter = createLocalPostfixFallbackTransport();
      const info = await fallbackTransporter.sendMail(mailOptions);
      if (Array.isArray(info?.accepted) && info.accepted.length === 0) {
        throw new Error('Fallback SMTP server rejected all message recipients.');
      }
      messageId = info?.messageId || `msg_${Date.now()}`;
      deliveryStatus = type === 'user_mail' ? 'queued' : 'delivered';
      errorMsg = null;
      console.log(`✉️ [EmailService] Successfully sent ${type} to ${cleanTo} via fallback Postfix loopback (${messageId})`);
    } catch (fallbackErr) {
      deliveryStatus = 'failed';
      errorMsg = `primary:${err.code || err.name || 'unknown'};fallback:${fallbackErr.code || fallbackErr.name || 'unknown'}`;
      console.error('❌ [EmailService] All configured email transports failed:', errorMsg);
    }
  }

  await recordEmailDelivery({
    recipient: cleanTo,
    sender: cleanFromEmail,
    subject,
    type,
    status: deliveryStatus,
    messageId,
    error: errorMsg,
    metadata
  });

  return {
    success: deliveryStatus !== 'failed',
    delivered: deliveryStatus === 'delivered',
    status: deliveryStatus,
    messageId,
    email: cleanTo,
    error: errorMsg,
    otpCode: null
  };
}

// ==========================================
// HIGH-LEVEL SECURITY EMAILS
// ==========================================

/**
 * 1. Two-Step Verification (2FA) OTP Email
 */
export async function sendTwoFactorOtpEmail({ to, name, code }) {
  const html = renderTwoFactorEmail({ to, name, code });

  return sendTiwloEmail({
    to,
    subject: `${code} is your Tiwlo 2-Step Verification code`,
    html,
    text: `Your Tiwlo 2-Step Verification code is: ${code}. Valid for 10 minutes.`,
    type: 'login_2fa',
    metadata: { otpCode: code, recipientName: name }
  });
}

/**
 * 2. Signup Email Verification OTP
 */
export async function sendSignupVerificationOtpEmail({ to, name, code }) {
  const html = renderSignupVerificationEmail({ to, name, code });

  return sendTiwloEmail({
    to,
    subject: `${code} is your Tiwlo verification code`,
    html,
    text: `Welcome to Tiwlo! Your email verification code is: ${code}. Valid for 15 minutes.`,
    type: 'signup_verify',
    metadata: { otpCode: code, recipientName: name }
  });
}

/**
 * 3. Password Reset OTP Email
 */
export async function sendPasswordResetOtpEmail({ to, name, code }) {
  const html = renderPasswordResetEmail({ to, name, code });

  return sendTiwloEmail({
    to,
    subject: `${code} is your Tiwlo password recovery code`,
    html,
    text: `Your Tiwlo password reset code is: ${code}. Valid for 15 minutes.`,
    type: 'forgot_password',
    metadata: { otpCode: code, recipientName: name }
  });
}

/**
 * 4. Login Activity Notification Alert
 */
export async function sendLoginActivityAlertEmail({ to, name, ip, userAgent, location, timestamp }) {
  const html = renderLoginAlertEmail({ to, name, ip, userAgent, location, timestamp });

  return sendTiwloEmail({
    to,
    subject: 'Security alert: New sign-in to your Tiwlo Account',
    html,
    text: `New sign-in detected on your Tiwlo account at ${timestamp || new Date().toISOString()} from IP ${ip || 'unknown'}.`,
    type: 'login_alert',
    metadata: { ip, userAgent, location }
  });
}

/**
 * 5. Invoice & Billing Receipt Email
 */
export async function sendInvoiceEmail({
  to,
  name,
  invoiceNumber,
  date,
  amount,
  currency,
  paymentStatus,
  planName,
  paymentMethod,
  storeName,
  items,
  actionUrl
}) {
  const html = renderInvoiceEmail({
    to,
    name,
    invoiceNumber,
    date,
    amount,
    currency,
    paymentStatus,
    planName,
    paymentMethod,
    storeName,
    items,
    actionUrl
  });

  return sendTiwloEmail({
    to,
    subject: `Your invoice [${invoiceNumber || 'INV'}]`,
    html,
    text: `Your invoice ${invoiceNumber} for ${currency || 'USD'} ${amount} has been issued. Payment status: ${paymentStatus || 'Paid'}.`,
    type: 'invoice',
    metadata: { invoiceNumber, amount, planName }
  });
}

export async function sendCloudPaymentStartedEmail({
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
  const html = renderCloudPaymentStartedEmail({
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
  });

  return sendTiwloEmail({
    to,
    subject: 'Continue your Tiwlo Cloud checkout',
    html,
    text: `A secure ${String(provider || '').toUpperCase()} checkout session was created for ${currency} ${Number(amount).toFixed(2)} (${creditCurrency} ${Number(creditAmount).toFixed(2)} in Cloud credits). Reference: ${reference}. This Tiwlo billing session expires at ${new Date(expiresAt).toUTCString()}. This email is not a payment receipt.`,
    type: 'cloud_payment_started',
    metadata: { reference, provider, amount, currency, expiresAt }
  });
}

export async function sendCloudPaymentReminderEmail({
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
  const html = renderCloudPaymentReminderEmail({
    to,
    name,
    provider,
    amount,
    currency,
    creditAmount,
    reference,
    invoiceUrl,
    expiresAt
  });
  return sendTiwloEmail({
    to,
    subject: 'Your Tiwlo Cloud checkout expires in 6 hours',
    html,
    text: `Your ${String(provider || '').toUpperCase()} Tiwlo Cloud checkout for ${currency} ${Number(amount).toFixed(2)} has not received verified confirmation and expires at ${new Date(expiresAt).toUTCString()}. Review invoice ${reference}: ${invoiceUrl}. If you already paid, wait for the provider confirmation.`,
    type: 'cloud_payment_reminder',
    metadata: { reference, provider, amount, currency, expiresAt }
  });
}

export async function sendCloudPaymentCancelledEmail({
  to,
  name,
  provider,
  amount,
  currency,
  reference,
  invoiceUrl
}) {
  const html = renderCloudPaymentCancelledEmail({
    to,
    name,
    provider,
    amount,
    currency,
    reference,
    invoiceUrl
  });
  return sendTiwloEmail({
    to,
    subject: 'Your Tiwlo Cloud checkout was cancelled',
    html,
    text: `Your Tiwlo Cloud billing session ${reference} for ${currency} ${Number(amount).toFixed(2)} was cancelled. If payment was completed, its verified confirmation will still be applied. View billing: ${invoiceUrl}`,
    type: 'cloud_payment_cancelled',
    metadata: { reference, provider, amount, currency }
  });
}

/**
 * 6. Account Disabled Security Alert Email
 */
export async function sendAccountDisabledEmail({ to, name, reason, restoreUrl }) {
  const html = renderAccountDisabledEmail({ to, name, reason, restoreUrl });

  return sendTiwloEmail({
    to,
    subject: 'Your Tiwlo Account is disabled',
    html,
    text: `Your Tiwlo Account has been disabled due to a policy violation: ${reason || 'Terms of Service violation'}. Visit ${restoreUrl || getPlatformUrl('account-disabled')} to request a review.`,
    type: 'account_disabled',
    metadata: { recipientName: name, reason, restoreUrl }
  });
}

/**
 * 7. Account Restored Notice Email
 */
export async function sendAccountRestoredEmail({ to, name, checkupUrl }) {
  const html = renderAccountRestoredEmail({ to, name, checkupUrl });

  return sendTiwloEmail({
    to,
    subject: 'Your Tiwlo Account has been restored',
    html,
    text: `Good news. We reviewed your account and confirmed that access to your Tiwlo Account has been restored. You can now complete your security checkup and sign in at ${checkupUrl || getPlatformUrl('security-checkup')}`,
    type: 'account_restored',
    metadata: { recipientName: name, checkupUrl }
  });
}

export async function sendIdentityVerificationRequiredEmail({ to, name, identityUrl, reason = '' }) {
  const html = renderIdentityVerificationRequiredEmail({ to, name, identityUrl, reason });
  const reasonNote = String(reason || '').trim() ? ` Reason: ${String(reason).trim()}.` : '';
  return sendTiwloEmail({
    to,
    subject: 'Action required: verify your Tiwlo identity',
    html,
    text: `Identity verification is required before you can use your Tiwlo account.${reasonNote} Sign in and complete verification to restore access: ${identityUrl || getPlatformUrl('identity-required')}`,
    type: 'identity_verification_required',
    metadata: { recipientName: name, identityUrl, reason: reason || null }
  });
}

export async function sendIdentityVerificationCompleteEmail({ to, name, accountUrl }) {
  const html = renderIdentityVerificationCompleteEmail({ to, name, accountUrl });
  return sendTiwloEmail({
    to,
    subject: 'Your Tiwlo account is verified and unlocked',
    html,
    text: `Your identity check was successful and your Tiwlo account is unlocked. Continue to your account: ${accountUrl || getPlatformUrl('dashboard')}`,
    type: 'identity_verification_complete',
    metadata: { recipientName: name, accountUrl }
  });
}

export const identityVerificationEmailNotifications = {
  required: sendIdentityVerificationRequiredEmail,
  completed: sendIdentityVerificationCompleteEmail
};

/**
 * 8. Notice of Content Removal Email
 */
export async function sendContentRemovedEmail({ to, name, contentType, policyName, reason, appealUrl }) {
  const html = renderContentRemovedEmail({ to, name, contentType, policyName, reason, appealUrl });

  return sendTiwloEmail({
    to,
    subject: `Notice: Content removed from your account - ${policyName || 'Platform Safety'}`,
    html,
    text: `Notice: Your ${contentType || 'content'} was removed because it violated Tiwlo's ${policyName || 'Acceptable Use Policy'}. Reason: ${reason || 'Safety compliance violation'}. Visit ${appealUrl || getPlatformUrl('help-support')} to review or appeal.`,
    type: 'content_removed',
    metadata: { recipientName: name, contentType, policyName, reason, appealUrl }
  });
}

export async function sendStoreCreatedEmail({ to, name, storeName, subdomain, planName, storeUrl, dashboardUrl }) {
  const html = renderStoreCreatedEmail({ to, name, storeName, subdomain, planName, storeUrl, dashboardUrl });
  return sendTiwloEmail({
    to,
    subject: `Your Tiwlo store "${storeName || 'New Store'}" is live`,
    html,
    text: `Hello ${name || 'Merchant'}, your store "${storeName}" (${subdomain || ''}) is ready on plan ${planName || 'Free Starter'}. Visit ${storeUrl || getPlatformUrl()} or manage it at ${dashboardUrl || getPlatformUrl('dashboard')}.`,
    type: 'store_created',
    metadata: { storeName, subdomain, planName }
  });
}

export async function sendStoreGracePeriodEmail({ to, name, storeName, subdomain, planName, amountDue, currency = 'USD', graceEndsAt, billingUrl }) {
  const html = renderStoreGracePeriodEmail({ to, name, storeName, subdomain, planName, amountDue, currency, graceEndsAt, billingUrl });
  return sendTiwloEmail({
    to,
    subject: `Action required: 3-day grace period for ${storeName || 'your Tiwlo store'}`,
    html,
    text: `Your subscription for ${storeName} (${subdomain || ''}) expired and auto-renewal could not charge ${currency} ${Number(amountDue || 0).toFixed(2)}. Add funds before ${new Date(graceEndsAt).toUTCString()} to avoid store suspension.`,
    type: 'store_grace_period',
    metadata: { storeName, subdomain, planName, amountDue, currency, graceEndsAt }
  });
}

export async function sendStoreSuspendedEmail({ to, name, storeName, subdomain, planName, suspendedAt, scheduledDeletionAt, billingUrl }) {
  const html = renderStoreSuspendedEmail({ to, name, storeName, subdomain, planName, suspendedAt, scheduledDeletionAt, billingUrl });
  return sendTiwloEmail({
    to,
    subject: `Store suspended: ${storeName || 'Tiwlo Store'} (180-day deletion notice)`,
    html,
    text: `Your store ${storeName} (${subdomain || ''}) has been suspended after the 3-day grace period. All store data and media files will be permanently deleted on ${new Date(scheduledDeletionAt).toUTCString()} (180 days) unless renewed. Your Tiwlo user account stays active.`,
    type: 'store_suspended',
    metadata: { storeName, subdomain, planName, suspendedAt, scheduledDeletionAt }
  });
}

export async function sendStoreDeletedEmail({ to, name, storeName, subdomain, deletedAt, dashboardUrl }) {
  const html = renderStoreDeletedEmail({ to, name, storeName, subdomain, deletedAt, dashboardUrl });
  return sendTiwloEmail({
    to,
    subject: `Store permanently deleted after 180 days: ${storeName || 'Tiwlo Store'}`,
    html,
    text: `Your suspended store ${storeName} (${subdomain || ''}) and its database records and uploaded images were permanently deleted on ${new Date(deletedAt).toUTCString()} after 180 days without renewal. Your Tiwlo user account remains intact.`,
    type: 'store_deleted',
    metadata: { storeName, subdomain, deletedAt }
  });
}

export async function sendServicePaymentFailureEmail({
  to,
  name,
  serviceType = 'discord',
  planName = 'Subscription Plan',
  amountDue = 0,
  currency = 'USD',
  reason = '',
  failureCount = 1,
  billingUrl = getPlatformUrl('billing')
} = {}) {
  const cleanTo = typeof to === 'string' ? to.trim() : '';
  if (!cleanTo) {
    return { success: false, skipped: true, reason: 'missing_recipient' };
  }
  const serviceLabel = String(serviceType || '').toLowerCase() === 'whatsapp'
    ? 'WhatsApp Automation'
    : 'Discord Bot Manager';
  const formattedAmount = `${currency} ${Number(amountDue || 0).toFixed(2)}`;
  const safeReason = String(reason || 'Insufficient verified billing credits.').trim();
  const safeUrl = (() => {
    try {
      const parsed = new URL(billingUrl || getPlatformUrl('billing'));
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : getPlatformUrl('billing');
    } catch {
      return getPlatformUrl('billing');
    }
  })();
  const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);

  const html = buildHtmlEmail({
    title: `Action required: ${escapeText(serviceLabel)} payment failed`,
    recipientEmail: cleanTo,
    mainMessage: `Hello ${escapeText(name || 'Customer')}, we could not process <strong>${escapeText(formattedAmount)}</strong> for your <strong>${escapeText(serviceLabel)}</strong> (${escapeText(planName)}) subscription. Top up your Tiwlo Credits to keep your service active.`,
    details: [
      { label: 'Service', value: escapeText(serviceLabel) },
      { label: 'Plan', value: escapeText(planName) },
      { label: 'Amount Due', value: escapeText(formattedAmount) },
      { label: 'Attempts', value: escapeText(String(failureCount)) },
      { label: 'Reason', value: escapeText(safeReason) }
    ],
    securityTip: `Visit your <a href="${escapeText(safeUrl)}" style="color: #1a73e8;">Tiwlo Billing Console</a> to add credits and reactivate your subscription.`
  });

  try {
    return await sendTiwloEmail({
      to: cleanTo,
      subject: `Action required: ${serviceLabel} payment failed (${formattedAmount})`,
      html,
      text: `Your ${serviceLabel} (${planName}) payment of ${formattedAmount} failed: ${safeReason}. Add credits at ${safeUrl}.`,
      type: 'service_payment_failed',
      metadata: { serviceType, planName, amountDue, currency, failureCount }
    });
  } catch (err) {
    return {
      success: false,
      error: err?.message || 'Failed to send service payment failure email'
    };
  }
}
