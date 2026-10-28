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
