import { createHmac, randomBytes } from 'crypto';
import { getPgPool, isPgActive, queryPg } from '../db/postgres.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { DomainServiceError } from './domainService.js';

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED_NAMES = new Set([
  'www', 'api', 'auth', 'admin', 'app', 'blog', 'cdn', 'dashboard', 'dns1',
  'dns2', 'docs', 'drive', 'mail', 'mta', 'ns1', 'ns2', 'support', 'tpanel'
]);

function requireDatabase() {
  if (!isPgActive()) {
    throw new DomainServiceError('PostgreSQL is unavailable; subdomain availability requires the database.', 503);
  }
}

function maskEmail(email) {
    const [localPart, domain] = String(email || '').split('@');
    if (!localPart || !domain) return 'your verified email';
    if (localPart.length <= 2) return `${localPart[0]}***@${domain}`;
    return `${localPart[0]}${'*'.repeat(Math.max(3, localPart.length - 2))}${localPart.at(-1)}@${domain}`;
  }

function hashAbuseSignal(value) {
    const secret = process.env.ABUSE_HASH_SECRET ||
      process.env.SECURITY_SECRET ||
      PLATFORM_CONFIG.primaryDomain;
    return createHmac('sha256', secret).update(String(value || 'unknown')).digest('hex');
  }

function getRequestSignals(request) {
    const ip = request?.ip || request?.socket?.remoteAddress || 'unknown';
    const deviceToken = request?.cookies?.uids_device || '';
    const email = request?.activeUser?.email || '';
    return {
      ipHash: hashAbuseSignal(ip),
      deviceHash: deviceToken ? hashAbuseSignal(deviceToken) : null,
      emailHash: hashAbuseSignal(email)
    };
  }

async function recordClaimAttempt(client, { userId, subdomain, signals, outcome, reason }) {
    await client.query(
      `INSERT INTO system_free_subdomain_claim_attempts
        (user_id, subdomain, ip_hash, device_hash, email_hash, outcome, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId || null, subdomain, signals.ipHash, signals.deviceHash, signals.emailHash, outcome, reason || null]
    );
}

export function normalizeSubdomain(input) {
  if (typeof input !== 'string') {
    throw new DomainServiceError('Enter a subdomain name.');
  }
  const name = input.trim().toLowerCase();
  if (!SUBDOMAIN_PATTERN.test(name)) {
    throw new DomainServiceError('Use 1-63 lowercase letters, numbers, or hyphens; do not start or end with a hyphen.');
  }
  return name;
}

function getDomain(name) {
  return `${name}.${PLATFORM_CONFIG.freeSubdomainDomain}`;
}

function candidateNames(name) {
  const candidates = [
    `${name}-app`, `${name}-dev`, `${name}-site`, `${name}-hub`,
    `get-${name}`, `try-${name}`, `use-${name}`, `${name}hq`
  ];
  return [...new Set(candidates)]
    .filter(candidate => candidate.length <= 63 && SUBDOMAIN_PATTERN.test(candidate))
    .filter(candidate => !RESERVED_NAMES.has(candidate));
}

async function readStatus(names) {
  if (!names.length) return new Map();
  const { rows } = await queryPg(
    `SELECT subdomain, status
     FROM system_free_subdomains
     WHERE subdomain = ANY($1::text[])
       AND status IN ('active', 'suspended')`,
    [names]
  );
  return new Map(rows.map(row => [row.subdomain, row.status]));
}

export async function checkSubdomain(input) {
  requireDatabase();
  const name = normalizeSubdomain(input);
  const exactStatus = RESERVED_NAMES.has(name)
    ? 'reserved'
    : (await readStatus([name])).get(name) || null;
  const suggestionNames = candidateNames(name);
  const suggestionStatuses = await readStatus(suggestionNames);
  const availableSuggestions = suggestionNames
    .filter(suggestion => !suggestionStatuses.has(suggestion));

  return {
    name,
    domain: getDomain(name),
    available: !exactStatus && !RESERVED_NAMES.has(name),
    status: exactStatus || 'available',
    suggestions: availableSuggestions.slice(0, 5).map(suggestion => ({
      name: suggestion,
      domain: getDomain(suggestion)
    }))
  };
}

export async function claimSubdomain({ userId, input, request }) {
  requireDatabase();
  if (!userId) throw new DomainServiceError('Authentication required.', 401);
  const name = normalizeSubdomain(input);
  if (RESERVED_NAMES.has(name)) {
    throw new DomainServiceError('This subdomain is reserved by the platform.', 409);
  }

  const pool = getPgPool();
  const signals = getRequestSignals(request);
  const client = await pool.connect();
  let account;
  try {
    await client.query('BEGIN');
    const { rows: accounts } = await client.query(
      `SELECT id, email, email_verified, free_subdomain_claimed_at
       FROM system_users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    account = accounts[0];
    if (!account) throw new DomainServiceError('Your account could not be verified.', 401);
    if (!account.email_verified) {
      throw new DomainServiceError('Verify your email before claiming a free domain.', 403, {
        code: 'EMAIL_VERIFICATION_REQUIRED',
        maskedEmail: maskEmail(account.email)
      });
    }
    if (account.free_subdomain_claimed_at) {
      throw new DomainServiceError('This account has already used its one free domain allowance.', 409, {
        code: 'FREE_DOMAIN_ALREADY_USED',
        maskedEmail: maskEmail(account.email)
      });
    }

    const { rows: recentAttempts } = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM system_free_subdomain_claim_attempts
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
         AND (ip_hash = $1 OR device_hash = $2 OR email_hash = $3)
         AND outcome IN ('success', 'blocked')`,
      [signals.ipHash, signals.deviceHash, signals.emailHash]
    );
    if (recentAttempts[0].count >= 3) {
      await recordClaimAttempt(client, {
        userId, subdomain: name, signals, outcome: 'blocked', reason: 'risk_limit'
      });
      throw new DomainServiceError('Too many free-domain attempts from this account or device. Try again later.', 429, {
        code: 'FREE_DOMAIN_RATE_LIMITED',
        maskedEmail: maskEmail(account.email),
        retryAfterMinutes: 60
      });
    }

    const id = `sub_${randomBytes(12).toString('hex')}`;
    const { rows } = await client.query(
      `INSERT INTO system_free_subdomains (id, subdomain, domain, user_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, subdomain, domain, status, created_at`,
      [id, name, getDomain(name), userId]
    );
    await client.query(
      `UPDATE system_users
       SET free_subdomain_claimed_at = CURRENT_TIMESTAMP, free_subdomain_id = $1
       WHERE id = $2`,
      [id, userId]
    );
    await recordClaimAttempt(client, {
      userId, subdomain: name, signals, outcome: 'success', reason: 'registered'
    });
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof DomainServiceError) throw error;
    if (error.code === '23505') {
      throw new DomainServiceError('This subdomain is already registered.', 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listUserSubdomains(userId) {
  requireDatabase();
  const { rows } = await queryPg(
    `SELECT id, subdomain, domain, status, created_at, updated_at
     FROM system_free_subdomains
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(row => ({
    ...row,
    nameservers: [
      `dns1.${PLATFORM_CONFIG.primaryDomain}`,
      `dns2.${PLATFORM_CONFIG.primaryDomain}`
    ]
  }));
}

export async function listSubdomainRecords({ userId, subdomainId }) {
  requireDatabase();
  const { rows } = await queryPg(
    `SELECT r.id, r.type, r.name, r.value, r.ttl
     FROM system_free_subdomain_records r
     JOIN system_free_subdomains d ON d.id = r.subdomain_id
     WHERE d.id = $1 AND d.user_id = $2
     ORDER BY r.created_at ASC`,
    [subdomainId, userId]
  );
  return rows;
}

export async function createSubdomainRecord({ userId, subdomainId, type, name, value, ttl = 300 }) {
  requireDatabase();
  const normalizedType = String(type || '').toUpperCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedValue = String(value || '').trim().replace(/\.$/, '');
  if (!['A', 'CNAME', 'TXT', 'NS'].includes(normalizedType) || !normalizedName || !normalizedValue) {
    throw new DomainServiceError('Record type, name, and value are required.');
  }
  if (normalizedType === 'NS' && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(normalizedValue)) {
    throw new DomainServiceError('Nameserver must be a valid hostname.');
  }
  const { rows } = await queryPg(
    `INSERT INTO system_free_subdomain_records
      (id, subdomain_id, type, name, value, ttl)
     SELECT $1, id, $3, $4, $5, $6
     FROM system_free_subdomains
     WHERE id = $2 AND user_id = $7 AND status = 'active'
     RETURNING id, type, name, value, ttl`,
    [`rec_${randomBytes(12).toString('hex')}`, subdomainId, normalizedType, normalizedName, normalizedValue, Math.max(60, Math.min(86400, Number(ttl) || 300)), userId]
  );
  if (!rows[0]) throw new DomainServiceError('Subdomain was not found for this account.', 404);
  return rows[0];
}

export async function updateSubdomainRecord({ userId, subdomainId, recordId, type, name, value, ttl = 300 }) {
  requireDatabase();
  const normalizedType = String(type || '').toUpperCase();
  const normalizedName = String(name || '').trim().toLowerCase();
  const normalizedValue = String(value || '').trim().replace(/\.$/, '');
  if (!['A', 'CNAME', 'TXT', 'NS'].includes(normalizedType) || !normalizedName || !normalizedValue) {
    throw new DomainServiceError('Record type, name, and value are required.');
  }
  if (normalizedType === 'NS' && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(normalizedValue)) {
    throw new DomainServiceError('Nameserver must be a valid hostname.');
  }
  const { rows } = await queryPg(
    `UPDATE system_free_subdomain_records
     SET type = $1, name = $2, value = $3, ttl = $4
     WHERE id = $5 AND subdomain_id = $6
       AND EXISTS (
         SELECT 1 FROM system_free_subdomains
         WHERE id = $6 AND user_id = $7 AND status = 'active'
       )
     RETURNING id, type, name, value, ttl`,
    [normalizedType, normalizedName, normalizedValue, Math.max(60, Math.min(86400, Number(ttl) || 300)), recordId, subdomainId, userId]
  );
  if (!rows[0]) throw new DomainServiceError('DNS record was not found for this account.', 404);
  return rows[0];
}

export async function deleteSubdomainRecord({ userId, subdomainId, recordId }) {
  requireDatabase();
  const { rowCount } = await queryPg(
    `DELETE FROM system_free_subdomain_records r
     USING system_free_subdomains d
     WHERE r.id = $1 AND r.subdomain_id = $2
       AND d.id = r.subdomain_id AND d.user_id = $3 AND d.status = 'active'`,
    [recordId, subdomainId, userId]
  );
  if (!rowCount) throw new DomainServiceError('DNS record was not found for this account.', 404);
}
