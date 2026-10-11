import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

test('account creation and browser reservation commit together or both roll back', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiwlo-signup-persistence-'));
  const previousEnvironment = Object.fromEntries([
    'TIWLO_DATA_DIR',
    'TIWLO_RUST_BACKEND_URL',
    'TIWLO_INTERNAL_IDENTITY_SECRET'
  ].map(key => [key, process.env[key]]));
  process.env.TIWLO_DATA_DIR = dataDir;
  process.env.TIWLO_RUST_BACKEND_URL = 'http://rust.test';
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET = 'test-only-auth-secret-'.padEnd(32, 'x');
  const db = new PGlite();
  const { getPgPool, initPgSchema } = await import('./postgres.js');
  const { MasterDB } = await import('./multiTenant.js');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://rust.test/v1/auth/passwords/hash');
    assert.equal(JSON.parse(options.body).password, 'isolated-test-password');
    return new Response(JSON.stringify({
      passwordHash: `scrypt$16384:8:1$${'a'.repeat(32)}$${'b'.repeat(128)}`
    }), { status: 200 });
  });
  t.mock.method(getPgPool(), 'query', async (sql, params) => {
    const testSql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/i, '');
    return params?.length
      ? db.query(testSql, params)
      : (await db.exec(testSql)).at(-1);
  });
  try {
    await initPgSchema();
    const create = (email, key, extra = {}) => MasterDB.createUser({
      email, password: 'isolated-test-password', name: 'Test',
      signupBrowserKey: key, ...extra
    });
    const first = await create('first@gmail.com', 'a'.repeat(64));
    assert.ok((await db.query('SELECT id FROM system_users WHERE id = $1', [first.id])).rows[0]);
    const runtimeCount = (await MasterDB.getMasterData()).users.length;
    await assert.rejects(create('second@gmail.com', 'a'.repeat(64)), {
      code: '23505', constraint: 'system_signup_browsers_pkey'
    });
    assert.equal((await db.query("SELECT count(*)::int AS count FROM system_users WHERE email = 'second@gmail.com'")).rows[0].count, 0);
    assert.equal((await MasterDB.getMasterData()).users.length, runtimeCount);
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
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
