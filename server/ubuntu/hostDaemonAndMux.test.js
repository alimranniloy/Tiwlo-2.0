import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { acceptWebSocketUpgrade, connectWebSocketClient } from './host-daemon/rfc6455.mjs';
import {
  buildDockerRunArgs,
  sanitizeAccessUsername,
  sanitizeDropletId,
  sanitizeGatewayUser,
  sanitizeTenantSlug,
  verifyScryptPassword
} from './host-daemon/tiwlo-vps-daemon.mjs';
import {
  buildSshGatewayUsername,
  formatGatewaySshCommand,
  resolvePublicSshGatewayHost
} from './hostProvisionerClient.js';
import {
  consumeVpsTerminalTicket,
  issueVpsTerminalTicket
} from './vpsTerminalWs.js';

function createCloudPasswordHash(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

test('verifyScryptPassword validates cloud_droplets scrypt hashes safely in constant time', () => {
  const hash = createCloudPasswordHash('Sup3rS3cret!Pass ');
  assert.equal(verifyScryptPassword('Sup3rS3cret!Pass ', hash), true);
  assert.equal(verifyScryptPassword('Sup3rS3cret!Pass', hash), false);
  assert.equal(verifyScryptPassword('wrong-password', hash), false);
  assert.equal(verifyScryptPassword('', hash), false);
  assert.equal(verifyScryptPassword('anything', 'invalid-hash-format'), false);
  assert.equal(verifyScryptPassword('anything', null), false);
});

test('host daemon sanitizers block injection attempts and enforce strict naming', () => {
  assert.equal(sanitizeDropletId('drp_7f9d977797c048ee'), 'drp_7f9d977797c048ee');
  assert.throws(() => sanitizeDropletId('../etc/passwd'));
  assert.throws(() => sanitizeDropletId('drp_1;rm -rf /'));

  assert.equal(sanitizeTenantSlug('tiwlo_dhk1_427_48ee'), 'tiwlo_dhk1_427_48ee');
  assert.throws(() => sanitizeTenantSlug('bad slug; ls'));

  assert.equal(sanitizeGatewayUser('twvps_tiwlo-dhk1-427'), 'twvps_tiwlo-dhk1-427');
  assert.throws(() => sanitizeGatewayUser('root'));
  assert.throws(() => sanitizeGatewayUser('twvps_this_username_is_definitely_way_too_long_for_linux'));

  assert.equal(sanitizeAccessUsername('root'), 'root');
  assert.equal(sanitizeAccessUsername(''), 'root');
  assert.throws(() => sanitizeAccessUsername('bad user'));
});

test('buildDockerRunArgs applies hardened network, dropped capabilities, DNS, and persistent mounts', () => {
  const args = buildDockerRunArgs({
    dropletId: 'drp_7f9d977797c048ee',
    tenantSlug: 'tiwlo_dhk1_427_48ee',
    hostname: 'tiwlo-dhk1-427',
    sshGatewayUser: 'twvps_tiwlo-dhk1-427',
    accessUsername: 'root',
    ramMb: 2048,
    cpuLimit: 2,
    internalIp: '10.20.4.12'
  });

  const joined = args.join(' ');
  assert.match(joined, /--name tiwlo-vps-drp_7f9d977797c048ee/);
  assert.match(joined, /--network tiwlo-vps-net/);
  assert.match(joined, /--dns 1\.1\.1\.1 --dns 8\.8\.8\.8/);
  assert.match(joined, /--cap-drop=SYS_ADMIN/);
  assert.match(joined, /--cap-drop=NET_RAW/);
  assert.match(joined, /--security-opt=no-new-privileges:true/);
  assert.match(joined, /--pids-limit=256/);
  assert.match(joined, /:\/root:rw/);
  assert.match(joined, /:\/home:rw/);
  assert.match(joined, /:\/srv:rw/);
});

test('buildSshGatewayUsername generates <=32 char POSIX usernames and avoids collisions', () => {
  const first = buildSshGatewayUsername({
    hostname: 'tiwlo-dhk1-427',
    dropletId: 'drp_7f9d977797c048ee'
  });
  assert.equal(first, 'twvps_tiwlo-dhk1-427');
  assert.ok(first.length <= 32);

  const taken = new Set([first]);
  const second = buildSshGatewayUsername({
    hostname: 'tiwlo-dhk1-427',
    dropletId: 'drp_abcdef1234567890',
    existingUsers: taken
  });
  assert.notEqual(second, first);
  assert.ok(second.startsWith('twvps_'));
  assert.ok(second.length <= 32);

  const longHost = buildSshGatewayUsername({
    hostname: 'super-long-production-kubernetes-worker-hostname-01',
    dropletId: 'drp_1234567890abcdef'
  });
  assert.ok(longHost.length <= 32);
  assert.match(longHost, /^twvps_[a-z0-9_-]{2,26}$/);
});

test('formatGatewaySshCommand and resolvePublicSshGatewayHost format IPv6 and hostnames without dead ports', () => {
  assert.equal(
    formatGatewaySshCommand({
      gatewayUser: 'twvps_tiwlo-dhk1-427',
      gatewayHost: '2401:f40:126f:f0:b62e:99ff:fe5b:df13'
    }),
    'ssh twvps_tiwlo-dhk1-427@[2401:f40:126f:f0:b62e:99ff:fe5b:df13]'
  );
  assert.equal(
    formatGatewaySshCommand({
      gatewayUser: 'twvps_tiwlo-dhk1-427',
      gatewayHost: 'ssh.tiwlo.com'
    }),
    'ssh twvps_tiwlo-dhk1-427@ssh.tiwlo.com'
  );

  const hostFromBridgeNode = resolvePublicSshGatewayHost({
    node: { ipAddress: '172.30.240.6', ipv6Address: '2401:f40:126f:f0:b62e:99ff:fe5b:df13' }
  });
  assert.equal(hostFromBridgeNode, '2401:f40:126f:f0:b62e:99ff:fe5b:df13');
});

test('RFC 6455 WebSocket server/client loopback exchange delivers bidirectional text messages and closes cleanly', async (t) => {
  const srv = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  srv.on('upgrade', (req, socket, head) => {
    const ws = acceptWebSocketUpgrade(req, socket, head);
    ws.on('message', ({ data }) => {
      ws.sendText(`echo:${data}`);
    });
  });

  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => srv.close(resolve)));

  const port = srv.address().port;
  const client = await connectWebSocketClient(`ws://127.0.0.1:${port}/terminal`);
  const received = await new Promise((resolve) => {
    client.once('message', ({ data }) => resolve(data));
    client.sendText('uname -a');
  });
  assert.equal(received, 'echo:uname -a');
  client.close(1000, 'done');
});

test('VPS terminal tickets are single-use and droplet-scoped', () => {
  const issued = issueVpsTerminalTicket({ userId: 'usr_1', dropletId: 'drp_abc' });
  assert.ok(issued.ticket);
  assert.equal(consumeVpsTerminalTicket(issued.ticket, 'drp_other'), null);

  const fresh = issueVpsTerminalTicket({ userId: 'usr_1', dropletId: 'drp_abc' });
  const firstConsume = consumeVpsTerminalTicket(fresh.ticket, 'drp_abc');
  assert.deepEqual(
    { userId: firstConsume?.userId, dropletId: firstConsume?.dropletId },
    { userId: 'usr_1', dropletId: 'drp_abc' }
  );
  // Replay must fail immediately
  assert.equal(consumeVpsTerminalTicket(fresh.ticket, 'drp_abc'), null);
});
