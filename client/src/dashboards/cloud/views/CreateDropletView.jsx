import React, { useEffect, useMemo, useState } from 'react';
import { sanitizeHttpUrl } from '../../../utils/safeHtml.js';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Minus,
  Plus,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/shadcnPrimitives';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';

const WIZARD_STEPS = [
  { id: 1, title: 'OS / Add-on Image', shortTitle: 'OS & Add-ons' },
  { id: 2, title: 'Choose Region', shortTitle: 'Region' },
  { id: 3, title: 'Machine Plan', shortTitle: 'Machine Plan' },
  { id: 4, title: 'Credentials, Hostname & Deploy', shortTitle: 'Credentials & Deploy' },
];

const MACHINE_FAMILIES = [
  'All',
  'Standard',
  'CPU Optimized',
  'Memory Optimized',
  'Storage NVMe',
  'Custom Build',
];
const PLANS_PER_PAGE = 5;

const DEFAULT_REGIONS = [
  { id: 'dhk1', name: 'Dhaka', country: 'Bangladesh', flagUrl: '/flags/bd.svg', code: 'DHK1', available: true },
  { id: 'sgp1', name: 'Singapore', country: 'Singapore', flagUrl: '/flags/sg.svg', code: 'SGP1', available: false },
  { id: 'fra1', name: 'Frankfurt', country: 'Germany', flagUrl: '/flags/de.svg', code: 'FRA1', available: false },
  { id: 'nyc1', name: 'New York', country: 'United States', flagUrl: '/flags/us.svg', code: 'NYC1', available: false },
  { id: 'lon1', name: 'London', country: 'United Kingdom', flagUrl: '/flags/gb.svg', code: 'LON1', available: false },
  { id: 'tyo1', name: 'Tokyo', country: 'Japan', flagUrl: '/flags/jp.svg', code: 'TYO1', available: false },
  { id: 'tor1', name: 'Toronto', country: 'Canada', flagUrl: '/flags/ca.svg', code: 'TOR1', available: false },
];

const DEFAULT_IMAGES = [
  {
    id: 'ubuntu-24',
    name: 'Ubuntu 24.04 LTS',
    os: 'Ubuntu',
    version: '24.04 LTS · Noble Numbat',
    type: 'os',
    badge: 'Available',
    iconUrl: '/os-icons/ubuntu.svg',
    runtimeImage: 'tiwlo-ubuntu-shared-runtime:24.04',
    monthlySurchargeUsd: 0,
    available: true,
  },
];

const DEFAULT_PACKAGES = [
  { id: 'std-nano', name: 'e2-micro · Standard', family: 'Standard', vcpus: 1, memory: '1 GB', storage: '25 GB NVMe', monthlyPrice: 4 },
  { id: 'std-basic', name: 'e2-small · Standard', family: 'Standard', vcpus: 1, memory: '2 GB', storage: '40 GB NVMe', monthlyPrice: 6 },
  { id: 'std-pro', name: 'e2-medium · Standard', family: 'Standard', vcpus: 2, memory: '4 GB', storage: '80 GB NVMe', monthlyPrice: 18, badge: 'Popular' },
  { id: 'std-plus', name: 'e2-standard-4', family: 'Standard', vcpus: 4, memory: '8 GB', storage: '160 GB NVMe', monthlyPrice: 36 },
  { id: 'cpu-2', name: 'c3-highcpu-2', family: 'CPU Optimized', vcpus: 2, memory: '2 GB', storage: '50 GB NVMe', monthlyPrice: 14 },
  { id: 'cpu-4', name: 'c3-highcpu-4', family: 'CPU Optimized', vcpus: 4, memory: '4 GB', storage: '100 GB NVMe', monthlyPrice: 28 },
  { id: 'cpu-8', name: 'c3-highcpu-8', family: 'CPU Optimized', vcpus: 8, memory: '8 GB', storage: '160 GB NVMe', monthlyPrice: 56 },
  { id: 'mem-2', name: 'm3-highmem-2', family: 'Memory Optimized', vcpus: 2, memory: '16 GB', storage: '80 GB NVMe', monthlyPrice: 32 },
  { id: 'mem-4', name: 'm3-highmem-4', family: 'Memory Optimized', vcpus: 4, memory: '32 GB', storage: '160 GB NVMe', monthlyPrice: 64 },
  { id: 'nvme-2', name: 'n2-storage-2', family: 'Storage NVMe', vcpus: 2, memory: '4 GB', storage: '250 GB NVMe', monthlyPrice: 24 },
  { id: 'nvme-4', name: 'n2-storage-4', family: 'Storage NVMe', vcpus: 4, memory: '8 GB', storage: '500 GB NVMe', monthlyPrice: 48 },
];

const DEFAULT_CUSTOM_BUILDER = {
  enabled: false,
  minVcpus: 1,
  maxVcpus: 32,
  stepVcpus: 1,
  minRamGb: 1,
  maxRamGb: 128,
  stepRamGb: 1,
  minStorageGb: 25,
  maxStorageGb: 1000,
  stepStorageGb: 5,
  extraStorageStepGb: 25,
  maxExtraStorageGb: 1000,
  baseMonthlyFeeUsd: 0,
  pricePerVcpuMonthly: 2.5,
  pricePerGbRamMonthly: 1.5,
  pricePerGbStorageMonthly: 0.1,
};

function roundMoney(val) {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

function formatUsd(amount) {
  const num = roundMoney(Number(amount) || 0);
  return Number.isInteger(num) ? `$${num}` : `$${num.toFixed(2)}`;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function normalizeCustomBuilder(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_CUSTOM_BUILDER;
  const minVcpus = Math.max(1, Number(raw.minVcpus ?? DEFAULT_CUSTOM_BUILDER.minVcpus));
  const maxVcpus = Math.max(minVcpus, Number(raw.maxVcpus ?? DEFAULT_CUSTOM_BUILDER.maxVcpus));
  const minRamGb = Math.max(1, Number(raw.minRamGb ?? DEFAULT_CUSTOM_BUILDER.minRamGb));
  const maxRamGb = Math.max(minRamGb, Number(raw.maxRamGb ?? DEFAULT_CUSTOM_BUILDER.maxRamGb));
  const minStorageGb = Math.max(10, Number(raw.minStorageGb ?? DEFAULT_CUSTOM_BUILDER.minStorageGb));
  const maxStorageGb = Math.max(minStorageGb, Number(raw.maxStorageGb ?? DEFAULT_CUSTOM_BUILDER.maxStorageGb));

  return {
    enabled: raw.enabled === true,
    minVcpus,
    maxVcpus,
    stepVcpus: Math.max(1, Number(raw.stepVcpus ?? 1)),
    minRamGb,
    maxRamGb,
    stepRamGb: Math.max(1, Number(raw.stepRamGb ?? 1)),
    minStorageGb,
    maxStorageGb,
    stepStorageGb: Math.max(1, Number(raw.stepStorageGb ?? 5)),
    extraStorageStepGb: Math.max(5, Number(raw.extraStorageStepGb ?? raw.addonStorageStepGb ?? 25)),
    maxExtraStorageGb: Math.max(0, Number(raw.maxExtraStorageGb ?? raw.maxAddonStorageGb ?? 1000)),
    baseMonthlyFeeUsd: Math.max(0, Number(raw.baseMonthlyFeeUsd ?? raw.basePriceUsd ?? 0)),
    pricePerVcpuMonthly: Math.max(
      0,
      Number(
        raw.pricePerVcpuMonthly ??
          raw.vcpuMonthlyPriceUsd ??
          raw.vcpuPricePerMonth ??
          raw.cpuPricePerMonth ??
          raw.pricePerVcpu ??
          DEFAULT_CUSTOM_BUILDER.pricePerVcpuMonthly
      )
    ),
    pricePerGbRamMonthly: Math.max(
      0,
      Number(
        raw.pricePerGbRamMonthly ??
          raw.ramGbMonthlyPriceUsd ??
          raw.ramPricePerGbMonth ??
          raw.pricePerRamGb ??
          raw.memoryPricePerGb ??
          DEFAULT_CUSTOM_BUILDER.pricePerGbRamMonthly
      )
    ),
    pricePerGbStorageMonthly: Math.max(
      0,
      Number(
        raw.pricePerGbStorageMonthly ??
          raw.storageGbMonthlyPriceUsd ??
          raw.storagePricePerGbMonth ??
          raw.pricePerStorageGb ??
          raw.nvmePricePerGb ??
          DEFAULT_CUSTOM_BUILDER.pricePerGbStorageMonthly
      )
    ),
  };
}

function normalizeFamily(rawFamily) {
  const val = String(rawFamily || '').toLowerCase();
  if (val.includes('cpu') || val.includes('compute')) return 'CPU Optimized';
  if (val.includes('mem') || val.includes('ram')) return 'Memory Optimized';
  if (val.includes('stor') || val.includes('nvme') || val.includes('disk')) return 'Storage NVMe';
  return 'Standard';
}

function normalizePackages(rawPackages) {
  if (!Array.isArray(rawPackages) || rawPackages.length === 0) return DEFAULT_PACKAGES;
  const normalized = rawPackages
    .filter((pkg) => pkg && pkg.available !== false && pkg.enabled !== false && pkg.active !== false)
    .map((pkg, idx) => {
      const vcpus = Math.max(
        1,
        Number(pkg.displayedVcpus ?? pkg.vcpus ?? pkg.cpu ?? pkg.cores ?? 1)
      );
      const rawMem = pkg.displayedRamGb ?? pkg.memory ?? pkg.memoryGb ?? pkg.ramGb ?? pkg.ram;
      const memory =
        typeof rawMem === 'number'
          ? `${rawMem} GB`
          : String(rawMem || '1 GB').trim();
      const rawStorage =
        pkg.displayedStorageGb ?? pkg.storage ?? pkg.storageGb ?? pkg.diskGb ?? pkg.disk;
      const storage =
        typeof rawStorage === 'number'
          ? `${rawStorage} GB NVMe`
          : String(rawStorage || '25 GB NVMe').trim();
      const monthlyPrice = Math.max(
        0,
        Number(pkg.monthlyPriceUsd ?? pkg.monthlyPrice ?? pkg.priceUsd ?? pkg.price ?? 4)
      );
      return {
        id: String(pkg.id || pkg.packageId || pkg.slug || `pkg-${idx + 1}`),
        name: String(pkg.name || pkg.planName || pkg.title || `Plan ${idx + 1}`),
        family: normalizeFamily(pkg.family || pkg.category || pkg.machineFamily || pkg.tierFamily),
        vcpus,
        memory: /\b(mb|gb|tb)\b/i.test(memory) ? memory : `${memory} GB`,
        storage: /\b(gb|tb)\b/i.test(storage) ? storage : `${storage} GB NVMe`,
        monthlyPrice,
        badge: pkg.badge || (pkg.popular || pkg.recommended ? 'Popular' : ''),
      };
    });

  return normalized.length > 0 ? normalized : DEFAULT_PACKAGES;
}

function resolveOsIcon(img) {
  const safeIcon = sanitizeHttpUrl(img?.iconUrl, { allowRelative: true });
  if (safeIcon) return safeIcon;
  const hint = `${img?.id || ''} ${img?.os || ''} ${img?.name || ''}`.toLowerCase();
  if (hint.includes('ubuntu')) return '/os-icons/ubuntu.svg';
  if (hint.includes('debian')) return '/os-icons/debian.svg';
  if (hint.includes('alma')) return '/os-icons/almalinux.svg';
  if (hint.includes('fedora')) return '/os-icons/fedora.svg';
  if (hint.includes('docker')) return '/os-icons/docker.svg';
  if (hint.includes('nginx') || hint.includes('lemp')) return '/os-icons/nginx.svg';
  if (hint.includes('node')) return '/os-icons/nodejs.svg';
  return '';
}

function generateStrongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export default function CreateDropletView({
  onBack,
  onDropletCreated,
  showToast,
  initialImage = 'Ubuntu 24.04 LTS',
}) {
  const [step, setStep] = useState(1);
  const [regions, setRegions] = useState(DEFAULT_REGIONS);
  const [images, setImages] = useState(DEFAULT_IMAGES);
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [customBuilder, setCustomBuilder] = useState(DEFAULT_CUSTOM_BUILDER);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [selectedRegion, setSelectedRegion] = useState(
    () => DEFAULT_REGIONS.find((r) => r.available) || DEFAULT_REGIONS[0]
  );
  const [selectedImage, setSelectedImage] = useState(
    () =>
      DEFAULT_IMAGES.find(
        (img) =>
          img.available &&
          (img.id === initialImage || img.name.toLowerCase() === String(initialImage).toLowerCase())
      ) ||
      DEFAULT_IMAGES.find((img) => img.available) ||
      null
  );
  const [selectedTier, setSelectedTier] = useState(DEFAULT_PACKAGES[0]);
  const [activeFamilyTab, setActiveFamilyTab] = useState('All');
  const [planPage, setPlanPage] = useState(1);

  const [customVcpus, setCustomVcpus] = useState(2);
  const [customRamGb, setCustomRamGb] = useState(4);
  const [customStorageGb, setCustomStorageGb] = useState(50);
  const [customExtraStorageGb, setCustomExtraStorageGb] = useState(0);

  const [hostname, setHostname] = useState(
    () => `tiwlo-dhk1-${Math.floor(100 + Math.random() * 900)}`
  );
  const [serverUsername, setServerUsername] = useState('root');
  const [serverPassword, setServerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tags, setTags] = useState('production, web');
  const [enableBackups, setEnableBackups] = useState(false);
  const [enableIpv6, setEnableIpv6] = useState(true);
  const [enableMonitoring, setEnableMonitoring] = useState(true);

  const [availability, setAvailability] = useState({
    checking: false,
    queriedKey: '',
    hostname: null,
    username: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let active = true;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('stockpro_session') : null;
    fetch(`${API_BASE}/cloud/droplets/catalog`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.success) return;

        if (Array.isArray(data.regions) && data.regions.length > 0) {
          setRegions(data.regions);
          setSelectedRegion((prev) => {
            const matching = prev && data.regions.find((r) => r.id === prev.id && r.available);
            return matching || data.regions.find((r) => r.available) || data.regions[0];
          });
        }

        if (Array.isArray(data.images) && data.images.length > 0) {
          setImages(data.images);
          const avail = data.images.filter((img) => img.available === true);
          setSelectedImage((prev) => {
            const matchPrev = prev && avail.find((img) => img.id === prev.id);
            if (matchPrev) return matchPrev;
            const matchInitial = avail.find(
              (img) =>
                img.id === initialImage ||
                img.name.toLowerCase() === String(initialImage || '').toLowerCase()
            );
            return matchInitial || avail[0] || null;
          });
        }

        if (Array.isArray(data.packages) && data.packages.length > 0) {
          const nextPackages = normalizePackages(data.packages);
          setPackages(nextPackages);
          setSelectedTier((prev) => {
            const match = prev && nextPackages.find((p) => p.id === prev.id);
            return match || nextPackages[0];
          });
        }

        if (data.customBuilder !== undefined) {
          const cb = normalizeCustomBuilder(data.customBuilder);
          setCustomBuilder(cb);
          setCustomVcpus((v) => clamp(v, cb.minVcpus, cb.maxVcpus));
          setCustomRamGb((r) => clamp(r, cb.minRamGb, cb.maxRamGb));
          setCustomStorageGb((s) => clamp(s, cb.minStorageGb, cb.maxStorageGb));
          setCustomExtraStorageGb((e) => clamp(e, 0, cb.maxExtraStorageGb));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCatalogLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [initialImage]);

  const availableImages = useMemo(
    () => images.filter((img) => img.available === true),
    [images]
  );

  const isCustomTab = activeFamilyTab === 'Custom Build';
  const isCustomActive = isCustomTab && customBuilder.enabled === true;

  const filteredPackages = useMemo(() => {
    if (isCustomTab) return [];
    if (activeFamilyTab === 'All') return packages;
    return packages.filter((pkg) => pkg.family === activeFamilyTab);
  }, [packages, activeFamilyTab, isCustomTab]);

  const totalPlanPages = Math.max(1, Math.ceil(filteredPackages.length / PLANS_PER_PAGE));
  const safePlanPage = Math.min(planPage, totalPlanPages);
  const paginatedPackages = useMemo(() => {
    const start = (safePlanPage - 1) * PLANS_PER_PAGE;
    return filteredPackages.slice(start, start + PLANS_PER_PAGE);
  }, [filteredPackages, safePlanPage]);

  const cleanHostname = hostname.trim().toLowerCase();
  const cleanUsername = serverUsername.trim().toLowerCase();
  const validHostnameFormat = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(cleanHostname);
  const validUsernameFormat = /^[a-z_][a-z0-9_-]{1,31}$/.test(cleanUsername);

  useEffect(() => {
    const queryKey = `${cleanHostname}|${cleanUsername}`;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability((prev) => ({ ...prev, checking: true }));
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('stockpro_session') : null;
        const params = new URLSearchParams({
          hostname: cleanHostname,
          username: cleanUsername,
        });
        const res = await fetch(`${API_BASE}/cloud/droplets/check-availability?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (!controller.signal.aborted && data?.success) {
          setAvailability({
            checking: false,
            queriedKey: queryKey,
            hostname: data.hostname || null,
            username: data.username || null,
          });
        } else if (!controller.signal.aborted) {
          setAvailability((prev) => ({ ...prev, checking: false }));
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setAvailability((prev) => ({ ...prev, checking: false }));
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cleanHostname, cleanUsername]);

  const hostnameCheck = availability.hostname?.value === cleanHostname ? availability.hostname : null;
  const usernameCheck = availability.username?.value === cleanUsername ? availability.username : null;
  const hostnameTaken = Boolean(hostnameCheck && hostnameCheck.valid && !hostnameCheck.available);
  const validHostname = validHostnameFormat && !hostnameTaken;
  const validUsername = validUsernameFormat && (!usernameCheck || usernameCheck.valid);
  const validPassword = serverPassword.length >= 8;

  // Custom Build breakdown (Pure Monthly Billing)
  const customTotalStorageGb = customStorageGb + customExtraStorageGb;
  const customCpuMonthly = roundMoney(customVcpus * customBuilder.pricePerVcpuMonthly);
  const customRamMonthly = roundMoney(customRamGb * customBuilder.pricePerGbRamMonthly);
  const customStorageMonthly = roundMoney(customTotalStorageGb * customBuilder.pricePerGbStorageMonthly);
  const customPlanMonthly = roundMoney(
    customBuilder.baseMonthlyFeeUsd + customCpuMonthly + customRamMonthly + customStorageMonthly
  );

  const activePlan = isCustomTab
    ? isCustomActive
      ? {
          id: 'custom',
          name: 'Custom Build',
          vcpus: customVcpus,
          memory: `${customRamGb} GB`,
          storage: `${customTotalStorageGb} GB NVMe`,
          monthlyPrice: customPlanMonthly,
        }
      : null
    : selectedTier;

  const baseMonthly = Number(activePlan?.monthlyPrice) || 0;
  const imageSurcharge = Number(selectedImage?.monthlySurchargeUsd) || 0;
  const backupMonthly = enableBackups ? 3 : 0;
  const totalMonthly = roundMoney(baseMonthly + imageSurcharge + backupMonthly);

  const canCreate = Boolean(
    selectedImage?.available &&
      selectedRegion?.available &&
      activePlan &&
      validHostname &&
      validUsername &&
      validPassword &&
      !availability.checking &&
      !submitting
  );

  const canAdvanceFromStep = (targetStep) => {
    if (targetStep === 1) return Boolean(selectedImage?.available);
    if (targetStep === 2) return Boolean(selectedRegion?.available);
    if (targetStep === 3) return Boolean(activePlan);
    return true;
  };

  const handleSelectRegion = (region) => {
    if (!region.available) return;
    setSelectedRegion(region);
    setHostname((previous) => {
      if (!previous.startsWith('tiwlo-')) return previous;
      const suffix = previous.split('-').at(-1);
      return `tiwlo-${region.code.toLowerCase()}-${suffix || Math.floor(100 + Math.random() * 900)}`;
    });
  };

  const handleNext = () => {
    if (step < 4 && canAdvanceFromStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      onBack?.();
    }
  };

  const handleStepJump = (targetId) => {
    if (targetId <= step) {
      setStep(targetId);
      return;
    }
    for (let s = 1; s < targetId; s += 1) {
      if (!canAdvanceFromStep(s)) return;
    }
    setStep(targetId);
  };

  const handleCreateDroplet = async () => {
    setSubmitError('');
    if (!selectedImage?.available) {
      setSubmitError('Please select an available OS or add-on image.');
      setStep(1);
      return;
    }
    if (!selectedRegion?.available) {
      setSubmitError('Please select an available region.');
      setStep(2);
      return;
    }
    if (!activePlan) {
      setSubmitError('Please select an active machine plan.');
      setStep(3);
      return;
    }
    if (!validHostnameFormat) {
      setSubmitError('Hostname must be 3–63 characters (lowercase letters, numbers, or hyphens).');
      return;
    }
    if (hostnameTaken) {
      setSubmitError(hostnameCheck?.reason || 'Hostname is already used in your account.');
      return;
    }
    if (!validUsername) {
      setSubmitError('Server username must be 2–32 characters (lowercase letters, numbers, underscore, or hyphen).');
      return;
    }
    if (!validPassword) {
      setSubmitError('Server login password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('stockpro_session') : null;
      const res = await fetch(`${API_BASE}/cloud/droplets`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          packageId: activePlan.id,
          imageId: selectedImage.id,
          image: selectedImage.name,
          regionId: selectedRegion.id,
          regionCode: selectedRegion.code,
          region: selectedRegion.name,
          hostname: cleanHostname,
          username: cleanUsername,
          password: serverPassword,
          tags: tags.trim(),
          vcpus: activePlan.vcpus,
          memory: activePlan.memory,
          storage: activePlan.storage,
          enableBackups,
          enableIpv6,
          enableMonitoring,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Provisioning failed (${res.status}).`);
      }
      showToast?.(`Droplet ${json.droplet?.name || cleanHostname} provisioned with ${selectedImage.name}.`, 'success');
      onDropletCreated?.(json);
    } catch (err) {
      const message = err.message || 'Could not create droplet.';
      setSubmitError(message);
      showToast?.(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStepMeta = WIZARD_STEPS.find((s) => s.id === step) || WIZARD_STEPS[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-24">
      {/* Compact Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 px-2.5">
            <ArrowLeft className="size-4" aria-hidden="true" />
            My Droplets
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-2xl">
            Create Droplet
          </h1>
        </div>
        <Badge variant="brand" className="px-3 py-1 text-xs">
          Monthly Billing · {formatUsd(totalMonthly)}/mo
        </Badge>
      </header>

      {/* Clean 4-Step Borderless Stepper */}
      <nav
        aria-label="Create droplet steps"
        className="grid grid-cols-2 gap-1.5 rounded-2xl bg-neutral-100/80 p-1.5 dark:bg-neutral-900/80 sm:grid-cols-4"
      >
        {WIZARD_STEPS.map((item) => {
          const isCurrent = item.id === step;
          const isCompleted = item.id < step;
          const reachable = item.id <= step || (item.id === step + 1 && canAdvanceFromStep(step));
          return (
            <button
              key={item.id}
              type="button"
              disabled={!reachable}
              onClick={() => handleStepJump(item.id)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                isCurrent
                  ? 'bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white'
                  : isCompleted
                    ? 'text-neutral-800 hover:bg-white/60 dark:text-neutral-200 dark:hover:bg-neutral-800/60 cursor-pointer'
                    : reachable
                      ? 'text-neutral-600 hover:bg-white/50 dark:text-neutral-400 dark:hover:bg-neutral-800/50 cursor-pointer'
                      : 'cursor-not-allowed text-neutral-400 opacity-60 dark:text-neutral-500'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isCurrent
                    ? 'bg-[#1ed760] text-black'
                    : isCompleted
                      ? 'bg-[#1ed760]/20 text-[#0f7a37] dark:text-[#1ed760]'
                      : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                }`}
              >
                {isCompleted ? <Check className="size-3.5" aria-hidden="true" /> : item.id}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.shortTitle}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Main Content + Compact Live Summary */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Active Step Canvas */}
        <section className="rounded-2xl bg-neutral-50/90 p-5 dark:bg-neutral-900/55 sm:p-6 lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Step {step} of 4
              </p>
              <h2 className="text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                {currentStepMeta.title}
              </h2>
            </div>
            {step === 1 && (
              <Badge variant="secondary">
                {availableImages.length} {availableImages.length === 1 ? 'image active' : 'images active'}
              </Badge>
            )}
            {step === 3 && !isCustomTab && (
              <Badge variant="secondary">
                {filteredPackages.length} {filteredPackages.length === 1 ? 'plan' : 'plans'}
              </Badge>
            )}
            {step === 3 && isCustomTab && (
              <Badge variant={customBuilder.enabled ? 'brand' : 'secondary'}>
                {customBuilder.enabled ? 'Custom Builder Active' : 'Disabled by Admin'}
              </Badge>
            )}
          </div>

          <Separator className="mb-5" />

          {/* STEP 1: OS / ADD-ON IMAGE */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {availableImages.length === 0 ? (
                <Alert variant="warning">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">No active OS or add-on images available</p>
                    <p className="mt-0.5 opacity-85">
                      Ask an administrator to enable an OS image or server add-on on a connected host.
                    </p>
                  </div>
                </Alert>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {availableImages.map((image) => {
                    const active = selectedImage?.id === image.id;
                    const iconUrl = resolveOsIcon(image);
                    const surcharge = Number(image.monthlySurchargeUsd) || 0;
                    const isAddon = image.type && image.type !== 'os';
                    return (
                      <button
                        key={image.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedImage(image)}
                        className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left transition cursor-pointer ${
                          active
                            ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                            : 'bg-white text-neutral-900 hover:bg-neutral-100/90 dark:bg-neutral-800/75 dark:text-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                              active
                                ? 'bg-white/15 dark:bg-neutral-900/10'
                                : 'bg-neutral-100 dark:bg-neutral-900'
                            }`}
                          >
                            {iconUrl ? (
                              <img
                                src={iconUrl}
                                alt=""
                                className={`size-5 object-contain ${
                                  iconUrl.includes('almalinux') && !active ? 'dark:invert' : ''
                                }`}
                              />
                            ) : (
                              <Layers className="size-4 text-[#1ed760]" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold">{image.name}</span>
                              {isAddon && (
                                <Badge variant={active ? 'brand' : 'secondary'} className="text-[10px]">
                                  Add-on
                                </Badge>
                              )}
                            </div>
                            <p
                              className={`truncate text-xs ${
                                active
                                  ? 'text-white/70 dark:text-neutral-600'
                                  : 'text-neutral-500 dark:text-neutral-400'
                              }`}
                            >
                              {image.version || image.os || 'Server runtime'}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              surcharge > 0
                                ? active
                                  ? 'text-[#1ed760] dark:text-[#0f7a37]'
                                  : 'text-[#0f7a37] dark:text-[#1ed760]'
                                : active
                                  ? 'text-white/70 dark:text-neutral-600'
                                  : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                          >
                            {surcharge > 0 ? `+${formatUsd(surcharge)}/mo` : 'Included'}
                          </span>
                          {active && (
                            <span className="flex size-5 items-center justify-center rounded-full bg-[#1ed760] text-black">
                              <Check className="size-3" aria-hidden="true" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {catalogLoaded && availableImages.length === 1 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  1 image is currently enabled on your connected server. Additional OS distributions and add-on images appear automatically when enabled by Admin.
                </p>
              )}
            </div>
          )}

          {/* STEP 2: REGION */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {regions.map((region) => {
                const disabled = !region.available;
                const active = selectedRegion?.id === region.id && !disabled;
                return (
                  <button
                    key={region.id}
                    type="button"
                    disabled={disabled}
                    aria-disabled={disabled}
                    aria-pressed={active}
                    onClick={() => handleSelectRegion(region)}
                    className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-left transition ${
                      disabled
                        ? 'cursor-not-allowed bg-neutral-100/70 text-neutral-400 opacity-55 dark:bg-neutral-800/35 dark:text-neutral-500'
                        : active
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 cursor-pointer'
                          : 'bg-white text-neutral-900 hover:bg-neutral-100/90 dark:bg-neutral-800/75 dark:text-neutral-100 dark:hover:bg-neutral-800 cursor-pointer'
                    }`}
                  >
                    {region.flagUrl ? (
                      <img
                        src={region.flagUrl}
                        alt=""
                        className="h-[18px] w-[24px] shrink-0 rounded-[3px] object-cover"
                      />
                    ) : (
                      <Globe className="size-5 shrink-0 text-neutral-400" aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-bold">{region.name}</span>
                        {active && (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1ed760] text-black">
                            <Check className="size-2.5" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <p
                        className={`truncate text-xs ${
                          disabled
                            ? 'text-neutral-400 dark:text-neutral-500'
                            : active
                              ? 'text-white/70 dark:text-neutral-600'
                              : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {region.code} · {disabled ? 'Unavailable' : region.country || 'Online'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3: GOOGLE CLOUD-STYLE MACHINE PLAN SELECTOR */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <Tabs
                value={activeFamilyTab}
                onValueChange={(nextFamily) => {
                  setActiveFamilyTab(nextFamily);
                  setPlanPage(1);
                }}
              >
                <TabsList className="w-full justify-start bg-neutral-200/70 dark:bg-neutral-800/80">
                  {MACHINE_FAMILIES.map((family) => (
                    <TabsTrigger key={family} value={family}>
                      {family === 'Custom Build' && (
                        <SlidersHorizontal className="size-3" aria-hidden="true" />
                      )}
                      {family}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {isCustomTab ? (
                customBuilder.enabled !== true ? (
                  <Alert variant="warning" className="border-0 bg-amber-500/10">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        Unavailable — Custom configuration is currently disabled by the administrator.
                      </p>
                      <p className="mt-1 opacity-85">
                        Select a fixed machine family tab (such as Standard or CPU Optimized) to continue.
                      </p>
                    </div>
                  </Alert>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Flat Sliders / Steppers */}
                    <div className="flex flex-col gap-3">
                      {/* vCPUs */}
                      <div className="rounded-xl bg-white px-4 py-3 dark:bg-neutral-800/75">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              vCPUs
                            </span>
                            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {formatUsd(customBuilder.pricePerVcpuMonthly)}/vCPU/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Decrease vCPUs"
                              disabled={customVcpus <= customBuilder.minVcpus}
                              onClick={() =>
                                setCustomVcpus((v) =>
                                  clamp(v - customBuilder.stepVcpus, customBuilder.minVcpus, customBuilder.maxVcpus)
                                )
                              }
                              className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 cursor-pointer"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-16 text-center font-mono text-sm font-bold text-neutral-950 dark:text-white">
                              {customVcpus} vCPU
                            </span>
                            <button
                              type="button"
                              aria-label="Increase vCPUs"
                              disabled={customVcpus >= customBuilder.maxVcpus}
                              onClick={() =>
                                setCustomVcpus((v) =>
                                  clamp(v + customBuilder.stepVcpus, customBuilder.minVcpus, customBuilder.maxVcpus)
                                )
                              }
                              className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 cursor-pointer"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="range"
                          aria-label="vCPUs slider"
                          min={customBuilder.minVcpus}
                          max={customBuilder.maxVcpus}
                          step={customBuilder.stepVcpus}
                          value={customVcpus}
                          onChange={(e) => setCustomVcpus(Number(e.target.value))}
                          className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#1ed760] dark:bg-neutral-700"
                        />
                      </div>

                      {/* RAM (GB) */}
                      <div className="rounded-xl bg-white px-4 py-3 dark:bg-neutral-800/75">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              RAM (GB)
                            </span>
                            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {formatUsd(customBuilder.pricePerGbRamMonthly)}/GB/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Decrease RAM"
                              disabled={customRamGb <= customBuilder.minRamGb}
                              onClick={() =>
                                setCustomRamGb((r) =>
                                  clamp(r - customBuilder.stepRamGb, customBuilder.minRamGb, customBuilder.maxRamGb)
                                )
                              }
                              className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 cursor-pointer"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-16 text-center font-mono text-sm font-bold text-neutral-950 dark:text-white">
                              {customRamGb} GB
                            </span>
                            <button
                              type="button"
                              aria-label="Increase RAM"
                              disabled={customRamGb >= customBuilder.maxRamGb}
                              onClick={() =>
                                setCustomRamGb((r) =>
                                  clamp(r + customBuilder.stepRamGb, customBuilder.minRamGb, customBuilder.maxRamGb)
                                )
                              }
                              className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 cursor-pointer"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="range"
                          aria-label="RAM GB slider"
                          min={customBuilder.minRamGb}
                          max={customBuilder.maxRamGb}
                          step={customBuilder.stepRamGb}
                          value={customRamGb}
                          onChange={(e) => setCustomRamGb(Number(e.target.value))}
                          className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#1ed760] dark:bg-neutral-700"
                        />
                      </div>

                      {/* NVMe Storage (GB) + Optional Extra Add-on Storage */}
                      <div className="rounded-xl bg-white px-4 py-3 dark:bg-neutral-800/75">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                              NVMe Storage (GB)
                            </span>
                            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                              {formatUsd(customBuilder.pricePerGbStorageMonthly)}/GB/mo
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label="Decrease NVMe storage"
                              disabled={customStorageGb <= customBuilder.minStorageGb}
                              onClick={() =>
                                setCustomStorageGb((s) =>
                                  clamp(
                                    s - customBuilder.stepStorageGb,
                                    customBuilder.minStorageGb,
                                    customBuilder.maxStorageGb
                                  )
                                )
                              }
                              className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 cursor-pointer"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="w-20 text-center font-mono text-sm font-bold text-neutral-950 dark:text-white">
                              {customStorageGb} GB
                            </span>
                            <button
                              type="button"
                              aria-label="Increase NVMe storage"
                              disabled={customStorageGb >= customBuilder.maxStorageGb}
                              onClick={() =>
                                setCustomStorageGb((s) =>
                                  clamp(
                                    s + customBuilder.stepStorageGb,
                                    customBuilder.minStorageGb,
                                    customBuilder.maxStorageGb
                                  )
                                )
                              }
                              className="flex size-7 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 cursor-pointer"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="range"
                          aria-label="NVMe Storage GB slider"
                          min={customBuilder.minStorageGb}
                          max={customBuilder.maxStorageGb}
                          step={customBuilder.stepStorageGb}
                          value={customStorageGb}
                          onChange={(e) => setCustomStorageGb(Number(e.target.value))}
                          className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-[#1ed760] dark:bg-neutral-700"
                        />

                        {customBuilder.maxExtraStorageGb > 0 && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 dark:border-neutral-700/60">
                            <span className="text-xs text-neutral-600 dark:text-neutral-300">
                              Extra Add-on NVMe Storage (+{customBuilder.extraStorageStepGb} GB increments)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label="Decrease extra storage"
                                disabled={customExtraStorageGb <= 0}
                                onClick={() =>
                                  setCustomExtraStorageGb((e) =>
                                    clamp(e - customBuilder.extraStorageStepGb, 0, customBuilder.maxExtraStorageGb)
                                  )
                                }
                                className="flex size-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white cursor-pointer"
                              >
                                <Minus className="size-3" />
                              </button>
                              <span className="min-w-16 text-center font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                                +{customExtraStorageGb} GB
                              </span>
                              <button
                                type="button"
                                aria-label="Increase extra storage"
                                disabled={customExtraStorageGb >= customBuilder.maxExtraStorageGb}
                                onClick={() =>
                                  setCustomExtraStorageGb((e) =>
                                    clamp(e + customBuilder.extraStorageStepGb, 0, customBuilder.maxExtraStorageGb)
                                  )
                                }
                                className="flex size-6 items-center justify-center rounded-md bg-neutral-100 text-neutral-800 hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-700 dark:text-white cursor-pointer"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Pure Monthly Bill Breakdown */}
                    <div className="rounded-xl bg-neutral-100/90 px-4 py-3 text-xs dark:bg-neutral-800/90">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                          CPU ({formatUsd(customCpuMonthly)}) + RAM ({formatUsd(customRamMonthly)}) + Storage (
                          {formatUsd(customStorageMonthly)})
                          {imageSurcharge > 0 ? ` + OS Add-on (${formatUsd(imageSurcharge)})` : ''}
                        </span>
                        <span className="text-sm font-bold text-[#0f7a37] dark:text-[#1ed760]">
                          = {formatUsd(roundMoney(customPlanMonthly + imageSurcharge))} / month
                        </span>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <>
                  {/* Column Header (Desktop) */}
                  <div className="hidden grid-cols-12 gap-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 sm:grid">
                    <span className="col-span-5">Machine Type</span>
                    <span className="col-span-2">vCPU</span>
                    <span className="col-span-2">Memory</span>
                    <span className="col-span-2">NVMe</span>
                    <span className="col-span-1 text-right">Monthly</span>
                  </div>

                  {paginatedPackages.length === 0 ? (
                    <div className="rounded-xl bg-white px-4 py-8 text-center text-sm text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400">
                      No plans available in {activeFamilyTab}.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {paginatedPackages.map((tier) => {
                        const active = selectedTier?.id === tier.id;
                        return (
                          <button
                            key={tier.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSelectedTier(tier)}
                            className={`grid w-full grid-cols-1 items-center gap-2 rounded-xl px-4 py-3 text-left transition cursor-pointer sm:grid-cols-12 ${
                              active
                                ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                                : 'bg-white text-neutral-900 hover:bg-neutral-100/90 dark:bg-neutral-800/75 dark:text-neutral-100 dark:hover:bg-neutral-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 sm:col-span-5">
                              <span
                                className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                                  active
                                    ? 'bg-[#1ed760] text-black'
                                    : 'bg-neutral-200 dark:bg-neutral-700'
                                }`}
                              >
                                {active && <Check className="size-2.5" aria-hidden="true" />}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-sm font-bold">{tier.name}</span>
                                  {tier.badge && (
                                    <Badge variant={active ? 'brand' : 'secondary'} className="text-[10px]">
                                      {tier.badge}
                                    </Badge>
                                  )}
                                </div>
                                <span
                                  className={`block text-[11px] ${
                                    active
                                      ? 'text-white/65 dark:text-neutral-600'
                                      : 'text-neutral-500 dark:text-neutral-400'
                                  }`}
                                >
                                  {tier.family}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-xs sm:col-span-7 sm:grid sm:grid-cols-7 sm:items-center">
                              <span className="font-semibold sm:col-span-2">{tier.vcpus} vCPU</span>
                              <span className="font-semibold sm:col-span-2">{tier.memory}</span>
                              <span className="sm:col-span-2">{tier.storage}</span>
                              <span
                                className={`text-right text-sm font-bold sm:col-span-1 ${
                                  active ? 'text-[#1ed760] dark:text-[#0f7a37]' : ''
                                }`}
                              >
                                {formatUsd(tier.monthlyPrice)}
                                <span className="text-[10px] font-normal opacity-75">/mo</span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination Controls (max 5 rows per page) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {filteredPackages.length === 0
                        ? '0 plans'
                        : `Showing ${(safePlanPage - 1) * PLANS_PER_PAGE + 1}–${Math.min(
                            safePlanPage * PLANS_PER_PAGE,
                            filteredPackages.length
                          )} of ${filteredPackages.length} plans`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={safePlanPage <= 1}
                        onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="size-3.5" aria-hidden="true" />
                        Prev
                      </Button>
                      <span className="px-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                        Page {safePlanPage} / {totalPlanPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={safePlanPage >= totalPlanPages}
                        onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 4: CREDENTIALS, HOSTNAME & DEPLOY */}
          {step === 4 && (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  htmlFor="droplet-hostname"
                >
                  Hostname
                  <input
                    id="droplet-hostname"
                    type="text"
                    value={hostname}
                    onChange={(event) => setHostname(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-xl bg-white px-3 text-sm font-normal text-neutral-950 outline-none transition focus:ring-2 focus:ring-[#1ed760] dark:bg-neutral-800 dark:text-white"
                  />
                  {!validHostnameFormat ? (
                    <span className="mt-1 block text-xs font-normal text-rose-500">
                      ✕ Use 3–63 lowercase letters, numbers, or hyphens.
                    </span>
                  ) : availability.checking ? (
                    <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      Checking availability…
                    </span>
                  ) : hostnameTaken ? (
                    <span className="mt-1 block text-xs font-medium text-rose-500">
                      ✕ {hostnameCheck?.reason || 'Already used in your account'}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs font-medium text-[#0f7a37] dark:text-[#1ed760]">
                      ✓ {hostnameCheck?.reason || 'Available'}
                    </span>
                  )}
                </label>

                <label
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  htmlFor="droplet-tags"
                >
                  Tags (optional)
                  <input
                    id="droplet-tags"
                    type="text"
                    value={tags}
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="production, web"
                    className="mt-1.5 h-10 w-full rounded-xl bg-white px-3 text-sm font-normal text-neutral-950 outline-none transition focus:ring-2 focus:ring-[#1ed760] dark:bg-neutral-800 dark:text-white"
                  />
                </label>

                <label
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  htmlFor="droplet-username"
                >
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="size-3.5 text-[#1ed760]" aria-hidden="true" />
                    Server Username
                  </span>
                  <input
                    id="droplet-username"
                    type="text"
                    value={serverUsername}
                    onChange={(event) => setServerUsername(event.target.value)}
                    placeholder="root"
                    autoComplete="username"
                    className="mt-1.5 h-10 w-full rounded-xl bg-white px-3 font-mono text-sm font-normal text-neutral-950 outline-none transition focus:ring-2 focus:ring-[#1ed760] dark:bg-neutral-800 dark:text-white"
                  />
                  {!validUsername ? (
                    <span className="mt-1 block text-xs font-normal text-rose-500">
                      ✕ {usernameCheck?.reason || 'Use 2–32 lowercase letters, numbers, _ or -.'}
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs font-medium text-[#0f7a37] dark:text-[#1ed760]">
                      ✓ {usernameCheck?.reason || 'Isolated per droplet'}
                    </span>
                  )}
                </label>

                <div className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="droplet-password">Server Login Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setServerPassword(generateStrongPassword());
                        setShowPassword(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0f7a37] hover:underline dark:text-[#1ed760] cursor-pointer"
                    >
                      <RefreshCw className="size-3" aria-hidden="true" />
                      Generate
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <input
                      id="droplet-password"
                      type={showPassword ? 'text' : 'password'}
                      value={serverPassword}
                      onChange={(event) => setServerPassword(event.target.value)}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      className="h-10 w-full rounded-xl bg-white pl-3 pr-10 font-mono text-sm font-normal text-neutral-950 outline-none transition focus:ring-2 focus:ring-[#1ed760] dark:bg-neutral-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {serverPassword && !validPassword ? (
                    <span className="mt-1 block text-xs font-normal text-rose-500">
                      Password must be at least 8 characters.
                    </span>
                  ) : !serverPassword ? (
                    <span className="mt-1 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                      Required for SSH access (min 8 chars).
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs font-medium text-[#0f7a37] dark:text-[#1ed760]">
                      ✓ Password ready
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Compact Networking & Add-on Toggles */}
              <div className="grid gap-2.5 sm:grid-cols-3">
                <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 text-xs dark:bg-neutral-800/75 cursor-pointer">
                  <span>
                    <span className="block font-semibold text-neutral-900 dark:text-white">IPv6 Routing</span>
                    <span className="text-neutral-500 dark:text-neutral-400">Included</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enableIpv6}
                    onChange={(event) => setEnableIpv6(event.target.checked)}
                    className="size-4 accent-[#1ed760]"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 text-xs dark:bg-neutral-800/75 cursor-pointer">
                  <span>
                    <span className="block font-semibold text-neutral-900 dark:text-white">Monitoring</span>
                    <span className="text-neutral-500 dark:text-neutral-400">Included</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enableMonitoring}
                    onChange={(event) => setEnableMonitoring(event.target.checked)}
                    className="size-4 accent-[#1ed760]"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 text-xs dark:bg-neutral-800/75 cursor-pointer">
                  <span>
                    <span className="block font-semibold text-neutral-900 dark:text-white">Weekly Backups</span>
                    <span className="text-neutral-500 dark:text-neutral-400">+$3/mo</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enableBackups}
                    onChange={(event) => setEnableBackups(event.target.checked)}
                    className="size-4 accent-[#1ed760]"
                  />
                </label>
              </div>

              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{submitError}</span>
                </Alert>
              )}
            </div>
          )}
        </section>

        {/* Right Compact Configuration Summary (Borderless) */}
        <aside className="rounded-2xl bg-neutral-50/90 p-5 dark:bg-neutral-900/55 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-950 dark:text-white">Configuration</h3>
            <Badge variant="brand">{formatUsd(totalMonthly)}/mo</Badge>
          </div>

          <dl className="mt-4 divide-y divide-neutral-200/70 text-xs dark:divide-neutral-800">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-neutral-500 dark:text-neutral-400">OS / Image</dt>
              <dd className="text-right font-semibold text-neutral-950 dark:text-white">
                {selectedImage?.name || '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-neutral-500 dark:text-neutral-400">Region</dt>
              <dd className="flex items-center justify-end gap-1.5 font-semibold text-neutral-950 dark:text-white">
                {selectedRegion?.flagUrl && (
                  <img
                    src={selectedRegion.flagUrl}
                    alt=""
                    className="h-[13px] w-[18px] rounded-[2px] object-cover"
                  />
                )}
                <span>{selectedRegion ? `${selectedRegion.name} (${selectedRegion.code})` : '—'}</span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-neutral-500 dark:text-neutral-400">Machine Plan</dt>
              <dd className="text-right font-semibold text-neutral-950 dark:text-white">
                {activePlan?.name || 'Unavailable'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                <Cpu className="size-3.5" aria-hidden="true" />
                Compute
              </dt>
              <dd className="text-right font-semibold text-neutral-950 dark:text-white">
                {activePlan ? `${activePlan.vcpus} vCPU · ${activePlan.memory}` : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                <HardDrive className="size-3.5" aria-hidden="true" />
                Storage
              </dt>
              <dd className="text-right font-semibold text-neutral-950 dark:text-white">
                {activePlan?.storage || '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                <Server className="size-3.5" aria-hidden="true" />
                Access
              </dt>
              <dd className="text-right font-mono font-semibold text-neutral-950 dark:text-white">
                {cleanUsername || 'root'}@{cleanHostname || '—'}
              </dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>Machine plan</span>
              <span className="font-semibold text-neutral-900 dark:text-white">
                {formatUsd(baseMonthly)}/mo
              </span>
            </div>
            {imageSurcharge > 0 && (
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                <span>OS / Add-on surcharge</span>
                <span className="font-semibold text-neutral-900 dark:text-white">
                  +{formatUsd(imageSurcharge)}/mo
                </span>
              </div>
            )}
            {enableBackups && (
              <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                <span>Weekly backups</span>
                <span className="font-semibold text-neutral-900 dark:text-white">+$3/mo</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Total Monthly
              </span>
              <span className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                {formatUsd(totalMonthly)}
                <span className="ml-0.5 text-xs font-medium text-neutral-500">/mo</span>
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:bg-neutral-900/95">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="brand" className="px-3 py-1 text-xs font-bold">
            {formatUsd(totalMonthly)}/mo
          </Badge>
          {imageSurcharge > 0 && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              ({formatUsd(baseMonthly)}/mo plan + {formatUsd(imageSurcharge)}/mo OS)
            </span>
          )}
          <span className="hidden text-xs text-neutral-500 dark:text-neutral-400 sm:inline">
            · {selectedImage?.name || 'No image'} · {selectedRegion?.code || 'No region'} ·{' '}
            {activePlan?.name || 'No plan'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={handleBack}>
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>

          {step < 4 ? (
            <Button
              variant="default"
              size="md"
              disabled={!canAdvanceFromStep(step)}
              onClick={handleNext}
            >
              Next
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              variant="default"
              size="md"
              disabled={!canCreate}
              onClick={handleCreateDroplet}
            >
              <Zap className="size-3.5" aria-hidden="true" />
              {submitting
                ? 'Deploying...'
                : hostnameTaken
                  ? 'Hostname Taken'
                  : validPassword
                    ? 'Deploy Droplet'
                    : 'Enter Password'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
