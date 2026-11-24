import net from 'node:net';
import { isPgActive, queryPg } from '../db/postgres.js';
import {
  ensureUbuntuTenantSchema,
  registerUbuntuTenant
} from './tenantLayout.js';
import {
  buildSshGatewayUsername,
  fetchHostNodeHealth,
  reconcileDropletsOnHost,
  resolveHostProvisionerConfig
} from './hostProvisionerClient.js';
import { allocateInternalDeviceIp, isPublicRoutableIpv4 } from './sshGatewayService.js';

function isValidPublicV4(candidate) {
  const s = String(candidate || '').trim();
  return net.isIPv4(s) && isPublicRoutableIpv4(s);
}

function isValidGlobalV6(candidate) {
  const s = String(candidate || '').trim().replace(/^\[|\]$/g, '');
  if (!net.isIPv6(s)) return false;
  const lower = s.toLowerCase();
  return lower !== '::1' && !lower.startsWith('fe80:') && !lower.startsWith('fc') && !lower.startsWith('fd');
}

function parseRamMb(memoryStr, tenantRamMb) {
  if (Number.isFinite(Number(tenantRamMb)) && Number(tenantRamMb) >= 128) {
    return Number(tenantRamMb);
  }
  const m = String(memoryStr || '').match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (m) return Math.max(256, Math.round(Number(m[1]) * 1024));
  const mbMatch = String(memoryStr || '').match(/(\d+)\s*MB/i);
  if (mbMatch) return Math.max(256, Number(mbMatch[1]));
  return 1024;
}

function parseStorageGb(storageStr, tenantStorageGb) {
  if (Number.isFinite(Number(tenantStorageGb)) && Number(tenantStorageGb) >= 1) {
    return Number(tenantStorageGb);
  }
  const m = String(storageStr || '').match(/(\d+)/);
  return m ? Math.max(1, Number(m[1])) : 10;
}

function parseCpuLimit(vcpus, tenantCpuQuotaPct) {
  if (Number.isFinite(Number(tenantCpuQuotaPct)) && Number(tenantCpuQuotaPct) > 0) {
    return Math.max(0.25, Number((Number(tenantCpuQuotaPct) / 100).toFixed(2)));
  }
  return Math.max(0.25, Number(vcpus) || 1);
}

/**
 * Repairs primary node IP metadata, migrates legacy high-port/unconfigured droplet rows
 * in PostgreSQL, and reconciles live containers + Port 22 SSH multiplexer accounts on host.
 */
export async function reconcileExistingDropletsWithHost({
  queryFn = null,
  reconcileFn = reconcileDropletsOnHost,
  fetchHealthFn = fetchHostNodeHealth,
  registerTenantFn = registerUbuntuTenant
} = {}) {
  const runQuery = typeof queryFn === 'function' ? queryFn : isPgActive() ? queryPg : null;
  if (!runQuery) {
    return { ok: true, skipped: 'postgres_inactive', totalDroplets: 0, reconciled: 0 };
  }

  await runQuery(`ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ssh_gateway_user VARCHAR(64)`).catch(() => {});
  await runQuery(`ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS internal_ip VARCHAR(64)`).catch(() => {});

  const hostHealth = await fetchHealthFn().catch(() => null);
  const hostV4 = (hostHealth?.networkAddresses?.ipv4 || []).find((ip) => isValidPublicV4(ip)) || null;
  const hostV6 = (hostHealth?.networkAddresses?.ipv6 || []).find((ip) => isValidGlobalV6(ip)) || null;
  const resolvedPublicIpv4 = isValidPublicV4(process.env.VITE_SERVER_IPV4) ? String(process.env.VITE_SERVER_IPV4).trim() : hostV4;
  const resolvedPublicIpv6 = isValidGlobalV6(process.env.VITE_SERVER_IPV6) ? String(process.env.VITE_SERVER_IPV6).trim() : hostV6;

  let primaryNodeUpdated = false;
  if (resolvedPublicIpv4 || resolvedPublicIpv6) {
    const updRes = await runQuery(
      `UPDATE system_server_nodes
       SET ip_address = COALESCE(NULLIF($2, ''), ip_address),
           ipv6_address = COALESCE(NULLIF($3, ''), ipv6_address),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = 'primary-ubuntu-node'
       RETURNING id`,
      ['primary-ubuntu-node', resolvedPublicIpv4 || '', resolvedPublicIpv6 || '']
    ).catch(() => ({ rows: [] }));
    primaryNodeUpdated = (updRes.rows?.length || 0) > 0;
  }

  let tenantJoinAvailable = true;
  let dropletRowsRes;
  try {
    dropletRowsRes = await runQuery(
      `SELECT d.*, t.tenant_slug, t.ram_limit_mb, t.cpu_quota_percent, t.storage_limit_gb
       FROM cloud_droplets d
       LEFT JOIN system_ubuntu_tenants t ON t.id = d.tenant_id
       WHERE LOWER(COALESCE(d.status, 'active')) <> 'deleted'
       ORDER BY d.created_at ASC`
    );
  } catch {
    tenantJoinAvailable = false;
    dropletRowsRes = await runQuery(
      `SELECT * FROM cloud_droplets WHERE LOWER(COALESCE(status, 'active')) <> 'deleted' ORDER BY created_at ASC`
    );
  }

  const rows = dropletRowsRes.rows || [];
  const takenGatewayUsers = new Set(
    rows
      .map((r) => String(r.ssh_gateway_user || '').trim().toLowerCase())
      .filter((u) => u.startsWith('twvps_'))
  );

  const reconcilePayloads = [];
  let dbBackfilledCount = 0;

  for (const row of rows) {
    const dropletId = String(row.id);
    const hostname = String(row.name || dropletId).trim().toLowerCase();
    const accessUsername = String(row.access_username || 'root').trim().toLowerCase() || 'root';
    const internalIp = row.internal_ip || allocateInternalDeviceIp(dropletId);
    const ramMb = parseRamMb(row.memory, row.ram_limit_mb);
    const storageGb = parseStorageGb(row.storage, row.storage_limit_gb);
    const cpuLimit = parseCpuLimit(row.vcpus, row.cpu_quota_percent);

    let sshGatewayUser = row.ssh_gateway_user ? String(row.ssh_gateway_user).trim().toLowerCase() : null;
    const hadLegacyHighPort = Number(row.ssh_port || 0) > 22;
    let needsDbUpdate = false;

    if (!sshGatewayUser || !sshGatewayUser.startsWith('twvps_')) {
      sshGatewayUser = buildSshGatewayUsername({
        hostname,
        dropletId,
        existingUsers: takenGatewayUsers
      });
      takenGatewayUsers.add(sshGatewayUser);
      needsDbUpdate = true;
    }

    let tenantSlug = row.tenant_slug || null;
    let tenantId = row.tenant_id || null;
    if (!tenantSlug && typeof registerTenantFn === 'function') {
      try {
        if (!queryFn) await ensureUbuntuTenantSchema().catch(() => {});
        const slugCandidate = `${hostname}_${dropletId.slice(-6)}`.replace(/[^a-z0-9_]/g, '_');
        const createdTenant = await registerTenantFn({
          userId: row.user_id,
          tenantSlug: slugCandidate,
          nodeId: row.node_id || 'primary-ubuntu-node',
          ramLimitMb: ramMb,
          cpuQuotaPercent: Math.round(cpuLimit * 100),
          storageLimitGb: storageGb
        });
        tenantSlug = createdTenant.tenantSlug;
        tenantId = createdTenant.tenantId;
        needsDbUpdate = true;
      } catch {}
    }
    if (!tenantSlug) {
      tenantSlug = `${hostname.replace(/[^a-z0-9_]/g, '_')}_${dropletId.slice(-6)}`.slice(0, 36);
    }

    const nextIp = resolvedPublicIpv4 || (isValidPublicV4(row.ip) ? row.ip : 'Unavailable');
    if (needsDbUpdate || hadLegacyHighPort || row.internal_ip !== internalIp || row.ip !== nextIp) {
      await runQuery(
        `UPDATE cloud_droplets
         SET ssh_gateway_user = $2,
             ssh_port = 22,
             internal_ip = $3,
             ip = $4,
             tenant_id = COALESCE(tenant_id, $5)
         WHERE id = $1`,
        [dropletId, sshGatewayUser, internalIp, nextIp, tenantId]
      );
      dbBackfilledCount += 1;
    }

    const cleanStatus = String(row.status || 'active').trim().toLowerCase();
    reconcilePayloads.push({
      dropletId,
      tenantSlug,
      hostname,
      sshGatewayUser,
      accessUsername,
      accessPasswordHash: row.access_password_hash || null,
      ramMb,
      cpuLimit,
      storageGb,
      internalIp,
      status: cleanStatus
    });
  }

  let hostResult = { ok: true, reconciled: 0, skipped: 'no_droplets' };
  const cfg = resolveHostProvisionerConfig();
  if (reconcilePayloads.length > 0 && (reconcileFn !== reconcileDropletsOnHost || cfg.configured || cfg.useStubForTests)) {
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        hostResult = await reconcileFn(reconcilePayloads);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    if (lastErr) {
      return {
        ok: false,
        primaryNodeUpdated,
        tenantJoinAvailable,
        totalDroplets: rows.length,
        dbBackfilledCount,
        reconciled: 0,
        error: lastErr?.message || String(lastErr)
      };
    }
  }

  return {
    ok: true,
    primaryNodeUpdated,
    tenantJoinAvailable,
    totalDroplets: rows.length,
    dbBackfilledCount,
    reconciled: Number(hostResult?.reconciled || 0),
    hostResult
  };
}
