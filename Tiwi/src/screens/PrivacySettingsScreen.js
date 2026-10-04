import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function PrivacySettingsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();

  const [isPrivate, setIsPrivate] = useState(currentUser?.isPrivate || false);
  const [activityStatus, setActivityStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [messagingAudience, setMessagingAudience] = useState('Everyone'); // 'Everyone' | 'Followers'

  const handleTogglePrivate = async (val) => {
    setIsPrivate(val);
    try {
      await TiwiAPI.updateProfile({ isPrivate: val }, currentUser?.id);
      Alert.alert(
        val ? 'Private Account Enabled' : 'Public Account Enabled',
        val
          ? 'Only people who follow you will be able to see your posts, reels, and stories.'
          : 'Anyone on Tiwi can see your posts and profile.'
      );
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update privacy setting.');
    }
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Privacy & Safety</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. Account Privacy */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="lock-closed" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Private Account</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                When your account is private, only followers can view your photos and videos
              </Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={handleTogglePrivate}
              trackColor={{ false: COLORS.hex_767577, true: theme.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* 2. Activity Status */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="radio" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Activity Status</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                Show when you were last active or are currently online
              </Text>
            </View>
            <Switch
              value={activityStatus}
              onValueChange={setActivityStatus}
              trackColor={{ false: COLORS.hex_767577, true: theme.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* 3. Read Receipts */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
              <Ionicons name="checkmark-done" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Read Receipts</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
                Let others know when you have seen their messages
              </Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={setReadReceipts}
              trackColor={{ false: COLORS.hex_767577, true: theme.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* 4. Direct Messages Audience */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 4 }]}>
            Who Can Message You
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.textMuted, marginBottom: 14 }]}>
            Control who can start direct chats with you
          </Text>

          {['Everyone', 'Followers Only'].map((opt) => {
            const isSelected = messagingAudience === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.radioRow, { borderBottomColor: theme.borderLight }]}
                onPress={() => setMessagingAudience(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.radioText, { color: theme.text }]}>{opt}</Text>
                <Ionicons
                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={isSelected ? theme.primary : theme.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. Blocked Accounts Link */}
        <TouchableOpacity
          style={[styles.navCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={() => onNavigate && onNavigate('blocked-users')}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? COLORS.hex_2B1218 : COLORS.hex_FEE2E2 }]}>
            <Ionicons name="ban" size={22} color={COLORS.hex_EF4444} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Blocked Accounts</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
              Manage people you have blocked from your profile
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  radioText: {
    fontSize: 14,
    fontWeight: '500',
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
  },
});
