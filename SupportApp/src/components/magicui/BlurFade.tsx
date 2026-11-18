import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface BlurFadeProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Magic UI native port of BlurFade: smooth staggered fade, scale settle, and vertical reveal.
 */
export const BlurFade: React.FC<BlurFadeProps> = ({
  children,
  delay = 0,
  duration = 380,
  offset = 8,
  style,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(offset);
  const scale = useSharedValue(0.985);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    opacity.value = withDelay(delay, withTiming(1, { duration, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing }));
    scale.value = withDelay(delay, withTiming(1, { duration, easing }));
  }, [delay, duration, opacity, scale, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
};
