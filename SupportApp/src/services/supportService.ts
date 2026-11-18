import {
  ADMIN_API_BASE,
  ADMIN_SUPPORT_API_BASE,
  SUPPORT_API_BASE,
} from '../config/siteConfig';
import type {
  CustomerContextData,
  LiveChatCounts,
  LiveChatMessage,
  LiveChatPresence,
  LiveChatSession,
  PickAppealRecord,
  PulseAlertsResponse,
  StaffMetricRow,
  SupportAgent,
  SupportAttachment,
  SupportFeatureSwitches,
  SupportMacro,
  SupportOverview,
  SupportTicket,
  SupportTicketDetailResponse,
} from '../types/support';
import { apiFetch } from './apiClient';

export const supportService = {
  // ---- Overview & Analytics ----
  getOverview() {
    return apiFetch<{ overview: SupportOverview }>(`${ADMIN_SUPPORT_API_BASE}/overview?deskIsolation=1`);
  },

  getPulseAlerts() {
    return apiFetch<PulseAlertsResponse>(`${ADMIN_SUPPORT_API_BASE}/pulse-alerts`);
  },

  registerPushToken(payload: { token: string; platform: string; deviceName?: string }) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/push-token`, {
      method: 'POST',
      body: payload,
    });
  },

  unregisterPushToken(token?: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/push-token`, {
      method: 'DELETE',
      body: token ? { token } : {},
    });
  },

  getCsatAnalytics() {
    return apiFetch<{
      averageRating?: number | null;
      totalResponses?: number;
      distribution?: Record<string, number>;
      recentSurveys?: Record<string, unknown>[];
    }>(`${ADMIN_SUPPORT_API_BASE}/analytics/csat`);
  },

  getPlatformOpsSummary(timeframe: '7d' | '30d' | '12m' = '30d') {
    return apiFetch<Record<string, unknown>>(
      `${ADMIN_SUPPORT_API_BASE}/analytics/platform-ops-summary?timeframe=${encodeURIComponent(timeframe)}`
    );
  },

  // ---- Agents & Macros ----
  getAgents() {
    return apiFetch<{ agents: SupportAgent[] }>(`${ADMIN_SUPPORT_API_BASE}/agents`);
  },

  getMacros() {
    return apiFetch<{ macros: SupportMacro[] }>(`${ADMIN_SUPPORT_API_BASE}/macros`);
  },

  createMacro(payload: { title: string; category?: string; body: string }) {
    return apiFetch<{ macro: SupportMacro }>(`${ADMIN_SUPPORT_API_BASE}/macros`, {
      method: 'POST',
      body: payload,
    });
  },

  updateMacro(id: string, payload: { title?: string; category?: string; body?: string }) {
    return apiFetch<{ macro: SupportMacro }>(
      `${ADMIN_SUPPORT_API_BASE}/macros/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: payload }
    );
  },

  deleteMacro(id: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/macros/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // ---- Tickets ----
  listTickets(filters: {
    q?: string;
    queue?: string;
    status?: string;
    priority?: string;
    category?: string;
    department?: string;
    assignedAgentId?: string;
    requesterType?: string;
    slaBreached?: boolean | null;
    page?: number;
    limit?: number;
  } = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.department && filters.department !== 'all') params.set('department', filters.department);
    if (filters.assignedAgentId) params.set('assignedAgentId', filters.assignedAgentId);
    if (filters.requesterType) params.set('requesterType', filters.requesterType);
    if (filters.slaBreached !== undefined && filters.slaBreached !== null) {
      params.set('slaBreached', String(filters.slaBreached));
    }
    params.set('page', String(filters.page || 1));
    params.set('limit', String(filters.limit || 40));
    params.set('deskIsolation', '1');

    return apiFetch<{
      tickets: SupportTicket[];
      statusCounts: Record<string, number>;
      total: number;
      page: number;
      totalPages: number;
    }>(`${ADMIN_SUPPORT_API_BASE}/tickets?${params.toString()}`);
  },

  exportTicketsCsv(filters: { q?: string; status?: string; priority?: string; category?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    return apiFetch<string>(`${ADMIN_SUPPORT_API_BASE}/export.csv?${params.toString()}`, {
      rawText: true,
    });
  },

  getTicketDetail(ticketIdOrKey: string) {
    return apiFetch<SupportTicketDetailResponse>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}?deskIsolation=1`
    );
  },

  recordTicketViewHeartbeat(ticketIdOrKey: string) {
    return apiFetch<{ viewers?: { userId: string; name: string; lastSeenAt: string }[] }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/view`,
      { method: 'POST', body: {} }
    );
  },

  updateTicket(
    ticketIdOrKey: string,
    updates: Partial<{
      subject: string;
      status: string;
      priority: string;
      category: string;
      department: string;
      escalationTier: number;
      tags: string[];
      snoozedUntil: string | null;
    }>
  ) {
    return apiFetch<{ ticket: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}`,
      { method: 'PATCH', body: updates }
    );
  },

  assignTicket(ticketIdOrKey: string, assignedAgentId: string | null, requireAcceptance = true) {
    return apiFetch<{ ticket: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/assign`,
      {
        method: 'POST',
        body: {
          assignedAgentId,
          agentId: assignedAgentId,
          requireAcceptance,
        },
      }
    );
  },

  acceptTicketAssignment(ticketIdOrKey: string) {
    return apiFetch<{ ticket: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/accept-assignment`,
      { method: 'POST', body: {} }
    );
  },

  cancelTicketAssignment(ticketIdOrKey: string) {
    return apiFetch<{ dismissed: boolean; ticket?: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/cancel-assignment`,
      { method: 'POST', body: {} }
    );
  },

  replyToTicket(
    ticketIdOrKey: string,
    payload: {
      message: string;
      isInternal?: boolean;
      attachments?: SupportAttachment[];
      nextStatus?: string;
    }
  ) {
    return apiFetch<{ reply: Record<string, unknown>; ticket: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/replies`,
      {
        method: 'POST',
        body: {
          message: payload.message,
          body: payload.message,
          isInternal: Boolean(payload.isInternal),
          attachments: payload.attachments || [],
          ...(payload.nextStatus ? { nextStatus: payload.nextStatus, status: payload.nextStatus } : {}),
        },
      }
    );
  },

  editTicketReply(ticketIdOrKey: string, replyId: string, message: string) {
    return apiFetch(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/replies/${encodeURIComponent(replyId)}`,
      {
        method: 'PATCH',
        body: { message, body: message },
      }
    );
  },

  aiAssistTicket(ticketIdOrKey: string, draft: string, mode = 'polish_reply') {
    return apiFetch<{ suggestion?: string; reply?: string }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/ai-assist`,
      { method: 'POST', body: { mode, draft } }
    );
  },

  mergeTickets(ticketIdOrKey: string, targetTicketId: string) {
    return apiFetch(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/merge`,
      { method: 'POST', body: { targetTicketId, mergeIntoId: targetTicketId } }
    );
  },

  createSubTicket(
    parentTicketIdOrKey: string,
    payload: { subject: string; description: string; priority?: string; department?: string }
  ) {
    return apiFetch<{ subTicket: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(parentTicketIdOrKey)}/subticket`,
      { method: 'POST', body: payload }
    );
  },

  linkTicketUser(ticketIdOrKey: string, identifierOrEmail: string) {
    return apiFetch<{ ticket: SupportTicket }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/link-user`,
      {
        method: 'POST',
        body: {
          userEmail: identifierOrEmail,
          userId: identifierOrEmail,
          identifier: identifierOrEmail,
        },
      }
    );
  },

  bulkUpdateTickets(payload: {
    ticketIds: string[];
    status?: string;
    priority?: string;
    assignedAgentId?: string | null;
    tags?: string[];
  }) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/tickets/bulk`, {
      method: 'POST',
      body: payload,
    });
  },

  getCustomerContext(ticketIdOrKey: string) {
    return apiFetch<{ context: CustomerContextData }>(
      `${ADMIN_SUPPORT_API_BASE}/tickets/${encodeURIComponent(ticketIdOrKey)}/customer-context`
    );
  },

  uploadAttachmentBase64(payload: { filename: string; contentType: string; dataBase64: string }) {
    return apiFetch<{ attachments: SupportAttachment[] }>(`${SUPPORT_API_BASE}/attachments`, {
      method: 'POST',
      body: payload,
    });
  },

  // ---- Live Chats ----
  listLiveChats(params: { status?: string; mine?: boolean; q?: string } = {}) {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.set('status', params.status);
    if (params.mine) query.set('mine', '1');
    if (params.q) query.set('q', params.q);
    query.set('deskIsolation', '1');
    return apiFetch<{
      chats: LiveChatSession[];
      counts: LiveChatCounts;
      presence: LiveChatPresence;
    }>(`${ADMIN_SUPPORT_API_BASE}/live-chats?${query.toString()}`);
  },

  updatePresence(isOnline: boolean) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/live-chats/presence`, {
      method: 'POST',
      body: { isOnline },
    });
  },

  getLiveChatDetail(chatId: string) {
    return apiFetch<{ chat: LiveChatSession; messages: LiveChatMessage[] }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}?deskIsolation=1`
    );
  },

  acceptLiveChat(chatId: string) {
    return apiFetch<{ chat: LiveChatSession; messages?: LiveChatMessage[] }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/accept`,
      { method: 'POST', body: {} }
    );
  },

  cancelLiveChat(chatId: string) {
    return apiFetch<{ cancelled: boolean; chatId?: string }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/cancel`,
      { method: 'POST', body: {} }
    );
  },

  replyLiveChat(chatId: string, message: string) {
    return apiFetch<{ chat?: LiveChatSession; messages?: LiveChatMessage[]; message?: LiveChatMessage }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/reply`,
      { method: 'POST', body: { message } }
    );
  },

  holdLiveChat(chatId: string, reason = '') {
    return apiFetch<{ chat: LiveChatSession }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/hold`,
      { method: 'POST', body: { reason } }
    );
  },

  endLiveChat(chatId: string) {
    return apiFetch<{ chat: LiveChatSession }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/end`,
      { method: 'POST', body: {} }
    );
  },

  aiAssistLiveChat(chatId: string, mode: 'suggest_reply' | 'polish_reply' | 'summarize', draft = '') {
    return apiFetch<{ suggestion?: string; reply?: string; summary?: string; text?: string }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/ai-assist`,
      { method: 'POST', body: { mode, draft } }
    );
  },

  convertLiveChatToTicket(chatId: string, payload: { subject?: string; priority?: string } = {}) {
    return apiFetch<{ ticket: SupportTicket; chat: LiveChatSession }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/convert-to-ticket`,
      { method: 'POST', body: payload }
    );
  },

  pushCoBrowseGuidance(chatId: string, payload: { highlightSelector?: string; agentGuidanceNote?: string }) {
    return apiFetch(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/${encodeURIComponent(chatId)}/co-browse-guide`,
      { method: 'POST', body: payload }
    );
  },

  listLiveChatTemplates() {
    return apiFetch<{ templates: SupportMacro[] }>(`${ADMIN_SUPPORT_API_BASE}/live-chats/templates`);
  },

  createLiveChatTemplate(payload: { title: string; category?: string; body: string }) {
    return apiFetch<{ template: SupportMacro }>(`${ADMIN_SUPPORT_API_BASE}/live-chats/templates`, {
      method: 'POST',
      body: payload,
    });
  },

  deleteLiveChatTemplate(templateId: string) {
    return apiFetch(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/templates/${encodeURIComponent(templateId)}`,
      { method: 'DELETE' }
    );
  },

  // ---- Staff Performance, Audits, Settings, Appeals & Staff Directory ----
  getStaffMetrics(category = 'all') {
    return apiFetch<{
      staffMetrics: StaffMetricRow[];
      catalogCounts: Record<string, number>;
    }>(`${ADMIN_SUPPORT_API_BASE}/live-chats/staff-metrics?category=${encodeURIComponent(category)}`);
  },

  getForensicLogs(severity = '', limit = 60) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (severity && severity !== 'all') params.set('severity', severity);
    return apiFetch<{ logs: Record<string, unknown>[] }>(
      `${ADMIN_SUPPORT_API_BASE}/live-chats/forensic-logs?${params.toString()}`
    );
  },

  getStaffAuditLogs(limit = 50) {
    return apiFetch<{ logs: Record<string, unknown>[] }>(
      `${ADMIN_SUPPORT_API_BASE}/staff-audit-logs?limit=${encodeURIComponent(String(limit))}`
    );
  },

  terminateUserSessions(targetUserId: string, reason: string) {
    return apiFetch(`${ADMIN_SUPPORT_API_BASE}/security/terminate-sessions`, {
      method: 'POST',
      body: { userId: targetUserId, targetUserId, reason },
    });
  },

  getSupportToggles() {
    return apiFetch<{ toggles: Partial<SupportFeatureSwitches> }>(`${ADMIN_SUPPORT_API_BASE}/toggles`);
  },

  getChatSystemConfig() {
    return apiFetch<Record<string, unknown>>(`${ADMIN_API_BASE}/chat-system`);
  },

  async saveSupportFeatureSwitches(nextSwitches: SupportFeatureSwitches, reauthGrant: string) {
    await Promise.all([
      apiFetch(`${ADMIN_SUPPORT_API_BASE}/toggles`, {
        method: 'PUT',
        reauthGrant,
        body: { toggles: nextSwitches, ...nextSwitches },
      }),
      apiFetch(`${ADMIN_API_BASE}/chat-system/settings`, {
        method: 'PUT',
        reauthGrant,
        body: { ...nextSwitches, switches: nextSwitches },
      }),
    ]);
  },

  listPickAppeals() {
    return apiFetch<{ appeals?: PickAppealRecord[] } | PickAppealRecord[]>(
      `${ADMIN_API_BASE}/pick-account-appeals`
    );
  },

  updatePickAppeal(id: string, payload: { status: string; resolutionNotes?: string }) {
    return apiFetch(`${ADMIN_API_BASE}/pick-account-appeals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  listStaffDirectory() {
    return apiFetch<{
      staff: Record<string, unknown>[];
      rolePresets: Record<string, unknown>;
      permissionCatalog: Record<string, unknown>[];
      canManageStaff: boolean;
    }>(`${ADMIN_API_BASE}/staff-support`);
  },

  saveStaffMember(
    payload: {
      targetUserId?: string;
      name: string;
      email?: string;
      password?: string;
      roleKey: string;
      permissions?: string[];
      allowedIps?: string[];
      isActive?: boolean;
    },
    reauthGrant: string
  ) {
    if (payload.targetUserId) {
      return apiFetch(
        `${ADMIN_API_BASE}/staff-support/${encodeURIComponent(payload.targetUserId)}`,
        { method: 'PUT', reauthGrant, body: payload }
      );
    }
    return apiFetch(`${ADMIN_API_BASE}/staff-support`, {
      method: 'POST',
      reauthGrant,
      body: payload,
    });
  },
};
