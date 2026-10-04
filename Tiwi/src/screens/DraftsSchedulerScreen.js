import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function DraftsSchedulerScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('scheduled'); // 'scheduled' | 'drafts' | 'new'

  // Composer Form
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('Tomorrow, 10:00 AM');
  const [targetAudience, setTargetAudience] = useState('Public');
  const [submitting, setSubmitting] = useState(false);

  // Real Database Records
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const [schRes, drRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/social/drafts/scheduled?userId=${userId || ''}`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
        fetch(`${API_BASE_URL}/api/social/drafts?userId=${userId || ''}`, {
          headers: { Accept: 'application/json' },
        }).catch(() => null),
      ]);

      if (schRes && schRes.ok) {
        const schData = await schRes.json();
        setScheduledPosts(Array.isArray(schData.scheduled) ? schData.scheduled : []);
      } else {
        setScheduledPosts([]);
      }

      if (drRes && drRes.ok) {
        const drData = await drRes.json();
        setDrafts(Array.isArray(drData.drafts) ? drData.drafts : []);
      } else {
        setDrafts([]);
      }
    } catch {
      setScheduledPosts([]);
      setDrafts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSchedulePost = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Post', 'Please write some content for your post.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/drafts/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          content: content.trim(),
          publishAt: scheduledDate,
          audience: targetAudience,
          mediaType: 'text',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newPost = data.scheduledPost || {
          id: `sch-${Date.now()}`,
          content: content.trim(),
          publishAt: scheduledDate,
          countdown: 'Scheduled',
          mediaType: 'text',
          audience: targetAudience,
        };
        setScheduledPosts([newPost, ...scheduledPosts]);
        setContent('');
        setActiveTab('scheduled');
        Alert.alert('Post Scheduled', `Your post is queued to broadcast at ${scheduledDate}.`);
      } else {
        Alert.alert('Error', 'Failed to schedule post on the server.');
      }
    } catch {
      Alert.alert('Network Error', 'Unable to reach the server. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          content: content.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newDraft = data.draft || {
          id: `dr-${Date.now()}`,
          content: content.trim(),
          updatedAt: 'Just now',
        };
        setDrafts([newDraft, ...drafts]);
        setContent('');
        setActiveTab('drafts');
        Alert.alert('Saved to Drafts', 'Your draft has been saved to your account.');
      } else {
        Alert.alert('Error', 'Failed to save draft to server.');
      }
    } catch {
      Alert.alert('Network Error', 'Unable to reach the server.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteScheduled = (id) => {
    Alert.alert('Cancel Scheduled Post?', 'This post will not be published.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setScheduledPosts(scheduledPosts.filter((p) => p.id !== id));
          try {
            await fetch(`${API_BASE_URL}/api/social/drafts/scheduled/${id}`, { method: 'DELETE' });
          } catch {
            // silent catch
          }
        },
      },
    ]);
  };

  const handleDeleteDraft = async (id) => {
    setDrafts(drafts.filter((d) => d.id !== id));
    try {
      await fetch(`${API_BASE_URL}/api/social/drafts/${id}`, { method: 'DELETE' });
    } catch {
      // silent catch
    }
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Drafts & Scheduled</Text>
        <TouchableOpacity
          onPress={() => setActiveTab(activeTab === 'new' ? 'scheduled' : 'new')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={activeTab === 'new' ? 'close' : 'create-outline'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'scheduled' && styles.activeTabBtn]}
          onPress={() => setActiveTab('scheduled')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'scheduled' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'scheduled' && { fontWeight: '700' },
            ]}
          >
            Scheduled ({scheduledPosts.length})
          </Text>
          {activeTab === 'scheduled' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'drafts' && styles.activeTabBtn]}
          onPress={() => setActiveTab('drafts')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'drafts' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'drafts' && { fontWeight: '700' },
            ]}
          >
            Drafts ({drafts.length})
          </Text>
          {activeTab === 'drafts' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'new' && styles.activeTabBtn]}
          onPress={() => setActiveTab('new')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'new' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'new' && { fontWeight: '700' },
            ]}
          >
            Compose
          </Text>
          {activeTab === 'new' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchItems();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {activeTab === 'new' ? (
          /* COMPOSE NEW SCHEDULED OR DRAFT POST */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Schedule Post or Save Draft</Text>
            <Text style={[styles.formSub, { color: theme.textSecondary }]}>
              Plan your creator content ahead of time with zero stress
            </Text>

            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="What do you want to share with your audience?"
              placeholderTextColor={theme.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Target Publish Time</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Tomorrow, 10:00 AM or 2026-10-10 14:00"
              placeholderTextColor={theme.textSecondary}
              value={scheduledDate}
              onChangeText={setScheduledDate}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Audience</Text>
            <View style={styles.audienceRow}>
              {['Public', 'Followers Only', 'Subscribers'].map((aud) => (
                <TouchableOpacity
                  key={aud}
                  style={[
                    styles.audienceChip,
                    targetAudience === aud && { backgroundColor: theme.primary || COLORS.primary, borderColor: theme.primary || COLORS.primary },
                    targetAudience !== aud && { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, borderColor: theme.borderLight },
                  ]}
                  onPress={() => setTargetAudience(aud)}
                >
                  <Text
                    style={[
                      styles.audienceText,
                      { color: targetAudience === aud ? COLORS.white : theme.textSecondary },
                    ]}
                  >
                    {aud}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.draftBtn, { borderColor: theme.borderLight }]}
                onPress={handleSaveDraft}
                disabled={submitting}
              >
                <Ionicons name="document-text-outline" size={16} color={theme.text} style={{ marginRight: 6 }} />
                <Text style={[styles.draftBtnText, { color: theme.text }]}>Save Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.scheduleBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                onPress={handleSchedulePost}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="time" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={styles.scheduleBtnText}>Schedule Post</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading posts...</Text>
          </View>
        ) : activeTab === 'scheduled' ? (
          /* SCHEDULED POSTS LIST */
          scheduledPosts.length === 0 ? (
            <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Ionicons name="time-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Scheduled Posts</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Queue posts to publish automatically when your followers are most active.
              </Text>
              <TouchableOpacity
                style={[styles.createFirstBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                onPress={() => setActiveTab('new')}
              >
                <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.createFirstBtnText}>Schedule a Post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            scheduledPosts.map((post) => (
              <View
                key={post.id}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16, marginBottom: 14 }]}
              >
                <View style={styles.postMetaRow}>
                  <View style={styles.countdownBadge}>
                    <Ionicons name="alarm-outline" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.countdownText}>{post.publishAt || 'Scheduled'}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteScheduled(post.id)}
                    style={styles.deleteIconBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={COLORS.hex_EF4444} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.postContent, { color: theme.text }]}>{post.content}</Text>

                <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

                <View style={styles.postFooterRow}>
                  <View style={styles.badge}>
                    <Ionicons name="globe-outline" size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{post.audience || 'Public'}</Text>
                  </View>
                </View>
              </View>
            ))
          )
        ) : (
          /* DRAFTS LIST */
          drafts.length === 0 ? (
            <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Saved Drafts</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Start writing a post and save it to resume editing anytime.
              </Text>
              <TouchableOpacity
                style={[styles.createFirstBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                onPress={() => setActiveTab('new')}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.createFirstBtnText}>Create Draft</Text>
              </TouchableOpacity>
            </View>
          ) : (
            drafts.map((draft) => (
              <View
                key={draft.id}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16, marginBottom: 14 }]}
              >
                <View style={styles.postMetaRow}>
                  <Text style={[styles.draftTime, { color: theme.textSecondary }]}>{draft.updatedAt || 'Saved'}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteDraft(draft.id)}
                    style={styles.deleteIconBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={COLORS.hex_EF4444} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.postContent, { color: theme.text }]}>{draft.content}</Text>

                <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

                <TouchableOpacity
                  style={[styles.resumeBtn, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.inputBackground }]}
                  onPress={() => {
                    setContent(draft.content);
                    setActiveTab('new');
                  }}
                >
                  <Ionicons name="pencil" size={14} color={theme.primary || COLORS.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.resumeBtnText, { color: theme.primary || COLORS.primary }]}>Resume Editing</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        )}
      </ScrollView>
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
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabBtn: {},
  tabText: {
    fontSize: 13,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  formSub: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 110,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  audienceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 20,
  },
  audienceChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  audienceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  draftBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleBtn: {
    flex: 1.3,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
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
    marginBottom: 20,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createFirstBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_11_87_208_0p08,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteIconBtn: {
    padding: 4,
  },
  postContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  postFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
  },
  draftTime: {
    fontSize: 12,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  resumeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
