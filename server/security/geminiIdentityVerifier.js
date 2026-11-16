import sharp from 'sharp';
import {
  executeGeminiWithFailover,
  getChatSystemSettings
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

async function checkAiEnabled(getSettingsFn) {
  try {
    const settings = await getSettingsFn();
    if (settings && settings.enabled === false) {
      return { enabled: false, reason: 'AI verification is disabled in system settings.' };
    }
    return { enabled: true };
  } catch (err) {
    return { enabled: false, reason: err?.message || 'Unable to load AI system settings.' };
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

function buildFaceMatchPrompt({ documentType, expectedName, expectedAddress, livenessPassed }) {
  const docLabel = getDocumentTypeLabel(documentType);
  return [
    'You are an expert biometric KYC identity verifier.',
    'You are given TWO images:',
    '- Image 1: An identity document (supporting Bengali, English, and international passports, national IDs, driver licenses, and other government documents).',
    '- Image 2: A live selfie capture.',
    `Declared Document Type: ${docLabel} (${normalizeDocumentType(documentType)})`,
    expectedName ? `Expected Account Name: ${expectedName}` : '',
    expectedAddress ? `Expected Account Address: ${expectedAddress}` : '',
    `Active Liveness Challenges Passed: ${livenessPassed ? 'true' : 'false'}`,
    '',
    'Verify the following carefully:',
    '1) Both Image 1 (document portrait) and Image 2 (live selfie) contain a clear, visible human face.',
    '2) Both faces belong to the same person (`isMatch`: boolean).',
    '3) Provide a match confidence score from 0 to 100 (`confidenceScore`).',
    '4) Extract readable document details (`extractedName`, `extractedAddress`, `documentNumber`, `dateOfBirth`, `country`).',
    '5) Perform Deepfake, Synthetic Face, and Screen-Replay Spoof Screening on both the document and the selfie: detect AI-generated/synthetic faces, face-swap artifacts, monitor/phone screen replay, printed photo presentation attacks, or document tampering (`deepfakeOrReplaySuspected`: boolean, `spoofRisk`: "low" | "medium" | "high", `tamperingSignals`: array of strings, `documentExpiryValid`: boolean or null, `isScreenRecaptureOrPrintedCopy`: boolean).',
    '6) If `isMatch` is false or any deepfake/replay/spoof is detected, set `reason` to one of: "face_mismatch", "document_face_not_clear", "selfie_face_not_clear", "document_unreadable", "spoof_or_deepfake_detected". If `isMatch` is true and clean, set `reason` to null.',
    '',
    'Return ONLY a strict JSON object with these exact keys:',
    '{',
    '  "documentFaceClear": boolean,',
    '  "selfieFaceClear": boolean,',
    '  "documentReadable": boolean,',
    '  "isMatch": boolean,',
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
        error: buildFallbackReason(aiResult, 'Gemini face match service is unavailable.')
      };
    }

    const parsed = parseGeminiJson(aiResult.text);
    if (!parsed || typeof parsed.isMatch !== 'boolean') {
      return {
        ok: false,
        fallbackToManual: true,
        isMatch: false,
        isLiveValid: false,
        error: 'Gemini returned an unparseable face match response.'
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
      error: error?.message || 'Gemini face match failed.'
    };
  }
}

export const geminiIdentityVerifier = {
  analyzeIdentityDocumentWithGemini,
  matchDocumentAndSelfieWithGemini,
  normalizeDocumentType
};

export default geminiIdentityVerifier;
