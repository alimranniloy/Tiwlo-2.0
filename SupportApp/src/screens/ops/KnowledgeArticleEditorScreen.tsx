import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { KbArticle } from '../../types/opsHub';
import { formatShortDateTime } from '../../utils/formatters';
import {
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  FlatNotice,
  Hairline,
  MagicSpinner,
  MagicSwitch,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

const CATEGORY_CHOICES = ['Billing', 'Technical', 'Domains', 'Security', 'Account'];

async function copyOrShareText(title: string, content: string): Promise<'copied' | 'shared'> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return 'copied';
  }
  await Share.share({
    title,
    message: `${title}\n\n${content}`,
  });
  return 'shared';
}

export const KnowledgeArticleEditorScreen: React.FC<OpsScreenProps> = ({
  onBack,
  routeParams,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const articleId = routeParams?.articleId?.trim() || '';

  const [mode, setMode] = useState<'read' | 'edit' | 'create'>(articleId ? 'read' : 'create');
  const [loading, setLoading] = useState<boolean>(Boolean(articleId));
  const [article, setArticle] = useState<KbArticle | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Technical');
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [pinned, setPinned] = useState(false);

  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [helpfulBusy, setHelpfulBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const hydrateFormFromArticle = useCallback((art: KbArticle) => {
    setTitle(art.title || '');
    setCategory(art.category || 'Technical');
    setVisibility(art.visibility === 'public' ? 'public' : 'internal');
    setSummary(art.summary || '');
    setContent(art.content || '');
    setTagsText((art.tags || []).join(', '));
    setPinned(Boolean(art.pinned));
  }, []);

  const loadArticle = useCallback(async () => {
    if (!articleId) {
      setMode('create');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await opsHubService.getKbArticle(articleId);
      setArticle(res.article);
      hydrateFormFromArticle(res.article);
      setMode('read');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load article.');
    } finally {
      setLoading(false);
    }
  }, [articleId, hydrateFormFromArticle]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  const handleGenerateAiDraft = async () => {
    const promptSeed = title.trim() || summary.trim();
    if (!promptSeed) {
      showToast({
        variant: 'danger',
        label: 'Enter an article title first so Gemini AI knows what to draft.',
      });
      return;
    }
    setAiBusy(true);
    try {
      const res = await opsHubService.runAiPlayground({
        task: 'kb_draft',
        input: promptSeed,
      });
      const generated = (res.output || '').trim();
      if (generated) {
        setContent(generated);
        if (!summary.trim()) {
          const firstLine = generated
            .split('\n')
            .map((l) => l.replace(/^#+\s*/, '').trim())
            .find((l) => l.length > 20);
          if (firstLine) {
            setSummary(firstLine.slice(0, 160));
          }
        }
        showToast({ variant: 'accent', label: 'Draft generated with Gemini AI.' });
      }
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Gemini AI draft failed.',
      });
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = async () => {
    setErrorMsg('');
    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (!cleanTitle) {
      setErrorMsg('Article title is required.');
      return;
    }
    if (!cleanContent) {
      setErrorMsg('Article content cannot be empty.');
      return;
    }

    const parsedTags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await opsHubService.saveKbArticle({
        id: article?.id || (articleId ? articleId : undefined),
        title: cleanTitle,
        category,
        visibility,
        summary: summary.trim() || cleanContent.slice(0, 140),
        content: cleanContent,
        tags: parsedTags,
        pinned,
      });
      setArticle(res.article);
      hydrateFormFromArticle(res.article);
      setMode('read');
      showToast({
        variant: 'success',
        label: mode === 'create' ? 'Knowledge article published.' : 'Article updated.',
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save article.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyContent = async () => {
    const targetTitle = article?.title || title || 'KB Article';
    const targetBody = article?.content || content || '';
    if (!targetBody.trim()) return;
    try {
      const outcome = await copyOrShareText(targetTitle, targetBody);
      showToast({
        variant: 'success',
        label: outcome === 'copied' ? 'Article content copied.' : 'Article shared.',
      });
    } catch {
      // User cancelled share sheet
    }
  };

  const handleMarkHelpful = async () => {
    const idToMark = article?.id || articleId;
    if (!idToMark) return;
    setHelpfulBusy(true);
    try {
      const res = await opsHubService.markKbHelpful(idToMark);
      setArticle(res.article);
      showToast({ variant: 'success', label: 'Marked helpful.' });
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not record feedback.',
      });
    } finally {
      setHelpfulBusy(false);
    }
  };

  const executeDelete = async () => {
    const idToDelete = article?.id || articleId;
    if (!idToDelete) return;
    setDeleting(true);
    try {
      await opsHubService.deleteKbArticle(idToDelete);
      showToast({ variant: 'default', label: 'Article deleted.' });
      onBack();
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not delete article.',
      });
      setDeleting(false);
    }
  };

  const handleDeletePrompt = () => {
    if (Platform.OS === 'web') {
      executeDelete();
      return;
    }
    Alert.alert(
      'Delete Article',
      'Permanently remove this knowledge base article? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: executeDelete },
      ]
    );
  };

  const isReader = mode === 'read' && Boolean(article);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Top Bar */}
      <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.headerLeft}>
          <BorderlessIconButton
            name="arrow-left"
            size={20}
            onPress={onBack}
            accessibilityLabel="Back"
          />
          <View style={styles.flex1}>
            <Text numberOfLines={1} style={[styles.pageTitle, { color: tokens.text }]}>
              {mode === 'create'
                ? 'New KB Article'
                : isReader
                  ? 'Knowledge Reader'
                  : 'Edit Article'}
            </Text>
            <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.textMuted }]}>
              {isReader
                ? `${article?.category || 'General'} · ${article?.visibility === 'public' ? 'Public Help' : 'Internal Playbook'}`
                : 'Author internal SOPs or public customer articles'}
            </Text>
          </View>
        </View>

        {article ? (
          <ShimmerButton
            label={isReader ? 'Edit Mode' : 'Reader Mode'}
            size="xs"
            variant="subtle"
            leftIcon={
              <Feather
                name={isReader ? 'edit-2' : 'book-open'}
                size={12}
                color={tokens.text}
              />
            }
            onPress={() => {
              if (isReader) {
                hydrateFormFromArticle(article);
                setMode('edit');
              } else {
                setMode('read');
              }
            }}
          />
        ) : null}
      </View>

      {loading ? (
        <MagicSpinner label="Loading article..." />
      ) : isReader && article ? (
        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={48}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <BlurFade delay={20} offset={6}>
            <View style={styles.readerHeader}>
              <View style={styles.badgeRow}>
                {article.pinned ? (
                  <FlatBadge label="Pinned" tone="warning" withDot />
                ) : null}
                <FlatBadge
                  label={article.visibility === 'public' ? 'Public Help' : 'Internal Playbook'}
                  tone={article.visibility === 'public' ? 'success' : 'accent'}
                />
                <FlatBadge label={article.category || 'General'} tone="neutral" />
              </View>

              <Text style={[styles.readerTitle, { color: tokens.text }]}>{article.title}</Text>

              <Text style={[styles.readerMeta, { color: tokens.textMuted }]}>
                {`By ${article.authorName || 'Support Team'} · Updated ${formatShortDateTime(article.updatedAt)} · ${article.viewsCount ?? 0} views`}
              </Text>

              {article.summary ? (
                <View
                  style={[
                    styles.summaryCallout,
                    {
                      backgroundColor: tokens.surfaceSubtle,
                      borderColor: tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text style={[styles.summaryText, { color: tokens.textSecondary }]}>
                    {article.summary}
                  </Text>
                </View>
              ) : null}
            </View>
          </BlurFade>

          {/* Reader Quick Action Strip */}
          <View
            style={[
              styles.readerActionsBar,
              {
                borderTopColor: tokens.hairline,
                borderBottomColor: tokens.hairline,
              },
            ]}
          >
            <View style={styles.actionGroupLeft}>
              <ShimmerButton
                label="Copy Content"
                size="xs"
                variant="subtle"
                leftIcon={<Feather name="copy" size={12} color={tokens.text} />}
                onPress={handleCopyContent}
              />
              <ShimmerButton
                label={`Mark Helpful (${article.helpfulCount ?? 0})`}
                size="xs"
                variant="subtle"
                loading={helpfulBusy}
                leftIcon={<Feather name="thumbs-up" size={12} color={tokens.accent} />}
                onPress={handleMarkHelpful}
              />
            </View>

            <BorderlessIconButton
              name="trash-2"
              size={17}
              color={tokens.danger}
              disabled={deleting}
              accessibilityLabel="Delete article"
              onPress={handleDeletePrompt}
            />
          </View>

          {/* Article Body */}
          <BlurFade delay={60} offset={6}>
            <Text selectable style={[styles.readerBody, { color: tokens.text }]}>
              {article.content}
            </Text>
          </BlurFade>

          {article.tags && article.tags.length > 0 ? (
            <View style={styles.tagsWrap}>
              {article.tags.map((tag) => (
                <FlatBadge key={tag} label={`#${tag}`} tone="neutral" />
              ))}
            </View>
          ) : null}
        </KeyboardAwareScrollView>
      ) : (
        <KeyboardAwareScrollView
          style={styles.flex1}
          bottomOffset={72}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {errorMsg ? <FlatNotice text={errorMsg} tone="danger" icon="alert-circle" /> : null}

          <FlatInput
            label="Article Title *"
            placeholder="e.g. Troubleshooting Custom Domain SSL Propagation"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
          />

          {/* Gemini AI Draft Generator Strip */}
          <View
            style={[
              styles.aiStrip,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.aiStripLeft}>
              <Feather name="zap" size={15} color={tokens.accent} />
              <View style={styles.flex1}>
                <Text style={[styles.aiStripTitle, { color: tokens.text }]}>
                  Gemini AI Playbook Writer
                </Text>
                <Text style={[styles.aiStripSub, { color: tokens.textMuted }]}>
                  Auto-draft structured steps & troubleshooting guidance from your title
                </Text>
              </View>
            </View>
            <ShimmerButton
              label="Generate Draft with Gemini AI"
              size="xs"
              variant="accent"
              loading={aiBusy}
              disabled={saving}
              onPress={handleGenerateAiDraft}
            />
          </View>

          {/* Visibility Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Visibility</Text>
            <View style={styles.chipRow}>
              {(
                [
                  { id: 'internal', label: 'Internal Playbook' },
                  { id: 'public', label: 'Public Help Center' },
                ] as const
              ).map((opt) => {
                const active = visibility === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setVisibility(opt.id)}
                    style={[
                      styles.selectChip,
                      {
                        backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                        borderColor: active ? tokens.accent : tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? tokens.accent : tokens.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Category Selector */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORY_CHOICES.map((cat) => {
                const active = category.toLowerCase() === cat.toLowerCase();
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.selectChip,
                      {
                        backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                        borderColor: active ? tokens.accent : tokens.hairlineStrong,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? tokens.accent : tokens.textSecondary },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <FlatInput
            label="Short Summary"
            placeholder="One-line overview shown in search results..."
            value={summary}
            onChangeText={setSummary}
            autoCapitalize="sentences"
          />

          <FlatInput
            label="Article Content *"
            placeholder="Write step-by-step resolution instructions, escalation criteria, or customer guidance..."
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={10}
            autoCapitalize="sentences"
            autoCorrect
            inputStyle={styles.editorBodyInput}
          />

          <FlatInput
            label="Tags (comma-separated)"
            placeholder="ssl, dns, cloudflare, billing"
            value={tagsText}
            onChangeText={setTagsText}
          />

          <View
            style={[
              styles.pinSwitchRow,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            <View style={styles.flex1}>
              <Text style={[styles.pinTitle, { color: tokens.text }]}>Pin to Knowledge Hub Top</Text>
              <Text style={[styles.pinSub, { color: tokens.textMuted }]}>
                Keep this playbook highlighted above standard articles
              </Text>
            </View>
            <MagicSwitch value={pinned} onValueChange={setPinned} />
          </View>

          <Hairline />

          <View style={styles.editorFooter}>
            <View style={styles.footerLeft}>
              {article ? (
                <ShimmerButton
                  label="Delete"
                  size="xs"
                  variant="danger"
                  loading={deleting}
                  disabled={saving}
                  onPress={handleDeletePrompt}
                />
              ) : (
                <TouchableOpacity onPress={onBack} hitSlop={8}>
                  <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            <ShimmerButton
              label={mode === 'create' ? 'Publish Article' : 'Save Changes'}
              size="sm"
              variant="accent"
              loading={saving}
              disabled={aiBusy || deleting}
              leftIcon={<Feather name="check" size={14} color={tokens.accentText} />}
              onPress={handleSave}
            />
          </View>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex1: {
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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 14,
  },
  readerHeader: {
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  readerTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  readerMeta: {
    fontSize: 12,
  },
  summaryCallout: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
  },
  summaryText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  readerActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    gap: 8,
  },
  actionGroupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  readerBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 6,
  },
  aiStrip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  aiStripLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  aiStripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiStripSub: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 1,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  selectChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editorBodyInput: {
    minHeight: 190,
  },
  pinSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  pinTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  pinSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
