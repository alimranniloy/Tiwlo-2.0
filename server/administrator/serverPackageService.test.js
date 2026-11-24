import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createAdminServerPackageRouter } from './adminServerPackageRoutes.js';
import {
  DEFAULT_SERVER_PACKAGES,
  calculateCustomDropletPrice,
  deleteServerPackage,
  ensureServerPackageSchema,
  getCustomBuilderConfig,
  getServerPackageById,
  getServerPackagesOverview,
  listServerOsImages,
  listServerPackages,
  resetInMemoryServerPackagesForTests,
  resolveEffectivePackageForOrder,
  updateCustomBuilderConfig,
  upsertServerOsImage,
  upsertServerPackage
} from './serverPackageService.js';

async function createPackageTestClient(t, { allowAdmin = true, allowReauth = true } = {}) {
  let adminAuthorized = allowAdmin;
  let reauthAuthorized = allowReauth;

  const requireAdmin = (req, res, next) => {
    if (!adminAuthorized) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required.' });
    }
    req.adminUser = { id: 'admin_pkg_1', email: 'admin@tiwlo.net', role: 'admin' };
    return next();
  };

  const requireRecentReauth = (_req, res, next) => {
    if (!reauthAuthorized) {
      return res.status(428).json({ error: 'RECENT_VERIFICATION_REQUIRED' });
    }
    return next();
  };

  const app = express();
  app.use(express.json());
  app.use('/api/admin/server-packages', createAdminServerPackageRouter({ requireAdmin, requireRecentReauth }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/server-packages`;
  return {
    setAdminAuthorized: (val) => { adminAuthorized = val; },
    setReauthAuthorized: (val) => { reauthAuthorized = val; },
    call: (path, options = {}) => fetch(`${baseUrl}${path}`, options)
  };
}

test.beforeEach(() => {
  resetInMemoryServerPackagesForTests();
});

test.afterEach(() => {
  resetInMemoryServerPackagesForTests();
});

test('ensureServerPackageSchema seeds default packages and DROPLET_IMAGE_CATALOG OS images', async () => {
  const res = await ensureServerPackageSchema();
  assert.equal(res.ok, true);

  const list = await listServerPackages();
  assert.equal(list.total, DEFAULT_SERVER_PACKAGES.length);
  assert.equal(list.packages.length, 6);

  const namesAndPrices = list.packages.map((p) => `${p.name}:${p.monthlyPriceUsd}`);
  assert.deepEqual(namesAndPrices, [
    'Micro:4',
    'Standard:8',
    'Pro:16',
    'Compute:24',
    'Memory:32',
    'Storage NVMe:40'
  ]);

  const allImages = await listServerOsImages({ onlyAvailable: false });
  assert.ok(allImages.length >= 8);

  const availImages = await listServerOsImages({ onlyAvailable: true });
  assert.equal(availImages.length, 1);
  assert.equal(availImages[0].id, 'ubuntu-24');
  assert.equal(availImages[0].available, true);
  assert.equal(availImages[0].monthlySurchargeUsd, 0);

  const customCfg = await getCustomBuilderConfig();
  assert.equal(customCfg.enabled, false);
  assert.equal(customCfg.pricePerVcpuMonthly, 3);
  assert.equal(customCfg.pricePerRamGbMonthly, 2);
  assert.equal(customCfg.pricePerStorageGbMonthly, 0.15);
  assert.equal(customCfg.pricePerBandwidthTbMonthly, 1);
});

test('upsertServerPackage creates, updates, validates bounds, and stores dual displayed vs backend resources', async () => {
  const created = await upsertServerPackage({
    id: 'pkg-enterprise-edge',
    name: 'Enterprise Edge',
    category: 'cpu_optimized',
    monthlyPriceUsd: 49.5,
    displayedVcpus: 8,
    displayedRamGb: 16,
    displayedStorageGb: 320,
    displayedBandwidthTb: 10,
    backendCpuQuotaPct: 400,
    backendRamMb: 8192,
    backendStorageGb: 200,
    burstRamMb: 2048,
    isActive: true,
    sortOrder: 7,
    description: 'High-density edge plan'
  }, 'admin_1');

  assert.equal(created.id, 'pkg-enterprise-edge');
  assert.equal(created.displayedVcpus, 8);
  assert.equal(created.displayedRamGb, 16);
  assert.equal(created.displayedStorageGb, 320);
  assert.equal(created.backendCpuQuotaPct, 400);
  assert.equal(created.backendRamMb, 8192);
  assert.equal(created.backendStorageGb, 200);
  assert.equal(created.burstRamMb, 2048);

  const updated = await upsertServerPackage({
    id: 'pkg-enterprise-edge',
    monthlyPriceUsd: 55,
    isActive: false
  }, 'admin_1');
  assert.equal(updated.monthlyPriceUsd, 55);
  assert.equal(updated.isActive, false);
  assert.equal(updated.name, 'Enterprise Edge');

  const activeOnly = await listServerPackages({ includeInactive: false });
  assert.equal(activeOnly.packages.some((p) => p.id === 'pkg-enterprise-edge'), false);

  const filtered = await listServerPackages({ category: 'cpu_optimized', q: 'enterprise' });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.packages[0].id, 'pkg-enterprise-edge');

  const deleted = await deleteServerPackage('pkg-enterprise-edge');
  assert.equal(deleted, true);
  assert.equal(await getServerPackageById('pkg-enterprise-edge'), null);
  assert.equal(await deleteServerPackage('pkg-enterprise-edge'), false);

  await assert.rejects(
    () => upsertServerPackage({
      name: 'Invalid Price',
      monthlyPriceUsd: -1,
      displayedVcpus: 1,
      displayedRamGb: 1,
      displayedStorageGb: 20,
      backendCpuQuotaPct: 50,
      backendRamMb: 512,
      backendStorageGb: 20
    }),
    /monthlyPriceUsd/i
  );

  await assert.rejects(
    () => upsertServerPackage({
      name: 'Invalid RAM',
      monthlyPriceUsd: 5,
      displayedVcpus: 1,
      displayedRamGb: 0.25,
      displayedStorageGb: 20,
      backendCpuQuotaPct: 50,
      backendRamMb: 512,
      backendStorageGb: 20
    }),
    /displayedRamGb/i
  );

  await assert.rejects(
    () => upsertServerPackage({
      name: 'Invalid Backend RAM',
      monthlyPriceUsd: 5,
      displayedVcpus: 1,
      displayedRamGb: 1,
      displayedStorageGb: 20,
      backendCpuQuotaPct: 50,
      backendRamMb: 64,
      backendStorageGb: 20
    }),
    /backendRamMb/i
  );

  await assert.rejects(
    () => upsertServerPackage({
      name: 'Invalid CPU Quota',
      monthlyPriceUsd: 5,
      displayedVcpus: 1,
      displayedRamGb: 1,
      displayedStorageGb: 20,
      backendCpuQuotaPct: 5,
      backendRamMb: 512,
      backendStorageGb: 20
    }),
    /backendCpuQuotaPct/i
  );
});

test('upsertServerOsImage toggles availability, sets monthly surcharge, and adds custom OS/app images', async () => {
  const enabledDebian = await upsertServerOsImage({
    id: 'debian-12',
    available: true,
    monthlySurchargeUsd: 2.5
  }, 'admin_1');
  assert.equal(enabledDebian.id, 'debian-12');
  assert.equal(enabledDebian.available, true);
  assert.equal(enabledDebian.badge, 'Available');
  assert.equal(enabledDebian.monthlySurchargeUsd, 2.5);

  const customAddon = await upsertServerOsImage({
    id: 'app-coolify',
    name: 'Coolify PaaS',
    os: 'Ubuntu',
    version: '24.04 + Coolify v4',
    type: 'app',
    runtimeImage: 'tiwlo/coolify:latest',
    monthlySurchargeUsd: 5,
    available: true,
    description: 'Pre-installed self-hosted PaaS'
  }, 'admin_1');
  assert.equal(customAddon.id, 'app-coolify');
  assert.equal(customAddon.type, 'app');
  assert.equal(customAddon.monthlySurchargeUsd, 5);

  const avail = await listServerOsImages({ onlyAvailable: true });
  assert.deepEqual(
    avail.map((i) => i.id).sort(),
    ['app-coolify', 'debian-12', 'ubuntu-24']
  );
});

test('getServerPackagesOverview computes accurate dual-resource overcommit analytics', async () => {
  await upsertServerOsImage({ id: 'app-docker', available: true, monthlySurchargeUsd: 3 });

  const overview = await getServerPackagesOverview();
  assert.equal(overview.totalActivePlans, 6);
  assert.equal(overview.availableImagesCount, 2);
  assert.equal(overview.summary.paidAddonImages, 1);

  const microRow = overview.allocationComparison.find((row) => row.id === 'pkg-micro');
  assert.ok(microRow);
  assert.equal(microRow.displayedRamGb, 1);
  assert.equal(microRow.backendRamGb, 0.5); // 512 MB / 1024
  assert.equal(microRow.ramOvercommitRatio, 2);
  assert.equal(microRow.displayedVcpus, 1);
  assert.equal(microRow.backendVcpus, 0.5); // 50% / 100
  assert.equal(microRow.cpuOvercommitRatio, 2);
  assert.equal(microRow.displayedStorageGb, 25);
  assert.equal(microRow.backendStorageGb, 15);
  assert.equal(microRow.storageOvercommitRatio, 1.67);

  // Sum of active plans:
  // vCPUs displayed = 1+2+4+4+4+4 = 19, backend = (50+100+200+300+250+250)/100 = 11.5
  assert.equal(overview.summary.totalDisplayedVcpus, 19);
  assert.equal(overview.summary.totalBackendVcpus, 11.5);
  assert.equal(overview.summary.overallCpuOvercommitRatio, 1.65);

  // RAM displayed = 1+2+4+4+8+8 = 27 GB, backend = (512+1024+2560+3072+6144+6144)/1024 = 19 GB
  assert.equal(overview.summary.totalDisplayedRamGb, 27);
  assert.equal(overview.summary.totalBackendRamGb, 19);
  assert.equal(overview.summary.overallRamOvercommitRatio, 1.42);
});

test('customBuilder toggle ON/OFF, calculateCustomDropletPrice, and resolveEffectivePackageForOrder enforcement', async () => {
  // 1. Standard package resolution
  const microOrder = await resolveEffectivePackageForOrder('pkg-micro');
  assert.deepEqual(microOrder, {
    packageId: 'pkg-micro',
    monthlyPrice: 4,
    displayedVcpus: 1,
    displayedRamGb: 1,
    displayedStorageGb: 25,
    backendCpuQuotaPct: 50,
    backendRamMb: 512,
    backendStorageGb: 15
  });

  // 2. Fallback specs when packageId is missing
  const fallbackOrder = await resolveEffectivePackageForOrder(null, {
    vcpus: 2,
    memory: '4 GB',
    storage: '60 GB NVMe',
    monthlyPrice: 14
  });
  assert.equal(fallbackOrder.packageId, null);
  assert.equal(fallbackOrder.monthlyPrice, 14);
  assert.equal(fallbackOrder.displayedVcpus, 2);
  assert.equal(fallbackOrder.displayedRamGb, 4);
  assert.equal(fallbackOrder.displayedStorageGb, 60);
  assert.equal(fallbackOrder.backendCpuQuotaPct, 100);
  assert.equal(fallbackOrder.backendRamMb, 4096);
  assert.equal(fallbackOrder.backendStorageGb, 60);

  // 3. Custom builder is disabled by default -> resolveEffectivePackageForOrder('custom', ...) must reject with 403
  await assert.rejects(
    () => resolveEffectivePackageForOrder('custom', { vcpus: 2, ramGb: 4, storageGb: 50 }),
    (err) => err.statusCode === 403 && /disabled/i.test(err.message)
  );
  await assert.rejects(
    () => resolveEffectivePackageForOrder({ packageId: 'custom', vcpus: 2, ramGb: 4, storageGb: 50 }),
    (err) => err.statusCode === 403
  );

  // 4. Enable custom builder and customize unit pricing
  const updatedCfg = await updateCustomBuilderConfig({
    enabled: true,
    pricePerVcpuMonthly: 4.0,
    pricePerRamGbMonthly: 2.5,
    pricePerStorageGbMonthly: 0.2,
    pricePerBandwidthTbMonthly: 1.5
  }, 'admin_1');
  assert.equal(updatedCfg.enabled, true);
  assert.equal(updatedCfg.updatedBy, 'admin_1');

  await upsertServerOsImage({ id: 'app-lemp', available: true, monthlySurchargeUsd: 3.5 }, 'admin_1');

  // 2*4.0 (8) + 4*2.5 (10) + 50*0.2 (10) + 2*1.5 (3) + 3.5 = 34.50
  const calc = await calculateCustomDropletPrice({
    vcpus: 2,
    ramGb: 4,
    storageGb: 50,
    bandwidthTb: 2,
    imageId: 'app-lemp'
  });
  assert.equal(calc.enabled, true);
  assert.equal(calc.monthlyPrice, 34.5);
  assert.deepEqual(calc.breakdown, {
    cpuCost: 8,
    ramCost: 10,
    storageCost: 10,
    bandwidthCost: 3,
    imageSurcharge: 3.5
  });

  // 5. Server-verified order resolution for 'custom' ignores tampered client price
  const resolvedCustom = await resolveEffectivePackageForOrder({
    packageId: 'custom',
    vcpus: 2,
    ramGb: 4,
    storageGb: 50,
    bandwidthTb: 2,
    imageId: 'app-lemp',
    monthlyPrice: 0.01
  });
  assert.equal(resolvedCustom.packageId, 'custom');
  assert.equal(resolvedCustom.monthlyPrice, 34.5);
  assert.equal(resolvedCustom.displayedVcpus, 2);
  assert.equal(resolvedCustom.displayedRamGb, 4);
  assert.equal(resolvedCustom.displayedStorageGb, 50);
  assert.equal(resolvedCustom.backendCpuQuotaPct, 100);
  assert.equal(resolvedCustom.backendRamMb, 4096);
  assert.equal(resolvedCustom.backendStorageGb, 50);

  // 6. Out-of-bounds custom spec fails validation
  await assert.rejects(
    () => calculateCustomDropletPrice({ vcpus: 99, ramGb: 4, storageGb: 50 }),
    /vcpus/i
  );
});

test('HTTP routes enforce admin/reauth middleware and support full CRUD + analytics + custom-builder', async (t) => {
  const client = await createPackageTestClient(t);

  // Auth checks
  client.setAdminAuthorized(false);
  const unauthRes = await client.call('/');
  assert.equal(unauthRes.status, 401);
  client.setAdminAuthorized(true);

  client.setReauthAuthorized(false);
  const noReauthRes = await client.call('/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Blocked Without Reauth',
      monthlyPriceUsd: 10,
      displayedVcpus: 2,
      displayedRamGb: 2,
      displayedStorageGb: 40,
      backendCpuQuotaPct: 100,
      backendRamMb: 1024,
      backendStorageGb: 25
    })
  });
  assert.equal(noReauthRes.status, 428);
  client.setReauthAuthorized(true);

  // GET /
  const overviewRes = await client.call('/?page=1&pageSize=3');
  assert.equal(overviewRes.status, 200);
  const overviewBody = await overviewRes.json();
  assert.equal(overviewBody.success, true);
  assert.equal(overviewBody.packages.length, 3);
  assert.equal(overviewBody.total, 6);
  assert.equal(overviewBody.totalPages, 2);
  assert.ok(overviewBody.overview.allocationComparison.length === 6);
  assert.ok(Array.isArray(overviewBody.images));
  assert.equal(overviewBody.customBuilder.enabled, false);

  // POST /packages
  const createRes = await client.call('/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'pkg-burst-nano',
      name: 'Burst Nano',
      category: 'standard',
      monthlyPriceUsd: 3,
      displayedVcpus: 1,
      displayedRamGb: 1,
      displayedStorageGb: 20,
      backendCpuQuotaPct: 40,
      backendRamMb: 384,
      backendStorageGb: 10,
      burstRamMb: 256
    })
  });
  assert.equal(createRes.status, 201);
  const createBody = await createRes.json();
  assert.equal(createBody.success, true);
  assert.equal(createBody.package.id, 'pkg-burst-nano');

  // PUT /packages/:id
  const putRes = await client.call('/packages/pkg-burst-nano', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monthlyPriceUsd: 3.5, backendRamMb: 512 })
  });
  assert.equal(putRes.status, 200);
  const putBody = await putRes.json();
  assert.equal(putBody.package.monthlyPriceUsd, 3.5);
  assert.equal(putBody.package.backendRamMb, 512);

  // DELETE /packages/:id
  const delRes = await client.call('/packages/pkg-burst-nano', { method: 'DELETE' });
  assert.equal(delRes.status, 200);
  const delMissing = await client.call('/packages/pkg-burst-nano', { method: 'DELETE' });
  assert.equal(delMissing.status, 404);

  // GET /images, POST /images, PATCH /images/:id
  const imgsRes = await client.call('/images?onlyAvailable=true');
  assert.equal(imgsRes.status, 200);
  const imgsBody = await imgsRes.json();
  assert.equal(imgsBody.images.length, 1);

  const postImgRes = await client.call('/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'rocky-9',
      name: 'Rocky Linux 9',
      os: 'Rocky',
      version: '9.4 Blue Onyx',
      type: 'os',
      monthlySurchargeUsd: 1.5,
      available: true
    })
  });
  assert.equal(postImgRes.status, 201);
  const postImgBody = await postImgRes.json();
  assert.equal(postImgBody.image.id, 'rocky-9');
  assert.equal(postImgBody.image.monthlySurchargeUsd, 1.5);

  const patchImgRes = await client.call('/images/almalinux-9', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ available: true, monthlySurchargeUsd: 2 })
  });
  assert.equal(patchImgRes.status, 200);
  const patchImgBody = await patchImgRes.json();
  assert.equal(patchImgBody.image.available, true);
  assert.equal(patchImgBody.image.monthlySurchargeUsd, 2);

  const missingImgPatch = await client.call('/images/unknown-os', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ available: true })
  });
  assert.equal(missingImgPatch.status, 404);

  // GET /allocation-analytics
  const analyticsRes = await client.call('/allocation-analytics');
  assert.equal(analyticsRes.status, 200);
  const analyticsBody = await analyticsRes.json();
  assert.equal(analyticsBody.success, true);
  assert.equal(analyticsBody.totalActivePlans, 6);
  assert.equal(analyticsBody.availableImagesCount, 3);

  // GET & PATCH /custom-builder
  const cbGet = await client.call('/custom-builder');
  assert.equal(cbGet.status, 200);
  const cbGetBody = await cbGet.json();
  assert.equal(cbGetBody.customBuilder.enabled, false);

  const cbPatch = await client.call('/custom-builder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true, pricePerVcpuMonthly: 5 })
  });
  assert.equal(cbPatch.status, 200);
  const cbPatchBody = await cbPatch.json();
  assert.equal(cbPatchBody.customBuilder.enabled, true);
  assert.equal(cbPatchBody.customBuilder.pricePerVcpuMonthly, 5);
});

test('resolveEffectivePackageForOrder blocks $0 price manipulation and unknown or inactive package IDs', async () => {
  await assert.rejects(
    () => resolveEffectivePackageForOrder('pkg-does-not-exist'),
    (err) => err.statusCode === 400
  );

  // Manipulated $0 client price in fallback specs is clamped up to positive floor price
  const tamperedFallback = await resolveEffectivePackageForOrder(null, {
    vcpus: 4,
    memory: '8 GB',
    storage: '100 GB NVMe',
    monthlyPrice: 0
  });
  assert.ok(tamperedFallback.monthlyPrice >= 16);
});
