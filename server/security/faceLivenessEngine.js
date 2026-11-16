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

function extractMetricsFromFace(face, gestures = [], imgWidth = 1, imgHeight = 1) {
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

  // Enforce strict full-face visibility inside camera boundaries (never accept partial edge glimpses)
  const [rx, ry, rw, rh] = boxRaw;
  const marginX = rx >= 0.035 && (rx + rw) <= 0.965;
  const marginY = ry >= 0.035 && (ry + rh) <= 0.965;
  const silhouette = Array.isArray(annotations.silhouette) ? annotations.silhouette : [];
  let contourInside = true;
  if (silhouette.length > 0 && imgWidth > 1 && imgHeight > 1) {
    for (const pt of silhouette) {
      const nx = Number(pt?.[0] || 0) / imgWidth;
      const ny = Number(pt?.[1] || 0) / imgHeight;
      if (nx < 0.015 || nx > 0.985 || ny < 0.015 || ny > 0.985) {
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

/**
 * Strictly validates that a camera frame shows ONE centered, uncropped FULL human face,
 * rejecting empty frames, dark frames, multiple faces, and partial/glimpse faces.
 */
export async function inspectFullFaceFrame({ frameBuffer, requirePassportFraming = false } = {}) {
  if (!Buffer.isBuffer(frameBuffer) || frameBuffer.length === 0) {
    return { ok: false, ready: false, faceDetected: false, faceCount: 0, fullFaceVisible: false, guidance: 'no_face' };
  }

  const { result, width, height } = await detectFacesFromBuffer(frameBuffer);
  const faces = Array.isArray(result?.face)
    ? result.face.filter((f) => Number(f?.boxScore ?? f?.score ?? 0) >= 0.52 && Number(f?.faceScore ?? f?.score ?? 0) >= 0.5)
    : [];

  if (faces.length === 0) {
    return {
      ok: true,
      ready: false,
      faceDetected: false,
      faceCount: 0,
      fullFaceVisible: false,
      passportQuality: false,
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
      guidance: 'multiple_faces'
    };
  }

  const face = faces[0];
  const faceGestures = Array.isArray(face?.gestures) && face.gestures.length > 0
    ? face.gestures
    : result?.gesture || [];
  const metrics = extractMetricsFromFace(face, faceGestures, width, height);
  const [rx, ry, rw, rh] = metrics.boxRaw;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;

  if (!metrics.fullFaceVisible) {
    if (cx < 0.36) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, guidance: 'center_left', metrics };
    if (cx > 0.64) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, guidance: 'center_right', metrics };
    if (cy < 0.36) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, guidance: 'center_upper', metrics };
    if (cy > 0.64) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, guidance: 'center_lower', metrics };
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: false, passportQuality: false, guidance: 'move_back', metrics };
  }

  if (rw < 0.22 || rh < 0.28) {
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, guidance: 'move_closer', metrics };
  }
  if (rw > 0.80 || rh > 0.86) {
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, guidance: 'move_back', metrics };
  }

  if (cx < 0.32) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, guidance: 'center_left', metrics };
  if (cx > 0.68) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, guidance: 'center_right', metrics };
  if (cy < 0.30) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, guidance: 'center_upper', metrics };
  if (cy > 0.70) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, guidance: 'center_lower', metrics };

  const blinkGesture = metrics.gestureLabels.some((g) => g.includes('blink'));
  const eyesOpen =
    !blinkGesture &&
    (metrics.leftEAR === null || metrics.leftEAR >= 0.19) &&
    (metrics.rightEAR === null || metrics.rightEAR >= 0.19);
  const straightPose =
    Math.abs(metrics.yawDeg) <= 14 &&
    Math.abs(metrics.noseShiftRatio) <= 0.14 &&
    Math.abs(metrics.pitchDeg) <= 15 &&
    Math.abs(metrics.rollDeg) <= 15;
  const mouthNeutral = metrics.mouthPercent < 25 && metrics.mouthOpenRatio < 0.22;
  const antiSpoofOk = metrics.realScore === null || metrics.realScore >= 0.25;

  const passportQuality = Boolean(
    metrics.fullFaceVisible &&
      straightPose &&
      eyesOpen &&
      mouthNeutral &&
      antiSpoofOk &&
      rw >= 0.26 &&
      rh >= 0.32 &&
      cx >= 0.35 &&
      cx <= 0.65 &&
      cy >= 0.33 &&
      cy <= 0.67
  );

  if (requirePassportFraming && !passportQuality) {
    return {
      ok: true,
      ready: false,
      faceDetected: true,
      faceCount: 1,
      fullFaceVisible: true,
      passportQuality: false,
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
    guidance: 'ready',
    metrics
  };
}

/**
 * Evaluates active liveness challenge frames (`turn_left`, `turn_right`, `open_mouth`, `blink`)
 * with responsive facial landmark ratios and strict full-face visibility checks.
 */
export async function verifyActiveChallengeFrame({
  frameBuffer,
  challengeType = 'turn_right',
  sessionState = {}
} = {}) {
  const inspection = await inspectFullFaceFrame({ frameBuffer, requirePassportFraming: false });
  if (!inspection.faceDetected || inspection.faceCount !== 1 || !inspection.fullFaceVisible) {
    return {
      ok: true,
      faceDetected: false,
      faceCount: inspection.faceCount || 0,
      fullFaceVisible: false,
      actionDetected: false,
      guidance: inspection.guidance === 'multiple_faces' ? 'multiple_faces' : 'no_face'
    };
  }

  const m = inspection.metrics;

  // Update highest neutral open-eye EAR observed in this session for adaptive blink sensitivity
  if (
    typeof m.avgEAR === 'number' &&
    !m.gestureLabels.some((g) => g.includes('blink')) &&
    (!sessionState.baselineEar || m.avgEAR > sessionState.baselineEar)
  ) {
    sessionState.baselineEar = Math.min(0.45, m.avgEAR);
  }

  let actionDetected = false;
  if (challengeType === 'open_mouth') {
    const gestureMouth = m.gestureLabels.some((g) => g.includes('mouth'));
    actionDetected =
      m.mouthOpenRatio >= 0.145 ||
      m.mouthGapToFace >= 0.052 ||
      m.mouthPercent >= 15 ||
      gestureMouth;
  } else if (challengeType === 'blink') {
    const gestureBlink = m.gestureLabels.some((g) => g.includes('blink'));
    const adaptiveBlink =
      typeof sessionState.baselineEar === 'number' &&
      typeof m.avgEAR === 'number' &&
      sessionState.baselineEar >= 0.24 &&
      m.avgEAR <= sessionState.baselineEar * 0.76;
    actionDetected =
      gestureBlink ||
      adaptiveBlink ||
      (typeof m.minEAR === 'number' && m.minEAR <= 0.235) ||
      (typeof m.avgEAR === 'number' && m.avgEAR <= 0.248);
  } else if (challengeType === 'turn_right') {
    // Un-mirrored webcam frame: subject turning their own head right moves nose toward viewer left (negative X / yaw)
    const facingLeftInRaw = m.gestureLabels.some((g) => g === 'facing left');
    actionDetected =
      m.noseShiftRatio <= -0.095 ||
      m.yawDeg <= -9.5 ||
      facingLeftInRaw;
  } else if (challengeType === 'turn_left') {
    // Un-mirrored webcam frame: subject turning their own head left moves nose toward viewer right (positive X / yaw)
    const facingRightInRaw = m.gestureLabels.some((g) => g === 'facing right');
    actionDetected =
      m.noseShiftRatio >= 0.095 ||
      m.yawDeg >= 9.5 ||
      facingRightInRaw;
  }

  return {
    ok: true,
    faceDetected: true,
    faceCount: 1,
    fullFaceVisible: true,
    actionDetected: Boolean(actionDetected),
    guidance: actionDetected ? 'passed' : 'perform_action',
    metrics: m
  };
}

export const faceLivenessEngine = {
  warmupFaceLivenessEngine,
  getFaceLivenessEngineStatus,
  inspectFullFaceFrame,
  verifyActiveChallengeFrame
};

export default faceLivenessEngine;
