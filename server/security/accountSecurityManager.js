/**
 * Tiwlo Enterprise Account Security & Progressive Enforcement Manager
 * 
 * Manages Facebook/Twitter-grade disciplinary actions:
 * - Strike 1: Block content, issue policy warning & dispatch notice email
 * - Strike 2: Temporary 24-hour upload/publishing freeze
 * - Strike 3 OR Critical Threat (Weapons, Firearms, Extreme Adult Contraband):
 *   -> Instant Account Disable (isBanned = true)
 *   -> Immediate session revocation across Web and Android App
 *   -> Formal suspension email with appeal token
 */

import { sendContentRemovedEmail, sendAccountDisabledEmail } from '../db/emailService.js';
import { MasterDB } from '../db/multiTenant.js';
import { getPlatformUrl } from '../config/platformConfig.js';
import { queryPg } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';

/**
 * Checks if a user is currently under a temporary action freeze or ban
 */
export async function isUserRestricted(userId) {
  if (!userId) return { restricted: false };
  const { rows } = await queryPg(
    `SELECT strikes, cooldown_until, permanently_disabled, last_reason
     FROM system_account_security WHERE user_id = $1`,
    [String(userId).slice(0, 64)]
  );
  const record = rows[0];

  if (!record) return { restricted: false };

  if (record.permanently_disabled) {
    return {
      restricted: true,
      action: 'PERMANENTLY_DISABLED',
      reason: record.last_reason || 'Account suspended for policy violations'
    };
  }

  if (record.cooldown_until && new Date(record.cooldown_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(record.cooldown_until).getTime() - Date.now()) / (1000 * 60));
    return {
      restricted: true,
      action: 'TEMPORARY_COOLDOWN',
      minutesLeft,
      reason: `Account temporarily restricted from publishing. Cooldown active for ${minutesLeft} minutes.`
    };
  }

  return { restricted: false };
}

/**
 * Records a policy violation, computes strikes, and executes enforcement
 * 
 * @param {object} params
 * @param {object} params.user - User or merchant object (id, email, name, role)
 * @param {string} params.category - Policy violation category code
 * @param {string} params.policyName - Human readable policy name
 * @param {string} params.reason - Explanation of the violation
 * @param {string} params.contentType - 'Product', 'Post', 'Image', 'Direct Message'
 * @param {boolean} params.isCritical - If true (e.g. Weapons, Terrorism), immediately disables account
 * @returns {Promise<{ actionTaken: 'WARNING' | 'COOLDOWN' | 'DISABLED', strikes: number }>}
 */
export async function recordViolation({
  user = {},
  category = 'GENERAL_POLICY',
  policyName = 'Platform Safety Policy',
  reason = 'Violated acceptable use standards',
  contentType = 'Content',
  isCritical = false
}) {
  let userId = user.id || user.authorId || user.userId || user.tiwiId || user.email || 'anonymous';
  let email = user.email;
  let name = user.name || user.storeName;

  if (userId === 'anonymous') return { actionTaken: 'WARNING', strikes: 0, policyName, reason };
  const resolvedUser = await MasterDB.findUserByIdentifier(userId);
  if (resolvedUser) {
    userId = resolvedUser.id;
    email = email || resolvedUser.email;
    name = name || resolvedUser.name || resolvedUser.storeName;
  } else if (!email && userId) {
    const { SocialDB } = await import('../social/socialDb.js');
    const socialUser = await SocialDB.findUserById(userId);
    if (socialUser) {
      email = socialUser.email;
      name = name || socialUser.name;
    }
  }

  name = name || (email ? email.split('@')[0] : 'User');
  const shouldImmediatelyDisable = isCritical || category === 'WEAPONS_AND_CONTRABAND';
  const { rows: stateRows } = await queryPg(
    `INSERT INTO system_account_security
       (user_id, strikes, cooldown_until, permanently_disabled, last_reason, updated_at)
     VALUES (
       $1, 1, NULL, $2, $3, CURRENT_TIMESTAMP
     )
     ON CONFLICT (user_id) DO UPDATE SET
       strikes = CASE
         WHEN system_account_security.cooldown_until > CURRENT_TIMESTAMP
              AND system_account_security.strikes < 2 THEN 3
         ELSE system_account_security.strikes + 1
       END,
       permanently_disabled = system_account_security.permanently_disabled OR $2 OR
         (CASE
           WHEN system_account_security.cooldown_until > CURRENT_TIMESTAMP
                AND system_account_security.strikes < 2 THEN 3
           ELSE system_account_security.strikes + 1
         END >= 3),
       cooldown_until = CASE
         WHEN system_account_security.permanently_disabled OR $2 OR
           (CASE
             WHEN system_account_security.cooldown_until > CURRENT_TIMESTAMP
                  AND system_account_security.strikes < 2 THEN 3
             ELSE system_account_security.strikes + 1
           END >= 3) THEN NULL
         WHEN (CASE
           WHEN system_account_security.cooldown_until > CURRENT_TIMESTAMP
                AND system_account_security.strikes < 2 THEN 3
           ELSE system_account_security.strikes + 1
         END) = 2 THEN CURRENT_TIMESTAMP + INTERVAL '24 hours'
         ELSE system_account_security.cooldown_until
       END,
       last_reason = EXCLUDED.last_reason,
       updated_at = CURRENT_TIMESTAMP
     RETURNING strikes, cooldown_until, permanently_disabled`,
    [String(userId).slice(0, 64), shouldImmediatelyDisable, reason]
  );
  const { strikes: strikeCount, permanently_disabled: permanentlyDisabled } = stateRows[0];
  const actionTaken = permanentlyDisabled ? 'DISABLED' : strikeCount === 2 ? 'COOLDOWN' : 'WARNING';

  await recordSecurityEvent({
    eventType: 'moderation.policy_violation',
    severity: actionTaken === 'DISABLED' ? 'critical' : 'warning',
    userId,
    details: { category, policyName, contentType, actionTaken, strikes: strikeCount }
  });

  if (actionTaken === 'DISABLED') {
    await queryPg(
      `UPDATE system_users SET is_banned = TRUE, ban_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, reason]
    );
    await queryPg('DELETE FROM system_sessions WHERE user_id = $1', [userId]);

    // 2. Dispatch Official Suspension Email
    if (email) {
      try {
        await sendAccountDisabledEmail({
          to: email,
          name,
          reason: `${policyName}: ${reason}`,
          restoreUrl: getPlatformUrl('account-disabled')
        });
      } catch (err) {
        console.warn('[AccountSecurity] Could not send account disabled email:', err.message);
      }
    }
  } else if (actionTaken === 'COOLDOWN') {
    // STRIKE 2: 24-HOUR ACTION FREEZE
    if (email) {
      try {
        await sendContentRemovedEmail({
          to: email,
          name,
          contentType,
          policyName,
          reason: `${reason} (Warning 2 of 3: 24-hour publishing freeze applied). Next violation will result in permanent account termination.`,
          appealUrl: getPlatformUrl('help-support')
        });
      } catch (e) {}
    }
  } else {
    // STRIKE 1: NOTICE & CONTENT REMOVAL
    if (email) {
      try {
        await sendContentRemovedEmail({
          to: email,
          name,
          contentType,
          policyName,
          reason,
          appealUrl: getPlatformUrl('help-support')
        });
      } catch (e) {}
    }
  }

  // 3. Dispatch In-App Activity Notification (Instant delivery to Tiwi mobile app & web)
  try {
    const { SocialDB } = await import('../social/socialDb.js');
    if (userId && userId !== 'anonymous') {
      const notifTitle = actionTaken === 'DISABLED'
        ? 'Account Action: Account Disabled'
        : actionTaken === 'COOLDOWN'
        ? `Policy Warning (${strikeCount}/3): 24-hr freeze`
        : `Policy Notice (${strikeCount}/3): Content removed`;
      
      const notifMessage = actionTaken === 'DISABLED'
        ? `Your Tiwi Account has been disabled for safety violations: ${reason}`
        : actionTaken === 'COOLDOWN'
        ? `A 24-hour publishing freeze has been applied due to repeated violations: ${reason}`
        : `Your ${contentType} was removed by Tiwlo Community Standards for violating our ${policyName}.`;

      await SocialDB.addNotification({
        recipientId: userId,
        type: 'warning',
        title: notifTitle,
        message: notifMessage,
        snippet: reason,
        meta: {
          category,
          policyName,
          actionTaken,
          strikes: strikeCount,
          contentType
        }
      });
    }
  } catch (notifErr) {
    console.warn('[AccountSecurity] Could not dispatch in-app notification:', notifErr.message);
  }

  return {
    actionTaken,
    strikes: strikeCount,
    policyName,
    reason
  };
}

export default {
  isUserRestricted,
  recordViolation
};
