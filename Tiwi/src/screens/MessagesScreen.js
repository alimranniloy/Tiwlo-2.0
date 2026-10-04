import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import SharedDrawer from '../components/SharedDrawer';
import { ConversationSkeleton } from '../components/SkeletonLoader';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { getScreenDataCache } from '../utils/screenDataCache';
import { COLORS } from '../config/colors';

export default function MessagesScreen({ onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser, setUnreadMessagesCount } = useAuth();
  const insets = useSafeAreaInsets();
  const newMessageFabBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) + 84;
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Chat User Picker State
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    let isCurrent = true;
    if (currentUser?.id) {
      getScreenDataCache(`conversations:${currentUser.id}:false`).then((cachedConversations) => {
        if (!isCurrent || !Array.isArray(cachedConversations)) return;
        setConversations(cachedConversations);
        setUnreadMessagesCount(cachedConversations.reduce((count, conversation) => count + (conversation.unread_count || 0), 0));
        setLoading(false);
      });
    }
    loadConversations(() => isCurrent);
    return () => {
      isCurrent = false;
    };
  }, [currentUser?.id]);

  const loadConversations = async (isCurrent = () => true) => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await TiwiAPI.getChatConversations(currentUser.id, false);
      if (!isCurrent()) return;
      setConversations(data || []);
      const unread = (data || []).reduce((acc, c) => acc + (c.unread_count || 0), 0);
      setUnreadMessagesCount(unread);
    } catch (err) {
      console.warn('Error loading conversations:', err);
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const handleOpenNewChat = async () => {
    setNewChatVisible(true);
    setLoadingUsers(true);
    try {
      const res = await TiwiAPI.search('', currentUser?.id);
      if (res && res.users) {
        setAvailableUsers(res.users.filter((u) => u.id !== currentUser?.id));
      }
    } catch (err) {
      console.warn('Error fetching users for new chat:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectUserForChat = async (user) => {
    try {
    const conversation = await TiwiAPI.createDirectChat(user.id, currentUser?.id);
    setNewChatVisible(false);
    await loadConversations();
    const existing = conversations.find((item) => item.id === conversation.id);
    const nav = navigation?.navigate || onNavigate;
    nav?.('chat-conversation', {
      conversationId: conversation.id,
      conversation: existing || {
        ...conversation,
        type: 'direct',
        otherUser: user,
        title: user.name,
        avatar: user.avatar,
      },
    });
    } catch (err) {
    Alert.alert('Cannot start chat', err.message || 'A mutual follow or an accepted follow request is required.');
    }
  };

  const handleOpenChat = (item) => {
    // Optimistic mark read
    setConversations((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, unread_count: 0, unread: false } : c))
    );
    const nav = navigation?.navigate || onNavigate;
    nav?.('chat-conversation', { conversationId: item.id, conversation: item });
  };

  const filteredConversations = conversations.filter((c) => {
    const title = c.title || c.otherUser?.name || c.user?.name || '';
    const lastMsg = c.last_message_text || c.lastMessage || '';
    return (
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lastMsg.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Messages Header & Search Pill */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: topTheme.headerText }]}>Messages</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? COLORS.rgba_255_255_255_0p08 : COLORS.rgba_0_0_0_0p05, marginRight: 6 }]}
              onPress={handleOpenNewChat}
              hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={20} color={topTheme.headerIconColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? COLORS.rgba_255_255_255_0p08 : COLORS.rgba_0_0_0_0p05 }]}
              hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={topTheme.headerIconColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Conversations Pill */}
        <View
          style={[
            styles.searchPill,
            {
              backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
            },
          ]}
        >
          <Ionicons name="search" size={17} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions Scroll Bar (New Group, Calls, Archived, Blocked) */}
        <View style={styles.quickNavRow}>
          <TouchableOpacity
            style={[styles.quickNavChip, { backgroundColor: isDarkMode ? COLORS.hex_1E232A : COLORS.primaryLight, borderColor: COLORS.primary }]}
            onPress={() => (navigation?.navigate || onNavigate)('create-group')}
            activeOpacity={0.7}
          >
            <Ionicons name="people" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.quickNavText, { color: COLORS.primary }]}>New Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickNavChip, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
            onPress={() => (navigation?.navigate || onNavigate)('call-history')}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={15} color={theme.text} style={{ marginRight: 4 }} />
            <Text style={[styles.quickNavText, { color: theme.text }]}>Call Logs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickNavChip, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
            onPress={() => (navigation?.navigate || onNavigate)('archived-chats')}
            activeOpacity={0.7}
          >
            <Ionicons name="archive-outline" size={15} color={theme.text} style={{ marginRight: 4 }} />
            <Text style={[styles.quickNavText, { color: theme.text }]}>Archived</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickNavChip, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
            onPress={() => (navigation?.navigate || onNavigate)('blocked-chats')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-outline" size={15} color={theme.text} style={{ marginRight: 4 }} />
            <Text style={[styles.quickNavText, { color: theme.text }]}>Blocked</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Conversations List */}
      {loading ? (
        <View style={{ flex: 1 }}>
          <ConversationSkeleton />
          <ConversationSkeleton />
          <ConversationSkeleton />
          <ConversationSkeleton />
          <ConversationSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadConversations();
              }}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={52} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Start a conversation with friends or create a group on Tiwi.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const displayName = item.title || item.otherUser?.name || item.user?.name || 'Chat';
            const displayAvatar = item.avatar || item.otherUser?.avatar || item.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0B57D0&color=fff&size=200&bold=true`;
            const isOnline = item.otherUser?.is_online || item.user?.online;
            const lastMessage = item.last_message_text || item.lastMessage || 'Start a conversation';
            const unreadCount = item.unread_count || (item.unread ? 1 : 0);

            return (
              <TouchableOpacity
                style={[
                  styles.convoItem,
                  {
                    backgroundColor: unreadCount > 0
                      ? isDarkMode
                        ? COLORS.hex_1A2333
                        : COLORS.hex_EDF5FD
                      : theme.cardBg,
                    borderBottomColor: theme.borderLight,
                  },
                ]}
                onPress={() => handleOpenChat(item)}
                activeOpacity={0.7}
              >
                {/* Avatar with Online Green Dot */}
                <TouchableOpacity
                  style={styles.avatarWrapper}
                  onPress={() => onNavigate && item.user && onNavigate('profile', item.user)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: displayAvatar }} style={styles.avatar} />
                  {isOnline && <View style={styles.onlineBadge} />}
                </TouchableOpacity>

                {/* Details */}
                <View style={styles.convoDetails}>
                  <View style={styles.nameTimeRow}>
                    <Text
                      style={[
                        styles.convoName,
                        {
                          color: theme.text,
                          fontWeight: unreadCount > 0 ? '700' : '600',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                    <Text style={[styles.convoTime, { color: theme.textMuted }]}>
                      {item.last_message_at
                        ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : item.time || 'Active'}
                    </Text>
                  </View>
                  <View style={styles.snippetRow}>
                    <Text
                      style={[
                        styles.snippetText,
                        {
                          color: unreadCount > 0 ? theme.textPrimary : theme.textSecondary,
                          fontWeight: unreadCount > 0 ? '600' : '400',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {lastMessage}
                    </Text>
                    {unreadCount > 0 && (
                      <View style={[styles.unreadDot, { backgroundColor: theme.primary }]}>
                        {unreadCount > 1 && (
                          <Text style={{ color: COLORS.white, fontSize: 10, fontWeight: '700' }}>
                            {unreadCount}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* 3. Start Chat FAB */}
      <TouchableOpacity
        style={[styles.startChatFab, { backgroundColor: theme.primary, bottom: newMessageFabBottom }]}
        activeOpacity={0.85}
        onPress={handleOpenNewChat}
      >
        <Ionicons name="chatbubble" size={19} color={isDarkMode ? COLORS.hex_040E28 : COLORS.white} style={{ marginRight: 6 }} />
        <Text style={[styles.startChatFabText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>
          New message
        </Text>
      </TouchableOpacity>

      {/* New Chat User Picker Drawer */}
      <SharedDrawer
        visible={newChatVisible}
        onClose={() => setNewChatVisible(false)}
        title="New Message"
        subtitle="Select someone to start chatting"
        scrollable={false}
      >
        <View style={{ paddingVertical: 8 }}>
          <View
            style={[
              styles.searchPill,
              {
                backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
                marginHorizontal: 0,
                marginBottom: 12,
              },
            ]}
          >
            <Ionicons name="search" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by name or handle..."
              placeholderTextColor={theme.textMuted}
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
            />
          </View>

          {loadingUsers ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={availableUsers.filter(
                (u) =>
                  u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                  u.handle?.toLowerCase().includes(userSearchQuery.toLowerCase())
              )}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 360 }}
              ListEmptyComponent={
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Ionicons name="person-outline" size={36} color={theme.textMuted} style={{ marginBottom: 6 }} />
                  <Text style={{ fontSize: 14, color: theme.textMuted }}>No users found</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.borderLight,
                    gap: 12,
                  }}
                  onPress={() => handleSelectUserForChat(item)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{
                      uri:
                        item.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
                    }}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.hex_E2E8F0 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{item.name}</Text>
                    <Text style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>{item.handle || '@user'}</Text>
                  </View>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </SharedDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    borderRadius: LAYOUT.HEADER_BUTTON_TOUCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 90,
  },
  convoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  convoDetails: {
    flex: 1,
  },
  nameTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  convoName: {
    fontSize: 15,
  },
  convoTime: {
    fontSize: 12,
  },
  snippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snippetText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  startChatFab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    elevation: 6,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    zIndex: 99,
  },
  startChatFabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickNavRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  quickNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.named_transparent,
  },
  quickNavText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
