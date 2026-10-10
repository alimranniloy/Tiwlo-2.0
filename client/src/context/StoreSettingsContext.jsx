import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { THEME_CONFIG, DEFAULT_HERO_BANNERS, applyThemeColor } from '../themes/themeConfig';

const StoreSettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  storeName: 'Your Store',
  storeTagline: 'Shop Global • Sell Global',
  storeTitle: 'Your Store',
  storeDescription: '',
  storeLogo: null,
  storeFavicon: null,
  activeTheme: 'TiwiMart',
  themeColor: '#2563eb',
  themeColorPreset: 'sapphire',
  themeMode: 'light',
  contactEmail: '',
  contactPhone: '',
  currency: 'USD',
  currencySymbol: '$',
  bannerSlidingSpeed: 5,
  heroBanners: [],
  availableThemes: THEME_CONFIG.availableThemes
};

export function StoreSettingsProvider({ children }) {
  // Do not globally cache tenant settings: the same web host serves many stores.
  const [storeSettings, setStoreSettings] = useState(DEFAULT_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 2. Apply theme colors immediately on mount and settings change
  useEffect(() => {
    if (storeSettings?.themeColor) {
      applyThemeColor(storeSettings.themeColor);
    }
  }, [storeSettings?.themeColor]);

  // 3. Fetch latest store settings from server
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/store/settings');
      if (res.ok) {
        const data = await res.json();
        setStoreSettings(prev => {
          const merged = { ...prev, ...data };
          return merged;
        });
      }
    } catch (err) {
      console.warn('Could not fetch server store settings, using local/cached values:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // 4. Update settings
  const updateStoreSettings = async (partial) => {
    setSaving(true);
    const updated = { ...storeSettings, ...partial };
    setStoreSettings(updated);

    // Apply color right away for zero latency
    if (partial.themeColor) {
      applyThemeColor(partial.themeColor);
    }

    try {
      const res = await fetch('/api/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!res.ok) {
        console.warn('Server store settings update returned non-OK status');
      }
    } catch (err) {
      console.error('Failed to persist store settings to server', err);
    } finally {
      setSaving(false);
    }

    return updated;
  };

  // 5. Upload Logo
  const uploadStoreLogo = async (file) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch('/api/store/upload-logo', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.logoUrl) {
          await updateStoreSettings({ storeLogo: data.logoUrl });
          return { success: true, logoUrl: data.logoUrl };
        }
      }
      throw new Error('Upload response did not return a valid logo URL');
    } catch (err) {
      console.error('Error uploading store logo:', err);
      // Fallback: convert to Base64 data URL for offline resilience
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Url = reader.result;
          await updateStoreSettings({ storeLogo: base64Url });
          resolve({ success: true, logoUrl: base64Url, fallback: true });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } finally {
      setSaving(false);
    }
  };

  // 6. Reset Logo to Default
  const resetToDefaultLogo = async () => {
    await updateStoreSettings({ storeLogo: null });
  };

  // 7. Upload Favicon
  const uploadStoreFavicon = async (file) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('favicon', file);

      const res = await fetch('/api/store/upload-favicon', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.faviconUrl) {
          await updateStoreSettings({ storeFavicon: data.faviconUrl });
          return { success: true, faviconUrl: data.faviconUrl };
        }
      }
      throw new Error('Upload response did not return a valid favicon URL');
    } catch (err) {
      console.error('Error uploading favicon:', err);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Url = reader.result;
          await updateStoreSettings({ storeFavicon: base64Url });
          resolve({ success: true, faviconUrl: base64Url, fallback: true });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } finally {
      setSaving(false);
    }
  };

  // 8. Reset Favicon to Default
  const resetToDefaultFavicon = async () => {
    await updateStoreSettings({ storeFavicon: null });
  };

  // 9. Banner Management Helpers
  const addHeroBanner = async (bannerData) => {
    const currentBanners = storeSettings?.heroBanners || DEFAULT_HERO_BANNERS;
    const newBanner = {
      id: `banner-${Date.now()}`,
      title: bannerData.title || 'Special Promotion',
      subtitle: bannerData.subtitle || '',
      image: bannerData.image || '/banners/hero_banner_main.png',
      link: bannerData.link || '/?view=store',
      active: bannerData.active !== false
    };
    const updatedBanners = [...currentBanners, newBanner];
    await updateStoreSettings({ heroBanners: updatedBanners });
    return newBanner;
  };

  const updateHeroBanner = async (bannerId, partial) => {
    const currentBanners = storeSettings?.heroBanners || DEFAULT_HERO_BANNERS;
    const updatedBanners = currentBanners.map(b => b.id === bannerId ? { ...b, ...partial } : b);
    await updateStoreSettings({ heroBanners: updatedBanners });
    return updatedBanners;
  };

  const deleteHeroBanner = async (bannerId) => {
    const currentBanners = storeSettings?.heroBanners || DEFAULT_HERO_BANNERS;
    const updatedBanners = currentBanners.filter(b => b.id !== bannerId);
    await updateStoreSettings({ heroBanners: updatedBanners });
    return updatedBanners;
  };

  const resetToDefaultBanners = async () => {
    await updateStoreSettings({ heroBanners: DEFAULT_HERO_BANNERS });
    return DEFAULT_HERO_BANNERS;
  };

  // Synchronize Browser Title & Favicon
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const isStoreView = searchParams.get('view') === 'store' || window.location.hash === '#/store';
      if (isStoreView && storeSettings?.storeTitle) {
        document.title = storeSettings.storeTitle;
      }
    }
  }, [storeSettings?.storeTitle]);

  useEffect(() => {
    if (typeof document !== 'undefined' && storeSettings?.storeFavicon) {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.head.appendChild(link);
      }
      link.href = storeSettings.storeFavicon;
    }
  }, [storeSettings?.storeFavicon]);

  return (
    <StoreSettingsContext.Provider
      value={{
        storeSettings,
        loading,
        saving,
        updateStoreSettings,
        uploadStoreLogo,
        resetToDefaultLogo,
        uploadStoreFavicon,
        resetToDefaultFavicon,
        addHeroBanner,
        updateHeroBanner,
        deleteHeroBanner,
        resetToDefaultBanners,
        refreshSettings: fetchSettings
      }}
    >
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    return {
      storeSettings: DEFAULT_SETTINGS,
      loading: false,
      saving: false,
      updateStoreSettings: () => {},
      uploadStoreLogo: () => {},
      resetToDefaultLogo: () => {},
      uploadStoreFavicon: () => {},
      resetToDefaultFavicon: () => {},
      addHeroBanner: () => {},
      updateHeroBanner: () => {},
      deleteHeroBanner: () => {},
      resetToDefaultBanners: () => {},
      refreshSettings: () => {}
    };
  }
  return {
    ...context,
    storeSettings: context.storeSettings || DEFAULT_SETTINGS
  };
}

export default StoreSettingsContext;
