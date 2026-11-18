import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../theme/ThemeContext';

interface AnimatedShinyTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  shimmerDuration?: number;
}

/**
 * Magic UI AnimatedShinyText: clean typography with a subtle periodic sheen sweep.
 */
export const AnimatedShinyText: React.FC<AnimatedShinyTextProps> = ({
  children,
  style,
  containerStyle,
  shimmerDuration = 2800,
}) => {
  const { tokens } = useAppTheme();
  const translateX = useSharedValue(-140);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(260, { duration: shimmerDuration, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [shimmerDuration, translateX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={[{ color: tokens.textMuted }, style]}>{children}</Text>
      <Animated.View pointerEvents="none" style={[styles.glint, shimmerStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            tokens.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)',
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  glint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 72,
  },
});
