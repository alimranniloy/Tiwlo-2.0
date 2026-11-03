import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientPublic = path.join(__dirname, '..', 'public');
const serverPublic = path.join(__dirname, '..', '..', 'server', 'public');
const faviconPngPath = path.join(clientPublic, 'favicon.png');
const favicon32Path = path.join(clientPublic, 'favicon-32.png');

function createIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

for (const assetPath of [faviconPngPath, favicon32Path]) {
  if (!fs.existsSync(assetPath)) {
    throw new Error(`Missing favicon source asset: ${assetPath}`);
  }
}

const iconPng = fs.readFileSync(favicon32Path);
if (iconPng.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
  throw new Error(`${favicon32Path} is not a PNG image.`);
}

const width = iconPng.readUInt32BE(16);
const height = iconPng.readUInt32BE(20);
if (width !== height || width < 1 || width > 256) {
  throw new Error(`Expected a square favicon no larger than 256px; got ${width}x${height}.`);
}

fs.mkdirSync(serverPublic, { recursive: true });
const icoBuffer = createIco(iconPng, width);
fs.writeFileSync(path.join(clientPublic, 'favicon.ico'), icoBuffer);
fs.copyFileSync(faviconPngPath, path.join(clientPublic, 'apple-touch-icon.png'));
fs.writeFileSync(path.join(serverPublic, 'favicon.ico'), icoBuffer);

console.log('Generated Tiwlo favicon assets in client and server public directories.');
