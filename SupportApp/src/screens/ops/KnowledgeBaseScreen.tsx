import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { KbArticle } from '../../types/opsHub';
import { formatRelativeTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicSpinner,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

const VISIBILITY_TABS: { id: 'all' | 'internal' | 'public'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'internal', label: 'Internal Playbooks' },
  { id: 'public', label: 'Public Help' },
];

const KB_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Billing', label: 'Billing' },
  { id: 'Technical', label: 'Technical' },
  { id: 'Domains', label: 'Domains' },
  { id: 'Security', label: 'Security' },
  { id: 'Account', label: 'Account' },
];

export const KnowledgeBaseScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onNavigateSubScreen,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [searchQuery, setSearchQuery] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'internal' | 'public'>('all');
  const [category, setCategory] = useState<string>('all');

  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadArticles = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listKbArticles({
          q: searchQuery.trim() || undefined,
          visibility,
          category: category === 'all' ? undefined : category,
        });
        setArticles(res.articles || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load knowledge base.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, searchQuery, showToast, visibility]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadArticles(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [loadArticles]);

  const pinnedArticles = useMemo(
    () => articles.filter((a) => Boolean(a.pinned)),
    [articles]
  );

  const regularArticles = useMemo(
    () => articles.filter((a) => !a.pinned),
    [articles]
  );

  const openArticle = (articleId: string) => {
    onNavigateSubScreen('kb_editor', { articleId });
  };

  const renderArticleRow = (art: KbArticle, isPinnedHighlight = false) => (
    <TouchableOpacity
      key={art.id}
      activeOpacity={0.68}
      onPress={() => openArticle(art.id)}
      style={[
        styles.articleRow,
        isPinnedHighlight && {
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.hairlineStrong,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
        },
      ]}
    >
      <View style={styles.rowTop}>
        <View style={styles.badgeCluster}>
          {art.pinned ? (
            <FlatBadge label="Pinned" tone="warning" withDot />
          ) : null}
          <FlatBadge
            label={art.visibility === 'internal' ? 'Internal Playbook' : 'Public Help'}
            tone={art.visibility === 'internal' ? 'accent' : 'success'}
          />
          <FlatBadge label={art.category || 'General'} tone="neutral" />
        </View>
        <Feather name="chevron-right" size={16} color={tokens.textMuted} />
      </View>

      <Text numberOfLines={1} style={[styles.articleTitle, { color: tokens.text }]}>
        {art.title}
      </Text>

      {art.summary ? (
        <Text numberOfLines={2} style={[styles.articleSummary, { color: tokens.textSecondary }]}>
          {art.summary}
        </Text>
      ) : null}

      <View style={styles.rowFoot}>
        <Text numberOfLines={1} style={[styles.authorMeta, { color: tokens.textMuted }]}>
          {`${art.authorName || 'Staff'} · ${formatRelativeTime(art.updatedAt) || 'recently'}`}
        </Text>

        <View style={styles.metricsCluster}>
          <View style={styles.metricItem}>
            <Feather name="eye" size={12} color={tokens.textMuted} />
            <Text style={[styles.metricText, { color: tokens.textMuted }]}>
              {art.viewsCount ?? 0}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Feather name="thumbs-up" size={12} color={tokens.accent} />
            <Text style={[styles.metricText, { color: tokens.accent }]}>
              {art.helpfulCount ?? 0}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.headerLeft}>
          <BorderlessIconButton
            name="arrow-left"
            size={20}
            onPress={onBack}
            accessibilityLabel="Back"
          />
          <View>
            <Text style={[styles.pageTitle, { color: tokens.text }]}>Knowledge Base</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {`${articles.length} playbooks & help articles`}
            </Text>
          </View>
        </View>

        <ShimmerButton
          label="+ New Article"
          size="xs"
          variant="accent"
          onPress={() => onNavigateSubScreen('kb_editor')}
        />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <FlatInput
          placeholder="Search playbooks, SOPs, tags, or topics..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Feather name="search" size={15} color={tokens.textMuted} />}
          rightSlot={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={tokens.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      {/* Visibility Underlined Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {VISIBILITY_TABS.map((t) => {
            const active = visibility === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setVisibility(t.id)}
                style={[
                  styles.tabItem,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text style={[styles.tabLabel, { color: active ? tokens.text : tokens.textMuted }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Category Selective 1px Chips */}
      <View style={[styles.categoryStrip, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {KB_CATEGORIES.map((cat) => {
            const active = category.toLowerCase() === cat.id.toLowerCase();
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                    borderColor: active ? tokens.accent : tokens.hairlineStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: active ? tokens.accent : tokens.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading && articles.length === 0 ? (
        <MagicSpinner label="Loading knowledge articles..." />
      ) : (
        <FlatList
          data={regularArticles}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadArticles(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListHeaderComponent={
            pinnedArticles.length > 0 ? (
              <View style={styles.pinnedSection}>
                <View style={styles.pinnedHeadingRow}>
                  <Feather name="bookmark" size={13} color={tokens.warning} />
                  <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
                    {`PINNED ARTICLES (${pinnedArticles.length})`}
                  </Text>
                </View>
                <View style={styles.pinnedStack}>
                  {pinnedArticles.map((art) => renderArticleRow(art, true))}
                </View>
                {regularArticles.length > 0 ? (
                  <Text style={[styles.allLabel, { color: tokens.textMuted }]}>ALL ARTICLES</Text>
                ) : null}
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            pinnedArticles.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="book-open" size={22} color={tokens.textMuted} />
                <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                  No articles match this filter. Tap + New Article to author one.
                </Text>
              </View>
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>{renderArticleRow(item, false)}</AnimatedListItem>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pageTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 18,
    gap: 18,
  },
  tabItem: {
    paddingVertical: 9,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  categoryStrip: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  categoryScroll: {
    paddingHorizontal: 18,
    gap: 7,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 28,
  },
  pinnedSection: {
    gap: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  pinnedHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  allLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  pinnedStack: {
    gap: 8,
  },
  articleRow: {
    paddingVertical: 12,
    gap: 5,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  articleTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
  },
  articleSummary: {
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  authorMeta: {
    fontSize: 11.5,
    flex: 1,
  },
  metricsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
