import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  ArrowLeft, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
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
    <div className="space-y-6 font-sans antialiased text-[#1F1F1F] dark:text-[#E3E3E3] animate-in fade-in duration-150">
      
      {/* Top Header Card — Pure White Material */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#1E1F22] border border-[#EDF0F5] dark:border-[#2C2D31]">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-[#5F6368] dark:text-[#9AA0A6]">
              <span>Admin Console</span>
              <span className="text-[#C4C7C5] dark:text-[#444746]">/</span>
              <span className="text-[#0B57D0] dark:text-[#8AB4F8]">Platform Billing</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1F1F1F] dark:text-white mt-0.5 flex items-center gap-2.5">
              <CreditCard className="w-6 h-6 text-[#0B57D0] dark:text-[#8AB4F8]" />
              <span>Platform Payment Gateways</span>
            </h1>
            <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
              Configure centralized payment credentials for Tiwlo Cloud Billing and user credit checkouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <button
            type="button"
            onClick={fetchGateways}
            disabled={loading || saving}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-[#F0F4F9] hover:bg-[#E9EEF6] dark:bg-[#2C2D31] text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
            title="Reload from database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
        enabledCount > 0
          ? 'bg-[#E6F4EA] border-[#CEEAD6] text-[#137333] dark:bg-[#137333]/20 dark:border-[#137333]/40 dark:text-[#81C995]'
          : 'bg-[#FEF7E0] border-[#FEEFC3] text-[#B06000] dark:bg-[#B06000]/20 dark:border-[#B06000]/40 dark:text-[#FDD663]'
      }`}>
        <div className="flex items-center gap-3.5">
          {enabledCount > 0 ? (
            <div className="w-8 h-8 rounded-full bg-[#CEEAD6] dark:bg-[#137333]/40 flex items-center justify-center text-[#188038] shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#FEEFC3] dark:bg-[#B06000]/40 flex items-center justify-center text-[#B06000] shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          <div className="text-xs sm:text-sm">
            <span className="font-semibold">
              {enabledCount > 0
                ? `${enabledCount} Payment Gateway(s) Active & Verified`
                : 'No verified payment gateway configured'}
            </span>
            <span className="mx-2 text-[#74777F] opacity-60">•</span>
            <span className="font-normal opacity-90 text-xs">
              {enabledCount > 0
                ? 'Users can top up Tiwlo Cloud Credits using these active gateway channels.'
                : 'Until an active gateway is saved with verified credentials, Cloud credit purchases remain blocked across the platform.'}
            </span>
          </div>
        </div>
      </div>

      {/* Gateway Tabs + Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Tab List — PURE WHITE */}
        <div className="lg:col-span-4 space-y-2">
          {gatewayList.map((gw) => {
            const isSelected = activeTab === gw.id;
            const isEnabled = gateways[gw.id]?.enabled;
            const mode = gateways[gw.id]?.mode;
            return (
              <button
                key={gw.id}
                type="button"
                onClick={() => setActiveTab(gw.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-white dark:bg-[#1E1F22] border-[#0B57D0] shadow-xs'
                    : 'bg-white dark:bg-[#1E1F22] border-[#EDF0F5] dark:border-[#2C2D31] hover:bg-[#F8FAFD] dark:hover:bg-[#2C2D31]/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: gw.color }}
                  >
                    {gw.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1F1F1F] dark:text-white flex items-center gap-2">
                      {gw.name}
                      {isEnabled && (
                        <span className="w-2 h-2 rounded-full bg-[#188038]" />
                      )}
                    </div>
                    <div className="text-[11px] text-[#5F6368] dark:text-[#9AA0A6]">
                      {gw.badge}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isEnabled
                      ? 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]'
                      : 'bg-[#F0F4F9] text-[#5F6368] dark:bg-[#2C2D31] dark:text-[#9AA0A6]'
                  }`}>
                    {isEnabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-[10px] text-[#5F6368] dark:text-[#9AA0A6] font-mono uppercase">
                    {mode}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Configuration Form — PURE WHITE */}
        <div className="lg:col-span-8 bg-white dark:bg-[#1E1F22] rounded-2xl p-6 sm:p-8 border border-[#EDF0F5] dark:border-[#2C2D31]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#F0F2F5] dark:border-[#2C2D31]">
            <div>
              <h2 className="text-lg font-semibold text-[#1F1F1F] dark:text-white tracking-tight">
                {currentGw.name || activeTab.toUpperCase()}
              </h2>
              <p className="text-xs text-[#5F6368] dark:text-[#9AA0A6] mt-0.5">
                Supported currencies: {currentGw.currencies?.join(', ') || 'USD'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Mode Switcher */}
              <div className="inline-flex p-1 bg-[#F0F4F9] dark:bg-[#2C2D31] rounded-full border border-[#E0E2EC] dark:border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => handleFieldChange(activeTab, 'mode', activeTab === 'stripe' ? 'test' : 'sandbox')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    currentGw.mode !== 'live'
                      ? 'bg-white dark:bg-[#1E1F22] text-[#0B57D0] dark:text-[#8AB4F8] shadow-2xs font-semibold'
                      : 'text-[#5F6368] hover:text-[#1F1F1F]'
                  }`}
                >
                  {activeTab === 'stripe' ? 'Test Mode' : 'Sandbox'}
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange(activeTab, 'mode', 'live')}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                    currentGw.mode === 'live'
                      ? 'bg-white dark:bg-[#1E1F22] text-[#0B57D0] dark:text-[#8AB4F8] shadow-2xs font-semibold'
                      : 'text-[#5F6368] hover:text-[#1F1F1F]'
                  }`}
                >
                  Live Production
                </button>
              </div>

              {/* iOS Toggle Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(currentGw.enabled)}
                  onClick={() => handleFieldChange(activeTab, 'enabled', !currentGw.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    currentGw.enabled ? 'bg-[#188038]' : 'bg-[#E0E2EC] dark:bg-[#3C4043]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                      currentGw.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-[#1F1F1F] dark:text-white">
                  {currentGw.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields by Gateway */}
          <div className="mt-6 space-y-4 text-xs">
            {activeTab === 'bkash' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    bKash App Key
                  </label>
                  <input
                    type="text"
                    value={currentGw.appKey || ''}
                    onChange={(e) => handleFieldChange('bkash', 'appKey', e.target.value)}
                    placeholder="e.g. 4fxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    bKash App Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.bkashSecret ? 'text' : 'password'}
                      value={currentGw.appSecret || ''}
                      onChange={(e) => handleFieldChange('bkash', 'appSecret', e.target.value)}
                      placeholder="Enter bKash App Secret"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('bkashSecret')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#1F1F1F]"
                    >
                      {showSecrets.bkashSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={currentGw.username || ''}
                      onChange={(e) => handleFieldChange('bkash', 'username', e.target.value)}
                      placeholder="Merchant username"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.bkashPassword ? 'text' : 'password'}
                        value={currentGw.password || ''}
                        onChange={(e) => handleFieldChange('bkash', 'password', e.target.value)}
                        placeholder="Merchant password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('bkashPassword')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#1F1F1F]"
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
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Nagad Merchant ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.merchantId || ''}
                    onChange={(e) => handleFieldChange('nagad', 'merchantId', e.target.value)}
                    placeholder="e.g. 68xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Merchant Private Key
                  </label>
                  <textarea
                    rows={3}
                    value={currentGw.merchantPrivateKey || ''}
                    onChange={(e) => handleFieldChange('nagad', 'merchantPrivateKey', e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Nagad Public Key
                  </label>
                  <textarea
                    rows={3}
                    value={currentGw.nagadPublicKey || ''}
                    onChange={(e) => handleFieldChange('nagad', 'nagadPublicKey', e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----"
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>
              </>
            )}

            {activeTab === 'sslcommerz' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    SSLCOMMERZ Store ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.storeId || ''}
                    onChange={(e) => handleFieldChange('sslcommerz', 'storeId', e.target.value)}
                    placeholder="e.g. tiwlolive001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Store Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.sslPass ? 'text' : 'password'}
                      value={currentGw.storePassword || ''}
                      onChange={(e) => handleFieldChange('sslcommerz', 'storePassword', e.target.value)}
                      placeholder="Store password / API key"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('sslPass')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#1F1F1F]"
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
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    PayPal Client ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.clientId || ''}
                    onChange={(e) => handleFieldChange('paypal', 'clientId', e.target.value)}
                    placeholder="e.g. Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    PayPal Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.paypalSecret ? 'text' : 'password'}
                      value={currentGw.clientSecret || ''}
                      onChange={(e) => handleFieldChange('paypal', 'clientSecret', e.target.value)}
                      placeholder="Client Secret"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('paypalSecret')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#1F1F1F]"
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
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Stripe Publishable Key
                  </label>
                  <input
                    type="text"
                    value={currentGw.publishableKey || ''}
                    onChange={(e) => handleFieldChange('stripe', 'publishableKey', e.target.value)}
                    placeholder="pk_live_... or pk_test_..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Stripe Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.stripeSecret ? 'text' : 'password'}
                      value={currentGw.secretKey || ''}
                      onChange={(e) => handleFieldChange('stripe', 'secretKey', e.target.value)}
                      placeholder="sk_live_... or sk_test_..."
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('stripeSecret')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#1F1F1F]"
                    >
                      {showSecrets.stripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#5F6368] dark:text-[#9AA0A6] mb-1.5">
                    Stripe Webhook Signing Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.stripeWebhook ? 'text' : 'password'}
                      value={currentGw.webhookSecret || ''}
                      onChange={(e) => handleFieldChange('stripe', 'webhookSecret', e.target.value)}
                      placeholder="whsec_..."
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E0E2EC] dark:border-[#3C4043] bg-[#F8FAFD] dark:bg-[#2C2D31] text-xs font-mono text-[#1F1F1F] dark:text-white outline-none focus:border-[#0B57D0]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('stripeWebhook')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#5F6368] hover:text-[#1F1F1F]"
                    >
                      {showSecrets.stripeWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Security & Action Footer */}
          <div className="mt-8 pt-6 border-t border-[#F0F2F5] dark:border-[#2C2D31] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#5F6368] dark:text-[#9AA0A6]">
              <Lock className="w-3.5 h-3.5 text-[#0B57D0] shrink-0" />
              <span>Credentials persist encrypted directly in PostgreSQL system_settings.</span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
