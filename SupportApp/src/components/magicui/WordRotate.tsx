import React, { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface WordRotateProps {
  words: string[];
  duration?: number;
  style?: StyleProp<TextStyle>;
}

/**
 * Magic UI WordRotate: crisp animated vertical cycle through concise phrases.
 */
export const WordRotate: React.FC<WordRotateProps> = ({ words, duration = 2800, style }) => {
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (words.length <= 1) return undefined;
    const interval = setInterval(() => {
      opacity.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(-6, { duration: 160, easing: Easing.out(Easing.ease) });
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length);
        translateY.value = 6;
        opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
      }, 170);
    }, duration);
    return () => clearInterval(interval);
  }, [duration, opacity, translateY, words.length]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Text style={style}>{words[index] || ''}</Text>
    </Animated.View>
  );
};
