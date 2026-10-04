import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../config/colors';
import { useAuth } from '../context/AuthContext';

export default function BottomNavBar({ activeTab, onTabSelect, blurTarget }) {
  const { isDarkMode, unreadNotificationsCount, unreadMessagesCount } = useAuth();
  const insets = useSafeAreaInsets();

  const safeBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);
  const isReels = activeTab === 'reels';
  const dockTint = isReels || isDarkMode ? 'dark' : 'light';
  const dockOverlay = isReels
    ? 'rgba(20, 20, 22, 0.22)'
    : isDarkMode
    ? 'rgba(32, 33, 36, 0.26)'
    : 'rgba(255, 255, 255, 0.22)';
  const dockBorder = isReels
    ? 'rgba(255, 255, 255, 0.22)'
    : isDarkMode
    ? 'rgba(255, 255, 255, 0.16)'
    : 'rgba(255, 255, 255, 0.62)';
  const activeColor = isReels ? COLORS.white : isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary;
  const inactiveColor = isReels ? COLORS.navReelsInactive : isDarkMode ? COLORS.hex_9AA0A6 : COLORS.hex_5F6368;
  const badgeBorderColor = isDarkMode ? COLORS.hex_1E1F20 : COLORS.white;

  const navItems = [
    { key: 'feed', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    { key: 'search', label: 'Search', icon: 'search-outline', activeIcon: 'search' },
    {
      key: 'reels',
      label: 'Shorts',
      isReelsTab: true,
    },
    {
      key: 'notifications',
      label: 'Activity',
      icon: 'notifications-outline',
      activeIcon: 'notifications',
      badge: unreadNotificationsCount,
    },
    {
      key: 'messages',
      label: 'Messages',
      icon: 'chatbubble-outline',
      activeIcon: 'chatbubble',
      badge: unreadMessagesCount,
    },
  ];

  return (
    <View
      style={[
        styles.outerContainer,
        {
          paddingBottom: safeBottom,
        },
      ]}
      pointerEvents="box-none"
    >
      <BlurView
        style={[
          styles.dock,
          {
            backgroundColor: dockOverlay,
            borderColor: dockBorder,
          },
        ]}
        tint={dockTint}
        intensity={85}
        blurReductionFactor={2}
        blurTarget={blurTarget}
        blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        reducedTransparencyFallbackColor={isReels ? COLORS.dockReelsBackground : isDarkMode ? COLORS.dockDarkBackground : COLORS.dockFallbackBackground}
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.navItem}
              onPress={() => onTabSelect(item.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.iconWrapper}>
                {item.isReelsTab ? (
                  <View style={styles.shortsIconContainer}>
                    <MaterialCommunityIcons
                      name="movie-open-play"
                      size={27}
                      color={COLORS.shortsAccent}
                    />
                  </View>
                ) : (
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={isActive ? item.activeIcon : item.icon}
                      size={25}
                      color={isActive ? activeColor : inactiveColor}
                    />
                    {!!item.badge && item.badge > 0 && (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: COLORS.danger,
                            borderColor: badgeBorderColor,
                          },
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {item.badge > 9 ? '9+' : item.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  dock: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    elevation: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    paddingVertical: 3,
  },
  iconWrapper: {
    width: 48,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortsIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '800',
  },
});
