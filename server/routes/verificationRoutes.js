import express from 'express';
import { spawn } from 'node:child_process';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import { requireAuthenticatedUser } from '../security/authGuards.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_RECORDING_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const LIVENESS_SESSION_TTL_MS = 10 * 60 * 1000;
const router = express.Router();
const livenessSessions = new Map();
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

router.post(
  '/liveness/session',
  requireAuthenticatedUser,
  livenessSessionLimiter,
  sendNoStore,
  async (req, res) => {
    const userId = String(req.activeUser.id);
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
  requireAuthenticatedUser,
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
    const session = getSessionForUser(sessionId, String(req.activeUser.id));
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
  requireAuthenticatedUser,
  sendNoStore,
  (req, res) => {
    const session = getSessionForUser(req.params.sessionId, String(req.activeUser.id));
    if (session) livenessSessions.delete(req.params.sessionId);
    return res.status(204).end();
  }
);

router.post(
  '/face-match',
  requireAuthenticatedUser,
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
      ? getSessionForUser(livenessSessionId, String(req.activeUser.id))
      : null;
    if (!document || !selfie || !recording || !livenessSession?.complete) {
      return res.status(400).json({ error: 'Complete the live camera challenges and submit their recording.' });
    }
    if (req.body?.consent !== 'true') {
      return res.status(400).json({ error: 'Consent is required before biometric processing.' });
    }
    if (document.size > MAX_IMAGE_BYTES || selfie.size > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Each image must be 10 MB or smaller.' });
    }

    try {
      const [documentFormat, selfieFormat] = await Promise.all([
        getValidImageFormat(document),
        getValidImageFormat(selfie)
      ]);
      if (!documentFormat || !selfieFormat) {
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
        return res.status(503).json({ error: 'The verification service is not configured.' });
      }
      const engineUrl = new URL(
        '/api/v1/faces/verify',
        process.env.OPENBIOMETRICS_API_URL || 'http://127.0.0.1:8000'
      );
      const engineResponse = await fetch(engineUrl, {
        method: 'POST',
        body,
        headers: { 'x-tiwlo-biometrics-token': sharedToken },
        signal: AbortSignal.timeout(60_000)
      });

      if (engineResponse.status === 400 || engineResponse.status === 422) {
        return res.status(200).json({
          success: true,
          isMatch: false,
          isLive: false,
          reason: 'image_check_failed'
        });
      }
      if (!engineResponse.ok) {
        return res.status(503).json({ error: 'The verification service is temporarily unavailable.' });
      }

      const result = await engineResponse.json();
      const isLive = result.face2?.liveness?.is_live;
      if (typeof result.is_match !== 'boolean' || typeof isLive !== 'boolean') {
        return res.status(503).json({ error: 'The verification service is not fully configured.' });
      }

      return res.status(200).json({
        success: true,
        isMatch: result.is_match && isLive,
        isLive,
        reason: !isLive ? 'liveness_check_failed' : result.is_match ? null : 'face_mismatch'
      });
    } catch (error) {
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
