import React from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';

const lightAnimation = require('../../assets/animations/location-light.json');
const darkAnimation = require('../../assets/animations/location-dark.json');

interface LocationPermissionScreenProps {
  onAllow: () => void;
  loading: boolean;
}

export const LocationPermissionScreen: React.FC<LocationPermissionScreenProps> = ({ onAllow, loading }) => {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScreenContainer dark={isDark} applyTopInset applyBottomInset={false}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Visual Animation */}
        <View style={styles.animationArea}>
          <LottieView
            source={isDark ? darkAnimation : lightAnimation}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>

        {/* Content directly on background */}
        <View style={styles.contentWrap}>
          <Text style={[styles.headline, isDark && styles.textDark]}>
            {t('Enable Location', 'লোকেশন চালু করুন')}
          </Text>
          <Text style={[styles.helperText, isDark && styles.helperTextDark]}>
            {t(
              'Share your location to check whether PICK delivery is available in your area',
              'আপনার এলাকায় PICK ডেলিভারি চালু আছে কি না দেখতে লোকেশন শেয়ার করুন'
            )}
          </Text>
        </View>

        {/* Bottom Actions */}
        <View
          style={[
            styles.bottomBlock,
            { paddingBottom: SYSTEM_INSETS.bottom + 16 },
          ]}
        >
          <TouchableOpacity
            style={[styles.primaryButton, isDark && styles.primaryButtonDark, loading && styles.disabledButton]}
            onPress={onAllow}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDark ? '#09090B' : '#FFFFFF'} />
              : <Text style={[styles.primaryButtonText, isDark && styles.primaryButtonTextDark]}>
                  {t('Use Current Location', 'বর্তমান লোকেশন দিন')}
                </Text>}
          </TouchableOpacity>

        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  containerDark: {
    backgroundColor: '#09090B',
  },
  animationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: 220,
    height: 220,
  },
  contentWrap: {
    marginBottom: 32,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  helperText: {
    fontSize: 15,
    color: '#71717A',
    lineHeight: 22,
  },
  textDark: {
    color: '#FAFAFA',
  },
  helperTextDark: {
    color: '#A1A1AA',
  },
  bottomBlock: {
    gap: 8,
  },
  primaryButton: {
    height: 50,
    backgroundColor: '#09090B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDark: {
    backgroundColor: '#FAFAFA',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  primaryButtonTextDark: {
    color: '#09090B',
  },
  disabledButton: { opacity: 0.7 },
});
