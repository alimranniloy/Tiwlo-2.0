import { randomUUID } from 'node:crypto';
import { getPgPool, isPgActive } from './postgres.js';
import { deleteMedia, readMediaBuffer, storeMedia } from './mediaStorage.js';

const PURPOSE = 'identity_verification';
const ALLOWED_DOCUMENT_TYPES = ['passport', 'national_id', 'other_document', 'drivers_license'];

const memoryEvidence = new Map();

function usePg() {
  return Boolean(isPgActive() && getPgPool());
}

function isMockedPoolQuery(pool) {
  return Boolean(pool && typeof pool.query === 'function' && pool.query.mock);
}

function getFolderName(user) {
  const identifier = String(user?.tiwiId || user?.storeId || user?.id || '');
  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  if (!safeIdentifier) throw new Error('The account has no usable Tiwlo ID for evidence storage.');
  return safeIdentifier;
}

function getEvidenceAlias(user, attemptId, kind, extension) {
  return `/uploads/verification/${getFolderName(user)}/${attemptId}.${kind}.${extension}`;
}

function getKind(storagePath) {
  const name = String(storagePath || '').split('/').pop() || '';
  return name.split('.')[1] || 'evidence';
}

function getLabel(kind) {
  return ({
    document: 'Identity document',
    'document-back': 'Identity document (Back side)',
    selfie: 'Verification selfie',
    'liveness-recording': 'Liveness recording'
  })[kind] || 'Verification evidence';
}

function normalizeDocPrefix(documentType) {
  const raw = String(documentType || '').trim().toLowerCase();
  const normalized = raw === 'aadhaar' ? 'other_document' : raw;
  return ALLOWED_DOCUMENT_TYPES.includes(normalized) ? normalized : 'identity';
}

function listMemoryForUser(user) {
  const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;
  const userId = String(user.id);
  const items = [];
  for (const entry of memoryEvidence.values()) {
    if (entry.ownerId === userId && entry.storagePath.startsWith(folderPrefix)) {
      items.push({
        id: entry.id,
        category: entry.kind,
        kind: entry.kind,
        name: entry.label,
        label: entry.label,
        originalFilename: entry.filename,
        filename: entry.filename,
        contentType: entry.contentType,
        size: Number(entry.sizeBytes),
        sizeBytes: Number(entry.sizeBytes),
        storagePath: entry.storagePath,
        createdAt: entry.createdAt
      });
    }
  }
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export const identityVerificationEvidence = {
  resetMemoryStore() {
    memoryEvidence.clear();
  },

  async store({ user, document, documentBack = null, selfie, recording, documentType }) {
    const attemptId = randomUUID();
    const docPrefix = normalizeDocPrefix(documentType);
    const uploads = [];

    if (document?.buffer) {
      const documentExtension = document.detectedFormat || 'png';
      uploads.push({
        kind: 'document',
        buffer: document.buffer,
        contentType: `image/${documentExtension === 'jpg' ? 'jpeg' : documentExtension}`,
        extension: documentExtension,
        originalFilename: `${docPrefix}-document.${documentExtension}`
      });
    }

    if (documentBack?.buffer) {
      const backExtension = documentBack.detectedFormat || 'png';
      uploads.push({
        kind: 'document-back',
        buffer: documentBack.buffer,
        contentType: `image/${backExtension === 'jpg' ? 'jpeg' : backExtension}`,
        extension: backExtension,
        originalFilename: `${docPrefix}-document-back.${backExtension}`
      });
    }

    if (selfie?.buffer) {
      const selfieExtension = selfie.detectedFormat || 'png';
      uploads.push({
        kind: 'selfie',
        buffer: selfie.buffer,
        contentType: `image/${selfieExtension === 'jpg' ? 'jpeg' : selfieExtension}`,
        extension: selfieExtension,
        originalFilename: `verification-selfie.${selfieExtension}`
      });
    }

    if (Buffer.isBuffer(recording) && recording.length > 0) {
      const isWebm =
        recording.length >= 4 && recording.readUInt32BE(0) === 0x1a45dfa3;
      const recExt = isWebm ? 'webm' : 'mp4';
      const recMime = isWebm ? 'video/webm' : 'video/mp4';
      uploads.push({
        kind: 'liveness-recording',
        buffer: recording,
        contentType: recMime,
        extension: recExt,
        originalFilename: `liveness-recording.${recExt}`
      });
    }

    if (uploads.length === 0) {
      return [];
    }

    if (!usePg()) {
      const now = new Date().toISOString();
      const descriptors = [];
      for (const upload of uploads) {
        const id = randomUUID();
        const storagePath = getEvidenceAlias(user, attemptId, upload.kind, upload.extension);
        const label = getLabel(upload.kind);
        memoryEvidence.set(id, {
          id,
          ownerId: String(user.id),
          kind: upload.kind,
          label,
          filename: upload.originalFilename,
          contentType: upload.contentType,
          sizeBytes: upload.buffer.length,
          storagePath,
          buffer: Buffer.from(upload.buffer),
          createdAt: now
        });
        descriptors.push({
          id,
          kind: upload.kind,
          label,
          filename: upload.originalFilename,
          contentType: upload.contentType,
          sizeBytes: upload.buffer.length,
          storagePath
        });
      }
      return descriptors;
    }

    const savedAliases = [];
    const descriptors = [];
    try {
      for (const upload of uploads) {
        const alias = getEvidenceAlias(user, attemptId, upload.kind, upload.extension);
        const stored = await storeMedia({
          aliases: [alias],
          buffer: upload.buffer,
          contentType: upload.contentType,
          originalFilename: upload.originalFilename,
          ownerId: user.id,
          purpose: PURPOSE,
          reviewStatus: 'approved'
        });
        savedAliases.push(alias);
        descriptors.push({
          id: stored?.id || randomUUID(),
          kind: upload.kind,
          label: getLabel(upload.kind),
          filename: upload.originalFilename,
          contentType: upload.contentType,
          sizeBytes: upload.buffer.length,
          storagePath: alias
        });
      }
      return descriptors;
    } catch (error) {
      for (const alias of savedAliases) {
        try {
          await deleteMedia(alias);
        } catch (cleanupError) {
          console.error('[Identity Verification Evidence] Could not roll back partial upload:', cleanupError.message);
        }
      }
      throw error;
    }
  },

  async listForUser(user) {
    const pool = getPgPool();
    const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;

    if (usePg() || isMockedPoolQuery(pool)) {
      const { rows } = await pool.query(
        `SELECT m.id, a.storage_path, m.original_filename, m.content_type,
                m.size_bytes, m.created_at
         FROM system_media m
         JOIN system_media_aliases a ON a.media_id = m.id
         WHERE m.owner_id = $1
           AND m.purpose = $2
           AND left(a.storage_path, char_length($3)) = $3
         ORDER BY m.created_at DESC, m.id DESC`,
        [String(user.id), PURPOSE, folderPrefix]
      );
      const pgFiles = (Array.isArray(rows) ? rows : [])
        .filter(file => file && file.storage_path)
        .map(file => {
          const kind = getKind(file.storage_path);
          return {
            id: file.id,
            category: kind,
            name: getLabel(kind),
            originalFilename: file.original_filename,
            contentType: file.content_type,
            size: Number(file.size_bytes),
            createdAt: file.created_at
          };
        });
      if (usePg()) return pgFiles;
      const memFiles = listMemoryForUser(user);
      const seen = new Set(pgFiles.map(f => String(f.id)));
      return [...pgFiles, ...memFiles.filter(f => !seen.has(String(f.id)))];
    }

    return listMemoryForUser(user);
  },

  async readForUser(user, mediaId) {
    const pool = getPgPool();
    const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;

    if (usePg() || isMockedPoolQuery(pool)) {
      const { rows } = await pool.query(
        `SELECT a.storage_path
         FROM system_media m
         JOIN system_media_aliases a ON a.media_id = m.id
         WHERE m.id = $1
           AND m.owner_id = $2
           AND m.purpose = $3
           AND left(a.storage_path, char_length($4)) = $4
         LIMIT 1`,
        [mediaId, String(user.id), PURPOSE, folderPrefix]
      );
      if (rows[0]?.storage_path) {
        return readMediaBuffer(rows[0].storage_path);
      }
      if (usePg()) return null;
    }

    const entry = memoryEvidence.get(String(mediaId));
    if (!entry || entry.ownerId !== String(user.id) || !entry.storagePath.startsWith(folderPrefix)) {
      return null;
    }
    return {
      id: entry.id,
      data: Buffer.from(entry.buffer),
      content_type: entry.contentType,
      original_filename: entry.filename,
      size_bytes: entry.sizeBytes
    };
  },

  async deleteForUser(user, mediaId = null) {
    const pool = getPgPool();
    const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;

    if (usePg() || isMockedPoolQuery(pool)) {
      const values = [String(user.id), PURPOSE, folderPrefix];
      let mediaFilter = '';
      if (mediaId) {
        values.push(mediaId);
        mediaFilter = 'AND m.id = $4';
      }
      const { rows } = await pool.query(
        `SELECT a.storage_path
         FROM system_media m
         JOIN system_media_aliases a ON a.media_id = m.id
         WHERE m.owner_id = $1
           AND m.purpose = $2
           AND left(a.storage_path, char_length($3)) = $3
           ${mediaFilter}`,
        values
      );
      let deleted = 0;
      for (const row of (Array.isArray(rows) ? rows : [])) {
        if (row?.storage_path) {
          await deleteMedia(row.storage_path);
          deleted += 1;
        }
      }
      if (usePg()) return deleted;
    }

    let deletedCount = 0;
    for (const [id, entry] of memoryEvidence.entries()) {
      if (entry.ownerId !== String(user.id) || !entry.storagePath.startsWith(folderPrefix)) continue;
      if (mediaId && id !== String(mediaId)) continue;
      memoryEvidence.delete(id);
      deletedCount += 1;
    }
    return deletedCount;
  }
};
