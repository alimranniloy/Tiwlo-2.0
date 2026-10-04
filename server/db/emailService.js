/**
 * Tiwlo Enterprise Email & OTP Security Service
 * 
 * Manages:
 * - noreply@tiwlo.com SMTP SSL transmission
 * - Two-Step Verification (2FA) OTP lifecycle
 * - Password reset codes & Signup verification
 * - Real-time Login Activity notifications
 * - Unlimited email outbox storage for auditing & future Admin Dashboard
 * - High-deliverability anti-spam header alignment (SPF, DMARC, Google Verified)
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CONFIG_PATH = path.join(__dirname, '../config/email_config.json');

// Ensure parent directory exists
const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(CONFIG_PATH);

// Load or initialize Email Config
export function getEmailConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[EmailService] Error reading config:', e);
  }

  const defaultConfig = {
    senderEmail: 'noreply@tiwlo.com',
    senderName: 'Tiwlo',
    replyTo: 'noreply@tiwlo.com',
    accountType: 'system_noreply',
    storage: 'unlimited',
    inboundPolicy: 'reject_all_incoming',
    smtp: {
      provider: 'local_postfix',
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: parseInt(process.env.SMTP_PORT || '25', 10),
      secure: false,
      ignoreTLS: true,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      tls: {
        rejectUnauthorized: false
      }
    },
    dnsRecords: {
      mx: { host: 'mail.tiwlo.com', priority: 10 },
      spf: 'v=spf1 mx ip4:162.35.124.233 ~all',
      dmarc: 'v=DMARC1; p=quarantine; rua=mailto:security@tiwlo.com; pct=100; sp=quarantine'
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

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
  } catch (e) { }

  return defaultConfig;
}

export function updateEmailConfig(updates) {
  const current = getEmailConfig();
  const merged = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

// ==========================================
// UNLIMITED EMAIL OUTBOX AUDIT STORE
// ==========================================
const memoryOutboxStore = [];

function readOutbox() {
  return memoryOutboxStore;
}

function recordToOutbox(record) {
  memoryOutboxStore.unshift({
    id: `mail_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    createdAt: new Date().toISOString(),
    ...record
  });
}

export function getOutboxList(limit = 100, filterType = null) {
  const all = readOutbox();
  if (filterType) {
    return all.filter(m => m.type === filterType).slice(0, limit);
  }
  return all.slice(0, limit);
}

// ==========================================
// CRYPTOGRAPHIC OTP STORE
// ==========================================
const memoryOtpMap = new Map();

export function generateSecureOtp(email, type = 'login_2fa', expiryMinutes = 10) {
  const cleanEmail = email.trim().toLowerCase();
  // 6-digit numeric cryptographically random code
  const code = crypto.randomInt(100000, 999999).toString();
  const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
  const now = Date.now();
  const expiresAt = now + expiryMinutes * 60 * 1000;

  const otpPayload = {
    email: cleanEmail,
    code,
    token,
    type,
    attempts: 0,
    maxAttempts: 5,
    createdAt: now,
    expiresAt,
    verified: false
  };

  memoryOtpMap.set(token, otpPayload);
  return { code, token, expiresAt };
}

export function verifySecureOtp(token, inputCode, expectedType = 'login_2fa') {
  if (!token) return { valid: false, error: 'Verification token is required' };

  let record = memoryOtpMap.get(token);
  if (!record) {
    return { valid: false, error: 'Invalid or expired verification session' };
  }

  if (Date.now() > record.expiresAt) {
    deleteOtpSession(token);
    return { valid: false, error: 'Verification code has expired. Please request a new one.' };
  }

  if (record.attempts >= record.maxAttempts) {
    deleteOtpSession(token);
    return { valid: false, error: 'Maximum verification attempts exceeded. Please request a new code.' };
  }

  if (record.type !== expectedType) {
    return { valid: false, error: 'Mismatched verification context' };
  }

  const cleanInput = (inputCode || '').toString().trim().replace(/\s+/g, '');
  if (cleanInput !== record.code) {
    record.attempts += 1;
    const remaining = record.maxAttempts - record.attempts;
    return { valid: false, error: `Invalid 6-digit code. ${remaining} attempt(s) remaining.` };
  }

  // Code is valid! Mark verified and remove token
  record.verified = true;
  deleteOtpSession(token);

  return { valid: true, email: record.email };
}

export function getOtpSession(token) {
  return memoryOtpMap.get(token) || null;
}

export function deleteOtpSession(token) {
  memoryOtpMap.delete(token);
}

// Clean up expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of memoryOtpMap.entries()) {
    if (now > data.expiresAt) {
      memoryOtpMap.delete(token);
    }
  }
}, 60000);

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

  // If provider is gmail or host is smtp.gmail.com
  if (smtp.provider === 'gmail' || (smtp.host && smtp.host.includes('gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER || smtp.auth?.user,
        pass: process.env.SMTP_PASS || smtp.auth?.pass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }

  // Local Postfix Loopback (127.0.0.1:25) - Standard for Linux VPS
  const isLocal = !smtp.host || smtp.host === '127.0.0.1' || smtp.host === 'localhost' || smtp.provider === 'local_postfix';
  const port = parseInt(process.env.SMTP_PORT || smtp.port || (isLocal ? '25' : '587'), 10);
  const isPort25 = port === 25;

  if (isLocal) {
    return nodemailer.createTransport({
      host: '127.0.0.1',
      port,
      secure: false,
      ignoreTLS: isPort25,
      tls: { rejectUnauthorized: false },
      // NEVER provide invalid auth on trusted local loopback port 25
      ...(smtp.auth?.user && smtp.auth?.pass && !isPort25 ? { auth: { user: smtp.auth.user, pass: smtp.auth.pass } } : {}),
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000
    });
  }

  // Standard External SMTP / SSL / TLS Relay (Brevo, Resend, SendGrid, Custom)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || smtp.host,
    port: parseInt(process.env.SMTP_PORT || smtp.port || '587', 10),
    secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : (smtp.secure === true),
    ...(smtp.auth?.user && smtp.auth?.pass ? {
      auth: {
        user: process.env.SMTP_USER || smtp.auth?.user,
        pass: process.env.SMTP_PASS || smtp.auth?.pass
      }
    } : {}),
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
export async function sendTiwloEmail({ to, subject, html, text, type = 'general', metadata = {} }) {
  const config = getEmailConfig();
  const cleanTo = (to || '').trim();

  const mailOptions = {
    from: `"${config.senderName}" <${config.senderEmail}>`,
    to: cleanTo,
    replyTo: `"${config.senderName} (Do Not Reply)" <${config.replyTo}>`,
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

  let deliveryStatus = 'delivered';
  let errorMsg = null;
  let messageId = null;

  try {
    const transporter = createTransporter(config);
    const info = await transporter.sendMail(mailOptions);
    messageId = info?.messageId || `msg_${Date.now()}`;
    console.log(`✉️ [EmailService] Successfully sent ${type} to ${cleanTo} (${messageId})`);
  } catch (err) {
    console.warn(`⚠️ [EmailService] Primary transport failed for ${cleanTo}: ${err.message}. Retrying via direct local Postfix (127.0.0.1:25)...`);
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
      messageId = info?.messageId || `msg_${Date.now()}`;
      deliveryStatus = 'delivered';
      errorMsg = null;
      console.log(`✉️ [EmailService] Successfully sent ${type} to ${cleanTo} via fallback Postfix loopback (${messageId})`);
    } catch (fallbackErr) {
      deliveryStatus = 'failed';
      errorMsg = `Primary: ${err.message}; Fallback: ${fallbackErr.message}`;
      console.error(`❌ [EmailService] All delivery transports failed for ${cleanTo}:`, errorMsg);
    }
  }

  // Record to unlimited outbox for auditing
  recordToOutbox({
    to: cleanTo,
    from: config.senderEmail,
    subject,
    type,
    status: deliveryStatus,
    messageId,
    error: errorMsg,
    metadata,
    otpCode: metadata.otpCode || null,
    html
  });

  return {
    success: deliveryStatus === 'delivered',
    delivered: deliveryStatus === 'delivered',
    status: deliveryStatus,
    messageId,
    email: cleanTo,
    error: errorMsg,
    otpCode: metadata.otpCode || null
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
    text: `Your Tiwlo Account has been disabled due to a policy violation: ${reason || 'Terms of Service violation'}. Visit ${restoreUrl || 'https://tiwlo.com/account-disabled'} to request a review.`,
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
    text: `Good news. We reviewed your account and confirmed that access to your Tiwlo Account has been restored. You can now complete your security checkup and sign in at ${checkupUrl || 'https://tiwlo.com/security-checkup'}`,
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
    text: `Notice: Your ${contentType || 'content'} was removed because it violated Tiwlo's ${policyName || 'Acceptable Use Policy'}. Reason: ${reason || 'Safety compliance violation'}. Visit ${appealUrl || 'https://tiwlo.com/help-support'} to review or appeal.`,
    type: 'content_removed',
    metadata: { recipientName: name, contentType, policyName, reason, appealUrl }
  });
}


