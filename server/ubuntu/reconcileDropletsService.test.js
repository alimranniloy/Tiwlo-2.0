import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileExistingDropletsWithHost } from './reconcileDropletsService.js';

test('reconcileExistingDropletsWithHost repairs primary node IPv6, backfills legacy droplet ports/gateway user, and provisions host containers', async () => {
  const queries = [];
  const primaryNode = {
    id: 'primary-ubuntu-node',
    ip_address: '172.30.240.6',
    ipv6_address: ''
  };
  const droplets = [
    {
      id: 'drp_7f9d977797c048ee',
      user_id: 'usr_1',
      name: 'tiwlo-dhk1-427',
      vcpus: 1,
      memory: '1 GB',
      storage: '25 GB NVMe',
      ip: 'Unavailable',
      internal_ip: null,
      ipv6: '2401:f40:126f:f0:812c:ee88:c613:4d68',
      status: 'active',
      access_username: 'root',
      access_password_hash: 'scrypt:deadbeef:cafebabe',
      ssh_port: 22001,
      ssh_gateway_user: null,
      tenant_id: 'tnt_1',
      node_id: 'primary-ubuntu-node',
      tenant_slug: 'tiwlo_dhk1_427_c048ee',
      ram_limit_mb: 1024,
      cpu_quota_percent: 100,
      storage_limit_gb: 25
    }
  ];

  const mockQuery = async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes('UPDATE system_server_nodes')) {
      if (params[1]) primaryNode.ip_address = params[1];
      if (params[2]) primaryNode.ipv6_address = params[2];
      return { rows: [{ id: primaryNode.id }] };
    }
    if (sql.includes('FROM cloud_droplets')) {
      return { rows: droplets };
    }
    if (sql.includes('UPDATE cloud_droplets')) {
      const target = droplets.find((d) => d.id === params[0]);
      if (target) {
        target.ssh_gateway_user = params[1];
        target.ssh_port = 22;
        target.internal_ip = params[2];
        target.ip = params[3];
      }
      return { rowCount: 1, rows: [] };
    }
    return { rows: [], rowCount: 0 };
  };

  let sentReconcilePayloads = null;
  const mockReconcile = async (items) => {
    sentReconcilePayloads = items;
    return { ok: true, reconciled: items.length, started: items.length, stopped: 0 };
  };
  const mockHealth = async () => ({
    ok: true,
    networkAddresses: {
      ipv4: ['192.168.0.242'],
      ipv6: ['2401:f40:126f:f0:b62e:99ff:fe5b:df13']
    }
  });

  const prevIpv6 = process.env.VITE_SERVER_IPV6;
  process.env.VITE_SERVER_IPV6 = '2401:f40:126f:f0:b62e:99ff:fe5b:df13';
  try {
    const result = await reconcileExistingDropletsWithHost({
      queryFn: mockQuery,
      reconcileFn: mockReconcile,
      fetchHealthFn: mockHealth
    });

    assert.equal(result.ok, true);
    assert.equal(result.primaryNodeUpdated, true);
    assert.equal(primaryNode.ipv6_address, '2401:f40:126f:f0:b62e:99ff:fe5b:df13');
    assert.equal(result.totalDroplets, 1);
    assert.equal(result.dbBackfilledCount, 1);
    assert.equal(droplets[0].ssh_gateway_user, 'twvps_tiwlo-dhk1-427');
    assert.equal(droplets[0].ssh_port, 22);
    assert.ok(droplets[0].internal_ip);
    assert.equal(sentReconcilePayloads.length, 1);
    assert.deepEqual(sentReconcilePayloads[0], {
      dropletId: 'drp_7f9d977797c048ee',
      tenantSlug: 'tiwlo_dhk1_427_c048ee',
      hostname: 'tiwlo-dhk1-427',
      sshGatewayUser: 'twvps_tiwlo-dhk1-427',
      accessUsername: 'root',
      accessPasswordHash: 'scrypt:deadbeef:cafebabe',
      ramMb: 1024,
      cpuLimit: 1,
      storageGb: 25,
      internalIp: droplets[0].internal_ip,
      status: 'active'
    });
  } finally {
    if (prevIpv6 === undefined) delete process.env.VITE_SERVER_IPV6;
    else process.env.VITE_SERVER_IPV6 = prevIpv6;
  }
});
