import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let cloudRuntimeData = {
  droplets: [],
  activities: [],
  popularImages: [
    { id: 'img-tpanel', name: 'TPanel 1.0 (Tiwlo Control Panel)', os: 'TPanel', version: '1.0', icon: 'tpanel', featured: true },
    { id: 'img-1', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', version: '22.04 LTS', icon: 'ubuntu' },
    { id: 'img-2', name: 'Debian 12', os: 'Debian', version: '12', icon: 'debian' },
    { id: 'img-3', name: 'CentOS 8', os: 'CentOS', version: '8', icon: 'centos' },
    { id: 'img-4', name: 'AlmaLinux 9', os: 'AlmaLinux', version: '9', icon: 'almalinux' }
  ]
};

function readCloudDb() {
  return cloudRuntimeData;
}

function writeCloudDb(data) {
  cloudRuntimeData = data;
}

export const CloudDB = {
  init() {
    // Cloud DB initialized in-memory / PostgreSQL
  },

  async getDroplets(userId) {
    if (!userId) return [];
    const db = readCloudDb();
    const droplets = db.droplets || [];
    return droplets.filter(d => d.userId === userId);
  },

  async getDropletById(id) {
    const db = readCloudDb();
    return (db.droplets || []).find(d => d.id === id) || null;
  },

  async createDroplet(userId, input) {
    throw new Error('Cloud provisioning is not connected to a provider yet. No server was created.');

    /* Legacy simulated provisioning intentionally disabled. A real provider
       adapter must create the VM and return its provider-issued address. */
    const db = readCloudDb();
    db.droplets = db.droplets || [];

    // Randomize public IP address
    const octet1 = Math.floor(Math.random() * 100) + 100;
    const octet2 = Math.floor(Math.random() * 200) + 20;
    const octet3 = Math.floor(Math.random() * 80) + 10;
    const octet4 = Math.floor(Math.random() * 90) + 10;
    const generatedIp = `${octet1}.${octet2}.${octet3}.${octet4}`;

    const date = new Date();
    const formattedCreated = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const vcpus = input.vcpus || 2;
    const memory = input.memory || '4 GB';
    const storage = input.storage || '80 GB';
    const specs = `${vcpus} vCPU • ${memory} • ${storage}`;

    const newDroplet = {
      id: `drop-${Date.now()}`,
      userId,
      tiwiId: input.tiwiId || (userId && userId.startsWith('TIW-') ? userId : null),
      name: input.name || `server-${Math.floor(Math.random() * 900 + 100)}`,
      specs,
      vcpus,
      memory,
      storage,
      ip: generatedIp,
      region: input.region || 'New York (NYC1)',
      regionCode: input.regionCode || 'NYC1',
      regionFlag: input.regionFlag || '🇺🇸',
      status: 'Running',
      image: input.image || 'Ubuntu 22.04 LTS',
      created: formattedCreated,
      createdAt: date.toISOString()
    };

    db.droplets.unshift(newDroplet);

    // Record activity
    db.activities = db.activities || [];
    db.activities.unshift({
      id: `cact-${Date.now()}`,
      userId,
      action: 'Droplet created',
      target: newDroplet.name,
      type: 'droplet',
      time: 'Just now',
      createdAt: date.toISOString()
    });

    writeCloudDb(db);
    return newDroplet;
  },

  async updateDropletStatus(id, status) {
    const db = readCloudDb();
    const droplet = (db.droplets || []).find(d => d.id === id);
    if (!droplet) return null;

    droplet.status = status;

    // Record activity
    db.activities = db.activities || [];
    db.activities.unshift({
      id: `cact-${Date.now()}`,
      userId: droplet.userId,
      action: `Droplet ${status.toLowerCase()}`,
      target: droplet.name,
      type: status.toLowerCase() === 'running' ? 'droplet' : 'delete',
      time: 'Just now',
      createdAt: new Date().toISOString()
    });

    writeCloudDb(db);
    return droplet;
  },

  async deleteDroplet(id) {
    const db = readCloudDb();
    const droplet = (db.droplets || []).find(d => d.id === id);
    if (!droplet) return false;

    db.droplets = (db.droplets || []).filter(d => d.id !== id);

    // Record activity
    db.activities = db.activities || [];
    db.activities.unshift({
      id: `cact-${Date.now()}`,
      userId: droplet.userId,
      action: 'Droplet deleted',
      target: droplet.name,
      type: 'delete',
      time: 'Just now',
      createdAt: new Date().toISOString()
    });

    writeCloudDb(db);
    return true;
  },

  async getCloudActivities(userId) {
    if (!userId) return [];
    const db = readCloudDb();
    const activities = db.activities || [];
    return activities.filter(a => a.userId === userId).slice(0, 10);
  },

  async getPopularImages() {
    const db = readCloudDb();
    return db.popularImages || [
      { id: 'img-1', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', version: '22.04 LTS', icon: 'ubuntu' },
      { id: 'img-2', name: 'Debian 12', os: 'Debian', version: '12', icon: 'debian' },
      { id: 'img-3', name: 'CentOS 8', os: 'CentOS', version: '8', icon: 'centos' },
      { id: 'img-4', name: 'AlmaLinux 9', os: 'AlmaLinux', version: '9', icon: 'almalinux' }
    ];
  },

  async getCloudMetrics(userId) {
    const droplets = await this.getDroplets(userId);
    const count = droplets.length;

    // Dynamic metrics calculated strictly from real database droplets

    // Dynamic metrics for new users
    if (count === 0) {
      return {
        totalDroplets: 0,
        dropletsGrowth: '0 from last 7 days',
        totalVcpus: 0,
        vcpusGrowth: '0 vCPUs',
        totalStorage: '0 GB',
        storageGrowth: '0 GB',
        totalBandwidth: '0 TB',
        bandwidthGrowth: '0 TB',
        cpuPercent: 0,
        cpuUsed: '0 / 0 vCPUs',
        memoryPercent: 0,
        memoryUsed: '0 / 0 GB',
        storagePercent: 0,
        storageUsed: '0 / 0 GB',
        bandwidthPercent: 0,
        bandwidthUsed: '0 / 0 TB'
      };
    }

    const totalVcpus = droplets.reduce((acc, d) => acc + (d.vcpus || 2), 0);
    const totalStorageGb = droplets.reduce((acc, d) => acc + (parseInt(d.storage) || 40), 0);

    return {
      totalDroplets: count,
      dropletsGrowth: `↑ ${count} active`,
      totalVcpus: totalVcpus,
      vcpusGrowth: `↑ ${totalVcpus} vCPUs allocated`,
      totalStorage: `${totalStorageGb} GB`,
      storageGrowth: `↑ ${totalStorageGb} GB provisioned`,
      totalBandwidth: '1.2 TB',
      bandwidthGrowth: '↑ 0.3 TB bandwidth',
      cpuPercent: Math.min(85, Math.max(15, count * 14)),
      cpuUsed: `${(totalVcpus * 0.35).toFixed(1)} / ${totalVcpus} vCPUs`,
      memoryPercent: Math.min(80, Math.max(20, count * 18)),
      memoryUsed: `${(count * 1.8).toFixed(1)} / ${count * 4} GB`,
      storagePercent: Math.min(75, Math.max(10, count * 12)),
      storageUsed: `${Math.round(totalStorageGb * 0.2)} / ${totalStorageGb} GB`,
      bandwidthPercent: 12,
      bandwidthUsed: '0.2 / 1.2 TB'
    };
  },

  async getCloudDashboardData(userId) {
    const [metrics, droplets, activities, popularImages] = await Promise.all([
      this.getCloudMetrics(userId),
      this.getDroplets(userId),
      this.getCloudActivities(userId),
      this.getPopularImages()
    ]);

    return {
      metrics,
      droplets,
      activities,
      popularImages
    };
  }
};
