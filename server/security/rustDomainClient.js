import { getRustIdentityHeader } from './rustIdentity.js';

const REQUEST_TIMEOUT_MS = 2500;

function rustDomainClaimEnabled() {
  return String(process.env.TIWLO_RUST_DOMAIN_CLAIM_ENABLED || '').toLowerCase() === 'true';
}

function getRustBackendUrl() {
  const value = String(process.env.TIWLO_RUST_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error('TIWLO_RUST_BACKEND_URL must be configured when Rust domain claims are enabled.');
  return value;
}

export function isRustDomainClaimEnabled() {
  return rustDomainClaimEnabled();
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
