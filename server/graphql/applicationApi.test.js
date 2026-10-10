import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApplicationGraphQL } from './applicationApi.js';
import { createGraphQLMiddleware } from './index.js';
import { TenantDB, MasterDB } from '../db/multiTenant.js';

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return async (query, variables, headers = {}, endpoint = '/api/graphql') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ query, variables })
    });
    return { response, body: await response.json() };
  };
}

test('application GraphQL preserves authentication, parameters, cookies and errors', async t => {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (req.headers.authorization === 'Bearer valid') req.activeUser = { id: 'owner', tiwiId: 'own' }; next(); });
  const router = express.Router();
  router.use(async (req, res, next) => { if (!req.activeUser) return res.status(401).json({ error: 'Login required' }); next(); });
  router.get('/records/:id', (req, res) => res.json({ id: req.params.id, filter: req.query.filter, owner: req.activeUser.id }));
  router.post('/records', async (req, res) => { res.cookie('tiwlo_session', 'signed-token', { httpOnly: true }); res.status(201).json({ title: req.body.title, owner: req.activeUser.id }); });
  router.get('/failure', async () => { throw Object.assign(new Error('Conflict'), { status: 409 }); });
  app.post('/api/graphql', createApplicationGraphQL([['/api', router]]));
  const call = await serve(t, app);
  const manifest = await call('{applicationOperations{field method path}}');
  assert.equal(manifest.body.data.applicationOperations.length, 3);
  const query = 'query($input:ApplicationInput){result:getApiRecordsByid(input:$input){status body}}';
  assert.equal((await call(query, { input: { params: { id: '1' }, body: { activeUser: { id: 'fake' } } } })).body.data.result.status, 401);
  const authenticated = { authorization: 'Bearer valid' };
  const read = await call(query, { input: { params: { id: 'a/b' }, query: { filter: 'active' } } }, authenticated);
  assert.deepEqual(read.body.data.result, { status: 200, body: { id: 'a/b', filter: 'active', owner: 'owner' } });
  const write = await call('mutation($input:ApplicationInput){postApiRecords(input:$input){status body}}', { input: { body: { title: 'Saved', activeUser: { id: 'fake' } } } }, authenticated);
  assert.equal(write.body.data.postApiRecords.status, 201);
  assert.equal(write.body.data.postApiRecords.body.owner, 'owner');
  assert.match(write.response.headers.get('set-cookie'), /tiwlo_session=signed-token/);
  assert.equal((await call('{getApiFailure{status body}}', {}, authenticated)).body.data.getApiFailure.status, 409);
  assert.equal((await call('{a:getApiFailure{status} b:getApiFailure{status}}', {}, authenticated)).response.status, 400);
});

test('typed GraphQL rejects anonymous and other-tenant access', async t => {
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (req.headers.authorization) req.activeUser = { id: 'owner', tiwiId: 'own', role: 'owner' }; next(); });
  app.post('/graphql', createGraphQLMiddleware());
  t.mock.method(MasterDB, 'getUserStores', async () => [{ tiwiId: 'own' }]);
  t.mock.method(TenantDB, 'getProducts', async id => { assert.equal(id, 'own'); return []; });
  const call = await serve(t, app);
  assert.ok((await call('{products(tiwiId:"own"){id}}', {}, {}, '/graphql')).body.errors);
  assert.ok((await call('{products(tiwiId:"other"){id}}', {}, { authorization: 'owner' }, '/graphql')).body.errors);
  assert.deepEqual((await call('{products(tiwiId:"own"){id}}', {}, { authorization: 'owner' }, '/graphql')).body.data.products, []);
});
