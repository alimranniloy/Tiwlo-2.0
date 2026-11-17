import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  evaluateActiveChallengeMetrics,
  evaluateAntiSpoof,
  evaluateFullFaceMetrics,
  extractMetricsFromFace,
  getFaceLivenessEngineStatus,
  inspectFullFaceFrame,
  verifyActiveChallengeFrame
} from './faceLivenessEngine.js';

function createSamplePatternPng(width = 320, height = 240, variant = 3) {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const stripe = ((x + y + variant * 19) % 48) < 24 ? 30 : -25;
      raw[idx] = Math.max(20, Math.min(240, 110 + stripe + (x % 17)));
      raw[idx + 1] = Math.max(20, Math.min(240, 130 - stripe + (y % 13)));
      raw[idx + 2] = Math.max(20, Math.min(240, 140 + ((x * 2 + y) % 21)));
    }
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
}

function buildMockFace({
  imgWidth = 384,
  imgHeight = 384,
  boxRaw = [0.20, 0.15, 0.60, 0.70],
  yawDeg = 0,
  pitchDeg = 0,
  rollDeg = 0,
  noseShift = 0,
  ear = 0.30,
  mouthGapRatio = 0.05,
  silhouetteMargin = 0.08,
  omitRightEye = false,
  realScore = 0.88,
  liveScore = 0.85
} = {}) {
  const box = [
    boxRaw[0] * imgWidth,
    boxRaw[1] * imgHeight,
    boxRaw[2] * imgWidth,
    boxRaw[3] * imgHeight
  ];
  const faceCenterX = box[0] + box[2] / 2;
  const faceCenterY = box[1] + box[3] / 2;

  const makeEye = (cx, cy, eyeWidth = 30) => {
    const halfW = eyeWidth / 2;
    const halfH = (eyeWidth * ear) / 2;
    const upper = [
      [cx - halfW, cy],
      [cx - halfW * 0.5, cy - halfH],
      [cx, cy - halfH],
      [cx + halfW * 0.5, cy - halfH],
      [cx + halfW, cy]
    ];
    const lower = [
      [cx - halfW, cy],
      [cx - halfW * 0.5, cy + halfH],
      [cx, cy + halfH],
      [cx + halfW * 0.5, cy + halfH],
      [cx + halfW, cy]
    ];
    return { upper, lower };
  };

  const rightEye = makeEye(faceCenterX - box[2] * 0.2, faceCenterY - box[3] * 0.12);
  const leftEye = makeEye(faceCenterX + box[2] * 0.2, faceCenterY - box[3] * 0.12);

  const mouthW = 60;
  const mouthGap = mouthW * mouthGapRatio;
  const mouthCy = faceCenterY + box[3] * 0.24;
  const lipsUpperInner = [
    [faceCenterX - mouthW / 2, mouthCy],
    [faceCenterX, mouthCy - mouthGap / 2],
    [faceCenterX + mouthW / 2, mouthCy]
  ];
  const lipsLowerInner = [
    [faceCenterX - mouthW / 2, mouthCy],
    [faceCenterX, mouthCy + mouthGap / 2],
    [faceCenterX + mouthW / 2, mouthCy]
  ];

  const minPx = Math.max(silhouetteMargin * imgWidth, box[0]);
  const maxPx = Math.min((1 - silhouetteMargin) * imgWidth, box[0] + box[2]);
  const minPy = Math.max(silhouetteMargin * imgHeight, box[1]);
  const maxPy = Math.min((1 - silhouetteMargin) * imgHeight, box[1] + box[3]);

  return {
    box,
    boxRaw,
    real: realScore,
    live: liveScore,
    rotation: {
      angle: {
        yaw: (yawDeg * Math.PI) / 180,
        pitch: (pitchDeg * Math.PI) / 180,
        roll: (rollDeg * Math.PI) / 180
      }
    },
    annotations: {
      leftEyeUpper0: leftEye.upper,
      leftEyeLower0: leftEye.lower,
      rightEyeUpper0: omitRightEye ? [] : rightEye.upper,
      rightEyeLower0: omitRightEye ? [] : rightEye.lower,
      lipsUpperInner,
      lipsLowerInner,
      lipsUpperOuter: lipsUpperInner,
      lipsLowerOuter: lipsLowerInner,
      noseTip: [[faceCenterX + noseShift * (box[2] / 2), faceCenterY]],
      silhouette: [
        [minPx, minPy],
        [maxPx, minPy],
        [maxPx, maxPy],
        [minPx, maxPy]
      ]
    }
  };
}

test('turn_left and turn_right match un-mirrored @vladmandic/human yaw, gesture, and noseShift signs without cross-triggering', () => {
  // Neutral frontal face passes neither turn_left nor turn_right
  const frontalMetrics = extractMetricsFromFace(buildMockFace({ yawDeg: 0, noseShift: 0 }), [{ gesture: 'facing center' }], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(frontalMetrics, { challengeType: 'turn_left' }).actionDetected, false);
  assert.equal(evaluateActiveChallengeMetrics(frontalMetrics, { challengeType: 'turn_right' }).actionDetected, false);

  // Subject turns THEIR LEFT in un-mirrored camera: 'facing left' gesture, negative yawDeg, positive noseShiftRatio
  const leftGestureOnly = extractMetricsFromFace(buildMockFace({ yawDeg: -3, noseShift: 0.03 }), [{ gesture: 'facing left' }], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(leftGestureOnly, { challengeType: 'turn_left' }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(leftGestureOnly, { challengeType: 'turn_right' }).actionDetected, false);

  const leftYawOnly = extractMetricsFromFace(buildMockFace({ yawDeg: -8.5, noseShift: 0.02 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(leftYawOnly, { challengeType: 'turn_left' }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(leftYawOnly, { challengeType: 'turn_right' }).actionDetected, false);

  const leftNoseShift = extractMetricsFromFace(buildMockFace({ yawDeg: -2, noseShift: 0.11 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(leftNoseShift, { challengeType: 'turn_left' }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(leftNoseShift, { challengeType: 'turn_right' }).actionDetected, false);

  // Subject turns THEIR RIGHT in un-mirrored camera: 'facing right' gesture, positive yawDeg, negative noseShiftRatio
  const rightGestureOnly = extractMetricsFromFace(buildMockFace({ yawDeg: 3, noseShift: -0.03 }), [{ gesture: 'facing right' }], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(rightGestureOnly, { challengeType: 'turn_right' }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(rightGestureOnly, { challengeType: 'turn_left' }).actionDetected, false);

  const rightYawOnly = extractMetricsFromFace(buildMockFace({ yawDeg: 8.5, noseShift: -0.02 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(rightYawOnly, { challengeType: 'turn_right' }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(rightYawOnly, { challengeType: 'turn_left' }).actionDetected, false);

  const rightNoseShift = extractMetricsFromFace(buildMockFace({ yawDeg: 2, noseShift: -0.11 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(rightNoseShift, { challengeType: 'turn_right' }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(rightNoseShift, { challengeType: 'turn_left' }).actionDetected, false);
});

test('open_mouth and blink challenges evaluate facial ratios and adaptive EAR accurately', () => {
  const closedMouth = extractMetricsFromFace(buildMockFace({ mouthGapRatio: 0.04 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(closedMouth, { challengeType: 'open_mouth' }).actionDetected, false);

  const wideMouth = extractMetricsFromFace(buildMockFace({ mouthGapRatio: 0.20 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(wideMouth, { challengeType: 'open_mouth' }).actionDetected, true);

  const gestureMouth = extractMetricsFromFace(buildMockFace({ mouthGapRatio: 0.05 }), [{ gesture: 'mouth 24% open' }], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(gestureMouth, { challengeType: 'open_mouth' }).actionDetected, true);

  // Adaptive blink: establish baseline EAR then observe drop
  const sessionState = {};
  const openEyes = extractMetricsFromFace(buildMockFace({ ear: 0.34 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(openEyes, { challengeType: 'blink', sessionState }).actionDetected, false);
  assert.ok(sessionState.baselineEar >= 0.33);

  const blinkingEyes = extractMetricsFromFace(buildMockFace({ ear: 0.25 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(blinkingEyes, { challengeType: 'blink', sessionState }).actionDetected, true);

  const gestureBlink = extractMetricsFromFace(buildMockFace({ ear: 0.30 }), [{ gesture: 'blink left eye' }], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(gestureBlink, { challengeType: 'blink', sessionState: {} }).actionDetected, true);
});

test('inspectFullFaceFrame / evaluateFullFaceMetrics relax tight square-crop margins while rejecting cropped glimpses and non-face frames', async () => {
  // Centered square-crop face close to margins (rx=0.02, rw=0.84, ry=0.02, rh=0.88) should be accepted
  const squareCropMetrics = extractMetricsFromFace(
    buildMockFace({ boxRaw: [0.02, 0.02, 0.84, 0.88], silhouetteMargin: 0.02 }),
    [{ gesture: 'facing center' }],
    384,
    384
  );
  const squareCropResult = evaluateFullFaceMetrics(squareCropMetrics, { requirePassportFraming: true });
  assert.equal(squareCropResult.ready, true);
  assert.equal(squareCropResult.fullFaceVisible, true);
  assert.equal(squareCropResult.passportQuality, true);
  assert.equal(squareCropResult.spoofDetected, false);

  // Partial edge glimpse missing eye landmarks must still be rejected
  const partialFaceMetrics = extractMetricsFromFace(
    buildMockFace({ omitRightEye: true }),
    [],
    384,
    384
  );
  const partialResult = evaluateFullFaceMetrics(partialFaceMetrics, { requirePassportFraming: true });
  assert.equal(partialResult.ready, false);
  assert.equal(partialResult.fullFaceVisible, false);

  // Edge-clipped silhouette (< 0.005) must still be rejected
  const clippedMetrics = extractMetricsFromFace(
    buildMockFace({ boxRaw: [0.001, 0.15, 0.60, 0.70], silhouetteMargin: 0.001 }),
    [],
    384,
    384
  );
  const clippedResult = evaluateFullFaceMetrics(clippedMetrics, { requirePassportFraming: false });
  assert.equal(clippedResult.ready, false);
  assert.equal(clippedResult.fullFaceVisible, false);

  // Active challenge should NOT drop to no_face when fullFaceVisible is false mid-turn
  const midTurnMetrics = extractMetricsFromFace(
    buildMockFace({ boxRaw: [0.002, 0.15, 0.60, 0.70], silhouetteMargin: 0.002, yawDeg: -12, noseShift: 0.12 }),
    [{ gesture: 'facing left' }],
    384,
    384
  );
  assert.equal(midTurnMetrics.fullFaceVisible, false);
  const midTurnActive = evaluateActiveChallengeMetrics(midTurnMetrics, { challengeType: 'turn_left' });
  assert.equal(midTurnActive.faceDetected, true);
  assert.equal(midTurnActive.actionDetected, true);
  assert.equal(midTurnActive.guidance, 'passed');

  // Real Human engine rejects empty buffer and patterned non-face frames
  const emptyRes = await inspectFullFaceFrame({ frameBuffer: Buffer.alloc(0) });
  assert.equal(emptyRes.ok, false);
  assert.equal(emptyRes.faceDetected, false);
  assert.equal(emptyRes.guidance, 'no_face');

  const wallPng = await createSamplePatternPng(320, 240, 9);
  const wallQuality = await inspectFullFaceFrame({ frameBuffer: wallPng, requirePassportFraming: true });
  assert.equal(wallQuality.ready, false);
  assert.equal(wallQuality.faceDetected, false);
  assert.equal(wallQuality.guidance, 'no_face');

  const wallChallenge = await verifyActiveChallengeFrame({ frameBuffer: wallPng, challengeType: 'turn_left' });
  assert.equal(wallChallenge.faceDetected, false);
  assert.equal(wallChallenge.actionDetected, false);
  assert.equal(wallChallenge.guidance, 'no_face');
});

test('real-time anti-spoof rejects clear spoof scores without falsely rejecting real faces or missing scores', () => {
  // Missing / null scores (e.g. model returned 0) must not trigger false spoof rejection
  assert.equal(evaluateAntiSpoof({ realScore: null, liveScore: null }).spoofDetected, false);
  // Real webcam scores pass cleanly
  assert.equal(evaluateAntiSpoof({ realScore: 0.72, liveScore: 0.65 }).spoofDetected, false);
  // Moderate real score with low live score (e.g. glasses/lighting) must not falsely reject
  assert.equal(evaluateAntiSpoof({ realScore: 0.75, liveScore: 0.22 }).spoofDetected, false);

  // Clear spoof scores fail both framing and active challenge
  const spoofMetrics = extractMetricsFromFace(
    buildMockFace({ realScore: 0.12, liveScore: 0.16, yawDeg: -12 }),
    [{ gesture: 'facing left' }],
    384,
    384
  );
  const framingSpoof = evaluateFullFaceMetrics(spoofMetrics, { requirePassportFraming: true });
  assert.equal(framingSpoof.ready, false);
  assert.equal(framingSpoof.spoofDetected, true);
  assert.equal(framingSpoof.guidance, 'spoof_detected');
  assert.deepEqual(framingSpoof.antiSpoof, { spoofDetected: true, realScore: 0.12, liveScore: 0.16 });

  const challengeSpoof = evaluateActiveChallengeMetrics(spoofMetrics, { challengeType: 'turn_left' });
  assert.equal(challengeSpoof.actionDetected, false);
  assert.equal(challengeSpoof.spoofDetected, true);
  assert.equal(challengeSpoof.guidance, 'spoof_detected');
});

test('close circular selfie crops, baseline-relative head turns, and real turned-head portraits respond reliably', async () => {
  // Close-up centered face (rw=0.92, rh=0.93) passes initial readiness check for circular UI
  const closeUpMetrics = extractMetricsFromFace(
    buildMockFace({ boxRaw: [0.04, 0.035, 0.92, 0.93], silhouetteMargin: 0.008 }),
    [{ gesture: 'facing center' }],
    384,
    384
  );
  const closeUpReady = evaluateFullFaceMetrics(closeUpMetrics, { requirePassportFraming: false });
  assert.equal(closeUpReady.ready, true);
  assert.equal(closeUpReady.fullFaceVisible, true);
  assert.equal(closeUpReady.guidance, 'ready');

  // Baseline-relative turn_left works smoothly even when camera sits slightly off-axis (+3.5° resting yaw -> -2.5° turn)
  const sessionState = {};
  const restingMetrics = extractMetricsFromFace(buildMockFace({ yawDeg: 3.5, noseShift: -0.02 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(restingMetrics, { challengeType: 'turn_left', sessionState }).actionDetected, false);

  const naturalTurnLeft = extractMetricsFromFace(buildMockFace({ yawDeg: -2.5, noseShift: 0.03 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(naturalTurnLeft, { challengeType: 'turn_left', sessionState }).actionDetected, true);

  // Iris-assisted turn cue ('looking left' + modest yaw -3.5°) also responds without cross-triggering right
  const irisLeft = extractMetricsFromFace(buildMockFace({ yawDeg: -3.5, noseShift: 0.045 }), [{ gesture: 'looking left' }], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(irisLeft, { challengeType: 'turn_left', sessionState: {} }).actionDetected, true);
  assert.equal(evaluateActiveChallengeMetrics(irisLeft, { challengeType: 'turn_right', sessionState: {} }).actionDetected, false);

  // Real turned portrait crop from @vladmandic/human/assets/samples.jpg passes turn_left and ignores weak background ghosts
  const samplesPath = fileURLToPath(new URL('../node_modules/@vladmandic/human/assets/samples.jpg', import.meta.url));
  const meta = await sharp(samplesPath).metadata();
  const turnedTile = await sharp(samplesPath)
    .extract({ left: 0, top: 0, width: Math.floor(meta.width / 3), height: Math.floor(meta.height / 2) })
    .jpeg()
    .toBuffer();
  const realTurnLeft = await verifyActiveChallengeFrame({ frameBuffer: turnedTile, challengeType: 'turn_left', sessionState: {} });
  assert.equal(realTurnLeft.faceDetected, true);
  assert.equal(realTurnLeft.actionDetected, true);
  assert.equal(realTurnLeft.guidance, 'passed');

  const wrongDirection = await verifyActiveChallengeFrame({ frameBuffer: turnedTile, challengeType: 'turn_right', sessionState: {} });
  assert.equal(wrongDirection.actionDetected, false);

  // Dual Node.js engine loads @vladmandic/face-api fast track alongside @vladmandic/human
  const status = getFaceLivenessEngineStatus();
  assert.equal(status.initialized, true);
  assert.equal(status.faceApiReady, true);

  // Adaptive open_mouth responds quickly to gentle parting of lips while staying false when closed
  const mouthState = { antiSpoofChecked: true };
  const closedLipMetrics = extractMetricsFromFace(buildMockFace({ mouthGapRatio: 0.03 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(closedLipMetrics, { challengeType: 'open_mouth', sessionState: mouthState }).actionDetected, false);

  const gentleOpenMetrics = extractMetricsFromFace(buildMockFace({ mouthGapRatio: 0.08 }), [], 384, 384);
  assert.equal(evaluateActiveChallengeMetrics(gentleOpenMetrics, { challengeType: 'open_mouth', sessionState: mouthState }).actionDetected, true);
});
