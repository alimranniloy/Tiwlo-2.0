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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function ArchivedChatsScreen({ onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    loadArchivedChats();
  }, [currentUser?.id]);

  const loadArchivedChats = async () => {
    try {
      setLoading(true);
      const data = await TiwiAPI.getChatConversations(currentUser?.id, true);
      setConversations(data || []);
    } catch (err) {
      console.warn('Failed to load archived conversations:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUnarchive = async (conversationId) => {
    try {
      await TiwiAPI.updateChatSettings(conversationId, { is_archived: false }, currentUser?.id);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      Alert.alert('Unarchived', 'Conversation moved back to your primary inbox.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to unarchive');
    }
  };

  const handleOpenChat = (item) => {
    const nav = navigation?.navigate || onNavigate;
    nav?.('chat-conversation', { conversationId: item.id, conversation: item });
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Archived Chats</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Info notice */}
      <View style={[styles.infoBanner, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        <Ionicons name="archive-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
        <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
          Archived chats stay hidden until you receive a new message or unarchive them manually.
        </Text>
      </View>

      {/* Archived Conversations List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadArchivedChats();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Archived Chats</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Conversations you archive will be stored here safely.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const title = item.title || item.otherUser?.name || 'Chat';
            const avatar = item.avatar || item.otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=0B57D0&color=fff&size=100`;

            return (
              <TouchableOpacity
                style={[styles.convoRow, { borderBottomColor: theme.borderLight }]}
                onPress={() => handleOpenChat(item)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View style={styles.convoDetails}>
                  <Text style={[styles.convoTitle, { color: theme.text }]}>{title}</Text>
                  <Text style={[styles.lastMessage, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.last_message_text || 'No messages'}
                  </Text>
                </View>

                {/* Unarchive Button */}
                <TouchableOpacity
                  style={[styles.unarchiveBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.primaryLight }]}
                  onPress={() => handleUnarchive(item.id)}
                  hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
                >
                  <Ionicons name="arrow-undo-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.unarchiveBtnText, { color: COLORS.primary }]}>Unarchive</Text>
                </TouchableOpacity>
              </TouchableOpacity>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    borderRadius: 12,
  },
  infoBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  convoRow: {
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
  convoDetails: {
    flex: 1,
  },
  convoTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  lastMessage: {
    fontSize: 13,
    marginTop: 2,
  },
  unarchiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginLeft: 8,
  },
  unarchiveBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
    lineHeight: 20,
  },
});
