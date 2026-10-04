import { queryPg, isPgActive } from '../db/postgres.js';
import crypto from 'crypto';

// In-memory fallback repository strictly structured like PostgreSQL tables
// for resilience when DB connection is cycling.
const fallbackStore = {
  conversations: [],
  members: [],
  messages: [],
  calls: [],
  presence: {}
};

export const ChatDB = {
  // =========================================================================
  // 1. CONVERSATIONS (DIRECT & GROUP)
  // =========================================================================
  async getConversations(userId, { archived = false, search = '' } = {}) {
    if (isPgActive()) {
      try {
        const query = `
          SELECT c.*, 
            cm.role as user_role, cm.is_muted,
            (SELECT COUNT(*) FROM social_chat_messages m WHERE m.conversation_id = c.id AND m.status != 'seen' AND m.sender_id != $1) as unread_count,
            other_user.id as other_user_id, other_user.name as other_user_name,
            other_user.avatar as other_user_avatar, other_user.is_online as other_user_is_online,
            other_user.last_active_at as other_user_last_active_at
          FROM social_conversations c
          JOIN social_chat_members cm ON cm.conversation_id = c.id
          LEFT JOIN LATERAL (
            SELECT u.id, u.name, u.avatar, p.is_online, p.last_active_at
            FROM social_chat_members other_member
            JOIN system_users u ON u.id = other_member.user_id
            LEFT JOIN social_user_presence p ON p.user_id = u.id
            WHERE other_member.conversation_id = c.id AND other_member.user_id != $1
            LIMIT 1
          ) other_user ON TRUE
          WHERE cm.user_id = $1 AND c.is_archived = $2
          ORDER BY c.last_message_at DESC;
        `;
        const res = await queryPg(query, [userId, archived]);
        const convs = res.rows || [];

        for (const conv of convs) {
          if (conv.type === 'direct' && conv.other_user_id) {
            conv.otherUser = {
              id: conv.other_user_id,
              name: conv.other_user_name,
              avatar: conv.other_user_avatar,
              is_online: conv.other_user_is_online,
              last_active_at: conv.other_user_last_active_at,
            };
            conv.title = conv.title || conv.otherUser.name;
            conv.avatar = conv.avatar || conv.otherUser.avatar;
          }
          delete conv.other_user_id;
          delete conv.other_user_name;
          delete conv.other_user_avatar;
          delete conv.other_user_is_online;
          delete conv.other_user_last_active_at;
        }
        return convs;
      } catch (err) {
        throw new Error(`Could not load PostgreSQL conversations: ${err.message}`);
      }
    }

    // Fallback in-memory
    const myConvs = fallbackStore.conversations.filter(c => {
      const isMember = fallbackStore.members.some(m => m.conversation_id === c.id && m.user_id === userId);
      const matchArchived = !!c.is_archived === !!archived;
      return isMember && matchArchived;
    });
    return myConvs;
  },

  async createConversation({ type = 'direct', title = '', avatar = '', createdBy, memberIds = [] }) {
    const convoId = `convo_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const allMembers = Array.from(new Set([createdBy, ...memberIds].filter(Boolean)));

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO social_conversations (id, type, title, avatar, created_by, last_message_text, last_message_at)
          VALUES ($1, $2, $3, $4, $5, 'Conversation started', NOW())
        `, [convoId, type, title, avatar, createdBy]);

        for (const uid of allMembers) {
          const role = uid === createdBy ? 'owner' : 'member';
          await queryPg(`
            INSERT INTO social_chat_members (id, conversation_id, user_id, role)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (conversation_id, user_id) DO NOTHING
          `, [`mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, convoId, uid, role]);
        }

        const res = await queryPg('SELECT * FROM social_conversations WHERE id = $1', [convoId]);
        return res.rows[0];
      } catch (err) {
        throw new Error(`Could not persist conversation: ${err.message}`);
      }
    }

    // Fallback store
    const convo = {
      id: convoId,
      type,
      title: title || (type === 'group' ? 'New Group' : 'Direct Chat'),
      avatar,
      created_by: createdBy,
      last_message_text: 'Conversation started',
      last_message_at: new Date().toISOString(),
      is_archived: false,
      is_pinned: false
    };
    fallbackStore.conversations.unshift(convo);
    for (const uid of allMembers) {
      fallbackStore.members.push({
        id: `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        conversation_id: convoId,
        user_id: uid,
        role: uid === createdBy ? 'owner' : 'member',
        joined_at: new Date().toISOString()
      });
    }
    return convo;
  },

  async findDirectConversation(firstUserId, secondUserId) {
    if (isPgActive()) {
      const result = await queryPg(`
        SELECT c.*
        FROM social_conversations c
        JOIN social_chat_members first_member
          ON first_member.conversation_id = c.id AND first_member.user_id = $1
        JOIN social_chat_members second_member
          ON second_member.conversation_id = c.id AND second_member.user_id = $2
        JOIN system_users second_user ON second_user.id = second_member.user_id
        WHERE c.type = 'direct' AND second_user.is_banned = FALSE
        ORDER BY c.created_at DESC
        LIMIT 1
      `, [firstUserId, secondUserId]);
      return result.rows[0] || null;
    }
    const conversation = fallbackStore.conversations.find((item) => {
      if (item.type !== 'direct') return false;
      const memberIds = fallbackStore.members
        .filter((member) => member.conversation_id === item.id)
        .map((member) => member.user_id);
      return memberIds.includes(firstUserId) && memberIds.includes(secondUserId);
    });
    return conversation || null;
  },

  async getConversation(convoId, userId) {
    if (isPgActive()) {
      try {
        const res = await queryPg('SELECT * FROM social_conversations WHERE id = $1', [convoId]);
        if (res.rows[0]) {
          const c = res.rows[0];
          if (c.type === 'direct') {
            const memberRes = await queryPg(`
              SELECT u.id, u.name, u.avatar, p.is_online, p.last_active_at
              FROM social_chat_members m
              JOIN system_users u ON u.id = m.user_id
              LEFT JOIN social_user_presence p ON p.user_id = u.id
              WHERE m.conversation_id = $1 AND m.user_id != $2
              LIMIT 1;
            `, [convoId, userId]);
            if (memberRes.rows[0]) {
              c.otherUser = memberRes.rows[0];
              c.title = c.title || memberRes.rows[0].name;
              c.avatar = c.avatar || memberRes.rows[0].avatar;
            }
          }
          return c;
        }
      } catch (e) {
        throw new Error(`Could not load PostgreSQL conversation: ${e.message}`);
      }
    }
    return fallbackStore.conversations.find(c => c.id === convoId) || null;
  },

  async updateConversationSettings(convoId, { is_archived, is_pinned, disappearing_ttl_seconds, title, avatar }) {
    if (isPgActive()) {
      try {
        const updates = [];
        const params = [convoId];
        let idx = 2;
        if (is_archived !== undefined) { updates.push(`is_archived = $${idx++}`); params.push(is_archived); }
        if (is_pinned !== undefined) { updates.push(`is_pinned = $${idx++}`); params.push(is_pinned); }
        if (disappearing_ttl_seconds !== undefined) { updates.push(`disappearing_ttl_seconds = $${idx++}`); params.push(disappearing_ttl_seconds); }
        if (title !== undefined) { updates.push(`title = $${idx++}`); params.push(title); }
        if (avatar !== undefined) { updates.push(`avatar = $${idx++}`); params.push(avatar); }

        if (updates.length > 0) {
          const sql = `UPDATE social_conversations SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
          const res = await queryPg(sql, params);
          return res.rows[0];
        }
      } catch (e) {
        console.warn('[ChatDB.updateConversationSettings PG Error]', e.message);
      }
    }
    const c = fallbackStore.conversations.find(conv => conv.id === convoId);
    if (c) {
      if (is_archived !== undefined) c.is_archived = is_archived;
      if (is_pinned !== undefined) c.is_pinned = is_pinned;
      if (disappearing_ttl_seconds !== undefined) c.disappearing_ttl_seconds = disappearing_ttl_seconds;
      if (title !== undefined) c.title = title;
      if (avatar !== undefined) c.avatar = avatar;
    }
    return c;
  },

  // =========================================================================
  // 2. MESSAGES (UNSEND, EDIT, REACTIONS, READ STATUS)
  // =========================================================================
  async getMessages(conversationId, { before = null, beforeId = null, since = null, limit = 50 } = {}) {
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    if (isPgActive()) {
      try {
        const values = [conversationId];
        const filters = ['m.conversation_id = $1'];
        let order = 'DESC';
        if (before) {
          values.push(before);
          if (beforeId) {
            values.push(beforeId);
            filters.push(`(m.created_at < $${values.length - 1} OR (m.created_at = $${values.length - 1} AND m.id < $${values.length}))`);
          } else {
            filters.push(`m.created_at < $${values.length}`);
          }
        } else if (since) {
          values.push(since);
          filters.push(`GREATEST(m.created_at, COALESCE(m.updated_at, m.created_at)) > $${values.length}`);
          order = 'ASC';
        }
        values.push(safeLimit);
        const query = `
          SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
          FROM social_chat_messages m
          LEFT JOIN system_users u ON u.id = m.sender_id
          WHERE ${filters.join(' AND ')}
          ORDER BY m.created_at ${order}, m.id ${order}
          LIMIT $${values.length};
        `;
        const res = await queryPg(query, values);
        const rows = res.rows || [];
        return order === 'DESC' ? rows.reverse() : rows;
      } catch (err) {
        throw new Error(`Could not load PostgreSQL messages: ${err.message}`);
      }
    }
    let messages = fallbackStore.messages.filter(m => m.conversation_id === conversationId);
    if (before) {
      messages = messages.filter(m =>
        new Date(m.created_at) < new Date(before) ||
        (beforeId && new Date(m.created_at).getTime() === new Date(before).getTime() && m.id < beforeId)
      );
    }
    if (since) {
      messages = messages.filter(m => new Date(m.updated_at || m.created_at) > new Date(since));
    }
    if (since) return messages.slice(-safeLimit);
    return messages.slice(-safeLimit);
  },

  async sendMessage({ conversationId, senderId, content, messageType = 'text', mediaUrl = null, replyToId = null }) {
    const msgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const createdAt = new Date().toISOString();

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO social_chat_messages (id, conversation_id, sender_id, message_type, content, media_url, reply_to_id, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', NOW())
        `, [msgId, conversationId, senderId, messageType, content, mediaUrl, replyToId]);

        await queryPg(`
          UPDATE social_conversations 
          SET last_message_text = $1, last_message_at = NOW(), updated_at = NOW()
          WHERE id = $2
        `, [messageType === 'text' ? content : `[${messageType}]`, conversationId]);

        const res = await queryPg(`
          SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
          FROM social_chat_messages m
          LEFT JOIN system_users u ON u.id = m.sender_id
          WHERE m.id = $1
        `, [msgId]);
        return res.rows[0];
      } catch (err) {
        throw new Error(`Could not persist message: ${err.message}`);
      }
    }

    const newMsg = {
      id: msgId,
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      reply_to_id: replyToId,
      status: 'sent',
      is_unsent: false,
      is_edited: false,
      reactions: {},
      created_at: createdAt
    };
    fallbackStore.messages.push(newMsg);
    const conv = fallbackStore.conversations.find(c => c.id === conversationId);
    if (conv) {
      conv.last_message_text = messageType === 'text' ? content : `[${messageType}]`;
      conv.last_message_at = createdAt;
    }
    return newMsg;
  },

  async unsendMessage(messageId, userId) {
    if (isPgActive()) {
      try {
        const check = await queryPg('SELECT * FROM social_chat_messages WHERE id = $1', [messageId]);
        if (!check.rows[0]) return { success: false, error: 'Message not found' };
        if (check.rows[0].sender_id !== userId) return { success: false, error: 'Unauthorized to unsend this message' };

        await queryPg(`
          UPDATE social_chat_messages 
          SET is_unsent = TRUE, content = 'This message was unsent', media_url = NULL, unsent_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [messageId]);
        return { success: true };
      } catch (err) {
        console.warn('[ChatDB.unsendMessage PG Error]', err.message);
      }
    }

    const msg = fallbackStore.messages.find(m => m.id === messageId);
    if (!msg) return { success: false, error: 'Message not found' };
    if (msg.sender_id !== userId) return { success: false, error: 'Unauthorized' };
    msg.is_unsent = true;
    msg.content = 'This message was unsent';
    msg.media_url = null;
    return { success: true };
  },

  async editMessage(messageId, userId, newContent) {
    if (isPgActive()) {
      try {
        const check = await queryPg('SELECT * FROM social_chat_messages WHERE id = $1', [messageId]);
        if (!check.rows[0]) return { success: false, error: 'Message not found' };
        if (check.rows[0].sender_id !== userId) return { success: false, error: 'Unauthorized' };

        const res = await queryPg(`
          UPDATE social_chat_messages 
          SET content = $1, is_edited = TRUE, updated_at = NOW()
          WHERE id = $2
          RETURNING *;
        `, [newContent, messageId]);
        return { success: true, message: res.rows[0] };
      } catch (err) {
        console.warn('[ChatDB.editMessage PG Error]', err.message);
      }
    }

    const msg = fallbackStore.messages.find(m => m.id === messageId);
    if (!msg) return { success: false, error: 'Message not found' };
    if (msg.sender_id !== userId) return { success: false, error: 'Unauthorized' };
    msg.content = newContent;
    msg.is_edited = true;
    return { success: true, message: msg };
  },

  async reactToMessage(messageId, userId, reaction) {
    if (isPgActive()) {
      try {
        const check = await queryPg('SELECT reactions FROM social_chat_messages WHERE id = $1', [messageId]);
        if (check.rows[0]) {
          const currentReactions = check.rows[0].reactions || {};
          const usersForReaction = currentReactions[reaction] || [];
          if (usersForReaction.includes(userId)) {
            // toggle off
            currentReactions[reaction] = usersForReaction.filter(u => u !== userId);
          } else {
            // toggle on
            currentReactions[reaction] = [...usersForReaction, userId];
          }
          await queryPg('UPDATE social_chat_messages SET reactions = $1 WHERE id = $2', [JSON.stringify(currentReactions), messageId]);
          return { success: true, reactions: currentReactions };
        }
      } catch (err) {
        console.warn('[ChatDB.reactToMessage PG Error]', err.message);
      }
    }

    const msg = fallbackStore.messages.find(m => m.id === messageId);
    if (msg) {
      msg.reactions = msg.reactions || {};
      const users = msg.reactions[reaction] || [];
      msg.reactions[reaction] = users.includes(userId) ? users.filter(u => u !== userId) : [...users, userId];
      return { success: true, reactions: msg.reactions };
    }
    return { success: false };
  },

  async markMessagesSeen(conversationId, userId) {
    if (isPgActive()) {
      try {
        await queryPg(`
          UPDATE social_chat_messages 
          SET status = 'seen', updated_at = NOW()
          WHERE conversation_id = $1 AND sender_id != $2 AND status != 'seen'
        `, [conversationId, userId]);
        return { success: true };
      } catch (e) {
        console.warn('[ChatDB.markMessagesSeen PG Error]', e.message);
      }
    }
    fallbackStore.messages.forEach(m => {
      if (m.conversation_id === conversationId && m.sender_id !== userId) {
        m.status = 'seen';
      }
    });
    return { success: true };
  },

  // =========================================================================
  // 3. GROUP MEMBERS & ROLES (OWNER, ADMIN, EDITOR, MEMBER)
  // =========================================================================
  async getGroupMembers(conversationId) {
    if (isPgActive()) {
      try {
        const res = await queryPg(`
          SELECT m.id, m.role, m.joined_at, m.is_muted,
            u.id as user_id, u.name, u.tiwi_id, u.avatar,
            COALESCE(p.is_online, false) as is_online, p.last_active_at
          FROM social_chat_members m
          JOIN system_users u ON u.id = m.user_id
          LEFT JOIN social_user_presence p ON p.user_id = u.id
          WHERE m.conversation_id = $1
          ORDER BY 
            CASE m.role 
              WHEN 'owner' THEN 1 
              WHEN 'admin' THEN 2 
              WHEN 'editor' THEN 3 
              ELSE 4 
            END ASC;
        `, [conversationId]);
        return res.rows || [];
      } catch (err) {
        console.warn('[ChatDB.getGroupMembers PG Error]', err.message);
      }
    }

    return fallbackStore.members.filter(m => m.conversation_id === conversationId);
  },

  async addGroupMember(conversationId, newUserId, role = 'member', requesterId) {
    if (isPgActive()) {
      try {
        // Check requester authority
        const reqMem = await queryPg('SELECT role FROM social_chat_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, requesterId]);
        const requesterRole = reqMem.rows[0]?.role;
        if (!['owner', 'admin'].includes(requesterRole)) {
          return { success: false, error: 'Only owners or admins can add members' };
        }

        const memId = `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await queryPg(`
          INSERT INTO social_chat_members (id, conversation_id, user_id, role)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `, [memId, conversationId, newUserId, role]);
        return { success: true };
      } catch (err) {
        console.warn('[ChatDB.addGroupMember PG Error]', err.message);
      }
    }

    fallbackStore.members.push({
      id: `mem_${Date.now()}`,
      conversation_id: conversationId,
      user_id: newUserId,
      role
    });
    return { success: true };
  },

  async updateMemberRole(conversationId, targetUserId, newRole, requesterId) {
    if (!['owner', 'admin', 'editor', 'member'].includes(newRole)) {
      return { success: false, error: 'Invalid role' };
    }

    if (isPgActive()) {
      try {
        const reqMem = await queryPg('SELECT role FROM social_chat_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, requesterId]);
        const requesterRole = reqMem.rows[0]?.role;
        if (!['owner', 'admin'].includes(requesterRole)) {
          return { success: false, error: 'Only owners or admins can assign roles' };
        }

        await queryPg(`
          UPDATE social_chat_members 
          SET role = $1 
          WHERE conversation_id = $2 AND user_id = $3
        `, [newRole, conversationId, targetUserId]);
        return { success: true };
      } catch (err) {
        console.warn('[ChatDB.updateMemberRole PG Error]', err.message);
      }
    }

    const mem = fallbackStore.members.find(m => m.conversation_id === conversationId && m.user_id === targetUserId);
    if (mem) mem.role = newRole;
    return { success: true };
  },

  async removeGroupMember(conversationId, targetUserId, requesterId) {
    if (isPgActive()) {
      try {
        const reqMem = await queryPg('SELECT role FROM social_chat_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, requesterId]);
        const requesterRole = reqMem.rows[0]?.role;

        // Allow user to leave themselves, or owner/admin to remove member
        if (targetUserId !== requesterId && !['owner', 'admin'].includes(requesterRole)) {
          return { success: false, error: 'Unauthorized to remove member' };
        }

        await queryPg('DELETE FROM social_chat_members WHERE conversation_id = $1 AND user_id = $2', [conversationId, targetUserId]);
        return { success: true };
      } catch (err) {
        console.warn('[ChatDB.removeGroupMember PG Error]', err.message);
      }
    }

    const idx = fallbackStore.members.findIndex(m => m.conversation_id === conversationId && m.user_id === targetUserId);
    if (idx !== -1) fallbackStore.members.splice(idx, 1);
    return { success: true };
  },

  // =========================================================================
  // 4. WEBRTC P2P CALL SESSIONS (ZERO SERVER BANDWIDTH LOAD)
  // =========================================================================
  async initiateCall({ conversationId, callerId, receiverId, callType = 'video' }) {
    const callId = `call_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const sessionKey = crypto.randomBytes(32).toString('hex');

    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO social_chat_call_sessions (id, conversation_id, caller_id, receiver_id, call_type, session_key, status, started_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'initiating', NOW())
        `, [callId, conversationId, callerId, receiverId, callType, sessionKey]);

        const res = await queryPg('SELECT * FROM social_chat_call_sessions WHERE id = $1', [callId]);
        return res.rows[0];
      } catch (err) {
        console.warn('[ChatDB.initiateCall PG Error]', err.message);
      }
    }

    const call = {
      id: callId,
      conversation_id: conversationId,
      caller_id: callerId,
      receiver_id: receiverId,
      call_type: callType,
      session_key: sessionKey,
      status: 'initiating',
      ice_candidates: [],
      created_at: new Date().toISOString()
    };
    fallbackStore.calls.unshift(call);
    return call;
  },

  async signalCall(callId, { sdpOffer, sdpAnswer, iceCandidate, status }) {
    if (isPgActive()) {
      try {
        const updates = [];
        const params = [callId];
        let idx = 2;
        if (sdpOffer) { updates.push(`sdp_offer = $${idx++}`); params.push(sdpOffer); }
        if (sdpAnswer) { updates.push(`sdp_answer = $${idx++}`); params.push(sdpAnswer); }
        if (status) { updates.push(`status = $${idx++}`); params.push(status); }

        if (updates.length > 0) {
          await queryPg(`UPDATE social_chat_call_sessions SET ${updates.join(', ')} WHERE id = $1`, params);
        }

        if (iceCandidate) {
          await queryPg(`
            UPDATE social_chat_call_sessions 
            SET ice_candidates = ice_candidates || $2::jsonb 
            WHERE id = $1
          `, [callId, JSON.stringify([iceCandidate])]);
        }

        const res = await queryPg('SELECT * FROM social_chat_call_sessions WHERE id = $1', [callId]);
        return res.rows[0];
      } catch (err) {
        console.warn('[ChatDB.signalCall PG Error]', err.message);
      }
    }

    const c = fallbackStore.calls.find(call => call.id === callId);
    if (c) {
      if (sdpOffer) c.sdp_offer = sdpOffer;
      if (sdpAnswer) c.sdp_answer = sdpAnswer;
      if (status) c.status = status;
      if (iceCandidate) {
        c.ice_candidates = c.ice_candidates || [];
        c.ice_candidates.push(iceCandidate);
      }
    }
    return c;
  },

  async getCall(callId) {
    if (isPgActive()) {
      try {
        const result = await queryPg('SELECT * FROM social_chat_call_sessions WHERE id = $1', [callId]);
        return result.rows[0] || null;
      } catch (err) {
        console.warn('[ChatDB.getCall PG Error]', err.message);
      }
    }
    return fallbackStore.calls.find((call) => call.id === callId) || null;
  },

  async endCall(callId, durationSeconds = 0) {
    if (isPgActive()) {
      try {
        const res = await queryPg(`
          UPDATE social_chat_call_sessions 
          SET status = 'ended', ended_at = NOW(), duration_seconds = $2
          WHERE id = $1
          RETURNING *;
        `, [callId, durationSeconds]);
        return res.rows[0];
      } catch (e) {
        console.warn('[ChatDB.endCall PG Error]', e.message);
      }
    }
    const c = fallbackStore.calls.find(call => call.id === callId);
    if (c) {
      c.status = 'ended';
      c.duration_seconds = durationSeconds;
    }
    return c;
  },

  async getCallHistory(userId) {
    if (isPgActive()) {
      try {
        const res = await queryPg(`
          SELECT cs.*, 
            u1.name as caller_name, u1.avatar as caller_avatar,
            u2.name as receiver_name, u2.avatar as receiver_avatar
          FROM social_chat_call_sessions cs
          LEFT JOIN system_users u1 ON u1.id = cs.caller_id
          LEFT JOIN system_users u2 ON u2.id = cs.receiver_id
          WHERE cs.caller_id = $1 OR cs.receiver_id = $1
          ORDER BY cs.created_at DESC
          LIMIT 50;
        `, [userId]);
        return res.rows || [];
      } catch (err) {
        console.warn('[ChatDB.getCallHistory PG Error]', err.message);
      }
    }
    return fallbackStore.calls.filter(c => c.caller_id === userId || c.receiver_id === userId);
  },

  // =========================================================================
  // 5. LIVE PRESENCE & ACTIVE STATUS
  // =========================================================================
  async updatePresence(userId, isOnline = true, customStatus = '') {
    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO social_user_presence (user_id, is_online, last_active_at, custom_status)
          VALUES ($1, $2, NOW(), $3)
          ON CONFLICT (user_id) DO UPDATE SET 
            is_online = EXCLUDED.is_online,
            last_active_at = NOW(),
            custom_status = EXCLUDED.custom_status;
        `, [userId, isOnline, customStatus]);
        return { success: true };
      } catch (err) {
        console.warn('[ChatDB.updatePresence PG Error]', err.message);
      }
    }
    fallbackStore.presence[userId] = { isOnline, lastActive: new Date().toISOString(), customStatus };
    return { success: true };
  },

  async getPresence(userId) {
    if (isPgActive()) {
      try {
        const res = await queryPg('SELECT * FROM social_user_presence WHERE user_id = $1', [userId]);
        return res.rows[0] || { is_online: false, last_active_at: null };
      } catch (err) {
        console.warn('[ChatDB.getPresence PG Error]', err.message);
      }
    }
    return fallbackStore.presence[userId] || { is_online: false, last_active_at: null };
  }
};
