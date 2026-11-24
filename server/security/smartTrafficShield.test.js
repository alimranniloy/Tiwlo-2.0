import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import {
  classifyRequestIntent,
  createSmartTrafficShieldMiddleware,
  detectHackingSignature,
  getTrafficShieldStats,
  issueShieldChallenge,
  resetTrafficShieldForTests,
  SHIELD_CLEARANCE_COOKIE,
  verifyShieldChallengeSolution
} from './smartTrafficShield.js';

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('detectHackingSignature & classifyRequestIntent classify probes, public reads, and transactional flows', () => {
  resetTrafficShieldForTests();

  // Authenticated transactional flows
  const txOrder = classifyRequestIntent({
    method: 'POST',
    path: '/api/orders',
    originalUrl: '/api/orders',
    headers: { authorization: 'Bearer valid-session-token-12345' }
  });
  assert.equal(txOrder.intent, 'authenticated_transactional');
  assert.equal(txOrder.isAuthenticated, true);
  assert.equal(txOrder.isTransactional, true);
  assert.equal(txOrder.transactionalDomain, 'orders');

  const txCheckoutCookie = classifyRequestIntent({
    method: 'POST',
    path: '/checkout',
    originalUrl: '/checkout',
    headers: { cookie: 'tiwlo_host_session=sess_abc123456' }
  });
  assert.equal(txCheckoutCookie.intent, 'authenticated_transactional');
  assert.equal(txCheckoutCookie.transactionalDomain, 'checkout');

  for (const [method, path, domain] of [
    ['POST', '/cloud/droplets', 'cloud_droplets'],
    ['PUT', '/billing/payment-method', 'billing'],
    ['PATCH', '/domains/example.com', 'domains']
  ]) {
    const res = classifyRequestIntent({
      method,
      path,
      originalUrl: path,
      cookies: { tiwlo_host_session: 'cookie_token_987654' },
      headers: {}
    });
    assert.equal(res.intent, 'authenticated_transactional');
    assert.equal(res.transactionalDomain, domain);
  }

  // Public GET read traffic
  const publicGet = classifyRequestIntent({
    method: 'GET',
    path: '/api/products',
    originalUrl: '/api/products?category=hosting',
    headers: {}
  });
  assert.equal(publicGet.intent, 'public_read');
  assert.equal(publicGet.isCacheablePublicRead, true);
  assert.equal(publicGet.isSuspicious, false);

  // Exploit & scanner probes
  const traversal = detectHackingSignature({
    method: 'GET',
    path: '/api/files',
    originalUrl: '/api/files?name=../../etc/passwd',
    headers: {}
  });
  assert.equal(traversal.detected, true);
  assert.equal(traversal.category, 'traversal');
  assert.equal(traversal.statusCode, 403);

  const sqli = detectHackingSignature({
    method: 'GET',
    path: '/api/products',
    originalUrl: '/api/products?search=test%20UNION%20SELECT%20password%20FROM%20users',
    headers: {}
  });
  assert.equal(sqli.detected, true);
  assert.equal(sqli.category, 'sqli');
  assert.equal(sqli.statusCode, 403);

  const xss = detectHackingSignature({
    method: 'GET',
    path: '/store',
    originalUrl: '/store?q=<script>alert(1)</script>',
    headers: {}
  });
  assert.equal(xss.detected, true);
  assert.equal(xss.category, 'xss');
  assert.equal(xss.statusCode, 403);

  for (const probePath of ['/.env', '/wp-login.php', '/phpmyadmin']) {
    const classified = classifyRequestIntent({
      method: 'GET',
      path: probePath,
      originalUrl: probePath,
      headers: {}
    });
    assert.equal(classified.intent, 'suspicious_probe');
    assert.equal(classified.isSuspicious, true);
    assert.equal(classified.hackingSignature.category, 'scanner');
    assert.equal(classified.hackingSignature.statusCode, 404);
  }
});

test('normal multi-link clicking and authenticated transactional checkout/order bursts pass untouched', async () => {
  resetTrafficShieldForTests();

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(createSmartTrafficShieldMiddleware());

  let nextCalls = 0;
  app.use((req, res, next) => {
    nextCalls += 1;
    next();
  });

  app.get('*', (req, res) => {
    res.status(200).json({ ok: true, path: req.path });
  });
  app.post('*', (req, res) => {
    res.status(201).json({ ok: true, tx: req.path });
  });
  app.put('*', (req, res) => {
    res.status(200).json({ ok: true, tx: req.path });
  });
  app.patch('*', (req, res) => {
    res.status(200).json({ ok: true, tx: req.path });
  });

  await withServer(app, async (baseUrl) => {
    const browsePaths = [
      '/',
      '/health',
      '/products',
      '/products/starter-vps',
      '/products/pro-vps',
      '/pricing',
      '/catalog',
      '/store/themes',
      '/store/plugins',
      '/about',
      '/contact',
      '/docs/getting-started',
      '/docs/billing',
      '/domains/search',
      '/status'
    ];

    for (const p of browsePaths) {
      const resp = await fetch(`${baseUrl}${p}`, {
        headers: { cookie: 'tiwlo_host_session=user_session_valid_001' }
      });
      assert.equal(resp.status, 200);
      assert.equal(resp.headers.get('x-shadow-cache'), null);
    }

    // Rapid authenticated transactional burst across orders, checkout, droplets, billing, domains
    const txRequests = [
      ['POST', '/api/checkout', { headers: { cookie: 'tiwlo_host_session=user_session_valid_001' } }],
      ['POST', '/api/orders', { headers: { authorization: 'Bearer valid_bearer_token_abc123' } }],
      ['POST', '/api/cloud/droplets', { headers: { authorization: 'Bearer valid_bearer_token_abc123' } }],
      ['PUT', '/api/billing', { headers: { cookie: 'tiwlo_host_session=user_session_valid_001' } }],
      ['PATCH', '/api/domains', { headers: { authorization: 'Bearer valid_bearer_token_abc123' } }],
      ['POST', '/orders', { headers: { authorization: 'Bearer valid_bearer_token_abc123' } }],
      ['POST', '/checkout', { headers: { cookie: 'tiwlo_host_session=user_session_valid_001' } }],
      ['POST', '/cloud/droplets', { headers: { authorization: 'Bearer valid_bearer_token_abc123' } }]
    ];

    for (let round = 0; round < 3; round += 1) {
      for (const [method, path, opts] of txRequests) {
        const resp = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { 'content-type': 'application/json', ...opts.headers },
          body: JSON.stringify({ step: round })
        });
        assert.ok(resp.status === 200 || resp.status === 201, `Expected 200/201 for ${method} ${path}, got ${resp.status}`);
      }
    }

    const expectedTotal = browsePaths.length + txRequests.length * 3;
    assert.equal(nextCalls, expectedTotal);

    const stats = getTrafficShieldStats();
    assert.equal(stats.blockedProbes, 0);
    assert.equal(stats.apiCooldownRejections, 0);
    assert.equal(stats.absorbedFloodRequests, 0);
    assert.equal(stats.intentCounts.authenticated_transactional, txRequests.length * 3);
  });
});

test('read GET flood from one IP hits shadow-cache HTTP 200 absorption with DB invoked only once', async () => {
  resetTrafficShieldForTests();

  let dbQueryCount = 0;
  const app = express();
  const shieldStatesSeen = [];

  // Configure tight same-path flood threshold = 1 so request #1 populates cache and #2..#25 are absorbed silently
  app.use(createSmartTrafficShieldMiddleware({
    samePathFloodThreshold: 1,
    readFloodThreshold: 1,
    readBucketCapacity: 1,
    cacheTtlMs: 20_000,
    cacheMaxEntries: 500
  }));

  app.get('/api/products', (req, res) => {
    dbQueryCount += 1;
    shieldStatesSeen.push({ ...req.trafficShield });
    res.status(200).json({
      source: 'postgres',
      items: [{ id: 1, name: 'Tiwlo Cloud NVMe' }]
    });
  });

  await withServer(app, async (baseUrl) => {
    const totalRequests = 25;
    for (let i = 0; i < totalRequests; i += 1) {
      const resp = await fetch(`${baseUrl}/api/products`);
      assert.equal(resp.status, 200, 'Flooded GET must silently return HTTP 200, never an explicit block page');
      const data = await resp.json();
      assert.deepEqual(data, {
        source: 'postgres',
        items: [{ id: 1, name: 'Tiwlo Cloud NVMe' }]
      });
      if (i > 0) {
        assert.equal(resp.headers.get('x-shadow-cache'), 'HIT');
      }
    }

    assert.equal(dbQueryCount, 1, 'Handler/DB should be invoked only ONCE while shadow cache absorbs the flood');
    assert.equal(shieldStatesSeen.length, 1);

    const stats = getTrafficShieldStats();
    assert.equal(stats.shadowCacheHits, totalRequests - 1);
    assert.equal(stats.absorbedFloodRequests, totalRequests - 1);
    assert.equal(stats.shadowCacheStores, 1);
  });

  // Also verify unit-level res.locals.servedFromShadowCache / req.trafficShield.servedFromShadowCache
  resetTrafficShieldForTests();
  const middleware = createSmartTrafficShieldMiddleware({
    samePathFloodThreshold: 1,
    readFloodThreshold: 1,
    readBucketCapacity: 1
  });

  let handlerRuns = 0;
  function invokeMockGet() {
    const req = { method: 'GET', path: '/catalog', originalUrl: '/catalog', ip: '203.0.113.99', headers: {} };
    const res = {
      statusCode: 200,
      headers: {},
      locals: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      getHeaders() { return this.headers; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; }
    };
    middleware(req, res, () => {
      handlerRuns += 1;
      res.status(200).json({ catalog: ['starter', 'pro'] });
    });
    return { req, res };
  }

  const first = invokeMockGet();
  assert.equal(handlerRuns, 1);
  assert.equal(first.req.trafficShield.servedFromShadowCache, false);

  const second = invokeMockGet();
  assert.equal(handlerRuns, 1);
  assert.equal(second.res.statusCode, 200);
  assert.equal(second.req.trafficShield.servedFromShadowCache, true);
  assert.equal(second.res.locals.servedFromShadowCache, true);
  assert.deepEqual(second.res.body, { catalog: ['starter', 'pro'] });
});

test('unauthenticated API POST spam enters temporary cooldown without breaking valid authenticated users', async () => {
  resetTrafficShieldForTests();

  let nowMs = 1_700_000_000_000;
  const app = express();
  app.use(express.json());
  app.use(createSmartTrafficShieldMiddleware({
    unauthWriteBucketCapacity: 3,
    unauthWriteBucketRefillPerSec: 0.1,
    cooldownSeconds: 30,
    now: () => nowMs
  }));

  let handlerCount = 0;
  app.post('/api/orders', (req, res) => {
    handlerCount += 1;
    res.status(201).json({ created: true });
  });

  await withServer(app, async (baseUrl) => {
    // 3 unauthenticated POSTs exhaust the burst bucket
    for (let i = 0; i < 3; i += 1) {
      const resp = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spam: i })
      });
      assert.equal(resp.status, 201);
    }

    // 4th and 5th unauthenticated POSTs trigger cooldown 429
    const cooldownResp = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spam: 4 })
    });
    assert.equal(cooldownResp.status, 429);
    const cooldownBody = await cooldownResp.json();
    assert.equal(cooldownBody.cooldownSeconds, 30);
    assert.equal(cooldownResp.headers.get('retry-after'), '30');

    // Valid authenticated checkout/order user (even from same loopback IP!) is NOT broken
    const validAuthResp = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer legitimate-user-session-token-999'
      },
      body: JSON.stringify({ plan: 'nvme-4gb' })
    });
    assert.equal(validAuthResp.status, 201);
    assert.equal(handlerCount, 4);

    // Advance clock past cooldownSeconds + token refill: unauthenticated client recovers
    nowMs += 31_000;
    const recoveredResp = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ retry: true })
    });
    assert.equal(recoveredResp.status, 201);

    const stats = getTrafficShieldStats();
    assert.equal(stats.apiCooldownRejections, 1);
  });
});

test('path traversal, SQLi, XSS, and /.env probe signatures are dropped deterministically with threat stats', async () => {
  resetTrafficShieldForTests();

  let downstreamHits = 0;
  const app = express();
  app.use(createSmartTrafficShieldMiddleware());
  app.use((req, res) => {
    downstreamHits += 1;
    res.status(200).json({ ok: true });
  });

  await withServer(app, async (baseUrl) => {
    const probes = [
      { url: '/api/files?path=../../etc/passwd', expectedStatus: 403 },
      { url: '/api/products?q=1%20UNION%20SELECT%20username,password%20FROM%20users', expectedStatus: 403 },
      { url: '/store?search=%3Cscript%3Ealert(1)%3C/script%3E', expectedStatus: 403 },
      { url: '/.env', expectedStatus: 404 },
      { url: '/wp-login.php', expectedStatus: 404 },
      { url: '/phpmyadmin/index.php', expectedStatus: 404 }
    ];

    for (const probe of probes) {
      const resp = await fetch(`${baseUrl}${probe.url}`);
      assert.equal(resp.status, probe.expectedStatus, `Expected ${probe.expectedStatus} for ${probe.url}`);
      assert.equal(resp.headers.get('x-traffic-shield'), 'dropped');
    }

    assert.equal(downstreamHits, 0, 'Exploit probes must never reach downstream handlers or DB');

    const stats = getTrafficShieldStats();
    assert.equal(stats.blockedProbes, probes.length);
    assert.equal(stats.threatEvents, probes.length);
    assert.equal(stats.intentCounts.suspicious_probe, probes.length);
    assert.equal(stats.topThreatIps.length, 1);
    assert.ok(stats.topThreatIps[0].threatScore >= 200);
  });
});

test('shadow cache stays strictly bounded by cacheMaxEntries (LRU eviction)', async () => {
  resetTrafficShieldForTests();

  const app = express();
  app.use(createSmartTrafficShieldMiddleware({ cacheMaxEntries: 5 }));
  app.get('/api/products/:id', (req, res) => {
    res.status(200).json({ id: req.params.id });
  });

  await withServer(app, async (baseUrl) => {
    for (let i = 1; i <= 9; i += 1) {
      const resp = await fetch(`${baseUrl}/api/products/${i}`);
      assert.equal(resp.status, 200);
    }

    const stats = getTrafficShieldStats();
    assert.equal(stats.shadowCacheEntries, 5);
    assert.equal(stats.shadowCacheMaxEntries, 5);
    assert.equal(stats.shadowCacheStores, 9);
  });
});

test('adversarial hardening: fail-closed shadow cache, requireVerifiedAuth anti-spoof, AI-hacker block, and PoW shared-IP exemption', async () => {
  resetTrafficShieldForTests();

  // 1. Fail-closed shadow cache refuses non-allowlisted endpoints & session-cookie requests,
  //    while requireVerifiedAuth rejects forged Authorization Bearer headers.
  let privateHits = 0;
  const appStrict = express();
  appStrict.use(cookieParser());
  appStrict.use(express.json());
  appStrict.use(createSmartTrafficShieldMiddleware({
    requireVerifiedAuth: true,
    unauthWriteBucketCapacity: 1,
    unauthWriteBucketRefillPerSec: 0.01,
    cooldownSeconds: 30
  }));
  appStrict.get('/api/domains', (_req, res) => {
    privateHits += 1;
    res.json({ private: privateHits });
  });
  appStrict.get('/api/products', (_req, res) => {
    privateHits += 1;
    res.json({ products: privateHits });
  });
  appStrict.post('/api/orders', (req, res) => {
    if (req.headers['x-test-solve'] === '1') {
      res.status(200).json({ ok: true });
      return;
    }
    res.status(201).json({ order: 'created' });
  });

  await withServer(appStrict, async (baseUrl) => {
    // Non-allowlisted routes never hit shadow cache
    for (let i = 0; i < 3; i += 1) {
      const r = await fetch(`${baseUrl}/api/domains`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('x-shadow-cache'), null);
    }
    // Requests carrying storefront/host session cookies on allowlisted /api/products never cache
    for (let i = 0; i < 3; i += 1) {
      const r = await fetch(`${baseUrl}/api/products`, {
        headers: { cookie: 'tiwlo_store_customer_session=cust_secret_token_999' }
      });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('x-shadow-cache'), null);
    }
    assert.equal(getTrafficShieldStats().shadowCacheEntries, 0);

    // AI hacker UAs, offensive headers, honeypot paths, and PHP webshells are blocked 403/404 immediately
    const aiBlock = await fetch(`${baseUrl}/api/products`, {
      headers: { 'user-agent': 'PentestGPT/2.0 AutonomousScanner' }
    });
    assert.equal(aiBlock.status, 403);
    assert.equal((await aiBlock.json()).code, 'AI_HACKER_BLOCKED');

    const honeypot = await fetch(`${baseUrl}/_debug/env`);
    assert.equal(honeypot.status, 404);

    const phpShell = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload: "<?php eval(base64_decode($_POST['cmd'])); ?>" })
    });
    assert.equal(phpShell.status, 403);

    // Spoofed Bearer header cannot bypass unauthenticated write limit when requireVerifiedAuth: true
    const firstWrite = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer spoofed_unverified_token_123456',
        'user-agent': 'Mozilla/5.0 HumanBrowser'
      },
      body: JSON.stringify({ step: 1 })
    });
    assert.equal(firstWrite.status, 201);

    const secondWrite = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer spoofed_unverified_token_123456',
        'user-agent': 'Mozilla/5.0 HumanBrowser'
      },
      body: JSON.stringify({ step: 2 })
    });
    assert.equal(secondWrite.status, 429);
    const challengeBody = await secondWrite.json();
    assert.equal(challengeBody.code, 'SHIELD_CHALLENGE_REQUIRED');
    assert.ok(challengeBody.challenge?.challengeToken);

    // Innocent browser behind the SAME NAT IP solves the Google-style PoW challenge and gets through without IP lockout
    const mockReq = { headers: { 'user-agent': 'Mozilla/5.0 InnocentNeighborBrowser' } };
    const issued = issueShieldChallenge(mockReq, { difficulty: 3 });
    let solution = '';
    for (let n = 0; n < 200_000; n += 1) {
      const candidate = n.toString(36);
      const hex = crypto.createHash('sha256').update(`${issued.challengeToken}:${candidate}`).digest('hex');
      if (hex.startsWith('000')) {
        solution = candidate;
        break;
      }
    }
    assert.ok(solution, 'Expected PoW solution to be found');
    const verified = verifyShieldChallengeSolution(mockReq, {
      challengeToken: issued.challengeToken,
      solution
    });
    assert.equal(verified.valid, true);
    assert.ok(verified.clearanceCookieValue);

    const clearedHumanWrite = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 InnocentNeighborBrowser',
        cookie: `${SHIELD_CLEARANCE_COOKIE}=${verified.clearanceCookieValue}`
      },
      body: JSON.stringify({ cleanCheckout: true })
    });
    assert.equal(clearedHumanWrite.status, 201);
  });
});
