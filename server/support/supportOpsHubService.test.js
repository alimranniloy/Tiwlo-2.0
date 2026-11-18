import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PGlite } from '@electric-sql/pglite';
import { createTicketingService } from './ticketingService.js';
import { createLiveChatQueueService } from './liveChatQueueService.js';
import { createSupportOpsHubService } from './supportOpsHubService.js';
import { createSupportRouter } from './ai/supportRoutes.js';
import { createAdminSupportRouter } from '../administrator/adminSupportRoutes.js';

function createMemorySupportDb() {
  const state = { tickets: [], conversations: [] };
  return {
    async getAllData() { return state; },
    async saveAllData(next) { Object.assign(state, next); return true; },
    async getTickets() { return state.tickets; },
    async getConversations() { return state.conversations; }
  };
}

async function startOpsTestServer({
  ticketingService,
  liveChatQueueService,
  opsHubService
}) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use((req, _res, next) => {
    if (req.headers['x-test-user']) {
      const user = JSON.parse(String(req.headers['x-test-user']));
      req.activeUser = user;
      req.user = user;
    }
    if (req.headers['x-test-admin']) {
      req.adminUser = JSON.parse(String(req.headers['x-test-admin']));
    }
    if (req.headers['x-test-admin-profile']) {
      req.adminProfile = JSON.parse(String(req.headers['x-test-admin-profile']));
    }
    next();
  });

  const requireAdmin = (req, res, next) => {
    if (!req.adminUser) return res.status(401).json({ success: false, error: 'Unauthorized' });
    return next();
  };

  const SupportDB = createMemorySupportDb();

  app.use(
    '/api/support',
    createSupportRouter({
      ticketingService,
      liveChatQueueService,
      opsHubService,
      SupportDB
    })
  );

  app.use(
    '/api/admin',
    createAdminSupportRouter({
      requireAdmin,
      requireRecentReauth: (_req, _res, next) => next(),
      deps: {
        ticketingService,
        liveChatQueueService,
        opsHubService,
        SupportDB
      }
    })
  );

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async request(path, { method = 'GET', body = null, admin = null, adminProfile = null, user = null } = {}) {
      const headers = {};
      if (body !== null) headers['content-type'] = 'application/json';
      if (admin) headers['x-test-admin'] = JSON.stringify(admin);
      if (adminProfile) headers['x-test-admin-profile'] = JSON.stringify(adminProfile);
      if (user) headers['x-test-user'] = JSON.stringify(user);

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      return { status: res.status, json, text };
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

const SUPER_ADMIN = {
  id: 'sup_root',
  name: 'Root SuperAdmin',
  email: 'tiwloltd@gmail.com',
  role: 'super_admin'
};

const AGENT_ALICE = {
  id: 'stf_alice',
  name: 'Alice Specialist',
  email: 'alice@tiwlo.com',
  role: 'admin',
  roleKey: 'support_lead'
};

const AGENT_BOB = {
  id: 'stf_bob',
  name: 'Bob Specialist',
  email: 'bob@tiwlo.com',
  role: 'admin',
  roleKey: 'support_agent'
};

const READONLY_FINANCE = {
  id: 'stf_fin',
  name: 'Farhan Finance',
  email: 'farhan@tiwlo.com',
  role: 'admin',
  roleKey: 'finance_analyst'
};

test('PostgreSQL (PGlite) support_ops_kv_store persistence, initial seeding, and reboot resilience', async (t) => {
  const pg = new PGlite();
  t.after(async () => { await pg.close(); });
  const queryPg = (sql, params = []) => pg.query(sql, params);

  const ops1 = createSupportOpsHubService({
    isPgActive: () => true,
    queryPg
  });

  // Seeded defaults on first access
  const kbInit = await ops1.listKbArticles();
  assert.equal(kbInit.success, true);
  assert.ok(kbInit.articles.length >= 3, 'Expected seeded KB articles');

  const deptInit = await ops1.listDepartments();
  assert.ok(deptInit.departments.length >= 4, 'Expected seeded departments');

  const rulesInit = await ops1.listAutomationRules();
  assert.ok(rulesInit.rules.length >= 3, 'Expected seeded automation rules');

  // Create custom KB article and delete one seeded article
  const created = await ops1.createKbArticle(
    {
      title: 'Reboot Persistence Verification Guide',
      category: 'Technical Cloud',
      visibility: 'internal',
      content: 'Verify PostgreSQL JSONB KV durability across process restarts.',
      tags: ['postgres', 'durability'],
      pinned: true
    },
    AGENT_ALICE
  );
  const deletedSeedId = kbInit.articles[kbInit.articles.length - 1].id;
  await ops1.deleteKbArticle(deletedSeedId);

  // Simulate server restart with a brand new service instance over the same PGlite DB
  const ops2 = createSupportOpsHubService({
    isPgActive: () => true,
    queryPg
  });
  const kbAfterReboot = await ops2.listKbArticles();
  assert.ok(kbAfterReboot.articles.some((a) => a.id === created.article.id));
  assert.ok(!kbAfterReboot.articles.some((a) => a.id === deletedSeedId), 'Deleted seeded article must not resurrect');
});

test('Quick Peek non-mutating preview & accurate Reply Eligibility across Tickets and Live Chats', async (t) => {
  const staffUsers = [SUPER_ADMIN, AGENT_ALICE, AGENT_BOB, READONLY_FINANCE];
  const ticketing = createTicketingService({ useMemory: true, staffUsers });
  const liveChat = createLiveChatQueueService({ useMemory: true });
  const opsHub = createSupportOpsHubService({
    useMemory: true,
    ticketingService: ticketing,
    liveChatQueueService: liveChat
  });
  const srv = await startOpsTestServer({
    ticketingService: ticketing,
    liveChatQueueService: liveChat,
    opsHubService: opsHub
  });
  t.after(async () => {
    ticketing.stopSupportAutomationScheduler();
    await srv.close();
  });

  // Create an unaccepted customer ticket
  const customer = { id: 'usr_cust1', name: 'Rina Store', email: 'rina@merchant.com' };
  const created = await ticketing.createTicket({
    authUser: customer,
    subject: 'SSL pending on custom domain',
    description: 'My storefront SSL has been pending for 2 hours.'
  });
  const ticketId = created.ticket.id;

  // 1. Unaccepted open ticket -> requiresAccept: true, does NOT mutate unread/assignment
  const peekUnaccepted = await srv.request(`/api/admin/support/quick-peek/ticket/${ticketId}`, {
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' }
  });
  assert.equal(peekUnaccepted.status, 200);
  assert.equal(peekUnaccepted.json.kind, 'ticket');
  assert.equal(peekUnaccepted.json.replyAccess.canReply, false);
  assert.equal(peekUnaccepted.json.replyAccess.requiresAccept, true);
  assert.equal(peekUnaccepted.json.replyAccess.unableReason, 'Unable to reply — Accept required first.');
  assert.equal(peekUnaccepted.json.ticket.unreadByStaff, true);
  assert.equal(peekUnaccepted.json.ticket.assignedAgentId, null);

  // 2. Read-only staff (missing support.reply) -> Read-only permission
  const peekReadOnly = await srv.request(`/api/admin/support/quick-peek/ticket/${ticketId}`, {
    admin: READONLY_FINANCE,
    adminProfile: { roleKey: 'finance_analyst', permissions: ['support.view'] }
  });
  assert.equal(peekReadOnly.status, 200);
  assert.equal(peekReadOnly.json.replyAccess.canReply, false);
  assert.equal(peekReadOnly.json.replyAccess.unableReason, 'Unable to reply — Read-only permission.');

  // 3. Alice accepts ticket -> Alice canReply: true, Bob sees Handled by another specialist
  await ticketing.acceptTicketAssignment({ ticketIdOrKey: ticketId, adminUser: AGENT_ALICE });

  const peekAlice = await srv.request(`/api/admin/support/quick-peek/ticket/${ticketId}`, {
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' }
  });
  assert.equal(peekAlice.status, 200);
  assert.equal(peekAlice.json.replyAccess.canReply, true);
  assert.equal(peekAlice.json.replyAccess.requiresAccept, false);
  assert.equal(peekAlice.json.replyAccess.unableReason, null);

  const peekBob = await srv.request(`/api/admin/support/quick-peek/ticket/${ticketId}`, {
    admin: AGENT_BOB,
    adminProfile: { roleKey: 'support_agent' }
  });
  assert.equal(peekBob.status, 200);
  assert.equal(peekBob.json.replyAccess.canReply, false);
  assert.equal(peekBob.json.replyAccess.unableReason, 'Unable to reply — Handled by another specialist.');

  // 4. Close ticket -> Conversation is closed
  await ticketing.updateTicket({
    ticketIdOrKey: ticketId,
    updates: { status: 'closed' },
    actorType: 'admin',
    adminUser: AGENT_ALICE
  });
  const peekClosed = await srv.request(`/api/admin/support/quick-peek/ticket/${ticketId}`, {
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' }
  });
  assert.equal(peekClosed.status, 200);
  assert.equal(peekClosed.json.replyAccess.canReply, false);
  assert.equal(peekClosed.json.replyAccess.unableReason, 'Unable to reply — Conversation is closed.');

  // 5. Live Chat Quick Peek lifecycle (waiting -> active for Alice / isolated for Bob -> closed)
  const chatReq = await liveChat.requestLiveChat({
    authUser: { id: 'usr_chat1', name: 'Karim Traders', email: 'karim@traders.com' },
    topic: 'POS Barcode Scanner Sync',
    initialMessage: 'Need help syncing barcode labels'
  });
  const chatId = chatReq.chat.id;

  const chatPeekWaiting = await srv.request(`/api/admin/support/quick-peek/livechat/${chatId}`, {
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' }
  });
  assert.equal(chatPeekWaiting.status, 200);
  assert.equal(chatPeekWaiting.json.kind, 'livechat');
  assert.equal(chatPeekWaiting.json.replyAccess.canReply, false);
  assert.equal(chatPeekWaiting.json.replyAccess.requiresAccept, true);
  assert.equal(chatPeekWaiting.json.replyAccess.unableReason, 'Unable to reply — Accept required first.');

  await liveChat.acceptLiveChatRequest(chatId, AGENT_ALICE);

  const chatPeekAlice = await srv.request(`/api/admin/support/quick-peek/livechat/${chatId}`, {
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' }
  });
  assert.equal(chatPeekAlice.status, 200);
  assert.equal(chatPeekAlice.json.replyAccess.canReply, true);
  assert.equal(chatPeekAlice.json.replyAccess.unableReason, null);

  const chatPeekBob = await srv.request(`/api/admin/support/quick-peek/livechat/${chatId}`, {
    admin: AGENT_BOB,
    adminProfile: { roleKey: 'support_agent' }
  });
  assert.equal(chatPeekBob.status, 200);
  assert.equal(chatPeekBob.json.replyAccess.canReply, false);
  assert.equal(chatPeekBob.json.replyAccess.unableReason, 'Unable to reply — Handled by another specialist.');

  await liveChat.endLiveChatSession(chatId, { actor: AGENT_ALICE, actorType: 'staff' });
  const chatPeekClosed = await srv.request(`/api/admin/support/quick-peek/livechat/${chatId}`, {
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' }
  });
  assert.equal(chatPeekClosed.status, 200);
  assert.equal(chatPeekClosed.json.replyAccess.canReply, false);
  assert.equal(chatPeekClosed.json.replyAccess.unableReason, 'Unable to reply — Conversation is closed.');
});

test('Outbound Ticket, Preferences, KB, Incidents + Broadcast, Handovers, Team Wall, Approvals & QA', async (t) => {
  const staffUsers = [SUPER_ADMIN, AGENT_ALICE, AGENT_BOB];
  const ticketing = createTicketingService({ useMemory: true, staffUsers });
  const liveChat = createLiveChatQueueService({ useMemory: true });
  const opsHub = createSupportOpsHubService({
    useMemory: true,
    ticketingService: ticketing,
    liveChatQueueService: liveChat,
    MasterDB: {
      async findUserByIdentifier(idOrEmail) {
        if (String(idOrEmail).toLowerCase() === 'vip@merchant.com') {
          return { id: 'usr_vip_1', name: 'VIP Merchant Ltd', email: 'vip@merchant.com', tiwiId: 'TIWI-VIP1' };
        }
        return null;
      }
    },
    executeAiFn: async ({ payload }) => {
      const promptText = payload?.contents?.[0]?.parts?.[0]?.text || '';
      if (promptText.includes('FORCE_FAIL')) {
        return { ok: false, reason: 'NO_HEALTHY_KEYS' };
      }
      return {
        ok: true,
        text: 'Polished Tiwlo Support response ready for customer.',
        model: 'gemini-2.5-flash',
        keyLabel: 'primary-pool-1'
      };
    }
  });

  const srv = await startOpsTestServer({
    ticketingService: ticketing,
    liveChatQueueService: liveChat,
    opsHubService: opsHub
  });
  t.after(async () => {
    ticketing.stopSupportAutomationScheduler();
    await srv.close();
  });

  // 1. Outbound Staff Ticket Creation (registered lookup + assignToSelf accepted)
  const outboundRes = await srv.request('/api/admin/support/tickets/create-outbound', {
    method: 'POST',
    admin: AGENT_ALICE,
    adminProfile: { roleKey: 'support_lead' },
    body: {
      customerName: 'VIP Merchant Ltd',
      customerEmail: 'vip@merchant.com',
      subject: 'Proactive Dedicated Node Migration Notice',
      description: 'We are upgrading your dedicated cluster window tonight.',
      priority: 'high',
      category: 'Technical / Store',
      department: 'Technical Cloud',
      assignToSelf: true
    }
  });
  assert.equal(outboundRes.status, 201);
  assert.equal(outboundRes.json.success, true);
  assert.equal(outboundRes.json.ticket.userId, 'usr_vip_1');
  assert.equal(outboundRes.json.ticket.assignedAgentId, AGENT_ALICE.id);
  assert.equal(outboundRes.json.ticket.assignmentStatus, 'accepted');

  // Outbound guest ticket (no phone supplied -> handled gracefully)
  const outboundGuest = await srv.request('/api/admin/support/tickets/create-outbound', {
    method: 'POST',
    admin: AGENT_BOB,
    adminProfile: { roleKey: 'support_agent' },
    body: {
      customerName: 'Walk-in Lead',
      customerEmail: 'lead@newshop.io',
      subject: 'Enterprise Onboarding Follow-Up',
      description: 'Follow-up after demo call.',
      assignToSelf: false
    }
  });
  assert.equal(outboundGuest.status, 201);
  assert.equal(outboundGuest.json.ticket.guestEmail, 'lead@newshop.io');

  // 2. Staff Workspace Preferences
  const prefInit = await srv.request('/api/admin/support/preferences/me', { admin: AGENT_ALICE });
  assert.equal(prefInit.status, 200);
  assert.equal(prefInit.json.preferences.ringDurationSeconds, 5);

  const prefSaved = await srv.request('/api/admin/support/preferences/me', {
    method: 'PUT',
    admin: AGENT_ALICE,
    body: {
      ringDurationSeconds: 15,
      uiDensity: 'compact',
      signatureText: 'Warmly,\nAlice · Tiwlo Lead',
      dailyResolvedGoal: 25
    }
  });
  assert.equal(prefSaved.status, 200);
  assert.equal(prefSaved.json.preferences.ringDurationSeconds, 15);
  assert.equal(prefSaved.json.preferences.uiDensity, 'compact');
  assert.equal(prefSaved.json.preferences.dailyResolvedGoal, 25);

  // Bob's preferences remain isolated
  const prefBob = await srv.request('/api/admin/support/preferences/me', { admin: AGENT_BOB });
  assert.equal(prefBob.json.preferences.ringDurationSeconds, 5);

  // 3. Knowledge Base CRUD + View & Helpful counters
  const kbCreate = await srv.request('/api/admin/support/kb/articles', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      title: 'bKash Webhook Timeout Playbook',
      category: 'Billing & Payments',
      visibility: 'internal',
      summary: 'Steps for bKash callback verification',
      content: 'Verify TrxID in payment gateway logs before issuing credit.',
      tags: ['bkash', 'webhook'],
      pinned: true
    }
  });
  assert.equal(kbCreate.status, 201);
  const artId = kbCreate.json.article.id;

  const kbGet = await srv.request(`/api/admin/support/kb/articles/${artId}`, { admin: AGENT_BOB });
  assert.equal(kbGet.status, 200);
  assert.equal(kbGet.json.article.viewsCount, 1);

  const kbHelpful = await srv.request(`/api/admin/support/kb/articles/${artId}/helpful`, {
    method: 'POST',
    admin: AGENT_BOB,
    body: {}
  });
  assert.equal(kbHelpful.status, 200);
  assert.equal(kbHelpful.json.article.helpfulCount, 1);

  const kbPatch = await srv.request(`/api/admin/support/kb/articles/${artId}`, {
    method: 'PATCH',
    admin: AGENT_ALICE,
    body: { title: 'bKash & Nagad Webhook Playbook', visibility: 'public' }
  });
  assert.equal(kbPatch.json.article.visibility, 'public');

  const kbSearch = await srv.request('/api/admin/support/kb/articles?q=Nagad&visibility=public', {
    admin: AGENT_ALICE
  });
  assert.equal(kbSearch.json.articles.some((a) => a.id === artId), true);

  const kbDel = await srv.request(`/api/admin/support/kb/articles/${artId}`, {
    method: 'DELETE',
    admin: AGENT_ALICE
  });
  assert.equal(kbDel.json.success, true);

  // 4. Major Incidents + Timeline Updates + Outage Broadcast
  const incCreate = await srv.request('/api/admin/support/incidents', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      title: 'Asia-South Ingress Latency Spike',
      severity: 'critical',
      summary: 'Elevated p95 latency on Singapore edge router.',
      affectedComponents: ['Storefront CDN', 'Checkout API']
    }
  });
  assert.equal(incCreate.status, 201);
  assert.equal(incCreate.json.incident.code, 'INC-101');
  const incId = incCreate.json.incident.id;

  const incBroadcast = await srv.request(`/api/admin/support/incidents/${incId}/broadcast`, {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      message: 'Our cloud team is rerouting edge traffic; full recovery expected within 15 minutes.',
      targetFilter: 'open_tickets'
    }
  });
  assert.equal(incBroadcast.status, 200);
  assert.equal(incBroadcast.json.incident.broadcastCount, 1);
  assert.ok(incBroadcast.json.notifiedCount >= 2, 'Should broadcast internal note to open tickets');

  const incResolve = await srv.request(`/api/admin/support/incidents/${incId}/updates`, {
    method: 'POST',
    admin: AGENT_ALICE,
    body: { status: 'resolved', message: 'Traffic rerouted and latency returned to normal.' }
  });
  assert.equal(incResolve.json.incident.status, 'resolved');
  assert.ok(incResolve.json.incident.resolvedAt);

  // 5. Shift Handovers + Idempotent Acknowledge
  const shfCreate = await srv.request('/api/admin/support/shift-handovers', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      shiftType: 'evening',
      headline: 'Evening Handover — Ingress Incident Resolved',
      summary: 'Monitor VIP cluster tickets.',
      blockers: 'Pending carrier postmortem',
      watchTicketIds: [outboundRes.json.ticket.serialNumber]
    }
  });
  assert.equal(shfCreate.status, 201);
  const shfId = shfCreate.json.handover.id;

  await srv.request(`/api/admin/support/shift-handovers/${shfId}/acknowledge`, {
    method: 'POST',
    admin: AGENT_BOB,
    body: {}
  });
  const ackAgain = await srv.request(`/api/admin/support/shift-handovers/${shfId}/acknowledge`, {
    method: 'POST',
    admin: AGENT_BOB,
    body: {}
  });
  assert.equal(ackAgain.json.handover.acknowledgedBy.length, 1, 'Acknowledge must be idempotent per staff');

  // 6. Internal Team Wall + Ticket Ref Extraction + Pin + Reactions
  const wallPost = await srv.request('/api/admin/support/team-wall', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      category: 'urgent',
      body: 'Heads up team: watch #TKT-901 and #TWTK-4410 for payment retries!'
    }
  });
  assert.equal(wallPost.status, 201);
  assert.deepEqual(wallPost.json.post.ticketRefs, ['#TKT-901', '#TWTK-4410']);
  const postId = wallPost.json.post.id;

  const pinnedRes = await srv.request(`/api/admin/support/team-wall/${postId}/pin`, {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {}
  });
  assert.equal(pinnedRes.json.post.pinned, true);

  const reactOn = await srv.request(`/api/admin/support/team-wall/${postId}/react`, {
    method: 'POST',
    admin: AGENT_BOB,
    body: { emoji: '🔥' }
  });
  assert.deepEqual(reactOn.json.post.reactions['🔥'], [AGENT_BOB.id]);

  const reactOff = await srv.request(`/api/admin/support/team-wall/${postId}/react`, {
    method: 'POST',
    admin: AGENT_BOB,
    body: { emoji: '🔥' }
  });
  assert.equal(reactOff.json.post.reactions['🔥'], undefined);

  const delPost = await srv.request(`/api/admin/support/team-wall/${postId}`, {
    method: 'DELETE',
    admin: AGENT_ALICE
  });
  assert.equal(delPost.json.success, true);

  // 7. Tier-2 Escalations & Action Approvals
  const aprCreate = await srv.request('/api/admin/support/approvals', {
    method: 'POST',
    admin: AGENT_BOB,
    body: {
      requestType: 'refund',
      ticketId: outboundRes.json.ticket.id,
      ticketSerial: outboundRes.json.ticket.serialNumber,
      customerName: 'VIP Merchant Ltd',
      amountLabel: '$49.00',
      reason: 'Duplicate gateway capture verified'
    }
  });
  assert.equal(aprCreate.status, 201);
  assert.equal(aprCreate.json.approval.status, 'pending');

  const aprDecide = await srv.request(`/api/admin/support/approvals/${aprCreate.json.approval.id}/decide`, {
    method: 'POST',
    admin: AGENT_ALICE,
    body: { decision: 'approved', decisionNote: 'Verified TrxID settlement, refund approved.' }
  });
  assert.equal(aprDecide.json.approval.status, 'approved');
  assert.equal(aprDecide.json.approval.decidedByName, AGENT_ALICE.name);

  // 8. QA Reviews & Coaching Scorecards
  const qaRes = await srv.request('/api/admin/support/qa-reviews', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      targetType: 'ticket',
      targetId: outboundRes.json.ticket.id,
      targetSerial: outboundRes.json.ticket.serialNumber,
      agentName: AGENT_BOB.name,
      toneScore: 5,
      accuracyScore: 4,
      brandScore: 5,
      speedScore: 4,
      coachingNote: 'Great empathy and accurate DNS steps.'
    }
  });
  assert.equal(qaRes.status, 201);
  assert.equal(qaRes.json.review.overallPct, 90); // (18 / 20) * 100 = 90
  assert.equal(qaRes.json.summary.totalReviews, 1);
  assert.equal(qaRes.json.summary.averagePct, 90);

  // 9. AI Copilot Playground (live pool mock + local fallback)
  const aiLive = await srv.request('/api/admin/support/ai-playground', {
    method: 'POST',
    admin: AGENT_BOB,
    body: { task: 'polish', input: 'we fixed your ssl now', customerName: 'Rina' }
  });
  assert.equal(aiLive.status, 200);
  assert.equal(aiLive.json.model, 'gemini-2.5-flash');
  assert.equal(aiLive.json.keyLabel, 'primary-pool-1');

  const aiFallback = await srv.request('/api/admin/support/ai-playground', {
    method: 'POST',
    admin: AGENT_BOB,
    body: { task: 'translate_bn', input: 'FORCE_FAIL please check order', customerName: 'Rina' }
  });
  assert.equal(aiFallback.status, 200);
  assert.equal(aiFallback.json.model, 'tiwlo-local-fallback');
  assert.ok(aiFallback.json.output.includes('Rina'));
});

test('Automation Rules, Departments, Blocklist, Scoped Personal Tasks, Customer 360 & Staff Access Onboarding', async (t) => {
  const staffUsers = [SUPER_ADMIN, AGENT_ALICE, AGENT_BOB];
  const ticketing = createTicketingService({ useMemory: true, staffUsers });
  const liveChat = createLiveChatQueueService({ useMemory: true });
  const opsHub = createSupportOpsHubService({
    useMemory: true,
    ticketingService: ticketing,
    liveChatQueueService: liveChat
  });
  const srv = await startOpsTestServer({
    ticketingService: ticketing,
    liveChatQueueService: liveChat,
    opsHubService: opsHub
  });
  t.after(async () => {
    ticketing.stopSupportAutomationScheduler();
    await srv.close();
  });

  // 1. Automation Rules CRUD
  const ruleCreate = await srv.request('/api/admin/support/automation-rules', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      name: 'POS Keyword Tagger',
      description: 'Tag POS printer inquiries',
      triggerField: 'keyword',
      triggerValue: 'thermal printer',
      actionType: 'add_tag',
      actionValue: 'pos-hardware'
    }
  });
  assert.equal(ruleCreate.status, 201);
  const rulePatch = await srv.request(`/api/admin/support/automation-rules/${ruleCreate.json.rule.id}`, {
    method: 'PATCH',
    admin: AGENT_ALICE,
    body: { enabled: false }
  });
  assert.equal(rulePatch.json.rule.enabled, false);
  const ruleDel = await srv.request(`/api/admin/support/automation-rules/${ruleCreate.json.rule.id}`, {
    method: 'DELETE',
    admin: AGENT_ALICE
  });
  assert.equal(ruleDel.json.success, true);

  // 2. Departments CRUD
  const deptCreate = await srv.request('/api/admin/support/departments', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      name: 'Enterprise Dedicated',
      leadName: 'Zara Khan',
      slaResponseMinutes: 15,
      slaResolveMinutes: 180,
      businessHours: '24/7 Priority'
    }
  });
  assert.equal(deptCreate.status, 201);
  assert.equal(deptCreate.json.department.slug, 'enterprise-dedicated');
  const deptPatch = await srv.request(`/api/admin/support/departments/${deptCreate.json.department.id}`, {
    method: 'PATCH',
    admin: AGENT_ALICE,
    body: { slaResponseMinutes: 10 }
  });
  assert.equal(deptPatch.json.department.slaResponseMinutes, 10);
  const deptDel = await srv.request(`/api/admin/support/departments/${deptCreate.json.department.id}`, {
    method: 'DELETE',
    admin: AGENT_ALICE
  });
  assert.equal(deptDel.json.success, true);

  // 3. Spam & Abuse Blocklist
  const blkCreate = await srv.request('/api/admin/support/blocklist', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: { kind: 'domain', value: 'spammer-bot.xyz', reason: 'Automated ticket flood' }
  });
  assert.equal(blkCreate.status, 201);
  const blkList = await srv.request('/api/admin/support/blocklist', { admin: AGENT_ALICE });
  assert.equal(blkList.json.rules.length, 1);
  await srv.request(`/api/admin/support/blocklist/${blkCreate.json.rule.id}`, {
    method: 'DELETE',
    admin: AGENT_ALICE
  });

  // 4. Personal Staff Tasks — strictly isolated per staffId
  const aliceTask = await srv.request('/api/admin/support/personal-tasks', {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      title: 'Follow up with Rina on SSL propagation',
      priority: 'high',
      linkedTicketSerial: '#TWTK-1001',
      pinned: true
    }
  });
  assert.equal(aliceTask.status, 201);

  const bobTasks = await srv.request('/api/admin/support/personal-tasks', { admin: AGENT_BOB });
  assert.equal(bobTasks.json.tasks.length, 0, 'Bob must not see Alice personal tasks');

  const bobCrossPatch = await srv.request(`/api/admin/support/personal-tasks/${aliceTask.json.task.id}`, {
    method: 'PATCH',
    admin: AGENT_BOB,
    body: { completed: true }
  });
  assert.equal(bobCrossPatch.status, 404, 'Bob must not mutate Alice personal task');

  const aliceDone = await srv.request(`/api/admin/support/personal-tasks/${aliceTask.json.task.id}`, {
    method: 'PATCH',
    admin: AGENT_ALICE,
    body: { completed: true }
  });
  assert.equal(aliceDone.json.task.completed, true);

  // 5. Customer 360 Directory & Notes
  const merchantUser = { id: 'usr_m360', name: 'Dhaka Apparel', email: 'owner@dhakaapparel.com' };
  await ticketing.createTicket({
    authUser: merchantUser,
    subject: 'Inventory CSV import question',
    description: 'How do I map SKU variants?'
  });
  await liveChat.requestLiveChat({
    authUser: merchantUser,
    topic: 'Quick SKU follow-up',
    initialMessage: 'Checking on my CSV question'
  });

  const custList = await srv.request('/api/admin/support/customers?q=dhakaapparel', {
    admin: AGENT_ALICE
  });
  assert.equal(custList.status, 200);
  assert.equal(custList.json.customers.length, 1);
  assert.equal(custList.json.customers[0].ticketsCount, 1);
  assert.equal(custList.json.customers[0].chatsCount, 1);

  const custKey = custList.json.customers[0].key;
  const custNote = await srv.request(`/api/admin/support/customers/${encodeURIComponent(custKey)}/note`, {
    method: 'POST',
    admin: AGENT_ALICE,
    body: {
      segment: 'vip',
      note: 'High-volume apparel merchant with 4 retail branches.'
    }
  });
  assert.equal(custNote.status, 200);
  assert.equal(custNote.json.customer.segment, 'vip');
  assert.equal(custNote.json.notes.length, 1);

  // 6. Public & Admin Staff Access Onboarding Requests
  const badPublicReq = await srv.request('/api/support/staff-access-request', {
    method: 'POST',
    body: { fullName: 'A', email: 'invalid-email' }
  });
  assert.equal(badPublicReq.status, 400);

  const pubSubmit = await srv.request('/api/support/staff-access-request', {
    method: 'POST',
    body: {
      fullName: 'Sadia Islam',
      email: 'sadia.ops@tiwlo.com',
      phone: '+8801712345678',
      desiredRole: 'support_agent',
      department: 'Customer Support',
      inviteCode: 'TIWLO-2026',
      reason: 'Joining evening support shift cohort.'
    }
  });
  assert.equal(pubSubmit.status, 201);
  assert.equal(pubSubmit.json.success, true);
  assert.match(pubSubmit.json.request.requestCode, /^REQ-\d{6}$/);
  assert.equal(pubSubmit.json.request.status, 'pending');

  const reqCode = pubSubmit.json.request.requestCode;
  const reqId = pubSubmit.json.request.id;

  const statusPending = await srv.request(
    `/api/support/staff-access-request/status?email=sadia.ops@tiwlo.com&code=${encodeURIComponent(reqCode)}`
  );
  assert.equal(statusPending.status, 200);
  assert.equal(statusPending.json.request.status, 'pending');

  const statusWrong = await srv.request(
    `/api/support/staff-access-request/status?email=wrong@tiwlo.com&code=${encodeURIComponent(reqCode)}`
  );
  assert.equal(statusWrong.status, 404);

  const adminListReqs = await srv.request('/api/admin/support/access-requests?status=pending', {
    admin: SUPER_ADMIN
  });
  assert.equal(adminListReqs.status, 200);
  assert.equal(adminListReqs.json.requests.length, 1);

  const adminApprove = await srv.request(`/api/admin/support/access-requests/${reqId}/decide`, {
    method: 'POST',
    admin: SUPER_ADMIN,
    body: {
      decision: 'approved',
      reviewNote: 'Welcome aboard! Provisioned in Evening Support Cohort.'
    }
  });
  assert.equal(adminApprove.status, 200);
  assert.equal(adminApprove.json.request.status, 'approved');

  const statusApproved = await srv.request(
    `/api/support/staff-access-request/status?email=sadia.ops@tiwlo.com&code=${encodeURIComponent(reqCode)}`
  );
  assert.equal(statusApproved.status, 200);
  assert.equal(statusApproved.json.request.status, 'approved');
  assert.equal(statusApproved.json.request.reviewedByName, SUPER_ADMIN.name);
});
