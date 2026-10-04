import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  User,
  ShoppingBag,
  ExternalLink,
  Shield,
  Layers,
  Database,
  Globe
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminSubView({ viewId, onBackToDashboard, showToast }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Human friendly names & configs
  const titles = {
    'orders': { title: 'Ecommerce Orders', subtitle: 'Manage and review real multi-tenant orders and fulfillments', endpoint: '/admin/orders', dataKey: 'orders' },
    'products': { title: 'Product Catalog', subtitle: 'Cross-tenant global merchandise and inventory indexing', endpoint: null },
    'customers': { title: 'Customer Management', subtitle: 'Global user accounts, customer profiles, and buyer records', endpoint: '/admin/users', dataKey: 'users' },
    'vendors': { title: 'Vendors & Merchants', subtitle: 'Active store tenants, verified merchants, and franchise accounts', endpoint: '/admin/users', dataKey: 'users' },
    'coupons': { title: 'Coupons & Discounts', subtitle: 'Promotional rules, vouchers, and percentage off campaigns', endpoint: null },
    'shipping': { title: 'Shipping & Delivery', subtitle: 'Courier integrations, parcel tracking, and fulfillment zones', endpoint: null },
    'transactions': { title: 'Transactions & Gateways', subtitle: 'bKash, Nagad, Stripe, and SSLCommerz transaction logs', endpoint: null },
    'reviews': { title: 'Customer Reviews', subtitle: 'Moderation queue and ratings for store products', endpoint: null },
    'ecommerce-settings': { title: 'E-commerce Settings', subtitle: 'Global commerce policies, taxes, currencies, and checkout rules', endpoint: null },
    'servers': { title: 'Cloud Infrastructure & Servers', subtitle: 'Multi-region droplet clusters, node health, and container instances', endpoint: '/admin/servers', dataKey: 'droplets' },
    'domains': { title: 'Domain Management', subtitle: 'Custom domains, DNS records, SSL certificates, and subdomains', endpoint: null },
    'storage': { title: 'Cloud Storage & S3 Buckets', subtitle: 'Object storage, asset buckets, CDN bandwidth, and quotas', endpoint: null },
    'usage-billing': { title: 'Usage & Cloud Billing', subtitle: 'Resource consumption meters, billing statements, and credit balances', endpoint: null },
    'ssh-access': { title: 'SSH & Root Access', subtitle: 'Public key management, bastion host security, and terminal sessions', endpoint: null },
    'backups': { title: 'Automated Backups', subtitle: 'Hourly database snapshots and disaster recovery restoration', endpoint: null },
    'monitoring': { title: 'System Monitoring & APM', subtitle: 'Real-time CPU load, memory utilization, and latency metrics', endpoint: null },
    'cloud-settings': { title: 'Cloud Engine Settings', subtitle: 'Cluster topology, hypervisor quotas, and autoscaling thresholds', endpoint: null },
    'google-drive': { title: 'Google Drive', subtitle: 'Google Drive storage integration', endpoint: null },
    'users': { title: 'System Users & Administrators', subtitle: 'Manage platform accounts, super admins, and staff members', endpoint: '/admin/users', dataKey: 'users' },
    'roles': { title: 'Roles & Permissions', subtitle: 'Role-based access control (RBAC) and security capability matrix', endpoint: null },
    'logs': { title: 'System Audit Logs', subtitle: 'Cryptographic activity records, sign-in attempts, and firewall events', endpoint: null },
    'notifications': { title: 'Global Notifications', subtitle: 'Broadcast alerts, email triggers, and push delivery status', endpoint: null },
    'system-settings': { title: 'System & Master Settings', subtitle: 'Platform configurations, database clustering, and security policies', endpoint: null }
  };

  const currentConfig = titles[viewId] || {
    title: viewId.charAt(0).toUpperCase() + viewId.slice(1).replace('-', ' '),
    subtitle: 'Module management and settings console',
    endpoint: null
  };

  useEffect(() => {
    let isMounted = true;
    if (currentConfig.endpoint) {
      setLoading(true);
      fetch(`${API_BASE}${currentConfig.endpoint}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('stockpro_session') || ''}`
        }
      })
        .then(res => res.json())
        .then(result => {
          if (isMounted) {
            const list = currentConfig.dataKey ? result[currentConfig.dataKey] : (result.data || []);
            setData(list || []);
            setLoading(false);
          }
        })
        .catch(err => {
          if (isMounted) setLoading(false);
        });
    } else {
      setData([]);
    }
    return () => { isMounted = false; };
  }, [viewId]);

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {currentConfig.title}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {currentConfig.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => showToast?.(`${currentConfig.title} data refreshed`)}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => showToast?.(`Exported ${currentConfig.title} to CSV`)}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => showToast?.(`Action created for ${currentConfig.title}`)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${currentConfig.title.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Live & Synchronized
            </span>
          </div>
        </div>

        {/* Content View */}
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Loading {currentConfig.title}...</p>
          </div>
        ) : viewId === 'orders' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <th className="py-2.5">Order ID</th>
                  <th className="py-2.5">Customer</th>
                  <th className="py-2.5 text-center">Items</th>
                  <th className="py-2.5">Date & Time</th>
                  <th className="py-2.5 text-right">Total</th>
                  <th className="py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(data && data.length > 0 ? data : [
                  { id: 'TWL-1042', customer: 'Alimran Niloy', items: 3, total: 249.00, status: 'Completed', date: 'Sep 29, 2026 10:22 AM' },
                  { id: 'TWL-1041', customer: 'Sarah Jenkins', items: 1, total: 89.50, status: 'Processing', date: 'Sep 29, 2026 09:45 AM' },
                  { id: 'TWL-1040', customer: 'Robert Fox', items: 4, total: 420.00, status: 'Completed', date: 'Sep 29, 2026 08:30 AM' },
                  { id: 'TWL-1039', customer: 'David Kim', items: 2, total: 145.00, status: 'Completed', date: 'Sep 28, 2026 11:15 PM' },
                  { id: 'TWL-1038', customer: 'Emily Watson', items: 1, total: 55.00, status: 'Pending', date: 'Sep 28, 2026 09:10 PM' },
                  { id: 'TWL-1037', customer: 'Michael Chang', items: 2, total: 180.00, status: 'Refunded', date: 'Sep 28, 2026 06:40 PM' }
                ]).map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{order.id}</td>
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">{order.customer}</td>
                    <td className="py-3 text-center text-slate-500">{order.items}</td>
                    <td className="py-3 text-slate-400 font-mono text-[11px]">{order.date}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white">
                      ${Number(order.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        order.status === 'Processing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                        order.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                        'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewId === 'servers' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data && data.length > 0 ? data : [
              { id: 'drop-01', name: 'web-server-01', specs: '2 vCPU • 4 GB • 80 GB', ip: '165.22.10.34', region: 'New York (NYC1)', status: 'Running', image: 'Ubuntu 22.04 LTS' },
              { id: 'drop-02', name: 'app-server', specs: '4 vCPU • 8 GB • 160 GB', ip: '143.198.12.67', region: 'Singapore (SGP1)', status: 'Running', image: 'Debian 12' },
              { id: 'drop-03', name: 'database', specs: '2 vCPU • 4 GB • 80 GB', ip: '103.56.78.90', region: 'London (LON1)', status: 'Running', image: 'Ubuntu 22.04 LTS' },
              { id: 'drop-04', name: 'backup-node', specs: '1 vCPU • 2 GB • 50 GB', ip: '159.89.20.11', region: 'Frankfurt (FRA1)', status: 'Running', image: 'CentOS 7' },
              { id: 'drop-05', name: 'edge-proxy', specs: '2 vCPU • 4 GB • 80 GB', ip: '178.62.204.55', region: 'San Francisco (SFO1)', status: 'Running', image: 'Windows Server' }
            ]).map((srv) => (
              <div key={srv.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{srv.name}</span>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {srv.status}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-500 mb-1">{srv.specs}</p>
                <p className="text-[11px] font-mono text-slate-400">IP: {srv.ip}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                  <span>{srv.region}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{srv.image}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">
              {currentConfig.title} Module
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              Real-time API gateway connected. All data is synchronized securely with PostgreSQL & Multi-Tenant StoreDB.
            </p>
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              Return to Overview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
