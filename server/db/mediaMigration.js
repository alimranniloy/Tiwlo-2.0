import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPgPool } from './postgres.js';
import {
  deleteGoogleDriveMedia,
  ensureGoogleDriveFolderPath,
  getDriveAccountsForUpload,
  getGoogleDriveAccount,
  getPlatformStorageSettings,
  readGoogleDriveMedia,
  setServerStorageActive
} from '../administrator/googleDriveStorage.js';
import {
  getMediaMetadata,
  inferMediaType,
  migratePostgresMediaToActiveDrive,
  normalizeMediaPath,
  readMediaBuffer,
  storeMedia
} from './mediaStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const roots = [
  { directory: path.resolve(__dirname, '../../upload'), urlPrefix: '/upload' },
  { directory: path.resolve(__dirname, '../uploads'), urlPrefix: '/uploads' }
];
async function* walkFiles(directory) {
  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Upload symlink must be reviewed manually: ${filename}`);
    if (entry.isDirectory()) yield* walkFiles(filename);
    else if (entry.isFile()) yield filename;
  }
}

async function countFiles(directory) {
  let count = 0;
  for await (const _filename of walkFiles(directory)) count += 1;
  return count;
}

async function removeInterruptedStagingFiles() {
  for (const root of roots) {
    for await (const filename of walkFiles(root.directory)) {
      if (/^\.tiwlo-staging-[0-9a-f-]{36}\.tmp$/i.test(path.basename(filename))) {
        await fs.promises.unlink(filename);
      }
    }
  }
}

function encodeRelativePath(root, filename) {
  return path.relative(root.directory, filename).split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function deterministicMediaId(storagePath, sha256) {
  return crypto.createHash('sha256').update(`${storagePath}\0${sha256}`).digest('hex');
}

async function setSyncState(status, values = {}) {
  const pool = getPgPool();
  await pool.query(
    `INSERT INTO system_storage_sync_state
       (id, direction, status, processed_files, total_files, failed_files, current_file,
        last_error, started_at, updated_at, completed_at)
     VALUES ('primary', $1::varchar, $2::varchar, $3, $6, $4, $7, $5,
             CASE WHEN $2::varchar = 'running' THEN CURRENT_TIMESTAMP ELSE NULL END,
             CURRENT_TIMESTAMP,
             CASE WHEN $2::varchar = 'complete' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT (id) DO UPDATE SET
       direction = COALESCE($1::varchar, system_storage_sync_state.direction),
       status = $2::varchar,
       processed_files = COALESCE($3, system_storage_sync_state.processed_files),
       failed_files = COALESCE($4, system_storage_sync_state.failed_files),
       last_error = $5,
       total_files = COALESCE($6, system_storage_sync_state.total_files),
       current_file = CASE WHEN $2::varchar = 'running' THEN $7 ELSE NULL END,
       started_at = CASE WHEN $2::varchar = 'running' AND system_storage_sync_state.status <> 'running'
                         THEN CURRENT_TIMESTAMP ELSE system_storage_sync_state.started_at END,
       updated_at = CURRENT_TIMESTAMP,
       completed_at = CASE WHEN $2::varchar = 'complete' THEN CURRENT_TIMESTAMP
                           WHEN $2::varchar = 'running' THEN NULL
                           ELSE system_storage_sync_state.completed_at END`,
    [
      values.direction || null,
      status,
      values.processedFiles ?? null,
      values.failedFiles ?? null,
      values.error || null,
      values.totalFiles ?? null,
      values.currentFile ?? null
    ]
  );
}

export async function getStorageSyncState() {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL storage state is unavailable.');
  const { rows } = await pool.query(
    `SELECT direction, status, processed_files, total_files, failed_files, current_file, last_error,
            started_at, updated_at, completed_at
     FROM system_storage_sync_state
     WHERE id = 'primary'`
  );
  return rows[0] || {
    direction: 'idle',
    status: 'idle',
    processed_files: 0,
    total_files: 0,
    failed_files: 0,
    current_file: null,
    last_error: null
  };
}

async function verifyDriveEntry(storagePath, expectedSize, expectedSha256) {
  const record = await getMediaMetadata(storagePath);
  if (!record || record.storage_backend !== 'google_drive') return false;
  if (Number(record.size_bytes) !== expectedSize || record.sha256 !== expectedSha256) return false;
  const remote = await readMediaBuffer(storagePath);
  if (!remote?.data) return false;
  return remote.data.length === expectedSize &&
    crypto.createHash('sha256').update(remote.data).digest('hex') === expectedSha256;
}

async function syncLocalFilesToDrive(processed) {
  const accounts = await getDriveAccountsForUpload();
  if (!accounts.length) throw new Error('No configured Google Drive account is available.');
  for (const account of accounts) {
    for (const root of roots) {
      await setSyncState('running', {
        processedFiles: processed.count,
        failedFiles: 0,
        currentFile: `Preparing folders under ${root.urlPrefix}`
      });
      const folderPaths = new Set();
      async function collectDirectories(directory, relative = []) {
        let entries;
        try {
          entries = await fs.promises.readdir(directory, { withFileTypes: true });
        } catch (error) {
          if (error.code === 'ENOENT') return;
          throw error;
        }
        for (const entry of entries) {
          if (entry.isSymbolicLink()) throw new Error(`Upload symlink must be reviewed manually: ${path.join(directory, entry.name)}`);
          if (!entry.isDirectory()) continue;
          const child = [...relative, entry.name];
          folderPaths.add(JSON.stringify(child));
          await collectDirectories(path.join(directory, entry.name), child);
        }
      }
      await collectDirectories(root.directory);
      for (const serializedPath of folderPaths) {
        const folderPath = JSON.parse(serializedPath);
        try {
          await ensureGoogleDriveFolderPath(
            account,
            root.urlPrefix === '/uploads/' ? ['uploads', ...folderPath] : folderPath
          );
        } catch (error) {
          if (error.code !== 'DRIVE_STORAGE_FULL') throw error;
        }
      }
      if (root.urlPrefix === '/uploads/') {
        try {
          await ensureGoogleDriveFolderPath(account, ['uploads']);
        } catch (error) {
          if (error.code !== 'DRIVE_STORAGE_FULL') throw error;
        }
      }
    }
  }

  for (const root of roots) {
    for await (const filename of walkFiles(root.directory)) {
      const relativePath = encodeRelativePath(root, filename);
      const storagePath = normalizeMediaPath(`${root.urlPrefix}/${relativePath}`);
      if (!storagePath) throw new Error(`Invalid managed media path: ${relativePath}`);
      const buffer = await fs.promises.readFile(filename);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      await setSyncState('running', {
        processedFiles: processed.count,
        failedFiles: 0,
        currentFile: storagePath
      });
      if (!(await verifyDriveEntry(storagePath, buffer.length, sha256))) {
        await storeMedia({
          aliases: [storagePath],
          buffer,
          contentType: inferMediaType(filename),
          originalFilename: path.basename(filename),
          purpose: 'storage_sync',
          reviewStatus: 'approved',
          mediaId: deterministicMediaId(storagePath, sha256)
        });
      }
      processed.count += 1;
      await setSyncState('running', {
        processedFiles: processed.count,
        failedFiles: 0,
        currentFile: storagePath
      });
    }
  }
}

async function migratePostgresRowsToDrive(processed) {
  const pool = getPgPool();
  while (true) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM system_media
       WHERE storage_backend = 'postgres' AND data IS NOT NULL`
    );
    if (!rows[0].count) return;
    const result = await migratePostgresMediaToActiveDrive(10);
    processed.count += result.migrated;
    if (result.failed) {
      throw new Error(result.failures[0]?.error || `${result.failed} PostgreSQL media item(s) failed verification.`);
    }
    if (!result.migrated) throw new Error('PostgreSQL media migration made no progress.');
    await setSyncState('running', {
      processedFiles: processed.count,
      failedFiles: 0,
      currentFile: 'Migrating PostgreSQL media records'
    });
  }
}

async function verifyAllDriveRows() {
  const pool = getPgPool();
  const { rows } = await pool.query(
    `SELECT id, drive_file_id, drive_account_id, size_bytes, sha256
     FROM system_media
     WHERE storage_backend = 'google_drive'`
  );
  for (const media of rows) {
    if (!media.drive_file_id || !media.drive_account_id) {
      throw new Error(`Drive media record ${media.id} has incomplete remote metadata.`);
    }
    const account = await getGoogleDriveAccount(media.drive_account_id);
    const remote = await readGoogleDriveMedia(account, media.drive_file_id);
    if (remote.length !== Number(media.size_bytes) ||
        crypto.createHash('sha256').update(remote).digest('hex') !== media.sha256) {
      throw new Error(`Drive media record ${media.id} failed final size/SHA-256 verification.`);
    }
  }
  const { rows: sourceRows } = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM system_media
     WHERE storage_backend <> 'google_drive'`
  );
  if (sourceRows[0].count > 0) {
    throw new Error(`${sourceRows[0].count} media record(s) remain on server storage and could not be synced to Drive.`);
  }
}

async function removeVerifiedLocalCopies() {
  const pool = getPgPool();
  for (const root of roots) {
    for await (const filename of walkFiles(root.directory)) {
      const storagePath = normalizeMediaPath(`${root.urlPrefix}/${encodeRelativePath(root, filename)}`);
      const record = await getMediaMetadata(storagePath);
      if (!record || record.storage_backend !== 'google_drive') {
        throw new Error(`Refusing to remove unverified or untracked local media: ${storagePath}`);
      }
      const bytes = await fs.promises.readFile(filename);
      const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== Number(record.size_bytes) || sha256 !== record.sha256) {
        throw new Error(`Refusing to remove changed local media: ${storagePath}`);
      }
      await fs.promises.unlink(filename);
    }
  }
  await pool.query(
    `UPDATE system_media
     SET data = NULL
     WHERE storage_backend = 'google_drive' AND data IS NOT NULL`
  );
}

async function syncDriveToServer(processed) {
  const pool = getPgPool();
  while (true) {
    const { rows } = await pool.query(
      `SELECT id, data, size_bytes, sha256, storage_backend, drive_file_id, drive_account_id
       FROM system_media
       WHERE storage_backend = 'google_drive'
          OR (storage_backend = 'postgres' AND data IS NOT NULL)
       ORDER BY created_at, id
       LIMIT 10`
    );
    if (!rows.length) break;
    let changed = false;
    for (const media of rows) {
      const aliasResult = await pool.query(
        `SELECT storage_path FROM system_media_aliases
         WHERE media_id = $1
         ORDER BY (storage_path LIKE '/api/%'), storage_path`,
        [media.id]
      );
      const aliases = aliasResult.rows
        .map(({ storage_path: storagePath }) => storagePath)
        .filter((storagePath) => !storagePath.startsWith('/api/'));
      if (!aliases.length) throw new Error(`Media ${media.id} has no URL aliases.`);
      await setSyncState('running', {
        processedFiles: processed.count,
        failedFiles: 0,
        currentFile: aliases[0]
      });
      let bytes;
      if (media.storage_backend === 'google_drive') {
        const remote = await readMediaBuffer(aliases[0]);
        bytes = remote?.data;
      } else {
        bytes = media.data && Buffer.from(media.data);
      }
      if (!bytes || bytes.length !== Number(media.size_bytes) ||
          crypto.createHash('sha256').update(bytes).digest('hex') !== media.sha256) {
        throw new Error(`Media ${media.id} failed source size/SHA-256 verification.`);
      }
      await writeLocalAlias(aliases[0], bytes, media.sha256);
      if (media.storage_backend !== 'local' || (media.drive_file_id && media.drive_account_id)) {
        await pool.query(
          `UPDATE system_media
           SET storage_backend = 'local', data = NULL
           WHERE id = $1`,
          [media.id]
        );
      }
      processed.count += 1;
      changed = true;
      await setSyncState('running', {
        processedFiles: processed.count,
        failedFiles: 0,
        currentFile: aliases[0]
      });
    }
    if (!changed) break;
  }

  const { rows: driveRows } = await pool.query(
    `SELECT id, drive_file_id, drive_account_id
     FROM system_media
     WHERE storage_backend = 'local' AND drive_file_id IS NOT NULL AND drive_account_id IS NOT NULL`
  );
  for (const media of driveRows) {
    const account = await getGoogleDriveAccount(media.drive_account_id);
    await deleteGoogleDriveMedia(account, media.drive_file_id);
    await pool.query(
      `UPDATE system_media SET drive_file_id = NULL, drive_account_id = NULL
       WHERE id = $1 AND storage_backend = 'local'`,
      [media.id]
    );
  }
  await setServerStorageActive('local');
}

async function writeLocalAlias(storagePath, bytes, sha256) {
  const segments = storagePath.split('/').slice(1);
  const rootPrefix = `/${segments.shift()}/`;
  const root = roots.find((candidate) => candidate.urlPrefix === rootPrefix);
  if (!root) throw new Error(`Unsupported server media path: ${storagePath}`);
  const targetPath = path.resolve(root.directory, ...segments);
  if (!targetPath.startsWith(`${root.directory}${path.sep}`)) {
    throw new Error(`Unsafe server media path: ${storagePath}`);
  }
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  try {
    const existing = await fs.promises.readFile(targetPath);
    if (existing.length === bytes.length &&
        crypto.createHash('sha256').update(existing).digest('hex') === sha256) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporaryPath = path.join(path.dirname(targetPath), `.tiwlo-staging-${crypto.randomUUID()}.tmp`);
  await fs.promises.writeFile(temporaryPath, bytes, { flag: 'wx' });
  const staged = await fs.promises.readFile(temporaryPath);
  if (crypto.createHash('sha256').update(staged).digest('hex') !== sha256) {
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw new Error(`Server media copy failed verification: ${storagePath}`);
  }
  await fs.promises.rename(temporaryPath, targetPath);
}

async function runSync(direction) {
  let lock;
  const processed = { count: 0 };
  let totalFiles = null;
  try {
    const pool = getPgPool();
    lock = await pool.connect();
    const { rows } = await lock.query('SELECT pg_try_advisory_lock(7277102401) AS locked');
    if (!rows[0].locked) return;
    await setSyncState('running', {
      direction,
      processedFiles: 0,
      failedFiles: 0,
      totalFiles: 0,
      currentFile: 'Scanning managed media files'
    });
    const localFiles = direction === 'to_drive'
      ? await Promise.all(roots.map((root) => countFiles(root.directory)))
      : [];
    const mediaQuery = direction === 'to_drive'
      ? `SELECT COUNT(*)::integer AS count
         FROM system_media
         WHERE storage_backend = 'postgres' AND data IS NOT NULL`
      : `SELECT COUNT(*)::integer AS count
         FROM system_media
         WHERE storage_backend = 'google_drive'
            OR (storage_backend = 'postgres' AND data IS NOT NULL)`;
    const { rows: mediaCount } = await pool.query(mediaQuery);
    totalFiles = direction === 'to_drive'
      ? localFiles.reduce((total, count) => total + count, 0) + mediaCount[0].count
      : mediaCount[0].count;
    await setSyncState('running', {
      direction,
      processedFiles: 0,
      totalFiles,
      failedFiles: 0,
      currentFile: totalFiles ? 'Preparing transfer' : 'No media files found'
    });
    await removeInterruptedStagingFiles();
    if (direction === 'to_drive') {
      const storage = await getPlatformStorageSettings();
      if (storage.backend !== 'google_drive') throw new Error('Activate a verified Google Drive account before starting sync.');
      await syncLocalFilesToDrive(processed);
      await migratePostgresRowsToDrive(processed);
      await setSyncState('running', {
        processedFiles: processed.count,
        totalFiles,
        failedFiles: 0,
        currentFile: 'Verifying Google Drive copies'
      });
      await verifyAllDriveRows();
      await setSyncState('running', {
        processedFiles: processed.count,
        totalFiles,
        failedFiles: 0,
        currentFile: 'Removing verified server copies'
      });
      await removeVerifiedLocalCopies();
    } else if (direction === 'to_server') {
      const storage = await getPlatformStorageSettings();
      if (!['local', 'postgres'].includes(storage.backend)) {
        throw new Error('Select server storage before starting transfer back from Drive.');
      }
      await syncDriveToServer(processed);
    } else {
      throw new Error('Unknown storage sync direction.');
    }
    await setSyncState('complete', {
      direction,
      processedFiles: processed.count,
      totalFiles,
      failedFiles: 0
    });
  } catch (error) {
    console.error(`[StorageSync] ${direction} failed; source copies were retained where not yet verified:`, error.message);
    try {
      await setSyncState('failed', {
        direction,
        processedFiles: processed.count,
        totalFiles,
        error: error.message,
        failedFiles: 1
      });
    } catch (stateError) {
      console.error('[StorageSync] Could not persist failure status:', stateError.message);
    }
  } finally {
    if (lock) {
      await lock.query('SELECT pg_advisory_unlock(7277102401)').catch(() => {});
      lock.release();
    }
  }
}

export async function startStorageSync(direction) {
  if (!['to_drive', 'to_server'].includes(direction)) throw new TypeError('Invalid storage sync direction.');
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO system_storage_sync_state
         (id, direction, status, processed_files, total_files, failed_files, current_file, last_error,
          started_at, updated_at, completed_at)
       VALUES ('primary', $1, 'running', 0, 0, 0, 'Scanning managed media files', NULL,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
       ON CONFLICT (id) DO UPDATE SET
         direction = EXCLUDED.direction,
         status = 'running',
         processed_files = 0,
         total_files = 0,
         failed_files = 0,
         current_file = EXCLUDED.current_file,
         last_error = NULL,
         started_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP,
         completed_at = NULL
       WHERE system_storage_sync_state.status <> 'running'
       RETURNING id`,
      [direction]
    );
    if (!rows.length) throw new Error('Another storage transfer is already running.');
    if (direction === 'to_server') {
      await client.query(
        `INSERT INTO system_platform_storage (id, backend, google_drive_account_id)
         VALUES ('primary', 'local', NULL)
         ON CONFLICT (id) DO UPDATE SET
           backend = 'local',
           google_drive_account_id = NULL,
           updated_at = CURRENT_TIMESTAMP`
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  void runSync(direction);
  return getStorageSyncState();
}

export async function resumeStorageSyncOnStartup() {
  const state = await getStorageSyncState();
  if (state.status === 'running' || state.status === 'failed') {
    void runSync(state.direction);
  }
}

export async function getStorageSyncStatus() {
  return getStorageSyncState();
}
