import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { getPgPool } from './postgres.js';
import { MasterDB, TenantDB } from './multiTenant.js';
import { BillingDB } from './billing.js';
import { storeMedia, deleteMedia, getMediaMetadata } from './mediaStorage.js';
import {
  BILLING_PERIOD_DAYS,
  GRACE_PERIOD_DAYS,
  SUSPENSION_RETENTION_DAYS,
  buildStoreDashboardNotifications,
  extractStoreMediaPaths,
  processStoreSubscriptionLifecycle,
  purgeStoreMediaAssets,
  renewStoreSubscriptionForUser,
  syncStoreLifecycleOnPlanChange
} from './storeLifecycle.js';

test('confirmed store deletion removes registry, tenant, subscription, and custom-domain records atomically', async t => {
  const db = new PGlite();
  const pool = getPgPool();
  const runQuery = async (sql, params) => params?.length
    ? db.query(sql, params)
    : (await db.exec(sql)).at(-1);
  t.mock.method(pool, 'query', runQuery);
  t.mock.method(pool, 'connect', async () => ({
    query: runQuery,
    release() {}
  }));
  t.after(async () => { await db.close(); await pool.end(); });

  await db.exec(`
    CREATE TABLE system_state_documents (
      namespace TEXT NOT NULL,
      document_key TEXT NOT NULL,
      data JSONB NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (namespace, document_key)
    );
    CREATE TABLE system_custom_domains (tiwi_id VARCHAR(64));
    CREATE TABLE system_stores (tiwi_id VARCHAR(64), owner_id VARCHAR(64));
  `);
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb),
            ('tenant', 'TIW-DELETE-1', '{"products":[{"id":"product-1"}]}')`,
    [JSON.stringify({
      stores: [{ tiwiId: 'TIW-DELETE-1', ownerId: 'owner-1', subdomain: 'delete-me.tiwlo.com' }],
      subscriptions: [{ tiwiId: 'TIW-DELETE-1', planId: 'free' }]
    })]
  );
  await db.query('INSERT INTO system_custom_domains (tiwi_id) VALUES ($1)', ['TIW-DELETE-1']);
  await db.query('INSERT INTO system_stores (tiwi_id, owner_id) VALUES ($1, $2)', ['TIW-DELETE-1', 'owner-1']);

  assert.equal(await MasterDB.deleteStoreForUser('other-owner', 'TIW-DELETE-1'), false);
  assert.equal(await MasterDB.deleteStoreForUser('owner-1', 'TIW-DELETE-1'), true);

  const master = await db.query(
    "SELECT data FROM system_state_documents WHERE namespace = 'master' AND document_key = 'directory'"
  );
  assert.deepEqual(master.rows[0].data, { stores: [], subscriptions: [] });
  const tenant = await db.query(
    "SELECT 1 FROM system_state_documents WHERE namespace = 'tenant' AND document_key = 'TIW-DELETE-1'"
  );
  assert.equal(tenant.rows.length, 0);
  assert.equal((await db.query('SELECT 1 FROM system_custom_domains')).rows.length, 0);
  assert.equal((await db.query('SELECT 1 FROM system_stores')).rows.length, 0);
});

async function setupLifecycleDb(t) {
  const db = new PGlite();
  const pool = getPgPool();
  const runQuery = async (sql, params) => (
    params?.length
      ? db.query(sql, params)
      : (await db.exec(sql)).at(-1)
  );
  t.mock.method(pool, 'query', runQuery);
  t.mock.method(pool, 'connect', async () => ({
    query: runQuery,
    release() {}
  }));
  t.after(async () => {
    await db.close();
  });

  await db.exec(`
    CREATE TABLE system_users (
      id VARCHAR(64) PRIMARY KEY,
      tiwi_id VARCHAR(64),
      name VARCHAR(255),
      store_name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255),
      role VARCHAR(64) DEFAULT 'owner',
      date_of_birth DATE,
      account_type VARCHAR(32) DEFAULT 'business',
      address TEXT,
      city VARCHAR(100),
      country VARCHAR(100),
      phone VARCHAR(64),
      postal_code VARCHAR(32),
      plan_id VARCHAR(64) DEFAULT 'free',
      plan_name VARCHAR(64) DEFAULT 'Free Starter',
      subdomain VARCHAR(128),
      avatar TEXT,
      cover_photo TEXT,
      is_banned BOOLEAN DEFAULT FALSE,
      ban_reason TEXT,
      identity_verified BOOLEAN DEFAULT FALSE,
      identity_verification_required BOOLEAN DEFAULT FALSE,
      address_verified_at TIMESTAMPTZ,
      address_verified_location JSONB,
      email_verified BOOLEAN DEFAULT TRUE,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      auth_method VARCHAR(64) DEFAULT 'credentials',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cloud_billing_accounts (
      user_id VARCHAR(64) PRIMARY KEY,
      credits NUMERIC(12, 2) NOT NULL DEFAULT 0,
      promotional_credits NUMERIC(12, 2) NOT NULL DEFAULT 0,
      promotional_expires_at TIMESTAMPTZ,
      monthly_spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
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
    CREATE TABLE system_custom_domains (tiwi_id VARCHAR(64));
    CREATE TABLE system_stores (tiwi_id VARCHAR(64), owner_id VARCHAR(64));
    CREATE TABLE system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_media (
      id VARCHAR(64) PRIMARY KEY,
      content_type VARCHAR(128) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      size_bytes BIGINT NOT NULL,
      sha256 CHAR(64) NOT NULL,
      owner_id VARCHAR(64),
      purpose VARCHAR(64) NOT NULL DEFAULT 'general',
      review_status VARCHAR(16) NOT NULL DEFAULT 'approved',
      storage_backend VARCHAR(16) NOT NULL DEFAULT 'postgres',
      drive_file_id VARCHAR(255),
      drive_account_id VARCHAR(64),
      data BYTEA,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_media_aliases (
      storage_path TEXT PRIMARY KEY,
      media_id VARCHAR(64) NOT NULL REFERENCES system_media(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_google_drive_accounts (
      id VARCHAR(64) PRIMARY KEY,
      display_name VARCHAR(120) NOT NULL,
      project_id VARCHAR(128) NOT NULL,
      client_email VARCHAR(255) NOT NULL UNIQUE,
      root_folder_id VARCHAR(255) NOT NULL,
      credentials_ciphertext BYTEA NOT NULL,
      encryption_iv BYTEA NOT NULL,
      encryption_auth_tag BYTEA NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'configured',
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_platform_storage (
      id VARCHAR(32) PRIMARY KEY,
      backend VARCHAR(16) NOT NULL DEFAULT 'postgres',
      google_drive_account_id VARCHAR(64) REFERENCES system_google_drive_accounts(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

test('auto-renewal funded extends paid subscription by 30 days and skips free stores', async t => {
  const db = await setupLifecycleDb(t);
  const now = new Date('2026-12-01T00:00:00.000Z');
  const expiredAt = '2026-11-30T23:59:00.000Z';

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('usr-1', 'TIW-10001', 'Alice', 'Alice Shop', 'alice@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (user_id, credits) VALUES ('usr-1', 50.00)`
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb),
            ('tenant', 'TIW-10001', $2::jsonb),
            ('tenant', 'TIW-10002', $3::jsonb)`,
    [
      JSON.stringify({
        stores: [
          {
            tiwiId: 'TIW-10001',
            ownerId: 'usr-1',
            storeName: 'Alice Paid',
            subdomain: 'alicepaid.tiwlo.com',
            planId: 'growth',
            status: 'active',
            lifecycleStatus: 'active',
            expiresAt: expiredAt
          },
          {
            tiwiId: 'TIW-10002',
            ownerId: 'usr-1',
            storeName: 'Alice Legacy Free',
            subdomain: 'alicefree.tiwlo.com',
            planId: 'free',
            status: 'active'
          }
        ],
        subscriptions: [
          {
            tiwiId: 'TIW-10001',
            planId: 'growth',
            planName: 'Growth Retailer',
            price: 19,
            billingCycle: 'monthly',
            lifecycleStatus: 'active',
            expiresAt: expiredAt
          }
        ]
      }),
      JSON.stringify({
        tiwiId: 'TIW-10001',
        storeName: 'Alice Paid',
        products: [],
        subscription: { planId: 'growth', planName: 'Growth Retailer', price: 19, expiresAt: expiredAt }
      }),
      JSON.stringify({
        tiwiId: 'TIW-10002',
        storeName: 'Alice Legacy Free',
        products: []
      })
    ]
  );

  const emails = [];
  const result = await processStoreSubscriptionLifecycle({
    now,
    emailFns: {
      sendStoreGracePeriodEmail: async (payload) => emails.push({ type: 'grace', payload }),
      sendStoreSuspendedEmail: async (payload) => emails.push({ type: 'suspended', payload }),
      sendStoreDeletedEmail: async (payload) => emails.push({ type: 'deleted', payload })
    }
  });

  assert.equal(result.renewed, 1);
  assert.equal(emails.length, 0);

  const billing = await db.query("SELECT credits FROM cloud_billing_accounts WHERE user_id = 'usr-1'");
  assert.equal(Number(billing.rows[0].credits), 31);

  const master = await MasterDB.getMasterData();
  const paidStore = master.stores.find((s) => s.tiwiId === 'TIW-10001');
  const freeStore = master.stores.find((s) => s.tiwiId === 'TIW-10002');
  const expectedExpiry = new Date(now.getTime() + BILLING_PERIOD_DAYS * 86400_000).toISOString();

  assert.equal(paidStore.status, 'active');
  assert.equal(paidStore.lifecycleStatus, 'active');
  assert.equal(paidStore.expiresAt, expectedExpiry);
  assert.equal(freeStore.expiresAt, undefined);

  const tenantPaid = await TenantDB.getStoreDb('TIW-10001');
  assert.equal(tenantPaid.subscription.expiresAt, expectedExpiry);
});

test('auto-renewal unfunded enters 3-day grace period, sends grace email once, then suspends with 180-day retention', async t => {
  const db = await setupLifecycleDb(t);
  const t0 = new Date('2026-12-01T00:00:00.000Z');
  const expiredAt = '2026-11-30T12:00:00.000Z';

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('usr-2', 'TIW-20001', 'Bob', 'Bob Store', 'bob@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (user_id, credits) VALUES ('usr-2', 2.00)`
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb),
            ('tenant', 'TIW-20001', $2::jsonb)`,
    [
      JSON.stringify({
        stores: [
          {
            tiwiId: 'TIW-20001',
            ownerId: 'usr-2',
            storeName: 'Bob Store',
            subdomain: 'bob.tiwlo.com',
            planId: 'pro',
            status: 'active',
            lifecycleStatus: 'active',
            expiresAt: expiredAt
          }
        ],
        subscriptions: [
          {
            tiwiId: 'TIW-20001',
            planId: 'pro',
            planName: 'Pro Business',
            price: 49,
            billingCycle: 'monthly',
            lifecycleStatus: 'active',
            expiresAt: expiredAt
          }
        ]
      }),
      JSON.stringify({
        tiwiId: 'TIW-20001',
        storeName: 'Bob Store',
        products: [],
        subscription: { planId: 'pro', planName: 'Pro Business', price: 49, expiresAt: expiredAt }
      })
    ]
  );

  const sentEmails = [];
  const emailFns = {
    sendStoreGracePeriodEmail: async (payload) => sentEmails.push({ type: 'grace', payload }),
    sendStoreSuspendedEmail: async (payload) => sentEmails.push({ type: 'suspended', payload }),
    sendStoreDeletedEmail: async (payload) => sentEmails.push({ type: 'deleted', payload })
  };

  // Sweep 1: enters 3-day grace period, keeps store active, sends grace email once
  const r1 = await processStoreSubscriptionLifecycle({ now: t0, emailFns });
  assert.equal(r1.enteredGrace, 1);
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].type, 'grace');

  // Sweep 2 within grace window: idempotent, no duplicate email, still active
  const t1 = new Date(t0.getTime() + 12 * 3600_000);
  const r2 = await processStoreSubscriptionLifecycle({ now: t1, emailFns });
  assert.equal(r2.enteredGrace, 0);
  assert.equal(r2.suspended, 0);
  assert.equal(sentEmails.length, 1);

  let master = await MasterDB.getMasterData();
  let store = master.stores[0];
  assert.equal(store.status, 'active');
  assert.equal(store.lifecycleStatus, 'grace_period');
  assert.equal(store.graceEndsAt, new Date(t0.getTime() + GRACE_PERIOD_DAYS * 86400_000).toISOString());

  // Sweep 3 after grace window expires -> suspended + 180-day scheduledDeletionAt + suspension email sent once
  const tAfterGrace = new Date(t0.getTime() + GRACE_PERIOD_DAYS * 86400_000 + 60_000);
  const r3 = await processStoreSubscriptionLifecycle({ now: tAfterGrace, emailFns });
  assert.equal(r3.suspended, 1);
  assert.equal(sentEmails.length, 2);
  assert.equal(sentEmails[1].type, 'suspended');

  // Sweep 4 shortly after suspension -> no duplicate suspension email
  const r4 = await processStoreSubscriptionLifecycle({
    now: new Date(tAfterGrace.getTime() + 60_000),
    emailFns
  });
  assert.equal(r4.suspended, 0);
  assert.equal(sentEmails.length, 2);

  master = await MasterDB.getMasterData();
  store = master.stores[0];
  assert.equal(store.status, 'suspended');
  assert.equal(store.lifecycleStatus, 'suspended');
  assert.equal(
    store.scheduledDeletionAt,
    new Date(tAfterGrace.getTime() + SUSPENSION_RETENTION_DAYS * 86400_000).toISOString()
  );
});

test('renewStoreSubscriptionForUser enforces ownerId authorization and reactivates suspended store when funded', async t => {
  const db = await setupLifecycleDb(t);
  const now = new Date('2026-12-10T00:00:00.000Z');

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('owner-1', 'TIW-30001', 'Carol', 'Carol Store', 'carol@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (user_id, credits) VALUES ('owner-1', 40.00)`
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb),
            ('tenant', 'TIW-30001', $2::jsonb)`,
    [
      JSON.stringify({
        stores: [
          {
            tiwiId: 'TIW-30001',
            ownerId: 'owner-1',
            storeName: 'Carol Store',
            subdomain: 'carol.tiwlo.com',
            planId: 'growth',
            status: 'suspended',
            lifecycleStatus: 'suspended',
            graceStartedAt: '2026-12-01T00:00:00.000Z',
            graceEndsAt: '2026-12-04T00:00:00.000Z',
            suspendedAt: '2026-12-04T00:00:00.000Z',
            scheduledDeletionAt: '2027-06-02T00:00:00.000Z',
            graceEmailSentAt: '2026-12-01T00:00:00.000Z',
            suspendedEmailSentAt: '2026-12-04T00:00:00.000Z'
          }
        ],
        subscriptions: [
          {
            tiwiId: 'TIW-30001',
            planId: 'growth',
            planName: 'Growth Retailer',
            price: 19,
            billingCycle: 'monthly',
            lifecycleStatus: 'suspended'
          }
        ]
      }),
      JSON.stringify({
        tiwiId: 'TIW-30001',
        storeName: 'Carol Store',
        products: [],
        subscription: { planId: 'growth', planName: 'Growth Retailer', price: 19, lifecycleStatus: 'suspended' }
      })
    ]
  );

  await assert.rejects(
    renewStoreSubscriptionForUser({ userId: 'attacker-2', tiwiId: 'TIW-30001', now }),
    (err) => err.statusCode === 403
  );

  await assert.rejects(
    renewStoreSubscriptionForUser({ userId: 'owner-1', tiwiId: 'TIW-MISSING', now }),
    (err) => err.statusCode === 404
  );

  const renewed = await renewStoreSubscriptionForUser({ userId: 'owner-1', tiwiId: 'TIW-30001', now });
  assert.equal(renewed.success, true);
  assert.equal(renewed.store.status, 'active');
  assert.equal(renewed.store.lifecycleStatus, 'active');
  assert.equal(renewed.store.suspendedAt, null);
  assert.equal(renewed.store.scheduledDeletionAt, null);
  assert.equal(renewed.store.graceStartedAt, null);
  assert.equal(renewed.store.graceEndsAt, null);
  assert.equal(
    renewed.store.expiresAt,
    new Date(now.getTime() + BILLING_PERIOD_DAYS * 86400_000).toISOString()
  );

  const billing = await db.query("SELECT credits FROM cloud_billing_accounts WHERE user_id = 'owner-1'");
  assert.equal(Number(billing.rows[0].credits), 21);

  const tenant = await TenantDB.getStoreDb('TIW-30001');
  assert.equal(tenant.subscription.lifecycleStatus, 'active');
  assert.equal(tenant.subscription.scheduledDeletionAt, null);
});

test('180-day expiration deletes store, tenant data, and exclusive media while preserving user account and shared media', async t => {
  const db = await setupLifecycleDb(t);
  const now = new Date('2027-06-05T00:00:00.000Z');

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('owner-media', 'TIW-40001', 'Dana', 'Dana Main', 'dana@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (user_id, credits) VALUES ('owner-media', 15.00)`
  );
  await db.query(
    `INSERT INTO system_custom_domains (tiwi_id) VALUES ('TIW-40001')`
  );
  await db.query(
    `INSERT INTO system_stores (tiwi_id, owner_id) VALUES ('TIW-40001', 'owner-media'), ('TIW-40002', 'owner-media')`
  );

  await storeMedia({
    aliases: ['/upload/exclusive-logo.png'],
    buffer: Buffer.from('exclusive-logo-bytes'),
    contentType: 'image/png',
    originalFilename: 'exclusive-logo.png',
    ownerId: 'owner-media',
    purpose: 'store:TIW-40001:logo'
  });
  await storeMedia({
    aliases: ['/upload/exclusive-product.png'],
    buffer: Buffer.from('exclusive-product-bytes'),
    contentType: 'image/png',
    originalFilename: 'exclusive-product.png',
    ownerId: 'owner-media',
    purpose: 'store:TIW-40001:product'
  });
  await storeMedia({
    aliases: ['/upload/shared-banner.png'],
    buffer: Buffer.from('shared-banner-bytes'),
    contentType: 'image/png',
    originalFilename: 'shared-banner.png',
    ownerId: 'owner-media',
    purpose: 'general'
  });

  const deletedStoreDoc = {
    tiwiId: 'TIW-40001',
    storeName: 'Dana Expired Store',
    store_settings: {
      storeLogo: 'https://cdn.tiwlo.com/upload/exclusive-logo.png?v=1',
      heroBanners: [{ image: '/upload/shared-banner.png' }]
    },
    products: [{ id: 'p1', image: '/upload/exclusive-product.png' }],
    subscription: { planId: 'growth', planName: 'Growth Retailer', price: 19 }
  };
  const survivingStoreDoc = {
    tiwiId: 'TIW-40002',
    storeName: 'Dana Active Store',
    store_settings: {
      heroBanners: [{ image: '/upload/shared-banner.png' }]
    },
    products: [],
    subscription: { planId: 'free', planName: 'Free Starter', price: 0 }
  };

  assert.deepEqual(
    extractStoreMediaPaths(deletedStoreDoc).sort(),
    ['/upload/exclusive-logo.png', '/upload/exclusive-product.png', '/upload/shared-banner.png']
  );

  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb),
            ('tenant', 'TIW-40001', $2::jsonb),
            ('tenant', 'TIW-40002', $3::jsonb)`,
    [
      JSON.stringify({
        stores: [
          {
            tiwiId: 'TIW-40001',
            ownerId: 'owner-media',
            storeName: 'Dana Expired Store',
            subdomain: 'dana-expired.tiwlo.com',
            planId: 'growth',
            status: 'suspended',
            lifecycleStatus: 'suspended',
            suspendedAt: '2026-12-01T00:00:00.000Z',
            scheduledDeletionAt: '2027-05-30T00:00:00.000Z'
          },
          {
            tiwiId: 'TIW-40002',
            ownerId: 'owner-media',
            storeName: 'Dana Active Store',
            subdomain: 'dana-active.tiwlo.com',
            planId: 'free',
            status: 'active',
            lifecycleStatus: 'active'
          }
        ],
        subscriptions: [
          { tiwiId: 'TIW-40001', planId: 'growth', planName: 'Growth Retailer', price: 19, lifecycleStatus: 'suspended' }
        ]
      }),
      JSON.stringify(deletedStoreDoc),
      JSON.stringify(survivingStoreDoc)
    ]
  );

  const deletionEmails = [];
  const res = await processStoreSubscriptionLifecycle({
    now,
    deleteMediaFn: deleteMedia,
    purgeMediaFn: purgeStoreMediaAssets,
    emailFns: {
      sendStoreDeletedEmail: async (payload) => deletionEmails.push(payload)
    }
  });

  assert.equal(res.deleted, 1);
  assert.equal(deletionEmails.length, 1);
  assert.equal(deletionEmails[0].to, 'dana@example.com');

  // Expired store and its tenant doc are removed
  const master = await MasterDB.getMasterData();
  assert.deepEqual(master.stores.map((s) => s.tiwiId), ['TIW-40002']);
  const expiredTenant = await db.query(
    "SELECT 1 FROM system_state_documents WHERE namespace = 'tenant' AND document_key = 'TIW-40001'"
  );
  assert.equal(expiredTenant.rows.length, 0);

  // User account and cloud billing account remain completely intact
  const userRow = await db.query("SELECT id FROM system_users WHERE id = 'owner-media'");
  assert.equal(userRow.rows.length, 1);
  const billingRow = await db.query("SELECT credits FROM cloud_billing_accounts WHERE user_id = 'owner-media'");
  assert.equal(Number(billingRow.rows[0].credits), 15);

  // Exclusive media deleted, shared media preserved
  assert.equal(await getMediaMetadata('/upload/exclusive-logo.png'), null);
  assert.equal(await getMediaMetadata('/upload/exclusive-product.png'), null);
  assert.ok(await getMediaMetadata('/upload/shared-banner.png'));
});

test('buildStoreDashboardNotifications produces grace, suspension countdown, and 80%/100% slot limit alerts', () => {
  const now = new Date('2026-12-05T00:00:00.000Z');

  const alerts = buildStoreDashboardNotifications({
    now,
    userStores: [
      {
        tiwiId: 'TIW-GRACE',
        storeName: 'Grace Store',
        planId: 'growth',
        status: 'active',
        lifecycleStatus: 'grace_period',
        graceEndsAt: '2026-12-07T00:00:00.000Z'
      },
      {
        tiwiId: 'TIW-SUSP',
        storeName: 'Suspended Store',
        planId: 'pro',
        status: 'suspended',
        lifecycleStatus: 'suspended',
        suspendedAt: '2026-12-01T00:00:00.000Z',
        scheduledDeletionAt: '2027-05-30T00:00:00.000Z'
      }
    ],
    tenantStoresMap: new Map([
      ['TIW-GRACE', { products: Array.from({ length: 8 }, (_, i) => ({ id: `p${i}` })), staff: [], sales: [] }],
      ['TIW-SUSP', { products: [], staff: [], sales: [] }]
    ]),
    subscriptionByStore: new Map([
      ['TIW-GRACE', { planId: 'growth', productLimit: 10, staffLimit: 3, monthlyOrderLimit: 100 }],
      ['TIW-SUSP', { planId: 'pro', productLimit: 100, staffLimit: 10, monthlyOrderLimit: 1000 }]
    ])
  });

  const graceAlert = alerts.find((a) => a.type === 'grace_period');
  assert.ok(graceAlert);
  assert.equal(graceAlert.severity, 'warning');
  assert.equal(graceAlert.daysRemaining, 2);
  assert.equal(graceAlert.ctaLabel, 'Add Funds & Renew');

  const suspAlert = alerts.find((a) => a.type === 'suspended_deletion_countdown');
  assert.ok(suspAlert);
  assert.equal(suspAlert.severity, 'critical');
  assert.equal(suspAlert.daysRemaining, 176);
  assert.equal(suspAlert.ctaLabel, 'Renew & Reactivate');

  const productLimitAlert = alerts.find((a) => a.type === 'slot_limit_warning' && a.metric === 'productLimit');
  assert.ok(productLimitAlert);
  assert.equal(productLimitAlert.usagePercent, 80);
  assert.deepEqual(productLimitAlert.actions.map((x) => x.action), ['addon', 'upgrade']);

  // Free account using 1 / 1 Free Store Slot + 100% product limit
  const freeAlerts = buildStoreDashboardNotifications({
    now,
    userStores: [
      { tiwiId: 'TIW-FREE', storeName: 'My Free Shop', planId: 'free', status: 'active' }
    ],
    tenantStoresMap: new Map([
      ['TIW-FREE', {
        products: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` })),
        staff: [{ id: 's1' }],
        sales: []
      }]
    ]),
    subscriptionByStore: new Map([
      ['TIW-FREE', { planId: 'free', price: 0, productLimit: 10, staffLimit: 1, monthlyOrderLimit: 50 }]
    ])
  });

  const freeSlotAlert = freeAlerts.find((a) => a.type === 'slot_limit_warning' && a.metric === 'freeStoreSlot');
  assert.ok(freeSlotAlert);
  assert.equal(freeSlotAlert.used, 1);
  assert.equal(freeSlotAlert.limit, 1);
  assert.deepEqual(freeSlotAlert.actions.map((x) => x.action), ['addon', 'upgrade']);

  const freeProductAlert = freeAlerts.find((a) => a.type === 'slot_limit_warning' && a.metric === 'productLimit');
  assert.ok(freeProductAlert);
  assert.equal(freeProductAlert.usagePercent, 100);
  assert.equal(freeProductAlert.severity, 'critical');

  // Verify syncStoreLifecycleOnPlanChange helper
  const paidLifecycle = syncStoreLifecycleOnPlanChange({ tiwiId: 'TIW-1', planId: 'growth', price: 19, now });
  assert.equal(paidLifecycle.lifecycleStatus, 'active');
  assert.equal(paidLifecycle.expiresAt, new Date(now.getTime() + BILLING_PERIOD_DAYS * 86400_000).toISOString());
  assert.equal(paidLifecycle.scheduledDeletionAt, null);

  const freeLifecycle = syncStoreLifecycleOnPlanChange({ tiwiId: 'TIW-2', planId: 'free', price: 0, now });
  assert.equal(freeLifecycle.lifecycleStatus, 'active');
  assert.equal(freeLifecycle.expiresAt, null);
});

test('grace period retry succeeds when funded and mutex prevents overlapping sweeps', async t => {
  const db = await setupLifecycleDb(t);
  const now = new Date('2026-12-05T00:00:00.000Z');

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('usr-retry', 'TIW-50001', 'Eve', 'Eve Shop', 'eve@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (user_id, credits) VALUES ('usr-retry', 30.00)`
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', $1::jsonb),
            ('tenant', 'TIW-50001', $2::jsonb)`,
    [
      JSON.stringify({
        stores: [
          {
            tiwiId: 'TIW-50001',
            ownerId: 'usr-retry',
            storeName: 'Eve Shop',
            subdomain: 'eve.tiwlo.com',
            planId: 'growth',
            status: 'active',
            lifecycleStatus: 'grace_period',
            graceStartedAt: '2026-12-01T00:00:00.000Z',
            graceEndsAt: '2026-12-04T00:00:00.000Z'
          }
        ],
        subscriptions: [
          {
            tiwiId: 'TIW-50001',
            planId: 'growth',
            planName: 'Growth Retailer',
            price: 19,
            billingCycle: 'monthly',
            lifecycleStatus: 'grace_period',
            graceEndsAt: '2026-12-04T00:00:00.000Z'
          }
        ]
      }),
      JSON.stringify({
        tiwiId: 'TIW-50001',
        storeName: 'Eve Shop',
        products: [],
        subscription: { planId: 'growth', planName: 'Growth Retailer', price: 19, lifecycleStatus: 'grace_period' }
      })
    ]
  );

  // Simulate an overlapping sweep while the first sweep is mid-flight
  let chargeCalls = 0;
  let releaseSlowMaster;
  const slowGate = new Promise((resolve) => { releaseSlowMaster = resolve; });
  const slowMasterDb = {
    async getMasterData() {
      await slowGate;
      return MasterDB.getMasterData();
    },
    async saveMasterData(data) {
      return MasterDB.saveMasterData(data);
    },
    async deleteStoreForUser(u, s) {
      return MasterDB.deleteStoreForUser(u, s);
    }
  };
  const trackingBillingDb = {
    async chargeSubscriptionPlan(userId, amount, label) {
      chargeCalls++;
      return BillingDB.chargeSubscriptionPlan(userId, amount, label);
    }
  };

  const firstRun = processStoreSubscriptionLifecycle({
    now,
    masterDb: slowMasterDb,
    billingDb: trackingBillingDb
  });
  const overlappingRun = await processStoreSubscriptionLifecycle({
    now,
    billingDb: trackingBillingDb
  });
  assert.equal(overlappingRun.skipped, true);

  releaseSlowMaster();
  const firstResult = await firstRun;
  assert.equal(firstResult.renewed, 1);
  assert.equal(chargeCalls, 1);

  const master = await MasterDB.getMasterData();
  assert.equal(master.stores[0].lifecycleStatus, 'active');
  assert.equal(master.stores[0].graceEndsAt, null);
  assert.equal(
    master.stores[0].expiresAt,
    new Date(now.getTime() + BILLING_PERIOD_DAYS * 86400_000).toISOString()
  );
});

test('createStoreForUser initializes 30-day lifecycle fields for paid stores', async t => {
  const db = await setupLifecycleDb(t);

  await db.query(
    `INSERT INTO system_users (id, tiwi_id, name, store_name, email, role)
     VALUES ('usr-paid', 'TIW-60000', 'Frank', 'Frank Co', 'frank@example.com', 'owner')`
  );
  await db.query(
    `INSERT INTO cloud_billing_accounts (user_id, credits) VALUES ('usr-paid', 100.00)`
  );
  await db.query(
    `INSERT INTO system_state_documents (namespace, document_key, data)
     VALUES ('master', 'directory', '{"stores":[],"subscriptions":[]}'::jsonb)`
  );

  const created = await MasterDB.createStoreForUser({
    userId: 'usr-paid',
    storeName: 'Frank Paid Store',
    subdomain: 'frankpaid',
    planId: 'growth'
  });

  assert.equal(created.planId, 'growth');
  assert.equal(created.lifecycleStatus, 'active');
  assert.equal(created.subscriptionStatus, 'active');
  assert.ok(created.currentPeriodStart);
  assert.ok(created.expiresAt);
  const diffDays = Math.round(
    (new Date(created.expiresAt).getTime() - new Date(created.currentPeriodStart).getTime()) / 86400_000
  );
  assert.equal(diffDays, 30);

  const tenant = await TenantDB.getStoreDb(created.tiwiId);
  assert.equal(tenant.subscription.lifecycleStatus, 'active');
  assert.equal(tenant.subscription.expiresAt, created.expiresAt);
});
