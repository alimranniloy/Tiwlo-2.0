import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import PostCard from '../components/PostCard';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function PostDetailScreen({ onNavigate, user: postParam, post: directPost, routeParams }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const initialPost = directPost || postParam?.post || (postParam?.id ? postParam : null) || routeParams?.post || (routeParams?.id ? routeParams : null);
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialPost?.comments || []);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!initialPost);

  useEffect(() => {
    const targetPostId = initialPost?.id || postParam?.id || routeParams?.id;
    if (targetPostId) {
      loadPostDetails(targetPostId);
    } else {
      setLoading(false);
    }
  }, [initialPost?.id, postParam?.id, routeParams?.id]);

  const loadPostDetails = async (postId) => {
    try {
      const feed = await TiwiAPI.getFeed(currentUser?.id);
      if (Array.isArray(feed)) {
        const found = feed.find((p) => p && String(p.id) === String(postId));
        if (found) {
          setPost(found);
          setComments(found.comments || []);
        }
      }
    } catch (err) {
      console.warn('Error loading post details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !post?.id) return;
    setSubmitting(true);
    try {
      const newComment = {
        id: `c_${Date.now()}`,
        author: {
          id: currentUser?.id,
          name: currentUser?.name || 'User',
          avatar: currentUser?.avatar,
          handle: currentUser?.handle || '@user',
        },
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      await TiwiAPI.addComment(post.id, commentText.trim(), currentUser?.id);
    } catch (err) {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Post</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : post ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Post Card */}
          <PostCard
            post={post}
            onProfilePress={(author) => onNavigate && onNavigate('profile', author)}
            onDeletePost={() => onNavigate && onNavigate('back')}
          />

          {/* Comments Section Title */}
          <View style={[styles.commentsHeader, { borderBottomColor: theme.borderLight }]}>
            <Ionicons name="chatbubbles-outline" size={17} color={theme.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.commentsTitle, { color: theme.text }]}>
              Comments ({comments.length})
            </Text>
          </View>

          {/* Comments List */}
          {comments.length === 0 ? (
            <View style={styles.emptyCommentsBox}>
              <Text style={[styles.emptyCommentsText, { color: theme.textMuted }]}>
                No comments yet. Be the first to share your thoughts!
              </Text>
            </View>
          ) : (
            comments.map((c, idx) => (
              <View
                key={c.id || `c_${idx}`}
                style={[styles.commentRow, { borderBottomColor: theme.borderLight }]}
              >
                <Image
                  source={{
                    uri:
                      c.author?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author?.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
                  }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContentCol}>
                  <View style={styles.commentNameRow}>
                    <Text style={[styles.commentAuthorName, { color: theme.text }]}>
                      {c.author?.name || 'User'}
                    </Text>
                    <Text style={[styles.commentTime, { color: theme.textMuted }]}>
                      {c.timeAgo || 'Just now'}
                    </Text>
                  </View>
                  <Text style={[styles.commentText, { color: theme.text }]}>{c.text}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <View style={styles.centerContainer}>
          <Text style={{ color: theme.textMuted }}>Post not found.</Text>
        </View>
      )}

      {/* Inline Reply Input Box */}
      <View
        style={[
          styles.replyInputBox,
          {
            backgroundColor: theme.cardBg,
            borderTopColor: theme.borderLight,
          },
        ]}
      >
        <TextInput
          style={[
            styles.replyInput,
            {
              backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
              color: theme.text,
            },
          ]}
          placeholder="Write a comment..."
          placeholderTextColor={theme.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: !commentText.trim() ? theme.border : theme.primary },
          ]}
          onPress={handleAddComment}
          disabled={!commentText.trim() || submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="arrow-up" size={18} color={COLORS.white} />
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
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentsTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  emptyCommentsBox: {
    paddingVertical: 32,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyCommentsText: {
    fontSize: 13.5,
    textAlign: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  commentContentCol: {
    flex: 1,
  },
  commentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthorName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 11.5,
  },
  commentText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  replyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
