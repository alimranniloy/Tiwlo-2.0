import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { COLORS } from '../config/colors';

export default function ChatModal({ visible, conversation, onClose, onProfilePress }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible && conversation?.id) {
      loadMessages();
    }
  }, [visible, conversation]);

  const loadMessages = async () => {
    try {
      const data = await TiwiAPI.getMessages(conversation.id);
      setMessages(data || []);
    } catch (err) {
      console.warn('Error loading chat:', err);
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    const msgText = text.trim();
    setText('');

    // Optimistic UI update
    const tempId = `temp_${Date.now()}`;
    const newMsg = {
      id: tempId,
      sender: 'me',
      text: msgText,
      time: 'Just now',
    };
    setMessages((prev) => [...prev, newMsg]);

    try {
      await TiwiAPI.sendMessage(conversation.id, msgText, currentUser?.id);
      loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  if (!conversation) return null;

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.user?.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.cardBg }]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={theme.cardBg}
          translucent={false}
        />
        <KeyboardAvoidingView
          style={[styles.container, { backgroundColor: theme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* 1. Chat Top App Bar */}
          <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.userInfo}
              onPress={() => {
                if (onProfilePress && conversation?.user) {
                  onClose();
                  onProfilePress(conversation.user);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.avatarWrapper}>
                <Image source={{ uri: conversation.user?.avatar || defaultAvatar }} style={styles.avatar} />
                {conversation.user?.online && <View style={styles.onlineBadge} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                  {conversation.user?.name || 'User'}
                </Text>
                <Text style={[styles.userStatus, { color: theme.textMuted }]}>
                  {conversation.user?.online ? 'Online' : 'Offline'}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionIcon} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionIcon} activeOpacity={0.7}>
                <Ionicons name="videocam-outline" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionIcon} activeOpacity={0.7}>
                <Ionicons name="ellipsis-vertical" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Messages Bubbles List */}
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            keyboardShouldPersistTaps="always"
            renderItem={({ item }) => {
              const isMe = item.sender === 'me';
              return (
                <View style={[styles.bubbleWrapper, isMe ? styles.myBubbleWrapper : styles.theirBubbleWrapper]}>
                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? [
                            styles.myBubble,
                            {
                              backgroundColor: theme.primary,
                            },
                          ]
                        : [
                            styles.theirBubble,
                            {
                              backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
                              borderColor: theme.borderLight,
                            },
                          ],
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        {
                          color: isMe
                            ? isDarkMode
                              ? COLORS.hex_040E28
                              : COLORS.white
                            : theme.text,
                        },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        {
                          color: isMe
                            ? isDarkMode
                              ? COLORS.rgba_4_14_40_0p7
                              : COLORS.rgba_255_255_255_0p75
                            : theme.textMuted,
                        },
                      ]}
                    >
                      {item.time || 'Now'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* 3. Message Input Pill Bar */}
          <View style={[styles.inputRow, { backgroundColor: theme.cardBg, borderTopColor: theme.borderLight }]}>
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.7}>
              <View style={[styles.attachCircle, { backgroundColor: theme.inputBg }]}>
                <Ionicons name="add" size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>

            <View style={[styles.inputPill, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Chat message..."
                placeholderTextColor={theme.textMuted}
                value={text}
                onChangeText={setText}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity style={styles.emojiBtn} activeOpacity={0.6}>
                <Ionicons name="happy-outline" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.sendBtn,
                {
                  backgroundColor: text.trim() ? theme.primary : theme.inputBg,
                },
              ]}
              onPress={handleSend}
              disabled={!text.trim()}
              activeOpacity={0.8}
            >
              <Ionicons
                name="send"
                size={16}
                color={
                  text.trim()
                    ? isDarkMode
                      ? COLORS.hex_040E28
                      : COLORS.white
                    : theme.textMuted
                }
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userStatus: {
    fontSize: 11,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 4,
  },
  actionIcon: {
    padding: 6,
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  myBubbleWrapper: {
    justifyContent: 'flex-end',
  },
  theirBubbleWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  attachBtn: {
    padding: 2,
  },
  attachCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    paddingVertical: 0,
  },
  emojiBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
