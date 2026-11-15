import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  User,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/mediaUtils';

const STATUS_TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting_customer', label: 'Waiting Customer' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

const PRIORITY_FILTERS = [
  { id: 'ALL', label: 'All Priorities' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
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
    };
  }
  return null;
}

function formatSlaLabel(ticket) {
  const s = normalizeStatus(ticket?.status);
  if (s === 'resolved' || s === 'closed') return 'Completed';
  const due = ticket?.slaDueAt || ticket?.firstResponseDueAt || ticket?.resolutionDueAt;
  if (!due) return ticket?.slaStatus || 'SLA < 2h';
  const diffMs = new Date(due).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return String(due);
  if (diffMs <= 0) return 'Overdue';
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m due` : `${Math.max(1, mins)}m due`;
}

function formatUpdated(ticket) {
  if (ticket?.updatedAt) {
    try {
      const d = new Date(ticket.updatedAt);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch {}
  }
  return ticket?.lastUpdated || 'Just now';
}

function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/"/g, '""');
  return `"${str}"`;
}

export default function TicketsView({
  currentUser,
  guestSession: externalGuestSession = null,
  supportConfig: externalConfig = null,
  onBack,
  onCreateTicket,
  onSelectTicket,
  onOpenLookup,
}) {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guestSession, setGuestSession] = useState(externalGuestSession);
  const [supportConfig, setSupportConfig] = useState(externalConfig || { allowNewTicketCreation: true });

  useEffect(() => {
    if (externalGuestSession) setGuestSession(externalGuestSession);
  }, [externalGuestSession]);

  useEffect(() => {
    if (externalConfig) setSupportConfig(externalConfig);
  }, [externalConfig]);

  // Fetch config and guest session if not passed
  useEffect(() => {
    if (!externalConfig) {
      fetch('/api/support/config', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setSupportConfig(data.config || data);
        })
        .catch(() => {});
    }
    if (!currentUser && !externalGuestSession) {
      fetch('/api/support/guest/session', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const sess = data?.guestSession || data?.session || (data?.verified ? data : null);
          if (sess && (sess.email || sess.verified)) setGuestSession(sess);
        })
        .catch(() => {});
    }
  }, [currentUser, externalConfig, externalGuestSession]);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.tiwiId || '';
      const url = userId ? `/api/support/tickets?userId=${encodeURIComponent(userId)}` : '/api/support/tickets';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.tickets)) {
          setTickets(data.tickets);
        }
      }
    } catch (err) {
      console.warn('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const categories = useMemo(() => {
    const set = new Set([
      'Payment & Billing',
      'Store & Domains',
      'Cloud & Droplets',
      'POS & Hardware',
      'Login & Security',
      'Bug Report',
      'Feature Request',
      'General Inquiry',
    ]);
    tickets.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [tickets]);

  const statusCounts = useMemo(() => {
    const counts = { ALL: tickets.length };
    STATUS_TABS.slice(1).forEach((tab) => {
      counts[tab.id] = 0;
    });
    tickets.forEach((t) => {
      const s = normalizeStatus(t.status);
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qNoHash = q.replace(/^#/, '');

    return tickets.filter((t) => {
      const s = normalizeStatus(t.status);
      const p = normalizePriority(t.priority);

      if (filterStatus !== 'ALL' && s !== filterStatus) return false;
      if (filterPriority !== 'ALL' && p !== filterPriority) return false;
      if (filterCategory !== 'ALL' && (t.category || 'General Inquiry') !== filterCategory) return false;

      if (q) {
        const serial = String(t.serialNumber || `#${t.ticketId || t.id || ''}`).toLowerCase();
        const rawId = String(t.ticketId || t.id || '').toLowerCase();
        const refId = String(t.referenceId || '').toLowerCase();
        const subject = String(t.subject || '').toLowerCase();
        const category = String(t.category || '').toLowerCase();
        const statusLabel = formatStatusLabel(t.status).toLowerCase();
        const matches =
          serial.includes(q) ||
          serial.replace(/^#/, '').includes(qNoHash) ||
          rawId.includes(qNoHash) ||
          refId.includes(qNoHash) ||
          subject.includes(q) ||
          category.includes(q) ||
          statusLabel.includes(q) ||
          s.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [tickets, filterStatus, filterPriority, filterCategory, searchQuery]);

  const handleExportCsv = () => {
    const headers = ['Serial', 'Subject', 'Category', 'Priority', 'Status', 'Channel', 'Assigned Agent', 'SLA', 'Last Updated'];
    const rows = filteredTickets.map((t) => {
      const serial = t.serialNumber || (t.id?.startsWith('#') ? t.id : `#${t.ticketId || t.id}`);
      const agent = parseAssignedAgent(t);
      return [
        escapeCsvCell(serial),
        escapeCsvCell(t.subject || ''),
        escapeCsvCell(t.category || 'General Inquiry'),
        escapeCsvCell(normalizePriority(t.priority)),
        escapeCsvCell(formatStatusLabel(t.status)),
        escapeCsvCell(t.channel || 'Web'),
        escapeCsvCell(agent ? `${agent.name} (${agent.role})` : 'Unassigned — Queueing'),
        escapeCsvCell(formatSlaLabel(t)),
        escapeCsvCell(formatUpdated(t)),
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiwlo-support-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const allowNewTicket = supportConfig?.allowNewTicketCreation !== false;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
            title="Back to Support Home"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              My Tickets
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Track progress, view specialist replies, and manage ticket status
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredTickets.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={loadTickets}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
            title="Refresh tickets"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            disabled={!allowNewTicket}
            onClick={onCreateTicket}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2 text-xs font-semibold text-neutral-950 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Create Ticket
          </button>
        </div>
      </div>

      {/* System Notice if New Ticket Creation is Paused */}
      {!allowNewTicket && (
        <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300">
          <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
          <span>New ticket submissions are temporarily paused by support administration. Existing tickets remain accessible below.</span>
        </div>
      )}

      {/* Guest Session Status Banner */}
      {!currentUser && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-4 py-3 text-xs">
          {guestSession ? (
            <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
              <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
              <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
              <span>
                Guest Session Active (<span className="font-medium">{guestSession.email}</span>
                {guestSession.phone ? ` · ${guestSession.phone}` : ''})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Verify your guest contact details or track an existing ticket by ID &amp; Recovery Code.</span>
            </div>
          )}
          {onOpenLookup && (
            <button
              type="button"
              onClick={onOpenLookup}
              className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 underline underline-offset-4 hover:text-[#1ED760] cursor-pointer self-start sm:self-auto"
            >
              Track Ticket by ID &amp; Recovery Code
            </button>
          )}
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => {
          const active = filterStatus === tab.id;
          const count = statusCounts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                active
                  ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white text-white dark:text-neutral-950'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300 hover:bg-[#fafafa] dark:hover:bg-neutral-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                  active
                    ? 'bg-white/20 dark:bg-neutral-900/15 text-current'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by #TWTK-... ID, subject, category, or status..."
            className="h-10 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 pl-9 pr-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none"
          />
        </div>

        <div className="relative sm:col-span-3">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by priority"
            className="h-10 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 pl-8 pr-3 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 focus:border-[#1ED760] focus:outline-none"
          >
            {PRIORITY_FILTERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-10 w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 focus:border-[#1ED760] focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tickets Table (Desktop) & Cards (Mobile) */}
      <div className="overflow-hidden rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-xs">
        {loading ? (
          <div className="p-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
            Loading support tickets...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Ticket className="mx-auto h-9 w-9 text-neutral-300 dark:text-neutral-700" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                No tickets match your filter
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {tickets.length === 0
                  ? 'You have not opened any tickets in this session yet.'
                  : 'Try clearing your search query or switching status tabs.'}
              </p>
            </div>
            {allowNewTicket && (
              <button
                type="button"
                onClick={onCreateTicket}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2 text-xs font-semibold text-neutral-950 transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Open a Support Ticket
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Subject &amp; Category</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Specialist</th>
                    <th className="py-3 px-4">Channel &amp; SLA</th>
                    <th className="py-3 px-4 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800 text-xs">
                  {filteredTickets.map((ticket) => {
                    const serial = ticket.serialNumber || (ticket.id?.startsWith('#') ? ticket.id : `#${ticket.ticketId || ticket.id}`);
                    const agent = parseAssignedAgent(ticket);
                    const hasUnread = Boolean(ticket.hasUnreadStaffReply || ticket.unreadByCustomer || Number(ticket.unreadStaffReplies) > 0);
                    return (
                      <tr
                        key={ticket.id || ticket.ticketId}
                        onClick={() => onSelectTicket?.(ticket)}
                        className="group cursor-pointer transition hover:bg-[#fafafa] dark:hover:bg-neutral-900/70"
                      >
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          <div className="flex items-center gap-2">
                            {hasUnread && (
                              <span className="h-2 w-2 rounded-full bg-[#1ED760]" title="Unread specialist reply" />
                            )}
                            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                              {serial}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs align-top">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-[#16a34a] dark:group-hover:text-[#1ED760] transition truncate">
                            {ticket.subject}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <span className="rounded bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 border border-neutral-200/70 dark:border-neutral-800">
                              {ticket.category || 'General Inquiry'}
                            </span>
                            {ticket.snippet && (
                              <span className="truncate">{ticket.snippet}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${getPriorityClasses(ticket.priority)}`}>
                            {normalizePriority(ticket.priority)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${getStatusClasses(ticket.status)}`}>
                            {formatStatusLabel(ticket.status)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          {agent ? (
                            <div className="flex items-center gap-2.5">
                              <img
                                src={resolveAvatarUrl(agent.avatar)}
                                alt={agent.name}
                                className="h-7 w-7 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover"
                              />
                              <div className="min-w-0">
                                <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[150px]">
                                  {agent.name}
                                </p>
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate max-w-[150px]">
                                  {agent.role}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                              <User className="h-3.5 w-3.5" />
                              Unassigned — Queueing
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          <div className="text-neutral-800 dark:text-neutral-200 font-medium">
                            {ticket.channel || 'Web'}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <Clock className="h-3 w-3" />
                            {formatSlaLabel(ticket)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-right align-top text-neutral-500 dark:text-neutral-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span>{formatUpdated(ticket)}</span>
                            <ChevronRight className="h-4 w-4 text-neutral-300 dark:text-neutral-700 group-hover:translate-x-0.5 transition" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-neutral-200/80 dark:divide-neutral-800 md:hidden">
              {filteredTickets.map((ticket) => {
                const serial = ticket.serialNumber || (ticket.id?.startsWith('#') ? ticket.id : `#${ticket.ticketId || ticket.id}`);
                const agent = parseAssignedAgent(ticket);
                const hasUnread = Boolean(ticket.hasUnreadStaffReply || ticket.unreadByCustomer || Number(ticket.unreadStaffReplies) > 0);
                return (
                  <button
                    key={ticket.id || ticket.ticketId}
                    type="button"
                    onClick={() => onSelectTicket?.(ticket)}
                    className="w-full p-4 text-left transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 space-y-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {hasUnread && <span className="h-2 w-2 rounded-full bg-[#1ED760]" />}
                        <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {serial}
                        </span>
                        <span className="text-[11px] text-neutral-400">· {ticket.channel || 'Web'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${getPriorityClasses(ticket.priority)}`}>
                          {normalizePriority(ticket.priority)}
                        </span>
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${getStatusClasses(ticket.status)}`}>
                          {formatStatusLabel(ticket.status)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">
                        {ticket.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                        {ticket.category || 'General Inquiry'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-neutral-800 text-[11px] text-neutral-500 dark:text-neutral-400">
                      {agent ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={resolveAvatarUrl(agent.avatar)}
                            alt={agent.name}
                            className="h-5 w-5 rounded-full object-cover"
                          />
                          <span className="truncate font-medium text-neutral-700 dark:text-neutral-300">
                            {agent.name}
                          </span>
                        </div>
                      ) : (
                        <span>Unassigned — Queueing</span>
                      )}
                      <span className="shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatSlaLabel(ticket)} · {formatUpdated(ticket)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
