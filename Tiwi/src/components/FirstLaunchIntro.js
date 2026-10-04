import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  StatusBar,
  Dimensions,
  Animated,
  TouchableOpacity
} from 'react-native';
import { COLORS } from '../config/colors';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(Math.round(width * 0.45), 180);

export default function FirstLaunchIntro({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const hasFinishedRef = useRef(false);

  const handleFinish = () => {
    if (!hasFinishedRef.current) {
      hasFinishedRef.current = true;
      if (typeof onFinish === 'function') {
        onFinish();
      }
    }
  };

  useEffect(() => {
    // Smooth Google-inspired entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });

    // Auto-advance after 2.5 seconds
    const timer = setTimeout(() => {
      handleFinish();
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/tiwi.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.textContainer, { opacity: contentFadeAnim }]}>
        <Text style={styles.appName}>Tiwi</Text>
        <Text style={styles.tagline}>Connect, Share &amp; Explore</Text>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Get Started</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14.5,
    color: COLORS.hex_5F6368,
    fontWeight: '400',
    marginBottom: 32,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '600',
  },
});
