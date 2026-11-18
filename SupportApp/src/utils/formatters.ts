import type { SemanticTone } from '../theme/ThemeContext';
import type { SupportTicket } from '../types/support';

export function getTicketSerial(ticket?: Partial<SupportTicket> | null): string {
  if (!ticket) return '#TWTK';
  const raw = ticket.serialNumber || ticket.ticketId || ticket.id || '';
  return String(raw).startsWith('#') ? String(raw) : `#${raw}`;
}

export function getStatusLabel(status?: string | null): string {
  const clean = String(status || 'open').replace(/_/g, ' ').trim();
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStatusTone(status?: string | null): SemanticTone {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed' || s === 'completed' || s === 'active') return 'success';
  if (s === 'escalated' || s === 'flagged' || s === 'rejected') return 'danger';
  if (
    s === 'waiting_customer' ||
    s === 'waiting customer' ||
    s === 'on_hold' ||
    s === 'on hold' ||
    s === 'waiting' ||
    s === 'pending'
  ) {
    return 'warning';
  }
  if (s === 'in_progress' || s === 'in progress' || s === 'open' || s === 'under_review') {
    return 'accent';
  }
  return 'neutral';
}

export function getPriorityTone(priority?: string | null): SemanticTone {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'accent';
  return 'neutral';
}

export function formatShortDateTime(value?: string | null): string {
  if (!value) return '—';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return String(value);
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return '';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return '';
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDurationMs(ms?: number | null): string {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return '—';
  const totalSec = Math.round(Number(ms) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ${min % 60}m`;
}

export function formatSlaBadge(ticket?: Partial<SupportTicket> | null): {
  text: string;
  breached: boolean;
} {
  if (!ticket) return { text: 'No SLA', breached: false };
  if (ticket.slaLabel) {
    return { text: ticket.slaLabel, breached: Boolean(ticket.slaBreached) };
  }
  if (!ticket.slaDueAt) {
    return { text: 'Standard SLA', breached: Boolean(ticket.slaBreached) };
  }
  const diffMin = Math.round((Date.parse(ticket.slaDueAt) - Date.now()) / 60000);
  if (Number.isNaN(diffMin)) return { text: 'SLA', breached: Boolean(ticket.slaBreached) };
  if (diffMin <= 0) {
    return { text: `Breached ${Math.abs(diffMin)}m`, breached: true };
  }
  if (diffMin < 60) {
    return { text: `${diffMin}m left`, breached: diffMin <= 15 };
  }
  const hrs = Math.floor(diffMin / 60);
  return { text: `${hrs}h ${diffMin % 60}m left`, breached: false };
}

export function getInitials(name?: string | null): string {
  const parts = String(name || 'TS').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
