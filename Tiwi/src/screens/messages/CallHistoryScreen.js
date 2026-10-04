import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function CallHistoryScreen({ onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [calls, setCalls] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' or 'missed'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    loadCallHistory();
  }, [currentUser?.id]);

  const loadCallHistory = async () => {
    try {
      setLoading(true);
      const data = await TiwiAPI.getCallHistory(currentUser?.id);
      setCalls(data || []);
    } catch (err) {
      console.warn('Failed to load call history:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRedial = (call) => {
    const isCaller = call.caller_id === currentUser?.id;
    const targetUserId = isCaller ? call.receiver_id : call.caller_id;
    const targetName = isCaller ? (call.receiver_name || 'User') : (call.caller_name || 'User');
    const targetAvatar = isCaller ? call.receiver_avatar : call.caller_avatar;

    const nav = navigation?.navigate || onNavigate;
    nav?.('audio-video-call', {
      conversationId: call.conversation_id,
      callType: call.call_type || 'video',
      receiverId: targetUserId,
      title: targetName,
      avatar: targetAvatar,
    });
  };

  const filteredCalls = calls.filter((c) => {
    if (filter === 'missed') return c.status === 'missed' || c.status === 'rejected';
    return true;
  });

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Call History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs Filter */}
      <View style={[styles.tabsRow, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, filter === 'all' && [styles.tabBtnActive, { backgroundColor: theme.cardBg }]]}
          onPress={() => setFilter('all')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: filter === 'all' ? COLORS.primary : theme.textSecondary },
            ]}
          >
            All Calls ({calls.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, filter === 'missed' && [styles.tabBtnActive, { backgroundColor: theme.cardBg }]]}
          onPress={() => setFilter('missed')}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.tabBtnText,
              { color: filter === 'missed' ? COLORS.hex_D93025 : theme.textSecondary },
            ]}
          >
            Missed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calls List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCalls}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadCallHistory();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="call-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No call logs</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Voice and video calls with friends will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isCaller = item.caller_id === currentUser?.id;
            const otherName = isCaller ? (item.receiver_name || 'Contact') : (item.caller_name || 'Contact');
            const otherAvatar = isCaller ? item.receiver_avatar : item.caller_avatar;
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=0B57D0&color=fff&size=100`;

            const isMissed = item.status === 'missed' || item.status === 'rejected';

            return (
              <View style={[styles.callRow, { borderBottomColor: theme.borderLight }]}>
                <Image source={{ uri: otherAvatar || defaultAvatar }} style={styles.avatar} />

                <View style={styles.callDetails}>
                  <Text style={[styles.contactName, { color: isMissed ? COLORS.hex_D93025 : theme.text }]}>
                    {otherName}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons
                      name={
                        isMissed
                          ? 'call-outline'
                          : isCaller
                          ? 'arrow-up-forward'
                          : 'arrow-down-back'
                      }
                      size={14}
                      color={isMissed ? COLORS.hex_D93025 : isCaller ? COLORS.primary : COLORS.hex_34A853}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                      {item.call_type === 'video' ? 'Video call' : 'Audio call'}
                      {item.duration_seconds > 0 ? ` • ${formatDuration(item.duration_seconds)}` : ''}
                      {' • '}
                      {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                </View>

                {/* Redial Action Button */}
                <TouchableOpacity
                  style={[styles.redialBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
                  onPress={() => handleRedial(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.call_type === 'video' ? 'videocam' : 'call'}
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
              </View>
            );
          }}
        />
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
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 4,
    borderRadius: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    elevation: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  callDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaText: {
    fontSize: 12,
  },
  redialBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
});
