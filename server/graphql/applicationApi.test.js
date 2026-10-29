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
  app.use((req, _res, next) => { if (req.activeUser) req.activeUser.addressVerified = true; next(); });
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

test('identity-required users can access only authentication and verification operations', async t => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.activeUser = {
      id: 'locked-user',
      identityVerificationRequired: true,
      identityVerified: false
    };
    next();
  });
  const router = express.Router();
  router.get('/auth/sync-session', (_req, res) => res.json({ authenticated: true }));
  router.get('/records', (_req, res) => res.json({ records: [] }));
  router.post('/verification/handoff', (_req, res) => res.status(201).json({ session: 'created' }));
  app.post('/api/graphql', createApplicationGraphQL([['/api', router]]));
  const call = await serve(t, app);

  const restricted = await call(
    'query($input:ApplicationInput){result:getApiRecords(input:$input){status body}}',
    { input: {} }
  );
  assert.equal(restricted.body.data.result.status, 403);
  assert.equal(restricted.body.data.result.body.code, 'IDENTITY_VERIFICATION_REQUIRED');

  const sessionSync = await call(
    'query($input:ApplicationInput){result:getApiAuthSync_session(input:$input){status body}}',
    { input: {} }
  );
  assert.deepEqual(sessionSync.body.data.result, {
    status: 200,
    body: { authenticated: true }
  });

  const verification = await call(
    'mutation($input:ApplicationInput){result:postApiVerificationHandoff(input:$input){status body}}',
    { input: {} }
  );
  assert.equal(verification.body.data.result.status, 201);
});

test('address-unverified users can sync sessions but cannot access protected operations', async t => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.activeUser = {
      id: 'address-pending-user',
      identityVerified: true,
      addressVerified: false
    };
    next();
  });
  const router = express.Router();
  router.get('/auth/sync-session', (_req, res) => res.json({ authenticated: true }));
  router.post('/address-verification', (_req, res) => res.json({ verified: true }));
  router.get('/records', (_req, res) => res.json({ records: [] }));
  app.post('/api/graphql', createApplicationGraphQL([['/api', router]]));
  const call = await serve(t, app);

  const sessionSync = await call(
    'query($input:ApplicationInput){result:getApiAuthSync_session(input:$input){status body}}',
    { input: {} }
  );
  assert.deepEqual(sessionSync.body.data.result, {
    status: 200,
    body: { authenticated: true }
  });

  const verification = await call(
    'mutation($input:ApplicationInput){result:postApiAddress_verification(input:$input){status body}}',
    { input: { body: { latitude: 24, longitude: 90, accuracy: 500 } } }
  );
  assert.deepEqual(verification.body.data.result, {
    status: 200,
    body: { verified: true }
  });

  const protectedRequest = await call(
    'query($input:ApplicationInput){result:getApiRecords(input:$input){status body}}',
    { input: {} }
  );
  assert.equal(protectedRequest.body.data.result.status, 403);
  assert.equal(protectedRequest.body.data.result.body.code, 'ADDRESS_VERIFICATION_REQUIRED');
});

test('production GraphQL hides the explorer and rejects introspection', async t => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  const app = express();
  app.use(express.json());
  app.use('/graphql', createGraphQLMiddleware());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/graphql`;

  const explorer = await fetch(endpoint, { headers: { accept: 'text/html' } });
  assert.equal(explorer.status, 404);

  const introspection = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ __schema { types { name } } }' })
  });
  assert.equal(introspection.status, 400);
  assert.match((await introspection.json()).errors[0].message, /introspection/i);
});

test('GraphQL explorer is disabled by default when NODE_ENV is unset', async t => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousExplorerFlag = process.env.GRAPHQL_EXPLORER_ENABLED;
  delete process.env.NODE_ENV;
  delete process.env.GRAPHQL_EXPLORER_ENABLED;
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousExplorerFlag === undefined) delete process.env.GRAPHQL_EXPLORER_ENABLED;
    else process.env.GRAPHQL_EXPLORER_ENABLED = previousExplorerFlag;
  });

  const app = express();
  app.use(express.json());
  app.use('/graphql', createGraphQLMiddleware());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/graphql`;
  const response = await fetch(endpoint, { headers: { accept: 'text/html' } });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await response.text(), /GraphQL Explorer/);
});
