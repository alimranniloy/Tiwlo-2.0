import React from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency, getShippingAmount, getStoreTaxRate } from '../storefrontUtils';

export default function CartPage({
  cartItems = [],
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onNavigate,
}) {
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const shipping = getShippingAmount(subtotal, storeSettings || {});
  const taxRate = getStoreTaxRate(storeSettings || {});
  const tax = subtotal * taxRate;
  const total = subtotal + tax + (shipping || 0);

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-5 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500">
        <button onClick={() => onNavigate?.('home')} className="hover:text-[#2563eb] flex items-center space-x-1">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>Home</span>
        </button>
        <span>/</span>
        <span className="text-slate-800 font-bold">Shopping Cart</span>
      </nav>

      {/* Page Title */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563eb] flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Shopping Cart
            </h1>
            <p className="text-xs text-slate-400">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)} item(s) selected
            </p>
          </div>
        </div>

        {cartItems.length > 0 && (
          <button
            onClick={onClearCart}
            className="text-xs text-rose-500 hover:text-rose-700 font-semibold transition"
          >
            Clear All Items
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        /* Empty Cart State */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-12 text-center max-w-xl mx-auto space-y-4 my-8">
          <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto text-slate-300">
            <ShoppingBag className="w-10 h-10 stroke-[1.2]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Your shopping cart is currently empty</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            Review the items and store-provided charges before continuing.
          </p>
          <div className="pt-3">
            <button
              onClick={() => onNavigate?.('home')}
              className="px-6 py-3 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs transition shadow-md shadow-blue-500/20 inline-flex items-center space-x-2"
            >
              <span>Explore Marketplace Deals</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Active Cart Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Cart Items Table */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Products</span>
              <span className="hidden sm:inline">Price & Quantity</span>
            </div>

            <div className="divide-y divide-slate-100">
              {cartItems.map((item) => (
                <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                  {/* Product info */}
                  <div className="flex items-center space-x-4 min-w-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      onClick={() => onNavigate?.('product', { id: item.id })}
                      className="w-20 h-20 object-contain rounded-xl bg-slate-50 border border-slate-200 p-2 cursor-pointer hover:scale-105 transition shrink-0"
                    />
                    <div className="min-w-0">
                      <h3
                        onClick={() => onNavigate?.('product', { id: item.id })}
                        className="text-sm font-bold text-slate-900 hover:text-[#2563eb] transition cursor-pointer truncate"
                      >
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        SKU: {item.sku || 'N/A'} • Ships in 24h
                      </p>
                      <div className="text-xs font-black text-[#2563eb] mt-1 sm:hidden">
                        {formatStoreCurrency(item.price, storeSettings)}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Price controls */}
                  <div className="flex items-center justify-between sm:justify-end space-x-6 w-full sm:w-auto">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-black text-slate-900">
                        {formatStoreCurrency(item.price * item.quantity, storeSettings)}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {formatStoreCurrency(item.price, storeSettings)} each
                      </p>
                    </div>

                    <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <button
                        onClick={() => onUpdateQty?.(item.id, item.quantity - 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition text-xs"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty?.(item.id, item.quantity + 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold transition text-xs"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem?.(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition"
                      title="Remove product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={() => onNavigate?.('home')}
                className="text-xs font-bold text-slate-700 hover:text-[#2563eb] flex items-center space-x-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Continue Shopping</span>
              </button>

              <div className="flex items-center space-x-3 text-xs text-slate-500">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>{shipping === null ? 'Shipping charges have not been configured.' : shipping === 0 ? 'Free shipping applies to this order.' : `Shipping: ${formatStoreCurrency(shipping, storeSettings)}`}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Checkout Trigger */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-5">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Order Summary
              </h2>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">{formatStoreCurrency(subtotal, storeSettings)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-bold text-slate-900">
                    {shipping === null ? 'Not configured' : shipping === 0 ? 'Free' : formatStoreCurrency(shipping, storeSettings)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Estimated Tax ({(taxRate * 100).toLocaleString()}%)</span>
                  <span className="font-bold text-slate-900">{formatStoreCurrency(tax, storeSettings)}</span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-black text-slate-900">
                  <span>Total Amount</span>
                  <span className="text-xl font-black" style={{ color: primaryColor }}>{formatStoreCurrency(total, storeSettings)}</span>
                </div>
                {shipping === null && <p className="text-[10px] text-slate-500">Shipping is not included in this estimate; confirm the charge with the store.</p>}
              </div>

              {/* Big Checkout Button */}
              <button
                type="button"
                onClick={() => onNavigate?.('checkout')}
                className="w-full py-3.5 px-6 rounded-xl text-white font-extrabold text-xs flex items-center justify-center space-x-2 transition shadow-lg active:scale-98 cursor-pointer hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Continue to confirm your order details.</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
