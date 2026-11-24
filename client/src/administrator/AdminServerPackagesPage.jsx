import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import { useAdminCurrency } from './AdminCurrencyContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../components/ui/shadcnPrimitives';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  DollarSign,
  Edit3,
  Eye,
  EyeOff,
  HardDrive,
  HelpCircle,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';
const API_ORIGIN =
  API_BASE.replace(/\/api\/?$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const PACKAGE_CATEGORIES = [
  'Standard',
  'CPU Optimized',
  'Memory Optimized',
  'Storage NVMe',
];

const PAGE_SIZE = 6;

const EMPTY_PACKAGE_FORM = {
  id: '',
  name: '',
  category: 'Standard',
  badge: '',
  description: '',
  monthlyPriceUsd: 12,
  hourlyPriceUsd: 0.018,
  displayedVcpus: 2,
  displayedRamGb: 2,
  displayedStorageGb: 50,
  bandwidthTb: 2,
  backendCpuQuotaPct: 200,
  backendRamMb: 2048,
  backendStorageGb: 50,
  burstRamMb: 256,
  enabled: true,
  popular: false,
  sortOrder: 10,
};

const EMPTY_IMAGE_FORM = {
  id: '',
  name: '',
  os: 'Ubuntu',
  version: '',
  type: 'os',
  badge: '',
  iconUrl: '/os-icons/ubuntu.svg',
  runtimeImage: '',
  description: '',
  monthlySurchargeUsd: 0,
  available: true,
};

function HelpPopover({ title, text, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!pinned) return undefined;
    const handleOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [pinned]);

  const posClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0';

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Help: ${title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ED760]/60 ${
          open
            ? 'bg-[#1ED760]/20 text-emerald-700 dark:text-[#1ED760]'
            : 'text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200'
        }`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-50 mt-1.5 w-64 rounded-xl border border-neutral-200/90 bg-white p-3 text-left shadow-lg dark:border-neutral-800 dark:bg-neutral-950 ${posClass}`}
        >
          <p className="text-[11px] font-semibold text-neutral-900 dark:text-white">{title}</p>
          <p className="mt-1 text-[11px] font-normal leading-relaxed text-neutral-600 dark:text-neutral-300 normal-case tracking-normal">
            {text}
          </p>
        </div>
      )}
    </span>
  );
}

function LabelWithHelp({ label, helpTitle, helpText, align = 'left', htmlFor, required }) {
  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
      >
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <HelpPopover title={helpTitle || label} text={helpText} align={align} />
    </div>
  );
}

function normalizePackage(raw = {}, idx = 0) {
  const monthlyPriceUsd = Number(raw.monthlyPriceUsd ?? raw.monthlyPrice ?? raw.price ?? 0) || 0;
  const hourlyFallback = monthlyPriceUsd > 0 ? Number((monthlyPriceUsd / 672).toFixed(4)) : 0;
  const displayedVcpus = Number(raw.displayedVcpus ?? raw.vcpus ?? 1) || 1;
  const displayedRamGb = Number(raw.displayedRamGb ?? raw.ramGb ?? 1) || 1;
  const displayedStorageGb = Number(raw.displayedStorageGb ?? raw.storageGb ?? 25) || 25;

  return {
    id: String(raw.id || raw.slug || `pkg-${idx + 1}`),
    name: String(raw.name || raw.title || `Package ${idx + 1}`),
    category: PACKAGE_CATEGORIES.includes(raw.category) ? raw.category : raw.category || 'Standard',
    badge: raw.badge || '',
    description: raw.description || '',
    monthlyPriceUsd,
    hourlyPriceUsd: Number(raw.hourlyPriceUsd ?? raw.hourlyPrice ?? hourlyFallback) || 0,
    displayedVcpus,
    displayedRamGb,
    displayedStorageGb,
    bandwidthTb: Number(raw.bandwidthTb ?? raw.transferTb ?? 1) || 1,
    backendCpuQuotaPct: Number(raw.backendCpuQuotaPct ?? displayedVcpus * 100) || 100,
    backendRamMb: Number(raw.backendRamMb ?? displayedRamGb * 1024) || 1024,
    backendStorageGb: Number(raw.backendStorageGb ?? displayedStorageGb) || displayedStorageGb,
    burstRamMb: Number(raw.burstRamMb ?? 0) || 0,
    enabled: raw.enabled !== false,
    popular: Boolean(raw.popular),
    sortOrder: Number(raw.sortOrder ?? idx + 1) || idx + 1,
  };
}

function normalizeOsImage(raw = {}, idx = 0) {
  return {
    id: String(raw.id || raw.slug || `img-${idx + 1}`),
    name: String(raw.name || `Image ${idx + 1}`),
    os: String(raw.os || 'Linux'),
    version: String(raw.version || ''),
    type: raw.type === 'app' ? 'app' : 'os',
    badge: raw.badge || '',
    iconUrl: raw.iconUrl || '',
    runtimeImage: raw.runtimeImage || '',
    description: raw.description || '',
    monthlySurchargeUsd: Number(raw.monthlySurchargeUsd ?? raw.surchargeUsd ?? raw.priceUsd ?? 0) || 0,
    available: Boolean(raw.available),
    isCustom: Boolean(raw.isCustom),
  };
}

const inputCls =
  'w-full rounded-lg border border-neutral-200/90 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/20 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500';

export default function AdminServerPackagesPage({ onBackToDashboard, onNavigate, showToast }) {
  const currencyCtx = useAdminCurrency();

  const [packages, setPackages] = useState([]);
  const [osImages, setOsImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Filters & Pagination for Hardware Packages
  const [pkgSearch, setPkgSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Filters & Inline Surcharge State for OS Images
  const [imgSearch, setImgSearch] = useState('');
  const [imgFilter, setImgFilter] = useState('ALL');
  const [surchargeDrafts, setSurchargeDrafts] = useState({});
  const [savingImageId, setSavingImageId] = useState('');
  const [togglingPkgId, setTogglingPkgId] = useState('');

  // Modals
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [pkgForm, setPkgForm] = useState(EMPTY_PACKAGE_FORM);

  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [editingImg, setEditingImg] = useState(null);
  const [imgForm, setImgForm] = useState(EMPTY_IMAGE_FORM);

  const [deleteTarget, setDeleteTarget] = useState(null); // { kind: 'package' | 'image', item }
  const [customBuilder, setCustomBuilder] = useState({
    enabled: false,
    pricePerVcpuMonthly: 3,
    pricePerRamGbMonthly: 2,
    pricePerStorageGbMonthly: 0.15,
    pricePerBandwidthTbMonthly: 1,
    minVcpus: 1,
    maxVcpus: 32,
    minRamGb: 1,
    maxRamGb: 128,
    minStorageGb: 10,
    maxStorageGb: 2000,
  });
  const [savingCustomBuilder, setSavingCustomBuilder] = useState(false);

  const formatMoney = useCallback(
    (usdAmount, options) => {
      if (typeof currencyCtx?.formatMoney === 'function') {
        return currencyCtx.formatMoney(usdAmount, options);
      }
      const n = Number(usdAmount || 0);
      return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
    },
    [currencyCtx]
  );

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('stockpro_session');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const fetchWithOptionalReauth = useCallback(
    async (url, options = {}) => {
      const headers = { ...getHeaders(), ...(options.headers || {}) };
      let res = await fetch(url, { credentials: 'include', ...options, headers });
      let json = await res.json().catch(() => ({}));
      const needsReauth =
        (res.status === 403 || res.status === 428) &&
        (json.reauthRequired ||
          json.error === 'RECENT_VERIFICATION_REQUIRED' ||
          json.code === 'RECENT_VERIFICATION_REQUIRED' ||
          /reauth|verification|grant/i.test(json.error || json.message || ''));

      if (needsReauth) {
        headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
        res = await fetch(url, { credentials: 'include', ...options, headers });
        json = await res.json().catch(() => ({}));
      }
      return { res, json };
    },
    [getHeaders]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/server-packages`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || `Failed to load server packages (${res.status}).`);
      }

      const payload = json.data && !Array.isArray(json.data) ? json.data : json;
      const rawPkgs = Array.isArray(payload.packages)
        ? payload.packages
        : Array.isArray(payload.serverPackages)
          ? payload.serverPackages
          : [];
      const rawImgs = Array.isArray(payload.osImages)
        ? payload.osImages
        : Array.isArray(payload.images)
          ? payload.images
          : [];

      const normalizedPkgs = rawPkgs
        .map(normalizePackage)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.monthlyPriceUsd - b.monthlyPriceUsd);
      const normalizedImgs = rawImgs.map(normalizeOsImage);

      setPackages(normalizedPkgs);
      setOsImages(normalizedImgs);
      if (payload.customBuilder && typeof payload.customBuilder === 'object') {
        setCustomBuilder((prev) => ({ ...prev, ...payload.customBuilder }));
      }
      const drafts = {};
      normalizedImgs.forEach((img) => {
        drafts[img.id] = String(img.monthlySurchargeUsd ?? 0);
      });
      setSurchargeDrafts(drafts);
    } catch (err) {
      setErrorMsg(err?.message || 'Could not load server packages & OS images.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Packages + Pagination
  const filteredPackages = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    return packages.filter((pkg) => {
      if (categoryFilter !== 'ALL' && pkg.category !== categoryFilter) return false;
      if (statusFilter === 'ENABLED' && !pkg.enabled) return false;
      if (statusFilter === 'DISABLED' && pkg.enabled) return false;
      if (!q) return true;
      return (
        pkg.name.toLowerCase().includes(q) ||
        pkg.id.toLowerCase().includes(q) ||
        pkg.category.toLowerCase().includes(q) ||
        String(pkg.badge || '').toLowerCase().includes(q)
      );
    });
  }, [packages, pkgSearch, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [pkgSearch, categoryFilter, statusFilter]);

  const paginatedPackages = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredPackages.slice(start, start + PAGE_SIZE);
  }, [filteredPackages, safePage]);

  // Filtered OS Images
  const filteredImages = useMemo(() => {
    const q = imgSearch.trim().toLowerCase();
    return osImages.filter((img) => {
      if (imgFilter === 'AVAILABLE' && !img.available) return false;
      if (imgFilter === 'HIDDEN' && img.available) return false;
      if (imgFilter === 'OS' && img.type !== 'os') return false;
      if (imgFilter === 'APP' && img.type !== 'app') return false;
      if (!q) return true;
      return (
        img.name.toLowerCase().includes(q) ||
        img.id.toLowerCase().includes(q) ||
        img.os.toLowerCase().includes(q) ||
        img.version.toLowerCase().includes(q)
      );
    });
  }, [osImages, imgSearch, imgFilter]);

  // Summary & Distribution Metrics
  const stats = useMemo(() => {
    const enabledPkgs = packages.filter((p) => p.enabled);
    const prices = enabledPkgs.map((p) => p.monthlyPriceUsd).filter((n) => n >= 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const availableImgs = osImages.filter((i) => i.available);
    const paidImgs = osImages.filter((i) => Number(i.monthlySurchargeUsd) > 0);
    const osOnly = osImages.filter((i) => i.type === 'os');
    const appOnly = osImages.filter((i) => i.type === 'app');

    const tierBreakdown = PACKAGE_CATEGORIES.map((cat) => {
      const items = packages.filter((p) => p.category === cat);
      const activeCount = items.filter((p) => p.enabled).length;
      const pct = packages.length ? (items.length / packages.length) * 100 : 0;
      const avgPrice = items.length
        ? items.reduce((s, p) => s + p.monthlyPriceUsd, 0) / items.length
        : 0;
      return {
        category: cat,
        total: items.length,
        active: activeCount,
        pct,
        avgPrice,
      };
    });

    return {
      totalPackages: packages.length,
      enabledPackages: enabledPkgs.length,
      minPrice,
      maxPrice,
      totalImages: osImages.length,
      availableImages: availableImgs.length,
      paidImages: paidImgs.length,
      osCount: osOnly.length,
      osAvailableCount: osOnly.filter((i) => i.available).length,
      appCount: appOnly.length,
      appAvailableCount: appOnly.filter((i) => i.available).length,
      tierBreakdown,
    };
  }, [packages, osImages]);

  // Package Handlers
  const openCreatePackageModal = () => {
    setEditingPkg(null);
    setPkgForm({
      ...EMPTY_PACKAGE_FORM,
      sortOrder: packages.length + 1,
    });
    setPkgModalOpen(true);
  };

  const openEditPackageModal = (pkg) => {
    setEditingPkg(pkg);
    setPkgForm({ ...pkg });
    setPkgModalOpen(true);
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    if (saving) return;
    const cleanId = pkgForm.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cleanId || !pkgForm.name.trim()) {
      showToast?.('Package ID and Name are required.', 'error');
      return;
    }

    const payload = {
      id: cleanId,
      name: pkgForm.name.trim(),
      category: pkgForm.category || 'Standard',
      badge: pkgForm.badge.trim(),
      description: pkgForm.description.trim(),
      monthlyPriceUsd: Math.max(0, Number(pkgForm.monthlyPriceUsd) || 0),
      hourlyPriceUsd: Math.max(0, Number(pkgForm.hourlyPriceUsd) || 0),
      displayedVcpus: Math.max(1, Number(pkgForm.displayedVcpus) || 1),
      displayedRamGb: Math.max(0.25, Number(pkgForm.displayedRamGb) || 1),
      displayedStorageGb: Math.max(5, Number(pkgForm.displayedStorageGb) || 25),
      bandwidthTb: Math.max(0.5, Number(pkgForm.bandwidthTb) || 1),
      backendCpuQuotaPct: Math.max(10, Number(pkgForm.backendCpuQuotaPct) || 100),
      backendRamMb: Math.max(128, Number(pkgForm.backendRamMb) || 1024),
      backendStorageGb: Math.max(5, Number(pkgForm.backendStorageGb) || 25),
      burstRamMb: Math.max(0, Number(pkgForm.burstRamMb) || 0),
      enabled: Boolean(pkgForm.enabled),
      popular: Boolean(pkgForm.popular),
      sortOrder: Number(pkgForm.sortOrder) || 0,
    };

    try {
      setSaving(true);
      const url = editingPkg
        ? `${API_BASE}/admin/server-packages/packages/${encodeURIComponent(editingPkg.id)}`
        : `${API_BASE}/admin/server-packages/packages`;
      const method = editingPkg ? 'PUT' : 'POST';
      const { res, json } = await fetchWithOptionalReauth(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to save server package.');
      }
      showToast?.(
        editingPkg ? `Updated ${payload.name}.` : `Created ${payload.name}.`,
        'success'
      );
      setPkgModalOpen(false);
      await loadData();
    } catch (err) {
      showToast?.(err?.message || 'Could not save server package.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomBuilder = async (nextConfig = customBuilder) => {
    if (savingCustomBuilder) return;
    try {
      setSavingCustomBuilder(true);
      const { res, json } = await fetchWithOptionalReauth(
        `${API_BASE}/admin/server-packages/custom-builder`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            enabled: Boolean(nextConfig.enabled),
            pricePerVcpuMonthly: Math.max(0, Number(nextConfig.pricePerVcpuMonthly) || 0),
            pricePerRamGbMonthly: Math.max(0, Number(nextConfig.pricePerRamGbMonthly) || 0),
            pricePerStorageGbMonthly: Math.max(0, Number(nextConfig.pricePerStorageGbMonthly) || 0),
            pricePerBandwidthTbMonthly: Math.max(0, Number(nextConfig.pricePerBandwidthTbMonthly) || 0),
            minVcpus: Math.max(1, Number(nextConfig.minVcpus) || 1),
            maxVcpus: Math.max(1, Number(nextConfig.maxVcpus) || 32),
            minRamGb: Math.max(1, Number(nextConfig.minRamGb) || 1),
            maxRamGb: Math.max(1, Number(nextConfig.maxRamGb) || 128),
            minStorageGb: Math.max(5, Number(nextConfig.minStorageGb) || 10),
            maxStorageGb: Math.max(10, Number(nextConfig.maxStorageGb) || 2000),
          }),
        }
      );
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to update custom droplet builder.');
      }
      if (json.customBuilder) {
        setCustomBuilder((prev) => ({ ...prev, ...json.customBuilder }));
      }
      showToast?.(
        nextConfig.enabled
          ? 'Custom Droplet Builder enabled for customers.'
          : 'Custom Droplet Builder disabled (fixed plans only).',
        'success'
      );
    } catch (err) {
      showToast?.(err?.message || 'Could not update custom droplet builder.', 'error');
    } finally {
      setSavingCustomBuilder(false);
    }
  };

  const handleTogglePackageEnabled = async (pkg) => {
    if (togglingPkgId) return;
    const nextEnabled = !pkg.enabled;
    try {
      setTogglingPkgId(pkg.id);
      const { res, json } = await fetchWithOptionalReauth(
        `${API_BASE}/admin/server-packages/packages/${encodeURIComponent(pkg.id)}`,
        {
          method: 'PUT',
          body: JSON.stringify({ ...pkg, enabled: nextEnabled }),
        }
      );
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to update package status.');
      }
      setPackages((prev) =>
        prev.map((item) => (item.id === pkg.id ? { ...item, enabled: nextEnabled } : item))
      );
      showToast?.(
        nextEnabled ? `${pkg.name} enabled in catalog.` : `${pkg.name} disabled.`,
        'success'
      );
    } catch (err) {
      showToast?.(err?.message || 'Could not update package status.', 'error');
    } finally {
      setTogglingPkgId('');
    }
  };

  // OS Image Handlers
  const openCreateImageModal = () => {
    setEditingImg(null);
    setImgForm({ ...EMPTY_IMAGE_FORM });
    setImgModalOpen(true);
  };

  const openEditImageModal = (img) => {
    setEditingImg(img);
    setImgForm({ ...img });
    setImgModalOpen(true);
  };

  const updateOsImageRequest = async (id, payload, isCreate = false) => {
    const basePaths = ['images', 'os-images'];
    let lastResult = null;
    for (const seg of basePaths) {
      const url = isCreate
        ? `${API_BASE}/admin/server-packages/${seg}`
        : `${API_BASE}/admin/server-packages/${seg}/${encodeURIComponent(id)}`;
      const result = await fetchWithOptionalReauth(url, {
        method: isCreate ? 'POST' : 'PATCH',
        body: JSON.stringify(payload),
      });
      lastResult = result;
      if (result.res.status !== 404) break;
    }
    return lastResult;
  };

  const handleToggleImageAvailable = async (img) => {
    if (savingImageId) return;
    const nextAvailable = !img.available;
    const draftSurcharge = Number(surchargeDrafts[img.id] ?? img.monthlySurchargeUsd) || 0;
    try {
      setSavingImageId(img.id);
      const { res, json } = await updateOsImageRequest(img.id, {
        ...img,
        available: nextAvailable,
        monthlySurchargeUsd: Math.max(0, draftSurcharge),
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to update OS image availability.');
      }
      setOsImages((prev) =>
        prev.map((item) =>
          item.id === img.id
            ? { ...item, available: nextAvailable, monthlySurchargeUsd: Math.max(0, draftSurcharge) }
            : item
        )
      );
      showToast?.(
        nextAvailable
          ? `${img.name} is now LIVE in Create Droplet marketplace.`
          : `${img.name} hidden from Create Droplet marketplace.`,
        'success'
      );
    } catch (err) {
      showToast?.(err?.message || 'Could not update OS image availability.', 'error');
    } finally {
      setSavingImageId('');
    }
  };

  const handleSaveImageSurcharge = async (img) => {
    if (savingImageId) return;
    const nextPrice = Math.max(0, Number(surchargeDrafts[img.id] ?? img.monthlySurchargeUsd) || 0);
    try {
      setSavingImageId(img.id);
      const { res, json } = await updateOsImageRequest(img.id, {
        ...img,
        monthlySurchargeUsd: nextPrice,
      });
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to update OS image surcharge.');
      }
      setOsImages((prev) =>
        prev.map((item) =>
          item.id === img.id ? { ...item, monthlySurchargeUsd: nextPrice } : item
        )
      );
      showToast?.(`Saved ${img.name} surcharge (${formatMoney(nextPrice)}/mo).`, 'success');
    } catch (err) {
      showToast?.(err?.message || 'Could not update OS image pricing.', 'error');
    } finally {
      setSavingImageId('');
    }
  };

  const handleSaveImageModal = async (e) => {
    e.preventDefault();
    if (saving) return;
    const cleanId = imgForm.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (!cleanId || !imgForm.name.trim()) {
      showToast?.('Image ID and Name are required.', 'error');
      return;
    }

    const payload = {
      id: cleanId,
      name: imgForm.name.trim(),
      os: imgForm.os.trim() || 'Linux',
      version: imgForm.version.trim(),
      type: imgForm.type === 'app' ? 'app' : 'os',
      badge: imgForm.badge.trim(),
      iconUrl: imgForm.iconUrl.trim() || '/os-icons/ubuntu.svg',
      runtimeImage: imgForm.runtimeImage.trim(),
      description: imgForm.description.trim(),
      monthlySurchargeUsd: Math.max(0, Number(imgForm.monthlySurchargeUsd) || 0),
      available: Boolean(imgForm.available),
    };

    try {
      setSaving(true);
      const { res, json } = await updateOsImageRequest(
        editingImg ? editingImg.id : cleanId,
        payload,
        !editingImg
      );
      if (!res.ok || json.success === false) {
        throw new Error(json.error || json.message || 'Failed to save OS image.');
      }
      showToast?.(
        editingImg ? `Updated ${payload.name}.` : `Added ${payload.name} to OS catalog.`,
        'success'
      );
      setImgModalOpen(false);
      await loadData();
    } catch (err) {
      showToast?.(err?.message || 'Could not save OS image.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || saving) return;
    try {
      setSaving(true);
      let res;
      let json;
      if (deleteTarget.kind === 'package') {
        ({ res, json } = await fetchWithOptionalReauth(
          `${API_BASE}/admin/server-packages/packages/${encodeURIComponent(deleteTarget.item.id)}`,
          { method: 'DELETE' }
        ));
      } else {
        for (const seg of ['images', 'os-images']) {
          ({ res, json } = await fetchWithOptionalReauth(
            `${API_BASE}/admin/server-packages/${seg}/${encodeURIComponent(deleteTarget.item.id)}`,
            { method: 'DELETE' }
          ));
          if (res.status !== 404) break;
        }
      }
      if (!res?.ok || json?.success === false) {
        throw new Error(json?.error || json?.message || 'Delete failed.');
      }
      showToast?.(`Removed ${deleteTarget.item.name}.`, 'success');
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      showToast?.(err?.message || 'Could not delete item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Bar & Sub-Page Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {onBackToDashboard && (
              <Button variant="outline" size="sm" onClick={onBackToDashboard}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Overview
              </Button>
            )}
            <Tabs
              value="server-packages"
              onValueChange={(val) => {
                if (val && val !== 'server-packages') onNavigate?.(val);
              }}
              className="w-auto"
            >
              <TabsList>
                <TabsTrigger value="server-packages">
                  <Package className="h-3.5 w-3.5" />
                  Server Packages &amp; OS Pricing
                </TabsTrigger>
                <TabsTrigger value="server-allocation">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Resource Allocation &amp; Quotas
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Server Packages &amp; OS Image Pricing
            </h1>
            <HelpPopover
              title="Server Packages & OS Image Pricing"
              text="Configure public droplet plans, monthly/hourly billing, and OS add-on pricing. Only OS images toggled Available appear in the customer Create Droplet marketplace."
            />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Manage customer-facing VPS tiers, OS image availability sync, and add-on monthly surcharges.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate?.('server-allocation')}
          >
            <Cpu className="h-3.5 w-3.5" />
            Tune Backend Quotas
          </Button>
          <Button variant="default" size="sm" onClick={openCreatePackageModal}>
            <Plus className="h-3.5 w-3.5" />
            New Package
          </Button>
        </div>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="justify-between">
          <div className="space-y-0.5">
            <p className="font-semibold">Unable to load server packages catalog</p>
            <p className="opacity-90">{errorMsg}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Hardware Tiers</span>
                <HelpPopover
                  title="Hardware Tiers"
                  text="Total droplet compute plans defined in the platform catalog and how many are currently enabled for customer checkout."
                />
              </div>
              <Package className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {stats.enabledPackages}
              <span className="ml-1 text-sm font-normal text-neutral-400">
                / {stats.totalPackages} active
              </span>
            </p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {stats.totalPackages - stats.enabledPackages} disabled from storefront
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Plan Price Range</span>
                <HelpPopover
                  title="Plan Price Range"
                  text="Lowest to highest monthly USD base rate among enabled hardware packages before optional OS surcharges."
                />
              </div>
              <DollarSign className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {formatMoney(stats.minPrice, { compact: true })}
              <span className="mx-1 text-sm font-normal text-neutral-400">–</span>
              {formatMoney(stats.maxPrice, { compact: true })}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Monthly base compute pricing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Marketplace OS Images</span>
                <HelpPopover
                  title="OS Image Availability Sync"
                  text="Only images marked Available (true) appear as selectable options in customers' Create Droplet page. Disabled images stay hidden."
                />
              </div>
              <Server className="h-4 w-4 text-[#1ED760]" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {stats.availableImages}
              <span className="ml-1 text-sm font-normal text-neutral-400">
                / {stats.totalImages} live
              </span>
            </p>
            <p className="mt-1 text-[11px] text-emerald-700 dark:text-[#1ED760]">
              Synced with Create Droplet marketplace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 pt-4 sm:p-4 sm:pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <span>Paid OS Add-ons</span>
                <HelpPopover
                  title="Paid OS Add-ons"
                  text="Number of OS or panel/app images configured with a monthly surcharge above $0.00 (added automatically to the droplet invoice)."
                />
              </div>
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
              {stats.paidImages}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {stats.totalImages - stats.paidImages} included free ($0/mo)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Progress Chart Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CardTitle>Tier Distribution &amp; OS Marketplace Coverage</CardTitle>
              <HelpPopover
                title="Tier & Image Coverage Chart"
                text="Visual breakdown of compute packages by category and the proportion of OS/App images currently published to users."
              />
            </div>
            <Badge variant="brand">Live Catalog Sync</Badge>
          </div>
          <CardDescription>
            Compare active hardware tiers across categories alongside published OS &amp; app stack availability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Package Tiers Progress Bars */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                <span>Package Tiers by Category</span>
                <HelpPopover
                  title="Package Tiers by Category"
                  text="Shows how many packages exist in each category (Standard, CPU Optimized, Memory Optimized, Storage NVMe) and their average monthly rate."
                />
              </div>
              <div className="space-y-2.5">
                {stats.tierBreakdown.map((tier) => (
                  <div key={tier.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">
                        {tier.category}
                      </span>
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                        {tier.active}/{tier.total} active · avg {formatMoney(tier.avgPrice)}/mo
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
                      <div
                        className="h-full rounded-full bg-[#1ED760] transition-all duration-300"
                        style={{ width: `${Math.max(tier.total > 0 ? 6 : 0, tier.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: OS Image Coverage Bars */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                <span>Active OS &amp; App Stack Coverage</span>
                <HelpPopover
                  title="Active Image Coverage"
                  text="Tracks how many base OS distributions and 1-click app images are enabled (available: true) for customer provisioning."
                />
              </div>
              <div className="space-y-3 rounded-xl border border-neutral-200/70 bg-[#fafafa] p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Overall Marketplace Availability
                    </span>
                    <span className="tabular-nums font-semibold text-neutral-900 dark:text-white">
                      {stats.totalImages
                        ? `${Math.round((stats.availableImages / stats.totalImages) * 100)}%`
                        : '0%'}{' '}
                      ({stats.availableImages}/{stats.totalImages})
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-[#1ED760] transition-all duration-300"
                      style={{
                        width: `${
                          stats.totalImages ? (stats.availableImages / stats.totalImages) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500 dark:text-neutral-400">Base OS Images</span>
                      <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                        {stats.osAvailableCount}/{stats.osCount}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-sky-500 transition-all duration-300"
                        style={{
                          width: `${stats.osCount ? (stats.osAvailableCount / stats.osCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-500 dark:text-neutral-400">1-Click App Stacks</span>
                      <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                        {stats.appAvailableCount}/{stats.appCount}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{
                          width: `${stats.appCount ? (stats.appAvailableCount / stats.appCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Droplet Builder Control Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#1ED760]" />
                <CardTitle>Custom Droplet Resource Builder</CardTitle>
                <Badge variant={customBuilder.enabled ? 'brand' : 'secondary'}>
                  {customBuilder.enabled ? 'Enabled in Marketplace' : 'Disabled (Fixed Packages Only)'}
                </Badge>
                <HelpPopover
                  title="Custom Resource Builder Toggle"
                  text="When enabled, customers can customize exact vCPU, RAM, and NVMe disk sliders on Create Droplet billed per-unit monthly. Disable to restrict orders strictly to curated packages below."
                />
              </div>
              <CardDescription className="mt-1">
                Toggle self-serve custom hardware sliders and set per-unit monthly USD pricing.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={customBuilder.enabled ? 'outline' : 'default'}
                size="sm"
                disabled={savingCustomBuilder}
                onClick={() => {
                  const next = { ...customBuilder, enabled: !customBuilder.enabled };
                  setCustomBuilder(next);
                  handleSaveCustomBuilder(next);
                }}
              >
                {customBuilder.enabled ? 'Disable Custom Builder' : 'Enable Custom Builder'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingCustomBuilder}
                onClick={() => handleSaveCustomBuilder(customBuilder)}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save Rates
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                <span>$/vCPU / mo</span>
                <HelpPopover title="vCPU Unit Rate" text="Monthly USD charge per selected vCPU core in custom droplets." />
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                className={inputCls}
                value={customBuilder.pricePerVcpuMonthly}
                onChange={(e) => setCustomBuilder((p) => ({ ...p, pricePerVcpuMonthly: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                <span>$/GB RAM / mo</span>
                <HelpPopover title="RAM Unit Rate" text="Monthly USD charge per GB of memory in custom droplets." />
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                className={inputCls}
                value={customBuilder.pricePerRamGbMonthly}
                onChange={(e) => setCustomBuilder((p) => ({ ...p, pricePerRamGbMonthly: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                <span>$/GB NVMe / mo</span>
                <HelpPopover title="Storage Unit Rate" text="Monthly USD charge per GB of NVMe SSD storage." />
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                value={customBuilder.pricePerStorageGbMonthly}
                onChange={(e) => setCustomBuilder((p) => ({ ...p, pricePerStorageGbMonthly: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                <span>$/TB Transfer / mo</span>
                <HelpPopover title="Bandwidth Unit Rate" text="Monthly USD charge per TB outbound bandwidth allocation." />
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                className={inputCls}
                value={customBuilder.pricePerBandwidthTbMonthly}
                onChange={(e) => setCustomBuilder((p) => ({ ...p, pricePerBandwidthTbMonthly: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Hardware Packages Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>Hardware Packages</CardTitle>
                <HelpPopover
                  title="Hardware Packages"
                  text="Create, edit, enable/disable, or remove server packages shown to customers. Hidden cgroup quotas can be fine-tuned in Resource Allocation."
                />
              </div>
              <CardDescription className="mt-1">
                Filter by tier category, inspect displayed specs vs backend quota caps, and manage storefront availability.
              </CardDescription>
            </div>
            <Button variant="default" size="sm" onClick={openCreatePackageModal}>
              <Plus className="h-3.5 w-3.5" />
              Add Hardware Package
            </Button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {['ALL', ...PACKAGE_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-[#1ED760] font-semibold text-black'
                      : 'border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {cat === 'ALL' ? 'All Categories' : cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[210px] flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  placeholder="Search packages..."
                  className={`${inputCls} pl-8`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter packages by status"
                className="rounded-lg border border-neutral-200/90 bg-white px-2.5 py-2 text-xs text-neutral-700 focus:border-[#1ED760] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="ENABLED">Enabled Only</option>
                <option value="DISABLED">Disabled Only</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-y border-neutral-200/80 bg-[#fafafa] text-[11px] font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Package &amp; Category</span>
                      <HelpPopover
                        title="Package & Category"
                        text="Plan display name, internal slug ID, marketing badge, and hardware tier category."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Displayed Specs</span>
                      <HelpPopover
                        title="Displayed Specs"
                        text="vCPUs, RAM, NVMe disk, and monthly transfer displayed to customers during droplet creation."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Monthly / Hourly Price</span>
                      <HelpPopover
                        title="Monthly & Hourly Price"
                        text="Base compute price billed to customers. Hourly rate is prorated when droplets are destroyed mid-month."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Backend Quota Cap</span>
                      <HelpPopover
                        title="Backend Quota Cap"
                        text="Actual container cgroup CPU%, RAM MB, and burst headroom enforced on host nodes. Click Tune to edit."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Status</span>
                      <HelpPopover
                        title="Storefront Status"
                        text="Enabled packages can be ordered by users. Disabled packages remain saved but hidden from new deployments."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span>Actions</span>
                      <HelpPopover
                        title="Package Actions"
                        text="Edit pricing/specs or permanently delete a package tier."
                        align="right"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                      Loading server packages...
                    </td>
                  </tr>
                ) : paginatedPackages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                      No server packages match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedPackages.map((pkg) => (
                    <tr
                      key={pkg.id}
                      className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-neutral-950 dark:text-white">
                            {pkg.name}
                          </span>
                          {pkg.badge && <Badge variant="brand">{pkg.badge}</Badge>}
                          {pkg.popular && !pkg.badge && <Badge variant="info">Popular</Badge>}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] dark:bg-neutral-900">
                            {pkg.id}
                          </code>
                          <span>•</span>
                          <span>{pkg.category}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top tabular-nums">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {pkg.displayedVcpus} vCPU · {pkg.displayedRamGb} GB RAM · {pkg.displayedStorageGb} GB NVMe
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                          {pkg.bandwidthTb} TB Transfer
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top tabular-nums">
                        <div className="font-semibold text-neutral-950 dark:text-white">
                          {formatMoney(pkg.monthlyPriceUsd)}/mo
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                          ${Number(pkg.hourlyPriceUsd).toFixed(4)}/hr USD
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top tabular-nums">
                        <div className="text-neutral-800 dark:text-neutral-200">
                          {pkg.backendCpuQuotaPct}% CPU · {pkg.backendRamMb} MB RAM
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>Burst +{pkg.burstRamMb} MB</span>
                          <button
                            type="button"
                            onClick={() => onNavigate?.('server-allocation')}
                            className="font-medium text-emerald-700 hover:underline dark:text-[#1ED760] cursor-pointer"
                          >
                            Tune →
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          disabled={togglingPkgId === pkg.id}
                          onClick={() => handleTogglePackageEnabled(pkg)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                            pkg.enabled
                              ? 'border-[#1ED760]/40 bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760]'
                              : 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              pkg.enabled ? 'bg-[#1ED760]' : 'bg-neutral-400'
                            }`}
                          />
                          {togglingPkgId === pkg.id
                            ? 'Saving...'
                            : pkg.enabled
                              ? 'Enabled'
                              : 'Disabled'}
                        </button>
                      </td>

                      <td className="px-4 py-3 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditPackageModal(pkg)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${pkg.name}`}
                            onClick={() => setDeleteTarget({ kind: 'package', item: pkg })}
                            className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination (Shown whenever filtered items exceed 6) */}
          {filteredPackages.length > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 px-4 py-3 text-xs dark:border-neutral-800">
              <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredPackages.length)} of{' '}
                {filteredPackages.length} packages
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <span className="px-2 text-xs font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                  Page {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: OS Images & Add-on Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>OS Images &amp; Add-on Pricing</CardTitle>
                <HelpPopover
                  title="OS Images & Add-on Pricing"
                  text="Control which operating systems and 1-click app images are visible in Create Droplet and set optional monthly licensing surcharges."
                />
              </div>
              <CardDescription className="mt-1">
                Toggle availability for Ubuntu 24.04, Debian 12, or custom add-on stacks and configure monthly surcharges.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openCreateImageModal}>
              <Plus className="h-3.5 w-3.5" />
              Add Custom Image
            </Button>
          </div>

          <Alert variant="success" className="mt-3">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-[#1ED760]" />
            <div className="space-y-0.5">
              <p className="font-semibold">Create Droplet Marketplace Visibility Sync</p>
              <p className="opacity-90">
                Only images with <strong>Available</strong> turned on appear as active choices in users&apos; Create Droplet marketplace. Disabled images are hidden or locked out from customer deployments.
              </p>
            </div>
          </Alert>

          <div className="mt-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Images' },
                { id: 'AVAILABLE', label: 'Available Only' },
                { id: 'HIDDEN', label: 'Hidden / Disabled' },
                { id: 'OS', label: 'Base OS' },
                { id: 'APP', label: '1-Click Apps' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setImgFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    imgFilter === tab.id
                      ? 'bg-[#1ED760] font-semibold text-black'
                      : 'border border-neutral-200/80 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={imgSearch}
                onChange={(e) => setImgSearch(e.target.value)}
                placeholder="Search OS or app image..."
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-y border-neutral-200/80 bg-[#fafafa] text-[11px] font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>OS / Add-on Image</span>
                      <HelpPopover
                        title="OS / Add-on Image"
                        text="Image display name, OS family, version label, and slug ID passed during droplet provisioning."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Type &amp; Runtime</span>
                      <HelpPopover
                        title="Type & Runtime"
                        text="Distinguishes base Linux OS templates from pre-installed 1-click app stacks and shows the container/VM runtime image."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Marketplace Visibility</span>
                      <HelpPopover
                        title="OS Image Availability Sync"
                        text="Toggle Available ON to show this image in users' Create Droplet marketplace. Toggle OFF to hide it immediately."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-1.5">
                      <span>Monthly Surcharge (USD)</span>
                      <HelpPopover
                        title="Monthly Surcharge"
                        text="Extra monthly USD fee added on top of the selected hardware package (e.g. for licensed panels or managed stacks). Set 0 for free."
                      />
                    </div>
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <span>Actions</span>
                      <HelpPopover
                        title="Image Actions"
                        text="Save inline surcharge changes, edit full image metadata, or delete custom add-on images."
                        align="right"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      Loading OS images...
                    </td>
                  </tr>
                ) : filteredImages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                      No OS images match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredImages.map((img) => {
                    const draftVal = surchargeDrafts[img.id] ?? String(img.monthlySurchargeUsd);
                    const surchargeDirty =
                      Number(draftVal) !== Number(img.monthlySurchargeUsd);
                    const isBusy = savingImageId === img.id;

                    return (
                      <tr
                        key={img.id}
                        className="transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200/80 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
                              {img.iconUrl ? (
                                <img
                                  src={img.iconUrl}
                                  alt=""
                                  className="h-4 w-4 object-contain"
                                />
                              ) : (
                                <Layers className="h-4 w-4 text-neutral-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-neutral-950 dark:text-white">
                                  {img.name}
                                </span>
                                {img.badge && <Badge variant="brand">{img.badge}</Badge>}
                                {img.isCustom && <Badge variant="secondary">Custom</Badge>}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                                <code>{img.id}</code>
                                {img.version && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{img.version}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <Badge variant={img.type === 'app' ? 'warning' : 'outline'}>
                            {img.type === 'app' ? '1-Click App' : 'Base OS'}
                          </Badge>
                          {img.runtimeImage && (
                            <p className="mt-1 max-w-[200px] truncate text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                              {img.runtimeImage}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleImageAvailable(img)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                              img.available
                                ? 'border-[#1ED760]/40 bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760]'
                                : 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'
                            }`}
                          >
                            {img.available ? (
                              <Eye className="h-3 w-3" />
                            ) : (
                              <EyeOff className="h-3 w-3" />
                            )}
                            {isBusy
                              ? 'Syncing...'
                              : img.available
                                ? 'Available (Live)'
                                : 'Hidden'}
                          </button>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={draftVal}
                              onChange={(e) =>
                                setSurchargeDrafts((prev) => ({
                                  ...prev,
                                  [img.id]: e.target.value,
                                }))
                              }
                              aria-label={`${img.name} monthly surcharge USD`}
                              className="w-24 rounded-lg border border-neutral-200/90 bg-white px-2.5 py-1.5 text-xs tabular-nums text-neutral-900 focus:border-[#1ED760] focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                            />
                            <span className="text-[11px] text-neutral-400">/mo</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle text-right">
                          <div className="inline-flex items-center gap-1">
                            {surchargeDirty && (
                              <Button
                                variant="default"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => handleSaveImageSurcharge(img)}
                              >
                                <Save className="h-3.5 w-3.5" />
                                Save Price
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditImageModal(img)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            {img.isCustom && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete ${img.name}`}
                                onClick={() => setDeleteTarget({ kind: 'image', item: img })}
                                className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
        </CardContent>
      </Card>

      {/* Create / Edit Hardware Package Modal */}
      {pkgModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => !saving && setPkgModalOpen(false)}
        >
          <Card
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex-row items-start justify-between border-b border-neutral-200/80 dark:border-neutral-800">
              <div>
                <CardTitle>
                  {editingPkg ? `Edit Package: ${editingPkg.name}` : 'Create Hardware Package'}
                </CardTitle>
                <CardDescription className="mt-1">
                  Configure customer-facing plan pricing, displayed specifications, and default backend cgroup caps.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => !saving && setPkgModalOpen(false)}
                aria-label="Close package modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <form onSubmit={handleSavePackage}>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Package ID / Slug"
                      htmlFor="pkg-id"
                      required
                      helpText="Unique immutable identifier used in API requests and droplet billing records (e.g. standard-pro)."
                    />
                    <input
                      id="pkg-id"
                      type="text"
                      required
                      disabled={Boolean(editingPkg)}
                      value={pkgForm.id}
                      onChange={(e) => setPkgForm((f) => ({ ...f, id: e.target.value }))}
                      placeholder="e.g. standard-pro"
                      className={`${inputCls} disabled:opacity-60`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Display Name"
                      htmlFor="pkg-name"
                      required
                      helpText="Customer-facing plan title shown in Create Droplet and invoices."
                    />
                    <input
                      id="pkg-name"
                      type="text"
                      required
                      value={pkgForm.name}
                      onChange={(e) => setPkgForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Standard Pro"
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Category"
                      htmlFor="pkg-category"
                      helpText="Groups the package in admin filters and customer tier tabs."
                    />
                    <select
                      id="pkg-category"
                      value={pkgForm.category}
                      onChange={(e) => setPkgForm((f) => ({ ...f, category: e.target.value }))}
                      className={inputCls}
                    >
                      {PACKAGE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Marketing Badge"
                      htmlFor="pkg-badge"
                      helpText="Optional short pill label (e.g. Popular, Best Value) highlighted on the tier card."
                      align="right"
                    />
                    <input
                      id="pkg-badge"
                      type="text"
                      value={pkgForm.badge}
                      onChange={(e) => setPkgForm((f) => ({ ...f, badge: e.target.value }))}
                      placeholder="Optional (e.g. Popular)"
                      className={inputCls}
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Monthly Price (USD)"
                      htmlFor="pkg-monthly"
                      required
                      helpText="Base monthly USD charge billed to customers. Updates hourly estimate automatically unless overridden."
                    />
                    <input
                      id="pkg-monthly"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pkgForm.monthlyPriceUsd}
                      onChange={(e) => {
                        const monthly = Number(e.target.value) || 0;
                        setPkgForm((f) => ({
                          ...f,
                          monthlyPriceUsd: e.target.value,
                          hourlyPriceUsd: Number((monthly / 672).toFixed(4)),
                        }));
                      }}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Hourly Rate (USD)"
                      htmlFor="pkg-hourly"
                      helpText="Hourly rate used for mid-cycle proration (default: Monthly ÷ 672 hours)."
                    />
                    <input
                      id="pkg-hourly"
                      type="number"
                      min="0"
                      step="0.0001"
                      value={pkgForm.hourlyPriceUsd}
                      onChange={(e) => setPkgForm((f) => ({ ...f, hourlyPriceUsd: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Bandwidth (TB)"
                      htmlFor="pkg-bw"
                      helpText="Monthly outbound network transfer allowance displayed on the plan card."
                      align="right"
                    />
                    <input
                      id="pkg-bw"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={pkgForm.bandwidthTb}
                      onChange={(e) => setPkgForm((f) => ({ ...f, bandwidthTb: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Displayed vCPUs"
                      htmlFor="pkg-vcpu"
                      helpText="Number of virtual CPU cores advertised to customers in the UI."
                    />
                    <input
                      id="pkg-vcpu"
                      type="number"
                      min="1"
                      step="1"
                      value={pkgForm.displayedVcpus}
                      onChange={(e) =>
                        setPkgForm((f) => ({ ...f, displayedVcpus: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Displayed RAM (GB)"
                      htmlFor="pkg-ram"
                      helpText="Memory capacity advertised to customers (in GB)."
                    />
                    <input
                      id="pkg-ram"
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={pkgForm.displayedRamGb}
                      onChange={(e) =>
                        setPkgForm((f) => ({ ...f, displayedRamGb: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Displayed NVMe (GB)"
                      htmlFor="pkg-disk"
                      helpText="Disk size advertised to customers in Create Droplet."
                      align="right"
                    />
                    <input
                      id="pkg-disk"
                      type="number"
                      min="5"
                      step="5"
                      value={pkgForm.displayedStorageGb}
                      onChange={(e) =>
                        setPkgForm((f) => ({ ...f, displayedStorageGb: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200/80 bg-[#fafafa] p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      <Cpu className="h-3.5 w-3.5 text-[#1ED760]" />
                      <span>Backend Container Quota Defaults</span>
                      <HelpPopover
                        title="Hidden Backend Quotas"
                        text="These cgroup limits are enforced silently on host nodes and never shown to customers. You can also chart & tune them in Resource Allocation."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1">
                      <LabelWithHelp
                        label="CPU Quota %"
                        htmlFor="pkg-bcpu"
                        helpText="100% = 1 full host core. 200% = 2 cores. 50% = half core cap."
                      />
                      <input
                        id="pkg-bcpu"
                        type="number"
                        min="10"
                        step="10"
                        value={pkgForm.backendCpuQuotaPct}
                        onChange={(e) =>
                          setPkgForm((f) => ({ ...f, backendCpuQuotaPct: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <LabelWithHelp
                        label="Backend RAM (MB)"
                        htmlFor="pkg-bram"
                        helpText="Hard memory cgroup cap in MB (e.g. 1024 MB = 1 GB)."
                      />
                      <input
                        id="pkg-bram"
                        type="number"
                        min="128"
                        step="128"
                        value={pkgForm.backendRamMb}
                        onChange={(e) =>
                          setPkgForm((f) => ({ ...f, backendRamMb: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <LabelWithHelp
                        label="Backend Disk (GB)"
                        htmlFor="pkg-bdisk"
                        helpText="Actual filesystem quota allocated on the host node in GB."
                      />
                      <input
                        id="pkg-bdisk"
                        type="number"
                        min="5"
                        step="5"
                        value={pkgForm.backendStorageGb}
                        onChange={(e) =>
                          setPkgForm((f) => ({ ...f, backendStorageGb: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <LabelWithHelp
                        label="Burst RAM (MB)"
                        htmlFor="pkg-burst"
                        helpText="Temporary swap/burst headroom in MB before OOM killer triggers."
                        align="right"
                      />
                      <input
                        id="pkg-burst"
                        type="number"
                        min="0"
                        step="64"
                        value={pkgForm.burstRamMb}
                        onChange={(e) =>
                          setPkgForm((f) => ({ ...f, burstRamMb: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Sort Order"
                      htmlFor="pkg-sort"
                      helpText="Controls left-to-right display order in the catalog (lower numbers appear first)."
                    />
                    <input
                      id="pkg-sort"
                      type="number"
                      value={pkgForm.sortOrder}
                      onChange={(e) => setPkgForm((f) => ({ ...f, sortOrder: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(pkgForm.enabled)}
                        onChange={(e) =>
                          setPkgForm((f) => ({ ...f, enabled: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[#1ED760]"
                      />
                      <span>Enabled in Storefront</span>
                      <HelpPopover
                        title="Enabled in Storefront"
                        text="Uncheck to hide this package from new Create Droplet orders without deleting existing customer billing."
                      />
                    </label>
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(pkgForm.popular)}
                        onChange={(e) =>
                          setPkgForm((f) => ({ ...f, popular: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[#1ED760]"
                      />
                      <span>Mark Popular</span>
                      <HelpPopover
                        title="Mark Popular"
                        text="Highlights this tier as recommended in the customer droplet selector."
                        align="right"
                      />
                    </label>
                  </div>
                </div>
              </CardContent>

              <div className="flex items-center justify-end gap-2 border-t border-neutral-200/80 px-5 py-3.5 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPkgModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={saving}>
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : editingPkg ? 'Save Changes' : 'Create Package'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Create / Edit OS Image Modal */}
      {imgModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => !saving && setImgModalOpen(false)}
        >
          <Card
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex-row items-start justify-between border-b border-neutral-200/80 dark:border-neutral-800">
              <div>
                <CardTitle>
                  {editingImg ? `Edit Image: ${editingImg.name}` : 'Add Custom OS / App Image'}
                </CardTitle>
                <CardDescription className="mt-1">
                  Configure OS availability and monthly licensing surcharge for Create Droplet.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => !saving && setImgModalOpen(false)}
                aria-label="Close OS image modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <form onSubmit={handleSaveImageModal}>
              <CardContent className="space-y-3.5 pt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Image Slug ID"
                      htmlFor="img-id"
                      required
                      helpText="Unique ID used when provisioning droplets (e.g. ubuntu-24, debian-12, custom-cpanel)."
                    />
                    <input
                      id="img-id"
                      type="text"
                      required
                      disabled={Boolean(editingImg)}
                      value={imgForm.id}
                      onChange={(e) => setImgForm((f) => ({ ...f, id: e.target.value }))}
                      placeholder="e.g. debian-12"
                      className={`${inputCls} disabled:opacity-60`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Display Name"
                      htmlFor="img-name"
                      required
                      helpText="Name shown on the OS card in Create Droplet."
                      align="right"
                    />
                    <input
                      id="img-name"
                      type="text"
                      required
                      value={imgForm.name}
                      onChange={(e) => setImgForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Debian 12"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="OS Family"
                      htmlFor="img-os"
                      helpText="Distribution or stack family label (e.g. Ubuntu, Debian, Docker, cPanel)."
                    />
                    <input
                      id="img-os"
                      type="text"
                      value={imgForm.os}
                      onChange={(e) => setImgForm((f) => ({ ...f, os: e.target.value }))}
                      placeholder="Ubuntu"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Version / Subtitle"
                      htmlFor="img-ver"
                      helpText="Secondary text under the OS title (e.g. Bookworm Stable)."
                      align="right"
                    />
                    <input
                      id="img-ver"
                      type="text"
                      value={imgForm.version}
                      onChange={(e) => setImgForm((f) => ({ ...f, version: e.target.value }))}
                      placeholder="24.04 LTS · Noble Numbat"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Image Type"
                      htmlFor="img-type"
                      helpText="Base OS appears under operating systems; 1-Click App appears under pre-built app stacks."
                    />
                    <select
                      id="img-type"
                      value={imgForm.type}
                      onChange={(e) => setImgForm((f) => ({ ...f, type: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="os">Base OS</option>
                      <option value="app">1-Click App / Add-on</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Monthly Surcharge (USD)"
                      htmlFor="img-surcharge"
                      helpText="Optional monthly USD add-on fee added to the droplet cost. Set 0 for free."
                      align="right"
                    />
                    <input
                      id="img-surcharge"
                      type="number"
                      min="0"
                      step="0.5"
                      value={imgForm.monthlySurchargeUsd}
                      onChange={(e) =>
                        setImgForm((f) => ({ ...f, monthlySurchargeUsd: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <LabelWithHelp
                    label="Runtime Image Reference"
                    htmlFor="img-runtime"
                    helpText="Container/LXC/VM template tag pulled by cluster nodes when launching this OS."
                  />
                  <input
                    id="img-runtime"
                    type="text"
                    value={imgForm.runtimeImage}
                    onChange={(e) => setImgForm((f) => ({ ...f, runtimeImage: e.target.value }))}
                    placeholder="tiwlo-ubuntu-shared-runtime:24.04"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Badge Label"
                      htmlFor="img-badge"
                      helpText="Short pill shown on the OS card (e.g. Available, LTS, Paid Add-on)."
                    />
                    <input
                      id="img-badge"
                      type="text"
                      value={imgForm.badge}
                      onChange={(e) => setImgForm((f) => ({ ...f, badge: e.target.value }))}
                      placeholder="Available"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      label="Icon URL"
                      htmlFor="img-icon"
                      helpText="Relative or absolute path to the OS SVG/PNG icon."
                      align="right"
                    />
                    <input
                      id="img-icon"
                      type="text"
                      value={imgForm.iconUrl}
                      onChange={(e) => setImgForm((f) => ({ ...f, iconUrl: e.target.value }))}
                      placeholder="/os-icons/ubuntu.svg"
                      className={inputCls}
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 pt-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(imgForm.available)}
                    onChange={(e) => setImgForm((f) => ({ ...f, available: e.target.checked }))}
                    className="h-4 w-4 accent-[#1ED760]"
                  />
                  <span>Available in Create Droplet Marketplace</span>
                  <HelpPopover
                    title="Available in Create Droplet"
                    text="Only available=true images appear to customers in Create Droplet."
                  />
                </label>
              </CardContent>

              <div className="flex items-center justify-end gap-2 border-t border-neutral-200/80 px-5 py-3.5 dark:border-neutral-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setImgModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={saving}>
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : editingImg ? 'Save Image' : 'Add Image'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => !saving && setDeleteTarget(null)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>
                Delete {deleteTarget.kind === 'package' ? 'Server Package' : 'OS Image'}?
              </CardTitle>
              <CardDescription>
                This will remove <strong>{deleteTarget.item.name}</strong> ({deleteTarget.item.id}) from the catalog. Existing running droplets keep their billing snapshot.
              </CardDescription>
            </CardHeader>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-200/80 px-5 py-3.5 dark:border-neutral-800">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={saving}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
