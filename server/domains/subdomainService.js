import { randomBytes } from 'crypto';
import { isPgActive, queryPg } from '../db/postgres.js';
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

export async function claimSubdomain({ userId, input }) {
  requireDatabase();
  if (!userId) throw new DomainServiceError('Authentication required.', 401);
  const name = normalizeSubdomain(input);
  if (RESERVED_NAMES.has(name)) {
    throw new DomainServiceError('This subdomain is reserved by the platform.', 409);
  }

  const id = `sub_${randomBytes(12).toString('hex')}`;
  try {
    const { rowCount } = await queryPg(
      `UPDATE system_free_subdomains
       SET user_id = $1, status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE subdomain = $2 AND status = 'released'`,
      [userId, name]
    );
    if (rowCount > 0) {
      const { rows } = await queryPg(
        `SELECT id, subdomain, domain, status, created_at
         FROM system_free_subdomains WHERE subdomain = $1`,
        [name]
      );
      return rows[0];
    }
    const { rows } = await queryPg(
      `INSERT INTO system_free_subdomains (id, subdomain, domain, user_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, subdomain, domain, status, created_at`,
      [id, name, getDomain(name), userId]
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new DomainServiceError('This subdomain is already registered.', 409);
    }
    throw error;
  }
}
