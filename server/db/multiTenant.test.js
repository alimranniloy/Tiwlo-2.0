import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'multiTenant.js')).href;

async function importFreshModule(label) {
  return import(`${moduleUrl}?${label}-${Date.now()}-${Math.random()}`);
}

test('tenant stores and store registry survive a module restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-tenant-store-'));
  const previousDataDir = process.env.TIWLO_DATA_DIR;
  process.env.TIWLO_DATA_DIR = dataDir;
  try {
    const firstRun = await importFreshModule('first');
    firstRun.TenantDB.saveStoreDb('TIW-TEST-1', {
      tiwiId: 'TIW-TEST-1',
      storeName: 'Test Store',
      products: [{ id: 'product-1', name: 'Live product' }],
      sales: [{ id: 'sale-1', totalAmount: 23, paymentStatus: 'paid' }]
    });
    const master = firstRun.MasterDB.getMasterData();
    master.stores.push({
      id: 'store-test-1',
      tiwiId: 'TIW-TEST-1',
      ownerId: 'user-test-1',
      storeName: 'Test Store',
      currency: 'USD ($)'
    });
    firstRun.MasterDB.saveMasterData(master);
    const restarted = await importFreshModule('restarted');
    const recoveredStore = restarted.TenantDB.getAllStoreData()[0];
    assert.deepEqual(recoveredStore.products, [{ id: 'product-1', name: 'Live product' }]);
    assert.equal(recoveredStore.ownerId, 'user-test-1');
    assert.deepEqual(recoveredStore.sales, [{ id: 'sale-1', totalAmount: 23, paymentStatus: 'paid' }]);
  } finally {
    if (previousDataDir === undefined) delete process.env.TIWLO_DATA_DIR;
    else process.env.TIWLO_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('legacy primary tenant JSON is migrated to durable tenant storage', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-tenant-legacy-'));
  const previousDataDir = process.env.TIWLO_DATA_DIR;
  process.env.TIWLO_DATA_DIR = dataDir;
  try {
    fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify([{ id: 'legacy-product' }]));
    fs.writeFileSync(path.join(dataDir, 'sales.json'), JSON.stringify([{ id: 'legacy-sale' }]));

    const { TenantDB } = await importFreshModule('legacy');
    const migrated = TenantDB.getStoreDb('TIW-PRIMARY');
    assert.equal(migrated.products[0].id, 'legacy-product');
    assert.equal(migrated.sales[0].id, 'legacy-sale');
    assert.equal(fs.existsSync(TenantDB.getStoreFilePath('TIW-PRIMARY')), true);
  } finally {
    if (previousDataDir === undefined) delete process.env.TIWLO_DATA_DIR;
    else process.env.TIWLO_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('corrupt persisted tenant JSON fails instead of appearing as an empty store', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-tenant-corrupt-'));
  const previousDataDir = process.env.TIWLO_DATA_DIR;
  process.env.TIWLO_DATA_DIR = dataDir;
  try {
    const { TenantDB } = await importFreshModule('corrupt');
    const storePath = TenantDB.getStoreFilePath('TIW-TEST-CORRUPT');
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, '{invalid');
    assert.throws(
      () => TenantDB.getStoreDb('TIW-TEST-CORRUPT'),
      /invalid JSON/
    );
  } finally {
    if (previousDataDir === undefined) delete process.env.TIWLO_DATA_DIR;
    else process.env.TIWLO_DATA_DIR = previousDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
