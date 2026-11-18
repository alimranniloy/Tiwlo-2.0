import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { SupportMacro } from '../../types/support';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicModalSheet,
  MagicSpinner,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

type StudioTab = 'macros' | 'templates';

const VARIABLE_TOKENS = ['{{customerName}}', '{{ticketId}}', '{{agentName}}'] as const;
const MACRO_CATEGORIES = ['General', 'Greeting', 'Billing', 'Technical', 'Closing'];

export const CannedMacrosStudioScreen: React.FC<OpsScreenProps> = ({ onBack }) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [activeTab, setActiveTab] = useState<StudioTab>('macros');
  const [searchQuery, setSearchQuery] = useState('');

  const [ticketMacros, setTicketMacros] = useState<SupportMacro[]>([]);
  const [chatTemplates, setChatTemplates] = useState<SupportMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<SupportMacro | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formBody, setFormBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiPolishing, setAiPolishing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [macrosRes, tplRes] = await Promise.all([
          supportService.getMacros(),
          supportService.listLiveChatTemplates(),
        ]);
        setTicketMacros(macrosRes.macros || []);
        setChatTemplates(tplRes.templates || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Could not load macros & templates.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  const activeItems = activeTab === 'macros' ? ticketMacros : chatTemplates;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeItems;
    return activeItems.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
    );
  }, [activeItems, searchQuery]);

  const openCreateSheet = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormCategory('General');
    setFormBody('');
    setSheetVisible(true);
  };

  const openEditSheet = (item: SupportMacro) => {
    setEditingItem(item);
    setFormTitle(item.title || '');
    setFormCategory(item.category || 'General');
    setFormBody(item.body || '');
    setSheetVisible(true);
  };

  const insertVariable = (variableToken: string) => {
    setFormBody((prev) => {
      if (!prev) return variableToken;
      const needsSpace = !prev.endsWith(' ') && !prev.endsWith('\n');
      return `${prev}${needsSpace ? ' ' : ''}${variableToken}`;
    });
  };

  const handleCopyOrShare = async (item: SupportMacro) => {
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(item.body);
        showToast({ variant: 'success', label: 'Copied response snippet.' });
        return;
      }
      await Share.share({
        title: item.title,
        message: item.body,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleCopyVariableHint = async (variableToken: string) => {
    if (sheetVisible) {
      insertVariable(variableToken);
      return;
    }
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(variableToken);
        showToast({ variant: 'accent', label: `Copied ${variableToken}` });
        return;
      }
      openCreateSheet();
      setFormBody(variableToken);
    } catch {
      // Non-fatal
    }
  };

  const handleAiPolishBody = async () => {
    if (!formBody.trim()) {
      showToast({ variant: 'danger', label: 'Enter template text first to polish.' });
      return;
    }
    setAiPolishing(true);
    try {
      const res = await opsHubService.runAiPlayground({
        task: 'polish',
        input: formBody.trim(),
      });
      if (res.output?.trim()) {
        setFormBody(res.output.trim());
        showToast({ variant: 'accent', label: 'Polished with Gemini AI.' });
      }
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'AI polish failed.',
      });
    } finally {
      setAiPolishing(false);
    }
  };

  const handleSaveItem = async () => {
    const cleanTitle = formTitle.trim();
    const cleanBody = formBody.trim();
    if (!cleanTitle || !cleanBody) {
      showToast({ variant: 'danger', label: 'Both title and message body are required.' });
      return;
    }

    setSaving(true);
    try {
      if (activeTab === 'macros') {
        if (editingItem) {
          await supportService.updateMacro(editingItem.id, {
            title: cleanTitle,
            category: formCategory.trim() || 'General',
            body: cleanBody,
          });
          showToast({ variant: 'success', label: 'Ticket macro updated.' });
        } else {
          await supportService.createMacro({
            title: cleanTitle,
            category: formCategory.trim() || 'General',
            body: cleanBody,
          });
          showToast({ variant: 'success', label: 'Ticket macro created.' });
        }
      } else if (editingItem) {
        await supportService.createLiveChatTemplate({
          title: cleanTitle,
          category: formCategory.trim() || 'General',
          body: cleanBody,
        });
        await supportService.deleteLiveChatTemplate(editingItem.id);
        showToast({ variant: 'success', label: 'Live chat template updated.' });
      } else {
        await supportService.createLiveChatTemplate({
          title: cleanTitle,
          category: formCategory.trim() || 'General',
          body: cleanBody,
        });
        showToast({ variant: 'success', label: 'Live chat template created.' });
      }

      setSheetVisible(false);
      await loadAll(true);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to save template.',
      });
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async (item: SupportMacro) => {
    setDeletingId(item.id);
    try {
      if (activeTab === 'macros') {
        await supportService.deleteMacro(item.id);
      } else {
        await supportService.deleteLiveChatTemplate(item.id);
      }
      showToast({ variant: 'default', label: `"${item.title}" removed.` });
      await loadAll(true);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to delete item.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (item: SupportMacro) => {
    if (Platform.OS === 'web') {
      executeDelete(item);
      return;
    }
    Alert.alert('Delete Template', `Delete "${item.title}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => executeDelete(item) },
    ]);
  };

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
            <Text style={[styles.pageTitle, { color: tokens.text }]}>Canned Macros Studio</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {`${ticketMacros.length} ticket macros · ${chatTemplates.length} chat templates`}
            </Text>
          </View>
        </View>

        <ShimmerButton
          label={activeTab === 'macros' ? '+ New Macro' : '+ New Template'}
          size="xs"
          variant="accent"
          onPress={openCreateSheet}
        />
      </View>

      {/* 2-Tab Segmented Bar */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('macros')}
          style={[
            styles.tabBtn,
            activeTab === 'macros' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'macros' ? tokens.text : tokens.textMuted },
            ]}
          >
            {`Ticket Macros (${ticketMacros.length})`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('templates')}
          style={[
            styles.tabBtn,
            activeTab === 'templates' && {
              borderBottomColor: tokens.accent,
              borderBottomWidth: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'templates' ? tokens.text : tokens.textMuted },
            ]}
          >
            {`Live Chat Templates (${chatTemplates.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Variable Chips Strip */}
      <View style={[styles.topControls, { borderBottomColor: tokens.hairline }]}>
        <FlatInput
          placeholder={
            activeTab === 'macros'
              ? 'Search ticket macros by title, category, or text...'
              : 'Search live chat templates...'
          }
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

        <View style={styles.varsRow}>
          <Text style={[styles.varsHint, { color: tokens.textMuted }]}>Variables:</Text>
          {VARIABLE_TOKENS.map((tok) => (
            <TouchableOpacity
              key={tok}
              onPress={() => handleCopyVariableHint(tok)}
              style={[
                styles.varChip,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            >
              <Text style={[styles.varChipText, { color: tokens.accent }]}>{tok}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* List */}
      {loading && activeItems.length === 0 ? (
        <MagicSpinner label="Loading studio library..." />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadAll(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="terminal" size={22} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                {activeTab === 'macros'
                  ? 'No ticket macros found. Create one to speed up replies.'
                  : 'No live chat templates found. Create a quick response snippet.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openEditSheet(item)}
                style={styles.macroRow}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.titleCluster}>
                    <Text numberOfLines={1} style={[styles.macroTitle, { color: tokens.text }]}>
                      {item.title}
                    </Text>
                    <FlatBadge label={item.category || 'General'} tone="neutral" />
                  </View>

                  <View style={styles.rowIcons}>
                    <BorderlessIconButton
                      name="share-2"
                      size={15}
                      color={tokens.textSecondary}
                      accessibilityLabel={`Share or copy ${item.title}`}
                      onPress={() => handleCopyOrShare(item)}
                    />
                    <BorderlessIconButton
                      name="edit-2"
                      size={15}
                      color={tokens.textSecondary}
                      accessibilityLabel={`Edit ${item.title}`}
                      onPress={() => openEditSheet(item)}
                    />
                    <BorderlessIconButton
                      name="trash-2"
                      size={15}
                      color={tokens.danger}
                      disabled={deletingId === item.id}
                      accessibilityLabel={`Delete ${item.title}`}
                      onPress={() => confirmDelete(item)}
                    />
                  </View>
                </View>

                <Text numberOfLines={3} style={[styles.macroBody, { color: tokens.textSecondary }]}>
                  {item.body}
                </Text>
              </TouchableOpacity>
            </AnimatedListItem>
          )}
        />
      )}

      {/* Create / Edit Modal Sheet */}
      <MagicModalSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title={
          editingItem
            ? `Edit ${activeTab === 'macros' ? 'Ticket Macro' : 'Chat Template'}`
            : `New ${activeTab === 'macros' ? 'Ticket Macro' : 'Chat Template'}`
        }
        subtitle="Tap a dynamic variable chip below to insert it into your message"
      >
        <FlatInput
          label="Title *"
          placeholder="e.g. Refund Processed Confirmation"
          value={formTitle}
          onChangeText={setFormTitle}
          autoCapitalize="words"
        />

        <View style={styles.catField}>
          <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>Category</Text>
          <View style={styles.catChipRow}>
            {MACRO_CATEGORIES.map((cat) => {
              const active = formCategory.toLowerCase() === cat.toLowerCase();
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setFormCategory(cat)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? tokens.accentSoft : tokens.surfaceSubtle,
                      borderColor: active ? tokens.accent : tokens.hairlineStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
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

        <View style={styles.insertBar}>
          <View style={styles.insertLeft}>
            <Text style={[styles.fieldLabel, { color: tokens.textSecondary }]}>
              Insert Variable
            </Text>
            <View style={styles.varsRow}>
              {VARIABLE_TOKENS.map((tok) => (
                <TouchableOpacity
                  key={tok}
                  onPress={() => insertVariable(tok)}
                  style={[
                    styles.varChip,
                    {
                      backgroundColor: tokens.accentSoft,
                      borderColor: tokens.accent,
                    },
                  ]}
                >
                  <Text style={[styles.varChipText, { color: tokens.accent }]}>{`+ ${tok}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ShimmerButton
            label="AI Polish"
            size="xs"
            variant="subtle"
            loading={aiPolishing}
            leftIcon={<Feather name="zap" size={12} color={tokens.accent} />}
            onPress={handleAiPolishBody}
          />
        </View>

        <FlatInput
          label="Response Body *"
          placeholder="Hi {{customerName}}, regarding {{ticketId}}..."
          value={formBody}
          onChangeText={setFormBody}
          multiline
          numberOfLines={6}
          autoCapitalize="sentences"
          autoCorrect
          inputStyle={styles.bodyInput}
        />

        <View style={styles.sheetFooter}>
          <TouchableOpacity onPress={() => setSheetVisible(false)} hitSlop={8}>
            <Text style={[styles.cancelText, { color: tokens.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton
            label={editingItem ? 'Update Snippet' : 'Create Snippet'}
            size="sm"
            variant="accent"
            loading={saving}
            disabled={aiPolishing}
            onPress={handleSaveItem}
          />
        </View>
      </MagicModalSheet>
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 20,
    borderBottomWidth: 1,
  },
  tabBtn: {
    paddingVertical: 10,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  topControls: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  varsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  varsHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  varChip: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  varChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  macroRow: {
    paddingVertical: 12,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  macroTitle: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  rowIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroBody: {
    fontSize: 12.5,
    lineHeight: 18,
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
  catField: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  catChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  insertBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  insertLeft: {
    flex: 1,
    gap: 5,
  },
  bodyInput: {
    minHeight: 110,
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
