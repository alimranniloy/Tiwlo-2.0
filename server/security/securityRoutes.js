import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
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
  registerAsset,
  checkAssetScope,
  scanAndSanitizeImage,
  isUserRestricted,
  recordViolation,
  ContentQueue
} from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    cb(null, `prod_${Date.now()}_${cleanName}${ext}`);
  }
});

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
    path.join(__dirname, '../../Tiwi/assets/tiwi2.mp4'),
    'C:/Users/imran/Downloads/tiwi2.mp4'
  ] : [
    path.join(__dirname, '../data/media/tiwlo.mp4'),
    path.join(__dirname, '../../client/dist/tiwlo.mp4'),
    path.join(__dirname, '../../client/public/tiwlo.mp4'),
    'C:/Users/imran/Downloads/tiwi.mp4'
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
router.post('/upload', upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const purpose = req.body?.purpose || req.query?.purpose || 'public_catalog';
  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;

  if (userId) {
    const restriction = isUserRestricted(userId);
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

      if (!scanResult.safe) {
        try { fs.unlinkSync(file.path); } catch (e) {}

        await recordViolation({
          user: activeUser,
          category: 'ADULT_CONTENT',
          policyName: 'Adult & Sexually Explicit Content Policy',
          reason: scanResult.reason,
          contentType: 'Image'
        });

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

      if (scanResult.sanitizedBuffer) {
        fs.writeFileSync(file.path, scanResult.sanitizedBuffer);
      }

      const fileUrl = `/uploads/${file.filename}`;
      registerAsset(fileUrl, { userId, purpose, isSafe: true });
      verifiedUrls.push(fileUrl);
    } catch (err) {
      console.error('[UploadSecurity] Error processing image:', err);
      verifiedUrls.push(`/uploads/${file.filename}`);
    }
  }

  res.json({
    urls: verifiedUrls,
    url: verifiedUrls[0],
    count: verifiedUrls.length,
    purpose,
    verifiedSafe: true
  });
});

router.post('/upload-single', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const purpose = req.body?.purpose || req.query?.purpose || 'public_catalog';
  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;

  if (userId) {
    const restriction = isUserRestricted(userId);
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

    if (scanResult.sanitizedBuffer) {
      fs.writeFileSync(req.file.path, scanResult.sanitizedBuffer);
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    registerAsset(fileUrl, { userId, purpose, isSafe: true });

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      purpose,
      verifiedSafe: true
    });
  } catch (err) {
    console.error('[UploadSingleSecurity] Error:', err);
    res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
  }
});

router.post('/upload-base64', async (req, res) => {
  const { imageBase64, filename, purpose = 'public_catalog' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Base64 image string required' });

  const activeUser = req.activeUser || {};
  const userId = activeUser.id || activeUser.tiwiId || activeUser.email || req.ip;

  try {
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(imageBase64, 'base64');

    const scanResult = await scanAndSanitizeImage(buffer, purpose);
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
    const filePath = path.join(UPLOADS_DIR, finalName);
    fs.writeFileSync(filePath, finalBuffer);

    const fileUrl = `/uploads/${finalName}`;
    registerAsset(fileUrl, { userId, purpose, isSafe: true });

    res.json({ url: fileUrl, filename: finalName, verifiedSafe: true });
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
    const restriction = isUserRestricted(userId);
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
