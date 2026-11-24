import net from 'node:net';
import { connectWebSocketClient } from './host-daemon/rfc6455.mjs';

let testHandlerOverride = null;

/**
 * Allows unit tests to intercept host provisioner calls deterministically without a live Docker host daemon.
 */
export function setHostProvisionerTestHandler(handler) {
  testHandlerOverride = typeof handler === 'function' ? handler : null;
}

/**
 * Resolves a POSIX-safe SSH multiplexer username (`twvps_<slug>`, max 32 chars) for a droplet.
 */
export function buildSshGatewayUsername({ hostname = '', dropletId = '', existingUsers = null } = {}) {
  const cleanHost = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  const cleanIdSuffix = String(dropletId || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(-4);

  const taken = existingUsers instanceof Set
    ? existingUsers
    : Array.isArray(existingUsers)
      ? new Set(existingUsers.map((u) => String(u || '').toLowerCase()))
      : null;

  const base = (cleanHost || `vps${cleanIdSuffix || '01'}`).slice(0, 26);
  let candidate = `twvps_${base}`;
  if (!taken || !taken.has(candidate)) {
    return candidate.slice(0, 32);
  }

  const suffix = cleanIdSuffix || '01';
  candidate = `twvps_${base.slice(0, Math.max(1, 26 - suffix.length - 1))}-${suffix}`;
  if (!taken.has(candidate)) {
    return candidate.slice(0, 32);
  }

  for (let i = 2; i < 1000; i += 1) {
    const tag = `${suffix}${i}`;
    const nextCandidate = `twvps_${base.slice(0, Math.max(1, 26 - tag.length - 1))}-${tag}`;
    if (!taken.has(nextCandidate)) {
      return nextCandidate.slice(0, 32);
    }
  }
  return `twvps_${cleanIdSuffix || 'node'}_${Date.now().toString(36).slice(-4)}`.slice(0, 32);
}

export function resolveHostProvisionerConfig() {
  const explicitUrl = String(process.env.TIWLO_HOST_AGENT_URL || '').trim();
  const trustedGatewayIp = String(process.env.TIWLO_INBOUND_TRUSTED_IP || '').trim();
  const fallbackUrl =
    trustedGatewayIp && net.isIPv4(trustedGatewayIp)
      ? `http://${trustedGatewayIp}:9443`
      : 'http://host.docker.internal:9443';
  const baseUrl = (explicitUrl || fallbackUrl).replace(/\/+$/, '');
  const secret = String(
    process.env.TIWLO_INTERNAL_IDENTITY_SECRET || process.env.TIWLO_AGENT_TOKEN || ''
  ).trim();
  const useStubForTests =
    process.env.NODE_ENV === 'test' &&
    process.env.TIWLO_ENABLE_REAL_HOST_AGENT !== 'true' &&
    !testHandlerOverride;

  return {
    baseUrl,
    secret,
    configured: Boolean(baseUrl && secret),
    useStubForTests
  };
}

/**
 * Resolves the direct public SSH gateway endpoint reachable on Port 22 without per-user router ports.
 */
export function resolvePublicSshGatewayHost({ node = null, droplet = null } = {}) {
  const explicit = String(process.env.TIWLO_SSH_GATEWAY_HOST || '').trim().replace(/^\[|\]$/g, '');
  if (explicit) return explicit;

  const nodeV4Candidates = [
    node?.ipAddress,
    node?.ip_address,
    process.env.VITE_SERVER_IPV4
  ];
  for (const cand of nodeV4Candidates) {
    const clean = String(cand || '').trim();
    if (net.isIPv4(clean) && !clean.startsWith('10.') && !clean.startsWith('127.') && !clean.startsWith('192.168.') && !/^172\.(1[6-9]|2\d|3[0-1])\./.test(clean)) {
      return clean;
    }
  }

  const v6Candidates = [
    node?.ipv6Address,
    node?.ipv6_address,
    process.env.VITE_SERVER_IPV6,
    droplet?.ipv6
  ];
  for (const cand of v6Candidates) {
    const clean = String(cand || '').trim().replace(/^\[|\]$/g, '');
    if (net.isIPv6(clean) && !clean.startsWith('fe80:') && clean !== '::1') {
      return clean;
    }
  }
  return null;
}

export function formatGatewaySshCommand({ gatewayUser, gatewayHost } = {}) {
  const user = String(gatewayUser || '').trim();
  const host = String(gatewayHost || '').trim().replace(/^\[|\]$/g, '');
  if (!user || !host) return null;
  return `ssh ${user}@${host}`;
}

async function callHostAgentJson(method, path, payload = null, { timeoutMs = 35000, fetchFn = fetch } = {}) {
  const cfg = resolveHostProvisionerConfig();
  if (testHandlerOverride) {
    return await testHandlerOverride({ method, path, payload });
  }
  if (cfg.useStubForTests) {
    return {
      ok: true,
      stubbed: true,
      method,
      path,
      running: payload?.action !== 'stop' && payload?.status !== 'stopped' && payload?.status !== 'suspended'
    };
  }
  if (!cfg.secret) {
    const err = new Error('Host VPS daemon secret (TIWLO_INTERNAL_IDENTITY_SECRET) is not configured.');
    err.statusCode = 503;
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Host provisioner timeout')), timeoutMs);
  try {
    const res = await fetchFn(`${cfg.baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.secret}`,
        ...(payload ? { 'Content-Type': 'application/json' } : {})
      },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { error: text };
    }
    if (!res.ok || json.ok === false) {
      const err = new Error(json.error || `Host VPS provisioner failed (HTTP ${res.status})`);
      err.statusCode = res.status >= 500 ? 503 : res.status || 502;
      throw err;
    }
    return json;
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error('Timed out waiting for Ubuntu host container provisioner.');
      timeoutErr.statusCode = 504;
      throw timeoutErr;
    }
    if (!err.statusCode) {
      const connErr = new Error(`Ubuntu host VPS daemon unreachable: ${err?.message || 'connection refused'}`);
      connErr.statusCode = 503;
      throw connErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchHostNodeHealth(opts = {}) {
  return callHostAgentJson('GET', '/agent/v1/health', null, { timeoutMs: 5000, ...opts });
}

export async function provisionDropletOnHost(record, opts = {}) {
  return callHostAgentJson(
    'POST',
    '/host/v1/droplets/provision',
    {
      dropletId: record.dropletId,
      tenantSlug: record.tenantSlug,
      hostname: record.hostname,
      sshGatewayUser: record.sshGatewayUser,
      accessUsername: record.accessUsername || 'root',
      accessPasswordHash: record.accessPasswordHash || null,
      ramMb: Number(record.ramMb) || 1024,
      cpuLimit: Number(record.cpuLimit) || 1,
      storageGb: Number(record.storageGb) || 10,
      internalIp: record.internalIp || '10.20.0.10',
      status: record.status || 'active'
    },
    { timeoutMs: 45000, ...opts }
  );
}

export async function setDropletPowerOnHost(dropletId, action, opts = {}) {
  const cleanId = encodeURIComponent(String(dropletId || '').trim());
  return callHostAgentJson('POST', `/host/v1/droplets/${cleanId}/power`, { action }, { timeoutMs: 25000, ...opts });
}

export async function destroyDropletOnHost(dropletId, { sshGatewayUser = null, tenantSlug = null } = {}, opts = {}) {
  const cleanId = encodeURIComponent(String(dropletId || '').trim());
  return callHostAgentJson(
    'POST',
    `/host/v1/droplets/${cleanId}/destroy`,
    { sshGatewayUser, tenantSlug },
    { timeoutMs: 25000, ...opts }
  );
}

export async function reconcileDropletsOnHost(droplets = [], opts = {}) {
  return callHostAgentJson('POST', '/host/v1/droplets/reconcile', { droplets }, { timeoutMs: 90000, ...opts });
}

export async function getDropletStatsFromHost(dropletId, opts = {}) {
  const cleanId = encodeURIComponent(String(dropletId || '').trim());
  return callHostAgentJson('GET', `/host/v1/droplets/${cleanId}/stats`, null, { timeoutMs: 10000, ...opts });
}

export function resolveHostAgentHttpConfig() {
  const cfg = resolveHostProvisionerConfig();
  if (!cfg.secret) {
    throw Object.assign(new Error('Host daemon secret not configured'), { statusCode: 503 });
  }
  const parsed = new URL(cfg.baseUrl);
  return {
    baseUrl: cfg.baseUrl,
    secret: cfg.secret,
    hostname: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80),
    isTls: parsed.protocol === 'https:'
  };
}

function openHostDaemonWebSocket(pathAndQuery, { timeoutMs = 8000 } = {}) {
  const cfg = resolveHostAgentHttpConfig();
  const wsProto = cfg.isTls ? 'wss:' : 'ws:';
  const targetUrl = `${wsProto}//${cfg.hostname}:${cfg.port}${pathAndQuery}`;
  return connectWebSocketClient(targetUrl, {
    headers: {
      Authorization: `Bearer ${cfg.secret}`
    },
    timeoutMs
  });
}

export async function openHostDropletTerminalWs(dropletId, { cols = 120, rows = 32 } = {}) {
  const cleanId = encodeURIComponent(String(dropletId || '').trim());
  return openHostDaemonWebSocket(`/host/v1/droplets/${cleanId}/terminal?cols=${cols}&rows=${rows}`);
}

export async function openHostDropletSshBridgeWs(dropletId, { gatewayUser = '' } = {}) {
  const cleanId = encodeURIComponent(String(dropletId || '').trim());
  const qs = gatewayUser ? `?gatewayUser=${encodeURIComponent(String(gatewayUser).trim())}` : '';
  return openHostDaemonWebSocket(`/host/v1/droplets/${cleanId}/ssh-bridge${qs}`);
}

export async function openHostDropletTcpTunnelWs(dropletId, { port = 80 } = {}) {
  const cleanId = encodeURIComponent(String(dropletId || '').trim());
  const cleanPort = Number.parseInt(String(port || '80'), 10) || 80;
  return openHostDaemonWebSocket(`/host/v1/droplets/${cleanId}/tcp-tunnel?port=${cleanPort}`);
}
