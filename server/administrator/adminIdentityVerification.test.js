import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { getPgPool } from '../db/postgres.js';
import { MasterDB } from '../db/multiTenant.js';
import { identityVerificationEmailNotifications } from '../db/emailService.js';
import { identityVerificationEvidence } from '../db/identityVerificationEvidence.js';
import { decryptDocumentNumber, identityReviewStore } from '../db/identityReviewStore.js';
import adminRoutes from './adminRoutes.js';

test('admin identity lock requires confirmation request and affects only the selected account', async t => {
  const users = new Map([
    ['customer-one', {
      id: 'customer-one',
      email: 'one@example.com',
      name: 'Customer One',
      role: 'owner',
      isBanned: false,
      identityVerified: false,
      identityVerificationRequired: false
    }],
    ['customer-two', {
      id: 'customer-two',
      email: 'two@example.com',
      role: 'owner',
      isBanned: false,
      identityVerified: false,
      identityVerificationRequired: false
    }]
  ]);
  const lockedIds = [];
  const revokedIds = [];
  const notifiedEmails = [];

  t.mock.method(MasterDB, 'getSession', async () => ({
    user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' }
  }));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => users.get(id) || null);
  t.mock.method(MasterDB, 'updateUser', async (id, updates) => {
    lockedIds.push(id);
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  });
  t.mock.method(MasterDB, 'revokeUserSessions', async id => {
    revokedIds.push(id);
  });
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  t.mock.method(identityVerificationEmailNotifications, 'required', async ({ to }) => {
    notifiedEmails.push(to);
    return { success: true };
  });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/admin/users/customer-one/identity-verification/require`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-session', 'Content-Type': 'application/json' }
    }
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.deepEqual(lockedIds, ['customer-one']);
  assert.deepEqual(revokedIds, ['customer-one']);
  assert.deepEqual(notifiedEmails, ['one@example.com']);
  assert.equal(users.get('customer-one').identityVerificationRequired, true);
  assert.equal(users.get('customer-two').identityVerificationRequired, false);
});

test('admin can unverify one account and requires it to verify again', async t => {
  const users = new Map([
    ['customer-one', {
      id: 'customer-one',
      email: 'one@example.com',
      name: 'Customer One',
      role: 'owner',
      identityVerified: true,
      identityVerificationRequired: false
    }],
    ['customer-two', {
      id: 'customer-two',
      email: 'two@example.com',
      role: 'owner',
      identityVerified: true,
      identityVerificationRequired: false
    }]
  ]);
  const updatedIds = [];
  const revokedIds = [];
  t.mock.method(MasterDB, 'getSession', async () => ({
    user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' }
  }));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => users.get(id) || null);
  t.mock.method(MasterDB, 'updateUser', async (id, updates) => {
    updatedIds.push(id);
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  });
  t.mock.method(MasterDB, 'revokeUserSessions', async id => {
    revokedIds.push(id);
  });
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  t.mock.method(identityVerificationEmailNotifications, 'required', async () => ({ success: true }));

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/admin/users/customer-one/identity-verification/unverify`,
    {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-session', 'Content-Type': 'application/json' }
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(updatedIds, ['customer-one']);
  assert.deepEqual(revokedIds, ['customer-one']);
  assert.equal(users.get('customer-one').identityVerified, false);
  assert.equal(users.get('customer-one').identityVerificationRequired, true);
  assert.equal(users.get('customer-two').identityVerified, true);
  assert.equal(users.get('customer-two').identityVerificationRequired, false);
});

test('verification evidence is listed only through the authenticated admin page', async t => {
  const user = {
    id: 'customer-one',
    tiwiId: 'TW-1001',
    email: 'one@example.com',
    role: 'owner',
    identityVerified: true,
    identityVerificationRequired: false
  };
  const queries = [];
  t.mock.method(MasterDB, 'getSession', async token => (
    token === 'admin-session'
      ? { user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' } }
      : null
  ));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => id === user.id ? user : null);
  t.mock.method(getPgPool(), 'query', async (sql, params) => {
    queries.push({ sql, params });
    return {
      rows: [{
        id: 'evidence-1',
        storage_path: '/uploads/verification/TW-1001/attempt.document.png',
        original_filename: 'passport-document.png',
        content_type: 'image/png',
        size_bytes: 4096,
        created_at: '2026-10-28T10:00:00.000Z'
      }]
    };
  });

  const app = express();
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/admin/users/customer-one/identity-verification`;

  const anonymousResponse = await fetch(url);
  assert.equal(anonymousResponse.status, 401);

  const response = await fetch(url, {
    headers: { Authorization: 'Bearer admin-session' }
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.user.tiwiId, 'TW-1001');
  assert.deepEqual(result.files.map(file => file.category), ['document']);
  const evidenceQuery = queries.find(query => Array.isArray(query.params) && query.params[1] === 'identity_verification');
  assert.ok(evidenceQuery, 'identity verification evidence query should run');
  assert.deepEqual(evidenceQuery.params, [
    'customer-one',
    'identity_verification',
    '/uploads/verification/TW-1001/'
  ]);
});

test('GET /api/admin/identity-reviews returns enriched risk score, stores, orders stats, and masked PII before review', async t => {
  identityReviewStore.resetMemoryStore();
  identityVerificationEvidence.resetMemoryStore();
  t.after(() => {
    identityReviewStore.resetMemoryStore();
    identityVerificationEvidence.resetMemoryStore();
  });

  const users = new Map([
    ['customer-risk', {
      id: 'customer-risk',
      tiwiId: 'TW-2001',
      storeId: 'TW-2001',
      name: 'Risky Applicant',
      email: 'risky@mailinator.com',
      phone: '+15550001111',
      role: 'owner',
      planId: 'growth',
      planName: 'Growth Retailer',
      identityVerified: false,
      identityVerificationRequired: true,
      isBanned: false
    }],
    ['banned-sibling', {
      id: 'banned-sibling',
      tiwiId: 'TW-2002',
      name: 'Banned Sibling',
      email: 'sibling@example.com',
      phone: '+15550001111',
      role: 'owner',
      isBanned: true,
      banReason: 'Abuse'
    }]
  ]);

  t.mock.method(MasterDB, 'getSession', async () => ({
    user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' }
  }));
  t.mock.method(getPgPool(), 'query', async (sql) => {
    if (String(sql).includes('FROM orders')) {
      return { rows: [{ count: 4 }] };
    }
    return { rows: [] };
  });
  t.mock.method(MasterDB, 'getUsers', async () => [...users.values()]);
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => users.get(id) || null);
  t.mock.method(MasterDB, 'getMasterData', async () => ({
    stores: [
      { id: 'st-1', tiwiId: 'TW-2001', ownerId: 'customer-risk', storeName: 'Alpha Store', subdomain: 'alpha.tiwlo.com', planId: 'growth', status: 'active' },
      { id: 'st-2', tiwiId: 'TW-2009', ownerId: 'customer-risk', storeName: 'Beta Store', subdomain: 'beta.tiwlo.com', planId: 'free', status: 'active' }
    ]
  }));

  const storedFiles = await identityVerificationEvidence.store({
    user: users.get('customer-risk'),
    document: { buffer: Buffer.from('doc-bytes'), detectedFormat: 'png' },
    selfie: { buffer: Buffer.from('selfie-bytes'), detectedFormat: 'jpg' },
    recording: Buffer.from('mp4-bytes'),
    documentType: 'other_document'
  });
  assert.equal(storedFiles.length, 3);
  assert.ok(storedFiles.some(f => f.filename === 'other_document-document.png'));

  const created = await identityReviewStore.createOrUpdateReview({
    id: 'rev-risk-1',
    userId: 'customer-risk',
    tiwiId: 'TW-2001',
    userName: 'Risky Applicant',
    userEmail: 'risky@mailinator.com',
    documentType: 'other_document',
    source: 'gemini_fallback',
    aiConfidence: 0.42,
    aiReason: 'Glare on document corner',
    extractedData: {
      fullName: 'Risky Applicant',
      dateOfBirth: '1994-05-12',
      documentNumber: 'DOC99884321'
    },
    evidenceFiles: storedFiles,
    metadata: {
      telemetry: { vpnDetected: true, attemptCount: 3 },
      attestation: { challengePassed: true },
      duplicateLinkedAccounts: [{ userId: 'banned-sibling', tiwiId: 'TW-2002', reason: 'Document match' }]
    }
  });
  await identityReviewStore.createOrUpdateReview({
    id: 'rev-other-user',
    userId: 'banned-sibling',
    tiwiId: 'TW-2002',
    userName: 'Banned Sibling',
    userEmail: 'sibling@example.com',
    documentType: 'passport'
  });
  assert.equal(created.extractedData.documentNumber, undefined);
  assert.equal(created.extractedData.maskedDocumentNumber, '*******4321');
  assert.equal(decryptDocumentNumber(created.metadata.encryptedDocumentNumber), 'DOC99884321');

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const listRes = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/identity-reviews?status=pending_review&userId=customer-risk`, {
    headers: { Authorization: 'Bearer admin-session' }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.equal(listData.success, true);
  assert.equal(listData.counts.all, 1);
  assert.equal(listData.counts.pending_review, 1);
  assert.equal(listData.reviews.length, 1);

  const review = listData.reviews[0];
  assert.equal(review.id, 'rev-risk-1');
  assert.deepEqual(review.metadata.duplicateLinkedAccounts, [{ userId: 'banned-sibling', tiwiId: 'TW-2002', reason: 'Document match' }]);
  assert.equal(review.documentType, 'other_document');
  assert.equal(review.documentTypeLabel, 'Other Document');
  assert.equal(review.extractedData.documentNumber, undefined);
  assert.equal(review.extractedData.maskedDocumentNumber, '*******4321');
  assert.ok(review.riskSummary.riskScore >= 50, `Expected high riskScore, got ${review.riskSummary.riskScore}`);
  assert.ok(['high', 'critical'].includes(review.riskSummary.riskLevel));
  assert.ok(review.riskSummary.flags.includes('BAN_EVASION_RISK'));
  assert.ok(review.riskSummary.flags.includes('DISPOSABLE_EMAIL'));
  assert.ok(review.riskSummary.flags.includes('VPN_OR_PROXY_NETWORK'));
  assert.ok(review.riskSummary.flags.includes('RAPID_VERIFICATION_ATTEMPTS'));
  assert.equal(review.stats.storesCount, 2);
  assert.equal(review.stats.stores.length, 2);
  assert.equal(review.stats.ordersCount, 4);
  assert.equal(review.stats.subscriptionPlan, 'Growth Retailer');
  assert.equal(review.evidenceFiles.length, 3);

  const detailRes = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/identity-reviews/rev-risk-1`, {
    headers: { Authorization: 'Bearer admin-session' }
  });
  assert.equal(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.equal(detailData.review.id, 'rev-risk-1');
  assert.equal(detailData.review.evidenceFiles.length, 3);
});

test('POST /api/admin/identity-reviews/:id/decision handles accept, decline, and permanent close lock', async t => {
  identityReviewStore.resetMemoryStore();
  t.after(() => identityReviewStore.resetMemoryStore());

  const users = new Map([
    ['user-accept', {
      id: 'user-accept',
      email: 'accept@example.com',
      name: 'Accept User',
      role: 'owner',
      identityVerified: false,
      identityVerificationRequired: true
    }],
    ['user-decline', {
      id: 'user-decline',
      email: 'decline@example.com',
      name: 'Decline User',
      role: 'owner',
      identityVerified: false,
      identityVerificationRequired: true
    }],
    ['user-close', {
      id: 'user-close',
      email: 'close@example.com',
      name: 'Close User',
      role: 'owner',
      identityVerified: false,
      identityVerificationRequired: true
    }]
  ]);

  const completedEmails = [];
  const requiredEmails = [];

  t.mock.method(MasterDB, 'getSession', async () => ({
    user: { id: 'admin-one', email: 'admin@example.com', role: 'admin' }
  }));
  t.mock.method(getPgPool(), 'query', async () => ({ rows: [{ id: 1 }] }));
  t.mock.method(MasterDB, 'findUserByIdentifier', async id => users.get(id) || null);
  t.mock.method(MasterDB, 'updateUser', async (id, updates) => {
    const user = users.get(id);
    if (!user) return null;
    Object.assign(user, updates);
    return user;
  });
  t.mock.method(identityVerificationEmailNotifications, 'completed', async ({ to }) => {
    completedEmails.push(to);
    return { success: true };
  });
  t.mock.method(identityVerificationEmailNotifications, 'required', async ({ to }) => {
    requiredEmails.push(to);
    return { success: true };
  });

  await identityReviewStore.createOrUpdateReview({ id: 'rev-accept', userId: 'user-accept', userEmail: 'accept@example.com', documentType: 'passport' });
  await identityReviewStore.createOrUpdateReview({ id: 'rev-decline', userId: 'user-decline', userEmail: 'decline@example.com', documentType: 'national_id' });
  await identityReviewStore.createOrUpdateReview({ id: 'rev-close', userId: 'user-close', userEmail: 'close@example.com', documentType: 'drivers_license' });

  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/admin/identity-reviews`;
  const headers = { Authorization: 'Bearer admin-session', 'Content-Type': 'application/json' };

  // 1. Accept
  const acceptRes = await fetch(`${baseUrl}/rev-accept/decision`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'accept', reason: 'Verified manually' })
  });
  assert.equal(acceptRes.status, 200);
  const acceptBody = await acceptRes.json();
  assert.equal(acceptBody.review.status, 'accepted');
  assert.equal(users.get('user-accept').identityVerified, true);
  assert.equal(users.get('user-accept').identityVerificationRequired, false);
  assert.deepEqual(completedEmails, ['accept@example.com']);

  // 2. Decline
  const declineRes = await fetch(`${baseUrl}/rev-decline/decision`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'decline', reason: 'Blurry photo' })
  });
  assert.equal(declineRes.status, 200);
  const declineBody = await declineRes.json();
  assert.equal(declineBody.review.status, 'declined');
  assert.equal(users.get('user-decline').identityVerified, false);
  assert.equal(users.get('user-decline').identityVerificationRequired, true);
  assert.deepEqual(requiredEmails, ['decline@example.com']);

  // 3. Permanently close
  const closeRes = await fetch(`${baseUrl}/rev-close/decision`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'permanently_close', reason: 'Forged document' })
  });
  assert.equal(closeRes.status, 200);
  const closeBody = await closeRes.json();
  assert.equal(closeBody.review.status, 'permanently_closed');
  assert.equal(closeBody.review.isPermanentlyClosed, true);
  assert.equal(users.get('user-close').identityVerified, false);
  assert.equal(users.get('user-close').identityVerificationRequired, true);

  // Trying any action after permanently_close must return 403 REVIEW_PERMANENTLY_CLOSED
  for (const blockedAction of ['accept', 'decline', 'permanently_close']) {
    const retryRes = await fetch(`${baseUrl}/rev-close/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: blockedAction, reason: 'Attempt override' })
    });
    assert.equal(retryRes.status, 403);
    const retryBody = await retryRes.json();
    assert.equal(retryBody.code, 'REVIEW_PERMANENTLY_CLOSED');
  }
});

test('identityReviewStore.findDuplicateDocumentMatch detects reused document numbers and identity hashes across accounts', async t => {
  identityReviewStore.resetMemoryStore();
  t.after(() => identityReviewStore.resetMemoryStore());

  const original = await identityReviewStore.createOrUpdateReview({
    id: 'rev-orig-1',
    userId: 'user-original',
    userEmail: 'orig@example.com',
    documentType: 'passport',
    status: 'accepted',
    extractedData: {
      fullName: 'Alice Rahman',
      dateOfBirth: '1992-03-14',
      documentNumber: 'P-88776655'
    }
  });

  // Same user should NOT trigger duplicate match
  const selfMatch = await identityReviewStore.findDuplicateDocumentMatch({
    documentFingerprint: original.documentFingerprint,
    identityHash: original.identityHash,
    excludeUserId: 'user-original'
  });
  assert.equal(selfMatch, null);

  // Different user with same document number should match
  const docMatch = await identityReviewStore.findDuplicateDocumentMatch({
    documentFingerprint: original.documentFingerprint,
    excludeUserId: 'user-offender'
  });
  assert.ok(docMatch);
  assert.equal(docMatch.id, 'rev-orig-1');
  assert.equal(docMatch.userId, 'user-original');

  // Different user with same fullName + dateOfBirth (when documentNumber is present) should also match
  const idMatch = await identityReviewStore.findDuplicateDocumentMatch({
    identityHash: original.identityHash,
    excludeUserId: 'user-offender-2'
  });
  assert.ok(idMatch);
  assert.equal(idMatch.id, 'rev-orig-1');

  // Mark offending account duplicate ban and verify fraud permanently_closed also blocks future reuse
  const bannedReview = await identityReviewStore.markDuplicateIdentityBan({
    userId: 'user-offender',
    documentType: 'passport',
    documentFingerprint: original.documentFingerprint,
    identityHash: original.identityHash,
    matchedReviewId: original.id,
    matchedUserId: original.userId
  });
  assert.equal(bannedReview.status, 'permanently_closed');
  assert.equal(bannedReview.isPermanentlyClosed, true);
  assert.equal(bannedReview.metadata.duplicateIdentityBan, true);

  const deletedCount = await identityReviewStore.deleteByUserId('user-original');
  assert.equal(deletedCount, 1);
  assert.equal(await identityReviewStore.getReviewById('rev-orig-1'), null);
});
