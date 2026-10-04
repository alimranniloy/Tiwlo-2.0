import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

const { width } = Dimensions.get('window');

export default function ProfileQrScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [copied, setCopied] = useState(false);

  const username = currentUser?.username || 'user';
  const displayName = currentUser?.name || currentUser?.full_name || username;
  const tiwiId = currentUser?.tiwi_id || `TIW-${String(currentUser?.id || '00000').padStart(5, '0')}`;
  const profileUrl = `${API_BASE_URL}/@${username}`;
  const avatar = currentUser?.avatar || currentUser?.avatar_url;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Connect with ${displayName} on Tiwi: ${profileUrl}`,
        url: profileUrl,
        title: `${displayName} on Tiwi`,
      });
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Tiwi Card & QR</Text>
        <TouchableOpacity
          onPress={handleShare}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="share-outline" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrap}>
        {/* Google-Inspired Creator Card */}
        <View style={[styles.qrCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          {/* Card Top Pill */}
          <View style={styles.cardHeader}>
            <View style={[styles.tiwiBrandBadge, { backgroundColor: COLORS.rgba_29_155_240_0p12 }]}>
              <Ionicons name="sparkles" size={13} color={COLORS.hex_1D9BF0} style={{ marginRight: 5 }} />
              <Text style={styles.tiwiBrandText}>TIWI OFFICIAL ID</Text>
            </View>
          </View>

          {/* User Info */}
          <View style={styles.userSection}>
            <View style={[styles.avatarWrap, { borderColor: theme.accent || COLORS.hex_1D9BF0 }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: theme.accent || COLORS.hex_1D9BF0 }]}>
                  <Text style={styles.avatarLetter}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: theme.text }]}>{displayName}</Text>
              {currentUser?.verified && (
                <Ionicons name="checkmark-circle" size={17} color={COLORS.hex_1D9BF0} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={[styles.handleText, { color: theme.textSecondary }]}>@{username}</Text>

            <View style={[styles.tiwiIdBadge, { backgroundColor: theme.surfaceLight || (isDarkMode ? COLORS.hex_222222 : COLORS.borderLight) }]}>
              <Ionicons name="finger-print" size={13} color={theme.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.tiwiIdText, { color: theme.textSecondary }]}>{tiwiId}</Text>
            </View>
          </View>

          {/* Clean Vector QR Representation */}
          <View style={[styles.qrBox, { backgroundColor: isDarkMode ? COLORS.hex_111827 : COLORS.white, borderColor: theme.borderLight }]}>
            <View style={styles.qrCornerTL} />
            <View style={styles.qrCornerTR} />
            <View style={styles.qrCornerBL} />
            <View style={styles.qrCornerBR} />

            <View style={styles.qrCenterGraphic}>
              <Ionicons name="qr-code" size={160} color={isDarkMode ? COLORS.hex_F3F4F6 : COLORS.hex_111827} />
            </View>
          </View>

          <Text style={[styles.scanHint, { color: theme.textSecondary }]}>
            Scan with any camera or Tiwi scanner to instantly view profile
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent || COLORS.hex_1D9BF0 }]}
            activeOpacity={0.8}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Share Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.copyBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            activeOpacity={0.8}
            onPress={handleCopyLink}
          >
            <Ionicons
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              color={copied ? COLORS.hex_22C55E : theme.text}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.copyBtnText, { color: copied ? COLORS.hex_22C55E : theme.text }]}>
              {copied ? 'Copied URL!' : 'Copy Link'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  contentWrap: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrCard: {
    width: Math.min(width - 40, 360),
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 16,
  },
  tiwiBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tiwiBrandText: {
    color: COLORS.hex_1D9BF0,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
  },
  handleText: {
    fontSize: 13,
    marginBottom: 8,
  },
  tiwiIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tiwiIdText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qrBox: {
    width: 200,
    height: 200,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginVertical: 14,
  },
  qrCornerTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.hex_1D9BF0,
    borderRadius: 3,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.hex_1D9BF0,
    borderRadius: 3,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.hex_1D9BF0,
    borderRadius: 3,
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.hex_1D9BF0,
    borderRadius: 3,
  },
  qrCenterGraphic: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanHint: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    maxWidth: 240,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    width: Math.min(width - 40, 360),
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
