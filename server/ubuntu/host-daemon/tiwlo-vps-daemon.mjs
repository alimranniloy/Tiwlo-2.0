import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { acceptWebSocketUpgrade } from './rfc6455.mjs';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.TIWLO_AGENT_PORT || '9443', 10) || 9443;
const SHARED_SECRET = String(
  process.env.TIWLO_INTERNAL_IDENTITY_SECRET || process.env.TIWLO_AGENT_TOKEN || ''
).trim();
const VPS_IMAGE = String(process.env.TIWLO_VPS_IMAGE || 'tiwlo-ubuntu-vps:24.04').trim();
const VPS_NETWORK = String(process.env.TIWLO_VPS_NETWORK || 'tiwlo-vps-net').trim();
const TENANTS_ROOT = path.resolve(process.env.TIWLO_TENANTS_ROOT || '/srv/tiwlo-tenants');
const REGISTRY_PATH = path.resolve(
  process.env.TIWLO_VPS_REGISTRY_PATH || '/var/lib/tiwlo-node/vps-registry.json'
);
const PTY_HELPER_PATH = String(
  process.env.TIWLO_PTY_HELPER_PATH || path.join(__dirname, 'pty-exec.py')
);

const SAFE_DROPLET_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;
const SAFE_TENANT_SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,47}$/;
const SAFE_GATEWAY_USER_RE = /^twvps_[a-z0-9_-]{2,26}$/;
const SAFE_LINUX_USER_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const SAFE_HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

export function sanitizeDropletId(raw) {
  const val = String(raw || '').trim();
  if (!SAFE_DROPLET_ID_RE.test(val)) {
    throw new Error('Invalid dropletId');
  }
  return val;
}

export function sanitizeTenantSlug(raw) {
  const val = String(raw || '').trim().toLowerCase();
  if (!SAFE_TENANT_SLUG_RE.test(val)) {
    throw new Error('Invalid tenantSlug');
  }
  return val;
}

export function sanitizeGatewayUser(raw) {
  const val = String(raw || '').trim().toLowerCase();
  if (!SAFE_GATEWAY_USER_RE.test(val)) {
    throw new Error('Invalid sshGatewayUser (must match twvps_*)');
  }
  return val;
}

export function sanitizeAccessUsername(raw) {
  const val = String(raw || 'root').trim().toLowerCase() || 'root';
  if (!SAFE_LINUX_USER_RE.test(val)) {
    throw new Error('Invalid accessUsername');
  }
  return val;
}

export function sanitizeContainerHostname(raw, fallback = 'tiwlo-vps') {
  const clean = String(raw || '').trim().toLowerCase().slice(0, 63);
  if (SAFE_HOSTNAME_RE.test(clean)) return clean;
  return fallback;
}

export function buildContainerName(dropletId) {
  return `tiwlo-vps-${sanitizeDropletId(dropletId)}`;
}

/**
 * Constant-time scrypt password verification matching server/db/cloud.js hashServerPassword format.
 */
export function verifyScryptPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || !plainPassword || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, derivedHex] = parts;
  if (!salt || !derivedHex || derivedHex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(derivedHex)) {
    return false;
  }
  try {
    const expectedBuf = Buffer.from(derivedHex, 'hex');
    const actualBuf = crypto.scryptSync(plainPassword, salt, expectedBuf.length);
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function buildDockerRunArgs(spec) {
  const dropletId = sanitizeDropletId(spec.dropletId);
  const tenantSlug = sanitizeTenantSlug(spec.tenantSlug);
  const containerName = buildContainerName(dropletId);
  const accessUsername = sanitizeAccessUsername(spec.accessUsername);
  const hostname = sanitizeContainerHostname(spec.hostname, tenantSlug.slice(0, 32));
  const ramMb = Math.min(262144, Math.max(128, Number.parseInt(spec.ramMb, 10) || 1024));
  const cpuLimit = Math.min(64, Math.max(0.25, Number(spec.cpuLimit) || 1));
  const tenantDir = path.join(TENANTS_ROOT, tenantSlug);

  return [
    'run',
    '-d',
    '--name',
    containerName,
    '--hostname',
    hostname,
    '--restart',
    'unless-stopped',
    '--network',
    VPS_NETWORK,
    '--dns',
    '1.1.1.1',
    '--dns',
    '8.8.8.8',
    '--pids-limit=256',
    '--memory',
    `${ramMb}m`,
    '--memory-swap',
    `${ramMb}m`,
    '--cpus',
    String(cpuLimit),
    '--cap-drop=SYS_ADMIN',
    '--cap-drop=SYS_MODULE',
    '--cap-drop=SYS_PTRACE',
    '--cap-drop=SYS_RAWIO',
    '--cap-drop=NET_RAW',
    '--cap-drop=MKNOD',
    '--security-opt=no-new-privileges:true',
    '-e',
    `TIWLO_VPS_USER=${accessUsername}`,
    '-e',
    `TIWLO_VPS_HOSTNAME=${hostname}`,
    '-e',
    `TIWLO_VPS_INTERNAL_IP=${String(spec.internalIp || '10.20.0.10').replace(/[^0-9a-fA-F.:]/g, '')}`,
    '-v',
    `${path.join(tenantDir, 'root')}:/root:rw`,
    '-v',
    `${path.join(tenantDir, 'home')}:/home:rw`,
    '-v',
    `${path.join(tenantDir, 'srv')}:/srv:rw`,
    '-v',
    `${path.join(tenantDir, 'www')}:/var/www:rw`,
    '--label',
    'tiwlo.managed=vps',
    '--label',
    `tiwlo.droplet_id=${dropletId}`,
    '--label',
    `tiwlo.gateway_user=${sanitizeGatewayUser(spec.sshGatewayUser)}`,
    VPS_IMAGE
  ];
}

let registryLockChain = Promise.resolve();
function withRegistryLock(taskFn) {
  const next = registryLockChain.then(taskFn, taskFn);
  registryLockChain = next.catch(() => {});
  return next;
}

function loadRegistry() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.droplets && typeof parsed.droplets === 'object') {
      return parsed;
    }
  } catch {}
  return { version: 1, droplets: {} };
}

function saveRegistry(reg) {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true, mode: 0o700 });
  const tmpPath = `${REGISTRY_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(reg, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, REGISTRY_PATH);
}

function findDropletEntryByGatewayUser(reg, gatewayUser) {
  const cleanUser = sanitizeGatewayUser(gatewayUser);
  for (const entry of Object.values(reg.droplets || {})) {
    if (entry?.sshGatewayUser === cleanUser) {
      return entry;
    }
  }
  return null;
}

async function execCmd(bin, args, timeout = 30000) {
  return execFileAsync(bin, args, { timeout, maxBuffer: 1024 * 1024 });
}

async function ensureHostGatewayUser(gatewayUser, accessUsername) {
  const cleanGwUser = sanitizeGatewayUser(gatewayUser);
  await execCmd('groupadd', ['-f', 'tiwlo-vps-users']).catch(() => {});

  let userExists = false;
  try {
    await execCmd('id', ['-u', cleanGwUser]);
    userExists = true;
  } catch {
    userExists = false;
  }

  const loginShell = '/usr/local/bin/tiwlo-vps-login-shell';
  const shellToUse = fs.existsSync(loginShell) ? loginShell : '/bin/sh';

  if (!userExists) {
    await execCmd('useradd', [
      '--no-create-home',
      '--home-dir',
      '/nonexistent',
      '--shell',
      shellToUse,
      '--groups',
      'tiwlo-vps-users',
      '--comment',
      `Tiwlo VPS mux (${sanitizeAccessUsername(accessUsername)})`,
      cleanGwUser
    ]);
  } else {
    await execCmd('usermod', ['-a', '-G', 'tiwlo-vps-users', '-s', shellToUse, cleanGwUser]).catch(() => {});
  }
}

async function removeHostGatewayUser(gatewayUser) {
  const cleanGwUser = sanitizeGatewayUser(gatewayUser);
  await execCmd('pkill', ['-KILL', '-u', cleanGwUser]).catch(() => {});
  await execCmd('userdel', [cleanGwUser]).catch(() => {});
}

async function inspectContainer(containerName) {
  try {
    const { stdout } = await execCmd('docker', ['inspect', containerName]);
    const list = JSON.parse(stdout);
    return Array.isArray(list) && list[0] ? list[0] : null;
  } catch {
    return null;
  }
}

async function ensureTenantDirs(tenantSlug) {
  const tenantDir = path.join(TENANTS_ROOT, sanitizeTenantSlug(tenantSlug));
  for (const sub of ['root', 'home', 'srv', 'www']) {
    fs.mkdirSync(path.join(tenantDir, sub), { recursive: true, mode: 0o755 });
  }
  return tenantDir;
}

async function waitForContainerUserReady(containerName, accessUsername, timeoutMs = 4000) {
  const cleanUser = sanitizeAccessUsername(accessUsername);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await execCmd('docker', ['exec', containerName, 'id', '-u', cleanUser], 3000);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return false;
}

async function provisionDropletContainer(payload) {
  const dropletId = sanitizeDropletId(payload.dropletId);
  const tenantSlug = sanitizeTenantSlug(payload.tenantSlug);
  const sshGatewayUser = sanitizeGatewayUser(payload.sshGatewayUser);
  const accessUsername = sanitizeAccessUsername(payload.accessUsername);
  const hostname = sanitizeContainerHostname(payload.hostname || tenantSlug, tenantSlug);
  const status = String(payload.status || 'active').trim().toLowerCase();
  const ramMb = Math.min(262144, Math.max(128, Number.parseInt(payload.ramMb, 10) || 1024));
  const cpuLimit = Math.min(64, Math.max(0.25, Number(payload.cpuLimit) || 1));
  const storageGb = Math.max(1, Number.parseInt(payload.storageGb, 10) || 10);
  const internalIp = String(payload.internalIp || '10.20.0.10').trim();
  const accessPasswordHash = typeof payload.accessPasswordHash === 'string' ? payload.accessPasswordHash : null;

  await ensureTenantDirs(tenantSlug);
  await ensureHostGatewayUser(sshGatewayUser, accessUsername);

  await withRegistryLock(() => {
    const reg = loadRegistry();
    const existingEntry = reg.droplets[dropletId] || {};
    const entry = {
      dropletId,
      tenantSlug,
      hostname,
      sshGatewayUser,
      accessUsername,
      accessPasswordHash: accessPasswordHash || existingEntry.accessPasswordHash || null,
      status,
      containerName: buildContainerName(dropletId),
      ramMb,
      cpuLimit,
      storageGb,
      internalIp,
      updatedAt: new Date().toISOString()
    };
    reg.droplets[dropletId] = entry;
    saveRegistry(reg);
  });

  const entry = loadRegistry().droplets[dropletId];

  const containerName = entry.containerName;
  let inspected = await inspectContainer(containerName);
  const imageMismatch = inspected && inspected.Config?.Image !== VPS_IMAGE;

  if (!inspected || imageMismatch) {
    if (inspected) {
      await execCmd('docker', ['rm', '-f', containerName], 20000).catch(() => {});
    }
    const args = buildDockerRunArgs(entry);
    await execCmd('docker', args, 45000);
    inspected = await inspectContainer(containerName);
  }

  const currentlyRunning = Boolean(inspected?.State?.Running);
  if (status === 'active' && !currentlyRunning) {
    await execCmd('docker', ['start', containerName], 20000);
    inspected = await inspectContainer(containerName);
  } else if (status !== 'active' && currentlyRunning) {
    await execCmd('docker', ['stop', '-t', '3', containerName], 20000);
    await execCmd('pkill', ['-KILL', '-u', sshGatewayUser]).catch(() => {});
    inspected = await inspectContainer(containerName);
  }

  if (status === 'active') {
    await waitForContainerUserReady(containerName, accessUsername);
  }

  return {
    ok: true,
    dropletId,
    containerName,
    sshGatewayUser,
    accessUsername,
    status,
    running: Boolean(inspected?.State?.Running),
    containerId: inspected?.Id ? String(inspected.Id).slice(0, 12) : null
  };
}

async function setDropletPower(dropletId, action) {
  const cleanId = sanitizeDropletId(dropletId);
  const cleanAction = String(action || '').trim().toLowerCase();
  if (!['start', 'stop', 'restart', 'suspend'].includes(cleanAction)) {
    throw new Error('Action must be start, stop, restart, or suspend');
  }
  const newStatus = cleanAction === 'stop' ? 'stopped' : cleanAction === 'suspend' ? 'suspended' : 'active';
  const entry = await withRegistryLock(() => {
    const reg = loadRegistry();
    const existing = reg.droplets[cleanId];
    if (existing) {
      existing.status = newStatus;
      existing.updatedAt = new Date().toISOString();
      saveRegistry(reg);
    }
    return existing || null;
  });
  const containerName = entry?.containerName || buildContainerName(cleanId);

  const inspected = await inspectContainer(containerName);
  if (!inspected) {
    if (entry && newStatus === 'active') {
      return provisionDropletContainer({ ...entry, status: 'active' });
    }
    return { ok: true, dropletId: cleanId, containerName, status: newStatus, running: false, missing: true };
  }

  if (cleanAction === 'start') {
    await execCmd('docker', ['start', containerName], 20000);
  } else if (cleanAction === 'restart') {
    await execCmd('docker', ['restart', '-t', '3', containerName], 25000);
  } else {
    await execCmd('docker', ['stop', '-t', '3', containerName], 20000);
    if (entry?.sshGatewayUser) {
      await execCmd('pkill', ['-KILL', '-u', entry.sshGatewayUser]).catch(() => {});
    }
  }

  const updated = await inspectContainer(containerName);
  if (newStatus === 'active' && entry?.accessUsername) {
    await waitForContainerUserReady(containerName, entry.accessUsername);
  }

  return {
    ok: true,
    dropletId: cleanId,
    containerName,
    status: newStatus,
    running: Boolean(updated?.State?.Running)
  };
}

async function destroyDropletContainer(dropletId, payload = {}) {
  const cleanId = sanitizeDropletId(dropletId);
  const reg = loadRegistry();
  const entry = reg.droplets[cleanId];
  const containerName = entry?.containerName || buildContainerName(cleanId);
  const gatewayUser = entry?.sshGatewayUser || (payload.sshGatewayUser ? sanitizeGatewayUser(payload.sshGatewayUser) : null);
  const tenantSlug = entry?.tenantSlug || (payload.tenantSlug ? sanitizeTenantSlug(payload.tenantSlug) : null);

  await execCmd('docker', ['rm', '-f', containerName], 20000).catch(() => {});
  if (gatewayUser) {
    await removeHostGatewayUser(gatewayUser);
  }
  if (tenantSlug) {
    const dir = path.join(TENANTS_ROOT, tenantSlug);
    if (dir.startsWith(`${TENANTS_ROOT}${path.sep}`)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  await withRegistryLock(() => {
    const reg = loadRegistry();
    if (reg.droplets[cleanId]) {
      delete reg.droplets[cleanId];
      saveRegistry(reg);
    }
  });
  return { ok: true, dropletId: cleanId, destroyed: true };
}

async function getContainerStats(dropletId) {
  const cleanId = sanitizeDropletId(dropletId);
  const reg = loadRegistry();
  const entry = reg.droplets[cleanId];
  const containerName = entry?.containerName || buildContainerName(cleanId);
  const inspected = await inspectContainer(containerName);
  if (!inspected) {
    return { ok: false, dropletId: cleanId, running: false, status: 'missing' };
  }
  if (!inspected.State?.Running) {
    return { ok: true, dropletId: cleanId, running: false, status: 'stopped', cpuPercent: 0, memoryPercent: 0 };
  }
  try {
    const { stdout } = await execCmd(
      'docker',
      ['stats', '--no-stream', '--format', '{{json .}}', containerName],
      10000
    );
    const parsed = JSON.parse(stdout.trim().split('\n')[0] || '{}');
    const parsePct = (s) => {
      const n = Number.parseFloat(String(s || '0').replace('%', ''));
      return Number.isFinite(n) ? n : 0;
    };
    return {
      ok: true,
      dropletId: cleanId,
      running: true,
      status: 'running',
      cpuPercent: parsePct(parsed.CPUPerc),
      memoryPercent: parsePct(parsed.MemPerc),
      memoryUsage: parsed.MemUsage || null,
      netIo: parsed.NetIO || null,
      blockIo: parsed.BlockIO || null,
      pids: Number.parseInt(parsed.PIDs || '0', 10) || 0
    };
  } catch (err) {
    return { ok: true, dropletId: cleanId, running: true, status: 'running', error: err.message };
  }
}

function detectHostHardwareHealth() {
  const ipv4 = [];
  const ipv6 = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const iface of entries || []) {
      if (!iface || iface.internal) continue;
      const addr = String(iface.address || '').split('%')[0];
      if (!addr) continue;
      if (iface.family === 'IPv4') {
        if (!addr.startsWith('172.17.') && !addr.startsWith('172.30.') && !addr.startsWith('172.31.')) {
          ipv4.push(addr);
        }
      } else if (iface.family === 'IPv6' && !addr.startsWith('fe80:')) {
        ipv6.push(addr);
      }
    }
  }
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const ramGb = Math.max(1, Math.round(totalMem / 1024 ** 3));
  const ramFreeGb = Number((freeMem / 1024 ** 3).toFixed(1));
  const memPressurePct = totalMem > 0 ? Math.min(100, Math.round(((totalMem - freeMem) / totalMem) * 100)) : 0;
  let diskTotalGb = 20;
  let diskFreeGb = 10;
  let diskPressurePct = 50;
  try {
    const stats = fs.statfsSync('/');
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    if (totalBytes > 0) {
      diskTotalGb = Math.max(1, Math.round(totalBytes / 1024 ** 3));
      diskFreeGb = Number((freeBytes / 1024 ** 3).toFixed(1));
      diskPressurePct = Math.min(100, Math.round(((totalBytes - freeBytes) / totalBytes) * 100));
    }
  } catch {}

  const cpuCores = Math.max(1, os.cpus()?.length || 1);

  return {
    ok: true,
    hostname: os.hostname(),
    cpuCores,
    ramGb,
    ramFreeGb,
    memPressurePct,
    storageGb: diskTotalGb,
    storageTotalGb: diskTotalGb,
    storageFreeGb: diskFreeGb,
    diskPressurePct,
    loadPct: Math.min(100, Math.round(((os.loadavg()?.[0] || 0) / cpuCores) * 100)),
    networkAddresses: { ipv4, ipv6 },
    detectedOsId: 'ubuntu-24',
    vpsDaemonVersion: '1.0.0'
  };
}

function isAuthorized(authHeader) {
  if (!SHARED_SECRET || typeof authHeader !== 'string') return false;
  const expected = `Bearer ${SHARED_SECRET}`;
  const a = Buffer.from(authHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function readJsonBody(req, limitBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function isLoopbackRemoteAddress(addr) {
  const clean = String(addr || '').replace(/^::ffff:/, '');
  return clean === '127.0.0.1' || clean === '::1';
}

export function createVpsDaemonServer() {
  const server = http.createServer(async (req, res) => {
    try {
      if (!SHARED_SECRET) {
        return sendJson(res, 503, { ok: false, error: 'Host daemon secret not configured' });
      }
      if (!isAuthorized(req.headers.authorization)) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      }

      const urlObj = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      const pathname = urlObj.pathname;

      if (req.method === 'GET' && pathname === '/agent/v1/health') {
        const reg = loadRegistry();
        return sendJson(res, 200, {
          ...detectHostHardwareHealth(),
          registeredDroplets: Object.keys(reg.droplets || {}).length
        });
      }

      if (req.method === 'POST' && pathname === '/host/v1/ssh/verify-password') {
        if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
          return sendJson(res, 403, { ok: false, error: 'Loopback only' });
        }
        const body = await readJsonBody(req, 32768);
        const reg = loadRegistry();
        const entry = findDropletEntryByGatewayUser(reg, body.sshGatewayUser);
        if (!entry || entry.status !== 'active') {
          return sendJson(res, 403, { ok: false, error: 'Instance inactive or missing' });
        }
        if (!verifyScryptPassword(body.password, entry.accessPasswordHash)) {
          return sendJson(res, 401, { ok: false, error: 'Invalid credentials' });
        }
        return sendJson(res, 200, {
          ok: true,
          dropletId: entry.dropletId,
          containerName: entry.containerName,
          accessUsername: entry.accessUsername
        });
      }

      if (req.method === 'GET' && pathname === '/host/v1/ssh/resolve-user') {
        if (!isLoopbackRemoteAddress(req.socket?.remoteAddress)) {
          return sendJson(res, 403, { ok: false, error: 'Loopback only' });
        }
        const rawUser = urlObj.searchParams.get('user') || '';
        const reg = loadRegistry();
        const entry = findDropletEntryByGatewayUser(reg, rawUser);
        if (!entry) {
          return sendJson(res, 404, { ok: false, error: 'Unknown SSH gateway user' });
        }
        return sendJson(res, 200, {
          ok: true,
          dropletId: entry.dropletId,
          containerName: entry.containerName,
          accessUsername: entry.accessUsername,
          status: entry.status,
          hostname: entry.hostname
        });
      }

      if (req.method === 'POST' && pathname === '/host/v1/droplets/provision') {
        const body = await readJsonBody(req);
        const result = await provisionDropletContainer(body);
        return sendJson(res, 200, result);
      }

      if (req.method === 'POST' && pathname === '/host/v1/droplets/reconcile') {
        const body = await readJsonBody(req, 8 * 1024 * 1024);
        const list = Array.isArray(body?.droplets) ? body.droplets : [];
        const results = [];
        const errors = [];
        for (const item of list) {
          try {
            results.push(await provisionDropletContainer(item));
          } catch (err) {
            errors.push({ dropletId: item?.dropletId || null, error: err?.message || String(err) });
          }
        }
        return sendJson(res, 200, {
          ok: errors.length === 0,
          reconciled: results.length,
          started: results.filter((r) => r.running).length,
          stopped: results.filter((r) => !r.running).length,
          errors,
          results
        });
      }

      const powerMatch = pathname.match(/^\/host\/v1\/droplets\/([a-zA-Z0-9_-]+)\/power$/);
      if (req.method === 'POST' && powerMatch) {
        const body = await readJsonBody(req);
        const result = await setDropletPower(powerMatch[1], body.action);
        return sendJson(res, 200, result);
      }

      const destroyMatch = pathname.match(/^\/host\/v1\/droplets\/([a-zA-Z0-9_-]+)\/destroy$/);
      if (req.method === 'POST' && destroyMatch) {
        const body = await readJsonBody(req);
        const result = await destroyDropletContainer(destroyMatch[1], body);
        return sendJson(res, 200, result);
      }

      const statsMatch = pathname.match(/^\/host\/v1\/droplets\/([a-zA-Z0-9_-]+)\/stats$/);
      if (req.method === 'GET' && statsMatch) {
        const result = await getContainerStats(statsMatch[1]);
        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (err) {
      const code = Number.isInteger(err?.statusCode) ? err.statusCode : 400;
      return sendJson(res, code, { ok: false, error: err?.message || 'Host daemon error' });
    }
  });

  server.on('upgrade', async (req, socket, head) => {
    try {
      if (!SHARED_SECRET || !isAuthorized(req.headers.authorization)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      const urlObj = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      const termMatch = urlObj.pathname.match(/^\/host\/v1\/droplets\/([a-zA-Z0-9_-]+)\/terminal$/);
      if (!termMatch) {
        socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      const dropletId = sanitizeDropletId(termMatch[1]);
      const reg = loadRegistry();
      const entry = reg.droplets[dropletId];
      if (!entry || entry.status !== 'active') {
        socket.write('HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      const inspected = await inspectContainer(entry.containerName);
      if (!inspected?.State?.Running) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }

      const ws = acceptWebSocketUpgrade(req, socket, head);
      if (!ws) return;

      const cols = Math.min(500, Math.max(20, Number.parseInt(urlObj.searchParams.get('cols') || '120', 10) || 120));
      const rows = Math.min(200, Math.max(5, Number.parseInt(urlObj.searchParams.get('rows') || '32', 10) || 32));
      const proc = spawn(
        'python3',
        [PTY_HELPER_PATH, entry.containerName, sanitizeAccessUsername(entry.accessUsername), String(cols), String(rows)],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      let lineBuf = '';
      proc.stdout.on('data', (chunk) => {
        lineBuf += chunk.toString('utf8');
        let idx;
        while ((idx = lineBuf.indexOf('\n')) !== -1) {
          const rawLine = lineBuf.slice(0, idx).trim();
          lineBuf = lineBuf.slice(idx + 1);
          if (!rawLine) continue;
          try {
            const msg = JSON.parse(rawLine);
            if (msg.t === 'o' && typeof msg.d === 'string') {
              ws.sendText(JSON.stringify({ type: 'output', data: Buffer.from(msg.d, 'base64').toString('utf8') }));
            } else if (msg.t === 'e') {
              ws.sendText(JSON.stringify({ type: 'exit', code: msg.code ?? 0 }));
              ws.close(1000, 'Shell exited');
            }
          } catch {}
        }
      });

      proc.stderr.on('data', (chunk) => {
        ws.sendText(JSON.stringify({ type: 'output', data: chunk.toString('utf8') }));
      });

      ws.on('message', ({ data }) => {
        try {
          const text = typeof data === 'string' ? data : data.toString('utf8');
          const parsed = JSON.parse(text);
          if (parsed.type === 'input' && typeof parsed.data === 'string' && proc.stdin.writable) {
            proc.stdin.write(JSON.stringify({ t: 'i', d: Buffer.from(parsed.data, 'utf8').toString('base64') }) + '\n');
          } else if (parsed.type === 'resize' && proc.stdin.writable) {
            proc.stdin.write(JSON.stringify({ t: 'r', c: Number(parsed.cols) || 120, r2: Number(parsed.rows) || 32 }) + '\n');
          }
        } catch {}
      });

      const terminatePty = () => {
        try {
          if (proc.stdin.writable) proc.stdin.write(JSON.stringify({ t: 'k' }) + '\n');
        } catch {}
        setTimeout(() => {
          try { proc.kill('SIGKILL'); } catch {}
        }, 400);
      };

      ws.on('close', terminatePty);
      proc.on('exit', () => {
        if (!ws.isClosed) ws.close(1000, 'Terminal closed');
      });
    } catch {
      try { socket.destroy(); } catch {}
    }
  });

  return server;
}

export function resolveDaemonBindHosts() {
  const hosts = new Set(['127.0.0.1']);
  const explicit = String(process.env.TIWLO_DOCKER_BRIDGE_IP || '').trim();
  if (explicit) hosts.add(explicit);

  // Also bind Docker Compose platform bridge (br-*, excluding tenant br-tiwlovps) automatically
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (name === 'br-tiwlovps') continue;
    if (name === 'docker0' || name.startsWith('br-')) {
      for (const iface of entries || []) {
        if (iface.family === 'IPv4' && iface.address) {
          hosts.add(iface.address);
        }
      }
    }
  }
  return Array.from(hosts);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const bindHosts = resolveDaemonBindHosts();
  for (const host of bindHosts) {
    const srv = createVpsDaemonServer();
    srv.listen(PORT, host, () => {
      console.log(`[TiwloVpsDaemon] Listening on http://${host}:${PORT}`);
    });
  }
}
