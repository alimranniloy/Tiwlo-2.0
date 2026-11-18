import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { SupportLogo } from '../components/common/SupportLogo';
import { DotPattern } from '../components/magicui';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.94);
  const { width, height } = useWindowDimensions();
  const footerSize = width * 1.45;
  const footerHeight = Math.min(290, width * 0.72, height * 0.3);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    scale.value = withSpring(1, { damping: 16, stiffness: 160 });

    const timer = setTimeout(onFinish, 1800);
    return () => clearTimeout(timer);
  }, [onFinish, opacity, scale]);

  const logoAnim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <ScreenContainer forceLight applyTopInset applyBottomInset>
      <TouchableOpacity style={styles.container} activeOpacity={1} onPress={onFinish}>
        <DotPattern height={210} glow />

        <Animated.View style={[styles.centerContent, logoAnim]}>
          <SupportLogo variant="stacked-black" width={168} height={128} />
        </Animated.View>

        <View pointerEvents="none" style={[styles.footerClip, { height: footerHeight }]}>
          <ExpoImage
            source={require('../../assets/images/splash-footer.gif')}
            contentFit="cover"
            autoplay
            style={[
              styles.footerImage,
              {
                width: footerSize,
                height: footerSize,
                left: (width - footerSize) / 2,
                top: 0,
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 80,
  },
  footerClip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -SYSTEM_INSETS.bottom,
    overflow: 'hidden',
  },
  footerImage: {
    position: 'absolute',
  },
});
