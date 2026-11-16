import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveChatQueueService } from './liveChatQueueService.js';

function createMockPgHarness() {
  const store = {
    chats: new Map(),
    messages: [],
    presence: new Map(),
    samples: [],
    templates: new Map(),
    forensicLogs: [],
    csat: new Map()
  };

  async function queryPg(sql, params = []) {
    const q = String(sql).replace(/\s+/g, ' ').trim();
    if (/^CREATE TABLE|^CREATE INDEX|^ALTER TABLE/i.test(q)) {
      return { rows: [], rowCount: 0 };
    }
    if (/^INSERT INTO support_live_chat_templates/i.test(q)) {
      const [id, title, category, shortcut, body, createdBy] = params;
      if (!store.templates.has(id) || /ON CONFLICT \(id\) DO UPDATE/i.test(q)) {
        store.templates.set(id, {
          id,
          title,
          category,
          shortcut,
          body,
          created_by: createdBy || 'system',
          is_system: createdBy === 'system',
          updated_at: new Date().toISOString()
        });
      }
      return { rows: [store.templates.get(id)], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_live_chat_templates/i.test(q)) {
      return { rows: Array.from(store.templates.values()), rowCount: store.templates.size };
    }
    if (/^DELETE FROM support_live_chat_templates/i.test(q)) {
      const deleted = store.templates.delete(params[0]);
      return { rows: [], rowCount: deleted ? 1 : 0 };
    }
    if (/^INSERT INTO support_live_chat_requests/i.test(q)) {
      const [
        id, chatNumber, requesterType, userId, guestSessionId,
        guestName, guestEmail, guestPhone, ipHash, devHash, hintsJson,
        topic, department, nowIso
      ] = params;
      store.chats.set(id, {
        id,
        chat_number: chatNumber,
        status: 'waiting',
        requester_type: requesterType,
        user_id: userId,
        guest_session_id: guestSessionId,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        requester_ip_hash: ipHash,
        requester_device_hash: devHash,
        requester_network_hints: JSON.parse(hintsJson || '[]'),
        co_browsing_state: {},
        topic,
        department,
        assigned_agent_id: null,
        assigned_agent_name: null,
        assigned_agent_role: null,
        joined_at: nowIso,
        accepted_at: null,
        held_at: null,
        closed_at: null,
        awaiting_customer_since: nowIso,
        first_response_ms: null,
        queue_wait_ms: null,
        customer_messages_count: 0,
        staff_messages_count: 0,
        collusion_score: 0,
        collusion_flags: [],
        sentiment_label: 'neutral',
        sentiment_score: 0,
        converted_ticket_id: null,
        converted_ticket_number: null,
        last_message_at: nowIso,
        updated_at: nowIso
      });
      return { rows: [store.chats.get(id)], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_live_chat_requests WHERE id = \$1 OR chat_number = \$1/i.test(q)) {
      const key = String(params[0]);
      const found = Array.from(store.chats.values()).find((r) => r.id === key || r.chat_number === key);
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }
    if (/^SELECT \* FROM support_live_chat_requests/i.test(q)) {
      return { rows: Array.from(store.chats.values()), rowCount: store.chats.size };
    }
    if (/^UPDATE support_live_chat_requests/i.test(q)) {
      const id = params[0];
      const row = store.chats.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      if (/SET status = 'active'/.test(q)) {
        row.status = 'active';
        row.assigned_agent_id = params[1];
        row.assigned_agent_name = params[2];
        row.assigned_agent_role = params[3];
        row.accepted_at = row.accepted_at || params[4];
        row.queue_wait_ms = row.queue_wait_ms ?? params[5];
        row.collusion_score = params[6];
        row.collusion_flags = JSON.parse(params[7] || '[]');
        row.updated_at = params[4];
      } else if (/SET status = 'on_hold'/.test(q)) {
        row.status = 'on_hold';
        row.held_at = params[1];
        row.co_browsing_state = JSON.parse(params[2] || '{}');
        row.updated_at = params[1];
      } else if (/SET status = 'closed'/.test(q)) {
        row.status = 'closed';
        row.closed_at = params[1];
        row.awaiting_customer_since = null;
        row.sentiment_label = params[2];
        row.sentiment_score = params[3];
        row.collusion_score = params[4];
        row.collusion_flags = JSON.parse(params[5] || '[]');
        row.co_browsing_state = JSON.parse(params[6] || '{}');
        row.updated_at = params[1];
      } else if (/SET co_browsing_state =/.test(q)) {
        row.co_browsing_state = JSON.parse(params[1] || '{}');
        row.updated_at = params[2];
      } else if (/SET staff_messages_count =/.test(q)) {
        row.staff_messages_count += 1;
        row.awaiting_customer_since = null;
        row.first_response_ms = row.first_response_ms ?? params[2];
        row.last_message_at = params[1];
        row.updated_at = params[1];
      } else if (/SET customer_messages_count =/.test(q)) {
        row.customer_messages_count += 1;
        row.awaiting_customer_since = row.awaiting_customer_since || params[1];
        row.sentiment_label = params[2];
        row.sentiment_score = params[3];
        row.last_message_at = params[1];
        row.updated_at = params[1];
      }
      return { rows: [row], rowCount: 1 };
    }
    if (/^INSERT INTO support_live_chat_messages/i.test(q)) {
      const [id, chatId, senderType, senderId, senderName, body, createdAt] = params;
      store.messages.push({ id, chat_id: chatId, sender_type: senderType, sender_id: senderId, sender_name: senderName, body, created_at: createdAt });
      return { rows: [], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_live_chat_messages/i.test(q)) {
      const rows = store.messages.filter((m) => m.chat_id === params[0]);
      return { rows, rowCount: rows.length };
    }
    if (/^INSERT INTO support_agent_presence/i.test(q)) {
      const [agentId, agentName, agentRole, isOnline, ipHash, devHash, nowIso] = params;
      store.presence.set(agentId, {
        agent_id: agentId,
        agent_name: agentName,
        agent_role: agentRole,
        is_online: isOnline,
        last_ip_hash: ipHash,
        last_device_hash: devHash,
        last_heartbeat_at: nowIso
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_agent_presence/i.test(q)) {
      let rows = Array.from(store.presence.values());
      if (/is_online = TRUE/i.test(q)) rows = rows.filter((p) => p.is_online);
      return { rows, rowCount: rows.length };
    }
    if (/^INSERT INTO support_staff_response_samples/i.test(q)) {
      const [id, staffId, staffName, chatId, sampleType, responseMs, isFlagged, reason, respondedAt] = params;
      store.samples.push({
        id, staff_id: staffId, staff_name: staffName, chat_id: chatId,
        sample_type: sampleType, response_ms: responseMs, is_flagged: isFlagged,
        exclusion_reason: reason, responded_at: respondedAt
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^UPDATE support_staff_response_samples/i.test(q)) {
      for (const s of store.samples) {
        if (s.chat_id === params[0]) {
          s.is_flagged = true;
          s.exclusion_reason = s.exclusion_reason || params[1];
        }
      }
      return { rows: [], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_staff_response_samples/i.test(q)) {
      return { rows: [...store.samples], rowCount: store.samples.length };
    }
    if (/^INSERT INTO support_staff_forensic_logs/i.test(q)) {
      const [id, staffId, staffName, chatId, chatNumber, severity, score, signalsJson, evidenceJson, detectedAt] = params;
      store.forensicLogs.push({
        id, staff_id: staffId, staff_name: staffName, chat_id: chatId, chat_number: chatNumber,
        severity, collusion_score: score, signals: JSON.parse(signalsJson || '[]'),
        evidence: JSON.parse(evidenceJson || '{}'), detected_at: detectedAt
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_staff_forensic_logs/i.test(q)) {
      return { rows: [...store.forensicLogs], rowCount: store.forensicLogs.length };
    }
    if (/^INSERT INTO support_csat_surveys/i.test(q)) {
      const [id, targetType, targetId, rating, tagsJson, comment, staffId, staffName, requesterId, createdAt] = params;
      store.csat.set(`${targetType}:${targetId}`, {
        id, target_type: targetType, target_id: targetId, rating,
        tags: JSON.parse(tagsJson || '[]'), comment, staff_id: staffId,
        staff_name: staffName, requester_id: requesterId, created_at: createdAt
      });
      return { rows: [], rowCount: 1 };
    }
    if (/^SELECT \* FROM support_csat_surveys/i.test(q)) {
      const rows = Array.from(store.csat.values());
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  return { queryPg, store };
}

function fakeReq({ ip = '10.0.0.10', ua = 'Chrome/130', headers = {} } = {}) {
  return {
    ip,
    headers: { 'user-agent': ua, ...headers },
    get(k) {
      return this.headers[String(k).toLowerCase()];
    }
  };
}

test('Live Chat Queue: serial numbers #1/#2, online agent counts, and strict active session isolation', async () => {
  const svc = createLiveChatQueueService({
    useMemory: true,
    getChatSettingsFn: async () => ({ liveChatWidgetEnabled: true, aiAutoReplyEnabled: false })
  });

  const agentA = { id: 'staff_a', name: 'Alice Agent', email: 'alice@tiwlo.com', role: 'admin' };
  const agentB = { id: 'staff_b', name: 'Bob Agent', email: 'bob@tiwlo.com', role: 'admin' };
  const superAdmin = { id: 'sa_1', name: 'Founder', email: 'tiwloltd@gmail.com', role: 'super_admin' };

  await svc.heartbeatAgentPresence(agentA, { isOnline: true, req: fakeReq({ ip: '198.51.100.1' }), nowMs: 1_000_000 });
  await svc.heartbeatAgentPresence(agentB, { isOnline: true, req: fakeReq({ ip: '198.51.100.2' }), nowMs: 1_000_000 });

  const cust1 = await svc.requestLiveChat({
    authUser: { id: 'usr_1', name: 'Cust One', email: 'c1@example.com' },
    topic: 'Checkout Issue',
    initialMessage: 'Need help',
    req: fakeReq({ ip: '203.0.113.10', ua: 'Safari' }),
    nowMs: 1_001_000
  });
  const cust2 = await svc.requestLiveChat({
    authUser: { id: 'usr_2', name: 'Cust Two', email: 'c2@example.com' },
    topic: 'Domain Help',
    initialMessage: 'DNS error',
    req: fakeReq({ ip: '203.0.113.20', ua: 'Firefox' }),
    nowMs: 1_002_000
  });

  assert.equal(cust1.queue.queuePosition, 1);
  assert.equal(cust2.queue.queuePosition, 2);
  assert.equal(cust1.queue.onlineAgentsCount, 2);
  assert.equal(cust1.queue.freeAgentsCount, 2);
  // Queue notice when AI auto-reply is OFF
  assert.ok(cust1.messages.some((m) => m.body.includes('transferred to our human support queue')));
  // Masking: customer must never see IP hashes or collusion fields
  assert.equal(cust1.chat.requesterIpHash, undefined);
  assert.equal(cust1.chat.collusionFlags, undefined);

  // Agent A accepts chat #1
  await svc.acceptLiveChatRequest(cust1.chat.id, agentA, { req: fakeReq({ ip: '198.51.100.1', ua: 'AdminBrowserA' }), nowMs: 1_010_000 });

  // Strict Active Isolation: Agent B CANNOT list or inspect Agent A's active chat!
  const listB = await svc.listAdminLiveChats({ staffActor: agentB, status: 'all' });
  assert.equal(listB.chats.some((c) => c.id === cust1.chat.id), false);
  await assert.rejects(
    () => svc.getAdminLiveChatDetail(cust1.chat.id, agentB),
    (err) => err.code === 'CHAT_ISOLATED_ACTIVE' && err.statusCode === 403
  );

  // Super Admin CAN see Agent A's active chat & role
  const detailSA = await svc.getAdminLiveChatDetail(cust1.chat.id, superAdmin);
  assert.equal(detailSA.chat.id, cust1.chat.id);
  assert.equal(detailSA.chat.assignedAgentRole, 'admin');

  // Once Agent A puts chat on HOLD, Agent B can view it cleanly (with internal role masked!)
  await svc.holdLiveChatSession(cust1.chat.id, { staffActor: agentA, reason: 'Checking logs', nowMs: 1_020_000 });
  const detailBHeld = await svc.getAdminLiveChatDetail(cust1.chat.id, agentB);
  assert.equal(detailBHeld.chat.status, 'on_hold');
  assert.equal(detailBHeld.chat.assignedAgentRole, null);
});

test('Live Chat blocks banned and high-fraud accounts cleanly', async () => {
  const svc = createLiveChatQueueService({ useMemory: true });
  await assert.rejects(
    () => svc.requestLiveChat({
      authUser: { id: 'banned_u1', email: 'bad@example.com', isBanned: true },
      topic: 'Why banned?'
    }),
    (err) => err.code === 'LIVE_CHAT_BLOCKED_HIGH_FRAUD' && err.statusCode === 403
  );
  await assert.rejects(
    () => svc.requestLiveChat({
      authUser: { id: 'fraud_u2', email: 'risky@example.com', riskScore: 88 },
      topic: 'Urgent help'
    }),
    (err) => err.code === 'LIVE_CHAT_BLOCKED_HIGH_FRAUD' && err.statusCode === 403
  );
});

test('Co-Browsing requires customer opt-in consent and CSAT survey updates agent performance analytics across PG restart', async () => {
  const pg = createMockPgHarness();
  const svc1 = createLiveChatQueueService({
    isPgActive: () => true,
    queryPg: pg.queryPg,
    getChatSettingsFn: async () => ({ liveChatWidgetEnabled: true, aiAutoReplyEnabled: false })
  });

  const agent = { id: 'staff_pro', name: 'Pro Specialist', email: 'pro@tiwlo.com', role: 'admin' };
  const customer = { id: 'cust_cb', name: 'Merchant One', email: 'm1@example.com' };

  const started = await svc1.requestLiveChat({
    authUser: customer,
    topic: 'Billing Settings',
    initialMessage: 'Need screen help',
    req: fakeReq({ ip: '198.51.100.44' }),
    nowMs: 2_000_000
  });
  await svc1.acceptLiveChatRequest(started.chat.id, agent, {
    req: fakeReq({ ip: '198.51.100.99', ua: 'StaffChrome' }),
    nowMs: 2_005_000
  });

  // Agent cannot push co-browsing guidance without customer consent
  await assert.rejects(
    () => svc1.updateCoBrowsingState(started.chat.id, {
      actorType: 'staff',
      staffActor: agent,
      highlightSelector: '#billing-btn',
      agentGuidanceNote: 'Click here'
    }),
    (err) => err.code === 'CO_BROWSE_CONSENT_REQUIRED' && err.statusCode === 409
  );

  // Customer enables co-browsing consent & sends safe route/scroll
  const enabledRes = await svc1.updateCoBrowsingState(started.chat.id, {
    actorType: 'customer',
    authUser: customer,
    enabled: true,
    route: '/dashboard/billing',
    scrollPct: 42,
    viewport: '1440x900',
    nowMs: 2_010_000
  });
  assert.equal(enabledRes.coBrowsing.enabled, true);
  assert.equal(enabledRes.coBrowsing.route, '/dashboard/billing');

  // Agent pushes guidance selector cleanly
  const guideRes = await svc1.updateCoBrowsingState(started.chat.id, {
    actorType: 'staff',
    staffActor: agent,
    highlightSelector: '#add-credits-btn',
    agentGuidanceNote: 'Select Add Credits to top up.',
    nowMs: 2_012_000
  });
  assert.equal(guideRes.coBrowsing.highlightSelector, '#add-credits-btn');

  // Agent replies in 15s (fast response)
  await svc1.sendStaffLiveChatReply(started.chat.id, {
    body: 'I highlighted the button for you.',
    staffActor: agent,
    nowMs: 2_015_000
  });

  // Close chat -> co-browsing auto-disabled
  const closedChat = await svc1.endLiveChatSession(started.chat.id, { actor: agent, actorType: 'staff', nowMs: 2_025_000 });
  assert.equal(closedChat.coBrowsingState.enabled, false);

  // Submit 5-star CSAT survey
  await svc1.submitCsatSurvey({
    targetType: 'live_chat',
    targetId: started.chat.id,
    rating: 5,
    tags: ['Fast', 'Helpful'],
    comment: 'Co-browsing fixed it immediately!',
    authUser: customer,
    nowMs: 2_030_000
  });

  // Simulate full server reboot with new service instance reading same PG state!
  const svcAfterReboot = createLiveChatQueueService({
    isPgActive: () => true,
    queryPg: pg.queryPg
  });

  const perf = await svcAfterReboot.getStaffPerformanceMetrics({ nowMs: 2_050_000 });
  const proMetric = perf.staffMetrics.find((m) => m.staffId === 'staff_pro');
  assert.ok(proMetric);
  assert.equal(proMetric.performanceCategory, 'top_performer');
  assert.equal(proMetric.fcrRatePct, 100);
  assert.equal(proMetric.avgCsat, 5);
  assert.equal(proMetric.csatCount, 1);
  assert.equal(proMetric.firstResponseAvgMs, 10_000);
});

test('Anti-Collusion detects same-IP & rapid VPN dual-phone self-chats and quarantines response samples', async () => {
  const pg = createMockPgHarness();
  const svc = createLiveChatQueueService({
    isPgActive: () => true,
    queryPg: pg.queryPg
  });

  const shadyAgent = { id: 'staff_shady', name: 'Shady Staff', email: 'shady@tiwlo.com', role: 'admin' };
  const dummyCust = { id: 'cust_friend', name: 'Second Phone', email: 'alt@example.com' };

  // Test 1: Same IP address
  const c1 = await svc.requestLiveChat({
    authUser: dummyCust,
    topic: 'Quick test',
    initialMessage: 'hi',
    req: fakeReq({ ip: '198.51.100.77', ua: 'MobileSafari' }),
    nowMs: 3_000_000
  });
  await svc.acceptLiveChatRequest(c1.chat.id, shadyAgent, {
    req: fakeReq({ ip: '198.51.100.77', ua: 'DesktopChrome' }),
    nowMs: 3_001_000
  });
  await svc.sendStaffLiveChatReply(c1.chat.id, { body: 'done', staffActor: shadyAgent, nowMs: 3_002_000 });
  await svc.endLiveChatSession(c1.chat.id, { actor: shadyAgent, actorType: 'staff', nowMs: 3_005_000 });

  const perf = await svc.getStaffPerformanceMetrics({ nowMs: 3_010_000 });
  const shadyMetric = perf.staffMetrics.find((m) => m.staffId === 'staff_shady');
  assert.equal(shadyMetric.performanceCategory, 'integrity_risk');
  assert.equal(shadyMetric.flaggedSamplesCount, 1);
  assert.equal(shadyMetric.samplesCount, 0); // Quarantined so it cannot inflate speed score!

  const logs = await svc.listForensicAuditLogs({ limit: 10 });
  assert.ok(logs.some((l) => l.staffId === 'staff_shady' && l.signals.includes('SAME_IP_ADDRESS')));
});

test('Guest requestLiveChat maps visitorName/visitorEmail/visitorPhone and mapMessageRow emits senderType + senderRole', async () => {
  const svc = createLiveChatQueueService({
    useMemory: true,
    getChatSettingsFn: async () => ({ liveChatWidgetEnabled: true, aiAutoReplyEnabled: false })
  });

  const guestSession = {
    id: 'gsess_guest_1',
    visitorName: 'Nadia Visitor',
    visitorEmail: 'nadia@example.com',
    visitorPhone: '+8801711223344'
  };

  const started = await svc.requestLiveChat({
    guestSession,
    topic: 'Shipping Sync',
    initialMessage: 'Hello from guest session',
    req: fakeReq({ ip: '203.0.113.55', ua: 'Safari' }),
    nowMs: 4_000_000
  });

  assert.equal(started.chat.status, 'waiting');
  assert.ok(started.chat.serialNumber);

  // Reusing the same guestSession returns the existing waiting chat with mapped fields intact
  const reused = await svc.requestLiveChat({
    guestSession,
    topic: 'Shipping Sync',
    initialMessage: 'Follow up',
    req: fakeReq({ ip: '203.0.113.55', ua: 'Safari' }),
    nowMs: 4_001_000
  });
  assert.equal(reused.reused, true);
  assert.equal(reused.chat.id, started.chat.id);

  const agent = { id: 'staff_g1', name: 'Grace Agent', email: 'grace@tiwlo.com', role: 'admin' };
  const otherAgent = { id: 'staff_g2', name: 'Other Agent', email: 'other@tiwlo.com', role: 'admin' };

  // Strict Accept-First: waiting chat cannot receive a staff reply before Accept
  await assert.rejects(
    () => svc.sendStaffLiveChatReply(started.chat.id, {
      body: 'Replying before accept should fail',
      staffActor: agent,
      nowMs: 4_001_500
    }),
    (err) => err.code === 'CHAT_ACCEPTANCE_REQUIRED' && err.statusCode === 403
  );

  await svc.acceptLiveChatRequest(started.chat.id, agent, {
    req: fakeReq({ ip: '198.51.100.88', ua: 'Chrome' }),
    nowMs: 4_002_000
  });

  // Strict Exclusive Lock: once accepted by Grace, other staff cannot steal or reply
  await assert.rejects(
    () => svc.sendStaffLiveChatReply(started.chat.id, {
      body: 'Intruding reply',
      staffActor: otherAgent,
      nowMs: 4_002_500
    }),
    (err) => err.code === 'CHAT_ISOLATED_ACTIVE' && err.statusCode === 403
  );

  // Verify admin detail exposes guest contact mapped from visitorName/visitorEmail/visitorPhone
  const adminDetail = await svc.getAdminLiveChatDetail(started.chat.id, agent);
  assert.equal(adminDetail.chat.guestName, 'Nadia Visitor');
  assert.equal(adminDetail.chat.guestEmail, 'nadia@example.com');

  const replyRes = await svc.sendStaffLiveChatReply(started.chat.id, {
    body: 'Hi Nadia, checking your shipping now.',
    staffActor: agent,
    nowMs: 4_003_000
  });

  const visitorMsg = replyRes.messages.find((m) => m.body === 'Hello from guest session');
  const staffMsg = replyRes.messages.find((m) => m.body === 'Hi Nadia, checking your shipping now.');
  const systemMsg = replyRes.messages.find((m) => m.senderType === 'system');

  assert.ok(visitorMsg);
  assert.equal(visitorMsg.senderType, 'customer');
  assert.equal(visitorMsg.senderRole, 'customer');

  assert.ok(staffMsg);
  assert.equal(staffMsg.senderType, 'staff');
  assert.equal(staffMsg.senderRole, 'agent');

  assert.ok(systemMsg);
  assert.equal(systemMsg.senderType, 'system');
  assert.equal(systemMsg.senderRole, 'system');
});
