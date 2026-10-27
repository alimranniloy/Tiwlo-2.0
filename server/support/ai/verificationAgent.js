import { randomUUID } from 'node:crypto';
import { MasterDB } from '../../db/multiTenant.js';
import { SupportDB } from '../../db/supportDb.js';
import { getPlatformUrl } from '../../config/platformConfig.js';

async function profileUser(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  return MasterDB.findUserByIdentifier(cleanEmail);
}

/**
 * Intake only: an unauthenticated appeal message is never sufficient to lift
 * a restriction. An administrator must verify the case and restore the user.
 */
export async function processSecurityAppeal({ email, message }) {
  const cleanMessage = String(message || '').trim();
  if (!email || !cleanMessage) {
    return { reply: 'Enter your registered email and an appeal message.', restored: false, decision: 'ERROR' };
  }

  const user = await profileUser(email);
  if (!user) {
    // Avoid exposing whether an email is registered.
    return {
      reply: 'If this email is associated with a disabled Tiwlo account, contact support from the registered email address to request a review.',
      restored: false,
      decision: 'REVIEW_REQUIRED'
    };
  }

  if (!user.isBanned) {
    return {
      reply: `This account is active. Sign in at ${getPlatformUrl('login')} to continue.`,
      restored: true,
      alreadyActive: true
    };
  }

  await SupportDB.createTicket({
    id: `tkt_appeal_${randomUUID()}`,
    ticketId: `TIW-SEC-${randomUUID().slice(0, 8).toUpperCase()}`,
    userId: user.id,
    userEmail: user.email,
    userName: user.name || user.storeName || 'User',
    subject: 'Account access appeal',
    description: cleanMessage.slice(0, 5000),
    status: 'OPEN',
    priority: 'HIGH',
    category: 'Security & Access'
  });

  return {
    reply: 'Your appeal has been submitted for review by the Tiwlo account security team. Restrictions remain active while the case is reviewed. A team member will contact the registered email if more information is needed.',
    restored: false,
    decision: 'REVIEW_REQUIRED'
  };
}
