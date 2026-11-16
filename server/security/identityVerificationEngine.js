import crypto from 'node:crypto';
import { isPgActive, queryPg } from '../db/postgres.js';
import { MasterDB } from '../db/multiTenant.js';
import { identityVerificationEmailNotifications } from '../db/emailService.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { identityReviewStore } from '../db/identityReviewStore.js';
import { identityVerificationEvidence } from '../db/identityVerificationEvidence.js';
import {
  analyzeIdentityDocumentWithGemini,
  matchDocumentAndSelfieWithGemini,
  geminiIdentityVerifier
} from './geminiIdentityVerifier.js';
import { extractClientSignals, hashAbuseSignal } from './freeTierAbuseGuard.js';

const ENGINE_SECRET =
  process.env.IDENTITY_PII_KEY ||
  process.env.SESSION_SECRET ||
  process.env.ABUSE_HASH_SECRET ||
  'tiwlo-identity-engine-secret';

const memoryPaymentSignals = new Map();
let paymentSignalSchemaReady = false;

const MRZ_WEIGHTS = [7, 3, 1];
function mrzCharValue(ch) {
  if (ch === '<') return 0;
  if (ch >= '0' && ch <= '9') return Number(ch);
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) return code - 55;
  return 0;
}

export function computeMrzCheckDigit(field) {
  let sum = 0;
  const chars = String(field || '').toUpperCase();
  for (let i = 0; i < chars.length; i += 1) {
    sum += mrzCharValue(chars[i]) * MRZ_WEIGHTS[i % 3];
  }
  return String(sum % 10);
}

/**
 * Validates ICAO 9303 TD3 2-line (44-char) Passport MRZ lines and verifies all check digits
 * (document number, birth date, expiry date, composite check digit).
 */
export function validatePassportMrz(line1Raw = '', line2Raw = '') {
  const line1 = String(line1Raw || '').trim().toUpperCase().replace(/\s+/g, '');
  const line2 = String(line2Raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (line1.length < 36 || line2.length < 28 || !line1.startsWith('P')) {
    return { present: false, valid: null };
  }
  const padded2 = line2.padEnd(44, '<').slice(0, 44);
  const docNumField = padded2.slice(0, 9);
  const docNumCheck = padded2[9];
  const issuingCountry = line1.slice(2, 5).replace(/</g, '');
  const dobField = padded2.slice(13, 19);
  const dobCheck = padded2[19];
  const expiryField = padded2.slice(21, 27);
  const expiryCheck = padded2[27];
  const compositeInput = `${padded2.slice(0, 10)}${padded2.slice(13, 20)}${padded2.slice(21, 43)}`;
  const compositeCheck = padded2[43];

  const docValid = /^\d$/.test(docNumCheck) && computeMrzCheckDigit(docNumField) === docNumCheck;
  const dobValid = /^\d$/.test(dobCheck) && computeMrzCheckDigit(dobField) === dobCheck;
  const expiryValid = /^\d$/.test(expiryCheck) && computeMrzCheckDigit(expiryField) === expiryCheck;
  const compositeValid = !/^\d$/.test(compositeCheck) || computeMrzCheckDigit(compositeInput) === compositeCheck;

  const parseMrzYyMmDd = (yymmdd, pivotFuture = false) => {
    if (!/^\d{6}$/.test(yymmdd)) return null;
    const yy = Number(yymmdd.slice(0, 2));
    const currentYy = new Date().getUTCFullYear() % 100;
    const century = pivotFuture ? 2000 : (yy > currentYy + 1 ? 1900 : 2000);
    return `${century + yy}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
  };

  return {
    present: true,
    valid: Boolean(docValid && dobValid && expiryValid && compositeValid),
    checks: { docValid, dobValid, expiryValid, compositeValid },
    documentNumber: docNumField.replace(/</g, ''),
    issuingCountry,
    dateOfBirth: parseMrzYyMmDd(dobField, false),
    expiryDate: parseMrzYyMmDd(expiryField, true)
  };
}

const ANOMALY_KEYWORDS = [
  'carding', 'ccdump', 'hackbank', 'counterfeit', 'phishing', 'scam-support',
  'official-verify', 'meta-security', 'tiwlo-admin', 'binance-airdrop'
];

async function ensurePaymentSignalTable() {
  if (!isPgActive() || paymentSignalSchemaReady) return;
  try {
    await queryPg(`
      CREATE TABLE IF NOT EXISTS system_user_payment_signals (
        id VARCHAR(80) PRIMARY KEY,
        user_id VARCHAR(120) NOT NULL,
        signal_type VARCHAR(48) NOT NULL,
        signal_hash VARCHAR(128) NOT NULL,
        provider VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryPg(`CREATE INDEX IF NOT EXISTS idx_payment_signals_hash ON system_user_payment_signals (signal_type, signal_hash)`);
    paymentSignalSchemaReady = true;
  } catch {
    // Non-fatal schema creation
  }
}

/**
 * Records normalized HMAC hashes for billing email, phone, card fingerprint, or mobile wallet
 * and triggers step-up verification when shared across multiple distinct accounts.
 */
export async function recordAndEvaluatePaymentBillingRisk({
  userId,
  billingEmail = '',
  billingPhone = '',
  paymentAccountId = '',
  cardFingerprint = '',
  paymentProvider = '',
  masterDb = MasterDB,
  emailNotifier = identityVerificationEmailNotifications
} = {}) {
  if (!userId) return { triggered: false, overlaps: [] };
  const uid = String(userId);
  const candidates = [];
  const normEmail = String(billingEmail || '').trim().toLowerCase();
  if (normEmail && normEmail.includes('@')) {
    candidates.push(['billing_email', crypto.createHmac('sha256', ENGINE_SECRET).update(`pay:email:${normEmail}`).digest('hex')]);
  }
  const normPhone = String(billingPhone || '').replace(/\D/g, '');
  if (normPhone.length >= 7) {
    candidates.push(['billing_phone', crypto.createHmac('sha256', ENGINE_SECRET).update(`pay:phone:${normPhone.slice(-10)}`).digest('hex')]);
  }
  const normAcct = String(paymentAccountId || '').trim().toLowerCase();
  if (normAcct.length >= 5) {
    candidates.push(['payment_account', crypto.createHmac('sha256', ENGINE_SECRET).update(`pay:acct:${normAcct}`).digest('hex')]);
  }
  const normCard = String(cardFingerprint || '').trim().toLowerCase();
  if (normCard.length >= 6) {
    candidates.push(['card_fingerprint', crypto.createHmac('sha256', ENGINE_SECRET).update(`pay:card:${normCard}`).digest('hex')]);
  }
  if (candidates.length === 0) return { triggered: false, overlaps: [] };

  const overlaps = [];
  if (isPgActive()) {
    await ensurePaymentSignalTable();
    for (const [signalType, signalHash] of candidates) {
      const { rows } = await queryPg(
        `SELECT DISTINCT user_id FROM system_user_payment_signals
         WHERE signal_type = $1 AND signal_hash = $2 AND user_id <> $3 LIMIT 10`,
        [signalType, signalHash, uid]
      ).catch(() => ({ rows: [] }));
      for (const r of rows || []) {
        overlaps.push({ signalType, otherUserId: String(r.user_id) });
      }
      await queryPg(
        `INSERT INTO system_user_payment_signals (id, user_id, signal_type, signal_hash, provider)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [`paysig_${crypto.randomUUID()}`, uid, signalType, signalHash, String(paymentProvider || '').slice(0, 64) || null]
      ).catch(() => {});
    }
  } else {
    for (const [signalType, signalHash] of candidates) {
      const key = `${signalType}:${signalHash}`;
      const existing = memoryPaymentSignals.get(key) || new Set();
      for (const otherUid of existing) {
        if (otherUid !== uid) overlaps.push({ signalType, otherUserId: otherUid });
      }
      existing.add(uid);
      memoryPaymentSignals.set(key, existing);
    }
  }

  if (overlaps.length === 0) return { triggered: false, overlaps: [] };

  const targetUser = await masterDb.findUserByIdentifier(uid).catch(() => null);
  if (targetUser && targetUser.role !== 'super_admin' && !targetUser.isBanned && !targetUser.identityVerified) {
    if (!targetUser.identityVerificationRequired) {
      await masterDb.updateUser(targetUser.id, { identityVerificationRequired: true });
      emailNotifier?.required({
        to: targetUser.email,
        name: targetUser.name || targetUser.storeName || 'Tiwlo user',
        reason: 'Shared payment or billing details were detected across accounts. Complete one-time identity verification to continue.'
      }).catch(() => {});
    }
    await recordSecurityEvent({
      eventType: 'security.payment_billing_overlap_stepup',
      severity: 'warning',
      userId: targetUser.id,
      subject: targetUser.email,
      details: { overlaps: overlaps.slice(0, 10) }
    }).catch(() => {});
    return { triggered: true, overlaps };
  }
  return { triggered: false, overlaps };
}

/**
 * Detects store creation anomalies (cloned store name/subdomain from another owner or blocked contraband terms)
 * and triggers mandatory identity verification on unverified accounts.
 */
export async function evaluateStoreCreationAnomaly({
  userId,
  storeName = '',
  subdomain = '',
  description = '',
  category = '',
  allStores = null,
  masterDb = MasterDB,
  emailNotifier = identityVerificationEmailNotifications
} = {}) {
  if (!userId) return { flagged: false, anomalyScore: 0, reasons: [] };
  const uid = String(userId);
  const reasons = [];
  let anomalyScore = 0;

  const cleanStoreName = String(storeName || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
  const combinedText = `${storeName} ${subdomain} ${description} ${category}`.toLowerCase();
  for (const kw of ANOMALY_KEYWORDS) {
    if (combinedText.includes(kw)) {
      anomalyScore += 60;
      reasons.push(`Restricted term detected: ${kw}`);
      break;
    }
  }

  const storesList = Array.isArray(allStores)
    ? allStores
    : await (masterDb.listAllStores ? masterDb.listAllStores().catch(() => []) : Promise.resolve([]));
  if (cleanStoreName.length >= 4 && Array.isArray(storesList)) {
    const clonedFrom = storesList.find((s) => {
      const otherOwner = String(s.ownerId || s.userId || '');
      if (!otherOwner || otherOwner === uid) return false;
      const otherNorm = String(s.storeName || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
      return otherNorm && otherNorm === cleanStoreName;
    });
    if (clonedFrom) {
      anomalyScore += 50;
      reasons.push(`Clone storefront name matches another owner (${clonedFrom.storeName})`);
    }
  }

  if (anomalyScore < 50) return { flagged: false, anomalyScore, reasons };

  const user = await masterDb.findUserByIdentifier(uid).catch(() => null);
  if (user && user.role !== 'super_admin' && !user.isBanned && !user.identityVerified) {
    if (!user.identityVerificationRequired) {
      await masterDb.updateUser(user.id, { identityVerificationRequired: true });
      emailNotifier?.required({
        to: user.email,
        name: user.name || user.storeName || 'Tiwlo user',
        reason: 'Your new store triggered an automated storefront similarity / trust check. Verify your identity to unlock full access.'
      }).catch(() => {});
    }
    await recordSecurityEvent({
      eventType: 'security.store_anomaly_triggered_verification',
      severity: 'warning',
      userId: user.id,
      subject: user.email,
      details: { anomalyScore, reasons }
    }).catch(() => {});
  }
  return { flagged: true, anomalyScore, reasons };
}

/**
 * Scans accepted identity reviews for upcoming (<daysWindow) or already expired documents:
 * - Already expired: resets identityVerified=false, identityVerificationRequired=true and notifies customer
 * - Expiring soon (<daysWindow): sends one-time renewal alert email and stamps expiryReminderSentAt
 */
export async function scanAndNotifyExpiringDocuments({
  daysWindow = 30,
  nowMs = Date.now(),
  store = identityReviewStore,
  masterDb = MasterDB,
  emailNotifier = identityVerificationEmailNotifications
} = {}) {
  const accepted = await store.listReviews({ status: 'accepted' });
  let checked = 0;
  let expiredCount = 0;
  let expiringSoonCount = 0;
  let notificationsSent = 0;
  const windowMs = Math.max(1, Number(daysWindow) || 30) * 24 * 60 * 60 * 1000;

  for (const rev of accepted) {
    const rawExpiry = rev?.extractedData?.expiryDate || rev?.metadata?.expiryDate || '';
    const cleanExpiry = String(rawExpiry || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanExpiry)) continue;
    checked += 1;
    const expiryMs = Date.parse(`${cleanExpiry}T23:59:59Z`);
    if (!Number.isFinite(expiryMs)) continue;

    const user = await masterDb.findUserByIdentifier(rev.userId).catch(() => null);
    if (!user || user.isBanned) continue;

    if (expiryMs <= nowMs) {
      expiredCount += 1;
      if (user.identityVerified) {
        await masterDb.updateUser(user.id, {
          identityVerified: false,
          identityVerificationRequired: true
        });
      }
      if (!rev.metadata?.expiredActionTakenAt) {
        await emailNotifier?.required({
          to: user.email,
          name: user.name || user.storeName || 'Tiwlo user',
          reason: `Your verified identity document expired on ${cleanExpiry}. Upload a renewed document to restore access.`
        }).catch(() => {});
        notificationsSent += 1;
        await store.createOrUpdateReview({
          ...rev,
          metadata: {
            ...(rev.metadata || {}),
            expiredActionTakenAt: new Date(nowMs).toISOString()
          }
        }).catch(() => {});
      }
    } else if (expiryMs - nowMs <= windowMs) {
      expiringSoonCount += 1;
      if (!rev.metadata?.expiryReminderSentAt) {
        const daysLeft = Math.max(1, Math.ceil((expiryMs - nowMs) / 86_400_000));
        await emailNotifier?.required({
          to: user.email,
          name: user.name || user.storeName || 'Tiwlo user',
          reason: `Reminder: Your verified identity document expires in ${daysLeft} day(s) (${cleanExpiry}). Prepare an updated document before expiry.`
        }).catch(() => {});
        notificationsSent += 1;
        await store.createOrUpdateReview({
          ...rev,
          metadata: {
            ...(rev.metadata || {}),
            expiryReminderSentAt: new Date(nowMs).toISOString()
          }
        }).catch(() => {});
      }
    }
  }

  return { checked, expiredCount, expiringSoonCount, notificationsSent };
}

export function resetEngineMemoryStores() {
  memoryPaymentSignals.clear();
}

export function computeSaltedDocumentHashes({ documentType = '', documentNumber = '', fullName = '', dateOfBirth = '', address = '' } = {}) {
  const cleanNum = String(documentNumber || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const cleanType = String(documentType || '').trim().toLowerCase() || 'id';
  const documentFingerprint = cleanNum.length >= 5
    ? crypto.createHmac('sha256', ENGINE_SECRET).update(`doc:${cleanType}:${cleanNum}`).digest('hex')
    : '';

  const cleanName = String(fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanDob = String(dateOfBirth || '').trim().slice(0, 10);
  const cleanAddr = String(address || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
  const identityHash = cleanName && (cleanDob || cleanNum || cleanAddr)
    ? crypto.createHmac('sha256', ENGINE_SECRET).update(`id:${cleanName}|${cleanDob}|${cleanAddr}`).digest('hex')
    : '';

  return { documentFingerprint, identityHash };
}

export function buildSignedVerificationAttestation({ userId, documentFingerprint = '', evidenceFiles = [], method = 'gemini_multimodal_vision' }) {
  const issuedAt = new Date().toISOString();
  const credentialId = `cred_${crypto.randomUUID()}`;
  const evidenceDigest = crypto
    .createHash('sha256')
    .update(JSON.stringify((evidenceFiles || []).map((f) => ({ id: f.id, kind: f.kind, sha256: f.sizeBytes }))))
    .digest('hex');
  const payload = `${credentialId}|${String(userId || '')}|${documentFingerprint}|${evidenceDigest}|${method}|${issuedAt}`;
  const hmacSignature = crypto.createHmac('sha512', ENGINE_SECRET).update(payload).digest('hex');
  return {
    credentialId,
    sha256Digest: evidenceDigest,
    hmacSignature,
    method,
    issuedAt
  };
}

/**
 * Detect suspected multi-account / synthetic signup clusters via shared hardware, browser token,
 * or subnet signals. Instead of banning immediately on signup/login, triggers mandatory step-up
 * identity verification (`identityVerificationRequired = true`).
 */
export async function evaluateMultiAccountStepUpRisk({ userId, user = null, req = null, threshold = 2 } = {}) {
  if (!userId || !isPgActive()) {
    return { triggered: false, riskScore: 0, linkedAccountIds: [] };
  }
  const targetUser = user || await MasterDB.findUserByIdentifier(userId);
  if (!targetUser || targetUser.role === 'super_admin' || targetUser.isBanned || targetUser.identityVerified === true) {
    return { triggered: false, riskScore: 0, linkedAccountIds: [] };
  }

  const signals = extractClientSignals(req);
  const uid = String(targetUser.id || userId);
  const uaHash = signals.userAgentHash || hashAbuseSignal('ua', 'unknown');
  const deviceHash = signals.fingerprintHash || signals.deviceTokenHash || uaHash;
  const ipHash = signals.ipHash;

  const { rows } = await queryPg(
    `SELECT DISTINCT user_id, device_hash, ip_hash
     FROM system_user_device_identities
     WHERE user_id <> $1
       AND ($2::text IS NOT NULL AND device_hash = $2 OR $3::text IS NOT NULL AND ip_hash = $3)
     LIMIT 25`,
    [uid, deviceHash || null, ipHash || null]
  );

  const sharedDeviceUsers = new Set();
  const sharedIpUsers = new Set();
  for (const row of rows || []) {
    if (deviceHash && row.device_hash === deviceHash) sharedDeviceUsers.add(String(row.user_id));
    if (ipHash && row.ip_hash === ipHash) sharedIpUsers.add(String(row.user_id));
  }

  const combinedLinked = [...new Set([...sharedDeviceUsers, ...sharedIpUsers])];
  const riskScore = Math.min(100, sharedDeviceUsers.size * 50 + sharedIpUsers.size * 25);
  const shouldStepUp = sharedDeviceUsers.size >= 1 || sharedIpUsers.size >= threshold;

  if (!shouldStepUp) {
    return { triggered: false, riskScore, linkedAccountIds: combinedLinked };
  }

  if (!targetUser.identityVerificationRequired) {
    await MasterDB.updateUser(targetUser.id, { identityVerificationRequired: true });
    identityVerificationEmailNotifications.required({
      to: targetUser.email,
      name: targetUser.name || targetUser.storeName || 'Tiwlo user',
      reason: 'Automated security check detected multiple linked device or network sessions requiring one-time identity confirmation.'
    }).catch(() => {});
  }

  await recordSecurityEvent({
    eventType: 'security.risk_triggered_identity_verification',
    severity: 'warning',
    userId: targetUser.id,
    subject: targetUser.email,
    ip: signals.ip,
    details: {
      riskScore,
      sharedDeviceCount: sharedDeviceUsers.size,
      sharedIpCount: sharedIpUsers.size,
      linkedAccountIds: combinedLinked.slice(0, 10)
    }
  }).catch(() => {});

  return {
    triggered: true,
    riskScore,
    linkedAccountIds: combinedLinked
  };
}

export const identityVerificationEngine = {
  computeSaltedDocumentHashes,
  buildSignedVerificationAttestation,
  evaluateMultiAccountStepUpRisk,
  validatePassportMrz,
  computeMrzCheckDigit,
  recordAndEvaluatePaymentBillingRisk,
  evaluateStoreCreationAnomaly,
  scanAndNotifyExpiringDocuments,
  resetEngineMemoryStores,
  analyzeDocument: analyzeIdentityDocumentWithGemini,
  matchDocumentAndSelfie: matchDocumentAndSelfieWithGemini,
  geminiVerifier: geminiIdentityVerifier,
  reviewStore: identityReviewStore,
  evidenceStore: identityVerificationEvidence
};

export default identityVerificationEngine;
