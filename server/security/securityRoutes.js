import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { createTemporaryFileStorage } from '../db/temporaryFileStorage.js';
import { requireAuthenticatedUser } from './authGuards.js';
import { deleteMedia, getPublicMediaUrl, inferMediaType, storeMedia } from '../db/mediaStorage.js';
import {
  createMediaSessionTicket,
  validateMediaSessionTicket,
  streamSecureMedia
} from './secureMediaStream.js';
import {
  moderateContent,
  checkUrlSafety,
  generateUploadToken,
  verifyUploadToken,
  checkAssetScope,
  scanAndSanitizeImage,
  isUserRestricted,
  recordViolation,
  ContentQueue
} from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storage = createTemporaryFileStorage('secure-upload');

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

const router = express.Router();

// ==========================================
// PROTECTED LOADING SCREEN VIDEO STREAMING
// ==========================================
router.post('/media/session-ticket', (req, res) => {
  try {
    const ticketData = createMediaSessionTicket(req);
    res.json({ success: true, ...ticketData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate secure media session ticket' });
  }
});

router.get('/media/stream/:ticket', (req, res) => {
  const { ticket } = req.params;
  const validation = validateMediaSessionTicket(ticket, req);

  if (!validation.valid) {
    return res.status(403).json({
      error: 'Access denied: Invalid, expired, or unauthorized media session',
      reason: validation.reason
    });
  }

  const isApp = req.query.app === '1' || req.query.type === 'app';
  const candidatePaths = isApp ? [
    path.join(__dirname, '../data/media/tiwi2.mp4'),
    path.join(__dirname, '../../Tiwi/assets/tiwi2.mp4')
  ] : [
    path.join(__dirname, '../data/media/tiwlo.mp4'),
    path.join(__dirname, '../../client/dist/tiwlo.mp4'),
    path.join(__dirname, '../../client/public/tiwlo.mp4')
  ];
  const videoFile = candidatePaths.find(p => fs.existsSync(p));

  if (!videoFile) {
    return res.status(404).json({ error: 'Protected video asset unavailable' });
  }

  streamSecureMedia(req, res, videoFile);
});

// ==========================================
// MEDIA UPLOADS & INSPECTION
// ==========================================
// Apply the guard before multer can write files or inspection work can start.
router.use(['/upload', '/upload-single', '/upload-base64', '/upload-async', '/security'], requireAuthenticatedUser);

router.post('/upload', upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  if (req.files.some((file) => file.mimetype && !file.mimetype.startsWith('image/'))) {
    req.files.forEach((file) => {
      try { fs.unlinkSync(file.path); } catch (error) {
        console.error('[UploadSecurity] Could not remove non-image upload:', error.message);
      }
    });
    return res.status(415).json({ error: 'Only image files are accepted by this endpoint.' });
  }

  const purpose = req.body?.purpose || req.query?.purpose || 'public_catalog';
  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;

  if (userId) {
    const restriction = await isUserRestricted(userId);
    if (restriction.restricted) {
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(403).json({
        error: 'ACCOUNT_RESTRICTED',
        code: restriction.action,
        message: restriction.reason
      });
    }
  }

  const verifiedUrls = [];

  for (const file of req.files) {
    try {
      const buffer = fs.readFileSync(file.path);
      const scanResult = await scanAndSanitizeImage(buffer, purpose, file.originalname);

      if (scanResult.isVideo) {
        req.files.forEach((uploadedFile) => {
          try { fs.unlinkSync(uploadedFile.path); } catch (error) {
            console.error('[UploadSecurity] Could not remove video from image upload:', error.message);
          }
        });
        await Promise.all(verifiedUrls.map((url) => deleteMedia(url).catch((cleanupError) => {
          console.error('[UploadSecurity] Could not remove earlier media after video rejection:', cleanupError.message);
        })));
        return res.status(415).json({ error: 'Video files are not accepted by this image endpoint.' });
      }

      if (!scanResult.safe) {
        try { fs.unlinkSync(file.path); } catch (e) {}

        await recordViolation({
          user: activeUser,
          category: 'ADULT_CONTENT',
          policyName: 'Adult & Sexually Explicit Content Policy',
          reason: scanResult.reason,
          contentType: 'Image'
        });
        await Promise.all(verifiedUrls.map((url) => deleteMedia(url).catch((cleanupError) => {
          console.error('[UploadSecurity] Could not remove earlier media after policy rejection:', cleanupError.message);
        })));

        req.files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (e) {}
        });

        return res.status(400).json({
          error: 'CONTENT_POLICY_VIOLATION',
          code: 'ADULT_CONTENT',
          policyName: 'Adult & Sexually Explicit Content Policy',
          reason: scanResult.reason,
          message: `Upload rejected: ${scanResult.reason}`
        });
      }

      const fileUrl = `/uploads/${file.filename}`;
      await storeMedia({
        aliases: [fileUrl],
        buffer: scanResult.sanitizedBuffer || buffer,
        contentType: inferMediaType(file.filename),
        originalFilename: file.originalname,
        ownerId: userId,
        purpose
      });
      await fs.promises.unlink(file.path);
      verifiedUrls.push(fileUrl);
    } catch (err) {
      console.error('[UploadSecurity] Error processing image:', err);
      await Promise.all(verifiedUrls.map((url) => deleteMedia(url).catch((cleanupError) => {
        console.error('[UploadSecurity] Could not remove incomplete database upload:', cleanupError.message);
      })));
      req.files.forEach(uploadedFile => {
        try { fs.unlinkSync(uploadedFile.path); } catch (cleanupError) {
          console.error('[UploadSecurity] Could not remove unverified upload:', cleanupError);
        }
      });
      return res.status(503).json({
        error: 'CONTENT_SAFETY_UNAVAILABLE',
        message: 'Content inspection is temporarily unavailable. Please retry later.'
      });
    }
  }

  res.json({
    urls: await Promise.all(verifiedUrls.map(getPublicMediaUrl)),
    url: await getPublicMediaUrl(verifiedUrls[0]),
    count: verifiedUrls.length,
    purpose,
    verifiedSafe: true
  });
});

router.post('/upload-single', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (req.file.mimetype && !req.file.mimetype.startsWith('image/')) {
    try { fs.unlinkSync(req.file.path); } catch (error) {
      console.error('[UploadSingleSecurity] Could not remove non-image upload:', error.message);
    }
    return res.status(415).json({ error: 'Only image files are accepted by this endpoint.' });
  }

  const purpose = req.body?.purpose || req.query?.purpose || 'public_catalog';
  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;
  let storedUrl = null;

  if (userId) {
    const restriction = await isUserRestricted(userId);
    if (restriction.restricted) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({
        error: 'ACCOUNT_RESTRICTED',
        code: restriction.action,
        message: restriction.reason
      });
    }
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const scanResult = await scanAndSanitizeImage(buffer, purpose, req.file.originalname);

    if (scanResult.isVideo) {
      await fs.promises.unlink(req.file.path);
      return res.status(415).json({ error: 'Video files are not accepted by this image endpoint.' });
    }

    if (!scanResult.safe) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      await recordViolation({
        user: activeUser,
        category: 'ADULT_CONTENT',
        policyName: 'Adult & Sexually Explicit Content Policy',
        reason: scanResult.reason,
        contentType: 'Image'
      });
      return res.status(400).json({
        error: 'CONTENT_POLICY_VIOLATION',
        code: 'ADULT_CONTENT',
        policyName: 'Adult & Sexually Explicit Content Policy',
        reason: scanResult.reason,
        message: `Upload rejected: ${scanResult.reason}`
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    await storeMedia({
      aliases: [fileUrl],
      buffer: scanResult.sanitizedBuffer || buffer,
      contentType: inferMediaType(req.file.filename),
      originalFilename: req.file.originalname,
      ownerId: userId,
      purpose
    });
    storedUrl = fileUrl;
    await fs.promises.unlink(req.file.path);
    res.json({
      url: await getPublicMediaUrl(fileUrl),
      filename: req.file.filename,
      purpose,
      verifiedSafe: true
    });
  } catch (err) {
    console.error('[UploadSingleSecurity] Error:', err);
    if (storedUrl) {
      await deleteMedia(storedUrl).catch((cleanupError) => {
        console.error('[UploadSingleSecurity] Could not remove incomplete database upload:', cleanupError.message);
      });
    }
    try { fs.unlinkSync(req.file.path); } catch (cleanupError) {
      console.error('[UploadSingleSecurity] Could not remove unverified upload:', cleanupError);
    }
    return res.status(503).json({
      error: 'CONTENT_SAFETY_UNAVAILABLE',
      message: 'Content inspection is temporarily unavailable. Please retry later.'
    });
  }
});

router.post('/upload-base64', async (req, res) => {
  const { imageBase64, filename, purpose = 'public_catalog' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Base64 image string required' });

  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;

  try {
    const matches = imageBase64.match(/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,(.+)$/i);
    if (/^data:/i.test(imageBase64) && !matches) {
      return res.status(415).json({ error: 'Only JPEG, PNG, WebP, GIF, and AVIF images are supported.' });
    }
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(imageBase64, 'base64');
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image payload must be between 1 byte and 15 MB.' });
    }

    const scanResult = await scanAndSanitizeImage(buffer, purpose);
    if (scanResult.isVideo) {
      return res.status(415).json({ error: 'Video files are not accepted by this image endpoint.' });
    }
    if (!scanResult.safe) {
      await recordViolation({
        user: activeUser,
        category: 'ADULT_CONTENT',
        policyName: 'Adult & Sexually Explicit Content Policy',
        reason: scanResult.reason,
        contentType: 'Image'
      });
      return res.status(400).json({
        error: 'CONTENT_POLICY_VIOLATION',
        code: 'ADULT_CONTENT',
        policyName: 'Adult & Sexually Explicit Content Policy',
        reason: scanResult.reason,
        message: `Upload rejected: ${scanResult.reason}`
      });
    }

    const finalBuffer = scanResult.sanitizedBuffer || buffer;
    const ext = matches ? (matches[1].split('/')[1] || 'jpg') : 'jpg';
    const finalName = `prod_${Date.now()}_${(filename || 'image').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20)}.${ext}`;
    const fileUrl = `/uploads/${finalName}`;
    await storeMedia({
      aliases: [fileUrl],
      buffer: finalBuffer,
      contentType: inferMediaType(finalName),
      originalFilename: filename || finalName,
      ownerId: userId,
      purpose
    });
    res.json({ url: await getPublicMediaUrl(fileUrl), filename: finalName, verifiedSafe: true });
  } catch (err) {
    console.error('Base64 upload error:', err);
    res.status(500).json({ error: 'Failed to process base64 image' });
  }
});

router.post('/security/check-content', (req, res) => {
  const { text, context = 'public_feed' } = req.body;
  const result = moderateContent(text, context);
  res.json(result);
});

router.post('/security/request-upload-token', (req, res) => {
  const { purpose = 'public_catalog' } = req.body;
  const userId = req.activeUser?.id || req.ip;
  const token = generateUploadToken({ userId, purpose });
  res.json({ token, purpose, expiresIn: 600 });
});

router.post('/upload-async', upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const purpose = req.body?.purpose || req.query?.purpose || 'public_catalog';
  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;

  if (userId) {
    const restriction = await isUserRestricted(userId);
    if (restriction.restricted) {
      req.files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch (e) {}
      });
      return res.status(403).json({
        error: 'ACCOUNT_RESTRICTED',
        code: restriction.action,
        message: restriction.reason
      });
    }
  }

  const tickets = [];
  for (const file of req.files) {
    const ticket = await ContentQueue.enqueue({
      tempFilePath: file.path,
      originalFilename: file.originalname,
      purpose,
      user: activeUser,
      priority: purpose === 'user_avatar' ? 1 : 2
    });
    tickets.push(ticket);
  }

  res.status(202).json({
    status: 'QUEUED_FOR_INSPECTION',
    tickets,
    ticket: tickets[0],
    count: tickets.length,
    estimatedWaitSeconds: tickets[0]?.estimatedWaitSeconds || 10,
    message: 'Media accepted into multi-lane security queue. Inspection completing in background.'
  });
});

router.get('/security/ticket/:ticketId', (req, res) => {
  const status = ContentQueue.getTicketStatus(req.params.ticketId);
  if (!status) {
    return res.status(404).json({ error: 'Inspection ticket not found or expired' });
  }
  res.json(status);
});

router.get('/security/queue-stats', (req, res) => {
  res.json({
    status: 'HEALTHY',
    laneCount: ContentQueue.laneCount,
    activeWorkers: ContentQueue.activeWorkers,
    queueLength: ContentQueue.queue.length,
    stats: ContentQueue.stats,
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
  });
});

export default router;
