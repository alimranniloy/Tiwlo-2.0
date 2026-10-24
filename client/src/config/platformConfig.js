const cleanDomain = (value, fallback = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '')
  .replace(/^\*\./, '') || fallback;

export const PLATFORM_DOMAIN = cleanDomain(import.meta.env.VITE_PRIMARY_DOMAIN, 'tiwlo.com');
export const STORE_DOMAIN = cleanDomain(import.meta.env.VITE_STORE_DOMAIN, PLATFORM_DOMAIN) || PLATFORM_DOMAIN;
export const FREE_SUBDOMAIN_DOMAIN = cleanDomain(import.meta.env.VITE_FREE_SUBDOMAIN_DOMAIN, 'uids.app');
export const MANAGED_DOMAINS = Object.freeze([...new Set([
  PLATFORM_DOMAIN,
  STORE_DOMAIN,
  FREE_SUBDOMAIN_DOMAIN,
  ...String(import.meta.env.VITE_MANAGED_DOMAINS || '').split(',').map(domain => cleanDomain(domain)).filter(Boolean)
])]);
export const SERVER_IPV4 = import.meta.env.VITE_SERVER_IPV4 || '';
export const DNS_TTL = Math.max(1, Number.parseInt(import.meta.env.VITE_DNS_TTL || '300', 10) || 300);
export const DNS_NS_TTL = Math.max(1, Number.parseInt(import.meta.env.VITE_DNS_NS_TTL || '86400', 10) || 86400);
export const DNS_SOA_TTL = Math.max(1, Number.parseInt(import.meta.env.VITE_DNS_SOA_TTL || '3600', 10) || 3600);
export const WWW_SUBDOMAIN = import.meta.env.VITE_WWW_SUBDOMAIN || 'www';
export const AUTH_SUBDOMAIN = import.meta.env.VITE_AUTH_SUBDOMAIN || 'auth';
export const AUTH_DOMAIN = cleanDomain(import.meta.env.VITE_AUTH_DOMAIN, `${AUTH_SUBDOMAIN}.${PLATFORM_DOMAIN}`);
export const DASHBOARD_URL = String(import.meta.env.VITE_DASHBOARD_URL || `https://uids.${PLATFORM_DOMAIN}`).trim().replace(/\/+$/, '');
export const TPANEL_SUBDOMAIN = import.meta.env.VITE_TPANEL_SUBDOMAIN || 'tpanel';
export const DNS1_SUBDOMAIN = import.meta.env.VITE_DNS1_SUBDOMAIN || 'dns1';
export const DNS2_SUBDOMAIN = import.meta.env.VITE_DNS2_SUBDOMAIN || 'dns2';
export const MAIL_SUBDOMAIN = import.meta.env.VITE_MAIL_SUBDOMAIN || 'mail';
export const MAIL_HOSTNAME = `${MAIL_SUBDOMAIN}.${PLATFORM_DOMAIN}`;
export const DRIVE_SUBDOMAIN = import.meta.env.VITE_DRIVE_SUBDOMAIN || 'drive';
export const SUPPORT_EMAIL = `${import.meta.env.VITE_SUPPORT_EMAIL_LOCAL_PART || 'support'}@${PLATFORM_DOMAIN}`;
export const ADMIN_EMAIL = `${import.meta.env.VITE_ADMIN_EMAIL_LOCAL_PART || 'admin'}@${PLATFORM_DOMAIN}`;
export const BILLING_EMAIL = `${import.meta.env.VITE_BILLING_EMAIL_LOCAL_PART || 'billing'}@${PLATFORM_DOMAIN}`;
export const NOREPLY_EMAIL = `${import.meta.env.VITE_NOREPLY_EMAIL_LOCAL_PART || 'noreply'}@${PLATFORM_DOMAIN}`;
export const SECURITY_EMAIL = `${import.meta.env.VITE_SECURITY_EMAIL_LOCAL_PART || 'security'}@${PLATFORM_DOMAIN}`;

export const getSubdomain = (label, domain = PLATFORM_DOMAIN) => `${label}.${domain}`;
export const isStorefrontSubdomainHost = (hostname = typeof window === 'undefined' ? '' : window.location.hostname) => {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  const suffix = `.${STORE_DOMAIN}`;
  if (!host.endsWith(suffix)) return false;
  const label = host.slice(0, -suffix.length);
  const reservedLabels = [
    WWW_SUBDOMAIN,
    AUTH_SUBDOMAIN,
    TPANEL_SUBDOMAIN,
    DNS1_SUBDOMAIN,
    DNS2_SUBDOMAIN,
    MAIL_SUBDOMAIN,
    DRIVE_SUBDOMAIN
  ].map(value => String(value).toLowerCase());
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) &&
    !reservedLabels.includes(label);
};
export const getPlatformUrl = (pathname = '') => {
  const cleanPath = String(pathname).replace(/^\/+/, '');
  return `https://${PLATFORM_DOMAIN}${cleanPath ? `/${cleanPath}` : ''}`;
};
export const getStoreHostname = (slug) => `${String(slug || '').trim()}.${STORE_DOMAIN}`;
export const getStoreUrl = (slug) => `https://${getStoreHostname(slug)}`;
