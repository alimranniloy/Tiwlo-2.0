import { PLATFORM_CONFIG } from '../config/platformConfig.js';

export const RESERVED_STORE_SUBDOMAIN_LABELS = Object.freeze([
  'api',
  PLATFORM_CONFIG.wwwSubdomain,
  PLATFORM_CONFIG.authSubdomain,
  PLATFORM_CONFIG.tpanelSubdomain,
  PLATFORM_CONFIG.dns1Subdomain,
  PLATFORM_CONFIG.dns2Subdomain,
  PLATFORM_CONFIG.mailSubdomain,
  PLATFORM_CONFIG.driveSubdomain
].map(value => String(value).toLowerCase()));

function canonicalizeStoredSubdomain(value, domain) {
  const subdomain = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!subdomain) return '';
  return subdomain.includes('.') ? subdomain : `${subdomain}.${domain}`;
}

function invalidSubdomainError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function isStoreSubdomainAvailable(candidate, stores = [], users = [], domain = PLATFORM_CONFIG.storeDomain) {
  const target = canonicalizeStoredSubdomain(candidate, domain);
  return ![...stores, ...users].some(entry =>
    canonicalizeStoredSubdomain(entry.subdomain, domain) === target
  );
}

export function getStoreSubdomainAvailability(candidate, stores = [], users = [], domain = PLATFORM_CONFIG.storeDomain) {
  if (!String(candidate || '').trim()) {
    throw invalidSubdomainError('Enter a store subdomain to check availability.');
  }
  const subdomain = normalizeStoreSubdomain(candidate, 'store', domain);
  return {
    subdomain,
    available: isStoreSubdomainAvailable(subdomain, stores, users, domain)
  };
}

export function normalizeStoreSubdomain(input, storeName, domain = PLATFORM_CONFIG.storeDomain) {
  const storeDomain = String(domain || '').trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  if (!storeDomain) throw new Error('Store subdomain configuration is missing a domain.');

  const rawValue = String(input || '').trim().toLowerCase();
  const candidate = rawValue
    ? rawValue.replace(/^https?:\/\//, '').split(/[/?#]/, 1)[0].replace(/\.$/, '')
    : String(storeName || 'store').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'store';

  let label = candidate;
  if (candidate.endsWith(`.${storeDomain}`)) {
    label = candidate.slice(0, -(storeDomain.length + 1));
  } else if (candidate.includes('.')) {
    throw invalidSubdomainError(`Use a subdomain of ${storeDomain}, such as shop.${storeDomain}.`);
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
    throw invalidSubdomainError('The subdomain must be a single DNS label containing letters, numbers, or internal hyphens.');
  }
  if (RESERVED_STORE_SUBDOMAIN_LABELS.includes(label)) {
    throw invalidSubdomainError('This subdomain is reserved for Tiwlo services.');
  }

  return `${label}.${storeDomain}`;
}
