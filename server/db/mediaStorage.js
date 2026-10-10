import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPgPool } from './postgres.js';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';
import {
  deleteGoogleDriveMedia,
  downloadGoogleDriveMediaRange,
  getDriveAccountsForUpload,
  getGoogleDriveAccount,
  getPlatformStorageSettings,
  readGoogleDriveMedia,
  uploadGoogleDriveMedia
} from '../administrator/googleDriveStorage.js';

const MEDIA_CHUNK_BYTES = 1024 * 1024;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_MEDIA_ROOTS = {
  '/upload/': path.resolve(__dirname, '../../upload'),
  '/uploads/': path.resolve(__dirname, '../uploads')
};

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.avi': 'video/x-msvideo',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
};

export function normalizeMediaPath(value) {
  if (typeof value !== 'string') return null;

  let pathname = value;
  try {
    if (/^https?:\/\//i.test(value)) pathname = new URL(value).pathname;
  } catch {
    return null;
  }

  pathname = pathname.split(/[?#]/, 1)[0];
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\\') || /[\u0000-\u001f\u007f]/.test(pathname)) return null;
  pathname = pathname.replace(/^\/api(?=\/(?:upload|uploads)\/)/, '');
  if (!/^\/(?:upload|uploads)\/.+$/.test(pathname)) return null;
  if (pathname.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  return pathname;
}

export function inferMediaType(filename) {
  const extension = String(filename || '').match(/\.[^.]+$/)?.[0]?.toLowerCase();
  return MIME_TYPES[extension] || 'application/octet-stream';
}

export async function getPublicMediaUrl(value) {
  const storage = await getPlatformStorageSettings();
  if (storage.backend !== 'google_drive') return value;
  const hostname = getSubdomain(PLATFORM_CONFIG.driveSubdomain);
  const url = new URL(value, `https://${hostname}`);
  return `https://${hostname}${url.pathname}${url.search}${url.hash}`;
}

function getLocalMediaPath(storagePath) {
  const rootPrefix = Object.keys(LOCAL_MEDIA_ROOTS).find((prefix) => storagePath.startsWith(prefix));
  if (!rootPrefix) throw new TypeError('Media path is outside the managed upload folders.');
  const root = LOCAL_MEDIA_ROOTS[rootPrefix];
  const target = path.resolve(root, ...storagePath.slice(rootPrefix.length).split('/'));
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new TypeError('Media path is outside the managed upload folders.');
  }
  return target;
}

function getDriveFolderPath(storagePath) {
  const rootPrefix = Object.keys(LOCAL_MEDIA_ROOTS).find((prefix) => storagePath.startsWith(prefix));
  if (!rootPrefix) throw new TypeError('Media path is outside the managed upload folders.');
  const relativePath = storagePath.slice(rootPrefix.length).split('/');
  const folderPath = relativePath.slice(0, -1).filter(Boolean);
  return rootPrefix === '/uploads/' ? ['uploads', ...folderPath] : folderPath;
}

async function writeLocalMedia(storagePath, buffer, expectedSha256) {
  const targetPath = getLocalMediaPath(storagePath);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = path.join(path.dirname(targetPath), `.tiwlo-staging-${crypto.randomUUID()}.tmp`);
  try {
    await fs.promises.writeFile(temporaryPath, buffer, { flag: 'wx' });
    const written = await fs.promises.readFile(temporaryPath);
    if (crypto.createHash('sha256').update(written).digest('hex') !== expectedSha256) {
      throw new Error('Temporary server copy failed SHA-256 verification.');
    }
    await fs.promises.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

function sanitizeContentType(value, filename) {
  const candidate = String(value || '').trim().split(';', 1)[0];
  const inferred = inferMediaType(filename);
  if (candidate.toLowerCase() === 'application/octet-stream' && inferred !== 'application/octet-stream') {
    return inferred;
  }
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(candidate)
    ? candidate.toLowerCase()
    : inferred;
}

export async function storeMedia({
  aliases,
  buffer,
  contentType,
  originalFilename,
  ownerId = null,
  purpose = 'general',
  reviewStatus = 'approved',
  mediaId: requestedMediaId
}) {
  if (!Array.isArray(aliases) || aliases.length === 0) {
    throw new TypeError('At least one media URL alias is required.');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('Media content must be a non-empty Buffer.');
  }

  const storagePaths = [...new Set(aliases.map(normalizeMediaPath))];
  if (storagePaths.some((storagePath) => !storagePath)) {
    throw new TypeError('Media URL aliases must be valid local upload paths.');
  }

  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');

  const mediaId = requestedMediaId || crypto.randomUUID();
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const safeName = String(originalFilename || 'media').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
  const normalizedContentType = sanitizeContentType(contentType, originalFilename);
  const storageSettings = await getPlatformStorageSettings();
  const storageBackend = storageSettings.backend || 'postgres';
  let activeDriveAccount = null;
  let driveFile = null;
  if (storageBackend === 'google_drive') {
    const accounts = await getDriveAccountsForUpload();
    if (!accounts.length) throw new Error('Google Drive is active but no configured service account is available.');
    const folderPath = getDriveFolderPath(storagePaths[0]);
    const failures = [];
    for (const account of accounts) {
      try {
        const file = await uploadGoogleDriveMedia(account, {
          mediaId,
          filename: storagePaths[0].split('/').pop(),
          contentType: normalizedContentType,
          buffer,
          folderPath
        });
        const uploadedBytes = await readGoogleDriveMedia(account, file.id);
        const verifiedDigest = crypto.createHash('sha256').update(uploadedBytes).digest('hex');
        if (uploadedBytes.length !== buffer.length || verifiedDigest !== sha256) {
          await deleteGoogleDriveMedia(account, file.id);
          throw new Error('Google Drive upload verification failed; stored source bytes do not match.');
        }
        activeDriveAccount = account;
        driveFile = file;
        break;
      } catch (error) {
        if (error.code !== 'DRIVE_STORAGE_FULL') throw error;
        failures.push(error);
      }
    }
    if (!driveFile) throw new AggregateError(failures, 'All configured Google Drive accounts have reached their storage quota.');
  } else if (storageBackend === 'local') {
    await writeLocalMedia(storagePaths[0], buffer, sha256);
  }

  const client = await pool.connect();
  let orphanedDriveMedia = [];
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO system_media
        (id, content_type, original_filename, size_bytes, sha256, owner_id, purpose, review_status,
         storage_backend, drive_file_id, drive_account_id, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        mediaId,
        normalizedContentType,
        safeName.slice(0, 255),
        buffer.length,
        sha256,
        ownerId ? String(ownerId).slice(0, 64) : null,
        String(purpose || 'general').slice(0, 64),
        ['approved', 'pending'].includes(reviewStatus) ? reviewStatus : 'pending',
        driveFile ? 'google_drive' : storageBackend === 'local' ? 'local' : 'postgres',
        driveFile?.id || null,
        activeDriveAccount?.id || null,
        driveFile || storageBackend === 'local' ? null : buffer,
      ]
    );

    for (const storagePath of storagePaths) {
      await client.query(
        `INSERT INTO system_media_aliases (storage_path, media_id)
         VALUES ($1, $2)
         ON CONFLICT (storage_path) DO UPDATE SET media_id = EXCLUDED.media_id`,
        [storagePath, mediaId]
      );
    }
    const removed = await client.query(
      `DELETE FROM system_media
       WHERE id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM system_media_aliases WHERE media_id = system_media.id
         )
       RETURNING storage_backend, drive_file_id, drive_account_id`,
      [mediaId]
    );
    orphanedDriveMedia = removed.rows.filter((media) => media.storage_backend === 'google_drive');
    await client.query('COMMIT');
    for (const media of orphanedDriveMedia) {
      try {
        const account = await getGoogleDriveAccount(media.drive_account_id);
        await deleteGoogleDriveMedia(account, media.drive_file_id);
      } catch (cleanupError) {
        console.error('[MediaStorage] Could not remove an unreferenced Google Drive file:', cleanupError.message);
      }
    }
    return { id: mediaId, size: buffer.length, sha256 };
  } catch (error) {
    await client.query('ROLLBACK');
    if (driveFile && activeDriveAccount) {
      await deleteGoogleDriveMedia(activeDriveAccount, driveFile.id).catch((cleanupError) => {
        console.error('[MediaStorage] Could not remove unlinked Google Drive upload:', cleanupError.message);
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getMediaMetadata(value) {
  const storagePath = normalizeMediaPath(value);
  if (!storagePath) return null;

  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');
  const { rows } = await pool.query(
    `SELECT m.id, m.content_type, m.original_filename, m.size_bytes, m.sha256, m.review_status,
            m.owner_id, m.purpose, m.storage_backend, m.drive_file_id, m.drive_account_id
     FROM system_media_aliases a
     JOIN system_media m ON m.id = a.media_id
     WHERE a.storage_path = $1`,
    [storagePath]
  );
  return rows[0] || null;
}

export async function listPendingVideoMedia(limit = 100, afterId = '') {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');
  const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (m.id)
       m.id, a.storage_path, m.owner_id, m.content_type
     FROM system_media m
     JOIN system_media_aliases a ON a.media_id = m.id
     WHERE m.review_status = 'pending'
       AND m.content_type LIKE 'video/%'
       AND a.storage_path LIKE '/upload/%'
       AND m.id > $2
     ORDER BY m.id, a.storage_path
     LIMIT $1`,
    [boundedLimit, afterId]
  );
  return rows;
}

export async function readMediaBuffer(value) {
  const storagePath = normalizeMediaPath(value);
  if (!storagePath) return null;

  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');
  const { rows } = await pool.query(
    `SELECT m.id, m.data, m.content_type, m.original_filename, m.size_bytes, m.sha256,
            m.review_status, m.storage_backend, m.drive_file_id, m.drive_account_id
     FROM system_media_aliases a
     JOIN system_media m ON m.id = a.media_id
     WHERE a.storage_path = $1`,
    [storagePath]
  );
  const media = rows[0];
  if (!media) return null;
  if (media.storage_backend === 'google_drive') {
    const driveAccount = await getGoogleDriveAccount(media.drive_account_id);
    return {
      ...media,
      data: await readGoogleDriveMedia(driveAccount, media.drive_file_id)
    };
  }
  if (media.storage_backend === 'local') {
    const data = await fs.promises.readFile(getLocalMediaPath(storagePath));
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    if (data.length !== Number(media.size_bytes) || sha256 !== media.sha256) {
      throw new Error('Server media file does not match its stored size and SHA-256.');
    }
    return { ...media, data };
  }
  return media;
}

export async function setMediaReviewStatus(value, reviewStatus) {
  if (!['approved', 'pending', 'rejected'].includes(reviewStatus)) {
    throw new TypeError('Media review status must be approved, pending, or rejected.');
  }
  const storagePath = normalizeMediaPath(value);
  if (!storagePath) return false;

  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');
  const { rowCount } = await pool.query(
    `UPDATE system_media
     SET review_status = $2
     WHERE id = (
       SELECT media_id FROM system_media_aliases WHERE storage_path = $1
     )`,
    [storagePath, reviewStatus]
  );
  return rowCount > 0;
}

export async function deleteMedia(value) {
  const storagePath = normalizeMediaPath(value);
  if (!storagePath) return false;

  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');
  const client = await pool.connect();
  let removedDriveMedia = null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM system_media_aliases WHERE storage_path = $1 RETURNING media_id`,
      [storagePath]
    );
    if (rows[0]) {
      const remaining = await client.query(
        'SELECT 1 FROM system_media_aliases WHERE media_id = $1 LIMIT 1',
        [rows[0].media_id]
      );
      if (remaining.rowCount === 0) {
        const media = await client.query(
          'DELETE FROM system_media WHERE id = $1 RETURNING storage_backend, drive_file_id, drive_account_id',
          [rows[0].media_id]
        );
        removedDriveMedia = media.rows[0]?.storage_backend === 'google_drive' ? media.rows[0] : null;
      }
    }
    await client.query('COMMIT');
    if (removedDriveMedia) {
      const driveAccount = await getGoogleDriveAccount(removedDriveMedia.drive_account_id);
      await deleteGoogleDriveMedia(driveAccount, removedDriveMedia.drive_file_id);
    }
    return rows.length > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migratePostgresMediaToActiveDrive(limit = 10) {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL media storage is unavailable.');
  const driveAccounts = await getDriveAccountsForUpload();
  if (!driveAccounts.length) throw new Error('Configure and verify a Google Drive account before migrating media.');

  const boundedLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const { rows } = await pool.query(
    `SELECT m.id, m.data, m.content_type, m.original_filename, m.size_bytes, m.sha256,
            COALESCE(
              (SELECT split_part(a.storage_path, '/', 3)
               FROM system_media_aliases a
               WHERE a.media_id = m.id AND a.storage_path LIKE '/upload/%'
               ORDER BY a.storage_path
               LIMIT 1),
              m.purpose
            ) AS folder_key
     FROM system_media m
     WHERE m.storage_backend = 'postgres' AND m.data IS NOT NULL
     ORDER BY m.created_at, m.id
     LIMIT $1`,
    [boundedLimit]
  );

  let migrated = 0;
  const failures = [];
  for (const media of rows) {
    let driveFile;
    try {
      const mediaBuffer = Buffer.from(media.data);
      if (mediaBuffer.length !== Number(media.size_bytes) ||
          crypto.createHash('sha256').update(mediaBuffer).digest('hex') !== media.sha256) {
        throw new Error('PostgreSQL source size or SHA-256 did not match its metadata.');
      }
      const aliasRows = await pool.query(
        `SELECT storage_path FROM system_media_aliases
         WHERE media_id = $1
         ORDER BY (storage_path LIKE '/api/%'), storage_path`,
        [media.id]
      );
      const storagePath = aliasRows.rows[0]?.storage_path;
      if (!storagePath) throw new Error('Media has no storage URL alias.');
      const folderPath = getDriveFolderPath(storagePath);
      let verified = false;
      for (const driveAccount of driveAccounts) {
        try {
          const candidate = await uploadGoogleDriveMedia(driveAccount, {
            mediaId: media.id,
            filename: path.basename(storagePath),
            contentType: media.content_type,
            buffer: mediaBuffer,
            folderPath
          });
          const remoteBuffer = await readGoogleDriveMedia(driveAccount, candidate.id);
          if (remoteBuffer.length !== mediaBuffer.length ||
              crypto.createHash('sha256').update(remoteBuffer).digest('hex') !== media.sha256) {
            await deleteGoogleDriveMedia(driveAccount, candidate.id);
            throw new Error('Google Drive copy size or SHA-256 did not match PostgreSQL source.');
          }
          driveFile = candidate;
          const updated = await pool.query(
            `UPDATE system_media
             SET storage_backend = 'google_drive', drive_file_id = $2, drive_account_id = $3
             WHERE id = $1 AND storage_backend = 'postgres' AND sha256 = $4`,
            [media.id, driveFile.id, driveAccount.id, media.sha256]
          );
          if (updated.rowCount !== 1) {
            await deleteGoogleDriveMedia(driveAccount, driveFile.id);
            driveFile = null;
            throw new Error('Media changed during migration; source data was retained.');
          }
          verified = true;
          break;
        } catch (error) {
          if (error.code !== 'DRIVE_STORAGE_FULL') throw error;
        }
      }
      if (!verified) throw new Error('All configured Google Drive accounts have reached their storage quota.');
      migrated += 1;
    } catch (error) {
      failures.push({ id: media.id, error: error.message });
    }
  }

  const { rows: remainingRows } = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM system_media
     WHERE storage_backend = 'postgres' AND data IS NOT NULL`
  );
  return { migrated, failed: failures.length, failures, remaining: remainingRows[0].count };
}

function pathExtension(filename) {
  return String(filename || '').match(/\.[a-zA-Z0-9]{1,12}$/)?.[0] || '';
}

export function parseMediaRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) return false;

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!suffixLength) return false;
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false;
  return { start, end: Math.min(end, size - 1) };
}

export function isMediaRequestAuthorized(req, metadata) {
  if (!metadata || metadata.review_status !== 'approved') return false;

  const purpose = String(metadata.purpose || 'general');
  if (purpose !== 'direct_message') return true;

  const userId = req.activeUser?.id;
  return Boolean(userId && metadata.owner_id && String(userId) === String(metadata.owner_id));
}

export async function streamStoredMedia(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const storagePath = normalizeMediaPath(req.originalUrl || req.path);
  if (!storagePath) return next();

  const pool = getPgPool();
  if (!pool) {
    return res.status(503).json({ error: 'MEDIA_STORAGE_UNAVAILABLE' });
  }

  let metadata;
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.content_type, m.original_filename, m.size_bytes, m.sha256, m.review_status,
              m.owner_id, m.purpose, m.storage_backend, m.drive_file_id, m.drive_account_id
       FROM system_media_aliases a
       JOIN system_media m ON m.id = a.media_id
       WHERE a.storage_path = $1`,
      [storagePath]
    );
    metadata = rows[0];
  } catch (error) {
    console.error('[MediaStorage] Could not look up stored media:', error.message);
    return res.status(503).json({ error: 'MEDIA_STORAGE_UNAVAILABLE' });
  }

  if (!metadata) return next();
  if (!isMediaRequestAuthorized(req, metadata)) {
    if (metadata.review_status === 'pending') {
      res.setHeader('Retry-After', '2');
      return res.status(425).json({ error: 'MEDIA_PROCESSING' });
    }
    return res.status(404).json({ error: 'MEDIA_NOT_AVAILABLE' });
  }

  const etag = `"${metadata.sha256}"`;
  res.setHeader('Content-Type', metadata.content_type || inferMediaType(metadata.original_filename));
  res.setHeader('Content-Length', metadata.size_bytes);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, ETag');

  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'HEAD') return res.end();

  const range = parseMediaRange(req.headers.range, Number(metadata.size_bytes));
  if (range === false) {
    res.setHeader('Content-Range', `bytes */${metadata.size_bytes}`);
    return res.status(416).end();
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? metadata.size_bytes - 1;
  const responseSize = end - start + 1;
  if (metadata.storage_backend === 'local') {
    const root = LOCAL_MEDIA_ROOTS[storagePath.startsWith('/upload/') ? '/upload/' : '/uploads/'];
    const relativePath = storagePath.replace(/^\/uploads?\//, '');
    const filePath = path.resolve(root, ...relativePath.split('/'));
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      return res.status(404).json({ error: 'MEDIA_NOT_AVAILABLE' });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'MEDIA_NOT_AVAILABLE' });
    if (req.method === 'HEAD') return res.end();
    const localStat = await fs.promises.stat(filePath);
    if (localStat.size !== Number(metadata.size_bytes)) {
      return res.status(409).json({ error: 'MEDIA_METADATA_MISMATCH' });
    }
    const localStart = range?.start ?? 0;
    const localEnd = range?.end ?? localStat.size - 1;
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${localStart}-${localEnd}/${localStat.size}`);
      res.setHeader('Content-Length', localEnd - localStart + 1);
    }
    fs.createReadStream(filePath, { start: localStart, end: localEnd }).pipe(res);
    return;
  }

  let driveAccount = null;
  if (metadata.storage_backend === 'google_drive') {
    try {
      driveAccount = await getGoogleDriveAccount(metadata.drive_account_id);
    } catch (error) {
      console.error('[MediaStorage] Could not load Google Drive account for media:', error.message);
      return res.status(503).end();
    }
  }
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${metadata.size_bytes}`);
    res.setHeader('Content-Length', responseSize);
  }

  for (let offset = start; offset <= end; offset += MEDIA_CHUNK_BYTES) {
    const length = Math.min(MEDIA_CHUNK_BYTES, end - offset + 1);
    let chunk;
    try {
      if (metadata.storage_backend === 'google_drive') {
        chunk = await downloadGoogleDriveMediaRange(
          driveAccount,
          metadata.drive_file_id,
          offset,
          length
        );
      } else {
        const { rows } = await pool.query(
          'SELECT substring(data FROM $2 FOR $3) AS chunk FROM system_media WHERE id = $1',
          [metadata.id, offset + 1, length]
        );
        chunk = rows[0]?.chunk;
      }
    } catch (error) {
      console.error('[MediaStorage] Could not read stored media chunk:', error.message);
      if (!res.headersSent) return res.status(503).end();
      res.destroy(error);
      return;
    }

    if (!chunk || chunk.length !== length) {
      const error = new Error('Stored media ended before its recorded size.');
      if (!res.headersSent) return res.status(500).end();
      res.destroy(error);
      return;
    }
    if (!res.write(chunk)) {
      await new Promise((resolve) => res.once('drain', resolve));
    }
  }
  res.end();
}
