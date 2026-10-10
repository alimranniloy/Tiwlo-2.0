import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function MemoriesScreen({ navigation, onNavigate, user, isDark }) {
  const insets = useSafeAreaInsets();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharedId, setSharedId] = useState(null);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/api/social/memories?userId=${user?.id || ''}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        setMemories(Array.isArray(data.memories) ? data.memories : []);
      } else {
        // Fallback: fetch user's past posts to find memories from earlier dates
        const fallbackRes = await fetch(`${API_BASE_URL}/api/social/posts?authorId=${user?.id || ''}&limit=10`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const posts = fallbackData.posts || [];
          // Filter posts created more than 7 days ago as flashback memories
          const now = Date.now();
          const pastPosts = posts.filter((p) => {
            const postDate = new Date(p.createdAt || p.created_at).getTime();
            return !isNaN(postDate) && now - postDate > 7 * 86400 * 1000;
          });
          setMemories(pastPosts);
        } else {
          setMemories([]);
        }
      }
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleShareMemory = async (item) => {
    try {
      setSharedId(item.id || item._id);
      await Share.share({
        message: `Throwback Memory from ${new Date(item.createdAt || item.created_at).toLocaleDateString()}:\n\n"${item.content || item.text || ''}"\n\nShared via Tiwlo`,
      });
    } catch {
      // User cancelled
    }
  };

  const handleRepostToFeed = (item) => {
    if (onNavigate) {
      onNavigate('feed', {
        repostMemory: {
          originalContent: item.content || item.text,
          originalDate: item.createdAt || item.created_at,
          mediaUrl: item.mediaUrl || item.media_url,
        },
      });
    }
  };

  const handleBack = () => {
    if (onNavigate) {
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

  const todayFormatted = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: text }]}>Memories</Text>
          <Text style={[styles.headerSub, { color: textMuted }]}>On This Day &bull; {todayFormatted}</Text>
        </View>
        <TouchableOpacity style={styles.refreshIconBtn} onPress={() => { setRefreshing(true); fetchMemories(); }}>
          <MaterialCommunityIcons name="history" size={22} color={primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMemories(); }} tintColor={primary} />}
      >
        {/* Banner Card */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? COLORS.hex_1A2333 : COLORS.hex_EEF2FF, borderColor: isDark ? COLORS.hex_2D3748 : COLORS.hex_C7D2FE }]}>
          <MaterialCommunityIcons name="calendar-heart" size={32} color={primary} />
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroHeading, { color: text }]}>Look back on your moments</Text>
            <Text style={[styles.heroDesc, { color: textMuted }]}>
              Rediscover the thoughts, photos, and milestones you posted on this day in past years.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.loaderText, { color: textMuted }]}>Checking your memory vault...</Text>
          </View>
        ) : memories.length > 0 ? (
          memories.map((item, idx) => {
            const dateObj = new Date(item.createdAt || item.created_at);
            const yearsAgo = new Date().getFullYear() - dateObj.getFullYear();
            const timeAgoText = yearsAgo > 0 ? `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago today` : 'Earlier this month';

            return (
              <View key={item.id || item._id || idx} style={[styles.memoryCard, { backgroundColor: surface, borderColor: border }]}>
                {/* Memory Header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.badgePill, { backgroundColor: isDark ? COLORS.rgba_37_99_235_0p2 : COLORS.hex_EFF6FF }]}>
                    <MaterialCommunityIcons name="clock-time-four-outline" size={14} color={primary} />
                    <Text style={[styles.badgePillText, { color: primary }]}>{timeAgoText}</Text>
                  </View>
                  <Text style={[styles.exactDate, { color: textMuted }]}>
                    {dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                {/* Content */}
                <Text style={[styles.memoryText, { color: text }]}>{item.content || item.text}</Text>

                {/* Media preview if any */}
                {(item.mediaUrl || item.media_url) ? (
                  <Image
                    source={{ uri: item.mediaUrl || item.media_url }}
                    style={styles.mediaImg}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Actions */}
                <View style={[styles.cardActions, { borderTopColor: border }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: isDark ? COLORS.hex_1F293D : COLORS.hex_F1F5F9 }]}
                    onPress={() => handleShareMemory(item)}
                  >
                    <MaterialCommunityIcons name="share-variant-outline" size={16} color={text} />
                    <Text style={[styles.actionBtnText, { color: text }]}>
                      {sharedId === (item.id || item._id) ? 'Shared!' : 'Share External'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtnPrimary, { backgroundColor: primary }]}
                    onPress={() => handleRepostToFeed(item)}
                  >
                    <MaterialCommunityIcons name="repeat" size={16} color={COLORS.white} />
                    <Text style={styles.actionBtnPrimaryText}>Repost to Feed</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: surface, borderColor: border }]}>
            <MaterialCommunityIcons name="calendar-blank" size={52} color={textMuted} />
            <Text style={[styles.emptyTitle, { color: text }]}>No Memories for Today</Text>
            <Text style={[styles.emptyDesc, { color: textMuted }]}>
              You do not have any published posts from this date in previous years. Create a post today and it will become a memory next year!
            </Text>
            <TouchableOpacity
              style={[styles.createPostBtn, { backgroundColor: primary }]}
              onPress={() => onNavigate && onNavigate('feed')}
            >
              <MaterialCommunityIcons name="pencil-plus" size={18} color={COLORS.white} />
              <Text style={styles.createPostBtnText}>Create Today&apos;s Post</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  refreshIconBtn: { padding: 6 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 14,
  },
  heroTextWrap: { flex: 1 },
  heroHeading: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  heroDesc: { fontSize: 12, lineHeight: 17 },
  loaderWrap: { paddingVertical: 40, alignItems: 'center' },
  loaderText: { marginTop: 12, fontSize: 14 },
  memoryCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 5,
  },
  badgePillText: { fontSize: 12, fontWeight: '600' },
  exactDate: { fontSize: 12 },
  memoryText: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  mediaImg: { width: '100%', height: 200, borderRadius: 10, marginBottom: 14 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionBtnPrimaryText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 14 },
  emptyDesc: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  createPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
    gap: 8,
  },
  createPostBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
});
