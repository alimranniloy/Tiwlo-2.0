import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, '..');
const modelsDir = resolve(serverDir, 'node_modules', '@vladmandic', 'human', 'models');
const faceApiModelsDir = resolve(serverDir, 'node_modules', '@vladmandic', 'face-api', 'model');
const wasmDir = resolve(serverDir, 'node_modules', '@tensorflow', 'tfjs-backend-wasm', 'dist');
const humanNodeWasmPath = resolve(serverDir, 'node_modules', '@vladmandic', 'human', 'dist', 'human.node-wasm.js');
const faceApiNodeWasmPath = resolve(serverDir, 'node_modules', '@vladmandic', 'face-api', 'dist', 'face-api.node-wasm.js');

const require = createRequire(import.meta.url);

let humanPromise = null;
let humanInstance = null;
let faceApiInstance = null;
let faceApiReady = false;
let loadRouterRegistered = false;

function getModelsLoadedList(instance) {
  try {
    return typeof instance?.models?.loaded === 'function' ? instance.models.loaded() : [];
  } catch {
    return [];
  }
}

/**
 * Initializes and caches the dual local Node.js neural face liveness engines:
 * 1) @vladmandic/human (BlazeFace + 468 FaceMesh + AntiSpoof + Liveness WASM)
 * 2) @vladmandic/face-api (TinyFaceDetector + 68-Landmark TinyNet WASM for 35ms response)
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
      filter: { enabled: false },
      face: {
        enabled: true,
        detector: {
          enabled: true,
          rotation: false,
          maxDetected: 4,
          minConfidence: 0.35,
          iouThreshold: 0.3,
          skipFrames: 0,
          skipTime: 0
        },
        mesh: { enabled: true, keepInvalid: false },
        iris: { enabled: false },
        attention: false,
        emotion: { enabled: false },
        description: { enabled: false },
        antispoof: { enabled: true, skipFrames: 0, skipTime: 0 },
        liveness: { enabled: true, skipFrames: 0, skipTime: 0 }
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

    if (existsSync(faceApiNodeWasmPath) && existsSync(faceApiModelsDir)) {
      try {
        const faceapi = require(faceApiNodeWasmPath);
        await faceapi.tf.setBackend('wasm');
        await faceapi.tf.ready();
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromDisk(faceApiModelsDir),
          faceapi.nets.faceLandmark68TinyNet.loadFromDisk(faceApiModelsDir)
        ]);
        const faWarm = faceapi.tf.zeros([224, 224, 3], 'int32');
        try {
          await faceapi.detectAllFaces(
            faWarm,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
          ).withFaceLandmarks(true);
        } finally {
          faceapi.tf.dispose(faWarm);
        }
        faceApiInstance = faceapi;
        faceApiReady = true;
      } catch (err) {
        console.warn('[FaceEngine] Optional @vladmandic/face-api fast track unavailable:', err.message);
      }
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
    modelsLoaded: humanInstance ? getModelsLoadedList(humanInstance) : [],
    faceApiReady
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

  // Span mouth width across outer contour points when available to avoid inner vertex ordering skew
  const outerPts = [
    ...(Array.isArray(annotations.lipsUpperOuter) ? annotations.lipsUpperOuter : upper),
    ...(Array.isArray(annotations.lipsLowerOuter) ? annotations.lipsLowerOuter : lower)
  ];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of outerPts) {
    if (p && typeof p[0] === 'number') {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
    }
  }
  const mouthWidth = maxX > minX ? maxX - minX : pointDistance2D(upper[0], upper[upper.length - 1]);

  let gap = 0;
  if (upper.length === 3 && lower.length === 3) {
    gap = pointDistance2D(upper[1], lower[1]);
  } else {
    // Compare matched-X vertical separation across central inner-lip vertices
    const midStart = minX + mouthWidth * 0.2;
    const midEnd = maxX - mouthWidth * 0.2;
    let maxCenterGap = 0;
    let sumCenterGap = 0;
    let centerCount = 0;
    for (const pu of upper) {
      if (!pu || pu[0] < midStart || pu[0] > midEnd) continue;
      let bestLower = null;
      let bestDx = Infinity;
      for (const pl of lower) {
        if (!pl) continue;
        const dx = Math.abs(pl[0] - pu[0]);
        if (dx < bestDx) {
          bestDx = dx;
          bestLower = pl;
        }
      }
      if (bestLower) {
        const dy = Math.max(0, bestLower[1] - pu[1]);
        if (dy > maxCenterGap) maxCenterGap = dy;
        sumCenterGap += dy;
        centerCount += 1;
      }
    }
    gap = centerCount > 0 ? Math.max(maxCenterGap * 0.85, sumCenterGap / centerCount) : pointDistance2D(upper[Math.floor(upper.length / 2)], lower[Math.floor(lower.length / 2)]);
  }

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

  // Enforce full-face visibility inside camera boundaries while tolerating close circular crops
  const [rx, ry, rw, rh] = boxRaw;
  const marginX = rx >= 0.005 && (rx + rw) <= 0.995;
  const marginY = ry >= 0.005 && (ry + rh) <= 0.995;
  const silhouette = Array.isArray(annotations.silhouette) ? annotations.silhouette : [];
  let contourInside = true;
  if (silhouette.length > 0 && imgWidth > 1 && imgHeight > 1) {
    for (const pt of silhouette) {
      const nx = Number(pt?.[0] || 0) / imgWidth;
      const ny = Number(pt?.[1] || 0) / imgHeight;
      if (nx < 0.003 || nx > 0.997 || ny < 0.003 || ny > 0.997) {
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

function unpadDetectedFace(face, padX, padY, origWidth, origHeight) {
  if (!face || typeof face !== 'object') return face;
  const shiftPoint = (pt) => (Array.isArray(pt) ? [Number(pt[0] || 0) - padX, Number(pt[1] || 0) - padY, ...pt.slice(2)] : pt);
  const origBox = Array.isArray(face.box) ? face.box : [0, 0, 0, 0];
  const bx = Number(origBox[0] || 0) - padX;
  const by = Number(origBox[1] || 0) - padY;
  const bw = Number(origBox[2] || 0);
  const bh = Number(origBox[3] || 0);
  const remappedAnnotations = {};
  if (face.annotations && typeof face.annotations === 'object') {
    for (const [key, pts] of Object.entries(face.annotations)) {
      remappedAnnotations[key] = Array.isArray(pts) ? pts.map(shiftPoint) : pts;
    }
  }
  return {
    ...face,
    box: [bx, by, bw, bh],
    boxRaw: [
      bx / Math.max(1, origWidth),
      by / Math.max(1, origHeight),
      bw / Math.max(1, origWidth),
      bh / Math.max(1, origHeight)
    ],
    mesh: Array.isArray(face.mesh) ? face.mesh.map(shiftPoint) : face.mesh,
    annotations: remappedAnnotations
  };
}

async function runHumanDetectRaw(human, rawBuffer, width, height, channels) {
  const tensor = human.tf.tensor3d(new Int32Array(rawBuffer), [height, width, channels], 'int32');
  try {
    return await human.detect(tensor);
  } finally {
    human.tf.dispose(tensor);
  }
}

function computeEyeAspectRatio68(eyePts) {
  if (!Array.isArray(eyePts) || eyePts.length < 6) return null;
  const p = (i) => [eyePts[i].x, eyePts[i].y];
  const width = pointDistance2D(p(0), p(3));
  if (width <= 1e-3) return null;
  const v1 = pointDistance2D(p(1), p(5));
  const v2 = pointDistance2D(p(2), p(4));
  return (v1 + v2) / (2 * width);
}

function extractMetricsFromFaceApi(det, imgWidth = 1, imgHeight = 1) {
  const box = det?.detection?.box || { x: 0, y: 0, width: 0, height: 0 };
  const bx = Number(box.x || 0);
  const by = Number(box.y || 0);
  const bw = Number(box.width || 0);
  const bh = Number(box.height || 0);
  const boxRaw = [
    bx / Math.max(1, imgWidth),
    by / Math.max(1, imgHeight),
    bw / Math.max(1, imgWidth),
    bh / Math.max(1, imgHeight)
  ];

  const lm = det?.landmarks;
  const leftEye = lm?.getLeftEye?.() || [];
  const rightEye = lm?.getRightEye?.() || [];
  const mouth = lm?.getMouth?.() || [];
  const nose = lm?.getNose?.() || [];
  const jaw = lm?.getJawOutline?.() || [];

  const leftEAR = computeEyeAspectRatio68(leftEye);
  const rightEAR = computeEyeAspectRatio68(rightEye);
  const earValues = [leftEAR, rightEAR].filter((v) => typeof v === 'number' && Number.isFinite(v));
  const avgEAR = earValues.length > 0 ? earValues.reduce((a, b) => a + b, 0) / earValues.length : null;
  const minEAR = earValues.length > 0 ? Math.min(...earValues) : null;

  let mouthOpenRatio = 0;
  let mouthGapToFace = 0;
  let mouthPercent = 0;
  if (mouth.length >= 20) {
    const innerW = Math.max(1, Math.hypot(mouth[16].x - mouth[12].x, mouth[16].y - mouth[12].y));
    const g1 = Math.max(0, mouth[19].y - mouth[13].y);
    const g2 = Math.max(0, mouth[18].y - mouth[14].y);
    const g3 = Math.max(0, mouth[17].y - mouth[15].y);
    const avgInnerGap = (g1 + g2 + g3) / 3;
    const innerMar = avgInnerGap / innerW;
    mouthOpenRatio = innerMar * 0.48;
    mouthGapToFace = bh > 1 ? avgInnerGap / bh : 0;
    mouthPercent = Math.min(100, Math.round(innerMar * 100));
  }

  let noseShiftRatio = 0;
  let yawDeg = 0;
  if (jaw.length >= 17 && nose.length >= 4) {
    const jawMidX = (jaw[0].x + jaw[16].x) / 2;
    const halfJawW = Math.max(1, (jaw[16].x - jaw[0].x) / 2);
    noseShiftRatio = (nose[3].x - jawMidX) / halfJawW;
    yawDeg = -noseShiftRatio * 42;
  }

  const [rx, ry, rw, rh] = boxRaw;
  const fullFaceVisible = Boolean(
    rx >= 0.005 &&
      (rx + rw) <= 0.995 &&
      ry >= 0.005 &&
      (ry + rh) <= 0.995 &&
      leftEye.length >= 6 &&
      rightEye.length >= 6 &&
      mouth.length >= 20
  );

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
    pitchDeg: 0,
    rollDeg: 0,
    gestureLabels: [],
    fullFaceVisible,
    realScore: null,
    liveScore: null
  };
}

async function prepareRawRgbBuffer(frameBuffer, maxSize = 256) {
  return sharp(frameBuffer, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: false })
    .toColourspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function detectWithFaceApiFast(rawBuffer, width, height, channels, scoreThreshold = 0.42) {
  if (!faceApiReady || !faceApiInstance) return null;
  const tensor = faceApiInstance.tf.tensor3d(new Int32Array(rawBuffer), [height, width, channels], 'int32');
  try {
    const detections = await faceApiInstance
      .detectAllFaces(
        tensor,
        new faceApiInstance.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold })
      )
      .withFaceLandmarks(true);
    return Array.isArray(detections) ? detections : [];
  } finally {
    faceApiInstance.tf.dispose(tensor);
  }
}

async function detectFacesFromBuffer(frameBuffer, { maxSize = 320 } = {}) {
  const human = await warmupFaceLivenessEngine();
  const { data, info } = await prepareRawRgbBuffer(frameBuffer, maxSize);
  let result = await runHumanDetectRaw(human, data, info.width, info.height, info.channels);

  // Close-up webcam crops can fill >90% of the circular viewport and miss BlazeFace anchors;
  // retry once with soft edge padding and map coordinates back to the original crop.
  if (!Array.isArray(result?.face) || result.face.length === 0) {
    const pad = Math.round(Math.max(info.width, info.height) * 0.22);
    const padded = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: 'copy' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const paddedResult = await runHumanDetectRaw(human, padded.data, padded.info.width, padded.info.height, padded.info.channels);
    if (Array.isArray(paddedResult?.face) && paddedResult.face.length > 0) {
      result = {
        ...paddedResult,
        face: paddedResult.face.map((face) => unpadDetectedFace(face, pad, pad, info.width, info.height))
      };
    }
  }

  return { result, width: info.width, height: info.height };
}

async function detectFilteredFaces(frameBuffer, { minBoxScore = 0.44, minFaceScore = 0.44, allowSingleWeakFallback = false, maxSize = 320 } = {}) {
  const { result, width, height } = await detectFacesFromBuffer(frameBuffer, { maxSize });
  const rawFaces = Array.isArray(result?.face) ? result.face : [];
  const scoreSum = (f) => Number(f?.faceScore ?? f?.score ?? 0) + Number(f?.boxScore ?? f?.score ?? 0);
  const strongFaces = rawFaces
    .filter((f) => Number(f?.boxScore ?? f?.score ?? 0) >= 0.5 && Number(f?.faceScore ?? f?.score ?? 0) >= 0.5)
    .sort((a, b) => scoreSum(b) - scoreSum(a));

  if (strongFaces.length > 0) {
    return { result, faces: strongFaces, width, height };
  }

  const fallbackFaces = rawFaces
    .filter((f) => {
      const boxScore = Number(f?.boxScore ?? f?.score ?? 0);
      const faceScore = Number(f?.faceScore ?? f?.score ?? 0);
      const bw = Array.isArray(f?.boxRaw) ? Number(f.boxRaw[2] || 0) : 1;
      const bh = Array.isArray(f?.boxRaw) ? Number(f.boxRaw[3] || 0) : 1;
      return boxScore >= minBoxScore && faceScore >= minFaceScore && bw >= 0.10 && bh >= 0.10;
    })
    .sort((a, b) => scoreSum(b) - scoreSum(a));

  const faces = allowSingleWeakFallback && fallbackFaces.length > 1
    ? [fallbackFaces[0]]
    : fallbackFaces;
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

  if (rw < 0.15 || rh < 0.18) {
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'move_closer', metrics };
  }
  if (rw > 0.94 || rh > 0.95) {
    return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'move_back', metrics };
  }

  if (cx < 0.24) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_left', metrics };
  if (cx > 0.76) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_right', metrics };
  if (cy < 0.22) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_upper', metrics };
  if (cy > 0.78) return { ok: true, ready: false, faceDetected: true, faceCount: 1, fullFaceVisible: true, passportQuality: false, spoofDetected: false, antiSpoof, guidance: 'center_lower', metrics };

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
      rw >= 0.20 &&
      rh >= 0.24 &&
      rw <= 0.90 &&
      rh <= 0.92 &&
      cx >= 0.26 &&
      cx <= 0.74 &&
      cy >= 0.24 &&
      cy <= 0.76
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

  const { result, faces, width, height } = await detectFilteredFaces(frameBuffer, {
    minBoxScore: 0.44,
    minFaceScore: 0.44,
    maxSize: requirePassportFraming ? 320 : 256
  });

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

  // Record neutral resting yaw and nose offset in sessionState so natural desk-angle offsets still detect turns cleanly
  if (typeof metrics.yawDeg === 'number' && Number.isFinite(metrics.yawDeg) && Math.abs(metrics.yawDeg) <= 12) {
    if (typeof sessionState.baselineYawDeg !== 'number') {
      sessionState.baselineYawDeg = metrics.yawDeg;
    } else if (Math.abs(metrics.yawDeg - sessionState.baselineYawDeg) < 3.2) {
      sessionState.baselineYawDeg = sessionState.baselineYawDeg * 0.75 + metrics.yawDeg * 0.25;
    }
  }
  if (typeof metrics.noseShiftRatio === 'number' && Number.isFinite(metrics.noseShiftRatio) && Math.abs(metrics.noseShiftRatio) <= 0.14) {
    if (typeof sessionState.baselineNoseShift !== 'number') {
      sessionState.baselineNoseShift = metrics.noseShiftRatio;
    } else if (Math.abs(metrics.noseShiftRatio - sessionState.baselineNoseShift) < 0.035) {
      sessionState.baselineNoseShift = sessionState.baselineNoseShift * 0.75 + metrics.noseShiftRatio * 0.25;
    }
  }
  if (typeof metrics.mouthOpenRatio === 'number' && Number.isFinite(metrics.mouthOpenRatio) && metrics.mouthOpenRatio <= 0.085) {
    if (typeof sessionState.baselineMouthRatio !== 'number') {
      sessionState.baselineMouthRatio = metrics.mouthOpenRatio;
    } else if (metrics.mouthOpenRatio < sessionState.baselineMouthRatio + 0.02) {
      sessionState.baselineMouthRatio = Math.min(sessionState.baselineMouthRatio, metrics.mouthOpenRatio * 0.5 + sessionState.baselineMouthRatio * 0.5);
    }
  }

  let actionDetected = false;
  if (challengeType === 'open_mouth') {
    const gestureMouth = metrics.gestureLabels.some((g) => g.includes('mouth'));
    const adaptiveMouth =
      typeof sessionState.baselineMouthRatio === 'number' &&
      metrics.mouthOpenRatio >= sessionState.baselineMouthRatio + 0.045;
    actionDetected =
      metrics.mouthOpenRatio >= 0.085 ||
      metrics.mouthGapToFace >= 0.028 ||
      metrics.mouthPercent >= 9 ||
      adaptiveMouth ||
      gestureMouth;
  } else if (challengeType === 'blink') {
    const gestureBlink = metrics.gestureLabels.some((g) => g.includes('blink'));
    const adaptiveBlink =
      typeof sessionState.baselineEar === 'number' &&
      typeof metrics.avgEAR === 'number' &&
      sessionState.baselineEar >= 0.24 &&
      metrics.avgEAR <= sessionState.baselineEar * 0.78;
    actionDetected =
      gestureBlink ||
      adaptiveBlink ||
      (typeof metrics.minEAR === 'number' && metrics.minEAR <= 0.245) ||
      (typeof metrics.avgEAR === 'number' && metrics.avgEAR <= 0.255);
  } else if (challengeType === 'turn_left') {
    // Un-mirrored frame: subject turning their own head left produces 'facing left', negative yaw, and nose shift toward viewer right (+X)
    const facingLeft = metrics.gestureLabels.some((g) => g === 'facing left');
    const facingRight = metrics.gestureLabels.some((g) => g === 'facing right');
    const lookingLeft = metrics.gestureLabels.some((g) => g === 'looking left');
    const baselineYaw = typeof sessionState.baselineYawDeg === 'number' ? sessionState.baselineYawDeg : null;
    const baselineNose = typeof sessionState.baselineNoseShift === 'number' ? sessionState.baselineNoseShift : null;
    const yawLeft =
      metrics.yawDeg <= -5.0 ||
      (baselineYaw !== null && (metrics.yawDeg - baselineYaw) <= -5.0 && metrics.yawDeg <= 2.5);
    const noseLeft =
      (metrics.noseShiftRatio >= 0.055 && metrics.yawDeg <= 2.5) ||
      (baselineNose !== null && (metrics.noseShiftRatio - baselineNose) >= 0.055 && metrics.yawDeg <= 2.5);
    const irisAssistedLeft = lookingLeft && (metrics.yawDeg <= -3.2 || metrics.noseShiftRatio >= 0.042);
    actionDetected = !facingRight && (facingLeft || yawLeft || noseLeft || irisAssistedLeft);
  } else if (challengeType === 'turn_right') {
    // Un-mirrored frame: subject turning their own head right produces 'facing right', positive yaw, and nose shift toward viewer left (-X)
    const facingRight = metrics.gestureLabels.some((g) => g === 'facing right');
    const facingLeft = metrics.gestureLabels.some((g) => g === 'facing left');
    const lookingRight = metrics.gestureLabels.some((g) => g === 'looking right');
    const baselineYaw = typeof sessionState.baselineYawDeg === 'number' ? sessionState.baselineYawDeg : null;
    const baselineNose = typeof sessionState.baselineNoseShift === 'number' ? sessionState.baselineNoseShift : null;
    const yawRight =
      metrics.yawDeg >= 5.0 ||
      (baselineYaw !== null && (metrics.yawDeg - baselineYaw) >= 5.0 && metrics.yawDeg >= -2.5);
    const noseRight =
      (metrics.noseShiftRatio <= -0.055 && metrics.yawDeg >= -2.5) ||
      (baselineNose !== null && (metrics.noseShiftRatio - baselineNose) <= -0.055 && metrics.yawDeg >= -2.5);
    const irisAssistedRight = lookingRight && (metrics.yawDeg >= 3.2 || metrics.noseShiftRatio <= -0.042);
    actionDetected = !facingLeft && (facingRight || yawRight || noseRight || irisAssistedRight);
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
 * using our fast dual Node.js engine (@vladmandic/face-api 35ms track + @vladmandic/human 3D/anti-spoof track).
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

  await warmupFaceLivenessEngine();

  // Fast 35ms frontal 68-landmark track for mouth/blink once neural anti-spoof has already cleared
  if (
    faceApiReady &&
    sessionState.antiSpoofChecked === true &&
    (challengeType === 'open_mouth' || challengeType === 'blink')
  ) {
    const { data, info } = await prepareRawRgbBuffer(frameBuffer, 256);
    const faFaces = await detectWithFaceApiFast(data, info.width, info.height, info.channels, 0.42);
    if (Array.isArray(faFaces) && faFaces.length === 1) {
      const faMetrics = extractMetricsFromFaceApi(faFaces[0], info.width, info.height);
      return evaluateActiveChallengeMetrics(faMetrics, { challengeType, sessionState });
    }
  }

  const { result, faces, width, height } = await detectFilteredFaces(frameBuffer, {
    minBoxScore: 0.3,
    minFaceScore: 0.3,
    allowSingleWeakFallback: true,
    maxSize: 256
  });

  if (faces.length === 0) {
    // Secondary fast frontal fallback if Human missed extreme lighting/close-up
    if (faceApiReady) {
      const { data, info } = await prepareRawRgbBuffer(frameBuffer, 256);
      const faFaces = await detectWithFaceApiFast(data, info.width, info.height, info.channels, 0.4);
      if (Array.isArray(faFaces) && faFaces.length === 1) {
        const faMetrics = extractMetricsFromFaceApi(faFaces[0], info.width, info.height);
        return evaluateActiveChallengeMetrics(faMetrics, { challengeType, sessionState });
      }
    }
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
  const evalResult = evaluateActiveChallengeMetrics(metrics, { challengeType, sessionState });
  if (!evalResult.spoofDetected) {
    sessionState.antiSpoofChecked = true;
  }
  return evalResult;
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
