import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePromotionDiscount } from './promotionHelpers.js';

test('promotion code validation normalizes case and computes a bounded percentage discount', () => {
  const settings = { promoActive: true, promoCode: ' SAVE10 ', promoDiscountPercent: 10 };
  assert.deepEqual(calculatePromotionDiscount(settings, 'save10', 150), {
    valid: true,
    code: 'SAVE10',
    discountPercent: 10,
    discountAmount: 15
  });
  assert.equal(calculatePromotionDiscount(settings, 'wrong', 150).valid, false);
  assert.equal(calculatePromotionDiscount({ ...settings, promoActive: false }, 'SAVE10', 150).valid, false);
  assert.equal(calculatePromotionDiscount({ ...settings, promoDiscountPercent: 101 }, 'SAVE10', 150).valid, false);
});
