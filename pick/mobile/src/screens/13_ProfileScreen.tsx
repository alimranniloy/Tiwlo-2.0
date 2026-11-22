import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  View,
} from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon, IconName } from '../components/common/PickIcon';
import { BottomNav } from '../components/common/BottomNav';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { API_ORIGIN } from '../config/api';
import { useLanguage } from '../context/LanguageContext';
import { PickUser, requestPickDeleteOtp } from '../services/auth';

interface ProfileScreenProps {
  onBack: () => void;
  onNavigateToWallet: () => void;
  onNavigateToOrders: () => void;
  onNavigateToAddress: () => void;
  onNavigateToSessions: () => void;
  onContactSupport: () => void;
  onDeleteAccount: (input: { confirmation: string; otpToken: string; otpCode: string }) => Promise<void>;
  onSignOut: () => void;
  onTabPress: (tab: string) => void;
  user: PickUser | null;
  isGuest?: boolean;
  onSignIn?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onNavigateToWallet,
  onNavigateToOrders,
  onNavigateToAddress,
  onNavigateToSessions,
  onContactSupport,
  onDeleteAccount,
  onSignOut,
  onTabPress,
  user,
  isGuest = false,
  onSignIn,
}) => {
  const { language, toggleLanguage, setLanguage, t } = useLanguage();
  const isEn = language === 'en';
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteOtpToken, setDeleteOtpToken] = useState('');
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const [deleteOtpMaskedEmail, setDeleteOtpMaskedEmail] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openUrl = (path: string) => {
    void Linking.openURL(`${API_ORIGIN}${path}`).catch(() => {});
  };

  const handleSendDeleteOtp = async () => {
    setDeleteError('');
    setSendingOtp(true);
    try {
      const res = await requestPickDeleteOtp();
      setDeleteOtpToken(res.otpToken);
      setDeleteOtpMaskedEmail(res.emailMasked);
    } catch (err) {
      setDeleteError(err instanceof Error
        ? err.message
        : t('Could not send Email OTP.', 'ইমেইল OTP পাঠানো যায়নি।'));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteError('');
    if (!deleteOtpToken || !/^\d{6}$/.test(deleteOtpCode.trim())) {
      setDeleteError(t('Request an Email OTP and enter the 6-digit code.', 'ইমেইল OTP নিয়ে ৬ সংখ্যার কোড দিন।'));
      return;
    }
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      setDeleteError(t('Type DELETE to confirm.', 'নিশ্চিত করতে DELETE লিখুন।'));
      return;
    }
    setDeleting(true);
    try {
      await onDeleteAccount({
        confirmation: deleteConfirmation.trim(),
        otpToken: deleteOtpToken,
        otpCode: deleteOtpCode.trim()
      });
      setDeleteModalVisible(false);
      setDeleteConfirmation('');
      setDeleteOtpToken('');
      setDeleteOtpCode('');
    } catch (err) {
      setDeleteError(err instanceof Error
        ? err.message
        : t('Could not delete your account.', 'অ্যাকাউন্ট ডিলিট করা যায়নি।'));
    } finally {
      setDeleting(false);
    }
  };

  const menuItems: {
    id: string;
    title: string;
    icon: IconName;
    action?: () => void;
  }[] = [
    {
      id: 'orders',
      title: t('My Orders', 'আমার অর্ডারসমূহ'),
      icon: 'orders',
      action: onNavigateToOrders,
    },
    {
      id: 'wallet',
      title: t('Wallet & Payments', 'ওয়ালেট ও পেমেন্ট'),
      icon: 'wallet',
      action: onNavigateToWallet,
    },
    {
      id: 'places',
      title: t('Saved Places', 'সংরক্ষিত ঠিকানা'),
      icon: 'location-pin',
      action: onNavigateToAddress,
    },
    {
      id: 'sessions',
      title: t('Logged-in Devices & Sessions', 'লগইন করা ডিভাইস ও সেশন'),
      icon: 'phone',
      action: onNavigateToSessions,
    },
    {
      id: 'settings',
      title: t('App Settings', 'অ্যাপ সেটিংস'),
      icon: 'settings',
      action: () => void Linking.openSettings().catch(() => {}),
    },
    {
      id: 'help',
      title: t('Help & Support', 'সহায়তা ও সাপোর্ট'),
      icon: 'help',
      action: onContactSupport,
    },
    {
      id: 'privacy',
      title: t('Privacy Policy', 'প্রাইভেসি পলিসি'),
      icon: 'shield',
      action: () => openUrl('/privacy-policy'),
    },
    {
      id: 'terms',
      title: t('Terms of Service', 'ব্যবহারের শর্তাবলি'),
      icon: 'file-text',
      action: () => openUrl('/terms'),
    },
  ];

  const visibleMenuItems = isGuest
    ? menuItems.filter((item) => !['orders', 'wallet', 'sessions'].includes(item.id))
    : menuItems;

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Profile', 'প্রোফাইল')} onBack={onBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SYSTEM_INSETS.bottomNavPadding + 24 },
        ]}
      >
        {/* User Info directly on background */}
        <View style={styles.userSection}>
          <Image
            source={!isGuest && user?.avatar?.startsWith('https://')
              ? { uri: user.avatar }
              : require('../../assets/icon.png')}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {isGuest
                ? t('Guest', 'গেস্ট')
                : user?.name || t('Name not set', 'নাম দেওয়া হয়নি')}
            </Text>
            <Text style={styles.userPhone}>
              {isGuest
                ? t('Browsing as guest · Cart stays saved', 'গেস্ট হিসেবে ব্রাউজ করছেন · কার্ট সংরক্ষিত থাকবে')
                : user?.phone || user?.email || ''}
            </Text>
          </View>
        </View>

        {isGuest && onSignIn && (
          <TouchableOpacity
            style={styles.guestSignInBtn}
            onPress={onSignIn}
            activeOpacity={0.85}
          >
            <Text style={styles.guestSignInText}>{t('Sign in / Login', 'সাইন ইন / লগইন')}</Text>
          </TouchableOpacity>
        )}

        {/* Language Selection Row in Settings */}
        <Text style={styles.sectionHeading}>
          {t('Preferences', 'পছন্দ ও সেটিংস')}
        </Text>

        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={toggleLanguage}
            activeOpacity={0.7}
          >
            <PickIcon name="settings" size={20} color="#09090B" />
            <Text style={styles.menuTitle}>{t('Language', 'ভাষা')}</Text>
            <View style={styles.langPill}>
              <Text
                style={[
                  styles.langOption,
                  isEn && styles.langOptionActive,
                ]}
                onPress={() => setLanguage('en')}
              >
                English
              </Text>
              <Text style={styles.langDivider}>|</Text>
              <Text
                style={[
                  styles.langOption,
                  !isEn && styles.langOptionActive,
                ]}
                onPress={() => setLanguage('bn')}
              >
                বাংলা
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <Text style={styles.sectionHeading}>
          {isGuest
            ? t('App & Support', 'অ্যাপ ও সহায়তা')
            : t('Account & Activity', 'অ্যাকাউন্ট ও কার্যক্রম')}
        </Text>

        <View style={styles.menuSection}>
          {visibleMenuItems.map((item, index) => {
            const isLast = index === visibleMenuItems.length - 1;
            return (
              <React.Fragment key={item.id}>
                <TouchableOpacity
                  style={styles.menuRow}
                  onPress={item.action}
                  activeOpacity={0.7}
                >
                  <PickIcon name={item.icon} size={20} color="#09090B" />
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <PickIcon name="chevron-right" size={16} color="#A1A1AA" />
                </TouchableOpacity>
                {!isLast && <View style={styles.hairlineDivider} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Sign Out / Exit Guest Button */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={onSignOut}
          activeOpacity={0.7}
        >
          <Text style={[styles.signOutText, isGuest && styles.guestExitText]}>
            {isGuest ? t('Exit Guest Mode', 'গেস্ট মোড থেকে বের হন') : t('Sign Out', 'সাইন আউট')}
          </Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        {!isGuest && (
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={() => {
              setDeleteError('');
              setDeleteConfirmation('');
              setDeleteOtpToken('');
              setDeleteOtpCode('');
              setDeleteOtpMaskedEmail('');
              setDeleteModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteAccountText}>{t('Delete Account', 'অ্যাকাউন্ট ডিলিট করুন')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t('Delete Tiwlo & PICK Account', 'Tiwlo ও PICK অ্যাকাউন্ট ডিলিট করুন')}
            </Text>
            <Text style={styles.modalBody}>
              {t(
                'Deleting your account disables login access to Tiwlo and PICK. Request an Email OTP and type DELETE to confirm.',
                'অ্যাকাউন্ট ডিলিট করলে Tiwlo ও PICK-এ আর লগইন করা যাবে না। ইমেইল OTP নিন এবং নিচে DELETE লিখুন।'
              )}
            </Text>
            <TouchableOpacity
              style={styles.otpBtn}
              onPress={() => void handleSendDeleteOtp()}
              disabled={sendingOtp || deleting}
            >
              <Text style={styles.otpBtnText}>
                {sendingOtp
                  ? t('Sending OTP…', 'OTP পাঠানো হচ্ছে…')
                  : deleteOtpToken
                    ? t(`Resend OTP (${deleteOtpMaskedEmail || 'email'})`, `আবার OTP পাঠান (${deleteOtpMaskedEmail || 'email'})`)
                    : t('Send Email OTP', 'ইমেইল OTP পাঠান')}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.modalInput}
              value={deleteOtpCode}
              onChangeText={(v) => setDeleteOtpCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder={t('6-digit Email OTP', '৬ সংখ্যার ইমেইল OTP')}
              placeholderTextColor="#A1A1AA"
              keyboardType="number-pad"
              maxLength={6}
              editable={!deleting}
            />
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="DELETE"
              placeholderTextColor="#A1A1AA"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}
            <TouchableOpacity
              style={styles.modalLinkBtn}
              onPress={() => openUrl('/delete-account')}
              disabled={deleting}
            >
              <Text style={styles.modalLinkText}>
                {t('Open web deletion page (tiwlo.com/delete-account)', 'ওয়েব ডিলিট পেজ খুলুন (tiwlo.com/delete-account)')}
              </Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>{t('Cancel', 'বাতিল')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalDeleteBtn, deleting && styles.disabledBtn]}
                onPress={() => void handleConfirmDelete()}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.modalDeleteText}>{t('Delete Forever', 'স্থায়ীভাবে ডিলিট')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Nav */}
      <BottomNav
        activeTab="profile"
        onTabPress={onTabPress}
        onCenterPress={() => onTabPress('parcel')}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F4F4F5',
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#71717A',
  },
  guestSignInBtn: {
    height: 46,
    backgroundColor: '#09090B',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  guestSignInText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  guestExitText: {
    color: '#18181B',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    marginBottom: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  menuTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#09090B',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  langOption: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
  },
  langOptionActive: {
    color: '#09090B',
    fontWeight: '700',
  },
  langDivider: {
    color: '#D4D4D8',
    fontSize: 12,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
  signOutBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  deleteAccountBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  deleteAccountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#52525B',
    marginBottom: 14,
  },
  modalInput: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#09090B',
    marginBottom: 10,
  },
  otpBtn: {
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  otpBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#09090B',
  },
  modalError: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 10,
  },
  modalLinkBtn: {
    marginBottom: 14,
  },
  modalLinkText: {
    fontSize: 12,
    color: '#17A56B',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
  },
  modalDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
