import { createHash } from 'node:crypto';

export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;
const sessionTouchTimestamps = new Map();

export function hashSessionTouchKey(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

export function getLastSessionTouch(token) {
  if (!token) return 0;
  return sessionTouchTimestamps.get(hashSessionTouchKey(token)) || 0;
}

export function markSessionTouched(token, now = Date.now()) {
  if (!token) return;
  const touchKey = hashSessionTouchKey(token);
  sessionTouchTimestamps.set(touchKey, now);
  if (sessionTouchTimestamps.size > 5000) {
    const oldestKey = sessionTouchTimestamps.keys().next().value;
    if (oldestKey) sessionTouchTimestamps.delete(oldestKey);
  }
}

/**
 * Evict session touch cache entries for one or more raw tokens and/or SHA-256 token hashes.
 * Passing null/undefined clears entries selectively only when tokens are provided;
 * use clearAllSessionTouchCache(exceptTokens) when revoking all other user sessions.
 */
export function clearSessionTouchCache(tokens = []) {
  const list = Array.isArray(tokens) ? tokens : [tokens];
  for (const item of list) {
    const clean = String(item || '').trim();
    if (!clean) continue;
    sessionTouchTimestamps.delete(clean);
    sessionTouchTimestamps.delete(hashSessionTouchKey(clean));
  }
}

export function clearAllSessionTouchCache(preserveTokens = []) {
  const preserved = new Set();
  const list = Array.isArray(preserveTokens) ? preserveTokens : [preserveTokens];
  for (const item of list) {
    const clean = String(item || '').trim();
    if (!clean) continue;
    preserved.add(clean);
    preserved.add(hashSessionTouchKey(clean));
  }
  if (preserved.size === 0) {
    sessionTouchTimestamps.clear();
    return;
  }
  for (const key of Array.from(sessionTouchTimestamps.keys())) {
    if (!preserved.has(key)) {
      sessionTouchTimestamps.delete(key);
    }
  }
}
