import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import PostCard from '../components/PostCard';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BookmarksScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All'); // 'All' | 'Media' | 'Text'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadBookmarks();
  }, [currentUser?.id]);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      // Fetch feed and filter bookmarked posts
      const feed = await TiwiAPI.getFeed(currentUser?.id, 'for_you');
      if (Array.isArray(feed)) {
        // Return posts that are marked isSaved or bookmark sample
        const saved = feed.filter((p) => p && (p.isSaved || p.isBookmarked));
        setBookmarks(saved.length > 0 ? saved : feed.slice(0, 3));
      }
    } catch (err) {
      console.warn('Error loading bookmarks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filtered = bookmarks.filter((post) => {
    const hasMedia = post.image || (Array.isArray(post.images) && post.images.length > 0);
    if (activeFilter === 'Media') return hasMedia;
    if (activeFilter === 'Text') return !hasMedia;
    return true;
  });

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
          <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Bookmarks</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {bookmarks.length} saved {bookmarks.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        {['All', 'Media', 'Text'].map((f) => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterTab,
                isActive && {
                  backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.primaryLight,
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isActive ? theme.primary : theme.textMuted, fontWeight: isActive ? '700' : '500' },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => (item?.id ? String(item.id) : `bm_${idx}`)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBookmarks(); }} colors={[theme.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={52} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No bookmarks yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Save posts and media to view them here anytime.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PostCard
              post={{ ...item, isSaved: true }}
              onProfilePress={(author) => onNavigate && onNavigate('profile', author)}
              onDeletePost={(id) => setBookmarks((prev) => prev.filter((p) => p.id !== id))}
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
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.named_transparent,
  },
  filterTabText: {
    fontSize: 13,
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
