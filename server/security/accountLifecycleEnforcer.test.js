import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import {
  HOLD_TYPES,
  ensureAccountLifecycleSchema,
  enforceUserAccountHold,
  getInMemoryAccountLifecycleStateForTests,
  getUserAccountHold,
  resetInMemoryAccountLifecycleForTests,
  restoreUserAccountServices,
  runPermanentBanPurgeSweep,
  seedInMemoryAccountServicesForTests
} from './accountLifecycleEnforcer.js';
import {
  allocateDropletIpv6,
  ensureIpv6PoolSchema,
  getInMemoryIpv6StateForTests,
  listDropletIpAllocations,
  resetInMemoryIpv6PoolForTests,
  upsertInMemoryDropletForTests
} from '../ubuntu/ipv6PoolService.js';

function createBaseDate(iso = '2026-11-01T00:00:00.000Z') {
  return new Date(iso);
}

test('NID review hold & temp ban immediately pause all 4 services, hold exact IPs, and keep paid period non_refundable', async () => {
  resetInMemoryAccountLifecycleForTests();
  resetInMemoryIpv6PoolForTests();

  const userId = 'usr_nid_1';
  const dropletId = 'drp_nid_1';
  const tenantId = 'ubt_nid_1';
  const nodeId = 'ubuntu-dhk-1';
  const now = createBaseDate('2026-11-01T10:00:00.000Z');
  const vpsPeriodEnd = '2026-11-20T10:00:00.000Z';
  const waPeriodEnd = '2026-11-18T10:00:00.000Z';
  const dcPeriodEnd = '2026-11-25T10:00:00.000Z';
  const storePeriodEnd = '2026-11-22T10:00:00.000Z';

  upsertInMemoryDropletForTests({
    id: dropletId,
    userId,
    nodeId,
    name: 'prod-vps-1',
    sshPort: 22101,
    accessUsername: 'root'
  });
  const allocated = await allocateDropletIpv6({
    nodeId,
    dropletId,
    preferredPrefix: '2001:db8:cafe:1::/64',
    userId,
    sshPort: 22101
  });

  seedInMemoryAccountServicesForTests({
    userId,
    nodes: [{ id: nodeId, activeDroplets: 1 }],
    tenants: [{ tenantId, userId, nodeId, status: 'active' }],
    droplets: [{
      id: dropletId,
      userId,
      tenantId,
      nodeId,
      name: 'prod-vps-1',
      status: 'active',
      monthlyPrice: 12,
      nextBillingAt: vpsPeriodEnd,
      sshPort: 22101
    }],
    stores: [{
      tiwiId: 'TIW-1001',
      ownerId: userId,
      storeName: 'Nid Store',
      planId: 'pro',
      status: 'active',
      expiresAt: storePeriodEnd
    }],
    storeSubscriptions: [{
      tiwiId: 'TIW-1001',
      ownerId: userId,
      planId: 'pro',
      planName: 'Pro Store',
      price: 19,
      status: 'active',
      expiresAt: storePeriodEnd
    }],
    serviceSubscriptions: [
      {
        userId,
        serviceType: 'whatsapp',
        planId: 'wa_growth',
        price: 15,
        status: 'active',
        expiresAt: waPeriodEnd
      },
      {
        userId,
        serviceType: 'discord',
        planId: 'dc_pro',
        price: 9,
        status: 'active',
        expiresAt: dcPeriodEnd
      }
    ]
  });

  const holdRes = await enforceUserAccountHold({
    userId,
    reason: 'NID mismatch during automated review',
    holdType: HOLD_TYPES.NID_REVIEW,
    now
  });

  assert.equal(holdRes.ok, true);
  assert.equal(holdRes.holdType, HOLD_TYPES.NID_REVIEW);
  assert.equal(holdRes.permanent, false);
  assert.equal(holdRes.nonRefundable, true);
  assert.equal(holdRes.retainUntil, null);
  assert.deepEqual(holdRes.affected.heldIps, [allocated.ipv6]);

  const state = getInMemoryAccountLifecycleStateForTests();
  assert.equal(state.droplets[0].status, 'suspended');
  assert.equal(state.droplets[0].nextBillingAt, vpsPeriodEnd); // Period kept running
  assert.equal(state.tenants[0].status, 'suspended');
  assert.equal(state.stores[0].status, 'suspended');
  assert.equal(state.stores[0].expiresAt, storePeriodEnd);
  assert.equal(state.storeSubscriptions[0].status, 'paused');
  assert.equal(state.storeSubscriptions[0].expiresAt, storePeriodEnd);
  for (const sub of state.serviceSubscriptions) {
    assert.equal(sub.status, 'paused');
  }
  const waSub = state.serviceSubscriptions.find((s) => s.serviceType === 'whatsapp');
  const dcSub = state.serviceSubscriptions.find((s) => s.serviceType === 'discord');
  assert.equal(waSub.expiresAt, waPeriodEnd);
  assert.equal(dcSub.expiresAt, dcPeriodEnd);

  const ipState = getInMemoryIpv6StateForTests();
  assert.equal(ipState.allocations[0].status, 'held');
  assert.equal(ipState.allocations[0].ipAddress, allocated.ipv6);

  assert.equal(state.notifications.length, 1);
  assert.match(state.notifications[0].content, /non-refundable/i);
  assert.equal(state.notifications[0].meta.holdType, HOLD_TYPES.NID_REVIEW);
  assert.equal(state.notifications[0].meta.nonRefundable, true);

  // Restoring after NID verification reactivates all 4 services and restores exact held IP
  const restoreRes = await restoreUserAccountServices({
    userId,
    now: new Date('2026-11-02T12:00:00.000Z'),
    overrideReason: 'NID approved by specialist'
  });

  assert.equal(restoreRes.ok, true);
  assert.equal(restoreRes.restored, true);
  assert.equal(restoreRes.holdType, HOLD_TYPES.CLEARED);
  assert.deepEqual(restoreRes.restoredServices.ips, [allocated.ipv6]);

  const afterRestore = getInMemoryAccountLifecycleStateForTests();
  assert.equal(afterRestore.droplets[0].status, 'active');
  assert.equal(afterRestore.tenants[0].status, 'active');
  assert.equal(afterRestore.stores[0].status, 'active');
  assert.equal(afterRestore.storeSubscriptions[0].status, 'active');
  assert.equal(afterRestore.serviceSubscriptions.every((s) => s.status === 'active'), true);

  const restoredIpState = getInMemoryIpv6StateForTests();
  assert.equal(restoredIpState.allocations[0].status, 'active');
  assert.equal(restoredIpState.allocations[0].ipAddress, allocated.ipv6);
});

test('temp_ban keeps paid period running so services past expiresAt restore as expired (non-refundable)', async () => {
  resetInMemoryAccountLifecycleForTests();
  resetInMemoryIpv6PoolForTests();

  const userId = 'usr_temp_1';
  seedInMemoryAccountServicesForTests({
    userId,
    serviceSubscriptions: [
      {
        userId,
        serviceType: 'whatsapp',
        planId: 'wa_starter',
        price: 10,
        status: 'active',
        expiresAt: '2026-11-05T00:00:00.000Z'
      },
      {
        userId,
        serviceType: 'discord',
        planId: 'dc_pro',
        price: 12,
        status: 'active',
        expiresAt: '2026-11-20T00:00:00.000Z'
      }
    ]
  });

  await enforceUserAccountHold({
    userId,
    reason: 'Temporary chargeback hold',
    holdType: HOLD_TYPES.TEMP_BAN,
    now: createBaseDate('2026-11-01T00:00:00.000Z')
  });

  // Restore on Nov 10 -> WhatsApp period ended Nov 5 (expired), Discord still valid until Nov 20 (active)
  await restoreUserAccountServices({
    userId,
    now: createBaseDate('2026-11-10T00:00:00.000Z')
  });

  const state = getInMemoryAccountLifecycleStateForTests();
  const wa = state.serviceSubscriptions.find((s) => s.serviceType === 'whatsapp');
  const dc = state.serviceSubscriptions.find((s) => s.serviceType === 'discord');
  assert.equal(wa.status, 'expired');
  assert.equal(dc.status, 'active');
});

test('permanent ban pauses immediately, retains data ONLY until latest paid period end, blocks standard restore, then purges & frees IPs', async () => {
  resetInMemoryAccountLifecycleForTests();
  resetInMemoryIpv6PoolForTests();

  const userId = 'usr_perm_1';
  const dropletId = 'drp_perm_1';
  const tenantId = 'ubt_perm_1';
  const nodeId = 'ubuntu-sgp-1';
  const banTime = createBaseDate('2026-11-01T00:00:00.000Z');
  const latestPaidEnd = '2026-11-28T18:00:00.000Z';

  upsertInMemoryDropletForTests({
    id: dropletId,
    userId,
    nodeId,
    name: 'perm-ban-vps',
    sshPort: 22201
  });
  const allocated = await allocateDropletIpv6({
    nodeId,
    dropletId,
    preferredPrefix: '2001:db8:beef:2::/64',
    userId,
    sshPort: 22201
  });

  seedInMemoryAccountServicesForTests({
    userId,
    nodes: [{ id: nodeId, activeDroplets: 3 }],
    tenants: [{ tenantId, userId, nodeId, status: 'active' }],
    droplets: [{
      id: dropletId,
      userId,
      tenantId,
      nodeId,
      status: 'active',
      monthlyPrice: 20,
      nextBillingAt: '2026-11-15T00:00:00.000Z'
    }],
    stores: [{
      tiwiId: 'TIW-PERM-1',
      ownerId: userId,
      planId: 'enterprise',
      status: 'active',
      expiresAt: latestPaidEnd
    }],
    storeSubscriptions: [{
      tiwiId: 'TIW-PERM-1',
      ownerId: userId,
      planId: 'enterprise',
      price: 49,
      status: 'active',
      expiresAt: latestPaidEnd
    }],
    serviceSubscriptions: [
      { userId, serviceType: 'whatsapp', planId: 'wa_pro', price: 15, status: 'active', expiresAt: '2026-11-10T00:00:00.000Z' },
      { userId, serviceType: 'discord', planId: 'dc_pro', price: 12, status: 'active', expiresAt: '2026-11-12T00:00:00.000Z' }
    ]
  });

  const banRes = await enforceUserAccountHold({
    userId,
    reason: 'Confirmed fraud & abuse',
    permanent: true,
    now: banTime
  });

  assert.equal(banRes.holdType, HOLD_TYPES.PERMANENT_BAN);
  assert.equal(banRes.permanent, true);
  assert.equal(banRes.nonRefundable, true);
  assert.equal(banRes.retainUntil, latestPaidEnd);

  // Standard restore MUST reject with 403
  await assert.rejects(
    () => restoreUserAccountServices({ userId, now: new Date('2026-11-05T00:00:00.000Z') }),
    (err) => err.statusCode === 403 && err.code === 'PERMANENT_BAN_RESTORE_FORBIDDEN'
  );

  // Premature purge sweep BEFORE retain_until MUST NOT purge anything
  const earlySweep = await runPermanentBanPurgeSweep({
    now: new Date('2026-11-28T17:59:59.000Z')
  });
  assert.equal(earlySweep.processed, 0);
  assert.equal(getInMemoryAccountLifecycleStateForTests().droplets.length, 1);
  assert.equal(getInMemoryIpv6StateForTests().allocations[0].status, 'held');

  // Purge sweep AT/AFTER retain_until purges everything and releases IPs back to free pool
  const finalSweep = await runPermanentBanPurgeSweep({
    now: new Date(latestPaidEnd)
  });
  assert.equal(finalSweep.processed, 1);
  assert.equal(finalSweep.purgedUsers[0].userId, userId);
  assert.deepEqual(finalSweep.purgedUsers[0].deletedDroplets, [dropletId]);
  assert.deepEqual(finalSweep.purgedUsers[0].releasedIps, [allocated.ipv6]);
  assert.deepEqual(finalSweep.purgedUsers[0].reclaimedTenants, [tenantId]);

  const afterPurge = getInMemoryAccountLifecycleStateForTests();
  assert.equal(afterPurge.droplets.length, 0);
  assert.equal(afterPurge.tenants.length, 0);
  assert.equal(afterPurge.nodes[0].activeDroplets, 2);
  assert.equal(afterPurge.stores[0].status, 'terminated');
  assert.equal(afterPurge.storeSubscriptions[0].status, 'terminated');
  assert.equal(afterPurge.serviceSubscriptions.every((s) => s.status === 'terminated' && s.autoRenew === false), true);
  assert.ok(afterPurge.holds[0].purgedAt);
  assert.ok(afterPurge.audits.some((a) => a.action === 'permanent_ban_purged' && a.details.irreversible === true));

  const ipAfterPurge = getInMemoryIpv6StateForTests();
  assert.equal(ipAfterPurge.allocations[0].status, 'released');

  // Verify even override restore is rejected after purge completed (409)
  await assert.rejects(
    () => restoreUserAccountServices({ userId, allowPermanentOverride: true }),
    (err) => err.statusCode === 409 && err.code === 'ACCOUNT_ALREADY_PURGED'
  );
});

test('permanent ban with no active paid subscriptions falls back to now + 1 day retention', async () => {
  resetInMemoryAccountLifecycleForTests();
  resetInMemoryIpv6PoolForTests();

  const now = createBaseDate('2026-11-01T08:00:00.000Z');
  seedInMemoryAccountServicesForTests({
    userId: 'usr_free_ban',
    stores: [{ tiwiId: 'TIW-FREE-1', ownerId: 'usr_free_ban', planId: 'free', status: 'active' }]
  });

  const res = await enforceUserAccountHold({
    userId: 'usr_free_ban',
    reason: 'Spam store',
    permanent: true,
    now
  });

  assert.equal(res.retainUntil, '2026-11-02T08:00:00.000Z');
});

test('PGlite real PostgreSQL schema, hold, restore, and permanent ban purge work end-to-end across all tables', async (t) => {
  const db = new PGlite();
  t.after(async () => { await db.close(); });

  const queryFn = async (sql, params) => (
    params?.length
      ? db.query(sql, params)
      : (await db.exec(sql)).at(-1)
  );

  await db.exec(`
    CREATE TABLE system_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255),
      is_banned BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE system_server_nodes (
      id TEXT PRIMARY KEY,
      active_droplets INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_ubuntu_tenants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cloud_droplets (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(64) DEFAULT 'active',
      tenant_id VARCHAR(64),
      node_id VARCHAR(64),
      ssh_port INTEGER DEFAULT 22,
      access_username VARCHAR(64) DEFAULT 'root',
      monthly_price NUMERIC(12, 2),
      next_billing_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_stores (
      id VARCHAR(64) PRIMARY KEY,
      tiwi_id VARCHAR(64) UNIQUE,
      owner_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
      store_name VARCHAR(255),
      plan_id VARCHAR(64) DEFAULT 'free',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_subscriptions (
      id VARCHAR(64) PRIMARY KEY,
      tiwi_id VARCHAR(64) REFERENCES system_stores(tiwi_id) ON DELETE CASCADE,
      plan_id VARCHAR(64) NOT NULL,
      plan_name VARCHAR(100) NOT NULL,
      price NUMERIC(10, 2) DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_state_documents (
      namespace TEXT NOT NULL,
      document_key TEXT NOT NULL,
      data JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (namespace, document_key)
    );
    CREATE TABLE platform_service_subscriptions (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      service_type VARCHAR(32) NOT NULL,
      plan_id VARCHAR(64) NOT NULL,
      plan_name VARCHAR(128) NOT NULL,
      price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE discord_bots (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(32) DEFAULT 'online',
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE discord_servers (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE social_notifications (
      id VARCHAR(64) PRIMARY KEY,
      recipient_id VARCHAR(64),
      sender_id VARCHAR(64),
      type VARCHAR(64) NOT NULL,
      content TEXT,
      entity_id VARCHAR(64),
      is_read BOOLEAN DEFAULT FALSE,
      title VARCHAR(255),
      snippet TEXT,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureIpv6PoolSchema({ queryFn });
  assert.equal((await ensureAccountLifecycleSchema(db)).ok, true);
  assert.equal((await ensureAccountLifecycleSchema(db)).ok, true); // Idempotent

  const userId = 'pg_user_1';
  const dropletId = 'pg_drp_1';
  const tenantId = 'pg_ubt_1';
  const nodeId = 'pg-node-1';
  const tiwiId = 'TIW-PG-1';
  const paidEnd = '2026-12-01T00:00:00.000Z';

  await db.query(`INSERT INTO system_users (id, email) VALUES ($1, $2)`, [userId, 'pg@tiwlo.com']);
  await db.query(`INSERT INTO system_server_nodes (id, active_droplets) VALUES ($1, 2)`, [nodeId]);
  await db.query(`INSERT INTO system_ubuntu_tenants (id, user_id, node_id, status) VALUES ($1, $2, $3, 'active')`, [tenantId, userId, nodeId]);
  await db.query(
    `INSERT INTO cloud_droplets (id, user_id, name, status, tenant_id, node_id, ssh_port, monthly_price, next_billing_at)
     VALUES ($1, $2, 'pg-vps', 'active', $3, $4, 22301, 15.00, $5::timestamptz)`,
    [dropletId, userId, tenantId, nodeId, '2026-11-20T00:00:00.000Z']
  );

  const ipAlloc = await allocateDropletIpv6({
    nodeId,
    dropletId,
    preferredPrefix: '2001:db8:9999:1::/64',
    userId,
    sshPort: 22301,
    queryFn
  });

  await db.query(
    `INSERT INTO system_stores (id, tiwi_id, owner_id, store_name, plan_id, status)
     VALUES ('str_1', $1, $2, 'PG Store', 'pro', 'active')`,
    [tiwiId, userId]
  );
  await db.query(
    `INSERT INTO system_subscriptions (id, tiwi_id, plan_id, plan_name, price, status, expires_at)
     VALUES ('sub_1', $1, 'pro', 'Pro Store', 29.00, 'active', $2::timestamptz)`,
    [tiwiId, paidEnd]
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb)`,
    [JSON.stringify({
      stores: [{ tiwiId, ownerId: userId, planId: 'pro', status: 'active', lifecycleStatus: 'active', expiresAt: paidEnd }],
      subscriptions: [{ tiwiId, planId: 'pro', planName: 'Pro Store', price: 29, lifecycleStatus: 'active', expiresAt: paidEnd }]
    })]
  );

  await db.query(
    `INSERT INTO platform_service_subscriptions (id, user_id, service_type, plan_id, plan_name, price, status, auto_renew, expires_at)
     VALUES ('svc_wa', $1, 'whatsapp', 'wa_pro', 'WA Pro', 12.00, 'active', TRUE, '2026-11-25T00:00:00.000Z'),
            ('svc_dc', $1, 'discord', 'dc_pro', 'DC Pro', 10.00, 'active', TRUE, '2026-11-26T00:00:00.000Z')`,
    [userId]
  );
  await db.query(`INSERT INTO discord_bots (id, user_id, name, status) VALUES ('bot_1', $1, 'HelperBot', 'online')`, [userId]);
  await db.query(`INSERT INTO discord_servers (id, user_id, name, is_suspended) VALUES ('srv_1', $1, 'Guild 1', FALSE)`, [userId]);

  // 1. NID Review Hold in PGlite
  const holdRes = await enforceUserAccountHold({
    userId,
    reason: 'NID selfie check',
    holdType: HOLD_TYPES.NID_REVIEW,
    now: createBaseDate('2026-11-01T00:00:00.000Z'),
    queryable: db
  });
  assert.equal(holdRes.holdType, HOLD_TYPES.NID_REVIEW);
  assert.deepEqual(holdRes.affected.heldIps, [ipAlloc.ipv6]);

  assert.equal((await db.query('SELECT status FROM cloud_droplets WHERE id = $1', [dropletId])).rows[0].status, 'suspended');
  assert.equal((await db.query('SELECT status FROM system_ubuntu_tenants WHERE id = $1', [tenantId])).rows[0].status, 'suspended');
  assert.equal((await db.query('SELECT status FROM system_stores WHERE tiwi_id = $1', [tiwiId])).rows[0].status, 'suspended');
  assert.equal((await db.query('SELECT status FROM system_subscriptions WHERE tiwi_id = $1', [tiwiId])).rows[0].status, 'paused');
  assert.equal((await db.query('SELECT status FROM discord_bots WHERE id = $1', ['bot_1'])).rows[0].status, 'paused');
  assert.equal((await db.query('SELECT is_suspended FROM discord_servers WHERE id = $1', ['srv_1'])).rows[0].is_suspended, true);

  const heldAllocs = await listDropletIpAllocations({ dropletId, includeReleased: true, queryFn });
  assert.equal(heldAllocs[0].status, 'held');

  const notifRows = (await db.query('SELECT * FROM social_notifications WHERE recipient_id = $1', [userId])).rows;
  assert.equal(notifRows.length, 1);
  assert.equal(notifRows[0].meta.nonRefundable, true);

  // 2. Restore after NID Verification in PGlite
  const restoreRes = await restoreUserAccountServices({
    userId,
    now: createBaseDate('2026-11-02T00:00:00.000Z'),
    queryable: db
  });
  assert.equal(restoreRes.restored, true);
  assert.deepEqual(restoreRes.restoredServices.ips, [ipAlloc.ipv6]);
  assert.equal((await db.query('SELECT status FROM cloud_droplets WHERE id = $1', [dropletId])).rows[0].status, 'active');
  assert.equal((await db.query('SELECT status FROM system_ubuntu_tenants WHERE id = $1', [tenantId])).rows[0].status, 'active');
  assert.equal((await db.query('SELECT status FROM system_stores WHERE tiwi_id = $1', [tiwiId])).rows[0].status, 'active');
  assert.equal((await db.query('SELECT status FROM discord_bots WHERE id = $1', ['bot_1'])).rows[0].status, 'online');
  assert.equal((await db.query('SELECT is_suspended FROM discord_servers WHERE id = $1', ['srv_1'])).rows[0].is_suspended, false);

  const restoredAllocs = await listDropletIpAllocations({ dropletId, includeReleased: true, queryFn });
  assert.equal(restoredAllocs[0].status, 'active');
  assert.equal(restoredAllocs[0].ipAddress, ipAlloc.ipv6);

  // 3. Permanent Ban -> Retain until paidEnd -> Purge in PGlite
  const banRes = await enforceUserAccountHold({
    userId,
    reason: 'Permanent TOS ban',
    permanent: true,
    now: createBaseDate('2026-11-05T00:00:00.000Z'),
    queryable: db
  });
  assert.equal(banRes.holdType, HOLD_TYPES.PERMANENT_BAN);
  assert.equal(new Date(banRes.retainUntil).toISOString(), paidEnd);

  await assert.rejects(
    () => restoreUserAccountServices({ userId, queryable: db }),
    (err) => err.statusCode === 403 && err.code === 'PERMANENT_BAN_RESTORE_FORBIDDEN'
  );

  // Too early -> 0 purged
  const earlyPurge = await runPermanentBanPurgeSweep({
    now: new Date('2026-11-30T23:59:59.000Z'),
    queryable: db
  });
  assert.equal(earlyPurge.processed, 0);

  // At retain_until -> purge executes
  const finalPurge = await runPermanentBanPurgeSweep({
    now: new Date(paidEnd),
    queryable: db
  });
  assert.equal(finalPurge.processed, 1);
  assert.deepEqual(finalPurge.purgedUsers[0].deletedDroplets, [dropletId]);
  assert.deepEqual(finalPurge.purgedUsers[0].releasedIps, [ipAlloc.ipv6]);

  assert.equal((await db.query('SELECT * FROM cloud_droplets WHERE user_id = $1', [userId])).rows.length, 0);
  assert.equal((await db.query('SELECT * FROM system_ubuntu_tenants WHERE user_id = $1', [userId])).rows.length, 0);
  assert.equal((await db.query('SELECT active_droplets FROM system_server_nodes WHERE id = $1', [nodeId])).rows[0].active_droplets, 1);
  assert.equal((await db.query('SELECT status FROM system_stores WHERE tiwi_id = $1', [tiwiId])).rows[0].status, 'terminated');
  assert.equal((await db.query('SELECT status FROM system_subscriptions WHERE tiwi_id = $1', [tiwiId])).rows[0].status, 'terminated');
  assert.equal((await db.query('SELECT status FROM discord_bots WHERE id = $1', ['bot_1'])).rows[0].status, 'terminated');

  const dirData = (await db.query(`SELECT data FROM system_state_documents WHERE namespace = 'master' AND document_key = 'directory'`)).rows[0].data;
  assert.equal(dirData.stores[0].status, 'terminated');
  assert.equal(dirData.subscriptions[0].subscriptionStatus, 'terminated');

  const svcRows = (await db.query('SELECT service_type, status, auto_renew FROM platform_service_subscriptions WHERE user_id = $1', [userId])).rows;
  assert.equal(svcRows.length, 2);
  for (const r of svcRows) {
    assert.equal(r.status, 'terminated');
    assert.equal(r.auto_renew, false);
  }

  const finalAllocs = await listDropletIpAllocations({ dropletId, includeReleased: true, queryFn });
  assert.equal(finalAllocs[0].status, 'released');

  const holdAfter = await getUserAccountHold(userId, { queryable: db });
  assert.ok(holdAfter.purgedAt);

  const audits = (await db.query(`SELECT * FROM system_account_lifecycle_audits WHERE user_id = $1 AND action = 'permanent_ban_purged'`, [userId])).rows;
  assert.equal(audits.length, 1);
  assert.equal(audits[0].details.irreversible, true);

  // Verify released IPv6 can be safely allocated to a new droplet on the pool
  const newAlloc = await allocateDropletIpv6({
    nodeId,
    dropletId: 'pg_drp_new',
    preferredPrefix: '2001:db8:9999:1::/64',
    userId: 'pg_user_2',
    sshPort: 22302,
    queryFn
  });
  assert.equal(newAlloc.status, 'active');
});

test('escalating nid_review -> permanent_ban preserves original snapshot & retain_until, supports allowPermanentOverride, and invokes injected hooks', async () => {
  resetInMemoryAccountLifecycleForTests();
  resetInMemoryIpv6PoolForTests();

  const calls = [];
  const userId = 'usr_esc_1';
  const dropletId = 'drp_esc_1';
  const tenantId = 'ubt_esc_1';
  const nodeId = 'ubuntu-esc-1';
  const paidUntil = '2026-12-10T00:00:00.000Z';

  seedInMemoryAccountServicesForTests({
    userId,
    nodes: [{ id: nodeId, activeDroplets: 2 }],
    tenants: [{ tenantId, userId, nodeId, status: 'active' }],
    droplets: [{
      id: dropletId,
      userId,
      tenantId,
      nodeId,
      status: 'active',
      monthlyPrice: 10,
      nextBillingAt: paidUntil
    }],
    serviceSubscriptions: [
      { userId, serviceType: 'discord', planId: 'dc_pro', price: 9, status: 'active', expiresAt: '2026-11-25T00:00:00.000Z' }
    ]
  });

  // First put on NID review hold
  const nidHold = await enforceUserAccountHold({
    userId,
    holdType: HOLD_TYPES.NID_REVIEW,
    reason: 'Blurry NID',
    now: createBaseDate('2026-11-01T00:00:00.000Z'),
    holdIpFn: async ({ dropletId: dId }) => {
      calls.push(['holdIp', dId]);
      return { dropletId: dId, status: 'held', heldAddresses: [{ ipAddress: '2001:db8::99' }] };
    },
    updateTenantStatusFn: async ({ tenantId: tId, status }) => {
      calls.push(['tenantStatus', tId, status]);
      return { tenantId: tId, status };
    }
  });
  assert.equal(nidHold.pausedAt, '2026-11-01T00:00:00.000Z');

  // Escalate to permanent ban 2 days later
  const escalated = await enforceUserAccountHold({
    userId,
    permanent: true,
    reason: 'Forged ID confirmed',
    now: createBaseDate('2026-11-03T00:00:00.000Z'),
    holdIpFn: async ({ dropletId: dId }) => ({ dropletId: dId, status: 'held', heldAddresses: [{ ipAddress: '2001:db8::99' }] }),
    updateTenantStatusFn: async ({ tenantId: tId, status }) => ({ tenantId: tId, status })
  });
  assert.equal(escalated.holdType, HOLD_TYPES.PERMANENT_BAN);
  assert.equal(escalated.pausedAt, '2026-11-01T00:00:00.000Z'); // Original paused_at preserved
  assert.equal(escalated.retainUntil, paidUntil); // Still calculated from pre-hold active paid subscription!

  // Explicit permanent override before purge succeeds and restores pre-hold 'active' state
  const restored = await restoreUserAccountServices({
    userId,
    allowPermanentOverride: true,
    overrideReason: 'Superadmin appeal granted',
    now: createBaseDate('2026-11-04T00:00:00.000Z'),
    restoreIpFn: async ({ dropletId: dId }) => {
      calls.push(['restoreIp', dId]);
      return { dropletId: dId, status: 'active', ipv6: '2001:db8::99' };
    },
    updateTenantStatusFn: async ({ tenantId: tId, status }) => {
      calls.push(['tenantStatus', tId, status]);
      return { tenantId: tId, status };
    }
  });
  assert.equal(restored.restored, true);
  assert.equal(restored.holdType, HOLD_TYPES.CLEARED);
  assert.equal(getInMemoryAccountLifecycleStateForTests().droplets[0].status, 'active');
  assert.equal(getInMemoryAccountLifecycleStateForTests().serviceSubscriptions[0].status, 'active');
  assert.ok(calls.some(([op, id]) => op === 'holdIp' && id === dropletId));
  assert.ok(calls.some(([op, id]) => op === 'restoreIp' && id === dropletId));
  assert.ok(calls.some(([op, id, st]) => op === 'tenantStatus' && id === tenantId && st === 'suspended'));
  assert.ok(calls.some(([op, id, st]) => op === 'tenantStatus' && id === tenantId && st === 'active'));

  // Idempotent restore when already cleared
  const secondRestore = await restoreUserAccountServices({ userId });
  assert.equal(secondRestore.alreadyCleared, true);
  assert.equal(secondRestore.restored, false);

  // Validation guards
  await assert.rejects(() => enforceUserAccountHold({ userId: '' }), (e) => e.statusCode === 400);
  await assert.rejects(() => enforceUserAccountHold({ userId, holdType: 'unknown_hold' }), (e) => e.statusCode === 400);
});
