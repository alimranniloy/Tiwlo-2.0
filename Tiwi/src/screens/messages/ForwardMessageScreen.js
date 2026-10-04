import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { COLORS } from '../../config/colors';

export default function ForwardMessageScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const messageToForward = routeParams?.message;

  const [conversations, setConversations] = useState([]);
  const [selectedConvoIds, setSelectedConvoIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);

  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    loadConversations();
  }, [currentUser?.id]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await TiwiAPI.getChatConversations(currentUser?.id, false);
      setConversations(data || []);
    } catch (err) {
      console.warn('Failed to load conversations for forwarding:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectConvo = (id) => {
    if (selectedConvoIds.includes(id)) {
      setSelectedConvoIds((prev) => prev.filter((cid) => cid !== id));
    } else {
      setSelectedConvoIds((prev) => [...prev, id]);
    }
  };

  const handleForward = async () => {
    if (selectedConvoIds.length === 0) return;
    try {
      setForwarding(true);
      // Batch send to selected conversations
      for (const cid of selectedConvoIds) {
        await TiwiAPI.sendChatMessage(
          cid,
          {
            content: messageToForward?.content || '',
            messageType: messageToForward?.message_type || 'text',
            mediaUrl: messageToForward?.media_url || null,
          },
          currentUser?.id
        );
      }
      Alert.alert('Forwarded', `Message forwarded to ${selectedConvoIds.length} conversation(s).`, [
        {
          text: 'OK',
          onPress: () => {
            if (navigation?.goBack) navigation.goBack();
            else if (onNavigate) onNavigate('back');
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to forward message');
    } finally {
      setForwarding(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const title = c.title || c.otherUser?.name || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Forward Message</Text>
        <TouchableOpacity
          style={[
            styles.forwardBtn,
            { backgroundColor: selectedConvoIds.length > 0 ? COLORS.primary : (isDarkMode ? COLORS.hex_333333 : COLORS.hex_E0E0E0) },
          ]}
          onPress={handleForward}
          disabled={selectedConvoIds.length === 0 || forwarding}
        >
          {forwarding ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text
              style={[
                styles.forwardBtnText,
                { color: selectedConvoIds.length > 0 ? COLORS.white : (isDarkMode ? COLORS.hex_888888 : COLORS.hex_757575) },
              ]}
            >
              Send ({selectedConvoIds.length})
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Message Preview Banner */}
      {messageToForward && (
        <View style={[styles.previewCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.previewLabel, { color: COLORS.primary }]}>Forwarding Content:</Text>
          <Text style={[styles.previewContent, { color: theme.text }]} numberOfLines={2}>
            {messageToForward.content || '[Media attachment]'}
          </Text>
        </View>
      )}

      {/* Search Filter */}
      <View style={[styles.searchBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary || COLORS.hex_757575} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search chats..."
          placeholderTextColor={theme.textSecondary || COLORS.hex_888888}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Conversations List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selectedConvoIds.includes(item.id);
            const title = item.title || item.otherUser?.name || 'Chat';
            const avatar = item.avatar || item.otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=0B57D0&color=fff&size=100`;

            return (
              <TouchableOpacity
                style={[styles.convoRow, { borderBottomColor: theme.borderLight }]}
                onPress={() => toggleSelectConvo(item.id)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View style={styles.convoDetails}>
                  <Text style={[styles.convoTitle, { color: theme.text }]}>{title}</Text>
                  <Text style={[styles.convoSub, { color: theme.textSecondary }]}>
                    {item.type === 'group' ? 'Group' : 'Direct message'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isSelected ? COLORS.primary : (isDarkMode ? COLORS.hex_555555 : COLORS.hex_CCCCCC),
                      backgroundColor: isSelected ? COLORS.primary : COLORS.named_transparent,
                    },
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={16} color={COLORS.white} />}
                </View>
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
    flex: 1,
    marginLeft: 8,
  },
  forwardBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  forwardBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewCard: {
    margin: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewContent: {
    fontSize: 14,
    lineHeight: 18,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 21,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
  convoSub: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
