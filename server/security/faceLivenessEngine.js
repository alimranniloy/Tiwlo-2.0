import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, '..');
const modelsDir = resolve(serverDir, 'node_modules', '@vladmandic', 'human', 'models');
const wasmDir = resolve(serverDir, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist');
const humanNodeWasmPath = resolve(serverDir, 'node_modules', '@vladmandic', 'human', 'dist', 'human.node-wasm.js');

const require = createRequire(import.meta.url);

let humanPromise = null;
let humanInstance = null;
let loadRouterRegistered = false;

function getModelsLoadedList(instance) {
  try {
    return typeof instance?.models?.loaded === 'function' ? instance.models.loaded() : [];
  } catch {
    return [];
  }
}

/**
 * Initializes and caches the local Node.js neural 3D face mesh + iris + anti-spoof
 * verification engine using @vladmandic/human and TensorFlow.js WASM backend.
 */
export async function warmupFaceLivenessEngine() {
  if (humanInstance) return humanInstance;
  if (humanPromise) return humanPromise;

  humanPromise = (async () => {
    if (!existsSync(humanNodeWasmPath) || !existsSync(modelsDir) || !existsSync(wasmDir)) {
      throw new Error('Local Node.js face engine packages (@vladmandic/human or tfjs-backend-wasm) are not installed.');
    }

    const wasmPkg = require('@tensorflow/tfjs-backend-wasm');
    if (typeof wasmPkg.setWasmPaths === 'function') {
      wasmPkg.setWasmPaths(`${wasmDir}/`);
    }

    const { Human } = require(humanNodeWasmPath);
    const instance = new Human({
      modelBasePath: 'local://models/',
      wasmPath: `${wasmDir}/`,
      backend: 'wasm',
      debug: false,
      async: true,
      warmup: 'none',
      cacheSensitivity: 0,
      face: {
        enabled: true,
        detector: {
          enabled: true,
          rotation: true,
          maxDetected: 4,
          minConfidence: 0.45,
          iouThreshold: 0.3
        },
        mesh: { enabled: true, keepInvalid: false },
        iris: { enabled: true },
        attention: false,
        emotion: { enabled: false },
        description: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true }
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false }
    });

    if (!loadRouterRegistered && instance?.tf?.io?.registerLoadRouter) {
      instance.tf.io.registerLoadRouter((url) => {
        if (typeof url !== 'string' || !url.startsWith('local://models/')) {
          return null;
        }
        return {
          async load() {
            const modelFile = url.slice('local://models/'.length);
            const fullJsonPath = resolve(modelsDir, modelFile);
            const rawJson = await readFile(fullJsonPath, 'utf8');
            const json = JSON.parse(rawJson);
            const manifest = json.weightsManifest?.[0];
            const weightSpecs = manifest?.weights || [];
            const weightPaths = Array.isArray(manifest?.paths) ? manifest.paths : [];
            const weightChunks = await Promise.all(
              weightPaths.map((p) => readFile(resolve(modelsDir, p)))
            );
            const weightData = Buffer.concat(weightChunks);
            return {
              modelTopology: json.modelTopology,
              format: json.format,
              generatedBy: json.generatedBy,
              convertedBy: json.convertedBy,
              weightSpecs,
              weightData: weightData.buffer.slice(
                weightData.byteOffset,
                weightData.byteOffset + weightData.byteLength
              )
            };
          }
        };
      });
      loadRouterRegistered = true;
    }

    await instance.init();
    await instance.load();

    // Warm tensor pipeline cleanly once
    const warmTensor = instance.tf.zeros([1, 240, 240, 3], 'int32');
    try {
      await instance.detect(warmTensor);
    } finally {
      instance.tf.dispose(warmTensor);
    }

    humanInstance = instance;
    return instance;
  })().catch((error) => {
    humanPromise = null;
    throw error;
  });

  return humanPromise;
}

export function getFaceLivenessEngineStatus() {
  return {
    initialized: Boolean(humanInstance),
    backend: humanInstance?.tf?.getBackend?.() || null,
    modelsLoaded: humanInstance ? getModelsLoadedList(humanInstance) : []
  };
}

function pointDistance2D(a, b) {
  if (!a || !b || a.length < 2 || b.length < 2) return 0;
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function computePointsMean(points) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += Number(p?.[0] || 0);
    sy += Number(p?.[1] || 0);
  }
  return [sx / points.length, sy / points.length];
}

function computeEyeAspectRatio(upperPoints, lowerPoints) {
  if (!Array.isArray(upperPoints) || upperPoints.length < 5 || !Array.isArray(lowerPoints) || lowerPoints.length < 5) {
    return null;
  }
  const outer = upperPoints[0];
  const inner = upperPoints[upperPoints.length - 1];
  const width = pointDistance2D(outer, inner);
  if (width <= 1e-3) return null;

  const sampleIndices = [1, Math.floor(upperPoints.length / 2), upperPoints.length - 2];
  let sumHeight = 0;
  let count = 0;
  for (const idx of sampleIndices) {
    if (upperPoints[idx] && lowerPoints[idx]) {
      sumHeight += pointDistance2D(upperPoints[idx], lowerPoints[idx]);
      count += 1;
    }
  }
  if (!count) return null;
  return (sumHeight / count) / width;
}

function computeMouthMetrics(annotations = {}, faceHeight = 1) {
  const upper = Array.isArray(annotations.lipsUpperInner) && annotations.lipsUpperInner.length >= 3
    ? annotations.lipsUpperInner
    : annotations.lipsUpperOuter;
  const lower = Array.isArray(annotations.lipsLowerInner) && annotations.lipsLowerInner.length >= 3
    ? annotations.lipsLowerInner
    : annotations.lipsLowerOuter;

  if (!Array.isArray(upper) || upper.length < 3 || !Array.isArray(lower) || lower.length < 3) {
    return { mouthOpenRatio: 0, mouthGapToFace: 0 };
  }

  const leftCorner = upper[0];
  const rightCorner = upper[upper.length - 1];
  const mouthWidth = pointDistance2D(leftCorner, rightCorner);
  const midIdxUpper = Math.floor(upper.length / 2);
  const midIdxLower = Math.floor(lower.length / 2);
  const gap = pointDistance2D(upper[midIdxUpper], lower[midIdxLower]);

  return {
    mouthOpenRatio: mouthWidth > 1e-3 ? gap / mouthWidth : 0,
    mouthGapToFace: faceHeight > 1e-3 ? gap / faceHeight : 0
  };
}

export function extractMetricsFromFace(face, gestures = [], imgWidth = 1, imgHeight = 1) {
  const annotations = face?.annotations || {};
  const box = Array.isArray(face?.box) ? face.box : [0, 0, 0, 0];
  const boxRaw = Array.isArray(face?.boxRaw)
    ? face.boxRaw
    : [box[0] / Math.max(1, imgWidth), box[1] / Math.max(1, imgHeight), box[2] / Math.max(1, imgWidth), box[3] / Math.max(1, imgHeight)];

  const leftEAR = computeEyeAspectRatio(annotations.leftEyeUpper0, annotations.leftEyeLower0);
  const rightEAR = computeEyeAspectRatio(annotations.rightEyeUpper0, annotations.rightEyeLower0);
  const earValues = [leftEAR, rightEAR].filter((v) => typeof v === 'number' && Number.isFinite(v));
  const avgEAR = earValues.length > 0 ? earValues.reduce((a, b) => a + b, 0) / earValues.length : null;
  const minEAR = earValues.length > 0 ? Math.min(...earValues) : null;

  const { mouthOpenRatio, mouthGapToFace } = computeMouthMetrics(annotations, box[3]);

  let noseShiftRatio = 0;
  const noseMean = computePointsMean(annotations.noseTip);
  if (noseMean && box[2] > 1) {
    const faceCenterX = box[0] + box[2] / 2;
    noseShiftRatio = (noseMean[0] - faceCenterX) / (box[2] / 2);
  }

  const yawRad = Number(face?.rotation?.angle?.yaw ?? 0);
  const pitchRad = Number(face?.rotation?.angle?.pitch ?? 0);
  const rollRad = Number(face?.rotation?.angle?.roll ?? 0);
  const yawDeg = (yawRad * 180) / Math.PI;
  const pitchDeg = (pitchRad * 180) / Math.PI;
  const rollDeg = (rollRad * 180) / Math.PI;

  const gestureLabels = (Array.isArray(gestures) ? gestures : [])
    .map((g) => String(g?.gesture || '').toLowerCase())
    .filter(Boolean);

  let mouthPercent = 0;
  for (const label of gestureLabels) {
    const m = /^mouth\s+(\d+(?:\.\d+)?)%\s+open$/.exec(label);
    if (m) {
      mouthPercent = Math.max(mouthPercent, Number(m[1]));
    }
  }

  // Enforce full-face visibility inside camera boundaries while tolerating square-cropped portraits
  const [rx, ry, rw, rh] = boxRaw;
  const marginX = rx >= 0.015 && (rx + rw) <= 0.985;
  const marginY = ry >= 0.015 && (ry + rh) <= 0.985;
  const silhouette = Array.isArray(annotations.silhouette) ? annotations.silhouette : [];
  let contourInside = true;
  if (silhouette.length > 0 && imgWidth > 1 && imgHeight > 1) {
    for (const pt of silhouette) {
      const nx = Number(pt?.[0] || 0) / imgWidth;
      const ny = Number(pt?.[1] || 0) / imgHeight;
      if (nx < 0.005 || nx > 0.995 || ny < 0.005 || ny > 0.995) {
        contourInside = false;
        break;
      }
    }
  }

  const hasEyesAndMouthLandmarks =
    Array.isArray(annotations.leftEyeUpper0) &&
    annotations.leftEyeUpper0.length > 0 &&
    Array.isArray(annotations.rightEyeUpper0) &&
    annotations.rightEyeUpper0.length > 0 &&
    Array.isArray(annotations.lipsUpperOuter) &&
    annotations.lipsUpperOuter.length > 0;

  const fullFaceVisible = Boolean(marginX && marginY && contourInside && hasEyesAndMouthLandmarks);

  return {
    boxRaw,
    leftEAR,
    rightEAR,
    avgEAR,
    minEAR,
    mouthOpenRatio,
    mouthGapToFace,
    mouthPercent,
    noseShiftRatio,
    yawDeg,
    pitchDeg,
    rollDeg,
    gestureLabels,
    fullFaceVisible,
    realScore: typeof face?.real === 'number' ? face.real : null,
    liveScore: typeof face?.live === 'number' ? face.live : null
  };
}

async function detectFacesFromBuffer(frameBuffer) {
  const human = await warmupFaceLivenessEngine();
  const { data, info } = await sharp(frameBuffer, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize({ width: 384, height: 384, fit: 'inside', withoutEnlargement: false })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensor = human.tf.tensor3d(new Int32Array(data), [info.height, info.width, info.channels], 'int32');
  try {
    const result = await human.detect(tensor);
    return { result, width: info.width, height: info.height };
  } finally {
    human.tf.dispose(tensor);
  }
}

async function detectFilteredFaces(frameBuffer) {
  const { result, width, height } = await detectFacesFromBuffer(frameBuffer);
  const faces = Array.isArray(result?.face)
    ? result.face.filter((f) => Number(f?.boxScore ?? f?.score ?? 0) >= 0.52 && Number(f?.faceScore ?? f?.score ?? 0) >= 0.5)
    : [];
  return { result, faces, width, height };
}

/**
 * Evaluates @vladmandic/human antispoof (`face.real`) and liveness (`face.live`) scores
 * only when finite values are emitted, using conservative thresholds to avoid false positives.
 */
export function evaluateAntiSpoof(metrics, { isActiveChallenge = false } = {}) {
  const hasReal = typeof metrics?.realScore === 'number' && Number.isFinite(metrics.realScore);
  const hasLive = typeof metrics?.liveScore === 'number' && Number.isFinite(metrics.liveScore);
  const realScore = hasReal ? metrics.realScore : null;
  const liveScore = hasLive ? metrics.liveScore : null;

  let spoofDetected = false;
  if (hasReal && hasLive) {
    spoofDetected = isActiveChallenge
      ? (realScore < 0.15 || (realScore < 0.22 && liveScore < 0.35) || (realScore < 0.32 && liveScore < 0.20))
      : (realScore < 0.25 || (realScore < 0.40 && liveScore < 0.28) || liveScore < 0.15);
  } else if (hasReal) {
    spoofDetected = realScore < (isActiveChallenge ? 0.20 : 0.25);
  } else if (hasLive) {
    spoofDetected = liveScore < (isActiveChallenge ? 0.15 : 0.18);
  }

  return {
    spoofDetected,
    realScore,
    liveScore
  };
}

/**
 * Evaluates extracted face metrics for full-face framing, anti-spoofing, and passport quality.
 */
export function evaluateFullFaceMetrics(metrics, { requirePassportFraming = false } = {}) {
  const antiSpoof = evaluateAntiSpoof(metrics, { isActiveChallenge: false });
  if (antiSpoof.spoofDetected) {
    return {
      ok: true,
      ready: false,
      faceDetected: true,
      faceCount: 1,
      fullFaceVisible: Boolean(metrics.fullFaceVisible),
      passportQuality: false,
      spoofDetected: true,
      antiSpoof,
      guidance: 'spoof_detected',
      metrics
    };
  }

  const [rx, ry, rw, rh] = metrics.boxRaw;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  if (!metrics.fullFaceVisible) {
    if (cx < 0.30) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_left', metrics };
    if (cx > 0.70) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_right', metrics };
    if (cy < 0.28) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_upper', metrics };
    if (cy > 0.72) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_lower', metrics };
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'move_back', metrics };
  }

  if (rw < 0.18 || rh < 0.22) {
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'move_closer', metrics };
  }
  if (rw > 0.88 || rh > 0.92) {
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'move_back', metrics };
  }

  if (cx < 0.28) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_left', metrics };
  if (cx > 0.72) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_right', metrics };
  if (cy < 0.26) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_upper', metrics };
  if (cy > 0.74) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_lower', metrics };

  const blinkGesture = metrics.gestureLabels.some((g) => g.includes('blink'));
  const eyesOpen =
    !blinkGesture &&
    (metrics.leftEAR === null || metrics.leftEAR >= 0.17) &&
    (metrics.rightEAR === null || metrics.rightEAR >= 0.17);
  const straightPose =
    Math.abs(metrics.yawDeg) <= 16 &&
    Math.abs(metrics.noseShiftRatio) <= 0.16 &&
    Math.abs(metrics.pitchDeg) <= 18 &&
    Math.abs(metrics.rollDeg) <= 16;
  const mouthNeutral = metrics.mouthPercent < 25 && metrics.mouthOpenRatio < 0.22;

  const passportQuality = Boolean(
    metrics.fullFaceVisible &&
      straightPose &&
      eyesOpen &&
      mouthNeutral &&
      !antiSpoof.spoofDetected &&
      rw >= 0.22 &&
      rh >= 0.26 &&
      cx >= 0.30 &&
      cx <= 0.70 &&
      cy >= 0.28 &&
      cy <= 0.72
  );

  if (requirePassportFraming && !passportQuality) {
    return {
      ok: true,
      ready: false,
      faceDetected: true,
      faceCount: 1,
      fullFaceVisible: true,
      passportQuality: false,
      spoofDetected: false,
      antiSpoof,
      guidance: 'hold_still',
      metrics
    };
  }

  return {
    ok: true,
    ready: true,
    faceDetected: true,
    faceCount: 1,
    fullFaceVisible: true,
    passportQuality,
    spoofDetected: false,
    antiSpoof,
    guidance: 'ready',
    metrics
  };
}

/**
 * Strictly validates that a camera frame shows ONE centered, uncropped FULL human face,
 * rejecting empty frames, dark frames, multiple faces, spoofed faces, and partial/glimpse faces.
 */
export async function inspectFullFaceFrame({ frameBuffer, requirePassportFraming = false } = {}) {
  if (!Buffer.isBuffer(frameBuffer) || frameBuffer.length === 0) {
    return {
      ok: false,
      ready: false,
      faceDetected: false,
      faceCount: 0,
      fullFaceVisible: false,
      spoofDetected: false,
      guidance: 'no_face'
    };
  }

  const { result, faces, width, height } = await detectFilteredFaces(frameBuffer);

  if (faces.length === 0) {
    return {
      ok: true,
      ready: false,
      faceDetected: false,
      faceCount: 0,
      fullFaceVisible: false,
      passportQuality: false,
      spoofDetected: false,
      guidance: 'no_face'
    };
  }

  if (faces.length > 1) {
    return {
      ok: true,
      ready: false,
      faceDetected: true,
      faceCount: faces.length,
      fullFaceVisible: false,
      passportQuality: false,
      spoofDetected: false,
      guidance: 'multiple_faces'
    };
  }

  const face = faces[0];
  const faceGestures = Array.isArray(face?.gestures) && face.gestures.length > 0
    ? face.gestures
    : result?.gesture || [];
  const metrics = extractMetricsFromFace(face, faceGestures, width, height);
  return evaluateFullFaceMetrics(metrics, { requirePassportFraming });
}

/**
 * Evaluates extracted metrics for an active liveness challenge and real-time anti-spoofing.
 */
export function evaluateActiveChallengeMetrics(
  metrics,
  { challengeType = 'turn_right', sessionState = {} } = {}
) {
  const antiSpoof = evaluateAntiSpoof(metrics, { isActiveChallenge: true });
  if (antiSpoof.spoofDetected) {
    return {
      ok: true,
      faceDetected: true,
      faceCount: 1,
      fullFaceVisible: Boolean(metrics.fullFaceVisible),
      actionDetected: false,
      spoofDetected: true,
      antiSpoof,
      guidance: 'spoof_detected',
      metrics
    };
  }

  // Update highest neutral open-eye EAR observed in this session for adaptive blink sensitivity
  if (
    typeof metrics.avgEAR === 'number' &&
    !metrics.gestureLabels.some((g) => g.includes('blink')) &&
    (!sessionState.baselineEar || metrics.avgEAR > sessionState.baselineEar)
  ) {
    sessionState.baselineEar = Math.min(0.45, metrics.avgEAR);
  }

  let actionDetected = false;
  if (challengeType === 'open_mouth') {
    const gestureMouth = metrics.gestureLabels.some((g) => g.includes('mouth'));
    actionDetected =
      metrics.mouthOpenRatio >= 0.145 ||
      metrics.mouthGapToFace >= 0.052 ||
      metrics.mouthPercent >= 15 ||
      gestureMouth;
  } else if (challengeType === 'blink') {
    const gestureBlink = metrics.gestureLabels.some((g) => g.includes('blink'));
    const adaptiveBlink =
      typeof sessionState.baselineEar === 'number' &&
      typeof metrics.avgEAR === 'number' &&
      sessionState.baselineEar >= 0.24 &&
      metrics.avgEAR <= sessionState.baselineEar * 0.76;
    actionDetected =
      gestureBlink ||
      adaptiveBlink ||
      (typeof metrics.minEAR === 'number' && metrics.minEAR <= 0.235) ||
      (typeof metrics.avgEAR === 'number' && metrics.avgEAR <= 0.248);
  } else if (challengeType === 'turn_left') {
    // Un-mirrored frame: subject turning their own head left produces 'facing left', negative yaw, and nose shift toward viewer right (+X)
    const facingLeft = metrics.gestureLabels.some((g) => g === 'facing left');
    const facingRight = metrics.gestureLabels.some((g) => g === 'facing right');
    actionDetected =
      !facingRight &&
      (facingLeft ||
        metrics.yawDeg <= -7.5 ||
        (metrics.noseShiftRatio >= 0.085 && metrics.yawDeg <= 2));
  } else if (challengeType === 'turn_right') {
    // Un-mirrored frame: subject turning their own head right produces 'facing right', positive yaw, and nose shift toward viewer left (-X)
    const facingRight = metrics.gestureLabels.some((g) => g === 'facing right');
    const facingLeft = metrics.gestureLabels.some((g) => g === 'facing left');
    actionDetected =
      !facingLeft &&
      (facingRight ||
        metrics.yawDeg >= 7.5 ||
        (metrics.noseShiftRatio <= -0.085 && metrics.yawDeg >= -2));
  }

  return {
    ok: true,
    faceDetected: true,
    faceCount: 1,
    fullFaceVisible: Boolean(metrics.fullFaceVisible),
    actionDetected: Boolean(actionDetected),
    spoofDetected: false,
    antiSpoof,
    guidance: actionDetected ? 'passed' : 'perform_action',
    metrics
  };
}

/**
 * Evaluates active liveness challenge frames (`turn_left`, `turn_right`, `open_mouth`, `blink`)
 * whenever a single face is detected (without dropping turned heads as `no_face`), with anti-spoof checks.
 */
export async function verifyActiveChallengeFrame({
  frameBuffer,
  challengeType = 'turn_right',
  sessionState = {}
} = {}) {
  if (!Buffer.isBuffer(frameBuffer) || frameBuffer.length === 0) {
    return {
      ok: false,
      faceDetected: false,
      faceCount: 0,
      fullFaceVisible: false,
      actionDetected: false,
      spoofDetected: false,
      guidance: 'no_face'
    };
  }

  const { result, faces, width, height } = await detectFilteredFaces(frameBuffer);

  if (faces.length === 0) {
    return {
      ok: true,
      faceDetected: false,
      faceCount: 0,
      fullFaceVisible: false,
      actionDetected: false,
      spoofDetected: false,
      guidance: 'no_face'
    };
  }

  if (faces.length > 1) {
    return {
      ok: true,
      faceDetected: true,
      faceCount: faces.length,
      fullFaceVisible: false,
      actionDetected: false,
      spoofDetected: false,
      guidance: 'multiple_faces'
    };
  }

  const face = faces[0];
  const faceGestures = Array.isArray(face?.gestures) && face.gestures.length > 0
    ? face.gestures
    : result?.gesture || [];
  const metrics = extractMetricsFromFace(face, faceGestures, width, height);
  return evaluateActiveChallengeMetrics(metrics, { challengeType, sessionState });
}

export const faceLivenessEngine = {
  warmupFaceLivenessEngine,
  getFaceLivenessEngineStatus,
  inspectFullFaceFrame,
  verifyActiveChallengeFrame,
  extractMetricsFromFace,
  evaluateAntiSpoof,
  evaluateFullFaceMetrics,
  evaluateActiveChallengeMetrics
};

export default faceLivenessEngine;
