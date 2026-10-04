import React, { useState } from 'react';
import { X, Store, Sparkles, MapPin, Building, Globe, Phone, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { getStoreHostname, STORE_DOMAIN } from '../../../config/platformConfig';

export default function CreateStoreModal({ isOpen, onClose, onCreateStore }) {
  const [storeName, setStoreName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [category, setCategory] = useState('Fashion & Apparel');
  const [currency, setCurrency] = useState('USD ($)');
  const [planId, setPlanId] = useState('free');
  
  // Billing Address Details (requested in voice note)
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (val) => {
    setStoreName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setSubdomain(slug ? getStoreHostname(slug) : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    setLoading(true);
    try {
      await onCreateStore({
        storeName: storeName.trim(),
        subdomain: subdomain.trim(),
        category,
        currency,
        planId,
        billingDetails: {
          address: address.trim(),
          city: city.trim() || 'Dhaka',
          country: country.trim() || 'Bangladesh',
          postalCode: postalCode.trim(),
          phone: phone.trim()
        }
      });
      onClose();
      // Reset form
      setStoreName('');
      setSubdomain('');
      setAddress('');
      setCity('');
      setPostalCode('');
      setPhone('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92vh] bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header - Apple iOS style */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Create New Store
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Launch a dedicated, isolated storefront on Tiwlo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Section 1: Store Basics */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Store Information
              </span>
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                Isolated Tenant
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Store Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tiwlo Fashion Hub"
                value={storeName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subdomain URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`fashionhub.${STORE_DOMAIN}`}
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Store Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
                >
                  <option value="Fashion & Apparel">Fashion & Apparel</option>
                  <option value="Electronics & Tech">Electronics & Tech</option>
                  <option value="Supermarket & Grocery">Supermarket & Grocery</option>
                  <option value="Health & Beauty">Health & Beauty</option>
                  <option value="Restaurant & Food">Restaurant & Food</option>
                  <option value="General Retail">General Retail</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Store Default Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
              >
                <option value="USD ($)">USD ($) - US Dollar</option>
                <option value="BDT (৳)">BDT (৳) - Bangladeshi Taka</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
                <option value="GBP (£)">GBP (£) - British Pound</option>
              </select>
            </div>
          </div>

          {/* Section 2: Billing Address (Explicitly requested by user) */}
          <div className="pt-2 border-t border-slate-100 dark:border-gray-800 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Billing Address & Invoicing
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Street Address
              </label>
              <input
                type="text"
                placeholder="House 42, Road 11, Banani"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Dhaka"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  placeholder="1213"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  placeholder="Bangladesh"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Billing Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+880 1700-000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-800/60 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Plan Selection */}
          <div className="pt-2 border-t border-slate-100 dark:border-gray-800 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Subscription Tier
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPlanId('free')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                  planId === 'free'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 text-blue-600 ring-1 ring-blue-600'
                    : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <p className="text-xs font-bold">Standard Store</p>
                <p className="text-[11px] text-slate-400">Unlimited POS & Orders</p>
              </button>
              <button
                type="button"
                onClick={() => setPlanId('pro')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                  planId === 'pro'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-900/20 text-blue-600 ring-1 ring-blue-600'
                    : 'border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">Pro Multi-Branch</p>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <p className="text-[11px] text-slate-400">Custom Domain & API</p>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !storeName.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Creating Store...' : 'Launch New Store'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
