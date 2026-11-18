import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTonePalette, useAppTheme, type SemanticTone } from '../../theme/ThemeContext';

export interface ToastPayload {
  variant?: 'success' | 'danger' | 'accent' | 'default';
  label: string;
}

interface ToastContextValue {
  show: (payload: ToastPayload) => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

export const useMagicToast = () => ({
  toast: useContext(ToastContext),
});

export const MagicToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-18);

  const show = useCallback(
    (payload: ToastPayload) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(payload);
      opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });

      timerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(-14, { duration: 180 });
        setTimeout(() => setMessage(null), 190);
      }, 2800);
    },
    [opacity, translateY]
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const tone: SemanticTone =
    message?.variant === 'success'
      ? 'success'
      : message?.variant === 'danger'
        ? 'danger'
        : message?.variant === 'accent'
          ? 'accent'
          : 'neutral';
  const palette = getTonePalette(tokens, tone);
  const topOffset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 44) + 6;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: topOffset },
            animStyle,
          ]}
        >
          <View
            style={[
              styles.pill,
              {
                backgroundColor: tokens.isDark ? '#18181B' : '#09090B',
              },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: palette.fg }]} />
            <Text numberOfLines={2} style={styles.text}>
              {message.label}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    maxWidth: 420,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
});
