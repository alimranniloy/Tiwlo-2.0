import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  canTransitionOrder,
  normalizePhone,
  validateOrderUpdate
} from './orderHelpers.js';

test('order lifecycle allows valid forward progress and terminal states', () => {
  assert.ok(ORDER_STATUSES.includes('Pending'));
  assert.ok(PAYMENT_STATUSES.includes('Paid'));
  assert.equal(canTransitionOrder('Pending', 'Confirmed'), true);
  assert.equal(canTransitionOrder('Processing', 'Shipped'), true);
  assert.equal(canTransitionOrder('Shipped', 'Delivered'), true);
  assert.equal(canTransitionOrder('Delivered', 'Cancelled'), false);
  assert.equal(canTransitionOrder('Cancelled', 'Processing'), false);
});

test('order update prevents direct payment status edits and validates courier and tracking fields', () => {
  assert.equal(validateOrderUpdate({ status: 'Unverified' }), 'Select a valid order status.');
  assert.match(validateOrderUpdate({ paymentStatus: 'Paid' }), /cannot be edited directly/);
  assert.match(validateOrderUpdate({ trackingNumber: 'x'.repeat(121) }), /120 characters/);
  assert.match(validateOrderUpdate({ trackingUrl: 'javascript:alert(1)' }), /HTTPS/);
  assert.equal(validateOrderUpdate({ trackingUrl: 'https://courier.example/track/123' }), null);
  assert.equal(validateOrderUpdate({ status: 'Shipped', courierService: 'Pathao', trackingNumber: 'TRK-1' }), null);
});

test('phone normalization is suitable for exact customer verification', () => {
  assert.equal(normalizePhone('+880 1712-345678'), '8801712345678');
});
