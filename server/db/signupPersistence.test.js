import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

test('account creation and browser reservation commit together or both roll back', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-signup-persistence-'));
  const previousDir = process.env.TIWLO_DATA_DIR;
  process.env.TIWLO_DATA_DIR = dataDir;
  const db = new PGlite();
  const { getPgPool, initPgSchema } = await import('./postgres.js');
  const { MasterDB } = await import('./multiTenant.js');
  t.mock.method(getPgPool(), 'query', async (sql, params) => params?.length
    ? db.query(sql, params)
    : (await db.exec(sql)).at(-1));
  try {
    await initPgSchema();
    const create = (email, key, extra = {}) => MasterDB.createUser({
      email, password: 'isolated-test-password', name: 'Test',
      signupBrowserKey: key, ...extra
    });
    const first = await create('first@gmail.com', 'a'.repeat(64));
    assert.ok((await db.query('SELECT id FROM system_users WHERE id = $1', [first.id])).rows[0]);
    const runtimeCount = MasterDB.getMasterData().users.length;
    await assert.rejects(create('second@gmail.com', 'a'.repeat(64)), {
      code: '23505', constraint: 'system_signup_browsers_pkey'
    });
    assert.equal((await db.query("SELECT count(*)::int AS count FROM system_users WHERE email = 'second@gmail.com'")).rows[0].count, 0);
    assert.equal(MasterDB.getMasterData().users.length, runtimeCount);
    await create('second@gmail.com', 'b'.repeat(64));
    await assert.rejects(create('f.irst+alias@googlemail.com', 'c'.repeat(64)), { code: 'DUPLICATE_ACCOUNT' });
    await assert.rejects(create('third@gmail.com', 'd'.repeat(64), { id: first.id }), { code: '23505' });
    assert.equal((await db.query('SELECT email FROM system_users WHERE id = $1', [first.id])).rows[0].email, 'first@gmail.com');
    // Trusted internal callers without a browser still persist their user row.
    await create('internal@example.com', null);
    assert.equal((await db.query('SELECT count(*)::int AS count FROM system_users')).rows[0].count, 3);
  } finally {
    await db.close();
    await getPgPool().end();
    if (previousDir === undefined) delete process.env.TIWLO_DATA_DIR;
    else process.env.TIWLO_DATA_DIR = previousDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
