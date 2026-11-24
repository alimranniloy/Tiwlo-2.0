import express from 'express';
import { MasterDB } from '../db/multiTenant.js';
import { requireRecentReauth as defaultRequireRecentReauth } from '../security/recentReauth.js';
import { isSuperAdminAccount } from './identityRiskGraph.js';
import {
  deleteServerOsImage,
  deleteServerPackage,
  ensureServerPackageSchema,
  getCustomBuilderConfig,
  getServerOsImageById,
  getServerPackagesOverview,
  listServerOsImages,
  listServerPackages,
  updateCustomBuilderConfig,
  upsertServerOsImage,
  upsertServerPackage
} from './serverPackageService.js';

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
      console.error('[Admin Server Package Auth Error]', err.message);
      return res.status(500).json({ error: 'Authentication check failed.' });
    });
  };
}

function handleRouteError(res, err, fallbackMessage) {
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'A record with that identifier already exists.' });
  }
  const status = Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode < 500
    ? err.statusCode
    : 500;
  if (status >= 500) {
    console.error('[Admin Server Package Error]', err?.message || err);
  }
  return res.status(status).json({
    error: status >= 500 ? fallbackMessage : (err?.message || fallbackMessage)
  });
}

export function createAdminServerPackageRouter({
  requireAdmin = createFallbackRequireAdmin(),
  requirePermission = () => (_req, _res, next) => next(),
  requireRecentReauth = defaultRequireRecentReauth
} = {}) {
  const router = express.Router();
  const requireManagePackages = requirePermission('manage_packages_promos');

  // Best-effort idempotent schema bootstrap (falls back gracefully when PG is inactive).
  ensureServerPackageSchema().catch((err) => {
    console.warn('[Admin Server Package Schema Warning]', err?.message || err);
  });

  router.use(requireAdmin, requireManagePackages, (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // GET /api/admin/server-packages
  router.get('/', requireAdmin, async (req, res) => {
    try {
      const [packagesResult, overview, images, customBuilder] = await Promise.all([
        listServerPackages(req.query || {}),
        getServerPackagesOverview(),
        listServerOsImages({ onlyAvailable: req.query?.onlyAvailable === 'true' }),
        getCustomBuilderConfig()
      ]);

      return res.json({
        success: true,
        ...packagesResult,
        overview,
        images,
        customBuilder
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to load server packages overview.');
    }
  });

  // POST /api/admin/server-packages/packages
  router.post('/packages', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const pkg = await upsertServerPackage(req.body || {}, req.adminUser?.id || null);
      return res.status(201).json({
        success: true,
        package: pkg
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to create server package.');
    }
  });

  // PUT /api/admin/server-packages/packages/:id
  router.put('/packages/:id', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const payload = { ...(req.body || {}), id: req.params.id };
      const pkg = await upsertServerPackage(payload, req.adminUser?.id || null);
      return res.json({
        success: true,
        package: pkg
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to update server package.');
    }
  });

  // DELETE /api/admin/server-packages/packages/:id
  router.delete('/packages/:id', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const deleted = await deleteServerPackage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Server package not found.' });
      }
      return res.json({
        success: true,
        deleted: true
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to delete server package.');
    }
  });

  // GET /api/admin/server-packages/images
  router.get('/images', requireAdmin, async (req, res) => {
    try {
      const images = await listServerOsImages({
        onlyAvailable: req.query?.onlyAvailable === 'true'
      });
      return res.json({
        success: true,
        images
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to list OS images.');
    }
  });

  // POST /api/admin/server-packages/images
  router.post('/images', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const image = await upsertServerOsImage(req.body || {}, req.adminUser?.id || null);
      return res.status(201).json({
        success: true,
        image
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to create OS image.');
    }
  });

  // PATCH /api/admin/server-packages/images/:id
  router.patch('/images/:id', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const existing = await getServerOsImageById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'OS image not found.' });
      }
      const image = await upsertServerOsImage(
        { ...(req.body || {}), id: req.params.id },
        req.adminUser?.id || null
      );
      return res.json({
        success: true,
        image
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to update OS image.');
    }
  });

  // DELETE /api/admin/server-packages/images/:id
  router.delete('/images/:id', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const deleted = await deleteServerOsImage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'OS image not found.' });
      }
      return res.json({
        success: true,
        deleted: true
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to delete OS image.');
    }
  });

  // GET /api/admin/server-packages/allocation-analytics
  router.get('/allocation-analytics', requireAdmin, async (_req, res) => {
    try {
      const overview = await getServerPackagesOverview();
      return res.json({
        success: true,
        ...overview
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to compute allocation analytics.');
    }
  });

  // GET /api/admin/server-packages/custom-builder
  router.get('/custom-builder', requireAdmin, async (_req, res) => {
    try {
      const customBuilder = await getCustomBuilderConfig();
      return res.json({
        success: true,
        customBuilder
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to load custom droplet builder configuration.');
    }
  });

  // PATCH /api/admin/server-packages/custom-builder
  router.patch('/custom-builder', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const customBuilder = await updateCustomBuilderConfig(req.body || {}, req.adminUser?.id || null);
      return res.json({
        success: true,
        customBuilder
      });
    } catch (err) {
      return handleRouteError(res, err, 'Failed to update custom droplet builder configuration.');
    }
  });

  return router;
}

export default createAdminServerPackageRouter;
