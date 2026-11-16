import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeSaltedDocumentHashes,
  buildSignedVerificationAttestation,
  computeMrzCheckDigit,
  validatePassportMrz,
  recordAndEvaluatePaymentBillingRisk,
  evaluateStoreCreationAnomaly,
  scanAndNotifyExpiringDocuments,
  resetEngineMemoryStores
} from './identityVerificationEngine.js';

test('computeSaltedDocumentHashes normalizes document numbers and identity hashes deterministically', () => {
  const a = computeSaltedDocumentHashes({
    documentType: 'national_id',
    documentNumber: 'NID-1998 4455 66',
    fullName: 'Tariqul  Islam',
    dateOfBirth: '1998-05-14',
    address: 'Dhaka, Bangladesh'
  });
  const b = computeSaltedDocumentHashes({
    documentType: 'national_id',
    documentNumber: 'nid1998445566',
    fullName: 'tariqul islam',
    dateOfBirth: '1998-05-14',
    address: 'dhaka,   bangladesh'
  });
  const c = computeSaltedDocumentHashes({
    documentType: 'passport',
    documentNumber: 'nid1998445566',
    fullName: 'Different Person',
    dateOfBirth: '1990-01-01'
  });

  assert.ok(a.documentFingerprint && a.documentFingerprint.length === 64);
  assert.equal(a.documentFingerprint, b.documentFingerprint);
  assert.equal(a.identityHash, b.identityHash);
  assert.notEqual(a.documentFingerprint, c.documentFingerprint);
});

test('buildSignedVerificationAttestation emits non-empty SHA-256 evidence digest and HMAC-SHA512 signature', () => {
  const att = buildSignedVerificationAttestation({
    userId: 'usr_123',
    documentFingerprint: 'abc123',
    evidenceFiles: [{ id: 'ev_1', kind: 'document', sizeBytes: 2048 }]
  });
  assert.match(att.credentialId, /^cred_/);
  assert.equal(att.sha256Digest.length, 64);
  assert.equal(att.hmacSignature.length, 128);
  assert.ok(att.issuedAt);
});

test('validatePassportMrz validates ICAO 9303 check digits and detects tampered MRZ', () => {
  const docNum = 'A12345678';
  const dob = '950412';
  const exp = '310501';
  const line1 = 'P<BGDRAHMAN<<TARIQUL<<<<<<<<<<<<<<<<<<<<<<<<';
  const compositeInput = `${docNum}${computeMrzCheckDigit(docNum)}BGD${dob}${computeMrzCheckDigit(dob)}M${exp}${computeMrzCheckDigit(exp)}<<<<<<<<<<<<<<<`;
  const padded = compositeInput.slice(0, 43);
  const line2 = `${padded}${computeMrzCheckDigit(`${docNum}${computeMrzCheckDigit(docNum)}${dob}${computeMrzCheckDigit(dob)}${exp}${computeMrzCheckDigit(exp)}<<<<<<<<<<<<<<<`)}`;
  const res = validatePassportMrz(line1, line2);
  assert.equal(res.present, true);
  assert.equal(res.checks.docValid, true);
  assert.equal(res.checks.dobValid, true);
  assert.equal(res.checks.expiryValid, true);
  assert.equal(res.documentNumber, 'A12345678');
  assert.equal(res.dateOfBirth, '1995-04-12');
  assert.equal(res.expiryDate, '2031-05-01');

  const tampered = validatePassportMrz(line1, line2.replace('A12345678', 'B99999999'));
  assert.equal(tampered.valid, false);
  assert.equal(tampered.checks.docValid, false);
});

test('recordAndEvaluatePaymentBillingRisk triggers verification when two accounts share billing/wallet signal', async () => {
  resetEngineMemoryStores();
  const users = new Map([
    ['u1', { id: 'u1', email: 'u1@example.com', name: 'Owner One', identityVerified: true, identityVerificationRequired: false }],
    ['u2', { id: 'u2', email: 'u2@example.com', name: 'Owner Two', identityVerified: false, identityVerificationRequired: false }]
  ]);
  const emailsSent = [];
  const mockMasterDb = {
    async findUserByIdentifier(id) { return users.get(id) || null; },
    async updateUser(id, patch) { Object.assign(users.get(id), patch); return users.get(id); }
  };
  const mockNotifier = { required: async (p) => emailsSent.push(p) };

  const first = await recordAndEvaluatePaymentBillingRisk({
    userId: 'u1',
    billingPhone: '+8801711000222',
    paymentAccountId: 'bkash-01711000222',
    masterDb: mockMasterDb,
    emailNotifier: mockNotifier
  });
  assert.equal(first.triggered, false);

  const second = await recordAndEvaluatePaymentBillingRisk({
    userId: 'u2',
    billingPhone: '+8801711000222',
    masterDb: mockMasterDb,
    emailNotifier: mockNotifier
  });
  assert.equal(second.triggered, true);
  assert.equal(users.get('u2').identityVerificationRequired, true);
  assert.equal(emailsSent.length, 1);
});

test('evaluateStoreCreationAnomaly flags clone storefront names matching another owner', async () => {
  const users = new Map([
    ['u2', { id: 'u2', email: 'clone@example.com', name: 'Clone Maker', identityVerified: false, identityVerificationRequired: false }]
  ]);
  const mockMasterDb = {
    async findUserByIdentifier(id) { return users.get(id) || null; },
    async updateUser(id, patch) { Object.assign(users.get(id), patch); return users.get(id); }
  };
  const emailsSent = [];
  const res = await evaluateStoreCreationAnomaly({
    userId: 'u2',
    storeName: 'Dhaka Gadget Hub',
    allStores: [{ ownerId: 'u1', storeName: 'Dhaka Gadget Hub' }],
    masterDb: mockMasterDb,
    emailNotifier: { required: async (p) => emailsSent.push(p) }
  });
  assert.equal(res.flagged, true);
  assert.equal(users.get('u2').identityVerificationRequired, true);
  assert.equal(emailsSent.length, 1);
});

test('scanAndNotifyExpiringDocuments resets expired documents and alerts soon-to-expire ones', async () => {
  const nowMs = Date.parse('2026-11-16T12:00:00Z');
  const reviews = new Map([
    ['r_exp', { id: 'r_exp', userId: 'u_exp', status: 'accepted', extractedData: { expiryDate: '2026-11-01' }, metadata: {} }],
    ['r_soon', { id: 'r_soon', userId: 'u_soon', status: 'accepted', extractedData: { expiryDate: '2026-11-30' }, metadata: {} }]
  ]);
  const users = new Map([
    ['u_exp', { id: 'u_exp', email: 'exp@example.com', identityVerified: true, identityVerificationRequired: false }],
    ['u_soon', { id: 'u_soon', email: 'soon@example.com', identityVerified: true, identityVerificationRequired: false }]
  ]);
  const emails = [];
  const mockStore = {
    async listReviews() { return [...reviews.values()]; },
    async createOrUpdateReview(r) { reviews.set(r.id, r); return r; }
  };
  const mockMasterDb = {
    async findUserByIdentifier(id) { return users.get(id) || null; },
    async updateUser(id, patch) { Object.assign(users.get(id), patch); return users.get(id); }
  };

  const out = await scanAndNotifyExpiringDocuments({
    daysWindow: 30,
    nowMs,
    store: mockStore,
    masterDb: mockMasterDb,
    emailNotifier: { required: async (p) => emails.push(p) }
  });
  assert.equal(out.checked, 2);
  assert.equal(out.expiredCount, 1);
  assert.equal(out.expiringSoonCount, 1);
  assert.equal(out.notificationsSent, 2);
  assert.equal(users.get('u_exp').identityVerified, false);
  assert.equal(users.get('u_exp').identityVerificationRequired, true);
  assert.equal(users.get('u_soon').identityVerified, true);
});

