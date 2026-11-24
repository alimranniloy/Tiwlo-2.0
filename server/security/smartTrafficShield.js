import crypto from 'node:crypto';
import { getOperationAST, parse } from 'graphql';
import { scanPayloadForMalwareOrWebShell } from './malwareGuardService.js';

const DEFAULT_CACHE_MAX_ENTRIES = 500;
const DEFAULT_CACHE_TTL_MS = 20_000;
const DEFAULT_MAX_CACHE_BODY_BYTES = 512 * 1024;
const DEFAULT_MAX_TRACKED_IPS = 10_000;
const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_READ_FLOOD_THRESHOLD = 20;
const DEFAULT_SAME_PATH_FLOOD_THRESHOLD = 12;
const DEFAULT_READ_BUCKET_CAPACITY = 24;
const DEFAULT_READ_BUCKET_REFILL_PER_SEC = 3;
const DEFAULT_UNAUTH_WRITE_BUCKET_CAPACITY = 15;
const DEFAULT_UNAUTH_WRITE_BUCKET_REFILL_PER_SEC = 1;
const DEFAULT_UNAUTH_COOLDOWN_SECONDS = 30;
const DEFAULT_TX_BUCKET_CAPACITY = 80;
const DEFAULT_TX_BUCKET_REFILL_PER_SEC = 15;
const MAX_INSPECTED_PAYLOAD_CHARS = 8192;
const MAX_REQUEST_PATH_CHARS = 512;
const MAX_RECENT_READS_PER_IP = 256;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CLEARANCE_TTL_MS = 30 * 60 * 1000;
export const SHIELD_CLEARANCE_COOKIE = '__tiwlo_shield_clearance';

const CHALLENGE_HMAC_SECRET = (() => {
  const envSecret = process.env.SECURITY_SECRET || process.env.SESSION_SECRET || '';
  if (envSecret.length >= 32) return envSecret;
  return crypto.randomBytes(32).toString('hex');
})();

const TRANSACTIONAL_ROUTE_PATTERNS = [
  { name: 'orders', pattern: /^\/(?:api\/)?orders(?:\/|$)/i },
  { name: 'checkout', pattern: /^\/(?:api\/)?checkout(?:\/|$)/i },
  { name: 'sales', pattern: /^\/(?:api\/)?sales(?:\/|$)/i },
  { name: 'cloud_droplets', pattern: /^\/(?:api\/)?cloud\/droplets(?:\/|$)/i },
  { name: 'cloud_billing', pattern: /^\/(?:api\/)?cloud\/billing(?:\/|$)/i },
  { name: 'billing', pattern: /^\/(?:api\/)?billing(?:\/|$)/i },
  { name: 'payments', pattern: /^\/(?:api\/)?payments(?:\/|$)/i },
  { name: 'domains', pattern: /^\/(?:api\/)?domains(?:\/|$)/i }
];

const WEBHOOK_EXEMPT_PATH_PATTERN = /^\/(?:api\/)?(?:webhooks?|stripe\/webhook|payments\/webhook)(?:\/|$)/i;
const CHALLENGE_EXEMPT_PATH_PATTERN = /^\/(?:api\/)?security\/challenge(?:\/(?:issue|verify))?\/?$/i;

// Strict fail-closed allowlist for public responses eligible for Smart Shadow-Cache.
// Authenticated, private, admin, account, domain, support, or user-scoped APIs are never cached.
const PUBLIC_CACHEABLE_PREFIXES = [
  '/health',
  '/api/health',
  '/api/public',
  '/status',
  '/pricing',
  '/about',
  '/contact',
  '/catalog',
  '/products',
  '/api/products',
  '/store/themes',
  '/store/plugins',
  '/docs/',
  '/domains/search'
];

const SCANNER_PATH_RULES = [
  { signature: 'scanner:dotenv', pattern: /(?:^|\/)\.env(?:\.[a-z0-9_-]+)?(?:$|\/|\?)/i },
  { signature: 'scanner:git', pattern: /(?:^|\/)\.git(?:\/|$)/i },
  { signature: 'scanner:wp_login', pattern: /(?:^|\/)(?:wp-login\.php|wp-admin|wp-content|xmlrpc\.php)(?:$|\/|\?)/i },
  { signature: 'scanner:phpmyadmin', pattern: /(?:^|\/)(?:phpmyadmin|pma|myadmin|adminer)(?:$|\/|\?)/i },
  { signature: 'scanner:aws_ssh', pattern: /(?:^|\/)\.(?:aws|ssh)\//i },
  { signature: 'scanner:cgi_bin', pattern: /(?:^|\/)cgi-bin\//i },
  { signature: 'scanner:etc_passwd', pattern: /\/etc\/passwd(?:$|\?)/i },
  { signature: 'scanner:actuator', pattern: /(?:^|\/)actuator\/(?:env|heapdump|mappings|gateway)(?:$|\/|\?)/i },
  { signature: 'scanner:phpunit', pattern: /\/vendor\/phpunit\//i }
];

const HONEYPOT_PATH_RULES = [
  { signature: 'honeypot:debug_env', pattern: /(?:^|\/)_debug\/env(?:$|\/|\?)/i },
  { signature: 'honeypot:internal_keys', pattern: /(?:^|\/)api\/v\d+\/internal\/keys(?:$|\/|\?)/i },
  { signature: 'honeypot:backup_sql', pattern: /(?:^|\/)(?:admin-backup|dump|db_backup|database)\.(?:sql|tar\.gz|zip)(?:$|\?)/i },
  { signature: 'honeypot:phpinfo', pattern: /(?:^|\/)(?:phpinfo|info|test|shell)\.php(?:$|\?)/i },
  { signature: 'honeypot:server_status', pattern: /(?:^|\/)(?:server-status|server-info|\.ds_store)(?:$|\/|\?)/i }
];

const AI_HACKER_AGENT_PATTERN = /(?:pentestgpt|hexstrike|burpsuite|burp[\s_-]?collaborator|caido|nuclei|sqlmap|nikto|ffuf|gobuster|feroxbuster|dirbuster|wpscan|xsstrike|commix|wfuzz|masscan|zgrab|shodan|subfinder|dalfox|autogpt|auto-gpt|crewai|langchain|browser-use|anthropic-computer-use|openai-operator|ai-redteam|redteam-agent|exploit-agent)/i;
const AI_HACKER_HEADER_NAMES = ['x-scanner', 'x-pentest', 'x-nuclei-id', 'x-sqlmap', 'x-burp', 'x-agent-framework'];

const TRAVERSAL_PATTERNS = [
  { signature: 'traversal:dotdot_slash', pattern: /\.\.[\\/]/ },
  { signature: 'traversal:encoded_dotdot', pattern: /%2e%2e(?:%2f|%5c|\/|\\)/i },
  { signature: 'traversal:double_encoded', pattern: /%252e%252e/i },
  { signature: 'traversal:null_byte', pattern: /%00|\0/ }
];

const SQLI_PATTERNS = [
  { signature: 'sqli:union_select', pattern: /\bunion(?:\s+all)?\s+select\s+(?:\*|null|\d+|['"]|@@|[a-z0-9_.,\s()]{1,120}\bfrom\b)/i },
  { signature: 'sqli:tautology', pattern: /(?:'|%27)\s*(?:or|and)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i },
  { signature: 'sqli:drop_table', pattern: /;\s*(?:drop|truncate|alter)\s+table\b/i },
  { signature: 'sqli:time_delay', pattern: /\b(?:sleep|benchmark|pg_sleep)\s*\(\s*\d+/i },
  { signature: 'sqli:waitfor', pattern: /\bwaitfor\s+delay\s*['"]/i },
  { signature: 'sqli:info_schema', pattern: /\binformation_schema\.(?:tables|columns)\b/i }
];

const XSS_PATTERNS = [
  { signature: 'xss:script_tag', pattern: /<\s*\/?\s*script\b/i },
  { signature: 'xss:javascript_uri', pattern: /\bjavascript\s*:/i },
  { signature: 'xss:event_handler', pattern: /\bon(?:error|load|mouseover|focus|click)\s*=/i },
  { signature: 'xss:svg_iframe', pattern: /<\s*(?:iframe|svg)\b[^>]{0,200}\b(?:src|onload|onerror)\s*=/i }
];

const SESSION_COOKIE_NAMES = new Set([
  'tiwlo_host_session',
  'tiwlo_store_customer_session',
  'tiwlo_session',
  'session',
  'connect.sid',
  'auth_token',
  'tiwlo_active_store'
]);

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TRANSACTIONAL_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const READ_METHODS = new Set(['GET', 'HEAD']);

class BoundedLRUCache {
  constructor(maxEntries = DEFAULT_CACHE_MAX_ENTRIES) {
    this.maxEntries = Math.max(1, Number(maxEntries) || DEFAULT_CACHE_MAX_ENTRIES);
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, value);
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }

  values() {
    return this.map.values();
  }

  entries() {
    return this.map.entries();
  }
}

function createInitialStats() {
  return {
    totalRequests: 0,
    allowedRequests: 0,
    shadowCacheHits: 0,
    shadowCacheStores: 0,
    absorbedFloodRequests: 0,
    blockedProbes: 0,
    blockedAiAgents: 0,
    blockedMalwarePayloads: 0,
    challengesIssued: 0,
    challengesVerified: 0,
    apiCooldownRejections: 0,
    threatEvents: 0,
    intentCounts: {
      authenticated_transactional: 0,
      authenticated_api: 0,
      public_read: 0,
      unauthenticated_write: 0,
      suspicious_probe: 0,
      ai_hacker_blocked: 0,
      general: 0
    }
  };
}

const shieldState = {
  shadowCache: new BoundedLRUCache(DEFAULT_CACHE_MAX_ENTRIES),
  ipTracker: new BoundedLRUCache(DEFAULT_MAX_TRACKED_IPS),
  txTracker: new BoundedLRUCache(DEFAULT_MAX_TRACKED_IPS),
  usedChallengeNonces: new BoundedLRUCache(DEFAULT_MAX_TRACKED_IPS),
  stats: createInitialStats()
};

function cleanTokenValue(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '[object Object]'
  ) {
    return '';
  }
  return trimmed;
}

function parseCookieHeader(cookieHeader) {
  const parsed = Object.create(null);
  if (typeof cookieHeader !== 'string' || !cookieHeader) return parsed;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const name = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (name) {
      parsed[name] = val;
    }
  }
  return parsed;
}

function extractAuthSession(req, { requireVerifiedAuth = false } = {}) {
  if (!req) return { isAuthenticated: false, sessionKey: null };

  if (req.activeUser && req.activeUser.id) {
    return { isAuthenticated: true, sessionKey: hashIdentifier(`user:${req.activeUser.id}`) };
  }

  // When running after upstream session hydration in production, unverified headers/cookies
  // never grant authenticated rate-limit exemptions or transactional classification.
  if (requireVerifiedAuth) {
    return { isAuthenticated: false, sessionKey: null };
  }

  const headers = req.headers || {};
  const authHeader = headers.authorization || headers.Authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = cleanTokenValue(authHeader.slice(7));
    if (token.length >= 12) {
      return { isAuthenticated: true, sessionKey: hashIdentifier(`bearer:${token}`) };
    }
  }

  const xSessionToken = cleanTokenValue(headers['x-session-token']);
  if (xSessionToken.length >= 12) {
    return { isAuthenticated: true, sessionKey: hashIdentifier(`xsession:${xSessionToken}`) };
  }

  if (req.cookies && typeof req.cookies === 'object') {
    for (const cookieName of SESSION_COOKIE_NAMES) {
      const val = cleanTokenValue(req.cookies[cookieName]);
      if (val.length >= 12) {
        return { isAuthenticated: true, sessionKey: hashIdentifier(`cookie:${cookieName}:${val}`) };
      }
    }
  }

  const headerCookies = parseCookieHeader(headers.cookie);
  for (const cookieName of SESSION_COOKIE_NAMES) {
    const val = cleanTokenValue(headerCookies[cookieName]);
    if (val.length >= 12) {
      return { isAuthenticated: true, sessionKey: hashIdentifier(`cookie:${cookieName}:${val}`) };
    }
  }

  return { isAuthenticated: false, sessionKey: null };
}

function hashIdentifier(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function normalizeIp(rawIp) {
  const first = String(rawIp || '').split(',')[0].trim();
  if (!first) return 'unknown';
  if (first.startsWith('::ffff:')) return first.slice(7);
  return first;
}

function getClientIp(req) {
  return normalizeIp(
    req?.ip ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    'unknown'
  );
}

function getSubnetPrefix(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes('.')) {
    const octets = ip.split('.');
    if (octets.length === 4) {
      return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
    }
  }
  if (ip.includes(':')) {
    const groups = ip.split(':').filter(Boolean).slice(0, 3);
    if (groups.length > 0) {
      return `${groups.join(':')}::/48`;
    }
  }
  return ip;
}

function extractRequestPath(req) {
  const raw = req?.path || req?.originalUrl || req?.url || '/';
  const str = String(raw);
  const qIndex = str.indexOf('?');
  const pathOnly = qIndex === -1 ? str : str.slice(0, qIndex);
  return pathOnly.slice(0, MAX_REQUEST_PATH_CHARS);
}

function extractRawUrl(req) {
  return String(req?.originalUrl || req?.url || req?.path || '/').slice(0, MAX_INSPECTED_PAYLOAD_CHARS);
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function collectInspectionStrings(req) {
  const rawUrl = extractRawUrl(req);
  const decodedOnce = safeDecodeURIComponent(rawUrl);
  const decodedTwice = safeDecodeURIComponent(decodedOnce);
  const candidates = [rawUrl];
  if (decodedOnce !== rawUrl) candidates.push(decodedOnce);
  if (decodedTwice !== decodedOnce) candidates.push(decodedTwice);

  if (req?.query && typeof req.query === 'object') {
    try {
      const qStr = JSON.stringify(req.query).slice(0, MAX_INSPECTED_PAYLOAD_CHARS);
      if (qStr && qStr !== '{}') {
        candidates.push(qStr);
      }
    } catch {
      // ignore non-serializable query
    }
  }

  if (req?.body && typeof req.body === 'object') {
    try {
      const bStr = JSON.stringify(req.body).slice(0, MAX_INSPECTED_PAYLOAD_CHARS);
      if (bStr && bStr !== '{}') {
        candidates.push(bStr);
      }
    } catch {
      // ignore non-serializable body
    }
  } else if (typeof req?.body === 'string' && req.body.length > 0) {
    candidates.push(req.body.slice(0, MAX_INSPECTED_PAYLOAD_CHARS));
  }

  return candidates;
}

function matchPatternList(patterns, texts) {
  for (const text of texts) {
    for (const rule of patterns) {
      if (rule.pattern.test(text)) {
        return rule.signature;
      }
    }
  }
  return null;
}

/**
 * Deterministic, zero-allocation-heavy exploit, malware-shell, honeypot, and AI-hacker signature detector.
 */
export function detectHackingSignature(req) {
  const reqPath = extractRequestPath(req);
  const decodedPath = safeDecodeURIComponent(reqPath);
  const pathCandidates = decodedPath !== reqPath ? [reqPath, decodedPath] : [reqPath];
  const headers = req?.headers || {};
  const ua = String(headers['user-agent'] || '');

  // Autonomous AI hacker / offensive pentest framework User-Agent & headers
  const flaggedAiHeader = AI_HACKER_HEADER_NAMES.find((h) => Boolean(headers[h]));
  if (AI_HACKER_AGENT_PATTERN.test(ua) || flaggedAiHeader) {
    return {
      detected: true,
      matched: true,
      category: 'ai_hacker',
      signature: flaggedAiHeader ? `ai_hacker:header_${flaggedAiHeader}` : 'ai_hacker:agent_signature',
      reason: 'Autonomous AI hacking agent or offensive scanner blocked',
      statusCode: 403,
      threatPoints: 70
    };
  }

  const allStrings = collectInspectionStrings(req);

  const traversalSig = matchPatternList(TRAVERSAL_PATTERNS, allStrings);
  if (traversalSig) {
    return {
      detected: true,
      matched: true,
      category: 'traversal',
      signature: traversalSig,
      reason: 'Path traversal sequence detected',
      statusCode: 403,
      threatPoints: 45
    };
  }

  const honeypotSig = matchPatternList(HONEYPOT_PATH_RULES, pathCandidates);
  if (honeypotSig) {
    return {
      detected: true,
      matched: true,
      category: 'honeypot',
      signature: honeypotSig,
      reason: 'Deceptive probe / recon honeypot triggered',
      statusCode: 404,
      threatPoints: 60
    };
  }

  const scannerSig = matchPatternList(SCANNER_PATH_RULES, pathCandidates);
  if (scannerSig) {
    return {
      detected: true,
      matched: true,
      category: 'scanner',
      signature: scannerSig,
      reason: 'Known vulnerability scanner or sensitive probe path',
      statusCode: 404,
      threatPoints: 35
    };
  }

  // Signed payment webhooks carry arbitrary opaque JSON payloads and are verified by HMAC downstream
  if (WEBHOOK_EXEMPT_PATH_PATTERN.test(reqPath)) {
    return {
      detected: false,
      matched: false,
      category: null,
      signature: null,
      reason: null,
      statusCode: 200,
      threatPoints: 0
    };
  }

  // Detect PHP web-shells, reverse shells, and crypto-miner payloads in request bodies / URLs
  for (const candidate of allStrings) {
    const malwareRes = scanPayloadForMalwareOrWebShell({ content: candidate });
    if (malwareRes && !malwareRes.clean && Array.isArray(malwareRes.findings) && malwareRes.findings.length > 0) {
      return {
        detected: true,
        matched: true,
        category: 'malware_shell',
        signature: `malware:${malwareRes.findings[0].id}`,
        reason: 'Malicious web-shell, reverse-shell, or exploit script blocked',
        statusCode: 403,
        threatPoints: 75
      };
    }
  }

  const sqliSig = matchPatternList(SQLI_PATTERNS, allStrings);
  if (sqliSig) {
    return {
      detected: true,
      matched: true,
      category: 'sqli',
      signature: sqliSig,
      reason: 'SQL injection payload signature detected',
      statusCode: 403,
      threatPoints: 50
    };
  }

  const xssSig = matchPatternList(XSS_PATTERNS, allStrings);
  if (xssSig) {
    return {
      detected: true,
      matched: true,
      category: 'xss',
      signature: xssSig,
      reason: 'Script injection payload signature detected',
      statusCode: 403,
      threatPoints: 40
    };
  }

  return {
    detected: false,
    matched: false,
    category: null,
    signature: null,
    reason: null,
    statusCode: 200,
    threatPoints: 0
  };
}

function findTransactionalDomain(reqPath) {
  for (const route of TRANSACTIONAL_ROUTE_PATTERNS) {
    if (route.pattern.test(reqPath)) {
      return route.name;
    }
  }
  return null;
}

function hasAnySessionCookie(req) {
  if (!req) return false;
  if (req.cookies && typeof req.cookies === 'object') {
    for (const cookieName of SESSION_COOKIE_NAMES) {
      if (cleanTokenValue(req.cookies[cookieName])) return true;
    }
  }
  const parsed = parseCookieHeader(req.headers?.cookie);
  for (const cookieName of SESSION_COOKIE_NAMES) {
    if (cleanTokenValue(parsed[cookieName])) return true;
  }
  return false;
}

function isPublicCacheableRead(req, reqPath, authInfo) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (!READ_METHODS.has(method)) return false;

  // Never serve shared shadow cache for requests carrying ANY auth tokens or session cookies
  const headers = req?.headers || {};
  if (
    authInfo?.isAuthenticated ||
    req?.activeUser?.id ||
    headers.authorization ||
    headers.Authorization ||
    headers['x-session-token'] ||
    headers['x-csrf-token'] ||
    hasAnySessionCookie(req)
  ) {
    return false;
  }

  const normalized = String(reqPath || '/').toLowerCase();
  if (normalized === '/') return true;
  for (const prefix of PUBLIC_CACHEABLE_PREFIXES) {
    if (prefix.endsWith('/')) {
      if (normalized.startsWith(prefix)) return true;
    } else if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  return false;
}

const TELEMETRY_READ_PATH_PATTERN = /^\/(?:api\/)?telemetry\/(?:visitor|pageview|events?)(?:\/|$)/i;

function isPassiveTelemetryOrGraphqlQuery(req, reqPath) {
  const method = String(req?.method || '').toUpperCase();
  if (method !== 'POST') return false;
  if (TELEMETRY_READ_PATH_PATTERN.test(reqPath)) return true;
  if (!/^\/(?:api\/)?graphql\/?$/i.test(reqPath)) return false;
  const queryText = req?.body?.query;
  if (typeof queryText !== 'string' || !queryText.trim()) return false;
  try {
    const ast = parse(queryText);
    return getOperationAST(ast, req?.body?.operationName)?.operation === 'query';
  } catch {
    return false;
  }
}

/**
 * Classifies incoming HTTP request intent for behavioral shaping and shadow caching.
 */
export function classifyRequestIntent(req, options = {}) {
  const method = String(req?.method || 'GET').toUpperCase();
  const path = extractRequestPath(req);
  const hackingSignature = detectHackingSignature(req);
  const authInfo = extractAuthSession(req, { requireVerifiedAuth: Boolean(options?.requireVerifiedAuth) });
  const transactionalDomain = findTransactionalDomain(path);

  if (hackingSignature.detected) {
    return {
      intent: hackingSignature.category === 'ai_hacker' ? 'ai_hacker_blocked' : 'suspicious_probe',
      method,
      path,
      isAuthenticated: authInfo.isAuthenticated,
      sessionKey: authInfo.sessionKey,
      isTransactional: false,
      isCacheablePublicRead: false,
      isSuspicious: true,
      transactionalDomain,
      hackingSignature
    };
  }

  if (TRANSACTIONAL_METHODS.has(method) && authInfo.isAuthenticated && transactionalDomain) {
    return {
      intent: 'authenticated_transactional',
      method,
      path,
      isAuthenticated: true,
      sessionKey: authInfo.sessionKey,
      isTransactional: true,
      isCacheablePublicRead: false,
      isSuspicious: false,
      transactionalDomain,
      hackingSignature: null
    };
  }

  if (MUTATION_METHODS.has(method) && authInfo.isAuthenticated) {
    return {
      intent: 'authenticated_api',
      method,
      path,
      isAuthenticated: true,
      sessionKey: authInfo.sessionKey,
      isTransactional: Boolean(transactionalDomain),
      isCacheablePublicRead: false,
      isSuspicious: false,
      transactionalDomain,
      hackingSignature: null
    };
  }

  if (MUTATION_METHODS.has(method) && !authInfo.isAuthenticated) {
    if (isPassiveTelemetryOrGraphqlQuery(req, path)) {
      return {
        intent: 'public_read',
        method,
        path,
        isAuthenticated: false,
        sessionKey: null,
        isTransactional: false,
        isCacheablePublicRead: false,
        isSuspicious: false,
        transactionalDomain,
        hackingSignature: null
      };
    }
    return {
      intent: 'unauthenticated_write',
      method,
      path,
      isAuthenticated: false,
      sessionKey: null,
      isTransactional: false,
      isCacheablePublicRead: false,
      isSuspicious: false,
      transactionalDomain,
      hackingSignature: null
    };
  }

  if (READ_METHODS.has(method)) {
    const cacheable = isPublicCacheableRead(req, path, authInfo);
    return {
      intent: 'public_read',
      method,
      path,
      isAuthenticated: authInfo.isAuthenticated,
      sessionKey: authInfo.sessionKey,
      isTransactional: false,
      isCacheablePublicRead: cacheable,
      isSuspicious: false,
      transactionalDomain,
      hackingSignature: null
    };
  }

  return {
    intent: 'general',
    method,
    path,
    isAuthenticated: authInfo.isAuthenticated,
    sessionKey: authInfo.sessionKey,
    isTransactional: false,
    isCacheablePublicRead: false,
    isSuspicious: false,
    transactionalDomain,
    hackingSignature: null
  };
}

function consumeTokenBucket(bucket, now, capacity, refillPerSec) {
  const elapsedSec = Math.max(0, (now - bucket.lastRefillAt) / 1000);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.lastRefillAt = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

function computePathEntropy(recentHits) {
  const total = recentHits.length;
  if (total <= 1) return 0;
  const counts = new Map();
  for (const hit of recentHits) {
    counts.set(hit.path, (counts.get(hit.path) || 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function getOrCreateIpState(ip, now, config) {
  let entry = shieldState.ipTracker.get(ip);
  if (!entry) {
    entry = {
      ip,
      subnet: getSubnetPrefix(ip),
      recentReads: [],
      readBucket: { tokens: config.readBucketCapacity, lastRefillAt: now },
      unauthWriteBucket: { tokens: config.unauthWriteBucketCapacity, lastRefillAt: now },
      cooldownUntil: 0,
      threatScore: 0,
      lastSeenAt: now
    };
    shieldState.ipTracker.set(ip, entry);
  } else {
    entry.lastSeenAt = now;
  }
  return entry;
}

function getOrCreateTxState(sessionKey, now, config) {
  let entry = shieldState.txTracker.get(sessionKey);
  if (!entry) {
    entry = {
      sessionKey,
      bucket: { tokens: config.txBucketCapacity, lastRefillAt: now },
      lastSeenAt: now
    };
    shieldState.txTracker.set(sessionKey, entry);
  } else {
    entry.lastSeenAt = now;
  }
  return entry;
}

function pruneSlidingWindow(hits, cutoffMs) {
  let idx = 0;
  while (idx < hits.length && hits[idx].ts < cutoffMs) {
    idx += 1;
  }
  if (idx > 0) {
    hits.splice(0, idx);
  }
}

function getUaHash(req) {
  return hashIdentifier(String(req?.headers?.['user-agent'] || 'none'));
}

function signTokenPayload(payloadObj) {
  const b64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', CHALLENGE_HMAC_SECRET).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

function verifySignedToken(token) {
  if (typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const b64 = token.slice(0, dotIdx);
  const sigHex = token.slice(dotIdx + 1);
  if (!/^[a-f0-9]{64}$/i.test(sigHex)) return null;
  const expectedHex = crypto.createHmac('sha256', CHALLENGE_HMAC_SECRET).update(b64).digest('hex');
  const a = Buffer.from(sigHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function issueShieldChallenge(req, { reason = 'security_verification', difficulty = 4, now = Date.now() } = {}) {
  const clampedDifficulty = Math.min(6, Math.max(3, Math.trunc(Number(difficulty) || 4)));
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = now + CHALLENGE_TTL_MS;
  const challengeToken = signTokenPayload({
    v: 1,
    nonce,
    difficulty: clampedDifficulty,
    issuedAt: now,
    expiresAt,
    uaHash: getUaHash(req),
    reason: String(reason || 'security_verification').slice(0, 64)
  });
  shieldState.stats.challengesIssued += 1;
  return {
    nonce,
    difficulty: clampedDifficulty,
    issuedAt: now,
    expiresAt,
    reason,
    challengeToken
  };
}

export function verifyShieldChallengeSolution(req, { challengeToken, solution } = {}, { now = Date.now() } = {}) {
  const payload = verifySignedToken(challengeToken);
  if (!payload || !payload.nonce) {
    return { valid: false, reason: 'Invalid or tampered challenge token.' };
  }
  if (now > Number(payload.expiresAt || 0)) {
    return { valid: false, reason: 'Challenge expired. Please request a fresh verification challenge.' };
  }
  if (payload.uaHash && payload.uaHash !== getUaHash(req)) {
    return { valid: false, reason: 'Challenge browser mismatch.' };
  }
  if (shieldState.usedChallengeNonces.get(payload.nonce)) {
    return { valid: false, reason: 'Challenge already consumed.' };
  }
  const solStr = String(solution ?? '').trim();
  if (!solStr || solStr.length > 64) {
    return { valid: false, reason: 'Missing or invalid solution.' };
  }
  const difficulty = Math.min(6, Math.max(1, Math.trunc(Number(payload.difficulty) || 4)));
  const digest = crypto.createHash('sha256').update(`${challengeToken}:${solStr}`).digest('hex');
  if (!digest.startsWith('0'.repeat(difficulty))) {
    return { valid: false, reason: 'Proof-of-Work hash does not satisfy required difficulty.' };
  }

  shieldState.usedChallengeNonces.set(payload.nonce, now);
  shieldState.stats.challengesVerified += 1;

  const clearanceExpiresAt = now + CLEARANCE_TTL_MS;
  const clearanceCookieValue = signTokenPayload({
    v: 1,
    clearedAt: now,
    expiresAt: clearanceExpiresAt,
    uaHash: getUaHash(req),
    level: difficulty
  });

  return {
    valid: true,
    difficulty,
    clearanceExpiresAt,
    clearanceCookieValue
  };
}

export function hasValidShieldClearance(req, now = Date.now()) {
  if (!req) return { cleared: false, level: 0 };
  let raw = req.cookies?.[SHIELD_CLEARANCE_COOKIE];
  if (!raw && req.headers?.cookie) {
    raw = parseCookieHeader(req.headers.cookie)[SHIELD_CLEARANCE_COOKIE];
  }
  const payload = verifySignedToken(cleanTokenValue(raw));
  if (!payload || now > Number(payload.expiresAt || 0)) {
    return { cleared: false, level: 0 };
  }
  if (payload.uaHash && payload.uaHash !== getUaHash(req)) {
    return { cleared: false, level: 0 };
  }
  return { cleared: true, level: Number(payload.level) || 4 };
}

function getShadowCacheKey(req) {
  const method = String(req?.method || 'GET').toUpperCase();
  const rawHost = String(req?.headers?.host || 'default').toLowerCase().trim();
  const safeHost = rawHost.replace(/:\d+$/, '').replace(/[^a-z0-9.-]/g, '') || 'default';
  const acceptHeader = String(req?.headers?.accept || '').toLowerCase();
  const acceptKind = acceptHeader.includes('text/html') ? 'html' : 'json';
  const url = String(req?.originalUrl || req?.url || req?.path || '/').slice(0, MAX_REQUEST_PATH_CHARS);
  return `${method}:${safeHost}:${acceptKind}:${url}`;
}

function setResponseHeader(res, name, value) {
  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value);
    return;
  }
  if (typeof res.set === 'function') {
    res.set(name, value);
    return;
  }
  if (res.headers && typeof res.headers === 'object') {
    res.headers[name.toLowerCase()] = value;
  }
}

function getResponseHeaders(res) {
  if (typeof res.getHeaders === 'function') {
    return { ...res.getHeaders() };
  }
  if (res.headers && typeof res.headers === 'object') {
    return { ...res.headers };
  }
  return {};
}

function sendJsonError(res, statusCode, payload) {
  if (typeof res.status === 'function') {
    res.status(statusCode);
  } else {
    res.statusCode = statusCode;
  }
  if (typeof res.json === 'function') {
    return res.json(payload);
  }
  setResponseHeader(res, 'Content-Type', 'application/json; charset=utf-8');
  const raw = JSON.stringify(payload);
  if (typeof res.send === 'function') {
    return res.send(raw);
  }
  return res.end?.(raw);
}

function serveFromShadowCache(req, res, cachedEntry, shieldMeta) {
  shieldMeta.servedFromShadowCache = true;
  req.trafficShield = shieldMeta;
  if (res.locals && typeof res.locals === 'object') {
    res.locals.trafficShield = shieldMeta;
    res.locals.servedFromShadowCache = true;
  }

  shieldState.stats.shadowCacheHits += 1;
  shieldState.stats.absorbedFloodRequests += 1;

  for (const [headerName, headerVal] of Object.entries(cachedEntry.headers || {})) {
    const lower = headerName.toLowerCase();
    if (lower === 'content-length' || lower === 'transfer-encoding' || lower === 'connection') {
      continue;
    }
    if (headerVal !== undefined) {
      setResponseHeader(res, headerName, headerVal);
    }
  }
  setResponseHeader(res, 'X-Shadow-Cache', 'HIT');

  if (typeof res.status === 'function') {
    res.status(cachedEntry.statusCode);
  } else {
    res.statusCode = cachedEntry.statusCode;
  }

  if (cachedEntry.isJson) {
    if (typeof res.json === 'function') {
      return res.json(JSON.parse(cachedEntry.jsonText));
    }
    setResponseHeader(res, 'Content-Type', 'application/json; charset=utf-8');
    if (typeof res.send === 'function') {
      return res.send(cachedEntry.jsonText);
    }
    return res.end?.(cachedEntry.jsonText);
  }

  if (typeof res.send === 'function') {
    return res.send(cachedEntry.body);
  }
  return res.end?.(cachedEntry.body);
}

function attachResponseCapture(res, cacheKey, config, nowFn) {
  let captured = false;

  const storeSnapshot = (isJson, rawBody) => {
    if (captured) return;
    captured = true;

    const statusCode = Number(res.statusCode || 200);
    if (statusCode !== 200) return;

    const headers = getResponseHeaders(res);
    const cacheControl = String(headers['cache-control'] || '').toLowerCase();
    const varyHeader = String(headers['vary'] || '').toLowerCase();
    if (
      headers['set-cookie'] !== undefined ||
      varyHeader.includes('cookie') ||
      varyHeader.includes('authorization') ||
      cacheControl.includes('no-store') ||
      cacheControl.includes('no-cache') ||
      cacheControl.includes('private')
    ) {
      return;
    }

    let entry;
    if (isJson) {
      let jsonText;
      try {
        jsonText = JSON.stringify(rawBody);
      } catch {
        return;
      }
      if (Buffer.byteLength(jsonText, 'utf8') > config.maxCacheBodyBytes) return;
      entry = {
        statusCode: 200,
        isJson: true,
        jsonText,
        headers,
        cachedAt: nowFn(),
        expiresAt: nowFn() + config.cacheTtlMs
      };
    } else {
      if (rawBody === undefined || rawBody === null) return;
      const bodyLen = Buffer.isBuffer(rawBody)
        ? rawBody.length
        : Buffer.byteLength(String(rawBody), 'utf8');
      if (bodyLen > config.maxCacheBodyBytes) return;
      entry = {
        statusCode: 200,
        isJson: false,
        body: Buffer.isBuffer(rawBody) ? Buffer.from(rawBody) : String(rawBody),
        headers,
        cachedAt: nowFn(),
        expiresAt: nowFn() + config.cacheTtlMs
      };
    }

    shieldState.shadowCache.set(cacheKey, entry);
    shieldState.stats.shadowCacheStores += 1;
  };

  if (typeof res.json === 'function') {
    const origJson = res.json;
    res.json = function wrappedJson(body) {
      storeSnapshot(true, body);
      return origJson.call(this, body);
    };
  }

  if (typeof res.send === 'function') {
    const origSend = res.send;
    res.send = function wrappedSend(body) {
      if (!captured) {
        const ct = String(getResponseHeaders(res)['content-type'] || '').toLowerCase();
        if (ct.includes('application/json') && typeof body === 'string') {
          try {
            storeSnapshot(true, JSON.parse(body));
          } catch {
            storeSnapshot(false, body);
          }
        } else {
          storeSnapshot(false, body);
        }
      }
      return origSend.call(this, body);
    };
  }

  if (typeof res.end === 'function') {
    const origEnd = res.end;
    res.end = function wrappedEnd(chunk, encoding, cb) {
      if (!captured && chunk !== undefined && typeof chunk !== 'function') {
        storeSnapshot(false, chunk);
      }
      return origEnd.call(this, chunk, encoding, cb);
    };
  }
}

function getValidCachedEntry(cacheKey, now, allowStaleFallback = false) {
  const entry = shieldState.shadowCache.get(cacheKey);
  if (!entry) return null;
  if (now <= entry.expiresAt) return entry;
  if (allowStaleFallback && now <= entry.expiresAt + 60_000) {
    return entry;
  }
  shieldState.shadowCache.delete(cacheKey);
  return null;
}

/**
 * Creates the Behavioral Traffic Shaping, Smart Shadow-Caching DDoS Shield & Anti-Hacking Middleware.
 */
export function createSmartTrafficShieldMiddleware(options = {}) {
  const config = {
    cacheMaxEntries: options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES,
    cacheTtlMs: options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
    maxCacheBodyBytes: options.maxCacheBodyBytes ?? DEFAULT_MAX_CACHE_BODY_BYTES,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    readFloodThreshold: options.readFloodThreshold ?? DEFAULT_READ_FLOOD_THRESHOLD,
    samePathFloodThreshold: options.samePathFloodThreshold ?? DEFAULT_SAME_PATH_FLOOD_THRESHOLD,
    readBucketCapacity: options.readBucketCapacity ?? DEFAULT_READ_BUCKET_CAPACITY,
    readBucketRefillPerSec: options.readBucketRefillPerSec ?? DEFAULT_READ_BUCKET_REFILL_PER_SEC,
    unauthWriteBucketCapacity: options.unauthWriteBucketCapacity ?? DEFAULT_UNAUTH_WRITE_BUCKET_CAPACITY,
    unauthWriteBucketRefillPerSec: options.unauthWriteBucketRefillPerSec ?? DEFAULT_UNAUTH_WRITE_BUCKET_REFILL_PER_SEC,
    cooldownSeconds: options.cooldownSeconds ?? DEFAULT_UNAUTH_COOLDOWN_SECONDS,
    txBucketCapacity: options.txBucketCapacity ?? DEFAULT_TX_BUCKET_CAPACITY,
    txBucketRefillPerSec: options.txBucketRefillPerSec ?? DEFAULT_TX_BUCKET_REFILL_PER_SEC,
    requireVerifiedAuth: Boolean(options.requireVerifiedAuth),
    now: typeof options.now === 'function' ? options.now : () => Date.now()
  };

  if (shieldState.shadowCache.maxEntries !== config.cacheMaxEntries) {
    shieldState.shadowCache.maxEntries = Math.max(1, Number(config.cacheMaxEntries) || DEFAULT_CACHE_MAX_ENTRIES);
  }

  return function smartTrafficShieldMiddleware(req, res, next) {
    const now = config.now();
    const ip = getClientIp(req);
    const classification = classifyRequestIntent(req, { requireVerifiedAuth: config.requireVerifiedAuth });

    shieldState.stats.totalRequests += 1;
    shieldState.stats.intentCounts[classification.intent] =
      (shieldState.stats.intentCounts[classification.intent] || 0) + 1;

    const ipState = getOrCreateIpState(ip, now, config);
    const clearance = hasValidShieldClearance(req, now);

    const shieldMeta = {
      intent: classification.intent,
      ip,
      subnet: ipState.subnet,
      isAuthenticated: classification.isAuthenticated,
      isTransactional: classification.isTransactional,
      servedFromShadowCache: false,
      challengeCleared: clearance.cleared,
      threatScore: ipState.threatScore
    };

    req.trafficShield = shieldMeta;
    if (res.locals && typeof res.locals === 'object') {
      res.locals.trafficShield = shieldMeta;
    }

    // 1. Instant deterministic drop / honeypot tarpit for exploit, malware shell, scanner, and AI hacker signatures
    if (classification.isSuspicious && classification.hackingSignature) {
      const sig = classification.hackingSignature;
      ipState.threatScore += sig.threatPoints;
      shieldState.stats.blockedProbes += 1;
      shieldState.stats.threatEvents += 1;
      if (sig.category === 'ai_hacker') {
        shieldState.stats.blockedAiAgents += 1;
      } else if (sig.category === 'malware_shell') {
        shieldState.stats.blockedMalwarePayloads += 1;
      }
      shieldMeta.threatScore = ipState.threatScore;
      shieldMeta.blockedReason = sig.signature;

      setResponseHeader(res, 'X-Traffic-Shield', sig.category === 'ai_hacker' ? 'ai-blocked' : 'dropped');
      if (sig.statusCode === 404) {
        return sendJsonError(res, 404, { error: 'Not Found' });
      }
      return sendJsonError(res, 403, {
        error: sig.category === 'ai_hacker' ? 'AI_HACKER_BLOCKED' : 'Forbidden',
        code: sig.category === 'ai_hacker' ? 'AI_HACKER_BLOCKED' : undefined
      });
    }

    // Always allow webhook callbacks and PoW verification endpoints past rate-cooldown gates
    if (WEBHOOK_EXEMPT_PATH_PATTERN.test(classification.path) || CHALLENGE_EXEMPT_PATH_PATTERN.test(classification.path)) {
      shieldState.stats.allowedRequests += 1;
      return next();
    }

    // 2. Authenticated transactional & authenticated API flows: isolated enforced token bucket
    if (
      classification.intent === 'authenticated_transactional' ||
      classification.intent === 'authenticated_api'
    ) {
      const txKey = classification.sessionKey || `ip:${ip}`;
      const txState = getOrCreateTxState(txKey, now, config);
      const txAllowed = consumeTokenBucket(txState.bucket, now, config.txBucketCapacity, config.txBucketRefillPerSec);
      if (!txAllowed) {
        shieldState.stats.apiCooldownRejections += 1;
        setResponseHeader(res, 'Retry-After', String(config.cooldownSeconds));
        setResponseHeader(res, 'X-Traffic-Shield', 'challenge-required');
        return sendJsonError(res, 429, {
          error: 'Transaction rate limit exceeded. Complete security verification to continue.',
          code: 'SHIELD_CHALLENGE_REQUIRED',
          cooldownSeconds: config.cooldownSeconds,
          challenge: issueShieldChallenge(req, { reason: 'transaction_rate_limit', difficulty: 4, now })
        });
      }
      shieldState.stats.allowedRequests += 1;
      return next();
    }

    // 3. Unauthenticated POST/PUT/PATCH/DELETE traffic:
    //    NEVER permanently blacklist the shared NAT IP! Instead, issue a strict Google-style PoW Challenge;
    //    real browsers that solve the challenge receive an HttpOnly UA-bound clearance cookie and pass seamlessly.
    if (classification.intent === 'unauthenticated_write') {
      if (clearance.cleared) {
        shieldState.stats.allowedRequests += 1;
        return next();
      }

      if (ipState.cooldownUntil > now) {
        const remainingSeconds = Math.max(1, Math.ceil((ipState.cooldownUntil - now) / 1000));
        shieldState.stats.apiCooldownRejections += 1;
        const difficulty = ipState.threatScore >= 35 ? 5 : 4;
        setResponseHeader(res, 'Retry-After', String(remainingSeconds));
        setResponseHeader(res, 'X-Traffic-Shield', 'challenge-required');
        return sendJsonError(res, 429, {
          error: 'Automated activity verification required. Please solve the security challenge to continue.',
          code: 'SHIELD_CHALLENGE_REQUIRED',
          cooldownSeconds: remainingSeconds,
          challenge: issueShieldChallenge(req, { reason: 'unauthenticated_write_burst', difficulty, now })
        });
      }

      const allowedWrite = consumeTokenBucket(
        ipState.unauthWriteBucket,
        now,
        config.unauthWriteBucketCapacity,
        config.unauthWriteBucketRefillPerSec
      );
      if (!allowedWrite) {
        ipState.cooldownUntil = now + config.cooldownSeconds * 1000;
        ipState.threatScore += 15;
        shieldState.stats.apiCooldownRejections += 1;
        shieldState.stats.threatEvents += 1;
        const difficulty = ipState.threatScore >= 35 ? 5 : 4;
        setResponseHeader(res, 'Retry-After', String(config.cooldownSeconds));
        setResponseHeader(res, 'X-Traffic-Shield', 'challenge-required');
        return sendJsonError(res, 429, {
          error: 'Too many unauthenticated requests. Complete verification challenge to continue.',
          code: 'SHIELD_CHALLENGE_REQUIRED',
          cooldownSeconds: config.cooldownSeconds,
          challenge: issueShieldChallenge(req, { reason: 'unauthenticated_write_rate', difficulty, now })
        });
      }

      shieldState.stats.allowedRequests += 1;
      return next();
    }

    // 4. Public GET / HEAD read traffic: bounded sliding window velocity + behavioral AI-recon detection + Shadow Cache
    if (classification.intent === 'public_read') {
      pruneSlidingWindow(ipState.recentReads, now - config.windowMs);
      if (ipState.recentReads.length >= MAX_RECENT_READS_PER_IP) {
        ipState.recentReads.shift();
      }
      ipState.recentReads.push({ path: classification.path, ts: now });

      const readVelocity = ipState.recentReads.length;
      const samePathCount = ipState.recentReads.reduce(
        (acc, item) => (item.path === classification.path ? acc + 1 : acc),
        0
      );
      const entropy = computePathEntropy(ipState.recentReads);
      const bucketAllowed = consumeTokenBucket(
        ipState.readBucket,
        now,
        config.readBucketCapacity,
        config.readBucketRefillPerSec
      );

      // Escalate non-human high-entropy rapid API recon (typical of autonomous AI scanners) to strict PoW Level-5
      const suspiciousAiCadence =
        !clearance.cleared &&
        !classification.isAuthenticated &&
        readVelocity >= 12 &&
        entropy >= 2.6 &&
        !bucketAllowed &&
        /^\/(?:api|graphql|admin|auth)\b/i.test(classification.path);
      if (suspiciousAiCadence) {
        ipState.threatScore += 25;
        shieldState.stats.threatEvents += 1;
        setResponseHeader(res, 'X-Traffic-Shield', 'challenge-strict');
        return sendJsonError(res, 429, {
          error: 'Strict behavioral verification required before continuing.',
          code: 'SHIELD_CHALLENGE_REQUIRED',
          cooldownSeconds: config.cooldownSeconds,
          challenge: issueShieldChallenge(req, { reason: 'ai_recon_cadence', difficulty: 5, now })
        });
      }

      // Legitimate multi-link browsing (high path diversity / entropy) gets extra headroom
      const browsingHeadroom = entropy >= 1.5 ? Math.ceil(config.readFloodThreshold * 1.5) : config.readFloodThreshold;
      const isReadFlood =
        samePathCount > config.samePathFloodThreshold ||
        readVelocity > browsingHeadroom ||
        (!bucketAllowed && entropy < 1.0);

      if (classification.isCacheablePublicRead) {
        const cacheKey = getShadowCacheKey(req);
        if (isReadFlood) {
          const cached = getValidCachedEntry(cacheKey, now, true);
          if (cached) {
            return serveFromShadowCache(req, res, cached, shieldMeta);
          }
        }

        // First / normal request populates the bounded LRU shadow cache without altering response
        if (!getValidCachedEntry(cacheKey, now, false)) {
          attachResponseCapture(res, cacheKey, config, config.now);
        }
      }

      shieldState.stats.allowedRequests += 1;
      return next();
    }

    shieldState.stats.allowedRequests += 1;
    return next();
  };
}

/**
 * Returns live operational metrics for the Smart Traffic Shield.
 */
export function getTrafficShieldStats() {
  const now = Date.now();
  let activeCooldownIps = 0;
  const topThreats = [];

  for (const entry of shieldState.ipTracker.values()) {
    if (entry.cooldownUntil > now) {
      activeCooldownIps += 1;
    }
    if (entry.threatScore > 0) {
      topThreats.push({
        ip: entry.ip,
        subnet: entry.subnet,
        threatScore: entry.threatScore,
        cooldownActive: entry.cooldownUntil > now
      });
    }
  }

  topThreats.sort((a, b) => b.threatScore - a.threatScore);

  return {
    ...shieldState.stats,
    intentCounts: { ...shieldState.stats.intentCounts },
    shadowCacheEntries: shieldState.shadowCache.size,
    shadowCacheMaxEntries: shieldState.shadowCache.maxEntries,
    trackedIpCount: shieldState.ipTracker.size,
    trackedSessionCount: shieldState.txTracker.size,
    activeCooldownIps,
    topThreatIps: topThreats.slice(0, 10)
  };
}

/**
 * Resets all in-memory caches, token buckets, velocity windows, and counters for deterministic testing.
 */
export function resetTrafficShieldForTests() {
  shieldState.shadowCache.clear();
  shieldState.shadowCache.maxEntries = DEFAULT_CACHE_MAX_ENTRIES;
  shieldState.ipTracker.clear();
  shieldState.txTracker.clear();
  shieldState.usedChallengeNonces.clear();
  shieldState.stats = createInitialStats();
}
