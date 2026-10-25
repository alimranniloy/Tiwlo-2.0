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
    countryCode: '',
    postalCode: '',
    billingSameAsShipping: true,
    billingAddress: '',
    billingCity: '',
    billingCountry: '',
    billingCountryCode: '',
    billingRegion: '',
    billingPostalCode: '',
    notes: ''
  });
  const [shippingCountries, setShippingCountries] = useState([]);
  const [shippingCountryError, setShippingCountryError] = useState('');
  const [shippingCityError, setShippingCityError] = useState('');
  const [shippingCities, setShippingCities] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');

  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState('');
  const [isApplyingPromotion, setIsApplyingPromotion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shippingQuoteState, setShippingQuoteState] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery (COD)');

  const subtotal = Number(cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2));
  const hasShippingZones = (storeSettings?.shippingZones || []).some(zone => zone?.enabled !== false);
  const shippingSettingsKey = JSON.stringify([
    storeSettings?.shippingFlatRate,
    storeSettings?.freeShippingThreshold,
    storeSettings?.shippingZones || []
  ]);
  const shippingQuoteKey = JSON.stringify([
    formData.countryCode,
    formData.country,
    formData.city,
    cartItems.map(item => [item.id, item.quantity]),
    subtotal,
    shippingSettingsKey
  ]);
  const currentShippingQuote = shippingQuoteState?.key === shippingQuoteKey ? shippingQuoteState : null;
  const shippingQuote = currentShippingQuote?.quote || null;
  const shippingQuoteError = currentShippingQuote?.error || '';
  const isLoadingShippingQuote = !currentShippingQuote;
  const shipping = shippingQuote?.amount ?? null;
  const codAvailable = shippingQuote?.codEnabled !== false;
  const taxRate = shippingQuote?.taxRate != null
    ? Number(shippingQuote.taxRate) / 100
    : getStoreTaxRate(storeSettings || {});
  const discount = appliedPromotion?.discountAmount || 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = Number((discountedSubtotal * taxRate).toFixed(2));
  const baseTotal = Number((discountedSubtotal + tax + (shipping || 0)).toFixed(2));
  const orderCurrency = String(storeSettings?.currency || '').match(/[A-Z]{3}/i)?.[0]?.toUpperCase() || 'USD';
  const paymentOptions = (storeSettings?.paymentMethods || []).filter(method =>
    method.enabled && method.checkoutReady && method.currencies?.includes(orderCurrency)
  );
  const requestedPaymentMethodIsAvailable = paymentMethod === 'Cash on Delivery (COD)'
    ? codAvailable
    : paymentOptions.some(option => option.id === paymentMethod);
  const activePaymentMethod = requestedPaymentMethodIsAvailable
    ? paymentMethod
    : codAvailable
      ? 'Cash on Delivery (COD)'
      : paymentOptions[0]?.id || '';
  const selectedPaymentOption = paymentOptions.find(method => method.id === activePaymentMethod);
  const paymentFee = selectedPaymentOption?.feeMode === 'customer'
    ? Number((
      Number(selectedPaymentOption.feeFixed || 0) +
      baseTotal * Number(selectedPaymentOption.feePercent || 0) / 100
    ).toFixed(2))
    : 0;
  const total = Number((baseTotal + paymentFee).toFixed(2));

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/customer-auth/me')
      .then(async response => {
        if (response.status === 401) return null;
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Account lookup failed with HTTP ${response.status}.`);
        return result;
      })
      .then(result => {
        if (cancelled || !result?.customer) return;
        const addresses = Array.isArray(result.customer.addresses) ? result.customer.addresses : [];
        setSavedAddresses(addresses);
        setFormData(current => ({
          ...current,
          fullName: current.fullName || result.customer.name || '',
          phone: current.phone || result.customer.phone || '',
          email: current.email || result.customer.email || ''
        }));
        const preferred = addresses.find(address => address.isDefault) || addresses[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setFormData(current => ({
            ...current,
            address: current.address || preferred.line1 || '',
            city: current.city || preferred.city || '',
            country: current.country || preferred.country || '',
            countryCode: current.countryCode || preferred.countryCode || '',
            postalCode: current.postalCode || preferred.postalCode || ''
          }));
        }
      })
      .catch(error => {
        if (!cancelled) console.warn('Could not load saved customer addresses:', error.message);
      });
    fetch('/api/public/shipping/countries')
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Country list failed with HTTP ${response.status}`);
        if (!cancelled) setShippingCountries(result.countries || []);
      })
      .catch(error => {
        if (!cancelled) setShippingCountryError(error.message || 'Could not load countries.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = formData.city.trim();
    if (!formData.countryCode || query.length < 2) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/public/shipping/cities?countryCode=${encodeURIComponent(formData.countryCode)}&q=${encodeURIComponent(query)}`)
        .then(async response => {
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || `City lookup failed with HTTP ${response.status}`);
          if (!cancelled) setShippingCities(result.cities || []);
        })
        .catch(error => {
          if (!cancelled) {
            setShippingCities([]);
            setShippingCityError(error.message || 'Could not search cities.');
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.countryCode, formData.city]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch('/api/public/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: formData.country,
          countryCode: formData.countryCode,
          city: formData.city,
          items: cartItems.map(item => ({ productId: item.id, quantity: item.quantity })),
          subtotal
        })
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
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shippingQuoteKey, formData.country, formData.countryCode, formData.city, cartItems, subtotal]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (['country', 'countryCode', 'email', 'phone'].includes(e.target.name)) {
      setAppliedPromotion(null);
      setPromotionMessage('');
    }
    if (e.target.name === 'city') {
      setShippingCityError('');
      if (e.target.value.trim().length < 2) setShippingCities([]);
    }
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
        body: JSON.stringify({
          code,
          subtotal,
          countryCode: formData.countryCode,
          email: formData.email,
          phone: formData.phone
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Promotion validation failed with HTTP ${response.status}`);
      setAppliedPromotion(result);
      setPromotionMessage(result.discountType === 'fixed'
        ? `${formatStoreCurrency(result.discountAmount, storeSettings)} discount applied.`
        : `${result.discountPercent}% discount applied.`);
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
          countryCode: formData.countryCode,
          postalCode: formData.postalCode
        },
        billingAddress: formData.billingSameAsShipping ? {
          street: formData.address,
          city: formData.city,
          country: formData.country,
          countryCode: formData.countryCode,
          postalCode: formData.postalCode
        } : {
          street: formData.billingAddress,
          city: formData.billingCity,
          region: formData.billingRegion,
          country: formData.billingCountry,
          countryCode: formData.billingCountryCode,
          postalCode: formData.billingPostalCode
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
        paymentMethod: activePaymentMethod,
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
      onOrderCompleted?.(createdOrder);
      if (createdOrder.checkoutUrl) {
        window.location.assign(createdOrder.checkoutUrl);
        return;
      }
      showToast?.('Order placed successfully!', 'success');
      onNavigate?.('order-success', {
        orderId: createdOrder.id,
        order: createdOrder,
        receiptToken: createdOrder.receiptToken
      });
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
              {savedAddresses.length > 0 && (
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Use a saved address</label>
                  <select
                    value={selectedAddressId}
                    onChange={event => {
                      const saved = savedAddresses.find(item => item.id === event.target.value);
                      setSelectedAddressId(event.target.value);
                      if (saved) setFormData(previous => ({
                        ...previous,
                        fullName: saved.recipient || previous.fullName,
                        phone: saved.phone || previous.phone,
                        address: saved.line1 || '',
                        city: saved.city || '',
                        country: saved.country || '',
                        countryCode: saved.countryCode || '',
                        postalCode: saved.postalCode || ''
                      }));
                      else setFormData(previous => ({
                        ...previous,
                        address: '',
                        city: '',
                        country: '',
                        countryCode: '',
                        postalCode: ''
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                  >
                    <option value="">Enter a new address</option>
                    {savedAddresses.map(item => <option key={item.id} value={item.id}>{item.label}: {item.line1}, {item.city}, {item.country}</option>)}
                  </select>
                </div>
              )}
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
                  list="shipping-city-options"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                />
                <datalist id="shipping-city-options">
                  {shippingCities.map(city => <option key={city} value={city} />)}
                </datalist>
                <p className="mt-1 text-[10px] text-slate-400">
                  City suggestions: <a className="underline" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames Gazetteer</a> (CC BY 4.0).
                </p>
                {shippingCityError && <p role="alert" className="mt-1 text-[10px] text-rose-600">{shippingCityError}</p>}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Country *</label>
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={event => {
                    const country = shippingCountries.find(item => item.code === event.target.value);
                    setFormData(previous => ({
                      ...previous,
                      countryCode: event.target.value,
                      country: country?.name || '',
                      city: ''
                    }));
                    setShippingCities([]);
                    setShippingCityError('');
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-800 placeholder-slate-400 outline-none focus:border-[#2563eb]"
                >
                  <option value="">{shippingCountryError ? 'Country list unavailable' : 'Select country'}</option>
                  {shippingCountries.map(country => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
                {shippingCountryError && <p role="alert" className="mt-1 text-[10px] text-rose-600">{shippingCountryError}</p>}
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

          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-2xs">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Billing address</h2>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={formData.billingSameAsShipping}
                onChange={event => setFormData(previous => ({ ...previous, billingSameAsShipping: event.target.checked }))}
              />
              Same as delivery address
            </label>
            {!formData.billingSameAsShipping && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['billingAddress', 'Street address'],
                  ['billingCity', 'City'],
                  ['billingRegion', 'State / region'],
                  ['billingPostalCode', 'Postal code']
                ].map(([name, label]) => (
                  <label key={name} className="text-xs font-semibold text-slate-700">
                    {label}
                    <input name={name} value={formData[name]} onChange={handleChange} required={name === 'billingAddress'} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" />
                  </label>
                ))}
                <label className="text-xs font-semibold text-slate-700">
                  Country
                  <select
                    value={formData.billingCountryCode}
                    onChange={event => {
                      const country = shippingCountries.find(item => item.code === event.target.value);
                      setFormData(previous => ({ ...previous, billingCountryCode: event.target.value, billingCountry: country?.name || '' }));
                    }}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  >
                    <option value="">Select country</option>
                    {shippingCountries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Only server-enabled gateways with supported currencies are selectable. */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
              <div className="w-6 h-6 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center">
                2
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                Select Payment Method
              </h2>
            </div>
            <div className="space-y-2">
              {codAvailable && (
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${activePaymentMethod === 'Cash on Delivery (COD)' ? 'border-[#2563eb] bg-blue-50/40' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="Cash on Delivery (COD)"
                    checked={activePaymentMethod === 'Cash on Delivery (COD)'}
                    onChange={() => setPaymentMethod('Cash on Delivery (COD)')}
                    className="mt-1"
                  />
                  <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">Cash on Delivery (COD)</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Payment is collected on delivery and remains pending until the store confirms receipt.
                    </span>
                  </span>
                </label>
              )}
              {!codAvailable && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                  Cash on Delivery is unavailable for this delivery zone. Choose an online payment method.
                </p>
              )}
              {paymentOptions.map(method => (
                <label key={method.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${activePaymentMethod === method.id ? 'border-[#2563eb] bg-blue-50/40' : 'border-slate-200'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.id}
                    checked={activePaymentMethod === method.id}
                    onChange={() => setPaymentMethod(method.id)}
                    className="mt-1"
                  />
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{method.name}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Secure hosted checkout{method.feeMode === 'customer' && (method.feeFixed || method.feePercent)
                        ? ` · payment fee ${formatStoreCurrency(Number(method.feeFixed || 0) + baseTotal * Number(method.feePercent || 0) / 100, storeSettings)}`
                        : ''}
                    </span>
                  </span>
                </label>
              ))}
              {!codAvailable && paymentOptions.length === 0 && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-700">
                  No online gateway supports {orderCurrency} for this store. Contact the store to arrange payment.
                </p>
              )}
            </div>
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
                    onChange={event => {
                      setPromoCodeInput(event.target.value);
                      setAppliedPromotion(null);
                      setPromotionMessage('');
                    }}
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
                <span>{shippingQuote?.shippingMethod || 'Shipping'}</span>
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
              {paymentFee > 0 && (
                <div className="flex justify-between">
                  <span>Payment processing fee</span>
                  <span className="font-bold text-slate-900">{formatStoreCurrency(paymentFee, storeSettings)}</span>
                </div>
              )}
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
                (hasShippingZones && shipping === null) ||
                (!activePaymentMethod || (activePaymentMethod === 'Cash on Delivery (COD)' && !codAvailable)) ||
                (activePaymentMethod !== 'Cash on Delivery (COD)' && !selectedPaymentOption)}
              className="w-full py-4 px-6 rounded-xl text-white font-extrabold text-xs flex items-center justify-center space-x-2 transition shadow-lg active:scale-98 disabled:opacity-50 cursor-pointer hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <span>Securing Order & Deducting Stock...</span>
              ) : (
                <>
                  <span>{activePaymentMethod === 'Cash on Delivery (COD)' ? 'Confirm & Place Order' : 'Continue to Secure Payment'}</span>
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
