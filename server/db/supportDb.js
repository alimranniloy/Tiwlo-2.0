import { randomUUID } from 'node:crypto';
import { queryPg } from './postgres.js';
import { readState, saveState, isPersistedState } from './stateDocuments.js';

function mapSqlTicketRow(r) {
  return {
    id: r.id,
    ticketId: r.ticket_id || r.id,
    serialNumber: r.serial_number || `#${r.ticket_id || r.id}`,
    userId: r.user_id ?? null,
    userName: r.user_name ?? null,
    userEmail: r.user_email ?? null,
    requesterType: r.requester_type || 'user',
    guestSessionId: r.guest_session_id ?? null,
    guestName: r.guest_name ?? null,
    guestEmail: r.guest_email ?? null,
    guestPhone: r.guest_phone ?? null,
    tiwiId: r.tiwi_id ?? null,
    storeId: r.store_id ?? null,
    storeName: r.store_name ?? null,
    channel: r.channel || 'web',
    subject: r.subject,
    description: r.description ?? '',
    priority: r.priority || 'medium',
    category: r.category || 'General',
    department: r.department || 'general',
    status: r.status || 'open',
    escalationTier: Number(r.escalation_tier || 1),
    assignedAgent: r.assigned_agent_name || r.assigned_agent || null,
    assignedAgentId: r.assigned_agent_id ?? null,
    assignedAgentName: r.assigned_agent_name ?? null,
    assignedAgentAvatar: r.assigned_agent_avatar ?? null,
    assignedAgentRole: r.assigned_agent_role ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    watchers: Array.isArray(r.watchers) ? r.watchers : [],
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    slaDueAt: r.sla_due_at ?? null,
    firstResponseAt: r.first_response_at ?? null,
    resolvedAt: r.resolved_at ?? null,
    closedAt: r.closed_at ?? null,
    csatRating: r.csat_rating ?? null,
    csatComment: r.csat_comment ?? null,
    mergedIntoId: r.merged_into_id ?? null,
    parentTicketId: r.parent_ticket_id ?? null,
    unreadByUser: Boolean(r.unread_by_user),
    unreadByStaff: r.unread_by_staff !== false,
    resolution: r.resolution ?? null,
    metadata: r.metadata && typeof r.metadata === 'object' ? r.metadata : {},
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

// Support threads and their ticket metadata share one versioned PostgreSQL document.
// Existing SQL tickets seed the document on its first write; no disk/memory fallback.
export const SupportDB = {
  async getAllData() {
    const data = await readState('support', 'workspace', { tickets: [], conversations: [] });
    if (!isPersistedState(data)) {
      const { rows } = await queryPg('SELECT * FROM support_tickets ORDER BY created_at DESC');
      data.tickets = rows.map(mapSqlTicketRow);
    }
    if (!Array.isArray(data.tickets)) data.tickets = [];
    if (!Array.isArray(data.conversations)) data.conversations = [];
    return data;
  },
  async saveAllData(data) {
    await saveState('support', 'workspace', data);
    return true;
  },
  async getTickets(userId = null) {
    const { tickets } = await this.getAllData();
    return userId ? tickets.filter(t => t.userId === userId) : tickets;
  },
  async getTicketById(id) {
    return (await this.getTickets()).find(t => t.id === id || t.ticketId === id || t.serialNumber === id) || null;
  },
  async createTicket(ticket) {
    const data = await this.getAllData();
    const id = ticket.id || `tkt_${randomUUID()}`;
    const ticketId = ticket.ticketId || `TWTK-${randomUUID()}`;
    const record = {
      id,
      ticketId,
      serialNumber: ticket.serialNumber || `#${ticketId}`,
      userId: null,
      userName: 'User',
      priority: 'MEDIUM',
      category: 'General',
      status: 'OPEN',
      ...ticket,
      createdAt: ticket.createdAt || new Date().toISOString(),
      updatedAt: ticket.updatedAt || new Date().toISOString()
    };
    if (data.tickets.some(t => t.id === id || t.ticketId === ticketId)) throw new Error('Ticket already exists');
    data.tickets.unshift(record);
    await this.saveAllData(data);
    return record;
  },
  async updateTicket(id, updates) {
    const data = await this.getAllData();
    const ticket = data.tickets.find(t => t.id === id || t.ticketId === id || t.serialNumber === id);
    if (!ticket) return null;
    Object.assign(ticket, updates, { id: ticket.id, updatedAt: new Date().toISOString() });
    await this.saveAllData(data);
    return ticket;
  },
  async getConversations(userId = null) {
    const { conversations } = await this.getAllData();
    return userId ? conversations.filter(c => c.userId === userId) : conversations;
  },
  async getConversation(id) {
    return (await this.getConversations()).find(c => c.id === id) || null;
  },
  async saveConversation(conv) {
    const data = await this.getAllData();
    const existing = data.conversations.find(c => c.id === conv.id);
    const record = {
      ...(existing || { id: `conv_${randomUUID()}`, messages: [], createdAt: new Date().toISOString() }),
      ...conv,
      updatedAt: new Date().toISOString()
    };
    if (existing) data.conversations[data.conversations.indexOf(existing)] = record;
    else data.conversations.unshift(record);
    await this.saveAllData(data);
    return record;
  }
};
