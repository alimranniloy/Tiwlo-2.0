import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import {
  addAiKey,
  addAiKeys,
  buildApiKeyPreview,
  decryptAiApiKey,
  deleteAiKey,
  encryptAiApiKey,
  ensureAiKeyPoolSchema,
  executeGeminiWithFailover,
  expireKeyCooldowns,
  getChatSystemOverview,
  getChatSystemSettings,
  listAiKeys,
  resetAiKeyPoolRuntimeCachesForTests,
  resetAiKeyQuota,
  resetInMemoryAiKeyPoolForTests,
  setAiKeyPoolPgDriverForTests,
  testGeminiKeyById,
  updateAiKey,
  updateChatSystemSettings
} from './aiKeyPoolService.js';
import { TiwiAI } from './tiwiAi.js';
import { createAdminChatSystemRouter } from '../../administrator/adminChatSystemRoutes.js';

function makeJsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

function makeGeminiSuccess(text) {
  return makeJsonResponse(200, {
    candidates: [
      {
        content: {
          parts: [{ text }]
        }
      }
    ]
  });
}

function extractApiKeyFromUrl(url) {
  const parsed = new URL(url);
  return parsed.searchParams.get('key');
}

function extractModelFromUrl(url) {
  const match = String(url).match(/\/models\/([^:]+):generateContent/);
  return match ? decodeURIComponent(match[1]) : null;
}

test.beforeEach(() => {
  resetInMemoryAiKeyPoolForTests();
});

test.afterEach(() => {
  resetInMemoryAiKeyPoolForTests();
});

test('ensureAiKeyPoolSchema succeeds in memory mode and encrypts/masks API keys securely', async () => {
  const schema = await ensureAiKeyPoolSchema();
  assert.equal(schema.ok, true);
  assert.equal(schema.mode, 'memory');

  const rawSecret = 'AIzaSyDemoSecretKey123456789xYz';
  const encrypted = encryptAiApiKey(rawSecret);
  assert.equal(encrypted.preview, 'AIzaSy...9xYz');
  assert.equal(buildApiKeyPreview(rawSecret), 'AIzaSy...9xYz');

  const decrypted = decryptAiApiKey(encrypted);
  assert.equal(decrypted, rawSecret);

  const tampered = Buffer.from(encrypted.ciphertext);
  tampered[0] ^= 0xff;
  assert.throws(() =>
    decryptAiApiKey({
      ciphertext: tampered,
      iv: encrypted.iv,
      authTag: encrypted.authTag
    })
  );

  const dto = await addAiKey({
    label: 'Primary Gemini Key',
    apiKey: rawSecret,
    priority: 10
  }, 'admin_1');

  assert.equal(dto.keyPreview, 'AIzaSy...9xYz');
  assert.equal(dto.apiKey, undefined);
  assert.equal(dto.key_ciphertext, undefined);
  assert.equal(dto.keyCiphertext, undefined);
  assert.ok(!JSON.stringify(dto).includes(rawSecret));

  const listed = await listAiKeys();
  assert.equal(listed.length, 1);
  assert.ok(!JSON.stringify(listed).includes(rawSecret));
});

test('supports unlimited keys addition, priority ordering, and enable/disable controls', async () => {
  const keys = [];
  for (let i = 1; i <= 15; i++) {
    keys.push({
      label: `Pool Key ${i}`,
      apiKey: `AIzaSyUnlimitedKey_${String(i).padStart(2, '0')}_secret_${i}`,
      priority: 200 - i * 10,
      isEnabled: i !== 14
    });
  }
  const created = await addAiKeys(keys, 'super_admin');
  assert.equal(created.length, 15);

  const all = await listAiKeys({ includeDisabled: true });
  assert.equal(all.length, 15);
  assert.equal(all[0].label, 'Pool Key 15');
  assert.equal(all[0].priority, 50);

  const enabledOnly = await listAiKeys({ includeDisabled: false });
  assert.equal(enabledOnly.length, 14);
  assert.ok(!enabledOnly.some((k) => k.label === 'Pool Key 14'));

  const disabledKey = all.find((k) => k.label === 'Pool Key 14');
  const reEnabled = await updateAiKey(disabledKey.id, { isEnabled: true, priority: 1 });
  assert.equal(reEnabled.isEnabled, true);
  assert.equal(reEnabled.priority, 1);

  const reordered = await listAiKeys({ includeDisabled: false });
  assert.equal(reordered.length, 15);
  assert.equal(reordered[0].id, disabledKey.id);
});

test('automatic failover switches from quota-exhausted Key #1 (429) to Key #2 seamlessly', async () => {
  const key1Secret = 'AIzaSyPrimaryQuotaKey_11111111';
  const key2Secret = 'AIzaSySecondaryHealthyKey_22222';
  const key3Secret = 'AIzaSyTertiaryBackupKey_333333';

  const k1 = await addAiKey({ label: 'Key 1 (Quota Hit)', apiKey: key1Secret, priority: 10 });
  const k2 = await addAiKey({ label: 'Key 2 (Healthy)', apiKey: key2Secret, priority: 20 });
  await addAiKey({ label: 'Key 3 (Backup)', apiKey: key3Secret, priority: 30 });

  const calledKeys = [];
  const mockFetch = async (url) => {
    const usedKey = extractApiKeyFromUrl(url);
    calledKeys.push({ key: usedKey, model: extractModelFromUrl(url) });

    if (usedKey === key1Secret) {
      return makeJsonResponse(429, {
        error: {
          code: 429,
          status: 'RESOURCE_EXHAUSTED',
          message: 'Quota exceeded for quota metric GenerateContentRequests.'
        }
      });
    }
    if (usedKey === key2Secret) {
      return makeGeminiSuccess('Hello from Key 2 after instant failover!');
    }
    return makeGeminiSuccess('Should not reach Key 3');
  };

  const result = await executeGeminiWithFailover({
    payload: {
      contents: [{ role: 'user', parts: [{ text: 'Hello support' }] }]
    },
    fetchFn: mockFetch
  });

  assert.equal(result.text, 'Hello from Key 2 after instant failover!');
  assert.equal(result.usedKeyId, k2.id);
  assert.equal(result.usedKeyLabel, 'Key 2 (Healthy)');
  assert.equal(result.usedModel, 'gemini-3.1-flash-lite-preview');
  assert.equal(result.failoverCount, 1);

  // Key 1 should move immediately into cooldown with quotaHits === 1 (without cycling all models on Key 1)
  assert.equal(calledKeys.filter((c) => c.key === key1Secret).length, 1);
  assert.equal(calledKeys.filter((c) => c.key === key2Secret).length, 1);

  const afterKeys = await listAiKeys();
  const afterK1 = afterKeys.find((k) => k.id === k1.id);
  const afterK2 = afterKeys.find((k) => k.id === k2.id);

  assert.equal(afterK1.status, 'cooldown');
  assert.equal(afterK1.quotaHits, 1);
  assert.equal(afterK1.requestsCount, 1);
  assert.ok(afterK1.cooldownUntil);

  assert.equal(afterK2.status, 'active');
  assert.equal(afterK2.successCount, 1);
  assert.equal(afterK2.requestsCount, 1);

  // Subsequent request skips Key 1 while it is in cooldown and uses Key 2 directly
  const secondRunKeys = [];
  const result2 = await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'Second query' }] }] },
    fetchFn: async (url) => {
      secondRunKeys.push(extractApiKeyFromUrl(url));
      return makeGeminiSuccess('Direct Key 2 reply');
    }
  });
  assert.equal(result2.usedKeyId, k2.id);
  assert.equal(result2.failoverCount, 0);
  assert.deepEqual(secondRunKeys, [key2Secret]);
});

test('marks 401/403 API_KEY_INVALID keys as invalid and rotates to next healthy key', async () => {
  const badKeySecret = 'AIzaSyInvalidRevokedKey_999999';
  const goodKeySecret = 'AIzaSyValidFallbackKey_888888';

  const badKey = await addAiKey({ label: 'Revoked Key', apiKey: badKeySecret, priority: 5 });
  const goodKey = await addAiKey({ label: 'Valid Key', apiKey: goodKeySecret, priority: 15 });

  const result = await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'Ping' }] }] },
    fetchFn: async (url) => {
      const k = extractApiKeyFromUrl(url);
      if (k === badKeySecret) {
        return makeJsonResponse(403, {
          error: {
            code: 403,
            status: 'PERMISSION_DENIED',
            message: 'API_KEY_INVALID: API key not valid. Please pass a valid API key.'
          }
        });
      }
      return makeGeminiSuccess('Recovered via Valid Key');
    }
  });

  assert.equal(result.text, 'Recovered via Valid Key');
  assert.equal(result.usedKeyId, goodKey.id);
  assert.equal(result.failoverCount, 1);

  const keys = await listAiKeys();
  const updatedBad = keys.find((k) => k.id === badKey.id);
  assert.equal(updatedBad.status, 'invalid');
  assert.equal(updatedBad.errorCount, 1);
  assert.ok(updatedBad.lastError.includes('API_KEY_INVALID'));
});

test('cooldown expiry automatically re-enables Key #1 back to active', async () => {
  const key1Secret = 'AIzaSyCooldownRecovery_111111';
  const key2Secret = 'AIzaSyBackupRecovery_2222222';

  const k1 = await addAiKey({ label: 'Key 1', apiKey: key1Secret, priority: 10 });
  await addAiKey({ label: 'Key 2', apiKey: key2Secret, priority: 20 });

  await updateChatSystemSettings({ cooldownMinutes: 1 });

  await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'Trigger cooldown' }] }] },
    fetchFn: async (url) => {
      if (extractApiKeyFromUrl(url) === key1Secret) {
        return makeJsonResponse(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } });
      }
      return makeGeminiSuccess('Key 2 handled it');
    }
  });

  let [first] = await listAiKeys();
  assert.equal(first.id, k1.id);
  assert.equal(first.status, 'cooldown');

  // Simulate clock moving past cooldownUntil (1 minute + 5 seconds)
  const cooldownMs = Date.parse(first.cooldownUntil);
  const expiredCount = await expireKeyCooldowns(cooldownMs + 5000);
  assert.equal(expiredCount, 1);

  [first] = await listAiKeys();
  assert.equal(first.status, 'active');
  assert.equal(first.cooldownUntil, null);

  // Key 1 should now be selected first again (priority 10 < 20)
  const picked = [];
  const nextResult = await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'After cooldown' }] }] },
    fetchFn: async (url) => {
      picked.push(extractApiKeyFromUrl(url));
      return makeGeminiSuccess('Key 1 is back!');
    }
  });
  assert.equal(nextResult.usedKeyId, k1.id);
  assert.deepEqual(picked, [key1Secret]);
});

test('TiwiAI respects manual chat system feature toggles immediately', async () => {
  await updateChatSystemSettings({ aiAutoReplyEnabled: false });
  const autoReplyOff = await TiwiAI.generateSupportReply({
    userMessage: 'Hello, my droplet needs help',
    isLoggedIn: true
  });
  assert.equal(autoReplyOff.aiDisabled, true);
  assert.equal(autoReplyOff.reason, 'AI_AUTO_REPLY_DISABLED');

  await updateChatSystemSettings({ aiAutoReplyEnabled: true, aiAgentAssistEnabled: false });
  const assistOff = await TiwiAI.generateSupportReply({
    userMessage: 'Draft reply for customer',
    mode: 'agent_assist',
    isLoggedIn: true
  });
  assert.equal(assistOff.aiDisabled, true);
  assert.equal(assistOff.reason, 'AI_AGENT_ASSIST_DISABLED');

  await updateChatSystemSettings({ guestChatEnabled: false });
  const guestOff = await TiwiAI.generateSupportReply({
    userMessage: 'Hi as guest',
    isLoggedIn: false
  });
  assert.equal(guestOff.aiDisabled, true);
  assert.equal(guestOff.reason, 'GUEST_CHAT_DISABLED');

  await updateChatSystemSettings({ guestChatEnabled: true, blockChatOnClosedTicket: true });
  const closedTicket = await TiwiAI.generateSupportReply({
    userMessage: 'Can we reopen?',
    ticketStatus: 'closed',
    isLoggedIn: true
  });
  assert.equal(closedTicket.aiDisabled, true);
  assert.equal(closedTicket.reason, 'TICKET_CLOSED');

  await updateChatSystemSettings({ liveChatWidgetEnabled: false });
  const widgetOff = await TiwiAI.generateSupportReply({
    userMessage: 'Hello',
    isLoggedIn: true
  });
  assert.equal(widgetOff.aiDisabled, true);
  assert.equal(widgetOff.reason, 'LIVE_CHAT_WIDGET_DISABLED');
});

test('adminChatSystemRoutes enforces auth/permissions/reauth and supports full CRUD + test + reset-quota', async () => {
  let currentAdminUser = {
    id: 'super_1',
    email: 'tiwloltd@gmail.com',
    role: 'super_admin'
  };
  let currentAdminProfile = null;
  let allowReauth = true;
  const auditEvents = [];

  const requireAdmin = (req, _res, next) => {
    req.adminUser = currentAdminUser;
    req.adminProfile = currentAdminProfile;
    next();
  };
  const requireRecentReauth = (_req, res, next) => {
    if (!allowReauth) {
      return res.status(428).json({ error: 'RECENT_VERIFICATION_REQUIRED' });
    }
    return next();
  };

  const mockFetch = async (url) => {
    const key = extractApiKeyFromUrl(url);
    if (key === 'AIzaSyHttpRouteKeyQuota_11111') {
      return makeJsonResponse(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Rate limited' } });
    }
    return makeGeminiSuccess('OK');
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin',
    createAdminChatSystemRouter({
      requireAdmin,
      requireRecentReauth,
      recordSecurityEvent: async (evt) => {
        auditEvents.push(evt);
      },
      fetchFn: mockFetch
    })
  );

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api/admin`;

  try {
    // 1. GET /chat-system & /chat-system/config
    const getRes = await fetch(`${base}/chat-system/config`);
    assert.equal(getRes.status, 200);
    const getJson = await getRes.json();
    assert.equal(getJson.success, true);
    assert.equal(getJson.config.aiAutoReplyEnabled, true);
    assert.equal(getJson.config.aiTriageEnabled, true);
    assert.equal(getJson.config.aiAgentAssistEnabled, true);
    assert.equal(getJson.config.liveChatWidgetEnabled, true);
    assert.equal(getJson.config.guestChatEnabled, true);
    assert.equal(getJson.config.blockChatOnClosedTicket, true);
    assert.equal(getJson.settings.maxKeysAllowed, null);

    // 2. Staff without support.manage_ai / manage_system_settings cannot modify toggles or keys
    currentAdminUser = { id: 'staff_2', email: 'agent@tiwlo.com', role: 'admin' };
    currentAdminProfile = { userId: 'staff_2', roleKey: 'support_agent', permissions: ['view_stores', 'manage_orders'], isActive: true };

    const deniedConfig = await fetch(`${base}/chat-system/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiAutoReplyEnabled: false })
    });
    assert.equal(deniedConfig.status, 403);

    const deniedAddKey = await fetch(`${base}/chat-system/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Blocked Key', apiKey: 'AIzaSyBlockedStaffKey_0000' })
    });
    assert.equal(deniedAddKey.status, 403);

    // Staff with explicit support.manage_ai permission IS allowed
    currentAdminProfile = { userId: 'staff_2', roleKey: 'support_lead', permissions: ['support.manage_ai'], isActive: true };

    // 3. Reauth check returns 428 when grant missing
    allowReauth = false;
    const reauthBlocked = await fetch(`${base}/chat-system/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cooldownMinutes: 20 })
    });
    assert.equal(reauthBlocked.status, 428);

    // 4. PUT /chat-system/config updates feature switches & records audit event
    allowReauth = true;
    const putCfgRes = await fetch(`${base}/chat-system/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiAutoReplyEnabled: false,
        aiAgentAssistEnabled: false,
        liveChatWidgetEnabled: true,
        blockChatOnClosedTicket: false,
        cooldownMinutes: 25
      })
    });
    assert.equal(putCfgRes.status, 200);
    const putCfgJson = await putCfgRes.json();
    assert.equal(putCfgJson.config.aiAutoReplyEnabled, false);
    assert.equal(putCfgJson.config.aiAgentAssistEnabled, false);
    assert.equal(putCfgJson.config.blockChatOnClosedTicket, false);
    assert.equal(putCfgJson.config.cooldownMinutes, 25);

    const persisted = await getChatSystemSettings();
    assert.equal(persisted.aiAutoReplyEnabled, false);

    // 5. POST /chat-system/keys creates encrypted masked key
    const addRes = await fetch(`${base}/chat-system/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'HTTP Route Key',
        apiKey: 'AIzaSyHttpRouteKeyQuota_11111',
        priority: 15
      })
    });
    assert.equal(addRes.status, 201);
    const addJson = await addRes.json();
    assert.equal(addJson.key.label, 'HTTP Route Key');
    assert.equal(addJson.key.keyPreview, 'AIzaSy...1111');
    assert.ok(!JSON.stringify(addJson).includes('AIzaSyHttpRouteKeyQuota_11111'));

    const keyId = addJson.key.id;

    // 6. POST /chat-system/keys/:id/test detects 429 cooldown
    const testRes = await fetch(`${base}/chat-system/keys/${keyId}/test`, { method: 'POST' });
    assert.equal(testRes.status, 200);
    const testJson = await testRes.json();
    assert.equal(testJson.ok, false);
    assert.equal(testJson.status, 'cooldown');

    // 7. POST /chat-system/keys/:id/reset-quota restores active status
    const resetRes = await fetch(`${base}/chat-system/keys/${keyId}/reset-quota`, { method: 'POST' });
    assert.equal(resetRes.status, 200);
    const resetJson = await resetRes.json();
    assert.equal(resetJson.key.status, 'active');
    assert.equal(resetJson.key.cooldownUntil, null);

    // 8. PATCH /chat-system/keys/:id replaces key & updates metadata
    const patchRes = await fetch(`${base}/chat-system/keys/${keyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'HTTP Route Key Updated',
        apiKey: 'AIzaSyHttpRouteKeyHealthy_222',
        priority: 5,
        modelOverride: 'gemini-3.5-flash'
      })
    });
    assert.equal(patchRes.status, 200);
    const patchJson = await patchRes.json();
    assert.equal(patchJson.key.label, 'HTTP Route Key Updated');
    assert.equal(patchJson.key.keyPreview, 'AIzaSy..._222');
    assert.equal(patchJson.key.priority, 5);
    assert.equal(patchJson.key.modelOverride, 'gemini-3.5-flash');

    // 9. Re-test updated key -> passes live test
    const testOkRes = await fetch(`${base}/chat-system/keys/${keyId}/test`, { method: 'POST' });
    assert.equal(testOkRes.status, 200);
    const testOkJson = await testOkRes.json();
    assert.equal(testOkJson.ok, true);
    assert.equal(testOkJson.status, 'active');
    assert.equal(testOkJson.replyPreview, 'OK');

    // 10. Overview reflects summary
    const overview = await getChatSystemOverview();
    assert.equal(overview.summary.total, 1);
    assert.equal(overview.summary.active, 1);

    // 11. DELETE /chat-system/keys/:id removes key
    const delRes = await fetch(`${base}/chat-system/keys/${keyId}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    const delJson = await delRes.json();
    assert.equal(delJson.deleted, true);
    assert.equal(await deleteAiKey(keyId), false);

    // Ensure audit trail recorded all sensitive operations without raw secrets
    assert.ok(auditEvents.length >= 5);
    assert.ok(!JSON.stringify(auditEvents).includes('AIzaSyHttpRouteKeyQuota_11111'));
    assert.ok(!JSON.stringify(auditEvents).includes('AIzaSyHttpRouteKeyHealthy_222'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('testGeminiKeyById handles non-existent ID cleanly', async () => {
  const res = await testGeminiKeyById('non_existent_key');
  assert.equal(res, null);
  assert.equal(await resetAiKeyQuota('non_existent_key'), null);
});

test('PostgreSQL persistence preserves cooldown_until, quota_reset_at, last_error_at, and usage counters across server reboots', async (t) => {
  const db = new PGlite();
  t.after(async () => {
    setAiKeyPoolPgDriverForTests(null);
    await db.close();
  });

  setAiKeyPoolPgDriverForTests({
    isActive: true,
    query: (sql, params) => (params && params.length ? db.query(sql, params) : db.query(sql))
  });

  const schema = await ensureAiKeyPoolSchema();
  assert.equal(schema.ok, true);
  assert.equal(schema.mode, 'postgres');

  // Idempotent second call
  const schema2 = await ensureAiKeyPoolSchema();
  assert.equal(schema2.cached, true);

  const key1Secret = 'AIzaSyPgRebootKeyOne_1111111';
  const key2Secret = 'AIzaSyPgRebootKeyTwo_2222222';

  const k1 = await addAiKey({ label: 'PG Key 1', apiKey: key1Secret, priority: 10 }, 'admin_pg');
  const k2 = await addAiKey({ label: 'PG Key 2', apiKey: key2Secret, priority: 20 }, 'admin_pg');

  await updateChatSystemSettings({ cooldownMinutes: 10 }, 'admin_pg');

  const res1 = await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'First request' }] }] },
    fetchFn: async (url) => {
      if (extractApiKeyFromUrl(url) === key1Secret) {
        return makeJsonResponse(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota hit' } });
      }
      return makeGeminiSuccess('PG Key 2 served request 1');
    }
  });
  assert.equal(res1.usedKeyId, k2.id);
  assert.equal(res1.failoverCount, 1);

  // Simulate full server shutdown & reboot (wipe all JS memory caches/state)
  resetAiKeyPoolRuntimeCachesForTests();

  const keysAfterReboot = await listAiKeys();
  const pgK1 = keysAfterReboot.find((k) => k.id === k1.id);
  const pgK2 = keysAfterReboot.find((k) => k.id === k2.id);

  assert.equal(pgK1.status, 'cooldown');
  assert.equal(pgK1.quotaHits, 1);
  assert.equal(pgK1.minuteRequestsCount, 1);
  assert.equal(pgK1.dailyRequestsCount, 1);
  assert.ok(pgK1.cooldownUntil);
  assert.ok(pgK1.quotaResetAt);
  assert.ok(pgK1.lastErrorAt);
  assert.ok(pgK1.cooldownRemainingSeconds > 0);

  assert.equal(pgK2.status, 'active');
  assert.equal(pgK2.successCount, 1);
  assert.equal(pgK2.minuteRequestsCount, 1);
  assert.equal(pgK2.dailyRequestsCount, 1);

  // After reboot, Key 1 must STILL be skipped because cooldown_until > NOW() in PostgreSQL
  const postRebootUsed = [];
  const res2 = await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'Post-reboot request' }] }] },
    fetchFn: async (url) => {
      postRebootUsed.push(extractApiKeyFromUrl(url));
      return makeGeminiSuccess('PG Key 2 served post-reboot');
    }
  });
  assert.equal(res2.usedKeyId, k2.id);
  assert.equal(res2.failoverCount, 0);
  assert.deepEqual(postRebootUsed, [key2Secret]);

  // Simulate cooldown_until elapsing in PostgreSQL, then reboot again
  await db.query(
    `UPDATE system_ai_api_keys SET cooldown_until = NOW() - INTERVAL '5 seconds' WHERE id = $1`,
    [k1.id]
  );
  resetAiKeyPoolRuntimeCachesForTests();

  const recoveredUsed = [];
  const res3 = await executeGeminiWithFailover({
    payload: { contents: [{ role: 'user', parts: [{ text: 'After cooldown elapsed' }] }] },
    fetchFn: async (url) => {
      recoveredUsed.push(extractApiKeyFromUrl(url));
      return makeGeminiSuccess('PG Key 1 auto-recovered!');
    }
  });
  assert.equal(res3.usedKeyId, k1.id);
  assert.deepEqual(recoveredUsed, [key1Secret]);

  const finalKeys = await listAiKeys();
  const finalK1 = finalKeys.find((k) => k.id === k1.id);
  const finalK2 = finalKeys.find((k) => k.id === k2.id);
  assert.equal(finalK1.status, 'active');
  assert.equal(finalK1.cooldownUntil, null);
  assert.equal(finalK1.quotaResetAt, null);
  assert.equal(finalK1.successCount, 1);
  assert.equal(finalK1.dailyRequestsCount, 2);
  assert.equal(finalK2.dailyRequestsCount, 2);
});
