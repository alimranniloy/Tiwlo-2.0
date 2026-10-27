import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import verificationRoutes from './verificationRoutes.js';

const originalFetch = globalThis.fetch;

async function createClient(t) {
  const app = express();
  app.use((req, _res, next) => {
    if (req.headers['x-user-id']) req.activeUser = { id: req.headers['x-user-id'] };
    next();
  });
  app.use('/api/verification', verificationRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, options = {}) => originalFetch(
    `http://127.0.0.1:${server.address().port}${path}`,
    options
  );
}

async function createImage() {
  return sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 120, g: 140, b: 160 }
    }
  }).png().toBuffer();
}

function createForm(image, { consent = 'true' } = {}) {
  const form = new FormData();
  form.append('document', new Blob([image], { type: 'image/png' }), 'document.png');
  form.append('selfie', new Blob([image], { type: 'image/png' }), 'selfie.png');
  form.append('consent', consent);
  return form;
}

test('face match requires an authenticated user and explicit consent', async t => {
  const call = await createClient(t);
  const image = await createImage();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('The engine must not be called for invalid requests.');
  });

  const unauthenticated = await call('/api/verification/face-match', {
    method: 'POST',
    body: createForm(image)
  });
  assert.equal(unauthenticated.status, 401);

  const noConsent = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { consent: 'false' })
  });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.headers.get('cache-control'), 'no-store');
});

test('face match forwards validated images and requires a live matching face', async t => {
  const call = await createClient(t);
  const image = await createImage();
  const previousToken = process.env.OPENBIOMETRICS_SHARED_TOKEN;
  process.env.OPENBIOMETRICS_SHARED_TOKEN = 'test-token';
  t.after(() => {
    if (previousToken === undefined) delete process.env.OPENBIOMETRICS_SHARED_TOKEN;
    else process.env.OPENBIOMETRICS_SHARED_TOKEN = previousToken;
  });
  const engineCall = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(String(url), 'http://127.0.0.1:8000/api/v1/faces/verify');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['x-tiwlo-biometrics-token'], 'test-token');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('image1').type, 'image/png');
    assert.equal(options.body.get('image2').type, 'image/png');
    return Response.json({
      is_match: true,
      similarity: 0.9,
      face2: { liveness: { is_live: true } }
    });
  });

  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image)
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    isMatch: true,
    isLive: true,
    reason: null
  });
  assert.equal(engineCall.mock.callCount(), 1);
});

test('a face match without a positive liveness result is never accepted', async t => {
  const call = await createClient(t);
  const image = await createImage();
  const previousToken = process.env.OPENBIOMETRICS_SHARED_TOKEN;
  process.env.OPENBIOMETRICS_SHARED_TOKEN = 'test-token';
  t.after(() => {
    if (previousToken === undefined) delete process.env.OPENBIOMETRICS_SHARED_TOKEN;
    else process.env.OPENBIOMETRICS_SHARED_TOKEN = previousToken;
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    is_match: true,
    face2: { liveness: { is_live: false } }
  }));

  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image)
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    isMatch: false,
    isLive: false,
    reason: 'liveness_check_failed'
  });
});
