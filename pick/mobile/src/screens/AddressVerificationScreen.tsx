import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import LottieView from 'lottie-react-native';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import {
  verifyAndSaveCurrentDeliveryAddress,
  verifyPreAuthPickAddress
} from '../services/location';

type SavedAddress = Awaited<ReturnType<typeof verifyAndSaveCurrentDeliveryAddress>>;

interface AddressVerificationScreenProps {
  onComplete?: (result: SavedAddress) => void;
  preAuthTempToken?: string;
  onPreAuthComplete?: () => void;
  onCancelPreAuth?: () => void;
}

export const AddressVerificationScreen: React.FC<AddressVerificationScreenProps> = ({
  onComplete,
  preAuthTempToken,
  onPreAuthComplete,
  onCancelPreAuth
}) => {
  const { t } = useLanguage();
  const isDark = useColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    setBusy(true);
    setError('');
    try {
      if (preAuthTempToken) {
        await verifyPreAuthPickAddress(preAuthTempToken);
        onPreAuthComplete?.();
      } else {
        const result = await verifyAndSaveCurrentDeliveryAddress();
        if (!onComplete) throw new Error('Address verification could not continue.');
        onComplete(result);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t(
        'Could not verify your current location. Please try again.',
        'আপনার বর্তমান অবস্থান যাচাই করা যায়নি। আবার চেষ্টা করুন।'
      ));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer dark={isDark} applyTopInset applyBottomInset={false}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: SYSTEM_INSETS.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('Address verification animation', 'ঠিকানা যাচাইয়ের অ্যানিমেশন')}
          style={styles.animationWrap}
        >
          <LottieView
            source={require('../../assets/animations/address-verification.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, isDark && styles.mutedDark]}>
            {t('ONE-TIME SETUP', 'একবারের যাচাই')}
          </Text>
          <Text style={[styles.title, isDark && styles.textDark]}>
            {t('Verify your address', 'আপনার ঠিকানা যাচাই করুন')}
          </Text>
          <Text style={[styles.description, isDark && styles.mutedDark]}>
            {t(
              'Allow location access and Tiwlo will securely verify your address. You can’t continue until verification is complete.',
              'লোকেশন ব্যবহারের অনুমতি দিন, Tiwlo নিরাপদে আপনার ঠিকানা যাচাই করবে। যাচাই সম্পন্ন না হলে এগোনো যাবে না।'
            )}
          </Text>
        </View>

        <View style={[styles.infoCard, isDark && styles.infoCardDark]}>
          <Text style={[styles.infoTitle, isDark && styles.textDark]}>
            {t('Your location stays protected', 'আপনার লোকেশন সুরক্ষিত থাকবে')}
          </Text>
          <Text style={[styles.infoText, isDark && styles.mutedDark]}>
            {t(
              'Your current GPS location is checked with Tiwlo’s address verification and saved to your account.',
              'আপনার GPS লোকেশন Tiwlo-এর ঠিকানা যাচাই ব্যবস্থায় পরীক্ষা করে অ্যাকাউন্টে সংরক্ষণ করা হবে।'
            )}
          </Text>
        </View>

        {Boolean(error) && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.disabled]}
          onPress={() => void handleVerify()}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.primaryText}>{t('Verify with my location', 'আমার লোকেশন দিয়ে যাচাই করুন')}</Text>}
        </TouchableOpacity>
        {preAuthTempToken && onCancelPreAuth && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelPreAuth}
            disabled={busy}
            activeOpacity={0.75}
          >
            <Text style={[styles.cancelText, isDark && styles.mutedDark]}>
              {t('Back to sign in', 'লগইনে ফিরে যান')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 12 },
  animationWrap: { width: 210, height: 210, alignSelf: 'center', marginBottom: 12 },
  animation: { width: '100%', height: '100%' },
  intro: { alignItems: 'center', marginBottom: 24 },
  eyebrow: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  title: { color: '#09090B', fontSize: 23, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  description: { color: '#71717A', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  textDark: { color: '#FAFAFA' },
  mutedDark: { color: '#A1A1AA' },
  infoCard: { backgroundColor: '#F4F4F5', borderRadius: 14, padding: 16, marginBottom: 8 },
  infoCardDark: { backgroundColor: '#18181B' },
  infoTitle: { color: '#18181B', fontSize: 14, fontWeight: '700', marginBottom: 6 },
  infoText: { color: '#71717A', fontSize: 13, lineHeight: 20 },
  errorText: { color: '#B91C1C', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 12 },
  primaryButton: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090B', marginTop: 18 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancelButton: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#71717A', fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.55 }
});
