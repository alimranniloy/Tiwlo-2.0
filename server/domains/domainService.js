import { randomBytes } from 'crypto';
import { domainToASCII } from 'url';
import { promises as dns } from 'dns';
import { isPgActive, queryPg } from '../db/postgres.js';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { getEcommercePackageById } from '../db/packages.js';
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

function requireServerAddress(addresses = PLATFORM_CONFIG.serverAddresses) {
  if (!addresses.length) {
    throw new DomainServiceError('Configure VITE_SERVER_IPV4, VITE_SERVER_IPV6, or both before provisioning domains.', 503);
  }
}

export async function getLivePlatformDnsConfig() {
  const primaryDomain = PLATFORM_CONFIG.primaryDomain;
  const storeDomain = PLATFORM_CONFIG.storeDomain;
  const defaultNameservers = [
    `${PLATFORM_CONFIG.dns1Subdomain}.${primaryDomain}`,
    `${PLATFORM_CONFIG.dns2Subdomain}.${primaryDomain}`
  ];
  const defaultAddresses = PLATFORM_CONFIG.serverAddresses.map(({ type, value }) => ({
    type,
    value,
    ttl: PLATFORM_CONFIG.dnsTtl
  }));

  let rows = [];
  if (isPgActive()) {
    try {
      const result = await queryPg(
        `SELECT name, type, content, ttl, priority, system_key
         FROM system_platform_dns_records
         WHERE zone = $1 AND enabled = TRUE
         ORDER BY name, type, priority NULLS FIRST, content`,
        [primaryDomain]
      );
      rows = result.rows || [];
    } catch (error) {
      console.warn('[DomainService] Could not query system_platform_dns_records, falling back to PLATFORM_CONFIG:', error.message);
    }
  }

  const apexAddressRows = rows.filter(
    row => (row.name === '@' || row.system_key === 'apex:a' || row.system_key === 'apex:aaaa') &&
      ['A', 'AAAA'].includes(String(row.type || '').toUpperCase()) &&
      String(row.content || '').trim()
  );
  const serverAddresses = apexAddressRows.length > 0
    ? apexAddressRows.map(row => ({
      type: String(row.type).toUpperCase(),
      value: String(row.content).trim(),
      ttl: Number(row.ttl) || PLATFORM_CONFIG.dnsTtl
    }))
    : defaultAddresses;

  const nsRows = rows.filter(
    row => (row.name === '@' || row.system_key === 'ns:primary' || row.system_key === 'ns:secondary') &&
      String(row.type || '').toUpperCase() === 'NS' &&
      String(row.content || '').trim()
  );
  const sortedNsRows = [...nsRows].sort((a, b) => {
    const rank = key => (key === 'ns:primary' ? 0 : key === 'ns:secondary' ? 1 : 2);
    return rank(a.system_key) - rank(b.system_key);
  });
  const liveNameservers = [...new Set(
    sortedNsRows.map(row => String(row.content).trim().toLowerCase().replace(/\.$/, ''))
  )].filter(Boolean);
  const nameservers = liveNameservers.length > 0 ? liveNameservers : defaultNameservers;

  const primaryNsHost = nameservers[0] || defaultNameservers[0];
  const secondaryNsHost = nameservers[1] || defaultNameservers[1] || primaryNsHost;
  const toSubdomainLabel = (fqdn, fallback) => {
    const suffix = `.${primaryDomain}`;
    return fqdn && fqdn.endsWith(suffix) ? fqdn.slice(0, -suffix.length) : fallback;
  };

  const ipv4Record = serverAddresses.find(addr => addr.type === 'A');
  const ipv6Record = serverAddresses.find(addr => addr.type === 'AAAA');
  const dnsTtl = Number(apexAddressRows[0]?.ttl || nsRows[0]?.ttl || PLATFORM_CONFIG.dnsTtl) || PLATFORM_CONFIG.dnsTtl;

  return {
    primaryDomain,
    storeDomain,
    freeSubdomainDomain: PLATFORM_CONFIG.freeSubdomainDomain,
    dnsTtl,
    dns1Subdomain: toSubdomainLabel(primaryNsHost, PLATFORM_CONFIG.dns1Subdomain),
    dns2Subdomain: toSubdomainLabel(secondaryNsHost, PLATFORM_CONFIG.dns2Subdomain),
    nameservers,
    serverAddresses,
    ipv4: ipv4Record?.value || PLATFORM_CONFIG.serverIpv4 || '',
    ipv6: ipv6Record?.value || PLATFORM_CONFIG.serverIpv6 || '',
    verificationPrefix: VERIFICATION_PREFIX,
    records: rows.map(row => ({
      name: row.name,
      type: row.type,
      content: row.content,
      ttl: Number(row.ttl) || PLATFORM_CONFIG.dnsTtl,
      priority: row.priority ?? null,
      systemKey: row.system_key || null
    })),
    source: rows.length > 0 ? 'database' : 'platform_config',
    syncedAt: new Date().toISOString()
  };
}

export function normalizeCustomDomain(input) {
  if (typeof input !== 'string' || input.trim() !== input || /[/:?#@\s]/.test(input)) {
    throw new DomainServiceError('Enter a domain name only, without a URL, path, or port.');
  }

  const domain = domainToASCII(input.toLowerCase().replace(/\.$/, ''));
  if (!domain || !DOMAIN_PATTERN.test(domain)) {
    throw new DomainServiceError('Enter a valid public DNS domain name.');
  }

  // Product-owned hosts (including UIDS) are provisioned by the platform.
  // Letting a customer attach one of these would allow them to claim a host
  // that is already used for login, dashboard, or free subdomains.
  const reservedDomains = PLATFORM_CONFIG.managedDomains;
  if (reservedDomains.some(base => domain === base || domain.endsWith(`.${base}`))) {
    throw new DomainServiceError('Tiwlo platform domains are managed automatically and cannot be added as custom domains.');
  }

  return domain;
}

function serializeDomain(row, liveConfig = null) {
  const serverAddresses = liveConfig?.serverAddresses?.length
    ? liveConfig.serverAddresses
    : PLATFORM_CONFIG.serverAddresses;
  const nameservers = liveConfig?.nameservers?.length
    ? liveConfig.nameservers
    : [
      `${PLATFORM_CONFIG.dns1Subdomain}.${PLATFORM_CONFIG.primaryDomain}`,
      `${PLATFORM_CONFIG.dns2Subdomain}.${PLATFORM_CONFIG.primaryDomain}`
    ];
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
        type: serverAddresses[0]?.type || 'A',
        name: row.domain,
        value: serverAddresses[0]?.value || '',
        records: serverAddresses.map(({ type, value }) => ({
          type,
          name: row.domain,
          value
        })),
        nameservers
      }
    }
  };
}

export async function listUserDomains(userId) {
  requireDatabase();
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `SELECT id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at
       FROM system_custom_domains WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    ),
    getLivePlatformDnsConfig()
  ]);
  return rows.map(row => serializeDomain(row, liveConfig));
}

export async function createUserDomain({ userId, tiwiId, domain: input }) {
  requireDatabase();
  const liveConfig = await getLivePlatformDnsConfig();
  requireServerAddress(liveConfig.serverAddresses);
  const domain = normalizeCustomDomain(input);
  if (!userId || !tiwiId) throw new DomainServiceError('A store account is required to add a domain.', 403);

  const { rows: userRows } = await queryPg(
    'SELECT plan_id FROM system_users WHERE id = $1',
    [userId]
  );
  let hasCustomDomain = ['growth', 'pro', 'enterprise'].includes(userRows[0]?.plan_id);
  if (!hasCustomDomain) {
    const [tenantStore, userStores] = await Promise.all([
      TenantDB.getStoreDb(tiwiId).catch(() => null),
      MasterDB.getUserStores(userId).catch(() => [])
    ]);
    const matchedStore = (userStores || []).find(s => String(s.tiwiId) === String(tiwiId)) || null;
    if (matchedStore && ['suspended', 'inactive', 'deleted'].includes(String(matchedStore.status || '').toLowerCase())) {
      throw new DomainServiceError('Renew your suspended store before adding custom domains.', 403);
    }
    const tenantSub = tenantStore?.subscription || {};
    const effectivePlanId = String(
      tenantSub.planId || matchedStore?.planId || userRows[0]?.plan_id || 'free'
    ).trim().toLowerCase();
    const pkg = await getEcommercePackageById(effectivePlanId).catch(() => null);
    hasCustomDomain = tenantSub.hasCustomDomain !== undefined
      ? Boolean(tenantSub.hasCustomDomain)
      : Boolean(pkg?.hasCustomDomain ?? ['growth', 'pro', 'enterprise'].includes(effectivePlanId));
  }
  if (!hasCustomDomain) {
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
    return serializeDomain(rows[0], liveConfig);
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
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `SELECT id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at
       FROM system_custom_domains WHERE id = $1 AND user_id = $2`,
      [id, userId]
    ),
    getLivePlatformDnsConfig()
  ]);
  const row = rows[0];
  if (!row) throw new DomainServiceError('Domain was not found for this account.', 404);
  if (row.status === 'verified' || row.status === 'active') return serializeDomain(row, liveConfig);

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
  return serializeDomain(updated.rows[0], liveConfig);
}

export async function getUserDomain({ userId, id }) {
  requireDatabase();
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `SELECT id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at
       FROM system_custom_domains WHERE id = $1 AND user_id = $2`,
      [id, userId]
    ),
    getLivePlatformDnsConfig()
  ]);
  if (!rows[0]) throw new DomainServiceError('Domain was not found for this account.', 404);
  return serializeDomain(rows[0], liveConfig);
}

export async function markDomainSslStatus({ id, userId, status, sslStatus, error = null }) {
  requireDatabase();
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `UPDATE system_custom_domains SET status = $3, ssl_status = $4, ssl_error = $5,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND ssl_status = 'provisioning'
       RETURNING id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at`,
      [id, userId, status, sslStatus, error]
    ),
    getLivePlatformDnsConfig()
  ]);
  if (!rows[0]) throw new DomainServiceError('Domain was not found for this account.', 404);
  return serializeDomain(rows[0], liveConfig);
}

export async function beginDomainSslProvisioning({ id, userId }) {
  requireDatabase();
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `UPDATE system_custom_domains
       SET ssl_status = 'provisioning', ssl_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND status = 'verified'
         AND ssl_status IN ('pending', 'failed')
       RETURNING id, domain, verification_token, status, ssl_status, ssl_error, verified_at, created_at, updated_at`,
      [id, userId]
    ),
    getLivePlatformDnsConfig()
  ]);
  if (!rows[0]) {
    throw new DomainServiceError('Domain is not ready for SSL provisioning or a request is already in progress.', 409);
  }
  return serializeDomain(rows[0], liveConfig);
}

export async function resolveActiveCustomDomain(domain) {
  if (!isPgActive()) return null;
  const normalized = domainToASCII(String(domain || '').trim().toLowerCase().replace(/\.$/, ''));
  if (!normalized) return null;
  const candidates = normalized.split('.').map((_label, index, labels) => labels.slice(index).join('.'));
  const { rows } = await queryPg(
    `SELECT domain, tiwi_id FROM system_custom_domains
     WHERE domain = ANY($1::text[]) AND status = 'active' AND ssl_status = 'active'
     ORDER BY LENGTH(domain) DESC LIMIT 1`,
    [candidates]
  );
  return rows[0] ? { domain: rows[0].domain, tiwiId: rows[0].tiwi_id } : null;
}

export async function findActiveCustomDomain(domain) {
  return Boolean(await resolveActiveCustomDomain(domain));
}

export async function findProvisionableCustomDomain(domain) {
  if (!isPgActive()) return false;
  const normalized = domainToASCII(String(domain || '').trim().toLowerCase().replace(/\.$/, ''));
  if (!normalized) return false;
  const candidates = normalized.split('.').map((_label, index, labels) => labels.slice(index).join('.'));
  const { rows } = await queryPg(
    `SELECT domain FROM system_custom_domains
     WHERE domain = ANY($1::text[])
       AND (
         (status = 'active' AND ssl_status = 'active')
         OR (status = 'verified' AND ssl_status IN ('pending', 'provisioning'))
       )
     LIMIT 1`,
    [candidates]
  );
  return rows.length > 0;
}

export async function findActiveFreeSubdomain(domain) {
  if (!isPgActive()) return false;
  const normalized = domainToASCII(String(domain || '').trim().toLowerCase().replace(/\.$/, ''));
  if (!normalized) return false;
  const { rows } = await queryPg(
    `SELECT id FROM system_free_subdomains
     WHERE domain = $1 AND status = 'active' LIMIT 1`,
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
  const liveConfig = await getLivePlatformDnsConfig();
  const expectedAddresses = liveConfig.serverAddresses;
  requireServerAddress(expectedAddresses);
  const resolve = async (method) => {
    try {
      return await dns[method](domain);
    } catch (error) {
      if (['ENODATA', 'ENOTFOUND', 'ENODOMAIN', 'ESERVFAIL', 'ETIMEOUT'].includes(error.code)) return [];
      throw error;
    }
  };
  const [ipv4, ipv6] = await Promise.all([resolve('resolve4'), resolve('resolve6')]);
  const addresses = { A: ipv4, AAAA: ipv6 };
  return {
    ready: expectedAddresses.some(({ type, value }) => addresses[type]?.includes(value)),
    addresses: [...ipv4, ...ipv6],
    ipv4Addresses: ipv4,
    ipv6Addresses: ipv6,
    expectedAddresses,
    expectedAddress: expectedAddresses[0]?.value || ''
  };
}


export async function verifyDomainNameservers(domain) {
  const liveConfig = await getLivePlatformDnsConfig();
  requireServerAddress(liveConfig.serverAddresses);
  const expected = (liveConfig.nameservers || []).map(value => String(value).toLowerCase());
  let nameservers = [];
  try {
    nameservers = (await dns.resolveNs(domain)).map(value => value.toLowerCase().replace(/\.$/, ''));
  } catch (error) {
    if (!['ENODATA', 'ENOTFOUND', 'ENODOMAIN', 'ESERVFAIL', 'ETIMEOUT'].includes(error.code)) throw error;
  }
  return { ready: expected.every(value => nameservers.includes(value)), nameservers, expectedNameservers: expected };
}
