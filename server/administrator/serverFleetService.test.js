import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import express from 'express';
import {
  PANEL_BLUEPRINTS,
  PRIMARY_NODE_ID,
  assertSafeProbeHostResolution,
  bulkImportServerNodes,
  createServerNode,
  decryptServerCredentials,
  deleteServerNode,
  detectLocalHostHardware,
  encryptServerCredentials,
  ensurePrimaryLocalServerNode,
  ensureServerFleetSchema,
  getClusterAutomationSettings,
  getFleetLiveStatus,
  getNodeConnectivityLogs,
  getPublicDropletCatalogAdditions,
  getServerNodeById,
  isBlockedMetadataOrSsrfIp,
  linkRemoteUbuntuNodeViaSsh,
  listServerNodes,
  probeFleetBatch,
  probeServerConnectivity,
  resetInMemoryServerFleetForTests,
  runFleetMonitorSweep,
  runHttpHealthProbe,
  selectBestClusterNodeForDroplet,
  setClusterAutomationSettings,
  startFleetConnectivityMonitor,
  stopFleetConnectivityMonitor,
  updateServerNode
} from './serverFleetService.js';
import { createAdminServerFleetRouter } from './adminServerFleetRoutes.js';

test.beforeEach(() => {
  resetInMemoryServerFleetForTests();
});

test.afterEach(() => {
  resetInMemoryServerFleetForTests();
});

test('ensureServerFleetSchema succeeds cleanly in memory fallback mode', async () => {
  const res = await ensureServerFleetSchema();
  assert.equal(res.ok, true);
  assert.equal(res.mode, 'memory');
});

test('creates Tiwlo Panel, cPanel/WHM, and KVM Hypervisor nodes and masks all secrets', async () => {
  const tpanel = await createServerNode({
    name: 'Tiwlo App Cluster SGP-01',
    hostname: 'tpanel-sgp1.internal.tiwlo.net',
    ipAddress: '10.20.1.10',
    panelType: 'tiwlo_panel',
    serverRole: 'app_hosting',
    region: 'sgp1',
    apiToken: 'tiwlo_agent_super_secret_token_9876',
    autoProvisionEnabled: true,
    maxDroplets: 80,
    activeDroplets: 12,
    tags: ['production', 'nvme']
  }, 'admin_1');

  const cpanel = await createServerNode({
    name: 'cPanel Shared BD-01',
    hostname: 'whm-dac1.tiwlo.net',
    ipAddress: '10.20.2.15',
    panelType: 'cpanel_whm',
    serverRole: 'cpanel_shared',
    region: 'dac1',
    whmUsername: 'root',
    whmToken: 'WHM_API_TOKEN_SECRET_VALUE_4455',
    panelUrl: 'https://whm-dac1.tiwlo.net:2087'
  }, 'admin_1');

  const kvm = await createServerNode({
    name: 'KVM Droplet Host FRA-01',
    hostname: 'kvm-fra1.tiwlo.net',
    ipAddress: '10.20.3.20',
    panelType: 'kvm_hypervisor',
    serverRole: 'droplet_host',
    region: 'fra1',
    sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmU=\n-----END OPENSSH PRIVATE KEY-----',
    maxDroplets: 120,
    activeDroplets: 35,
    autoProvisionEnabled: true
  }, 'admin_1');

  assert.equal(tpanel.apiPort, 9443);
  assert.equal(tpanel.connectivityMode, 'tiwlo_panel_rpc');
  assert.equal(tpanel.hasCredentials, true);
  assert.equal(tpanel.credentialHint, 'tok:••••9876');
  assert.equal(tpanel.credentials_ciphertext, undefined);
  assert.equal(tpanel.apiToken, undefined);
  assert.ok(!JSON.stringify(tpanel).includes('tiwlo_agent_super_secret_token_9876'));

  assert.equal(cpanel.apiPort, 2087);
  assert.equal(cpanel.connectivityMode, 'whm_api');
  assert.equal(cpanel.hasCredentials, true);
  assert.equal(cpanel.credentialHint, 'tok:••••4455');
  assert.ok(!JSON.stringify(cpanel).includes('WHM_API_TOKEN_SECRET_VALUE_4455'));

  assert.equal(kvm.apiPort, 22);
  assert.equal(kvm.connectivityMode, 'tcp_probe');
  assert.equal(kvm.hasCredentials, true);
  assert.ok(kvm.credentialHint.startsWith('ssh:••••'));
  assert.ok(!JSON.stringify(kvm).includes('BEGIN OPENSSH PRIVATE KEY'));

  const fetched = await getServerNodeById(cpanel.id);
  assert.equal(fetched.hasCredentials, true);
  assert.ok(!JSON.stringify(fetched).includes('WHM_API_TOKEN_SECRET_VALUE_4455'));
  assert.ok(PANEL_BLUEPRINTS.cpanel_whm.howItWorks.includes('2087'));
  assert.ok(PANEL_BLUEPRINTS.tiwlo_panel.howItWorks.includes('9443'));
});

test('encryptServerCredentials and decryptServerCredentials enforce integrity and round-trip', () => {
  const cipher = encryptServerCredentials({ apiToken: 'secret_abc_1234', whmUsername: 'root' });
  const decrypted = decryptServerCredentials(cipher);
  assert.equal(decrypted.apiToken, 'secret_abc_1234');
  assert.equal(decrypted.whmUsername, 'root');

  const tampered = JSON.parse(cipher);
  tampered.ct = tampered.ct.slice(0, -2) + (tampered.ct.endsWith('ff') ? '00' : 'ff');
  assert.throws(() => decryptServerCredentials(JSON.stringify(tampered)));
});

test('rejects SSRF and cloud metadata IPs/URLs across all network fields', async () => {
  const badCases = [
    {
      name: 'AWS Metadata IP',
      hostname: 'meta.internal',
      ipAddress: '169.254.169.254',
      panelType: 'custom_panel',
      serverRole: 'edge_proxy'
    },
    {
      name: 'Link-local Range IP',
      hostname: 'linklocal.internal',
      ipAddress: '169.254.42.9',
      panelType: 'custom_panel',
      serverRole: 'edge_proxy'
    },
    {
      name: 'Alibaba Metadata IP',
      hostname: 'ali-meta.internal',
      ipAddress: '100.100.100.200',
      panelType: 'custom_panel',
      serverRole: 'edge_proxy'
    },
    {
      name: 'GCP Metadata Hostname',
      hostname: 'metadata.google.internal',
      ipAddress: '10.0.0.5',
      panelType: 'custom_panel',
      serverRole: 'edge_proxy'
    },
    {
      name: 'Metadata IPv6',
      hostname: 'v6-meta.internal',
      ipAddress: '10.0.0.6',
      ipv6Address: 'fd00:ec2::254',
      panelType: 'custom_panel',
      serverRole: 'edge_proxy'
    },
    {
      name: 'Metadata Panel URL',
      hostname: 'ok-host.tiwlo.net',
      ipAddress: '10.0.0.7',
      panelType: 'cpanel_whm',
      serverRole: 'cpanel_shared',
      panelUrl: 'http://169.254.169.254/latest/meta-data/'
    },
    {
      name: 'Metadata Health URL',
      hostname: 'ok-host2.tiwlo.net',
      ipAddress: '10.0.0.8',
      panelType: 'custom_panel',
      serverRole: 'app_hosting',
      healthEndpoint: 'https://metadata.google.internal/computeMetadata/v1/'
    }
  ];

  for (const payload of badCases) {
    await assert.rejects(
      () => createServerNode(payload, 'admin_1'),
      (err) => err.statusCode === 400
    );
  }
});

test('supports server-side search, filters, pagination, and accurate fleet summary across 120 nodes', async () => {
  const panels = ['tiwlo_panel', 'cpanel_whm', 'kvm_hypervisor', 'plesk'];
  const regions = ['sgp1', 'fra1', 'nyc3'];
  const statuses = ['online', 'degraded', 'offline', 'maintenance'];
  const roles = ['app_hosting', 'cpanel_shared', 'droplet_host'];

  const batch = [];
  for (let i = 0; i < 120; i++) {
    const panelType = panels[i % panels.length];
    const region = regions[i % regions.length];
    const status = statuses[i % statuses.length];
    const serverRole = roles[i % roles.length];
    batch.push({
      name: `Fleet Node ${String(i + 1).padStart(3, '0')}`,
      hostname: `node-${i + 1}.${region}.tiwlo.net`,
      ipAddress: `10.50.${Math.floor(i / 200) + 1}.${(i % 200) + 1}`,
      panelType,
      serverRole,
      region,
      status,
      maxDroplets: 40,
      activeDroplets: 10,
      tags: i % 10 === 0 ? ['canary', 'nvme'] : ['prod']
    });
  }

  const imported = await bulkImportServerNodes(batch, 'admin_bulk');
  assert.equal(imported.imported, 120);
  assert.equal(imported.skipped, 0);

  const page2 = await listServerNodes({ page: 2, pageSize: 25 });
  assert.equal(page2.nodes.length, 25);
  assert.equal(page2.pagination.page, 2);
  assert.equal(page2.pagination.total, 120);
  assert.equal(page2.pagination.totalPages, 5);
  assert.equal(page2.summary.total, 120);
  assert.equal(page2.summary.online, 30);
  assert.equal(page2.summary.degraded, 30);
  assert.equal(page2.summary.offline, 30);
  assert.equal(page2.summary.maintenance, 30);
  assert.equal(page2.summary.byPanelType.tiwlo_panel, 30);
  assert.equal(page2.summary.byRegion.sgp1, 40);
  assert.equal(page2.summary.totalMaxDroplets, 4800);
  assert.equal(page2.summary.totalActiveDroplets, 1200);

  const filtered = await listServerNodes({
    panelType: 'cpanel_whm',
    region: 'fra1',
    status: 'degraded',
    pageSize: 50
  });
  assert.equal(filtered.pagination.total, 10);
  assert.ok(filtered.nodes.every((n) => n.panelType === 'cpanel_whm' && n.region === 'fra1' && n.status === 'degraded'));

  const searched = await listServerNodes({ q: 'canary', pageSize: 50 });
  assert.equal(searched.pagination.total, 12);

  const hostSearch = await listServerNodes({ q: 'Fleet Node 042' });
  assert.equal(hostSearch.pagination.total, 1);
  assert.equal(hostSearch.nodes[0].name, 'Fleet Node 042');
});

test('bulkImportServerNodes validates rows, upserts duplicates, parses CSV, and rejects >500 items', async () => {
  const result = await bulkImportServerNodes([
    {
      name: 'Bulk Valid 1',
      hostname: 'bulk1.tiwlo.net',
      ipAddress: '10.60.0.10',
      panelType: 'tiwlo_panel',
      serverRole: 'app_hosting'
    },
    {
      name: 'Bulk Bad SSRF',
      hostname: 'bulk-bad.tiwlo.net',
      ipAddress: '169.254.169.254',
      panelType: 'tiwlo_panel',
      serverRole: 'app_hosting'
    },
    {
      name: 'Bulk Valid 1 Updated',
      hostname: 'bulk1.tiwlo.net',
      ipAddress: '10.60.0.11',
      panelType: 'tiwlo_panel',
      serverRole: 'app_hosting',
      region: 'nyc3'
    }
  ], 'admin_1');

  assert.equal(result.imported, 2);
  assert.equal(result.created, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].index, 1);

  const csvResult = await bulkImportServerNodes(
    'name,hostname,ipAddress,panelType,serverRole,region,tags\n' +
    '"CSV DirectAdmin 01",da01.tiwlo.net,10.60.0.20,directadmin,cpanel_shared,sgp1,"shared|ols"\n',
    'admin_csv'
  );
  assert.equal(csvResult.imported, 1);
  assert.equal(csvResult.created, 1);

  const oversized = Array.from({ length: 501 }, (_, idx) => ({
    name: `N${idx}`,
    hostname: `n${idx}.tiwlo.net`,
    ipAddress: '10.1.1.1',
    panelType: 'custom_panel',
    serverRole: 'app_hosting'
  }));
  await assert.rejects(() => bulkImportServerNodes(oversized, 'admin_1'), (err) => err.statusCode === 400);
});

test('probeServerConnectivity updates status, latency, and writes audit logs for success, failure, and config edits', async () => {
  const node = await createServerNode({
    name: 'Probe Target SGP',
    hostname: 'probe-sgp.tiwlo.net',
    ipAddress: '10.70.1.5',
    panelType: 'cpanel_whm',
    serverRole: 'cpanel_shared',
    region: 'sgp1',
    apiToken: 'whm_tok_123456'
  }, 'admin_creator');

  const okProbe = await probeServerConnectivity(node.id, 'admin_probe', {
    probeFn: async () => ({ ok: true, latencyMs: 42, details: { version: '118.0' } })
  });
  assert.equal(okProbe.node.status, 'online');
  assert.equal(okProbe.node.lastLatencyMs, 42);
  assert.ok(okProbe.node.lastHeartbeatAt);
  assert.equal(okProbe.node.lastProbeError, null);

  const degradedProbe = await probeServerConnectivity(node.id, 'admin_probe', {
    probeFn: async () => ({ ok: true, latencyMs: 1850 })
  });
  assert.equal(degradedProbe.node.status, 'degraded');
  assert.equal(degradedProbe.node.lastLatencyMs, 1850);

  const failProbe = await probeServerConnectivity(node.id, 'admin_probe', {
    probeFn: async () => ({ ok: false, latencyMs: 3500, error: 'ETIMEDOUT connecting to 10.70.1.5:2087' })
  });
  assert.equal(failProbe.node.status, 'offline');
  assert.equal(failProbe.node.lastProbeError, 'ETIMEDOUT connecting to 10.70.1.5:2087');

  const updated = await updateServerNode(node.id, { status: 'maintenance', routingWeight: 0 }, 'admin_ops');
  assert.equal(updated.status, 'maintenance');
  assert.equal(updated.routingWeight, 0);
  assert.equal(updated.hasCredentials, true); // preserved when not overwritten

  const logs = await getNodeConnectivityLogs(node.id, 20);
  assert.equal(logs.length, 6);
  assert.deepEqual(
    logs.map((l) => l.eventType),
    ['maintenance_toggle', 'probe', 'failover_triggered', 'probe', 'probe', 'created']
  );
  assert.equal(logs[1].errorMessage, 'ETIMEDOUT connecting to 10.70.1.5:2087');
});

test('probeServerConnectivity performs real non-blocking TCP socket connect against local listener', async () => {
  const tcpServer = net.createServer((socket) => {
    socket.end();
  });
  await new Promise((resolve) => tcpServer.listen(0, '127.0.0.1', resolve));
  const { port } = tcpServer.address();

  try {
    const node = await createServerNode({
      name: 'Local TCP Loopback Test',
      hostname: 'localhost.tiwlo.test',
      ipAddress: '127.0.0.1',
      panelType: 'kvm_hypervisor',
      serverRole: 'droplet_host',
      apiPort: port,
      sshPort: port,
      connectivityMode: 'tcp_probe'
    }, 'admin_test');

    const result = await probeServerConnectivity(node.id, 'admin_test');
    assert.equal(result.probe.ok, true);
    assert.equal(result.node.status, 'online');
    assert.ok(result.node.lastLatencyMs >= 1);
  } finally {
    await new Promise((resolve) => tcpServer.close(resolve));
  }
});

test('probeFleetBatch skips maintenance nodes and summarizes batch results', async () => {
  const n1 = await createServerNode({
    name: 'Batch 1',
    hostname: 'b1.tiwlo.net',
    ipAddress: '10.80.0.1',
    panelType: 'tiwlo_panel',
    serverRole: 'app_hosting',
    region: 'sgp1'
  }, 'admin_1');
  const n2 = await createServerNode({
    name: 'Batch 2',
    hostname: 'b2.tiwlo.net',
    ipAddress: '10.80.0.2',
    panelType: 'tiwlo_panel',
    serverRole: 'app_hosting',
    region: 'sgp1'
  }, 'admin_1');
  await createServerNode({
    name: 'Batch Maintenance',
    hostname: 'b3.tiwlo.net',
    ipAddress: '10.80.0.3',
    panelType: 'tiwlo_panel',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'maintenance'
  }, 'admin_1');

  const batchResult = await probeFleetBatch(
    { region: 'sgp1', limit: 50 },
    'admin_1',
    {
      probeFn: async (node) => (node.id === n1.id
        ? { ok: true, latencyMs: 18 }
        : { ok: false, latencyMs: 3500, error: 'Connection refused' })
    }
  );

  assert.equal(batchResult.probedCount, 2);
  assert.equal(batchResult.onlineCount, 1);
  assert.equal(batchResult.offlineCount, 1);
  assert.equal((await getServerNodeById(n2.id)).status, 'offline');
});

test('getPublicDropletCatalogAdditions never leaks host IPs, hostnames, or secrets', async () => {
  const onlineHost = await createServerNode({
    name: 'Public Host',
    hostname: 'secret-hypervisor.internal',
    ipAddress: '10.90.1.99',
    panelType: 'kvm_hypervisor',
    serverRole: 'droplet_host',
    region: 'sgp1',
    maxDroplets: 100,
    activeDroplets: 25,
    autoProvisionEnabled: true,
    status: 'online',
    sshKey: 'SUPER_SECRET_SSH_KEY'
  }, 'admin_1');

  await createServerNode({
    name: 'Disabled Auto Provision',
    hostname: 'private-host.internal',
    ipAddress: '10.90.1.100',
    panelType: 'cpanel_whm',
    serverRole: 'cpanel_shared',
    region: 'fra1',
    maxDroplets: 50,
    activeDroplets: 0,
    autoProvisionEnabled: false,
    status: 'online'
  }, 'admin_1');

  assert.ok(onlineHost.id);
  const catalog = await getPublicDropletCatalogAdditions();
  assert.equal(catalog.nodeCount, 1);
  assert.equal(catalog.totalAvailableCapacity, 75);
  assert.equal(catalog.regions[0].code, 'sgp1');

  const serialized = JSON.stringify(catalog);
  assert.ok(!serialized.includes('10.90.1.99'));
  assert.ok(!serialized.includes('secret-hypervisor.internal'));
  assert.ok(!serialized.includes('SUPER_SECRET_SSH_KEY'));
});

test('continuous fleet connectivity monitor sweeps cleanly and getFleetLiveStatus reports telemetry', async () => {
  await createServerNode({
    name: 'Always Connected Node',
    hostname: 'always-on.tiwlo.net',
    ipAddress: '10.95.0.10',
    panelType: 'tiwlo_panel',
    serverRole: 'app_hosting',
    region: 'sgp1'
  }, 'admin_1');

  const sweepSummary = await runFleetMonitorSweep({
    batchLimit: 10,
    probeFn: async () => ({ ok: true, latencyMs: 24 })
  });
  assert.equal(sweepSummary.probedCount, 1);
  assert.equal(sweepSummary.onlineCount, 1);

  const started = startFleetConnectivityMonitor({
    intervalMs: 60000,
    batchLimit: 25,
    allowInTest: true,
    probeFn: async () => ({ ok: true, latencyMs: 25 })
  });
  assert.equal(started.running, true);

  const live = await getFleetLiveStatus();
  assert.equal(live.monitor.running, true);
  assert.equal(live.monitor.sweepCount, 1);
  assert.equal(live.summary.online, 1);
  assert.equal(live.summary.avgLatencyMs, 24);
  assert.ok(live.recentEvents.length >= 2);

  const stopped = stopFleetConnectivityMonitor();
  assert.equal(stopped.running, false);
});

test('adminServerFleetRoutes enforces auth/reauth and executes full CRUD + logs HTTP flow', async () => {
  let allowReauth = true;
  const requireAdmin = (req, _res, next) => {
    req.adminUser = { id: 'admin_http_1', email: 'admin@tiwlo.net', role: 'admin' };
    next();
  };
  const requireRecentReauth = (_req, res, next) => {
    if (!allowReauth) {
      return res.status(428).json({ error: 'RECENT_VERIFICATION_REQUIRED' });
    }
    return next();
  };

  const app = express();
  app.use(express.json());
  app.use('/api/admin/fleet', createAdminServerFleetRouter({ requireAdmin, requireRecentReauth }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api/admin/fleet`;

  try {
    const bpRes = await fetch(`${base}/blueprints`);
    assert.equal(bpRes.status, 200);
    const bpJson = await bpRes.json();
    assert.ok(bpJson.blueprints.tiwlo_panel);
    assert.ok(bpJson.blueprints.cpanel_whm);

    allowReauth = false;
    const blockedCreate = await fetch(`${base}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Blocked Without Reauth',
        hostname: 'reauth.tiwlo.net',
        ipAddress: '10.1.2.3',
        panelType: 'tiwlo_panel',
        serverRole: 'app_hosting'
      })
    });
    assert.equal(blockedCreate.status, 428);

    allowReauth = true;
    const createRes = await fetch(`${base}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'HTTP Created Node',
        hostname: 'http1.tiwlo.net',
        ipAddress: '10.1.2.4',
        panelType: 'cpanel_whm',
        serverRole: 'cpanel_shared',
        whmToken: 'super_secret_whm_token_7788'
      })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.node.hasCredentials, true);
    assert.equal(created.node.credentialHint, 'tok:••••7788');

    const patchRes = await fetch(`${base}/nodes/${created.node.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'maintenance' })
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.node.status, 'maintenance');

    const liveRes = await fetch(`${base}/live-status`);
    assert.equal(liveRes.status, 200);
    const liveJson = await liveRes.json();
    assert.equal(liveJson.summary.maintenance, 1);

    const logsRes = await fetch(`${base}/nodes/${created.node.id}/logs`);
    assert.equal(logsRes.status, 200);
    const logsJson = await logsRes.json();
    assert.equal(logsJson.logs.length, 2);

    const delRes = await fetch(`${base}/nodes/${created.node.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    assert.equal(await deleteServerNode(created.node.id), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('isBlockedMetadataOrSsrfIp blocks hex IPv4-mapped metadata while preserving admin RFC1918 and Cloudflare IPs', async () => {
  assert.equal(isBlockedMetadataOrSsrfIp('169.254.169.254'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('::ffff:169.254.169.254'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('::ffff:a9fe:a9fe'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('100.100.100.200'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('0.0.0.0'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('255.255.255.255'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('fe80::1'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('fd00:ec2::254'), true);
  assert.equal(isBlockedMetadataOrSsrfIp('::'), true);

  // Admin RFC1918 fleet nodes & Cloudflare public IPs remain permitted
  assert.equal(isBlockedMetadataOrSsrfIp('10.20.1.10'), false);
  assert.equal(isBlockedMetadataOrSsrfIp('172.16.5.4'), false);
  assert.equal(isBlockedMetadataOrSsrfIp('192.168.10.20'), false);
  assert.equal(isBlockedMetadataOrSsrfIp('104.16.132.229'), false);
  assert.equal(isBlockedMetadataOrSsrfIp('172.64.155.209'), false);
  assert.equal(isBlockedMetadataOrSsrfIp('2606:4700:4700::1111'), false);

  await assert.rejects(
    () => createServerNode({
      name: 'Mapped IPv6 Metadata URL',
      hostname: 'ok-host3.tiwlo.net',
      ipAddress: '10.20.1.11',
      panelType: 'custom_panel',
      serverRole: 'app_hosting',
      healthEndpoint: 'http://[::ffff:169.254.169.254]/latest/meta-data/'
    }, 'admin_1'),
    (err) => err.statusCode === 400
  );

  await assert.rejects(
    () => createServerNode({
      name: 'Trailing Dot Metadata Host',
      hostname: 'metadata.google.internal.',
      ipAddress: '10.20.1.12',
      panelType: 'custom_panel',
      serverRole: 'app_hosting'
    }, 'admin_1'),
    (err) => err.statusCode === 400
  );
});

test('runHttpHealthProbe blocks DNS rebinding to metadata IPs and enforces redirect: manual for allowed fleet/Cloudflare nodes', async () => {
  const rebindIps = [
    [{ address: '169.254.169.254', family: 4 }],
    [{ address: '10.20.1.10', family: 4 }, { address: '169.254.169.254', family: 4 }],
    [{ address: '100.100.100.200', family: 4 }],
    [{ address: '::ffff:169.254.169.254', family: 6 }],
    [{ address: 'fe80::1', family: 6 }],
    [{ address: 'fd00:ec2::254', family: 6 }],
    []
  ];

  for (const records of rebindIps) {
    let fetchCalled = false;
    const result = await runHttpHealthProbe(
      {
        ip_address: '10.20.1.10',
        hostname: 'rebind-fleet.tiwlo.net',
        panel_url: 'https://rebind-fleet.tiwlo.net:9443/health',
        health_endpoint: '/health'
      },
      2000,
      {
        dnsLookup: async () => records,
        fetchFn: async () => {
          fetchCalled = true;
          return { status: 200 };
        }
      }
    );
    assert.equal(fetchCalled, false, `fetch must not run for blocked DNS records: ${JSON.stringify(records)}`);
    assert.equal(result.ok, false);
    assert.equal(result.status, 'offline');
  }

  // Allowed Cloudflare & RFC1918 DNS resolutions proceed with redirect: 'manual'
  for (const allowedAddr of ['104.16.132.229', '10.20.1.10']) {
    const fetchArgs = [];
    const okResult = await runHttpHealthProbe(
      {
        ip_address: allowedAddr,
        hostname: 'edge-node.tiwlo.net',
        panel_url: 'https://edge-node.tiwlo.net/health',
        health_endpoint: '/health'
      },
      2000,
      {
        dnsLookup: async () => [{ address: allowedAddr, family: 4 }],
        fetchFn: async (url, init) => {
          fetchArgs.push({ url, init });
          return { status: 200 };
        }
      }
    );
    assert.equal(okResult.ok, true);
    assert.equal(okResult.status, 'online');
    assert.equal(fetchArgs.length, 1);
    assert.equal(fetchArgs[0].init.redirect, 'manual');
  }

  await assert.rejects(
    () => assertSafeProbeHostResolution('rebind.example', async () => [{ address: '169.254.169.254', family: 4 }]),
    (err) => err.statusCode === 400
  );
});

test('detectLocalHostHardware returns valid host telemetry and ensurePrimaryLocalServerNode protects primary node with 403', async () => {
  const hw = detectLocalHostHardware();
  assert.equal(typeof hw.cpuCores, 'number');
  assert.ok(hw.cpuCores >= 1);
  assert.equal(typeof hw.ramGb, 'number');
  assert.ok(hw.ramGb >= 1);
  assert.equal(typeof hw.storageGb, 'number');
  assert.ok(hw.storageGb >= 1);
  assert.equal(typeof hw.detectedOsId, 'string');
  assert.ok(hw.detectedOsId.length > 0);
  assert.ok(hw.networkAddresses && Array.isArray(hw.networkAddresses.ipv4));
  assert.ok(Array.isArray(hw.networkAddresses.ipv6));
  assert.ok(hw.networkAddresses.ipv4.length >= 1);
  assert.equal(typeof hw.timezone, 'string');
  assert.ok(hw.timezone.length > 0);

  const primary = await ensurePrimaryLocalServerNode();
  assert.equal(primary.id, PRIMARY_NODE_ID);
  assert.equal(primary.id, 'primary-ubuntu-node');
  assert.equal(primary.isPrimary, true);
  assert.equal(primary.status, 'online');
  assert.equal(primary.cpuCores, hw.cpuCores);
  assert.equal(primary.ramGb, hw.ramGb);
  assert.equal(primary.storageGb, hw.storageGb);
  assert.equal(primary.detectedOsId, hw.detectedOsId);

  // Calling ensurePrimaryLocalServerNode again updates idempotently without duplicating
  const primaryAgain = await ensurePrimaryLocalServerNode();
  assert.equal(primaryAgain.id, 'primary-ubuntu-node');
  const listed = await listServerNodes();
  assert.equal(listed.summary.total, 1);

  await assert.rejects(
    () => deleteServerNode('primary-ubuntu-node', 'admin_1'),
    (err) => err.statusCode === 403
  );
});

test('listServerNodes / summarizeNodesList accurately aggregates cluster CPU, RAM, storage, OS images, and IPv4/IPv6 pools', async () => {
  await createServerNode({
    name: 'Pool Node Online 1',
    hostname: 'pool-1.tiwlo.net',
    ipAddress: '10.30.1.10',
    ipv6Address: '2001:db8:1::10',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'online',
    cpuCores: 16,
    ramGb: 64,
    storageGb: 1000,
    capabilities: {
      storageFreeGb: 750.5,
      detectedOsId: 'ubuntu-24.04',
      osImages: ['ubuntu-24.04', 'debian-12'],
      networkAddresses: {
        ipv4: ['10.30.1.10', '10.30.1.11'],
        ipv6: ['2001:db8:1::10', '2001:db8:1::11']
      }
    }
  }, 'admin_1');

  await createServerNode({
    name: 'Pool Node Degraded 2',
    hostname: 'pool-2.tiwlo.net',
    ipAddress: '10.30.2.20',
    ipv6Address: '2001:db8:2::20',
    panelType: 'ubuntu_node',
    serverRole: 'droplet_host',
    region: 'fra1',
    status: 'degraded',
    cpuCores: 8,
    ramGb: 32,
    storageGb: 500,
    capabilities: {
      storageFreeGb: 200.5,
      detectedOsId: 'ubuntu-22.04',
      osImages: ['ubuntu-22.04', 'ubuntu-24.04'],
      networkAddresses: {
        ipv4: ['10.30.2.20'],
        ipv6: ['2001:db8:2::20']
      }
    }
  }, 'admin_1');

  await createServerNode({
    name: 'Pool Node Offline 3',
    hostname: 'pool-3.tiwlo.net',
    ipAddress: '10.30.3.30',
    ipv6Address: '2001:db8:3::30',
    panelType: 'kvm_hypervisor',
    serverRole: 'droplet_host',
    region: 'nyc3',
    status: 'offline',
    cpuCores: 32,
    ramGb: 128,
    storageGb: 2000,
    capabilities: {
      storageFreeGb: 1500,
      detectedOsId: 'rocky-9',
      osImages: ['rocky-9'],
      networkAddresses: {
        ipv4: ['10.30.3.30', '10.30.1.10'], // includes shared/duplicate IPv4 to test deduplication
        ipv6: ['2001:db8:3::30']
      }
    }
  }, 'admin_1');

  const { summary } = await listServerNodes();
  assert.equal(summary.total, 3);
  assert.equal(summary.online, 1);
  assert.equal(summary.degraded, 1);
  assert.equal(summary.offline, 1);

  assert.equal(summary.totalCpuCores, 56);
  assert.equal(summary.onlineCpuCores, 24); // online (16) + degraded (8)
  assert.equal(summary.totalRamGb, 224);
  assert.equal(summary.onlineRamGb, 96); // online (64) + degraded (32)
  assert.equal(summary.totalStorageGb, 3500);
  assert.equal(summary.onlineStorageGb, 1500);
  assert.equal(summary.totalStorageFreeGb, 2451); // 750.5 + 200.5 + 1500
  assert.equal(summary.totalStorageUsedGb, 1049); // 3500 - 2451

  // Only online/degraded nodes contribute detectedOsImages and onlineRegions
  assert.deepEqual(
    summary.detectedOsImages.slice().sort(),
    ['debian-12', 'ubuntu-22.04', 'ubuntu-24.04']
  );
  assert.deepEqual(summary.onlineRegions.slice().sort(), ['fra1', 'sgp1']);

  // All unique IPv4 and IPv6 addresses across the fleet
  assert.deepEqual(
    summary.allIpv4.slice().sort(),
    ['10.30.1.10', '10.30.1.11', '10.30.2.20', '10.30.3.30']
  );
  assert.deepEqual(
    summary.allIpv6.slice().sort(),
    ['2001:db8:1::10', '2001:db8:1::11', '2001:db8:2::20', '2001:db8:3::30']
  );
});

test('selectBestClusterNodeForDroplet enforces weighted load balancing and overflows when maxDroplets or storageFreeGb is exhausted', async () => {
  const fullByDroplets = await createServerNode({
    name: 'Node A Full Slots',
    hostname: 'node-a.tiwlo.net',
    ipAddress: '10.40.1.1',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'online',
    maxDroplets: 10,
    activeDroplets: 10,
    routingWeight: 500,
    storageGb: 1000,
    capabilities: { storageFreeGb: 800, ramFreeGb: 64, detectedOsId: 'ubuntu-24.04' }
  }, 'admin_1');

  const lowStorageNode = await createServerNode({
    name: 'Node B Low Disk',
    hostname: 'node-b.tiwlo.net',
    ipAddress: '10.40.1.2',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'online',
    maxDroplets: 50,
    activeDroplets: 2,
    routingWeight: 300,
    storageGb: 500,
    capabilities: { storageFreeGb: 20, ramFreeGb: 32, detectedOsId: 'ubuntu-24.04' }
  }, 'admin_1');

  const healthyOverflow = await createServerNode({
    name: 'Node C Healthy Overflow',
    hostname: 'node-c.tiwlo.net',
    ipAddress: '10.40.1.3',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'online',
    maxDroplets: 50,
    activeDroplets: 5,
    routingWeight: 100,
    storageGb: 1000,
    capabilities: { storageFreeGb: 250, ramFreeGb: 32, detectedOsId: 'ubuntu-24.04' }
  }, 'admin_1');

  // Node A is at maxDroplets; Node B lacks requiredStorageGb (20 < 80); overflows onto Node C
  const selectedForLargeDisk = await selectBestClusterNodeForDroplet({
    requiredStorageGb: 80,
    requiredRamGb: 8,
    regionId: 'sgp1',
    imageId: 'ubuntu-24.04'
  });
  assert.ok(selectedForLargeDisk);
  assert.equal(selectedForLargeDisk.id, healthyOverflow.id);
  assert.notEqual(selectedForLargeDisk.id, fullByDroplets.id);
  assert.notEqual(selectedForLargeDisk.id, lowStorageNode.id);

  // When requiredStorageGb fits on Node B (10 <= 20), higher weighted Node B wins over Node C
  const selectedForSmallDisk = await selectBestClusterNodeForDroplet({
    requiredStorageGb: 10,
    regionId: 'sgp1'
  });
  assert.equal(selectedForSmallDisk.id, lowStorageNode.id);

  // Excluding Node C when 80GB is required yields null (no eligible node)
  const noneEligible = await selectBestClusterNodeForDroplet({
    requiredStorageGb: 80,
    excludeNodeIds: [healthyOverflow.id]
  });
  assert.equal(noneEligible, null);
});

test('autonomous self-healing and auto-failover trigger alerts/logs on outage and clear them on recovery', async () => {
  const nodePrimary = await createServerNode({
    name: 'Cluster Worker A',
    hostname: 'worker-a.tiwlo.net',
    ipAddress: '10.45.0.10',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'online',
    maxDroplets: 50,
    activeDroplets: 5
  }, 'admin_1');

  const nodeStandby = await createServerNode({
    name: 'Cluster Worker B',
    hostname: 'worker-b.tiwlo.net',
    ipAddress: '10.45.0.11',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    region: 'sgp1',
    status: 'online',
    maxDroplets: 50,
    activeDroplets: 1
  }, 'admin_1');

  // Step 1: Worker A goes offline during monitor sweep -> auto-failover + active alert
  const outageSweep = await runFleetMonitorSweep({
    batchLimit: 10,
    probeFn: async (node) => (node.id === nodePrimary.id
      ? { ok: false, latencyMs: 3500, error: 'Agent heartbeat timeout' }
      : { ok: true, latencyMs: 14 })
  });
  assert.equal(outageSweep.probedCount, 2);
  assert.equal(outageSweep.offlineCount, 1);
  assert.equal(outageSweep.onlineCount, 1);

  const liveAfterOutage = await getFleetLiveStatus();
  assert.equal(liveAfterOutage.automation.autoFailoverCount, 1);
  assert.equal(liveAfterOutage.automation.selfHealedCount, 0);
  assert.ok(liveAfterOutage.automation.lastFailoverAt);
  assert.equal(liveAfterOutage.automation.activeAlerts.length, 1);
  assert.equal(liveAfterOutage.automation.activeAlerts[0].nodeId, nodePrimary.id);
  assert.equal(liveAfterOutage.automation.activeAlerts[0].type, 'node_offline');
  assert.equal(liveAfterOutage.automation.activeAlerts[0].failoverTargetId, nodeStandby.id);

  const logsAfterOutage = await getNodeConnectivityLogs(nodePrimary.id, 20);
  const failoverLog = logsAfterOutage.find((l) => l.eventType === 'failover_triggered');
  assert.ok(failoverLog);
  assert.equal(failoverLog.status, 'offline');
  assert.equal(failoverLog.details.failoverTargetId, nodeStandby.id);

  // Step 2: Recover Worker A -> online via probeServerConnectivity -> self_healed + alert cleared
  const recovery = await probeServerConnectivity(nodePrimary.id, 'system:self_healing', {
    probeFn: async () => ({ ok: true, latencyMs: 19 })
  });
  assert.equal(recovery.node.status, 'online');

  const liveAfterRecovery = await getFleetLiveStatus();
  assert.equal(liveAfterRecovery.automation.autoFailoverCount, 1);
  assert.equal(liveAfterRecovery.automation.selfHealedCount, 1);
  assert.ok(liveAfterRecovery.automation.lastHealedAt);
  assert.equal(liveAfterRecovery.automation.activeAlerts.length, 0);

  const logsAfterRecovery = await getNodeConnectivityLogs(nodePrimary.id, 20);
  const healedLog = logsAfterRecovery.find((l) => l.eventType === 'self_healed');
  assert.ok(healedLog);
  assert.equal(healedLog.status, 'online');
  assert.equal(healedLog.details.previousStatus, 'offline');
});

test('runHttpHealthProbe sends bearer Authorization header and parses JSON telemetry into node state', async () => {
  const node = await createServerNode({
    name: 'Telemetry Agent Node',
    hostname: 'agent-telemetry.tiwlo.net',
    ipAddress: '10.55.0.10',
    panelType: 'ubuntu_node',
    serverRole: 'app_hosting',
    panelUrl: 'https://agent-telemetry.tiwlo.net:9443',
    healthEndpoint: '/agent/v1/health',
    bearerToken: 'agent_secret_bearer_token_9988',
    cpuCores: 2,
    ramGb: 4,
    storageGb: 50
  }, 'admin_1');

  const seenHeaders = [];
  const telemetryPayload = {
    cpuCores: 16,
    ramGb: 64,
    ramFreeGb: 48.2,
    storageGb: 1000,
    storageFreeGb: 812.5,
    detectedOsId: 'ubuntu-24.04',
    detectedOsName: 'Ubuntu 24.04.1 LTS',
    networkAddresses: {
      ipv4: ['10.55.0.10', '192.168.55.10'],
      ipv6: ['2001:db8:55::10']
    },
    timezone: 'Asia/Dhaka',
    loadPct: 14
  };

  const mockDnsLookup = async () => [{ address: '10.55.0.10', family: 4 }];
  const mockFetchFn = async (_url, init) => {
    seenHeaders.push(init.headers);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(telemetryPayload)
    };
  };

  const directProbe = await runHttpHealthProbe(
    {
      ip_address: '10.55.0.10',
      hostname: 'agent-telemetry.tiwlo.net',
      panel_url: 'https://agent-telemetry.tiwlo.net:9443',
      health_endpoint: '/agent/v1/health',
      credentials_ciphertext: encryptServerCredentials({ bearerToken: 'direct_bearer_xyz_1234' })
    },
    2000,
    { dnsLookup: mockDnsLookup, fetchFn: mockFetchFn }
  );

  assert.equal(directProbe.ok, true);
  assert.equal(directProbe.status, 'online');
  assert.equal(seenHeaders[0].Authorization, 'Bearer direct_bearer_xyz_1234');
  assert.deepEqual(directProbe.details.telemetry, telemetryPayload);

  // Also verify probeServerConnectivity applies parsed telemetry + bearer header for stored node
  const probeRes = await probeServerConnectivity(node.id, 'admin_probe', {
    dnsLookup: mockDnsLookup,
    fetchFn: mockFetchFn
  });
  assert.equal(seenHeaders[1].Authorization, 'Bearer agent_secret_bearer_token_9988');
  assert.equal(probeRes.node.status, 'online');
  assert.equal(probeRes.node.cpuCores, 16);
  assert.equal(probeRes.node.ramGb, 64);
  assert.equal(probeRes.node.ramFreeGb, 48.2);
  assert.equal(probeRes.node.storageGb, 1000);
  assert.equal(probeRes.node.storageFreeGb, 812.5);
  assert.equal(probeRes.node.detectedOsId, 'ubuntu-24.04');
  assert.equal(probeRes.node.ipv6Address, '2001:db8:55::10');
  assert.equal(probeRes.node.timezone, 'Asia/Dhaka');
  assert.equal(probeRes.node.loadPct, 14);
});

test('linkRemoteUbuntuNodeViaSsh registers online Ubuntu node with parsed SSH telemetry and masks credentials', async () => {
  await assert.rejects(
    () => linkRemoteUbuntuNodeViaSsh({ ipAddress: '10.65.0.10' }, 'admin_1'),
    (err) => err.statusCode === 400
  );

  await assert.rejects(
    () => linkRemoteUbuntuNodeViaSsh({
      ipAddress: '169.254.169.254',
      sshPassword: 'secret-pass'
    }, 'admin_1'),
    (err) => err.statusCode === 400
  );

  const capturedArgs = [];
  const probeOutput = [
    'HOSTNAME=ubuntu-worker-bd01.tiwlo.net',
    'CPU_CORES=12',
    'RAM_MB=49152',
    'RAM_FREE_MB=36864',
    'DISK_TOTAL_GB=800',
    'DISK_FREE_GB=645.5',
    'OS_ID=ubuntu',
    'OS_VER=24.04',
    'OS_PRETTY=Ubuntu 24.04 LTS',
    'TIMEZONE=Asia/Dhaka',
    'IPV4_LIST=10.65.0.25,169.254.169.254',
    'IPV6_LIST=2001:db8:65::25,fe80::1'
  ].join('\n');

  const linked = await linkRemoteUbuntuNodeViaSsh(
    {
      name: 'BD Auto-Linked Node 01',
      ipAddress: '10.65.0.25',
      sshPort: 2222,
      sshUser: 'ubuntu',
      sshPassword: 'super_secret_ssh_password_55',
      region: 'bd1'
    },
    'admin_ssh',
    {
      sshConnectFn: async (opts) => {
        capturedArgs.push(opts);
        return {
          probeOutput,
          agentToken: 'ssh_installed_agent_token_8877',
          installResult: 'systemd_agent_active'
        };
      }
    }
  );

  assert.equal(capturedArgs.length, 1);
  assert.equal(capturedArgs[0].host, '10.65.0.25');
  assert.equal(capturedArgs[0].port, 2222);
  assert.equal(capturedArgs[0].username, 'ubuntu');
  assert.equal(capturedArgs[0].installAgent, true);

  assert.equal(linked.installResult, 'systemd_agent_active');
  assert.equal(linked.node.status, 'online');
  assert.equal(linked.node.panelType, 'ubuntu_node');
  assert.equal(linked.node.hostname, 'ubuntu-worker-bd01.tiwlo.net');
  assert.equal(linked.node.cpuCores, 12);
  assert.equal(linked.node.ramGb, 48);
  assert.equal(linked.node.ramFreeGb, 36);
  assert.equal(linked.node.storageGb, 800);
  assert.equal(linked.node.storageFreeGb, 645.5);
  assert.equal(linked.node.detectedOsId, 'ubuntu-24.04');
  assert.equal(linked.node.timezone, 'Asia/Dhaka');
  // Link-local/metadata IPs filtered out of parsed network addresses
  assert.deepEqual(linked.node.networkAddresses.ipv4, ['10.65.0.25']);
  assert.deepEqual(linked.node.networkAddresses.ipv6, ['2001:db8:65::25']);
  assert.equal(linked.node.hasCredentials, true);

  const serialized = JSON.stringify(linked.node);
  assert.ok(!serialized.includes('super_secret_ssh_password_55'));
  assert.ok(!serialized.includes('ssh_installed_agent_token_8877'));

  const fetched = await getServerNodeById(linked.node.id);
  assert.equal(fetched.id, linked.node.id);
  assert.equal(fetched.status, 'online');
});

test('getClusterAutomationSettings and setClusterAutomationSettings default backupEnabled to false and toggle cleanly', async () => {
  const initial = await getClusterAutomationSettings();
  assert.equal(initial.backupEnabled, false);
  assert.equal(initial.loadBalancingPolicy, 'weighted_least_load_overflow');
  assert.equal(initial.selfHealingEnabled, true);
  assert.equal(initial.autoFailoverEnabled, true);

  const enabled = await setClusterAutomationSettings({ backupEnabled: true }, 'admin_1');
  assert.equal(enabled.backupEnabled, true);
  assert.equal((await getClusterAutomationSettings()).backupEnabled, true);
  assert.equal((await getFleetLiveStatus()).automation.backupEnabled, true);

  const disabled = await setClusterAutomationSettings({ backupEnabled: false }, 'admin_1');
  assert.equal(disabled.backupEnabled, false);
  assert.equal((await getClusterAutomationSettings()).backupEnabled, false);
  assert.equal((await getFleetLiveStatus()).automation.backupEnabled, false);
});
