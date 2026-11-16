import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import { MasterDB } from '../db/multiTenant.js';
import { getPgPool } from '../db/postgres.js';
import { identityVerificationEmailNotifications } from '../db/emailService.js';
import { identityVerificationEvidence } from '../db/identityVerificationEvidence.js';
import {
  analyzeIdentityDocumentWithGemini,
  matchDocumentAndSelfieWithGemini,
  normalizeDocumentType
} from '../security/geminiIdentityVerifier.js';
import { computeDocumentHashes, createVerificationRouter } from './verificationRoutes.js';

const originalFetch = globalThis.fetch;
let nextTestIp = 1;

function mockIdentityCompletion(t, initialUser = {}) {
  let user = {
    id: 'user-1',
    tiwiId: 'tiwi-user-1',
    name: 'Imran Khan',
    email: 'verification-test@example.com',
    address: 'Dhaka, Bangladesh',
    identityVerified: false,
    identityVerificationRequired: false,
    ...initialUser
  };
  t.mock.method(MasterDB, 'findUserByIdentifier', async () => user);
  const updateUser = t.mock.method(MasterDB, 'updateUser', async (_id, updates) => {
    user = { ...user, ...updates };
    return user;
  });
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  const completedEmail = t.mock.method(
    identityVerificationEmailNotifications,
    'completed',
    async () => ({ success: true })
  );
  const savedEvidence = t.mock.method(
    identityVerificationEvidence,
    'store',
    async () => ['/uploads/verification/tiwi-user-1/attempt-1.document.png']
  );
  return { getUser: () => user, updateUser, completedEmail, savedEvidence };
}

function createMockReviewStore() {
  const calls = [];
  return {
    calls,
    async createOrUpdateReview(payload) {
      calls.push(payload);
      return { id: `review-${calls.length}`, ...payload };
    }
  };
}

async function createClient(t, { geminiVerifier, reviewStore } = {}) {
  const clientIp = `198.51.100.${nextTestIp++}`;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', { configurable: true, value: clientIp });
    if (req.headers['x-user-id']) {
      req.activeUser = {
        id: req.headers['x-user-id'],
        name: req.headers['x-user-name'] || 'Imran Khan',
        email: 'verification-test@example.com'
      };
    }
    next();
  });
  const router = createVerificationRouter({ geminiVerifier, reviewStore });
  app.use('/api/verification', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, options = {}) => originalFetch(
    `http://127.0.0.1:${server.address().port}${path}`,
    options
  );
}

/**
 * Creates a valid PNG image with varying pixel patterns so multi-frame liveness
 * checks see genuinely distinct camera frames.
 */
async function createImage(width = 320, height = 240, variant = 0) {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  const baseR = (90 + variant * 47) % 210;
  const baseG = (120 + variant * 61) % 210;
  const baseB = (150 + variant * 73) % 210;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const stripe = ((x + y + variant * 31) % 64) < 32 ? 25 : -20;
      raw[idx] = Math.max(20, Math.min(240, baseR + stripe + (x % 19)));
      raw[idx + 1] = Math.max(20, Math.min(240, baseG - stripe + (y % 17)));
      raw[idx + 2] = Math.max(20, Math.min(240, baseB + ((x * 3 + y) % 23)));
    }
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

async function createSolidImage(width = 320, height = 240, background = { r: 0, g: 0, b: 0 }) {
  return sharp({
    create: { width, height, channels: 3, background }
  }).png().toBuffer();
}

function createRecording() {
  const bytes = new Uint8Array(16);
  bytes.set([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70]);
  return bytes;
}

function createForm(image, {
  consent = 'true',
  sessionId = '',
  documentType = 'passport',
  geoCountry = '',
  retakeCount = ''
} = {}) {
  const form = new FormData();
  form.append('document', new Blob([image], { type: 'image/png' }), 'document.png');
  form.append('selfie', new Blob([image], { type: 'image/png' }), 'selfie.png');
  form.append('recording', new Blob([createRecording()], { type: 'video/mp4' }), 'liveness.mp4');
  form.append('livenessSessionId', sessionId);
  form.append('documentType', documentType);
  form.append('consent', consent);
  if (geoCountry) form.append('geoCountry', geoCountry);
  if (retakeCount !== '') form.append('retakeCount', String(retakeCount));
  return form;
}

async function createCompletedSession(call, headers = { 'x-user-id': 'user-1' }) {
  const response = await call('/api/verification/liveness/session', {
    method: 'POST',
    headers
  });
  assert.equal(response.status, 201);
  const session = await response.json();
  assert.equal(typeof session.session_id, 'string');
  assert.equal(session.challenges.length, 3);
  assert.ok(session.expires_in_seconds > 0);

  let lastResult = null;
  for (let i = 0; i < session.challenges.length; i++) {
    const frame = new FormData();
    frame.append('frame', new Blob([await createImage(320, 240, i + 1)], { type: 'image/png' }), `frame-${i}.png`);
    const frameResponse = await call(`/api/verification/liveness/${session.session_id}/frame`, {
      method: 'POST',
      headers,
      body: frame
    });
    assert.equal(frameResponse.status, 200);
    lastResult = await frameResponse.json();
    assert.equal(lastResult.challenge_index, i);
    assert.equal(lastResult.action_detected, true);
    assert.equal(lastResult.challenge_type, session.challenges[i].type);
    assert.equal(typeof lastResult.quality.brightness, 'number');
    assert.equal(typeof lastResult.quality.sharpness, 'number');
  }
  assert.equal(lastResult.complete, true);
  return session.session_id;
}

test('verification QR links expire after five minutes and can only be redeemed once', async t => {
  const call = await createClient(t);
  const clock = { now: Date.now() };
  t.mock.method(Date, 'now', () => clock.now);
  const createdResponse = await call('/api/verification/handoff', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' }
  });
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

test('a redeemed mobile link completes verification via Gemini Vision without a phone login', async t => {
  const reviewStore = createMockReviewStore();
  const geminiVerifier = {
    async analyzeIdentityDocumentWithGemini() {
      return { ok: true, fallbackToManual: false, aiStatus: 'ok', extracted: {}, nameMismatch: false, needsNameCorrection: false };
    },
    async matchDocumentAndSelfieWithGemini() {
      return {
        ok: true,
        fallbackToManual: false,
        isMatch: true,
        isLiveValid: true,
        confidenceScore: 96,
        reason: null,
        extracted: { fullName: 'Imran Khan', country: 'Bangladesh' },
        spoofRisk: 'low',
        tamperingSignals: [],
        documentExpiryValid: true,
        isScreenRecaptureOrPrintedCopy: false
      };
    }
  };
  const call = await createClient(t, { geminiVerifier, reviewStore });
  const { updateUser, completedEmail, savedEvidence } = mockIdentityCompletion(t, {
    identityVerificationRequired: true
  });

  const handoffResponse = await call('/api/verification/handoff', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' }
  });
  const handoff = await handoffResponse.json();
  const redeemResponse = await call('/api/verification/handoff/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: handoff.token })
  });
  assert.equal(redeemResponse.status, 200);
  const { accessToken } = await redeemResponse.json();
  const guestHeaders = { Authorization: `Bearer ${accessToken}` };

  const sessionId = await createCompletedSession(call, guestHeaders);
  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { ...guestHeaders, 'cf-ipcountry': 'BD' },
    body: createForm(await createImage(320, 240, 9), { sessionId, documentType: 'other_document' })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.isMatch, true);
  assert.equal(body.isLive, true);
  assert.equal(body.passiveLiveness, true);
  assert.equal(body.confidenceScore, 96);
  assert.equal(body.reason, null);
  assert.equal(body.attestation.method, 'gemini_multimodal_vision');
  assert.equal(typeof body.attestation.credentialId, 'string');
  assert.equal(body.attestation.sha256Digest.length, 64);
  assert.equal(body.attestation.hmacSignature.length, 128);

  assert.equal(savedEvidence.mock.callCount(), 1);
  assert.equal(savedEvidence.mock.calls[0].arguments[0].user.id, 'user-1');
  assert.equal(savedEvidence.mock.calls[0].arguments[0].documentType, 'other_document');
  assert.equal(reviewStore.calls.length, 1);
  assert.equal(reviewStore.calls[0].status, 'accepted');
  assert.equal(reviewStore.calls[0].source, 'gemini_auto');
  assert.equal(reviewStore.calls[0].telemetry.geoCountry, 'BD');
  assert.equal(reviewStore.calls[0].telemetry.countryMismatch, false);
  assert.equal(reviewStore.calls[0].telemetry.frameCount, 3);
  assert.ok(reviewStore.calls[0].telemetry.frameEntropyAvg > 0);

  assert.deepEqual(updateUser.mock.calls[0].arguments[1], {
    identityVerified: true,
    identityVerificationRequired: false
  });
  assert.equal(completedEmail.mock.callCount(), 1);

  const status = await call(
    `/api/verification/handoff/${handoff.sessionId}/status`,
    { headers: { 'x-verification-session-key': handoff.sessionKey } }
  );
  assert.deepEqual(await status.json(), { status: 'success', result: null });
});

test('local sharp liveness quality and frame endpoints reject black, low-res, corrupt, and static replay frames', async t => {
  const call = await createClient(t);

  // Quality: too dark
  const darkForm = new FormData();
  darkForm.append('frame', new Blob([await createSolidImage(320, 240, { r: 0, g: 0, b: 0 })], { type: 'image/png' }), 'dark.png');
  const darkQuality = await call('/api/verification/liveness/quality', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: darkForm
  });
  assert.equal(darkQuality.status, 200);
  const darkJson = await darkQuality.json();
  assert.equal(darkJson.ready, false);
  assert.equal(darkJson.guidance, 'too_dark');

  // Quality: low resolution
  const smallForm = new FormData();
  smallForm.append('frame', new Blob([await createImage(80, 80, 1)], { type: 'image/png' }), 'small.png');
  const smallQuality = await call('/api/verification/liveness/quality', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: smallForm
  });
  assert.equal(smallQuality.status, 200);
  const smallJson = await smallQuality.json();
  assert.equal(smallJson.ready, false);
  assert.equal(smallJson.guidance, 'move_closer');

  // Quality: valid frame
  const goodForm = new FormData();
  goodForm.append('frame', new Blob([await createImage(320, 240, 2)], { type: 'image/png' }), 'good.png');
  const goodQuality = await call('/api/verification/liveness/quality', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: goodForm
  });
  assert.equal(goodQuality.status, 200);
  const goodJson = await goodQuality.json();
  assert.equal(goodJson.ready, true);
  assert.equal(goodJson.guidance, null);
  assert.ok(goodJson.quality.brightness > 10);

  // Liveness session: reject black frame, corrupt frame, and identical static replay frame
  const sessionRes = await call('/api/verification/liveness/session', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' }
  });
  assert.equal(sessionRes.status, 201);
  const { session_id: sessionId } = await sessionRes.json();

  const blackFrame = new FormData();
  blackFrame.append('frame', new Blob([await createSolidImage(320, 240, { r: 0, g: 0, b: 0 })], { type: 'image/png' }), 'black.png');
  const blackRes = await call(`/api/verification/liveness/${sessionId}/frame`, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: blackFrame
  });
  assert.equal(blackRes.status, 400);

  const corruptFrame = new FormData();
  corruptFrame.append('frame', new Blob([Buffer.from('not-an-image')], { type: 'image/png' }), 'bad.png');
  const corruptRes = await call(`/api/verification/liveness/${sessionId}/frame`, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: corruptFrame
  });
  assert.equal(corruptRes.status, 400);

  // Frame 1 succeeds
  const firstFrameBuf = await createImage(320, 240, 5);
  const firstForm = new FormData();
  firstForm.append('frame', new Blob([firstFrameBuf], { type: 'image/png' }), 'f1.png');
  const firstRes = await call(`/api/verification/liveness/${sessionId}/frame`, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: firstForm
  });
  assert.equal(firstRes.status, 200);
  assert.equal((await firstRes.json()).complete, false);

  // Identical static frame replay is blocked
  const replayForm = new FormData();
  replayForm.append('frame', new Blob([firstFrameBuf], { type: 'image/png' }), 'f1-replay.png');
  const replayRes = await call(`/api/verification/liveness/${sessionId}/frame`, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: replayForm
  });
  assert.equal(replayRes.status, 400);
  assert.equal((await replayRes.json()).replayDetected, true);

  // Clean deletion
  const delRes = await call(`/api/verification/liveness/${sessionId}`, {
    method: 'DELETE',
    headers: { 'x-user-id': 'user-1' }
  });
  assert.equal(delRes.status, 204);
});

test('POST /document-analyze handles name & DOB match, mismatch, other_document, and AI fallback', async t => {
  mockIdentityCompletion(t, { name: 'Imran Khan', dateOfBirth: '1992-05-10' });
  let mode = 'match';
  const geminiVerifier = {
    async analyzeIdentityDocumentWithGemini({ documentType, expectedName, expectedDob }) {
      assert.equal(expectedName, 'Imran Khan');
      assert.equal(expectedDob, '1992-05-10');
      if (mode === 'match') {
        assert.equal(documentType, 'other_document');
        return {
          ok: true,
          fallbackToManual: false,
          aiStatus: 'ok',
          extracted: {
            fullName: 'Imran Khan',
            documentNumber: 'BD-998877',
            dateOfBirth: '1992-05-10',
            country: 'Bangladesh',
            spoofRisk: 'low',
            tamperingSignals: [],
            documentExpiryValid: true,
            isScreenRecaptureOrPrintedCopy: false
          },
          nameMismatch: false,
          dobMismatch: false,
          needsNameCorrection: false
        };
      }
      if (mode === 'dob_mismatch') {
        return {
          ok: true,
          fallbackToManual: false,
          aiStatus: 'ok',
          extracted: {
            fullName: 'Imran Khan',
            documentNumber: 'BD-998877',
            dateOfBirth: '1990-01-15',
            country: 'Bangladesh'
          },
          nameMismatch: false,
          dobMismatch: true,
          needsNameCorrection: true
        };
      }
      if (mode === 'mismatch') {
        return {
          ok: true,
          fallbackToManual: false,
          aiStatus: 'ok',
          extracted: {
            fullName: 'Tariq Ahmed',
            documentNumber: 'P1234567',
            dateOfBirth: '1992-05-10',
            country: 'Bangladesh',
            spoofRisk: 'low',
            tamperingSignals: [],
            documentExpiryValid: true,
            isScreenRecaptureOrPrintedCopy: false
          },
          nameMismatch: true,
          dobMismatch: false,
          needsNameCorrection: true
        };
      }
      return {
        ok: false,
        fallbackToManual: true,
        aiStatus: 'fallback',
        extracted: {},
        nameMismatch: false,
        dobMismatch: false,
        needsNameCorrection: false,
        error: 'NO_HEALTHY_KEYS'
      };
    },
    async matchDocumentAndSelfieWithGemini() {
      return { ok: false, fallbackToManual: true, isMatch: false, isLiveValid: false };
    }
  };

  const call = await createClient(t, { geminiVerifier });
  const docImg = await createImage(320, 240, 3);

  const sendAnalyze = (docType) => {
    const form = new FormData();
    form.append('document', new Blob([docImg], { type: 'image/png' }), 'doc.png');
    form.append('documentType', docType);
    return call('/api/verification/document-analyze', {
      method: 'POST',
      headers: { 'x-user-id': 'user-1' },
      body: form
    });
  };

  const matchRes = await sendAnalyze('other_document');
  assert.equal(matchRes.status, 200);
  const matchData = await matchRes.json();
  assert.equal(matchData.aiStatus, 'ok');
  assert.equal(matchData.fallbackToManual, false);
  assert.equal(matchData.nameMismatch, false);
  assert.equal(matchData.dobMismatch, false);
  assert.equal(matchData.needsNameCorrection, false);
  assert.equal(matchData.accountDob, '1992-05-10');
  assert.equal(matchData.extracted.fullName, 'Imran Khan');

  mode = 'dob_mismatch';
  const dobMismatchRes = await sendAnalyze('national_id');
  assert.equal(dobMismatchRes.status, 200);
  const dobMismatchData = await dobMismatchRes.json();
  assert.equal(dobMismatchData.nameMismatch, false);
  assert.equal(dobMismatchData.dobMismatch, true);
  assert.equal(dobMismatchData.needsNameCorrection, true);

  mode = 'mismatch';
  const mismatchRes = await sendAnalyze('passport');
  assert.equal(mismatchRes.status, 200);
  const mismatchData = await mismatchRes.json();
  assert.equal(mismatchData.nameMismatch, true);
  assert.equal(mismatchData.dobMismatch, false);
  assert.equal(mismatchData.needsNameCorrection, true);
  assert.equal(mismatchData.accountName, 'Imran Khan');
  assert.equal(mismatchData.extracted.fullName, 'Tariq Ahmed');

  mode = 'fallback';
  const fallbackRes = await sendAnalyze('national_id');
  assert.equal(fallbackRes.status, 200);
  const fallbackData = await fallbackRes.json();
  assert.equal(fallbackData.aiStatus, 'fallback');
  assert.equal(fallbackData.fallbackToManual, true);
  assert.equal(fallbackData.nameMismatch, false);
  assert.equal(fallbackData.dobMismatch, false);
});

test('POST /confirm-name validates length, DOB, and address and updates account cleanly', async t => {
  const { updateUser } = mockIdentityCompletion(t, { name: 'Old Name' });
  const call = await createClient(t);

  const tooShort = await call('/api/verification/confirm-name', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'A' })
  });
  assert.equal(tooShort.status, 400);

  const tooLong = await call('/api/verification/confirm-name', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'A'.repeat(121) })
  });
  assert.equal(tooLong.status, 400);

  const invalidDob = await call('/api/verification/confirm-name', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Tariq Ahmed', dateOfBirth: '1992-02-31' })
  });
  assert.equal(invalidDob.status, 400);

  const valid = await call('/api/verification/confirm-name', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: '  Tariq   Ahmed  ',
      dateOfBirth: '1992-05-10',
      address: '  House 12,  Road 4, Dhaka  '
    })
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), {
    success: true,
    fullName: 'Tariq Ahmed',
    dateOfBirth: '1992-05-10',
    address: 'House 12, Road 4, Dhaka'
  });
  assert.equal(updateUser.mock.callCount(), 1);
  assert.deepEqual(updateUser.mock.calls[0].arguments[1], {
    name: 'Tariq Ahmed',
    dateOfBirth: '1992-05-10',
    address: 'House 12, Road 4, Dhaka'
  });
});

test('face match requires authentication and completed liveness session + consent', async t => {
  let verifierCalled = false;
  const geminiVerifier = {
    async analyzeIdentityDocumentWithGemini() {
      verifierCalled = true;
      return { ok: false, fallbackToManual: true };
    },
    async matchDocumentAndSelfieWithGemini() {
      verifierCalled = true;
      return { ok: false, fallbackToManual: true };
    }
  };
  const call = await createClient(t, { geminiVerifier });
  const image = await createImage(320, 240, 1);

  const unauthenticated = await call('/api/verification/face-match', {
    method: 'POST',
    body: createForm(image)
  });
  assert.equal(unauthenticated.status, 401);

  const noSession = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image)
  });
  assert.equal(noSession.status, 400);

  const sessionId = await createCompletedSession(call);
  const wrongUser = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-2' },
    body: createForm(image, { sessionId })
  });
  assert.equal(wrongUser.status, 400);

  const noConsent = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { consent: 'false', sessionId })
  });
  assert.equal(noConsent.status, 400);
  assert.equal(noConsent.headers.get('cache-control'), 'no-store');
  assert.equal(verifierCalled, false);
});

test('face match handles Gemini mismatch and spoof rejection cleanly', async t => {
  let responseMode = 'mismatch';
  const geminiVerifier = {
    async analyzeIdentityDocumentWithGemini() {
      return { ok: true, fallbackToManual: false };
    },
    async matchDocumentAndSelfieWithGemini() {
      if (responseMode === 'mismatch') {
        return {
          ok: true,
          fallbackToManual: false,
          isMatch: false,
          isLiveValid: true,
          reason: 'face_mismatch',
          message: 'Selfie does not match the ID portrait.'
        };
      }
      return {
        ok: true,
        fallbackToManual: false,
        isMatch: false,
        isLiveValid: true,
        reason: 'spoof_or_deepfake_detected',
        message: 'Screen replay detected on document.',
        spoofRisk: 'high',
        deepfakeOrReplaySuspected: true
      };
    }
  };

  const call = await createClient(t, { geminiVerifier });
  const image = await createImage(320, 240, 4);

  const s1 = await createCompletedSession(call);
  const res1 = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { sessionId: s1 })
  });
  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.isMatch, false);
  assert.equal(body1.reason, 'face_mismatch');

  responseMode = 'spoof';
  const s2 = await createCompletedSession(call);
  const res2 = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(image, { sessionId: s2 })
  });
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.isMatch, false);
  assert.equal(body2.reason, 'spoof_or_deepfake_detected');
});

test('face match falls back to HTTP 202 manual admin review with stored evidence on Gemini failure', async t => {
  const { updateUser, savedEvidence } = mockIdentityCompletion(t, {
    identityVerificationRequired: true
  });
  const reviewStore = createMockReviewStore();
  const geminiVerifier = {
    async analyzeIdentityDocumentWithGemini() {
      return { ok: false, fallbackToManual: true };
    },
    async matchDocumentAndSelfieWithGemini() {
      return {
        ok: false,
        fallbackToManual: true,
        isMatch: false,
        isLiveValid: false,
        error: 'ALL_KEYS_EXHAUSTED'
      };
    }
  };

  const call = await createClient(t, { geminiVerifier, reviewStore });
  const handoffRes = await call('/api/verification/handoff', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' }
  });
  const handoff = await handoffRes.json();
  const redeemRes = await call('/api/verification/handoff/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: handoff.token })
  });
  const { accessToken } = await redeemRes.json();
  const guestHeaders = { Authorization: `Bearer ${accessToken}` };

  const sessionId = await createCompletedSession(call, guestHeaders);
  const response = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { ...guestHeaders, 'cf-ipcountry': 'US' },
    body: createForm(await createImage(320, 240, 7), {
      sessionId,
      documentType: 'other_document',
      retakeCount: 2
    })
  });
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.manualReview, true);
  assert.equal(body.status, 'pending_review');
  assert.equal(body.reviewId, 'review-1');
  assert.equal(body.isMatch, false);
  assert.equal(body.isLive, true);
  assert.equal(body.reason, 'manual_review_submitted');

  assert.equal(savedEvidence.mock.callCount(), 1);
  assert.equal(updateUser.mock.callCount(), 0);
  assert.equal(reviewStore.calls.length, 1);
  assert.equal(reviewStore.calls[0].status, 'pending_review');
  assert.equal(reviewStore.calls[0].source, 'gemini_fallback');
  assert.equal(reviewStore.calls[0].aiReason, 'ALL_KEYS_EXHAUSTED');
  assert.equal(reviewStore.calls[0].documentType, 'other_document');
  assert.equal(reviewStore.calls[0].telemetry.retakeCount, 2);
  assert.equal(reviewStore.calls[0].telemetry.geoCountry, 'US');
  assert.deepEqual(reviewStore.calls[0].evidenceFiles, [
    '/uploads/verification/tiwi-user-1/attempt-1.document.png'
  ]);

  const handoffStatus = await call(
    `/api/verification/handoff/${handoff.sessionId}/status`,
    { headers: { 'x-verification-session-key': handoff.sessionKey } }
  );
  assert.deepEqual(await handoffStatus.json(), {
    status: 'manual_review',
    result: 'pending_manual_review'
  });
});

test('geminiIdentityVerifier handles multi-language OCR, deepfake rejection, and clean error fallback', async () => {
  assert.equal(normalizeDocumentType('other_document'), 'other_document');
  assert.equal(normalizeDocumentType('passport'), 'passport');
  assert.equal(normalizeDocumentType('unknown_legacy_type'), 'other_document');

  const docBuf = await createImage(320, 240, 1);
  const selfieBuf = await createImage(320, 240, 2);

  // 1) Multi-language Bengali + English OCR with spoofRisk
  const ocrResult = await analyzeIdentityDocumentWithGemini({
    documentBuffer: docBuf,
    mimeType: 'image/png',
    documentType: 'other_document',
    expectedName: 'Rahim Uddin',
    getSettingsFn: async () => ({ enabled: true }),
    executeAiFn: async ({ payload }) => {
      const promptText = payload.contents[0].parts[0].text;
      assert.match(promptText, /Bengali/i);
      assert.match(promptText, /Other Document/i);
      return {
        text: JSON.stringify({
          fullName: 'Rahim Uddin',
          documentNumber: 'NID-19901234',
          address: 'Dhaka, Bangladesh',
          dateOfBirth: '1990-01-01',
          country: 'Bangladesh',
          isValidDocumentType: true,
          documentReadable: true,
          nameMatchesAccount: true,
          confidenceScore: 94,
          notes: 'Extracted from Bengali and English NID fields',
          spoofRisk: 'low',
          tamperingSignals: [],
          documentExpiryValid: true,
          isScreenRecaptureOrPrintedCopy: false,
          deepfakeOrReplaySuspected: false
        }),
        usedModel: 'gemini-3.5-flash'
      };
    }
  });
  assert.equal(ocrResult.ok, true);
  assert.equal(ocrResult.fallbackToManual, false);
  assert.equal(ocrResult.nameMismatch, false);
  assert.equal(ocrResult.extracted.country, 'Bangladesh');
  assert.equal(ocrResult.extracted.spoofRisk, 'low');

  // 2) Deepfake / screen-replay spoof rejection even if Gemini says faces look similar
  const spoofMatchResult = await matchDocumentAndSelfieWithGemini({
    documentBuffer: docBuf,
    documentMimeType: 'image/png',
    selfieBuffer: selfieBuf,
    selfieMimeType: 'image/png',
    documentType: 'passport',
    getSettingsFn: async () => ({ enabled: true }),
    executeAiFn: async ({ payload }) => {
      const inlineParts = payload.contents[0].parts.filter(p => p.inlineData);
      assert.equal(inlineParts.length, 2);
      return {
        text: JSON.stringify({
          documentFaceClear: true,
          selfieFaceClear: true,
          documentReadable: true,
          isMatch: true,
          confidenceScore: 88,
          deepfakeOrReplaySuspected: true,
          spoofRisk: 'high',
          tamperingSignals: ['screen_moire_pattern'],
          documentExpiryValid: true,
          isScreenRecaptureOrPrintedCopy: true
        })
      };
    }
  });
  assert.equal(spoofMatchResult.ok, true);
  assert.equal(spoofMatchResult.isMatch, false);
  assert.equal(spoofMatchResult.reason, 'spoof_or_deepfake_detected');
  assert.equal(spoofMatchResult.deepfakeOrReplaySuspected, true);

  // 3) Disabled AI settings or thrown error never throws -> clean fallback
  const disabledRes = await analyzeIdentityDocumentWithGemini({
    documentBuffer: docBuf,
    mimeType: 'image/png',
    getSettingsFn: async () => ({ enabled: false }),
    executeAiFn: async () => {
      throw new Error('Should not execute when disabled');
    }
  });
  assert.equal(disabledRes.ok, false);
  assert.equal(disabledRes.fallbackToManual, true);
  assert.equal(disabledRes.aiStatus, 'fallback');

  const errorMatchRes = await matchDocumentAndSelfieWithGemini({
    documentBuffer: docBuf,
    documentMimeType: 'image/png',
    selfieBuffer: selfieBuf,
    selfieMimeType: 'image/png',
    getSettingsFn: async () => ({ enabled: true }),
    executeAiFn: async () => {
      throw new Error('Network timeout');
    }
  });
  assert.equal(errorMatchRes.ok, false);
  assert.equal(errorMatchRes.fallbackToManual, true);
  assert.equal(errorMatchRes.isMatch, false);
  assert.match(errorMatchRes.error, /Network timeout/);
});

test('duplicate Passport or NID used on a second account permanently bans the duplicate account with HTTP 403', async t => {
  const users = new Map([
    ['user-1', {
      id: 'user-1',
      tiwiId: 'tiwi-1',
      name: 'Imran Khan',
      email: 'user1@example.com',
      address: 'Dhaka',
      role: 'owner',
      isBanned: false,
      identityVerified: false,
      identityVerificationRequired: true
    }],
    ['user-2', {
      id: 'user-2',
      tiwiId: 'tiwi-2',
      name: 'Imran Duplicate',
      email: 'user2@example.com',
      address: 'Dhaka',
      role: 'owner',
      isBanned: false,
      identityVerified: false,
      identityVerificationRequired: true
    }]
  ]);

  t.mock.method(MasterDB, 'findUserByIdentifier', async (id) => users.get(String(id)) || null);
  const updateUser = t.mock.method(MasterDB, 'updateUser', async (id, updates) => {
    const existing = users.get(String(id));
    if (!existing) return null;
    const next = { ...existing, ...updates };
    users.set(String(id), next);
    return next;
  });
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  t.mock.method(identityVerificationEmailNotifications, 'completed', async () => ({ success: true }));
  t.mock.method(identityVerificationEvidence, 'store', async ({ user }) => [
    `/uploads/verification/${user.tiwiId}/doc.png`
  ]);

  const storedReviews = [];
  const reviewStore = {
    async createOrUpdateReview(payload) {
      const record = { id: `rev-${storedReviews.length + 1}`, ...payload };
      storedReviews.push(record);
      return record;
    },
    async findDuplicateDocumentMatch({ documentFingerprint, identityHash, excludeUserId }) {
      return storedReviews.find(r =>
        r.status === 'accepted' &&
        r.userId !== excludeUserId &&
        ((documentFingerprint && r.documentFingerprint === documentFingerprint) ||
         (identityHash && r.identityHash === identityHash))
      ) || null;
    }
  };

  // Verify deterministic salted HMAC normalization
  const h1 = computeDocumentHashes({
    fullName: 'Imran Khan',
    documentNumber: 'P-9988 7766',
    dateOfBirth: '1992-05-10',
    address: 'Dhaka, Bangladesh'
  });
  const h2 = computeDocumentHashes({
    fullName: '  imran   khan ',
    documentNumber: 'p99887766',
    dateOfBirth: '1992-05-10',
    address: 'dhaka, bangladesh'
  });
  assert.equal(h1.documentFingerprint, h2.documentFingerprint);
  assert.equal(h1.identityHash, h2.identityHash);
  assert.equal(h1.documentFingerprint.length, 64);

  const geminiVerifier = {
    async analyzeIdentityDocumentWithGemini() {
      return {
        ok: true,
        fallbackToManual: false,
        aiStatus: 'ok',
        extracted: {
          fullName: 'Imran Khan',
          documentNumber: 'P-9988 7766',
          dateOfBirth: '1992-05-10',
          address: 'Dhaka, Bangladesh',
          country: 'Bangladesh'
        },
        nameMismatch: false,
        needsNameCorrection: false
      };
    },
    async matchDocumentAndSelfieWithGemini() {
      return {
        ok: true,
        fallbackToManual: false,
        isMatch: true,
        isLiveValid: true,
        confidenceScore: 97,
        reason: null,
        extracted: {
          fullName: 'Imran Khan',
          documentNumber: 'P99887766',
          dateOfBirth: '1992-05-10',
          address: 'Dhaka, Bangladesh',
          country: 'Bangladesh'
        }
      };
    }
  };

  const call = await createClient(t, { geminiVerifier, reviewStore });

  // 1) User 1 verifies cleanly and stores documentFingerprint + identityHash
  const s1 = await createCompletedSession(call, { 'x-user-id': 'user-1' });
  const okRes = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-1' },
    body: createForm(await createImage(320, 240, 1), { sessionId: s1, documentType: 'passport' })
  });
  assert.equal(okRes.status, 200);
  const okBody = await okRes.json();
  assert.equal(okBody.isMatch, true);
  assert.equal(users.get('user-1').identityVerified, true);
  assert.equal(storedReviews[0].documentFingerprint, h1.documentFingerprint);
  assert.equal(storedReviews[0].identityHash, h1.identityHash);
  assert.equal(storedReviews[0].extractedData.documentNumber, 'P99887766');
  assert.equal(storedReviews[0].extractedData.fullName, 'Imran Khan');
  assert.equal(storedReviews[0].extractedData.dateOfBirth, '1992-05-10');
  assert.equal(storedReviews[0].extractedData.address, 'Dhaka, Bangladesh');
  assert.equal(storedReviews[0].extractedData.country, 'Bangladesh');

  // 2) User 2 attempts POST /document-analyze with the SAME Passport -> HTTP 403 permanent ban
  const docForm = new FormData();
  docForm.append('document', new Blob([await createImage(320, 240, 2)], { type: 'image/png' }), 'doc.png');
  docForm.append('documentType', 'passport');
  const dupAnalyzeRes = await call('/api/verification/document-analyze', {
    method: 'POST',
    headers: { 'x-user-id': 'user-2' },
    body: docForm
  });
  assert.equal(dupAnalyzeRes.status, 403);
  const dupAnalyzeBody = await dupAnalyzeRes.json();
  assert.equal(dupAnalyzeBody.success, false);
  assert.equal(dupAnalyzeBody.code, 'DUPLICATE_IDENTITY_PERMANENT_BAN');
  assert.equal(dupAnalyzeBody.permanentlyBanned, true);
  assert.equal(users.get('user-2').isBanned, true);
  assert.equal(users.get('user-2').identityVerified, false);

  // 3) Re-enable user-2 in memory and confirm POST /face-match ALSO enforces HTTP 403 permanent ban
  users.get('user-2').isBanned = false;
  const s2 = await createCompletedSession(call, { 'x-user-id': 'user-2' });
  const dupFaceRes = await call('/api/verification/face-match', {
    method: 'POST',
    headers: { 'x-user-id': 'user-2' },
    body: createForm(await createImage(320, 240, 3), { sessionId: s2, documentType: 'passport' })
  });
  assert.equal(dupFaceRes.status, 403);
  const dupFaceBody = await dupFaceRes.json();
  assert.equal(dupFaceBody.code, 'DUPLICATE_IDENTITY_PERMANENT_BAN');
  assert.equal(dupFaceBody.permanentlyBanned, true);
  assert.equal(users.get('user-2').isBanned, true);
  assert.equal(users.get('user-2').identityVerified, false);

  const permClosedReviews = storedReviews.filter(r => r.userId === 'user-2' && r.status === 'permanently_closed');
  assert.equal(permClosedReviews.length, 2);
  assert.equal(permClosedReviews[1].source, 'duplicate_document_auto_ban');
  assert.equal(permClosedReviews[1].metadata.duplicateLinkedAccounts.length, 1);
  assert.equal(permClosedReviews[1].metadata.duplicateLinkedAccounts[0].userId, 'user-1');
  assert.equal(permClosedReviews[1].metadata.duplicateLinkedAccounts[0].tiwiId, 'tiwi-1');
  assert.equal(permClosedReviews[1].metadata.duplicateLinkedAccounts[0].userEmail, 'user1@example.com');
  assert.ok(updateUser.mock.calls.some(c => c.arguments[0] === 'user-2' && c.arguments[1].isBanned === true));
});
