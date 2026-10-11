import { getRustIdentityHeader } from './rustIdentity.js';

const REQUEST_TIMEOUT_MS = 2500;

function rustDomainClaimEnabled() {
  return String(process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED || '').toLowerCase() === 'true';
}

function rustDnsEnabled() {
  return String(process.env.TIWLO_RUST_DNS_ENABLED || '').toLowerCase() === 'true';
}

function getRustBackendUrl() {
  const value = String(process.env.TIWLO_RUST_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('TIWLO_RUST_BACKEND_URL must be configured when a Rust feature is enabled.');
  return value;
}

export function isRustDomainClaimEnabled() {
  return rustDomainClaimEnabled();
}

export function isRustDnsEnabled() {
  return rustDnsEnabled();
}

export async function claimDomainWithRust({ user, name, request }) {
  if (!rustDomainClaimEnabled()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${getRustBackendUrl()}/v1/domains/claim`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...getRustIdentityHeader(user, request)
      },
      body: JSON.stringify({ name }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || 'Rust domain claim failed.');
      error.statusCode = response.status;
      error.details = body;
      throw error;
    }

    return {
      id: body.id,
      subdomain: body.subdomain,
      domain: body.domain,
      status: 'active'
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function requestRustDns({ method, subdomainId, recordId, user, request, body }) {
  if (!rustDnsEnabled()) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const suffix = recordId
    ? `/v1/domains/${encodeURIComponent(subdomainId)}/records/${encodeURIComponent(recordId)}`
    : `/v1/domains/${encodeURIComponent(subdomainId)}/records`;
  try {
    const response = await fetch(`${getRustBackendUrl()}${suffix}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...getRustIdentityHeader(user, request)
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Rust DNS operation failed.');
      error.statusCode = response.status;
      error.details = payload;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export function listDnsRecordsWithRust({ user, subdomainId, request }) {
  return requestRustDns({ method: 'GET', user, subdomainId, request });
}

export function createDnsRecordWithRust({ user, subdomainId, request, body }) {
  return requestRustDns({ method: 'POST', user, subdomainId, request, body });
}

export function updateDnsRecordWithRust({ user, subdomainId, recordId, request, body }) {
  return requestRustDns({ method: 'PATCH', user, subdomainId, recordId, request, body });
}

export function deleteDnsRecordWithRust({ user, subdomainId, recordId, request }) {
  return requestRustDns({ method: 'DELETE', user, subdomainId, recordId, request });
}
