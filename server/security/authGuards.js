export function hasUnverifiedSsoIdentity(requestBody) {
  return Boolean(requestBody?.isSso);
}

export function getAuthenticatedUserId(req) {
  return req.activeUser?.id || null;
}
