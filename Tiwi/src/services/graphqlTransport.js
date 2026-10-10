import { BASE_URL } from '../config/api';
const apiOrigin = new URL(BASE_URL).origin;

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
/** @param {string | URL} resource @param {RequestInit} options */
export async function applicationFetch(resource, options = {}) {
  if (typeof resource !== 'string' && !(resource instanceof URL)) return nativeFetch(resource, options);
  const url = new URL(resource, BASE_URL);
  const ownOrigin = url.origin === apiOrigin;
  if (!ownOrigin || !url.pathname.startsWith('/api/') || /graphql|upload|attachment|download|export|backup|media\/|stream|\/tls\/|webhook/i.test(url.pathname) ||
      (options.body != null && typeof options.body !== 'string')) return nativeFetch(resource, options);
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return nativeFetch(resource, options);
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
  const headers = new Headers(options.headers);
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
