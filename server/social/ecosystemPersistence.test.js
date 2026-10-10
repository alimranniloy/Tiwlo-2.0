import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { getPgPool } from '../db/postgres.js';
import { STATE_SCHEMA_SQL } from '../db/stateDocuments.js';
import router from './ecosystemRoutes.js';

test('ecosystem records require the session identity and survive restart', async t => {
  const db = new PGlite();
  t.mock.method(getPgPool(), 'query', async (sql, params) => params?.length ? db.query(sql, params) : (await db.exec(sql)).at(-1));
  await db.exec(STATE_SCHEMA_SQL);
  t.after(async () => { await db.close(); await getPgPool().end(); });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers.authorization === 'owner-session') req.activeUser = { id: 'owner-1' };
    next();
  });
  app.use('/api/tiwi', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/tiwi`;

  const anonymous = await fetch(`${base}/polls`);
  assert.equal(anonymous.status, 401);
  const create = await fetch(`${base}/polls`, {
    method: 'POST',
    headers: { authorization: 'owner-session', 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'attacker', authorName: 'spoofed', question: 'Question?', options: ['A', 'B'] })
  });
  assert.equal(create.status, 201);
  const created = (await create.json()).poll;
  assert.equal(created.userId, 'owner-1');

  const restarted = await import('./ecosystemRoutes.js?restart');
  const secondApp = express();
  secondApp.use(express.json());
  secondApp.use((req, _res, next) => { req.activeUser = { id: 'owner-1' }; next(); });
  secondApp.use('/api/tiwi', restarted.default);
  const secondServer = secondApp.listen(0, '127.0.0.1');
  await new Promise(resolve => secondServer.once('listening', resolve));
  t.after(() => new Promise(resolve => secondServer.close(resolve)));
  const restored = await fetch(`http://127.0.0.1:${secondServer.address().port}/api/tiwi/polls`);
  assert.equal((await restored.json()).polls[0].id, created.id);

  const rejectedWallet = await fetch(`${base}/wallet/topup`, {
    method: 'POST',
    headers: { authorization: 'owner-session', 'content-type': 'application/json' },
    body: JSON.stringify({ amount: 100 })
  });
  assert.equal(rejectedWallet.status, 503);
});
