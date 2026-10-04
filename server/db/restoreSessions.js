import crypto from 'crypto';

let runtimeRestoreSessions = {};

function readSessions() {
  return runtimeRestoreSessions;
}

function writeSessions(data) {
  runtimeRestoreSessions = data;
}

export const RestoreSessions = {
  /**
   * Creates a cryptographically unique restore session token for an email
   */
  createRestoreSession({ email, userId = null, reason = '', type = 'account_restore' }) {
    if (!email) throw new Error('Email is required for restore session');
    const cleanEmail = email.trim().toLowerCase();
    const token = `sec_rst_${crypto.randomBytes(24).toString('hex')}`;
    const sessions = readSessions();

    const record = {
      token,
      email: cleanEmail,
      userId,
      reason,
      type,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours validity
      completed: false
    };

    sessions[token] = record;
    writeSessions(sessions);

    return {
      token,
      url: `https://tiwlo.com/account-restore?token=${token}`,
      expiresAt: record.expiresAt
    };
  },

  /**
   * Creates a cryptographically unique security checkup token
   */
  createSecurityCheckupSession({ email, userId = null }) {
    if (!email) throw new Error('Email is required for checkup session');
    const cleanEmail = email.trim().toLowerCase();
    const token = `sec_chk_${crypto.randomBytes(24).toString('hex')}`;
    const sessions = readSessions();

    const record = {
      token,
      email: cleanEmail,
      userId,
      type: 'security_checkup',
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + (48 * 60 * 60 * 1000), // 48 hours validity
      completed: false
    };

    sessions[token] = record;
    writeSessions(sessions);

    return {
      token,
      url: `https://tiwlo.com/security-checkup?token=${token}`,
      expiresAt: record.expiresAt
    };
  },

  /**
   * Validates a restore or checkup session token
   */
  verifySession(token) {
    if (!token) return { valid: false, error: 'Token is required' };
    const sessions = readSessions();
    const record = sessions[token];

    if (!record) {
      return { valid: false, error: 'Invalid or unrecognized session token' };
    }

    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'Restore session has expired. Please sign in to request a fresh review.' };
    }

    return {
      valid: true,
      session: {
        token: record.token,
        email: record.email,
        userId: record.userId,
        reason: record.reason,
        type: record.type,
        completed: record.completed
      }
    };
  },

  /**
   * Marks a session token as completed
   */
  completeSession(token) {
    if (!token) return;
    const sessions = readSessions();
    if (sessions[token]) {
      sessions[token].completed = true;
      sessions[token].completedAt = new Date().toISOString();
      writeSessions(sessions);
    }
  }
};
