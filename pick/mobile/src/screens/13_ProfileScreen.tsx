import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon, IconName } from '../components/common/PickIcon';
import { BottomNav } from '../components/common/BottomNav';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import { PickUser } from '../services/auth';

interface ProfileScreenProps {
  onBack: () => void;
  onNavigateToWallet: () => void;
  onNavigateToOrders: () => void;
  onSignOut: () => void;
  onTabPress: (tab: string) => void;
  user: PickUser | null;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onNavigateToWallet,
  onNavigateToOrders,
  onSignOut,
  onTabPress,
  user,
}) => {
  const { language, toggleLanguage, setLanguage, t } = useLanguage();
  const isEn = language === 'en';

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
    },
    {
      id: 'settings',
      title: t('App Settings', 'অ্যাপ সেটিংস'),
      icon: 'settings',
    },
    {
      id: 'help',
      title: t('Help & Support', 'সহায়তা ও সাপোর্ট'),
      icon: 'help',
    },
  ];

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
            source={user?.avatar?.startsWith('https://')
              ? { uri: user.avatar }
              : require('../../assets/icon.png')}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user?.name || t('Name not set', 'নাম দেওয়া হয়নি')}
            </Text>
            <Text style={styles.userPhone}>{user?.phone || user?.email || ''}</Text>
          </View>
        </View>

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
          {t('Account & Activity', 'অ্যাকাউন্ট ও কার্যক্রম')}
        </Text>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => {
            const isLast = index === menuItems.length - 1;
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

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={onSignOut}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>{t('Sign Out', 'সাইন আউট')}</Text>
        </TouchableOpacity>
      </ScrollView>

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
});
