import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { TiwiAPI } from '../../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../../config/layout';
import { getScreenDataCache } from '../../utils/screenDataCache';
import { COLORS } from '../../config/colors';

function mergeMessages(existing, incoming) {
  const messagesById = new Map(existing.map((message) => [message.id, message]));
  incoming.forEach((message) => messagesById.set(message.id, message));
  return Array.from(messagesById.values())
    .sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
}

function getMessageCursor(messages) {
  const latest = messages.reduce((currentLatest, message) => {
    const updatedAt = message.updated_at || message.created_at;
    return !currentLatest || new Date(updatedAt) > new Date(currentLatest) ? updatedAt : currentLatest;
  }, null);
  return latest ? new Date(new Date(latest).getTime() - 1000).toISOString() : null;
}

export default function ChatConversationScreen({ routeParams, onNavigate, navigation }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const conversationId = routeParams?.conversationId || routeParams?.conversation?.id || routeParams?.id;
  const initialConversation = routeParams?.conversation || (routeParams?.id ? routeParams : null);

  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Message Action States (Unsend, Edit, Reply, React)
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  // Presence
  const [presence, setPresence] = useState({ is_online: false, last_active_at: null });

  const flatListRef = useRef(null);
  const messagesRef = useRef([]);
  const activeConversationRef = useRef(null);
  const messageRequestsInFlight = useRef(new Set());
  const messageCursorRef = useRef(null);
  const hasMoreMessagesRef = useRef(true);
  const scrollOffsetRef = useRef(0);
  const previousContentHeightRef = useRef(0);
  const preserveScrollAfterPrependRef = useRef(false);
  const contentHeightRef = useRef(0);
  const previousScrollOffsetRef = useRef(0);
  const hasUserScrolledRef = useRef(false);
  const topTheme = getActiveTopBarTheme(isDarkMode);

  useEffect(() => {
    if (conversationId) {
      activeConversationRef.current = conversationId;
      messagesRef.current = [];
      setMessages([]);
      messageCursorRef.current = null;
      hasMoreMessagesRef.current = true;
      scrollOffsetRef.current = 0;
      contentHeightRef.current = 0;
      preserveScrollAfterPrependRef.current = false;
      loadConversation();
      setLoading(true);
      getScreenDataCache(`chat-messages:${currentUser?.id || 'guest'}:${conversationId}`).then((cachedMessages) => {
        if (activeConversationRef.current !== conversationId || messagesRef.current.length > 0 || !Array.isArray(cachedMessages) || cachedMessages.length === 0) return;
        messagesRef.current = cachedMessages;
        setMessages(cachedMessages);
        setLoading(false);
        messageCursorRef.current = getMessageCursor(cachedMessages);
      });
      loadMessages(true);
      markSeen();

      const interval = setInterval(() => {
        loadMessages(true, { since: messageCursorRef.current });
      }, 3500);
      return () => {
        clearInterval(interval);
        if (activeConversationRef.current === conversationId) activeConversationRef.current = null;
      };
    }
  }, [conversationId]);

  const loadConversation = async () => {
    try {
      const data = await TiwiAPI.getChatConversation(conversationId, currentUser?.id);
      if (data) {
        setConversation(data);
        if (data.type === 'direct' && data.otherUser?.id) {
          loadPresence(data.otherUser.id);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch conversation details:', e.message);
    }
  };

  const loadPresence = async (otherUserId) => {
    try {
      const p = await TiwiAPI.getPresence(otherUserId);
      if (p) setPresence(p);
    } catch (e) {}
  };

  const loadMessages = async (isBackground = false, options = {}) => {
    if (!conversationId || messageRequestsInFlight.current.has(conversationId)) return;
    messageRequestsInFlight.current.add(conversationId);
    try {
      if (!isBackground) setLoading(true);
      const data = await TiwiAPI.getChatMessages(conversationId, currentUser?.id, options);
      if (activeConversationRef.current !== conversationId) return;
      if (Array.isArray(data) && data.length > 0) {
        const merged = mergeMessages(messagesRef.current, data);
        messagesRef.current = merged;
        setMessages(merged);
        messageCursorRef.current = getMessageCursor(merged);
      }
      if (options.before && data.length < 50) hasMoreMessagesRef.current = false;
      if (!isBackground) markSeen();
    } catch (err) {
      console.warn('Failed to load chat messages:', err.message);
    } finally {
      messageRequestsInFlight.current.delete(conversationId);
      if (!isBackground || activeConversationRef.current === conversationId) setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    const oldestMessage = messagesRef.current[0];
    if (!oldestMessage?.created_at || !hasMoreMessagesRef.current || messageRequestsInFlight.current.has(conversationId)) return;
    messageRequestsInFlight.current.add(conversationId);
    setLoadingOlder(true);
    preserveScrollAfterPrependRef.current = true;
    previousContentHeightRef.current = contentHeightRef.current;
    previousScrollOffsetRef.current = scrollOffsetRef.current;
    try {
      const data = await TiwiAPI.getChatMessages(conversationId, currentUser?.id, {
        before: oldestMessage.created_at,
        beforeId: oldestMessage.id,
        limit: 50,
      });
      if (activeConversationRef.current !== conversationId) return;
      if (Array.isArray(data) && data.length > 0) {
        const merged = mergeMessages(messagesRef.current, data);
        messagesRef.current = merged;
        setMessages(merged);
      } else {
        hasMoreMessagesRef.current = false;
        preserveScrollAfterPrependRef.current = false;
      }
      if (data.length < 50) hasMoreMessagesRef.current = false;
    } catch (err) {
      preserveScrollAfterPrependRef.current = false;
      console.warn('Failed to load older chat messages:', err.message);
    } finally {
      messageRequestsInFlight.current.delete(conversationId);
      setLoadingOlder(false);
    }
  };

  const markSeen = async () => {
    try {
      await TiwiAPI.markChatSeen(conversationId, currentUser?.id);
    } catch (e) {}
  };

  const handleSend = async () => {
    if (!inputText.trim() && !editingMessage) return;

    if (editingMessage) {
      // Edit mode
      try {
        const res = await TiwiAPI.editChatMessage(editingMessage.id, inputText.trim(), currentUser?.id);
        if (res.success) {
          setEditingMessage(null);
          setInputText('');
          loadMessages(true);
        } else {
          Alert.alert('Error', res.error || 'Failed to edit message');
        }
      } catch (err) {
        Alert.alert('Error', err.message);
      }
      return;
    }

    // Normal Send
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic item
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUser?.id,
      content: textToSend,
      message_type: 'text',
      status: 'sent',
      reply_to_id: replyingTo?.id || null,
      created_at: new Date().toISOString(),
    };
    messagesRef.current = mergeMessages(messagesRef.current, [optimistic]);
    setMessages(messagesRef.current);
    setReplyingTo(null);

    try {
      const sentMessage = await TiwiAPI.sendChatMessage(
        conversationId,
        {
          content: textToSend,
          messageType: 'text',
          replyToId: replyingTo?.id || null,
        },
        currentUser?.id
      );
      if (sentMessage?.id) {
        messagesRef.current = mergeMessages(
          messagesRef.current.filter((message) => message.id !== tempId),
          [sentMessage]
        );
        setMessages(messagesRef.current);
      }
      loadMessages(true);
    } catch (err) {
      console.error('Failed to send message:', err);
      messagesRef.current = messagesRef.current.filter((message) => message.id !== tempId);
      setMessages(messagesRef.current);
      setInputText(textToSend);
      Alert.alert('Message not sent', err.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleUnsend = async (msgId) => {
    Alert.alert(
      'Unsend Message',
      'Unsend this message for everyone in the chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsend',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await TiwiAPI.unsendChatMessage(msgId, currentUser?.id);
              if (res.success) {
                setSelectedMessage(null);
                loadMessages(true);
              } else {
                Alert.alert('Error', res.error || 'Failed to unsend message');
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleReact = async (emoji) => {
    if (!selectedMessage) return;
    try {
      await TiwiAPI.reactToChatMessage(selectedMessage.id, emoji, currentUser?.id);
      setSelectedMessage(null);
      loadMessages(true);
    } catch (err) {
      console.warn('Failed to react:', err.message);
    }
  };

  const getChatTitle = () => {
    if (conversation?.title) return conversation.title;
    if (conversation?.otherUser?.name) return conversation.otherUser.name;
    return 'Chat';
  };

  const getChatAvatar = () => {
    if (conversation?.avatar) return conversation.avatar;
    if (conversation?.otherUser?.avatar) return conversation.otherUser.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(getChatTitle())}&background=0B57D0&color=fff&size=100`;
  };

  const isOnline = conversation?.type === 'direct' ? presence.is_online : false;

  const navigateToCall = (callType) => {
    const nav = navigation?.navigate || onNavigate;
    nav?.('audio-video-call', {
      conversationId,
      callType,
      title: getChatTitle(),
      avatar: getChatAvatar(),
    });
  };

  const navigateToDetails = () => {
    const nav = navigation?.navigate || onNavigate;
    if (conversation?.type === 'group') {
      nav?.('group-details', { conversationId, conversation });
    } else {
      nav?.('chat-settings', { conversationId, conversation, otherUser: conversation?.otherUser });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

        <TouchableOpacity style={styles.headerProfile} onPress={navigateToDetails} activeOpacity={0.8}>
          <View style={styles.avatarWrapper}>
            <Image source={{ uri: getChatAvatar() }} style={styles.avatar} />
            {isOnline && <View style={styles.onlineBadge} />}
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: topTheme.headerText }]} numberOfLines={1}>
              {getChatTitle()}
            </Text>
            <Text style={[styles.headerSubtitle, { color: topTheme.headerSubtitle }]}>
              {conversation?.type === 'group'
                ? 'Tap for group info'
                : (isOnline ? 'Active now' : 'Encrypted direct chat')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Audio / Video Call & Info Actions */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigateToCall('audio')}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="call-outline" size={22} color={topTheme.headerText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigateToCall('video')}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="videocam-outline" size={23} color={topTheme.headerText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={navigateToDetails}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="information-circle-outline" size={24} color={topTheme.headerText} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Selected Message Quick Action Bar (Unsend, Edit, Reply, React, Forward) */}
      {selectedMessage && (
        <View style={[styles.messageActionBar, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.actionBarTop}>
            <Text style={[styles.actionBarTitle, { color: theme.textSecondary }]}>Message Actions</Text>
            <TouchableOpacity onPress={() => setSelectedMessage(null)}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Emoji Reactions */}
          <View style={styles.emojiRow}>
            {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => handleReact(emoji)} style={styles.emojiBtn}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
              onPress={() => {
                setReplyingTo(selectedMessage);
                setSelectedMessage(null);
              }}
            >
              <Ionicons name="return-up-back" size={16} color={COLORS.primary} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
              onPress={() => {
                const nav = navigation?.navigate || onNavigate;
                nav?.('forward-message', { message: selectedMessage });
                setSelectedMessage(null);
              }}
            >
              <Ionicons name="arrow-redo" size={16} color={COLORS.primary} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Forward</Text>
            </TouchableOpacity>

            {selectedMessage.sender_id === currentUser?.id && !selectedMessage.is_unsent && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDarkMode ? COLORS.hex_222222 : COLORS.borderLight }]}
                  onPress={() => {
                    setEditingMessage(selectedMessage);
                    setInputText(selectedMessage.content);
                    setSelectedMessage(null);
                  }}
                >
                  <Ionicons name="pencil" size={16} color={COLORS.primary} />
                  <Text style={[styles.actionBtnText, { color: theme.text }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: isDarkMode ? COLORS.rgba_217_48_37_0p15 : COLORS.hex_FCE8E6 }]}
                  onPress={() => handleUnsend(selectedMessage.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.hex_D93025} />
                  <Text style={[styles.actionBtnText, { color: COLORS.hex_D93025 }]}>Unsend</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Messages List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onScrollBeginDrag={() => { hasUserScrolledRef.current = true; }}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
            if (hasUserScrolledRef.current && event.nativeEvent.contentOffset.y <= 30 && !loadingOlder) loadOlderMessages();
          }}
          scrollEventThrottle={200}
          onContentSizeChange={(_, height) => {
            contentHeightRef.current = height;
            if (preserveScrollAfterPrependRef.current) {
              const offset = previousScrollOffsetRef.current + height - previousContentHeightRef.current;
              flatListRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: false });
              preserveScrollAfterPrependRef.current = false;
              return;
            }
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          ListHeaderComponent={loadingOlder ? <ActivityIndicator style={styles.loadingOlder} color={COLORS.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={theme.textTertiary || COLORS.hex_888888} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Say Hello!</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                End-to-end encrypted messaging with zero server storage.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === currentUser?.id;
            const isUnsent = item.is_unsent;
            const reactions = item.reactions ? Object.entries(item.reactions) : [];

            return (
              <TouchableOpacity
                onLongPress={() => setSelectedMessage(item)}
                activeOpacity={0.9}
                style={[
                  styles.messageBubbleWrapper,
                  isMe ? styles.myBubbleWrapper : styles.otherBubbleWrapper,
                ]}
              >
                {!isMe && conversation?.type === 'group' && (
                  <Text style={[styles.senderName, { color: theme.textSecondary }]}>
                    {item.sender_name || 'Member'}
                  </Text>
                )}

                <View
                  style={[
                    styles.bubble,
                    isMe
                      ? [styles.myBubble, { backgroundColor: isDarkMode ? COLORS.hex_1A73E8 : COLORS.primary }]
                      : [styles.otherBubble, { backgroundColor: isDarkMode ? COLORS.hex_252525 : COLORS.borderLight }],
                    isUnsent && styles.unsentBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      { color: isMe ? COLORS.white : theme.text },
                      isUnsent && styles.unsentText,
                    ]}
                  >
                    {item.content}
                  </Text>

                  {/* Meta row: time, edited tag, seen status */}
                  <View style={styles.bubbleMeta}>
                    {item.is_edited && !isUnsent && (
                      <Text style={[styles.editedTag, { color: isMe ? COLORS.rgba_255_255_255_0p7 : theme.textTertiary }]}>
                        (edited){' '}
                      </Text>
                    )}
                    <Text
                      style={[
                        styles.timeText,
                        { color: isMe ? COLORS.rgba_255_255_255_0p75 : (theme.textTertiary || COLORS.hex_757575) },
                      ]}
                    >
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>

                    {isMe && !isUnsent && (
                      <View style={styles.statusTicks}>
                        {item.status === 'seen' ? (
                          <Ionicons name="checkmark-done" size={16} color={COLORS.hex_8AB4F8} />
                        ) : item.status === 'delivered' ? (
                          <Ionicons name="checkmark-done" size={16} color={COLORS.rgba_255_255_255_0p6} />
                        ) : (
                          <Ionicons name="checkmark" size={16} color={COLORS.rgba_255_255_255_0p6} />
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Message Reactions Badge */}
                {reactions.length > 0 && (
                  <View style={[styles.reactionsBadge, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                    {reactions.map(([emoji, userList]) => (
                      <Text key={emoji} style={styles.reactionEmoji}>
                        {emoji} {userList.length > 1 ? userList.length : ''}
                      </Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.replyBannerContent}>
            <Text style={[styles.replyBannerTitle, { color: COLORS.primary }]}>Replying to message</Text>
            <Text style={[styles.replyBannerText, { color: theme.textSecondary }]} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <View style={[styles.replyBanner, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <View style={styles.replyBannerContent}>
            <Text style={[styles.replyBannerTitle, { color: COLORS.hex_B06000 }]}>Editing message</Text>
            <Text style={[styles.replyBannerText, { color: theme.textSecondary }]} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setEditingMessage(null); setInputText(''); }}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Composer */}
      <View style={[styles.composer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderLight }]}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => {
            const nav = navigation?.navigate || onNavigate;
            nav?.('chat-media-gallery', { conversationId, title: getChatTitle() });
          }}
        >
          <Ionicons name="add-circle-outline" size={26} color={COLORS.primary} />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: isDarkMode ? COLORS.hex_1E1E1E : COLORS.borderLight }]}
          placeholder="Message..."
          placeholderTextColor={theme.textTertiary || COLORS.hex_888888}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: inputText.trim() ? COLORS.primary : (isDarkMode ? COLORS.hex_333333 : COLORS.hex_E0E0E0) },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() && !editingMessage}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons
              name={editingMessage ? 'checkmark' : 'send'}
              size={18}
              color={inputText.trim() ? COLORS.white : (isDarkMode ? COLORS.hex_888888 : COLORS.hex_757575)}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: COLORS.hex_34A853,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  messageActionBar: {
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionBarTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  emojiBtn: {
    padding: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadingOlder: {
    paddingVertical: 10,
  },
  messageBubbleWrapper: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myBubbleWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherBubbleWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
  },
  unsentBubble: {
    opacity: 0.7,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  unsentText: {
    fontStyle: 'italic',
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  editedTag: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 11,
  },
  statusTicks: {
    marginLeft: 4,
  },
  reactionsBadge: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: -8,
  },
  reactionEmoji: {
    fontSize: 12,
    marginRight: 2,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  replyBannerContent: {
    flex: 1,
    paddingRight: 10,
  },
  replyBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyBannerText: {
    fontSize: 13,
    marginTop: 2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachBtn: {
    padding: 6,
    marginRight: 6,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    lineHeight: 20,
  },
});
