import { getSeoMetadata } from '../../../shared/seoMetadata.mjs';
import {
  AUTH_DOMAIN,
  DASHBOARD_URL,
  FREE_SUBDOMAIN_DOMAIN,
  MAIL_SUBDOMAIN,
  PLATFORM_DOMAIN
} from '../config/platformConfig';

function setMeta(attribute, key, value) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

export function updateSeoMetadata(hostname = window.location.hostname, pathname = window.location.pathname) {
  const metadata = getSeoMetadata({
    hostname,
    pathname,
    protocol: window.location.protocol,
    platformDomain: PLATFORM_DOMAIN,
    freeSubdomainDomain: FREE_SUBDOMAIN_DOMAIN,
    mailSubdomain: MAIL_SUBDOMAIN,
    dashboardUrl: DASHBOARD_URL,
    authDomain: AUTH_DOMAIN
  });

  document.title = metadata.title;
  setMeta('name', 'description', metadata.description);
  setMeta('name', 'robots', metadata.robots);
  setMeta('name', 'googlebot', metadata.robots);
  setMeta('name', 'application-name', metadata.siteName);
  setMeta('name', 'keywords', `${metadata.siteName}, business software, business workspace`);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', metadata.siteName);
  setMeta('property', 'og:title', metadata.title);
  setMeta('property', 'og:description', metadata.description);
  setMeta('property', 'og:url', metadata.canonicalUrl);
  setMeta('property', 'og:image', metadata.imageUrl);
  setMeta('property', 'og:image:alt', metadata.imageAlt);
  setMeta('property', 'og:image:width', '1200');
  setMeta('property', 'og:image:height', '630');
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', metadata.title);
  setMeta('name', 'twitter:description', metadata.description);
  setMeta('name', 'twitter:image', metadata.imageUrl);
  setMeta('name', 'twitter:image:alt', metadata.imageAlt);

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = metadata.canonicalUrl;

  const existingStructuredData = document.head.querySelector('script[data-tiwlo-seo-schema]');
  if (metadata.structuredData) {
    const structuredData = existingStructuredData || document.createElement('script');
    structuredData.type = 'application/ld+json';
    structuredData.dataset.tiwloSeoSchema = 'true';
    structuredData.textContent = JSON.stringify(metadata.structuredData);
    if (!existingStructuredData) document.head.appendChild(structuredData);
  } else {
    existingStructuredData?.remove();
  }
}
