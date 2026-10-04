import { randomBytes } from 'crypto';
import { isIPv4 } from 'net';
import { domainToASCII } from 'url';
import { promises as dns } from 'dns';
import { isPgActive, queryPg } from '../db/postgres.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const VERIFICATION_PREFIX = 'tiwlo-domain-verification=';
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export class DomainServiceError extends Error {
  constructor(message, statusCode = 400, details = {}) {
    super(message);
    this.name = 'DomainServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function requireDatabase() {
  if (!isPgActive()) {
    throw new DomainServiceError('PostgreSQL is unavailable; custom domains require the database.', 503);
  }
}

function requireServerAddress() {
  if (!isIPv4(PLATFORM_CONFIG.serverIpv4)) {
    throw new DomainServiceError('The platform server IPv4 address is not configured correctly.', 503);
  }
}

export function normalizeCustomDomain(input) {
  if (typeof input !== 'string' || input.trim() !== input || /[/:?#@\s]/.test(input)) {
    throw new DomainServiceError('Enter a domain name only, without a URL, path, or port.');
  }

  const domain = domainToASCII(input.toLowerCase().replace(/\.$/, ''));
  if (!domain || !DOMAIN_PATTERN.test(domain)) {
    throw new DomainServiceError('Enter a valid public DNS domain name.');
  }

  const reservedDomains = [PLATFORM_CONFIG.primaryDomain, PLATFORM_CONFIG.storeDomain];
  if (reservedDomains.some(base => domain === base || domain.endsWith(`.${base}`))) {
    throw new DomainServiceError('Tiwlo platform domains are managed automatically and cannot be added as custom domains.');
  }

  return domain;
}

function serializeDomain(row) {
  return {
    id: row.id,
    domain: row.domain,
    status: row.status,
    sslStatus: row.ssl_status,
    sslError: row.ssl_error || null,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dns: {
      verification: {
        type: 'TXT',
        name: `_tiwlo-verification.${row.domain}`,
        value: `${VERIFICATION_PREFIX}${row.verification_token}`
      },
      address: {
        type: 'A',
        name: row.domain,
        value: PLATFORM_CONFIG.serverIpv4
      }
    }
  };
}

export async function listUserDomains(userId) {
  requireDatabase();
  const { rows } = await queryPg(
    `SELECT id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at
     FROM system_custom_domains WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(serializeDomain);
}

export async function createUserDomain({ userId, tiwiId, domain: input }) {
  requireDatabase();
  requireServerAddress();
  const domain = normalizeCustomDomain(input);
  if (!userId || !tiwiId) throw new DomainServiceError('A store account is required to add a domain.', 403);

  const { rows: userRows } = await queryPg(
    'SELECT plan_id FROM system_users WHERE id = $1',
    [userId]
  );
  if (!['growth', 'pro', 'enterprise'].includes(userRows[0]?.plan_id)) {
    throw new DomainServiceError('Custom domains require a plan that includes custom-domain support.', 403);
  }
  const { rows: countRows } = await queryPg(
    'SELECT COUNT(*)::int AS count FROM system_custom_domains WHERE user_id = $1',
    [userId]
  );
  if (countRows[0].count >= 10) {
    throw new DomainServiceError('This account has reached the limit of 10 custom domains.', 409);
  }

  const token = randomBytes(24).toString('hex');
  const id = `dom_${randomBytes(12).toString('hex')}`;
  try {
    const { rows } = await queryPg(
      `INSERT INTO system_custom_domains (id, user_id, tiwi_id, domain, verification_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at`,
      [id, userId, tiwiId, domain, token]
    );
    return serializeDomain(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      throw new DomainServiceError('This domain is already registered.', 409);
    }
    throw error;
  }
}

async function resolveTxtRecords(host) {
  try {
    return (await dns.resolveTxt(host)).map(parts => parts.join(''));
  } catch (error) {
    if (['ENODATA', 'ENOTFOUND', 'ENODOMAIN', 'ESERVFAIL', 'ETIMEOUT'].includes(error.code)) return [];
    throw error;
  }
}

export async function verifyUserDomain({ userId, id }) {
  requireDatabase();
  const { rows } = await queryPg(
    `SELECT id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at
     FROM system_custom_domains WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = rows[0];
  if (!row) throw new DomainServiceError('Domain was not found for this account.', 404);
  if (row.status === 'verified' || row.status === 'active') return serializeDomain(row);

  const expected = `${VERIFICATION_PREFIX}${row.verification_token}`;
  const records = await resolveTxtRecords(`_tiwlo-verification.${row.domain}`);
  if (!records.includes(expected)) {
    throw new DomainServiceError('DNS ownership has not been verified yet.', 409, {
      verification: {
        type: 'TXT',
        name: `_tiwlo-verification.${row.domain}`,
        value: expected
      }
    });
  }

  const updated = await queryPg(
    `UPDATE system_custom_domains
     SET status = 'verified', ssl_status = 'pending', ssl_error = NULL,
         verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at`,
    [id, userId]
  );
  return serializeDomain(updated.rows[0]);
}

export async function getUserDomain({ userId, id }) {
  requireDatabase();
  const { rows } = await queryPg(
    `SELECT id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at
     FROM system_custom_domains WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (!rows[0]) throw new DomainServiceError('Domain was not found for this account.', 404);
  return serializeDomain(rows[0]);
}

export async function markDomainSslStatus({ id, userId, status, sslStatus, error = null }) {
  requireDatabase();
  const { rows } = await queryPg(
    `UPDATE system_custom_domains SET status = $3, ssl_status = $4, ssl_error = $5,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND ssl_status = 'provisioning'
     RETURNING id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at`,
    [id, userId, status, sslStatus, error]
  );
  if (!rows[0]) throw new DomainServiceError('Domain was not found for this account.', 404);
  return serializeDomain(rows[0]);
}

export async function beginDomainSslProvisioning({ id, userId }) {
  requireDatabase();
  const { rows } = await queryPg(
    `UPDATE system_custom_domains
     SET ssl_status = 'provisioning', ssl_error = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND status = 'verified'
       AND ssl_status IN ('pending', 'failed')
     RETURNING id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at`,
    [id, userId]
  );
  if (!rows[0]) {
    throw new DomainServiceError('Domain is not ready for SSL provisioning or a request is already in progress.', 409);
  }
  return serializeDomain(rows[0]);
}

export async function findActiveCustomDomain(domain) {
  if (!isPgActive()) return false;
  const normalized = String(domain || '').toLowerCase().replace(/\.$/, '');
  const { rows } = await queryPg(
    `SELECT 1 FROM system_custom_domains
     WHERE domain = $1 AND status = 'active' AND ssl_status = 'active' LIMIT 1`,
    [normalized]
  );
  return rows.length > 0;
}

export async function deletePendingUserDomain({ userId, id }) {
  requireDatabase();
  const { rowCount } = await queryPg(
    `DELETE FROM system_custom_domains
     WHERE id = $1 AND user_id = $2 AND ssl_status IN ('not_requested', 'pending', 'failed')`,
    [id, userId]
  );
  if (!rowCount) {
    throw new DomainServiceError('Only domains without an active certificate can be removed through this API.', 409);
  }
}

export async function verifyDomainAddress(domain) {
  requireServerAddress();
  let addresses = [];
  try {
    addresses = await dns.resolve4(domain);
  } catch (error) {
    if (!['ENODATA', 'ENOTFOUND', 'ENODOMAIN', 'ESERVFAIL', 'ETIMEOUT'].includes(error.code)) throw error;
  }
  return {
    ready: addresses.includes(PLATFORM_CONFIG.serverIpv4),
    addresses,
    expectedAddress: PLATFORM_CONFIG.serverIpv4
  };
}
