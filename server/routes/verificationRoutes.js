import express from 'express';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import { requireAuthenticatedUser } from '../security/authGuards.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_RECORDING_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const LIVENESS_SESSION_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TOKEN_TTL_MS = 5 * 60 * 1000;
const HANDOFF_IDLE_TTL_MS = 30 * 60 * 1000;
const router = express.Router();
const livenessSessions = new Map();
const handoffSessions = new Map();
const handoffTokens = new Map();
const challengeTypes = new Set(['turn_left', 'turn_right', 'open_mouth', 'blink']);
const imageTypes = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp']
]);

const faceMatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please try again later.' }
});

const livenessSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification sessions. Please try again later.' }
});

const livenessFrameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many liveness frames. Please restart verification later.' }
});

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECORDING_BYTES, files: 3, fields: 2, parts: 5 },
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

function getSharedToken() {
  return process.env.OPENBIOMETRICS_SHARED_TOKEN ||
    (process.env.NODE_ENV === 'production' ? '' : 'local-dev-only-token');
}

function getEngineUrl(path) {
  return new URL(
    path,
    process.env.OPENBIOMETRICS_API_URL || 'http://127.0.0.1:8000'
  );
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

function sendNoStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

function hashSecret(secret) {
  return createHash('sha256').update(secret).digest();
}

function secretMatches(secret, expectedHash) {
  if (typeof secret !== 'string' || !expectedHash) return false;
  const actualHash = hashSecret(secret);
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
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

function getRequestOwner(req) {
  if (req.activeUser?.id !== undefined) return String(req.activeUser.id);
  if (req.verificationHandoff) return `handoff:${req.verificationHandoff.id}`;
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
  return requireAuthenticatedUser(req, res, next);
}

function setHandoffStatus(session, status, result = null) {
  if (!session) return;
  session.status = status;
  session.result = result;
  session.lastActivityAt = Date.now();
}

async function getValidImageFormat(file) {
  if (!file) return null;
  const metadata = await sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  return metadata.width && metadata.height && imageTypes.has(metadata.format)
    ? metadata.format
    : null;
}

async function toEngineFrame(file) {
  const format = await getValidImageFormat(file);
  if (!format) return null;
  return sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toBuffer();
}

function toEngineFile(form, name, file) {
  const mediaType = imageTypes.get(file.detectedFormat);
  form.append(
    name,
    new Blob([file.buffer], { type: mediaType }),
    `${name}.${file.detectedFormat}`
  );
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
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
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
      reject(error);
    });
    ffmpeg.once('close', code => {
      clearTimeout(timeout);
      if (outputSize > MAX_RECORDING_BYTES) {
        reject(new TypeError('The converted MP4 recording exceeds 30 MB.'));
        return;
      }
      if (code !== 0) {
        reject(new TypeError(errorOutput || 'The liveness recording could not be converted.'));
        return;
      }
      const mp4 = Buffer.concat(output);
      if (mp4.length < 12 || mp4.toString('ascii', 4, 8) !== 'ftyp') {
        reject(new TypeError('The converted recording is not a valid MP4 file.'));
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

const handoffLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification links. Please try again later.' }
});

router.post('/handoff', sendNoStore, handoffLimiter, (req, res) => {
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
    result: null
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

router.post(
  '/liveness/session',
  requireVerificationAccess,
  livenessSessionLimiter,
  sendNoStore,
  async (req, res) => {
    const userId = getRequestOwner(req);
    if (!userId) return res.status(401).json({ error: 'Authentication is required.' });
    if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'selfie');
    const sharedToken = getSharedToken();
    if (!sharedToken) {
      return res.status(503).json({ error: 'The verification service is not configured.' });
    }

    try {
      const engineResponse = await fetch(
        getEngineUrl('/api/v1/liveness/sessions?preset=verification'),
        {
          method: 'POST',
          headers: { 'x-tiwlo-biometrics-token': sharedToken },
          signal: AbortSignal.timeout(30_000)
        }
      );
      if (!engineResponse.ok) {
        return res.status(503).json({ error: 'Active liveness checks are unavailable.' });
      }

      const result = await engineResponse.json();
      const challenges = result.challenges;
      if (
        typeof result.session_id !== 'string' ||
        !Array.isArray(challenges) ||
        challenges.length !== challengeTypes.size ||
        new Set(challenges.map(challenge => challenge.type)).size !== challengeTypes.size ||
        challenges.some(challenge => !challengeTypes.has(challenge.type))
      ) {
        return res.status(503).json({ error: 'The verification service returned an invalid challenge sequence.' });
      }

      pruneExpiredSessions();
      livenessSessions.set(result.session_id, {
        userId,
        expiresAt: Date.now() + LIVENESS_SESSION_TTL_MS,
        complete: false
      });
      return res.status(201).json({
        sessionId: result.session_id,
        challenges: challenges.map(challenge => ({
          type: challenge.type,
          instruction: challenge.instruction
        }))
      });
    } catch (error) {
      console.error('[Verification] Could not create liveness session:', error.message);
      return res.status(503).json({ error: 'Active liveness checks are temporarily unavailable.' });
    }
  }
);

router.post(
  '/liveness/:sessionId/frame',
  requireVerificationAccess,
  livenessFrameLimiter,
  sendNoStore,
  (req, res, next) => {
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
      fileFilter(_request, file, callback) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          return callback(new TypeError('Liveness frames must be JPEG, PNG, or WebP images.'));
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
  },
  async (req, res) => {
    const sessionId = req.params.sessionId;
    const session = getSessionForUser(sessionId, getRequestOwner(req));
    if (!session || session.complete) {
      return res.status(404).json({ error: 'Liveness session is unavailable. Restart verification.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'A camera frame is required.' });
    }

    const sharedToken = getSharedToken();
    if (!sharedToken) {
      return res.status(503).json({ error: 'The verification service is not configured.' });
    }

    try {
      const frame = await toEngineFrame(req.file);
      if (!frame) return res.status(400).json({ error: 'Use a valid camera frame.' });

      const body = new FormData();
      body.append('image', new Blob([frame], { type: 'image/jpeg' }), 'liveness-frame.jpg');
      const engineResponse = await fetch(
        getEngineUrl(`/api/v1/liveness/sessions/${encodeURIComponent(sessionId)}/frame`),
        {
          method: 'POST',
          body,
          headers: { 'x-tiwlo-biometrics-token': sharedToken },
          signal: AbortSignal.timeout(20_000)
        }
      );
      if (!engineResponse.ok) {
        if (engineResponse.status === 404) livenessSessions.delete(sessionId);
        return res.status(503).json({ error: 'The liveness frame could not be checked.' });
      }

      const result = await engineResponse.json();
      if (result.state === 'failed' || result.state === 'expired') {
        livenessSessions.delete(sessionId);
      }
      if (result.session_complete && result.is_live === true) session.complete = true;
      return res.status(200).json({
        challengeType: result.challenge_type,
        passed: result.passed,
        challengesRemaining: result.challenges_remaining,
        complete: session.complete,
        state: result.state
      });
    } catch (error) {
      console.error('[Verification] Liveness frame processing failed:', error.message);
      if (error.name === 'TimeoutError' || error.name === 'AbortError' ||
          error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({ error: 'The liveness service is temporarily unavailable.' });
      }
      if (error.name === 'InputError' || error.name === 'MetadataError' ||
          error.code === 'ERR_INPUT_IMAGE_TOO_LARGE') {
        return res.status(400).json({ error: 'Use a valid camera frame.' });
      }
      return res.status(503).json({ error: 'The liveness frame could not be checked.' });
    }
  }
);

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

router.post(
  '/face-match',
  requireVerificationAccess,
  faceMatchLimiter,
  (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    next();
  },
  parseImages,
  async (req, res) => {
    const document = req.files?.document?.[0];
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
      await convertRecordingToMp4(recording);
      livenessSessions.delete(livenessSessionId);

      document.detectedFormat = documentFormat;
      selfie.detectedFormat = selfieFormat;

      const body = new FormData();
      toEngineFile(body, 'image1', document);
      toEngineFile(body, 'image2', selfie);
      const sharedToken = getSharedToken();
      if (!sharedToken) {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'service_unavailable');
        return res.status(503).json({ error: 'The verification service is not configured.' });
      }
      const engineUrl = new URL(
        '/api/v1/verify',
        process.env.OPENBIOMETRICS_API_URL || 'http://127.0.0.1:8000'
      );
      const engineResponse = await fetch(engineUrl, {
        method: 'POST',
        body,
        headers: { 'x-tiwlo-biometrics-token': sharedToken },
        signal: AbortSignal.timeout(60_000)
      });

      if (engineResponse.status === 400 || engineResponse.status === 422) {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'image_check_failed');
        return res.status(200).json({
          success: true,
          isMatch: false,
          isLive: false,
          reason: 'image_check_failed'
        });
      }
      if (!engineResponse.ok) {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'service_unavailable');
        return res.status(503).json({ error: 'The verification service is temporarily unavailable.' });
      }

      const result = await engineResponse.json();
      const isLive = result.face2?.liveness?.is_live;
      if (typeof result.is_match !== 'boolean' || typeof isLive !== 'boolean') {
        if (req.verificationHandoff) setHandoffStatus(req.verificationHandoff, 'failed', 'service_unavailable');
        return res.status(503).json({ error: 'The verification service is not fully configured.' });
      }

      const isMatch = result.is_match && isLive;
      if (req.verificationHandoff) {
        setHandoffStatus(
          req.verificationHandoff,
          isMatch ? 'success' : 'failed',
          !isLive ? 'liveness_check_failed' : isMatch ? null : 'face_mismatch'
        );
        if (isMatch) req.verificationHandoff.accessTokenHash = null;
      }
      return res.status(200).json({
        success: true,
        isMatch,
        isLive,
        reason: !isLive ? 'liveness_check_failed' : result.is_match ? null : 'face_mismatch'
      });
    } catch (error) {
      if (req.verificationHandoff) {
        setHandoffStatus(
          req.verificationHandoff,
          'failed',
          error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'service_unavailable'
            : 'verification_error'
        );
      }
      if (error.name === 'TimeoutError' || error.name === 'AbortError' ||
          error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return res.status(503).json({ error: 'The verification service is temporarily unavailable.' });
      }
      if (error.name === 'InputError' || error.name === 'MetadataError' ||
          error.code === 'ERR_INPUT_IMAGE_TOO_LARGE' || error instanceof TypeError) {
        return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP image.' });
      }
      console.error('[Verification] Biometric processing failed:', error.message);
      return res.status(503).json({ error: 'The verification service could not process these images.' });
    }
  }
);

export default router;
