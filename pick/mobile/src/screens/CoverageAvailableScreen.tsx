import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';

const lightAnimation = require('../../assets/animations/coverage-available-light.json');
const darkAnimation = require('../../assets/animations/coverage-available-dark.json');

interface CoverageAvailableScreenProps {
  address: string;
  areaNameEn: string;
  areaNameBn: string;
  onContinue: () => void;
  onEditLocation: () => void;
}

export const CoverageAvailableScreen: React.FC<CoverageAvailableScreenProps> = ({
  address,
  areaNameEn,
  areaNameBn,
  onContinue,
  onEditLocation,
}) => {
  const { t } = useLanguage();
  const isDark = useColorScheme() === 'dark';

  return (
    <ScreenContainer dark={isDark} applyTopInset applyBottomInset={false}>
      <View style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.animationArea}>
          <LottieView
            source={isDark ? darkAnimation : lightAnimation}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.eyebrow, isDark && styles.eyebrowDark]}>
            {t('PICK DELIVERY', 'PICK ডেলিভারি')}
          </Text>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            {t('You’re in our service area', 'আপনার এলাকায় PICK সেবা চালু আছে')}
          </Text>
          {!!areaNameEn && (
            <Text style={[styles.area, isDark && styles.areaDark]}>
              {t(areaNameEn, areaNameBn)}
            </Text>
          )}
          <Text style={[styles.address, isDark && styles.addressDark]}>📍 {address}</Text>
          <Text style={[styles.description, isDark && styles.descriptionDark]}>
            {t(
              'Fresh groceries and parcel delivery are available at this location.',
              'এই ঠিকানায় বাজার ও পার্সেল ডেলিভারি পাওয়া যাবে।'
            )}
          </Text>
          <TouchableOpacity onPress={onEditLocation} activeOpacity={0.7} style={styles.changeButton}>
            <Text style={[styles.changeText, isDark && styles.changeTextDark]}>
              {t('Change location', 'লোকেশন পরিবর্তন করুন')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.bottom, { paddingBottom: SYSTEM_INSETS.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.primaryButton, isDark && styles.primaryButtonDark]}
            onPress={onContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryText, isDark && styles.primaryTextDark]}>
              {t('Explore PICK', 'PICK ব্যবহার করুন')}
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
  containerDark: { backgroundColor: '#09090B' },
  animationArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 220, height: 220 },
  content: { alignItems: 'center', marginBottom: 24 },
  eyebrow: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  eyebrowDark: { color: '#A1A1AA' },
  title: {
    color: '#09090B',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 31,
    marginTop: 8,
    textAlign: 'center',
  },
  titleDark: { color: '#FAFAFA' },
  area: { color: '#09090B', fontSize: 16, fontWeight: '600', marginTop: 12 },
  areaDark: { color: '#FAFAFA' },
  address: { color: '#52525B', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  addressDark: { color: '#D4D4D8' },
  description: {
    color: '#71717A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 310,
    textAlign: 'center',
  },
  descriptionDark: { color: '#A1A1AA' },
  changeButton: { paddingHorizontal: 16, paddingVertical: 12 },
  changeText: { color: '#09090B', fontSize: 14, fontWeight: '600' },
  changeTextDark: { color: '#FAFAFA' },
  bottom: {},
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
  },
  primaryButtonDark: { backgroundColor: '#FAFAFA' },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  primaryTextDark: { color: '#09090B' },
});
