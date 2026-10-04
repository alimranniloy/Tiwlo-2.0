import React from 'react';
import { CheckCircle, Package, ArrowRight, Home, Printer, FileText } from 'lucide-react';

export default function OrderSuccessPage({ order, onNavigate, onOpenAdmin }) {
  const orderDetails = order || {
    orderId: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    totalAmount: 1028.99,
    paymentMethod: 'Cash on Delivery (COD)',
    customerName: 'Customer',
    deliveryAddress: 'Main Delivery Address, Dhaka',
    createdAt: new Date().toISOString(),
    items: []
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      {/* Celebratory Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-200">
          <CheckCircle className="w-10 h-10 stroke-[2.2]" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            Order Confirmed & Logged
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            Thank You For Your Order!
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Your order has been recorded in the Tiwlo StockPro database and stock has been automatically deducted from the warehouse inventory.
          </p>
        </div>

        {/* Order Meta Pills */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
          <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Order ID: </span>
            <span className="font-mono font-bold text-slate-900">{orderDetails.orderId || orderDetails.id}</span>
          </div>
          <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Payment: </span>
            <span className="font-bold text-slate-900">{orderDetails.paymentMethod}</span>
          </div>
          <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-400">Status: </span>
            <span className="font-bold text-emerald-600">Processing Dispatch</span>
          </div>
        </div>
      </div>

      {/* Order Items & Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-5">
        <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
          <span>Order Summary</span>
          <span className="text-xs text-slate-400 font-normal">
            {new Date(orderDetails.createdAt || Date.now()).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
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
                    <p className="font-bold text-slate-900 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">Quantity: {item.quantity}</p>
                  </div>
                </div>
                <span className="font-bold text-slate-900 shrink-0">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total Box */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-base font-black text-slate-900">
          <span>Total Amount Paid / Due:</span>
          <span className="text-[#2563eb] text-xl font-black">
            ${Number(orderDetails.totalAmount || 0).toFixed(2)}
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
            onClick={() => onNavigate?.('home')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/20"
          >
            <Home className="w-4 h-4" />
            <span>Continue Shopping</span>
          </button>

          {onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center space-x-2 transition"
            >
              <FileText className="w-4 h-4 text-[#2563eb]" />
              <span>View in StockPro Sales Ledger</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
