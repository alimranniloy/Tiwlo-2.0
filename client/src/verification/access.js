const HANDOFF_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

export function isVerificationRouteAllowed(pathname, hash, historyState) {
  const route = pathname.replace(/^\/+|\/+$/g, '');
  if (route !== 'verification' && !route.startsWith('verification/')) return false;

  if (route === 'verification/continue') {
    const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
    return typeof token === 'string' && HANDOFF_TOKEN_PATTERN.test(token);
  }

  return historyState?.identityVerificationStarted === true;
}
