import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PickLogo } from '../components/common/PickLogo';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';

interface SplashScreenProps {
  onNext: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onNext }) => {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.95));
  const { width, height } = useWindowDimensions();
  const footerSize = width * 1.45;
  const footerHeight = Math.min(290, width * 0.72, height * 0.3);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onNext();
    }, 2200);

    return () => clearTimeout(timer);
  }, [onNext, fadeAnim, scaleAnim]);

  return (
    <ScreenContainer dark={false} applyTopInset applyBottomInset>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={1}
        onPress={onNext}
      >
        <Animated.View
          style={[
            styles.centerContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <PickLogo
            variant="stacked-black"
            width={170}
            height={130}
          />
        </Animated.View>
        <View
          pointerEvents="none"
          style={[styles.footerClip, { height: footerHeight }]}
        >
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
