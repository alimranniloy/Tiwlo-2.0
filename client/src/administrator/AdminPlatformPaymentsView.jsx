import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Save,
} from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || window.location.origin;

const INITIAL_GATEWAYS = {
  bkash: {
    id: 'bkash',
    name: 'bKash Regular Checkout (URL)',
    enabled: false,
    mode: 'sandbox',
    appKey: '',
    appSecret: '',
    username: '',
    password: '',
    currencies: ['BDT'],
  },
  nagad: {
    id: 'nagad',
    name: 'Nagad Direct Payment',
    enabled: false,
    mode: 'sandbox',
    merchantId: '',
    merchantPrivateKey: '',
    nagadPublicKey: '',
    currencies: ['BDT'],
  },
  sslcommerz: {
    id: 'sslcommerz',
    name: 'SSLCOMMERZ Hosted Gateway',
    enabled: false,
    mode: 'sandbox',
    storeId: '',
    storePassword: '',
    currencies: ['BDT', 'USD'],
  },
  paypal: {
    id: 'paypal',
    name: 'PayPal Global Gateway',
    enabled: false,
    mode: 'sandbox',
    clientId: '',
    clientSecret: '',
    currencies: ['USD', 'EUR', 'GBP'],
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe Payments',
    enabled: false,
    mode: 'test',
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    currencies: ['USD', 'EUR', 'GBP'],
  },
};

const GATEWAY_LIST = [
  { id: 'bkash', name: 'bKash', badge: 'Regular Checkout (URL)', color: '#E2136E' },
  { id: 'nagad', name: 'Nagad', badge: 'Direct Checkout', color: '#F7941D' },
  { id: 'sslcommerz', name: 'SSLCOMMERZ', badge: 'Multi-card Hosted', color: '#1F2937' },
  { id: 'paypal', name: 'PayPal', badge: 'Global Wallet', color: '#003087' },
  { id: 'stripe', name: 'Stripe', badge: 'Credit / Debit Cards', color: '#635BFF' },
];

export default function AdminPlatformPaymentsView({ onBackToDashboard, showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('bkash');
  const [showSecrets, setShowSecrets] = useState({});
  const [gateways, setGateways] = useState(INITIAL_GATEWAYS);
  const [reloadTick, setReloadTick] = useState(0);

  const loadGatewaysData = useCallback(async () => {
    const token = localStorage.getItem('stockpro_session');
    const res = await fetch(`${API_BASE}/admin/payment-gateways`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (res.ok && data.success && data.gateways) {
      return data.gateways;
    }
    throw new Error(data.error || 'Failed to load payment gateway settings');
  }, []);

  useEffect(() => {
    let active = true;
    loadGatewaysData()
      .then((serverGateways) => {
        if (active) {
          setGateways((prev) => ({ ...prev, ...serverGateways }));
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Error fetching admin gateways:', err);
          showToast?.(err.message || 'Failed to load payment gateway settings', 'error');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadGatewaysData, reloadTick, showToast]);

  const handleRefresh = () => {
    setLoading(true);
    setReloadTick((t) => t + 1);
  };

  const handleFieldChange = (gatewayId, field, value) => {
    setGateways((prev) => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        [field]: value,
      },
    }));
  };

  const toggleShowSecret = (fieldKey) => {
    setShowSecrets((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('stockpro_session');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/payment-gateways`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ gateways }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }
      showToast?.('Platform payment gateways saved successfully!', 'success');
      handleRefresh();
    } catch (err) {
      console.error('Error saving payment gateways:', err);
      showToast?.(err.message || 'Error saving payment gateways', 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentGw = gateways[activeTab] || {};
  const enabledCount = Object.values(gateways).filter((g) => g.enabled).length;

  const inputCls =
    'w-full rounded-xl border border-neutral-200/80 bg-neutral-50 px-3.5 py-2.5 text-xs font-mono text-neutral-900 outline-none transition focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white';

  return (
    <div className="space-y-5 font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            <CreditCard className="h-5 w-5 text-neutral-700 dark:text-neutral-300" />
            <span>Platform Payment Gateways</span>
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Configure centralized payment credentials for Tiwlo Cloud Billing and user credit top-ups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${
          enabledCount > 0
            ? 'border-[#1ED760]/40 bg-[#1ED760]/10 text-emerald-900 dark:text-[#1ED760]'
            : 'border-neutral-200/80 bg-neutral-50/70 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              enabledCount > 0
                ? 'bg-[#1ED760]/20 text-emerald-700 dark:text-[#1ED760]'
                : 'bg-neutral-200/70 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            {enabledCount > 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <div className="text-xs">
            <span className="font-semibold">
              {enabledCount > 0
                ? `${enabledCount} Payment Gateway(s) Active & Verified`
                : 'No verified payment gateway configured'}
            </span>
            <span className="mx-2 opacity-50">•</span>
            <span className="opacity-85">
              {enabledCount > 0
                ? 'Tiwlo users can top up Tiwlo Cloud Credits using these active gateway channels.'
                : 'Until an active gateway is saved with verified credentials, Cloud credit purchases remain paused.'}
            </span>
          </div>
        </div>
      </div>

      {/* Gateway Tabs + Configuration Form */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Left Gateway Selector */}
        <div className="space-y-2 lg:col-span-4">
          {GATEWAY_LIST.map((gw) => {
            const isSelected = activeTab === gw.id;
            const isEnabled = gateways[gw.id]?.enabled;
            const mode = gateways[gw.id]?.mode;
            return (
              <button
                key={gw.id}
                type="button"
                onClick={() => setActiveTab(gw.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition ${
                  isSelected
                    ? 'border-[#1ED760] bg-white shadow-xs dark:bg-neutral-950'
                    : 'border-neutral-200/80 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:bg-neutral-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: gw.color }}
                  >
                    {gw.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                      {gw.name}
                      {isEnabled && <span className="h-2 w-2 rounded-full bg-[#1ED760]" />}
                    </div>
                    <div className="text-[11px] text-neutral-500">{gw.badge}</div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      isEnabled
                        ? 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                        : 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    {isEnabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-neutral-400">{mode}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Form Card */}
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:p-6 lg:col-span-8">
          <div className="flex flex-col justify-between gap-4 border-b border-neutral-200/80 pb-5 dark:border-neutral-800 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                {currentGw.name || activeTab.toUpperCase()}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Supported currencies: {currentGw.currencies?.join(', ') || 'USD'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Mode Switcher */}
              <div className="inline-flex rounded-xl border border-neutral-200/80 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  onClick={() =>
                    handleFieldChange(activeTab, 'mode', activeTab === 'stripe' ? 'test' : 'sandbox')
                  }
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    currentGw.mode !== 'live'
                      ? 'bg-white font-semibold text-neutral-950 shadow-2xs dark:bg-neutral-800 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  {activeTab === 'stripe' ? 'Test Mode' : 'Sandbox'}
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange(activeTab, 'mode', 'live')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    currentGw.mode === 'live'
                      ? 'bg-[#1ED760] font-semibold text-black'
                      : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400'
                  }`}
                >
                  Live Production
                </button>
              </div>

              {/* Switch */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(currentGw.enabled)}
                  onClick={() => handleFieldChange(activeTab, 'enabled', !currentGw.enabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    currentGw.enabled ? 'bg-[#1ED760]' : 'bg-neutral-200 dark:bg-neutral-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
                      currentGw.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                  {currentGw.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4 text-xs">
            {activeTab === 'bkash' && (
              <>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    bKash App Key
                  </label>
                  <input
                    type="text"
                    value={currentGw.appKey || ''}
                    onChange={(e) => handleFieldChange('bkash', 'appKey', e.target.value)}
                    placeholder="e.g. 4fxxxxxxxxxxxxxxxx"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    bKash App Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.bkashSecret ? 'text' : 'password'}
                      value={currentGw.appSecret || ''}
                      onChange={(e) => handleFieldChange('bkash', 'appSecret', e.target.value)}
                      placeholder="Enter bKash App Secret"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('bkashSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {showSecrets.bkashSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                      Username
                    </label>
                    <input
                      type="text"
                      value={currentGw.username || ''}
                      onChange={(e) => handleFieldChange('bkash', 'username', e.target.value)}
                      placeholder="Merchant username"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.bkashPassword ? 'text' : 'password'}
                        value={currentGw.password || ''}
                        onChange={(e) => handleFieldChange('bkash', 'password', e.target.value)}
                        placeholder="Merchant password"
                        className={`${inputCls} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowSecret('bkashPassword')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                      >
                        {showSecrets.bkashPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'nagad' && (
              <>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Nagad Merchant ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.merchantId || ''}
                    onChange={(e) => handleFieldChange('nagad', 'merchantId', e.target.value)}
                    placeholder="e.g. 68xxxxxxxx"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Merchant Private Key
                  </label>
                  <textarea
                    rows={3}
                    value={currentGw.merchantPrivateKey || ''}
                    onChange={(e) => handleFieldChange('nagad', 'merchantPrivateKey', e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Nagad Public Key
                  </label>
                  <textarea
                    rows={3}
                    value={currentGw.nagadPublicKey || ''}
                    onChange={(e) => handleFieldChange('nagad', 'nagadPublicKey', e.target.value)}
                    placeholder="-----BEGIN PUBLIC KEY-----"
                    className={inputCls}
                  />
                </div>
              </>
            )}

            {activeTab === 'sslcommerz' && (
              <>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    SSLCOMMERZ Store ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.storeId || ''}
                    onChange={(e) => handleFieldChange('sslcommerz', 'storeId', e.target.value)}
                    placeholder="e.g. tiwlolive001"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Store Password
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.sslPass ? 'text' : 'password'}
                      value={currentGw.storePassword || ''}
                      onChange={(e) => handleFieldChange('sslcommerz', 'storePassword', e.target.value)}
                      placeholder="Store password / API key"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('sslPass')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {showSecrets.sslPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'paypal' && (
              <>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    PayPal Client ID
                  </label>
                  <input
                    type="text"
                    value={currentGw.clientId || ''}
                    onChange={(e) => handleFieldChange('paypal', 'clientId', e.target.value)}
                    placeholder="e.g. Axxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    PayPal Client Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.paypalSecret ? 'text' : 'password'}
                      value={currentGw.clientSecret || ''}
                      onChange={(e) => handleFieldChange('paypal', 'clientSecret', e.target.value)}
                      placeholder="Client Secret"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('paypalSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {showSecrets.paypalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'stripe' && (
              <>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Stripe Publishable Key
                  </label>
                  <input
                    type="text"
                    value={currentGw.publishableKey || ''}
                    onChange={(e) => handleFieldChange('stripe', 'publishableKey', e.target.value)}
                    placeholder="pk_live_... or pk_test_..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Stripe Secret Key
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.stripeSecret ? 'text' : 'password'}
                      value={currentGw.secretKey || ''}
                      onChange={(e) => handleFieldChange('stripe', 'secretKey', e.target.value)}
                      placeholder="sk_live_... or sk_test_..."
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('stripeSecret')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {showSecrets.stripeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-neutral-700 dark:text-neutral-300">
                    Stripe Webhook Signing Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showSecrets.stripeWebhook ? 'text' : 'password'}
                      value={currentGw.webhookSecret || ''}
                      onChange={(e) => handleFieldChange('stripe', 'webhookSecret', e.target.value)}
                      placeholder="whsec_..."
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('stripeWebhook')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {showSecrets.stripeWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    Stripe credit top-up webhook endpoint:{' '}
                    <span className="font-mono break-all">
                      {window.location.origin}/api/cloud/billing/credits/stripe/webhook
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-neutral-200/80 pt-5 dark:border-neutral-800 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Credentials persist encrypted directly in PostgreSQL system_settings.</span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
