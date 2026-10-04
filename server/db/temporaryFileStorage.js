import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const directories = new Set();
const mimeExtensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-m4v': '.m4v',
  'video/x-matroska': '.mkv',
};

export function createTemporaryFileStorage(prefix) {
  const safePrefix = String(prefix || 'upload').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'upload';
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `tiwlo-${safePrefix}-`));
  directories.add(directory);

  const cleanup = () => {
    for (const tempDirectory of directories) {
      try {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
      } catch (error) {
        console.error('[TemporaryMedia] Could not remove temporary upload directory:', error.message);
      }
    }
    directories.clear();
  };

  if (directories.size === 1) process.once('exit', cleanup);

  return {
    destination: (_req, _file, callback) => callback(null, directory),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12) ||
        mimeExtensions[file.mimetype] || '';
      callback(null, `${crypto.randomUUID()}${extension}`);
    },
  };
}
