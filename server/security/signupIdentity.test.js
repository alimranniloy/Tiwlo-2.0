import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSignupEmail, signupEmailKey } from './signupIdentity.js';

test('consumer Gmail aliases map to one signup identity', () => {
  for (const email of [' Test.User@gmail.com ', 'testuser+second@gmail.com', 'TEST.USER+tag@googlemail.com']) {
    assert.equal(signupEmailKey(email), 'testuser@gmail.com');
  }
  assert.equal(normalizeSignupEmail(' Test.User+tag@gmail.com '), 'test.user+tag@gmail.com');
});

test('custom-domain dots and plus addresses remain distinct', () => {
  assert.notEqual(signupEmailKey('test.user@example.com'), signupEmailKey('testuser@example.com'));
  assert.notEqual(signupEmailKey('test+tag@example.com'), signupEmailKey('test@example.com'));
});

test('malformed and non-string signup emails are rejected', () => {
  for (const email of [null, {}, [], 42, 'a@@gmail.com', 'a b@gmail.com', 'a@-example.com',
    'a@example..com', '.a@gmail.com', 'a..b@gmail.com', '+tag@gmail.com', 'a@localhost',
    `${'a'.repeat(65)}@example.com`, 'a@example.com\nBcc: other@example.com']) {
    assert.equal(normalizeSignupEmail(email), null, JSON.stringify(email));
  }
});
