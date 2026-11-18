import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
  staggerMs?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Magic UI AnimatedList item wrapper: subtle spring-physics entrance staggered by row index.
 */
export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  index = 0,
  staggerMs = 45,
  style,
}) => {
  const delay = Math.min(index, 10) * staggerMs;
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const scale = useSharedValue(0.98);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 260 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 24, stiffness: 280 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 24, stiffness: 280 }));
  }, [delay, opacity, scale, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
};
