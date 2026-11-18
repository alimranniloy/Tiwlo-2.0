import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { deleteSecureItem, getSecureItem, setSecureItem, STORAGE_KEYS } from '../../services/storage';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe, SupportAgent, SupportTicket } from '../../types/support';
import {
  formatRelativeTime,
  formatSlaBadge,
  getPriorityTone,
  getStatusLabel,
  getStatusTone,
  getTicketSerial,
} from '../../utils/formatters';
import { evaluateTicketReplyAccess } from '../../utils/replyGuard';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicModalSheet,
  MagicSpinner,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { QuickPeekModal } from '../ops/QuickPeekModal';

interface TicketsScreenProps {
  user: AuthUser;
  staffProfile: StaffProfileMe;
  initialQueue?: string;
  onOpenTicket: (ticketId: string) => void;
  onNavigateSubScreen?: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
  onPulseSync?: () => void;
}

interface FilterPreset {
  id: string;
  name: string;
  queue: string;
  status: string;
  priority: string;
  category: string;
}

const QUEUE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'mine', label: 'Mine' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'sla', label: 'SLA Risk' },
  { id: 'guest', label: 'Guest' },
  { id: 'registered', label: 'Registered' },
  { id: 'resolved', label: 'Resolved' },
];

const STATUS_OPTIONS = ['all', 'open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['all', 'urgent', 'high', 'medium', 'low'];
const CATEGORY_OPTIONS = ['all', 'billing', 'technical', 'account', 'orders', 'domains', 'pick', 'security', 'general'];

export const TicketsScreen: React.FC<TicketsScreenProps> = ({
  user,
  staffProfile,
  initialQueue = 'all',
  onOpenTicket,
  onNavigateSubScreen,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [peekTicket, setPeekTicket] = useState<SupportTicket | null>(null);

  const [queue, setQueue] = useState<string>(initialQueue || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [agents, setAgents] = useState<SupportAgent[]>([]);

  useEffect(() => {
    if (initialQueue) setQueue(initialQueue);
  }, [initialQueue]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getSecureItem(STORAGE_KEYS.SAVED_PRESETS);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setSavedPresets(parsed);
        }
      } catch {
        // Ignore invalid saved presets
      }
    })();
  }, []);

  const loadTickets = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const effectiveStatus =
          statusFilter !== 'all'
            ? statusFilter
            : queue === 'open' || queue === 'escalated' || queue === 'resolved'
              ? queue
              : undefined;

        const res = await supportService.listTickets({
          q: searchQuery.trim() || undefined,
          status: effectiveStatus,
          priority: priorityFilter !== 'all' ? priorityFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          assignedAgentId:
            queue === 'mine'
              ? user.id
              : queue === 'unassigned'
                ? 'unassigned'
                : undefined,
          requesterType: queue === 'guest' || queue === 'registered' ? queue : undefined,
          slaBreached: queue === 'sla' ? true : undefined,
          limit: 50,
        });

        let rows = res.tickets || [];
        if (queue === 'unassigned') {
          rows = rows.filter((t) => !t.assignedAgentId);
        }
        setTickets(rows);
        setTotal(res.total ?? rows.length);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load tickets.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [categoryFilter, priorityFilter, queue, searchQuery, statusFilter, toast, user.id]
  );

  useEffect(() => {
    const timer = setTimeout(() => loadTickets(false), 180);
    return () => clearTimeout(timer);
  }, [loadTickets]);

  const openBulkSheet = async () => {
    setBulkStatus('');
    setBulkPriority('');
    setBulkAgentId('');
    setBulkTag('');
    setBulkSheetVisible(true);
    try {
      const res = await supportService.getAgents();
      setAgents(res.agents || []);
    } catch {
      // Optional
    }
  };

  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0) return;
    if (!bulkStatus && !bulkPriority && !bulkAgentId && !bulkTag.trim()) {
      toast.show({ variant: 'danger', label: 'Select at least one field to update.' });
      return;
    }
    setBulkBusy(true);
    try {
      await supportService.bulkUpdateTickets({
        ticketIds: selectedIds,
        ...(bulkStatus ? { status: bulkStatus } : {}),
        ...(bulkPriority ? { priority: bulkPriority } : {}),
        ...(bulkAgentId
          ? { assignedAgentId: bulkAgentId === '__unassign__' ? null : bulkAgentId }
          : {}),
        ...(bulkTag.trim() ? { tags: [bulkTag.trim()] } : {}),
      });
      toast.show({ variant: 'success', label: `Updated ${selectedIds.length} tickets.` });
      setBulkSheetVisible(false);
      setSelectionMode(false);
      setSelectedIds([]);
      loadTickets(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Bulk update failed.',
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const csv = await supportService.exportTicketsCsv({
        q: searchQuery.trim() || undefined,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
      });
      await Share.share({ title: 'Tiwlo Support Tickets', message: csv });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'CSV export failed.',
      });
    }
  };

  const saveCurrentPreset = async () => {
    const clean = presetName.trim();
    if (!clean) {
      toast.show({ variant: 'danger', label: 'Enter a name for this filter preset.' });
      return;
    }
    const next: FilterPreset[] = [
      {
        id: String(Date.now()),
        name: clean,
        queue,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
      },
      ...savedPresets.slice(0, 7),
    ];
    setSavedPresets(next);
    setPresetName('');
    await setSecureItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(next));
    toast.show({ variant: 'success', label: `Saved "${clean}".` });
  };

  const applyPreset = (p: FilterPreset) => {
    setQueue(p.queue);
    setStatusFilter(p.status);
    setPriorityFilter(p.priority);
    setCategoryFilter(p.category);
    setFilterSheetVisible(false);
  };

  const removePreset = async (id: string) => {
    const next = savedPresets.filter((item) => item.id !== id);
    setSavedPresets(next);
    if (next.length === 0) await deleteSecureItem(STORAGE_KEYS.SAVED_PRESETS);
    else await setSecureItem(STORAGE_KEYS.SAVED_PRESETS, JSON.stringify(next));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAcceptTicket = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.acceptTicketAssignment(ticketId);
      onPulseSync?.();
      toast.show({ variant: 'success', label: 'Ticket accepted & locked to you.' });
      await loadTickets(true);
      onOpenTicket(ticketId);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not accept ticket.',
      });
      loadTickets(true);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelTicket = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.cancelTicketAssignment(ticketId);
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      onPulseSync?.();
      toast.show({ variant: 'accent', label: 'Ticket removed from your queue.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to dismiss ticket.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0);

  const canExport =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).some((p) => p === 'support.export' || p === 'support.view');

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Clean Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.pageTitle, { color: tokens.text }]}>Tickets</Text>
          <Text style={[styles.subText, { color: tokens.textMuted }]}>{`${total} conversations`}</Text>
        </View>
        <View style={styles.headerActions}>
          {onNavigateSubScreen ? (
            <BorderlessIconButton
              name="plus-circle"
              size={19}
              color={tokens.accent}
              accessibilityLabel="Create outbound ticket"
              onPress={() => onNavigateSubScreen('create_ticket')}
            />
          ) : null}
          <BorderlessIconButton
            name="check-square"
            size={19}
            color={selectionMode ? tokens.accent : tokens.text}
            accessibilityLabel="Select multiple tickets"
            onPress={() => {
              setSelectionMode((v) => !v);
              setSelectedIds([]);
            }}
          />
          <BorderlessIconButton
            name="sliders"
            size={19}
            color={activeFilterCount > 0 ? tokens.accent : tokens.text}
            badgeCount={activeFilterCount}
            accessibilityLabel="Filters"
            onPress={() => setFilterSheetVisible(true)}
          />
          {canExport ? (
            <BorderlessIconButton
              name="download"
              size={19}
              accessibilityLabel="Export CSV"
              onPress={handleExportCsv}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <FlatInput
          placeholder="Search serial, subject, customer email..."
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

      {/* Borderless Underlined Queue Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {QUEUE_TABS.map((t) => {
            const active = queue === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setQueue(t.id)}
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

      {/* Bulk Action Flat Bar */}
      {selectionMode ? (
        <View style={[styles.bulkBar, { backgroundColor: tokens.surfaceMuted, borderBottomColor: tokens.hairline }]}>
          <Text style={[styles.bulkText, { color: tokens.text }]}>
            {`${selectedIds.length} selected`}
          </Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity onPress={() => setSelectedIds(tickets.map((t) => t.id))} hitSlop={6}>
              <Text style={[styles.bulkLink, { color: tokens.accent }]}>Select all</Text>
            </TouchableOpacity>
            <ShimmerButton
              label="Bulk Edit"
              size="xs"
              disabled={selectedIds.length === 0}
              onPress={openBulkSheet}
            />
          </View>
        </View>
      ) : null}

      {loading && tickets.length === 0 ? (
        <MagicSpinner label="Fetching tickets..." />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadTickets(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
              No tickets match the selected filters.
            </Text>
          }
          renderItem={({ item, index }) => {
            const sla = formatSlaBadge(item);
            const checked = selectedIds.includes(item.id);
            const isClosed = item.status === 'closed' || item.status === 'resolved';
            const isAccepted =
              String(item.assignmentStatus || '').toLowerCase() === 'accepted' &&
              Boolean(item.assignedAgentId);
            const needsAccept = !isClosed && !isAccepted;
            const replyAccess = evaluateTicketReplyAccess(item, user, staffProfile);

            return (
              <AnimatedListItem index={index}>
                <TouchableOpacity
                  style={styles.ticketRow}
                  activeOpacity={0.65}
                  onLongPress={() => setPeekTicket(item)}
                  onPress={() => {
                    if (selectionMode) {
                      toggleSelect(item.id);
                      return;
                    }
                    if (needsAccept) {
                      setPeekTicket(item);
                      return;
                    }
                    onOpenTicket(item.id);
                  }}
                >
                  {selectionMode ? (
                    <View
                      style={[
                        styles.checkBox,
                        {
                          borderColor: checked ? tokens.accent : tokens.hairlineStrong,
                          backgroundColor: checked ? tokens.accent : 'transparent',
                        },
                      ]}
                    >
                      {checked ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
                    </View>
                  ) : null}

                  <View style={{ paddingTop: 2 }}>
                    <MagicAvatar
                      name={item.userName || item.guestName || 'Requester'}
                      uri={resolveWebsiteUrl(item.userAvatar)}
                      size={36}
                    />
                  </View>

                  <View style={styles.rowContent}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.serialText, { color: tokens.textMuted }]}>
                        {getTicketSerial(item)} · {formatRelativeTime(item.updatedAt || item.createdAt)}
                      </Text>
                      <View style={styles.badgePair}>
                        <FlatBadge
                          label={replyAccess.shortStatusLabel}
                          tone={replyAccess.tone}
                        />
                        <FlatBadge
                          label={getStatusLabel(item.status)}
                          tone={getStatusTone(item.status)}
                          withDot
                        />
                        <FlatBadge
                          label={item.priority.toUpperCase()}
                          tone={getPriorityTone(item.priority)}
                        />
                      </View>
                    </View>

                    <Text numberOfLines={2} style={[styles.subjectText, { color: tokens.text }]}>
                      {item.subject}
                    </Text>

                    <View style={styles.rowFoot}>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text numberOfLines={1} style={[styles.metaText, { color: tokens.textMuted }]}>
                          {item.userName || item.guestName || 'Guest'}
                          {item.assignedAgentName ? ` · ${item.assignedAgentName}` : ' · Needs acceptance'}
                        </Text>
                        <Text
                          style={[
                            styles.slaText,
                            { color: sla.breached ? tokens.danger : tokens.textMuted },
                          ]}
                        >
                          {sla.text}
                        </Text>
                      </View>

                      {!selectionMode ? (
                        <BorderlessIconButton
                          name="eye"
                          size={15}
                          color={tokens.textMuted}
                          accessibilityLabel="Quick peek ticket"
                          onPress={() => setPeekTicket(item)}
                        />
                      ) : null}

                      {needsAccept && !selectionMode ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ShimmerButton
                            label="Accept"
                            size="xs"
                            variant="accent"
                            loading={busyId === item.id}
                            onPress={() => handleAcceptTicket(item.id)}
                          />
                          <ShimmerButton
                            label="Cancel"
                            size="xs"
                            variant="subtle"
                            disabled={busyId === item.id}
                            onPress={() => handleCancelTicket(item.id)}
                          />
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            );
          }}
        />
      )}

      <QuickPeekModal
        visible={Boolean(peekTicket)}
        kind="ticket"
        targetId={peekTicket?.id || null}
        initialTicket={peekTicket}
        user={user}
        staffProfile={staffProfile}
        onClose={() => setPeekTicket(null)}
        onOpenFull={(_, id) => {
          setPeekTicket(null);
          onOpenTicket(id);
        }}
        onChanged={() => {
          loadTickets(true);
          onPulseSync?.();
        }}
      />

      {/* Filter & Preset Sheet */}
      <MagicModalSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        title="Filters & Saved Views"
        subtitle="Narrow tickets or apply saved queue presets"
      >
        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>STATUS</Text>
        <View style={styles.chipWrap}>
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setStatusFilter(opt)}
                style={[
                  styles.filterOpt,
                  { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                  {opt === 'all' ? 'All' : getStatusLabel(opt)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>PRIORITY</Text>
        <View style={styles.chipWrap}>
          {PRIORITY_OPTIONS.map((opt) => {
            const active = priorityFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setPriorityFilter(opt)}
                style={[
                  styles.filterOpt,
                  { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                  {opt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>CATEGORY</Text>
        <View style={styles.chipWrap}>
          {CATEGORY_OPTIONS.map((opt) => {
            const active = categoryFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => setCategoryFilter(opt)}
                style={[
                  styles.filterOpt,
                  { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Hairline />

        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>SAVE VIEW PRESET</Text>
        <View style={styles.presetSaveRow}>
          <FlatInput
            value={presetName}
            onChangeText={setPresetName}
            placeholder="Preset name (e.g. Urgent SLA)"
            style={{ flex: 1 }}
          />
          <ShimmerButton label="Save" size="sm" onPress={saveCurrentPreset} />
        </View>

        {savedPresets.length > 0 ? (
          <View style={styles.presetList}>
            {savedPresets.map((p) => (
              <View key={p.id} style={[styles.presetRow, { borderBottomColor: tokens.hairline }]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => applyPreset(p)}>
                  <Text style={[styles.presetName, { color: tokens.text }]}>{p.name}</Text>
                  <Text style={[styles.presetMeta, { color: tokens.textMuted }]}>
                    {`${p.queue} · ${p.status} · ${p.priority}`}
                  </Text>
                </TouchableOpacity>
                <BorderlessIconButton
                  name="trash-2"
                  size={15}
                  color={tokens.danger}
                  onPress={() => removePreset(p.id)}
                  accessibilityLabel="Delete preset"
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sheetFooter}>
          <TouchableOpacity
            onPress={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setCategoryFilter('all');
            }}
            hitSlop={8}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.textMuted }}>Reset all</Text>
          </TouchableOpacity>
          <ShimmerButton label="Done" size="sm" onPress={() => setFilterSheetVisible(false)} />
        </View>
      </MagicModalSheet>

      {/* Bulk Update Sheet */}
      <MagicModalSheet
        visible={bulkSheetVisible}
        onClose={() => setBulkSheetVisible(false)}
        title={`Bulk Edit (${selectedIds.length})`}
        subtitle="Update status, priority, owner, or tag across selected tickets"
      >
        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>NEW STATUS</Text>
        <View style={styles.chipWrap}>
          {['', 'open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed'].map((opt) => {
            const active = bulkStatus === opt;
            return (
              <TouchableOpacity
                key={opt || 'keep'}
                onPress={() => setBulkStatus(opt)}
                style={[
                  styles.filterOpt,
                  { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                  {opt ? getStatusLabel(opt) : 'No change'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>NEW PRIORITY</Text>
        <View style={styles.chipWrap}>
          {['', 'low', 'medium', 'high', 'urgent'].map((opt) => {
            const active = bulkPriority === opt;
            return (
              <TouchableOpacity
                key={opt || 'keep'}
                onPress={() => setBulkPriority(opt)}
                style={[
                  styles.filterOpt,
                  { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                  {opt ? opt.toUpperCase() : 'No change'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.filterHeading, { color: tokens.textSecondary }]}>ASSIGN AGENT</Text>
        <View style={styles.chipWrap}>
          <TouchableOpacity
            onPress={() => setBulkAgentId('')}
            style={[
              styles.filterOpt,
              { backgroundColor: !bulkAgentId ? tokens.accentSoft : tokens.surfaceMuted },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: !bulkAgentId ? tokens.accent : tokens.textMuted }}>
              No change
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBulkAgentId('__unassign__')}
            style={[
              styles.filterOpt,
              { backgroundColor: bulkAgentId === '__unassign__' ? tokens.accentSoft : tokens.surfaceMuted },
            ]}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: bulkAgentId === '__unassign__' ? tokens.accent : tokens.textMuted,
              }}
            >
              Unassign
            </Text>
          </TouchableOpacity>
          {agents.map((ag) => {
            const active = bulkAgentId === ag.id;
            return (
              <TouchableOpacity
                key={ag.id}
                onPress={() => setBulkAgentId(ag.id)}
                style={[
                  styles.filterOpt,
                  { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                  {ag.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatInput label="Append Tag" value={bulkTag} onChangeText={setBulkTag} placeholder="vip-followup" />

        <View style={styles.sheetFooter}>
          <TouchableOpacity onPress={() => setBulkSheetVisible(false)} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tokens.textMuted }}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton
            label="Apply Updates"
            size="sm"
            variant="accent"
            loading={bulkBusy}
            onPress={handleBulkSubmit}
          />
        </View>
      </MagicModalSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subText: { fontSize: 11.5, marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingBottom: 10,
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
    fontSize: 13,
    fontWeight: '600',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bulkText: { fontSize: 12.5, fontWeight: '600' },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bulkLink: { fontSize: 12.5, fontWeight: '600' },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 32,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  serialText: { fontSize: 11, fontWeight: '600' },
  badgePair: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subjectText: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  rowFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: { fontSize: 12, flexShrink: 1 },
  slaText: { fontSize: 11, fontWeight: '600' },
  filterHeading: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterOpt: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  presetSaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  presetList: { gap: 2 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  presetName: { fontSize: 13, fontWeight: '600' },
  presetMeta: { fontSize: 11 },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
  },
});
