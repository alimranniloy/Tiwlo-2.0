import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certsDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

export const certPath = path.join(certsDir, 'server.crt');
export const keyPath = path.join(certsDir, 'server.key');

export async function ensureCertificates() {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const cert = fs.readFileSync(certPath, 'utf8');
    const key = fs.readFileSync(keyPath, 'utf8');
    return { cert, key, certPath, keyPath };
  }

  console.log('Generating high-security SSL certificate for localhost & 127.0.0.1...');

  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'Tiwlo StockPro Technologies' }
  ];

  const options = {
    keySize: 2048,
    days: 825,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: 'localhost.localdomain' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' }
        ]
      }
    ]
  };

  const genFn = selfsigned.generate || selfsigned.default?.generate;
  const pems = await genFn(attrs, options);

  fs.writeFileSync(certPath, pems.cert, 'utf8');
  fs.writeFileSync(keyPath, pems.private, 'utf8');

  console.log('SSL Certificates generated successfully:');
  console.log(`  -> Certificate: ${certPath}`);
  console.log(`  -> Private Key: ${keyPath}`);

  return {
    cert: pems.cert,
    key: pems.private,
    certPath,
    keyPath
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureCertificates().catch((err) => {
    console.error('Error generating SSL cert:', err);
    process.exit(1);
  });
}
