import express from 'express';
import { WhatsAppManager } from './whatsappManager.js';

const router = express.Router();

const getUserId = (req) => req.activeUser?.id || req.user?.id || req.session?.userId || null;

const requireUser = (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
};

const requireOwnedSession = async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return null;
  const session = await WhatsAppManager.getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return null;
  }
  if (session.userId !== userId) {
    res.status(403).json({ error: 'Not authorized for this WhatsApp session' });
    return null;
  }
  return session;
};

// 1. GET /api/whatsapp/sessions - List all sessions
router.get('/sessions', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const sessions = await WhatsAppManager.listSessions(userId);
    res.json({ success: true, sessions });
  } catch (err) {
    console.error('Error fetching whatsapp sessions:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. POST /api/whatsapp/sessions - Create new session & initialize QR
router.post('/sessions', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const { storeId = '', sessionName = 'Primary WhatsApp Store' } = req.body;
    const session = await WhatsAppManager.createSession({ userId, storeId, sessionName });
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error creating whatsapp session:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/whatsapp/sessions/:sessionId - Get single session status and live QR
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await requireOwnedSession(req, res); if (!session) return;
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error retrieving whatsapp session:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. PUT /api/whatsapp/sessions/:sessionId/automation - Update automation & persona settings
router.put('/sessions/:sessionId/automation', async (req, res) => {
  try {
    const ownedSession = await requireOwnedSession(req, res); if (!ownedSession) return;
    const { sessionId } = req.params;
    const session = await WhatsAppManager.updateAutomationConfig(sessionId, req.body);
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error updating whatsapp automation config:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4b. POST /api/whatsapp/sessions/:sessionId/regenerate-qr - Force refresh / regenerate QR
router.post('/sessions/:sessionId/regenerate-qr', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const { sessionId } = req.params;
    const session = await WhatsAppManager.regenerateQr(sessionId);
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error regenerating whatsapp QR:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/whatsapp/sessions/:sessionId/sync-store - Sync store products/catalog & domain pages
router.post('/sessions/:sessionId/sync-store', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const { sessionId } = req.params;
    const storeKnowledge = await WhatsAppManager.syncStoreData(sessionId, req.body);
    res.json({ success: true, storeKnowledge });
  } catch (err) {
    console.error('Error syncing store data for whatsapp session:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/whatsapp/sessions/:sessionId/test-ai - Test AI persona simulation
router.post('/sessions/:sessionId/test-ai', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const { sessionId } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required for AI simulation' });
    }
    const result = await WhatsAppManager.testAiResponse(sessionId, message.trim());
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error simulating whatsapp AI response:', err);
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/whatsapp/sessions/:sessionId/disconnect - Disconnect / logout
router.post('/sessions/:sessionId/disconnect', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const { sessionId } = req.params;
    const session = await WhatsAppManager.disconnectSession(sessionId);
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error disconnecting whatsapp session:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. DELETE /api/whatsapp/sessions/:sessionId - Delete session
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const { sessionId } = req.params;
    const result = await WhatsAppManager.deleteSession(sessionId);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error deleting whatsapp session:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
