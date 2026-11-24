import crypto from 'node:crypto';
import net from 'node:net';
import { formatIpv6SshCommand, normalizeIpv6, parseIpv6ToBigInt } from './ipv6PoolService.js';
import { formatGatewaySshCommand, resolvePublicSshGatewayHost } from './hostProvisionerClient.js';

export const DEFAULT_SSH_EXEC_TIMEOUT_MS = 10_000;
export const MAX_SSH_EXEC_TIMEOUT_MS = 60_000;
export const MAX_SSH_COMMAND_LENGTH = 32_768;
export const DEFAULT_MAX_OUTPUT_BYTES = 262_144;
export const UNAVAILABLE_IPV4_LABEL = 'Unavailable (IPv6-Only Node)';

function createGatewayError(message, statusCode = 400, code = 'SSH_GATEWAY_ERROR') {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function sanitizeOptionalHost(rawHost) {
  if (rawHost === null || rawHost === undefined) return null;
  const trimmed = String(rawHost).trim().replace(/^\[|\]$/g, '');
  if (!trimmed || trimmed.length > 253 || trimmed.startsWith('-')) {
    return null;
  }
  if (/[\s\0\r\n"'`;$&|<>/\\()={}]/.test(trimmed)) {
    return null;
  }
  if (net.isIP(trimmed) === 0 && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function isRestrictedSshTargetHost(host) {
  const lower = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!lower) return true;
  if (lower === 'localhost' || lower === 'localhost.localdomain' || lower === 'metadata.google.internal') {
    return true;
  }
  if (net.isIPv4(lower)) {
    const octets = lower.split('.').map(Number);
    if (octets[0] === 0 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254)) return true;
    if (lower === '100.100.100.200' || octets[0] >= 224) return true;
  }
  if (net.isIPv6(lower)) {
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('::ffff:')) {
      return isRestrictedSshTargetHost(lower.slice(7));
    }
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
      return true;
    }
  }
  return false;
}

function normalizeTargetHost(rawHost) {
  if (typeof rawHost !== 'string') {
    throw createGatewayError('targetHost must be a non-empty string.', 400, 'INVALID_TARGET_HOST');
  }
  let host = rawHost.trim();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1).trim();
  }
  if (!host || host.length > 255 || host.startsWith('-') || /[\s\0\r\n"'`;$&|<>/\\]/.test(host)) {
    throw createGatewayError('targetHost contains invalid characters or is empty.', 400, 'INVALID_TARGET_HOST');
  }
  if (net.isIP(host) === 0 && !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)) {
    throw createGatewayError(`Invalid targetHost "${rawHost}".`, 400, 'INVALID_TARGET_HOST');
  }
  if (isRestrictedSshTargetHost(host)) {
    throw createGatewayError(`SSH targetHost "${host}" cannot point to loopback or cloud metadata addresses.`, 400, 'INVALID_TARGET_HOST');
  }
  return host;
}

function normalizeSshPort(rawPort, fallback = 22) {
  if (rawPort === null || rawPort === undefined || rawPort === '') {
    return fallback;
  }
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw createGatewayError(`Invalid SSH port "${rawPort}". Must be an integer between 1 and 65535.`, 400, 'INVALID_SSH_PORT');
  }
  return parsed;
}

function normalizeSshUsername(rawUsername, fallback = 'root') {
  const raw = rawUsername === null || rawUsername === undefined ? fallback : String(rawUsername).trim();
  const value = raw || fallback;
  if (!value || value.length > 64 || !/^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,63}$/.test(value)) {
    throw createGatewayError(`Invalid SSH username "${rawUsername}".`, 400, 'INVALID_SSH_USERNAME');
  }
  return value;
}

export function sanitizeSshCommand(rawCommand) {
  if (typeof rawCommand !== 'string') {
    throw createGatewayError('SSH command must be a string.', 400, 'INVALID_SSH_COMMAND');
  }
  if (rawCommand.includes('\0') || /[\r\n]/.test(rawCommand)) {
    throw createGatewayError('SSH command must not contain null bytes or multi-line breaks.', 400, 'INVALID_SSH_COMMAND');
  }
  const trimmed = rawCommand.trim();
  if (!trimmed) {
    throw createGatewayError('SSH command must not be empty.', 400, 'INVALID_SSH_COMMAND');
  }
  if (trimmed.length > MAX_SSH_COMMAND_LENGTH) {
    throw createGatewayError(
      `SSH command exceeds maximum length of ${MAX_SSH_COMMAND_LENGTH} characters.`,
      400,
      'INVALID_SSH_COMMAND'
    );
  }
  return trimmed;
}

export function buildTenantDockerExecCommand(tenantSlug, command) {
  const cleanSlug = String(tenantSlug || '').trim();
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(cleanSlug)) {
    throw createGatewayError('Invalid tenantSlug for container sandbox execution.', 400, 'INVALID_TENANT_SLUG');
  }
  const cleanCommand = sanitizeSshCommand(command);
  const quoted = `'${cleanCommand.replace(/'/g, `'\"'\"'`)}'`;
  return `docker exec --user www-data tiwlo-tenant-${cleanSlug} sh -lc ${quoted}`;
}

/**
 * Returns true strictly for genuinely internet-routable IPv4 addresses.
 * Rejects unspecified (0.0.0.0/8), RFC1918 (10/8, 172.16/12, 192.168/16),
 * CGNAT (100.64/10), loopback (127/8), link-local (169.254/16), and
 * multicast/reserved/broadcast (>=224.0.0.0).
 */
export function isPublicRoutableIpv4(rawIp) {
  if (typeof rawIp !== 'string') return false;
  const ip = rawIp.trim();
  if (!ip || !net.isIPv4(ip)) return false;

  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }

  const [o0, o1] = octets;

  if (o0 === 0) return false; // 0.0.0.0/8 unspecified ("this network")
  if (o0 === 10) return false; // 10.0.0.0/8 RFC1918
  if (o0 === 100 && o1 >= 64 && o1 <= 127) return false; // 100.64.0.0/10 CGNAT
  if (o0 === 127) return false; // 127.0.0.0/8 loopback
  if (o0 === 169 && o1 === 254) return false; // 169.254.0.0/16 link-local
  if (o0 === 172 && o1 >= 16 && o1 <= 31) return false; // 172.16.0.0/12 RFC1918
  if (o0 === 192 && o1 === 168) return false; // 192.168.0.0/16 RFC1918
  if (o0 >= 224) return false; // 224.0.0.0+ multicast, reserved, broadcast

  return true;
}

/**
 * Returns true strictly for Global Unicast IPv6 host addresses (2000::/3),
 * rejecting loopback (::1), unspecified (::), link-local (fe80::/10),
 * ULA (fc00::/7), multicast (ff00::/8), IPv4-mapped (::ffff:0:0/96),
 * discard (100::/64), and CIDR network prefixes.
 */
export function isPublicRoutableIpv6(rawIp) {
  if (typeof rawIp !== 'string') return false;
  let candidate = rawIp.trim();
  if (!candidate || candidate.includes('/') || candidate.includes('%')) {
    return false;
  }
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    candidate = candidate.slice(1, -1).trim();
  }
  if (!net.isIPv6(candidate)) {
    return false;
  }

  try {
    const { value, prefixLen } = parseIpv6ToBigInt(candidate);
    if (prefixLen !== null && prefixLen !== 128) return false;
    if (value === 0n || value === 1n) return false;

    // Must fall inside Global Unicast 2000::/3 (top 3 bits == 001).
    if ((value >> 125n) !== 1n) {
      return false;
    }

    // Explicitly double-check non-routable / special scopes.
    const topByte = Number(value >> 120n);
    if (topByte === 0xff) return false; // multicast
    if ((value >> 121n) === 0x7en) return false; // fc00::/7 ULA
    if ((value >> 118n) === 0x3fan) return false; // fe80::/10 link-local
    if ((value >> 64n) === 0x0100_0000_0000_0000n) return false; // 100::/64 discard

    return true;
  } catch {
    return false;
  }
}

/**
 * Deterministically generates a valid RFC1918 Google-Cloud-style VPC Device/Internal IP
 * in 10.20.<octet3>.<octet4> (where octet3 and octet4 are in 1..254, never .0 or .255).
 */
export function allocateInternalDeviceIp(dropletId, seedIndex = null) {
  const cleanId = String(dropletId ?? '').trim();
  if (!cleanId) {
    throw createGatewayError('dropletId is required to allocate an internal VPC device IP.', 400, 'INVALID_DROPLET_ID');
  }

  const seedSuffix = seedIndex === null || seedIndex === undefined ? '' : `:${String(seedIndex)}`;
  const digest = crypto
    .createHash('sha256')
    .update(`tiwlo:vpc-internal-ip:v1:${cleanId}${seedSuffix}`)
    .digest();

  const octet3 = (digest.readUInt16BE(0) % 254) + 1;
  const octet4 = (digest.readUInt16BE(2) % 254) + 1;
  return `10.20.${octet3}.${octet4}`;
}

function isValidVpcDeviceIp(rawIp) {
  if (typeof rawIp !== 'string') return false;
  const ip = rawIp.trim();
  if (!net.isIPv4(ip)) return false;
  const parts = ip.split('.').map(Number);
  return (
    parts.length === 4 &&
    parts[0] === 10 &&
    parts[1] === 20 &&
    parts[2] >= 1 &&
    parts[2] <= 254 &&
    parts[3] >= 1 &&
    parts[3] <= 254
  );
}

function extractNodeIpv4Candidates(node) {
  if (!node || typeof node !== 'object') return [];
  const candidates = [];
  if (node.publicIpv4) candidates.push(node.publicIpv4);
  if (node.ipAddress) candidates.push(node.ipAddress);
  if (node.ip_address) candidates.push(node.ip_address);
  if (Array.isArray(node.networkAddresses?.ipv4)) {
    candidates.push(...node.networkAddresses.ipv4);
  }
  return Array.from(
    new Set(
      candidates
        .map((ip) => (typeof ip === 'string' ? ip.trim() : ''))
        .filter((ip) => ip && net.isIPv4(ip))
    )
  );
}

function resolveDropletIpv6(droplet) {
  if (!droplet || typeof droplet !== 'object') return null;
  const candidates = [
    droplet.ipv6,
    droplet.ipv6Address,
    droplet.ipv6_address,
    droplet.ip
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && isPublicRoutableIpv6(raw)) {
      return normalizeIpv6(raw);
    }
  }
  return null;
}

/**
 * Builds the canonical dual-stack network & SSH reachability profile for a droplet,
 * separating real public IPv4 vs private LAN IPv4, exposing dedicated /128 IPv6,
 * GCP-style 10.20.x.y internal VPC IP, and all SSH/relay/web-terminal fallbacks.
 */
export function buildDropletNetworkProfile({
  droplet = {},
  node = null,
  cloudflareRelayHost = process.env.TIWLO_SSH_RELAY_HOST || null,
  bastionHost = process.env.TIWLO_SSH_BASTION_HOST || null
} = {}) {
  const safeDroplet = droplet && typeof droplet === 'object' ? droplet : {};
  const username = normalizeSshUsername(
    safeDroplet.accessUsername ?? safeDroplet.access_username ?? safeDroplet.username,
    'root'
  );
  const sshPort = normalizeSshPort(safeDroplet.sshPort ?? safeDroplet.ssh_port, 22);

  const nodeIpv4Candidates = extractNodeIpv4Candidates(node);
  let publicIpv4 = nodeIpv4Candidates.find((ip) => isPublicRoutableIpv4(ip)) || null;

  // Only fall back to droplet-level public IPv4 when no node object was supplied.
  if (!publicIpv4 && !node) {
    const dropletV4Candidates = [safeDroplet.publicIpv4, safeDroplet.ip].filter(
      (ip) => typeof ip === 'string' && isPublicRoutableIpv4(ip)
    );
    publicIpv4 = dropletV4Candidates[0]?.trim() || null;
  }

  const nodePrivateIpv4 =
    nodeIpv4Candidates.find((ip) => !isPublicRoutableIpv4(ip) && !ip.startsWith('127.') && !ip.startsWith('0.')) || null;

  const publicIpv4Available = Boolean(publicIpv4);
  const sharedPublicIpv4 = publicIpv4Available && !safeDroplet.dedicatedPublicIpv4;
  const publicIpv4Label = publicIpv4Available ? publicIpv4 : UNAVAILABLE_IPV4_LABEL;

  const ipv6 = resolveDropletIpv6(safeDroplet);
  const publicIpv6Available = Boolean(ipv6);

  const existingInternal = safeDroplet.internalIp ?? safeDroplet.internal_ip ?? safeDroplet.vpcIp;
  const internalIp = isValidVpcDeviceIp(existingInternal)
    ? existingInternal.trim()
    : allocateInternalDeviceIp(safeDroplet.id || safeDroplet.dropletId || safeDroplet.name || 'droplet-default');

  const ipv4SshCommand = publicIpv4Available ? `ssh ${username}@${publicIpv4} -p ${sshPort}` : null;
  const ipv6SshCommand = publicIpv6Available ? formatIpv6SshCommand({ ipv6, username, port: sshPort }) : null;

  const rawGatewayUser = safeDroplet.sshGatewayUser ?? safeDroplet.ssh_gateway_user ?? null;
  const sshGatewayUser =
    typeof rawGatewayUser === 'string' && /^twvps_[a-z0-9_-]{2,26}$/i.test(rawGatewayUser.trim())
      ? rawGatewayUser.trim().toLowerCase()
      : null;
  const sshGatewayHost = resolvePublicSshGatewayHost({ node, droplet: safeDroplet });
  const sshGatewayCommand = sshGatewayUser
    ? formatGatewaySshCommand({ gatewayUser: sshGatewayUser, gatewayHost: sshGatewayHost })
    : null;

  const cleanBastionHost = sanitizeOptionalHost(bastionHost);
  const bastionTarget = publicIpv6Available ? `[${ipv6}]` : nodePrivateIpv4;
  const bastionProxyCommand =
    cleanBastionHost && bastionTarget ? `ssh -J ${cleanBastionHost} ${username}@${bastionTarget} -p ${sshPort}` : null;

  const cleanRelayHost = sanitizeOptionalHost(cloudflareRelayHost);
  const cloudflareAccessCommand = cleanRelayHost
    ? `ssh -o ProxyCommand="cloudflared access ssh --hostname ${cleanRelayHost}" ${username}@${cleanRelayHost} -p ${sshPort}`
    : null;

  const primarySshCommand =
    sshGatewayCommand || ipv4SshCommand || ipv6SshCommand || bastionProxyCommand || cloudflareAccessCommand || null;

  let connectivityMode = 'private-only';
  if (publicIpv4Available && publicIpv6Available) {
    connectivityMode = 'dual-stack';
  } else if (publicIpv4Available) {
    connectivityMode = 'ipv4-only';
  } else if (publicIpv6Available) {
    connectivityMode = 'ipv6-only';
  }

  return {
    dropletId: safeDroplet.id || safeDroplet.dropletId || null,
    username,
    sshPort,
    sshGatewayUser,
    sshGatewayHost,
    sshGatewayCommand,
    publicIpv4,
    publicIpv4Available,
    publicIpv4Label,
    sharedPublicIpv4,
    nodePrivateIpv4,
    ipv6,
    publicIpv6Available,
    internalIp,
    connectivityMode,
    relayRequiredForIpv4Clients: !publicIpv4Available,
    primarySshCommand,
    ipv4SshCommand,
    ipv6SshCommand,
    bastionProxyCommand,
    cloudflareAccessCommand,
    webTerminalSupported: true
  };
}

/**
 * Resolves the best server-side SSH dial target for WebSocket/HTTPS bridge execution.
 */
export function resolveDropletSshTarget({ droplet = {}, node = null, preferIpv6 = false } = {}) {
  const profile = buildDropletNetworkProfile({ droplet, node });
  if (preferIpv6 && profile.publicIpv6Available) {
    return {
      host: profile.ipv6,
      port: profile.sshPort,
      username: profile.username,
      family: 6
    };
  }
  if (profile.publicIpv4Available) {
    return {
      host: profile.publicIpv4,
      port: profile.sshPort,
      username: profile.username,
      family: 4
    };
  }
  if (profile.publicIpv6Available) {
    return {
      host: profile.ipv6,
      port: profile.sshPort,
      username: profile.username,
      family: 6
    };
  }
  if (profile.nodePrivateIpv4) {
    return {
      host: profile.nodePrivateIpv4,
      port: profile.sshPort,
      username: profile.username,
      family: 4
    };
  }
  throw createGatewayError('No reachable SSH target host found for droplet.', 400, 'NO_REACHABLE_SSH_TARGET');
}

async function openSshClientConnection({
  targetHost,
  sshPort,
  username,
  password,
  privateKey,
  timeoutMs,
  sshConnectFn
}) {
  const connectConfig = {
    host: targetHost,
    port: sshPort,
    username,
    readyTimeout: timeoutMs,
    ...(password ? { password: String(password) } : {}),
    ...(privateKey ? { privateKey: String(privateKey) } : {})
  };

  let client;
  if (typeof sshConnectFn === 'function') {
    client = await sshConnectFn(connectConfig);
    if (!client || typeof client.exec !== 'function') {
      throw createGatewayError('Injected sshConnectFn must return an ssh2-compatible Client.', 500, 'INVALID_SSH_CLIENT');
    }
  } else {
    const { Client } = await import('ssh2');
    client = new Client();
  }

  if (typeof client.connect !== 'function') {
    return client;
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      if (err) reject(err);
      else resolve();
    };

    const connectTimer = setTimeout(() => {
      try {
        client.end?.();
      } catch {}
      finish(
        createGatewayError(
          `SSH connection to ${targetHost}:${sshPort} timed out after ${timeoutMs}ms.`,
          504,
          'SSH_CONNECT_TIMEOUT'
        )
      );
    }, timeoutMs);

    client.once('ready', () => finish());
    client.once('error', (err) => {
      finish(
        createGatewayError(
          `SSH connection failed (${targetHost}:${sshPort}): ${err?.message || 'Unknown error'}`,
          502,
          'SSH_CONNECT_FAILED'
        )
      );
    });

    client.connect(connectConfig);
  });

  return client;
}

/**
 * Executes a bounded remote command over SSH using `ssh2` (or an injected `sshConnectFn`),
 * enforcing command sanitization, output caps, and a 10s default timeout.
 */
export async function executeDropletSshCommand({
  targetHost,
  sshPort = 22,
  username = 'root',
  password = null,
  privateKey = null,
  command,
  timeoutMs = DEFAULT_SSH_EXEC_TIMEOUT_MS,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  sshConnectFn = null
} = {}) {
  const cleanHost = normalizeTargetHost(targetHost);
  const cleanPort = normalizeSshPort(sshPort, 22);
  const cleanUser = normalizeSshUsername(username, 'root');
  const cleanCommand = sanitizeSshCommand(command);

  const boundedTimeout = Math.min(
    MAX_SSH_EXEC_TIMEOUT_MS,
    Math.max(50, Number(timeoutMs) || DEFAULT_SSH_EXEC_TIMEOUT_MS)
  );
  const outputCap = Math.max(1024, Number(maxOutputBytes) || DEFAULT_MAX_OUTPUT_BYTES);
  const startedAt = Date.now();

  const client = await openSshClientConnection({
    targetHost: cleanHost,
    sshPort: cleanPort,
    username: cleanUser,
    password,
    privateKey,
    timeoutMs: boundedTimeout,
    sshConnectFn
  });

  try {
    const result = await new Promise((resolve, reject) => {
      let settled = false;
      let stdoutChunks = [];
      let stderrChunks = [];
      let totalBytes = 0;
      let truncated = false;
      let activeStream = null;

      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(execTimer);
        if (err) reject(err);
        else resolve(value);
      };

      const execTimer = setTimeout(() => {
        try {
          activeStream?.close?.();
          activeStream?.destroy?.();
        } catch {}
        finish(
          createGatewayError(
            `SSH command timed out after ${boundedTimeout}ms on ${cleanHost}:${cleanPort}.`,
            504,
            'SSH_COMMAND_TIMEOUT'
          )
        );
      }, boundedTimeout);

      client.exec(cleanCommand, (err, stream) => {
        if (err) {
          return finish(
            createGatewayError(`SSH exec failed: ${err?.message || 'Unable to execute command'}`, 502, 'SSH_EXEC_FAILED')
          );
        }
        activeStream = stream;

        const appendChunk = (targetList, chunk) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ''), 'utf8');
          const remaining = outputCap - totalBytes;
          if (remaining <= 0) {
            truncated = true;
            return;
          }
          if (buf.length > remaining) {
            targetList.push(buf.subarray(0, remaining));
            totalBytes += remaining;
            truncated = true;
          } else {
            targetList.push(buf);
            totalBytes += buf.length;
          }
        };

        stream.on('data', (chunk) => appendChunk(stdoutChunks, chunk));
        stream.stderr?.on('data', (chunk) => appendChunk(stderrChunks, chunk));
        stream.once('error', (streamErr) => {
          finish(
            createGatewayError(
              `SSH stream error: ${streamErr?.message || 'Stream interrupted'}`,
              502,
              'SSH_STREAM_ERROR'
            )
          );
        });
        stream.once('close', (code, signal) => {
          const exitCode = Number.isInteger(Number(code)) ? Number(code) : 0;
          finish(null, {
            targetHost: cleanHost,
            sshPort: cleanPort,
            username: cleanUser,
            exitCode,
            code: exitCode,
            signal: signal || null,
            stdout: Buffer.concat(stdoutChunks).toString('utf8'),
            stderr: Buffer.concat(stderrChunks).toString('utf8'),
            truncated,
            durationMs: Date.now() - startedAt
          });
        });
      });
    });

    return result;
  } finally {
    try {
      client.end?.();
    } catch {}
  }
}

/**
 * Opens an interactive PTY shell bridge session over SSH, decoupled from WebSocket/HTTPS
 * transport so route handlers can pipe terminal frames cleanly.
 */
export async function createSshBridgeSession({
  targetHost,
  sshPort = 22,
  username = 'root',
  password = null,
  privateKey = null,
  cols = 120,
  rows = 32,
  term = 'xterm-256color',
  timeoutMs = DEFAULT_SSH_EXEC_TIMEOUT_MS,
  sshConnectFn = null
} = {}) {
  const cleanHost = normalizeTargetHost(targetHost);
  const cleanPort = normalizeSshPort(sshPort, 22);
  const cleanUser = normalizeSshUsername(username, 'root');
  const boundedTimeout = Math.min(
    MAX_SSH_EXEC_TIMEOUT_MS,
    Math.max(50, Number(timeoutMs) || DEFAULT_SSH_EXEC_TIMEOUT_MS)
  );
  const safeCols = Math.min(500, Math.max(20, Number.parseInt(cols, 10) || 120));
  const safeRows = Math.min(200, Math.max(5, Number.parseInt(rows, 10) || 32));
  const rawTerm = String(term || 'xterm-256color').trim();
  const safeTerm = /^[a-zA-Z0-9._-]{1,64}$/.test(rawTerm) ? rawTerm : 'xterm-256color';

  const client = await openSshClientConnection({
    targetHost: cleanHost,
    sshPort: cleanPort,
    username: cleanUser,
    password,
    privateKey,
    timeoutMs: boundedTimeout,
    sshConnectFn
  });

  const stream = await new Promise((resolve, reject) => {
    if (typeof client.shell !== 'function') {
      return reject(createGatewayError('SSH client does not support interactive shell sessions.', 500, 'SSH_SHELL_UNSUPPORTED'));
    }
    client.shell({ term: safeTerm, cols: safeCols, rows: safeRows }, (err, shellStream) => {
      if (err) {
        return reject(createGatewayError(`Unable to open SSH PTY shell: ${err?.message || 'Shell error'}`, 502, 'SSH_SHELL_FAILED'));
      }
      resolve(shellStream);
    });
  });

  return {
    targetHost: cleanHost,
    sshPort: cleanPort,
    username: cleanUser,
    write(input) {
      if (input !== undefined && input !== null) {
        stream.write(input);
      }
    },
    resize(nextCols, nextRows) {
      const c = Math.min(500, Math.max(20, Number.parseInt(nextCols, 10) || safeCols));
      const r = Math.min(200, Math.max(5, Number.parseInt(nextRows, 10) || safeRows));
      stream.setWindow?.(r, c, 0, 0);
    },
    onData(handler) {
      stream.on('data', handler);
      stream.stderr?.on('data', handler);
    },
    onClose(handler) {
      stream.on('close', handler);
    },
    onError(handler) {
      stream.on('error', handler);
    },
    close() {
      try {
        stream.end?.();
      } catch {}
      try {
        client.end?.();
      } catch {}
    }
  };
}

export const openDropletSshTerminal = createSshBridgeSession;
