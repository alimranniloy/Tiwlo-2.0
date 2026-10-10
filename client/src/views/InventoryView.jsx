import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  Boxes,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  ArrowUpDown,
  History,
  DollarSign,
  FileCheck,
  ShieldCheck,
  Package,
  Layers,
  CheckCircle2,
  X,
  SlidersHorizontal,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function InventoryView({
  products = [],
  onQuickStockChange,
  showToast,
  onBackToDashboard
}) {
  const [summary, setSummary] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('stock-list'); // 'stock-list' | 'adjustments' | 'valuation'

  // Adjustment Modal
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    productId: products[0]?.id || '',
    type: 'Add',
    quantity: 10,
    reason: 'Received shipment batch'
  });

  const fetchInventoryData = async () => {
    try {
      const [sumRes, adjRes] = await Promise.all([
        fetch('/api/inventory/summary').then(r => r.json()),
        fetch('/api/inventory/adjustments').then(r => r.json())
      ]);
      setSummary(sumRes);
      setAdjustments(adjRes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, [products]);

  // Submit stock adjustment
  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjForm.productId) return;

    try {
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjForm)
      });
      if (res.ok) {
        showToast && showToast('Inventory stock adjusted successfully!');
        setIsAdjModalOpen(false);
        fetchInventoryData();
      } else {
        showToast && showToast('Failed to adjust stock', 'error');
      }
    } catch (err) {
      showToast && showToast('Error connecting to server', 'error');
    }
  };

  // Filtered products
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.location || '').toLowerCase().includes(search.toLowerCase());

    const isLow = p.stock > 0 && p.stock < (p.minStock || 50);
    const isOut = p.stock === 0;
    const isHealthy = p.stock >= (p.minStock || 50);

    let matchesStatus = true;
    if (statusFilter === 'Healthy') matchesStatus = isHealthy;
    else if (statusFilter === 'Low Stock') matchesStatus = isLow;
    else if (statusFilter === 'Out of Stock') matchesStatus = isOut;

    return matchesSearch && matchesStatus;
  });

  if (isAdjModalOpen) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => setIsAdjModalOpen(false)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Inventory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Record Stock Adjustment</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Reconcile physical stock counts, log damage, or restock inventory</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleAdjustmentSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Target Product *
              </label>
              <select
                required
                value={adjForm.productId}
                onChange={(e) => setAdjForm({ ...adjForm, productId: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku}) — Current Stock: {p.stock}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Action Type *
                </label>
                <select
                  value={adjForm.type}
                  onChange={(e) => setAdjForm({ ...adjForm, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="Add">Add Stock (+)</option>
                  <option value="Remove">Remove Stock (-)</option>
                  <option value="Damage">Damage / Spoilage (-)</option>
                  <option value="Audit Count">Physical Count (Set exact)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjForm.quantity}
                  onChange={(e) => setAdjForm({ ...adjForm, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Reason / Audit Justification *
              </label>
              <textarea
                rows="3"
                required
                placeholder="e.g. Unloaded supplier restock, found damaged unit during aisle inspection"
                value={adjForm.reason}
                onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsAdjModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Commit Adjustment
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="mt-0.5 p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs shrink-0 cursor-pointer"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0">
                <Boxes className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Inventory & Valuation Control
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Real-time stock valuation, reorder alerts, location bin tracking, and reconciliation audits.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              setAdjForm({
                productId: products[0]?.id || '',
                type: 'Add',
                quantity: 10,
                reason: 'Routine warehouse restock'
              });
              setIsAdjModalOpen(true);
            }}
            className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer w-full sm:w-auto"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Units</span>
          <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">
            {summary?.totalUnits?.toLocaleString() || products.reduce((acc, p) => acc + (p.stock || 0), 0).toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">In physical storage</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Retail Valuation</span>
          <div className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">
            ${summary?.totalRetailValuation?.toLocaleString() || '0'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Potential sales value</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cost Valuation</span>
          <div className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-300 mt-1.5">
            ${summary?.totalCostValuation?.toLocaleString() || '0'}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Asset purchase cost</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Gross Margin</span>
          <div className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            ${summary?.potentialProfit?.toLocaleString() || '0'}
            <span className="text-xs font-normal text-slate-400 ml-1">({summary?.marginPercent || 48}%)</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Unrealized profit</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/70 dark:border-gray-800 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Attention Needed</span>
          <div className="text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">
            {(summary?.lowStockCount || 0) + (summary?.outOfStockCount || 0)} items
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Low or out of stock</div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('stock-list')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
              activeTab === 'stock-list'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Inventory Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition ${
              activeTab === 'adjustments'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            Audit Log / Adjustments ({adjustments.length})
          </button>
        </div>

        {activeTab === 'stock-list' && (
          <div className="flex items-center space-x-2 text-xs w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none flex-1 sm:flex-none"
            >
              <option value="All">All Stock Health</option>
              <option value="Healthy">Adequate Stock</option>
              <option value="Low Stock">Low Stock Alerts</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>

            <div className="relative flex-1 md:flex-none md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search stock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: STOCK LIST TABLE */}
      {activeTab === 'stock-list' && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Item & SKU</th>
                  <th className="py-3.5 px-4">Warehouse Location</th>
                  <th className="py-3.5 px-4">Current Stock</th>
                  <th className="py-3.5 px-4">Min. Reorder Point</th>
                  <th className="py-3.5 px-4">Unit Cost</th>
                  <th className="py-3.5 px-4">Total Asset Value</th>
                  <th className="py-3.5 px-4">Health Status</th>
                  <th className="py-3.5 px-4 text-right">Quick Stock Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
                {filteredProducts.map((p) => {
                  const isLow = p.stock > 0 && p.stock < (p.minStock || 50);
                  const isOut = p.stock === 0;
                  const itemValue = (p.stock || 0) * (p.costPrice || (p.price * 0.5));

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={p.image || '/default-product.svg'}
                            alt={p.name}
                            className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-100 dark:border-gray-700"
                          />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white leading-tight">
                              {p.name}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                              {p.sku}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {p.location || 'Aisle 1, Bin 01'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {p.stock}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">units</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {p.minStock || 30} units
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        ${parseFloat(p.costPrice || (p.price * 0.5)).toFixed(2)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        ${Math.round(itemValue).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOut
                              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : isLow
                              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                          }`}
                        >
                          {isOut ? 'Out of Stock' : isLow ? 'Low Stock Alert' : 'Adequate'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onQuickStockChange && onQuickStockChange(p.id, -5)}
                            disabled={p.stock < 5}
                            className="px-2 py-1 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 rounded-lg text-slate-600 dark:text-slate-300 text-[10px] font-bold disabled:opacity-30"
                            title="-5 units"
                          >
                            -5
                          </button>
                          <button
                            onClick={() => onQuickStockChange && onQuickStockChange(p.id, -1)}
                            disabled={p.stock <= 0}
                            className="w-6 h-6 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 rounded-lg font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-30"
                            title="-1 unit"
                          >
                            -
                          </button>
                          <button
                            onClick={() => onQuickStockChange && onQuickStockChange(p.id, 1)}
                            className="w-6 h-6 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 rounded-lg font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center"
                            title="+1 unit"
                          >
                            +
                          </button>
                          <button
                            onClick={() => onQuickStockChange && onQuickStockChange(p.id, 10)}
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 rounded-lg text-blue-600 dark:text-blue-400 text-[10px] font-bold"
                            title="+10 units"
                          >
                            +10
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ADJUSTMENTS AUDIT TRAIL */}
      {activeTab === 'adjustments' && (
        <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Product / SKU</th>
                  <th className="py-3.5 px-4">Adjustment Type</th>
                  <th className="py-3.5 px-4">Stock Change</th>
                  <th className="py-3.5 px-4">Reason / Notes</th>
                  <th className="py-3.5 px-4 text-right">Adjusted By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
                {adjustments.map((a) => {
                  const isPositive = a.quantity > 0;
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                    >
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {a.productName}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {a.sku}
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300">
                          {a.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`font-mono font-bold text-xs ${
                            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPositive ? `+${a.quantity}` : a.quantity} units
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {a.previousStock} ➔ {a.newStock}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-xs">
                        {a.reason}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-500 dark:text-slate-400">
                        {a.adjustedBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
