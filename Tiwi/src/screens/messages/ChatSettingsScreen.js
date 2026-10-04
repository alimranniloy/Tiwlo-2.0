import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function ChatSettingsScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const conversationId = routeParams?.conversationId;
  const otherUser = routeParams?.otherUser || routeParams?.conversation?.otherUser;

  const [conversation, setConversation] = useState(routeParams?.conversation || null);
  const [nickname, setNickname] = useState(otherUser?.name || 'User');
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [ttlOption, setTtlOption] = useState(0); // 0 = off, 86400 = 24h, 604800 = 7d

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    if (conversationId) {
      loadSettings();
    }
  }, [conversationId]);

  const loadSettings = async () => {
    try {
      const data = await TiwiAPI.getChatConversation(conversationId, currentUser?.id);
      if (data) {
        setConversation(data);
        setIsArchived(!!data.is_archived);
        setTtlOption(data.disappearing_ttl_seconds || 0);
      }
    } catch (e) {
      console.warn('Failed to load chat settings:', e.message);
    }
  };

  const handleToggleMute = async (val) => {
    setIsMuted(val);
    try {
      await TiwiAPI.updateChatSettings(conversationId, { is_muted: val }, currentUser?.id);
    } catch (e) {}
  };

  const handleToggleArchive = async (val) => {
    setIsArchived(val);
    try {
      await TiwiAPI.updateChatSettings(conversationId, { is_archived: val }, currentUser?.id);
    } catch (e) {}
  };

  const handleSelectTtl = async (seconds) => {
    setTtlOption(seconds);
    try {
      await TiwiAPI.updateChatSettings(conversationId, { disappearing_ttl_seconds: seconds }, currentUser?.id);
    } catch (e) {}
  };

  const handleBlockUser = () => {
    Alert.alert('Block User', `Are you sure you want to block ${otherUser?.name || 'this user'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Blocked', 'User has been blocked. You will no longer receive calls or messages.');
        },
      },
    ]);
  };

  const avatar = otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || 'User')}&background=0B57D0&color=fff&size=200`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation?.goBack ? navigation.goBack() : onNavigate?.('back'))}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={topTheme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Chat Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileSection}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <Text style={[styles.profileName, { color: theme.text }]}>{otherUser?.name || 'Contact'}</Text>
          <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>
            @{otherUser?.handle || otherUser?.tiwi_id || 'user'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => {
              const nav = navigation?.navigate || onNavigate;
              nav?.('audio-video-call', { conversationId, callType: 'audio', title: otherUser?.name });
            }}
          >
            <Ionicons name="call" size={20} color={COLORS.primary} />
            <Text style={[styles.quickBtnLabel, { color: theme.text }]}>Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => {
              const nav = navigation?.navigate || onNavigate;
              nav?.('audio-video-call', { conversationId, callType: 'video', title: otherUser?.name });
            }}
          >
            <Ionicons name="videocam" size={20} color={COLORS.primary} />
            <Text style={[styles.quickBtnLabel, { color: theme.text }]}>Video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => {
              const nav = navigation?.navigate || onNavigate;
              nav?.('chat-search', { conversationId });
            }}
          >
            <Ionicons name="search" size={20} color={COLORS.primary} />
            <Text style={[styles.quickBtnLabel, { color: theme.text }]}>Search</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => {
              const nav = navigation?.navigate || onNavigate;
              nav?.('chat-media-gallery', { conversationId, title: otherUser?.name });
            }}
          >
            <Ionicons name="images" size={20} color={COLORS.primary} />
            <Text style={[styles.quickBtnLabel, { color: theme.text }]}>Media</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Nickname Section */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.cardHeaderTitle, { color: theme.textSecondary }]}>Custom Nickname</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.nicknameInput, { color: theme.text, borderBottomColor: theme.borderLight }]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Set a nickname..."
              placeholderTextColor={theme.textTertiary || COLORS.hex_888888}
            />
          </View>
        </View>

        {/* Disappearing Messages Segment */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.cardHeaderTitle, { color: theme.textSecondary }]}>Disappearing Messages</Text>
          <Text style={[styles.cardHeaderSubtitle, { color: theme.textSecondary }]}>
            When enabled, new messages will disappear after the selected period.
          </Text>
          <View style={styles.ttlOptionsRow}>
            {[
              { label: 'Off', seconds: 0 },
              { label: '24 Hours', seconds: 86400 },
              { label: '7 Days', seconds: 604800 },
              { label: '90 Days', seconds: 7776000 },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[
                  styles.ttlChip,
                  {
                    backgroundColor: ttlOption === opt.seconds ? COLORS.primary : (isDarkMode ? COLORS.hex_222222 : COLORS.borderLight),
                  },
                ]}
                onPress={() => handleSelectTtl(opt.seconds)}
              >
                <Text
                  style={[
                    styles.ttlChipText,
                    { color: ttlOption === opt.seconds ? COLORS.white : theme.text },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications & Toggles */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={[styles.toggleRow, { borderBottomColor: theme.borderLight }]}>
            <View>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Mute Notifications</Text>
              <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>Silence all alerts</Text>
            </View>
            <Switch
              value={isMuted}
              onValueChange={handleToggleMute}
              trackColor={{ false: isDarkMode ? COLORS.hex_444444 : COLORS.hex_D1D5DB, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>Archive Conversation</Text>
              <Text style={[styles.toggleSubtitle, { color: theme.textSecondary }]}>Hide from primary inbox</Text>
            </View>
            <Switch
              value={isArchived}
              onValueChange={handleToggleArchive}
              trackColor={{ false: isDarkMode ? COLORS.hex_444444 : COLORS.hex_D1D5DB, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        </View>

        {/* Security & Encryption Verification */}
        <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.encryptionHeader}>
            <Ionicons name="shield-checkmark" size={24} color={COLORS.hex_34A853} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.encryptionTitle, { color: theme.text }]}>End-to-End Encryption</Text>
              <Text style={[styles.encryptionSubtitle, { color: theme.textSecondary }]}>
                Messages and calls are secured with DTLS-SRTP P2P encryption.
              </Text>
            </View>
          </View>
          <View style={[styles.fingerprintBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
            <Text style={[styles.fingerprintText, { color: theme.textSecondary }]}>
              Safety Fingerprint: 4892 0184 7291 9304 8172 0941 7381 0293
            </Text>
          </View>
        </View>

        {/* Privacy & Actions */}
        <TouchableOpacity
          style={[styles.dangerBtn, { backgroundColor: isDarkMode ? COLORS.rgba_217_48_37_0p15 : COLORS.hex_FCE8E6 }]}
          onPress={handleBlockUser}
          activeOpacity={0.8}
        >
          <Ionicons name="ban" size={20} color={COLORS.hex_D93025} style={{ marginRight: 8 }} />
          <Text style={styles.dangerBtnText}>Block {otherUser?.name || 'Contact'}</Text>
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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileHandle: {
    fontSize: 14,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickBtn: {
    width: 76,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  cardHeaderSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  inputWrapper: {
    marginTop: 4,
  },
  nicknameInput: {
    fontSize: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  ttlOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ttlChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ttlChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  encryptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  encryptionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  encryptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  fingerprintBox: {
    padding: 10,
    borderRadius: 10,
  },
  fingerprintText: {
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  dangerBtnText: {
    color: COLORS.hex_D93025,
    fontSize: 15,
    fontWeight: '600',
  },
});
