import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {
  allocateDropletIpv6,
  bigIntToIpv6,
  deriveIpv6FromPrefix,
  ensureIpv6PoolSchema,
  extractIpv6Prefix64,
  extractIpv6Suffix64,
  formatIpv6SshCommand,
  generateDeterministicSuffix64,
  getInMemoryIpv6StateForTests,
  holdDropletIpAllocations,
  listDropletIpAllocations,
  normalizeIpv6,
  parseIpv6ToBigInt,
  reconcileNodeIpv6PrefixChange,
  registerInMemoryDnsRecordForTests,
  registerInMemoryUserForTests,
  registerNodeIpv6Pool,
  releaseDropletIpAllocations,
  renderServerIpv6ChangedEmail,
  resetInMemoryIpv6PoolForTests,
  restoreDropletIpAllocations,
  upsertInMemoryDropletForTests
} from './ipv6PoolService.js';

test('extractIpv6Prefix64 and deriveIpv6FromPrefix perform pure BigInt /64 and /48 math cleanly', () => {
  assert.equal(extractIpv6Prefix64('2001:0db8:00aa:00bb:1234:5678:9abc:def0'), '2001:db8:aa:bb::/64');
  assert.equal(extractIpv6Prefix64('[2001:db8:1234:5678::1]/64'), '2001:db8:1234:5678::/64');
  assert.equal(extractIpv6Prefix64('2001:db8:abcd::/48'), '2001:db8:abcd::/64');

  const derived = deriveIpv6FromPrefix('2001:db8:aa:bb::/64', '1a2b:3c4d:5e6f:0708');
  assert.equal(derived, '2001:db8:aa:bb:1a2b:3c4d:5e6f:708');
  assert.equal(net.isIPv6(derived), true);

  const derivedFrom48 = deriveIpv6FromPrefix('2001:db8:abcd::/48', '0000:0000:0000:0042');
  assert.equal(derivedFrom48, '2001:db8:abcd::42');
  assert.equal(net.isIPv6(derivedFrom48), true);

  const compact = deriveIpv6FromPrefix('2001:db8:1:2::', '00000000000000ff');
  assert.equal(compact, '2001:db8:1:2::ff');

  // Round-trip BigInt normalization
  const { value } = parseIpv6ToBigInt('2001:0db8:0000:0000:0001:0000:0000:0009');
  assert.equal(bigIntToIpv6(value), '2001:db8::1:0:0:9');
  assert.equal(normalizeIpv6('[2001:0DB8:0:0::1]'), '2001:db8::1');

  // Rejects invalid, IPv4, unspecified, loopback, link-local, and narrow prefixes
  assert.throws(() => extractIpv6Prefix64('192.168.1.1'));
  assert.throws(() => extractIpv6Prefix64('::1'));
  assert.throws(() => extractIpv6Prefix64('fe80::1'));
  assert.throws(() => extractIpv6Prefix64('ff02::1'));
  assert.throws(() => deriveIpv6FromPrefix('2001:db8:1:2::/96', '1'));
});

test('allocateDropletIpv6 yields deterministic unique collision-free /128 addresses and SSH commands', async () => {
  resetInMemoryIpv6PoolForTests();

  const nodeId = 'ubuntu-dhk-1';
  const prefix = '2001:db8:10:20::/64';
  const allocatedSet = new Set();
  const suffixSet = new Set();

  for (let i = 1; i <= 25; i += 1) {
    const dropletId = `drp_test_${i}`;
    upsertInMemoryDropletForTests({
      id: dropletId,
      userId: `usr_${i}`,
      nodeId,
      name: `app-${i}`,
      sshPort: 22000 + i,
      accessUsername: 'root'
    });

    const alloc = await allocateDropletIpv6({
      nodeId,
      dropletId,
      preferredPrefix: prefix,
      userId: `usr_${i}`,
      sshPort: 22000 + i
    });

    assert.equal(net.isIPv6(alloc.ipv6), true);
    assert.equal(alloc.prefix, prefix);
    assert.equal(alloc.status, 'active');
    assert.equal(alloc.sshCommand, formatIpv6SshCommand({ ipv6: alloc.ipv6, username: 'root', port: 22000 + i }));
    assert.match(alloc.sshCommand, /^ssh root@[0-9a-f:]+ -p 22\d{3}$/i);

    assert.equal(allocatedSet.has(alloc.ipv6), false, 'Every droplet must receive a unique IPv6');
    assert.equal(suffixSet.has(alloc.hostSuffix), false, 'Every droplet must receive a unique suffix');
    allocatedSet.add(alloc.ipv6);
    suffixSet.add(alloc.hostSuffix);

    // Idempotent re-allocation returns the same IP
    const again = await allocateDropletIpv6({ nodeId, dropletId, userId: `usr_${i}`, sshPort: 22000 + i });
    assert.equal(again.ipv6, alloc.ipv6);
  }

  // Deterministic suffix stability check
  assert.equal(generateDeterministicSuffix64('drp_test_1', 0), generateDeterministicSuffix64('drp_test_1', 0));
});

test('reconcileNodeIpv6PrefixChange updates all droplets, syncs AAAA DNS, notifies dashboard, sends branded email, and deduplicates', async () => {
  resetInMemoryIpv6PoolForTests();

  const nodeId = 'ubuntu-node-isp';
  const oldPrefix = '2001:db8:1111:1::/64';
  const newNodeAddr = '2001:db8:2222:9::1';
  const expectedNewPrefix = '2001:db8:2222:9::/64';

  registerInMemoryUserForTests({ id: 'usr_1', email: 'alice@example.com', name: 'Alice <Cloud>' });
  registerInMemoryUserForTests({ id: 'usr_2', email: 'bob@example.com', name: 'Bob Builder' });

  upsertInMemoryDropletForTests({ id: 'drp_1', userId: 'usr_1', nodeId, name: 'web-prod', sshPort: 22001 });
  upsertInMemoryDropletForTests({ id: 'drp_2', userId: 'usr_2', nodeId, name: 'api-prod', sshPort: 22002 });

  const a1 = await allocateDropletIpv6({ nodeId, dropletId: 'drp_1', preferredPrefix: oldPrefix, userId: 'usr_1', sshPort: 22001 });
  const a2 = await allocateDropletIpv6({ nodeId, dropletId: 'drp_2', preferredPrefix: oldPrefix, userId: 'usr_2', sshPort: 22002 });

  // Register AAAA records pointing to old IPs (plus an unrelated A record)
  const dns1 = registerInMemoryDnsRecordForTests({ zone: 'tiwlo.com', name: 'web-prod', type: 'AAAA', content: a1.ipv6 });
  const dns2 = registerInMemoryDnsRecordForTests({ zone: 'uids.app', name: 'api-prod', type: 'AAAA', content: a2.ipv6 });
  registerInMemoryDnsRecordForTests({ zone: 'tiwlo.com', name: 'web-prod', type: 'A', content: '203.0.113.10' });

  const sentEmails = [];
  const sendEmailFn = async (payload) => {
    sentEmails.push(payload);
    return { success: true, delivered: true, status: 'delivered', messageId: `msg_${sentEmails.length}` };
  };

  const result = await reconcileNodeIpv6PrefixChange({
    nodeId,
    newIpv6Address: newNodeAddr,
    sendEmailFn
  });

  assert.equal(result.changed, true);
  assert.equal(result.deduplicated, false);
  assert.equal(result.oldPrefix, oldPrefix);
  assert.equal(result.newPrefix, expectedNewPrefix);
  assert.equal(result.updatedDroplets.length, 2);

  // Suffixes preserved under new prefix!
  const u1 = result.updatedDroplets.find((d) => d.dropletId === 'drp_1');
  const u2 = result.updatedDroplets.find((d) => d.dropletId === 'drp_2');
  assert.equal(u1.newIpv6, deriveIpv6FromPrefix(expectedNewPrefix, a1.hostSuffix));
  assert.equal(u2.newIpv6, deriveIpv6FromPrefix(expectedNewPrefix, a2.hostSuffix));
  assert.equal(extractIpv6Suffix64(u1.newIpv6), a1.hostSuffix);
  assert.equal(extractIpv6Suffix64(u2.newIpv6), a2.hostSuffix);

  // DNS AAAA records synced automatically
  const stateAfter = getInMemoryIpv6StateForTests();
  const updatedDns1 = stateAfter.dnsRecords.find((r) => r.id === dns1.id);
  const updatedDns2 = stateAfter.dnsRecords.find((r) => r.id === dns2.id);
  assert.equal(updatedDns1.content, u1.newIpv6);
  assert.equal(updatedDns2.content, u2.newIpv6);

  // Dashboard notifications created with type 'server_ipv6_changed'
  assert.equal(stateAfter.notifications.length, 2);
  assert.ok(stateAfter.notifications.every((n) => n.type === 'server_ipv6_changed'));
  assert.ok(stateAfter.notifications.some((n) => n.recipientId === 'usr_1' && n.meta.newIpv6 === u1.newIpv6));
  assert.ok(stateAfter.notifications.some((n) => n.recipientId === 'usr_2' && n.meta.newIpv6 === u2.newIpv6));

  // Branded Tiwlo emails sent via injected transport using baseTemplate wrapper
  assert.equal(sentEmails.length, 2);
  const aliceEmail = sentEmails.find((e) => e.to === 'alice@example.com');
  assert.ok(aliceEmail);
  assert.equal(aliceEmail.type, 'server_ipv6_changed');
  assert.match(aliceEmail.html, /tiwlo-light-logo\.png/);
  assert.match(aliceEmail.html, /Server IPv6 address updated/);
  assert.match(aliceEmail.html, /Alice &lt;Cloud&gt;/);
  assert.match(aliceEmail.html, new RegExp(u1.newIpv6.replace(/:/g, ':')));
  assert.match(aliceEmail.html, /Tiwlo, Inc\. All rights reserved\./);

  // Deduplication: running reconciliation again with the same prefix produces zero changes/notifications/emails
  const secondRun = await reconcileNodeIpv6PrefixChange({
    nodeId,
    newIpv6Address: newNodeAddr,
    sendEmailFn
  });
  assert.equal(secondRun.changed, false);
  assert.equal(secondRun.deduplicated, true);
  assert.equal(secondRun.updatedDroplets.length, 0);
  assert.equal(sentEmails.length, 2);
  assert.equal(getInMemoryIpv6StateForTests().notifications.length, 2);
});

test('reconcileNodeIpv6PrefixChange auto-replaces unreachable single droplet IPv6 and triggers DNS, notification, and email', async () => {
  resetInMemoryIpv6PoolForTests();

  const nodeId = 'ubuntu-node-health';
  const prefix = '2001:db8:5555:6666::/64';

  registerInMemoryUserForTests({ id: 'usr_health', email: 'ops@example.com', name: 'Ops User' });
  upsertInMemoryDropletForTests({ id: 'drp_healthy', userId: 'usr_health', nodeId, name: 'healthy-box', sshPort: 22010 });
  upsertInMemoryDropletForTests({ id: 'drp_dead', userId: 'usr_health', nodeId, name: 'dead-box', sshPort: 22011 });

  const healthyAlloc = await allocateDropletIpv6({ nodeId, dropletId: 'drp_healthy', preferredPrefix: prefix, userId: 'usr_health', sshPort: 22010 });
  const deadAlloc = await allocateDropletIpv6({ nodeId, dropletId: 'drp_dead', preferredPrefix: prefix, userId: 'usr_health', sshPort: 22011 });

  const dnsCalls = [];
  const notifyCalls = [];
  const emailCalls = [];

  const result = await reconcileNodeIpv6PrefixChange({
    nodeId,
    newIpv6Address: '2001:db8:5555:6666::1',
    reachabilityFn: async ({ droplet }) => droplet.id !== 'drp_dead',
    dnsUpdaterFn: async (payload) => {
      dnsCalls.push(payload);
      return { updatedCount: 1, records: [{ id: 'rec_1', content: payload.newIpv6 }] };
    },
    notifyFn: async (payload) => {
      notifyCalls.push(payload);
      return payload;
    },
    sendEmailFn: async (payload) => {
      emailCalls.push(payload);
      return { success: true, status: 'delivered' };
    }
  });

  assert.equal(result.changed, true);
  assert.equal(result.updatedDroplets.length, 1);
  const replacement = result.updatedDroplets[0];
  assert.equal(replacement.dropletId, 'drp_dead');
  assert.equal(replacement.reason, 'ipv6_unreachable');
  assert.equal(replacement.oldIpv6, deadAlloc.ipv6);
  assert.notEqual(replacement.newIpv6, deadAlloc.ipv6);
  assert.equal(extractIpv6Prefix64(replacement.newIpv6), prefix);

  // Healthy droplet remains untouched
  const activeAllocs = await listDropletIpAllocations({ nodeId, status: 'active' });
  assert.equal(activeAllocs.length, 2);
  assert.ok(activeAllocs.some((a) => a.dropletId === 'drp_healthy' && a.ipAddress === healthyAlloc.ipv6));
  assert.ok(activeAllocs.some((a) => a.dropletId === 'drp_dead' && a.ipAddress === replacement.newIpv6));

  // Old dead IP allocation marked released
  const releasedAllocs = await listDropletIpAllocations({ dropletId: 'drp_dead', status: 'released' });
  assert.equal(releasedAllocs.length, 1);
  assert.equal(releasedAllocs[0].ipAddress, deadAlloc.ipv6);

  // DNS, notification, and email triggered once for the dead droplet
  assert.equal(dnsCalls.length, 1);
  assert.equal(dnsCalls[0].oldIpv6, deadAlloc.ipv6);
  assert.equal(dnsCalls[0].newIpv6, replacement.newIpv6);
  assert.equal(notifyCalls.length, 1);
  assert.equal(notifyCalls[0].type, 'server_ipv6_changed');
  assert.equal(emailCalls.length, 1);
  assert.equal(emailCalls[0].to, 'ops@example.com');
  assert.match(emailCalls[0].html, /Unreachable IPv6 Replacement/);
});

test('suspended droplet holds its IP against theft, reactivating restores exact IP, and releasing frees it with collision protection', async () => {
  resetInMemoryIpv6PoolForTests();

  const nodeId = 'ubuntu-lifecycle-1';
  const prefix = '2001:db8:cafe:babe::/64';

  upsertInMemoryDropletForTests({ id: 'drp_owner', userId: 'usr_owner', nodeId, name: 'owner-vps', sshPort: 22021 });
  upsertInMemoryDropletForTests({ id: 'drp_thief', userId: 'usr_thief', nodeId, name: 'thief-vps', sshPort: 22022 });
  upsertInMemoryDropletForTests({ id: 'drp_newcomer', userId: 'usr_new', nodeId, name: 'newcomer-vps', sshPort: 22023 });

  const ownerAlloc = await allocateDropletIpv6({
    nodeId,
    dropletId: 'drp_owner',
    preferredPrefix: prefix,
    userId: 'usr_owner',
    sshPort: 22021
  });

  // 1. Suspend droplet -> active -> held
  const held = await holdDropletIpAllocations({ dropletId: 'drp_owner', reason: 'past_due' });
  assert.equal(held.status, 'held');
  assert.equal(held.routingDisabled, true);
  assert.equal(held.heldAddresses.length, 1);
  assert.equal(held.heldAddresses[0].ipAddress, ownerAlloc.ipv6);

  // 2. Another droplet CANNOT steal the held IP
  await assert.rejects(
    () => allocateDropletIpv6({
      nodeId,
      dropletId: 'drp_thief',
      userId: 'usr_thief',
      requestedIpv6: ownerAlloc.ipv6
    }),
    (err) => err.code === 'IPV6_ALLOCATION_CONFLICT' && err.statusCode === 409
  );

  // Also auto-allocating for drp_thief gives a distinct IP
  const thiefAlloc = await allocateDropletIpv6({ nodeId, dropletId: 'drp_thief', userId: 'usr_thief' });
  assert.notEqual(thiefAlloc.ipv6, ownerAlloc.ipv6);

  // 3. Reactivating suspended droplet restores EXACT same IP
  const restored = await restoreDropletIpAllocations({ dropletId: 'drp_owner', sshPort: 22021 });
  assert.equal(restored.status, 'active');
  assert.equal(restored.routingDisabled, false);
  assert.equal(restored.ipv6, ownerAlloc.ipv6);
  assert.equal(restored.sshCommand, ownerAlloc.sshCommand);

  // 4. Permanently deleting/releasing frees that IP
  const released = await releaseDropletIpAllocations({ dropletId: 'drp_owner', reason: 'purged' });
  assert.equal(released.status, 'released');
  assert.equal(released.releasedAddresses.length, 1);
  assert.equal(released.releasedAddresses[0].ipAddress, ownerAlloc.ipv6);

  // Now a new service CAN claim that freed IP
  const reclaimed = await allocateDropletIpv6({
    nodeId,
    dropletId: 'drp_newcomer',
    userId: 'usr_new',
    requestedIpv6: ownerAlloc.ipv6
  });
  assert.equal(reclaimed.ipv6, ownerAlloc.ipv6);
  assert.equal(reclaimed.status, 'active');

  // 5. While newcomer owns/uses it, another service is rejected on collision
  upsertInMemoryDropletForTests({ id: 'drp_late', userId: 'usr_late', nodeId, name: 'late-vps', sshPort: 22024 });
  await assert.rejects(
    () => allocateDropletIpv6({
      nodeId,
      dropletId: 'drp_late',
      userId: 'usr_late',
      requestedIpv6: ownerAlloc.ipv6
    }),
    (err) => err.code === 'IPV6_ALLOCATION_CONFLICT' && err.statusCode === 409
  );
});

test('ensureIpv6PoolSchema and PostgreSQL queryFn path emit idempotent DDL and handle lifecycle + prefix reconciliation', async () => {
  resetInMemoryIpv6PoolForTests();

  const executedQueries = [];
  const poolsTable = new Map();
  const allocationsTable = new Map();
  const dropletsTable = new Map([
    ['drp_pg_1', { id: 'drp_pg_1', user_id: 'usr_pg_1', node_id: 'pg-node-1', name: 'pg-box', ssh_port: 22050, access_username: 'root', status: 'active', ipv6: null, ipv6_prefix: null, ipv6_host_suffix: null }]
  ]);
  const notificationsTable = [];
  const eventsTable = [];
  const usersTable = new Map([
    ['usr_pg_1', { id: 'usr_pg_1', email: 'pguser@example.com', name: 'PG User' }]
  ]);

  const mockQueryFn = async (sql, params = []) => {
    const q = String(sql).trim();
    executedQueries.push({ sql: q, params });

    if (q.includes('CREATE TABLE IF NOT EXISTS system_node_ipv6_pools')) {
      return { rows: [], rowCount: 0 };
    }
    if (q.startsWith('INSERT INTO system_node_ipv6_pools')) {
      const [nodeId, prefix, prefixLen, gateway] = params.length === 4
        ? params
        : [params[0], params[1], 64, params[2]];
      const row = { node_id: nodeId, prefix, prefix_len: prefixLen, gateway: gateway || null, updated_at: new Date().toISOString() };
      poolsTable.set(nodeId, row);
      return { rows: [row], rowCount: 1 };
    }
    if (q.startsWith('SELECT * FROM system_node_ipv6_pools WHERE node_id')) {
      const row = poolsTable.get(params[0]);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (q.startsWith('SELECT * FROM system_ip_allocations') && q.includes('WHERE droplet_id')) {
      const rows = [...allocationsTable.values()].filter((r) => r.droplet_id === params[0] && ['active', 'held'].includes(r.status));
      return { rows, rowCount: rows.length };
    }
    if (q.startsWith('SELECT id, droplet_id, status, ip_address')) {
      const [ip, excludeDroplet] = params;
      const hit = [...allocationsTable.values()].find(
        (r) => r.ip_address === ip && ['active', 'held'].includes(r.status) && r.droplet_id !== excludeDroplet
      );
      return { rows: hit ? [hit] : [], rowCount: hit ? 1 : 0 };
    }
    if (q.startsWith('SELECT id AS droplet_id, ipv6 AS ip_address')) {
      const [ip, excludeDroplet] = params;
      const hit = [...dropletsTable.values()].find((d) => d.ipv6 === ip && d.id !== excludeDroplet);
      return { rows: hit ? [{ droplet_id: hit.id, ip_address: hit.ipv6 }] : [], rowCount: hit ? 1 : 0 };
    }
    if (q.startsWith('INSERT INTO system_ip_allocations')) {
      const [id, dropletId, userId, nodeId, ipAddress, prefix, hostSuffix] = params;
      // Enforce unique live IP constraint
      const duplicate = [...allocationsTable.values()].find(
        (r) => r.ip_address === ipAddress && ['active', 'held'].includes(r.status)
      );
      if (duplicate) {
        const err = new Error('duplicate key value violates unique constraint "idx_ip_allocations_live_ip_unique"');
        err.code = '23505';
        throw err;
      }
      const row = { id, droplet_id: dropletId, user_id: userId, node_id: nodeId, ip_address: ipAddress, ip_version: 6, prefix, host_suffix: hostSuffix, status: 'active' };
      allocationsTable.set(id, row);
      return { rows: [row], rowCount: 1 };
    }
    if (q.startsWith('UPDATE cloud_droplets') && q.includes('SET ipv6 = NULL')) {
      const d = dropletsTable.get(params[0]);
      if (d) {
        d.ipv6 = null;
        d.ipv6_prefix = null;
        d.ipv6_host_suffix = null;
      }
      return { rows: d ? [d] : [], rowCount: d ? 1 : 0 };
    }
    if (q.startsWith('UPDATE cloud_droplets')) {
      const [ipv6, prefix, suffix, dropletId] = params;
      const d = dropletsTable.get(dropletId);
      if (d) {
        d.ipv6 = ipv6;
        d.ipv6_prefix = prefix;
        d.ipv6_host_suffix = suffix;
      }
      return { rows: d ? [d] : [], rowCount: d ? 1 : 0 };
    }
    if (q.includes('FROM cloud_droplets') && q.includes('WHERE node_id = $1')) {
      const rows = [...dropletsTable.values()].filter((d) => d.node_id === params[0]);
      return { rows, rowCount: rows.length };
    }
    if (q.includes('FROM system_ip_allocations') && q.includes('WHERE node_id = $1')) {
      const rows = [...allocationsTable.values()].filter((r) => r.node_id === params[0] && ['active', 'held'].includes(r.status));
      return { rows, rowCount: rows.length };
    }
    if (q.startsWith('UPDATE system_ip_allocations') && q.includes('WHERE id = $4')) {
      const [ip, prefix, suffix, id] = params;
      const row = allocationsTable.get(id);
      if (row) {
        row.ip_address = ip;
        row.prefix = prefix;
        row.host_suffix = suffix;
      }
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (q.startsWith('UPDATE system_ip_allocations') && q.includes("SET status = 'held'")) {
      const updated = [];
      for (const row of allocationsTable.values()) {
        if (row.droplet_id === params[0] && ['active', 'held'].includes(row.status)) {
          row.status = 'held';
          updated.push(row);
        }
      }
      return { rows: updated, rowCount: updated.length };
    }
    if (q.startsWith('UPDATE system_ip_allocations') && q.includes("SET status = 'active'")) {
      const updated = [];
      for (const row of allocationsTable.values()) {
        if (row.droplet_id === params[0] && ['held', 'active'].includes(row.status)) {
          row.status = 'active';
          updated.push(row);
        }
      }
      return { rows: updated, rowCount: updated.length };
    }
    if (q.startsWith('UPDATE system_ip_allocations') && q.includes("SET status = 'released'")) {
      const updated = [];
      for (const row of allocationsTable.values()) {
        if (row.droplet_id === params[0] && ['active', 'held'].includes(row.status)) {
          row.status = 'released';
          updated.push(row);
        }
      }
      return { rows: updated, rowCount: updated.length };
    }
    if (q.startsWith('UPDATE system_platform_dns_records')) {
      return { rows: [{ id: 'pdns_1', zone: 'tiwlo.com', name: 'pg-box', content: params[1] }], rowCount: 1 };
    }
    if (q.startsWith('UPDATE system_free_subdomain_records')) {
      return { rows: [], rowCount: 0 };
    }
    if (q.startsWith('UPDATE dns_records')) {
      const err = new Error('relation "dns_records" does not exist');
      err.code = '42P01';
      throw err;
    }
    if (q.startsWith('INSERT INTO social_notifications')) {
      notificationsTable.push({ id: params[0], recipient_id: params[1], content: params[2], entity_id: params[3], title: params[4] });
      return { rows: [], rowCount: 1 };
    }
    if (q.startsWith('SELECT id, email, name, store_name FROM system_users')) {
      const u = usersTable.get(params[0]);
      return { rows: u ? [u] : [], rowCount: u ? 1 : 0 };
    }
    if (q.startsWith('SELECT 1 FROM system_ipv6_change_events')) {
      const hit = eventsTable.find((e) => e.dedup_key === params[0]);
      return { rows: hit ? [{ '?column?': 1 }] : [], rowCount: hit ? 1 : 0 };
    }
    if (q.startsWith('INSERT INTO system_ipv6_change_events')) {
      eventsTable.push({ id: params[0], dedup_key: params[12] });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  const mig = await ensureIpv6PoolSchema({ queryFn: mockQueryFn });
  assert.equal(mig.ok, true);
  assert.equal(mig.mode, 'postgres');

  const ddlSql = executedQueries[0].sql;
  assert.match(ddlSql, /ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ipv6 VARCHAR\(128\)/);
  assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS system_node_ipv6_pools/);
  assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS system_ip_allocations/);
  assert.match(ddlSql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_allocations_live_ip_unique/);
  assert.match(ddlSql, /WHERE status IN \('active', 'held'\)/);
  assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS system_ipv6_change_events/);

  await registerNodeIpv6Pool({ nodeId: 'pg-node-1', prefix: '2001:db8:7000:1::/64', queryFn: mockQueryFn });
  const alloc = await allocateDropletIpv6({ nodeId: 'pg-node-1', dropletId: 'drp_pg_1', userId: 'usr_pg_1', sshPort: 22050, queryFn: mockQueryFn });
  assert.equal(alloc.prefix, '2001:db8:7000:1::/64');

  const pgEmails = [];
  const reconciled = await reconcileNodeIpv6PrefixChange({
    nodeId: 'pg-node-1',
    newIpv6Address: '2001:db8:8000:2::1',
    queryFn: mockQueryFn,
    sendEmailFn: async (msg) => {
      pgEmails.push(msg);
      return { success: true, status: 'delivered' };
    }
  });

  assert.equal(reconciled.changed, true);
  assert.equal(reconciled.newPrefix, '2001:db8:8000:2::/64');
  assert.equal(notificationsTable.length, 1);
  assert.equal(pgEmails.length, 1);
  assert.equal(pgEmails[0].to, 'pguser@example.com');
  assert.equal(dropletsTable.get('drp_pg_1').ipv6_prefix, '2001:db8:8000:2::/64');

  // PG lifecycle: hold -> block conflict -> restore exact IP -> release -> allow reclaim
  const pgIpv6 = dropletsTable.get('drp_pg_1').ipv6;
  const pgHold = await holdDropletIpAllocations({ dropletId: 'drp_pg_1', queryFn: mockQueryFn });
  assert.equal(pgHold.heldAddresses[0].status, 'held');

  await assert.rejects(
    () => allocateDropletIpv6({ nodeId: 'pg-node-1', dropletId: 'drp_pg_2', requestedIpv6: pgIpv6, queryFn: mockQueryFn }),
    (err) => err.code === 'IPV6_ALLOCATION_CONFLICT'
  );

  const pgRestored = await restoreDropletIpAllocations({ dropletId: 'drp_pg_1', sshPort: 22050, queryFn: mockQueryFn });
  assert.equal(pgRestored.ipv6, pgIpv6);
  assert.equal(pgRestored.status, 'active');

  const pgReleased = await releaseDropletIpAllocations({ dropletId: 'drp_pg_1', queryFn: mockQueryFn });
  assert.equal(pgReleased.releasedAddresses[0].status, 'released');
  assert.equal(dropletsTable.get('drp_pg_1').ipv6, null);

  const pgReclaimed = await allocateDropletIpv6({ nodeId: 'pg-node-1', dropletId: 'drp_pg_2', requestedIpv6: pgIpv6, queryFn: mockQueryFn });
  assert.equal(pgReclaimed.ipv6, pgIpv6);
  assert.equal(pgReclaimed.status, 'active');
});

test('renderServerIpv6ChangedEmail escapes unsafe HTML and uses Tiwlo branded layout without emojis', () => {
  const html = renderServerIpv6ChangedEmail({
    to: 'dev@example.com',
    name: '<script>alert(1)</script>',
    nodeId: 'node-1',
    dropletId: 'drp_1',
    dropletName: 'prod & staging',
    oldIpv6: '2001:db8:1::10',
    newIpv6: '2001:db8:2::10',
    sshCommand: 'ssh root@2001:db8:2::10 -p 22001'
  });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /prod &amp; staging/);
  assert.match(html, /2001:db8:2::10/);
  assert.match(html, /ssh root@2001:db8:2::10 -p 22001/);
  assert.match(html, /Open Cloud Dashboard/);
});

test('IPv6 pool enforces 2000::/3 global scope, valid prefix/suffix compression, and per-node prefix isolation', async () => {
  resetInMemoryIpv6PoolForTests();

  assert.throws(() => extractIpv6Prefix64('fc00:1234::/64'), (e) => e.code === 'INVALID_IPV6_SCOPE');
  assert.throws(() => extractIpv6Prefix64('fe80::1/64'), (e) => e.code === 'INVALID_IPV6_SCOPE');
  assert.throws(() => extractIpv6Prefix64('2001:db8:1::/96'), (e) => e.code === 'INVALID_IPV6_PREFIX');
  assert.throws(() => deriveIpv6FromPrefix('2001:db8:1:2::/64', '0:0:0:0'), (e) => e.code === 'INVALID_IPV6_SUFFIX');

  // Expanded mid-compression in 64-bit host suffix works properly
  assert.equal(deriveIpv6FromPrefix('2001:db8:1:2::/64', '1:2::9'), '2001:db8:1:2:1:2:0:9');

  await assert.doesNotReject(() => registerNodeIpv6Pool({ nodeId: 'node-alpha', prefix: '2001:db8:cafe:1::/64' }));
  await assert.rejects(
    () => registerNodeIpv6Pool({ nodeId: 'node-beta', prefix: '2001:db8:cafe:1::/64' }),
    (e) => e.code === 'IPV6_PREFIX_CONFLICT'
  );
});
