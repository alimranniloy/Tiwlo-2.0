import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';

const lightHighFive = require('../../assets/animations/highfive-light.json');
const darkHighFive = require('../../assets/animations/highfive-dark.json');

interface LocationSuccessScreenProps {
  onContinue: () => void;
  onEditLocation?: () => void;
  address: string;
}

export const LocationSuccessScreen: React.FC<LocationSuccessScreenProps> = ({
  onContinue,
  onEditLocation,
  address,
}) => {
  const { language, t } = useLanguage();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScreenContainer dark={isDark} applyTopInset applyBottomInset={false}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        {/* Lottie Animation */}
        <View style={styles.animationArea}>
          <LottieView
            source={isDark ? darkHighFive : lightHighFive}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>

        {/* Centered content directly on background */}
        <View style={styles.contentWrap}>
          <Text style={[styles.headline, isDark && styles.textDark]}>
            {t('Confirm Delivery Location', 'ডেলিভারি লোকেশন নিশ্চিত করুন')}
          </Text>

          <View style={styles.addressBox}>
            <Text style={[styles.addressText, isDark && styles.textDark]}>
              📍 {address || t('No address found', 'ঠিকানা পাওয়া যায়নি')}
            </Text>
            <Text style={[styles.addressSubtext, isDark && styles.helperTextDark]}>
              {t(
                'Orders and express deliveries will arrive at this address',
                'আপনার সব অর্ডার ও পার্সেল এই ঠিকানায় ডেলিভারি হবে'
              )}
            </Text>
          </View>

          {onEditLocation && (
            <TouchableOpacity
              onPress={onEditLocation}
              activeOpacity={0.7}
              style={styles.changeBtn}
            >
              <Text style={[styles.changeLink, isDark && styles.changeLinkDark]}>
                {t('Change Address', 'ঠিকানা পরিবর্তন করুন')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Primary Action Button */}
        <View
          style={[
            styles.bottomBlock,
            { paddingBottom: SYSTEM_INSETS.bottom + 16 },
          ]}
        >
          <TouchableOpacity
            style={[styles.primaryButton, isDark && styles.primaryButtonDark]}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, isDark && styles.primaryButtonTextDark]}>
              {t('Confirm & Continue', 'নিশ্চিত করুন এবং এগিয়ে যান')}
            </Text>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  addressBox: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  addressText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#09090B',
    textAlign: 'center',
    marginBottom: 6,
  },
  addressSubtext: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
  },
  changeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  changeLinkDark: {
    color: '#FAFAFA',
  },
  textDark: {
    color: '#FAFAFA',
  },
  helperTextDark: {
    color: '#A1A1AA',
  },
  bottomBlock: {},
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
});
