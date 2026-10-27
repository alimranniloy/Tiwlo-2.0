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

function createRecording() {
  const bytes = new Uint8Array(16);
  bytes.set([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

function createForm(image, { consent = 'true', sessionId = '' } = {}) {
  const form = new FormData();
  form.append('document', new Blob([image], { type: 'image/png' }), 'document.png');
  form.append('selfie', new Blob([image], { type: 'image/png' }), 'selfie.png');
  form.append('recording', new Blob([createRecording()], { type: 'video/mp4' }), 'liveness.mp4');
  form.append('livenessSessionId', sessionId);
  form.append('consent', consent);
  return form;
}

async function createCompletedSession(call) {
  const response = await call('/api/verification/liveness/session', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' }
  });
  assert.equal(response.status, 201);
  const session = await response.json();

  const frame = new FormData();
  frame.append('frame', new Blob([await createImage()], { type: 'image/png' }), 'frame.png');
  const frameResponse = await call(`/api/verification/liveness/${session.sessionId}/frame`, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: frame
  });
  assert.equal(frameResponse.status, 200);
  assert.equal((await frameResponse.json()).complete, true);
  return session.sessionId;
}

test('face match requires an authenticated user', async t => {
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
    const target = String(url);
    assert.equal(options.headers['x-tiwlo-biometrics-token'], 'test-token');
    if (target.endsWith('/api/v1/liveness/sessions?preset=verification')) {
      return Response.json({
        session_id: 'active-session-1',
        challenges: ['turn_right', 'blink', 'turn_left', 'open_mouth'].map(type => ({ type, instruction: type }))
      });
    }
    if (target.endsWith('/api/v1/liveness/sessions/active-session-1/frame')) {
      return Response.json({
        session_id: 'active-session-1',
        challenge_type: 'open_mouth',
        passed: true,
        challenges_remaining: 0,
        session_complete: true,
        is_live: true,
        state: 'completed'
      });
    }
    assert.equal(target, 'http://127.0.0.1:8000/api/v1/faces/verify');
    assert.equal(options.method, 'POST');
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get('image1').type, 'image/png');
    assert.equal(options.body.get('image2').type, 'image/png');
    return Response.json({
      is_match: true,
      similarity: 0.9,
      face2: { liveness: { is_live: true } }
    });
  });

  const sessionId = await createCompletedSession(call);
  const otherUserResponse = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-2' },
    body: createForm(image, { sessionId })
  });
  assert.equal(otherUserResponse.status, 400);

  const noConsent = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { consent: 'false', sessionId })
  });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.headers.get('cache-control'), 'no-store');

  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { sessionId })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    isMatch: true,
    isLive: true,
    reason: null
  });
  assert.equal(engineCall.mock.callCount(), 3);
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
  const engineCall = t.mock.method(globalThis, 'fetch', async (url) => {
    const target = String(url);
    if (target.endsWith('/api/v1/liveness/sessions?preset=verification')) {
      return Response.json({
        session_id: 'active-session-2',
        challenges: ['turn_right', 'blink', 'turn_left', 'open_mouth'].map(type => ({ type, instruction: type }))
      });
    }
    if (target.endsWith('/api/v1/liveness/sessions/active-session-2/frame')) {
      return Response.json({
        session_id: 'active-session-2',
        challenge_type: 'open_mouth',
        passed: true,
        challenges_remaining: 0,
        session_complete: true,
        is_live: true,
        state: 'completed'
      });
    }
    return Response.json({
      is_match: true,
      face2: { liveness: { is_live: false } }
    });
  });

  const sessionId = await createCompletedSession(call);
  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { sessionId })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    isMatch: false,
    isLive: false,
    reason: 'liveness_check_failed'
  });
  assert.equal(engineCall.mock.callCount(), 3);
});

test('face match cannot be submitted without a completed server liveness session', async t => {
  const call = await createClient(t);
  const image = await createImage();
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('The engine must not be called without a completed session.');
  });
  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image)
  });
  assert.equal(response.status, 400);
});
