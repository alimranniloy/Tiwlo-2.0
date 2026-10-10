import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { getPgPool } from '../db/postgres.js';
import { createPostgresAuthState } from './whatsappManager.js';

test('WhatsApp Baileys credentials and keys persist in PostgreSQL', async t => {
  const db = new PGlite();
  t.mock.method(getPgPool(), 'query', async (sql, params) => params?.length ? db.query(sql, params) : (await db.exec(sql)).at(-1));
  t.after(async () => { await db.close(); await getPgPool().end(); });
  await db.exec(`CREATE TABLE whatsapp_auth_state (
    state_key TEXT PRIMARY KEY, data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const first = await createPostgresAuthState('wa_test');
  first.state.creds.account = { secret: Buffer.from([1, 2, 3]) };
  await first.saveCreds();
  await first.state.keys.set({ 'pre-key': { '42': { private: Buffer.from([4]), public: Buffer.from([5]) } } });

  const restored = await createPostgresAuthState('wa_test');
  assert.deepEqual(restored.state.creds.account.secret, Buffer.from([1, 2, 3]));
  const keys = await restored.state.keys.get('pre-key', ['42', 'missing']);
  assert.deepEqual(keys['42'].private, Buffer.from([4]));
  assert.deepEqual(keys['42'].public, Buffer.from([5]));
  assert.equal(keys.missing, undefined);

  await restored.state.keys.set({ 'pre-key': { '42': null } });
  assert.deepEqual(await restored.state.keys.get('pre-key', ['42']), {});
});
