/**
 * Tiwlo Enterprise Media Security & Context Integrity Guard
 * 
 * - Cryptographic context signing (Prevents SMS/DM uploads from bypassing to Public Marketplace)
 * - Metadata stripping (EXIF, GPS, camera serials, malicious payload tags)
 * - NSFWJS content classification for public images
 * - Database-backed upload-scope enforcement
 */

import crypto from 'crypto';
import sharp from 'sharp';
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import '../config/loadRootEnv.js';
import { getMediaMetadata, normalizeMediaPath } from '../db/mediaStorage.js';

const HMAC_SECRET = process.env.SECURITY_HMAC_SECRET || process.env.SECURITY_SECRET || crypto.randomBytes(32).toString('hex');

const NSFW_CLASS_THRESHOLDS = new Map([
  ['Porn', 0.85],
  ['Hentai', 0.85],
  // The higher threshold avoids treating ordinary swimwear and fashion as explicit.
  ['Sexy', 0.97],
]);
let nsfwModelPromise = null;

async function getNsfwModel() {
  if (!nsfwModelPromise) {
    nsfwModelPromise = (async () => {
      await tf.setBackend('cpu');
      await tf.ready();
      return nsfwjs.load('MobileNetV2');
    })();
  }

  try {
    return await nsfwModelPromise;
  } catch (err) {
    nsfwModelPromise = null;
    throw err;
  }
}

async function classifyExplicitAdultContent(imageBuffer) {
  const { data, info } = await sharp(imageBuffer)
    .resize(224, 224, { fit: 'fill' })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const imageTensor = tf.tensor3d(
    Uint8Array.from(data),
    [info.height, info.width, info.channels],
    'int32'
  );

  try {
    const model = await getNsfwModel();
    const predictions = await model.classify(imageTensor);
    return predictions.find(({ className, probability }) => {
      const threshold = NSFW_CLASS_THRESHOLDS.get(className);
      return threshold !== undefined && probability >= threshold;
    });
  } finally {
    imageTensor.dispose();
  }
}

/**
 * 1. Cryptographic Context Token Generator
 * 
 * Used by web and mobile app when initializing an upload session.
 * Generates an HMAC-SHA256 signature binding the upload to its designated scope.
 * 
 * @param {{ userId: string, purpose: 'public_catalog' | 'public_feed' | 'direct_message' | 'user_avatar', expiresInSeconds?: number }}
 * @returns {string} Signed upload token
 */
export function generateUploadToken({ userId, purpose, expiresInSeconds = 600 }) {
  const payload = {
    userId: userId || 'anonymous',
    purpose: purpose || 'public_catalog',
    exp: Date.now() + (expiresInSeconds * 1000)
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

/**
 * 2. Upload Token Verifier
 * 
 * Validates token integrity and ensures upload purpose matches request.
 */
export function verifyUploadToken(token, expectedPurpose = null) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'Invalid or missing upload context token' };
  }

  const [encodedPayload, signature] = token.split('.');

  const expectedSig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (signature !== expectedSig) {
    return { valid: false, reason: 'Upload context signature mismatch (Tampering detected)' };
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (Date.now() > payload.exp) {
      return { valid: false, reason: 'Upload context token has expired' };
    }

    if (expectedPurpose && payload.purpose !== expectedPurpose) {
      return {
        valid: false,
        reason: `Context mismatch: Token is for "${payload.purpose}", but tried to use for "${expectedPurpose}"`
      };
    }

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, reason: 'Malformed upload context payload' };
  }
}

/**
 * 4. Anti-Bypass Enforcer (Prevents DM uploads from appearing in public marketplace)
 * 
 * Called when a product or public post is created or updated.
 * 
 * @param {string} assetUrl - URL or relative path of the media
 * @param {'public_catalog' | 'public_feed'} requiredScope
 * @returns {{ allowed: boolean, reason?: string }}
 */
export async function checkAssetScope(assetUrl, requiredScope = 'public_catalog') {
  if (!assetUrl || typeof assetUrl !== 'string') return { allowed: true };
  const storagePath = normalizeMediaPath(assetUrl);
  if (!storagePath) {
    if (/\/(?:api\/)?uploads?\//i.test(assetUrl)) {
      return { allowed: false, reason: 'Media URL is not a valid stored upload path.' };
    }
    return { allowed: true };
  }
  const record = await getMediaMetadata(storagePath);
  if (!record) return { allowed: true };

  // Private-message uploads cannot be republished to public surfaces.
  if (record.purpose === 'direct_message' && requiredScope.startsWith('public_')) {
    return {
      allowed: false,
      reason: 'Security Violation: Private message media cannot be published to the public marketplace or feeds.'
    };
  }

  return { allowed: true };
}

/**
 * 5. Image Sanitization & NSFWJS Classification
 *
 * Strips EXIF/GPS metadata and classifies public images with NSFWJS.
 *
 * @param {Buffer} fileBuffer - Raw uploaded image buffer
 * @param {string} purpose - 'public_catalog' | 'public_feed' | 'direct_message' | 'user_avatar'
 * @param {string} originalFilename - Original uploaded filename
 * @returns {Promise<{ safe: boolean, reason?: string, sanitizedBuffer?: Buffer, metadata?: object }>}
 */
export async function scanAndSanitizeImage(fileBuffer, purpose = 'public_catalog', originalFilename = '') {
  const isVideo = Boolean(
    (originalFilename && /\.(mp4|mov|webm|mkv|m4v|avi)(\?|$)/i.test(originalFilename)) ||
    (fileBuffer && fileBuffer.length >= 8 && fileBuffer.toString('utf8', 4, 8) === 'ftyp')
  );
  if (isVideo) {
    return {
      safe: true,
      isVideo: true,
      sanitizedBuffer: fileBuffer,
      metadata: { format: 'video' }
    };
  }

  let metadata;
  let sanitizedBuffer;
  try {
    metadata = await sharp(fileBuffer).metadata();
    sanitizedBuffer = await sharp(fileBuffer).rotate().toBuffer();
  } catch (err) {
    console.error('[scanAndSanitizeImage] Invalid image:', err.message);
    return {
      safe: false,
      isFormatError: true,
      reason: 'Unrecognized or corrupted image format. Please upload a standard JPG, PNG, or WebP image.'
    };
  }

  if (purpose && (purpose.startsWith('public_') || purpose === 'user_avatar')) {
    let adultPrediction;
    try {
      adultPrediction = await classifyExplicitAdultContent(sanitizedBuffer);
    } catch (err) {
      console.error('[NSFWJS] Image classification failed:', err);
      throw err;
    }

    if (adultPrediction) {
      return {
        safe: false,
        reason: `NSFWJS classified this image as ${adultPrediction.className} (${Math.round(adultPrediction.probability * 100)}% confidence).`,
        sanitizedBuffer,
        metadata: { width: metadata.width, height: metadata.height, format: metadata.format }
      };
    }
  }

  return {
    safe: true,
    sanitizedBuffer,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    }
  };
}

export default {
  generateUploadToken,
  verifyUploadToken,
  checkAssetScope,
  scanAndSanitizeImage
};
