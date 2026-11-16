import express from 'express';
import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import geoip from 'geoip-lite';
import { MasterDB } from '../db/multiTenant.js';
import { identityVerificationEmailNotifications } from '../db/emailService.js';
import { identityVerificationEvidence } from '../db/identityVerificationEvidence.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import { requireAuthenticatedUser } from '../security/authGuards.js';
import { activateBanAndBlockSignals } from '../security/freeTierAbuseGuard.js';
import {
  evaluateDobMatch,
  evaluateNameMatch,
  geminiIdentityVerifier,
  normalizeDocumentType,
  normalizeIsoDate
} from '../security/geminiIdentityVerifier.js';
import { faceLivenessEngine } from '../security/faceLivenessEngine.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_RECORDING_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const MIN_CAMERA_WIDTH = 160;
const MIN_CAMERA_HEIGHT = 160;
const MIN_FRAME_BRIGHTNESS = 10;
const LIVENESS_SESSION_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TOKEN_TTL_MS = 5 * 60 * 1000;
const HANDOFF_IDLE_TTL_MS = 30 * 60 * 1000;
const LIVENESS_CHALLENGE_COUNT = 3;
const EPHEMERAL_ATTESTATION_SECRET = randomBytes(32).toString('hex');

const CHALLENGE_POOL = Object.freeze(['turn_left', 'turn_right', 'open_mouth', 'blink']);
const CHALLENGE_INSTRUCTIONS = Object.freeze({
  turn_left: 'Slowly turn your head to the left',
  turn_right: 'Slowly turn your head to the right',
  open_mouth: 'Open your mouth briefly',
  blink: 'Blink your eyes naturally'
});

const imageTypes = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp']
]);

const COUNTRY_CODE_TO_NAMES = Object.freeze({
  BD: ['bangladesh', 'bd', 'bgd'],
  US: ['united states', 'united states of america', 'usa', 'us'],
  GB: ['united kingdom', 'uk', 'great britain', 'gb', 'gbr'],
  IN: ['india', 'in', 'ind'],
  CA: ['canada', 'ca', 'can'],
  AU: ['australia', 'au', 'aus'],
  AE: ['united arab emirates', 'uae', 'ae', 'are'],
  SA: ['saudi arabia', 'ksa', 'sa', 'sau'],
  MY: ['malaysia', 'my', 'mys'],
  SG: ['singapore', 'sg', 'sgp'],
  DE: ['germany', 'deutschland', 'de', 'deu'],
  FR: ['france', 'fr', 'fra'],
  PK: ['pakistan', 'pk', 'pak']
});

function pickRandomChallenges(count = LIVENESS_CHALLENGE_COUNT) {
  const pool = [...CHALLENGE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function hashSecret(secret) {
  return createHash('sha256').update(secret).digest();
}

function secretMatches(secret, expectedHash) {
  if (typeof secret !== 'string' || !expectedHash) return false;
  const actualHash = hashSecret(secret);
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
}

function sendNoStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

function getRequestOwner(req) {
  if (req.activeUser?.id !== undefined) return String(req.activeUser.id);
  if (req.verificationHandoff) return `handoff:${req.verificationHandoff.id}`;
  return null;
}

function getVerificationRateLimitKey(req) {
  const owner = getRequestOwner(req);
  if (!owner) throw new Error('Verification rate limiting requires an authenticated session.');
  return `verification:${owner}`;
}

function requireIdentityVerificationUser(req, res, next) {
  return requireAuthenticatedUser(req, res, next, { allowIdentityVerification: true });
}

function setHandoffStatus(session, status, result = null) {
  if (!session) return;
  session.status = status;
  session.result = result;
  session.lastActivityAt = Date.now();
}

async function getValidImageFormat(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) return null;
  const metadata = await sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  return metadata.width && metadata.height && imageTypes.has(metadata.format)
    ? metadata.format
    : null;
}

/**
 * Validates and inspects a single camera frame using `sharp` metadata and channel stats.
 */
async function analyzeCameraFrame(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new TypeError('A valid camera frame is required.');
  }
  const instance = sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS });
  const [metadata, stats, thumb32] = await Promise.all([
    instance.metadata(),
    instance.stats(),
    instance.clone().resize(32, 32, { fit: 'fill' }).greyscale().raw().toBuffer()
  ]);

  if (!metadata.width || !metadata.height || !imageTypes.has(metadata.format)) {
    throw new TypeError('Use a valid JPEG, PNG, or WebP camera frame.');
  }

  const channels = (stats.channels || []).slice(0, 3);
  const channelCount = channels.length || 1;
  const brightness = Math.round(
    (channels.reduce((sum, ch) => sum + Number(ch.mean || 0), 0) / channelCount) * 100
  ) / 100;
  const variance = Math.round(
    (channels.reduce((sum, ch) => sum + Math.pow(Number(ch.stdev || 0), 2), 0) / channelCount) * 100
  ) / 100;
  const sharpness = Math.round(
    (channels.reduce((sum, ch) => sum + Number(ch.stdev || 0), 0) / channelCount) * 100
  ) / 100;
  const entropy = Number.isFinite(Number(stats.entropy))
    ? Math.round(Number(stats.entropy) * 1000) / 1000
    : 0;
  const frameHash = createHash('sha256').update(thumb32).digest('hex');

  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    brightness,
    variance,
    sharpness,
    entropy,
    thumb32,
    frameHash
  };
}

function computeThumbDelta(thumbA, thumbB) {
  if (!thumbA || !thumbB || thumbA.length !== thumbB.length || thumbA.length === 0) {
    return null;
  }
  let sum = 0;
  for (let i = 0; i < thumbA.length; i++) {
    sum += Math.abs(thumbA[i] - thumbB[i]);
  }
  return Math.round((sum / thumbA.length) * 100) / 100;
}

function convertRecordingToMp4(recording) {
  if (recording.mimetype === 'video/mp4') {
    if (recording.buffer.length < 12 || recording.buffer.toString('ascii', 4, 8) !== 'ftyp') {
      throw new TypeError('The recording is not a valid MP4 file.');
    }
    return Promise.resolve(recording.buffer);
  }

  if (recording.buffer.length < 4 ||
      recording.buffer.readUInt32BE(0) !== 0x1a45dfa3) {
    throw new TypeError('The recording is not a valid WebM file.');
  }

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-nostdin',
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-an',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof+faststart',
      '-f', 'mp4',
      'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [];
    let outputSize = 0;
    let errorOutput = '';
    const timeout = setTimeout(() => ffmpeg.kill('SIGKILL'), 30_000);

    ffmpeg.stdout.on('data', chunk => {
      outputSize += chunk.length;
      if (outputSize > MAX_RECORDING_BYTES) {
        ffmpeg.kill('SIGKILL');
        return;
      }
      output.push(chunk);
    });
    ffmpeg.stderr.on('data', chunk => {
      errorOutput = `${errorOutput}${chunk}`.slice(-2000);
    });
    ffmpeg.once('error', error => {
      clearTimeout(timeout);
      if (error && error.code === 'ENOENT') {
        console.warn('[Verification] ffmpeg not installed on host; storing original WebM recording directly.');
        resolve(recording.buffer);
        return;
      }
      reject(error);
    });
    ffmpeg.once('close', code => {
      clearTimeout(timeout);
      if (outputSize > MAX_RECORDING_BYTES) {
        reject(new TypeError('The converted MP4 recording exceeds 30 MB.'));
        return;
      }
      if (code !== 0) {
        console.warn('[Verification] ffmpeg WebM->MP4 transcoding failed; falling back to original WebM recording:', errorOutput);
        resolve(recording.buffer);
        return;
      }
      const mp4 = Buffer.concat(output);
      if (mp4.length < 12 || mp4.toString('ascii', 4, 8) !== 'ftyp') {
        console.warn('[Verification] Converted MP4 header invalid; storing original WebM recording.');
        resolve(recording.buffer);
        return;
      }
      resolve(mp4);
    });
    ffmpeg.stdin.on('error', error => {
      if (error.code !== 'EPIPE') ffmpeg.kill('SIGKILL');
    });
    ffmpeg.stdin.end(recording.buffer);
  });
}

async function completeIdentityVerification(userId, method) {
  if (!userId) throw new Error('Verification session is not linked to an account.');
  const existingUser = await MasterDB.findUserByIdentifier(userId);
  if (!existingUser) throw new Error('The account for this verification session no longer exists.');
  if (existingUser.identityVerified && !existingUser.identityVerificationRequired) return;

  const user = await MasterDB.updateUser(existingUser.id, {
    identityVerified: true,
    identityVerificationRequired: false
  });
  if (!user) throw new Error('The account verification status could not be saved.');
  identityVerificationEmailNotifications.completed({
    to: user.email,
    name: user.name || user.storeName || 'Tiwlo user'
  }).catch(error => console.error('[Identity Verification Complete Email Error]', error.message));
  await recordSecurityEvent({
    eventType: 'identity.verification_succeeded',
    severity: 'info',
    userId: user.id,
    subject: user.email,
    details: { method }
  });
}

function getAttestationSecret() {
  return (
    process.env.SECURITY_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.TIWLO_INTERNAL_IDENTITY_SECRET ||
    process.env.VERIFICATION_ATTESTATION_SECRET ||
    EPHEMERAL_ATTESTATION_SECRET
  );
}

/**
 * Generates a tamper-evident HMAC-SHA512 verification attestation bound to
 * the user ID, SHA-256 digests of all submitted evidence, and issuance timestamp.
 */
function generateVerificationAttestation({ userId, documentBuffer, selfieBuffer, recordingBuffer }) {
  const credentialId = randomUUID();
  const issuedAt = new Date().toISOString();
  const documentSha256 = createHash('sha256').update(documentBuffer).digest('hex');
  const selfieSha256 = createHash('sha256').update(selfieBuffer).digest('hex');
  const recordingSha256 = createHash('sha256').update(recordingBuffer).digest('hex');
  const evidenceHashes = `${documentSha256}:${selfieSha256}:${recordingSha256}`;
  const method = 'gemini_multimodal_vision';

  const sha256Digest = createHash('sha256')
    .update(`${userId}|${evidenceHashes}|${issuedAt}|${method}`)
    .digest('hex');
  const hmacSignature = createHmac('sha512', getAttestationSecret())
    .update(`${userId}|${evidenceHashes}|${issuedAt}`)
    .digest('hex');

  return {
    credentialId,
    sha256Digest,
    hmacSignature,
    issuedAt,
    method,
    evidenceHashes: {
      documentSha256,
      selfieSha256,
      recordingSha256
    }
  };
}

function countriesMatch(geoCountry, docCountry) {
  if (!geoCountry || !docCountry) return null;
  const geoNorm = String(geoCountry).trim().toLowerCase();
  const docNorm = String(docCountry).trim().toLowerCase();
  if (!geoNorm || !docNorm) return null;
  if (geoNorm === docNorm) return true;

  for (const [code, aliases] of Object.entries(COUNTRY_CODE_TO_NAMES)) {
    const allNames = [code.toLowerCase(), ...aliases];
    if (allNames.includes(geoNorm) && allNames.includes(docNorm)) {
      return true;
    }
  }
  return false;
}

function collectZeroTrustTelemetry(req, livenessSession, geminiRes) {
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  const clientIp = String(
    req.headers['cf-connecting-ip'] ||
    firstForwarded ||
    req.ip ||
    ''
  ).slice(0, 128) || null;

  const cleanIpForGeo = clientIp ? clientIp.replace(/^::ffff:/i, '') : '';
  const geoLookupCountry = cleanIpForGeo ? geoip.lookup(cleanIpForGeo)?.country : null;
  const rawGeoCountry =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-geo-country'] ||
    req.body?.geoCountry ||
    geoLookupCountry ||
    '';
  const normalizedGeo = String(rawGeoCountry).trim().toUpperCase();
  const geoCountry =
    normalizedGeo && normalizedGeo !== 'XX' && normalizedGeo !== 'ZZ' && normalizedGeo !== 'T1'
      ? normalizedGeo
      : null;
  const documentCountry = geminiRes?.extracted?.country || null;
  const matchResult = countriesMatch(geoCountry, documentCountry);
  const countryMismatch = matchResult === null ? false : !matchResult;

  const challengeDurationMs = livenessSession?.startedAt
    ? Math.max(100, (livenessSession.completedAt || Date.now()) - livenessSession.startedAt)
    : null;

  const retakeCount = Math.max(
    0,
    Number.isFinite(Number(req.body?.retakeCount)) ? Number(req.body.retakeCount) : 0
  );

  const entropies = Array.isArray(livenessSession?.frameEntropies) ? livenessSession.frameEntropies : [];
  const frameEntropyAvg = entropies.length > 0
    ? Math.round((entropies.reduce((sum, v) => sum + v, 0) / entropies.length) * 1000) / 1000
    : null;
  const deltas = Array.isArray(livenessSession?.frameDeltas) ? livenessSession.frameDeltas : [];
  const frameMotionDeltaAvg = deltas.length > 0
    ? Math.round((deltas.reduce((sum, v) => sum + v, 0) / deltas.length) * 100) / 100
    : null;

  return {
    clientIp,
    geoCountry,
    documentCountry,
    countryMismatch,
    challengeDurationMs,
    frameCount: Number(livenessSession?.frameCount || 0),
    failedFrameCount: Number(livenessSession?.failedFrameCount || 0),
    replayRejections: Number(livenessSession?.replayRejections || 0),
    frameEntropyAvg,
    frameMotionDeltaAvg,
    retakeCount,
    userAgent: (req.get('user-agent') || '').slice(0, 256) || null,
    spoofRisk: geminiRes?.spoofRisk || geminiRes?.extracted?.spoofRisk || 'low',
    tamperingSignals: Array.isArray(geminiRes?.tamperingSignals)
      ? geminiRes.tamperingSignals
      : Array.isArray(geminiRes?.extracted?.tamperingSignals)
        ? geminiRes.extracted.tamperingSignals
        : [],
    documentExpiryValid: geminiRes?.documentExpiryValid ?? geminiRes?.extracted?.documentExpiryValid ?? null,
    isScreenRecaptureOrPrintedCopy: Boolean(
      geminiRes?.isScreenRecaptureOrPrintedCopy ?? geminiRes?.extracted?.isScreenRecaptureOrPrintedCopy
    )
  };
}

function buildReviewExtractedData(extracted = {}) {
  if (!extracted || typeof extracted !== 'object') return {};
  return {
    ...extracted,
    fullName: extracted.fullName ?? null,
    documentNumber: extracted.documentNumber ?? null,
    dateOfBirth: extracted.dateOfBirth ?? null,
    address: extracted.address ?? null,
    country: extracted.country ?? null
  };
}

function extractStoredEvidenceFiles(storedEvidence) {
  if (Array.isArray(storedEvidence)) return storedEvidence;
  if (Array.isArray(storedEvidence?.files)) return storedEvidence.files;
  if (Array.isArray(storedEvidence?.aliases)) return storedEvidence.aliases;
  return [];
}

function getDocumentFingerprintSecret() {
  return (
    process.env.IDENTITY_PII_KEY ||
    process.env.SECURITY_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.TIWLO_INTERNAL_IDENTITY_SECRET ||
    'tiwlo-identity-fingerprint-salt'
  );
}

function normalizeIdentityText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes deterministic salted HMAC-SHA256 hashes from normalized Gemini-extracted
 * document fields for duplicate-account detection without storing plaintext PII.
 */
export function computeDocumentHashes(extracted = {}) {
  if (!extracted || typeof extracted !== 'object') {
    return { documentFingerprint: null, identityHash: null };
  }

  const secret = getDocumentFingerprintSecret();
  const rawDocNum = extracted.documentNumber ?? extracted.document_number ?? '';
  const cleanDocNum = String(rawDocNum).replace(/[\s\-_./]+/g, '').trim().toUpperCase();
  const documentFingerprint = cleanDocNum.length >= 5
    ? createHmac('sha256', secret).update(`doc:${cleanDocNum}`).digest('hex')
    : null;

  const fullName = normalizeIdentityText(extracted.fullName ?? extracted.full_name ?? '');
  const dob = normalizeIdentityText(extracted.dateOfBirth ?? extracted.date_of_birth ?? '');
  const address = normalizeIdentityText(extracted.address ?? '');

  const identityHash = fullName && (dob || cleanDocNum.length >= 5 || address)
    ? createHmac('sha256', secret).update(`id:${fullName}|${dob}|${address}`).digest('hex')
    : null;

  return { documentFingerprint, identityHash };
}

async function handleDuplicateDocumentCheck({
  req,
  res,
  store,
  targetUser,
  extracted,
  documentType,
  evidenceFiles = [],
  telemetry = {},
  precomputedMatch = null,
  onBeforeBan = null
}) {
  const { documentFingerprint, identityHash } = computeDocumentHashes(extracted);
  if ((!documentFingerprint && !identityHash) || !targetUser?.id) {
    return { duplicate: false, documentFingerprint, identityHash };
  }
  if (!store || typeof store.findDuplicateDocumentMatch !== 'function') {
    return { duplicate: false, documentFingerprint, identityHash };
  }

  const duplicateMatch = precomputedMatch || await store.findDuplicateDocumentMatch({
    documentFingerprint,
    identityHash,
    excludeUserId: targetUser.id
  });

  if (!duplicateMatch) {
    return { duplicate: false, documentFingerprint, identityHash };
  }

  if (targetUser.role === 'super_admin') {
    return { duplicate: false, documentFingerprint, identityHash };
  }

  let finalEvidenceFiles = evidenceFiles;
  if (typeof onBeforeBan === 'function') {
    const resolved = await onBeforeBan();
    if (Array.isArray(resolved) && resolved.length > 0) {
      finalEvidenceFiles = resolved;
    }
  }

  const banReason = 'Permanently disabled: Duplicate identity document detected across multiple accounts.';
  try {
    await MasterDB.updateUser(targetUser.id, {
      isBanned: true,
      banReason,
      identityVerified: false,
      identityVerificationRequired: true
    });
  } catch (err) {
    console.error('[Verification] Failed to ban duplicate document account via MasterDB:', err.message);
  }

  try {
    await activateBanAndBlockSignals({
      userId: targetUser.id,
      user: targetUser,
      reason: banReason
    });
  } catch (err) {
    console.warn('[Verification] Non-fatal activateBanAndBlockSignals warning:', err.message);
  }

  recordSecurityEvent({
    eventType: 'security.duplicate_document_permanent_ban',
    severity: 'critical',
    userId: targetUser.id,
    subject: targetUser.email || String(targetUser.id),
    details: {
      matchedUserId: duplicateMatch.userId || null,
      matchedReviewId: duplicateMatch.id || null,
      documentType,
      hasDocumentFingerprint: Boolean(documentFingerprint),
      hasIdentityHash: Boolean(identityHash)
    }
  }).catch(err => console.warn('[Verification] Security event log failed:', err.message));

  if (typeof store.createOrUpdateReview === 'function') {
    const duplicateLinkedAccounts = [
      {
        userId: duplicateMatch.userId || '',
        tiwiId: duplicateMatch.tiwiId || '',
        userName: duplicateMatch.userName || '',
        userEmail: duplicateMatch.userEmail || '',
        documentType: duplicateMatch.documentType || '',
        detectedAt: new Date().toISOString()
      }
    ];
    try {
      await store.createOrUpdateReview({
        userId: targetUser.id,
        tiwiId: targetUser.tiwiId || targetUser.storeId || '',
        userName: targetUser.name || '',
        userEmail: targetUser.email || '',
        documentType,
        status: 'permanently_closed',
        source: 'duplicate_document_auto_ban',
        aiReason: 'Duplicate NID/Passport detected across multiple accounts',
        extractedData: buildReviewExtractedData(extracted),
        evidenceFiles: finalEvidenceFiles,
        documentFingerprint,
        identityHash,
        telemetry,
        metadata: {
          ...telemetry,
          documentFingerprint,
          identityHash,
          duplicateMatchedUserId: duplicateMatch.userId || null,
          duplicateMatchedReviewId: duplicateMatch.id || null,
          duplicateLinkedAccounts
        }
      });
    } catch (err) {
      console.warn('[Verification] Non-fatal duplicate review record error:', err.message);
    }
  }

  if (req.verificationHandoff) {
    setHandoffStatus(req.verificationHandoff, 'failed', 'duplicate_identity_permanent_ban');
    req.verificationHandoff.accessTokenHash = null;
  }

  res.status(403).json({
    success: false,
    code: 'DUPLICATE_IDENTITY_PERMANENT_BAN',
    permanentlyBanned: true,
    error: 'This identity document has already been used on another verified account. This account has been permanently disabled.'
  });

  return { duplicate: true, documentFingerprint, identityHash };
}

/**
 * Builds the verification router with optional dependency injection for testing.
 */
export function createVerificationRouter({
  geminiVerifier = geminiIdentityVerifier,
  reviewStore = null,
  faceEngine = faceLivenessEngine
} = {}) {
  const router = express.Router();
  const livenessSessions = new Map();
  const handoffSessions = new Map();
  const handoffTokens = new Map();

  async function resolveReviewStore() {
    if (reviewStore) return reviewStore;
    try {
      const mod = await import('../db/identityReviewStore.js');
      return mod.identityReviewStore || mod.default || null;
    } catch (error) {
      console.warn('[Verification] identityReviewStore unavailable:', error.message);
      return null;
    }
  }

  function getSessionForUser(sessionId, userId) {
    const session = livenessSessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      livenessSessions.delete(sessionId);
      return null;
    }
    if (session.userId !== userId) return null;
    return session;
  }

  function pruneExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of livenessSessions) {
      if (session.expiresAt <= now) livenessSessions.delete(sessionId);
    }
  }

  function pruneExpiredHandoffs() {
    const now = Date.now();
    for (const [sessionId, session] of handoffSessions) {
      if (session.closed || session.expiresAt <= now ||
          (session.redeemedAt && now - session.lastActivityAt > HANDOFF_IDLE_TTL_MS)) {
        handoffSessions.delete(sessionId);
        if (session.tokenHash) handoffTokens.delete(session.tokenHash.toString('hex'));
      }
    }
  }

  function getHandoffSession(req, sessionId, { touch = false } = {}) {
    const session = handoffSessions.get(sessionId);
    if (!session || session.closed || session.expiresAt <= Date.now()) return null;
    const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (secretMatches(accessToken, session.accessTokenHash)) {
      session.lastActivityAt = Date.now();
      session.expiresAt = Date.now() + HANDOFF_IDLE_TTL_MS;
      return session;
    }
    const sessionKey = req.get('x-verification-session-key');
    if (secretMatches(sessionKey, session.sessionKeyHash)) {
      if (touch) {
        session.lastActivityAt = Date.now();
        session.expiresAt = Date.now() + HANDOFF_IDLE_TTL_MS;
      }
      return session;
    }
    return null;
  }

  function requireVerificationAccess(req, res, next) {
    const accessToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (accessToken) {
      pruneExpiredHandoffs();
      for (const session of handoffSessions.values()) {
        if (session.redeemedAt && !session.closed && session.expiresAt > Date.now() &&
            secretMatches(accessToken, session.accessTokenHash)) {
          session.lastActivityAt = Date.now();
          session.expiresAt = Date.now() + HANDOFF_IDLE_TTL_MS;
          req.verificationHandoff = session;
          return next();
        }
      }
      return res.status(401).json({ error: 'This verification link is no longer active.' });
    }
    return requireAuthenticatedUser(req, res, next, { allowIdentityVerification: true });
  }

  function createHandoffToken(session) {
    if (session.tokenHash) handoffTokens.delete(session.tokenHash.toString('hex'));
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSecret(token);
    session.tokenHash = tokenHash;
    session.tokenExpiresAt = Date.now() + HANDOFF_TOKEN_TTL_MS;
    handoffTokens.set(tokenHash.toString('hex'), session.id);
    return token;
  }

  function handoffResponse(session, token) {
    return {
      sessionId: session.id,
      token,
      expiresAt: session.tokenExpiresAt
    };
  }

  const faceMatchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Please try again later.' }
  });

  const livenessSessionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    keyGenerator: getVerificationRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification sessions. Please try again later.' }
  });

  const livenessFrameLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 900,
    keyGenerator: getVerificationRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many liveness frames. Please restart verification later.' }
  });

  const cameraQualityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 900,
    keyGenerator: getVerificationRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many camera quality checks. Please restart verification later.' }
  });

  const documentAnalyzeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: getVerificationRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many document analysis attempts. Please try again later.' }
  });

  const confirmNameLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    keyGenerator: getVerificationRateLimitKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many name update attempts. Please try again later.' }
  });

  const handoffLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification links. Please try again later.' }
  });

  const uploadImages = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RECORDING_BYTES, files: 4, fields: 10, parts: 14 },
    fileFilter(_req, file, callback) {
      const supportedImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      const supportedVideo = file.fieldname === 'recording' &&
        ['video/mp4', 'video/webm'].includes(file.mimetype);
      if (!supportedImage && !supportedVideo) {
        return callback(new TypeError('Use JPEG, PNG, or WebP images and an MP4 or WebM recording.'));
      }
      return callback(null, true);
    }
  }).fields([
    { name: 'document', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'recording', maxCount: 1 }
  ]);

  function parseImages(req, res, next) {
    uploadImages(req, res, (error) => {
      if (!error) return next();
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? 'Images must be 10 MB or smaller and the recording must be 30 MB or smaller.'
          : 'Upload a document image, selfie image, and one liveness recording.';
        return res.status(400).json({ error: message });
      }
      if (error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    });
  }

  function parseDocumentImage(req, res, next) {
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 5, parts: 8 },
      fileFilter(_request, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          return callback(new TypeError('Identity documents must be JPEG, PNG, or WebP images.'));
        }
        return callback(null, true);
      }
    }).fields([
      { name: 'document', maxCount: 1 },
      { name: 'documentBack', maxCount: 1 }
    ])(req, res, error => {
      if (!error) {
        req.file = req.files?.document?.[0] || null;
        req.documentBackFile = req.files?.documentBack?.[0] || null;
        return next();
      }
      if (error instanceof multer.MulterError || error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    });
  }

  function parseCameraFrame(req, res, next) {
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
      fileFilter(_request, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          return callback(new TypeError('Camera frames must be JPEG, PNG, or WebP images.'));
        }
        return callback(null, true);
      }
    }).single('frame')(req, res, error => {
      if (!error) return next();
      if (error instanceof multer.MulterError || error instanceof TypeError) {
        return res.status(400).json({ error: error.message });
      }
      return next(error);
    });
  }

  // QR Handoff Endpoints
  router.post('/handoff', requireIdentityVerificationUser, sendNoStore, handoffLimiter, (req, res) => {
    pruneExpiredHandoffs();
    const id = randomBytes(24).toString('base64url');
    const sessionKey = randomBytes(32).toString('base64url');
    const session = {
      id,
      sessionKeyHash: hashSecret(sessionKey),
      accessTokenHash: null,
      tokenHash: null,
      tokenExpiresAt: 0,
      expiresAt: Date.now() + HANDOFF_IDLE_TTL_MS,
      lastActivityAt: Date.now(),
      redeemedAt: null,
      closed: false,
      status: 'waiting',
      result: null,
      userId: req.activeUser.id
    };
    handoffSessions.set(id, session);
    const token = createHandoffToken(session);
    return res.status(201).json({ ...handoffResponse(session, token), sessionKey });
  });

  router.post('/handoff/:sessionId/rotate', sendNoStore, (req, res) => {
    pruneExpiredHandoffs();
    const session = getHandoffSession(req, req.params.sessionId, { touch: true });
    if (!session || session.redeemedAt) {
      return res.status(404).json({ error: 'This verification link is no longer available.' });
    }
    const token = createHandoffToken(session);
    return res.status(201).json(handoffResponse(session, token));
  });

  router.get('/handoff/:sessionId/status', sendNoStore, (req, res) => {
    pruneExpiredHandoffs();
    const session = getHandoffSession(req, req.params.sessionId);
    if (!session || !secretMatches(req.get('x-verification-session-key'), session.sessionKeyHash)) {
      return res.status(404).json({ error: 'This verification session is no longer available.' });
    }
    return res.json({ status: session.status, result: session.result });
  });

  router.post('/handoff/redeem', sendNoStore, handoffLimiter, (req, res) => {
    pruneExpiredHandoffs();
    const token = req.body?.token;
    if (typeof token !== 'string' || token.length > 128) {
      return res.status(400).json({ error: 'This verification link is invalid or expired.' });
    }
    const tokenHash = hashSecret(token);
    const sessionId = handoffTokens.get(tokenHash.toString('hex'));
    const session = sessionId ? handoffSessions.get(sessionId) : null;
    if (!session || session.closed || session.redeemedAt ||
        session.tokenExpiresAt <= Date.now() ||
        !secretMatches(token, session.tokenHash)) {
      return res.status(410).json({ error: 'This verification link is invalid or expired. Scan the refreshed QR code.' });
    }
    handoffTokens.delete(session.tokenHash.toString('hex'));
    session.tokenHash = null;
    session.tokenExpiresAt = 0;
    session.redeemedAt = Date.now();
    session.expiresAt = Date.now() + HANDOFF_IDLE_TTL_MS;
    session.lastActivityAt = Date.now();
    session.status = 'connected';
    const accessToken = randomBytes(32).toString('base64url');
    session.accessTokenHash = hashSecret(accessToken);
    return res.json({ sessionId, accessToken });
  });

  router.post('/handoff/:sessionId/close', sendNoStore, (req, res) => {
    const session = getHandoffSession(req, req.params.sessionId);
    if (!session) return res.status(204).end();
    session.closed = true;
    if (session.tokenHash) handoffTokens.delete(session.tokenHash.toString('hex'));
    for (const [livenessId, livenessSession] of livenessSessions) {
      if (livenessSession.userId === `handoff:${session.id}`) livenessSessions.delete(livenessId);
    }
    handoffSessions.delete(session.id);
    return res.status(204).end();
  });

  // Local Sharp Liveness & Camera Quality Endpoints
  router.post(
    '/liveness/session',
    requireVerificationAccess,
    livenessSessionLimiter,
    sendNoStore,
    (req, res) => {
      const userId = getRequestOwner(req);
      if (!userId) return res.status(401).json({ error: 'Authentication is required.' });
      if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'selfie');

      pruneExpiredSessions();
      const sessionId = randomBytes(18).toString('base64url');
      const challengeTypes = pickRandomChallenges(LIVENESS_CHALLENGE_COUNT);
      const challenges = challengeTypes.map(type => ({
        type,
        instruction: CHALLENGE_INSTRUCTIONS[type]
      }));

      livenessSessions.set(sessionId, {
        userId,
        challenges: challengeTypes,
        stepIndex: 0,
        complete: false,
        startedAt: Date.now(),
        completedAt: null,
        frameCount: 0,
        failedFrameCount: 0,
        replayRejections: 0,
        frameHashes: new Set(),
        lastFrameThumb: null,
        frameEntropies: [],
        frameDeltas: [],
        poseState: {},
        expiresAt: Date.now() + LIVENESS_SESSION_TTL_MS
      });

      return res.status(201).json({
        session_id: sessionId,
        sessionId,
        challenges,
        expires_in_seconds: Math.round(LIVENESS_SESSION_TTL_MS / 1000)
      });
    }
  );

  router.post(
    '/liveness/:sessionId/frame',
    requireVerificationAccess,
    livenessFrameLimiter,
    sendNoStore,
    parseCameraFrame,
    async (req, res) => {
      const sessionId = req.params.sessionId;
      const session = getSessionForUser(sessionId, getRequestOwner(req));
      if (!session || session.complete) {
        return res.status(404).json({ error: 'Liveness session is unavailable. Restart verification.' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'A camera frame is required.' });
      }

      session.frameCount += 1;

      try {
        const frame = await analyzeCameraFrame(req.file);
        if (frame.width < MIN_CAMERA_WIDTH || frame.height < MIN_CAMERA_HEIGHT) {
          session.failedFrameCount += 1;
          return res.status(400).json({
            error: `Camera frame resolution must be at least ${MIN_CAMERA_WIDTH}x${MIN_CAMERA_HEIGHT}.`,
            action_detected: false
          });
        }
        if (frame.brightness < MIN_FRAME_BRIGHTNESS) {
          session.failedFrameCount += 1;
          return res.status(400).json({
            error: 'Camera frame is too dark or blank. Please ensure adequate lighting.',
            action_detected: false,
            quality: { brightness: frame.brightness, sharpness: frame.sharpness }
          });
        }

        if (session.lastFrameThumb) {
          const delta = computeThumbDelta(frame.thumb32, session.lastFrameThumb);
          if (session.frameHashes.has(frame.frameHash) || (delta !== null && delta < 0.75)) {
            session.failedFrameCount += 1;
            session.replayRejections += 1;
            return res.status(400).json({
              error: 'Static or identical camera frame detected. Please perform the requested movement naturally.',
              action_detected: false,
              replayDetected: true,
              quality: { brightness: frame.brightness, sharpness: frame.sharpness }
            });
          }
          if (delta !== null) {
            session.frameDeltas.push(delta);
          }
        }

        session.lastFrameThumb = frame.thumb32;
        session.frameHashes.add(frame.frameHash);
        session.frameEntropies.push(frame.entropy);

        const currentIndex = session.stepIndex;
        const challengeType = session.challenges[currentIndex];
        const frameMime = req.file?.mimetype || (frame.format === 'png' ? 'image/png' : frame.format === 'webp' ? 'image/webp' : 'image/jpeg');
        let resolvedPose = null;

        if (typeof geminiVerifier.verifyLivenessChallengeFrameWithGemini === 'function') {
          const visionCheck = await geminiVerifier.verifyLivenessChallengeFrameWithGemini({
            frameBuffer: req.file.buffer,
            mimeType: frameMime,
            challengeType
          });
          if (visionCheck && visionCheck.fallback === false) {
            resolvedPose = visionCheck;
          }
        }

        if (!resolvedPose && faceEngine && typeof faceEngine.verifyActiveChallengeFrame === 'function') {
          resolvedPose = await faceEngine.verifyActiveChallengeFrame({
            frameBuffer: req.file.buffer,
            challengeType,
            sessionState: session.poseState || (session.poseState = {})
          });
        }

        if (resolvedPose) {
          if (!resolvedPose.faceDetected) {
            session.failedFrameCount += 1;
            return res.status(200).json({
              challenge_index: currentIndex,
              complete: false,
              action_detected: false,
              faceDetected: false,
              guidance: resolvedPose.guidance || 'no_face',
              challenge_type: challengeType,
              challengeType,
              passed: false,
              challengesRemaining: Math.max(0, session.challenges.length - session.stepIndex),
              state: 'in_progress',
              quality: {
                brightness: frame.brightness,
                sharpness: frame.sharpness
              }
            });
          }
          if (!resolvedPose.actionDetected) {
            return res.status(200).json({
              challenge_index: currentIndex,
              complete: false,
              action_detected: false,
              faceDetected: true,
              guidance: resolvedPose.guidance || 'perform_action',
              challenge_type: challengeType,
              challengeType,
              passed: false,
              challengesRemaining: Math.max(0, session.challenges.length - session.stepIndex),
              state: 'in_progress',
              quality: {
                brightness: frame.brightness,
                sharpness: frame.sharpness
              }
            });
          }
        }

        session.stepIndex += 1;
        if (session.stepIndex >= session.challenges.length) {
          session.complete = true;
          session.completedAt = Date.now();
        }

        return res.status(200).json({
          challenge_index: currentIndex,
          complete: session.complete,
          action_detected: true,
          faceDetected: true,
          challenge_type: challengeType,
          challengeType,
          passed: true,
          challengesRemaining: Math.max(0, session.challenges.length - session.stepIndex),
          state: session.complete ? 'completed' : 'in_progress',
          quality: {
            brightness: frame.brightness,
            sharpness: frame.sharpness
          }
        });
      } catch (error) {
        session.failedFrameCount += 1;
        return res.status(400).json({
          error: error instanceof TypeError ? error.message : 'Use a valid camera frame.',
          action_detected: false
        });
      }
    }
  );

  router.post(
    '/liveness/quality',
    requireVerificationAccess,
    cameraQualityLimiter,
    sendNoStore,
    parseCameraFrame,
    async (req, res) => {
      if (!req.file) return res.status(400).json({ error: 'A camera frame is required.' });
      try {
        const frame = await analyzeCameraFrame(req.file);
        const quality = {
          brightness: frame.brightness,
          sharpness: frame.sharpness
        };

        if (frame.width < MIN_CAMERA_WIDTH || frame.height < MIN_CAMERA_HEIGHT) {
          return res.json({ ready: false, guidance: 'move_closer', quality });
        }
        if (frame.brightness < MIN_FRAME_BRIGHTNESS) {
          return res.json({ ready: false, guidance: 'too_dark', quality });
        }
        if (frame.brightness > 250 && frame.sharpness < 2) {
          return res.json({ ready: false, guidance: 'too_bright', quality });
        }

        const requirePassportFraming = String(req.query?.mode || '').trim().toLowerCase() === 'passport';
        const frameMime = req.file?.mimetype || (frame.format === 'png' ? 'image/png' : frame.format === 'webp' ? 'image/webp' : 'image/jpeg');

        if (typeof geminiVerifier.inspectLivenessQualityWithGemini === 'function') {
          const visionQuality = await geminiVerifier.inspectLivenessQualityWithGemini({
            frameBuffer: req.file.buffer,
            mimeType: frameMime,
            requirePassportFraming
          });

          if (visionQuality && visionQuality.fallback === false) {
            return res.json({
              ready: Boolean(visionQuality.ready),
              faceDetected: Boolean(visionQuality.faceDetected),
              passportQuality: Boolean(visionQuality.passportQuality),
              guidance: visionQuality.ready ? null : (visionQuality.guidance || 'no_face'),
              quality
            });
          }
        }

        if (faceEngine && typeof faceEngine.inspectFullFaceFrame === 'function') {
          const localQuality = await faceEngine.inspectFullFaceFrame({
            frameBuffer: req.file.buffer,
            requirePassportFraming
          });
          return res.json({
            ready: Boolean(localQuality.ready),
            faceDetected: Boolean(localQuality.faceDetected),
            fullFaceVisible: Boolean(localQuality.fullFaceVisible),
            passportQuality: Boolean(localQuality.passportQuality),
            guidance: localQuality.ready ? null : (localQuality.guidance || 'no_face'),
            quality
          });
        }

        return res.json({
          ready: true,
          guidance: null,
          quality
        });
      } catch (error) {
        if (error instanceof TypeError || error.name === 'InputError' || error.name === 'MetadataError') {
          return res.status(400).json({ error: 'Use a valid camera frame.' });
        }
        return res.status(400).json({ error: 'Use a valid camera frame.' });
      }
    }
  );

  router.get('/review-status', requireIdentityVerificationUser, sendNoStore, async (req, res) => {
    try {
      const store = await resolveReviewStore();
      const userId = req.activeUser?.id;
      let latest = null;
      if (store?.listReviews && userId) {
        const result = await store.listReviews({ userId, limit: 1 });
        latest = Array.isArray(result?.reviews) ? result.reviews[0] || null : null;
      }
      return res.json({
        success: true,
        identityVerified: req.activeUser?.identityVerified === true,
        identityVerificationRequired: req.activeUser?.identityVerificationRequired === true,
        reviewStatus: latest
          ? (latest.isPermanentlyClosed ? 'permanently_closed' : (latest.status || null))
          : null,
        reviewId: latest?.id || null,
        reviewReason: latest?.reviewReason || null,
        submittedAt: latest?.createdAt || null
      });
    } catch {
      return res.status(503).json({ error: 'Verification status is temporarily unavailable.' });
    }
  });

  router.delete(
    '/liveness/:sessionId',
    requireVerificationAccess,
    sendNoStore,
    (req, res) => {
      const session = getSessionForUser(req.params.sessionId, getRequestOwner(req));
      if (session) livenessSessions.delete(req.params.sessionId);
      if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'selfie_check_failed');
      return res.status(204).end();
    }
  );

  // Document Pre-Analysis & Name Confirmation Endpoints
  router.post(
    '/document-analyze',
    requireVerificationAccess,
    documentAnalyzeLimiter,
    sendNoStore,
    parseDocumentImage,
    async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ error: 'An identity document image is required.' });
      }

      try {
        const format = await getValidImageFormat(req.file);
        if (!format) {
          return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP document image.' });
        }
        let backFormat = null;
        if (req.documentBackFile) {
          backFormat = await getValidImageFormat(req.documentBackFile);
          if (!backFormat) {
            return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP document back image.' });
          }
        }

        const userId = req.activeUser?.id || req.verificationHandoff?.userId;
        let user = req.activeUser || null;
        if (userId) {
          try {
            const dbUser = await MasterDB.findUserByIdentifier(userId);
            if (dbUser) user = dbUser;
          } catch {
            // Best-effort lookup when running without active DB in unit tests
          }
        }

        const documentType = req.body?.documentType
          ? normalizeDocumentType(req.body.documentType)
          : 'national_id';
        const accountDob = normalizeIsoDate(user?.dateOfBirth || user?.birthday) ||
          (user?.dateOfBirth ? String(user.dateOfBirth).slice(0, 10) : '');

        const analysis = await geminiVerifier.analyzeIdentityDocumentWithGemini({
          documentBuffer: req.file.buffer,
          mimeType: imageTypes.get(format),
          ...(backFormat && req.documentBackFile ? {
            backBuffer: req.documentBackFile.buffer,
            backMimeType: imageTypes.get(backFormat)
          } : {}),
          documentType,
          expectedName: user?.name || '',
          expectedDob: accountDob,
          expectedEmail: user?.email || '',
          expectedAddress: user?.address || user?.billingDetails?.address || ''
        });

        const fallbackToManual = Boolean(analysis.fallbackToManual);
        const aiStatus = analysis.aiStatus || (fallbackToManual ? 'fallback' : 'ok');

        if (!fallbackToManual && user?.id) {
          const store = await resolveReviewStore();
          const dupCheck = await handleDuplicateDocumentCheck({
            req,
            res,
            store,
            targetUser: user,
            extracted: analysis.extracted,
            documentType,
            telemetry: {
              clientIp: req.ip || null,
              stage: 'document_analyze'
            }
          });
          if (dupCheck.duplicate) return;
        }

        const nameMismatch = !fallbackToManual && Boolean(analysis.nameMismatch);
        const dobMismatch = !fallbackToManual && (
          typeof analysis.dobMismatch === 'boolean'
            ? analysis.dobMismatch
            : evaluateDobMatch(analysis.extracted?.dateOfBirth, accountDob)
        );
        const needsNameCorrection = !fallbackToManual && Boolean(
          nameMismatch || dobMismatch || analysis.needsNameCorrection
        );

        return res.status(200).json({
          success: true,
          aiStatus,
          fallbackToManual,
          accountName: user?.name || '',
          accountDob,
          extracted: analysis.extracted || {},
          nameMismatch,
          dobMismatch,
          needsNameCorrection,
          message: fallbackToManual
            ? 'Automatic document analysis is unavailable; you may continue and submit for manual review.'
            : (nameMismatch || dobMismatch)
              ? 'Your document name or date of birth does not match your account profile.'
              : 'Document analyzed successfully.'
        });
      } catch (error) {
        if (error instanceof TypeError || error.name === 'InputError' || error.name === 'MetadataError') {
          return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP document image.' });
        }
        console.error('[Verification] Document analyze failed:', error.message);
        const fallbackDob = req.activeUser?.dateOfBirth
          ? String(req.activeUser.dateOfBirth).slice(0, 10)
          : '';
        return res.status(200).json({
          success: true,
          aiStatus: 'fallback',
          fallbackToManual: true,
          accountName: req.activeUser?.name || '',
          accountDob: fallbackDob,
          extracted: {},
          nameMismatch: false,
          dobMismatch: false,
          needsNameCorrection: false,
          message: 'Automatic document analysis is unavailable; you may continue and submit for manual review.'
        });
      }
    }
  );

  router.post(
    '/confirm-name',
    requireVerificationAccess,
    confirmNameLimiter,
    sendNoStore,
    async (req, res) => {
      const rawName = req.body?.fullName;
      if (typeof rawName !== 'string') {
        return res.status(400).json({ error: 'Full name is required.' });
      }
      const cleanFullName = rawName.replace(/\s+/g, ' ').trim();
      if (cleanFullName.length < 2 || cleanFullName.length > 120 || /[\x00-\x1f\x7f]/.test(cleanFullName)) {
        return res.status(400).json({ error: 'Full name must be between 2 and 120 valid characters.' });
      }

      let cleanDob = null;
      if (req.body?.dateOfBirth !== undefined && req.body.dateOfBirth !== null && String(req.body.dateOfBirth).trim() !== '') {
        cleanDob = normalizeIsoDate(req.body.dateOfBirth);
        if (!cleanDob) {
          return res.status(400).json({ error: 'Date of birth must be a valid YYYY-MM-DD date.' });
        }
      }

      let cleanAddress = null;
      if (req.body?.address !== undefined && req.body.address !== null && String(req.body.address).trim() !== '') {
        if (typeof req.body.address !== 'string') {
          return res.status(400).json({ error: 'Address must be a valid string.' });
        }
        cleanAddress = req.body.address.replace(/\s+/g, ' ').trim();
        if (cleanAddress.length < 2 || cleanAddress.length > 300 || /[\x00-\x1f\x7f]/.test(cleanAddress)) {
          return res.status(400).json({ error: 'Address must be between 2 and 300 valid characters.' });
        }
      }

      const userId = req.activeUser?.id || req.verificationHandoff?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication is required.' });
      }

      try {
        const existingUser = await MasterDB.findUserByIdentifier(userId);
        if (!existingUser) {
          return res.status(404).json({ error: 'The account for this verification session no longer exists.' });
        }
        const updates = {
          name: cleanFullName,
          ...(cleanDob ? { dateOfBirth: cleanDob } : {}),
          ...(cleanAddress ? { address: cleanAddress } : {})
        };
        await MasterDB.updateUser(existingUser.id, updates);
        return res.status(200).json({
          success: true,
          fullName: cleanFullName,
          ...(cleanDob ? { dateOfBirth: cleanDob } : {}),
          ...(cleanAddress ? { address: cleanAddress } : {})
        });
      } catch (error) {
        console.error('[Verification] Name confirmation failed:', error.message);
        return res.status(503).json({ error: 'Could not update your account details. Please try again.' });
      }
    }
  );

  // Multimodal Gemini Face Match & Evidence Verification Endpoint
  router.post(
    '/face-match',
    requireVerificationAccess,
    faceMatchLimiter,
    sendNoStore,
    parseImages,
    async (req, res) => {
      const document = req.files?.document?.[0];
      const documentBack = req.files?.documentBack?.[0] || null;
      const selfie = req.files?.selfie?.[0];
      const recording = req.files?.recording?.[0];
      const livenessSessionId = req.body?.livenessSessionId;
      const livenessSession = typeof livenessSessionId === 'string'
        ? getSessionForUser(livenessSessionId, getRequestOwner(req))
        : null;

      if (!document || !selfie || !recording || !livenessSession?.complete) {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'incomplete_submission');
        return res.status(400).json({ error: 'Complete the live camera challenges and submit their recording.' });
      }
      if (req.body?.consent !== 'true') {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'consent_required');
        return res.status(400).json({ error: 'Consent is required before biometric processing.' });
      }
      if (document.size > MAX_IMAGE_BYTES || selfie.size > MAX_IMAGE_BYTES) {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'image_too_large');
        return res.status(400).json({ error: 'Each image must be 10 MB or smaller.' });
      }

      try {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'processing');
        const [documentFormat, selfieFormat] = await Promise.all([
          getValidImageFormat(document),
          getValidImageFormat(selfie)
        ]);
        if (!documentFormat || !selfieFormat) {
          if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'invalid_image');
          return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP image.' });
        }

        const mp4Recording = await convertRecordingToMp4(recording);
        livenessSessions.delete(livenessSessionId);

        document.detectedFormat = documentFormat;
        selfie.detectedFormat = selfieFormat;
        if (documentBack) {
          const backFmt = await getValidImageFormat(documentBack);
          if (backFmt) documentBack.detectedFormat = backFmt;
        }

        const documentType = req.body?.documentType
          ? normalizeDocumentType(req.body.documentType)
          : 'national_id';
        const userId = req.activeUser?.id || req.verificationHandoff?.userId;

        let expectedUser = req.activeUser || null;
        if (userId) {
          try {
            const dbUser = await MasterDB.findUserByIdentifier(userId);
            if (dbUser) expectedUser = dbUser;
          } catch {
            // Optional pre-lookup for Gemini hints; strict check occurs on persistence paths
          }
        }

        const activeLivenessComplete = Boolean(livenessSession.complete);
        const expectedDob = normalizeIsoDate(expectedUser?.dateOfBirth || expectedUser?.birthday) ||
          (expectedUser?.dateOfBirth ? String(expectedUser.dateOfBirth).slice(0, 10) : '');
        const geminiRes = await geminiVerifier.matchDocumentAndSelfieWithGemini({
          documentBuffer: document.buffer,
          documentMimeType: imageTypes.get(documentFormat),
          selfieBuffer: selfie.buffer,
          selfieMimeType: imageTypes.get(selfieFormat),
          documentType,
          expectedName: expectedUser?.name || '',
          expectedDob,
          expectedAddress: expectedUser?.address || expectedUser?.billingDetails?.address || '',
          livenessPassed: activeLivenessComplete
        });

        const telemetry = collectZeroTrustTelemetry(req, livenessSession, geminiRes);
        const store = await resolveReviewStore();

        // Check for duplicate identity document across already-verified accounts before proceeding
        let documentFingerprint = null;
        let identityHash = null;
        if (!geminiRes.fallbackToManual && expectedUser?.id) {
          const dupResult = await handleDuplicateDocumentCheck({
            req,
            res,
            store,
            targetUser: expectedUser,
            extracted: geminiRes.extracted,
            documentType,
            telemetry,
            onBeforeBan: async () => {
              try {
                const storedEvidence = await identityVerificationEvidence.store({
                  user: expectedUser,
                  document,
                  selfie,
                  recording: mp4Recording,
                  documentType
                });
                return extractStoredEvidenceFiles(storedEvidence);
              } catch (evidenceErr) {
                console.warn('[Verification] Could not store duplicate-document evidence:', evidenceErr.message);
                return [];
              }
            }
          });
          if (dupResult.duplicate) return;
          documentFingerprint = dupResult.documentFingerprint;
          identityHash = dupResult.identityHash;
        } else {
          ({ documentFingerprint, identityHash } = computeDocumentHashes(geminiRes.extracted));
        }

        // Path 1: Gemini API unavailable / disabled / exhausted / unparseable -> Manual Admin Review
        if (geminiRes.fallbackToManual === true) {
          const verificationUser = await MasterDB.findUserByIdentifier(userId);
          if (!verificationUser) {
            throw new Error('The account for this verification session no longer exists.');
          }

          const storedEvidence = await identityVerificationEvidence.store({
            user: verificationUser,
            document,
            ...(documentBack?.detectedFormat ? { documentBack } : {}),
            selfie,
            recording: mp4Recording,
            documentType
          });
          const evidenceFiles = extractStoredEvidenceFiles(storedEvidence);

          let reviewId = null;
          if (store?.createOrUpdateReview) {
            const reviewRecord = await store.createOrUpdateReview({
              userId: verificationUser.id,
              tiwiId: verificationUser.tiwiId || verificationUser.storeId || '',
              userName: verificationUser.name || '',
              userEmail: verificationUser.email || '',
              documentType,
              status: 'pending_review',
              source: 'gemini_fallback',
              aiReason: geminiRes.error || 'Gemini API unavailable',
              extractedData: buildReviewExtractedData(geminiRes.extracted),
              evidenceFiles,
              documentFingerprint,
              identityHash,
              telemetry,
              metadata: { ...telemetry, documentFingerprint, identityHash }
            });
            reviewId = reviewRecord?.id || reviewRecord?.reviewId || null;
          }

          if (req.verificationHandoff) {
            setHandoffStatus(req.verificationHandoff, 'manual_review', 'pending_manual_review');
          }

          recordSecurityEvent({
            eventType: 'identity.verification_manual_review',
            severity: 'info',
            userId: verificationUser.id,
            subject: verificationUser.email,
            details: {
              reason: geminiRes.error || 'Gemini API unavailable',
              reviewId,
              countryMismatch: telemetry.countryMismatch
            }
          }).catch(err => console.warn('[Verification] Security event log failed:', err.message));

          return res.status(202).json({
            success: true,
            manualReview: true,
            status: 'pending_review',
            reviewId,
            isMatch: false,
            isLive: activeLivenessComplete,
            reason: 'manual_review_submitted',
            message: 'Verification submitted for manual admin review.'
          });
        }

        // Path 2: Gemini auto-approved match + active liveness + Name & DOB match
        if (geminiRes.isMatch === true && activeLivenessComplete) {
          const verificationUser = await MasterDB.findUserByIdentifier(userId);
          if (!verificationUser) {
            throw new Error('The account for this verification session no longer exists.');
          }

          const resolvedExpectedName = String(verificationUser.name || expectedUser?.name || '').trim();
          const resolvedExpectedDob =
            normalizeIsoDate(verificationUser.dateOfBirth || verificationUser.birthday) ||
            expectedDob ||
            '';
          const extractedName = geminiRes.extracted?.fullName || null;
          const extractedDob = geminiRes.extracted?.dateOfBirth || null;

          const nameMismatch =
            Boolean(resolvedExpectedName && extractedName) &&
            evaluateNameMatch(extractedName, resolvedExpectedName, geminiRes.nameMatchesAccount).nameMismatch;
          const dobMismatch =
            Boolean(resolvedExpectedDob && extractedDob) &&
            evaluateDobMatch(extractedDob, resolvedExpectedDob);

          if (nameMismatch || dobMismatch) {
            const mismatchReason = nameMismatch ? 'name_mismatch' : 'dob_mismatch';
            const mismatchMessage = nameMismatch
              ? 'The name on your identity document does not match your Tiwlo account name.'
              : 'The date of birth on your identity document does not match your Tiwlo account.';
            if (req.verificationHandoff) {
              setHandoffStatus(req.verificationHandoff, 'failed', mismatchReason);
            }
            return res.status(200).json({
              success: true,
              isMatch: false,
              isLive: activeLivenessComplete,
              reason: mismatchReason,
              nameMismatch,
              dobMismatch,
              accountName: resolvedExpectedName,
              accountDob: resolvedExpectedDob,
              extracted: {
                fullName: extractedName,
                dateOfBirth: extractedDob,
                address: geminiRes.extracted?.address || null,
                country: geminiRes.extracted?.country || null
              },
              message: mismatchMessage
            });
          }

          const storedEvidence = await identityVerificationEvidence.store({
            user: verificationUser,
            document,
            ...(documentBack?.detectedFormat ? { documentBack } : {}),
            selfie,
            recording: mp4Recording,
            documentType
          });
          const evidenceFiles = extractStoredEvidenceFiles(storedEvidence);

          const attestation = generateVerificationAttestation({
            userId: verificationUser.id,
            documentBuffer: document.buffer,
            selfieBuffer: selfie.buffer,
            recordingBuffer: mp4Recording
          });

          try {
            if (store?.createOrUpdateReview) {
              await store.createOrUpdateReview({
                userId: verificationUser.id,
                tiwiId: verificationUser.tiwiId || verificationUser.storeId || '',
                userName: verificationUser.name || '',
                userEmail: verificationUser.email || '',
                documentType,
                status: 'accepted',
                source: 'gemini_auto',
                aiConfidence: geminiRes.confidenceScore ?? null,
                extractedData: buildReviewExtractedData(geminiRes.extracted),
                evidenceFiles,
                documentFingerprint,
                identityHash,
                attestation,
                telemetry,
                metadata: { ...telemetry, attestation, documentFingerprint, identityHash }
              });
            }
          } catch (reviewErr) {
            console.warn('[Verification] Non-fatal audit review persistence error:', reviewErr.message);
          }

          await completeIdentityVerification(userId, req.verificationHandoff ? 'qr_handoff' : 'direct');

          if (req.verificationHandoff) {
            setHandoffStatus(req.verificationHandoff, 'success', null);
            req.verificationHandoff.accessTokenHash = null;
          }

          return res.status(200).json({
            success: true,
            isMatch: true,
            isLive: true,
            passiveLiveness: true,
            confidenceScore: geminiRes.confidenceScore ?? null,
            reason: null,
            attestation
          });
        }

        // Path 3: Gemini returned a mismatch / unclear face / spoof rejection (no API failure)
        const reason = geminiRes.reason || 'face_mismatch';
        if (req.verificationHandoff) {
          setHandoffStatus(req.verificationHandoff, 'failed', reason);
        }

        return res.status(200).json({
          success: true,
          isMatch: false,
          isLive: activeLivenessComplete,
          reason,
          message: geminiRes.message || null
        });
      } catch (error) {
        if (req.verificationHandoff) {
          setHandoffStatus(req.verificationHandoff, 'failed', 'verification_error');
        }
        if (error.name === 'InputError' || error.name === 'MetadataError' ||
            error.code === 'ERR_INPUT_IMAGE_TOO_LARGE' || error instanceof TypeError) {
          return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP image.' });
        }
        console.error('[Verification] Verification processing failed:', error.message);
        return res.status(503).json({ error: 'The verification service could not process these images.' });
      }
    }
  );

  return router;
}

export default createVerificationRouter();
