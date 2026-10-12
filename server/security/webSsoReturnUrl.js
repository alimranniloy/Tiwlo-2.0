export function isAllowedWebSsoReturnUrl(returnTo, { dashboardHost, mailHost }) {
  try {
    const target = new URL(returnTo);
    if (
      target.protocol !== 'https:' ||
      target.username ||
      target.password
    ) {
      return false;
    }

    const hostname = target.hostname.toLowerCase();
    const isDashboardReturn = hostname === dashboardHost.toLowerCase() &&
      /^\/oneprofile(?:\/|$)/i.test(target.pathname);
    const isMailReturn = hostname === mailHost.toLowerCase();
    return isDashboardReturn || isMailReturn;
  } catch {
    return false;
  }
}
