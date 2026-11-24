export function hasUnverifiedSsoIdentity(requestBody) {
  return Boolean(requestBody?.isSso);
}

export function getAuthenticatedUserId(req) {
  return req.activeUser?.id || null;
}

export function requireAuthenticatedUser(req, res, next, { allowIdentityVerification = false } = {}) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.activeUser.isBanned) {
    return res.status(403).json({ error: 'Account disabled' });
  }
  if (
    req.activeUser.identityVerificationRequired === true &&
    req.activeUser.identityVerified !== true &&
    !allowIdentityVerification
  ) {
    return res.status(403).json({
      error: 'Identity verification is required before you can use this account.',
      code: 'IDENTITY_VERIFICATION_REQUIRED'
    });
  }
  return next();
}

export function requiresAddressVerificationForRequest({ path = '', method = 'GET', activeUser = null } = {}) {
  if (!activeUser || activeUser.addressVerified === true) {
    return false;
  }
  const normalizedPath = String(path || '');
  const normalizedMethod = String(method || 'GET').toUpperCase();
  if (normalizedPath === '/api/graphql') {
    return false;
  }
  const isProtectedApiRequest = normalizedPath.startsWith('/api/') || normalizedPath === '/graphql';
  if (!isProtectedApiRequest) {
    return false;
  }
  if (
    normalizedPath === '/api/health' ||
    normalizedPath.startsWith('/api/public/') ||
    normalizedPath === '/api/telemetry' ||
    normalizedPath.startsWith('/api/telemetry/') ||
    normalizedPath === '/api/auth' ||
    normalizedPath.startsWith('/api/auth/') ||
    normalizedPath === '/api/verification' ||
    normalizedPath.startsWith('/api/verification/') ||
    normalizedPath === '/api/address-verification' ||
    normalizedPath.startsWith('/api/address-verification/') ||
    (normalizedMethod === 'GET' && normalizedPath === '/api/pick/me') ||
    normalizedPath === '/api/pick/account-status' ||
    normalizedPath === '/api/pick/account-appeals'
  ) {
    return false;
  }
  return true;
}
