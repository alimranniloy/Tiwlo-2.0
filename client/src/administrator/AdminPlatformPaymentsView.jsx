import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowLeft, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Globe, 
  Lock,
  RefreshCw
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminPlatformPaymentsView({ onBackToDashboard, showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('bkash');
  const [showSecrets, setShowSecrets] = useState({});

  const [gateways, setGateways] = useState({
    bkash: {
      id: 'bkash',
      name: 'bKash Merchant Checkout',
      enabled: false,
      mode: 'sandbox',
      appKey: '',
      appSecret: '',
      username: '',
      password: '',
      currencies: ['BDT']
    },
    nagad: {
      id: 'nagad',
      name: 'Nagad Direct Payment',
      enabled: false,
      mode: 'sandbox',
      merchantId: '',
      merchantPrivateKey: '',
      nagadPublicKey: '',
      currencies: ['BDT']
    },
    sslcommerz: {
      id: 'sslcommerz',
      name: 'SSLCOMMERZ Hosted Gateway',
      enabled: false,
      mode: 'sandbox',
      storeId: '',
      storePassword: '',
      currencies: ['BDT', 'USD']
    },
    paypal: {
      id: 'paypal',
      name: 'PayPal Global Gateway',
      enabled: false,
      mode: 'sandbox',
      clientId: '',
      clientSecret: '',
      currencies: ['USD', 'EUR', 'GBP']
    },
    stripe: {
      id: 'stripe',
      name: 'Stripe Payments',
      enabled: false,
      mode: 'test',
      publishableKey: '',
      secretKey: '',
      webhookSecret: '',
      currencies: ['USD', 'EUR', 'GBP']
    }
  });

  const fetchGateways = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/payment-gateways`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success && data.gateways) {
        setGateways(prev => ({ ...prev, ...data.gateways }));
      }
    } catch (err) {
      console.error('Error fetching admin gateways:', err);
      showToast?.('Failed to load payment gateway settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  const handleFieldChange = (gatewayId, field, value) => {
    setGateways(prev => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        [field]: value
      }
    }));
  };

  const toggleShowSecret = (fieldKey) => {
    setShowSecrets(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/payment-gateways`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ gateways })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }
      showToast?.('Platform payment gateways saved successfully!', 'success');
      await fetchGateways();
    } catch (err) {
      console.error('Error saving payment gateways:', err);
      showToast?.(err.message || 'Error saving payment gateways', 'error');
    } finally {
      setSaving(false);
    }
  };

  const gatewayList = [
    { id: 'bkash', name: 'bKash', badge: 'Merchant Tokenized', color: '#E2136E' },
    { id: 'nagad', name: 'Nagad', badge: 'Direct Checkout', color: '#F7941D' },
    { id: 'sslcommerz', name: 'SSLCOMMERZ', badge: 'Multi-card Hosted', color: '#006699' },
    { id: 'paypal', name: 'PayPal', badge: 'Global Wallet', color: '#003087' },
    { id: 'stripe', name: 'Stripe', badge: 'Credit / Debit Cards', color: '#635BFF' }
  ];

  const currentGw = gateways[activeTab] || {};
  const enabledCount = Object.values(gateways).filter(g => g.enabled).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              Platform Payment Gateways
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure credentials for Tiwlo Cloud Billing and credit top-ups.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchGateways}
            disabled={loading || saving}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
        enabledCount > 0
          ? 'bg-emerald-50/70 border-emerald-200/70 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300'
          : 'bg-amber-50/70 border-amber-200/70 text-amber-900 dark:bg-amber-950/20 dark:border-amber-800/40 dark:text-amber-300'
      }`}>
        <div className="flex items-center gap-3">
          {enabledCount > 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              {enabledCount > 0
                ? `${enabledCount} Payment Gateway(s) Active`
                : 'No verified payment gateway configured'}
            </span>
            <span className="mx-2 text-slate-400">•</span>
            <span className="font-normal opacity-90">
              {enabledCount > 0
                ? 'Users can purchase cloud credits using these active channels.'
                : 'Until an active gateway is configured with credentials, user cloud credit purchases remain disabled.'}
            </span>
          </div>
        </div>
      </div>

      {/* Gateway Tabs + Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Tab List */}
        <div className="lg:col-span-4 space-y-2">
          {gatewayList.map((gw) => {
            const isSelected = activeTab === gw.id;
            const isEnabled = gateways[gw.id]?.enabled;
            const mode = gateways[gw.id]?.mode;
            return (
              <button
                key={gw.id}
                onClick={() => setActiveTab(gw.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-md ring-1 ring-blue-500/20'
                    : 'bg-white/70 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-xs"
                    style={{ backgroundColor: gw.color }}
                  >
                    {gw.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {gw.name}
                      {isEnabled && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {gw.badge}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isEnabled
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {isEnabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {mode}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Configuration Form */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentGw.name || activeTab.toUpperCase()}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Supported currencies: {currentGw.currencies?.join(', ') || 'USD'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Mode Select */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>Mode:</span>
                <select
                  value={currentGw.mode || 'sandbox'}
                  onChange={(e) => handleFieldChange(activeTab, 'mode', e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium cursor-pointer outline-none focus:border-blue-500"
                >
                  <option value={activeTab === 'stripe' ? 'test' : 'sandbox'}>
                    {activeTab === 'stripe' ? 'Test' : 'Sandbox'}
                  </option>
                  <option value="live">Live Production</option>
                </select>
              </div>

              {/* Status Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(currentGw.enabled)}
                  onChange={(e) => handleFieldChange(activeTab, 'enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentGw.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Form Fields by Gateway */}
          <div className="mt-6 space-y-5">
            {activeTab === 'bkash' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    bKash App Key
                  </label>
                  <input
                    type="text"
                    value={currentGw.appKey || ''}
                    onChange={(e) => handleFieldChange('bkash', 'appKey', e.target.value)}
                    placeholder="e.g. 4fxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    bKash App Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.bkashSecret ? 'text' : 'password'}
                      value={currentGw.appSecret || ''}
                      onChange={(e) => handleFieldChange('bkash', 'appSecret', e.target.value)}
                      placeholder="Enter bKash App Secret"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('bkashSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecrets.bkashSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={currentGw.username || ''}
                      onChange={(e) => handleFieldChange('bkash', 'username', e.target.value)}
                      placeholder="Merchant username"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.bkashPassword ? 'text' : 'password'}
                        value={currentGw.password || ''}
                        onChange={(e) => handleFieldChange('bkash', 'password', e.target.value)}
                        placeholder="Merchant password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('bkashPassword')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showSecrets.bkashPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'nagad' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nagad Merchant ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.merchantId || ''}
                    onChange={(e) => handleFieldChange('nagad', 'merchantId', e.target.value)}
                    placeholder="e.g. 68xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Merchant Private Key
                  </label>
                  <textarea
                    rows={3}
                    value={currentGw.merchantPrivateKey || ''}
                    onChange={(e) => handleFieldChange('nagad', 'merchantPrivateKey', e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nagad Public Key
                  </label>
                  <textarea
                    rows={3}
                    value={currentGw.nagadPublicKey || ''}
                    onChange={(e) => handleFieldChange('nagad', 'nagadPublicKey', e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}

            {activeTab === 'sslcommerz' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    SSLCOMMERZ Store ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.storeId || ''}
                    onChange={(e) => handleFieldChange('sslcommerz', 'storeId', e.target.value)}
                    placeholder="e.g. tiwlolive001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Store Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.sslPass ? 'text' : 'password'}
                      value={currentGw.storePassword || ''}
                      onChange={(e) => handleFieldChange('sslcommerz', 'storePassword', e.target.value)}
                      placeholder="Store password / API key"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('sslPass')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecrets.sslPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'paypal' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    PayPal Client ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.clientId || ''}
                    onChange={(e) => handleFieldChange('paypal', 'clientId', e.target.value)}
                    placeholder="e.g. Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    PayPal Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.paypalSecret ? 'text' : 'password'}
                      value={currentGw.clientSecret || ''}
                      onChange={(e) => handleFieldChange('paypal', 'clientSecret', e.target.value)}
                      placeholder="Client Secret"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('paypalSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecrets.paypalSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'stripe' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Stripe Publishable Key
                  </label>
                  <input
                    type="text"
                    value={currentGw.publishableKey || ''}
                    onChange={(e) => handleFieldChange('stripe', 'publishableKey', e.target.value)}
                    placeholder="pk_live_... or pk_test_..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Stripe Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.stripeSecret ? 'text' : 'password'}
                      value={currentGw.secretKey || ''}
                      onChange={(e) => handleFieldChange('stripe', 'secretKey', e.target.value)}
                      placeholder="sk_live_... or sk_test_..."
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('stripeSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecrets.stripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Stripe Webhook Signing Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.stripeWebhook ? 'text' : 'password'}
                      value={currentGw.webhookSecret || ''}
                      onChange={(e) => handleFieldChange('stripe', 'webhookSecret', e.target.value)}
                      placeholder="whsec_..."
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('stripeWebhook')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecrets.stripeWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Security & Action Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Credentials are encrypted and saved directly to PostgreSQL system_settings.</span>
            </div>

            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
