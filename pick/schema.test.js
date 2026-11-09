import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { REVIEW_PICK_DELIVERY_APPLICATION_SQL } from './adminRoutes.js';
import { PICK_DELIVERY_REVIEW_SCHEMA_SQL } from './schema.js';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');

test('delivery review schema upgrades existing profiles and remains repeatable', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA pick;
      CREATE TABLE system_users (id VARCHAR(64) PRIMARY KEY);
      CREATE TABLE pick.delivery_profiles (
        tiwlo_user_id VARCHAR(64) PRIMARY KEY,
        application_status VARCHAR(16) NOT NULL DEFAULT 'pending',
        application_note TEXT NOT NULL DEFAULT '',
        is_on_duty BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO system_users (id) VALUES ('admin-1');
      INSERT INTO pick.delivery_profiles (tiwlo_user_id) VALUES ('rider-1');
    `);

    await db.exec(PICK_DELIVERY_REVIEW_SCHEMA_SQL);
    await db.exec(PICK_DELIVERY_REVIEW_SCHEMA_SQL);
    const result = await db.query(REVIEW_PICK_DELIVERY_APPLICATION_SQL, [
      'rider-1', 'approved', '', 'admin-1',
    ]);

    assert.equal(result.rows[0].applicationStatus, 'approved');
    assert.ok(result.rows[0].reviewedAt);
    const review = await db.query(
      'SELECT reviewed_by FROM pick.delivery_profiles WHERE tiwlo_user_id = $1',
      ['rider-1'],
    );
    assert.equal(review.rows[0].reviewed_by, 'admin-1');
  } finally {
    await db.close();
  }
});
