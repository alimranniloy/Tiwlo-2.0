import type { SemanticTone } from '../theme/ThemeContext';
import type { LiveChatMessage, LiveChatSession, SupportTicket, TicketReply } from './support';

export type DedicatedScreenKey =
  | 'unified_inbox'
  | 'create_ticket'
  | 'kb_hub'
  | 'kb_editor'
  | 'macros_studio'
  | 'customer_directory'
  | 'customer_360'
  | 'sla_command'
  | 'incident_board'
  | 'outage_broadcast'
  | 'escalation_approvals'
  | 'team_presence'
  | 'shift_handover'
  | 'team_wall'
  | 'qa_reviews'
  | 'csat_explorer'
  | 'ai_playground'
  | 'automation_rules'
  | 'spam_shield'
  | 'departments_hours'
  | 'agent_leaderboard'
  | 'personal_tasks'
  | 'audit_security'
  | 'staff_access_approvals'
  | 'platform_ops_analytics'
  | 'settings_notifications_ring'
  | 'settings_security_pin'
  | 'settings_composer_signature'
  | 'settings_appearance'
  | 'settings_system_switches'
  | 'settings_account_profile';

export interface SubScreenRoute {
  screen: DedicatedScreenKey;
  params?: Record<string, string | undefined>;
}

export interface ReplyEligibility {
  canReply: boolean;
  requiresAccept: boolean;
  unableReason: string | null;
  shortStatusLabel: string;
  tone: SemanticTone;
}

export interface QuickPeekResponse {
  kind: 'ticket' | 'livechat';
  ticket?: SupportTicket | null;
  chat?: LiveChatSession | null;
  recentMessages: (TicketReply | LiveChatMessage)[];
  replyAccess: {
    canReply: boolean;
    requiresAccept: boolean;
    unableReason: string | null;
  };
}

export interface KbArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  visibility: 'internal' | 'public';
  summary: string;
  content: string;
  tags: string[];
  pinned: boolean;
  viewsCount: number;
  helpfulCount: number;
  authorId?: string | null;
  authorName: string;
  updatedAt: string;
  createdAt: string;
}

export interface IncidentUpdateItem {
  id: string;
  status: string;
  message: string;
  authorName: string;
  createdAt: string;
}

export interface SupportIncident {
  id: string;
  code: string;
  title: string;
  severity: 'minor' | 'major' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  summary: string;
  affectedComponents: string[];
  linkedTicketIds: string[];
  broadcastCount: number;
  updates: IncidentUpdateItem[];
  createdByName: string;
  resolvedAt?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface ShiftHandoverRecord {
  id: string;
  shiftType: 'morning' | 'evening' | 'night';
  headline: string;
  summary: string;
  blockers: string;
  watchTicketIds: string[];
  createdById: string;
  createdByName: string;
  createdByAvatar?: string | null;
  acknowledgedBy: { staffId: string; staffName: string; at: string }[];
  createdAt: string;
}

export interface TeamWallPost {
  id: string;
  category: 'announcement' | 'urgent' | 'tip' | 'shoutout';
  body: string;
  ticketRefs: string[];
  pinned: boolean;
  authorId: string;
  authorName: string;
  authorAvatar?: string | null;
  authorRole?: string;
  reactions: Record<string, string[]>;
  createdAt: string;
}

export interface SupportApprovalRequest {
  id: string;
  requestType: 'refund' | 'credit' | 'account_unlock' | 'sla_override' | 'tier2_escalation';
  ticketId?: string | null;
  ticketSerial?: string | null;
  customerName: string;
  amountLabel?: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedById: string;
  requestedByName: string;
  decidedByName?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface QaReviewScorecard {
  id: string;
  targetType: 'ticket' | 'livechat';
  targetId: string;
  targetSerial: string;
  agentId?: string | null;
  agentName: string;
  reviewerName: string;
  toneScore: number;
  accuracyScore: number;
  brandScore: number;
  speedScore: number;
  overallPct: number;
  coachingNote: string;
  createdAt: string;
}

export interface QaSummaryStats {
  totalReviews: number;
  averagePct: number;
  avgTone: number;
  avgAccuracy: number;
  avgBrand: number;
  avgSpeed: number;
}

export interface SupportAutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerField: 'keyword' | 'priority' | 'category' | 'requester_type' | 'channel';
  triggerValue: string;
  actionType: 'set_priority' | 'set_department' | 'add_tag' | 'mark_escalated';
  actionValue: string;
  hitsCount: number;
  updatedAt: string;
}

export interface SupportDepartmentConfig {
  id: string;
  name: string;
  slug: string;
  leadName: string;
  slaResponseMinutes: number;
  slaResolveMinutes: number;
  businessHours: string;
  autoAckMessage: string;
  isActive: boolean;
  updatedAt: string;
}

export interface SupportBlocklistRule {
  id: string;
  kind: 'email' | 'ip' | 'domain' | 'keyword' | 'phone';
  value: string;
  reason: string;
  hitsCount: number;
  createdByName: string;
  createdAt: string;
}

export interface PersonalStaffTask {
  id: string;
  staffId: string;
  title: string;
  note: string;
  priority: 'low' | 'medium' | 'high';
  linkedTicketSerial?: string | null;
  dueLabel?: string | null;
  completed: boolean;
  pinned: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface Customer360Summary {
  key: string;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  isRegistered: boolean;
  segment: 'standard' | 'vip' | 'watchlist';
  ticketsCount: number;
  openTicketsCount: number;
  chatsCount: number;
  lastActivityAt: string;
}

export interface CustomerStaffNote {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface Customer360Detail {
  customer: Customer360Summary;
  tickets: SupportTicket[];
  chats: LiveChatSession[];
  notes: CustomerStaffNote[];
}

export interface StaffAccessRequestRecord {
  id: string;
  requestCode: string;
  fullName: string;
  email: string;
  phone: string;
  desiredRole: string;
  department: string;
  inviteCode?: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface StaffWorkspacePreferences {
  ringDurationSeconds: 5 | 10 | 15;
  vibrationEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  requirePinOnLaunch: boolean;
  autoLockMinutes: 0 | 1 | 5 | 15;
  signatureText: string;
  autoAppendSignature: boolean;
  defaultReplyMode: 'public' | 'internal';
  aiPreferredTone: 'warm_brand' | 'concise_technical' | 'empathetic_apology';
  preClickPreviewEnabled: boolean;
  uiDensity: 'comfortable' | 'compact';
  selectiveBorders: boolean;
  defaultLandingTab: 'home' | 'tickets' | 'livechat';
  dailyResolvedGoal: number;
}
