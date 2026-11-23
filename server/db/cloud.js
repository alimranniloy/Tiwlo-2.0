import crypto from 'node:crypto';
import { isPgActive, queryPg } from './postgres.js';
import { SHARED_UBUNTU_RUNTIME_IMAGE } from '../ubuntu/constants.js';
import {
  ensureUbuntuTenantSchema,
  registerUbuntuTenant
} from '../ubuntu/tenantLayout.js';

export const DROPLET_IMAGE_CATALOG = Object.freeze([
  {
    id: 'ubuntu-24',
    name: 'Ubuntu 24.04 LTS',
    os: 'Ubuntu',
    version: '24.04 LTS · Shared Runtime Linked',
    type: 'os',
    badge: 'Connected',
    runtimeImage: SHARED_UBUNTU_RUNTIME_IMAGE,
    available: true
  },
  {
    id: 'ubuntu-22',
    name: 'Ubuntu 22.04 LTS',
    os: 'Ubuntu',
    version: '22.04 Jammy Jellyfish',
    type: 'os',
    available: false
  },
  {
    id: 'debian-12',
    name: 'Debian 12',
    os: 'Debian',
    version: 'Bookworm Stable',
    type: 'os',
    available: false
  },
  {
    id: 'almalinux-9',
    name: 'AlmaLinux 9',
    os: 'AlmaLinux',
    version: 'RHEL 9 Binary Compatible',
    type: 'os',
    available: false
  },
  {
    id: 'fedora-40',
    name: 'Fedora 40',
    os: 'Fedora',
    version: 'Cloud Base Edition',
    type: 'os',
    available: false
  },
  {
    id: 'app-docker',
    name: 'Docker on Ubuntu',
    os: 'Docker',
    version: 'Docker CE + Compose Ready',
    type: 'app',
    available: false
  },
  {
    id: 'app-lemp',
    name: 'LEMP High-Performance',
    os: 'LEMP',
    version: 'Nginx + PostgreSQL + PHP 8.3',
    type: 'app',
    available: false
  },
  {
    id: 'app-tpanel',
    name: 'TPanel 1.0 Web Host',
    os: 'TPanel',
    version: 'Deprecated / Disabled',
    type: 'app',
    available: false
  }
]);

export const DROPLET_REGION_CATALOG = Object.freeze([
  { id: 'dhk1', name: 'Dhaka', country: 'Bangladesh', flag: '🇧🇩', code: 'DHK1' },
  { id: 'sgp1', name: 'Singapore', country: 'Singapore', flag: '🇸🇬', code: 'SGP1' },
  { id: 'fra1', name: 'Frankfurt', country: 'Germany', flag: '🇩🇪', code: 'FRA1' },
  { id: 'nyc1', name: 'New York', country: 'United States', flag: '🇺🇸', code: 'NYC1' },
  { id: 'lon1', name: 'London', country: 'United Kingdom', flag: '🇬🇧', code: 'LON1' },
  { id: 'tyo1', name: 'Tokyo', country: 'Japan', flag: '🇯🇵', code: 'TYO1' },
  { id: 'tor1', name: 'Toronto', country: 'Canada', flag: '🇨🇦', code: 'TOR1' }
]);

function mapDroplet(row) {
  if (!row) return null;
  const { access_password_hash: _omit, ...safeRow } = row;
  return {
    ...safeRow,
    userId: row.user_id,
    regionCode: row.region_code,
    accessUsername: row.access_username || null,
    tenantId: row.tenant_id || null,
    nodeId: row.node_id || null,
    createdAt: row.created_at
  };
}

function createInputError(message) {
  const err = new Error(message);
  err.statusCode = 400;
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

export const CloudDB = {
  init() {},

  async getDropletCatalog() {
    const primaryRegionId = normalizeFleetRegionId(process.env.TIWLO_PRIMARY_REGION || 'dhk1') || 'dhk1';
    const availableRegionNodes = new Map([
      [primaryRegionId, 'primary-ubuntu-node']
    ]);

    if (isPgActive()) {
      try {
        const { rows } = await queryPg(
          `SELECT id, region, status
           FROM system_server_nodes
           WHERE LOWER(status) IN ('online', 'healthy', 'connected', 'active', 'degraded')`
        );
        for (const node of rows) {
          const regionId = normalizeFleetRegionId(node.region);
          if (regionId && !availableRegionNodes.has(regionId)) {
            availableRegionNodes.set(regionId, node.id);
          }
        }
      } catch {
        // Ignore if server fleet schema is not initialized yet
      }
    }

    const regions = DROPLET_REGION_CATALOG.map((region) => ({
      ...region,
      available: availableRegionNodes.has(region.id),
      nodeId: availableRegionNodes.get(region.id) || null
    }));

    const images = DROPLET_IMAGE_CATALOG.map((img) => ({
      ...img
    }));

    const activeRegion = regions.find((r) => r.available) || regions[0];

    return {
      images,
      regions,
      connectedServer: {
        nodeId: activeRegion?.nodeId || 'primary-ubuntu-node',
        regionId: activeRegion?.id || primaryRegionId,
        regionCode: activeRegion?.code || 'DHK1',
        regionName: activeRegion?.name || 'Dhaka',
        sharedImage: SHARED_UBUNTU_RUNTIME_IMAGE
      }
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
    const normalizedName = String(name || '').trim();
    if (!normalizedName || normalizedName.length > 255) {
      throw createInputError('Droplet name must be between 1 and 255 characters.');
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
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(hostname)) {
      throw createInputError('Hostname must be 3–63 characters using lowercase letters, numbers, or hyphens.');
    }

    const accessUsername = String(payload.username || payload.accessUsername || '')
      .trim()
      .toLowerCase();
    if (!/^[a-z_][a-z0-9_-]{2,31}$/.test(accessUsername)) {
      throw createInputError('Server username must be 3–32 characters (lowercase letters, numbers, underscore, or hyphen).');
    }

    const rawPassword = typeof payload.password === 'string' ? payload.password : '';
    if (rawPassword.length < 8 || rawPassword.length > 128) {
      throw createInputError('Server login password must be between 8 and 128 characters.');
    }

    const vcpus = Math.max(1, Math.min(32, Number(payload.vcpus) || 1));
    const memory = String(payload.memory || '1 GB').trim().slice(0, 64);
    const storage = String(payload.storage || '25 GB NVMe').trim().slice(0, 64);
    const storageLimitGb = Math.max(1, Math.min(2000, parseInt(storage, 10) || 25));
    const ramLimitMb = memory.toUpperCase().includes('GB')
      ? Math.max(256, (parseInt(memory, 10) || 1) * 1024)
      : Math.max(256, parseInt(memory, 10) || 512);
    const tags = typeof payload.tags === 'string' ? payload.tags.trim().slice(0, 255) : '';

    await ensureUbuntuTenantSchema();
    const tenant = await registerUbuntuTenant({
      userId,
      tenantSlug: `${hostname}_${crypto.randomBytes(2).toString('hex')}`,
      nodeId: selectedRegion.nodeId || 'primary-ubuntu-node',
      sharedImage: selectedImage.runtimeImage || SHARED_UBUNTU_RUNTIME_IMAGE,
      cpuQuotaPercent: Math.min(400, vcpus * 50),
      ramLimitMb,
      storageLimitGb
    });

    const dropletId = `drp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const passwordHash = hashServerPassword(rawPassword);
    const serverIp = process.env.VITE_SERVER_IPV4 || process.env.VITE_SERVER_IPV6 || '127.0.0.1';
    const specs = `${vcpus} vCPU · ${memory} · ${storage}`;

    const { rows } = await queryPg(
      `INSERT INTO cloud_droplets (
         id, user_id, name, specs, vcpus, memory, storage, ip,
         region, region_code, status, image, access_username, access_password_hash,
         tenant_id, node_id, tags
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13, $14, $15, $16)
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
        `${selectedRegion.name} (${selectedRegion.code})`,
        selectedRegion.code,
        selectedImage.name,
        accessUsername,
        passwordHash,
        tenant.tenantId,
        selectedRegion.nodeId || 'primary-ubuntu-node',
        tags
      ]
    );

    const activityId = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await queryPg(
      `INSERT INTO cloud_activities (id, user_id, action, target, type)
       VALUES ($1, $2, $3, $4, 'droplet')`,
      [activityId, userId, `Provisioned ${selectedImage.name} (${selectedRegion.code})`, hostname]
    ).catch(() => {});

    return {
      droplet: mapDroplet(rows[0]),
      tenant
    };
  },

  async updateDropletStatus(_userId, _id, _status) {
    throw new Error('Cloud provider control is unavailable. Server state was not changed.');
  },
  async deleteDroplet(_userId, _id) {
    throw new Error('Cloud provider control is unavailable. No server was deleted.');
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
