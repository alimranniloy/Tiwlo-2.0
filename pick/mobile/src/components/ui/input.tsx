import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View, ViewStyle } from 'react-native';

export interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor="#A1A1AA"
        {...props}
      />
      {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#09090B',
    height: '100%',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
