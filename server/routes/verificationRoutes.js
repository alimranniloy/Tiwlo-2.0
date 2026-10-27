import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import sharp from 'sharp';
import { requireAuthenticatedUser } from '../security/authGuards.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 20_000_000;
const router = express.Router();
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

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 2, fields: 1, parts: 3 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new TypeError('Only JPEG, PNG, and WebP images are supported.'));
    }
    return callback(null, true);
  }
}).fields([
  { name: 'document', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]);

function parseImages(req, res, next) {
  uploadImages(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Each image must be 10 MB or smaller.'
        : 'Upload one document image and one selfie image.';
      return res.status(400).json({ error: message });
    }
    if (error instanceof TypeError) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  });
}

async function getValidImageFormat(file) {
  if (!file) return null;
  const metadata = await sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  return metadata.width && metadata.height && imageTypes.has(metadata.format)
    ? metadata.format
    : null;
}

function toEngineFile(form, name, file) {
  const mediaType = imageTypes.get(file.detectedFormat);
  form.append(
    name,
    new Blob([file.buffer], { type: mediaType }),
    `${name}.${file.detectedFormat}`
  );
}

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
    if (!document || !selfie) {
      return res.status(400).json({ error: 'Upload a document image and a selfie.' });
    }
    if (req.body?.consent !== 'true') {
      return res.status(400).json({ error: 'Consent is required before biometric processing.' });
    }

    try {
      const [documentFormat, selfieFormat] = await Promise.all([
        getValidImageFormat(document),
        getValidImageFormat(selfie)
      ]);
      if (!documentFormat || !selfieFormat) {
        return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP image.' });
      }

      document.detectedFormat = documentFormat;
      selfie.detectedFormat = selfieFormat;

      const body = new FormData();
      toEngineFile(body, 'image1', document);
      toEngineFile(body, 'image2', selfie);
      const sharedToken = process.env.OPENBIOMETRICS_SHARED_TOKEN ||
        (process.env.NODE_ENV === 'production' ? '' : 'local-dev-only-token');
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
          error.code === 'ERR_INPUT_IMAGE_TOO_LARGE') {
        return res.status(400).json({ error: 'Use a valid JPEG, PNG, or WebP image.' });
      }
      console.error('[Verification] Biometric processing failed:', error.message);
      return res.status(503).json({ error: 'The verification service could not process these images.' });
    }
  }
);

export default router;
