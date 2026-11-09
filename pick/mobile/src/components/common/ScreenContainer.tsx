import React from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';

export const SYSTEM_INSETS = {
  // Top inset for Android status bar and iOS notch
  top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 48,
  // Extra bottom inset to lift all buttons and navbars well above Android 3-button navigation & iOS home bar
  bottom: Platform.OS === 'android' ? 36 : 34,
  // Additional padding for screens containing the BottomNav
  bottomNavPadding: Platform.OS === 'android' ? 40 : 34,
};

interface ScreenContainerProps {
  children: React.ReactNode;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
  applyTopInset?: boolean;
  applyBottomInset?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  dark = false,
  style,
  applyTopInset = true,
  applyBottomInset = false,
}) => {
  return (
    <View
      style={[
        styles.container,
        dark ? styles.containerDark : styles.containerLight,
        applyTopInset && { paddingTop: SYSTEM_INSETS.top },
        applyBottomInset && { paddingBottom: SYSTEM_INSETS.bottom },
        style,
      ]}
    >
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#090A0C',
  },
});
