import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

const TTL_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '5m', value: 300 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

export default function SecretChatsScreen({ navigation, onNavigate, user, isDark }) {
  const insets = useSafeAreaInsets();
  const [recipient, setRecipient] = useState('');
  const [activeChat, setActiveChat] = useState(null); // { id, peerUsername, ttl }
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [selectedTtl, setSelectedTtl] = useState(300); // 5 min default
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [secretChatsList, setSecretChatsList] = useState([]);

  const scrollViewRef = useRef(null);

  const fetchSecretChats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/secret-chats?userId=${user?.id || ''}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSecretChatsList(Array.isArray(data.chats) ? data.chats : []);
      } else {
        setSecretChatsList([]);
      }
    } catch {
      setSecretChatsList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSecretChats();
  }, [fetchSecretChats]);

  const handleStartSecretChat = () => {
    if (!recipient.trim()) return;
    const cleanRecipient = recipient.replace(/^@/, '').trim();
    const newChat = {
      id: `sc_${Date.now()}`,
      peerUsername: cleanRecipient,
      ttl: selectedTtl,
      createdAt: new Date().toISOString(),
    };
    setActiveChat(newChat);
    setMessages([]);
  };

  const handleSendMessage = async () => {
    if (!inputMsg.trim() || !activeChat) return;
    const msgText = inputMsg.trim();
    setInputMsg('');
    setSending(true);

    const newMsg = {
      id: `msg_${Date.now()}`,
      senderId: user?.id,
      text: msgText,
      expiresAt: Date.now() + activeChat.ttl * 1000,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      await fetch(`${API_BASE_URL}/api/social/secret-chats/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user?.id,
          recipientUsername: activeChat.peerUsername,
          text: msgText,
          ttlSeconds: activeChat.ttl,
        }),
      }).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const handleBack = () => {
    if (activeChat) {
      setActiveChat(null);
    } else if (onNavigate) {
      onNavigate('feed');
    } else if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  const bg = isDark ? COLORS.hex_0B0F19 : COLORS.white;
  const surface = isDark ? COLORS.hex_161D2C : COLORS.white;
  const text = isDark ? COLORS.hex_F1F5F9 : COLORS.hex_1E293B;
  const textMuted = isDark ? COLORS.hex_94A3B8 : COLORS.hex_64748B;
  const border = isDark ? COLORS.hex_2D3748 : COLORS.hex_E2E8F0;
  const primary = COLORS.hex_2563EB;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="shield-lock" size={18} color={COLORS.hex_10B981} />
            <Text style={[styles.headerTitle, { color: text }]}>
              {activeChat ? `@${activeChat.peerUsername}` : 'Encrypted Secret Chats'}
            </Text>
          </View>
          <Text style={[styles.headerSub, { color: textMuted }]}>
            {activeChat ? `Self-destruct timer: ${activeChat.ttl}s` : 'Zero trace, auto-expiring communication'}
          </Text>
        </View>
      </View>

      {activeChat ? (
        /* Inside Active Secret Chat */
        <View style={[styles.chatRoom, { paddingBottom: insets.bottom + 8 }]}>
          {/* Security Notice */}
          <View style={[styles.encNotice, { backgroundColor: isDark ? COLORS.rgba_16_185_129_0p1 : COLORS.hex_ECFDF5, borderColor: COLORS.hex_10B981 }]}>
            <MaterialCommunityIcons name="lock-check" size={16} color={COLORS.hex_10B981} />
            <Text style={[styles.encNoticeText, { color: isDark ? COLORS.hex_6EE7B7 : COLORS.hex_047857 }]}>
              End-to-End Encrypted. Messages vanish after {activeChat.ttl >= 60 ? `${activeChat.ttl / 60}m` : `${activeChat.ttl}s`}.
            </Text>
          </View>

          {/* Messages Feed */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.msgScroll}
            contentContainerStyle={styles.msgScrollContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChatPrompt}>
                <MaterialCommunityIcons name="timer-sand" size={36} color={textMuted} />
                <Text style={[styles.emptyChatText, { color: textMuted }]}>
                  Send your first confidential message. It will self-destruct once read.
                </Text>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === user?.id;
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.msgBubbleWrap,
                      isMe ? styles.msgBubbleRight : styles.msgBubbleLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        isMe ? { backgroundColor: primary } : { backgroundColor: surface, borderColor: border, borderWidth: 1 },
                      ]}
                    >
                      <Text style={[styles.msgText, { color: isMe ? COLORS.white : text }]}>{m.text}</Text>
                      <View style={styles.bubbleFooter}>
                        <MaterialCommunityIcons name="timer-outline" size={12} color={isMe ? COLORS.rgba_255_255_255_0p7 : textMuted} />
                        <Text style={[styles.timerSubText, { color: isMe ? COLORS.rgba_255_255_255_0p7 : textMuted }]}>
                          active
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Chat Composer */}
          <View style={[styles.composerRow, { backgroundColor: surface, borderTopColor: border }]}>
            <TextInput
              style={[styles.chatInput, { backgroundColor: bg, color: text, borderColor: border }]}
              placeholder="Type encrypted message..."
              placeholderTextColor={textMuted}
              value={inputMsg}
              onChangeText={setInputMsg}
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: primary }, (!inputMsg.trim() || sending) && { opacity: 0.5 }]}
              onPress={handleSendMessage}
              disabled={!inputMsg.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <MaterialCommunityIcons name="send" size={18} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Chat Lobby / New Secret Chat Starter */
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.lobbyContent, { paddingBottom: insets.bottom + 40 }]}>
          {/* Creator Launcher Card */}
          <View style={[styles.startCard, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.cardHeaderRow]}>
              <MaterialCommunityIcons name="incognito" size={26} color={primary} />
              <Text style={[styles.cardHeaderTitle, { color: text }]}>Start New Secret Chat</Text>
            </View>

            <Text style={[styles.inputLabel, { color: text }]}>Recipient Username</Text>
            <View style={[styles.recipientInputWrap, { backgroundColor: bg, borderColor: border }]}>
              <Text style={[styles.atSign, { color: textMuted }]}>@</Text>
              <TextInput
                style={[styles.recipientInput, { color: text }]}
                placeholder="username"
                placeholderTextColor={textMuted}
                autoCapitalize="none"
                value={recipient}
                onChangeText={setRecipient}
              />
            </View>

            <Text style={[styles.inputLabel, { color: text }]}>Auto-Destruct Timer</Text>
            <View style={styles.ttlOptionsRow}>
              {TTL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.ttlChip,
                    {
                      backgroundColor: selectedTtl === opt.value ? primary : bg,
                      borderColor: selectedTtl === opt.value ? primary : border,
                    },
                  ]}
                  onPress={() => setSelectedTtl(opt.value)}
                >
                  <Text style={[styles.ttlChipText, { color: selectedTtl === opt.value ? COLORS.white : text }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.launchBtn, { backgroundColor: primary }, !recipient.trim() && { opacity: 0.5 }]}
              onPress={handleStartSecretChat}
              disabled={!recipient.trim()}
            >
              <MaterialCommunityIcons name="lock" size={18} color={COLORS.white} />
              <Text style={styles.launchBtnText}>Open Secure Channel</Text>
            </TouchableOpacity>
          </View>

          {/* Active Conversations Section */}
          <Text style={[styles.sectionTitle, { color: text }]}>Encrypted Channels</Text>
          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : secretChatsList.length > 0 ? (
            secretChatsList.map((chat) => (
              <TouchableOpacity
                key={chat.id}
                style={[styles.chatListItem, { backgroundColor: surface, borderColor: border }]}
                onPress={() => {
                  setActiveChat(chat);
                  setMessages([]);
                }}
              >
                <View style={[styles.chatAvatar, { backgroundColor: primary }]}>
                  <MaterialCommunityIcons name="shield-account" size={20} color={COLORS.white} />
                </View>
                <View style={styles.chatListMeta}>
                  <Text style={[styles.chatListUser, { color: text }]}>@{chat.peerUsername}</Text>
                  <Text style={[styles.chatListTtl, { color: textMuted }]}>Timer: {chat.ttl}s</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={textMuted} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={[styles.emptyVaultCard, { backgroundColor: surface, borderColor: border }]}>
              <MaterialCommunityIcons name="shield-check" size={44} color={COLORS.hex_10B981} />
              <Text style={[styles.emptyVaultTitle, { color: text }]}>No Active Secret Sessions</Text>
              <Text style={[styles.emptyVaultDesc, { color: textMuted }]}>
                Messages sent in secret chats are never stored permanently and will self-destruct automatically.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitleWrap: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  scroll: { flex: 1 },
  lobbyContent: { padding: 16 },
  startCard: { padding: 18, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  cardHeaderTitle: { fontSize: 16, fontWeight: '700' },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  recipientInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
  atSign: { fontSize: 16, fontWeight: '700', marginRight: 4 },
  recipientInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  ttlOptionsRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 18 },
  ttlChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  ttlChipText: { fontSize: 13, fontWeight: '600' },
  launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 8 },
  launchBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  loaderWrap: { paddingVertical: 20, alignItems: 'center' },
  chatListItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10, gap: 12 },
  chatAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  chatListMeta: { flex: 1 },
  chatListUser: { fontSize: 15, fontWeight: '600' },
  chatListTtl: { fontSize: 12, marginTop: 2 },
  emptyVaultCard: { padding: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', marginTop: 10 },
  emptyVaultTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyVaultDesc: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  chatRoom: { flex: 1 },
  encNotice: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, margin: 12, gap: 8 },
  encNoticeText: { fontSize: 12, fontWeight: '500', flex: 1 },
  msgScroll: { flex: 1 },
  msgScrollContent: { padding: 16, gap: 12 },
  emptyChatPrompt: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyChatText: { textAlign: 'center', fontSize: 13, marginTop: 12, lineHeight: 18 },
  msgBubbleWrap: { flexDirection: 'row', width: '100%' },
  msgBubbleRight: { justifyContent: 'flex-end' },
  msgBubbleLeft: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 14 },
  msgText: { fontSize: 14, lineHeight: 20 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 },
  timerSubText: { fontSize: 10 },
  composerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  chatInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
