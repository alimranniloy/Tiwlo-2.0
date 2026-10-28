/**
 * Subdomain Navigation & Authentication Router Utility
 * Seamlessly manages routing between the main app and configured subdomains
 * Both on production and local development (auth.localhost:port / localhost:port).
 */
import {
  AUTH_SUBDOMAIN,
  MAIL_HOSTNAME,
  MAIL_SUBDOMAIN,
  PLATFORM_DOMAIN,
  FREE_SUBDOMAIN_DOMAIN,
  TPANEL_SUBDOMAIN,
  AUTH_DOMAIN,
  DASHBOARD_URL
} from '../config/platformConfig';

export function isAuthSubdomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === AUTH_DOMAIN || h === `${AUTH_SUBDOMAIN}.localhost`;
}

export function isDashboardSubdomain() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  const dashboardHost = new URL(DASHBOARD_URL).hostname.toLowerCase();
  const platformHost = PLATFORM_DOMAIN.toLowerCase();
  const isConfiguredDashboardHost = hostname === dashboardHost &&
    hostname !== platformHost &&
    hostname !== `www.${platformHost}`;
  return isConfiguredDashboardHost || hostname === FREE_SUBDOMAIN_DOMAIN || hostname === `uids.${PLATFORM_DOMAIN}.localhost`;
}

export function isTPanelSubdomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === `${TPANEL_SUBDOMAIN}.${PLATFORM_DOMAIN}` || h === `${TPANEL_SUBDOMAIN}.localhost`;
}

export function isMailSubdomain() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === MAIL_HOSTNAME || hostname === `${MAIL_SUBDOMAIN}.localhost`;
}

export function getAuthUrl(path = '') {
  if (typeof window === 'undefined') return '/login';
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';

  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  if (isLocal) {
    return `${protocol}//${AUTH_SUBDOMAIN}.localhost${port}${cleanPath}`;
  }
  return `https://${AUTH_DOMAIN}${cleanPath}`;
}

export function getDashboardUrl(path = '') {
  if (typeof window === 'undefined') return path || '/';
  const isLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost');
  const base = isLocal ? `${window.location.protocol}//uids.${PLATFORM_DOMAIN}.localhost${window.location.port ? `:${window.location.port}` : ''}` : DASHBOARD_URL;
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';
  return `${base}${cleanPath}`;
}

export function getUidsDashboardUrl(path = '') {
  if (typeof window === 'undefined') return path || '/';
  const isLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost');
  const base = isLocal
    ? `${window.location.protocol}//uids.${PLATFORM_DOMAIN}.localhost${window.location.port ? `:${window.location.port}` : ''}`
    : `https://${FREE_SUBDOMAIN_DOMAIN}`;
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';
  return `${base}${cleanPath}`;
}

export function getMainAppUrl(path = '') {
  if (typeof window === 'undefined') return '/';
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';

  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  if (isLocal) {
    return `${protocol}//localhost${port}${cleanPath}`;
  }
  return `https://${PLATFORM_DOMAIN}${cleanPath}`;
}

export function getMailUrl(path = '') {
  if (typeof window === 'undefined') return '/';
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  const mailHost = isLocal ? `${MAIL_SUBDOMAIN}.localhost` : MAIL_HOSTNAME;
  return `${protocol}//${mailHost}${port}${cleanPath}`;
}

export function getTPanelUrl(path = '') {
  if (typeof window === 'undefined') return path || '/';
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  const tpanelHost = isLocal ? `${TPANEL_SUBDOMAIN}.localhost` : `${TPANEL_SUBDOMAIN}.${PLATFORM_DOMAIN}`;
  return `${protocol}//${tpanelHost}${port}${cleanPath}`;
}
