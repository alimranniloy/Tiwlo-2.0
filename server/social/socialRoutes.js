import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SocialDB } from './socialDb.js';
import { executeSocialGraphQL } from './socialSchema.js';
import {
  contentSafetyMiddleware,
  scanAndSanitizeImage,
  registerAsset,
  checkAssetScope,
  recordViolation,
  isUserRestricted,
  moderateContent,
  enqueueVideoProcessing,
  getVideoProcessingStatus,
  getVideoDimensions
} from '../security/index.js';
import { MasterDB } from '../db/multiTenant.js';
import {
  generateSecureOtp,
  verifySecureOtp,
  getOtpSession,
  deleteOtpSession,
  sendTwoFactorOtpEmail,
  sendSignupVerificationOtpEmail
} from '../db/emailService.js';

function maskEmail(em) {
  if (!em || !em.includes('@')) return em || '';
  const [u, d] = em.split('@');
  if (u.length <= 2) return `${u[0]}***@${d}`;
  return `${u[0]}${'*'.repeat(Math.max(3, u.length - 2))}${u[u.length - 1]}@${d}`;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_UPLOAD_DIR = path.resolve(__dirname, '../../upload');

// Initialize database
SocialDB.init();

// Configure Multer storage to route into profile_pic, cover_pic, posts, or reels
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let subfolder = req.query.type || req.body.type || 'posts';
    // Validate folder
    const allowed = ['profile_pic', 'cover_pic', 'posts', 'reels'];
    if (!allowed.includes(subfolder)) {
      subfolder = 'posts';
    }
    const destDir = path.join(ROOT_UPLOAD_DIR, subfolder);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const timestamp = Date.now();
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
    cb(null, `${timestamp}_${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit for high-res photos and reels
});

const router = express.Router();

// ====================================================================
// 0. REAL-TIME AVAILABILITY CHECK
// ====================================================================
router.all('/check-availability', async (req, res) => {
  try {
    const email = req.query.email || req.body?.email || '';
    const handle = req.query.handle || req.body?.handle || '';
    // Only an authenticated account may exclude itself while editing a profile.
    // Never trust an arbitrary userId supplied by a registration form.
    const userId = getUserId(req);

    const result = await SocialDB.checkAvailability({ email, handle, userId });
    res.json(result);
  } catch (err) {
    console.error('[Check Availability Error]', err);
    res.status(500).json({ error: 'Availability check failed' });
  }
});

function resolveUploadLocalPath(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.includes('/api/upload/')) {
    return path.join(ROOT_UPLOAD_DIR, url.split('/api/upload/')[1]);
  }
  if (url.includes('/upload/')) {
    return path.join(ROOT_UPLOAD_DIR, url.split('/upload/')[1]);
  }
  if (url.includes('/api/uploads/')) {
    return path.join(__dirname, '../uploads', url.split('/api/uploads/')[1]);
  }
  if (url.includes('/uploads/')) {
    return path.join(__dirname, '../uploads', url.split('/uploads/')[1]);
  }
  return null;
}

// ====================================================================
// ASYNCHRONOUS POST MODERATION QUEUE (Background Worker)
// ====================================================================
const postModerationQueue = [];
let isModerationActive = false;

export function enqueuePostModeration(item) {
  postModerationQueue.push(item);
  setTimeout(processPostModerationQueue, 2000); // 2-second lead time so client receives post smoothly
}

async function processPostModerationQueue() {
  if (isModerationActive) return;
  if (postModerationQueue.length === 0) return;

  isModerationActive = true;
  try {
    while (postModerationQueue.length > 0) {
      const item = postModerationQueue.shift();
      await executePostModeration(item);
    }
  } catch (err) {
    console.error('[PostModerationQueue Error]', err);
  } finally {
    isModerationActive = false;
    if (postModerationQueue.length > 0) {
      setTimeout(processPostModerationQueue, 1000);
    }
  }
}

async function executePostModeration({ postId, author, images = [], caption = '' }) {
  if (!postId || !Array.isArray(images) || images.length === 0) return;

  for (const imgUrl of images) {
    if (!imgUrl || typeof imgUrl !== 'string') continue;

    // Resolve local path on disk from URL
    const localPath = resolveUploadLocalPath(imgUrl);

    if (!localPath || !fs.existsSync(localPath)) {
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      const filename = path.basename(localPath);
      const scanResult = await scanAndSanitizeImage(buffer, 'public_feed', filename);

      if (!scanResult.safe) {
        console.warn(`[Moderation] VIOLATION DETECTED in post ${postId} by user ${author?.id || author?.email}: ${scanResult.reason}`);

        // 1. Delete offending physical image from disk
        try {
          fs.unlinkSync(localPath);
          console.log(`[Moderation] Purged violating file: ${localPath}`);
        } catch (unlinkErr) {
          console.error(`[Moderation] Failed to delete file: ${localPath}`, unlinkErr.message);
        }

        // 2. Mark post as violated in SocialDB (replaces media with Community Standards notice)
        await SocialDB.markPostViolated(postId, {
          reason: scanResult.reason,
          policyName: 'Adult & Sexually Explicit Content Policy',
          removedAt: new Date().toISOString()
        });

        // 3. Issue Disciplinary Strike & send Warning/Ban Email
        const enforcement = await recordViolation({
          user: author,
          category: 'ADULT_CONTENT',
          policyName: 'Adult & Sexually Explicit Content Policy',
          reason: scanResult.reason,
          contentType: 'Public Feed Post'
        });

        console.log(`[Moderation] Enforcement executed: Action=${enforcement.actionTaken}, Strikes=${enforcement.strikes}`);
        // Post is already marked violated, stop scanning subsequent images of this post
        break;
      }
    } catch (scanErr) {
      console.error(`[Moderation] Scan error for ${localPath}:`, scanErr);
    }
  }
}

// ====================================================================
// AUTOMATIC RETROACTIVE CONTENT AUDIT
// ====================================================================
export async function runRetroactiveContentAudit() {
  console.log('[RetroactiveAudit] Auditing existing posts and avatars for community safety...');
  try {
    const sData = SocialDB.getData();
    let postsCleaned = 0;
    let filesPurged = 0;

    // 1. Audit all posts
    for (const post of (sData.posts || [])) {
      if (post.isPolicyViolated) continue;
      const images = Array.isArray(post.images) && post.images.length > 0 ? post.images : (post.image ? [post.image] : []);
      for (const imgUrl of images) {
        if (!imgUrl || typeof imgUrl !== 'string') continue;
        let localPath = null;
        if (imgUrl.includes('/upload/')) {
          localPath = path.join(ROOT_UPLOAD_DIR, imgUrl.split('/upload/')[1]);
        } else if (imgUrl.includes('/uploads/')) {
          localPath = path.join(__dirname, '../uploads', imgUrl.split('/uploads/')[1]);
        }
        if (!localPath || !fs.existsSync(localPath)) continue;

        try {
          const buffer = fs.readFileSync(localPath);
          const scan = await scanAndSanitizeImage(buffer, 'public_feed', path.basename(localPath));
          if (!scan.safe) {
            console.warn(`[RetroactiveAudit] Offending image found in post ${post.id} (${scan.reason}). Purging.`);
            try { fs.unlinkSync(localPath); filesPurged++; } catch (e) {}
            await SocialDB.markPostViolated(post.id, {
              reason: scan.reason,
              policyName: 'Adult & Sexually Explicit Content Policy',
              removedAt: new Date().toISOString()
            });
            postsCleaned++;
            break;
          }
        } catch (e) {}
      }
    }

    // 2. Audit all user avatars in master database and social profiles
    const master = MasterDB.getMasterData();
    let avatarsCleaned = 0;
    for (const u of (master.users || [])) {
      if (!u.avatar || u.avatar.includes('ui-avatars.com')) continue;
      let localPath = null;
      if (u.avatar.includes('/upload/')) {
        localPath = path.join(ROOT_UPLOAD_DIR, u.avatar.split('/upload/')[1]);
      } else if (u.avatar.includes('/uploads/')) {
        localPath = path.join(__dirname, '../uploads', u.avatar.split('/uploads/')[1]);
      }
      if (!localPath || !fs.existsSync(localPath)) continue;

      try {
        const buffer = fs.readFileSync(localPath);
        const scan = await scanAndSanitizeImage(buffer, 'user_avatar', path.basename(localPath));
        if (!scan.safe) {
          console.warn(`[RetroactiveAudit] Offending avatar found for user ${u.id || u.email}. Purging.`);
          try { fs.unlinkSync(localPath); filesPurged++; } catch (e) {}
          const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=0B57D0&color=fff&size=256&bold=true`;
          u.avatar = fallbackAvatar;
          if (sData.profiles && sData.profiles[u.id]) {
            sData.profiles[u.id].avatar = fallbackAvatar;
          }
          avatarsCleaned++;

          // Issue strike & notification for existing bad avatars
          await recordViolation({
            user: u,
            category: 'ADULT_CONTENT',
            policyName: 'Adult & Sexually Explicit Content Policy',
            reason: scan.reason,
            contentType: 'Profile Picture'
          });
        }
      } catch (e) {}
    }
    if (avatarsCleaned > 0) {
      MasterDB.saveMasterData(master);
      SocialDB.saveData(sData);
    }

    console.log(`[RetroactiveAudit] Completed: ${postsCleaned} posts marked violated, ${avatarsCleaned} avatars reset, ${filesPurged} files purged.`);
  } catch (err) {
    console.error('[RetroactiveAudit] Error during audit:', err);
  }
}

// Automatically trigger retroactive safety audit on boot
setTimeout(runRetroactiveContentAudit, 3000);

// ====================================================================
// 1. FILE UPLOAD ENDPOINT (Fast & Non-Blocking Ingestion)
// ====================================================================
router.get('/video-status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const mediaUrl = typeof req.query.url === 'string' ? req.query.url : '';
  let mediaPath;
  try {
    mediaPath = new URL(mediaUrl, 'https://tiwlo.com').pathname;
  } catch (error) {
    return res.status(400).json({ error: 'Invalid video URL' });
  }

  const match = mediaPath.match(/^\/(?:api\/)?upload\/(posts|reels)\/([a-zA-Z0-9_-]+\.(?:mp4|mov|webm|mkv|m4v|avi))$/i);
  if (!match) {
    return res.status(400).json({ error: 'Invalid video URL' });
  }

  const filePath = path.resolve(ROOT_UPLOAD_DIR, match[1], match[2]);
  const uploadRoot = `${path.resolve(ROOT_UPLOAD_DIR)}${path.sep}`;
  if (!filePath.startsWith(uploadRoot)) {
    return res.status(400).json({ error: 'Invalid video URL' });
  }

  const optimizedFilename = `${path.basename(match[2], path.extname(match[2]))}_optimized.mp4`;
  const optimizedPath = path.join(ROOT_UPLOAD_DIR, match[1], optimizedFilename);
  const playbackPath = fs.existsSync(optimizedPath) ? optimizedPath : filePath;
  const playbackStats = fs.existsSync(playbackPath) ? fs.statSync(playbackPath) : null;
  const videoSize = await getVideoDimensions(playbackPath);
  const status = playbackPath === optimizedPath
    ? 'ready'
    : getVideoProcessingStatus(filePath);

  return res.json({
    status,
    playbackUrl: playbackPath === optimizedPath
      ? `/api/upload/${match[1]}/${optimizedFilename}`
      : null,
    videoSize,
    version: playbackStats ? `${playbackStats.mtimeMs}-${playbackStats.size}` : null,
  });
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    let subfolder = req.query.type || req.body?.type || 'posts';
    const allowed = ['profile_pic', 'cover_pic', 'posts', 'reels'];
    if (!allowed.includes(subfolder)) {
      subfolder = 'posts';
    }
    const destDir = path.join(ROOT_UPLOAD_DIR, subfolder);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const user = await getUserContext(req);
    const currentUserId = user.id || 'anonymous';
    const purpose = subfolder === 'profile_pic' ? 'user_avatar' : 'public_feed';

    if (currentUserId === 'anonymous') {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Account restriction check: permanently disabled users cannot upload
    if (currentUserId && currentUserId !== 'anonymous') {
      const restriction = isUserRestricted(currentUserId);
      if (restriction.restricted && restriction.action === 'PERMANENTLY_DISABLED') {
        if (req.file) {
          try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(403).json({
          error: 'ACCOUNT_DISABLED',
          code: restriction.action,
          message: restriction.reason
        });
      }
    }

    // 1. Standard Multipart File
    if (req.file) {
      const filePath = req.file.path;
      const filename = req.file.filename;

      // Strict Synchronous Audit for Profile & Cover Photos
      if (subfolder === 'profile_pic' || subfolder === 'cover_pic') {
        const buffer = fs.readFileSync(filePath);
        const scanResult = await scanAndSanitizeImage(buffer, 'user_avatar', filename);
        if (!scanResult.safe) {
          try { fs.unlinkSync(filePath); } catch (e) {}
          const enforcement = await recordViolation({
            user,
            category: 'ADULT_CONTENT',
            policyName: 'Adult & Sexually Explicit Content Policy',
            reason: scanResult.reason,
            contentType: subfolder === 'profile_pic' ? 'Profile Picture' : 'Cover Photo'
          });
          return res.status(400).json({
            error: 'CONTENT_POLICY_VIOLATION',
            reason: scanResult.reason,
            policyName: 'Adult & Sexually Explicit Content Policy',
            message: 'This photo violates Tiwlo Community Standards on adult content and cannot be used.',
            enforcement
          });
        }
      }

      const relativeUrl = `/api/upload/${subfolder}/${filename}`;
      const legacyUrl = `/upload/${subfolder}/${filename}`;
      registerAsset(relativeUrl, { userId: currentUserId, purpose, isSafe: true });
      registerAsset(legacyUrl, { userId: currentUserId, purpose, isSafe: true });

      // Video Pipeline: Immediate zero-wait HTTP response + background FFmpeg optimization
      //  - Extracts 1-second poster thumbnail (.jpg)
      //  - 18+ adult content moderation on sampled frames
      //  - Transcodes to universal 8-bit YUV420P + FastStart (fixes Android ExoPlayer black screen)
      const isVideo = /\.(mp4|mov|webm|mkv|m4v|avi)(\?|$)/i.test(filename) || req.file?.mimetype?.startsWith('video/');
      if (isVideo) {
        enqueueVideoProcessing({
          filePath,
          relativeUrl,
          userId: currentUserId,
          subfolder,
        });
      }

      return res.json({
        success: true,
        url: relativeUrl,
        filename,
        type: subfolder,
        size: req.file.size,
        verifiedSafe: true,
        isVideo,
      });
    }

    // 2. Base64 JSON Payload Fallback (100% immune to React Native FormData issues)
    const rawBase64 = req.body?.base64 || req.body?.data;
    if (rawBase64) {
      const cleanBase64 = rawBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `${Date.now()}_img_${Math.random().toString(36).substring(2, 8)}.jpg`;
      const filePath = path.join(destDir, filename);

      // Strict Synchronous Audit for Profile & Cover Photos
      if (subfolder === 'profile_pic' || subfolder === 'cover_pic') {
        const scanResult = await scanAndSanitizeImage(buffer, 'user_avatar', filename);
        if (!scanResult.safe) {
          const enforcement = await recordViolation({
            user,
            category: 'ADULT_CONTENT',
            policyName: 'Adult & Sexually Explicit Content Policy',
            reason: scanResult.reason,
            contentType: subfolder === 'profile_pic' ? 'Profile Picture' : 'Cover Photo'
          });
          return res.status(400).json({
            error: 'CONTENT_POLICY_VIOLATION',
            reason: scanResult.reason,
            policyName: 'Adult & Sexually Explicit Content Policy',
            message: 'This photo violates Tiwlo Community Standards on adult content and cannot be used.',
            enforcement
          });
        }
      }

      fs.writeFileSync(filePath, buffer);

      const relativeUrl = `/api/upload/${subfolder}/${filename}`;
      const legacyUrl = `/upload/${subfolder}/${filename}`;
      registerAsset(relativeUrl, { userId: currentUserId, purpose, isSafe: true });
      registerAsset(legacyUrl, { userId: currentUserId, purpose, isSafe: true });

      return res.json({
        success: true,
        url: relativeUrl,
        filename,
        type: subfolder,
        size: buffer.length,
        verifiedSafe: true
      });
    }

    return res.status(400).json({ error: 'No file or base64 image received.' });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// ====================================================================
// 2. GRAPHQL ENDPOINT
// ====================================================================
router.post('/graphql', async (req, res) => {
  const { query, variables } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'GraphQL query required' });
  }
  try {
    const result = await executeSocialGraphQL(query, variables);
    res.json(result);
  } catch (err) {
    console.error('GraphQL Execution Error:', err);
    res.status(500).json({ errors: [{ message: err.message }] });
  }
});

// ====================================================================
// 3. AUTH & USER REST ENDPOINTS
// Authentication is handled by the shared /api/auth routes.
// ====================================================================
router.post('/register', async (req, res) => {
  const { name, email, handle, password, accountType = 'personal', birthday, gender, phone, billingAddress } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }
  try {
    const result = await SocialDB.registerUser({ name, email, handle, password, accountType, birthday, gender, phone, billingAddress });
    const user = result.user;
    const verifyOtp = generateSecureOtp(user.email, 'email_verify', 15);
    const masked = maskEmail(user.email);

    await sendSignupVerificationOtpEmail({
      to: user.email,
      name: user.name,
      code: verifyOtp.code
    }).catch(e => console.warn('[Tiwi Register Email Warning]', e.message));

    res.status(201).json({
      success: true,
      requiresEmailVerification: true,
      tempToken: verifyOtp.token,
      email: user.email,
      emailMasked: masked,
      message: `A 6-digit verification code was sent to ${masked}. Please verify your email to continue.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { tempToken, otpCode } = req.body;
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = verifySecureOtp(tempToken, otpCode, 'email_verify');
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    await MasterDB.updateUser(user.id, { emailVerified: true });
    const masked = maskEmail(user.email);

    const setupOtp = generateSecureOtp(user.email, 'setup_2fa', 15);
    await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: setupOtp.code
    }).catch(e => console.warn('[Tiwi Setup 2FA Email Warning]', e.message));

    return res.json({
      success: true,
      emailVerified: true,
      requires2FASetup: true,
      tempToken: setupOtp.token,
      email: user.email,
      emailMasked: masked,
      message: 'Email verified successfully! Please enter the 6-digit confirmation code to set up 2-Step Verification.'
    });
  } catch (err) {
    console.error('Tiwi verify email error:', err);
    res.status(500).json({ error: 'Failed to verify email address.' });
  }
});

router.post('/resend-email-verification', async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Verification session token is required.' });
    }

    const session = getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    deleteOtpSession(tempToken);
    const newOtp = generateSecureOtp(user.email, 'email_verify', 15);
    const masked = maskEmail(user.email);

    await sendSignupVerificationOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    }).catch(e => console.warn('[Tiwi Resend Email Warning]', e.message));

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      email: user.email,
      emailMasked: masked,
      message: `A fresh 6-digit verification code has been dispatched to ${masked}`
    });
  } catch (err) {
    console.error('Tiwi resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code.' });
  }
});

router.post('/setup-2fa', async (req, res) => {
  try {
    const { tempToken, otpCode } = req.body;
    if (!tempToken || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
    }

    const verification = verifySecureOtp(tempToken, otpCode, 'setup_2fa');
    if (!verification.valid) {
      return res.status(400).json({ error: verification.error });
    }

    const user = await MasterDB.findUserByIdentifier(verification.email);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    await MasterDB.updateUser(user.id, { twoFactorEnabled: true, emailVerified: true });
    const tiwiId = user.tiwiId || user.storeId || user.id;

    const { sessionToken } = await MasterDB.createSession(user.id, tiwiId, user.email, req);

    const socialUser = await SocialDB.findUserById(user.id);
    const safeUser = socialUser || {
      id: user.id,
      tiwiId,
      name: user.name || user.storeName,
      email: user.email,
      avatar: user.avatar,
      accountType: user.accountType || 'personal'
    };

    return res.json({
      success: true,
      sessionToken,
      token: sessionToken,
      user: safeUser,
      message: '2-Step Verification enabled and account activated successfully!'
    });
  } catch (err) {
    console.error('Tiwi setup 2FA error:', err);
    res.status(500).json({ error: 'Failed to set up 2-Step Verification.' });
  }
});

router.post('/resend-setup-2fa', async (req, res) => {
  try {
    const { tempToken } = req.body;
    if (!tempToken) {
      return res.status(400).json({ error: 'Verification session token is required.' });
    }

    const session = getOtpSession(tempToken);
    if (!session) {
      return res.status(404).json({ error: 'Verification session expired. Please sign in again.' });
    }

    const user = await MasterDB.findUserByIdentifier(session.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    deleteOtpSession(tempToken);
    const newOtp = generateSecureOtp(user.email, 'setup_2fa', 15);
    const masked = maskEmail(user.email);

    await sendTwoFactorOtpEmail({
      to: user.email,
      name: user.name || user.storeName,
      code: newOtp.code
    }).catch(e => console.warn('[Tiwi Resend Setup 2FA Warning]', e.message));

    return res.json({
      success: true,
      newTempToken: newOtp.token,
      email: user.email,
      emailMasked: masked,
      message: `A fresh 6-digit confirmation code has been dispatched to ${masked}`
    });
  } catch (err) {
    console.error('Tiwi resend setup 2FA error:', err);
    res.status(500).json({ error: 'Failed to resend confirmation code.' });
  }
});

router.post('/appeal', async (req, res) => {
  const { identifier, appealReason } = req.body;
  if (!identifier || !appealReason) {
    return res.status(400).json({ error: 'Identifier and reason are required.' });
  }
  try {
    const result = await SocialDB.submitAccountAppeal(identifier, appealReason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Appeal submission failed.' });
  }
});

router.get('/me', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  const user = await SocialDB.findUserById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.isBanned) {
    return res.status(403).json({
      error: 'ACCOUNT_DISABLED',
      code: 'PERMANENTLY_DISABLED',
      isBanned: true,
      banReason: user.banReason || 'Your Tiwi Account has been disabled for safety policy violation.',
      email: user.email,
      name: user.name,
    });
  }

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

router.get('/users', async (req, res) => {
  const currentUserId = getUserId(req);
  const users = await SocialDB.getAllUsers(currentUserId);
  res.json(users);
});

router.get('/search', async (req, res) => {
  const currentUserId = getUserId(req);
  const query = req.query.q || '';
  const result = await SocialDB.search(query, currentUserId);
  res.json(result);
});

// ====================================================================
export async function getUserContext(req) {
  // 1. Direct active user attached by server.js session middleware
  if (req.activeUser && (req.activeUser.id || req.activeUser.email)) {
    return req.activeUser;
  }
  if (req.user && (req.user.id || req.user.email)) {
    return req.user;
  }

  // 2. Token from cookies, auth headers, query, or body
  let token = req.cookies?.['tiwlo_session'] || 
    req.cookies?.['stockpro_session'] ||
    req.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
    req.headers?.['x-session-token'];

  if (typeof token === 'object' && token !== null) {
    token = token.sessionToken || token.token;
  }
  if (typeof token === 'string') {
    token = token.trim();
  }

  if (token && token !== '[object Object]') {
    try {
      const sessionData = await MasterDB.getSession(token, req);
      if (sessionData?.user) return sessionData.user;
    } catch (e) {}
  }

  return { id: 'anonymous', email: null, name: 'User' };
}

export async function getResolvedUserId(req) {
  if (req.activeUser?.id) return req.activeUser.id;
  if (req.user?.id) return req.user.id;
  const user = await getUserContext(req);
  return (user && user.id !== 'anonymous') ? user.id : null;
}

const getUserId = (req) => req.activeUser?.id || req.user?.id || req.session?.userId || null;

async function canAccessSocialConversation(conversation, userId) {
  if (conversation?.type === 'group') return true;
  const participants = Array.isArray(conversation?.participants) ? conversation.participants : [];
  const otherUserId = participants.find((participantId) => participantId !== userId) ||
    conversation?.recipientId ||
    conversation?.otherUser?.id;
  return Boolean(otherUserId && await SocialDB.canDirectMessage(userId, otherUserId));
}

// 4. FEED POSTS REST ENDPOINTS
// ====================================================================
router.get('/feed', async (req, res) => {
  const currentUserId = getUserId(req);
  const filter = req.query.filter || 'for_you';
  const posts = await SocialDB.getPosts(currentUserId, filter);
  res.json(posts);
});

router.get('/posts', async (req, res) => {
  const currentUserId = getUserId(req);
  const authorId = req.query.authorId || req.query.userId;
  if (authorId) {
    const posts = await SocialDB.getUserPosts(authorId, currentUserId);
    return res.json(posts);
  }
  const filter = req.query.filter || 'for_you';
  const posts = await SocialDB.getPosts(currentUserId, filter);
  res.json(posts);
});

router.get('/users/:id/posts', async (req, res) => {
  const currentUserId = getUserId(req);
  const targetId = req.params.id;
  const targetUser =
    (await SocialDB.findUserById(targetId)) ||
    (await SocialDB.findUserByHandleOrEmail(targetId));

  if (targetUser?.isBanned && currentUserId !== targetUser.id) {
    return res.status(403).json({
      error: 'ACCOUNT_DISABLED',
      isBanned: true,
      message: 'This account has been disabled.'
    });
  }

  const posts = await SocialDB.getUserPosts(targetId, currentUserId);
  res.json(posts);
});

router.get('/posts/:id', async (req, res) => {
  const currentUserId = getUserId(req);
  const post = await SocialDB.getPostById(req.params.id, currentUserId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/posts', contentSafetyMiddleware('public_feed'), async (req, res) => {
  const user = await getUserContext(req);
  const authorId = user.id;
  if (!authorId || authorId === 'anonymous') return res.status(401).json({ error: 'Authentication required' });

  // Account restriction check: permanently disabled users cannot create posts
  const restriction = isUserRestricted(authorId);
  if (restriction.restricted && restriction.action === 'PERMANENTLY_DISABLED') {
    return res.status(403).json({
      error: 'ACCOUNT_DISABLED',
      code: restriction.action,
      message: restriction.reason
    });
  }

  const { caption, images } = req.body;

  // Anti-Bypass: Verify attached images were not uploaded under private messaging scope
  if (Array.isArray(images)) {
    for (const img of images) {
      const scopeCheck = checkAssetScope(img, 'public_feed');
      if (!scopeCheck.allowed) {
        return res.status(403).json({ error: 'SECURITY_SCOPE_VIOLATION', message: scopeCheck.reason });
      }
    }
  }

  const post = await SocialDB.createPost({ authorId, caption, images });
  res.status(201).json(post);

  // Trigger Asynchronous Background Moderation Queue (non-blocking, smooth UI)
  const candidateMedia = Array.isArray(images) && images.length > 0 ? images : (post.image ? [post.image] : []);
  enqueuePostModeration({
    postId: post.id,
    author: user,
    caption,
    images: candidateMedia
  });

  // Attach background video processing to post if video attached
  for (const mUrl of candidateMedia) {
    if (typeof mUrl === 'string' && (/\.(mp4|mov|webm|mkv|m4v|avi)(\?|$)/i.test(mUrl) || mUrl.includes('/reels/'))) {
      if (mUrl.includes('/upload/')) {
        const sub = mUrl.split('/upload/')[1];
        const localPath = path.join(ROOT_UPLOAD_DIR, sub);
        if (fs.existsSync(localPath)) {
          enqueueVideoProcessing({
            filePath: localPath,
            relativeUrl: mUrl,
            userId: authorId,
            postId: post.id,
            subfolder: sub.startsWith('reels/') ? 'reels' : 'posts'
          });
        }
      }
    }
  }
});

router.post('/posts/:id/like', async (req, res) => {
  const userId = (await getResolvedUserId(req)) || getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const post = await SocialDB.toggleLikePost(req.params.id, userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/posts/:id/view', async (req, res) => {
  const viewerId = (await getResolvedUserId(req)) || getUserId(req);
  if (!viewerId) return res.status(401).json({ error: 'Authentication required' });
  const result = await SocialDB.recordPostView(req.params.id, viewerId);
  if (!result) return res.status(404).json({ error: 'Post not found' });
  res.json(result);
});

router.post('/posts/:id/save', async (req, res) => {
  const userId = (await getResolvedUserId(req)) || getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const post = await SocialDB.toggleSavePost(req.params.id, userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/posts/:id/comment', contentSafetyMiddleware('public_comment'), async (req, res) => {
  const authorId = (await getResolvedUserId(req)) || getUserId(req); if (!authorId) return res.status(401).json({ error: 'Authentication required' });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });
  const comment = await SocialDB.addComment(req.params.id, { authorId, text });
  if (!comment) return res.status(404).json({ error: 'Post not found' });
  res.status(201).json(comment);
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const user = await getUserContext(req);
    if (!user || user.id === 'anonymous') return res.status(401).json({ error: 'Authentication required' });
    const result = await SocialDB.deletePost(req.params.id, user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to delete post' });
  }
});

router.put('/posts/:id', async (req, res) => {
  try {
    const user = await getUserContext(req);
    if (!user || user.id === 'anonymous') return res.status(401).json({ error: 'Authentication required' });
    const { caption } = req.body;
    const post = await SocialDB.editPost(req.params.id, user, { caption });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to edit post' });
  }
});

router.post('/posts/:id/pin', async (req, res) => {
  try {
    const user = await getUserContext(req);
    if (!user || user.id === 'anonymous') return res.status(401).json({ error: 'Authentication required' });
    const result = await SocialDB.pinPost(req.params.id, user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to pin post' });
  }
});

router.get('/explore/trending', async (req, res) => {
  try {
    const tags = await SocialDB.getRealTrendingHashtags();
    res.json(tags);
  } catch (err) {
    res.json([]);
  }
});

// ====================================================================
// 5. REELS REST ENDPOINTS
// ====================================================================
router.get('/reels', async (req, res) => {
  const currentUserId = (await getResolvedUserId(req)) || getUserId(req);
  const reels = await SocialDB.getReels(currentUserId);
  res.json(reels);
});

router.post('/reels', async (req, res) => {
  const user = await getUserContext(req);
  const authorId = user?.id;
  if (!authorId || authorId === 'anonymous') return res.status(401).json({ error: 'Authentication required' });
  const { caption, videoUrl, image, audioTitle } = req.body;
  if (![videoUrl, image].some((url) => typeof url === 'string' && url.trim())) {
    return res.status(400).json({ error: 'A Short needs an uploaded photo or video' });
  }
  const reel = await SocialDB.createReel({ authorId, caption, videoUrl, image, audioTitle });
  res.status(201).json(reel);

  // Link background video processing to this reel
  const targetVideo = videoUrl || (typeof image === 'string' && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(image) ? image : null);
  if (targetVideo && targetVideo.includes('/upload/')) {
    const sub = targetVideo.split('/upload/')[1];
    const localPath = path.join(ROOT_UPLOAD_DIR, sub);
    if (fs.existsSync(localPath)) {
      enqueueVideoProcessing({
        filePath: localPath,
        relativeUrl: targetVideo,
        userId: authorId,
        reelId: reel.id,
        subfolder: 'reels'
      });
    }
  }
});

router.post('/reels/:id/like', async (req, res) => {
  const userId = (await getResolvedUserId(req)) || getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const reel = await SocialDB.toggleLikeReel(req.params.id, userId);
  if (!reel) return res.status(404).json({ error: 'Reel not found' });
  res.json(reel);
});

router.delete('/reels/:id', async (req, res) => {
  const user = await getUserContext(req);
  if (!user || user.id === 'anonymous') return res.status(401).json({ error: 'Authentication required' });
  const result = await SocialDB.deleteReel(req.params.id, user);
  if (!result.success) return res.status(result.status || 400).json({ error: result.error });
  res.json(result);
});

router.post('/reels/:id/not-interested', async (req, res) => {
  const userId = getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const preference = await SocialDB.markReelNotInterested(req.params.id, userId);
  if (!preference) return res.status(404).json({ error: 'Reel not found' });
  res.json({ success: true });
});

router.post('/reels/:id/report', async (req, res) => {
  const userId = getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const report = await SocialDB.reportReel(req.params.id, userId, req.body?.reason);
  if (!report) return res.status(404).json({ error: 'Reel not found' });
  res.status(201).json({ success: true });
});

// ====================================================================
// 6. STORIES REST ENDPOINTS
// ====================================================================
router.get('/stories', async (req, res) => {
  const currentUserId = getUserId(req);
  const stories = await SocialDB.getStories(currentUserId);
  res.json(stories);
});

router.post('/stories', async (req, res) => {
  const userId = getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { mediaUrl } = req.body;
  const story = await SocialDB.createStory({ userId, mediaUrl });
  res.status(201).json(story);
});

// ====================================================================
// 7. PROFILE & SETTINGS REST ENDPOINTS
// ====================================================================
router.get('/profile/:handleOrId', async (req, res) => {
  const target = req.params.handleOrId;
  const currentUserId = getUserId(req);
  const user =
    (await SocialDB.findUserById(target, currentUserId)) ||
    (await SocialDB.findUserByHandleOrEmail(target, currentUserId));
  if (!user) return res.status(404).json({ error: 'User not found' });

  // If user is banned and viewer is not this user, completely hide profile
  if (user.isBanned && currentUserId !== user.id) {
    return res.status(403).json({
      error: 'ACCOUNT_DISABLED',
      isBanned: true,
      message: 'This account has been disabled.'
    });
  }

  res.json(user);
});

router.put('/profile', async (req, res) => {
  try {
    const user = await getUserContext(req);
    const userId = user?.id || getUserId(req);
    if (!userId || userId === 'anonymous') return res.status(401).json({ error: 'Authentication required' });

    // 1. Check if user is restricted
    const restriction = isUserRestricted(userId);
    if (restriction.restricted && restriction.action === 'PERMANENTLY_DISABLED') {
      return res.status(403).json({ error: 'ACCOUNT_DISABLED', code: restriction.action, message: restriction.reason });
    }

    // 2. Scan text fields (name, bio, handle)
    const textToScan = [req.body?.name, req.body?.bio, req.body?.handle].filter(Boolean).join(' ');
    if (textToScan) {
      const textCheck = moderateContent(textToScan, 'public_feed');
      if (!textCheck.safe) {
        const enforcement = await recordViolation({
          user,
          category: textCheck.category,
          policyName: textCheck.policyName,
          reason: textCheck.reason,
          contentType: 'Profile Information'
        });
        return res.status(400).json({
          error: 'CONTENT_POLICY_VIOLATION',
          message: textCheck.reason,
          enforcement
        });
      }
    }

    // 3. Scan avatar image if changed
    if (req.body?.avatar && typeof req.body.avatar === 'string' && !req.body.avatar.includes('ui-avatars.com')) {
      let localPath = null;
      if (req.body.avatar.includes('/upload/')) {
        localPath = path.join(ROOT_UPLOAD_DIR, req.body.avatar.split('/upload/')[1]);
      } else if (req.body.avatar.includes('/uploads/')) {
        localPath = path.join(__dirname, '../uploads', req.body.avatar.split('/uploads/')[1]);
      }
      if (localPath && fs.existsSync(localPath)) {
        try {
          const buffer = fs.readFileSync(localPath);
          const scan = await scanAndSanitizeImage(buffer, 'user_avatar', path.basename(localPath));
          if (!scan.safe) {
            try { fs.unlinkSync(localPath); } catch (e) {}
            const enforcement = await recordViolation({
              user,
              category: 'ADULT_CONTENT',
              policyName: 'Adult & Sexually Explicit Content Policy',
              reason: scan.reason,
              contentType: 'Profile Picture'
            });
            return res.status(400).json({
              error: 'CONTENT_POLICY_VIOLATION',
              reason: scan.reason,
              policyName: 'Adult & Sexually Explicit Content Policy',
              message: 'This profile photo violates Tiwlo Community Standards on adult content.',
              enforcement
            });
          }
        } catch (e) {}
      }
    }

    const updated = await SocialDB.updateProfile(userId, req.body);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    console.error('[PUT /profile Error]', err);
    res.status(400).json({ error: err.message || 'Failed to update profile' });
  }
});

router.put('/settings/privacy', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const updated = await SocialDB.updatePrivacySettings(userId, req.body);
    res.json(updated);
  } catch (err) {
    console.error('[PUT /settings/privacy Error]', err);
    res.status(400).json({ error: err.message || 'Failed to update privacy settings' });
  }
});

router.put('/settings/advanced', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const updated = await SocialDB.updateAdvancedSettings(userId, req.body);
    res.json(updated);
  } catch (err) {
    console.error('[PUT /settings/advanced Error]', err);
    res.status(400).json({ error: err.message || 'Failed to update advanced settings' });
  }
});

router.post('/change-password', async (req, res) => {
  const userId = getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const { oldPassword, newPassword } = req.body;
  const authHeader = req.headers.authorization;
  const currentSessionToken = req.cookies?.tiwlo_session ||
    (authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null) ||
    req.headers?.['x-session-token'] ||
    null;
  try {
    const result = await SocialDB.changePassword(userId, oldPassword, newPassword, currentSessionToken);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ====================================================================
// 8. NOTIFICATIONS REST ENDPOINTS
// ====================================================================
router.get('/notifications', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const list = await SocialDB.getNotifications(userId);
  res.json(list);
});

router.post('/notifications/:id/read', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const notifications = await SocialDB.getNotifications(userId);
  if (!notifications.some((notification) => notification.id === req.params.id)) {
    return res.status(403).json({ error: 'Not authorized to update this notification' });
  }
  const notif = await SocialDB.markNotificationRead(req.params.id, userId);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });
  res.json({ success: true, notification: notif });
});

router.post('/notifications/read-all', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  await SocialDB.markAllNotificationsRead(userId);
  res.json({ success: true });
});

// ====================================================================
// 9. CONVERSATIONS & DIRECT MESSAGES REST ENDPOINTS
// ====================================================================
router.get('/conversations', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const convs = await SocialDB.getConversations(userId);
    const accessible = [];
    for (const conversation of convs) {
      if (await canAccessSocialConversation(conversation, userId)) accessible.push(conversation);
    }
    res.json(accessible);
  } catch (err) {
    console.error('[Tiwi conversations]', err);
    res.status(500).json({ error: 'Could not load conversations.' });
  }
});

router.get('/conversations/:id/messages', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const conversations = await SocialDB.getConversations(userId);
  const conversation = conversations.find((item) => item.id === req.params.id);
  if (!conversation || !(await canAccessSocialConversation(conversation, userId))) {
    return res.status(403).json({ error: 'Not authorized to view this conversation' });
  }
  const msgs = await SocialDB.getMessages(req.params.id);
  res.json(msgs);
});

router.post('/conversations/:id/messages', contentSafetyMiddleware('direct_message'), async (req, res) => {
  const senderId = getUserId(req); if (!senderId) return res.status(401).json({ error: 'Authentication required' });
  const conversations = await SocialDB.getConversations(senderId);
  const conversation = conversations.find((item) => item.id === req.params.id);
  if (!conversation || !(await canAccessSocialConversation(conversation, senderId))) {
    return res.status(403).json({ error: 'Not authorized to send to this conversation' });
  }
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Message text required' });
  const newMsg = await SocialDB.sendMessage({ conversationId: req.params.id, senderId, text });
  res.status(201).json(newMsg);
});

// ====================================================================
// 10. POST INTERACTIONS (REPOST & BOOKMARK)
// ====================================================================
router.post('/posts/:id/repost', async (req, res) => {
  const userId = getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const post = await SocialDB.toggleRepostPost(req.params.id, userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

router.post('/posts/:id/bookmark', async (req, res) => {
  const userId = getUserId(req); if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const post = await SocialDB.toggleSavePost(req.params.id, userId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// ====================================================================
// 11. USER FOLLOW TOGGLE
// ====================================================================
router.post('/users/:id/follow', async (req, res) => {
  const currentUserId = getUserId(req);
  if (!currentUserId) return res.status(401).json({ error: 'Authentication required' });
  try {
    const result = await SocialDB.toggleFollowUser(currentUserId, req.params.id);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error('[Tiwi follow]', err);
    res.status(500).json({ error: 'Could not update follow status.' });
  }
});

router.get('/follow-requests', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  try {
    res.json(await SocialDB.getFollowRequests(userId));
  } catch (err) {
    console.error('[Tiwi follow requests]', err);
    res.status(500).json({ error: 'Could not load follow requests.' });
  }
});

router.post('/follow-requests/:id/respond', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const decision = req.body?.decision;
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Decision must be accepted or rejected.' });
  }
  try {
    const request = await SocialDB.respondToFollowRequest(req.params.id, userId, decision);
    if (!request) return res.status(404).json({ error: 'Pending follow request not found.' });
    res.json({ success: true, request });
  } catch (err) {
    console.error('[Tiwi respond to follow request]', err);
    res.status(500).json({ error: 'Could not update follow request.' });
  }
});

router.get('/users/:id/followers', async (req, res) => {
  const currentUserId = getUserId(req);
  const followers = await SocialDB.getUserFollowers(req.params.id, currentUserId);
  res.json({ success: true, followers, count: followers.length });
});

router.get('/users/:id/following', async (req, res) => {
  const currentUserId = getUserId(req);
  const following = await SocialDB.getUserFollowing(req.params.id, currentUserId);
  res.json({ success: true, following, count: following.length });
});

// ====================================================================
// 12. PROGRESSIVE BYTE-RANGE MEDIA STREAMING & ADAPTIVE IMAGE DELIVERY
// ====================================================================
let sharpInstance = null;
try {
  const sharpMod = await import('sharp');
  sharpInstance = sharpMod.default || sharpMod;
} catch (e) {
  console.warn('[SocialStream] Sharp optional module not loaded:', e.message);
}

router.get('/stream/:folder/:filename', async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(ROOT_UPLOAD_DIR, sanitizedFolder, sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const isVideo = /\.(mp4|mov|webm|mkv|m4v)$/i.test(sanitizedFilename);

    // Immutable caching headers to maximize mobile client caching
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');

    // Video Streaming: HTTP 206 Partial Content Chunked Progressive Streaming
    if (isVideo) {
      const extension = path.extname(sanitizedFilename).toLowerCase();
      const videoMimeTypes = {
        '.mp4': 'video/mp4',
        '.m4v': 'video/x-m4v',
        '.mov': 'video/quicktime',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
      };
      res.setHeader('Content-Type', videoMimeTypes[extension] || 'application/octet-stream');
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);

        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
        return;
      }

      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Image Delivery: Adaptive Quality & Dynamic Sizing with Sharp
    const width = parseInt(req.query.w, 10);
    const quality = req.query.quality === 'low' ? 50 : req.query.quality === 'medium' ? 75 : 85;

    if (sharpInstance && (width > 0 || req.query.quality)) {
      try {
        let transform = sharpInstance(filePath);
        if (width > 0 && width <= 3840) {
          transform = transform.resize({ width, withoutEnlargement: true });
        }
        res.setHeader('Content-Type', 'image/webp');
        return transform.webp({ quality }).pipe(res);
      } catch (sharpErr) {
        console.warn('[Stream Error - Falling back to original image]', sharpErr.message);
      }
    }

    // Default static image streaming with proper MIME
    const ext = path.extname(sanitizedFilename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[Media Stream Error]', err);
    res.status(500).json({ error: 'Streaming media failed' });
  }
});

export default router;
