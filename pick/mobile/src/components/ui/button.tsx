import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Colors } from '../../theme/colors';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'default',
  size = 'default',
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
  children,
}) => {
  const getContainerVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'ghost':
        return styles.ghostContainer;
      case 'destructive':
        return styles.destructiveContainer;
      default:
        return styles.defaultContainer;
    }
  };

  const getTextVariantStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'ghost':
        return styles.ghostText;
      case 'destructive':
        return styles.destructiveText;
      default:
        return styles.defaultText;
    }
  };

  const getSizeContainerStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      case 'icon':
        return styles.sizeIcon;
      default:
        return styles.sizeDefault;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        getSizeContainerStyle(),
        getContainerVariantStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'default' ? '#FAFAFA' : '#18181B'}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={styles.iconMargin}>{icon}</View> : null}
          {title ? <Text style={[styles.baseText, getTextVariantStyle(), textStyle]}>{title}</Text> : null}
          {children}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMargin: {
    marginRight: 8,
  },
  baseText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  // Sizes (shadcn/ui specifications)
  sizeDefault: {
    height: 44,
    paddingHorizontal: 16,
  },
  sizeSm: {
    height: 36,
    paddingHorizontal: 12,
  },
  sizeLg: {
    height: 50,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  sizeIcon: {
    width: 40,
    height: 40,
    paddingHorizontal: 0,
  },
  // Variants (shadcn/ui)
  defaultContainer: {
    backgroundColor: '#18181B',
  },
  defaultText: {
    color: '#FAFAFA',
  },
  secondaryContainer: {
    backgroundColor: '#F4F4F5',
  },
  secondaryText: {
    color: '#18181B',
  },
  outlineContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  outlineText: {
    color: '#18181B',
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: '#18181B',
  },
  destructiveContainer: {
    backgroundColor: '#EF4444',
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
});
