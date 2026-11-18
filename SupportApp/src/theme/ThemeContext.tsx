import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

export type AppThemeMode = 'light' | 'dark';

export interface AppThemeTokens {
  mode: AppThemeMode;
  isDark: boolean;
  bg: string;
  surfaceSubtle: string;
  surfaceMuted: string;
  hairline: string;
  hairlineStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  inkButton: string;
  inkButtonText: string;
  overlay: string;
}

const LIGHT_TOKENS: AppThemeTokens = {
  mode: 'light',
  isDark: false,
  bg: '#FFFFFF',
  surfaceSubtle: '#FAFAFA',
  surfaceMuted: '#F4F4F5',
  hairline: '#F1F5F9',
  hairlineStrong: '#E4E4E7',
  text: '#09090B',
  textSecondary: '#3F3F46',
  textMuted: '#71717A',
  accent: '#16A34A',
  accentText: '#FFFFFF',
  accentSoft: 'rgba(22, 163, 74, 0.10)',
  success: '#16A34A',
  successSoft: 'rgba(22, 163, 74, 0.10)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.11)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220, 38, 38, 0.10)',
  inkButton: '#09090B',
  inkButtonText: '#FFFFFF',
  overlay: 'rgba(9, 9, 11, 0.42)',
};

const DARK_TOKENS: AppThemeTokens = {
  mode: 'dark',
  isDark: true,
  bg: '#09090B',
  surfaceSubtle: '#111113',
  surfaceMuted: '#18181B',
  hairline: '#1F1F23',
  hairlineStrong: '#27272A',
  text: '#FAFAFA',
  textSecondary: '#D4D4D8',
  textMuted: '#A1A1AA',
  accent: '#22C55E',
  accentText: '#052E16',
  accentSoft: 'rgba(34, 197, 94, 0.14)',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.15)',
  inkButton: '#FAFAFA',
  inkButtonText: '#09090B',
  overlay: 'rgba(0, 0, 0, 0.66)',
};

export type SemanticTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

export function getTonePalette(tokens: AppThemeTokens, tone: SemanticTone) {
  switch (tone) {
    case 'success':
      return { fg: tokens.success, bg: tokens.successSoft };
    case 'warning':
      return { fg: tokens.warning, bg: tokens.warningSoft };
    case 'danger':
      return { fg: tokens.danger, bg: tokens.dangerSoft };
    case 'accent':
      return { fg: tokens.accent, bg: tokens.accentSoft };
    case 'neutral':
    default:
      return { fg: tokens.textMuted, bg: tokens.surfaceMuted };
  }
}

interface ThemeContextValue {
  theme: AppThemeMode;
  tokens: AppThemeTokens;
  setTheme: (mode: AppThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  tokens: LIGHT_TOKENS,
  setTheme: () => {},
  toggleTheme: () => {},
});

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialMode: AppThemeMode = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
  const [theme, setThemeState] = useState<AppThemeMode>(initialMode);

  const setTheme = useCallback((mode: AppThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      tokens: theme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);
