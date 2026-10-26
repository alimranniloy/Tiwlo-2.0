const cleanHost = (value) => String(value || '').trim().toLowerCase().replace(/:\d+$/, '');
const cleanPath = (value) => {
  const path = `/${String(value || '/').split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, '')}`;
  return path === '/' ? '/' : path;
};

function hostForDomain(host, domain) {
  return host === domain || host === `www.${domain}`;
}

export function getSeoMetadata({
  hostname,
  pathname = '/',
  protocol = 'https:',
  platformDomain = 'tiwlo.com',
  freeSubdomainDomain = 'uids.app',
  mailSubdomain = 'mail',
  dashboardUrl = `https://uids.${platformDomain}`,
  authDomain = `auth.${platformDomain}`
}) {
  const host = cleanHost(hostname);
  const path = cleanPath(pathname);
  const mailHost = `${mailSubdomain}.${platformDomain}`;
  let dashboardHost = `uids.${platformDomain}`;
  try {
    dashboardHost = new URL(dashboardUrl).hostname.toLowerCase();
  } catch {
    dashboardHost = `uids.${platformDomain}`;
  }

  const isPlatformHost = hostForDomain(host, platformDomain);
  const isUidsHost = host === freeSubdomainDomain || hostForDomain(host, freeSubdomainDomain);
  const isMailHost = host === mailHost;
  const isDashboardHost = host === dashboardHost;
  const isAuthHost = host === authDomain;

  let page = {
    title: 'Tiwlo | Business Operations, Inventory & POS',
    description: 'Run your business from one workspace. Manage inventory, point of sale, purchasing, customer records, and online selling with Tiwlo.',
    image: '/seo/tiwlo-og.png',
    imageAlt: 'Tiwlo business operations and inventory platform',
    siteName: 'Tiwlo',
    indexable: isPlatformHost && path === '/',
    canonicalHost: platformDomain
  };

  if (isUidsHost) {
    page = {
      title: "UIDS.app | Find Your Project's Home Online",
      description: 'Find a memorable address for your project. Search and claim a uids.app subdomain, then connect your online identity with UIDS.',
      image: '/seo/uids-og.png',
      imageAlt: 'UIDS.app project subdomain discovery',
      siteName: 'UIDS.app',
      indexable: path === '/',
      canonicalHost: freeSubdomainDomain
    };
  } else if (isMailHost || path === '/email' || path.startsWith('/email/') || path === '/mail' || path.startsWith('/mail/')) {
    page = {
      title: 'Tiwlo Mail | Business Email, Organized',
      description: 'A focused email workspace for your business. Manage your Tiwlo mailbox, read and organize conversations, and compose messages in one place.',
      image: '/seo/tiwlo-mail-og.png',
      imageAlt: 'Tiwlo Mail business email workspace',
      siteName: 'Tiwlo Mail',
      indexable: false,
      canonicalHost: isMailHost ? mailHost : platformDomain
    };
  } else if (isDashboardHost || path === '/oneprofile' || path.startsWith('/oneprofile/') || path === '/one-profile' || path.startsWith('/one-profile/')) {
    page = {
      title: 'OneProfile by Tiwlo | Identity Dashboard',
      description: 'Manage your OneProfile identity, connected domains, and profile settings in one place.',
      image: '/seo/oneprofile-og.png',
      imageAlt: 'OneProfile identity and domain dashboard',
      siteName: 'OneProfile',
      indexable: false,
      canonicalHost: isDashboardHost ? dashboardHost : `uids.${platformDomain}`
    };
  } else if (isAuthHost) {
    page = {
      title: 'Tiwlo Account | Sign In & Account Access',
      description: 'Sign in to your Tiwlo account to access your business workspace and connected products.',
      image: '/seo/tiwlo-og.png',
      imageAlt: 'Tiwlo account',
      siteName: 'Tiwlo',
      indexable: false,
      canonicalHost: authDomain
    };
  } else if (path === '/discord' || path.startsWith('/discord/')) {
    page = {
      title: 'Tiwlo Discord Bot Manager | Community Tools',
      description: 'Manage Discord bots, servers, and community automations with Tiwlo Discord Bot Manager.',
      image: '/seo/discord-og.png',
      imageAlt: 'Tiwlo Discord Bot Manager',
      siteName: 'Tiwlo',
      indexable: false,
      canonicalHost: platformDomain
    };
  } else if (path === '/whatsapp-automation' || path.startsWith('/whatsapp-automation/')) {
    page = {
      title: 'Tiwlo WhatsApp Automation | Business Messaging',
      description: 'Manage WhatsApp business messaging automation and connected workflows from your Tiwlo workspace.',
      image: '/seo/whatsapp-og.png',
      imageAlt: 'Tiwlo WhatsApp Automation',
      siteName: 'Tiwlo',
      indexable: false,
      canonicalHost: platformDomain
    };
  } else if (path === '/studio' || path.startsWith('/studio/')) {
    page = {
      title: 'Tiwlo Studio | Music Level & Global Distribution Platform',
      description: 'Your Music. Our Platform. Create, grow, and get your music heard worldwide on 200+ platforms with 100% rights ownership.',
      image: '/seo/tiwlo-studio-og.png',
      imageAlt: 'Tiwlo Studio music distribution and level platform',
      siteName: 'Tiwlo Studio',
      indexable: true,
      canonicalHost: platformDomain
    };
  } else if (path === '/tpanel' || path.startsWith('/tpanel/')) {
    page = {
      title: 'Tiwlo Cloud | Server & Infrastructure Management',
      description: 'Manage cloud resources, domains, and infrastructure settings with Tiwlo Cloud.',
      image: '/seo/tiwlo-cloud-og.png',
      imageAlt: 'Tiwlo Cloud infrastructure management',
      siteName: 'Tiwlo Cloud',
      indexable: false,
      canonicalHost: `tpanel.${platformDomain}`
    };
  } else if (path !== '/') {
    const routeName = (path.split('/').filter(Boolean).at(-1) || 'Page')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
    page = {
      ...page,
      title: `${routeName || 'Page'} | Tiwlo`,
      indexable: false
    };
  }

  const canonicalProtocol = protocol === 'http:' && (host === 'localhost' || host.endsWith('.localhost'))
    ? 'http:'
    : 'https:';
  const canonicalUrl = `${canonicalProtocol}//${page.canonicalHost}${page.indexable ? path : '/'}`;
  const imageUrl = `${canonicalProtocol}//${page.canonicalHost}${page.image}`;
  const robots = page.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
  const structuredData = page.indexable
    ? {
        '@context': 'https://schema.org',
        '@type': page.siteName === 'UIDS.app' ? 'WebSite' : 'Organization',
        name: page.siteName,
        url: canonicalUrl,
        description: page.description,
        ...(page.siteName === 'UIDS.app' ? {} : { logo: `${canonicalProtocol}//${page.canonicalHost}/tiwlo-icon.png` })
      }
    : null;

  return { ...page, canonicalUrl, imageUrl, robots, structuredData };
}
