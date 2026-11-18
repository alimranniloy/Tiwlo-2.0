import type { ReplyEligibility } from '../types/opsHub';
import type { AuthUser, LiveChatSession, StaffProfileMe, SupportTicket } from '../types/support';

export function hasReplyPermission(staffProfile?: StaffProfileMe | null): boolean {
  if (!staffProfile) return false;
  if (staffProfile.isSuperAdmin) return true;
  const perms = staffProfile.permissions || [];
  if (perms.length === 0) return true;
  return perms.includes('support.reply');
}

export function evaluateTicketReplyAccess(
  ticket: SupportTicket,
  user: AuthUser,
  staffProfile?: StaffProfileMe | null,
  lockClosedReplies = true
): ReplyEligibility {
  const status = String(ticket.status || '').toLowerCase();
  const assignStatus = String(ticket.assignmentStatus || '').toLowerCase();
  const isAccepted = assignStatus === 'accepted' && Boolean(ticket.assignedAgentId);
  const isMine = Boolean(ticket.assignedAgentId && String(ticket.assignedAgentId) === String(user.id));

  if (status === 'closed' && lockClosedReplies) {
    return {
      canReply: false,
      requiresAccept: false,
      unableReason: 'Unable to reply — This ticket is permanently closed.',
      shortStatusLabel: 'Unable · Closed',
      tone: 'neutral',
    };
  }

  if (!hasReplyPermission(staffProfile)) {
    return {
      canReply: false,
      requiresAccept: false,
      unableReason: 'Unable to reply — Your staff role has read-only access.',
      shortStatusLabel: 'Unable · Read-Only',
      tone: 'danger',
    };
  }

  if (status !== 'closed' && status !== 'resolved') {
    if (isAccepted && !isMine) {
      return {
        canReply: false,
        requiresAccept: false,
        unableReason: `Unable to reply — Locked by ${ticket.assignedAgentName || 'another specialist'}.`,
        shortStatusLabel: `Unable · ${ticket.assignedAgentName || 'Locked'}`,
        tone: 'warning',
      };
    }

    if (!isAccepted || !isMine) {
      return {
        canReply: false,
        requiresAccept: true,
        unableReason: 'Unable to reply — Accept this ticket first to unlock composer.',
        shortStatusLabel: 'Accept to Reply',
        tone: 'warning',
      };
    }
  }

  return {
    canReply: true,
    requiresAccept: false,
    unableReason: null,
    shortStatusLabel: 'Can Reply',
    tone: 'success',
  };
}

export function evaluateLiveChatReplyAccess(
  chat: LiveChatSession,
  user: AuthUser,
  staffProfile?: StaffProfileMe | null
): ReplyEligibility {
  const status = String(chat.status || '').toLowerCase();
  const isMine = Boolean(chat.assignedAgentId && String(chat.assignedAgentId) === String(user.id));

  if (status === 'closed' || status === 'cancelled') {
    return {
      canReply: false,
      requiresAccept: false,
      unableReason: 'Unable to reply — This live chat session has ended.',
      shortStatusLabel: 'Unable · Closed',
      tone: 'neutral',
    };
  }

  if (!hasReplyPermission(staffProfile)) {
    return {
      canReply: false,
      requiresAccept: false,
      unableReason: 'Unable to reply — Your staff role has read-only access.',
      shortStatusLabel: 'Unable · Read-Only',
      tone: 'danger',
    };
  }

  if (status === 'active' && !isMine) {
    return {
      canReply: false,
      requiresAccept: false,
      unableReason: `Unable to reply — Actively handled by ${chat.assignedAgentName || 'another specialist'}.`,
      shortStatusLabel: `Unable · ${chat.assignedAgentName || 'Active'}`,
      tone: 'warning',
    };
  }

  if (status === 'waiting' || status === 'on_hold' || !isMine) {
    return {
      canReply: false,
      requiresAccept: true,
      unableReason: 'Unable to reply — Accept this live chat first to claim & reply.',
      shortStatusLabel: 'Accept to Reply',
      tone: 'warning',
    };
  }

  return {
    canReply: true,
    requiresAccept: false,
    unableReason: null,
    shortStatusLabel: 'Can Reply',
    tone: 'success',
  };
}
