import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { STATE_SCHEMA_SQL } from './stateDocuments.js';
import { runMigration } from './migrate.js';

test('tenant upgrade is atomic, idempotent and preserves source backups', async t => {
  const db = new PGlite();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tiwlo-upgrade-'));
  const pool = { connect: async () => ({ query: (sql, params) => db.query(sql, params), release() {} }) };
  t.after(async () => { await db.close(); await fs.rm(directory, { recursive: true, force: true }); });
  await db.exec(STATE_SCHEMA_SQL);
  await db.exec(`CREATE TABLE system_users (
    id text primary key, tiwi_id text, name text, store_name text, email text unique,
    password text, password_hash text, role text, plan_id text, plan_name text,
    avatar text, cover_photo text, phone text, subdomain text, is_banned boolean,
    ban_reason text, two_factor_enabled boolean, email_verified boolean, auth_method text,
    created_at timestamptz, account_type text, business_name text, address text
  )`);
  const stores = path.join(directory, 'db', 'stores');
  await fs.mkdir(stores, { recursive: true });
  await fs.writeFile(path.join(stores, 'registry.json'), JSON.stringify([{ tiwiId: 'TIW-1', ownerId: 'u1' }]));
  await fs.writeFile(path.join(stores, 'TIW-1.json'), '{corrupt');
  await fs.writeFile(path.join(directory, 'users.json'), JSON.stringify([{ id: 'u1', email: 'u1@example.com', password: 'hash', tiwiId: 'TIW-1' }]));
  await assert.rejects(runMigration(directory, pool), /Cannot migrate/);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM system_state_documents')).rows[0].count, 0);
  await fs.writeFile(path.join(stores, 'TIW-1.json'), JSON.stringify({ tiwiId: 'TIW-1', products: [{ id: 'p1' }] }));
  assert.equal(await runMigration(directory, pool), 3);
  assert.equal(await runMigration(directory, pool), 0);
  const row = (await db.query("SELECT data FROM system_state_documents WHERE namespace='tenant'")).rows[0];
  assert.equal(row.data.products[0].id, 'p1');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM system_users')).rows[0].count, 1);
  assert.ok(await fs.stat(path.join(stores, 'TIW-1.json')));
});
