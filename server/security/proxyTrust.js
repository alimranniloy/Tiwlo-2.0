export function configureTrustedProxy(app, configured = process.env.TRUSTED_PROXY_CIDRS) {
  // Trust addresses of actual reverse proxies, not an arbitrary hop count.
  // Public clients reaching Node directly cannot supply their own rate-limit IP.
  const trusted = (configured || 'loopback').split(',').map(value => value.trim()).filter(Boolean);
  app.set('trust proxy', trusted);
}
