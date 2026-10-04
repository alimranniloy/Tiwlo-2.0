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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function GroupDetailsScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const conversation = routeParams?.conversation || routeParams;
  const conversationId = conversation?.id || routeParams?.conversationId;

  const [details, setDetails] = useState(conversation || null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [disappearingEnabled, setDisappearingEnabled] = useState(false);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    if (conversationId) {
      loadData();
    }
  }, [conversationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [convoData, membersData] = await Promise.all([
        TiwiAPI.getChatConversation(conversationId, currentUser?.id),
        TiwiAPI.getGroupMembers(conversationId, currentUser?.id),
      ]);
      if (convoData) {
        setDetails(convoData);
        setDisappearingEnabled(!!convoData.disappearing_ttl_seconds);
      }
      if (membersData) {
        setMembers(membersData);
        const myMembership = membersData.find((m) => m.user_id === currentUser?.id);
        if (myMembership) {
          setIsMuted(!!myMembership.is_muted);
        }
      }
    } catch (err) {
      console.warn('Failed to load group details:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMute = async (val) => {
    setIsMuted(val);
    try {
      await TiwiAPI.updateChatSettings(conversationId, { is_muted: val }, currentUser?.id);
    } catch (err) {
      console.warn('Failed to toggle mute:', err.message);
    }
  };

  const handleToggleDisappearing = async (val) => {
    setDisappearingEnabled(val);
    try {
      await TiwiAPI.updateChatSettings(
        conversationId,
        { disappearing_ttl_seconds: val ? 86400 : 0 },
        currentUser?.id
      );
    } catch (err) {
      console.warn('Failed to toggle disappearing:', err.message);
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await TiwiAPI.removeGroupMember(conversationId, currentUser?.id, currentUser?.id);
            if (navigation?.navigate) {
              navigation.navigate('messages');
            } else if (onNavigate) {
              onNavigate('messages');
            }
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to leave group');
          }
        },
      },
    ]);
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(details?.title || 'Group')}&background=0B57D0&color=fff&size=200&bold=true`;

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Group Info</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Group Profile Hero */}
          <View style={styles.heroSection}>
            <Image source={{ uri: details?.avatar || defaultAvatar }} style={styles.groupAvatar} />
            <Text style={[styles.groupTitleText, { color: theme.text }]}>
              {details?.title || 'Group Chat'}
            </Text>
            <Text style={[styles.groupMetaText, { color: theme.textSecondary }]}>
              {members.length} {members.length === 1 ? 'member' : 'members'} • Group
            </Text>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              onPress={() => {
                const nav = navigation?.navigate || onNavigate;
                nav?.('audio-video-call', { conversationId, callType: 'audio', title: details?.title });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={20} color={COLORS.primary} />
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              onPress={() => {
                const nav = navigation?.navigate || onNavigate;
                nav?.('audio-video-call', { conversationId, callType: 'video', title: details?.title });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="videocam" size={20} color={COLORS.primary} />
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>Video</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              onPress={() => {
                const nav = navigation?.navigate || onNavigate;
                nav?.('chat-search', { conversationId });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={20} color={COLORS.primary} />
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>Search</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
              onPress={() => {
                const nav = navigation?.navigate || onNavigate;
                nav?.('chat-media-gallery', { conversationId, title: details?.title });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="images" size={20} color={COLORS.primary} />
              <Text style={[styles.quickActionLabel, { color: theme.text }]}>Media</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Tile: Members */}
          <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <TouchableOpacity
              style={styles.navRow}
              onPress={() => {
                const nav = navigation?.navigate || onNavigate;
                nav?.('group-members', { conversationId, conversation: details });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.navRowLeft}>
                <Ionicons name="people-outline" size={22} color={COLORS.primary} style={styles.navIcon} />
                <View>
                  <Text style={[styles.navRowTitle, { color: theme.text }]}>Members</Text>
                  <Text style={[styles.navRowSubtitle, { color: theme.textSecondary }]}>
                    {members.length} members • View roles & permissions
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textTertiary || COLORS.hex_888888} />
            </TouchableOpacity>
          </View>

          {/* Settings Section */}
          <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <View style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}>
              <View style={styles.settingTextWrapper}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Mute Notifications</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Silence message and mention alerts
                </Text>
              </View>
              <Switch
                value={isMuted}
                onValueChange={handleToggleMute}
                trackColor={{ false: isDarkMode ? COLORS.hex_444444 : COLORS.hex_D1D5DB, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingTextWrapper}>
                <Text style={[styles.settingTitle, { color: theme.text }]}>Disappearing Messages</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  New messages vanish after 24 hours
                </Text>
              </View>
              <Switch
                value={disappearingEnabled}
                onValueChange={handleToggleDisappearing}
                trackColor={{ false: isDarkMode ? COLORS.hex_444444 : COLORS.hex_D1D5DB, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>

          {/* Privacy & Encryption Information */}
          <View style={[styles.infoBanner, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
              Messages and calls are end-to-end encrypted. No third party or server relays can read or listen to them.
            </Text>
          </View>

          {/* Leave Group Action */}
          <TouchableOpacity
            style={[styles.leaveBtn, { backgroundColor: isDarkMode ? COLORS.rgba_217_48_37_0p15 : COLORS.hex_FCE8E6 }]}
            onPress={handleLeaveGroup}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.hex_D93025} style={{ marginRight: 8 }} />
            <Text style={styles.leaveBtnText}>Leave Group</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  groupAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
  },
  groupTitleText: {
    fontSize: 20,
    fontWeight: '700',
  },
  groupMetaText: {
    fontSize: 14,
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickActionBtn: {
    width: 76,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    marginRight: 14,
  },
  navRowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  navRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingTextWrapper: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  leaveBtnText: {
    color: COLORS.hex_D93025,
    fontSize: 15,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
