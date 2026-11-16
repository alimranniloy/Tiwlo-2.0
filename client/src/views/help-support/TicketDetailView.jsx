import { supportFetch as fetch } from '../../utils/supportFetch';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  FileText,
  Flame,
  History,
  KeyRound,
  Lock,
  Mail,
  Paperclip,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Star,
  Tag,
  Ticket,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/mediaUtils';

const CATEGORIES = [
  'Payment & Billing',
  'Store & Domains',
  'Cloud & Droplets',
  'POS & Hardware',
  'Login & Security',
  'Bug Report',
  'Feature Request',
  'General Inquiry',
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function normalizeStatus(status) {
  const s = String(status || 'open').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'inprogress' || s === 'in_progress') return 'in_progress';
  if (s === 'waiting_for_customer' || s === 'waiting_customer' || s === 'awaiting_customer' || s === 'pending_customer') return 'waiting_customer';
  if (s === 'on_hold' || s === 'hold') return 'on_hold';
  if (s === 'escalated') return 'escalated';
  if (s === 'resolved') return 'resolved';
  if (s === 'closed') return 'closed';
  return 'open';
}

function normalizePriority(priority) {
  const p = String(priority || 'medium').trim().toLowerCase();
  if (p === 'low') return 'low';
  if (p === 'high') return 'high';
  if (p === 'urgent' || p === 'critical') return 'urgent';
  return 'medium';
}

function formatStatusLabel(status) {
  switch (normalizeStatus(status)) {
    case 'in_progress':
      return 'In Progress';
    case 'waiting_customer':
      return 'Waiting Customer';
    case 'on_hold':
      return 'On Hold';
    case 'escalated':
      return 'Escalated';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return 'Open';
  }
}

function getStatusClasses(status) {
  switch (normalizeStatus(status)) {
    case 'open':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'in_progress':
      return 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20';
    case 'waiting_customer':
      return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700';
    case 'on_hold':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
    case 'escalated':
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
    case 'resolved':
      return 'bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760] border-[#1ED760]/30';
    case 'closed':
      return 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800';
    default:
      return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700';
  }
}

function getPriorityClasses(priority) {
  switch (normalizePriority(priority)) {
    case 'low':
      return 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800';
    case 'high':
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20';
    case 'urgent':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    default:
      return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700';
  }
}

function formatDateTime(value) {
  if (!value) return 'Recently';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function formatSlaCountdown(ticket) {
  if (!ticket) return 'Standard SLA (2h first response)';
  const status = normalizeStatus(ticket.status);
  if (status === 'resolved' || status === 'closed') return 'SLA Completed';
  const due = ticket.slaDueAt || ticket.firstResponseDueAt || ticket.resolutionDueAt;
  if (!due) return ticket.slaLabel || 'Target: < 2 hours response';
  const dueMs = new Date(due).getTime();
  if (Number.isNaN(dueMs)) return String(due);
  const diffMs = dueMs - Date.now();
  if (diffMs <= 0) return 'SLA target exceeded — Priority review';
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hrs > 24) {
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h remaining`;
  }
  return hrs > 0 ? `${hrs}h ${mins}m remaining` : `${Math.max(1, mins)}m remaining`;
}

function parseAssignedAgent(ticket) {
  if (!ticket) return null;
  if (ticket.assignedAgentObj && typeof ticket.assignedAgentObj === 'object') {
    return ticket.assignedAgentObj;
  }
  if (ticket.assignedSpecialist && typeof ticket.assignedSpecialist === 'object') {
    return ticket.assignedSpecialist;
  }
  if (ticket.assignedAgent && typeof ticket.assignedAgent === 'object') {
    return ticket.assignedAgent;
  }
  if (typeof ticket.assignedAgent === 'string' && ticket.assignedAgent.trim()) {
    const raw = ticket.assignedAgent.trim();
    const match = raw.match(/^(.+?)\s*\((.+)\)$/);
    return {
      name: match ? match[1].trim() : raw,
      role: match ? match[2].trim() : ticket.assignedAgentRole || 'Support Specialist',
      avatar: ticket.assignedAgentAvatar || null,
      tier: ticket.escalationTier || ticket.tier || 1,
    };
  }
  return null;
}

function normalizeAttachment(att, idx) {
  if (!att) return null;
  if (typeof att === 'string') {
    return { id: `att_${idx}`, name: att, url: att.startsWith('http') || att.startsWith('/') || att.startsWith('data:') ? att : null };
  }
  return {
    id: att.id || `att_${idx}`,
    name: att.name || att.filename || `Attachment ${idx + 1}`,
    url: att.url || att.dataUrl || att.downloadUrl || null,
    size: att.size || '',
    mimeType: att.mimeType || att.type || '',
  };
}

export default function TicketDetailView({
  ticketId,
  initialTicket = null,
  initialRecoveryCode = '',
  currentUser,
  guestSession,
  supportConfig = { allowAttachments: true },
  onBack,
  showToast,
}) {
  const [ticket, setTicket] = useState(initialTicket);
  const [replies, setReplies] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Recovery code state
  const [recoveryCode, setRecoveryCode] = useState(() => {
    if (initialRecoveryCode) return initialRecoveryCode;
    try {
      return sessionStorage.getItem(`tiwlo.support.recovery.${ticketId}`) || '';
    } catch {
      return '';
    }
  });
  const [copiedKey, setCopiedKey] = useState('');

  // Inline edit ticket state
  const [isEditingTicket, setIsEditingTicket] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [savingTicketEdit, setSavingTicketEdit] = useState(false);

  // Reply composer + draft autosave
  const draftKey = `tiwlo.support.replyDraft.${ticketId}`;
  const [replyText, setReplyText] = useState(() => {
    try {
      return localStorage.getItem(draftKey) || '';
    } catch {
      return '';
    }
  });
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const fileInputRef = useRef(null);

  // Inline edit reply
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyText, setEditingReplyText] = useState('');
  const [savingReplyEdit, setSavingReplyEdit] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState({});

  // Watchers / CC Emails
  const [ccInput, setCcInput] = useState('');
  const [savingCc, setSavingCc] = useState(false);

  // Action modals / controls
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // CSAT Rating
  const [csatRating, setCsatRating] = useState(0);
  const [csatHover, setCsatHover] = useState(0);
  const [csatTags, setCsatTags] = useState([]);
  const [csatFeedback, setCsatFeedback] = useState('');
  const [savingCsat, setSavingCsat] = useState(false);

  const allowAttachments = supportConfig?.allowAttachments !== false;

  const loadTicketDetail = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
    if (!ticketId) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const cleanId = String(ticketId).replace(/^#/, '');
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanId)}`, {
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data?.ticket || data?.id || data?.ticketId)) {
        const t = data.ticket || data;
        setTicket(t);
        const rawReplies = Array.isArray(data.messages)
          ? data.messages
          : Array.isArray(data.replies)
          ? data.replies
          : Array.isArray(t.messages)
          ? t.messages
          : Array.isArray(t.replies)
          ? t.replies
          : [];
        setReplies(rawReplies);
        const rawEvents = Array.isArray(data.events)
          ? data.events
          : Array.isArray(data.timeline)
          ? data.timeline
          : Array.isArray(t.events)
          ? t.events
          : Array.isArray(t.auditLog)
          ? t.auditLog
          : [];
        setEvents(rawEvents);
        if (data.guestRecoveryCode || t.guestRecoveryCode) {
          setRecoveryCode(data.guestRecoveryCode || t.guestRecoveryCode);
        }
        if (t.csatRating || t.rating) {
          setCsatRating(Number(t.csatRating || t.rating) || 0);
          setCsatFeedback(t.csatFeedback || t.feedback || '');
        }
      } else if (!silent && !initialTicket) {
        setError(data?.error || 'Unable to load ticket details. Please verify your session or recovery code.');
      }
    } catch (err) {
      if (!silent && !initialTicket) {
        setError(err?.message || 'Unable to connect to the support server.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [ticketId, initialTicket]);

  useEffect(() => {
    loadTicketDetail();
  }, [loadTicketDetail]);

  // Autosave reply draft
  useEffect(() => {
    try {
      if (replyText.trim()) {
        localStorage.setItem(draftKey, replyText);
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {}
  }, [draftKey, replyText]);

  const effectiveTicket = ticket || initialTicket;
  const serial = effectiveTicket?.serialNumber || (String(ticketId || '').startsWith('#') ? ticketId : `#${ticketId}`);
  const cleanTicketId = effectiveTicket?.ticketId || effectiveTicket?.id || String(ticketId).replace(/^#/, '');
  const normalizedStatus = normalizeStatus(effectiveTicket?.status);
  const isClosed = normalizedStatus === 'closed';
  const isResolved = normalizedStatus === 'resolved';

  useEffect(() => {
    if (!ticketId || isClosed) return undefined;
    const timer = window.setInterval(() => {
      loadTicketDetail({ silent: true });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [ticketId, isClosed, loadTicketDetail]);
  const agent = parseAssignedAgent(effectiveTicket);
  const watchers = Array.isArray(effectiveTicket?.watchers)
    ? effectiveTicket.watchers
    : Array.isArray(effectiveTicket?.ccEmails)
    ? effectiveTicket.ccEmails
    : [];

  const handleCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2000);
      showToast?.('Copied to clipboard');
    } catch {
      showToast?.('Copy failed — please select and copy manually', 'error');
    }
  };

  const handleDownloadTranscript = () => {
    if (!effectiveTicket) return;
    const lines = [
      `TIWLO SUPPORT TICKET TRANSCRIPT`,
      `========================================`,
      `Ticket: ${serial}`,
      `Subject: ${effectiveTicket.subject || 'Support Request'}`,
      `Status: ${formatStatusLabel(effectiveTicket.status)}`,
      `Priority: ${normalizePriority(effectiveTicket.priority).toUpperCase()}`,
      `Category: ${effectiveTicket.category || 'General Inquiry'}`,
      `Created: ${formatDateTime(effectiveTicket.createdAt)}`,
      `Assigned Specialist: ${agent ? `${agent.name} (${agent.role})` : 'Unassigned — Queueing'}`,
      ``,
      `--- INITIAL DESCRIPTION ---`,
      effectiveTicket.description || '(No description)',
      effectiveTicket.expectedOutcome ? `\nExpected Outcome / Steps:\n${effectiveTicket.expectedOutcome}` : '',
      ``,
      `--- REPLIES (${replies.length}) ---`,
      ...replies.map((r, i) => [
        `#${i + 1} [${r.senderRole || r.role || r.sender || 'User'}] ${r.senderName || r.authorName || r.agentName || 'Participant'} (${formatDateTime(r.createdAt || r.timestamp)})`,
        r.body || r.text || r.message || '',
        '',
      ].join('\n')),
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cleanTicketId}-transcript.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleOpenEditTicket = () => {
    if (!effectiveTicket || isClosed) return;
    setEditSubject(effectiveTicket.subject || '');
    setEditCategory(effectiveTicket.category || 'General Inquiry');
    setEditPriority(normalizePriority(effectiveTicket.priority));
    setIsEditingTicket(true);
  };

  const handleSaveTicketEdit = async (e) => {
    e.preventDefault();
    if (!editSubject.trim() || isClosed) return;
    setSavingTicketEdit(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editSubject.trim(),
          category: editCategory,
          priority: editPriority.toUpperCase(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not update ticket');
      setTicket(data.ticket || {
        ...effectiveTicket,
        subject: editSubject.trim(),
        category: editCategory,
        priority: editPriority.toUpperCase(),
      });
      if (Array.isArray(data.events)) setEvents(data.events);
      setIsEditingTicket(false);
      showToast?.('Ticket details updated');
    } catch (err) {
      showToast?.(err.message || 'Failed to update ticket', 'error');
    } finally {
      setSavingTicketEdit(false);
    }
  };

  const handleAttachmentSelect = async (e) => {
    if (!allowAttachments || isClosed) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remainingSlots = Math.max(0, 10 - replyAttachments.length);
    if (remainingSlots <= 0) {
      showToast?.('Maximum 10 attachments allowed per reply', 'error');
      if (e.target) e.target.value = '';
      return;
    }
    const validFiles = files.slice(0, remainingSlots).filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        showToast?.(`${f.name} exceeds 10MB limit`, 'error');
        return false;
      }
      return true;
    });
    if (!validFiles.length) {
      if (e.target) e.target.value = '';
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      for (const file of validFiles) {
        formData.append('files', file);
      }
      const res = await fetch('/api/support/attachments', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Attachment upload failed');
      const returned = Array.isArray(data.attachments)
        ? data.attachments
        : data.attachment
          ? [data.attachment]
          : [];
      const uploaded = returned.map((att, idx) => {
        const srcFile = validFiles[idx];
        return {
          id: att.id || `att_${Date.now()}_${idx}`,
          name: att.filename || att.name || srcFile?.name || 'Attachment',
          url: att.url || '',
          mimeType: att.contentType || att.mimeType || srcFile?.type || 'application/octet-stream',
          size: `${Math.max(1, Math.round((att.size || srcFile?.size || 0) / 1024))} KB`,
        };
      });
      if (uploaded.length) {
        setReplyAttachments((prev) => [...prev, ...uploaded].slice(0, 10));
      }
    } catch (err) {
      showToast?.(err.message || 'Attachment upload failed', 'error');
    } finally {
      setUploadingAttachment(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (isClosed) return;
    if (!replyText.trim() && replyAttachments.length === 0) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}/replies`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: replyText.trim(),
          message: replyText.trim(),
          text: replyText.trim(),
          attachments: replyAttachments,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not post reply');
      const createdReply = data.reply || {
        id: `rep_${Date.now()}`,
        senderType: 'customer',
        senderName: currentUser?.name || guestSession?.name || 'Customer',
        body: replyText.trim(),
        attachments: replyAttachments,
        createdAt: new Date().toISOString(),
      };
      setReplies((prev) => [...prev, createdReply]);
      if (data.ticket) setTicket(data.ticket);
      if (Array.isArray(data.events)) setEvents(data.events);
      setReplyText('');
      setReplyAttachments([]);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      showToast?.('Reply posted');
    } catch (err) {
      showToast?.(err.message || 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSaveReplyEdit = async (replyId) => {
    if (isClosed || !editingReplyText.trim()) return;
    setSavingReplyEdit(true);
    try {
      const res = await fetch(
        `/api/support/tickets/${encodeURIComponent(cleanTicketId)}/replies/${encodeURIComponent(replyId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: editingReplyText.trim(),
            message: editingReplyText.trim(),
            text: editingReplyText.trim(),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to edit reply');
      setReplies((prev) =>
        prev.map((r) => {
          if ((r.id || r._id) !== replyId) return r;
          if (data.reply) return data.reply;
          const prevText = r.body || r.text || r.message || '';
          const history = Array.isArray(r.editHistory) ? [...r.editHistory] : [];
          history.push({ previousText: prevText, editedAt: new Date().toISOString() });
          return {
            ...r,
            body: editingReplyText.trim(),
            text: editingReplyText.trim(),
            edited: true,
            editedAt: new Date().toISOString(),
            editHistory: history,
          };
        })
      );
      setEditingReplyId(null);
      setEditingReplyText('');
      showToast?.('Reply updated');
    } catch (err) {
      showToast?.(err.message || 'Could not update reply', 'error');
    } finally {
      setSavingReplyEdit(false);
    }
  };

  const handleUpdateWatchers = async (nextWatchers) => {
    if (isClosed) return;
    setSavingCc(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchers: nextWatchers, ccEmails: nextWatchers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update CC emails');
      setTicket(data.ticket || { ...effectiveTicket, watchers: nextWatchers, ccEmails: nextWatchers });
      showToast?.('Watchers updated');
    } catch (err) {
      showToast?.(err.message || 'Could not update watchers', 'error');
    } finally {
      setSavingCc(false);
    }
  };

  const handleAddWatcher = (e) => {
    e.preventDefault();
    const email = ccInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast?.('Enter a valid email address', 'error');
      return;
    }
    if (watchers.includes(email)) {
      setCcInput('');
      return;
    }
    setCcInput('');
    handleUpdateWatchers([...watchers, email]);
  };

  const handleMarkResolved = async () => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not resolve ticket');
      setTicket(data.ticket || { ...effectiveTicket, status: 'RESOLVED' });
      if (Array.isArray(data.events)) setEvents(data.events);
      showToast?.('Ticket marked as resolved');
    } catch (err) {
      showToast?.(err.message || 'Action failed', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReopenTicket = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'OPEN', reopenReason: reopenReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not reopen ticket');
      setTicket(data.ticket || { ...effectiveTicket, status: 'OPEN' });
      if (Array.isArray(data.events)) setEvents(data.events);
      setShowReopenModal(false);
      setReopenReason('');
      showToast?.('Ticket reopened');
    } catch (err) {
      showToast?.(err.message || 'Failed to reopen ticket', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleEscalateTicket = async (e) => {
    e.preventDefault();
    if (isClosed) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: 'URGENT',
          status: 'ESCALATED',
          escalate: true,
          escalationReason: escalationReason.trim() || 'Customer requested urgent escalation',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Escalation request failed');
      setTicket(data.ticket || { ...effectiveTicket, priority: 'URGENT', status: 'ESCALATED' });
      if (Array.isArray(data.events)) setEvents(data.events);
      setShowEscalateModal(false);
      setEscalationReason('');
      showToast?.('Urgent escalation requested');
    } catch (err) {
      showToast?.(err.message || 'Failed to escalate ticket', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitCsat = async (e) => {
    e.preventDefault();
    if (!csatRating) return;
    setSavingCsat(true);
    try {
      let res = await fetch('/api/support/csat-survey', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: cleanTicketId,
          rating: csatRating,
          tags: csatTags,
          comment: csatFeedback.trim(),
        }),
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`/api/support/tickets/${encodeURIComponent(cleanTicketId)}/csat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: csatRating,
            comment: csatFeedback.trim(),
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not save rating');
      setTicket(data.ticket || {
        ...effectiveTicket,
        csatRating,
        csatTags,
        csatFeedback: csatFeedback.trim(),
        csatSubmittedAt: new Date().toISOString(),
      });
      showToast?.('Thank you for your feedback');
    } catch (err) {
      showToast?.(err.message || 'Could not submit rating', 'error');
    } finally {
      setSavingCsat(false);
    }
  };

  if (loading && !effectiveTicket) {
    return (
      <div className="w-full space-y-4 py-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        <div className="h-44 w-full animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        <div className="h-64 w-full animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
      </div>
    );
  }

  if (error && !effectiveTicket) {
    return (
      <div className="w-full py-8">
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 text-center space-y-4">
          <Ticket className="mx-auto h-10 w-10 text-neutral-400" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Ticket Unavailable</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{error}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-neutral-950 transition hover:opacity-90 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Tickets
          </button>
        </div>
      </div>
    );
  }

  const initialAttachments = (Array.isArray(effectiveTicket?.attachments) ? effectiveTicket.attachments : [])
    .map(normalizeAttachment)
    .filter(Boolean);

  const isGuestRequester = !effectiveTicket?.userId || effectiveTicket?.userId === 'guest' || effectiveTicket?.userId === 'guest_session' || Boolean(effectiveTicket?.isGuest);

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Breadcrumb & Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            My Tickets
          </button>
          <span className="text-neutral-300 dark:text-neutral-700">/</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1 font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {serial}
          </span>
          <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(effectiveTicket?.status)}`}>
            {formatStatusLabel(effectiveTicket?.status)}
          </span>
          <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium capitalize ${getPriorityClasses(effectiveTicket?.priority)}`}>
            {normalizePriority(effectiveTicket?.priority)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopy(serial, 'serial')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            {copiedKey === 'serial' ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
            Copy ID
          </button>
          <button
            type="button"
            onClick={() => handleCopy(`${window.location.origin}/help-support/ticket/${encodeURIComponent(cleanTicketId)}`, 'link')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            {copiedKey === 'link' ? <Check className="h-3.5 w-3.5 text-[#1ED760]" /> : <Copy className="h-3.5 w-3.5" />}
            Copy Link
          </button>
          <button
            type="button"
            onClick={handleDownloadTranscript}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Transcript
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            type="button"
            onClick={loadTicketDetail}
            title="Refresh ticket"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-1.5 text-neutral-600 dark:text-neutral-300 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* One-Time Guest Recovery Code Banner */}
      {recoveryCode && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1ED760] text-neutral-950">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Save your Guest Recovery Code
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">
                Use this code with <span className="font-mono font-medium">{serial}</span> and your email to resume this ticket on any device.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <code className="rounded-lg border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-neutral-900 dark:text-neutral-100">
              {recoveryCode}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(recoveryCode, 'recovery')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-3 py-1.5 text-xs font-semibold text-neutral-950 transition cursor-pointer"
            >
              {copiedKey === 'recovery' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              Copy Code
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Enterprise Ticketing Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Main Thread Column */}
        <div className="space-y-6 lg:col-span-8">
          {/* Subject & Metadata Card */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 shadow-xs">
            {isEditingTicket ? (
              <form onSubmit={handleSaveTicketEdit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Edit Ticket Details</h2>
                  <button
                    type="button"
                    onClick={() => setIsEditingTicket(false)}
                    className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Subject</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    maxLength={120}
                    required
                    className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Priority</label>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTicket(false)}
                    className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTicketEdit}
                    className="rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50 cursor-pointer"
                  >
                    {savingTicketEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 break-words">
                      {effectiveTicket?.subject || 'Support Request'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        {effectiveTicket?.category || 'General Inquiry'}
                      </span>
                      <span>Channel: {effectiveTicket?.channel || 'Web'}</span>
                      {effectiveTicket?.referenceId && (
                        <span className="font-mono">Ref: {effectiveTicket.referenceId}</span>
                      )}
                      {effectiveTicket?.storeName && (
                        <span>Store: {effectiveTicket.storeName}</span>
                      )}
                      <span>Opened {formatDateTime(effectiveTicket?.createdAt)}</span>
                    </div>
                  </div>
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={handleOpenEditTicket}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-4 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                  {effectiveTicket?.description || 'No description provided.'}
                </div>

                {effectiveTicket?.expectedOutcome && (
                  <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-4 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Expected Outcome / Steps
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                      {effectiveTicket.expectedOutcome}
                    </p>
                  </div>
                )}

                {initialAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                      Attachments ({initialAttachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {initialAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs"
                        >
                          {att.mimeType?.startsWith('image/') && att.url ? (
                            <img src={att.url} alt={att.name} className="h-7 w-7 rounded object-cover" />
                          ) : (
                            <FileText className="h-4 w-4 text-neutral-500" />
                          )}
                          <span className="max-w-[160px] truncate font-medium text-neutral-800 dark:text-neutral-200">
                            {att.name}
                          </span>
                          {att.url && (
                            <a
                              href={att.url}
                              download={att.name}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#16a34a] dark:text-[#1ED760] hover:underline font-medium"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Formal Threaded Replies List */}
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Ticket Correspondence ({replies.length})
              </h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Chronological formal thread
              </span>
            </div>

            {replies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                No replies yet. Add a formal update below and a support specialist will respond shortly.
              </div>
            ) : (
              <div className="space-y-3">
                {replies.map((reply, index) => {
                  const rId = reply.id || reply._id || `reply_${index}`;
                  const senderType = String(reply.senderType || reply.sender || reply.role || 'customer').toLowerCase();
                  const isSystem = senderType === 'system';
                  const isBot = senderType === 'bot' || senderType === 'ai';
                  const isStaff = senderType === 'agent' || senderType === 'staff' || senderType === 'support' || senderType === 'admin';
                  const isOwnReply = !isSystem && !isStaff && !isBot;
                  const roleLabel = isSystem ? 'System' : isBot ? 'AI Assistant' : isStaff ? 'Support Specialist' : 'Customer';
                  const senderName =
                    reply.senderName ||
                    reply.authorName ||
                    reply.agentName ||
                    (isBot ? 'Tiwi AI Assistant' : isStaff ? 'Support Specialist' : effectiveTicket?.userName || 'Customer');
                  const bodyText = reply.body || reply.text || reply.message || '';
                  const editHistory = Array.isArray(reply.editHistory) ? reply.editHistory : [];
                  const isEdited = Boolean(reply.edited || reply.editedAt || editHistory.length > 0);
                  const repAttachments = (Array.isArray(reply.attachments) ? reply.attachments : [])
                    .map(normalizeAttachment)
                    .filter(Boolean);

                  return (
                    <article
                      key={rId}
                      className={`rounded-xl border p-4 sm:p-5 transition ${
                        isStaff
                          ? 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950'
                          : isBot
                          ? 'border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20'
                          : isSystem
                          ? 'border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/70'
                          : 'border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-200/60 dark:border-neutral-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-md border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-1.5 font-mono text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                            #{index + 1}
                          </span>
                          <img
                            src={resolveAvatarUrl(reply.avatar || reply.senderAvatar)}
                            alt={senderName}
                            className="h-7 w-7 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                                {senderName}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                  isStaff
                                    ? 'bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760] border-[#1ED760]/30'
                                    : isBot
                                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25'
                                    : isSystem
                                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                                    : 'bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                                }`}
                              >
                                {roleLabel}
                              </span>
                              {isEdited && (
                                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">(edited)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{formatDateTime(reply.createdAt || reply.timestamp || reply.time)}</span>
                          {isOwnReply && !isClosed && editingReplyId !== rId && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReplyId(rId);
                                setEditingReplyText(bodyText);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit Reply
                            </button>
                          )}
                        </div>
                      </div>

                      {editingReplyId === rId ? (
                        <div className="mt-3 space-y-2.5">
                          <textarea
                            rows={3}
                            value={editingReplyText}
                            onChange={(e) => setEditingReplyText(e.target.value)}
                            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReplyId(null);
                                setEditingReplyText('');
                              }}
                              className="rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-600 dark:text-neutral-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingReplyEdit || !editingReplyText.trim()}
                              onClick={() => handleSaveReplyEdit(rId)}
                              className="rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-3 py-1 text-xs font-semibold text-neutral-950 disabled:opacity-50 cursor-pointer"
                            >
                              {savingReplyEdit ? 'Saving...' : 'Save Edit'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                          {bodyText}
                        </div>
                      )}

                      {repAttachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {repAttachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center gap-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-xs"
                            >
                              <FileText className="h-3.5 w-3.5 text-neutral-500" />
                              <span className="max-w-[140px] truncate text-neutral-700 dark:text-neutral-300">{att.name}</span>
                              {att.url && (
                                <a
                                  href={att.url}
                                  download={att.name}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#16a34a] dark:text-[#1ED760] hover:underline font-medium"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {editHistory.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-800">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryIds((prev) => ({ ...prev, [rId]: !prev[rId] }))}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                          >
                            <History className="h-3 w-3" />
                            {expandedHistoryIds[rId] ? 'Hide edit history' : `View edit history (${editHistory.length})`}
                          </button>
                          {expandedHistoryIds[rId] && (
                            <div className="mt-2 space-y-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2.5 text-xs">
                              {editHistory.map((h, hIdx) => (
                                <div key={hIdx} className="text-neutral-500 dark:text-neutral-400">
                                  <span className="font-mono text-[10px]">{formatDateTime(h.editedAt)}: </span>
                                  <span className="line-through">{h.previousText || h.body || h.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Formal Reply Composer OR Permanent Closed Ticket Lock */}
          {isClosed ? (
            <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-500">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Permanent Closed Lock
                </p>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                  This ticket is permanently closed and locked. New replies and reopening controls are disabled.
                </p>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xs">
              <form onSubmit={handleSendReply} className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="ticket-reply-input" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Add Formal Reply
                  </label>
                  {replyText.trim() && (
                    <span className="text-[11px] text-neutral-400">Draft autosaved</span>
                  )}
                </div>

                <textarea
                  id="ticket-reply-input"
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a detailed response, paste logs, or share updates..."
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none focus:ring-2 focus:ring-[#1ED760]/20"
                />

                {replyAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {replyAttachments.map((att, idx) => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1.5 text-xs"
                      >
                        {att.mimeType?.startsWith('image/') && att.url ? (
                          <img src={att.url} alt={att.name} className="h-6 w-6 rounded object-cover" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-neutral-500" />
                        )}
                        <span className="max-w-[140px] truncate text-neutral-700 dark:text-neutral-200">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setReplyAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {allowAttachments && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.log,.zip"
                          onChange={handleAttachmentSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingAttachment}
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {uploadingAttachment ? 'Uploading...' : 'Attach File'}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={sendingReply || uploadingAttachment || (!replyText.trim() && replyAttachments.length === 0)}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-950 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingReply ? 'Sending...' : 'Post Reply'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* CSAT 1-5 Star Rating + Review Card when resolved or closed */}
          {(isResolved || isClosed) && (
            <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xs">
              <form onSubmit={handleSubmitCsat} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Rate Your Support Experience
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      How satisfied are you with the resolution of {serial}?
                    </p>
                  </div>
                  {effectiveTicket?.csatSubmittedAt && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#1ED760]/15 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-[#1ED760]">
                      <CheckCircle2 className="h-3 w-3" />
                      Rated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (csatHover || csatRating) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setCsatHover(star)}
                        onMouseLeave={() => setCsatHover(0)}
                        onClick={() => setCsatRating(star)}
                        className="rounded-lg p-1.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer"
                        aria-label={`Rate ${star} out of 5 stars`}
                      >
                        <Star
                          className={`h-6 w-6 transition ${
                            active
                              ? 'fill-[#1ED760] text-[#1ED760]'
                              : 'text-neutral-300 dark:text-neutral-700'
                          }`}
                        />
                      </button>
                    );
                  })}
                  {csatRating > 0 && (
                    <span className="ml-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      {csatRating} / 5
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['Fast', 'Helpful', 'Resolved', 'Clear'].map((tag) => {
                    const selected = csatTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setCsatTags((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          )
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                          selected
                            ? 'border-[#1ED760] bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760]'
                            : 'border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={2}
                  value={csatFeedback}
                  onChange={(e) => setCsatFeedback(e.target.value)}
                  placeholder="Optional review or feedback for our specialist team..."
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!csatRating || savingCsat}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-neutral-950 transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {savingCsat ? 'Submitting...' : effectiveTicket?.csatSubmittedAt ? 'Update Rating' : 'Submit Rating'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* Right Metadata & Action Sidebar */}
        <aside className="space-y-4 lg:col-span-4">
          {/* Assigned Support Specialist Card */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Assigned Specialist
            </h2>
            {agent ? (
              <div className="flex items-center gap-3">
                <img
                  src={resolveAvatarUrl(agent.avatar)}
                  alt={agent.name}
                  className="h-11 w-11 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {agent.name}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {agent.role || 'Support Specialist'}
                  </p>
                  <span className="mt-1 inline-flex items-center rounded-md border border-neutral-200 dark:border-neutral-700 bg-[#fafafa] dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                    Tier {agent.tier || effectiveTicket?.escalationTier || 1}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3">
                <User className="h-5 w-5 text-neutral-400" />
                <div>
                  <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Unassigned — Queueing</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Next available specialist will claim this ticket</p>
                </div>
              </div>
            )}
          </section>

          {/* SLA & Escalation Card */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              SLA &amp; Escalation
            </h2>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                SLA Status
              </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {formatSlaCountdown(effectiveTicket)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Escalation Tier</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                Tier {effectiveTicket?.escalationTier || agent?.tier || 1}
              </span>
            </div>
          </section>

          {/* Requester Details Card */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Requester
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-300">
                <ShieldCheck className="h-3 w-3 text-[#1ED760]" />
                {isGuestRequester ? 'Guest Visitor' : 'Verified Account'}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                {effectiveTicket?.userName || currentUser?.name || guestSession?.name || 'Customer'}
              </p>
              {(effectiveTicket?.userEmail || effectiveTicket?.guestEmail || currentUser?.email || guestSession?.email) && (
                <p className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {effectiveTicket?.userEmail || effectiveTicket?.guestEmail || currentUser?.email || guestSession?.email}
                </p>
              )}
              {(effectiveTicket?.userPhone || effectiveTicket?.guestPhone || guestSession?.phone) && (
                <p className="text-neutral-500 dark:text-neutral-400">
                  Phone: {effectiveTicket?.userPhone || effectiveTicket?.guestPhone || guestSession?.phone}
                </p>
              )}
            </div>
          </section>

          {/* Watchers / CC Email Manager */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Watchers / CC Emails
            </h2>
            {watchers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {watchers.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300"
                  >
                    <span className="max-w-[160px] truncate">{email}</span>
                    {!isClosed && (
                      <button
                        type="button"
                        disabled={savingCc}
                        onClick={() => handleUpdateWatchers(watchers.filter((w) => w !== email))}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        aria-label={`Remove ${email}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No CC recipients added.</p>
            )}
            {!isClosed && (
              <form onSubmit={handleAddWatcher} className="flex gap-2">
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="teammate@company.com"
                  className="min-w-0 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingCc || !ccInput.trim()}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-[#fafafa] dark:hover:bg-neutral-900 disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add
                </button>
              </form>
            )}
          </section>

          {/* Ticket Actions Card */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Ticket Actions
            </h2>
            <div className="flex flex-col gap-2">
              {!isResolved && !isClosed && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={handleMarkResolved}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-3 py-2 text-xs font-semibold text-neutral-950 transition disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Resolved
                </button>
              )}

              {isResolved && !isClosed && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setShowReopenModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reopen Ticket
                </button>
              )}

              {!isClosed && normalizedStatus !== 'escalated' && (
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => setShowEscalateModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <Flame className="h-3.5 w-3.5" />
                  Request Urgent Escalation
                </button>
              )}
            </div>
          </section>

          {/* Event Timeline / Audit Strip */}
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Audit Timeline
            </h2>
            {events.length === 0 ? (
              <div className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1ED760] shrink-0" />
                  <div>
                    <p className="font-medium text-neutral-800 dark:text-neutral-200">Ticket created ({serial})</p>
                    <p className="text-[11px]">{formatDateTime(effectiveTicket?.createdAt)}</p>
                  </div>
                </div>
                {agent && (
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-neutral-400 shrink-0" />
                    <div>
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">Assigned to {agent.name}</p>
                      <p className="text-[11px]">{agent.role}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((ev, idx) => (
                  <div key={ev.id || idx} className="flex items-start gap-2.5 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#1ED760] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">
                        {ev.summary || ev.message || ev.description || ev.type || 'Ticket updated'}
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {formatDateTime(ev.createdAt || ev.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Reopen Ticket Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Reopen Ticket {serial}</h3>
              <button type="button" onClick={() => setShowReopenModal(false)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleReopenTicket} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Reason for reopening <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why this issue still needs assistance..."
                  className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy || !reopenReason.trim()}
                  className="rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50 cursor-pointer"
                >
                  {actionBusy ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Urgent Escalation Modal */}
      {showEscalateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Request Urgent Escalation</h3>
              <button type="button" onClick={() => setShowEscalateModal(false)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEscalateTicket} className="space-y-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Escalating marks {serial} as Urgent and routes it to senior technical operations.
              </p>
              <textarea
                rows={3}
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Describe the business impact or urgency..."
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEscalateModal(false)}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                >
                  {actionBusy ? 'Escalating...' : 'Escalate Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
