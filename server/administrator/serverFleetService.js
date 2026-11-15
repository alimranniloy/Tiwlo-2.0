import crypto from 'node:crypto';
import net from 'node:net';
import { getPgPool, isPgActive, queryPg } from '../db/postgres.js';

const CREDENTIAL_AAD = Buffer.from('tiwlo-server-fleet-credentials-v1');
const HKDF_SALT = Buffer.from('tiwlo-server-fleet-hkdf-salt-v1');
const HKDF_INFO = Buffer.from('tiwlo-server-fleet-aes256gcm-v1');
const HMAC_INFO = Buffer.from('tiwlo-server-fleet-hmac-v1');

// In production, SECURITY_SECRET or SERVER_FLEET_SECRET (>= 32 chars) must be set
// so encrypted server credentials remain readable across process restarts.
// When unset in local dev or unit tests, an ephemeral runtime CSPRNG key is used.
const EPHEMERAL_RUNTIME_SECRET = crypto.randomBytes(32).toString('hex');

export const PANEL_TYPES = Object.freeze([
  'tiwlo_panel',
  'cpanel_whm',
  'kvm_hypervisor',
  'plesk',
  'directadmin',
  'docker_swarm',
  'kubernetes_node',
  'custom_panel'
]);

export const SERVER_ROLES = Object.freeze([
  'app_hosting',
  'cpanel_shared',
  'droplet_host',
  'database',
  'edge_proxy',
  'mail_relay'
]);

export const CONNECTIVITY_MODES = Object.freeze([
  'agent_ws',
  'http_health',
  'whm_api',
  'tiwlo_panel_rpc',
  'tcp_probe'
]);

export const AUTH_TYPES = Object.freeze([
  'whm_token',
  'tiwlo_agent_key',
  'ssh_key',
  'bearer_token',
  'mtls',
  'api_token'
]);

export const NODE_STATUSES = Object.freeze([
  'online',
  'degraded',
  'offline',
  'maintenance',
  'unknown'
]);

export const PANEL_BLUEPRINTS = Object.freeze({
  tiwlo_panel: Object.freeze({
    panelType: 'tiwlo_panel',
    label: 'Tiwlo Control Panel (TPanel)',
    category: 'control_panel',
    defaultApiPort: 9443,
    defaultSshPort: 22,
    defaultConnectivityMode: 'tiwlo_panel_rpc',
    requiredAuthType: 'tiwlo_agent_key',
    supportedAuthTypes: ['tiwlo_agent_key', 'mtls', 'bearer_token'],
    healthEndpointDefault: '/agent/v1/health',
    protocol: 'HTTPS / mTLS RPC (Port 9443) + WebSocket Telemetry Stream',
    howItWorks:
      'Runs the lightweight Tiwlo Panel Agent daemon on port 9443 over TLS/mTLS. Handles automated Nginx/Caddy vhost provisioning, Node.js/PHP app containers, Let\'s Encrypt SSL issuance, DNS synchronization, and real-time resource heartbeats.',
    provisioningCapabilities: [
      'multi_tenant_apps',
      'auto_ssl',
      'dns_sync',
      'file_manager_rpc',
      'database_provisioning',
      'realtime_metrics'
    ],
    setupSteps: [
      'Install tiwlo-agent on Ubuntu 24.04/Debian 12 target host.',
      'Open TCP port 9443 to the Tiwlo control-plane IP allowlist.',
      'Generate a Tiwlo Agent Key and paste it into credentials.',
      'Run Connectivity Probe to verify RPC handshake and heartbeat.'
    ]
  }),
  cpanel_whm: Object.freeze({
    panelType: 'cpanel_whm',
    label: 'cPanel & WHM Server',
    category: 'shared_hosting_panel',
    defaultApiPort: 2087,
    cpanelUserPort: 2083,
    defaultSshPort: 22,
    defaultConnectivityMode: 'whm_api',
    requiredAuthType: 'whm_token',
    supportedAuthTypes: ['whm_token', 'api_token'],
    healthEndpointDefault: '/json-api/version?api.version=1',
    protocol: 'WHM JSON-API v1 over HTTPS (Port 2087; cPanel End-User Port 2083)',
    howItWorks:
      'Connects directly to WHM API v1 on port 2087 using an encrypted WHM API Token (`Authorization: whm root:<token>`). Automates cPanel account creation (`createacct`), package upgrades, email mailboxes, AutoSSL, and MySQL database quotas while end-users sign into port 2083.',
    provisioningCapabilities: [
      'cpanel_accounts',
      'whm_packages',
      'autossl',
      'exim_mailboxes',
      'mysql_databases',
      'sso_session_urls'
    ],
    setupSteps: [
      'In WHM -> Development -> Manage API Tokens, create a scoped root/reseller token.',
      'Allow TCP 2087 (WHM API) and 2083 (cPanel SSO) through CSF/firewall.',
      'Store the WHM API Token and username in encrypted fleet credentials.',
      'Probe `/json-api/version?api.version=1` to confirm API authorization.'
    ]
  }),
  kvm_hypervisor: Object.freeze({
    panelType: 'kvm_hypervisor',
    label: 'KVM Droplet Hypervisor',
    category: 'compute_hypervisor',
    defaultApiPort: 22,
    defaultSshPort: 22,
    defaultConnectivityMode: 'tcp_probe',
    requiredAuthType: 'ssh_key',
    supportedAuthTypes: ['ssh_key', 'tiwlo_agent_key', 'mtls'],
    healthEndpointDefault: '',
    protocol: 'SSH / Libvirt QEMU-KVM Daemon (Port 22 / 16514 TLS)',
    howItWorks:
      'Bare-metal Linux host running QEMU/KVM + libvirt with cloud-init templates and ZFS/LVM thin-provisioned NVMe pools. Provisions isolated Tiwlo Droplet VMs, injects SSH keys, attaches private VPC bridges, and enforces vCPU/RAM/IOPS cgroups.',
    provisioningCapabilities: [
      'kvm_droplets',
      'cloud_init',
      'snapshots',
      'live_console_vnc',
      'vpc_bridging',
      'bandwidth_metering'
    ],
    setupSteps: [
      'Verify hardware virtualization (`/dev/kvm`) and libvirtd are active.',
      'Deploy the Tiwlo fleet Ed25519 SSH key or mTLS libvirt certificate.',
      'Configure `maxDroplets` and NVMe storage capacity for scheduler placement.',
      'Enable `autoProvisionEnabled` once connectivity probe passes.'
    ]
  }),
  plesk: Object.freeze({
    panelType: 'plesk',
    label: 'Plesk Obsidian Panel',
    category: 'shared_hosting_panel',
    defaultApiPort: 8443,
    defaultSshPort: 22,
    defaultConnectivityMode: 'http_health',
    requiredAuthType: 'api_token',
    supportedAuthTypes: ['api_token', 'bearer_token'],
    healthEndpointDefault: '/api/v2/server',
    protocol: 'Plesk REST API v2 over HTTPS (Port 8443)',
    howItWorks:
      'Integrates with Plesk Obsidian REST API v2 on port 8443 using `X-API-Key`. Provisions Windows/Linux subscriptions, ASP.NET/Node/WordPress Toolkits, and Let\'s Encrypt certificates.',
    provisioningCapabilities: [
      'plesk_subscriptions',
      'wordpress_toolkit',
      'autossl',
      'dns_zones',
      'mail_hosting'
    ],
    setupSteps: [
      'Generate a Plesk REST API key via `plesk bin secret_key -c`.',
      'Permit inbound TCP 8443 from the Tiwlo control plane.',
      'Verify `/api/v2/server` health probe.'
    ]
  }),
  directadmin: Object.freeze({
    panelType: 'directadmin',
    label: 'DirectAdmin Control Panel',
    category: 'shared_hosting_panel',
    defaultApiPort: 2222,
    defaultSshPort: 22,
    defaultConnectivityMode: 'http_health',
    requiredAuthType: 'api_token',
    supportedAuthTypes: ['api_token', 'bearer_token'],
    healthEndpointDefault: '/CMD_API_SHOW_SERVICES',
    protocol: 'DirectAdmin HTTP/JSON API over TLS (Port 2222)',
    howItWorks:
      'Communicates with DirectAdmin\'s lightweight C++ daemon on port 2222 using login keys. Manages reseller packages, OpenLiteSpeed/Nginx virtual hosts, and DKIM/SPF mail domains.',
    provisioningCapabilities: [
      'shared_accounts',
      'openlitespeed_vhosts',
      'autossl',
      'mail_domains'
    ],
    setupSteps: [
      'Create a restricted DirectAdmin Login Key with API permissions.',
      'Open TCP 2222 for control-plane health checks and provisioning.',
      'Save credentials and execute a connectivity probe.'
    ]
  }),
  docker_swarm: Object.freeze({
    panelType: 'docker_swarm',
    label: 'Docker Swarm Manager / Worker',
    category: 'container_orchestrator',
    defaultApiPort: 2376,
    defaultSshPort: 22,
    defaultConnectivityMode: 'http_health',
    requiredAuthType: 'mtls',
    supportedAuthTypes: ['mtls', 'ssh_key', 'bearer_token'],
    healthEndpointDefault: '/_ping',
    protocol: 'Docker Engine TLS API (Port 2376) / SSH Tunnel',
    howItWorks:
      'Connects to Docker Engine API over mutual TLS on port 2376. Schedules containerized storefronts, worker queues, and isolated Redis/PostgreSQL services across Swarm overlay networks.',
    provisioningCapabilities: [
      'docker_services',
      'overlay_networks',
      'rolling_deploys',
      'volume_snapshots'
    ],
    setupSteps: [
      'Configure Docker daemon TLS client-verify on port 2376.',
      'Upload mTLS client cert/key or SSH bastion key to fleet credentials.',
      'Verify `/_ping` returns OK.'
    ]
  }),
  kubernetes_node: Object.freeze({
    panelType: 'kubernetes_node',
    label: 'Kubernetes Cluster / Node',
    category: 'container_orchestrator',
    defaultApiPort: 6443,
    defaultSshPort: 22,
    defaultConnectivityMode: 'http_health',
    requiredAuthType: 'bearer_token',
    supportedAuthTypes: ['bearer_token', 'mtls'],
    healthEndpointDefault: '/readyz',
    protocol: 'Kubernetes API Server HTTPS (Port 6443)',
    howItWorks:
      'Interfaces with the Kubernetes control plane API on port 6443 via ServiceAccount Bearer Token or mTLS client certificate. Deploys tenant Helm releases, IngressRoute TLS rules, and HPA autoscaling.',
    provisioningCapabilities: [
      'k8s_namespaces',
      'helm_releases',
      'ingress_tls',
      'autoscaling'
    ],
    setupSteps: [
      'Create a scoped ServiceAccount token or kubeconfig client cert.',
      'Ensure control plane port 6443 is reachable over private VPN/allowlist.',
      'Probe `/readyz` to confirm API server readiness.'
    ]
  }),
  custom_panel: Object.freeze({
    panelType: 'custom_panel',
    label: 'Custom Stack / Bare-Metal Node',
    category: 'custom',
    defaultApiPort: 443,
    defaultSshPort: 22,
    defaultConnectivityMode: 'tcp_probe',
    requiredAuthType: 'api_token',
    supportedAuthTypes: ['api_token', 'bearer_token', 'ssh_key', 'mtls'],
    healthEndpointDefault: '/health',
    protocol: 'HTTPS Health Endpoint or TCP Socket Probe',
    howItWorks:
      'Flexible integration adapter for custom edge proxies, PostgreSQL primaries, or bespoke hosting stacks. Monitors reachability via TCP handshake or custom HTTPS `/health` probe.',
    provisioningCapabilities: [
      'custom_webhooks',
      'health_monitoring',
      'ssh_automation'
    ],
    setupSteps: [
      'Expose a health check port or `/health` endpoint.',
      'Configure optional API token or SSH key.',
      'Run Connectivity Probe to validate latency and status.'
    ]
  })
});

const memoryNodes = new Map();
const memoryLogs = [];
let memoryLogSeq = 1;
let pgSchemaReady = false;
let pgSchemaPromise = null;

const monitorState = {
  timer: null,
  running: false,
  intervalMs: 60000,
  batchLimit: 50,
  sweepCount: 0,
  isSweepInFlight: false,
  lastSweepAt: null,
  lastSweepSummary: null,
  lastSweepError: null
};

export function stopFleetConnectivityMonitor() {
  if (monitorState.timer) {
    clearInterval(monitorState.timer);
    monitorState.timer = null;
  }
  monitorState.running = false;
  return {
    running: false,
    intervalMs: monitorState.intervalMs,
    sweepCount: monitorState.sweepCount,
    lastSweepAt: monitorState.lastSweepAt
  };
}

export function resetInMemoryServerFleetForTests() {
  stopFleetConnectivityMonitor();
  memoryNodes.clear();
  memoryLogs.length = 0;
  memoryLogSeq = 1;
  monitorState.sweepCount = 0;
  monitorState.isSweepInFlight = false;
  monitorState.lastSweepAt = null;
  monitorState.lastSweepSummary = null;
  monitorState.lastSweepError = null;
}

function getSecretMaterial() {
  const configured = process.env.SERVER_FLEET_SECRET || process.env.SECURITY_SECRET || '';
  if (configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY_SECRET or SERVER_FLEET_SECRET (>= 32 chars) must be configured in production.');
  }
  return EPHEMERAL_RUNTIME_SECRET;
}

function deriveEncryptionKeys() {
  const secretBuf = Buffer.from(getSecretMaterial(), 'utf8');
  const encKey = Buffer.from(crypto.hkdfSync('sha256', secretBuf, HKDF_SALT, HKDF_INFO, 32));
  const hmacKey = Buffer.from(crypto.hkdfSync('sha256', secretBuf, HKDF_SALT, HMAC_INFO, 32));
  return { encKey, hmacKey };
}

function sanitizePlainValue(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value.replace(/\0/g, '').trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePlainValue(item));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      out[key] = sanitizePlainValue(val);
    }
    return out;
  }
  return value;
}

function makeValidationError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function buildCredentialHint(secretObj) {
  const token = String(secretObj.apiToken || secretObj.bearerToken || secretObj.whmToken || '').trim();
  if (token) {
    return token.length > 6 ? `tok:••••${token.slice(-4)}` : 'tok:••••';
  }
  const sshKey = String(secretObj.sshKey || '').trim();
  if (sshKey) {
    const clean = sshKey.replace(/\s+/g, '');
    return clean.length > 8 ? `ssh:••••${clean.slice(-4)}` : 'ssh:••••';
  }
  if (secretObj.mtlsCert || secretObj.mtlsKey) {
    return 'mtls:••••';
  }
  return 'cred:••••';
}

export function encryptServerCredentials(input) {
  if (!input || typeof input !== 'object') return null;
  const payload = {};
  const allowedKeys = ['apiToken', 'sshKey', 'whmUsername', 'mtlsCert', 'mtlsKey', 'bearerToken', 'whmToken', 'notes'];
  for (const key of allowedKeys) {
    if (typeof input[key] === 'string' && input[key].trim()) {
      payload[key] = input[key].replace(/\0/g, '').trim();
    }
  }
  if (Object.keys(payload).length === 0) return null;

  const { encKey, hmacKey } = deriveEncryptionKeys();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  cipher.setAAD(CREDENTIAL_AAD);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const hint = buildCredentialHint(payload);

  const core = `${iv.toString('hex')}.${authTag.toString('hex')}.${ciphertext.toString('hex')}.${hint}`;
  const mac = crypto.createHmac('sha256', hmacKey).update(core).digest('hex');

  return JSON.stringify({
    v: 1,
    iv: iv.toString('hex'),
    tag: authTag.toString('hex'),
    ct: ciphertext.toString('hex'),
    hint,
    mac
  });
}

export function decryptServerCredentials(serialized) {
  if (!serialized || typeof serialized !== 'string') return null;
  const parsed = JSON.parse(serialized);
  if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.ct || !parsed.mac) {
    throw new Error('Malformed server credential envelope.');
  }
  const { encKey, hmacKey } = deriveEncryptionKeys();
  const core = `${parsed.iv}.${parsed.tag}.${parsed.ct}.${parsed.hint || ''}`;
  const expectedMac = crypto.createHmac('sha256', hmacKey).update(core).digest('hex');
  const macBuf = Buffer.from(parsed.mac, 'hex');
  const expectedBuf = Buffer.from(expectedMac, 'hex');
  if (macBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(macBuf, expectedBuf)) {
    throw new Error('Credential integrity verification failed.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(parsed.iv, 'hex'));
  decipher.setAAD(CREDENTIAL_AAD);
  decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ct, 'hex')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function extractCredentialSummary(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return { hasCredentials: false, credentialHint: null };
  }
  try {
    const parsed = JSON.parse(ciphertext);
    return {
      hasCredentials: true,
      credentialHint: typeof parsed?.hint === 'string' ? parsed.hint : 'cred:••••'
    };
  } catch {
    return { hasCredentials: true, credentialHint: 'cred:••••' };
  }
}

const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  '100.100.100.200',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
  'fd00:ec2::254'
]);

function normalizeIpv4Candidate(rawIp) {
  const lower = String(rawIp || '').trim().toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice(7);
    if (net.isIPv4(mapped)) return mapped;
  }
  return net.isIPv4(lower) ? lower : null;
}

export function isBlockedMetadataOrSsrfIp(rawIp) {
  const ip = String(rawIp || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!ip) return false;
  if (BLOCKED_METADATA_HOSTS.has(ip)) return true;

  const v4 = normalizeIpv4Candidate(ip);
  if (v4) {
    const octets = v4.split('.').map(Number);
    // Block 169.254.0.0/16 (cloud metadata / link-local), 100.100.100.200 (Alibaba metadata),
    // 0.0.0.0/8 (unspecified), and 255.255.255.255 (broadcast).
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (v4 === '100.100.100.200') return true;
    if (octets[0] === 0) return true;
    if (v4 === '255.255.255.255') return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const noZone = ip.split('%')[0];
    if (noZone === '::' || noZone === '0:0:0:0:0:0:0:0') return true;
    if (noZone === 'fd00:ec2::254') return true;
    // Link-local fe80::/10
    if (/^fe[89ab][0-9a-f]:/i.test(noZone) || noZone.startsWith('fe80:')) return true;
  }

  return false;
}

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*\.?$/i;

function assertSafeHostname(rawHostname, label = 'hostname') {
  const clean = String(rawHostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!clean) throw makeValidationError(`${label} is required.`);
  if (BLOCKED_METADATA_HOSTS.has(clean) || isBlockedMetadataOrSsrfIp(clean)) {
    throw makeValidationError(`${label} cannot target restricted cloud metadata or link-local addresses.`);
  }
  if (net.isIP(clean)) return clean;
  if (!HOSTNAME_REGEX.test(clean)) {
    throw makeValidationError(`${label} must be a valid DNS hostname or IP address.`);
  }
  return clean.replace(/\.$/, '');
}

function assertSafeIpAddress(rawIp, label = 'ipAddress', { required = true } = {}) {
  const clean = String(rawIp || '').trim().replace(/^\[|\]$/g, '');
  if (!clean) {
    if (required) throw makeValidationError(`${label} is required.`);
    return null;
  }
  if (!net.isIP(clean)) {
    throw makeValidationError(`${label} must be a valid IPv4 or IPv6 address.`);
  }
  if (isBlockedMetadataOrSsrfIp(clean)) {
    throw makeValidationError(`${label} cannot target restricted cloud metadata or link-local addresses.`);
  }
  return clean;
}

function assertSafeEndpointUrl(rawUrl, label, { allowRelative = false } = {}) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return null;
  if (/[\r\n\0\s]/.test(clean)) {
    throw makeValidationError(`${label} contains invalid characters.`);
  }
  if (allowRelative && clean.startsWith('/')) {
    if (clean.startsWith('//')) {
      throw makeValidationError(`${label} relative path cannot start with //.`)
    }
    return clean.slice(0, 512);
  }
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    throw makeValidationError(`${label} must be a valid http(s) URL${allowRelative ? ' or relative /path' : ''}.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw makeValidationError(`${label} must use http or https protocol.`);
  }
  if (parsed.username || parsed.password) {
    throw makeValidationError(`${label} cannot contain embedded credentials.`);
  }
  assertSafeHostname(parsed.hostname, label);
  return parsed.toString().slice(0, 512);
}

function parseIntInRange(value, fallback, min, max, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw makeValidationError(`${label} must be an integer between ${min} and ${max}.`);
  }
  return num;
}

function parseTags(rawTags) {
  if (rawTags === undefined || rawTags === null) return [];
  const arr = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags).split(/[,;|]/);
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const clean = String(item || '').trim().toLowerCase().slice(0, 48);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
    if (out.length >= 25) break;
  }
  return out;
}

function normalizeCapabilities(rawCaps, blueprint) {
  if (rawCaps && typeof rawCaps === 'object' && !Array.isArray(rawCaps)) {
    return sanitizePlainValue(rawCaps);
  }
  const defaults = {};
  for (const cap of blueprint?.provisioningCapabilities || []) {
    defaults[cap] = true;
  }
  return defaults;
}

function extractCredentialPayloadFromInput(input) {
  const nested = input.credentials && typeof input.credentials === 'object' ? input.credentials : {};
  return {
    apiToken: input.apiToken ?? input.api_token ?? nested.apiToken ?? nested.api_token,
    whmToken: input.whmToken ?? input.whm_token ?? nested.whmToken ?? nested.whm_token,
    whmUsername: input.whmUsername ?? input.whm_username ?? nested.whmUsername ?? nested.whm_username,
    bearerToken: input.bearerToken ?? input.bearer_token ?? nested.bearerToken ?? nested.bearer_token,
    sshKey: input.sshKey ?? input.ssh_key ?? nested.sshKey ?? nested.ssh_key,
    mtlsCert: input.mtlsCert ?? input.mtls_cert ?? nested.mtlsCert ?? nested.mtls_cert,
    mtlsKey: input.mtlsKey ?? input.mtls_key ?? nested.mtlsKey ?? nested.mtls_key,
    notes: input.credentialNotes ?? nested.notes
  };
}

function normalizeCreatePayload(rawInput = {}) {
  const input = sanitizePlainValue(rawInput || {});
  const name = String(input.name || '').trim();
  if (!name || name.length > 160) {
    throw makeValidationError('Server name is required and must be 160 characters or fewer.');
  }

  const panelType = String(input.panelType || input.panel_type || '').trim();
  if (!PANEL_TYPES.includes(panelType)) {
    throw makeValidationError(`panelType must be one of: ${PANEL_TYPES.join(', ')}.`);
  }
  const blueprint = PANEL_BLUEPRINTS[panelType];

  const serverRole = String(input.serverRole || input.server_role || 'app_hosting').trim();
  if (!SERVER_ROLES.includes(serverRole)) {
    throw makeValidationError(`serverRole must be one of: ${SERVER_ROLES.join(', ')}.`);
  }

  const hostname = assertSafeHostname(input.hostname, 'hostname');
  const ipAddress = assertSafeIpAddress(input.ipAddress ?? input.ip_address, 'ipAddress', { required: true });
  const ipv6Address = assertSafeIpAddress(input.ipv6Address ?? input.ipv6_address, 'ipv6Address', { required: false });

  const connectivityMode = String(
    input.connectivityMode || input.connectivity_mode || blueprint.defaultConnectivityMode || 'tcp_probe'
  ).trim();
  if (!CONNECTIVITY_MODES.includes(connectivityMode)) {
    throw makeValidationError(`connectivityMode must be one of: ${CONNECTIVITY_MODES.join(', ')}.`);
  }

  const authType = String(input.authType || input.auth_type || blueprint.requiredAuthType || 'api_token').trim();
  if (!AUTH_TYPES.includes(authType)) {
    throw makeValidationError(`authType must be one of: ${AUTH_TYPES.join(', ')}.`);
  }

  const status = String(input.status || 'unknown').trim();
  if (!NODE_STATUSES.includes(status)) {
    throw makeValidationError(`status must be one of: ${NODE_STATUSES.join(', ')}.`);
  }

  const apiPort = parseIntInRange(input.apiPort ?? input.api_port, blueprint.defaultApiPort, 1, 65535, 'apiPort');
  const sshPort = parseIntInRange(input.sshPort ?? input.ssh_port, blueprint.defaultSshPort || 22, 1, 65535, 'sshPort');
  const panelUrl = assertSafeEndpointUrl(input.panelUrl ?? input.panel_url, 'panelUrl', { allowRelative: false });
  const healthEndpoint = assertSafeEndpointUrl(
    input.healthEndpoint ?? input.health_endpoint ?? blueprint.healthEndpointDefault,
    'healthEndpoint',
    { allowRelative: true }
  );

  const region = String(input.region || 'sgp1').trim().toLowerCase().slice(0, 48) || 'sgp1';
  const datacenter = input.datacenter ? String(input.datacenter).trim().slice(0, 120) : null;
  const provider = input.provider ? String(input.provider).trim().slice(0, 120) : null;

  const cpuCores = parseIntInRange(input.cpuCores ?? input.cpu_cores, 8, 1, 2048, 'cpuCores');
  const ramGb = parseIntInRange(input.ramGb ?? input.ram_gb, 32, 1, 16384, 'ramGb');
  const storageGb = parseIntInRange(input.storageGb ?? input.storage_gb, 500, 1, 1000000, 'storageGb');
  const maxDroplets = parseIntInRange(input.maxDroplets ?? input.max_droplets, 50, 0, 100000, 'maxDroplets');
  const activeDroplets = parseIntInRange(input.activeDroplets ?? input.active_droplets, 0, 0, 100000, 'activeDroplets');
  const routingWeight = parseIntInRange(input.routingWeight ?? input.routing_weight, 100, 0, 10000, 'routingWeight');
  const autoProvisionEnabled = Boolean(input.autoProvisionEnabled ?? input.auto_provision_enabled ?? false);

  const howItWorks = String(input.howItWorks ?? input.how_it_works ?? blueprint.howItWorks ?? '').trim().slice(0, 4000);
  const tags = parseTags(input.tags);
  const capabilities = normalizeCapabilities(input.capabilities ?? input.capabilities_json, blueprint);

  const credInput = extractCredentialPayloadFromInput(input);
  const credentialsCiphertext = encryptServerCredentials(credInput);

  return {
    id: input.id && /^[a-zA-Z0-9_-]{3,80}$/.test(String(input.id))
      ? String(input.id)
      : `srv_${crypto.randomUUID().replace(/-/g, '')}`,
    name,
    hostname,
    ip_address: ipAddress,
    ipv6_address: ipv6Address,
    panel_type: panelType,
    server_role: serverRole,
    panel_url: panelUrl,
    api_port: apiPort,
    ssh_port: sshPort,
    health_endpoint: healthEndpoint,
    connectivity_mode: connectivityMode,
    region,
    datacenter,
    provider,
    cpu_cores: cpuCores,
    ram_gb: ramGb,
    storage_gb: storageGb,
    max_droplets: maxDroplets,
    active_droplets: activeDroplets,
    auto_provision_enabled: autoProvisionEnabled,
    routing_weight: routingWeight,
    auth_type: authType,
    credentials_ciphertext: credentialsCiphertext,
    capabilities_json: capabilities,
    how_it_works: howItWorks,
    tags,
    status
  };
}

function toSafeNodeDto(row) {
  if (!row) return null;
  const { hasCredentials, credentialHint } = extractCredentialSummary(row.credentials_ciphertext);
  const capabilities = typeof row.capabilities_json === 'string'
    ? (() => { try { return JSON.parse(row.capabilities_json); } catch { return {}; } })()
    : (row.capabilities_json && typeof row.capabilities_json === 'object' ? row.capabilities_json : {});

  return {
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    ipv6Address: row.ipv6_address || null,
    panelType: row.panel_type,
    serverRole: row.server_role,
    panelUrl: row.panel_url || null,
    apiPort: Number(row.api_port),
    sshPort: Number(row.ssh_port),
    healthEndpoint: row.health_endpoint || null,
    connectivityMode: row.connectivity_mode,
    region: row.region,
    datacenter: row.datacenter || null,
    provider: row.provider || null,
    cpuCores: Number(row.cpu_cores),
    ramGb: Number(row.ram_gb),
    storageGb: Number(row.storage_gb),
    maxDroplets: Number(row.max_droplets),
    activeDroplets: Number(row.active_droplets),
    autoProvisionEnabled: Boolean(row.auto_provision_enabled),
    routingWeight: Number(row.routing_weight),
    authType: row.auth_type,
    hasCredentials,
    credentialHint,
    capabilities,
    howItWorks: row.how_it_works || PANEL_BLUEPRINTS[row.panel_type]?.howItWorks || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    status: row.status,
    lastHeartbeatAt: row.last_heartbeat_at ? new Date(row.last_heartbeat_at).toISOString() : null,
    lastLatencyMs: row.last_latency_ms !== null && row.last_latency_ms !== undefined ? Number(row.last_latency_ms) : null,
    lastProbeError: row.last_probe_error || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    blueprint: PANEL_BLUEPRINTS[row.panel_type] || PANEL_BLUEPRINTS.custom_panel
  };
}

function toLogDto(row) {
  if (!row) return null;
  const details = typeof row.details === 'string'
    ? (() => { try { return JSON.parse(row.details); } catch { return {}; } })()
    : (row.details && typeof row.details === 'object' ? row.details : {});
  return {
    id: row.id,
    nodeId: row.node_id,
    eventType: row.event_type,
    status: row.status,
    latencyMs: row.latency_ms !== null && row.latency_ms !== undefined ? Number(row.latency_ms) : null,
    errorMessage: row.error_message || null,
    details,
    actorId: row.actor_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

function usePg() {
  return isPgActive() && Boolean(getPgPool());
}

export async function ensureServerFleetSchema() {
  if (!usePg()) {
    return { ok: true, mode: 'memory' };
  }
  if (pgSchemaReady) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (pgSchemaPromise) {
    return pgSchemaPromise;
  }

  pgSchemaPromise = (async () => {
    await queryPg(`
      CREATE TABLE IF NOT EXISTS system_server_nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        ipv6_address TEXT,
        panel_type TEXT NOT NULL,
        server_role TEXT NOT NULL,
        panel_url TEXT,
        api_port INTEGER DEFAULT 2087,
        ssh_port INTEGER DEFAULT 22,
        health_endpoint TEXT,
        connectivity_mode TEXT NOT NULL DEFAULT 'tcp_probe',
        region TEXT NOT NULL DEFAULT 'sgp1',
        datacenter TEXT,
        provider TEXT,
        cpu_cores INTEGER DEFAULT 8,
        ram_gb INTEGER DEFAULT 32,
        storage_gb INTEGER DEFAULT 500,
        max_droplets INTEGER DEFAULT 50,
        active_droplets INTEGER DEFAULT 0,
        auto_provision_enabled BOOLEAN DEFAULT FALSE,
        routing_weight INTEGER DEFAULT 100,
        auth_type TEXT DEFAULT 'api_token',
        credentials_ciphertext TEXT,
        capabilities_json JSONB DEFAULT '{}'::jsonb,
        how_it_works TEXT,
        tags TEXT[] DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'unknown',
        last_heartbeat_at TIMESTAMPTZ,
        last_latency_ms INTEGER,
        last_probe_error TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_server_nodes_filter
        ON system_server_nodes (status, region, panel_type, server_role);

      CREATE INDEX IF NOT EXISTS idx_server_nodes_hostname
        ON system_server_nodes (hostname);

      CREATE TABLE IF NOT EXISTS system_server_connectivity_logs (
        id BIGSERIAL PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES system_server_nodes(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        latency_ms INTEGER,
        error_message TEXT,
        details JSONB DEFAULT '{}'::jsonb,
        actor_id TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_server_connectivity_logs_node_created
        ON system_server_connectivity_logs (node_id, created_at DESC);
    `);
    pgSchemaReady = true;
    return { ok: true, mode: 'postgres' };
  })().finally(() => {
    pgSchemaPromise = null;
  });

  return pgSchemaPromise;
}

async function appendConnectivityLog({
  nodeId,
  eventType,
  status,
  latencyMs = null,
  errorMessage = null,
  details = {},
  actorId = null
}) {
  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg(
      `INSERT INTO system_server_connectivity_logs
        (node_id, event_type, status, latency_ms, error_message, details, actor_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        nodeId,
        eventType,
        status,
        latencyMs,
        errorMessage ? String(errorMessage).slice(0, 1000) : null,
        JSON.stringify(details && typeof details === 'object' ? details : {}),
        actorId ? String(actorId).slice(0, 120) : null
      ]
    );
    return toLogDto(rows[0]);
  }

  const row = {
    id: memoryLogSeq++,
    node_id: nodeId,
    event_type: eventType,
    status,
    latency_ms: latencyMs,
    error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    details: details && typeof details === 'object' ? details : {},
    actor_id: actorId ? String(actorId).slice(0, 120) : null,
    created_at: new Date().toISOString()
  };
  memoryLogs.push(row);
  return toLogDto(row);
}

async function getRawNodeById(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;
  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg('SELECT * FROM system_server_nodes WHERE id = $1 LIMIT 1', [cleanId]);
    return rows[0] || null;
  }
  return memoryNodes.get(cleanId) || null;
}

async function getRawNodeByHostname(hostname) {
  const clean = String(hostname || '').trim().toLowerCase();
  if (!clean) return null;
  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg('SELECT * FROM system_server_nodes WHERE LOWER(hostname) = $1 LIMIT 1', [clean]);
    return rows[0] || null;
  }
  for (const node of memoryNodes.values()) {
    if (String(node.hostname || '').toLowerCase() === clean) return node;
  }
  return null;
}

export async function getServerNodeById(id) {
  const row = await getRawNodeById(id);
  return toSafeNodeDto(row);
}

function summarizeNodesList(rows) {
  const summary = {
    total: 0,
    online: 0,
    degraded: 0,
    offline: 0,
    maintenance: 0,
    unknown: 0,
    byPanelType: {},
    byRegion: {},
    byRole: {},
    totalMaxDroplets: 0,
    totalActiveDroplets: 0
  };
  for (const row of rows) {
    summary.total += 1;
    const st = NODE_STATUSES.includes(row.status) ? row.status : 'unknown';
    summary[st] = (summary[st] || 0) + 1;
    summary.byPanelType[row.panel_type] = (summary.byPanelType[row.panel_type] || 0) + 1;
    summary.byRegion[row.region] = (summary.byRegion[row.region] || 0) + 1;
    summary.byRole[row.server_role] = (summary.byRole[row.server_role] || 0) + 1;
    summary.totalMaxDroplets += Number(row.max_droplets || 0);
    summary.totalActiveDroplets += Number(row.active_droplets || 0);
  }
  return summary;
}

export async function listServerNodes({
  page = 1,
  pageSize = 25,
  q = '',
  panelType = '',
  panel_type = '',
  region = '',
  status = '',
  role = '',
  serverRole = '',
  server_role = ''
} = {}) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number.parseInt(pageSize, 10) || 25));
  const cleanQ = String(q || '').trim().toLowerCase();
  const cleanPanelType = String(panelType || panel_type || '').trim();
  const cleanRegion = String(region || '').trim().toLowerCase();
  const cleanStatus = String(status || '').trim();
  const cleanRole = String(role || serverRole || server_role || '').trim();

  if (usePg()) {
    await ensureServerFleetSchema();
    const conditions = [];
    const params = [];

    if (cleanPanelType) {
      params.push(cleanPanelType);
      conditions.push(`panel_type = $${params.length}`);
    }
    if (cleanRegion) {
      params.push(cleanRegion);
      conditions.push(`LOWER(region) = $${params.length}`);
    }
    if (cleanStatus) {
      params.push(cleanStatus);
      conditions.push(`status = $${params.length}`);
    }
    if (cleanRole) {
      params.push(cleanRole);
      conditions.push(`server_role = $${params.length}`);
    }
    if (cleanQ) {
      params.push(`%${cleanQ}%`);
      const idx = params.length;
      conditions.push(
        `(LOWER(name) LIKE $${idx} OR LOWER(hostname) LIKE $${idx} OR LOWER(ip_address) LIKE $${idx} OR LOWER(region) LIKE $${idx} OR LOWER(COALESCE(datacenter, '')) LIKE $${idx} OR LOWER(COALESCE(provider, '')) LIKE $${idx} OR EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE LOWER(t) LIKE $${idx}))`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (safePage - 1) * safePageSize;

    const [countRes, listRes, allSummaryRes, panelGroupRes, regionGroupRes, roleGroupRes] = await Promise.all([
      queryPg(`SELECT COUNT(*)::int AS total FROM system_server_nodes ${whereClause}`, params),
      queryPg(
        `SELECT * FROM system_server_nodes ${whereClause}
         ORDER BY created_at DESC, id ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, safePageSize, offset]
      ),
      queryPg(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'online')::int AS online,
          COUNT(*) FILTER (WHERE status = 'degraded')::int AS degraded,
          COUNT(*) FILTER (WHERE status = 'offline')::int AS offline,
          COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance,
          COUNT(*) FILTER (WHERE status = 'unknown')::int AS unknown,
          COALESCE(SUM(max_droplets), 0)::bigint AS total_max_droplets,
          COALESCE(SUM(active_droplets), 0)::bigint AS total_active_droplets
        FROM system_server_nodes
      `),
      queryPg('SELECT panel_type, COUNT(*)::int AS cnt FROM system_server_nodes GROUP BY panel_type'),
      queryPg('SELECT region, COUNT(*)::int AS cnt FROM system_server_nodes GROUP BY region'),
      queryPg('SELECT server_role, COUNT(*)::int AS cnt FROM system_server_nodes GROUP BY server_role')
    ]);

    const total = countRes.rows[0]?.total || 0;
    const agg = allSummaryRes.rows[0] || {};
    const byPanelType = {};
    for (const r of panelGroupRes.rows) byPanelType[r.panel_type] = r.cnt;
    const byRegion = {};
    for (const r of regionGroupRes.rows) byRegion[r.region] = r.cnt;
    const byRole = {};
    for (const r of roleGroupRes.rows) byRole[r.server_role] = r.cnt;

    return {
      nodes: listRes.rows.map(toSafeNodeDto),
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize))
      },
      summary: {
        total: Number(agg.total || 0),
        online: Number(agg.online || 0),
        degraded: Number(agg.degraded || 0),
        offline: Number(agg.offline || 0),
        maintenance: Number(agg.maintenance || 0),
        unknown: Number(agg.unknown || 0),
        byPanelType,
        byRegion,
        byRole,
        totalMaxDroplets: Number(agg.total_max_droplets || 0),
        totalActiveDroplets: Number(agg.total_active_droplets || 0)
      }
    };
  }

  const allRows = Array.from(memoryNodes.values());
  const filtered = allRows
    .filter((row) => {
      if (cleanPanelType && row.panel_type !== cleanPanelType) return false;
      if (cleanRegion && String(row.region || '').toLowerCase() !== cleanRegion) return false;
      if (cleanStatus && row.status !== cleanStatus) return false;
      if (cleanRole && row.server_role !== cleanRole) return false;
      if (cleanQ) {
        const haystacks = [
          row.name,
          row.hostname,
          row.ip_address,
          row.region,
          row.datacenter,
          row.provider,
          ...(Array.isArray(row.tags) ? row.tags : [])
        ];
        if (!haystacks.some((h) => String(h || '').toLowerCase().includes(cleanQ))) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const tDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (tDiff !== 0) return tDiff;
      return String(a.id).localeCompare(String(b.id));
    });

  const total = filtered.length;
  const offset = (safePage - 1) * safePageSize;
  const paged = filtered.slice(offset, offset + safePageSize);

  return {
    nodes: paged.map(toSafeNodeDto),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    },
    summary: summarizeNodesList(allRows)
  };
}

export async function createServerNode(payload, actorId = null) {
  const normalized = normalizeCreatePayload(payload);
  const now = new Date().toISOString();

  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg(
      `INSERT INTO system_server_nodes (
        id, name, hostname, ip_address, ipv6_address, panel_type, server_role,
        panel_url, api_port, ssh_port, health_endpoint, connectivity_mode,
        region, datacenter, provider, cpu_cores, ram_gb, storage_gb,
        max_droplets, active_droplets, auto_provision_enabled, routing_weight,
        auth_type, credentials_ciphertext, capabilities_json, how_it_works,
        tags, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25::jsonb, $26,
        $27, $28, $29
      ) RETURNING *`,
      [
        normalized.id,
        normalized.name,
        normalized.hostname,
        normalized.ip_address,
        normalized.ipv6_address,
        normalized.panel_type,
        normalized.server_role,
        normalized.panel_url,
        normalized.api_port,
        normalized.ssh_port,
        normalized.health_endpoint,
        normalized.connectivity_mode,
        normalized.region,
        normalized.datacenter,
        normalized.provider,
        normalized.cpu_cores,
        normalized.ram_gb,
        normalized.storage_gb,
        normalized.max_droplets,
        normalized.active_droplets,
        normalized.auto_provision_enabled,
        normalized.routing_weight,
        normalized.auth_type,
        normalized.credentials_ciphertext,
        JSON.stringify(normalized.capabilities_json),
        normalized.how_it_works,
        normalized.tags,
        normalized.status,
        actorId ? String(actorId).slice(0, 120) : null
      ]
    );
    await appendConnectivityLog({
      nodeId: normalized.id,
      eventType: 'created',
      status: normalized.status,
      details: {
        panelType: normalized.panel_type,
        serverRole: normalized.server_role,
        region: normalized.region
      },
      actorId
    });
    return toSafeNodeDto(rows[0]);
  }

  const row = {
    ...normalized,
    last_heartbeat_at: null,
    last_latency_ms: null,
    last_probe_error: null,
    created_by: actorId ? String(actorId).slice(0, 120) : null,
    created_at: now,
    updated_at: now
  };
  memoryNodes.set(row.id, row);
  await appendConnectivityLog({
    nodeId: row.id,
    eventType: 'created',
    status: row.status,
    details: {
      panelType: row.panel_type,
      serverRole: row.server_role,
      region: row.region
    },
    actorId
  });
  return toSafeNodeDto(row);
}

export async function updateServerNode(id, rawPatch = {}, actorId = null) {
  const existing = await getRawNodeById(id);
  if (!existing) return null;

  const patch = sanitizePlainValue(rawPatch || {});
  const next = { ...existing };

  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name || name.length > 160) {
      throw makeValidationError('Server name must be between 1 and 160 characters.');
    }
    next.name = name;
  }

  if (patch.panelType !== undefined || patch.panel_type !== undefined) {
    const pt = String(patch.panelType ?? patch.panel_type).trim();
    if (!PANEL_TYPES.includes(pt)) {
      throw makeValidationError(`panelType must be one of: ${PANEL_TYPES.join(', ')}.`);
    }
    next.panel_type = pt;
  }

  if (patch.serverRole !== undefined || patch.server_role !== undefined) {
    const role = String(patch.serverRole ?? patch.server_role).trim();
    if (!SERVER_ROLES.includes(role)) {
      throw makeValidationError(`serverRole must be one of: ${SERVER_ROLES.join(', ')}.`);
    }
    next.server_role = role;
  }

  if (patch.hostname !== undefined) {
    next.hostname = assertSafeHostname(patch.hostname, 'hostname');
  }
  if (patch.ipAddress !== undefined || patch.ip_address !== undefined) {
    next.ip_address = assertSafeIpAddress(patch.ipAddress ?? patch.ip_address, 'ipAddress', { required: true });
  }
  if (patch.ipv6Address !== undefined || patch.ipv6_address !== undefined) {
    next.ipv6_address = assertSafeIpAddress(patch.ipv6Address ?? patch.ipv6_address, 'ipv6Address', { required: false });
  }

  if (patch.connectivityMode !== undefined || patch.connectivity_mode !== undefined) {
    const mode = String(patch.connectivityMode ?? patch.connectivity_mode).trim();
    if (!CONNECTIVITY_MODES.includes(mode)) {
      throw makeValidationError(`connectivityMode must be one of: ${CONNECTIVITY_MODES.join(', ')}.`);
    }
    next.connectivity_mode = mode;
  }

  if (patch.authType !== undefined || patch.auth_type !== undefined) {
    const at = String(patch.authType ?? patch.auth_type).trim();
    if (!AUTH_TYPES.includes(at)) {
      throw makeValidationError(`authType must be one of: ${AUTH_TYPES.join(', ')}.`);
    }
    next.auth_type = at;
  }

  let statusChangedMaintenance = false;
  if (patch.status !== undefined) {
    const st = String(patch.status).trim();
    if (!NODE_STATUSES.includes(st)) {
      throw makeValidationError(`status must be one of: ${NODE_STATUSES.join(', ')}.`);
    }
    if (st !== existing.status && (st === 'maintenance' || existing.status === 'maintenance')) {
      statusChangedMaintenance = true;
    }
    next.status = st;
  }

  if (patch.apiPort !== undefined || patch.api_port !== undefined) {
    next.api_port = parseIntInRange(patch.apiPort ?? patch.api_port, next.api_port, 1, 65535, 'apiPort');
  }
  if (patch.sshPort !== undefined || patch.ssh_port !== undefined) {
    next.ssh_port = parseIntInRange(patch.sshPort ?? patch.ssh_port, next.ssh_port, 1, 65535, 'sshPort');
  }
  if (patch.panelUrl !== undefined || patch.panel_url !== undefined) {
    next.panel_url = assertSafeEndpointUrl(patch.panelUrl ?? patch.panel_url, 'panelUrl', { allowRelative: false });
  }
  if (patch.healthEndpoint !== undefined || patch.health_endpoint !== undefined) {
    next.health_endpoint = assertSafeEndpointUrl(patch.healthEndpoint ?? patch.health_endpoint, 'healthEndpoint', { allowRelative: true });
  }

  if (patch.region !== undefined) {
    next.region = String(patch.region || 'sgp1').trim().toLowerCase().slice(0, 48) || 'sgp1';
  }
  if (patch.datacenter !== undefined) {
    next.datacenter = patch.datacenter ? String(patch.datacenter).trim().slice(0, 120) : null;
  }
  if (patch.provider !== undefined) {
    next.provider = patch.provider ? String(patch.provider).trim().slice(0, 120) : null;
  }

  if (patch.cpuCores !== undefined || patch.cpu_cores !== undefined) {
    next.cpu_cores = parseIntInRange(patch.cpuCores ?? patch.cpu_cores, next.cpu_cores, 1, 2048, 'cpuCores');
  }
  if (patch.ramGb !== undefined || patch.ram_gb !== undefined) {
    next.ram_gb = parseIntInRange(patch.ramGb ?? patch.ram_gb, next.ram_gb, 1, 16384, 'ramGb');
  }
  if (patch.storageGb !== undefined || patch.storage_gb !== undefined) {
    next.storage_gb = parseIntInRange(patch.storageGb ?? patch.storage_gb, next.storage_gb, 1, 1000000, 'storageGb');
  }
  if (patch.maxDroplets !== undefined || patch.max_droplets !== undefined) {
    next.max_droplets = parseIntInRange(patch.maxDroplets ?? patch.max_droplets, next.max_droplets, 0, 100000, 'maxDroplets');
  }
  if (patch.activeDroplets !== undefined || patch.active_droplets !== undefined) {
    next.active_droplets = parseIntInRange(patch.activeDroplets ?? patch.active_droplets, next.active_droplets, 0, 100000, 'activeDroplets');
  }
  if (patch.routingWeight !== undefined || patch.routing_weight !== undefined) {
    next.routing_weight = parseIntInRange(patch.routingWeight ?? patch.routing_weight, next.routing_weight, 0, 10000, 'routingWeight');
  }
  if (patch.autoProvisionEnabled !== undefined || patch.auto_provision_enabled !== undefined) {
    next.auto_provision_enabled = Boolean(patch.autoProvisionEnabled ?? patch.auto_provision_enabled);
  }
  if (patch.howItWorks !== undefined || patch.how_it_works !== undefined) {
    next.how_it_works = String(patch.howItWorks ?? patch.how_it_works ?? '').trim().slice(0, 4000);
  }
  if (patch.tags !== undefined) {
    next.tags = parseTags(patch.tags);
  }
  if (patch.capabilities !== undefined || patch.capabilities_json !== undefined) {
    next.capabilities_json = normalizeCapabilities(patch.capabilities ?? patch.capabilities_json, PANEL_BLUEPRINTS[next.panel_type]);
  }

  let credentialsUpdated = false;
  if (patch.clearCredentials === true) {
    next.credentials_ciphertext = null;
    credentialsUpdated = true;
  } else {
    const newCredInput = extractCredentialPayloadFromInput(patch);
    const newCiphertext = encryptServerCredentials(newCredInput);
    if (newCiphertext) {
      next.credentials_ciphertext = newCiphertext;
      credentialsUpdated = true;
    }
  }

  next.updated_at = new Date().toISOString();

  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg(
      `UPDATE system_server_nodes SET
        name = $2, hostname = $3, ip_address = $4, ipv6_address = $5,
        panel_type = $6, server_role = $7, panel_url = $8, api_port = $9,
        ssh_port = $10, health_endpoint = $11, connectivity_mode = $12,
        region = $13, datacenter = $14, provider = $15,
        cpu_cores = $16, ram_gb = $17, storage_gb = $18,
        max_droplets = $19, active_droplets = $20,
        auto_provision_enabled = $21, routing_weight = $22,
        auth_type = $23, credentials_ciphertext = $24,
        capabilities_json = $25::jsonb, how_it_works = $26,
        tags = $27, status = $28, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        next.id,
        next.name,
        next.hostname,
        next.ip_address,
        next.ipv6_address,
        next.panel_type,
        next.server_role,
        next.panel_url,
        next.api_port,
        next.ssh_port,
        next.health_endpoint,
        next.connectivity_mode,
        next.region,
        next.datacenter,
        next.provider,
        next.cpu_cores,
        next.ram_gb,
        next.storage_gb,
        next.max_droplets,
        next.active_droplets,
        next.auto_provision_enabled,
        next.routing_weight,
        next.auth_type,
        next.credentials_ciphertext,
        JSON.stringify(next.capabilities_json || {}),
        next.how_it_works,
        next.tags || [],
        next.status
      ]
    );
    await appendConnectivityLog({
      nodeId: next.id,
      eventType: statusChangedMaintenance ? 'maintenance_toggle' : 'config_updated',
      status: next.status,
      details: {
        updatedFields: Object.keys(patch).filter((k) => !/token|key|cert|secret|credentials/i.test(k)),
        credentialsUpdated
      },
      actorId
    });
    return toSafeNodeDto(rows[0]);
  }

  memoryNodes.set(next.id, next);
  await appendConnectivityLog({
    nodeId: next.id,
    eventType: statusChangedMaintenance ? 'maintenance_toggle' : 'config_updated',
    status: next.status,
    details: {
      updatedFields: Object.keys(patch).filter((k) => !/token|key|cert|secret|credentials/i.test(k)),
      credentialsUpdated
    },
    actorId
  });
  return toSafeNodeDto(next);
}

export async function deleteServerNode(id, actorId = null) {
  const cleanId = String(id || '').trim();
  if (!cleanId) return false;

  if (usePg()) {
    await ensureServerFleetSchema();
    const { rowCount } = await queryPg('DELETE FROM system_server_nodes WHERE id = $1', [cleanId]);
    return rowCount > 0;
  }

  if (!memoryNodes.has(cleanId)) return false;
  memoryNodes.delete(cleanId);
  for (let i = memoryLogs.length - 1; i >= 0; i--) {
    if (memoryLogs[i].node_id === cleanId) {
      memoryLogs.splice(i, 1);
    }
  }
  void actorId;
  return true;
}

export function parseServerNodesCsv(csvText) {
  const raw = String(csvText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!raw) return [];

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"' && raw[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const items = [];
  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header || header === '__proto__' || header === 'constructor' || header === 'prototype') continue;
      const val = rows[r][c];
      if (val !== undefined && val !== '') {
        obj[header] = val;
      }
    }
    if (Object.keys(obj).length > 0) items.push(obj);
  }
  return items;
}

export async function bulkImportServerNodes(input, actorId = null) {
  const items = typeof input === 'string'
    ? parseServerNodesCsv(input)
    : Array.isArray(input)
      ? input
      : Array.isArray(input?.nodes)
        ? input.nodes
        : Array.isArray(input?.items)
          ? input.items
          : null;

  if (!Array.isArray(items)) {
    throw makeValidationError('Bulk import expects an array of server nodes or CSV text.');
  }
  if (items.length === 0) {
    return { imported: 0, created: 0, updated: 0, skipped: 0, errors: [] };
  }
  if (items.length > 500) {
    throw makeValidationError('Bulk import supports up to 500 server nodes per batch.');
  }

  let imported = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const rawItem = items[i];
    try {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        throw makeValidationError('Row must be an object.');
      }
      const candidateHostname = rawItem.hostname ? String(rawItem.hostname).trim().toLowerCase() : '';
      const candidateId = rawItem.id ? String(rawItem.id).trim() : '';
      const existing = (candidateId && (await getRawNodeById(candidateId))) ||
        (candidateHostname && (await getRawNodeByHostname(candidateHostname)));

      if (existing) {
        await updateServerNode(existing.id, rawItem, actorId);
        imported += 1;
        updated += 1;
      } else {
        await createServerNode(rawItem, actorId);
        imported += 1;
        created += 1;
      }
    } catch (err) {
      skipped += 1;
      errors.push({
        index: i,
        hostname: rawItem?.hostname ? String(rawItem.hostname).slice(0, 120) : null,
        error: err?.message || 'Invalid server node payload.'
      });
    }
  }

  return { imported, created, updated, skipped, errors };
}

function runTcpProbe(host, port, timeoutMs = 3500) {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const socket = net.createConnection({ host, port });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      finish({
        ok: true,
        status: latencyMs > 1500 ? 'degraded' : 'online',
        latencyMs,
        error: null,
        details: { protocol: 'tcp', host, port }
      });
    });
    socket.on('timeout', () => {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      finish({
        ok: false,
        status: 'offline',
        latencyMs,
        error: `TCP probe timed out after ${timeoutMs}ms on ${host}:${port}`,
        details: { protocol: 'tcp', host, port, timeoutMs }
      });
    });
    socket.on('error', (err) => {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      finish({
        ok: false,
        status: 'offline',
        latencyMs,
        error: err?.message || `TCP connection error on ${host}:${port}`,
        details: { protocol: 'tcp', host, port, code: err?.code || null }
      });
    });
  });
}

function buildProbeHttpUrl(node) {
  const endpoint = String(node.health_endpoint || '').trim();
  if (endpoint && /^https?:\/\//i.test(endpoint)) {
    return assertSafeEndpointUrl(endpoint, 'healthEndpoint', { allowRelative: false });
  }
  if (node.panel_url) {
    const base = new URL(assertSafeEndpointUrl(node.panel_url, 'panelUrl', { allowRelative: false }));
    if (endpoint && endpoint.startsWith('/')) {
      return new URL(endpoint, base.origin).toString();
    }
    return base.toString();
  }
  const host = net.isIPv6(node.ip_address) ? `[${node.ip_address}]` : node.ip_address;
  const port = Number(node.api_port || 443);
  const scheme = port === 80 ? 'http' : 'https';
  const path = endpoint && endpoint.startsWith('/') ? endpoint : '/health';
  return `${scheme}://${host}:${port}${path}`;
}

async function runHttpHealthProbe(node, timeoutMs = 3500) {
  const targetUrl = buildProbeHttpUrl(node);
  const started = performance.now();
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Tiwlo-ServerFleet-Probe/1.0'
      }
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    if (response.status >= 500) {
      return {
        ok: false,
        status: 'offline',
        latencyMs,
        error: `Health endpoint returned HTTP ${response.status}`,
        details: { protocol: 'http', targetUrl, httpStatus: response.status }
      };
    }
    if (response.status >= 400 && response.status !== 401 && response.status !== 403) {
      return {
        ok: true,
        status: 'degraded',
        latencyMs,
        error: `Health endpoint returned HTTP ${response.status}`,
        details: { protocol: 'http', targetUrl, httpStatus: response.status }
      };
    }
    return {
      ok: true,
      status: latencyMs > 1500 ? 'degraded' : 'online',
      latencyMs,
      error: null,
      details: { protocol: 'http', targetUrl, httpStatus: response.status }
    };
  } catch (err) {
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    return {
      ok: false,
      status: 'offline',
      latencyMs,
      error: err?.cause?.message || err?.message || 'HTTP health probe failed',
      details: { protocol: 'http', targetUrl }
    };
  }
}

async function defaultProbeNode(node) {
  assertSafeIpAddress(node.ip_address, 'ipAddress', { required: true });
  assertSafeHostname(node.hostname, 'hostname');

  const isHttpMode = ['http_health', 'whm_api', 'tiwlo_panel_rpc'].includes(node.connectivity_mode);
  if (isHttpMode && (node.panel_url || node.health_endpoint)) {
    return runHttpHealthProbe(node, 3500);
  }
  const port = node.panel_type === 'kvm_hypervisor' && node.connectivity_mode === 'tcp_probe'
    ? Number(node.api_port || node.ssh_port || 22)
    : Number(node.api_port || node.ssh_port || 22);
  return runTcpProbe(node.ip_address, port, 3500);
}

export async function probeServerConnectivity(nodeId, actorId = null, { probeFn } = {}) {
  const existing = await getRawNodeById(nodeId);
  if (!existing) return null;

  assertSafeIpAddress(existing.ip_address, 'ipAddress', { required: true });
  assertSafeHostname(existing.hostname, 'hostname');
  if (existing.panel_url) assertSafeEndpointUrl(existing.panel_url, 'panelUrl', { allowRelative: false });

  let probeResult;
  const started = performance.now();
  try {
    const rawResult = typeof probeFn === 'function'
      ? await probeFn(toSafeNodeDto(existing))
      : await defaultProbeNode(existing);

    const latencyMs = Number.isFinite(Number(rawResult?.latencyMs))
      ? Math.max(0, Math.round(Number(rawResult.latencyMs)))
      : Math.max(1, Math.round(performance.now() - started));

    let derivedStatus = rawResult?.status;
    if (!NODE_STATUSES.includes(derivedStatus)) {
      if (rawResult?.ok) {
        derivedStatus = latencyMs > 1500 ? 'degraded' : 'online';
      } else {
        derivedStatus = 'offline';
      }
    }

    probeResult = {
      ok: Boolean(rawResult?.ok),
      status: derivedStatus,
      latencyMs,
      errorMessage: rawResult?.error ? String(rawResult.error).slice(0, 1000) : null,
      details: rawResult?.details && typeof rawResult.details === 'object' ? rawResult.details : {}
    };
  } catch (err) {
    probeResult = {
      ok: false,
      status: 'offline',
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      errorMessage: err?.message ? String(err.message).slice(0, 1000) : 'Connectivity probe failed',
      details: {}
    };
  }

  const checkedAt = new Date().toISOString();
  let updatedRow;

  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg(
      `UPDATE system_server_nodes SET
        status = $2,
        last_heartbeat_at = CASE WHEN $3::boolean THEN CURRENT_TIMESTAMP ELSE last_heartbeat_at END,
        last_latency_ms = $4,
        last_probe_error = $5,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [
        existing.id,
        probeResult.status,
        probeResult.ok,
        probeResult.latencyMs,
        probeResult.errorMessage
      ]
    );
    updatedRow = rows[0];
  } else {
    updatedRow = {
      ...existing,
      status: probeResult.status,
      last_heartbeat_at: probeResult.ok ? checkedAt : existing.last_heartbeat_at,
      last_latency_ms: probeResult.latencyMs,
      last_probe_error: probeResult.errorMessage,
      updated_at: checkedAt
    };
    memoryNodes.set(existing.id, updatedRow);
  }

  await appendConnectivityLog({
    nodeId: existing.id,
    eventType: 'probe',
    status: probeResult.status,
    latencyMs: probeResult.latencyMs,
    errorMessage: probeResult.errorMessage,
    details: probeResult.details,
    actorId
  });

  return {
    node: toSafeNodeDto(updatedRow),
    probe: {
      ok: probeResult.ok,
      status: probeResult.status,
      latencyMs: probeResult.latencyMs,
      errorMessage: probeResult.errorMessage,
      details: probeResult.details,
      checkedAt
    }
  };
}

export async function probeFleetBatch(
  { region = '', panelType = '', panel_type = '', limit = 50 } = {},
  actorId = null,
  opts = {}
) {
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 50));
  const cleanRegion = String(region || '').trim().toLowerCase();
  const cleanPanelType = String(panelType || panel_type || '').trim();

  let candidates = [];
  if (usePg()) {
    await ensureServerFleetSchema();
    const params = [];
    const conds = [`status <> 'maintenance'`];
    if (cleanRegion) {
      params.push(cleanRegion);
      conds.push(`LOWER(region) = $${params.length}`);
    }
    if (cleanPanelType) {
      params.push(cleanPanelType);
      conds.push(`panel_type = $${params.length}`);
    }
    params.push(safeLimit);
    const { rows } = await queryPg(
      `SELECT id FROM system_server_nodes
       WHERE ${conds.join(' AND ')}
       ORDER BY last_heartbeat_at ASC NULLS FIRST, created_at ASC
       LIMIT $${params.length}`,
      params
    );
    candidates = rows.map((r) => r.id);
  } else {
    candidates = Array.from(memoryNodes.values())
      .filter((n) => {
        if (n.status === 'maintenance') return false;
        if (cleanRegion && String(n.region || '').toLowerCase() !== cleanRegion) return false;
        if (cleanPanelType && n.panel_type !== cleanPanelType) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = a.last_heartbeat_at ? new Date(a.last_heartbeat_at).getTime() : 0;
        const tb = b.last_heartbeat_at ? new Date(b.last_heartbeat_at).getTime() : 0;
        return ta - tb;
      })
      .slice(0, safeLimit)
      .map((n) => n.id);
  }

  const results = [];
  const CHUNK_SIZE = 10;
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((nodeId) => probeServerConnectivity(nodeId, actorId, opts))
    );
    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];
      if (outcome.status === 'fulfilled' && outcome.value) {
        results.push({
          nodeId: chunk[j],
          status: outcome.value.probe.status,
          latencyMs: outcome.value.probe.latencyMs,
          errorMessage: outcome.value.probe.errorMessage
        });
      } else {
        results.push({
          nodeId: chunk[j],
          status: 'offline',
          latencyMs: null,
          errorMessage: outcome.reason?.message || 'Probe execution failed'
        });
      }
    }
  }

  return {
    probedCount: results.length,
    onlineCount: results.filter((r) => r.status === 'online').length,
    degradedCount: results.filter((r) => r.status === 'degraded').length,
    offlineCount: results.filter((r) => r.status === 'offline').length,
    results
  };
}

export async function getNodeConnectivityLogs(nodeId, limit = 50) {
  const cleanId = String(nodeId || '').trim();
  if (!cleanId) return [];
  const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));

  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg(
      `SELECT * FROM system_server_connectivity_logs
       WHERE node_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [cleanId, safeLimit]
    );
    return rows.map(toLogDto);
  }

  return memoryLogs
    .filter((entry) => entry.node_id === cleanId)
    .sort((a, b) => {
      const tDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (tDiff !== 0) return tDiff;
      return b.id - a.id;
    })
    .slice(0, safeLimit)
    .map(toLogDto);
}

export async function getPublicDropletCatalogAdditions() {
  let activeNodes = [];
  if (usePg()) {
    await ensureServerFleetSchema();
    const { rows } = await queryPg(
      `SELECT region, panel_type, server_role, max_droplets, active_droplets, status, auto_provision_enabled
       FROM system_server_nodes
       WHERE auto_provision_enabled = TRUE
         AND status IN ('online', 'degraded')`
    );
    activeNodes = rows;
  } else {
    activeNodes = Array.from(memoryNodes.values()).filter(
      (n) => n.auto_provision_enabled === true && (n.status === 'online' || n.status === 'degraded')
    );
  }

  const regionMap = new Map();
  const stackMap = new Map();
  let totalAvailableCapacity = 0;

  for (const node of activeNodes) {
    const freeSlots = Math.max(0, Number(node.max_droplets || 0) - Number(node.active_droplets || 0));
    totalAvailableCapacity += freeSlots;

    const reg = regionMap.get(node.region) || {
      code: node.region,
      nodeCount: 0,
      availableSlots: 0,
      panelTypes: new Set()
    };
    reg.nodeCount += 1;
    reg.availableSlots += freeSlots;
    reg.panelTypes.add(node.panel_type);
    regionMap.set(node.region, reg);

    const stackKey = `${node.panel_type}:${node.server_role}`;
    const stack = stackMap.get(stackKey) || {
      panelType: node.panel_type,
      label: PANEL_BLUEPRINTS[node.panel_type]?.label || node.panel_type,
      serverRole: node.server_role,
      regions: new Set(),
      availableSlots: 0
    };
    stack.regions.add(node.region);
    stack.availableSlots += freeSlots;
    stackMap.set(stackKey, stack);
  }

  return {
    nodeCount: activeNodes.length,
    totalAvailableCapacity,
    regions: Array.from(regionMap.values()).map((r) => ({
      code: r.code,
      nodeCount: r.nodeCount,
      availableSlots: r.availableSlots,
      panelTypes: Array.from(r.panelTypes).sort()
    })),
    stacks: Array.from(stackMap.values()).map((s) => ({
      panelType: s.panelType,
      label: s.label,
      serverRole: s.serverRole,
      regions: Array.from(s.regions).sort(),
      availableSlots: s.availableSlots
    }))
  };
}

export async function runFleetMonitorSweep({ batchLimit = monitorState.batchLimit, probeFn = null } = {}) {
  if (monitorState.isSweepInFlight) {
    return { skipped: true, reason: 'sweep_in_flight', lastSweepSummary: monitorState.lastSweepSummary };
  }
  monitorState.isSweepInFlight = true;
  try {
    const summary = await probeFleetBatch(
      { limit: batchLimit },
      'system:fleet_monitor',
      probeFn ? { probeFn } : {}
    );
    monitorState.sweepCount += 1;
    monitorState.lastSweepAt = new Date().toISOString();
    monitorState.lastSweepSummary = {
      probedCount: summary.probedCount,
      onlineCount: summary.onlineCount,
      degradedCount: summary.degradedCount,
      offlineCount: summary.offlineCount
    };
    monitorState.lastSweepError = null;
    return monitorState.lastSweepSummary;
  } catch (err) {
    monitorState.lastSweepAt = new Date().toISOString();
    monitorState.lastSweepError = err?.message || 'Fleet monitor sweep failed';
    throw err;
  } finally {
    monitorState.isSweepInFlight = false;
  }
}

export function startFleetConnectivityMonitor({
  intervalMs = 60000,
  batchLimit = 50,
  probeFn = null,
  runImmediately = false,
  allowInTest = false
} = {}) {
  if (process.env.NODE_ENV === 'test' && !allowInTest) {
    return {
      running: false,
      skippedInTest: true,
      intervalMs: monitorState.intervalMs,
      sweepCount: monitorState.sweepCount,
      lastSweepAt: monitorState.lastSweepAt
    };
  }

  stopFleetConnectivityMonitor();

  const minInterval = allowInTest ? 25 : 5000;
  const safeInterval = Math.min(3600000, Math.max(minInterval, Number(intervalMs) || 60000));
  const safeBatchLimit = Math.min(50, Math.max(1, Number.parseInt(batchLimit, 10) || 50));

  monitorState.intervalMs = safeInterval;
  monitorState.batchLimit = safeBatchLimit;
  monitorState.running = true;

  monitorState.timer = setInterval(() => {
    runFleetMonitorSweep({ batchLimit: safeBatchLimit, probeFn }).catch((err) => {
      console.warn('[ServerFleetMonitor] Sweep failed:', err?.message || err);
    });
  }, safeInterval);
  monitorState.timer.unref?.();

  if (runImmediately) {
    runFleetMonitorSweep({ batchLimit: safeBatchLimit, probeFn }).catch((err) => {
      console.warn('[ServerFleetMonitor] Initial sweep failed:', err?.message || err);
    });
  }

  return {
    running: true,
    intervalMs: monitorState.intervalMs,
    batchLimit: monitorState.batchLimit,
    sweepCount: monitorState.sweepCount,
    lastSweepAt: monitorState.lastSweepAt
  };
}

export async function getFleetLiveStatus() {
  let summary;
  let avgLatencyMs = null;
  let recentEvents = [];

  if (usePg()) {
    await ensureServerFleetSchema();
    const [{ summary: pgSummary }, latencyRes, eventsRes] = await Promise.all([
      listServerNodes({ page: 1, pageSize: 1 }),
      queryPg(
        `SELECT ROUND(AVG(last_latency_ms))::int AS avg_latency_ms
         FROM system_server_nodes
         WHERE last_latency_ms IS NOT NULL AND status IN ('online', 'degraded')`
      ),
      queryPg(
        `SELECT l.*, n.name AS node_name, n.hostname AS node_hostname, n.region AS node_region
         FROM system_server_connectivity_logs l
         LEFT JOIN system_server_nodes n ON n.id = l.node_id
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 15`
      )
    ]);
    summary = pgSummary;
    avgLatencyMs = latencyRes.rows[0]?.avg_latency_ms ?? null;
    recentEvents = eventsRes.rows.map((r) => ({
      ...toLogDto(r),
      nodeName: r.node_name || null,
      nodeHostname: r.node_hostname || null,
      nodeRegion: r.node_region || null
    }));
  } else {
    const allRows = Array.from(memoryNodes.values());
    summary = summarizeNodesList(allRows);
    const latencies = allRows
      .filter((n) => (n.status === 'online' || n.status === 'degraded') && Number.isFinite(n.last_latency_ms))
      .map((n) => Number(n.last_latency_ms));
    avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length)
      : null;

    recentEvents = memoryLogs
      .slice()
      .sort((a, b) => {
        const tDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (tDiff !== 0) return tDiff;
        return b.id - a.id;
      })
      .slice(0, 15)
      .map((r) => {
        const node = memoryNodes.get(r.node_id);
        return {
          ...toLogDto(r),
          nodeName: node?.name || null,
          nodeHostname: node?.hostname || null,
          nodeRegion: node?.region || null
        };
      });
  }

  return {
    monitor: {
      running: monitorState.running,
      intervalMs: monitorState.intervalMs,
      batchLimit: monitorState.batchLimit,
      sweepCount: monitorState.sweepCount,
      isSweepInFlight: monitorState.isSweepInFlight,
      lastSweepAt: monitorState.lastSweepAt,
      lastSweepSummary: monitorState.lastSweepSummary,
      lastSweepError: monitorState.lastSweepError
    },
    summary: {
      ...summary,
      avgLatencyMs
    },
    recentEvents
  };
}
