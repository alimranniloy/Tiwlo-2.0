/**
 * Tiwlo Theme Engine Configuration
 * Default active theme: TiwiMart (eCommerce & Multi-Vendor Marketplace)
 */

export const THEME_COLOR_PRESETS = [
  {
    id: 'sapphire',
    name: 'Tiwi Green',
    hex: '#1ED760',
    hover: '#18B953',
    light: '#E8FAEF',
    border: '#B7EBC9',
    description: 'The signature Tiwi 3.0 green storefront palette'
  },
  {
    id: 'emerald',
    name: 'Emerald Green',
    hex: '#059669',
    hover: '#047857',
    light: '#ecfdf5',
    border: '#a7f3d0',
    description: 'Fresh, eco-friendly, organic & wellness commerce'
  },
  {
    id: 'indigo',
    name: 'Graphite',
    hex: '#535353',
    hover: '#454545',
    light: '#f2f2f2',
    border: '#d3d3d3',
    description: 'High-end tech, luxury brands & digital electronics'
  },
  {
    id: 'crimson',
    name: 'Crimson Flame',
    hex: '#dc2626',
    hover: '#b91c1c',
    light: '#fef2f2',
    border: '#fecaca',
    description: 'High energy, flash deals, urgency & megasales'
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    hex: '#ea580c',
    hover: '#c2410c',
    light: '#fff7ed',
    border: '#fed7aa',
    description: 'Warm, dynamic, engaging lifestyle & fast-moving retail'
  },
  {
    id: 'cyber',
    name: 'Cyber Violet',
    hex: '#555555',
    hover: '#434343',
    light: '#f4f4f4',
    border: '#dadada',
    description: 'Futuristic gaming, modern cosmetics & creative arts'
  },
  {
    id: 'teal',
    name: 'Oceanic Teal',
    hex: '#0d9488',
    hover: '#0f766e',
    light: '#f0fdfa',
    border: '#99f6e4',
    description: 'Calm, premium medical, beauty & maritime trade'
  },
  {
    id: 'obsidian',
    name: 'Obsidian Midnight',
    hex: '#171717',
    hover: '#060606',
    light: '#fafafa',
    border: '#d4d4d4',
    description: 'Minimalist monochrome, Swiss design & timeless luxury'
  }
];

export const THEME_CATEGORIES = [
  'All Themes',
  'Marketplace'
];

export const AVAILABLE_THEMES = [
  {
    id: 'TiwiMart',
    name: 'TiwiMart Global Marketplace',
    tagline: 'Modern Multi-Vendor & eCommerce Marketplace',
    category: 'Marketplace',
    rating: 4.9,
    reviewsCount: 1420,
    author: 'Tiwlo Engineering',
    version: '1.2.0',
    isInstalled: true,
    isActive: true,
    price: 'Active Theme',
    features: [
      'Sliding Hero Banner',
      'Multi-Vendor Stores',
      'Realtime Cart & COD',
      'Live Stock Sync'
    ],
    previewImage: '/banners/hero_banner_main.png',
    description: 'Flagship high-converting marketplace theme with sliding promo banners, multi-vendor seller booths, instant checkout, and real-time inventory synchronization.'
  }
];

export const DEFAULT_HERO_BANNERS = [
  {
    id: 'banner-1',
    title: 'Global Marketplace Super Sale',
    subtitle: 'Discover Amazing Products from Millions of Verified Sellers',
    image: '/banners/hero_banner_main.png',
    link: '/?view=store#flash-sale',
    active: true
  },
  {
    id: 'banner-2',
    title: 'Next-Gen Tech & Electronics',
    subtitle: 'Upgrade Your Digital World with Limited Time Deals',
    image: '/banners/hero_banner_tech.jpg',
    link: '/?view=store#deals',
    active: true
  },
  {
    id: 'banner-3',
    title: 'Worldwide Express Freight Delivery',
    subtitle: 'Reliable Global Cargo & Fast Air Delivery to 180+ Countries',
    image: '/banners/hero_banner_shipping.jpg',
    link: '/?view=store',
    active: true
  }
];

/**
 * Apply theme color dynamically to document CSS variables
 */
export function applyThemeColor(hexColor) {
  if (!hexColor || typeof document === 'undefined') return;

  const preset = THEME_COLOR_PRESETS.find(p => p.hex.toLowerCase() === hexColor.toLowerCase());
  const hoverColor = preset ? preset.hover : hexColor;
  const lightColor = preset ? preset.light : `${hexColor}15`;

  const root = document.documentElement;
  root.style.setProperty('--theme-primary', hexColor);
  root.style.setProperty('--theme-primary-hover', hoverColor);
  root.style.setProperty('--theme-primary-light', lightColor);
  root.style.setProperty('--theme-primary-border', `${hexColor}40`);
  root.style.setProperty('--theme-primary-glow', `${hexColor}25`);
}

export const THEME_CONFIG = {
  activeTheme: 'TiwiMart',
  defaultColor: '#1ED760',
  colorPresets: THEME_COLOR_PRESETS,
  availableThemes: AVAILABLE_THEMES,
  defaultBanners: DEFAULT_HERO_BANNERS
};

export default THEME_CONFIG;
