import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PickIcon } from './PickIcon';
import { SYSTEM_INSETS } from './ScreenContainer';
import { useLanguage } from '../../context/LanguageContext';

interface BottomNavProps {
  activeTab?: string;
  onTabPress?: (tab: string) => void;
  onCenterPress?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab = 'home',
  onTabPress,
  onCenterPress,
}) => {
  const { t } = useLanguage();
  const bottomPadding = SYSTEM_INSETS.bottomNavPadding;

  const tabs = [
    { key: 'home', label: t('Home', 'হোম'), icon: 'home', activeIcon: 'home-active' },
    { key: 'parcel', label: t('Parcel', 'পার্সেল'), icon: 'scooter', activeIcon: 'scooter' },
    { key: 'orders', label: t('Orders', 'অর্ডার'), icon: 'orders', activeIcon: 'orders-active' },
    { key: 'wallet', label: t('Wallet', 'ওয়ালেট'), icon: 'wallet', activeIcon: 'wallet-active' },
    { key: 'profile', label: t('Profile', 'প্রোফাইল'), icon: 'profile', activeIcon: 'profile-active' },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          height: 56 + bottomPadding,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => {
              if (tab.key === 'parcel' && onCenterPress) {
                onCenterPress();
              } else {
                onTabPress?.(tab.key);
              }
            }}
            activeOpacity={0.7}
          >
            <PickIcon
              name={isActive ? (tab.activeIcon as any) : (tab.icon as any)}
              size={21}
              color={isActive ? '#09090B' : '#71717A'}
            />
            <Text
              style={[
                styles.tabLabel,
                isActive && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#09090B',
    fontWeight: '600',
  },
});
