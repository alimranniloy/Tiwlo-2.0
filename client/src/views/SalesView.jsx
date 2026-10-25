import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import { formatStoreCurrency } from '../themes/TiwiMart/storefrontUtils';
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
  Sparkles,
  Truck,
  Save,
  MapPin
} from 'lucide-react';

const BANGLADESH_COURIER_SERVICES = Object.freeze([
  'Pathao',
  'Steadfast',
  'RedX',
  'eCourier',
  'Paperfly',
  'Sundarban Courier',
  'Other'
]);

export default function SalesView({
  products = [],
  customers = [],
  showToast,
  onRefreshData,
  onBackToDashboard,
  courierMode = false
}) {
  const [sales, setSales] = useState([]);
  const [storeSettings, setStoreSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');
  const [courierFilter, setCourierFilter] = useState('all');
  const [managingOrder, setManagingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

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
      const [salesResult, settingsResult] = await Promise.allSettled([
        fetch('/api/sales'),
        fetch('/api/store/settings')
      ]);
      if (salesResult.status === 'rejected') throw salesResult.reason;
      const salesResponse = salesResult.value;
      if (!salesResponse.ok) throw new Error('Could not load sales and orders.');
      const data = await salesResponse.json();
      if (!Array.isArray(data)) throw new Error('Sales and orders response was invalid.');
      setSales(data);
      if (settingsResult.status === 'fulfilled' && settingsResult.value.ok) {
        setStoreSettings(await settingsResult.value.json());
      } else {
        const error = settingsResult.status === 'rejected'
          ? settingsResult.reason
          : new Error(`Could not load store settings (HTTP ${settingsResult.value.status}).`);
        console.error(error);
        showToast?.('Sales loaded, but store currency settings could not be loaded.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.(err.message || 'Could not load sales and orders.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  // Filtered sales
  const courierOrders = sales.filter(sale => sale.channel === 'storefront');
  const filteredSales = (courierMode ? courierOrders : sales).filter(s => {
    const matchesSearch =
      (s.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.paymentMethod || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.courierService || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.trackingNumber || '').toLowerCase().includes(search.toLowerCase());

    const matchesMethod = methodFilter === 'All' || s.paymentMethod === methodFilter;
    const matchesCourier = courierFilter === 'all' ||
      (courierFilter === 'needs-assignment' && !s.courierService && !['Delivered', 'Cancelled', 'Returned'].includes(s.status)) ||
      (courierFilter === 'assigned' && Boolean(s.courierService)) ||
      (courierFilter === 'tracking' && Boolean(s.trackingNumber || s.trackingUrl));
    return matchesSearch && matchesMethod && matchesCourier;
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

  const openOrderManager = sale => {
    setManagingOrder(sale);
    setOrderForm({
      status: sale.status || 'Pending',
      paymentStatus: sale.paymentStatus || 'Pending',
      courierService: sale.courierService || '',
      trackingNumber: sale.trackingNumber || '',
      trackingUrl: sale.trackingUrl || ''
    });
  };

  const saveOrderUpdates = async event => {
    event.preventDefault();
    if (!managingOrder || !orderForm) return;
    setSavingOrder(true);
    try {
      const response = await fetch(`/api/sales/${encodeURIComponent(managingOrder.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderForm)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Order update failed with HTTP ${response.status}`);
      setSales(current => current.map(sale => sale.id === result.id ? result : sale));
      setManagingOrder(result);
      setOrderForm({
        status: result.status,
        paymentStatus: result.paymentStatus || 'Pending',
        courierService: result.courierService || '',
        trackingNumber: result.trackingNumber || '',
        trackingUrl: result.trackingUrl || ''
      });
      showToast?.('Order and tracking details updated.');
      onRefreshData?.();
    } catch (error) {
      showToast?.(error.message || 'Could not update this order.', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  const totalRevenue = sales
    .filter(sale => sale.status === 'Completed' || sale.status === 'Delivered' || sale.paymentStatus === 'Paid')
    .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const completedSales = sales.filter(sale => sale.status === 'Completed' || sale.status === 'Delivered');
  const avgOrder = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
  const formatAmount = (amount, sale) => formatStoreCurrency(amount, {
    ...storeSettings,
    currency: sale?.currency || storeSettings.currency
  });

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
                      {formatStoreCurrency(item.quantity * item.unitPrice, storeSettings)}
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

  if (managingOrder && orderForm) {
    const updateField = event => setOrderForm(current => ({ ...current, [event.target.name]: event.target.value }));
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setManagingOrder(null)} className="rounded-xl bg-slate-100 p-2 text-slate-600" aria-label="Back to orders">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Manage order {managingOrder.invoiceNumber}</h1>
            <p className="text-xs text-slate-500">{managingOrder.customerName} · {managingOrder.customerPhone || 'No phone number'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
            <Truck className="h-4 w-4 shrink-0" />
            <p>Bangladesh couriers are available for manual booking. Create the shipment in your courier account, then save its service, tracking number and public tracking URL here. International courier integrations can be offered later as marketplace plugins.</p>
          </div>
          {managingOrder.deliveryAddress && (
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <span>{managingOrder.deliveryAddress}</span>
            </div>
          )}
          <form onSubmit={saveOrderUpdates} className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-700">
              Order status
              <select name="status" value={orderForm.status} onChange={updateField} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                {['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'].map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Payment status
              <select name="paymentStatus" value={orderForm.paymentStatus} onChange={updateField} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                {['Pending', 'Paid', 'Failed', 'Refunded'].map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Courier service
              <select name="courierService" value={orderForm.courierService} onChange={updateField} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5">
                <option value="">Not assigned</option>
                {BANGLADESH_COURIER_SERVICES.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
                {orderForm.courierService && !BANGLADESH_COURIER_SERVICES.includes(orderForm.courierService) && (
                  <option value={orderForm.courierService}>{orderForm.courierService}</option>
                )}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Tracking number
              <input name="trackingNumber" value={orderForm.trackingNumber} onChange={updateField} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
              Courier tracking URL (HTTPS)
              <input type="url" name="trackingUrl" value={orderForm.trackingUrl} onChange={updateField} maxLength={500} placeholder="https://courier.example/track/..." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
            </label>
            <button disabled={savingOrder} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-60">
              <Save className="h-4 w-4" />
              {savingOrder ? 'Saving...' : 'Save order update'}
            </button>
          </form>
          <div className="border-t border-slate-100 pt-4">
            <h2 className="mb-3 text-xs font-bold text-slate-800">Status history</h2>
            <ol className="space-y-2">
              {(managingOrder.statusHistory || [{ status: managingOrder.status, at: managingOrder.date }]).map((entry, index) => (
                <li key={`${entry.status}-${entry.at}-${index}`} className="flex justify-between gap-3 text-xs text-slate-600">
                  <span>{entry.status}</span>
                  <time dateTime={entry.at}>{entry.at ? new Date(entry.at).toLocaleString() : ''}</time>
                </li>
              ))}
            </ol>
          </div>
          {managingOrder.trackingUrl && (
            <a
              href={managingOrder.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open courier tracking page
            </a>
          )}
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
                <span className="font-mono text-slate-800 dark:text-white">{formatAmount(item.total, viewingInvoice)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 dark:border-gray-800 pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span>{formatAmount(viewingInvoice.subtotal, viewingInvoice)}</span>
            </div>
            {viewingInvoice.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-{formatAmount(viewingInvoice.discount, viewingInvoice)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Estimated Tax:</span>
              <span>{formatAmount(viewingInvoice.tax, viewingInvoice)}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-gray-800">
              <span>Total:</span>
              <span className="text-blue-600 dark:text-blue-400">{formatAmount(viewingInvoice.totalAmount, viewingInvoice)}</span>
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
                {courierMode ? 'Courier & Delivery Management' : 'Sales & POS Invoicing Terminal'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pl-1">
              {courierMode
                ? 'Review storefront deliveries, assign a courier, and save shipment tracking details.'
                : 'Track customer sales orders, POS receipts, tax calculations, and printable invoices.'}
            </p>
          </div>
        </div>

        {!courierMode && <button
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
        </button>}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{courierMode ? 'Storefront Deliveries' : 'Total Sales Revenue'}</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
            {courierMode ? courierOrders.length : formatAmount(totalRevenue)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{courierMode ? 'Orders placed through your storefront' : 'From processed invoices'}</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{courierMode ? 'Courier assigned' : 'Total Invoices'}</span>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1.5">{courierMode ? courierOrders.filter(sale => sale.courierService).length : sales.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{courierMode ? 'Orders with a saved courier' : 'Generated receipts'}</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{courierMode ? 'Tracking saved' : 'Avg. Order Value'}</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">
            {courierMode ? courierOrders.filter(sale => sale.trackingNumber || sale.trackingUrl).length : formatAmount(avgOrder)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{courierMode ? 'Tracking number or URL recorded' : 'Per customer purchase'}</div>
        </div>

        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{courierMode ? 'Needs courier' : 'Pending Storefront Orders'}</span>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
            {courierOrders.filter(s => !s.courierService && !['Delivered', 'Cancelled', 'Returned'].includes(s.status)).length}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{courierMode ? 'Storefront orders not yet assigned' : 'Require confirmation or dispatch'}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {courierMode && (
          <p className="text-[11px] text-slate-500 sm:max-w-md">
            Courier bookings are made in your courier account. Assign the service here, then save its tracking details. Live courier booking APIs are not connected.
          </p>
        )}
        <div className="flex items-center space-x-2 text-xs">
          {courierMode ? (
            <select
              value={courierFilter}
              onChange={event => setCourierFilter(event.target.value)}
              aria-label="Filter courier orders"
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
            >
              <option value="all">All deliveries</option>
              <option value="needs-assignment">Needs courier</option>
              <option value="assigned">Courier assigned</option>
              <option value="tracking">Tracking saved</option>
            </select>
          ) : (
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
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={courierMode ? 'Search order, customer, courier, tracking…' : 'Search invoice #, customer name...'}
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
                <th className="py-3.5 px-4">Order / Delivery</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 font-medium">
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center text-sm font-normal text-slate-500">
                    {courierMode
                      ? (courierFilter === 'needs-assignment' ? 'No deliveries need a courier right now.' : 'No storefront deliveries match this filter.')
                      : 'No sales or orders match your search.'}
                  </td>
                </tr>
              )}
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
                    <div>{formatAmount(parseFloat(sale.subtotal || sale.totalAmount), sale)}</div>
                    <div className="text-[10px] text-slate-400">Tax: {formatAmount(parseFloat(sale.tax || 0), sale)}</div>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-sm text-slate-900 dark:text-white">
                    {formatAmount(parseFloat(sale.totalAmount || 0), sale)}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-slate-300">
                      {sale.paymentMethod || 'Cash'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex flex-col items-start gap-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {sale.status || 'Completed'}
                      </span>
                      {sale.channel === 'storefront' && (
                        <span className="text-[10px] text-slate-500">
                          {sale.courierService ? `${sale.courierService}${sale.trackingNumber ? ` · ${sale.trackingNumber}` : ''}` : 'Courier not assigned'}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      {sale.channel === 'storefront' && (
                        <button onClick={() => openOrderManager(sale)} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition">
                          Manage
                        </button>
                      )}
                      <button
                        onClick={() => setViewingInvoice(sale)}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 transition flex items-center space-x-1"
                        title="View & Print Invoice Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Invoice</span>
                      </button>
                    </div>
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
