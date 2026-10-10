import './loadRootEnv.js';

const cleanDomain = (value, fallback = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '')
  .replace(/^\*\./, '') || fallback;

const primaryDomain = cleanDomain(process.env.VITE_PRIMARY_DOMAIN, 'tiwlo.com');
const storeDomain = cleanDomain(process.env.VITE_STORE_DOMAIN, primaryDomain) || primaryDomain;
const freeSubdomainDomain = cleanDomain(process.env.VITE_FREE_SUBDOMAIN_DOMAIN, 'uids.app');
const configuredDomainList = String(process.env.VITE_MANAGED_DOMAINS || '')
  .split(',')
  .map(domain => cleanDomain(domain))
  .filter(Boolean);
const managedDomains = Object.freeze([...new Set([
  primaryDomain,
  storeDomain,
  freeSubdomainDomain,
  ...configuredDomainList
])]);
const subdomain = (key, fallback) => String(process.env[key] || fallback).trim().toLowerCase();
const email = (key, fallback) => `${subdomain(key, fallback)}@${primaryDomain}`;

export const PLATFORM_CONFIG = Object.freeze({
  primaryDomain,
  storeDomain,
  freeSubdomainDomain,
  managedDomains,
  cookieDomain: `.${primaryDomain}`,
  serverIpv4: process.env.VITE_SERVER_IPV4 || '162.35.124.233',
  wwwSubdomain: subdomain('VITE_WWW_SUBDOMAIN', 'www'),
  authSubdomain: subdomain('VITE_AUTH_SUBDOMAIN', 'auth'),
  tpanelSubdomain: subdomain('VITE_TPANEL_SUBDOMAIN', 'tpanel'),
  dns1Subdomain: subdomain('VITE_DNS1_SUBDOMAIN', 'dns1'),
  dns2Subdomain: subdomain('VITE_DNS2_SUBDOMAIN', 'dns2'),
  mailSubdomain: subdomain('VITE_MAIL_SUBDOMAIN', 'mail'),
  mtaSubdomain: subdomain('VITE_MTA_SUBDOMAIN', 'mail'),
  driveSubdomain: subdomain('VITE_DRIVE_SUBDOMAIN', 'drive'),
  supportEmail: email('VITE_SUPPORT_EMAIL_LOCAL_PART', 'support'),
  sslEmail: email('VITE_SSL_EMAIL_LOCAL_PART', 'support'),
  adminEmail: email('VITE_ADMIN_EMAIL_LOCAL_PART', 'admin'),
  billingEmail: email('VITE_BILLING_EMAIL_LOCAL_PART', 'billing'),
  noreplyEmail: email('VITE_NOREPLY_EMAIL_LOCAL_PART', 'noreply'),
  securityEmail: email('VITE_SECURITY_EMAIL_LOCAL_PART', 'security'),
  dnsTtl: Math.max(1, Number.parseInt(process.env.VITE_DNS_TTL || '300', 10) || 300),
  dnsNsTtl: Math.max(1, Number.parseInt(process.env.VITE_DNS_NS_TTL || '86400', 10) || 86400),
  dnsSoaTtl: Math.max(1, Number.parseInt(process.env.VITE_DNS_SOA_TTL || '3600', 10) || 3600),
  dnsDmarcPolicy: process.env.VITE_DNS_DMARC_POLICY || 'quarantine',
  dnsSpfPolicy: process.env.VITE_DNS_SPF_POLICY || '~all',
  dkimSelector: process.env.VITE_DKIM_SELECTOR || 'tiwlo',
  emailSenderName: process.env.VITE_EMAIL_SENDER_NAME || 'Tiwlo'
});

export const getSubdomain = (label, domain = PLATFORM_CONFIG.primaryDomain) =>
  `${label}.${domain}`;

export const getStoreUrl = (slug) =>
  `https://${String(slug || '').trim()}.${PLATFORM_CONFIG.storeDomain}`;

export const getPlatformUrl = (pathname = '') => {
  const cleanPath = String(pathname).replace(/^\/+/, '');
  return `https://${PLATFORM_CONFIG.primaryDomain}${cleanPath ? `/${cleanPath}` : ''}`;
};
