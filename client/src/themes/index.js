import TiwiMart from './TiwiMart/TiwiMart';
import { THEME_CONFIG } from './themeConfig';

export { TiwiMart, THEME_CONFIG };

export const THEME_REGISTRY = {
  TiwiMart: TiwiMart
};

export function getActiveThemeComponent(themeName = THEME_CONFIG.activeTheme) {
  return THEME_REGISTRY[themeName] || TiwiMart;
}

export default TiwiMart;
