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

export function getWebSsoBridgeUrl(returnTo, { platformUrl, dashboardHost, mailHost }) {
  if (!isAllowedWebSsoReturnUrl(returnTo, { dashboardHost, mailHost })) return null;

  const target = new URL(returnTo);
  if (target.hostname.toLowerCase() !== mailHost.toLowerCase()) return null;

  const platform = new URL(platformUrl);
  if (
    platform.protocol !== 'https:' ||
    platform.username ||
    platform.password ||
    !mailHost.toLowerCase().endsWith(`.${platform.hostname.toLowerCase()}`)
  ) {
    return null;
  }

  platform.pathname = '/';
  platform.search = '';
  platform.hash = '';
  platform.searchParams.set('web_sso_return_to', target.toString());
  return platform.toString();
}
