import express from 'express';
import {
  createSecureGrant,
  deleteOtpSession,
  generateSecureOtp,
  sendTwoFactorOtpEmail,
  verifySecureOtp
} from '../db/emailService.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_PRESETS,
  enforceStaffIpForLogin,
  extractRequestClientIp,
  getStaffSecurityProfile,
  getStaffSecurityState,
  hasAdminPermission,
  isSuperAdminUser,
  listStaffMembers,
  listStaffSecurityActivityForActor,
  removeStaffMember,
  resetAdminPinWithOtp,
  sanitizeStaffRecordForActor,
  setupInitialAdminPin,
  upsertStaffMember,
  verifyAdminPinForUser
} from './staffSecurityService.js';

function maskEmail(email) {
  const clean = String(email || '').trim();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export function createAdminStaffRouter({ requireAdmin, requireRecentReauth, MasterDB, getMasterDb }) {
  if (typeof requireAdmin !== 'function') {
    throw new TypeError('createAdminStaffRouter requires a requireAdmin middleware.');
  }
  if (typeof requireRecentReauth !== 'function') {
    throw new TypeError('createAdminStaffRouter requires a requireRecentReauth middleware.');
  }
  if (typeof getMasterDb !== 'function' && !MasterDB) {
    throw new TypeError('createAdminStaffRouter requires MasterDB or getMasterDb.');
  }
  const resolveMasterDb = () => (typeof getMasterDb === 'function' ? getMasterDb() : MasterDB);

  const router = express.Router();

  async function requireStaffIpAndContext(req, res, next) {
    try {
      const user = req.adminUser;
      const ipCheck = await enforceStaffIpForLogin(user, req);
      if (!ipCheck.allowed) {
        return res.status(ipCheck.statusCode || 403).json({
          error: ipCheck.error,
          code: ipCheck.code
        });
      }
      const profile = ipCheck.profile || await getStaffSecurityProfile(user.id);
      if (profile && profile.isActive === false && !isSuperAdminUser(user)) {
        return res.status(403).json({
          error: 'Your staff account access has been deactivated.',
          code: 'ADMIN_STAFF_DISABLED'
        });
      }
      req.staffProfile = profile;
      req.staffState = getStaffSecurityState(user, profile, extractRequestClientIp(req));
      return next();
    } catch (error) {
      console.error('[Admin Staff Context Error]', error.message);
      return res.status(503).json({ error: 'Unable to verify staff security policy.' });
    }
  }

  function requireStaffPermission(permKey) {
    return (req, res, next) => {
      if (!hasAdminPermission(req.adminUser, req.staffProfile, permKey)) {
        return res.status(403).json({
          error: `Forbidden. Missing required permission: ${permKey}`,
          code: 'ADMIN_PERMISSION_DENIED',
          requiredPermission: permKey
        });
      }
      return next();
    };
  }

  // Current admin/staff RBAC + PIN status
  router.get('/staff-support/me', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    const state = req.staffState;
    return res.json({
      success: true,
      userId: req.adminUser.id,
      email: req.adminUser.email,
      name: req.adminUser.name || req.adminUser.storeName || req.adminUser.email,
      roleKey: state.roleKey,
      permissions: state.permissions,
      hasPin: state.hasPin,
      requiresPinSetup: state.requiresPinSetup,
      isSuperAdmin: state.isSuperAdmin,
      isActive: state.isActive,
      allowedIpsConfigured: state.allowedIpsConfigured,
      allowedIpsCount: state.allowedIpsCount,
      lockedUntil: state.lockedUntil,
      failedAttempts: state.failedAttempts,
      rolePresets: ADMIN_ROLE_PRESETS,
      permissionCatalog: ADMIN_PERMISSION_CATALOG
    });
  });

  // Security PIN status
  router.get('/security-pin/status', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    const state = req.staffState;
    return res.json({
      success: true,
      hasPin: state.hasPin,
      requiresPinSetup: state.requiresPinSetup,
      lockedUntil: state.lockedUntil,
      failedAttempts: state.failedAttempts
    });
  });

  // Initial mandatory 2-step Security PIN setup (protected by fresh account re-verification)
  router.post('/security-pin/setup', requireAdmin, requireStaffIpAndContext, requireRecentReauth, async (req, res) => {
    try {
      const result = await setupInitialAdminPin(req.adminUser, req.body || {});
      return res.json(result);
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ error: error.message || 'Could not configure Security PIN.' });
    }
  });

  // Verify Security PIN -> issues sensitive_action_grant WITHOUT sending Email OTP
  router.post('/security-pin/verify', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    try {
      const result = await verifyAdminPinForUser(req.adminUser, req.body?.pin, {
        ip: extractRequestClientIp(req),
        userAgent: req.get?.('user-agent')
      });
      if (!result.valid) {
        return res.status(result.statusCode || 401).json({
          error: result.error,
          code: result.code,
          failedAttempts: result.failedAttempts,
          remainingAttempts: result.remainingAttempts,
          lockedUntil: result.lockedUntil
        });
      }
      return res.json({
        success: true,
        grant: result.grant,
        expiresInSeconds: result.expiresInSeconds
      });
    } catch (error) {
      console.error('[Admin PIN Verify Error]', error.message);
      return res.status(503).json({ error: 'Could not verify Security PIN.' });
    }
  });

  // Forgot PIN -> sends Email OTP ONLY when explicitly requested by the admin
  router.post('/security-pin/forgot-request', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    const user = req.adminUser;
    if (!user?.email) {
      return res.status(400).json({ error: 'Verified email address is required for PIN recovery.' });
    }
    try {
      const challenge = await generateSecureOtp(user.email, 'admin_pin_reset', 10);
      const delivery = await sendTwoFactorOtpEmail({
        to: user.email,
        name: user.name || user.storeName || 'Tiwlo Administrator',
        code: challenge.code
      }).catch((err) => ({ success: false, error: err.message }));

      if (!delivery?.success) {
        await deleteOtpSession(challenge.token).catch(() => {});
        return res.status(503).json({ error: 'Could not send recovery OTP email. Try again shortly.' });
      }

      await recordSecurityEvent({
        eventType: 'admin.pin_reset_requested',
        severity: 'warning',
        userId: user.id,
        subject: user.email,
        ip: extractRequestClientIp(req),
        userAgent: req.get?.('user-agent')
      }).catch(() => {});

      return res.json({
        success: true,
        tempToken: challenge.token,
        emailMasked: maskEmail(user.email),
        expiresInSeconds: 600,
        message: `A PIN recovery code was sent to ${maskEmail(user.email)}.`
      });
    } catch (error) {
      console.error('[Admin PIN Forgot Error]', error.message);
      return res.status(503).json({ error: 'Could not start PIN recovery. Try again shortly.' });
    }
  });

  // Complete Forgot PIN reset using Email OTP + New PIN
  router.post('/security-pin/reset', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    const user = req.adminUser;
    const { otpToken, tempToken, otpCode, newPin, confirmPin } = req.body || {};
    const token = otpToken || tempToken;
    if (!token || !otpCode) {
      return res.status(400).json({ error: 'Verification token and 6-digit email OTP are required.' });
    }

    try {
      const verification = await verifySecureOtp(token, otpCode, 'admin_pin_reset');
      if (!verification.valid || String(verification.email || '').toLowerCase() !== String(user.email || '').toLowerCase()) {
        return res.status(400).json({ error: verification.error || 'Invalid or expired recovery OTP.' });
      }

      const resetResult = await resetAdminPinWithOtp(user, { newPin, confirmPin });
      const grant = await createSecureGrant(user.email, 'sensitive_action_grant', 5);

      await recordSecurityEvent({
        eventType: 'admin.pin_reset_completed',
        severity: 'info',
        userId: user.id,
        subject: user.email,
        ip: extractRequestClientIp(req),
        userAgent: req.get?.('user-agent')
      }).catch(() => {});

      return res.json({
        ...resetResult,
        grant,
        expiresInSeconds: 300,
        message: 'Security PIN updated successfully.'
      });
    } catch (error) {
      const status = error.statusCode || 400;
      return res.status(status).json({ error: error.message || 'Could not reset Security PIN.' });
    }
  });

  // List support staff & role templates (super_admin records are strictly isolated from non-super_admin)
  router.get('/staff-support', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    try {
      const staff = await listStaffMembers({ actorUser: req.adminUser });
      return res.json({
        success: true,
        staff,
        rolePresets: ADMIN_ROLE_PRESETS,
        permissionCatalog: ADMIN_PERMISSION_CATALOG,
        canManageStaff: hasAdminPermission(req.adminUser, req.staffProfile, 'manage_staff_roles')
      });
    } catch (error) {
      console.error('[Admin Staff List Error]', error.message);
      return res.status(500).json({ error: 'Failed to load staff support directory.' });
    }
  });

  // Recent staff security activity (super_admin activity strictly hidden from non-super_admin)
  router.get('/staff-support/activity', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    try {
      const events = await listStaffSecurityActivityForActor({
        actorUser: req.adminUser,
        limit: req.query?.limit
      });
      return res.json({ success: true, events });
    } catch (error) {
      console.error('[Admin Staff Activity Error]', error.message);
      return res.status(500).json({ error: 'Failed to load staff security activity.' });
    }
  });

  // Inspect single staff member (returns 403 if non-super_admin targets a super_admin)
  router.get('/staff-support/:userId', requireAdmin, requireStaffIpAndContext, async (req, res) => {
    try {
      const targetUser = await resolveMasterDb().findUserByIdentifier(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Staff member not found.' });
      }
      const targetProfile = await getStaffSecurityProfile(targetUser.id);
      if ((isSuperAdminUser(targetUser) || targetProfile?.roleKey === 'super_admin') && !isSuperAdminUser(req.adminUser)) {
        return res.status(403).json({
          error: 'Forbidden. Super Admin accounts are isolated.',
          code: 'SUPER_ADMIN_ISOLATED'
        });
      }
      const sanitized = sanitizeStaffRecordForActor({
        ...targetUser,
        role_key: targetProfile?.roleKey,
        permissions: targetProfile?.permissions,
        allowed_ips: targetProfile?.allowedIps,
        has_pin: targetProfile?.hasPin,
        pin_set_at: targetProfile?.pinSetAt,
        is_active: targetProfile?.isActive
      }, req.adminUser);
      return res.json({ success: true, staff: sanitized });
    } catch (error) {
      console.error('[Admin Staff Get Error]', error.message);
      return res.status(500).json({ error: 'Failed to load staff member.' });
    }
  });

  // Create or promote dedicated support staff
  router.post(
    '/staff-support',
    requireAdmin,
    requireStaffIpAndContext,
    requireRecentReauth,
    requireStaffPermission('manage_staff_roles'),
    async (req, res) => {
      try {
        const staff = await upsertStaffMember({
          actorUser: req.adminUser,
          name: req.body?.name,
          email: req.body?.email,
          password: req.body?.password,
          roleKey: req.body?.roleKey || 'support_agent',
          permissions: req.body?.permissions,
          allowedIps: req.body?.allowedIps,
          isActive: req.body?.isActive !== false,
          MasterDB: resolveMasterDb()
        });

        await recordSecurityEvent({
          eventType: 'admin.staff_created',
          severity: 'info',
          userId: req.adminUser.id,
          subject: staff?.email || req.body?.email,
          ip: extractRequestClientIp(req),
          userAgent: req.get?.('user-agent'),
          details: { targetUserId: staff?.userId, roleKey: staff?.roleKey }
        }).catch(() => {});

        return res.status(201).json({
          success: true,
          staff,
          message: `Staff member ${staff?.name || staff?.email} saved.`
        });
      } catch (error) {
        const status = error.statusCode || (error instanceof TypeError ? 400 : 500);
        return res.status(status).json({ error: error.message || 'Could not create staff account.' });
      }
    }
  );

  // Update staff role, permissions, allowed IPs, or active state
  router.put(
    '/staff-support/:userId',
    requireAdmin,
    requireStaffIpAndContext,
    requireRecentReauth,
    requireStaffPermission('manage_staff_roles'),
    async (req, res) => {
      try {
        const staff = await upsertStaffMember({
          actorUser: req.adminUser,
          targetUserId: req.params.userId,
          name: req.body?.name,
          roleKey: req.body?.roleKey || 'support_agent',
          permissions: req.body?.permissions,
          allowedIps: req.body?.allowedIps,
          isActive: req.body?.isActive !== false,
          MasterDB: resolveMasterDb()
        });

        await recordSecurityEvent({
          eventType: 'admin.staff_updated',
          severity: 'info',
          userId: req.adminUser.id,
          subject: staff?.email || req.params.userId,
          ip: extractRequestClientIp(req),
          userAgent: req.get?.('user-agent'),
          details: { targetUserId: staff?.userId, roleKey: staff?.roleKey, isActive: staff?.isActive }
        }).catch(() => {});

        return res.json({
          success: true,
          staff,
          message: 'Staff role & security policy updated.'
        });
      } catch (error) {
        const status = error.statusCode || (error instanceof TypeError ? 400 : 500);
        return res.status(status).json({ error: error.message || 'Could not update staff account.' });
      }
    }
  );

  // Revoke / remove staff privileges
  router.delete(
    '/staff-support/:userId',
    requireAdmin,
    requireStaffIpAndContext,
    requireRecentReauth,
    requireStaffPermission('manage_staff_roles'),
    async (req, res) => {
      try {
        const result = await removeStaffMember({
          actorUser: req.adminUser,
          targetUserId: req.params.userId,
          MasterDB: resolveMasterDb()
        });

        await recordSecurityEvent({
          eventType: 'admin.staff_removed',
          severity: 'warning',
          userId: req.adminUser.id,
          subject: req.params.userId,
          ip: extractRequestClientIp(req),
          userAgent: req.get?.('user-agent'),
          details: { targetUserId: req.params.userId }
        }).catch(() => {});

        return res.json({
          ...result,
          message: 'Staff privileges revoked and sessions terminated.'
        });
      } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ error: error.message || 'Could not remove staff privileges.' });
      }
    }
  );

  return router;
}

export default createAdminStaffRouter;
