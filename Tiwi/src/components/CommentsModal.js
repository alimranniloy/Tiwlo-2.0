import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import SharedDrawer from './SharedDrawer';
import { COLORS } from '../config/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_AVATAR = require('../../assets/tiwi.png');

export default function CommentsModal({ visible, post, onClose, onCommentAdded }) {
  const { theme, currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && post) {
      setComments(post.comments || []);
    }
  }, [visible, post]);

  const handleSendComment = async () => {
    if (!text.trim() || submitting) return;
    const commentText = text.trim();
    setText('');
    setSubmitting(true);

    const tempComment = {
      id: `temp_${Date.now()}`,
      author: currentUser?.name || 'Al Imran',
      avatar: currentUser?.avatar,
      isVerified: currentUser?.isVerified,
      text: commentText,
      timeAgo: 'Just now',
    };

    setComments((prev) => [...prev, tempComment]);

    try {
      await TiwiAPI.addComment(post.id, commentText, currentUser?.id);
      if (onCommentAdded) {
        onCommentAdded(post.id, comments.length + 1);
      }
    } catch (err) {
      console.warn('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!post) return null;

  return (
    <SharedDrawer
      visible={visible}
      onClose={onClose}
      title="Comments"
      showCloseButton={true}
      showHandle={true}
      scrollable={false}
      maxHeight={SCREEN_HEIGHT * 0.75}
    >
      {/* Comments List */}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="always"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No comments yet. Be the first to share your thoughts!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Image
              source={item.avatar && !item.avatar.includes('unsplash.com') ? { uri: item.avatar } : DEFAULT_AVATAR}
              style={styles.commentAvatar}
            />
            <View style={[styles.commentBubble, { backgroundColor: theme.inputBg }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.authorName, { color: theme.text }]}>{item.author}</Text>
                {item.isVerified && (
                  <Ionicons name="checkmark-circle" size={13} color={COLORS.hex_2563EB} />
                )}
                <Text style={[styles.timeAgo, { color: theme.textMuted }]}>
                  • {item.timeAgo || 'Just now'}
                </Text>
              </View>
              <Text style={[styles.commentText, { color: theme.text }]}>{item.text}</Text>
            </View>
          </View>
        )}
      />

      {/* Add Comment Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: theme.cardBg, borderTopColor: theme.borderLight }]}>
        <Image
          source={{
            uri:
              currentUser?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
          }}
          style={styles.myAvatar}
        />
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
          placeholder="Write a comment..."
          placeholderTextColor={theme.textMuted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSendComment}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? theme.primary : theme.inputBg }]}
          onPress={handleSendComment}
          disabled={!text.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={16} color={text.trim() ? COLORS.white : theme.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    </SharedDrawer>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.rgba_0_0_0_0p5,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    height: '65%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetHeader: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.hex_CBD5E1,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 13.5,
    textAlign: 'center',
    maxWidth: 240,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginTop: 2,
  },
  commentBubble: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  authorName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 11,
  },
  commentText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  myAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
