import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amountToCents,
  calculateAccountBalance,
  calculateInventoryValuation,
  calculatePercentageCents,
  reverseOrderInventory,
  sumPaymentCents
} from './accountingHelpers.js';

test('money is normalized to safe integer cents', () => {
  assert.equal(amountToCents('0.10'), 10);
  assert.equal(amountToCents(1.005), 101);
  assert.equal(amountToCents(-0.01), null);
  assert.equal(amountToCents('not money'), null);
  assert.equal(amountToCents(Number.MAX_VALUE), null);
});

test('payment ledger sums cents without floating point drift', () => {
  assert.equal(sumPaymentCents([{ amount: 0.1 }, { amount: 0.2 }, { amount: 0.07 }]), 37);
  assert.equal(sumPaymentCents([]), 0);
  assert.equal(sumPaymentCents([{ amount: 'bad' }]), null);
});

test('percentage calculations round once to cents without floating point drift', () => {
  assert.equal(calculatePercentageCents(2000, 8.875), 178);
  assert.equal(calculatePercentageCents(75, 8), 6);
  assert.equal(calculatePercentageCents(10000, 0), 0);
  assert.equal(calculatePercentageCents(Number.MAX_SAFE_INTEGER, 100), Number.MAX_SAFE_INTEGER);
  assert.equal(calculatePercentageCents(-1, 8), null);
  assert.equal(calculatePercentageCents(100, 'invalid'), null);
});

test('account balance applies payments and supplier credits without a negative due', () => {
  assert.deepEqual(calculateAccountBalance(10000, 2500, 0), {
    dueCents: 7500,
    creditBalanceCents: 0,
    paymentStatus: 'Partial'
  });
  assert.deepEqual(calculateAccountBalance(10000, 0, 10000), {
    dueCents: 0,
    creditBalanceCents: 0,
    paymentStatus: 'Credited'
  });
  assert.deepEqual(calculateAccountBalance(10000, 9000, 2000), {
    dueCents: 0,
    creditBalanceCents: 1000,
    paymentStatus: 'Credited'
  });
  assert.equal(calculateAccountBalance(Number.MAX_VALUE, 0, 0), null);
});

test('inventory valuation uses exact cents and never invents missing cost prices', () => {
  assert.deepEqual(calculateInventoryValuation([
    { stock: 3, price: '1.25', costPrice: '0.75' },
    { stock: 2, price: '0.10', costPrice: '0.06' }
  ]), {
    totalUnits: 5,
    retailValueCents: 395,
    costValueCents: 237,
    potentialProfitCents: 158,
    marginPercent: 40,
    unvaluedProductCount: 0,
    isCostValuationComplete: true
  });
  assert.deepEqual(calculateInventoryValuation([
    { stock: 2, price: 10 },
    { stock: 1, price: 5, costPrice: 2 }
  ]), {
    totalUnits: 3,
    retailValueCents: 2500,
    costValueCents: null,
    potentialProfitCents: null,
    marginPercent: null,
    unvaluedProductCount: 1,
    isCostValuationComplete: false
  });
  assert.equal(calculateInventoryValuation([{ stock: -1, price: 1 }]), null);
});

test('order returns reverse inventory using exact cents and reject invalid history without mutation', () => {
  const products = [
    { id: 'p1', stock: 2, sold: 4, revenue: 10.01 },
    { id: 'p2', stock: 1, sold: 1, revenue: 3 }
  ];
  assert.deepEqual(reverseOrderInventory(products, [
    { productId: 'p1', quantity: 2, total: '4.01' },
    { productId: 'p2', quantity: 1, unitPrice: '3.00' }
  ]), {
    products: [
      { id: 'p1', stock: 4, sold: 2, revenue: 6 },
      { id: 'p2', stock: 2, sold: 0, revenue: 0 }
    ],
    changedProductIds: ['p1', 'p2']
  });
  assert.deepEqual(products, [
    { id: 'p1', stock: 2, sold: 4, revenue: 10.01 },
    { id: 'p2', stock: 1, sold: 1, revenue: 3 }
  ]);
  assert.equal(reverseOrderInventory(products, [
    { productId: 'p1', quantity: 1, total: -1 }
  ]), null);
  assert.equal(reverseOrderInventory(products, [
    { productId: 'missing', quantity: 1, total: 1 }
  ]), null);
});
