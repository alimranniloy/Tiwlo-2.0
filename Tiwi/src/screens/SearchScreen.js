import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import PostCard from '../components/PostCard';
import { PostSkeleton, UserRowSkeleton } from '../components/SkeletonLoader';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function SearchScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser, isUserFollowed, toggleFollowUser } = useAuth();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All'); // 'All' | 'People' | 'Posts' | 'Trending'
  const [results, setResults] = useState({ users: [], posts: [] });
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

  useEffect(() => {
    loadSuggestedUsers();
    loadTrendingTopics();
  }, []);

  const loadTrendingTopics = async () => {
    try {
      setLoadingTrends(true);
      const data = await TiwiAPI.getTrending();
      if (Array.isArray(data)) {
        setTrendingTopics(data);
      }
    } catch (err) {
      console.warn('Error loading real trending topics:', err);
    } finally {
      setLoadingTrends(false);
    }
  };

  const loadSuggestedUsers = async () => {
    try {
      const res = await TiwiAPI.search('', currentUser?.id);
      if (res && res.users) {
        setSuggestedUsers(res.users.filter((u) => u.id !== currentUser?.id).slice(0, 6));
      }
    } catch (err) {
      console.warn('Error loading suggested users:', err);
    }
  };

  const handleSearch = async (text) => {
    setQuery(text);
    if (!text.trim()) {
      setResults({ users: [], posts: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await TiwiAPI.search(text.trim(), currentUser?.id);
      setResults({
        users: res?.users || [],
        posts: res?.posts || [],
      });
    } catch (err) {
      console.warn('Search API error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleToggleFollow = async (targetUser) => {
    try {
      await toggleFollowUser(targetUser);
    } catch (err) {
      console.warn('Toggle follow error:', err);
    }
  };

  const filteredPosts = results.posts || [];
  const filteredUsers = results.users || [];
  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Search Bar Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity onPress={() => onNavigate('back')} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>

        <View
          style={[
            styles.searchBarBox,
            {
              backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground,
            },
          ]}
        >
          <Ionicons name="search" size={19} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search Tiwi, people, or topics..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {!!query ? (
            <TouchableOpacity onPress={() => handleSearch('')} style={styles.clearBtn} activeOpacity={0.6}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="mic-outline" size={18} color={theme.textSecondary} />
          )}
        </View>
      </View>

      {/* 2. Category Filter Chips */}
      <View style={[styles.filterBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        {['All', 'People', 'Posts', 'Trending'].map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive
                    ? isDarkMode
                      ? COLORS.hex_004A77
                      : COLORS.hex_C2E7FF
                    : isDarkMode
                    ? COLORS.hex_282A2C
                    : COLORS.hex_E9EEF6,
                },
              ]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isActive
                      ? isDarkMode
                        ? COLORS.hex_C2E7FF
                        : COLORS.hex_001D35
                      : theme.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Main Search Body */}
      {searching ? (
        <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
          <PostSkeleton hasMedia={false} />
        </ScrollView>
      ) : query.trim() ? (
        /* SEARCH RESULTS VIEW */
        <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
          {/* People Section (if All or People) */}
          {(activeCategory === 'All' || activeCategory === 'People') && filteredUsers.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>People</Text>
              {filteredUsers.map((u) => {
                const userFollowed = isUserFollowed(u.id, u.handle);
                const isFollowing = userFollowed !== undefined ? userFollowed : !!(u.isFollowing || u.isFollowed);
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.userCard,
                      {
                        backgroundColor: theme.cardBg,
                        borderBottomColor: theme.borderLight,
                      },
                    ]}
                    onPress={() => onNavigate('profile', u)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{
                        uri:
                          u.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
                      }}
                      style={styles.userAvatar}
                    />
                    <View style={styles.userInfoBlock}>
                      <View style={styles.userNameRow}>
                        <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                          {u.name}
                        </Text>
                        {u.isVerified && (
                          <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} style={{ marginLeft: 3 }} />
                        )}
                      </View>
                      <Text style={[styles.userHandle, { color: theme.textMuted }]}>
                        {u.handle || '@user'}
                      </Text>
                      {!!u.bio && (
                        <Text style={[styles.userBio, { color: theme.textSecondary }]} numberOfLines={1}>
                          {u.bio}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        isFollowing
                          ? { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }
                          : { backgroundColor: theme.primary },
                      ]}
                      onPress={() => handleToggleFollow(u)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.followBtnText,
                          { color: isFollowing ? (isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text) : (isDarkMode ? COLORS.hex_040E28 : COLORS.white) },
                        ]}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Posts Section (if All or Posts) */}
          {(activeCategory === 'All' || activeCategory === 'Posts') && (
            <View style={styles.resultSection}>
              {filteredPosts.length > 0 ? (
                <>
                  <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Posts</Text>
                  {filteredPosts.map((p) => (
                    <PostCard
                      key={p.id}
                      post={p}
                      onCommentPress={(postItem) => onNavigate && onNavigate('post-detail', { post: postItem || p })}
                      onProfilePress={(author) => onNavigate('profile', author)}
                    />
                  ))}
                </>
              ) : (
                activeCategory === 'Posts' && (
                  <View style={styles.emptyResults}>
                    <Ionicons name="document-text-outline" size={40} color={theme.textMuted} />
                    <Text style={[styles.emptyResultsText, { color: theme.textSecondary }]}>
                      No posts found matching "{query}"
                    </Text>
                  </View>
                )
              )}
            </View>
          )}

          {/* If no results at all */}
          {filteredUsers.length === 0 && filteredPosts.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No results found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Check your spelling or try different keywords
              </Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* DEFAULT VIEW: TRENDS & SUGGESTIONS */
        <ScrollView contentContainerStyle={styles.trendingContent} showsVerticalScrollIndicator={false}>
          {/* People you may know */}
          {suggestedUsers.length > 0 && (
            <View style={styles.suggestedSection}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                People you may know
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedScroll}>
                {suggestedUsers.map((u) => {
                  const userFollowed = isUserFollowed(u.id, u.handle);
                  const isFollowing = userFollowed !== undefined ? userFollowed : !!(u.isFollowing || u.isFollowed);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.suggestedCard, { backgroundColor: theme.cardBg }]}
                      onPress={() => onNavigate('profile', u)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{
                          uri:
                            u.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
                        }}
                        style={styles.suggestedAvatar}
                      />
                      <Text style={[styles.suggestedName, { color: theme.text }]} numberOfLines={1}>
                        {u.name}
                      </Text>
                      <Text style={[styles.suggestedHandle, { color: theme.textMuted }]} numberOfLines={1}>
                        {u.handle || '@user'}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.suggestedFollowBtn,
                          isFollowing
                            ? { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }
                            : { backgroundColor: theme.primary },
                        ]}
                        onPress={() => handleToggleFollow(u)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.suggestedFollowText,
                            { color: isFollowing ? (isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text) : (isDarkMode ? COLORS.hex_040E28 : COLORS.white) },
                          ]}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Trending Topics List */}
          <View style={styles.trendsSection}>
            <View style={styles.trendsHeader}>
              <Ionicons name="trending-up" size={18} color={theme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.trendsTitle, { color: theme.text }]}>Trending on Tiwi</Text>
            </View>

            {loadingTrends ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : trendingTopics.length > 0 ? (
              trendingTopics.map((topic, idx) => (
                <TouchableOpacity
                  key={topic.tag || String(idx)}
                  style={[
                    styles.trendCard,
                    {
                      backgroundColor: theme.cardBg,
                      borderBottomColor: theme.borderLight,
                    },
                  ]}
                  onPress={() => {
                    if (onNavigate) {
                      onNavigate('hashtag-explore', { tag: topic.tag });
                    } else {
                      handleSearch(topic.tag);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.trendRankCol}>
                    <Text style={[styles.trendRank, { color: theme.textMuted }]}>{topic.rank || idx + 1}</Text>
                  </View>
                  <View style={styles.trendInfoCol}>
                    <Text style={[styles.trendCategory, { color: theme.textMuted }]}>{topic.category || 'Trending'}</Text>
                    <Text style={[styles.trendTag, { color: theme.text }]}>{topic.tag}</Text>
                    <Text style={[styles.trendCount, { color: theme.textSecondary }]}>{topic.count}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ paddingVertical: 20, paddingHorizontal: 12, alignItems: 'center' }}>
                <Ionicons name="sparkles-outline" size={28} color={theme.primary} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, textAlign: 'center', marginBottom: 4 }}>
                  Discover Topics & Conversations
                </Text>
                <Text style={{ fontSize: 12.5, color: theme.textMuted, textAlign: 'center', lineHeight: 18 }}>
                  Search for your friends, creators, and hashtags above to explore discussions across Tiwi.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
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
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 24,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  searchingText: {
    fontSize: 14,
  },
  resultsContent: {
    paddingVertical: 12,
    paddingBottom: 80,
  },
  resultSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  userInfoBlock: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  userBio: {
    fontSize: 12,
    marginTop: 3,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyResults: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyResultsText: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
  },
  trendingContent: {
    paddingVertical: 14,
    paddingBottom: 80,
  },
  suggestedSection: {
    marginBottom: 20,
  },
  suggestedScroll: {
    paddingHorizontal: 12,
    gap: 10,
  },
  suggestedCard: {
    width: 140,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  suggestedAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.hex_E2E8F0,
    marginBottom: 8,
  },
  suggestedName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  suggestedHandle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 10,
  },
  suggestedFollowBtn: {
    width: '100%',
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
  },
  suggestedFollowText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendsSection: {
    width: '100%',
  },
  trendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  trendsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trendRankCol: {
    width: 24,
  },
  trendRank: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendInfoCol: {
    flex: 1,
  },
  trendCategory: {
    fontSize: 11,
    marginBottom: 2,
  },
  trendTag: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendCount: {
    fontSize: 12,
    marginTop: 2,
  },
});
