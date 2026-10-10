import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Layers, RefreshCw, Search } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

const views = {
  orders: { title: 'Ecommerce Orders', endpoint: '/admin/orders', dataKey: 'orders' },
  products: { title: 'Product Catalog', endpoint: '/admin/products', dataKey: 'products' },
  customers: { title: 'Customer Management', endpoint: '/admin/users', dataKey: 'users' },
  vendors: { title: 'Vendors & Merchants', endpoint: '/admin/users?role=owner&limit=50', dataKey: 'users' },
  users: { title: 'System Users & Administrators', endpoint: '/admin/users', dataKey: 'users' },
  servers: { title: 'Cloud Infrastructure & Servers', endpoint: '/admin/servers', dataKey: 'droplets' }
};

export default function AdminSubView({ viewId, onBackToDashboard }) {
  const config = views[viewId] || {
    title: viewId.charAt(0).toUpperCase() + viewId.slice(1).replace('-', ' ')
  };
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(Boolean(config.endpoint));
  const [error, setError] = useState('');
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const [search, setSearch] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const endpoint = config.endpoint;
  const dataKey = config.dataKey;

  useEffect(() => {
    let active = true;
    if (!endpoint) return undefined;

    const load = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const response = await fetch(`${API_BASE}${endpoint}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || `Request failed (${response.status}).`);
        }
        if (!active) return;
        const list = result[dataKey];
        setData(Array.isArray(list) ? list : []);
        if (result.providerConnected === false) {
          setUnavailableMessage(result.message || 'The cloud provider is not connected.');
        }
      } catch (requestError) {
        console.error(`[Admin ${viewId}] Could not load data:`, requestError);
        if (active) {
          setData([]);
          setError('Live data could not be loaded.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [viewId, reloadCount, endpoint, dataKey]);

  const refreshData = () => {
    setLoading(true);
    setError('');
    setUnavailableMessage('');
    setReloadCount(count => count + 1);
  };

  const filteredData = data.filter(row =>
    !search || Object.values(row).some(value =>
      String(value ?? '').toLowerCase().includes(search.toLowerCase())
    )
  );
  const connected = Boolean(endpoint) && !error && !unavailableMessage;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800">
        <div>
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {connected ? 'Records loaded from the connected data source.' : 'Data source status is shown below.'}
          </p>
        </div>
        {endpoint && (
          <button
            onClick={refreshData}
            disabled={loading}
            className="p-2 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <span className={`px-2 py-1 text-[11px] font-bold rounded-lg ${
            connected
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            {error ? 'Connection error' : connected ? 'Live data source' : 'Not connected'}
          </span>
          {endpoint && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={`Search ${config.title.toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          )}
        </div>

        {loading ? (
          <p className="py-12 text-center text-xs text-slate-500">Loading {config.title}...</p>
        ) : error || unavailableMessage ? (
          <p className={`py-12 text-center text-sm ${error ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
            {error || unavailableMessage}
          </p>
        ) : viewId === 'orders' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5">Order</th><th className="py-2.5">Store / Customer</th>
                <th className="py-2.5 text-center">Items</th><th className="py-2.5">Date</th>
                <th className="py-2.5 text-right">Total</th><th className="py-2.5 text-center">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredData.map(order => (
                  <tr key={order.rowKey || order.id || `${order.store}:${order.date}`}>
                    <td className="py-3 font-mono font-bold text-blue-600">{order.id || 'ID unavailable'}</td>
                    <td className="py-3"><span className="font-semibold">{order.customer}</span><span className="block text-[10px] text-slate-400">{order.store}</span></td>
                    <td className="py-3 text-center">{order.items}</td>
                    <td className="py-3 text-slate-500">{order.date ? new Date(order.date).toLocaleString() : 'Date unavailable'}</td>
                    <td className="py-3 text-right">
                      {order.total == null ? '—' : `${order.currency || ''} ${Number(order.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-3 text-center">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredData.length && <p className="py-8 text-center text-xs text-slate-400">No matching orders are recorded.</p>}
          </div>
        ) : viewId === 'products' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5">Product</th><th className="py-2.5">Store</th><th className="py-2.5">SKU</th>
                <th className="py-2.5">Category</th><th className="py-2.5 text-right">Price</th><th className="py-2.5 text-right">Stock</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredData.map(product => (
                  <tr key={`${product.storeId}:${product.id}`}>
                    <td className="py-3 font-semibold">{product.name}</td><td className="py-3">{product.storeName}</td>
                    <td className="py-3 font-mono">{product.sku || '—'}</td><td className="py-3">{product.category}</td>
                    <td className="py-3 text-right">{product.price == null ? '—' : `${product.currency || ''} ${product.price.toLocaleString()}`}</td>
                    <td className="py-3 text-right">{product.stock == null ? '—' : product.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredData.length && <p className="py-8 text-center text-xs text-slate-400">No matching products are recorded.</p>}
          </div>
        ) : ['users', 'customers', 'vendors'].includes(viewId) ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="py-2.5">Name</th><th className="py-2.5">Email</th><th className="py-2.5">Role</th><th className="py-2.5">Plan</th><th className="py-2.5">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredData.map(user => (
                  <tr key={user.id}><td className="py-3 font-semibold">{user.name}</td><td className="py-3">{user.email}</td>
                    <td className="py-3">{user.role}</td><td className="py-3">{user.planName}</td>
                    <td className="py-3">{user.isBanned ? 'Suspended' : 'Active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredData.length && <p className="py-8 text-center text-xs text-slate-400">No matching accounts are recorded.</p>}
          </div>
        ) : (
          <div className="py-12 text-center max-w-md mx-auto">
            <Layers className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{config.title}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              This module is not connected to a live data source. No records or actions are simulated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
