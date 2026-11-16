import crypto, { randomUUID } from 'node:crypto';
import { getPgPool, isPgActive } from './postgres.js';

export const REVIEW_STATUSES = ['pending_review', 'accepted', 'declined', 'permanently_closed'];
export const REVIEW_ACTIONS = ['accept', 'decline', 'permanently_close'];
export const REVIEW_SOURCES = ['gemini_fallback', 'gemini_auto', 'manual_submission'];

const memoryReviews = new Map();
let schemaReadyPromise = null;

function usePg() {
  return Boolean(isPgActive() && getPgPool());
}

function createStoreError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getPiiKey() {
  const secret = process.env.IDENTITY_PII_KEY || process.env.SESSION_SECRET || 'tiwlo-identity-dev-key';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

export function computeDocumentFingerprint(documentNumber) {
  if (documentNumber === undefined || documentNumber === null) return null;
  const clean = String(documentNumber).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;
  return crypto.createHmac('sha256', getPiiKey()).update(`doc:${clean}`).digest('hex');
}

export function computeIdentityHash({ fullName, dateOfBirth, documentNumber } = {}) {
  const cleanName = String(fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const cleanDob = String(dateOfBirth || '').trim();
  const cleanDoc = String(documentNumber || '').trim();
  if (!cleanName || !cleanDob || !cleanDoc) return null;
  return crypto.createHmac('sha256', getPiiKey()).update(`identity:${cleanName}|${cleanDob}`).digest('hex');
}

export function maskDocumentNumber(value) {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim();
  if (!clean) return null;
  if (clean.length <= 4) {
    return '*'.repeat(clean.length);
  }
  return `${'*'.repeat(clean.length - 4)}${clean.slice(-4)}`;
}

export function encryptDocumentNumber(value) {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim();
  if (!clean) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getPiiKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  };
}

export function decryptDocumentNumber(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.alg !== 'aes-256-gcm' || !payload.iv || !payload.tag || !payload.ciphertext) {
    return null;
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getPiiKey(),
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}

function normalizeDocumentType(value) {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim().toLowerCase();
  if (!clean) return null;
  if (clean === 'aadhaar') return 'other_document';
  return clean.slice(0, 64);
}

function sanitizeJsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...value };
}

function sanitizeJsonArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(item => (item && typeof item === 'object' ? { ...item } : item));
}

function protectExtractedPii(extractedInput, metadataInput, existingMetadata = {}) {
  const extracted = sanitizeJsonObject(extractedInput);
  const metadata = {
    ...sanitizeJsonObject(existingMetadata),
    ...sanitizeJsonObject(metadataInput)
  };

  const rawDocNumber = extracted.documentNumber ?? extracted.document_number;
  let derivedDocFingerprint = null;
  let derivedIdentityHash = null;

  if (rawDocNumber !== undefined) {
    delete extracted.documentNumber;
    delete extracted.document_number;
    const cleanNumber = rawDocNumber !== null ? String(rawDocNumber).trim() : '';
    if (cleanNumber) {
      extracted.maskedDocumentNumber = maskDocumentNumber(cleanNumber);
      metadata.encryptedDocumentNumber = encryptDocumentNumber(cleanNumber);
      derivedDocFingerprint = computeDocumentFingerprint(cleanNumber);
      derivedIdentityHash = computeIdentityHash({
        fullName: extracted.fullName ?? extracted.full_name,
        dateOfBirth: extracted.dateOfBirth ?? extracted.date_of_birth,
        documentNumber: cleanNumber
      });
    }
  } else if (extracted.maskedDocumentNumber) {
    extracted.maskedDocumentNumber = String(extracted.maskedDocumentNumber);
  }

  return { extractedData: extracted, metadata, derivedDocFingerprint, derivedIdentityHash };
}

function toIsoOrNull(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function formatReviewRow(row) {
  if (!row) return null;
  const rawExtracted = sanitizeJsonObject(row.extracted_data ?? row.extractedData);
  const rawMetadata = sanitizeJsonObject(row.metadata);
  const {
    extractedData,
    metadata,
    derivedDocFingerprint,
    derivedIdentityHash
  } = protectExtractedPii(rawExtracted, rawMetadata);

  const status = REVIEW_STATUSES.includes(row.status) ? row.status : 'pending_review';
  const isPermanentlyClosed = Boolean(
    row.is_permanently_closed ?? row.isPermanentlyClosed ?? (status === 'permanently_closed')
  );

  return {
    id: String(row.id),
    userId: String(row.user_id ?? row.userId ?? ''),
    tiwiId: row.tiwi_id ?? row.tiwiId ?? null,
    userName: row.user_name ?? row.userName ?? null,
    userEmail: row.user_email ?? row.userEmail ?? null,
    documentType: normalizeDocumentType(row.document_type ?? row.documentType),
    documentFingerprint: row.document_fingerprint ?? row.documentFingerprint ?? derivedDocFingerprint ?? null,
    identityHash: row.identity_hash ?? row.identityHash ?? derivedIdentityHash ?? null,
    status,
    isPermanentlyClosed,
    permanentlyClosedAt: toIsoOrNull(row.permanently_closed_at ?? row.permanentlyClosedAt),
    permanentlyClosedBy: row.permanently_closed_by ?? row.permanentlyClosedBy ?? null,
    reviewedAt: toIsoOrNull(row.reviewed_at ?? row.reviewedAt),
    reviewedById: row.reviewed_by_id ?? row.reviewedById ?? null,
    reviewedByEmail: row.reviewed_by_email ?? row.reviewedByEmail ?? null,
    reviewReason: row.review_reason ?? row.reviewReason ?? null,
    source: String(row.source || 'gemini_fallback'),
    aiConfidence: row.ai_confidence !== undefined && row.ai_confidence !== null
      ? Number(row.ai_confidence)
      : (row.aiConfidence !== undefined && row.aiConfidence !== null ? Number(row.aiConfidence) : null),
    aiReason: row.ai_reason ?? row.aiReason ?? null,
    extractedData,
    evidenceFiles: sanitizeJsonArray(row.evidence_files ?? row.evidenceFiles),
    metadata,
    createdAt: toIsoOrNull(row.created_at ?? row.createdAt) || new Date().toISOString(),
    updatedAt: toIsoOrNull(row.updated_at ?? row.updatedAt) || new Date().toISOString()
  };
}

async function ensureSchema() {
  const pool = getPgPool();
  if (!pool || !isPgActive()) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS identity_verification_reviews (
          id VARCHAR(80) PRIMARY KEY,
          user_id VARCHAR(120) NOT NULL,
          tiwi_id VARCHAR(120),
          user_name VARCHAR(255),
          user_email VARCHAR(255),
          document_type VARCHAR(64),
          document_fingerprint VARCHAR(128),
          identity_hash VARCHAR(128),
          status VARCHAR(40) NOT NULL DEFAULT 'pending_review',
          is_permanently_closed BOOLEAN NOT NULL DEFAULT FALSE,
          permanently_closed_at TIMESTAMPTZ,
          permanently_closed_by VARCHAR(255),
          reviewed_at TIMESTAMPTZ,
          reviewed_by_id VARCHAR(120),
          reviewed_by_email VARCHAR(255),
          review_reason TEXT,
          source VARCHAR(64) DEFAULT 'gemini_fallback',
          ai_confidence NUMERIC,
          ai_reason TEXT,
          extracted_data JSONB DEFAULT '{}'::jsonb,
          evidence_files JSONB DEFAULT '[]'::jsonb,
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE identity_verification_reviews
          ADD COLUMN IF NOT EXISTS document_fingerprint VARCHAR(128);
        ALTER TABLE identity_verification_reviews
          ADD COLUMN IF NOT EXISTS identity_hash VARCHAR(128);
        CREATE INDEX IF NOT EXISTS idx_identity_verification_reviews_user_id
          ON identity_verification_reviews(user_id);
        CREATE INDEX IF NOT EXISTS idx_identity_verification_reviews_status_created
          ON identity_verification_reviews(status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_identity_verification_reviews_doc_fp
          ON identity_verification_reviews(document_fingerprint)
          WHERE document_fingerprint IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_identity_verification_reviews_identity_hash
          ON identity_verification_reviews(identity_hash)
          WHERE identity_hash IS NOT NULL;
      `);
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  await schemaReadyPromise;
}

function matchesSearch(review, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const haystacks = [
    review.id,
    review.userId,
    review.tiwiId,
    review.userName,
    review.userEmail,
    review.documentType,
    review.aiReason,
    review.reviewReason,
    review.extractedData?.fullName,
    review.extractedData?.maskedDocumentNumber
  ];
  return haystacks.some(val => val && String(val).toLowerCase().includes(q));
}

function isBlockingReviewForDuplicate(review) {
  if (!review) return false;
  if (review.status === 'accepted') return true;
  if (review.status === 'permanently_closed') {
    return Boolean(
      review.metadata?.duplicateIdentityBan ||
      review.metadata?.fraudBan ||
      /duplicate|fraud/i.test(String(review.reviewReason || ''))
    );
  }
  return false;
}

export const identityReviewStore = {
  resetMemoryStore() {
    memoryReviews.clear();
  },

  async createOrUpdateReview(payload = {}) {
    const userId = String(payload.userId ?? payload.user_id ?? '').trim();
    if (!userId) {
      throw createStoreError('userId is required for an identity verification review.', 400, 'INVALID_REVIEW_PAYLOAD');
    }

    const id = String(payload.id || `idr_${randomUUID()}`).slice(0, 80);
    const requestedStatus = payload.status || 'pending_review';
    const status = REVIEW_STATUSES.includes(requestedStatus) ? requestedStatus : 'pending_review';
    const rawSource = String(payload.source || 'gemini_fallback').trim();
    const source = REVIEW_SOURCES.includes(rawSource) ? rawSource : (rawSource.slice(0, 64) || 'gemini_fallback');
    const rawConfidence = payload.aiConfidence ?? payload.ai_confidence;
    const aiConfidence = rawConfidence !== undefined && rawConfidence !== null && Number.isFinite(Number(rawConfidence))
      ? Number(rawConfidence)
      : null;

    if (usePg()) {
      await ensureSchema();
      const pool = getPgPool();
      const existingRes = await pool.query(
        'SELECT * FROM identity_verification_reviews WHERE id = $1 LIMIT 1',
        [id]
      );
      const existing = existingRes.rows[0] ? formatReviewRow(existingRes.rows[0]) : null;
      if (existing && (existing.isPermanentlyClosed || existing.status === 'permanently_closed')) {
        throw createStoreError(
          'This identity verification review has been permanently closed and cannot be modified.',
          403,
          'REVIEW_PERMANENTLY_CLOSED'
        );
      }

      const {
        extractedData,
        metadata,
        derivedDocFingerprint,
        derivedIdentityHash
      } = protectExtractedPii(
        payload.extractedData ?? payload.extracted_data ?? existing?.extractedData,
        payload.metadata,
        existing?.metadata
      );
      const documentFingerprint = (
        payload.documentFingerprint ?? payload.document_fingerprint ?? derivedDocFingerprint ?? existing?.documentFingerprint ?? null
      );
      const identityHash = (
        payload.identityHash ?? payload.identity_hash ?? derivedIdentityHash ?? existing?.identityHash ?? null
      );
      const evidenceFiles = sanitizeJsonArray(
        payload.evidenceFiles ?? payload.evidence_files ?? existing?.evidenceFiles
      );
      const isPermanentlyClosed = status === 'permanently_closed';
      const now = new Date().toISOString();

      const { rows } = await pool.query(
        `INSERT INTO identity_verification_reviews (
           id, user_id, tiwi_id, user_name, user_email, document_type,
           document_fingerprint, identity_hash,
           status, is_permanently_closed, permanently_closed_at, permanently_closed_by,
           reviewed_at, reviewed_by_id, reviewed_by_email, review_reason,
           source, ai_confidence, ai_reason, extracted_data, evidence_files, metadata,
           created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8,
           $9, $10, $11, $12,
           $13, $14, $15, $16,
           $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb,
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
         )
         ON CONFLICT (id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           tiwi_id = COALESCE(EXCLUDED.tiwi_id, identity_verification_reviews.tiwi_id),
           user_name = COALESCE(EXCLUDED.user_name, identity_verification_reviews.user_name),
           user_email = COALESCE(EXCLUDED.user_email, identity_verification_reviews.user_email),
           document_type = COALESCE(EXCLUDED.document_type, identity_verification_reviews.document_type),
           document_fingerprint = COALESCE(EXCLUDED.document_fingerprint, identity_verification_reviews.document_fingerprint),
           identity_hash = COALESCE(EXCLUDED.identity_hash, identity_verification_reviews.identity_hash),
           status = EXCLUDED.status,
           source = EXCLUDED.source,
           ai_confidence = EXCLUDED.ai_confidence,
           ai_reason = EXCLUDED.ai_reason,
           extracted_data = EXCLUDED.extracted_data,
           evidence_files = EXCLUDED.evidence_files,
           metadata = EXCLUDED.metadata,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          id,
          userId.slice(0, 120),
          payload.tiwiId ?? payload.tiwi_id ?? existing?.tiwiId ?? null,
          payload.userName ?? payload.user_name ?? existing?.userName ?? null,
          payload.userEmail ?? payload.user_email ?? existing?.userEmail ?? null,
          normalizeDocumentType(payload.documentType ?? payload.document_type ?? existing?.documentType),
          documentFingerprint ? String(documentFingerprint).slice(0, 128) : null,
          identityHash ? String(identityHash).slice(0, 128) : null,
          status,
          isPermanentlyClosed,
          isPermanentlyClosed ? (payload.permanentlyClosedAt || now) : null,
          isPermanentlyClosed ? (payload.permanentlyClosedBy || null) : null,
          payload.reviewedAt ?? existing?.reviewedAt ?? null,
          payload.reviewedById ?? existing?.reviewedById ?? null,
          payload.reviewedByEmail ?? existing?.reviewedByEmail ?? null,
          payload.reviewReason ?? existing?.reviewReason ?? null,
          source,
          aiConfidence,
          payload.aiReason ?? payload.ai_reason ?? existing?.aiReason ?? null,
          JSON.stringify(extractedData),
          JSON.stringify(evidenceFiles),
          JSON.stringify(metadata)
        ]
      );
      return formatReviewRow(rows[0]);
    }

    const existing = memoryReviews.get(id) || null;
    if (existing && (existing.isPermanentlyClosed || existing.status === 'permanently_closed')) {
      throw createStoreError(
        'This identity verification review has been permanently closed and cannot be modified.',
        403,
        'REVIEW_PERMANENTLY_CLOSED'
      );
    }

    const now = new Date().toISOString();
    const {
      extractedData,
      metadata,
      derivedDocFingerprint,
      derivedIdentityHash
    } = protectExtractedPii(
      payload.extractedData ?? payload.extracted_data ?? existing?.extractedData,
      payload.metadata,
      existing?.metadata
    );
    const documentFingerprint = (
      payload.documentFingerprint ?? payload.document_fingerprint ?? derivedDocFingerprint ?? existing?.documentFingerprint ?? null
    );
    const identityHash = (
      payload.identityHash ?? payload.identity_hash ?? derivedIdentityHash ?? existing?.identityHash ?? null
    );
    const evidenceFiles = sanitizeJsonArray(
      payload.evidenceFiles ?? payload.evidence_files ?? existing?.evidenceFiles
    );
    const isPermanentlyClosed = status === 'permanently_closed';

    const record = formatReviewRow({
      id,
      userId: userId.slice(0, 120),
      tiwiId: payload.tiwiId ?? payload.tiwi_id ?? existing?.tiwiId ?? null,
      userName: payload.userName ?? payload.user_name ?? existing?.userName ?? null,
      userEmail: payload.userEmail ?? payload.user_email ?? existing?.userEmail ?? null,
      documentType: normalizeDocumentType(payload.documentType ?? payload.document_type ?? existing?.documentType),
      documentFingerprint: documentFingerprint ? String(documentFingerprint).slice(0, 128) : null,
      identityHash: identityHash ? String(identityHash).slice(0, 128) : null,
      status,
      isPermanentlyClosed,
      permanentlyClosedAt: isPermanentlyClosed ? (payload.permanentlyClosedAt || now) : (existing?.permanentlyClosedAt ?? null),
      permanentlyClosedBy: isPermanentlyClosed ? (payload.permanentlyClosedBy || null) : (existing?.permanentlyClosedBy ?? null),
      reviewedAt: payload.reviewedAt ?? existing?.reviewedAt ?? null,
      reviewedById: payload.reviewedById ?? existing?.reviewedById ?? null,
      reviewedByEmail: payload.reviewedByEmail ?? existing?.reviewedByEmail ?? null,
      reviewReason: payload.reviewReason ?? existing?.reviewReason ?? null,
      source,
      aiConfidence,
      aiReason: payload.aiReason ?? payload.ai_reason ?? existing?.aiReason ?? null,
      extractedData,
      evidenceFiles,
      metadata,
      createdAt: existing?.createdAt || payload.createdAt || now,
      updatedAt: now
    });

    memoryReviews.set(id, record);
    return formatReviewRow(record);
  },

  async findDuplicateDocumentMatch({ documentFingerprint = null, identityHash = null, excludeUserId = null } = {}) {
    const cleanDocFp = documentFingerprint ? String(documentFingerprint).trim() : '';
    const cleanIdHash = identityHash ? String(identityHash).trim() : '';
    if (!cleanDocFp && !cleanIdHash) return null;
    const cleanExcludeUserId = excludeUserId ? String(excludeUserId).trim() : '';

    if (usePg()) {
      await ensureSchema();
      const pool = getPgPool();
      const matchConds = [];
      const params = [];

      if (cleanDocFp) {
        params.push(cleanDocFp);
        matchConds.push(`document_fingerprint = $${params.length}`);
      }
      if (cleanIdHash) {
        params.push(cleanIdHash);
        matchConds.push(`identity_hash = $${params.length}`);
      }

      let excludeClause = '';
      if (cleanExcludeUserId) {
        params.push(cleanExcludeUserId);
        excludeClause = `AND user_id <> $${params.length}`;
      }

      const { rows } = await pool.query(
        `SELECT * FROM identity_verification_reviews
         WHERE status IN ('accepted', 'permanently_closed')
           ${excludeClause}
           AND (${matchConds.join(' OR ')})
         ORDER BY created_at ASC
         LIMIT 25`,
        params
      );

      for (const row of rows) {
        const formatted = formatReviewRow(row);
        if (isBlockingReviewForDuplicate(formatted)) {
          return formatted;
        }
      }
      return null;
    }

    const candidates = [...memoryReviews.values()]
      .map(formatReviewRow)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const review of candidates) {
      if (cleanExcludeUserId && String(review.userId) === cleanExcludeUserId) continue;
      if (!isBlockingReviewForDuplicate(review)) continue;
      const docMatch = Boolean(cleanDocFp && review.documentFingerprint === cleanDocFp);
      const idMatch = Boolean(cleanIdHash && review.identityHash === cleanIdHash);
      if (docMatch || idMatch) {
        return review;
      }
    }
    return null;
  },

  async markDuplicateIdentityBan({
    reviewId = null,
    userId,
    tiwiId = null,
    userName = null,
    userEmail = null,
    documentType = null,
    documentFingerprint = null,
    identityHash = null,
    matchedReviewId = null,
    matchedUserId = null,
    reason = 'Duplicate identity document submitted across multiple accounts.',
    actor = 'system'
  } = {}) {
    const cleanUserId = String(userId || '').trim();
    if (!cleanUserId) {
      throw createStoreError('userId is required to record a duplicate identity ban.', 400, 'INVALID_REVIEW_PAYLOAD');
    }
    const now = new Date().toISOString();
    const id = String(reviewId || `idr_${randomUUID()}`).slice(0, 80);

    const existing = await this.getReviewById(id);
    if (existing && !existing.isPermanentlyClosed) {
      if (usePg()) {
        await ensureSchema();
        const pool = getPgPool();
        const nextMeta = {
          ...sanitizeJsonObject(existing.metadata),
          duplicateIdentityBan: true,
          fraudBan: true,
          matchedReviewId: matchedReviewId || null,
          matchedUserId: matchedUserId || null,
          banReason: reason
        };
        const { rows } = await pool.query(
          `UPDATE identity_verification_reviews
           SET status = 'permanently_closed',
               is_permanently_closed = TRUE,
               permanently_closed_at = $2::timestamptz,
               permanently_closed_by = $3,
               reviewed_at = $2::timestamptz,
               reviewed_by_email = $3,
               review_reason = $4,
               metadata = $5::jsonb,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1
           RETURNING *`,
          [id, now, actor, reason, JSON.stringify(nextMeta)]
        );
        return formatReviewRow(rows[0]);
      }
    }

    return this.createOrUpdateReview({
      id,
      userId: cleanUserId,
      tiwiId,
      userName,
      userEmail,
      documentType,
      documentFingerprint,
      identityHash,
      status: 'permanently_closed',
      permanentlyClosedAt: now,
      permanentlyClosedBy: actor,
      reviewedAt: now,
      reviewedByEmail: actor,
      reviewReason: reason,
      source: 'gemini_auto',
      metadata: {
        duplicateIdentityBan: true,
        fraudBan: true,
        matchedReviewId: matchedReviewId || null,
        matchedUserId: matchedUserId || null,
        banReason: reason
      }
    });
  },

  async listReviews({ status = 'all', search = '' } = {}) {
    const cleanStatus = String(status || 'all').trim().toLowerCase();

    if (usePg()) {
      await ensureSchema();
      const pool = getPgPool();
      const params = [];
      const conditions = [];
      if (cleanStatus && cleanStatus !== 'all' && REVIEW_STATUSES.includes(cleanStatus)) {
        params.push(cleanStatus);
        conditions.push(`status = $${params.length}`);
      }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT * FROM identity_verification_reviews
         ${whereClause}
         ORDER BY created_at DESC, id DESC`,
        params
      );
      return rows
        .map(formatReviewRow)
        .filter(review => matchesSearch(review, search));
    }

    const items = [...memoryReviews.values()]
      .map(formatReviewRow)
      .filter(review => {
        if (cleanStatus && cleanStatus !== 'all' && REVIEW_STATUSES.includes(cleanStatus)) {
          return review.status === cleanStatus;
        }
        return true;
      })
      .filter(review => matchesSearch(review, search))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id));

    return items;
  },

  async getReviewById(reviewId) {
    const id = String(reviewId || '').trim();
    if (!id) return null;

    if (usePg()) {
      await ensureSchema();
      const pool = getPgPool();
      const { rows } = await pool.query(
        'SELECT * FROM identity_verification_reviews WHERE id = $1 LIMIT 1',
        [id]
      );
      return rows[0] ? formatReviewRow(rows[0]) : null;
    }

    const found = memoryReviews.get(id);
    return found ? formatReviewRow(found) : null;
  },

  async decideReview({ reviewId, action, reason = '', adminUser = null, banUser = false }) {
    const cleanAction = String(action || '').trim().toLowerCase();
    if (!REVIEW_ACTIONS.includes(cleanAction)) {
      throw createStoreError(
        'Decision action must be accept, decline, or permanently_close.',
        400,
        'INVALID_REVIEW_ACTION'
      );
    }

    const id = String(reviewId || '').trim();
    const existing = await this.getReviewById(id);
    if (!existing) {
      throw createStoreError('Identity verification review not found.', 404, 'REVIEW_NOT_FOUND');
    }
    if (existing.isPermanentlyClosed || existing.status === 'permanently_closed') {
      throw createStoreError(
        'This identity verification review is permanently closed and can never be modified again.',
        403,
        'REVIEW_PERMANENTLY_CLOSED'
      );
    }

    const now = new Date().toISOString();
    const adminId = adminUser?.id ? String(adminUser.id).slice(0, 120) : null;
    const adminEmail = adminUser?.email ? String(adminUser.email).slice(0, 255) : null;
    const cleanReason = typeof reason === 'string' ? reason.trim() : String(reason || '').trim();

    const nextStatus = cleanAction === 'accept'
      ? 'accepted'
      : (cleanAction === 'decline' ? 'declined' : 'permanently_closed');
    const isPermClosed = cleanAction === 'permanently_close';
    const nextMetadata = {
      ...sanitizeJsonObject(existing.metadata),
      ...(isPermClosed && banUser ? { fraudBan: true, banReason: cleanReason || 'Permanently closed by administrator' } : {})
    };

    if (usePg()) {
      await ensureSchema();
      const pool = getPgPool();
      const { rows } = await pool.query(
        `UPDATE identity_verification_reviews
         SET status = $2,
             is_permanently_closed = $3,
             permanently_closed_at = CASE WHEN $3 THEN $4::timestamptz ELSE permanently_closed_at END,
             permanently_closed_by = CASE WHEN $3 THEN $5 ELSE permanently_closed_by END,
             reviewed_at = $4::timestamptz,
             reviewed_by_id = $6,
             reviewed_by_email = $7,
             review_reason = $8,
             metadata = $9::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND is_permanently_closed = FALSE
           AND status <> 'permanently_closed'
         RETURNING *`,
        [
          id,
          nextStatus,
          isPermClosed,
          now,
          isPermClosed ? (adminEmail || adminId || 'admin') : null,
          adminId,
          adminEmail,
          cleanReason,
          JSON.stringify(nextMetadata)
        ]
      );

      if (!rows[0]) {
        const recheck = await this.getReviewById(id);
        if (!recheck) {
          throw createStoreError('Identity verification review not found.', 404, 'REVIEW_NOT_FOUND');
        }
        throw createStoreError(
          'This identity verification review is permanently closed and can never be modified again.',
          403,
          'REVIEW_PERMANENTLY_CLOSED'
        );
      }

      return formatReviewRow(rows[0]);
    }

    const updated = formatReviewRow({
      ...existing,
      status: nextStatus,
      isPermanentlyClosed: isPermClosed,
      permanentlyClosedAt: isPermClosed ? now : existing.permanentlyClosedAt,
      permanentlyClosedBy: isPermClosed ? (adminEmail || adminId || 'admin') : existing.permanentlyClosedBy,
      reviewedAt: now,
      reviewedById: adminId,
      reviewedByEmail: adminEmail,
      reviewReason: cleanReason,
      metadata: nextMetadata,
      updatedAt: now
    });
    memoryReviews.set(id, updated);
    return formatReviewRow(updated);
  },

  async deleteByUserId(userId) {
    const cleanUserId = String(userId ?? '').trim();
    if (!cleanUserId) return 0;

    if (usePg()) {
      await ensureSchema();
      const pool = getPgPool();
      const { rowCount } = await pool.query(
        'DELETE FROM identity_verification_reviews WHERE user_id = $1',
        [cleanUserId]
      );
      return Number(rowCount || 0);
    }

    let deleted = 0;
    for (const [id, item] of memoryReviews.entries()) {
      if (String(item?.userId || '') === cleanUserId) {
        memoryReviews.delete(id);
        deleted += 1;
      }
    }
    return deleted;
  }
};

export default identityReviewStore;
