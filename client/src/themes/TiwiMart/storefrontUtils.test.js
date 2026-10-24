import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStoreCurrency,
  getProductDiscount,
  getShippingAmount,
  getStoreTaxRate,
  productDescriptionText
} from './storefrontUtils.js';

test('storefront formatting follows the configured currency', () => {
  assert.equal(formatStoreCurrency(12.5, { currency: 'BDT', currencySymbol: '৳' }), '৳12.50');
  assert.equal(formatStoreCurrency(12.5, { currency: 'USD', currencySymbol: '$' }), '$12.50');
  assert.equal(formatStoreCurrency(12.5, { currency: 'BDT (৳)', currencySymbol: '৳' }), '৳12.50');
});

test('tax rate matches the server default and configured percentage', () => {
  assert.equal(getStoreTaxRate({}), 0);
  assert.equal(getStoreTaxRate({ taxRate: 0 }), 0);
  assert.equal(getStoreTaxRate({ taxRate: 8 }), 0.08);
});

test('shipping stays unquoted unless the store configured a rate', () => {
  assert.equal(getShippingAmount(100, {}), null);
  assert.equal(getShippingAmount(100, { shippingFlatRate: 7.5 }), 7.5);
  assert.equal(getShippingAmount(200, { shippingFlatRate: 7.5, freeShippingThreshold: 150 }), 0);
});

test('only an explicit higher original price produces a discount', () => {
  assert.deepEqual(getProductDiscount({ price: 80, originalPrice: 100 }), {
    originalPrice: 100,
    percent: 20,
    savings: 20
  });
  assert.equal(getProductDiscount({ price: 80 }), null);
  assert.equal(getProductDiscount({ price: 100, originalPrice: 80 }), null);
});

test('product descriptions become safe readable text rather than rendered HTML', () => {
  assert.equal(
    productDescriptionText('<p>Useful <strong>item</strong> &amp; details</p><script>alert(1)</script>'),
    'Useful item & details'
  );
  assert.equal(productDescriptionText(''), '');
  assert.doesNotThrow(() => productDescriptionText('&#x110000;'));
});
