import { randomBytes } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';
import { getRustIdentityHeader } from './rustIdentity.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { getPgPool, queryPg } from '../db/postgres.js';

const REQUEST_TIMEOUT_MS = 2500;

const RESERVED_FREE_SUBDOMAINS = new Set([
  'www',
  'auth',
  'api',
  'mail',
  'tmail',
  'tpanel',
  'dns1',
  'dns2',
  'drive',
  'pick',
  'admin',
  'administrator',
  'workspace',
  'dashboard',
  'oneprofile',
  'one-profile',
  'support',
  'billing',
  'security',
  'status',
  'root',
  'localhost',
  'tiwlo',
  'uids',
  'uidis',
  'ns1',
  'ns2',
  'smtp',
  'imap',
  'pop',
  'ftp',
  'cdn',
  'assets',
  'static',
  'store',
  'shop'
]);

function domainError(message, statusCode = 400, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function getDefaultNameservers() {
  return [
    `${PLATFORM_CONFIG.dns1Subdomain}.${PLATFORM_CONFIG.primaryDomain}`,
    `${PLATFORM_CONFIG.dns2Subdomain}.${PLATFORM_CONFIG.primaryDomain}`
  ];
}

function normalizeSubdomainLabel(rawInput) {
  const raw = String(rawInput ?? '').trim().toLowerCase();
  const suffix = `.${PLATFORM_CONFIG.freeSubdomainDomain}`;
  const label = raw.endsWith(suffix) ? raw.slice(0, -suffix.length) : raw;
  if (!label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
    throw domainError('Use 1-63 lowercase letters, numbers, or internal hyphens (cannot start or end with a hyphen).', 400);
  }
  return label;
}

function normalizeDnsRecordPayload(body = {}, domain = '') {
  const type = String(body.type || '').trim().toUpperCase();
  if (!['A', 'AAAA', 'CNAME', 'TXT', 'NS'].includes(type)) {
    throw domainError('DNS record type must be A, AAAA, CNAME, TXT, or NS.', 400);
  }
  let name = String(body.name || '@').trim().toLowerCase().replace(/\.$/, '');
  if (!name) name = '@';
  if (domain && name === domain.toLowerCase()) {
    name = '@';
  } else if (domain && name.endsWith(`.${domain.toLowerCase()}`)) {
    name = name.slice(0, -(domain.length + 1)) || '@';
  }
  if (name !== '@' && name !== '*' && !/^(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)(?:\.(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?))*$/.test(name)) {
    throw domainError('Enter a valid DNS record host name (such as @, www, or api).', 400);
  }

  const value = String(body.value || '').trim();
  if (!value || value.length > 1024) {
    throw domainError('Enter a valid DNS record value.', 400);
  }
  if (type === 'A' && !isIPv4(value)) {
    throw domainError('An A record requires a valid IPv4 address (e.g., 203.0.113.10).', 400);
  }
  if (type === 'AAAA' && !isIPv6(value)) {
    throw domainError('An AAAA record requires a valid IPv6 address.', 400);
  }
  if ((type === 'CNAME' || type === 'NS') && !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}\.?$/.test(value)) {
    throw domainError(`A ${type} record requires a valid target hostname (e.g., target.example.com).`, 400);
  }

  const parsedTtl = Number.parseInt(String(body.ttl ?? '300'), 10);
  const ttl = Number.isFinite(parsedTtl) ? Math.min(86400, Math.max(60, parsedTtl)) : 300;
  return {
    type,
    name,
    value: type === 'CNAME' || type === 'NS' ? value.toLowerCase().replace(/\.$/, '') : value,
    ttl
  };
}

function getRustBackendUrl() {
  return String(process.env.TIWLO_RUST_BACKEND_URL || '').trim().replace(/\/+$/, '');
}

async function requestRust({ path, method = 'GET', user, request, body }) {
  const baseUrl = getRustBackendUrl();
  if (!baseUrl) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(user ? getRustIdentityHeader(user, request) : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    let payload = null;
    if (response.status !== 204) {
      const responseText = await response.text();
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch (cause) {
          const error = new Error('Rust domain service returned an invalid response.', { cause });
          error.statusCode = response.ok ? 502 : response.status;
          throw error;
        }
      }
    }
    if (!response.ok) {
      const error = new Error(payload?.error || 'Rust domain operation failed.');
      error.statusCode = response.status;
      error.details = payload || {};
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      throw error;
    }
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkSubdomainWithRust(name) {
  const rustResult = await requestRust({ path: `/v1/domains/check?name=${encodeURIComponent(String(name ?? ''))}` });
  if (rustResult !== undefined) return rustResult;

  const label = normalizeSubdomainLabel(name);
  const fullDomain = `${label}.${PLATFORM_CONFIG.freeSubdomainDomain}`;
  if (RESERVED_FREE_SUBDOMAINS.has(label)) {
    return {
      name: label,
      domain: fullDomain,
      available: false,
      status: 'reserved'
    };
  }
  const { rows } = await queryPg(
    `SELECT status FROM system_free_subdomains WHERE subdomain = $1 LIMIT 1`,
    [label]
  );
  if (rows[0]) {
    return {
      name: label,
      domain: fullDomain,
      available: false,
      status: rows[0].status === 'active' ? 'taken' : rows[0].status
    };
  }
  return {
    name: label,
    domain: fullDomain,
    available: true,
    status: 'available'
  };
}

export async function claimDomainWithRust({ user, name, request }) {
  const rustResult = await requestRust({
    path: '/v1/domains/claim',
    method: 'POST',
    user,
    request,
    body: { name }
  });
  if (rustResult !== undefined) {
    return { ...rustResult, status: 'active' };
  }

  if (!user?.id) {
    throw domainError('Authentication required.', 401);
  }

  const label = normalizeSubdomainLabel(name);
  const fullDomain = `${label}.${PLATFORM_CONFIG.freeSubdomainDomain}`;
  if (RESERVED_FREE_SUBDOMAINS.has(label)) {
    throw domainError(`${fullDomain} is reserved for platform services.`, 409, { code: 'SUBDOMAIN_RESERVED' });
  }

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingUserSubdomain = await client.query(
      `SELECT id, subdomain, domain, status, created_at
       FROM system_free_subdomains
       WHERE user_id = $1
       LIMIT 1`,
      [user.id]
    );
    if (existingUserSubdomain.rows[0]) {
      const existing = existingUserSubdomain.rows[0];
      if (existing.subdomain === label) {
        await client.query('COMMIT');
        return {
          id: existing.id,
          name: existing.subdomain,
          subdomain: existing.subdomain,
          domain: existing.domain,
          status: existing.status,
          nameservers: getDefaultNameservers(),
          createdAt: existing.created_at
        };
      }
      await client.query('ROLLBACK');
      throw domainError(
        `Your account has already claimed ${existing.domain}. Each account includes one free .${PLATFORM_CONFIG.freeSubdomainDomain} subdomain.`,
        409,
        { code: 'FREE_DOMAIN_LIMIT_REACHED', existingDomain: existing.domain }
      );
    }

    const existingTaken = await client.query(
      `SELECT id FROM system_free_subdomains WHERE subdomain = $1 LIMIT 1`,
      [label]
    );
    if (existingTaken.rows[0]) {
      await client.query('ROLLBACK');
      throw domainError(`${fullDomain} is already registered. Choose another name.`, 409, {
        code: 'SUBDOMAIN_TAKEN'
      });
    }

    const id = `sub_${randomBytes(12).toString('hex')}`;
    const inserted = await client.query(
      `INSERT INTO system_free_subdomains (id, subdomain, domain, user_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, subdomain, domain, status, created_at`,
      [id, label, fullDomain, user.id]
    );

    if (PLATFORM_CONFIG.serverIpv4 && isIPv4(PLATFORM_CONFIG.serverIpv4)) {
      const recId = `rec_${randomBytes(10).toString('hex')}`;
      await client.query(
        `INSERT INTO system_free_subdomain_records (id, subdomain_id, type, name, value, ttl)
         VALUES ($1, $2, 'A', '@', $3, 300)
         ON CONFLICT (subdomain_id, type, name, value) DO NOTHING`,
        [recId, id, PLATFORM_CONFIG.serverIpv4]
      );
    }
    if (PLATFORM_CONFIG.serverIpv6 && isIPv6(PLATFORM_CONFIG.serverIpv6)) {
      const recId6 = `rec_${randomBytes(10).toString('hex')}`;
      await client.query(
        `INSERT INTO system_free_subdomain_records (id, subdomain_id, type, name, value, ttl)
         VALUES ($1, $2, 'AAAA', '@', $3, 300)
         ON CONFLICT (subdomain_id, type, name, value) DO NOTHING`,
        [recId6, id, PLATFORM_CONFIG.serverIpv6]
      );
    }

    await client.query(
      `UPDATE system_users
       SET free_subdomain_claimed_at = COALESCE(free_subdomain_claimed_at, CURRENT_TIMESTAMP),
           free_subdomain_id = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id, id]
    );

    await client.query(
      `INSERT INTO system_oneprofile_websites (user_id, domain, title, template_id, status)
       VALUES ($1, $2, $3, 'minimal-google', 'active')
       ON CONFLICT (user_id, domain) DO NOTHING`,
      [user.id, fullDomain, `${user.name || user.storeName || label} — OneProfile`]
    );

    await client.query('COMMIT');
    const row = inserted.rows[0];
    return {
      id: row.id,
      name: row.subdomain,
      subdomain: row.subdomain,
      domain: row.domain,
      status: row.status,
      nameservers: getDefaultNameservers(),
      createdAt: row.created_at
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
      throw domainError(`${fullDomain} could not be claimed because the subdomain or account limit is already in use.`, 409);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function listUserDomainsWithRust({ user, request }) {
  const rustResult = await requestRust({ path: '/v1/domains', user, request });
  if (rustResult !== undefined) return rustResult;

  if (!user?.id) throw domainError('Authentication required.', 401);
  const { rows } = await queryPg(
    `SELECT id, subdomain, domain, status, created_at, updated_at
     FROM system_free_subdomains
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.id]
  );
  const nameservers = getDefaultNameservers();
  return {
    domains: rows.map(row => ({
      id: row.id,
      name: row.subdomain,
      subdomain: row.subdomain,
      domain: row.domain,
      status: row.status,
      nameservers,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
}

function dnsPath(subdomainId, recordId) {
  const path = `/v1/domains/${encodeURIComponent(subdomainId)}/records`;
  return recordId ? `${path}/${encodeURIComponent(recordId)}` : path;
}

async function requireOwnedSubdomain(userId, subdomainId) {
  const { rows } = await queryPg(
    `SELECT id, subdomain, domain, status
     FROM system_free_subdomains
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [String(subdomainId || ''), String(userId || '')]
  );
  if (!rows[0]) {
    throw domainError('Subdomain not found for this account.', 404);
  }
  return rows[0];
}

export async function listDnsRecordsWithRust({ user, subdomainId, request }) {
  const rustResult = await requestRust({ path: dnsPath(subdomainId), user, request });
  if (rustResult !== undefined) return rustResult;

  const owned = await requireOwnedSubdomain(user?.id, subdomainId);
  const { rows } = await queryPg(
    `SELECT id, type, name, value, ttl, created_at
     FROM system_free_subdomain_records
     WHERE subdomain_id = $1
     ORDER BY CASE WHEN name = '@' THEN 0 ELSE 1 END, type ASC, name ASC, created_at ASC`,
    [owned.id]
  );
  return {
    domain: owned.domain,
    records: rows.map(row => ({
      id: row.id,
      type: row.type,
      name: row.name,
      value: row.value,
      ttl: row.ttl,
      createdAt: row.created_at
    }))
  };
}

export async function createDnsRecordWithRust({ user, subdomainId, request, body }) {
  const rustResult = await requestRust({ path: dnsPath(subdomainId), method: 'POST', user, request, body });
  if (rustResult !== undefined) return rustResult;

  const owned = await requireOwnedSubdomain(user?.id, subdomainId);
  const normalized = normalizeDnsRecordPayload(body, owned.domain);
  const id = `rec_${randomBytes(12).toString('hex')}`;
  try {
    const { rows } = await queryPg(
      `INSERT INTO system_free_subdomain_records (id, subdomain_id, type, name, value, ttl)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, name, value, ttl, created_at`,
      [id, owned.id, normalized.type, normalized.name, normalized.value, normalized.ttl]
    );
    return {
      record: {
        id: rows[0].id,
        type: rows[0].type,
        name: rows[0].name,
        value: rows[0].value,
        ttl: rows[0].ttl,
        createdAt: rows[0].created_at
      }
    };
  } catch (error) {
    if (error.code === '23505') {
      throw domainError('This DNS record already exists for your subdomain.', 409);
    }
    throw error;
  }
}

export async function updateDnsRecordWithRust({ user, subdomainId, recordId, request, body }) {
  const rustResult = await requestRust({
    path: dnsPath(subdomainId, recordId),
    method: 'PATCH',
    user,
    request,
    body
  });
  if (rustResult !== undefined) return rustResult;

  const owned = await requireOwnedSubdomain(user?.id, subdomainId);
  const normalized = normalizeDnsRecordPayload(body, owned.domain);
  try {
    const { rows } = await queryPg(
      `UPDATE system_free_subdomain_records
       SET type = $3, name = $4, value = $5, ttl = $6
       WHERE id = $1 AND subdomain_id = $2
       RETURNING id, type, name, value, ttl, created_at`,
      [String(recordId || ''), owned.id, normalized.type, normalized.name, normalized.value, normalized.ttl]
    );
    if (!rows[0]) {
      throw domainError('DNS record not found.', 404);
    }
    return {
      record: {
        id: rows[0].id,
        type: rows[0].type,
        name: rows[0].name,
        value: rows[0].value,
        ttl: rows[0].ttl,
        createdAt: rows[0].created_at
      }
    };
  } catch (error) {
    if (error.code === '23505') {
      throw domainError('Another DNS record with the same type, name, and value already exists.', 409);
    }
    throw error;
  }
}

export async function deleteDnsRecordWithRust({ user, subdomainId, recordId, request }) {
  const rustResult = await requestRust({
    path: dnsPath(subdomainId, recordId),
    method: 'DELETE',
    user,
    request
  });
  if (rustResult !== undefined) return rustResult;

  const owned = await requireOwnedSubdomain(user?.id, subdomainId);
  const { rowCount } = await queryPg(
    `DELETE FROM system_free_subdomain_records
     WHERE id = $1 AND subdomain_id = $2`,
    [String(recordId || ''), owned.id]
  );
  if (!rowCount) {
    throw domainError('DNS record not found.', 404);
  }
  return null;
}
