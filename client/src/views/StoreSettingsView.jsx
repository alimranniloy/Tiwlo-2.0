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
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  Link as LinkIcon,
  Clock
} from 'lucide-react';
import { StoreSettingsProvider, useStoreSettings } from '../context/StoreSettingsContext';
import { THEME_COLOR_PRESETS, AVAILABLE_THEMES, THEME_CATEGORIES, DEFAULT_HERO_BANNERS } from '../themes/themeConfig';

function StoreSettingsContent({ showToast, onBackToDashboard }) {
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

  // Active navigation tab ('theme' | 'identity' | 'colors' | 'banners')
  const [activeTab, setActiveTab] = useState('theme');

  // Store Identity & SEO Form State
  const [storeName, setStoreName] = useState(settings.storeName || 'TiwloMart');
  const [storeTagline, setStoreTagline] = useState(settings.storeTagline || 'Shop Global • Sell Global');
  const [storeTitle, setStoreTitle] = useState(settings.storeTitle || 'TiwloMart | Global Multi-Vendor eCommerce Marketplace');
  const [storeDescription, setStoreDescription] = useState(settings.storeDescription || 'Discover millions of quality products from verified global sellers with fast international shipping and secure checkout.');
  const [selectedColor, setSelectedColor] = useState(settings.themeColor || '#2563eb');
  const [bannerSlidingSpeed, setBannerSlidingSpeed] = useState(settings.bannerSlidingSpeed || 5);

  // Sync state when storeSettings updates asynchronously from server
  useEffect(() => {
    if (storeSettings) {
      if (storeSettings.storeName) setStoreName(storeSettings.storeName);
      if (storeSettings.storeTagline) setStoreTagline(storeSettings.storeTagline);
      if (storeSettings.storeTitle) setStoreTitle(storeSettings.storeTitle);
      if (storeSettings.storeDescription) setStoreDescription(storeSettings.storeDescription);
      if (storeSettings.themeColor) setSelectedColor(storeSettings.themeColor);
      if (storeSettings.bannerSlidingSpeed) setBannerSlidingSpeed(storeSettings.bannerSlidingSpeed);
    }
  }, [storeSettings]);

  const safeColor = selectedColor || settings.themeColor || '#2563eb';

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
        themeColor: selectedColor,
        bannerSlidingSpeed: Number(bannerSlidingSpeed) || 5
      });
      showToast?.('Store settings saved successfully');
    } catch (err) {
      showToast?.('Failed to save settings', 'error');
    }
  };

  // =========================================================
  // ACTIONS: COLOR PRESETS & CUSTOM COLOR
  // =========================================================
  const handleSelectPreset = (preset) => {
    setSelectedColor(preset.hex);
    updateStoreSettings({
      themeColor: preset.hex,
      themeColorPreset: preset.id
    });
    showToast?.(`Applied ${preset.name}`);
  };

  const handleCustomColorChange = (e) => {
    const val = e.target.value;
    setSelectedColor(val);
    updateStoreSettings({
      themeColor: val,
      themeColorPreset: 'custom'
    });
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
    const banners = [...(settings.heroBanners || DEFAULT_HERO_BANNERS)];
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

  const currentBanners = Array.isArray(settings.heroBanners) && settings.heroBanners.length > 0
    ? settings.heroBanners
    : DEFAULT_HERO_BANNERS;

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
                <span>Store Settings</span>
                <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-blue-100">
                  TiwiMart Engine
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-blue-100/80 mt-0.5">
                Marketplace theme catalog, brand identity, favicon, colors, and sliding hero banners
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => window.open('/?view=store', '_blank')}
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
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-gray-800 pb-3 overflow-x-auto no-scrollbar">
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
      </div>

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
                          onClick={() => window.open('/?view=store', '_blank')}
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
      {activeTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Store Identity & Meta SEO (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200/90 dark:border-gray-700/80 p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 dark:border-gray-700 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Store className="w-4 h-4 text-blue-500" />
                  <span>Store Identity & Meta Information</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure storefront name, branding tagline, browser title, and SEO description
                </p>
              </div>

              <div className="space-y-4">
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
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-2 transition shadow-sm cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Identity Info'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Logo & Favicon Assets (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
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
          </div>
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
                    updateStoreSettings({ bannerSlidingSpeed: spd });
                    showToast?.(`Sliding speed set to ${spd}s`);
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

                      <div className="flex items-center space-x-1.5 text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate">
                        <LinkIcon className="w-3 h-3 shrink-0" />
                        <span className="truncate">{banner.link || '/?view=store'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
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

