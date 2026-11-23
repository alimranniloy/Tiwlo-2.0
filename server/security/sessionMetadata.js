import crypto from 'node:crypto';
import geoip from 'geoip-lite';
import { extractClientSignals } from './freeTierAbuseGuard.js';
import { clearSessionTouchCache } from './sessionTouchCache.js';

function cleanSessionTokenCandidate(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[object Object]' || trimmed === 'null' || trimmed === 'undefined') {
    return '';
  }
  return trimmed;
}

/**
 * Extract unique candidate session tokens from cookie, Bearer header, and x-session-token
 * in precedence order so a stale cookie never permanently shadows a fresh Bearer token.
 */
export function getCandidateSessionTokens(req) {
  if (!req) return [];
  const authHeader = req.headers?.authorization;
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : '';
  const rawCandidates = [
    req.cookies?.tiwlo_host_session,
    bearer,
    req.headers?.['x-session-token']
  ];
  const seen = new Set();
  const tokens = [];
  for (const raw of rawCandidates) {
    const clean = cleanSessionTokenCandidate(raw);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      tokens.push(clean);
    }
  }
  return tokens;
}

export function getRequestSessionToken(req) {
  return getCandidateSessionTokens(req)[0] || null;
}

function normalizeLookupIp(ip) {
  const raw = String(ip || '').split(',')[0].trim();
  if (!raw) return '';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

function isLocalOrPrivateIp(ip) {
  const clean = normalizeLookupIp(ip);
  if (!clean) return false;
  if (clean === '::1' || clean === 'localhost' || clean.startsWith('127.') || clean.startsWith('10.') || clean.startsWith('192.168.')) {
    return true;
  }
  const m = /^172\.(\d{1,3})\./.exec(clean);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function resolveSessionLocationLabel(ip, locationRow = null) {
  if (locationRow && typeof locationRow === 'object') {
    const area = cleanHeaderText(locationRow.area || '', 120);
    const addr = cleanHeaderText(locationRow.formatted_address || '', 160);
    if (area) return area;
    if (addr) return addr;
  }
  const cleanIp = normalizeLookupIp(ip);
  if (!cleanIp) return null;
  if (isLocalOrPrivateIp(cleanIp)) return 'Local Network';
  try {
    const geo = geoip.lookup(cleanIp);
    if (geo) {
      const parts = [geo.city, geo.region, geo.country].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
  } catch {
    // GeoIP unavailable
  }
  return null;
}

function cleanHeaderText(value, maxLen = 128) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Extract real client IP, device name/model, and app label from an Express request.
 */
export function extractSessionClientMetadata(req) {
  if (!req) {
    return { ip: null, deviceName: '', appName: '' };
  }
  const signals = extractClientSignals(req);
  const ip = signals.ip || cleanHeaderText(req.ip || req.socket?.remoteAddress || '', 64) || null;
  const headers = req.headers || {};
  const explicitDevice = cleanHeaderText(
    headers['x-device-name'] || headers['x-device-model'] || '',
    120
  );
  const explicitApp = cleanHeaderText(headers['x-app-name'] || '', 64);
  const ua = cleanHeaderText(headers['user-agent'] || '', 512);

  const summary = summarizeSessionDevice(ua, explicitDevice, explicitApp);
  return {
    ip,
    deviceName: explicitDevice || summary.device || '',
    appName: explicitApp || summary.appName || ''
  };
}

/**
 * Summarize a browser or mobile device name, OS, browser, platform, and app source.
 */
export function summarizeSessionDevice(userAgent = '', explicitDeviceName = '', explicitAppName = '') {
  const ua = String(userAgent || '').trim();
  const explicitName = cleanHeaderText(explicitDeviceName, 120);
  const explicitApp = cleanHeaderText(explicitAppName, 64);

  // Detect custom PICK / Tiwlo mobile User-Agent format:
  // e.g. "PICK/1.0.2 (Android 14; Samsung SM-S918B) Mobile"
  const pickMatch = /^(PICKDelivery|PICK|TiwloApp)\/[\d.]+\s*\(([^;)]+)(?:;\s*([^)]+))?\)/i.exec(ua);

  let os = 'Unknown OS';
  if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/Android\s*([\d.]+)?/i.test(ua)) {
    const ver = /Android\s*([\d.]+)/i.exec(ua)?.[1];
    os = ver ? `Android ${ver}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const iosVer = /OS\s+([\d_]+)/i.exec(ua)?.[1]?.replace(/_/g, '.');
    os = iosVer ? `iOS ${iosVer}` : 'iOS';
  } else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/okhttp|PICK|ReactNative|Expo|CFNetwork/i.test(ua)) browser = 'Mobile App';
  else if (/curl|node|undici/i.test(ua)) browser = 'API Client';

  let appName = explicitApp;
  if (!appName) {
    if (/PICKDelivery/i.test(ua)) appName = 'PICK Delivery';
    else if (/PICK\//i.test(ua) || /pick_app/i.test(ua)) appName = 'PICK App';
    else if (/okhttp|Expo|CFNetwork/i.test(ua)) appName = 'Mobile App';
    else if (/curl|node|undici/i.test(ua)) appName = 'API Client';
    else appName = 'Tiwlo Web';
  }

  let device = explicitName;
  if (!device && pickMatch) {
    const parsedOs = cleanHeaderText(pickMatch[2], 40);
    const parsedModel = cleanHeaderText(pickMatch[3] || '', 80);
    if (parsedModel && !/^unknown$/i.test(parsedModel)) {
      device = `${parsedModel} (${parsedOs})`;
    } else if (parsedOs) {
      device = parsedOs;
    }
    if (parsedOs && os === 'Unknown OS') os = parsedOs;
  }

  if (!device && /Android/i.test(ua)) {
    // Standard Android browser UA: Mozilla/5.0 (Linux; Android 13; SM-A536E) ...
    const modelMatch = /Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\))/i.exec(ua);
    const rawModel = cleanHeaderText(modelMatch?.[1] || '', 64);
    if (rawModel && rawModel.toLowerCase() !== 'k' && rawModel.toLowerCase() !== 'mobile') {
      device = `${rawModel} · ${browser} on ${os}`;
    }
  }

  if (!device && /iPhone/i.test(ua)) {
    device = `iPhone · ${browser} on ${os}`;
  } else if (!device && /iPad/i.test(ua)) {
    device = `iPad · ${browser} on ${os}`;
  }

  if (!device) {
    if (!ua) device = 'Unknown device';
    else if (browser === 'Mobile App') device = os !== 'Unknown OS' ? `Mobile Device (${os})` : 'Mobile App Session';
    else device = `${browser} on ${os}`;
  }

  const isMobile = /Android|iOS|iPhone|iPad|Mobile|PICK|okhttp|Expo/i.test(
    `${ua} ${explicitName} ${appName}`
  );
  const platform = browser === 'API Client' ? 'api' : isMobile ? 'mobile' : 'desktop';

  return { device, os, browser, appName, platform };
}

export function hashSessionIdentifier(tokenRef = '') {
  return crypto
    .createHash('sha256')
    .update(String(tokenRef || ''))
    .digest('hex')
    .slice(0, 24);
}

/**
 * List enriched active sessions for a user across Web and Mobile apps.
 */
export async function listEnrichedUserSessions(queryPg, userId, currentTokenOrTokens = '') {
  const tokenCandidates = Array.isArray(currentTokenOrTokens)
    ? currentTokenOrTokens.map(cleanSessionTokenCandidate).filter(Boolean)
    : [cleanSessionTokenCandidate(currentTokenOrTokens)].filter(Boolean);
  const currentRefSet = new Set();
  for (const tok of tokenCandidates) {
    currentRefSet.add(tok);
    currentRefSet.add(crypto.createHash('sha256').update(tok).digest('hex'));
  }

  const result = await queryPg(
    `SELECT COALESCE(NULLIF(session_token, ''), token) AS token_ref,
            ip, user_agent, device_name, app_name,
            created_at, last_active_at, expires_at
     FROM system_sessions
     WHERE user_id = $1
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ORDER BY COALESCE(last_active_at, created_at) DESC, created_at DESC
     LIMIT 30`,
    [String(userId)]
  );

  // Best-effort lookup of captured login locations (table may be omitted in lightweight unit mocks)
  const locationBySessionKey = new Map();
  let latestUserLocation = null;
  try {
    const locResult = await queryPg(
      `SELECT session_key, location_source, formatted_address, area, captured_at
       FROM system_user_login_locations
       WHERE user_id = $1
       ORDER BY captured_at DESC, id DESC
       LIMIT 30`,
      [String(userId)]
    );
    const locRows = Array.isArray(locResult?.rows) ? locResult.rows : [];
    if (locRows.length > 0 && locRows[0]?.session_key !== undefined) {
      latestUserLocation = locRows[0];
      for (const loc of locRows) {
        if (loc?.session_key) {
          locationBySessionKey.set(String(loc.session_key), loc);
        }
      }
    }
  } catch {
    // Non-fatal if login location table is unavailable
  }

  const uniqueIps = new Set();
  const sessions = (result?.rows || []).map((row) => {
    const ref = String(row.token_ref || '');
    const refSha256 = ref
      ? crypto.createHash('sha256').update(ref).digest('hex')
      : '';
    const isCurrent = Boolean(
      ref && (currentRefSet.has(ref) || (refSha256 && currentRefSet.has(refSha256)))
    );
    const summary = summarizeSessionDevice(row.user_agent, row.device_name, row.app_name);
    const cleanIp = row.ip ? String(row.ip).trim() : '';
    if (cleanIp) uniqueIps.add(cleanIp);

    const matchedLocation =
      locationBySessionKey.get(ref) ||
      (refSha256 ? locationBySessionKey.get(refSha256) : null) ||
      null;
    const location = resolveSessionLocationLabel(cleanIp, matchedLocation);

    return {
      id: hashSessionIdentifier(ref),
      ip: cleanIp || 'Unknown IP',
      location: location || (cleanIp ? 'Unknown Location' : 'Unknown Location'),
      locationSource: matchedLocation?.location_source || (location === 'Local Network' ? 'local' : location ? 'geoip' : null),
      userAgent: row.user_agent || '',
      device: summary.device,
      deviceName: row.device_name || summary.device,
      appName: summary.appName,
      os: summary.os,
      browser: summary.browser,
      platform: summary.platform,
      createdAt: row.created_at || null,
      lastActiveAt: row.last_active_at || row.created_at || null,
      expiresAt: row.expires_at || null,
      isCurrent
    };
  });

  const mobileCount = sessions.filter((s) => s.platform === 'mobile').length;
  const desktopCount = sessions.filter((s) => s.platform === 'desktop').length;

  return {
    sessions,
    summary: {
      total: sessions.length,
      mobileCount,
      desktopCount,
      uniqueIpCount: uniqueIps.size
    }
  };
}

/**
 * Revoke one session matching its hashed session ID (or raw ref) for a user and evict touch cache.
 */
export async function revokeUserSessionByHash(queryPg, userId, sessionId) {
  const cleanSessionId = String(sessionId || '').trim();
  if (!cleanSessionId) return false;

  const result = await queryPg(
    `SELECT token, session_token
     FROM system_sessions
     WHERE user_id = $1`,
    [String(userId)]
  );
  const match = (result?.rows || []).find((row) => {
    const ref = String(row.session_token || row.token || '');
    if (!ref) return false;
    return hashSessionIdentifier(ref) === cleanSessionId || ref === cleanSessionId;
  });
  if (!match) return false;

  const clauses = [];
  const params = [String(userId)];
  if (match.token && String(match.token).trim()) {
    params.push(String(match.token));
    clauses.push(`token = $${params.length}`);
  }
  if (match.session_token && String(match.session_token).trim()) {
    params.push(String(match.session_token));
    clauses.push(`session_token = $${params.length}`);
  }
  if (clauses.length === 0) return false;

  await queryPg(
    `DELETE FROM system_sessions
     WHERE user_id = $1 AND (${clauses.join(' OR ')})`,
    params
  );
  clearSessionTouchCache([match.token, match.session_token]);
  return true;
}
