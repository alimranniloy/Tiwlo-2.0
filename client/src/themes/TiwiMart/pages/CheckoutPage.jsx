import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useEffect, useState } from 'react';
import {
  Banknote,
  ShieldCheck,
  Lock,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency, getStoreTaxRate } from '../storefrontUtils';

export default function CheckoutPage({
  cartItems = [],
  onNavigate,
  onOrderCompleted,
  showToast
}) {
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    notes: ''
  });

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState('');
  const [isApplyingPromotion, setIsApplyingPromotion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shippingQuoteState, setShippingQuoteState] = useState(null);

  const subtotal = Number(cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2));
  const hasShippingZones = (storeSettings?.shippingZones || []).some(zone => zone?.enabled !== false);
  const shippingSettingsKey = JSON.stringify([
    storeSettings?.shippingFlatRate,
    storeSettings?.freeShippingThreshold,
    storeSettings?.shippingZones || []
  ]);
  const shippingQuoteKey = JSON.stringify([formData.country, subtotal, shippingSettingsKey]);
  const currentShippingQuote = shippingQuoteState?.key === shippingQuoteKey ? shippingQuoteState : null;
  const shippingQuote = currentShippingQuote?.quote || null;
  const shippingQuoteError = currentShippingQuote?.error || '';
  const isLoadingShippingQuote = !currentShippingQuote;
  const shipping = shippingQuote?.amount ?? null;
  const codAvailable = shippingQuote?.codEnabled !== false;
  const taxRate = getStoreTaxRate(storeSettings || {});
  const discount = appliedPromotion?.discountAmount || 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = Number((discountedSubtotal * taxRate).toFixed(2));
  const total = Number((discountedSubtotal + tax + (shipping || 0)).toFixed(2));

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/shipping/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: formData.country, subtotal })
    })
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Shipping quote failed with HTTP ${response.status}`);
        if (!cancelled) setShippingQuoteState({ key: shippingQuoteKey, quote: result, error: '' });
      })
      .catch(error => {
        if (!cancelled) setShippingQuoteState({
          key: shippingQuoteKey,
          quote: null,
          error: error.message || 'Could not calculate shipping.'
        });
      });
    return () => {
      cancelled = true;
    };
  }, [shippingQuoteKey, formData.country, subtotal]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleApplyPromotion = async () => {
    const code = promoCodeInput.trim();
    if (!code) {
      setPromotionMessage('Enter a promotion code first.');
      return;
    }
    setIsApplyingPromotion(true);
    setPromotionMessage('');
    try {
      const response = await fetch('/api/public/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Promotion validation failed with HTTP ${response.status}`);
      setAppliedPromotion(result);
      setPromotionMessage(`${result.discountPercent}% discount applied.`);
    } catch (error) {
      setAppliedPromotion(null);
      setPromotionMessage(error.message || 'Could not validate this promotion code.');
    } finally {
      setIsApplyingPromotion(false);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (isLoadingShippingQuote || !shippingQuote || shippingQuoteError ||
        (hasShippingZones && (!shippingQuote?.available || shipping === null))) {
      setErrorMsg(shippingQuoteError || 'Wait for a valid shipping quote for your delivery country.');
      return;
    }
    if (!formData.fullName.trim() || !formData.phone.trim() ||
        !formData.address.trim() || !formData.country.trim()) {
      setErrorMsg('Please fill in your Full Name, Phone Number, Delivery Address, and Country.');
      showToast?.('Please complete required shipping fields', 'error');
      return;
    }

    if (cartItems.length === 0) {
      showToast?.('Your cart is empty. Please add items before checking out.', 'error');
      onNavigate?.('home');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderPayload = {
        channel: 'storefront',
        customerName: formData.fullName,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        shippingAddress: {
          street: formData.address,
          city: formData.city,
          country: formData.country,
          postalCode: formData.postalCode
        },
        items: cartItems.map(i => ({
          productId: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image
        })),
        subtotal,
        shipping: shipping || 0,
        tax,
        totalAmount: total,
        paymentMethod: 'Cash on Delivery (COD)',
        promoCode: appliedPromotion?.code || '',
        status: 'Processing',
        notes: formData.notes
      };

      // Send to server sales API
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const createdOrder = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(createdOrder.error || `Failed to record order with HTTP ${res.status}`);
      showToast?.('Order placed successfully!', 'success');
      onOrderCompleted?.(createdOrder);
      onNavigate?.('order-success', { orderId: createdOrder.id, order: createdOrder });
    } catch (err) {
      console.warn('Could not record storefront order:', err);
      setErrorMsg(err.message || 'We could not record your order. Please try again or contact the store.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-5 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-slate-500">
        <button onClick={() => onNavigate?.('home')} className="hover:text-[#2563eb]">Home</button>
        <span>/</span>
        <button onClick={() => onNavigate?.('cart')} className="hover:text-[#2563eb]">Cart</button>
        <span>/</span>
        <span className="text-slate-800 font-bold">Checkout</span>
      </nav>

      {/* Page Title */}
      <div className="flex items-center space-x-3 pb-2 border-b border-slate-200">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563eb] flex items-center justify-center">
          <Lock className="w-5 h-5 stroke-[2.2]" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Checkout
          </h1>
          <p className="text-xs text-slate-400">
            Review your delivery details and order estimate before placing the order.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Customer Delivery Info & Payment Methods */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* 1. Delivery Address Card */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center">
                1
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Delivery Information
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. John Doe / Imran Khan"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+880 1700 000000"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="customer@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Street Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="House #, Road #, Area, Landmark"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">City / Region</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Dhaka"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Country *</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Bangladesh"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Delivery Notes (Optional)</label>
                <input
                  type="text"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Instructions for courier (e.g. Ring bell, leave with security)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
              </div>
            </div>
          </div>

          {/* Payment methods are limited to configured, working options. */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center">
                2
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Select Payment Method
              </h2>
            </div>
            <div className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${codAvailable ? 'border-[#2563eb] bg-blue-50/40' : 'border-rose-300 bg-rose-50'}`}>
              <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Cash on Delivery (COD){!codAvailable ? ' — unavailable in this zone' : ''}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Payment is collected on delivery and remains pending until the store confirms receipt.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              {storeSettings?.paymentMethods?.length
                ? 'This store has saved gateway settings, but secure online payment processing is not active yet. Online methods will appear only after transaction and callback verification are implemented.'
                : 'Online card and mobile banking payments are not enabled because no gateway has been connected for this store.'}
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Order Summary & Place Order Button */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-5 sticky top-24">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs text-slate-400 font-normal">
                {cartItems.reduce((acc, i) => acc + i.quantity, 0)} Items
              </span>
            </h2>

            {/* Items mini list */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between space-x-3 text-xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 object-contain rounded-lg border border-slate-200 p-1 bg-slate-50 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">
                    {formatStoreCurrency(item.price * item.quantity, storeSettings)}
                  </span>
                </div>
              ))}
            </div>

            {storeSettings?.promoActive && (
              <div className="space-y-2 border-y border-slate-100 py-4">
                <label htmlFor="promotion-code" className="block text-xs font-semibold text-slate-700">
                  Promotion code
                </label>
                <div className="flex gap-2">
                  <input
                    id="promotion-code"
                    value={promoCodeInput}
                    onChange={event => setPromoCodeInput(event.target.value)}
                    maxLength={32}
                    autoComplete="off"
                    placeholder="Enter code"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs uppercase text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromotion}
                    disabled={isApplyingPromotion}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {isApplyingPromotion ? 'Checking...' : appliedPromotion ? 'Applied' : 'Apply'}
                  </button>
                </div>
                {promotionMessage && (
                  <p role="status" className={`text-[11px] ${appliedPromotion ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {promotionMessage}
                  </p>
                )}
              </div>
            )}

            {/* Calculations */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">{formatStoreCurrency(subtotal, storeSettings)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Promotion ({appliedPromotion.code})</span>
                  <span className="font-bold">-{formatStoreCurrency(discount, storeSettings)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-bold text-slate-900">
                  {isLoadingShippingQuote
                    ? 'Calculating…'
                    : shipping === null
                      ? (shippingQuoteError ? 'Unavailable' : 'Not configured')
                      : shipping === 0
                        ? 'Free'
                        : formatStoreCurrency(shipping, storeSettings)}
                </span>
              </div>
              {shippingQuoteError && (
                <p role="alert" className="text-[10px] text-rose-600">{shippingQuoteError}</p>
              )}
              {shippingQuote?.minDeliveryDays != null && shippingQuote?.maxDeliveryDays != null && (
                <div className="flex justify-between text-[10px]">
                  <span>Estimated delivery</span>
                  <span>{shippingQuote.minDeliveryDays}–{shippingQuote.maxDeliveryDays} days</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Estimated Tax ({(taxRate * 100).toLocaleString()}%)</span>
                <span className="font-bold text-slate-900">{formatStoreCurrency(tax, storeSettings)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between text-base font-black text-slate-900">
                <span>Total Due</span>
                <span className="text-xl font-black" style={{ color: primaryColor }}>{formatStoreCurrency(total, storeSettings)}</span>
              </div>
              {shipping === null && (
                <p className="text-[10px] text-slate-500">
                  {hasShippingZones
                    ? 'This store has no shipping zone for the selected country.'
                    : 'Shipping is not configured and is not included in this estimate. Contact the store to confirm the charge.'}
                </p>
              )}
            </div>

            {/* Place Order CTA */}
            <button
              type="submit"
              disabled={isSubmitting || isLoadingShippingQuote || !shippingQuote || Boolean(shippingQuoteError) ||
                (hasShippingZones && (shipping === null || !codAvailable))}
              className="w-full py-4 px-6 rounded-xl text-white font-extrabold text-xs flex items-center justify-center space-x-2 transition shadow-lg active:scale-98 disabled:opacity-50 cursor-pointer hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <span>Securing Order & Deducting Stock...</span>
              ) : (
                <>
                  <span>Confirm & Place Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center text-[10px] text-slate-400 flex items-center justify-center space-x-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Order details are sent to the store for confirmation.</span>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
