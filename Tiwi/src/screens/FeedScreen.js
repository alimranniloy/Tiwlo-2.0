import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from '../components/SafeLinearGradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import Header from '../components/Header';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import { PostSkeleton } from '../components/SkeletonLoader';
import CreatePostModal from '../components/CreatePostModal';
import CreateStoryModal from '../components/CreateStoryModal';
import CommentsModal from '../components/CommentsModal';
import StoryViewerModal from '../components/StoryViewerModal';
import SuggestedUsersShelf from '../components/SuggestedUsersShelf';
import { getScreenDataCache } from '../utils/screenDataCache';
import { COLORS } from '../config/colors';

export default function FeedScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const fabBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) + 84;
  const [feedTab, setFeedTab] = useState('for_you'); // 'for_you' | 'following'
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePostId, setActivePostId] = useState(null);

  // Track which post is in view for smooth, single-video autoplay without decoder contention
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const firstPost = viewableItems.find((v) => v.item && v.item.id);
      if (firstPost?.item?.id) {
        setActivePostId(firstPost.item.id);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  // Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createStoryVisible, setCreateStoryVisible] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [activeStory, setActiveStory] = useState(null);
  const [liveAudioSpaces, setLiveAudioSpaces] = useState([]);

  useEffect(() => {
    let isCurrent = true;
    const cacheKey = `feed:${currentUser?.id || 'guest'}:${feedTab}`;
    getScreenDataCache(cacheKey).then((cachedPosts) => {
      if (!isCurrent || !Array.isArray(cachedPosts)) return;
      setPosts(cachedPosts);
      setLoading(false);
    });
    loadFeedData(feedTab, () => isCurrent);
    return () => {
      isCurrent = false;
    };
  }, [currentUser?.id, feedTab]);

  // Instantly reflect updated profile picture across all user's posts in the feed
  useEffect(() => {
    if (currentUser?.avatar) {
      setPosts((prev) =>
        (prev || []).map((p) =>
          p.author?.id === currentUser?.id || p.author?.handle === currentUser?.handle
            ? { ...p, author: { ...p.author, avatar: currentUser.avatar } }
            : p
        )
      );
    }
  }, [currentUser?.avatar]);

  const loadFeedData = async (tabMode = feedTab, isCurrent = () => true) => {
    const feedRequest = TiwiAPI.getFeed(currentUser?.id, tabMode)
      .then((feedData) => {
        if (!isCurrent()) return;
        setPosts(Array.isArray(feedData) ? feedData : []);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        console.warn('Error loading feed:', err);
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    const secondaryRequests = Promise.all([
      TiwiAPI.getStories(currentUser?.id),
      TiwiAPI.getAudioSpaces(),
    ]).then(([storiesData, spacesData]) => {
      if (!isCurrent()) return;
      setStories(Array.isArray(storiesData) ? storiesData : []);
      setLiveAudioSpaces(Array.isArray(spacesData) ? spacesData.filter((space) => space.isLive !== false) : []);
    });

    await Promise.all([feedRequest, secondaryRequests]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFeedData(feedTab);
  };

  const handlePostCreated = (newPost) => {
    if (!newPost) return;
    setPosts((prev) => [newPost, ...prev]);
  };

  const handleCommentAdded = (postId, newCount) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentsCount: newCount.toString() } : p))
    );
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Full-width feed tabs with a minimal active indicator. */}
      <View style={[styles.feedTabsBar, { backgroundColor: theme.cardBg }]}>
        {[
          { id: 'for_you', label: 'For You' },
          { id: 'following', label: 'Following' },
        ].map((tab) => {
          const isSelected = feedTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.feedTabButton}
              onPress={() => setFeedTab(tab.id)}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.feedTabText,
                  {
                    color: isSelected ? theme.text : theme.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
              <View
                style={[
                  styles.feedTabIndicator,
                  { backgroundColor: isSelected ? (theme.primary || COLORS.primary) : 'transparent' },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 2. Active Live Audio Space Round Avatars Carousel (Shows ONLY when spaces are live) */}
      {liveAudioSpaces.length > 0 && (
        <View style={[styles.liveSpacesSection, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveSpacesScroll}>
            {liveAudioSpaces.map((space) => {
              const hostAvatar = space.host?.avatar || space.speakers?.[0]?.avatar;
              const hostName = space.host?.name || space.hostUsername || 'Host';
              const cleanAvatar = hostAvatar && !hostAvatar.includes('unsplash')
                ? hostAvatar
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(hostName)}&background=EF4444&color=fff&size=150&bold=true`;

              return (
                <TouchableOpacity
                  key={space.id}
                  style={styles.spaceAvatarItem}
                  activeOpacity={0.8}
                  onPress={() => onNavigate && onNavigate('audio-spaces', { space })}
                >
                  <View style={styles.spaceAvatarRing}>
                    <Image source={{ uri: cleanAvatar }} style={styles.spaceAvatarImg} />
                    <View style={styles.spaceLiveBadge}>
                      <Ionicons name="mic" size={9} color={COLORS.white} />
                      <Text style={styles.spaceLiveBadgeText}>LIVE</Text>
                    </View>
                  </View>
                  <Text style={[styles.spaceHostName, { color: theme.text }]} numberOfLines={1}>
                    {hostName.split(' ')[0]}
                  </Text>
                  <View style={[styles.spaceListenerChip, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                    <Text style={[styles.spaceListenerText, { color: theme.primary || COLORS.primary }]}>
                      {space.listenersCount || 1} in
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* 3. Stories Bar */}
      <StoriesBar
        stories={stories}
        onAddStory={() => setCreateStoryVisible(true)}
        onStoryPress={(story) => setActiveStory(story)}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <Header onProfilePress={() => onNavigate('profile')} />

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {renderHeader()}
          <PostSkeleton hasMedia={true} />
          <PostSkeleton hasMedia={false} />
          <PostSkeleton hasMedia={true} />
        </ScrollView>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item, index) => (item?.id ? String(item.id) : `feed_post_${index}`)}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={feedTab === 'following' ? 'people-outline' : 'newspaper-outline'}
                size={48}
                color={theme.textSecondary}
                style={{ opacity: 0.5 }}
              />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {feedTab === 'following' ? 'No posts from people you follow' : 'No posts in feed yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {feedTab === 'following'
                  ? 'Follow creators in Explore or switch to "For You" to discover trending posts.'
                  : 'Be the first to share an update, reel, or story on Tiwi!'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                onPress={() => {
                  if (feedTab === 'following') {
                    setFeedTab('for_you');
                  } else {
                    setCreateModalVisible(true);
                  }
                }}
              >
                <Text style={styles.emptyActionText}>
                  {feedTab === 'following' ? 'Switch to For You' : 'Create Post'}
                </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item, index }) => (
            <View>
              <PostCard
                post={item}
                isActive={activePostId ? activePostId === item.id : index === 0}
                onCommentPress={(p) => {
                  setActiveCommentPost(p || item);
                }}
                onPress={(selectedPost) => {
                  if (onNavigate) {
                    const postToOpen = selectedPost || item;
                    const media = Array.isArray(postToOpen.images) && postToOpen.images.length > 0
                      ? postToOpen.images
                      : [postToOpen.image].filter(Boolean);
                    const videoUri = media.find((uri) => (
                      typeof uri === 'string' &&
                      (/\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(uri) || uri.includes('/reels/') || uri.includes('/uploads/videos/'))
                    ));
                    if (videoUri) {
                      onNavigate('reels', { openReel: postToOpen, videoUri });
                    } else {
                      onNavigate('post-detail', { post: postToOpen });
                    }
                  }
                }}
                onProfilePress={(author) => {
                  if (author) {
                    onNavigate('profile', author);
                  }
                }}
                onDeletePost={(deletedId) => {
                  setPosts((prev) => prev.filter((p) => p.id !== deletedId));
                }}
                onHidePost={(hiddenId) => {
                  setPosts((prev) => prev.filter((p) => String(p.id || p._id) !== String(hiddenId)));
                }}
                onEditPost={(postId, newCaption) => {
                  setPosts((prev) =>
                    prev.map((p) => (p.id === postId ? { ...p, caption: newCaption } : p))
                  );
                }}
              />
              {index === 1 && (
                <SuggestedUsersShelf onNavigate={onNavigate} />
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary || COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating Action Button (FAB) for Post Creation */}
      <TouchableOpacity
        style={[styles.googleFab, { bottom: fabBottom }]}
        onPress={() => setCreateModalVisible(true)}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={isDarkMode ? [COLORS.hex_3B82F6, COLORS.hex_1D4ED8] : [COLORS.hex_1A73E8, COLORS.primary]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={30} color={COLORS.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Create Post Modal */}
      <CreatePostModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onPostCreated={handlePostCreated}
        onNavigate={onNavigate}
      />

      {/* Create Story Modal */}
      <CreateStoryModal
        visible={createStoryVisible}
        onClose={() => setCreateStoryVisible(false)}
      />

      {/* Comments Modal (Fallback) */}
      <CommentsModal
        visible={!!activeCommentPost}
        post={activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        onCommentAdded={handleCommentAdded}
      />

      {/* Story Viewer Modal */}
      <StoryViewerModal
        visible={!!activeStory}
        story={activeStory}
        onClose={() => setActiveStory(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlock: {
    marginBottom: 6,
  },
  feedTabsBar: {
    flexDirection: 'row',
    minHeight: 52,
  },
  feedTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
  },
  feedTabText: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
  feedTabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 58,
    height: 4,
    borderRadius: 4,
  },
  liveSpacesSection: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  liveSpacesScroll: {
    paddingHorizontal: 12,
    gap: 14,
    alignItems: 'center',
  },
  spaceAvatarItem: {
    alignItems: 'center',
    width: 64,
  },
  spaceAvatarRing: {
    position: 'relative',
    padding: 2,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.hex_EF4444,
  },
  spaceAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  spaceLiveBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: COLORS.hex_EF4444,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  spaceLiveBadgeText: {
    color: COLORS.white,
    fontSize: 7.5,
    fontWeight: '800',
    marginLeft: 2,
  },
  spaceHostName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  spaceListenerChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginTop: 2,
  },
  spaceListenerText: {
    fontSize: 9,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 80,
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
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  emptyActionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyActionText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  googleFab: {
    position: 'absolute',
    bottom: 20,
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 8,
    zIndex: 99,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
