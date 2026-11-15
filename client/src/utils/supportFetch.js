import { applicationFetch } from '../api/graphqlTransport.js';
import { getDeviceTrackingHeaders } from './deviceFingerprint.js';

/**
 * Resolves REST support/admin endpoints through applicationFetch when registered
 * in the GraphQL operation manifest, falling back to native fetch for newer REST routes.
 */
export async function supportFetch(resource, options = {}) {
  let token = '';
  try {
    const raw = localStorage.getItem('stockpro_session');
    if (raw) {
      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        token = parsed?.token || parsed?.accessToken || '';
      } else {
        token = raw.trim();
      }
    }
  } catch {
    token = localStorage.getItem('stockpro_session') || '';
  }

  const deviceHeaders = await getDeviceTrackingHeaders().catch(() => ({}));
  const existingHeaders = options.headers instanceof Headers
    ? Object.fromEntries(options.headers.entries())
    : { ...(options.headers || {}) };

  const headers = {
    ...deviceHeaders,
    ...existingHeaders,
  };
  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const mergedOptions = {
    ...options,
    credentials: options.credentials || 'include',
    headers,
  };

  try {
    return await applicationFetch(resource, mergedOptions);
  } catch (err) {
    const msg = String(err?.message || '');
    if (
      msg.includes('No GraphQL operation is registered') ||
      msg.includes('GraphQL API is unavailable')
    ) {
      return globalThis.fetch(resource, mergedOptions);
    }
    throw err;
  }
}

export default supportFetch;
