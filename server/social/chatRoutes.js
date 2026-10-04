import express from 'express';
import { ChatDB } from './chatDb.js';
import { SocialDB } from './socialDb.js';

const router = express.Router();

function getUserId(req) {
  return req.activeUser?.id || req.user?.id || req.session?.userId || null;
}

async function requireUser(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

async function requireConversationMember(req, res) {
  const userId = await requireUser(req, res);
  if (!userId) return null;
  const conversations = await ChatDB.getConversations(userId, { archived: false });
  const archivedConversations = conversations.some((conversation) => conversation.id === req.params.id)
    ? conversations
    : await ChatDB.getConversations(userId, { archived: true });
  if (!archivedConversations.some((conversation) => conversation.id === req.params.id)) {
    res.status(403).json({ error: 'Not authorized for this conversation' });
    return null;
  }
  const conversation = await ChatDB.getConversation(req.params.id, userId);
  if (conversation?.type === 'direct') {
    const members = await ChatDB.getGroupMembers(req.params.id);
    const recipient = members.find((member) => member.user_id !== userId);
    if (!recipient || !(await SocialDB.canDirectMessage(userId, recipient.user_id))) {
      res.status(403).json({ error: 'Direct messages require a mutual follow or an accepted follow request.' });
      return null;
    }
  }
  return userId;
}

// 1. Conversations list
router.get('/conversations', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const archived = req.query.archived === 'true';
    const convs = await ChatDB.getConversations(userId, { archived });
    res.json(convs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create conversation (Direct or Group)
router.post('/conversations', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const { type = 'direct', title, avatar, memberIds = [] } = req.body;
    if (type === 'direct') {
      const recipientId = Array.isArray(memberIds) ? memberIds[0] : null;
      if (!recipientId || recipientId === userId || memberIds.length !== 1) {
        return res.status(400).json({ error: 'A direct conversation requires exactly one other user.' });
      }
      if (!(await SocialDB.canDirectMessage(userId, recipientId))) {
        return res.status(403).json({ error: 'Direct messages require a mutual follow or an accepted follow request.' });
      }
      const existing = await ChatDB.findDirectConversation(userId, recipientId);
      if (existing) return res.json(existing);
    }
    const conv = await ChatDB.createConversation({
      type,
      title,
      avatar,
      createdBy: userId,
      memberIds
    });
    res.status(201).json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get single conversation details
router.get('/conversations/:id', async (req, res) => {
  try {
    const userId = await requireConversationMember(req, res); if (!userId) return;
    const conv = await ChatDB.getConversation(req.params.id, userId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update conversation settings (archive, pin, disappearing TTL, rename)
router.put('/conversations/:id/settings', async (req, res) => {
  try {
    const userId = await requireConversationMember(req, res); if (!userId) return;
    const updated = await ChatDB.updateConversationSettings(req.params.id, req.body, userId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get messages in conversation
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = await requireConversationMember(req, res); if (!userId) return;
    const { before = null, beforeId = null, since = null } = req.query;
    if (before && (typeof before !== 'string' || Number.isNaN(Date.parse(before)))) {
      return res.status(400).json({ error: 'Invalid before timestamp' });
    }
    if (since && (typeof since !== 'string' || Number.isNaN(Date.parse(since)))) {
      return res.status(400).json({ error: 'Invalid since timestamp' });
    }
    if (beforeId && typeof beforeId !== 'string') {
      return res.status(400).json({ error: 'Invalid before message ID' });
    }
    const parsedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 50;
    const limit = Math.min(100, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 50));
    const msgs = await ChatDB.getMessages(req.params.id, { before, beforeId, since, limit });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Send message
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const senderId = await requireConversationMember(req, res); if (!senderId) return;
    const { content, messageType = 'text', mediaUrl, replyToId } = req.body;
    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'Content or media required' });
    }
    const newMsg = await ChatDB.sendMessage({
      conversationId: req.params.id,
      senderId,
      content,
      messageType,
      mediaUrl,
      replyToId
    });
    res.status(201).json(newMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Unsend message (for everyone)
router.post('/messages/:id/unsend', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const result = await ChatDB.unsendMessage(req.params.id, userId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Edit message
router.post('/messages/:id/edit', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const { content } = req.body;
    const result = await ChatDB.editMessage(req.params.id, userId, content);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. React to message
router.post('/messages/:id/react', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const { reaction } = req.body;
    const result = await ChatDB.reactToMessage(req.params.id, userId, reaction);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Mark messages seen
router.post('/conversations/:id/seen', async (req, res) => {
  try {
    const userId = await requireConversationMember(req, res); if (!userId) return;
    const result = await ChatDB.markMessagesSeen(req.params.id, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Group Members list
router.get('/conversations/:id/members', async (req, res) => {
  try {
    const userId = await requireConversationMember(req, res); if (!userId) return;
    const members = await ChatDB.getGroupMembers(req.params.id);
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 12. Add group member
router.post('/conversations/:id/members', async (req, res) => {
  try {
    const requesterId = await requireConversationMember(req, res); if (!requesterId) return;
    const { userId, role = 'member' } = req.body;
    const result = await ChatDB.addGroupMember(req.params.id, userId, role, requesterId);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 13. Update member role (admin, editor, member)
router.put('/conversations/:id/members/:targetUserId/role', async (req, res) => {
  try {
    const requesterId = await requireConversationMember(req, res); if (!requesterId) return;
    const { role } = req.body;
    const result = await ChatDB.updateMemberRole(req.params.id, req.params.targetUserId, role, requesterId);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Remove member or leave group
router.delete('/conversations/:id/members/:targetUserId', async (req, res) => {
  try {
    const requesterId = await requireConversationMember(req, res); if (!requesterId) return;
    const result = await ChatDB.removeGroupMember(req.params.id, req.params.targetUserId, requesterId);
    if (!result.success) return res.status(403).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// WEBRTC LIGHTWEIGHT CALL SIGNALING (ZERO SERVER BANDWIDTH LOAD)
// =========================================================================
// 15. Initiate Call (server returns session key & call record)
router.post('/calls/initiate', async (req, res) => {
  try {
    const callerId = await requireConversationMember(req, res); if (!callerId) return;
    const { conversationId, receiverId, callType = 'video' } = req.body;
    const call = await ChatDB.initiateCall({
      conversationId,
      callerId,
      receiverId,
      callType
    });
    res.status(201).json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 16. WebRTC Signal exchange (SDP offer/answer, ICE candidates)
router.post('/calls/:id/signal', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const call = await ChatDB.getCall(req.params.id);
    if (!call || ![call.caller_id, call.receiver_id].includes(userId)) return res.status(403).json({ error: 'Not authorized for this call' });
    const { sdpOffer, sdpAnswer, iceCandidate, status } = req.body;
    const updated = await ChatDB.signalCall(req.params.id, {
      sdpOffer,
      sdpAnswer,
      iceCandidate,
      status
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Poll signal state
router.get('/calls/:id/signal', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const existingCall = await ChatDB.getCall(req.params.id);
    if (!existingCall || ![existingCall.caller_id, existingCall.receiver_id].includes(userId)) return res.status(403).json({ error: 'Not authorized for this call' });
    // Returns current SDP/ICE state of the call session
    const call = await ChatDB.signalCall(req.params.id, {});
    res.json(call || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 18. End Call
router.post('/calls/:id/end', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const existingCall = await ChatDB.getCall(req.params.id);
    if (!existingCall || ![existingCall.caller_id, existingCall.receiver_id].includes(userId)) return res.status(403).json({ error: 'Not authorized for this call' });
    const { durationSeconds = 0 } = req.body;
    const call = await ChatDB.endCall(req.params.id, durationSeconds);
    res.json(call);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 19. Call history
router.get('/calls/history', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const history = await ChatDB.getCallHistory(userId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// PRESENCE & ACTIVE STATUS
// =========================================================================
router.post('/presence', async (req, res) => {
  try {
    const userId = await requireUser(req, res); if (!userId) return;
    const { isOnline = true, customStatus = '' } = req.body;
    const result = await ChatDB.updatePresence(userId, isOnline, customStatus);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/presence/:userId', async (req, res) => {
  try {
    if (!await requireUser(req, res)) return;
    const presence = await ChatDB.getPresence(req.params.userId);
    res.json(presence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
