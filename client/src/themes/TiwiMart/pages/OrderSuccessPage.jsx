import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency } from '../storefrontUtils';
import { AlertCircle, CheckCircle, Package, Home } from 'lucide-react';

export default function OrderSuccessPage({
  order,
  orderId,
  receiptToken,
  paymentState,
  onNavigate
}) {
  const { storeSettings } = useStoreSettings();
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptError, setReceiptError] = useState('');
  useEffect(() => {
    if (!orderId || !receiptToken) return undefined;
    let cancelled = false;
    fetch(`/api/public/orders/${encodeURIComponent(orderId)}/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: receiptToken })
    })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Receipt lookup failed with HTTP ${response.status}.`);
        if (!cancelled) setReceiptOrder(result.order || null);
      })
      .catch(error => {
        if (!cancelled) setReceiptError(error.message || 'Could not load the payment receipt.');
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, receiptToken]);

  const orderDetails = receiptOrder || order || {};
  const paymentFailed = paymentState === 'failed' || paymentState === 'cancelled';
  const paymentPending = !paymentFailed &&
    paymentState !== 'paid' &&
    orderDetails.paymentStatus !== 'Paid' &&
    (paymentState === 'pending' || (
      Boolean(orderDetails.paymentMethod) &&
      !String(orderDetails.paymentMethod).includes('COD')
    ));

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      {/* Celebratory Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 text-center space-y-4">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xs border ${paymentFailed ? 'bg-rose-50 text-rose-600 border-rose-200' : paymentPending ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
          {paymentFailed ? <AlertCircle className="w-10 h-10 stroke-[2.2]" /> : <CheckCircle className="w-10 h-10 stroke-[2.2]" />}
        </div>

        <div>
          <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${paymentFailed ? 'text-rose-600 bg-rose-50' : paymentPending ? 'text-amber-700 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
            {paymentFailed ? 'Payment Not Completed' : paymentPending ? 'Payment Pending' : 'Order Submitted'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            {paymentFailed
              ? 'Your order is awaiting payment.'
              : paymentPending
                ? 'We are confirming your payment.'
                : 'Thank You. We Received Your Order.'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {paymentFailed
              ? 'No payment was confirmed. Contact the store before placing another order.'
              : paymentPending
                ? 'Do not pay again yet. You can check the latest order status below or contact the store.'
                : 'The store has received your order for confirmation. Available stock is reserved while the order is pending.'}
          </p>
          {receiptError && <p role="alert" className="mt-2 text-xs text-rose-600">{receiptError}</p>}
        </div>

        {/* Order Meta Pills */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
          <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Order number: </span>
            <span className="font-mono font-bold text-slate-900">{orderDetails.invoiceNumber || orderDetails.orderId || 'Unavailable'}</span>
          </div>
          <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Payment: </span>
            <span className="font-bold text-slate-900">{orderDetails.paymentMethod || 'Pending'}</span>
          </div>
          <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Status: </span>
            <span className="font-bold text-emerald-600">{orderDetails.status || 'Order information unavailable'}</span>
          </div>
        </div>
      </div>

      {/* Order Items & Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
          <span>Order Summary</span>
          <span className="text-xs text-slate-400 font-normal">
            {orderDetails.date || orderDetails.createdAt ? new Date(orderDetails.date || orderDetails.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }) : 'Date unavailable'}
          </span>
        </h2>

        {/* Item rows if available */}
        {orderDetails.items && orderDetails.items.length > 0 && (
          <div className="divide-y divide-slate-100">
            {orderDetails.items.map((item, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between space-x-3 text-xs">
                <div className="flex items-center space-x-3 min-w-0">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-12 h-12 object-contain rounded-xl bg-slate-50 border border-slate-200 p-1 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{item.productName || item.name}</p>
                    <p className="text-[11px] text-slate-400">Quantity: {item.quantity}</p>
                  </div>
                </div>
                <span className="font-bold text-slate-900 shrink-0">
                  {formatStoreCurrency(item.total ?? (item.unitPrice ?? item.price) * item.quantity, storeSettings)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total Box */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-base font-black text-slate-900">
          <span>Total Amount ({orderDetails.paymentStatus || 'Due'}):</span>
          <span className="text-[#2563eb] text-xl font-black">
            {formatStoreCurrency(orderDetails.totalAmount || 0, storeSettings)}
          </span>
        </div>

        {/* Shipping details */}
        {orderDetails.deliveryAddress && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Delivery Address:</p>
            <p className="text-slate-600">{orderDetails.deliveryAddress}</p>
            {orderDetails.customerPhone && (
              <p className="text-slate-500">Contact: {orderDetails.customerPhone}</p>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => onNavigate?.('track', {
              reference: orderDetails.invoiceNumber || '',
              phone: orderDetails.customerPhone || ''
            })}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center space-x-2 transition"
          >
            <Package className="w-4 h-4" />
            <span>Track this order</span>
          </button>
          <button
            onClick={() => onNavigate?.('home')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/20"
          >
            <Home className="w-4 h-4" />
            <span>Continue Shopping</span>
          </button>

        </div>
      </div>
    </div>
  );
}
