/**
 * Subdomain Navigation & Authentication Router Utility
 * Seamlessly manages routing between main app (tiwlo.com) and authentication subdomain (auth.tiwlo.com)
 * Both on production and local development (auth.localhost:port / localhost:port).
 */

export function isAuthSubdomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === 'auth.tiwlo.com' || h.startsWith('auth.') || h === 'auth.localhost';
}

export function isTPanelSubdomain() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === 'tpanel.tiwlo.com' || h.startsWith('tpanel.') || h === 'tpanel.localhost';
}

export function getAuthUrl(path = '') {
  if (typeof window === 'undefined') return '/login';
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';
  const cleanPath = path ? '/' + path.replace(/^\/+/, '') : '';

  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  if (isLocal) {
    return `${protocol}//auth.localhost${port}${cleanPath}`;
  }
  return `https://auth.tiwlo.com${cleanPath}`;
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
  return `https://tiwlo.com${cleanPath}`;
}
