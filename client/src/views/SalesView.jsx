import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
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
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [refundFilter, setRefundFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [managingOrder, setManagingOrder] = useState(null);
  const [orderForm, setOrderForm] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [refundReference, setRefundReference] = useState('');
  const [refundNote, setRefundNote] = useState('');

  // Modals
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceBarcode, setInvoiceBarcode] = useState({ dataUrl: '', error: '' });
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('');
  const [customerPaymentMethod, setCustomerPaymentMethod] = useState('Cash');
  const [customerPaymentReference, setCustomerPaymentReference] = useState('');
  const [recordingCustomerPayment, setRecordingCustomerPayment] = useState(false);

  // New Sale Form
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [salePaymentMethod, setSalePaymentMethod] = useState('Cash');
  const [salePaymentReference, setSalePaymentReference] = useState('');
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

  const openInvoice = sale => {
    let dataUrl = '';
    let error = '';
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, String(sale.invoiceNumber || sale.id), {
        format: 'CODE128',
        displayValue: true,
        fontSize: 12,
        height: 48,
        margin: 8,
        background: '#ffffff',
        lineColor: '#111827'
      });
      dataUrl = canvas.toDataURL('image/png');
    } catch (barcodeError) {
      console.error('Invoice barcode generation failed:', barcodeError);
      error = 'Barcode could not be generated for this invoice.';
    }
    setInvoiceBarcode({ dataUrl, error });
    setCustomerPaymentAmount('');
    setCustomerPaymentReference('');
    setEditingInvoice(false);
    setViewingInvoice(sale);
  };

  const recordCustomerPayment = async event => {
    event.preventDefault();
    if (!viewingInvoice || !customerPaymentAmount) return;
    setRecordingCustomerPayment(true);
    try {
      const response = await fetch(`/api/sales/${viewingInvoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: customerPaymentAmount,
          method: customerPaymentMethod,
          reference: customerPaymentReference
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not record customer payment.');
      setViewingInvoice(result.sale);
      setSales(current => current.map(sale => sale.id === result.sale.id ? result.sale : sale));
      setCustomerPaymentAmount('');
      setCustomerPaymentReference('');
      showToast?.(`Payment ${Number(result.payment.amount).toFixed(2)} recorded for ${result.sale.invoiceNumber}.`);
      onRefreshData?.();
    } catch (error) {
      showToast?.(error.message || 'Could not record customer payment.', 'error');
    } finally {
      setRecordingCustomerPayment(false);
    }
  };

  // Filtered sales
  const courierOrders = sales.filter(sale => sale.channel === 'storefront');
  const filteredSales = (courierMode ? courierOrders : sales).filter(s => {
    const matchesSearch =
      (s.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.customerEmail || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.paymentMethod || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.courierService || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.trackingNumber || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.refundHistory || []).some(refund =>
        `${refund.status || ''} ${refund.reason || ''}`.toLowerCase().includes(search.toLowerCase())
      );

    const matchesMethod = methodFilter === 'All' || s.paymentMethod === methodFilter;
    const saleDue = getSaleDue(s);
    const matchesPayment = paymentFilter === 'all' ||
      (paymentFilter === 'due' && s.channel !== 'storefront' && saleDue > 0) ||
      (paymentFilter === 'paid' && s.paymentStatus === 'Paid');
    const refundStatuses = (s.refundHistory || []).map(refund => refund.status);
    const matchesRefund = refundFilter === 'all' ||
      (refundFilter === 'needs-review' && refundStatuses.includes('requested')) ||
      (refundFilter === 'in-progress' && refundStatuses.some(status =>
        ['approved', 'gateway_pending', 'gateway_unknown'].includes(status)
      ));
    const saleDate = new Date(s.date);
    const matchesDateFrom = !dateFrom || (Number.isFinite(saleDate.getTime()) && saleDate >= new Date(`${dateFrom}T00:00:00`));
    const dateToExclusive = dateTo ? new Date(`${dateTo}T00:00:00`) : null;
    if (dateToExclusive) dateToExclusive.setDate(dateToExclusive.getDate() + 1);
    const matchesDateTo = !dateTo || (Number.isFinite(saleDate.getTime()) && saleDate < dateToExclusive);
    const matchesCourier = courierFilter === 'all' ||
      (courierFilter === 'needs-assignment' && !s.courierService && !['Delivered', 'Cancelled', 'Returned'].includes(s.status)) ||
      (courierFilter === 'assigned' && Boolean(s.courierService)) ||
      (courierFilter === 'tracking' && Boolean(s.trackingNumber || s.trackingUrl));
    return matchesSearch && matchesMethod && matchesPayment && matchesCourier && matchesRefund && matchesDateFrom && matchesDateTo;
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
          paymentReference: salePaymentReference.trim(),
          discount: parseFloat(saleDiscount) || 0,
          notes: saleNotes
        })
      });

      if (res.ok) {
        const newSale = await res.json();
        showToast && showToast(`Sale ${newSale.invoiceNumber} recorded successfully!`);
        setIsNewSaleOpen(false);
        setSalePaymentReference('');
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
      courierService: sale.courierService || '',
      trackingNumber: sale.trackingNumber || '',
      trackingUrl: sale.trackingUrl || '',
      customerName: sale.customerName || '',
      customerPhone: sale.customerPhone || '',
      customerEmail: sale.customerEmail || '',
      shippingAddress: sale.shippingAddress || { street: '', city: '', region: '', postalCode: '', country: '', countryCode: '' },
      billingAddress: sale.billingAddress || null
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
        courierService: result.courierService || '',
        trackingNumber: result.trackingNumber || '',
        trackingUrl: result.trackingUrl || '',
        customerName: result.customerName || '',
        customerPhone: result.customerPhone || '',
        customerEmail: result.customerEmail || '',
        shippingAddress: result.shippingAddress || { street: '', city: '', region: '', postalCode: '', country: '', countryCode: '' },
        billingAddress: result.billingAddress || null
      });
      showToast?.('Order and tracking details updated.');
      onRefreshData?.();
    } catch (error) {
      showToast?.(error.message || 'Could not update this order.', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  const updateRefund = async (refund, action) => {
    if (!managingOrder) return;
    setSavingOrder(true);
    try {
      const response = await fetch(`/api/sales/${encodeURIComponent(managingOrder.id)}/refunds/${encodeURIComponent(refund.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reference: action === 'manual-process' ? refundReference : undefined,
          note: refundNote
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.refund) {
          setManagingOrder(current => ({
            ...current,
            paymentStatus: result.paymentStatus || current.paymentStatus,
            refundHistory: (current.refundHistory || []).map(entry =>
              entry.id === refund.id ? result.refund : entry
            )
          }));
          setSales(current => current.map(sale => sale.id === managingOrder.id ? {
            ...sale,
            paymentStatus: result.paymentStatus || sale.paymentStatus,
            refundHistory: (sale.refundHistory || []).map(entry =>
              entry.id === refund.id ? result.refund : entry
            )
          } : sale));
        }
        throw new Error(result.error || `Refund update failed with HTTP ${response.status}.`);
      }
      setManagingOrder(current => ({
        ...current,
        paymentStatus: result.paymentStatus || current.paymentStatus,
        refundHistory: (current.refundHistory || []).map(entry => entry.id === refund.id ? result.refund : entry)
      }));
      setSales(current => current.map(sale => sale.id === managingOrder.id ? {
        ...sale,
        paymentStatus: result.paymentStatus || sale.paymentStatus,
        refundHistory: (sale.refundHistory || []).map(entry => entry.id === refund.id ? result.refund : entry)
      } : sale));
      setRefundReference('');
      setRefundNote('');
      showToast?.(
        action === 'manual-process'
          ? 'Manual refund recorded with its reference.'
          : action === 'gateway-process'
            ? result.refund?.status === 'gateway_confirmed'
              ? 'Gateway confirmed the refund.'
              : result.refund?.status === 'gateway_pending'
                ? 'Gateway refund is pending confirmation.'
                : 'Refund request updated.'
            : `Refund request ${action === 'approve' ? 'approved' : 'rejected'}.`
      );
    } catch (error) {
      showToast?.(error.message || 'Could not update this refund request.', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  const openInvoiceEditor = () => {
    setInvoiceDraft({
      customerName: viewingInvoice.customerName || '',
      customerEmail: viewingInvoice.customerEmail || '',
      invoiceNotes: viewingInvoice.invoiceNotes || ''
    });
    setEditingInvoice(true);
  };

  const saveInvoiceEdits = async event => {
    event.preventDefault();
    if (!viewingInvoice || !invoiceDraft) return;
    setSavingOrder(true);
    try {
      const response = await fetch(`/api/sales/${encodeURIComponent(viewingInvoice.id)}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceDraft)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Invoice update failed with HTTP ${response.status}.`);
      setViewingInvoice(result);
      setSales(current => current.map(sale => sale.id === result.id ? result : sale));
      setEditingInvoice(false);
      showToast?.('Invoice details updated. Invoice number, date, and totals are protected.');
    } catch (error) {
      showToast?.(error.message || 'Could not update invoice details.', 'error');
    } finally {
      setSavingOrder(false);
    }
  };

  const emailInvoice = async () => {
    if (!viewingInvoice) return;
    setSendingInvoice(true);
    try {
      const response = await fetch(`/api/sales/${encodeURIComponent(viewingInvoice.id)}/invoice-email`, { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Invoice email failed with HTTP ${response.status}.`);
      showToast?.(`Invoice sent to ${result.sentTo}.`);
    } catch (error) {
      showToast?.(error.message || 'Could not send invoice email.', 'error');
    } finally {
      setSendingInvoice(false);
    }
  };

  const totalRevenue = sales
    .filter(sale => sale.status === 'Completed' || sale.status === 'Delivered' || sale.paymentStatus === 'Paid')
    .reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const completedSales = sales.filter(sale => sale.status === 'Completed' || sale.status === 'Delivered');
  const avgOrder = completedSales.length > 0 ? totalRevenue / completedSales.length : 0;
  const customerDueTotal = sales
    .filter(sale => sale.channel !== 'storefront')
    .reduce((total, sale) => total + Number(
      sale.dueAmount ?? (sale.paymentStatus === 'Paid'
        ? 0
        : Math.max(0, Number(sale.totalAmount || 0) - Number(sale.paidAmount || 0)))
    ), 0);
  const formatAmount = (amount, sale) => formatStoreCurrency(amount, {
    ...storeSettings,
    currency: sale?.currency || storeSettings.currency
  });
  const getSaleDue = sale => Number(
    sale.dueAmount ?? (sale.paymentStatus === 'Paid' ? 0 : Number(sale.totalAmount || 0) - Number(sale.paidAmount || 0))
  );

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
                  onChange={(e) => {
                    setSalePaymentMethod(e.target.value);
                    setSalePaymentReference('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-800 dark:text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Mobile Banking / bKash">Mobile Banking / bKash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              {salePaymentMethod !== 'Cash' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    External transaction reference
                  </label>
                  <input
                    required
                    maxLength={120}
                    value={salePaymentReference}
                    onChange={event => setSalePaymentReference(event.target.value)}
                    placeholder="Receipt or transaction number"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                  <p className="mt-1 text-[11px] text-amber-700">This records your external payment confirmation; Tiwlo does not charge or verify it.</p>
                </div>
              )}
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-semibold text-slate-700">Payment: {managingOrder.paymentStatus || 'Pending'}</p>
              <p className="mt-1 text-[11px] text-slate-500">Payment status is system-controlled. Gateway payments update after verification; collect COD from this order after delivery.</p>
            </div>
            <label className="text-xs font-semibold text-slate-700">
              Customer name
              <input name="customerName" value={orderForm.customerName} disabled={!['Pending', 'Confirmed'].includes(managingOrder.status || 'Pending')} onChange={updateField} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Customer phone
              <input name="customerPhone" value={orderForm.customerPhone} disabled={!['Pending', 'Confirmed'].includes(managingOrder.status || 'Pending')} onChange={updateField} maxLength={40} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" />
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
              Customer email
              <input type="email" name="customerEmail" value={orderForm.customerEmail} disabled={!['Pending', 'Confirmed'].includes(managingOrder.status || 'Pending')} onChange={updateField} maxLength={254} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 disabled:bg-slate-50" />
            </label>
            <div className="sm:col-span-2 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
              <h3 className="sm:col-span-2 text-xs font-bold text-slate-800">Delivery address</h3>
              {['street', 'city', 'region', 'postalCode', 'country'].map(field => (
                <label key={field} className="text-[11px] font-semibold capitalize text-slate-600">
                  {field}
                  <input
                    value={orderForm.shippingAddress?.[field] || ''}
                    disabled={!['Pending', 'Confirmed'].includes(managingOrder.status || 'Pending')}
                    onChange={event => setOrderForm(current => ({
                      ...current,
                      shippingAddress: { ...current.shippingAddress, [field]: event.target.value }
                    }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 disabled:bg-slate-50"
                  />
                </label>
              ))}
              <label className="sm:col-span-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                <input type="checkbox" checked={Boolean(orderForm.billingAddress)} disabled={!['Pending', 'Confirmed'].includes(managingOrder.status || 'Pending')} onChange={event => setOrderForm(current => ({
                  ...current,
                  billingAddress: event.target.checked
                    ? current.billingAddress || { street: '', city: '', region: '', postalCode: '', country: '', countryCode: '' }
                    : null
                }))} />
                Separate billing address
              </label>
              {orderForm.billingAddress && ['street', 'city', 'region', 'postalCode', 'country'].map(field => (
                <label key={`billing-${field}`} className="text-[11px] font-semibold capitalize text-slate-600">
                  Billing {field}
                  <input
                    value={orderForm.billingAddress[field] || ''}
                    disabled={!['Pending', 'Confirmed'].includes(managingOrder.status || 'Pending')}
                    onChange={event => setOrderForm(current => ({
                      ...current,
                      billingAddress: { ...current.billingAddress, [field]: event.target.value }
                    }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 disabled:bg-slate-50"
                  />
                </label>
              ))}
            </div>
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
          {(managingOrder.orderEditHistory || []).length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <h2 className="mb-3 text-xs font-bold text-slate-800">Order detail change history</h2>
              <ol className="space-y-2">
                {managingOrder.orderEditHistory.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="text-xs text-slate-600">
                    <span className="font-semibold capitalize">{entry.actorType}</span> changed {entry.changedFields?.join(', ')} · {entry.at ? new Date(entry.at).toLocaleString() : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="border-t border-slate-100 pt-4">
            <h2 className="mb-2 text-xs font-bold text-slate-800">Refund requests & processing history</h2>
            <p className="mb-3 text-[10px] text-slate-500">Approved bKash, Stripe and PayPal refunds can be sent to the gateway. Other methods remain manual. If a gateway response is uncertain, verify the provider dashboard before recording a manual result.</p>
            {(managingOrder.refundHistory || []).map(refund => (
              <div key={refund.id} className="mb-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <strong>{formatStoreCurrency(refund.amount, { ...storeSettings, currency: refund.currency || storeSettings.currency })}</strong>
                  <span className="font-semibold capitalize text-slate-600">{refund.status.replaceAll('_', ' ')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{refund.reason}</p>
                <ol className="mt-2 space-y-1 text-[10px] text-slate-500">
                  {(refund.events || []).map((event, index) => <li key={`${event.at}-${index}`}>{event.action.replaceAll('-', ' ')} · {event.at ? new Date(event.at).toLocaleString() : ''}{event.note ? ` · ${event.note}` : ''}{event.reference ? ` · Ref ${event.reference}` : ''}</li>)}
                </ol>
                {['requested', 'approved', 'gateway_unknown', 'gateway_pending'].includes(refund.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {refund.status === 'requested' && (
                      <>
                        <button type="button" disabled={savingOrder} onClick={() => updateRefund(refund, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">Approve request</button>
                        <button type="button" disabled={savingOrder} onClick={() => updateRefund(refund, 'reject')} className="rounded-lg border border-rose-200 px-3 py-1.5 text-[10px] font-bold text-rose-700 disabled:opacity-50">Reject</button>
                      </>
                    )}
                    {refund.status === 'approved' && (
                      <>
                        {['bkash', 'stripe', 'paypal'].includes(managingOrder.paymentGateway?.provider) &&
                          managingOrder.paymentGateway?.transactionId && (
                            <button
                              type="button"
                              disabled={savingOrder}
                              onClick={() => updateRefund(refund, 'gateway-process')}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50"
                            >
                              Refund via {managingOrder.paymentGateway.provider}
                            </button>
                          )}
                        <input value={refundReference} onChange={event => setRefundReference(event.target.value)} maxLength={160} placeholder="External/manual refund reference" className="min-w-48 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px]" />
                        <button type="button" disabled={savingOrder || refundReference.trim().length < 3} onClick={() => updateRefund(refund, 'manual-process')} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">Record manual refund</button>
                      </>
                    )}
                    {['gateway_unknown', 'gateway_pending'].includes(refund.status) && (
                      <>
                        <p className="basis-full text-[10px] text-amber-700">
                          Verify this refund in {refund.gatewayProvider || managingOrder.paymentGateway?.provider || 'the payment provider'} before recording it manually. Do not start a duplicate gateway refund.
                        </p>
                        <input value={refundReference} onChange={event => setRefundReference(event.target.value)} maxLength={160} placeholder="Verified provider refund reference" className="min-w-48 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px]" />
                        <button type="button" disabled={savingOrder || refundReference.trim().length < 3} onClick={() => updateRefund(refund, 'manual-process')} className="rounded-lg bg-amber-600 px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">Record verified refund</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            {(managingOrder.refundHistory || []).length === 0 && <p className="text-xs text-slate-500">No refund requests recorded.</p>}
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
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                viewingInvoice.paymentStatus === 'Paid'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
              }`}>
                {viewingInvoice.paymentStatus || viewingInvoice.status || 'Pending'}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Customer:</p>
              <p className="text-xs font-bold text-slate-800 dark:text-white">{viewingInvoice.customerName}</p>
              {viewingInvoice.customerEmail && <p className="text-[10px] text-slate-500">{viewingInvoice.customerEmail}</p>}
            </div>
          </div>

          <div className="my-4 rounded-xl border border-slate-100 bg-white px-3 py-2 text-center">
            <div className="mb-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Barcode className="h-3.5 w-3.5" /> Machine-readable invoice code
            </div>
            {invoiceBarcode.dataUrl && <img src={invoiceBarcode.dataUrl} role="img" alt={`Barcode for invoice ${viewingInvoice.invoiceNumber}`} className="mx-auto max-w-full" />}
            {invoiceBarcode.error && <p role="alert" className="text-[10px] text-rose-600">{invoiceBarcode.error}</p>}
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
            <div className="flex justify-between text-slate-600">
              <span>Paid:</span>
              <span>{formatAmount(viewingInvoice.paidAmount ?? (viewingInvoice.paymentStatus === 'Paid' ? viewingInvoice.totalAmount : 0), viewingInvoice)}</span>
            </div>
            <div className="flex justify-between font-bold text-rose-600">
              <span>Outstanding due:</span>
              <span>{formatAmount(viewingInvoice.dueAmount ?? Math.max(0, Number(viewingInvoice.totalAmount || 0) - Number(viewingInvoice.paidAmount || 0)), viewingInvoice)}</span>
            </div>
            <div className="text-[11px] text-slate-400 pt-1">
              Payment Method: {viewingInvoice.paymentMethod}
            </div>
            {viewingInvoice.invoiceNotes && (
              <div className="pt-2 text-[11px] text-slate-500">Invoice note: {viewingInvoice.invoiceNotes}</div>
            )}
          </div>
          {Array.isArray(viewingInvoice.payments) && viewingInvoice.payments.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-bold">Payment history</h3>
              {viewingInvoice.payments.map(payment => (
                <div key={payment.id} className="flex justify-between text-[11px] text-slate-600">
                  <span>{new Date(payment.createdAt).toLocaleString()} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</span>
                  <strong>{formatAmount(payment.amount, viewingInvoice)}</strong>
                </div>
              ))}
            </div>
          )}
          {viewingInvoice.channel !== 'storefront' && viewingInvoice.customerId &&
            Number(viewingInvoice.dueAmount ?? Math.max(0, Number(viewingInvoice.totalAmount || 0) - Number(viewingInvoice.paidAmount || 0))) > 0 && (
            <form onSubmit={recordCustomerPayment} className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <h3 className="text-xs font-bold text-slate-800">Record customer due payment</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <input required type="number" min="0.01" max={Number(viewingInvoice.dueAmount ?? Math.max(0, Number(viewingInvoice.totalAmount || 0) - Number(viewingInvoice.paidAmount || 0)))} step="0.01" value={customerPaymentAmount} onChange={event => setCustomerPaymentAmount(event.target.value)} placeholder="Amount received" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
                <select value={customerPaymentMethod} onChange={event => setCustomerPaymentMethod(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                  <option>Cash</option><option>Bank transfer</option><option>Card</option><option>Mobile payment</option>
                </select>
                <input required={customerPaymentMethod !== 'Cash'} maxLength={120} value={customerPaymentReference} onChange={event => setCustomerPaymentReference(event.target.value)} placeholder={customerPaymentMethod === 'Cash' ? 'Optional note / receipt no.' : 'Required transaction reference'} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
              </div>
              <button type="submit" disabled={recordingCustomerPayment} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{recordingCustomerPayment ? 'Saving…' : 'Save customer payment'}</button>
            </form>
          )}

          {editingInvoice && invoiceDraft ? (
            <form onSubmit={saveInvoiceEdits} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
              <p className="text-[10px] text-slate-500">Invoice number, date, line items, and totals cannot be edited to preserve the order and payment record.</p>
              <label className="text-[11px] font-semibold text-slate-600">
                Customer name
                <input required maxLength={120} value={invoiceDraft.customerName} onChange={event => setInvoiceDraft(current => ({ ...current, customerName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-[11px] font-semibold text-slate-600">
                Customer email
                <input type="email" maxLength={254} value={invoiceDraft.customerEmail} onChange={event => setInvoiceDraft(current => ({ ...current, customerEmail: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
              </label>
              <label className="text-[11px] font-semibold text-slate-600">
                Invoice note
                <textarea maxLength={500} rows={2} value={invoiceDraft.invoiceNotes} onChange={event => setInvoiceDraft(current => ({ ...current, invoiceNotes: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingInvoice(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">Cancel</button>
                <button type="submit" disabled={savingOrder} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save invoice details</button>
              </div>
            </form>
          ) : (
          <div className="flex justify-between items-center pt-5 border-t border-slate-100 dark:border-gray-800 mt-4">
            <button
              type="button"
              onClick={openInvoiceEditor}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Edit details
            </button>
            <button
              type="button"
              onClick={emailInvoice}
              disabled={sendingInvoice || !viewingInvoice.customerEmail}
              title={!viewingInvoice.customerEmail ? 'Add a customer email before sending this invoice.' : 'Email invoice to the customer'}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:text-slate-200"
            >
              {sendingInvoice ? 'Sending…' : 'Email invoice'}
            </button>
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
          )}
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-4">
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
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{courierMode ? 'Needs courier' : 'Refunds needing review'}</span>
          <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5">
          {courierMode
            ? courierOrders.filter(s => !s.courierService && !['Delivered', 'Cancelled', 'Returned'].includes(s.status)).length
            : sales.reduce((count, sale) => count + (sale.refundHistory || []).filter(refund => refund.status === 'requested').length, 0)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{courierMode ? 'Storefront orders not yet assigned' : 'Open them from Sales & Orders → Manage'}</div>
        </div>
        <div className="bg-white dark:bg-[#111827] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-200 dark:border-amber-900 shadow-xs">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{courierMode ? 'Delivery payments' : 'Customer Due'}</span>
          <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">
            {courierMode ? '—' : formatAmount(customerDueTotal)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">{courierMode ? 'Storefront settlement status' : 'Open invoice and record customer payments'}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {courierMode && (
          <p className="text-[11px] text-slate-500 sm:max-w-md">
            Courier bookings are made in your courier account. Assign the service here, then save its tracking details. Live courier booking APIs are not connected.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
            <>
              <select
                value={methodFilter}
                onChange={event => setMethodFilter(event.target.value)}
                aria-label="Filter by payment method"
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none"
              >
                <option value="All">All Payment Methods</option>
                <option value="Cash">Cash</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Mobile Banking / bKash">Mobile Banking / bKash</option>
              </select>
              <select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)} aria-label="Filter customer payment balance" className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none">
                <option value="all">All balances</option>
                <option value="due">Customer due only</option>
                <option value="paid">Paid invoices</option>
              </select>
              <select value={refundFilter} onChange={event => setRefundFilter(event.target.value)} aria-label="Filter refund requests" className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium focus:outline-none">
                <option value="all">All refund states</option>
                <option value="needs-review">Refunds needing review</option>
                <option value="in-progress">Refunds in progress</option>
              </select>
              <label className="flex items-center gap-1 text-[10px] text-slate-500">From<input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700" /></label>
              <label className="flex items-center gap-1 text-[10px] text-slate-500">To<input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700" /></label>
            </>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={courierMode ? 'Search order, customer, courier, tracking…' : 'Search invoice #, customer, email, refund...'}
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
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        sale.paymentStatus === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}>
                        {sale.paymentStatus || 'Pending'}
                        {sale.channel !== 'storefront' && getSaleDue(sale) > 0 ? ` · Due ${formatAmount(getSaleDue(sale), sale)}` : ''}
                      </span>
                      {(sale.refundHistory || []).some(refund => refund.status === 'requested') && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Refund requested
                        </span>
                      )}
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
                        onClick={() => openInvoice(sale)}
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
