/**
 * Tiwlo Enterprise Automated SSL Manager
 *
 * Provisions platform certificates and verified custom-domain certificates.
 * Customer domains must pass the authenticated DNS verification flow before
 * this module is called.
 */

import { execSync, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SSL_CONFIG = {
  EMAIL: PLATFORM_CONFIG.sslEmail,
  PRIMARY_DOMAIN: PLATFORM_CONFIG.primaryDomain,
  DOMAINS: [
    ...PLATFORM_CONFIG.managedDomains.flatMap(domain => [domain, `*.${domain}`]),
    getSubdomain(PLATFORM_CONFIG.wwwSubdomain),
    getSubdomain(PLATFORM_CONFIG.authSubdomain),
    getSubdomain(PLATFORM_CONFIG.tpanelSubdomain),
    getSubdomain(PLATFORM_CONFIG.dns1Subdomain),
    getSubdomain(PLATFORM_CONFIG.dns2Subdomain),
    getSubdomain(PLATFORM_CONFIG.mailSubdomain),
    getSubdomain(PLATFORM_CONFIG.mtaSubdomain),
    getSubdomain(PLATFORM_CONFIG.driveSubdomain)
  ],
  CERTBOT_WEBROOT: '/var/www/certbot',
  NGINX_CONF: '/etc/nginx/sites-available/tiwlo',
  RENEWAL_HOOK_PATH: '/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh'
};

function getCertificatePaths(domain) {
  const candidates = [
    `/etc/letsencrypt/live/${domain}/fullchain.pem`,
    `/etc/letsencrypt/live/${domain}-0001/fullchain.pem`
  ];

  for (const certificatePath of candidates) {
    const keyPath = certificatePath.replace('/fullchain.pem', '/privkey.pem');
    if (fs.existsSync(certificatePath) && fs.existsSync(keyPath)) {
      return { certificatePath, keyPath };
    }
  }

  return null;
}

/**
 * Ensure Certbot, Nginx, and ACME challenge directories are ready
 */
export function ensurePrerequisites() {
  console.log('🔍 Checking SSL prerequisites...');

  if (process.platform === 'win32') {
    console.log('ℹ️ Running in Windows environment. Remote VPS deployment will execute on Linux.');
    return;
  }

  // 1. Ensure certbot webroot directory exists
  if (!fs.existsSync(SSL_CONFIG.CERTBOT_WEBROOT)) {
    fs.mkdirSync(SSL_CONFIG.CERTBOT_WEBROOT, { recursive: true });
    execSync(`chmod -R 755 ${SSL_CONFIG.CERTBOT_WEBROOT}`);
    console.log(`📁 Created ACME webroot directory: ${SSL_CONFIG.CERTBOT_WEBROOT}`);
  }

  // 2. Ensure Certbot is installed
  try {
    execSync('certbot --version', { stdio: 'ignore' });
    console.log('✅ Certbot is installed.');
  } catch (err) {
    console.log('📦 Installing Certbot & Python3 Nginx plugin...');
    execSync('DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx', { stdio: 'inherit' });
  }

  // 3. Setup Auto-Renewal Deploy Hook
  try {
    const hookDir = path.dirname(SSL_CONFIG.RENEWAL_HOOK_PATH);
    if (!fs.existsSync(hookDir)) {
      fs.mkdirSync(hookDir, { recursive: true });
    }
    const hookScript = '#!/bin/sh\nsystemctl reload nginx\n';
    fs.writeFileSync(SSL_CONFIG.RENEWAL_HOOK_PATH, hookScript, { mode: 0o755 });
    console.log('✅ Certbot auto-renewal reload hook installed at:', SSL_CONFIG.RENEWAL_HOOK_PATH);
  } catch (hookErr) {
    console.warn('⚠️ Could not write renewal hook:', hookErr.message);
  }

  // 4. Ensure systemd certbot timer is running
  try {
    execSync('systemctl enable certbot.timer && systemctl start certbot.timer', { stdio: 'ignore' });
    console.log('✅ Systemd Certbot auto-renewal timer enabled.');
  } catch (e) {}
}

/**
 * Generate full Nginx configuration supporting both HTTP and HTTPS with HTTP/2 and ACME challenges
 */
export function generateNginxConfig(primaryDomain = SSL_CONFIG.PRIMARY_DOMAIN) {
  const primaryCertificate = getCertificatePaths(primaryDomain);
  const certPath = primaryCertificate?.certificatePath;
  const keyPath = primaryCertificate?.keyPath;
  const hasSsl = Boolean(primaryCertificate);
  const dedicatedDomains = PLATFORM_CONFIG.managedDomains
    .filter(domain => domain !== primaryDomain && getCertificatePaths(domain))
    .map(domain => ({ domain, certificate: getCertificatePaths(domain) }));
  const primaryServerNames = [...new Set([
    ...SSL_CONFIG.DOMAINS,
    PLATFORM_CONFIG.serverIpv4
  ])].filter(name => !dedicatedDomains.some(
    ({ domain }) => name === domain || name === `*.${domain}`
  ));
  console.log(`Checking SSL certificate for ${primaryDomain}: ${hasSsl ? 'FOUND' : 'NOT FOUND (Using HTTP-only)'}`);

  const commonLocations = `
    # Static React Web Client
    location / {
        root /var/www/tiwlo/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # GraphQL Proxy
    location /graphql {
        proxy_pass http://127.0.0.1:5001/graphql;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # PostgreSQL-first media serving; Express falls back to legacy disk files.
    location /upload/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }
  `;
  const dedicatedHttpsServers = dedicatedDomains.map(({ domain, certificate }) => `

# ========================================================
# HTTPS Server (${domain})
# ========================================================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${domain};

    ssl_certificate ${certificate.certificatePath};
    ssl_certificate_key ${certificate.keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    client_max_body_size 100M;

    location /.well-known/acme-challenge/ {
        root ${SSL_CONFIG.CERTBOT_WEBROOT};
        allow all;
    }

    ${commonLocations}
}
`).join('');

  if (hasSsl) {
    return `
# ========================================================
# HTTP Server (Port 80) -> ACME Challenges & HTTPS Redirect
# ========================================================
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${primaryServerNames.join(' ')} _;

    client_max_body_size 100M;

    # ACME Challenge for Automated Zero-Touch SSL
    location /.well-known/acme-challenge/ {
        root ${SSL_CONFIG.CERTBOT_WEBROOT};
        allow all;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# ========================================================
# HTTPS Server (Port 443) -> Full Wildcard SSL (*.${SSL_CONFIG.PRIMARY_DOMAIN})
# ========================================================
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name ${primaryServerNames.join(' ')} _;

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;

    client_max_body_size 100M;

    # ACME Challenge also available over HTTPS
    location /.well-known/acme-challenge/ {
        root ${SSL_CONFIG.CERTBOT_WEBROOT};
        allow all;
    }

    ${commonLocations}
}
${dedicatedHttpsServers}
`;
  }

  // Fallback HTTP configuration
  return `
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${primaryServerNames.join(' ')} _;

    client_max_body_size 100M;

    location /.well-known/acme-challenge/ {
        root ${SSL_CONFIG.CERTBOT_WEBROOT};
        allow all;
    }

    ${commonLocations}
}
`;
}

/**
 * Apply Nginx configuration and reload
 */
export function applyNginxConfig() {
  if (process.platform === 'win32') return;

  const confContent = generateNginxConfig();
  fs.writeFileSync(SSL_CONFIG.NGINX_CONF, confContent, 'utf8');

  execSync('nginx -t && systemctl reload nginx', { stdio: 'inherit' });
  console.log('✅ Nginx configuration reloaded successfully with Wildcard SSL.');
}

/**
 * Provision SSL for a newly connected customer custom domain
 */
export function provisionCustomDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  const cleanDomain = domain.toLowerCase().trim();

  // Keep filesystem paths and Nginx identifiers derived only from validated DNS names.
  const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!DOMAIN_REGEX.test(cleanDomain) || cleanDomain.length > 253) {
    throw new Error('Invalid domain format for certificate provisioning.');
  }

  console.log(`🔒 Checking SSL provisioning for domain: ${cleanDomain}...`);

  // Configured platform/store subdomains are covered by wildcard SSL.
  if (PLATFORM_CONFIG.managedDomains.some(
    domain => cleanDomain === domain || cleanDomain.endsWith(`.${domain}`)
  )) {
    console.log(`✅ ${cleanDomain} is covered by the configured platform/store wildcard certificate.`);
    return true;
  }

  if (process.env.SSL_PROVIDER === 'caddy') return true;
  if (process.env.SSL_PROVIDER !== 'nginx') return false;
  if (process.platform === 'win32') return false;

  const sitesAvailable = '/etc/nginx/sites-available';
  const sitesEnabled = '/etc/nginx/sites-enabled';
  const vhostPath = path.join(sitesAvailable, `tiwlo-custom-${cleanDomain}`);
  const vhostEnabled = path.join(sitesEnabled, `tiwlo-custom-${cleanDomain}`);
  const httpConfig = `
server {
    listen 80;
    server_name ${cleanDomain};
    location /.well-known/acme-challenge/ {
        root ${SSL_CONFIG.CERTBOT_WEBROOT};
        allow all;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}
`;

  const httpsConfig = `
server {
    listen 443 ssl http2;
    server_name ${cleanDomain};
    ssl_certificate /etc/letsencrypt/live/${cleanDomain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${cleanDomain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    client_max_body_size 100M;

    location /.well-known/acme-challenge/ {
        root ${SSL_CONFIG.CERTBOT_WEBROOT};
        allow all;
    }

    location / {
        root /var/www/tiwlo/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${Number.parseInt(process.env.HTTP_PORT || String(Number(process.env.PORT || 5000) + 1), 10)}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;

  if (!fs.existsSync(sitesAvailable) || !fs.existsSync(sitesEnabled)) {
    throw new Error('Nginx site configuration directories are unavailable.');
  }

  fs.writeFileSync(vhostPath, httpConfig, { encoding: 'utf8', mode: 0o644 });
  if (!fs.existsSync(vhostEnabled)) fs.symlinkSync(vhostPath, vhostEnabled);
  execFileSync('nginx', ['-t'], { stdio: 'inherit' });
  execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'inherit' });

  execFileSync('certbot', [
    'certonly',
    '--webroot',
    '-w', SSL_CONFIG.CERTBOT_WEBROOT,
    '-d', cleanDomain,
    '--non-interactive',
    '--agree-tos',
    '--email', SSL_CONFIG.EMAIL,
    '--keep-until-expiring'
  ], { stdio: 'inherit' });

  fs.writeFileSync(vhostPath, httpsConfig, { encoding: 'utf8', mode: 0o644 });
  execFileSync('nginx', ['-t'], { stdio: 'inherit' });
  execFileSync('systemctl', ['reload', 'nginx'], { stdio: 'inherit' });
  console.log(`🎉 Custom domain SSL active for: ${cleanDomain}`);
  return true;
}
