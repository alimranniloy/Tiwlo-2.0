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
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { DedicatedScreenKey, PersonalStaffTask } from '../../types/opsHub';
import type { AuthUser, StaffProfileMe } from '../../types/support';
import { formatShortDateTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BlurFade,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicSpinner,
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

type TaskFilter = 'active' | 'pinned' | 'completed';

function getTaskPriorityTone(priority: PersonalStaffTask['priority']): SemanticTone {
  if (priority === 'high') return 'danger';
  if (priority === 'medium') return 'warning';
  return 'neutral';
}

export const PersonalNotesTasksScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onOpenTicket,
  routeParams,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<PersonalStaffTask[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('active');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  // Quick Inline Composer State
  const [composerOpen, setComposerOpen] = useState(true);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [linkedTicketSerial, setLinkedTicketSerial] = useState(
    routeParams?.ticketSerial || ''
  );
  const [dueLabel, setDueLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await opsHubService.listPersonalTasks();
        setTasks(res.tasks || []);
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load personal tasks.',
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
    loadTasks(false);
  }, [loadTasks]);

  useEffect(() => {
    if (routeParams?.ticketSerial) {
      setLinkedTicketSerial(routeParams.ticketSerial);
      setComposerOpen(true);
    }
  }, [routeParams?.ticketSerial]);

  const filteredTasks = useMemo(() => {
    const subset = tasks.filter((t) => {
      if (filter === 'active') return !t.completed;
      if (filter === 'pinned') return Boolean(t.pinned);
      return Boolean(t.completed);
    });

    return [...subset].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      const prioOrder = { high: 3, medium: 2, low: 1 };
      if (prioOrder[b.priority] !== prioOrder[a.priority]) {
        return prioOrder[b.priority] - prioOrder[a.priority];
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }, [filter, tasks]);

  const handleAddTask = async () => {
    if (!title.trim()) {
      toast.show({ variant: 'danger', label: 'Enter a task or follow-up title.' });
      return;
    }

    setSaving(true);
    try {
      const cleanSerial = linkedTicketSerial.trim();
      const res = await opsHubService.savePersonalTask({
        title: title.trim(),
        note: note.trim() || undefined,
        priority,
        linkedTicketSerial: cleanSerial || undefined,
        dueLabel: dueLabel.trim() || undefined,
        completed: false,
        pinned: false,
      });

      if (res.task) {
        setTasks((prev) => [res.task, ...prev]);
      } else {
        loadTasks(true);
      }

      setTitle('');
      setNote('');
      setLinkedTicketSerial('');
      setDueLabel('');
      setPriority('medium');
      toast.show({ variant: 'success', label: 'Follow-up added to your scratchpad.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to save task.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCompleted = async (task: PersonalStaffTask) => {
    const next = !task.completed;
    setBusyTaskId(task.id);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t))
    );
    try {
      const res = await opsHubService.savePersonalTask({
        id: task.id,
        title: task.title,
        note: task.note,
        priority: task.priority,
        linkedTicketSerial: task.linkedTicketSerial || undefined,
        dueLabel: task.dueLabel || undefined,
        completed: next,
        pinned: task.pinned,
      });
      if (res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
      }
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t))
      );
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update task.',
      });
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleTogglePinned = async (task: PersonalStaffTask) => {
    const next = !task.pinned;
    setBusyTaskId(task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, pinned: next } : t)));
    try {
      const res = await opsHubService.savePersonalTask({
        id: task.id,
        title: task.title,
        note: task.note,
        priority: task.priority,
        linkedTicketSerial: task.linkedTicketSerial || undefined,
        dueLabel: task.dueLabel || undefined,
        completed: task.completed,
        pinned: next,
      });
      if (res.task) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? res.task : t)));
      }
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, pinned: task.pinned } : t))
      );
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not update pin.',
      });
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDeleteTask = async (id: string) => {
    setBusyTaskId(id);
    try {
      await opsHubService.deletePersonalTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.show({ variant: 'accent', label: 'Note removed.' });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not delete note.',
      });
    } finally {
      setBusyTaskId(null);
    }
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
            Personal Notes & Follow-Ups
          </Text>
          <Text numberOfLines={1} style={[styles.headerSub, { color: tokens.textMuted }]}>
            Private specialist checklist & linked ticket reminders
          </Text>
        </View>
        <ShimmerButton
          label={composerOpen ? 'Hide Form' : '+ Add Note'}
          size="xs"
          variant={composerOpen ? 'subtle' : 'accent'}
          onPress={() => setComposerOpen((v) => !v)}
        />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        {(
          [
            {
              key: 'active',
              label: `Active (${tasks.filter((t) => !t.completed).length})`,
            },
            {
              key: 'pinned',
              label: `Pinned (${tasks.filter((t) => t.pinned).length})`,
            },
            {
              key: 'completed',
              label: `Completed (${tasks.filter((t) => t.completed).length})`,
            },
          ] as const
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[
                styles.tabBtn,
                active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
              ]}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  color: active ? tokens.text : tokens.textMuted,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
              loadTasks(true);
            }}
          />
        }
      >
        {/* Quick Inline + Add Follow-Up / Note Composer */}
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
              <Text style={[styles.composerHeading, { color: tokens.text }]}>
                + Add Follow-Up / Note
              </Text>

              <FlatInput
                value={title}
                onChangeText={setTitle}
                autoCapitalize="sentences"
                autoCorrect
                placeholder="Follow up with merchant on SSL renewal..."
              />

              <FlatInput
                value={note}
                onChangeText={setNote}
                autoCapitalize="sentences"
                autoCorrect
                multiline
                placeholder="Optional scratchpad details or callback instructions..."
              />

              <View style={styles.dualRow}>
                <FlatInput
                  value={linkedTicketSerial}
                  onChangeText={setLinkedTicketSerial}
                  placeholder="#TKT-1042 (optional)"
                  style={styles.flex1}
                />
                <FlatInput
                  value={dueLabel}
                  onChangeText={setDueLabel}
                  autoCapitalize="words"
                  placeholder="Due: Today 5 PM"
                  style={styles.flex1}
                />
              </View>

              <View style={styles.composerFoot}>
                <View style={styles.prioRow}>
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const active = priority === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        activeOpacity={0.7}
                        onPress={() => setPriority(p)}
                        style={[
                          styles.prioChip,
                          {
                            backgroundColor: active ? tokens.accentSoft : tokens.bg,
                            borderColor: active ? tokens.accent : tokens.hairlineStrong,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: active ? tokens.accent : tokens.textSecondary,
                          }}
                        >
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <ShimmerButton
                  label="Add Follow-Up"
                  size="xs"
                  variant="accent"
                  loading={saving}
                  onPress={handleAddTask}
                />
              </View>
            </View>
          </BlurFade>
        ) : null}

        <Hairline />

        {/* Task List */}
        {loading && tasks.length === 0 ? (
          <MagicSpinner label="Loading personal notes..." />
        ) : filteredTasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
            No personal tasks or notes in this tab.
          </Text>
        ) : (
          filteredTasks.map((task, idx) => {
            const serial = task.linkedTicketSerial?.trim() || '';
            const formattedSerial =
              serial && !serial.startsWith('#') ? `#${serial}` : serial;

            return (
              <AnimatedListItem key={task.id} index={idx}>
                <View style={[styles.taskRow, { borderBottomColor: tokens.hairline }]}>
                  <TouchableOpacity
                    activeOpacity={0.65}
                    disabled={busyTaskId === task.id}
                    onPress={() => handleToggleCompleted(task)}
                    hitSlop={8}
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: task.completed ? tokens.accent : 'transparent',
                        borderColor: task.completed ? tokens.accent : tokens.hairlineStrong,
                      },
                    ]}
                  >
                    {task.completed ? (
                      <Feather name="check" size={12} color={tokens.accentText} />
                    ) : null}
                  </TouchableOpacity>

                  <View style={styles.flex1}>
                    <View style={styles.taskTopLine}>
                      <Text
                        style={[
                          styles.taskTitle,
                          {
                            color: task.completed ? tokens.textMuted : tokens.text,
                            textDecorationLine: task.completed ? 'line-through' : 'none',
                          },
                        ]}
                      >
                        {task.title}
                      </Text>
                    </View>

                    {task.note ? (
                      <Text style={[styles.taskNote, { color: tokens.textSecondary }]}>
                        {task.note}
                      </Text>
                    ) : null}

                    <View style={styles.badgesLine}>
                      <FlatBadge
                        label={task.priority.toUpperCase()}
                        tone={getTaskPriorityTone(task.priority)}
                      />
                      {task.dueLabel ? (
                        <FlatBadge label={task.dueLabel} tone="accent" />
                      ) : null}
                      {formattedSerial ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => onOpenTicket(formattedSerial.replace(/^#/, ''))}
                          style={[
                            styles.ticketPill,
                            {
                              backgroundColor: tokens.accentSoft,
                              borderColor: tokens.accent,
                            },
                          ]}
                        >
                          <Feather name="external-link" size={10} color={tokens.accent} />
                          <Text style={[styles.ticketPillText, { color: tokens.accent }]}>
                            {formattedSerial}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                        {formatShortDateTime(task.updatedAt)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.taskActions}>
                    <BorderlessIconButton
                      name="bookmark"
                      size={16}
                      color={task.pinned ? tokens.accent : tokens.textMuted}
                      disabled={busyTaskId === task.id}
                      onPress={() => handleTogglePinned(task)}
                      accessibilityLabel={task.pinned ? 'Unpin note' : 'Pin note'}
                    />
                    <BorderlessIconButton
                      name="trash-2"
                      size={16}
                      color={tokens.danger}
                      disabled={busyTaskId === task.id}
                      onPress={() => handleDeleteTask(task.id)}
                      accessibilityLabel="Delete note"
                    />
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

export default PersonalNotesTasksScreen;

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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 18,
    borderBottomWidth: 1,
  },
  tabBtn: {
    paddingVertical: 10,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 11,
  },
  composerBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 9,
  },
  composerHeading: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  dualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  composerFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  prioRow: {
    flexDirection: 'row',
    gap: 6,
  },
  prioChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 30,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
  },
  taskNote: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 3,
  },
  badgesLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  ticketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  ticketPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 10.5,
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
