import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function ChatSearchScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const conversationId = routeParams?.conversationId;

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
  }, [conversationId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await TiwiAPI.getAllChatMessages(conversationId, currentUser?.id);
      setMessages(data || []);
    } catch (err) {
      console.warn('Failed to load chat messages for search:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const matchingMessages = query.trim()
    ? messages.filter((m) =>
        (m.content || '').toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  const handleSelectMessage = (item) => {
    const nav = navigation?.navigate || onNavigate;
    nav?.('chat-conversation', { conversationId, highlightMessageId: item.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Search App Bar */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation?.goBack ? navigation.goBack() : onNavigate?.('back'))}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={topTheme.headerText} />
        </TouchableOpacity>

        <View style={[styles.searchInputWrapper, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary || COLORS.hex_757575} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search in conversation..."
            placeholderTextColor={theme.textSecondary || COLORS.hex_888888}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Results View */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : query.trim().length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Search messages</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Find texts, shared words, and details in this chat.
          </Text>
        </View>
      ) : (
        <FlatList
          data={matchingMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No results found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                No messages found matching "{query}"
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === currentUser?.id;
            return (
              <TouchableOpacity
                style={[styles.resultItem, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                onPress={() => handleSelectMessage(item)}
                activeOpacity={0.7}
              >
                <View style={styles.resultHeader}>
                  <Text style={[styles.senderName, { color: isMe ? COLORS.primary : theme.text }]}>
                    {isMe ? 'You' : item.sender_name || 'Member'}
                  </Text>
                  <Text style={[styles.resultTime, { color: theme.textSecondary }]}>
                    {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Text style={[styles.messageContent, { color: theme.text }]} numberOfLines={2}>
                  {item.content}
                </Text>
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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  resultItem: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultTime: {
    fontSize: 12,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
