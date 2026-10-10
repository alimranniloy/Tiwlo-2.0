import { randomUUID } from 'node:crypto';
import { queryPg } from './postgres.js';
import { readState, saveState, isPersistedState } from './stateDocuments.js';

// Support threads and their ticket metadata share one versioned PostgreSQL document.
// Existing SQL tickets seed the document on its first write; no disk/memory fallback.
export const SupportDB = {
  async getAllData() {
    const data = await readState('support', 'workspace', { tickets: [], conversations: [] });
    if (!isPersistedState(data)) {
      const { rows } = await queryPg('SELECT * FROM support_tickets ORDER BY created_at DESC');
      data.tickets = rows.map(r => ({
        id: r.id, ticketId: r.ticket_id, serialNumber: r.serial_number,
        userId: r.user_id, userName: r.user_name, userEmail: r.user_email,
        subject: r.subject, description: r.description, priority: r.priority,
        category: r.category, status: r.status, assignedAgent: r.assigned_agent,
        resolution: r.resolution, createdAt: r.created_at, updatedAt: r.updated_at
      }));
    }
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
    return (await this.getTickets()).find(t => t.id === id || t.ticketId === id) || null;
  },
  async createTicket(ticket) {
    const data = await this.getAllData();
    const id = ticket.id || `tkt_${randomUUID()}`;
    const ticketId = ticket.ticketId || `TWTK-${randomUUID()}`;
    const record = {
      id, ticketId, serialNumber: `#${ticketId}`, userId: null, userName: 'User',
      priority: 'MEDIUM', category: 'General', status: 'OPEN',
      ...ticket, createdAt: ticket.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    if (data.tickets.some(t => t.id === id || t.ticketId === ticketId)) throw new Error('Ticket already exists');
    data.tickets.unshift(record);
    await this.saveAllData(data);
    return record;
  },
  async updateTicket(id, updates) {
    const data = await this.getAllData();
    const ticket = data.tickets.find(t => t.id === id || t.ticketId === id);
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
    const record = { ...(existing || { id: `conv_${randomUUID()}`, messages: [], createdAt: new Date().toISOString() }), ...conv, updatedAt: new Date().toISOString() };
    if (existing) data.conversations[data.conversations.indexOf(existing)] = record;
    else data.conversations.unshift(record);
    await this.saveAllData(data);
    return record;
  }
};
