import './config/loadRootEnv.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { configureTrustedProxy } from './security/proxyTrust.js';
import { PLATFORM_CONFIG, getSubdomain } from './config/platformConfig.js';
import { getSeoMetadata } from '../shared/seoMetadata.mjs';

import { ensureCertificates } from './scripts/generate-cert.js';
import { testPgConnection } from './db/postgres.js';
import { BillingDB } from './db/billing.js';
import { streamStoredMedia } from './db/mediaStorage.js';
import { MasterDB } from './db/multiTenant.js';
import { resolveActiveStore, resolveStorefrontHost, tenantContext } from './db/storeDataAdapter.js';
import { createGraphQLMiddleware } from './graphql/index.js';
import { createApplicationGraphQL, protectAsyncRouter } from './graphql/applicationApi.js';
import { InputSanitizer } from './security/cryptoSecurity.js';
import {
  getRateLimitStore,
  initializeOptionalSecurity,
  optionalSecurityMiddleware
} from './security/optionalSecurity.js';

// Modular Feature Routers
import cloudRoutes from './routes/cloudRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import securityRoutes from './security/securityRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import subdomainRoutes from './routes/subdomainRoutes.js';
import { findActiveCustomDomain } from './domains/domainService.js';
import pickRoutes, { initializePickSchema } from '../pick/index.js';

import socialRoutes, { resumePendingVideoProcessing } from './social/socialRoutes.js';
import { SocialDB } from './social/socialDb.js';
import ecosystemRoutes from './social/ecosystemRoutes.js';
import chatRoutes from './social/chatRoutes.js';
import adminRoutes from './administrator/adminRoutes.js';
import whatsappRoutes from './whatsapp/whatsappRoutes.js';
import { WhatsAppManager } from './whatsapp/whatsappManager.js';
import tpanelRoutes from '../service/TPanel/server/tpanelRoutes.js';
import supportRoutes from './support/ai/supportRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import { readInboundDeliveryToken, storeInboundMail } from './email/inboundMail.js';

// Modular Plugins & Add-Ons Architecture (Rule 6)
import pluginManager from './plugins/index.js';
import tpanelPlugin from './plugins/tpanel/index.js';
import whatsappPlugin from './plugins/whatsapp/index.js';
import supportAiPlugin from './plugins/support-ai/index.js';
import securityPlugin from './plugins/security/index.js';
import discordPlugin from './plugins/discord/index.js';
import discordRoutes from './discord/discordRoutes.js';
import { DiscordDB } from './discord/discordDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
configureTrustedProxy(app);
const PORT = process.env.PORT || 5000;
const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT || String(Number(PORT) + 1), 10);
const LISTEN_ADDRESS = process.env.TIWLO_BIND_ADDRESS ||
  (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
await initializeOptionalSecurity();
const apiRateLimitStore = getRateLimitStore('tiwlo:api');

// ==========================================
// 1. ENTERPRISE SECURITY HEADERS (HELMET)
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      frameSrc: ["'self'", "https://maps.google.com", "https://www.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'", ...PLATFORM_CONFIG.managedDomains.flatMap(domain => [`https://${domain}`, `https://*.${domain}`])],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));

// ==========================================
// 2. RATE LIMITING & CORS
// ==========================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  ...(apiRateLimitStore ? { store: apiRateLimitStore } : {}),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Security firewall rate limit reached. Please try again shortly.' }
});
app.use(['/api', '/graphql'], apiLimiter);

app.use(cookieParser());

const allowedOrigins = [
  `https://${PLATFORM_CONFIG.primaryDomain}`,
  `https://${getSubdomain(PLATFORM_CONFIG.wwwSubdomain)}`,
  `https://${getSubdomain(PLATFORM_CONFIG.authSubdomain)}`,
  `https://${PLATFORM_CONFIG.freeSubdomainDomain}`,
  `https://${PLATFORM_CONFIG.dashboardHost}`,
  `https://${getSubdomain(PLATFORM_CONFIG.tpanelSubdomain)}`,
  `https://${getSubdomain(PLATFORM_CONFIG.driveSubdomain)}`,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  `http://${PLATFORM_CONFIG.authSubdomain}.localhost:5173`,
  `http://${PLATFORM_CONFIG.authSubdomain}.localhost:3000`,
  `http://${PLATFORM_CONFIG.authSubdomain}.localhost:5000`,
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
];

app.use(cors({
  origin: async function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === 'null') return callback(null, false);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      if (PLATFORM_CONFIG.managedDomains.some(
        domain => hostname === domain || hostname.endsWith(`.${domain}`)
      )) {
        return callback(null, true);
      }
      if (await findActiveCustomDomain(hostname)) return callback(null, true);
    } catch (error) {
      return callback(error);
    }
    if (/^https?:\/\/([a-zA-Z0-9-]+\.)*(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS request blocked: Origin not authorized by Tiwlo Security Policy.'));
  },
  credentials: true
}));

app.use(express.json({
  limit: '5mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl?.split('?')[0] === '/api/public/payments/stripe/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
    if (req.originalUrl?.split('?')[0] === '/api/cloud/billing/credits/stripe/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 500 }));

app.post('/internal/email/inbound', express.raw({
  type: 'message/rfc822',
  limit: '26mb'
}), async (req, res) => {
  const remoteAddress = req.socket.remoteAddress;
  const trustedDeliveryAddress = String(process.env.TIWLO_INBOUND_TRUSTED_IP || '').trim();
  if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' &&
      remoteAddress !== '::ffff:127.0.0.1' &&
      (!trustedDeliveryAddress || remoteAddress !== trustedDeliveryAddress &&
        remoteAddress !== `::ffff:${trustedDeliveryAddress}`)) {
    return res.sendStatus(403);
  }
  const expectedToken = readInboundDeliveryToken();
  const suppliedToken = String(req.headers['x-tiwlo-internal'] || '');
  const expectedBuffer = Buffer.from(expectedToken);
  const suppliedBuffer = Buffer.from(suppliedToken);
  if (!expectedBuffer.length || expectedBuffer.length !== suppliedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return res.sendStatus(expectedBuffer.length ? 403 : 503);
  }
  if (!Buffer.isBuffer(req.body)) return res.status(400).send('Expected RFC822 message body.');
  try {
    const result = await storeInboundMail(req.body, req.headers['x-tiwlo-recipient']);
    return res.status(202).json({ success: true, duplicate: result.duplicate });
  } catch (error) {
    console.error('[Tiwi Mail Inbound] Delivery failed:', error.message);
    if (error.code === 'MAILBOX_QUOTA_EXCEEDED') {
      return res.status(452).send('Mailbox storage quota exceeded.');
    }
    return res.status(error instanceof TypeError ? 422 : 503).send('Inbound mail could not be stored.');
  }
});

// Global Input Sanitization & Anti-Injection Middleware
app.use((req, res, next) => {
  if (req.body) req.body = InputSanitizer.sanitize(req.body);
  if (req.query) req.query = InputSanitizer.sanitize(req.query);
  next();
});

// Active User Resolution & Real-time Account Ban Enforcement
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.cookies?.tiwlo_host_session ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null) ||
      req.headers?.['x-session-token'];

    if (token && token !== '[object Object]') {
      const sessionData = await MasterDB.getSession(token, req);
      if (sessionData?.user) {
        req.activeUser = sessionData.user;
        const isPickAccountStatusRequest = req.path === '/api/pick/me' ||
          req.path === '/api/pick/account-status' ||
          req.path === '/api/pick/account-appeals' ||
          req.path === '/api/pick/auth/logout';
        if (sessionData.user.isBanned &&
            !isPickAccountStatusRequest &&
            !req.path.startsWith('/api/auth/disabled') &&
            !req.path.startsWith('/api/auth/appeal') &&
            !req.path.startsWith('/api/auth/session') &&
            !req.path.startsWith('/api/auth/logout')) {
          return res.status(403).json({
            error: 'ACCOUNT_DISABLED',
            banned: true,
            reason: sessionData.user.banReason || 'Account suspended for policy violations',
            redirectUrl: '/account-disabled'
          });
        }
        const isProtectedApiRequest = req.path.startsWith('/api/') || req.path === '/graphql';
        const isIdentityVerificationRequest = req.path === '/api/verification' ||
          req.path.startsWith('/api/verification/');
        const isAuthRequest = req.path === '/api/auth' || req.path.startsWith('/api/auth/');
        const isAddressVerificationRequest = req.path === '/api/address-verification' ||
          req.path.startsWith('/api/address-verification/');
        const isPickProfileBootstrap = req.method === 'GET' && req.path === '/api/pick/me';
        const isPickAccountStatusPath = req.path === '/api/pick/account-status' ||
          req.path === '/api/pick/account-appeals';
        const isAdminApiRequest = req.path === '/api/admin' ||
          req.path.startsWith('/api/admin/') ||
          req.path === '/api/pick/admin' ||
          req.path.startsWith('/api/pick/admin/');
        if (
          req.path !== '/api/graphql' &&
          isProtectedApiRequest &&
          sessionData.user.identityVerificationRequired === true &&
          sessionData.user.identityVerified !== true &&
          !isIdentityVerificationRequest &&
          !isAddressVerificationRequest &&
          !isPickProfileBootstrap &&
          !isPickAccountStatusPath &&
          !isAdminApiRequest &&
          !isAuthRequest
        ) {
          return res.status(403).json({
            error: 'Identity verification is required before you can use this account.',
            code: 'IDENTITY_VERIFICATION_REQUIRED',
            redirectUrl: '/identity-required'
          });
        }
        if (
          req.path !== '/api/graphql' &&
          isProtectedApiRequest &&
          !isAuthRequest &&
          !isAddressVerificationRequest &&
          !isPickProfileBootstrap &&
          !isPickAccountStatusPath &&
          !isAdminApiRequest &&
          sessionData.user.authMethod === 'pick_credentials' &&
          sessionData.user.addressVerified !== true
        ) {
          return res.status(403).json({
            error: 'Address verification is required before you can use this account.',
            code: 'ADDRESS_VERIFICATION_REQUIRED',
            redirectUrl: '/address-verification'
          });
        }
      }
    }

  } catch (e) {
    return next(e);
  }
  return next();
});

// A selected tenant is accepted only after checking it belongs to the
// authenticated account; the cookie itself is not an authorization claim.
app.use(async (req, res, next) => {
  try {
    const selectedTiwiId = req.cookies?.tiwlo_active_store;
    if (selectedTiwiId && req.activeUser) {
      req.activeStore = await resolveActiveStore(req, selectedTiwiId);
      if (!req.activeStore) {
        res.clearCookie('tiwlo_active_store', { path: '/', sameSite: 'lax', secure: req.secure || process.env.NODE_ENV === 'production' });
      }
    }
    tenantContext.run({
      tiwiId: req.activeStore?.tiwiId || req.activeUser?.tiwiId || req.activeUser?.storeId || null
    }, next);
  } catch (error) {
    next(error);
  }
});

// Record suspicious automation and authenticated dashboard write activity
// after session resolution so administrators can review durable security events.
app.use(optionalSecurityMiddleware);

// Enterprise GraphQL Endpoint
app.use('/graphql', createGraphQLMiddleware());

// Graceful JSON parse error handling
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload received' });
  }
  next(err);
});

// ==========================================
// 3. STATIC FILE STORAGE
// ==========================================
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use(['/uploads', '/api/uploads', '/upload', '/api/upload'], streamStoredMedia);

const ROOT_UPLOAD_DIR = path.resolve(__dirname, '../upload');
if (!fs.existsSync(ROOT_UPLOAD_DIR)) {
  fs.mkdirSync(ROOT_UPLOAD_DIR, { recursive: true });
}
// Video Streaming for Landing Page Hero
app.get(['/api/landing/hero-video', '/landing/hero-bg.mp4'], (req, res) => {
  const possiblePaths = [
    path.join(__dirname, 'public/landing/hero-bg.mp4'),
    path.join(__dirname, '../client/dist/landing/hero-bg.mp4'),
    path.join(__dirname, '../client/public/landing/hero-bg.mp4')
  ];
  const videoPath = possiblePaths.find(p => fs.existsSync(p));

  if (!videoPath) {
    return res.status(404).send('Hero video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// ==========================================
// 4. MOUNT MODULAR API ROUTERS
// ==========================================
// Tiwi Social Ecosystem (Mobile & Web)
const applicationRoutes = [
  ['/api/social', socialRoutes], ['/api/tiwi', socialRoutes],
  ['/api/social', ecosystemRoutes], ['/api/tiwi', ecosystemRoutes],
  ['/api/social/chat', chatRoutes], ['/api/tiwi/chat', chatRoutes],
  ['/api/admin', adminRoutes], ['/api/whatsapp', whatsappRoutes],
  ['/api/subdomains', subdomainRoutes],
  ['/api/plugins/tpanel', tpanelRoutes], ['/api/plugins/whatsapp', whatsappRoutes],
  ['/api/plugins/support-ai', supportRoutes],
  ['/api/tpanel', tpanelRoutes], ['/api/support', supportRoutes],
  ['/api/email', emailRoutes], ['/api/mail', emailRoutes],
  ['/api/plugins/discord', discordRoutes], ['/api/discord', discordRoutes], ['/api', authRoutes],
  ['/api/pick', pickRoutes],
  ['/api/domains', domainRoutes], ['/api/cloud', cloudRoutes],
  ['/api/verification', verificationRoutes],
  ['/api', securityRoutes], ['/api', systemRoutes], ['/api', storeRoutes]
];
applicationRoutes.forEach(([, router]) => protectAsyncRouter(router));
let applicationGraphQL;
app.post('/api/graphql', (req, res, next) => {
  applicationGraphQL ||= createApplicationGraphQL([
    ...applicationRoutes,
    ['', { handle: app._router.handle.bind(app._router), stack: app._router.stack.filter(layer => layer.route && typeof layer.route.path === 'string' && layer.route.path.startsWith('/api/')) }]
  ]);
  return applicationGraphQL(req, res).catch(next);
});

app.use('/api/social', socialRoutes);
app.use('/api/tiwi', socialRoutes);
app.use('/api/social', ecosystemRoutes);
app.use('/api/tiwi', ecosystemRoutes);
app.use('/api/social/chat', chatRoutes);
app.use('/api/tiwi/chat', chatRoutes);

// Tiwlo Administrator Platform
app.use('/api/admin', adminRoutes);

// WhatsApp Automation Gateway
app.use('/api/whatsapp', whatsappRoutes);

// TPanel Control Panel Service
app.use('/api/tpanel', tpanelRoutes);

// Tiwi Live Support & AI Assistance
app.use('/api/support', supportRoutes);

// Tiwi Outlook Email Gateway (Web & API)
app.use('/api/email', emailRoutes);
app.use('/api/mail', emailRoutes);

// Discord Bot & Community Manager Gateway
app.use('/api/discord', discordRoutes);
app.use('/api/pick', pickRoutes);

// Authentication, 2FA, Profiles & SSO Handshake (Mounted first to handle public login/register/check endpoints)
app.use('/api', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/subdomains', subdomainRoutes);

// Cloud & Droplets
app.use('/api/cloud', cloudRoutes);
app.use('/api/verification', verificationRoutes);

// Security, Verification & Media Pipelines
app.use('/api', securityRoutes);

// System & Diagnostics
app.use('/api', systemRoutes);

// Store, Products, Inventory, Orders & POS
app.use('/api', storeRoutes);

// Modular Plugin Registry & Add-ons Endpoints (Rule 6)
await pluginManager.registerPlugin(tpanelPlugin);
await pluginManager.registerPlugin(whatsappPlugin);
await pluginManager.registerPlugin(supportAiPlugin);
await pluginManager.registerPlugin(securityPlugin);
await pluginManager.registerPlugin(discordPlugin);
app.use('/api/plugins', pluginManager.getRouter());
app.get('/api/plugins-list', (req, res) => {
  res.json({ success: true, plugins: pluginManager.getRegisteredPlugins() });
});

// ==========================================
// 5. STATIC WEB CLIENT & SPA FALLBACK
// ==========================================
const PUBLIC_DIR = path.join(__dirname, 'public');

const requestHost = (req) => String(req.hostname || '').toLowerCase().replace(/:\d+$/, '');
const isHost = (host, domain) => host === domain || host === `www.${domain}`;

app.get('/robots.txt', (req, res) => {
  const host = requestHost(req);
  const isPublicPlatform = isHost(host, PLATFORM_CONFIG.primaryDomain);
  const isPublicUids = host === PLATFORM_CONFIG.freeSubdomainDomain
    || isHost(host, PLATFORM_CONFIG.freeSubdomainDomain);
  if (isPublicPlatform || isPublicUids) {
    const sitemapHost = isPublicUids ? PLATFORM_CONFIG.freeSubdomainDomain : PLATFORM_CONFIG.primaryDomain;
    return res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: https://${sitemapHost}/sitemap.xml\n`);
  }
  res.type('text/plain').send('User-agent: *\nAllow: /\n');
});

app.get('/sitemap.xml', (req, res) => {
  const host = requestHost(req);
  const isPublicPlatform = isHost(host, PLATFORM_CONFIG.primaryDomain);
  const isPublicUids = host === PLATFORM_CONFIG.freeSubdomainDomain
    || isHost(host, PLATFORM_CONFIG.freeSubdomainDomain);
  if (!isPublicPlatform && !isPublicUids) return res.sendStatus(404);

  const canonicalHost = isPublicUids ? PLATFORM_CONFIG.freeSubdomainDomain : PLATFORM_CONFIG.primaryDomain;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${canonicalHost}/</loc></url></urlset>`;
  res.type('application/xml').send(sitemap);
});

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

app.get('/favicon.ico', (req, res) => {
  const icoPath = path.join(PUBLIC_DIR, 'favicon.ico');
  if (fs.existsSync(icoPath)) {
    return res.sendFile(icoPath);
  }
  res.status(204).end();
});

app.get('/', async (req, res, next) => {
  const host = requestHost(req);
  const freeBase = PLATFORM_CONFIG.freeSubdomainDomain;
  if (!freeBase || !host.endsWith(`.${freeBase}`) || host === `www.${freeBase}`) {
    return next();
  }
  try {
    const { rows } = await queryPg(
      `SELECT d.id, d.subdomain, d.domain, d.status, d.created_at,
              u.name, u.store_name, u.avatar,
              p.headline, p.bio, p.profile_visibility,
              w.title AS site_title, w.template_id
       FROM system_free_subdomains d
       JOIN system_users u ON u.id = d.user_id
       LEFT JOIN system_oneprofile_profiles p ON p.user_id = d.user_id
       LEFT JOIN system_oneprofile_websites w ON w.user_id = d.user_id AND w.domain = d.domain
       WHERE d.domain = $1 AND d.status = 'active'
       LIMIT 1`,
      [host]
    );
    const sub = rows[0];
    const escapeHtml = (str) => String(str || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    if (!sub) {
      const safeHost = escapeHtml(host);
      const safeBase = escapeHtml(freeBase);
      res.vary('Host');
      return res.status(404).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeHost} — Not Available</title><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#fafafa;color:#09090b;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}.card{max-width:420px;width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:28px;box-shadow:0 1px 2px rgba(0,0,0,.04)}.top{display:flex;align-items:center;justify-content:space-between;gap:8px}.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;border:1px solid #e4e4e7;background:#fafafa;color:#52525b;font-size:11px;font-weight:500}.dot{width:6px;height:6px;border-radius:999px;background:#71717a}.tls{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#71717a}.host{margin-top:20px;display:inline-flex;align-items:center;padding:6px 12px;border-radius:8px;border:1px solid #e4e4e7;background:#f4f4f5;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:500;color:#18181b;word-break:break-all}h1{margin:16px 0 8px;font-size:18px;font-weight:600;letter-spacing:-0.015em;color:#09090b}p{margin:0;color:#71717a;font-size:13.5px;line-height:1.6}.sep{height:1px;background:#e4e4e7;margin:22px 0 18px}a.btn{display:inline-flex;width:100%;align-items:center;justify-content:center;padding:10px 16px;border-radius:8px;background:#09090b;color:#fafafa;text-decoration:none;font-size:12.5px;font-weight:500;transition:background .15s}a.btn:hover{background:#27272a}</style></head><body><main class="card"><div class="top"><span class="badge"><span class="dot"></span>Unavailable</span><span class="tls">TLS &bull; Active</span></div><div class="host">${safeHost}</div><h1>It's not available for right now</h1><p>This subdomain is not currently active or assigned to any service.</p><div class="sep"></div><a class="btn" href="https://${safeBase}">Return to ${safeBase}</a></main></body></html>`);
    }
    await queryPg(
      `UPDATE system_oneprofile_websites SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP WHERE domain = $1`,
      [host]
    ).catch(() => {});
    const displayName = escapeHtml(sub.site_title || sub.name || sub.store_name || sub.subdomain);
    const headline = escapeHtml(sub.headline || `Official ${sub.domain} digital identity & edge endpoint`);
    const bio = escapeHtml(sub.bio || `This subdomain is active, secured with automatic TLS, and served by ${freeBase} authoritative DNS.`);
    res.vary('Host');
    return res.status(200).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${displayName} — ${escapeHtml(sub.domain)}</title><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}.card{max-width:540px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:28px;padding:40px;box-shadow:0 8px 30px rgba(15,23,42,.05)}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;flex-wrap:wrap}.domain{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;color:#0f172a;background:#f1f5f9;padding:6px 14px;border-radius:999px}.status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#047857;background:#ecfdf5;padding:6px 12px;border-radius:999px}.dot{width:8px;height:8px;border-radius:50%;background:#10b981}h1{margin:0 0 8px;font-size:28px;font-weight:800;letter-spacing:-0.02em}h2{margin:0 0 16px;font-size:15px;font-weight:600;color:#475569}p{margin:0 0 28px;font-size:14px;line-height:1.7;color:#64748b}.footer{display:flex;align-items:center;justify-content:space-between;padding-top:20px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;flex-wrap:wrap;gap:12px}a.manage{color:#0f172a;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:999px;border:1px solid #e2e8f0}a.manage:hover{background:#f8fafc}</style></head><body><main class="card"><div class="top"><span class="domain">${escapeHtml(sub.domain)}</span><span class="status"><span class="dot"></span>Active &amp; Verified SSL</span></div><h1>${displayName}</h1><h2>${headline}</h2><p>${bio}</p><div class="footer"><span>Powered by <strong>${escapeHtml(freeBase)}</strong></span><a class="manage" href="https://${escapeHtml(freeBase)}/oneprofile/subdomains">Manage Subdomain &amp; DNS →</a></div></main></body></html>`);
  } catch (err) {
    return next(err);
  }
});

const PICK_LANDING_DIST = path.join(__dirname, '../pick/landing-page/out');
const pickStaticMiddleware = fs.existsSync(PICK_LANDING_DIST)
  ? express.static(PICK_LANDING_DIST, { index: false })
  : null;

if (pickStaticMiddleware) {
  app.use((req, res, next) => {
    const host = requestHost(req);
    if (host !== PLATFORM_CONFIG.pickDashboardHost) {
      return next();
    }
    if (req.path.startsWith('/api') || req.path.startsWith('/graphql')) {
      return next();
    }
    res.vary('Host');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https: http:; connect-src 'self' https: http: ws: wss:; object-src 'none'; base-uri 'self'; form-action 'self' https:; frame-ancestors 'none'"
    );
    return pickStaticMiddleware(req, res, () => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      const cleanRoute = req.path.replace(/^\/+|\/+$/g, '').toLowerCase();
      const routeMap = {
        '': 'index.html',
        'dashboard': 'dashboard.html',
        'workspace': 'dashboard.html',
        'login': 'login.html',
        'signup': 'signup.html',
        'create-account': 'signup.html'
      };
      const targetFile = routeMap[cleanRoute] || (!cleanRoute.includes('.') ? 'index.html' : null);
      if (targetFile) {
        const resolvedPath = path.join(PICK_LANDING_DIST, targetFile);
        if (fs.existsSync(resolvedPath)) {
          return res.type('html').sendFile(resolvedPath);
        }
      }
      return next();
    });
  });
}

const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/graphql') || req.path.includes('.') || !req.accepts('html')) {
      return next();
    }
    const indexPath = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      try {
        const requestHostname = requestHost(req);
        const customStore = !PLATFORM_CONFIG.managedDomains.some(domain =>
          requestHostname === domain || requestHostname.endsWith(`.${domain}`)
        ) ? await resolveStorefrontHost(requestHostname) : null;
        const metadata = getSeoMetadata({
          hostname: requestHostname,
          pathname: req.path,
          protocol: req.protocol,
          platformDomain: PLATFORM_CONFIG.primaryDomain,
          freeSubdomainDomain: PLATFORM_CONFIG.freeSubdomainDomain,
          mailSubdomain: PLATFORM_CONFIG.mailSubdomain,
          dashboardUrl: PLATFORM_CONFIG.dashboardUrl,
          authDomain: PLATFORM_CONFIG.authDomain,
          storeName: customStore?.storeName,
          customDomain: Boolean(customStore)
        });
        let html = fs.readFileSync(indexPath, 'utf8');
        const metaTags = [
          ['name', 'description', metadata.description],
          ['name', 'robots', metadata.robots],
          ['name', 'googlebot', metadata.robots],
          ['name', 'application-name', metadata.siteName],
          ['name', 'keywords', `${metadata.siteName}, business software, business workspace`],
          ['property', 'og:type', 'website'],
          ['property', 'og:site_name', metadata.siteName],
          ['property', 'og:title', metadata.title],
          ['property', 'og:description', metadata.description],
          ['property', 'og:url', metadata.canonicalUrl],
          ['property', 'og:image', metadata.imageUrl],
          ['property', 'og:image:alt', metadata.imageAlt],
          ['property', 'og:image:width', '1200'],
          ['property', 'og:image:height', '630'],
          ['name', 'twitter:card', 'summary_large_image'],
          ['name', 'twitter:title', metadata.title],
          ['name', 'twitter:description', metadata.description],
          ['name', 'twitter:image', metadata.imageUrl],
          ['name', 'twitter:image:alt', metadata.imageAlt]
        ].map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}">`).join('\n    ');
        const schema = metadata.structuredData
          ? `<script type="application/ld+json">${JSON.stringify(metadata.structuredData).replaceAll('<', '\\u003c')}</script>`
          : '';
        html = html
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${metadata.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</title>`)
          .replace(/<meta\s+(?:name|property)="(?:description|robots|googlebot|application-name|keywords|og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, '')
          .replace(/<link\s+rel="canonical"[^>]*>\s*/i, '')
          .replace(/<\/head>/i, `    <link rel="canonical" href="${metadata.canonicalUrl}">\n    ${metaTags}\n    ${schema}\n  </head>`);
        res.vary('Host');
        return res.type('html').send(html);
      } catch (error) {
        return next(error);
      }
    }
    next();
  });
  app.use(express.static(CLIENT_DIST));
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error' });
});

// ==========================================
// 6. SERVER BOOTSTRAP & RESILIENCE GUARDS
// ==========================================
let serverStarted = false;

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  if (!serverStarted) {
    process.exit(1);
  }
});

async function waitForPostgres(maxAttempts = 5, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await testPgConnection()) {
      return true;
    }
    if (attempt < maxAttempts) {
      console.warn(`⚠️ Waiting for PostgreSQL (${attempt}/${maxAttempts})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

async function startServer() {
  const postgresReady = await waitForPostgres();
  if (!postgresReady) {
    throw new Error('PostgreSQL is required; refusing to start without persistent storage.');
  }
  const { runMigration } = await import('./db/migrate.js');
  await runMigration();
  await initializePickSchema();
  BillingDB.startPendingTopupExpiry();
  if (postgresReady) {
    const { bootstrapGoogleDriveServiceAccountFromEnv } = await import('./administrator/googleDriveStorage.js');
    await bootstrapGoogleDriveServiceAccountFromEnv();
    const { resumeStorageSyncOnStartup } = await import('./db/mediaMigration.js');
    await resumeStorageSyncOnStartup();
  }
  WhatsAppManager.init().catch(err => console.warn('⚠️ WhatsApp Manager init notice:', err.message));
  await SocialDB.hydrateFromPg();
  await DiscordDB.init().catch(err => console.warn('⚠️ DiscordDB init notice:', err.message));
  if (postgresReady) {
    const pendingVideos = await resumePendingVideoProcessing();
    if (pendingVideos > 0) {
      console.log(`[VideoProcessor] Resumed ${pendingVideos} pending media review job(s).`);
    }
  }

  let httpsOptions = null;
  try {
    const certs = await ensureCertificates();
    httpsOptions = {
      key: certs.key,
      cert: certs.cert
    };
  } catch (certErr) {
    console.warn('⚠️ Could not initialize SSL certificates:', certErr.message);
  }

  if (httpsOptions) {
    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(PORT, LISTEN_ADDRESS, () => {
      console.log(`🔒 Tiwlo StockPro Secure HTTPS Server running on https://${LISTEN_ADDRESS}:${PORT}`);
    });

    const httpServer = http.createServer(app);
    httpServer.listen(HTTP_PORT, LISTEN_ADDRESS, () => {
      console.log(`🌐 Tiwlo internal HTTP Server running on http://${LISTEN_ADDRESS}:${HTTP_PORT}`);
    });
  } else {
    app.listen(PORT, LISTEN_ADDRESS, () => {
      console.log(`StockPro Backend Server running on http://${LISTEN_ADDRESS}:${PORT}`);
    });
    const inboundHttpServer = http.createServer(app);
    inboundHttpServer.listen(HTTP_PORT, LISTEN_ADDRESS, () => {
      console.log(`Tiwlo local mail-delivery endpoint listening on ${LISTEN_ADDRESS}:${HTTP_PORT}`);
    });
  }
  serverStarted = true;
}

startServer().catch((err) => {
  console.error('❌ Fatal server startup failure:', err);
  process.exit(1);
});
