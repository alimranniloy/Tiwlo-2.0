import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Coins,
  ExternalLink,
  Fingerprint,
  Gift,
  Layers,
  MapPin,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { useAdminCurrency } from './AdminCurrencyContext';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || window.location.origin;

const FILTER_TABS = [
  { id: 'all', label: 'All Tiwlo Users' },
  { id: 'free', label: 'Free Stores' },
  { id: 'paid', label: 'Paid Stores' },
  { id: 'grace_suspended', label: 'Grace / Suspended' },
];

const DEFAULT_PLAN_CATALOG = [
  { planId: 'free', planName: 'Free Starter', price: 0, productLimit: 10, staffLimit: 1, monthlyOrderLimit: 50, hasPos: false },
  { planId: 'growth', planName: 'Growth Retailer', price: 19, productLimit: 150, staffLimit: 3, monthlyOrderLimit: 1000, hasPos: true },
  { planId: 'pro', planName: 'Pro Business', price: 49, productLimit: 1000, staffLimit: 10, monthlyOrderLimit: 5000, hasPos: true },
  { planId: 'enterprise', planName: 'Enterprise VIP', price: 129, productLimit: 10000, staffLimit: 50, monthlyOrderLimit: 50000, hasPos: true },
];

const CURRENCY_OPTIONS = ['USD', 'BDT', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED', 'INR'];

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getStoreTiwiId(store) {
  return store?.tiwiId || store?.storeId || store?.id || '';
}

function getStoreLifecycleInfo(store) {
  const raw = String(store?.lifecycleStatus || store?.subscriptionStatus || store?.status || 'active').toLowerCase();
  if (raw.includes('grace')) {
    return {
      key: 'grace',
      label: '3d Grace',
      pillClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }
  if (raw.includes('suspend') || raw.includes('pause') || raw.includes('disabled') || raw.includes('expired')) {
    return {
      key: 'suspended',
      label: raw.includes('180') ? '180d Suspended' : 'Suspended',
      pillClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    };
  }
  return {
    key: 'active',
    label: 'Active',
    pillClass: 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760] border-[#1ED760]/30',
  };
}

function getMerchantCashBalance(c) {
  return toNum(c?.cashBalance ?? c?.walletCashBalance ?? c?.cloudCredits ?? c?.balanceUsd ?? 0, 0);
}

function getMerchantPromoBalance(c) {
  return toNum(c?.promoCreditBalance ?? c?.freePromoCredit ?? c?.promoCredits ?? c?.giftCredits ?? 0, 0);
}

function isFreeStore(store, fallbackPlanId) {
  const plan = String(store?.planId || fallbackPlanId || 'free').toLowerCase();
  return plan === 'free';
}

function getPlanBadgeClass(planId) {
  const p = String(planId || 'free').toLowerCase();
  if (p === 'enterprise') return 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-transparent';
  if (p === 'pro') return 'bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760] border-[#1ED760]/30';
  if (p === 'growth') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25';
  return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
}

export default function AdminCustomersView({ onBackToDashboard, onNavigate, showToast, currentUser }) {
  const currencyCtx = useAdminCurrency();
  const [customers, setCustomers] = useState([]);
  const [planCatalog, setPlanCatalog] = useState(DEFAULT_PLAN_CATALOG);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [reloadTick, setReloadTick] = useState(0);

  // Modals & drawers
  const [selectedCustomerStores, setSelectedCustomerStores] = useState(null);
  const [banModalTarget, setBanModalTarget] = useState(null);
  const [banReason, setBanReason] = useState('');
  const [identityLockTarget, setIdentityLockTarget] = useState(null);
  const [creditModalTarget, setCreditModalTarget] = useState(null);
  const [creditForm, setCreditForm] = useState({
    creditType: 'cash',
    operation: 'add',
    amountUsd: '10',
    validityDays: '30',
    reason: '',
  });

  // Store Control Drawer
  const [storeControlContext, setStoreControlContext] = useState(null); // { customer, store }
  const [storeControlTab, setStoreControlTab] = useState('edit'); // 'edit' | 'plan' | 'migrate' | 'lifecycle'
  const [editStoreForm, setEditStoreForm] = useState({ storeName: '', subdomain: '', category: '', currency: 'USD' });
  const [planForm, setPlanForm] = useState({
    planId: 'free',
    extraProductSlots: 0,
    extraStaffSlots: 0,
    posAddon: false,
    chargeWallet: false,
  });
  const [migrateEmail, setMigrateEmail] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const formatMoney = useCallback((amountUsd, options) => {
    if (typeof currencyCtx?.formatMoney === 'function') {
      return currencyCtx.formatMoney(amountUsd, options);
    }
    const n = Number(amountUsd || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  }, [currencyCtx]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [custRes, pkgRes] = await Promise.all([
          globalThis.fetch(`${API_BASE}/admin/customers?q=${encodeURIComponent(search.trim())}`, {
            credentials: 'include',
            cache: 'no-store',
            headers,
          }),
          fetch(`${API_BASE}/admin/packages`, { credentials: 'include', headers }).catch(() => null),
        ]);

        const data = await custRes.json().catch(() => ({}));
        if (!custRes.ok || !data.success) {
          throw new Error(data.error || 'Failed to retrieve customers.');
        }
        if (!Array.isArray(data.customers)) {
          throw new Error('Customer response has an invalid data format.');
        }

        const pkgJson = pkgRes?.ok ? await pkgRes.json().catch(() => null) : null;
        if (!active) return;

        setCustomers(data.customers);
        if (Array.isArray(pkgJson?.packages) && pkgJson.packages.length > 0) {
          setPlanCatalog(pkgJson.packages);
        }
        setFetchError('');
      } catch (err) {
        if (!active) return;
        console.error('[Admin Customers] Fetch error:', err);
        setFetchError(err.message || 'Could not load customer records.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => {
      active = false;
    };
  }, [search, reloadTick]);

  const triggerReload = useCallback(() => {
    setLoading(true);
    setReloadTick((t) => t + 1);
  }, []);

  // Keep open stores modal synchronized with latest reloaded customer data without effect cascading
  const activeCustomerStores = useMemo(() => {
    if (!selectedCustomerStores) return null;
    return customers.find((c) => c.id === selectedCustomerStores.id) || selectedCustomerStores;
  }, [customers, selectedCustomerStores]);

  // Ban / Unban with reauth
  const handleToggleBan = async (customer, isBanning, reasonText = '') => {
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(customer.id)}/ban`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ isBanned: isBanning, reason: reasonText }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast?.(data.message || 'Status updated successfully', 'success');
        setBanModalTarget(null);
        setBanReason('');
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customer.id
              ? { ...c, isBanned: isBanning, status: isBanning ? 'Suspended' : 'Active' }
              : c
          )
        );
      } else {
        showToast?.(data.error || 'Failed to update user status', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Verification cancelled or network error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Require Identity Verification
  const handleRequireIdentityVerification = async (customer) => {
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/admin/users/${encodeURIComponent(customer.id)}/identity-verification/require`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not require identity verification.');
      }
      showToast?.(result.message || 'Identity verification is now required.', 'success');
      setCustomers((previous) =>
        previous.map((user) =>
          user.id === customer.id
            ? { ...user, identityVerificationRequired: true, status: 'Identity required' }
            : user
        )
      );
      setIdentityLockTarget(null);
    } catch (error) {
      showToast?.(error.message || 'Could not require identity verification.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Adjust Merchant Wallet / Promo Credits
  const handleSubmitCreditAdjust = async (e) => {
    e.preventDefault();
    if (!creditModalTarget) return;
    const numericAmount = Number(creditForm.amountUsd);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast?.('Enter a positive USD amount.', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const signedAmount = creditForm.operation === 'deduct' ? -Math.abs(numericAmount) : Math.abs(numericAmount);
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(creditModalTarget.id)}/credits`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          creditType: creditForm.creditType,
          operation: creditForm.operation,
          amountUsd: creditForm.operation === 'set' ? numericAmount : signedAmount,
          amount: creditForm.operation === 'set' ? numericAmount : signedAmount,
          reason: creditForm.reason.trim() || 'Admin credit adjustment',
          ...(creditForm.creditType === 'promo'
            ? { validityDays: Math.max(1, Number(creditForm.validityDays || 30)) }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to adjust user credits.');
      }
      showToast?.(json.message || 'User credit balance updated.', 'success');
      setCreditModalTarget(null);
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Credit adjustment failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Store Control Drawer
  const openStoreControl = (customer, store, initialTab = 'edit') => {
    setStoreControlContext({ customer, store });
    setStoreControlTab(initialTab);
    setEditStoreForm({
      storeName: store?.name || store?.storeName || '',
      subdomain: store?.subdomain || '',
      category: store?.category || '',
      currency: store?.currency || 'USD',
    });
    setPlanForm({
      planId: String(store?.planId || customer?.planId || 'free').toLowerCase(),
      extraProductSlots: toNum(store?.extraProductSlots ?? 0, 0),
      extraStaffSlots: toNum(store?.extraStaffSlots ?? 0, 0),
      posAddon: Boolean(store?.posAddon ?? store?.hasPosAddon ?? false),
      chargeWallet: false,
    });
    setMigrateEmail('');
    setStatusReason('');
    setDeleteConfirmName('');
  };

  // Edit Store (PATCH /api/admin/stores/:tiwiId)
  const handleSaveStoreDetails = async (e) => {
    e.preventDefault();
    if (!storeControlContext) return;
    const tiwiId = getStoreTiwiId(storeControlContext.store);
    if (!tiwiId) {
      showToast?.('Store identifier is missing.', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/stores/${encodeURIComponent(tiwiId)}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          storeName: editStoreForm.storeName.trim(),
          name: editStoreForm.storeName.trim(),
          subdomain: editStoreForm.subdomain.trim(),
          category: editStoreForm.category.trim(),
          currency: editStoreForm.currency,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to update store details.');
      }
      showToast?.(json.message || 'Store details updated.', 'success');
      setStoreControlContext(null);
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Store update failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle per-user Two-Factor / OTP requirement
  const handleToggleOtp = async (customer) => {
    if (!customer?.id) return;
    try {
      setActionLoading(true);
      const nextOtpDisabled = !customer.otpDisabled;
      const res = await globalThis.fetch(`${API_BASE}/admin/users/${encodeURIComponent(customer.id)}/otp`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ otpDisabled: nextOtpDisabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to update Two-Factor setting.');
      }
      const persistedDisabled = json.otpDisabled !== undefined ? Boolean(json.otpDisabled) : nextOtpDisabled;
      setCustomers((prev) =>
        prev.map((item) =>
          item.id === customer.id ? { ...item, otpDisabled: persistedDisabled } : item
        )
      );
      showToast?.(
        json.message || (persistedDisabled ? 'Two-Factor disabled for user.' : 'Two-Factor enabled for user.'),
        'success'
      );
    } catch (err) {
      showToast?.(err.message || 'Failed to update Two-Factor setting.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Upgrade / Change Plan & Add-ons (POST /api/admin/stores/:tiwiId/plan)
  const handleSaveStorePlan = async (e) => {
    e.preventDefault();
    if (!storeControlContext) return;
    const tiwiId = getStoreTiwiId(storeControlContext.store);
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/stores/${encodeURIComponent(tiwiId)}/plan`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          planId: planForm.planId,
          extraProductSlots: Math.max(0, Number(planForm.extraProductSlots || 0)),
          extraStaffSlots: Math.max(0, Number(planForm.extraStaffSlots || 0)),
          posAddon: Boolean(planForm.posAddon),
          chargeWallet: Boolean(planForm.chargeWallet),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to update store plan.');
      }
      showToast?.(json.message || 'Store plan and add-ons updated.', 'success');
      setStoreControlContext(null);
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Plan update failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Migrate Owner (POST /api/admin/stores/:tiwiId/migrate-owner)
  const handleMigrateOwner = async (e) => {
    e.preventDefault();
    if (!storeControlContext) return;
    const tiwiId = getStoreTiwiId(storeControlContext.store);
    if (!migrateEmail.trim() || !migrateEmail.includes('@')) {
      showToast?.('Enter a valid target user email.', 'error');
      return;
    }
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/stores/${encodeURIComponent(tiwiId)}/migrate-owner`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          newOwnerEmail: migrateEmail.trim().toLowerCase(),
          email: migrateEmail.trim().toLowerCase(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to migrate store owner.');
      }
      showToast?.(json.message || 'Store ownership migrated.', 'success');
      setStoreControlContext(null);
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Owner migration failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend / Reactivate Store (POST /api/admin/stores/:tiwiId/status)
  const handleToggleStoreStatus = async (nextStatus) => {
    if (!storeControlContext) return;
    const tiwiId = getStoreTiwiId(storeControlContext.store);
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/stores/${encodeURIComponent(tiwiId)}/status`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          status: nextStatus,
          reason: statusReason.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to update store status.');
      }
      showToast?.(
        json.message || (nextStatus === 'active' ? 'Store reactivated.' : 'Store suspended.'),
        'success'
      );
      setStoreControlContext(null);
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Store status update failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Store Permanently (DELETE /api/admin/stores/:tiwiId)
  const handleDeleteStorePermanently = async () => {
    if (!storeControlContext) return;
    const targetName = String(storeControlContext.store?.name || storeControlContext.store?.storeName || '').trim();
    const tiwiId = getStoreTiwiId(storeControlContext.store);
    if (targetName && deleteConfirmName.trim() !== targetName) {
      showToast?.(`Type "${targetName}" to confirm permanent deletion.`, 'error');
      return;
    }
    try {
      setActionLoading(true);
      const headers = getAuthHeaders();
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const res = await fetch(`${API_BASE}/admin/stores/${encodeURIComponent(tiwiId)}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to delete store.');
      }
      showToast?.(json.message || 'Store permanently deleted. Tiwlo account preserved.', 'success');
      setStoreControlContext(null);
      setSelectedCustomerStores(null);
      triggerReload();
    } catch (err) {
      showToast?.(err.message || 'Store deletion failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Summary metrics & filters
  const stats = useMemo(() => {
    let totalStores = 0;
    let paidStores = 0;
    let freeStores = 0;
    let graceOrSuspended = 0;
    let totalCashUsd = 0;
    let totalPromoUsd = 0;

    for (const c of customers) {
      totalCashUsd += getMerchantCashBalance(c);
      totalPromoUsd += getMerchantPromoBalance(c);
      const stores = Array.isArray(c.stores) && c.stores.length > 0
        ? c.stores
        : c.primaryStoreName && c.primaryStoreName !== '—'
          ? [{ planId: c.planId, status: c.isBanned ? 'suspended' : 'active' }]
          : [];
      totalStores += c.storeCount || stores.length;
      for (const s of stores) {
        if (isFreeStore(s, c.planId)) freeStores += 1;
        else paidStores += 1;
        const life = getStoreLifecycleInfo(s);
        if (c.isBanned || life.key !== 'active') {
          graceOrSuspended += 1;
        }
      }
    }

    return {
      totalMerchants: customers.length,
      totalStores,
      paidStores,
      freeStores,
      graceOrSuspended,
      totalCashUsd,
      totalPromoUsd,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (activeTab === 'all') return true;
      const stores = Array.isArray(c.stores) ? c.stores : [];
      if (activeTab === 'free') {
        if (stores.length === 0) return String(c.planId || 'free').toLowerCase() === 'free';
        return stores.some((s) => isFreeStore(s, c.planId));
      }
      if (activeTab === 'paid') {
        if (stores.length === 0) return String(c.planId || 'free').toLowerCase() !== 'free';
        return stores.some((s) => !isFreeStore(s, c.planId));
      }
      if (activeTab === 'grace_suspended') {
        if (c.isBanned) return true;
        return stores.some((s) => getStoreLifecycleInfo(s).key !== 'active');
      }
      return true;
    });
  }, [customers, activeTab]);

  // Live preview for Plan & Add-on editor
  const selectedPlanMeta = useMemo(() => {
    return (
      planCatalog.find((p) => String(p.planId).toLowerCase() === String(planForm.planId).toLowerCase()) ||
      DEFAULT_PLAN_CATALOG[0]
    );
  }, [planCatalog, planForm.planId]);

  const estimatedPlanPreview = useMemo(() => {
    const basePrice = toNum(selectedPlanMeta?.price, 0);
    const productAddonCost = Math.floor(toNum(planForm.extraProductSlots, 0) / 25) * 5;
    const staffAddonCost = Math.floor(toNum(planForm.extraStaffSlots, 0) / 3) * 6;
    const posCost = planForm.posAddon && !selectedPlanMeta?.hasPos ? 9 : 0;
    const totalEstimatedUsd = basePrice + productAddonCost + staffAddonCost + posCost;
    return {
      basePrice,
      totalEstimatedUsd,
      resultingProducts: toNum(selectedPlanMeta?.productLimit, 10) + toNum(planForm.extraProductSlots, 0),
      resultingStaff: toNum(selectedPlanMeta?.staffLimit, 1) + toNum(planForm.extraStaffSlots, 0),
      resultingPos: Boolean(selectedPlanMeta?.hasPos || planForm.posAddon),
    };
  }, [selectedPlanMeta, planForm]);

  return (
    <div className="space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              Tiwlo Users, Wallets &amp; Store Control
            </h2>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              {customers.length} Tiwlo Users
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            Manage user wallets, identity locks, plans, add-ons, store migrations, and lifecycle controls.
          </p>
        </div>

        <button
          type="button"
          onClick={triggerReload}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded-xl border border-neutral-200/80 bg-white px-3.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sync
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-[11px] font-medium text-neutral-500">Total Tiwlo Users</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {stats.totalMerchants}
          </p>
          <span className="text-[10px] text-neutral-400 tabular-nums">{stats.totalStores} total stores</span>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-[11px] font-medium text-neutral-500">Free / Paid Stores</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {stats.freeStores} <span className="text-sm font-normal text-neutral-400">/</span>{' '}
            <span className="text-emerald-600 dark:text-[#1ED760]">{stats.paidStores}</span>
          </p>
          <span className="text-[10px] text-neutral-400">Active tier split</span>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-[11px] font-medium text-neutral-500">Grace / Suspended</span>
          <p
            className={`mt-1 text-xl font-semibold tabular-nums ${
              stats.graceOrSuspended > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-950 dark:text-white'
            }`}
          >
            {stats.graceOrSuspended}
          </p>
          <span className="text-[10px] text-neutral-400">Requires attention</span>
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950">
          <span className="text-[11px] font-medium text-neutral-500">Total Cash Balances</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">
            {formatMoney(stats.totalCashUsd)}
          </p>
          <span className="text-[10px] text-neutral-400">Withdrawable / paid wallet</span>
        </div>

        <div className="col-span-2 rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-1">
          <span className="text-[11px] font-medium text-neutral-500">Free Promo Credits</span>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {formatMoney(stats.totalPromoUsd)}
          </p>
          <span className="text-[10px] text-neutral-400">Expiring gift credits</span>
        </div>
      </div>

      {/* Filter Tabs + Search + Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-3 border-b border-neutral-200/80 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      isActive
                        ? 'border-[#1ED760] bg-[#1ED760] font-semibold text-black'
                        : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Tiwlo user, store name, email, Tiwi ID..."
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-9 pr-3 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
                <th className="px-4 py-3">Tiwlo User / Identity</th>
                <th className="px-3 py-3">Wallet (Cash vs Free Promo)</th>
                <th className="px-3 py-3">Stores &amp; Lifecycle Usage</th>
                <th className="px-3 py-3 text-center">Account Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading Tiwlo users...
                  </td>
                </tr>
              ) : fetchError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-rose-500">
                    {fetchError}
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    No Tiwlo users found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const cashBalance = getMerchantCashBalance(c);
                  const promoBalance = getMerchantPromoBalance(c);
                  const stores = Array.isArray(c.stores) ? c.stores : [];
                  const canManageAccount =
                    c.role !== 'super_admin' &&
                    c.email !== 'tiwloltd@gmail.com' &&
                    (c.role !== 'admin' || currentUser?.role === 'super_admin');

                  return (
                    <tr
                      key={c.id}
                      onClick={(e) => {
                        if (e.target.closest('button, a, input, select')) return;
                        onNavigate?.(`user-profile/${encodeURIComponent(c.id)}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (e.target.closest('button, a, input, select')) return;
                          e.preventDefault();
                          onNavigate?.(`user-profile/${encodeURIComponent(c.id)}`);
                        }
                      }}
                      tabIndex={0}
                      title="Click to open full User Profile & Stored Fingerprint Page"
                      className="align-top transition-colors cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-neutral-900/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]/40"
                    >
                      {/* Merchant & Identity */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <img
                            src={c.avatar || '/default-avatar.svg'}
                            alt={c.name}
                            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-neutral-900 dark:text-white hover:text-emerald-700 dark:hover:text-[#1ED760]">
                              {c.name}
                            </p>
                            <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                              {c.email}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-neutral-400">
                              {c.tiwiId || '—'}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {c.biometric?.enrolled && (
                                <span
                                  title={
                                    c.biometric.deviceName
                                      ? `Fingerprint enrolled on ${c.biometric.deviceName}`
                                      : 'Fingerprint enrolled'
                                  }
                                  className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-[#1ED760]"
                                >
                                  <Fingerprint className="h-3 w-3" />
                                  Fingerprint
                                </span>
                              )}
                              {c.identityVerified ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-[#1ED760]">
                                  <BadgeCheck className="h-3 w-3" />
                                  Verified
                                </span>
                              ) : c.identityVerificationRequired ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                                  <ShieldAlert className="h-3 w-3" />
                                  ID Required
                                </span>
                              ) : (
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                                  Unverified
                                </span>
                              )}

                              {!c.isBanned && !c.identityVerified && !c.identityVerificationRequired && canManageAccount && (
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => setIdentityLockTarget(c)}
                                  className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                >
                                  Lock for ID check
                                </button>
                              )}

                              {(c.identityVerified || c.identityVerificationRequired) && canManageAccount && (
                                <button
                                  type="button"
                                  onClick={() => onNavigate?.(`identity-verification/${encodeURIComponent(c.id)}`)}
                                  className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                >
                                  {c.identityVerified ? 'View verified' : 'Review ID files'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Wallet */}
                      <td className="px-3 py-3.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-[#1ED760]" />
                            <span className="text-[11px] text-neutral-500">Cash:</span>
                            <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                              {formatMoney(cashBalance)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Gift className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-[11px] text-neutral-500">Promo:</span>
                            <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                              {formatMoney(promoBalance)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCreditModalTarget(c);
                              setCreditForm({
                                creditType: 'cash',
                                operation: 'add',
                                amountUsd: '10',
                                validityDays: '30',
                                reason: '',
                              });
                            }}
                            className="mt-1 inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-[#1ED760] hover:bg-[#1ED760]/10 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                          >
                            <Coins className="h-3 w-3" />
                            Adjust Credit
                          </button>
                        </div>
                      </td>

                      {/* Stores List */}
                      <td className="px-3 py-3.5">
                        {stores.length === 0 ? (
                          <span className="text-[11px] text-neutral-400">No stores created</span>
                        ) : (
                          <div className="space-y-2">
                            {stores.slice(0, 2).map((s, idx) => {
                              const life = getStoreLifecycleInfo(s);
                              const prodUsed = s.usage?.productsUsed ?? s.productCount ?? null;
                              const prodLimit = s.usage?.productLimit ?? s.productLimit ?? null;
                              const staffUsed = s.usage?.staffUsed ?? s.staffCount ?? null;
                              const staffLimit = s.usage?.staffLimit ?? s.staffLimit ?? null;
                              const ordersUsed = s.usage?.monthlyOrdersUsed ?? s.monthlyOrderCount ?? null;
                              const ordersLimit = s.usage?.monthlyOrderLimit ?? s.monthlyOrderLimit ?? null;
                              const latestOrderNo = s.latestOrderNumber || s.latestOrderNo || s.lastOrderNumber || null;

                              return (
                                <div
                                  key={getStoreTiwiId(s) || idx}
                                  className="rounded-lg border border-neutral-200/80 bg-neutral-50/70 p-2 dark:border-neutral-800 dark:bg-neutral-900/60"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Store className="h-3.5 w-3.5 text-neutral-500" />
                                      <span className="font-semibold text-neutral-900 dark:text-white">
                                        {s.name || s.storeName}
                                      </span>
                                      <span
                                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getPlanBadgeClass(
                                          s.planId
                                        )}`}
                                      >
                                        {s.planName || s.planId || 'free'}
                                      </span>
                                      <span
                                        className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${life.pillClass}`}
                                      >
                                        {life.label}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => openStoreControl(c, s, 'edit')}
                                      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-700 transition hover:border-[#1ED760] hover:bg-[#1ED760] hover:text-black dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                                    >
                                      <Settings2 className="h-3 w-3" />
                                      Control
                                    </button>
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                                    {s.subdomain && (
                                      <a
                                        href={`https://${s.subdomain}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-0.5 font-mono hover:text-neutral-900 hover:underline dark:hover:text-white"
                                      >
                                        {s.subdomain} <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    )}
                                    {latestOrderNo && (
                                      <span className="font-mono text-neutral-600 dark:text-neutral-300">
                                        Order: {latestOrderNo}
                                      </span>
                                    )}
                                    {(prodUsed != null || staffUsed != null || ordersUsed != null) && (
                                      <span className="tabular-nums">
                                        P: {prodUsed ?? '—'}/{prodLimit ?? '—'} · S: {staffUsed ?? '—'}/{staffLimit ?? '—'} · O: {ordersUsed ?? '—'}/{ordersLimit ?? '—'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {stores.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setSelectedCustomerStores(c)}
                                className="text-[11px] font-semibold text-emerald-700 hover:underline dark:text-[#1ED760]"
                              >
                                +{stores.length - 2} more stores — view all ({stores.length})
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                              c.isBanned
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'border-[#1ED760]/30 bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                            }`}
                          >
                            {c.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => onNavigate?.(`user-locations/${encodeURIComponent(c.id)}`)}
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-white"
                          >
                            <MapPin className="h-3 w-3" />
                            User location
                          </button>
                          <span className="text-[10px] tabular-nums text-neutral-400">
                            {c.lastLoginAt ? `Login: ${new Date(c.lastLoginAt).toLocaleDateString()}` : 'No login recorded'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onNavigate?.(`user-profile/${encodeURIComponent(c.id)}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#1ED760]/40 bg-[#1ED760]/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-[#1ED760]/20 dark:text-[#1ED760]"
                          >
                            <UserRound className="h-3 w-3" />
                            View Profile
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerStores(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                          >
                            <Store className="h-3 w-3" />
                            Stores ({c.storeCount || stores.length})
                          </button>

                          {c.role !== 'super_admin' && c.email !== 'tiwloltd@gmail.com' && (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!c.otpDisabled}
                              disabled={actionLoading}
                              onClick={() => handleToggleOtp(c)}
                              title={c.otpDisabled ? 'Two-Factor Off (Click to enable)' : 'Two-Factor On (Click to disable)'}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            >
                              <span>Two-Factor</span>
                              <span
                                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                                  !c.otpDisabled ? 'bg-[#1ED760]' : 'bg-neutral-300 dark:bg-neutral-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                                    !c.otpDisabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </span>
                            </button>
                          )}

                          {c.role !== 'super_admin' && c.email !== 'tiwloltd@gmail.com' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (c.isBanned) {
                                  handleToggleBan(c, false);
                                } else {
                                  setBanModalTarget(c);
                                  setBanReason('');
                                }
                              }}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                c.isBanned
                                  ? 'bg-[#1ED760] text-black hover:bg-[#19c354]'
                                  : 'border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/40'
                              }`}
                            >
                              {c.isBanned ? 'Unban' : 'Ban Account'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All Stores Modal */}
      {activeCustomerStores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-2xl space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeCustomerStores.avatar || '/default-avatar.svg'}
                  alt={activeCustomerStores.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    {activeCustomerStores.name}&apos;s Stores ({activeCustomerStores.storeCount})
                  </h3>
                  <p className="text-[11px] text-neutral-500">{activeCustomerStores.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerStores(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {(activeCustomerStores.stores || []).length > 0 ? (
                activeCustomerStores.stores.map((s, idx) => {
                  const life = getStoreLifecycleInfo(s);
                  const latestOrder = s.latestOrderNumber || s.latestOrderNo || s.lastOrderNumber;
                  return (
                    <div
                      key={getStoreTiwiId(s) || idx}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
                          <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                            {s.name || s.storeName}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${getPlanBadgeClass(s.planId)}`}>
                            {s.planName || s.planId || 'free'}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${life.pillClass}`}>
                            {life.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                          <span className="font-mono">{s.subdomain || 'No subdomain'}</span>
                          {getStoreTiwiId(s) && <span className="font-mono">ID: {getStoreTiwiId(s)}</span>}
                          {latestOrder && <span className="font-mono">Latest Order: {latestOrder}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {s.subdomain && (
                          <a
                            href={`https://${s.subdomain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                          >
                            Visit <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openStoreControl(activeCustomerStores, s, 'edit')}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#1ED760] px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-[#19c354]"
                        >
                          <Settings2 className="h-3 w-3" />
                          Manage Store
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="py-6 text-center text-xs text-neutral-500">No online stores found for this user.</p>
              )}
            </div>

            <div className="flex justify-end border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setSelectedCustomerStores(null)}
                className="rounded-xl border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Adjust Modal */}
      {creditModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <form
            onSubmit={handleSubmitCreditAdjust}
            className="w-full max-w-md space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Adjust User Credits
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {creditModalTarget.name} ({creditModalTarget.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreditModalTarget(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
              <div>
                <span className="text-[11px] text-neutral-500">Current Cash</span>
                <p className="font-semibold tabular-nums text-neutral-950 dark:text-white">
                  {formatMoney(getMerchantCashBalance(creditModalTarget))}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Current Free Promo</span>
                <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {formatMoney(getMerchantPromoBalance(creditModalTarget))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Credit Bucket
                </label>
                <select
                  value={creditForm.creditType}
                  onChange={(e) => setCreditForm((f) => ({ ...f, creditType: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="cash">Cash Balance (Paid Credit)</option>
                  <option value="promo">Free Promo Credit (Expiring)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Operation
                </label>
                <select
                  value={creditForm.operation}
                  onChange={(e) => setCreditForm((f) => ({ ...f, operation: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  <option value="add">Add (+)</option>
                  <option value="deduct">Deduct (-)</option>
                  <option value="set">Set Exact Balance</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Amount (USD Base)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={creditForm.amountUsd}
                  onChange={(e) => setCreditForm((f) => ({ ...f, amountUsd: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                />
                <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                  Display equivalent: {formatMoney(creditForm.amountUsd || 0)}
                </p>
              </div>

              {creditForm.creditType === 'promo' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={creditForm.validityDays}
                    onChange={(e) => setCreditForm((f) => ({ ...f, validityDays: e.target.value }))}
                    className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Audit Reason
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Support refund, manual deposit verification, goodwill bonus..."
                value={creditForm.reason}
                onChange={(e) => setCreditForm((f) => ({ ...f, reason: e.target.value }))}
                className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setCreditModalTarget(null)}
                className="rounded-xl border border-neutral-200 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-xl bg-[#1ED760] px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
              >
                {actionLoading ? 'Verifying...' : 'Apply Credit Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full Store Control Drawer */}
      {storeControlContext && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/50 backdrop-blur-2xs">
          <div className="flex h-full w-full max-w-xl flex-col border-l border-neutral-200/80 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-neutral-200/80 p-5 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-[#1ED760]" />
                  <h3 className="text-base font-semibold text-neutral-950 dark:text-white">
                    {storeControlContext.store?.name || storeControlContext.store?.storeName}
                  </h3>
                  <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                    {getStoreTiwiId(storeControlContext.store)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Owner: {storeControlContext.customer?.name} ({storeControlContext.customer?.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStoreControlContext(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Control Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-neutral-200/80 bg-neutral-50/70 px-5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
              {[
                { id: 'edit', label: 'Edit Store', icon: SlidersHorizontal },
                { id: 'plan', label: 'Plan & Add-ons', icon: Layers },
                { id: 'migrate', label: 'Migrate Owner', icon: ArrowRightLeft },
                { id: 'lifecycle', label: 'Status & Delete', icon: AlertTriangle },
              ].map((t) => {
                const Icon = t.icon;
                const active = storeControlTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStoreControlTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-[#1ED760] bg-[#1ED760] font-semibold text-black'
                        : 'border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {storeControlTab === 'edit' && (
                <form onSubmit={handleSaveStoreDetails} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Store Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editStoreForm.storeName}
                      onChange={(e) => setEditStoreForm((f) => ({ ...f, storeName: e.target.value }))}
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Subdomain
                    </label>
                    <input
                      type="text"
                      value={editStoreForm.subdomain}
                      onChange={(e) => setEditStoreForm((f) => ({ ...f, subdomain: e.target.value }))}
                      placeholder="store.tiwlo.com"
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 font-mono text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Category
                      </label>
                      <input
                        type="text"
                        value={editStoreForm.category}
                        onChange={(e) => setEditStoreForm((f) => ({ ...f, category: e.target.value }))}
                        placeholder="Retail, Fashion, Electronics..."
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Store Currency
                      </label>
                      <select
                        value={editStoreForm.currency}
                        onChange={(e) => setEditStoreForm((f) => ({ ...f, currency: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      >
                        {CURRENCY_OPTIONS.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
                    >
                      {actionLoading ? 'Saving...' : 'Save Store Changes'}
                    </button>
                  </div>
                </form>
              )}

              {storeControlTab === 'plan' && (
                <form onSubmit={handleSaveStorePlan} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Select Plan Tier
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {planCatalog.map((pkg) => {
                        const selected = planForm.planId === pkg.planId;
                        return (
                          <button
                            key={pkg.planId}
                            type="button"
                            onClick={() => setPlanForm((f) => ({ ...f, planId: pkg.planId }))}
                            className={`rounded-xl border p-3 text-left transition ${
                              selected
                                ? 'border-[#1ED760] bg-[#1ED760]/10'
                                : 'border-neutral-200/80 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                                {pkg.planName}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                                {formatMoney(pkg.price)}/mo
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] tabular-nums text-neutral-500">
                              {pkg.productLimit} products · {pkg.staffLimit} staff · {pkg.hasPos ? 'POS incl.' : 'No POS'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Extra Product Slots
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="25"
                        value={planForm.extraProductSlots}
                        onChange={(e) => setPlanForm((f) => ({ ...f, extraProductSlots: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        Extra Staff Slots
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={planForm.extraStaffSlots}
                        onChange={(e) => setPlanForm((f) => ({ ...f, extraStaffSlots: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs tabular-nums text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900">
                    <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      <span>Enable POS Terminal Add-on</span>
                      <input
                        type="checkbox"
                        checked={planForm.posAddon}
                        onChange={(e) => setPlanForm((f) => ({ ...f, posAddon: e.target.checked }))}
                        className="h-4 w-4 rounded accent-[#1ED760]"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center justify-between text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      <div>
                        <span>Charge User Wallet</span>
                        <p className="text-[10px] font-normal text-neutral-500">
                          Off = Admin Grant / Override (no wallet deduction)
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={planForm.chargeWallet}
                        onChange={(e) => setPlanForm((f) => ({ ...f, chargeWallet: e.target.checked }))}
                        className="h-4 w-4 rounded accent-[#1ED760]"
                      />
                    </label>
                  </div>

                  {/* Live Preview */}
                  <div className="rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/5 p-3.5 text-xs">
                    <p className="font-semibold text-neutral-950 dark:text-white">Live Configuration Preview</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                      <div>
                        Products Quota: <span className="font-semibold tabular-nums">{estimatedPlanPreview.resultingProducts}</span>
                      </div>
                      <div>
                        Staff Seats: <span className="font-semibold tabular-nums">{estimatedPlanPreview.resultingStaff}</span>
                      </div>
                      <div>
                        POS Access: <span className="font-semibold">{estimatedPlanPreview.resultingPos ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div>
                        {planForm.chargeWallet ? 'Wallet Charge:' : 'Admin Override:'}{' '}
                        <span className="font-semibold tabular-nums text-emerald-700 dark:text-[#1ED760]">
                          {planForm.chargeWallet ? formatMoney(estimatedPlanPreview.totalEstimatedUsd) : formatMoney(0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating Plan...' : 'Apply Plan & Add-ons'}
                  </button>
                </form>
              )}

              {storeControlTab === 'migrate' && (
                <form onSubmit={handleMigrateOwner} className="space-y-4">
                  <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-300">
                    Transferring ownership moves this store, its subdomain, products, and sales ledger to the destination Tiwlo account.
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Target User Email
                    </label>
                    <input
                      type="email"
                      required
                      value={migrateEmail}
                      onChange={(e) => setMigrateEmail(e.target.value)}
                      placeholder="new-owner@example.com"
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-50"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    {actionLoading ? 'Migrating...' : 'Migrate Store Owner'}
                  </button>
                </form>
              )}

              {storeControlTab === 'lifecycle' && (
                <div className="space-y-5">
                  {/* Suspend / Reactivate */}
                  <div className="space-y-3 rounded-xl border border-neutral-200/80 p-4 dark:border-neutral-800">
                    <h4 className="text-xs font-semibold text-neutral-950 dark:text-white">
                      Immediate Store Status Control
                    </h4>
                    <p className="text-xs text-neutral-500">
                      Suspend this store immediately (places storefront offline) or restore an active store.
                    </p>
                    <input
                      type="text"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      placeholder="Optional status reason for audit log..."
                      className="h-9 w-full rounded-xl border border-neutral-200/80 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      {getStoreLifecycleInfo(storeControlContext.store).key === 'active' ? (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleToggleStoreStatus('suspended')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <PauseCircle className="h-3.5 w-3.5" />
                          Suspend Store
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleToggleStoreStatus('active')}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-3.5 text-xs font-semibold text-black transition hover:bg-[#19c354]"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Reactivate Store
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Permanent Delete */}
                  <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <Trash2 className="h-4 w-4" />
                      <h4 className="text-xs font-semibold">Delete Store Permanently</h4>
                    </div>
                    <p className="text-xs text-rose-700/90 dark:text-rose-300/90">
                      Permanently deletes this store, tenant database records, and exclusive media assets. The Tiwlo user account and wallet remain intact.
                    </p>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-rose-800 dark:text-rose-300">
                        Type <span className="font-mono font-bold">{storeControlContext.store?.name || storeControlContext.store?.storeName}</span> to confirm:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        placeholder={storeControlContext.store?.name || storeControlContext.store?.storeName}
                        className="h-9 w-full rounded-xl border border-rose-300 bg-white px-3 text-xs text-neutral-900 outline-none focus:border-rose-500 dark:border-rose-900 dark:bg-neutral-950 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={
                        actionLoading ||
                        deleteConfirmName.trim() !==
                          String(storeControlContext.store?.name || storeControlContext.store?.storeName || '').trim()
                      }
                      onClick={handleDeleteStorePermanently}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-4 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {actionLoading ? 'Deleting...' : 'Delete Store Permanently'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {banModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Suspend Tiwlo Account
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {banModalTarget.name} ({banModalTarget.email})
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
              When suspended, the user will be immediately logged out and shown the disabled account notice screen upon sign-in. Any online stores they own will be placed in maintenance mode.
            </p>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                Reason for suspension (visible to user):
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Terms of Service violation, policy non-compliance, payment issue..."
                rows={2}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs text-neutral-900 outline-none focus:border-rose-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setBanModalTarget(null)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleToggleBan(banModalTarget, true, banReason)}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Identity Verification Lock Modal */}
      {identityLockTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !actionLoading) setIdentityLockTarget(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-lock-title"
            className="w-full max-w-[440px] rounded-2xl border border-neutral-200/80 bg-white p-6 text-neutral-900 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 id="identity-lock-title" className="text-lg font-semibold">
              Require identity verification?
            </h3>
            <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
              <span className="font-semibold text-neutral-900 dark:text-white">{identityLockTarget.name}</span>
              {identityLockTarget.email ? ` (${identityLockTarget.email})` : ''} will be signed out and their account will be locked until they complete identity verification.
            </p>
            <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              This affects only this account. Access is restored automatically after successful verification.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setIdentityLockTarget(null)}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleRequireIdentityVerification(identityLockTarget)}
                className="rounded-xl bg-[#1ED760] px-4 py-2 text-xs font-semibold text-black transition hover:bg-[#19c354] disabled:opacity-60"
              >
                {actionLoading ? 'Locking account…' : 'Lock this account'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
