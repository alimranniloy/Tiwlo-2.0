import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEditStoreOrder,
  canReviewOrder,
  createCustomerSession,
  findCustomerSession,
  getCustomerOtpType,
  normalizeCustomerAddress,
  normalizeCustomerEmail,
  normalizeRefundAmount,
  validateCustomerReview
} from './storeCustomerHelpers.js';

test('normalizes customer email and binds secure OTP type to tenant', () => {
  assert.equal(normalizeCustomerEmail(' Shopper@Example.com '), 'shopper@example.com');
  assert.throws(() => normalizeCustomerEmail('bad-email'), /valid email/);
  assert.notEqual(getCustomerOtpType('tenant-a'), getCustomerOtpType('tenant-b'));
  assert.equal(getCustomerOtpType('tenant-a').length, 32);
});

test('creates expiring hashed customer sessions', () => {
  const { token, record } = createCustomerSession('customer-1', 1000);
  assert.equal(record.accountId, 'customer-1');
  assert.equal(record.tokenHash.includes(token), false);
  assert.equal(findCustomerSession([record], token, 1001)?.id, record.id);
  assert.equal(findCustomerSession([record], token, Date.parse(record.expiresAt)), null);
  assert.equal(findCustomerSession([{ ...record, expiresAt: 'invalid' }], token, 1001), null);
  assert.equal(findCustomerSession([record], 'wrong-token', 1001), null);
});

test('validates address and review payloads', () => {
  assert.equal(normalizeCustomerAddress({
    recipient: 'A Shopper', phone: '123', line1: '1 Main St', city: 'Dhaka', country: 'Bangladesh'
  }).country, 'Bangladesh');
  assert.throws(() => normalizeCustomerAddress({ line1: 'Only line' }), /required/);
  assert.equal(validateCustomerReview({ rating: 5, title: 'Great', body: 'A useful product review.' }).rating, 5);
  assert.throws(() => validateCustomerReview({ rating: 6, body: 'Review body is valid length.' }), /Rating/);
});

test('reviews require a delivered matching purchase and refunds respect remaining balance', () => {
  const order = {
    customerAccountId: 'customer-1',
    status: 'Delivered',
    totalAmount: 80,
    items: [{ productId: 'product-1' }]
  };
  assert.equal(canReviewOrder(order, 'product-1', 'customer-1'), true);
  assert.equal(canReviewOrder({ ...order, status: 'Shipped' }, 'product-1', 'customer-1'), false);
  assert.equal(canEditStoreOrder({ status: 'Pending' }), true);
  assert.equal(canEditStoreOrder({ status: 'Confirmed' }), true);
  assert.equal(canEditStoreOrder({ status: 'Processing' }), false);
  assert.equal(canEditStoreOrder({ status: 'Delivered' }), false);
  assert.equal(normalizeRefundAmount(30, order, [{ amount: 20, status: 'manually_processed' }]), 30);
  assert.throws(() => normalizeRefundAmount(70, order, [{ amount: 20, status: 'gateway_confirmed' }]), /remaining/);
  assert.throws(() => normalizeRefundAmount(70, order, [{ amount: 20, status: 'gateway_pending' }]), /remaining/);
  assert.equal(normalizeRefundAmount('0.01', { totalAmount: '0.03' }, [
    { amount: '0.02', status: 'gateway_pending' }
  ]), 0.01);
  assert.throws(() => normalizeRefundAmount('0.02', { totalAmount: '0.03' }, [
    { amount: '0.02', status: 'gateway_pending' }
  ]), /remaining/);
  assert.throws(() => normalizeRefundAmount('0.01', { totalAmount: 10 }, [
    { amount: 'invalid', status: 'gateway_pending' }
  ]), /history/);
});
