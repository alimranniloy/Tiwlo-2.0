import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, TeamWallPost } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatRelativeTime, formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  MagicAvatar,
  MagicSpinner,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface OpsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onOpenTicket: (ticketId: string) => void;
  onOpenChat: (chatId: string) => void;
  onNavigateSubScreen: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
  routeParams?: Record<string, string | undefined>;
  onPulseSync?: () => void;
}

const QUICK_REACTIONS = ['👍', '🔥', '✅', '👀'] as const;

const CATEGORY_META: Record<
  TeamWallPost['category'],
  { label: string; tone: SemanticTone }
> = {
  announcement: { label: 'Announcement', tone: 'accent' },
  urgent: { label: 'Urgent', tone: 'danger' },
  tip: { label: 'Pro Tip', tone: 'warning' },
  shoutout: { label: 'Shoutout', tone: 'success' },
};

function extractTicketTokens(body: string, explicitRefs: string[] = []): string[] {
  const found = new Set<string>();
  for (const ref of explicitRefs) {
    const clean = ref.trim();
    if (clean) found.add(clean.startsWith('#') ? clean : `#${clean}`);
  }
  const matches = body.match(/#(?:TKT|TWTK)-[A-Za-z0-9-]+|#[A-Za-z0-9]{4,}/gi) || [];
  for (const m of matches) {
    found.add(m);
  }
  return Array.from(found);
}

export const InternalTeamWallScreen: React.FC<OpsScreenProps> = ({
  user,
  staffProfile,
  onBack,
  onOpenTicket,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<TeamWallPost[]>([]);
  const [filterCategory, setFilterCategory] = useState<'all' | TeamWallPost['category']>('all');

  const [composerOpen, setComposerOpen] = useState(false);
  const [category, setCategory] = useState<TeamWallPost['category']>('announcement');
  const [body, setBody] = useState('');
  const [pinOnCreate, setPinOnCreate] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busyPostId, setBusyPostId] = useState<string | null>(null);

  const isAdmin =
    staffProfile.isSuperAdmin ||
    staffProfile.roleKey === 'admin' ||
    (staffProfile.permissions || []).includes('manage_staff_roles');

  const loadPosts = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listTeamWallPosts();
        setPosts(res.posts || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load team wall.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadPosts(false);
  }, [loadPosts]);

  const sortedPosts = useMemo(() => {
    const filtered =
      filterCategory === 'all' ? posts : posts.filter((p) => p.category === filterCategory);
    return [...filtered].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [filterCategory, posts]);

  const handlePublishPost = async () => {
    if (!body.trim()) {
      toast.show({ variant: 'danger', label: 'Write a message before posting to the wall.' });
      return;
    }
    setPosting(true);
    try {
      const res = await opsHubService.createTeamWallPost({
        category,
        body: body.trim(),
        pinned: pinOnCreate,
      });
      if (res.post) {
        setPosts((prev) => [res.post, ...prev]);
      } else {
        loadPosts(true);
      }
      setBody('');
      setPinOnCreate(false);
      setComposerOpen(false);
      toast.show({ variant: 'success', label: 'Posted to Internal Team Wall.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to create post.',
      });
    } finally {
      setPosting(false);
    }
  };

  const handleTogglePin = async (postId: string) => {
    setBusyPostId(postId);
    try {
      const res = await opsHubService.togglePinTeamWallPost(postId);
      if (res.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      } else {
        loadPosts(true);
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update pin state.',
      });
    } finally {
      setBusyPostId(null);
    }
  };

  const handleReact = async (postId: string, emoji: string) => {
    try {
      const res = await opsHubService.reactTeamWallPost(postId, emoji);
      if (res.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
      } else {
        loadPosts(true);
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update reaction.',
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    setBusyPostId(postId);
    try {
      await opsHubService.deleteTeamWallPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.show({ variant: 'accent', label: 'Post removed from Team Wall.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not delete post.',
      });
    } finally {
      setBusyPostId(null);
    }
  };

  const renderRichBody = (text: string) => {
    const parts = text.split(/(#(?:TKT|TWTK)-[A-Za-z0-9-]+)/gi);
    return (
      <Text style={[styles.postBody, { color: tokens.text }]}>
        {parts.map((part, idx) => {
          if (/^#(?:TKT|TWTK)-[A-Za-z0-9-]+$/i.test(part)) {
            return (
              <Text
                key={`${part}-${idx}`}
                onPress={() => onOpenTicket(part.replace(/^#/, ''))}
                style={[styles.inlineTicketLink, { color: tokens.accent }]}
              >
                {part}
              </Text>
            );
          }
          return <Text key={idx}>{part}</Text>;
        })}
      </Text>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: tokens.bg }]}
    >
      {/* Borderless Top Header */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton
          name="arrow-left"
          size={20}
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: tokens.text }]}>
            Internal Team Wall
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Announcements, urgent ops alerts, tips & shoutouts
          </Text>
        </View>
        <ShimmerButton
          label={composerOpen ? 'Close' : '+ New Post'}
          size="xs"
          variant={composerOpen ? 'subtle' : 'accent'}
          onPress={() => setComposerOpen((prev) => !prev)}
        />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {(
            [
              { key: 'all', label: `All (${posts.length})` },
              { key: 'announcement', label: 'Announcement' },
              { key: 'urgent', label: 'Urgent' },
              { key: 'tip', label: 'Pro Tip' },
              { key: 'shoutout', label: 'Shoutout' },
            ] as const
          ).map((item) => {
            const active = filterCategory === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.7}
                onPress={() => setFilterCategory(item.key)}
                style={[
                  styles.tabBtn,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? tokens.text : tokens.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={tokens.accent}
            onRefresh={() => {
              setRefreshing(true);
              loadPosts(true);
            }}
          />
        }
      >
        {/* Inline Category Composer */}
        {composerOpen ? (
          <BlurFade delay={0} offset={5}>
            <View
              style={[
                styles.composerBox,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipRow}
              >
                {(['announcement', 'urgent', 'tip', 'shoutout'] as const).map((cat) => {
                  const active = category === cat;
                  const meta = CATEGORY_META[cat];
                  return (
                    <TouchableOpacity
                      key={cat}
                      activeOpacity={0.7}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: active ? tokens.accentSoft : tokens.bg,
                          borderColor: active ? tokens.accent : tokens.hairlineStrong,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '600',
                          color: active ? tokens.accent : tokens.textSecondary,
                        }}
                      >
                        {meta.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <FlatInput
                value={body}
                onChangeText={setBody}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                placeholder="Share an update, pro tip, or mention #TKT-1024 to link a ticket..."
              />

              <View style={styles.composerFooter}>
                <View style={styles.pinToggleRow}>
                  <MagicSwitch value={pinOnCreate} onValueChange={setPinOnCreate} />
                  <Text style={[styles.pinToggleLabel, { color: tokens.textSecondary }]}>
                    Pin to top
                  </Text>
                </View>
                <ShimmerButton
                  label="Post Update"
                  size="sm"
                  variant="accent"
                  loading={posting}
                  onPress={handlePublishPost}
                />
              </View>
            </View>
          </BlurFade>
        ) : null}

        {/* Wall Feed */}
        {loading && posts.length === 0 ? (
          <MagicSpinner label="Loading team wall..." />
        ) : sortedPosts.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No team wall posts in this channel yet.
          </Text>
        ) : (
          sortedPosts.map((post, idx) => {
            const catMeta = CATEGORY_META[post.category] || CATEGORY_META.announcement;
            const canDelete = String(post.authorId) === String(user.id) || isAdmin;
            const ticketRefs = extractTicketTokens(post.body, post.ticketRefs || []);

            return (
              <AnimatedListItem key={post.id} index={idx}>
                <View style={[styles.postRow, { borderBottomColor: tokens.hairlineStrong }]}>
                  <View style={styles.postHeader}>
                    <MagicAvatar
                      name={post.authorName || 'Staff'}
                      uri={resolveWebsiteUrl(post.authorAvatar)}
                      size={36}
                    />
                    <View style={styles.flex1}>
                      <View style={styles.authorTitleRow}>
                        <Text
                          numberOfLines={1}
                          style={[styles.authorName, { color: tokens.text }]}
                        >
                          {post.authorName || 'Specialist'}
                        </Text>
                        {post.authorRole ? (
                          <FlatBadge label={post.authorRole.replace(/_/g, ' ')} tone="neutral" />
                        ) : null}
                      </View>
                      <View style={styles.metaLine}>
                        <FlatBadge label={catMeta.label} tone={catMeta.tone} withDot />
                        {post.pinned ? <FlatBadge label="Pinned" tone="accent" /> : null}
                        <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                          {formatRelativeTime(post.createdAt) || formatShortDateTime(post.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.postIconActions}>
                      <BorderlessIconButton
                        name="bookmark"
                        size={16}
                        color={post.pinned ? tokens.accent : tokens.textMuted}
                        disabled={busyPostId === post.id}
                        onPress={() => handleTogglePin(post.id)}
                        accessibilityLabel={post.pinned ? 'Unpin post' : 'Pin post'}
                      />
                      {canDelete ? (
                        <BorderlessIconButton
                          name="trash-2"
                          size={16}
                          color={tokens.danger}
                          disabled={busyPostId === post.id}
                          onPress={() => handleDeletePost(post.id)}
                          accessibilityLabel="Delete post"
                        />
                      ) : null}
                    </View>
                  </View>

                  {renderRichBody(post.body)}

                  {/* Extracted Ticket Reference Chips */}
                  {ticketRefs.length > 0 ? (
                    <View style={styles.refChipsRow}>
                      {ticketRefs.map((ref) => (
                        <TouchableOpacity
                          key={ref}
                          activeOpacity={0.7}
                          onPress={() => onOpenTicket(ref.replace(/^#/, ''))}
                          style={[
                            styles.refChip,
                            {
                              backgroundColor: tokens.accentSoft,
                              borderColor: tokens.accent,
                            },
                          ]}
                        >
                          <Feather name="hash" size={11} color={tokens.accent} />
                          <Text style={[styles.refChipText, { color: tokens.accent }]}>
                            {ref.replace(/^#/, '')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  {/* Quick Emoji Reactions */}
                  <View style={styles.reactionRow}>
                    {QUICK_REACTIONS.map((emoji) => {
                      const reactors = post.reactions?.[emoji] || [];
                      const reacted = reactors.includes(user.id);
                      return (
                        <TouchableOpacity
                          key={emoji}
                          activeOpacity={0.65}
                          onPress={() => handleReact(post.id, emoji)}
                          style={[
                            styles.reactionChip,
                            {
                              backgroundColor: reacted ? tokens.accentSoft : tokens.surfaceSubtle,
                              borderColor: reacted ? tokens.accent : tokens.hairlineStrong,
                            },
                          ]}
                        >
                          <Text style={styles.emojiChar}>{emoji}</Text>
                          {reactors.length > 0 ? (
                            <Text
                              style={[
                                styles.reactionCount,
                                { color: reacted ? tokens.accent : tokens.textSecondary },
                              ]}
                            >
                              {reactors.length}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </AnimatedListItem>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default InternalTeamWallScreen;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11.5,
  },
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 18,
  },
  tabBtn: {
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  composerBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  categoryChipRow: {
    gap: 7,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  postRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  authorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 13.5,
    fontWeight: '700',
    flexShrink: 1,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
  },
  postIconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  inlineTicketLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  refChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  refChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
  },
  refChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 2,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  emojiChar: {
    fontSize: 12.5,
  },
  reactionCount: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
