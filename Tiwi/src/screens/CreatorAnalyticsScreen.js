import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function CreatorAnalyticsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    avgEngagement: 0,
    topPosts: [],
  });

  const loadAnalytics = async () => {
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      if (!userId) return;

      const res = await TiwiAPI.getUserPosts(userId);
      const posts = Array.isArray(res) ? res : res?.posts || [];

      let totalLikes = 0;
      let totalComments = 0;
      let totalShares = 0;

      posts.forEach((p) => {
        totalLikes += Number(p.likes_count || p.like_count || p.likes || 0);
        totalComments += Number(p.comments_count || p.comment_count || p.comments || 0);
        totalShares += Number(p.shares_count || p.share_count || p.shares || 0);
      });

      const totalPosts = posts.length;
      const avgEngagement =
        totalPosts > 0
          ? (((totalLikes + totalComments) / totalPosts)).toFixed(1)
          : 0;

      // Sort top posts by likes + comments
      const sorted = [...posts].sort((a, b) => {
        const scoreA = Number(a.likes_count || a.like_count || 0) + Number(a.comments_count || a.comment_count || 0);
        const scoreB = Number(b.likes_count || b.like_count || 0) + Number(b.comments_count || b.comment_count || 0);
        return scoreB - scoreA;
      });

      setStats({
        totalPosts,
        totalLikes,
        totalComments,
        totalShares,
        avgEngagement,
        topPosts: sorted.slice(0, 5),
      });
    } catch {
      // Handle error gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Creator Analytics</Text>
        <TouchableOpacity
          onPress={handleRefresh}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="refresh" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent || COLORS.hex_1D9BF0} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Calculating insights...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent || COLORS.hex_1D9BF0}
            />
          }
        >
          {/* Summary Banner */}
          <View style={[styles.summaryBanner, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <View style={styles.bannerRow}>
              <View>
                <Text style={[styles.bannerTitle, { color: theme.text }]}>Performance Overview</Text>
                <Text style={[styles.bannerSubtitle, { color: theme.textSecondary }]}>
                  Derived from your verified posts on Tiwi
                </Text>
              </View>
              <View style={[styles.badgeLive, { backgroundColor: COLORS.rgba_34_197_94_0p12 }]}>
                <Ionicons name="pulse" size={14} color={COLORS.hex_22C55E} style={{ marginRight: 4 }} />
                <Text style={styles.badgeLiveText}>Live Data</Text>
              </View>
            </View>
          </View>

          {/* Grid Stats */}
          <View style={styles.statsGrid}>
            {/* Posts */}
            <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_29_155_240_0p1 }]}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.hex_1D9BF0} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalPosts}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Posts</Text>
            </View>

            {/* Likes */}
            <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_239_68_68_0p1 }]}>
                <Ionicons name="heart-outline" size={20} color={COLORS.hex_EF4444} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalLikes}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Likes</Text>
            </View>

            {/* Comments */}
            <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_16_185_129_0p1 }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.hex_10B981} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalComments}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Comments</Text>
            </View>

            {/* Avg Engagement */}
            <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={[styles.iconWrap, { backgroundColor: COLORS.rgba_168_85_247_0p1 }]}>
                <Ionicons name="trending-up-outline" size={20} color={COLORS.hex_A855F7} />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{stats.avgEngagement}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Reactions/Post</Text>
            </View>
          </View>

          {/* Top Performing Posts */}
          <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>TOP PERFORMING POSTS</Text>

          {stats.topPosts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Ionicons name="analytics-outline" size={44} color={theme.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Post Analytics Available</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Publish posts or reels to generate engagement insights.
              </Text>
            </View>
          ) : (
            stats.topPosts.map((post, idx) => (
              <TouchableOpacity
                key={post.id || `top-post-${idx}`}
                style={[styles.postItemCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                activeOpacity={0.7}
                onPress={() => onNavigate && onNavigate('post-detail', { post })}
              >
                <View style={styles.postRankCircle}>
                  <Text style={styles.postRankText}>#{idx + 1}</Text>
                </View>

                <View style={styles.postInfoCol}>
                  <Text style={[styles.postContentPreview, { color: theme.text }]} numberOfLines={2}>
                    {post.content || post.text || (post.media_url ? '[Media Post]' : 'Untitled Post')}
                  </Text>
                  <View style={styles.postMetricsRow}>
                    <View style={styles.metricItem}>
                      <Ionicons name="heart" size={13} color={COLORS.hex_EF4444} />
                      <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                        {post.likes_count || post.like_count || 0}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Ionicons name="chatbubble" size={13} color={theme.textSecondary} />
                      <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                        {post.comments_count || post.comment_count || 0}
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                      <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                        {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Recent'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ))
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryBanner: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 12,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeLiveText: {
    color: COLORS.hex_22C55E,
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox: {
    width: '48%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  postItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  postRankCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.rgba_29_155_240_0p1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  postRankText: {
    color: COLORS.hex_1D9BF0,
    fontSize: 12,
    fontWeight: '700',
  },
  postInfoCol: {
    flex: 1,
    paddingRight: 8,
  },
  postContentPreview: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 19,
  },
  postMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  metricText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
});
