import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crc]);
}

function createPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createPngChunk('IHDR', ihdr);

  // Scanlines with filter byte 0
  const scanlines = [];
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    scanlines.push(Buffer.from([0])); // filter none
    scanlines.push(rgbaBuffer.subarray(y * stride, (y + 1) * stride));
  }
  const rawData = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createPngChunk('IDAT', compressed);

  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw a beautiful 32x32 Tiwlo 3D isometric icon
function generateTiwloImage(size = 32) {
  const buf = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - size / 2;
      const dy = y - size / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Dark rounded background squircle
      const r = size * 0.44;
      const inBox = Math.abs(dx) <= r && Math.abs(dy) <= r;
      const cornerDist = Math.hypot(
        Math.max(0, Math.abs(dx) - (r - 4)),
        Math.max(0, Math.abs(dy) - (r - 4))
      );

      if (cornerDist <= 4) {
        // Background #0F172A
        buf[idx] = 15;     // R
        buf[idx + 1] = 23; // G
        buf[idx + 2] = 42; // B
        buf[idx + 3] = 255;// A

        // Isometric 3D Cube in center
        const isoY = dy + 1;
        const isoX = dx;

        // Top face
        if (isoY < 0 && Math.abs(isoX) <= 10 && isoY >= -8 + Math.abs(isoX) * 0.5) {
          // Electric blue #38BDF8 to #2563EB
          buf[idx] = 40;
          buf[idx + 1] = 160;
          buf[idx + 2] = 245;
        }
        // Left face
        else if (isoX < 0 && isoX >= -8 && isoY >= 0 && isoY <= 8 + isoX * 0.5) {
          // Rich royal blue #2563EB
          buf[idx] = 37;
          buf[idx + 1] = 99;
          buf[idx + 2] = 235;
        }
        // Right face
        else if (isoX >= 0 && isoX <= 8 && isoY >= 0 && isoY <= 8 - isoX * 0.5) {
          // Indigo violet #6366F1
          buf[idx] = 99;
          buf[idx + 1] = 102;
          buf[idx + 2] = 241;
        }
        // Center glowing nexus
        if (dist <= 2.2) {
          buf[idx] = 255;
          buf[idx + 1] = 255;
          buf[idx + 2] = 255;
        }
      } else {
        // Transparent
        buf[idx + 3] = 0;
      }
    }
  }
  return buf;
}

function createIco(pngBuffer, size = 32) {
  // ICO Header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(1, 4); // 1 image

  // Directory Entry (16 bytes)
  const dir = Buffer.alloc(16);
  dir.writeUInt8(size === 256 ? 0 : size, 0); // width
  dir.writeUInt8(size === 256 ? 0 : size, 1); // height
  dir.writeUInt8(0, 2); // colors
  dir.writeUInt8(0, 3); // reserved
  dir.writeUInt16LE(1, 4); // color planes
  dir.writeUInt16LE(32, 6); // bits per pixel
  dir.writeUInt32LE(pngBuffer.length, 8); // image size
  dir.writeUInt32LE(6 + 16, 12); // image offset

  return Buffer.concat([header, dir, pngBuffer]);
}

const clientPublic = path.join(__dirname, '..', 'public');
const serverPublic = path.join(__dirname, '..', '..', 'server', 'public');

if (!fs.existsSync(serverPublic)) {
  fs.mkdirSync(serverPublic, { recursive: true });
}

const raw32 = generateTiwloImage(32);
const png32 = createPng(32, 32, raw32);
const icoBuffer = createIco(png32, 32);

fs.writeFileSync(path.join(clientPublic, 'favicon.ico'), icoBuffer);
fs.writeFileSync(path.join(clientPublic, 'apple-touch-icon.png'), png32);
fs.writeFileSync(path.join(serverPublic, 'favicon.ico'), icoBuffer);

console.log('Successfully generated favicon.ico and apple-touch-icon.png in client and server!');
