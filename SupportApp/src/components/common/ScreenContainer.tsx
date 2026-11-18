import React from 'react';
import { Platform, StatusBar, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';

export const SYSTEM_INSETS = {
  top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 48,
  bottom: Platform.OS === 'android' ? 24 : 28,
};

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  applyTopInset?: boolean;
  applyBottomInset?: boolean;
  forceLight?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  applyTopInset = true,
  applyBottomInset = false,
  forceLight = false,
}) => {
  const insets = useSafeAreaInsets();
  const { tokens } = useAppTheme();
  const isDark = !forceLight && tokens.isDark;
  const bg = forceLight ? '#FFFFFF' : tokens.bg;

  const topPad = applyTopInset ? Math.max(insets.top, SYSTEM_INSETS.top) : 0;
  const bottomPad = applyBottomInset ? Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 14) : 0;

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: bg,
          paddingTop: topPad,
          paddingBottom: bottomPad,
        },
        style,
      ]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {children}
    </View>
  );
};
