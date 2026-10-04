/**
 * Tiwlo Enterprise Security & Compliance Suite
 * 
 * Central API Gateway & Middleware for platform safety:
 * - Real-time text & contraband moderation (Weapons, Drugs, Adult links, Slurs)
 * - Cryptographic media upload context signing (Anti-bypass DM-to-public protection)
 * - Adult / Nudity image screening & EXIF sanitization
 * - Progressive violation tracking, automated suspensions, and security alert email notifications
 */

import { moderateContent } from './textModerator.js';
import { checkUrlSafety } from './domainFilter.js';
import {
  generateUploadToken,
  verifyUploadToken,
  registerAsset,
  checkAssetScope,
  scanAndSanitizeImage
} from './mediaSecurity.js';
import { isUserRestricted, recordViolation } from './accountSecurityManager.js';
import { ContentQueue } from './contentQueue.js';
import { enqueueVideoProcessing, getVideoProcessingStatus, getVideoDimensions, getFfmpegStatus, detectFfmpeg } from './videoProcessor.js';

export {
  moderateContent,
  checkUrlSafety,
  generateUploadToken,
  verifyUploadToken,
  registerAsset,
  checkAssetScope,
  scanAndSanitizeImage,
  isUserRestricted,
  recordViolation,
  ContentQueue,
  enqueueVideoProcessing,
  getVideoProcessingStatus,
  getVideoDimensions,
  getFfmpegStatus,
  detectFfmpeg
};

/**
 * Express Middleware: Pre-screen incoming text payloads (products, posts, comments)
 * 
 * @param {'public_product' | 'public_feed' | 'public_comment' | 'direct_message'} context
 */
export function contentSafetyMiddleware(context = 'public_feed') {
  return async (req, res, next) => {
    try {
      const activeUser = req.activeUser || {};
      const userId = activeUser.id || activeUser.tiwiId || activeUser.email;

      // 1. Check if user is currently frozen or permanently banned
      if (userId) {
        const restriction = isUserRestricted(userId);
        if (restriction.restricted) {
          return res.status(403).json({
            error: 'ACCOUNT_RESTRICTED',
            code: restriction.action,
            message: restriction.reason
          });
        }
      }

      // 2. Concatenate candidate textual fields for safety scan
      const candidateFields = [
        req.body.caption,
        req.body.name,
        req.body.title,
        req.body.description,
        req.body.content,
        req.body.text,
        req.body.comment,
        req.body.tagline,
        req.body.bio,
        req.body.message,
        req.body.handle,
        req.body.url,
        req.body.link
      ].filter(Boolean);

      const fullTextToInspect = candidateFields.join(' ');
      if (!fullTextToInspect) return next();

      // 3. Run Context-Aware Safety Inspection
      const safetyResult = moderateContent(fullTextToInspect, context);

      if (!safetyResult.safe) {
        // Record violation, compute strikes, and dispatch warning/ban email
        const enforcement = await recordViolation({
          user: activeUser,
          category: safetyResult.category,
          policyName: safetyResult.policyName,
          reason: safetyResult.reason,
          contentType: context.replace('_', ' ').toUpperCase(),
          isCritical: safetyResult.category === 'WEAPONS_AND_CONTRABAND'
        });

        return res.status(400).json({
          error: 'CONTENT_POLICY_VIOLATION',
          code: safetyResult.category,
          policyName: safetyResult.policyName,
          reason: safetyResult.reason,
          actionTaken: enforcement.actionTaken,
          strikes: enforcement.strikes,
          message: `Your content was blocked: ${safetyResult.reason}`
        });
      }

      // Passed inspection
      next();
    } catch (err) {
      console.error('[ContentSafetyMiddleware] Error:', err);
      next(); // Fail open for resilience if internal inspection throws
    }
  };
}

export default {
  moderateContent,
  checkUrlSafety,
  generateUploadToken,
  verifyUploadToken,
  registerAsset,
  checkAssetScope,
  scanAndSanitizeImage,
  isUserRestricted,
  recordViolation,
  contentSafetyMiddleware
};
