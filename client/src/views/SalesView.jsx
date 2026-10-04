import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  DollarSign,
  Calendar,
  CreditCard,
  User,
  Printer,
  ExternalLink,
  X,
  ShoppingBag,
  Percent,
  Download,
  Barcode,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

export default function SalesView({
  products = [],
  customers = [],
  showToast,
  onRefreshData,
  onBackToDashboard
}) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');

  // Modals
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);

  // New Sale Form
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState('Cash');
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [saleNotes, setSaleNotes] = useState('');
  const [saleItems, setSaleItems] = useState([
    { productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.price || 20 }
  ]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales');
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  // Filtered sales
  const filteredSales = sales.filter(s => {
    const matchesSearch =
      (s.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.paymentMethod || '').toLowerCase().includes(search.toLowerCase());

    const matchesMethod = methodFilter === 'All' || s.paymentMethod === methodFilter;
    return matchesSearch && matchesMethod;
  });

  // Add Item Row
  const handleAddItemRow = () => {
    const defaultProd = products[0];
    setSaleItems(prev => [
      ...prev,
      { productId: defaultProd?.id || '', quantity: 1, unitPrice: defaultProd?.price || 25 }
    ]);
  };

  // Submit New Sale
  const handleCreateSale = async (e) => {
    e.preventDefault();
    const custObj = customers.find(c => c.id === saleCustomerId);

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: custObj?.id || '',
          customerName: custObj?.name || 'Walk-in Customer',
          items: saleItems,
          paymentMethod: salePaymentMethod,
          discount: parseFloat(saleDiscount) || 0,
          notes: saleNotes
        })
      });

      if (res.ok) {
        const newSale = await res.json();
        showToast && showToast(`Sale ${newSale.invoiceNumber} recorded successfully!`);
        setIsNewSaleOpen(false);
        loadSales();
        onRefreshData && onRefreshData();
      } else {
        showToast && showToast('Failed to record sale', 'error');
      }
    } catch (err) {
      showToast && showToast('Error connecting to server', 'error');
    }
  };

  const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const avgOrder = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Print Invoice handler
  const handlePrint = () => {
    window.print();
  };

  if (isNewSaleOpen) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => setIsNewSaleOpen(false)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Sales"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">New Point of Sale Order</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Process in-store checkout, select payment method, and generate invoice</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <form onSubmit={handleCreateSale} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Customer
                </label>
                <select
                  value={saleCustomerId}
                  onChange={(e) => setSaleCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Payment Method
                </label>
                <select
                  value={salePaymentMethod}
                  onChange={(e) => setSalePaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Mobile Banking / bKash">Mobile Banking / bKash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-200">
                  Cart Items
                </label>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {saleItems.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-slate-50 dark:bg-gray-800 p-2.5 rounded-xl border border-slate-100 dark:border-gray-700">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const val = e.target.value;
                        const found = products.find(p => p.id === val);
                        const updated = [...saleItems];
                        updated[idx].productId = val;
                        if (found?.price) updated[idx].unitPrice = found.price;
                        setSaleItems(updated);
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-slate-800 dark:text-white"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} (Stock: {p.stock})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...saleItems];
                        updated[idx].quantity = parseInt(e.target.value) || 1;
                        setSaleItems(updated);
                      }}
                      className="w-16 px-2 py-1.5 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg text-center font-bold"
                    />

                    <span className="w-20 font-bold text-right text-slate-800 dark:text-white">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </span>

                    {saleItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSaleItems(saleItems.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Discount ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={saleDiscount}
                  onChange={(e) => setSaleDiscount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter #2 sale"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIsNewSaleOpen(false)}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                Process Sale
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (viewingInvoice) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200 max-w-xl mx-auto">
        <div className="flex items-center space-x-3 mb-2">
          <button
            onClick={() => setViewingInvoice(null)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 transition shadow-xs cursor-pointer"
            title="Back to Sales"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Invoice: {viewingInvoice.invoiceNumber}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Order date: {new Date(viewingInvoice.date).toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 shadow-xs">
          <div className="border-b border-slate-200 dark:border-gray-800 pb-4 mb-4 flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <img src="/tiwlo-icon.png" alt="Tiwlo" className="w-5 h-5 object-contain dark:hidden" />
                <img src="/tiwlo-icon-dark.png" alt="Tiwlo" className="w-5 h-5 object-contain hidden dark:block" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Tiwlo Commerce</h2>
              </div>
              <p className="text-[11px] text-slate-400">Invoice: <strong>{viewingInvoice.invoiceNumber}</strong></p>
              <p className="text-[11px] text-slate-500">Date: {new Date(viewingInvoice.date).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                {viewingInvoice.status || 'PAID'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Customer:</p>
              <p className="text-xs font-bold text-slate-800 dark:text-white">{viewingInvoice.customerName}</p>
            </div>
          </div>

          <div className="space-y-2 py-2 text-xs">
            <div className="border-b border-slate-100 dark:border-gray-800 pb-1 flex justify-between font-semibold text-slate-500">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {viewingInvoice.items?.map((item, i) => (
              <div key={i} className="flex justify-between py-1.5">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-white">{item.productName}</span>
                  <span className="text-[11px] text-slate-400 ml-1.5">x{item.quantity}</span>
                </div>
                <span className="font-mono text-slate-800 dark:text-white">${item.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-gray-800 pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span>${viewingInvoice.subtotal?.toFixed(2)}</span>
            </div>
            {viewingInvoice.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-${viewingInvoice.discount?.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Estimated Tax:</span>
              <span>${viewingInvoice.tax?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-gray-800">
              <span>Total:</span>
              <span className="text-blue-600 dark:text-blue-400">${viewingInvoice.totalAmount?.toFixed(2)}</span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1">
              Payment Method: {viewingInvoice.paymentMethod}
            </div>
          </div>

          <div className="flex justify-between items-center pt-5 border-t border-slate-100 dark:border-gray-800 mt-4">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center space-x-1.5 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={() => setViewingInvoice(null)}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer"
            >
              Close
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
                <Receipt className="w-5 h-5" />
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Sales & POS Invoicing Terminal
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              Track customer sales orders, POS receipts, tax calculations, and printable invoices.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setSaleCustomerId(customers[0]?.id || '');
            setSaleItems([
              { productId: products[0]?.id || '', quantity: 1, unitPrice: products[0]?.price || 25 }
            ]);
            setIsNewSaleOpen(true);
          }}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Sale / POS Order</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Sales Revenue</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            ${Math.round(totalRevenue).toLocaleString()}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">From processed invoices</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Invoices</span>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">{sales.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Generated receipts</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg. Order Value</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            ${avgOrder.toFixed(2)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">Per customer purchase</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed Orders</span>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
            {sales.filter(s => s.status === 'Completed').length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">100% fulfillment rate</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
          >
            <option value="All">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Mobile Banking / bKash">Mobile Banking / bKash</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice #, customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Sales Invoices Table */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[760px]">
            <thead className="bg-[#F8FAFC] dark:bg-gray-800/60 border-b border-slate-100 dark:border-gray-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Items Summary</th>
                <th className="py-3.5 px-4">Subtotal / Tax</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment Method</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-gray-800/40 transition duration-150"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <Receipt className="w-4 h-4 text-indigo-500" />
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {sale.invoiceNumber}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-800 dark:text-white leading-tight">
                      {sale.customerName}
                    </p>
                  </td>

                  <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                    {new Date(sale.date).toLocaleDateString()}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {Array.isArray(sale.items)
                        ? sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')
                        : 'Store goods'}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    <div>${parseFloat(sale.subtotal || sale.totalAmount).toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">Tax: ${parseFloat(sale.tax || 0).toFixed(2)}</div>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-sm text-slate-900 dark:text-white">
                    ${parseFloat(sale.totalAmount || 0).toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300">
                      {sale.paymentMethod || 'Cash'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      {sale.status || 'Completed'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setViewingInvoice(sale)}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 transition flex items-center space-x-1 ml-auto"
                      title="View & Print Invoice Receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Invoice</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
