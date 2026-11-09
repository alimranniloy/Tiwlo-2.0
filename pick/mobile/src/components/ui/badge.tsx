import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  style,
  textStyle,
}) => {
  const getVariantContainer = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'destructive':
        return styles.destructiveContainer;
      case 'success':
        return styles.successContainer;
      default:
        return styles.defaultContainer;
    }
  };

  const getVariantText = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'destructive':
        return styles.destructiveText;
      case 'success':
        return styles.successText;
      default:
        return styles.defaultText;
    }
  };

  return (
    <View style={[styles.base, getVariantContainer(), style]}>
      {typeof children === 'string' ? (
        <Text style={[styles.baseText, getVariantText(), textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  baseText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  outlineText: {
    color: '#18181B',
  },
  destructiveContainer: {
    backgroundColor: '#EF4444',
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  successContainer: {
    backgroundColor: '#ECFDF5',
  },
  successText: {
    color: '#065F46',
  },
});
