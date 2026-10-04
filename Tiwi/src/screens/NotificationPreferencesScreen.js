import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

const STORAGE_KEY = '@tiwi_notification_preferences';

export default function NotificationPreferencesScreen({ onNavigate }) {
  const { theme, isDarkMode } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [masterPush, setMasterPush] = useState(true);
  const [likes, setLikes] = useState(true);
  const [comments, setComments] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [followers, setFollowers] = useState(true);
  const [directMessages, setDirectMessages] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [productAnnouncements, setProductAnnouncements] = useState(true);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.masterPush !== undefined) setMasterPush(parsed.masterPush);
        if (parsed.likes !== undefined) setLikes(parsed.likes);
        if (parsed.comments !== undefined) setComments(parsed.comments);
        if (parsed.mentions !== undefined) setMentions(parsed.mentions);
        if (parsed.followers !== undefined) setFollowers(parsed.followers);
        if (parsed.directMessages !== undefined) setDirectMessages(parsed.directMessages);
        if (parsed.emailDigest !== undefined) setEmailDigest(parsed.emailDigest);
        if (parsed.productAnnouncements !== undefined) setProductAnnouncements(parsed.productAnnouncements);
      }
    } catch {
      // fallback to defaults
    }
  };

  const savePrefs = async (key, val, setter) => {
    setter(val);
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const current = saved ? JSON.parse(saved) : {};
      current[key] = val;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Notification Preferences</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Master Push Toggle */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Push Notifications</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                Receive real-time alerts on your device
              </Text>
            </View>
            <Switch
              value={masterPush}
              onValueChange={(val) => savePrefs('masterPush', val, setMasterPush)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Section: Interactions */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>INTERACTIONS</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, opacity: masterPush ? 1 : 0.4 }]}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Likes & Reactions</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>When someone likes your posts or reels</Text>
            </View>
            <Switch
              disabled={!masterPush}
              value={likes}
              onValueChange={(val) => savePrefs('likes', val, setLikes)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Comments & Replies</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>When someone responds to your content</Text>
            </View>
            <Switch
              disabled={!masterPush}
              value={comments}
              onValueChange={(val) => savePrefs('comments', val, setComments)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Mentions & Tags</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>When someone mentions you with @handle</Text>
            </View>
            <Switch
              disabled={!masterPush}
              value={mentions}
              onValueChange={(val) => savePrefs('mentions', val, setMentions)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>New Followers</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>When another user begins following you</Text>
            </View>
            <Switch
              disabled={!masterPush}
              value={followers}
              onValueChange={(val) => savePrefs('followers', val, setFollowers)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Section: Messages */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>DIRECT MESSAGES</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, opacity: masterPush ? 1 : 0.4 }]}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Direct Message Alerts</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>New incoming messages and replies</Text>
            </View>
            <Switch
              disabled={!masterPush}
              value={directMessages}
              onValueChange={(val) => savePrefs('directMessages', val, setDirectMessages)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Section: Email & System */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>EMAIL & SYSTEM UPDATES</Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Security Alerts</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Critical login and device alerts (always on)</Text>
            </View>
            <View style={styles.badgeAlwaysOn}>
              <Text style={styles.badgeText}>Required</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Product News & Updates</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Important updates about Tiwi features</Text>
            </View>
            <Switch
              value={productAnnouncements}
              onValueChange={(val) => savePrefs('productAnnouncements', val, setProductAnnouncements)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.cardRow}>
            <View style={styles.cardTextCol}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Weekly Email Digest</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Summary of highlights and top posts in your inbox</Text>
            </View>
            <Switch
              value={emailDigest}
              onValueChange={(val) => savePrefs('emailDigest', val, setEmailDigest)}
              trackColor={{ false: theme.borderLight, true: theme.accent || COLORS.hex_1D9BF0 }}
              thumbColor={COLORS.white}
            />
          </View>
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
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardTextCol: {
    flex: 1,
    paddingRight: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  badgeAlwaysOn: {
    backgroundColor: COLORS.rgba_34_197_94_0p15,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: COLORS.hex_22C55E,
    fontSize: 12,
    fontWeight: '700',
  },
});
