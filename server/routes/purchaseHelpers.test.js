import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionPurchase, receivePurchaseOrder } from './purchaseHelpers.js';

test('purchase receipt is a terminal, one-time inventory transition', () => {
  assert.equal(canTransitionPurchase('Pending', 'Ordered'), true);
  assert.equal(canTransitionPurchase('Pending', 'Received'), true);
  assert.equal(canTransitionPurchase('Ordered', 'Received'), true);
  assert.equal(canTransitionPurchase('Received', 'Received'), true);
  assert.equal(canTransitionPurchase('Received', 'Ordered'), false);

  const purchase = {
    id: 'po-1',
    status: 'Ordered',
    items: [{ productId: 'p-1', quantity: 3 }]
  };
  const initialProducts = [{ id: 'p-1', stock: 4 }];
  const firstReceipt = receivePurchaseOrder(purchase, initialProducts, '2026-10-24T00:00:00.000Z');
  assert.equal(firstReceipt.products[0].stock, 7);
  assert.equal(firstReceipt.purchase.stockRestocked, true);
  assert.equal(firstReceipt.restocked, true);

  const repeatedReceipt = receivePurchaseOrder(firstReceipt.purchase, firstReceipt.products);
  assert.equal(repeatedReceipt.products[0].stock, 7);
  assert.equal(repeatedReceipt.restocked, false);
});
