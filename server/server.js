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
import { PLATFORM_CONFIG, getSubdomain } from './config/platformConfig.js';

import { ensureCertificates } from './scripts/generate-cert.js';
import { testPgConnection } from './db/postgres.js';
import { streamStoredMedia } from './db/mediaStorage.js';
import { MasterDB } from './db/multiTenant.js';
import { tenantContext } from './db/storeDataAdapter.js';
import { createGraphQLMiddleware } from './graphql/index.js';
import { InputSanitizer } from './security/cryptoSecurity.js';

// Modular Feature Routers
import cloudRoutes from './routes/cloudRoutes.js';
import securityRoutes from './security/securityRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import { findActiveCustomDomain } from './domains/domainService.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;
const HTTP_PORT = Number.parseInt(process.env.HTTP_PORT || String(Number(PORT) + 1), 10);

// ==========================================
// 1. ENTERPRISE SECURITY HEADERS (HELMET)
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
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
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Security firewall rate limit reached. Please try again shortly.' }
});
app.use('/api', apiLimiter);

app.use(cookieParser());

const allowedOrigins = [
  `https://${PLATFORM_CONFIG.primaryDomain}`,
  `https://${getSubdomain(PLATFORM_CONFIG.wwwSubdomain)}`,
  `https://${getSubdomain(PLATFORM_CONFIG.authSubdomain)}`,
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
    if (allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      if ([PLATFORM_CONFIG.primaryDomain, PLATFORM_CONFIG.storeDomain].some(
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

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.post('/internal/email/inbound', express.raw({
  type: 'message/rfc822',
  limit: '26mb'
}), async (req, res) => {
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress !== '127.0.0.1' && remoteAddress !== '::1' && remoteAddress !== '::ffff:127.0.0.1') {
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
    let token = req.cookies?.tiwlo_session ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null) ||
      req.headers?.['x-session-token'];

    if (token && token !== '[object Object]') {
      const sessionData = await MasterDB.getSession(token, req);
      if (sessionData?.user) {
        req.activeUser = sessionData.user;
        if (sessionData.user.isBanned &&
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
      }
    }

  } catch (e) {}
  next();
});

// Bind every request to the authenticated user's tenant. Data-access helpers
// use this context when a route does not pass tiwiId explicitly.
app.use((req, res, next) => {
  tenantContext.run({ tiwiId: req.activeUser?.tiwiId || req.activeUser?.storeId || null }, next);
});

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
const staticMediaOptions = {
  acceptRanges: true,
  etag: true,
  maxAge: '30d',
  setHeaders: (res, filePath) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    const extension = path.extname(filePath).toLowerCase();
    const videoMimeTypes = {
      '.mp4': 'video/mp4',
      '.m4v': 'video/x-m4v',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
    };
    if (videoMimeTypes[extension]) {
      res.setHeader('Content-Type', videoMimeTypes[extension]);
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  },
};
app.use(['/uploads', '/api/uploads', '/upload', '/api/upload'], streamStoredMedia);
app.use('/uploads', express.static(UPLOADS_DIR, staticMediaOptions));
app.use('/api/uploads', express.static(UPLOADS_DIR, staticMediaOptions));

const ROOT_UPLOAD_DIR = path.resolve(__dirname, '../upload');
if (!fs.existsSync(ROOT_UPLOAD_DIR)) {
  fs.mkdirSync(ROOT_UPLOAD_DIR, { recursive: true });
}
app.use('/upload', express.static(ROOT_UPLOAD_DIR, staticMediaOptions));
app.use('/api/upload', express.static(ROOT_UPLOAD_DIR, staticMediaOptions));

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

// Authentication, 2FA, Profiles & SSO Handshake (Mounted first to handle public login/register/check endpoints)
app.use('/api', authRoutes);
app.use('/api/domains', domainRoutes);

// Cloud & Droplets
app.use('/api/cloud', cloudRoutes);

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
app.use('/api/plugins', pluginManager.getRouter());
app.get('/api/plugins-list', (req, res) => {
  res.json({ success: true, plugins: pluginManager.getRegisteredPlugins() });
});

// ==========================================
// 5. STATIC WEB CLIENT & SPA FALLBACK
// ==========================================
const PUBLIC_DIR = path.join(__dirname, 'public');
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

const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/graphql') || req.path.includes('.')) {
      return next();
    }
    const indexPath = path.join(CLIENT_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ==========================================
// 6. SERVER BOOTSTRAP
// ==========================================
async function startServer() {
  const postgresReady = await testPgConnection();
  if (!postgresReady && process.env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL is required in production; refusing to start with volatile data fallbacks.');
  }
  if (postgresReady) {
    const { bootstrapGoogleDriveServiceAccountFromEnv } = await import('./administrator/googleDriveStorage.js');
    await bootstrapGoogleDriveServiceAccountFromEnv();
    const { resumeStorageSyncOnStartup } = await import('./db/mediaMigration.js');
    await resumeStorageSyncOnStartup();
  }
  WhatsAppManager.init().catch(err => console.warn('⚠️ WhatsApp Manager init notice:', err.message));
  await SocialDB.hydrateFromPg().catch(err => console.warn('⚠️ SocialDB PostgreSQL hydration notice:', err.message));
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
    httpsServer.listen(PORT, () => {
      console.log(`🔒 Tiwlo StockPro Secure HTTPS Server running on https://localhost:${PORT}`);
    });

    const httpServer = http.createServer(app);
    httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
      console.log(`🌐 Tiwlo local HTTP Server (loopback only) running on http://127.0.0.1:${HTTP_PORT}`);
    });
  } else {
    app.listen(PORT, () => {
      console.log(`StockPro Backend Server running on http://localhost:${PORT}`);
    });
    const inboundHttpServer = http.createServer(app);
    inboundHttpServer.listen(HTTP_PORT, '127.0.0.1', () => {
      console.log(`Tiwlo local mail-delivery endpoint listening on 127.0.0.1:${HTTP_PORT}`);
    });
  }
}

startServer();
