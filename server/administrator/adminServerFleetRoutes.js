import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import { requireRecentReauth as defaultRequireRecentReauth } from '../security/recentReauth.js';
import { isSuperAdminAccount } from './identityRiskGraph.js';
import {
  PANEL_BLUEPRINTS,
  bulkImportServerNodes,
  createServerNode,
  deleteServerNode,
  ensureServerFleetSchema,
  getFleetLiveStatus,
  getNodeConnectivityLogs,
  getServerNodeById,
  listServerNodes,
  probeFleetBatch,
  probeServerConnectivity,
  updateServerNode
} from './serverFleetService.js';

function createFallbackRequireAdmin() {
  return function fallbackRequireAdmin(req, res, next) {
    const token = req.cookies?.tiwlo_host_session ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.substring(7)
        : null) ||
      req.headers?.['x-session-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }

    MasterDB.getSession(token, req).then((sessionData) => {
      if (!sessionData || !sessionData.user) {
        return res.status(401).json({ error: 'Session expired or invalid.' });
      }
      const user = sessionData.user;
      if (user.isBanned || (!isSuperAdminAccount(user) && user.role !== 'admin')) {
        return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
      }
      req.adminUser = user;
      return next();
    }).catch((err) => {
      console.error('[Admin Server Fleet Auth Error]', err.message);
      return res.status(500).json({ error: 'Authentication check failed.' });
    });
  };
}

function handleRouteError(res, err, fallbackMessage) {
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'A server node with that identifier already exists.' });
  }
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
    ? err.statusCode
    : 500;
  if (status >= 500) {
    console.error('[Admin Server Fleet Error]', err?.message || err);
  }
  return res.status(status).json({
    error: status >= 500 ? fallbackMessage : (err?.message || fallbackMessage)
  });
}

export function createAdminServerFleetRouter({
  requireAdmin = createFallbackRequireAdmin(),
  requireRecentReauth = defaultRequireRecentReauth
} = {}) {
  const router = express.Router();

  // Best-effort idempotent schema bootstrap (falls back gracefully when PG is inactive).
  ensureServerFleetSchema().catch((err) => {
    console.warn('[Admin Server Fleet Schema Warning]', err?.message || err);
  });

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // GET /api/admin/fleet/blueprints
  router.get('/blueprints', requireAdmin, (_req, res) => {
    return res.json({
      success: true,
      blueprints: PANEL_BLUEPRINTS
    });
  });

  // GET /api/admin/fleet/live-status
  router.get('/live-status', requireAdmin, async (_req, res) => {
    try {
      const liveStatus = await getFleetLiveStatus();
      return res.json({
        success: true,
        ...liveStatus
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to load fleet live connectivity status.');
    }
  });

  // GET /api/admin/fleet/nodes
  router.get('/nodes', requireAdmin, async (req, res) => {
    try {
      const result = await listServerNodes(req.query || {});
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to list server fleet nodes.');
    }
  });

  // POST /api/admin/fleet/nodes
  router.post('/nodes', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const node = await createServerNode(req.body || {}, req.adminUser?.id || null);
      return res.status(201).json({
        success: true,
        node
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to create server node.');
    }
  });

  // POST /api/admin/fleet/nodes/bulk
  router.post('/nodes/bulk', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const payload = typeof req.body === 'string'
        ? req.body
        : typeof req.body?.csv === 'string'
          ? req.body.csv
          : (req.body?.nodes ?? req.body?.items ?? req.body);

      const result = await bulkImportServerNodes(payload, req.adminUser?.id || null);
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to bulk import server nodes.');
    }
  });

  // PATCH /api/admin/fleet/nodes/:id
  router.patch('/nodes/:id', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const node = await updateServerNode(req.params.id, req.body || {}, req.adminUser?.id || null);
      if (!node) {
        return res.status(404).json({ error: 'Server node not found.' });
      }
      return res.json({
        success: true,
        node
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to update server node.');
    }
  });

  // DELETE /api/admin/fleet/nodes/:id
  router.delete('/nodes/:id', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const deleted = await deleteServerNode(req.params.id, req.adminUser?.id || null);
      if (!deleted) {
        return res.status(404).json({ error: 'Server node not found.' });
      }
      return res.json({
        success: true,
        deleted: true
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to delete server node.');
    }
  });

  // POST /api/admin/fleet/nodes/:id/probe
  router.post('/nodes/:id/probe', requireAdmin, async (req, res) => {
    try {
      const result = await probeServerConnectivity(req.params.id, req.adminUser?.id || null);
      if (!result) {
        return res.status(404).json({ error: 'Server node not found.' });
      }
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to probe server connectivity.');
    }
  });

  // POST /api/admin/fleet/probe-batch
  router.post('/probe-batch', requireAdmin, async (req, res) => {
    try {
      const result = await probeFleetBatch(req.body || {}, req.adminUser?.id || null);
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to run batch fleet connectivity probe.');
    }
  });

  // GET /api/admin/fleet/nodes/:id/logs
  router.get('/nodes/:id/logs', requireAdmin, async (req, res) => {
    try {
      const node = await getServerNodeById(req.params.id);
      if (!node) {
        return res.status(404).json({ error: 'Server node not found.' });
      }
      const logs = await getNodeConnectivityLogs(req.params.id, req.query?.limit);
      return res.json({
        success: true,
        logs
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to load node connectivity logs.');
    }
  });

  return router;
}

export default createAdminServerFleetRouter;
