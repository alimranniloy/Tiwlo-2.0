import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { signupIdentitySchema } from './signupIdentitySchema.js';
import { signupEmailKey } from '../security/signupIdentity.js';

test('PostgreSQL signup enforcement handles aliases, legacy data, updates and rollback', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE system_users (id TEXT PRIMARY KEY, email TEXT UNIQUE, is_banned BOOLEAN DEFAULT false);
      INSERT INTO system_users VALUES ('legacy-1', 'old.user@gmail.com', false), ('legacy-2', 'olduser+tag@gmail.com', false);`);
    await db.exec(signupIdentitySchema);
    await db.exec(signupIdentitySchema); // Idempotent migration, including preexisting duplicates.
    for (const email of ['test.user+tag@gmail.com', 'testuser@googlemail.com', 'person+tag@company.com']) {
      assert.equal((await db.query('SELECT tiwlo_signup_email_key($1) AS key', [email])).rows[0].key, signupEmailKey(email));
    }
    const insert = (id, email) => db.query('INSERT INTO system_users (id, email) VALUES ($1, $2)', [id, email]);
    const duplicate = { code: '23505', constraint: 'system_users_signup_email_unique' };
    await assert.rejects(insert('legacy-3', 'olduser+another@googlemail.com'), duplicate);
    await db.query("UPDATE system_users SET is_banned = true WHERE id = 'legacy-1'");
    await assert.rejects(insert('ban-evade', 'o.lduser@gmail.com'), duplicate);
    await insert('one', 'one.user@gmail.com');
    await assert.rejects(insert('two', 'oneuser+another@googlemail.com'), duplicate);
    await insert('custom-one', 'user@company.com');
    await insert('custom-two', 'u.ser@company.com');
    await insert('custom-three', 'user+tag@company.com');
    await assert.rejects(db.query("UPDATE system_users SET email = 'oneuser+change@gmail.com' WHERE id = 'custom-one'"), duplicate);
    await db.query("UPDATE system_users SET email = 'oneuser+own@gmail.com' WHERE id = 'one'");
    await db.exec('BEGIN');
    await insert('rolled-back', 'rollback@gmail.com');
    await db.exec('ROLLBACK');
    await insert('after-rollback', 'roll.back@gmail.com');
    const burst = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => insert(`burst-${i}`, `burst+${i}@gmail.com`)));
    assert.equal(burst.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(burst.filter(result => result.status === 'rejected' && result.reason.code === '23505').length, 11);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM system_users WHERE tiwlo_signup_email_key(email) = 'olduser@gmail.com'")).rows[0].count, 2);
  } finally {
    await db.close();
  }
});
