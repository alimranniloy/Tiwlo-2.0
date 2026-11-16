import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(__dirname, '..');
const rootDir = resolve(serverDir, '..');

function ensureNodeModules(dir, label, omitDev = false) {
  const pkgPath = resolve(dir, 'package.json');
  const modulesPath = resolve(dir, 'node_modules');
  if (!existsSync(pkgPath)) return;
  if (!existsSync(modulesPath)) {
    console.log(`[Tiwlo Startup] Missing ${label} node_modules — installing automatically...`);
    const flag = omitDev ? ' --omit=dev' : '';
    execSync(`npm --prefix "${dir}" install${flag} --no-audit --no-fund`, {
      stdio: 'inherit'
    });
  }
}

try {
  ensureNodeModules(rootDir, 'root');
  ensureNodeModules(serverDir, 'server', process.env.NODE_ENV === 'production');

  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    console.warn('[Tiwlo Startup] Warning: ffmpeg not found in PATH. Liveness recordings will store raw WebM until ffmpeg is installed.');
  }
} catch (error) {
  console.error('[Tiwlo Startup] Dependency verification failed:', error.message);
  process.exit(1);
}
