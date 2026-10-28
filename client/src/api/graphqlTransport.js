import { PLATFORM_DOMAIN } from '../config/platformConfig';
import { requestSensitiveActionGrant } from '../security/reauth';

const manifests = new Map();
const nativeFetch = (resource, options) => globalThis.fetch(resource, options);

async function operations(origin) {
  if (!manifests.has(origin)) {
    manifests.set(origin, nativeFetch(`${origin}/api/graphql`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ applicationOperations { field method path } }' })
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || result.errors || !Array.isArray(result.data?.applicationOperations)) throw new Error('GraphQL API is unavailable.');
      return result.data.applicationOperations;
    }).catch(error => { manifests.delete(origin); throw error; }));
  }
  return manifests.get(origin);
}

function matchPath(pattern, pathname) {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

// Existing views keep Response semantics while business requests use named
// File uploads, downloads, media, and external services keep native fetch.
export async function applicationFetch(resource, options = {}) {
  if (typeof resource !== 'string' && !(resource instanceof URL)) return nativeFetch(resource, options);
  const url = new URL(resource, window.location.href);
  const ownOrigin = url.origin === window.location.origin || url.hostname === PLATFORM_DOMAIN || url.hostname.endsWith(`.${PLATFORM_DOMAIN}`);
  if (!ownOrigin || !url.pathname.startsWith('/api/') || /graphql|upload|attachment|download|export|backup|media\/|stream|\/tls\/|webhook/i.test(url.pathname) ||
      (options.body != null && typeof options.body !== 'string')) return nativeFetch(resource, options);
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return nativeFetch(resource, options);
  const sensitiveAction = method === 'POST' && /^\/api\/(?:domains\/?|admin\/payment-gateways)$/.test(url.pathname) ||
    (method === 'POST' || method === 'PUT' || method === 'DELETE') && /^\/api\/(?:domains\/[^/]+(?:\/provision)?|staff(?:\/[^/]+)?|store\/payment-providers\/[^/]+|admin\/users\/[^/]+(?:\/ban|\/identity-verification\/require)?)$/.test(url.pathname) ||
    (method === 'PUT' || method === 'DELETE') && /^\/api\/admin\/users\/[^/]+$/.test(url.pathname) ||
    method === 'POST' && /^\/api\/subdomains\/(?:claim|[^/]+\/records)$/.test(url.pathname) ||
    (method === 'PATCH' || method === 'DELETE') && /^\/api\/subdomains\/[^/]+\/records(?:\/[^/]+)?$/.test(url.pathname) ||
    method === 'POST' && /^\/api\/domains\/[^/]+\/verify$/.test(url.pathname) ||
    method === 'PUT' && /^\/api\/(?:system\/settings|admin\/social-login\/[^/]+)$/.test(url.pathname) ||
    method === 'POST' && /^\/api\/admin\/storage\/(?:google-drive(?:\/[^/]+\/activate)?|sync\/[^/]+)$/.test(url.pathname) ||
    method === 'GET' && /^\/api\/system\/backup$/.test(url.pathname);
  const actionHeaders = new Headers(options.headers);
  if (sensitiveAction && !actionHeaders.has('x-tiwlo-reauth-grant')) {
    const grant = await requestSensitiveActionGrant(actionHeaders, url.origin);
    actionHeaders.set('x-tiwlo-reauth-grant', grant);
  }
  const manifest = await operations(url.origin);
  let selected;
  let params;
  for (const operation of manifest) {
    if (operation.method !== method) continue;
    const found = matchPath(operation.path, url.pathname);
    if (found) { selected = operation; params = found; break; }
  }
  if (!selected) throw new Error(`No GraphQL operation is registered for ${method} ${url.pathname}`);
  const input = { params, query: Object.fromEntries(url.searchParams), body: typeof options.body === 'string' ? JSON.parse(options.body) : {} };
  const headers = actionHeaders;
  headers.set('Content-Type', 'application/json');
  const response = await nativeFetch(`${url.origin}/api/graphql`, {
    ...options, method: 'POST', headers, credentials: options.credentials || 'include',
    body: JSON.stringify({ query: `${method === 'GET' ? 'query' : 'mutation'} ApplicationRequest($input: ApplicationInput) { result: ${selected.field}(input: $input) { status body headers } }`, variables: { input } })
  });
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0].message || 'GraphQL request failed');
  if (!response.ok || !result.data?.result) throw new Error('GraphQL API is unavailable.');
  const payload = result.data.result;
  const responseHeaders = new Headers(payload.headers || {});
  responseHeaders.set('Content-Type', 'application/json');
  return new Response([204, 205, 304].includes(payload.status) ? null : JSON.stringify(payload.body), { status: payload.status || 200, headers: responseHeaders });
}
