import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Store,
  Layers,
  Upload,
  Check,
  ExternalLink,
  RefreshCw,
  Image as ImageIcon,
  Save,
  ArrowLeft,
  X,
  RotateCcw,
  Search,
  Star,
  Plus,
  Trash2,
  Globe,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  GripVertical,
  Sparkles,
  Link as LinkIcon,
  FileText,
  Clock,
  CreditCard,
  Truck,
  Tag
} from 'lucide-react';
import { StoreSettingsProvider, useStoreSettings } from '../context/StoreSettingsContext';
import { THEME_COLOR_PRESETS, AVAILABLE_THEMES, THEME_CATEGORIES, DEFAULT_HERO_BANNERS } from '../themes/themeConfig';
import { getStoreUrl } from '../config/platformConfig';

const toDateTimeLocal = value => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toPromotionIsoDate = value => value ? new Date(value).toISOString() : '';

function StoreSettingsContent({
  showToast,
  onBackToDashboard,
  initialTab = 'theme',
  onNavigateToPaymentShipping,
  onNavigateToPayments,
  onNavigateToShipping,
  onNavigateToPromotions,
  onNavigateToStoreSettings
}) {
  const {
    storeSettings = {},
    saving,
    updateStoreSettings,
    uploadStoreLogo,
    resetToDefaultLogo,
    uploadStoreFavicon,
    resetToDefaultFavicon,
    addHeroBanner,
    updateHeroBanner,
    deleteHeroBanner,
    resetToDefaultBanners
  } = useStoreSettings();

  const settings = storeSettings || {};

  // Active navigation tab ('theme' | 'identity' | 'payments' | 'shipping' | 'promotions' | 'colors' | 'banners')
  const [activeTab, setActiveTab] = useState(initialTab === 'commerce' ? 'payments' : initialTab);

  // Store Identity & SEO Form State
  const [storeName, setStoreName] = useState(settings.storeName || 'TiwloMart');
  const [storeTagline, setStoreTagline] = useState(settings.storeTagline || 'Shop Global • Sell Global');
  const [storeTitle, setStoreTitle] = useState(settings.storeTitle || 'TiwloMart | Global Multi-Vendor eCommerce Marketplace');
  const [storeDescription, setStoreDescription] = useState(settings.storeDescription || 'Discover millions of quality products from verified global sellers with fast international shipping and secure checkout.');
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress || '');
  const [storeCity, setStoreCity] = useState(settings.storeCity || '');
  const [storeCountry, setStoreCountry] = useState(settings.storeCountry || '');
  const [storePostalCode, setStorePostalCode] = useState(settings.storePostalCode || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '');
  const [taxRate, setTaxRate] = useState(settings.taxRate ?? 0);
  const [shippingFlatRate, setShippingFlatRate] = useState(settings.shippingFlatRate ?? '');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(settings.freeShippingThreshold ?? '');
  const [shippingZones, setShippingZones] = useState(settings.shippingZones || []);
  const [refundRequestsEnabled, setRefundRequestsEnabled] = useState(settings.refundRequestsEnabled ?? true);
  const [promoActive, setPromoActive] = useState(settings.promoActive ?? false);
  const [promoCode, setPromoCode] = useState(settings.promoCode || '');
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(settings.promoDiscountPercent ?? 0);
  const [promoDiscountType, setPromoDiscountType] = useState(settings.promoDiscountType || 'percent');
  const [promoMinimumSubtotal, setPromoMinimumSubtotal] = useState(settings.promoMinimumSubtotal ?? '');
  const [promoMaximumDiscount, setPromoMaximumDiscount] = useState(settings.promoMaximumDiscount ?? '');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoEndsAt, setPromoEndsAt] = useState('');
  const [promoUsageLimit, setPromoUsageLimit] = useState(settings.promoUsageLimit ?? '');
  const [promoPerCustomerLimit, setPromoPerCustomerLimit] = useState(settings.promoPerCustomerLimit ?? '');
  const [promoAllowedCountries, setPromoAllowedCountries] = useState(settings.promoAllowedCountries || []);
  const [promoCountrySearch, setPromoCountrySearch] = useState('');
  const [selectedColor, setSelectedColor] = useState(settings.themeColor || '#2563eb');
  const [bannerSlidingSpeed, setBannerSlidingSpeed] = useState(settings.bannerSlidingSpeed || 5);
  const [storePages, setStorePages] = useState(settings.storePages || []);
  const [pageDraft, setPageDraft] = useState(null);
  const [uploadingPageImage, setUploadingPageImage] = useState(false);
  const [draggedPageId, setDraggedPageId] = useState(null);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerDraft, setBannerDraft] = useState(null);

  // Sync state when storeSettings updates asynchronously from server
  useEffect(() => {
    if (storeSettings) {
      if (storeSettings.storeName) setStoreName(storeSettings.storeName);
      if (storeSettings.storeTagline) setStoreTagline(storeSettings.storeTagline);
      if (storeSettings.storeTitle) setStoreTitle(storeSettings.storeTitle);
      if (storeSettings.storeDescription) setStoreDescription(storeSettings.storeDescription);
      setStoreAddress(storeSettings.storeAddress || '');
      setStoreCity(storeSettings.storeCity || '');
      setStoreCountry(storeSettings.storeCountry || '');
      setStorePostalCode(storeSettings.storePostalCode || '');
      setContactEmail(storeSettings.contactEmail || '');
      setContactPhone(storeSettings.contactPhone || '');
      setTaxRate(storeSettings.taxRate ?? 0);
      setShippingFlatRate(storeSettings.shippingFlatRate ?? '');
      setFreeShippingThreshold(storeSettings.freeShippingThreshold ?? '');
      setShippingZones(storeSettings.shippingZones || []);
      setRefundRequestsEnabled(storeSettings.refundRequestsEnabled ?? true);
      setPromoActive(storeSettings.promoActive ?? false);
      setPromoCode(storeSettings.promoCode || '');
      setPromoDiscountPercent(storeSettings.promoDiscountPercent ?? 0);
      setPromoDiscountType(storeSettings.promoDiscountType || 'percent');
      setPromoMinimumSubtotal(storeSettings.promoMinimumSubtotal ?? '');
      setPromoMaximumDiscount(storeSettings.promoMaximumDiscount ?? '');
      setPromoStartsAt(toDateTimeLocal(storeSettings.promoStartsAt));
      setPromoEndsAt(toDateTimeLocal(storeSettings.promoEndsAt));
      setPromoUsageLimit(storeSettings.promoUsageLimit ?? '');
      setPromoPerCustomerLimit(storeSettings.promoPerCustomerLimit ?? '');
      setPromoAllowedCountries(Array.isArray(storeSettings.promoAllowedCountries) ? storeSettings.promoAllowedCountries : []);
      if (storeSettings.themeColor) setSelectedColor(storeSettings.themeColor);
      if (storeSettings.bannerSlidingSpeed) setBannerSlidingSpeed(storeSettings.bannerSlidingSpeed);
      setStorePages(Array.isArray(storeSettings.storePages) ? storeSettings.storePages : []);
    }
  }, [storeSettings]);

  const safeColor = selectedColor || settings.themeColor || '#2563eb';
  const liveStoreUrl = (() => {
    const domain = String(import.meta.env.VITE_STORE_DOMAIN || import.meta.env.VITE_PRIMARY_DOMAIN || 'tiwlo.com')
      .trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const subdomain = String(settings.subdomain || '').trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
    if (!subdomain) return '/?view=store';
    if (subdomain.endsWith(`.${domain}`) && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(subdomain)) {
      return `https://${subdomain}`;
    }
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)
      ? getStoreUrl(subdomain)
      : '/?view=store';
  })();

  // Marketplace Theme Search & Filter
  const [themeSearch, setThemeSearch] = useState('');
  const [selectedThemeCategory, setSelectedThemeCategory] = useState('All Themes');

  // Logo upload state
  const [isLogoDragging, setIsLogoDragging] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  // Favicon upload state
  const [isFaviconDragging, setIsFaviconDragging] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const faviconInputRef = useRef(null);

  // Add Banner Modal / Inline Form State
  const [isAddBannerOpen, setIsAddBannerOpen] = useState(false);
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerSubtitle, setNewBannerSubtitle] = useState('');
  const [newBannerImage, setNewBannerImage] = useState('');
  const [newBannerLink, setNewBannerLink] = useState('/?view=store#flash-sale');
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [isBannerDragging, setIsBannerDragging] = useState(false);
  const bannerFileInputRef = useRef(null);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [paymentCredentials, setPaymentCredentials] = useState({});
  const [savingPaymentProvider, setSavingPaymentProvider] = useState('');
  const [currencyConfiguration, setCurrencyConfiguration] = useState(null);
  const [currencyRates, setCurrencyRates] = useState({ USD: 1 });
  const [currencyMode, setCurrencyMode] = useState('api');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('');
  const [savingCurrencySettings, setSavingCurrencySettings] = useState(false);
  const [refreshingCurrencyRates, setRefreshingCurrencyRates] = useState(false);
  const [conversionAmount, setConversionAmount] = useState('1');
  const [conversionTarget, setConversionTarget] = useState('BDT');
  const [conversionPreview, setConversionPreview] = useState(null);
  const [previewingConversion, setPreviewingConversion] = useState(false);
  const [shippingCountries, setShippingCountries] = useState([]);
  const [shippingCountryCode, setShippingCountryCode] = useState('');
  const [shippingCountrySearch, setShippingCountrySearch] = useState('');
  const [shippingCountryError, setShippingCountryError] = useState('');
  const [shippingCitySearch, setShippingCitySearch] = useState({});
  const [shippingCityResults, setShippingCityResults] = useState({});
  const [loadingShippingCities, setLoadingShippingCities] = useState({});
  const matchingShippingCountries = shippingCountries.filter(country =>
    country.name.toLowerCase().includes(shippingCountrySearch.trim().toLowerCase())
  );
  const commonCurrencyCodes = ['BDT', 'INR', 'EUR', 'GBP', 'JPY'];
  const conversionCurrencies = Object.keys(currencyMode === 'api'
    ? currencyConfiguration?.rates || {}
    : currencyRates
  ).filter(code => code !== 'USD').sort();
  const selectedConversionCurrency = conversionCurrencies.includes(conversionTarget)
    ? conversionTarget
    : conversionCurrencies[0] || '';

  const paymentCredentialLabels = {
    appKey: 'bKash app key',
    appSecret: 'bKash app secret',
    username: 'bKash API username',
    password: 'bKash API password',
    merchantId: 'Nagad merchant ID',
    merchantPrivateKey: 'Nagad merchant private key (PEM)',
    nagadPublicKey: 'Nagad gateway public key (PEM)',
    storeId: 'SSLCOMMERZ store ID',
    storePassword: 'SSLCOMMERZ store password',
    secretKey: 'Stripe secret key',
    webhookSecret: 'Stripe webhook signing secret',
    clientId: 'PayPal client ID',
    clientSecret: 'PayPal client secret'
  };

  useEffect(() => {
    if (!['shipping', 'promotions'].includes(activeTab) || shippingCountries.length) return undefined;
    let cancelled = false;
    fetch('/api/public/shipping/countries')
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Country list failed with HTTP ${response.status}`);
        if (!cancelled) setShippingCountries(result.countries || []);
      })
      .catch(error => {
        if (!cancelled) setShippingCountryError(error.message || 'Could not load shipping countries.');
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, shippingCountries.length]);

  const updateShippingZone = (zoneIndex, patch) => {
    setShippingZones(current => current.map((zone, index) =>
      index === zoneIndex ? { ...zone, ...patch } : zone
    ));
  };

  const addShippingCountry = (zoneIndex) => {
    const country = shippingCountries.find(item => item.code === shippingCountryCode);
    if (!country) return;
    setShippingZones(current => current.map((zone, index) => {
      if (index !== zoneIndex) return zone;
      const destinations = Array.isArray(zone.destinations) ? zone.destinations : [];
      if (destinations.some(destination => destination.countryCode === country.code)) return zone;
      return {
        ...zone,
        destinations: [...destinations, {
          countryCode: country.code,
          countryName: country.name,
          cities: [],
          enabled: true
        }]
      };
    }));
  };

  const searchShippingCities = async (countryCode, searchKey) => {
    const query = String(shippingCitySearch[searchKey] || '').trim();
    if (query.length < 2) {
      showToast?.('Enter at least two letters to search cities.', 'error');
      return;
    }
    setLoadingShippingCities(current => ({ ...current, [searchKey]: true }));
    try {
      const response = await fetch(`/api/public/shipping/cities?countryCode=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(query)}`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `City search failed with HTTP ${response.status}`);
      setShippingCityResults(current => ({ ...current, [searchKey]: result.cities || [] }));
    } catch (error) {
      showToast?.(error.message || 'Could not search shipping cities.', 'error');
    } finally {
      setLoadingShippingCities(current => ({ ...current, [searchKey]: false }));
    }
  };

  const addShippingCity = (zoneIndex, destinationIndex, city) => {
    setShippingZones(current => current.map((zone, index) => index === zoneIndex
      ? {
        ...zone,
        destinations: zone.destinations.map((destination, itemIndex) => itemIndex === destinationIndex
          ? { ...destination, cities: [...new Set([...(destination.cities || []), city])] }
          : destination)
      }
      : zone));
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/store/payment-providers')
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Payment settings request failed with HTTP ${response.status}`);
        if (!cancelled) setPaymentProviders(result.providers || []);
      })
      .catch(error => {
        if (!cancelled) showToast?.(error.message || 'Could not load payment provider settings.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/store/currency')
      .then(async response => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Currency settings request failed with HTTP ${response.status}`);
        if (cancelled) return;
        setCurrencyConfiguration(result);
        setCurrencyMode(result.mode);
        setCurrencyRates(result.rates || { USD: 1 });
      })
      .catch(error => {
        if (!cancelled) showToast?.(error.message || 'Could not load currency settings.', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const saveCurrencySettings = async () => {
    setSavingCurrencySettings(true);
    try {
      const rates = Object.fromEntries(
        Object.entries(currencyRates).map(([code, rate]) => [code, rate === '' ? '' : Number(rate)])
      );
      const response = await fetch('/api/store/currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual', rates })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save manual currency rates.');
      setCurrencyConfiguration(result);
      setCurrencyRates(result.rates);
      setCurrencyMode('manual');
      showToast?.('Manual currency rates saved for this store.');
    } catch (error) {
      showToast?.(error.message || 'Could not save manual currency rates.', 'error');
    } finally {
      setSavingCurrencySettings(false);
    }
  };

  const refreshCurrencyRates = async () => {
    setRefreshingCurrencyRates(true);
    try {
      const response = await fetch('/api/store/currency/rates/refresh', { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not refresh market currency rates.');
      setCurrencyConfiguration(result);
      setCurrencyRates(result.rates || { USD: 1 });
      setCurrencyMode('api');
      showToast?.(`Reference FX rates refreshed (${result.observedAt}).`);
    } catch (error) {
      showToast?.(error.message || 'Could not refresh market currency rates.', 'error');
    } finally {
      setRefreshingCurrencyRates(false);
    }
  };

  const switchToManualCurrencyRates = () => {
    const currentRates = currencyRates || {};
    const sourceRates = currencyConfiguration?.rates || {};
    const initialRates = { USD: 1 };
    for (const code of commonCurrencyCodes) {
      const value = currentRates[code] ?? sourceRates[code];
      if (value !== undefined) initialRates[code] = value;
    }
    setCurrencyRates(initialRates);
    setCurrencyMode('manual');
  };

  const addManualCurrencyRate = () => {
    const code = newCurrencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || code === 'USD' || !newCurrencyRate ||
        !Number.isFinite(Number(newCurrencyRate)) || Number(newCurrencyRate) <= 0) {
      showToast?.('Enter a three-letter currency code and a positive USD conversion rate.', 'error');
      return;
    }
    setCurrencyRates(current => ({ ...current, [code]: Number(newCurrencyRate) }));
    setNewCurrencyCode('');
    setNewCurrencyRate('');
  };

  const previewCurrencyConversion = async () => {
    setPreviewingConversion(true);
    try {
      const response = await fetch('/api/store/currency/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: conversionAmount,
          toCurrency: selectedConversionCurrency
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not preview currency conversion.');
      setConversionPreview(result);
    } catch (error) {
      setConversionPreview(null);
      showToast?.(error.message || 'Could not preview currency conversion.', 'error');
    } finally {
      setPreviewingConversion(false);
    }
  };

  const savePaymentProvider = async (provider) => {
    setSavingPaymentProvider(provider.id);
    try {
      const response = await fetch(`/api/store/payment-providers/${provider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: provider.enabled,
          mode: provider.mode,
          feePercent: provider.feePercent,
          feeFixed: provider.feeFixed,
          feeMode: provider.feeMode,
          credentials: paymentCredentials[provider.id] || {}
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Could not save ${provider.name} settings.`);
      setPaymentProviders(current => current.map(item => item.id === provider.id ? result.provider : item));
      setPaymentCredentials(current => ({ ...current, [provider.id]: {} }));
      showToast?.(`${provider.name} settings saved. Credentials are encrypted in PostgreSQL.`);
    } catch (error) {
      showToast?.(error.message || `Could not save ${provider.name} settings.`, 'error');
    } finally {
      setSavingPaymentProvider('');
    }
  };

  // =========================================================
  // ACTIONS: SAVE ALL SETTINGS
  // =========================================================
  const handleSaveAll = async (e) => {
    e?.preventDefault();
    try {
      await updateStoreSettings({
        storeName,
        storeTagline,
        storeTitle,
        storeDescription,
        storeAddress,
        storeCity,
        storeCountry,
        storePostalCode,
        contactEmail,
        contactPhone,
        taxRate: Number(taxRate),
        shippingFlatRate: shippingFlatRate === '' ? '' : Number(shippingFlatRate),
        freeShippingThreshold: freeShippingThreshold === '' ? '' : Number(freeShippingThreshold),
        shippingZones,
        refundRequestsEnabled,
        promoActive,
        promoCode: promoCode.trim().toUpperCase(),
        promoDiscountPercent: promoDiscountPercent === '' ? 0 : Number(promoDiscountPercent),
        promoDiscountType,
        promoMinimumSubtotal: promoMinimumSubtotal === '' ? '' : Number(promoMinimumSubtotal),
        promoMaximumDiscount: promoMaximumDiscount === '' ? '' : Number(promoMaximumDiscount),
        promoStartsAt: toPromotionIsoDate(promoStartsAt),
        promoEndsAt: toPromotionIsoDate(promoEndsAt),
        promoUsageLimit: promoUsageLimit === '' ? 0 : Number(promoUsageLimit),
        promoPerCustomerLimit: promoPerCustomerLimit === '' ? 0 : Number(promoPerCustomerLimit),
        promoAllowedCountries,
        themeColor: selectedColor,
        bannerSlidingSpeed: Number(bannerSlidingSpeed) || 5
      });
      showToast?.('Store settings saved successfully');
    } catch (err) {
      showToast?.(err.message || 'Failed to save settings', 'error');
    }
  };

  // =========================================================
  // ACTIONS: COLOR PRESETS & CUSTOM COLOR
  // =========================================================
  const handleSelectPreset = async (preset) => {
    setSelectedColor(preset.hex);
    try {
      await updateStoreSettings({
        themeColor: preset.hex,
        themeColorPreset: preset.id
      });
      showToast?.(`Applied ${preset.name}`);
    } catch {
      showToast?.('Failed to save theme color.', 'error');
    }
  };

  const handleCustomColorChange = async (e) => {
    const val = e.target.value;
    setSelectedColor(val);
    try {
      await updateStoreSettings({
        themeColor: val,
        themeColorPreset: 'custom'
      });
    } catch {
      showToast?.('Failed to save theme color.', 'error');
    }
  };

  // =========================================================
  // ACTIONS: LOGO UPLOAD
  // =========================================================
  const handleLogoDrop = async (e) => {
    e.preventDefault();
    setIsLogoDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processLogoFile(files[0]);
    }
  };

  const processLogoFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      showToast?.('Please upload an image file (PNG, JPG, SVG, WEBP)', 'error');
      return;
    }
    try {
      setUploadingLogo(true);
      const res = await uploadStoreLogo(file);
      if (res?.success) {
        showToast?.('Store logo updated successfully');
      }
    } catch (err) {
      showToast?.('Failed to upload logo', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  // =========================================================
  // ACTIONS: FAVICON UPLOAD
  // =========================================================
  const handleFaviconDrop = async (e) => {
    e.preventDefault();
    setIsFaviconDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFaviconFile(files[0]);
    }
  };

  const processFaviconFile = async (file) => {
    if (!file.type.startsWith('image/') && !file.name.endsWith('.ico')) {
      showToast?.('Please upload a valid favicon (ICO, PNG, SVG)', 'error');
      return;
    }
    try {
      setUploadingFavicon(true);
      const res = await uploadStoreFavicon(file);
      if (res?.success) {
        showToast?.('Store favicon updated successfully');
      }
    } catch (err) {
      showToast?.('Failed to upload favicon', 'error');
    } finally {
      setUploadingFavicon(false);
    }
  };

  // =========================================================
  // ACTIONS: BANNER UPLOAD & MANAGEMENT
  // =========================================================
  const processBannerFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      showToast?.('Please upload an image file (PNG, JPG, WEBP)', 'error');
      return;
    }
    try {
      setUploadingBannerImage(true);
      const formData = new FormData();
      formData.append('banner', file);
      const res = await fetch('/api/store/upload-banner', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.bannerUrl) {
          setNewBannerImage(data.bannerUrl);
          showToast?.('Banner image uploaded');
          return;
        }
      }
      throw new Error('Upload failed');
    } catch (err) {
      // Fallback base64
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewBannerImage(reader.result);
        showToast?.('Banner image loaded');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleCreateBanner = async (e) => {
    e?.preventDefault();
    if (!newBannerImage.trim()) {
      showToast?.('Please upload an image or provide a banner image URL', 'error');
      return;
    }
    try {
      await addHeroBanner({
        title: newBannerTitle.trim() || 'Featured Promotion',
        subtitle: newBannerSubtitle.trim() || '',
        image: newBannerImage.trim(),
        link: newBannerLink.trim() || '/?view=store#flash-sale',
        active: true
      });
      setNewBannerTitle('');
      setNewBannerSubtitle('');
      setNewBannerImage('');
      setNewBannerLink('/?view=store#flash-sale');
      setIsAddBannerOpen(false);
      showToast?.('New slider banner added');
    } catch (err) {
      showToast?.('Failed to add banner', 'error');
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (confirm('Are you sure you want to remove this banner?')) {
      try {
        await deleteHeroBanner(bannerId);
        showToast?.('Banner removed');
      } catch (err) {
        showToast?.('Failed to delete banner', 'error');
      }
    }
  };

  const handleToggleBannerActive = async (banner) => {
    try {
      await updateHeroBanner(banner.id, { active: !banner.active });
      showToast?.(banner.active ? 'Banner disabled' : 'Banner activated');
    } catch (err) {
      showToast?.('Failed to update banner', 'error');
    }
  };

  const handleMoveBanner = async (index, direction) => {
    const banners = [...(Array.isArray(settings.heroBanners) ? settings.heroBanners : DEFAULT_HERO_BANNERS)];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    const temp = banners[index];
    banners[index] = banners[targetIndex];
    banners[targetIndex] = temp;
    try {
      await updateStoreSettings({ heroBanners: banners });
      showToast?.('Banner reordered');
    } catch (err) {
      showToast?.('Failed to reorder banners', 'error');
    }
  };

  const createEmptyPageDraft = () => ({
    id: `page-${Date.now()}`,
    title: '',
    slug: '',
    content: '',
    image: '',
    placement: 'footer',
    enabled: true
  });

  const uploadPageImage = async file => {
    if (!file?.type?.startsWith('image/')) {
      showToast?.('Choose a valid image file.', 'error');
      return;
    }
    setUploadingPageImage(true);
    try {
      const formData = new FormData();
      formData.append('banner', file);
      const response = await fetch('/api/store/upload-banner', { method: 'POST', body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.bannerUrl) {
        throw new Error(result.error || `Image upload failed with HTTP ${response.status}.`);
      }
      setPageDraft(current => current ? { ...current, image: result.bannerUrl } : current);
      showToast?.('Page image uploaded.');
    } catch (error) {
      showToast?.(error.message || 'Failed to upload page image.', 'error');
    } finally {
      setUploadingPageImage(false);
    }
  };

  const savePageDraft = async () => {
    const title = pageDraft?.title?.trim();
    if (!title) {
      showToast?.('Add a page title before saving.', 'error');
      return;
    }
    const page = {
      ...pageDraft,
      title,
      slug: (pageDraft.slug || title).trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      order: storePages.findIndex(existing => existing.id === pageDraft.id) < 0
        ? storePages.length
        : storePages.findIndex(existing => existing.id === pageDraft.id)
    };

    const updatedPages = storePages.some(existing => existing.id === page.id)
      ? storePages.map(existing => existing.id === page.id ? page : existing)
      : [...storePages, page];
    try {
      await updateStoreSettings({ storePages: updatedPages });
      setStorePages(updatedPages);
      setPageDraft(null);
      showToast?.('Store page saved. Unsafe HTML is removed automatically.');
    } catch (error) {
      showToast?.(error.message || 'Failed to save store page.', 'error');
    }
  };

  const moveStorePage = async (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const reordered = [...storePages];
    const sourceIndex = reordered.findIndex(page => page.id === sourceId);
    const targetIndex = reordered.findIndex(page => page.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const ordered = reordered.map((page, order) => ({ ...page, order }));
    try {
      await updateStoreSettings({ storePages: ordered });
      setStorePages(ordered);
    } catch (error) {
      showToast?.(error.message || 'Failed to reorder pages.', 'error');
    }
  };

  const handleSaveBanner = async () => {
    if (!bannerDraft?.title?.trim() || !bannerDraft?.image?.trim()) {
      showToast?.('Banner title and image URL are required.', 'error');
      return;
    }
    try {
      await updateHeroBanner(editingBannerId, bannerDraft);
      setEditingBannerId(null);
      setBannerDraft(null);
      showToast?.('Homepage hero banner updated.');
    } catch (error) {
      showToast?.(error.message || 'Failed to update banner.', 'error');
    }
  };

  // Filter themes for marketplace catalog
  const filteredThemes = (Array.isArray(AVAILABLE_THEMES) ? AVAILABLE_THEMES : []).filter((th) => {
    if (!th) return false;
    const matchesCategory =
      selectedThemeCategory === 'All Themes' ||
      th.category?.toLowerCase() === selectedThemeCategory.toLowerCase();

    const matchesSearch =
      !themeSearch.trim() ||
      th.name?.toLowerCase().includes(themeSearch.toLowerCase()) ||
      th.tagline?.toLowerCase().includes(themeSearch.toLowerCase()) ||
      th.description?.toLowerCase().includes(themeSearch.toLowerCase()) ||
      (Array.isArray(th.features) && th.features.some(f => f.toLowerCase().includes(themeSearch.toLowerCase())));

    return matchesCategory && matchesSearch;
  });

  const currentBanners = Array.isArray(settings.heroBanners)
    ? settings.heroBanners
    : DEFAULT_HERO_BANNERS;
  const isCommerceSettings = ['commerce', 'payments', 'shipping', 'promotions'].includes(activeTab);
  const commercePage = {
    commerce: {
      title: 'Payments',
      description: 'Manage payment providers and store currency settings.'
    },
    payments: {
      title: 'Payments',
      description: 'Manage payment providers and store currency settings.'
    },
    shipping: {
      title: 'Shipping',
      description: 'Set delivery rates, shipping zones, tax, and delivery estimates.'
    },
    promotions: {
      title: 'Promo Codes',
      description: 'Create and manage the promotion code customers can use at checkout.'
    }
  }[activeTab] || null;

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* ========================================================= */}
      {/* TOP BANNER WITH BACKGROUND IMAGE                           */}
      {/* ========================================================= */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 dark:border-gray-800 shadow-md">
        {/* Background Image Layer */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.94) 0%, rgba(30, 58, 138, 0.82) 50%, rgba(15, 23, 42, 0.90) 100%), url('/waves/ocean_waves_blue.jpg')`
          }}
        />

        {/* Content Layer */}
        <div className="relative z-10 p-4 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
          <div className="flex items-center space-x-3 sm:space-x-3.5">
            <button
              onClick={onBackToDashboard}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md flex items-center justify-center text-white transition cursor-pointer shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
                <span>{isCommerceSettings ? commercePage.title : 'Store Settings'}</span>
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-blue-100">
                  TiwiMart Engine
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-blue-100/80 mt-0.5">
                {isCommerceSettings
                  ? commercePage.description
                  : 'Marketplace theme catalog, brand identity, favicon, colors, and sliding hero banners'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.open(liveStoreUrl, '_blank', 'noopener,noreferrer')}
              className="flex-1 sm:flex-none justify-center px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-md text-white text-xs font-semibold flex items-center space-x-1.5 sm:space-x-2 transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live Store</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="flex-1 sm:flex-none justify-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold flex items-center space-x-1.5 sm:space-x-2 transition shadow-md cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4 NAVIGATION TABS                                         */}
      {/* ========================================================= */}
      {isCommerceSettings ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-4">
          {[
            {
              id: 'payments',
              label: 'Payments',
              description: 'Gateways & currency',
              icon: CreditCard,
              onClick: () => {
                if (onNavigateToPayments) onNavigateToPayments();
                else if (onNavigateToPaymentShipping) onNavigateToPaymentShipping();
                else setActiveTab('payments');
              }
            },
            {
              id: 'shipping',
              label: 'Shipping',
              description: 'Rates, zones & tax',
              icon: Truck,
              onClick: () => onNavigateToShipping ? onNavigateToShipping() : setActiveTab('shipping')
            },
            {
              id: 'promotions',
              label: 'Promo Codes',
              description: 'Checkout discounts',
              icon: Tag,
              onClick: () => onNavigateToPromotions ? onNavigateToPromotions() : setActiveTab('promotions')
            },
            {
              id: 'store-settings',
              label: 'Storefront & Theme',
              description: 'Brand & appearance',
              icon: ArrowLeft,
              onClick: () => onNavigateToStoreSettings?.()
            }
          ].map(item => {
            const Icon = item.icon;
            const selected = item.id === activeTab || (item.id === 'payments' && activeTab === 'commerce');
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                aria-current={selected ? 'page' : undefined}
                className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 text-left transition ${
                  selected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-gray-700/70'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{item.label}</span>
                  <span className={`mt-0.5 block truncate text-[10px] ${selected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-gray-800 pb-3 overflow-x-auto no-scrollbar">
          <>
        <button
          onClick={() => setActiveTab('theme')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'theme'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Choose Theme (Marketplace)</span>
        </button>

        <button
          onClick={() => setActiveTab('identity')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'identity'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Store Info & Logo</span>
        </button>

        <button
          onClick={() => {
            if (onNavigateToPayments) onNavigateToPayments();
            else if (onNavigateToPaymentShipping) onNavigateToPaymentShipping();
            else setActiveTab('payments');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payments</span>
        </button>

        <button
          onClick={() => setActiveTab('colors')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'colors'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Theme Colors</span>
        </button>

        <button
          onClick={() => setActiveTab('banners')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'banners'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Slider Banners</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
            {currentBanners.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pages')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            activeTab === 'pages'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Pages & Menus</span>
        </button>
          </>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: CHOOSE THEME (STOREFRONT THEMES)                   */}
      {/* ========================================================= */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          {/* Theme Search & Filters Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>Storefront Themes</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                    Official Storefront
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Production-ready, high-converting eCommerce storefront themes built for Tiwlo sellers
                </p>
              </div>

              {/* Live Search Input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={themeSearch}
                  onChange={(e) => setThemeSearch(e.target.value)}
                  placeholder="Search themes, features, styles..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-blue-500 transition"
                />
                {themeSearch && (
                  <button
                    onClick={() => setThemeSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 dark:border-gray-700/60">
              {THEME_CATEGORIES.map((cat) => {
                const isSelected = selectedThemeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedThemeCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-gray-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Themes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredThemes.map((theme) => {
              const isCurrentActive = theme.id === 'TiwiMart';

              return (
                <div
                  key={theme.id}
                  className={`bg-white dark:bg-gray-800 rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                    isCurrentActive
                      ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20'
                      : 'border-slate-200/90 dark:border-gray-700/80 shadow-xs hover:border-slate-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div>
                    {/* Theme Preview Banner */}
                    <div className="relative h-48 bg-slate-100 dark:bg-gray-900 overflow-hidden group">
                      <img
                        src={theme.previewImage}
                        alt={theme.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />

                      {/* Status Badges Overlay */}
                      <div className="absolute top-3 left-3 flex items-center space-x-2">
                        {isCurrentActive ? (
                          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            <span>Installed & Active</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.8 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-semibold">
                            {theme.category}
                          </span>
                        )}
                      </div>

                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-0.8 rounded-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-[10px] font-mono font-bold text-slate-800 dark:text-slate-200 shadow-xs">
                          v{theme.version}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-5 space-y-3.5">
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {theme.category}
                          </span>
                          <div className="flex items-center space-x-1 text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {theme.rating}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              ({theme.reviewsCount})
                            </span>
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {theme.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {theme.tagline}
                        </p>
                      </div>

                      {/* Features Chips */}
                      {Array.isArray(theme.features) && theme.features.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {theme.features.slice(0, 4).map((feat, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-gray-700/60 text-slate-600 dark:text-slate-300 font-medium"
                            >
                              {feat}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-100 dark:border-gray-700/60 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Author: <strong className="text-slate-700 dark:text-slate-300">{theme.author}</strong></span>
                        <span className="font-mono text-emerald-600 font-bold">{theme.price}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-5 pt-0">
                    {isCurrentActive ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(liveStoreUrl, '_blank', 'noopener,noreferrer')}
                          className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-xs cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Live Store</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('banners')}
                          className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                        >
                          Manage Banners
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showToast?.(`TiwiMart is your current active theme. ${theme.name} catalog info loaded.`)}
                        className="w-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Preview Theme Demo</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredThemes.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-12 text-center space-y-3">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No themes match "{themeSearch}"
              </p>
              <button
                onClick={() => {
                  setThemeSearch('');
                  setSelectedThemeCategory('All Themes');
                }}
                className="px-4 py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: STORE INFO & LOGO (STORE IDENTITY & FAVICON)        */}
      {/* ========================================================= */}
      {(activeTab === 'identity' || isCommerceSettings) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Store Identity & Meta SEO (lg:col-span-7) */}
          <div className={`${isCommerceSettings ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-6`}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 dark:border-gray-700 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  {isCommerceSettings
                    ? <CreditCard className="w-4 h-4 text-blue-500" />
                    : <Store className="w-4 h-4 text-blue-500" />}
                  <span>{isCommerceSettings ? commercePage.title : 'Store Identity & Meta Information'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isCommerceSettings
                    ? commercePage.description
                    : 'Configure storefront name, branding tagline, browser title, and SEO description'}
                </p>
              </div>

              <div className="space-y-4">
                {activeTab === 'identity' && (
                  <>
                {/* Store Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store Name
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="TiwloMart"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white font-semibold outline-none focus:border-blue-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Displayed in top navigation, email receipts, and header branding
                  </p>
                </div>

                {/* Store Tagline */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store Tagline
                  </label>
                  <input
                    type="text"
                    value={storeTagline}
                    onChange={(e) => setStoreTagline(e.target.value)}
                    placeholder="Shop Global • Sell Global"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Catchy store motto displayed beneath your brand name
                  </p>
                </div>

                {/* Store Title (Browser Title & SEO Title) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store Page Title (Browser Tab & Meta Title)
                  </label>
                  <input
                    type="text"
                    value={storeTitle}
                    onChange={(e) => setStoreTitle(e.target.value)}
                    placeholder="TiwloMart | Global Multi-Vendor eCommerce Marketplace"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-blue-500 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Appears in the browser tab and search engine results
                  </p>
                </div>

                {/* Store Description (SEO & Store Summary) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Store Description (SEO Meta Description & About)
                  </label>
                  <textarea
                    rows={3}
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    placeholder="Discover millions of quality products from verified global sellers with fast international shipping..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500 transition resize-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Short description for social sharing, search engine snippets, and footer
                  </p>
                </div>

                <div className="border-t border-slate-100 dark:border-gray-700 pt-4 space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Store Address & Contact</h3>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Street address
                    <input
                      value={storeAddress}
                      onChange={e => setStoreAddress(e.target.value)}
                      maxLength={240}
                      autoComplete="street-address"
                      className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ['City', storeCity, setStoreCity, 'address-level2'],
                      ['Country', storeCountry, setStoreCountry, 'country-name'],
                      ['Postal code', storePostalCode, setStorePostalCode, 'postal-code']
                    ].map(([label, value, setter, autoComplete]) => (
                      <label key={label} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {label}
                        <input
                          value={value}
                          onChange={e => setter(e.target.value)}
                          maxLength={100}
                          autoComplete={autoComplete}
                          className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Store contact email
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={e => setContactEmail(e.target.value)}
                        maxLength={254}
                        autoComplete="email"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Store contact phone
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)}
                        maxLength={40}
                        autoComplete="tel"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                </div>

                </>)}

                <div className={`border-t border-slate-100 dark:border-gray-700 pt-4 space-y-3 ${activeTab === 'shipping' ? '' : 'hidden'}`}>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Delivery & Tax</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Configure international destinations, per-country tax, parcel-weight rates, and delivery estimates. Checkout shows these saved estimates; it does not book a carrier.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ['Tax rate (%)', taxRate, setTaxRate],
                      ['Flat shipping rate', shippingFlatRate, setShippingFlatRate],
                      ['Free shipping threshold', freeShippingThreshold, setFreeShippingThreshold]
                    ].map(([label, value, setter]) => (
                      <label key={label} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {label}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={value}
                          onChange={e => setter(e.target.value)}
                          className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">Destination shipping zones</h4>
                        <p className="text-[10px] text-slate-500">Create country/city zones and set the manual method and rates that apply to each destination.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShippingZones(current => [...current, {
                          id: `shipping-zone-${Date.now()}`,
                          name: '',
                          countries: '',
                          destinations: [],
                          shippingMethod: 'Standard shipping',
                          rate: 0,
                          perKgRate: '',
                          taxRate: '',
                          freeShippingThreshold: '',
                          minDeliveryDays: '',
                          maxDeliveryDays: '',
                          enabled: true,
                          codEnabled: true
                        }])}
                        className="rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:text-blue-300"
                      >
                        Add shipping zone
                      </button>
                    </div>
                    {shippingZones.map((zone, index) => (
                      <section key={zone.id || index} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Zone name
                          <input
                            value={zone.name || ''}
                            maxLength={80}
                            onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item
                            ))}
                            placeholder="Bangladesh / South Asia"
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <div className="space-y-2 sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Add destination country
                            <input
                              type="search"
                              value={shippingCountrySearch}
                              onChange={event => setShippingCountrySearch(event.target.value)}
                              placeholder="Filter country list"
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                            <div className="mt-1 flex gap-2">
                              <select
                                value={shippingCountryCode}
                                onChange={event => setShippingCountryCode(event.target.value)}
                                disabled={!shippingCountries.length}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              >
                                <option value="">{shippingCountryError ? 'Country list unavailable' : 'Search/select a country'}</option>
                                {matchingShippingCountries.map(country => (
                                  <option key={country.code} value={country.code}>{country.name}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => addShippingCountry(index)}
                                disabled={!shippingCountryCode || !shippingCountries.length}
                                className="shrink-0 rounded-lg border border-blue-200 px-3 py-2 text-[11px] font-bold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300"
                              >
                                Add country
                              </button>
                            </div>
                          </label>
                          {shippingCountryError && <p role="alert" className="text-[10px] text-rose-600">{shippingCountryError}</p>}
                          {Array.isArray(zone.countries) && zone.countries.length > 0 && (
                            <p className="text-[10px] text-amber-700 dark:text-amber-300">
                              Existing text destinations are retained: {zone.countries.join(', ')}
                            </p>
                          )}
                          <div className="space-y-2">
                            {(zone.destinations || []).map((destination, destinationIndex) => {
                              const searchKey = `${zone.id || index}-${destination.countryCode}`;
                              const cityResults = shippingCityResults[searchKey] || [];
                              return (
                                <section key={destination.countryCode} className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-gray-700 dark:bg-gray-900/50">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <label className="inline-flex min-w-0 flex-1 items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                      <input
                                        type="checkbox"
                                        checked={destination.enabled !== false}
                                        onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                              ...item,
                                              destinations: item.destinations.map((entry, entryIndex) =>
                                                entryIndex === destinationIndex ? { ...entry, enabled: event.target.checked } : entry
                                              )
                                            }
                                            : item
                                        ))}
                                      />
                                      <span className="truncate">{destination.countryName} ({destination.countryCode})</span>
                                    </label>
                                    <span className="text-[10px] text-slate-500">
                                      {destination.cities?.length ? `${destination.cities.length} selected cities` : 'All cities'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setShippingZones(current => current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, destinations: item.destinations.filter((_, entryIndex) => entryIndex !== destinationIndex) }
                                          : item
                                      ))}
                                      className="text-[10px] font-semibold text-rose-600"
                                    >
                                      Remove country
                                    </button>
                                  </div>
                                  {destination.cities?.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {destination.cities.map(city => (
                                        <button
                                          key={city}
                                          type="button"
                                          onClick={() => setShippingZones(current => current.map((item, itemIndex) =>
                                            itemIndex === index
                                              ? {
                                                ...item,
                                                destinations: item.destinations.map((entry, entryIndex) => entryIndex === destinationIndex
                                                  ? { ...entry, cities: entry.cities.filter(value => value !== city) }
                                                  : entry)
                                              }
                                              : item
                                          ))}
                                          className="rounded-full bg-white px-2 py-1 text-[10px] text-slate-600 dark:bg-gray-800 dark:text-slate-300"
                                        >
                                          {city} ×
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-2 flex gap-2">
                                    <input
                                      value={shippingCitySearch[searchKey] || ''}
                                      onChange={event => setShippingCitySearch(current => ({ ...current, [searchKey]: event.target.value }))}
                                      onKeyDown={event => {
                                        if (event.key === 'Enter') {
                                          event.preventDefault();
                                          searchShippingCities(destination.countryCode, searchKey);
                                        }
                                      }}
                                      placeholder="Search cities (leave empty for all)"
                                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => searchShippingCities(destination.countryCode, searchKey)}
                                      disabled={loadingShippingCities[searchKey]}
                                      className="rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-bold disabled:opacity-50 dark:border-gray-700"
                                    >
                                      {loadingShippingCities[searchKey] ? 'Searching…' : 'Search'}
                                    </button>
                                  </div>
                                  {cityResults.length > 0 && (
                                    <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                                      {cityResults.map(city => (
                                        <button
                                          key={city}
                                          type="button"
                                          disabled={(destination.cities || []).includes(city)}
                                          onClick={() => addShippingCity(index, destinationIndex, city)}
                                          className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 disabled:opacity-40 dark:border-blue-800 dark:bg-gray-800 dark:text-blue-300"
                                        >
                                          {city} +
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            City data: GeoNames Gazetteer (CC BY 4.0), about 171,000 populated places; this does not include every village, neighborhood, or postal locality.
                          </p>
                        </div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Shipping method / service label
                          <select
                            value={['Standard shipping', 'Express courier', 'Air freight', 'Sea freight'].includes(zone.shippingMethod) ? zone.shippingMethod : 'Custom method'}
                            onChange={event => updateShippingZone(index, { shippingMethod: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          >
                            {['Standard shipping', 'Express courier', 'Air freight', 'Sea freight', 'Custom method'].map(method => (
                              <option key={method} value={method}>{method}</option>
                            ))}
                          </select>
                          {!['Standard shipping', 'Express courier', 'Air freight', 'Sea freight'].includes(zone.shippingMethod) && (
                            <input
                              value={zone.shippingMethod === 'Custom method' ? '' : zone.shippingMethod || ''}
                              onChange={event => updateShippingZone(index, { shippingMethod: event.target.value })}
                              maxLength={80}
                              placeholder="Enter custom service label"
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                          )}
                        </label>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Rate ({settings.currency || 'USD'})
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={zone.rate ?? 0}
                            onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, rate: event.target.value } : item
                            ))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Additional rate per kg ({settings.currency || 'USD'})
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={zone.perKgRate ?? ''}
                            onChange={event => updateShippingZone(index, { perKgRate: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Destination tax rate override (%)
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={zone.taxRate ?? ''}
                            onChange={event => updateShippingZone(index, { taxRate: event.target.value })}
                            placeholder={`Default ${taxRate}%`}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Free shipping at subtotal
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={zone.freeShippingThreshold ?? ''}
                            onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, freeShippingThreshold: event.target.value } : item
                            ))}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ['Min delivery days', 'minDeliveryDays'],
                            ['Max delivery days', 'maxDeliveryDays']
                          ].map(([label, key]) => (
                            <label key={key} className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {label}
                              <input
                                type="number"
                                min="0"
                                max="365"
                                step="1"
                                value={zone[key] ?? ''}
                                onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, [key]: event.target.value } : item
                                ))}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={zone.enabled !== false}
                              onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, enabled: event.target.checked } : item
                              ))}
                            />
                            Zone enabled
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={zone.codEnabled !== false}
                              onChange={event => setShippingZones(current => current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, codEnabled: event.target.checked } : item
                              ))}
                            />
                            Allow COD
                          </label>
                          <button
                            type="button"
                            onClick={() => setShippingZones(current => current.filter((_, itemIndex) => itemIndex !== index))}
                            className="ml-auto text-rose-600"
                          >
                            Remove zone
                          </button>
                        </div>
                      </section>
                    ))}
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3 text-[11px] text-amber-900 dark:text-amber-200">
                    These are your manual international shipping rules and service labels, not live courier quotes or bookings. Actual carrier availability, customs duties, and delivery times must be confirmed with your provider. Book shipments with the carrier, then save its tracking details in Courier.
                  </div>
                </div>

                <div className={`border-t border-slate-100 dark:border-gray-700 pt-4 space-y-3 ${activeTab === 'promotions' ? '' : 'hidden'}`}>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">International promotion</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Set one checkout code with country eligibility, a minimum spend, redemption limits, and a scheduled campaign. Fixed discounts use your store currency ({settings.currency || 'USD'}).
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={promoActive}
                      onChange={event => setPromoActive(event.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Enable promotion code
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Campaign code
                      <input
                        type="text"
                        value={promoCode}
                        onChange={event => setPromoCode(event.target.value.toUpperCase())}
                        maxLength={32}
                        pattern="[A-Za-z0-9_-]{1,32}"
                        placeholder="e.g. SAVE10"
                        autoComplete="off"
                        aria-describedby="promo-code-help"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                      <span id="promo-code-help" className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                        Letters, numbers, hyphens, and underscores.
                      </span>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Discount type
                      <select
                        value={promoDiscountType}
                        onChange={event => setPromoDiscountType(event.target.value)}
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      >
                        <option value="percent">Percentage off</option>
                        <option value="fixed">Fixed amount off</option>
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {promoDiscountType === 'fixed' ? `Discount amount (${settings.currency || 'USD'})` : 'Discount percent'}
                      <input
                        type="number"
                        value={promoDiscountPercent}
                        onChange={event => setPromoDiscountPercent(event.target.value)}
                        min="0"
                        max={promoDiscountType === 'percent' ? '100' : undefined}
                        step="0.01"
                        required={promoActive}
                        placeholder={promoDiscountType === 'fixed' ? 'e.g. 10.00' : 'e.g. 10'}
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Minimum order ({settings.currency || 'USD'})
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={promoMinimumSubtotal}
                        onChange={event => setPromoMinimumSubtotal(event.target.value)}
                        placeholder="No minimum"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Maximum discount ({settings.currency || 'USD'})
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={promoMaximumDiscount}
                        onChange={event => setPromoMaximumDiscount(event.target.value)}
                        placeholder="No cap"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Starts at (your local time)
                      <input
                        type="datetime-local"
                        value={promoStartsAt}
                        onChange={event => setPromoStartsAt(event.target.value)}
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Ends at (your local time)
                      <input
                        type="datetime-local"
                        value={promoEndsAt}
                        min={promoStartsAt || undefined}
                        onChange={event => setPromoEndsAt(event.target.value)}
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Total redemptions
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        value={promoUsageLimit}
                        onChange={event => setPromoUsageLimit(event.target.value)}
                        placeholder="Unlimited"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                      <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-slate-400">Use 0 or leave blank for unlimited.</span>
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Uses per customer
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        value={promoPerCustomerLimit}
                        onChange={event => setPromoPerCustomerLimit(event.target.value)}
                        placeholder="Unlimited"
                        className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      />
                      <span className="mt-1 block text-[10px] font-normal text-slate-500 dark:text-slate-400">Matched by customer email or phone.</span>
                    </label>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100">Eligible delivery countries</h4>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          Leave all countries unchecked to make this code available worldwide.
                        </p>
                      </div>
                      {promoAllowedCountries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPromoAllowedCountries([])}
                          className="text-[10px] font-semibold text-blue-700 hover:underline dark:text-blue-300"
                        >
                          Clear country limits
                        </button>
                      )}
                    </div>
                    <input
                      type="search"
                      value={promoCountrySearch}
                      onChange={event => setPromoCountrySearch(event.target.value)}
                      placeholder="Search countries"
                      aria-label="Search promotion countries"
                      className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                    {shippingCountryError && !shippingCountries.length ? (
                      <p role="alert" className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">{shippingCountryError}</p>
                    ) : (
                      <div className="mt-2 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                        {shippingCountries
                          .filter(country => country.name.toLowerCase().includes(promoCountrySearch.trim().toLowerCase()))
                          .map(country => (
                            <label key={country.code} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-gray-700/60">
                              <input
                                type="checkbox"
                                checked={promoAllowedCountries.includes(country.code)}
                                onChange={event => setPromoAllowedCountries(current =>
                                  event.target.checked
                                    ? [...new Set([...current, country.code])]
                                    : current.filter(code => code !== country.code)
                                )}
                              />
                              <span>{country.name}</span>
                            </label>
                          ))}
                        {!shippingCountries.length && !shippingCountryError && (
                          <p className="py-2 text-[11px] text-slate-500">Loading country list…</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`border-t border-slate-100 dark:border-gray-700 pt-4 space-y-4 ${activeTab === 'payments' || activeTab === 'commerce' ? '' : 'hidden'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">Currency conversion rates</h3>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Store price currency: <strong>{currencyConfiguration?.storeCurrency || settings.currency || 'USD'}</strong>.
                        Rates are per 1 USD and saved separately for this store.
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${currencyConfiguration?.fresh ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                      {currencyConfiguration?.fresh
                        ? (currencyMode === 'api' ? `Reference rates · ${currencyConfiguration.observedAt || 'current'}` : 'Manual rates')
                        : 'No usable rates'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={refreshCurrencyRates}
                      disabled={refreshingCurrencyRates}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${refreshingCurrencyRates ? 'animate-spin' : ''}`} />
                      {refreshingCurrencyRates ? 'Refreshing reference rates…' : 'Refresh market rates'}
                    </button>
                    <button
                      type="button"
                      onClick={switchToManualCurrencyRates}
                      disabled={!currencyConfiguration}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 disabled:opacity-60 dark:border-gray-700 dark:text-slate-200"
                    >
                      Enter rates manually
                    </button>
                  </div>
                  {currencyMode === 'api' && (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 text-slate-500 dark:bg-gray-900">
                          <tr>
                            <th className="px-3 py-2">Reference</th>
                            <th className="px-3 py-2">Per 1 USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commonCurrencyCodes.map(code => (
                            <tr key={code} className="border-t border-slate-100 dark:border-gray-700">
                              <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{code}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                {currencyConfiguration?.rates?.[code] ?? 'Not available'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {currencyMode === 'manual' && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Enter how many units of each currency equal 1 USD. Verify these amounts with your bank or payment provider before enabling any live transactions.
                      </p>
                      <div className="space-y-2">
                        {Object.entries(currencyRates)
                          .filter(([code]) => code !== 'USD')
                          .map(([code, rate]) => (
                            <div key={code} className="grid grid-cols-[minmax(70px,0.5fr)_minmax(120px,1fr)_auto] items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">1 USD = {code}</span>
                              <input
                                type="number"
                                min="0.00000001"
                                step="any"
                                value={rate}
                                onChange={event => setCurrencyRates(current => ({
                                  ...current,
                                  [code]: event.target.value
                                }))}
                                aria-label={`USD to ${code} exchange rate`}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => setCurrencyRates(current => {
                                  const next = { ...current };
                                  delete next[code];
                                  return next;
                                })}
                                className="px-2 text-[10px] font-semibold text-rose-600"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                      </div>
                      <div className="grid grid-cols-[minmax(70px,0.5fr)_minmax(120px,1fr)_auto] gap-2">
                        <input
                          type="text"
                          value={newCurrencyCode}
                          onChange={event => setNewCurrencyCode(event.target.value.toUpperCase())}
                          maxLength={3}
                          placeholder="Code"
                          aria-label="Currency ISO code"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs uppercase dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          min="0.00000001"
                          step="any"
                          value={newCurrencyRate}
                          onChange={event => setNewCurrencyRate(event.target.value)}
                          placeholder="Units per 1 USD"
                          aria-label="Manual currency rate"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={addManualCurrencyRate}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold dark:border-gray-700"
                        >
                          Add
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={saveCurrencySettings}
                        disabled={savingCurrencySettings}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60"
                      >
                        {savingCurrencySettings ? 'Saving…' : 'Save manual rates'}
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Amount in {currencyConfiguration?.storeCurrency || 'store currency'}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={conversionAmount}
                        onChange={event => setConversionAmount(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Convert to currency
                      <select
                        value={selectedConversionCurrency}
                        onChange={event => setConversionTarget(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        {!conversionCurrencies.length && <option value="">No rates available</option>}
                        {conversionCurrencies.map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={previewCurrencyConversion}
                      disabled={previewingConversion || !currencyConfiguration?.fresh || !selectedConversionCurrency}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold disabled:opacity-60 dark:border-gray-700"
                    >
                      {previewingConversion ? 'Converting…' : 'Preview'}
                    </button>
                    {conversionPreview && (
                      <p className="sm:col-span-3 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {conversionPreview.amount.toLocaleString()} {conversionPreview.toCurrency}
                        {' '}· 1 {conversionPreview.fromCurrency} = {conversionPreview.exchangeRate.toPrecision(7)} {conversionPreview.toCurrency}
                        {' '}· {conversionPreview.source}{conversionPreview.observedAt ? ` (${conversionPreview.observedAt})` : ''}
                        {' '}· estimate only, no gateway payment is initiated
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-200">
                    <p>
                      <a href="https://frankfurter.dev" target="_blank" rel="noreferrer" className="font-bold underline">Frankfurter</a>
                      {' '}provides daily blended reference rates from central-bank sources, not guaranteed gateway settlement or bank rates. Rates are cached server-side; stale API data is rejected. Online checkout uses each gateway's supported store currencies.
                    </p>
                  </div>
                </div>

                <div className={`border-t border-slate-100 dark:border-gray-700 pt-4 space-y-4 ${activeTab === 'payments' || activeTab === 'commerce' ? '' : 'hidden'}`}>
                  <section className="rounded-xl border border-slate-200 p-3 dark:border-gray-700">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={refundRequestsEnabled}
                        onChange={event => setRefundRequestsEnabled(event.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-xs font-bold text-slate-900 dark:text-white">Allow customer refund requests</span>
                        <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">
                          Customers can submit requests from their account. Turning this off hides the request action and rejects new requests; existing requests remain available in Sales &amp; Orders.
                        </span>
                      </span>
                    </label>
                  </section>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Store Payment Gateways</h3>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Each store connects its own merchant account. Secrets are encrypted before saving and never returned to the browser. Paid status is recorded only after the provider verifies the transaction. Nagad online checkout is not available yet.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {paymentProviders.map(provider => (
                      <section key={provider.id} className="rounded-xl border border-slate-200 dark:border-gray-700 p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{provider.name}</h4>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {provider.configured
                                ? `${provider.enabled ? 'Enabled' : 'Disabled'} · ${provider.mode} · ${provider.checkoutReady ? 'checkout ready' : 'checkout unavailable'}`
                                : 'Merchant account not connected'}
                              {' · '}Supported currencies: {provider.currencies.join(', ')}
                            </p>
                            {provider.id === 'stripe' && provider.checkoutReady && (
                              <p className="mt-1 text-[10px] text-slate-500">
                                Configure Stripe webhook endpoint <code>https://&lt;store-domain&gt;/api/public/payments/stripe/webhook</code> for checkout.session.completed, checkout.session.async_payment_succeeded, refund.created, refund.updated, and refund.failed.
                              </p>
                            )}
                          </div>
                          <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={provider.enabled}
                              onChange={event => setPaymentProviders(current => current.map(item =>
                                item.id === provider.id ? { ...item, enabled: event.target.checked } : item
                              ))}
                            />
                            Enable
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Environment
                            <select
                              value={provider.mode}
                              onChange={event => setPaymentProviders(current => current.map(item =>
                                item.id === provider.id ? { ...item, mode: event.target.value } : item
                              ))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            >
                              <option value="sandbox">Sandbox / test</option>
                              <option value="live">Live</option>
                            </select>
                          </label>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Payment fee percent
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={provider.feePercent}
                              onChange={event => setPaymentProviders(current => current.map(item =>
                                item.id === provider.id ? { ...item, feePercent: event.target.value } : item
                              ))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Fixed fee ({settings.currencySymbol || '$'} in store currency)
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={provider.feeFixed}
                              onChange={event => setPaymentProviders(current => current.map(item =>
                                item.id === provider.id ? { ...item, feeFixed: event.target.value } : item
                              ))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            />
                          </label>
                          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            Fee handling
                            <select
                              value={provider.feeMode}
                              onChange={event => setPaymentProviders(current => current.map(item =>
                                item.id === provider.id ? { ...item, feeMode: event.target.value } : item
                              ))}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            >
                              <option value="included">Store pays / included in price</option>
                              <option value="customer">Add fee to customer total</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {provider.credentialFields.map(field => (
                            <label key={field} className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {paymentCredentialLabels[field] || field}
                              {field.toLowerCase().includes('privatekey') || field.toLowerCase().includes('publickey') ? (
                                <textarea
                                  rows="3"
                                  value={paymentCredentials[provider.id]?.[field] || ''}
                                  onChange={event => setPaymentCredentials(current => ({
                                    ...current,
                                    [provider.id]: { ...(current[provider.id] || {}), [field]: event.target.value }
                                  }))}
                                  placeholder={provider.configured ? 'Leave blank to keep saved credential' : 'Paste merchant PEM key'}
                                  autoComplete="off"
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[10px] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              ) : (
                                <input
                                  type="password"
                                  value={paymentCredentials[provider.id]?.[field] || ''}
                                  onChange={event => setPaymentCredentials(current => ({
                                    ...current,
                                    [provider.id]: { ...(current[provider.id] || {}), [field]: event.target.value }
                                  }))}
                                  placeholder={provider.configured ? 'Leave blank to keep saved credential' : 'Enter merchant credential'}
                                  autoComplete="new-password"
                                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                />
                              )}
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={savingPaymentProvider === provider.id}
                          onClick={() => savePaymentProvider(provider)}
                          className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          {savingPaymentProvider === provider.id ? 'Saving securely...' : `Save ${provider.name}`}
                        </button>
                      </section>
                    ))}
                    {!paymentProviders.length && (
                      <p className="text-[11px] text-slate-500">Loading gateway providers…</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-2 transition shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : isCommerceSettings ? `Save ${commercePage.title}` : 'Save Identity Info'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Logo & Favicon Assets (lg:col-span-5) */}
          {activeTab === 'identity' && <div className="lg:col-span-5 space-y-6">
            {/* 1. STORE LOGO */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Store Logo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Main storefront brand logo
                  </p>
                </div>

                {settings.storeLogo && (
                  <button
                    type="button"
                    onClick={resetToDefaultLogo}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center space-x-1 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Logo Preview if uploaded */}
              {settings.storeLogo && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-gray-900/60 border border-slate-200/70 dark:border-gray-700 flex items-center justify-center">
                  <img
                    src={settings.storeLogo}
                    alt="Store Logo"
                    className="max-h-14 max-w-[200px] object-contain"
                  />
                </div>
              )}

              {/* Logo Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsLogoDragging(true);
                }}
                onDragLeave={() => setIsLogoDragging(false)}
                onDrop={handleLogoDrop}
                onClick={() => logoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                  isLogoDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-gray-700 hover:border-blue-400 bg-slate-50/50 dark:bg-gray-900/40'
                }`}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={(e) => {
                    if (e.target.files?.[0]) processLogoFile(e.target.files[0]);
                  }}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  {uploadingLogo ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    {uploadingLogo ? 'Uploading logo...' : 'Click or drop logo image'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Recommended: PNG, SVG, or WEBP (transparent)
                  </p>
                </div>
              </div>
            </div>

            {/* 2. STORE FAVICON */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Store Favicon
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Icon shown in browser tabs & bookmarks
                  </p>
                </div>

                {settings.storeFavicon && (
                  <button
                    type="button"
                    onClick={resetToDefaultFavicon}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold flex items-center space-x-1 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Browser Tab Simulation Preview */}
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-700">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Browser Tab Preview
                </p>
                <div className="bg-white dark:bg-gray-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-gray-700 flex items-center space-x-2.5 shadow-xs">
                  {settings.storeFavicon ? (
                    <img
                      src={settings.storeFavicon}
                      alt="Favicon"
                      className="w-4 h-4 object-contain rounded-xs"
                    />
                  ) : (
                    <div
                      className="w-4 h-4 rounded-xs text-white flex items-center justify-center text-[9px] font-black"
                      style={{ backgroundColor: safeColor }}
                    >
                      T
                    </div>
                  )}
                  <span className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                    {storeTitle || 'TiwloMart | Global Marketplace'}
                  </span>
                </div>
              </div>

              {/* Favicon Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsFaviconDragging(true);
                }}
                onDragLeave={() => setIsFaviconDragging(false)}
                onDrop={handleFaviconDrop}
                onClick={() => faviconInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 ${
                  isFaviconDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-gray-700 hover:border-blue-400 bg-slate-50/50 dark:bg-gray-900/40'
                }`}
              >
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png, image/x-icon, image/svg+xml, image/webp"
                  onChange={(e) => {
                    if (e.target.files?.[0]) processFaviconFile(e.target.files[0]);
                  }}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  {uploadingFavicon ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    {uploadingFavicon ? 'Uploading favicon...' : 'Click or drop favicon file'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Recommended: 32x32 or 64x64 PNG or ICO
                  </p>
                </div>
              </div>
            </div>
          </div>}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: THEME COLORS                                       */}
      {/* ========================================================= */}
      {activeTab === 'colors' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Palette className="w-4 h-4 text-blue-500" />
                <span>Theme Color Palette</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select an expertly curated color palette or enter your own custom brand hex
              </p>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(Array.isArray(THEME_COLOR_PRESETS) ? THEME_COLOR_PRESETS : []).map((preset) => {
                const isSelected = (safeColor || '').toLowerCase() === (preset?.hex || '').toLowerCase();

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between text-left ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-900/20 shadow-xs'
                        : 'border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className="w-7 h-7 rounded-xl shadow-xs flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                          {preset.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {preset.hex.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Selector */}
            <div className="pt-4 border-t border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Custom Hex Brand Color
                </h3>
                <p className="text-[11px] text-slate-400">
                  Applies instantly across headers, search bars, CTA buttons, and badges
                </p>
              </div>

              <div className="flex items-center space-x-2.5">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={handleCustomColorChange}
                  className="w-9 h-9 rounded-xl cursor-pointer border border-slate-200 dark:border-gray-700 bg-transparent p-0.5"
                />
                <input
                  type="text"
                  value={selectedColor}
                  onChange={handleCustomColorChange}
                  placeholder="#2563eb"
                  className="w-24 px-2.5 py-1.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none uppercase focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleSelectPreset(THEME_COLOR_PRESETS[0])}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 underline cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>

          {/* Live Elements Preview Card */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Live Elements Color Preview</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-gray-900/50 border border-slate-200/70 dark:border-gray-700/70">
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl text-white font-bold text-xs shadow-xs"
                style={{ backgroundColor: safeColor }}
              >
                Primary CTA Button
              </button>

              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl border-2 font-bold text-xs"
                style={{ borderColor: safeColor, color: safeColor }}
              >
                Outline Button
              </button>

              <div
                className="w-full py-2.5 px-4 rounded-xl text-center text-xs font-bold flex items-center justify-center space-x-1.5"
                style={{
                  backgroundColor: `${safeColor}18`,
                  color: safeColor,
                  border: `1px solid ${safeColor}40`
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active Accent Badge</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: SLIDER BANNERS (THEME BANNERS MANAGER)             */}
      {/* ========================================================= */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
          {/* Header & Controls Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span>Storefront Slider Banners</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {currentBanners.length} Banners
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Manage the sliding promotional banners shown at the top of your TiwiMart storefront
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Sliding Speed selector */}
              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Speed:</span>
                <select
                  value={bannerSlidingSpeed}
                  onChange={(e) => {
                    const spd = Number(e.target.value);
                    setBannerSlidingSpeed(spd);
                    updateStoreSettings({ bannerSlidingSpeed: spd })
                      .then(() => showToast?.(`Sliding speed set to ${spd}s`))
                      .catch(() => showToast?.('Failed to save banner speed.', 'error'));
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
                >
                  <option value={3}>3 sec</option>
                  <option value={5}>5 sec (Default)</option>
                  <option value={7}>7 sec</option>
                  <option value={10}>10 sec</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsAddBannerOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Banner</span>
              </button>
            </div>
          </div>

          {/* Add New Banner Modal / Collapsible Form */}
          {isAddBannerOpen && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border-2 border-blue-500/40 p-6 shadow-md space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-gray-700 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-blue-500" />
                  <span>Add New Storefront Banner</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddBannerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Form Inputs */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Banner Title / Alt Description
                    </label>
                    <input
                      type="text"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                      placeholder="e.g. Mega Summer Flash Sale"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Banner Subtitle / Promotional Note
                    </label>
                    <input
                      type="text"
                      value={newBannerSubtitle}
                      onChange={(e) => setNewBannerSubtitle(e.target.value)}
                      placeholder="e.g. Up to 60% off trending electronics"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Target Link / Click Action
                    </label>
                    <input
                      type="text"
                      value={newBannerLink}
                      onChange={(e) => setNewBannerLink(e.target.value)}
                      placeholder="/?view=store#flash-sale"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      e.g. /?view=store#flash-sale or custom URL
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Or Banner Image URL
                    </label>
                    <input
                      type="text"
                      value={newBannerImage}
                      onChange={(e) => setNewBannerImage(e.target.value)}
                      placeholder="/banners/hero_banner_main.png or https://..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Upload & Live Preview */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Upload Banner Image
                  </label>

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsBannerDragging(true);
                    }}
                    onDragLeave={() => setIsBannerDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsBannerDragging(false);
                      if (e.dataTransfer?.files?.[0]) processBannerFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => bannerFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-1.5 ${
                      isBannerDragging
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-gray-700 hover:border-blue-400 bg-slate-50/50 dark:bg-gray-900/40'
                    }`}
                  >
                    <input
                      ref={bannerFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) processBannerFile(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                    <Upload className="w-5 h-5 text-blue-500" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {uploadingBannerImage ? 'Uploading...' : 'Click to select or drop banner image'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Recommended aspect ratio 16:9 or wide banner (JPG, PNG, WEBP)
                    </p>
                  </div>

                  {/* Live Preview Box */}
                  {newBannerImage && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-gray-700 relative h-28 bg-slate-100">
                      <img
                        src={newBannerImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white">
                        Preview
                      </span>
                    </div>
                  )}

                  {activeTab === 'pages' && (
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
                      <section className="space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h2 className="text-base font-bold text-slate-900 dark:text-white">Store pages & menus</h2>
                              <p className="mt-1 max-w-xl text-xs text-slate-500 dark:text-slate-400">
                                Create policy or information pages, add an optional image, and choose whether each page appears in the header or footer.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPageDraft(createEmptyPageDraft())}
                              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              <Plus className="h-4 w-4" /> New page
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {[
                              ['Privacy Policy', '<h1>Privacy Policy</h1><p>Last updated: [date]</p><h2>Information we collect</h2><p>Explain what customer information your store collects and why.</p><h2>How we use information</h2><p>Describe how order, contact, and delivery information is used.</p><h2>Sharing and retention</h2><p>Explain which service providers receive information and how long records are retained.</p><h2>Contact</h2><p>Contact us at [store contact email] with privacy questions.</p>'],
                              ['Terms of Service', '<h1>Terms of Service</h1><p>Last updated: [date]</p><h2>Orders and payment</h2><p>Describe order acceptance, payment, and pricing terms.</p><h2>Shipping and returns</h2><p>Link or summarize your delivery, cancellation, and return policies.</p><h2>Contact</h2><p>Contact us at [store contact email].</p>'],
                              ['Returns & Refunds', '<h1>Returns & Refunds</h1><p>Last updated: [date]</p><h2>Return eligibility</h2><p>Describe eligible items and the time window for return requests.</p><h2>How to request a return</h2><p>Explain how customers should contact your store and provide order details.</p><h2>Refund timing</h2><p>State how approved refunds are processed and typical timelines.</p>']
                            ].map(([title, content]) => (
                              <button
                                key={title}
                                type="button"
                                onClick={() => setPageDraft({
                                  ...createEmptyPageDraft(),
                                  title,
                                  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                                  content
                                })}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-slate-300"
                              >
                                Use {title} preset
                              </button>
                            ))}
                          </div>
                        </div>

                        {pageDraft && (
                          <div className="space-y-4 rounded-3xl border-2 border-blue-200 bg-white p-5 dark:border-blue-900 dark:bg-gray-800">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {storePages.some(page => page.id === pageDraft.id) ? 'Edit page' : 'Create page'}
                              </h3>
                              <button type="button" onClick={() => setPageDraft(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700" aria-label="Close editor">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Page name
                                <input value={pageDraft.title} onChange={event => setPageDraft({ ...pageDraft, title: event.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="Privacy Policy" />
                              </label>
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Page URL slug
                                <input value={pageDraft.slug} onChange={event => setPageDraft({ ...pageDraft, slug: event.target.value })} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="privacy-policy" />
                              </label>
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Menu placement
                                <select value={pageDraft.placement || 'footer'} onChange={event => setPageDraft({ ...pageDraft, placement: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white">
                                  <option value="footer">Footer menu</option>
                                  <option value="header">Header menu</option>
                                  <option value="both">Header and footer</option>
                                  <option value="hidden">No menu link (direct URL only)</option>
                                </select>
                              </label>
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Optional image URL
                                <input value={pageDraft.image || ''} onChange={event => setPageDraft({ ...pageDraft, image: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="https://… or /uploads/…" />
                                <span className="mt-2 flex items-center gap-2">
                                  <input type="file" accept="image/*" disabled={uploadingPageImage} onChange={event => {
                                    if (event.target.files?.[0]) uploadPageImage(event.target.files[0]);
                                    event.target.value = '';
                                  }} className="max-w-full text-[10px] font-normal" />
                                  {uploadingPageImage && <span className="text-[10px] text-blue-600">Uploading…</span>}
                                </span>
                              </label>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <input type="checkbox" checked={pageDraft.enabled !== false} onChange={event => setPageDraft({ ...pageDraft, enabled: event.target.checked })} />
                              Publish this page
                            </label>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Page content (HTML allowed; scripts and unsafe attributes are removed on save)
                              <textarea value={pageDraft.content || ''} onChange={event => setPageDraft({ ...pageDraft, content: event.target.value })} rows={12} maxLength={100000} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white" placeholder="<h1>About our store</h1><p>Write your page content…</p>" />
                            </label>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setPageDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-gray-600 dark:text-slate-300">Cancel</button>
                              <button type="button" onClick={savePageDraft} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save page'}</button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          {storePages.map((page, index) => (
                            <div
                              key={page.id}
                              draggable
                              onDragStart={() => setDraggedPageId(page.id)}
                              onDragOver={event => event.preventDefault()}
                              onDrop={() => {
                                moveStorePage(draggedPageId, page.id);
                                setDraggedPageId(null);
                              }}
                              onDragEnd={() => setDraggedPageId(null)}
                              className={`flex items-center gap-3 rounded-2xl border bg-white p-3 dark:border-gray-700 dark:bg-gray-800 ${draggedPageId === page.id ? 'opacity-50' : ''}`}
                            >
                              <GripVertical title="Drag to reorder" className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{page.title}</p>
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${page.enabled === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{page.enabled === false ? 'Draft' : 'Published'}</span>
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-700">{page.placement || 'footer'}</span>
                                </div>
                                <p className="truncate text-[11px] text-slate-500">#/store/page/{page.slug || page.id}</p>
                              </div>
                              <button type="button" onClick={() => setPageDraft({ ...page })} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300">Edit</button>
                              <div className="flex flex-col">
                                <button type="button" disabled={index === 0} onClick={() => moveStorePage(page.id, storePages[index - 1]?.id)} className="px-1 text-slate-400 disabled:opacity-30" aria-label={`Move ${page.title} up`}>▲</button>
                                <button type="button" disabled={index === storePages.length - 1} onClick={() => moveStorePage(page.id, storePages[index + 1]?.id)} className="px-1 text-slate-400 disabled:opacity-30" aria-label={`Move ${page.title} down`}>▼</button>
                              </div>
                              <button type="button" onClick={async () => {
                                if (!confirm(`Delete "${page.title}"?`)) return;
                                const remaining = storePages.filter(item => item.id !== page.id).map((item, order) => ({ ...item, order }));
                                try {
                                  await updateStoreSettings({ storePages: remaining });
                                  setStorePages(remaining);
                                  showToast?.('Page deleted.');
                                } catch (error) {
                                  showToast?.(error.message || 'Failed to delete page.', 'error');
                                }
                              }} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${page.title}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <span className="hidden text-[10px] text-slate-400 sm:inline">#{index + 1}</span>
                            </div>
                          ))}
                          {storePages.length === 0 && !pageDraft && (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-gray-700">
                              No custom pages yet. Start with a policy preset or create a blank page.
                            </div>
                          )}
                        </div>
                      </section>

                      <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Safe content preview</h3>
                        <p className="mt-1 text-xs text-slate-500">Scripts are disabled in this isolated preview. Content is sanitized again by the server when saved.</p>
                        {pageDraft?.image && <img src={pageDraft.image} alt="" className="mt-4 max-h-48 w-full rounded-xl object-cover" />}
                        <iframe
                          title="Custom page preview"
                          sandbox=""
                          srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.65 system-ui,sans-serif;color:#334155;padding:20px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:8px}</style></head><body>${pageDraft?.content || '<p>Start writing page content to preview it here.</p>'}</body></html>`}
                          className="mt-4 h-[420px] w-full rounded-xl border border-slate-200 bg-white dark:border-gray-700"
                        />
                      </section>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-gray-700 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddBannerOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateBanner}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Storefront Slider</span>
                </button>
              </div>
            </div>
          )}

          {/* Banners List */}
          <div className="space-y-3.5">
            {currentBanners.map((banner, index) => {
              const isActive = banner.active !== false;

              return (
                <div
                  key={banner.id || index}
                  className={`bg-white dark:bg-gray-800 rounded-3xl border transition-all p-4.5 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isActive
                      ? 'border-slate-200/90 dark:border-gray-700/80'
                      : 'border-slate-200/50 dark:border-gray-800 opacity-60 bg-slate-50/50'
                  }`}
                >
                  {/* Left: Banner Thumbnail & Details */}
                  <div className="flex items-center space-x-4 min-w-0">
                    {/* Order Controls */}
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <button
                        type="button"
                        onClick={() => handleMoveBanner(index, -1)}
                        disabled={index === 0}
                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleMoveBanner(index, 1)}
                        disabled={index === currentBanners.length - 1}
                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Banner Thumbnail */}
                    <div className="w-36 sm:w-44 h-22 rounded-2xl overflow-hidden border border-slate-200 dark:border-gray-700 bg-slate-100 shrink-0 relative group">
                      <img
                        src={banner.image}
                        alt={banner.title || `Banner ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {!isActive && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center text-white text-[10px] font-bold">
                          Disabled
                        </div>
                      )}
                    </div>

                    {/* Banner Info */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {banner.title || `Slide Banner #${index + 1}`}
                        </h4>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-400 dark:bg-gray-700'
                          }`}
                        >
                          {isActive ? 'Active' : 'Hidden'}
                        </span>
                      </div>

                      {banner.subtitle && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {banner.subtitle}
                        </p>
                      )}

                      <span className="inline-flex rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Placement: Homepage hero slider
                      </span>

                      <div className="flex items-center space-x-1.5 text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate">
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{banner.link || '/?view=store'}</span>
                      </div>

                      {editingBannerId === banner.id && bannerDraft && (
                        <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">
                          {[
                            ['title', 'Banner title'],
                            ['subtitle', 'Subtitle'],
                            ['image', 'Image URL'],
                            ['link', 'Click-through URL']
                          ].map(([key, label]) => (
                            <label key={key} className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                              {label}
                              <input
                                value={bannerDraft[key] || ''}
                                onChange={event => setBannerDraft({ ...bannerDraft, [key]: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                              />
                            </label>
                          ))}
                          {bannerDraft.image && (
                            <img src={bannerDraft.image} alt="Banner preview" className="col-span-full h-28 w-full rounded-lg object-cover" />
                          )}
                          <div className="col-span-full flex justify-end gap-2">
                            <button type="button" onClick={() => { setEditingBannerId(null); setBannerDraft(null); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold dark:border-gray-600">Cancel</button>
                            <button type="button" onClick={handleSaveBanner} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">Save banner</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBannerId(banner.id);
                        setBannerDraft({
                          title: banner.title || '',
                          subtitle: banner.subtitle || '',
                          image: banner.image || '',
                          link: banner.link || ''
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-600 dark:text-slate-300 dark:hover:bg-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleBannerActive(banner)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-slate-300'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isActive ? 'Disable' : 'Enable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(banner.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition cursor-pointer"
                      title="Delete Banner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reset Banners Option */}
          <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Changes to slider banners appear immediately on your live storefront.</span>
            <button
              type="button"
              onClick={async () => {
                if (confirm('Reset slider banners to default 3 themes banners?')) {
                  await resetToDefaultBanners();
                  showToast?.('Slider banners reset to default');
                }
              }}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 font-semibold underline cursor-pointer"
            >
              Reset to 3 Default Banners
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreSettingsView(props) {
  return (
    <StoreSettingsProvider>
      <StoreSettingsContent {...props} />
    </StoreSettingsProvider>
  );
}
