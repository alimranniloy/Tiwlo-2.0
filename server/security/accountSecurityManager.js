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

let runtimeViolations = {};

/**
 * Load violations registry
 */
function loadViolations() {
  return runtimeViolations;
}

/**
 * Save violations registry
 */
function saveViolations(data) {
  runtimeViolations = data;
}

/**
 * Checks if a user is currently under a temporary action freeze or ban
 */
export function isUserRestricted(userId) {
  if (!userId) return { restricted: false };
  const violations = loadViolations();
  const record = violations[userId];

  if (!record) return { restricted: false };

  // 1. Permanent ban check
  if (record.isPermanentlyDisabled) {
    return {
      restricted: true,
      action: 'PERMANENTLY_DISABLED',
      reason: record.lastReason || 'Account suspended for policy violations'
    };
  }

  // 2. Temporary freeze check (24 hours cooldown)
  if (record.cooldownUntil && Date.now() < record.cooldownUntil) {
    const minutesLeft = Math.ceil((record.cooldownUntil - Date.now()) / (1000 * 60));
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

  // Resolve user identity & email from MasterDB if not directly provided
  if ((!email || userId === 'anonymous') && (user.id || user.email || user.tiwiId || user.authorId)) {
    try {
      const searchKey = user.id || user.authorId || user.email || user.tiwiId;
      const master = MasterDB.getMasterData();
      const u = (master.users || []).find(x => 
        (searchKey && (x.id === searchKey || x.tiwiId === searchKey || x.email === searchKey)) ||
        (user.email && x.email && x.email.toLowerCase() === user.email.toLowerCase())
      );
      if (u) {
        userId = u.id || u.email;
        email = u.email;
        name = name || u.name;
      }
    } catch (e) {}
  }

  // If still no email, check SocialDB
  if (!email && userId && userId !== 'anonymous') {
    try {
      const { SocialDB } = await import('../social/socialDb.js');
      const sUser = await SocialDB.findUserById(userId);
      if (sUser) {
        email = sUser.email;
        name = name || sUser.name;
      }
    } catch (e) {}
  }

  const violations = loadViolations();
  const currentRecord = violations[userId] || {
    userId,
    email,
    strikes: 0,
    history: []
  };

  // If email was cached in previous violation record, reuse it
  if (!email && currentRecord.email) {
    email = currentRecord.email;
  }
  if (email && !currentRecord.email) {
    currentRecord.email = email;
  }

  name = name || (email ? email.split('@')[0] : 'User');

  const wasInCooldown = currentRecord.cooldownUntil && Date.now() < currentRecord.cooldownUntil;

  currentRecord.strikes += 1;
  // If user was already under 24-hr cooldown and violates policy again, immediately escalate to Strike 3
  if (wasInCooldown && currentRecord.strikes < 3) {
    currentRecord.strikes = 3;
  }
  const strikeCount = currentRecord.strikes;

  const violationEntry = {
    id: `viol_${Date.now()}`,
    timestamp: new Date().toISOString(),
    category,
    policyName,
    reason,
    contentType,
    strikeNumber: strikeCount
  };

  currentRecord.history.push(violationEntry);
  currentRecord.lastReason = reason;

  // Determine disciplinary action
  let actionTaken = 'WARNING';

  // CRITICAL THREAT OR 3 STRIKES -> IMMEDIATE PERMANENT DISABLE
  if (isCritical || strikeCount >= 3 || category === 'WEAPONS_AND_CONTRABAND') {
    actionTaken = 'DISABLED';
    currentRecord.isPermanentlyDisabled = true;
    currentRecord.disabledAt = new Date().toISOString();

    // 1. Mark user disabled in Master Database & invalidate active sessions
    try {
      const master = MasterDB.getMasterData();
      if (master.users) {
        const uIdx = master.users.findIndex(u => u.id === userId || (email && u.email === email));
        if (uIdx !== -1) {
          master.users[uIdx].isBanned = true;
          master.users[uIdx].banReason = reason;
          master.users[uIdx].bannedAt = new Date().toISOString();
        }
      }
      // Revoke all sessions for this user
      if (master.sessions) {
        master.sessions = master.sessions.filter(s => s.userId !== userId && (!email || s.email !== email));
      }
      MasterDB.saveMasterData(master);
    } catch (e) {
      console.error('[AccountSecurity] Error disabling user in MasterDB:', e);
    }

    // Also disable in SocialDB
    try {
      const { SocialDB } = await import('../social/socialDb.js');
      if (userId && userId !== 'anonymous') {
        await SocialDB.updateUser(userId, { isBanned: true, banReason: reason });
      }
    } catch (e) {}

    // 2. Dispatch Official Suspension Email
    if (email) {
      try {
        await sendAccountDisabledEmail({
          to: email,
          name,
          reason: `${policyName}: ${reason}`,
          restoreUrl: 'https://tiwlo.com/account-disabled'
        });
      } catch (err) {
        console.warn('[AccountSecurity] Could not send account disabled email:', err.message);
      }
    }
  } else if (strikeCount === 2) {
    // STRIKE 2: 24-HOUR ACTION FREEZE
    actionTaken = 'COOLDOWN';
    currentRecord.cooldownUntil = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    if (email) {
      try {
        await sendContentRemovedEmail({
          to: email,
          name,
          contentType,
          policyName,
          reason: `${reason} (Warning 2 of 3: 24-hour publishing freeze applied). Next violation will result in permanent account termination.`,
          appealUrl: 'https://tiwlo.com/help-support'
        });
      } catch (e) {}
    }
  } else {
    // STRIKE 1: NOTICE & CONTENT REMOVAL
    actionTaken = 'WARNING';

    if (email) {
      try {
        await sendContentRemovedEmail({
          to: email,
          name,
          contentType,
          policyName,
          reason,
          appealUrl: 'https://tiwlo.com/help-support'
        });
      } catch (e) {}
    }
  }

  violations[userId] = currentRecord;
  saveViolations(violations);

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
