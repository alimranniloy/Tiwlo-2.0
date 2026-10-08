export function hasUnverifiedSsoIdentity(requestBody) {
  return Boolean(requestBody?.isSso);
}

export function getAuthenticatedUserId(req) {
  return req.activeUser?.id || null;
}

export function requireAuthenticatedUser(req, res, next) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.activeUser.isBanned) {
    return res.status(403).json({ error: 'Account disabled' });
  }
  return next();
}
