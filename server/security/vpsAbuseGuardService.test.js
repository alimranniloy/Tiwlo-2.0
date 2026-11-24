import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import {
  DEFAULT_BLOCKED_ABUSE_PORTS,
  MINER_STRATUM_PORTS,
  VPS_ABUSE_RULE_TYPES,
  ensureVpsAbuseGuardSchema,
  evaluateDropletTelemetryForAbuse,
  getDropletOutboundFirewallPolicy,
  getInMemoryVpsAbuseGuardStateForTests,
  listVpsAbuseEvents,
  resetInMemoryVpsAbuseGuardForTests
} from './vpsAbuseGuardService.js';
import {
  HOLD_TYPES,
  ensureAccountLifecycleSchema,
  getInMemoryAccountLifecycleStateForTests,
  getUserAccountHold,
  resetInMemoryAccountLifecycleForTests,
  seedInMemoryAccountServicesForTests
} from './accountLifecycleEnforcer.js';
import {
  allocateDropletIpv6,
  ensureIpv6PoolSchema,
  getInMemoryIpv6StateForTests,
  listDropletIpAllocations,
  resetInMemoryIpv6PoolForTests,
  upsertInMemoryDropletForTests
} from '../ubuntu/ipv6PoolService.js';

function resetAllInMemory() {
  resetInMemoryVpsAbuseGuardForTests();
  resetInMemoryAccountLifecycleForTests();
  resetInMemoryIpv6PoolForTests();
}

test('default Port 25/465/587 block policy vs explicitly verified trustedSmtpEnabled: true', async () => {
  resetAllInMemory();

  assert.deepEqual([...DEFAULT_BLOCKED_ABUSE_PORTS], [25, 465, 587]);
  assert.deepEqual([...MINER_STRATUM_PORTS], [3333, 4444, 5555, 7777, 9999, 14433, 14444]);

  const defaultPolicy = getDropletOutboundFirewallPolicy({ dropletId: 'drp_fw_1' });
  assert.equal(defaultPolicy.trustedSmtpEnabled, false);
  assert.deepEqual(defaultPolicy.blockedSmtpPorts, [25, 465, 587]);
  assert.equal(defaultPolicy.defaultPolicy, 'block_untrusted_smtp_and_stratum');

  const trustedPolicy = getDropletOutboundFirewallPolicy({
    dropletId: 'drp_fw_1',
    trustedSmtpEnabled: true
  });
  assert.equal(trustedPolicy.trustedSmtpEnabled, true);
  assert.deepEqual(trustedPolicy.blockedSmtpPorts, []);
  assert.equal(trustedPolicy.defaultPolicy, 'smtp_whitelisted_verified_sender');

  // Verified sender using port 587 within safe rate is allowed
  const allowedTrusted = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_fw_1',
    userId: 'usr_fw_1',
    smtpAttemptsPerMin: 12,
    outboundConnectionsPerMin: 35,
    blockedPortHits: [25, 587],
    trustedSmtpEnabled: true
  });
  assert.equal(allowedTrusted.action, 'allow');
  assert.equal(allowedTrusted.allowed, true);
  assert.equal(allowedTrusted.suspended, false);
  assert.equal(getInMemoryVpsAbuseGuardStateForTests().events.length, 0);

  // Untrusted instance hitting port 25/465/587 triggers critical smtp_spam_egress
  const blockedUntrusted = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_fw_2',
    userId: 'usr_fw_2',
    smtpAttemptsPerMin: 3,
    blockedPortHits: [25, 465],
    trustedSmtpEnabled: false
  });
  assert.equal(blockedUntrusted.action, 'suspend');
  assert.equal(blockedUntrusted.allowed, false);
  assert.equal(blockedUntrusted.severity, 'critical');
  assert.equal(blockedUntrusted.ruleType, VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS);
  assert.equal(blockedUntrusted.suspended, true);
  assert.equal(blockedUntrusted.accountHold.holdType, HOLD_TYPES.TEMP_BAN);
  assert.equal(blockedUntrusted.accountHold.permanent, false);
});

test('SMTP spam burst triggers automatic VPS/account suspension, IP hold, and admin notification', async () => {
  resetAllInMemory();

  const userId = 'usr_spam_1';
  const dropletId = 'drp_spam_1';
  const nodeId = 'ubuntu-dhk-1';
  const tenantId = 'ubt_spam_1';

  upsertInMemoryDropletForTests({
    id: dropletId,
    userId,
    nodeId,
    name: 'spam-vps-1',
    sshPort: 22401,
    accessUsername: 'root'
  });
  const alloc = await allocateDropletIpv6({
    nodeId,
    dropletId,
    preferredPrefix: '2001:db8:aaaa:1::/64',
    userId,
    sshPort: 22401
  });

  seedInMemoryAccountServicesForTests({
    userId,
    nodes: [{ id: nodeId, activeDroplets: 1 }],
    tenants: [{ tenantId, userId, nodeId, status: 'active' }],
    droplets: [{
      id: dropletId,
      userId,
      tenantId,
      nodeId,
      name: 'spam-vps-1',
      status: 'active',
      monthlyPrice: 12,
      nextBillingAt: '2026-12-01T00:00:00.000Z',
      sshPort: 22401
    }]
  });

  const res = await evaluateDropletTelemetryForAbuse({
    dropletId,
    userId,
    smtpAttemptsPerMin: 85,
    outboundConnectionsPerMin: 120,
    blockedPortHits: [25, 587],
    trustedSmtpEnabled: false,
    now: new Date('2026-11-23T22:00:00.000Z')
  });

  assert.equal(res.allowed, false);
  assert.equal(res.action, 'suspend');
  assert.equal(res.severity, 'critical');
  assert.equal(res.ruleType, VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS);
  assert.equal(res.suspended, true);
  assert.deepEqual(res.heldIps, [alloc.ipv6]);
  assert.equal(res.accountHold.holdType, HOLD_TYPES.TEMP_BAN);
  assert.equal(res.accountHold.permanent, false);

  const lifecycleState = getInMemoryAccountLifecycleStateForTests();
  assert.equal(lifecycleState.droplets[0].status, 'suspended');
  assert.equal(lifecycleState.tenants[0].status, 'suspended');

  const ipState = getInMemoryIpv6StateForTests();
  assert.equal(ipState.allocations[0].status, 'held');

  const guardState = getInMemoryVpsAbuseGuardStateForTests();
  assert.equal(guardState.events.length, 1);
  assert.equal(guardState.events[0].ruleType, VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS);
  assert.equal(guardState.events[0].severity, 'critical');
  assert.equal(guardState.notifications.length, 1);
  assert.equal(guardState.notifications[0].type, 'vps_abuse_guard_alert');
  assert.equal(guardState.notifications[0].entityId, dropletId);

  const listed = await listVpsAbuseEvents({ dropletId });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].dropletId, dropletId);
});

test('crypto-miner stratum port and sustained CPU + connection signature trigger auto-suspension cleanly', async () => {
  resetAllInMemory();

  const customSuspendCalls = [];
  const stratumRes = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_miner_1',
    userId: 'usr_miner_1',
    sustainedCpuPct: 99.4,
    highCpuMinutes: 45,
    detectedStratumPorts: [3333, 14444],
    autoSuspendFn: async (payload) => {
      customSuspendCalls.push(payload);
      return { actionTaken: 'auto_suspend_custom', heldIps: ['2001:db8:cafe::10'] };
    }
  });

  assert.equal(stratumRes.action, 'suspend');
  assert.equal(stratumRes.severity, 'critical');
  assert.equal(stratumRes.ruleType, VPS_ABUSE_RULE_TYPES.CRYPTO_MINER_SUSPECTED);
  assert.equal(stratumRes.suspended, true);
  assert.deepEqual(stratumRes.heldIps, ['2001:db8:cafe::10']);
  assert.equal(customSuspendCalls.length, 1);
  assert.equal(customSuspendCalls[0].dropletId, 'drp_miner_1');

  // Sustained CPU >= 98% for >= 30m combined with elevated outbound connection signature also triggers
  const cpuConnRes = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_miner_2',
    userId: 'usr_miner_2',
    sustainedCpuPct: 98.5,
    highCpuMinutes: 35,
    outboundConnectionsPerMin: 140
  });
  assert.equal(cpuConnRes.action, 'suspend');
  assert.equal(cpuConnRes.ruleType, VPS_ABUSE_RULE_TYPES.CRYPTO_MINER_SUSPECTED);
  assert.equal(cpuConnRes.severity, 'critical');

  // High CPU alone (e.g., legitimate compile/transcode) without mining port/connection signature must NOT false-positive
  const legitimateCompile = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_build_1',
    userId: 'usr_build_1',
    sustainedCpuPct: 99.0,
    highCpuMinutes: 50,
    outboundConnectionsPerMin: 8,
    detectedStratumPorts: []
  });
  assert.equal(legitimateCompile.action, 'allow');
  assert.equal(legitimateCompile.allowed, true);
  assert.equal(legitimateCompile.suspended, false);
});

test('normal legitimate web/SSH workload triggers zero false positives and outbound flood triggers high alert', async () => {
  resetAllInMemory();

  const webWorkload = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_web_1',
    userId: 'usr_web_1',
    smtpAttemptsPerMin: 0,
    outboundConnectionsPerMin: 85,
    blockedPortHits: [],
    sustainedCpuPct: 38,
    highCpuMinutes: 0,
    detectedStratumPorts: [],
    trustedSmtpEnabled: false
  });

  assert.equal(webWorkload.ok, true);
  assert.equal(webWorkload.allowed, true);
  assert.equal(webWorkload.action, 'allow');
  assert.equal(webWorkload.severity, 'none');
  assert.equal(webWorkload.ruleType, null);
  assert.equal(webWorkload.suspended, false);
  assert.equal(webWorkload.event, null);
  assert.equal(webWorkload.notification, null);
  assert.equal(getInMemoryVpsAbuseGuardStateForTests().events.length, 0);

  const scanRes = await evaluateDropletTelemetryForAbuse({
    dropletId: 'drp_scan_1',
    userId: 'usr_scan_1',
    outboundConnectionsPerMin: 640
  });
  assert.equal(scanRes.allowed, false);
  assert.equal(scanRes.action, 'throttle_alert');
  assert.equal(scanRes.severity, 'high');
  assert.equal(scanRes.ruleType, VPS_ABUSE_RULE_TYPES.OUTBOUND_FLOOD_SCAN);
  assert.equal(scanRes.suspended, false);
  assert.equal(getInMemoryVpsAbuseGuardStateForTests().events.length, 1);
  assert.equal(getInMemoryVpsAbuseGuardStateForTests().notifications.length, 1);

  await assert.rejects(
    () => evaluateDropletTelemetryForAbuse({ dropletId: '' }),
    (err) => err.statusCode === 400 && err.code === 'INVALID_DROPLET_ID'
  );
});

test('PGlite real PG schema, abuse audit log insert, droplet suspension, IP hold, and admin alert notification', async (t) => {
  const db = new PGlite();
  t.after(async () => { await db.close(); });

  const queryFn = async (sql, params) => (
    params?.length
      ? db.query(sql, params)
      : (await db.exec(sql)).at(-1)
  );

  await db.exec(`
    CREATE TABLE system_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255),
      role VARCHAR(64) DEFAULT 'owner'
    );
    CREATE TABLE system_server_nodes (
      id VARCHAR(64) PRIMARY KEY,
      active_droplets INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE system_ubuntu_tenants (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      node_id VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE cloud_droplets (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(64) DEFAULT 'active',
      tenant_id VARCHAR(64),
      node_id VARCHAR(64),
      ssh_port INTEGER,
      access_username VARCHAR(64) DEFAULT 'root',
      monthly_price NUMERIC(12, 2),
      next_billing_at TIMESTAMPTZ,
      suspended_at TIMESTAMPTZ
    );
    CREATE TABLE social_notifications (
      id VARCHAR(64) PRIMARY KEY,
      recipient_id VARCHAR(64),
      sender_id VARCHAR(64),
      type VARCHAR(64) NOT NULL,
      content TEXT,
      entity_id VARCHAR(64),
      is_read BOOLEAN DEFAULT FALSE,
      title VARCHAR(255),
      snippet TEXT,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureIpv6PoolSchema({ queryFn });
  await ensureAccountLifecycleSchema(db);
  assert.equal((await ensureVpsAbuseGuardSchema(db)).ok, true);
  assert.equal((await ensureVpsAbuseGuardSchema(db)).ok, true); // Idempotent

  const adminId = 'pg_admin_1';
  const userId = 'pg_spam_usr_1';
  const dropletId = 'pg_spam_drp_1';
  const tenantId = 'pg_spam_ubt_1';
  const nodeId = 'pg-node-abuse-1';

  await db.query(`INSERT INTO system_users (id, email, role) VALUES ($1, $2, 'admin'), ($3, $4, 'owner')`, [
    adminId,
    'admin@tiwlo.com',
    userId,
    'abuser@tiwlo.com'
  ]);
  await db.query(`INSERT INTO system_server_nodes (id, active_droplets) VALUES ($1, 1)`, [nodeId]);
  await db.query(`INSERT INTO system_ubuntu_tenants (id, user_id, node_id, status) VALUES ($1, $2, $3, 'active')`, [
    tenantId,
    userId,
    nodeId
  ]);
  await db.query(
    `INSERT INTO cloud_droplets (id, user_id, name, status, tenant_id, node_id, ssh_port, monthly_price, next_billing_at)
     VALUES ($1, $2, 'pg-spam-vps', 'active', $3, $4, 22501, 15.00, '2026-12-10T00:00:00.000Z')`,
    [dropletId, userId, tenantId, nodeId]
  );

  const alloc = await allocateDropletIpv6({
    nodeId,
    dropletId,
    preferredPrefix: '2001:db8:7777:1::/64',
    userId,
    sshPort: 22501,
    queryFn
  });

  // Legitimate traffic first -> allow, 0 abuse rows
  const okResult = await evaluateDropletTelemetryForAbuse({
    dropletId,
    userId,
    outboundConnectionsPerMin: 20,
    sustainedCpuPct: 18,
    queryable: db
  });
  assert.equal(okResult.action, 'allow');
  assert.equal((await listVpsAbuseEvents({ dropletId, queryable: db })).length, 0);

  // Trigger SMTP spam burst in PG
  const spamResult = await evaluateDropletTelemetryForAbuse({
    dropletId,
    userId,
    smtpAttemptsPerMin: 75,
    blockedPortHits: [25, 465],
    trustedSmtpEnabled: false,
    now: new Date('2026-11-23T22:30:00.000Z'),
    queryable: db
  });

  assert.equal(spamResult.allowed, false);
  assert.equal(spamResult.action, 'suspend');
  assert.equal(spamResult.severity, 'critical');
  assert.equal(spamResult.ruleType, VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS);
  assert.deepEqual(spamResult.heldIps, [alloc.ipv6]);

  const dropletRow = (await db.query('SELECT status, suspended_at FROM cloud_droplets WHERE id = $1', [dropletId])).rows[0];
  assert.equal(dropletRow.status, 'suspended');
  assert.ok(dropletRow.suspended_at);

  const tenantRow = (await db.query('SELECT status FROM system_ubuntu_tenants WHERE id = $1', [tenantId])).rows[0];
  assert.equal(tenantRow.status, 'suspended');

  const hold = await getUserAccountHold(userId, { queryable: db });
  assert.equal(hold.holdType, HOLD_TYPES.TEMP_BAN);

  const allocs = await listDropletIpAllocations({ dropletId, includeReleased: true, queryFn });
  assert.equal(allocs[0].status, 'held');

  const abuseEvents = await listVpsAbuseEvents({ dropletId, queryable: db });
  assert.equal(abuseEvents.length, 1);
  assert.equal(abuseEvents[0].userId, userId);
  assert.equal(abuseEvents[0].ruleType, VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS);
  assert.equal(abuseEvents[0].severity, 'critical');
  assert.equal(abuseEvents[0].evidence.smtpAttemptsPerMin, 75);

  const adminAlerts = (
    await db.query(
      `SELECT * FROM social_notifications WHERE recipient_id = $1 AND type = 'vps_abuse_guard_alert'`,
      [adminId]
    )
  ).rows;
  assert.equal(adminAlerts.length, 1);
  assert.equal(adminAlerts[0].entity_id, dropletId);
  assert.equal(adminAlerts[0].meta.ruleType, VPS_ABUSE_RULE_TYPES.SMTP_SPAM_EGRESS);
});
