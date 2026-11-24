import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import {
  UNAVAILABLE_IPV4_LABEL,
  allocateInternalDeviceIp,
  buildDropletNetworkProfile,
  createSshBridgeSession,
  executeDropletSshCommand,
  isPublicRoutableIpv4,
  isPublicRoutableIpv6,
  resolveDropletSshTarget
} from './sshGatewayService.js';

function createMockSshClient({
  connectError = null,
  hangConnect = false,
  execError = null,
  hangExec = false,
  stdoutData = '',
  stderrData = '',
  exitCode = 0,
  onConnect = null,
  onExec = null
} = {}) {
  const client = new EventEmitter();
  client.ended = false;
  client.connectConfig = null;
  client.executedCommands = [];

  client.connect = (config) => {
    client.connectConfig = config;
    if (onConnect) onConnect(config);
    if (hangConnect) return;
    queueMicrotask(() => {
      if (connectError) {
        client.emit('error', connectError);
      } else {
        client.emit('ready');
      }
    });
  };

  client.exec = (command, cb) => {
    client.executedCommands.push(command);
    if (onExec) onExec(command);
    if (execError) {
      queueMicrotask(() => cb(execError));
      return;
    }

    const stream = new EventEmitter();
    stream.stderr = new EventEmitter();
    stream.closed = false;
    stream.close = () => {
      stream.closed = true;
    };
    stream.destroy = () => {
      stream.closed = true;
    };

    queueMicrotask(() => {
      cb(null, stream);
      if (hangExec) return;
      queueMicrotask(() => {
        if (stdoutData) {
          stream.emit('data', Buffer.from(stdoutData, 'utf8'));
        }
        if (stderrData) {
          stream.stderr.emit('data', Buffer.from(stderrData, 'utf8'));
        }
        stream.emit('close', exitCode, null);
      });
    });
  };

  client.shell = (opts, cb) => {
    const stream = new EventEmitter();
    stream.stderr = new EventEmitter();
    stream.written = [];
    stream.resized = [];
    stream.ended = false;
    stream.write = (data) => stream.written.push(data);
    stream.setWindow = (rows, cols) => stream.resized.push({ rows, cols });
    stream.end = () => {
      stream.ended = true;
      stream.emit('close');
    };
    queueMicrotask(() => cb(null, stream));
  };

  client.end = () => {
    client.ended = true;
  };

  return client;
}

test('isPublicRoutableIpv4 rejects private/reserved/CGNAT/loopback/link-local and allows real public IPv4', () => {
  const nonRoutable = [
    '192.168.1.50',
    '10.0.0.5',
    '172.16.5.2',
    '172.31.255.254',
    '100.64.1.10',
    '100.127.255.254',
    '127.0.0.1',
    '127.10.20.30',
    '169.254.1.1',
    '0.0.0.0',
    '0.10.20.30',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
    '',
    null,
    undefined,
    'not-an-ip',
    '198.51.100.42/24',
    '2001:db8::1'
  ];

  for (const ip of nonRoutable) {
    assert.equal(isPublicRoutableIpv4(ip), false, `Expected ${String(ip)} to be rejected`);
  }

  const routable = [
    '198.51.100.42',
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '223.255.255.254'
  ];

  for (const ip of routable) {
    assert.equal(isPublicRoutableIpv4(ip), true, `Expected ${ip} to be accepted as public routable`);
  }
});

test('isPublicRoutableIpv6 rejects local/special IPv6 scopes and accepts Global Unicast addresses', () => {
  const nonRoutableV6 = [
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456:789a::1',
    'ff02::1',
    '100::1',
    '::ffff:192.168.1.1',
    '::ffff:8.8.8.8',
    '2001:db8::/64',
    'fe80::1%eth0',
    '192.168.1.1',
    ''
  ];

  for (const ip of nonRoutableV6) {
    assert.equal(isPublicRoutableIpv6(ip), false, `Expected ${ip} to be rejected`);
  }

  assert.equal(isPublicRoutableIpv6('2001:db8:10:20::42'), true);
  assert.equal(isPublicRoutableIpv6('[2001:db8:10:20::42]'), true);
  assert.equal(isPublicRoutableIpv6('2606:4700:4700::1111'), true);
});

test('allocateInternalDeviceIp deterministically generates valid 10.20.x.y VPC IPs without .0 or .255', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const id = `drp_vpc_${i}`;
    const ip = allocateInternalDeviceIp(id);
    assert.equal(net.isIPv4(ip), true);
    assert.equal(isPublicRoutableIpv4(ip), false);

    const parts = ip.split('.').map(Number);
    assert.equal(parts[0], 10);
    assert.equal(parts[1], 20);
    assert.ok(parts[2] >= 1 && parts[2] <= 254, `octet3 must be 1..254, got ${parts[2]}`);
    assert.ok(parts[3] >= 1 && parts[3] <= 254, `octet4 must be 1..254, got ${parts[3]}`);

    // Deterministic for same input
    assert.equal(allocateInternalDeviceIp(id), ip);
    seen.add(ip);
  }

  assert.ok(seen.size > 190, 'Expected high uniqueness across 200 droplet IDs');
  assert.notEqual(allocateInternalDeviceIp('drp_collision_test', 0), allocateInternalDeviceIp('drp_collision_test', 1));
  assert.throws(() => allocateInternalDeviceIp(''));
});

test('buildDropletNetworkProfile distinguishes IPv6-only LAN node vs node after gaining a real Public IPv4', () => {
  const droplet = {
    id: 'drp_ubuntu_101',
    accessUsername: 'root',
    sshPort: 22015,
    ipv6: '2001:0db8:0010:0020::0042'
  };

  // 1) IPv6-only node with private LAN IPv4 (192.168.1.10)
  const ipv6OnlyNode = {
    id: 'node-dhk-lan-1',
    ipAddress: '192.168.1.10',
    networkAddresses: {
      ipv4: ['192.168.1.10', '100.64.2.5'],
      ipv6: ['2001:db8:10:20::1']
    }
  };

  const ipv6OnlyProfile = buildDropletNetworkProfile({
    droplet,
    node: ipv6OnlyNode,
    cloudflareRelayHost: 'ssh-relay.tiwlo.com',
    bastionHost: 'jump.tiwlo.com'
  });

  assert.equal(ipv6OnlyProfile.publicIpv4, null);
  assert.equal(ipv6OnlyProfile.publicIpv4Available, false);
  assert.equal(ipv6OnlyProfile.publicIpv4Label, UNAVAILABLE_IPV4_LABEL);
  assert.equal(ipv6OnlyProfile.sharedPublicIpv4, false);
  assert.equal(ipv6OnlyProfile.nodePrivateIpv4, '192.168.1.10');
  assert.equal(ipv6OnlyProfile.ipv6, '2001:db8:10:20::42');
  assert.equal(ipv6OnlyProfile.publicIpv6Available, true);
  assert.match(ipv6OnlyProfile.internalIp, /^10\.20\.\d{1,3}\.\d{1,3}$/);
  assert.equal(ipv6OnlyProfile.connectivityMode, 'ipv6-only');
  assert.equal(ipv6OnlyProfile.relayRequiredForIpv4Clients, true);
  assert.equal(ipv6OnlyProfile.ipv4SshCommand, null);
  assert.equal(ipv6OnlyProfile.ipv6SshCommand, 'ssh root@2001:db8:10:20::42 -p 22015');
  assert.equal(ipv6OnlyProfile.primarySshCommand, 'ssh root@2001:db8:10:20::42 -p 22015');
  assert.equal(
    ipv6OnlyProfile.bastionProxyCommand,
    'ssh -J jump.tiwlo.com root@2001:db8:10:20::42 -p 22015'
  );
  assert.equal(
    ipv6OnlyProfile.cloudflareAccessCommand,
    'ssh -o ProxyCommand="cloudflared access ssh --hostname ssh-relay.tiwlo.com" root@ssh-relay.tiwlo.com -p 22015'
  );
  assert.equal(ipv6OnlyProfile.webTerminalSupported, true);

  // 2) Same node after gaining a real Public IPv4 (198.51.100.42)
  const dualStackNode = {
    id: 'node-dhk-lan-1',
    ipAddress: '192.168.1.10',
    networkAddresses: {
      ipv4: ['192.168.1.10', '198.51.100.42'],
      ipv6: ['2001:db8:10:20::1']
    }
  };

  const dualStackProfile = buildDropletNetworkProfile({
    droplet,
    node: dualStackNode,
    cloudflareRelayHost: 'ssh-relay.tiwlo.com',
    bastionHost: 'jump.tiwlo.com'
  });

  assert.equal(dualStackProfile.publicIpv4, '198.51.100.42');
  assert.equal(dualStackProfile.publicIpv4Available, true);
  assert.equal(dualStackProfile.publicIpv4Label, '198.51.100.42');
  assert.equal(dualStackProfile.sharedPublicIpv4, true);
  assert.equal(dualStackProfile.publicIpv6Available, true);
  assert.equal(dualStackProfile.internalIp, ipv6OnlyProfile.internalIp);
  assert.equal(dualStackProfile.connectivityMode, 'dual-stack');
  assert.equal(dualStackProfile.relayRequiredForIpv4Clients, false);
  assert.equal(dualStackProfile.ipv4SshCommand, 'ssh root@198.51.100.42 -p 22015');
  assert.equal(dualStackProfile.primarySshCommand, 'ssh root@198.51.100.42 -p 22015');
  assert.equal(dualStackProfile.ipv6SshCommand, 'ssh root@2001:db8:10:20::42 -p 22015');
  assert.equal(dualStackProfile.webTerminalSupported, true);
});

test('resolveDropletSshTarget picks public IPv4 first, or IPv6 when IPv6-only', () => {
  const droplet = { id: 'drp_1', sshPort: 22005, ipv6: '2001:db8:10:20::55' };

  const v6Target = resolveDropletSshTarget({
    droplet,
    node: { ipAddress: '192.168.1.10', networkAddresses: { ipv4: ['192.168.1.10'] } }
  });
  assert.deepEqual(v6Target, {
    host: '2001:db8:10:20::55',
    port: 22005,
    username: 'root',
    family: 6
  });

  const v4Target = resolveDropletSshTarget({
    droplet,
    node: { ipAddress: '198.51.100.42' }
  });
  assert.deepEqual(v4Target, {
    host: '198.51.100.42',
    port: 22005,
    username: 'root',
    family: 4
  });
});

test('executeDropletSshCommand runs bounded remote command via injected sshConnectFn and enforces safety checks', async () => {
  const mockClient = createMockSshClient({
    stdoutData: 'Ubuntu 24.04 LTS\n',
    stderrData: '',
    exitCode: 0
  });

  const res = await executeDropletSshCommand({
    targetHost: '[2001:db8:10:20::42]',
    sshPort: 22015,
    username: 'root',
    password: 'super-secret-password',
    command: 'lsb_release -ds',
    sshConnectFn: () => mockClient
  });

  assert.equal(mockClient.connectConfig.host, '2001:db8:10:20::42');
  assert.equal(mockClient.connectConfig.port, 22015);
  assert.equal(mockClient.connectConfig.username, 'root');
  assert.equal(mockClient.connectConfig.password, 'super-secret-password');
  assert.deepEqual(mockClient.executedCommands, ['lsb_release -ds']);
  assert.equal(mockClient.ended, true);
  assert.equal(res.stdout, 'Ubuntu 24.04 LTS\n');
  assert.equal(res.stderr, '');
  assert.equal(res.exitCode, 0);
  assert.equal(res.truncated, false);

  // Command sanitization rejects null bytes and empty strings
  await assert.rejects(
    () =>
      executeDropletSshCommand({
        targetHost: '198.51.100.42',
        command: 'echo ok\0rm -rf /',
        sshConnectFn: () => createMockSshClient()
      }),
    /null bytes/i
  );

  await assert.rejects(
    () =>
      executeDropletSshCommand({
        targetHost: '198.51.100.42',
        command: '   ',
        sshConnectFn: () => createMockSshClient()
      }),
    /empty/i
  );

  // Output capping
  const noisyClient = createMockSshClient({
    stdoutData: 'A'.repeat(4096),
    exitCode: 0
  });
  const capped = await executeDropletSshCommand({
    targetHost: '198.51.100.42',
    command: 'cat /var/log/syslog',
    maxOutputBytes: 1024,
    sshConnectFn: () => noisyClient
  });
  assert.equal(capped.truncated, true);
  assert.equal(Buffer.byteLength(capped.stdout, 'utf8'), 1024);

  // Timeout enforcement
  const hungClient = createMockSshClient({ hangExec: true });
  await assert.rejects(
    () =>
      executeDropletSshCommand({
        targetHost: '198.51.100.42',
        command: 'sleep 60',
        timeoutMs: 60,
        sshConnectFn: () => hungClient
      }),
    /timed out/i
  );
  assert.equal(hungClient.ended, true);
});

test('createSshBridgeSession establishes interactive PTY bridge via sshConnectFn', async () => {
  const mockClient = createMockSshClient();
  const session = await createSshBridgeSession({
    targetHost: '2001:db8:10:20::42',
    sshPort: 22015,
    username: 'root',
    password: 'pw',
    cols: 100,
    rows: 30,
    sshConnectFn: () => mockClient
  });

  const received = [];
  session.onData((chunk) => received.push(chunk.toString('utf8')));
  session.write('uname -a\n');
  session.resize(132, 40);
  session.close();

  assert.equal(session.targetHost, '2001:db8:10:20::42');
  assert.equal(mockClient.ended, true);
});
