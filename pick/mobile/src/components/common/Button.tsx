import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'darkOutline';
  icon?: React.ReactNode;
  showArrow?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  showArrow = false,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const getContainerStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'darkOutline':
        return styles.darkOutlineContainer;
      default:
        return styles.primaryContainer;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
      case 'outline':
        return styles.outlineText;
      case 'darkOutline':
        return styles.darkOutlineText;
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.baseContainer,
        getContainerStyle(),
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
          color={variant === 'primary' ? '#FAFAFA' : '#18181B'}
        />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconMargin}>{icon}</View> : null}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          {showArrow ? (
            <Feather
              name="arrow-right"
              size={16}
              color={variant === 'primary' ? '#FAFAFA' : '#18181B'}
              style={styles.arrowIcon}
            />
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  primaryContainer: {
    backgroundColor: '#18181B',
  },
  secondaryContainer: {
    backgroundColor: '#F4F4F5',
  },
  outlineContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  darkOutlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconMargin: {
    marginRight: 8,
  },
  primaryText: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  outlineText: {
    color: '#18181B',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  darkOutlineText: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  arrowIcon: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});
