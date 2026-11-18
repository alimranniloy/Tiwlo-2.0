import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../theme/ThemeContext';

type ShimmerVariant = 'primary' | 'accent' | 'subtle' | 'danger';
type ShimmerSize = 'xs' | 'sm' | 'md';

interface ShimmerButtonProps {
  label?: string;
  children?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ShimmerVariant;
  size?: ShimmerSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const SIZE_METRICS: Record<ShimmerSize, { height: number; px: number; fontSize: number; radius: number }> = {
  xs: { height: 28, px: 10, fontSize: 11, radius: 6 },
  sm: { height: 34, px: 14, fontSize: 12.5, radius: 8 },
  md: { height: 38, px: 18, fontSize: 13.5, radius: 9 },
};

/**
 * Magic UI ShimmerButton: refined compact proportions (34-38px height),
 * sweeping subtle light beam, zero oversized chunky pills.
 */
export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  label,
  children,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  leftIcon,
  rightIcon,
}) => {
  const { tokens } = useAppTheme();
  const pressScale = useSharedValue(1);
  const shimmerX = useSharedValue(-120);

  const isDisabled = disabled || loading;
  const metrics = SIZE_METRICS[size];

  useEffect(() => {
    if (isDisabled || variant === 'subtle') return;
    shimmerX.value = withRepeat(
      withTiming(260, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [isDisabled, shimmerX, variant]);

  const containerAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const beamAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { skewX: '-18deg' }],
  }));

  let bgColor = tokens.inkButton;
  let fgColor = tokens.inkButtonText;
  let beamTint = tokens.isDark ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.22)';

  if (variant === 'accent') {
    bgColor = tokens.accent;
    fgColor = tokens.accentText;
    beamTint = 'rgba(255,255,255,0.26)';
  } else if (variant === 'subtle') {
    bgColor = tokens.surfaceMuted;
    fgColor = tokens.text;
    beamTint = 'transparent';
  } else if (variant === 'danger') {
    bgColor = tokens.danger;
    fgColor = '#FFFFFF';
    beamTint = 'rgba(255,255,255,0.22)';
  }

  return (
    <Animated.View style={[containerAnim, { alignSelf: 'flex-start' }, style]}>
      <Pressable
        disabled={isDisabled}
        onPressIn={() => {
          pressScale.value = withSpring(0.96, { damping: 18, stiffness: 360 });
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 16, stiffness: 320 });
        }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={[
          styles.button,
          {
            height: metrics.height,
            paddingHorizontal: metrics.px,
            borderRadius: metrics.radius,
            backgroundColor: bgColor,
            opacity: isDisabled ? 0.55 : 1,
          },
        ]}
      >
        {!isDisabled && variant !== 'subtle' ? (
          <Animated.View pointerEvents="none" style={[styles.beam, beamAnim]}>
            <LinearGradient
              colors={['transparent', beamTint, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        <View style={styles.innerRow}>
          {loading ? (
            <ActivityIndicator size="small" color={fgColor} />
          ) : (
            <>
              {leftIcon}
              {children ?? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.text,
                    { color: fgColor, fontSize: metrics.fontSize },
                    textStyle,
                  ]}
                >
                  {label}
                </Text>
              )}
              {rightIcon}
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beam: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 64,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
