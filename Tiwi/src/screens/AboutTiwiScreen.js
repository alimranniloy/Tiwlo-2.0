import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function AboutTiwiScreen({ onNavigate }) {
  const { theme, isDarkMode } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const openUrl = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>About Tiwi</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Hero */}
        <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={[styles.logoIconCircle, { backgroundColor: theme.accent || COLORS.hex_1D9BF0 }]}>
            <Ionicons name="infinite" size={40} color={COLORS.white} />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>Tiwi</Text>
          <Text style={[styles.appTagline, { color: theme.textSecondary }]}>
            Next-Generation Social & Media Experience
          </Text>
          <View style={[styles.versionBadge, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}>
            <Text style={[styles.versionText, { color: theme.textSecondary }]}>Version 2.4.0 (Live Production)</Text>
          </View>
        </View>

        {/* Server & Architecture Info */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>SYSTEM ARCHITECTURE</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Connected Server</Text>
            <Text style={[styles.infoVal, { color: theme.text }]}>https://tiwlo.com</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Video Engine</Text>
            <Text style={[styles.infoVal, { color: theme.text }]}>Expo-Video (Hardware-Accelerated)</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Cloud Media Transcoding</Text>
            <Text style={[styles.infoVal, { color: theme.text }]}>FFmpeg 6.1.1 Production Cluster</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Database Architecture</Text>
            <Text style={[styles.infoVal, { color: theme.text }]}>PostgreSQL / SQLite Hybrid Core</Text>
          </View>
        </View>

        {/* Legal & Policies */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>LEGAL & POLICIES</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => openUrl('https://tiwlo.com/terms')}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="document-text-outline" size={18} color={theme.accent || COLORS.hex_1D9BF0} style={{ marginRight: 12 }} />
              <Text style={[styles.linkTitle, { color: theme.text }]}>Terms of Service</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => openUrl('https://tiwlo.com/privacy')}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.accent || COLORS.hex_1D9BF0} style={{ marginRight: 12 }} />
              <Text style={[styles.linkTitle, { color: theme.text }]}>Privacy Policy</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <TouchableOpacity
            style={styles.linkRow}
            activeOpacity={0.7}
            onPress={() => openUrl('https://tiwlo.com/community-guidelines')}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="people-outline" size={18} color={theme.accent || COLORS.hex_1D9BF0} style={{ marginRight: 12 }} />
              <Text style={[styles.linkTitle, { color: theme.text }]}>Community Guidelines</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footerWrap}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            © 2026 Tiwlo Ecosystem. All rights reserved.
          </Text>
          <Text style={[styles.footerSub, { color: theme.textSecondary }]}>
            Crafted for speed, creativity, and privacy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appTagline: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  versionBadge: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerWrap: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerSub: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.8,
  },
});
