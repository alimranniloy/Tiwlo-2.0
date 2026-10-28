import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import verificationRoutes from './verificationRoutes.js';

const originalFetch = globalThis.fetch;
let nextTestIp = 1;

async function createClient(t) {
  const clientIp = `198.51.100.${nextTestIp++}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', { configurable: true, value: clientIp });
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

test('verification QR links expire after five minutes and can only be redeemed once', async t => {
  const call = await createClient(t);
  const clock = { now: Date.now() };
  t.mock.method(Date, 'now', () => clock.now);
  const createdResponse = await call('/api/verification/handoff', { method: 'POST' });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(typeof created.sessionId, 'string');
  assert.equal(typeof created.sessionKey, 'string');
  assert.equal(typeof created.token, 'string');
  assert.ok(created.expiresAt > clock.now);
  assert.ok(created.expiresAt <= clock.now + 5 * 60 * 1000);

  const headers = { 'x-verification-session-key': created.sessionKey };
  clock.now += 5 * 60 * 1000 + 1;
  const rotateResponse = await call(
    `/api/verification/handoff/${created.sessionId}/rotate`,
    { method: 'POST', headers }
  );
  assert.equal(rotateResponse.status, 201);
  const rotated = await rotateResponse.json();

  const oldToken = await call('/api/verification/handoff/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: created.token })
  });
  assert.equal(oldToken.status, 410);

  const redeemed = await call('/api/verification/handoff/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rotated.token })
  });
  assert.equal(redeemed.status, 200);
  const mobileSession = await redeemed.json();
  assert.equal(mobileSession.sessionId, created.sessionId);
  assert.equal(typeof mobileSession.accessToken, 'string');

  const secondRedeem = await call('/api/verification/handoff/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rotated.token })
  });
  assert.equal(secondRedeem.status, 410);

  const status = await call(
    `/api/verification/handoff/${created.sessionId}/status`,
    { headers }
  );
  assert.equal((await status.json()).status, 'connected');

  const closed = await call(`/api/verification/handoff/${created.sessionId}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mobileSession.accessToken}` }
  });
  assert.equal(closed.status, 204);
  const unavailable = await call(
    `/api/verification/handoff/${created.sessionId}/status`,
    { headers }
  );
  assert.equal(unavailable.status, 404);
});

test('a redeemed mobile link can complete verification without an authenticated account', async t => {
  const call = await createClient(t);
  const handoffResponse = await call('/api/verification/handoff', { method: 'POST' });
  const handoff = await handoffResponse.json();
  const redeemResponse = await call('/api/verification/handoff/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: handoff.token })
  });
  assert.equal(redeemResponse.status, 200);
  const { accessToken } = await redeemResponse.json();
  const guestHeaders = { Authorization: `Bearer ${accessToken}` };

  const previousToken = process.env.OPENBIOMETRICS_SHARED_TOKEN;
  process.env.OPENBIOMETRICS_SHARED_TOKEN = 'test-token';
  t.after(() => {
    if (previousToken === undefined) delete process.env.OPENBIOMETRICS_SHARED_TOKEN;
    else process.env.OPENBIOMETRICS_SHARED_TOKEN = previousToken;
  });
  const engineCall = t.mock.method(globalThis, 'fetch', async url => {
    const target = String(url);
    if (target.endsWith('/api/v1/liveness/sessions?preset=verification')) {
      return Response.json({
        session_id: 'guest-liveness-1',
        challenges: ['turn_right', 'blink', 'turn_left', 'open_mouth'].map(type => ({ type, instruction: type }))
      });
    }
    if (target.endsWith('/api/v1/liveness/sessions/guest-liveness-1/frame')) {
      return Response.json({
        session_id: 'guest-liveness-1',
        challenge_type: 'open_mouth',
        passed: true,
        challenges_remaining: 0,
        session_complete: true,
        is_live: true,
        state: 'completed'
      });
    }
    assert.equal(target, 'http://127.0.0.1:8000/api/v1/verify');
    return Response.json({
      is_match: true,
      face2: { liveness: { is_live: true } }
    });
  });

  const livenessResponse = await call('/api/verification/liveness/session', {
    method: 'POST',
    headers: guestHeaders
  });
  assert.equal(livenessResponse.status, 201);

  const frame = new FormData();
  frame.append('frame', new Blob([await createImage()], { type: 'image/png' }), 'frame.png');
  const frameResponse = await call('/api/verification/liveness/guest-liveness-1/frame', {
    method: 'POST',
    headers: guestHeaders,
    body: frame
  });
  assert.equal(frameResponse.status, 200);
  assert.equal((await frameResponse.json()).complete, true);

  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: guestHeaders,
    body: createForm(await createImage(), { sessionId: 'guest-liveness-1' })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    isMatch: true,
    isLive: true,
    reason: null
  });
  assert.equal(engineCall.mock.callCount(), 3);

  const status = await call(
    `/api/verification/handoff/${handoff.sessionId}/status`,
    { headers: { 'x-verification-session-key': handoff.sessionKey } }
  );
  assert.deepEqual(await status.json(), { status: 'success', result: null });
});

test('camera framing feedback waits for one centered, focused face but permits low light', async t => {
  const call = await createClient(t);
  const image = await createImage(640, 480);
  const portraitImage = await createImage(480, 640);
  const responses = [
    { count: 0, faces: [] },
    { count: 2, faces: [{}, {}] },
    {
      count: 1,
      faces: [{ detection: { bbox: [20, 100, 100, 260] }, quality: { sharpness: 50, brightness: 100, head_pose_ok: true } }]
    },
    {
      count: 1,
      faces: [{ detection: { bbox: [240, 120, 400, 360] }, quality: { sharpness: 20, brightness: 100, head_pose_ok: true } }]
    },
    {
      count: 1,
      faces: [{ detection: { bbox: [240, 120, 400, 360] }, quality: { sharpness: 40, brightness: 28, head_pose_ok: true } }]
    },
    { count: 1, faces: [{ detection: { bbox: [30, 120, 190, 360] }, quality: { sharpness: 50, head_pose_ok: true } }] },
    { count: 1, faces: [{ detection: { bbox: [450, 120, 610, 360] }, quality: { sharpness: 50, head_pose_ok: true } }] },
    { count: 1, faces: [{ detection: { bbox: [240, 10, 400, 150] }, quality: { sharpness: 50, head_pose_ok: true } }] },
    { count: 1, faces: [{ detection: { bbox: [240, 330, 400, 470] }, quality: { sharpness: 50, head_pose_ok: true } }] },
    { count: 1, faces: [{ detection: { bbox: [160, 200, 320, 440] }, quality: { sharpness: 50, head_pose_ok: true } }] },
    { count: 1, faces: [{ detection: { bbox: [240, 120, 400, 360] }, quality: { sharpness: 50, head_pose_ok: false } }] }
  ];
  const engineCall = t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), 'http://127.0.0.1:8000/api/v1/detect');
    return Response.json(responses.shift());
  });

  for (const [expected, guidance, frame] of [
    [false, 'no_face', image],
    [false, 'multiple_faces', image],
    [false, 'move_closer', image],
    [false, 'hold_still', image],
    [true, null, image],
    [false, 'center_left', image],
    [false, 'center_right', image],
    [false, 'center_lower', image],
    [false, 'center_upper', image],
    [true, null, portraitImage],
    [true, null, image]
  ]) {
    const body = new FormData();
    body.append('frame', new Blob([frame], { type: 'image/png' }), 'frame.png');
    const response = await call('/api/verification/liveness/quality', {
      method: 'POST',
      headers: { 'x-user-id': 'user-1' },
      body
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.ready, expected);
    assert.equal(result.guidance, guidance);
  }
  assert.equal(engineCall.mock.callCount(), 11);
});

test('camera alignment and final selfie capture do not block on coarse head-pose estimates', async t => {
  const call = await createClient(t);
  const image = await createImage(640, 480);
  const engineCall = t.mock.method(globalThis, 'fetch', async () => Response.json({
    count: 1,
    faces: [{
      detection: { bbox: [240, 120, 400, 360] },
      quality: { sharpness: 50, brightness: 100, head_pose_ok: false }
    }]
  }));

  const getQuality = async path => {
    const body = new FormData();
    body.append('frame', new Blob([image], { type: 'image/png' }), 'frame.png');
    const response = await call(path, {
      method: 'POST',
      headers: { 'x-user-id': 'user-1' },
      body
    });
    assert.equal(response.status, 200);
    return response.json();
  };

  const alignment = await getQuality('/api/verification/liveness/quality');
  assert.equal(alignment.ready, true);

  const finalSelfie = await getQuality('/api/verification/liveness/quality');
  assert.equal(finalSelfie.ready, true);
  assert.equal(finalSelfie.guidance, null);
  assert.equal(engineCall.mock.callCount(), 2);
});

async function createImage(width = 16, height = 16) {
  return sharp({
    create: {
      width,
      height,
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
    assert.equal(target, 'http://127.0.0.1:8000/api/v1/verify');
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
    reason: 'passive_liveness_failed'
  });
  assert.equal(engineCall.mock.callCount(), 3);
});

test('face match reports whether the document portrait or selfie face is missing', async t => {
  const call = await createClient(t);
  const image = await createImage();
  const previousToken = process.env.OPENBIOMETRICS_SHARED_TOKEN;
  process.env.OPENBIOMETRICS_SHARED_TOKEN = 'test-token';
  t.after(() => {
    if (previousToken === undefined) delete process.env.OPENBIOMETRICS_SHARED_TOKEN;
    else process.env.OPENBIOMETRICS_SHARED_TOKEN = previousToken;
  });
  const engineCall = t.mock.method(globalThis, 'fetch', async url => {
    const target = String(url);
    if (target.endsWith('/api/v1/liveness/sessions?preset=verification')) {
      return Response.json({
        session_id: 'unclear-document-liveness',
        challenges: ['turn_right', 'blink', 'turn_left', 'open_mouth'].map(type => ({ type, instruction: type }))
      });
    }
    if (target.endsWith('/api/v1/liveness/sessions/unclear-document-liveness/frame')) {
      return Response.json({
        session_id: 'unclear-document-liveness',
        challenge_type: 'open_mouth',
        passed: true,
        challenges_remaining: 0,
        session_complete: true,
        is_live: true,
        state: 'completed'
      });
    }
    if (target.endsWith('/api/v1/detect')) {
      return Response.json({ count: 0, faces: [] });
    }
    return Response.json(
      { detail: 'Exactly one face must be visible in image1' },
      { status: 422 }
    );
  });

  const sessionId = await createCompletedSession(call);
  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { sessionId })
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.isMatch, false);
  assert.equal(result.reason, 'document_face_not_clear');
  assert.equal(engineCall.mock.callCount(), 7);
});

test('face match retries with an upscaled portrait crop when the full document has no detectable face', async t => {
  const call = await createClient(t);
  const image = await createImage();
  const previousToken = process.env.OPENBIOMETRICS_SHARED_TOKEN;
  process.env.OPENBIOMETRICS_SHARED_TOKEN = 'test-token';
  t.after(() => {
    if (previousToken === undefined) delete process.env.OPENBIOMETRICS_SHARED_TOKEN;
    else process.env.OPENBIOMETRICS_SHARED_TOKEN = previousToken;
  });

  let verifyCalls = 0;
  let detectionCalls = 0;
  const engineCall = t.mock.method(globalThis, 'fetch', async (url, options) => {
    const target = String(url);
    if (target.endsWith('/api/v1/liveness/sessions?preset=verification')) {
      return Response.json({
        session_id: 'portrait-crop-liveness',
        challenges: ['turn_right', 'blink', 'turn_left', 'open_mouth'].map(type => ({ type, instruction: type }))
      });
    }
    if (target.endsWith('/api/v1/liveness/sessions/portrait-crop-liveness/frame')) {
      return Response.json({
        session_id: 'portrait-crop-liveness',
        challenge_type: 'open_mouth',
        passed: true,
        challenges_remaining: 0,
        session_complete: true,
        is_live: true,
        state: 'completed'
      });
    }
    if (target.endsWith('/api/v1/detect')) {
      detectionCalls += 1;
      if (detectionCalls === 1) {
        return Response.json({
          count: 1,
          faces: [{
            detection: { bbox: [80, 100, 280, 500], confidence: 0.95 },
            quality: { overall_score: 85 }
          }]
        });
      }
      return Response.json({ count: 0, faces: [] });
    }

    assert.equal(target, 'http://127.0.0.1:8000/api/v1/verify');
    verifyCalls += 1;
    const submittedDocument = options.body.get('image1');
    if (verifyCalls === 1) {
      assert.equal(submittedDocument.type, 'image/png');
      return Response.json(
        { detail: 'Exactly one face must be visible in image1' },
        { status: 422 }
      );
    }
    assert.equal(submittedDocument.type, 'image/jpeg');
    assert.ok(submittedDocument.size > 0);
    return Response.json({
      is_match: true,
      similarity: 0.91,
      face2: { liveness: { is_live: true } }
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
    isMatch: true,
    isLive: true,
    reason: null
  });
  assert.equal(verifyCalls, 2);
  assert.equal(detectionCalls, 4);
  assert.equal(engineCall.mock.callCount(), 8);
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
