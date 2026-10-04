/**
 * Tiwlo Mobile & Web Appearance Configuration
 * Location: client/src/config/themeConfig.js
 * 
 * Central configuration file for controlling:
 * - Mobile Browser Address Bar & Status Bar Theme Colors (<meta name="theme-color">)
 * - Mobile Navigation & Header Backgrounds (Light & Dark)
 * - Dashboard Page Backgrounds (Light & Dark)
 * - iOS Safari Status Bar Style (<meta name="apple-mobile-web-app-status-bar-style">)
 * 
 * Supports overriding via client/.env file (e.g. VITE_STATUS_BAR_LIGHT, VITE_STATUS_BAR_DARK).
 */

import { useState, useEffect } from 'react';

export const THEME_CONFIG = {
  // Mobile Browser Status Bar / Address Bar Theme Colors (controls top mobile browser area above URL)
  statusBar: {
    light: import.meta.env?.VITE_STATUS_BAR_LIGHT || '#FFFFFF',
    dark: import.meta.env?.VITE_STATUS_BAR_DARK || '#0B0F17'
  },

  // Mobile Header & Top Navbar Backgrounds
  header: {
    light: import.meta.env?.VITE_HEADER_BG_LIGHT || '#FFFFFF',
    dark: import.meta.env?.VITE_HEADER_BG_DARK || '#111827'
  },

  // Dashboard Page Backgrounds
  dashboard: {
    light: import.meta.env?.VITE_DASHBOARD_BG_LIGHT || '#F6F8FB',
    dark: import.meta.env?.VITE_DASHBOARD_BG_DARK || '#0B0F17'
  },

  // iOS Safari Mobile Web App Status Bar Style
  appleStatusBar: {
    light: 'default', // Dark text on light/white background
    dark: 'black-translucent' // Light text on dark background
  },

  // Brand Accent
  primary: import.meta.env?.VITE_THEME_PRIMARY || '#0B57D0'
};

/**
 * Get current active theme ('light' or 'dark')
 */
export function getInitialTheme() {
  try {
    const saved = localStorage.getItem('tiwlo_theme') || localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (_) {}
  return 'light';
}

/**
 * Apply theme to document, meta tags, and storage
 */
export function applyTheme(themeName) {
  const theme = themeName === 'dark' ? 'dark' : 'light';
  const isDark = theme === 'dark';

  try {
    // 1. Toggle 'dark' class on <html> and <body>
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      document.body?.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body?.classList.remove('dark');
    }

    // 2. Update Browser Address Bar / Status Bar Meta Tags (<meta name="theme-color">)
    const targetStatusBarColor = isDark ? THEME_CONFIG.statusBar.dark : THEME_CONFIG.statusBar.light;

    // Update or create standard theme-color meta tag
    let primaryMeta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!primaryMeta) {
      primaryMeta = document.querySelector('meta[name="theme-color"]');
    }
    if (primaryMeta) {
      primaryMeta.setAttribute('content', targetStatusBarColor);
    } else {
      const newMeta = document.createElement('meta');
      newMeta.setAttribute('name', 'theme-color');
      newMeta.setAttribute('content', targetStatusBarColor);
      document.head.appendChild(newMeta);
    }

    // Also update media query based theme-color meta tags
    const lightMediaMeta = document.querySelector('meta[name="theme-color"][media*="light"]');
    if (lightMediaMeta) lightMediaMeta.setAttribute('content', THEME_CONFIG.statusBar.light);

    const darkMediaMeta = document.querySelector('meta[name="theme-color"][media*="dark"]');
    if (darkMediaMeta) darkMediaMeta.setAttribute('content', THEME_CONFIG.statusBar.dark);

    // 3. Update Apple iOS Safari Status Bar Style
    const appleStyle = isDark ? THEME_CONFIG.appleStatusBar.dark : THEME_CONFIG.appleStatusBar.light;
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      appleMeta.setAttribute('content', appleStyle);
    } else {
      const newAppleMeta = document.createElement('meta');
      newAppleMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      newAppleMeta.setAttribute('content', appleStyle);
      document.head.appendChild(newAppleMeta);
    }

    // 4. Update Windows / Edge mobile nav button color
    let msMeta = document.querySelector('meta[name="msapplication-navbutton-color"]');
    if (msMeta) {
      msMeta.setAttribute('content', targetStatusBarColor);
    }

    // 5. Update CSS custom variables on :root
    root.style.setProperty('--theme-status-bar', targetStatusBarColor);
    root.style.setProperty('--theme-header-bg', isDark ? THEME_CONFIG.header.dark : THEME_CONFIG.header.light);
    root.style.setProperty('--theme-dashboard-bg', isDark ? THEME_CONFIG.dashboard.dark : THEME_CONFIG.dashboard.light);

    // 6. Persist to localStorage
    localStorage.setItem('tiwlo_theme', theme);
    localStorage.setItem('theme', theme);

    // 7. Dispatch custom event for reactive UI updates
    window.dispatchEvent(new CustomEvent('tiwlo-theme-change', {
      detail: { theme, isDark, statusBarColor: targetStatusBarColor }
    }));
  } catch (err) {
    console.warn('[ThemeConfig] Error applying theme:', err);
  }

  return theme;
}

/**
 * Initialize theme immediately on script execution
 */
export function initTheme() {
  const initial = getInitialTheme();
  applyTheme(initial);

  // Listen to system OS theme changes if user hasn't explicitly set preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const saved = localStorage.getItem('tiwlo_theme');
      if (!saved) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };
    try {
      mediaQuery.addEventListener('change', handleChange);
    } catch (_) {
      try { mediaQuery.addListener(handleChange); } catch (__) {}
    }
  }
}

/**
 * React Hook for consuming and toggling theme across components
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => getInitialTheme());

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e?.detail?.theme) {
        setThemeState(e.detail.theme);
      }
    };
    window.addEventListener('tiwlo-theme-change', handleThemeChange);
    return () => window.removeEventListener('tiwlo-theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setThemeState(next);
  };

  const setTheme = (newTheme) => {
    applyTheme(newTheme);
    setThemeState(newTheme);
  };

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
    statusBarColor: theme === 'dark' ? THEME_CONFIG.statusBar.dark : THEME_CONFIG.statusBar.light
  };
}

export default THEME_CONFIG;
