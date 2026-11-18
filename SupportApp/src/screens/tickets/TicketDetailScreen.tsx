import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { getWorkspacePreferences } from '../../services/preferencesService';
import { supportService } from '../../services/supportService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { DedicatedScreenKey } from '../../types/opsHub';
import type {
  AuthUser,
  StaffProfileMe,
  SupportAgent,
  SupportAttachment,
  SupportFeatureSwitches,
  SupportMacro,
  SupportTicket,
  TicketEvent,
  TicketReply,
} from '../../types/support';
import {
  formatShortDateTime,
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
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import { CustomerContextSheet } from './CustomerContextSheet';

interface TicketDetailScreenProps {
  ticketId: string;
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onBack: () => void;
  onOpenTicket: (ticketId: string) => void;
  onNavigateSubScreen?: (
    screen: DedicatedScreenKey,
    params?: Record<string, string | undefined>
  ) => void;
  onPulseSync?: () => void;
}

async function readPickedFileBase64(uri: string): Promise<string> {
  const fsModule = FileSystem as unknown as {
    File?: new (fileUri: string) => { base64?: () => Promise<string> };
    readAsStringAsync?: (fileUri: string, opts: { encoding: string }) => Promise<string>;
  };

  if (typeof fsModule.File === 'function') {
    const fileObj = new fsModule.File(uri);
    if (typeof fileObj.base64 === 'function') {
      return fileObj.base64();
    }
  }
  if (typeof fsModule.readAsStringAsync === 'function') {
    return fsModule.readAsStringAsync(uri, { encoding: 'base64' });
  }
  throw new Error('File reader API is unavailable on this device runtime.');
}

export const TicketDetailScreen: React.FC<TicketDetailScreenProps> = ({
  ticketId,
  user,
  staffProfile,
  onBack,
  onOpenTicket,
  onPulseSync,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketReply[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [subTickets, setSubTickets] = useState<SupportTicket[]>([]);
  const [parentTicket, setParentTicket] = useState<SupportTicket | null>(null);
  const [viewers, setViewers] = useState<{ userId: string; name: string }[]>([]);
  const [lockClosedReplies, setLockClosedReplies] = useState(false);

  const [detailTab, setDetailTab] = useState<'thread' | 'timeline'>('thread');
  const [composerText, setComposerText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const [contextVisible, setContextVisible] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [macrosVisible, setMacrosVisible] = useState(false);
  const [macros, setMacros] = useState<SupportMacro[]>([]);
  const [macroSearch, setMacroSearch] = useState('');
  const [agents, setAgents] = useState<SupportAgent[]>([]);

  const [editReplyTarget, setEditReplyTarget] = useState<TicketReply | null>(null);
  const [editReplyText, setEditReplyText] = useState('');
  const [editReplyBusy, setEditReplyBusy] = useState(false);

  const [actionMode, setActionMode] = useState<'menu' | 'subticket' | 'merge' | 'link_user'>('menu');
  const [subSubject, setSubSubject] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [linkUserInput, setLinkUserInput] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    getWorkspacePreferences()
      .then((prefs) => {
        if (prefs.defaultReplyMode === 'internal') {
          setIsInternal(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardOpen(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadDetail = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [detailRes, togglesRes] = await Promise.all([
          supportService.getTicketDetail(ticketId),
          supportService.getSupportToggles().catch(() => ({
            toggles: {} as Partial<SupportFeatureSwitches>,
          })),
        ]);
        setTicket(detailRes.ticket || null);
        setMessages(
          detailRes.messages || detailRes.ticket?.messages || detailRes.ticket?.replies || []
        );
        setEvents(detailRes.events || []);
        setSubTickets(detailRes.subTickets || []);
        setParentTicket(detailRes.parentTicket || null);
        if (detailRes.viewers) {
          setViewers(detailRes.viewers.filter((v) => v.userId !== user.id));
        }
        setLockClosedReplies(Boolean(togglesRes?.toggles?.lockClosedReplies));
      } catch (err) {
        if (!silent) {
          toast.show({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load ticket details.',
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [ticketId, toast, user.id]
  );

  useEffect(() => {
    loadDetail(false);
  }, [loadDetail]);

  useEffect(() => {
    let active = true;
    const pulse = async () => {
      try {
        const res = await supportService.recordTicketViewHeartbeat(ticketId);
        if (active && res.viewers) {
          setViewers(res.viewers.filter((v) => v.userId !== user.id));
        }
      } catch {
        // Ignore transient errors
      }
    };
    pulse();
    const timer = setInterval(pulse, 12000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [ticketId, user.id]);

  const handleAcceptAssignment = async () => {
    if (!ticket) return;
    setActionBusy(true);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.acceptTicketAssignment(ticket.id);
      onPulseSync?.();
      toast.show({ variant: 'success', label: 'Ticket accepted & locked to you.' });
      await loadDetail(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not accept assignment.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancelAssignment = async () => {
    if (!ticket) return;
    setActionBusy(true);
    try {
      stopSupportRingtone().catch(() => {});
      await supportService.cancelTicketAssignment(ticket.id);
      onPulseSync?.();
      toast.show({ variant: 'accent', label: 'Ticket dismissed from your queue.' });
      onBack();
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not dismiss ticket.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendReply = async (resolveAfter = false) => {
    if (!ticket) return;
    const text = composerText.trim();
    if (!text && attachments.length === 0) {
      toast.show({ variant: 'danger', label: 'Enter a message or attach a file.' });
      return;
    }

    setSending(true);
    try {
      const prefs = await getWorkspacePreferences();
      let outgoingText = text || '[Attachment]';
      if (
        !isInternal &&
        text &&
        prefs.autoAppendSignature &&
        prefs.signatureText.trim() &&
        !text.includes(prefs.signatureText.trim())
      ) {
        outgoingText = `${text}\n\n${prefs.signatureText.trim()}`;
      }
      await supportService.replyToTicket(ticket.id, {
        message: outgoingText,
        isInternal,
        attachments,
        nextStatus: resolveAfter && !isInternal ? 'resolved' : undefined,
      });
      setComposerText('');
      setAttachments([]);
      toast.show({
        variant: 'success',
        label: isInternal
          ? 'Internal note added.'
          : resolveAfter
            ? 'Reply sent and ticket resolved.'
            : 'Reply sent.',
      });
      await loadDetail(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Failed to send reply.',
      });
    } finally {
      setSending(false);
    }
  };

  const handlePickAttachment = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets || picked.assets.length === 0) return;

      const asset = picked.assets[0];
      setUploading(true);
      const base64 = await readPickedFileBase64(asset.uri);
      const res = await supportService.uploadAttachmentBase64({
        filename: asset.name || `attachment-${Date.now()}`,
        contentType: asset.mimeType || 'application/octet-stream',
        dataBase64: base64,
      });
      const uploaded = res.attachments || [];
      if (uploaded.length > 0) {
        setAttachments((prev) => [...prev, ...uploaded]);
        toast.show({ variant: 'success', label: `Attached ${asset.name}` });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Attachment upload failed.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAiPolish = async () => {
    if (!ticket) return;
    setAiBusy(true);
    try {
      const res = await supportService.aiAssistTicket(
        ticket.id,
        composerText.trim(),
        composerText.trim() ? 'polish_reply' : 'suggest_reply'
      );
      const suggestion = res.suggestion || res.reply || '';
      if (suggestion.trim()) {
        setComposerText(suggestion.trim());
        toast.show({ variant: 'success', label: 'AI draft prepared.' });
      } else {
        toast.show({ variant: 'accent', label: 'No suggestion generated.' });
      }
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'AI assist unavailable.',
      });
    } finally {
      setAiBusy(false);
    }
  };

  const openMacros = async () => {
    setMacrosVisible(true);
    try {
      const res = await supportService.getMacros();
      setMacros(res.macros || []);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not load macros.',
      });
    }
  };

  const insertMacro = (macro: SupportMacro) => {
    const customerName = ticket?.userName || ticket?.guestName || 'Customer';
    const serial = getTicketSerial(ticket);
    const interpolated = (macro.body || '')
      .replace(/\{\{customerName\}\}/g, customerName)
      .replace(/\{\{ticketId\}\}/g, serial)
      .replace(/\{\{agentName\}\}/g, user.name);
    setComposerText((prev) => (prev.trim() ? `${prev}\n\n${interpolated}` : interpolated));
    setMacrosVisible(false);
  };

  const openActions = async () => {
    setActionMode('menu');
    setActionsVisible(true);
    try {
      const res = await supportService.getAgents();
      setAgents(res.agents || []);
    } catch {
      // Optional
    }
  };

  const quickUpdateField = async (patch: Record<string, unknown>, label: string) => {
    if (!ticket) return;
    setActionBusy(true);
    try {
      await supportService.updateTicket(ticket.id, patch);
      toast.show({ variant: 'success', label: `${label} updated.` });
      await loadDetail(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : `Failed to update ${label}.`,
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleAssignAgent = async (agentId: string | null) => {
    if (!ticket) return;
    setActionBusy(true);
    try {
      await supportService.assignTicket(ticket.id, agentId, Boolean(agentId && agentId !== user.id));
      toast.show({ variant: 'success', label: agentId ? 'Ticket assigned.' : 'Ticket unassigned.' });
      setActionsVisible(false);
      await loadDetail(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Assignment failed.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleCreateSubTicket = async () => {
    if (!ticket || !subSubject.trim()) {
      toast.show({ variant: 'danger', label: 'Enter a subject for the sub-ticket.' });
      return;
    }
    setActionBusy(true);
    try {
      const res = await supportService.createSubTicket(ticket.id, {
        subject: subSubject.trim(),
        description: subDescription.trim() || 'Follow-up task',
        priority: ticket.priority,
        department: ticket.department,
      });
      toast.show({ variant: 'success', label: 'Sub-ticket created.' });
      setSubSubject('');
      setSubDescription('');
      setActionsVisible(false);
      await loadDetail(true);
      if (res.subTicket?.id) onOpenTicket(res.subTicket.id);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not create sub-ticket.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleMergeTicket = async () => {
    if (!ticket || !mergeTargetId.trim()) {
      toast.show({ variant: 'danger', label: 'Enter target ticket ID.' });
      return;
    }
    setActionBusy(true);
    try {
      await supportService.mergeTickets(ticket.id, mergeTargetId.trim());
      toast.show({ variant: 'success', label: 'Tickets merged.' });
      setMergeTargetId('');
      setActionsVisible(false);
      await loadDetail(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Merge failed.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleLinkUser = async () => {
    if (!ticket || !linkUserInput.trim()) {
      toast.show({ variant: 'danger', label: 'Enter customer email or user ID.' });
      return;
    }
    setActionBusy(true);
    try {
      await supportService.linkTicketUser(ticket.id, linkUserInput.trim());
      toast.show({ variant: 'success', label: 'Account linked.' });
      setLinkUserInput('');
      setActionsVisible(false);
      await loadDetail(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not link account.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveReplyEdit = async () => {
    if (!ticket || !editReplyTarget || !editReplyText.trim()) return;
    setEditReplyBusy(true);
    try {
      await supportService.editTicketReply(ticket.id, editReplyTarget.id, editReplyText.trim());
      toast.show({ variant: 'success', label: 'Reply updated.' });
      setEditReplyTarget(null);
      await loadDetail(true);
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to edit reply.',
      });
    } finally {
      setEditReplyBusy(false);
    }
  };

  if (loading || !ticket) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <View style={styles.topBar}>
          <BorderlessIconButton name="arrow-left" onPress={onBack} accessibilityLabel="Back" />
        </View>
        <MagicSpinner label="Loading conversation..." />
      </View>
    );
  }

  const sla = formatSlaBadge(ticket);
  const isClosedLocked = ticket.status === 'closed' && lockClosedReplies;
  const assignStatus = String(ticket.assignmentStatus || '').toLowerCase();
  const replyAccess = evaluateTicketReplyAccess(ticket, user, staffProfile, lockClosedReplies);
  const isPendingMyAcceptance =
    (assignStatus === 'pending' || assignStatus === 'pending_acceptance') &&
    ticket.pendingAssigneeId === user.id;
  const filteredMacros = macros.filter((m) =>
    `${m.title} ${m.category || ''} ${m.body}`.toLowerCase().includes(macroSearch.toLowerCase())
  );
  const canManageAdminOps =
    staffProfile.isSuperAdmin ||
    (staffProfile.permissions || []).some((p) => p === 'support.reply' || p === 'support.assign');

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.screen, { backgroundColor: tokens.bg }]}
    >
      {/* Borderless Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: tokens.hairline }]}>
        <BorderlessIconButton name="arrow-left" size={20} onPress={onBack} accessibilityLabel="Back" />

        <View style={styles.headerCenter}>
          <Text style={[styles.serialTitle, { color: tokens.text }]}>{getTicketSerial(ticket)}</Text>
          <View style={styles.badgePair}>
            <FlatBadge
              label={getStatusLabel(ticket.status)}
              tone={getStatusTone(ticket.status)}
              withDot
            />
            <FlatBadge
              label={ticket.priority.toUpperCase()}
              tone={getPriorityTone(ticket.priority)}
            />
          </View>
        </View>

        <View style={styles.headerActions}>
          <BorderlessIconButton
            name="user"
            size={18}
            onPress={() => setContextVisible(true)}
            accessibilityLabel="Customer 360"
          />
          <BorderlessIconButton
            name="more-horizontal"
            size={20}
            onPress={openActions}
            accessibilityLabel="Ticket actions"
          />
        </View>
      </View>

      {/* Borderless Viewer Presence Bar */}
      {viewers.length > 0 ? (
        <View style={[styles.flatStrip, { backgroundColor: tokens.accentSoft, borderBottomColor: tokens.hairline }]}>
          <View style={styles.stripRow}>
            <PulsatingDot color={tokens.accent} size={5} />
            <Text numberOfLines={1} style={[styles.stripText, { color: tokens.accent }]}>
              Viewing: {viewers.map((v) => v.name).join(', ')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Pending Acceptance Flat Banner */}
      {isPendingMyAcceptance ? (
        <View style={[styles.flatStrip, { backgroundColor: tokens.warningSoft, borderBottomColor: tokens.hairline }]}>
          <Text style={[styles.stripText, { color: tokens.warning }]}>
            Assigned to you — accept to reply
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <ShimmerButton
              label="Accept"
              size="xs"
              variant="accent"
              loading={actionBusy}
              onPress={handleAcceptAssignment}
            />
            <ShimmerButton
              label="Cancel"
              size="xs"
              variant="subtle"
              disabled={actionBusy}
              onPress={handleCancelAssignment}
            />
          </View>
        </View>
      ) : null}

      {/* Underlined Thread | Timeline Tab Strip */}
      <View style={[styles.tabRow, { borderBottomColor: tokens.hairline }]}>
        <TouchableOpacity
          onPress={() => setDetailTab('thread')}
          style={[
            styles.tabBtn,
            detailTab === 'thread' && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
          ]}
        >
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: detailTab === 'thread' ? tokens.text : tokens.textMuted }}>
            {`Conversation (${messages.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDetailTab('timeline')}
          style={[
            styles.tabBtn,
            detailTab === 'timeline' && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
          ]}
        >
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: detailTab === 'timeline' ? tokens.text : tokens.textMuted }}>
            {`Timeline (${events.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Ticket Header + Thread / Timeline */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex1}
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Flat Subject Block — Zero Card Container */}
        <View style={styles.subjectSection}>
          <Text style={[styles.subjectText, { color: tokens.text }]}>{ticket.subject}</Text>
          {ticket.description ? (
            <Text style={[styles.descText, { color: tokens.textSecondary }]}>
              {ticket.description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 }}>
            <MagicAvatar
              name={ticket.userName || ticket.guestName || 'Requester'}
              uri={resolveWebsiteUrl(ticket.userAvatar)}
              size={30}
            />
            <Text style={[styles.metaLine, { color: tokens.textMuted, marginTop: 0, flex: 1 }]}>
              {`${ticket.userName || ticket.guestName || 'Requester'} (${ticket.userEmail || ticket.guestEmail || 'No email'})`}
            </Text>
          </View>
          <View style={styles.metaBadges}>
            <Text style={[styles.slaMeta, { color: sla.breached ? tokens.danger : tokens.textMuted }]}>
              SLA: {sla.text}
            </Text>
            <Text style={[styles.slaMeta, { color: tokens.textMuted }]}>
              Owner: {ticket.assignedAgentName || 'Unassigned'}
            </Text>
          </View>

          {parentTicket ? (
            <TouchableOpacity onPress={() => onOpenTicket(parentTicket.id)} hitSlop={6}>
              <Text style={[styles.linkAction, { color: tokens.accent }]}>
                Parent Ticket {getTicketSerial(parentTicket)} →
              </Text>
            </TouchableOpacity>
          ) : null}

          {subTickets.length > 0 ? (
            <View style={styles.subLinks}>
              {subTickets.map((st) => (
                <TouchableOpacity key={st.id} onPress={() => onOpenTicket(st.id)}>
                  <FlatBadge label={`${getTicketSerial(st)}: ${st.subject}`} tone="neutral" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <Hairline strong />

        {detailTab === 'thread' ? (
          <View style={styles.threadList}>
            {messages.map((msg, idx) => {
              const isAgent = msg.senderType === 'agent' || msg.senderType === 'staff';
              const bodyText = msg.message || msg.body || '';
              const isNote = Boolean(msg.isInternal || msg.visibility === 'internal');

              return (
                <AnimatedListItem key={msg.id || idx} index={idx} staggerMs={25}>
                  <View
                    style={[
                      styles.replyBlock,
                      {
                        borderBottomColor: tokens.hairline,
                        backgroundColor: isNote
                          ? tokens.warningSoft
                          : isAgent
                            ? tokens.surfaceSubtle
                            : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.replyHeader}>
                      <View style={styles.replyAuthor}>
                        <MagicAvatar
                          name={msg.senderName || (isAgent ? 'Staff Agent' : 'Customer')}
                          uri={resolveWebsiteUrl(msg.senderAvatar || (!isAgent ? ticket.userAvatar : null))}
                          size={22}
                        />
                        <Text style={[styles.authorName, { color: tokens.text }]}>
                          {msg.senderName || (isAgent ? 'Staff Agent' : 'Customer')}
                        </Text>
                        {isNote ? <FlatBadge label="Internal" tone="warning" /> : null}
                        {msg.editHistory && msg.editHistory.length > 0 ? (
                          <Text style={[styles.editedLabel, { color: tokens.textMuted }]}>(edited)</Text>
                        ) : null}
                      </View>

                      <View style={styles.replyMetaRight}>
                        <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                          {formatShortDateTime(msg.createdAt)}
                        </Text>
                        {isAgent && canManageAdminOps && !isClosedLocked ? (
                          <BorderlessIconButton
                            name="edit-2"
                            size={13}
                            color={tokens.textMuted}
                            onPress={() => {
                              setEditReplyTarget(msg);
                              setEditReplyText(bodyText);
                            }}
                            accessibilityLabel="Edit reply"
                          />
                        ) : null}
                      </View>
                    </View>

                    <Text style={[styles.replyText, { color: tokens.text }]}>{bodyText}</Text>

                    {(msg.attachments || []).length > 0 ? (
                      <View style={styles.attachList}>
                        {(msg.attachments || []).map((att, aIdx) => (
                          <TouchableOpacity
                            key={att.id || aIdx}
                            style={[styles.attachRow, { backgroundColor: tokens.surfaceMuted }]}
                            onPress={() => {
                              if (att.url) Linking.openURL(resolveWebsiteUrl(att.url)).catch(() => {});
                            }}
                          >
                            <Feather name="paperclip" size={12} color={tokens.accent} />
                            <Text style={[styles.attachName, { color: tokens.accent }]}>
                              {att.filename || 'Attachment'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </AnimatedListItem>
              );
            })}
          </View>
        ) : (
          <View style={styles.timelineList}>
            {events.map((ev, idx) => (
              <AnimatedListItem key={ev.id || idx} index={idx} staggerMs={25}>
                <View style={[styles.eventRow, { borderBottomColor: tokens.hairline }]}>
                  <View style={[styles.eventDot, { backgroundColor: tokens.accent }]} />
                  <View style={styles.flex1}>
                    <Text style={[styles.eventTitle, { color: tokens.text }]}>
                      {ev.eventType.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    {ev.description ? (
                      <Text style={[styles.eventDesc, { color: tokens.textSecondary }]}>
                        {ev.description}
                      </Text>
                    ) : null}
                    <Text style={[styles.timeText, { color: tokens.textMuted }]}>
                      {`${ev.actorName || 'System'} · ${formatShortDateTime(ev.createdAt)}`}
                    </Text>
                  </View>
                </View>
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Keyboard-Lifted Composer Bar OR Disabled "Unable to Reply" Box */}
      {!replyAccess.canReply ? (
        <View
          style={[
            styles.composerDock,
            {
              backgroundColor: tokens.bg,
              borderTopColor: tokens.hairlineStrong,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {replyAccess.requiresAccept ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: tokens.textSecondary }}>
                Accept this ticket to claim ownership & unlock composer
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <ShimmerButton
                  label="Accept"
                  size="xs"
                  variant="accent"
                  loading={actionBusy}
                  onPress={handleAcceptAssignment}
                />
                <ShimmerButton
                  label="Cancel"
                  size="xs"
                  variant="subtle"
                  disabled={actionBusy}
                  onPress={handleCancelAssignment}
                />
              </View>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 40,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: tokens.hairlineStrong,
              backgroundColor: tokens.surfaceMuted,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: 0.88,
            }}
          >
            <Feather name="slash" size={14} color={tokens.danger} />
            <Text
              numberOfLines={2}
              style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: tokens.textMuted }}
            >
              {replyAccess.unableReason || 'Unable to reply to this ticket.'}
            </Text>
            <FlatBadge label="Unable" tone="danger" />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.composerDock,
            {
              backgroundColor: tokens.bg,
              borderTopColor: tokens.hairlineStrong,
              paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 10),
            },
          ]}
        >
          {/* Compact Inline Tool Row */}
          <View style={styles.composerToolRow}>
            <View style={styles.modeSwitchRow}>
              <TouchableOpacity
                onPress={() => setIsInternal(false)}
                style={[
                  styles.modeTab,
                  { backgroundColor: !isInternal ? tokens.accentSoft : 'transparent' },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: !isInternal ? tokens.accent : tokens.textMuted }}>
                  Public Reply
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsInternal(true)}
                style={[
                  styles.modeTab,
                  { backgroundColor: isInternal ? tokens.warningSoft : 'transparent' },
                ]}
              >
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: isInternal ? tokens.warning : tokens.textMuted }}>
                  Internal Note
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rightTools}>
              <BorderlessIconButton
                name="edit-3"
                size={15}
                onPress={async () => {
                  const prefs = await getWorkspacePreferences();
                  if (prefs.signatureText.trim()) {
                    setComposerText((prev) =>
                      prev.trim()
                        ? `${prev.trim()}\n\n${prefs.signatureText.trim()}`
                        : prefs.signatureText.trim()
                    );
                  }
                }}
                accessibilityLabel="Insert signature"
              />
              <BorderlessIconButton
                name="zap"
                size={16}
                onPress={openMacros}
                accessibilityLabel="Insert macro"
              />
              <TouchableOpacity
                onPress={handleAiPolish}
                disabled={aiBusy}
                hitSlop={6}
                accessibilityLabel="AI Polish"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: aiBusy ? 0.55 : 1 }}
              >
                <Feather name="cpu" size={15} color={tokens.accent} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: tokens.accent }}>
                  {aiBusy ? 'AI...' : composerText.trim() ? 'Polish AI' : 'AI Draft'}
                </Text>
              </TouchableOpacity>
              <BorderlessIconButton
                name="paperclip"
                size={16}
                disabled={uploading}
                onPress={handlePickAttachment}
                accessibilityLabel="Attach file"
              />
            </View>
          </View>

          {attachments.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.draftAttachRow}>
              {attachments.map((att, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  style={[styles.draftAttachChip, { backgroundColor: tokens.surfaceMuted }]}
                >
                  <Text style={{ fontSize: 11, color: tokens.text }}>
                    {att.filename || 'File'} ×
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              value={composerText}
              onChangeText={setComposerText}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 140);
              }}
              placeholder={isInternal ? 'Write internal staff note...' : 'Write customer reply...'}
              placeholderTextColor={tokens.textMuted}
              multiline
              style={[
                styles.composerInput,
                {
                  color: tokens.text,
                  backgroundColor: isInternal ? tokens.warningSoft : tokens.surfaceSubtle,
                  borderWidth: 1,
                  borderColor: tokens.hairlineStrong,
                },
              ]}
            />
            {!isInternal ? (
              <ShimmerButton
                label="Resolve"
                size="xs"
                variant="subtle"
                disabled={sending || (!composerText.trim() && attachments.length === 0)}
                onPress={() => handleSendReply(true)}
              />
            ) : null}
            <ShimmerButton
              label={isInternal ? 'Note' : 'Send'}
              size="sm"
              variant={isInternal ? 'primary' : 'accent'}
              loading={sending}
              disabled={!composerText.trim() && attachments.length === 0}
              onPress={() => handleSendReply(false)}
            />
          </View>
        </View>
      )}

      {/* Customer 360 Context */}
      <CustomerContextSheet
        visible={contextVisible}
        ticketId={ticket.id}
        customerLabel={ticket.userName || ticket.guestName || ticket.userEmail || undefined}
        onClose={() => setContextVisible(false)}
      />

      {/* Ticket Actions Modal */}
      <MagicModalSheet
        visible={actionsVisible}
        onClose={() => setActionsVisible(false)}
        title={
          actionMode === 'menu'
            ? 'Ticket Controls'
            : actionMode === 'subticket'
              ? 'Create Sub-Ticket'
              : actionMode === 'merge'
                ? 'Merge Into Ticket'
                : 'Link Registered Account'
        }
      >
        {actionMode === 'menu' ? (
          <View style={styles.modalStack}>
            <Text style={[styles.secHeading, { color: tokens.textSecondary }]}>STATUS</Text>
            <View style={styles.chipWrap}>
              {['open', 'in_progress', 'waiting_customer', 'escalated', 'resolved', 'closed'].map((st) => {
                const active = ticket.status === st;
                return (
                  <TouchableOpacity
                    key={st}
                    onPress={() => quickUpdateField({ status: st }, 'Status')}
                    style={[
                      styles.optChip,
                      { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                      {getStatusLabel(st)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.secHeading, { color: tokens.textSecondary }]}>PRIORITY</Text>
            <View style={styles.chipWrap}>
              {['low', 'medium', 'high', 'urgent'].map((pr) => {
                const active = ticket.priority === pr;
                return (
                  <TouchableOpacity
                    key={pr}
                    onPress={() => quickUpdateField({ priority: pr }, 'Priority')}
                    style={[
                      styles.optChip,
                      { backgroundColor: active ? tokens.accentSoft : tokens.surfaceMuted },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: active ? tokens.accent : tokens.textMuted }}>
                      {pr.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.secHeading, { color: tokens.textSecondary }]}>ASSIGN AGENT</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                onPress={() => handleAssignAgent(null)}
                style={[
                  styles.optChip,
                  { backgroundColor: !ticket.assignedAgentId ? tokens.accentSoft : tokens.surfaceMuted },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: !ticket.assignedAgentId ? tokens.accent : tokens.textMuted }}>
                  Unassign
                </Text>
              </TouchableOpacity>
              {agents.map((ag) => {
                const active = ticket.assignedAgentId === ag.id;
                return (
                  <TouchableOpacity
                    key={ag.id}
                    onPress={() => handleAssignAgent(ag.id)}
                    style={[
                      styles.optChip,
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

            <Hairline />

            <TouchableOpacity style={[styles.menuRow, { borderBottomColor: tokens.hairline }]} onPress={() => setActionMode('subticket')}>
              <Feather name="git-branch" size={16} color={tokens.text} />
              <Text style={[styles.menuRowText, { color: tokens.text }]}>Create Linked Sub-Ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuRow, { borderBottomColor: tokens.hairline }]} onPress={() => setActionMode('merge')}>
              <Feather name="git-merge" size={16} color={tokens.text} />
              <Text style={[styles.menuRowText, { color: tokens.text }]}>Merge Into Another Ticket</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => setActionMode('link_user')}>
              <Feather name="user-plus" size={16} color={tokens.text} />
              <Text style={[styles.menuRowText, { color: tokens.text }]}>Link Registered Customer</Text>
            </TouchableOpacity>
          </View>
        ) : actionMode === 'subticket' ? (
          <View style={styles.modalStack}>
            <FlatInput label="Subject" value={subSubject} onChangeText={setSubSubject} placeholder="Sub-ticket title..." />
            <FlatInput label="Description" value={subDescription} onChangeText={setSubDescription} placeholder="Details..." multiline />
            <View style={styles.modalFoot}>
              <TouchableOpacity onPress={() => setActionMode('menu')}>
                <Text style={{ fontSize: 13, color: tokens.textMuted }}>Back</Text>
              </TouchableOpacity>
              <ShimmerButton label="Create Sub-Ticket" size="sm" loading={actionBusy} onPress={handleCreateSubTicket} />
            </View>
          </View>
        ) : actionMode === 'merge' ? (
          <View style={styles.modalStack}>
            <FlatInput label="Target Ticket ID or Serial" value={mergeTargetId} onChangeText={setMergeTargetId} placeholder="TWTK-..." />
            <View style={styles.modalFoot}>
              <TouchableOpacity onPress={() => setActionMode('menu')}>
                <Text style={{ fontSize: 13, color: tokens.textMuted }}>Back</Text>
              </TouchableOpacity>
              <ShimmerButton label="Merge Ticket" size="sm" variant="danger" loading={actionBusy} onPress={handleMergeTicket} />
            </View>
          </View>
        ) : (
          <View style={styles.modalStack}>
            <FlatInput label="Customer Email or ID" value={linkUserInput} onChangeText={setLinkUserInput} placeholder="customer@email.com" />
            <View style={styles.modalFoot}>
              <TouchableOpacity onPress={() => setActionMode('menu')}>
                <Text style={{ fontSize: 13, color: tokens.textMuted }}>Back</Text>
              </TouchableOpacity>
              <ShimmerButton label="Link Account" size="sm" loading={actionBusy} onPress={handleLinkUser} />
            </View>
          </View>
        )}
      </MagicModalSheet>

      {/* Macros Modal */}
      <MagicModalSheet
        visible={macrosVisible}
        onClose={() => setMacrosVisible(false)}
        title="Macros Library"
        subtitle="Variables automatically populate customer & ticket values"
      >
        <FlatInput placeholder="Search macros..." value={macroSearch} onChangeText={setMacroSearch} />
        {filteredMacros.map((m) => (
          <TouchableOpacity
            key={m.id}
            onPress={() => insertMacro(m)}
            style={[styles.macroRow, { borderBottomColor: tokens.hairline }]}
          >
            <View style={styles.macroHead}>
              <Text style={[styles.macroTitle, { color: tokens.text }]}>{m.title}</Text>
              {m.category ? <FlatBadge label={m.category} tone="neutral" /> : null}
            </View>
            <Text numberOfLines={2} style={[styles.macroBody, { color: tokens.textMuted }]}>
              {m.body}
            </Text>
          </TouchableOpacity>
        ))}
      </MagicModalSheet>

      {/* Edit Reply Modal */}
      <MagicModalSheet
        visible={Boolean(editReplyTarget)}
        onClose={() => setEditReplyTarget(null)}
        title="Edit Reply"
      >
        <FlatInput label="Updated Message" value={editReplyText} onChangeText={setEditReplyText} multiline />
        <View style={styles.modalFoot}>
          <TouchableOpacity onPress={() => setEditReplyTarget(null)}>
            <Text style={{ fontSize: 13, color: tokens.textMuted }}>Cancel</Text>
          </TouchableOpacity>
          <ShimmerButton label="Save Edit" size="sm" loading={editReplyBusy} onPress={handleSaveReplyEdit} />
        </View>
      </MagicModalSheet>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerCenter: { flex: 1, gap: 3 },
  serialTitle: { fontSize: 14.5, fontWeight: '700' },
  badgePair: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flatStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  stripRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  stripText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 20,
    borderBottomWidth: 1,
  },
  tabBtn: { paddingVertical: 9 },
  scrollBody: { paddingBottom: 20 },
  subjectSection: { paddingHorizontal: 18, paddingVertical: 14, gap: 6 },
  subjectText: { fontSize: 16.5, fontWeight: '700', lineHeight: 22 },
  descText: { fontSize: 13.5, lineHeight: 20 },
  metaLine: { fontSize: 12, marginTop: 2 },
  metaBadges: { flexDirection: 'row', gap: 14, marginTop: 2 },
  slaMeta: { fontSize: 11.5, fontWeight: '600' },
  linkAction: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  subLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  threadList: {},
  replyBlock: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  replyAuthor: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  authorName: { fontSize: 13, fontWeight: '700' },
  editedLabel: { fontSize: 10.5 },
  replyMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { fontSize: 11 },
  replyText: { fontSize: 13.5, lineHeight: 20 },
  attachList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  attachName: { fontSize: 11.5, fontWeight: '600' },
  timelineList: { paddingHorizontal: 18 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  eventDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 5 },
  eventTitle: { fontSize: 11.5, fontWeight: '700' },
  eventDesc: { fontSize: 12.5, marginTop: 2 },
  closedDock: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 10 },
  composerDock: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 7,
  },
  composerToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeSwitchRow: { flexDirection: 'row', gap: 6 },
  modeTab: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  rightTools: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  draftAttachRow: { gap: 6, paddingBottom: 2 },
  draftAttachChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 104,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
  },
  modalStack: { gap: 12 },
  secHeading: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  optChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  menuRowText: { fontSize: 13.5, fontWeight: '600' },
  modalFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  macroRow: { paddingVertical: 10, borderBottomWidth: 1, gap: 3 },
  macroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  macroTitle: { fontSize: 13.5, fontWeight: '600' },
  macroBody: { fontSize: 12 },
});
