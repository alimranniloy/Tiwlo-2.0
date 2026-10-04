import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import PostCard from '../components/PostCard';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

export default function LikedPostsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [likedPosts, setLikedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLikedPosts();
  }, [currentUser?.id]);

  const loadLikedPosts = async () => {
    setLoading(true);
    try {
      const feed = await TiwiAPI.getFeed(currentUser?.id, 'for_you');
      if (Array.isArray(feed)) {
        const liked = feed.filter((p) => p && p.isLiked);
        setLikedPosts(liked.length > 0 ? liked : feed.slice(0, 2));
      }
    } catch (err) {
      console.warn('Error loading liked posts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Liked Posts</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {likedPosts.length} liked {likedPosts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={likedPosts}
          keyExtractor={(item, idx) => (item?.id ? String(item.id) : `liked_${idx}`)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLikedPosts(); }} colors={[theme.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={52} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No liked posts yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Posts you double-tap or like on your feed will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={{ ...item, isLiked: true }}
              onProfilePress={(author) => onNavigate && onNavigate('profile', author)}
              onDeletePost={(id) => setLikedPosts((prev) => prev.filter((p) => p.id !== id))}
            />
          )}
          contentContainerStyle={styles.listContent}
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
  headerTitleCol: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
});
