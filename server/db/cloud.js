import crypto from 'node:crypto';
import { isPgActive, queryPg } from './postgres.js';
import { SHARED_UBUNTU_RUNTIME_IMAGE } from '../ubuntu/constants.js';
import { DROPLET_IMAGE_CATALOG, DROPLET_REGION_CATALOG } from './cloudCatalogConstants.js';
export { DROPLET_IMAGE_CATALOG, DROPLET_REGION_CATALOG };
import {
  ensureUbuntuTenantSchema,
  reclaimUbuntuTenant,
  registerUbuntuTenant,
  updateUbuntuTenantStatus
} from '../ubuntu/tenantLayout.js';
import {
  adjustNodeActiveDroplets,
  getServerNodeById,
  listServerNodes,
  selectBestClusterNodeForDroplet
} from '../administrator/serverFleetService.js';
import {
  getCustomBuilderConfig,
  getServerOsImageById,
  listServerOsImages,
  listServerPackages,
  resolveEffectivePackageForOrder
} from '../administrator/serverPackageService.js';
import {
  allocateDropletIpv6,
  ensureIpv6PoolSchema,
  formatIpv6SshCommand,
  holdDropletIpAllocations,
  releaseDropletIpAllocations,
  restoreDropletIpAllocations
} from '../ubuntu/ipv6PoolService.js';
import {
  allocateInternalDeviceIp,
  buildDropletNetworkProfile,
  isPublicRoutableIpv4
} from '../ubuntu/sshGatewayService.js';
import {
  ensureDropletBillingSchema,
  initializeMonthlyDropletSubscription,
  rollbackInitialDropletCharge
} from './cloudDropletBilling.js';
import {
  buildSshGatewayUsername,
  destroyDropletOnHost,
  formatGatewaySshCommand,
  getDropletStatsFromHost,
  provisionDropletOnHost,
  resolvePublicSshGatewayHost,
  setDropletPowerOnHost
} from '../ubuntu/hostProvisionerClient.js';

function mapDroplet(row, { node = null } = {}) {
  if (!row) return null;
  const { access_password_hash: _omit, ...safeRow } = row;
  const accessUsername = row.access_username || 'root';
  const sshGatewayUser = row.ssh_gateway_user || buildSshGatewayUsername({ hostname: row.name, dropletId: row.id });
  const sshGatewayHost = resolvePublicSshGatewayHost({ node, droplet: row });
  const sshGatewayCommand = formatGatewaySshCommand({ gatewayUser: sshGatewayUser, gatewayHost: sshGatewayHost });
  const rawSshPort = row.ssh_port ? Number(row.ssh_port) : null;
  const sshPort = sshGatewayCommand ? 22 : rawSshPort || 22;
  const publicIpValid = isPublicRoutableIpv4(row.ip);
  const ipv6 = row.ipv6 || null;
  const internalIp = row.internal_ip || allocateInternalDeviceIp(row.id);
  const sshCommand =
    sshGatewayCommand ||
    (publicIpValid && sshPort && sshPort !== 22
      ? `ssh ${accessUsername}@${row.ip} -p ${sshPort}`
      : publicIpValid
        ? `ssh ${accessUsername}@${row.ip}`
        : ipv6
          ? formatIpv6SshCommand({ username: accessUsername, ipv6, port: sshPort || 22 })
          : null);
  const sshIpv6Command =
    sshGatewayUser && sshGatewayHost && sshGatewayHost.includes(':')
      ? formatGatewaySshCommand({ gatewayUser: sshGatewayUser, gatewayHost: sshGatewayHost })
      : ipv6
        ? formatIpv6SshCommand({ username: accessUsername, ipv6, port: sshPort || 22 })
        : null;

  return {
    ...safeRow,
    ip: publicIpValid ? row.ip : sshGatewayHost || 'Unavailable',
    publicIpv4: publicIpValid ? row.ip : null,
    publicIpv4Available: publicIpValid,
    ipv6,
    ipv6Prefix: row.ipv6_prefix || null,
    internalIp,
    userId: row.user_id,
    regionCode: row.region_code,
    accessUsername,
    sshGatewayUser,
    sshGatewayHost,
    sshGatewayCommand,
    sshPort,
    sshCommand,
    sshIpv6Command,
    tenantId: row.tenant_id || null,
    nodeId: row.node_id || null,
    monthlyPrice: row.monthly_price !== null && row.monthly_price !== undefined ? Number(row.monthly_price) : null,
    billingCycle: row.billing_cycle || 'monthly',
    nextBillingAt: row.next_billing_at || null,
    graceUntil: row.grace_until || null,
    suspendedAt: row.suspended_at || null,
    purgeAt: row.purge_at || null,
    lastInvoiceId: row.last_invoice_id || null,
    createdAt: row.created_at
  };
}

function createInputError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function hashServerPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function normalizeFleetRegionId(rawRegion) {
  const val = String(rawRegion || '').trim().toLowerCase();
  if (!val) return null;
  if (val.includes('dhk') || val.includes('dhaka') || val === 'bd') return 'dhk1';
  if (val.includes('sgp') || val.includes('singapore') || val === 'ap-southeast-1') return 'sgp1';
  if (val.includes('fra') || val.includes('frankfurt') || val === 'eu-central-1') return 'fra1';
  if (val.includes('nyc') || val.includes('new york') || val === 'us-east-1') return 'nyc1';
  if (val.includes('lon') || val.includes('london') || val === 'eu-west-2') return 'lon1';
  if (val.includes('tyo') || val.includes('tokyo') || val === 'ap-northeast-1') return 'tyo1';
  if (val.includes('tor') || val.includes('toronto') || val === 'ca-central-1') return 'tor1';
  return val;
}

function normalizeDetectedOsToCatalogId(rawOs) {
  const val = String(rawOs || '').trim().toLowerCase();
  if (!val) return null;
  if (val.startsWith('ubuntu-24')) return 'ubuntu-24';
  if (val.startsWith('ubuntu-22')) return 'ubuntu-22';
  if (val.startsWith('debian-12')) return 'debian-12';
  if (val.startsWith('almalinux-9') || val.startsWith('rocky-9')) return 'almalinux-9';
  if (val.startsWith('fedora-40')) return 'fedora-40';
  return val;
}

export const CloudDB = {
  init() {},

  async getDropletCatalog() {
    const primaryRegionId = normalizeFleetRegionId(process.env.TIWLO_PRIMARY_REGION || 'dhk1') || 'dhk1';
    const availableRegionNodes = new Map([
      [primaryRegionId, 'primary-ubuntu-node']
    ]);
    const availableOsIds = new Set(['ubuntu-24']);
    let clusterPool = null;
    let adminPackages = [];
    let adminImages = [];
    let customBuilder = { enabled: false };

    if (isPgActive()) {
      try {
        const [fleet, pkgsRes, imgsRes, builderCfg] = await Promise.all([
          listServerNodes({ page: 1, pageSize: 200 }),
          listServerPackages({ includeInactive: false, page: 1, pageSize: 100 }).catch(() => ({ packages: [] })),
          listServerOsImages({ onlyAvailable: false }).catch(() => []),
          getCustomBuilderConfig().catch(() => ({ enabled: false }))
        ]);
        adminPackages = pkgsRes.packages || [];
        adminImages = Array.isArray(imgsRes) ? imgsRes : [];
        customBuilder = builderCfg || { enabled: false };

        for (const node of fleet.nodes || []) {
          const st = String(node.status || '').toLowerCase();
          if (!['online', 'healthy', 'connected', 'active', 'degraded'].includes(st)) continue;
          const regionId = normalizeFleetRegionId(node.region);
          if (regionId && !availableRegionNodes.has(regionId)) {
            availableRegionNodes.set(regionId, node.id);
          }
          const primaryOs = normalizeDetectedOsToCatalogId(node.detectedOsId);
          if (primaryOs) availableOsIds.add(primaryOs);
          for (const extraOs of node.capabilities?.osImages || []) {
            const norm = normalizeDetectedOsToCatalogId(extraOs);
            if (norm) availableOsIds.add(norm);
          }
        }
        if (fleet.summary) {
          clusterPool = {
            available: Number(fleet.summary.online || 0) > 0,
            onlineNodesCount: Number(fleet.summary.online || 0)
          };
        }
      } catch {
        // Ignore if server fleet schema is not initialized yet
      }
    }

    const regions = DROPLET_REGION_CATALOG.map((region) => ({
      id: region.id,
      name: region.name,
      code: region.code,
      flag: region.flag,
      flagUrl: region.flagUrl,
      available: availableRegionNodes.has(region.id)
    }));

    const mergedImageMap = new Map(DROPLET_IMAGE_CATALOG.map((img) => [img.id, { ...img }]));
    for (const admImg of adminImages) {
      mergedImageMap.set(admImg.id, {
        ...(mergedImageMap.get(admImg.id) || {}),
        ...admImg,
        badge: admImg.available ? 'Available' : 'Unavailable'
      });
    }

    const images = Array.from(mergedImageMap.values()).map((img) => {
      const adminExplicit = adminImages.find((a) => a.id === img.id);
      const isAvail = adminExplicit ? Boolean(adminExplicit.available) : availableOsIds.has(img.id);
      return {
        id: img.id,
        name: img.name,
        os: img.os,
        version: img.version,
        type: img.type,
        iconUrl: img.iconUrl,
        description: img.description,
        available: isAvail,
        monthlySurchargeUsd: Number(img.monthlySurchargeUsd || 0),
        badge: isAvail ? 'Available' : 'Unavailable'
      };
    });

    const customerPackages = adminPackages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      category: pkg.category,
      description: pkg.description,
      badge: pkg.badge || '',
      displayedVcpus: pkg.displayedVcpus,
      displayedRamGb: pkg.displayedRamGb,
      displayedStorageGb: pkg.displayedStorageGb,
      displayedBandwidthTb: pkg.displayedBandwidthTb,
      vcpus: pkg.displayedVcpus,
      ramGb: pkg.displayedRamGb,
      storageGb: pkg.displayedStorageGb,
      bandwidthTb: pkg.displayedBandwidthTb,
      monthlyPriceUsd: pkg.monthlyPriceUsd,
      monthlyPrice: pkg.monthlyPriceUsd,
      hourlyPriceUsd: pkg.hourlyPriceUsd,
      isPopular: Boolean(pkg.isPopular),
      isActive: Boolean(pkg.isActive),
      sortOrder: pkg.sortOrder
    }));

    return {
      images,
      regions,
      packages: customerPackages,
      customBuilder,
      clusterPool
    };
  },

  async checkDropletAvailability({ userId = null, hostname = '', username = '' } = {}) {
    const cleanHost = String(hostname || '').trim().toLowerCase();
    const cleanUser = String(username || '').trim().toLowerCase();

    const hostResult = {
      value: cleanHost,
      valid: false,
      available: false,
      reason: ''
    };
    if (!cleanHost) {
      hostResult.reason = 'Enter a hostname';
    } else if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(cleanHost)) {
      hostResult.reason = 'Use 3–63 lowercase letters, numbers, or hyphens';
    } else {
      hostResult.valid = true;
      hostResult.available = true;
      hostResult.reason = 'Available';
      if (isPgActive() && userId) {
        try {
          const { rows } = await queryPg(
            `SELECT 1 FROM cloud_droplets WHERE user_id = $1 AND LOWER(name) = $2 LIMIT 1`,
            [userId, cleanHost]
          );
          if (rows.length > 0) {
            hostResult.available = false;
            hostResult.reason = 'Already used in your account';
          }
        } catch {
          // If table isn't ready yet, leave format-valid
        }
      }
    }

    // Because each droplet lives inside its own isolated container namespace
    // with its own dedicated SSH port/IP, any valid Linux username (including 'root')
    // is permitted per droplet without colliding with other users or droplets.
    const userResult = {
      value: cleanUser,
      valid: false,
      available: false,
      reason: ''
    };
    if (!cleanUser) {
      userResult.reason = 'Enter a server username (e.g. root)';
    } else if (!/^[a-z_][a-z0-9_-]{1,31}$/.test(cleanUser)) {
      userResult.reason = 'Use 2–32 lowercase letters, numbers, _ or -';
    } else {
      userResult.valid = true;
      userResult.available = true;
      userResult.reason = 'Isolated per droplet';
    }

    return {
      hostname: hostResult,
      username: userResult
    };
  },

  async getDroplets(userId) {
    if (!userId) return [];
    const { rows } = await queryPg('SELECT * FROM cloud_droplets WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return rows.map(mapDroplet);
  },

  async getDropletById(id) {
    const { rows } = await queryPg('SELECT * FROM cloud_droplets WHERE id = $1', [id]);
    return mapDroplet(rows[0]);
  },

  async renameDroplet(userId, id, name) {
    const normalizedName = String(name || '').replace(/[\r\n\0<>'"]/g, '').trim();
    if (!normalizedName || normalizedName.length > 255) {
      throw createInputError('Droplet name must be between 1 and 255 characters without HTML or control characters.');
    }
    const { rows } = await queryPg(
      'UPDATE cloud_droplets SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [normalizedName, id, userId]
    );
    return mapDroplet(rows[0]);
  },

  async createDroplet(userId, payload = {}) {
    if (!userId) throw createInputError('User authentication is required.');

    const catalog = await this.getDropletCatalog();
    const requestedImage = String(payload.imageId || payload.image || '').trim();
    const selectedImage = catalog.images.find(
      (img) =>
        img.id === requestedImage ||
        img.name.toLowerCase() === requestedImage.toLowerCase() ||
        img.runtimeImage === requestedImage
    );
    if (!selectedImage || !selectedImage.available) {
      throw createInputError('Selected OS image is unavailable. Choose the connected Ubuntu server image.');
    }

    const requestedRegion = String(payload.regionId || payload.regionCode || payload.region || '').trim().toLowerCase();
    const selectedRegion = catalog.regions.find(
      (r) =>
        r.id === requestedRegion ||
        r.code.toLowerCase() === requestedRegion ||
        r.name.toLowerCase() === requestedRegion
    );
    if (!selectedRegion || !selectedRegion.available) {
      throw createInputError('Selected region is currently unavailable on connected servers.');
    }

    const hostname = String(payload.hostname || payload.name || '')
      .trim()
      .toLowerCase();
    const accessUsername = String(payload.username || payload.accessUsername || 'root')
      .trim()
      .toLowerCase();

    const availability = await this.checkDropletAvailability({
      userId,
      hostname,
      username: accessUsername
    });
    if (!availability.hostname.valid) {
      throw createInputError('Hostname must be 3–63 characters using lowercase letters, numbers, or hyphens.');
    }
    if (!availability.hostname.available) {
      throw createInputError('Hostname is already used in your account. Please choose a distinct hostname.', 409);
    }
    if (!availability.username.valid) {
      throw createInputError('Server username must be 2–32 characters (lowercase letters, numbers, underscore, or hyphen).');
    }

    const rawPassword = typeof payload.password === 'string' ? payload.password : '';
    if (rawPassword.length < 8 || rawPassword.length > 128) {
      throw createInputError('Server login password must be between 8 and 128 characters.');
    }

    const resolvedPkg = await resolveEffectivePackageForOrder({
      packageId: payload.packageId || 'pkg-micro',
      vcpus: payload.vcpus,
      ramGb: payload.ramGb,
      storageGb: payload.storageGb,
      imageId: selectedImage.id
    });

    const vcpus = resolvedPkg.displayedVcpus;
    const memory = `${resolvedPkg.displayedRamGb} GB`;
    const storage = `${resolvedPkg.displayedStorageGb} GB NVMe`;
    const storageLimitGb = Math.max(1, resolvedPkg.backendStorageGb);
    const ramLimitMb = Math.max(128, resolvedPkg.backendRamMb);
    const cpuQuotaPercent = resolvedPkg.backendCpuQuotaPct;
    const monthlyPrice = Number(resolvedPkg.monthlyPrice);
    const tags = typeof payload.tags === 'string' ? payload.tags.trim().slice(0, 255) : '';

    const fullImageRecord = await getServerOsImageById(selectedImage.id).catch(() => null);
    const staticImageRecord = DROPLET_IMAGE_CATALOG.find((img) => img.id === selectedImage.id);
    const serverRuntimeImage =
      fullImageRecord?.runtimeImage ||
      staticImageRecord?.runtimeImage ||
      SHARED_UBUNTU_RUNTIME_IMAGE;

    const dropletId = `drp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const uniqueSlug = `${hostname}_${dropletId.slice(-6)}`;

    // Pick best healthy node via weighted load balancer + automatic storage overflow across cluster nodes
    const chosenNode = await selectBestClusterNodeForDroplet({
      requiredStorageGb: storageLimitGb,
      requiredRamGb: Math.max(1, Math.round(ramLimitMb / 1024)),
      regionId: selectedRegion.id,
      imageId: selectedImage.id
    }).catch(() => null);
    const assignedNodeId = chosenNode?.id || 'primary-ubuntu-node';

    await ensureUbuntuTenantSchema();
    const tenant = await registerUbuntuTenant({
      userId,
      tenantSlug: uniqueSlug,
      nodeId: assignedNodeId,
      sharedImage: serverRuntimeImage,
      cpuQuotaPercent,
      ramLimitMb,
      storageLimitGb
    });

    await ensureIpv6PoolSchema().catch(() => {});
    await ensureDropletBillingSchema().catch(() => {});
    await queryPg('ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS ssh_gateway_user VARCHAR(64)').catch(() => {});

    const existingGwRes = await queryPg(
      'SELECT ssh_gateway_user FROM cloud_droplets WHERE ssh_gateway_user IS NOT NULL'
    ).catch(() => ({ rows: [] }));
    const takenGwUsers = new Set(existingGwRes.rows.map((r) => String(r.ssh_gateway_user || '').toLowerCase()));
    const sshGatewayUser = buildSshGatewayUsername({
      hostname,
      dropletId,
      existingUsers: takenGwUsers
    });
    const sshPort = 22;
    const passwordHash = hashServerPassword(rawPassword);
    const nodePublicIpCandidate = chosenNode?.ipAddress || process.env.VITE_SERVER_IPV4 || null;
    const serverIp = isPublicRoutableIpv4(nodePublicIpCandidate) ? nodePublicIpCandidate : 'Unavailable';
    const internalIp = allocateInternalDeviceIp(dropletId);
    const ipv6Alloc = await allocateDropletIpv6({
      nodeId: assignedNodeId,
      dropletId,
      preferredPrefix: chosenNode?.ipv6Address || process.env.VITE_SERVER_IPV6 || null
    }).catch(() => null);
    const dropletIpv6 = ipv6Alloc?.ipv6 || null;
    const dropletIpv6Prefix = ipv6Alloc?.prefix || null;
    const dropletIpv6Suffix = ipv6Alloc?.hostSuffix || null;
    const specs = `${vcpus} vCPU · ${memory} · ${storage}`;

    const { rows } = await queryPg(
      `INSERT INTO cloud_droplets (
         id, user_id, name, specs, vcpus, memory, storage, ip, internal_ip,
         ipv6, ipv6_prefix, ipv6_host_suffix,
         region, region_code, status, image, access_username, access_password_hash,
         ssh_gateway_user, ssh_port, tenant_id, node_id, tags, monthly_price, billing_cycle
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', $15, $16, $17, $18, $19, $20, $21, $22, $23, 'monthly')
       RETURNING *`,
      [
        dropletId,
        userId,
        hostname,
        specs,
        vcpus,
        memory,
        storage,
        serverIp,
        internalIp,
        dropletIpv6,
        dropletIpv6Prefix,
        dropletIpv6Suffix,
        `${selectedRegion.name} (${selectedRegion.code})`,
        selectedRegion.code,
        selectedImage.name,
        accessUsername,
        passwordHash,
        sshGatewayUser,
        sshPort,
        tenant.tenantId,
        assignedNodeId,
        tags,
        monthlyPrice
      ]
    );

    await adjustNodeActiveDroplets(assignedNodeId, 1).catch(() => {});

    const mappedDroplet = mapDroplet(rows[0], { node: chosenNode });
    const billingInit = await initializeMonthlyDropletSubscription({
      userId,
      droplet: mappedDroplet,
      monthlyPrice
    });

    if (monthlyPrice > 0 && billingInit?.invoice?.status !== 'paid') {
      await queryPg('DELETE FROM cloud_droplets WHERE id = $1 AND user_id = $2', [dropletId, userId]).catch(() => {});
      await releaseDropletIpAllocations({ dropletId }).catch(() => {});
      await reclaimUbuntuTenant({ tenantId: tenant.tenantId, userId }).catch(() => {});
      await adjustNodeActiveDroplets(assignedNodeId, -1).catch(() => {});
      throw createInputError(
        `Insufficient cloud credits ($${monthlyPrice.toFixed(2)} USD required). Top up your billing wallet to deploy this server.`,
        402
      );
    }

    // Provision the real Ubuntu container and single-port SSH multiplexer account on the host
    try {
      await provisionDropletOnHost({
        dropletId,
        tenantSlug: tenant.tenantSlug,
        hostname,
        sshGatewayUser,
        accessUsername,
        accessPasswordHash: passwordHash,
        ramMb: ramLimitMb,
        cpuLimit: Math.max(0.25, Number((cpuQuotaPercent / 100).toFixed(2)) || 1),
        storageGb: storageLimitGb,
        internalIp,
        status: 'active'
      });
    } catch (hostErr) {
      await rollbackInitialDropletCharge({
        userId,
        cashCreditUsed: billingInit?.chargeBreakdown?.cashCreditUsed || 0,
        promoCreditUsed: billingInit?.chargeBreakdown?.promoCreditUsed || 0,
        invoiceId: billingInit?.invoice?.id || null
      }).catch(() => {});
      await queryPg('DELETE FROM cloud_droplets WHERE id = $1 AND user_id = $2', [dropletId, userId]).catch(() => {});
      await releaseDropletIpAllocations({ dropletId }).catch(() => {});
      await reclaimUbuntuTenant({ tenantId: tenant.tenantId, userId }).catch(() => {});
      await adjustNodeActiveDroplets(assignedNodeId, -1).catch(() => {});
      throw createInputError(
        hostErr?.message || 'Unable to provision real Ubuntu container right now; any deducted credits were returned.',
        hostErr?.statusCode || 503
      );
    }

    const activityId = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await queryPg(
      `INSERT INTO cloud_activities (id, user_id, action, target, type)
       VALUES ($1, $2, $3, $4, 'droplet')`,
      [activityId, userId, `Provisioned ${selectedImage.name} (${selectedRegion.code})`, hostname]
    ).catch(() => {});

    return {
      droplet: billingInit?.droplet || mappedDroplet,
      tenant,
      invoice: billingInit?.invoice || null
    };
  },

  async updateDropletStatus(userId, id, status) {
    const cleanStatus = String(status || '').trim().toLowerCase();
    if (!['active', 'stopped'].includes(cleanStatus)) {
      throw createInputError('Droplet status must be active or stopped.');
    }
    const existingRes = await queryPg(
      'SELECT * FROM cloud_droplets WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId]
    );
    const current = existingRes.rows?.[0];
    if (!current) return null;
    const currentStatus = String(current.status || '').toLowerCase();
    const graceExpired = current.grace_until && Date.parse(String(current.grace_until)) <= Date.now();
    if (cleanStatus === 'active' && (currentStatus === 'suspended' || currentStatus === 'purged' || current.suspended_at || graceExpired)) {
      throw createInputError(
        'This server is suspended for unpaid billing or an active policy hold. Add credits to reactivate automatically.',
        402
      );
    }
    await setDropletPowerOnHost(id, cleanStatus === 'active' ? 'start' : 'stop');

    const { rows } = await queryPg(
      'UPDATE cloud_droplets SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [cleanStatus, id, userId]
    );
    const updated = rows[0];
    if (!updated) return null;
    if (updated.tenant_id) {
      await updateUbuntuTenantStatus({
        tenantId: updated.tenant_id,
        status: cleanStatus,
        userId
      }).catch(() => {});
    }
    if (cleanStatus === 'stopped') {
      await holdDropletIpAllocations({ dropletId: id }).catch(() => {});
    } else if (cleanStatus === 'active') {
      await restoreDropletIpAllocations({ dropletId: id }).catch(() => {});
    }
    return mapDroplet(updated);
  },

  async deleteDroplet(userId, id) {
    const preRes = await queryPg(
      `SELECT d.ssh_gateway_user, t.tenant_slug
       FROM cloud_droplets d
       LEFT JOIN system_ubuntu_tenants t ON t.id = d.tenant_id
       WHERE d.id = $1 AND d.user_id = $2
       LIMIT 1`,
      [id, userId]
    ).catch(() => ({ rows: [] }));
    const preRow = preRes.rows?.[0] || null;

    const { rows } = await queryPg(
      'DELETE FROM cloud_droplets WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    const removed = rows[0];
    if (!removed) return false;

    await destroyDropletOnHost(id, {
      sshGatewayUser: removed.ssh_gateway_user || preRow?.ssh_gateway_user || null,
      tenantSlug: preRow?.tenant_slug || null
    }).catch((err) => console.warn('[Cloud] Host container cleanup notice:', err?.message || err));
    await releaseDropletIpAllocations({ dropletId: id }).catch(() => {});
    if (removed.tenant_id) {
      await reclaimUbuntuTenant({ tenantId: removed.tenant_id, userId }).catch(() => {});
    }
    if (removed.node_id) {
      await adjustNodeActiveDroplets(removed.node_id, -1).catch(() => {});
    }

    const activityId = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await queryPg(
      `INSERT INTO cloud_activities (id, user_id, action, target, type)
       VALUES ($1, $2, $3, $4, 'droplet')`,
      [activityId, userId, `Destroyed droplet and reclaimed ${removed.storage || 'storage'} + IP`, removed.name]
    ).catch(() => {});

    return true;
  },

  async getDropletDetail(userId, id) {
    const { rows } = await queryPg('SELECT * FROM cloud_droplets WHERE id = $1 AND user_id = $2 LIMIT 1', [id, userId]);
    const row = rows[0];
    if (!row) return null;

    const node = row.node_id ? await getServerNodeById(row.node_id).catch(() => null) : null;
    const droplet = mapDroplet(row, { node });
    const networkProfile = buildDropletNetworkProfile({ droplet, node });
    const liveStats = await getDropletStatsFromHost(id).catch(() => null);

    await queryPg(`
      CREATE TABLE IF NOT EXISTS cloud_droplet_firewall_rules (
        id VARCHAR(64) PRIMARY KEY,
        droplet_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        direction VARCHAR(16) NOT NULL DEFAULT 'inbound',
        protocol VARCHAR(16) NOT NULL DEFAULT 'tcp',
        port_range VARCHAR(32) NOT NULL,
        source_cidr VARCHAR(64) NOT NULL DEFAULT '::/0',
        description VARCHAR(160),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cloud_droplet_snapshots (
        id VARCHAR(64) PRIMARY KEY,
        droplet_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(120) NOT NULL,
        size_gb INT DEFAULT 1,
        status VARCHAR(32) DEFAULT 'available',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    const [fwRes, snapRes, invRes, ipv6EventsRes] = await Promise.all([
      queryPg('SELECT * FROM cloud_droplet_firewall_rules WHERE droplet_id = $1 AND user_id = $2 ORDER BY created_at DESC', [id, userId]).catch(() => ({ rows: [] })),
      queryPg('SELECT * FROM cloud_droplet_snapshots WHERE droplet_id = $1 AND user_id = $2 ORDER BY created_at DESC', [id, userId]).catch(() => ({ rows: [] })),
      queryPg('SELECT * FROM cloud_droplet_invoices WHERE droplet_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 24', [id, userId]).catch(() => ({ rows: [] })),
      queryPg(
        'SELECT * FROM system_ipv6_change_events WHERE droplet_id = $1 OR (droplet_id IS NULL AND node_id = $2) ORDER BY created_at DESC LIMIT 10',
        [id, row.node_id || 'primary-ubuntu-node']
      ).catch(() => ({ rows: [] }))
    ]);

    return {
      droplet,
      networkProfile,
      liveStats,
      firewallRules: fwRes.rows,
      snapshots: snapRes.rows,
      invoices: invRes.rows,
      ipv6Events: ipv6EventsRes.rows,
      sslPolicy: 'User-Managed inside VPS (Platform SSL Disabled)'
    };
  },

  async addDropletFirewallRule(userId, dropletId, { direction = 'inbound', protocol = 'tcp', portRange = '22', sourceCidr = '::/0', description = '' } = {}) {
    const cleanDir = String(direction).toLowerCase() === 'outbound' ? 'outbound' : 'inbound';
    const cleanProto = ['tcp', 'udp', 'icmp'].includes(String(protocol).toLowerCase()) ? String(protocol).toLowerCase() : 'tcp';
    const cleanPort = String(portRange || '').trim().slice(0, 32);
    if (!/^\d{1,5}([-:]\d{1,5})?$/.test(cleanPort) && cleanProto !== 'icmp') {
      throw createInputError('Valid port or port range required (e.g. 80 or 8000-8080).');
    }
    const id = `fw_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const { rows } = await queryPg(
      `INSERT INTO cloud_droplet_firewall_rules (id, droplet_id, user_id, direction, protocol, port_range, source_cidr, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, dropletId, userId, cleanDir, cleanProto, cleanPort || '*', String(sourceCidr || '::/0').slice(0, 64), String(description || '').slice(0, 160)]
    );
    return rows[0];
  },

  async removeDropletFirewallRule(userId, dropletId, ruleId) {
    const { rowCount } = await queryPg(
      'DELETE FROM cloud_droplet_firewall_rules WHERE id = $1 AND droplet_id = $2 AND user_id = $3',
      [ruleId, dropletId, userId]
    );
    return rowCount > 0;
  },

  async createDropletSnapshot(userId, dropletId, name = null) {
    const cleanName = String(name || `snap-${new Date().toISOString().slice(0, 10)}`).trim().slice(0, 120);
    const id = `snp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const { rows } = await queryPg(
      `INSERT INTO cloud_droplet_snapshots (id, droplet_id, user_id, name, size_gb, status)
       VALUES ($1, $2, $3, $4, 2, 'available') RETURNING *`,
      [id, dropletId, userId, cleanName]
    );
    return rows[0];
  },

  async removeDropletSnapshot(userId, dropletId, snapId) {
    const { rowCount } = await queryPg(
      'DELETE FROM cloud_droplet_snapshots WHERE id = $1 AND droplet_id = $2 AND user_id = $3',
      [snapId, dropletId, userId]
    );
    return rowCount > 0;
  },

  async getCloudActivities(userId) {
    if (!userId) return [];
    const { rows } = await queryPg('SELECT * FROM cloud_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]);
    return rows.map(row => ({ ...row, userId: row.user_id, createdAt: row.created_at }));
  },

  async getPopularImages() {
    return DROPLET_IMAGE_CATALOG.slice(0, 5).map((img) => ({
      id: img.id,
      name: img.name,
      os: img.os,
      version: img.version,
      icon: img.os.toLowerCase(),
      iconUrl: img.iconUrl,
      available: img.available,
      featured: img.available
    }));
  },

  async getCloudMetrics(userId) {
    const droplets = await this.getDroplets(userId);
    const totalVcpus = droplets.reduce((sum, row) => sum + Number(row.vcpus || 0), 0);
    const totalStorage = droplets.reduce((sum, row) => sum + (parseFloat(row.storage) || 0), 0);
    return {
      totalDroplets: droplets.length,
      totalVcpus,
      totalStorage: totalStorage + ' GB',
      dropletsGrowth: '',
      vcpusGrowth: '',
      storageGrowth: '',
      totalBandwidth: 'Unavailable',
      bandwidthGrowth: '',
      cpuPercent: null,
      memoryPercent: null,
      storagePercent: null,
      bandwidthPercent: null,
      cpuUsed: 'Unavailable',
      memoryUsed: 'Unavailable',
      storageUsed: 'Unavailable',
      bandwidthUsed: 'Unavailable'
    };
  },

  async getCloudDashboardData(userId) {
    const [metrics, droplets, activities, popularImages, catalog] = await Promise.all([
      this.getCloudMetrics(userId),
      this.getDroplets(userId),
      this.getCloudActivities(userId),
      this.getPopularImages(),
      this.getDropletCatalog()
    ]);

    return {
      metrics,
      droplets,
      activities,
      popularImages,
      catalog
    };
  }
};
