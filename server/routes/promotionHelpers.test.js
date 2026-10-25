import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePromotionDiscount,
  getPromotionUsage,
  validatePromotionSettings
} from './promotionHelpers.js';

test('promotion code validation normalizes case and computes a bounded percentage discount', () => {
  const settings = { promoActive: true, promoCode: ' SAVE10 ', promoDiscountPercent: 10 };
  assert.deepEqual(calculatePromotionDiscount(settings, 'save10', 150), {
    valid: true,
    code: 'SAVE10',
    discountAmount: 15,
    discountPercent: 10
  });
  assert.equal(calculatePromotionDiscount(settings, 'wrong', 150).valid, false);
  assert.equal(calculatePromotionDiscount({ ...settings, promoActive: false }, 'SAVE10', 150).valid, false);
  assert.equal(calculatePromotionDiscount({ ...settings, promoDiscountPercent: 101 }, 'SAVE10', 150).valid, false);
});

test('supports fixed discounts capped at subtotal and optional maximum discount', () => {
  const settings = {
    promoActive: true,
    promoCode: 'WELCOME',
    promoDiscountType: 'fixed',
    promoDiscountPercent: 30,
    promoMaximumDiscount: 20
  };
  assert.deepEqual(calculatePromotionDiscount(settings, 'welcome', 100), {
    valid: true,
    code: 'WELCOME',
    discountAmount: 20,
    discountType: 'fixed',
    discountValue: 30,
    maximumDiscount: 20
  });
  assert.equal(calculatePromotionDiscount({ ...settings, promoMaximumDiscount: 0 }, 'welcome', 12).discountAmount, 12);
});

test('enforces minimum spend, eligible country, and promotion schedule', () => {
  const settings = {
    promoActive: true,
    promoCode: 'GLOBAL',
    promoDiscountPercent: 15,
    promoMinimumSubtotal: 50,
    promoAllowedCountries: ['BD', 'US'],
    promoStartsAt: '2026-10-01T00:00:00.000Z',
    promoEndsAt: '2026-11-01T00:00:00.000Z'
  };
  assert.equal(calculatePromotionDiscount(settings, 'GLOBAL', 40, {
    countryCode: 'BD',
    now: Date.parse('2026-10-20T00:00:00Z')
  }).valid, false);
  assert.equal(calculatePromotionDiscount(settings, 'GLOBAL', 100, {
    countryCode: 'CA',
    now: Date.parse('2026-10-20T00:00:00Z')
  }).valid, false);
  assert.equal(calculatePromotionDiscount(settings, 'GLOBAL', 100, {
    countryCode: 'BD',
    now: Date.parse('2026-09-20T00:00:00Z')
  }).valid, false);
  assert.equal(calculatePromotionDiscount(settings, 'GLOBAL', 100, {
    countryCode: 'BD',
    now: Date.parse('2026-10-20T00:00:00Z')
  }).discountAmount, 15);
});

test('enforces total and per-customer redemption limits', () => {
  const settings = {
    promoActive: true,
    promoCode: 'LIMITED',
    promoDiscountPercent: 10,
    promoUsageLimit: 2,
    promoPerCustomerLimit: 1
  };
  assert.equal(calculatePromotionDiscount(settings, 'LIMITED', 100, {
    totalRedemptions: 2
  }).valid, false);
  assert.equal(calculatePromotionDiscount(settings, 'LIMITED', 100, {
    totalRedemptions: 1,
    customerRedemptions: 1
  }).valid, false);
});

test('counts redemptions by code and matches customer email or phone', () => {
  const sales = [
    { promoCode: 'welcome', customerEmail: 'buyer@example.com', customerPhone: '+1 (555) 123-4567' },
    { promoCode: 'OTHER', customerEmail: 'buyer@example.com', customerPhone: '+1 (555) 123-4567' },
    { promoCode: 'WELCOME', customerEmail: 'else@example.com', customerPhone: '+44 7700 900123' }
  ];
  assert.deepEqual(getPromotionUsage(sales, 'WELCOME', { email: 'BUYER@example.com' }), {
    total: 2,
    customer: 1
  });
  assert.deepEqual(getPromotionUsage(sales, 'welcome', { phone: '15551234567' }), {
    total: 2,
    customer: 1
  });
});

test('validates advanced promotion fields and date ordering', () => {
  assert.deepEqual(validatePromotionSettings({
    promoDiscountType: 'fixed',
    promoDiscountPercent: 15,
    promoMinimumSubtotal: 20,
    promoMaximumDiscount: 10,
    promoUsageLimit: 100,
    promoPerCustomerLimit: 1,
    promoAllowedCountries: ['BD', 'US'],
    promoStartsAt: '2026-10-01T00:00:00.000Z',
    promoEndsAt: '2026-11-01T00:00:00.000Z'
  }), []);
  assert.ok(validatePromotionSettings({
    promoDiscountType: 'percent',
    promoDiscountPercent: 101,
    promoUsageLimit: 1.5,
    promoAllowedCountries: ['invalid'],
    promoStartsAt: 'not-a-date',
    promoEndsAt: '2026-01-01T00:00:00Z'
  }).length >= 4);
});
