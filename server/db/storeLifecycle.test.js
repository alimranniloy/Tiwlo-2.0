import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { getPgPool } from './postgres.js';
import { MasterDB } from './multiTenant.js';

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
