export function isAllowedWebSsoReturnUrl(returnTo, { dashboardHost, dashboardHosts = [], mailHost, platformHost }) {
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
    const allowedDashboardHosts = [
      ...(typeof dashboardHost === 'string' ? [dashboardHost] : []),
      ...(Array.isArray(dashboardHosts) ? dashboardHosts : [])
    ].map(host => String(host).toLowerCase());
    const isDashboardReturn = allowedDashboardHosts.includes(hostname) &&
      /^\/oneprofile(?:\/|$)/i.test(target.pathname);
    const isMailReturn = typeof mailHost === 'string' &&
      hostname === mailHost.toLowerCase();
    const isPlatformReturn = typeof platformHost === 'string' &&
      hostname === platformHost.toLowerCase() &&
      !/^\/(api|login|signin|create-account|register|signup|auth)(\/|$)/i.test(target.pathname);
    return isDashboardReturn || isMailReturn || isPlatformReturn;
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
