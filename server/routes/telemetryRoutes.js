import express from 'express';
import rateLimit from 'express-rate-limit';
import { recordVisitorHeartbeat } from '../analytics/liveVisitorService.js';
import { extractRequestClientIp } from '../administrator/staffSecurityService.js';
import { getRateLimitStore } from '../security/optionalSecurity.js';

function parseTelemetryBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return null;
    }
  }
  return {};
}

function sanitizeCountryHeader(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().slice(0, 64);
  if (!cleaned || cleaned.toUpperCase() === 'XX') return null;
  return cleaned;
}

export function createTelemetryRouter({
  recordHeartbeat = recordVisitorHeartbeat,
  rateLimitStore = getRateLimitStore('tiwlo:telemetry')
} = {}) {
  const router = express.Router();

  const heartbeatLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    ...(rateLimitStore ? { store: rateLimitStore } : {}),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many telemetry updates. Slow down slightly.' }
  });

  // Support text/plain payloads sent via navigator.sendBeacon
  router.use(express.text({ type: 'text/plain', limit: '8kb' }));

  const handleHeartbeat = async (req, res) => {
    try {
      const body = parseTelemetryBody(req);
      if (!body) {
        return res.status(400).json({ error: 'Invalid telemetry payload.' });
      }

      const visitorId = typeof body.visitorId === 'string' ? body.visitorId.trim() : '';
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!visitorId || visitorId.length > 128 || !sessionId || sessionId.length > 128) {
        return res.status(400).json({ error: 'Valid visitorId and sessionId are required.' });
      }
      if (body.path !== undefined && (typeof body.path !== 'string' || body.path.length > 1024)) {
        return res.status(400).json({ error: 'Invalid telemetry path.' });
      }

      const ip = extractRequestClientIp(req) || req.ip || null;
      const userAgent = req.get?.('user-agent') || req.headers?.['user-agent'] || '';
      const country = sanitizeCountryHeader(
        req.get?.('cf-ipcountry') ||
        req.get?.('x-vercel-ip-country') ||
        req.get?.('x-country-code') ||
        body.country
      );

      const user = req.activeUser?.id
        ? {
            id: req.activeUser.id,
            name: req.activeUser.name || req.activeUser.storeName || null,
            storeName: req.activeUser.storeName || null,
            email: req.activeUser.email || null
          }
        : null;

      await recordHeartbeat({
        visitorId,
        sessionId,
        path: body.path || '/',
        title: typeof body.title === 'string' ? body.title : null,
        tiwiId: typeof body.tiwiId === 'string' ? body.tiwiId : '',
        productId: typeof body.productId === 'string' ? body.productId : null,
        productName: typeof body.productName === 'string' ? body.productName : null,
        referrer: typeof body.referrer === 'string' ? body.referrer : null,
        dwellDeltaSeconds: body.dwellDeltaSeconds,
        isPageTransition: body.isPageTransition === true,
        eventKind: typeof body.eventKind === 'string' ? body.eventKind : undefined,
        targetLabel: typeof body.targetLabel === 'string' ? body.targetLabel : null,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
        user,
        ip,
        userAgent,
        country
      });

      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof TypeError || error?.statusCode === 400) {
        return res.status(400).json({ error: error.message || 'Invalid telemetry event.' });
      }
      console.error('[Telemetry Heartbeat Error]', error?.message || error);
      return res.status(503).json({ error: 'Telemetry temporarily unavailable.' });
    }
  };

  router.post('/visitor/heartbeat', heartbeatLimiter, handleHeartbeat);
  router.post('/telemetry/visitor/heartbeat', heartbeatLimiter, handleHeartbeat);

  return router;
}

export default createTelemetryRouter();
