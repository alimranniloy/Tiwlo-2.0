import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface PulsatingDotProps {
  color?: string;
  size?: number;
  active?: boolean;
}

/**
 * Magic UI native PulsatingStatusDot (inspired by pulsating-button.tsx):
 * Concentric pulse halo for live agent presence and active chat indicators.
 */
export const PulsatingDot: React.FC<PulsatingDotProps> = ({
  color = '#16A34A',
  size = 8,
  active = true,
}) => {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [active, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: active ? (1 - pulse.value) * 0.55 : 0,
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));

  const boxSize = size * 2.2;

  return (
    <View style={[styles.wrap, { width: boxSize, height: boxSize }]}>
      <Animated.View
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
          haloStyle,
        ]}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
});
