import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeContext';

const AnimatedSvgCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedCircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

/**
 * Magic UI AnimatedCircularProgressBar port using Reanimated + react-native-svg.
 */
export const AnimatedCircularProgress: React.FC<AnimatedCircularProgressProps> = ({
  value,
  max = 100,
  size = 54,
  strokeWidth = 5,
  color,
  label,
}) => {
  const { tokens } = useAppTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, max > 0 ? value / max : 0));

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(clamped, {
      duration: 850,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const fg = color || tokens.accent;
  const center = size / 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={tokens.surfaceMuted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedSvgCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={fg}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      {label !== undefined ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <Text style={[styles.label, { color: tokens.text }]}>{label}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
