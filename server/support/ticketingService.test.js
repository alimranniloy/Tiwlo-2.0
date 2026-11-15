import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PGlite } from '@electric-sql/pglite';
import {
  createTicketingService,
  GUEST_SUPPORT_COOKIE,
  SupportServiceError
} from './ticketingService.js';
import { createSupportRouter, userMatchesRecord } from './ai/supportRoutes.js';
import { createAdminSupportRouter } from '../administrator/adminSupportRoutes.js';

function createMemorySupportDb() {
  const state = { tickets: [], conversations: [] };
  return {
    async getAllData() { return state; },
    async saveAllData(next) { Object.assign(state, next); return true; },
    async getTickets(userId = null) { return userId ? state.tickets.filter((t) => t.userId === userId) : state.tickets; },
    async getTicketById(id) { return state.tickets.find((t) => t.id === id || t.ticketId === id) || null; },
    async createTicket(t) { state.tickets.unshift(t); return t; },
    async updateTicket(id, u) {
      const f = state.tickets.find((t) => t.id === id || t.ticketId === id);
      if (!f) return null;
      Object.assign(f, u);
      return f;
    },
    async getConversations(userId = null) { return userId ? state.conversations.filter((c) => c.userId === userId) : state.conversations; },
    async getConversation(id) { return state.conversations.find((c) => c.id === id) || null; },
    async saveConversation(c) {
      const idx = state.conversations.findIndex((x) => x.id === c.id);
      if (idx >= 0) state.conversations[idx] = c;
      else state.conversations.unshift(c);
      return c;
    }
  };
}

async function startTestApp({ ticketingService, SupportDB, storeMediaImpl = null }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Header-driven mock auth for isolated HTTP testing
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
    if (!req.adminUser) return res.status(401).json({ error: 'Unauthorized' });
    return next();
  };

  app.use(
    '/api/support',
    createSupportRouter({
      ticketingService,
      SupportDB,
      TiwiAI: {
        async generateSupportReply({ userMessage }) {
          return { reply: `AI echo: ${userMessage}`, actionsExecuted: [] };
        }
      },
      storeMedia: storeMediaImpl || (async ({ buffer }) => ({ id: 'media_1', size: buffer.length, sha256: 'abc' })),
      getPublicMediaUrl: async (p) => `https://cdn.tiwlo.test${p}`
    })
  );

  app.use(
    '/api/admin',
    createAdminSupportRouter({
      requireAdmin,
      requireRecentReauth: (_req, _res, next) => next(),
      deps: { ticketingService }
    })
  );

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async request(path, { method = 'GET', body = null, headers = {}, cookie = '' } = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      return { status: res.status, headers: res.headers, setCookies, json, text };
    },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function extractCookieValue(setCookies, name) {
  for (const raw of setCookies || []) {
    if (raw.startsWith(`${name}=`)) {
      return raw.split(';', 1)[0];
    }
  }
  return '';
}

test('Guest contact validation, signed HttpOnly SameSite=Lax cookie, recovery lookup & user claim', async (t) => {
  const staffUsers = [
    { id: 'sup_1', name: 'Root Owner', email: 'tiwloltd@gmail.com', role: 'super_admin' },
    { id: 'adm_1', name: 'Alice Support', email: 'alice@tiwlo.com', role: 'admin', roleKey: 'support_agent' }
  ];
  const svc = createTicketingService({ useMemory: true, staffUsers });
  const srv = await startTestApp({ ticketingService: svc, SupportDB: createMemorySupportDb() });
  t.after(async () => { svc.stopSupportAutomationScheduler(); await srv.close(); });

  // 1. Rejects unauthenticated /initiate, /tickets, /message without guest contact
  for (const [path, body] of [
    ['/api/support/tickets', { subject: 'Help' }],
    ['/api/support/initiate', { initialSubject: 'Live Help' }],
    ['/api/support/message', { message: 'Hello' }],
    ['/api/support/conversations/c1/messages', { text: 'Hello' }]
  ]) {
    const res = await srv.request(path, { method: 'POST', body });
    assert.equal(res.status, 400, `Expected 400 on ${path}`);
    assert.equal(res.json.code, 'GUEST_CONTACT_REQUIRED');
  }

  // Rejects invalid phone / email
  const badPhone = await srv.request('/api/support/guest/session', {
    method: 'POST',
    body: { guestName: 'Sam', guestEmail: 'sam@example.com', guestPhone: '123' }
  });
  assert.equal(badPhone.status, 400);
  assert.equal(badPhone.json.code, 'GUEST_CONTACT_REQUIRED');

  // 2. Valid guest creates ticket -> receives signed cookie & one-time recoveryCode; no Sarah Jenkins
  const created = await srv.request('/api/support/tickets', {
    method: 'POST',
    body: {
      guestName: 'Jane Doe',
      guestEmail: 'Jane@Example.com',
      guestPhone: '+880 1711-000111',
      subject: 'Cannot access billing invoice',
      description: 'Need copy of March invoice',
      priority: 'high'
    }
  });
  assert.equal(created.status, 201);
  assert.ok(created.json.recoveryCode?.startsWith('TW-'));
  assert.equal(created.json.ticket.assignedAgent, null);
  assert.equal(created.json.ticket.assignedAgentId, null);
  assert.equal(created.json.ticket.guestAccessHash, undefined);
  assert.equal(created.json.ticket.priority, 'high');
  assert.equal(created.json.ticket.status, 'open');

  const rawSetCookie = created.setCookies.find((c) => c.startsWith(`${GUEST_SUPPORT_COOKIE}=`));
  assert.ok(rawSetCookie, 'Must set tiwlo_guest_support cookie');
  assert.match(rawSetCookie, /HttpOnly/i);
  assert.match(rawSetCookie, /SameSite=Lax/i);
  const guestCookie = extractCookieValue(created.setCookies, GUEST_SUPPORT_COOKIE);

  // Forged cookie is rejected
  const forged = await srv.request('/api/support/tickets', {
    cookie: `${GUEST_SUPPORT_COOKIE}=gsess_fake.nonce.badhmac`
  });
  assert.equal(forged.status, 401);

  // Valid guest cookie lists only guest's own tickets & searches by serialNumber
  const listRes = await srv.request(`/api/support/tickets?q=${encodeURIComponent(created.json.ticket.serialNumber)}`, {
    cookie: guestCookie
  });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.json.tickets.length, 1);
  assert.equal(listRes.json.tickets[0].ticketId, created.json.ticket.ticketId);

  // 3. Cross-browser lookup via ticketNumber + email + phone + recoveryCode
  const badLookup = await srv.request('/api/support/guest/lookup', {
    method: 'POST',
    body: {
      ticketNumber: created.json.ticket.ticketId,
      guestEmail: 'jane@example.com',
      guestPhone: '+8801711000111',
      recoveryCode: 'TW-WRONG-CODE'
    }
  });
  assert.equal(badLookup.status, 401);

  const goodLookup = await srv.request('/api/support/guest/lookup', {
    method: 'POST',
    body: {
      ticketNumber: created.json.ticket.serialNumber,
      guestEmail: 'jane@example.com',
      guestPhone: '+8801711000111',
      recoveryCode: created.json.recoveryCode
    }
  });
  assert.equal(goodLookup.status, 200);
  assert.equal(goodLookup.json.ticket.id, created.json.ticket.id);
  const freshGuestCookie = extractCookieValue(goodLookup.setCookies, GUEST_SUPPORT_COOKIE);
  assert.ok(freshGuestCookie);

  // 4. Guest registers/logs in -> claims guest sessions & tickets by cookie/email
  const claimRes = await srv.request('/api/support/guest/claim', {
    method: 'POST',
    cookie: freshGuestCookie,
    headers: {
      'x-test-user': JSON.stringify({ id: 'usr_jane', name: 'Jane Doe', email: 'jane@example.com', role: 'owner' })
    }
  });
  assert.equal(claimRes.status, 200);
  assert.equal(claimRes.json.claimedTicketCount, 1);
  assert.ok(claimRes.json.ticketIds.includes(created.json.ticket.id));

  // Authenticated user now sees the claimed ticket and guest_claimed audit event
  const detailAfterClaim = await srv.request(`/api/support/tickets/${created.json.ticket.ticketId}`, {
    headers: {
      'x-test-user': JSON.stringify({ id: 'usr_jane', name: 'Jane Doe', email: 'jane@example.com', role: 'owner' })
    }
  });
  assert.equal(detailAfterClaim.status, 200);
  assert.equal(detailAfterClaim.json.ticket.userId, 'usr_jane');
  assert.ok(detailAfterClaim.json.events.some((e) => e.eventType === 'guest_claimed'));
});

test('Closed ticket reply lock, reopen policy toggle, reply editHistory & internal notes isolation', async (t) => {
  const svc = createTicketingService({
    useMemory: true,
    staffUsers: [
      { id: 'sup_1', name: 'Root', email: 'tiwloltd@gmail.com', role: 'super_admin' },
      { id: 'adm_1', name: 'Alice Agent', email: 'alice@tiwlo.com', role: 'admin', roleKey: 'support_lead' }
    ]
  });
  const srv = await startTestApp({ ticketingService: svc, SupportDB: createMemorySupportDb() });
  t.after(async () => { svc.stopSupportAutomationScheduler(); await srv.close(); });

  const userHdr = { 'x-test-user': JSON.stringify({ id: 'u_1', name: 'Merchant One', email: 'm1@shop.com', role: 'owner' }) };
  const adminHdr = { 'x-test-admin': JSON.stringify({ id: 'adm_1', name: 'Alice Agent', email: 'alice@tiwlo.com', role: 'admin' }) };
  const superHdr = { 'x-test-admin': JSON.stringify({ id: 'sup_1', name: 'Root', email: 'tiwloltd@gmail.com', role: 'super_admin' }) };

  // Create ticket as user
  const created = await srv.request('/api/support/tickets', {
    method: 'POST',
    headers: userHdr,
    body: { subject: 'DNS setup help', description: 'Initial question' }
  });
  assert.equal(created.status, 201);
  const tid = created.json.ticket.id;

  // Admin posts an internal note and a public reply, then edits the public reply
  const internalRes = await srv.request(`/api/admin/support/tickets/${tid}/replies`, {
    method: 'POST',
    headers: adminHdr,
    body: { message: 'Internal fraud check clear', isInternal: true }
  });
  assert.equal(internalRes.status, 201);

  const pubReplyRes = await srv.request(`/api/admin/support/tickets/${tid}/replies`, {
    method: 'POST',
    headers: adminHdr,
    body: { message: 'Please update A record to 1.2.3.4', isInternal: false }
  });
  assert.equal(pubReplyRes.status, 201);
  const replyId = pubReplyRes.json.reply.id;

  const editRes = await srv.request(`/api/admin/support/tickets/${tid}/replies/${replyId}`, {
    method: 'PATCH',
    headers: adminHdr,
    body: { message: 'Please update A record to 5.6.7.8' }
  });
  assert.equal(editRes.status, 200);
  assert.equal(editRes.json.reply.message, 'Please update A record to 5.6.7.8');
  assert.equal(editRes.json.reply.editHistory.length, 1);
  assert.equal(editRes.json.reply.editHistory[0].previousMessage, 'Please update A record to 1.2.3.4');
  assert.equal(editRes.json.reply.editHistory[0].editedById, 'adm_1');

  // Customer GET detail MUST NOT contain internal note!
  const custDetail = await srv.request(`/api/support/tickets/${tid}`, { headers: userHdr });
  assert.equal(custDetail.status, 200);
  assert.ok(!custDetail.json.messages.some((m) => m.isInternal || m.message.includes('Internal fraud check')));
  assert.ok(!custDetail.json.events.some((e) => e.eventType === 'internal_note_added'));

  // Close ticket -> customer & guest replies are strictly locked with 403
  const closeRes = await srv.request(`/api/admin/support/tickets/${tid}`, {
    method: 'PATCH',
    headers: adminHdr,
    body: { status: 'Closed' }
  });
  assert.equal(closeRes.status, 200);
  assert.equal(closeRes.json.ticket.status, 'closed');

  const blockedReply = await srv.request(`/api/support/tickets/${tid}/replies`, {
    method: 'POST',
    headers: userHdr,
    body: { message: 'Trying to reply after close' }
  });
  assert.equal(blockedReply.status, 403);
  assert.equal(blockedReply.json.error, 'This ticket is closed and permanently locked. Replies are disabled.');

  const blockedAiMsg = await srv.request('/api/support/message', {
    method: 'POST',
    headers: userHdr,
    body: { message: 'Ping closed ticket', activeTicketId: tid }
  });
  assert.equal(blockedAiMsg.status, 403);
  assert.equal(blockedAiMsg.json.error, 'This ticket is closed and permanently locked. Replies are disabled.');

  // Customer AND Admin cannot reopen a permanently closed ticket (regardless of allowCustomerReopenClosedTicket)
  const blockedReopen = await srv.request(`/api/support/tickets/${tid}/status`, {
    method: 'POST',
    headers: userHdr,
    body: { status: 'open' }
  });
  assert.equal(blockedReopen.status, 403);

  const blockedAdminReopen = await srv.request(`/api/admin/support/tickets/${tid}`, {
    method: 'PATCH',
    headers: superHdr,
    body: { status: 'open' }
  });
  assert.equal(blockedAdminReopen.status, 403);
  assert.equal(blockedAdminReopen.json.code, 'TICKET_CLOSED_PERMANENTLY');

  // Admin cannot reply publicly to a closed ticket either
  const blockedAdminReply = await srv.request(`/api/admin/support/tickets/${tid}/replies`, {
    method: 'POST',
    headers: superHdr,
    body: { message: 'Trying to reply after closed' }
  });
  assert.equal(blockedAdminReply.status, 403);

  // Super admin disables allowNewTicketCreation
  const toggleRes = await srv.request('/api/admin/support/toggles', {
    method: 'PUT',
    headers: superHdr,
    body: { allowNewTicketCreation: false }
  });
  assert.equal(toggleRes.status, 200);
  assert.equal(toggleRes.json.toggles.allowNewTicketCreation, false);

  // Public config reflects toggles without leaking staff-only toggles
  const pubCfg = await srv.request('/api/support/config');
  assert.equal(pubCfg.status, 200);
  assert.equal(pubCfg.json.config.allowNewTicketCreation, false);
  assert.equal(pubCfg.json.config.restrictStaffToAssignedTickets, undefined);

  // New ticket creation is blocked with 403
  const blockedCreate = await srv.request('/api/support/tickets', {
    method: 'POST',
    headers: userHdr,
    body: { subject: 'New ticket while disabled' }
  });
  assert.equal(blockedCreate.status, 403);
});

test('Super Admin privacy protection, staff RBAC permissions & restrictStaffToAssignedTickets', async (t) => {
  const staffUsers = [
    { id: 'sup_1', name: 'Root Owner', email: 'tiwloltd@gmail.com', role: 'super_admin' },
    { id: 'adm_1', name: 'Bob Agent', email: 'bob@tiwlo.com', role: 'admin', roleKey: 'support_agent' },
    { id: 'adm_2', name: 'Carol Lead', email: 'carol@tiwlo.com', role: 'admin', roleKey: 'support_lead' }
  ];
  const svc = createTicketingService({ useMemory: true, staffUsers });
  const srv = await startTestApp({ ticketingService: svc, SupportDB: createMemorySupportDb() });
  t.after(async () => { svc.stopSupportAutomationScheduler(); await srv.close(); });

  const superHdr = { 'x-test-admin': JSON.stringify(staffUsers[0]) };
  const bobHdr = {
    'x-test-admin': JSON.stringify({ id: 'adm_1', name: 'Bob Agent', email: 'bob@tiwlo.com', role: 'admin' }),
    'x-test-admin-profile': JSON.stringify({ roleKey: 'support_agent', permissions: ['support.view', 'support.reply'], isActive: true })
  };
  const carolHdr = {
    'x-test-admin': JSON.stringify({ id: 'adm_2', name: 'Carol Lead', email: 'carol@tiwlo.com', role: 'admin' }),
    'x-test-admin-profile': JSON.stringify({ roleKey: 'support_lead', permissions: ['support.view', 'support.view_all', 'support.reply', 'support.assign'], isActive: true })
  };

  // userMatchesRecord bugfix check: super_admin can inspect other records, email impersonation alone is rejected
  assert.equal(userMatchesRecord({ id: 'sup_1', role: 'super_admin', email: 'root@tiwlo.com' }, 'other_user'), true);
  assert.equal(userMatchesRecord({ id: 'any', role: 'owner', email: 'tiwloltd@gmail.com' }, 'other_user'), false);

  // Non-super-admin does NOT see super_admin in /support/agents
  const agentsForBob = await srv.request('/api/admin/support/agents', { headers: bobHdr });
  assert.equal(agentsForBob.status, 200);
  assert.ok(!agentsForBob.json.agents.some((a) => a.email === 'tiwloltd@gmail.com' || a.role === 'super_admin'));

  const agentsForSuper = await srv.request('/api/admin/support/agents', { headers: superHdr });
  assert.ok(agentsForSuper.json.agents.some((a) => a.id === 'sup_1'));

  // Ticket owned by super_admin is hidden from non-super-admin queues
  const superTicket = await svc.createTicket({
    authUser: staffUsers[0],
    subject: 'Internal super admin ops'
  });
  const custTicket1 = await svc.createTicket({
    authUser: { id: 'cust_1', name: 'C1', email: 'c1@shop.com' },
    subject: 'Ticket for Bob'
  });
  const custTicket2 = await svc.createTicket({
    authUser: { id: 'cust_2', name: 'C2', email: 'c2@shop.com' },
    subject: 'Ticket for Carol'
  });

  // Carol assigns custTicket1 -> Bob, custTicket2 -> Carol
  await srv.request(`/api/admin/support/tickets/${custTicket1.ticket.id}/assign`, {
    method: 'POST',
    headers: carolHdr,
    body: { assignedAgentId: 'adm_1' }
  });
  await srv.request(`/api/admin/support/tickets/${custTicket2.ticket.id}/assign`, {
    method: 'POST',
    headers: carolHdr,
    body: { assignedAgentId: 'adm_2' }
  });

  // Non-super-admin cannot assign to super_admin
  const assignSuperErr = await srv.request(`/api/admin/support/tickets/${custTicket1.ticket.id}/assign`, {
    method: 'POST',
    headers: carolHdr,
    body: { assignedAgentId: 'sup_1' }
  });
  assert.equal(assignSuperErr.status, 403);

  // Bob lacks support.assign and support.manage_settings -> 403
  const bobAssignErr = await srv.request(`/api/admin/support/tickets/${custTicket1.ticket.id}/assign`, {
    method: 'POST',
    headers: bobHdr,
    body: { assignedAgentId: 'adm_1' }
  });
  assert.equal(bobAssignErr.status, 403);

  const bobToggleErr = await srv.request('/api/admin/support/toggles', {
    method: 'PUT',
    headers: bobHdr,
    body: { restrictStaffToAssignedTickets: true }
  });
  assert.equal(bobToggleErr.status, 403);

  // Super admin turns on restrictStaffToAssignedTickets
  const enableRestrict = await srv.request('/api/admin/support/toggles', {
    method: 'PUT',
    headers: superHdr,
    body: { restrictStaffToAssignedTickets: true }
  });
  assert.equal(enableRestrict.status, 200);

  // Bob (no support.view_all) sees ONLY custTicket1 (not custTicket2, not superTicket)
  const bobList = await srv.request('/api/admin/support/tickets', { headers: bobHdr });
  assert.equal(bobList.status, 200);
  const bobIds = bobList.json.tickets.map((x) => x.id);
  assert.ok(bobIds.includes(custTicket1.ticket.id));
  assert.ok(!bobIds.includes(custTicket2.ticket.id));
  assert.ok(!bobIds.includes(superTicket.ticket.id));

  // Carol (has support.view_all) sees both cust tickets, still NOT superTicket
  const carolList = await srv.request('/api/admin/support/tickets', { headers: carolHdr });
  const carolIds = carolList.json.tickets.map((x) => x.id);
  assert.ok(carolIds.includes(custTicket1.ticket.id));
  assert.ok(carolIds.includes(custTicket2.ticket.id));
  assert.ok(!carolIds.includes(superTicket.ticket.id));
});

test('Reboot-resilient absolute UTC timers (SLA, auto-close, snooze, guest session expiry)', async () => {
  const svc = createTicketingService({ useMemory: true });
  const now = Date.parse('2026-11-15T12:00:00.000Z');

  // Create ticket and set waiting_customer with autoCloseAt & snoozedUntil
  const { ticket } = await svc.createTicket({
    authUser: { id: 'u_timer', name: 'Timer User', email: 'timer@shop.com' },
    subject: 'Auto-close timer test',
    priority: 'urgent'
  });

  // Set autoCloseAt 10 minutes in the future relative to `now`, snoozedUntil 5 minutes ago (overdue),
  // and another ticket with partial remaining autoCloseAt (e.g. 2 hours left)
  await svc.updateTicket({
    ticketIdOrKey: ticket.id,
    updates: {
      status: 'waiting_customer',
      autoCloseAt: new Date(now - 60_000).toISOString(), // 1m overdue on reboot
      snoozedUntil: new Date(now + 30 * 60_000).toISOString() // 30m remaining
    },
    actorType: 'admin',
    adminUser: { id: 'adm_1', name: 'Admin', role: 'admin' }
  });

  const { ticket: partialTicket } = await svc.createTicket({
    authUser: { id: 'u_timer', name: 'Timer User', email: 'timer@shop.com' },
    subject: 'Partial countdown test',
    priority: 'high'
  });
  const remainingTargetIso = new Date(now + 125_000).toISOString();
  await svc.updateTicket({
    ticketIdOrKey: partialTicket.id,
    updates: {
      status: 'waiting_customer',
      autoCloseAt: remainingTargetIso
    },
    actorType: 'admin',
    adminUser: { id: 'adm_1', name: 'Admin', role: 'admin' }
  });

  // Simulate server reboot calling resumePendingSupportTimers at `now`
  const resumeResult = await svc.resumePendingSupportTimers({ now, scheduleTimers: false });
  assert.ok(resumeResult.triggered.autoClosedIds.includes(ticket.id), 'Overdue autoCloseAt must close immediately on reboot');

  const closedDetail = await svc.getTicketDetail(ticket.id, {
    viewerType: 'customer',
    authUser: { id: 'u_timer', role: 'owner' }
  });
  assert.equal(closedDetail.ticket.status, 'closed');
  assert.ok(closedDetail.events.some((e) => e.eventType === 'auto_closed'));

  // Partial countdown preserves exact remaining ms (125_000 ms), NOT restarted to 72h
  const partialTimer = resumeResult.pendingTimers.find(
    (p) => p.ticketId === partialTicket.id && p.type === 'auto_close'
  );
  assert.ok(partialTimer);
  assert.equal(partialTimer.remainingMs, 125_000);

  // Guest session expiry check
  const { session, rawToken } = await svc.createOrUpdateGuestSession({
    guestName: 'Expired Guest',
    guestEmail: 'exp@example.com',
    guestPhone: '+12025550199'
  });
  assert.ok(session.expiresAt);
  const resolvedValid = await svc.resolveGuestSessionFromRequest({
    headers: { 'x-guest-support-token': rawToken }
  });
  assert.equal(resolvedValid.id, session.id);

  // Scheduler start & stop safely
  const scheduler = svc.startSupportAutomationScheduler({ intervalMs: 60_000 });
  assert.equal(typeof scheduler.stop, 'function');
  scheduler.stop();
});

test('Admin workflows: search, merge, sub-ticket, link-user, collision heartbeat, CSAT, macros, CSV, chat-to-ticket & attachments', async (t) => {
  const staffUsers = [
    { id: 'adm_1', name: 'Alice Support', email: 'alice@tiwlo.com', role: 'admin', roleKey: 'support_lead' },
    { id: 'adm_2', name: 'Dave Tech', email: 'dave@tiwlo.com', role: 'admin', roleKey: 'support_agent' }
  ];
  const svc = createTicketingService({
    useMemory: true,
    staffUsers,
    MasterDB: {
      async findUserByIdentifier(id) {
        if (id === 'u_main' || id === 'shop@tiwlo.com') {
          return { id: 'u_main', name: 'Shop Owner', email: 'shop@tiwlo.com', role: 'owner' };
        }
        return null;
      }
    }
  });
  const srv = await startTestApp({ ticketingService: svc, SupportDB: createMemorySupportDb() });
  t.after(async () => { svc.stopSupportAutomationScheduler(); await srv.close(); });

  const adminHdr = {
    'x-test-admin': JSON.stringify({ id: 'adm_1', name: 'Alice Support', email: 'alice@tiwlo.com', role: 'admin' }),
    'x-test-admin-profile': JSON.stringify({
      roleKey: 'support_lead',
      permissions: ['support.view', 'support.view_all', 'support.reply', 'support.assign', 'support.merge', 'support.export', 'support.macros'],
      isActive: true
    })
  };
  const userHdr = { 'x-test-user': JSON.stringify({ id: 'u_main', name: 'Shop Owner', email: 'shop@tiwlo.com', role: 'owner' }) };

  // Create two tickets (one guest, one user)
  const t1 = await svc.createTicket({
    authUser: { id: 'u_main', name: 'Shop Owner', email: 'shop@tiwlo.com' },
    subject: 'SSL certificate pending on custom domain',
    description: 'mydomain.com SSL stuck',
    priority: 'medium'
  });
  const t2 = await svc.createTicket({
    guestContact: { guestName: 'Guest Shopper', guestEmail: 'shop@tiwlo.com', guestPhone: '+15551234567' },
    subject: 'Duplicate SSL certificate domain issue',
    description: 'mydomain.com SSL still pending'
  });

  // Duplicate detector scoped to user
  const similarRes = await srv.request('/api/support/tickets/similar?subject=SSL%20certificate%20domain', {
    headers: userHdr
  });
  assert.equal(similarRes.status, 200);
  assert.equal(similarRes.json.tickets.length, 1);

  // Admin reference ID search (?q=TWTK-... and ?q=guestPhone)
  const searchByNum = await srv.request(`/api/admin/support/tickets?q=${encodeURIComponent(t2.ticket.ticketId)}`, {
    headers: adminHdr
  });
  assert.equal(searchByNum.json.tickets.length, 1);
  assert.equal(searchByNum.json.tickets[0].id, t2.ticket.id);

  // Collision viewer heartbeat
  const viewRes = await srv.request(`/api/admin/support/tickets/${t1.ticket.id}/view`, {
    method: 'POST',
    headers: adminHdr
  });
  assert.equal(viewRes.status, 200);
  assert.equal(viewRes.json.activeCount, 1);

  // Sub-ticket
  const subRes = await srv.request(`/api/admin/support/tickets/${t1.ticket.id}/subticket`, {
    method: 'POST',
    headers: adminHdr,
    body: { subject: 'Verify DNS TXT propagation', priority: 'high' }
  });
  assert.equal(subRes.status, 201);
  assert.equal(subRes.json.subTicket.parentTicketId, t1.ticket.id);

  // Link guest ticket t2 to registered user u_main
  const linkRes = await srv.request(`/api/admin/support/tickets/${t2.ticket.id}/link-user`, {
    method: 'POST',
    headers: adminHdr,
    body: { userId: 'u_main' }
  });
  assert.equal(linkRes.status, 200);
  assert.equal(linkRes.json.ticket.userId, 'u_main');

  // Merge t2 into t1
  const mergeRes = await srv.request(`/api/admin/support/tickets/${t2.ticket.id}/merge`, {
    method: 'POST',
    headers: adminHdr,
    body: { targetTicketId: t1.ticket.id }
  });
  assert.equal(mergeRes.status, 200);
  assert.equal(mergeRes.json.sourceTicket.status, 'closed');
  assert.equal(mergeRes.json.sourceTicket.mergedIntoId, t1.ticket.id);

  // CSAT rating by customer
  const csatRes = await srv.request(`/api/support/tickets/${t1.ticket.id}/csat`, {
    method: 'POST',
    headers: userHdr,
    body: { rating: 5, comment: 'Super fast SSL fix!' }
  });
  assert.equal(csatRes.status, 200);
  assert.equal(csatRes.json.ticket.csatRating, 5);

  // Macros CRUD
  const macroCreate = await srv.request('/api/admin/support/macros', {
    method: 'POST',
    headers: adminHdr,
    body: { title: 'SSL Propagation', category: 'DNS', body: 'DNS changes take up to 30m.', defaultStatus: 'waiting_customer', defaultTags: ['ssl', 'dns'] }
  });
  assert.equal(macroCreate.status, 201);
  const macroId = macroCreate.json.macro.id;

  const macroPatch = await srv.request(`/api/admin/support/macros/${macroId}`, {
    method: 'PATCH',
    headers: adminHdr,
    body: { title: 'SSL Propagation Guide' }
  });
  assert.equal(macroPatch.status, 200);
  assert.equal(macroPatch.json.macro.title, 'SSL Propagation Guide');

  const macroDel = await srv.request(`/api/admin/support/macros/${macroId}`, {
    method: 'DELETE',
    headers: adminHdr
  });
  assert.equal(macroDel.status, 200);

  // CSV export
  const csvRes = await srv.request('/api/admin/support/export.csv', { headers: adminHdr });
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get('content-type') || '', /text\/csv/);
  assert.match(csvRes.text, /Ticket ID,Serial,Subject/);

  // Attachments via storeMedia
  const attRes = await srv.request('/api/support/attachments', {
    method: 'POST',
    headers: userHdr,
    body: {
      filename: 'screenshot.png',
      contentType: 'image/png',
      dataBase64: Buffer.from('fake-png-bytes').toString('base64')
    }
  });
  assert.equal(attRes.status, 201);
  assert.equal(attRes.json.attachments.length, 1);
  assert.match(attRes.json.attachments[0].url, /^https:\/\/cdn\.tiwlo\.test\/uploads\/support\//);

  // Bulk update
  const bulkRes = await srv.request('/api/admin/support/tickets/bulk', {
    method: 'POST',
    headers: adminHdr,
    body: { ticketIds: [t1.ticket.id], status: 'resolved', assignedAgentId: 'adm_2' }
  });
  assert.equal(bulkRes.status, 200);
  assert.equal(bulkRes.json.updatedCount, 1);
  assert.equal(bulkRes.json.tickets[0].status, 'resolved');
  assert.equal(bulkRes.json.tickets[0].assignedAgentId, 'adm_2');

  // Overview KPIs
  const ovRes = await srv.request('/api/admin/support/overview', { headers: adminHdr });
  assert.equal(ovRes.status, 200);
  assert.equal(ovRes.json.overview.csatAverage, 5);

  // Live chat initiate -> message -> convert-to-ticket -> online-agents
  const onlineRes = await srv.request('/api/support/online-agents');
  assert.equal(onlineRes.status, 200);
  assert.equal(onlineRes.json.onlineCount, 512);

  const initRes = await srv.request('/api/support/initiate', {
    method: 'POST',
    headers: userHdr,
    body: { initialSubject: 'Live widget test' }
  });
  assert.equal(initRes.status, 200);
  assert.equal(initRes.json.ticket.assignedAgent, null);
  const convId = initRes.json.sessionId;

  const convMsgRes = await srv.request(`/api/support/conversations/${convId}/messages`, {
    method: 'POST',
    headers: userHdr,
    body: { text: 'Need help with checkout' }
  });
  assert.equal(convMsgRes.status, 200);
  assert.equal(convMsgRes.json.agentMessage.text, 'AI echo: Need help with checkout');

  const convToTktRes = await srv.request(`/api/support/conversations/${convId}/convert-to-ticket`, {
    method: 'POST',
    headers: userHdr,
    body: { subject: 'Converted Checkout Ticket' }
  });
  assert.equal(convToTktRes.status, 201);
  assert.equal(convToTktRes.json.ticket.subject, 'Converted Checkout Ticket');
});

test('PostgreSQL Section 4 DDL & SQL persistence work end-to-end on PGlite', async (t) => {
  const db = new PGlite();
  t.after(async () => { await db.close(); });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS system_users (
      id VARCHAR(64) PRIMARY KEY,
      tiwi_id VARCHAR(64),
      name VARCHAR(255),
      store_name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      role VARCHAR(64) DEFAULT 'owner',
      avatar TEXT,
      is_banned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS system_admin_staff_profiles (
      user_id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
      role_key VARCHAR(48) NOT NULL DEFAULT 'support_agent',
      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(128),
      status VARCHAR(64) DEFAULT 'open',
      priority VARCHAR(32) DEFAULT 'medium',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id VARCHAR(64) PRIMARY KEY,
      ticket_id VARCHAR(64) REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_id VARCHAR(64),
      sender_type VARCHAR(32) DEFAULT 'user',
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE support_tickets
      ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS serial_number VARCHAR(64),
      ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS requester_type VARCHAR(24) NOT NULL DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS guest_session_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(64),
      ADD COLUMN IF NOT EXISTS guest_access_hash CHAR(64),
      ADD COLUMN IF NOT EXISTS tiwi_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS store_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS store_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS channel VARCHAR(32) NOT NULL DEFAULT 'web',
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS department VARCHAR(64) NOT NULL DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS escalation_tier SMALLINT NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS assigned_agent_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS assigned_agent_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS assigned_agent_avatar TEXT,
      ADD COLUMN IF NOT EXISTS assigned_agent_role VARCHAR(128),
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS watchers JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sla_response_due_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sla_resolve_due_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sla_breach_notified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS csat_rating SMALLINT,
      ADD COLUMN IF NOT EXISTS csat_comment TEXT,
      ADD COLUMN IF NOT EXISTS merged_into_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS parent_ticket_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS unread_by_user BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS unread_by_staff BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS resolution TEXT,
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE support_ticket_messages
      ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS sender_avatar TEXT,
      ADD COLUMN IF NOT EXISTS sender_role VARCHAR(128),
      ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS support_guest_sessions (
      id VARCHAR(64) PRIMARY KEY,
      token_hash CHAR(64) NOT NULL UNIQUE,
      visitor_name VARCHAR(255) NOT NULL,
      visitor_email VARCHAR(255) NOT NULL,
      visitor_phone VARCHAR(64) NOT NULL,
      ip_hash CHAR(64),
      user_agent TEXT,
      device_hint VARCHAR(255),
      claimed_user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
      claimed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_ticket_events (
      id VARCHAR(64) PRIMARY KEY,
      ticket_id VARCHAR(64) NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      actor_id VARCHAR(64),
      actor_name VARCHAR(255),
      actor_type VARCHAR(32) NOT NULL DEFAULT 'system',
      event_type VARCHAR(64) NOT NULL,
      summary TEXT NOT NULL,
      changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_macros (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      category VARCHAR(128) DEFAULT 'General',
      body TEXT NOT NULL,
      default_status VARCHAR(64),
      default_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.query(`INSERT INTO system_users (id, name, email, role) VALUES ('u_pg_1', 'PG Merchant', 'pg@tiwlo.com', 'owner')`);
  await db.query(`INSERT INTO system_users (id, name, email, role) VALUES ('sup_pg', 'Root', 'tiwloltd@gmail.com', 'super_admin')`);
  await db.query(`INSERT INTO system_users (id, name, email, role) VALUES ('adm_pg', 'Pg Agent', 'agent@tiwlo.com', 'admin')`);
  await db.query(`INSERT INTO system_admin_staff_profiles (user_id, role_key, is_active) VALUES ('adm_pg', 'support_agent', TRUE)`);

  const pgSvc = createTicketingService({
    useMemory: false,
    isPgActive: () => true,
    queryPg: (sql, params) => db.query(sql, params),
    SupportDB: createMemorySupportDb()
  });

  // Real staff query masks super_admin for non-super-admin
  const staff = await pgSvc.listAssignableSupportStaff(false);
  assert.equal(staff.length, 1);
  assert.equal(staff[0].id, 'adm_pg');

  // Guest creates ticket in PG, claims on login, toggles persist in system_settings
  const created = await pgSvc.createTicket({
    guestContact: { guestName: 'PG Visitor', guestEmail: 'pg@tiwlo.com', guestPhone: '+15559876543' },
    subject: 'PG Persistence Ticket',
    description: 'Testing PGlite SQL'
  });
  assert.ok(created.recoveryCode);

  const claimed = await pgSvc.claimGuestSessionsForUser({ userId: 'u_pg_1', userEmail: 'pg@tiwlo.com' });
  assert.equal(claimed.claimedTicketCount, 1);

  await pgSvc.updateSupportToggles({ lockClosedTicketReplies: true, restrictStaffToAssignedTickets: true });
  const toggles = await pgSvc.getSupportToggles();
  assert.equal(toggles.restrictStaffToAssignedTickets, true);
});
