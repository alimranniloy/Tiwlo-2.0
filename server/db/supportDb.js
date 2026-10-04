import { isPgActive, queryPg } from './postgres.js';

/**
 * Tiwlo Enterprise Support & Intelligence Database Adapter
 * 
 * Provides unified, PostgreSQL-backed storage with automatic in-memory fallback
 * for tickets, conversation threads, and autonomous AI resolutions.
 * Replaces legacy support_database.json file operations.
 */

let supportRuntimeData = {
  tickets: [],
  conversations: []
};

export const SupportDB = {
  /**
   * Return all tickets or tickets filtered by user
   */
  async getTickets(userId = null) {
    if (isPgActive()) {
      try {
        let sql = `SELECT * FROM support_tickets`;
        let params = [];
        if (userId && userId !== 'guest' && userId !== 'guest_session') {
          sql += ` WHERE user_id = $1`;
          params.push(userId);
        }
        sql += ` ORDER BY created_at DESC`;
        const res = await queryPg(sql, params);
        if (res && res.rows) {
          return res.rows.map(r => ({
            id: r.id,
            ticketId: r.ticket_id,
            serialNumber: r.serial_number,
            userId: r.user_id,
            userName: r.user_name,
            userEmail: r.user_email,
            subject: r.subject,
            description: r.description,
            priority: r.priority,
            category: r.category,
            status: r.status,
            assignedAgent: r.assigned_agent,
            resolution: r.resolution,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          }));
        }
      } catch (err) {
        console.warn('[SupportDB] Postgres error in getTickets, using runtime store:', err.message);
      }
    }

    if (!userId || userId === 'guest' || userId === 'guest_session') {
      return supportRuntimeData.tickets || [];
    }
    return (supportRuntimeData.tickets || []).filter(t => !t.userId || t.userId === userId);
  },

  /**
   * Get ticket by ID or ticketId
   */
  async getTicketById(ticketId) {
    if (isPgActive()) {
      try {
        const res = await queryPg(
          `SELECT * FROM support_tickets WHERE id = $1 OR ticket_id = $1 LIMIT 1`,
          [ticketId]
        );
        if (res && res.rows.length > 0) {
          const r = res.rows[0];
          return {
            id: r.id,
            ticketId: r.ticket_id,
            serialNumber: r.serial_number,
            userId: r.user_id,
            userName: r.user_name,
            userEmail: r.user_email,
            subject: r.subject,
            description: r.description,
            priority: r.priority,
            category: r.category,
            status: r.status,
            assignedAgent: r.assigned_agent,
            resolution: r.resolution,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          };
        }
      } catch (err) {
        console.warn('[SupportDB] Postgres error in getTicketById:', err.message);
      }
    }

    return (supportRuntimeData.tickets || []).find(t => t.id === ticketId || t.ticketId === ticketId) || null;
  },

  /**
   * Create new support ticket
   */
  async createTicket(ticket) {
    const newTicket = {
      id: ticket.id || `tkt_${Date.now()}`,
      ticketId: ticket.ticketId || `TWTK-${Math.floor(1000 + Math.random() * 9000)}`,
      serialNumber: ticket.serialNumber || `#TWTK-${Math.floor(1000 + Math.random() * 9000)}`,
      userId: ticket.userId || null,
      userName: ticket.userName || 'User',
      userEmail: ticket.userEmail || '',
      subject: ticket.subject || 'Support Request',
      description: ticket.description || '',
      priority: ticket.priority || 'MEDIUM',
      category: ticket.category || 'General',
      status: ticket.status || 'OPEN',
      assignedAgent: ticket.assignedAgent || null,
      resolution: ticket.resolution || null,
      createdAt: ticket.createdAt || new Date().toISOString(),
      updatedAt: ticket.updatedAt || new Date().toISOString()
    };

    if (isPgActive()) {
      try {
        await queryPg(
          `INSERT INTO support_tickets (id, ticket_id, serial_number, user_id, user_name, user_email, subject, description, priority, category, status, assigned_agent, resolution, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            newTicket.id,
            newTicket.ticketId,
            newTicket.serialNumber,
            newTicket.userId,
            newTicket.userName,
            newTicket.userEmail,
            newTicket.subject,
            newTicket.description,
            newTicket.priority,
            newTicket.category,
            newTicket.status,
            JSON.stringify(newTicket.assignedAgent),
            newTicket.resolution,
            newTicket.createdAt,
            newTicket.updatedAt
          ]
        );
      } catch (err) {
        console.warn('[SupportDB] Postgres insert error in createTicket:', err.message);
      }
    }

    if (!Array.isArray(supportRuntimeData.tickets)) {
      supportRuntimeData.tickets = [];
    }
    supportRuntimeData.tickets.unshift(newTicket);
    return newTicket;
  },

  /**
   * Update an existing support ticket
   */
  async updateTicket(ticketId, updates) {
    if (isPgActive()) {
      try {
        const fields = [];
        const values = [];
        let idx = 1;

        if (updates.status !== undefined) {
          fields.push(`status = $${idx++}`);
          values.push(updates.status);
        }
        if (updates.resolution !== undefined) {
          fields.push(`resolution = $${idx++}`);
          values.push(updates.resolution);
        }
        if (updates.priority !== undefined) {
          fields.push(`priority = $${idx++}`);
          values.push(updates.priority);
        }
        if (updates.assignedAgent !== undefined) {
          fields.push(`assigned_agent = $${idx++}`);
          values.push(JSON.stringify(updates.assignedAgent));
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);

        if (fields.length > 1) {
          values.push(ticketId);
          await queryPg(
            `UPDATE support_tickets SET ${fields.join(', ')} WHERE id = $${idx} OR ticket_id = $${idx}`,
            values
          );
        }
      } catch (err) {
        console.warn('[SupportDB] Postgres update error in updateTicket:', err.message);
      }
    }

    const t = (supportRuntimeData.tickets || []).find(t => t.id === ticketId || t.ticketId === ticketId);
    if (t) {
      Object.assign(t, updates, { updatedAt: new Date().toISOString() });
      return t;
    }
    return null;
  },

  /**
   * Retrieve conversation threads
   */
  async getConversations(userId = null) {
    if (!Array.isArray(supportRuntimeData.conversations)) {
      supportRuntimeData.conversations = [];
    }

    if (!userId || userId === 'guest' || userId === 'guest_session') {
      return supportRuntimeData.conversations;
    }

    return supportRuntimeData.conversations.filter(c =>
      !c.userId || c.userId === userId || (c.id && c.id.includes(userId))
    );
  },

  /**
   * Retrieve single conversation by ID
   */
  async getConversation(conversationId) {
    if (!Array.isArray(supportRuntimeData.conversations)) {
      supportRuntimeData.conversations = [];
    }
    return supportRuntimeData.conversations.find(c => c.id === conversationId) || null;
  },

  /**
   * Save or update conversation thread
   */
  async saveConversation(conv) {
    if (!Array.isArray(supportRuntimeData.conversations)) {
      supportRuntimeData.conversations = [];
    }

    const idx = supportRuntimeData.conversations.findIndex(c => c.id === conv.id);
    if (idx >= 0) {
      supportRuntimeData.conversations[idx] = {
        ...supportRuntimeData.conversations[idx],
        ...conv,
        updatedAt: new Date().toISOString()
      };
      return supportRuntimeData.conversations[idx];
    } else {
      const newConv = {
        id: conv.id || `conv_${Date.now()}`,
        messages: conv.messages || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...conv
      };
      supportRuntimeData.conversations.unshift(newConv);
      return newConv;
    }
  },

  /**
   * Drop-in compatibility getter for legacy endpoints
   */
  getAllData() {
    return {
      tickets: supportRuntimeData.tickets || [],
      conversations: supportRuntimeData.conversations || []
    };
  },

  /**
   * Drop-in compatibility setter
   */
  saveAllData(data) {
    if (data && typeof data === 'object') {
      if (Array.isArray(data.tickets)) supportRuntimeData.tickets = data.tickets;
      if (Array.isArray(data.conversations)) supportRuntimeData.conversations = data.conversations;
    }
    return true;
  }
};
