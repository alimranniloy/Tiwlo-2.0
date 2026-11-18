import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { stopSupportRingtone } from '../../services/notificationService';
import { opsHubService } from '../../services/opsHubService';
import { supportService } from '../../services/supportService';
import { getTonePalette, useAppTheme } from '../../theme/ThemeContext';
import type { QuickPeekResponse, ReplyEligibility } from '../../types/opsHub';
import type {
  AuthUser,
  LiveChatMessage,
  LiveChatSession,
  StaffProfileMe,
  SupportTicket,
  TicketReply,
} from '../../types/support';
import {
  formatRelativeTime,
  formatShortDateTime,
  formatSlaBadge,
  getPriorityTone,
  getStatusLabel,
  getStatusTone,
  getTicketSerial,
} from '../../utils/formatters';
import {
  evaluateLiveChatReplyAccess,
  evaluateTicketReplyAccess,
} from '../../utils/replyGuard';
import {
  FlatBadge,
  Hairline,
  MagicAvatar,
  MagicModalSheet,
  MagicSpinner,
  PulsatingDot,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

export interface QuickPeekModalProps {
  visible: boolean;
  kind: 'ticket' | 'livechat';
  targetId: string | null;
  initialTicket?: SupportTicket | null;
  initialChat?: LiveChatSession | null;
  user: AuthUser;
  staffProfile: StaffProfileMe;
  onClose: () => void;
  onOpenFull: (kind: 'ticket' | 'livechat', id: string) => void;
  onChanged?: () => void;
}

function formatUnableReason(reason: string | null | undefined): string {
  const clean = String(reason || '').trim();
  if (!clean) return 'Unable to reply — Composer is currently locked.';
  if (/^unable to reply/i.test(clean)) return clean;
  return `Unable to reply — ${clean}`;
}

function getPreviewBody(msg: TicketReply | LiveChatMessage): string {
  if ('body' in msg && typeof msg.body === 'string' && msg.body.trim()) {
    return msg.body.trim();
  }
  if ('message' in msg && typeof msg.message === 'string' && msg.message.trim()) {
    return msg.message.trim();
  }
  return '(Attachment or event)';
}

function getSenderRoleBadge(msg: TicketReply | LiveChatMessage): {
  label: string;
  isInternal: boolean;
  isStaff: boolean;
} {
  const internal = 'isInternal' in msg && Boolean(msg.isInternal);
  const rawType = String(msg.senderType || '').toLowerCase();
  const isStaff = rawType === 'agent' || rawType === 'staff' || rawType === 'admin';
  if (internal) return { label: 'Internal Note', isInternal: true, isStaff: true };
  if (rawType === 'ai') return { label: 'AI Copilot', isInternal: false, isStaff: true };
  if (rawType === 'system') return { label: 'System', isInternal: false, isStaff: false };
  if (isStaff) return { label: 'Staff', isInternal: false, isStaff: true };
  return { label: 'Customer', isInternal: false, isStaff: false };
}

export const QuickPeekModal: React.FC<QuickPeekModalProps> = ({
  visible,
  kind,
  targetId,
  initialTicket = null,
  initialChat = null,
  user,
  staffProfile,
  onClose,
  onOpenFull,
  onChanged,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [loading, setLoading] = useState(false);
  const [peekData, setPeekData] = useState<QuickPeekResponse | null>(null);
  const [actionBusy, setActionBusy] = useState<'accept' | 'cancel' | null>(null);

  const loadPeek = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const res = await opsHubService.quickPeek(kind, targetId);
      setPeekData(res);
    } catch {
      setPeekData(null);
    } finally {
      setLoading(false);
    }
  }, [kind, targetId]);

  useEffect(() => {
    if (visible && targetId) {
      setPeekData(null);
      loadPeek();
    } else {
      setPeekData(null);
      setLoading(false);
      setActionBusy(null);
    }
  }, [loadPeek, targetId, visible]);

  const activeTicket = peekData?.ticket ?? initialTicket;
  const activeChat = peekData?.chat ?? initialChat;

  const eligibility = useMemo<ReplyEligibility>(() => {
    const localEval: ReplyEligibility =
      kind === 'ticket' && activeTicket
        ? evaluateTicketReplyAccess(activeTicket, user, staffProfile)
        : kind === 'livechat' && activeChat
          ? evaluateLiveChatReplyAccess(activeChat, user, staffProfile)
          : {
              canReply: false,
              requiresAccept: false,
              unableReason: 'Unable to reply — Loading conversation state.',
              shortStatusLabel: 'Checking...',
              tone: 'neutral',
            };

    if (!peekData?.replyAccess) {
      return localEval;
    }

    const srv = peekData.replyAccess;
    if (srv.canReply) {
      return {
        canReply: true,
        requiresAccept: false,
        unableReason: null,
        shortStatusLabel: 'Ready to Reply',
        tone: 'success',
      };
    }

    if (srv.requiresAccept) {
      return {
        canReply: false,
        requiresAccept: true,
        unableReason: formatUnableReason(
          srv.unableReason || localEval.unableReason || 'Accept first to unlock composer.'
        ),
        shortStatusLabel: 'Accept to Reply',
        tone: 'warning',
      };
    }

    return {
      canReply: false,
      requiresAccept: false,
      unableReason: formatUnableReason(srv.unableReason || localEval.unableReason),
      shortStatusLabel: localEval.canReply ? 'Unable · Locked' : localEval.shortStatusLabel,
      tone: localEval.tone === 'neutral' ? 'neutral' : 'danger',
    };
  }, [activeChat, activeTicket, kind, peekData?.replyAccess, staffProfile, user]);

  const recentPreviewMessages = useMemo<(TicketReply | LiveChatMessage)[]>(() => {
    if (peekData?.recentMessages && peekData.recentMessages.length > 0) {
      return peekData.recentMessages.slice(-4);
    }
    if (kind === 'ticket' && activeTicket) {
      const list = activeTicket.messages || activeTicket.replies || [];
      if (list.length > 0) return list.slice(-4);
      if (activeTicket.description || activeTicket.lastMessage) {
        return [
          {
            id: 'initial-preview',
            body: activeTicket.lastMessage || activeTicket.description || '',
            senderType: 'customer',
            senderName: activeTicket.userName || activeTicket.guestName || 'Customer',
            createdAt: activeTicket.updatedAt || activeTicket.createdAt,
          },
        ];
      }
    }
    if (kind === 'livechat' && activeChat?.lastMessage) {
      return [
        {
          id: 'chat-last-preview',
          body: activeChat.lastMessage,
          senderType: 'visitor',
          senderName: activeChat.guestName || 'Visitor',
          createdAt: activeChat.lastMessageAt || activeChat.createdAt || new Date().toISOString(),
        },
      ];
    }
    return [];
  }, [activeChat, activeTicket, kind, peekData?.recentMessages]);

  const customerName =
    kind === 'ticket'
      ? activeTicket?.userName || activeTicket?.guestName || 'Customer'
      : activeChat?.guestName || 'Live Visitor';

  const customerEmail =
    kind === 'ticket'
      ? activeTicket?.userEmail || activeTicket?.guestEmail || 'No email on file'
      : activeChat?.guestEmail || activeChat?.guestPhone || 'Live web session';

  const avatarUrl = resolveWebsiteUrl(
    kind === 'ticket' ? activeTicket?.userAvatar : activeChat?.userAvatar
  );

  const identifierLabel =
    kind === 'ticket'
      ? getTicketSerial(activeTicket)
      : activeChat?.chatNumber || (targetId ? `#${targetId.slice(0, 8)}` : '#CHAT');

  const headline =
    kind === 'ticket'
      ? activeTicket?.subject || 'Support Ticket'
      : activeChat?.topic || 'Live Chat Request';

  const statusRaw = kind === 'ticket' ? activeTicket?.status : activeChat?.status;
  const priorityRaw = kind === 'ticket' ? activeTicket?.priority : undefined;
  const slaInfo = kind === 'ticket' && activeTicket ? formatSlaBadge(activeTicket) : null;

  const stripTone = eligibility.canReply
    ? 'success'
    : eligibility.requiresAccept
      ? 'warning'
      : eligibility.tone === 'neutral'
        ? 'warning'
        : 'danger';
  const stripPalette = getTonePalette(tokens, stripTone);

  const handleAcceptAndOpen = async () => {
    if (!targetId) return;
    setActionBusy('accept');
    try {
      await stopSupportRingtone();
      if (kind === 'ticket') {
        await supportService.acceptTicketAssignment(targetId);
      } else {
        await supportService.acceptLiveChat(targetId);
      }
      showToast({
        variant: 'success',
        label: kind === 'ticket' ? 'Ticket accepted. Composer unlocked.' : 'Live chat claimed.',
      });
      onChanged?.();
      onClose();
      onOpenFull(kind, targetId);
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Could not accept conversation.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleDismissCancel = async () => {
    if (!targetId) return;
    setActionBusy('cancel');
    try {
      await stopSupportRingtone();
      if (kind === 'ticket') {
        await supportService.cancelTicketAssignment(targetId);
      } else {
        await supportService.cancelLiveChat(targetId);
      }
      showToast({
        variant: 'default',
        label: kind === 'ticket' ? 'Ticket alert dismissed.' : 'Live chat dismissed.',
      });
      onChanged?.();
      onClose();
    } catch (err) {
      showToast({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to dismiss item.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleOpenConversation = () => {
    if (!targetId) return;
    stopSupportRingtone().catch(() => {});
    onClose();
    onOpenFull(kind, targetId);
  };

  return (
    <MagicModalSheet
      visible={visible}
      onClose={onClose}
      title={`Quick Peek · ${identifierLabel}`}
      subtitle={kind === 'ticket' ? 'Pre-click ticket inspector' : 'Pre-click live chat inspector'}
      maxHeightPercent="88%"
    >
      {/* Customer Identity Row */}
      <View style={styles.customerRow}>
        <MagicAvatar
          name={customerName}
          uri={avatarUrl}
          size={42}
          online={kind === 'livechat' && (statusRaw === 'waiting' || statusRaw === 'active')}
        />
        <View style={styles.customerMeta}>
          <View style={styles.nameBadgeRow}>
            <Text numberOfLines={1} style={[styles.customerName, { color: tokens.text }]}>
              {customerName}
            </Text>
            <FlatBadge
              label={kind === 'ticket' ? 'Ticket' : 'Live Chat'}
              tone={kind === 'livechat' ? 'accent' : 'neutral'}
            />
          </View>
          <Text numberOfLines={1} style={[styles.customerEmail, { color: tokens.textMuted }]}>
            {customerEmail}
          </Text>
        </View>
      </View>

      {/* Status, Priority & SLA Badges */}
      <View style={styles.badgesWrap}>
        <FlatBadge label={identifierLabel} tone="neutral" />
        {statusRaw ? (
          <FlatBadge label={getStatusLabel(statusRaw)} tone={getStatusTone(statusRaw)} withDot />
        ) : null}
        {priorityRaw ? (
          <FlatBadge label={getStatusLabel(priorityRaw)} tone={getPriorityTone(priorityRaw)} />
        ) : null}
        {slaInfo ? (
          <FlatBadge label={slaInfo.text} tone={slaInfo.breached ? 'danger' : 'neutral'} />
        ) : null}
        {kind === 'ticket' && activeTicket?.assignedAgentName ? (
          <FlatBadge label={`Owner: ${activeTicket.assignedAgentName}`} tone="neutral" />
        ) : null}
        {kind === 'livechat' && activeChat?.assignedAgentName ? (
          <FlatBadge label={`Agent: ${activeChat.assignedAgentName}`} tone="neutral" />
        ) : null}
      </View>

      {/* Subject / Topic */}
      <Text style={[styles.subjectTitle, { color: tokens.text }]}>{headline}</Text>

      {/* Prominent Pre-Click Reply Eligibility Strip */}
      <View
        style={[
          styles.eligibilityStrip,
          {
            backgroundColor: stripPalette.bg,
            borderColor: stripPalette.fg,
          },
        ]}
      >
        <View style={styles.eligibilityHeader}>
          {eligibility.canReply ? (
            <PulsatingDot color={tokens.success} size={7} active />
          ) : (
            <Feather
              name={eligibility.requiresAccept ? 'unlock' : 'lock'}
              size={14}
              color={stripPalette.fg}
            />
          )}
          <Text style={[styles.eligibilityHeadline, { color: stripPalette.fg }]}>
            {eligibility.canReply
              ? 'Ready to Reply'
              : formatUnableReason(eligibility.unableReason)}
          </Text>
        </View>
        <Text style={[styles.eligibilityHint, { color: tokens.textSecondary }]}>
          {eligibility.canReply
            ? 'You own or have full reply access to this conversation.'
            : eligibility.requiresAccept
              ? 'Accept below to claim ownership, silence alerts, and unlock the reply composer.'
              : 'Opening this room will launch in read-only inspection mode.'}
        </Text>
      </View>

      <Hairline />

      {/* Recent 4 Messages Preview */}
      <View style={styles.previewSection}>
        <View style={styles.previewHeaderRow}>
          <Text style={[styles.sectionLabel, { color: tokens.textMuted }]}>
            RECENT MESSAGES PREVIEW
          </Text>
          <Text style={[styles.previewCount, { color: tokens.textMuted }]}>
            {loading ? 'Syncing...' : `Last ${recentPreviewMessages.length}`}
          </Text>
        </View>

        {loading && recentPreviewMessages.length === 0 ? (
          <MagicSpinner label="Loading recent thread..." />
        ) : recentPreviewMessages.length === 0 ? (
          <Text style={[styles.emptyPreview, { color: tokens.textMuted }]}>
            No messages posted yet.
          </Text>
        ) : (
          <View
            style={[
              styles.messagesBox,
              {
                backgroundColor: tokens.surfaceSubtle,
                borderColor: tokens.hairlineStrong,
              },
            ]}
          >
            {recentPreviewMessages.map((msg, idx) => {
              const roleMeta = getSenderRoleBadge(msg);
              const sender =
                msg.senderName || (roleMeta.isStaff ? 'Support Specialist' : customerName);
              const timeStr =
                formatRelativeTime(msg.createdAt) || formatShortDateTime(msg.createdAt);

              return (
                <React.Fragment key={msg.id || `msg-${idx}`}>
                  {idx > 0 ? <Hairline /> : null}
                  <View style={styles.messageRow}>
                    <View style={styles.messageMetaRow}>
                      <View style={styles.senderRow}>
                        <Text
                          numberOfLines={1}
                          style={[styles.senderName, { color: tokens.text }]}
                        >
                          {sender}
                        </Text>
                        <FlatBadge
                          label={roleMeta.label}
                          tone={
                            roleMeta.isInternal
                              ? 'warning'
                              : roleMeta.isStaff
                                ? 'accent'
                                : 'neutral'
                          }
                        />
                      </View>
                      <Text style={[styles.msgTime, { color: tokens.textMuted }]}>{timeStr}</Text>
                    </View>
                    <Text
                      numberOfLines={3}
                      style={[styles.messageBody, { color: tokens.textSecondary }]}
                    >
                      {getPreviewBody(msg)}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        )}
      </View>

      <Hairline />

      {/* Action Footer */}
      {eligibility.requiresAccept ? (
        <View style={styles.footerRow}>
          <ShimmerButton
            label="Cancel (Dismiss)"
            variant="subtle"
            size="sm"
            loading={actionBusy === 'cancel'}
            disabled={actionBusy !== null}
            leftIcon={<Feather name="x" size={13} color={tokens.text} />}
            onPress={handleDismissCancel}
          />
          <View style={styles.footerRightGroup}>
            <TouchableOpacity
              onPress={handleOpenConversation}
              disabled={actionBusy !== null}
              hitSlop={8}
            >
              <Text style={[styles.readOnlyLink, { color: tokens.textMuted }]}>View Only</Text>
            </TouchableOpacity>
            <ShimmerButton
              label="Accept & Open"
              variant="accent"
              size="sm"
              loading={actionBusy === 'accept'}
              disabled={actionBusy !== null}
              leftIcon={<Feather name="check" size={14} color={tokens.accentText} />}
              onPress={handleAcceptAndOpen}
            />
          </View>
        </View>
      ) : (
        <View style={styles.footerRow}>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={[styles.closeLink, { color: tokens.textMuted }]}>Close Preview</Text>
          </TouchableOpacity>
          <ShimmerButton
            label="Open Conversation"
            variant={eligibility.canReply ? 'accent' : 'primary'}
            size="sm"
            rightIcon={
              <Feather
                name="arrow-up-right"
                size={14}
                color={eligibility.canReply ? tokens.accentText : tokens.inkButtonText}
              />
            }
            onPress={handleOpenConversation}
          />
        </View>
      )}
    </MagicModalSheet>
  );
};

const styles = StyleSheet.create({
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customerMeta: {
    flex: 1,
    gap: 2,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  customerEmail: {
    fontSize: 12,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subjectTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  eligibilityStrip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  eligibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eligibilityHeadline: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  eligibilityHint: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  previewSection: {
    gap: 8,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  previewCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyPreview: {
    fontSize: 12.5,
    paddingVertical: 14,
    textAlign: 'center',
  },
  messagesBox: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageRow: {
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 4,
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  msgTime: {
    fontSize: 10.5,
  },
  messageBody: {
    fontSize: 12.5,
    lineHeight: 17.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 4,
  },
  footerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readOnlyLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeLink: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
