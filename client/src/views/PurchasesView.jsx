import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  AlertCircle,
  FileText,
  DollarSign,
  Calendar,
  X,
  PackagePlus,
  Trash2,
  ExternalLink,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function PurchasesView({
  products = [],
  suppliers = [],
  showToast,
  onRefreshData,
  onBackToDashboard
}) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals
  const [isNewPOOpen, setIsNewPOOpen] = useState(false);
  const [viewingPO, setViewingPO] = useState(null);

  // New PO Form
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [poItems, setPoItems] = useState([
    { productId: products[0]?.id || '', quantity: 20, unitCost: 15.0 }
  ]);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/purchases');
      if (res.ok) {
        const data = await res.json();
        setPurchases(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  // Filtered POs
  const filteredPurchases = purchases.filter(p => {
    const matchesSearch =
      (p.poNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.supplierName || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.notes || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Receive Order (Restock)
  const handleReceivePO = async (po) => {
    try {
      const res = await fetch(`/api/purchases/${po.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Received', paymentStatus: 'Paid' })
      });
      if (res.ok) {
        showToast && showToast(`Purchase Order ${po.poNumber} received! Inventory stock incremented.`);
        loadPurchases();
        onRefreshData && onRefreshData();
      } else {
        showToast && showToast('Failed to update PO', 'error');
      }
    } catch (err) {
      showToast && showToast('Error connecting to server', 'error');
    }
  };

  // Handle Delete PO
  const handleDeletePO = async (id) => {
    try {
      const res = await fetch(`/api/purchases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPurchases(prev => prev.filter(p => p.id !== id));
        showToast && showToast('Purchase order deleted');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Item row to form
  const handleAddItemRow = () => {
    setPoItems(prev => [
      ...prev,
      { productId: products[0]?.id || '', quantity: 10, unitCost: 20.0 }
    ]);
  };

  // Submit New PO
  const handleCreatePO = async (e) => {
    e.preventDefault();
    if (!poSupplierId && suppliers.length > 0) return;

    const supplierObj = suppliers.find(s => s.id === poSupplierId) || suppliers[0];

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierObj?.id || '',
          supplierName: supplierObj?.companyName || 'Global Supplier',
          expectedDelivery: poExpectedDate || new Date(Date.now() + 7 * 86400000).toISOString(),
          notes: poNotes,
          items: poItems
        })
      });

      if (res.ok) {
        showToast && showToast('Purchase order created successfully!');
        setIsNewPOOpen(false);
        loadPurchases();
        onRefreshData && onRefreshData();
      } else {
        showToast && showToast('Failed to create PO', 'error');
      }
    } catch (err) {
      showToast && showToast('Error creating PO', 'error');
    }
  };

  const totalSpend = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const pendingCount = purchases.filter(p => p.status === 'Pending' || p.status === 'Ordered').length;

  if (isNewPOOpen) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => setIsNewPOOpen(false)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Purchase Orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create Restock Purchase Order</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Specify vendor, quantities, unit costs, and delivery schedule</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleCreatePO} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Select Supplier *
                </label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={poExpectedDate}
                  onChange={(e) => setPoExpectedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-200">
                  Order Line Items
                </label>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  + Add Product Line
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {poItems.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-slate-50 dark:bg-gray-800 p-2 rounded-xl border border-slate-100 dark:border-gray-700">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = products.find(p => p.id === val);
                        const updated = [...poItems];
                        updated[idx].productId = val;
                        if (found?.costPrice) updated[idx].unitCost = found.costPrice;
                        setPoItems(updated);
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-slate-800 dark:text-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...poItems];
                        updated[idx].quantity = parseInt(e.target.value) || 1;
                        setPoItems(updated);
                      }}
                      className="w-20 px-2 py-1.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-center font-bold"
                    />

                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Cost"
                      value={item.unitCost}
                      onChange={(e) => {
                        const updated = [...poItems];
                        updated[idx].unitCost = parseFloat(e.target.value) || 0;
                        setPoItems(updated);
                      }}
                      className="w-24 px-2 py-1.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-right font-bold"
                    />

                    {poItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                PO Notes / Terms
              </label>
              <textarea
                rows="3"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                placeholder="e.g. FOB Destination, Net 30 payment terms"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsNewPOOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Issue Purchase Order
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (viewingPO) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => setViewingPO(null)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Purchase Orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">PO: {viewingPO.poNumber}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Supplier: {viewingPO.supplierName}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-gray-800/60 p-4 rounded-xl">
            <div>
              <span className="text-slate-400 text-[10px]">Order Date:</span>
              <p className="font-bold text-slate-800 dark:text-white text-sm">{new Date(viewingPO.date).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">Current Status:</span>
              <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">{viewingPO.status}</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">Ordered Items:</h4>
            <div className="border border-slate-200 dark:border-gray-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-gray-800">
              {viewingPO.items?.map((item, i) => (
                <div key={i} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white">{item.productName}</p>
                    <p className="text-[11px] text-slate-400">{item.quantity} units @ ${item.unitCost}</p>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">${item.total?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 font-bold text-base border-t border-slate-100 dark:border-gray-800">
            <span>Total PO Amount:</span>
            <span className="text-blue-600 dark:text-blue-400">${viewingPO.totalAmount?.toFixed(2)}</span>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setViewingPO(null)}
              className="px-5 py-2 text-xs font-semibold bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer"
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
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
                <ShoppingCart className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Purchases & Restock Orders (PO)
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Generate restocking purchase orders, track inbound shipments, and 1-click receive to stock.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0 w-full sm:w-auto">
          <button
            onClick={() => {
              setPoSupplierId(suppliers[0]?.id || '');
              setPoItems([{ productId: products[0]?.id || '', quantity: 25, unitCost: 20.0 }]);
              setIsNewPOOpen(true);
            }}
            className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Purchase Order</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Purchase Orders</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{purchases.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Historical records</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Inbound / Pending</span>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">{pendingCount}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Awaiting warehouse receipt</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed Restocks</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {purchases.filter(p => p.status === 'Received').length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Fully restocked</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Spend</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            ${Math.round(totalSpend).toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Across all vendor POs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Ordered">Ordered / In Transit</option>
            <option value="Received">Received</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO #, supplier, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* PO Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-4">Supplier Partner</th>
                <th className="py-3.5 px-4">Order Date</th>
                <th className="py-3.5 px-4">Items Summary</th>
                <th className="py-3.5 px-4">Total Cost</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {filteredPurchases.map((po) => {
                const isReceived = po.status === 'Received';
                const isPending = po.status === 'Pending';
                const isOrdered = po.status === 'Ordered';

                return (
                  <tr
                    key={po.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {po.poNumber}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800 dark:text-white leading-tight">
                        {po.supplierName}
                      </p>
                      <p className="text-[10px] text-slate-400">Vendor ID: {po.supplierId || 'Direct'}</p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {new Date(po.date).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {Array.isArray(po.items)
                          ? po.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')
                          : 'General restock items'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      ${parseFloat(po.totalAmount || 0).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          po.paymentStatus === 'Paid'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {po.paymentStatus || 'Pending'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isReceived
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isOrdered
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {isReceived ? 'Received & Restocked' : isOrdered ? 'In Transit' : 'Pending Approval'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {!isReceived && (
                          <button
                            onClick={() => handleReceivePO(po)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-xs transition flex items-center space-x-1"
                            title="Receive shipment & automatically increment inventory stock"
                          >
                            <PackagePlus className="w-3 h-3" />
                            <span>Receive & Restock</span>
                          </button>
                        )}
                        <button
                          onClick={() => setViewingPO(po)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                          title="View PO Details"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePO(po.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Delete PO"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

    </div>
  );
}
