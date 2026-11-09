import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { ScreenContainer } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';

const lightAnimation = require('../../assets/animations/no-network-light.json');
const darkAnimation = require('../../assets/animations/no-network-dark.json');

export const NoNetworkScreen: React.FC = () => {
  const { t } = useLanguage();
  const isDark = useColorScheme() === 'dark';

  return (
    <ScreenContainer dark={isDark} applyTopInset applyBottomInset>
      <View style={styles.container}>
        <LottieView
          source={isDark ? darkAnimation : lightAnimation}
          autoPlay
          loop
          style={styles.animation}
        />
        <View style={styles.content}>
          <Text style={[styles.title, isDark && styles.titleDark]}>
            {t('No internet connection', 'ইন্টারনেট সংযোগ নেই')}
          </Text>
          <Text style={[styles.message, isDark && styles.messageDark]}>
            {t(
              'Check your Wi-Fi or mobile data. PICK will return automatically when you are back online.',
              'Wi-Fi বা মোবাইল ডেটা সংযোগ পরীক্ষা করুন। ইন্টারনেট ফিরলে PICK স্বয়ংক্রিয়ভাবে চালু হবে।'
            )}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  animation: {
    width: 240,
    height: 240,
    alignSelf: 'center',
    marginBottom: 24,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: '#09090B',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleDark: {
    color: '#FAFAFA',
  },
  message: {
    color: '#71717A',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  messageDark: {
    color: '#A1A1AA',
  },
});
