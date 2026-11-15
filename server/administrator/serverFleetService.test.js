import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import express from 'express';
import {
  PANEL_BLUEPRINTS,
  bulkImportServerNodes,
  createServerNode,
  decryptServerCredentials,
  deleteServerNode,
  encryptServerCredentials,
  ensureServerFleetSchema,
  getFleetLiveStatus,
  getNodeConnectivityLogs,
  getPublicDropletCatalogAdditions,
  getServerNodeById,
  listServerNodes,
  probeFleetBatch,
  probeServerConnectivity,
  resetInMemoryServerFleetForTests,
  runFleetMonitorSweep,
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
  assert.equal(logs.length, 5);
  assert.deepEqual(
    logs.map((l) => l.eventType),
    ['maintenance_toggle', 'probe', 'probe', 'probe', 'created']
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
