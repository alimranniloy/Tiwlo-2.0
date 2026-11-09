import React from 'react';
import { Image, StyleSheet, View, ImageStyle, StyleProp } from 'react-native';

export type LogoVariant =
  | 'stacked-black'
  | 'stacked-white'
  | 'land-black'
  | 'land-white'
  | 'icon-black'
  | 'icon-white'
  | 'app-icon';

interface PickLogoProps {
  variant?: LogoVariant;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export const PickLogo: React.FC<PickLogoProps> = ({
  variant = 'land-black',
  width,
  height,
  style,
}) => {
  let source;
  let defaultWidth = 100;
  let defaultHeight = 30;

  switch (variant) {
    case 'stacked-black':
      source = require('../../../assets/logos/logo-black.png');
      defaultWidth = 120;
      defaultHeight = 120;
      break;
    case 'stacked-white':
      source = require('../../../assets/logos/logo-light.png');
      defaultWidth = 140;
      defaultHeight = 140;
      break;
    case 'land-black':
      source = require('../../../assets/logos/land-logo-black.png');
      defaultWidth = 100;
      defaultHeight = 30; // 1750 / 525 ~ 3.33 ratio
      break;
    case 'land-white':
      source = require('../../../assets/logos/land-logo-white.png');
      defaultWidth = 100;
      defaultHeight = 30;
      break;
    case 'icon-black':
      source = require('../../../assets/logos/icon-black.png');
      defaultWidth = 40;
      defaultHeight = 40;
      break;
    case 'icon-white':
      source = require('../../../assets/logos/icon-light.png');
      defaultWidth = 40;
      defaultHeight = 40;
      break;
    case 'app-icon':
      source = require('../../../assets/logos/app-icon.png');
      defaultWidth = 60;
      defaultHeight = 60;
      break;
    default:
      source = require('../../../assets/logos/land-logo-black.png');
  }

  const finalWidth = width ?? defaultWidth;
  const finalHeight = height ?? defaultHeight;

  return (
    <Image
      source={source}
      style={[
        {
          width: finalWidth,
          height: finalHeight,
        },
        styles.image,
        style,
      ]}
      resizeMode="contain"
    />
  );
};

const styles = StyleSheet.create({
  image: {
    alignSelf: 'center',
  },
});
