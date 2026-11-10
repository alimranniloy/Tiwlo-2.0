import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { STALE_PENDING_PICK_ORDERS_SQL } from './payments.js';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');

test('only selects pending and timed-out PICK orders after 24 hours for deletion', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA pick;
      CREATE TABLE pick.orders (
        id UUID PRIMARY KEY,
        status VARCHAR(32) NOT NULL,
        payment_status VARCHAR(24) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      INSERT INTO pick.orders (id, status, payment_status, created_at) VALUES
        ('00000000-0000-4000-8000-000000000001', 'pending_payment', 'pending', CURRENT_TIMESTAMP - INTERVAL '25 hours'),
        ('00000000-0000-4000-8000-000000000002', 'pending', 'unpaid', CURRENT_TIMESTAMP - INTERVAL '25 hours'),
        ('00000000-0000-4000-8000-000000000003', 'placed', 'paid', CURRENT_TIMESTAMP - INTERVAL '25 hours'),
        ('00000000-0000-4000-8000-000000000004', 'payment_failed', 'failed', CURRENT_TIMESTAMP - INTERVAL '25 hours'),
        ('00000000-0000-4000-8000-000000000005', 'pending_payment', 'pending', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
        ('00000000-0000-4000-8000-000000000006', 'cancelled', 'expired', CURRENT_TIMESTAMP - INTERVAL '25 hours'),
        ('00000000-0000-4000-8000-000000000007', 'cancelled', 'cancelled', CURRENT_TIMESTAMP - INTERVAL '25 hours');
    `);

    const result = await db.query(STALE_PENDING_PICK_ORDERS_SQL);
    assert.deepEqual(result.rows.map((row) => row.id).sort(), [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000006'
    ]);
  } finally {
    await db.close();
  }
});
