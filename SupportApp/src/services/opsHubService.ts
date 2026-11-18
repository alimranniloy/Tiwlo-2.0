import {
  ADMIN_API_BASE,
  ADMIN_SUPPORT_API_BASE,
  SUPPORT_API_BASE,
} from '../config/siteConfig';
import type {
  Customer360Detail,
  Customer360Summary,
  KbArticle,
  PersonalStaffTask,
  QaReviewScorecard,
  QaSummaryStats,
  QuickPeekResponse,
  ShiftHandoverRecord,
  StaffAccessRequestRecord,
  SupportApprovalRequest,
  SupportAutomationRule,
  SupportBlocklistRule,
  SupportDepartmentConfig,
  SupportIncident,
  TeamWallPost,
} from '../types/opsHub';
import type { SupportTicket } from '../types/support';
import { apiFetch } from './apiClient';

export const opsHubService = {
  // ---- Pre-Click Quick Peek ----
  quickPeek(kind: 'ticket' | 'livechat', id: string) {
    return apiFetch<QuickPeekResponse>(
      `${ADMIN_SUPPORT_API_BASE}/quick-peek/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`
    );
  },

  // ---- Outbound Staff Ticket Creation ----
  createInternalTicket(payload: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    subject: string;
    description: string;
    priority?: string;
    category?: string;
    department?: string;
    assignToSelf?: boolean;
  }) {
    return apiFetch<{ ticket: SupportTicket }>(`${ADMIN_SUPPORT_API_BASE}/tickets/create-outbound`, {
      method: 'POST',
      body: payload,
    });
  },

  // ---- Knowledge Base ----
  listKbArticles(params: { q?: string; category?: string; visibility?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category && params.category !== 'all') qs.set('category', params.category);
    if (params.visibility && params.visibility !== 'all') qs.set('visibility', params.visibility);
    return apiFetch<{ articles: KbArticle[] }>(
      `${ADMIN_SUPPORT_API_BASE}/kb/articles?${qs.toString()}`
    );
  },

  getKbArticle(id: string) {
    return apiFetch<{ article: KbArticle }>(
      `${ADMIN_SUPPORT_API_BASE}/kb/articles/${encodeURIComponent(id)}`
    );
  },

  saveKbArticle(
    payload: {
      id?: string;
      title: string;
      category?: string;
      visibility?: 'internal' | 'public';
      summary?: string;
      content: string;
      tags?: string[];
      pinned?: boolean;
    }
  ) {
    if (payload.id) {
      return apiFetch<{ article: KbArticle }>(
        `${ADMIN_SUPPORT_API_BASE}/kb/articles/${encodeURIComponent(payload.id)}`,
        { method: 'PATCH', body: payload }
      );
    }
    return apiFetch<{ article: KbArticle }>(`${ADMIN_SUPPORT_API_BASE}/kb/articles`, {
      method: 'POST',
      body: payload,
    });
  },

  deleteKbArticle(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/kb/articles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  markKbHelpful(id: string) {
    return apiFetch<{ article: KbArticle }>(
      `${ADMIN_SUPPORT_API_BASE}/kb/articles/${encodeURIComponent(id)}/helpful`,
      { method: 'POST', body: {} }
    );
  },

  // ---- Major Incidents & Outage Broadcasts ----
  listIncidents(status?: string) {
    const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<{ incidents: SupportIncident[] }>(
      `${ADMIN_SUPPORT_API_BASE}/incidents${qs}`
    );
  },

  createIncident(payload: {
    title: string;
    severity: 'minor' | 'major' | 'critical';
    summary: string;
    affectedComponents?: string[];
  }) {
    return apiFetch<{ incident: SupportIncident }>(`${ADMIN_SUPPORT_API_BASE}/incidents`, {
      method: 'POST',
      body: payload,
    });
  },

  addIncidentUpdate(
    incidentId: string,
    payload: { status: 'investigating' | 'identified' | 'monitoring' | 'resolved'; message: string }
  ) {
    return apiFetch<{ incident: SupportIncident }>(
      `${ADMIN_SUPPORT_API_BASE}/incidents/${encodeURIComponent(incidentId)}/updates`,
      { method: 'POST', body: payload }
    );
  },

  broadcastIncidentUpdate(
    incidentId: string,
    payload: { message: string; targetFilter?: 'open_tickets' | 'escalated_tickets' | 'linked_only'; ticketIds?: string[] }
  ) {
    return apiFetch<{ notifiedCount: number; incident: SupportIncident }>(
      `${ADMIN_SUPPORT_API_BASE}/incidents/${encodeURIComponent(incidentId)}/broadcast`,
      { method: 'POST', body: payload }
    );
  },

  // ---- Shift Handovers ----
  listShiftHandovers() {
    return apiFetch<{ handovers: ShiftHandoverRecord[] }>(
      `${ADMIN_SUPPORT_API_BASE}/shift-handovers`
    );
  },

  createShiftHandover(payload: {
    shiftType: 'morning' | 'evening' | 'night';
    headline: string;
    summary: string;
    blockers?: string;
    watchTicketIds?: string[];
  }) {
    return apiFetch<{ handover: ShiftHandoverRecord }>(
      `${ADMIN_SUPPORT_API_BASE}/shift-handovers`,
      { method: 'POST', body: payload }
    );
  },

  acknowledgeShiftHandover(id: string) {
    return apiFetch<{ handover: ShiftHandoverRecord }>(
      `${ADMIN_SUPPORT_API_BASE}/shift-handovers/${encodeURIComponent(id)}/acknowledge`,
      { method: 'POST', body: {} }
    );
  },

  // ---- Internal Staff Team Wall ----
  listTeamWallPosts() {
    return apiFetch<{ posts: TeamWallPost[] }>(`${ADMIN_SUPPORT_API_BASE}/team-wall`);
  },

  createTeamWallPost(payload: {
    category: 'announcement' | 'urgent' | 'tip' | 'shoutout';
    body: string;
    pinned?: boolean;
  }) {
    return apiFetch<{ post: TeamWallPost }>(`${ADMIN_SUPPORT_API_BASE}/team-wall`, {
      method: 'POST',
      body: payload,
    });
  },

  togglePinTeamWallPost(id: string) {
    return apiFetch<{ post: TeamWallPost }>(
      `${ADMIN_SUPPORT_API_BASE}/team-wall/${encodeURIComponent(id)}/pin`,
      { method: 'POST', body: {} }
    );
  },

  reactTeamWallPost(id: string, emoji: string) {
    return apiFetch<{ post: TeamWallPost }>(
      `${ADMIN_SUPPORT_API_BASE}/team-wall/${encodeURIComponent(id)}/react`,
      { method: 'POST', body: { emoji } }
    );
  },

  deleteTeamWallPost(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/team-wall/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ---- Tier-2 Escalations & Action Approvals ----
  listApprovals(status?: string) {
    const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<{ approvals: SupportApprovalRequest[] }>(
      `${ADMIN_SUPPORT_API_BASE}/approvals${qs}`
    );
  },

  createApprovalRequest(payload: {
    requestType: 'refund' | 'credit' | 'account_unlock' | 'sla_override' | 'tier2_escalation';
    ticketId?: string;
    ticketSerial?: string;
    customerName: string;
    amountLabel?: string;
    reason: string;
  }) {
    return apiFetch<{ approval: SupportApprovalRequest }>(
      `${ADMIN_SUPPORT_API_BASE}/approvals`,
      { method: 'POST', body: payload }
    );
  },

  decideApprovalRequest(
    id: string,
    payload: { decision: 'approved' | 'rejected'; decisionNote?: string }
  ) {
    return apiFetch<{ approval: SupportApprovalRequest }>(
      `${ADMIN_SUPPORT_API_BASE}/approvals/${encodeURIComponent(id)}/decide`,
      { method: 'POST', body: payload }
    );
  },

  // ---- QA Scorecards ----
  listQaReviews() {
    return apiFetch<{ reviews: QaReviewScorecard[]; summary: QaSummaryStats }>(
      `${ADMIN_SUPPORT_API_BASE}/qa-reviews`
    );
  },

  createQaReview(payload: {
    targetType: 'ticket' | 'livechat';
    targetId: string;
    targetSerial: string;
    agentName: string;
    toneScore: number;
    accuracyScore: number;
    brandScore: number;
    speedScore: number;
    coachingNote: string;
  }) {
    return apiFetch<{ review: QaReviewScorecard; summary: QaSummaryStats }>(
      `${ADMIN_SUPPORT_API_BASE}/qa-reviews`,
      { method: 'POST', body: payload }
    );
  },

  // ---- AI Copilot Playground & Key Pool Health ----
  runAiPlayground(payload: {
    task: 'draft_reply' | 'polish' | 'translate_bn' | 'translate_en' | 'summarize' | 'empathetic' | 'kb_draft';
    input: string;
    customerName?: string;
  }) {
    return apiFetch<{ output: string; model?: string | null; keyLabel?: string | null }>(
      `${ADMIN_SUPPORT_API_BASE}/ai-playground`,
      { method: 'POST', body: payload }
    );
  },

  getAiSystemHealth() {
    return apiFetch<{
      config?: Record<string, unknown>;
      summary?: Record<string, unknown>;
      keys?: Record<string, unknown>[];
    }>(`${ADMIN_API_BASE}/chat-system/overview`);
  },

  // ---- Automation Rules ----
  listAutomationRules() {
    return apiFetch<{ rules: SupportAutomationRule[] }>(
      `${ADMIN_SUPPORT_API_BASE}/automation-rules`
    );
  },

  saveAutomationRule(payload: {
    id?: string;
    name: string;
    description?: string;
    enabled?: boolean;
    triggerField: SupportAutomationRule['triggerField'];
    triggerValue: string;
    actionType: SupportAutomationRule['actionType'];
    actionValue: string;
  }) {
    if (payload.id) {
      return apiFetch<{ rule: SupportAutomationRule }>(
        `${ADMIN_SUPPORT_API_BASE}/automation-rules/${encodeURIComponent(payload.id)}`,
        { method: 'PATCH', body: payload }
      );
    }
    return apiFetch<{ rule: SupportAutomationRule }>(
      `${ADMIN_SUPPORT_API_BASE}/automation-rules`,
      { method: 'POST', body: payload }
    );
  },

  deleteAutomationRule(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/automation-rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ---- Departments & Business Hours ----
  listDepartments() {
    return apiFetch<{ departments: SupportDepartmentConfig[] }>(
      `${ADMIN_SUPPORT_API_BASE}/departments`
    );
  },

  saveDepartment(payload: {
    id?: string;
    name: string;
    leadName?: string;
    slaResponseMinutes?: number;
    slaResolveMinutes?: number;
    businessHours?: string;
    autoAckMessage?: string;
    isActive?: boolean;
  }) {
    if (payload.id) {
      return apiFetch<{ department: SupportDepartmentConfig }>(
        `${ADMIN_SUPPORT_API_BASE}/departments/${encodeURIComponent(payload.id)}`,
        { method: 'PATCH', body: payload }
      );
    }
    return apiFetch<{ department: SupportDepartmentConfig }>(
      `${ADMIN_SUPPORT_API_BASE}/departments`,
      { method: 'POST', body: payload }
    );
  },

  deleteDepartment(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ---- Spam & Abuse Blocklist ----
  listBlocklist() {
    return apiFetch<{ rules: SupportBlocklistRule[] }>(`${ADMIN_SUPPORT_API_BASE}/blocklist`);
  },

  addBlocklistRule(payload: {
    kind: SupportBlocklistRule['kind'];
    value: string;
    reason: string;
  }) {
    return apiFetch<{ rule: SupportBlocklistRule }>(`${ADMIN_SUPPORT_API_BASE}/blocklist`, {
      method: 'POST',
      body: payload,
    });
  },

  deleteBlocklistRule(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/blocklist/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ---- Personal Staff Notes & Follow-Up Tasks ----
  listPersonalTasks() {
    return apiFetch<{ tasks: PersonalStaffTask[] }>(`${ADMIN_SUPPORT_API_BASE}/personal-tasks`);
  },

  savePersonalTask(payload: {
    id?: string;
    title: string;
    note?: string;
    priority?: 'low' | 'medium' | 'high';
    linkedTicketSerial?: string;
    dueLabel?: string;
    completed?: boolean;
    pinned?: boolean;
  }) {
    if (payload.id) {
      return apiFetch<{ task: PersonalStaffTask }>(
        `${ADMIN_SUPPORT_API_BASE}/personal-tasks/${encodeURIComponent(payload.id)}`,
        { method: 'PATCH', body: payload }
      );
    }
    return apiFetch<{ task: PersonalStaffTask }>(`${ADMIN_SUPPORT_API_BASE}/personal-tasks`, {
      method: 'POST',
      body: payload,
    });
  },

  deletePersonalTask(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/personal-tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ---- Customer 360 Directory & Notes ----
  listCustomers(params: { q?: string; segment?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.segment && params.segment !== 'all') qs.set('segment', params.segment);
    return apiFetch<{ customers: Customer360Summary[] }>(
      `${ADMIN_SUPPORT_API_BASE}/customers?${qs.toString()}`
    );
  },

  getCustomer360(key: string) {
    return apiFetch<Customer360Detail>(
      `${ADMIN_SUPPORT_API_BASE}/customers/${encodeURIComponent(key)}`
    );
  },

  updateCustomerProfileNote(
    key: string,
    payload: { note?: string; segment?: 'standard' | 'vip' | 'watchlist' }
  ) {
    return apiFetch<Customer360Detail>(
      `${ADMIN_SUPPORT_API_BASE}/customers/${encodeURIComponent(key)}/note`,
      { method: 'POST', body: payload }
    );
  },

  // ---- Public & Admin Staff Access Onboarding Requests (Sign Up Flow) ----
  submitPublicStaffAccessRequest(payload: {
    fullName: string;
    email: string;
    phone: string;
    desiredRole: string;
    department: string;
    inviteCode?: string;
    reason: string;
  }) {
    return apiFetch<{ request: StaffAccessRequestRecord; message?: string }>(
      `${SUPPORT_API_BASE}/staff-access-request`,
      {
        method: 'POST',
        skipAuth: true,
        body: payload,
      }
    );
  },

  checkPublicStaffAccessStatus(email: string, requestCode: string) {
    const qs = new URLSearchParams({
      email: email.trim(),
      code: requestCode.trim(),
    });
    return apiFetch<{ request: StaffAccessRequestRecord }>(
      `${SUPPORT_API_BASE}/staff-access-request/status?${qs.toString()}`,
      { skipAuth: true }
    );
  },

  listStaffAccessRequests(status?: string) {
    const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<{ requests: StaffAccessRequestRecord[] }>(
      `${ADMIN_SUPPORT_API_BASE}/access-requests${qs}`
    );
  },

  decideStaffAccessRequest(
    id: string,
    payload: { decision: 'approved' | 'rejected'; reviewNote?: string }
  ) {
    return apiFetch<{ request: StaffAccessRequestRecord }>(
      `${ADMIN_SUPPORT_API_BASE}/access-requests/${encodeURIComponent(id)}/decide`,
      { method: 'POST', body: payload }
    );
  },
};
