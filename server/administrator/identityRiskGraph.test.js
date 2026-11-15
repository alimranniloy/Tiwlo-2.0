import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRiskClusters,
  executeClusterBanAction,
  isSuperAdminAccount,
  selectClusterBanTargets
} from './identityRiskGraph.js';

test('detects ban evasion when active user shares device_fingerprint_hash with a banned user', () => {
  const sharedFp = 'a'.repeat(64);
  const result = computeRiskClusters({
    users: [
      { id: 'u_banned', name: 'Banned Merchant', email: 'bad@example.com', role: 'owner', isBanned: true, banReason: 'Free tier abuse' },
      { id: 'u_evader', name: 'New Merchant', email: 'new@example.com', role: 'owner', isBanned: false }
    ],
    freeStoreClaims: [
      { user_id: 'u_banned', store_id: 's1', device_fingerprint_hash: sharedFp, ip_hash: '1'.repeat(64), status: 'active' },
      { user_id: 'u_evader', store_id: 's2', device_fingerprint_hash: sharedFp, ip_hash: '2'.repeat(64), status: 'active' }
    ]
  });

  const evaderIntel = result.riskByUserId.u_evader;
  assert.ok(evaderIntel);
  assert.ok(evaderIntel.flags.includes('BAN_EVASION_RISK'));
  assert.ok(evaderIntel.flags.includes('MULTI_ACCOUNT_RING'));
  assert.ok(['high', 'critical'].includes(evaderIntel.riskLevel));
  assert.ok(evaderIntel.riskScore >= 50);
  assert.ok(evaderIntel.matchedSignals.includes('Shared Device Fingerprint'));
  assert.equal(evaderIntel.linkedAccounts.length, 1);
  assert.equal(evaderIntel.linkedAccounts[0].id, 'u_banned');
  assert.equal(evaderIntel.linkedAccounts[0].isBanned, true);
});

test('detects ban evasion when active user shares browser_cookie_hash / signup_browser with a banned account', () => {
  const sharedCookie = 'b'.repeat(64);
  const result = computeRiskClusters({
    users: [
      { id: 'u_banned_2', name: 'Banned Two', email: 'b2@example.com', role: 'owner', isBanned: true },
      { id: 'u_evader_2', name: 'Evader Two', email: 'e2@example.com', role: 'owner', isBanned: false }
    ],
    signupBrowsers: [
      { user_id: 'u_banned_2', key_hash: sharedCookie },
      { user_id: 'u_evader_2', key_hash: sharedCookie }
    ]
  });

  const evaderIntel = result.riskByUserId.u_evader_2;
  assert.ok(evaderIntel.flags.includes('BAN_EVASION_RISK'));
  assert.ok(evaderIntel.flags.includes('MULTI_ACCOUNT_RING'));
  assert.ok(['high', 'critical'].includes(evaderIntel.riskLevel));
  assert.ok(evaderIntel.matchedSignals.includes('Same Persistent Browser'));
  assert.equal(evaderIntel.linkedAccounts[0].id, 'u_banned_2');
});

test('detects multi-account ring across shared IP, subnet, and device token without false-positiving unrelated users', () => {
  const ringToken = 't'.repeat(64);
  const ringIp = 'i'.repeat(64);
  const ringSubnet = 'n'.repeat(64);

  const result = computeRiskClusters({
    users: [
      { id: 'r1', name: 'Ring One', email: 'r1@example.com', role: 'owner', isBanned: false },
      { id: 'r2', name: 'Ring Two', email: 'r2@example.com', role: 'owner', isBanned: false },
      { id: 'r3', name: 'Ring Three', email: 'r3@example.com', role: 'owner', isBanned: false },
      { id: 'clean', name: 'Clean User', email: 'clean@example.com', phone: '+8801811111111', role: 'owner', isBanned: false }
    ],
    promoClaims: [
      { user_id: 'r1', device_token_hash: ringToken, ip_hash: ringIp, subnet_hash: ringSubnet },
      { user_id: 'r2', device_token_hash: ringToken, ip_hash: ringIp, subnet_hash: ringSubnet },
      { user_id: 'r3', device_token_hash: ringToken, ip_hash: ringIp, subnet_hash: ringSubnet },
      { user_id: 'clean', device_token_hash: 'c'.repeat(64), ip_hash: 'd'.repeat(64), subnet_hash: 'e'.repeat(64) }
    ]
  });

  for (const rid of ['r1', 'r2', 'r3']) {
    const intel = result.riskByUserId[rid];
    assert.ok(intel.flags.includes('MULTI_ACCOUNT_RING'));
    assert.ok(intel.flags.includes('SHARED_IP_CLUSTER'));
    assert.ok(!intel.flags.includes('BAN_EVASION_RISK'));
    assert.equal(intel.linkedAccounts.length, 2);
    assert.ok(intel.riskScore >= 50);
    assert.ok(intel.matchedSignals.includes('Shared Device Token'));
    assert.ok(intel.matchedSignals.includes('Same IP Address'));
    assert.ok(intel.matchedSignals.includes('Same /24 Network Subnet'));
  }

  const cleanIntel = result.riskByUserId.clean;
  assert.equal(cleanIntel.riskScore, 0);
  assert.equal(cleanIntel.riskLevel, 'low');
  assert.deepEqual(cleanIntel.flags, []);
  assert.deepEqual(cleanIntel.matchedSignals, []);
  assert.deepEqual(cleanIntel.linkedAccounts, []);
});

test('does not escalate two users sharing only an office/cafe IP without hardware or abuse signals', () => {
  const sharedIp = 'f'.repeat(64);
  const result = computeRiskClusters({
    users: [
      { id: 'cafe1', name: 'Cafe 1', email: 'c1@example.com', role: 'owner', isBanned: false },
      { id: 'cafe2', name: 'Cafe 2', email: 'c2@example.com', role: 'owner', isBanned: false }
    ],
    deviceIdentities: [
      { user_id: 'cafe1', device_hash: '1'.repeat(64), identity_hash: '2'.repeat(64), ip_hash: sharedIp },
      { user_id: 'cafe2', device_hash: '3'.repeat(64), identity_hash: '4'.repeat(64), ip_hash: sharedIp }
    ]
  });

  const c1 = result.riskByUserId.cafe1;
  assert.equal(c1.riskLevel, 'low');
  assert.ok(c1.riskScore < 25);
  assert.ok(c1.flags.includes('SHARED_IP_CLUSTER'));
  assert.ok(!c1.flags.includes('MULTI_ACCOUNT_RING'));
  assert.ok(!c1.flags.includes('BAN_EVASION_RISK'));
});

test('correlates canonical Gmail aliases, normalized phones, blocked signals, and abuse events', () => {
  const blockedFp = '9'.repeat(64);
  const result = computeRiskClusters({
    users: [
      { id: 'u_alias1', name: 'Ali 1', email: 'john.doe+shop@gmail.com', phone: '01712345678', role: 'owner', isBanned: false },
      { id: 'u_alias2', name: 'Ali 2', email: 'johndoe@googlemail.com', phone: '+8801712345678', role: 'owner', isBanned: false }
    ],
    topupSignals: [
      { user_id: 'u_alias1', device_fingerprint_hash: blockedFp }
    ],
    blockedIdentities: [
      { signal_type: 'fingerprint', signal_hash: blockedFp, is_active: true, reason: 'Blocked device' }
    ],
    securityEvents: [
      { user_id: 'u_alias1', event_type: 'free_tier_abuse_blocked', severity: 'critical', remote_ip: '203.0.113.10', created_at: '2026-11-10T10:00:00Z' }
    ],
    loginLocations: [
      { user_id: 'u_alias1', location_source: 'ip', formatted_address: 'Dhaka, Bangladesh', captured_at: '2026-11-10T10:05:00Z' }
    ]
  });

  const intel1 = result.riskByUserId.u_alias1;
  assert.ok(intel1.matchedSignals.includes('Alias/Duplicate Contact'));
  assert.ok(intel1.flags.includes('MULTI_ACCOUNT_RING'));
  assert.ok(intel1.flags.includes('BLOCKED_SIGNAL_MATCH'));
  assert.ok(intel1.flags.includes('FREE_TIER_ABUSE_SIGNAL'));
  assert.equal(intel1.lastIp, '203.0.113.10');
  assert.equal(intel1.lastLocation, 'Dhaka, Bangladesh');
  assert.equal(intel1.securityEventCount, 1);
});

test('protects admin and super_admin accounts when banLinkedCluster filters targets', async () => {
  const targetUser = { id: 'u_target', name: 'Target', email: 'target@example.com', role: 'owner', isBanned: false };
  const linkedAccounts = [
    { id: 'u_sibling_active', name: 'Active Sibling', email: 'sib@example.com', role: 'owner', isBanned: false },
    { id: 'u_sibling_banned', name: 'Already Banned', email: 'old@example.com', role: 'owner', isBanned: true },
    { id: 'u_admin', name: 'Staff Admin', email: 'admin@example.com', role: 'admin', isBanned: false },
    { id: 'u_super', name: 'Super Admin', email: 'tiwloltd@gmail.com', role: 'super_admin', isBanned: false }
  ];

  const { targets, skippedAdmins } = selectClusterBanTargets({
    targetUser,
    linkedAccounts,
    banLinkedCluster: true
  });

  assert.deepEqual(targets.map((t) => t.id), ['u_target', 'u_sibling_active']);
  assert.deepEqual(skippedAdmins.map((a) => a.id), ['u_admin', 'u_super']);

  // Also test executeClusterBanAction with mock deps
  const sqlCalls = [];
  const events = [];
  const execResult = await executeClusterBanAction({
    targetUser,
    actorEmail: 'tiwloltd@gmail.com',
    isBanned: true,
    reason: 'Cluster ban test',
    banLinkedCluster: true,
    blockDeviceSignals: true,
    linkedAccountsOverride: linkedAccounts,
    deps: {
      pgActive: true,
      query: async (sql, params) => {
        sqlCalls.push({ sql, params });
        return { rows: [], rowCount: 1 };
      },
      recordEvent: async (ev) => {
        events.push(ev);
      },
      collectSignals: async (userIds) => {
        assert.deepEqual(userIds, ['u_target', 'u_sibling_active']);
        return [{ signalType: 'fingerprint', signalHash: 'f'.repeat(64), sourceUserId: 'u_target' }];
      }
    }
  });

  assert.equal(execResult.affectedUsers.length, 2);
  assert.equal(execResult.skippedAdmins.length, 2);
  assert.equal(execResult.blockedSignalsCount, 1);
  assert.ok(!sqlCalls.some((c) => c.params?.includes('u_admin') || c.params?.includes('u_super')));
  assert.equal(events.length, 2);

  await assert.rejects(
    () => executeClusterBanAction({
      targetUser: { id: 'u_super', email: 'tiwloltd@gmail.com', role: 'super_admin' },
      actorEmail: 'admin@example.com',
      isBanned: true
    }),
    (err) => err.statusCode === 403
  );
});

test('strictly isolates Super Admin login activity, IPs, devices, and links from non-super-admin viewers', () => {
  const sharedFp = '7'.repeat(64);
  const users = [
    { id: 'sa_1', name: 'Root Owner', email: 'tiwloltd@gmail.com', role: 'super_admin', isBanned: false },
    { id: 'staff_1', name: 'Test Store', email: 'test@example.com', role: 'owner', isBanned: false }
  ];
  const deviceIdentities = [
    { user_id: 'sa_1', device_hash: sharedFp, identity_hash: '8'.repeat(64), ip_hash: '9'.repeat(64) },
    { user_id: 'staff_1', device_hash: sharedFp, identity_hash: '0'.repeat(64), ip_hash: '9'.repeat(64) }
  ];
  const securityEvents = [
    { id: 1, user_id: 'sa_1', event_type: 'auth.new_device_login', severity: 'warning', remote_ip: '198.51.100.42', created_at: '2026-11-15T10:00:00Z' }
  ];
  const loginLocations = [
    { user_id: 'sa_1', location_source: 'gps', formatted_address: 'Secret HQ, Dhaka', captured_at: '2026-11-15T10:00:00Z' }
  ];

  // Non-super-admin viewer MUST NOT see any super_admin activity, IP, location, or link
  const restrictedView = computeRiskClusters({
    users,
    deviceIdentities,
    securityEvents,
    loginLocations,
    viewerIsSuperAdmin: false
  });

  const saIntelRestricted = restrictedView.riskByUserId.sa_1;
  assert.equal(saIntelRestricted.protectedAccount, true);
  assert.equal(saIntelRestricted.lastIp, null);
  assert.equal(saIntelRestricted.lastLocation, null);
  assert.equal(saIntelRestricted.deviceCount, 0);
  assert.equal(saIntelRestricted.securityEventCount, 0);
  assert.deepEqual(saIntelRestricted.linkedAccounts, []);

  // Even the non-admin user must NOT see the super_admin as a linked sibling
  const staffIntelRestricted = restrictedView.riskByUserId.staff_1;
  assert.deepEqual(staffIntelRestricted.linkedAccounts, []);
  assert.equal(staffIntelRestricted.riskScore, 0);

  // Super Admin viewer CAN see full intelligence
  assert.equal(isSuperAdminAccount(users[0]), true);
  const superAdminView = computeRiskClusters({
    users,
    deviceIdentities,
    securityEvents,
    loginLocations,
    viewerIsSuperAdmin: true
  });
  assert.equal(superAdminView.riskByUserId.sa_1.lastIp, '198.51.100.42');
  assert.equal(superAdminView.riskByUserId.sa_1.lastLocation, 'Secret HQ, Dhaka');
  assert.equal(superAdminView.riskByUserId.sa_1.linkedAccounts[0].id, 'staff_1');
});
