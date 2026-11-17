import express from 'express';
import { WhatsAppManager } from './whatsappManager.js';
import { MasterDB } from '../db/multiTenant.js';
import { BillingDB } from '../db/billing.js';
import { getWhatsappPackages, saveWhatsappPackages } from '../db/packages.js';
import {
  checkServiceLimit,
  evaluateServiceTierInsight,
  getServiceSubscription,
  incrementServiceUsage,
  listServiceNotifications,
  listServiceOrders,
  markServiceNotificationsRead,
  setServiceAutoRenew,
  subscribeServiceWithCredits
} from '../db/serviceSubscriptions.js';
import { isSuperAdminAccount } from '../administrator/identityRiskGraph.js';

const router = express.Router();

const getUserId = (req) => req.activeUser?.id || req.user?.id || req.session?.userId || null;

const isAdminUser = (user) => {
  if (!user || user.isBanned) return false;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'admin' || role === 'super_admin' || isSuperAdminAccount(user);
};

const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.activeUser || req.user)) {
    return res.status(403).json({ error: 'Administrator privileges required' });
  }
  next();
};

const verifyStoreOwnership = async (req, userId, storeId) => {
  if (!storeId) return true;
  if (isAdminUser(req.activeUser || req.user)) return true;
  return Boolean(await MasterDB.userHasStoreAccess(userId, storeId));
};

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

// 0. PACKAGES, SUBSCRIPTION & ADMIN CONFIG
router.get('/packages', async (req, res) => {
  try {
    const includeDisabled = req.query.includeDisabled === 'true' && isAdminUser(req.activeUser || req.user);
    const packages = await getWhatsappPackages({ includeDisabled });
    res.json({ success: true, packages });
  } catch (err) {
    console.error('Error loading whatsapp packages:', err);
    res.status(500).json({ error: 'Failed to load WhatsApp Bot packages' });
  }
});

router.get('/admin/packages', requireAdmin, async (req, res) => {
  try {
    const packages = await getWhatsappPackages({ includeDisabled: true });
    res.json({ success: true, packages });
  } catch (err) {
    console.error('Error loading admin whatsapp packages:', err);
    res.status(500).json({ error: 'Failed to load WhatsApp Bot packages' });
  }
});

router.put('/admin/packages', requireAdmin, async (req, res) => {
  try {
    const { packages } = req.body || {};
    if (!Array.isArray(packages)) {
      return res.status(400).json({ error: 'packages array is required' });
    }
    const saved = await saveWhatsappPackages(packages);
    res.json({ success: true, packages: saved, message: 'WhatsApp Bot packages updated successfully.' });
  } catch (err) {
    console.error('Error saving admin whatsapp packages:', err);
    res.status(400).json({ error: err.message || 'Failed to save WhatsApp Bot packages' });
  }
});

router.get('/admin/orders', requireAdmin, async (req, res) => {
  try {
    const result = await listServiceOrders({
      serviceType: 'whatsapp',
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error fetching whatsapp orders:', err);
    res.status(500).json({ error: 'Failed to load WhatsApp Bot orders' });
  }
});

function isAllowedWithoutWhatsappSubscription(reqPath = '') {
  const p = String(reqPath || '/');
  return (
    p === '/packages' ||
    p === '/subscription' ||
    p.startsWith('/subscription/') ||
    p === '/admin' ||
    p.startsWith('/admin/')
  );
}

async function requireActiveWhatsappSubscription(req, res, next) {
  try {
    if (isAllowedWithoutWhatsappSubscription(req.path)) {
      return next();
    }
    const userId = requireUser(req, res);
    if (!userId) return;
    const subscription = await getServiceSubscription(userId, 'whatsapp');
    if (!subscription || subscription.isActive !== true) {
      const packages = await getWhatsappPackages();
      return res.status(402).json({
        error: 'Active subscription required before entering the dashboard.',
        code: 'SUBSCRIPTION_REQUIRED',
        serviceType: 'whatsapp',
        subscription: subscription || null,
        packages
      });
    }
    req.serviceSubscription = subscription;
    return next();
  } catch (err) {
    console.error('WhatsApp subscription gate error:', err);
    return res.status(500).json({ error: 'Failed to verify WhatsApp subscription status' });
  }
}

router.get('/subscription', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const [subscription, packages, sessions, notifications] = await Promise.all([
      getServiceSubscription(userId, 'whatsapp'),
      getWhatsappPackages(),
      WhatsAppManager.listSessions(userId).catch(() => []),
      listServiceNotifications(userId, { serviceType: 'whatsapp', unreadOnly: true })
    ]);
    const autoReplyFlowsCount = sessions.filter(s => Boolean(s.automationConfig?.enabled)).length;
    const usage = {
      sessionsCount: sessions.length,
      autoReplyFlowsCount,
      monthlyMessagesUsed: Number(subscription?.usage?.monthlyMessages || 0),
      dailyBroadcastsUsed: Number(subscription?.usage?.dailyBroadcasts || 0)
    };
    const tierInsight = await evaluateServiceTierInsight({
      serviceType: 'whatsapp',
      subscription,
      packages,
      usage: {
        sessionsCount: usage.sessionsCount,
        autoReplyFlowsCount: usage.autoReplyFlowsCount,
        monthlyMessages: usage.monthlyMessagesUsed,
        dailyBroadcasts: usage.dailyBroadcastsUsed
      }
    });
    res.json({
      success: true,
      subscription,
      packages,
      usage,
      tierInsight,
      notifications
    });
  } catch (err) {
    console.error('Error loading whatsapp subscription:', err);
    res.status(500).json({ error: 'Failed to load WhatsApp subscription status' });
  }
});

router.post('/subscription/purchase', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const { planId, autoRenew } = req.body || {};
    if (!planId || typeof planId !== 'string') {
      return res.status(400).json({ error: 'planId is required.' });
    }
    if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
      return res.status(400).json({ error: 'autoRenew must be a boolean.' });
    }
    const result = await subscribeServiceWithCredits({
      userId,
      userRole: req.activeUser?.role || req.user?.role,
      serviceType: 'whatsapp',
      planId,
      autoRenew,
      billingDB: BillingDB,
      userEmail: req.activeUser?.email || req.user?.email || null,
      userName: req.activeUser?.storeName || req.activeUser?.name || req.user?.name || null
    });
    if (!result.success) {
      return res.status(result.statusCode || 402).json({
        error: result.error,
        code: result.code || 'PAYMENT_REQUIRED',
        requiredAmount: result.requiredAmount,
        availableCredits: result.availableCredits,
        shortfall: result.shortfall,
        packages: result.packages
      });
    }
    res.json({
      success: true,
      subscription: result.subscription,
      billing: result.chargeResult || result.billing,
      orderNumber: result.orderNumber || result.chargeResult?.orderNumber || result.invoice?.orderNumber || null,
      invoice: result.invoice || result.chargeResult?.invoice || null,
      message: `${result.subscription?.planName || 'WhatsApp Bot'} subscription activated.`
    });
  } catch (err) {
    console.error('Error purchasing whatsapp subscription:', err);
    res.status(500).json({ error: err.message || 'Failed to activate WhatsApp subscription' });
  }
});

router.patch('/subscription/auto-renew', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const { autoRenew } = req.body || {};
    if (typeof autoRenew !== 'boolean') {
      return res.status(400).json({ error: 'autoRenew boolean is required.' });
    }
    const result = await setServiceAutoRenew({
      userId,
      serviceType: 'whatsapp',
      autoRenew
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        error: result.error,
        code: result.code
      });
    }
    res.json({
      success: true,
      subscription: result.subscription,
      message: `WhatsApp auto-renewal ${autoRenew ? 'enabled' : 'disabled'}.`
    });
  } catch (err) {
    console.error('Error toggling whatsapp auto-renew:', err);
    res.status(500).json({ error: 'Failed to update WhatsApp auto-renewal setting' });
  }
});

router.get('/subscription/notifications', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await listServiceNotifications(userId, {
      serviceType: 'whatsapp',
      unreadOnly
    });
    res.json({
      success: true,
      notifications,
      unreadCount: notifications.filter((n) => !n.readAt).length
    });
  } catch (err) {
    console.error('Error loading whatsapp notifications:', err);
    res.status(500).json({ error: 'Failed to load WhatsApp subscription notifications' });
  }
});

router.post('/subscription/notifications/read', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const result = await markServiceNotificationsRead(userId, {
      serviceType: 'whatsapp',
      notificationId: req.body?.notificationId || null
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error marking whatsapp notifications read:', err);
    res.status(500).json({ error: 'Failed to mark WhatsApp notifications as read' });
  }
});

router.use(requireActiveWhatsappSubscription);

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

// 2. POST /api/whatsapp/sessions - Create new session & initialize QR (SUBSCRIPTION GATED)
router.post('/sessions', async (req, res) => {
  try {
    const userId = requireUser(req, res); if (!userId) return;
    const { storeId = '', sessionName = 'Primary WhatsApp Store' } = req.body;
    if (storeId && !(await verifyStoreOwnership(req, userId, storeId))) {
      return res.status(403).json({ error: 'Not authorized to link this store' });
    }
    const existingSessions = await WhatsAppManager.listSessions(userId);
    const gate = await checkServiceLimit(userId, 'whatsapp', { sessionsCount: existingSessions.length });
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        metric: gate.metric,
        limit: gate.limit,
        current: gate.current,
        packages: gate.packages
      });
    }
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

// 4. PUT /api/whatsapp/sessions/:sessionId/automation - Update automation & persona settings (SUBSCRIPTION GATED)
router.put('/sessions/:sessionId/automation', async (req, res) => {
  try {
    const ownedSession = await requireOwnedSession(req, res); if (!ownedSession) return;
    const { sessionId } = req.params;
    const userSessions = await WhatsAppManager.listSessions(ownedSession.userId);
    const currentlyEnabled = Boolean(ownedSession.automationConfig?.enabled);
    const nextEnabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : currentlyEnabled;
    const otherActiveFlows = userSessions.filter(s => s.sessionId !== sessionId && Boolean(s.automationConfig?.enabled)).length;
    const gate = await checkServiceLimit(ownedSession.userId, 'whatsapp', {
      autoReplyFlowsCount: nextEnabled && !currentlyEnabled ? otherActiveFlows : undefined
    });
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        metric: gate.metric,
        limit: gate.limit,
        current: gate.current,
        packages: gate.packages
      });
    }
    if (req.body?.webhookUrl && !gate.limits?.webhookEnabled) {
      return res.status(403).json({
        error: 'Custom Webhooks are not included in your current WhatsApp Bot package.',
        code: 'FEATURE_NOT_IN_PLAN'
      });
    }
    const session = await WhatsAppManager.updateAutomationConfig(sessionId, req.body);
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error updating whatsapp automation config:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4b. POST /api/whatsapp/sessions/:sessionId/regenerate-qr - Force refresh / regenerate QR (SUBSCRIPTION GATED)
router.post('/sessions/:sessionId/regenerate-qr', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const gate = await checkServiceLimit(ownedSession.userId, 'whatsapp', {});
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        packages: gate.packages
      });
    }
    const { sessionId } = req.params;
    const session = await WhatsAppManager.regenerateQr(sessionId);
    res.json({ success: true, session });
  } catch (err) {
    console.error('Error regenerating whatsapp QR:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/whatsapp/sessions/:sessionId/sync-store - Sync store products/catalog & domain pages (SUBSCRIPTION GATED)
router.post('/sessions/:sessionId/sync-store', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const gate = await checkServiceLimit(ownedSession.userId, 'whatsapp', {});
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        packages: gate.packages
      });
    }
    const { sessionId } = req.params;
    const targetStoreId = req.body?.storeId || ownedSession.storeId || '';
    if (targetStoreId && !(await verifyStoreOwnership(req, ownedSession.userId, targetStoreId))) {
      return res.status(403).json({ error: 'Not authorized to sync this store' });
    }
    const storeKnowledge = await WhatsAppManager.syncStoreData(sessionId, {
      ...req.body,
      storeId: targetStoreId
    });
    res.json({ success: true, storeKnowledge });
  } catch (err) {
    console.error('Error syncing store data for whatsapp session:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/whatsapp/sessions/:sessionId/test-ai - Test AI persona simulation (SUBSCRIPTION GATED)
router.post('/sessions/:sessionId/test-ai', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const gate = await checkServiceLimit(ownedSession.userId, 'whatsapp', { checkMessages: true });
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        metric: gate.metric,
        limit: gate.limit,
        current: gate.current,
        packages: gate.packages
      });
    }
    const { sessionId } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required for AI simulation' });
    }
    const result = await WhatsAppManager.testAiResponse(sessionId, message.trim());
    await incrementServiceUsage(ownedSession.userId, 'whatsapp', 'monthlyMessages', 1);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Error simulating whatsapp AI response:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6b. POST /api/whatsapp/sessions/:sessionId/send - Send direct or broadcast WhatsApp message (QUOTA GATED)
router.post('/sessions/:sessionId/send', async (req, res) => {
  try {
    const ownedSession = (await requireOwnedSession(req, res)); if (!ownedSession) return;
    const { sessionId } = req.params;
    const { to, recipients, text, isBroadcast = false } = req.body || {};
    const targetList = Array.isArray(recipients) && recipients.length > 0 ? recipients : (to ? [to] : []);
    if (targetList.length === 0 || !String(text || '').trim()) {
      return res.status(400).json({ error: 'Recipient(s) and message text are required.' });
    }
    const broadcastMode = Boolean(isBroadcast || targetList.length > 1);
    const gate = await checkServiceLimit(ownedSession.userId, 'whatsapp', {
      checkMessages: true,
      checkBroadcast: broadcastMode
    });
    if (!gate.allowed) {
      return res.status(gate.statusCode || 402).json({
        error: gate.error,
        code: gate.code,
        metric: gate.metric,
        limit: gate.limit,
        current: gate.current,
        packages: gate.packages
      });
    }
    // Also verify batch won't overshoot monthly limit
    const usedMessages = Number(gate.subscription?.usage?.monthlyMessages || 0);
    if (gate.limits?.monthlyMessagesLimit > 0 && usedMessages + targetList.length > gate.limits.monthlyMessagesLimit) {
      return res.status(403).json({
        error: `Sending ${targetList.length} message(s) exceeds your monthly WhatsApp limit (${usedMessages}/${gate.limits.monthlyMessagesLimit}).`,
        code: 'LIMIT_EXCEEDED',
        metric: 'monthlyMessagesLimit',
        limit: gate.limits.monthlyMessagesLimit,
        current: usedMessages
      });
    }

    let updatedSession = ownedSession;
    for (const recipient of targetList) {
      updatedSession = await WhatsAppManager.sendOutboundMessage(sessionId, { to: recipient, text });
    }
    await incrementServiceUsage(ownedSession.userId, 'whatsapp', 'monthlyMessages', targetList.length);
    if (broadcastMode) {
      await incrementServiceUsage(ownedSession.userId, 'whatsapp', 'dailyBroadcasts', 1);
    }
    res.json({ success: true, session: updatedSession, sentCount: targetList.length });
  } catch (err) {
    console.error('Error sending whatsapp message:', err);
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
