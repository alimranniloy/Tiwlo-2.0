import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';

const lightAnimation = require('../../assets/animations/coverage-unavailable-light.json');
const darkAnimation = require('../../assets/animations/coverage-unavailable-dark.json');

interface CoverageUnavailableScreenProps {
  address: string;
  onJoinWaitlist: () => void;
  onChangeLocation: () => void;
  changingLocation: boolean;
  joining: boolean;
  joined: boolean;
  error: string;
}

export const CoverageUnavailableScreen: React.FC<CoverageUnavailableScreenProps> = ({
  address,
  onJoinWaitlist,
  onChangeLocation,
  changingLocation,
  joining,
  joined,
  error,
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
            {joined
              ? t('You’re on the waitlist', 'আপনাকে অপেক্ষার তালিকায় রাখা হয়েছে')
              : t('We’re not here yet', 'এই এলাকায় PICK এখনো চালু হয়নি')}
          </Text>
          <Text style={[styles.address, isDark && styles.addressDark]}>📍 {address}</Text>
          <Text style={[styles.description, isDark && styles.descriptionDark]}>
            {joined
              ? t(
                  'Your preferred area is saved. The PICK team can see your request while planning nearby service.',
                  'আপনার পছন্দের এলাকা সংরক্ষণ করা হয়েছে। কাছাকাছি সেবার পরিকল্পনায় PICK টিম আপনার অনুরোধটি দেখতে পারবে।'
                )
              : t(
                  'This address is outside PICK’s active delivery zones. Join the waitlist so our team can see your area request.',
                  'এই ঠিকানাটি PICK-এর বর্তমান ডেলিভারি এলাকার বাইরে। আপনার এলাকার অনুরোধটি PICK টিমকে জানাতে অপেক্ষার তালিকায় যোগ দিন।'
                )}
          </Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            onPress={onChangeLocation}
            disabled={changingLocation}
            activeOpacity={0.7}
            style={styles.changeButton}
          >
            {changingLocation
              ? <ActivityIndicator size="small" color={isDark ? '#FAFAFA' : '#09090B'} />
              : <Text style={[styles.changeText, isDark && styles.changeTextDark]}>
                  {t('Try a different location', 'অন্য লোকেশন দিন')}
                </Text>}
          </TouchableOpacity>
        </View>
        <View style={[styles.bottom, { paddingBottom: SYSTEM_INSETS.bottom + 16 }]}>
          <TouchableOpacity
            style={[styles.primaryButton, isDark && styles.primaryButtonDark, (joined || joining) && styles.disabledButton]}
            onPress={onJoinWaitlist}
            disabled={joined || joining}
            activeOpacity={0.85}
          >
            {joining
              ? <ActivityIndicator color={isDark ? '#09090B' : '#FFFFFF'} />
              : <Text style={[styles.primaryText, isDark && styles.primaryTextDark]}>
                  {joined
                    ? t('Added to waitlist', 'অপেক্ষার তালিকায় যোগ হয়েছে')
                    : t('Join coverage waitlist', 'কভারেজ অপেক্ষার তালিকায় যোগ দিন')}
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
  containerDark: { backgroundColor: '#09090B' },
  animationArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 210, height: 210 },
  content: { alignItems: 'center', marginBottom: 20 },
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
  address: { color: '#52525B', fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center' },
  addressDark: { color: '#D4D4D8' },
  description: {
    color: '#71717A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
    textAlign: 'center',
  },
  descriptionDark: { color: '#A1A1AA' },
  error: { color: '#DC2626', fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  changeButton: { paddingHorizontal: 16, paddingVertical: 10 },
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
  disabledButton: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  primaryTextDark: { color: '#09090B' },
});
