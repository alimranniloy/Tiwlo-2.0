/**
 * Subdomain Navigation & Authentication Router Utility
 * Seamlessly manages routing between the main app and configured subdomains
 * Both on production and local development (auth.localhost:port / localhost:port).
 */
import { AUTH_SUBDOMAIN, PLATFORM_DOMAIN, TPANEL_SUBDOMAIN } from '../config/platformConfig';

export function isAuthSubdomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === `${AUTH_SUBDOMAIN}.${PLATFORM_DOMAIN}` || h === `${AUTH_SUBDOMAIN}.localhost`;
}

export function isTPanelSubdomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === `${TPANEL_SUBDOMAIN}.${PLATFORM_DOMAIN}` || h === `${TPANEL_SUBDOMAIN}.localhost`;
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
  return `https://${AUTH_SUBDOMAIN}.${PLATFORM_DOMAIN}${cleanPath}`;
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
