import crypto from 'node:crypto';
import { promises as dns } from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';
import { domainToASCII } from 'node:url';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { isPgActive, queryPg } from '../db/postgres.js';
import { getLivePlatformDnsConfig } from '../domains/domainService.js';
import { invalidateVpsWebProxyCache } from './vpsWebProxy.js';

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RECORD_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']);
const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'org.au',
  'com.bd', 'net.bd', 'org.bd', 'edu.bd', 'com.sg', 'com.my',
  'co.in', 'net.in', 'org.in', 'co.jp', 'com.br', 'com.tr'
]);

function domainError(message, statusCode = 400, details = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.details = details;
  return err;
}

export function normalizeCloudHostname(rawInput) {
  const trimmed = String(rawInput ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split(/[/?#]/, 1)[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  if (!trimmed || /[\s@\\]/.test(trimmed)) {
    throw domainError('Enter a valid domain name (for example, example.com or app.example.com).', 400);
  }
  const ascii = domainToASCII(trimmed);
  if (!ascii || !DOMAIN_PATTERN.test(ascii)) {
    throw domainError('Enter a valid public domain name.', 400);
  }
  return ascii;
}

export function extractRootDomain(hostname) {
  const clean = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  const parts = clean.split('.');
  if (parts.length <= 2) return clean;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

function isReservedPlatformDomain(hostname) {
  const bases = [
    ...PLATFORM_CONFIG.managedDomains,
    PLATFORM_CONFIG.primaryDomain,
    PLATFORM_CONFIG.storeDomain
  ].filter(Boolean);
  return bases.some((base) => hostname === base || hostname.endsWith(`.${base}`));
}

export async function ensureCloudDropletDomainSchema() {
  if (!isPgActive()) return;
  await queryPg(`
    CREATE TABLE IF NOT EXISTS cloud_droplet_domains (
      id VARCHAR(64) PRIMARY KEY,
      droplet_id VARCHAR(64) REFERENCES cloud_droplets(id) ON DELETE SET NULL,
      user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
      hostname VARCHAR(253) NOT NULL UNIQUE,
      root_domain VARCHAR(253) NOT NULL,
      record_type VARCHAR(16) NOT NULL DEFAULT 'A+AAAA',
      target_port INTEGER NOT NULL DEFAULT 80 CHECK (target_port BETWEEN 1 AND 65535),
      proxy_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      ttl INTEGER NOT NULL DEFAULT 300 CHECK (ttl BETWEEN 60 AND 86400),
      verification_token VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending_dns',
      ssl_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      auto_update_on_prefix_change BOOLEAN NOT NULL DEFAULT TRUE,
      verified_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE cloud_droplet_domains ALTER COLUMN droplet_id DROP NOT NULL;
    CREATE TABLE IF NOT EXISTS cloud_droplet_domain_records (
      id VARCHAR(64) PRIMARY KEY,
      domain_id VARCHAR(64) NOT NULL REFERENCES cloud_droplet_domains(id) ON DELETE CASCADE,
      type VARCHAR(8) NOT NULL CHECK (type IN ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS')),
      name VARCHAR(253) NOT NULL,
      value TEXT NOT NULL,
      ttl INTEGER NOT NULL DEFAULT 300 CHECK (ttl BETWEEN 60 AND 86400),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (domain_id, type, name, value)
    );
  `).catch(() => {});
}

async function resolveSafeDns(method, target) {
  try {
    return await dns[method](target);
  } catch (err) {
    if (['ENODATA', 'ENOTFOUND', 'ENODOMAIN', 'ESERVFAIL', 'ETIMEOUT', 'ECONNREFUSED'].includes(err?.code)) {
      return [];
    }
    return [];
  }
}

async function checkHttpTokenProbe(hostname, verificationToken) {
  if (!verificationToken || process.env.NODE_ENV === 'test') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`http://${hostname}/.well-known/tiwlo-vps-verify/${encodeURIComponent(verificationToken)}`, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal
    });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text === verificationToken;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyDomainRoutingState({
  hostname,
  rootDomain,
  verificationToken,
  ownedFreeSubdomain = false,
  liveConfig = null
}) {
  const cfg = liveConfig || (await getLivePlatformDnsConfig());
  const expectedNameservers = (cfg.nameservers || []).map((ns) => String(ns).toLowerCase().replace(/\.$/, ''));
  const expectedAddresses = (cfg.serverAddresses || []).map((a) => ({
    type: a.type,
    value: String(a.value || '').trim().toLowerCase()
  }));

  if (ownedFreeSubdomain) {
    return {
      verified: true,
      method: 'tiwlo_subdomain',
      nameservers: expectedNameservers,
      expectedNameservers,
      ipv4Addresses: [],
      ipv6Addresses: cfg.ipv6 ? [cfg.ipv6] : [],
      expectedAddresses: cfg.serverAddresses || []
    };
  }

  const root = rootDomain || extractRootDomain(hostname);
  const [nsHost, nsRoot, aRecords, aaaaRecords, txtHost, txtRoot, httpOk] = await Promise.all([
    resolveSafeDns('resolveNs', hostname),
    root !== hostname ? resolveSafeDns('resolveNs', root) : Promise.resolve([]),
    resolveSafeDns('resolve4', hostname),
    resolveSafeDns('resolve6', hostname),
    resolveSafeDns('resolveTxt', `_tiwlo-verification.${hostname}`),
    root !== hostname ? resolveSafeDns('resolveTxt', `_tiwlo-verification.${root}`) : Promise.resolve([]),
    checkHttpTokenProbe(hostname, verificationToken)
  ]);

  const observedNs = [...new Set([...nsHost, ...nsRoot].map((v) => String(v).toLowerCase().replace(/\.$/, '')))];
  const nsMatched = expectedNameservers.length > 0 && expectedNameservers.every((ns) => observedNs.includes(ns));

  const addrMatched = expectedAddresses.some(({ type, value }) => {
    if (!value) return false;
    if (type === 'A') return aRecords.some((ip) => ip.toLowerCase() === value);
    if (type === 'AAAA') return aaaaRecords.some((ip) => ip.toLowerCase() === value);
    return false;
  });

  const expectedTxt = `tiwlo-domain-verification=${verificationToken}`;
  const flatTxts = [...txtHost, ...txtRoot].map((parts) => (Array.isArray(parts) ? parts.join('') : String(parts)));
  const txtMatched = flatTxts.includes(expectedTxt);

  const method = nsMatched
    ? 'nameservers'
    : addrMatched
      ? 'dns_record'
      : txtMatched
        ? 'txt_verification'
        : httpOk
          ? 'http_proxy_probe'
          : null;

  return {
    verified: Boolean(method),
    method,
    nameservers: observedNs,
    expectedNameservers,
    ipv4Addresses: aRecords,
    ipv6Addresses: aaaaRecords,
    expectedAddresses: cfg.serverAddresses || []
  };
}

function serializeCloudDomainRow(row, liveConfig, records = []) {
  const edgeTarget = liveConfig?.ipv4 || liveConfig?.ipv6 || '';
  return {
    id: row.id,
    dropletId: row.droplet_id || null,
    dropletName: row.droplet_name || null,
    userId: row.user_id,
    hostname: row.hostname,
    domain: row.hostname,
    rootDomain: row.root_domain,
    recordType: row.record_type || 'A+AAAA',
    type: row.record_type || 'A+AAAA',
    targetPort: Number(row.target_port) || 80,
    proxyEnabled: row.proxy_enabled !== false,
    ttl: Number(row.ttl) || 300,
    status: row.status,
    sslStatus: row.ssl_status,
    autoUpdateOnPrefixChange: row.auto_update_on_prefix_change !== false,
    value: edgeTarget || row.droplet_ipv6 || row.droplet_ip || '—',
    target: edgeTarget || row.droplet_ipv6 || row.droplet_ip || '—',
    nameservers: liveConfig?.nameservers || [`${PLATFORM_CONFIG.dns1Subdomain}.${PLATFORM_CONFIG.primaryDomain}`, `${PLATFORM_CONFIG.dns2Subdomain}.${PLATFORM_CONFIG.primaryDomain}`],
    serverIpv4: liveConfig?.ipv4 || '',
    serverIpv6: liveConfig?.ipv6 || '',
    verificationTxt: {
      type: 'TXT',
      name: `_tiwlo-verification.${row.hostname}`,
      value: `tiwlo-domain-verification=${row.verification_token}`
    },
    verifiedAt: row.verified_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    records
  };
}

async function assertDomainAvailableForUser({ userId, hostname }) {
  const freeBase = String(PLATFORM_CONFIG.freeSubdomainDomain || 'uids.app').toLowerCase();
  const isFreeSub = hostname.endsWith(`.${freeBase}`);
  let ownedFreeSubdomain = false;

  if (isFreeSub) {
    const { rows } = await queryPg(
      `SELECT id, user_id, status FROM system_free_subdomains WHERE domain = $1 LIMIT 1`,
      [hostname]
    );
    if (!rows[0] || rows[0].status !== 'active') {
      throw domainError(`Register ${hostname} as a free subdomain first, or enter your own custom domain.`, 404);
    }
    if (rows[0].user_id !== userId) {
      throw domainError('This subdomain belongs to another account.', 403);
    }
    ownedFreeSubdomain = true;
  } else if (isReservedPlatformDomain(hostname) || hostname === freeBase) {
    throw domainError('Tiwlo platform domains cannot be claimed here.', 400);
  }

  const root = extractRootDomain(hostname);
  const { rows: customTaken } = await queryPg(
    `SELECT user_id FROM system_custom_domains WHERE (domain = $1 OR domain = $2) AND user_id <> $3 AND status IN ('verified', 'active') LIMIT 1`,
    [hostname, root, userId]
  );
  if (customTaken.length > 0) {
    throw domainError('This domain is already verified by another Tiwlo account.', 409);
  }

  const { rows: dropletTaken } = await queryPg(
    `SELECT id, user_id, status FROM cloud_droplet_domains WHERE hostname = $1 AND user_id <> $2 LIMIT 1`,
    [hostname, userId]
  );
  if (dropletTaken[0]) {
    if (dropletTaken[0].status === 'active') {
      throw domainError('This domain is already connected to another Tiwlo VPS.', 409);
    }
    // Remove stale unverified reservation only after checking exact conflict
    const { rows: recentPending } = await queryPg(
      `SELECT id FROM cloud_droplet_domains WHERE id = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
      [dropletTaken[0].id]
    );
    if (recentPending.length > 0) {
      throw domainError('This domain is currently pending verification on another account.', 409);
    }
    await queryPg(`DELETE FROM cloud_droplet_domains WHERE id = $1 AND status <> 'active'`, [dropletTaken[0].id]);
  }

  return { ownedFreeSubdomain, rootDomain: root };
}

export async function listDropletDomainsForUser({ userId, dropletId = null }) {
  await ensureCloudDropletDomainSchema();
  const params = dropletId ? [userId, dropletId] : [userId];
  const where = dropletId ? 'dd.user_id = $1 AND dd.droplet_id = $2' : 'dd.user_id = $1';
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `SELECT dd.*, d.name AS droplet_name, d.ip AS droplet_ip, d.ipv6 AS droplet_ipv6
       FROM cloud_droplet_domains dd
       LEFT JOIN cloud_droplets d ON d.id = dd.droplet_id
       WHERE ${where}
       ORDER BY dd.created_at DESC`,
      params
    ),
    getLivePlatformDnsConfig()
  ]);

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { rows: recRows } = await queryPg(
    `SELECT * FROM cloud_droplet_domain_records WHERE domain_id = ANY($1::text[]) ORDER BY created_at ASC`,
    [ids]
  ).catch(() => ({ rows: [] }));

  const recByDomain = new Map();
  for (const r of recRows) {
    if (!recByDomain.has(r.domain_id)) recByDomain.set(r.domain_id, []);
    recByDomain.get(r.domain_id).push({
      id: r.id,
      domainId: r.domain_id,
      type: r.type,
      name: r.name,
      value: r.value,
      ttl: r.ttl,
      createdAt: r.created_at
    });
  }

  return rows.map((row) => serializeCloudDomainRow(row, liveConfig, recByDomain.get(row.id) || []));
}

export async function bindCloudCustomDomain({
  userId,
  hostname: rawHostname,
  dropletId = null,
  recordType = 'A+AAAA',
  targetPort = 80,
  ttl = 300,
  proxyEnabled = true
}) {
  await ensureCloudDropletDomainSchema();
  const hostname = normalizeCloudHostname(rawHostname);
  const cleanPort = Math.min(65535, Math.max(1, Number.parseInt(String(targetPort ?? 80), 10) || 80));
  const cleanTtl = Math.min(86400, Math.max(60, Number.parseInt(String(ttl ?? 300), 10) || 300));
  const cleanRecordType = ['A+AAAA', 'A', 'AAAA', 'PROXY'].includes(String(recordType).toUpperCase())
    ? String(recordType).toUpperCase()
    : 'A+AAAA';

  let cleanDropletId = null;
  if (dropletId) {
    const { rows: dRows } = await queryPg(
      `SELECT id FROM cloud_droplets WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dropletId, userId]
    );
    if (!dRows[0]) {
      throw domainError('Selected VPS droplet was not found for your account.', 404);
    }
    cleanDropletId = dRows[0].id;
  }

  const { ownedFreeSubdomain, rootDomain } = await assertDomainAvailableForUser({ userId, hostname });
  const liveConfig = await getLivePlatformDnsConfig();

  const { rows: existingOwn } = await queryPg(
    `SELECT * FROM cloud_droplet_domains WHERE hostname = $1 AND user_id = $2 LIMIT 1`,
    [hostname, userId]
  );

  const verificationToken = existingOwn[0]?.verification_token || crypto.randomBytes(18).toString('hex');
  const routing = await verifyDomainRoutingState({
    hostname,
    rootDomain,
    verificationToken,
    ownedFreeSubdomain,
    liveConfig
  });

  const alreadyActive = existingOwn[0]?.status === 'active';
  const isVerifiedNow = routing.verified || alreadyActive;
  const nextStatus = isVerifiedNow ? 'active' : 'pending_dns';
  const nextSslStatus = isVerifiedNow ? 'active' : 'pending';

  if (existingOwn[0]) {
    const { rows } = await queryPg(
      `UPDATE cloud_droplet_domains
       SET droplet_id = COALESCE($1, droplet_id),
           record_type = $2,
           target_port = $3,
           proxy_enabled = $4,
           ttl = $5,
           status = $6,
           ssl_status = $7,
           verified_at = COALESCE(verified_at, CASE WHEN $8 THEN CURRENT_TIMESTAMP ELSE NULL END),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        cleanDropletId,
        cleanRecordType,
        cleanPort,
        proxyEnabled !== false,
        cleanTtl,
        nextStatus,
        nextSslStatus,
        isVerifiedNow,
        existingOwn[0].id,
        userId
      ]
    );
    invalidateVpsWebProxyCache(hostname);
    return {
      domain: serializeCloudDomainRow(rows[0], liveConfig),
      verification: routing
    };
  }

  const id = `cdom_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const { rows } = await queryPg(
    `INSERT INTO cloud_droplet_domains (
       id, droplet_id, user_id, hostname, root_domain, record_type,
       target_port, proxy_enabled, ttl, verification_token, status, ssl_status, verified_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CASE WHEN $13 THEN CURRENT_TIMESTAMP ELSE NULL END)
     RETURNING *`,
    [
      id,
      cleanDropletId,
      userId,
      hostname,
      rootDomain,
      cleanRecordType,
      cleanPort,
      proxyEnabled !== false,
      cleanTtl,
      verificationToken,
      nextStatus,
      nextSslStatus,
      isVerifiedNow
    ]
  );

  invalidateVpsWebProxyCache(hostname);
  return {
    domain: serializeCloudDomainRow(rows[0], liveConfig),
    verification: routing
  };
}

export async function verifyCloudCustomDomain({ userId, domainId, dropletId = null }) {
  await ensureCloudDropletDomainSchema();
  const params = dropletId ? [domainId, userId, dropletId] : [domainId, userId];
  const where = dropletId ? 'id = $1 AND user_id = $2 AND droplet_id = $3' : 'id = $1 AND user_id = $2';
  const { rows } = await queryPg(`SELECT * FROM cloud_droplet_domains WHERE ${where} LIMIT 1`, params);
  if (!rows[0]) {
    throw domainError('Domain binding not found.', 404);
  }
  const row = rows[0];
  const liveConfig = await getLivePlatformDnsConfig();
  const freeBase = String(PLATFORM_CONFIG.freeSubdomainDomain || 'uids.app').toLowerCase();
  const routing = await verifyDomainRoutingState({
    hostname: row.hostname,
    rootDomain: row.root_domain,
    verificationToken: row.verification_token,
    ownedFreeSubdomain: row.hostname.endsWith(`.${freeBase}`),
    liveConfig
  });

  if (!routing.verified && row.status !== 'active') {
    return {
      verified: false,
      domain: serializeCloudDomainRow(row, liveConfig),
      verification: routing
    };
  }

  const { rows: updated } = await queryPg(
    `UPDATE cloud_droplet_domains
     SET status = 'active',
         ssl_status = 'active',
         verified_at = COALESCE(verified_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [row.id, userId]
  );
  invalidateVpsWebProxyCache(row.hostname);
  return {
    verified: true,
    domain: serializeCloudDomainRow(updated[0], liveConfig),
    verification: routing
  };
}

export async function linkCloudCustomDomainToDroplet({
  userId,
  domainId,
  dropletId = null,
  targetPort = 80,
  proxyEnabled = true
}) {
  await ensureCloudDropletDomainSchema();
  let cleanDropletId = null;
  if (dropletId) {
    const { rows: dRows } = await queryPg(
      `SELECT id FROM cloud_droplets WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [dropletId, userId]
    );
    if (!dRows[0]) {
      throw domainError('Selected VPS droplet was not found for your account.', 404);
    }
    cleanDropletId = dRows[0].id;
  }

  const cleanPort = Math.min(65535, Math.max(1, Number.parseInt(String(targetPort ?? 80), 10) || 80));
  const [{ rows }, liveConfig] = await Promise.all([
    queryPg(
      `UPDATE cloud_droplet_domains
       SET droplet_id = $1,
           target_port = $2,
           proxy_enabled = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [cleanDropletId, cleanPort, proxyEnabled !== false, domainId, userId]
    ),
    getLivePlatformDnsConfig()
  ]);
  if (!rows[0]) {
    throw domainError('Domain not found.', 404);
  }
  invalidateVpsWebProxyCache(rows[0].hostname);
  return serializeCloudDomainRow(rows[0], liveConfig);
}

export async function removeCloudCustomDomain({ userId, domainId, dropletId = null }) {
  await ensureCloudDropletDomainSchema();
  const params = dropletId ? [domainId, userId, dropletId] : [domainId, userId];
  const where = dropletId ? 'id = $1 AND user_id = $2 AND droplet_id = $3' : 'id = $1 AND user_id = $2';
  const { rows } = await queryPg(`DELETE FROM cloud_droplet_domains WHERE ${where} RETURNING hostname`, params);
  if (!rows[0]) return false;
  invalidateVpsWebProxyCache(rows[0].hostname);
  return true;
}

export async function addCloudDomainZoneRecord({ userId, domainId, type, name, value, ttl = 300 }) {
  await ensureCloudDropletDomainSchema();
  const { rows: domainRows } = await queryPg(
    `SELECT id, hostname, root_domain FROM cloud_droplet_domains WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [domainId, userId]
  );
  if (!domainRows[0]) throw domainError('Domain not found.', 404);
  const domain = domainRows[0];

  const cleanType = String(type || '').trim().toUpperCase();
  if (!RECORD_TYPES.has(cleanType)) {
    throw domainError('Record type must be A, AAAA, CNAME, MX, TXT, or NS.', 400);
  }

  let cleanName = String(name || '@').trim().toLowerCase().replace(/\.$/, '') || '@';
  const baseZone = domain.root_domain || domain.hostname;
  if (cleanName === baseZone) cleanName = '@';
  else if (cleanName.endsWith(`.${baseZone}`)) cleanName = cleanName.slice(0, -(baseZone.length + 1)) || '@';
  if (cleanName !== '@' && cleanName !== '*' && !/^(?:\*\.)?(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)(?:\.(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?))*$/.test(cleanName)) {
    throw domainError('Enter a valid DNS host name (e.g., @, www, api, or *).', 400);
  }

  const cleanValue = String(value || '').trim();
  if (!cleanValue || cleanValue.length > 1024) throw domainError('Enter a valid DNS record value.', 400);
  if (cleanType === 'A' && !isIPv4(cleanValue)) throw domainError('A record must be a valid IPv4 address.', 400);
  if (cleanType === 'AAAA' && !isIPv6(cleanValue)) throw domainError('AAAA record must be a valid IPv6 address.', 400);
  if ((cleanType === 'CNAME' || cleanType === 'MX' || cleanType === 'NS') && !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}\.?$/.test(cleanValue)) {
    throw domainError(`${cleanType} record requires a valid target hostname.`, 400);
  }

  const cleanTtl = Math.min(86400, Math.max(60, Number.parseInt(String(ttl ?? 300), 10) || 300));
  const id = `cdr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const normalizedVal = ['CNAME', 'MX', 'NS'].includes(cleanType) ? cleanValue.toLowerCase().replace(/\.$/, '') : cleanValue;

  const { rows } = await queryPg(
    `INSERT INTO cloud_droplet_domain_records (id, domain_id, type, name, value, ttl)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (domain_id, type, name, value) DO UPDATE SET ttl = EXCLUDED.ttl
     RETURNING *`,
    [id, domain.id, cleanType, cleanName, normalizedVal, cleanTtl]
  );
  return {
    id: rows[0].id,
    domainId: rows[0].domain_id,
    type: rows[0].type,
    name: rows[0].name,
    value: rows[0].value,
    ttl: rows[0].ttl,
    createdAt: rows[0].created_at
  };
}

export async function deleteCloudDomainZoneRecord({ userId, domainId, recordId }) {
  await ensureCloudDropletDomainSchema();
  const { rowCount } = await queryPg(
    `DELETE FROM cloud_droplet_domain_records r
     USING cloud_droplet_domains d
     WHERE r.id = $1 AND r.domain_id = $2 AND d.id = r.domain_id AND d.user_id = $3`,
    [recordId, domainId, userId]
  );
  return rowCount > 0;
}
