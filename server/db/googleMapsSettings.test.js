import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { getGoogleMapsApiKey, getGoogleMapsSettingsStatus, normalizeGoogleMapsApiKey, saveGoogleMapsApiKey } from './googleMapsSettings.js';
import { getPgPool } from './postgres.js';

test('Google Maps key is stored in PostgreSQL and only exposed as a hint in settings status', async t => {
  const db = new PGlite();
  const pool = getPgPool();
  t.mock.method(pool, 'query', async (sql, params) =>
    params?.length ? db.query(sql, params) : (await db.exec(sql)).at(-1)
  );
  t.after(async () => {
    await db.close();
    await pool.end();
  });
  await db.exec(`
    CREATE TABLE system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  assert.deepEqual(await getGoogleMapsSettingsStatus(), { configured: false, keyHint: '' });
  const apiKey = 'AIzaSyExampleGoogleMapsApiKey123456789';
  const status = await saveGoogleMapsApiKey(apiKey);
  assert.equal(status.configured, true);
  assert.equal(status.keyHint, 'AIza••••••••6789');
  assert.equal(await getGoogleMapsApiKey(), apiKey);
  assert.equal(JSON.stringify(status).includes(apiKey), false);
  assert.deepEqual(await saveGoogleMapsApiKey(''), { configured: false, keyHint: '' });
  assert.equal(await getGoogleMapsApiKey(), '');
});

test('Google Maps API key input is normalized and rejects invalid values', () => {
  assert.equal(normalizeGoogleMapsApiKey('  AIzaExampleKey  '), 'AIzaExampleKey');
  assert.throws(() => normalizeGoogleMapsApiKey(''), /valid Google Maps API key/);
  assert.throws(() => normalizeGoogleMapsApiKey('has\nnewline'), /valid Google Maps API key/);
  assert.throws(() => normalizeGoogleMapsApiKey('x'.repeat(513)), /valid Google Maps API key/);
});
