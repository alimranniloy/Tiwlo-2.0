import { supportFetch as fetch } from '../utils/supportFetch';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestSensitiveActionGrant } from '../security/reauth.js';
import PaginationBar from '../components/PaginationBar';
import AdminLiveChatQueuePanel from './components/AdminLiveChatQueuePanel';
import AdminStaffPerformancePanel from './components/AdminStaffPerformancePanel';
import AdminCustomerContextDrawer from './components/AdminCustomerContextDrawer';
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  Ban,
  Bookmark,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  FolderGit2,
  GitMerge,
  Headphones,
  History,
  Inbox,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Store,
  Tag,
  Trash2,
  Unlock,
  UserCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react';

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
    ? 'http://localhost:5000/api'
    : '/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');

const QUEUE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'guest', label: 'Guest Visitors' },
  { id: 'registered', label: 'Registered Users' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'mine', label: 'My Assigned' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'sla_risk', label: 'SLA At-Risk' },
  { id: 'resolved', label: 'Resolved / Closed' },
];

const STATUS_OPTIONS = ['Open', 'In Progress', 'Waiting Customer', 'On Hold', 'Escalated', 'Resolved', 'Closed'];
const PRIORITY_OPTIONS = ['Urgent', 'High', 'Medium', 'Low'];
const CATEGORY_OPTIONS = [
  'General Inquiry',
  'Billing & Orders',
  'Technical / Store',
  'Account & KYC',
  'Domain & DNS',
  'POS & Inventory',
  'PICK_ACCOUNT_APPEAL',
];
const DEPARTMENT_OPTIONS = ['Customer Support', 'Technical Cloud', 'Trust & Safety', 'Billing & Finance', 'Enterprise'];

const BUILTIN_PRESETS = [
  { id: 'urgent-unassigned', name: 'Urgent Unassigned', queue: 'unassigned', priority: 'Urgent', status: 'all', category: 'all' },
  { id: 'guest-open', name: 'Open Guest Tickets', queue: 'guest', priority: 'all', status: 'Open', category: 'all' },
  { id: 'sla-risk', name: 'SLA At-Risk', queue: 'sla_risk', priority: 'all', status: 'all', category: 'all' },
];

const SUPPORT_FEATURE_SWITCHES = [
  { key: 'liveChatWidget', label: 'Live Chat Widget', description: 'Show the live support widget on Tiwlo storefronts and dashboards.' },
  { key: 'guestTicketsEnabled', label: 'Guest Ticketing', description: 'Allow unauthenticated visitors to open support tickets.' },
  { key: 'requireGuestContact', label: 'Mandatory Guest Email & Phone', description: 'Require verified email and phone number before guest submission.' },
  { key: 'allowNewTickets', label: 'Allow New Tickets', description: 'Enable customers and guests to submit new support tickets.' },
  { key: 'lockClosedReplies', label: 'Lock Replies on Closed Tickets', description: 'Block accidental replies when a ticket status is Closed.' },
  { key: 'allowCustomerReopen', label: 'Allow Customer Reopen', description: 'Let customers reopen resolved tickets within the grace window.' },
  { key: 'fileAttachmentsEnabled', label: 'File Attachments', description: 'Permit screenshots, invoices, and log attachments in threads.' },
  { key: 'aiAutoReply', label: 'AI Auto-Reply', description: 'Allow Tiwi AI to post initial responses before human handoff.' },
  { key: 'aiAgentDraftAssist', label: 'AI Agent Draft Assist', description: 'Suggest reply drafts for support staff inside the composer.' },
  { key: 'restrictStaffToAssignedQueue', label: 'Restrict Staff to Assigned Queue', description: 'Limit non-lead agents to tickets assigned to them or unassigned.' },
];

const DEFAULT_SWITCHES = {
  liveChatWidget: true,
  guestTicketsEnabled: true,
  requireGuestContact: true,
  allowNewTickets: true,
  lockClosedReplies: true,
  allowCustomerReopen: true,
  fileAttachmentsEnabled: true,
  aiAutoReply: true,
  aiAgentDraftAssist: true,
  restrictStaffToAssignedQueue: false,
};

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getTicketSerial(ticket) {
  if (!ticket) return '#TWTK-0000';
  const raw = ticket.serialNumber || ticket.ticketId || ticket.id || '';
  return String(raw).startsWith('#') ? String(raw) : `#${raw}`;
}

function isClosedStatus(status) {
  return String(status || '').trim().toUpperCase() === 'CLOSED';
}

function isGuestTicket(ticket) {
  if (!ticket) return false;
  if (ticket.isGuest === true || ticket.requesterType === 'guest') return true;
  const uid = String(ticket.userId || '').trim().toLowerCase();
  return !uid || uid === 'guest' || uid === 'guest_session';
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationMinutes(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  const mins = Math.round(Number(value));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatSlaLabel(ticket) {
  if (ticket?.slaLabel) return ticket.slaLabel;
  if (ticket?.slaBreached) return 'SLA Breached';
  if (!ticket?.slaDueAt) return null;
  const diffMs = new Date(ticket.slaDueAt).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  if (diffMs <= 0) return 'SLA Breached';
  const mins = Math.ceil(diffMs / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m left`;
}

function getStatusBadgeClass(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'OPEN' || s === 'SUBMITTED') {
    return 'border-[#1ED760]/30 bg-[#1ED760]/12 text-emerald-700 dark:text-[#1ED760]';
  }
  if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
    return 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  }
  if (s === 'WAITING_CUSTOMER' || s === 'WAITING CUSTOMER') {
    return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';
  }
  if (s === 'ON_HOLD' || s === 'ON HOLD') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
  if (s === 'ESCALATED' || s === 'REJECTED') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  if (s === 'RESOLVED') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
}

function getPriorityBadgeClass(priority) {
  const p = String(priority || '').toUpperCase();
  if (p === 'URGENT' || p === 'CRITICAL') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  }
  if (p === 'HIGH') {
    return 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300';
  }
  if (p === 'MEDIUM') {
    return 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
  }
  return 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400';
}

function getInitials(name) {
  const parts = String(name || 'S').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function resolveAgentObj(ticket, agents = []) {
  if (!ticket) return null;
  if (ticket.assignedAgentObj && typeof ticket.assignedAgentObj === 'object') {
    return ticket.assignedAgentObj;
  }
  if (ticket.assignedStaff && typeof ticket.assignedStaff === 'object') {
    return ticket.assignedStaff;
  }
  const assignedId = ticket.assignedAgentId || ticket.assignedTo;
  if (assignedId && Array.isArray(agents)) {
    const found = agents.find((a) => a.id === assignedId || a.userId === assignedId || a.email === assignedId);
    if (found) return found;
  }
  if (ticket.assignedAgentName || (typeof ticket.assignedAgent === 'string' && ticket.assignedAgent.trim())) {
    const rawName = ticket.assignedAgentName || ticket.assignedAgent;
    if (String(rawName).toLowerCase() === 'unassigned') return null;
    return {
      id: assignedId || rawName,
      name: rawName,
      role: ticket.assignedAgentRole || 'Support Specialist',
      avatar: ticket.assignedAgentAvatar || null,
      tier: ticket.escalationTier || null,
    };
  }
  return null;
}

function StaffAvatar({ agent, size = 'sm' }) {
  const dim = size === 'md' ? 'h-8 w-8 text-[11px]' : 'h-6 w-6 text-[10px]';
  if (agent?.avatar || agent?.photoUrl || agent?.avatarUrl) {
    return (
      <img
        src={agent.avatar || agent.photoUrl || agent.avatarUrl}
        alt={agent.name || 'Staff'}
        className={`${dim} shrink-0 rounded-full border border-neutral-200 object-cover dark:border-neutral-700`}
      />
    );
  }
  return (
    <span
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full border border-[#1ED760]/30 bg-[#1ED760]/15 font-semibold text-emerald-800 dark:text-[#1ED760]`}
    >
      {getInitials(agent?.name || 'UN')}
    </span>
  );
}

function SwitchToggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-[#1ED760] bg-[#1ED760]'
          : 'border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function hasAdminPermission(staffAccess, currentUser, permKey) {
  if (!staffAccess) {
    return (
      currentUser?.role === 'super_admin' ||
      String(currentUser?.email || '').trim().toLowerCase() === 'tiwloltd@gmail.com'
    );
  }
  if (
    staffAccess.isSuperAdmin === true ||
    staffAccess.role === 'super_admin' ||
    staffAccess.roleKey === 'super_admin' ||
    staffAccess.unrestricted === true
  ) {
    return true;
  }
  const perms = staffAccess.permissions;
  if (Array.isArray(perms)) {
    return perms.includes('*') || perms.includes(permKey);
  }
  if (perms && typeof perms === 'object') {
    return perms[permKey] === true;
  }
  return false;
}

export default function AdminSupportDeskView({
  initialTicketId = null,
  onBackToDashboard,
  onNavigate,
  showToast,
  currentUser,
  staffAccess,
}) {
  // Primary mode tabs: 'live-chats' | 'desk' | 'performance' | 'macros' | 'switches'
  const [deskSection, setDeskSection] = useState('desk');
  const [liveChatCounts, setLiveChatCounts] = useState({ waiting: 0, active: 0, on_hold: 0, closed: 0 });
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPageSize, setTicketPageSize] = useState(10);
  const [acceptingAssignmentId, setAcceptingAssignmentId] = useState('');
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  // Responsive mobile pane switcher: 'queue' | 'thread' | 'customer'
  const [mobilePane, setMobilePane] = useState('queue');

  // Queue & filter state
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [macros, setMacros] = useState([]);
  const [switches, setSwitches] = useState(DEFAULT_SWITCHES);

  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');
  const [activeQueue, setActiveQueue] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      const raw = localStorage.getItem('tiwlo_support_filter_presets');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAgentId, setBulkAgentId] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkWorking, setBulkWorking] = useState(false);

  // Selected ticket & detail
  const [selectedTicketId, setSelectedTicketId] = useState(initialTicketId || null);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [copiedSerial, setCopiedSerial] = useState('');

  // Assignment popover
  const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Edit ticket drawer
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    subject: '',
    category: 'General Inquiry',
    priority: 'Medium',
    status: 'Open',
    department: 'Customer Support',
    escalationTier: '1',
    tagsText: '',
  });
  const [savingTicketMeta, setSavingTicketMeta] = useState(false);

  // Composer & reply editing
  const [composerMode, setComposerMode] = useState('public'); // 'public' | 'internal'
  const [composerText, setComposerText] = useState('');
  const [aiWriting, setAiWriting] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [macroDrawerOpen, setMacroDrawerOpen] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyText, setEditingReplyText] = useState('');
  const [savingReplyEdit, setSavingReplyEdit] = useState(false);
  const [openHistoryReplyId, setOpenHistoryReplyId] = useState(null);

  // Modals: Merge, Sub-ticket, Link User, Macro CRUD
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeWorking, setMergeWorking] = useState(false);

  const [subticketModalOpen, setSubticketModalOpen] = useState(false);
  const [subticketForm, setSubticketForm] = useState({ subject: '', description: '', priority: 'Medium', department: 'Customer Support' });
  const [subticketWorking, setSubticketWorking] = useState(false);

  const [linkUserIdentifier, setLinkUserIdentifier] = useState('');
  const [linkingUser, setLinkingUser] = useState(false);

  const [watcherInput, setWatcherInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  // Macro CRUD modal
  const [macroModalOpen, setMacroModalOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState(null);
  const [macroForm, setMacroForm] = useState({ title: '', category: 'General', body: '' });
  const [savingMacro, setSavingMacro] = useState(false);

  // Feature switches state
  const [loadingSwitches, setLoadingSwitches] = useState(false);
  const [savingSwitches, setSavingSwitches] = useState(false);

  const assignPopoverRef = useRef(null);

  const canManageSystemSettings = hasAdminPermission(staffAccess, currentUser, 'manage_system_settings');
  const isSuperAdmin =
    staffAccess?.isSuperAdmin === true ||
    staffAccess?.role === 'super_admin' ||
    staffAccess?.roleKey === 'super_admin' ||
    currentUser?.role === 'super_admin' ||
    String(currentUser?.email || '').trim().toLowerCase() === 'tiwloltd@gmail.com';
  // Permanent Closed Lock: once closed, tickets cannot be reopened even by Admins
  const canReopenClosed = false;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
    }, 260);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (assignPopoverRef.current && !assignPopoverRef.current.contains(e.target)) {
        setAssignPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (activeQueue && activeQueue !== 'all') params.set('queue', activeQueue);
      if (appliedSearch) params.set('q', appliedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`${API_BASE}/admin/support/tickets?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Could not load support tickets (${res.status}).`);
      }
      const list = Array.isArray(json.tickets) ? json.tickets : Array.isArray(json.data?.tickets) ? json.data.tickets : [];
      setTickets(list);
      setStats(json.stats || json.summary || json.data?.stats || null);
      setListError('');
      setSelectedTicketId((prev) => {
        if (prev && list.some((t) => t.id === prev || t.ticketId === prev)) return prev;
        return initialTicketId || list[0]?.id || null;
      });
    } catch (err) {
      setListError(err.message || 'Support ticket service unavailable.');
    } finally {
      setLoadingList(false);
    }
  }, [activeQueue, appliedSearch, statusFilter, priorityFilter, categoryFilter, initialTicketId]);

  const loadAgentsAndMacros = useCallback(async () => {
    try {
      const [agentsRes, macrosRes] = await Promise.all([
        fetch(`${API_BASE}/admin/support/agents`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE}/admin/support/macros`, { credentials: 'include', headers: getAuthHeaders() }),
      ]);
      const [agentsJson, macrosJson] = await Promise.all([
        agentsRes.json().catch(() => ({})),
        macrosRes.json().catch(() => ({})),
      ]);
      if (agentsRes.ok) {
        const aList = agentsJson.agents || agentsJson.staff || agentsJson.data?.agents || [];
        if (Array.isArray(aList)) setAgents(aList);
      }
      if (macrosRes.ok) {
        const mList = macrosJson.macros || macrosJson.data?.macros || [];
        if (Array.isArray(mList)) setMacros(mList);
      }
    } catch {
      // Non-fatal metadata load
    }
  }, []);

  const loadSwitches = useCallback(async () => {
    setLoadingSwitches(true);
    try {
      const [chatSysRes, togglesRes] = await Promise.all([
        fetch(`${API_BASE}/admin/chat-system`, { credentials: 'include', headers: getAuthHeaders() }),
        fetch(`${API_BASE}/admin/support/toggles`, { credentials: 'include', headers: getAuthHeaders() }).catch(() => null),
      ]);
      const [json, togglesJson] = await Promise.all([
        chatSysRes.json().catch(() => ({})),
        togglesRes?.json?.().catch(() => ({})) || Promise.resolve({}),
      ]);
      const settings = json.settings || json.data?.settings || json.config || json || {};
      const incomingSwitches = {
        ...(settings.switches || settings.featureSwitches || settings),
        ...(togglesJson?.toggles || togglesJson || {}),
      };
      setSwitches((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.keys(DEFAULT_SWITCHES)
            .filter((k) => typeof incomingSwitches?.[k] === 'boolean')
            .map((k) => [k, incomingSwitches[k]])
        ),
      }));
    } catch {
      // Ignore if endpoint unavailable
    } finally {
      setLoadingSwitches(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/admin/support/live-chats?status=waiting`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.counts) setLiveChatCounts(d.counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    loadAgentsAndMacros();
    loadSwitches();
  }, [loadAgentsAndMacros, loadSwitches]);

  const loadTicketDetail = useCallback(async (ticketId, options = {}) => {
    const silent = Boolean(options?.silent);
    if (!ticketId) {
      setActiveTicket(null);
      return;
    }
    if (!silent) setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketId)}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        if (res.status === 403 || res.status === 404) {
          setActiveTicket(null);
          setSelectedTicketId(null);
        }
        throw new Error(json.error || 'Could not load ticket details.');
      }
      const rawTicket = json.ticket || json.data?.ticket || json.data || json;
      const mergedMessages = Array.isArray(json.messages)
        ? json.messages
        : Array.isArray(json.replies)
          ? json.replies
          : Array.isArray(rawTicket.replies)
            ? rawTicket.replies
            : Array.isArray(rawTicket.messages)
              ? rawTicket.messages
              : [];
      const mergedEvents = Array.isArray(json.events)
        ? json.events
        : Array.isArray(rawTicket.auditHistory)
          ? rawTicket.auditHistory
          : Array.isArray(rawTicket.events)
            ? rawTicket.events
            : Array.isArray(rawTicket.history)
              ? rawTicket.history
              : [];
      const detail = {
        ...rawTicket,
        replies: mergedMessages,
        messages: mergedMessages,
        auditHistory: mergedEvents,
        events: mergedEvents,
        ...(Array.isArray(json.subTickets) ? { subTickets: json.subTickets } : {}),
        ...(json.parentTicket !== undefined ? { parentTicket: json.parentTicket } : {}),
      };
      setActiveTicket(detail);
      setViewers(Array.isArray(detail.viewers) ? detail.viewers : Array.isArray(json.viewers) ? json.viewers : []);
      if (!silent) {
        setEditForm({
          subject: detail.subject || '',
          category: detail.category || 'General Inquiry',
          priority: detail.priority || 'Medium',
          status: detail.status || 'Open',
          department: detail.department || 'Customer Support',
          escalationTier: String(detail.escalationTier || '1'),
          tagsText: Array.isArray(detail.tags) ? detail.tags.join(', ') : '',
        });
      }
    } catch (err) {
      if (!silent) {
        showToast?.(err.message || 'Could not load ticket thread.', 'error');
      }
    } finally {
      if (!silent) setLoadingDetail(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    } else {
      setActiveTicket(null);
    }
  }, [selectedTicketId, loadTicketDetail]);

  // Silent 6s ticket thread sync while viewing a ticket
  useEffect(() => {
    if (deskSection !== 'desk' || !selectedTicketId) return undefined;
    const timer = window.setInterval(() => {
      loadTicketDetail(selectedTicketId, { silent: true });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [deskSection, selectedTicketId, loadTicketDetail]);

  // Collision prevention heartbeat
  useEffect(() => {
    if (!selectedTicketId || deskSection !== 'desk') return undefined;
    let active = true;
    const pingView = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(selectedTicketId)}/view`, {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: '{}',
        });
        const json = await res.json().catch(() => ({}));
        if (active && res.ok) {
          const list = json.viewers || json.data?.viewers || [];
          if (Array.isArray(list)) setViewers(list);
        }
      } catch {
        // Ignore collision ping errors
      }
    };
    pingView();
    const timer = setInterval(pingView, 25000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedTicketId, deskSection]);

  const handleCopySerial = async (serial, e) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(serial);
      setCopiedSerial(serial);
      setTimeout(() => setCopiedSerial(''), 1800);
      showToast?.(`Copied ${serial}`, 'success');
    } catch {
      showToast?.('Could not copy ticket reference ID.', 'error');
    }
  };

  const handleSelectTicket = (ticket) => {
    const id = ticket.id || ticket.ticketId;
    setSelectedTicketId(id);
    setMobilePane('thread');
    setEditDrawerOpen(false);
    setEditingReplyId(null);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === tickets.length && tickets.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tickets.map((t) => t.id || t.ticketId));
    }
  };

  const handleToggleRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkAction = async (actionPayload) => {
    if (!selectedIds.length) return;
    setBulkWorking(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/bulk`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ticketIds: selectedIds,
          ...actionPayload,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Bulk action failed.');
      }
      showToast?.(`Updated ${selectedIds.length} ticket(s).`, 'success');
      setSelectedIds([]);
      setBulkTag('');
      await loadTickets();
      if (selectedTicketId) await loadTicketDetail(selectedTicketId);
    } catch (err) {
      showToast?.(err.message || 'Bulk action failed.', 'error');
    } finally {
      setBulkWorking(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (activeQueue && activeQueue !== 'all') params.set('queue', activeQueue);
      if (appliedSearch) params.set('q', appliedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);

      const res = await fetch(`${API_BASE}/admin/support/export.csv?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `CSV export failed (${res.status}).`);
      }
      const csvBlob = await res.blob();
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiwlo-support-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast?.('Support tickets CSV exported.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Could not export CSV.', 'error');
    }
  };

  const handleSavePreset = (e) => {
    e.preventDefault();
    const clean = presetName.trim();
    if (!clean) return;
    const next = [
      ...savedPresets,
      {
        id: `preset_${Date.now()}`,
        name: clean,
        queue: activeQueue,
        status: statusFilter,
        priority: priorityFilter,
        category: categoryFilter,
      },
    ];
    setSavedPresets(next);
    try {
      localStorage.setItem('tiwlo_support_filter_presets', JSON.stringify(next));
    } catch {
      // Ignore storage quota
    }
    setPresetName('');
    setPresetModalOpen(false);
    showToast?.(`Saved filter preset "${clean}".`, 'success');
  };

  const handleApplyPreset = (preset) => {
    setActiveQueue(preset.queue || 'all');
    setStatusFilter(preset.status || 'all');
    setPriorityFilter(preset.priority || 'all');
    setCategoryFilter(preset.category || 'all');
  };

  const handleDeletePreset = (id) => {
    const next = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(next);
    try {
      localStorage.setItem('tiwlo_support_filter_presets', JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleAssignAgent = async (agentId, { requireAcceptance = true } = {}) => {
    if (!activeTicket) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(activeTicket.id || activeTicket.ticketId)}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          assignedAgentId: agentId || null,
          agentId: agentId || null,
          assignedTo: agentId || null,
          requireAcceptance: Boolean(requireAcceptance),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not update assignment.');
      }
      setAssignPopoverOpen(false);
      showToast?.(
        !agentId
          ? 'Ticket unassigned.'
          : requireAcceptance
            ? 'Assignment requested — awaiting staff acceptance.'
            : 'Ticket assigned successfully.',
        'success'
      );
      await Promise.all([loadTicketDetail(activeTicket.id || activeTicket.ticketId), loadTickets()]);
    } catch (err) {
      showToast?.(err.message || 'Assignment update failed.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleAiWriteTicket = async () => {
    if (!activeTicket || !composerText.trim()) return;
    setAiWriting(true);
    try {
      const ticketKey = activeTicket.id || activeTicket.ticketId;
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketKey)}/ai-assist`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ mode: 'polish_reply', draft: composerText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false || !json.suggestion) {
        throw new Error(json.error || 'AI Write could not polish the draft.');
      }
      setComposerText(String(json.suggestion).trim());
      showToast?.('AI polished your reply following Tiwlo Brand Guidelines — review and send when ready.', 'success');
    } catch (err) {
      showToast?.(err.message || 'AI Write failed.', 'error');
    } finally {
      setAiWriting(false);
    }
  };

  const handlePatchTicket = async (updates, successMessage = 'Ticket updated.') => {
    if (!activeTicket) return false;
    setSavingTicketMeta(true);
    try {
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(activeTicket.id || activeTicket.ticketId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(updates),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to update ticket.');
      }
      showToast?.(successMessage, 'success');
      await Promise.all([loadTicketDetail(activeTicket.id || activeTicket.ticketId), loadTickets()]);
      return true;
    } catch (err) {
      showToast?.(err.message || 'Failed to update ticket.', 'error');
      return false;
    } finally {
      setSavingTicketMeta(false);
    }
  };

  const handleSaveEditDrawer = async (e) => {
    e.preventDefault();
    const tags = editForm.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const ok = await handlePatchTicket(
      {
        subject: editForm.subject.trim(),
        category: editForm.category,
        priority: editForm.priority,
        status: editForm.status,
        department: editForm.department,
        escalationTier: Number(editForm.escalationTier || 1),
        tags,
      },
      'Ticket properties saved.'
    );
    if (ok) setEditDrawerOpen(false);
  };

  const handleSendReply = async (targetStatus = null) => {
    if (!activeTicket || !composerText.trim()) return;
    if (isClosedStatus(activeTicket.status) && switches.lockClosedReplies !== false) {
      showToast?.('Ticket is closed. Reopen it before posting a reply.', 'error');
      return;
    }
    setSendingReply(true);
    try {
      const ticketKey = activeTicket.id || activeTicket.ticketId;
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketKey)}/replies`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          body: composerText.trim(),
          message: composerText.trim(),
          isInternal: composerMode === 'internal',
          visibility: composerMode === 'internal' ? 'internal' : 'public',
          ...(targetStatus ? { nextStatus: targetStatus, status: targetStatus } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to post reply.');
      }
      setComposerText('');
      if (json.reply) {
        setActiveTicket((prev) => {
          if (!prev) return prev;
          const existing = Array.isArray(prev.replies)
            ? prev.replies
            : Array.isArray(prev.messages)
              ? prev.messages
              : [];
          const nextReplies = existing.some((r) => r.id && r.id === json.reply.id)
            ? existing
            : [...existing, json.reply];
          return {
            ...prev,
            ...(json.ticket || {}),
            replies: nextReplies,
            messages: nextReplies,
          };
        });
      }
      showToast?.(composerMode === 'internal' ? 'Internal note added.' : 'Reply sent to customer.', 'success');
      await Promise.all([loadTicketDetail(ticketKey, { silent: true }), loadTickets()]);
    } catch (err) {
      showToast?.(err.message || 'Could not send reply.', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSaveReplyEdit = async (replyId) => {
    if (!activeTicket || !editingReplyText.trim()) return;
    setSavingReplyEdit(true);
    try {
      const ticketKey = activeTicket.id || activeTicket.ticketId;
      const res = await fetch(
        `${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketKey)}/replies/${encodeURIComponent(replyId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ body: editingReplyText.trim(), message: editingReplyText.trim() }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not edit reply.');
      }
      setEditingReplyId(null);
      setEditingReplyText('');
      showToast?.('Reply updated with revision recorded.', 'success');
      await loadTicketDetail(ticketKey);
    } catch (err) {
      showToast?.(err.message || 'Could not edit reply.', 'error');
    } finally {
      setSavingReplyEdit(false);
    }
  };

  const handleInsertMacro = (macro) => {
    const customerName = activeTicket?.userName || activeTicket?.customer?.name || 'Customer';
    const serial = getTicketSerial(activeTicket);
    const agentName = currentUser?.name || 'Support Specialist';
    const interpolated = String(macro.body || '')
      .replaceAll('{{customerName}}', customerName)
      .replaceAll('{{ticketId}}', serial)
      .replaceAll('{{serialNumber}}', serial)
      .replaceAll('{{agentName}}', agentName);
    setComposerText((prev) => (prev ? `${prev}\n\n${interpolated}` : interpolated));
    setMacroDrawerOpen(false);
  };

  const handleSaveMacro = async (e) => {
    e.preventDefault();
    if (!macroForm.title.trim() || !macroForm.body.trim()) return;
    setSavingMacro(true);
    try {
      const isEdit = Boolean(editingMacro?.id);
      const url = isEdit
        ? `${API_BASE}/admin/support/macros/${encodeURIComponent(editingMacro.id)}`
        : `${API_BASE}/admin/support/macros`;
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: macroForm.title.trim(),
          category: macroForm.category.trim() || 'General',
          body: macroForm.body.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to save macro.');
      }
      setMacroModalOpen(false);
      setEditingMacro(null);
      setMacroForm({ title: '', category: 'General', body: '' });
      showToast?.(isEdit ? 'Macro updated.' : 'Macro created.', 'success');
      await loadAgentsAndMacros();
    } catch (err) {
      showToast?.(err.message || 'Could not save macro.', 'error');
    } finally {
      setSavingMacro(false);
    }
  };

  const handleDeleteMacro = async (macroId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/support/macros/${encodeURIComponent(macroId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Failed to delete macro.');
      }
      showToast?.('Macro deleted.', 'success');
      await loadAgentsAndMacros();
    } catch (err) {
      showToast?.(err.message || 'Could not delete macro.', 'error');
    }
  };

  const handleMergeTicket = async (e) => {
    e.preventDefault();
    if (!activeTicket || !mergeTargetId.trim()) return;
    setMergeWorking(true);
    try {
      const ticketKey = activeTicket.id || activeTicket.ticketId;
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketKey)}/merge`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ targetTicketId: mergeTargetId.trim(), mergeIntoId: mergeTargetId.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not merge ticket.');
      }
      setMergeModalOpen(false);
      setMergeTargetId('');
      showToast?.('Ticket merged successfully.', 'success');
      await Promise.all([loadTickets(), loadTicketDetail(ticketKey)]);
    } catch (err) {
      showToast?.(err.message || 'Ticket merge failed.', 'error');
    } finally {
      setMergeWorking(false);
    }
  };

  const handleCreateSubticket = async (e) => {
    e.preventDefault();
    if (!activeTicket || !subticketForm.subject.trim()) return;
    setSubticketWorking(true);
    try {
      const ticketKey = activeTicket.id || activeTicket.ticketId;
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketKey)}/subticket`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(subticketForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not create sub-ticket.');
      }
      setSubticketModalOpen(false);
      setSubticketForm({ subject: '', description: '', priority: 'Medium', department: 'Customer Support' });
      showToast?.('Sub-ticket created.', 'success');
      await Promise.all([loadTickets(), loadTicketDetail(ticketKey)]);
    } catch (err) {
      showToast?.(err.message || 'Sub-ticket creation failed.', 'error');
    } finally {
      setSubticketWorking(false);
    }
  };

  const handleLinkGuestUser = async (e) => {
    e.preventDefault();
    if (!activeTicket || !linkUserIdentifier.trim()) return;
    setLinkingUser(true);
    try {
      const ticketKey = activeTicket.id || activeTicket.ticketId;
      const res = await fetch(`${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketKey)}/link-user`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ identifier: linkUserIdentifier.trim(), email: linkUserIdentifier.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not link account.');
      }
      setLinkUserIdentifier('');
      showToast?.('Guest ticket linked to verified Tiwlo account.', 'success');
      await Promise.all([loadTickets(), loadTicketDetail(ticketKey)]);
    } catch (err) {
      showToast?.(err.message || 'Account linking failed.', 'error');
    } finally {
      setLinkingUser(false);
    }
  };

  const handleAcceptAssignment = async (ticketId, e) => {
    e?.stopPropagation();
    if (!ticketId || acceptingAssignmentId) return;
    setAcceptingAssignmentId(ticketId);
    try {
      const res = await fetch(
        `${API_BASE}/admin/support/tickets/${encodeURIComponent(ticketId)}/accept-assignment`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: '{}',
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not accept ticket assignment.');
      }
      showToast?.('Assignment accepted.', 'success');
      await loadTickets();
      if (selectedTicketId === ticketId) await loadTicketDetail(ticketId);
    } catch (err) {
      showToast?.(err.message || 'Assignment accept failed.', 'error');
    } finally {
      setAcceptingAssignmentId('');
    }
  };

  const handleSaveSwitches = async (nextSwitches) => {
    setSwitches(nextSwitches);
    setSavingSwitches(true);
    try {
      const headers = getAuthHeaders({ 'Content-Type': 'application/json' });
      headers['x-tiwlo-reauth-grant'] = await requestSensitiveActionGrant(headers, API_ORIGIN);
      const [resChat, resToggles] = await Promise.all([
        fetch(`${API_BASE}/admin/chat-system/settings`, {
          method: 'PUT',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            ...nextSwitches,
            switches: nextSwitches,
          }),
        }),
        fetch(`${API_BASE}/admin/support/toggles`, {
          method: 'PUT',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            toggles: nextSwitches,
            ...nextSwitches,
          }),
        }).catch(() => null),
      ]);
      const json = await resChat.json().catch(() => ({}));
      if (!resChat.ok || json.success === false) {
        if (!resToggles || !resToggles.ok) {
          throw new Error(json.error || 'Could not save support feature switches.');
        }
      }
      showToast?.('Support & chat switches synced.', 'success');
    } catch (err) {
      showToast?.(err.message || 'Could not save feature switches.', 'error');
      await loadSwitches();
    } finally {
      setSavingSwitches(false);
    }
  };

  const pagedTickets = useMemo(() => {
    const start = (ticketPage - 1) * ticketPageSize;
    return tickets.slice(start, start + ticketPageSize);
  }, [tickets, ticketPage, ticketPageSize]);

  useEffect(() => {
    setTicketPage(1);
  }, [activeQueue, appliedSearch, statusFilter, priorityFilter, categoryFilter, ticketPageSize]);

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) =>
      `${a.name || ''} ${a.email || ''} ${a.roleTitle || a.role || ''} ${a.department || ''}`.toLowerCase().includes(q)
    );
  }, [agents, agentSearch]);

  const timelineItems = useMemo(() => {
    if (!activeTicket) return [];
    const replies = Array.isArray(activeTicket.replies)
      ? activeTicket.replies
      : Array.isArray(activeTicket.messages)
        ? activeTicket.messages
        : [];
    const audit = Array.isArray(activeTicket.auditHistory)
      ? activeTicket.auditHistory
      : Array.isArray(activeTicket.history)
        ? activeTicket.history
        : [];
    const normalizedReplies = replies.map((r, idx) => ({
      ...r,
      _kind: 'reply',
      _id: r.id || `rep_${idx}`,
      _ts: Date.parse(r.createdAt || r.timestamp || 0) || idx,
    }));
    const normalizedAudit = audit.map((ev, idx) => ({
      ...ev,
      _kind: 'audit',
      _id: ev.id || `aud_${idx}`,
      _ts: Date.parse(ev.createdAt || ev.timestamp || 0) || idx,
    }));
    return [...normalizedReplies, ...normalizedAudit].sort((a, b) => a._ts - b._ts);
  }, [activeTicket]);

  const kpiCards = useMemo(() => {
    const guestCount = stats?.guestCount ?? stats?.guestTickets ?? null;
    const merchantCount = stats?.registeredCount ?? stats?.merchantTickets ?? null;
    const guestVsMerchant =
      guestCount != null || merchantCount != null
        ? `${guestCount ?? 0} / ${merchantCount ?? 0}`
        : '—';
    return [
      { label: 'Total Open', value: stats?.totalOpen ?? stats?.openCount ?? 0 },
      { label: 'Unassigned Queue', value: stats?.unassigned ?? stats?.unassignedCount ?? 0 },
      { label: 'Guest vs Verified', value: guestVsMerchant },
      { label: 'SLA Breached / At-Risk', value: stats?.slaAtRisk ?? stats?.slaBreached ?? 0 },
      { label: 'Avg First Response', value: formatDurationMinutes(stats?.avgFirstResponseMinutes ?? stats?.avgFirstResponseMins) },
      { label: 'Avg CSAT Score', value: stats?.avgCsat != null ? `${Number(stats.avgCsat).toFixed(1)} / 5` : '—' },
    ];
  }, [stats]);

  const activeAgent = resolveAgentObj(activeTicket, agents);
  const ticketClosed = isClosedStatus(activeTicket?.status);
  const lockClosed = ticketClosed && switches.lockClosedReplies !== false;
  const ticketAssignmentStatus = String(
    activeTicket?.assignmentStatus || activeTicket?.metadata?.assignmentStatus || ''
  ).toLowerCase();
  const isTicketAccepted = ticketAssignmentStatus === 'accepted' && Boolean(activeTicket?.assignedAgentId);
  const currentActorId = currentUser?.id ? String(currentUser.id) : '';
  const pendingAssigneeId = activeTicket?.metadata?.pendingAssigneeId ? String(activeTicket.metadata.pendingAssigneeId) : '';
  const pendingAssigneeName = activeTicket?.metadata?.pendingAssigneeName || '';
  const canAcceptPending = !pendingAssigneeId || pendingAssigneeId === currentActorId || isSuperAdmin;
  const isTicketOwnedByMe = Boolean(
    activeTicket?.assignedAgentId && currentActorId && String(activeTicket.assignedAgentId) === currentActorId
  );
  const isTicketLockedToOther = Boolean(
    !isSuperAdmin && activeTicket?.assignedAgentId && !isTicketOwnedByMe
  );
  const needsTicketAcceptance = Boolean(
    activeTicket && !ticketClosed && !isSuperAdmin && !isTicketAccepted && !isTicketLockedToOther
  );
  const otherViewers = viewers.filter(
    (v) => (v.userId || v.id) !== currentUser?.id && (v.email || '') !== currentUser?.email
  );
  const customerInfo = activeTicket?.customer || activeTicket?.customerProfile || activeTicket?.userProfile || null;
  const isActiveGuest = isGuestTicket(activeTicket);
  const ticketTags = Array.isArray(activeTicket?.tags) ? activeTicket.tags : [];
  const ticketWatchers = Array.isArray(activeTicket?.watchers) ? activeTicket.watchers : [];
  const ticketAttachments = Array.isArray(activeTicket?.attachments) ? activeTicket.attachments : [];

  return (
    <div className="space-y-4">
      {/* Top Bar + Prominent Reference ID Search */}
      <div className="rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Dashboard
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                Support Desk Console
              </h1>
              <span className="rounded-full border border-[#1ED760]/30 bg-[#1ED760]/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                Live Operations
              </span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              Manage guest &amp; user tickets, SLA compliance, internal notes, staff assignments, and canned macros.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Section Tabs */}
            <div className="inline-flex flex-wrap rounded-xl border border-neutral-200/80 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
              <button
                type="button"
                onClick={() => setDeskSection('live-chats')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  deskSection === 'live-chats'
                    ? 'bg-[#1ED760] font-semibold text-black'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                <Headphones className="h-3.5 w-3.5" />
                <span>Live Chat Queue</span>
                {(liveChatCounts?.waiting || 0) > 0 && (
                  <span className="rounded-full bg-neutral-950 px-1.5 py-0.5 text-[10px] font-bold text-[#1ED760] tabular-nums">
                    {liveChatCounts.waiting}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setDeskSection('desk')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  deskSection === 'desk'
                    ? 'bg-[#1ED760] font-semibold text-black'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                <Inbox className="h-3.5 w-3.5" />
                Formal Tickets
              </button>
              <button
                type="button"
                onClick={() => setDeskSection('performance')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  deskSection === 'performance'
                    ? 'bg-[#1ED760] font-semibold text-black'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                <Award className="h-3.5 w-3.5" />
                Staff &amp; Forensics
              </button>
              <button
                type="button"
                onClick={() => setDeskSection('macros')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  deskSection === 'macros'
                    ? 'bg-[#1ED760] font-semibold text-black'
                    : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                Macros
              </button>
              {canManageSystemSettings && (
                <button
                  type="button"
                  onClick={() => setDeskSection('switches')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    deskSection === 'switches'
                      ? 'bg-[#1ED760] font-semibold text-black'
                      : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Toggles &amp; AI Pool
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Download className="h-3.5 w-3.5" />
              CSV Export
            </button>
            <button
              type="button"
              onClick={() => {
                loadTickets();
                if (selectedTicketId) loadTicketDetail(selectedTicketId);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Prominent Reference ID & Multi-Field Search Bar */}
        {deskSection === 'desk' && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setAppliedSearch(searchInput.trim());
                }}
                placeholder="Search by Ticket Reference ID (#TWTK-1024 or TWTK-1024), internal ID, customer email, phone, name, agent, or subject..."
                className="h-10 w-full rounded-xl border border-neutral-200/80 bg-neutral-50 pl-10 pr-20 text-xs text-neutral-900 outline-none transition focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:focus:bg-neutral-950"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setAppliedSearch('');
                  }}
                  aria-label="Clear search"
                  className="absolute right-14 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setAppliedSearch(searchInput.trim())}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[#1ED760] px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-[#19c354]"
              >
                Find
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Strip (hidden while inspecting a thread/customer on mobile for clean full-page chat view) */}
      <div className={`grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 lg:grid-cols-6 ${deskSection === 'desk' && mobilePane !== 'queue' ? 'hidden xl:grid' : 'grid'}`}>
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-neutral-200/80 bg-white px-3.5 py-3 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-neutral-950 dark:text-white">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {deskSection === 'macros' && (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Canned Responses &amp; Support Macros
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Supports dynamic placeholders: <code>{'{{customerName}}'}</code>, <code>{'{{ticketId}}'}</code>, and <code>{'{{agentName}}'}</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMacro(null);
                setMacroForm({ title: '', category: 'General', body: '' });
                setMacroModalOpen(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354]"
            >
              <Plus className="h-3.5 w-3.5" />
              New Macro
            </button>
          </div>

          {macros.length === 0 ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              No canned macros created yet. Click &ldquo;New Macro&rdquo; to create your first response template.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {macros.map((macro) => (
                <div
                  key={macro.id}
                  className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/50"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-neutral-950 dark:text-white">{macro.title}</h3>
                        <span className="mt-1 inline-block rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                          {macro.category || 'General'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMacro(macro);
                            setMacroForm({ title: macro.title || '', category: macro.category || 'General', body: macro.body || '' });
                            setMacroModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                          title="Edit macro"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMacro(macro.id)}
                          className="rounded-lg p-1.5 text-neutral-500 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Delete macro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300 line-clamp-4">
                      {macro.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {deskSection === 'live-chats' && (
        <AdminLiveChatQueuePanel
          apiBase={API_BASE}
          currentUser={currentUser}
          isSuperAdmin={isSuperAdmin}
          aiEnabled={Boolean(switches.aiAgentDraftAssist || switches.aiAutoReply)}
          showToast={showToast}
          onCountsChange={setLiveChatCounts}
        />
      )}

      {deskSection === 'performance' && (
        <AdminStaffPerformancePanel apiBase={API_BASE} isSuperAdmin={isSuperAdmin} />
      )}

      {deskSection === 'switches' && canManageSystemSettings && (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Support &amp; Chat Feature Controls
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Real-time manual On/Off switches protected by admin re-authentication.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('system-settings')}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200/80 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                AI Keys &amp; Models
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {loadingSwitches ? (
            <div className="py-10 text-center text-xs text-neutral-500">Loading feature switches...</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {SUPPORT_FEATURE_SWITCHES.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200/80 bg-neutral-50/60 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-950 dark:text-white">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{item.description}</p>
                  </div>
                  <SwitchToggle
                    label={item.label}
                    checked={Boolean(switches[item.key])}
                    disabled={savingSwitches}
                    onChange={(val) => handleSaveSwitches({ ...switches, [item.key]: val })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {deskSection === 'desk' && (
        <>
          {/* Queue Tabs + Filters + Presets (hidden on mobile while reading a thread so chat gets full height) */}
          <div className={`space-y-3 rounded-xl border border-neutral-200/80 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-950 ${mobilePane !== 'queue' ? 'hidden xl:block' : 'block'}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUEUE_TABS.map((q) => {
                const active = activeQueue === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveQueue(q.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-[#1ED760] font-semibold text-black'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70 hover:text-neutral-900 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => onNavigate?.('pick-account-appeals')}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-[#1ED760] hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                PICK Appeals
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200/80 pt-3 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Filter className="h-3.5 w-3.5" />
                <span>Filters:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value="all">All Priorities</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-xs text-neutral-800 outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              >
                <option value="all">All Categories</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Saved Presets */}
              <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
                {[...BUILTIN_PRESETS, ...savedPresets].map((preset) => {
                  const isCustom = !BUILTIN_PRESETS.some((b) => b.id === preset.id);
                  return (
                    <span
                      key={preset.id}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="hover:text-[#159f46] dark:hover:text-[#1ED760]"
                      >
                        {preset.name}
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset.id)}
                          aria-label={`Remove preset ${preset.name}`}
                          className="text-neutral-400 hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPresetModalOpen(true)}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 text-[11px] font-medium text-neutral-600 hover:border-[#1ED760] hover:text-neutral-950 dark:border-neutral-700 dark:text-neutral-300"
                >
                  <Plus className="h-3 w-3" />
                  Save Preset
                </button>
              </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 p-2.5">
                <span className="px-2 text-xs font-semibold text-neutral-950 dark:text-white">
                  {selectedIds.length} selected
                </span>

                <select
                  value={bulkAgentId}
                  onChange={(e) => setBulkAgentId(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Assign agent...</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!bulkAgentId || bulkWorking}
                  onClick={() => handleBulkAction({ action: 'assign', agentId: bulkAgentId, assignedTo: bulkAgentId })}
                  className="h-8 rounded-lg bg-neutral-900 px-2.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  Assign
                </button>

                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="">Change status...</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!bulkStatus || bulkWorking}
                  onClick={() => handleBulkAction({ action: 'status', status: bulkStatus })}
                  className="h-8 rounded-lg bg-neutral-900 px-2.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  Apply Status
                </button>

                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={bulkTag}
                    onChange={(e) => setBulkTag(e.target.value)}
                    placeholder="Add tag..."
                    className="h-8 w-28 rounded-lg border border-neutral-200/80 bg-white px-2 text-xs text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    disabled={!bulkTag.trim() || bulkWorking}
                    onClick={() => handleBulkAction({ action: 'add_tag', tag: bulkTag.trim() })}
                    className="h-8 rounded-lg bg-neutral-900 px-2.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                  >
                    Tag
                  </button>
                </div>

                <button
                  type="button"
                  disabled={bulkWorking}
                  onClick={() => handleBulkAction({ action: 'close', status: 'Closed' })}
                  className="ml-auto h-8 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 disabled:opacity-40 dark:text-rose-300"
                >
                  Bulk Close
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="h-8 rounded-lg px-2 text-xs text-neutral-600 hover:text-neutral-950 dark:text-neutral-300"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {listError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              {listError}
            </div>
          )}

          {/* Mobile Pane Switcher */}
          <div className="flex rounded-xl border border-neutral-200/80 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-950 xl:hidden">
            {[
              { id: 'queue', label: `Queue (${tickets.length})` },
              { id: 'thread', label: activeTicket ? getTicketSerial(activeTicket) : 'Thread' },
              { id: 'customer', label: 'Customer 360°' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMobilePane(p.id)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                  mobilePane === p.id
                    ? 'bg-[#1ED760] font-semibold text-black'
                    : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 3-Pane Meta Support Console */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* LEFT PANE: Ticket Queue */}
            <div
              className={`${
                mobilePane === 'queue' ? 'block' : 'hidden xl:block'
              } rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950 xl:col-span-3`}
            >
              <div className="flex items-center justify-between border-b border-neutral-200/80 px-3.5 py-2.5 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white"
                >
                  {selectedIds.length === tickets.length && tickets.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-[#1ED760]" />
                  ) : (
                    <Square className="h-4 w-4 text-neutral-400" />
                  )}
                  <span>Tickets ({tickets.length})</span>
                </button>
                <span className="text-[11px] text-neutral-400">Newest first</span>
              </div>

              <div className="max-h-[64vh] divide-y divide-neutral-200/70 overflow-y-auto dark:divide-neutral-800/80">
                {loadingList && tickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">Loading support queue...</div>
                ) : pagedTickets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    No support tickets match the active queue or search query.
                  </div>
                ) : (
                  pagedTickets.map((ticket) => {
                    const tid = ticket.id || ticket.ticketId;
                    const serial = getTicketSerial(ticket);
                    const isSelected = selectedTicketId === tid || selectedTicketId === ticket.ticketId;
                    const isChecked = selectedIds.includes(tid);
                    const guest = isGuestTicket(ticket);
                    const rowAgent = resolveAgentObj(ticket, agents);
                    const sla = formatSlaLabel(ticket);
                    const isPendingAccept =
                      String(ticket.assignmentStatus || '').toLowerCase() === 'pending_acceptance' ||
                      String(ticket.status || '').toLowerCase() === 'pending_acceptance';

                    return (
                      <div
                        key={tid}
                        onClick={() => handleSelectTicket(ticket)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleSelectTicket(ticket);
                        }}
                        className={`cursor-pointer p-3.5 transition ${
                          isSelected
                            ? 'bg-[#1ED760]/8 border-l-2 border-l-[#1ED760] dark:bg-[#1ED760]/10'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => handleToggleRow(tid, e)}
                              aria-label={`Select ${serial}`}
                              className="shrink-0 text-neutral-400 hover:text-neutral-700"
                            >
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 text-[#1ED760]" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleCopySerial(serial, e)}
                              title="Copy Ticket Reference ID"
                              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-neutral-800 hover:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                            >
                              {serial}
                              {copiedSerial === serial ? (
                                <Check className="h-2.5 w-2.5 text-[#1ED760]" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 text-neutral-400" />
                              )}
                            </button>

                            {(ticket.unreadByStaff || ticket.unread) && (
                              <span
                                className="h-2 w-2 shrink-0 rounded-full bg-[#1ED760]"
                                title="Unread by staff"
                              />
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              guest
                                ? 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                                : 'border-[#1ED760]/30 bg-[#1ED760]/12 text-emerald-700 dark:text-[#1ED760]'
                            }`}
                          >
                            {guest ? 'Guest' : 'Tiwlo User'}
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-1 text-xs font-semibold text-neutral-950 dark:text-white">
                          {ticket.subject || 'Untitled Ticket'}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                          {ticket.userName || ticket.guestEmail || ticket.userEmail || 'Unknown Requester'}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusBadgeClass(ticket.status)}`}>
                            {ticket.status || 'Open'}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getPriorityBadgeClass(ticket.priority)}`}>
                            {ticket.priority || 'Medium'}
                          </span>
                          {isPendingAccept && (
                            <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                              Assign Request
                            </span>
                          )}
                          {sla && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                sla.toLowerCase().includes('breach')
                                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
                              }`}
                            >
                              <Clock className="h-2.5 w-2.5" />
                              {sla}
                            </span>
                          )}
                        </div>

                        {/* Assigned Agent Row */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-900">
                          {isPendingAccept ? (
                            <button
                              type="button"
                              disabled={acceptingAssignmentId === tid}
                              onClick={(e) => handleAcceptAssignment(tid, e)}
                              className="inline-flex h-6 items-center gap-1 rounded-md bg-red-600 px-2 text-[10px] font-semibold text-white hover:bg-red-700 cursor-pointer"
                            >
                              <UserCheck className="h-3 w-3" />
                              {acceptingAssignmentId === tid ? 'Accepting...' : 'Accept Assignment'}
                            </button>
                          ) : rowAgent ? (
                            <div className="flex min-w-0 items-center gap-1.5">
                              <StaffAvatar agent={rowAgent} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                                  {rowAgent.name}
                                </p>
                                <p className="truncate text-[10px] text-neutral-400">
                                  {rowAgent.roleTitle || rowAgent.role || 'Staff'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-neutral-400">Unassigned</span>
                          )}
                          <span className="shrink-0 text-[10px] text-neutral-400">
                            {formatDateTime(ticket.updatedAt || ticket.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <PaginationBar
                page={ticketPage}
                pageSize={ticketPageSize}
                total={tickets.length}
                onPageChange={setTicketPage}
                onPageSizeChange={setTicketPageSize}
                itemLabel="tickets"
              />
            </div>

            {/* CENTER PANE: Ticket Thread & Dual-Mode Composer */}
            <div
              className={`${
                mobilePane === 'thread' ? 'block' : 'hidden xl:block'
              } flex flex-col rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950 xl:col-span-6`}
            >
              {!activeTicket ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                  <MessageSquare className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                  <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">
                    {loadingDetail ? 'Loading ticket thread...' : 'Select a support ticket'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Choose a ticket from the queue on the left to inspect its timeline, assign staff, or reply.
                  </p>
                </div>
              ) : (
                <>
                  {/* Thread Header */}
                  <div className="border-b border-neutral-200/80 p-4 dark:border-neutral-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMobilePane('queue')}
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-600 xl:hidden dark:border-neutral-800 dark:text-neutral-300"
                        >
                          <ArrowLeft className="h-3 w-3" />
                          Queue
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleCopySerial(getTicketSerial(activeTicket), e)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-100 px-2.5 py-1 font-mono text-xs font-semibold text-neutral-900 hover:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                        >
                          {getTicketSerial(activeTicket)}
                          {copiedSerial === getTicketSerial(activeTicket) ? (
                            <Check className="h-3 w-3 text-[#1ED760]" />
                          ) : (
                            <Copy className="h-3 w-3 text-neutral-400" />
                          )}
                        </button>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getStatusBadgeClass(activeTicket.status)}`}>
                          {activeTicket.status || 'Open'}
                        </span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getPriorityBadgeClass(activeTicket.priority)}`}>
                          {activeTicket.priority || 'Medium'}
                        </span>
                        {otherViewers.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                            <Eye className="h-3 w-3" />
                            Viewed by {otherViewers.map((v) => v.name || v.email).join(', ')}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {!ticketClosed && !isTicketAccepted && !isTicketLockedToOther && (
                          <button
                            type="button"
                            disabled={acceptingAssignmentId === (activeTicket.id || activeTicket.ticketId)}
                            onClick={(e) => handleAcceptAssignment(activeTicket.id || activeTicket.ticketId, e)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-neutral-950 hover:bg-[#19c354] cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            {acceptingAssignmentId === (activeTicket.id || activeTicket.ticketId) ? 'Accepting...' : 'Accept Ticket'}
                          </button>
                        )}
                        {!isClosedStatus(activeTicket.status) && (
                          <button
                            type="button"
                            disabled={savingTicketMeta}
                            onClick={() => handlePatchTicket({ status: 'On Hold' }, 'Ticket moved to On Hold.')}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900 cursor-pointer"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            On Hold
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setContextDrawerOpen(true)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#1ED760]/40 bg-[#1ED760]/10 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-[#1ED760]/20 dark:text-[#1ED760] cursor-pointer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Customer Context
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditDrawerOpen((v) => !v)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setMergeModalOpen(true)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                        >
                          <GitMerge className="h-3.5 w-3.5" />
                          Merge
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubticketModalOpen(true)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200/80 px-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
                        >
                          <FolderGit2 className="h-3.5 w-3.5" />
                          Sub-Ticket
                        </button>
                      </div>
                    </div>

                    <h2 className="mt-2.5 text-base font-semibold text-neutral-950 dark:text-white">
                      {activeTicket.subject}
                    </h2>
                    {(activeTicket.category === 'PICK_ACCOUNT_APPEAL' ||
                      activeTicket.isAppeal ||
                      String(customerInfo?.status || '').toLowerCase() === 'banned') && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/25 px-3 py-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
                        <Ban className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Banned Appeal Lock — Only the accepted specialist or Super Admin may unban or resolve this appeal.
                        </span>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
                      <span>Category: {activeTicket.category || 'General'}</span>
                      <span>•</span>
                      <span>Department: {activeTicket.department || 'Customer Support'}</span>
                      <span>•</span>
                      <span>Tier {activeTicket.escalationTier || 1}</span>
                    </div>

                    {/* Staff Assignment Bar */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/50">
                      <div className="relative" ref={assignPopoverRef}>
                        <button
                          type="button"
                          onClick={() => setAssignPopoverOpen((o) => !o)}
                          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/80 bg-white px-2.5 py-1.5 text-left text-xs transition hover:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-950"
                        >
                          {activeAgent ? (
                            <>
                              <StaffAvatar agent={activeAgent} size="sm" />
                              <div>
                                <p className="font-semibold text-neutral-900 dark:text-white leading-tight">
                                  {activeAgent.name}
                                </p>
                                <p className="text-[10px] text-neutral-500 leading-tight">
                                  {activeAgent.roleTitle || activeAgent.role || 'Support Staff'}
                                  {activeAgent.department ? ` • ${activeAgent.department}` : ''}
                                </p>
                              </div>
                            </>
                          ) : pendingAssigneeId ? (
                            <span className="font-medium text-amber-600 dark:text-amber-400">
                              Pending Accept: {pendingAssigneeName || 'Specialist'}
                            </span>
                          ) : (
                            <span className="font-medium text-neutral-500">Unassigned — Choose Staff</span>
                          )}
                          <ChevronDown className="ml-1 h-3.5 w-3.5 text-neutral-400" />
                        </button>

                        {assignPopoverOpen && (
                          <div className="absolute left-0 top-full z-30 mt-1.5 w-80 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                            <input
                              type="text"
                              value={agentSearch}
                              onChange={(e) => setAgentSearch(e.target.value)}
                              placeholder="Filter staff by name, role, or dept..."
                              className="mb-2 h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                            />
                            <div className="max-h-60 space-y-1 overflow-y-auto">
                              {filteredAgents.length === 0 ? (
                                <p className="p-3 text-center text-xs text-neutral-400">No matching staff found.</p>
                              ) : (
                                filteredAgents.map((agent) => (
                                  <button
                                    key={agent.id}
                                    type="button"
                                    disabled={assigning}
                                    onClick={() => handleAssignAgent(agent.id)}
                                    className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-900"
                                  >
                                    <StaffAvatar agent={agent} size="md" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-neutral-950 dark:text-white">
                                        {agent.name}
                                      </p>
                                      <p className="truncate text-[10px] text-neutral-500">
                                        {agent.roleTitle || agent.role || 'Staff'}
                                        {agent.tier ? ` • Tier ${agent.tier}` : ''}
                                        {agent.department ? ` • ${agent.department}` : ''}
                                      </p>
                                    </div>
                                    {(activeAgent?.id === agent.id || activeTicket.assignedAgentId === agent.id) && (
                                      <Check className="h-3.5 w-3.5 text-[#1ED760]" />
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={assigning || !currentUser?.id}
                          onClick={(e) => handleAcceptAssignment(activeTicket.id || activeTicket.ticketId, e)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1ED760]/15 px-2.5 text-[11px] font-semibold text-emerald-800 hover:bg-[#1ED760]/25 disabled:opacity-40 dark:text-[#1ED760]"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Accept &amp; Assign to Me
                        </button>
                        {activeAgent && (
                          <button
                            type="button"
                            disabled={assigning}
                            onClick={() => handleAssignAgent(null)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            Unassign
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Edit Ticket Drawer */}
                    {editDrawerOpen && (
                      <form
                        onSubmit={handleSaveEditDrawer}
                        className="mt-3 space-y-3 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900"
                      >
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Subject
                            </label>
                            <input
                              type="text"
                              required
                              value={editForm.subject}
                              onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Status
                            </label>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Priority
                            </label>
                            <select
                              value={editForm.priority}
                              onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))}
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            >
                              {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Category
                            </label>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            >
                              {CATEGORY_OPTIONS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Department
                            </label>
                            <select
                              value={editForm.department}
                              onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            >
                              {DEPARTMENT_OPTIONS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Escalation Tier
                            </label>
                            <select
                              value={editForm.escalationTier}
                              onChange={(e) => setEditForm((f) => ({ ...f, escalationTier: e.target.value }))}
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            >
                              <option value="1">Tier 1 — Frontline</option>
                              <option value="2">Tier 2 — Technical Lead</option>
                              <option value="3">Tier 3 — Engineering / Trust</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                              Tags (comma separated)
                            </label>
                            <input
                              type="text"
                              value={editForm.tagsText}
                              onChange={(e) => setEditForm((f) => ({ ...f, tagsText: e.target.value }))}
                              placeholder="billing, vip, urgent"
                              className="h-8 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditDrawerOpen(false)}
                            className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingTicketMeta}
                            className="h-8 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
                          >
                            {savingTicketMeta ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Structured Replies Timeline */}
                  <div className="flex-1 space-y-3 overflow-y-auto p-3.5 sm:p-4 min-h-[46dvh] max-h-[60dvh] xl:min-h-[340px] xl:max-h-[48vh]">
                    {/* Original Ticket Description */}
                    {activeTicket.description && (
                      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                            {activeTicket.userName || activeTicket.guestEmail || 'Requester'}
                            <span className="ml-2 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                              {isActiveGuest ? 'Guest Inquiry' : 'Initial Ticket'}
                            </span>
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            {formatDateTime(activeTicket.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-200">
                          {activeTicket.description}
                        </p>
                      </div>
                    )}

                    {timelineItems.map((item) => {
                      if (item._kind === 'audit') {
                        return (
                          <div key={item._id} className="flex items-center gap-2 px-2 py-1 text-[11px] text-neutral-500">
                            <History className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                            <span className="flex-1">
                              <strong className="font-medium text-neutral-700 dark:text-neutral-300">
                                {item.actorName || item.actor || 'System'}
                              </strong>{' '}
                              {item.summary || item.action || item.detail}
                            </span>
                            <span className="shrink-0 text-[10px] text-neutral-400">
                              {formatDateTime(item.createdAt || item.timestamp)}
                            </span>
                          </div>
                        );
                      }

                      const isInternal = Boolean(item.isInternal || item.visibility === 'internal');
                      const senderTypeLower = String(item.senderType || item.sender || item.senderRole || '').toLowerCase();
                      const isBot = !isInternal && (senderTypeLower === 'bot' || senderTypeLower === 'ai');
                      const isCustomer =
                        !isInternal &&
                        !isBot &&
                        ['user', 'customer', 'guest', 'requester'].includes(senderTypeLower);
                      const revisions = Array.isArray(item.editHistory)
                        ? item.editHistory
                        : Array.isArray(item.revisions)
                          ? item.revisions
                          : [];

                      return (
                        <div
                          key={item._id}
                          className={`rounded-xl border p-3.5 ${
                            isInternal
                              ? 'border-slate-300/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50'
                              : isCustomer
                                ? 'border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/40'
                                : isBot
                                  ? 'border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-900/40 dark:bg-indigo-950/20'
                                  : 'border-[#1ED760]/30 bg-[#1ED760]/6 dark:border-[#1ED760]/25 dark:bg-[#1ED760]/8'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {isBot ? (
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                  <Sparkles className="h-3.5 w-3.5" />
                                </span>
                              ) : !isCustomer ? (
                                <StaffAvatar
                                  agent={{
                                    name: item.authorName || item.senderName || 'Support Agent',
                                    avatar: item.authorAvatar,
                                  }}
                                  size="sm"
                                />
                              ) : null}
                              <span className="text-xs font-semibold text-neutral-950 dark:text-white">
                                {isBot
                                  ? item.authorName || item.senderName || 'Tiwi AI Assistant'
                                  : item.authorName ||
                                    item.senderName ||
                                    (isCustomer ? activeTicket.userName || 'Customer' : 'Support Agent')}
                              </span>
                              {isInternal ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  <Lock className="h-2.5 w-2.5" />
                                  Staff Only — Hidden from Customer
                                </span>
                              ) : isCustomer ? (
                                <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                                  {isActiveGuest ? 'Guest Reply' : 'Customer Reply'}
                                </span>
                              ) : isBot ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-100/80 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  <Sparkles className="h-2.5 w-2.5" />
                                  Tiwi AI Assistant
                                </span>
                              ) : (
                                <span className="rounded-full border border-[#1ED760]/30 bg-[#1ED760]/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-[#1ED760]">
                                  {item.authorRole || 'Support Agent'}
                                </span>
                              )}
                              {item.editedAt && (
                                <span className="text-[10px] text-neutral-400">(edited)</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-neutral-400">
                                {formatDateTime(item.createdAt || item.timestamp)}
                              </span>
                              {revisions.length > 0 && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenHistoryReplyId((cur) => (cur === item._id ? null : item._id))
                                    }
                                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800"
                                  >
                                    <History className="h-3 w-3" />
                                    {revisions.length}
                                  </button>
                                  {openHistoryReplyId === item._id && (
                                    <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                                      <p className="text-[11px] font-semibold text-neutral-900 dark:text-white">
                                        Revision History
                                      </p>
                                      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                                        {revisions.map((rev, rIdx) => (
                                          <div
                                            key={rIdx}
                                            className="rounded-lg border border-neutral-200/70 bg-neutral-50 p-2 text-[11px] dark:border-neutral-800 dark:bg-neutral-900"
                                          >
                                            <p className="text-[10px] text-neutral-400">
                                              {rev.editedBy || 'Staff'} • {formatDateTime(rev.editedAt)}
                                            </p>
                                            <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                                              {rev.previousBody || rev.body || rev.text}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReplyId(item._id);
                                  setEditingReplyText(item.body || item.message || item.text || '');
                                }}
                                title="Edit reply"
                                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-white"
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {editingReplyId === item._id ? (
                            <div className="mt-2.5 space-y-2">
                              <textarea
                                rows={3}
                                value={editingReplyText}
                                onChange={(e) => setEditingReplyText(e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 bg-white p-2 text-xs text-neutral-900 outline-none focus:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingReplyId(null)}
                                  className="rounded-lg border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingReplyEdit}
                                  onClick={() => handleSaveReplyEdit(item._id)}
                                  className="rounded-lg bg-[#1ED760] px-3 py-1 text-[11px] font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
                                >
                                  {savingReplyEdit ? 'Saving...' : 'Save Revision'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-800 dark:text-neutral-200">
                              {item.body || item.message || item.text}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Closed Ticket Lock OR Dual-Mode Composer */}
                  <div className="border-t border-neutral-200/80 p-4 dark:border-neutral-800">
                    {lockClosed ? (
                      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                            <Lock className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-neutral-950 dark:text-white">
                              Permanent Closed Lock Active
                            </p>
                            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                              This ticket is permanently closed. Replies and reopening are disabled even for administrators.
                            </p>
                          </div>
                        </div>

                        {canReopenClosed && (
                          <button
                            type="button"
                            disabled={savingTicketMeta}
                            onClick={() => handlePatchTicket({ status: 'Open' }, 'Ticket reopened.')}
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            {savingTicketMeta ? 'Reopening...' : 'Reopen Ticket'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex rounded-lg border border-neutral-200/80 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900">
                            <button
                              type="button"
                              onClick={() => setComposerMode('public')}
                              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                                composerMode === 'public'
                                  ? 'bg-[#1ED760] font-semibold text-black'
                                  : 'text-neutral-600 dark:text-neutral-300'
                              }`}
                            >
                              Public Reply
                            </button>
                            <button
                              type="button"
                              onClick={() => setComposerMode('internal')}
                              className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition ${
                                composerMode === 'internal'
                                  ? 'bg-slate-800 font-semibold text-white dark:bg-slate-700'
                                  : 'text-neutral-600 dark:text-neutral-300'
                              }`}
                            >
                              <Lock className="h-3 w-3" />
                              Internal Note
                            </button>
                          </div>

                          <div className="relative flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMacroDrawerOpen((o) => !o)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-2.5 text-xs font-medium text-neutral-700 hover:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                              Macros ({macros.length})
                            </button>

                            {macroDrawerOpen && (
                              <div className="absolute bottom-full right-0 z-30 mb-2 w-80 rounded-xl border border-neutral-200 bg-white p-2.5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-neutral-900 dark:text-white">
                                    Insert Canned Response
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMacroDrawerOpen(false);
                                      setEditingMacro(null);
                                      setMacroForm({ title: '', category: 'General', body: '' });
                                      setMacroModalOpen(true);
                                    }}
                                    className="text-[11px] font-semibold text-[#159f46] hover:underline dark:text-[#1ED760]"
                                  >
                                    + New Macro
                                  </button>
                                </div>
                                <div className="max-h-56 space-y-1 overflow-y-auto">
                                  {macros.length === 0 ? (
                                    <p className="p-3 text-center text-xs text-neutral-400">
                                      No macros yet. Create one to insert templates quickly.
                                    </p>
                                  ) : (
                                    macros.map((m) => (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => handleInsertMacro(m)}
                                        className="w-full rounded-lg border border-transparent p-2 text-left transition hover:border-[#1ED760]/40 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                      >
                                        <p className="text-xs font-semibold text-neutral-900 dark:text-white">{m.title}</p>
                                        <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-500">{m.body}</p>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {composerMode === 'public' && (isTicketLockedToOther || needsTicketAcceptance) ? (
                          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3.5 flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                              <Lock className="h-4 w-4 shrink-0 text-[#1ED760]" />
                              <span>
                                {isTicketLockedToOther
                                  ? `Exclusive Lock: Only ${activeTicket.assignedAgentName || 'the assigned specialist'} can post public replies.`
                                  : pendingAssigneeId && !canAcceptPending
                                    ? `Assignment requested for ${pendingAssigneeName || 'another specialist'}. Only they can accept and reply.`
                                    : 'Accept this ticket first to unlock public replies and lock it exclusively to you.'}
                              </span>
                            </div>
                            {needsTicketAcceptance && canAcceptPending && (
                              <button
                                type="button"
                                disabled={acceptingAssignmentId === (activeTicket.id || activeTicket.ticketId)}
                                onClick={(e) => handleAcceptAssignment(activeTicket.id || activeTicket.ticketId, e)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50 cursor-pointer"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                                Accept &amp; Lock Ticket
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <textarea
                              rows={4}
                              value={composerText}
                              onChange={(e) => setComposerText(e.target.value)}
                              placeholder={
                                composerMode === 'internal'
                                  ? 'Write an internal staff-only note (never visible to the customer)...'
                                  : 'Write a public reply to the customer...'
                              }
                              className={`w-full rounded-xl border p-3 text-xs outline-none transition ${
                                composerMode === 'internal'
                                  ? 'border-slate-300 bg-slate-50 text-neutral-900 focus:border-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white'
                                  : 'border-neutral-200/80 bg-neutral-50 text-neutral-900 focus:border-[#1ED760] focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-white'
                              }`}
                            />

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {composerMode === 'public' ? (
                                <button
                                  type="button"
                                  disabled={aiWriting || sendingReply || !composerText.trim()}
                                  onClick={handleAiWriteTicket}
                                  title="Polish your draft into a Tiwlo Brand-compliant reply right inside the box so you can review before sending"
                                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#1ED760]/40 bg-[#1ED760]/10 px-3 text-xs font-semibold text-emerald-800 hover:bg-[#1ED760]/20 disabled:opacity-40 dark:text-[#1ED760] cursor-pointer"
                                >
                                  <Wand2 className="h-3.5 w-3.5" />
                                  {aiWriting ? 'AI Writing...' : 'AI Write'}
                                </button>
                              ) : (
                                <span />
                              )}
                              <div className="flex flex-wrap items-center justify-end gap-2">
                              {composerMode === 'internal' ? (
                                <button
                                  type="button"
                                  disabled={!composerText.trim() || sendingReply}
                                  onClick={() => handleSendReply(null)}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-slate-200 dark:text-slate-950"
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                  {sendingReply ? 'Saving...' : 'Add Internal Note'}
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    disabled={!composerText.trim() || sendingReply || aiWriting}
                                    onClick={() => handleSendReply('Waiting Customer')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200/80 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                                  >
                                    Send &amp; Mark Waiting
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!composerText.trim() || sendingReply || aiWriting}
                                    onClick={() => handleSendReply('Resolved')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-40 dark:text-[#1ED760]"
                                  >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                    Send &amp; Resolve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!composerText.trim() || sendingReply || aiWriting}
                                    onClick={() => handleSendReply('Open')}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1ED760] px-4 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-40"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    {sendingReply ? 'Sending...' : 'Send & Keep Open'}
                                  </button>
                                </>
                              )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* RIGHT PANE: Customer 360° Sidebar */}
            <div
              className={`${
                mobilePane === 'customer' ? 'block' : 'hidden xl:block'
              } space-y-4 rounded-xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 xl:col-span-3`}
            >
              {!activeTicket ? (
                <div className="py-10 text-center text-xs text-neutral-400">
                  Select a ticket to inspect Customer 360° telemetry.
                </div>
              ) : (
                <>
                  {/* Requester Identity Card */}
                  <div className="space-y-3 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                        Customer 360°
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          isActiveGuest
                            ? 'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                            : 'border-[#1ED760]/30 bg-[#1ED760]/12 text-emerald-700 dark:text-[#1ED760]'
                        }`}
                      >
                        {isActiveGuest ? 'Guest Visitor' : 'Verified Account'}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                        {customerInfo?.name || activeTicket.userName || 'Guest Visitor'}
                      </p>
                      {(customerInfo?.email || activeTicket.guestEmail || activeTicket.userEmail) && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                          <Mail className="h-3.5 w-3.5 text-neutral-400" />
                          <span className="truncate">{customerInfo?.email || activeTicket.guestEmail || activeTicket.userEmail}</span>
                        </p>
                      )}
                      {(customerInfo?.phone || activeTicket.guestPhone || activeTicket.phone) && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                          <Phone className="h-3.5 w-3.5 text-neutral-400" />
                          <span>{customerInfo?.phone || activeTicket.guestPhone || activeTicket.phone}</span>
                        </p>
                      )}
                    </div>

                    {isActiveGuest ? (
                      <div className="space-y-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-500">Guest Session</span>
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {formatDateTime(activeTicket.guestSessionAt || activeTicket.createdAt)}
                          </span>
                        </div>
                        <form onSubmit={handleLinkGuestUser} className="space-y-1.5 pt-1">
                          <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                            Link Guest to Verified Account
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={linkUserIdentifier}
                              onChange={(e) => setLinkUserIdentifier(e.target.value)}
                              placeholder="User email or Tiwi ID"
                              className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            />
                            <button
                              type="submit"
                              disabled={!linkUserIdentifier.trim() || linkingUser}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#1ED760] px-2.5 text-[11px] font-semibold text-black hover:bg-[#19c354] disabled:opacity-40"
                            >
                              <Link2 className="h-3 w-3" />
                              Link
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900/50">
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Tiwi ID</span>
                          <span className="font-mono text-[11px] font-semibold text-neutral-900 dark:text-white">
                            {customerInfo?.tiwiId || activeTicket.userId || '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Account Status</span>
                          <span className="font-medium text-neutral-900 dark:text-white">
                            {customerInfo?.status || 'Active'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">KYC Verification</span>
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-[#1ED760]">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {customerInfo?.kycVerified ? 'KYC Verified' : customerInfo?.kycStatus || 'Standard'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Store Count</span>
                          <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                            {customerInfo?.storeCount ?? (Array.isArray(customerInfo?.stores) ? customerInfo.stores.length : 0)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Cash Balance</span>
                          <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                            {customerInfo?.cashBalance != null ? `$${Number(customerInfo.cashBalance).toFixed(2)}` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Promo Balance</span>
                          <span className="font-semibold tabular-nums text-neutral-900 dark:text-white">
                            {customerInfo?.promoBalance != null ? `$${Number(customerInfo.promoBalance).toFixed(2)}` : '—'}
                          </span>
                        </div>

                        {Array.isArray(customerInfo?.stores) && customerInfo.stores.length > 0 && (
                          <div className="border-t border-neutral-200/70 pt-2 dark:border-neutral-800">
                            <p className="mb-1.5 text-[11px] font-medium text-neutral-500">Connected Stores</p>
                            <div className="space-y-1">
                              {customerInfo.stores.slice(0, 5).map((store) => (
                                <div
                                  key={store.id || store.name}
                                  className="flex items-center justify-between rounded-lg bg-white px-2 py-1 text-[11px] dark:bg-neutral-950"
                                >
                                  <span className="flex items-center gap-1.5 truncate font-medium text-neutral-800 dark:text-neutral-200">
                                    <Store className="h-3 w-3 shrink-0 text-[#1ED760]" />
                                    {store.name || store.subdomain}
                                  </span>
                                  <span className="text-[10px] text-neutral-400">{store.status || 'Active'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tags Editor */}
                  <div className="space-y-2 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                      <Tag className="h-3.5 w-3.5 text-neutral-400" />
                      <span>Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ticketTags.length === 0 ? (
                        <span className="text-[11px] text-neutral-400">No tags attached</span>
                      ) : (
                        ticketTags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                          >
                            {t}
                            <button
                              type="button"
                              onClick={() =>
                                handlePatchTicket({ tags: ticketTags.filter((x) => x !== t) }, 'Tag removed.')
                              }
                              className="text-neutral-400 hover:text-rose-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = tagInput.trim();
                        if (!next || ticketTags.includes(next)) return;
                        setTagInput('');
                        handlePatchTicket({ tags: [...ticketTags, next] }, 'Tag added.');
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Add tag..."
                        className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={!tagInput.trim()}
                        className="h-8 rounded-lg border border-neutral-200 px-2.5 text-xs font-medium text-neutral-700 hover:border-[#1ED760] disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Watchers / CC List */}
                  <div className="space-y-2 border-b border-neutral-200/80 pb-4 dark:border-neutral-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                      <Users className="h-3.5 w-3.5 text-neutral-400" />
                      <span>Watchers / CC</span>
                    </div>
                    <div className="space-y-1">
                      {ticketWatchers.length === 0 ? (
                        <p className="text-[11px] text-neutral-400">No watchers on this ticket</p>
                      ) : (
                        ticketWatchers.map((w) => (
                          <div
                            key={w}
                            className="flex items-center justify-between rounded-lg bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                          >
                            <span className="truncate">{w}</span>
                            <button
                              type="button"
                              onClick={() =>
                                handlePatchTicket({ watchers: ticketWatchers.filter((x) => x !== w) }, 'Watcher removed.')
                              }
                              className="text-neutral-400 hover:text-rose-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = watcherInput.trim();
                        if (!next || ticketWatchers.includes(next)) return;
                        setWatcherInput('');
                        handlePatchTicket({ watchers: [...ticketWatchers, next] }, 'Watcher added.');
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        type="text"
                        value={watcherInput}
                        onChange={(e) => setWatcherInput(e.target.value)}
                        placeholder="Add CC email..."
                        className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={!watcherInput.trim()}
                        className="h-8 rounded-lg border border-neutral-200 px-2.5 text-xs font-medium text-neutral-700 hover:border-[#1ED760] disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200"
                      >
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Attachments List */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-white">
                      <Paperclip className="h-3.5 w-3.5 text-neutral-400" />
                      <span>Attachments ({ticketAttachments.length})</span>
                    </div>
                    {ticketAttachments.length === 0 ? (
                      <p className="text-[11px] text-neutral-400">No files attached</p>
                    ) : (
                      <div className="space-y-1.5">
                        {ticketAttachments.map((att, idx) => {
                          const label = typeof att === 'string' ? att : att.name || att.filename || `Attachment ${idx + 1}`;
                          const href = typeof att === 'string' ? att : att.url || att.href || '#';
                          return (
                            <a
                              key={idx}
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between rounded-lg border border-neutral-200/80 bg-neutral-50 px-2.5 py-1.5 text-[11px] text-neutral-700 hover:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                                <span className="truncate">{label}</span>
                              </span>
                              <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save Filter Preset Modal */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSavePreset}
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">Save Filter Preset</h3>
            <p className="mt-1 text-xs text-neutral-500">Save your current queue, status, priority, and category view.</p>
            <input
              type="text"
              required
              autoFocus
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Escalated Billing"
              className="mt-3 h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPresetModalOpen(false)}
                className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354]"
              >
                Save Preset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Merge Ticket Modal */}
      {mergeModalOpen && activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleMergeTicket}
            className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Merge {getTicketSerial(activeTicket)}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Enter the target Ticket ID or Reference ID (e.g. <code>TWTK-1042</code>) to merge this ticket into.
            </p>
            <input
              type="text"
              required
              autoFocus
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              placeholder="Target Ticket ID (e.g. TWTK-1042)"
              className="mt-3 h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMergeModalOpen(false)}
                className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mergeWorking}
                className="h-8 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
              >
                {mergeWorking ? 'Merging...' : 'Confirm Merge'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Sub-Ticket Modal */}
      {subticketModalOpen && activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateSubticket}
            className="w-full max-w-md space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Create Sub-Ticket for {getTicketSerial(activeTicket)}
            </h3>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Sub-Ticket Subject
              </label>
              <input
                type="text"
                required
                value={subticketForm.subject}
                onChange={(e) => setSubticketForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Escalate payment gateway reconciliation"
                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  Priority
                </label>
                <select
                  value={subticketForm.priority}
                  onChange={(e) => setSubticketForm((f) => ({ ...f, priority: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                  Department
                </label>
                <select
                  value={subticketForm.department}
                  onChange={(e) => setSubticketForm((f) => ({ ...f, department: e.target.value }))}
                  className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
                >
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Internal Brief / Description
              </label>
              <textarea
                rows={3}
                value={subticketForm.description}
                onChange={(e) => setSubticketForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSubticketModalOpen(false)}
                className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={subticketWorking}
                className="h-8 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
              >
                {subticketWorking ? 'Creating...' : 'Create Sub-Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Macro CRUD Modal */}
      {macroModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveMacro}
            className="w-full max-w-md space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
          >
            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white">
              {editingMacro ? 'Edit Canned Macro' : 'Create Canned Macro'}
            </h3>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Macro Title
              </label>
              <input
                type="text"
                required
                value={macroForm.title}
                onChange={(e) => setMacroForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. KYC Verification Follow-up"
                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Category
              </label>
              <input
                type="text"
                value={macroForm.category}
                onChange={(e) => setMacroForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="General, Billing, Technical..."
                className="h-9 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Response Body
              </label>
              <textarea
                rows={4}
                required
                value={macroForm.body}
                onChange={(e) => setMacroForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Hi {{customerName}}, regarding ticket {{ticketId}}..."
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs outline-none focus:border-[#1ED760] dark:border-neutral-800 dark:bg-neutral-900 dark:text-white"
              />
              <p className="mt-1 text-[10px] text-neutral-400">
                Placeholders: <code>{'{{customerName}}'}</code>, <code>{'{{ticketId}}'}</code>, <code>{'{{agentName}}'}</code>
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMacroModalOpen(false)}
                className="h-8 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingMacro}
                className="h-8 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-50"
              >
                {savingMacro ? 'Saving...' : 'Save Macro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <AdminCustomerContextDrawer
        open={contextDrawerOpen}
        ticketId={activeTicket?.id || activeTicket?.ticketId || selectedTicketId}
        apiBase={API_BASE}
        onClose={() => setContextDrawerOpen(false)}
      />
    </div>
  );
}
