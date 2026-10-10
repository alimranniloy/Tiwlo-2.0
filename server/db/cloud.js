import { queryPg } from './postgres.js';
const popularImages = [
    { id: 'img-tpanel', name: 'TPanel 1.0 (Tiwlo Control Panel)', os: 'TPanel', version: '1.0', icon: 'tpanel', featured: true },
    { id: 'img-1', name: 'Ubuntu 22.04 LTS', os: 'Ubuntu', version: '22.04 LTS', icon: 'ubuntu' },
    { id: 'img-2', name: 'Debian 12', os: 'Debian', version: '12', icon: 'debian' },
    { id: 'img-3', name: 'CentOS 8', os: 'CentOS', version: '8', icon: 'centos' },
    { id: 'img-4', name: 'AlmaLinux 9', os: 'AlmaLinux', version: '9', icon: 'almalinux' }
  ];
const mapDroplet = row => row ? ({ ...row, userId: row.user_id, regionCode: row.region_code, createdAt: row.created_at }) : null;

export const CloudDB = {
  init() {},
  async getDroplets(userId) {
    if (!userId) return [];
    const { rows } = await queryPg('SELECT * FROM cloud_droplets WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return rows.map(mapDroplet);
  },
  async getDropletById(id) {
    const { rows } = await queryPg('SELECT * FROM cloud_droplets WHERE id = $1', [id]);
    return mapDroplet(rows[0]);
  },
  async createDroplet() { throw new Error('Cloud provisioning is not connected to a provider yet. No server was created.'); },
  async updateDropletStatus() { throw new Error('Cloud provider control is unavailable. Server state was not changed.'); },
  async deleteDroplet() { throw new Error('Cloud provider control is unavailable. No server was deleted.'); },
  async getCloudActivities(userId) {
    if (!userId) return [];
    const { rows } = await queryPg('SELECT * FROM cloud_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]);
    return rows.map(row => ({ ...row, userId: row.user_id, createdAt: row.created_at }));
  },
  async getPopularImages() { return popularImages; },
  async getCloudMetrics(userId) {
    const droplets = await this.getDroplets(userId);
    const totalVcpus = droplets.reduce((sum, row) => sum + Number(row.vcpus || 0), 0);
    const totalStorage = droplets.reduce((sum, row) => sum + (parseFloat(row.storage) || 0), 0);
    return {
      totalDroplets: droplets.length, totalVcpus, totalStorage: totalStorage + ' GB',
      dropletsGrowth: '', vcpusGrowth: '', storageGrowth: '',
      totalBandwidth: 'Unavailable', bandwidthGrowth: '',
      cpuPercent: 0, memoryPercent: 0, storagePercent: 0, bandwidthPercent: 0,
      cpuUsed: 'Unavailable', memoryUsed: 'Unavailable', storageUsed: 'Unavailable', bandwidthUsed: 'Unavailable'
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
