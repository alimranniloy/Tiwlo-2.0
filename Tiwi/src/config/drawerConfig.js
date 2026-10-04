import { Platform } from 'react-native';
import { COLORS } from './colors';

/**
 * Shared Drawer / Bottom Sheet Global Configuration
 * Controls backdrop overlay, animation speeds, border radius, and gesture bar insets
 */
export const DRAWER_CONFIG = {
  // Full-screen backdrop overlay (covers entire device from status bar to gesture nav)
  BACKDROP_COLOR: COLORS.rgba_0_0_0_0p65,
  BACKDROP_FADE_DURATION: 160, // Snappy fade-in without sliding (Facebook / Instagram standard)

  // Sheet slide-up animation
  SHEET_SLIDE_DURATION: 260,
  SHEET_SPRING_CONFIG: {
    damping: 30,
    mass: 0.85,
    stiffness: 300,
  },

  // Dimensions & Corner Radius
  BORDER_RADIUS: 28,
  DRAG_HANDLE_WIDTH: 38,
  DRAG_HANDLE_HEIGHT: 4.5,
  DRAG_HANDLE_BORDER_RADIUS: 3,

  // Safe Area bottom padding fallback
  DEFAULT_BOTTOM_INSET: Platform.OS === 'android' ? 16 : 28,

  // Theme helper for drawers across dark & light modes
  getThemeColors: (isDarkMode) => ({
    backdrop: COLORS.rgba_0_0_0_0p65,
    sheetBg: isDarkMode ? COLORS.hex_1E1F20 : COLORS.white,
    textPrimary: isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text,
    textSecondary: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.hex_5F6368,
    divider: isDarkMode ? COLORS.hex_2C2D2F : COLORS.borderLight,
    dragHandle: isDarkMode ? COLORS.hex_5F6368 : COLORS.hex_C4C7C5,
    inputBg: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
    accent: COLORS.primary,
  }),
};
