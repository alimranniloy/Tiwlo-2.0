import { getRustIdentityHeader } from './rustIdentity.js';

const REQUEST_TIMEOUT_MS = 2500;

function getRustBackendUrl() {
  const value = String(process.env.TIWLO_RUST_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('TIWLO_RUST_BACKEND_URL must be configured for domain services.');
  return value;
}

async function requestRust({ path, method = 'GET', user, request, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${getRustBackendUrl()}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(user ? getRustIdentityHeader(user, request) : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    let payload = null;
    if (response.status !== 204) {
      const responseText = await response.text();
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch (cause) {
          const error = new Error('Rust domain service returned an invalid response.', { cause });
          error.statusCode = response.ok ? 502 : response.status;
          throw error;
        }
      }
    }
    if (!response.ok) {
      const error = new Error(payload?.error || 'Rust domain operation failed.');
      error.statusCode = response.status;
      error.details = payload || {};
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function checkSubdomainWithRust(name) {
  return requestRust({ path: `/v1/domains/check?name=${encodeURIComponent(String(name ?? ''))}` });
}

export async function claimDomainWithRust({ user, name, request }) {
  const body = await requestRust({
    path: '/v1/domains/claim',
    method: 'POST',
    user,
    request,
    body: { name }
  });
  return { ...body, status: 'active' };
}

export function listUserDomainsWithRust({ user, request }) {
  return requestRust({ path: '/v1/domains', user, request });
}

function dnsPath(subdomainId, recordId) {
  const path = `/v1/domains/${encodeURIComponent(subdomainId)}/records`;
  return recordId ? `${path}/${encodeURIComponent(recordId)}` : path;
}

export function listDnsRecordsWithRust({ user, subdomainId, request }) {
  return requestRust({ path: dnsPath(subdomainId), user, request });
}

export function createDnsRecordWithRust({ user, subdomainId, request, body }) {
  return requestRust({ path: dnsPath(subdomainId), method: 'POST', user, request, body });
}

export function updateDnsRecordWithRust({ user, subdomainId, recordId, request, body }) {
  return requestRust({
    path: dnsPath(subdomainId, recordId),
    method: 'PATCH',
    user,
    request,
    body
  });
}

export function deleteDnsRecordWithRust({ user, subdomainId, recordId, request }) {
  return requestRust({
    path: dnsPath(subdomainId, recordId),
    method: 'DELETE',
    user,
    request
  });
}
