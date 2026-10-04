import { Platform, StatusBar, Dimensions } from 'react-native';
import { COLORS } from './colors';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

/**
 * Standard Mobile Top Bar & Status Bar Theme Colors
 * - Pure White (COLORS.white) in Light Mode
 * - Pure Black (COLORS.black) in Dark Mode / Media Immersive Screens
 * Never use mismatched grey or translucent colors for system top bars.
 */
export const TOP_BAR_THEME = {
  light: {
    statusBarBg: COLORS.background,
    barStyle: 'dark-content',
    headerBg: COLORS.background,
    headerText: COLORS.hex_111111,
    headerTextSecondary: COLORS.textSecondary,
    headerIconColor: COLORS.text,
    headerBorder: COLORS.borderLight,
  },
  dark: {
    statusBarBg: COLORS.black,
    barStyle: 'light-content',
    headerBg: COLORS.black,
    headerText: COLORS.white,
    headerTextSecondary: COLORS.hex_AAAAAA,
    headerIconColor: COLORS.white,
    headerBorder: COLORS.text,
  },
};

/**
 * Global Layout & Metrics Configuration
 * Standardizes header heights, touch targets, icon sizes, and safe insets
 * across every screen, modal, and future page in Tiwi.
 */
export const LAYOUT = {
  SCREEN_WIDTH,
  WINDOW_HEIGHT,
  MEDIA_HEIGHT: SCREEN_WIDTH,

  // Standard Header Heights & Spacings
  HEADER_HEIGHT: 54,
  HEADER_HORIZONTAL_PADDING: 16,
  HEADER_TITLE_SIZE: 17.5,
  HEADER_TITLE_WEIGHT: '800',
  HEADER_ICON_SIZE: 22,
  HEADER_BUTTON_TOUCH_SIZE: 38,

  // Standard Bottom Navigation Bar Height
  NAVBAR_ROW_HEIGHT: 56,

  // Calculate perfect safe top spacing for full-screen modals
  getModalTopSpacing: (insets) => {
    const rawInset = insets?.top || 0;
    if (Platform.OS === 'android') {
      return Math.max(rawInset, StatusBar.currentHeight || 24);
    }
    return Math.max(rawInset, 20);
  },

  // Calculate safe bottom padding
  getSafeBottomPadding: (insets) => {
    return Math.max(insets?.bottom || 0, Platform.OS === 'ios' ? 12 : 8);
  },
};

/**
 * Get active theme config for the top bar
 */
export const getActiveTopBarTheme = (isDarkMode, isImmersive = false) => {
  if (isImmersive || isDarkMode) {
    return TOP_BAR_THEME.dark;
  }
  return TOP_BAR_THEME.light;
};
