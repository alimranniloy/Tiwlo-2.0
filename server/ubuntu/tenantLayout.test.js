import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUPS_BASE_DIR,
  SHARED_UBUNTU_RUNTIME_IMAGE,
  TENANTS_BASE_DIR,
  buildTenantBlueprint,
  listUbuntuTenants,
  migrateUbuntuTenantNode,
  registerUbuntuTenant,
  resetInMemoryUbuntuTenantsForTests,
  sanitizeTenantSlug
} from './tenantLayout.js';

test('sanitizeTenantSlug enforces safe non-traversal tenant identifiers', () => {
  assert.equal(sanitizeTenantSlug('TIW-1042'), 'tiw_1042');
  assert.equal(sanitizeTenantSlug('  Shop One! '), 'shop_one');
  assert.throws(() => sanitizeTenantSlug('../etc/passwd'));
  assert.throws(() => sanitizeTenantSlug('a'));
});

test('buildTenantBlueprint keeps data under /srv/tiwlo-tenants and uses one shared runtime image', () => {
  const bp = buildTenantBlueprint({
    userId: 'usr_abc123',
    tiwiId: 'TIW-9001',
    nodeId: 'ubuntu-node-1',
    cpuQuotaPercent: 50,
    ramLimitMb: 512,
    storageLimitGb: 5
  });

  assert.equal(bp.sharedImage, SHARED_UBUNTU_RUNTIME_IMAGE);
  assert.equal(bp.rootPath, `${TENANTS_BASE_DIR}/tiw_9001`);
  assert.equal(bp.backupPath, `${BACKUPS_BASE_DIR}/tiw_9001`);
  assert.equal(bp.ubuntuUser, 'tw_tiw_9001');
  assert.equal(bp.dbName, 'cust_tiw_9001');
  assert.equal(bp.dbRole, 'role_tiw_9001');
});

test('registerUbuntuTenant and migrateUbuntuTenantNode track node movement cleanly', async () => {
  resetInMemoryUbuntuTenantsForTests();

  const created = await registerUbuntuTenant({
    userId: 'usr_move_1',
    tiwiId: 'TIW-2001',
    nodeId: 'ubuntu-node-1',
    ramLimitMb: 1024,
    storageLimitGb: 10
  });

  assert.equal(created.nodeId, 'ubuntu-node-1');
  assert.equal((await listUbuntuTenants({ nodeId: 'ubuntu-node-1' })).length, 1);

  const migrated = await migrateUbuntuTenantNode({
    tenantId: created.tenantId,
    targetNodeId: 'ubuntu-node-2'
  });

  assert.equal(migrated.nodeId, 'ubuntu-node-2');
  assert.equal(migrated.migratedFromNodeId, 'ubuntu-node-1');
  assert.equal((await listUbuntuTenants({ nodeId: 'ubuntu-node-1' })).length, 0);
  assert.equal((await listUbuntuTenants({ nodeId: 'ubuntu-node-2' })).length, 1);
});
