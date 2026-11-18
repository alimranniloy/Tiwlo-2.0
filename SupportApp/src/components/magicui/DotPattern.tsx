import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeContext';

interface DotPatternProps {
  height?: number;
  glow?: boolean;
}

const SPARK_DOTS = [
  { top: 18, left: '14%', delay: 0 },
  { top: 44, left: '38%', delay: 700 },
  { top: 24, left: '68%', delay: 1300 },
  { top: 52, left: '86%', delay: 500 },
] as const;

const SparkDot: React.FC<{ top: number; left: `${number}%`; delay: number; color: string }> = ({
  top,
  left,
  delay,
  color,
}) => {
  const pulse = useSharedValue(0.18);

  useEffect(() => {
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.45, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.12, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [delay, pulse]);

  const anim = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.9 + pulse.value * 0.45 }],
  }));

  return (
    <Animated.View
      style={[
        styles.spark,
        { top, left, backgroundColor: color },
        anim,
      ]}
    />
  );
};

/**
 * Magic UI DotPattern SVG ambient background with soft glowing dots (zero borders).
 */
export const DotPattern: React.FC<DotPatternProps> = ({ height = 170, glow = true }) => {
  const { tokens } = useAppTheme();
  const dotColor = tokens.isDark ? 'rgba(255,255,255,0.11)' : 'rgba(9,9,11,0.085)';

  return (
    <View pointerEvents="none" style={[styles.container, { height }]}>
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id="magic-dot-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <Circle cx="1.5" cy="1.5" r="1.2" fill={dotColor} />
          </Pattern>
        </Defs>
        <Rect width="100%" height={height} fill="url(#magic-dot-grid)" />
      </Svg>
      {glow
        ? SPARK_DOTS.filter((d) => d.top < height - 16).map((dot, idx) => (
            <SparkDot
              key={idx}
              top={dot.top}
              left={dot.left}
              delay={dot.delay}
              color={tokens.accent}
            />
          ))
        : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  spark: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
