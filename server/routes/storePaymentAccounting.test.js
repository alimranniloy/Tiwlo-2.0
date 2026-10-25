import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recordVerifiedGatewayPayment,
  updateOrderRefundPaymentStatus
} from './storePaymentAccounting.js';

test('verified gateway payment records payment history and settled invoice totals', () => {
  const order = {
    totalAmount: 12.34,
    paymentStatus: 'Pending',
    paymentMethod: 'Stripe online',
    payments: [],
    paymentGateway: { amount: 12.34, currency: 'USD', status: 'creating' }
  };
  assert.equal(recordVerifiedGatewayPayment(order, {
    amount: '12.34',
    currency: 'USD',
    transactionId: 'txn-1',
    eventId: 'evt-1',
    providerPaymentId: 'pi-1',
    rawStatus: 'paid'
  }), true);
  assert.equal(order.paymentStatus, 'Paid');
  assert.equal(order.paidAmount, 12.34);
  assert.equal(order.dueAmount, 0);
  assert.equal(order.payments.length, 1);
  assert.equal(order.payments[0].reference, 'txn-1');
  assert.equal(order.payments[0].gatewayVerified, true);
  assert.equal(recordVerifiedGatewayPayment(order, {
    amount: '12.34', currency: 'USD', transactionId: 'txn-1'
  }), false);
  assert.equal(order.payments.length, 1);
  order.paymentStatus = 'Partially Refunded';
  assert.equal(recordVerifiedGatewayPayment(order, {
    amount: '12.34', currency: 'USD', transactionId: 'txn-1'
  }), false);
  assert.equal(order.paymentStatus, 'Partially Refunded');
});

test('verified gateway payment rejects mismatched amount, currency and transaction', () => {
  const order = {
    totalAmount: 12.34,
    paymentStatus: 'Pending',
    paymentGateway: { amount: 12.34, currency: 'USD' }
  };
  assert.throws(() => recordVerifiedGatewayPayment(order, {
    amount: '12.33', currency: 'USD', transactionId: 'txn-1'
  }), /amount or currency/);
  assert.throws(() => recordVerifiedGatewayPayment(order, {
    amount: '12.34', currency: 'EUR', transactionId: 'txn-1'
  }), /amount or currency/);
  assert.throws(() => recordVerifiedGatewayPayment(order, {
    amount: '12.34', currency: 'USD'
  }), /transaction reference/);
});

test('refund status totals only confirmed refunds and never mutates payment history', () => {
  const order = {
    totalAmount: 50,
    paymentStatus: 'Paid',
    paidAmount: 50,
    dueAmount: 0,
    payments: [{ id: 'payment-1', amount: 50 }],
    refundHistory: [
      { status: 'gateway_pending', amount: 10 },
      { status: 'manually_processed', amount: 20 },
      { status: 'gateway_confirmed', amount: 30 }
    ]
  };
  assert.equal(updateOrderRefundPaymentStatus(order), 'Refunded');
  assert.equal(order.paidAmount, 50);
  assert.equal(order.dueAmount, 0);
  assert.equal(order.payments.length, 1);
  order.refundHistory = [{ status: 'rejected', amount: 50 }];
  assert.equal(updateOrderRefundPaymentStatus(order), 'Paid');
});
