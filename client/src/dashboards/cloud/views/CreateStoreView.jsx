import React, { useState } from 'react';
import {
  Store,
  ArrowLeft,
  Sparkles,
  Globe,
  DollarSign,
  Mail,
  Phone,
  CheckCircle2,
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

const STORE_CATEGORIES = [
  'General Retail & Electronics',
  'Fashion & Apparel',
  'Grocery & Supermarket',
  'Pharmacy & Healthcare',
  'Restaurant & Fast Food',
  'Wholesale & Distribution',
  'Digital Products & Services'
];

export default function CreateStoreView({ onBack, onCreateStore, showToast }) {
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState(STORE_CATEGORIES[0]);
  const [subdomain, setSubdomain] = useState('');
  const [currency, setCurrency] = useState('BDT (৳)');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStoreNameChange = (val) => {
    setStoreName(val);
    const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '');
    setSubdomain(slug ? `${slug}.tiwlo.com` : '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!storeName.trim()) {
      setErrorMsg('Store name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await onCreateStore({
        storeName: storeName.trim(),
        category,
        subdomain: subdomain.trim(),
        currency,
        email: businessEmail.trim(),
        phone: phone.trim(),
        description: description.trim()
      });
      showToast?.(`Store "${storeName}" created successfully!`);
      onBack?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create store. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-200 pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-gray-800 hover:bg-slate-50 dark:hover:bg-gray-800 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Online Stores</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Commerce</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-blue-600 dark:text-blue-400">Create New Store</span>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Create New Online Store
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Launch a full multi-channel eCommerce store with POS terminal, automated WhatsApp alerts, and inventory sync.
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs sm:text-sm flex items-center gap-2.5">
          <Info className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)] space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Store / Business Name *
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => handleStoreNameChange(e.target.value)}
              placeholder="e.g. Dhaka Gadget Hub"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Store Category / Industry
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            >
              {STORE_CATEGORIES.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Store Web Subdomain
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="storename.tiwlo.com"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Free SSL certificate and CDN proxy automatically provisioned.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Primary Currency
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="BDT (৳)">BDT - Bangladeshi Taka (৳)</option>
              <option value="USD ($)">USD - US Dollar ($)</option>
              <option value="EUR (€)">EUR - Euro (€)</option>
              <option value="GBP (£)">GBP - British Pound (£)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Business Email
            </label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="orders@yourstore.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Customer Support Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 1700-000000"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Store Description / Slogan
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell customers about your business..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/50 dark:bg-gray-900 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Launching Store...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Create & Launch Store</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
