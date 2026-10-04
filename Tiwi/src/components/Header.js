import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function Header({ onProfilePress }) {
  const { theme, isDarkMode, currentUser } = useAuth();

  const defaultAvatar = currentUser?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0B57D0&color=fff&size=200&bold=true`
    : 'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff&size=200&bold=true';

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
      {/* Brand Logo - Official Tiwi App Icon + Wordmark (Seamless compact spacing) */}
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/tiwi.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
        <Text style={[styles.brandText, { color: topTheme.headerText }]}>Tiwi</Text>
      </View>

      {/* Profile shortcut; search is available in the bottom navigation. */}
      <View style={styles.rightActions}>
        <TouchableOpacity onPress={onProfilePress} activeOpacity={0.8} style={styles.avatarButton}>
          <Image
            source={{ uri: currentUser?.avatar || defaultAvatar }}
            style={styles.avatarImage}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 28,
    height: 28,
    marginLeft: -3.2,
    marginRight: -2,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'sans-serif',
    }),
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    padding: 1,
    borderRadius: 18,
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.hex_E2E8F0,
  },
});
