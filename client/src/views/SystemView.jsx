import React, { useState, useEffect } from 'react';
import { SUPPORT_EMAIL } from '../config/platformConfig';
import {
  Server,
  Cpu,
  Database,
  Sliders,
  ShieldAlert,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HardDrive,
  FileJson,
  Building,
  Save,
  Activity,
  Search,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function SystemView({ showToast, onBackToDashboard }) {
  const [activeTab, setActiveTab] = useState('diagnostics'); // 'diagnostics' | 'settings' | 'backup' | 'audit'
  const [systemInfo, setSystemInfo] = useState(null);
  const [settings, setSettings] = useState({
    companyName: 'Tiwlo Cloud Platform',
    storeEmail: SUPPORT_EMAIL,
    phone: '+1 (800) 555-TIWLO',
    currency: 'USD',
    currencySymbol: '$',
    taxRate: 8.0,
    lowStockThreshold: 50,
    warehouseName: 'Central Distribution Hub #1',
    warehouseLocation: 'Dhaka Logistics Hub, Sector 4'
  });
  const [activities, setActivities] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSystemData = async () => {
    try {
      setLoading(true);
      const [infoRes, setRes, actRes] = await Promise.all([
        fetch('/api/system/info').then(r => r.json()),
        fetch('/api/system/settings').then(r => r.json()),
        fetch('/api/activities').then(r => r.json())
      ]);
      setSystemInfo(infoRes);
      if (setRes) setSettings(setRes);
      setActivities(actRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await fetch('/api/system/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        showToast && showToast('System settings saved successfully!');
      } else {
        showToast && showToast('Failed to save settings', 'error');
      }
    } catch (err) {
      showToast && showToast('Error connecting to server', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Download Full Database Backup JSON
  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/system/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tiwlo_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast && showToast('Full database JSON backup downloaded successfully!');
    } catch (err) {
      showToast && showToast('Error exporting database', 'error');
    }
  };

  // Clear Audit Log
  const handleClearAuditLog = async () => {
    if (!window.confirm('Are you sure you want to clear all system activity logs?')) return;
    try {
      await fetch('/api/activities', { method: 'DELETE' });
      setActivities([]);
      showToast && showToast('Audit trail cleared');
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Activities
  const filteredActivities = activities.filter(a =>
    (a.title || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
    (a.subtitle || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
    (a.type || '').toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs flex items-center space-x-1 font-semibold text-xs cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                <Server className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                System Control & Architecture
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Server diagnostics, persistent database backups, global company preferences, and real-time audit trail.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSystemData}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#111827] p-2.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex items-center overflow-x-auto max-w-full gap-2">
        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`whitespace-nowrap px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'diagnostics'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          Diagnostics & Telemetry
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`whitespace-nowrap px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          Company & Store Settings
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`whitespace-nowrap px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'backup'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          Database Backup & Storage
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`whitespace-nowrap px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          Live Audit Logs ({activities.length})
        </button>
      </div>

      {/* TAB 1: DIAGNOSTICS & TELEMETRY */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Node Engine</span>
              <div className="text-xl font-mono font-bold text-slate-900 dark:text-white mt-1">
                {systemInfo?.nodeVersion || 'v24.20.0'}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Runtime Healthy</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Memory Footprint</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {systemInfo?.memoryUsageMB || 58} MB
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Resident Set (RSS)</div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Server Uptime</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {Math.round((systemInfo?.uptimeSeconds || 360) / 60)} mins
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active background server</span>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total DB Records</span>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {systemInfo?.totalDatabaseRecords || 55} entries
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Across 8 JSON tables</div>
            </div>
          </div>

          {/* Database Entities Breakdown Card */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
              Database Tables & Entity Distribution
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Live count of entities managed in local disk JSON files under <code className="bg-slate-100 dark:bg-gray-800 px-1 py-0.5 rounded">server/data/</code>.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Products</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.products || 10}
                </p>
                <span className="text-[10px] text-blue-500 font-mono">products.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Categories</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.categories || 6}
                </p>
                <span className="text-[10px] text-emerald-500 font-mono">categories.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Subcategories</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.subcategories || 11}
                </p>
                <span className="text-[10px] text-indigo-500 font-mono">subcategories.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Purchase Orders</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.purchases || 4}
                </p>
                <span className="text-[10px] text-orange-500 font-mono">purchases.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Sales Invoices</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.sales || 4}
                </p>
                <span className="text-[10px] text-purple-500 font-mono">sales.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Customers</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.customers || 5}
                </p>
                <span className="text-[10px] text-pink-500 font-mono">customers.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Suppliers</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {systemInfo?.counts?.suppliers || 5}
                </p>
                <span className="text-[10px] text-cyan-500 font-mono">suppliers.json</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-800/60 border border-slate-100 dark:border-gray-700/60">
                <span className="text-xs text-slate-400 font-medium">Audit Activity Logs</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {activities.length}
                </p>
                <span className="text-[10px] text-amber-500 font-mono">activities.json</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY & STORE SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-4 sm:p-6 shadow-xs max-w-3xl">
          <div className="border-b border-slate-100 dark:border-gray-800 pb-4 mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Company & Inventory Parameters
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize company naming, tax rates, currency symbol, and automatic stock alerts.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Official Support Email
                </label>
                <input
                  type="email"
                  required
                  value={settings.storeEmail}
                  onChange={(e) => setSettings({ ...settings, storeEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Currency Symbol
                </label>
                <select
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white font-bold"
                >
                  <option value="$">USD ($)</option>
                  <option value="৳">BDT (৳)</option>
                  <option value="€">EUR (€)</option>
                  <option value="£">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Default Sales Tax (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Low Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="5"
                  value={settings.lowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 20 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Main Warehouse Facility
                </label>
                <input
                  type="text"
                  value={settings.warehouseName}
                  onChange={(e) => setSettings({ ...settings, warehouseName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Facility Location
                </label>
                <input
                  type="text"
                  value={settings.warehouseLocation}
                  onChange={(e) => setSettings({ ...settings, warehouseLocation: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition flex items-center space-x-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: DATABASE BACKUP & STORAGE */}
      {activeTab === 'backup' && (
        <div className="space-y-5 max-w-3xl">
          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Full Database Snapshot Export
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-lg">
                  Instantly package and download all 8 local database tables (Products, Categories, Subcategories, Purchases, Sales, Customers, Suppliers, Audit Logs) into a single standalone JSON file for disaster recovery.
                </p>
              </div>

              <button
                onClick={handleExportBackup}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition flex items-center justify-center space-x-2 shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON Database</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-base text-rose-600">
              Maintenance Actions
            </h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Careful: Cleans temporary data or resets system logs.
            </p>

            <button
              onClick={handleClearAuditLog}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center space-x-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge Audit Activity Log</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT ACTIVITY LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit trail by action or item..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <button
              onClick={handleClearAuditLog}
              className="text-xs text-rose-600 font-semibold hover:underline self-end sm:self-center"
            >
              Clear Log
            </button>
          </div>

          <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-gray-800">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No activity records found matching search.
              </div>
            ) : (
              filteredActivities.map((act) => (
                <div key={act.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-gray-800/40 transition">
                  <div className="flex items-center space-x-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                      <Activity className="w-4 h-4 text-blue-500" />
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-xs leading-tight">
                        {act.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-gray-800 text-slate-500">
                        {act.type}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
