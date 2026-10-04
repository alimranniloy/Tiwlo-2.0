import '../config/loadRootEnv.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { testPgConnection, getPgPool } from '../db/postgres.js';
import { inferMediaType, storeMedia } from '../db/mediaStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const roots = [
  { directory: path.resolve(__dirname, '../../upload'), urlPrefix: '/upload' },
  { directory: path.resolve(__dirname, '../uploads'), urlPrefix: '/uploads' },
];
const dryRun = process.argv.includes('--dry-run');
const deleteAfterVerify = process.argv.includes('--delete-after-verify');
let databaseConnected = false;

async function* walkFiles(directory) {
  let directoryStats;
  try {
    directoryStats = await fs.promises.lstat(directory);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (directoryStats.isSymbolicLink()) {
    throw new Error(`Upload roots must not be symbolic links: ${directory}`);
  }

  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links must be migrated explicitly: ${filePath}`);
    }
    if (entry.isDirectory()) {
      yield* walkFiles(filePath);
    } else if (entry.isFile()) {
      yield filePath;
    }
  }
}

async function main() {
  if (deleteAfterVerify && dryRun) {
    throw new Error('--delete-after-verify cannot be combined with --dry-run.');
  }
  if (!dryRun) {
    if (!(await testPgConnection())) {
      throw new Error('Could not connect to PostgreSQL and initialize the media schema.');
    }
    databaseConnected = true;
  }

  let fileCount = 0;
  let byteCount = 0;
  const migratedFiles = [];
  const failures = [];

  for (const root of roots) {
    for await (const filePath of walkFiles(root.directory)) {
      const relativePath = path.relative(root.directory, filePath).split(path.sep)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const storagePath = `${root.urlPrefix}/${relativePath}`;
      const aliases = root.urlPrefix === '/upload'
        ? [storagePath, `/api${storagePath}`]
        : [storagePath, `/api${storagePath}`];
      const stats = await fs.promises.stat(filePath);
      fileCount++;
      byteCount += stats.size;

      if (dryRun) continue;

      try {
        const buffer = await fs.promises.readFile(filePath);
        const contentType = inferMediaType(filePath);
        const stored = await storeMedia({
          aliases,
          buffer,
          contentType,
          originalFilename: path.basename(filePath),
          purpose: 'legacy_media_backfill',
          reviewStatus: contentType.startsWith('video/') ? 'pending' : 'approved',
        });
        const pool = getPgPool();
        const { rows } = await pool.query(
          `SELECT size_bytes, sha256
           FROM system_media
           WHERE id = $1`,
          [stored.id]
        );
        if (!rows[0] || Number(rows[0].size_bytes) !== stats.size || rows[0].sha256 !== stored.sha256) {
          throw new Error('Database verification did not match source size and SHA-256.');
        }
        migratedFiles.push(filePath);
      } catch (error) {
        failures.push({ filePath, error: error.message });
        console.error(`[MediaBackfill] Failed ${storagePath}:`, error.message);
      }

      if (fileCount % 100 === 0) {
        console.log(`[MediaBackfill] Examined ${fileCount} files (${byteCount} bytes).`);
      }
    }
  }

  if (dryRun) {
    console.log(`[MediaBackfill] Dry run: ${fileCount} files, ${byteCount} bytes; no files or database rows changed.`);
  } else {
    console.log(`[MediaBackfill] Verified ${migratedFiles.length}/${fileCount} files (${byteCount} bytes).`);
  }

  if (failures.length) {
    throw new Error(`${failures.length} media files failed to backfill. Original files were retained.`);
  }

  if (deleteAfterVerify) {
    for (const filePath of migratedFiles) {
      await fs.promises.unlink(filePath);
    }
    console.log('[MediaBackfill] Removed only source files whose database size and SHA-256 were verified.');
  }
}

main()
  .catch((error) => {
    console.error('[MediaBackfill] Aborted:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (databaseConnected) {
      const pool = getPgPool();
      if (pool) await pool.end();
    }
  });
