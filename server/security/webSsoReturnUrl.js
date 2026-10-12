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
    const isDashboardReturn = typeof dashboardHost === 'string' &&
      hostname === dashboardHost.toLowerCase() &&
      /^\/oneprofile(?:\/|$)/i.test(target.pathname);
    const isMailReturn = typeof mailHost === 'string' &&
      hostname === mailHost.toLowerCase();
    return isDashboardReturn || isMailReturn;
  } catch {
    return false;
  }
}

export function getDashboardSsoBridgeUrl(returnTo, { dashboardUrl, dashboardHost, mailHost }) {
  if (!isAllowedWebSsoReturnUrl(returnTo, { dashboardHost, mailHost })) return null;

  const target = new URL(returnTo);
  if (target.hostname.toLowerCase() !== mailHost.toLowerCase()) return null;

  const dashboard = new URL(dashboardUrl);
  if (
    dashboard.protocol !== 'https:' ||
    dashboard.hostname.toLowerCase() !== dashboardHost.toLowerCase() ||
    dashboard.username ||
    dashboard.password
  ) {
    return null;
  }

  dashboard.pathname = '/oneprofile';
  dashboard.search = '';
  dashboard.hash = '';
  dashboard.searchParams.set('web_sso_return_to', target.toString());
  return dashboard.toString();
}
