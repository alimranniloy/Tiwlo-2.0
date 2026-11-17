import sharp from 'sharp';
import {
  buildKeyPoolSummary,
  executeGeminiWithFailover,
  getChatSystemSettings,
  listAiKeys
} from '../support/ai/aiKeyPoolService.js';
import { validatePassportMrz } from './identityVerificationEngine.js';

const MAX_IMAGE_PIXELS = 20_000_000;
const GEMINI_MAX_DIMENSION = 1600;
const GEMINI_TIMEOUT_MS = 25_000;

export const SUPPORTED_DOCUMENT_TYPES = Object.freeze({
  passport: 'Passport',
  national_id: 'National ID',
  drivers_license: "Driver's License",
  other_document: 'Other Document'
});

const ALLOWED_SPOOF_RISKS = new Set(['low', 'medium', 'high']);

/**
 * Normalizes an incoming document type identifier, mapping legacy or unknown values
 * cleanly to `'other_document'` ("Other Document").
 */
export function normalizeDocumentType(documentType) {
  const clean = String(documentType || '').trim().toLowerCase();
  if (clean === 'passport' || clean === 'national_id' || clean === 'drivers_license' || clean === 'other_document') {
    return clean;
  }
  return 'other_document';
}

function getDocumentTypeLabel(documentType) {
  const normalized = normalizeDocumentType(documentType);
  return SUPPORTED_DOCUMENT_TYPES[normalized] || SUPPORTED_DOCUMENT_TYPES.other_document;
}

/**
 * Normalizes and prepares an image buffer for Gemini Vision `inlineData` payloads.
 */
async function prepareImageForGemini(buffer, mimeType = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Image buffer is empty or invalid.');
  }

  const pipeline = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Image dimensions could not be determined.');
  }

  const resized = pipeline.resize({
    width: GEMINI_MAX_DIMENSION,
    height: GEMINI_MAX_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true
  });

  const normalizedMime = String(mimeType || '').toLowerCase();
  if (metadata.format === 'png' && normalizedMime === 'image/png' && buffer.length <= 2 * 1024 * 1024) {
    const out = await resized.png({ compressionLevel: 6 }).toBuffer();
    return { mimeType: 'image/png', data: out.toString('base64') };
  }
  if (metadata.format === 'webp' && normalizedMime === 'image/webp' && buffer.length <= 2 * 1024 * 1024) {
    const out = await resized.webp({ quality: 86 }).toBuffer();
    return { mimeType: 'image/webp', data: out.toString('base64') };
  }

  const jpegBuffer = await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return {
    mimeType: 'image/jpeg',
    data: jpegBuffer.toString('base64')
  };
}

/**
 * Strips markdown code fences and parses a JSON object from Gemini text output.
 */
function parseGeminiJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) return null;
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const sliced = cleaned.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(sliced);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeNameTokens(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Compares an OCR-extracted full name against the expected account name using
 * normalized token matching combined with Gemini's assessment.
 */
export function evaluateNameMatch(extractedName, expectedName, geminiMatchesAccount) {
  const expectedTokens = normalizeNameTokens(expectedName);
  const extractedTokens = normalizeNameTokens(extractedName);

  if (expectedTokens.length === 0) {
    return { nameMismatch: false, needsNameCorrection: false };
  }

  if (extractedTokens.length === 0) {
    const mismatch = geminiMatchesAccount === false;
    return { nameMismatch: mismatch, needsNameCorrection: mismatch };
  }

  const expectedSet = new Set(expectedTokens);
  const extractedSet = new Set(extractedTokens);

  const exactSameOrder =
    expectedTokens.length === extractedTokens.length &&
    expectedTokens.every((token, index) => token === extractedTokens[index]);

  const exactSameSet =
    expectedSet.size === extractedSet.size &&
    [...expectedSet].every(token => extractedSet.has(token));

  if (exactSameOrder || exactSameSet) {
    return { nameMismatch: false, needsNameCorrection: false };
  }

  const shorter = expectedTokens.length <= extractedTokens.length ? expectedTokens : extractedTokens;
  const longerSet = expectedTokens.length <= extractedTokens.length ? extractedSet : expectedSet;
  const isCleanSubset = shorter.length >= 2 && shorter.every(token => longerSet.has(token));

  if (isCleanSubset && geminiMatchesAccount !== false) {
    return { nameMismatch: false, needsNameCorrection: false };
  }

  return { nameMismatch: true, needsNameCorrection: true };
}

/**
 * Validates and normalizes a calendar date string or Date to `YYYY-MM-DD`.
 */
export function normalizeIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Compares an extracted document date of birth against the user's account DOB.
 * Returns `true` when the document has a valid DOB and the account DOB is missing or different.
 */
export function evaluateDobMatch(extractedDob, expectedDob) {
  const normExtracted = normalizeIsoDate(extractedDob);
  if (!normExtracted) return false;
  const normExpected = normalizeIsoDate(expectedDob);
  if (!normExpected) return true;
  return normExtracted !== normExpected;
}

function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeSpoofFields(parsed) {
  const rawRisk = String(parsed?.spoofRisk || 'low').trim().toLowerCase();
  const spoofRisk = ALLOWED_SPOOF_RISKS.has(rawRisk) ? rawRisk : 'low';
  const tamperingSignals = Array.isArray(parsed?.tamperingSignals)
    ? parsed.tamperingSignals.map(s => String(s || '').trim()).filter(Boolean).slice(0, 20)
    : [];
  const documentExpiryValid = typeof parsed?.documentExpiryValid === 'boolean'
    ? parsed.documentExpiryValid
    : null;
  const isScreenRecaptureOrPrintedCopy = Boolean(parsed?.isScreenRecaptureOrPrintedCopy);
  const deepfakeOrReplaySuspected = Boolean(parsed?.deepfakeOrReplaySuspected);

  return {
    spoofRisk,
    tamperingSignals,
    documentExpiryValid,
    isScreenRecaptureOrPrintedCopy,
    deepfakeOrReplaySuspected
  };
}

function buildFallbackReason(aiResult, defaultMsg) {
  if (aiResult?.disabled) return 'AI verification is disabled in system settings.';
  if (aiResult?.reason) return String(aiResult.reason);
  if (Array.isArray(aiResult?.errors) && aiResult.errors.length > 0) {
    const firstMsg = aiResult.errors[0]?.message;
    if (firstMsg) return String(firstMsg);
  }
  return defaultMsg;
}

const AI_PRECHECK_CACHE_TTL_MS = 5_000;
let cachedAiEnabled = { expiresAt: 0, value: null };
let cachedHealthyKey = { expiresAt: 0, value: false };

async function checkAiEnabled(getSettingsFn) {
  const isDefaultSettings = getSettingsFn === getChatSystemSettings;
  const now = Date.now();
  if (isDefaultSettings && process.env.NODE_ENV === 'production' && cachedAiEnabled.value && cachedAiEnabled.expiresAt > now) {
    return cachedAiEnabled.value;
  }
  try {
    const settings = await getSettingsFn();
    const res = settings && settings.enabled === false
      ? { enabled: false, reason: 'AI verification is disabled in system settings.' }
      : { enabled: true };
    if (isDefaultSettings && process.env.NODE_ENV === 'production') {
      cachedAiEnabled = { expiresAt: now + AI_PRECHECK_CACHE_TTL_MS, value: res };
    }
    return res;
  } catch (err) {
    return { enabled: false, reason: err?.message || 'Unable to load AI system settings.' };
  }
}

async function hasHealthyGeminiKey() {
  if (String(process.env.GEMINI_API_KEY || '').trim()) {
    return true;
  }
  const now = Date.now();
  if (process.env.NODE_ENV === 'production' && cachedHealthyKey.expiresAt > now) {
    return cachedHealthyKey.value;
  }
  try {
    const keys = await listAiKeys({ includeDisabled: false });
    const summary = buildKeyPoolSummary(keys);
    const healthy = summary.healthy > 0 || summary.envFallbackConfigured;
    if (process.env.NODE_ENV === 'production') {
      cachedHealthyKey = { expiresAt: now + AI_PRECHECK_CACHE_TTL_MS, value: healthy };
    }
    return healthy;
  } catch {
    return false;
  }
}

function buildDocumentAnalysisPrompt({ documentType, expectedName, expectedDob, expectedEmail, expectedAddress, hasBackImage = false }) {
  const docLabel = getDocumentTypeLabel(documentType);
  return [
    'You are an expert KYC identity document verifier and multi-language OCR analyst.',
    'Explicitly support multi-language documents including Bengali (Bangla, e.g., Bangladesh NID / Passport / Govt ID), English, and international passports, national IDs, driver licenses, and other government documents.',
    'If fields appear in Bengali or another non-Latin script, extract the primary readable name/details and provide the standard English/Latin transliteration when helpful so account names can be compared accurately.',
    `Expected Document Type: ${docLabel} (${normalizeDocumentType(documentType)})`,
    expectedName ? `Expected Account Full Name: ${expectedName}` : 'Expected Account Full Name: (not provided)',
    expectedDob ? `Expected Account Date of Birth (YYYY-MM-DD): ${expectedDob}` : '',
    expectedEmail ? `Expected Account Email: ${expectedEmail}` : '',
    expectedAddress ? `Expected Account Address: ${expectedAddress}` : '',
    hasBackImage ? 'TWO document images are attached: Image 1 is the FRONT side and Image 2 is the BACK side. Cross-check front and back consistency, extract back-side address and confirm if barcode/QR is visible (`frontBackConsistent`, `backAddress`, `barcodeDetected`).' : '',
    'If the document is a Passport with a Machine-Readable Zone (MRZ), transcribe the bottom 2 MRZ lines into `mrzLine1` and `mrzLine2` verbatim and extract `expiryDate` in YYYY-MM-DD format.',
    '',
    'Inspect the uploaded document image(s) carefully for authenticity, readability, multi-language OCR fields, and visual spoof/tampering/deepfake signals (such as screen moiré patterns, recapture of a phone/monitor screen, printed photocopies, digital text overlays, synthetic/deepfake portrait injection, cut-and-paste edges, or expired validity).',
    '',
    'Return ONLY a strict JSON object with these exact keys:',
    '{',
    '  "fullName": string or null,',
    '  "documentNumber": string or null,',
    '  "address": string or null,',
    '  "backAddress": string or null,',
    '  "dateOfBirth": string or null,',
    '  "expiryDate": string or null,',
    '  "country": string or null,',
    '  "mrzLine1": string or null,',
    '  "mrzLine2": string or null,',
    '  "frontBackConsistent": boolean or null,',
    '  "barcodeDetected": boolean or null,',
    '  "isValidDocumentType": boolean,',
    '  "documentReadable": boolean,',
    '  "nameMatchesAccount": boolean,',
    '  "confidenceScore": number (0-100),',
    '  "notes": string,',
    '  "spoofRisk": "low" | "medium" | "high",',
    '  "tamperingSignals": string[],',
    '  "documentExpiryValid": boolean or null,',
    '  "isScreenRecaptureOrPrintedCopy": boolean,',
    '  "deepfakeOrReplaySuspected": boolean',
    '}'
  ].filter(Boolean).join('\n');
}

function buildFaceMatchPrompt({ documentType, expectedName, expectedDob, expectedAddress, livenessPassed }) {
  const docLabel = getDocumentTypeLabel(documentType);
  return [
    'You are an expert biometric KYC identity verifier.',
    'You are given TWO images:',
    '- Image 1: An identity document (supporting Bengali, English, and international passports, national IDs, driver licenses, and other government documents).',
    '- Image 2: A live selfie capture.',
    `Declared Document Type: ${docLabel} (${normalizeDocumentType(documentType)})`,
    expectedName ? `Expected Account Name: ${expectedName}` : '',
    expectedDob ? `Expected Account Date of Birth (YYYY-MM-DD): ${expectedDob}` : '',
    expectedAddress ? `Expected Account Address: ${expectedAddress}` : '',
    `Active Liveness Challenges Passed: ${livenessPassed ? 'true' : 'false'}`,
    '',
    'Verify the following carefully:',
    '1) Both Image 1 (document portrait) and Image 2 (live selfie) contain a clear, visible human face.',
    '2) Both faces belong to the same person (`isMatch`: boolean).',
    '3) Provide a match confidence score from 0 to 100 (`confidenceScore`).',
    '4) Extract readable document details (`extractedName`, `extractedAddress`, `documentNumber`, `dateOfBirth` in YYYY-MM-DD, `country`). Support Bangla/non-Latin documents and include English transliteration of `extractedName` when possible.',
    '5) Compare extracted legal full name against Expected Account Name (`nameMatchesAccount`: boolean). Note: Address differences or missing address on Passports are allowed and must NOT mark a rejection.',
    '6) Perform Deepfake, Synthetic Face, and Screen-Replay Spoof Screening on both the document and the selfie: detect AI-generated/synthetic faces, face-swap artifacts, monitor/phone screen replay, printed photo presentation attacks, or document tampering (`deepfakeOrReplaySuspected`: boolean, `spoofRisk`: "low" | "medium" | "high", `tamperingSignals`: array of strings, `documentExpiryValid`: boolean or null, `isScreenRecaptureOrPrintedCopy`: boolean).',
    '7) If `isMatch` is false or any deepfake/replay/spoof is detected, set `reason` to one of: "face_mismatch", "document_face_not_clear", "selfie_face_not_clear", "document_unreadable", "spoof_or_deepfake_detected". If `isMatch` is true and clean, set `reason` to null.',
    '',
    'Return ONLY a strict JSON object with these exact keys:',
    '{',
    '  "documentFaceClear": boolean,',
    '  "selfieFaceClear": boolean,',
    '  "documentReadable": boolean,',
    '  "isMatch": boolean,',
    '  "nameMatchesAccount": boolean,',
    '  "confidenceScore": number (0-100),',
    '  "extractedName": string or null,',
    '  "extractedAddress": string or null,',
    '  "documentNumber": string or null,',
    '  "dateOfBirth": string or null,',
    '  "country": string or null,',
    '  "reason": string or null,',
    '  "message": string or null,',
    '  "deepfakeOrReplaySuspected": boolean,',
    '  "spoofRisk": "low" | "medium" | "high",',
    '  "tamperingSignals": string[],',
    '  "documentExpiryValid": boolean or null,',
    '  "isScreenRecaptureOrPrintedCopy": boolean',
    '}'
  ].filter(Boolean).join('\n');
}

/**
 * Analyzes an identity document image using Gemini Multimodal Vision with multi-language OCR
 * and visual spoof/tamper detection. Never throws; falls back cleanly on any AI failure.
 */
export async function analyzeIdentityDocumentWithGemini({
  documentBuffer,
  mimeType,
  backBuffer = null,
  backMimeType = '',
  documentType = 'national_id',
  expectedName = '',
  expectedDob = '',
  expectedEmail = '',
  expectedAddress = '',
  executeAiFn = executeGeminiWithFailover,
  getSettingsFn = getChatSystemSettings
} = {}) {
  try {
    const settingsCheck = await checkAiEnabled(getSettingsFn);
    if (!settingsCheck.enabled) {
      return {
        ok: false,
        fallbackToManual: true,
        aiStatus: 'fallback',
        extracted: {},
        nameMismatch: false,
        dobMismatch: false,
        needsNameCorrection: false,
        error: settingsCheck.reason
      };
    }

    const prepared = await prepareImageForGemini(documentBuffer, mimeType);
    const preparedBack = Buffer.isBuffer(backBuffer) && backBuffer.length > 0
      ? await prepareImageForGemini(backBuffer, backMimeType)
      : null;
    const prompt = buildDocumentAnalysisPrompt({
      documentType,
      expectedName,
      expectedDob,
      expectedEmail,
      expectedAddress,
      hasBackImage: Boolean(preparedBack)
    });

    const parts = [
      { text: prompt },
      { inlineData: { mimeType: prepared.mimeType, data: prepared.data } }
    ];
    if (preparedBack) {
      parts.push({ inlineData: { mimeType: preparedBack.mimeType, data: preparedBack.data } });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const aiResult = await executeAiFn({
      payload,
      timeoutMs: GEMINI_TIMEOUT_MS
    });

    if (!aiResult || aiResult.disabled || !aiResult.text) {
      return {
        ok: false,
        fallbackToManual: true,
        aiStatus: 'fallback',
        extracted: {},
        nameMismatch: false,
        dobMismatch: false,
        needsNameCorrection: false,
        error: buildFallbackReason(aiResult, 'Gemini document analysis is unavailable.')
      };
    }

    const parsed = parseGeminiJson(aiResult.text);
    if (!parsed) {
      return {
        ok: false,
        fallbackToManual: true,
        aiStatus: 'fallback',
        extracted: {},
        nameMismatch: false,
        dobMismatch: false,
        needsNameCorrection: false,
        error: 'Gemini returned an unparseable document analysis response.'
      };
    }

    const fullName = typeof parsed.fullName === 'string' ? parsed.fullName.trim() : null;
    const rawDob = typeof parsed.dateOfBirth === 'string' ? parsed.dateOfBirth.trim() || null : null;
    const normalizedDob = normalizeIsoDate(rawDob);
    const rawExpiry = typeof parsed.expiryDate === 'string' ? parsed.expiryDate.trim() || null : null;
    const normalizedExpiry = normalizeIsoDate(rawExpiry);
    const mrzResult = validatePassportMrz(parsed.mrzLine1, parsed.mrzLine2);
    const spoof = normalizeSpoofFields(parsed);
    const frontBackConsistent = typeof parsed.frontBackConsistent === 'boolean' ? parsed.frontBackConsistent : null;
    const backAddress = typeof parsed.backAddress === 'string' ? parsed.backAddress.trim() || null : null;
    const barcodeDetected = typeof parsed.barcodeDetected === 'boolean' ? parsed.barcodeDetected : null;

    if (frontBackConsistent === false && !spoof.tamperingSignals.includes('front_back_mismatch')) {
      spoof.tamperingSignals.push('front_back_mismatch');
    }
    if (mrzResult.present && mrzResult.valid === false && !spoof.tamperingSignals.includes('mrz_check_digit_failed')) {
      spoof.tamperingSignals.push('mrz_check_digit_failed');
    }

    const extracted = {
      fullName: fullName || null,
      documentNumber: typeof parsed.documentNumber === 'string' ? parsed.documentNumber.trim() || null : (mrzResult.documentNumber || null),
      address: typeof parsed.address === 'string' ? parsed.address.trim() || null : backAddress,
      backAddress,
      dateOfBirth: normalizedDob || rawDob || mrzResult.dateOfBirth || null,
      expiryDate: normalizedExpiry || rawExpiry || mrzResult.expiryDate || null,
      country: typeof parsed.country === 'string' ? parsed.country.trim() || null : (mrzResult.issuingCountry || null),
      mrzValid: mrzResult.present ? mrzResult.valid : null,
      frontBackConsistent,
      barcodeDetected,
      isValidDocumentType: typeof parsed.isValidDocumentType === 'boolean' ? parsed.isValidDocumentType : true,
      documentReadable: typeof parsed.documentReadable === 'boolean' ? parsed.documentReadable : true,
      nameMatchesAccount: typeof parsed.nameMatchesAccount === 'boolean' ? parsed.nameMatchesAccount : null,
      confidenceScore: normalizeConfidence(parsed.confidenceScore),
      notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
      ...spoof
    };

    const { nameMismatch } = evaluateNameMatch(
      extracted.fullName,
      expectedName,
      extracted.nameMatchesAccount
    );
    const dobMismatch = evaluateDobMatch(extracted.dateOfBirth, expectedDob);
    const needsNameCorrection = Boolean(nameMismatch || dobMismatch);

    return {
      ok: true,
      fallbackToManual: false,
      aiStatus: 'ok',
      extracted,
      nameMismatch,
      dobMismatch,
      needsNameCorrection,
      usedModel: aiResult.usedModel || null
    };
  } catch (error) {
    return {
      ok: false,
      fallbackToManual: true,
      aiStatus: 'fallback',
      extracted: {},
      nameMismatch: false,
      dobMismatch: false,
      needsNameCorrection: false,
      error: error?.message || 'Gemini document analysis failed.'
    };
  }
}

/**
 * Compares an identity document portrait and a live selfie using Gemini Multimodal Vision.
 * Never throws; returns `{ ok: false, fallbackToManual: true, ... }` on any AI failure.
 */
export async function matchDocumentAndSelfieWithGemini({
  documentBuffer,
  documentMimeType,
  selfieBuffer,
  selfieMimeType,
  documentType = 'national_id',
  expectedName = '',
  expectedDob = '',
  expectedAddress = '',
  livenessPassed = true,
  executeAiFn = executeGeminiWithFailover,
  getSettingsFn = getChatSystemSettings
} = {}) {
  try {
    const settingsCheck = await checkAiEnabled(getSettingsFn);
    if (!settingsCheck.enabled) {
      return {
        ok: false,
        fallbackToManual: true,
        isMatch: false,
        isLiveValid: false,
        error: settingsCheck.reason
      };
    }

    const [docImage, selfieImage] = await Promise.all([
      prepareImageForGemini(documentBuffer, documentMimeType),
      prepareImageForGemini(selfieBuffer, selfieMimeType)
    ]);

    const prompt = buildFaceMatchPrompt({
      documentType,
      expectedName,
      expectedDob,
      expectedAddress,
      livenessPassed
    });

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: docImage.mimeType, data: docImage.data } },
            { inlineData: { mimeType: selfieImage.mimeType, data: selfieImage.data } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const aiResult = await executeAiFn({
      payload,
      timeoutMs: GEMINI_TIMEOUT_MS
    });

    if (!aiResult || aiResult.disabled || !aiResult.text) {
      return {
        ok: false,
        fallbackToManual: true,
        isMatch: false,
        isLiveValid: false,
        error: buildFallbackReason(aiResult, 'Automated face match service is unavailable.')
      };
    }

    const parsed = parseGeminiJson(aiResult.text);
    if (!parsed || typeof parsed.isMatch !== 'boolean') {
      return {
        ok: false,
        fallbackToManual: true,
        isMatch: false,
        isLiveValid: false,
        error: 'Automated face match returned an unparseable response.'
      };
    }

    const spoof = normalizeSpoofFields(parsed);
    const documentFaceClear = typeof parsed.documentFaceClear === 'boolean' ? parsed.documentFaceClear : true;
    const selfieFaceClear = typeof parsed.selfieFaceClear === 'boolean' ? parsed.selfieFaceClear : true;
    const documentReadable = typeof parsed.documentReadable === 'boolean' ? parsed.documentReadable : true;

    let isMatch = parsed.isMatch === true && documentFaceClear && selfieFaceClear;
    let reason = typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : null;

    if (spoof.deepfakeOrReplaySuspected || spoof.isScreenRecaptureOrPrintedCopy || spoof.spoofRisk === 'high') {
      isMatch = false;
      reason = reason || 'spoof_or_deepfake_detected';
    } else if (!isMatch) {
      if (!documentFaceClear) {
        reason = reason || 'document_face_not_clear';
      } else if (!selfieFaceClear) {
        reason = reason || 'selfie_face_not_clear';
      } else {
        reason = reason || 'face_mismatch';
      }
    } else {
      reason = null;
    }

    const rawMatchDob = typeof parsed.dateOfBirth === 'string' ? parsed.dateOfBirth.trim() || null : null;
    const extracted = {
      fullName: typeof parsed.extractedName === 'string' ? parsed.extractedName.trim() || null : null,
      address: typeof parsed.extractedAddress === 'string' ? parsed.extractedAddress.trim() || null : null,
      documentNumber: typeof parsed.documentNumber === 'string' ? parsed.documentNumber.trim() || null : null,
      dateOfBirth: normalizeIsoDate(rawMatchDob) || rawMatchDob,
      country: typeof parsed.country === 'string' ? parsed.country.trim() || null : null,
      ...spoof
    };

    return {
      ok: true,
      fallbackToManual: false,
      isMatch,
      isLiveValid: Boolean(livenessPassed),
      nameMatchesAccount: typeof parsed.nameMatchesAccount === 'boolean' ? parsed.nameMatchesAccount : null,
      confidenceScore: normalizeConfidence(parsed.confidenceScore),
      documentReadable,
      documentFaceClear,
      selfieFaceClear,
      reason,
      message: typeof parsed.message === 'string' ? parsed.message.trim() || null : null,
      extracted,
      ...spoof,
      usedModel: aiResult.usedModel || null
    };
  } catch (error) {
    return {
      ok: false,
      fallbackToManual: true,
      isMatch: false,
      isLiveValid: false,
      error: error?.message || 'Face match verification failed.'
    };
  }
}

const ALLOWED_FRAMINGS = new Set([
  'good',
  'move_closer',
  'move_back',
  'center_left',
  'center_right',
  'center_upper',
  'center_lower'
]);

/**
 * Inspects a live camera frame for real human face presence, single-person framing,
 * and passport-portrait quality before starting liveness or capturing final selfie.
 */
export async function inspectLivenessQualityWithGemini({
  frameBuffer,
  mimeType = 'image/jpeg',
  requirePassportFraming = false,
  executeAiFn = executeGeminiWithFailover,
  getSettingsFn = getChatSystemSettings
} = {}) {
  try {
    const settingsCheck = await checkAiEnabled(getSettingsFn);
    if (!settingsCheck.enabled) {
      return { ok: false, fallback: true, aiDisabled: true };
    }

    if (executeAiFn === executeGeminiWithFailover && !(await hasHealthyGeminiKey())) {
      return { ok: false, fallback: true, aiDisabled: true };
    }

    const prepared = await prepareImageForGemini(frameBuffer, mimeType);
    const prompt = [
      'Inspect this live camera frame for identity verification.',
      'Be STRICT: If there is no clear real human face (empty wall, object, ceiling, blocked camera, covered face, or dark frame), set "faceDetected": false and "faceCount": 0.',
      'Check if there is more than one person visible (`faceCount`).',
      requirePassportFraming
        ? 'Also check PASSPORT-PORTRAIT quality: face must look straight toward the camera, eyes clearly open, sharp focus, well-lit, and cleanly framed in passport head-and-shoulders proportion (`passportQuality`: true).'
        : 'Check whether the single face is reasonably centered and sized inside the circle (`framing`: "good" | "move_closer" | "move_back" | "center_left" | "center_right" | "center_upper" | "center_lower").',
      'Detect if the camera is pointing at a phone/monitor screen photo or printed photo (`spoofOrScreen`: boolean).',
      '',
      'Return ONLY a strict JSON object with these keys:',
      '{',
      '  "faceDetected": boolean,',
      '  "faceCount": number,',
      '  "framing": "good" | "move_closer" | "move_back" | "center_left" | "center_right" | "center_upper" | "center_lower",',
      '  "passportQuality": boolean,',
      '  "eyesOpen": boolean,',
      '  "sharp": boolean,',
      '  "spoofOrScreen": boolean',
      '}'
    ].join('\n');

    const aiResult = await executeAiFn({
      payload: {
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: prepared.mimeType, data: prepared.data } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.05
        }
      },
      timeoutMs: 12_000
    });

    if (!aiResult || !aiResult.text) {
      const noKeys = Boolean(aiResult?.disabled || /no .*key|disabled/i.test(String(aiResult?.reason || '')));
      return { ok: false, fallback: true, aiDisabled: noKeys };
    }

    const parsed = parseGeminiJson(aiResult.text);
    if (!parsed || typeof parsed.faceDetected !== 'boolean') {
      return { ok: false, fallback: true, aiDisabled: false };
    }

    const faceDetected = parsed.faceDetected === true;
    const faceCount = Number.isFinite(Number(parsed.faceCount))
      ? Math.max(0, Math.round(Number(parsed.faceCount)))
      : (faceDetected ? 1 : 0);
    const spoofOrScreen = parsed.spoofOrScreen === true;
    const rawFraming = String(parsed.framing || 'good').trim().toLowerCase();
    const framing = ALLOWED_FRAMINGS.has(rawFraming) ? rawFraming : 'good';
    const eyesOpen = typeof parsed.eyesOpen === 'boolean' ? parsed.eyesOpen : true;
    const sharp = typeof parsed.sharp === 'boolean' ? parsed.sharp : true;
    const passportQuality = Boolean(parsed.passportQuality && eyesOpen && sharp && faceDetected && faceCount === 1 && !spoofOrScreen);

    if (spoofOrScreen) {
      return {
        ok: true,
        fallback: false,
        faceDetected: faceDetected && faceCount > 0,
        faceCount,
        passportQuality: false,
        ready: false,
        spoofDetected: true,
        guidance: 'spoof_detected'
      };
    }

    if (!faceDetected || faceCount === 0) {
      return {
        ok: true,
        fallback: false,
        faceDetected: false,
        faceCount: 0,
        passportQuality: false,
        ready: false,
        spoofDetected: false,
        guidance: 'no_face'
      };
    }

    if (faceCount > 1) {
      return {
        ok: true,
        fallback: false,
        faceDetected: true,
        faceCount,
        passportQuality: false,
        ready: false,
        spoofDetected: false,
        guidance: 'multiple_faces'
      };
    }

    if (framing !== 'good') {
      return {
        ok: true,
        fallback: false,
        faceDetected: true,
        faceCount: 1,
        passportQuality: false,
        ready: false,
        spoofDetected: false,
        guidance: framing
      };
    }

    if (requirePassportFraming && !passportQuality) {
      return {
        ok: true,
        fallback: false,
        faceDetected: true,
        faceCount: 1,
        passportQuality: false,
        ready: false,
        spoofDetected: false,
        guidance: 'hold_still'
      };
    }

    return {
      ok: true,
      fallback: false,
      faceDetected: true,
      faceCount: 1,
      passportQuality,
      ready: true,
      spoofDetected: false,
      guidance: 'ready'
    };
  } catch {
    return { ok: false, fallback: true, aiDisabled: false };
  }
}

/**
 * Verifies that a real human face is clearly present and actively performing
 * the requested liveness challenge (`turn_left`, `turn_right`, `open_mouth`, or `blink`).
 */
export async function verifyLivenessChallengeFrameWithGemini({
  frameBuffer,
  mimeType = 'image/jpeg',
  challengeType = 'turn_right',
  executeAiFn = executeGeminiWithFailover,
  getSettingsFn = getChatSystemSettings
} = {}) {
  try {
    const settingsCheck = await checkAiEnabled(getSettingsFn);
    if (!settingsCheck.enabled) {
      return { ok: false, fallback: true, aiDisabled: true };
    }

    if (executeAiFn === executeGeminiWithFailover && !(await hasHealthyGeminiKey())) {
      return { ok: false, fallback: true, aiDisabled: true };
    }

    const prepared = await prepareImageForGemini(frameBuffer, mimeType);
    const prompt = [
      'Evaluate this live camera frame for an active biometric liveness check.',
      `Requested Challenge: "${challengeType}".`,
      'Rules (BE VERY STRICT):',
      '1) First confirm a REAL live human face is visible (`faceDetected`: true, `faceCount`: 1, `spoofOrScreen`: false). Empty walls, ceilings, objects, covered faces, or screen photos MUST return `faceDetected: false` and `actionDetected: false`.',
      '2) If a face IS present, verify the exact requested challenge:',
      '   - "turn_left": The person clearly turned THEIR OWN head toward THEIR LEFT (meaning left cheek/ear recedes and nose points to their left). A straight/frontal neutral face MUST be false.',
      '   - "turn_right": The person clearly turned THEIR OWN head toward THEIR RIGHT (meaning right cheek/ear recedes and nose points to their right). A straight/frontal neutral face MUST be false.',
      '   - "open_mouth": The person\'s mouth is visibly wide/clearly open.',
      '   - "blink": The person\'s eyes are closed/blinking clearly.',
      '3) Note: Evaluate `turn_left`, `turn_right`, and `headDirection` strictly by the SUBJECT\'s own anatomical head turn ("left" when turning their own left, "right" when turning their own right, "front" when straight), NOT viewer side.',
      '',
      'Return ONLY strict JSON:',
      '{',
      '  "faceDetected": boolean,',
      '  "faceCount": number,',
      '  "headDirection": "front" | "left" | "right",',
      '  "mouthOpen": boolean,',
      '  "eyesClosed": boolean,',
      '  "actionDetected": boolean,',
      '  "spoofOrScreen": boolean',
      '}'
    ].join('\n');

    const aiResult = await executeAiFn({
      payload: {
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: prepared.mimeType, data: prepared.data } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.05
        }
      },
      timeoutMs: 12_000
    });

    if (!aiResult || !aiResult.text) {
      const noKeys = Boolean(aiResult?.disabled || /no .*key|disabled/i.test(String(aiResult?.reason || '')));
      return { ok: false, fallback: true, aiDisabled: noKeys };
    }

    const parsed = parseGeminiJson(aiResult.text);
    if (!parsed || typeof parsed.faceDetected !== 'boolean') {
      return { ok: false, fallback: true, aiDisabled: false };
    }

    const faceDetected = parsed.faceDetected === true;
    const faceCount = Number.isFinite(Number(parsed.faceCount))
      ? Math.max(0, Math.round(Number(parsed.faceCount)))
      : (faceDetected ? 1 : 0);
    const spoofOrScreen = parsed.spoofOrScreen === true;

    if (spoofOrScreen) {
      return {
        ok: true,
        fallback: false,
        faceDetected: faceDetected && faceCount === 1,
        faceCount,
        actionDetected: false,
        spoofDetected: true,
        guidance: 'spoof_detected'
      };
    }

    if (!faceDetected || faceCount !== 1) {
      return {
        ok: true,
        fallback: false,
        faceDetected: faceCount > 1,
        faceCount,
        actionDetected: false,
        spoofDetected: false,
        guidance: faceCount > 1 ? 'multiple_faces' : 'no_face'
      };
    }

    const headDirection = String(parsed.headDirection || '').trim().toLowerCase();
    let actionDetected = parsed.actionDetected === true;
    if (challengeType === 'turn_left') {
      actionDetected = actionDetected && headDirection === 'left';
    } else if (challengeType === 'turn_right') {
      actionDetected = actionDetected && headDirection === 'right';
    } else if (challengeType === 'open_mouth') {
      actionDetected = actionDetected && parsed.mouthOpen === true;
    } else if (challengeType === 'blink') {
      actionDetected = actionDetected && parsed.eyesClosed === true;
    }

    return {
      ok: true,
      fallback: false,
      faceDetected: true,
      faceCount: 1,
      actionDetected,
      spoofDetected: false,
      guidance: actionDetected ? 'passed' : 'perform_action'
    };
  } catch {
    return { ok: false, fallback: true, aiDisabled: false };
  }
}

export const geminiIdentityVerifier = {
  analyzeIdentityDocumentWithGemini,
  matchDocumentAndSelfieWithGemini,
  inspectLivenessQualityWithGemini,
  verifyLivenessChallengeFrameWithGemini,
  normalizeDocumentType
};

export default geminiIdentityVerifier;
