import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

export type SupportLogoVariant =
  | 'stacked'
  | 'stacked-black'
  | 'stacked-white'
  | 'land'
  | 'land-black'
  | 'land-white'
  | 'icon'
  | 'app-icon';

interface SupportLogoProps {
  variant?: SupportLogoVariant;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Renders clean borderless brand logos cloned from pick/mobile/assets.
 */
export const SupportLogo: React.FC<SupportLogoProps> = ({
  variant = 'stacked',
  width,
  height,
  style,
}) => {
  const { tokens } = useAppTheme();
  const isDark = tokens.isDark;

  let source;
  let defaultWidth = 110;
  let defaultHeight = 32;

  switch (variant) {
    case 'stacked':
      source = isDark
        ? require('../../../assets/logos/logo-light.png')
        : require('../../../assets/logos/logo-black.png');
      defaultWidth = 160;
      defaultHeight = 120;
      break;
    case 'stacked-black':
      source = require('../../../assets/logos/logo-black.png');
      defaultWidth = 170;
      defaultHeight = 130;
      break;
    case 'stacked-white':
      source = require('../../../assets/logos/logo-light.png');
      defaultWidth = 170;
      defaultHeight = 130;
      break;
    case 'land':
      source = isDark
        ? require('../../../assets/logos/land-logo-white.png')
        : require('../../../assets/logos/land-logo-black.png');
      defaultWidth = 110;
      defaultHeight = 32;
      break;
    case 'land-black':
      source = require('../../../assets/logos/land-logo-black.png');
      defaultWidth = 110;
      defaultHeight = 32;
      break;
    case 'land-white':
      source = require('../../../assets/logos/land-logo-white.png');
      defaultWidth = 110;
      defaultHeight = 32;
      break;
    case 'icon':
      source = isDark
        ? require('../../../assets/logos/icon-light.png')
        : require('../../../assets/logos/icon-black.png');
      defaultWidth = 36;
      defaultHeight = 36;
      break;
    case 'app-icon':
      source = require('../../../assets/icon.png');
      defaultWidth = 48;
      defaultHeight = 48;
      break;
  }

  return (
    <Image
      source={source}
      style={[
        {
          width: width ?? defaultWidth,
          height: height ?? defaultHeight,
          alignSelf: 'center',
        },
        style,
      ]}
      resizeMode="contain"
    />
  );
};
