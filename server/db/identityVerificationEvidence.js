import { randomUUID } from 'node:crypto';
import { getPgPool } from './postgres.js';
import { deleteMedia, readMediaBuffer, storeMedia } from './mediaStorage.js';

const PURPOSE = 'identity_verification';

function getFolderName(user) {
  const identifier = String(user.tiwiId || user.storeId || user.id || '');
  const safeIdentifier = identifier.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  if (!safeIdentifier) throw new Error('The account has no usable Tiwlo ID for evidence storage.');
  return safeIdentifier;
}

function getEvidenceAlias(user, attemptId, kind, extension) {
  return `/uploads/verification/${getFolderName(user)}/${attemptId}.${kind}.${extension}`;
}

function getKind(storagePath) {
  const name = storagePath.split('/').pop() || '';
  return name.split('.')[1] || 'evidence';
}

function getLabel(kind) {
  return ({
    document: 'Identity document',
    selfie: 'Verification selfie',
    'liveness-recording': 'Liveness recording'
  })[kind] || 'Verification evidence';
}

export const identityVerificationEvidence = {
  async store({ user, document, selfie, recording, documentType }) {
    const attemptId = randomUUID();
    const documentExtension = document.detectedFormat;
    const selfieExtension = selfie.detectedFormat;
    const uploads = [
      {
        kind: 'document',
        buffer: document.buffer,
        contentType: `image/${documentExtension === 'jpg' ? 'jpeg' : documentExtension}`,
        extension: documentExtension,
        originalFilename: `${['passport', 'national_id', 'aadhaar'].includes(documentType) ? documentType : 'identity'}-document.${documentExtension}`
      },
      {
        kind: 'selfie',
        buffer: selfie.buffer,
        contentType: `image/${selfieExtension === 'jpg' ? 'jpeg' : selfieExtension}`,
        extension: selfieExtension,
        originalFilename: `verification-selfie.${selfieExtension}`
      },
      {
        kind: 'liveness-recording',
        buffer: recording,
        contentType: 'video/mp4',
        extension: 'mp4',
        originalFilename: 'liveness-recording.mp4'
      }
    ];
    const savedAliases = [];
    try {
      for (const upload of uploads) {
        const alias = getEvidenceAlias(user, attemptId, upload.kind, upload.extension);
        await storeMedia({
          aliases: [alias],
          buffer: upload.buffer,
          contentType: upload.contentType,
          originalFilename: upload.originalFilename,
          ownerId: user.id,
          purpose: PURPOSE,
          reviewStatus: 'approved'
        });
        savedAliases.push(alias);
      }
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
    if (!pool) throw new Error('PostgreSQL identity evidence storage is unavailable.');
    const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;
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
    return rows.map(file => {
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
  },

  async readForUser(user, mediaId) {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL identity evidence storage is unavailable.');
    const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;
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
    if (!rows[0]) return null;
    return readMediaBuffer(rows[0].storage_path);
  },

  async deleteForUser(user, mediaId = null) {
    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL identity evidence storage is unavailable.');
    const folderPrefix = `/uploads/verification/${getFolderName(user)}/`;
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
    for (const { storage_path: storagePath } of rows) {
      await deleteMedia(storagePath);
    }
    return rows.length;
  }
};
