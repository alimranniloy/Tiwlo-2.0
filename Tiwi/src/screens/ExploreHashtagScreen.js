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
import { COLORS } from '../config/colors';

export default function ExploreHashtagScreen({ onNavigate, user: hashtagParam }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const rawTag = typeof hashtagParam === 'string' ? hashtagParam : (hashtagParam?.tag || '#technology');
  const tag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHashtagPosts();
  }, [tag]);

  const loadHashtagPosts = async () => {
    setLoading(true);
    try {
      const res = await TiwiAPI.search(tag.replace('#', ''), currentUser?.id);
      if (res && Array.isArray(res.posts)) {
        setPosts(res.posts);
      }
    } catch (err) {
      console.warn('Error loading hashtag posts:', err);
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
          <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>{tag}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      {/* Banner */}
      <View style={[styles.topicBanner, { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.primaryLight }]}>
        <View style={styles.topicIconCircle}>
          <Ionicons name="pricetag" size={20} color={theme.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.topicBannerTitle, { color: theme.text }]}>{tag}</Text>
          <Text style={[styles.topicBannerSub, { color: theme.textSecondary }]}>
            Explore the latest conversations, photos, and reels tagged with {tag}
          </Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item, idx) => (item?.id ? String(item.id) : `hash_${idx}`)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHashtagPosts(); }} colors={[theme.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetags-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet for {tag}</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Be the first to share an update using this hashtag!
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onProfilePress={(author) => onNavigate && onNavigate('profile', author)}
              onDeletePost={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
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
  topicBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  topicIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  topicBannerSub: {
    fontSize: 12.5,
    marginTop: 2,
    lineHeight: 17,
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
    fontSize: 16,
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
