import { consumeSecureGrant } from '../db/emailService.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';

export async function requireRecentReauth(req, res, next) {
  const user = req.adminUser || req.activeUser;
  if (!user?.id || !user.email) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const grant = req.get?.('x-tiwlo-reauth-grant');
  if (!grant) {
    return res.status(428).json({
      error: 'RECENT_VERIFICATION_REQUIRED',
      message: 'Verify your email before making this sensitive change.'
    });
  }

  try {
    const email = await consumeSecureGrant(grant, 'sensitive_action_grant');
    if (!email || String(email).toLowerCase() !== String(user.email).toLowerCase()) {
      return res.status(403).json({ error: 'Verification expired or does not match this account. Verify again.' });
    }
    await recordSecurityEvent({
      eventType: 'security.sensitive_action_reauthenticated',
      severity: 'info',
      userId: user.id,
      ip: req.ip,
      userAgent: req.get?.('user-agent'),
      details: {
        method: req.method,
        resource: String(req.baseUrl || req.path || '').slice(0, 120)
      }
    });
    return next();
  } catch (error) {
    console.error('[RecentReauth] Could not validate verification grant:', error.message);
    return res.status(503).json({ error: 'Could not verify this change. Please try again.' });
  }
}
