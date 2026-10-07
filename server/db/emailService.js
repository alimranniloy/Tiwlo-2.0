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
import crypto from 'crypto';
import { PLATFORM_CONFIG, getPlatformUrl, getSubdomain } from '../config/platformConfig.js';
import { getPgPool, queryPg } from './postgres.js';
import { listEmailDeliveries, recordEmailDelivery } from './securityPersistence.js';

import {
  renderBaseEmail,
  renderTwoFactorEmail,
  renderSignupVerificationEmail,
  renderPasswordResetEmail,
  renderLoginAlertEmail,
  renderInvoiceEmail,
  renderAccountDisabledEmail,
  renderAccountRestoredEmail,
  renderContentRemovedEmail
} from '../email/index.js';

// Runtime email configuration is derived from environment and platform config.
export function getEmailConfig() {
  return {
    senderEmail: PLATFORM_CONFIG.noreplyEmail,
    senderName: PLATFORM_CONFIG.emailSenderName,
    replyTo: PLATFORM_CONFIG.noreplyEmail,
    accountType: 'system_noreply',
    storage: 'postgresql_with_90_day_retention',
    inboundPolicy: 'registered_mailboxes_only',
    smtp: {
      provider: process.env.SMTP_PROVIDER || 'local_postfix',
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: Number.parseInt(process.env.SMTP_PORT || '25', 10),
      secure: process.env.SMTP_SECURE === 'true',
      ignoreTLS: true,
      tls: {
        rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
      }
    },
    dnsRecords: {
      mx: { host: getSubdomain(PLATFORM_CONFIG.mtaSubdomain), priority: 10 },
      spf: `v=spf1 mx ip4:${PLATFORM_CONFIG.serverIpv4} ${PLATFORM_CONFIG.dnsSpfPolicy}`,
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
// CRYPTOGRAPHIC OTP STORE
// ==========================================
function hashOtpValue(value) {
  const secret = process.env.SECURITY_SECRET;
  if (!secret) throw new Error('SECURITY_SECRET must be configured for OTP challenges.');
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

export async function generateSecureOtp(email, type = 'login_2fa', expiryMinutes = 10) {
  const cleanEmail = email.trim().toLowerCase();
  const code = crypto.randomInt(100000, 999999).toString();
  const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  await queryPg(
    `INSERT INTO system_otp_challenges (token_hash, email, challenge_type, code_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [hashOtpValue(token), cleanEmail, type, hashOtpValue(`${token}:${code}`), expiresAt]
  );
  await queryPg('DELETE FROM system_otp_challenges WHERE expires_at < CURRENT_TIMESTAMP');
  return { code, token, expiresAt: expiresAt.getTime() };
}

export async function verifySecureOtp(token, inputCode, expectedType = 'login_2fa') {
  if (!token) return { valid: false, error: 'Verification token is required' };
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL pool is unavailable for OTP verification.');
  const client = await pool.connect();
  const cleanInput = (inputCode || '').toString().trim().replace(/\s+/g, '');
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT email, challenge_type, code_hash, attempts, max_attempts, expires_at
       FROM system_otp_challenges WHERE token_hash = $1 FOR UPDATE`,
      [hashOtpValue(token)]
    );
    const record = rows[0];
    if (!record) {
      await client.query('COMMIT');
      return { valid: false, error: 'Invalid or expired verification session' };
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      await client.query('DELETE FROM system_otp_challenges WHERE token_hash = $1', [hashOtpValue(token)]);
      await client.query('COMMIT');
      return { valid: false, error: 'Verification code has expired. Please request a new one.' };
    }
    if (record.challenge_type !== expectedType) {
      await client.query('COMMIT');
      return { valid: false, error: 'Mismatched verification context' };
    }
    if (record.attempts >= record.max_attempts) {
      await client.query('DELETE FROM system_otp_challenges WHERE token_hash = $1', [hashOtpValue(token)]);
      await client.query('COMMIT');
      return { valid: false, error: 'Maximum verification attempts exceeded. Please request a new code.' };
    }
    const expectedHash = Buffer.from(record.code_hash, 'hex');
    const actualHash = Buffer.from(hashOtpValue(`${token}:${cleanInput}`), 'hex');
    if (expectedHash.length !== actualHash.length || !crypto.timingSafeEqual(expectedHash, actualHash)) {
      const update = await client.query(
        `UPDATE system_otp_challenges SET attempts = attempts + 1
         WHERE token_hash = $1 RETURNING attempts, max_attempts`,
        [hashOtpValue(token)]
      );
      const remaining = Math.max(0, update.rows[0].max_attempts - update.rows[0].attempts);
      if (remaining === 0) {
        await client.query('DELETE FROM system_otp_challenges WHERE token_hash = $1', [hashOtpValue(token)]);
      }
      await client.query('COMMIT');
      return { valid: false, error: `Invalid 6-digit code. ${remaining} attempt(s) remaining.` };
    }
    await client.query('DELETE FROM system_otp_challenges WHERE token_hash = $1', [hashOtpValue(token)]);
    await client.query('COMMIT');
    return { valid: true, email: record.email };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getOtpSession(token) {
  if (!token) return null;
  const { rows } = await queryPg(
    `SELECT email, challenge_type AS type, attempts, max_attempts, expires_at
     FROM system_otp_challenges
     WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
    [hashOtpValue(token)]
  );
  return rows[0] || null;
}

export async function deleteOtpSession(token) {
  if (!token) return;
  await queryPg('DELETE FROM system_otp_challenges WHERE token_hash = $1', [hashOtpValue(token)]);
}

export async function createSecureGrant(email, type, expiryMinutes = 15) {
  const token = `grant_${crypto.randomBytes(32).toString('hex')}`;
  await queryPg(
    `INSERT INTO system_otp_challenges
       (token_hash, email, challenge_type, code_hash, max_attempts, expires_at)
     VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP + ($5 * INTERVAL '1 minute'))`,
    [hashOtpValue(token), String(email).trim().toLowerCase(), type, hashOtpValue(token), expiryMinutes]
  );
  return token;
}

export async function consumeSecureGrant(token, type) {
  if (!token) return null;
  const { rows } = await queryPg(
    `DELETE FROM system_otp_challenges
     WHERE token_hash = $1 AND challenge_type = $2 AND expires_at > CURRENT_TIMESTAMP
     RETURNING email`,
    [hashOtpValue(token), type]
  );
  return rows[0]?.email || null;
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
    return nodemailer.createTransport({
      host: '127.0.0.1',
      port,
      secure: false,
      ignoreTLS: isPort25,
      tls: { rejectUnauthorized: false },
      // NEVER provide invalid auth on trusted local loopback port 25
      ...(user && pass && !isPort25 ? { auth: { user, pass } } : {}),
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000
    });
  }

  // Standard External SMTP / SSL / TLS Relay (Brevo, Resend, SendGrid, Custom)
  return nodemailer.createTransport({
    host,
    port: Number.parseInt(process.env.SMTP_PORT || smtp.port || '587', 10),
    secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : (smtp.secure === true),
    ...(user && pass ? { auth: { user, pass } } : {}),
    tls: smtp.tls || { rejectUnauthorized: false },
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
      const fallback = nodemailer.createTransport({
        host: '127.0.0.1',
        port: 25,
        secure: false,
        ignoreTLS: true,
        tls: { rejectUnauthorized: false }
      });
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
      ...config.antiSpam.headerHeaders,
      'X-Tiwlo-Mail-Type': type,
      'X-Mailer': 'Tiwlo Core Security v2.5',
      'List-Unsubscribe': `<mailto:${config.senderEmail}?subject=unsubscribe>`
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
      const fallbackTransporter = nodemailer.createTransport({
        host: '127.0.0.1',
        port: 25,
        secure: false,
        ignoreTLS: true,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000
      });
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
    planName,
    paymentMethod,
    storeName,
    items,
    actionUrl
  });

  return sendTiwloEmail({
    to,
    subject: `Your Tiwlo receipt [${invoiceNumber || 'INV'}]`,
    html,
    text: `Your invoice ${invoiceNumber} for amount ${currency || '$'}${amount} has been issued.`,
    type: 'invoice',
    metadata: { invoiceNumber, amount, planName }
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
