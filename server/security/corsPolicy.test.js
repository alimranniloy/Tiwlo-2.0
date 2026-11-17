import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PLATFORM_CONFIG, getSubdomain } from '../config/platformConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

function extractCorsValidator({ nodeEnv, allowLocalhostCors, customDomains = ['shop.example.com'] }) {
  const startMarker = 'const LOCALHOST_ORIGIN_REGEX =';
  const endMarker = 'app.use(express.json(';
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Expected CORS block in server/server.js');
  const corsBlock = serverSource.slice(start, end);

  let capturedCorsOptions = null;
  const context = {
    URL,
    PLATFORM_CONFIG,
    getSubdomain,
    process: {
      env: {
        NODE_ENV: nodeEnv,
        ...(allowLocalhostCors !== undefined ? { ALLOW_LOCALHOST_CORS: allowLocalhostCors } : {})
      }
    },
    findActiveCustomDomain: async (hostname) => customDomains.includes(hostname),
    cors: (opts) => {
      capturedCorsOptions = opts;
      return opts;
    },
    app: {
      use: () => {}
    }
  };
  vm.runInNewContext(corsBlock, context);
  assert.ok(capturedCorsOptions && typeof capturedCorsOptions.origin === 'function');
  return (origin) => new Promise((resolve) => {
    capturedCorsOptions.origin(origin, (err, allowed) => {
      if (err) return resolve(false);
      resolve(Boolean(allowed));
    });
  });
}

test('production CORS blocks localhost/loopback origins while allowing managed and active custom domains', async () => {
  const checkOrigin = extractCorsValidator({ nodeEnv: 'production' });

  // Disallowed in production
  assert.equal(await checkOrigin('http://localhost:5173'), false);
  assert.equal(await checkOrigin('https://localhost:5173'), false);
  assert.equal(await checkOrigin('http://localhost:3000'), false);
  assert.equal(await checkOrigin('http://localhost:5000'), false);
  assert.equal(await checkOrigin('http://auth.localhost:5173'), false);
  assert.equal(await checkOrigin('http://127.0.0.1:5173'), false);
  assert.equal(await checkOrigin('http://10.0.2.2:5000'), false);
  assert.equal(await checkOrigin('null'), false);
  assert.equal(await checkOrigin('not-a-valid-url'), false);
  assert.equal(await checkOrigin('https://evil.example.net'), false);
  assert.equal(await checkOrigin(`http://${PLATFORM_CONFIG.primaryDomain}`), false);
  assert.equal(await checkOrigin('http://shop.example.com'), false);

  // Allowed in production (Cloudflare + Auto-SSL platform & custom domains)
  assert.equal(await checkOrigin(undefined), true);
  assert.equal(await checkOrigin(`https://${PLATFORM_CONFIG.primaryDomain}`), true);
  assert.equal(await checkOrigin(`https://auth.${PLATFORM_CONFIG.primaryDomain}`), true);
  assert.equal(await checkOrigin(`https://mystore.${PLATFORM_CONFIG.primaryDomain}`), true);
  assert.equal(await checkOrigin(`https://${PLATFORM_CONFIG.freeSubdomainDomain}`), true);
  assert.equal(await checkOrigin(`https://myprofile.${PLATFORM_CONFIG.freeSubdomainDomain}`), true);
  assert.equal(await checkOrigin('https://shop.example.com'), true);
});

test('ALLOW_LOCALHOST_CORS=true permits local testing against production mode', async () => {
  const checkOrigin = extractCorsValidator({ nodeEnv: 'production', allowLocalhostCors: 'true' });

  assert.equal(await checkOrigin('http://localhost:5173'), true);
  assert.equal(await checkOrigin('http://127.0.0.1:3000'), true);
  assert.equal(await checkOrigin('http://10.0.2.2:5000'), true);
  assert.equal(await checkOrigin('https://evil.example.net'), false);
});

test('development CORS permits localhost, loopback, and platform origins', async () => {
  const checkOrigin = extractCorsValidator({ nodeEnv: 'development' });

  assert.equal(await checkOrigin('http://localhost:5173'), true);
  assert.equal(await checkOrigin('http://auth.localhost:5173'), true);
  assert.equal(await checkOrigin('http://127.0.0.1:5000'), true);
  assert.equal(await checkOrigin('http://10.0.2.2:5000'), true);
  assert.equal(await checkOrigin(`https://${PLATFORM_CONFIG.primaryDomain}`), true);
  assert.equal(await checkOrigin('https://shop.example.com'), true);
  assert.equal(await checkOrigin('https://evil.example.net'), false);
});
