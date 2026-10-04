import React, { useState, useEffect } from 'react';
import {
  Search,
  Store,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  X,
  AlertTriangle,
  Users,
  ShoppingBag
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminCustomersView({ onBackToDashboard, showToast }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomerStores, setSelectedCustomerStores] = useState(null);
  const [banModalTarget, setBanModalTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/customers?q=${encodeURIComponent(search.trim())}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCustomers(data.customers || []);
        }
      }
    } catch (err) {
      console.error('[Admin Customers] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  // Handle Ban / Unban
  const handleToggleBan = async (customer, isBanning, reasonText) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/users/${customer.id}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ isBanned: isBanning, reason: reasonText })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(data.message || 'Status updated successfully');
        setBanModalTarget(null);
        setBanReason('');
        // Instant sync in local state
        setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, isBanned: isBanning, status: isBanning ? 'Suspended' : 'Active' } : c));
      } else {
        showToast?.(data.error || 'Failed to update user status', 'error');
      }
    } catch (err) {
      showToast?.('Network error updating user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const totalStoreCount = customers.reduce((acc, c) => acc + (c.storeCount || 0), 0);
  const multiStoreCount = customers.filter(c => c.storeCount > 1).length;
  const suspendedCount = customers.filter(c => c.isBanned).length;

  return (
    <div className="space-y-4 font-sans select-none">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div>
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              E-commerce Customers & Store Owners
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {customers.length} Merchants
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Overview of store owners, multi-tenant merchant accounts, and active store counts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            className="p-1.5 px-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Mini Strip (Minimalist Clean) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Total Merchants</span>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{customers.length}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Total Stores Created</span>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{totalStoreCount}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Multi-Store Owners</span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{multiStoreCount}</p>
        </div>
        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-400">Suspended Merchants</span>
          <p className={`text-lg font-bold mt-0.5 ${suspendedCount > 0 ? 'text-red-500' : 'text-slate-500'}`}>{suspendedCount}</p>
        </div>
      </div>

      {/* Search Bar & Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Search Header */}
        <div className="p-3 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by merchant, store name, email, Tiwi ID..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
            Showing {customers.length} customer records
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5 px-4">Merchant / Customer</th>
                <th className="py-2.5 px-3">Tiwi ID</th>
                <th className="py-2.5 px-3 text-center">Stores Count</th>
                <th className="py-2.5 px-3">Primary Store</th>
                <th className="py-2.5 px-3">Plan</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading store customers...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Customer Info */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={c.avatar}
                          alt={c.name}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                            {c.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Tiwi ID */}
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-600 dark:text-slate-400 text-[11px]">
                      {c.tiwiId}
                    </td>

                    {/* Stores Count with interactive preview */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedCustomerStores(c)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-transform hover:scale-105 ${
                          c.storeCount > 1
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                            : c.storeCount === 1
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                        title="Click to view all stores"
                      >
                        <Store className="w-3 h-3" />
                        <span>{c.storeCount} {c.storeCount === 1 ? 'Store' : 'Stores'}</span>
                      </button>
                    </td>

                    {/* Primary Store */}
                    <td className="py-2.5 px-3">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[140px]">
                          {c.primaryStoreName}
                        </span>
                        <a
                          href={`https://${c.subdomain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 truncate max-w-[140px]"
                        >
                          {c.subdomain} <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {c.planName}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          c.isBanned
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCustomerStores(c)}
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          Stores
                        </button>

                        {c.role !== 'super_admin' && c.email !== 'tiwloltd@gmail.com' && (
                          <button
                            onClick={() => {
                              if (c.isBanned) {
                                handleToggleBan(c, false);
                              } else {
                                setBanModalTarget(c);
                                setBanReason('');
                              }
                            }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              c.isBanned
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                            }`}
                          >
                            {c.isBanned ? 'Unsuspend' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stores Detail Modal */}
      {selectedCustomerStores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src={selectedCustomerStores.avatar}
                  alt={selectedCustomerStores.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {selectedCustomerStores.name}'s Stores ({selectedCustomerStores.storeCount})
                  </h3>
                  <p className="text-[11px] text-slate-400">{selectedCustomerStores.email}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomerStores(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {selectedCustomerStores.stores && selectedCustomerStores.stores.length > 0 ? (
                selectedCustomerStores.stores.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{s.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{s.subdomain}</span>
                    </div>

                    <a
                      href={`https://${s.subdomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex items-center gap-1"
                    >
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{selectedCustomerStores.primaryStoreName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{selectedCustomerStores.subdomain}</span>
                  </div>

                  <a
                    href={`https://${selectedCustomerStores.subdomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex items-center gap-1"
                  >
                    Visit <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedCustomerStores(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Confirmation Modal */}
      {banModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suspend Merchant Account
                </h3>
                <p className="text-[11px] text-slate-400">
                  {banModalTarget.name} ({banModalTarget.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              When suspended, the merchant will be immediately logged out and shown the disabled account notice screen upon sign-in. Their stores will be placed in maintenance mode.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason for suspension (visible to merchant):
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Terms of Service violation, policy non-compliance, payment issue..."
                rows={2}
                className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBanModalTarget(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleToggleBan(banModalTarget, true, banReason)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-all"
              >
                {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
