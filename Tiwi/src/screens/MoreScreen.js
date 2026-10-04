import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function MoreScreen({ onNavigate }) {
  const { theme, isDarkMode, toggleDarkMode, currentUser, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out of your Tiwi Account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const defaultAvatar = currentUser?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0B57D0&color=fff&size=200&bold=true`
    : 'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff&size=200&bold=true';

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Settings & Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 2. Tiwlo Account Top Identity Card */}
        <View style={[styles.accountCard, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
          <View style={styles.accountCardTop}>
            <Image source={{ uri: currentUser?.avatar || defaultAvatar }} style={styles.accountAvatar} />
            <View style={styles.accountTextCol}>
              <View style={styles.nameRow}>
                <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>
                  {currentUser?.name || 'User'}
                </Text>
                {currentUser?.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={[styles.accountEmail, { color: theme.textSecondary }]}>
                {currentUser?.email || currentUser?.handle || '@user'}
              </Text>
              <View style={[styles.idChip, { backgroundColor: isDarkMode ? COLORS.hex_283344 : COLORS.primaryLight }]}>
                <Text style={[styles.idChipText, { color: theme.primary }]}>
                  {currentUser?.tiwiId || (currentUser?.id ? `TIW-${currentUser.id}` : 'Tiwi Account')}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <TouchableOpacity
              style={[styles.manageAccountBtn, { flex: 1, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
              onPress={() => onNavigate('edit-profile')}
              activeOpacity={0.7}
            >
              <Text style={[styles.manageAccountBtnText, { color: theme.primary }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.manageAccountBtn, { flex: 1, backgroundColor: isDarkMode ? COLORS.hex_004A77 : COLORS.primaryContainer }]}
              onPress={() => onNavigate('settings')}
              activeOpacity={0.7}
            >
              <Text style={[styles.manageAccountBtnText, { color: isDarkMode ? COLORS.hex_C2E7FF : COLORS.hex_001D35 }]}>
                Settings & Privacy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. Section: Security & Sign-in */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Security & Sign-in</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('security-settings')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_11_87_208_0p12 }]}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Security & Sign-in</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  2FA, Password change, Active sessions
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('privacy-settings')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="lock-closed" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Privacy & Safety</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Private account, Activity status, Messaging
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('blocked-users')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_239_68_68_0p12 }]}>
                <Ionicons name="person-remove" size={18} color={COLORS.hex_EF4444} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Blocked Accounts</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Manage blocked users & interactions
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => onNavigate('notification-preferences')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_234_88_12_0p12 }]}>
                <Ionicons name="notifications" size={18} color={COLORS.hex_EA580C} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Notification Preferences</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Push alerts, Interactions, Email digest
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. Section: Creator & Tools */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Creator & Platform Tools</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('creator-analytics')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_168_85_247_0p12 }]}>
                <Ionicons name="analytics" size={18} color={COLORS.hex_A855F7} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Creator Analytics</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Live performance & engagement metrics
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('account-verification')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_29_155_240_0p12 }]}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.hex_1D9BF0} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Verification & Blue Badge</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Official identity review & benefits
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => onNavigate('bookmarks')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_245_158_11_0p12 }]}>
                <Ionicons name="bookmark" size={18} color={COLORS.hex_F59E0B} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Saved Bookmarks</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  View all saved posts and clips
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Section: Advanced Creator & Social Ecosystem */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Ecosystem & Advanced Features</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('audio-spaces')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_37_99_235_0p12 }]}>
                <Ionicons name="mic" size={18} color={COLORS.hex_2563EB} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Live Audio Spaces</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Drop-in voice stages & interactive rooms
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('community-circles')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="people" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Community Circles</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Niche interest hubs and topic channels
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('creator-tiers')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_234_88_12_0p12 }]}>
                <Ionicons name="diamond" size={18} color={COLORS.hex_EA580C} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Creator Tiers & Subscriptions</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Supporter memberships, VIP perks, and badges
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('social-wallet')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="wallet" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Social Wallet & Tips</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Send tips, receive payouts, and track balance
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('brand-marketplace')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_99_102_241_0p12 }]}>
                <Ionicons name="briefcase" size={18} color={COLORS.hex_6366F1} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Brand Marketplace</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Sponsorship campaigns & paid brand deals
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('freelance-gigs')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_14_165_233_0p12 }]}>
                <Ionicons name="construct" size={18} color={COLORS.hex_0EA5E9} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Creator Gigs & Services</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Offer video editing, design, & creative gigs
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('ai-studio')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_168_85_247_0p12 }]}>
                <Ionicons name="sparkles" size={18} color={COLORS.hex_A855F7} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>AI Creative Studio</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Generate viral post captions, scripts, & threads
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('live-trivia')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_245_158_11_0p12 }]}>
                <Ionicons name="trophy" size={18} color={COLORS.hex_F59E0B} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Live Trivia Challenge</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Compete in timed community knowledge quizzes
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('memories')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_236_72_153_0p12 }]}>
                <Ionicons name="heart" size={18} color={COLORS.hex_EC4899} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Memories (On This Day)</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Flashback throwbacks and past milestones
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('secret-chats')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="shield-half" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Encrypted Secret Chats</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Self-destructing vanishing messages
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('accessibility-settings')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_11_87_208_0p12 }]}>
                <Ionicons name="accessibility" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Accessibility & Display</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Font scaling, high contrast, & dyslexia font
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('device-sessions')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_79_70_229_0p12 }]}>
                <Ionicons name="hardware-chip" size={18} color={COLORS.hex_4F46E5} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Active Device Sessions</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Audit logins, IP locations, and remote revoke
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('content-filters')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_239_68_68_0p12 }]}>
                <Ionicons name="filter" size={18} color={COLORS.hex_EF4444} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Content & Muted Keywords</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Filter sensitive topics and hate-speech shielding
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('data-export')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_30_41_59_0p12 }]}>
                <Ionicons name="download" size={18} color={COLORS.hex_1E293B} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Export Your Data (GDPR)</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Request full account archive in JSON/ZIP
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('referral-rewards')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_234_88_12_0p12 }]}>
                <Ionicons name="gift" size={18} color={COLORS.hex_EA580C} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Referral & Rewards</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Invite friends, earn points, unlock perks
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('parental-controls')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="shield" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Parental Controls & PIN</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Screen-time limits and teen safety guardrails
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('custom-lists')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_11_87_208_0p12 }]}>
                <Ionicons name="list" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Custom Lists & Feeds</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Curated account timelines and niche feeds
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('drafts-scheduler')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_234_88_12_0p12 }]}>
                <Ionicons name="time" size={18} color={COLORS.hex_EA580C} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Drafts & Scheduled Posts</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Queue future posts and edit saved drafts
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('bio-link-builder')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="link" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Link-in-Bio Builder</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Unified link tree for stores, socials, and work
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('live-polls')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_168_85_247_0p12 }]}>
                <Ionicons name="bar-chart" size={18} color={COLORS.hex_A855F7} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Live Polls & Voting</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Real-time audience opinion surveys
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('events-hub')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_239_68_68_0p12 }]}>
                <Ionicons name="calendar" size={18} color={COLORS.hex_EF4444} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Events & Live Meetups</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Community workshops, launches, and RSVPs
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('creator-media-kit')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_11_87_208_0p12 }]}>
                <Ionicons name="document-attach" size={18} color={COLORS.primary} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Creator Media Kit & Rates</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Certified reach statistics and sponsor packages
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('co-author')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_245_158_11_0p12 }]}>
                <Ionicons name="git-merge" size={18} color={COLORS.hex_F59E0B} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Co-Author Collaborations</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Shared dual-byline posts and joint publishing
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('voice-notes')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_236_72_153_0p12 }]}>
                <Ionicons name="volume-high" size={18} color={COLORS.hex_EC4899} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Voice Broadcast Notes</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Record and publish micro-audio updates
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => onNavigate('account-appeals')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.hex_10B981} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Account Health & Appeals</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Standing status, policy compliance, and appeals
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Section: Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Preferences</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.cardBg }]}>
            <View style={styles.settingRow}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_99_102_241_0p12 }]}>
                <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={18} color={COLORS.hex_6366F1} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Theme</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  {isDarkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: COLORS.hex_DADCE0, true: theme.primary }}
                thumbColor={Platform.OS === 'android' ? COLORS.white : undefined}
              />
            </View>
          </View>
        </View>

        {/* 6. Section: Support & Legal */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Help & Legal</Text>
          <View style={[styles.cardGroup, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity
              style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
              onPress={() => onNavigate('help-support')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_14_165_233_0p12 }]}>
                <Ionicons name="help-circle" size={18} color={COLORS.hex_0EA5E9} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Help Center & Contact</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Trust & safety, FAQs, support tickets
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => onNavigate('about-tiwi')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_168_85_247_0p12 }]}>
                <Ionicons name="document-text" size={18} color={COLORS.hex_A855F7} />
              </View>
              <View style={styles.settingDetails}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>About Tiwi & Legal</Text>
                <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                  Version 2.4.0, architecture, privacy & terms
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Sign Out Button */}
        <View style={styles.logoutWrapper}>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: isDarkMode ? COLORS.hex_371E1E : COLORS.hex_FCE8E6 }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.logoutBtnText, { color: theme.danger }]}>Sign out of Tiwi</Text>
          </TouchableOpacity>
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
    height: LAYOUT.HEADER_HEIGHT,
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE + 1.5,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingVertical: 14,
    paddingBottom: 90,
  },
  // User Account Identity Card
  accountCard: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  accountCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  accountAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.hex_E2E8F0,
    marginRight: 14,
  },
  accountTextCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 17,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  idChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  idChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  manageAccountBtn: {
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageAccountBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Section Groups
  section: {
    marginBottom: 20,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  cardGroup: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingDetails: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutWrapper: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
